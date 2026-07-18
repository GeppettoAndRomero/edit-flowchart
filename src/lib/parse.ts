/**
 * Line classifier + parser (issue #113 "行単位ロスレスモデル").
 *
 * Every source line becomes exactly one `Line`, and every `Line.raw` is the
 * original text of that line (terminator included) until an edit operation
 * regenerates it (see ops.ts / print.ts). That is what makes the round trip
 * byte-identical: `print()` just joins `raw` — see tests/unit/corpus.test.ts.
 *
 * Classification priority (fixed, do not reorder — see issue #113):
 *   blank -> comment -> header (first occurrence only) -> subgraph-start ->
 *   subgraph-end -> edge -> node -> opaque
 * Edge is tried before node so `A---B` (an edge with no label) is never
 * misread as a single bare node line.
 */

import type { Direction, Doc, Line, NodeShape } from './types';
import { ParseError } from './types';

// ID: no leading/trailing hyphen, no doubled hyphen (so `A---B` can never be
// consumed as one ID — the edge regexes below rely on that).
const ID = '[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*';

// Shapes, longest/most-specific bracket pair first. Order is load-bearing:
// e.g. subroutine `[[..]]` must be tried before rect `[..]`, or `[[Sub]]`
// would be misread as rect with inner text `[Sub]`.
const SHAPES: ReadonlyArray<readonly [NodeShape, string, string]> = [
  ['subroutine', '[[', ']]'],
  ['circle', '((', '))'],
  ['stadium', '([', '])'],
  ['cylinder', '[(', ')]'],
  ['hexagon', '{{', '}}'],
  ['asymmetric', '>', ']'],
  ['rect', '[', ']'],
  ['round', '(', ')'],
  ['rhombus', '{', '}'],
] as const;

export function matchShape(s: string): { shape: NodeShape; inner: string } | null {
  for (const [shape, open, close] of SHAPES) {
    if (s.length >= open.length + close.length && s.startsWith(open) && s.endsWith(close)) {
      return { shape, inner: s.slice(open.length, s.length - close.length) };
    }
  }
  return null;
}

// An endpoint: an ID optionally followed by an inline shape. The shape's
// inner text is either a quoted string or a run of characters that doesn't
// include a closing bracket/quote (so we don't eat past the shape's close).
const INNER = '(?:"[^"]*"|[^\\]\\)\\}"]*)';
const OPEN = '(?:\\[\\[|\\(\\(|\\(\\[|\\[\\(|\\{\\{|>|\\[|\\(|\\{)';
const CLOSE = '(?:\\]\\]|\\)\\)|\\]\\)|\\)\\]|\\}\\}|\\]|\\)|\\})';
const EP = `(${ID})(${OPEN}${INNER}${CLOSE})?`;

const RE = {
  blank: /^\s*$/,
  comment: /^\s*%%.*$/,
  header: new RegExp(`^(\\s*)(graph|flowchart)\\s+(TB|TD|BT|RL|LR)\\s*;?\\s*$`),
  subgraphStart: /^(\s*)subgraph\s+(.+?)\s*$/,
  subgraphEnd: /^(\s*)end\s*;?\s*$/,
  // Edge form 1: symbolic link (`-->`, `---`, `-.->`, `-.-`, `==>`, `===`)
  // with an optional `|label|`.
  edge1: new RegExp(`^(\\s*)${EP}\\s*(-->|---|-\\.->|-\\.-|==>|===)(?:\\|([^|]*)\\|)?\\s*${EP}\\s*;?\\s*$`),
  // Edge forms 2-4: inline label between the link's dashes/dots/equals.
  edge2: new RegExp(`^(\\s*)${EP}\\s*--\\s+((?:[^-]|-(?!->))+?)\\s+-->\\s*${EP}\\s*;?\\s*$`),
  edge3: new RegExp(`^(\\s*)${EP}\\s*-\\.\\s+(.+?)\\s+\\.->\\s*${EP}\\s*;?\\s*$`),
  edge4: new RegExp(`^(\\s*)${EP}\\s*==\\s+(.+?)\\s+==>\\s*${EP}\\s*;?\\s*$`),
  node: new RegExp(`^(\\s*)(${ID})(\\S.*?)?\\s*;?\\s*$`),
} as const;

