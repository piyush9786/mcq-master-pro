import { useState, useEffect, useRef, useCallback } from 'react';
import { getSubjects, selectQuestions, saveSession as saveToStorage, addWrongQuestion, updateStats, getQuestions, addRecentIds } from '@/lib/storage';
import { Question, TestSession, Difficulty } from '@/types/mcq';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Timer, ArrowRight, ArrowLeft, SkipForward, Maximize2, Minimize2, Minus, Plus, Eye, AlertTriangle, PlayCircle } from 'lucide-react';
import FormattedText from '@/components/FormattedText';
import ResultCelebration from '@/components/ResultCelebration';
import { saveSession as persistSession, loadSession, clearSession, correctTimerDrift } from '@/hooks/usePersistedExam';

type Phase = 'setup' | 'quiz' | 'result';

const LEVEL_COLORS: Record<string, string> = {
  easy: 'bg-success', medium: 'bg-warning', hard: 'bg-orange-500', expert: 'bg-destructive'
};

export default function ExamPage() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [subject, setSubject] = useState('all');
  const [level, setLevel] = useState<Difficulty | 'mixed'>('mixed');
  const [count, setCount] = useState(10);
  const [timePerQ, setTimePerQ] = useState(60);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [session, setSession] = useState<TestSession | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabWarnings, setTabWarnings] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [showUnansweredWarning, setShowUnansweredWarning] = useState(false);
  const [unansweredIds, setUnansweredIds] = useState<string[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{ pct: number; score: number; total: number; xp: number } | null>(null);
  const [hasResumable, setHasResumable] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();
  const answersRef = useRef<Record<string, number | null>>({});
  const questionsRef = useRef<Question[]>([]);
  const timeLeftRef = useRef(0);
  const tabWarningsRef = useRef(0);

  const allQuestions = getQuestions();
  useEffect(() => {
    setSubjects(getSubjects());
    const saved = loadSession('exam');
    if (saved && saved.phase === 'quiz') setHasResumable(true);
  }, []);

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

  // Persist state every 5 seconds during quiz
  useEffect(() => {
    if (phase !== 'quiz' || questions.length === 0) return;
    const save = () => {
      persistSession({
        type: 'exam', phase: 'quiz',
        subject, level,
        questions, answers: answersRef.current, currentIdx,
        flagged: [...flagged],
        timeLeft: timeLeftRef.current,
        totalTime,
        tabWarnings: tabWarningsRef.current,
        startedAt: Date.now(), savedAt: Date.now(),
      });
    };
    save(); // save immediately
    const interval = setInterval(save, 5000);
    return () => clearInterval(interval);
  }, [phase, questions, currentIdx, flagged, totalTime, subject, level]);

  // Tab-switch detection — exam continues, just warns
  useEffect(() => {
    if (phase !== 'quiz') return;
    const onVisibility = () => {
      if (document.hidden) {
        tabWarningsRef.current++;
        setTabWarnings(tabWarningsRef.current);
        setShowTabWarning(true);
        setTimeout(() => setShowTabWarning(false), 3500);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase]);

  // finishExam (must be declared before nextQuestion)
  const finishExam = useCallback(() => {
    clearInterval(timerRef.current);
    clearSession('exam');
    const curAnswers = answersRef.current;
    const curQuestions = questionsRef.current;
    const allQs = getQuestions();
    const score = curQuestions.filter(q => curAnswers[q.id] === q.answer).length;
    curQuestions.forEach(q => { if (curAnswers[q.id] !== q.answer) addWrongQuestion(q.id, q.subject); });
    const s: TestSession = {
      id: crypto.randomUUID(), type: 'exam',
      subject: subject === 'all' ? 'Mixed' : subject, level,
      questionIds: curQuestions.map(q => q.id), answers: curAnswers,
      score, total: curQuestions.length,
      date: new Date().toISOString(),
      duration: totalTime - timeLeftRef.current,
      completed: true,
    };
    saveToStorage(s); addRecentIds(curQuestions.map(q => q.id));
    const result = updateStats(s, allQs);
    setSession(s);
    const pct = Math.round((score / curQuestions.length) * 100);
    setCelebrationData({ pct, score, total: curQuestions.length, xp: result.xpGained });
    setShowCelebration(true);
    setPhase('result');
  }, [subject, level, totalTime]);

  // Submit with unanswered check
  const trySubmit = useCallback(() => {
    const unanswered = questionsRef.current.filter(
      q => answersRef.current[q.id] === undefined || answersRef.current[q.id] === null
    );
    if (unanswered.length > 0) {
      setUnansweredIds(unanswered.map(q => q.id));
      setShowUnansweredWarning(true);
      const idx = questionsRef.current.findIndex(q => q.id === unanswered[0].id);
      setCurrentIdx(idx);
      setTimeout(() => setShowUnansweredWarning(false), 4000);
    } else {
      finishExam();
    }
  }, [finishExam]);

  const prevQuestion = useCallback(() => { if (currentIdx > 0) setCurrentIdx(p => p - 1); }, [currentIdx]);
  const skipAndFlag = useCallback(() => {
    const q = questions[currentIdx];
    setFlagged(p => new Set(p).add(q.id));
    if (currentIdx < questions.length - 1) setCurrentIdx(p => p + 1);
  }, [questions, currentIdx]);
  const nextQuestion = useCallback(() => {
    if (currentIdx < questions.length - 1) setCurrentIdx(p => p + 1);
    else trySubmit();
  }, [currentIdx, questions.length, trySubmit]);
  const selectAnswer = useCallback((optionIdx: number) => {
    const q = questions[currentIdx];
    answersRef.current = { ...answersRef.current, [q.id]: optionIdx };
    setAnswers(p => ({ ...p, [q.id]: optionIdx }));
    setUnansweredIds(prev => prev.filter(id => id !== q.id));
  }, [questions, currentIdx]);

  // Start a fresh exam
  const startExam = (qs: Question[], tl: number, tt: number, existingAnswers = {}, existingFlagged = new Set<string>(), existingIdx = 0, existingTabWarnings = 0) => {
    questionsRef.current = qs;
    answersRef.current = existingAnswers as Record<string, number | null>;
    timeLeftRef.current = tl;
    tabWarningsRef.current = existingTabWarnings;
    setQuestions(qs); setCurrentIdx(existingIdx);
    setAnswers(existingAnswers as Record<string, number | null>);
    setFlagged(existingFlagged);
    setTimeLeft(tl); setTotalTime(tt);
    setTabWarnings(existingTabWarnings);
    setUnansweredIds([]); setShowTabWarning(false); setShowUnansweredWarning(false);
    setPhase('quiz');
    enterFullscreen();
  };

  const handleStartNew = () => {
    const n = Math.min(count, available);
    if (n === 0) return;
    const selected = selectQuestions(n, subject, level);
    if (!selected.length) return;
    clearSession('exam');
    setHasResumable(false);
    const tt = selected.length * timePerQ;
    startExam(selected, tt, tt);
  };

  const resumeSession = () => {
    const saved = loadSession('exam');
    if (!saved) return;
    const correctedTime = correctTimerDrift(saved);
    startExam(
      saved.questions,
      correctedTime,
      saved.totalTime || saved.questions.length * 60,
      saved.answers,
      new Set(saved.flagged || []),
      saved.currentIdx,
      saved.tabWarnings || 0
    );
    setSubject(saved.subject);
    setLevel(saved.level as any);
    setHasResumable(false);
  };

  // Timer — uses ref to avoid stale closure
  useEffect(() => {
    if (phase !== 'quiz') return;
    timerRef.current = setInterval(() => {
      timeLeftRef.current = Math.max(0, timeLeftRef.current - 1);
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) finishExam();
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, finishExam]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== 'quiz') return;
      const q = questions[currentIdx];
      const num = parseInt(e.key);
      if (num >= 1 && num <= q.options.length) selectAnswer(num - 1);
      if (e.key === 'Enter') nextQuestion();
      if (e.key === 'ArrowLeft') prevQuestion();
      if (e.key === 's' || e.key === 'S') skipAndFlag();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, currentIdx, questions, selectAnswer, nextQuestion, prevQuestion, skipAndFlag]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const timeProgress = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;

  // ── SETUP ─────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold shimmer-text">Exam Mode</h1>
          <p className="text-muted-foreground mt-1">Timed assessment, no peeking at answers</p>
        </div>

        {/* Resume banner */}
        {hasResumable && (
          <Card className="glass-card border-primary/40 animate-bounce-in">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <PlayCircle className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Resume Exam Session</p>
                  <p className="text-xs text-muted-foreground">Your exam was saved — continue from where you left off</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={resumeSession}>Resume</Button>
                <Button size="sm" variant="ghost" onClick={() => { clearSession('exam'); setHasResumable(false); }}>Discard</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="glass-card animate-scale-in" style={{ animationDelay: '80ms' }}>
          <CardContent className="p-6 space-y-5">
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
            {levelCounts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Available by level</p>
                <div className="flex flex-wrap gap-1.5">
                  {levelCounts.map(({ lvl, count: c }) => (
                    <button key={lvl} onClick={() => setLevel(lvl)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${level === lvl ? `${LEVEL_COLORS[lvl]} text-white scale-105` : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                      {lvl} · {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                onChange={e => setCount(Number(e.target.value))} className="w-full accent-primary cursor-pointer" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>1</span><span>{available}</span></div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Time per Question</label>
              <div className="grid grid-cols-5 gap-1.5">
                {[30, 45, 60, 90, 120].map(t => (
                  <button key={t} onClick={() => setTimePerQ(t)}
                    className={`py-2 rounded-xl text-xs font-medium transition-all ${timePerQ === t ? 'bg-primary text-primary-foreground shadow' : 'bg-muted hover:bg-muted/80'}`}>
                    {t}s
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">Total: {formatTime(Math.min(count, available) * timePerQ)}</p>
            </div>
            <div className="rounded-xl bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">📋 Exam Rules</p>
              <p>• All questions must be answered before submitting</p>
              <p>• Tab switching is monitored — exam continues running</p>
              <p>• If you navigate away, your progress is auto-saved</p>
            </div>
            <Button className="w-full gap-2" size="lg" onClick={handleStartNew} disabled={available === 0}>
              <Timer className="h-4 w-4" />
              {available === 0 ? 'No questions available' : `Start Exam · ${Math.min(count, available)} Qs`}
              <Maximize2 className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────
  if (phase === 'result' && session) {
    const pct = Math.round((session.score / session.total) * 100);
    return (
      <>
        {showCelebration && celebrationData && (
          <ResultCelebration pct={celebrationData.pct} score={celebrationData.score}
            total={celebrationData.total} xpGained={celebrationData.xp}
            onDone={() => setShowCelebration(false)} />
        )}
        <div className="max-w-lg mx-auto space-y-5">
          <Card className="glass-card animate-bounce-in">
            <CardContent className="p-8 text-center space-y-4">
              <div className="text-6xl font-bold" style={{ color: pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>{pct}%</div>
              <p className="text-muted-foreground">{session.score} of {session.total} correct</p>
              <p className="text-sm text-muted-foreground">Time: {formatTime(session.duration)}</p>
              {tabWarnings > 0 && (
                <p className="text-xs text-warning flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> {tabWarnings} tab switch{tabWarnings > 1 ? 'es' : ''} detected
                </p>
              )}
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent animate-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex gap-4 justify-center pt-2">
                <Button variant="outline" onClick={() => setShowReview(!showReview)}>{showReview ? 'Hide Review' : 'Review Answers'}</Button>
                <Button onClick={() => setPhase('setup')}>New Exam</Button>
              </div>
            </CardContent>
          </Card>
          {showReview && (
            <div className="space-y-3">
              {questions.map((q, i) => {
                const userAns = answers[q.id];
                const correct = userAns === q.answer;
                return (
                  <Card key={q.id} className={`glass-card border-l-4 animate-fade-in ${correct ? 'border-l-success' : 'border-l-destructive'}`}
                    style={{ animationDelay: `${i * 40}ms` }}>
                    <CardContent className="p-4">
                      <p className="font-medium text-sm mb-2">{i + 1}. <FormattedText text={q.question} /></p>
                      <div className="space-y-1 text-sm">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className={`px-2 py-1 rounded ${oi === q.answer ? 'bg-success/10 text-success font-medium' : oi === userAns && oi !== q.answer ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground'}`}>
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
          )}
        </div>
      </>
    );
  }

  // ── QUIZ ──────────────────────────────────────────────────────
  const q = questions[currentIdx];
  const progress = ((currentIdx + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;
  const flaggedCount = flagged.size;
  const isLowTime = timeLeft < 30;
  const isUnanswered = unansweredIds.includes(q?.id);

  return (
    <div className={isFullscreen ? 'fullscreen-quiz' : 'max-w-2xl mx-auto py-4'}>
      <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">

        {/* Tab-switch toast */}
        {showTabWarning && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
            <div className="flex items-center gap-2 bg-warning text-warning-foreground px-5 py-3 rounded-2xl shadow-xl font-medium text-sm">
              <AlertTriangle className="h-4 w-4" />
              Tab switch #{tabWarnings} — exam continues, progress saved
            </div>
          </div>
        )}

        {/* Unanswered toast */}
        {showUnansweredWarning && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
            <div className="flex items-center gap-2 bg-destructive text-destructive-foreground px-5 py-3 rounded-2xl shadow-xl font-medium text-sm">
              <Eye className="h-4 w-4" />
              {unansweredIds.length} unanswered — please answer all before submitting!
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{q.subject} · {q.level}</Badge>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{answeredCount}/{questions.length}</span>
            {flaggedCount > 0 && <span className="text-xs text-warning">· {flaggedCount} flagged</span>}
            {tabWarnings > 0 && <span className="text-xs text-warning flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" />{tabWarnings}</span>}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-mono font-bold transition-all ${isLowTime ? 'bg-destructive/15 text-destructive animate-pulse' : 'bg-muted'}`}>
              <Timer className="h-3.5 w-3.5" />{formatTime(timeLeft)}
            </div>
            <button onClick={isFullscreen ? exitFullscreen : enterFullscreen}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Dual progress bars */}
        <div className="space-y-1">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${isLowTime ? 'bg-destructive' : 'bg-warning/60'}`} style={{ width: `${timeProgress}%` }} />
          </div>
        </div>

        {/* Question number grid */}
        <div className="flex flex-wrap gap-1.5">
          {questions.map((qi, i) => {
            const isAnswered = answers[qi.id] !== undefined;
            const isFlagged = flagged.has(qi.id);
            const isCurrent = i === currentIdx;
            const isUnans = unansweredIds.includes(qi.id);
            return (
              <button key={qi.id} onClick={() => setCurrentIdx(i)}
                className={`h-7 w-7 rounded-lg text-xs font-medium transition-all border ${
                  isCurrent ? 'border-primary bg-primary text-primary-foreground scale-110 shadow' :
                  isUnans ? 'border-destructive bg-destructive/15 text-destructive animate-pulse' :
                  isFlagged ? 'border-warning bg-warning/10 text-warning' :
                  isAnswered ? 'border-success/50 bg-success/10 text-success' :
                  'border-border text-muted-foreground hover:border-primary'
                }`}>
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Question card */}
        <Card className={`glass-card transition-all ${isUnanswered ? 'ring-2 ring-destructive/50' : ''}`}>
          <CardContent className="p-6">
            {isUnanswered && (
              <div className="flex items-center gap-2 text-destructive text-xs mb-3 font-medium animate-fade-in">
                <AlertTriangle className="h-3.5 w-3.5" /> Answer this question before submitting
              </div>
            )}
            <h2 className="text-lg font-semibold mb-6 leading-relaxed"><FormattedText text={q.question} /></h2>
            <div className="space-y-3">
              {q.options.map((opt, i) => {
                const isSelected = answers[q.id] === i;
                return (
                  <button key={i}
                    className={`w-full text-left flex items-center gap-3 border rounded-xl p-4 text-sm transition-all duration-200 ${isSelected ? 'border-primary bg-primary/10 shadow-sm' : 'border-border hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5'}`}
                    onClick={() => selectAnswer(i)}
                    style={{ animation: `stagger-in 0.3s ease both ${i * 50}ms` }}>
                    <span className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${isSelected ? 'border-primary bg-primary text-white' : 'border-border'}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1"><FormattedText text={opt} /></span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={prevQuestion} disabled={currentIdx === 0}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <Button variant="outline" size="sm" onClick={skipAndFlag} disabled={currentIdx === questions.length - 1}>
                  <SkipForward className="h-4 w-4 mr-1" /> Skip
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={trySubmit}
                  className={unansweredIds.length > 0 ? 'border-destructive/50 text-destructive' : ''}>
                  {unansweredIds.length > 0 ? `Submit (${unansweredIds.length} left)` : 'Submit ✓'}
                </Button>
                <Button size="sm" onClick={nextQuestion}>
                  {currentIdx < questions.length - 1 ? <>Next <ArrowRight className="h-4 w-4 ml-1" /></> : 'Finish 🎉'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-center text-muted-foreground">1–{q.options.length} · ← prev · S skip · Enter next · progress auto-saved every 5s</p>
      </div>
    </div>
  );
}
