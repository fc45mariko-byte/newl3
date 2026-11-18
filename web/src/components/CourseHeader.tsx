import Link from 'next/link';
import { LANG, Status } from './badges';
import { IconBack } from './icons';

type C = { slug: string; title: string; language: string; semesters: string[]; teacher: string | null; researchStatus: string; missing: boolean; outsideProgramme: boolean; examStatus: string | null };
export function CourseHeader({ course, tab, stats }: { course: C; tab: 'overview' | 'chapters' | 'notes' | 'resources'; stats?: string }) {
  const tabs = [['overview', 'Overview', ''], ['chapters', 'Chapters', '#chapters'], ['notes', 'Notes', '/notes'], ['resources', 'Resources', '/resources']] as const;
  return (
    <header className="flex flex-col gap-3 mb-6">
      <Link href="/courses" className="text-sm text-muted inline-flex items-center gap-1 hover:text-ink w-max"><IconBack width={16} height={16} /> Courses</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{course.semesters.join(' · ') || 'Outside the official programme'} · {LANG[course.language]}</p>
          <h1 className="font-serif text-4xl sm:text-5xl mt-1">{course.title}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted">
            {course.teacher && <span>Teacher: {course.teacher}</span>}<Status s={course.researchStatus} />{stats && <span>{stats}</span>}
            {course.examStatus && <span>Exam: {course.examStatus}</span>}
          </div>
        </div>
        <Link href={`/courses/${course.slug}/edit`} className="btn text-sm">Edit course</Link>
      </div>
      {course.missing && <p className="text-sm rounded-xl bg-coral-soft text-coral-ink px-3 py-2">No complete university material is available for this course. Its chapters are reconstructed from research and labelled as such: upload your documents in Resources and the course will be compared with them.</p>}
      <nav className="flex gap-1 border-b border-line overflow-x-auto" aria-label="Course sections">
        {tabs.map(([k, t, href]) => (
          <Link key={k} href={`/courses/${course.slug}${href}`} aria-current={tab === k ? 'page' : undefined} className={`px-3.5 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-charcoal font-semibold' : 'border-transparent text-muted hover:text-ink'}`}>{t}</Link>
        ))}
      </nav>
    </header>
  );
}
