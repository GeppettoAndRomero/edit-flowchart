/**
 * Thin wrapper around the `mermaid` library (MIT) — rendering only, never
 * parsing back to structured data (mermaid has no AST round trip, see issue
 * #113 D6/D9 references). This module is DOM-bound (mermaid's layout runs
 * against `document`), so it is exercised by the Playwright e2e suite rather
 * than a jsdom unit test, mirroring tools/draw-flowchart/src/utils/mermaidRenderer.ts
 * in this same monorepo.
 *
 * `mermaid` is dynamically imported (never at module top level) so it stays
 * out of the initial bundle and is loaded as its own chunk the first time a
 * render is actually needed (see astro.config.mjs manualChunks, D11).
 */

let mermaidPromise: Promise<typeof import('mermaid')> | null = null;

function loadMermaid() {
  if (!mermaidPromise) mermaidPromise = import('mermaid');
  return mermaidPromise;
}

let renderCounter = 0;

/**
 * Render Mermaid flowchart source to an SVG markup string.
 *
 * `securityLevel: 'strict'` (D9) sanitizes labels via DOMPurify and disables
 * `click` bindings entirely, so the returned SVG is safe to insert with
 * `innerHTML` even though it is derived from arbitrary user text, and the
 * `click ...` directive (kept as an opaque line by the parser, see D7) never
 * actually executes anything through the renderer either.
 */
export async function renderFlowchart(code: string): Promise<string> {
  const { default: mermaid } = await loadMermaid();
  const theme =
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'dark'
      : 'default';
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme,
  });
  renderCounter += 1;
  const { svg } = await mermaid.render(`edit-flowchart-svg-${renderCounter}`, code);
  return svg;
}

export interface SvgSelection {
  /** Resolve a clicked/hovered element to our node id, or null when it isn't a mapped node. */
  nodeIdAt(target: Element): string | null;
  /** Resolve a clicked/hovered element to the doc line index of the edge, or null. */
  edgeLineIdxAt(target: Element): number | null;
}

const NODE_DOM_ID_RE = /^flowchart-(.+)-\d+$/;

/**
 * D12: SVG click-to-select is an enhancement, not the primary interaction
 * path (the list-based inspector always works). Mermaid's rendered SVG
 * structure is not a stable public API, so this binds defensively: node ids
 * are recovered from `g.node` element ids matching `flowchart-<id>-<n>`, and
 * edges are matched by DOM order (`g.edgePaths path`) against definition
 * order. If the resolved count doesn't exactly match the document's node/edge
 * count, selection binding is disabled (returns null) rather than guessing —
 * the caller falls back to list-only selection instead of crashing or
 * mis-selecting.
 */
export function bindSvgSelection(container: Element, nodeIds: string[], edgeLineIdxsInOrder: number[]): SvgSelection | null {
  try {
    const nodeEls = Array.from(container.querySelectorAll('g.node'));
    const domToOurId = new Map<Element, string>();
    const resolved = new Set<string>();
    for (const el of nodeEls) {
      const m = NODE_DOM_ID_RE.exec(el.id);
      if (!m) continue;
      domToOurId.set(el, m[1]);
      resolved.add(m[1]);
    }
    if (resolved.size !== nodeIds.length || !nodeIds.every((id) => resolved.has(id))) {
      return null;
    }

    const edgeEls = Array.from(container.querySelectorAll('g.edgePaths path'));
    if (edgeEls.length !== edgeLineIdxsInOrder.length) {
      return null;
    }
    const edgeToLineIdx = new Map<Element, number>();
    edgeEls.forEach((el, i) => edgeToLineIdx.set(el, edgeLineIdxsInOrder[i]));

    return {
      nodeIdAt(target: Element) {
        const g = target.closest('g.node');
        if (!g) return null;
        return domToOurId.get(g) ?? null;
      },
      edgeLineIdxAt(target: Element) {
        const path = target.closest('path');
        if (!path || !path.closest('g.edgePaths')) return null;
        return edgeToLineIdx.get(path) ?? null;
      },
    };
  } catch {
    return null;
  }
}
