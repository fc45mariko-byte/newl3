'use client';
import { useOptimistic, useState, useTransition } from 'react';
import Link from 'next/link';
import { ActionForm } from './ActionForm';
import { deleteTask, saveTask, setTaskDone } from '@/app/actions/tasks';

type T = { id: string; title: string; details: string | null; dueOn: string | null; priority: string; category: string | null; courseId: string | null; course: string | null; courseSlug: string | null; doneAt: string | null };
const PRI: Record<string, string> = { high: 'bg-coral-soft text-coral-ink', normal: 'bg-ivory border border-line', low: 'bg-ivory text-muted border border-line' };
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

function TaskFields({ t, courses }: { t?: T; courses: { id: string; title: string }[] }) {
  return (<>
    <label className="label">Task<input className="input" name="title" defaultValue={t?.title} required maxLength={300} placeholder="e.g. Translate 10 sentences — thème espagnol" /></label>
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <label className="label">Due<input className="input" type="date" name="dueOn" defaultValue={t?.dueOn ?? ''} /></label>
      <label className="label">Priority<select className="input" name="priority" defaultValue={t?.priority ?? 'normal'}><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
      <label className="label">Category<input className="input" name="category" defaultValue={t?.category ?? ''} placeholder="assignment, reading…" list="task-cats" /></label>
      <label className="label">Course<select className="input" name="courseId" defaultValue={t?.courseId ?? ''}><option value="">None</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
    </div>
    <datalist id="task-cats"><option value="assignment" /><option value="reading" /><option value="revision" /><option value="research" /><option value="admin" /></datalist>
    <label className="label">Details<textarea className="input min-h-16" name="details" defaultValue={t?.details ?? ''} /></label>
  </>);
}

export function TaskBoard({ tasks, courses, filter }: { tasks: T[]; courses: { id: string; title: string }[]; filter: string }) {
  const [list, setOptimistic] = useOptimistic(tasks, (cur, u: { id: string; doneAt: string | null }) => cur.map((t) => (t.id === u.id ? { ...t, doneAt: u.doneAt } : t)));
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [, start] = useTransition();
  const today = todayKey();
  const shown = list.filter((t) => (filter === 'done' ? t.doneAt : filter === 'all' ? true : !t.doneAt));
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="flex flex-col gap-3 min-w-0">
        <div className="flex gap-1.5">{[['open', 'Open'], ['done', 'Done'], ['all', 'All']].map(([k, l]) => <Link key={k} href={`/tasks?filter=${k}`} className={`chip border ${filter === k ? 'bg-charcoal text-paper border-charcoal' : 'border-line'}`}>{l}</Link>)}</div>
        {shown.length ? <ul className="flex flex-col gap-2">
          {shown.map((t) => (
            <li key={t.id} className="card p-3.5">
              {editing === t.id ? <ActionForm action={async (s, f) => { const r = await saveTask(t.id, s, f); if (r?.ok) setEditing(null); return r; }} submit="Save"><TaskFields t={t} courses={courses} /></ActionForm> : (
                <div className="flex items-start gap-3">
                  <input type="checkbox" className="h-5 w-5 mt-0.5 accent-charcoal" checked={!!t.doneAt} aria-label={`Mark “${t.title}” as done`}
                    onChange={(e) => start(async () => { setOptimistic({ id: t.id, doneAt: e.target.checked ? new Date().toISOString() : null }); await setTaskDone(t.id, e.target.checked); })} />
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${t.doneAt ? 'line-through text-muted' : ''}`}>{t.title}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1 text-xs">
                      <span className={`chip ${PRI[t.priority]}`}>{t.priority}</span>
                      {t.dueOn && <span className={`chip ${!t.doneAt && t.dueOn < today ? 'bg-coral text-charcoal' : !t.doneAt && t.dueOn === today ? 'bg-butter' : 'bg-ivory border border-line'}`}>{t.dueOn < today && !t.doneAt ? 'overdue · ' : ''}{new Date(`${t.dueOn}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
                      {t.category && <span className="chip bg-powder-soft text-powder-ink">{t.category}</span>}
                      {t.course && <Link href={`/courses/${t.courseSlug}`} className="chip bg-ivory border border-line hover:border-ink">{t.course}</Link>}
                    </div>
                    {t.details && <p className="text-sm text-muted mt-1 whitespace-pre-line">{t.details}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button className="btn !py-1 text-xs" onClick={() => setEditing(t.id)}>Edit</button>
                    {confirm === t.id ? <><button className="btn !py-1 text-xs !bg-coral !border-coral" onClick={() => start(() => deleteTask(t.id))}>Delete</button><button className="btn !py-1 text-xs" onClick={() => setConfirm(null)}>Cancel</button></>
                      : <button className="btn !py-1 text-xs" onClick={() => setConfirm(t.id)} aria-label={`Delete “${t.title}”`}>Delete</button>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul> : <div className="card p-8 text-center text-muted">{filter === 'done' ? 'Nothing completed yet.' : 'No open task.'}</div>}
      </section>
      <aside className="card p-5 h-max"><h2 className="font-serif text-xl mb-3">New task</h2><ActionForm action={saveTask.bind(null, null)} submit="Add task" reset><TaskFields courses={courses} /></ActionForm></aside>
    </div>
  );
}
