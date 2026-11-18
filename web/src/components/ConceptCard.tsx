'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Provenance } from './badges';

type Block = { type: string; titre?: string; texte?: string; etapes?: string[]; items?: string[]; entetes?: string[]; lignes?: any[]; formule?: string; legende?: string };
type Concept = {
  slug: string; term: string; definition: string; intuitive: string | null; academic: string | null; analytical: string | null; examRelevance: string | null; level: string | null;
  provenance: string[]; toCheck: string | null; sourceKeys: string[];
  data: { blocks?: Block[]; confusions?: { a: string; b: string; explication: string }[]; counterExample?: string | null; example?: { fictif: boolean; texte: string; source?: string } | null; verification?: string[]; terms?: { fr: string; en?: string; es?: string; definition: string }[]; stub?: boolean };
};
const L = {
  fr: { intuitive: 'Intuition', academic: 'Définition académique', analytical: 'Analyse', example: 'Exemple', fictional: 'Exemple fictif', real: 'Exemple réel', confuse: 'Ne pas confondre', check: 'Vérifiez-vous', exam: 'Question d’examen à laquelle répondre', related: 'Notions liées', prereq: 'Prérequis', toCheck: 'À vérifier', none: 'Pas encore rédigé. Demandez au compagnon de l’expliquer.', fromPairs: 'Construite à partir des distinctions de la fiche.' },
  en: { intuitive: 'Intuition', academic: 'Academic definition', analytical: 'Analysis', example: 'Example', fictional: 'Fictional example', real: 'Real example', confuse: 'Do not confuse', check: 'Check yourself', exam: 'Exam question to answer', related: 'Related concepts', prereq: 'Prerequisites', toCheck: 'To verify', none: 'Not written yet. Ask the companion to explain it.', fromPairs: 'Built from the distinctions in the notes.' },
  es: { intuitive: 'Intuición', academic: 'Definición académica', analytical: 'Análisis', example: 'Ejemplo', fictional: 'Ejemplo ficticio', real: 'Ejemplo real', confuse: 'No confundir', check: 'Compruebe', exam: 'Pregunta de examen', related: 'Nociones relacionadas', prereq: 'Requisitos previos', toCheck: 'Por verificar', none: 'Aún no redactado. Pida al compañero que lo explique.', fromPairs: 'Construido a partir de las distinciones de la ficha.' },
};

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) => {
        const t = b.titre ? <p className="font-semibold text-sm">{b.titre}</p> : null;
        if (b.type === 'texte') return <p key={i}>{b.texte}</p>;
        if (b.type === 'attention') return <p key={i} className="rounded-xl bg-coral-soft text-coral-ink px-3 py-2 text-sm">{b.texte}</p>;
        if (b.type === 'etapes') return <div key={i}>{t}<ol className="mt-1 grid gap-1.5 sm:grid-cols-2">{b.etapes!.map((e, j) => <li key={j} className="flex gap-2 rounded-lg bg-ivory px-2.5 py-1.5 text-sm"><b className="text-rose-ink tabular-nums">{j + 1}</b>{e}</li>)}</ol></div>;
        if (b.type === 'liste') return <div key={i}>{t}<ul className="list-disc pl-5 text-sm space-y-1 mt-1">{b.items!.map((e, j) => <li key={j}>{e}</li>)}</ul></div>;
        if (b.type === 'formule') return <div key={i}>{t}<p className="font-mono text-sm bg-ivory rounded-lg px-3 py-2 overflow-x-auto">{b.formule}</p>{b.legende && <p className="text-xs text-muted mt-1">{b.legende}</p>}</div>;
        if (b.type === 'tableau' || b.type === 'calcul') {
          const head = b.type === 'tableau' ? b.entetes! : null;
          const rows = b.type === 'tableau' ? b.lignes! : b.lignes!.map((l: any) => [l.libelle, l.valeur]);
          return <div key={i}>{t}<div className="overflow-x-auto mt-1"><table className="text-sm w-full border-collapse">{head && <thead><tr>{head.map((h) => <th key={h} className="border border-line bg-ivory px-2 py-1 text-left">{h}</th>)}</tr></thead>}<tbody>{rows.map((r: string[], j: number) => <tr key={j}>{r.map((c, k) => <td key={k} className="border border-line px-2 py-1 align-top">{c}</td>)}</tr>)}</tbody></table></div></div>;
        }
        return null;
      })}
    </div>
  );
}

