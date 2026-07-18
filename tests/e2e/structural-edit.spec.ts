import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { waitReady, loadSample, loadFromPaste, SAMPLE_FLOWCHART } from './_helpers';

async function goto(page: import('@playwright/test').Page) {
  await page.goto('/edit-flowchart/');
  await waitReady(page);
}

test.describe('structural editing', () => {
  test('loads the sample, edits structure, and reflects it in code + preview with no upload', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith('http://localhost:4321') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        external.push(url);
      }
    });

    await goto(page);
    await loadSample(page);

    const codePane = page.locator('[data-testid="code-pane"]');
    await expect(codePane).toHaveValue(SAMPLE_FLOWCHART);
    // The sample declares 4 nodes (Header, List, Detail, Footer) — App and
    // Main are subgraphs, not nodes.
    await expect(page.locator('[data-testid="stats-nodes"]')).toContainText('4 nodes');

    // Add a node -> a new bare line appears in the code pane, and the node
    // count in the summary goes up by one.
    await page.locator('#add-node-action').click();
    await expect(codePane).toHaveValue(/\bn1\b/);

    // Select the new node from the inspector list and relabel it. The label
    // field is debounced (~300ms), same convention as the code pane.
    await page.getByRole('button', { name: /^Edit node n1$/ }).click();
    await page.locator('[data-testid="inspector-node"]').waitFor({ state: 'visible' });
    await page.locator('#node-label-field').fill('New Step');
    await expect(codePane).toHaveValue(/New Step/, { timeout: 5_000 });
    await expect(page.locator('[data-testid="flowchart-preview"] svg')).toContainText('New Step', { timeout: 5_000 });

    expect(external, `unexpected cross-origin requests: ${external.join(', ')}`).toHaveLength(0);
  });

  test('clicking a node in the preview selects it in the inspector (SVG click-select, D12)', async ({ page }) => {
    await goto(page);
    await loadSample(page);

    const headerNode = page.locator('[data-testid="flowchart-preview"] g.node').filter({ hasText: 'Header' });
    // Selection binding is an enhancement (D12) — only assert on it when the
    // mapping actually bound (mermaid's SVG structure matched what we expect).
    const unavailable = await page.locator('text=Click-to-select in the preview is unavailable').count();
    if (unavailable === 0) {
      await headerNode.click();
      await page.locator('[data-testid="inspector-node"]').waitFor({ state: 'visible' });
      await expect(page.locator('#node-label-field')).toHaveValue('Header');
    }
  });

  test('removing a node blocked by an opaque reference shows the blocked line number (D8)', async ({ page }) => {
    await goto(page);
    await loadFromPaste(
      page,
      'graph TD\n  A --> B\n  click A "https://example.com"\n'
    );
    await page.getByRole('button', { name: /^Edit node A$/ }).click();
    await page.locator('#delete-node-action').click();
    await expect(page.locator('[data-testid="blocked-message"]')).toContainText('3');
    // The node is still there — the delete was blocked, not silently ignored.
    await expect(page.locator('[data-testid="code-pane"]')).toHaveValue(/click A/);
  });

  test('downloads a .mmd file matching the current code exactly', async ({ page }) => {
    await goto(page);
    // showSaveFilePicker() (when present) hands off to a native OS "Save As"
    // dialog that Playwright cannot drive; disable it here so the download
    // exercises the <a download> fallback, which is what's actually
    // observable/testable and is the path every browser without File System
    // Access support (Firefox, Safari) uses anyway.
    await page.evaluate(() => {
      delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
    });
    await loadSample(page);
    await page.locator('#add-node-action').click();
    const code = await page.locator('[data-testid="code-pane"]').inputValue();

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.locator('#download-mmd-action').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('flowchart.mmd');
    const path = await download.path();
    expect(path).toBeTruthy();
    const text = readFileSync(path as string, 'utf-8');
    expect(text).toBe(code);
  });

  test('"Copy for AI" produces the D17 before/after template', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'clipboard permissions are most reliable in Chromium');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await goto(page);
    await loadSample(page);
    await page.locator('#add-node-action').click();
    const afterCode = await page.locator('[data-testid="code-pane"]').inputValue();

    await page.locator('#copy-for-ai-action').click();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    // D17 fixed template: intro sentence, then "before:" + fenced original
    // code, then "after:" + fenced current code — full text, not a diff.
    expect(clipboardText).toContain('before:');
    expect(clipboardText).toContain('after:');
    const beforeIdx = clipboardText.indexOf('before:');
    const afterIdx = clipboardText.indexOf('after:');
    expect(beforeIdx).toBeGreaterThanOrEqual(0);
    expect(afterIdx).toBeGreaterThan(beforeIdx);

    expect(clipboardText).toContain('```mermaid\n' + SAMPLE_FLOWCHART);
    expect(clipboardText).toContain('```mermaid\n' + afterCode);
    // The "before" code (unedited sample) must appear before the "after" code
    // (with the added node) in the template — not the other way round.
    const beforeCodeIdx = clipboardText.indexOf(SAMPLE_FLOWCHART);
    const afterCodeIdx = clipboardText.lastIndexOf(afterCode.trimEnd());
    expect(beforeCodeIdx).toBeGreaterThanOrEqual(0);
    expect(afterCodeIdx).toBeGreaterThan(beforeCodeIdx);
  });

  test('an unparseable edit in the code pane disables GUI editing but keeps the last preview (D16)', async ({ page }) => {
    await goto(page);
    await loadSample(page);
    const codePane = page.locator('[data-testid="code-pane"]');
    await codePane.fill('not a valid flowchart at all');
    await expect(page.locator('[data-testid="parse-error"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="stale-badge"]')).toBeVisible();
    // The preview SVG from before the bad edit is still there (stale, not cleared).
    await expect(page.locator('[data-testid="flowchart-preview"] svg')).toHaveCount(1);
    // GUI editing is disabled while the code doesn't parse.
    await expect(page.locator('#add-node-action')).toBeDisabled();
    // The code pane itself remains editable.
    await expect(codePane).toBeEditable();
  });
});
