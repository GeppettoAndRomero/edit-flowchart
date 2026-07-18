import { describe, it, expect } from 'vitest';
import { printLabel, printNodeRaw, printEdgeRaw, printHeaderRaw } from '@/lib/print';
import type { EdgeLine, HeaderLine, NodeLine } from '@/lib/types';

describe('printLabel', () => {
  it('prints safe text bare (no quotes)', () => {
    expect(printLabel('Hello, world!')).toBe('Hello, world!');
  });

  it('quotes and escapes an unsafe label', () => {
    expect(printLabel('a "b" c')).toBe('"a #quot;b#quot; c"');
  });

  it('quotes a label containing brackets', () => {
    expect(printLabel('a[b]')).toBe('"a[b]"');
  });

  it('quotes an empty label', () => {
    expect(printLabel('')).toBe('""');
  });
});

describe('printNodeRaw', () => {
  it('prints a bare node with no brackets', () => {
    const n: NodeLine = { kind: 'node', raw: '', indent: '  ', id: 'A', shape: 'rect', label: 'A', bare: true };
    expect(printNodeRaw(n, '\n')).toBe('  A\n');
  });

  it('prints a shaped node with brackets for its shape', () => {
    const n: NodeLine = { kind: 'node', raw: '', indent: '', id: 'A', shape: 'rhombus', label: 'Question?', bare: false };
    expect(printNodeRaw(n, '\n')).toBe('A{Question?}\n');
  });

  it('appends a :::className suffix when present', () => {
    const n: NodeLine = { kind: 'node', raw: '', indent: '', id: 'A', shape: 'rect', label: 'A', bare: true, className: 'warn' };
    expect(printNodeRaw(n, '\n')).toBe('A:::warn\n');
  });

  it('quotes a label that needs it', () => {
    const n: NodeLine = { kind: 'node', raw: '', indent: '', id: 'A', shape: 'rect', label: 'a "b"', bare: false };
    expect(printNodeRaw(n, '\n')).toBe('A["a #quot;b#quot;"]\n');
  });
});

describe('printEdgeRaw', () => {
  it('prints a solid arrow with no label', () => {
    const e: EdgeLine = { kind: 'edge', raw: '', indent: '', source: 'A', target: 'B', style: 'solid', hasArrow: true };
    expect(printEdgeRaw(e, '\n')).toBe('A --> B\n');
  });

  it('prints an open (arrowless) link', () => {
    const e: EdgeLine = { kind: 'edge', raw: '', indent: '', source: 'A', target: 'B', style: 'solid', hasArrow: false };
    expect(printEdgeRaw(e, '\n')).toBe('A --- B\n');
  });

  it('prints dotted and thick styles', () => {
    const dotted: EdgeLine = { kind: 'edge', raw: '', indent: '', source: 'A', target: 'B', style: 'dotted', hasArrow: true };
    expect(printEdgeRaw(dotted, '\n')).toBe('A -.-> B\n');
    const thick: EdgeLine = { kind: 'edge', raw: '', indent: '', source: 'A', target: 'B', style: 'thick', hasArrow: true };
    expect(printEdgeRaw(thick, '\n')).toBe('A ==> B\n');
  });

  it('prints a |label|', () => {
    const e: EdgeLine = { kind: 'edge', raw: '', indent: '', source: 'A', target: 'B', style: 'solid', hasArrow: true, label: 'Yes' };
    expect(printEdgeRaw(e, '\n')).toBe('A -->|Yes| B\n');
  });

  it('prints inline shape declarations at either endpoint', () => {
    const e: EdgeLine = {
      kind: 'edge',
      raw: '',
      indent: '',
      source: 'A',
      target: 'B',
      style: 'solid',
      hasArrow: true,
      sourceDecl: { shape: 'rect', label: 'Start' },
      targetDecl: { shape: 'rhombus', label: 'Question' },
    };
    expect(printEdgeRaw(e, '\n')).toBe('A[Start] --> B{Question}\n');
  });
});

describe('printHeaderRaw', () => {
  it('prints keyword + direction', () => {
    const h: HeaderLine = { kind: 'header', raw: '', indent: '', keyword: 'flowchart', direction: 'LR' };
    expect(printHeaderRaw(h, '\n')).toBe('flowchart LR\n');
  });
});
