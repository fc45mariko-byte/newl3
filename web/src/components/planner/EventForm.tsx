'use client';
import { useState } from 'react';
import { ActionForm } from '../ActionForm';
import { saveEvent } from '@/app/actions/planner';

type Ev = { id: string; title: string; kind: string; startsAt: string; endsAt: string; weekly: boolean; repeatUntil: string | null; location: string | null; courseId: string | null; chapterId: string | null };
const tz = (iso: string) => { const d = new Date(iso); const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d); const g = (t: string) => f.find((x) => x.type === t)!.value; return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` }; };

export function EventForm({ courses, chapters, event, onDone, defaultDate }: { courses: { id: string; title: string }[]; chapters: { id: string; title: string; courseId: string }[]; event?: Ev; onDone?: () => void; defaultDate?: string }) {
  const [courseId, setCourseId] = useState(event?.courseId ?? '');
  const [weekly, setWeekly] = useState(event?.weekly ?? false);
  const s = event ? tz(event.startsAt) : null, e = event ? tz(event.endsAt) : null;
  const today = defaultDate ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  return (
    <ActionForm action={async (st, f) => { const r = await saveEvent(event?.id ?? null, st, f); if (r?.ok) onDone?.(); return r; }} submit={event ? 'Save changes' : 'Add'} reset={!event}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Title<input className="input" name="title" defaultValue={event?.title} required maxLength={200} placeholder="e.g. Partiel de comptabilité" /></label>
        <label className="label">Type<select className="input" name="kind" defaultValue={event?.kind ?? 'class'}><option value="class">Class</option><option value="exam">Exam</option><option value="assignment">Assignment deadline</option><option value="study">Study session</option><option value="revision">Revision session</option><option value="goal">Personal objective</option></select></label>
      </div>
      <div className="grid gap-3 grid-cols-3">
        <label className="label">Date<input className="input" type="date" name="date" defaultValue={s?.date ?? today} required /></label>
        <label className="label">Start<input className="input" type="time" name="start" defaultValue={s?.time ?? '10:00'} required /></label>
        <label className="label">End<input className="input" type="time" name="end" defaultValue={e?.time ?? '12:00'} required /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Course<select className="input" name="courseId" value={courseId} onChange={(x) => setCourseId(x.target.value)}><option value="">None</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <label className="label">Chapter<select className="input" name="chapterId" defaultValue={event?.chapterId ?? ''} disabled={!courseId}><option value="">None</option>{chapters.filter((c) => c.courseId === courseId).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 items-end">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="weekly" checked={weekly} onChange={(x) => setWeekly(x.target.checked)} className="accent-charcoal" />Repeats every week</label>
        {weekly && <label className="label">Until<input className="input" type="date" name="repeatUntil" defaultValue={event?.repeatUntil ?? '2027-01-15'} /></label>}
      </div>
      <label className="label">Room or place<input className="input" name="location" defaultValue={event?.location ?? ''} maxLength={120} /></label>
    </ActionForm>
  );
}
