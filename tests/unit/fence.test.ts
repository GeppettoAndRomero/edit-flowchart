import { describe, it, expect } from 'vitest';
import { extractMermaidFence } from '@/lib/fence';

describe('extractMermaidFence', () => {
  it('returns the full text unchanged when there is no fence', () => {
    const text = 'graph TD\n  A --> B\n';
    expect(extractMermaidFence(text)).toEqual({ code: text, multiple: false });
  });

  it('extracts the content of a ```mermaid fence', () => {
    const text = 'Here is the diagram:\n\n```mermaid\ngraph TD\n  A --> B\n```\n\nLet me know what you think.';
    const result = extractMermaidFence(text);
    expect(result.code).toBe('graph TD\n  A --> B\n');
    expect(result.multiple).toBe(false);
  });

  it('extracts only the first fence and flags when there is more than one', () => {
    const text = '```mermaid\ngraph TD\n  A --> B\n```\nsome text\n```mermaid\ngraph TD\n  C --> D\n```\n';
    const result = extractMermaidFence(text);
    expect(result.code).toBe('graph TD\n  A --> B\n');
    expect(result.multiple).toBe(true);
  });

  it('ignores a fence with no "mermaid" language tag (whole text used as-is)', () => {
    const text = '```\ngraph TD\n  A --> B\n```\n';
    const result = extractMermaidFence(text);
    expect(result.code).toBe(text);
    expect(result.multiple).toBe(false);
  });
});
