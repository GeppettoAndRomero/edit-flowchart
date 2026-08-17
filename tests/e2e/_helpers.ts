import { type Page } from '@playwright/test';

// Same content as issue #113 D18 / tests/corpus/07-ui-structure.mmd — the
// in-product "Load sample" button is fixed to this exact diagram.
export const SAMPLE_FLOWCHART = `graph TD
  subgraph App["MyApp screen"]
    Header[Header]
    subgraph Main[Main]
      List[Article list]
      Detail[Article detail]
    end
    Footer[Footer]
  end
  Header --> List
  List -->|tap| Detail
`;

/** Wait until the island has hydrated and is ready to drive from a test. */
export async function waitReady(page: Page) {
  await page.waitForFunction(() => (window as Record<string, unknown>).__toolReady === true);
}

/** Click "Load sample" and wait for the editor + preview SVG to appear. */
export async function loadSample(page: Page) {
  await page.locator('#load-sample-action').click();
  await page.locator('[data-testid="flowchart-preview"] svg').waitFor({ state: 'visible', timeout: 10_000 });
}

/** Paste arbitrary code into the idle-state textarea and load it. */
export async function loadFromPaste(page: Page, code: string) {
  await page.locator('[data-testid="paste-textarea"]').fill(code);
  await page.locator('#load-from-text-action').click();
  await page.locator('[data-testid="flowchart-preview"] svg').waitFor({ state: 'visible', timeout: 10_000 });
}

/**
 * Below the 640px hamburger breakpoint (#189), the toolbar/export/summary
 * controls live inside FullscreenShell's bottomBar `__details` panel and
 * are only reachable once the hamburger toggle opens it. On wide viewports
 * the toggle itself is hidden and the controls are already visible, so this
 * is a no-op there.
 */
export async function openBottomBarMenu(page: Page) {
  const toggle = page.getByTestId('bottombar-toggle');
  if (await toggle.isVisible()) await toggle.click();
}
