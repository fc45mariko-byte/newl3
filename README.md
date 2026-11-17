# newl3 — recherche académique autonome, L3 LEA commerce international

Base de connaissances de recherche pour la **L3 LEA anglais-espagnol, parcours commerce international, Université d'Orléans**. Elle ne dépend pas seulement des cours fournis par l'étudiante :
- elle recherche chaque matière ;
- elle reconstruit les chapitres manquants ;
- elle classe chaque information selon sa provenance ;
- elle suit l'état de la recherche chapitre par chapitre.

Le contenu pédagogique détaillé (fiches, QCM, exercices) reste dans le dépôt [`cours`](https://github.com/fc45mariko-byte/cours), dont `newl3` lit le catalogue.

## Organisation

| Chemin | Contenu |
|---|---|
| `recherche/PROTOCOLE.md` | Règles de recherche : hiérarchie des sources, étiquettes, statuts, priorités, intégration d'un nouveau document, recherche continue |
| `recherche/sources.json` | Registre des sources consultées : niveau P1/P2/P3, auteur, date, URL, type, accès, pertinence |
| `recherche/documents.json` | Inventaire de vos documents de cours : plan, chapitres couverts ou ajoutés, écarts avec l'état actuel des connaissances |
| `recherche/matieres.json` | Données saisies par matière : fiche officielle, priorités, chapitres ajoutés, incertitudes, compétences d'examen |
| `cartes/CARTE_CURRICULUM.md` | Vue d'ensemble des 23 matières (générée) |
| `cartes/<matière>.md` et `.json` | Carte de cursus de chaque matière (générée) |
| `cours-reconstruits/` | Cours rédigés quand aucun support n'existe (étiquetés RECONSTRUCTED COURSE) |
| `rapports/COMPARAISON_DOCUMENTS.md` | Vos documents comparés à la reconstruction (généré) |
| `rapports/FILE_RECHERCHE.md` | File d'attente : chapitres à rechercher, chapitres sans source, notices incomplètes (généré) |
| `rapports/CONTRADICTIONS.md` | Désaccords entre sources, avec la position retenue |
| `app/` | Application LEA·Study (une page HTML, sans compilation) et ses données générées `app/data/` |
| `scripts/` | Générateur, validateur et construction des données de l'application (Node ≥ 20, sans dépendance) |

## Commandes

Le dépôt `cours` doit être cloné à côté de `newl3` (`../cours`). Sinon, passer `--cours <chemin>` ou définir `COURS_DIR`.

```bash
npm run valider   # contrôle les règles (refuse une source sans URL, un statut inconnu, un « vérifié » à une seule source…)
npm run generer   # régénère cartes/ et rapports générés
npm run app       # régénère app/data/ pour l'application LEA·Study
npm run check     # tout
```

## Étiquettes et statuts

| Étiquette de provenance | Sens |
|---|---|
| **UNIVERSITY MATERIAL** | Présent dans un document de cours fourni |
| **ACADEMIC RESEARCH** | Tiré d'une source externe citée |
| **RECONSTRUCTED COURSE** | Synthèse rédigée pour combler un manque |
| **SUPPLEMENTARY KNOWLEDGE** | Approfondissement ou matière hors maquette |

**Priorités :** ESSENTIAL, IMPORTANT, ADVANCED.

**Statuts de recherche :** Not researched → Research in progress → Reconstructed → Supported by university material → Verified against additional academic sources.

Une carte de cursus est une approximation académique, pas le syllabus de l'enseignant.

## Application LEA·Study

`app/index.html` est publiée comme page privée sur claude.ai : https://claude.ai/artifact/LrG234xzZe2ZXtdLVQ8krS. Sur claude.ai, l'assistant interroge Claude et la progression (tâches, notes, objectifs, XP) est enregistrée dans le compte. Ouverte ailleurs (par exemple servie depuis `app/` par GitHub Pages), l'application fonctionne sans assistant et enregistre la progression dans le navigateur.
