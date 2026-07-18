import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
  integrations: [preact()],
  output: 'static',
  // slug-first namespace: physically nest this tool under
  // runlocally.app/edit-flowchart/ (src/pages/edit-flowchart/ + public/edit-flowchart/).
  // No `base` (it prefixes URLs but doesn't nest dist/, which would conflict with
  // root-served Pages). Bundle assets are isolated under /edit-flowchart/_assets/ so
  // they never collide with the hub or other tools.
  build: {
    inlineStylesheets: 'auto',
    assets: 'edit-flowchart/_assets',
  },
  vite: {
    resolve: {
      alias: {
        '@': '/src'
      }
    },
    build: {
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['preact', 'preact/hooks'],
            // mermaid (MIT, rendering only — see src/lib/mermaid.ts) is loaded on
            // demand via a dynamic import() the first time a render is actually
            // needed, so it stays out of the initial page load; naming its chunk
            // here makes it a stable, cacheable unit for the service worker's
            // cache-first strategy on same-origin .js requests (issue #113 D11 —
            // public/edit-flowchart/sw.js precaches it after first use).
            'mermaid': ['mermaid']
          }
        }
      }
    }
  },
  compressHTML: true,
  scopedStyleStrategy: 'class'
});
