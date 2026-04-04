import { useEffect, useState } from 'react';
import { getQuestions, setQuestions } from '@/lib/storage';
import { Question } from '@/types/mcq';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, BookOpen, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LEVEL_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  easy:   { bg: 'bg-success',     text: 'text-white', label: 'Easy' },
  medium: { bg: 'bg-warning',     text: 'text-white', label: 'Med' },
  hard:   { bg: 'bg-orange-500',  text: 'text-white', label: 'Hard' },
  expert: { bg: 'bg-destructive', text: 'text-white', label: 'Exp' },
};

export default function SubjectsPage() {
  const [questions, setQuestionsList] = useState<Question[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setQuestionsList(getQuestions());
    setMounted(true);
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

  const toggle = (s: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });
  };

  const filteredSubjects = subjects.filter(s =>
    s.toLowerCase().includes(search.toLowerCase()) ||
    questions.some(q => q.subject === s && q.question.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold shimmer-text">Subjects</h1>
        <p className="text-muted-foreground mt-1">{subjects.length} subjects • {questions.length} total questions</p>
      </div>

      {/* Search */}
      <div className="animate-fade-in relative" style={{ animationDelay: '80ms' }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search subjects or questions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
        />
      </div>

      {filteredSubjects.length === 0 ? (
        <Card className="glass-card animate-scale-in">
          <CardContent className="p-8 text-center text-muted-foreground">
            {questions.length === 0
              ? 'No questions imported yet. Go to Import/Export to add questions.'
              : 'No subjects match your search.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSubjects.map((subject, subjectIdx) => {
            const stats = getSubjectStats(subject);
            const isOpen = expanded.has(subject);
            const subjectQs = questions.filter(q => q.subject === subject &&
              (search === '' || q.question.toLowerCase().includes(search.toLowerCase()) || subject.toLowerCase().includes(search.toLowerCase()))
            );

            return (
              <Card
                key={subject}
                className="glass-card hover-lift overflow-hidden border-border/50 hover:border-primary/25 transition-all duration-300"
                style={{ animation: `stagger-in 0.4s ease both ${subjectIdx * 60 + 120}ms` }}
              >
                <CardContent className="p-0">
                  {/* Subject header */}
                  <div className="flex items-center justify-between p-4">
                    <button className="flex items-center gap-3 flex-1 text-left group" onClick={() => toggle(subject)}>
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{subject}</p>
                        <p className="text-xs text-muted-foreground">{stats.total} questions</p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      {/* Level badges */}
                      <div className="flex gap-1">
                        {(['easy','medium','hard','expert'] as const).map(lvl => {
                          const cnt = stats.levels[lvl];
                          if (!cnt) return null;
                          const c = LEVEL_COLORS[lvl];
                          return (
                            <span key={lvl} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${c.bg} ${c.text} animate-scale-in`}
                              title={`${c.label}: ${cnt}`}>
                              {cnt}
                            </span>
                          );
                        })}
                      </div>

                      {/* Expand / delete */}
                      <button onClick={() => toggle(subject)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <Button variant="outline" size="icon" className="h-8 w-8 hover:border-destructive/50 group/del"
                        onClick={() => deleteSubject(subject)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground group-hover/del:text-destructive transition-colors" />
                      </Button>
                    </div>
                  </div>

                  {/* Level distribution bar */}
                  {stats.total > 0 && (
                    <div className="h-1.5 w-full flex overflow-hidden">
                      {(['easy','medium','hard','expert'] as const).map(lvl => {
                        const pct = (stats.levels[lvl] / stats.total) * 100;
                        if (!pct) return null;
                        return (
                          <div key={lvl} className={`${LEVEL_COLORS[lvl].bg} h-full animate-progress-fill`}
                            style={{ width: `${pct}%`, animationDelay: `${subjectIdx * 60 + 300}ms` }} />
                        );
                      })}
                    </div>
                  )}

                  {/* Expanded question list */}
                  {isOpen && (
                    <div className="border-t border-border/50 divide-y divide-border/30">
                      {subjectQs.map((q, i) => (
                        <div
                          key={q.id}
                          className="flex items-start justify-between gap-2 px-4 py-3 hover:bg-muted/40 transition-colors group/row"
                          style={{ animation: `stagger-in 0.3s ease both ${i * 30}ms` }}
                        >
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${LEVEL_COLORS[q.level]?.bg || 'bg-muted'} ${LEVEL_COLORS[q.level]?.text || ''}`}>
                              {LEVEL_COLORS[q.level]?.label || q.level}
                            </span>
                            <span className="text-sm truncate">{q.question}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity"
                            onClick={() => deleteQuestion(q.id)}>
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
