import { describe, it, expect } from 'vitest';
import { parse, matchShape, parseLabel } from '@/lib/parse';
import { ParseError } from '@/lib/types';
import type { EdgeLine, HeaderLine, NodeLine, OpaqueLine, SubgraphStartLine } from '@/lib/types';

function lineAt(source: string, i: number) {
  return parse(source).lines[i];
}

describe('parse header', () => {
  it('reads graph/flowchart keyword and direction', () => {
    for (const keyword of ['graph', 'flowchart'] as const) {
      for (const dir of ['TB', 'TD', 'BT', 'RL', 'LR'] as const) {
        const h = lineAt(`${keyword} ${dir}\n`, 0) as HeaderLine;
        expect(h.kind).toBe('header');
        expect(h.keyword).toBe(keyword);
        expect(h.direction).toBe(dir);
      }
    }
  });

  it('throws ParseError when no header is present', () => {
    expect(() => parse('A --> B\n')).toThrow(ParseError);
  });

  it('classifies a second header line as opaque', () => {
    const doc = parse('graph TD\n  A --> B\ngraph LR\n');
    expect(doc.lines[0].kind).toBe('header');
    expect(doc.lines[2].kind).toBe('opaque');
  });

  it('skips leading blank and comment lines when looking for the header', () => {
    const doc = parse('\n%% a comment\n\ngraph TD\n  A\n');
    const header = doc.lines.find((l) => l.kind === 'header');
    expect(header).toBeDefined();
  });
});

describe('parse blank/comment lines', () => {
  it('classifies whitespace-only lines as blank', () => {
    expect(lineAt('graph TD\n   \n', 1).kind).toBe('blank');
  });

  it('classifies %% lines and %%{init}%% directives as comment', () => {
    expect(lineAt('graph TD\n  %% hello\n', 1).kind).toBe('comment');
    expect(lineAt('%%{init: {"theme": "base"}}%%\ngraph TD\n', 0).kind).toBe('comment');
  });
});

describe('parse subgraph', () => {
  it('classifies subgraph start/end and captures the title', () => {
    const doc = parse('graph TD\n  subgraph App["My App"]\n    A\n  end\n');
    const start = doc.lines[1] as SubgraphStartLine;
    expect(start.kind).toBe('subgraph-start');
    expect(start.title).toBe('App["My App"]');
    expect(doc.lines[3].kind).toBe('subgraph-end');
  });
});

describe('matchShape', () => {
  it('matches all 9 shapes, longest bracket pairs first', () => {
    expect(matchShape('[Rect]')).toEqual({ shape: 'rect', inner: 'Rect' });
    expect(matchShape('(Round)')).toEqual({ shape: 'round', inner: 'Round' });
    expect(matchShape('([Stadium])')).toEqual({ shape: 'stadium', inner: 'Stadium' });
    expect(matchShape('((Circle))')).toEqual({ shape: 'circle', inner: 'Circle' });
    expect(matchShape('{Rhombus}')).toEqual({ shape: 'rhombus', inner: 'Rhombus' });
    expect(matchShape('{{Hexagon}}')).toEqual({ shape: 'hexagon', inner: 'Hexagon' });
    expect(matchShape('[[Subroutine]]')).toEqual({ shape: 'subroutine', inner: 'Subroutine' });
    expect(matchShape('[(Cylinder)]')).toEqual({ shape: 'cylinder', inner: 'Cylinder' });
    expect(matchShape('>Asymmetric]')).toEqual({ shape: 'asymmetric', inner: 'Asymmetric' });
  });

  it('returns null for mismatched brackets', () => {
    expect(matchShape('[x)')).toBeNull();
    expect(matchShape('(x]')).toBeNull();
  });
});

describe('parse node', () => {
  it('reads a bare node (no shape) with label equal to id', () => {
    const n = lineAt('graph TD\n  A\n', 1) as NodeLine;
    expect(n.kind).toBe('node');
    expect(n.bare).toBe(true);
    expect(n.id).toBe('A');
    expect(n.label).toBe('A');
    expect(n.shape).toBe('rect');
  });

  it('reads a quoted label and unescapes #quot;', () => {
    const n = lineAt('graph TD\n  A["She said #quot;hi#quot;"]\n', 1) as NodeLine;
    expect(n.label).toBe('She said "hi"');
  });

  it('reads a trailing :::className suffix on a shaped node', () => {
    const n = lineAt('graph TD\n  A[Label]:::warn\n', 1) as NodeLine;
    expect(n.label).toBe('Label');
    expect(n.className).toBe('warn');
  });

  it('reads a trailing :::className suffix on a bare node', () => {
    const n = lineAt('graph TD\n  A:::warn\n', 1) as NodeLine;
    expect(n.bare).toBe(true);
    expect(n.className).toBe('warn');
  });

  it('falls back to opaque for unmatched shape brackets', () => {
    const l = lineAt('graph TD\n  A[x)\n', 1) as OpaqueLine;
    expect(l.kind).toBe('opaque');
  });

  it('does not read a bare reserved keyword as a node', () => {
    for (const kw of ['direction', 'classDef', 'class', 'style', 'linkStyle', 'click']) {
      const l = lineAt(`graph TD\n  ${kw}\n`, 1);
      expect(l.kind, kw).toBe('opaque');
    }
  });
});

