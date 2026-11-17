// Chargement et fusion des données : catalogue du dépôt cours + recherche de newl3.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const PRIORITES = ['ESSENTIAL', 'IMPORTANT', 'ADVANCED'];
export const STATUTS = [
  'Not researched',
  'Research in progress',
  'Reconstructed',
  'Supported by university material',
  'Verified against additional academic sources',
];
export const PROVENANCES = ['UNIVERSITY MATERIAL', 'ACADEMIC RESEARCH', 'RECONSTRUCTED COURSE', 'SUPPLEMENTARY KNOWLEDGE'];
export const NIVEAUX_SOURCE = ['P1', 'P2', 'P3'];

const lire = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function cheminCours() {
  const i = process.argv.indexOf('--cours');
  const p = i > -1 ? process.argv[i + 1] : process.env.COURS_DIR || join(RACINE, '..', 'cours');
  if (!existsSync(join(p, 'content', 'catalogue.json'))) {
    throw new Error(`Dépôt cours introuvable dans ${p} (option --cours <chemin> ou variable COURS_DIR).`);
  }
  return p;
}

export function charger(coursDir) {
  const catalogue = lire(join(coursDir, 'content', 'catalogue.json')).matieres;
  const sourcesCours = lire(join(coursDir, 'content', 'sources.json'));
  const sourcesNew = lire(join(RACINE, 'recherche', 'sources.json')).sources;
  const documents = lire(join(RACINE, 'recherche', 'documents.json')).documents;
  const recherche = lire(join(RACINE, 'recherche', 'matieres.json'));

  const sources = new Map();
  for (const s of sourcesCours) {
    sources.set(s.id, {
      id: s.id, origine: 'cours',
      niveau: s.id.startsWith('src.orleans') ? 'P1' : 'P3',
      titre: s.titre, auteur: s.auteur, date: s.date ?? null, url: s.url ?? null,
      type: s.type ?? null, acces: s.acces, consulte: s.consulte ?? null, pertinence: s.pertinence,
    });
  }
  for (const s of sourcesNew) sources.set(s.id, { ...s, origine: 'newl3' });

  const fichiersChapitres = new Map();
  for (const m of catalogue) {
    for (const ch of m.chapitres) {
      const p = join(coursDir, 'content', m.id, `${ch.id}.json`);
      if (existsSync(p)) fichiersChapitres.set(ch.id, lire(p));
    }
  }
  return { catalogue, sources, documents, recherche, fichiersChapitres };
}

/** Construit la carte de cursus de chaque matière. */
export function construireCartes({ catalogue, sources, documents, recherche, fichiersChapitres }) {
  const parMatiere = new Map(recherche.matieres.map((r) => [r.id, r]));
  const notionVersChapitre = new Map();
  for (const m of catalogue) for (const ch of m.chapitres) for (const n of ch.notions) notionVersChapitre.set(n.id, ch.id);
  for (const r of recherche.matieres) for (const ch of r.chapitres_ajoutes ?? []) notionVersChapitre.set(ch.id, ch.id);

  const docsParChapitre = new Map();
  for (const d of documents) {
    for (const c of [...(d.couvre ?? []), ...(d.ajoute ?? [])]) {
      if (!docsParChapitre.has(c)) docsParChapitre.set(c, new Set());
      docsParChapitre.get(c).add(d.id);
    }
  }

  const cartes = [];
  for (const m of catalogue) {
    const r = parMatiere.get(m.id) ?? { id: m.id, essentiels: [], avances: [], chapitres_ajoutes: [], verifies: {}, incertitudes: [] };
    const complement = Boolean(r.complement) || m.statut === 'COMP';
    const chapitres = [];

    const base = m.chapitres.map((ch) => ({ ch, ajoute: null }));
    const ajoutes = (r.chapitres_ajoutes ?? []).map((a) => ({ ch: { id: a.id, titre: a.titre, notions: a.notions.map((t) => ({ titre: t })) }, ajoute: a }));

    for (const { ch, ajoute } of [...base, ...ajoutes]) {
      const fichier = fichiersChapitres.get(ch.id);
      const srcIds = new Set(ajoute?.sources ?? []);
      const prereq = new Set(ajoute?.prerequis ?? []);
      const termes = [];
      if (fichier) {
        for (const n of fichier.notions ?? []) {
          for (const s of n.sources ?? []) srcIds.add(s);
          for (const p of n.prerequis ?? []) {
            const c = notionVersChapitre.get(p);
            if (c && c !== ch.id) prereq.add(c);
          }
          for (const t of n.termes ?? []) termes.push(t);
        }
      }
      const docs = [...(docsParChapitre.get(ch.id) ?? [])];
      const verifies = r.verifies?.[ch.id] ?? null;

      let statut;
      if (ajoute?.statut) statut = ajoute.statut;
      else if (verifies) statut = 'Verified against additional academic sources';
      else if (docs.length) statut = 'Supported by university material';
      else if (fichier || srcIds.size) statut = 'Reconstructed';
      else statut = 'Not researched';

      let priorite = ajoute?.priorite
        ?? (r.essentiels?.includes(ch.id) ? 'ESSENTIAL' : r.avances?.includes(ch.id) ? 'ADVANCED' : 'IMPORTANT');

      const provenance = [];
      if (docs.length) provenance.push('UNIVERSITY MATERIAL');
      if (srcIds.size) provenance.push('ACADEMIC RESEARCH');
      if (!ajoute || r.reconstruit || !docs.length) provenance.push('RECONSTRUCTED COURSE');
      if (complement) provenance.push('SUPPLEMENTARY KNOWLEDGE');

      chapitres.push({
        id: ch.id,
        titre: ch.titre,
        priorite,
        statut,
        provenance,
        origine: ajoute ? (docs.length ? 'ajouté d’après les documents de cours' : 'ajouté par la recherche') : 'catalogue du dépôt cours',
        notions: ch.notions.map((n) => ({ id: n.id ?? null, titre: n.titre, niveau: n.niveau ?? null })),
        documents: docs,
        sources: [...srcIds],
        verifie_par: verifies,
        prerequis: [...prereq],
        terminologie: termes.slice(0, 12).map((t) => ({ fr: t.fr, en: t.en, es: t.es })),
        note: ajoute?.note ?? null,
      });
    }

    cartes.push({
      id: m.id,
      titre: m.titre,
      langue: m.langue,
      statut_maquette: m.statut,
      complement,
      officiel: r.officiel ?? null,
      cadres: r.cadres ?? [],
      competences_examen: r.competences_examen ?? [],
      incertitudes: r.incertitudes ?? [],
      chapitres,
    });
  }
  return cartes;
}
