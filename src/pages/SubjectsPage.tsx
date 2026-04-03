import { useEffect, useState } from 'react';
import { getQuestions, setQuestions } from '@/lib/storage';
import { Question } from '@/types/mcq';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SubjectsPage() {
  const [questions, setQuestionsList] = useState<Question[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setQuestionsList(getQuestions());
  }, []);

  const subjects = [...new Set(questions.map(q => q.subject))].sort();

  const getSubjectStats = (subject: string) => {
    const qs = questions.filter(q => q.subject === subject);
    const levels = { easy: 0, medium: 0, hard: 0, expert: 0 };
    qs.forEach(q => { if (q.level in levels) levels[q.level as keyof typeof levels]++; });
    return { total: qs.length, levels };
  };

  const deleteSubject = (subject: string) => {
    const remaining = questions.filter(q => q.subject !== subject);
    setQuestions(remaining);
    setQuestionsList(remaining);
    toast({ title: 'Subject deleted', description: `Removed all ${subject} questions` });
  };

  const deleteQuestion = (id: string) => {
    const remaining = questions.filter(q => q.id !== id);
    setQuestions(remaining);
    setQuestionsList(remaining);
    toast({ title: 'Question deleted' });
  };

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (s: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Subjects</h1>
        <p className="text-muted-foreground mt-1">{subjects.length} subjects • {questions.length} total questions</p>
      </div>

      {subjects.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            No questions imported yet. Go to Import/Export to add questions.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {subjects.map(subject => {
            const stats = getSubjectStats(subject);
            const isOpen = expanded.has(subject);
            const subjectQs = questions.filter(q => q.subject === subject);
            return (
              <Card key={subject} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <button className="flex items-center gap-3 flex-1 text-left" onClick={() => toggle(subject)}>
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{subject}</p>
                        <p className="text-xs text-muted-foreground">{stats.total} questions</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {stats.levels.easy > 0 && <Badge variant="secondary" className="text-xs">E:{stats.levels.easy}</Badge>}
                        {stats.levels.medium > 0 && <Badge variant="secondary" className="text-xs">M:{stats.levels.medium}</Badge>}
                        {stats.levels.hard > 0 && <Badge variant="secondary" className="text-xs">H:{stats.levels.hard}</Badge>}
                        {stats.levels.expert > 0 && <Badge variant="secondary" className="text-xs">X:{stats.levels.expert}</Badge>}
                      </div>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => deleteSubject(subject)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 space-y-2 border-t border-border pt-3 animate-fade-in">
                      {subjectQs.map((q, i) => (
                        <div key={q.id} className="flex items-center justify-between gap-2 text-sm p-2 rounded hover:bg-muted/50">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Badge variant="outline" className="text-xs shrink-0">{q.level}</Badge>
                            <span className="truncate">{q.question}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteQuestion(q.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
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
