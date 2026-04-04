import { useEffect, useState } from 'react';
import { getSessions, getQuestions } from '@/lib/storage';
import { TestSession, Question } from '@/types/mcq';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import FormattedText from '@/components/FormattedText';

export default function ResultsPage() {
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [questions, setQuestionsList] = useState<Question[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSessions(getSessions().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setQuestionsList(getQuestions());
  }, []);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatTime = (s: number) => s > 0 ? `${Math.floor(s / 60)}m ${s % 60}s` : '—';

  const avgScore = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + (s.score / s.total) * 100, 0) / sessions.length)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="text-muted-foreground mt-1">{sessions.length} tests taken • {avgScore}% average</p>
      </div>

      {sessions.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            No test results yet. Start a practice or exam!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const pct = Math.round((s.score / s.total) * 100);
            const isOpen = expanded.has(s.id);
            return (
              <Card key={s.id} className="glass-card hover:border-primary/20 transition-colors">
                <CardContent className="p-4">
                  <button className="w-full flex items-center justify-between" onClick={() => toggle(s.id)}>
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-lg flex items-center justify-center text-sm font-bold ${pct >= 80 ? 'bg-success/10 text-success' : pct >= 50 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                        {pct}%
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-sm">{s.subject} — {s.level}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(s.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={s.type === 'exam' ? 'default' : 'secondary'}>{s.type}</Badge>
                      <div className="text-right text-sm">
                        <p className="font-medium">{s.score}/{s.total}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(s.duration)}</p>
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-3 animate-fade-in border-t border-border pt-4">
                      {s.questionIds.map((qId, i) => {
                        const q = questions.find(x => x.id === qId);
                        if (!q) return null;
                        const userAns = s.answers[qId];
                        const correct = userAns === q.answer;
                        return (
                          <div key={qId} className={`p-3 rounded-lg border-l-4 ${correct ? 'border-l-success bg-success/5' : 'border-l-destructive bg-destructive/5'}`}>
                            <p className="font-medium text-sm mb-2">{i + 1}. <FormattedText text={q.question} /></p>
                            <div className="space-y-1 text-sm">
                              {q.options.map((opt, oi) => (
                                <div key={oi} className={`px-2 py-1 rounded ${oi === q.answer ? 'bg-success/10 text-success font-medium' : oi === userAns && oi !== q.answer ? 'bg-destructive/10 text-destructive line-through' : 'text-muted-foreground'}`}>
                                  {String.fromCharCode(65 + oi)}. <FormattedText text={opt} />
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 italic"><FormattedText text={q.explanation} /></p>
                          </div>
                        );
                      })}
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
