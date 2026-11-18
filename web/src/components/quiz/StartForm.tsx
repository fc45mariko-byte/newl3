'use client';
import { startTransition, useActionState, useState } from 'react';
import { startQuiz } from '@/app/actions/quiz';

type C = { id: string; title: string; chapters: { id: string; title: string }[]; topics: string[] };
const MODES: [string, string, string][] = [
  ['chapter', 'Chapter quiz', 'One complete chapter.'],
  ['topic', 'Topic quiz', 'One skill within a course.'],
  ['mixed', 'Mixed quiz', 'Several chapters and courses.'],
  ['exam', 'Exam simulation', 'Timed, feedback at the end.'],
  ['weakness', 'Weakness training', 'Your repeated mistakes.'],
  ['mastery', 'Mastery test', 'Every chapter of a course.'],
];
const TOPIC: Record<string, string> = { memoriser: 'Memorise', comprendre: 'Understand', distinguer: 'Distinguish', appliquer: 'Apply', interpreter: 'Interpret', resoudre: 'Solve', 'analyser-cas': 'Analyse a case', 'detecter-erreur': 'Spot the error' };

export function StartForm({ courses, initialMode = 'chapter', initialChapter, initialCourse }: { courses: C[]; initialMode?: string; initialChapter?: string; initialCourse?: string }) {
  const [state, action, pending] = useActionState(startQuiz, undefined);
  const [mode, setMode] = useState(initialMode);
  const [courseId, setCourseId] = useState(initialCourse ?? courses.find((c) => c.chapters.some((ch) => ch.id === initialChapter))?.id ?? courses[0]?.id ?? '');
  const course = courses.find((c) => c.id === courseId);
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="card p-5 flex flex-col gap-4">
      <fieldset>
        <legend className="font-serif text-2xl mb-3">Start a quiz</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MODES.map(([k, t, h]) => (
            <label key={k} className={`rounded-xl border px-3 py-2.5 cursor-pointer ${mode === k ? 'border-charcoal bg-ivory' : 'border-line'}`}>
              <input type="radio" name="mode" value={k} checked={mode === k} onChange={() => setMode(k)} className="sr-only" />
              <b className="block text-sm">{t}</b><span className="text-xs text-muted">{h}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {mode !== 'mixed' && (
        <label className="label">Course{mode === 'weakness' ? ' (optional)' : ''}
          <select className="input" name="courseId" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {mode === 'weakness' && <option value="">All courses</option>}
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      )}
      {mode === 'chapter' && course && (
        <label className="label">Chapter<select className="input" name="chapterId" defaultValue={initialChapter}>{course.chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      )}
      {mode === 'topic' && course && (
        <label className="label">Skill<select className="input" name="topic">{course.topics.map((t) => <option key={t} value={t}>{TOPIC[t] ?? t}</option>)}</select></label>
      )}
      {mode === 'mixed' && (
        <fieldset className="label"><legend className="mb-1">Courses</legend>
          <div className="grid sm:grid-cols-2 gap-1 text-ink max-h-56 overflow-y-auto">{courses.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="courseIds" value={c.id} defaultChecked className="accent-charcoal" />{c.title}</label>)}</div>
        </fieldset>
      )}
      <div className="grid grid-cols-2 gap-3">
        {mode !== 'chapter' && <label className="label">Questions<input className="input" type="number" name="count" min={3} max={60} defaultValue={mode === 'mastery' ? 20 : mode === 'exam' ? 15 : 10} /></label>}
        {mode === 'exam' && <label className="label">Time limit (minutes)<input className="input" type="number" name="minutes" min={5} max={240} defaultValue={30} /></label>}
      </div>
      {state?.error && <p role="alert" className="text-sm rounded-xl bg-coral-soft text-coral-ink px-3 py-2">{state.error}</p>}
      <div><button className="btn btn-primary" disabled={pending}>{pending ? 'Preparing…' : 'Start'}</button></div>
    </form>
  );
}
