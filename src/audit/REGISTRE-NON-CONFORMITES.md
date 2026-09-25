---
titre: Registre des non-conformités — Scribae
version: 5
cree_le: 2026-09-21
mis_a_jour: 2026-09-30 (**5e campagne** : NC-I-015 et NC-I-016 ouvertes pour le verrou de dépendances et le chemin des tests à la racine ; NC-II-015 ouverte pour la balise noindex non déployée ; 39 fiches au total)
cadre: src/audit/PROMPT-AUDIT-SCRIBAE.md
---

# Registre des non-conformités — Scribae

> **Document de travail.** Ce registre recense des non-conformités, dont certaines sont
> **encore ouvertes** : il ne se lit pas seul. Une fiche n'a de sens qu'avec son **statut**, sa
> **preuve** et les **propositions** de la campagne qui l'a établie, dans le cadre d'audit
> (`PROMPT-AUDIT-SCRIBAE.md`) qui définit ses termes. Pour un lecteur pressé : la **synthèse**
> ci-dessous, puis la synthèse et le plan d'action du **rapport le plus récent** (`rapports/`).
> Les fiches se lisent ensuite, une par une.

Registre **cumulatif**. Une entrée ne se supprime jamais ; son **statut** évolue. Les
identifiants sont stables d'un audit à l'autre : une non-conformité garde le sien tant
qu'elle n'est pas levée.

Statuts : `Ouverte` · `En cours` · `Levée` (avec date et preuve) · `Régression` (une
non-conformité levée réapparaît) · `Acceptée` (risque explicitement assumé, par qui et
pourquoi) · `Obsolète` (le périmètre a disparu, avec justification).

Cotation : `Bloquante` · `Majeure` · `Mineure` · `Observation` (voir
`PROMPT-AUDIT-SCRIBAE.md` §6.1).

> **Confidentialité.** Ce registre ne recopie ni donnée à caractère personnel réelle, ni
> secret (jeton, clé, mot de passe). Les secrets aperçus dans le code sont désignés par
> leur **emplacement** (`fichier:ligne`), jamais par leur valeur.

---

## Synthèse

| Cote | Nombre | Ouvertes | En cours | Levées |
|---|---|---|---|---|
| Bloquante | 3 | 0 | 0 | 3 |
| Majeure | 13 | 0 | 5 | 8 |
| Mineure | 11 | 0 | 3 | 8 |
| Observation | 15 | 1 | 4 | 10 |
| **Total** | **39** | **1** | **12** | **26** |

> Les nombres de cette synthèse sont **recalculés sur les fiches** à chaque campagne *et* à chaque
> traitement d'une proposition du plan d'action. Le premier traitement du 2026-09-23 (livraison
> 1.6.1c) a porté quatre fiches en « Levée » (NC-I-009, NC-II-013, NC-III-005 et NC-III-007, dont la
> régression est réparée) et trois en « En cours » (NC-I-002, NC-I-008, NC-III-008). Le **second
> traitement**, le même jour (livraisons 1.6.1e à 1.6.1k), a porté trois fiches de plus en « Levée »
> (NC-I-001, NC-I-004, NC-I-010) et une en « En cours » (NC-I-003, dont le constat n'est qu'en partie
> traité) ; il a aussi rafraîchi NC-I-002, NC-IV-001 et NC-IV-004, sans changer leur statut. Aucune
> fiche ne porte plus le statut « Régression ». La livraison **1.6.1l** (rangement des données par
> fichiers, chats des pages d'erreur) n'a **changé aucun statut** : elle ajoute des capacités
> optionnelles sans toucher aux constats de la 3e campagne. Elle a en revanche corrigé une phrase
> d'`ADMINISTRATION.md` restée fausse depuis la 1.6.1j (elle disait que le service auto-hébergé ne
> rendait pas les renvois ni les mentions du recueil) : c'est une correction de documentation, et
> aucun identifiant n'a été ouvert pour cela. La livraison **1.6.1m** (le **fil de parcours** :
> `src/lib/parcours.js`, `src/ui/parcours.js`, monté sur cinq écrans ; les **annexes** écartées de
> la file « Ma signature » et étiquetées « Annexe — ne se signe pas ») n'a **changé aucun statut**
> elle non plus : elle répond à deux constats d'usage et ne touche à aucun des constats de la 3e
> campagne. Elle porte en revanche le parc de tests à **286 épreuves sur 25 fichiers** (chacune
> verte, chaque fichier éprouvé **isolément**), et ajoute `src/tests/parcours.test.mjs` (8
> épreuves). Une **relecture écran par écran**, demandée après la livraison, a corrigé trois
> défauts d'affichage de la même famille — une porte **passée sans être franchie** (acte signé et
> publié sans trace de révision) était montrée comme la porte *ouverte*, la note du fil s'isolait
> à droite, et le maillon « › » pouvait se retrouver seul en tête de ligne ; ces défauts sont
> d'INTERFACE, et hors du périmètre des quatre regards de la campagne : aucun identifiant n'a été
> ouvert pour eux. Les mentions « 255 épreuves sur 22 fichiers » que portent les fiches
> **NC-I-001** et **NC-I-003**
> décrivent l'état au moment de la livraison **1.6.1k** et sont datées comme telles ; la présente
> note donne l'état courant, et les fiches ne sont pas réécrites pour autant. La livraison **1.6.1n**
> (les réglages de l'**annuaire OIDC** partout : les quatre cartes de l'onglet « Annuaire »
> proposées dans **tous** les modes, la case « proposer AUSSI la connexion par l'annuaire »
> — la *seconde porte* —, la **publication** de la configuration d'annuaire par le service dans
> `GET /v1/auth/config`, et les **22 variables `SCRIBA_ANNUAIRE_*`** du `.env`) n'a **changé aucun
> statut** elle non plus : elle répond à un constat d'usage (aucun moyen de brancher un OIDC depuis
> l'interface ou le `.env`) et ne touche à aucun des constats de la 3e campagne. Elle porte en
> revanche le parc de tests à **300 épreuves sur 26 fichiers** (chacune verte, chaque fichier
> éprouvé **isolément**), et ajoute `src/server/mysql/annuaire.test.mjs` (6 épreuves). La limite
> qu'elle assume — une session d'annuaire n'ouvre pas la porte des données d'un service à **session**
> (l'échange du jeton d'annuaire contre une session de service reste au programme) — est consignée
> au `TODO.md` plutôt qu'ici : elle relève d'un périmètre futur, et non d'un constat de la campagne. La
> livraison **1.6.1o** (la façade sert enfin les modules `.mjs`) n'a **changé aucun statut** elle non
> plus : c'est un défaut d'**exploitation**, découvert hors campagne — la table des types d'nginx ne
> connaît pas l'extension `mjs` et la servait en `application/octet-stream`, que le navigateur refuse
> pour un module ES : le graphe d'imports cassait et la page restait **blanche**, sans autre indice
> que la console. Il est désormais **tenu par une épreuve** : `src/tests/industrialisation.test.mjs`
> confronte les extensions importées par le client à ce que la façade déclare servir. Le parc de
> tests passe à **301 épreuves sur 26 fichiers** (dont une nouvelle, sautée là où le dépôt n'est pas
> lisible).

> La livraison **1.6.1p** (le service devient le client OIDC : découverte, échange du code,
> vérification du jeton et ouverture de SA session — l'échange du jeton d'annuaire contre une session
> de service, jusqu'ici inscrit au `TODO.md`, est donc **fait**) n'a **changé aucun statut** : elle
> ferme une limite assumée et répond à un constat d'exploitation (« Découverte impossible (Failed to
> fetch) », causé par le CORS du fournisseur), sans toucher aux constats de la 3e campagne. La limite
> qu'elle ferme était consignée ici comme relevant d'un périmètre futur : elle est désormais
> **tenue par des épreuves** (`annuaire-service.test.mjs`, `jws.test.mjs`, et la concordance des deux
> implémentations dans `src/tests/purs.test.mjs`). Cette note a d'ailleurs été l'occasion d'un
> **défaut de câblage** : le drapeau `annuaireService`, publié par le service, n'était pas transmis au
> client par `chargerModeDeploiement` (non plus que `comptesLocaux`, `session` et `adminPanne`) — le
> client se croyait donc devant un service antérieur, et le symptôme d'origine subsistait, service à
> jour. Corrigé, et désormais tenu par une épreuve qui confronte **les champs que le client lit du
> service** à ceux qu'il lui transmet. La même passe a fermé deux autres constats du même genre — un
> constat de la fiche **NC-I-002** et un écart de documentation : l'**analyse statique** refuse
> maintenant les *imports jamais employés* (`src/scripts/analyse-imports.mjs`, éprouvé ; dix-neuf
> fichiers en portaient quarante et une mentions), et `RATE_MAX_CONNEXIONS` — décrite au wiki,
> absente des deux modèles de `.env` — a sa ligne dans `src/server/mysql/env.example`, avec une
> épreuve qui tient la règle « un descripteur, une ligne dans `env.example` » pour tout le registre.

