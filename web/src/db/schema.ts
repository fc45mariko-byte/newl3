// Relational model of LEA Study. Every academic record belongs to a user through its course,
// so one student's data never mixes with another's.
import {
  pgTable, pgEnum, customType, text, integer, boolean, timestamp, jsonb, real, uuid, uniqueIndex, index, primaryKey, date,
} from 'drizzle-orm/pg-core';

export const languageEnum = pgEnum('language', ['fr', 'en', 'es']);
export const priorityEnum = pgEnum('priority', ['ESSENTIAL', 'IMPORTANT', 'ADVANCED']);
export const researchStatusEnum = pgEnum('research_status', [
  'not_researched', 'in_progress', 'reconstructed', 'university_material', 'verified',
]);
export const provenanceEnum = pgEnum('provenance', [
  'UNIVERSITY_MATERIAL', 'ACADEMIC_RESEARCH', 'OFFICIAL_SOURCE', 'RECONSTRUCTED_EXPLANATION', 'SUPPLEMENTARY_CONTEXT',
]);
export const sectionKindEnum = pgEnum('section_kind', [
  'opening', 'big_picture', 'explanation', 'key_concepts', 'comparison', 'visual', 'application', 'synthesis', 'exam', 'further',
]);
export const questionTypeEnum = pgEnum('question_type', [
  'single', 'multiple', 'true_false', 'matching', 'ordering', 'short', 'scenario',
]);
export const documentStatusEnum = pgEnum('document_status', ['pending', 'extracted', 'failed']);
export const eventKindEnum = pgEnum('event_kind', ['class', 'exam', 'assignment', 'study', 'revision', 'goal']);
export const cardStateEnum = pgEnum('card_state', ['new', 'learning', 'review']);

const now = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: now(),
}, (t) => [uniqueIndex('users_email_idx').on(t.email)]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // sha256 of the cookie token
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: now(),
});

export const academicYears = pgTable('academic_years', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull(), // e.g. 2026-2027
  isCurrent: boolean('is_current').notNull().default(true),
});

export const semesters = pgTable('semesters', {
  id: uuid('id').primaryKey().defaultRandom(),
  yearId: uuid('year_id').notNull().references(() => academicYears.id, { onDelete: 'cascade' }),
  code: text('code').notNull(), // S5, S6
  startsOn: date('starts_on'),
  endsOn: date('ends_on'),
  isCurrent: boolean('is_current').notNull().default(false),
});

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  language: languageEnum('language').notNull().default('fr'),
  semesters: text('semesters').array().notNull().default([]),
  category: text('category'),
  teacher: text('teacher'),
  officialDescription: text('official_description'),
  objectives: text('objectives'),
  importance: text('importance'), // why the course matters, in its own language
  outsideProgramme: boolean('outside_programme').notNull().default(false),
  missing: boolean('missing').notNull().default(false), // in the curriculum but no material exists
  researchStatus: researchStatusEnum('research_status').notNull().default('not_researched'),
  examStatus: text('exam_status'), // e.g. "partiel le 8 décembre" — only when known
  uncertainties: jsonb('uncertainties').$type<string[]>().notNull().default([]),
  bibliography: jsonb('bibliography').$type<string[]>().notNull().default([]),
  officialSourceKeys: text('official_source_keys').array().notNull().default([]),
  frameworks: jsonb('frameworks').$type<string[]>().notNull().default([]),
  examSkills: jsonb('exam_skills').$type<string[]>().notNull().default([]),
  /** University documents analysed by the research engine (the files themselves are in documents). */
  materials: jsonb('materials').$type<{ key: string; filename: string; author: string; nature: string; outline: string[]; issues: string[]; covers: string[] }[]>().notNull().default([]),
  position: integer('position').notNull().default(0),
  createdAt: now(),
}, (t) => [uniqueIndex('courses_user_slug_idx').on(t.userId, t.slug)]);

