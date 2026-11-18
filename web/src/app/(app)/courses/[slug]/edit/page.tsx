import { requireUser } from '@/lib/auth';
import { getCourse } from '@/lib/course-data';
import { updateCourse } from '@/app/actions/courses';
import { CourseForm } from '@/components/CourseForm';
import { CourseHeader } from '@/components/CourseHeader';

export default async function EditCourse({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = await requireUser();
  const c = await getCourse(u.id, slug);
  return (
    <div>
      <CourseHeader course={c} tab="overview" />
      <h2 className="font-serif text-2xl mb-3">Edit course details</h2>
      <CourseForm action={updateCourse.bind(null, slug)} values={c} submit="Save changes" />
    </div>
  );
}