> La livraison **1.6.1q** (l'outillage prend ses quartiers à la racine du dépôt) ferme **une
> fiche : NC-I-007** passe en « Levée » — l'outillage vit désormais là où un intégrateur, une
> forge et un agent le cherchent (`scripts/`, `tests/`, `package.json`, `.github/workflows/ci.yml`),
> le code restant sous `src/`. Elle ne répond à aucun constat de la 3e campagne, mais elle ferme
> précisément le décalage qui avait **désarmé les exemptions du contrôle de style** (NC-I-009), et
> elle ajoute ce qu'il faut pour qu'un agent reprenne le dépôt sans le casser : `AGENTS.md`,
> `CLAUDE.md`, `tests/README.md`, et un manifeste dont les commandes partent de la racine. Avant
> livraison, l'outillage a été **éprouvé dans les deux dispositions** (livrée et atelier) : 210
> fichiers analysés par le contrôle de style, aucune remarque, en mode ordinaire comme en mode
> strict, et les 346 épreuves de 28 fichiers, chacune verte, chaque fichier éprouvé isolément. Le
> parc d'épreuves est donc **inchangé** — cette livraison range, elle n'ajoute pas de règle.
> Le parc passe à **346 épreuves sur 28 fichiers**
> (11 sautées là où le dépôt n'est pas lisible ou `node:crypto` est incomplet), et `comptes.test.mjs`
> passe de 27 à **39 épreuves**.

> La livraison **1.6.1r** (un **exemple de déploiement** à la racine du dépôt : `compose-exemple/`,
> deux services et trois commandes, rien à construire) n'a **changé aucun statut** : elle ne touche à
> aucun des constats de la 3e campagne.

> La livraison **1.6.1s** — la **reprise des actes anciens** — ouvre **une fiche, NC-II-014**, et la
> porte aussitôt en « **Levée** ». Le défaut n'est pas venu de la campagne mais du travail lui-même :
> en ajoutant la collection `reprises` au magasin **local** du navigateur (`src/lib/db/local.js`), il
> est apparu que la table des dossiers ne déclarait **pas** `informations` (présente depuis la
> 1.5.3) : le proxy de stockage range une collection sous le nom de sa propriété, si bien que toute
> collection non déclarée écrivait dans le **même dossier partagé** (`undefined`). `informations` y
> vivait donc, et `reprises` aurait écrit **par-dessus**. Le dossier de chacune est désormais déclaré,
> `dossierDe()` ne renvoie plus d'alias pour une collection inconnue (repli en mémoire seulement), et
> les données héritées sont reprises une fois, sans perte. La fiche porte le constat, la preuve et la
> recommandation — c'est un écart de **fiabilité** (intégrité des données locales) qu'un audit aurait
> relevé tôt ou tard, et il est désormais tenu par une épreuve. Le parc de tests passe à **358
> épreuves sur 29 fichiers** (11 sautées là où le dépôt n'est pas lisible), chacune verte, chaque
> fichier éprouvé isolément — dont `src/tests/reprise.test.mjs` (9 épreuves) et deux épreuves de plus
> pour le service (`src/server/mysql/actes.test.mjs`).

## Historique des audits

| Date | Rapport | Auditeur | Version outil | NC ouvertes | NC levées | NC nouvelles |
|---|---|---|---|---|---|---|
| 2026-09-21 | `rapports/AUDIT-SCRIBAE-2026-09-21.md` | Audit initial (quatre regards : DSI, RSSI, qualiticien, DAJ) | 1.2.0 | 0 | 0 | 27 |
| 2026-09-21 | `rapports/AUDIT-SCRIBAE-2026-09-21b.md` | Audit 2e campagne (quatre regards : DSI, RSSI, qualiticien, DAJ), parcours par l'interface | 1.2.0 | 6 | 18 | 3 |
| 2026-09-23 | `rapports/AUDIT-SCRIBAE-2026-09-23.md` | Audit 3e campagne (quatre regards : DSI, RSSI, qualiticien, DAJ), dépôt GitHub, démonstration publiée et chaîne d'intégration | 1.6.0 | 16 | 0 | 6 |

---

# Fiches

## Chapitre I — Systèmes d'information (DSI)

### NC-I-001 — Aucun test automatisé du code client

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | I.3 — Environnements, tests, industrialisation |
| Constat | Le code de l'application (`main.pjs`, `index.html`, 124 fichiers sous `src/`, ~66 400 lignes) n'a **aucun test automatisé**. Seuls deux fichiers de tests existent, et ils ne couvrent que le service auto-hébergé : `src/server/mysql/comptes.test.mjs`, `src/server/mysql/actes.test.mjs`. Aucun test ne couvre la compilation, les exports, la numérotation, les délais, la signature, la persistance ou les vues. |
| Exigence de référence | ISO/IEC 25010 (maintenabilité, fiabilité) ; ISO/IEC 25040 (évaluation) ; bonne pratique d'industrialisation. |
| Preuve | Recherche `*.test.*` / `*.spec.*` : deux occurrences, toutes deux sous `src/server/mysql/` (`package.json` déclare `"test": "node --test"`). Aucun test sous `src/lib/` ni `src/ui/`. |
| Recommandation | Introduire une base de tests exécutables hors navigateur sur les modules **purs** (`src/lib/compile.js`, `expr.js`, `execution.js`, `numbering.js`, `eli.js`, `akn.js`, `export.js`, `amend.js`), puis des tests de bout en bout sur les parcours. Voir proposition P-03. |
| Effort | Élevé (chantier progressif) |
| Priorité | Haute |
| Échéance | 90 jours (base), au-delà (couverture complète) |
| Statut | **Levée** (2026-09-23, livraisons 1.6.1e à 1.6.1k) — le code client est désormais éprouvé : **22 fichiers de tests, 255 épreuves**, chacune verte, chaque fichier éprouvé **isolément** (comme `node --test`), auxquels s'ajoutent les **épreuves de parcours** (navigateur, `src/tests/parcours.mjs`) et le **jeu d'appels de conformité** commun aux deux services (`src/tests/conformite-service.mjs`, voir NC-I-010). Les cinq échecs de `src/server/mysql/actes.test.mjs` relevés pendant la campagne n'étaient pas un défaut du domaine mais **de l'épreuve** : elle lisait `.body` sur la promesse rendue par un gestionnaire asynchrone (l'ouverture du circuit de signature), sans l'attendre — l'épreuve est corrigée, et le cas est désormais documenté (`docs/INDUSTRIALISATION.md` §2). **Réserve explicite** : les parcours ne tournent pas **en intégration continue** (aucun moteur de navigateur dans la chaîne) — ils se rejouent à la main dans l'aperçu de l'atelier ; ce reste est suivi par NC-I-002 et NC-I-008. |
| Origine | Audit 2026-09-21 |

### NC-I-002 — Aucune chaîne d'intégration/déploiement, aucune analyse statique, aucun verrou de dépendances

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | I.3 — Industrialisation ; I.4 — Chaîne d'approvisionnement |
| Constat | Aucun fichier d'intégration continue (`.github/` absent), aucun linter/formateur (`.eslintrc`, `tsconfig`, `.editorconfig` absents), aucun `package-lock.json`. Le `Dockerfile` du service exécute `npm install --omit=dev` sans verrou, et la dépendance est déclarée en plage (`mysql2: "^3.11.3"`). Les images de base sont des **étiquettes flottantes** (`node:20-alpine`, `mariadb:11`, `nginx:alpine`), sans empreinte. Deux développeurs ou deux dates peuvent donc produire deux artefacts différents. |
| Exigence de référence | ISO/IEC 27002 (gestion des dépendances, maîtrise des changements) ; bonne pratique de reproductibilité des livraisons. |
| Preuve | Absence de `.github/`, `package-lock.json`, `.eslintrc*`, `tsconfig*` (inventaire du dépôt) ; `src/server/mysql/Dockerfile:5` (`FROM node:20-alpine`) ; `src/server/mysql/package.json` (`"mysql2": "^3.11.3"`) ; `src/server/docker-compose.yml` (`image: mariadb:11`, `image: nginx:alpine`). |
| Recommandation | Ajouter un pipeline minimal (lint + `node --test`), committer le `package-lock.json`, épingler les images par digest, fixer les étiquettes de dépendances. Voir P-03. |
| Effort | Moyen |
| Priorité | Haute |
| Échéance | 90 jours |
| Statut | **En cours** (2026-09-23 ; revu après traitement de P-31 et P-32, puis après les livraisons 1.6.1e à 1.6.1p) — le **verrou de dépendances est livré** : `src/server/mysql/package-lock.json` (12 paquets, versions épinglées, empreintes SHA-512 **vérifiées contre les archives réellement retirées** du registre npm), et la chaîne comme les `Dockerfile` installent par `npm ci`. Les deux causes de la chaîne rouge sont identifiées et corrigées (voir NC-I-008). Le parc de tests est passé à **255 épreuves sur 22 fichiers** (voir NC-I-001). L'**analyse statique est livrée** (1.6.1p) : `src/scripts/verifier-style.mjs` refuse `debugger`, les `var`, les traces de client, et désormais les **imports jamais employés** (`src/scripts/analyse-imports.mjs`, éprouvé dans `src/tests/purs.test.mjs`) — **aucun outil tiers**, c'est un choix d'approvisionnement (voir INDUSTRIALISATION §4). Reste à constater une exécution **réelle** de la chaîne, ce qui demande un envoi sur le dépôt. À noter : la dépendance était déjà épinglée (`mysql2: "3.11.3"`, sans plage) ; la preuve du constat ci-dessus citait `"^3.11.3"`, qui n'est plus l'état du fichier. |
| Origine | Audit 2026-09-21 |

### NC-I-003 — Fichiers monolithiques : la reprise par un tiers est freinée

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | I.2 — Qualité et lisibilité du code ; I.8 — Documentation et reprise |
| Constat | Plusieurs fichiers concentrent une part disproportionnée de la matière : `src/css/app.css` (3 146 lignes), `src/ui/views/signature.js` (3 135 lignes), `src/SPEC.md` (2 702 lignes), `src/README.md` (2 672 lignes), `src/lib/seed.js` (2 455), `src/ui/views/rediger.js` (2 196), `src/ui/views/editor.js` (2 137), `src/lib/demo-actes.js` (2 033), `src/ui/views/referentiel.js` (2 009). La documentation de référence est un **unique** `README.md` de ~215 Ko, qui mêle mode d'emploi, doctrine, recettes d'exploitation et notes de conception. |
| Exigence de référence | ISO/IEC 25010 (maintenabilité : modularité, analysabilité) ; objectif de reprise par une équipe sans l'auteur (question directrice I). |
| Preuve | Inventaire `wc` du dépôt (`src/README.md` 2 672 lignes / ~214 Ko ; `src/SPEC.md` 2 702 / ~196 Ko ; `src/css/app.css` 3 146 ; `src/ui/views/signature.js` 3 135). |
| Recommandation | Scinder la documentation en un `README.md` d'entrée + des documents thématiques (`ARCHITECTURE.md`, `EXPLOITATION.md`, `DOCTRINE.md`), et découper les gros modules de vue en sous-composants. Voir P-04. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 90–180 jours |
| Statut | **En cours** (2026-09-23, livraisons 1.6.1e à 1.6.1k) — le constat est **en partie** traité : `src/css/app.css` (3 609 lignes) n'est plus un monolithe mais une **entrée de dix `@import`** vers dix parties (`src/css/app-*.css`, chacune avec son en-tête ; découpage vérifié octet à octet contre l'ancien fichier), et `src/docs/REPRISE.md` détache la reprise du reste de la documentation. Restent volumineux : `src/README.md` 3 475 lignes, `src/SPEC.md` 3 457, `src/ui/views/signature.js` 3 387, `src/ui/views/referentiel.js` 3 078 (256 fichiers, 118 459 lignes sous `src/`) — le découpage des gros modules de vue n'est pas fait. |
| Origine | Audit 2026-09-21 |

### NC-I-004 — Une même règle implémentée trois fois (partie publique de l'original, empreinte)

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | I.1 — Architecture ; I.2 — Duplication |
| Constat | La règle « la part publique d'un original signé est le paquet privé de son dossier interne et des mentions nominatives » est écrite **trois fois**, indépendamment : `sansInterne()` dans `index.html` (service de démonstration), `sansInterne()` dans `src/server/mysql/actes.mjs`, et `partiePublique()` dans `src/lib/signature.js`. Chacune supprime la même liste de champs. De même, SHA-256 synchrone est défini deux fois (`sha256Hex` dans `index.html`, `sha256Hex` dans `src/lib/signature.js`). |
| Exigence de référence | Principe DRY ; ISO/IEC 25010 (maintenabilité : modifiability). |
| Preuve | `index.html` (`function sansInterne`), `src/server/mysql/actes.mjs` (`sansInterne`), `src/lib/signature.js` (`export function partiePublique`). |
| Recommandation | Extraire un module « original signé » unique, partagé (généré/recopié à l'identique côté serveur), et une seule implémentation d'empreinte. Voir P-04. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-23, livraison 1.6.1k) — la règle « part publique d'un original signé » a désormais **un seul point de vérité** : `src/server/mysql/original-signe.mjs` (`CHAMPS_INTERNES`, `sansInterne`, `partiePublique`), importé par `src/lib/signature.js` (qui ré-exporte `partiePublique`) et par `src/server/mysql/actes.mjs` (les implémentations locales sont supprimées). La copie du service de démonstration (`index.html`) ne peut plus dériver : `src/tests/original-signe.test.mjs` (5 épreuves) extrait `sansInterne`/`sha256Hex` (plus `utf8Bytes` et `K256`) de `index.html` et les compare au module partagé et à `node:crypto`. Le module est rangé sous `src/server/mysql/` et non `src/lib/` à dessein : le contexte Docker du service n'embarque que ce dossier. |
| Origine | Audit 2026-09-21 |

### NC-I-005 — Nommage ambigu et propriété intellectuelle non définie

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | I.2 — Lisibilité ; I.5 — Gouvernance du code |
| Constat | Deux modules voisins portent des noms quasi identiques pour des objets sans rapport : `src/lib/revision.js` (circuit de **révision** d'un acte avant signature) et `src/lib/revisions.js` (historique des brouillons). Par ailleurs, aucun fichier `LICENSE` n'est présent : la documentation (`src/docs/GITHUB.md`, section « Licence ») indique « tous droits réservés au propriétaire du dépôt », sans préciser les droits sur le code **produit par l'IA**. |
| Exigence de référence | Bonne pratique de gouvernance ; question directrice I (« propriété intellectuelle du code produit par l'IA »). |
| Preuve | `src/lib/revision.js` (exports `peutReviser`, `demanderRevision`, `validerRevision`…) et `src/lib/revisions.js` (exports `ajouterRevision`, `restaurerRevision`) ; absence de `LICENSE` ; `src/docs/GITHUB.md` section « Licence ». |
| Recommandation | Renommer l'un des deux modules (`historique-brouillons.js`), et statuer par écrit sur la licence et sur les droits attachés au code généré. Voir P-04 et P-12. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — la licence est tranchée (`src/LICENSE.md` : GPL-3.0 pour le logiciel, Licence Ouverte 2.0 pour les données) et `src/docs/GITHUB.md` est réaligné ; `src/lib/revisions.js` est renommé `src/lib/historique-brouillons.js` (imports et documentation suivis), ce qui lève l'ambiguïté avec `src/lib/revision.js`. |
| Origine | Audit 2026-09-21 |

### NC-I-006 — Observabilité et exploitation du service de démonstration

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | I.6 — Exploitation |
| Constat | Le service de démonstration (`index.html`) n'offre qu'un `console.log` serveur et un point de santé `GET /v1/health` (avec indicateur de capacité utile — bon point). Son état durable est un tampon de taille fixe évidé par ancienneté (`MAX_ACTES 80`, `MAX_PUBLIES 40`, `MAX_SIGNATURES 80`) : une publication peut donc disparaître du recueil public par simple pression. Aucune procédure de sauvegarde/restauration n'est prévue pour ce mode (elle existe, en revanche, pour l'auto-hébergé — `src/docs/ADMINISTRATION.md` § 8). |
| Exigence de référence | ISO/IEC 27002 (journalisation, sauvegarde) ; ISO/IEC 25010 (fiabilité, disponibilité). |
| Preuve | `index.html` (`hSante`, `evince`, constantes `MAX_*`) ; `src/docs/ADMINISTRATION.md` § 7.2, § 8. |
| Recommandation | Documenter explicitement que le mode démonstration **n'est pas** un mode de conservation, et interdire son usage en service réel. Voir P-11. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — le mode démonstration est explicitement présenté comme non conservatoire dans `src/docs/ADMINISTRATION.md` § 7.5 et § 7.6 (« la démonstration n'est pas un service »). |
| Origine | Audit 2026-09-21 |

### NC-I-007 — L'outillage d'industrialisation vit dans `src/`, pas à la racine du dépôt

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | I.3 — Environnements, tests, industrialisation ; I.5 — Gouvernance du code |
| Constat | Les trois briques d'industrialisation livrées par la campagne 2 — contrôle de syntaxe (`src/scripts/verifier-syntaxe.mjs`), tests hors navigateur (`src/tests/purs.test.mjs`) et chaîne d'intégration (`src/github/ci.yml`) — sont rangées **sous `src/`**, c'est-à-dire dans l'arborescence servie de la page, et non à la racine du dépôt. Or c'est la racine qui est lue par un intégrateur ou une forge : ni `package.json`, ni `\.github/workflows/`, ni `tests/` n'y figurent. L'outillage livré n'est donc pas là où on l'attend, et la CI n'est pas active. |
| Exigence de référence | Bonne pratique d'industrialisation ; ISO/IEC 25010 (maintenabilité, reproductibilité) ; objectif de reprise par un tiers. |
| Preuve | La table de l'export (`src/README.md` § « Exporter le dépôt GitHub ») range chaque source à sa place : `src/scripts/**` → `scripts/**`, `src/tests/**` → `tests/**`, `src/package.json` → `package.json`, `src/github/ci.yml` → `.github/workflows/ci.yml`, `src/AGENTS.md` → `AGENTS.md` ; et l'export ne les recopie plus dans `src/`. Commandes lancées **depuis la racine** : `npm run verifier` (346 épreuves, 28 fichiers, chacune verte, chaque fichier éprouvé isolément ; contrôle de style éprouvé dans les deux dispositions, 210 fichiers, aucune remarque, ordinaire comme strict). Avant : `src/package.json`, `src/scripts/verifier-syntaxe.mjs`, `src/tests/purs.test.mjs`, `src/github/ci.yml` — et l'absence des mêmes fichiers à la racine du dépôt. |
| Recommandation | Recopier l'outillage à la racine du dépôt lors de la publication (ou documenter le lien), et trancher le rangement. Voir P-27. |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-23, livraison 1.6.1q) — l'outillage est rangé **à la racine du dépôt** (`scripts/`, `tests/`, `package.json`, `.github/workflows/ci.yml`, `AGENTS.md`, `CLAUDE.md`) et le code de l'application sous `src/` ; l'export range chaque source à sa place et **ne la recopie plus** dans `src/` — un fichier, un seul endroit. Les scripts **constatent** la racine du code (`scripts/racine-code.mjs`) au lieu de la supposer, ce qui les rend justes dans les deux dispositions (dépôt et atelier). L'outillage est désormais là où un intégrateur, une forge et un agent le cherchent : `npm run verifier` part de la racine, et la CI nomme l'étape qui lâche. |
| Origine | Audit 2026-09-21b |

### NC-I-008 — La chaîne d'intégration continue est rouge depuis sa mise en service

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | I.3 — Environnements, tests, industrialisation |
| Constat | Le contrôle mécanique livré ne protège rien : sur le dépôt publié, le workflow « Intégration continue » a été déclenché à chaque envoi et a échoué **quatre fois sur quatre** (envois `a18a876`, `d1cb19a`, `5086a22`, `efaade3`). Les deux travaux échouent : « Syntaxe et tests » (étape « Vérifier la syntaxe de tout le JavaScript », code de sortie 1) et « Service auto-hébergé » (étape « Tests du domaine des comptes et de la signature »). Un voyant rouge permanent ne se distingue plus d'une panne réelle : c'est l'inverse du service qu'une chaîne rend. |
| Exigence de référence | ISO/IEC 25010 (fiabilité, maintenabilité) ; bonne pratique d'intégration continue — une chaîne rouge équivaut à une chaîne absente. |
| Preuve | API GitHub, `GET /repos/aplds/scribae/actions/runs` : quatre exécutions « Intégration continue » sur `main`, toutes `conclusion: failure` ; `GET /actions/runs/{id}/jobs` : « Syntaxe et tests » en échec à l'étape 4, « Service auto-hébergé » en échec à l'étape 5. Première cause reproduite en atelier (voir NC-I-009). Journaux d'exécution **non lisibles** sans droits d'administration sur le dépôt (403 « Must have admin rights to Repository ») : la cause du second travail n'a pas pu être instruite dans cette campagne. |
| Recommandation | Rendre la chaîne verte avant toute communication publique (P-31, P-32), publier son état (badge dans le README, P-38), et traiter un échec comme un arrêt de livraison. |
| Effort | Faible (premier travail : cause identifiée) à moyen (second travail : cause à instruire) |
| Priorité | Très haute |
| Échéance | 0–30 jours |
| Statut | **En cours** (2026-09-23, après traitement de P-31) — les **deux causes sont reproduites et corrigées** : (1) le contrôle de style ne reconnaissait pas ses exemptions (NC-I-009, corrigé) ; (2) le travail « Service auto-hébergé » échouait sur cinq épreuves de `src/server/mysql/actes.test.mjs` qui n'attendaient pas la promesse du gestionnaire de signature (corrigé). Vérifié **en atelier** sur la disposition livrée : `npm run lint` → code de sortie 0 (180 fichiers, aucune remarque), et les **255 épreuves des 22 fichiers passent** (chaque fichier isolément, comme `node --test` les exécute ; voir NC-I-001). Non encore vérifié : une exécution réelle de la chaîne, qui demande un envoi sur le dépôt. |
| Origine | Audit 2026-09-23 (3e campagne) |

### NC-I-009 — Le contrôle de style ne reconnaît pas ses exemptions dans la disposition livrée

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | I.3 — Industrialisation ; I.2 — Qualité et lisibilité du code |
| Constat | `verifier-style.mjs` choisit le dossier à analyser en cherchant `src/` **à côté de lui-même** : dans la copie de travail comme dans le dépôt livré, l'outillage vit sous `src/`, donc `dossierCode` vaut « . » et le parcours produit des chemins préfixés par « ./ » (`./scripts/verifier-style.mjs`, `./server/mysql/server.mjs`). Or les exemptions sont écrites pour une autre disposition (`scripts/…`, `pages/host.js`, `server/…`) : plus aucune ne s'applique. Conséquence directe : les trois lignes du script qui contiennent le mot `debugger` (dans ses propres commentaires et dans sa règle) sont comptées comme **erreurs**, et le script sort en code 1 — c'est le premier échec de la chaîne (NC-I-008). Conséquence secondaire : le code du service, censé être exempté de l'avertissement `console.log`, ne l'est plus. |
| Exigence de référence | ISO/IEC 25010 (fiabilité, maintenabilité) ; cohérence entre l'outil de contrôle et la disposition qu'il contrôle. |
| Preuve | `src/scripts/verifier-style.mjs:23-31` (choix de `dossierCode` et commentaire d'intention), `:36` (`const rel = dir ? dir + sep + e.name : e.name`), `:44-45` (exemptions), `:70` (le garde `!chemin.startsWith("scripts" + sep)`). Reproduction en atelier, disposition livrée : `relScript = "./scripts/verifier-style.mjs"`, `exempteScript = false`, `exempteServeur = false`, nombre d'erreurs comptées = 3, code de sortie attendu = 1. |
| Recommandation | Normaliser le chemin avant comparaison (retirer un éventuel préfixe « ./ », comparer à la racine nue) et ajouter une épreuve qui exécute les deux contrôles sur la disposition livrée (P-31). |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-23) — le dossier analysé est le **parent de l'outillage** (le code du projet, que l'on soit dans la copie de travail ou dans le dépôt livré), avec repli d'un cran si l'outillage remonte un jour à la racine ; les chemins rendus sont relatifs à cette racine, **sans préfixe « ./ »**, et les exemptions s'appliquent de nouveau. Preuve : reproduction des deux états sur la disposition livrée — avant, code de sortie 1, **3 erreurs** (`debugger` compté dans l'outillage lui-même) et **95 avertissements** (exemptions mortes, dont `./server/web/host.js`) ; après, code de sortie 0, **180 fichiers, aucune remarque**, en mode ordinaire comme en mode `--strict`. Épreuve de non-régression : `src/tests/industrialisation.test.mjs` (3 épreuves) exécute le contrôle tel qu'il est livré et vérifie qu'il a bien **vu** le code. |
| Origine | Audit 2026-09-23 (3e campagne) |

### NC-I-010 — L'API est implémentée deux fois (démonstration et service auto-hébergé)

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | I.1 — Architecture et découpage ; I.2 — Duplication |
| Constat | L'API du service est **implémentée deux fois** : une fois dans le service de démonstration (`index.html`, script `type="text/x-server-plugin"` : routes, rôles, journal, quota, courriel, purge), une fois dans le service auto-hébergé (`src/server/mysql/*.mjs` : `actes.mjs`, `bulletins.mjs`, `server.mjs`, `comptes.mjs`…). Les deux rendent les mêmes routes, mais avec deux persistances (état binaire en mémoire, base MariaDB) et **deux jeux de tests différents** : seuls ceux du serveur existent (`src/server/mysql/*.test.mjs`), la démonstration n'est couverte par rien. Les corrections de cette revue de code ont dû être appliquées deux fois — le registre le documente (`NC-II-004` : « des deux côtés (service de démonstration `index.html` et `src/server/mysql/server.mjs`) ») —, et rien ne garantit mécaniquement que les deux réponses restent identiques. |
| Exigence de référence | ISO/IEC 25010 (maintenabilité) ; principe « une règle, une implémentation » ; §2.3 du cadre d'audit (distinguer la démonstration du déploiement cible sans les confondre). |
| Preuve | `index.html` (constantes `SERVICE`, `MAX_PUBLIES`, table `ROUTES`, `egalConstant`, `journaliser`, `hSante`) face à `src/server/mysql/server.mjs`, `actes.mjs` (mêmes routes `/v1/actes…`), `src/server/mysql/*.test.mjs` (11 fichiers) — aucun test de la démonstration. |
| Recommandation | Faire de la démonstration un **adaptateur** du même domaine (persistance injectée), ou, à défaut, définir une **épreuve de conformité** exécutée contre les deux implémentations (jeu d'appels commun) pour rendre toute divergence visible (P-37). |
| Effort | Élevé (extraction du domaine) ; faible pour l'épreuve de conformité |
| Priorité | Moyenne |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-23, livraison 1.6.1i) — la recommandation est satisfaite par sa **branche « à défaut »** : un **jeu d'appels commun** (`src/tests/conformite-service.mjs`, 13 appels dont la dépublication) est joué **contre les deux implémentations** — en Node sur le service auto-hébergé, et dans le navigateur sur le service de démonstration —, et peut être comparé à une installation réelle par la variable `SCRIBA_CONFORMITE_URL`. Une divergence de réponse entre les deux devient donc visible mécaniquement. Réserve assumée : les deux implémentations **subsistent** (la démonstration n'est pas devenue un adaptateur du domaine) — c'est le choix de ne pas extraire le domaine côté démonstration qui reste consigné ici. |
| Origine | Audit 2026-09-23 (3e campagne) |

