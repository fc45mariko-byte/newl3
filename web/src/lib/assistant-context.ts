import 'server-only';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db, schema as s } from '@/db';

export const MODES = {
  explain: 'Explain the concept from first principles: start from the situation that makes it necessary, then the mechanism, then the precise terminology.',
  compare: 'Compare the notions the student names: similarities, differences, and the situations where the difference matters in an exam.',
  connect: 'Find genuine connections with other courses of her curriculum and with economics, history, geopolitics or institutions. Only connections that clarify the subject.',
  challenge: 'Ask her one question at a time that tests understanding (not recall). Wait for her answer, then say precisely what is right, what is missing and why.',
  research: 'Research the question with web search. Prefer official, institutional and academic sources. Cite each source with title, publisher, date and URL. Separate verified facts from interpretation and say what you could not verify.',
  examine: 'Act as a university examiner. Evaluate the answer she gives against what an L3 examiner expects: accuracy, terminology, structure, examples. Give a mark out of 20 with a justification, then the main improvements.',
  simplify: 'Make the explanation more accessible without losing anything essential. Keep the original terminology and explain it.',
  deep_dive: 'Explore the subject beyond the syllabus: history, debates, limits, current developments. Say clearly which parts go beyond what the exam requires.',
} as const;
export type Mode = keyof typeof MODES;

const LANG_NAME = { fr: 'French', en: 'English', es: 'Spanish' } as const;

/** Builds the system prompt: who the student is, how to behave, and the active course material. */
export async function buildContext(userId: string, courseSlug?: string | null, chapterSlug?: string | null) {
  let course: typeof s.courses.$inferSelect | undefined;
  let chapter: typeof s.chapters.$inferSelect | undefined;
  if (courseSlug) [course] = await db.select().from(s.courses).where(and(eq(s.courses.userId, userId), eq(s.courses.slug, courseSlug)));
  if (course && chapterSlug) [chapter] = await db.select().from(s.chapters).where(and(eq(s.chapters.courseId, course.id), eq(s.chapters.slug, chapterSlug)));

  const parts: string[] = [
    `You are the academic companion inside LEA Study, for a third-year LEA student (English C2, Spanish B2) in International Business at the Université d'Orléans, preparing for a Master's degree or Erasmus.
She learns best by understanding structure before details, through concrete situations, comparisons, historical examples and connections between disciplines. Do not reduce knowledge to definitions to memorise.
Behaviour: explain your reasoning, distinguish established facts from interpretation, point out misconceptions and challenge incorrect assumptions, ask a useful question when it helps her think. Avoid empty praise and superficial answers. Write in developed paragraphs; use lists only when they genuinely help.
Never invent university requirements, teacher instructions, exam formats, quotations, statistics or references. When the course material below does not cover something, say so in one line ("Not in your course material:") before adding general knowledge. Material labelled as reconstructed is not the teacher's course: never present it as such.`,
  ];
  if (course) {
    parts.push(`Language: this course is taught in ${LANG_NAME[course.language]}. Answer in ${LANG_NAME[course.language]} unless she writes in another language or asks otherwise. Keep the course's original terminology; you may add a translation in brackets for difficult terms.`);
    const chs = await db.select({ title: s.chapters.title, slug: s.chapters.slug }).from(s.chapters).where(eq(s.chapters.courseId, course.id)).orderBy(asc(s.chapters.position));
    parts.push(`Current course: ${course.title}. Chapters: ${chs.map((c) => c.title).join('; ')}.${course.officialDescription ? `\nOfficial description (university website): ${course.officialDescription}` : ''}`);
  } else {
    parts.push('No course is open. Answer in the language she writes in.');
  }
  if (chapter) {
    parts.push(`Current chapter: ${chapter.title} (priority ${chapter.priority}).`);
    const secs = await db.select().from(s.sections).where(eq(s.sections.chapterId, chapter.id)).orderBy(asc(s.sections.position));
    const conceptRows = await db.select({ term: s.concepts.term, definition: s.concepts.definition, intuitive: s.concepts.intuitive })
      .from(s.conceptChapters).innerJoin(s.concepts, eq(s.concepts.id, s.conceptChapters.conceptId)).where(eq(s.conceptChapters.chapterId, chapter.id)).orderBy(asc(s.conceptChapters.position));
    const text = [
      ...secs.map((x) => `[${x.title} — ${x.provenance}]\n${x.body}`),
      ...conceptRows.map((c) => `- ${c.term}: ${c.definition} ${c.intuitive ?? ''}`),
    ].join('\n\n');
    parts.push(`Chapter material:\n${text.slice(0, 24000)}`);
    const notes = await db.select({ title: s.notes.title, body: s.notes.body }).from(s.notes).where(and(eq(s.notes.userId, userId), eq(s.notes.chapterId, chapter.id))).orderBy(desc(s.notes.updatedAt)).limit(5);
    if (notes.length) parts.push(`Her notes on this chapter:\n${notes.map((n) => `- ${n.title}: ${n.body.slice(0, 800)}`).join('\n')}`);
    const docs = await db.select({ filename: s.documents.filename, text: s.documents.text }).from(s.documents)
      .where(and(eq(s.documents.userId, userId), eq(s.documents.courseId, course!.id), eq(s.documents.status, 'extracted'))).limit(4);
    if (docs.length) parts.push(`Her university documents for this course (extracted text, may be partial):\n${docs.map((d) => `### ${d.filename}\n${(d.text ?? '').slice(0, 5000)}`).join('\n\n')}`);
    // Recent mistakes on this chapter, so explanations can target them.
    const wrong = await db.select({ stem: s.questions.stem }).from(s.answers)
      .innerJoin(s.quizAttempts, eq(s.quizAttempts.id, s.answers.attemptId))
      .innerJoin(s.questions, eq(s.questions.id, s.answers.questionId))
      .where(and(eq(s.quizAttempts.userId, userId), eq(s.questions.chapterId, chapter.id), eq(s.answers.correct, false)))
      .orderBy(desc(s.answers.answeredAt)).limit(5);
    if (wrong.length) parts.push(`Questions she recently got wrong in this chapter:\n${wrong.map((w) => `- ${w.stem}`).join('\n')}`);
  }
  void inArray;
  return { system: parts.join('\n\n'), course, chapter };
}
