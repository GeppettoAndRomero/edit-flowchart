# edit-flowchart

Load Mermaid flowchart code, edit its structure with an inspector (add/remove
nodes and edges, change labels/shapes, move nodes between subgraph groups,
change direction), and get code back — entirely in your browser. Lines you
never edit round-trip byte-for-byte identical, including comments, styling
directives, and syntax this tool doesn't model. Open source, works offline (PWA).

Part of [runlocally](https://runlocally.app) — small tools that run locally on your device.

## How it works

This is a **line-based lossless parser/printer**, not a full Mermaid AST round
trip (mermaid.js has no serializer of its own — see
[mermaid-js/mermaid#2523](https://github.com/mermaid-js/mermaid/issues/2523)).
Every source line keeps its exact original text (`raw`, terminator included)
until an edit operation specifically regenerates that one line
(`src/lib/parse.ts` → `src/lib/print.ts`). `print(parse(source)) === source`
for any unedited document — verified for a 7-file fixture corpus in
`tests/corpus/*.mmd` by a property test in `tests/unit/corpus.test.ts`.

Syntax this tool doesn't model (chained arrows `A --> B --> C`, `&`-joined
statements, `;`-separated compound statements, `classDef`/`style`/`linkStyle`/
`click`/`direction` directives, non-Latin node ids, and more) is treated as an
**opaque line**: preserved exactly, still shown in the live preview (mermaid
renders it fine even though this tool doesn't parse it structurally), but not
editable through the GUI. Deleting or moving a node that an opaque line still
references is blocked with the offending line number(s) shown, rather than
silently breaking the reference.

The live preview and click-to-select are rendered with
[mermaid](https://github.com/mermaid-js/mermaid) (MIT), loaded on demand as
its own chunk and used for **rendering only** — `securityLevel: 'strict'`,
exact version pin, no click-handler execution. Mermaid's flowchart syntax has
no way to record a node's position (layout is always automatic), so this tool
deliberately has no drag-to-reposition — every editing feature here
corresponds to something that actually exists in the text format.

## Features

- GUI structural editing: add/remove nodes and edges, relabel, change shape
  (9 shapes) and edge style (solid/dotted/thick), move nodes between subgraph
  groups, change the diagram direction
- Byte-identical round trip for every line you don't touch
- Unsupported syntax passes through untouched instead of being reformatted or
  dropped, with a "parsed X/Y lines" summary
- Input: paste (with automatic ```mermaid fence extraction, e.g. pasting an
  AI chat response directly), file drop/picker (`.mmd`/`.mermaid`/`.md`/`.txt`),
  or a built-in sample
- Output: copy code, copy as a fenced ```mermaid block, download `.mmd`
  (`showSaveFilePicker` where supported, `<a download>` fallback everywhere
  else), and **"Copy for AI"** — a fixed before/after template (full text of
  the code as imported and as it is now, as two labeled fenced blocks) sized
  for pasting straight into an AI chat as a change instruction
- Undo/redo (code-string snapshots, capped at 100)
- Works offline (PWA), installable

## Develop

```bash
npm install
npm run dev      # dev server
npm run build    # type-check + production build to dist/
npm test         # unit tests, including the corpus round-trip property test
npm run test:e2e # Playwright
```

Stack: Astro + Preact + TypeScript. `mermaid` is loaded via a dynamic
`import()` so it stays out of the initial page bundle.

## Browser support

Works in current Chrome, Edge, Firefox and Safari. Rendering runs on the main
thread (mermaid's layout depends on the DOM). SVG click-to-select is an
enhancement: if mermaid's rendered SVG structure doesn't match what this tool
expects to find (its internal markup isn't a stable public API), click
selection is disabled automatically and the list-based inspector — the
primary way to select a node or edge — keeps working. `.mmd` download uses
the File System Access API's `showSaveFilePicker` where available and falls
back to a plain `<a download>` everywhere else (including Firefox and Safari).

## License

[MIT](./LICENSE). Built and maintained by Geppetto. Some code is written with AI
assistance; all review and decisions are the maintainer's.
