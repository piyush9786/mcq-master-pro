import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats, getQuestions, getSessions, seedDemoData, getWrongQuestions } from '@/lib/storage';
import { UserStats } from '@/types/mcq';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Zap, Flame, Target, BookOpen, Timer, Trophy, TrendingUp, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  useEffect(() => {
    seedDemoData();
    setStats(getStats());
    setQuestionCount(getQuestions().length);
    setSessionCount(getSessions().length);
    setWrongCount(getWrongQuestions().filter(w => !w.corrected).length);
  }, []);

  const accuracy = stats && stats.totalAnswered > 0
    ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
    : 0;

  const xpToNext = stats ? (stats.level * 500) - stats.xp : 500;
  const xpProgress = stats ? ((stats.xp % 500) / 500) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Ready to learn?</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.xp || 0}</p>
                <p className="text-xs text-muted-foreground">Total XP</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Flame className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.streak || 0}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{accuracy}%</p>
                <p className="text-xs text-muted-foreground">Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">Lv.{stats?.level || 1}</p>
                <p className="text-xs text-muted-foreground">Level</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* XP Progress */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Level {stats?.level || 1} Progress</span>
            <span className="text-xs text-muted-foreground">{xpToNext} XP to next level</span>
          </div>
          <Progress value={xpProgress} className="h-2" />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card hover:border-primary/30 transition-colors cursor-pointer group" onClick={() => navigate('/practice')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Start Practice</h3>
              <p className="text-sm text-muted-foreground">No timer, learn at your pace</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card hover:border-accent/30 transition-colors cursor-pointer group" onClick={() => navigate('/exam')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <Timer className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold">Start Exam</h3>
              <p className="text-sm text-muted-foreground">Timed, simulate real exams</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Tests Taken
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{sessionCount}</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Questions in Bank
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{questionCount}</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Wrong Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{wrongCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Subject Accuracy */}
      {stats && Object.keys(stats.subjectAccuracy).length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Subject Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.subjectAccuracy).map(([subject, data]) => {
              const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
              return (
                <div key={subject}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{subject}</span>
                    <span className="text-muted-foreground">{pct}% ({data.correct}/{data.total})</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Badges */}
      {stats && stats.badges.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Badges</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {stats.badges.map(badge => (
              <span key={badge} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
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
