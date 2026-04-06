export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type TestType = 'practice' | 'exam';

export interface Question {
  id: string;
  subject: string;
  level: Difficulty;
  question: string;
  options: string[];
  answer: number; // index into options
  explanation: string;
  bookmarked?: boolean;
  tags?: string[];
}

export interface TestSession {
  id: string;
  type: TestType;
  subject: string;
  level: Difficulty | 'mixed';
  questionIds: string[];
  answers: Record<string, number | null>; // questionId -> selected option index
  score: number;
  total: number;
  date: string; // ISO
  duration: number; // seconds
  completed: boolean;
}

export interface WrongQuestion {
  questionId: string;
  subject: string;
  attempts: number;
  lastAttemptDate: string;
  corrected: boolean;
}

export interface UserStats {
  xp: number;
  streak: number;
  lastActiveDate: string;
  totalTests: number;
  totalCorrect: number;
  totalAnswered: number;
  level: number;
  badges: string[];
  subjectAccuracy: Record<string, { correct: number; total: number }>;
}

export interface QuestionBank {
  version: string;
  name: string;
  questions: Question[];
  exportedAt: string;
}

// Schema for import validation
export const questionSchema = {
  required: ['id', 'subject', 'level', 'question', 'options', 'answer', 'explanation'],
  levels: ['easy', 'medium', 'hard', 'expert'] as const,
  minOptions: 2,
  maxOptions: 6,
};

// Test Paper types (no difficulty levels)
export interface TestQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  bookmarked?: boolean;
}

export interface TestPaper {
  id: string;
  title: string;
  description?: string;
  timeLimit?: number; // seconds, optional
  questions: TestQuestion[];
  createdAt: string;
}

export interface TestPaperSession {
  id: string;
  paperId: string;
  questionIds: string[];
  answers: Record<string, number | null>;
  score: number;
  total: number;
  date: string;
  duration: number;
  completed: boolean;
}

export interface TestPaperBank {
  version: string;
  name: string;
  papers: TestPaper[];
  exportedAt: string;
}

export const testQuestionSchema = {
  required: ['id', 'question', 'options', 'answer', 'explanation'],
  minOptions: 2,
  maxOptions: 6,
};
