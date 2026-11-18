import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { extract, kindFor, ExtractionError } from './extract';

export const MAX_BYTES = 25 * 1024 * 1024;

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
};

export class UploadError extends Error {}

export type SaveResult = { id: string; status: 'extracted' | 'failed'; duplicate: boolean; error?: string | null };

/** Stores the original file, extracts its text and records the outcome. Never invents content. */
export async function saveDocument(userId: string, input: { filename: string; mime: string; buffer: Buffer; courseId?: string | null; chapterId?: string | null; note?: string | null }): Promise<SaveResult> {
  const kind = kindFor(input.filename, input.mime);
  if (!kind) throw new UploadError('This file type is not supported. Upload a PDF, Word (.docx), PowerPoint (.pptx), text or Markdown file.');
  if (input.buffer.length === 0) throw new UploadError('The file is empty.');
  if (input.buffer.length > MAX_BYTES) throw new UploadError('The file is larger than 25 MB.');
  const sha256 = createHash('sha256').update(input.buffer).digest('hex');
  const [dup] = await db.select({ id: schema.documents.id, status: schema.documents.status, error: schema.documents.error })
    .from(schema.documents).where(and(eq(schema.documents.userId, userId), eq(schema.documents.sha256, sha256)));
  if (dup) return { id: dup.id, status: dup.status as 'extracted' | 'failed', duplicate: true, error: dup.error };

  // The original goes into the database (document_files); storagePath only records where it is.
  const doc = await db.transaction(async (tx) => {
    const [d] = await tx.insert(schema.documents).values({
      userId, courseId: input.courseId ?? null, chapterId: input.chapterId ?? null, filename: input.filename,
      mime: MIME[kind] ?? input.mime, size: input.buffer.length, sha256, storagePath: `db:${sha256}${extname(input.filename).toLowerCase() || `.${kind}`}`, status: 'pending', note: input.note ?? null,
    }).returning({ id: schema.documents.id });
    await tx.insert(schema.documentFiles).values({ documentId: d.id, content: input.buffer });
    return d;
  });
  try {
    const out = await extract(input.buffer, kind);
    await db.update(schema.documents).set({ status: 'extracted', text: out.text, structure: out.structure }).where(eq(schema.documents.id, doc.id));
    return { id: doc.id, status: 'extracted', duplicate: false };
  } catch (e) {
    const message = e instanceof ExtractionError ? e.message : 'The file could not be read.';
    await db.update(schema.documents).set({ status: 'failed', error: message }).where(eq(schema.documents.id, doc.id));
    return { id: doc.id, status: 'failed', duplicate: false, error: message };
  }
}

/** The original bytes: from the database, or from disk for documents stored before files moved to the database. */
export async function readOriginal(doc: { id: string; storagePath: string }): Promise<Buffer | null> {
  const [f] = await db.select({ content: schema.documentFiles.content }).from(schema.documentFiles).where(eq(schema.documentFiles.documentId, doc.id));
  if (f) return Buffer.from(f.content);
  if (doc.storagePath.startsWith('db:')) return null;
  return readFile(doc.storagePath).catch(() => null);
}

// Compact form: lower case, no accents, letters and digits only ("L'ASSURANCE" and "LASSURANCE" compare equal).
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\.(pdf|docx|pptx|txt|md)$/, '').replace(/[^a-z0-9]+/g, '');

/** Seed helper: imports every file of a folder, attaching each to the course whose analysed materials name it. */
export async function ingestFolder(userId: string, folder: string) {
  const courses = await db.select({ id: schema.courses.id, materials: schema.courses.materials }).from(schema.courses).where(eq(schema.courses.userId, userId));
  const results: Record<string, string> = {};
  for (const name of await readdir(folder)) {
    if (name.startsWith('.')) continue;
    const clean = name.replace(/^[0-9a-f]{8}-/, '');
    const n = norm(clean);
    const course = courses.find((c) => c.materials.some((m) => m.filename.split(',').some((f) => { const k = norm(f.trim()); return k.length > 3 && (k === n || k.includes(n) || n.includes(k)); })));
    try {
      const r = await saveDocument(userId, { filename: clean, mime: '', buffer: await readFile(join(folder, name)), courseId: course?.id ?? null });
      results[clean] = r.duplicate ? 'duplicate' : r.status;
    } catch (e) {
      results[clean] = `skipped: ${(e as Error).message}`;
    }
  }
  return results;
}
