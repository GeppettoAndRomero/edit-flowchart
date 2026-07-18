import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { waitReady, loadSample } from './_helpers';

// axe inspects the rendered DOM; one engine is representative.
test.describe('accessibility', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'axe runs on one engine');
  });

  for (const path of ['/edit-flowchart/', '/edit-flowchart/ja/']) {
    test(`has no serious or critical axe violations on the idle input screen at ${path} (#6)`, async ({ page }) => {
      // Disable the decorative fade-in so axe samples the settled (fully-opaque)
      // state, not a mid-animation frame.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(blocking.map((v) => `${v.id} (${v.impact})`)).toEqual([]);
    });
  }

  test('has no serious or critical axe violations on the loaded editor, with a node selected in the inspector (#6)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/edit-flowchart/');
    await waitReady(page);
    await loadSample(page);
    // Select a node so axe also samples the form-based inspector (label/shape/
    // subgraph fields), not just the list view — this is the tool's own custom
    // GUI surface, most likely to have missed ARIA/labels.
    await page.getByRole('button', { name: /^Edit node/ }).first().click();
    await page.locator('[data-testid="inspector-node"]').waitFor({ state: 'visible' });

    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(blocking.map((v) => `${v.id} (${v.impact})`)).toEqual([]);
  });
});
