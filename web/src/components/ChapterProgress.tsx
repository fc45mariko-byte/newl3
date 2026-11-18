'use client';
import { useEffect, useTransition } from 'react';
import { markChapter, markOpened } from '@/app/actions/progress';

export function OpenTracker({ course, chapter }: { course: string; chapter: string }) {
  useEffect(() => { markOpened(course, chapter).catch(() => undefined); }, [course, chapter]);
  return null;
}
export function ReadButton({ course, chapter, read, labels }: { course: string; chapter: string; read: boolean; labels: { mark: string; done: string } }) {
  const [pending, start] = useTransition();
  return (
    <button className={`btn ${read ? '' : 'btn-primary'}`} disabled={pending} onClick={() => start(() => markChapter(course, chapter, !read))} aria-pressed={read}>
      {pending ? '…' : read ? `✓ ${labels.done}` : labels.mark}
    </button>
  );
}
