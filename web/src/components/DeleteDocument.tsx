'use client';
import { useState, useTransition } from 'react';
import { deleteDocument } from '@/app/actions/courses';

export function DeleteDocument({ slug, id, name }: { slug: string; id: string; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm) return <button className="btn !py-1 text-xs" onClick={() => setConfirm(true)} aria-label={`Delete ${name}`}>Delete</button>;
  return (
    <span className="flex gap-1.5 items-center text-xs">Delete the file?
      <button className="btn !py-1 text-xs !bg-coral !border-coral" disabled={pending} onClick={() => start(() => deleteDocument(slug, id))}>Yes, delete</button>
      <button className="btn !py-1 text-xs" onClick={() => setConfirm(false)}>Cancel</button>
    </span>
  );
}
