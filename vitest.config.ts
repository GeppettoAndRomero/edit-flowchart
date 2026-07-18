import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit tests run in Node (pure functions). Component tests opt into jsdom via a
// `// @vitest-environment jsdom` docblock. E2E lives in Playwright, not here.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.tsx'],
    environment: 'node',
    // jsdom (used by component tests and storage-backed unit tests via docblock)
    // needs a real origin or localStorage is a non-functional opaque-origin stub.
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: ['tests/setup/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      // The parser/printer/ops core (this tool's actual engine) and the
      // small pure utils are unit-testable in Node. lib/mermaid.ts is
      // DOM-bound (mermaid's layout runs against `document`) and is covered
      // by the Playwright e2e suite instead, mirroring how the sibling
      // draw-flowchart tool treats its mermaidRenderer.ts.
      include: [
        'src/lib/types.ts',
        'src/lib/parse.ts',
        'src/lib/print.ts',
        'src/lib/ops.ts',
        'src/lib/diff.ts',
        'src/lib/fence.ts',
        'src/lib/aiCopy.ts',
        'src/utils/fileValidation.ts',
        'src/utils/settings.ts',
        'src/utils/settingsStorage.ts',
      ],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
    },
  },
});
