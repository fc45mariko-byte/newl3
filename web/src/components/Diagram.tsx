'use client';
// Diagrams that make a mechanism visible. Each one states where its content comes from.
import { useState } from 'react';
import { Provenance } from './badges';

function Frame({ title, prov, note, children }: { title: string; prov: string[]; note?: string; children: React.ReactNode }) {
  return (
    <figure className="not-prose my-5 card !shadow-none p-4 sm:p-5 flex flex-col gap-3 bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="font-serif text-lg">{title}</figcaption>
        <span className="flex flex-wrap gap-1.5">{prov.map((p) => <Provenance key={p} p={p} />)}</span>
      </div>
      {children}
      {note && <p className="text-xs text-muted">{note}</p>}
    </figure>
  );
}

function Flux() {
  return (
    <Frame title="Les trois flux entre vendeur et acheteur" prov={['RECONSTRUCTED_EXPLANATION']} note="Les trois flux sont décalés dans le temps et dans l'espace : ce décalage crée les risques que les techniques du cours couvrent.">
      <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_120px] items-stretch text-sm">
        <div className="rounded-xl bg-ivory border border-line grid place-items-center p-3 font-semibold text-center sm:row-span-3">Exportateur<br /><span className="font-normal text-muted text-xs">vendeur</span></div>
        <div className="rounded-xl bg-rose-soft px-3 py-2 flex justify-between gap-2"><b>Flux physique</b><span>marchandise →</span></div>
        <div className="rounded-xl bg-ivory border border-line grid place-items-center p-3 font-semibold text-center sm:row-span-3 sm:col-start-3 sm:row-start-1">Importateur<br /><span className="font-normal text-muted text-xs">acheteur</span></div>
        <div className="rounded-xl bg-butter-soft px-3 py-2 flex justify-between gap-2 sm:col-start-2"><b>Flux documentaire</b><span>documents → (directement ou via les banques)</span></div>
        <div className="rounded-xl bg-sage-soft px-3 py-2 flex justify-between gap-2 sm:col-start-2"><b>Flux financier</b><span>← paiement</span></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[['Transport', 'transporteur, commissionnaire, transitaire'], ['Douane', 'représentant en douane, deux administrations'], ['Banques', 'banque du vendeur, banque de l’acheteur'], ['Assurance', 'assureur transport, assureur-crédit']].map(([t, d]) => (
          <div key={t} className="rounded-xl bg-powder-soft p-2.5"><b className="block text-sm">{t}</b>{d}</div>
        ))}
      </div>
    </Frame>
  );
}

