# AGENTS.md — ce qu'un agent doit savoir avant de toucher à Scribae

**Scribae** est un éditeur de **trames** et d'**actes administratifs** pour les collectivités :
on y prépare des trames, les services les remplissent, le logiciel compile l'acte, le signe, le
publie et l'exporte (Akoma Ntoso 3.0, Schematron, JSON-LD/ELI, HTML, Markdown, Word, PDF/A).
Application **entièrement statique** (HTML + modules ES servis tels quels, **rien n'est
compilé**) + un **service compagnon** optionnel (Node/MySQL ou rangement par fichiers) pour le
travail à plusieurs postes. Licence **GPL-3.0-only** (`LICENSE`) ; démonstration publiée sur
<https://demo.scribae.eu>.

Ce fichier s'adresse à un agent (Claude Code, Mistral Vibe…) qui reprend le dépôt. Le
**même dépôt est aussi édité dans un atelier** (Perchance) : le dépôt est la référence
**publiée**, l'atelier la copie de travail. Ne renommez donc pas les fichiers sans raison.

> **Si vous travaillez dans l'atelier, lisez `src/docs/ATELIER.md` AVANT d'écrire une ligne.**
> C'est le document écrit pour être suffisant à lui seul quand on n'a pas de terminal : la
> méthode en six gestes, les dix garde-fous, le harnais qui fait tourner la syntaxe, le style,
> les épreuves et les générateurs **sans Node**, l'éprouvette du service de l'aperçu, les
> parcours du navigateur, et la liste de ce qu'on vérifie avant de dire « terminé » (§ 9).

## Par où commencer

| Fichier | Ce qu'il contient |
|---|---|
| `src/docs/ATELIER.md` | **à lire si vous travaillez dans l'atelier** : la méthode, les garde-fous, comment vérifier sans terminal, et ce qui est « terminé » |
| `src/README.md` | **à lire en premier** : architecture, conventions de code, pièges connus, et le flux de travail atelier ↔ dépôt |
| `src/SPEC.md` | la spécification fonctionnelle complète |
| `src/TODO.md` | les chantiers ouverts (et ceux faits) |
| `src/CHANGELOG.md` | le journal des versions — son premier titre daté donne `APP_VERSION` |
| `src/docs/REPRISE.md` | le kit de reprise : points d'entrée, « un seul point de vérité par règle », recettes de livraison |
| `src/audit/REGISTRE-NON-CONFORMITES.md` | les non-conformités connues, avec statut et preuves — **à lire avant de promettre** |
| `tests/README.md` | ce que tient chaque épreuve |
| `src/docs/` | atelier (la méthode), administration, Docker, API, variables, industrialisation, performance |

## Comment c'est rangé

**Un fichier, un seul endroit** — et l'outillage est là où on l'attend :

```
/                       README.md, AGENTS.md, CLAUDE.md, package.json, LICENSE, CNAME, .nojekyll
                        index.html, main.pjs             la page publiée (GitHub Pages) et son code
compose-exemple/        L'EXEMPLE DE PREMIER DÉPLOIEMENT : MariaDB + l'image publiée, deux services
scripts/                L'OUTILLAGE : vérifications, analyse statique, générateurs de documents,
                        harnais de l'atelier (harnais-atelier.mjs)
tests/                  LES ÉPREUVES transverses (le service éprouve, lui, à côté de son code)
src/                    LE CODE, servi tel quel par le navigateur
  lib/  ui/  css/  pages/          métier pur · écrans · feuilles de style · édition statique
  server/                          service auto-hébergé (docker-compose, MySQL, nginx) — voir son README
  docs/  audit/  pdfa/  wiki.js    documentation, cadre d'audit, polices du PDF/A, guide intégré
                                   (docs/ATELIER.md = la méthode de travail et les garde-fous)
  CHANGELOG.md  SPEC.md  TODO.md  README.md   les documents de travail
  server/mysql/*.test.mjs          les épreuves du service, à côté de ce qu'elles éprouvent
```

> **Restes d'une disposition antérieure** — à ne supprimer que dans le **dépôt livré**. Si vous
> y trouvez `src/scripts/`, `src/tests/`, `src/compose-exemple/`, `src/github/`, `src/package.json`,
> `src/docs/GITHUB.md`, `src/AGENTS.md` ou `src/CLAUDE.md` **sous** `src/`, ce sont des doublons
> d'une version précédente (l'outillage et l'exemple de déploiement vivent à la racine) :
> `git rm -r …`. Un doublon fait corriger le fichier que personne ne lit.
>
> **Dans l'atelier, c'est l'inverse : ne supprimez RIEN de ce qui est sous `src/`.** L'atelier ne
> conserve qu'un seul arbre (`src/`), et l'export y prend ces fichiers pour les remonter à la
> racine du dépôt : `src/AGENTS.md`, `src/CLAUDE.md`, `src/scripts/**`, `src/tests/**`,
> `src/package.json`, `src/github/**` et `src/compose-exemple/**` y sont donc **à leur place**.