const LINK_KIND: Record<string, { style: 'solid' | 'dotted' | 'thick'; hasArrow: boolean }> = {
  '-->': { style: 'solid', hasArrow: true },
  '---': { style: 'solid', hasArrow: false },
  '-.->': { style: 'dotted', hasArrow: true },
  '-.-': { style: 'dotted', hasArrow: false },
  '==>': { style: 'thick', hasArrow: true },
  '===': { style: 'thick', hasArrow: false },
};

// Reserved words never read as a *bare* node (no shape brackets). A shaped
// line using one of these as an id (e.g. `classDef[x]`) already fails the
// shape/edge regexes on its own and falls through to opaque, so this guard
// only needs to cover the bare case.
const KEYWORDS = new Set([
  'graph',
  'flowchart',
  'subgraph',
  'end',
  'direction',
  'classDef',
  'class',
  'style',
  'linkStyle',
  'click',
  'accTitle',
  'accDescr',
]);

const CLASS_SUFFIX = /^(.*?):::([A-Za-z0-9_-]+)$/;

export function parseLabel(inner: string): string {
  const t = inner.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/#quot;/g, '"');
  }
  return t;
}

function parseEndpointDecl(shapePart: string | undefined): { shape: NodeShape; inner: string } | null {
  if (!shapePart) return null;
  return matchShape(shapePart);
}

/** Parse one already-EP-matched endpoint capture pair into id + optional inline decl. */
function endpoint(id: string, shapePart: string | undefined): { id: string; decl?: { shape: NodeShape; label: string } } {
  const m = parseEndpointDecl(shapePart);
  if (!m) return { id };
  return { id, decl: { shape: m.shape, label: parseLabel(m.inner) } };
}

function tryEdge(text: string, raw: string): Line | null {
  let m = RE.edge1.exec(text);
  if (m) {
    const [, indent, srcId, srcShape, link, label, tgtId, tgtShape] = m;
    const kind = LINK_KIND[link];
    if (!kind) return null;
    const src = endpoint(srcId, srcShape);
    const tgt = endpoint(tgtId, tgtShape);
    return {
      kind: 'edge',
      raw,
      indent,
      source: src.id,
      target: tgt.id,
      style: kind.style,
      hasArrow: kind.hasArrow,
      label: label !== undefined && label !== '' ? parseLabel(label) : undefined,
      sourceDecl: src.decl,
      targetDecl: tgt.decl,
    };
  }
  m = RE.edge2.exec(text);
  if (m) {
    const [, indent, srcId, srcShape, label, tgtId, tgtShape] = m;
    const src = endpoint(srcId, srcShape);
    const tgt = endpoint(tgtId, tgtShape);
    return {
      kind: 'edge',
      raw,
      indent,
      source: src.id,
      target: tgt.id,
      style: 'solid',
      hasArrow: true,
      label: parseLabel(label),
      sourceDecl: src.decl,
      targetDecl: tgt.decl,
    };
  }
  m = RE.edge3.exec(text);
  if (m) {
    const [, indent, srcId, srcShape, label, tgtId, tgtShape] = m;
    const src = endpoint(srcId, srcShape);
    const tgt = endpoint(tgtId, tgtShape);
    return {
      kind: 'edge',
      raw,
      indent,
      source: src.id,
      target: tgt.id,
      style: 'dotted',
      hasArrow: true,
      label: parseLabel(label),
      sourceDecl: src.decl,
      targetDecl: tgt.decl,
    };
  }
  m = RE.edge4.exec(text);
  if (m) {
    const [, indent, srcId, srcShape, label, tgtId, tgtShape] = m;
    const src = endpoint(srcId, srcShape);
    const tgt = endpoint(tgtId, tgtShape);
    return {
      kind: 'edge',
      raw,
      indent,
      source: src.id,
      target: tgt.id,
      style: 'thick',
      hasArrow: true,
      label: parseLabel(label),
      sourceDecl: src.decl,
      targetDecl: tgt.decl,
    };
  }
  return null;
}