const ST = ['Locaux du vendeur', 'Chargement au départ', 'Pré-acheminement', 'Remise au transporteur', 'À bord / chargé', 'Transport principal', 'Arrivée à destination', 'Déchargement', 'Livraison à l’acheteur'];
const INCO: Record<string, { r: number; c: number; exp: string; imp: string; ins: string; mode: string; note: string }> = {
  EXW: { r: 1, c: 1, exp: 'Acheteur', imp: 'Acheteur', ins: 'Aucune obligation', mode: 'Tous modes', note: 'Marchandise mise à disposition dans les locaux du vendeur, non chargée.' },
  FCA: { r: 3, c: 3, exp: 'Vendeur', imp: 'Acheteur', ins: 'Aucune obligation', mode: 'Tous modes', note: 'Livraison au transporteur désigné par l’acheteur. Depuis 2020, l’acheteur peut faire émettre un connaissement « à bord ».' },
  FAS: { r: 4, c: 4, exp: 'Vendeur', imp: 'Acheteur', ins: 'Aucune obligation', mode: 'Maritime et fluvial', note: 'Livraison le long du navire au port d’embarquement.' },
  FOB: { r: 5, c: 5, exp: 'Vendeur', imp: 'Acheteur', ins: 'Aucune obligation', mode: 'Maritime et fluvial', note: 'Livraison à bord du navire au port d’embarquement.' },
  CFR: { r: 5, c: 7, exp: 'Vendeur', imp: 'Acheteur', ins: 'Aucune obligation', mode: 'Maritime et fluvial', note: 'Deux points critiques : le risque passe à bord au départ, mais le vendeur paie le fret jusqu’au port de destination.' },
  CIF: { r: 5, c: 7, exp: 'Vendeur', imp: 'Acheteur', ins: 'Vendeur, minimum clauses C (ICC), 110 % du prix', mode: 'Maritime et fluvial', note: 'Comme CFR, plus l’assurance souscrite par le vendeur pour une marchandise qui voyage aux risques de l’acheteur.' },
  CPT: { r: 3, c: 7, exp: 'Vendeur', imp: 'Acheteur', ins: 'Aucune obligation', mode: 'Tous modes', note: 'Le risque passe à la remise au premier transporteur ; le vendeur paie le transport jusqu’à destination.' },
  CIP: { r: 3, c: 7, exp: 'Vendeur', imp: 'Acheteur', ins: 'Vendeur, minimum clauses A (ICC), 110 % du prix', mode: 'Tous modes', note: 'Comme CPT, plus une assurance « tous risques » depuis 2020.' },
  DAP: { r: 7, c: 7, exp: 'Vendeur', imp: 'Acheteur', ins: 'Aucune obligation', mode: 'Tous modes', note: 'Livraison au lieu convenu, prête à être déchargée.' },
  DPU: { r: 8, c: 8, exp: 'Vendeur', imp: 'Acheteur', ins: 'Aucune obligation', mode: 'Tous modes', note: 'Seule règle où le vendeur décharge à destination.' },
  DDP: { r: 7, c: 7, exp: 'Vendeur', imp: 'Vendeur, droits compris', ins: 'Aucune obligation', mode: 'Tous modes', note: 'Obligation maximale du vendeur : dédouanement import et droits.' },
};
function Incoterms({ start = 'FCA' }: { start?: string }) {
  const [rule, setRule] = useState(INCO[start] ? start : 'FCA');
  const R = INCO[rule];
  const cell = (i: number, n: number, what: string) => (
    <span title={`${what}: ${i < n ? 'vendeur' : 'acheteur'}`} className={`h-6 rounded-md grid place-items-center text-[10.5px] font-semibold ${i < n ? 'bg-rose text-charcoal' : 'bg-butter-soft text-[#6b5410]'} ${i === n ? 'border-l-[3px] border-charcoal' : ''}`}>{i < n ? 'V' : 'A'}</span>
  );
  return (
    <Frame title="Incoterms® 2020 : qui supporte risques et frais, étape par étape" prov={['UNIVERSITY_MATERIAL', 'OFFICIAL_SOURCE']} note="Prolonge les schémas FCA, FOB et CIF de votre enseignante aux onze règles. Source : ICC, Incoterms® 2020.">
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Règle">
        {Object.keys(INCO).map((k) => <button key={k} role="radio" aria-checked={rule === k} onClick={() => setRule(k)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${rule === k ? 'bg-charcoal text-paper border-charcoal' : 'bg-paper border-line'}`}>{k}</button>)}
      </div>
      <div className="hidden sm:grid grid-cols-[70px_repeat(9,minmax(0,1fr))] gap-1 text-[11px]">
        <span />{ST.map((s) => <span key={s} className="text-center leading-tight self-end">{s}</span>)}
        <b className="self-center text-muted">Risques</b>{ST.map((_, i) => <span key={i}>{cell(i, R.r, 'Risque')}</span>)}
        <b className="self-center text-muted">Frais</b>{ST.map((_, i) => <span key={i}>{cell(i, R.c, 'Frais')}</span>)}
      </div>
      <div className="sm:hidden grid grid-cols-[minmax(0,1fr)_56px_56px] gap-x-2 gap-y-1 text-[12.5px] items-center">
        <b>Étape</b><b>Risques</b><b>Frais</b>
        {ST.map((s, i) => [<span key={`s${i}`}>{s}</span>, <span key={`r${i}`}>{cell(i, R.r, 'Risque')}</span>, <span key={`c${i}`}>{cell(i, R.c, 'Frais')}</span>])}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[['Dédouanement export', R.exp], ['Dédouanement import', R.imp], ['Assurance', R.ins], ['Modes', R.mode]].map(([t, v]) => <div key={t} className="rounded-xl bg-ivory p-2.5"><b className="block eyebrow !text-[10px]">{t}</b>{v}</div>)}
      </div>
      <p className="text-sm rounded-xl bg-powder-soft px-3 py-2">{R.note}</p>
    </Frame>
  );
}

const CREDOC: [string, string, string][] = [
  ['Vendeur', 'Acheteur', 'Contrat de vente : les parties conviennent d’un paiement par crédit documentaire.'],
  ['Acheteur', 'Banque émettrice', 'L’acheteur (donneur d’ordre) demande à sa banque d’ouvrir le crédit.'],
  ['Banque émettrice', 'Banque notificatrice', 'La banque émettrice ouvre le crédit et le transmet à une banque du pays du vendeur.'],
  ['Banque notificatrice', 'Vendeur', 'La banque notificatrice notifie le crédit au vendeur (bénéficiaire) ; si elle le confirme, elle s’engage aussi.'],
  ['Vendeur', 'Acheteur', 'Le vendeur expédie et obtient les documents (connaissement, facture, certificats).'],
  ['Vendeur', 'Banque notificatrice', 'Le vendeur présente les documents dans les délais du crédit.'],
  ['Banque notificatrice', 'Vendeur', 'La banque examine les documents (cinq jours ouvrés au plus) ; s’ils sont conformes, le vendeur est payé.'],
  ['Banque notificatrice', 'Banque émettrice', 'Les documents partent à la banque émettrice, qui rembourse la banque notificatrice.'],
  ['Banque émettrice', 'Acheteur', 'La banque émettrice débite l’acheteur et lui remet les documents.'],
  ['Acheteur', 'Acheteur', 'Avec le connaissement, l’acheteur retire la marchandise auprès du transporteur.'],
];
function Credoc() {
  const [i, setI] = useState(0);
  const [a, b, t] = CREDOC[i];
  return (
    <Frame title="Le crédit documentaire, étape par étape" prov={['OFFICIAL_SOURCE', 'RECONSTRUCTED_EXPLANATION']} note="Règles : RUU 600 (ICC, 2007). Le crédit est autonome : la banque paie contre des documents conformes, pas contre la marchandise.">
      <div className="grid grid-cols-2 gap-2 text-sm">
        {['Vendeur', 'Acheteur', 'Banque notificatrice', 'Banque émettrice'].map((x) => (
          <div key={x} className={`rounded-xl p-3 text-center border ${x === a ? 'bg-rose-soft border-rose' : x === b ? 'bg-butter-soft border-butter' : 'bg-ivory border-line'}`}>{x}</div>
        ))}
      </div>
      <p className="rounded-xl bg-powder-soft px-3 py-2 text-sm"><b>Étape {i + 1} sur {CREDOC.length} — {a}{a !== b ? ` → ${b}` : ''}</b><br />{t}</p>
      <div className="flex gap-2"><button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Étape précédente</button><button className="btn btn-primary" disabled={i === CREDOC.length - 1} onClick={() => setI(i + 1)}>Étape suivante</button></div>
    </Frame>
  );
}

function Equilibre() {
  const [v, setV] = useState({ rs: 600, es: 450, ace: 380, de: 300 });
  const frng = v.rs - v.es, bfr = v.ace - v.de, tn = frng - bfr;
  const max = Math.max(Math.abs(frng), Math.abs(bfr), Math.abs(tn), 1);
  const verdict = frng > 0 && bfr > 0 && tn >= 0 ? ['Équilibre satisfaisant : le FRNG finance tout le BFR.', 'bg-sage-soft']
    : frng > 0 && bfr > 0 ? ['Le FRNG ne couvre pas le BFR : dépendance aux concours bancaires.', 'bg-butter-soft']
    : frng > 0 ? ['Situation très confortable : excédent de ressources.', 'bg-sage-soft']
    : bfr < 0 && tn >= 0 ? ["Le cycle d'exploitation finance une partie des investissements.", 'bg-butter-soft']
    : bfr < 0 ? ['Déséquilibre : des investissements sont financés à court terme.', 'bg-coral-soft'] : ['Situation très dangereuse : tout repose sur le crédit bancaire.', 'bg-coral-soft'];
  return (
    <Frame title="FRNG, BFR et trésorerie nette" prov={['RECONSTRUCTED_EXPLANATION']} note="Montants fictifs, en k€. Trésorerie nette = FRNG − BFR.">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {([['rs', 'Ressources stables'], ['es', 'Emplois stables'], ['ace', "Actif circulant d'exploitation"], ['de', "Dettes d'exploitation"]] as const).map(([k, t]) => (
          <label key={k} className="label">{t}<input type="range" min={0} max={1000} step={10} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} /><output className="text-ink font-semibold">{v[k]} k€</output></label>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 items-end h-40">
        {[['FRNG', frng, 'bg-rose'], ['BFR', bfr, 'bg-butter'], ['Trésorerie nette', tn, 'bg-sage']].map(([t, x, c]) => (
          <div key={t as string} className="flex flex-col items-center justify-end h-full gap-1 text-xs text-center">
            <div className={`w-3/5 rounded-t-lg ${(x as number) < 0 ? 'bg-coral' : c}`} style={{ height: `${(Math.abs(x as number) / max) * 100}px` }} />
            <b>{t}</b><span>{x as number} k€</span>
          </div>
        ))}
      </div>
      <p className={`rounded-xl px-3 py-2 text-sm ${verdict[1]}`}>{verdict[0]}</p>
    </Frame>
  );
}

function Leiper() {
  return (
    <Frame title="Leiper's tourism system (1979)" prov={['ACADEMIC_RESEARCH']} note="N. Leiper, “The framework of tourism”, Annals of Tourism Research, 6(4), 1979, pp. 390-407.">
      <div className="grid sm:grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-center text-sm">
        <div className="rounded-xl bg-rose-soft p-3"><b className="block">Generating region</b>where the trip starts and ends; push factors: income, holidays, desire to escape</div>
        <span className="text-center text-xl text-rose-ink">⇄</span>
        <div className="rounded-xl bg-ivory border border-line p-3"><b className="block">Transit route region</b>journey, stopovers, carriers</div>
        <span className="text-center text-xl text-rose-ink">⇄</span>
        <div className="rounded-xl bg-butter-soft p-3"><b className="block">Destination region</b>the stay; pull factors: climate, heritage, prices, access</div>
      </div>
      <p className="text-sm rounded-xl bg-powder-soft px-3 py-2">The tourism industry (tour operators, carriers, accommodation, tourist offices) is spread across the three regions, inside a wider economic, political and technological environment.</p>
    </Frame>
  );
}

function Butler() {
  const pts: [string, number, number][] = [['Exploration', 70, 205], ['Involvement', 140, 192], ['Development', 220, 120], ['Consolidation', 320, 50], ['Stagnation', 400, 45]];
  return (
    <Frame title="The tourism area life cycle (Butler, 1980)" prov={['ACADEMIC_RESEARCH']} note="R. W. Butler, The Canadian Geographer, 24(1), 1980, pp. 5-12. Schematic curve: phases last very differently from one destination to another.">
      <svg viewBox="0 0 560 250" className="w-full h-auto" role="img" aria-label="Butler curve">
        <line x1="40" y1="220" x2="545" y2="220" stroke="#6f655f" /><line x1="40" y1="220" x2="40" y2="15" stroke="#6f655f" />
        <text x="545" y="240" textAnchor="end" fontSize="11" fill="#6f655f">Time</text><text x="46" y="20" fontSize="11" fill="#6f655f">Number of tourists</text>
        <path d="M40,212 C110,210 140,200 180,170 S260,70 330,60 S390,55 410,55" stroke="#8e3a62" strokeWidth="3" fill="none" />
        <path d="M410,55 C450,52 490,30 540,22" stroke="#a9b995" strokeWidth="3" fill="none" />
        <path d="M410,55 C460,60 500,110 540,150" stroke="#e08a78" strokeWidth="3" strokeDasharray="5 4" fill="none" />
        {pts.map(([t, x, y]) => <g key={t}><circle cx={x} cy={y + 8} r="4" fill="#8e3a62" /><text x={x} y={y - 2} textAnchor="middle" fontSize="12" fill="#1f1b19">{t}</text></g>)}
        <text x="540" y="16" textAnchor="end" fontSize="12" fill="#3f5530">Rejuvenation</text><text x="540" y="168" textAnchor="end" fontSize="12" fill="#8a3322">Decline</text>
      </svg>
    </Frame>
  );
}


const DEMARCHE: [string, string, string][] = [
  ['Question', 'Comment les étudiants utilisent-ils les outils d’IA générative pour leurs travaux de traduction ?', 'Est-elle claire, précise, faisable, ouverte ?'],
  ['Méthode', 'Questionnaire + entretiens', 'La méthode convient-elle au mot interrogatif de la question ?'],
  ['Données', 'Réponses de 100 étudiants + 10 entretiens', 'Qui, combien, sur quelle période ?'],
  ['Analyse', 'Analyse statistique + analyse thématique', 'Comment traiter les données, décidé avant de les recueillir ?'],
  ['Résultats', 'Ce que l’analyse met en évidence (le support ne donne pas les résultats de l’exemple).', 'Distinguer les données, leur analyse et leur interprétation.'],
  ['Conclusion', 'La réponse argumentée à la question de départ.', 'Répond-elle à la question posée, et seulement à elle ?'],
];
function Demarche() {
  const [i, setI] = useState(0);
  const [t, ex, check] = DEMARCHE[i];
  return (
    <Frame title="La démarche de recherche, étape par étape" prov={['UNIVERSITY_MATERIAL']} note="Chaîne et exemple « IA et traduction » du support de TD « Initiation à la recherche L3 LEA ». Les questions de contrôle sont reconstruites.">
      <div role="radiogroup" aria-label="Étapes" className="flex flex-wrap items-center gap-1.5">
        {DEMARCHE.map(([k], j) => (
          <span key={k} className="flex items-center gap-1.5">
            <button role="radio" aria-checked={i === j} onClick={() => setI(j)} className={`rounded-full px-3 py-1.5 text-sm border ${i === j ? 'bg-charcoal text-white border-charcoal' : j < i ? 'bg-sage-soft border-line' : 'bg-ivory border-line'}`}>{j + 1}. {k}</button>
            {j < DEMARCHE.length - 1 && <span aria-hidden className="text-muted">→</span>}
          </span>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-butter-soft p-3"><b className="block">{t} — dans l’exemple</b>{ex}</div>
        <div className="rounded-xl bg-powder-soft p-3"><b className="block">À vérifier</b>{check}</div>
      </div>
    </Frame>
  );
}

const DELIM: Record<string, { label: string; prov: string; steps: [string, string, string][] }> = {
  support: { label: 'Exemple du support', prov: 'UNIVERSITY_MATERIAL', steps: [
    ['Thème', 'Les langues dans l’entreprise', 'Le domaine général : impossible à traiter en entier.'],
    ['Sujet', 'L’utilisation de l’anglais dans les entreprises françaises', 'Précision du thème : une langue, un pays.'],
    ['Angle d’étude', 'L’utilisation de l’anglais dans la communication interne', 'L’objet de recherche : une situation de communication.'],
    ['Question de recherche', 'Quels facteurs expliquent le recours à l’anglais dans la communication interne des entreprises françaises ?', 'Ce que l’on veut savoir : claire, précise, faisable, ouverte.'],
  ] },
  tourisme: { label: 'Exemple reconstruit : tourisme', prov: 'RECONSTRUCTED_EXPLANATION', steps: [
    ['Thème', 'Le tourisme international', 'Tous les pays, tous les acteurs : trop vaste.'],
    ['Sujet', 'L’accueil des touristes étrangers dans le Loiret', 'Un territoire, une clientèle.'],
    ['Angle d’étude', 'L’offre en langues étrangères des offices de tourisme', 'Un acteur, un phénomène observable.'],
    ['Question de recherche', 'Quelles langues les offices de tourisme du Loiret proposent-ils, et en fonction de quelles clientèles ?', 'Corpus (les sites) et données (fréquentation) identifiables.'],
  ] },
};
function Delimitation() {
  const [ex, setEx] = useState<keyof typeof DELIM>('support');
  const [i, setI] = useState(3);
  const d = DELIM[ex];
  return (
    <Frame title="La délimitation progressive d’un sujet" prov={[d.prov]} note="Quatre étapes du support de TD : thème → sujet (précision du thème) → angle d’étude (objet de recherche) → question de recherche.">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Exemple">
        {Object.entries(DELIM).map(([k, v]) => <button key={k} role="radio" aria-checked={ex === k} onClick={() => setEx(k as keyof typeof DELIM)} className={`chip border ${ex === k ? 'bg-charcoal text-white border-charcoal' : 'bg-ivory border-line'}`}>{v.label}</button>)}
      </div>
      <ol className="list-none p-0 m-0 flex flex-col items-center gap-1.5">
        {d.steps.map(([t, v], j) => (
          <li key={t} style={{ width: `${100 - j * 12}%` }} className="min-w-0">
            <button onClick={() => setI(j)} aria-pressed={i === j} className={`w-full text-left rounded-xl px-3 py-2 text-sm border ${i === j ? 'border-charcoal' : 'border-transparent'} ${['bg-rose-soft', 'bg-butter-soft', 'bg-powder-soft', 'bg-sage-soft'][j]}`}>
              <b className="block text-xs uppercase tracking-wide">{j + 1}. {t}</b>{v}
            </button>
          </li>
        ))}
      </ol>
      <p className="text-sm rounded-xl bg-ivory border border-line px-3 py-2"><b>{d.steps[i][0]} :</b> {d.steps[i][2]}</p>
    </Frame>
  );
}

export function Diagram({ name, arg }: { name: string; arg?: string }) {
  switch (name) {
    case 'flux': return <Flux />;
    case 'incoterms': return <Incoterms start={arg} />;
    case 'credoc': return <Credoc />;
    case 'equilibre': return <Equilibre />;
    case 'leiper': return <Leiper />;
    case 'butler': return <Butler />;
    case 'demarche': return <Demarche />;
    case 'delimitation': return <Delimitation />;
    default: return <p className="text-sm text-coral-ink">Unknown diagram “{name}”.</p>;
  }
}
