# Protocole de recherche académique autonome

Ce protocole applique la section 3 du cahier des charges (« Autonomous academic research »). Il s'impose à toute mise à jour de `recherche/`, `cartes/` et `cours-reconstruits/`.

## A. Recherche par matière

Pour chacune des 23 matières, sans attendre de document de cours :

1. Lire la fiche officielle d'Orléans (priorité 1).
2. Chercher au moins une fiche équivalente dans une autre université française (priorité 2).
3. Identifier manuels, normes et textes de référence (priorité 3).
4. Déduire les chapitres et leurs objectifs, puis les inscrire dans `recherche/matieres.json`.
5. Relever les cadres théoriques, la terminologie (FR / EN / ES) et les compétences d'examen.
6. Lancer `node scripts/generer.mjs` pour produire la carte de la matière.

## B. Hiérarchie des sources

| Niveau | Contenu | Exemples |
|---|---|---|
| **P1** | Université d'Orléans : fiches officielles, MCC, livrets, documents des enseignants, Celene | `r.orleans-l3-s5`, documents de `recherche/documents.json` |
| **P2** | Autres universités françaises (LEA, commerce international, langues) | `r.bordeaux-montaigne-tourisme`, `r.lille-l3-tci` |
| **P3** | Recherche à comité de lecture, manuels, institutions, organisations professionnelles et internationales | `r.irts-2008`, `r.anc-2022-06`, `r.leiper-1979` |

Une source anglaise ou espagnole est préférée quand elle explique mieux ou fournit une langue authentique.

**Règle de conflit :** un document de cours de l'année en cours l'emporte sur la page web officielle quand les deux divergent. Raison : la page web semble décrire une maquette antérieure (codes LLA contre LAL).

## C. Reconstruction et intégration d'un nouveau document

À chaque document reçu :

1. Calculer son empreinte MD5 et écarter les doublons exacts.
2. Extraire le texte, et regarder les pages qui ne sont que des schémas.
3. L'inscrire dans `recherche/documents.json` : auteur, nature, plan, chapitres couverts (`couvre`), chapitres créés (`ajoute`), écarts.
4. Comparer son plan à la carte :
   - un chapitre de la carte absent du document reste « Reconstructed » ;
   - un sujet du document absent de la carte devient un chapitre ajouté.
5. Vérifier chaque fait daté du document contre les sources actuelles : réglementation, chiffres, personnes en fonction.
6. Régénérer, valider, et noter les changements dans `rapports/CONTRADICTIONS.md` si besoin.

**Le contenu reconstruit n'est jamais présenté comme venant de l'enseignant.**

## Étiquettes de provenance

| Étiquette | Condition d'attribution |
|---|---|
| UNIVERSITY MATERIAL | Le chapitre est couvert par au moins un document de `recherche/documents.json` |
| ACADEMIC RESEARCH | Le chapitre cite au moins une source externe |
| RECONSTRUCTED COURSE | La structure ou le contenu du chapitre vient de la reconstruction (catalogue `cours` ou recherche), pas d'un plan d'enseignant |
| SUPPLEMENTARY KNOWLEDGE | Matière hors maquette, ou approfondissement signalé comme tel |

Un chapitre peut porter plusieurs étiquettes.

## D. Citations

Chaque source de `recherche/sources.json` doit avoir :
- titre ;
- auteur ou institution ;
- date (ou « non indiquée ») ;
- URL ;
- type ;
- niveau (P1, P2 ou P3) ;
- niveau d'accès : `lu`, `extrait` ou `reference` ;
- date de consultation ;
- pertinence.

`scripts/valider.mjs` refuse toute notice incomplète.

Les sources importées du dépôt `cours` n'ont ni date ni type : elles sont listées dans `rapports/FILE_RECHERCHE.md` pour être complétées.

Règles :
- aucune référence n'est inventée ;
- une référence non ouverte est notée `reference` ;
- les références académiques sont vérifiées dans Crossref.

## E. Priorités et statuts

**Priorités :**
- **ESSENTIAL** : nécessaire pour réussir la matière.
- **IMPORTANT** : utile à la préparation de l'examen.
- **ADVANCED** : approfondissement.

**Statuts, du moins avancé au plus avancé :**
1. **Not researched** : plan seulement, aucune source.
2. **Research in progress** : sources partielles, contenu incomplet.
3. **Reconstructed** : contenu rédigé à partir de sources externes.
4. **Supported by university material** : au moins un document de cours couvre le chapitre.
5. **Verified against additional academic sources** : les faits clés sont recoupés avec au moins deux sources indépendantes, dont au moins une lue. Le validateur exige deux sources.

## F. Complétude n'est pas certitude

Une carte de cursus est une approximation. Chaque carte rappelle :
- ce qui vient de l'université ;
- ce qui vient d'ailleurs ;
- ce qui reste inconnu (rubrique « Incertitudes »).

Quand deux sources se contredisent, la contradiction est décrite, pas tranchée en silence.

## G. Recherche continue

Ce protocole décrit une méthode. Il ne lance aucun processus automatique : chaque recherche a lieu pendant une session de travail.

| Situation | Action |
|---|---|
| Vous ne comprenez pas une notion | Chercher une autre explication (manuel, source anglaise ou espagnole) et l'ajouter au chapitre comme ACADEMIC RESEARCH |
| Un cours cite une référence sans la préciser | L'identifier et l'ajouter au registre. Exemples : « Oisen (1971) » → Olsen 1971 ; « British Politics page 179 » → à identifier |
| Une notion suppose une autre matière | Ajouter le prérequis au chapitre (exemple : le projet de filiale de gestion de projet dépend d'ICI, de MKS et du financement en TCI) |
| Un sujet évolue | Vérifier l'état actuel : réglementation comptable 2025, Incoterms® 2020, personnes en fonction, chiffres du tourisme |

L'ordre de travail est donné par `rapports/FILE_RECHERCHE.md` : chapitres ESSENTIAL non recherchés d'abord.
