import { useState } from 'react';
import { setUserProfile } from '@/lib/storage';

export default function WelcomeModal({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState('');
  const [step, setStep] = useState<'name' | 'ready'>('name');

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setUserProfile({ name: trimmed, createdAt: new Date().toISOString() });
    setStep('ready');
    setTimeout(() => onDone(trimmed), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
      {step === 'name' ? (
        <div className="w-full max-w-md mx-4 animate-bounce-in">
          {/* Floating particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="absolute w-2 h-2 rounded-full bg-primary/30 animate-float"
                style={{
                  left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 20}%`,
                  animationDelay: `${i * 0.4}s`, animationDuration: `${2.5 + i * 0.3}s`
                }} />
            ))}
          </div>

          <div className="bg-card border border-border/60 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            {/* Gradient top bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center animate-float">
                <span className="text-4xl">🎓</span>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center mb-2 shimmer-text">Welcome to MCQ Pro!</h1>
            <p className="text-muted-foreground text-center text-sm mb-8">
              Your personal exam preparation companion. Let's get started!
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">What should we call you?</label>
                <input
                  type="text"
                  placeholder="Enter your name..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border-2 border-border bg-muted/30 focus:outline-none focus:border-primary transition-all text-base"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!name.trim()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
              >
                Let's Go! 🚀
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-4">Your name is saved locally on this device</p>
          </div>
        </div>
      ) : (
        <div className="text-center animate-bounce-in space-y-4">
          <div className="text-7xl animate-float">🎉</div>
          <h2 className="text-3xl font-bold shimmer-text">Hello, {name}!</h2>
          <p className="text-muted-foreground">Loading your dashboard...</p>
          <div className="flex justify-center gap-1 mt-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
