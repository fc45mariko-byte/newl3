// Labels for provenance, importance and research status. Each colour has one meaning across the app.

export const PROVENANCE: Record<string, { label: string; cls: string; hint: string }> = {
  UNIVERSITY_MATERIAL: { label: 'University material', cls: 'bg-sage-soft text-sage-ink', hint: 'Taken from your own course documents.' },
  OFFICIAL_SOURCE: { label: 'Official source', cls: 'bg-powder-soft text-powder-ink', hint: 'From an institution: university, government, international organisation.' },
  ACADEMIC_RESEARCH: { label: 'Academic research', cls: 'bg-powder-soft text-powder-ink', hint: 'Supported by cited external sources.' },
  RECONSTRUCTED_EXPLANATION: { label: 'Reconstructed explanation', cls: 'bg-butter-soft text-[#6b5410]', hint: 'Written to explain or fill a gap. Not your teacher’s course.' },
  SUPPLEMENTARY_CONTEXT: { label: 'Supplementary context', cls: 'bg-ivory text-muted border border-line', hint: 'Goes beyond the programme.' },
};
export const PRIORITY: Record<string, { cls: string; hint: string }> = {
  ESSENTIAL: { cls: 'bg-charcoal text-paper', hint: 'Directly supported by course documents or the official description.' },
  IMPORTANT: { cls: 'bg-butter text-charcoal', hint: 'Needed to understand the essential chapters.' },
  ADVANCED: { cls: 'bg-ivory text-muted border border-line', hint: 'Deepens understanding; never ahead of exam priorities.' },
};
export const STATUS: Record<string, { label: string; dot: string }> = {
  not_researched: { label: 'Not researched', dot: 'bg-coral' },
  in_progress: { label: 'Research in progress', dot: 'bg-butter' },
  reconstructed: { label: 'Reconstructed', dot: 'bg-powder' },
  university_material: { label: 'Supported by university material', dot: 'bg-sage' },
  verified: { label: 'Verified against academic sources', dot: 'bg-sage-ink' },
};

export function Provenance({ p }: { p: string }) {
  const x = PROVENANCE[p];
  if (!x) return null;
  return <span className={`chip ${x.cls}`} title={x.hint}>{x.label}</span>;
}
export function Priority({ p, reason }: { p: string; reason?: string | null }) {
  const x = PRIORITY[p];
  return <span className={`chip ${x.cls}`} title={reason ?? x.hint}>{p}</span>;
}
export function Status({ s }: { s: string }) {
  const x = STATUS[s] ?? STATUS.not_researched;
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted"><span className={`h-2 w-2 rounded-full ${x.dot}`} />{x.label}</span>;
}
export const LANG: Record<string, string> = { fr: 'Taught in French', en: 'Taught in English', es: 'Taught in Spanish' };
