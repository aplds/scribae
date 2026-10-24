---
titre: Sortie d'atelier (Perchance) — le dépôt devient la seule source de vérité
date: 2026-10-24
statut: plan proposé, non démarré
auteur: Vibe (Work) — validé par Arno pour exécution par une session Code
---

# Sortie d'atelier — plan de migration

**Pourquoi ce plan.** Le développement ne passe plus par l'atelier Perchance. Objectifs :
une seule source de vérité (ce dépôt, branche `dev`), la CI comme unique juge de qualité,
et la suppression de ce qui n'existait que pour l'atelier. Rien d'autre ne change :
pas de migration technique, pas de réécriture, la stack reste telle quelle.

## Règles pour l'agent d'exécution (session Code)

1. **Une PR = un sujet.** Pas de renommage ni de réorganisation « au passage ».
2. **CI verte avant toute demande de relecture** ; en local, `npm run verifier`.
3. **Ne lire que les fichiers listés par l'étape en cours.** Pas d'exploration hors
   périmètre : le plan dit quoi ouvrir, l'inventaire de l'étape 1 précisera la suite.
4. **La doc avant le code** : `AGENTS.md` doit dire le vrai après chaque PR.
5. **Trace à chaque livraison** : entrée changelog datée + `APP_VERSION` accordé
   (règle du projet), documents rendus faux corrigés.
6. Ne jamais modifier à la main un document engendré (`VARIABLES.md`, `API.md`,
   `logiciel-engendre.mjs`) : corriger la source puis régénérer.

## Étape 0 — Sécuriser les restes (Arno, hors code)

Vérifier dans l'atelier Perchance qu'il ne reste aucun travail postérieur à
1.6.3u (commit `0552914`) non exporté. Si oui : l'exporter vers `dev` AVANT tout.
Sinon, l'atelier peut être abandonné sans perte.

## Étape 1 — Inventaire (PR : lecture seule + une section de ce document)

Recenser et écrire dans la section « Inventaire » ci-dessous, sans modifier
aucun autre fichier :

- `main.pjs` (racine) — l'intégration Perchance (greffons kv, serveur de démo,
  relais, hébergement de fichiers, moteur IA) ;
- `scripts/harnais-atelier.mjs` et tout ce qui n'existe que pour lui ;
- `src/docs/ATELIER.md` ;
- les sections « atelier » de : `AGENTS.md`, `CLAUDE.md`, `README.md` (racine),
  `src/README.md` (flux Perchance ↔ GitHub), `tests/README.md`, autres `src/docs/*` ;
- **à analyser sans décider** : le service de démonstration embarqué dans
  `index.html` (script `type="text/x-server-plugin"`) — déterminer par lecture
  (et non par essai) s'il sert demo.scribae.eu indépendamment de Perchance.

Livrable : la section « Inventaire » remplie (fichiers à modifier / supprimer par
étape, avec le motif en une ligne chacun). Aucune suppression à cette étape.

## Inventaire

*Rempli par la PR d'inventaire (étape 1 — lecture seule, aucun autre fichier modifié).*

### Constat — le service de démonstration embarqué (`index.html`)

Analysé par lecture, sans essai :

- Le bloc `text/x-server-plugin` (`index.html:53`) est le code du service de
  démonstration. Sur Perchance, la plateforme l'exécute dans un fil séparé ; en statique,
  c'est `src/pages/host.js` qui le monte : il lit le texte du bloc dans la page
  (`document.querySelector('script[type="text/x-server-plugin"]')`), l'exécute dans un
  `new Function` avec un `self` local, et l'expose comme `root.createServerSocket`
  (`src/pages/host.js:282-293, 330-368`), avec persistance dans l'IndexedDB du navigateur
  (double tampon, `src/pages/host.js:243-278`).
- Il ne dépend d'**aucun** greffon Perchance : `self.rpc` (`index.html:3176`) route et
  répond seul. Les greffons de `main.pjs` (`kv`, `createServerSocket`, `superFetch`,
  `uploadPlugin`, `generateText`) ne servent qu'à l'hébergement sur Perchance.
- `demo.scribae.eu` est servi **en statique par GitHub Pages** (`CNAME`) : la page et
  `host.js` suffisent. Le service embarqué sert donc la démonstration **indépendamment
  de Perchance** — son état vit dans le navigateur de chaque visiteur (pas de base
  partagée), les écritures y sont refusées sans clé, et il ne fait aucun appel sortant
  (SMTP indisponible, transmission et signature simulées ou refusées).

**Conséquence** : supprimer `main.pjs` ne touche pas la démonstration. Le service embarqué
reste tenu par le jeu de conformité (`tests/conformite-service.mjs`) avec son jumeau
`src/server/mysql/`. Le conserver, le réduire ou le geler se tranche à l'étape 4 (Arno).

