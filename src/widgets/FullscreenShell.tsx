/**
 * FullscreenShell — the canonical position:fixed takeover overlay for
 * wide/tall-content viewers and editors. Two tools independently grew this
 * pattern (a table viewer and a canvas editor) before it was converged into
 * this single primitive; see issue #116 for the history.
 *
 * A central `<main class="container">` column (~440px) is too narrow for
 * wide tables, canvases, and side-by-side panes, and standalone-PWA mode
 * would clamp it further (base.css caps `body { max-width: 500px }` in
 * `@media (display-mode: standalone)`). `position: fixed; inset: 0` escapes
 * both: it is viewport-relative, not a descendant-width problem.
 *
 * This widget owns the overlay chrome only: the fixed frame, dialog
 * semantics, focus-on-open, body scroll lock, the Escape key, and the
 * top-right ESC/× close control. It does NOT know whether the caller is a
 * read-only viewer or an editor with unsaved edits — `onRequestClose` is
 * called on Escape or the close button and the caller decides what closing
 * means (discard immediately, or confirm-if-dirty via AppModal). See D4 in
 * runlocally issue #116.
 *
 * The Escape listener is registered in the CAPTURE phase, deliberately: a
 * caller that opens its own AppModal confirm dialog in response to
 * `onRequestClose` has AppModal's own document-level (bubble-phase) Escape
 * handler. Microtask checkpoints can run between the listeners of a single
 * event dispatch, so a bubble-phase listener here could observe stale state
 * and mis-route the same keypress. Capture phase always runs first, before
 * any state update from this event has flushed. (Confirmed bug seen in the
 * canvas editor that motivated this primitive — see #116 D3.)
 *
 * The listener is attached in `useLayoutEffect`, not `useEffect`: a plain
 * `useEffect` runs after the browser paints, so there is a real (if short)
 * window where the overlay is visible but Escape does nothing yet — trivial
 * to hit when a caller opens the shell from a synchronous state toggle with
 * no async work in between (confirmed as a flaky-then-reproducible e2e
 * failure on such a caller during #116 Phase 1). `useLayoutEffect` runs
 * synchronously after DOM mutation but before paint, so the listener (and
 * the initial focus) are live before the overlay is ever visible.
 */

import { useLayoutEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface FullscreenShellProps {
  /** Whether the overlay is mounted/visible. Renders nothing when false. */
  open: boolean;
  /**
   * Called on Escape (capture phase) or the close button. Does not itself
   * close anything — the caller decides: a viewer discards state right
   * away, an editor confirms first when there are unsaved edits.
   */
  onRequestClose: () => void;
  /** aria-label for the role="dialog" overlay (i18n string from the caller). */
  label: string;
  /** aria-label/title for the close button (typically the caller's t.close). */
  closeLabel: string;
  children: ComponentChildren;
  /** data-testid on the outer dialog element. Defaults to 'fullscreen-shell'. */
  testId?: string;
  /** data-testid on the close button. Defaults to 'fullscreen-shell-close'. */
  closeTestId?: string;
}

export function FullscreenShell({
  open,
  onRequestClose,
  label,
  closeLabel,
  children,
  testId = 'fullscreen-shell',
  closeTestId = 'fullscreen-shell-close',
}: FullscreenShellProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest onRequestClose without re-binding the listener every
  // render (callers often pass a fresh closure each render).
  const onRequestCloseRef = useRef(onRequestClose);
  onRequestCloseRef.current = onRequestClose;

  useLayoutEffect(() => {
    if (!open) return;
    overlayRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onRequestCloseRef.current();
    };
    // Capture phase — see the widget doc comment above.
    window.addEventListener('keydown', onKeyDown, true);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      class="fullscreen-shell"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      ref={overlayRef}
      tabIndex={-1}
      data-testid={testId}
    >
      <div class="fullscreen-shell__inner">
        <button
          type="button"
          class="fullscreen-shell__close"
          onClick={onRequestClose}
          aria-label={closeLabel}
          title={closeLabel}
          data-testid={closeTestId}
        >
          <kbd class="fullscreen-shell__close-kbd">ESC</kbd>
          <span class="fullscreen-shell__close-x" aria-hidden="true">
            ×
          </span>
        </button>
        {children}
      </div>
    </div>
  );
}
