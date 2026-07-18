import { test, expect } from '@playwright/test';
import { waitReady, loadSample } from './_helpers';

// Content routing is engine-independent; one browser is enough.
test.describe('i18n', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'content routing (one engine)');
  });

  for (const loc of [
    { path: '/edit-flowchart/', lang: 'en' },
    { path: '/edit-flowchart/ja/', lang: 'ja' },
  ]) {
    test(`loads the sample and edits on the ${loc.lang} route (#5)`, async ({ page }) => {
      await page.goto(loc.path);
      await waitReady(page);
      await loadSample(page);
      await page.locator('#add-node-action').click();
      await expect(page.locator('[data-testid="code-pane"]')).toHaveValue(/\bn1\b/);
    });
  }

  test('serves every locale with the correct <html lang>', async ({ page }) => {
    const expected: Array<[string, string]> = [
      ['/edit-flowchart/', 'en'],
      ['/edit-flowchart/ja/', 'ja'],
      ['/edit-flowchart/zh/', 'zh-Hans'],
      ['/edit-flowchart/de/', 'de'],
      ['/edit-flowchart/es/', 'es'],
    ];
    for (const [path, lang] of expected) {
      await page.goto(path);
      expect(await page.getAttribute('html', 'lang'), `lang on ${path}`).toBe(lang);
    }
  });
});
