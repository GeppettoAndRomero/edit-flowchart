/**
 * "Real-input verification" (see the DoD brief for this tool): a plausible,
 * slightly messy hand-written flowchart — mixing plain arrows, both inline-
 * label (`-- Yes -->`) and piped-label (`-->|Approved|`) edges, inline node
 * declarations at edge endpoints, a comment, a blank line, and an opaque
 * `classDef`/`class` styling block — not built from the corpus fixtures.
 * This is the same style of diagram a person would actually paste in from a
 * CI/CD README, exercised through parse -> print and then one GUI-style edit.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '@/lib/parse';
import { print } from '@/lib/print';
import { updateNodeLabel } from '@/lib/ops';

const REAL_WORLD_SAMPLE = `graph TD
    A[Code] --> B{Tests pass?}
    B -- Yes --> C[Build]
    B -- No --> D[Notify dev]
    C --> E[Deploy to staging]
    E --> F{Manual QA}
    F -->|Approved| G[Deploy to production]
    F -->|Rejected| D
    D --> A

    %% styling
    classDef success fill:#9f9,stroke:#333;
    class G success
`;

describe('a real, hand-written flowchart round-trips and edits sensibly', () => {
  it('parses without throwing', () => {
    expect(() => parse(REAL_WORLD_SAMPLE)).not.toThrow();
  });

  it('round-trips byte-identically when unedited', () => {
    const doc = parse(REAL_WORLD_SAMPLE);
    expect(print(doc)).toBe(REAL_WORLD_SAMPLE);
  });

  it('classifies the mixed edge forms and the classDef/class block correctly', () => {
    const doc = parse(REAL_WORLD_SAMPLE);
    const kinds = doc.lines.map((l) => l.kind);
    // header, 8 edges, blank, comment, 2 opaque (classDef/class)
    expect(kinds.filter((k) => k === 'edge')).toHaveLength(8);
    expect(kinds.filter((k) => k === 'opaque')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'comment')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'blank')).toHaveLength(1);
  });

  it('editing an inline-declared node only appends one line — every other line stays byte-identical (D6)', () => {
    const doc = parse(REAL_WORLD_SAMPLE);
    // "A" only ever appears as an inline decl (`A[Code] --> ...`), never its
    // own line, so this exercises the "implicit node" branch of ops.ts.
    const next = updateNodeLabel(doc, 'A', 'Write code');
    expect(next.startsWith(REAL_WORLD_SAMPLE)).toBe(true);
    expect(next).toBe(`${REAL_WORLD_SAMPLE}A[Write code]\n`);
  });
});
