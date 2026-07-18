// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSettings, saveSettings } from '@/utils/settingsStorage';
import { DEFAULT_SETTINGS } from '@/utils/settings';

describe('settingsStorage', () => {
  beforeEach(() => localStorage.clear());

  it('returns the defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings', () => {
    const s = { code: 'graph TD\n  A --> B\n', importedCode: 'graph TD\n  A --> B\n' };
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });

  it('merges a stored partial over the defaults', () => {
    localStorage.setItem('edit-flowchart-settings', JSON.stringify({ code: 'graph TD\n' }));
    const loaded = loadSettings();
    expect(loaded.code).toBe('graph TD\n');
    expect(loaded.importedCode).toBe(DEFAULT_SETTINGS.importedCode);
  });

  it('falls back to the defaults on malformed JSON', () => {
    localStorage.setItem('edit-flowchart-settings', '{not valid json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
