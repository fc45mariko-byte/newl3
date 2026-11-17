// Vérifie les règles de la recherche. Code de sortie 1 en cas d'erreur.
// Usage : node scripts/valider.mjs [--cours ../cours]
import { PRIORITES, STATUTS, PROVENANCES, NIVEAUX_SOURCE, cheminCours, charger, construireCartes } from './lib.mjs';

const donnees = charger(cheminCours());
const { sources, documents, recherche } = donnees;
const erreurs = [];
const avert = [];

// 1. Notices des sources de newl3 : toutes les rubriques exigées (titre, auteur, date, URL, type, pertinence).
for (const s of sources.values()) {
  if (s.origine !== 'newl3') continue;
  for (const champ of ['titre', 'auteur', 'date', 'url', 'type', 'pertinence', 'niveau', 'acces', 'consulte']) {
    if (!s[champ]) erreurs.push(`source ${s.id} : champ « ${champ} » manquant`);
  }
  if (!NIVEAUX_SOURCE.includes(s.niveau)) erreurs.push(`source ${s.id} : niveau ${s.niveau} inconnu`);
  if (s.url && !/^https:\/\//.test(s.url)) erreurs.push(`source ${s.id} : URL non https`);
}

// 2. Documents de cours.
const idsDocs = new Set();
for (const d of documents) {
  if (idsDocs.has(d.id)) erreurs.push(`document ${d.id} en double`);
  idsDocs.add(d.id);
  for (const champ of ['fichier', 'auteur', 'matiere', 'nature', 'plan']) if (!d[champ]) erreurs.push(`document ${d.id} : « ${champ} » manquant`);
}

// 3. Cartes : énumérations, références, règle de recoupement.
const cartes = construireCartes(donnees);
const idsChap = new Set();
for (const c of cartes) for (const ch of c.chapitres) {
  if (idsChap.has(ch.id)) erreurs.push(`chapitre ${ch.id} en double`);
  idsChap.add(ch.id);
}
for (const c of cartes) {
  if (!c.chapitres.length) erreurs.push(`matière ${c.id} : aucun chapitre`);
  for (const ch of c.chapitres) {
    if (!PRIORITES.includes(ch.priorite)) erreurs.push(`${ch.id} : priorité « ${ch.priorite} » inconnue`);
    if (!STATUTS.includes(ch.statut)) erreurs.push(`${ch.id} : statut « ${ch.statut} » inconnu`);
    for (const p of ch.provenance) if (!PROVENANCES.includes(p)) erreurs.push(`${ch.id} : provenance « ${p} » inconnue`);
    for (const s of ch.sources) if (!sources.has(s)) erreurs.push(`${ch.id} : source ${s} introuvable`);
    for (const d of ch.documents) if (!idsDocs.has(d)) erreurs.push(`${ch.id} : document ${d} introuvable`);
    for (const p of ch.prerequis) if (!idsChap.has(p)) erreurs.push(`${ch.id} : prérequis ${p} introuvable`);
    if (ch.statut === 'Verified against additional academic sources') {
      const v = new Set(ch.verifie_par ?? ch.sources);
      if (v.size < 2) erreurs.push(`${ch.id} : « vérifié » exige au moins deux sources indépendantes`);
    }
    if (ch.statut === 'Supported by university material' && !ch.documents.length) erreurs.push(`${ch.id} : « appuyé sur vos cours » sans document`);
    if (ch.provenance.includes('UNIVERSITY MATERIAL') && !ch.documents.length) erreurs.push(`${ch.id} : étiquette UNIVERSITY MATERIAL sans document`);
    if (!ch.sources.length && ch.statut === 'Reconstructed') avert.push(`${ch.id} : reconstruit sans source citée`);
  }
}
for (const d of documents) {
  for (const c of [...(d.couvre ?? []), ...(d.ajoute ?? []), ...(d.prerequis_transversaux ?? [])]) {
    if (!idsChap.has(c)) erreurs.push(`document ${d.id} : chapitre ${c} introuvable`);
  }
}
for (const r of recherche.matieres) for (const s of r.officiel?.sources ?? []) if (!sources.has(s)) erreurs.push(`matière ${r.id} : source ${s} introuvable`);

for (const a of avert) console.warn(`avertissement : ${a}`);
for (const e of erreurs) console.error(`ERREUR : ${e}`);
console.log(`${erreurs.length} erreur(s), ${avert.length} avertissement(s).`);
process.exit(erreurs.length ? 1 : 0);