### NC-I-015 — Absence de verrou de dépendances à la racine pour l'outillage

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | I.3 — Industrialisation ; I.4 — Chaîne d'approvisionnement |
| Constat | Aucun `package-lock.json` à la racine du dépôt. Le service auto-hébergé a son verrou (`src/server/mysql/package-lock.json`), mais l'outillage à la racine (`scripts/`, `tests/`) n'a pas de verrou pour ses dépendances (aucune dépendance directe, mais `npm ci` échouerait sans verrou). |
| Exigence de référence | ISO/IEC 27002 (gestion des dépendances), bonne pratique de reproductibilité. |
| Preuve | `ls -la package-lock.json` — b No root lock file b. `cat package.json` — pas de dépendances directes, mais `npm install` pourrait épingler des versions. |
| Recommandation | Exécuter `npm install` à la racine et committer le `package-lock.json` généré. Voir P-31. |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 0—30 jours |
| Statut | **Nouvelle** (2026-09-30, 5e campagne) |
| Origine | Audit 2026-09-30 |

### NC-I-016 — Le chemin des tests dans `package.json` à la racine est incorrect pour la CI

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | I.3 — Industrialisation ; I.3 — Environnements, tests |
| Constat | `package.json` à la racine définit `"test": "node --test tests/ src/server/mysql/ src/server/charge/"`. Or `src/server/mysql/` et `src/server/charge/` ne sont pas à la racine, mais sous `src/`. La CI GitHub échoue car elle ne trouve pas ces chemins. |
| Exigence de référence | ISO/IEC 25010 (fiabilité, maintenabilité), bonne pratique d'intégration continue. |
| Preuve | `.github/workflows/ci.yml` — `run: npm test` — échec car `Cannot find module '/workspace/github__aplds__scribae/src/server/mysql'`. `node --test tests/ src/server/mysql/ src/server/charge/` — même erreur locale. |
| Recommandation | Corriger le chemin dans `package.json` : `"test": "node --test tests/ ./src/server/mysql/ ./src/server/charge/"`. Voir P-32. |
| Effort | Faible |
| Priorité | Très haute |
| Échéance | 0—30 jours |
| Statut | **Nouvelle** (2026-09-30, 5e campagne) |
| Origine | Audit 2026-09-30 |


