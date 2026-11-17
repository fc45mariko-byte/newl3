// Construit les données de l'application LEA·Study (app/data/) à partir du dépôt cours et de la recherche de newl3.
// Usage : node scripts/construire-app.mjs [--cours ../cours]
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { RACINE, cheminCours, charger, construireCartes } from './lib.mjs';

const coursDir = cheminCours();
const donnees = charger(coursDir);
const cartes = construireCartes(donnees);
const { sources, documents, recherche, fichiersChapitres, catalogue } = donnees;
const lire = (p) => JSON.parse(readFileSync(p, 'utf8'));

const sortie = join(RACINE, 'app', 'data');
rmSync(sortie, { recursive: true, force: true });
mkdirSync(join(sortie, 'm'), { recursive: true });

const parId = new Map(catalogue.map((m) => [m.id, m]));
const rech = new Map(recherche.matieres.map((r) => [r.id, r]));

// Notes du cours reconstruit de tourisme : une section « ## n. » par chapitre, dans l'ordre de la carte.
function notesTourisme() {
  const p = join(RACINE, 'cours-reconstruits', 'tou-introduction-tourisme-international.md');
  if (!existsSync(p)) return {};
  const md = readFileSync(p, 'utf8');
  const sections = md.split(/^## /m).slice(1).map((s) => {
    const [titre, ...corps] = s.split('\n');
    return { titre: titre.trim(), corps: corps.join('\n').trim() };
  });
  const tou = cartes.find((c) => c.id === 'tou');
  const notes = {};
  for (const s of sections) {
    const m = s.titre.match(/^(\d+)\./);
    if (!m) { (notes._autres ??= []).push(s); continue; }
    const n = Number(m[1]);
    if (n === 0) notes._intro = s;
    else if (tou.chapitres[n - 1]) notes[tou.chapitres[n - 1].id] = s;
  }
  return notes;
}

const utilisees = new Set();
const matieres = [];
for (const carte of cartes) {
  const m = parId.get(carte.id);
  const r = rech.get(carte.id) ?? {};
  const contenu = { id: carte.id, chapitres: {}, synthese: null, notesReconstruites: null };
  const chapitres = carte.chapitres.map((c) => {
    const f = fichiersChapitres.get(c.id);
    if (f) contenu.chapitres[c.id] = { notions: f.notions ?? [], questions: f.questions ?? [], flashcards: f.flashcards ?? [], exercices: f.exercices ?? [] };
    for (const s of c.sources) utilisees.add(s);
    for (const n of f?.notions ?? []) for (const s of n.sources ?? []) utilisees.add(s);
    return {
      id: c.id, titre: c.titre, priorite: c.priorite, statut: c.statut, provenance: c.provenance, origine: c.origine,
      notions: c.notions, documents: c.documents, sources: c.sources, prerequis: c.prerequis, note: c.note,
      nb: { notions: f?.notions?.length ?? 0, questions: f?.questions?.length ?? 0, flashcards: f?.flashcards?.length ?? 0, exercices: f?.exercices?.length ?? 0 },
    };
  });
  const syn = join(coursDir, 'content', 'syntheses', `${carte.id}.json`);
  if (existsSync(syn)) contenu.synthese = lire(syn);
  if (carte.id === 'tou') contenu.notesReconstruites = notesTourisme();
  for (const s of r.officiel?.sources ?? []) utilisees.add(s);
  writeFileSync(join(sortie, 'm', `${carte.id}.json`), JSON.stringify(contenu));

  matieres.push({
    id: carte.id, titre: carte.titre, langue: carte.langue, semestres: m.semestres, statutMaquette: m.statut,
    categorie: m.categorie, couleur: m.couleur, emploiDuTemps: m.emploiDuTemps ?? null, complement: carte.complement,
    officiel: r.officiel ?? null, cadres: carte.cadres, competences: carte.competences_examen, incertitudes: carte.incertitudes,
    chapitres,
  });
}

const index = {
  genereLe: new Date().toISOString().slice(0, 10),
  maquette: recherche._maquette,
  matieres,
  documents: documents.map((d) => ({ id: d.id, fichier: d.fichier, auteur: d.auteur, matiere: d.matiere, nature: d.nature, plan: d.plan, ecarts: d.ecarts ?? [] })),
  sources: Object.fromEntries([...utilisees].filter((id) => sources.has(id)).map((id) => {
    const s = sources.get(id);
    return [id, { titre: s.titre, auteur: s.auteur, date: s.date, url: s.url, type: s.type, niveau: s.niveau, acces: s.acces, pertinence: s.pertinence }];
  })),
  // Créneaux connus avec certitude. Les autres cours de l'emploi du temps n'ont pas d'horaire documenté : l'étudiante les ajoute dans le planning.
  creneaux: [
    { id: 'c.tou', matiere: 'tou', jour: 1, debut: '09:00', fin: '11:00', lieu: 'Salle 257', type: 'CM + TD', source: 'Emploi du temps S5 fourni (novembre 2026)' },
  ],
  // Échéances relevées dans les documents de cours.
  echeances: [
    { id: 'e.cvb-1118', date: '2026-11-18', matiere: 'cvb', titre: 'Homework: « April 1979: Thatcher outlines her radical ideology » (The Guardian) — answer the questions', source: 'homework for wednesday 18th November.docx' },
  ],
};
writeFileSync(join(sortie, 'index.json'), JSON.stringify(index));
console.log(`${matieres.length} matières, ${Object.keys(index.sources).length} sources, ${index.documents.length} documents.`);