export function ConceptCard({ c, lang, links, defaultOpen = false }: { c: Concept; lang: 'fr' | 'en' | 'es'; links: { relation: string; toSlug: string; toTerm: string }[]; defaultOpen?: boolean }) {
  const t = L[lang];
  const levels = [
    { k: 'intuitive', label: t.intuitive, has: !!(c.intuitive || c.data.example) },
    { k: 'academic', label: t.academic, has: true },
    { k: 'analytical', label: t.analytical, has: !!(c.analytical || c.data.confusions?.length || c.data.counterExample) },
  ];
  const [level, setLevel] = useState('intuitive');
  if (c.data.stub) {
    return <div className="rounded-2xl border border-dashed border-line px-4 py-3"><p className="font-medium">{c.term}</p><p className="text-sm text-muted">{t.none}</p></div>;
  }
  return (
    <details className="group rounded-2xl border border-line bg-paper open:shadow-[var(--shadow-card)]" id={c.slug} open={defaultOpen || undefined}>
      <summary className="cursor-pointer list-none px-4 py-3.5 flex items-start justify-between gap-3">
        <span className="min-w-0"><span className="block font-serif text-xl leading-snug">{c.term}</span>
          {c.definition && <span className="block text-sm text-muted mt-0.5 line-clamp-2 group-open:hidden">{c.definition}</span>}</span>
        <span className="flex flex-wrap gap-1 shrink-0 justify-end">{c.provenance.map((p) => <Provenance key={p} p={p} />)}</span>
      </summary>
      <div className="px-4 pb-4 flex flex-col gap-4">
        <div className="flex gap-1 border-b border-line" role="tablist">
          {levels.map((l) => <button key={l.k} role="tab" aria-selected={level === l.k} disabled={!l.has} onClick={() => setLevel(l.k)} className={`px-3 py-1.5 text-sm -mb-px border-b-2 ${level === l.k ? 'border-charcoal font-semibold' : 'border-transparent text-muted'} disabled:opacity-40`}>{l.label}</button>)}
        </div>
        <div className="prose-lea !max-w-none">
          {level === 'intuitive' && (<>
            {c.intuitive && <p>{c.intuitive}</p>}
            {c.data.example && <div className="rounded-xl bg-powder-soft px-3 py-2 text-sm"><b className="block">{c.data.example.fictif ? t.fictional : t.real}</b>{c.data.example.texte}{c.data.example.source && <span className="text-muted"> — {c.data.example.source}</span>}</div>}
          </>)}
          {level === 'academic' && (<>
            <p className="rounded-xl bg-butter-soft px-3 py-2 font-medium">{c.definition}</p>
            {c.academic && <p>{c.academic}</p>}
            {c.data.blocks?.length ? <Blocks blocks={c.data.blocks} /> : null}
            {c.data.terms?.length ? <div className="overflow-x-auto"><table className="text-sm"><thead><tr><th>FR</th><th>EN</th><th>ES</th><th>{lang === 'fr' ? 'Définition' : lang === 'es' ? 'Definición' : 'Definition'}</th></tr></thead><tbody>{c.data.terms.map((x) => <tr key={x.fr}><td>{x.fr}</td><td>{x.en}</td><td>{x.es}</td><td>{x.definition}</td></tr>)}</tbody></table></div> : null}
          </>)}
          {level === 'analytical' && (<>
            {c.analytical && <p>{c.analytical}</p>}
            {c.data.confusions?.length ? <div><p className="font-semibold text-sm">{t.confuse}</p><ul className="text-sm">{c.data.confusions.map((x, i) => <li key={i}><b>{x.a}</b> / <b>{x.b}</b> : {x.explication}</li>)}</ul>{!c.analytical && <p className="text-xs text-muted">{t.fromPairs}</p>}</div> : null}
            {c.data.counterExample && <p className="text-sm rounded-xl bg-coral-soft text-coral-ink px-3 py-2">{c.data.counterExample}</p>}
          </>)}
        </div>
        {c.examRelevance && <p className="text-sm"><span className="eyebrow block mb-0.5">{t.exam}</span>{c.examRelevance}</p>}
        {c.data.verification?.length ? <div className="text-sm"><span className="eyebrow block mb-0.5">{t.check}</span><ul className="list-disc pl-5 space-y-1">{c.data.verification.map((v) => <li key={v}>{v}</li>)}</ul></div> : null}
        {c.toCheck && <p className="text-xs rounded-lg bg-butter-soft px-2.5 py-1.5"><b>{t.toCheck} :</b> {c.toCheck}</p>}
        {links.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {links.map((l) => <Link key={l.relation + l.toSlug} href={`/knowledge/${encodeURIComponent(l.toSlug)}`} className={`chip border ${l.relation === 'prerequisite' ? 'border-powder bg-powder-soft text-powder-ink' : 'border-line bg-ivory'}`}>{l.relation === 'prerequisite' ? `${t.prereq}: ` : ''}{l.toTerm}</Link>)}
          </div>
        )}
      </div>
    </details>
  );
}
