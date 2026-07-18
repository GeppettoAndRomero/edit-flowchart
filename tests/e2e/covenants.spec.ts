import { test, expect } from '@playwright/test';
import { waitReady, loadSample } from './_helpers';

// Service-worker / offline behaviour is reliable in Chromium; gate these there.
test.describe('covenants', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'service-worker dependent (chromium only)');
  });

  test('PWA: manifest is linked and valid, service worker registers (#3)', async ({ page }) => {
    await page.goto('/edit-flowchart/');
    const href = await page.getAttribute('link[rel=manifest]', 'href');
    expect(href).toBeTruthy();
    const manifest = await page.evaluate(async (h) => (await fetch(h as string)).json(), href);
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons) && manifest.icons.length > 0).toBe(true);
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, { timeout: 15_000 });
  });

  test('footer links to SECURITY.md (#4)', async ({ page }) => {
    await page.goto('/edit-flowchart/');
    const link = page.locator('footer a').filter({ hasText: 'Security' });
    await expect(link).toHaveAttribute('href', /SECURITY\.md$/);
  });

  test('keeps no input data in the page URL while editing (#7)', async ({ page }) => {
    await page.goto('/edit-flowchart/');
    await waitReady(page);
    const before = page.url();
    await loadSample(page);
    await page.locator('#add-node-action').click();
    expect(page.url()).toBe(before);
    expect(page.url()).not.toMatch(/data:|base64|blob:/i);
  });

  test('edits offline after the first online visit (#2)', async ({ page }) => {
    // First visit registers + activates the SW (it claims existing clients).
    await page.goto('/edit-flowchart/');
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, { timeout: 15_000 });
    // Reload once online so page HTML + island JS are now fetched *through* the
    // active SW and cached (first load happened before the SW was controlling).
    await page.reload();
    await waitReady(page);
    // Load + render online so the dynamically-imported mermaid chunk is
    // fetched and cached too (see astro.config.mjs manualChunks + the sw.js
    // cache-first strategy for any same-origin .js request).
    await loadSample(page);
    await page.locator('#add-node-action').click();

    await page.context().setOffline(true);
    try {
      await page.reload(); // served entirely from the SW cache
      await waitReady(page);
      // The previous session's code is restored from localStorage (D15
      // persists the draft across reloads, same as sibling draw-flowchart),
      // so the editor — not the idle "Load sample" input screen — comes up
      // directly. Confirm it renders and can still be edited with no network.
      await page.locator('[data-testid="flowchart-preview"] svg').waitFor({ state: 'visible', timeout: 10_000 });
      await page.locator('#add-node-action').click();
    } finally {
      await page.context().setOffline(false);
    }
  });
});
