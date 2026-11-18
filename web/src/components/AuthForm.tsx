'use client';
import { startTransition, useActionState } from 'react';
import Link from 'next/link';
import type { FormState } from '@/app/actions/auth';

export function AuthForm({ mode, action }: { mode: 'login' | 'signup'; action: (s: FormState, f: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => formAction(fd)); }} className="card w-full max-w-sm p-7 flex flex-col gap-4" noValidate>
      <div>
        <p className="font-serif text-3xl">LEA Study</p>
        <p className="text-muted text-sm mt-1">{mode === 'login' ? 'Sign in to continue your work.' : 'Create your account. Your L3 curriculum is set up automatically.'}</p>
      </div>
      {mode === 'signup' && (
        <label className="label">First name<input className="input" name="name" autoComplete="given-name" defaultValue={state?.fields?.name} required /></label>
      )}
      <label className="label">Email<input className="input" name="email" type="email" autoComplete="email" defaultValue={state?.fields?.email} required /></label>
      <label className="label">Password<input className="input" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'signup' ? 10 : 1} /></label>
      {state?.error && <p role="alert" className="text-sm rounded-xl bg-coral-soft text-coral-ink px-3 py-2">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? (mode === 'signup' ? 'Setting up your courses…' : 'Signing in…') : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      <p className="text-sm text-muted text-center">
        {mode === 'login' ? <>No account yet? <Link className="underline" href="/signup">Create one</Link></> : <>Already registered? <Link className="underline" href="/login">Sign in</Link></>}
      </p>
    </form>
  );
}
