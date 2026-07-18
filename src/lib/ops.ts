/**
 * Edit operations (issue #113). Each op takes the current `Doc` and returns a
 * brand-new source string; it never mutates `doc` or any `Line` in place.
 * Callers must always re-parse the returned string (D15: the code string is
 * the single source of truth — the GUI never holds independent state that
 * could drift from it).
 *
 * Every op regenerates only the line(s) it actually changes via
 * `print*Raw()`; every other line keeps its original `raw` untouched, which
 * is what keeps D6 (byte-identical round trip for untouched lines) true even
 * after a sequence of edits.
 */

import {
  BlockedByForeignEdgeError,
  BlockedByOpaqueError,
  type Direction,
  type Doc,
  type EdgeLine,
  type EdgeStyle,
  type HeaderLine,
  type Line,
  type NodeDecl,
  type NodeLine,
  type NodeShape,
} from './types';
import { print, printEdgeRaw, printHeaderRaw, printNodeRaw } from './print';

const ID_TOKEN = /[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*/g;

function collectUsedIds(doc: Doc): Set<string> {
  const ids = new Set<string>();
  for (const l of doc.lines) {
    if (l.kind === 'node') ids.add(l.id);
    if (l.kind === 'edge') {
      ids.add(l.source);
      ids.add(l.target);
    }
    // Opaque lines are not part of the graph model, but scanning them for
    // id-shaped tokens too avoids handing out a fresh id that collides with
    // something an unsupported-syntax line already refers to.
    if (l.kind === 'opaque') {
      for (const m of l.raw.matchAll(ID_TOKEN)) ids.add(m[0]);
    }
  }
  return ids;
}

/** Lowest-numbered unused `n<N>` id, per issue #113 ops.addNode. */
function nextNodeId(doc: Doc): string {
  const used = collectUsedIds(doc);
  let n = 1;
  while (used.has(`n${n}`)) n++;
  return `n${n}`;
}

function getExplicitNodeLine(lines: Line[], id: string): { line: NodeLine; idx: number } | undefined {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.kind === 'node' && l.id === id) return { line: l, idx: i };
  }
  return undefined;
}

/**
 * The node's currently-visible shape/label, whether it comes from an
 * explicit line, an inline declaration at an edge endpoint, or (bare)
 * defaults to `{ shape: 'rect', label: id }`.
 */
export function getEffectiveNodeDecl(doc: Doc, id: string): NodeDecl {
  const explicit = getExplicitNodeLine(doc.lines, id);
  if (explicit) return { shape: explicit.line.shape, label: explicit.line.label };
  for (const l of doc.lines) {
    if (l.kind === 'edge') {
      if (l.source === id && l.sourceDecl) return l.sourceDecl;
      if (l.target === id && l.targetDecl) return l.targetDecl;
    }
  }
  return { shape: 'rect', label: id };
}

