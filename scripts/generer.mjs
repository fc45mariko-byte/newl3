// Génère cartes/<matière>.json, cartes/<matière>.md, cartes/CARTE_CURRICULUM.md et rapports/FILE_RECHERCHE.md.
// Usage : node scripts/generer.mjs [--cours ../cours]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { RACINE, STATUTS, PRIORITES, cheminCours, charger, construireCartes } from './lib.mjs';

const donnees = charger(cheminCours());
const cartes = construireCartes(donnees);
const { sources, documents, recherche } = donnees;
const docs = new Map(documents.map((d) => [d.id, d]));

mkdirSync(join(RACINE, 'cartes'), { recursive: true });
mkdirSync(join(RACINE, 'rapports'), { recursive: true });

const ACCES = { lu: 'lu', extrait: 'extrait seulement', reference: 'cité, non ouvert' };
const STATUT_FR = {
  'Not researched': 'Not researched — non recherché',
  'Research in progress': 'Research in progress — recherche en cours',
  'Reconstructed': 'Reconstructed — reconstruit',
  'Supported by university material': 'Supported by university material — appuyé sur vos cours',
  'Verified against additional academic sources': 'Verified against additional academic sources — recoupé',
};

function ligneSource(id) {
  const s = sources.get(id);
  if (!s) return `- ⚠ source inconnue : \`${id}\``;
  const champs = [
    `**${s.titre}**`,
    s.auteur,
    s.date ? `date : ${s.date}` : 'date : non renseignée',
    s.url ? `<${s.url}>` : 'URL : non renseignée',
    `type : ${s.type ?? 'non renseigné'}`,
    `niveau ${s.niveau}`,
    `accès : ${ACCES[s.acces] ?? s.acces}`,
  ];
  return `- ${champs.join(' · ')}\n  - Pertinence : ${s.pertinence}`;
}

