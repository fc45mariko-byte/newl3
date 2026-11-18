'use client';
import { ActionForm } from './ActionForm';

type V = { title?: string; language?: string; semesters?: string[]; category?: string | null; teacher?: string | null; officialDescription?: string | null; examStatus?: string | null };
export function CourseForm({ action, values = {}, submit }: { action: (s: { error?: string; ok?: string } | undefined, f: FormData) => Promise<{ error?: string; ok?: string } | undefined>; values?: V; submit: string }) {
  return (
    <ActionForm action={action} submit={submit} className="card p-5 flex flex-col gap-4 max-w-2xl">
      <label className="label">Course title<input className="input" name="title" defaultValue={values.title} required maxLength={140} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="label">Language of instruction
          <select className="input" name="language" defaultValue={values.language ?? 'fr'}><option value="fr">French</option><option value="en">English</option><option value="es">Spanish</option></select>
        </label>
        <fieldset className="label"><legend className="mb-1">Semester</legend>
          <div className="flex gap-4 text-ink">{['S5', 'S6'].map((x) => <label key={x} className="flex items-center gap-1.5"><input type="checkbox" name="semesters" value={x} defaultChecked={values.semesters?.includes(x)} />{x}</label>)}</div>
        </fieldset>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="label">Category<input className="input" name="category" defaultValue={values.category ?? ''} placeholder="e.g. Commerce international" /></label>
        <label className="label">Teacher<input className="input" name="teacher" defaultValue={values.teacher ?? ''} /></label>
      </div>
      <label className="label">Official description (from the university, if you have it)<textarea className="input min-h-28" name="officialDescription" defaultValue={values.officialDescription ?? ''} /></label>
      <label className="label">Examination (only what you know for sure)<input className="input" name="examStatus" defaultValue={values.examStatus ?? ''} placeholder="e.g. written exam, 2 h, in January" /></label>
    </ActionForm>
  );
}
