/**
 * Line regeneration (issue #113). `print(doc)` is always just the
 * concatenation of every line's `raw` — see D6. The `print*Raw` helpers here
 * are only used by ops.ts to regenerate the `raw` of a line that was just
 * edited; every other line's `raw` is left untouched.
 *
 * Edited lines are normalized to a canonical form (e.g. `A -->|label| B`).
 * Any inline-label style (`-- text -->`) or other original formatting on a
 * line is only preserved as long as that specific line is never edited.
 */

import type { Doc, EdgeStyle, HeaderLine, NodeDecl, NodeLine, NodeShape, EdgeLine } from './types';

export function parseLabel(inner: string): string {
  const t = inner.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/#quot;/g, '"');
  }
  return t;
}

/**
 * Safe to print bare (unquoted): letters/digits/underscore/space and a small
 * set of common punctuation, with no leading/trailing whitespace, non-empty.
 * Anything else is wrapped in quotes with `"` escaped as `#quot;` (the same
 * escape Mermaid itself uses).
 */
export function printLabel(label: string): string {
  const safe = /^[\p{L}\p{N}_ .,:!?'-]+$/u.test(label) && label === label.trim() && label.length > 0;
  return safe ? label : `"${label.replace(/"/g, '#quot;')}"`;
}

export const BRACKETS: Record<NodeShape, [string, string]> = {
  rect: ['[', ']'],
  round: ['(', ')'],
  stadium: ['([', '])'],
  circle: ['((', '))'],
  rhombus: ['{', '}'],
  hexagon: ['{{', '}}'],
  subroutine: ['[[', ']]'],
  cylinder: ['[(', ')]'],
  asymmetric: ['>', ']'],
};

export const ARROWS: Record<EdgeStyle, { arrow: string; open: string }> = {
  solid: { arrow: '-->', open: '---' },
  dotted: { arrow: '-.->', open: '-.-' },
  thick: { arrow: '==>', open: '===' },
};

export function printNodeRaw(n: NodeLine, eol: string): string {
  const cls = n.className ? `:::${n.className}` : '';
  if (n.bare && n.label === n.id && n.shape === 'rect') {
    return `${n.indent}${n.id}${cls}${eol}`;
  }
  const [o, c] = BRACKETS[n.shape];
  return `${n.indent}${n.id}${o}${printLabel(n.label)}${c}${cls}${eol}`;
}

function printEndpoint(id: string, decl: NodeDecl | undefined): string {
  if (!decl) return id;
  const [o, c] = BRACKETS[decl.shape];
  return `${id}${o}${printLabel(decl.label)}${c}`;
}

export function printEdgeRaw(e: EdgeLine, eol: string): string {
  const link = ARROWS[e.style][e.hasArrow ? 'arrow' : 'open'];
  const label = e.label ? `|${printLabel(e.label)}|` : '';
  const src = printEndpoint(e.source, e.sourceDecl);
  const tgt = printEndpoint(e.target, e.targetDecl);
  return `${e.indent}${src} ${link}${label} ${tgt}${eol}`;
}

export function printHeaderRaw(h: HeaderLine, eol: string): string {
  return `${h.indent}${h.keyword} ${h.direction}${eol}`;
}

export const print = (doc: Doc): string => doc.lines.map((l) => l.raw).join('');