describe('parse edge (form 1: symbolic links)', () => {
  it('reads all 6 link kinds', () => {
    const cases: Array<[string, EdgeLine['style'], boolean]> = [
      ['-->', 'solid', true],
      ['---', 'solid', false],
      ['-.->', 'dotted', true],
      ['-.-', 'dotted', false],
      ['==>', 'thick', true],
      ['===', 'thick', false],
    ];
    for (const [link, style, hasArrow] of cases) {
      const e = lineAt(`graph TD\n  A ${link} B\n`, 1) as EdgeLine;
      expect(e.kind, link).toBe('edge');
      expect(e.style, link).toBe(style);
      expect(e.hasArrow, link).toBe(hasArrow);
      expect(e.source).toBe('A');
      expect(e.target).toBe('B');
    }
  });

  it('reads a |label| between the link and the target', () => {
    const e = lineAt('graph TD\n  A -->|Yes| B\n', 1) as EdgeLine;
    expect(e.label).toBe('Yes');
  });

  it('reads inline shape declarations at either endpoint', () => {
    const e = lineAt('graph TD\n  A[Start] --> B{Question}\n', 1) as EdgeLine;
    expect(e.sourceDecl).toEqual({ shape: 'rect', label: 'Start' });
    expect(e.targetDecl).toEqual({ shape: 'rhombus', label: 'Question' });
  });
});

describe('parse edge (forms 2-4: inline label)', () => {
  it('reads `-- text -->`', () => {
    const e = lineAt('graph TD\n  A -- hello --> B\n', 1) as EdgeLine;
    expect(e.style).toBe('solid');
    expect(e.hasArrow).toBe(true);
    expect(e.label).toBe('hello');
  });

  it('reads `-. text .->`', () => {
    const e = lineAt('graph TD\n  A -. hello .-> B\n', 1) as EdgeLine;
    expect(e.style).toBe('dotted');
    expect(e.label).toBe('hello');
  });

  it('reads `== text ==>`', () => {
    const e = lineAt('graph TD\n  A == hello ==> B\n', 1) as EdgeLine;
    expect(e.style).toBe('thick');
    expect(e.label).toBe('hello');
  });
});

describe('parse opaque (unsupported syntax)', () => {
  const cases: Record<string, string> = {
    chain: 'A-->B-->C',
    ampersand: 'D & E --> F',
    'compound statement': 'G --> H; H --> I',
    bidirectional: 'J <--> K',
    'circle-both-ends': 'L o--o M',
    'length-variable arrow': 'N ---->O',
  };
  for (const [name, body] of Object.entries(cases)) {
    it(`falls back to opaque for ${name}`, () => {
      const l = lineAt(`graph TD\n  ${body}\n`, 1);
      expect(l.kind, body).toBe('opaque');
    });
  }

  it('falls back to opaque for non-ASCII ids', () => {
    const l = lineAt('graph TD\n  ノード1 --> ノード2\n', 1);
    expect(l.kind).toBe('opaque');
  });
});

describe('parseLabel', () => {
  it('unwraps a quoted label and unescapes #quot;', () => {
    expect(parseLabel('"a #quot;b#quot; c"')).toBe('a "b" c');
  });

  it('trims a bare label', () => {
    expect(parseLabel('  hello  ')).toBe('hello');
  });
});

describe('parse line endings', () => {
  it('preserves CRLF line endings on an unedited round trip', () => {
    const source = 'graph TD\r\n  A --> B\r\n';
    const doc = parse(source);
    expect(doc.eol).toBe('\r\n');
    expect(doc.lines.map((l) => l.raw).join('')).toBe(source);
  });

  it('preserves a missing trailing newline at EOF', () => {
    const source = 'graph TD\n  A --> B';
    const doc = parse(source);
    const last = doc.lines[doc.lines.length - 1];
    expect(last.raw.endsWith('\n')).toBe(false);
    expect(doc.lines.map((l) => l.raw).join('')).toBe(source);
  });
});
