import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, Upload, Download, Trash2, PlayCircle, CheckCircle2, XCircle,
  ArrowRight, ArrowLeft, Timer, AlertCircle, Copy, Plus, Maximize2,
  Minimize2, RotateCcw, Eye, SkipForward, AlertTriangle, BarChart2,
  BookX, ChevronDown, ChevronUp, Clock, Trophy,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getTestPapers, addTestPaper, deleteTestPaper, validateTestPaperBank,
  exportTestPapers, saveTestPaperSession, getTestPaperSessions,
  persistActiveTest, loadActiveTest, clearActiveTest,
} from '@/lib/testPaperStorage';
import { TestPaper, TestQuestion, TestPaperSession } from '@/types/mcq';
import FormattedText from '@/components/FormattedText';
import ResultCelebration from '@/components/ResultCelebration';

type Phase = 'list' | 'quiz' | 'result';
type ResultTab = 'summary' | 'wrong' | 'review';

// ── Animated donut ──────────────────────────────────────────────────────────
function DonutChart({ pct, size = 130 }: { pct: number; size?: number }) {
  const r = 48, circ = 2 * Math.PI * r;
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(pct), 150); return () => clearTimeout(t); }, [pct]);
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/30" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${(anim / 100) * circ} ${circ}`}
        strokeDashoffset={circ / 4} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)' }} />
      <text x="55" y="50" textAnchor="middle" dominantBaseline="middle" fontSize="22" fontWeight="bold" fill={color}>{pct}%</text>
      <text x="55" y="67" textAnchor="middle" fontSize="9" fill="#888">score</text>
    </svg>
  );
}

