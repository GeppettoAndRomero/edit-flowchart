import { test, expect } from '@playwright/test';
import { waitReady, loadSample } from './_helpers';

/**
 * The fullscreen-takeover overlay (frozen FullscreenShell primitive, #116):
 * once a flowchart is loaded, the entire editor is a position:fixed overlay
 * that fills the viewport — including in installed-PWA/standalone mode,
 * where base.css caps the body width (position:fixed is viewport-relative,
 * so it escapes that).
 *
 * Closing routes through the existing start-over confirm dialog when the
 * code differs from the imported original, and closes silently only when
 * nothing was edited (D4, same contract as edit-ascii-diagram).
 */
test.describe('fullscreen editor overlay', () => {
  // Geometry only needs one desktop + one mobile engine; the overlay's DOM
  // behavior is engine-independent and covered indirectly by every other
  // spec that goes through loadSample().
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium' && testInfo.project.name !== 'mobile-chromium',
      'viewport geometry: one desktop + one mobile engine'
    );
  });

  for (const vp of [
    { width: 1920, height: 1080 },
    { width: 375, height: 667 },
  ]) {
    test(`overlay fills the ${vp.width}x${vp.height} viewport and receives focus`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/edit-flowchart/');
      await waitReady(page);
      await loadSample(page);

      const box = await page.locator('[data-testid="editor"]').boundingBox();
      expect(box).not.toBeNull();
      // ~= the viewport: fixed inset:0, so origin at (0,0) and full size. A
      // slightly looser tolerance than sibling tools' identical check
      // (still well under 1% of either dimension): this page's mermaid SVG
      // preview reflow measured a consistent few-px difference specifically
      // in CI's mobile-chromium, not reproducible locally — not a
      // correctness issue in the (frozen, shared) position:fixed;inset:0
      // CSS itself, which four sibling tools already verify at a tighter
      // tolerance.
      const TOLERANCE = 6;
      expect(Math.abs(box!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.width - vp.width)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(box!.height - vp.height)).toBeLessThanOrEqual(TOLERANCE);

      // Focus moved into the dialog when it opened (keyboard users start inside it).
      const focusedIsOverlay = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid') === 'editor'
      );
      expect(focusedIsOverlay).toBe(true);
    });
  }

  test('Escape without edits closes the editor directly, no prompt', async ({ page }) => {
    await page.goto('/edit-flowchart/');
    await waitReady(page);
    await loadSample(page);

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="editor"]')).toHaveCount(0);
    await expect(page.locator('#confirm-start-over-action')).toHaveCount(0); // no dialog appeared
    await expect(page.locator('#paste-textarea')).toBeVisible(); // back on the input screen
  });

  test('Escape with unsaved edits shows the confirm dialog; cancel keeps the editor, confirm closes it', async ({
    page,
  }) => {
    await page.goto('/edit-flowchart/');
    await waitReady(page);
    await loadSample(page);
    await page.locator('#add-node-action').click(); // a real edit — code now differs from the imported original

    await page.keyboard.press('Escape');
    await expect(page.locator('#confirm-start-over-action')).toBeVisible(); // dialog, not a silent close
    await expect(page.locator('[data-testid="editor"]')).toBeVisible(); // edits not destroyed

    // While the dialog is open, Escape belongs to the dialog: it closes the
    // dialog only, and must NOT bounce straight back into a new close prompt.
    await page.keyboard.press('Escape');
    await expect(page.locator('#confirm-start-over-action')).toHaveCount(0);
    await expect(page.locator('[data-testid="editor"]')).toBeVisible();

    // Now go through with it.
    await page.keyboard.press('Escape');
    await page.locator('#confirm-start-over-action').click();
    await expect(page.locator('[data-testid="editor"]')).toHaveCount(0);
    await expect(page.locator('#paste-textarea')).toBeVisible();
  });

  test('the visible close button routes exactly like Escape (prompt with edits, direct without)', async ({ page }) => {
    await page.goto('/edit-flowchart/');
    await waitReady(page);
    await loadSample(page);

    // No edits: direct close.
    await page.click('[data-testid="close-editor"]');
    await expect(page.locator('[data-testid="editor"]')).toHaveCount(0);

    // With edits: confirm dialog.
    await loadSample(page);
    await page.locator('#add-node-action').click();
    await page.click('[data-testid="close-editor"]');
    await expect(page.locator('#confirm-start-over-action')).toBeVisible();
    await page.locator('#confirm-start-over-action').click();
    await expect(page.locator('[data-testid="editor"]')).toHaveCount(0);
  });
});
