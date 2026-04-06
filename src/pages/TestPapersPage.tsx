import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, Upload, Download, Trash2, PlayCircle, CheckCircle2, XCircle,
  ArrowRight, ArrowLeft, Timer, AlertCircle, Copy, Info, Plus, Maximize2,
  Minimize2, RotateCcw, Eye, SkipForward, AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getTestPapers, addTestPaper, deleteTestPaper, validateTestPaperBank,
  exportTestPapers, saveTestPaperSession, persistActiveTest, loadActiveTest,
  clearActiveTest
} from '@/lib/testPaperStorage';
import { TestPaper, TestQuestion, TestPaperSession } from '@/types/mcq';
import FormattedText from '@/components/FormattedText';
import ResultCelebration from '@/components/ResultCelebration';

type Phase = 'list' | 'setup' | 'quiz' | 'result';

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

const SAMPLE_TEST_PAPER = JSON.stringify({
  version: "1.0",
  name: "Sample Test Paper",
  questions: [
    { id: "t1", question: "What is 2 + 2?", options: ["3", "4", "5", "6"], answer: 1, explanation: "2 + 2 = 4" },
    { id: "t2", question: "What is the capital of France?", options: ["London", "Berlin", "Paris", "Madrid"], answer: 2, explanation: "Paris is the capital of France." },
  ]
}, null, 2);

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
  const [showReview, setShowReview] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebData, setCelebData] = useState<{ pct: number; score: number; total: number; xp: number } | null>(null);
  const [tabWarnings, setTabWarnings] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [showUnansweredWarning, setShowUnansweredWarning] = useState(false);
  const [hasResumable, setHasResumable] = useState(false);

  const timerRef = useRef<NodeJS.Timeout>();
  const answersRef = useRef<Record<string, number | null>>({});
  const timeLeftRef = useRef(0);
  const tabWarningsRef = useRef(0);

  useEffect(() => {
    setPapers(getTestPapers());
    const saved = loadActiveTest();
    if (saved && saved.phase === 'quiz') setHasResumable(true);
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

  // Persist quiz state
  useEffect(() => {
    if (phase !== 'quiz' || !activePaper) return;
    const save = () => {
      persistActiveTest({
        phase: 'quiz', paperId: activePaper.id, paper: activePaper,
        answers: answersRef.current, currentIdx, flagged: [...flagged],
        timeLeft: timeLeftRef.current, totalTime,
        tabWarnings: tabWarningsRef.current, savedAt: Date.now(),
      });
    };
    save();
    const interval = setInterval(save, 5000);
    return () => clearInterval(interval);
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
    const pct = Math.round((score / qs.length) * 100);
    setCelebData({ pct, score, total: qs.length, xp: score * 10 });
    setShowCelebration(true);
    setPhase('result');
  }, [activePaper, totalTime]);

  const trySubmit = useCallback(() => {
    if (!activePaper) return;
    const unanswered = activePaper.questions.filter(q => answersRef.current[q.id] === undefined || answersRef.current[q.id] === null);
    if (unanswered.length > 0) {
      setShowUnansweredWarning(true);
      const idx = activePaper.questions.findIndex(q => q.id === unanswered[0].id);
      setCurrentIdx(idx);
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

  // Keyboard
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
    setActivePaper(paper);
    setCurrentIdx(0);
    answersRef.current = {};
    setAnswers({});
    setFlagged(new Set());
    tabWarningsRef.current = 0;
    setTabWarnings(0);
    const tl = paper.timeLimit || 0;
    timeLeftRef.current = tl;
    setTimeLeft(tl);
    setTotalTime(tl);
    setHasResumable(false);
    setPhase('quiz');
    enterFullscreen();
  };

  const resumeTest = () => {
    const saved = loadActiveTest();
    if (!saved) return;
    setActivePaper(saved.paper);
    setCurrentIdx(saved.currentIdx);
    answersRef.current = saved.answers;
    setAnswers(saved.answers);
    setFlagged(new Set(saved.flagged || []));
    tabWarningsRef.current = saved.tabWarnings || 0;
    setTabWarnings(saved.tabWarnings || 0);
    // Adjust timer for elapsed time
    const elapsed = Math.floor((Date.now() - saved.savedAt) / 1000);
    const remaining = Math.max(0, (saved.timeLeft || 0) - elapsed);
    timeLeftRef.current = remaining;
    setTimeLeft(remaining);
    setTotalTime(saved.totalTime || 0);
    setHasResumable(false);
    setPhase('quiz');
    enterFullscreen();
  };

  // Import
  const handleImport = () => {
    try {
      const data = JSON.parse(jsonInput);
      const result = validateTestPaperBank(data);
      if (!result.papers || result.papers.length === 0) {
        setErrors(result.errors.length ? result.errors : ['No valid test papers found']);
        return;
      }
      result.papers.forEach(p => addTestPaper(p));
      setPapers(getTestPapers());
      setJsonInput('');
      setErrors([]);
      setShowImport(false);
      toast({ title: `✅ Imported ${result.papers.length} test paper(s)!` });
    } catch {
      setErrors(['❌ Invalid JSON — check syntax.']);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    deleteTestPaper(id);
    setPapers(getTestPapers());
    toast({ title: 'Test paper deleted' });
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── QUIZ PHASE ──────────────────────────────────────────────
  if (phase === 'quiz' && activePaper) {
    const q = activePaper.questions[currentIdx];
    const totalQs = activePaper.questions.length;
    const answered = Object.keys(answers).length;
    const selected = answers[q.id];
    const timeProgress = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;

    return (
      <div className="min-h-screen p-4 max-w-4xl mx-auto space-y-4">
        {/* Tab warning */}
        {showTabWarning && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-destructive text-destructive-foreground px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-bounce-in">
            <AlertTriangle className="h-5 w-5" /> Tab switch detected! ({tabWarnings})
          </div>
        )}
        {showUnansweredWarning && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-warning text-warning-foreground px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-bounce-in">
            <AlertTriangle className="h-5 w-5" /> Answer all questions before submitting
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-xs">{activePaper.title}</Badge>
            <span className="text-sm font-medium">{currentIdx + 1} / {totalQs}</span>
            <span className="text-xs text-muted-foreground">({answered} answered)</span>
          </div>
          <div className="flex items-center gap-3">
            {totalTime > 0 && (
              <div className="flex items-center gap-2">
                <Timer className={`h-4 w-4 ${timeLeft < 60 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
                <span className={`font-mono text-sm font-bold ${timeLeft < 60 ? 'text-destructive' : ''}`}>{formatTime(timeLeft)}</span>
              </div>
            )}
            {tabWarnings > 0 && <Badge variant="destructive" className="text-xs">{tabWarnings} tab switches</Badge>}
            <button onClick={isFullscreen ? exitFullscreen : enterFullscreen} className="p-2 rounded-xl hover:bg-muted transition-colors">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Timer bar */}
        {totalTime > 0 && (
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${timeLeft < 60 ? 'bg-destructive' : timeLeft < totalTime * 0.25 ? 'bg-warning' : 'bg-primary'}`}
              style={{ width: `${timeProgress}%` }} />
          </div>
        )}

        {/* Question nav dots */}
        <div className="flex flex-wrap gap-1.5">
          {activePaper.questions.map((qq, i) => {
            const isAnswered = answers[qq.id] !== undefined;
            const isFlagged = flagged.has(qq.id);
            const isCurrent = i === currentIdx;
            return (
              <button key={qq.id} onClick={() => setCurrentIdx(i)}
                className={`h-7 w-7 rounded-full text-xs font-bold flex items-center justify-center transition-all
                  ${isCurrent ? 'ring-2 ring-primary scale-110' : ''}
                  ${isAnswered ? 'bg-primary text-primary-foreground' : isFlagged ? 'bg-warning text-warning-foreground' : 'bg-muted text-muted-foreground'}`}>
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Question card */}
        <Card className="glass-card">
          <CardContent className="p-6 space-y-5">
            <div className="text-base leading-relaxed">
              <FormattedText text={q.question} showRunButton={false} />
            </div>
            <div className="grid gap-2.5">
              {q.options.map((opt, i) => {
                const isSelected = selected === i;
                return (
                  <button key={i} onClick={() => selectAnswer(i)}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all
                      ${isSelected ? 'border-primary bg-primary/10 shadow-md' : 'border-border hover:border-primary/40 hover:bg-muted/50'}`}>
                    <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                      ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {i + 1}
                    </span>
                    <span className="text-sm pt-0.5"><FormattedText text={opt} showRunButton={false} /></span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={prevQuestion} disabled={currentIdx === 0}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <Button variant="outline" onClick={skipAndFlag} className="text-warning">
            <SkipForward className="h-4 w-4 mr-1" /> Skip & Flag
          </Button>
          {currentIdx < totalQs - 1 ? (
            <Button onClick={nextQuestion}><ArrowRight className="h-4 w-4 mr-1" /> Next</Button>
          ) : (
            <Button onClick={trySubmit} className="bg-success hover:bg-success/90">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Submit
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── RESULT PHASE ────────────────────────────────────────────
  if (phase === 'result' && session && activePaper) {
    const pct = Math.round((session.score / session.total) * 100);
    return (
      <>
        {showCelebration && celebData && (
          <ResultCelebration pct={celebData.pct} score={celebData.score}
            total={celebData.total} xpGained={celebData.xp}
            onDone={() => setShowCelebration(false)} />
        )}
        <div className="max-w-2xl mx-auto space-y-5">
          <Card className="glass-card animate-bounce-in">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <DonutChart pct={pct} />
                <div className="flex-1 space-y-2">
                  <h2 className="text-xl font-bold">{pct >= 80 ? '🎉 Excellent!' : pct >= 60 ? '👍 Good job!' : '💪 Keep going!'}</h2>
                  <p className="text-muted-foreground text-sm">{activePaper.title}</p>
                  <p className="text-muted-foreground text-sm">{session.score} of {session.total} correct</p>
                  {session.duration > 0 && <p className="text-xs text-muted-foreground">Time: {formatTime(session.duration)}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={() => { setShowReview(true); }}>
              <Eye className="h-4 w-4 mr-1" /> Review Answers
            </Button>
            <Button variant="outline" onClick={() => startTest(activePaper)}>
              <RotateCcw className="h-4 w-4 mr-1" /> Retry
            </Button>
            <Button variant="ghost" onClick={() => { setPhase('list'); setActivePaper(null); setSession(null); }}>
              Back to Papers
            </Button>
          </div>

          {showReview && (
            <div className="space-y-4">
              {activePaper.questions.map((q, i) => {
                const userAns = session.answers[q.id];
                const correct = userAns === q.answer;
                return (
                  <Card key={q.id} className={`glass-card border-l-4 ${correct ? 'border-l-success' : 'border-l-destructive'}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-muted-foreground mt-0.5">Q{i + 1}</span>
                        {correct ? <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                        <div className="text-sm"><FormattedText text={q.question} showRunButton={false} /></div>
                      </div>
                      <div className="grid gap-1.5 pl-6">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className={`text-xs p-2 rounded-lg ${oi === q.answer ? 'bg-success/15 text-success font-medium' : oi === userAns ? 'bg-destructive/15 text-destructive' : 'text-muted-foreground'}`}>
                            {oi + 1}. <FormattedText text={opt} showRunButton={false} />
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <div className="pl-6 text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg">
                          <FormattedText text={q.explanation} showRunButton={false} />
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

  // ── LIST PHASE ──────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold shimmer-text">Test Papers</h1>
        <p className="text-muted-foreground mt-1">Upload and take structured test papers — no difficulty levels, just questions</p>
      </div>

      {/* Resume banner */}
      {hasResumable && (
        <Card className="glass-card border-primary/40 animate-bounce-in">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <PlayCircle className="h-8 w-8 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-sm">Resume Test</p>
                <p className="text-xs text-muted-foreground">You have an unfinished test — continue from where you left off</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={resumeTest}>Resume</Button>
              <Button size="sm" variant="ghost" onClick={() => { clearActiveTest(); setHasResumable(false); }}>Discard</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Papers list */}
      {papers.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {papers.map((paper, i) => (
            <Card key={paper.id} className="glass-card animate-scale-in" style={{ animationDelay: `${i * 60}ms` }}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{paper.title}</h3>
                    {paper.description && <p className="text-xs text-muted-foreground mt-0.5">{paper.description}</p>}
                  </div>
                  <button onClick={() => handleDelete(paper.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{paper.questions.length} questions</Badge>
                  {paper.timeLimit && <Badge variant="outline"><Timer className="h-3 w-3 mr-1" />{formatTime(paper.timeLimit)}</Badge>}
                </div>
                <Button size="sm" className="w-full" onClick={() => startTest(paper)}>
                  <PlayCircle className="h-4 w-4 mr-1" /> Take Test
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {papers.length === 0 && !showImport && (
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
              <Button variant="ghost" size="sm" onClick={() => setShowImport(!showImport)} className="text-xs">
                {showImport ? 'Hide' : 'Show'}
              </Button>
            </div>
          </CardHeader>
          {showImport && (
            <CardContent className="space-y-4">
              <div className="text-xs p-3 rounded-xl bg-primary/5 border border-primary/15 space-y-1">
                <p className="font-semibold text-primary">📋 Format</p>
                <p className="text-muted-foreground">JSON with a "questions" array. Each question needs: id, question, options, answer (0-based index), explanation. No level/subject required.</p>
              </div>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => { setJsonInput(SAMPLE_TEST_PAPER); toast({ title: 'Sample loaded' }); }}>
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
            <div>
              <label className="text-sm font-medium mb-1.5 block">Paper</label>
              <Select value={exportPaperId} onValueChange={setExportPaperId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Papers</SelectItem>
                  {papers.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExport} variant="outline" className="w-full" disabled={papers.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Download JSON
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