// ── Bar chart for per-question results ──────────────────────────────────────
function QuestionBar({ correct, idx }: { correct: boolean; idx: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-5 shrink-0">{idx + 1}</span>
      <div className={`h-2.5 flex-1 rounded-full ${correct ? 'bg-success' : 'bg-destructive'}`} />
      {correct
        ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
        : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
    </div>
  );
}

const SAMPLE_TEST_PAPER = JSON.stringify({
  version: '1.0', name: 'Sample Test Paper',
  questions: [
    { id: 't1', question: 'What is 2 + 2?', options: ['3', '4', '5', '6'], answer: 1, explanation: '2 + 2 = 4.' },
    { id: 't2', question: 'What is the capital of France?', options: ['London', 'Berlin', 'Paris', 'Madrid'], answer: 2, explanation: 'Paris is the capital of France.' },
    { id: 't3', question: 'Which planet is closest to the Sun?', options: ['Venus', 'Earth', 'Mercury', 'Mars'], answer: 2, explanation: 'Mercury is the closest planet to the Sun.' },
  ],
}, null, 2);

// ── Main component ──────────────────────────────────────────────────────────
export default function TestPapersPage() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('list');
  const [papers, setPapers] = useState<TestPaper[]>([]);
  const [jsonInput, setJsonInput] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [exportPaperId, setExportPaperId] = useState('all');

  // Quiz state
  const [activePaper, setActivePaper] = useState<TestPaper | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [session, setSession] = useState<TestPaperSession | null>(null);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebData, setCelebData] = useState<{ pct: number; score: number; total: number; xp: number } | null>(null);
  const [tabWarnings, setTabWarnings] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [showUnansweredWarning, setShowUnansweredWarning] = useState(false);
  const [unansweredIds, setUnansweredIds] = useState<string[]>([]);
  const [hasResumable, setHasResumable] = useState(false);

  // Result tab
  const [resultTab, setResultTab] = useState<ResultTab>('summary');

  const timerRef = useRef<NodeJS.Timeout>();
  const answersRef = useRef<Record<string, number | null>>({});
  const timeLeftRef = useRef(0);
  const tabWarningsRef = useRef(0);

  useEffect(() => {
    setPapers(getTestPapers());
    if (loadActiveTest()?.phase === 'quiz') setHasResumable(true);
  }, []);

  // Fullscreen
  const enterFullscreen = () => { document.documentElement.requestFullscreen?.().catch(() => {}); setIsFullscreen(true); };
  const exitFullscreen = () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); setIsFullscreen(false); };
  useEffect(() => {
    const fn = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, []);
  useEffect(() => { if (phase !== 'quiz' && isFullscreen) exitFullscreen(); }, [phase]);

  // Tab-switch detection
  useEffect(() => {
    if (phase !== 'quiz') return;
    const onVis = () => {
      if (document.hidden) {
        tabWarningsRef.current++;
        setTabWarnings(tabWarningsRef.current);
        setShowTabWarning(true);
        setTimeout(() => setShowTabWarning(false), 3500);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase]);

  // Persist every 5s
  useEffect(() => {
    if (phase !== 'quiz' || !activePaper) return;
    const save = () => persistActiveTest({
      phase: 'quiz', paperId: activePaper.id, paper: activePaper,
      answers: answersRef.current, currentIdx, flagged: [...flagged],
      timeLeft: timeLeftRef.current, totalTime,
      tabWarnings: tabWarningsRef.current, savedAt: Date.now(),
    });
    save();
    const iv = setInterval(save, 5000);
    return () => clearInterval(iv);
  }, [phase, activePaper, currentIdx, flagged, totalTime]);

  // Timer
  useEffect(() => {
    if (phase !== 'quiz' || totalTime === 0) return;
    timerRef.current = setInterval(() => {
      timeLeftRef.current = Math.max(0, timeLeftRef.current - 1);
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) finishTest();
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, totalTime]);

  // finishTest declared before nextQuestion / trySubmit
  const finishTest = useCallback(() => {
    clearInterval(timerRef.current);
    clearActiveTest();
    if (!activePaper) return;
    const curAnswers = answersRef.current;
    const qs = activePaper.questions;
    const score = qs.filter(q => curAnswers[q.id] === q.answer).length;
    const s: TestPaperSession = {
      id: crypto.randomUUID(), paperId: activePaper.id,
      questionIds: qs.map(q => q.id), answers: curAnswers,
      score, total: qs.length, date: new Date().toISOString(),
      duration: totalTime > 0 ? totalTime - timeLeftRef.current : 0, completed: true,
    };
    saveTestPaperSession(s);
    setSession(s);
    setResultTab('summary');
    const pct = Math.round((score / qs.length) * 100);
    setCelebData({ pct, score, total: qs.length, xp: score * 10 });
    setShowCelebration(true);
    setPhase('result');
  }, [activePaper, totalTime]);

  const trySubmit = useCallback(() => {
    if (!activePaper) return;
    const unanswered = activePaper.questions.filter(
      q => answersRef.current[q.id] === undefined || answersRef.current[q.id] === null
    );
    if (unanswered.length > 0) {
      setUnansweredIds(unanswered.map(q => q.id));
      setShowUnansweredWarning(true);
      setCurrentIdx(activePaper.questions.findIndex(q => q.id === unanswered[0].id));
      setTimeout(() => setShowUnansweredWarning(false), 4000);
    } else {
      finishTest();
    }
  }, [finishTest, activePaper]);

  const selectAnswer = useCallback((optionIdx: number) => {
    if (!activePaper) return;
    const q = activePaper.questions[currentIdx];
    answersRef.current = { ...answersRef.current, [q.id]: optionIdx };
    setAnswers(p => ({ ...p, [q.id]: optionIdx }));
    setUnansweredIds(prev => prev.filter(id => id !== q.id));
  }, [activePaper, currentIdx]);

  const nextQuestion = useCallback(() => {
    if (!activePaper) return;
    if (currentIdx < activePaper.questions.length - 1) setCurrentIdx(p => p + 1);
    else trySubmit();
  }, [currentIdx, activePaper, trySubmit]);

  const prevQuestion = useCallback(() => { if (currentIdx > 0) setCurrentIdx(p => p - 1); }, [currentIdx]);

  const skipAndFlag = useCallback(() => {
    if (!activePaper) return;
    const q = activePaper.questions[currentIdx];
    setFlagged(p => new Set(p).add(q.id));
    if (currentIdx < activePaper.questions.length - 1) setCurrentIdx(p => p + 1);
  }, [activePaper, currentIdx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== 'quiz' || !activePaper) return;
      const q = activePaper.questions[currentIdx];
      const num = parseInt(e.key);
      if (num >= 1 && num <= q.options.length) selectAnswer(num - 1);
      if (e.key === 'Enter') nextQuestion();
      if (e.key === 'ArrowLeft') prevQuestion();
      if (e.key === 's' || e.key === 'S') skipAndFlag();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, currentIdx, activePaper, selectAnswer, nextQuestion, prevQuestion, skipAndFlag]);

  const startTest = (paper: TestPaper) => {
    clearActiveTest();
    setActivePaper(paper); setCurrentIdx(0);
    answersRef.current = {}; setAnswers({});
    setFlagged(new Set()); setUnansweredIds([]);
    tabWarningsRef.current = 0; setTabWarnings(0);
    const tl = paper.timeLimit || 0;
    timeLeftRef.current = tl; setTimeLeft(tl); setTotalTime(tl);
    setHasResumable(false); setPhase('quiz'); enterFullscreen();
  };

  const resumeTest = () => {
    const saved = loadActiveTest();
    if (!saved) return;
    setActivePaper(saved.paper); setCurrentIdx(saved.currentIdx);
    answersRef.current = saved.answers; setAnswers(saved.answers);
    setFlagged(new Set(saved.flagged || []));
    tabWarningsRef.current = saved.tabWarnings || 0; setTabWarnings(saved.tabWarnings || 0);
    const elapsed = Math.floor((Date.now() - saved.savedAt) / 1000);
    const remaining = Math.max(0, (saved.timeLeft || 0) - elapsed);
    timeLeftRef.current = remaining; setTimeLeft(remaining); setTotalTime(saved.totalTime || 0);
    setHasResumable(false); setPhase('quiz'); enterFullscreen();
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(jsonInput);
      const result = validateTestPaperBank(data);
      if (!result.papers?.length) { setErrors(result.errors.length ? result.errors : ['No valid test papers found']); return; }
      result.papers.forEach(p => addTestPaper(p));
      setPapers(getTestPapers()); setJsonInput(''); setErrors([]); setShowImport(false);
      toast({ title: `✅ Imported ${result.papers.length} test paper(s)!` });
    } catch { setErrors(['❌ Invalid JSON — check syntax.']); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setJsonInput(ev.target?.result as string || '');
    reader.readAsText(file);
  };

  const handleExport = () => {
    const bank = exportTestPapers(exportPaperId);
    const blob = new Blob([JSON.stringify(bank, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `test-papers-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id: string) => {
    deleteTestPaper(id); setPapers(getTestPapers());
    toast({ title: 'Test paper deleted' });
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const formatDuration = (s: number) => s > 0 ? `${Math.floor(s / 60)}m ${s % 60}s` : '—';

  // ── QUIZ ─────────────────────────────────────────────────────────────────
  if (phase === 'quiz' && activePaper) {
    const q = activePaper.questions[currentIdx];
    const totalQs = activePaper.questions.length;
    const answeredCount = Object.keys(answers).length;
    const selected = answers[q.id];
    const timeProgress = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
    const isLowTime = totalTime > 0 && timeLeft < 60;
    const isUnanswered = unansweredIds.includes(q.id);
    const progress = ((currentIdx + 1) / totalQs) * 100;

    return (
      <div className={isFullscreen ? 'fullscreen-quiz' : 'max-w-2xl mx-auto py-4'}>
        <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
          {/* Toasts */}
          {showTabWarning && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
              <div className="flex items-center gap-2 bg-warning text-warning-foreground px-5 py-3 rounded-2xl shadow-xl font-medium text-sm">
                <AlertTriangle className="h-4 w-4" /> Tab switch #{tabWarnings} — exam continues
              </div>
            </div>
          )}
          {showUnansweredWarning && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
              <div className="flex items-center gap-2 bg-destructive text-destructive-foreground px-5 py-3 rounded-2xl shadow-xl font-medium text-sm">
                <AlertTriangle className="h-4 w-4" /> {unansweredIds.length} unanswered — please answer all!
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="max-w-[180px] truncate">{activePaper.title}</Badge>
              {tabWarnings > 0 && (
                <span className="text-xs text-warning flex items-center gap-0.5">
                  <AlertTriangle className="h-3 w-3" />{tabWarnings}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{answeredCount}/{totalQs} answered</span>
              {totalTime > 0 && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-mono font-bold ${isLowTime ? 'bg-destructive/15 text-destructive animate-pulse' : 'bg-muted'}`}>
                  <Timer className="h-3.5 w-3.5" />{formatTime(timeLeft)}
                </div>
              )}
              <button onClick={isFullscreen ? exitFullscreen : enterFullscreen}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Dual progress */}
          <div className="space-y-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            {totalTime > 0 && (
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${isLowTime ? 'bg-destructive' : 'bg-warning/60'}`} style={{ width: `${timeProgress}%` }} />
              </div>
            )}
          </div>

          {/* Question grid */}
          <div className="flex flex-wrap gap-1.5">
            {activePaper.questions.map((qq, i) => {
              const isAnswered = answers[qq.id] !== undefined;
              const isFlagged = flagged.has(qq.id);
              const isCurrent = i === currentIdx;
              const isUnans = unansweredIds.includes(qq.id);
              return (
                <button key={qq.id} onClick={() => setCurrentIdx(i)}
                  className={`h-7 w-7 rounded-lg text-xs font-medium transition-all border ${
                    isCurrent ? 'border-primary bg-primary text-primary-foreground scale-110 shadow' :
                    isUnans ? 'border-destructive bg-destructive/15 text-destructive animate-pulse' :
                    isFlagged ? 'border-warning bg-warning/10 text-warning' :
                    isAnswered ? 'border-success/50 bg-success/10 text-success' :
                    'border-border text-muted-foreground hover:border-primary'}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>

          {/* Question card */}
          <Card className={`glass-card ${isUnanswered ? 'ring-2 ring-destructive/50' : ''}`}>
            <CardContent className="p-6">
              {isUnanswered && (
                <p className="text-xs text-destructive flex items-center gap-1 mb-3 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" /> Answer this question before submitting
                </p>
              )}
              <p className="text-sm text-muted-foreground mb-1">Question {currentIdx + 1} of {totalQs}</p>
              <div className="text-base font-medium leading-relaxed mb-6">
                <FormattedText text={q.question} showRunButton={false} />
              </div>
              <div className="space-y-2.5">
                {q.options.map((opt, i) => {
                  const isSelected = selected === i;
                  return (
                    <button key={i} onClick={() => selectAnswer(i)}
                      className={`w-full text-left flex items-center gap-3 border rounded-xl p-3.5 text-sm transition-all duration-200 ${isSelected ? 'border-primary bg-primary/10 shadow-sm' : 'border-border hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5'}`}
                      style={{ animation: `stagger-in 0.25s ease both ${i * 40}ms` }}>
                      <span className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${isSelected ? 'border-primary bg-primary text-white' : 'border-border'}`}>
                        {i + 1}
                      </span>
                      <span className="flex-1"><FormattedText text={opt} showRunButton={false} /></span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={prevQuestion} disabled={currentIdx === 0}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <Button variant="outline" size="sm" onClick={skipAndFlag} disabled={currentIdx === totalQs - 1}>
                    <SkipForward className="h-4 w-4 mr-1" /> Skip
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={trySubmit}
                    className={unansweredIds.length > 0 ? 'border-destructive/50 text-destructive' : ''}>
                    {unansweredIds.length > 0 ? `Submit (${unansweredIds.length} left)` : 'Submit ✓'}
                  </Button>
                  <Button size="sm" onClick={nextQuestion}>
                    {currentIdx < totalQs - 1 ? <>Next <ArrowRight className="h-4 w-4 ml-1" /></> : 'Finish 🎉'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-center text-muted-foreground">1–{q.options.length} answer · ← prev · S skip · Enter next · progress auto-saved</p>
        </div>
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (phase === 'result' && session && activePaper) {
    const pct = Math.round((session.score / session.total) * 100);
    const wrongQs = activePaper.questions.filter(q => session.answers[q.id] !== q.answer);
    const correctQs = activePaper.questions.filter(q => session.answers[q.id] === q.answer);

    const TABS: { id: ResultTab; label: string; icon: any; count?: number }[] = [
      { id: 'summary', label: 'Summary', icon: BarChart2 },
      { id: 'wrong', label: 'Wrong', icon: BookX, count: wrongQs.length },
      { id: 'review', label: 'Full Review', icon: Eye, count: activePaper.questions.length },
    ];

    return (
      <>
        {showCelebration && celebData && (
          <ResultCelebration pct={celebData.pct} score={celebData.score}
            total={celebData.total} xpGained={celebData.xp}
            onDone={() => setShowCelebration(false)} />
        )}

        <div className="max-w-3xl mx-auto space-y-5">
          {/* Score card */}
          <Card className="glass-card animate-bounce-in overflow-hidden">
            <div className={`h-1.5 w-full ${pct >= 80 ? 'bg-gradient-to-r from-success to-green-400' : pct >= 60 ? 'bg-gradient-to-r from-warning to-yellow-400' : 'bg-gradient-to-r from-destructive to-red-400'}`} />
            <CardContent className="p-6">
              <div className="flex items-center gap-6 flex-wrap">
                <DonutChart pct={pct} />
                <div className="flex-1 space-y-3 min-w-0">
                  <div>
                    <h2 className="text-xl font-bold">
                      {pct >= 80 ? '🎉 Excellent!' : pct >= 60 ? '👍 Good job!' : '💪 Keep going!'}
                    </h2>
                    <p className="text-muted-foreground text-sm mt-0.5">{activePaper.title}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 rounded-xl bg-success/10 border border-success/20">
                      <p className="text-2xl font-bold text-success">{session.score}</p>
                      <p className="text-xs text-muted-foreground">Correct</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-destructive/10 border border-destructive/20">
                      <p className="text-2xl font-bold text-destructive">{session.total - session.score}</p>
                      <p className="text-xs text-muted-foreground">Wrong</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-primary/10 border border-primary/20">
                      <p className="text-2xl font-bold text-primary">+{session.score * 10}</p>
                      <p className="text-xs text-muted-foreground">XP</p>
                    </div>
                  </div>
                  {session.duration > 0 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Time taken: {formatDuration(session.duration)}
                      {tabWarnings > 0 && <span className="ml-2 text-warning flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" />{tabWarnings} tab switch{tabWarnings > 1 ? 'es' : ''}</span>}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Question trail */}
          <Card className="glass-card animate-fade-in" style={{ animationDelay: '150ms' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" /> Question Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {activePaper.questions.map((q, i) => (
                  <QuestionBar key={q.id} correct={session.answers[q.id] === q.answer} idx={i} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap animate-fade-in" style={{ animationDelay: '200ms' }}>
            <Button variant="outline" onClick={() => startTest(activePaper)}>
              <RotateCcw className="h-4 w-4 mr-2" /> Retry
            </Button>
            <Button variant="ghost" onClick={() => { setPhase('list'); setActivePaper(null); setSession(null); }}>
              ← Back to Papers
            </Button>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-1 p-1 bg-muted rounded-xl animate-fade-in" style={{ animationDelay: '250ms' }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setResultTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${resultTab === tab.id ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <Badge variant={tab.id === 'wrong' ? 'destructive' : 'secondary'} className="text-[10px] h-4 px-1">
                    {tab.count}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Summary tab */}
          {resultTab === 'summary' && (
            <div className="space-y-4 animate-fade-in">
              {/* Accuracy bar */}
              <Card className="glass-card">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-medium">Accuracy Breakdown</p>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-success font-medium">Correct</span>
                        <span className="text-muted-foreground">{correctQs.length} / {session.total}</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-success rounded-full animate-progress-fill"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-destructive font-medium">Wrong</span>
                        <span className="text-muted-foreground">{wrongQs.length} / {session.total}</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-destructive rounded-full animate-progress-fill"
                          style={{ width: `${100 - pct}%` }} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Previous attempts */}
              {(() => {
                const prev = getTestPaperSessions()
                  .filter(s => s.paperId === activePaper.id && s.id !== session.id)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 3);
                if (!prev.length) return null;
                return (
                  <Card className="glass-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Previous Attempts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {prev.map((ps, i) => {
                        const ppct = Math.round((ps.score / ps.total) * 100);
                        return (
                          <div key={ps.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/40">
                            <span className="text-muted-foreground text-xs">
                              {new Date(ps.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{ps.score}/{ps.total}</span>
                              <Badge variant={ppct >= 80 ? 'default' : ppct >= 60 ? 'secondary' : 'destructive'} className="text-xs">
                                {ppct}%
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          )}

          {/* Wrong questions tab */}
          {resultTab === 'wrong' && (
            <div className="space-y-3 animate-fade-in">
              {wrongQs.length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="p-8 text-center">
                    <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
                    <p className="font-semibold text-success">Perfect Score!</p>
                    <p className="text-muted-foreground text-sm mt-1">You answered every question correctly.</p>
                  </CardContent>
                </Card>
              ) : (
                wrongQs.map((q, i) => {
                  const userAns = session.answers[q.id];
                  const qIdx = activePaper.questions.findIndex(qq => qq.id === q.id);
                  return (
                    <Card key={q.id} className="glass-card border-l-4 border-l-destructive animate-fade-in"
                      style={{ animationDelay: `${i * 50}ms` }}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">Question {qIdx + 1}</p>
                            <div className="text-sm font-medium">
                              <FormattedText text={q.question} showRunButton={false} />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1.5 pl-6">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className={`text-xs p-2.5 rounded-lg flex items-center gap-2 ${oi === q.answer ? 'bg-success/10 text-success font-medium border border-success/20' : oi === userAns ? 'bg-destructive/10 text-destructive border border-destructive/20 line-through' : 'text-muted-foreground'}`}>
                              <span className="shrink-0">{oi === q.answer ? '✓' : oi === userAns ? '✗' : `${oi + 1}.`}</span>
                              <FormattedText text={opt} showRunButton={false} />
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <div className="pl-6">
                            <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg italic">
                              💡 <FormattedText text={q.explanation} showRunButton={false} />
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* Full review tab */}
          {resultTab === 'review' && (
            <div className="space-y-3 animate-fade-in">
              {activePaper.questions.map((q, i) => {
                const userAns = session.answers[q.id];
                const correct = userAns === q.answer;
                return (
                  <Card key={q.id} className={`glass-card border-l-4 ${correct ? 'border-l-success' : 'border-l-destructive'} animate-fade-in`}
                    style={{ animationDelay: `${i * 40}ms` }}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        {correct
                          ? <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                          : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">Question {i + 1}</p>
                          <div className="text-sm font-medium">
                            <FormattedText text={q.question} showRunButton={false} />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5 pl-6">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className={`text-xs p-2.5 rounded-lg flex items-center gap-2 ${oi === q.answer ? 'bg-success/10 text-success font-medium border border-success/20' : oi === userAns && oi !== q.answer ? 'bg-destructive/10 text-destructive border border-destructive/20 line-through' : 'text-muted-foreground'}`}>
                            <span className="shrink-0 font-bold">{oi + 1}.</span>
                            <FormattedText text={opt} showRunButton={false} />
                            {oi === q.answer && <CheckCircle2 className="h-3.5 w-3.5 ml-auto shrink-0" />}
                            {oi === userAns && oi !== q.answer && <XCircle className="h-3.5 w-3.5 ml-auto shrink-0" />}
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <div className="pl-6">
                          <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg italic">
                            💡 <FormattedText text={q.explanation} showRunButton={false} />
                          </p>
                        </div>
                      )}
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

  // ── LIST ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold shimmer-text">Test Papers</h1>
        <p className="text-muted-foreground mt-1">Upload and take structured test papers</p>
      </div>

      {hasResumable && (
        <Card className="glass-card border-primary/40 animate-bounce-in">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <PlayCircle className="h-8 w-8 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-sm">Resume Test</p>
                <p className="text-xs text-muted-foreground">Continue from where you left off</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={resumeTest}>Resume</Button>
              <Button size="sm" variant="ghost" onClick={() => { clearActiveTest(); setHasResumable(false); }}>Discard</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {papers.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {papers.map((paper, i) => {
            const sessions = getTestPaperSessions().filter(s => s.paperId === paper.id);
            const best = sessions.length ? Math.max(...sessions.map(s => Math.round((s.score / s.total) * 100))) : null;
            return (
              <Card key={paper.id} className="glass-card hover-lift animate-scale-in" style={{ animationDelay: `${i * 60}ms` }}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{paper.title}</h3>
                      {paper.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{paper.description}</p>}
                    </div>
                    <button onClick={() => handleDelete(paper.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 ml-2 shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{paper.questions.length} questions</Badge>
                    {paper.timeLimit && <Badge variant="outline" className="text-xs"><Timer className="h-3 w-3 mr-1" />{formatTime(paper.timeLimit)}</Badge>}
                    {best !== null && (
                      <Badge variant={best >= 80 ? 'default' : best >= 60 ? 'secondary' : 'destructive'} className="text-xs">
                        Best: {best}%
                      </Badge>
                    )}
                  </div>
                  {sessions.length > 0 && (
                    <p className="text-xs text-muted-foreground">{sessions.length} attempt{sessions.length > 1 ? 's' : ''}</p>
                  )}
                  <Button size="sm" className="w-full" onClick={() => startTest(paper)}>
                    <PlayCircle className="h-4 w-4 mr-1" /> {sessions.length > 0 ? 'Retake Test' : 'Take Test'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {papers.length === 0 && (
        <Card className="glass-card animate-scale-in">
          <CardContent className="p-8 text-center space-y-3">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">No test papers yet. Import one to get started!</p>
            <Button onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4 mr-1" /> Import Test Paper
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Import / Export */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card animate-scale-in" style={{ animationDelay: '120ms' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Import Test Paper</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowImport(v => !v)}>
                {showImport ? 'Hide' : 'Show'}
              </Button>
            </div>
          </CardHeader>
          {showImport && (
            <CardContent className="space-y-4">
              <div className="text-xs p-3 rounded-xl bg-primary/5 border border-primary/15 space-y-1">
                <p className="font-semibold text-primary">📋 Format</p>
                <p className="text-muted-foreground">JSON with a "questions" array. Each needs: id, question, options, answer (0-based), explanation. No level/subject required.</p>
              </div>
              <Button variant="outline" size="sm" className="text-xs"
                onClick={() => { setJsonInput(SAMPLE_TEST_PAPER); toast({ title: 'Sample loaded' }); }}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Load Sample
              </Button>
              <input type="file" accept=".json" onChange={handleFileUpload}
                className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-sm file:font-medium file:cursor-pointer cursor-pointer" />
              <Textarea placeholder="Paste JSON here..." value={jsonInput}
                onChange={e => setJsonInput(e.target.value)} rows={8} className="font-mono text-xs" />
              {errors.length > 0 && (
                <div className="space-y-1">
                  {errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" /> {err}
                    </p>
                  ))}
                </div>
              )}
              <Button onClick={handleImport} disabled={!jsonInput.trim()} className="w-full">
                <Upload className="h-4 w-4 mr-2" /> Import
              </Button>
            </CardContent>
          )}
        </Card>

        <Card className="glass-card animate-scale-in" style={{ animationDelay: '180ms' }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" /> Export Test Papers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={exportPaperId} onValueChange={setExportPaperId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Papers</SelectItem>
                {papers.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleExport} variant="outline" className="w-full" disabled={papers.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Download JSON
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
