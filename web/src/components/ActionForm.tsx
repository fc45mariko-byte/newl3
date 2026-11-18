'use client';
import { startTransition, useActionState, useRef, useEffect } from 'react';

type State = { error?: string; ok?: string } | undefined;
export function ActionForm({ action, submit, pendingLabel, children, className = 'flex flex-col gap-3', reset = false, encType }: {
  action: (s: State, f: FormData) => Promise<State>; submit: string; pendingLabel?: string; children: React.ReactNode; className?: string; reset?: boolean; encType?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (reset && state?.ok) ref.current?.reset(); }, [state, reset]);
  return (
    // Submitting through onSubmit keeps what the student typed when the server returns an error
    // (React resets uncontrolled fields after a form action otherwise).
    <form ref={ref} className={className} encType={encType} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => formAction(fd)); }}>
      {children}
      {state?.error && <p role="alert" className="text-sm rounded-xl bg-coral-soft text-coral-ink px-3 py-2">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm rounded-xl bg-sage-soft text-sage-ink px-3 py-2 whitespace-pre-line">{state.ok}</p>}
      <div><button className="btn btn-primary" disabled={pending}>{pending ? pendingLabel ?? 'Saving…' : submit}</button></div>
    </form>
  );
}
