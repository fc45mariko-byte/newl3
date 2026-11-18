export const TZ = 'Europe/Paris';
const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...o });
export const fmtDay = (d: Date) => f({ weekday: 'short', day: 'numeric', month: 'short' }).format(d);
export const fmtLong = (d: Date) => f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
export const fmtTime = (d: Date) => f({ hour: '2-digit', minute: '2-digit' }).format(d);
export const isoParis = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD
export const hourParis = (d: Date) => Number(f({ hour: 'numeric', hour12: false }).format(d));
export function greeting(d = new Date()) { const h = hourParis(d); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
/** Minutes east of UTC for Europe/Paris at a given instant (60 in winter, 120 in summer). */
export function parisOffsetMin(d: Date) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' }).formatToParts(d).find((x) => x.type === 'timeZoneName')?.value ?? 'GMT+1';
  const m = p.match(/GMT([+-]\d+)(?::(\d+))?/);
  return m ? Number(m[1]) * 60 + (m[2] ? Math.sign(Number(m[1])) * Number(m[2]) : 0) : 60;
}
/** Expands weekly events into occurrences between two dates. */
export function occurrences<T extends { startsAt: Date; endsAt: Date; weekly: boolean; repeatUntil: string | null }>(evs: T[], from: Date, to: Date) {
  const out: (T & { at: Date; end: Date })[] = [];
  for (const e of evs) {
    if (!e.weekly) { if (e.endsAt >= from && e.startsAt <= to) out.push({ ...e, at: e.startsAt, end: e.endsAt }); continue; }
    const until = e.repeatUntil ? new Date(`${e.repeatUntil}T23:59:59Z`) : to;
    const dur = e.endsAt.getTime() - e.startsAt.getTime();
    // Weekly events keep their wall-clock time in Paris across daylight-saving changes.
    const base = parisOffsetMin(e.startsAt);
    for (let t = e.startsAt.getTime(); t <= Math.min(until.getTime(), to.getTime()); t += 7 * 86_400_000) {
      const at = t + (base - parisOffsetMin(new Date(t))) * 60_000;
      if (at + dur >= from.getTime()) out.push({ ...e, at: new Date(at), end: new Date(at + dur) });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
