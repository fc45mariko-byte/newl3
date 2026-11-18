# LEA · Study

A study application for the L3 LEA *Affaires et commerce international* (Université d'Orléans, 2026-2027). It holds courses, chapters, notes and documents. It also provides a knowledge base with a concept graph, a planner, tasks, quizzes, flashcards, exercises, analytics and an AI study companion.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, server components, server actions), React 19, TypeScript 5.9 |
| Styling | Tailwind CSS 4 (`@theme` tokens in `src/app/globals.css`), DM Serif Display + Inter (self-hosted via Fontsource) |
| Database | PostgreSQL 16, Drizzle ORM, SQL migrations in `drizzle/` |
| Auth | Email + password (bcrypt), opaque session token in an httpOnly cookie, SHA-256 of the token stored in `sessions` |
| Documents | `.pdf` (unpdf), `.docx` (mammoth), `.pptx` (JSZip: slides, titles, notes, tables), `.txt` / `.md` |
| AI | `@anthropic-ai/sdk`, streaming Messages API; web search tool in *Research* mode |
| Graph | d3-force |
| Tests | Vitest (unit), Playwright (end-to-end, desktop + Pixel 7) |

## Running it

Requirements: Node 22+ (Node 24 recommended, see limitations) and PostgreSQL 16.

```bash
cd web
cp .env.example .env            # then edit DATABASE_URL etc.
npm install
createdb leastudy               # or any database named in DATABASE_URL
npm run db:migrate              # applies drizzle/0000…0002
npm run db:seed                 # optional: creates one account with the full curriculum
npm run dev                     # http://localhost:3000
# production
npm run build && npm start
```

Any account created through **Sign up** receives the full curriculum (23 courses) automatically. `db:seed` does the same from the command line and can also ingest a folder of course files:

```bash
SEED_EMAIL=me@example.com SEED_PASSWORD='…' SEED_NAME='Prénom' SEED_UPLOADS_DIR=/path/to/files npm run db:seed
```

When the curriculum changes (new course material, rewritten chapters), existing accounts are brought up to date with **Settings → Update course content**, or from the command line:

```bash
npm run db:sync                     # every account
SYNC_EMAIL=me@example.com npm run db:sync
```

The update replaces generated content only: sections, concepts, questions, flashcards, exercises, chapter metadata, and the research fields of courses (status, uncertainties, materials).

It never changes:
- notes, documents, quiz answers, flashcard reviews, exercise attempts or reading progress;
- events, tasks, or chapters the student added;
- course fields the student can edit (title, language, semesters, category, teacher, description, exam status).

Generated items removed from the curriculum are deleted only if they were never used.

To regenerate `data/curriculum.json` from the `cours` repository and the research in `../recherche`:

```bash
COURS_DIR=../../cours npx tsx scripts/build-curriculum.ts
```

### Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | yes | `postgres://user:pass@host:5432/leastudy` |
| `STORAGE_DIR` | no (default `./storage`) | Where uploaded originals are stored, one folder per user |
| `ANTHROPIC_API_KEY` | for the companion | Without it, the companion panel says it is not configured and `/api/assistant` returns 503 |
| `ANTHROPIC_MODEL` | no (default `claude-opus-5-5`) | Model used by the companion |
| `COURS_DIR` | only for `build-curriculum.ts` | Path to the `cours` repository |

## Structure

```
src/app/(auth)        login, signup
src/app/(app)         dashboard, courses, documents, knowledge, planner, tasks, revision, settings
src/app/actions       server actions (all mutations, validated with zod, scoped to the signed-in user)
src/app/api           assistant (streaming), document download
src/lib               scoring, sm2, mastery, revision-plan, extract, documents, quiz, analytics, dates, import-curriculum, sync-curriculum
src/components        UI (Shell, Markdown, Diagram, ConceptCard, quiz/, planner/, …)
data/                 curriculum.json (generated), chapters/*.json (hand-written chapters), courses/*.json (course overrides;
                      "merge": true keeps the generated chapters and questions and adds or rewrites the listed chapters)
drizzle/              migrations
tests/unit, tests/e2e
```

### Database

The main tables, all scoped by `user_id`:

- **Curriculum:** `academic_years` → `semesters` → `courses` → `chapters` → `sections`.
  - A chapter has ten section kinds: opening, big_picture, explanation, key_concepts, comparison, visual, application, synthesis, exam, further.
  - Courses carry language, priority, research status, bibliography, frameworks, exam skills, materials, missing items and uncertainties.
  - Sections carry a provenance label: university material, academic research, official source, reconstructed explanation or supplementary context.
- **Knowledge:**
  - `concepts`, with three explanation levels (intuitive, academic, analytical);
  - `concept_chapters` and `concept_links` (typed links, which feed the graph);
  - `sources`;
  - `notes` (with tags, kind and bookmark);
  - `documents` (original file, extracted text, status, SHA-256 dedupe).
  - Full-text GIN indexes on concepts, notes and documents.
- **Practice:**
  - `questions` (single, multiple, true_false, matching, ordering, short, scenario), `quiz_attempts` and `answers`;
  - `flashcards` and `card_states` (SM-2);
  - `exercises` and `exercise_attempts`;
  - `chapter_progress`.
- **Organisation:** `tasks`, `events` (weekly recurrence with `repeat_until`, source manual or plan), `objectives`.
- **Companion:** `ai_conversations`, `ai_messages`.
- **Auth:** `users`, `sessions`.

## What is implemented

- **Dashboard.**
  - Shows today's classes and deadlines, open tasks, cards due, chapters read and mastery.
  - Shows weekly objectives, a mini calendar, the next exams and concepts that need work.
- **Courses.**
  - Courses are grouped by semester. Each shows its priority, research status and language: each course is shown in its own language, with Tourism in English and the language courses in their language.
  - Courses can be created and edited.
  - Missing chapters can be added; an ESSENTIAL chapter requires a written reason.
  - Missing-course detection: for example, *Introduction to International Tourism* is flagged as reconstructed and lists what is missing.
  - A reconstruction can be requested.
- **Chapters.**
  - Ten-part layout. Each section shows its provenance label.
  - Concepts can be read at three levels.
  - Interactive diagrams: flux, Incoterms and documentary credit in French; equilibrium; Leiper and Butler in English.
  - Prerequisites, previous and next chapter, read and mastered status.
- **Documents.**
  - Upload of several files at once (max 25 MB each), with text extraction, an extracted-text view and download of the original.
  - Unsupported types are refused with a message.
  - PDFs without a text layer are marked as failed.
- **Notes.** Markdown editor with preview, `[[concept]]` links, tags, kinds, bookmarks; create, edit and delete.
- **Knowledge.** Search across concepts, notes and documents; tag filter; bookmarks; concept pages with linked concepts and chapters; force-directed graph.
- **Planner.**
  - Week, month and semester views.
  - Classes, exams, deadlines and study sessions, with weekly recurrence that stays correct across daylight-saving changes.
  - An event can be edited, or deleted once or for every occurrence.
  - Revision-plan suggestion before an exam: it keeps one rest day, flags any shortfall, and is added to the planner in one click.
- **Tasks.** Create, edit, complete and delete; priority, due date and course; filters. Changes appear on the dashboard.
- **Revision.**
  - Quiz modes: chapter, topic, mixed, timed exam (answers saved without feedback until handed in), weakness, mastery.
  - Seven question types with feedback and explanations.
  - Partial credit for several-answer, matching and ordering questions.
  - Short and case answers are self-assessed against a model answer and rubric.
  - Answers persist across reloads; results page; a quiz can be restarted.
  - Correct answers are never sent to the browser before grading.
  - Also: SM-2 flashcards, exercises with numeric checking and corrections, and analytics by course and question type.
- **Companion.**
  - Side panel with eight modes: Explain, Compare, Connect, Challenge, Research, Examine, Simplify, Deep dive.
  - Context comes from the current page: course, chapter sections, concepts, the student's notes and documents, and recent mistakes. It answers in the course's language.
  - Conversations are saved.
- **Content updates.** Settings → *Update course content* (or `npm run db:sync`) applies a new curriculum to existing accounts without touching the student's work (see *Running it*).
- **Layout.** Charcoal sidebar on desktop and bottom navigation on phones. No horizontal scrolling at phone width (tested).

## Tests

```bash
npm test                     # Vitest: 35 unit tests + 3 integration tests (content sync, against leastudy_test)
npm run test:e2e             # Playwright: 16 tests (needs a database named in playwright.config.ts and `npm run build` first)
```

The e2e suite runs against the production build on port 3100, with a separate database (`leastudy_test`) and storage folder (`storage-test`). Last run: **16/16 passed**, and **38/38 Vitest tests passing**. The workflows covered:

1. Sign-up imports the curriculum, and the dashboard reflects it.
2. Every main navigation link opens a working page.
3. Course creation and editing, including server-side validation and the ESSENTIAL justification.
4. Upload of pptx and txt files, rejection of a png, extracted-text view, byte-identical download, and full-text search over the extracted text.
5. Chapter reading: three explanation levels, read status, next chapter, and the dashboard counter.
6. Notes: create, persist, edit, filter by tag and delete.
7. Tasks: create, complete (the dashboard count updates) and delete.
8. Calendar: time validation, weekly event, delete every occurrence.
9. Revision plan suggestion added to the planner.
10. Logging out and back in keeps the data.
11. Chapter quiz with all question types: changing an answer before checking, locking once evaluated, persistence after reload, self-assessment, results and restart.
12. Timed exam: no feedback before hand-in, unanswered questions count as 0.
13. Flashcard grading schedules the card.
14. Exercises are checked and the correction is shown.
15. Research course: the two interactive diagrams, and *Update course content* in Settings, after which the edited course details and the added chapter are still there.
16. Phone: bottom navigation and no horizontal overflow on 14 pages, an interactive diagram, and the companion panel.

The unit tests cover:

- scoring for every question type;
- SM-2 scheduling;
- mastery and the revision planner;
- document extraction (docx, pptx, txt, refusals);
- dates and recurrence across daylight-saving changes;
- content sync (integration): a new chapter is added and rewritten sections are replaced; the course title and teacher the student edited, notes, reading progress, a student-added chapter, an answered question and a reviewed card are all kept; an unused stale question is removed; a second run changes nothing.

## Known limitations and incomplete parts

- **The AI companion has not been tested against the API**, because no key was available while building. The configuration-missing path is tested; streaming, persistence of replies and Research mode (web search) are written but unverified.
- **Content depth varies.**
  - Only one chapter, *L'opération d'import-export* (`data/chapters/tci.operation.json`), is fully written in the ten-part architecture.
  - The Tourism course (`data/courses/tou.json`) is written from the student's notes and research.
  - The research course (`red`) and internship course (`stg`) are written from the two TD handouts received on 18/11/2026 (`data/courses/red.json` and `stg.json`). Five chapters are new or rewritten; *Argumentation*, *Citer et référencer*, *Recherche de stage*, *La soutenance* and *Évaluation* remain reconstructed.
  - The other chapters come from the `cours` repository: notions, syntheses, glossaries, steps. Sections that do not exist yet are flagged as missing rather than invented.
- `unpdf` declares Node ≥ 24. Extraction works on Node 22 in the tests, but Node 24 is the supported runtime.
- Scanned PDFs (no text layer) are stored but not read: there is no OCR.
- Documents whose filename does not match a course material (for example, the container-transport article) are not assigned to a course automatically.
- The interface (navigation, buttons) is in English. Course content is in each course's language.
- There is no deployment configuration, no password reset and no email verification.
- Recurrence is weekly only.
