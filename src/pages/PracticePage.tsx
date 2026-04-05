import { useState, useEffect, useCallback } from 'react';
import { getSubjects, selectQuestions, saveSession as saveToStorage, addWrongQuestion, markCorrected, updateStats, getQuestions, addRecentIds } from '@/lib/storage';
import { Question, TestSession, Difficulty } from '@/types/mcq';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, BookOpen, Maximize2, Minimize2, Minus, Plus, PlayCircle } from 'lucide-react';
import FormattedText from '@/components/FormattedText';
import ResultCelebration from '@/components/ResultCelebration';
import { saveSession as persistSession, loadSession, clearSession } from '@/hooks/usePersistedExam';

type Phase = 'setup' | 'quiz' | 'result';

const LEVEL_COLORS: Record<string, string> = {
  easy: 'bg-success', medium: 'bg-warning', hard: 'bg-orange-500', expert: 'bg-destructive'
};

function DonutChart({ pct, size = 110 }: { pct: number; size?: number }) {
  const r = 42, circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimated(pct), 100); return () => clearTimeout(t); }, [pct]);
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebData, setCelebData] = useState<{ pct: number; score: number; total: number; xp: number } | null>(null);
  const [hasResumable, setHasResumable] = useState(false);

  const allQuestions = getQuestions();

  useEffect(() => {
    setSubjects(getSubjects());
    // Check for resumable session
    const saved = loadSession('practice');
    if (saved && saved.type === 'practice' && saved.phase === 'quiz') {
      setHasResumable(true);
    }
  }, []);

  // Compute available counts
  const getAvailable = (subj: string, lvl: Difficulty | 'mixed') =>
    allQuestions.filter(q => (subj === 'all' || q.subject === subj) && (lvl === 'mixed' || q.level === lvl)).length;
  const available = getAvailable(subject, level);
  const levelCounts = (['easy', 'medium', 'hard', 'expert'] as const).map(lvl => ({
    lvl, count: allQuestions.filter(q => (subject === 'all' || q.subject === subject) && q.level === lvl).length
  })).filter(x => x.count > 0);

  // Fullscreen
  const enterFullscreen = () => { document.documentElement.requestFullscreen?.().catch(() => {}); setIsFullscreen(true); };
  const exitFullscreen = () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); setIsFullscreen(false); };
  useEffect(() => {
    const fn = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, []);
  useEffect(() => { if (phase !== 'quiz' && isFullscreen) exitFullscreen(); }, [phase]);

  // Persist state whenever quiz state changes
  useEffect(() => {
    if (phase !== 'quiz' || questions.length === 0) return;
    persistSession({
      type: 'practice', phase: 'quiz',
      subject, level,
      questions, answers, currentIdx,
      startedAt: Date.now(), savedAt: Date.now(),
    });
  }, [phase, questions, answers, currentIdx, subject, level]);

  // Resume a saved session
  const resumeSession = () => {
    const saved = loadSession('practice');
    if (!saved || saved.type !== 'practice') return;
    setQuestions(saved.questions);
    setAnswers(saved.answers);
    setCurrentIdx(saved.currentIdx);
    setSubject(saved.subject);
    setLevel(saved.level as any);
    setShowExplanation(saved.answers[saved.questions[saved.currentIdx]?.id] !== undefined);
    setPhase('quiz');
    setHasResumable(false);
    enterFullscreen();
  };

  const startPractice = () => {
    const n = Math.min(count, available);
    if (n === 0) return;
    const selected = selectQuestions(n, subject, level);
    if (!selected.length) return;
    clearSession('practice');
    setQuestions(selected); setCurrentIdx(0); setAnswers({}); setShowExplanation(false);
    setHasResumable(false);
    setPhase('quiz');
    enterFullscreen();
  };

  const finishPractice = useCallback((qs: Question[], ans: Record<string, number | null>) => {
    clearSession('practice');
    const score = qs.filter(q => ans[q.id] === q.answer).length;
    const s: TestSession = {
      id: crypto.randomUUID(), type: 'practice',
      subject: subject === 'all' ? 'Mixed' : subject, level,
      questionIds: qs.map(q => q.id), answers: ans,
      score, total: qs.length, date: new Date().toISOString(), duration: 0, completed: true,
    };
    saveToStorage(s); addRecentIds(qs.map(q => q.id));
    const result = updateStats(s, getQuestions());
    setSession(s);
    const pct = Math.round((score / qs.length) * 100);
    setCelebData({ pct, score, total: qs.length, xp: result.xpGained });
    setShowCelebration(true);
    setPhase('result');
  }, [subject, level]);

  const nextQuestion = useCallback((qs: Question[], ans: Record<string, number | null>, idx: number) => {
    if (idx < qs.length - 1) {
      setCurrentIdx(idx + 1);
      setShowExplanation(false);
    } else {
      finishPractice(qs, ans);
    }
  }, [finishPractice]);

  const selectAnswer = useCallback((optionIdx: number) => {
    const q = questions[currentIdx];
    if (answers[q.id] !== undefined) return;
    const newAnswers = { ...answers, [q.id]: optionIdx };
    setAnswers(newAnswers);
    setShowExplanation(true);
    if (optionIdx !== q.answer) addWrongQuestion(q.id, q.subject);
    else markCorrected(q.id);
  }, [answers, questions, currentIdx]);

  const retryWrong = () => {
    const wrong = questions.filter(q => answers[q.id] !== q.answer);
    if (!wrong.length) return;
    clearSession('practice');
    setQuestions(wrong); setCurrentIdx(0); setAnswers({}); setShowExplanation(false);
    setPhase('quiz'); enterFullscreen();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== 'quiz') return;
      const q = questions[currentIdx]; if (!q) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= q.options.length && answers[q.id] === undefined) selectAnswer(num - 1);
      if (e.key === 'Enter' && showExplanation) nextQuestion(questions, answers, currentIdx);
      if (e.key === 'Escape') exitFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, currentIdx, showExplanation, answers, questions, selectAnswer, nextQuestion]);

  // ── SETUP ────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold shimmer-text">Practice Mode</h1>
          <p className="text-muted-foreground mt-1">Learn without pressure, review explanations</p>
        </div>

        {/* Resume banner */}
        {hasResumable && (
          <Card className="glass-card border-primary/40 animate-bounce-in">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <PlayCircle className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Resume Practice Session</p>
                  <p className="text-xs text-muted-foreground">You have an unfinished practice session</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={resumeSession}>Resume</Button>
                <Button size="sm" variant="ghost" onClick={() => { clearSession(); setHasResumable(false); }}>Discard</Button>
              </div>
            </CardContent>
          </Card>
        )}

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
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Questions</label>
                <span className="text-xs text-muted-foreground">{available} available</span>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <button onClick={() => setCount(c => Math.max(1, c - 5))} disabled={count <= 1}
                  className="h-9 w-9 rounded-xl border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40">
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex-1 text-center">
                  <span className="text-4xl font-bold tabular-nums">{Math.min(count, available || 1)}</span>
                </div>
                <button onClick={() => setCount(c => Math.min(available, c + 5))} disabled={count >= available}
                  className="h-9 w-9 rounded-xl border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40">
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

            <Button className="w-full gap-2" size="lg" onClick={startPractice} disabled={available === 0}>
              <BookOpen className="h-4 w-4" />
              {available === 0 ? 'No questions available' : `Start Practice · ${Math.min(count, available)} Qs`}
              <Maximize2 className="h-3.5 w-3.5 opacity-60" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">Opens in fullscreen · if you leave, your progress is saved</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── RESULT ───────────────────────────────────────────────────
  if (phase === 'result' && session) {
    const pct = Math.round((session.score / session.total) * 100);
    const wrongCount = session.total - session.score;
    const byLevel = (['easy', 'medium', 'hard', 'expert'] as const).map(lvl => {
      const qs = questions.filter(q => q.level === lvl);
      return { lvl, total: qs.length, correct: qs.filter(q => answers[q.id] === q.answer).length };
    }).filter(x => x.total > 0);

    return (
      <>
        {showCelebration && celebData && (
          <ResultCelebration pct={celebData.pct} score={celebData.score} total={celebData.total}
            xpGained={celebData.xp} onDone={() => setShowCelebration(false)} />
        )}
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
                    <div><p className="text-lg font-bold text-primary">+{(celebData?.xp || 0)}</p><p className="text-xs text-muted-foreground">XP</p></div>
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

          <Card className="glass-card animate-fade-in" style={{ animationDelay: '250ms' }}>
            <CardHeader><CardTitle className="text-sm font-medium">Question Trail</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {questions.map((q, i) => {
                  const correct = answers[q.id] === q.answer;
                  return (
                    <div key={q.id} title={`Q${i + 1}: ${correct ? 'Correct' : 'Wrong'}`}
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${correct ? 'bg-success' : 'bg-destructive'}`}
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
                        <div key={oi} className={`px-3 py-1.5 rounded-md flex items-center gap-2 ${oi === q.answer ? 'bg-success/10 text-success font-medium' : oi === userAns ? 'bg-destructive/10 text-destructive line-through' : 'text-muted-foreground'}`}>
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
      </>
    );
  }

  // ── QUIZ ─────────────────────────────────────────────────────
  const q = questions[currentIdx];
  const userAnswer = answers[q?.id];
  const progress = ((currentIdx + 1) / questions.length) * 100;

  return (
    <div className={isFullscreen ? 'fullscreen-quiz' : 'max-w-2xl mx-auto py-4'}>
      <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{q.subject} · {q.level}</Badge>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{currentIdx + 1} / {questions.length}</span>
            <button onClick={isFullscreen ? exitFullscreen : enterFullscreen}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

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
              />
            );
          })}
        </div>

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
                <Button onClick={() => nextQuestion(questions, answers, currentIdx)} className="gap-2">
                  {currentIdx < questions.length - 1 ? <>Next <ArrowRight className="h-4 w-4" /></> : 'Finish 🎉'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-center text-muted-foreground">1–{q.options.length} answer · Enter continue · Esc exit fullscreen · progress auto-saved</p>
      </div>
    </div>
  );
}
