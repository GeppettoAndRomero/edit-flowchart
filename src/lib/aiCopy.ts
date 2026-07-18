/**
 * D17: the "copy for AI" export. Fixed format — two full-code blocks
 * (before/after), not a unified diff — so an AI reading it doesn't depend on
 * line numbers and no diff algorithm is needed on our side (issue #113).
 * The `before:`/`after:` markers and the ```mermaid fences are literal
 * (locale-independent structure); only the intro sentence is localized.
 */
export function buildAiInstructionCopy(intro: string, before: string, after: string): string {
  const beforeBlock = before.endsWith('\n') ? before : `${before}\n`;
  const afterBlock = after.endsWith('\n') ? after : `${after}\n`;
  return `${intro}\n\nbefore:\n\`\`\`mermaid\n${beforeBlock}\`\`\`\n\nafter:\n\`\`\`mermaid\n${afterBlock}\`\`\`\n`;
}
