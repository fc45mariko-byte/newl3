import { and, eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { currentUser } from '@/lib/auth';
import { readOriginal } from '@/lib/documents';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return new Response('Sign in again.', { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 });
  const [d] = await db.select().from(s.documents).where(and(eq(s.documents.id, id), eq(s.documents.userId, u.id)));
  if (!d) return new Response('Not found', { status: 404 });
  const buf = await readOriginal(d);
  if (!buf) return new Response('The stored file is missing on the server.', { status: 410 });
  return new Response(new Uint8Array(buf), { headers: { 'content-type': d.mime, 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(d.filename)}`, 'cache-control': 'private, no-store' } });
}
