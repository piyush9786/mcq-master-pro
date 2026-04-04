import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubjects, selectQuestions, saveSession, addWrongQuestion, markCorrected, updateStats, getQuestions, addRecentIds } from '@/lib/storage';
import { Question, TestSession, Difficulty } from '@/types/mcq';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import FormattedText from '@/components/FormattedText';

type Phase = 'setup' | 'quiz' | 'result';

export default function PracticePage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('setup');
  const [subject, setSubject] = useState('all');
  const [level, setLevel] = useState<Difficulty | 'mixed'>('mixed');
  const [count, setCount] = useState(10);
  const [subjects, setSubjects] = useState<string[]>([]);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [session, setSession] = useState<TestSession | null>(null);

  useEffect(() => { setSubjects(getSubjects()); }, []);

  const startPractice = () => {
    const selected = selectQuestions(count, subject, level);
    if (selected.length === 0) return;
    setQuestions(selected);
    setCurrentIdx(0);
    setAnswers({});
    setShowExplanation(false);
    setPhase('quiz');
  };

  // finishPractice declared first — nextQuestion depends on it
  const finishPractice = useCallback(() => {
    const score = questions.filter(q => answers[q.id] === q.answer).length;
    const s: TestSession = {
      id: crypto.randomUUID(),
      type: 'practice',
      subject: subject === 'all' ? 'Mixed' : subject,
      level,
      questionIds: questions.map(q => q.id),
      answers,
      score,
      total: questions.length,
      date: new Date().toISOString(),
      duration: 0,
      completed: true,
    };
    saveSession(s);
    addRecentIds(questions.map(q => q.id));
    updateStats(s, getQuestions());
    setSession(s);
    setPhase('result');
  }, [questions, answers, subject, level]);

  const nextQuestion = useCallback(() => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setShowExplanation(false);
    } else {
      finishPractice();
    }
  }, [currentIdx, questions.length, finishPractice]);

  const selectAnswer = useCallback((optionIdx: number) => {
    if (answers[questions[currentIdx].id] !== undefined) return;
    const q = questions[currentIdx];
    setAnswers(prev => ({ ...prev, [q.id]: optionIdx }));
    setShowExplanation(true);
    if (optionIdx !== q.answer) {
      addWrongQuestion(q.id, q.subject);
    } else {
      markCorrected(q.id);
    }
  }, [answers, questions, currentIdx]);

  const retryWrong = () => {
    const wrong = questions.filter(q => answers[q.id] !== q.answer);
    if (wrong.length === 0) return;
    setQuestions(wrong);
    setCurrentIdx(0);
    setAnswers({});
    setShowExplanation(false);
    setPhase('quiz');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== 'quiz') return;
      const q = questions[currentIdx];
      if (!q) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= q.options.length && answers[q.id] === undefined) {
        selectAnswer(num - 1);
      }
      if (e.key === 'Enter' && showExplanation) nextQuestion();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, currentIdx, showExplanation, answers, questions, selectAnswer, nextQuestion]);

  if (phase === 'setup') {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Practice Mode</h1>
          <p className="text-muted-foreground mt-1">Learn without pressure, review explanations</p>
        </div>
        <Card className="glass-card">
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject</label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Difficulty</label>
              <Select value={level} onValueChange={(v) => setLevel(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">Mixed</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Questions</label>
              <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 25, 30].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" size="lg" onClick={startPractice}>
              <BookOpen className="h-4 w-4 mr-2" /> Start Practice
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'result' && session) {
    const pct = Math.round((session.score / session.total) * 100);
    const wrongCount = session.total - session.score;
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <Card className="glass-card">
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-5xl font-bold">{pct}%</div>
            <p className="text-muted-foreground">{session.score} of {session.total} correct</p>
            <Progress value={pct} className="h-3" />
            <div className="flex gap-4 justify-center pt-4">
              {wrongCount > 0 && (
                <Button variant="outline" onClick={retryWrong}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Retry Wrong ({wrongCount})
                </Button>
              )}
              <Button onClick={() => setPhase('setup')}>
                New Practice
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Review */}
        <div className="space-y-3">
          <h2 className="font-semibold">Review</h2>
          {questions.map((q, i) => {
            const userAns = answers[q.id];
            const correct = userAns === q.answer;
            return (
              <Card key={q.id} className={`glass-card border-l-4 ${correct ? 'border-l-success' : 'border-l-destructive'}`}>
                <CardContent className="p-4">
                  <p className="font-medium text-sm mb-2">{i + 1}. <FormattedText text={q.question} /></p>
                  <div className="space-y-1 text-sm">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className={`px-2 py-1 rounded ${oi === q.answer ? 'bg-success/10 text-success font-medium' : oi === userAns && oi !== q.answer ? 'bg-destructive/10 text-destructive line-through' : 'text-muted-foreground'}`}>
                        <FormattedText text={opt} />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic"><FormattedText text={q.explanation} /></p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Quiz phase
  const q = questions[currentIdx];
  const userAnswer = answers[q?.id];
  const progress = ((currentIdx + 1) / questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{q.subject} • {q.level}</Badge>
        <span className="text-sm text-muted-foreground">{currentIdx + 1} / {questions.length}</span>
      </div>
      <Progress value={progress} className="h-1.5" />

      <Card className="glass-card">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-6"><FormattedText text={q.question} /></h2>
          <div className="space-y-3">
            {q.options.map((opt, i) => {
              const isSelected = userAnswer === i;
              const isCorrect = i === q.answer;
              const answered = userAnswer !== undefined;
              let cls = 'border border-border rounded-lg p-4 cursor-pointer transition-all text-sm';
              if (answered) {
                if (isCorrect) cls += ' bg-success/10 border-success';
                else if (isSelected) cls += ' bg-destructive/10 border-destructive';
                else cls += ' opacity-50';
              } else {
                cls += ' hover:border-primary hover:bg-primary/5';
              }
              return (
                <button key={i} className={cls + ' w-full text-left flex items-center gap-3'} onClick={() => selectAnswer(i)}>
                  <span className="h-7 w-7 rounded-full border flex items-center justify-center text-xs font-medium shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1"><FormattedText text={opt} /></span>
                  {answered && isCorrect && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
                  {answered && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                </button>
              );
            })}
          </div>

          {showExplanation && (
            <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border animate-fade-in">
              <p className="text-sm font-medium mb-1">Explanation</p>
              <p className="text-sm text-muted-foreground"><FormattedText text={q.explanation} /></p>
            </div>
          )}

          {showExplanation && (
            <div className="mt-4 flex justify-end">
              <Button onClick={nextQuestion}>
                {currentIdx < questions.length - 1 ? (
                  <>Next <ArrowRight className="h-4 w-4 ml-1" /></>
                ) : (
                  'Finish'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-center text-muted-foreground">Press 1-{q.options.length} to answer, Enter to continue</p>
    </div>
  );
}
