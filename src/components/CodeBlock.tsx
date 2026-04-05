import { useState } from 'react';
import { Copy, Check, Play } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  showRun?: boolean;
}

const ONLINE_COMPILERS: Record<string, string> = {
  java: 'https://www.programiz.com/java-programming/online-compiler/',
  python: 'https://www.programiz.com/python-programming/online-compiler/',
  javascript: 'https://www.programiz.com/javascript/online-compiler/',
  c: 'https://www.programiz.com/c-programming/online-compiler/',
  cpp: 'https://www.programiz.com/cpp-programming/online-compiler/',
  csharp: 'https://www.programiz.com/csharp-programming/online-compiler/',
};

export default function CodeBlock({ code, language = '', showRun = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');
  const lang = language.toLowerCase();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = () => {
    const url = ONLINE_COMPILERS[lang] || ONLINE_COMPILERS['java'];
    window.open(url, '_blank');
  };

  return (
    <div className="my-3 rounded-lg border border-border overflow-hidden bg-card shadow-sm">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-warning/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-success/70" />
          {lang && <span className="ml-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{lang}</span>}
        </div>
        <div className="flex items-center gap-1">
          {showRun && (
            <button
              onClick={handleRun}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-success/15 text-success hover:bg-success/25 transition-colors"
              title="Run in online compiler"
            >
              <Play className="h-3 w-3" /> Run
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors"
            title="Copy code"
          >
            {copied ? <><Check className="h-3 w-3 text-success" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
          </button>
        </div>
      </div>
      {/* Code area with line numbers */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono leading-relaxed">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-muted/30">
                <td className="select-none text-right pr-3 pl-3 py-0 text-muted-foreground/50 w-8 align-top">{i + 1}</td>
                <td className="pr-4 py-0 whitespace-pre">{line}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