function tryNode(text: string, raw: string): Line | null {
  const m = RE.node.exec(text);
  if (!m) return null;
  const [, indent, id, shapePartRaw] = m;

  if (!shapePartRaw) {
    // Bare node: just an id, no shape brackets.
    if (KEYWORDS.has(id)) return null;
    return { kind: 'node', raw, indent, id, shape: 'rect', label: id, bare: true };
  }

  let shapePart = shapePartRaw;
  let className: string | undefined;
  const classMatch = CLASS_SUFFIX.exec(shapePart);
  if (classMatch) {
    shapePart = classMatch[1];
    className = classMatch[2];
  }

  if (shapePart === '') {
    // Only a `:::className` suffix, no shape brackets (e.g. `A:::warn`).
    if (KEYWORDS.has(id)) return null;
    return { kind: 'node', raw, indent, id, shape: 'rect', label: id, bare: true, className };
  }

  const shaped = matchShape(shapePart);
  if (!shaped) return null; // unmatched brackets -> opaque (caller's fallback)

  return {
    kind: 'node',
    raw,
    indent,
    id,
    shape: shaped.shape,
    label: parseLabel(shaped.inner),
    bare: false,
    className,
  };
}

function classify(text: string, raw: string, headerSeen: boolean): Line {
  if (RE.blank.test(text)) {
    return { kind: 'blank', raw, indent: '' };
  }
  if (RE.comment.test(text)) {
    const indent = /^(\s*)/.exec(text)?.[1] ?? '';
    return { kind: 'comment', raw, indent };
  }
  if (!headerSeen) {
    const m = RE.header.exec(text);
    if (m) {
      const [, indent, keyword, direction] = m;
      return {
        kind: 'header',
        raw,
        indent,
        keyword: keyword as 'graph' | 'flowchart',
        direction: direction as Direction,
      };
    }
  }
  {
    const m = RE.subgraphStart.exec(text);
    if (m) {
      const [, indent, title] = m;
      return { kind: 'subgraph-start', raw, indent, title };
    }
  }
  if (RE.subgraphEnd.test(text)) {
    const indent = /^(\s*)/.exec(text)?.[1] ?? '';
    return { kind: 'subgraph-end', raw, indent };
  }
  {
    const edge = tryEdge(text, raw);
    if (edge) return edge;
  }
  {
    const node = tryNode(text, raw);
    if (node) return node;
  }
  const indent = /^(\s*)/.exec(text)?.[1] ?? '';
  return { kind: 'opaque', raw, indent };
}

/**
 * Split `source` into raw lines, keeping each line's terminator attached to
 * it (so `raw.join('')` always reconstructs `source` exactly).
 */
function splitLines(source: string): string[] {
  return source.length === 0 ? [] : source.split(/(?<=\n)/);
}

export function parse(source: string): Doc {
  const rawLines = splitLines(source);
  const eol: Doc['eol'] = source.includes('\r\n') ? '\r\n' : '\n';
  let headerSeen = false;
  const lines: Line[] = rawLines.map((raw) => {
    const text = raw.replace(/\r?\n$/, '');
    const line = classify(text, raw, headerSeen);
    if (line.kind === 'header') headerSeen = true;
    return line;
  });
  const first = lines.find((l) => l.kind !== 'blank' && l.kind !== 'comment');
  if (!first || first.kind !== 'header') {
    const lineNo = first ? lines.indexOf(first) + 1 : 1;
    throw new ParseError(lineNo, 'no flowchart header (graph/flowchart + direction) found');
  }
  return { lines, eol };
}