export const chapters = pgTable('chapters', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  position: integer('position').notNull(),
  title: text('title').notNull(),
  priority: priorityEnum('priority').notNull().default('IMPORTANT'),
  priorityReason: text('priority_reason'),
  researchStatus: researchStatusEnum('research_status').notNull().default('not_researched'),
  provenance: provenanceEnum('provenance').array().notNull().default([]),
  summary: text('summary'),
  note: text('note'),
  prerequisites: text('prerequisites').array().notNull().default([]),
  sourceKeys: text('source_keys').array().notNull().default([]),
  materialKeys: text('material_keys').array().notNull().default([]),
  createdAt: now(),
}, (t) => [uniqueIndex('chapters_course_slug_idx').on(t.courseId, t.slug)]);

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  publishedOn: text('published_on'),
  url: text('url'),
  type: text('type'),
  tier: text('tier').notNull().default('P3'), // P1 university, P2 other universities, P3 academic / institutional
  access: text('access').notNull().default('reference'), // read | excerpt | reference
  relevance: text('relevance').notNull().default(''),
  createdAt: now(),
}, (t) => [uniqueIndex('sources_user_key_idx').on(t.userId, t.key)]);

export const sections = pgTable('sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  kind: sectionKindEnum('kind').notNull(),
  position: integer('position').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(), // Markdown
  provenance: provenanceEnum('provenance').notNull(),
  sourceKeys: text('source_keys').array().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const concepts = pgTable('concepts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  term: text('term').notNull(),
  language: languageEnum('language').notNull().default('fr'),
  translations: jsonb('translations').$type<{ fr?: string; en?: string; es?: string }>().notNull().default({}),
  definition: text('definition').notNull().default(''),
  intuitive: text('intuitive'),
  academic: text('academic'),
  analytical: text('analytical'),
  example: text('example'),
  examRelevance: text('exam_relevance'),
  level: text('level'), // P prerequisite, F core, A advanced
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}), // structured blocks from the cours repo
  provenance: provenanceEnum('provenance').array().notNull().default([]),
  sourceKeys: text('source_keys').array().notNull().default([]),
  toCheck: text('to_check'),
  createdAt: now(),
}, (t) => [uniqueIndex('concepts_user_slug_idx').on(t.userId, t.slug)]);

export const conceptChapters = pgTable('concept_chapters', {
  conceptId: uuid('concept_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.conceptId, t.chapterId] })]);

export const conceptLinks = pgTable('concept_links', {
  fromId: uuid('from_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  toId: uuid('to_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  relation: text('relation').notNull().default('related'), // prerequisite | related | contrast
}, (t) => [primaryKey({ columns: [t.fromId, t.toId, t.relation] })]);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  sha256: text('sha256').notNull(),
  storagePath: text('storage_path').notNull(),
  status: documentStatusEnum('status').notNull().default('pending'),
  error: text('error'),
  text: text('text'),
  structure: jsonb('structure').$type<{ headings: { level: number; text: string; page?: number }[]; tables: number; pages?: number }>(),
  author: text('author'),
  note: text('note'),
  createdAt: now(),
}, (t) => [uniqueIndex('documents_user_sha_idx').on(t.userId, t.sha256)]);

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  conceptId: uuid('concept_id').references(() => concepts.id, { onDelete: 'set null' }),
  kind: text('kind').notNull().default('note'), // note | definition | quotation | question
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  tags: text('tags').array().notNull().default([]),
  bookmarked: boolean('bookmarked').notNull().default(false),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('notes_user_idx').on(t.userId)]);

// Original uploaded files, kept in the database so a host without a persistent disk loses nothing.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });
export const documentFiles = pgTable('document_files', {
  documentId: uuid('document_id').primaryKey().references(() => documents.id, { onDelete: 'cascade' }),
  content: bytea('content').notNull(),
});

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  conceptId: uuid('concept_id').references(() => concepts.id, { onDelete: 'set null' }),
  key: text('key').notNull(),
  type: questionTypeEnum('type').notNull(),
  difficulty: integer('difficulty').notNull().default(1),
  topic: text('topic').notNull().default(''), // competence: memorise, apply, analyse…
  stem: text('stem').notNull(),
  support: jsonb('support').$type<Record<string, unknown> | null>(),
  // single/multiple/true_false: {choices:[{id,text,correct,explanation}]}
  // matching: {pairs:[{left,right}]}, ordering: {items:[...] in correct order}
  // short/scenario: {rubric:[...], modelAnswer, accepted?:[...]}
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  explanation: text('explanation'),
  reference: text('reference'),
}, (t) => [uniqueIndex('questions_chapter_key_idx').on(t.chapterId, t.key)]);

