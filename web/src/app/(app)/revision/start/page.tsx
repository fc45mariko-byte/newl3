import { requireUser } from '@/lib/auth';
import { quizCourses } from '@/lib/revision-courses';
import { StartForm } from '@/components/quiz/StartForm';
export const metadata = { title: 'Start a quiz' };
export default async function Start({ searchParams }: { searchParams: Promise<{ mode?: string; chapter?: string; course?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  return <div className="max-w-3xl"><StartForm courses={await quizCourses(u.id)} initialMode={sp.mode} initialChapter={sp.chapter} initialCourse={sp.course} /></div>;
}
