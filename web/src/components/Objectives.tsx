'use client';
import { useOptimistic, useTransition } from 'react';
import { addObjective, deleteObjective, setObjectiveProgress, toggleObjective } from '@/app/actions/objectives';
import { IconTrash } from './icons';

type O = { id: string; title: string; done: boolean; progress: number };
export function Objectives({ items }: { items: O[] }) {
  const [list, update] = useOptimistic(items, (cur, next: O) => cur.map((o) => (o.id === next.id ? next : o)));
  const [, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {list.map((o) => (
          <li key={o.id} className="flex items-center gap-2.5 group">
            <input type="checkbox" className="h-4 w-4 accent-charcoal" checked={o.done} aria-label={`Mark “${o.title}” as achieved`}
              onChange={(e) => start(async () => { update({ ...o, done: e.target.checked, progress: e.target.checked ? 100 : 0 }); await toggleObjective(o.id, e.target.checked); })} />
            <span className={`flex-1 text-sm ${o.done ? 'line-through text-muted' : ''}`}>{o.title}</span>
            <select aria-label={`Progress of “${o.title}”`} className="text-xs bg-transparent border border-line rounded-md px-1 py-0.5" value={o.progress}
              onChange={(e) => start(async () => { const p = Number(e.target.value); update({ ...o, progress: p, done: p === 100 }); await setObjectiveProgress(o.id, p); })}>
              {[0, 25, 50, 75, 100].map((p) => <option key={p} value={p}>{p}%</option>)}
            </select>
            <button className="opacity-60 hover:opacity-100" aria-label={`Delete “${o.title}”`} onClick={() => start(() => deleteObjective(o.id))}><IconTrash width={16} height={16} /></button>
          </li>
        ))}
      </ul>
      <form action={addObjective} className="flex gap-2 mt-1">
        <label className="sr-only" htmlFor="new-objective">New objective</label>
        <input id="new-objective" name="title" className="input !py-1.5 text-sm" placeholder="Add an objective" maxLength={160} required />
        <button className="btn !py-1.5">Add</button>
      </form>
    </div>
  );
}
