import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface FormattedTextProps {
  text: string;
  className?: string;
}

/**
 * Renders text with:
 * - Code blocks: ```language\ncode\n``` → <pre><code>
 * - Inline code: `code` → <code>
 * - Block math: $$latex$$ → rendered KaTeX (display mode)
 * - Inline math: $latex$ → rendered KaTeX (inline)
 */
export default function FormattedText({ text, className = '' }: FormattedTextProps) {
  const html = useMemo(() => renderFormatted(text), [text]);
  return <div className={`inline ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false });
  } catch {
    return `<code>${escapeHtml(latex)}</code>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderFormatted(text: string): string {
  // Split by code blocks first: ```lang\ncode\n```
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let result = '';
  let lastIndex = 0;

  for (const match of text.matchAll(codeBlockRegex)) {
    result += processInline(text.slice(lastIndex, match.index));
    const lang = match[1] || '';
    const code = escapeHtml(match[2].trim());
    result += `<pre class="formatted-code-block"><code${lang ? ` class="language-${lang}"` : ''}>${code}</code></pre>`;
    lastIndex = match.index! + match[0].length;
  }
  result += processInline(text.slice(lastIndex));
  return result;
}

function processInline(text: string): string {
  // Process: $$block math$$, $inline math$, `inline code`
  // Order matters: $$ before $, ` is independent
  const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|`[^`]+?`)/g;
  let result = '';
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith('$$') && token.endsWith('$$')) {
      result += renderKatex(token.slice(2, -2).trim(), true);
    } else if (token.startsWith('$') && token.endsWith('$')) {
      result += renderKatex(token.slice(1, -1).trim(), false);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      result += `<code class="formatted-inline-code">${escapeHtml(token.slice(1, -1))}</code>`;
    }
    lastIndex = match.index! + match[0].length;
  }
  result += escapeHtml(text.slice(lastIndex));
  return result;
}
