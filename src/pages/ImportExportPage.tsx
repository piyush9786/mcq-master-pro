import { useState } from 'react';
import { addQuestions, exportQuestionBank, validateQuestionBank, getSubjects, getQuestions } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, FileJson, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const EXAMPLE_JSON = JSON.stringify({
  version: "1.0",
  name: "Sample Bank",
  questions: [
    {
      id: "q1",
      subject: "JavaScript",
      level: "easy",
      question: "What is 1 + 1?",
      options: ["1", "2", "3", "4"],
      answer: 1,
      explanation: "Basic addition."
    }
  ]
}, null, 2);

export default function ImportExportPage() {
  const { toast } = useToast();
  const [jsonInput, setJsonInput] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [importCount, setImportCount] = useState<number | null>(null);
  const [exportSubject, setExportSubject] = useState('all');

  const subjects = getSubjects();

  const handleImport = () => {
    try {
      const data = JSON.parse(jsonInput);
      const result = validateQuestionBank(data);
      if (!result.valid || !result.questions) {
        setErrors(result.errors);
        setImportCount(null);
        return;
      }
      const added = addQuestions(result.questions);
      setImportCount(added);
      setErrors([]);
      toast({ title: `Imported ${added} new questions!` });
    } catch {
      setErrors(['Invalid JSON format']);
      setImportCount(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonInput(ev.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const bank = exportQuestionBank(exportSubject);
    const blob = new Blob([JSON.stringify(bank, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcqpro-${exportSubject}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyExample = () => {
    navigator.clipboard.writeText(EXAMPLE_JSON);
    toast({ title: 'Copied to clipboard!' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Import / Export</h1>
        <p className="text-muted-foreground mt-1">Manage your question banks</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Import Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <input type="file" accept=".json" onChange={handleFileUpload} className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-sm file:font-medium file:cursor-pointer cursor-pointer" />
            </div>
            <Textarea
              placeholder="Or paste JSON here..."
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
            {errors.length > 0 && (
              <div className="space-y-1">
                {errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {err}
                  </p>
                ))}
              </div>
            )}
            {importCount !== null && (
              <p className="text-sm text-success flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> {importCount} questions imported
              </p>
            )}
            <Button onClick={handleImport} disabled={!jsonInput.trim()} className="w-full">
              <Upload className="h-4 w-4 mr-2" /> Import
            </Button>
          </CardContent>
        </Card>

        {/* Export */}
        <Card className="glass-card">
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
            <p className="text-sm text-muted-foreground">{getQuestions().filter(q => exportSubject === 'all' || q.subject === exportSubject).length} questions available</p>
            <Button onClick={handleExport} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" /> Export JSON
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Schema Example */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><FileJson className="h-4 w-4" /> JSON Schema Example</CardTitle>
            <Button variant="ghost" size="sm" onClick={copyExample}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-auto font-mono">{EXAMPLE_JSON}</pre>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium">Validation Rules:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">id: unique string</Badge>
              <Badge variant="secondary" className="text-xs">subject: string</Badge>
              <Badge variant="secondary" className="text-xs">level: easy|medium|hard|expert</Badge>
              <Badge variant="secondary" className="text-xs">options: 2-6 items</Badge>
              <Badge variant="secondary" className="text-xs">answer: valid index</Badge>
              <Badge variant="secondary" className="text-xs">explanation: string</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
