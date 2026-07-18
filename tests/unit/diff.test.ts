import { describe, it, expect } from 'vitest';
import { diffLines } from '@/lib/diff';

describe('diffLines', () => {
  it('reports no changes for identical text', () => {
    const src = 'graph TD\n  A --> B\n';
    expect(diffLines(src, src)).toEqual({ added: 0, removed: 0, skipped: false });
  });

  it('counts one added and one removed line for a single-line edit', () => {
    const before = 'graph TD\n  A[Old]\n';
    const after = 'graph TD\n  A[New]\n';
    expect(diffLines(before, after)).toEqual({ added: 1, removed: 1, skipped: false });
  });

  it('counts a pure addition as added-only', () => {
    const before = 'graph TD\n  A\n';
    const after = 'graph TD\n  A\n  B\n';
    expect(diffLines(before, after)).toEqual({ added: 1, removed: 0, skipped: false });
  });

  it('counts a pure removal as removed-only', () => {
    const before = 'graph TD\n  A\n  B\n';
    const after = 'graph TD\n  A\n';
    expect(diffLines(before, after)).toEqual({ added: 0, removed: 1, skipped: false });
  });

  it('treats empty strings as zero lines', () => {
    expect(diffLines('', '')).toEqual({ added: 0, removed: 0, skipped: false });
  });

  it('skips the computation above the size budget', () => {
    const big = 'A\n'.repeat(3000);
    expect(diffLines(big, big).skipped).toBe(true);
  });
});
