/**
 * Core types for the line-based lossless CST (concrete syntax tree) that
 * backs edit-flowchart. See issue #113 D6: every line of the source keeps its
 * exact original text (`raw`, including the line terminator) until an edit
 * operation specifically regenerates it. `print(doc) === source` is therefore
 * guaranteed for any document that was never edited, regardless of how well
 * `classify()` understood any given line — see lib/parse.ts and
 * tests/unit/corpus.test.ts.
 */

export type Direction = 'TB' | 'TD' | 'BT' | 'RL' | 'LR';

export type NodeShape =
  | 'rect'
  | 'round'
  | 'stadium'
  | 'circle'
  | 'rhombus'
  | 'hexagon'
  | 'subroutine'
  | 'cylinder'
  | 'asymmetric';

export type EdgeStyle = 'solid' | 'dotted' | 'thick';

/** Every line carries its exact original text, terminator included. */
interface BaseLine {
  raw: string;
  indent: string;
}

export interface BlankLine extends BaseLine {
  kind: 'blank';
}

/** Covers both `%% a comment` and `%%{init: {...}}%%` directive lines. */
export interface CommentLine extends BaseLine {
  kind: 'comment';
}

/** Unsupported/unrecognized syntax. Preserved verbatim; not editable. */
export interface OpaqueLine extends BaseLine {
  kind: 'opaque';
}

export interface HeaderLine extends BaseLine {
  kind: 'header';
  keyword: 'graph' | 'flowchart';
  direction: Direction;
}

export interface SubgraphStartLine extends BaseLine {
  kind: 'subgraph-start';
  title: string;
}

export interface SubgraphEndLine extends BaseLine {
  kind: 'subgraph-end';
}

export interface NodeLine extends BaseLine {
  kind: 'node';
  id: string;
  shape: NodeShape;
  label: string;
  /** True when the line has no shape brackets at all, e.g. a lone `A`. */
  bare: boolean;
  /** `:::className` suffix, if present. */
  className?: string;
}

/** An inline node declaration at an edge endpoint, e.g. `A[Start] --> B`. */
export interface NodeDecl {
  shape: NodeShape;
  label: string;
}

export interface EdgeLine extends BaseLine {
  kind: 'edge';
  source: string;
  target: string;
  style: EdgeStyle;
  hasArrow: boolean;
  label?: string;
  sourceDecl?: NodeDecl;
  targetDecl?: NodeDecl;
}

export type Line =
  | BlankLine
  | CommentLine
  | OpaqueLine
  | HeaderLine
  | SubgraphStartLine
  | SubgraphEndLine
  | NodeLine
  | EdgeLine;

export interface Doc {
  lines: Line[];
  eol: '\n' | '\r\n';
}

export class ParseError extends Error {
  constructor(
    public line: number,
    msg: string
  ) {
    super(msg);
    this.name = 'ParseError';
  }
}

/** D8: a delete was blocked because opaque (unsupported-syntax) lines reference the node. */
export class BlockedByOpaqueError extends Error {
  constructor(
    public nodeId: string,
    public lineNumbers: number[]
  ) {
    super(`node "${nodeId}" is referenced by unsupported syntax lines`);
    this.name = 'BlockedByOpaqueError';
  }
}

/**
 * A subgraph move was blocked because an edge referencing the node lives in a
 * different subgraph block than the move target (see ops.ts moveNodeToSubgraph).
 */
export class BlockedByForeignEdgeError extends Error {
  constructor(
    public nodeId: string,
    public lineNumbers: number[]
  ) {
    super(`node "${nodeId}" is referenced by edges outside the target subgraph`);
    this.name = 'BlockedByForeignEdgeError';
  }
}