/** Word-boundary-safe reference test (`\b` doesn't stop at `-`, so it isn't used). */
function refRe(id: string): RegExp {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9_-])${escaped}(?![A-Za-z0-9_-])`);
}

function opaqueReferencesTo(doc: Doc, id: string): number[] {
  const re = refRe(id);
  const lineNumbers: number[] = [];
  doc.lines.forEach((l, i) => {
    if (l.kind === 'opaque' && re.test(l.raw)) lineNumbers.push(i + 1);
  });
  return lineNumbers;
}

/** Appends `eol` to the last line's raw if it currently has no line terminator (EOF-no-newline case). */
function ensureTrailingEol(lines: Line[], eol: string): void {
  if (lines.length === 0) return;
  const last = lines[lines.length - 1];
  if (!last.raw.endsWith('\n')) {
    lines[lines.length - 1] = { ...last, raw: last.raw + eol } as Line;
  }
}

/** Index of the `subgraph-end` matching the `subgraph-start` at `startIdx` (handles nesting). */
function findSubgraphEnd(lines: Line[], startIdx: number): number {
  let depth = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i];
    if (l.kind === 'subgraph-start') depth++;
    else if (l.kind === 'subgraph-end') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`unterminated subgraph starting at line ${startIdx + 1}`);
}

/** Indent to use for a new line inserted inside [startIdx, endIdx): match a sibling, or indent one step further than the subgraph itself. */
function siblingIndent(lines: Line[], startIdx: number, endIdx: number): string {
  for (let i = startIdx + 1; i < endIdx; i++) {
    if (lines[i].kind !== 'blank') return lines[i].indent;
  }
  return `${lines[startIdx].indent}  `;
}

/** For every line, the index of the innermost `subgraph-start` line that contains it (or null for top-level). */
function computeContainers(lines: Line[]): (number | null)[] {
  const stack: number[] = [];
  const containers: (number | null)[] = new Array(lines.length).fill(null);
  lines.forEach((l, i) => {
    if (l.kind === 'subgraph-end') {
      containers[i] = stack.length ? stack[stack.length - 1] : null;
      stack.pop();
      return;
    }
    containers[i] = stack.length ? stack[stack.length - 1] : null;
    if (l.kind === 'subgraph-start') stack.push(i);
  });
  return containers;
}

export interface SubgraphInfo {
  lineIdx: number;
  title: string;
  depth: number;
}

/** All subgraphs in the document, in source order, for the "move to subgraph" picker. */
export function listSubgraphs(doc: Doc): SubgraphInfo[] {
  const result: SubgraphInfo[] = [];
  let depth = 0;
  doc.lines.forEach((l, i) => {
    if (l.kind === 'subgraph-start') {
      result.push({ lineIdx: i, title: l.title, depth });
      depth++;
    } else if (l.kind === 'subgraph-end') {
      depth = Math.max(0, depth - 1);
    }
  });
  return result;
}

/** The subgraph a node currently "lives in": its explicit line's container, or the first line that mentions it, else top-level. */
export function getNodeHome(doc: Doc, id: string): number | null {
  const containers = computeContainers(doc.lines);
  const explicit = getExplicitNodeLine(doc.lines, id);
  if (explicit) return containers[explicit.idx];
  const idx = doc.lines.findIndex((l) => l.kind === 'edge' && (l.source === id || l.target === id));
  return idx === -1 ? null : containers[idx];
}

export interface NodeSummary {
  id: string;
  shape: NodeShape;
  label: string;
  home: number | null;
  /** False for a node only ever seen as an edge endpoint (no line of its own yet). */
  explicit: boolean;
}

/** Every node id referenced anywhere in the document (explicit lines + edge endpoints), in first-appearance order. */
export function listNodes(doc: Doc): NodeSummary[] {
  const ids = new Set<string>();
  for (const l of doc.lines) {
    if (l.kind === 'node') ids.add(l.id);
    if (l.kind === 'edge') {
      ids.add(l.source);
      ids.add(l.target);
    }
  }
  return Array.from(ids).map((id) => {
    const decl = getEffectiveNodeDecl(doc, id);
    return {
      id,
      shape: decl.shape,
      label: decl.label,
      home: getNodeHome(doc, id),
      explicit: !!getExplicitNodeLine(doc.lines, id),
    };
  });
}

export interface EdgeSummary {
  lineIdx: number;
  source: string;
  target: string;
  style: EdgeStyle;
  hasArrow: boolean;
  label?: string;
}

export function listEdges(doc: Doc): EdgeSummary[] {
  const result: EdgeSummary[] = [];
  doc.lines.forEach((l, i) => {
    if (l.kind === 'edge') {
      result.push({ lineIdx: i, source: l.source, target: l.target, style: l.style, hasArrow: l.hasArrow, label: l.label });
    }
  });
  return result;
}

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------

/** Add a node. Default label is the id itself (prints bare, e.g. `n3`). */
export function addNode(doc: Doc, label?: string, subgraphLineIdx?: number): string {
  const id = nextNodeId(doc);
  const nodeLabel = label ?? id;
  const bare = nodeLabel === id;
  const lines = doc.lines.slice();

  let indent = '';
  let insertAt: number;
  if (subgraphLineIdx !== undefined) {
    const endIdx = findSubgraphEnd(lines, subgraphLineIdx);
    indent = siblingIndent(lines, subgraphLineIdx, endIdx);
    insertAt = endIdx;
  } else {
    ensureTrailingEol(lines, doc.eol);
    insertAt = lines.length;
  }

  const newLine: NodeLine = { kind: 'node', raw: '', indent, id, shape: 'rect', label: nodeLabel, bare };
  newLine.raw = printNodeRaw(newLine, doc.eol);
  lines.splice(insertAt, 0, newLine);
  return print({ lines, eol: doc.eol });
}

function upsertNodeDecl(doc: Doc, id: string, patch: Partial<NodeDecl>): string {
  const explicit = getExplicitNodeLine(doc.lines, id);
  const lines = doc.lines.slice();

  if (explicit) {
    const shape = patch.shape ?? explicit.line.shape;
    const label = patch.label ?? explicit.line.label;
    const next: NodeLine = {
      ...explicit.line,
      shape,
      label,
      bare: shape === 'rect' && label === id,
      raw: '',
    };
    next.raw = printNodeRaw(next, doc.eol);
    lines[explicit.idx] = next;
  } else {
    // Implicit node (only ever seen as an edge endpoint): add an explicit
    // line at the end, keeping whatever shape/label context already implies
    // (issue #113 ops.ts: "mermaid honors a label wherever it's declared").
    const decl = getEffectiveNodeDecl(doc, id);
    const shape = patch.shape ?? decl.shape;
    const label = patch.label ?? decl.label;
    ensureTrailingEol(lines, doc.eol);
    const newLine: NodeLine = { kind: 'node', raw: '', indent: '', id, shape, label, bare: shape === 'rect' && label === id };
    newLine.raw = printNodeRaw(newLine, doc.eol);
    lines.push(newLine);
  }
  return print({ lines, eol: doc.eol });
}

export function updateNodeLabel(doc: Doc, id: string, label: string): string {
  return upsertNodeDecl(doc, id, { label });
}

export function setNodeShape(doc: Doc, id: string, shape: NodeShape): string {
  return upsertNodeDecl(doc, id, { shape });
}

/** D8: blocked (with the offending line numbers) if an opaque line still references `id`. */
export function removeNode(doc: Doc, id: string): string {
  const blocked = opaqueReferencesTo(doc, id);
  if (blocked.length > 0) throw new BlockedByOpaqueError(id, blocked);

  const lines = doc.lines.filter((l) => {
    if (l.kind === 'node' && l.id === id) return false;
    if (l.kind === 'edge' && (l.source === id || l.target === id)) return false;
    return true;
  });
  return print({ lines, eol: doc.eol });
}

export interface AddEdgeOptions {
  style?: EdgeStyle;
  hasArrow?: boolean;
  label?: string;
}

export function addEdge(doc: Doc, source: string, target: string, opts: AddEdgeOptions = {}): string {
  const lines = doc.lines.slice();
  ensureTrailingEol(lines, doc.eol);
  const newLine: EdgeLine = {
    kind: 'edge',
    raw: '',
    indent: '',
    source,
    target,
    style: opts.style ?? 'solid',
    hasArrow: opts.hasArrow ?? true,
    label: opts.label,
  };
  newLine.raw = printEdgeRaw(newLine, doc.eol);
  lines.push(newLine);
  return print({ lines, eol: doc.eol });
}

export type EdgePatch = Partial<Pick<EdgeLine, 'style' | 'hasArrow' | 'label'>>;

export function updateEdge(doc: Doc, lineIdx: number, patch: EdgePatch): string {
  const target = doc.lines[lineIdx];
  if (!target || target.kind !== 'edge') throw new Error(`line ${lineIdx + 1} is not an edge`);
  const lines = doc.lines.slice();
  const next: EdgeLine = { ...target, ...patch, raw: '' };
  next.raw = printEdgeRaw(next, doc.eol);
  lines[lineIdx] = next;
  return print({ lines, eol: doc.eol });
}

export function removeEdge(doc: Doc, lineIdx: number): string {
  const target = doc.lines[lineIdx];
  if (!target || target.kind !== 'edge') throw new Error(`line ${lineIdx + 1} is not an edge`);
  const lines = doc.lines.filter((_, i) => i !== lineIdx);
  return print({ lines, eol: doc.eol });
}

export function setDirection(doc: Doc, direction: Direction): string {
  const idx = doc.lines.findIndex((l) => l.kind === 'header');
  if (idx === -1) throw new Error('document has no header line');
  const lines = doc.lines.slice();
  const header = lines[idx] as HeaderLine;
  const next: HeaderLine = { ...header, direction, raw: '' };
  next.raw = printHeaderRaw(next, doc.eol);
  lines[idx] = next;
  return print({ lines, eol: doc.eol });
}

/**
 * Move a node into `targetIdx`'s subgraph block (or top-level when `null`).
 * Blocked (`BlockedByForeignEdgeError`) when an edge referencing the node
 * currently lives in a *different* subgraph block than the target — moving
 * the node line alone would silently disagree with where mermaid itself
 * infers membership from (issue #113 ops.ts moveNodeToSubgraph).
 */
export function moveNodeToSubgraph(doc: Doc, id: string, targetIdx: number | null): string {
  if (targetIdx !== null) {
    const t = doc.lines[targetIdx];
    if (!t || t.kind !== 'subgraph-start') throw new Error(`line ${targetIdx + 1} is not a subgraph`);
  }

  const containers = computeContainers(doc.lines);
  const foreign: number[] = [];
  doc.lines.forEach((l, i) => {
    if (l.kind === 'edge' && (l.source === id || l.target === id) && containers[i] !== targetIdx) {
      foreign.push(i + 1);
    }
  });
  if (foreign.length > 0) throw new BlockedByForeignEdgeError(id, foreign);

  const lines = doc.lines.slice();

  let explicit = getExplicitNodeLine(lines, id);
  if (!explicit) {
    const decl = getEffectiveNodeDecl(doc, id);
    ensureTrailingEol(lines, doc.eol);
    const bare = decl.shape === 'rect' && decl.label === id;
    const newLine: NodeLine = { kind: 'node', raw: '', indent: '', id, shape: decl.shape, label: decl.label, bare };
    newLine.raw = printNodeRaw(newLine, doc.eol);
    lines.push(newLine);
    explicit = { line: newLine, idx: lines.length - 1 };
  }

  const oldIdx = explicit.idx;
  const moving = lines[oldIdx] as NodeLine;
  lines.splice(oldIdx, 1);

  const shift = targetIdx !== null && oldIdx < targetIdx ? 1 : 0;
  let insertAt: number;
  let indent: string;
  if (targetIdx === null) {
    const headerIdx = lines.findIndex((l) => l.kind === 'header');
    insertAt = headerIdx + 1;
    indent = '';
  } else {
    const adjustedTargetIdx = targetIdx - shift;
    const endIdx = findSubgraphEnd(lines, adjustedTargetIdx);
    insertAt = endIdx;
    indent = siblingIndent(lines, adjustedTargetIdx, endIdx);
  }

  const moved: NodeLine = { ...moving, indent, raw: '' };
  moved.raw = printNodeRaw(moved, doc.eol);
  lines.splice(insertAt, 0, moved);

  return print({ lines, eol: doc.eol });
}
