import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats, getQuestions, getSessions, seedDemoData, getWrongQuestions, getUserProfile } from '@/lib/storage';
import { UserStats } from '@/types/mcq';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Flame, Target, BookOpen, Timer, Trophy, TrendingUp, AlertCircle, ArrowRight, Star, Calendar } from 'lucide-react';
import WelcomeModal from '@/components/WelcomeModal';

function useCountUp(target: number, delay = 0, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const t = setTimeout(() => {
      let start: number | null = null;
      const step = (ts: number) => {
        if (!start) start = ts;
        const prog = Math.min((ts - start) / duration, 1);
        setVal(Math.round((1 - Math.pow(1 - prog, 3)) * target));
        if (prog < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(t);
  }, [target, delay, duration]);
  return val;
}

function StatCard({ value, label, icon: Icon, color, gradient, delay = 0, suffix = '' }: any) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t); }, [delay]);
  const count = useCountUp(vis ? value : 0, 0, 900);
  return (
    <Card className="glass-card hover-lift group relative overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300"
      style={{ animation: `stagger-in 0.45s ease both ${delay}ms` }}>
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${gradient}`} />
      <CardContent className="p-5 relative">
        <div className={`h-11 w-11 rounded-2xl ${color.replace('text-','bg-').split('/')[0]}/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <p className="text-3xl font-extrabold tabular-nums stat-number">{count}{suffix}</p>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium">{label}</p>
      </CardContent>
    </Card>
  );
}

const GREETINGS = (name: string, hour: number) => {
  if (hour < 12) return `Good morning, ${name}! ☀️`;
  if (hour < 17) return `Good afternoon, ${name}! 👋`;
  return `Good evening, ${name}! 🌙`;
};

