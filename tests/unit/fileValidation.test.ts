import { describe, it, expect } from 'vitest';
import { getExtension, validateFileExtension, validateFile } from '@/utils/fileValidation';

// Minimal File-like stub (only the fields the validators read).
const f = (name: string, type = ''): File => ({ name, type }) as unknown as File;

describe('getExtension', () => {
  it('lower-cases the extension', () => {
    expect(getExtension('Diagram.MMD')).toBe('.mmd');
  });

  it('returns an empty string when there is no extension', () => {
    expect(getExtension('noext')).toBe('');
  });
});

describe('validateFileExtension', () => {
  it('accepts .mmd, .mermaid, .md, .txt', () => {
    for (const ext of ['.mmd', '.mermaid', '.md', '.txt']) {
      expect(validateFileExtension(`diagram${ext}`).valid, ext).toBe(true);
    }
  });

  it('rejects an unsupported extension', () => {
    expect(validateFileExtension('diagram.png').valid).toBe(false);
  });
});

describe('validateFile', () => {
  it('accepts a valid extension regardless of MIME type', () => {
    expect(validateFile(f('diagram.mmd', '')).valid).toBe(true);
  });

  it('accepts an unknown extension when the MIME type is plain-text-ish', () => {
    expect(validateFile(f('diagram', 'text/plain')).valid).toBe(true);
  });

  it('rejects an unsupported extension with a non-text MIME type', () => {
    expect(validateFile(f('diagram.png', 'image/png')).valid).toBe(false);
  });
});
