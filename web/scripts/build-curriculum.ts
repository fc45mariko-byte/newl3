// Builds data/curriculum.json from the cours repository (course content written for the earlier site)
// and the newl3 research (maps, provenance, sources, documents, reconstructed tourism course).
// Usage: COURS_DIR=../../cours npx tsx scripts/build-curriculum.ts
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const HERE = resolve(import.meta.dirname, '..');
const NEWL3 = resolve(HERE, '..');
const COURS = resolve(process.env.COURS_DIR ?? join(NEWL3, '..', 'cours'));
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

const catalogue = read(join(COURS, 'content', 'catalogue.json')).matieres;
const coursSources = read(join(COURS, 'content', 'sources.json'));
const research = read(join(NEWL3, 'recherche', 'matieres.json'));
const newSources = read(join(NEWL3, 'recherche', 'sources.json')).sources;
const documents = read(join(NEWL3, 'recherche', 'documents.json')).documents;

const STATUS: Record<string, string> = {
  'Not researched': 'not_researched', 'Research in progress': 'in_progress', Reconstructed: 'reconstructed',
  'Supported by university material': 'university_material', 'Verified against additional academic sources': 'verified',
};
const PROV: Record<string, string> = {
  'UNIVERSITY MATERIAL': 'UNIVERSITY_MATERIAL', 'ACADEMIC RESEARCH': 'ACADEMIC_RESEARCH',
  'RECONSTRUCTED COURSE': 'RECONSTRUCTED_EXPLANATION', 'SUPPLEMENTARY KNOWLEDGE': 'SUPPLEMENTARY_CONTEXT',
};
const ACCESS: Record<string, string> = { lu: 'read', extrait: 'excerpt', reference: 'reference' };
const QTYPE: Record<string, string> = { unique: 'single', multiple: 'multiple', 'vrai-faux': 'true_false' };

// Sources
const sources = [
  ...coursSources.map((s: any) => ({ key: s.id, title: s.titre, author: s.auteur, publishedOn: s.date ?? null, url: s.url ?? null, type: s.type ?? null, tier: s.id.startsWith('src.orleans') ? 'P1' : 'P3', access: ACCESS[s.acces] ?? 'reference', relevance: s.pertinence })),
  ...newSources.map((s: any) => ({ key: s.id, title: s.titre, author: s.auteur, publishedOn: s.date ?? null, url: s.url ?? null, type: s.type ?? null, tier: s.niveau, access: ACCESS[s.acces] ?? 'reference', relevance: s.pertinence })),
];
const sourceKeys = new Set(sources.map((s) => s.key));

