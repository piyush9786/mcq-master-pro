import { useState, useEffect, useCallback, useRef } from 'react';
import { getSubjects, selectQuestions, saveSession, addWrongQuestion, markCorrected, updateStats, getQuestions, addRecentIds } from '@/lib/storage';
import { Question, TestSession, Difficulty } from '@/types/mcq';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, BookOpen, List, ChevronDown, ChevronUp, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import FormattedText from '@/components/FormattedText';

type Phase = 'setup' | 'quiz' | 'result';

const LEVEL_COLORS: Record<string, string> = {
  easy: 'bg-success', medium: 'bg-warning', hard: 'bg-orange-500', expert: 'bg-destructive'
};

function DonutChart({ pct, size = 110 }: { pct: number; size?: number }) {
  const r = 42, circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 100);
    return () => clearTimeout(t);
  }, [pct]);
  const dash = (animated / 100) * circ;
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-muted/30" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9"
        strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4}
        strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s cubic-bezier(.4,0,.2,1)' }} />
      <text x="50" y="46" textAnchor="middle" dominantBaseline="middle" fontSize="19" fontWeight="bold" fill={color}>{pct}%</text>
      <text x="50" y="62" textAnchor="middle" fontSize="8" fill="#888">score</text>
    </svg>
  );
}

// Custom number stepper for question count
function QuestionStepper({ value, onChange, min, max, available }: {
  value: number; onChange: (v: number) => void; min: number; max: number; available: number;
}) {
  const pct = max > 0 ? Math.min((value / available) * 100, 100) : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Questions</label>
        <span className="text-xs text-muted-foreground">{available} available</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(min, value - 5))}
          className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
          disabled={value <= min}>
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 text-center">
          <span className="text-3xl font-bold tabular-nums">{Math.min(value, available)}</span>
        </div>
        <button onClick={() => onChange(Math.min(available, value + 5))}
          className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
          disabled={value >= available}>
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <input type="range" min={min} max={available || min} value={Math.min(value, available || min)}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-primary h-2 rounded-full cursor-pointer" />
      {/* Level availability bar */}
      <div className="space-y-1.5 pt-1">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">By Difficulty</p>
        {(['easy','medium','hard','expert'] as const).map(lvl => {
          const cnt = available > 0 ? Math.round((available * (pct / 100))) : 0; // placeholder
          return null; // shown in parent
        })}
      </div>
    </div>
  );
}

