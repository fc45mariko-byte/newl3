'use client';
import { useState } from 'react';
import Link from 'next/link';
import { occurrences } from '@/lib/dates';

type E = { startsAt: string; endsAt: string; weekly: boolean; repeatUntil: string | null; kind: string };
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const pad = (n: number) => String(n).padStart(2, '0');

export function MiniCalendar({ events }: { events: E[] }) {
  const today = new Date();
  const [ref, setRef] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const end = new Date(start); end.setDate(start.getDate() + 42);
  const occ = occurrences(events.map((e) => ({ ...e, startsAt: new Date(e.startsAt), endsAt: new Date(e.endsAt) })), start, end);
  const marks = new Map<string, Set<string>>();
  for (const o of occ) { const k = `${o.at.getFullYear()}-${pad(o.at.getMonth() + 1)}-${pad(o.at.getDate())}`; if (!marks.has(k)) marks.set(k, new Set()); marks.get(k)!.add(o.kind); }
  const label = ref.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button className="btn btn-ghost !p-1.5" aria-label="Previous month" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))}>←</button>
        <span className="chip bg-rose-soft text-[13px] !px-3 !py-1">{label}</span>
        <button className="btn btn-ghost !p-1.5" aria-label="Next month" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))}>→</button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {DOW.map((d) => <span key={d} className="text-muted py-1">{d}</span>)}
        {Array.from({ length: 42 }, (_, i) => {
          const d = new Date(start); d.setDate(start.getDate() + i);
          const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          const isToday = d.toDateString() === today.toDateString();
          const m = marks.get(k);
          return (
            <Link key={k} href={`/planner?date=${k}`} className={`relative mx-auto grid place-items-center h-8 w-8 rounded-full ${isToday ? 'bg-rose font-semibold' : 'hover:bg-ivory'} ${d.getMonth() !== ref.getMonth() ? 'text-muted/50' : ''}`}>
              {d.getDate()}
              {m && <span className="absolute bottom-0.5 flex gap-0.5">{[...m].slice(0, 3).map((kind) => <i key={kind} className={`h-1 w-1 rounded-full ${kind === 'exam' ? 'bg-coral' : kind === 'assignment' ? 'bg-butter' : kind === 'class' ? 'bg-charcoal/50' : 'bg-powder'}`} />)}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
