'use client';
import { ActionForm } from './ActionForm';
import { saveNote } from '@/app/actions/notes';

export function QuickNote({ courseSlug, chapterId }: { courseSlug: string; chapterId: string }) {
  return (
    <ActionForm action={saveNote.bind(null, courseSlug, null)} submit="Save note" reset className="flex flex-col gap-2">
      <input type="hidden" name="chapterId" value={chapterId} />
      <label className="sr-only" htmlFor="qn-title">Title</label>
      <input id="qn-title" className="input !py-1.5 text-sm" name="title" placeholder="Title" required maxLength={200} />
      <label className="sr-only" htmlFor="qn-body">Note</label>
      <textarea id="qn-body" className="input text-sm min-h-24" name="body" placeholder="What you understood, a question for your teacher, a quotation…" />
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="qn-kind">Type</label>
        <select id="qn-kind" name="kind" className="input !py-1.5 text-sm"><option value="note">Note</option><option value="definition">Definition</option><option value="quotation">Quotation</option><option value="question">Question</option></select>
      </div>
    </ActionForm>
  );
}
