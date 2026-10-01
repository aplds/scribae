# Les tests de Scribae

Ce dossier porte les épreuves **transverses** : celles qui ne tiennent pas à un
module en particulier. Les épreuves du **service auto-hébergé** restent à côté de
ce qu'elles éprouvent (`src/server/mysql/*.test.mjs`, `src/server/charge/`), et
celles du **métier** qui ne touchent ni au DOM ni au réseau sont ici.

```sh
npm test                      # depuis la racine du dépôt : ce dossier + le service
node --test tests/            # ce dossier seul
```

| Fichier | Ce qu'il tient |
|---|---|
| `purs.test.mjs` | les modules purs : expressions, assainissement, numérotation, version, comptes, signature… et la **concordance** entre le client et le service (OIDC, champs d'API) |
| `abrogation-annexes.test.mjs` | les annexes d'abrogation |
| `amorcage-demo.test.mjs` | l'amorçage du jeu de démonstration — et le **second emblème** que reçoit une feuille de démonstration livrée |
| `competence-signature.test.mjs` | **qui signe** (le titulaire de la chaîne, porteur de la qualité), **qui est dans la file** (à signer, suivis, et l'acte sans signataire explicite), et **qui accède** (les qualités cumulées d'un visiteur) |
| `qualification-signature.test.mjs` | la qualification affichée d'une signature (NC-IV-001) |
| `publications-locales.test.mjs` | le repli local du recueil public |
| `pilote-persistance.test.mjs` | la persistance du pilote (base locale et base distante) |
| `original-signe.test.mjs` | la règle « part publique d'un original signé », et sa **copie** dans `index.html` |
| `conformite-service.mjs` | **le jeu d'appels commun** aux deux services (démonstration et auto-hébergé) — ce n'est pas une épreuve, mais le contrat éprouvé |
| `conformite-service.test.mjs` | l'exécution de ce jeu contre le service de démonstration, et la comparaison avec une installation réelle (`SCRIBA_CONFORMITE_URL`) |
| `parcours.mjs` | les **parcours** joués dans le NAVIGATEUR, contre l'application vivante (`lancerParcours()`) — voir `docs/INDUSTRIALISATION.md` § 2 |
| `industrialisation.test.mjs` | **l'outillage lui-même** : il lance `scripts/verifier-style.mjs` tel qu'il est livré et exige le code de sortie 0 (audit, NC-I-008 et NC-I-009) |
| `version-publication.test.mjs` | le **versionnement d'une publication** : une expression de date nouvelle crée une version, la même est idempotente, le recueil rend la plus récente en tête — et le piège d'une clé d'idempotence qui ne porte pas l'expression |
| `etat-interface.test.mjs` | le seau **`state.ui`** : il existe dès le départ, car des écrans le déréférencent directement |
| `format-date.test.mjs` | **`formatDate`** : l'horodatage complet se lit comme sa date calendaire, le reste ne change pas |
| `recueil-recherche.test.mjs` | la **recherche de l'entrée du recueil** : aucune largeur bridée dans sa règle |
| `bandeaux.test.mjs` | les **bandeaux d'information** : la sélection (allumés, non vides, dans l'ordre), le masquage des options démo éteinte, le rendu et ses quatre couleurs |
| `file-attente.test.mjs` | la **file des écritures en attente** : une écriture refusée pour une raison qui ne vient pas du réseau n'est pas représentée en boucle |
| `fusion.test.mjs` | la **fusion à trois voies** : deux postes qui écrivent le même enregistrement ne s'écrasent plus — rien n'est perdu en silence |
| `parcours.test.mjs` | l'**ordre des portes** du parcours d'un acte (parapheur, révision, signature) et la file du signataire (une annexe ne s'y signe pas) |
| `persistance-double-tampon.test.mjs` | l'**état durable du service de démonstration**, écrit en double tampon : un instantané pris au milieu d'une écriture ne perd jamais l'état |
| `relecture.test.mjs` | la **veille de lecture** : une lecture qui échoue n'est pas une lecture qui rend vide — elle reste à rejouer |
| `reprise.test.mjs` | la **reprise d'un acte ancien** : date antérieure au jour, original signé exigé, texte relu en articles sans être réécrit |
| `sante-base.test.mjs` | la **route de santé de la base** : un `401` y vaut « session requise », jamais « panne » |
| `sites.test.mjs` | **sites et cookies** : l'avertissement inter-site de l'écran « Base de données » (`SameSite=Lax`) |

## Pourquoi les imports disent `../src/…`

Le dépôt range l'outillage à sa **racine** (`scripts/`, `tests/`) et le code de
l'application sous **`src/`** : c'est la disposition **livrée**, et c'est pour
elle que ces fichiers sont écrits (le code est donc `../src/lib/…`, `../src/ui/…`
et l'outillage `../scripts/…`).

Dans l'atelier, l'outillage vit sous `src/` — `src/tests/` est le seul arbre que
la plateforme conserve d'une séance à l'autre —, et le harnais d'essai y simule
la disposition livrée. `scripts/racine-code.mjs` **constate** la racine du code
au lieu de la supposer : c'est ce qui évite le piège de NC-I-009, où un décalage
entre l'outil et l'arborescence qu'il contrôle avait éteint toutes ses
exemptions.

## Les jouer dans l'atelier

Ces épreuves ne se lancent pas au terminal dans l'atelier : c'est
**`scripts/harnais-atelier.mjs`** qui les rejoue (un fichier à la fois, comme
`node --test` les isole), en même temps que la syntaxe, le style et les
générateurs. La recette, les **chiffres attendus** et la liste des écarts connus
(qui sont un artefact du harnais, jamais une excuse) sont dans
**`docs/ATELIER.md` § 3** — le document à lire avant de travailler dans l'atelier.