function md(carte) {
  const o = carte.officiel;
  const L = [];
  L.push(`# ${carte.titre} (\`${carte.id}\`)`, '');
  L.push(`Carte de cursus générée le ${new Date().toISOString().slice(0, 10)} par \`scripts/generer.mjs\`. Ne pas modifier à la main : modifier \`recherche/\` puis régénérer.`, '');
  L.push('> Cette carte est une **approximation académique informée**, pas le syllabus de l’enseignant. Seuls les éléments étiquetés UNIVERSITY MATERIAL viennent de vos cours.', '');
  if (carte.complement) L.push('**Matière hors maquette** : tout son contenu est SUPPLEMENTARY KNOWLEDGE.', '');

  L.push('## Ce que dit l’université (ACADEMIC RESEARCH, priorité 1)', '');
  if (o) {
    L.push(`- **Semestre et volume** : ${o.semestres}`, `- **Enseignant** : ${o.enseignant}`, `- **Descriptif officiel** : ${o.description}`);
    if (o.bibliographie?.length) L.push(`- **Bibliographie officielle** : ${o.bibliographie.join(' ; ')}`);
    L.push('');
    if (o.sources?.length) { L.push('Sources :', ...o.sources.map(ligneSource), ''); }
  } else L.push('Aucune donnée officielle.', '');

  const docsMatiere = documents.filter((d) => d.matiere === carte.id);
  L.push('## Vos documents de cours (UNIVERSITY MATERIAL)', '');
  if (docsMatiere.length) {
    for (const d of docsMatiere) {
      L.push(`### ${d.fichier}`, '', `${d.nature}. Auteur : ${d.auteur}.`, '');
      L.push('Plan :', ...d.plan.map((p) => `- ${p}`), '');
      if (d.ecarts?.length) L.push('Écarts relevés par la recherche :', ...d.ecarts.map((e) => `- ${e}`), '');
    }
  } else L.push('Aucun document reçu pour cette matière. La carte ci-dessous est entièrement reconstruite.', '');

  L.push('## Carte des chapitres', '');
  L.push('| Chapitre | Priorité | Statut | Provenance |', '|---|---|---|---|');
  for (const c of carte.chapitres) L.push(`| ${c.titre} (\`${c.id}\`) | ${c.priorite} | ${c.statut} | ${c.provenance.join(', ')} |`);
  L.push('');

  for (const c of carte.chapitres) {
    L.push(`### ${c.titre}`, '');
    L.push(`- **Priorité** : ${c.priorite}`, `- **Statut** : ${STATUT_FR[c.statut]}`, `- **Provenance** : ${c.provenance.join(', ')}`, `- **Origine du chapitre** : ${c.origine}`);
    if (c.note) L.push(`- **Note** : ${c.note}`);
    L.push('', 'Notions :', ...c.notions.map((n) => `- ${n.titre}${n.niveau ? ` *(niveau ${n.niveau})*` : ''}`), '');
    if (c.prerequis.length) L.push(`Prérequis : ${c.prerequis.map((p) => `\`${p}\``).join(', ')}`, '');
    if (c.documents.length) L.push(`Appuyé sur : ${c.documents.map((d) => docs.get(d)?.fichier ?? d).join(' ; ')}`, '');
    if (c.verifie_par) L.push(`Recoupé avec : ${c.verifie_par.map((s) => `\`${s}\``).join(', ')}`, '');
    if (c.terminologie.length) {
      L.push('Terminologie :', '', '| Français | English | Español |', '|---|---|---|');
      for (const t of c.terminologie) L.push(`| ${t.fr ?? ''} | ${t.en ?? ''} | ${t.es ?? ''} |`);
      L.push('');
    }
    if (c.sources.length) L.push('Sources :', ...c.sources.map(ligneSource), '');
    else L.push('Sources : aucune. Chapitre à rechercher.', '');
  }

  if (carte.cadres.length) L.push('## Cadres théoriques et méthodes', '', ...carte.cadres.map((x) => `- ${x}`), '');
  if (carte.competences_examen.length) L.push('## Compétences d’examen', '', ...carte.competences_examen.map((x) => `- ${x}`), '');
  if (carte.incertitudes.length) L.push('## Incertitudes', '', ...carte.incertitudes.map((x) => `- ${x}`), '');
  return L.join('\n');
}

for (const carte of cartes) {
  writeFileSync(join(RACINE, 'cartes', `${carte.id}.json`), JSON.stringify(carte, null, 2) + '\n');
  writeFileSync(join(RACINE, 'cartes', `${carte.id}.md`), md(carte) + '\n');
}

// Carte d'ensemble
const tous = cartes.flatMap((c) => c.chapitres);
const compte = (cle, val, liste = tous) => liste.filter((c) => c[cle] === val).length;
const G = ['# Carte du cursus L3 LEA anglais-espagnol, parcours commerce international', ''];
G.push(`Générée le ${new Date().toISOString().slice(0, 10)}. ${cartes.length} matières, ${tous.length} chapitres, ${documents.length} documents de cours, ${sources.size} sources.`, '');
G.push(`> ${recherche._maquette}`, '');
G.push('## Statut de la recherche', '', '| Statut | Chapitres |', '|---|---|', ...STATUTS.map((s) => `| ${s} | ${compte('statut', s)} |`), '');
G.push('## Priorités', '', '| Priorité | Chapitres |', '|---|---|', ...PRIORITES.map((p) => `| ${p} | ${compte('priorite', p)} |`), '');
G.push('## Par matière', '', '| Matière | Chapitres | ESSENTIAL | Vos cours | Recoupés | Reconstruits | À rechercher | Carte |', '|---|---|---|---|---|---|---|---|');
for (const c of cartes) {
  const ch = c.chapitres;
  G.push(`| ${c.titre} | ${ch.length} | ${compte('priorite', 'ESSENTIAL', ch)} | ${compte('statut', 'Supported by university material', ch)} | ${compte('statut', 'Verified against additional academic sources', ch)} | ${compte('statut', 'Reconstructed', ch)} | ${compte('statut', 'Not researched', ch) + compte('statut', 'Research in progress', ch)} | [${c.id}](${c.id}.md) |`);
}
writeFileSync(join(RACINE, 'cartes', 'CARTE_CURRICULUM.md'), G.join('\n') + '\n');

// File d'attente de recherche
const F = ['# File d’attente de la recherche', '', `Générée le ${new Date().toISOString().slice(0, 10)}. À traiter dans l’ordre : chapitres ESSENTIAL d’abord.`, ''];
const ordre = (a, b) => PRIORITES.indexOf(a.priorite) - PRIORITES.indexOf(b.priorite);
const aFaire = cartes.flatMap((c) => c.chapitres.filter((x) => ['Not researched', 'Research in progress'].includes(x.statut)).map((x) => ({ ...x, matiere: c.titre }))).sort(ordre);
F.push('## Chapitres non recherchés ou en cours', '', '| Matière | Chapitre | Priorité | Statut |', '|---|---|---|---|', ...aFaire.map((x) => `| ${x.matiere} | ${x.titre} | ${x.priorite} | ${x.statut} |`), '');
const sansSource = cartes.flatMap((c) => c.chapitres.filter((x) => !x.sources.length && x.statut !== 'Not researched').map((x) => ({ ...x, matiere: c.titre }))).sort(ordre);
F.push('## Chapitres rédigés sans source citée', '', 'Ces chapitres ont un contenu (dans cours ou dans vos documents) mais aucune source externe ne l’appuie.', '', ...sansSource.map((x) => `- ${x.matiere} : ${x.titre} (\`${x.id}\`, ${x.priorite})`), '');
const utilisees = new Set(tous.flatMap((c) => c.sources));
for (const r of recherche.matieres) for (const s of r.officiel?.sources ?? []) utilisees.add(s);
const incompletes = [...sources.values()].filter((s) => utilisees.has(s.id) && (!s.url || !s.type || !s.date));
F.push('## Sources utilisées dont la notice est incomplète', '', `${incompletes.length} sources citées dans les cartes n’ont pas d’URL, de type ou de date. Elles viennent pour la plupart du dépôt cours, dont le registre ne prévoyait pas ces champs.`, '', '| Source | Manque |', '|---|---|');
for (const s of incompletes) F.push(`| ${s.titre} (\`${s.id}\`) | ${[!s.url && 'URL', !s.type && 'type', !s.date && 'date'].filter(Boolean).join(', ')} |`);
F.push('', '## Incertitudes par matière', '');
for (const c of cartes) if (c.incertitudes.length) F.push(`### ${c.titre}`, '', ...c.incertitudes.map((x) => `- ${x}`), '');
writeFileSync(join(RACINE, 'rapports', 'FILE_RECHERCHE.md'), F.join('\n') + '\n');

