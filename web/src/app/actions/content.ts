'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { requireUser } from '@/lib/auth';
import { syncCurriculum } from '@/lib/sync-curriculum';

export async function updateContent(_: unknown): Promise<{ message?: string; error?: string }> {
  const u = await requireUser();
  try {
    const r = await syncCurriculum(db, u.id);
    revalidatePath('/', 'layout');
    return { message: `Course content updated: ${r.coursesUpdated} courses, ${r.chaptersAdded} new chapters, ${r.chaptersUpdated} chapters refreshed. Your notes, answers, reviews and documents were not changed.` };
  } catch (e) {
    console.error(e);
    return { error: 'The update failed; nothing was changed.' };
  }
}
