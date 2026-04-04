import { useEffect, useState } from 'react';
import { getSessions, getQuestions } from '@/lib/storage';
import { TestSession, Question } from '@/types/mcq';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, TrendingUp, Target, BarChart2, CheckCircle2 } from 'lucide-react';
import FormattedText from '@/components/FormattedText';

// Sparkline for score trend
function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const max = Math.max(...scores, 1);
  const w = 120, h = 36, pad = 4;
  const pts = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2);
    const y = h - pad - (s / 100) * (h - pad * 2);
    return `${x},${y}`;
  });
  const lastScore = scores[scores.length - 1];
  const trend = scores.length > 1 ? lastScore - scores[scores.length - 2] : 0;
  return (
    <div className="flex items-center gap-2">
      <svg width={w} height={h} className="overflow-visible">
        <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="2"
          className="text-primary" strokeLinejoin="round" strokeLinecap="round" />
        {scores.map((s, i) => {
          const [x, y] = pts[i].split(',').map(Number);
          return <circle key={i} cx={x} cy={y} r="2.5" className="fill-primary" />;
        })}
      </svg>
      <span className={`text-xs font-medium ${trend > 0 ? 'text-success' : trend < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
        {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
      </span>
    </div>
  );
}

// Stacked bar chart for overall stats
function StatsBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Radial accuracy ring
function AccuracyRing({ pct }: { pct: number }) {
  const r = 38, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="90" height="90" viewBox="0 0 90 90">
      <circle cx="45" cy="45" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/30" />
      <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4}
        strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x="45" y="45" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="bold" fill={color}>{pct}%</text>
      <text x="45" y="60" textAnchor="middle" fontSize="7" fill="#888">accuracy</text>
    </svg>
  );
}

export default function ResultsPage() {
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [questions, setQuestionsList] = useState<Question[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'practice' | 'exam'>('all');

  useEffect(() => {
    setSessions(getSessions().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setQuestionsList(getQuestions());
  }, []);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatTime = (s: number) => s > 0 ? `${Math.floor(s / 60)}m ${s % 60}s` : '—';

  const filtered = sessions.filter(s => filter === 'all' || s.type === filter);
  const avgScore = filtered.length > 0
    ? Math.round(filtered.reduce((sum, s) => sum + (s.score / s.total) * 100, 0) / filtered.length)
    : 0;
  const totalCorrect = filtered.reduce((s, x) => s + x.score, 0);
  const totalAnswered = filtered.reduce((s, x) => s + x.total, 0);
  const recentScores = [...filtered].reverse().slice(-10).map(s => Math.round((s.score / s.total) * 100));

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Results</h1>
          <p className="text-muted-foreground mt-1">{sessions.length} tests taken</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'practice', 'exam'] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="capitalize">{f}</Button>
          ))}
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center text-muted-foreground">No test results yet. Start a practice or exam!</CardContent>
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass-card">
              <CardContent className="p-4 flex items-center gap-4">
                <AccuracyRing pct={avgScore} />
                <div>
                  <p className="text-sm font-medium">Avg Score</p>
                  <p className="text-xs text-muted-foreground">{filtered.length} sessions</p>
                  {recentScores.length > 1 && <div className="mt-2"><Sparkline scores={recentScores} /></div>}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-1"><Target className="h-4 w-4" /> Questions</p>
                <StatsBar label="Correct" value={totalCorrect} max={totalAnswered} color="bg-success" />
                <StatsBar label="Wrong" value={totalAnswered - totalCorrect} max={totalAnswered} color="bg-destructive" />
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-1"><BarChart2 className="h-4 w-4" /> By Type</p>
                <StatsBar label="Practice" value={sessions.filter(s => s.type === 'practice').length} max={sessions.length} color="bg-primary" />
                <StatsBar label="Exam" value={sessions.filter(s => s.type === 'exam').length} max={sessions.length} color="bg-accent" />
              </CardContent>
            </Card>
          </div>

          {/* Score history mini-chart */}
          {recentScores.length > 2 && (
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Score Trend (last {recentScores.length} sessions)</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-16">
                  {recentScores.map((score, i) => {
                    const color = score >= 80 ? 'bg-success' : score >= 60 ? 'bg-warning' : 'bg-destructive';
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">{score}%</span>
                        <div className={`w-full rounded-t ${color} opacity-80 hover:opacity-100 transition-opacity`}
                          style={{ height: `${Math.max(4, (score / 100) * 48)}px` }}
                          title={`Session ${i + 1}: ${score}%`}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Session list */}
          <div className="space-y-3">
            {filtered.map(s => {
              const pct = Math.round((s.score / s.total) * 100);
              const isOpen = expanded.has(s.id);
              return (
                <Card key={s.id} className="glass-card hover:border-primary/20 transition-colors">
                  <CardContent className="p-4">
                    <button className="w-full flex items-center justify-between" onClick={() => toggle(s.id)}>
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center text-sm font-bold ${pct >= 80 ? 'bg-success/10 text-success' : pct >= 50 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                          {pct}%
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-sm">{s.subject} — {s.level}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(s.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={s.type === 'exam' ? 'default' : 'secondary'}>{s.type}</Badge>
                        <div className="text-right text-sm">
                          <p className="font-medium">{s.score}/{s.total}</p>
                          <p className="text-xs text-muted-foreground">{formatTime(s.duration)}</p>
                        </div>
                        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="mt-4 border-t border-border pt-4 space-y-4 animate-fade-in">
                        {/* Mini bar chart for this session */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Question breakdown</p>
                          <div className="flex gap-1 h-8 items-end">
                            {s.questionIds.map((qId, i) => {
                              const q = questions.find(x => x.id === qId);
                              const correct = s.answers[qId] === q?.answer;
                              return (
                                <div key={qId} className={`flex-1 rounded-t ${correct ? 'bg-success' : 'bg-destructive'} opacity-70`}
                                  style={{ height: correct ? '100%' : '50%' }} title={`Q${i + 1}: ${correct ? 'Correct' : 'Wrong'}`}
                                />
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            <span>Q1</span><span>Q{s.questionIds.length}</span>
                          </div>
                        </div>

                        {/* Detailed questions */}
                        <div className="space-y-2">
                          {s.questionIds.map((qId, i) => {
                            const q = questions.find(x => x.id === qId);
                            if (!q) return null;
                            const userAns = s.answers[qId];
                            const correct = userAns === q.answer;
                            return (
                              <div key={qId} className={`p-3 rounded-lg border-l-4 ${correct ? 'border-l-success bg-success/5' : 'border-l-destructive bg-destructive/5'}`}>
                                <p className="font-medium text-sm mb-2">{i + 1}. <FormattedText text={q.question} /></p>
                                <div className="space-y-1 text-sm">
                                  {q.options.map((opt, oi) => (
                                    <div key={oi} className={`px-2 py-1 rounded ${oi === q.answer ? 'bg-success/10 text-success font-medium' : oi === userAns && oi !== q.answer ? 'bg-destructive/10 text-destructive line-through' : 'text-muted-foreground'}`}>
                                      {String.fromCharCode(65 + oi)}. <FormattedText text={opt} />
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2 italic"><FormattedText text={q.explanation} /></p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