// Comparaison documents de cours / carte reconstruite
const C = ['# Vos documents comparés à la carte reconstruite', '', `Générée le ${new Date().toISOString().slice(0, 10)}. Pour chaque matière qui a reçu au moins un document : ce que les documents confirment, ce qu’ils ajoutent, et ce qui reste sans support de l’enseignant.`, ''];
for (const carte of cartes) {
  const ds = documents.filter((d) => d.matiere === carte.id);
  if (!ds.length) continue;
  const couverts = carte.chapitres.filter((c) => c.documents.length);
  const ajoutes = carte.chapitres.filter((c) => c.origine.startsWith('ajouté') && c.documents.length);
  const sansDoc = carte.chapitres.filter((c) => !c.documents.length);
  C.push(`## ${carte.titre}`, '', `Documents : ${ds.map((d) => d.fichier).join(' ; ')}.`, '');
  C.push(`- **Chapitres appuyés sur vos documents (${couverts.length}/${carte.chapitres.length})** : ${couverts.map((c) => c.titre).join(' ; ') || 'aucun'}`);
  C.push(`- **Chapitres ajoutés parce que vos documents les traitent et que la reconstruction les ignorait** : ${ajoutes.map((c) => c.titre).join(' ; ') || 'aucun'}`);
  C.push(`- **Chapitres encore sans support de l’enseignant (reconstruits)** : ${sansDoc.map((c) => c.titre).join(' ; ') || 'aucun'}`);
  const ecarts = ds.flatMap((d) => (d.ecarts ?? []).map((e) => `${d.fichier} : ${e}`));
  if (ecarts.length) C.push('', 'Écarts relevés :', ...ecarts.map((e) => `- ${e}`));
  C.push('');
}
const sansAucun = cartes.filter((c) => !documents.some((d) => d.matiere === c.id) && !c.complement);
C.push('## Matières sans aucun document reçu', '', ...sansAucun.map((c) => `- ${c.titre} (\`${c.id}\`)`), '');
writeFileSync(join(RACINE, 'rapports', 'COMPARAISON_DOCUMENTS.md'), C.join('\n') + '\n');

console.log(`${cartes.length} cartes, ${tous.length} chapitres, ${aFaire.length} chapitres à rechercher, ${incompletes.length} notices incomplètes.`);
