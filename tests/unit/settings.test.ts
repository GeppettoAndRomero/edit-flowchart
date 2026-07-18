import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from '@/utils/settings';

describe('normalizeSettings', () => {
  it('returns the defaults for null/undefined input', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('passes through valid string fields', () => {
    const input = { code: 'graph TD\n  A\n', importedCode: 'graph TD\n' };
    expect(normalizeSettings(input)).toEqual(input);
  });

  it('falls back to defaults for a missing or non-string field', () => {
    expect(normalizeSettings({ code: 'x' })).toEqual({ code: 'x', importedCode: '' });
    expect(normalizeSettings({ code: 42, importedCode: 'y' })).toEqual({ code: '', importedCode: 'y' });
  });
});