export default function PracticePage() {
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
  const [browserExpanded, setBrowserExpanded] = useState<string | null>(null);
  const [browserSubject, setBrowserSubject] = useState('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const quizRef = useRef<HTMLDivElement>(null);

  const allQuestions = getQuestions();
  useEffect(() => { setSubjects(getSubjects()); }, []);

  // Compute available counts per level for selected subject
  const getAvailable = (subj: string, lvl: Difficulty | 'mixed') => {
    return allQuestions.filter(q =>
      (subj === 'all' || q.subject === subj) &&
      (lvl === 'mixed' || q.level === lvl)
    ).length;
  };
  const available = getAvailable(subject, level);
  const levelCounts = (['easy','medium','hard','expert'] as const).map(lvl => ({
    lvl,
    count: allQuestions.filter(q => (subject === 'all' || q.subject === subject) && q.level === lvl).length
  })).filter(x => x.count > 0);

  // Fullscreen helpers
  const enterFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    setIsFullscreen(true);
  };
  const exitFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setIsFullscreen(false);
  };
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  // Exit fullscreen on leaving quiz
  useEffect(() => {
    if (phase !== 'quiz' && isFullscreen) exitFullscreen();
  }, [phase]);

  const startPractice = () => {
    const effectiveCount = Math.min(count, available);
    if (effectiveCount === 0) return;
    const selected = selectQuestions(effectiveCount, subject, level);
    if (selected.length === 0) return;
    setQuestions(selected);
    setCurrentIdx(0);
    setAnswers({});
    setShowExplanation(false);
    setPhase('quiz');
    enterFullscreen();
  };

  const finishPractice = useCallback(() => {
    const score = questions.filter(q => answers[q.id] === q.answer).length;
    const s: TestSession = {
      id: crypto.randomUUID(), type: 'practice',
      subject: subject === 'all' ? 'Mixed' : subject, level,
      questionIds: questions.map(q => q.id), answers, score,
      total: questions.length, date: new Date().toISOString(), duration: 0, completed: true,
    };
    saveSession(s); addRecentIds(questions.map(q => q.id)); updateStats(s, getQuestions());
    setSession(s); setPhase('result');
  }, [questions, answers, subject, level]);

  const nextQuestion = useCallback(() => {
    if (currentIdx < questions.length - 1) { setCurrentIdx(p => p + 1); setShowExplanation(false); }
    else finishPractice();
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
    if (!wrong.length) return;
    setQuestions(wrong); setCurrentIdx(0); setAnswers({}); setShowExplanation(false); setPhase('quiz');
    enterFullscreen();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== 'quiz') return;
      const q = questions[currentIdx]; if (!q) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= q.options.length && answers[q.id] === undefined) selectAnswer(num - 1);
      if (e.key === 'Enter' && showExplanation) nextQuestion();
      if (e.key === 'Escape') exitFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, currentIdx, showExplanation, answers, questions, selectAnswer, nextQuestion]);

  // ── SETUP ────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    const groupedBySubject = subjects.reduce<Record<string, Question[]>>((acc, s) => {
      acc[s] = allQuestions.filter(q => q.subject === s); return acc;
    }, {});

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold shimmer-text">Practice Mode</h1>
          <p className="text-muted-foreground mt-1">Learn without pressure, review explanations</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Config card */}
          <Card className="glass-card animate-scale-in" style={{ animationDelay: '80ms' }}>
            <CardHeader><CardTitle className="text-base">Configure Session</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Subject</label>
                <Select value={subject} onValueChange={v => { setSubject(v); setCount(Math.min(count, getAvailable(v, level))); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Difficulty</label>
                <Select value={level} onValueChange={v => { setLevel(v as any); setCount(Math.min(count, getAvailable(subject, v as any))); }}>
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

              {/* Level availability chips */}
              {levelCounts.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">Available by level</p>
                  <div className="flex flex-wrap gap-1.5">
                    {levelCounts.map(({ lvl, count: c }) => (
                      <button key={lvl} onClick={() => setLevel(lvl)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${level === lvl ? `${LEVEL_COLORS[lvl]} text-white scale-105 shadow` : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                        {lvl} · {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Question count stepper */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Questions</label>
                  <span className="text-xs text-muted-foreground">{available} available</span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <button onClick={() => setCount(c => Math.max(1, c - 5))}
                    className="h-9 w-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                    disabled={count <= 1}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-4xl font-bold tabular-nums animate-scale-in">{Math.min(count, available || 1)}</span>
                  </div>
                  <button onClick={() => setCount(c => Math.min(available, c + 5))}
                    className="h-9 w-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                    disabled={count >= available}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <input type="range" min={1} max={Math.max(1, available)} value={Math.min(count, available)}
                  onChange={e => setCount(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1</span><span>{available}</span>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={startPractice} disabled={available === 0}>
                <BookOpen className="h-4 w-4 mr-2" />
                {available === 0 ? 'No questions available' : `Start Practice · ${Math.min(count, available)} Qs`}
                <Maximize2 className="h-3.5 w-3.5 ml-2 opacity-60" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">Will open in fullscreen</p>
            </CardContent>
          </Card>

          {/* Question bank browser */}
          <Card className="glass-card animate-scale-in" style={{ animationDelay: '150ms' }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <List className="h-4 w-4" /> Question Bank
                  <Badge variant="secondary">{allQuestions.length}</Badge>
                </CardTitle>
                <Select value={browserSubject} onValueChange={setBrowserSubject}>
                  <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {(browserSubject === 'all' ? subjects : [browserSubject]).map((subj, si) => {
                const qs = groupedBySubject[subj] || [];
                const isOpen = browserExpanded === subj;
                const lvlCounts = (['easy','medium','hard','expert'] as const).map(l => ({ l, c: qs.filter(q => q.level === l).length }));
                return (
                  <div key={subj} className="border border-border rounded-xl overflow-hidden"
                    style={{ animation: `stagger-in 0.3s ease both ${si * 50}ms` }}>
                    <button className="w-full flex items-center justify-between p-3 text-sm hover:bg-muted/50 transition-colors"
                      onClick={() => setBrowserExpanded(isOpen ? null : subj)}>
                      <span className="font-medium">{subj}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{qs.length} Qs</span>
                        <div className="flex gap-0.5">
                          {lvlCounts.map(({ l, c }) => c > 0 && (
                            <span key={l} className={`text-[10px] font-bold px-1 rounded ${LEVEL_COLORS[l]} text-white`}>{c}</span>
                          ))}
                        </div>
                        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-border/50 divide-y divide-border/30">
                        {qs.map((q, i) => (
                          <div key={q.id} className="px-3 py-2.5 text-xs hover:bg-muted/30 transition-colors"
                            style={{ animation: `stagger-in 0.2s ease both ${i * 20}ms` }}>
                            <div className="flex items-start gap-2">
                              <span className={`mt-0.5 px-1.5 py-0.5 rounded text-white font-bold text-[10px] shrink-0 ${LEVEL_COLORS[q.level]}`}>{q.level[0].toUpperCase()}</span>
                              <span className="flex-1 line-clamp-2 text-foreground">{q.question}</span>
                            </div>
                            <div className="mt-1.5 pl-5 space-y-0.5">
                              {q.options.map((opt, oi) => (
                                <div key={oi} className={`flex items-center gap-1 ${oi === q.answer ? 'text-success font-semibold' : 'text-muted-foreground'}`}>
                                  <span>{oi === q.answer ? '✓' : '·'}</span>
                                  <FormattedText text={opt} />
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
                <p className="text-center text-muted-foreground text-sm py-8">No questions yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (phase === 'result' && session) {
    const pct = Math.round((session.score / session.total) * 100);
    const wrongCount = session.total - session.score;
    const byLevel = (['easy','medium','hard','expert'] as const).map(lvl => {
      const qs = questions.filter(q => q.level === lvl);
      return { lvl, total: qs.length, correct: qs.filter(q => answers[q.id] === q.answer).length };
    }).filter(x => x.total > 0);

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <Card className="glass-card animate-bounce-in">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <DonutChart pct={pct} />
              <div className="flex-1 space-y-2">
                <h2 className="text-xl font-bold">{pct >= 80 ? '🎉 Excellent!' : pct >= 60 ? '👍 Good job!' : '💪 Keep going!'}</h2>
                <p className="text-muted-foreground text-sm">{session.score} of {session.total} correct</p>
                <div className="flex gap-4 mt-1">
                  <div><p className="text-lg font-bold text-success">{session.score}</p><p className="text-xs text-muted-foreground">Correct</p></div>
                  <div><p className="text-lg font-bold text-destructive">{wrongCount}</p><p className="text-xs text-muted-foreground">Wrong</p></div>
                  <div><p className="text-lg font-bold text-primary">+{session.score * 10}{session.score === session.total ? '+50' : ''}</p><p className="text-xs text-muted-foreground">XP</p></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {byLevel.length > 0 && (
          <Card className="glass-card animate-fade-in" style={{ animationDelay: '150ms' }}>
            <CardHeader><CardTitle className="text-sm font-medium">By Difficulty</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {byLevel.map(({ lvl, total, correct }, i) => {
                const p = Math.round((correct / total) * 100);
                return (
                  <div key={lvl} style={{ animationDelay: `${200 + i * 80}ms` }}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize font-medium">{lvl}</span>
                      <span className="text-muted-foreground">{correct}/{total} — {p}%</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${LEVEL_COLORS[lvl]} animate-progress-fill`}
                        style={{ width: `${p}%`, animationDelay: `${300 + i * 80}ms` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Q-by-Q dots */}
        <Card className="glass-card animate-fade-in" style={{ animationDelay: '250ms' }}>
          <CardHeader><CardTitle className="text-sm font-medium">Question Trail</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {questions.map((q, i) => {
                const correct = answers[q.id] === q.answer;
                return (
                  <div key={q.id} title={`Q${i+1}: ${correct ? 'Correct' : 'Wrong'}`}
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all hover:scale-110 ${correct ? 'bg-success' : 'bg-destructive'}`}
                    style={{ animation: `bounce-in 0.4s ease both ${i * 30}ms` }}>
                    {i + 1}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-center flex-wrap animate-fade-in" style={{ animationDelay: '350ms' }}>
          {wrongCount > 0 && (
            <Button variant="outline" onClick={retryWrong}>
              <RotateCcw className="h-4 w-4 mr-2" /> Retry Wrong ({wrongCount})
            </Button>
          )}
          <Button onClick={() => setPhase('setup')}>New Practice</Button>
        </div>

        {/* Detailed review */}
        <div className="space-y-3">
          <h2 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Detailed Review</h2>
          {questions.map((q, i) => {
            const userAns = answers[q.id];
            const correct = userAns === q.answer;
            return (
              <Card key={q.id} className={`glass-card border-l-4 ${correct ? 'border-l-success' : 'border-l-destructive'} animate-fade-in`}
                style={{ animationDelay: `${i * 40}ms` }}>
                <CardContent className="p-4">
                  <p className="font-medium text-sm mb-3">{i + 1}. <FormattedText text={q.question} /></p>
                  <div className="space-y-1 text-sm">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${oi === q.answer ? 'bg-success/10 text-success font-medium' : oi === userAns ? 'bg-destructive/10 text-destructive line-through' : 'text-muted-foreground'}`}>
                        <span className="text-xs">{oi === q.answer ? '✓' : oi === userAns ? '✗' : ' '}</span>
                        <FormattedText text={opt} />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 italic p-2.5 bg-muted/40 rounded-lg">
                    <FormattedText text={q.explanation} />
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ── QUIZ (fullscreen) ─────────────────────────────────────────────────────
  const q = questions[currentIdx];
  const userAnswer = answers[q?.id];
  const progress = ((currentIdx + 1) / questions.length) * 100;

  return (
    <div className={isFullscreen ? 'fullscreen-quiz' : 'max-w-2xl mx-auto py-4'}>
      <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{q.subject} · {q.level}</Badge>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{currentIdx + 1} / {questions.length}</span>
            <button onClick={isFullscreen ? exitFullscreen : enterFullscreen}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>

        {/* Dot trail */}
        <div className="flex gap-1 flex-wrap">
          {questions.map((qi, i) => {
            const ans = answers[qi.id];
            const isDone = ans !== undefined;
            const isCorrect = ans === qi.answer;
            return (
              <button key={qi.id}
                onClick={() => { setCurrentIdx(i); setShowExplanation(answers[qi.id] !== undefined); }}
                className={`rounded-full transition-all duration-300 ${i === currentIdx ? 'w-6 h-2 bg-primary' : isDone ? `w-2 h-2 ${isCorrect ? 'bg-success' : 'bg-destructive'}` : 'w-2 h-2 bg-muted'}`}
                title={`Q${i+1}`}
              />
            );
          })}
        </div>

        {/* Question card */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-6 leading-relaxed animate-fade-in">
              <FormattedText text={q.question} />
            </h2>
            <div className="space-y-3">
              {q.options.map((opt, i) => {
                const isSelected = userAnswer === i;
                const isCorrect = i === q.answer;
                const answered = userAnswer !== undefined;
                let cls = 'border border-border rounded-xl p-4 cursor-pointer transition-all duration-200 text-sm w-full text-left flex items-center gap-3';
                if (answered) {
                  if (isCorrect) cls += ' bg-success/10 border-success shadow-sm';
                  else if (isSelected) cls += ' bg-destructive/10 border-destructive';
                  else cls += ' opacity-40';
                } else {
                  cls += ' hover:border-primary hover:bg-primary/5 hover:shadow-sm hover:-translate-y-0.5';
                }
                return (
                  <button key={i} className={cls} onClick={() => selectAnswer(i)}
                    style={{ animation: `stagger-in 0.3s ease both ${i * 50}ms` }}>
                    <span className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${answered && isCorrect ? 'border-success bg-success text-white' : answered && isSelected ? 'border-destructive bg-destructive text-white' : 'border-border'}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1"><FormattedText text={opt} /></span>
                    {answered && isCorrect && <CheckCircle2 className="h-5 w-5 text-success shrink-0 animate-bounce-in" />}
                    {answered && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-destructive shrink-0 animate-bounce-in" />}
                  </button>
                );
              })}
            </div>

            {showExplanation && (
              <div className="mt-5 p-4 rounded-xl bg-muted/50 border border-border animate-slide-right">
                <p className="text-sm font-semibold mb-1">Explanation</p>
                <p className="text-sm text-muted-foreground"><FormattedText text={q.explanation} /></p>
              </div>
            )}

            {showExplanation && (
              <div className="mt-4 flex justify-end animate-fade-in">
                <Button onClick={nextQuestion} className="gap-2">
                  {currentIdx < questions.length - 1 ? <>Next <ArrowRight className="h-4 w-4" /></> : 'Finish 🎉'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-center text-muted-foreground">1–{q.options.length} answer · Enter continue · Esc exit fullscreen</p>
      </div>
    </div>
  );
}
