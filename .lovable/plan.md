## Plan

### 1. Subject/Folder Creation in Import
- Add a "Create Subject" input in the Import/Export page where users can type a new subject name
- Also auto-detect subjects from imported JSON
- Allow overriding the subject field during import

### 2. New Test Papers Page
- New type `TestPaper` with: id, title, timeLimit, questions (no difficulty level)
- New `TestQuestion` type: id, question, options, answer, explanation (no level/subject)
- Dedicated route `/test-papers`
- Features: take test (ordered questions), timer, score, results review, bookmarks, wrong questions tracking
- Separate Import/Export for test papers on the same page
- Save test paper progress (like exam persistence)

### 3. Storage & Types
- Add test paper types to `src/types/mcq.ts`
- Add test paper storage functions to a new `src/lib/testPaperStorage.ts`
- Add sidebar nav item for "Test Papers"

### 4. Files to create/modify:
- `src/types/mcq.ts` — add TestPaper, TestQuestion types
- `src/lib/testPaperStorage.ts` — new storage module
- `src/pages/TestPapersPage.tsx` — new page with list, take test, import/export
- `src/pages/TakeTestPage.tsx` — the actual test-taking UI
- `src/pages/TestResultPage.tsx` — test result view
- `src/components/AppSidebar.tsx` — add nav item
- `src/App.tsx` — add routes
- `src/pages/ImportExportPage.tsx` — add subject creation UI
