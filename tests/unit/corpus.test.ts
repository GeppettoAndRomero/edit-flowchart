/**
 * The core differentiator claim of edit-flowchart (issue #113 D6): an
 * unedited document round-trips through parse -> print byte-for-byte. This
 * is the single most important test in the whole tool — if it's ever false,
 * the "lossless" claim in the README/marketing copy is a lie.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parse } from '@/lib/parse';
import { print } from '@/lib/print';

const CORPUS_DIR = fileURLToPath(new URL('../corpus', import.meta.url));

describe('corpus round trip', () => {
  const files = readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith('.mmd'))
    .sort();

  it('ships at least the 7 fixtures required by issue #113', () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  for (const file of files) {
    it(`print(parse(source)) is byte-identical to the source for ${file}`, () => {
      const source = readFileSync(join(CORPUS_DIR, file), 'utf-8');
      const doc = parse(source);
      expect(print(doc)).toBe(source);
    });
  }
});
