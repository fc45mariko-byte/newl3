'use client';
import { useState, useTransition } from 'react';
import { Markdown } from './Markdown';
import { NoteEditor } from './NoteEditor';
import { deleteNote, toggleBookmark } from '@/app/actions/notes';

type N = { id: string; title: string; body: string; kind: string; tags: string[]; chapterId: string | null; chapter?: string | null; bookmarked: boolean; updatedAt: Date; course?: string | null };
const KIND: Record<string, string> = { note: 'Note', definition: 'Definition', quotation: 'Quotation', question: 'Question' };

export function NoteList({ notes, courseSlug, chapters }: { notes: N[]; courseSlug: string | null; chapters: { id: string; title: string }[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [, start] = useTransition();
  if (!notes.length) return <div className="card p-8 text-center text-muted">No note yet. Write the first one: what you understood, a definition, a question for your teacher.</div>;
  return (
    <ul className="flex flex-col gap-3 min-w-0">
      {notes.map((n) => (
        <li key={n.id} className="card p-4">
          {editing === n.id ? <NoteEditor courseSlug={courseSlug} chapters={chapters} note={n} onDone={() => setEditing(null)} /> : (<>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><h3 className="font-serif text-xl">{n.title}</h3>
                <p className="text-xs text-muted">{KIND[n.kind]}{n.course ? ` · ${n.course}` : ''}{n.chapter ? ` · ${n.chapter}` : ''} · {new Date(n.updatedAt).toLocaleDateString('en-GB')}</p></div>
              <div className="flex gap-1.5">
                <button className="btn !py-1 text-xs" aria-pressed={n.bookmarked} onClick={() => start(() => toggleBookmark(n.id, !n.bookmarked))}>{n.bookmarked ? '★ Bookmarked' : '☆ Bookmark'}</button>
                <button className="btn !py-1 text-xs" onClick={() => setEditing(n.id)}>Edit</button>
                {confirm === n.id ? <><button className="btn !py-1 text-xs !bg-coral !border-coral" onClick={() => start(() => deleteNote(n.id))}>Delete</button><button className="btn !py-1 text-xs" onClick={() => setConfirm(null)}>Cancel</button></>
                  : <button className="btn !py-1 text-xs" onClick={() => setConfirm(n.id)}>Delete</button>}
              </div>
            </div>
            <div className="mt-2"><Markdown text={n.body} /></div>
            {n.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{n.tags.map((t) => <span key={t} className="chip bg-ivory border border-line">#{t}</span>)}</div>}
          </>)}
        </li>
      ))}
    </ul>
  );
}
