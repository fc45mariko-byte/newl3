'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { IconClose, IconSpark } from './icons';
import { Markdown } from './Markdown';

const MODES: [string, string][] = [
  ['explain', 'Explain'], ['compare', 'Compare'], ['connect', 'Connect'], ['challenge', 'Challenge'],
  ['research', 'Research'], ['examine', 'Examine'], ['simplify', 'Simplify'], ['deep_dive', 'Deep dive'],
];
type Msg = { role: 'user' | 'assistant'; content: string };

/** Reads the active course and chapter from the URL so the student never has to restate them. */
function contextFromPath(path: string) {
  const m = path.match(/^\/courses\/([^/]+)(?:\/chapters\/([^/]+))?/);
  return { course: m?.[1] ?? null, chapter: m?.[2] ? decodeURIComponent(m[2]) : null };
}

export function Assistant({ enabled }: { enabled: boolean }) {
  const path = usePathname();
  const ctx = contextFromPath(path);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('explain');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conv = useRef<string | null>(null);
  const ctxKey = `${ctx.course}/${ctx.chapter}`;
  const lastCtx = useRef(ctxKey);
  const logRef = useRef<HTMLDivElement>(null);

  // A new chapter starts a new conversation, so context never leaks between subjects.
  useEffect(() => {
    if (lastCtx.current !== ctxKey) { lastCtx.current = ctxKey; conv.current = null; setMsgs([]); setError(null); }
  }, [ctxKey]);
  useEffect(() => { logRef.current?.scrollTo({ top: 1e9 }); }, [msgs]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setError(null); setBusy(true);
    setMsgs((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setInput('');
    try {
      const res = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: text, mode, ...ctx, conversationId: conv.current }) });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({ error: 'The assistant could not answer.' }));
        setMsgs((m) => m.slice(0, -1)); setError(j.error); return;
      }
      conv.current = res.headers.get('x-conversation-id');
      const reader = res.body.getReader(); const dec = new TextDecoder(); let acc = '';
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', content: acc }]);
      }
    } catch {
      setMsgs((m) => m.slice(0, -1)); setError('The connection was interrupted. Try again.');
    } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={`fixed z-40 right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6 btn btn-rose shadow-lg ${open ? 'hidden' : ''}`} aria-label="Open the study companion">
        <IconSpark /> <span className="hidden sm:inline">Companion</span>
      </button>
      {open && (
        <section aria-label="Study companion" className="fixed z-50 inset-x-0 bottom-0 lg:inset-auto lg:right-6 lg:bottom-6 lg:w-[440px] card !rounded-b-none lg:!rounded-[18px] flex flex-col max-h-[85dvh] lg:max-h-[78dvh]">
          <header className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-line">
            <div>
              <p className="font-serif text-xl">Study companion</p>
              <p className="text-xs text-muted">{ctx.chapter ? `Reading: ${ctx.chapter}` : ctx.course ? `Course: ${ctx.course}` : 'No course open'}</p>
            </div>
            <button className="btn btn-ghost !p-2" onClick={() => setOpen(false)} aria-label="Close"><IconClose /></button>
          </header>
          <div className="flex gap-1.5 overflow-x-auto px-4 py-2 border-b border-line" role="radiogroup" aria-label="Mode">
            {MODES.map(([k, t]) => (
              <button key={k} role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`chip !py-1 !px-2.5 border ${mode === k ? 'bg-charcoal text-paper border-charcoal' : 'border-line bg-paper text-ink'}`}>{t}</button>
            ))}
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-[160px]">
            {!enabled && <p className="text-sm rounded-xl bg-butter-soft px-3 py-2">The companion needs a Claude API key on the server (ANTHROPIC_API_KEY). Everything else in LEA Study works without it.</p>}
            {msgs.length === 0 && enabled && <p className="text-sm text-muted">Ask about the page you are reading. The companion sees the current course and chapter, your notes on it and your recent mistakes.</p>}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'self-end bg-rose-soft rounded-2xl px-3 py-2 max-w-[90%] text-sm whitespace-pre-wrap' : 'self-start bg-ivory rounded-2xl px-3 py-2 max-w-[95%]'}>
                {m.role === 'user' ? m.content : m.content ? <Markdown text={m.content} className="prose-lea !text-[14px]" /> : <span className="text-sm text-muted">Thinking…</span>}
              </div>
            ))}
            {error && <p role="alert" className="text-sm rounded-xl bg-coral-soft text-coral-ink px-3 py-2">{error}</p>}
          </div>
          <form className="flex gap-2 p-3 border-t border-line pb-[max(12px,env(safe-area-inset-bottom))]" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <label className="sr-only" htmlFor="companion-input">Your question</label>
            <input id="companion-input" className="input !rounded-full" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about this chapter…" disabled={!enabled || busy} />
            <button className="btn btn-primary" disabled={!enabled || busy || !input.trim()}>{busy ? '…' : 'Send'}</button>
          </form>
        </section>
      )}
    </>
  );
}
