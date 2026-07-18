/**
 * localStorage persistence for editor settings (the draft code + the import
 * baseline used by the D17 "copy for AI" export).
 */

import { DEFAULT_SETTINGS, normalizeSettings, type EditorSettings } from './settings';

const STORAGE_KEY = 'edit-flowchart-settings';

/** Load persisted settings, or defaults when nothing is stored / SSR. */
export function loadSettings(): EditorSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return normalizeSettings(JSON.parse(stored));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: EditorSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full/unavailable (private browsing etc.) — the draft simply
    // won't persist; the editor itself keeps working.
  }
}
