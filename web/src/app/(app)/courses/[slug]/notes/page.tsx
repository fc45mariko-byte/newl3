import { and, asc, desc, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { getCourse } from '@/lib/course-data';
import { db, schema as s } from '@/db';
import { CourseHeader } from '@/components/CourseHeader';
import { NoteEditor } from '@/components/NoteEditor';
import { NoteList } from '@/components/NoteList';

export default async function CourseNotes({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = await requireUser();
  const course = await getCourse(u.id, slug);
  const notes = await db.select({ n: s.notes, chapter: s.chapters.title }).from(s.notes).leftJoin(s.chapters, eq(s.chapters.id, s.notes.chapterId))
    .where(and(eq(s.notes.userId, u.id), eq(s.notes.courseId, course.id))).orderBy(desc(s.notes.updatedAt));
  const chapters = await db.select({ id: s.chapters.id, title: s.chapters.title }).from(s.chapters).where(eq(s.chapters.courseId, course.id)).orderBy(asc(s.chapters.position));
  return (
    <div>
      <CourseHeader course={course} tab="notes" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <NoteList notes={notes.map((x) => ({ ...x.n, chapter: x.chapter }))} courseSlug={slug} chapters={chapters} />
        <aside className="card p-5 h-max"><h2 className="font-serif text-xl mb-3">New note</h2><NoteEditor courseSlug={slug} chapters={chapters} /></aside>
      </div>
    </div>
  );
}
