/**
 * File-type validation for the "drop/choose a file to load it" input path
 * (one of the two-plus input methods required alongside the paste textarea).
 *
 * Validation returns a stable machine `code` (not a message) so the widget
 * can render the localized string for the current locale — mirrors
 * tools/draw-flowchart's fileValidation.ts (same batch, same convention).
 */

export type ValidationCode = 'wrongType';

export interface ValidationResult {
  valid: boolean;
  code?: ValidationCode;
}

export const ALLOWED_EXTENSIONS = ['.mmd', '.mermaid', '.md', '.txt'] as const;

// Browsers report inconsistent/empty MIME types for these extensions; extension
// is authoritative, a non-empty MIME only needs to be a plain-text-ish type.
const ALLOWED_MIME_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown'];

/** Lower-cased extension including the dot, or '' when the name has none. */
export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
}

export function validateFileExtension(fileName: string): ValidationResult {
  const ext = getExtension(fileName);
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
    ? { valid: true }
    : { valid: false, code: 'wrongType' };
}

/**
 * A file is accepted when its extension is allowed. When the extension is not
 * allowed we still accept it if the browser reported a plain-text-ish MIME
 * type (covers text files with no/odd extension).
 */
export function validateFile(file: File): ValidationResult {
  if (validateFileExtension(file.name).valid) {
    return { valid: true };
  }
  if (file.type && ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return { valid: true };
  }
  return { valid: false, code: 'wrongType' };
}