// Reconstructed tourism course: one Markdown section per chapter, "## n." headings.
function tourismSections(): Record<number, { title: string; body: string }> {
  const p = join(NEWL3, 'cours-reconstruits', 'tou-introduction-tourisme-international.md');
  const out: Record<number, { title: string; body: string }> = {};
  if (!existsSync(p)) return out;
  for (const part of readFileSync(p, 'utf8').split(/^## /m).slice(1)) {
    const [head, ...rest] = part.split('\n');
    const m = head.match(/^(\d+)\.\s*(.*)$/);
    if (m) out[Number(m[1])] = { title: m[2].replace(/\s+—\s+.*$/, '').trim(), body: rest.join('\n').trim() };
  }
  return out;
}

const bulletSection = (title: string, lines: string[]) => lines.filter(Boolean).map((l) => `- ${l}`).join('\n');

const courses: any[] = [];
for (const [pos, m] of catalogue.entries()) {
  const carte = read(join(NEWL3, 'cartes', `${m.id}.json`));
  const r = research.matieres.find((x: any) => x.id === m.id) ?? {};
  const syn = existsSync(join(COURS, 'content', 'syntheses', `${m.id}.json`)) ? read(join(COURS, 'content', 'syntheses', `${m.id}.json`)) : null;
  const tou = m.id === 'tou' ? tourismSections() : {};
  const chapters = carte.chapitres.map((c: any, ci: number) => {
    const file = join(COURS, 'content', m.id, `${c.id}.json`);
    const f = existsSync(file) ? read(file) : null;
    const sections: any[] = [];
    const sChap = syn?.chapitres.find((x: any) => x.chapitre === c.id);
    if (m.id === 'tou' && tou[ci + 1]) {
      sections.push({ kind: 'explanation', title: tou[ci + 1].title, body: tou[ci + 1].body, provenance: 'RECONSTRUCTED_EXPLANATION', sourceKeys: c.sources.filter((k: string) => sourceKeys.has(k)) });
    }
    if (sChap) {
      sections.push({
        kind: 'synthesis', title: m.langue === 'en' ? 'Synthesis' : m.langue === 'es' ? 'Síntesis' : 'Synthèse',
        body: [sChap.idee, '', bulletSection('', sChap.points), sChap.formules?.length ? '\n' + bulletSection('', sChap.formules) : '', sChap.memo ? `\n> ${sChap.memo}` : ''].join('\n').trim(),
        provenance: 'RECONSTRUCTED_EXPLANATION', sourceKeys: [],
      });
      const exam: string[] = [];
      if (sChap.questions?.length) exam.push(...sChap.questions.map((q: any) => `**${q.q}**\n\n${q.r}`));
      if (sChap.distinctions?.length) exam.push((m.langue === 'en' ? '**Common confusions**\n\n' : m.langue === 'es' ? '**Confusiones frecuentes**\n\n' : '**Confusions fréquentes**\n\n') + sChap.distinctions.map((d: any) => `- **${d.a}** / **${d.b}** : ${d.difference}`).join('\n'));
      if (exam.length) sections.push({ kind: 'exam', title: m.langue === 'en' ? 'Exam preparation' : m.langue === 'es' ? 'Preparación del examen' : "Préparation à l'examen", body: exam.join('\n\n'), provenance: 'RECONSTRUCTED_EXPLANATION', sourceKeys: [] });
    }
    const notions = (f?.notions ?? []).map((n: any) => ({
      slug: n.id, term: n.titre, level: n.niveau, definition: n.definition ?? '', intuitive: n.explication ?? null, question: n.question ?? null,
      blocks: n.fonctionnement ?? [], confusions: n.confusions ?? [], counterExample: n.contreExemple ?? null, example: n.exemple ?? null,
      verification: n.verification ?? [], terms: n.termes ?? [], sourceKeys: (n.sources ?? []).filter((k: string) => sourceKeys.has(k)), toCheck: n.aVerifier ?? null,
      prerequisites: n.prerequis ?? [], related: n.connexes ?? [],
    }));
    // Concepts planned in the map but without written notes (research chapters) are kept as stubs.
    if (!notions.length) for (const [k, n] of c.notions.entries()) notions.push({ slug: `${c.id}.${k + 1}`, term: n.titre, level: n.niveau, definition: '', stub: true, blocks: [], confusions: [], terms: [], verification: [], sourceKeys: [], prerequisites: [], related: [] });

    const questions = (f?.questions ?? []).map((q: any) => ({
      key: q.id, type: QTYPE[q.format], difficulty: q.niveau, topic: q.competence, concept: q.notion, stem: q.enonce, support: q.support ?? null,
      data: { choices: q.choix.map((x: any) => ({ id: x.id, text: x.texte, correct: x.correct, explanation: x.explication })) }, explanation: q.explication ?? null,
    }));
    // Ordering questions from step-by-step blocks: the order is the content itself.
    for (const n of f?.notions ?? []) for (const [bi, b] of (n.fonctionnement ?? []).entries()) {
      if (b.type === 'etapes' && b.etapes.length >= 4 && b.etapes.length <= 8) {
        questions.push({ key: `o.${n.id}.${bi}`, type: 'ordering', difficulty: 2, topic: 'comprendre', concept: n.id,
          stem: m.langue === 'en' ? `Put the steps in order: ${b.titre ?? n.titre}` : m.langue === 'es' ? `Ordene las etapas: ${b.titre ?? n.titre}` : `Remettez les étapes dans l'ordre : ${b.titre ?? n.titre}`,
          support: null, data: { items: b.etapes }, explanation: b.etapes.map((e: string, i: number) => `${i + 1}. ${e}`).join('\n') });
      }
    }
    // Matching questions from bilingual glossaries (French term ↔ term in the other language).
    const terms = (f?.notions ?? []).flatMap((n: any) => (n.termes ?? []).map((t: any) => ({ ...t, notion: n.id })));
    const target = m.langue === 'es' || m.id === 'tve' || m.id === 'eec' || m.id === 'cve' || m.id === 'cvl' ? 'es' : 'en';
    const withT = terms.filter((t: any) => t[target] && t.fr && t[target].length < 60);
    const uniq = [...new Map(withT.map((t: any) => [t.fr, t])).values()];
    for (let i = 0; i + 4 <= uniq.length && i < 12; i += 4) {
      const group = uniq.slice(i, i + 4) as any[];
      if (new Set(group.map((g) => g[target])).size < 4) continue;
      questions.push({ key: `m.${c.id}.${i}`, type: 'matching', difficulty: 1, topic: 'memoriser', concept: group[0].notion,
        stem: target === 'en' ? 'Match each French term with its English equivalent.' : 'Relacione cada término francés con su equivalente en español.',
        support: null, data: { pairs: group.map((g) => ({ left: g.fr, right: g[target] })) }, explanation: group.map((g) => `${g.fr} → ${g[target]} : ${g.definition}`).join('\n') });
    }
    const flashcards = (f?.flashcards ?? []).map((x: any) => ({ key: x.id, kind: 'concept', front: x.question, back: x.reponse, extra: { mustInclude: x.indispensables ?? [], mistakes: x.erreurs ?? [] } }));
    for (const t of uniq.slice(0, 10) as any[]) flashcards.push({ key: `v.${t.notion}.${t.fr}`.slice(0, 120), kind: 'vocabulary', front: t.fr, back: `${t[target]}${t.definition ? ` — ${t.definition}` : ''}`, extra: {} });
    const exercises = (f?.exercices ?? []).map((x: any) => ({ key: x.id, type: x.type, title: x.titre, difficulty: x.niveau, statement: x.enonce, data: x.donnees ? { headers: x.donnees.entetes, rows: x.donnees.lignes } : null, fictional: x.fictif !== false,
      parts: x.questions.map((p: any) => ({ id: p.id, prompt: p.consigne, answer: p.reponse, correction: p.correction, mistakes: p.erreurs ?? [] })) }));

    // Chapters written by hand for the 10-part architecture replace the generated sections.
    const override = join(HERE, 'data', 'chapters', `${c.id}.json`);
    let summary: string | null = null;
    if (existsSync(override)) {
      const o = read(override);
      sections.splice(0, sections.length, ...o.sections.map((s: any) => ({ ...s, sourceKeys: (s.sourceKeys ?? []).filter((k: string) => sourceKeys.has(k)) })));
      summary = o.summary ?? null;
      for (const n of notions) if (o.concepts?.[n.slug]) Object.assign(n, o.concepts[n.slug]);
      for (const q of o.questions ?? []) questions.push({ support: null, ...q });
    }
    return {
      slug: c.id, title: c.titre, priority: c.priorite, summary,
      priorityReason: c.priorite === 'ESSENTIAL'
        ? (c.documents.length ? 'Covered by your course documents.' : "Matches the official course description (Université d'Orléans website).")
        : c.priorite === 'ADVANCED' ? 'Deepens the subject; not named in the official description.' : 'Needed to understand the essential chapters.',
      researchStatus: STATUS[c.statut], provenance: [...new Set(c.provenance.map((p: string) => PROV[p]))],
      note: c.note, documents: c.documents, sourceKeys: c.sources.filter((k: string) => sourceKeys.has(k)), prerequisites: c.prerequis,
      sections, notions, questions, flashcards, exercises,
    };
  });
  // A course rewritten by hand (data/courses/<slug>.json) replaces the generated chapters.
  const courseOverride = join(HERE, 'data', 'courses', `${m.id}.json`);
  if (existsSync(courseOverride)) {
    const o = read(courseOverride);
    const keep = (k: string[] = []) => k.filter((x: string) => sourceKeys.has(x));
    const written = o.chapters.map((ch: any) => ({
      slug: ch.slug, title: ch.title, priority: ch.priority, priorityReason: ch.priorityReason, summary: ch.summary ?? null,
      researchStatus: ch.researchStatus, provenance: ch.provenance, note: ch.note ?? null, documents: ch.documents ?? [], sourceKeys: keep(ch.sourceKeys), prerequisites: ch.prerequisites ?? [],
      sections: ch.sections.map((x: any) => ({ ...x, sourceKeys: keep(x.sourceKeys) })),
      notions: ch.concepts.map((n: any) => ({ slug: n.slug, term: n.term, level: n.level ?? 'F', definition: n.definition, intuitive: n.intuitive ?? null, analytical: n.analytical ?? null, question: n.examRelevance ?? null,
        blocks: [], confusions: [], counterExample: null, example: null, verification: [], terms: n.terms ?? [], sourceKeys: keep(n.sourceKeys), toCheck: null, prerequisites: n.prerequisites ?? [], related: n.related ?? [] })),
      questions: ch.questions.map((q: any) => ({ support: null, ...q })),
      flashcards: ch.concepts.map((n: any) => ({ key: `c.${n.slug}`, kind: 'concept', front: n.term, back: n.definition, extra: {} })),
      exercises: [],
    }));
    if (o.merge) {
      // Merge mode: written chapters replace the sections and add to the questions of generated chapters with the same slug;
      // generated chapters that are not rewritten are kept. Order follows o.order, then the remaining chapters.
      const gen = new Map<string, any>(chapters.map((c: any) => [c.slug, c]));
      const merged = new Map<string, any>(chapters.map((c: any) => [c.slug, c]));
      for (const w of written) {
        const g = gen.get(w.slug);
        if (!g) { merged.set(w.slug, w); continue; }
        const own = new Set(w.notions.map((n: any) => n.slug));
        merged.set(w.slug, { ...g, ...w,
          sourceKeys: [...new Set([...(g.sourceKeys ?? []), ...w.sourceKeys])], documents: [...new Set([...(g.documents ?? []), ...w.documents])],
          notions: [...w.notions, ...g.notions.filter((n: any) => !own.has(n.slug))],
          questions: [...g.questions, ...w.questions], flashcards: [...g.flashcards, ...w.flashcards], exercises: g.exercises });
      }
      const order: string[] = o.order ?? written.map((w: any) => w.slug);
      chapters.splice(0, chapters.length, ...order.map((k) => merged.get(k)).filter(Boolean), ...[...merged.values()].filter((c: any) => !order.includes(c.slug)));
    } else chapters.splice(0, chapters.length, ...written);
    Object.assign(r, { officiel: { ...(r.officiel ?? {}), description: o.officialDescription ?? r.officiel?.description }, incertitudes: o.uncertainties ?? r.incertitudes });
    (m as any).langue = o.language; (m as any).completude = o.missing ? 'absente' : 'complete'; (m as any)._researchStatus = o.researchStatus;
  }
  courses.push({
    slug: m.id, title: m.titre, language: m.langue, semesters: m.semestres, category: m.categorie, position: pos,
    teacher: r.officiel?.enseignant ?? m.enseignant ?? null, officialDescription: r.officiel?.description ?? null,
    bibliography: r.officiel?.bibliographie ?? [], officialSourceKeys: (r.officiel?.sources ?? []).filter((k: string) => sourceKeys.has(k)),
    outsideProgramme: !!r.complement || m.statut === 'COMP', missing: m.completude === 'absente',
    uncertainties: r.incertitudes ?? [], frameworks: r.cadres ?? [], examSkills: r.competences_examen ?? [],
    researchStatus: (m as any)._researchStatus ?? (chapters.some((c: any) => c.researchStatus === 'university_material' || c.researchStatus === 'verified') ? 'university_material' : chapters.length ? 'reconstructed' : 'not_researched'),
    chapters,
  });
}

const out = {
  builtOn: new Date().toISOString().slice(0, 10),
  note: research._maquette,
  sources,
  documents: documents.map((d: any) => ({ key: d.id, filename: d.fichier, author: d.auteur, course: d.matiere, nature: d.nature, outline: d.plan, issues: d.ecarts ?? [], covers: d.couvre ?? [] })),
  courses,
  // Known with certainty from the student's documents.
  events: [{ course: 'tou', title: 'Intro international tourism (CM + TD)', kind: 'class', weekday: 1, start: '09:00', end: '11:00', location: 'Salle 257', source: 'Emploi du temps S5 fourni (novembre 2026)' }],
  deadlines: [{ course: 'cvb', title: 'Homework: « April 1979: Thatcher outlines her radical ideology » — answer the questions', date: '2026-11-18', source: 'homework for wednesday 18th November.docx' }],
};
mkdirSync(join(HERE, 'data'), { recursive: true });
writeFileSync(join(HERE, 'data', 'curriculum.json'), JSON.stringify(out));
const n = (k: string) => courses.reduce((a: number, c: any) => a + c.chapters.reduce((b: number, ch: any) => b + ch[k].length, 0), 0);
console.log(`${courses.length} courses, ${courses.reduce((a, c) => a + c.chapters.length, 0)} chapters, ${n('notions')} concepts, ${n('questions')} questions, ${n('flashcards')} flashcards, ${n('exercises')} exercises, ${sources.length} sources.`);
void readdirSync;
