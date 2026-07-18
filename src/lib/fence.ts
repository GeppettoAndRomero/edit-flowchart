/**
 * D14: both file import and pasted textarea text get the same treatment —
 * if the text contains a ```mermaid fenced code block, only the *first* such
 * block's content is used (with a `multiple` flag when there was more than
 * one, so the caller can show a notice); with no fence, the whole text is
 * used as-is. This is what lets an AI chat's fenced flowchart output be
 * pasted directly (see issue #113 "主要ユースケース").
 */

export interface FenceExtraction {
  code: string;
  multiple: boolean;
}

const FENCE_RE = /```mermaid[ \t]*\r?\n([\s\S]*?)```/g;

export function extractMermaidFence(text: string): FenceExtraction {
  const matches = Array.from(text.matchAll(FENCE_RE));
  if (matches.length === 0) return { code: text, multiple: false };
  return { code: matches[0][1], multiple: matches.length > 1 };
}
