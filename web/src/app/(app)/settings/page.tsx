import { requireUser } from '@/lib/auth';
import { currentSemester } from '@/lib/queries';
import { logout } from '@/app/actions/auth';
import { UpdateContent } from '@/components/UpdateContent';
export const metadata = { title: 'Settings' };
export default async function Settings() {
  const u = await requireUser();
  const sem = await currentSemester(u.id);
  const ai = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <h1 className="font-serif text-4xl">Settings</h1>
      <section className="card p-5 text-sm flex flex-col gap-1"><p><b>Name:</b> {u.name}</p><p><b>Email:</b> {u.email}</p><p><b>Academic year:</b> {sem.year} · current semester {sem.code}</p></section>
      <section className="card p-5 text-sm flex flex-col gap-2">
        <h2 className="font-serif text-xl">Study companion</h2>
        <p>{ai ? `Connected to Claude (model ${process.env.ANTHROPIC_MODEL || 'claude-opus-5-5'}).` : 'Not configured: set ANTHROPIC_API_KEY on the server to enable it.'}</p>
        <p className="text-muted">The companion receives the course and chapter you are reading, your notes on it and your recent mistakes, only when you ask it a question.</p>
      </section>
      <section className="card p-5 text-sm flex flex-col gap-2">
        <h2 className="font-serif text-xl">About the content</h2>
        <p>Labels tell you where every part comes from: <b>University material</b> (your documents), <b>Official source</b> and <b>Academic research</b> (cited sources), <b>Reconstructed explanation</b> (written to fill a gap, never your teacher’s course) and <b>Supplementary context</b>.</p>
      </section>
      <section className="card p-5 text-sm flex flex-col gap-2">
        <h2 className="font-serif text-xl">Course content</h2>
        <p>Loads the latest version of the courses (new chapters, rewritten sections, new questions). Your notes, documents, quiz answers, flashcard reviews, progress, planner and tasks are kept, and so are the course details you edited and the chapters you added.</p>
        <UpdateContent />
      </section>
      <form action={logout}><button className="btn">Log out</button></form>
    </div>
  );
}
