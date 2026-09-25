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

## Par où commencer

| Fichier | Ce qu'il contient |
|---|---|
| `src/README.md` | **à lire en premier** : architecture, conventions de code, pièges connus, et le flux de travail atelier ↔ dépôt |
| `src/SPEC.md` | la spécification fonctionnelle complète |
| `src/TODO.md` | les chantiers ouverts (et ceux faits) |
| `src/CHANGELOG.md` | le journal des versions — son premier titre daté donne `APP_VERSION` |
| `src/docs/REPRISE.md` | le kit de reprise : points d'entrée, « un seul point de vérité par règle », recettes de livraison |
| `src/audit/REGISTRE-NON-CONFORMITES.md` | les non-conformités connues, avec statut et preuves — **à lire avant de promettre** |
| `tests/README.md` | ce que tient chaque épreuve |
| `src/docs/` | administration, Docker, API, variables, industrialisation, performance |

## Comment c'est rangé

**Un fichier, un seul endroit** — et l'outillage est là où on l'attend :

```
/                       README.md, AGENTS.md, CLAUDE.md, package.json, LICENSE, CNAME, .nojekyll
                        index.html, main.pjs             la page publiée (GitHub Pages) et son code
compose-exemple/        L'EXEMPLE DE PREMIER DÉPLOIEMENT : MariaDB + l'image publiée, deux services
scripts/                L'OUTILLAGE : vérifications, analyse statique, générateurs de documents
tests/                  LES ÉPREUVES transverses (le service éprouve, lui, à côté de son code)
src/                    LE CODE, servi tel quel par le navigateur
  lib/  ui/  css/  pages/          métier pur · écrans · feuilles de style · édition statique
  server/                          service auto-hébergé (docker-compose, MySQL, nginx) — voir son README
  docs/  audit/  pdfa/  wiki.js    documentation, cadre d'audit, polices du PDF/A, guide intégré
  CHANGELOG.md  SPEC.md  TODO.md  README.md   les documents de travail
  server/mysql/*.test.mjs          les épreuves du service, à côté de ce qu'elles éprouvent
```

> **Restes d'une disposition antérieure.** Si vous trouvez `src/scripts/`, `src/tests/`,
> `src/compose-exemple/`, `src/github/`, `src/package.json`, `src/docs/GITHUB.md`,
> `src/AGENTS.md` ou `src/CLAUDE.md` dans `src/`, ce sont des **doublons** d'une version
> précédente (l'outillage et l'exemple de déploiement vivent à la racine) : supprimez-les
> (`git rm -r …`). L'export ne les produit plus, et un doublon fait corriger le fichier que
> personne ne lit.

## Vérifier — c'est tout ce qui compte

Aucune dépendance à installer, aucun build : **Node ≥ 20** suffit.

```sh
npm run verifier        # syntaxe + style (strict) + épreuves — ce que la CI exécute
npm run syntaxe         # `node --check` sur tout le JavaScript du dépôt
npm run lint            # la syntaxe, puis le style (avertissements tolérés)
npm run style           # le style seul, en strict : un avertissement fait échouer
npm test                # les épreuves (tests/ + le domaine du service)
```

Le **contrôle de style est écrit maison** (`scripts/verifier-style.mjs`, sans dépendance) : il
refuse `debugger`, signale `var` et les `console.log` du code client, et refuse les **imports
jamais employés** — un import que plus personne n'utilise trompe la lecture et survit à toutes
les refactorisations. La CI le lance en mode **strict** : ne laissez pas un avertissement passer.

Les **épreuves de parcours** (`tests/parcours.mjs`) demandent le **navigateur** : on les joue
dans la console de la page de l'application (voir `src/docs/INDUSTRIALISATION.md` § 2).

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

## Licence et données

Le **logiciel** est sous **GPL-3.0-only** : le texte intégral vit à la racine, dans `LICENSE`
(il ne fait pas partie de l'archive d'export — voir `src/README.md`). Les **actes publiés** ne
relèvent pas de cette licence mais du droit des documents administratifs : le recueil affiche
une mention de réutilisation configurable (Licence Ouverte 2.0 par défaut). Le jeu de
démonstration est entièrement **fictif** (mairie de Valmont-sur-Loire). Le détail — y compris
la position du projet sur le code produit par l'IA et la table des dépendances — est dans
`src/LICENSE.md`.