const MOTIVATIONAL = [
  "Every question you answer makes you sharper. Keep going! ⚡",
  "Consistency beats talent. Show up every day! 💪",
  "Your future self will thank you for studying today. 📚",
  "Small daily improvements lead to stunning results! 🌟",
  "Champions train when others rest. Be a champion! 🏆",
  "The harder you work, the luckier you get! 🎯",
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [userName, setUserName] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [quote] = useState(() => MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]);
  const hour = new Date().getHours();

  useEffect(() => {
    seedDemoData();
    const profile = getUserProfile();
    if (!profile) { setShowWelcome(true); return; }
    setUserName(profile.name);
    loadData();
  }, []);

  const loadData = () => {
    setStats(getStats());
    setQuestionCount(getQuestions().length);
    setSessionCount(getSessions().length);
    setWrongCount(getWrongQuestions().filter(w => !w.corrected).length);
  };

  const handleWelcomeDone = (name: string) => {
    setUserName(name);
    setShowWelcome(false);
    loadData();
  };

  const accuracy = stats && stats.totalAnswered > 0
    ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;
  const xpProgress = stats ? ((stats.xp % 500) / 500) * 100 : 0;
  const xpToNext = stats ? (stats.level * 500) - stats.xp : 500;
  const today = new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      {showWelcome && <WelcomeModal onDone={handleWelcomeDone} />}

      <div className="space-y-7 max-w-6xl mx-auto">
        {/* ── Hero header ────────────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden animate-fade-in"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/15) 0%, hsl(var(--accent)/10) 60%, transparent 100%)' }}>
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-gradient-to-br from-primary/5 to-accent/10 -translate-y-16 translate-x-16 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-gradient-to-tr from-accent/5 to-primary/5 translate-y-10 -translate-x-10 pointer-events-none" />
          <div className="relative p-6 md:p-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold shimmer-text">
                  {userName ? GREETINGS(userName, hour) : 'Dashboard'}
                </h1>
                <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                  <Calendar className="h-3.5 w-3.5" />{today}
                </p>
                <p className="mt-3 text-sm italic text-muted-foreground max-w-md">"{quote}"</p>
              </div>
              {stats && stats.streak > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-warning/10 border border-warning/25 animate-scale-in" style={{ animationDelay: '300ms' }}>
                  <span className="text-2xl animate-float">🔥</span>
                  <div>
                    <p className="text-lg font-bold text-warning leading-none">{stats.streak}</p>
                    <p className="text-xs text-muted-foreground">day streak</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Stat cards ─────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard value={stats?.xp || 0} label="Total XP" icon={Zap} color="text-primary" gradient="from-primary/5 to-transparent" delay={60} />
          <StatCard value={stats?.streak || 0} label="Day Streak" icon={Flame} color="text-warning" gradient="from-warning/5 to-transparent" delay={130} />
          <StatCard value={accuracy} label="Accuracy" icon={Target} color="text-success" gradient="from-success/5 to-transparent" delay={200} suffix="%" />
          <StatCard value={stats?.level || 1} label="Current Level" icon={Trophy} color="text-accent" gradient="from-accent/5 to-transparent" delay={270} />
        </div>

        {/* ── XP bar ─────────────────────────────────────── */}
        <Card className="glass-card animate-scale-in border-border/50" style={{ animationDelay: '320ms' }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Star className="h-4 w-4 text-primary" />
                Level {stats?.level || 1}
              </span>
              <span className="text-xs text-muted-foreground">{xpToNext} XP to Level {(stats?.level || 1) + 1}</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden relative">
              <div className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary animate-progress-fill relative"
                style={{ width: `${xpProgress}%`, animationDuration: '1.3s', animationDelay: '400ms', backgroundSize: '200% auto', animation: 'shimmer 3s linear infinite, progress-fill 1.3s ease 400ms both' }}>
                <div className="absolute inset-0 rounded-full animate-pulse opacity-50 bg-white/20" />
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
              <span>{stats?.xp || 0} XP</span>
              <span>{(stats?.level || 1) * 500} XP</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Quick actions ───────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { path: '/practice', icon: BookOpen, color: 'primary', title: 'Start Practice', sub: 'No timer · learn at your own pace', delay: 380, emoji: '📖' },
            { path: '/exam', icon: Timer, color: 'accent', title: 'Start Exam', sub: 'Timed · simulate real exam conditions', delay: 440, emoji: '⏱️' },
          ].map(({ path, icon: Icon, color, title, sub, delay, emoji }) => (
            <Card key={path} onClick={() => navigate(path)}
              className={`glass-card hover-lift cursor-pointer group border-${color}/20 hover:border-${color}/50 transition-all duration-300`}
              style={{ animation: `stagger-in 0.45s ease both ${delay}ms` }}>
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`h-14 w-14 rounded-2xl bg-${color}/10 flex items-center justify-center group-hover:bg-${color}/20 group-hover:scale-110 transition-all duration-300 text-2xl`}>
                  {emoji}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base">{title}</h3>
                  <p className="text-sm text-muted-foreground">{sub}</p>
                </div>
                <ArrowRight className={`h-4 w-4 text-muted-foreground group-hover:text-${color} group-hover:translate-x-1.5 transition-all duration-200`} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Overview numbers ────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Tests Taken', val: sessionCount, icon: TrendingUp, color: 'text-primary', delay: 480 },
            { label: 'Questions', val: questionCount, icon: BookOpen, color: 'text-accent', delay: 530 },
            { label: 'To Review', val: wrongCount, icon: AlertCircle, color: 'text-destructive', delay: 580 },
          ].map(({ label, val, icon: Icon, color, delay }) => (
            <Card key={label} className="glass-card hover-lift border-border/50" style={{ animation: `stagger-in 0.45s ease both ${delay}ms` }}>
              <CardContent className="p-4 text-center">
                <Icon className={`h-5 w-5 ${color} mx-auto mb-2`} />
                <p className="text-3xl font-extrabold">{val}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Subject performance ─────────────────────────── */}
        {stats && Object.keys(stats.subjectAccuracy).length > 0 && (
          <Card className="glass-card animate-fade-in border-border/50" style={{ animationDelay: '620ms' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Subject Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {Object.entries(stats.subjectAccuracy).map(([subject, data], i) => {
                const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                const grad = pct >= 80 ? 'from-success to-emerald-400' : pct >= 60 ? 'from-warning to-yellow-400' : 'from-destructive to-red-400';
                return (
                  <div key={subject} style={{ animation: `stagger-in 0.35s ease both ${650 + i * 60}ms` }}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium">{subject}</span>
                      <span className={`text-xs font-semibold ${pct >= 80 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive'}`}>
                        {pct}% <span className="text-muted-foreground font-normal">({data.correct}/{data.total})</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${grad} animate-progress-fill`}
                        style={{ width: `${pct}%`, animationDelay: `${700 + i * 60}ms`, animationDuration: '1.1s' }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* ── Badges ─────────────────────────────────────── */}
        {stats && stats.badges.length > 0 && (
          <Card className="glass-card border-border/50 animate-fade-in" style={{ animationDelay: '700ms' }}>
            <CardHeader className="pb-2"><CardTitle className="text-base">🏅 Badges Earned</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-3 pt-0">
              {stats.badges.map((badge, i) => (
                <span key={badge}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/20 text-sm font-semibold hover-lift cursor-default animate-bounce-in"
                  style={{ animationDelay: `${750 + i * 100}ms` }}>
                  {badge === 'test_10' && '🏆 10 Tests'}
                  {badge === 'streak_7' && '🔥 7-Day Streak'}
                  {badge === 'xp_1000' && '⚡ 1000 XP'}
                </span>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
