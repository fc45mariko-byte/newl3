import Anthropic from '@anthropic-ai/sdk';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { currentUser } from '@/lib/auth';
import { buildContext, MODES } from '@/lib/assistant-context';

export const runtime = 'nodejs';

const Body = z.object({
  message: z.string().trim().min(1).max(8000),
  mode: z.enum(Object.keys(MODES) as [keyof typeof MODES, ...(keyof typeof MODES)[]]).default('explain'),
  course: z.string().max(80).nullish(),
  chapter: z.string().max(120).nullish(),
  conversationId: z.uuid().nullish(),
});

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Sign in again to use the assistant.' }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ error: 'The assistant is not configured: add ANTHROPIC_API_KEY to the server environment (see README).' }, { status: 503 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'The request is not valid.' }, { status: 400 });
  const { message, mode, course: courseSlug, chapter: chapterSlug } = parsed.data;

  const { system, course, chapter } = await buildContext(user.id, courseSlug, chapterSlug);
  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const [c] = await db.select({ id: s.aiConversations.id }).from(s.aiConversations).where(and(eq(s.aiConversations.id, conversationId), eq(s.aiConversations.userId, user.id)));
    if (!c) conversationId = null;
  }
  if (!conversationId) {
    const [c] = await db.insert(s.aiConversations).values({ userId: user.id, courseId: course?.id ?? null, chapterId: chapter?.id ?? null, title: message.slice(0, 80) }).returning({ id: s.aiConversations.id });
    conversationId = c.id;
  }
  const history = await db.select({ role: s.aiMessages.role, content: s.aiMessages.content }).from(s.aiMessages).where(eq(s.aiMessages.conversationId, conversationId)).orderBy(asc(s.aiMessages.createdAt));
  await db.insert(s.aiMessages).values({ conversationId, role: 'user', mode, content: message });

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-20).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: `[Mode: ${mode}] ${MODES[mode]}\n\n${message}` },
  ];
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
  const encoder = new TextEncoder();
  const convId = conversationId;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = '';
      try {
        const st = client.messages.stream({
          model,
          max_tokens: 16000,
          system,
          messages,
          output_config: { effort: mode === 'research' || mode === 'deep_dive' ? 'high' : 'medium' },
          ...(mode === 'research' ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }] as Anthropic.Messages.ToolUnion[] } : {}),
        });
        for await (const ev of st) {
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
            full += ev.delta.text;
            controller.enqueue(encoder.encode(ev.delta.text));
          }
        }
        const final = await st.finalMessage();
        if (final.stop_reason === 'refusal') {
          const note = '\n\nThe model declined to answer this request.';
          full += note; controller.enqueue(encoder.encode(note));
        } else if (final.stop_reason === 'max_tokens') {
          const note = '\n\n[The answer was cut off: ask me to continue.]';
          full += note; controller.enqueue(encoder.encode(note));
        }
      } catch (e) {
        const msg = e instanceof Anthropic.AuthenticationError ? 'The API key was rejected. Check ANTHROPIC_API_KEY.'
          : e instanceof Anthropic.RateLimitError ? 'Too many requests: wait a minute and try again.'
          : e instanceof Anthropic.APIError ? `The assistant service returned an error (${e.status}).`
          : 'The assistant could not be reached.';
        full += `\n\n${msg}`;
        controller.enqueue(encoder.encode(`\n\n${msg}`));
      } finally {
        if (full.trim()) await db.insert(s.aiMessages).values({ conversationId: convId, role: 'assistant', mode, content: full });
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-conversation-id': convId, 'cache-control': 'no-store' } });
}
