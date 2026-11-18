'use client';
import { startTransition, useActionState, useState, useTransition } from 'react';
import { acceptPlan, suggestPlan } from '@/app/actions/planner';

export function PlanSuggester({ courses }: { courses: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(suggestPlan, undefined);
  const [added, setAdded] = useState<number | null>(null);
  const [saving, start] = useTransition();
  const plan = state?.plan;
  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={(e) => { e.preventDefault(); setAdded(null); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="grid gap-3 sm:grid-cols-3 items-end">
        <label className="label sm:col-span-3">Course<select className="input" name="courseId">{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <label className="label">Exam date<input className="input" type="date" name="examDate" required /></label>
        <label className="label">Minutes a day<input className="input" type="number" name="minutes" min={20} max={480} defaultValue={90} /></label>
        <button className="btn btn-primary" disabled={pending}>{pending ? 'Planning…' : 'Suggest a plan'}</button>
      </form>
      {state?.error && <p role="alert" className="text-sm rounded-xl bg-coral-soft text-coral-ink px-3 py-2">{state.error}</p>}
      {plan && (
        <div className="flex flex-col gap-2">
          {plan.notes.map((n) => <p key={n} className={`text-sm rounded-xl px-3 py-2 ${plan.shortfallMinutes ? 'bg-butter-soft' : 'bg-ivory'}`}>{n}</p>)}
          {plan.dropped.length > 0 && <p className="text-xs text-coral-ink">Left out for lack of time: {plan.dropped.join(', ')}.</p>}
          <ol className="text-sm flex flex-col divide-y divide-line max-h-72 overflow-y-auto">
            {plan.sessions.map((x, i) => <li key={i} className="py-1.5 flex justify-between gap-2"><span><b>{x.kind === 'learn' ? 'Study' : x.kind === 'review' ? 'Review' : 'Final review'}</b> · {x.title}</span><span className="text-muted shrink-0">{new Date(`${x.date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {x.minutes} min</span></li>)}
          </ol>
          {added === null ? <button className="btn btn-primary self-start" disabled={saving || !plan.sessions.length} onClick={() => start(async () => { const r = await acceptPlan(plan.courseId, plan.examDate, plan.sessions); setAdded(r.added); })}>{saving ? 'Adding…' : `Add these ${plan.sessions.length} sessions to my planner`}</button>
            : <p role="status" className="text-sm rounded-xl bg-sage-soft text-sage-ink px-3 py-2">{added} sessions added at 18:00 on their day. Move them in the planner if needed.</p>}
        </div>
      )}
    </div>
  );
}
