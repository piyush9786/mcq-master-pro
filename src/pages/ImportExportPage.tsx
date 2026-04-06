import { useState } from 'react';
import { addQuestions, exportQuestionBank, validateQuestionBank, getSubjects, getQuestions } from '@/lib/storage';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, CheckCircle2, AlertCircle, Copy, RefreshCw, FileJson, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SAMPLE_QUESTIONS = [
  {
    id: "js_001",
    subject: "JavaScript",
    level: "easy",
    question: "What is the output of `typeof null`?",
    options: ['"null"', '"object"', '"undefined"', '"number"'],
    answer: 1,
    explanation: "Due to a historical bug, `typeof null` returns `\"object\"` in JavaScript."
  },
  {
    id: "math_001",
    subject: "Mathematics",
    level: "medium",
    question: "What is the value of $\\int_0^1 x^2 \\, dx$?",
    options: ["$\\frac{1}{2}$", "$\\frac{1}{3}$", "$\\frac{1}{4}$", "$1$"],
    answer: 1,
    explanation: "Using the power rule: $\\frac{x^3}{3}\\Big|_0^1 = \\frac{1}{3}$"
  },
  {
    id: "py_001",
    subject: "Python",
    level: "hard",
    question: "What does this code output?\n```python\nx = [1, 2, 3]\nprint(x[::-1])\n```",
    options: ["[3, 2, 1]", "[1, 2, 3]", "Error", "None"],
    answer: 0,
    explanation: "The `[::-1]` slice reverses the list, giving `[3, 2, 1]`."
  }
];

const FULL_SAMPLE_JSON = JSON.stringify({ version: "1.0", name: "My Question Bank", questions: SAMPLE_QUESTIONS }, null, 2);

const FULL_COPY_TEMPLATE = `/*
 ╔══════════════════════════════════════════════════════════╗
 ║           MCQ Pro — Question Bank Format Guide          ║
 ╠══════════════════════════════════════════════════════════╣
 ║                                                          ║
 ║  REQUIRED FIELDS:                                        ║
 ║  ─────────────────                                       ║
 ║  id          (string)   Unique ID. Duplicates renamed.   ║
 ║  subject     (string)   e.g. "Math", "Java", "History"   ║
 ║  level       (enum)     easy | medium | hard | expert     ║
 ║                         Aliases: beginner→easy,           ║
 ║                         intermediate→medium,              ║
 ║                         advanced→hard, master→expert      ║
 ║  question    (string)   The question text                 ║
 ║  options     (string[]) 2–6 answer choices                ║
 ║  answer      (number)   Zero-based index of correct one   ║
 ║  explanation (string)   Shown after answering             ║
 ║                                                          ║
 ║  FORMATTING SUPPORT (question, options, explanation):     ║
 ║  ─────────────────────────────────────────────────────    ║
 ║  Inline code:   \`typeof null\`                            ║
 ║  Code block:    \`\`\`java\\ncode here\\n\`\`\`                    ║
 ║  LaTeX math:    $\\\\frac{1}{3}$                            ║
 ║                                                          ║
 ╚══════════════════════════════════════════════════════════╝
*/

${JSON.stringify({
  version: "1.0",
  name: "My Question Bank",
  questions: [
    {
      id: "js_001",
      subject: "JavaScript",
      level: "easy",
      question: "What is the output of \`typeof null\`?",
      options: ["\"null\"", "\"object\"", "\"undefined\"", "\"number\""],
      answer: 1,
      explanation: "Due to a historical bug, \`typeof null\` returns \\\"object\\\" in JavaScript."
    },
    {
      id: "math_001",
      subject: "Mathematics",
      level: "medium",
      question: "What is the value of $\\\\int_0^1 x^2 \\\\, dx$?",
      options: ["$\\\\frac{1}{2}$", "$\\\\frac{1}{3}$", "$\\\\frac{1}{4}$", "$1$"],
      answer: 1,
      explanation: "Using the power rule: $\\\\frac{x^3}{3}\\\\Big|_0^1 = \\\\frac{1}{3}$"
    },
    {
      id: "py_001",
      subject: "Python",
      level: "hard",
      question: "What does this code output?\\n\`\`\`python\\nx = [1, 2, 3]\\nprint(x[::-1])\\n\`\`\`",
      options: ["[3, 2, 1]", "[1, 2, 3]", "Error", "None"],
      answer: 0,
      explanation: "The \`[::-1]\` slice reverses the list, giving \`[3, 2, 1]\`."
    }
  ]
}, null, 2)}`;

