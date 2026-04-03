import { useEffect, useState } from 'react';
import { getSessions } from '@/lib/storage';
import { TestSession } from '@/types/mcq';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ResultsPage() {
  const [sessions, setSessions] = useState<TestSession[]>([]);

  useEffect(() => {
    setSessions(getSessions().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  }, []);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatTime = (s: number) => s > 0 ? `${Math.floor(s / 60)}m ${s % 60}s` : '—';

  const avgScore = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + (s.score / s.total) * 100, 0) / sessions.length)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="text-muted-foreground mt-1">{sessions.length} tests taken • {avgScore}% average</p>
      </div>

      {sessions.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            No test results yet. Start a practice or exam!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const pct = Math.round((s.score / s.total) * 100);
            return (
              <Card key={s.id} className="glass-card hover:border-primary/20 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center text-sm font-bold ${pct >= 80 ? 'bg-success/10 text-success' : pct >= 50 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                      {pct}%
                    </div>
                    <div>
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
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
