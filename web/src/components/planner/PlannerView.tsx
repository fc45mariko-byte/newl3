'use client';
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EventForm } from './EventForm';
import { deleteEvent } from '@/app/actions/planner';

type Occ = { id: string; title: string; kind: string; at: string; end: string; location: string | null; weekly: boolean; source: string | null; course: { id: string; title: string; slug: string } | null; chapterId: string | null };
type Raw = { id: string; title: string; kind: string; startsAt: string; endsAt: string; weekly: boolean; repeatUntil: string | null; location: string | null; courseId: string | null; chapterId: string | null };
const KIND: Record<string, [string, string]> = { class: ['Class', 'bg-paper border-line'], exam: ['Exam', 'bg-coral-soft border-coral'], assignment: ['Assignment', 'bg-butter-soft border-butter'], study: ['Study', 'bg-powder-soft border-powder'], revision: ['Revision', 'bg-sage-soft border-sage'], goal: ['Objective', 'bg-rose-soft border-rose'] };
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', ...o });
const dayKey = (iso: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(iso));
const time = (iso: string) => fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const mondayOf = (key: string) => { const d = new Date(`${key}T12:00:00Z`); return addDays(d, -((d.getUTCDay() + 6) % 7)); };

export function PlannerView({ events, view, date, raw, courses, chapters }: { events: Occ[]; view: 'week' | 'month' | 'semester'; date?: string; raw: Raw[]; courses: { id: string; title: string }[]; chapters: { id: string; title: string; courseId: string }[] }) {
  const router = useRouter();
  const today = dayKey(new Date());
  const focus = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const [selected, setSelected] = useState<Occ | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const byDay = useMemo(() => { const m = new Map<string, Occ[]>(); for (const e of events) { const k = dayKey(e.at); if (!m.has(k)) m.set(k, []); m.get(k)!.push(e); } return m; }, [events]);
  const go = (v: string, d: string) => router.push(`/planner?view=${v}&date=${d}`);
  const mon = mondayOf(focus);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const first = new Date(`${focus.slice(0, 7)}-01T12:00:00Z`);
  const shift = (n: number) => view === 'week' ? dayKey(addDays(mon, 7 * n)) : view === 'month' ? `${dayKey(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + n, 1, 12))).slice(0, 7)}-01` : focus;

  const Chip = ({ e }: { e: Occ }) => (
    <button onClick={() => { setSelected(e); setEditing(false); setConfirm(false); }} className={`w-full text-left rounded-lg border px-2 py-1 text-xs ${KIND[e.kind][1]}`}>
      <b className="block truncate">{e.title}</b><span className="text-muted">{time(e.at)}–{time(e.end)}</span>
    </button>
  );
  return (
    <section className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-line p-1" role="tablist" aria-label="View">
          {(['week', 'month', 'semester'] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} onClick={() => go(v, focus)} className={`px-3 py-1 rounded-full text-sm capitalize ${view === v ? 'bg-charcoal text-paper' : ''}`}>{v}</button>)}
        </div>
        {view !== 'semester' && (
          <div className="flex items-center gap-2">
            <button className="btn !py-1" onClick={() => go(view, shift(-1))} aria-label="Previous">←</button>
            <span className="font-medium min-w-40 text-center">{view === 'week' ? `${fmt({ day: 'numeric', month: 'short' }).format(days[0])} – ${fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(days[6])}` : fmt({ month: 'long', year: 'numeric' }).format(first)}</span>
            <button className="btn !py-1" onClick={() => go(view, shift(1))} aria-label="Next">→</button>
            <button className="btn !py-1 text-sm" onClick={() => go(view, today)}>Today</button>
          </div>
        )}
      </div>

      {view === 'week' && (
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-7">
          {days.map((d) => { const k = dayKey(d); const list = byDay.get(k) ?? []; return (
            <div key={k} className={`rounded-xl border p-2 min-h-24 sm:min-h-64 flex flex-col gap-1.5 ${k === today ? 'border-rose bg-rose-soft/30' : 'border-line'}`}>
              <p className={`text-xs font-semibold ${k === today ? 'text-rose-ink' : 'text-muted'}`}>{fmt({ weekday: 'short', day: 'numeric' }).format(d)}</p>
              {list.map((e) => <Chip key={e.id + e.at} e={e} />)}
              {!list.length && <p className="text-[11px] text-muted/60 sm:hidden">Free</p>}
            </div>); })}
        </div>
      )}

      {view === 'month' && (() => {
        const start = mondayOf(dayKey(first));
        return (
          <div className="grid grid-cols-7 gap-1 text-xs">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => <span key={x} className="text-center text-muted py-1">{x}</span>)}
            {Array.from({ length: 42 }, (_, i) => { const d = addDays(start, i); const k = dayKey(d); const list = byDay.get(k) ?? []; const out = k.slice(0, 7) !== focus.slice(0, 7); return (
              <button key={k} onClick={() => go('week', k)} className={`rounded-lg border min-h-16 sm:min-h-24 p-1 text-left flex flex-col gap-0.5 ${k === today ? 'border-rose' : 'border-line'} ${out ? 'opacity-40' : ''}`}>
                <span className="font-semibold">{d.getUTCDate()}</span>
                {list.slice(0, 3).map((e) => <span key={e.id + e.at} className={`hidden sm:block truncate rounded px-1 border ${KIND[e.kind][1]}`}>{e.title}</span>)}
                {list.length > 0 && <span className="sm:hidden flex gap-0.5">{list.slice(0, 4).map((e) => <i key={e.id + e.at} className={`h-1.5 w-1.5 rounded-full ${e.kind === 'exam' ? 'bg-coral' : e.kind === 'assignment' ? 'bg-butter' : e.kind === 'revision' ? 'bg-sage' : 'bg-charcoal/40'}`} />)}</span>}
                {list.length > 3 && <span className="hidden sm:block text-muted">+{list.length - 3}</span>}
              </button>); })}
          </div>
        );
      })()}

      {view === 'semester' && (() => {
        const key = events.filter((e) => e.kind !== 'class');
        const months = [...new Set(key.map((e) => dayKey(e.at).slice(0, 7)))].sort();
        return months.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {months.map((m) => (
              <div key={m} className="rounded-xl border border-line p-3"><p className="font-serif text-lg mb-2">{fmt({ month: 'long', year: 'numeric' }).format(new Date(`${m}-15T12:00:00Z`))}</p>
                <ul className="flex flex-col gap-1.5">{key.filter((e) => dayKey(e.at).startsWith(m)).map((e) => <li key={e.id + e.at}><Chip e={e} /></li>)}</ul></div>
            ))}
          </div>
        ) : <p className="text-sm text-muted">No exam, deadline or study session recorded yet. Classes are not listed in this view.</p>;
      })()}

      {selected && (
        <div className="rounded-2xl border border-line bg-ivory p-4 flex flex-col gap-2" role="dialog" aria-label={selected.title}>
          <div className="flex justify-between gap-3"><div><p className="eyebrow">{KIND[selected.kind][0]}{selected.weekly ? ' · every week' : ''}</p><p className="font-serif text-2xl">{selected.title}</p>
            <p className="text-sm text-muted">{fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(selected.at))}, {time(selected.at)}–{time(selected.end)}{selected.location ? ` · ${selected.location}` : ''}</p>
            {selected.course && <p className="text-sm"><Link className="underline" href={`/courses/${selected.course.slug}`}>{selected.course.title}</Link></p>}
            {selected.source && <p className="text-xs text-muted">Source: {selected.source}</p>}</div>
            <button className="btn btn-ghost !p-2 h-max" onClick={() => setSelected(null)} aria-label="Close">✕</button></div>
          {editing ? <EventForm courses={courses} chapters={chapters} event={raw.find((r) => r.id === selected.id)} onDone={() => { setEditing(false); setSelected(null); router.refresh(); }} />
            : <div className="flex gap-2">
              <button className="btn" onClick={() => setEditing(true)}>Edit{selected.weekly ? ' the series' : ''}</button>
              {confirm ? <><button className="btn !bg-coral !border-coral" disabled={pending} onClick={() => start(async () => { await deleteEvent(selected.id); setSelected(null); })}>{selected.weekly ? 'Delete every occurrence' : 'Delete'}</button><button className="btn" onClick={() => setConfirm(false)}>Cancel</button></>
                : <button className="btn" onClick={() => setConfirm(true)}>Delete</button>}
            </div>}
        </div>
      )}
    </section>
  );
}
