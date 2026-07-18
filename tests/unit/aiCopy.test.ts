import { describe, it, expect } from 'vitest';
import { buildAiInstructionCopy } from '@/lib/aiCopy';

describe('buildAiInstructionCopy', () => {
  it('produces the D17 template: intro, before block, after block, in order', () => {
    const out = buildAiInstructionCopy('Intro sentence.', 'graph TD\n  A\n', 'graph TD\n  A\n  B\n');
    expect(out).toBe(
      'Intro sentence.\n\nbefore:\n```mermaid\ngraph TD\n  A\n```\n\nafter:\n```mermaid\ngraph TD\n  A\n  B\n```\n'
    );
  });

  it('adds a trailing newline before the closing fence when the source has none', () => {
    const out = buildAiInstructionCopy('Intro.', 'graph TD\n  A', 'graph TD\n  B');
    expect(out).toContain('graph TD\n  A\n```');
    expect(out).toContain('graph TD\n  B\n```');
  });

  it('keeps before and after distinct even when only one changed', () => {
    const out = buildAiInstructionCopy('Intro.', 'graph TD\n  A\n', 'graph TD\n  A\n');
    const beforeIdx = out.indexOf('before:');
    const afterIdx = out.indexOf('after:');
    expect(beforeIdx).toBeGreaterThanOrEqual(0);
    expect(afterIdx).toBeGreaterThan(beforeIdx);
  });
});
