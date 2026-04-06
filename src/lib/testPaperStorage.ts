import { TestPaper, TestPaperSession, TestPaperBank, TestQuestion, testQuestionSchema } from '@/types/mcq';

const KEYS = {
  papers: 'mcqpro_test_papers',
  sessions: 'mcqpro_test_paper_sessions',
  persisted: 'mcqpro_test_paper_active',
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

function generateUniqueId(existingIds: Set<string>): string {
  let id: string;
  do {
    id = 'tp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  } while (existingIds.has(id));
  existingIds.add(id);
  return id;
}

// Papers CRUD
export function getTestPapers(): TestPaper[] { return get(KEYS.papers, []); }
export function setTestPapers(papers: TestPaper[]) { set(KEYS.papers, papers); }

export function addTestPaper(paper: TestPaper) {
  const papers = getTestPapers();
  papers.push(paper);
  setTestPapers(papers);
}

export function deleteTestPaper(id: string) {
  setTestPapers(getTestPapers().filter(p => p.id !== id));
}

// Sessions
export function getTestPaperSessions(): TestPaperSession[] { return get(KEYS.sessions, []); }
export function saveTestPaperSession(s: TestPaperSession) {
  const sessions = getTestPaperSessions();
  const idx = sessions.findIndex(x => x.id === s.id);
  if (idx >= 0) sessions[idx] = s; else sessions.push(s);
  set(KEYS.sessions, sessions);
}

// Persist active test (resume support)
export function persistActiveTest(data: any) { set(KEYS.persisted, data); }
export function loadActiveTest(): any | null { return get(KEYS.persisted, null); }
export function clearActiveTest() { localStorage.removeItem(KEYS.persisted); }

// Validation
export function validateTestPaperBank(data: unknown): { valid: boolean; errors: string[]; papers?: TestPaper[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Invalid JSON structure'] };

  const bank = data as any;

  // Support single paper import (has "questions" array directly with no "papers")
  let papersArray: any[];
  if (Array.isArray(bank.papers)) {
    papersArray = bank.papers;
  } else if (Array.isArray(bank.questions)) {
    // Treat as single paper
    papersArray = [{
      id: bank.id || 'tp_' + Date.now().toString(36),
      title: bank.name || bank.title || 'Imported Test Paper',
      description: bank.description || '',
      timeLimit: bank.timeLimit,
      questions: bank.questions,
      createdAt: new Date().toISOString(),
    }];
  } else {
    return { valid: false, errors: ['Missing "papers" or "questions" array'] };
  }

  const validPapers: TestPaper[] = [];

  papersArray.forEach((paper: any, pi: number) => {
    if (!paper.title && !paper.name) { errors.push(`Paper ${pi + 1}: Missing title`); return; }
    if (!Array.isArray(paper.questions) || paper.questions.length === 0) {
      errors.push(`Paper ${pi + 1}: Missing or empty questions array`); return;
    }

    const validQs: TestQuestion[] = [];
    const existingIds = new Set<string>();

    paper.questions.forEach((q: any, qi: number) => {
      const missing = testQuestionSchema.required.filter(f => !(f in q));
      if (missing.length) { errors.push(`Paper ${pi + 1}, Q${qi + 1}: Missing fields: ${missing.join(', ')}`); return; }
      if (!Array.isArray(q.options) || q.options.length < testQuestionSchema.minOptions) {
        errors.push(`Paper ${pi + 1}, Q${qi + 1}: Must have at least ${testQuestionSchema.minOptions} options`); return;
      }
      if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.options.length) {
        errors.push(`Paper ${pi + 1}, Q${qi + 1}: Invalid answer index`); return;
      }

      let id = q.id || generateUniqueId(existingIds);
      if (existingIds.has(id)) id = generateUniqueId(existingIds);
      existingIds.add(id);

      validQs.push({ id, question: q.question, options: q.options, answer: q.answer, explanation: q.explanation || '' });
    });

    if (validQs.length > 0) {
      validPapers.push({
        id: paper.id || 'tp_' + Date.now().toString(36) + '_' + pi,
        title: paper.title || paper.name,
        description: paper.description || '',
        timeLimit: paper.timeLimit,
        questions: validQs,
        createdAt: paper.createdAt || new Date().toISOString(),
      });
    }
  });

  return { valid: errors.length === 0 || validPapers.length > 0, errors, papers: validPapers };
}

// Export
export function exportTestPapers(paperId?: string): TestPaperBank {
  let papers = getTestPapers();
  if (paperId && paperId !== 'all') papers = papers.filter(p => p.id === paperId);
  return { version: '1.0', name: 'Test Papers', papers, exportedAt: new Date().toISOString() };
}
