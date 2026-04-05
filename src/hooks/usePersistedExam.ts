/**
 * Persists and restores exam/practice state across page navigation.
 * Uses sessionStorage so state survives tab switches and SPA navigation
 * but clears when the browser tab is fully closed.
 */

const PRACTICE_KEY = 'mcqpro_practice_session';
const EXAM_KEY = 'mcqpro_exam_session';

export interface PersistedSession {
  type: 'practice' | 'exam';
  phase: 'quiz';
  subject: string;
  level: string;
  questions: any[];
  answers: Record<string, number | null>;
  currentIdx: number;
  flagged?: string[];
  timeLeft?: number;
  totalTime?: number;
  tabWarnings?: number;
  startedAt: number;
  savedAt: number;
}

function getKey(type: 'practice' | 'exam') {
  return type === 'practice' ? PRACTICE_KEY : EXAM_KEY;
}

export function saveSession(state: PersistedSession) {
  try {
    sessionStorage.setItem(getKey(state.type), JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {}
}

export function loadSession(type: 'practice' | 'exam'): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(getKey(type));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch { return null; }
}

export function clearSession(type: 'practice' | 'exam') {
  try { sessionStorage.removeItem(getKey(type)); } catch {}
}

/** Correct timer drift: subtract seconds elapsed since last save */
export function correctTimerDrift(session: PersistedSession): number {
  if (session.timeLeft === undefined) return 0;
  const elapsed = Math.floor((Date.now() - session.savedAt) / 1000);
  return Math.max(0, session.timeLeft - elapsed);
}