### Supprimés à l'étape 3

| Fichier | Motif (une ligne) |
|---|---|
| `main.pjs` | Manifeste Perchance (greffons kv, serveur de démo, relais, fichiers, moteur IA) : l'hébergement Perchance disparaît, le dépôt est la seule source. |
| `scripts/harnais-atelier.mjs` | Banc d'épreuves sans terminal : n'existait que pour l'atelier — ni `package.json`, ni la CI, ni aucun autre script ne l'appelle. |
| `src/docs/ATELIER.md` | La méthode de travail dans l'atelier : plus d'atelier, plus de méthode à documenter. |

Rien d'autre n'existe que pour le harnais : vérifié par références croisées
(`grep -rl harnais-atelier` ne renvoie que des documents, aucun outil).

### Modifiés à l'étape 2 (la doc agent dit le nouveau monde)

| Fichier | Motif (une ligne) |
|---|---|
| `AGENTS.md` | Retirer atelier, harnais et flux d'export ; décrire le nouveau flux (branche `dev`, une PR par sujet, `npm run verifier`, CI verte avant relecture). |
| `CLAUDE.md` | Retirer le paragraphe « Si vous travaillez dans l'atelier (Perchance) ». |
| `README.md` (racine) | Ligne 358 (`main.pjs`) et lignes 378-391 (section « atelier » + harnais + « l'atelier de travail »). |
| `src/README.md` | § « Flux de travail : Perchance ↔ GitHub » (lignes 30-80), « Récupérer un dépôt GitHub », table « Dans l'atelier » (102-114), « l'outillage vit sous `src/` » (128-133), lignes 220 et 248 (Perchance, `main.pjs`). |
| `tests/README.md` | « Dans l'atelier » (lignes 49-55) et « Les jouer dans l'atelier » (56-63). |
| `src/docs/INDUSTRIALISATION.md` | Ligne 19, § « Vérifier depuis l'atelier : le harnais » (115-147), exemple `import("https://perchance.org/…")` (189). |
| `src/docs/REPRISE.md` | Ligne 24 (`main.pjs` = manifeste Perchance), ligne 127 (le site publié a besoin de `main.pjs`). |

### Modifiés à l'étape 3 (avec la suppression)

| Fichier | Motif (une ligne) |
|---|---|
| `src/ui/views/docs.js` (lignes 74-78) | Retirer l'entrée « atelier » de l'écran Documentation technique : elle pointe vers `src/docs/ATELIER.md`, supprimé — pas de lien mort. (Vérifier l'épreuve qui couvre cette liste.) |
| `index.html` (lignes 9-14) | Commentaire d'en-tête « AGENT : lisez `src/docs/ATELIER.md` … harnais » : devient faux. Le bloc `text/x-server-plugin` reste (étape 4). |
| `src/lib/version.js` (ligne 13) | Commentaire « Perchance ↔ GitHub » : le flux disparaît. |
| `src/LICENSE.md` (ligne 65) | « importées par nom depuis Perchance (`main.pjs`) » : `main.pjs` est supprimé — dire les ports d'hôte autrement. |
| `src/TODO.md` (lignes 12, 516) | Ligne 12 (chiffres du banc dans `docs/ATELIER.md`) et l'entrée ouverte 516 (« Le harnais jette-t-il un écran de fumée ? ») : le harnais disparaît. Le reste, coché, est de l'histoire — conservé. |
| `scripts/racine-code.mjs`, `scripts/verifier-syntaxe.mjs`, `scripts/verifier-style.mjs`, `scripts/generer-api.mjs`, `scripts/generer-logiciel.mjs`, `scripts/generer-variables.mjs` | Commentaires seuls : la double disposition (atelier/dépôt) n'existe plus. Les scripts restent — la CI les appelle. |
| `.github/workflows/ci.yml` | Commentaires seuls (« l'export le dépose », « qui n'existe que dans l'atelier »). La chaîne elle-même ne change pas. |
| `tests/parcours.mjs` (ligne 20) | Commentaire : lancer l'épreuve « dans l'atelier » (`import("https://perchance.org/…")`). |

### « atelier » qui n'est PAS l'atelier Perchance (piège nommé — ne pas toucher)

L'**écran** atelier de l'application : `?atelier`, `/atelier`, `demandeAtelier`,
`SCRIBA_ATELIER_IPS`, `src/server/mysql/atelier.mjs`, `src/lib/atelier-acces.js`,
`location /atelier` dans `nginx.conf`, les routes `/v1/atelier/acces` et
`MESSAGE_ATELIER` dans `index.html`, et les « atelier » de `README.md` (lignes 55, 203,
210, 212, 225…), `src/README.md`, `src/server/mysql/README.md` § 10. `README.md` ligne 12
aussi : l'image « L'atelier de Scribae » illustre l'interface interne, pas la plateforme
(et elle est hébergée sur `user.uploads.dev`, l'hébergement de fichiers de Perchance —
l'image reste en ligne, on ne la touche pas).

### Mentions de la plateforme Perchance, hors périmètre « atelier » (à réévaluer)

- `src/docs/ADMINISTRATION.md` (1231-1247, 1282) : le mode « Intégré (Perchance) » du
  moteur IA — le port reste dans le code (`src/lib/hosts.js:60-61`, libellé
  `src/ui/views/referentiel.js:3261`), mais plus aucun déploiement ne le fournit. À
  trancher en étape 2 : la doc dit-elle une capacité dormante, ou le mode sort-il de la
  doc (le code ne change pas dans ce chantier).
- `src/SPEC.md` (1767, 3292, 3567) : adresses `perchance.org/<générateur>` et moteur
  « n'existe que sur Perchance » — le code reste (`src/lib/recueil.js:782`,
  `globalThis.generatorName`), inatteignable sans `main.pjs`.
- `src/lib/db/index.js` (77) : « vrai sur Perchance, faux ici » — le mode « service de
  démonstration partagé » est le socket Perchance.
- `src/lib/hosts.js` (47, 60-61), `src/lib/assistant.js` (21-24, 287),
  `src/ui/assistant.js` (178), `src/lib/schema.js` (765), `src/css/app-base.css`
  (120-125) : commentaires « n'existe que sur Perchance » — le code reste (ports
  d'hôte facultatifs), les commentaires restent vrais tant qu'un hôte les fournit.
- `tests/*.test.mjs`, `src/server/mysql/*.mjs` : « harnais de navigateur » désigne
  `tests/parcours-navigateur.mjs` (Playwright, il reste), **pas**
  `scripts/harnais-atelier.mjs` — à distinguer au grep de l'étape 3.
- `src/audit/PROMPT-AUDIT-SCRIBAE.md` (5 mentions) : prompt de campagne d'audit, vivant
  (non daté) — à réévaluer en étape 3.

### Documents datés — conservés tels quels

`src/CHANGELOG.md` (l'historique mentionne l'atelier et le harnais : c'est le journal, il
fait foi), `src/audit/rapports/*.md`, `src/audit/REGISTRE-NON-CONFORMITES.md`,
`src/docs/AUDIT-BUGS-2026-09-22.md` : des constats datés, on ne réécrit pas l'histoire.

## Étape 2 — La doc agent dit le nouveau monde (PR)

- `AGENTS.md` : retirer atelier, harnais et flux d'export ; décrire le nouveau flux :
  branche `dev`, une PR par sujet, `npm run verifier` en local, CI verte avant
  relecture ; conserver tout le reste des règles (elles restent vraies) ;
- `CLAUDE.md` : pointer vers `AGENTS.md`, retirer la référence atelier ;
- `src/README.md` : réécrire la section « Flux de travail » ;
- `tests/README.md` et `src/docs/*` : retirer les mentions de l'atelier Perchance
  (liste exacte : celle de l'inventaire).
Trace changelog + `APP_VERSION`.

## Étape 3 — Suppression du legs (PR)

- `git rm main.pjs` ;
- `git rm scripts/harnais-atelier.mjs` (+ tout script qui n'existe que pour lui,
  selon l'inventaire) ;
- `git rm src/docs/ATELIER.md` ;
- `grep -ri "atelier" .` sur les fichiers restants : corriger toute mention de
  l'atelier Perchance.

**Attention, piège nommé** : le mot « atelier » désigne AUSSI un écran de
l'application (chemin `/atelier`, `demandeAtelier`, `SCRIBA_ATELIER_IPS`,
`nginx.conf` location `/atelier`). NE PAS toucher à l'application ni à la façade :
seules les mentions de l'atelier *Perchance* disparaissent.
`npm run verifier` vert + CI verte. Trace changelog + `APP_VERSION`.

## Étape 4 — Décision sur la démonstration (hors de ce chantier)

L'étape 1 apporte le constat (le service de démo embarqué sert-il
demo.scribae.eu sans Perchance ?). Les options — geler en données statiques,
réduire, ou conserver tant que l'épreuve de concordance le tient — sont à
trancher par Arno, dans un chantier distinct. Ce plan se limite à documenter
le constat.

## Étape 5 — Version

Livrer le tout sous une note « Sortie d'atelier » : première entrée datée du
changelog après 1.6.3u (lettre ou nouveau numéro, selon la règle du fichier),
`APP_VERSION` accordé.
