import { Question, TestSession, WrongQuestion, UserStats, QuestionBank, questionSchema, Difficulty } from '@/types/mcq';

const KEYS = {
  questions: 'mcqpro_questions',
  sessions: 'mcqpro_sessions',
  wrongQuestions: 'mcqpro_wrong',
  stats: 'mcqpro_stats',
  recentQuestionIds: 'mcqpro_recent_ids',
  theme: 'mcqpro_theme',
};

function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function set(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Generate a unique ID that won't conflict with existing ones
function generateUniqueId(existingIds: Set<string>): string {
  let id: string;
  do {
    id = 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  } while (existingIds.has(id));
  existingIds.add(id);
  return id;
}

// Questions
export function getQuestions(): Question[] { return get(KEYS.questions, []); }
export function setQuestions(q: Question[]) { set(KEYS.questions, q); }

export function addQuestions(newQs: Question[]) {
  const existing = getQuestions();
  const existingIds = new Set(existing.map(q => q.id));

  // Auto-remap duplicate IDs instead of skipping them
  const remapped: Question[] = [];
  let autoRenamed = 0;

  for (const q of newQs) {
    if (existingIds.has(q.id)) {
      // Generate a new unique ID for this question
      const newId = generateUniqueId(existingIds);
      remapped.push({ ...q, id: newId });
      autoRenamed++;
    } else {
      existingIds.add(q.id);
      remapped.push(q);
    }
  }

  setQuestions([...existing, ...remapped]);
  return { added: remapped.length, autoRenamed };
}

export function toggleBookmark(id: string) {
  const qs = getQuestions();
  const idx = qs.findIndex(q => q.id === id);
  if (idx >= 0) { qs[idx].bookmarked = !qs[idx].bookmarked; setQuestions(qs); }
}

// Sessions
export function getSessions(): TestSession[] { return get(KEYS.sessions, []); }
export function saveSession(s: TestSession) {
  const sessions = getSessions();
  const idx = sessions.findIndex(x => x.id === s.id);
  if (idx >= 0) sessions[idx] = s; else sessions.push(s);
  set(KEYS.sessions, sessions);
}

// Wrong Questions
export function getWrongQuestions(): WrongQuestion[] { return get(KEYS.wrongQuestions, []); }
export function setWrongQuestions(wq: WrongQuestion[]) { set(KEYS.wrongQuestions, wq); }
export function addWrongQuestion(questionId: string, subject: string) {
  const wqs = getWrongQuestions();
  const existing = wqs.find(w => w.questionId === questionId);
  if (existing) {
    existing.attempts++;
    existing.lastAttemptDate = new Date().toISOString();
    existing.corrected = false;
  } else {
    wqs.push({ questionId, subject, attempts: 1, lastAttemptDate: new Date().toISOString(), corrected: false });
  }
  setWrongQuestions(wqs);
}
export function markCorrected(questionId: string) {
  const wqs = getWrongQuestions();
  const w = wqs.find(x => x.questionId === questionId);
  if (w) w.corrected = true;
  setWrongQuestions(wqs);
}

// Stats
const defaultStats: UserStats = {
  xp: 0, streak: 0, lastActiveDate: '', totalTests: 0,
  totalCorrect: 0, totalAnswered: 0, level: 1, badges: [],
  subjectAccuracy: {},
};
export function getStats(): UserStats { return get(KEYS.stats, { ...defaultStats }); }
export function updateStats(session: TestSession, questions: Question[]) {
  const stats = getStats();
  const today = new Date().toISOString().split('T')[0];
  const lastActive = stats.lastActiveDate?.split('T')[0];

  // Streak
  if (lastActive && lastActive !== today) {
    const diff = Math.round((new Date(today).getTime() - new Date(lastActive).getTime()) / 86400000);
    if (diff === 1) stats.streak++;
    else if (diff > 1) stats.streak = 1;
  } else if (!lastActive) { stats.streak = 1; }

  stats.lastActiveDate = new Date().toISOString();
  stats.totalTests++;
  stats.totalCorrect += session.score;
  stats.totalAnswered += session.total;

  // XP: 10 per correct, bonus for streaks
  const xpGained = session.score * 10 + (session.score === session.total ? 50 : 0);
  stats.xp += xpGained;
  stats.level = Math.floor(stats.xp / 500) + 1;

  // Subject accuracy
  for (const qId of session.questionIds) {
    const q = questions.find(x => x.id === qId);
    if (!q) continue;
    if (!stats.subjectAccuracy[q.subject]) stats.subjectAccuracy[q.subject] = { correct: 0, total: 0 };
    stats.subjectAccuracy[q.subject].total++;
    if (session.answers[qId] === q.answer) stats.subjectAccuracy[q.subject].correct++;
  }

  // Badges
  if (stats.totalTests >= 10 && !stats.badges.includes('test_10')) stats.badges.push('test_10');
  if (stats.streak >= 7 && !stats.badges.includes('streak_7')) stats.badges.push('streak_7');
  if (stats.xp >= 1000 && !stats.badges.includes('xp_1000')) stats.badges.push('xp_1000');

  set(KEYS.stats, stats);
  return { xpGained, stats };
}

// Recent question tracking (anti-repeat)
export function getRecentIds(): string[] { return get(KEYS.recentQuestionIds, []); }
export function addRecentIds(ids: string[]) {
  const recent = getRecentIds();
  const updated = [...ids, ...recent].slice(0, 250);
  set(KEYS.recentQuestionIds, updated);
}

// Question selection
export function selectQuestions(
  count: number,
  subject: string | 'all',
  level: Difficulty | 'mixed'
): Question[] {
  const all = getQuestions();
  const recent = new Set(getRecentIds());
  let pool = all.filter(q => {
    if (subject !== 'all' && q.subject !== subject) return false;
    if (level !== 'mixed' && q.level !== level) return false;
    return true;
  });

  // Prefer non-recent
  const nonRecent = pool.filter(q => !recent.has(q.id));
  if (nonRecent.length >= count) pool = nonRecent;

  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Level normalization map — handles common non-standard formats
const LEVEL_ALIASES: Record<string, string> = {
  // easy
  easy: 'easy', beginner: 'easy', basic: 'easy', simple: 'easy', '1': 'easy', low: 'easy',
  // medium
  medium: 'medium', intermediate: 'medium', moderate: 'medium', normal: 'medium', '2': 'medium', mid: 'medium', average: 'medium',
  // hard
  hard: 'hard', difficult: 'hard', advanced: 'hard', '3': 'hard', high: 'hard', tough: 'hard',
  // expert
  expert: 'expert', master: 'expert', extreme: 'expert', '4': 'expert', pro: 'expert', professional: 'expert', insane: 'expert',
};

function normalizeLevel(raw: any): string | null {
  if (!raw) return null;
  const key = String(raw).toLowerCase().trim();
  return LEVEL_ALIASES[key] || null;
}

// Validation
export function validateQuestionBank(data: unknown): { valid: boolean; errors: string[]; questions?: Question[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Invalid JSON structure'] };

  const bank = data as Partial<QuestionBank>;
  if (!Array.isArray(bank.questions)) return { valid: false, errors: ['Missing "questions" array'] };

  const validQuestions: Question[] = [];
  let autoFixedLevels = 0;

  bank.questions.forEach((q: any, i: number) => {
    const missing = questionSchema.required.filter(f => !(f in q));
    if (missing.length) { errors.push(`Q${i + 1}: Missing fields: ${missing.join(', ')}`); return; }

    // Auto-normalize level
    let level = q.level;
    if (!questionSchema.levels.includes(level)) {
      const normalized = normalizeLevel(level);
      if (normalized) {
        level = normalized;
        autoFixedLevels++;
      } else {
        errors.push(`Q${i + 1}: Invalid level "${q.level}" — use easy/medium/hard/expert`);
        return;
      }
    }

    if (!Array.isArray(q.options) || q.options.length < questionSchema.minOptions) {
      errors.push(`Q${i + 1}: Must have at least ${questionSchema.minOptions} options`); return;
    }
    if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.options.length) {
      errors.push(`Q${i + 1}: Invalid answer index`); return;
    }
    validQuestions.push({ ...q, level } as Question);
  });

  return {
    valid: errors.length === 0,
    errors: autoFixedLevels > 0
      ? [`ℹ️ ${autoFixedLevels} question(s) had non-standard levels that were auto-normalized.`, ...errors]
      : errors,
    questions: validQuestions,
    // @ts-ignore
    autoFixedLevels,
  };
}

// Export
export function exportQuestionBank(subject?: string): QuestionBank {
  let qs = getQuestions();
  if (subject && subject !== 'all') qs = qs.filter(q => q.subject === subject);
  return { version: '1.0', name: subject || 'All Questions', questions: qs, exportedAt: new Date().toISOString() };
}

// Theme
export function getTheme(): 'light' | 'dark' { return get(KEYS.theme, 'light') as 'light' | 'dark'; }
export function setTheme(t: 'light' | 'dark') { set(KEYS.theme, t); document.documentElement.classList.toggle('dark', t === 'dark'); }

// Subjects helper
export function getSubjects(): string[] {
  const qs = getQuestions();
  return [...new Set(qs.map(q => q.subject))].sort();
}

// Seed demo data
export function seedDemoData() {
  if (getQuestions().length > 0) return;
  const demoQuestions: Question[] = [
    { id: 'd1', subject: 'JavaScript', level: 'easy', question: 'What is the output of typeof null?', options: ['"null"', '"object"', '"undefined"', '"number"'], answer: 1, explanation: 'typeof null returns "object" due to a historical bug in JavaScript.' },
    { id: 'd2', subject: 'JavaScript', level: 'medium', question: 'Which method creates a shallow copy of an array?', options: ['Array.from()', '.slice()', '.concat()', 'All of the above'], answer: 3, explanation: 'All three methods create shallow copies of arrays.' },
    { id: 'd3', subject: 'JavaScript', level: 'hard', question: 'What does the "new" keyword do?', options: ['Creates an object', 'Sets prototype', 'Binds "this"', 'All of the above'], answer: 3, explanation: 'The new keyword creates an object, sets its prototype, binds this, and returns it.' },
    { id: 'd4', subject: 'Python', level: 'easy', question: 'What is the output of len("hello")?', options: ['4', '5', '6', 'Error'], answer: 1, explanation: 'len() returns the number of characters. "hello" has 5 characters.' },
    { id: 'd5', subject: 'Python', level: 'medium', question: 'What does *args do in a function?', options: ['Keyword args', 'Variable positional args', 'Default args', 'None'], answer: 1, explanation: '*args collects extra positional arguments into a tuple.' },
    { id: 'd6', subject: 'Python', level: 'hard', question: 'What is a decorator in Python?', options: ['A class method', 'A function wrapper', 'A data type', 'An import'], answer: 1, explanation: 'A decorator is a function that wraps another function to extend its behavior.' },
    { id: 'd7', subject: 'React', level: 'easy', question: 'What hook is used for state in React?', options: ['useEffect', 'useState', 'useRef', 'useMemo'], answer: 1, explanation: 'useState is the hook for managing component state.' },
    { id: 'd8', subject: 'React', level: 'medium', question: 'When does useEffect run by default?', options: ['On mount only', 'Every render', 'Never', 'On unmount'], answer: 1, explanation: 'Without a dependency array, useEffect runs after every render.' },
    { id: 'd9', subject: 'CSS', level: 'easy', question: 'Which property makes text bold?', options: ['font-style', 'font-weight', 'text-decoration', 'font-size'], answer: 1, explanation: 'font-weight: bold makes text appear bold.' },
    { id: 'd10', subject: 'CSS', level: 'medium', question: 'What does "display: flex" do?', options: ['Makes element inline', 'Creates flex container', 'Hides element', 'Makes element fixed'], answer: 1, explanation: 'display: flex creates a flex container for flexible layouts.' },
    { id: 'd11', subject: 'JavaScript', level: 'expert', question: 'What is the event loop in JavaScript?', options: ['A for loop', 'Concurrency model', 'Error handler', 'DOM API'], answer: 1, explanation: 'The event loop is JavaScript\'s concurrency model for handling async operations.' },
    { id: 'd12', subject: 'React', level: 'hard', question: 'What is React.memo used for?', options: ['State management', 'Memoizing components', 'Routing', 'Side effects'], answer: 1, explanation: 'React.memo prevents unnecessary re-renders by memoizing the component output.' },
  ];
  setQuestions(demoQuestions);
}

// User profile
export interface UserProfile {
  name: string;
  createdAt: string;
}
const PROFILE_KEY = 'mcqpro_profile';
export function getUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function setUserProfile(profile: UserProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
