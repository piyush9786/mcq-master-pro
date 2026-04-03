import { useEffect, useState } from 'react';
import { getWrongQuestions, getQuestions, setWrongQuestions } from '@/lib/storage';
import { WrongQuestion, Question } from '@/types/mcq';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react';

export default function WrongQuestionsPage() {
  const [wrongs, setWrongs] = useState<WrongQuestion[]>([]);
  const [questions, setQuestionsList] = useState<Question[]>([]);
  const [filterSubject, setFilterSubject] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setWrongs(getWrongQuestions().filter(w => !w.corrected));
    setQuestionsList(getQuestions());
  }, []);

  const subjects = [...new Set(wrongs.map(w => w.subject))].sort();
  const filtered = filterSubject === 'all' ? wrongs : wrongs.filter(w => w.subject === filterSubject);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const clearAll = () => {
    setWrongQuestions([]);
    setWrongs([]);
  };

  const downloadAsJson = () => {
    const data = filtered.map(w => {
      const q = questions.find(x => x.id === w.questionId);
      return { ...w, question: q };
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wrong-questions-${filterSubject}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Wrong Questions</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} questions to review</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={downloadAsJson}><Download className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={clearAll}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            No wrong questions! Keep it up! 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(w => {
            const q = questions.find(x => x.id === w.questionId);
            if (!q) return null;
            const isOpen = expanded.has(w.questionId);
            return (
              <Card key={w.questionId} className="glass-card">
                <CardContent className="p-4">
                  <button className="w-full text-left flex items-center justify-between" onClick={() => toggle(w.questionId)}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge variant="secondary" className="shrink-0">{q.subject}</Badge>
                      <p className="text-sm font-medium truncate">{q.question}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">{w.attempts}x wrong</span>
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-4 space-y-2 animate-fade-in">
                      <div className="space-y-1">
                        {q.options.map((opt, i) => (
                          <div key={i} className={`text-sm px-3 py-1.5 rounded ${i === q.answer ? 'bg-success/10 text-success font-medium' : 'text-muted-foreground'}`}>
                            {opt}
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground italic p-2 bg-muted/50 rounded">{q.explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
