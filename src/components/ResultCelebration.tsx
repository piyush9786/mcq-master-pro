import { useEffect, useRef, useState } from 'react';

interface Props {
  pct: number;
  score: number;
  total: number;
  xpGained: number;
  onDone?: () => void;
}

const QUOTES_BY_SCORE: { min: number; quotes: string[] }[] = [
  { min: 100, quotes: [
    "Perfection achieved! You're unstoppable! 🏆",
    "100%! You didn't just pass — you dominated! 👑",
    "Flawless! Save this moment forever! 💎",
  ]},
  { min: 80, quotes: [
    "Outstanding! Keep this momentum going! 🔥",
    "Excellence is your standard now. Don't settle! ⚡",
    "Brilliant work! Success is a habit for you! 🌟",
  ]},
  { min: 60, quotes: [
    "Good effort! Every mistake is a lesson learned! 📚",
    "You're on the right track — keep pushing! 💪",
    "Progress over perfection. You're growing! 🌱",
  ]},
  { min: 0, quotes: [
    "Every expert was once a beginner. Rise again! 🦅",
    "Failure is the tuition fee for success. Keep going! 🎯",
    "Your next attempt will be better. Trust the process! 🚀",
  ]},
];

function getQuote(pct: number): string {
  const bucket = QUOTES_BY_SCORE.find(b => pct >= b.min)!;
  return bucket.quotes[Math.floor(Math.random() * bucket.quotes.length)];
}

// Confetti particle
interface Particle {
  id: number; x: number; y: number; vx: number; vy: number;
  color: string; size: number; rotation: number; rotV: number; shape: 'rect' | 'circle';
}

function Fireworks({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();
  const particles = useRef<Particle[]>([]);
  const lastBurst = useRef(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#f43f5e','#fbbf24'];

    const burst = (x: number, y: number) => {
      for (let i = 0; i < 60; i++) {
        const angle = (Math.PI * 2 * i) / 60;
        const speed = 3 + Math.random() * 6;
        particles.current.push({
          id: Date.now() + i,
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 4 + Math.random() * 6,
          rotation: Math.random() * 360,
          rotV: (Math.random() - 0.5) * 8,
          shape: Math.random() > 0.5 ? 'rect' : 'circle',
        });
      }
    };

    const loop = (ts: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (ts - lastBurst.current > 700) {
        burst(canvas.width * (0.2 + Math.random() * 0.6), canvas.height * (0.1 + Math.random() * 0.5));
        lastBurst.current = ts;
      }
      particles.current = particles.current.filter(p => p.size > 0.5);
      particles.current.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.12; p.vx *= 0.99;
        p.size *= 0.97; p.rotation += p.rotV;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.min(1, p.size / 4);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animRef.current!); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  }, [active]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-40" />;
}

export default function ResultCelebration({ pct, score, total, xpGained, onDone }: Props) {
  const [show, setShow] = useState(false);
  const [quote] = useState(() => getQuote(pct));
  const isPerfect = pct === 100;
  const isGreat = pct >= 80;

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  const scoreColor = pct >= 80 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive';
  const gradFrom = pct >= 80 ? 'from-success/20' : pct >= 60 ? 'from-warning/20' : 'from-destructive/20';
  const gradTo = 'to-accent/10';

  const emoji = isPerfect ? '🏆' : pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '💪';
  const headline = isPerfect ? 'PERFECT SCORE!' : pct >= 80 ? 'Excellent Work!' : pct >= 60 ? 'Good Job!' : 'Keep Going!';

  return (
    <>
      <Fireworks active={isGreat} />

      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm transition-opacity duration-500 ${show ? 'opacity-100' : 'opacity-0'}`}>
        <div className={`w-full max-w-sm mx-4 ${show ? 'animate-bounce-in' : ''}`}>
          <div className={`bg-gradient-to-br ${gradFrom} ${gradTo} border border-border/60 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center`}>
            {/* Top bar */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${pct >= 80 ? 'from-success via-primary to-accent' : pct >= 60 ? 'from-warning via-primary to-accent' : 'from-destructive via-primary to-accent'}`} />

            {/* Main emoji */}
            <div className={`text-7xl mb-3 ${isPerfect ? 'animate-bounce' : 'animate-float'}`}>{emoji}</div>

            {/* Score ring */}
            <div className="relative inline-flex items-center justify-center mb-4">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/30" />
                <circle cx="60" cy="60" r="50" fill="none"
                  stroke={pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="10"
                  strokeDasharray={`${(pct / 100) * 314} 314`}
                  strokeDashoffset="78.5"
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1.5s cubic-bezier(.4,0,.2,1)', transitionDelay: '0.3s' }}
                />
                <text x="60" y="55" textAnchor="middle" fontSize="22" fontWeight="bold"
                  fill={pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'}>{pct}%</text>
                <text x="60" y="74" textAnchor="middle" fontSize="10" fill="#888">{score}/{total}</text>
              </svg>
            </div>

            <h2 className={`text-2xl font-bold mb-1 ${isPerfect ? 'shimmer-text' : ''}`}>{headline}</h2>

            {/* XP badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/25 mb-4 animate-scale-in" style={{ animationDelay: '0.5s' }}>
              <span className="text-sm">⚡</span>
              <span className="text-sm font-bold text-primary">+{xpGained} XP earned</span>
            </div>

            {/* Quote */}
            <p className="text-sm text-muted-foreground italic mb-6 px-2 leading-relaxed">"{quote}"</p>

            {/* Level badges by score */}
            {isPerfect && (
              <div className="flex justify-center gap-2 mb-5 flex-wrap stagger-children">
                {['🎯 Perfect', '💎 Flawless', '👑 Master'].map((b, i) => (
                  <span key={i} className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 font-medium animate-bounce-in"
                    style={{ animationDelay: `${0.7 + i * 0.15}s` }}>{b}</span>
                ))}
              </div>
            )}

            <button
              onClick={onDone}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold hover:opacity-90 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              {isPerfect ? '🏆 Claim Victory!' : isGreat ? '🌟 Continue!' : '💪 Try Again!'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
