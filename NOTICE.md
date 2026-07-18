# Third-party notices

The source code in this repository is licensed under the [MIT License](./LICENSE).

This tool has no third-party components under a copyleft or other non-permissive
license. Its runtime dependencies are all distributed under permissive licenses:

- [mermaid](https://github.com/mermaid-js/mermaid) (MIT) — renders the flowchart
  preview to SVG, entirely in the browser. This tool's own parser/printer
  (`src/lib/`) is what reads and writes Mermaid flowchart *code*; mermaid is used
  for rendering only (issue #113 D9), pinned to an exact version.
  - mermaid's own dependencies are permissively licensed too: the d3 family
    (ISC/BSD-3-Clause), `dagre-d3-es` (MIT), `khroma` (MIT), `dompurify`
    (MPL-2.0 OR Apache-2.0 — used under Apache-2.0 here), `cytoscape` and
    friends (MIT), and `katex` (MIT), none of which are exercised by this
    tool's flowchart-only scope but are included in mermaid's package as
    shipped.
- [Astro](https://astro.build/), [Preact](https://preactjs.com/) and
  [@astrojs/preact](https://github.com/withastro/astro/tree/main/packages/integrations/preact)
  — the site framework and rendering.

Each keeps its own license and copyright; see the respective packages in
`node_modules` for the full license text. Full dependency tree license audit:
`npx license-checker --production --summary`.