const FIELD_DOCS = [
  { field: 'id', type: 'string', required: true, note: 'Unique identifier. Duplicates are auto-renamed on import.' },
  { field: 'subject', type: 'string', required: true, note: 'Any string — e.g. "Math", "Python", "History"' },
  { field: 'level', type: 'enum', required: true, note: 'easy · medium · hard · expert (or: beginner, intermediate, advanced — auto-converted)' },
  { field: 'question', type: 'string', required: true, note: 'Supports `inline code`, ```code blocks```, and $LaTeX math$' },
  { field: 'options', type: 'string[]', required: true, note: 'Array of 2–6 answer choices' },
  { field: 'answer', type: 'number', required: true, note: 'Zero-based index of the correct option' },
  { field: 'explanation', type: 'string', required: true, note: 'Shown after answering. Supports code & math.' },
];

export default function ImportExportPage() {
  const { toast } = useToast();
  const [jsonInput, setJsonInput] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ added: number; autoRenamed: number } | null>(null);
  const [exportSubject, setExportSubject] = useState('all');
  const [showDocs, setShowDocs] = useState(false);
  const [copiedSample, setCopiedSample] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [overrideSubject, setOverrideSubject] = useState('');

  const subjects = getSubjects();

  const handleCreateSubject = () => {
    const name = newSubject.trim();
    if (!name) return;
    if (subjects.includes(name)) {
      toast({ title: 'Subject already exists', variant: 'destructive' });
      return;
    }
    // Create a placeholder question to register the subject
    const placeholderQ = {
      id: 'placeholder_' + Date.now().toString(36),
      subject: name,
      level: 'easy' as const,
      question: `[Placeholder] — import questions into "${name}" using the subject override below.`,
      options: ['—', '—'],
      answer: 0,
      explanation: 'This is a placeholder. Delete it after importing real questions.',
    };
    addQuestions([placeholderQ]);
    setNewSubject('');
    toast({ title: `✅ Subject "${name}" created!` });
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(jsonInput);
      const result = validateQuestionBank(data);
      const infoMsgs = result.errors.filter(e => e.startsWith('ℹ️'));
      const realErrors = result.errors.filter(e => !e.startsWith('ℹ️'));
      if (!result.valid || !result.questions) {
        setErrors(result.errors);
        setImportResult(null);
        return;
      }
      // Apply subject override if set
      let questionsToImport = result.questions;
      if (overrideSubject.trim()) {
        questionsToImport = questionsToImport.map(q => ({ ...q, subject: overrideSubject.trim() }));
      }
      const { added, autoRenamed } = addQuestions(questionsToImport);
      setImportResult({ added, autoRenamed });
      setErrors(infoMsgs);
      toast({ title: `✅ Imported ${added} questions!`, description: autoRenamed > 0 ? `${autoRenamed} IDs auto-reassigned.` : undefined });
    } catch {
      setErrors(['❌ Invalid JSON — check for missing commas, quotes, or brackets.']);
      setImportResult(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setJsonInput(ev.target?.result as string || '');
    reader.readAsText(file);
  };

  const handleExport = () => {
    const bank = exportQuestionBank(exportSubject);
    const blob = new Blob([JSON.stringify(bank, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `mcqpro-${exportSubject}-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const copySample = () => {
    navigator.clipboard.writeText(FULL_COPY_TEMPLATE);
    setCopiedSample(true);
    toast({ title: 'Sample JSON copied!' });
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const loadSample = () => {
    setJsonInput(FULL_SAMPLE_JSON);
    toast({ title: 'Sample loaded in editor', description: 'Click Import to add these 3 demo questions.' });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold shimmer-text">Import / Export</h1>
        <p className="text-muted-foreground mt-1">Manage your question banks</p>
      </div>

      {/* ── Sample JSON Pad ─────────────────────────────────────── */}
      <Card className="glass-card animate-scale-in border-primary/20" style={{ animationDelay: '60ms' }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileJson className="h-4 w-4 text-primary" /> JSON Format Guide
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDocs(!showDocs)} className="text-xs gap-1">
                <Info className="h-3.5 w-3.5" /> Field Docs {showDocs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              <Button variant="outline" size="sm" onClick={loadSample} className="text-xs gap-1">
                <Upload className="h-3.5 w-3.5" /> Load Sample
              </Button>
              <Button variant="outline" size="sm" onClick={copySample} className="text-xs gap-1">
                {copiedSample ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedSample ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scrollable sample pad */}
          <div className="relative rounded-xl overflow-hidden border border-border/60">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/40 text-xs font-mono text-muted-foreground">
              <span>sample-questions.json</span>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
              </div>
            </div>
            <pre className="text-xs font-mono p-4 overflow-auto max-h-72 bg-muted/20 leading-relaxed">
              <code>{FULL_SAMPLE_JSON}</code>
            </pre>
          </div>

          {/* Field docs collapsible */}
          {showDocs && (
            <div className="space-y-2 animate-fade-in">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Required Fields</p>
              <div className="grid gap-2">
                {FIELD_DOCS.map(f => (
                  <div key={f.field} className="flex items-start gap-3 text-xs p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                    <code className="font-bold text-primary shrink-0 mt-0.5 min-w-[80px]">{f.field}</code>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 mt-0.5 ${f.required ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                      {f.type}
                    </span>
                    <span className="text-muted-foreground">{f.note}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-xs space-y-1">
                <p className="font-semibold text-primary">💡 Formatting in questions & options</p>
                <p className="text-muted-foreground">Use <code className="formatted-inline-code">`backticks`</code> for inline code, <code className="formatted-inline-code">```lang\ncode\n```</code> for blocks, <code className="formatted-inline-code">$formula$</code> for LaTeX math.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Import ──────────────────────────────────────────────── */}
        <Card className="glass-card animate-scale-in" style={{ animationDelay: '120ms' }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Import Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15 text-xs">
              <RefreshCw className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-muted-foreground">Duplicate IDs are <span className="text-foreground font-medium">automatically reassigned</span> — no questions are ever lost.</p>
            </div>
            <input type="file" accept=".json" onChange={handleFileUpload}
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-sm file:font-medium file:cursor-pointer cursor-pointer" />
            <Textarea placeholder="Or paste JSON here..." value={jsonInput}
              onChange={e => setJsonInput(e.target.value)} rows={9} className="font-mono text-xs" />
            {errors.length > 0 && (
              <div className="space-y-1">
                {errors.map((err, i) => (
                  <p key={i} className={`text-xs flex items-start gap-1 ${err.startsWith('ℹ️') ? 'text-primary' : 'text-destructive'}`}>
                    {err.startsWith('ℹ️') ? <Info className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />}
                    {err.replace('ℹ️ ', '')}
                  </p>
                ))}
              </div>
            )}
            {importResult !== null && (
              <div className="space-y-1.5 p-3 rounded-xl bg-success/10 border border-success/20">
                <p className="text-sm text-success flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> {importResult.added} questions imported!
                </p>
                {importResult.autoRenamed > 0 && (
                  <p className="text-xs text-primary flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> {importResult.autoRenamed} IDs auto-reassigned
                  </p>
                )}
              </div>
            )}
            <Button onClick={handleImport} disabled={!jsonInput.trim()} className="w-full">
              <Upload className="h-4 w-4 mr-2" /> Import Questions
            </Button>
          </CardContent>
        </Card>

        {/* ── Export ──────────────────────────────────────────────── */}
        <Card className="glass-card animate-scale-in" style={{ animationDelay: '180ms' }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" /> Export Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject</label>
              <Select value={exportSubject} onValueChange={setExportSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 rounded-xl bg-muted/50 space-y-2">
              <p className="text-sm font-medium">{getQuestions().filter(q => exportSubject === 'all' || q.subject === exportSubject).length} questions will be exported</p>
              <p className="text-xs text-muted-foreground">Exported as a JSON file matching the exact import format. You can share it or reimport on another device.</p>
            </div>
            <Button onClick={handleExport} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" /> Download JSON
            </Button>

            {/* Level key */}
            <div className="pt-2 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Accepted level values</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  { label: 'easy', aliases: 'beginner, basic, simple' },
                  { label: 'medium', aliases: 'intermediate, normal' },
                  { label: 'hard', aliases: 'difficult, advanced' },
                  { label: 'expert', aliases: 'master, pro' },
                ].map(({ label, aliases }) => (
                  <div key={label} className="px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border/50">
                    <span className="font-bold">{label}</span>
                    <span className="text-muted-foreground ml-1">({aliases})</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
