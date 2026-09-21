---
titre: Registre des non-conformités — Scribae
version: 2
cree_le: 2026-09-21
mis_a_jour: 2026-09-21b
cadre: src/audit/PROMPT-AUDIT-SCRIBAE.md
---

# Registre des non-conformités — Scribae

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
| Majeure | 9 | 0 | 3 | 6 |
| Mineure | 9 | 3 | 1 | 5 |
| Observation | 9 | 3 | 2 | 4 |
| **Total** | **30** | **6** | **6** | **18** |

## Historique des audits

| Date | Rapport | Auditeur | Version outil | NC ouvertes | NC levées | NC nouvelles |
|---|---|---|---|---|---|---|
| 2026-09-21 | `rapports/AUDIT-SCRIBAE-2026-09-21.md` | Audit initial (quatre regards : DSI, RSSI, qualiticien, DAJ) | 1.2.0 | 0 | 0 | 27 |
| 2026-09-21 | `rapports/AUDIT-SCRIBAE-2026-09-21b.md` | Audit 2e campagne (quatre regards : DSI, RSSI, qualiticien, DAJ), parcours par l'interface | 1.2.0 | 6 | 18 | 3 |

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
| Statut | **En cours** (2026-09-21b) — base de tests purs livrée (`src/package.json`, `src/tests/purs.test.mjs`), contrôle de syntaxe sur 120 fichiers (`src/scripts/verifier-syntaxe.mjs`) ; **aucun test de parcours** : reste inscrit au document d'industrialisation. |
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
| Statut | **En cours** (2026-09-21b) — CI livrée (`src/github/ci.yml`), contrôle de syntaxe (`verifier-syntaxe.mjs`) **et analyse de style** (`verifier-style.mjs` : refuse `debugger`, signale `var`/`console.log` du code client) intégrés à `npm run lint`, images Docker épinglées par empreinte (`src/server/mysql/Dockerfile`, `src/server/docker-compose.yml`), `mysql2` fixé à `3.11.3` ; **reste le verrou de dépendances (`package-lock.json`)**, absent faute de npm dans l'atelier (voir P-20). |
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
| Statut | **Ouverte** (2026-09-21b) — inchangée : `src/css/app.css` 3 146 lignes, `src/ui/views/signature.js` 3 135, `src/SPEC.md` 2 702. Le découpage documentaire a été amorcé (`src/docs/INDUSTRIALISATION.md`) sans réduire les monolithes. |
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
| Statut | **Ouverte** (2026-09-21b) — inchangée : `sansInterne` reste défini dans `index.html` et `src/server/mysql/actes.mjs`, `partiePublique` dans `src/lib/signature.js` ; `sha256Hex` reste implémenté deux fois. |
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
| Preuve | `src/package.json`, `src/scripts/verifier-syntaxe.mjs`, `src/tests/purs.test.mjs`, `src/github/ci.yml` (chemin d'import à recopier en `\.github/workflows/ci.yml`) ; absence des mêmes fichiers à la racine du dépôt. |
| Recommandation | Recopier l'outillage à la racine du dépôt lors de la publication (ou documenter le lien), et trancher le rangement. Voir P-27. |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 90–180 jours |
| Statut | **Ouverte** (2026-09-21b) |
| Origine | Audit 2026-09-21b |

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
| Statut | **Levée** (2026-09-21b) — porte de compétence posée sur les trois chemins de signature (`src/ui/views/signature.js:1150`, `:1264`, `:2187`), opérateur tracé dans le dossier interne. Parcours complet non rejoué (aucun acte en attente de signature au jeu de démonstration) : le refus est établi par les messages et la lecture de code. |
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
| Statut | **En cours** (2026-09-21b) — comparaison à temps constant (`egalConstant`) et journal serveur append-only scellé par chaîne SHA-256 livrés (`GET /v1/journal`, vérifié à l'écran : « Chaîne intègre — 3 entrées ») ; **export et politique de rétention toujours non définis**. |
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
| Statut | **Ouverte** (2026-09-21b) |
| Origine | Audit 2026-09-21b |

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
| Statut | **Levée** (2026-09-21b) — titre de document posé par écran dans l'atelier et repère `nav aria-label` ajouté ; mesurés sur 4 écrans. |
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
| Statut | **En cours** (2026-09-21b) — l'opérateur est tracé et la compétence vérifiée (P-06) ; le **certificat reste auto-engendré** dans le navigateur et la clé privée reste locale : la non-répudiation n'est pas établie. |
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
| Statut | **En cours** (2026-09-21b) — `FRBRuri` est désormais une URI HTTP et `eli:uri` figure dans le JSON-LD ; l'ambiguïté de vocabulaire est levée côté interface (`src/ui/views/acte-publie.js`) : « **Adresse ELI (HTTP)** » désigne l'URI déréférençable du document (`eliAdresse`) et « **Identifiant ELI** » la forme `eli:/fr/…` (voir P-18). Reste à **unifier** les deux formes en une seule (une URI ELI HTTP canonique) dans la publication, le JSON-LD et l'Akoma Ntoso. |
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
| Statut | **En cours** (2026-09-21b) — la télétransmission reste **simulée** (`CONTROLE_LEGALITE`, `certificatTransmission`), mais la **mention produite est désormais qualifiée** : le certificat porte `demonstration: true` (nature « Simulation d'accusé de réception », émetteur « Simulation locale (aucun appel à l'API @ctes) »), la mention devient « … (mention de démonstration — transmission simulée, sans appel sortant) » (`mentionDeTransmissionSimulee`, `src/lib/legalite.js`) et le bloc de recueil affiche un badge « **simulation** » (`src/lib/eli.js`) ; l'écran de transmission et le service (`index.html`, `src/server/mysql/actes.mjs`) propagent le drapeau (voir P-19). Reste l'exigence de **preuve de l'appel réel** pour une transmission effective. |
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
