'use client';
import { startTransition, useActionState } from 'react';
import { updateContent } from '@/app/actions/content';

export function UpdateContent() {
  const [state, action, pending] = useActionState(updateContent, {});
  return (
    <div className="flex flex-col gap-2">
      <div><button className="btn" disabled={pending} onClick={() => startTransition(() => action())}>{pending ? 'Updating…' : 'Update course content'}</button></div>
      {state.message && <p role="status" className="rounded-xl bg-sage-soft px-3 py-2">{state.message}</p>}
      {state.error && <p role="alert" className="rounded-xl bg-coral-soft text-coral-ink px-3 py-2">{state.error}</p>}
    </div>
  );
}
