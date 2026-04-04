import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubjects, selectQuestions, saveSession, addWrongQuestion, markCorrected, updateStats, getQuestions, addRecentIds } from '@/lib/storage';
import { Question, TestSession, Difficulty } from '@/types/mcq';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, BookOpen, List, ChevronDown, ChevronUp } from 'lucide-react';
import FormattedText from '@/components/FormattedText';

type Phase = 'setup' | 'quiz' | 'result';

// Mini donut chart for result screen
function DonutChart({ pct, size = 120 }: { pct: number; size?: number }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4}
        strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="bold" fill={color}>{pct}%</text>
    </svg>
  );
}

// Bar chart row for per-question results
function QuestionBar({ correct, idx, total }: { correct: boolean; idx: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-5">{idx + 1}</span>
      <div className={`h-3 rounded-full flex-1 ${correct ? 'bg-success' : 'bg-destructive'}`} style={{ maxWidth: `${100}%` }} />
      {correct ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
    </div>
  );
}

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

  // Subject question browser
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserSubject, setBrowserSubject] = useState('all');
  const [browserExpanded, setBrowserExpanded] = useState<string | null>(null);
  const allQuestions = getQuestions();

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
    if (optionIdx !== q.answer) addWrongQuestion(q.id, q.subject);
    else markCorrected(q.id);
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== 'quiz') return;
      const q = questions[currentIdx];
      if (!q) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= q.options.length && answers[q.id] === undefined) selectAnswer(num - 1);
      if (e.key === 'Enter' && showExplanation) nextQuestion();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, currentIdx, showExplanation, answers, questions, selectAnswer, nextQuestion]);

  // ── SETUP PHASE ──────────────────────────────────────────────────────────
  if (phase === 'setup') {
    const browserQs = browserSubject === 'all' ? allQuestions : allQuestions.filter(q => q.subject === browserSubject);
    const groupedBySubject = subjects.reduce<Record<string, Question[]>>((acc, s) => {
      acc[s] = allQuestions.filter(q => q.subject === s);
      return acc;
    }, {});

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Practice Mode</h1>
          <p className="text-muted-foreground mt-1">Learn without pressure, review explanations</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Setup card */}
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base">Configure Session</CardTitle></CardHeader>
            <CardContent className="space-y-4">
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

          {/* Question browser */}
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <List className="h-4 w-4" /> Question Bank
                  <Badge variant="secondary">{allQuestions.length}</Badge>
                </CardTitle>
                <Select value={browserSubject} onValueChange={setBrowserSubject}>
                  <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {(browserSubject === 'all' ? subjects : [browserSubject]).map(subj => {
                const qs = groupedBySubject[subj] || [];
                const isOpen = browserExpanded === subj;
                return (
                  <div key={subj} className="border border-border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-3 text-sm hover:bg-muted/50 transition-colors"
                      onClick={() => setBrowserExpanded(isOpen ? null : subj)}
                    >
                      <span className="font-medium">{subj}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{qs.length} Qs</Badge>
                        <div className="flex gap-1">
                          {(['easy','medium','hard','expert'] as const).map(lvl => {
                            const c = qs.filter(q => q.level === lvl).length;
                            if (!c) return null;
                            const colors: Record<string, string> = { easy: 'bg-success/80', medium: 'bg-warning/80', hard: 'bg-orange-500/80', expert: 'bg-destructive/80' };
                            return <span key={lvl} className={`text-[10px] px-1 rounded text-white ${colors[lvl]}`}>{c}</span>;
                          })}
                        </div>
                        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-border divide-y divide-border/50">
                        {qs.map((q, i) => (
                          <div key={q.id} className="px-3 py-2 text-xs hover:bg-muted/30">
                            <div className="flex items-start gap-2">
                              <span className="text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
                              <span className="flex-1 text-foreground line-clamp-2">{q.question}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">{q.level}</Badge>
                            </div>
                            <div className="mt-1.5 pl-4 space-y-0.5">
                              {q.options.map((opt, oi) => (
                                <div key={oi} className={`flex items-center gap-1 ${oi === q.answer ? 'text-success font-medium' : 'text-muted-foreground'}`}>
                                  {oi === q.answer ? '✓' : '·'} <FormattedText text={opt} />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {allQuestions.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">No questions yet. Import some to get started!</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── RESULT PHASE ─────────────────────────────────────────────────────────
  if (phase === 'result' && session) {
    const pct = Math.round((session.score / session.total) * 100);
    const wrongCount = session.total - session.score;
    const byLevel = (['easy','medium','hard','expert'] as const).map(lvl => {
      const qs = questions.filter(q => q.level === lvl);
      const correct = qs.filter(q => answers[q.id] === q.answer).length;
      return { lvl, total: qs.length, correct };
    }).filter(x => x.total > 0);

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Score card */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <DonutChart pct={pct} size={110} />
              <div className="flex-1 space-y-2">
                <h2 className="text-xl font-bold">{pct >= 80 ? '🎉 Excellent!' : pct >= 60 ? '👍 Good job!' : '💪 Keep going!'}</h2>
                <p className="text-muted-foreground text-sm">{session.score} correct out of {session.total} questions</p>
                <div className="flex gap-3 mt-2">
                  <div className="text-center">
                    <p className="text-lg font-bold text-success">{session.score}</p>
                    <p className="text-xs text-muted-foreground">Correct</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-destructive">{wrongCount}</p>
                    <p className="text-xs text-muted-foreground">Wrong</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-primary">+{session.score * 10}{session.score === session.total ? '+50' : ''}</p>
                    <p className="text-xs text-muted-foreground">XP earned</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance by difficulty */}
        {byLevel.length > 0 && (
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm font-medium">Performance by Difficulty</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {byLevel.map(({ lvl, total, correct }) => {
                const lvlPct = Math.round((correct / total) * 100);
                const colors: Record<string, string> = { easy: 'bg-success', medium: 'bg-warning', hard: 'bg-orange-500', expert: 'bg-destructive' };
                return (
                  <div key={lvl}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize font-medium">{lvl}</span>
                      <span className="text-muted-foreground">{correct}/{total} — {lvlPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${colors[lvl]}`} style={{ width: `${lvlPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Question-by-question mini bars */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-sm font-medium">Question Results</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {questions.map((q, i) => (
                <QuestionBar key={q.id} correct={answers[q.id] === q.answer} idx={i} total={questions.length} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-center flex-wrap">
          {wrongCount > 0 && (
            <Button variant="outline" onClick={retryWrong}>
              <RotateCcw className="h-4 w-4 mr-2" /> Retry Wrong ({wrongCount})
            </Button>
          )}
          <Button onClick={() => setPhase('setup')}>New Practice</Button>
        </div>

        {/* Detailed review */}
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Detailed Review</h2>
          {questions.map((q, i) => {
            const userAns = answers[q.id];
            const correct = userAns === q.answer;
            return (
              <Card key={q.id} className={`glass-card border-l-4 ${correct ? 'border-l-success' : 'border-l-destructive'}`}>
                <CardContent className="p-4">
                  <p className="font-medium text-sm mb-3">{i + 1}. <FormattedText text={q.question} /></p>
                  <div className="space-y-1 text-sm">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className={`px-3 py-1.5 rounded-md flex items-center gap-2 ${
                        oi === q.answer ? 'bg-success/10 text-success font-medium' :
                        oi === userAns && oi !== q.answer ? 'bg-destructive/10 text-destructive line-through' :
                        'text-muted-foreground'
                      }`}>
                        {oi === q.answer ? '✓' : oi === userAns ? '✗' : ' '}
                        <FormattedText text={opt} />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 italic p-2 bg-muted/40 rounded"><FormattedText text={q.explanation} /></p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ── QUIZ PHASE ────────────────────────────────────────────────────────────
  const q = questions[currentIdx];
  const userAnswer = answers[q?.id];
  const progress = ((currentIdx + 1) / questions.length) * 100;
  const answeredSoFar = Object.keys(answers).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{q.subject} • {q.level}</Badge>
        <span className="text-sm text-muted-foreground">{currentIdx + 1} / {questions.length}</span>
      </div>
      <Progress value={progress} className="h-1.5" />

      {/* Mini progress dots */}
      <div className="flex gap-1 flex-wrap">
        {questions.map((qi, i) => {
          const ans = answers[qi.id];
          const isDone = ans !== undefined;
          const isCorrect = ans === qi.answer;
          return (
            <button key={qi.id} onClick={() => { setCurrentIdx(i); setShowExplanation(answers[qi.id] !== undefined); }}
              className={`h-2 rounded-full transition-all ${i === currentIdx ? 'w-6 bg-primary' : isDone ? (isCorrect ? 'w-2 bg-success' : 'w-2 bg-destructive') : 'w-2 bg-muted'}`}
              title={`Q${i + 1}`}
            />
          );
        })}
      </div>

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
                  <span className="h-7 w-7 rounded-full border flex items-center justify-center text-xs font-medium shrink-0">{i + 1}</span>
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
                {currentIdx < questions.length - 1 ? <>Next <ArrowRight className="h-4 w-4 ml-1" /></> : 'Finish'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-center text-muted-foreground">Press 1-{q.options.length} to answer, Enter to continue</p>
    </div>
  );
}
