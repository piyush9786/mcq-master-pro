import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import CodeBlock from './CodeBlock';

interface FormattedTextProps {
  text: string;
  className?: string;
  showRunButton?: boolean;
}

type Segment =
  | { type: 'html'; content: string }
  | { type: 'codeblock'; code: string; language: string };

export default function FormattedText({ text, className = '', showRunButton = false }: FormattedTextProps) {
  const segments = useMemo(() => parseSegments(text), [text]);

  return (
    <div className={`inline ${className}`}>
      {segments.map((seg, i) =>
        seg.type === 'codeblock' ? (
          <CodeBlock key={i} code={seg.code} language={seg.language} showRun={showRunButton} />
        ) : (
          <span key={i} dangerouslySetInnerHTML={{ __html: seg.content }} />
        )
      )}
    </div>
  );
}

function parseSegments(text: string): Segment[] {
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(codeBlockRegex)) {
    const before = text.slice(lastIndex, match.index);
    if (before) segments.push({ type: 'html', content: processInline(before) });
    segments.push({ type: 'codeblock', code: match[2].trim(), language: match[1] || '' });
    lastIndex = match.index! + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) segments.push({ type: 'html', content: processInline(remaining) });

  return segments;
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

function processInline(text: string): string {
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
