/**
 * The structural editor's inspector panel (issue #113 D12: list/form
 * inspector is the primary interaction path; SVG click-select in
 * EditFlowchartTool.tsx is an enhancement on top of the same selection
 * state). Unselected: node + edge lists, and a small "add an edge" form.
 * Selected: a form for that node's label/shape/subgraph or that edge's
 * label/style/arrow, plus delete.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Doc, EdgeStyle, NodeShape } from '@/lib/types';
import { listEdges, listNodes, listSubgraphs, type EdgePatch } from '@/lib/ops';
import type { UiStrings } from '@/i18n/ui';

export type Selection = { type: 'node'; id: string } | { type: 'edge'; lineIdx: number } | null;

const LABEL_DEBOUNCE_MS = 300;

/**
 * A label input that only commits (triggers a reparse + a new undo entry)
 * ~300ms after the last keystroke — same convention as the code pane —
 * instead of on every keystroke. `key={id}` at the call site (keyed by the
 * selected node/edge's identity) makes this remount, not just re-render,
 * whenever the selection changes, so no state or pending timer leaks
 * between two different nodes/edges.
 */
function DebouncedLabelField({
  id,
  label,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div class="app-field">
      <label class="app-field__label" for={id}>
        {label}
      </label>
      <input
        id={id}
        class="app-field__input"
        type="text"
        value={draft}
        onInput={(e) => {
          const v = (e.currentTarget as HTMLInputElement).value;
          setDraft(v);
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => onCommit(v), LABEL_DEBOUNCE_MS);
        }}
      />
    </div>
  );
}

interface FlowchartInspectorProps {
  doc: Doc;
  selection: Selection;
  onSelect: (sel: Selection) => void;
  onUpdateNodeLabel: (id: string, label: string) => void;
  onSetNodeShape: (id: string, shape: NodeShape) => void;
  onMoveNode: (id: string, targetIdx: number | null) => void;
  onRemoveNode: (id: string) => void;
  onUpdateEdge: (lineIdx: number, patch: EdgePatch) => void;
  onRemoveEdge: (lineIdx: number) => void;
  onAddEdge: (source: string, target: string) => void;
  addEdgeSource: string;
  addEdgeTarget: string;
  onAddEdgeSourceChange: (v: string) => void;
  onAddEdgeTargetChange: (v: string) => void;
  blockedMessage: string | null;
  t: UiStrings;
}

const SHAPES: NodeShape[] = ['rect', 'round', 'stadium', 'circle', 'rhombus', 'hexagon', 'subroutine', 'cylinder', 'asymmetric'];
const SHAPE_KEY: Record<NodeShape, keyof UiStrings> = {
  rect: 'shapeRect',
  round: 'shapeRound',
  stadium: 'shapeStadium',
  circle: 'shapeCircle',
  rhombus: 'shapeRhombus',
  hexagon: 'shapeHexagon',
  subroutine: 'shapeSubroutine',
  cylinder: 'shapeCylinder',
  asymmetric: 'shapeAsymmetric',
};
const STYLES: EdgeStyle[] = ['solid', 'dotted', 'thick'];
const STYLE_KEY: Record<EdgeStyle, keyof UiStrings> = {
  solid: 'styleSolid',
  dotted: 'styleDotted',
  thick: 'styleThick',
};

