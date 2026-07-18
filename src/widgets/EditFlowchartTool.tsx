/**
 * EditFlowchartTool — the tool's structural editor island (issue #113).
 *
 * D15: the code string is always the single source of truth. Every GUI
 * operation (lib/ops.ts) takes the currently-parsed `Doc`, returns a new
 * full code string, and that string is re-parsed — the GUI never carries
 * independent state that could drift from the code. The code pane is just
 * another way to edit the same string (debounced ~300ms, D15).
 *
 * D16: while the current code fails to parse, GUI editing is disabled and
 * the last successful preview stays on screen with a "stale" badge; the code
 * pane itself is always editable so the user can fix it.
 *
 * D13: undo/redo is a capped (100) stack of code-string snapshots.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { AppCard } from './AppCard';
import { AppModal } from './AppModal';
import { FlowchartInspector, type Selection } from './FlowchartInspector';
import { ui, type UiStrings } from '@/i18n/ui';
import { validateFile } from '@/utils/fileValidation';
import { loadSettings, saveSettings } from '@/utils/settingsStorage';
import { parse } from '@/lib/parse';
import { extractMermaidFence } from '@/lib/fence';
import { diffLines } from '@/lib/diff';
import { buildAiInstructionCopy } from '@/lib/aiCopy';
import { bindSvgSelection, renderFlowchart, type SvgSelection } from '@/lib/mermaid';
import {
  BlockedByForeignEdgeError,
  BlockedByOpaqueError,
  ParseError,
  type Direction,
  type Doc,
  type HeaderLine,
  type NodeShape,
} from '@/lib/types';
import { addEdge, addNode, listEdges, listNodes, removeEdge, removeNode, setDirection, setNodeShape, updateEdge, updateNodeLabel, moveNodeToSubgraph, type EdgePatch } from '@/lib/ops';

const DEBOUNCE_MS = 300;
const HISTORY_LIMIT = 100;
const DIRECTIONS: Direction[] = ['TB', 'TD', 'BT', 'RL', 'LR'];
const DIRECTION_KEY: Record<Direction, string> = {
  TB: 'directionTB',
  TD: 'directionTD',
  BT: 'directionBT',
  RL: 'directionRL',
  LR: 'directionLR',
};

const SAMPLE_FLOWCHART = `graph TD
  subgraph App["MyApp screen"]
    Header[Header]
    subgraph Main[Main]
      List[Article list]
      Detail[Article detail]
    end
    Footer[Footer]
  end
  Header --> List
  List -->|tap| Detail
`;

type Status = 'idle' | 'processing' | 'done' | 'error';

interface HistoryState {
  stack: string[];
  index: number;
}

interface EditFlowchartToolProps {
  locale?: string;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadMmd(code: string) {
  const picker = (window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle> })
    .showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: 'flowchart.mmd',
        types: [{ description: 'Mermaid flowchart', accept: { 'text/plain': ['.mmd'] } }],
      });
      const writable = await (handle as unknown as { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
      await writable.write(code);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // user cancelled
      // fall through to the download-anchor fallback below
    }
  }
  triggerBlobDownload(new Blob([code], { type: 'text/plain;charset=utf-8' }), 'flowchart.mmd');
}

export function EditFlowchartTool({ locale = 'en' }: EditFlowchartToolProps) {
  const t: UiStrings = (ui as any)[locale] ?? ui.en;

  const [code, setCode] = useState('');
  const [importedCode, setImportedCode] = useState('');
  const [history, setHistory] = useState<HistoryState>({ stack: [''], index: 0 });
  const [liveDoc, setLiveDoc] = useState<Doc | null>(null);
  const [parseError, setParseError] = useState<ParseError | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [svg, setSvg] = useState('');
  const [svgIsStale, setSvgIsStale] = useState(false);
  const [svgSelection, setSvgSelection] = useState<SvgSelection | null>(null);

  const [selection, setSelection] = useState<Selection>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [addEdgeSource, setAddEdgeSource] = useState('');
  const [addEdgeTarget, setAddEdgeTarget] = useState('');

  const [pasteText, setPasteText] = useState('');
  const [fenceNotice, setFenceNotice] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'startOver' | null>(null);
  const [copiedButton, setCopiedButton] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const tokenRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ---------------------------------------------------------------------
  // Parse + render pipeline
  // ---------------------------------------------------------------------

  const reparseAndRender = useCallback(async (source: string) => {
    const myToken = ++tokenRef.current;
    let parsed: Doc;
    try {
      parsed = parse(source);
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      setLiveDoc(null);
      setParseError(e);
      setSvgIsStale(true);
      setStatus('error');
      return;
    }
    setParseError(null);
    setLiveDoc(parsed);
    setStatus('processing');
    try {
      const svgMarkup = await renderFlowchart(source);
      if (tokenRef.current !== myToken) return;
      setSvg(svgMarkup);
      setSvgIsStale(false);
      setStatus('done');
    } catch {
      if (tokenRef.current !== myToken) return;
      setSvgIsStale(true);
      setStatus('error');
    }
  }, []);

  /** Apply a code string without recording a new history entry (undo/redo). */
  const applyCode = useCallback(
    (source: string) => {
      setCode(source);
      void reparseAndRender(source);
    },
    [reparseAndRender]
  );

  /** Apply a code string AND record it as a new history entry (any edit). */
  const commitCode = useCallback(
    (source: string) => {
      setCode(source);
      void reparseAndRender(source);
      setHistory((prev) => {
        if (prev.stack[prev.index] === source) return prev;
        const truncated = [...prev.stack.slice(0, prev.index + 1), source];
        const overflow = truncated.length - HISTORY_LIMIT;
        const stack = overflow > 0 ? truncated.slice(overflow) : truncated;
        return { stack, index: stack.length - 1 };
      });
    },
    [reparseAndRender]
  );

  const commitCodeDebounced = useCallback(
    (source: string) => {
      setCode(source);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => commitCode(source), DEBOUNCE_MS);
    },
    [commitCode]
  );

  const importCode = useCallback((source: string) => {
    setImportedCode(source);
    setSelection(null);
    setBlockedMessage(null);
    setCode(source);
    setHistory({ stack: [source], index: 0 });
    void reparseAndRender(source);
  }, [reparseAndRender]);

  const undo = () => {
    setHistory((prev) => {
      if (prev.index <= 0) return prev;
      const index = prev.index - 1;
      applyCode(prev.stack[index]);
      return { ...prev, index };
    });
  };
  const redo = () => {
    setHistory((prev) => {
      if (prev.index >= prev.stack.length - 1) return prev;
      const index = prev.index + 1;
      applyCode(prev.stack[index]);
      return { ...prev, index };
    });
  };

  // ---------------------------------------------------------------------
  // Load persisted draft on mount; persist on change.
  // ---------------------------------------------------------------------

  useEffect(() => {
    const saved = loadSettings();
    if (saved.code) {
      setImportedCode(saved.importedCode);
      setCode(saved.code);
      setHistory({ stack: [saved.code], index: 0 });
      void reparseAndRender(saved.code);
    }
    (globalThis as Record<string, unknown>).__toolReady = true;
  }, []);

  useEffect(() => {
    saveSettings({ code, importedCode });
  }, [code, importedCode]);

  // ---------------------------------------------------------------------
  // Preview rendering + SVG click-selection binding (D12, enhancement)
  // ---------------------------------------------------------------------

  useEffect(() => {
    if (previewRef.current) previewRef.current.innerHTML = svg;
  }, [svg]);

  useEffect(() => {
    if (!liveDoc || svgIsStale || !previewRef.current) {
      setSvgSelection(null);
      return;
    }
    const nodeIds = listNodes(liveDoc).map((n) => n.id);
    const edgeLineIdxs = listEdges(liveDoc).map((e) => e.lineIdx);
    setSvgSelection(bindSvgSelection(previewRef.current, nodeIds, edgeLineIdxs));
  }, [liveDoc, svgIsStale, svg]);

  const onPreviewClick = (e: MouseEvent) => {
    if (!svgSelection) return;
    const target = e.target as Element | null;
    if (!target) return;
    const nodeId = svgSelection.nodeIdAt(target);
    if (nodeId) {
      setSelection({ type: 'node', id: nodeId });
      return;
    }
    const edgeLineIdx = svgSelection.edgeLineIdxAt(target);
    if (edgeLineIdx !== null) setSelection({ type: 'edge', lineIdx: edgeLineIdx });
  };

  // ---------------------------------------------------------------------
  // Import paths: paste textarea (idle), file drop/picker, sample
  // ---------------------------------------------------------------------

  const loadFromPaste = () => {
    const { code: extracted, multiple } = extractMermaidFence(pasteText);
    setFenceNotice(multiple);
    importCode(extracted);
    setPasteText('');
  };

  const loadSample = () => {
    setFileError(null);
    setFenceNotice(false);
    importCode(SAMPLE_FLOWCHART);
  };

  const handleFile = useCallback(
    async (file: File) => {
      const result = validateFile(file);
      if (!result.valid) {
        setFileError(t.errWrongFile.replace('{name}', file.name));
        return;
      }
      try {
        const text = await file.text();
        setFileError(null);
        const { code: extracted, multiple } = extractMermaidFence(text);
        setFenceNotice(multiple);
        importCode(extracted);
      } catch {
        setFileError(t.errWrongFile.replace('{name}', file.name));
      }
    },
    [importCode, t]
  );

  const handleDroppedFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (file) await handleFile(file);
      window.dispatchEvent(new CustomEvent('filesProcessed'));
    },
    [handleFile]
  );

  useEffect(() => {
    const handler = (e: Event) => void handleDroppedFiles((e as CustomEvent<File[]>).detail ?? []);
    window.addEventListener('filesDropped', handler);
    return () => window.removeEventListener('filesDropped', handler);
  }, [handleDroppedFiles]);

  const onFilePicked = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void handleFile(file);
    input.value = '';
  };

  // ---------------------------------------------------------------------
  // GUI operations
  // ---------------------------------------------------------------------

  const runOp = (fn: (doc: Doc) => string): boolean => {
    if (!liveDoc) return false;
    try {
      const next = fn(liveDoc);
      setBlockedMessage(null);
      commitCode(next);
      return true;
    } catch (e) {
      if (e instanceof BlockedByOpaqueError) {
        setBlockedMessage(t.blockedByOpaque.replace('{id}', e.nodeId).replace('{lines}', e.lineNumbers.join(', ')));
        return false;
      }
      if (e instanceof BlockedByForeignEdgeError) {
        setBlockedMessage(
          t.blockedByForeignEdge.replace('{id}', e.nodeId).replace('{lines}', e.lineNumbers.join(', '))
        );
        return false;
      }
      throw e;
    }
  };

  const onAddNode = () => runOp((doc) => addNode(doc));
  const onAddEdgeSubmit = (source: string, target: string) => {
    if (runOp((doc) => addEdge(doc, source, target))) {
      setAddEdgeSource('');
      setAddEdgeTarget('');
    }
  };
  const onUpdateNodeLabel = (id: string, label: string) => runOp((doc) => updateNodeLabel(doc, id, label));
  const onSetNodeShape = (id: string, shape: NodeShape) => runOp((doc) => setNodeShape(doc, id, shape));
  const onMoveNode = (id: string, targetIdx: number | null) => runOp((doc) => moveNodeToSubgraph(doc, id, targetIdx));
  const onRemoveNode = (id: string) => {
    if (runOp((doc) => removeNode(doc, id))) setSelection(null);
  };
  const onUpdateEdge = (lineIdx: number, patch: EdgePatch) => runOp((doc) => updateEdge(doc, lineIdx, patch));
  const onRemoveEdge = (lineIdx: number) => {
    if (runOp((doc) => removeEdge(doc, lineIdx))) setSelection(null);
  };
  const onSetDirection = (dir: Direction) => runOp((doc) => setDirection(doc, dir));

  const performReset = () => {
    setConfirmAction(null);
    setSelection(null);
    setBlockedMessage(null);
    setCode(importedCode);
    setHistory({ stack: [importedCode], index: 0 });
    void reparseAndRender(importedCode);
  };

  const performStartOver = () => {
    setConfirmAction(null);
    setSelection(null);
    setBlockedMessage(null);
    setLiveDoc(null);
    setParseError(null);
    setSvg('');
    setSvgIsStale(false);
    setStatus('idle');
    setImportedCode('');
    setCode('');
    setHistory({ stack: [''], index: 0 });
  };

  // ---------------------------------------------------------------------
  // Output actions
  // ---------------------------------------------------------------------

  const copyText = async (text: string, buttonId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedButton(buttonId);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedButton(null), 2000);
    } catch {
      // Clipboard API unavailable/denied — silently no-op; the code pane and
      // download remain available as fallbacks.
    }
  };

  const doc = liveDoc; // non-null alias used inside the guarded editor render below
  const headerLine = doc?.lines.find((l): l is HeaderLine => l.kind === 'header');
  const nodeCount = doc ? listNodes(doc).length : 0;
  const edgeCount = doc ? listEdges(doc).length : 0;
  const opaqueCount = doc ? doc.lines.filter((l) => l.kind === 'opaque').length : 0;
  const totalLines = doc ? doc.lines.length : 0;
  const diffStats = diffLines(importedCode, code);

  const hasContent = code.trim() !== '';

  return (
    <div>
      {!hasContent && (
        <AppCard>
          <div style="margin-bottom: var(--space-4);">
            <h2 style="margin: 0 0 var(--space-1) 0; font-size: var(--fs-4); font-weight: 600;">{t.inputHeading}</h2>
            <p style="margin: 0; font-size: var(--fs-2); color: var(--color-subtle);">{t.inputSubtitle}</p>
          </div>

          <label class="visually-hidden" for="paste-textarea">
            {t.pasteLabel}
          </label>
          <textarea
            id="paste-textarea"
            data-testid="paste-textarea"
            class="app-field__textarea"
            style="width: 100%; min-height: 180px; font-family: var(--font-mono, monospace); font-size: var(--fs-2);"
            value={pasteText}
            placeholder={t.pastePlaceholder}
            spellcheck={false}
            onInput={(e) => setPasteText((e.currentTarget as HTMLTextAreaElement).value)}
          />

          <div style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); flex-wrap: wrap; margin-top: var(--space-3);">
            <span style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
              <button
                id="load-from-text-action"
                type="button"
                class="app-button app-button--primary"
                disabled={pasteText.trim() === ''}
                onClick={loadFromPaste}
              >
                {t.loadFromText}
              </button>
              <button id="load-sample-action" type="button" class="app-button app-button--secondary" onClick={loadSample}>
                {t.loadSample}
              </button>
            </span>
          </div>

          <div style="margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--color-border);">
            <label class="app-button app-button--secondary" for="file-picker-input" style="cursor: pointer;">
              {t.dropClick}
            </label>
            <input
              id="file-picker-input"
              data-testid="file-picker-input"
              type="file"
              accept=".mmd,.mermaid,.md,.txt"
              style="position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden;"
              onChange={onFilePicked}
            />
            <p style="margin: var(--space-2) 0 0 0; font-size: var(--fs-1); color: var(--color-subtle);">
              {t.dropOr} · {t.dropSupported}
            </p>
          </div>

          {fileError && (
            <p role="alert" data-testid="file-error" style="color: var(--color-danger); font-size: var(--fs-1); margin: var(--space-2) 0 0 0;">
              {fileError}
            </p>
          )}
        </AppCard>
      )}

      {hasContent && (
        <div data-testid="editor">
          {fenceNotice && (
            <p role="status" style="font-size: var(--fs-1); color: var(--color-subtle);">
              {t.fenceNotice}
            </p>
          )}

          <AppCard>
            <div
              style="display: flex; gap: var(--space-3); flex-wrap: wrap; align-items: center; margin-bottom: var(--space-4);"
              role="toolbar"
              aria-label={t.inspectorHeading}
            >
              <label style="display: flex; align-items: center; gap: var(--space-2); font-size: var(--fs-2);" for="direction-select">
                {t.directionLabel}
                <select
                  id="direction-select"
                  class="app-field__select"
                  value={headerLine?.direction ?? 'TD'}
                  disabled={!doc}
                  onChange={(e) => onSetDirection((e.currentTarget as HTMLSelectElement).value as Direction)}
                >
                  {DIRECTIONS.map((d) => (
                    <option value={d}>{(t as Record<string, string>)[DIRECTION_KEY[d]]}</option>
                  ))}
                </select>
              </label>

              <button id="add-node-action" type="button" class="app-button app-button--secondary" disabled={!doc} onClick={onAddNode}>
                {t.addNode}
              </button>
              <button
                id="add-edge-toolbar-action"
                type="button"
                class="app-button app-button--secondary"
                disabled={!doc}
                onClick={() => setSelection(null)}
              >
                {t.addEdge}
              </button>
              <button id="undo-action" type="button" class="app-button app-button--ghost" disabled={history.index <= 0} onClick={undo}>
                {t.undo}
              </button>
              <button
                id="redo-action"
                type="button"
                class="app-button app-button--ghost"
                disabled={history.index >= history.stack.length - 1}
                onClick={redo}
              >
                {t.redo}
              </button>
              <button id="reset-action" type="button" class="app-button app-button--ghost" onClick={() => setConfirmAction('reset')}>
                {t.reset}
              </button>
              <button id="start-over-action" type="button" class="app-button app-button--ghost" onClick={() => setConfirmAction('startOver')}>
                {t.startOver}
              </button>
            </div>

            {parseError && (
              <p role="alert" data-testid="parse-error" style="color: var(--color-danger); font-size: var(--fs-2); margin: 0 0 var(--space-3) 0;">
                {t.parseErrorLabel.replace('{line}', String(parseError.line)).replace('{message}', parseError.message)}
              </p>
            )}

            <div style="display: flex; gap: var(--space-4); flex-wrap: wrap; align-items: flex-start;">
              <div style="flex: 2 1 360px; min-width: 280px;">
                <h3 style="font-size: var(--fs-3); margin: 0 0 var(--space-2) 0;">
                  {t.previewHeading}
                  {status === 'processing' && (
                    <span aria-hidden="true" style="font-weight: 400; font-size: var(--fs-1); color: var(--color-subtle);">
                      {' '}
                      …
                    </span>
                  )}
                </h3>
                {svgIsStale && (
                  <p role="status" data-testid="stale-badge" style="font-size: var(--fs-1); color: var(--color-subtle);">
                    {t.previewStale}
                  </p>
                )}
                {doc && !svgSelection && !svgIsStale && (
                  <p style="font-size: var(--fs-1); color: var(--color-subtle);">{t.svgSelectionUnavailable}</p>
                )}
                <div
                  class="flowchart-preview"
                  ref={previewRef}
                  role="img"
                  aria-label={t.previewAria}
                  data-testid="flowchart-preview"
                  style="width: 100%; overflow: auto; min-height: 160px;"
                  onClick={onPreviewClick}
                />
              </div>

              <div style="flex: 1 1 260px; min-width: 240px;">
                <h3 style="font-size: var(--fs-3); margin: 0 0 var(--space-2) 0;">{t.inspectorHeading}</h3>
                {doc ? (
                  <FlowchartInspector
                    doc={doc}
                    selection={selection}
                    onSelect={setSelection}
                    onUpdateNodeLabel={onUpdateNodeLabel}
                    onSetNodeShape={onSetNodeShape}
                    onMoveNode={onMoveNode}
                    onRemoveNode={onRemoveNode}
                    onUpdateEdge={onUpdateEdge}
                    onRemoveEdge={onRemoveEdge}
                    onAddEdge={onAddEdgeSubmit}
                    addEdgeSource={addEdgeSource}
                    addEdgeTarget={addEdgeTarget}
                    onAddEdgeSourceChange={setAddEdgeSource}
                    onAddEdgeTargetChange={setAddEdgeTarget}
                    blockedMessage={blockedMessage}
                    t={t}
                  />
                ) : (
                  <p style="font-size: var(--fs-2); color: var(--color-subtle);">{t.previewStale}</p>
                )}
              </div>
            </div>
          </AppCard>

          <AppCard className="mt-6">
            <h3 style="font-size: var(--fs-3); margin: 0 0 var(--space-2) 0;">{t.codeHeading}</h3>
            <p style="margin: 0 0 var(--space-2) 0; font-size: var(--fs-1); color: var(--color-subtle);">{t.codeHint}</p>
            <label class="visually-hidden" for="code-pane">
              {t.codeLabel}
            </label>
            <textarea
              id="code-pane"
              data-testid="code-pane"
              class="app-field__textarea"
              style="width: 100%; min-height: 220px; font-family: var(--font-mono, monospace); font-size: var(--fs-2);"
              value={code}
              spellcheck={false}
              onInput={(e) => commitCodeDebounced((e.currentTarget as HTMLTextAreaElement).value)}
            />
          </AppCard>

          <AppCard className="mt-6">
            <h3 style="font-size: var(--fs-3); margin: 0 0 var(--space-3) 0;">{t.outputHeading}</h3>
            <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
              <button id="copy-code-action" type="button" class="app-button app-button--secondary" onClick={() => void copyText(code, 'copy-code-action')}>
                {copiedButton === 'copy-code-action' ? t.copied : t.copyCode}
              </button>
              <button
                id="copy-fenced-action"
                type="button"
                class="app-button app-button--secondary"
                onClick={() => void copyText('```mermaid\n' + (code.endsWith('\n') ? code : `${code}\n`) + '```\n', 'copy-fenced-action')}
              >
                {copiedButton === 'copy-fenced-action' ? t.copied : t.copyFenced}
              </button>
              <button
                id="copy-for-ai-action"
                type="button"
                class="app-button app-button--secondary"
                onClick={() => void copyText(buildAiInstructionCopy(t.aiCopyIntro, importedCode, code), 'copy-for-ai-action')}
              >
                {copiedButton === 'copy-for-ai-action' ? t.copied : t.copyForAI}
              </button>
              <button id="download-mmd-action" type="button" class="app-button app-button--primary" onClick={() => void downloadMmd(code)}>
                {t.downloadMmd}
              </button>
            </div>
          </AppCard>

          <AppCard className="mt-6">
            <h3 style="font-size: var(--fs-3); margin: 0 0 var(--space-2) 0;">{t.statsHeading}</h3>
            <ul style="margin: 0; padding-left: 1.2em; font-size: var(--fs-2); color: var(--color-subtle);">
              <li data-testid="stats-nodes">{t.statsNodes.replace('{count}', String(nodeCount))}</li>
              <li data-testid="stats-edges">{t.statsEdges.replace('{count}', String(edgeCount))}</li>
              <li data-testid="stats-coverage">
                {t.statsCoverage
                  .replace('{parsed}', String(totalLines - opaqueCount))
                  .replace('{total}', String(totalLines))
                  .replace('{unsupported}', String(opaqueCount))}
              </li>
              <li data-testid="stats-diff">
                {diffStats.skipped
                  ? t.statsDiffSkipped
                  : t.statsDiff.replace('{added}', String(diffStats.added)).replace('{removed}', String(diffStats.removed))}
              </li>
            </ul>
          </AppCard>
        </div>
      )}

      <AppModal
        isOpen={confirmAction === 'reset'}
        onClose={() => setConfirmAction(null)}
        title={t.resetConfirmTitle}
        locale={locale}
      >
        <p>{t.resetConfirmBody}</p>
        <div style="display: flex; gap: var(--space-2); justify-content: flex-end; margin-top: var(--space-4);">
          <button type="button" class="app-button app-button--ghost" onClick={() => setConfirmAction(null)}>
            {t.resetConfirmCancel}
          </button>
          <button id="confirm-reset-action" type="button" class="app-button app-button--primary" onClick={performReset}>
            {t.resetConfirmConfirm}
          </button>
        </div>
      </AppModal>

      <AppModal
        isOpen={confirmAction === 'startOver'}
        onClose={() => setConfirmAction(null)}
        title={t.startOverConfirmTitle}
        locale={locale}
      >
        <p>{t.startOverConfirmBody}</p>
        <div style="display: flex; gap: var(--space-2); justify-content: flex-end; margin-top: var(--space-4);">
          <button type="button" class="app-button app-button--ghost" onClick={() => setConfirmAction(null)}>
            {t.startOverConfirmCancel}
          </button>
          <button id="confirm-start-over-action" type="button" class="app-button app-button--primary" onClick={performStartOver}>
            {t.startOverConfirmConfirm}
          </button>
        </div>
      </AppModal>

      <style>{`
        .flowchart-preview svg {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 0 auto;
        }
        .inspector-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }
        .inspector-list__item {
          width: 100%;
          justify-content: flex-start;
          text-align: left;
        }
        .visually-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </div>
  );
}
