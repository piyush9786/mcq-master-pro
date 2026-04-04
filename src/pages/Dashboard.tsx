import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats, getQuestions, getSessions, seedDemoData, getWrongQuestions } from '@/lib/storage';
import { UserStats } from '@/types/mcq';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Zap, Flame, Target, BookOpen, Timer, Trophy, TrendingUp, AlertCircle, ArrowRight, Star } from 'lucide-react';

// Animated counter hook
function useCountUp(target: number, duration = 1000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const prog = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setVal(Math.round(ease * target));
      if (prog < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

function AnimatedStat({ value, label, icon: Icon, color, delay = 0 }: {
  value: number; label: string; icon: any; color: string; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  const count = useCountUp(visible ? value : 0, 900);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <Card className="glass-card hover-lift group cursor-default overflow-hidden relative"
      style={{ animationDelay: `${delay}ms` }}>
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${color.replace('text-', 'bg-').replace('/10', '/5')}`} />
      <CardContent className="p-4 relative">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg ${color.replace('text-', 'bg-').replace('/10', '/10')} flex items-center justify-center relative`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold stat-number tabular-nums">{count}{label.includes('Accuracy') ? '%' : ''}{label.includes('Level') ? '' : ''}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    seedDemoData();
    setStats(getStats());
    setQuestionCount(getQuestions().length);
    setSessionCount(getSessions().length);
    setWrongCount(getWrongQuestions().filter(w => !w.corrected).length);
    setMounted(true);
  }, []);

  const accuracy = stats && stats.totalAnswered > 0
    ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;
  const xpToNext = stats ? (stats.level * 500) - stats.xp : 500;
  const xpProgress = stats ? ((stats.xp % 500) / 500) * 100 : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl md:text-3xl font-bold shimmer-text">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Ready to learn?</p>
      </div>

      {/* Stat cards with stagger */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <AnimatedStat value={stats?.xp || 0} label="Total XP" icon={Zap} color="text-primary" delay={50} />
        <AnimatedStat value={stats?.streak || 0} label="Day Streak" icon={Flame} color="text-warning" delay={120} />
        <AnimatedStat value={accuracy} label="Accuracy" icon={Target} color="text-success" delay={190} />
        <AnimatedStat value={stats?.level || 1} label={`Level ${stats?.level || 1}`} icon={Trophy} color="text-accent" delay={260} />
      </div>

      {/* XP Progress bar */}
      <Card className="glass-card animate-scale-in" style={{ animationDelay: '300ms' }}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-primary" />
              Level {stats?.level || 1} Progress
            </span>
            <span className="text-xs text-muted-foreground">{xpToNext} XP to next level</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent animate-progress-fill"
              style={{ width: `${xpProgress}%`, animationDuration: '1.2s', animationDelay: '400ms' }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{stats?.xp || 0} XP</span>
            <span>{(stats?.level || 1) * 500} XP</span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="glass-card hover-lift cursor-pointer group border-primary/20 hover:border-primary/50 transition-all duration-300"
          style={{ animation: 'stagger-in 0.4s ease both 0.35s' }}
          onClick={() => navigate('/practice')}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
              <BookOpen className="h-7 w-7 text-primary animate-float" style={{ animationDelay: '0s' }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">Start Practice</h3>
              <p className="text-sm text-muted-foreground">No timer, learn at your pace</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </CardContent>
        </Card>

        <Card
          className="glass-card hover-lift cursor-pointer group border-accent/20 hover:border-accent/50 transition-all duration-300"
          style={{ animation: 'stagger-in 0.4s ease both 0.42s' }}
          onClick={() => navigate('/exam')}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-all duration-300 group-hover:scale-110">
              <Timer className="h-7 w-7 text-accent animate-float" style={{ animationDelay: '0.5s' }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">Start Exam</h3>
              <p className="text-sm text-muted-foreground">Timed, simulate real exams</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
          </CardContent>
        </Card>
      </div>

      {/* Overview numbers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children" style={{ animationDelay: '400ms' }}>
        {[
          { label: 'Tests Taken', value: sessionCount, icon: TrendingUp, color: 'text-primary' },
          { label: 'Questions in Bank', value: questionCount, icon: BookOpen, color: 'text-accent' },
          { label: 'Wrong Questions', value: wrongCount, icon: AlertCircle, color: 'text-destructive' },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <Card key={label} className="glass-card hover-lift" style={{ animationDelay: `${500 + i * 60}ms` }}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Icon className={`h-4 w-4 ${color}`} /> {label}
              </div>
              <p className="text-4xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subject performance */}
      {stats && Object.keys(stats.subjectAccuracy).length > 0 && (
        <Card className="glass-card animate-fade-in" style={{ animationDelay: '600ms' }}>
          <CardHeader>
            <CardTitle className="text-base">Subject Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(stats.subjectAccuracy).map(([subject, data], i) => {
              const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
              const barColor = pct >= 80 ? 'from-success to-green-400' : pct >= 60 ? 'from-warning to-yellow-400' : 'from-destructive to-red-400';
              return (
                <div key={subject} style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium">{subject}</span>
                    <span className="text-muted-foreground">{pct}% ({data.correct}/{data.total})</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${barColor} animate-progress-fill`}
                      style={{ width: `${pct}%`, animationDelay: `${700 + i * 80}ms`, animationDuration: '1s' }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Badges */}
      {stats && stats.badges.length > 0 && (
        <Card className="glass-card animate-fade-in" style={{ animationDelay: '700ms' }}>
          <CardHeader><CardTitle className="text-base">Badges Earned</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {stats.badges.map((badge, i) => (
              <span
                key={badge}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/20 text-sm font-medium animate-bounce-in hover-lift cursor-default"
                style={{ animationDelay: `${800 + i * 100}ms` }}
              >
                {badge === 'test_10' && '🏆 10 Tests'}
                {badge === 'streak_7' && '🔥 7-Day Streak'}
                {badge === 'xp_1000' && '⚡ 1000 XP'}
              </span>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