## Vérifier — c'est tout ce qui compte

Aucune dépendance à installer, aucun build : **Node ≥ 20** suffit.

```sh
npm run verifier        # syntaxe + style (strict) + épreuves — ce que la CI exécute
npm run syntaxe         # `node --check` sur tout le JavaScript du dépôt
npm run lint            # la syntaxe, puis le style (avertissements tolérés)
npm run style           # le style seul, en strict : un avertissement fait échouer
npm test                # les épreuves (tests/ + le domaine du service)
```

> **Sans terminal (atelier).** Ces commandes demandent un processus, que l'atelier n'a pas : le
> harnais **`scripts/harnais-atelier.mjs`** les rejoue — les scripts livrés **tels quels** — et
> rend un verdict en quelques lignes (`h.texte(await h.verifier({ fs }))`). La recette exacte, les
> chiffres attendus et les dix-neuf écarts connus (tous dus à l'absence de Node) sont dans
> `src/docs/ATELIER.md` § 3.

Le **contrôle de style est écrit maison** (`scripts/verifier-style.mjs`, sans dépendance) : il
refuse `debugger`, signale `var` et les `console.log` du code client, et refuse les **imports
jamais employés** — un import que plus personne n'utilise trompe la lecture et survit à toutes
les refactorisations. La CI le lance en mode **strict** : ne laissez pas un avertissement passer.

Les **épreuves de parcours** (`tests/parcours.mjs`) demandent le **navigateur** : on les joue
dans la console de la page de l'application (voir `src/docs/INDUSTRIALISATION.md` § 2).

## Les garde-fous, en une ligne chacun

Le détail, et le **pourquoi** de chacun, sont dans `src/docs/ATELIER.md` § 1.

1. **Ne rien publier ni enregistrer sans demande explicite** (l'atelier porte une version non
   enregistrée : l'enregistrer fige un nom, et un nom ne se défait pas).
2. **Ne jamais écrire à la main un document engendré** (`VARIABLES.md`, `API.md`,
   `logiciel-engendre.mjs`) : corriger la source, puis régénérer.
3. **Une règle, une seule implémentation** — et quand deux existent (les deux services), le jeu
   de conformité les tient ensemble.
4. **Aucune dépendance nouvelle** ; le métier (`src/lib/`) ne touche ni au DOM ni au réseau.
5. **Tout est en français**, commentaires compris ; un commentaire dit le **pourquoi**.
6. **Après une série d'écritures : recharger l'aperçu** — les fichiers n'y sont pas appliqués
   avant, et l'on croirait regarder la nouvelle version.
7. **Toute variable de déploiement a sa ligne dans les deux `env.example`.**
8. **Une livraison laisse une trace** : changelog daté, `APP_VERSION` accordé, documents corrigés.
9. **Un changement, un sujet** : pas de renommage ni de réorganisation « au passage ».
10. **Ne jamais dire « terminé » sans preuve**, ni annoncer un chiffre qu'on n'a pas mesuré.

## Les règles du projet

- **Aucune dépendance** pour le code applicatif et l'outillage : tout est écrit à la main
  (`src/lib/xlsx.js`, `doc-import.js`, `pdfa.js`, les vérifications). La **seule** dépendance du
  dépôt est `mysql2`, pour le service auto-hébergé (`src/server/mysql/package.json`), épinglée
  par un verrou. Ajouter un paquet demande une justification forte.
- **Le métier ne touche ni au DOM ni au réseau** : les modules de `src/lib/` sont PURS (et donc
  éprouvables sans navigateur) ; les effets passent par des ports injectés. Une règle = **une
  seule implémentation** ; quand deux existent (le service de démonstration dans `index.html` et
  le service auto-hébergé dans `src/server/mysql/`), une **épreuve de concordance** les tient
  ensemble (`tests/conformite-service.mjs`).
- **Deux documents et un module sont ENGENDRÉS** — ne les modifiez jamais à la main :
  `src/docs/VARIABLES.md` (`node scripts/generer-variables.mjs`), `src/docs/API.md`
  (`node scripts/generer-api.mjs`) et `src/server/mysql/logiciel-engendre.mjs`
  (`node scripts/generer-logiciel.mjs`). Ce dernier est le **miroir d'identité** du service : son
  image ne contient que `src/server/mysql/`, elle ne peut donc pas lire `src/lib/version.js` — la
  bannière de démarrage lit ce miroir, et son épreuve (`logiciel-engendre.test.mjs`) refuse un
  miroir périmé. Corrigez la source (le registre, la description, `src/lib/version.js`,
  `src/lib/logiciel.js`), puis régénérez.
- **Toute variable de déploiement décrite** doit avoir sa ligne dans `src/server/env.example`
  (et `src/server/mysql/env.example`) — c'est éprouvé par `src/server/mysql/variables.test.mjs`.
- **Tout est en français** : libellés, commentaires, documents, messages d'erreur ; les
  commentaires disent le **pourquoi**, jamais le commentaire inutile.
- **Une livraison laisse une trace** : le titre de la première entrée datée du changelog (son
  numéro, **lettre comprise** s'il s'agit d'une note intermédiaire), `APP_VERSION` dans
  `src/lib/version.js` — les deux doivent dire la même chose —, et les documents que le
  changement rend faux.
- Le **registre d'audit** (`src/audit/REGISTRE-NON-CONFORMITES.md`) se met à jour quand une
  non-conformité est levée — avec la preuve, pas avec une intention.

## Pièges

- **`localeCompare` n'existe pas dans le moteur du service de démonstration** (pas d'`Intl`) :
  il lève une exception, et la route entière tombe en 500 — mais **seulement à partir du
  deuxième élément comparé**, un comparateur ne s'exécutant qu'à partir de là. Le défaut a donc
  vécu sans se voir sur une liste vide ou d'un seul élément (billets du recueil, 1.6.2). Dans
  `index.html`, triez avec `cmp` (dates ISO, identifiants) ou `cmpTexte` (libellés accentués,
  casse et accents pliés à la main) ; le service auto-hébergé, lui, tourne sous Node et a `Intl`.
- **Le flux temps réel est MUET si nginx tamponne la réponse** : `location = /v1/db/flux` exige
  `proxy_buffering off` (déjà écrit dans `src/server/nginx.conf` et `nginx.standalone.conf`).
  Sans lui : aucune erreur, aucun évènement — le pire des symptômes. Voir
  `src/docs/COLLABORATION.md`.
- **Ne livrez jamais deux fois le même numéro**, et ne réutilisez pas une note intermédiaire :
  le changelog fait foi (voir son en-tête).
- **Sites statiques** : les chemins sont **relatifs** (`src/css/app.css`, `src/pages/host.js`) —
  un sous-dossier de projet doit continuer à fonctionner. Ne supprimez pas `.nojekyll` (Jekyll
  casserait la publication), ni `CNAME` (l'adresse publiée).
- **Un correctif du client exige de reconstruire l'image `web`** (nginx sert les fichiers) :
  `docker compose up -d --build web` ; le code du service, lui, est dans l'image `api`.
- **Le service est le client OIDC** depuis la 1.6.1p : c'est lui qui découvre le fournisseur,
  échange le code et ouvre la session. Aucun appel OIDC ne doit repartir du navigateur (un
  annuaire qui n'ouvre pas le CORS le refuserait).
- **Le mode `demo` ne protège rien** : il ne sert qu'aux essais.
- **`git`** : décompressez une livraison **par-dessus un clone existant**, jamais dans un dossier
  vidé — sinon la `LICENSE` (qui ne fait pas partie de l'archive) disparaît.
- **La CI doit être verte avant tout envoi** : une chaîne rouge en permanence ne se distingue
  plus d'une panne réelle (c'est l'écart NC-I-008 de l'audit, corrigé par la 1.6.1q).

## Avant de dire « terminé »

On ne rend la main que lorsque ces lignes sont vraies — chacune avec une **preuve**, pas une
intention. La liste complète est dans `src/docs/ATELIER.md` § 9.

- `npm run verifier` (ou, dans l'atelier, `h.verifier({ fs })`) : **syntaxe 0 faute, style code 0**,
  et **aucun fichier autrefois vert n'est rouge** ;
- si le **service** a changé : les **deux** implémentations, et le jeu de conformité ;
- si un **écran** a changé : il a été **regardé** (390 px **et** grand) ;
- les **documents engendrés** sont régénérés si leur source a bougé ;
- la **trace** est posée (changelog daté + `APP_VERSION` + documents) ;
- le compte rendu dit **les chiffres mesurés** et **ce qui n'a pas été vérifié**.

## Licence et données

Le **logiciel** est sous **GPL-3.0-only** : le texte intégral vit à la racine, dans `LICENSE`
(il ne fait pas partie de l'archive d'export — voir `src/README.md`). Les **actes publiés** ne
relèvent pas de cette licence mais du droit des documents administratifs : le recueil affiche
une mention de réutilisation configurable (Licence Ouverte 2.0 par défaut). Le jeu de
démonstration est entièrement **fictif** (mairie de Valmont-sur-Loire). Le détail — y compris
la position du projet sur le code produit par l'IA et la table des dépendances — est dans
`src/LICENSE.md`.
