<div align="center">

# ⚡ MCQ Pro

### Your AI-Powered Exam Preparation Companion

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-mcq--pro.netlify.app-6366f1?style=for-the-badge)](https://mcq-pro.netlify.app)
[![Built with React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)
[![Deployed on Netlify](https://img.shields.io/badge/Deployed_on-Netlify-00C7B7?style=for-the-badge&logo=netlify)](https://netlify.com)

</div>

---

## 💡 Project Idea & Origin

The idea behind **MCQ Pro** is simple: most exam prep tools are either too basic (just flashcards) or too complex (full LMS platforms). Students preparing for competitive exams, university tests, or certifications need something in between — a **focused, distraction-free practice environment** that runs entirely in the browser with no login, no server, and no cost.

MCQ Pro was built to be:
- **Offline-capable** — all data stored in localStorage/sessionStorage
- **Import-driven** — bring your own question banks as JSON
- **Exam-realistic** — fullscreen mode, timers, tab-switch detection, unanswered guards
- **Motivating** — XP, levels, streaks, badges, fireworks on perfect scores

---

## ✨ Features

### 🏠 Dashboard
- Personalized greeting with time-of-day detection (Good morning / afternoon / evening)
- Animated stat counters — XP, Day Streak, Accuracy %, Level
- Gradient XP progress bar with shimmer animation
- Subject performance breakdown with color-coded bars
- Daily motivational quotes
- Achievement badges (10 Tests, 7-Day Streak, 1000 XP)

### 📖 Practice Mode
- No timer — learn at your own pace
- Instant answer feedback with explanation shown after each question
- Per-difficulty level chips showing available question count
- Custom question count selector with +/− stepper and drag slider
- **Auto-save** — leave mid-session and resume exactly where you left off
- Result screen: animated donut chart, difficulty breakdown bars, per-question trail
- Retry wrong questions in a focused re-session

### ⏱️ Exam Mode
- Timed assessment with configurable seconds-per-question
- Dual progress bars — question progress + timer countdown
- **Fullscreen mode** — auto-enters on start, toggle mid-exam
- **Tab-switch detection** — exam continues running, toast warning shown + counter tracked
- **Unanswered guard** — highlights missing answers in red, jumps to first unanswered on submit
- Auto-saves every 5 seconds with **timer drift correction** on resume
- Resume banner if you navigate away and return

### 📄 Test Papers
- Import structured test papers (no difficulty levels needed — just questions)
- Timed or untimed mode based on paper's `timeLimit`
- Same fullscreen + tab detection + unanswered guard as Exam Mode
- **Rich result screen** with 3 tabs:
  - **Summary** — donut chart, accuracy bars, previous attempt history
  - **Wrong Questions** — every mistake with correct answer highlighted and explanation
  - **Full Review** — all questions with pass/fail indicators and explanations
- Best score badge on paper cards, attempt count tracking

### 📊 Results History
- Filter by All / Practice / Exam
- Accuracy ring with sparkline trend line
- Score history bar chart (last 10 sessions)
- Per-session expandable breakdown with mini bar chart
- Correct/wrong answer review for each historical session

### ❌ Wrong Questions
- Aggregated list of all incorrectly answered questions
- Filter by subject
- Expandable to show correct answer and explanation
- Download as PDF (jsPDF)
- Clear all or let them auto-resolve as you practice

### 📚 Subjects
- Subjects auto-detected from imported questions
- Level distribution bar per subject (green/amber/orange/red = easy/medium/hard/expert)
- Search box to filter questions across all subjects
- Delete individual questions or entire subjects
- Reveal-on-hover delete buttons for clean UI

### 📥 Import / Export
- JSON-based question bank format with full documentation inline
- **Smart duplicate ID handling** — conflicts auto-renamed, no questions lost
- **Level normalization** — imports `beginner`, `intermediate`, `advanced` etc. and maps them automatically
- Subject override — reassign all imported questions to a specific subject
- Create empty subject folders
- Export any subject or all questions as JSON
- macOS-style sample JSON pad with Load / Copy buttons and collapsible field docs

### 🎉 Celebration System
- Canvas fireworks animation for scores ≥ 80%
- Animated score donut ring with color-coded result
- Score-tier motivational quotes (Perfect / Great / Good / Keep Going)
- XP earned badge
- Exclusive achievement chips for 100% scores

---

## 🗂️ Project Structure

```
src/
├── components/
│   ├── AppLayout.tsx          # Sidebar + header shell
│   ├── AppSidebar.tsx         # Navigation with theme toggle
│   ├── FormattedText.tsx      # Renders inline code, code blocks, LaTeX math
│   ├── NavLink.tsx            # Active-state-aware router link
│   ├── ResultCelebration.tsx  # Fireworks canvas + animated result overlay
│   └── WelcomeModal.tsx       # First-time user name capture
├── hooks/
│   ├── use-mobile.tsx         # Responsive breakpoint hook
│   ├── use-toast.ts           # Toast notification hook
│   ├── usePersistedExam.ts    # sessionStorage exam/practice persistence
│   └── useTheme.ts            # Light/dark theme with localStorage
├── lib/
│   ├── storage.ts             # All localStorage CRUD — questions, sessions, stats
│   ├── testPaperStorage.ts    # Test paper CRUD + validation + export
│   └── utils.ts               # Tailwind className helpers
├── pages/
│   ├── Dashboard.tsx          # Home with stats, XP, quick actions
│   ├── PracticePage.tsx       # Practice mode with session persistence
│   ├── ExamPage.tsx           # Timed exam with fullscreen + tab detection
│   ├── TestPapersPage.tsx     # Test paper import, quiz, rich results
│   ├── ResultsPage.tsx        # Historical results with charts
│   ├── WrongQuestionsPage.tsx # Wrong answer review + PDF export
│   ├── SubjectsPage.tsx       # Subject browser + search + delete
│   └── ImportExportPage.tsx   # JSON import/export with format guide
└── types/
    └── mcq.ts                 # TypeScript interfaces for all data models
```

---

## 📦 Question Bank JSON Format

```json
{
  "version": "1.0",
  "name": "My Question Bank",
  "questions": [
    {
      "id": "q001",
      "subject": "JavaScript",
      "level": "easy",
      "question": "What does `typeof null` return?",
      "options": ["\"null\"", "\"object\"", "\"undefined\"", "\"number\""],
      "answer": 1,
      "explanation": "Due to a historical bug, `typeof null` returns `\"object\"`."
    }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | ✅ | Unique. Duplicates auto-renamed on import |
| `subject` | string | ✅ | Any text — "Math", "Python", etc. |
| `level` | enum | ✅ | `easy` \| `medium` \| `hard` \| `expert` |
| `question` | string | ✅ | Supports `` `code` ``, ` ```blocks``` `, `$LaTeX$` |
| `options` | string[] | ✅ | 2–6 choices |
| `answer` | number | ✅ | Zero-based index of correct option |
| `explanation` | string | ✅ | Shown after answering |

**Accepted level aliases** (auto-converted): `beginner` → easy, `intermediate` → medium, `advanced` → hard, `master` → expert

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| UI Components | Radix UI + shadcn/ui |
| Routing | React Router DOM v6 |
| State / Data | localStorage + sessionStorage (no backend) |
| Math Rendering | KaTeX |
| PDF Export | jsPDF |
| Canvas FX | Native Canvas API (fireworks) |
| Icons | Lucide React |
| Hosting | Netlify |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/piyush9786/mcq-master-pro.git
cd mcq-master-pro

# Install dependencies
npm install

# Start development server
npm run dev
```

App runs at `http://localhost:8080`

### Build for Production

```bash
npm run build
```

Output goes to `dist/` — deploy anywhere that serves static files.

---

## 🧠 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                        MCQ Pro                              │
│                                                             │
│  Import JSON  →  Question Bank (localStorage)               │
│                         │                                   │
│           ┌─────────────┼──────────────┐                   │
│           ▼             ▼              ▼                    │
│      Practice       Exam Mode     Test Papers               │
│      (no timer)    (timed +       (structured               │
│                    fullscreen)     papers)                  │
│           │             │              │                    │
│           └─────────────┴──────────────┘                   │
│                         │                                   │
│                    Results + Stats                          │
│               (XP · Streaks · Accuracy)                     │
│                         │                                   │
│            Wrong Questions → PDF Export                     │
└─────────────────────────────────────────────────────────────┘
```

All data lives **100% in the browser**. No account, no server, no API calls.

---

## 🎮 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` – `4` (or more) | Select answer option |
| `Enter` | Next question / Continue after explanation |
| `←` Arrow | Previous question (Exam mode) |
| `S` | Skip & flag question (Exam mode) |
| `Esc` | Exit fullscreen |

---

## 📸 Screenshots

> **[🔗 Try it live → mcq-pro.netlify.app](https://mcq-pro.netlify.app)**

| Dashboard | Practice Mode | Exam Mode |
|-----------|---------------|-----------|
| Personalized greeting, animated stats, XP bar, subject performance | Question stepper, level chips, fullscreen quiz | Timed exam, dual progress, tab detection |

| Test Papers | Result Screen | Import/Export |
|-------------|---------------|---------------|
| Paper list with best scores | Fireworks, donut chart, wrong Q's, full review | JSON format guide, sample pad, level aliases |

---

## 🗺️ Roadmap Ideas

- [ ] AI-generated questions from pasted text/PDF
- [ ] Multiplayer quiz rooms
- [ ] Cloud sync via GitHub Gist or Supabase
- [ ] Spaced repetition scheduling
- [ ] Question difficulty auto-calibration based on attempt history
- [ ] Mobile app (React Native)
- [ ] Browser extension for quick quizzes

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push: `git push origin feat/amazing-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

<div align="center">

Built with ❤️ using React + TypeScript + Tailwind CSS

**[🚀 mcq-pro.netlify.app](https://mcq-pro.netlify.app)**

</div>