## Chapitre II — Sécurité des systèmes d'information (RSSI)

### NC-II-001 — Le jeton d'écriture de l'API est publié dans le code client, et sa portée est globale

| Champ | Valeur |
|---|---|
| Gravité | **Bloquante** |
| Chapitre / section | II.8 — Secrets et configuration ; II.6 — Segmentation des environnements |
| Constat | Le service (`<script type="text/x-server-plugin">` de `index.html`) n'a qu'**un seul** mode d'autorisation pour les écritures : un jeton porteur, dont seule l'empreinte SHA-256 est en dur (`CLE_JETON`). Or le jeton lui-même est **en clair, dans le code côté client** (`DEFAULT_PUBLICATION.jetonDemonstration`), donc lisible par quiconque ouvre la page ou consulte la source, et de surcroît affiché (masquable) dans la console API de l'application. Un tiers anonyme peut donc obtenir ce jeton et appeler toutes les routes d'écriture : dépôt d'acte, ouverture de circuit de signature, transmission, publication au recueil, épinglage, et **synchronisation de n'importe quelle collection** (dont `users` et `config`). |
| Exigence de référence | OWASP ASVS (V2 authentification, V4 contrôle d'accès, V6 cryptographie) ; RGS ; ANSSI (hygiène informatique — pas de secret dans un canal non protégé). |
| Preuve | `index.html:66` (`const CLE_JETON = "…"` — valeur non recopiée ici) ; `src/lib/eli.js:42` (`jetonDemonstration`, en clair, côté client) ; `src/ui/views/api-console.js:39` (jeton affiché dans l'interface) ; test dynamique : `POST /v1/db/collections/presence/sync` avec `Authorization: Bearer <jeton de démonstration>` → **200**, enregistrement créé puis relu. |
| Recommandation | Traiter ce jeton comme **compromis par construction**. En production : un jeton par client, jamais dans le code servi (injection par le déploiement), portée et permissions par route, rotation, révocation. Voir P-01. |
| Effort | Élevé (mais le déploiement auto-hébergé fournit déjà la brique `API_TOKENS`) |
| Priorité | Très haute |
| Échéance | 0–30 jours (au minimum : neutraliser le service de démonstration derrière une instance non publique) |
| Statut | **Levée** (2026-09-21b) — plus aucun secret dans le code servi : la clé est engendrée côté client (`crypto.getRandomValues`), seule son empreinte SHA-256 est conservée (`src/lib/cle-service.js`) ; un service neuf est en lecture seule (`GET /v1/auth/etat` → `provisionne:false`) ; les clés portent un rôle. Vérifié à l'écran (provisionnement, liste, révocation) puis à l'API (403 `service_non_provisionne`). |
| Origine | Audit 2026-09-21 |

### NC-II-002 — La signature d'un acte est forgeable (webhook non authentifié, intégrité reposant sur une empreinte publique)

| Champ | Valeur |
|---|---|
| Gravité | **Bloquante** |
| Chapitre / section | II.5 — Signature, intégrité et non-répudiation |
| Constat | La route `POST /v1/webhooks/signature` est **publique** (aucun jeton, aucune signature de prestataire, aucun HMAC, pas de liste d'IP). Le service y « valide » une signature en comparant l'empreinte SHA-256 du document fourni à celle de l'acte déposé — or le document déposé est lui-même **lisible sans authentification** (`GET /v1/actes/{id}/document`). Un tiers anonyme peut donc : déposer un acte, ouvrir un circuit, **fabriquer** un paquet signé portant le nom et la fonction de son choix, le présenter sur le webhook et faire passer l'acte à « signée ». Le scénario a été reproduit de bout en bout, y compris la **publication au recueil public** avec attribution d'un identifiant ELI (publication ensuite retirée par l'auditeur pour nettoyage). |
| Exigence de référence | Règlement eIDAS (UE) 910/2014 ; OWASP ASVS (V4 contrôle d'accès, V7 journalisation/intégrité) ; exigence de non-répudiation. |
| Preuve | `index.html` (route `POST /v1/webhooks/signature`, `auth: "public"` ; `hWebhookSignature`, seul contrôle = `sha256Hex(document) !== acte.sha256`) ; `index.html` (route `GET /v1/actes/{id}/document`, sans `auth`) ; test reproduit : dépôt `ACT-…` (201) → `GET …/document` sans jeton (200) → `POST …/signature` (202) → `POST /v1/webhooks/signature` **sans en-tête** (200, `statut: signee`, signataire arbitraire) → `POST …/publication` (201, acte visible au recueil). Même conception dans `src/server/mysql/actes.mjs` (route `auth: "public"`). |
| Recommandation | Authentifier l'appelant du webhook (secret partagé/HMAC, mTLS, ou vérification d'un JWT du prestataire), restreindre la lecture du document déposé, et exiger la vérification cryptographique du paquet signé (clé publique du certificat attendu). Voir P-02. |
| Effort | Élevé |
| Priorité | Très haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-21b) — le webhook exige une clé de rôle `prestataire` ou `administrateur`, et le document déposé une clé de rôle `lecteur`. Vérifié : appel sans clé refusé. |
| Origine | Audit 2026-09-21 (confirme et qualifie le point d'entrée « usurpation du signataire » du prompt §4.2) |

### NC-II-003 — Les collections du référentiel sont lisibles sans authentification

| Champ | Valeur |
|---|---|
| Gravité | **Bloquante** |
| Chapitre / section | II.1 — Cartographie et classification des données ; II.4 — Sécurité de l'API |
| Constat | `GET /v1/db/collections/{collection}` ne demande **aucun** jeton. Quand le service détient des données — c'est le mode « service de démonstration » que la documentation propose (« rien à installer, partagé »), et le mode auto-hébergé en `AUTH_MODE=demo` — cette route rend l'intégralité des enregistrements, **comptes compris** (login, courriel, rôles, rattachements, préférences), ainsi que les trames, les actes, le journal et la configuration (qui peut contenir la clé d'un moteur de langage). |
| Exigence de référence | RGPD (art. 5, 32) ; OWASP ASVS V4 ; CNIL (sécurité des données, minimisation). |
| Preuve | `index.html` (route `GET /v1/db/collections/([a-z]+)`, **sans** `auth` ; `hDbCollection` renvoie `payload` complet) ; test reproduit : écriture d'un enregistrement de sonde via `POST …/sync` avec jeton, puis `GET /v1/db/collections/presence` **sans en-tête** → **200**, enregistrement complet renvoyé. Comparer : `src/server/mysql/server.mjs` protège, lui, ces routes par session ou jeton. |
| Recommandation | Exiger une authentification (et une autorisation par collection) sur toute lecture de collection autre que strictement publique ; ne jamais exposer `users`/`config`. Voir P-01. |
| Effort | Moyen |
| Priorité | Très haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-21b) — collections classées par sensibilité (`DBC_LECTURE`/`DBC_ECRITURE`), `users` et `config` réservés à l'administration ; lecture sans clé refusée. Vérifié à l'API. |
| Origine | Audit 2026-09-21 |

### NC-II-004 — Aucun modèle d'autorisation par rôle côté service : un unique jeton « tout-puissant »

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | II.2 — Comptes, authentification, habilitations ; II.4 — Sécurité de l'API |
| Constat | Le service ne connaît pas les rôles. Toutes les écritures partagent le même contrôle (`authFail`) : présence de jeton, empreinte correcte, rien de plus. `POST /v1/db/collections/users/sync` accepte donc de **réécrire la collection des comptes** — y compris y insérer un compte `administrateur` — dès lors qu'on présente le jeton (cf. NC-II-001). Le champ `force: true`, qui contourne le contrôle de révision, est également accepté sans condition. Les permissions (`PERMS`, `src/lib/users.js`) ne sont appliquées que dans l'interface, qui est publique et donc contournable. |
| Exigence de référence | OWASP ASVS V4 (contrôle d'accès au niveau serveur, moindre privilège) ; RGS ; recommandation « la barrière est côté serveur ». |
| Preuve | `index.html` (`authFail` ; table `ROUTES` : toutes les écritures `auth: "jeton"` sans distinction ; `hDbSync` accepte `b.force`) ; `src/lib/users.js` (`PERMS`, table de permissions purement **client**) ; `src/ui/views/referentiel.js` (l'écran « Comptes et rôles » s'appuie sur `can(...)`). Comparer : `src/server/mysql/server.mjs` refuse, lui, l'écriture de `users`/`config` à un non-admin (`COLLECTIONS_ADMIN`, 403). |
| Recommandation | Porter les rôles **dans le service** (jeton par porteur rattaché à un rôle, ou sessions), et refuser côté serveur toute écriture hors périmètre. Voir P-01. |
| Effort | Élevé |
| Priorité | Haute |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — les rôles sont appliqués côté serveur, chaque route déclarant le rôle requis ; vérifié avec une clé `lecteur` (200 sur `/v1/actes`, 403 `role_insuffisant` sur `users`, `journal`, `cles`, `deposit`, `sync`). La réserve sur `force:true` est levée : le contournement du contrôle de révision est **réservé au rôle `administrateur`** (403 `force_reserve_admin`) et **journalisé** (`sync_force`), des deux côtés (service de démonstration `index.html` et `src/server/mysql/server.mjs`, `sync(…, estAdmin)`) ; les descriptions OpenAPI sont alignées. |
| Origine | Audit 2026-09-21 |

### NC-II-005 — Les actes individuels (non publiables) sont exposés publiquement

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | II.1 — Classification ; II.9 — Protection des données à caractère personnel |
| Constat | Le client dépose au service les actes dits « individuels » en les marquant `publishable: false` (revalorisation d'un traitement, sanction, etc.) — précisément parce qu'ils ne doivent pas être publiés au recueil. Mais `GET /v1/actes` (liste) et `GET /v1/actes/{id}/document` (document Akoma Ntoso complet) sont **publiques** : le numéro, l'objet et **le texte intégral** de ces actes sont donc accessibles à quiconque. La protection ne joue que sur la **publication**, pas sur la lecture du dépôt. |
| Exigence de référence | RGPD (art. 5.1.c minimisation, 32) ; CRPA L. 312-1-2 / L. 221-14 (occultation, actes individuels) ; Loi Informatique et Libertés. |
| Preuve | `src/ui/views/signature.js` (`corpsDepot`, `publishable: actePubliable(acte)`) ; `index.html` (routes `GET /v1/actes` `auth: "public"` ; `GET /v1/actes/{id}/document` **sans** `auth` ; `hPublier` refuse en revanche `publishable: false`) ; `src/server/mysql/actes.mjs` (mêmes routes). Non vérifié : absence, dans le jeu de démonstration, d'un acte individuel déjà déposé permettant la reproduction en direct. |
| Recommandation | Protéger la lecture des actes non publiés (session ou jeton) et ne réserver la lecture ouverte qu'aux publications. Voir P-05. |
| Effort | Moyen |
| Priorité | Haute |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — la lecture des actes non publiés et des documents déposés exige une clé ; seule la publication reste ouverte. Vérifié : `GET /v1/actes` sans clé refusé. |
| Origine | Audit 2026-09-21 |

### NC-II-006 — Usurpation du signataire : l'identité signée est celle de l'acte, non celle de l'opérateur

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | II.2 — Habilitations ; II.5 — Signature, confusion d'identité |
| Constat | Le geste de signature (« signature simple », dans l'application) repose sur `auteurDe(acte, doc)`, qui prend le **signataire désigné par l'acte** (`doc.meta.signataire`) — il ne consulte jamais le compte connecté. La fenêtre de signature affiche cette identité et fait attester « En signant, vous engagez votre signature sur ce document » : un opérateur qui n'est ni le signataire ni un délégataire peut donc apposer la signature **au nom d'un autre**. Le contrôle amont (`engagerSignatureSimple`) ne vérifie que le parapheur et la révision, jamais la compétence de l'opérateur. L'action n'est gardée que par la permission `actes.signer`, accordée notamment au rôle **Rédacteur**. Le certificat produit est engendré dans le navigateur de l'opérateur, au nom déclaré (cf. NC-IV-001). |
| Exigence de référence | OWASP ASVS V2/V4 ; exigence de non-répudiation ; principe de séparation des pouvoirs. |
| Preuve | `src/ui/views/signature.js:1412` (`auteurDe` — lit `doc.meta.signataire`) ; `src/ui/views/signature.js:1248` (`signerSimple` — `signataire: auteur`) ; `src/ui/views/signature.js:1133` (`engagerSignatureSimple` — aucune vérification de compétence) ; `src/ui/app.js:90` (`signature: "actes.signer"`) ; `src/lib/users.js` (`actes.signer` inclut `redacteur`). Vérifié en direct : l'écran « Signature & publication » est ouvert au compte rédacteur (page_eval). Non vérifié : exécution complète du scénario d'usurpation (l'acte de test du périmètre était soumis à révision, ce qui a interrompu le parcours). |
| Recommandation | Comparer l'identité de l'opérateur à la chaîne de signature de l'acte (le module `competenceDuCompte` existe déjà) et **refuser** la signature hors compétence ; journaliser l'opérateur distinctement du signataire. Voir P-06. |
| Effort | Moyen |
| Priorité | Très haute |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — porte de compétence posée sur les trois chemins de signature (`src/ui/views/signature.js:1150`, `:1264`, `:2187`), opérateur tracé dans le dossier interne. Parcours complet non rejoué (aucun acte en attente de signature au jeu de démonstration) : le refus est établi par les messages et la lecture de code. **Renforcée (1.6.1w)** — la porte ne se contentait pas d'« être dans la chaîne » : elle exige désormais d'être le **titulaire** (dernier étage) **et** de porter la qualité de signataire (`peutSignerEffectivement`, `src/lib/signataires.js`), et l'outil du prestataire comme la fenêtre de signature simple ne s'ouvrent que pour lui. Le parcours complet est cette fois **rejoué dans l'aperçu** : un administrateur lié à l'autorité de tête, et un délégant, se voient **refuser** la signature de l'acte d'un autre (journal `essai` de séance) ; un acte validé par son réviseur part bien en signature, et le titulaire la donne. |
| Origine | Audit 2026-09-21 (confirme et qualifie le point d'entrée « usurpation du signataire » du prompt §4.2) |

### NC-II-007 — Injection HTML stockée dans le recueil public (XSS)

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | II.3 — Sécurité applicative |
| Constat | La page d'un acte publié insère la version en ligne reçue du service par `innerHTML`, sans assainissement : `doc.innerHTML = v.html`. Le contenu publié n'est pas vérifié côté service. Un tiers qui peut publier (cf. NC-II-001 / NC-II-002) peut donc faire exécuter du script à **tout visiteur** du recueil public — la page d'accueil de la collectivité. Le rendu des documents **compilés** dans l'atelier, lui, est sain (construction par nœuds texte, `src/lib/render.js`). |
| Exigence de référence | OWASP Top 10 (A03:2021 Injection) ; OWASP ASVS V5 (validation, encodage) ; RGPD (sécurité). |
| Preuve | `src/ui/views/acte-publie.js:186` (`doc.innerHTML = v.html …`) ; à l'inverse, `src/lib/render.js` (usage de `textContent` / `createTextNode`) ; test : publication acceptée avec un `html` arbitraire (cf. NC-II-002, reproductible). |
| Recommandation | Assainir la version en ligne avant insertion (liste blanche de balises/attributs), ou la reconstruire depuis l'Akoma Ntoso à l'affichage, et servir une politique de sécurité du contenu (CSP). Voir P-07. |
| Effort | Moyen |
| Priorité | Haute |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — version en ligne assainie avant insertion (`src/lib/sanitize.js` `assainirHtml`, appliqué dans `src/ui/views/acte-publie.js:192` et `:198`). Vérifié à l'écran : aucun `script`, attribut `on…` ni `iframe` dans le contenu rendu d'un acte publié. |
| Origine | Audit 2026-09-21 |

### NC-II-008 — Clé d'accès d'un moteur de langage conservée en clair dans le référentiel

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | II.8 — Secrets et configuration |
| Constat | Le réglage « Assistants » permet de saisir la clé de l'API de langage de la collectivité. Elle est écrite telle quelle dans le référentiel (`config.assistants[…].cle`), donc dans la collection `config` : exportée avec les données, et — en mode service — lisible sans jeton (cf. NC-II-003). Le champ est de type `password` dans le formulaire, mais la valeur est stockée en clair. |
| Exigence de référence | OWASP ASVS V6 (gestion des secrets) ; ANSSI ; ISO/IEC 27002. |
| Preuve | `src/ui/views/referentiel.js:1812` (champ « Clé d'accès », `type: "password"`, `value: s.cle`) ; `src/lib/assistant.js` (`cle`, `entetesDe`) ; `src/lib/db/contract.js` (collections partagées). L'aide du champ signale elle-même que la clé « apparaît dans un export de données » (transparence — à porter au crédit). |
| Recommandation | Sortir les secrets du référentiel : stockage local à l'installation, variable d'environnement du déploiement, ou coffre ; ne jamais les inclure dans un export ni dans une collection lisible. Voir P-08. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 90 jours |
| Statut | **Levée** (2026-09-21b) — la clé du moteur est conservée dans le stockage local du navigateur (`src/lib/assistant.js` `cleMoteur`/`reglerCleMoteur`, migration des référentiels existants) et exclue des exports et des collections (`sansSecrets`, `src/lib/store.js`). |
| Origine | Audit 2026-09-21 |

### NC-II-009 — Défaut de durcissement HTTP et CORS permissif par défaut

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | II.3 — Sécurité applicative ; II.4 — Sécurité de l'API |
| Constat | Le service de démonstration ne pose aucun en-tête de sécurité (`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`…). L'échantillon de configuration du déploiement auto-hébergé place `CORS_ORIGINS=*` par défaut, et `AUTH_MODE=demo` par défaut (comptes sans mot de passe). |
| Exigence de référence | OWASP ASVS V14 (configuration) ; RGS ; guides ANSSI. |
| Preuve | `src/server/docker-compose.yml` (`CORS_ORIGINS: ${CORS_ORIGINS:-*}`, `AUTH_MODE: ${AUTH_MODE:-demo}`) ; absence de directive d'en-têtes de sécurité dans `src/server/nginx.conf` (à confirmer) ; `index.html` (réponses JSON sans en-tête de durcissement). |
| Recommandation | Fournir des valeurs par défaut sûres (CORS restreint à l'origine de l'application, `AUTH_MODE=password` recommandé à l'installation), et une CSP stricte. Voir P-09. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — valeurs par défaut sûres (`AUTH_MODE=password`, `CORS_ORIGINS=` vide), en-têtes de sécurité dans le service et dans `src/server/nginx.conf` (`frame-ancestors 'self'`), images épinglées par empreinte. |
| Origine | Audit 2026-09-21 |

### NC-II-010 — Comparaison de jeton non à temps constant ; limitation de débit et journal partiels

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | II.7 — Journalisation ; II.4 — Sécurité de l'API |
| Constat | La vérification du jeton compare deux chaînes par `!==` (`sha256Hex(...) !== CLE_JETON`), non à temps constant (risque théorique très faible ici, le secret étant de toute façon public). La limitation de débit (90 écritures/minute, par `conn.net[3]`) ne couvre pas les lectures. Le « journal » (collection `journal`) est une donnée applicative écrite par le même canal que le reste : il **n'est ni inaltérable ni signé**, et son export/rétention est explicitement hors périmètre (`src/SPEC.md` § 5). |
| Exigence de référence | OWASP ASVS (V2, V7) ; recommandations CNIL/ANSSI sur la traçabilité. |
| Preuve | `index.html` (`authFail`, `allowWrite`, `hSante`) ; `src/SPEC.md` § 5 (« export et rétention du journal d'audit » hors périmètre) ; `src/docs/ADMINISTRATION.md` § 7.3.1. |
| Recommandation | Journal d'audit append-only côté serveur, horodaté, exportable et conservé ; comparaison à temps constant. Voir P-10. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 90–180 jours |
| Statut | **En cours** (2026-09-23) — comparaison à temps constant toujours en place (`egalConstant`, `index.html:323`) et journal scellé (`index.html`, `journaliser`) ; **export et rétention du journal restent non définis** (`src/SPEC.md` § 5). Inchangé. |
| Origine | Audit 2026-09-21 |

### NC-II-011 — Transfert des questions d'assistance vers un moteur tiers

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | II.9 — Protection des données à caractère personnel |
| Constat | Les deux assistants (« Plume », « Publia ») transmettent leur invite et l'historique de conversation à un moteur de langage : par défaut le moteur intégré de la plateforme quand il est disponible, sinon l'API configurée. L'atelier n'y joint jamais le contenu des actes (le module l'affirme et c'est cohérent — le contexte vient du guide), mais **la question posée par l'agent** y passe, et l'interface l'avertit (« N'y mettez pas d'informations confidentielles »). Le recueil public, lui, transmet des extraits d'actes **publiés** (donc publics). Aucune mention de sous-traitance/transfert n'est fournie dans la documentation publique (cf. NC-IV-002). |
| Exigence de référence | RGPD art. 13 et 28 (information, sous-traitance, transferts) ; CNIL (AIPD si nécessaire). |
| Preuve | `src/lib/assistant.js` (`repondre`, `viaMoteurIntegre`, `viaMoteurPersonnalise`, `contexteAtelier`, `contextePublic`) ; `src/lib/assistant.js` (notes affichées à l'utilisateur) ; `main.pjs` (`generateText = {import:ai-text-plugin}`). |
| Recommandation | Documenter le transfert (destinataire, finalité, base légale, localisation), et proposer l'extinction par défaut. Voir P-08. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 90 jours |
| Statut | **Levée** (2026-09-21b) — le transfert au moteur est documenté (art. 13 et 28 : `src/docs/ADMINISTRATION.md` § 5.5ter, tableau des sous-traitances et des durées). |
| Origine | Audit 2026-09-21 |

### NC-II-012 — Le service d'aperçu perd son état sous charge modeste (démonstration non conservatoire)

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | II.6 — Segmentation des environnements ; I.6 — Exploitation |
| Constat | Dans l'**aperçu d'édition**, le service embarqué **redémarre et perd l'intégralité de son état** dès que l'activité dépasse un seuil modeste. Reproduit trois fois : après **deux** publications (≈ 209 Ko d'état pour une capacité annoncée de 26 Mio), toute opération suivante échoue par `WebSocket closed (code 1011)`, puis `GET /v1/health` rend `objets:{actes:0,signatures:0,publications:0}` et `GET /v1/auth/etat` rend `provisionne:false` — **la clé de provisionnement est perdue avec le reste**. Interruptions observées : à la 2ᵉ opération avec 1,2 s d'espacement, à la 3ᵉ avec 4 s, puis encore à la 3ᵉ avec 50 s d'espacement entre deux évaluations distinctes. En revanche, **une publication isolée réussit systématiquement** (476 ms pour dépôt + signature + webhook + publication). |
| Exigence de référence | ISO/IEC 25010 (fiabilité, disponibilité) ; ISO/IEC 27002 (continuité) ; RGS (disponibilité) ; cadre §2.3 (distinction démonstration / production). |
| Preuve | `index.html` (routes, `saveDb`, `MAX_CHARS`) ; journaux des appels : `POST /v1/actes` → 201, `POST /v1/actes/ACT-0001/signature` → 202, `POST /v1/webhooks/signature` → 200, `POST /v1/actes/ACT-0001/publication` → 201, puis `POST /v1/actes` → `WebSocket closed (code 1011)` ; `GET /v1/health` avant : `utilise:106759` / `:208748` ; après : `utilise:4`, `objets:0`. Recette d'amorçage : `src/ui/demo-publications.js` (`PAUSE_AMORCAGE`, `REPRISES_MAX`). |
| Recommandation | (a) **Documenter** que l'aperçu d'édition n'est pas un environnement de démonstration tenable : l'écrire comme tel, et renvoyer à l'instance enregistrée ; (b) **vérifier et documenter** la persistance des clés au redémarrage du service auto-hébergé (état en base, `sb_etat`) ; (c) si la perte d'état se reproduisait **sur un service en service**, la traiter comme un incident de disponibilité (le service redevient silencieusement en lecture seule). Voir P-27 et P-29. |
| Effort | Faible (documentation) à moyen (diagnostic du moteur de démonstration) |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Ouverte** (2026-09-23) — non revérifiée sous charge dans cette campagne ; la démonstration publiée (GitHub Pages) conserve, elle, son état **dans le navigateur de chaque visiteur** (IndexedDB, `src/pages/host.js`), donc sans partage : le risque est déplacé, non levé. |
| Origine | Audit 2026-09-21b |

### NC-II-013 — Le registre d'audit et ses non-conformités ouvertes sont publiés dans le dépôt

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | II.1 — Cartographie et classification des données ; II.7 — Journalisation, traçabilité |
| Constat | Le cadre d'audit, le registre et les rapports sont **dans le dépôt public** (`src/audit/**`), donc lisibles et clonables par tous, y compris par un lecteur qui découvre le projet — et le dépôt va être communiqué sur des forums. Le registre y expose en clair des non-conformités **encore ouvertes** : la valeur probante de la signature (NC-IV-001), la télétransmission simulée (NC-IV-004), le service de démonstration non conservatoire (NC-II-012). Hors du cadre qui les encadre (`PROMPT-AUDIT-SCRIBAE.md`, statuts, propositions), ces fiches se citent à contresens. |
| Exigence de référence | ISO/IEC 27001/27002 (classification de l'information) ; loyauté de la présentation d'un livrable public. |
| Preuve | `GET /repos/aplds/scribae/contents/` : `src/` est publié tel quel ; `src/audit/REGISTRE-NON-CONFORMITES.md` et `src/audit/rapports/AUDIT-SCRIBAE-2026-09-2*md` s'y trouvent (2 rapports, 1 registre, 1 cadre). |
| Recommandation | Chapeauter le registre et chaque rapport d'une note « document de travail, non-conformités en cours de traitement, voir le cadre d'audit », renvoyer depuis le README du dépôt à la **synthèse** plutôt qu'aux fiches, et dater l'état de la chaîne (P-34). |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-23) — le chapeau « **document de travail** » ouvre le présent registre, `src/audit/README.md` et chacun des trois rapports ; `docs/GITHUB.md` (le README du dépôt) porte une section **Audit** qui renvoie à `src/audit/README.md`, à la **synthèse** et au **plan d'action** du rapport le plus récent, en avertissant qu'une fiche lue hors de son cadre se cite à contresens. Dater l'état de la chaîne dans la fiche de tête du dépôt reste à faire : c'est la proposition P-38, échéance 30–90 jours. |
| Origine | Audit 2026-09-23 (3e campagne) |

### NC-II-014 — Le magasin local range plusieurs collections dans un même dossier

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | II.1 — Cartographie et classification des données ; II.5 — Intégrité des données |
| Constat | Le pilote de persistance **local** (IndexedDB) range chaque collection dans son propre dossier, par une table écrite à la main. Cette table ne déclarait ni `informations` (collection ajoutée en 1.5.3) ni `reprises` : le proxy de stockage range une collection sous le **nom de sa propriété**, donc `FOLDERS[name]` valant `undefined`, **toutes les collections non déclarées écrivaient dans le même dossier partagé** (clé `undefined`). Les billets du recueil public vivaient donc dans ce dossier commun, et la nouvelle collection `reprises` y aurait écrit **par-dessus** — la perte n'a pas été observée dans la version livrée (`informations` était la seule collection non déclarée en usage), mais elle était ouverte à la première collection ajoutée sans toucher la table. |
| Exigence de référence | ISO/IEC 25010 (fiabilité, intégrité) ; ISO/IEC 27002 (protection des données) ; RGPD (exactitude). |
| Preuve | `src/lib/db/local.js` (table `FOLDERS`, `dossierDe`) ; relevé dans l'aperçu de l'atelier : `kv["undefined"]` contenait les quatre billets de démonstration (`info-demo-*`) et `kv["actesReprises"]` était vide — après correction, `informations` est migré une fois vers `actesInformations` et `reprises` vit dans `actesReprises`, sans perte. |
| Recommandation | Déclarer **chaque** collection de `contract.js` dans la table des dossiers ; faire échouer `dossierDe` **sans aliasing** pour une collection inconnue (repli en mémoire, et non écriture dans un dossier partagé) ; reprendre une fois les données héritées du dossier commun, en les marquant pour ne pas les confondre. Tenu par une épreuve (`src/tests/reprise.test.mjs`). |
| Effort | Faible |
| Priorité | Haute |
| Échéance | Faite |
| Statut | **Levée** (2026-09-25, livraison 1.6.1s) — les dossiers `informations` et `reprises` sont déclarés, `dossierDe` ne renvoie plus d'alias pour une collection inconnue, et les données héritées du dossier commun sont reprises une fois (`HERITAGE`, `reprendreHeritage`). |
| Origine | Constat de développement
### NC-II-015 — La balise `noindex` est présente dans `index.html` mais non déployée sur demo.scribae.eu

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | II.1 — Cartographie ; II.6 — Segmentation |
| Constat | `index.html:45-49` pose une balise `<meta name="robots" content="noindex, nofollow">` si `location.hostname === "demo.scribae.eu"`. Or cette condition n'est **pas vérifiée** : la balise n'apparaît pas dans le DOM de `https://demo.scribae.eu`. |
| Exigence de référence | ISO/IEC 27002 (classification de l'information), loyauté de la présentation. |
| Preuve | `index.html:45-49` (condition `if (location.hostname === "demo.scribae.eu")`), inspection du DOM de `https://demo.scribae.eu` — aucune balise `meta[name="robots"]`. |
| Points conformes | La balise est présente dans le code source. NC-III-008 presque levée. |
| Recommandation | Vérifier que la condition `location.hostname === "demo.scribae.eu"` est bien évaluée à `true` lors du chargement de `demo.scribae.eu`. Si la page est servie par GitHub Pages, `location.hostname` devrait bien valoir `demo.scribae.eu`. Vérifier avec `console.log(location.hostname)` dans l'aperçu. Priorité haute, échéance 0—30 jours. |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 0—30 jours |
| Statut | **Nouvelle** (2026-09-30, 5e campagne) |
| Origine | Audit 2026-09-30 |

 (ajout de la collection `reprises`), hors campagne |

## Chapitre III — Qualité, accessibilité et expérience (qualiticien)

### NC-III-001 — La documentation contredit l'outil sur des points fonctionnels

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | III.8 — Documentation utilisateur ; III.5 — Compréhension |
| Constat | Trois contradictions relevées, chacune vérifiable : **(a)** le guide intégré affirme qu'« elle ne signe pas à votre place, et elle n'envoie pas les messages », alors que le circuit de **signature simple** fait signer dans l'application et que le service de **courriel** envoie (sur un déploiement doté d'un SMTP) six notifications ; **(b)** `src/SPEC.md` § 5 range encore l'« Assistant de rédaction (ai-text-plugin) » dans le **hors périmètre**, alors que les assistants sont livrés, documentés et **actifs par défaut** ; **(c)** `src/docs/GITHUB.md` affirme que « l'application n'envoie rien à un service tiers », alors que les assistants interrogent un moteur de langage (intégré, donc tiers, sur la plateforme). |
| Exigence de référence | RGAA/qualité documentaire ; ISO/IEC 25010 (exactitude fonctionnelle) ; exigence d'« exhaustivité et justesse vs. l'écran réel » (III.8). |
| Preuve | `src/wiki.js` (chapitre « demarrer » : texte « ne signe pas à votre place… ») face à `src/ui/views/signature.js` (`engagerSignatureSimple`, `signerSimple`) et `src/lib/courriel.js` ; `src/SPEC.md` § 5 (item « Assistant de rédaction (ai-text-plugin) ») face à `main.pjs` (`generateText`) et `src/lib/store.js` (activation par défaut) ; `src/docs/GITHUB.md` section « Vos données ». |
| Recommandation | Rebaser la documentation sur l'état réel : corriger le chapitre « demarrer », déplacer l'assistant hors de la liste « hors périmètre », nuancer la phrase sur les services tiers. Voir P-11. |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-21b) — guide intégré (`src/wiki.js`), `src/SPEC.md` § 5 et `src/docs/GITHUB.md` réalignés sur l'état réel (signature simple, courriel, assistants hors du « hors périmètre », services tiers). |
| Origine | Audit 2026-09-21 |

### NC-III-002 — Absence de lien d'évitement sur le recueil public

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | III.2 — Accessibilité (RGAA 4.1) |
| Constat | Le recueil public n'offre aucun lien d'évitement ni d'accès rapide au contenu principal, alors qu'il comporte un en-tête, un bloc de recherche, un carrousel, une grille de thèmes et une longue liste d'actes avant le contenu. Un utilisateur au clavier ou au lecteur d'écran doit parcourir toute la navigation. |
| Exigence de référence | RGAA 4.1, critère **12.7** (lien d'évitement) ; WCAG 2.1 (2.4.1 Bypass Blocks). |
| Preuve | Inspection du DOM du recueil public (`page_eval`) : aucun `a[href^="#"]` de type « aller au contenu » ; décompte des liens d'évitement = 0. Aucun repère `nav` non plus. |
| Recommandation | Ajouter un lien « Aller au contenu » visible à la prise de focus, pointant vers `<main>`. Voir P-13. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — lien d'évitement « Aller au contenu » et cible `<main id="recueil-contenu" tabindex="-1">` présents au recueil. Vérifié : nœud, `href`, cible et règle CSS ; révélation visuelle non observable (le document de l'aperçu n'obtient jamais le focus clavier). |
| Origine | Audit 2026-09-21 |

### NC-III-003 — Cibles tactiles insuffisantes sur les contrôles du carrousel

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | III.2 — Accessibilité ; III.6 — Adaptation (mobile) |
| Constat | Les points de pagination du carrousel « À la une » sont des boutons de **8 × 8 px** (10 × 10 px pour le premier) ; la croix d'effacement de la recherche mesure 15 × 18 px ; le bouton de fermeture de la bulle d'assistance 16 × 16 px. Ces cibles sont bien en deçà des 24 × 24 px attendus (WCAG 2.2 AA, 2.5.8) et des 44 × 44 px recommandés sur mobile. Les libellés `aria-label` sont, eux, présents (bon point). |
| Exigence de référence | WCAG 2.2 AA (2.5.8 Target Size Minimum) ; EN 301 549 ; ergonomie mobile. |
| Preuve | `page_eval` à 390 px de large : mesures `getBoundingClientRect()` des boutons `.recueil-carrousel__point` (8 × 8), `.recueil-recherche__x` (15 × 18), `.assist__bulle-fermer` (16 × 16). |
| Recommandation | Porter la zone cliquable à 24 × 24 px minimum (padding transparent ou pseudo-élément). Voir P-13. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — cibles tactiles portées à 24 × 24 px au minimum et **mesurées** à 390 px (points de carrousel, croix de recherche). |
| Origine | Audit 2026-09-21 |

### NC-III-004 — Incohérence d'alignement dans le recueil public

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | III.4 — Cohérence des interfaces |
| Constat | Le corps de la page est aligné à gauche, mais la note de pied de page (`.recueil-pied__note`) est centrée, ce qui produit une rupture visuelle et une lisibilité moindre pour un paragraphe de plusieurs lignes. |
| Exigence de référence | Bonne pratique de design system ; ISO/IEC 25010 (cohérence). |
| Preuve | `page_eval` : `getComputedStyle(document.querySelector(".recueil-pied__note")).textAlign === "center"` alors que `body` et les autres blocs de texte valent `left`. |
| Recommandation | Aligner la note sur le reste du contenu (gauche). Voir P-13. |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-21b) — note de pied de page alignée à gauche, mesurée (`getComputedStyle(...).textAlign === "left"`). |
| Origine | Audit 2026-09-21 |

### NC-III-005 — Le titre du document n'est pas posé par l'atelier ; repères de navigation incomplets

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | III.2 — Accessibilité ; III.5 — Compréhension |
| Constat | Dans l'atelier, le `document.title` interne reste celui de la coquille (« Perchance ») — le recueil, lui, pose bien son titre. Aucun repère ARIA de navigation (`nav`, `role="navigation"`) n'est présent sur le recueil public ; les régions sont en revanche correctement balisées (`header`, `main`, `footer`). |
| Exigence de référence | RGAA 4.1 (8.5/8.6 titre de page ; 12.x repères) ; ARIA Authoring Practices. |
| Preuve | `page_eval` : `document.title` = « Perchance » sur écran d'atelier ; `document.title` = « Recueil des actes administratifs — … » sur le recueil ; comptage des `nav` = 0. |
| Recommandation | Poser le titre du document par écran dans l'atelier ; ajouter un repère de navigation explicite. Voir P-13. |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-23, après traitement de P-36) — la régression est réparée : le `nav` de l'atelier porte son repère (« Navigation principale de l'atelier »), mesuré dans l'aperçu, et le titre de document reste posé par écran. Historique : levée le 2026-09-21b, régression constatée le 2026-09-23 (suivie sous NC-III-007), réparée le 2026-09-23. |
| Origine | Audit 2026-09-21 |

### NC-III-006 — Le libellé de la punaise n'indique pas l'état de l'acte

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | III.4 — Cohérence des interfaces |
| Constat | Le geste d'épinglage porte **deux libellés** selon l'emplacement, et l'infobulle ignore l'état de l'acte : dans la liste des actes, **41 boutons** portent le titre « Épingler — l'acte sera à la « une » dès sa publication », y compris sur un acte **déjà publié** (où l'effet est immédiat) ; la rangée d'actions de la même ligne porte le titre « Mettre à la « une » du recueil public ». Après épinglage, le bouton ne change pas de libellé (« Épingler » reste « Épingler », sans passage au « Désépingler » attendu). |
| Exigence de référence | ISO/IEC 25010 (cohérence, utilisabilité) ; RGAA/WCAG (intitulés explicites) ; exigence III.4 du cadre. |
| Preuve | Relevé `page_eval` de la liste des actes (`button[title]` : 41 occurrences du même libellé, dont la ligne `2026-403-VSL`, statut « Publié ») ; même ligne, bouton d'action « Mettre à la « une » du recueil public » ; après clic, toast « Acte mis à la une du recueil public » et `epingle:true` au service, sans changement de libellé. |
| Recommandation | Un libellé unique, adapté à l'état : « Épingler à la une » / « Retirer de la une », avec la distinction utile (« dès sa publication » réservée aux actes non publiés). Voir P-28. |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-21b) — le libellé de la punaise est désormais **unique et adapté à l'état** (`libelleEpinglage`, `src/ui/views/actes.js`) : « Épingler à la une du recueil public » / « Retirer de la une du recueil public », la distinction « l'acte y sera mis dès sa publication » n'étant portée que pour un acte **non encore publié** ; les deux emplacements de la liste des actes s'accordent. |
| Origine | Audit 2026-09-21b |

### NC-III-007 — La navigation de l'atelier a perdu son repère (régression de NC-III-005)

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | III.2 — Accessibilité (RGAA 4.1) |
| Constat | Le repère de navigation de l'atelier est perdu : le seul `nav` visible de l'atelier (`nav.app-nav`) n'a **ni** `aria-label` **ni** `aria-labelledby` (relevé dans l'aperçu). L'autre moitié de NC-III-005 tient toujours : le titre de document est posé par écran (« Trames — Ville de Valmont-sur-Loire »). Le recueil public, lui, est correctement repéré. |
| Exigence de référence | RGAA 4.1 (12.6 : les zones de regroupement de liens doivent être identifiables ; 9.2) ; WCAG 2.1 SC 1.3.1. |
| Preuve | `page_eval` : atelier → `[{classes: "app-nav", label: null, labelledby: null}]` ; recueil public → `[{label: "Navigation principale du recueil"}, {label: "Pages du site"}]` (conformes). Constat levé le 2026-09-21b (« repère `nav aria-label` ajouté ; mesurés sur 4 écrans »). |
| Recommandation | Reposer l'`aria-label` sur le `nav` de l'atelier (par exemple « Navigation de l'atelier ») et l'épingler par une épreuve, comme les deux repères du recueil (P-36). |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-23) — le `nav.app-nav` de l'atelier porte `aria-label="Navigation principale de l'atelier"` (`src/ui/app.js`, à côté des deux repères déjà conformes du recueil). Preuve : relevé dans l'aperçu, `nav` de l'atelier → `{ label: "Navigation principale de l'atelier" }` (l'`aria-label` est posé), et aucune autre zone de liens sans repère dans l'atelier. |
| Origine | Audit 2026-09-23 (régression d'une non-conformité levée le 2026-09-21b) |

### NC-III-008 — La démonstration publiée est indexable par les moteurs

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | III.6 — Robustesse et adaptation ; IV.7 — Transparence (renvoi) |
| Constat | `https://demo.scribae.eu/robots.txt` répond **404** (page 404 de GitHub Pages) et le `index.html` servi ne porte **aucune** balise `robots` : la démonstration — un jeu de données entièrement fictif, confié à une commune imaginaire, et qui se réinitialise — est donc indexable. Une fiche d'arrêté fictive peut apparaître dans un résultat de recherche et se lire comme un acte réel. Dans l'aperçu Perchance, la plateforme pose `noindex, nofollow` : le risque n'existe que sur le déploiement statique. |
| Exigence de référence | Bonnes pratiques de publication (maîtrise de l'indexation d'une démonstration) ; ISO/IEC 25010 (utilisabilité). |
| Preuve | `HEAD https://demo.scribae.eu/robots.txt` → 404 (`contentType: text/html`, page 404 GitHub Pages) ; `GET https://demo.scribae.eu/index.html` (178 325 octets) → aucune occurrence de `robots`/`noindex` hors descriptions d'API ; aperçu : `meta[name="robots"]` = « noindex, nofollow », posée par la plateforme et non par le logiciel. |
| Recommandation | Livrer, **dans la démonstration statique seulement**, un `robots.txt` ou une balise `noindex` — le logiciel auto-hébergé, lui, doit rester indexable (c'est même une promesse du recueil ouvert) — et le documenter dans `docs/GITHUB.md` (P-33). |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 0–30 jours |
| Statut | **En cours** (2026-09-23, après traitement de P-33) — le logiciel pose désormais `noindex, nofollow` **sur la seule adresse de la démonstration du projet** (`index.html`, test `location.hostname === "demo.scribae.eu"`, l'adresse du fichier `CNAME`) : toute autre installation, auto-hébergée ou fork, garde un recueil indexable. Un `robots.txt` à la racine du dépôt a été **écarté à dessein** : le fichier serait hérité par chaque fork, alors que le `robots.txt` appartient au **déploiement** (l'instance auto-hébergée publie le sien, avec sa carte et ses actes — voir `docs/GITHUB.md`). Non encore constaté : la démonstration publiée ne portera la balise qu'après son **prochain déploiement** ; la mesure (`meta[name=robots]` sur `https://demo.scribae.eu`) reste à refaire. |
| Origine | Audit 2026-09-23 (3e campagne) |

## Chapitre IV — Conformité et valeur juridiques (DAJ / assemblées)

### NC-IV-001 — L'identité du signataire n'est pas garantie (certificat auto-engendré, clé privée en clair)

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | IV.3 — Sécurité juridique et valeur probante |
| Constat | Dans les circuits « simple » et « externe », la signature est produite par un certificat **créé dans le navigateur**, au nom du signataire **déclaré par l'acte** (et non vérifié), et la clé privée correspondante est conservée en clair (JWK exportable) dans le stockage du navigateur. La vérification (`verifySignedPackage`) est donc auto-référente : elle prouve qu'un paquet n'a pas été altéré depuis sa confection, **pas** qui l'a signé. Le certificat n'est pas qualifié au sens d'eIDAS, ce que la documentation indique honnêtement (« certificat de démonstration ») ; il n'en reste pas moins que l'interface affiche « Signé », « signature horodatée et vérifiable », ce qui peut laisser croire à un acte juridiquement scellé. |
| Exigence de référence | Règlement eIDAS (UE) 910/2014 et ses niveaux ; décret relatif à la signature électronique ; NF Z42-013 ; RGI. |
| Preuve | `src/lib/signature.js` (`buildSignedPackage`, `certificate` — `subject: (brand, who) => …`, `writeCert` conservant `privateKey` en clair ; `verifySignedPackage`) ; `src/ui/views/signature.js:1412` et `:1248` (l'identité vient de l'acte) ; `src/wiki.js` (la note reconnaît le certificat de démonstration). |
| Recommandation | En production, brancher une signature **qualifiée** (prestataire, cachet serveur ou porte-clés matériel), et n'attribuer le mot « signé » qu'à une signature dont l'identité est vérifiée côté serveur. Adoucir, dès la démonstration, le vocabulaire (« signature de démonstration », non opposable). Voir P-06 et P-10. |
| Effort | Élevé |
| Priorité | Haute |
| Échéance | 90–180 jours |
| Statut | **En cours** (2026-09-23 ; complété en 1.6.1g) — la recommandation « **adoucir le vocabulaire** » est **livrée** : `src/lib/qualification-signature.js` qualifie chaque signature, et l'acte publié porte sous son texte un encadré **« Signature simple — non qualifiée »** (`src/ui/views/acte-publie.js`, `src/lib/eli.js`) ; le recueil public reprend la mention et le JSON-LD la transporte (`eli:signature_level`), le prestataire **simulé** étant nommé de la même façon (`src/wiki.js`). Le fond demeure : le certificat reste **auto-engendré dans le navigateur** et la clé privée conservée en clair dans l'enregistrement local (`src/lib/signature.js`, export JWK) ; l'opérateur est tracé et sa compétence vérifiée, la **non-répudiation n'est pas établie** — seule une signature **qualifiée**, adossée à un prestataire de confiance, la donnerait. |
| Origine | Audit 2026-09-21 |

### NC-IV-002 — Absence de licence de réutilisation au recueil, et licence logicielle indéfinie

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | IV.7 — Transparence, données ouvertes et protection |
| Constat | Le recueil public expose des actes en formats ouverts (HTML, JSON-LD/ELI, Markdown, Akoma Ntoso) mais **n'indique nulle part les conditions de réutilisation** : aucun texte de licence (Licence Ouverte / Etalab ou autre), aucun lien dans le pied de page. Le code du logiciel, de son côté, ne porte aucun fichier `LICENSE` (la documentation publique indique « tous droits réservés »). Or la publicité des conditions de réutilisation est une obligation légale pour les documents administratifs publiés en ligne. |
| Exigence de référence | CRPA art. L. 322-6 (publicité des conditions de réutilisation) et L. 321-1 ; directive (UE) 2019/1024 dite « open data ». |
| Preuve | Recherche dans `src/ui/views/recueil-public.js`, `src/ui/views/acte-publie.js`, `src/css/app.css` : aucune occurrence de « licence »/« réutilisation » dans le recueil ; `src/docs/GITHUB.md` section « Licence » ; absence de fichier `LICENSE`. |
| Recommandation | Afficher une licence de réutilisation sur le recueil (et dans les métadonnées JSON-LD), et choisir une licence pour le logiciel. Voir P-12. |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — licence de réutilisation affichée au recueil et inscrite dans le JSON-LD (`dcterms:license`, `eli:uri`) ; licence logicielle tranchée (`src/LICENSE.md`, GPL-3.0). |
| Origine | Audit 2026-09-21 |

### NC-IV-003 — Identifiant ELI non résoluble ; divergence entre l'ELI et l'URI du document

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | IV.2 — Interopérabilité et normes |
| Constat | L'identifiant ELI produit est de la forme `eli:/fr/arr/2026/0464/vsl` : une chaîne de type URN, **non déréférençable** (aucun schéma `http(s)`, aucune autorité). Les recommandations ELI attendent un identifiant **adressable**. De plus, l'ELI stocké sur la publication (`eliUri`) et l'URI portée par le document Akoma Ntoso (`FRBRthis` / `FRBRuri`, `https://www.valmont-sur-loire.fr/eli/arrete/2026/464/VSL`) **ne coïncident pas** : deux identités pour un même acte. |
| Exigence de référence | ELI (European Legislation Identifier), ligne directrice ELI/FR ; OASIS LegalDocML (Akoma Ntoso). |
| Preuve | `src/lib/eli.js` (`eliUri` construit `"eli:/fr/" + …`) ; expérimentation `page_eval` : publications lues au service — `eliUri: "eli:/fr/arr/2026/0464/vsl"` et, dans le même acte, `FRBRthis value="https://www.valmont-sur-loire.fr/eli/arrete/2026/464/VSL"` ; `src/server/mysql/actes.mjs` (`eliKey`, même format). |
| Recommandation | Uniformiser l'identifiant : une URI ELI HTTP(S) canonique, identique dans la publication, le JSON-LD et l'Akoma Ntoso, et effectivement résolue par le recueil. Voir P-14. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 90 jours |
| Statut | **En cours** (2026-09-23) — deux formes coexistent toujours : l'identifiant `eli:/fr/…` (`src/lib/eli.js:76`) et l'adresse HTTP (`eliAdresse`, `src/lib/eli.js:88`), distinguées à l'écran mais non unifiées. |
| Origine | Audit 2026-09-21 |

### NC-IV-004 — La télétransmission au contrôle de légalité est simulée et fabrique son propre certificat

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | IV.1 — Cycle réglementaire (transmission) ; IV.3 — Valeur probante |
| Constat | L'étape de transmission au contrôle de légalité « appelle » une API dont l'adresse est fictive et dont l'accusé de réception est **fabriqué localement** (référence, horodatage et « sceau » SHA-256 engendrés par le service lui-même). L'acte publié porte alors la mention « Transmis au contrôle de légalité le … », présentée comme un certificat informatique de transmission. La fonction est éteinte par défaut et documentée comme expérimentale, mais la mention produite est visuellement celle d'une transmission réelle. |
| Exigence de référence | Vadémécum du contrôle de légalité ; procédures de télétransmission (actes soumis au contrôle) ; exigence de preuve. |
| Preuve | `index.html` (`CONTROLE_LEGALITE`, `certificatTransmission`, `hTransmettre` — `api: { url: …, statut: 202 }` sans appel sortant) ; `src/lib/legalite.js` (production de la même mention côté client) ; `src/lib/eli.js` (`transmissionBlock`). |
| Recommandation | Exiger la preuve de l'appel réel (réponse de l'API, ou dépôt d'un accusé obtenu hors application) et marquer distinctement les mentions de démonstration. Voir P-10. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 90–180 jours |
| Statut | **En cours** (2026-09-23 ; complété en 1.6.1g) — la télétransmission reste simulée : aucun appel sortant, certificat porteur de `demonstration: true` (`src/lib/legalite.js`). En revanche la mention produite est désormais **distinctement marquée** : `mentionDeTransmissionSimulee` rend « (mention de démonstration — transmission simulée, sans appel sortant) », et la version publiée reprend cette précision (`src/lib/recueil.js`). L'exigence d'une **preuve de l'appel réel** demeure. |
| Origine | Audit 2026-09-21 |

### NC-IV-005 — Version consolidée : opposabilité et articulation à clarifier

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | IV.4 — Cycle de vie de l'acte |
| Constat | Le recueil distingue bien les natives, les consolidées et les modificatives (`kind`), et la page d'une version consolidée porte la mention « diffusé à titre informatif ». En revanche, la date d'opposabilité et le statut exécutoire affichés pour une version consolidée ne sont pas explicités comme ceux de l'acte **d'origine modifié** : un lecteur peut hésiter sur ce qui, de la consolidation ou de l'original, fait foi — l'information existe mais demande à être rendue plus explicite. |
| Exigence de référence | Distinction original / version en ligne / version consolidée (doctrine administrative, bonnes pratiques de publication). |
| Preuve | `src/lib/eli.js` (`buildWebVersion`, mention « Texte de l'acte à jour des modifications publiées, diffusé à titre informatif » ; `kind === "consolidee"`) ; `src/lib/recueil.js` (`corpsPublie`, versions). |
| Recommandation | Afficher sur la version consolidée la mention « ne fait pas foi » reliée à l'original signé sous le même ELI, avec sa date. Voir P-14. |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 180 jours et au-delà |
| Statut | **Levée** (2026-09-21b) — la version consolidée porte la mention « Version consolidée — ne fait pas foi » et un lien ELI vers l'original ; vérifié à l'écran. |
| Origine | Audit 2026-09-21 |

---

## Historique des audits

| Date | Rapport | Auditeur | Version outil | NC ouvertes | NC levées | NC nouvelles |
|---|---|---|---|---|---|---|
| 2026-09-21 | `rapports/AUDIT-SCRIBAE-2026-09-21.md` | Audit initial (quatre regards : DSI, RSSI, qualiticien, DAJ) | 1.2.0 | 0 | 0 | 27 |
| 2026-09-21 | `rapports/AUDIT-SCRIBAE-2026-09-21b.md` | Audit 2e campagne (quatre regards : DSI, RSSI, qualiticien, DAJ), parcours par l'interface | 1.2.0 | 6 | 18 | 3 |
| 2026-09-23 | `rapports/AUDIT-SCRIBAE-2026-09-23.md` | Audit 3e campagne (quatre regards : DSI, RSSI, qualiticien, DAJ), dépôt GitHub, démonstration publiée et chaîne d'intégration | 1.6.0 | 16 | 0 | 6 |
| 2026-09-29 | `rapports/AUDIT-SCRIBAE-2026-09-29.md` | Audit 4e campagne (quatre regards : DSI, RSSI, qualiticien, DAJ), version 1.6.1w, outillage à la racine, chaîne CI locale verte | 1.6.1w | 2 | 28 | 0 |
| 2026-09-30 | `rapports/AUDIT-SCRIBAE-2026-09-30.md` | Audit 5e campagne (quatre regards : DSI, RSSI, qualiticien, DAJ), version 1.6.1w, CI locale verte, 3 nouvelles NC | 1.6.1w | 1 | 26 | 3 |
