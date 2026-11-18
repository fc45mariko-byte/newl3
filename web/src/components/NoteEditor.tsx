'use client';
import { useRef, useState } from 'react';
import { ActionForm } from './ActionForm';
import { Markdown } from './Markdown';
import { saveNote } from '@/app/actions/notes';

type N = { id: string; title: string; body: string; kind: string; tags: string[]; chapterId: string | null };
export function NoteEditor({ courseSlug, chapters, note, onDone }: { courseSlug: string | null; chapters: { id: string; title: string }[]; note?: N; onDone?: () => void }) {
  const [body, setBody] = useState(note?.body ?? '');
  const [preview, setPreview] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const wrap = (before: string, after = before, placeholder = 'text') => {
    const el = ta.current; if (!el) return;
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const sel = body.slice(a, b) || placeholder;
    const next = body.slice(0, a) + before + sel + after + body.slice(b);
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, a + before.length + sel.length); });
  };
  const line = (prefix: string) => {
    const el = ta.current; if (!el) return;
    const a = body.lastIndexOf('\n', el.selectionStart - 1) + 1;
    setBody(body.slice(0, a) + prefix + body.slice(a));
    requestAnimationFrame(() => el.focus());
  };
  const tools: [string, string, () => void][] = [
    ['B', 'Bold', () => wrap('**')], ['I', 'Italic', () => wrap('*')], ['H', 'Heading', () => line('### ')], ['•', 'Bullet list', () => line('- ')],
    ['▮', 'Highlight', () => wrap('==')], ['[[ ]]', 'Link to a concept', () => wrap('[[', ']]', 'concept')], ['❝', 'Quotation', () => line('> ')],
  ];
  const id = note?.id ?? 'new';
  return (
    <ActionForm action={async (s, f) => { const r = await saveNote(courseSlug, note?.id ?? null, s, f); if (r?.ok) { if (!note) setBody(''); onDone?.(); } return r; }} submit={note ? 'Save changes' : 'Save note'} reset={!note}>
      <label className="label">Title<input className="input" name="title" defaultValue={note?.title} required maxLength={200} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">Type<select className="input" name="kind" defaultValue={note?.kind ?? 'note'}><option value="note">Note</option><option value="definition">Definition</option><option value="quotation">Quotation</option><option value="question">Question</option></select></label>
        <label className="label">Chapter<select className="input" name="chapterId" defaultValue={note?.chapterId ?? ''}><option value="">None</option>{chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Formatting">
          {tools.map(([t, l, f]) => <button key={l} type="button" className="btn !py-1 !px-2 text-xs" title={l} aria-label={l} onClick={f} disabled={preview}>{t}</button>)}
          <button type="button" className="btn !py-1 !px-2 text-xs ml-auto" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</button>
        </div>
        <label className="sr-only" htmlFor={`body-${id}`}>Note</label>
        {preview ? <div className="input min-h-40"><Markdown text={body || '*Empty note.*'} /></div>
          : <textarea ref={ta} id={`body-${id}`} className="input min-h-40 font-[inherit]" value={body} onChange={(e) => setBody(e.target.value)} />}
        <input type="hidden" name="body" value={body} />
        <p className="text-xs text-muted">**bold**, *italic*, ==highlight==, [[concept]] links to the knowledge base.</p>
      </div>
      <label className="label">Tags (comma-separated)<input className="input" name="tags" defaultValue={note?.tags.join(', ')} placeholder="incoterms, risque" /></label>
    </ActionForm>
  );
}
