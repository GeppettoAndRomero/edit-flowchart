import { describe, it, expect } from 'vitest';
import { parse } from '@/lib/parse';
import { BlockedByForeignEdgeError, BlockedByOpaqueError } from '@/lib/types';
import {
  addEdge,
  addNode,
  getEffectiveNodeDecl,
  listEdges,
  listNodes,
  listSubgraphs,
  moveNodeToSubgraph,
  removeEdge,
  removeNode,
  setDirection,
  setNodeShape,
  updateEdge,
  updateNodeLabel,
} from '@/lib/ops';

describe('addNode', () => {
  it('allocates the lowest unused n<N> id and adds a bare line at the end', () => {
    const doc = parse('graph TD\n  A --> B\n');
    const next = addNode(doc);
    expect(next).toBe('graph TD\n  A --> B\nn1\n');
  });

  it('skips ids already used anywhere, including inside opaque lines', () => {
    // n1/n2 are used by the edge, n3 only appears inside an opaque classDef
    // line — the next free id must skip all three, landing on n4.
    const doc = parse('graph TD\n  n1 --> n2\n  classDef n3 fill:#fff\n');
    const next = addNode(doc);
    expect(next.endsWith('n4\n')).toBe(true);
  });

  it('uses the given label (prints with brackets since label differs from id)', () => {
    const doc = parse('graph TD\n  A\n');
    const next = addNode(doc, 'Hello');
    expect(next).toContain('n1[Hello]\n');
  });

  it('inserts before the target subgraph end when a subgraph is given', () => {
    const doc = parse('graph TD\n  subgraph S[S]\n    A\n  end\n  B\n');
    const next = addNode(doc, undefined, 1);
    expect(next).toBe('graph TD\n  subgraph S[S]\n    A\n    n1\n  end\n  B\n');
  });

  it('appends a trailing newline before adding at doc end when the last line had none', () => {
    const doc = parse('graph TD\n  A');
    const next = addNode(doc);
    expect(next).toBe('graph TD\n  A\nn1\n');
  });
});

describe('updateNodeLabel / setNodeShape', () => {
  it('rewrites an explicit node line in place', () => {
    const doc = parse('graph TD\n  A[Old]\n');
    const next = updateNodeLabel(doc, 'A', 'New');
    expect(next).toBe('graph TD\n  A[New]\n');
  });

  it('changes shape on an explicit line', () => {
    const doc = parse('graph TD\n  A[Label]\n');
    const next = setNodeShape(doc, 'A', 'rhombus');
    expect(next).toBe('graph TD\n  A{Label}\n');
  });

  it('adds a new explicit line for an implicit (edge-endpoint-only) node, preserving its known shape', () => {
    const doc = parse('graph TD\n  A --> B{Question}\n');
    const next = updateNodeLabel(doc, 'B', 'New Question');
    expect(next).toBe('graph TD\n  A --> B{Question}\nB{New Question}\n');
  });

  it('does not touch other lines', () => {
    const doc = parse('graph TD\n  %% keep me\n  A[Old]\n  B --> C\n');
    const next = updateNodeLabel(doc, 'A', 'New');
    expect(next).toBe('graph TD\n  %% keep me\n  A[New]\n  B --> C\n');
  });
});

describe('removeNode', () => {
  it('removes the explicit node line and every edge touching it', () => {
    const doc = parse('graph TD\n  A[Start]\n  A --> B\n  B --> C\n');
    const next = removeNode(doc, 'A');
    expect(next).toBe('graph TD\n  B --> C\n');
  });

  it('blocks the removal when an opaque line references the id, reporting the line number(s)', () => {
    const doc = parse('graph TD\n  A --> B\n  click A "https://example.com"\n');
    expect(() => removeNode(doc, 'A')).toThrow(BlockedByOpaqueError);
    try {
      removeNode(doc, 'A');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(BlockedByOpaqueError);
      expect((e as BlockedByOpaqueError).lineNumbers).toEqual([3]);
    }
  });

  it('does not false-positive on a substring match (e.g. id "A" inside id "AB")', () => {
    const doc = parse('graph TD\n  A --> B\n  click AB "https://example.com"\n');
    expect(() => removeNode(doc, 'A')).not.toThrow();
  });
});

describe('addEdge / updateEdge / removeEdge', () => {
  it('appends a new edge at document end', () => {
    const doc = parse('graph TD\n  A\n  B\n');
    const next = addEdge(doc, 'A', 'B', { label: 'go' });
    expect(next).toBe('graph TD\n  A\n  B\nA -->|go| B\n');
  });

  it('updateEdge rewrites only the target line', () => {
    const doc = parse('graph TD\n  A --> B\n  C --> D\n');
    const next = updateEdge(doc, 1, { style: 'dotted', label: 'maybe' });
    expect(next).toBe('graph TD\n  A -.->|maybe| B\n  C --> D\n');
  });

  it('removeEdge deletes only the target line', () => {
    const doc = parse('graph TD\n  A --> B\n  C --> D\n');
    const next = removeEdge(doc, 1);
    expect(next).toBe('graph TD\n  C --> D\n');
  });

  it('throws when the target line is not an edge', () => {
    const doc = parse('graph TD\n  A\n');
    expect(() => removeEdge(doc, 1)).toThrow();
  });
});

