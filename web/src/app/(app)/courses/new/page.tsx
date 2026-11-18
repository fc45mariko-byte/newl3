import { createCourse } from '@/app/actions/courses';
import { CourseForm } from '@/components/CourseForm';
export const metadata = { title: 'New course' };
export default function NewCourse() {
  return (
    <div className="flex flex-col gap-4">
      <div><p className="eyebrow">Courses</p><h1 className="font-serif text-4xl mt-1">Add a course</h1>
        <p className="text-muted mt-2 max-w-2xl">A new course starts empty and is marked as missing material. Upload your documents or add chapters; nothing is invented on your behalf.</p></div>
      <CourseForm action={createCourse} submit="Create course" />
    </div>
  );
}
