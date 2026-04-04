import { useState, useEffect, useRef } from 'react';
import { getSubjects, selectQuestions, saveSession, addWrongQuestion, updateStats, getQuestions, addRecentIds } from '@/lib/storage';
import { Question, TestSession, Difficulty } from '@/types/mcq';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Timer, ArrowRight, ArrowLeft, SkipForward, CheckCircle2, XCircle } from 'lucide-react';
import FormattedText from '@/components/FormattedText';

type Phase = 'setup' | 'quiz' | 'result';

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
  const [session, setSession] = useState<TestSession | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const startTime = useRef(0);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => { setSubjects(getSubjects()); }, []);

  const startExam = () => {
    const selected = selectQuestions(count, subject, level);
    if (selected.length === 0) return;
    setQuestions(selected);
    setCurrentIdx(0);
    setAnswers({});
    setFlagged(new Set());
    const totalTime = selected.length * timePerQ;
    setTimeLeft(totalTime);
    startTime.current = Date.now();
    setPhase('quiz');
  };

  useEffect(() => {
    if (phase !== 'quiz') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { finishExam(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const selectAnswer = (optionIdx: number) => {
    const q = questions[currentIdx];
    setAnswers(prev => ({ ...prev, [q.id]: optionIdx }));
  };

  const prevQuestion = () => {
    if (currentIdx > 0) setCurrentIdx(prev => prev - 1);
  };

  const nextQuestion = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      finishExam();
    }
  };

  const skipAndFlag = () => {
    const q = questions[currentIdx];
    setFlagged(prev => new Set(prev).add(q.id));
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
    }
  };

  const finishExam = () => {
    clearInterval(timerRef.current);
    const allQs = getQuestions();
    const score = questions.filter(q => answers[q.id] === q.answer).length;
    questions.forEach(q => {
      if (answers[q.id] !== q.answer) addWrongQuestion(q.id, q.subject);
    });
    const duration = Math.round((Date.now() - startTime.current) / 1000);
    const s: TestSession = {
      id: crypto.randomUUID(),
      type: 'exam',
      subject: subject === 'all' ? 'Mixed' : subject,
      level,
      questionIds: questions.map(q => q.id),
      answers,
      score,
      total: questions.length,
      date: new Date().toISOString(),
      duration,
      completed: true,
    };
    saveSession(s);
    addRecentIds(questions.map(q => q.id));
    updateStats(s, allQs);
    setSession(s);
    setPhase('result');
  };

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
  }, [phase, currentIdx, questions]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (phase === 'setup') {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Exam Mode</h1>
          <p className="text-muted-foreground mt-1">Timed assessment, no peeking at answers</p>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Questions</label>
                <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15, 20, 25].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Sec/Question</label>
                <Select value={String(timePerQ)} onValueChange={(v) => setTimePerQ(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[30, 45, 60, 90, 120].map(n => <SelectItem key={n} value={String(n)}>{n}s</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" size="lg" onClick={startExam}>
              <Timer className="h-4 w-4 mr-2" /> Start Exam
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'result' && session) {
    const pct = Math.round((session.score / session.total) * 100);
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <Card className="glass-card">
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-5xl font-bold">{pct}%</div>
            <p className="text-muted-foreground">{session.score} of {session.total} correct</p>
            <p className="text-sm text-muted-foreground">Time: {formatTime(session.duration)}</p>
            <Progress value={pct} className="h-3" />
            <div className="flex gap-4 justify-center pt-4">
              <Button variant="outline" onClick={() => setShowReview(!showReview)}>
                {showReview ? 'Hide Review' : 'Review Answers'}
              </Button>
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
                <Card key={q.id} className={`glass-card border-l-4 ${correct ? 'border-l-success' : 'border-l-destructive'}`}>
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
    );
  }

  // Quiz phase
  const q = questions[currentIdx];
  const progress = ((currentIdx + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const flaggedCount = flagged.size;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{q.subject} • {q.level}</Badge>
        <div className="flex items-center gap-4">
          <div className="text-xs text-muted-foreground space-x-2">
            <span>Answered: {answeredCount}/{questions.length}</span>
            {flaggedCount > 0 && <span className="text-warning">• Flagged: {flaggedCount}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Timer className={`h-4 w-4 ${timeLeft < 30 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
            <span className={`text-sm font-mono font-medium ${timeLeft < 30 ? 'text-destructive' : ''}`}>{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={progress} className="h-1.5 flex-1" />
        <span className="text-xs text-muted-foreground">{currentIdx + 1}/{questions.length}</span>
      </div>

      {/* Question number grid */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((qi, i) => {
          const isAnswered = answers[qi.id] !== undefined;
          const isFlagged = flagged.has(qi.id);
          const isCurrent = i === currentIdx;
          return (
            <button
              key={qi.id}
              onClick={() => setCurrentIdx(i)}
              className={`h-7 w-7 rounded text-xs font-medium transition-all border ${
                isCurrent ? 'border-primary bg-primary text-primary-foreground' :
                isFlagged ? 'border-warning bg-warning/10 text-warning' :
                isAnswered ? 'border-success/50 bg-success/10 text-success' :
                'border-border text-muted-foreground hover:border-primary'
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <Card className="glass-card">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-6"><FormattedText text={q.question} /></h2>
          <div className="space-y-3">
            {q.options.map((opt, i) => {
              const isSelected = answers[q.id] === i;
              return (
                <button
                  key={i}
                  className={`w-full text-left flex items-center gap-3 border rounded-lg p-4 text-sm transition-all ${isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary hover:bg-primary/5'}`}
                  onClick={() => selectAnswer(i)}
                >
                  <span className="h-7 w-7 rounded-full border flex items-center justify-center text-xs font-medium shrink-0">{i + 1}</span>
                  <span className="flex-1">{opt}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={prevQuestion} disabled={currentIdx === 0}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button variant="outline" onClick={skipAndFlag} disabled={currentIdx === questions.length - 1} title="Skip & Review Later">
                <SkipForward className="h-4 w-4 mr-1" /> Skip
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={finishExam}>Submit Exam</Button>
              <Button onClick={nextQuestion}>
                {currentIdx < questions.length - 1 ? <>Next <ArrowRight className="h-4 w-4 ml-1" /></> : 'Finish'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-center text-muted-foreground">Keys: 1-{q.options.length} answer • ← prev • S skip • Enter next</p>
    </div>
  );
}