describe('setDirection', () => {
  it('rewrites the header line only', () => {
    const doc = parse('graph TD\n  A --> B\n');
    const next = setDirection(doc, 'LR');
    expect(next).toBe('graph LR\n  A --> B\n');
  });
});

describe('moveNodeToSubgraph', () => {
  it('moves an explicit node into a subgraph', () => {
    const doc = parse('graph TD\n  A\n  subgraph S[S]\n    B\n  end\n');
    const next = moveNodeToSubgraph(doc, 'A', 2);
    const doc2 = parse(next);
    const lines = doc2.lines;
    // A should now be the sibling of B, inside the subgraph block.
    const subStart = lines.findIndex((l) => l.kind === 'subgraph-start');
    const subEnd = lines.findIndex((l) => l.kind === 'subgraph-end');
    const aIdx = lines.findIndex((l) => l.kind === 'node' && l.id === 'A');
    expect(aIdx).toBeGreaterThan(subStart);
    expect(aIdx).toBeLessThan(subEnd);
  });

  it('moves a node back to top level with null', () => {
    const doc = parse('graph TD\n  subgraph S[S]\n    A\n  end\n');
    const next = moveNodeToSubgraph(doc, 'A', null);
    const doc2 = parse(next);
    const subStart = doc2.lines.findIndex((l) => l.kind === 'subgraph-start');
    const aIdx = doc2.lines.findIndex((l) => l.kind === 'node' && l.id === 'A');
    expect(aIdx).toBeLessThan(subStart);
  });

  it('creates an explicit line for an implicit node before moving it (its referencing edge already lives in the target)', () => {
    const doc = parse('graph TD\n  subgraph S[S]\n    X\n    X --> Y\n  end\n');
    const sIdx = doc.lines.findIndex((l) => l.kind === 'subgraph-start');
    const next = moveNodeToSubgraph(doc, 'Y', sIdx);
    const doc2 = parse(next);
    const subStart = doc2.lines.findIndex((l) => l.kind === 'subgraph-start');
    const subEnd = doc2.lines.findIndex((l) => l.kind === 'subgraph-end');
    const yIdx = doc2.lines.findIndex((l) => l.kind === 'node' && l.id === 'Y');
    expect(yIdx).toBeGreaterThan(subStart);
    expect(yIdx).toBeLessThan(subEnd);
  });

  it('blocks the move when an edge referencing the node lives in a different subgraph', () => {
    const doc = parse('graph TD\n  subgraph S1[S1]\n    A\n  end\n  subgraph S2[S2]\n    B\n  end\n  A --> B\n');
    const s2Idx = doc.lines.findIndex((l) => l.kind === 'subgraph-start' && l.title === 'S2[S2]');
    expect(() => moveNodeToSubgraph(doc, 'A', s2Idx)).toThrow(BlockedByForeignEdgeError);
  });

  it('allows the move when the referencing edge already lives in the target subgraph', () => {
    const doc = parse('graph TD\n  subgraph S[S]\n    A --> B\n  end\n');
    const sIdx = doc.lines.findIndex((l) => l.kind === 'subgraph-start');
    expect(() => moveNodeToSubgraph(doc, 'A', sIdx)).not.toThrow();
  });
});

describe('getEffectiveNodeDecl', () => {
  it('prefers the explicit line over an inline decl', () => {
    const doc = parse('graph TD\n  A[Explicit]\n  A --> B{Inline}\n');
    expect(getEffectiveNodeDecl(doc, 'A')).toEqual({ shape: 'rect', label: 'Explicit' });
  });

  it('falls back to an inline decl when there is no explicit line', () => {
    const doc = parse('graph TD\n  A --> B{Inline}\n');
    expect(getEffectiveNodeDecl(doc, 'B')).toEqual({ shape: 'rhombus', label: 'Inline' });
  });

  it('defaults to bare (rect, label=id) when the node is only ever a bare reference', () => {
    const doc = parse('graph TD\n  A --> B\n');
    expect(getEffectiveNodeDecl(doc, 'B')).toEqual({ shape: 'rect', label: 'B' });
  });
});

describe('listNodes / listEdges / listSubgraphs', () => {
  it('lists every node id referenced anywhere, in first-appearance order', () => {
    const doc = parse('graph TD\n  A --> B\n  C[Explicit]\n');
    expect(listNodes(doc).map((n) => n.id)).toEqual(['A', 'B', 'C']);
  });

  it('lists every edge with its line index', () => {
    const doc = parse('graph TD\n  A --> B\n  B --> C\n');
    expect(listEdges(doc)).toEqual([
      { lineIdx: 1, source: 'A', target: 'B', style: 'solid', hasArrow: true, label: undefined },
      { lineIdx: 2, source: 'B', target: 'C', style: 'solid', hasArrow: true, label: undefined },
    ]);
  });

  it('lists subgraphs with nesting depth', () => {
    const doc = parse('graph TD\n  subgraph Outer[Outer]\n    subgraph Inner[Inner]\n      A\n    end\n  end\n');
    const subs = listSubgraphs(doc);
    expect(subs.map((s) => s.depth)).toEqual([0, 1]);
  });
});