export const quizAttempts = pgTable('quiz_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(), // chapter | mixed | exam | weakness | mastery | topic
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'cascade' }),
  questionIds: uuid('question_ids').array().notNull(),
  timeLimitSec: integer('time_limit_sec'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  score: real('score'),
  maxScore: real('max_score'),
});

export const answers = pgTable('answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptId: uuid('attempt_id').notNull().references(() => quizAttempts.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  response: jsonb('response').notNull(),
  score: real('score').notNull(), // 0..1
  correct: boolean('correct').notNull(),
  evaluation: text('evaluation').notNull().default('auto'), // auto | needs_review | self_assessed
  answeredAt: timestamp('answered_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('answers_attempt_question_idx').on(t.attemptId, t.questionId)]);

export const flashcards = pgTable('flashcards', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  kind: text('kind').notNull().default('concept'), // concept | mechanism | date | distinction | vocabulary
  front: text('front').notNull(),
  back: text('back').notNull(),
  extra: jsonb('extra').$type<{ mustInclude?: string[]; mistakes?: string[] }>().notNull().default({}),
}, (t) => [uniqueIndex('flashcards_chapter_key_idx').on(t.chapterId, t.key)]);

export const cardStates = pgTable('card_states', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => flashcards.id, { onDelete: 'cascade' }),
  state: cardStateEnum('state').notNull().default('new'),
  ease: real('ease').notNull().default(2.5),
  intervalDays: integer('interval_days').notNull().default(0),
  repetitions: integer('repetitions').notNull().default(0),
  lapses: integer('lapses').notNull().default(0),
  dueAt: timestamp('due_at', { withTimezone: true }).defaultNow().notNull(),
  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.userId, t.cardId] })]);

export const exercises = pgTable('exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  difficulty: integer('difficulty').notNull().default(1),
  statement: text('statement').notNull(),
  data: jsonb('data').$type<{ headers: string[]; rows: string[][] } | null>(),
  fictional: boolean('fictional').notNull().default(true),
  parts: jsonb('parts').$type<{ id: string; prompt: string; answer: Record<string, unknown>; correction: string[]; mistakes?: string[] }[]>().notNull(),
}, (t) => [uniqueIndex('exercises_chapter_key_idx').on(t.chapterId, t.key)]);

export const exerciseAttempts = pgTable('exercise_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  partId: text('part_id').notNull(),
  response: jsonb('response').notNull(),
  correct: boolean('correct'),
  createdAt: now(),
});

export const chapterProgress = pgTable('chapter_progress', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.userId, t.chapterId] })]);

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  details: text('details'),
  dueOn: date('due_on'),
  priority: text('priority').notNull().default('normal'), // high | normal | low
  category: text('category'),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  doneAt: timestamp('done_at', { withTimezone: true }),
  createdAt: now(),
});

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  kind: eventKindEnum('kind').notNull(),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  weekly: boolean('weekly').notNull().default(false),
  repeatUntil: date('repeat_until'),
  location: text('location'),
  source: text('source'), // where the information comes from, e.g. a document
  createdAt: now(),
});

export const objectives = pgTable('objectives', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  progress: integer('progress').notNull().default(0), // 0..100, set by the student
  done: boolean('done').notNull().default(false),
  position: integer('position').notNull().default(0),
  createdAt: now(),
});

export const aiConversations = pgTable('ai_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  title: text('title').notNull().default('Conversation'),
  createdAt: now(),
});

export const aiMessages = pgTable('ai_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // user | assistant
  mode: text('mode'),
  content: text('content').notNull(),
  createdAt: now(),
});
