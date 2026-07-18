/**
 * Line-level diff statistics between the imported code and the current code
 * (issue #113 §「結果可視化」: `+added / -removed` line counts). This is a
 * display-only stat, not used for any output format — the "AI instruction
 * copy" (D17) sends full before/after text, not a diff.
 */

export interface DiffStats {
  added: number;
  removed: number;
  /** True when the LCS computation was skipped for size (huge inputs). */
  skipped: boolean;
}

const MAX_CELLS = 4_000_000;

function splitLines(s: string): string[] {
  return s.length === 0 ? [] : s.split(/(?<=\n)/);
}

/** Classic O(n·m) LCS length via DP, skipped above a cell-count budget. */
export function diffLines(before: string, after: string): DiffStats {
  const a = splitLines(before);
  const b = splitLines(after);

  if (a.length * b.length > MAX_CELLS) {
    return { added: 0, removed: 0, skipped: true };
  }

  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const lcs = dp[0][0];
  return { added: b.length - lcs, removed: a.length - lcs, skipped: false };
}