export function FlowchartInspector({
  doc,
  selection,
  onSelect,
  onUpdateNodeLabel,
  onSetNodeShape,
  onMoveNode,
  onRemoveNode,
  onUpdateEdge,
  onRemoveEdge,
  onAddEdge,
  addEdgeSource,
  addEdgeTarget,
  onAddEdgeSourceChange,
  onAddEdgeTargetChange,
  blockedMessage,
  t,
}: FlowchartInspectorProps) {
  const nodes = listNodes(doc);
  const edges = listEdges(doc);
  const subgraphs = listSubgraphs(doc);

  if (selection?.type === 'node') {
    const node = nodes.find((n) => n.id === selection.id);
    if (!node) {
      onSelect(null);
      return null;
    }
    return (
      <div data-testid="inspector-node">
        <button type="button" class="app-button app-button--ghost" onClick={() => onSelect(null)}>
          {t.backToList}
        </button>

        <div style="margin-top: var(--space-3);">
          <DebouncedLabelField
            key={node.id}
            id="node-label-field"
            label={t.nodeLabelField}
            value={node.label}
            onCommit={(v) => onUpdateNodeLabel(node.id, v)}
          />
        </div>

        <div class="app-field">
          <label class="app-field__label" for="node-shape-field">
            {t.nodeShapeField}
          </label>
          <select
            id="node-shape-field"
            class="app-field__input"
            value={node.shape}
            onChange={(e) => onSetNodeShape(node.id, (e.currentTarget as HTMLSelectElement).value as NodeShape)}
          >
            {SHAPES.map((s) => (
              <option value={s}>{t[SHAPE_KEY[s]]}</option>
            ))}
          </select>
        </div>

        <div class="app-field">
          <label class="app-field__label" for="node-subgraph-field">
            {t.nodeSubgraphField}
          </label>
          <select
            id="node-subgraph-field"
            class="app-field__input"
            value={node.home === null ? '' : String(node.home)}
            onChange={(e) => {
              const v = (e.currentTarget as HTMLSelectElement).value;
              onMoveNode(node.id, v === '' ? null : Number(v));
            }}
          >
            <option value="">{t.topLevel}</option>
            {subgraphs.map((s) => (
              <option value={String(s.lineIdx)}>{`${'— '.repeat(s.depth)}${s.title}`}</option>
            ))}
          </select>
        </div>

        {blockedMessage && (
          <p role="alert" data-testid="blocked-message" style="color: var(--color-danger); font-size: var(--fs-1);">
            {blockedMessage}
          </p>
        )}

        <button
          id="delete-node-action"
          type="button"
          class="app-button app-button--secondary"
          style="margin-top: var(--space-3);"
          onClick={() => onRemoveNode(node.id)}
        >
          {t.deleteNode}
        </button>
      </div>
    );
  }

  if (selection?.type === 'edge') {
    const edge = edges.find((e) => e.lineIdx === selection.lineIdx);
    if (!edge) {
      onSelect(null);
      return null;
    }
    return (
      <div data-testid="inspector-edge">
        <button type="button" class="app-button app-button--ghost" onClick={() => onSelect(null)}>
          {t.backToList}
        </button>

        <div style="margin-top: var(--space-3);">
          <DebouncedLabelField
            key={edge.lineIdx}
            id="edge-label-field"
            label={t.edgeLabelField}
            value={edge.label ?? ''}
            onCommit={(v) => onUpdateEdge(edge.lineIdx, { label: v || undefined })}
          />
        </div>

        <div class="app-field">
          <label class="app-field__label" for="edge-style-field">
            {t.edgeStyleField}
          </label>
          <select
            id="edge-style-field"
            class="app-field__input"
            value={edge.style}
            onChange={(e) => onUpdateEdge(edge.lineIdx, { style: (e.currentTarget as HTMLSelectElement).value as EdgeStyle })}
          >
            {STYLES.map((s) => (
              <option value={s}>{t[STYLE_KEY[s]]}</option>
            ))}
          </select>
        </div>

        <div class="app-field">
          <label>
            <input
              id="edge-arrow-field"
              type="checkbox"
              checked={edge.hasArrow}
              onChange={(e) => onUpdateEdge(edge.lineIdx, { hasArrow: (e.currentTarget as HTMLInputElement).checked })}
            />{' '}
            {t.edgeArrowField}
          </label>
        </div>

        <button
          id="delete-edge-action"
          type="button"
          class="app-button app-button--secondary"
          style="margin-top: var(--space-3);"
          onClick={() => onRemoveEdge(edge.lineIdx)}
        >
          {t.deleteEdge}
        </button>
      </div>
    );
  }

  return (
    <div data-testid="inspector-list">
      <h3 style="font-size: var(--fs-3); margin: 0 0 var(--space-2) 0;">{t.nodesHeading}</h3>
      {nodes.length === 0 ? (
        <p style="color: var(--color-subtle); font-size: var(--fs-2);">{t.emptyNodes}</p>
      ) : (
        <ul role="list" aria-label={t.nodesHeading} class="inspector-list">
          {nodes.map((n) => (
            <li role="listitem" key={n.id}>
              <button
                type="button"
                class="app-button app-button--ghost inspector-list__item"
                aria-label={t.editNode.replace('{label}', n.label)}
                onClick={() => onSelect({ type: 'node', id: n.id })}
              >
                {n.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 style="font-size: var(--fs-3); margin: var(--space-4) 0 var(--space-2) 0;">{t.edgesHeading}</h3>
      {edges.length === 0 ? (
        <p style="color: var(--color-subtle); font-size: var(--fs-2);">{t.emptyEdges}</p>
      ) : (
        <ul role="list" aria-label={t.edgesHeading} class="inspector-list">
          {edges.map((e) => (
            <li role="listitem" key={e.lineIdx}>
              <button
                type="button"
                class="app-button app-button--ghost inspector-list__item"
                aria-label={t.editEdge.replace('{source}', e.source).replace('{target}', e.target)}
                onClick={() => onSelect({ type: 'edge', lineIdx: e.lineIdx })}
              >
                {e.source} → {e.target}
                {e.label ? ` (${e.label})` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 style="font-size: var(--fs-3); margin: var(--space-4) 0 var(--space-2) 0;">{t.addEdgeHeading}</h3>
      {nodes.length < 2 ? (
        <p style="color: var(--color-subtle); font-size: var(--fs-2);">{t.addEdgeNeedsTwoNodes}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (addEdgeSource && addEdgeTarget) onAddEdge(addEdgeSource, addEdgeTarget);
          }}
        >
          <div class="app-field">
            <label class="app-field__label" for="add-edge-source">
              {t.addEdgeSource}
            </label>
            <select
              id="add-edge-source"
              class="app-field__input"
              value={addEdgeSource}
              onChange={(e) => onAddEdgeSourceChange((e.currentTarget as HTMLSelectElement).value)}
            >
              <option value="" />
              {nodes.map((n) => (
                <option value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>
          <div class="app-field">
            <label class="app-field__label" for="add-edge-target">
              {t.addEdgeTarget}
            </label>
            <select
              id="add-edge-target"
              class="app-field__input"
              value={addEdgeTarget}
              onChange={(e) => onAddEdgeTargetChange((e.currentTarget as HTMLSelectElement).value)}
            >
              <option value="" />
              {nodes.map((n) => (
                <option value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            id="add-edge-submit"
            class="app-button app-button--secondary"
            disabled={!addEdgeSource || !addEdgeTarget}
          >
            {t.addEdgeSubmit}
          </button>
        </form>
      )}
    </div>
  );
}
