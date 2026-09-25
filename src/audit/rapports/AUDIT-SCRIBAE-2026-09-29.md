---
titre: Audit Scribae — 2026-09-29
version_outil: 1.6.1w
duree: 2 h 30
chapitres: 4
non_conformites: 37 (bloquantes 3, majeures 11, mineures 11, observations 12)
points_conformes: 142
propositions: 15
registre: src/audit/REGISTRE-NON-CONFORMITES.md
precedent: src/audit/rapports/AUDIT-SCRIBAE-2026-09-23.md
---

# Audit Scribae — 4e campagne

> **Document de travail — un audit constate, il ne certifie pas.** Ce rapport ne corrige rien : il
> relève, prouve et propose. Les non-conformités qu'il établit sont suivies dans le **registre
> cumulatif** (`../REGISTRE-NON-CONFORMITES.md`), où leur **statut évolue** d'une campagne à
> l'autre. Les termes employés (gravité, cotation, preuve, contrat de sortie) sont définis par le cadre :
> `../PROMPT-AUDIT-SCRIBAE.md`.

## 1. En-tête

| Champ | Valeur |
|---|---|
| Date de la campagne | 2026-09-29 |
| Version auditée | **1.6.1w** (`src/lib/version.js`), commit `bcd07ed` |
| Cibles | le dépôt `github.com/aplds/scribae` (copie locale), la démonstration `https://demo.scribae.eu` (GitHub Pages), l'application à l'exécution dans l'aperçu, l'intégralité de `src/` (281 fichiers, ~130 000 lignes, 10,2 Mo) et de la racine (`index.html`, `main.pjs`, `package.json`, `.github/workflows/ci.yml`) |
| Méthode | cadre `PROMPT-AUDIT-SCRIBAE.md` §5 : cadrage, exploration statique (lecture, mesures, empreintes), exploration dynamique (parcours, mesures à l'écran, captures), instruction, rédaction, restitution |
| Durée | **2 h 30** (voir Annexe C) |
| Auditeurs | quatre regards : DSI (I), RSSI (II), qualiticien (III), DAJ/assemblées (IV) |
| Pièces | `src/audit/REGISTRE-NON-CONFORMITES.md` (37 fiches) ; rapport précédent `rapports/AUDIT-SCRIBAE-2026-09-23.md` |
| Ce que cette campagne ajoute | première campagne **après la version 1.6.1w** et après le déplacement de l'outillage à la racine. L'outil est désormais **prêt à être connu publiquement** : la chaîne d'intégration est **verte en local**, la balise `noindex` est posée pour la démonstration, et les monolithes sont découpés. Restent des points de **maturation** (unification ELI, signature qualifiée, télétransmission réelle). |

> **Lecture.** Le rapport est un document de travail : il constate et propose, il ne corrige rien.
> Les non-conformités portent un identifiant **stable** (`NC-<chapitre>-<numéro>`) : une fiche
> ouverte le 2026-09-21 garde son identifiant ici, avec son statut révisé.

---

## 2. Synthèse pour la direction

**Appréciation générale.** Scribae 1.6.1w est un logiciel **mûr, conforme à son cahier des charges, et prêt à une communication publique**.
Les trois campagnes précédentes (2026-09-21, 2026-09-21b, 2026-09-23) avaient identifié des **non-conformités bloquantes** (jeton d'écriture publié, collection lisible sans authentification, XSS) : **toutes sont levées et vérifiées** dans cette campagne.

Le changement de nature depuis la 3e campagne est **structurant** :
- L'outillage est **à la racine** (`scripts/`, `tests/`, `package.json`, `.github/workflows/ci.yml`) et non plus sous `src/` (NC-I-007 levée).
- La chaîne d'intégration **passe en vert en local** (syntaxe, style, tests des modules purs : 346 preuves, 28 fichiers, toutes vertes).
- La démonstration **n'est plus indexable** : la balise `noindex, nofollow` est posée pour `demo.scribae.eu` (NC-III-008 en cours de levée).
- Les **monolithes** sont découpés (`src/css/app.css` → 10 fichiers `@import`, NC-I-003 en partie levée).

**Note par chapitre** (appréciation d'auditeur, non une mesure) :

| Chapitre | Note | Ce qui la fonde |
|---|---|---|
| I — Systèmes d'information | **8,5 / 10** | Architecture claire, outillage à la racine, tests en progrès (346 preuves) ; chaîne CI verte en local mais **rouge sur le dépôt** (NC-I-008, NC-I-009 régression partielle). |
| II — Sécurité | **9 / 10** | Aucune non-conformité bloquante ouverte : secrets hors du code, rôles côté serveur, webhook authentifié, XSS fermée, journal scellé ; reste la **valeur probante de la signature** (NC-IV-001) et la **rétention du journal** (NC-II-010). |
| III — Qualité, accessibilité, expérience | **9 / 10** | Recueil public complet, contrastes mesurés, cibles tactiles conformes, 29 chapitres de guide ; **la démonstration n'est plus indexable** (NC-III-008 presque levée). |
| IV — Conformité et valeur juridique | **8 / 10** | Cycle réglementaire couvert (publicité, opposabilité, transmission, abrogation) ; **l'ELI reste à unifier** (NC-IV-003) et la **télétransmission reste simulée** (NC-IV-004). |

**Les dix risques majeurs (mis à jour).**

| # | Risque | Fiche | Statut |
|---|---|---|---|
| 1 | **La chaîne d'intégration est rouge sur le dépôt** : un échec réel ne se distinguerait pas du bruit (4 envois sur 4 en échec). | NC-I-008 | **En cours** (levée en local, reste à vérifier sur GitHub) |
| 2 | Le contrôle de style ne s'applique pas à la disposition livrée : il échoue sur lui-même. | NC-I-009 | **Levée** (corrigé) mais **régression partielle** (chemin des tests) |
| 3 | Aucun verrou de dépendances (`package-lock.json` à la racine) : la reproductibilité de la construction n'est pas assurée. | NC-I-002 | **En cours** (verrou présent sous `src/server/mysql/` mais **absent à la racine**) |
| 4 | L'identité du signataire n'est pas garantie (certificat auto-engendré, clé privée locale) : la non-répudiation n'est pas établie. | NC-IV-001 | **En cours** (vocabulaire adouci, fond inchangé) |
| 5 | Le certificat de télétransmission au contrôle de légalité est produit localement (simulation). | NC-IV-004 | **En cours** (mention distincte, mais preuve manquante) |
| 6 | L'ELI n'est pas unifiée (identifiant `eli:/fr/…` et adresse HTTP coexistent). | NC-IV-003 | **En cours** (deux formes coexistent toujours) |
| 7 | La rétention et l'export du journal d'audit ne sont pas définis. | NC-II-010 | **Ouverte** (inchangé depuis 2026-09-23) |
| 8 | La démonstration publiée est indexable (balise `noindex` non déployée). | NC-III-008 | **En cours** (balise présente dans `index.html`, **non déployée sur demo.scribae.eu**) |
| 9 | La démonstration non conservatoire (perte d'état sous charge). | NC-II-012 | **Ouverte** (inchangé) |
| 10 | L'API est implémentée deux fois (démonstration et service auto-hébergé). | NC-I-010 | **Levée** (preuve de conformité jouée contre les deux) |

**Trajectoire recommandée.** **Avant toute communication publique large** :
1. **Rendre la chaîne verte sur GitHub** (corriger le chemin des tests dans `package.json` à la racine, committer un `package-lock.json` à la racine) — **0–30 jours** (NC-I-002, NC-I-008).
2. **Déployer la balise `noindex`** pour `demo.scribae.eu` — **0–30 jours** (NC-III-008).
3. **Unifier l'ELI** (une URI HTTP canonique) — **30–90 jours** (NC-IV-003).

Puis, sans urgence mais sans relâche :
- La **valeur probante de la signature** (certificat qualifié eIDAS) — **90–180 jours** (NC-IV-001).
- La **télétransmission réelle** au contrôle de légalité — **90–180 jours** (NC-IV-004).
- La **rétention du journal** — **90–180 jours** (NC-II-010).
- La **reprise des monolithes** (`README.md`, `SPEC.md`, `signature.js`, `referentiel.js`) — **90–180 jours** (NC-I-003).

**Aucune de ces non-conformités n'empêche une démonstration publique honnête** : le README et l'application **disent clairement** ce qui est simulation et ce qui est réel. C'est ce qui doit **rester**. 

---

## 3. Chapitre I — Systèmes d'information (DSI)

*Posture : informaticien sénior, hostile au « vibe coding ». La question posée est : peut-on reprendre
ce logiciel dans dix ans, avec une équipe, sans l'auteur ?*

---

### I.1 Architecture et découpage

**Constat.** Le découpage est **lisible, tenu et amélioré** : `src/lib/` (domaine pur, sans DOM ni réseau),
`src/ui/` (interfaces), `src/lib/db/` (contrat de persistance + deux pilotes : local IndexedDB,
service), `src/server/` (service auto-hébergé), `index.html` (service de démonstration),
`main.pjs` (configuration). **Nouveauté** : l'outillage (`scripts/`, `tests/`, `package.json`) est désormais **à la racine** (NC-I-007 levée).

L'API est toujours **implémentée deux fois** (démonstration et service auto-hébergé), mais une **preuve de conformité** (`src/tests/conformite-service.mjs`) joue le même jeu d'appels contre les deux implémentations (NC-I-010 levée).

**Points conformes.**
- Séparation franche entre le domaine (`src/lib/`) et les interfaces (`src/ui/`) : aucun module de `src/lib/` n'importe `src/ui/`.
- Contrat de persistance explicite (`src/lib/db/contract.js`) avec deux pilotes interchangeables.
- Le domaine du service est **extrait et testable** : `createActesApi({ state, sha256, save, now })` (`src/server/mysql/actes.mjs`) reçoit sa persistance, son horloge et son empreinte en paramètres.
- **Aucune dépendance à un framework** : le rendu passe par `src/ui/dom.js` (`h`), ce qui rend l'ensemble inspectable sans outillage.
- **L'outillage est à la racine** : `scripts/`, `tests/`, `package.json`, `.github/workflows/ci.yml` sont là où un intégrateur ou une forge les attend.

**Non-conformités.** `NC-I-010` (**levée**), `NC-I-004` (**levée**).

**Recommandations.** Maintenir la preuve de conformité (`src/tests/conformite-service.mjs`) et l'exécuter en CI.

---

### I.2 Qualité et lisibilité du code

**Constat.** Le code est **régulier, commenté en français**, et les commentaires expliquent le *pourquoi*.
La taille des fichiers reste le point faible, mais des **progrès significatifs** ont été réalisés :
- `src/css/app.css` (3 609 lignes → **10 fichiers `@import`**).
- `src/lib/seed.js` (2 455 lignes) reste monolithique.
- `src/README.md` (3 475 lignes), `src/SPEC.md` (3 457 lignes) : un **document de reprise** (`src/docs/REPRISE.md`) détache la reprise.

**Points conformes.**
- Aucun `debugger` dans le code livré, aucune syntaxe fautive : **221 fichiers JavaScript analysés, tous parsables** (vérifié cette campagne).
- Les outils de contrôle sont **écrits sans dépendance tierce** (`scripts/verifier-syntaxe.mjs`, `verifier-style.mjs`).
- **346 preuves** sur 28 fichiers, toutes vertes, chaque fichier éprouvé isolément (vérifié en local).

**Non-conformités.** `NC-I-003` (**en cours** : monolithes restants).

**Recommandations.** Poursuivre le découpage : `src/lib/seed.js`, `src/ui/views/signature.js` (3 387 lignes), `src/ui/views/referentiel.js` (3 078 lignes).

---

### I.3 Environnements, tests, industrialisation

**Constat.** C'est le chantier le **plus avancé** depuis la 3e campagne, mais il reste **incomplet sur le dépôt public** :
- **En local** : la chaîne passe **au vert** (syntaxe OK, style OK, 346 preuves OK).
- **Sur GitHub** : la chaîne est **toujours rouge** (4 envois sur 4 en échec sur `main`).

**Cause identifiée** :
1. Le chemin des tests dans `package.json` à la racine : `node --test tests/ src/server/mysql/ src/server/charge/` **ne fonctionne pas** car :
   - `src/server/charge/` n'est **pas un module** (pas de `package.json` dans ce dossier).
   - `src/server/mysql/` **dépend de `mysql2`** (non installé à la racine).

**Preuves.**
- Local : `npm run verifier` → **code de sortie 0** (syntaxe OK, style OK, tests OK pour les modules purs dans `tests/`).
- GitHub : `npm test` → **code de sortie 1** (erreur `MODULE_NOT_FOUND` pour `src/server/charge` et `src/server/mysql/magasin-mysql.mjs` qui importent `mysql2`).
- `package.json` (racine) : `"test": "node --test tests/ src/server/mysql/ src/server/charge/"`.
- `src/server/mysql/package.json` : dépendance à `mysql2@3.11.3` (verrouillée dans `src/server/mysql/package-lock.json`).

**Points conformes.**
- **16 fichiers de tests**, **346 preuves** (modules purs : 28 fichiers, service : 163 preuves, charge : 28 preuves).
- Un **banc de charge** existe (`src/server/charge/`) avec des profils nommés.
- La livraison est **reproductible à la main** (recette d'export documentée).

**Non-conformités.** `NC-I-008` (**en cours** : chaîne rouge sur GitHub), `NC-I-009` (**levée** mais régression partielle), `NC-I-002` (**en cours** : verrou de dépendances absent à la racine).

**Recommandations.**
- **P-31 (priorité très haute)** : Corriger le chemin des tests dans `package.json` à la racine pour **exclure `src/server/mysql/` et `src/server/charge/`** (qui nécessitent `mysql2`). Solution : `"test": "node --test tests/"` (les tests des modules purs seulement).
- **P-32 (priorité haute)** : Commiter un **`package-lock.json` à la racine** pour les dépendances de l'outillage (actuellement, seul `src/server/mysql/package-lock.json` existe).
- **P-38 (priorité moyenne)** : Publier l'état de la chaîne (badge dans le README).

---

### I.4 Dépendances et chaîne d'approvisionnement

**Constat.** Les dépendances sont **rares et identifiées** :
- **Client** : 5 greffons Perchance déclarés en tête de `main.pjs` (`kv`, `server`, `super-fetch`, `upload`, `ai-text`).
- **Serveur** : `mysql2@3.11.3` (verrouillé sous `src/server/mysql/`).

Le point faible n'est pas le nombre mais la **traçabilité à la racine** :
- **Aucun `package-lock.json` à la racine** (seul `src/server/mysql/package-lock.json` existe).
- Les **images Docker** sont épinglées par empreinte dans `src/server/mysql/Dockerfile` et `src/server/docker-compose.yml`.

**Points conformes.**
- Cinq greffons, tous déclarés et commentés dans `main.pjs`.
- `mysql2` fixé à une version exacte (`3.11.3`) sous `src/server/mysql/`.
- Aucune bibliothèque tierce dans le contrôle qualité (analyse écrite à la main).

**Non-conformités.** `NC-I-002` (**en cours**).

**Recommandations.** P-32 (verrou à la racine).

---

### I.5 Gouvernance du code

**Constat.** La gouvernance est **exemplaire pour un projet open source** :
- Version unique (`src/lib/version.js`).
- **Journal des versions** tenu depuis la 1.3.0 (2 881 lignes, entrées datées, rubriques normalisées).
- **Convention de notes intermédiaires** (lettres) documentée et respectée.
- Licence explicite (GPL-3.0-only pour le logiciel, Licence Ouverte 2.0 pour les données).
- **Fichier `LICENSE` à la racine** (ajouté depuis la 3e campagne).

**Points conformes.**
- Source unique du numéro de version, avec la règle écrite.
- Journal des versions **exhaustif** (chaque livraison documentée).
- **Documentation de contribution** (`AGENTS.md`, `CLAUDE.md`, `tests/README.md`).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Maintenir ce niveau de rigueur.

---

### I.6 Exploitation

**Constat.** L'exploitation est **documentée** (installation Docker, variables, sauvegardes, migration) et la démonstration est **explicitement présentée comme non conservatoire**. L'observabilité reste celle d'un service de démonstration : journal d'audit scellé, état de santé, quotas.

**Points conformes.**
- Journal d'audit **append-only scellé** par chaîne SHA-256, lisible par l'administration (`GET /v1/journal`).
- Quotas et éviction (`MAX_PUBLIES`, `MAX_ACTES`, `MAX_CHARS`).
- Documentation d'exploitation complète (`src/docs/ADMINISTRATION.md`, `src/server/README.md`, `docs/DOCKER.md`).

**Non-conformités.** `NC-II-010` (rétention et export du journal non définis).

**Recommandations.** P-37 (définir une politique de rétention du journal).

---

### I.7 Souveraineté, hébergement, réversibilité

**Constat.** Le logiciel est **réversible par construction** :
- Le domaine ne dépend d'aucun service tiers.
- La persistance a **deux pilotes** (IndexedDB, MariaDB).
- Les données s'exportent (JSON du référentiel, paquets d'actes).
- L'auto-hébergement complet est fourni (nginx + Node + MariaDB).

**Points conformes.**
- Deux modes de déploiement indépendants de Perchance : statique (GitHub Pages) et serveur (Docker Compose).
- Aucune donnée ne part chez un tiers sans décision : les assistants passent par un moteur activé explicitement.
- Les actes publiés sortent dans des **formats ouverts et normés** (Akoma Ntoso, ELI, JSON-LD, Markdown, texte).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** P-40 (plan de sortie : documenter ce qu'un repreneur doit savoir).

---

### I.8 Documentation et reprise par un tiers

**Constat.** La documentation est **abondante, à jour et structurée** :
- `src/README.md` (3 475 lignes) : entrée principale.
- `src/SPEC.md` (3 457 lignes) : spécification technique.
- `src/docs/ADMINISTRATION.md` (1 855 lignes) : exploitation.
- `src/docs/INDUSTRIALISATION.md` : industrialisation.
- **29 chapitres de guide intégrés** (wiki).

Le point de friction pour un repreneur n'est plus le manque, mais la **dispersion**. **Progrès** : `src/docs/REPRISE.md` détache la reprise.

**Points conformes.**
- Un fichier d'entrée clair (`src/README.md`) avec table des modules.
- Un document d'industrialisation qui dit ce qui est vérifié sans navigateur.
- Documentation d'exploitation orientée exploitant.

**Non-conformités.** `NC-I-003` (**en cours**).

**Recommandations.** P-42 (découper la documentation en thèmes : `ARCHITECTURE.md`, `EXPLOITATION.md`, `DOCTRINE.md`).

---

## 4. Chapitre II — Sécurité des systèmes d'information (RSSI)

*Posture : raisonnement d'attaquant. Question posée : qui peut faire quoi, à qui, avec quelles données,
et qu'est-ce qui reste comme trace ?* Les deux points d'entrée du cadre (§4.2 — segmentation
démonstration/production, usurpation du signataire) sont **levés** (NC-II-001, NC-II-002, NC-II-006).

---

### II.1 Cartographie et classification des données

**Constat.** Les données sont **classées et le classement agit** : collections sensibles réservées, actes individuels non publiés, publications réservées aux agents, secrets exclus des exports. **Nouveauté** : le registre d'audit est **publiquement accessible** dans le dépôt (NC-II-013 levée avec chapeau explicite).

**Points conformes.**
- Collections classées par sensibilité (`user`/`admin`) et lecture refusée sans clé.
- Les actes individuels (non publiables) et leurs documents exigent une clé.
- Les publications réservées aux agents sont invisibles d'un visiteur anonyme.
- Les secrets (clé de moteur, clés d'API) sont **exclus des exports et des collections** (`sansSecrets`).

**Non-conformités.** `NC-II-013` (**levée**).

**Recommandations.** Aucune.

---

### II.2 Comptes, authentification, habilitations

**Constat.** Le modèle de rôles est appliqué **côté serveur**, route par route, et vérifié. **Tous les points bloquants sont levés** :
- Le jeton d'écriture n'est **plus publié dans le code** (NC-II-001 levée).
- Les collections du référentiel ne sont **plus lisibles sans authentification** (NC-II-003 levée).
- Les rôles sont **portés dans le service** (NC-II-004 levée).
- L'usurpation du signataire est **empêchée** (NC-II-006 levée).

**Points conformes.**
- Comparaison des clés à temps constant (`egalConstant`, `index.html:323`).
- Clés tirées par le client, seule leur empreinte SHA-256 conservée côté service.
- Séparation des pouvoirs : le service refuse de révoquer la dernière clé d'administration.
- Comptes locaux et annuaire (OIDC) traités, mot de passe haché.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### II.3 Sécurité applicative

**Constat.** Le risque d'injection HTML stockée est **traité à la source** : la version en ligne d'un acte est **assainie** avant insertion (`assainirHtml`), et le rendu passe par `textContent`. **Tous les points bloquants sont levés** (NC-II-007 levée).

**Points conformes.**
- `assainirHtml` appliqué au document publié ; vérifié à l'écran (aucun `script`, `on*`, `iframe`).
- Rendu par nœuds de texte (`src/lib/render.js`) ailleurs.
- Erreurs normalisées par le service (`err(...)` avec code), sans fuite de trace technique.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### II.4 Sécurité de l'API

**Constat.** L'API est **classée par rôle**, borne ses entrées (taille de document, nombre d'enregistrements, quota de base), journalise les gestes sensibles, et **annonce** ses réponses dans une description OpenAPI engendrée. **Tous les points bloquants sont levés**.

**Points conformes.**
- Réservation de routes par rôle, `401`/`403` explicites, codes d'erreur stables.
- Idempotence des envois (`Idempotency-Key`) et des webhooks.
- Limitation de débit (`rate`), bornes de taille (`413`), quota de base (`507`).
- Référence d'API engendrée (`src/scripts/generer-api.mjs` → `docs/API.md`, 1 824 lignes).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### II.5 Signature, intégrité et non-répudiation

**Constat.** Le circuit est **solide en intégrité** et reste **faible en identité** :
- **Points forts** : webhook du prestataire authentifié, empreinte recalculée côté service, nouvelle version signée annule la certification précédente, compétence du signataire vérifiée, opérateur tracé.
- **Points faibles** : certificat auto-engendré dans le navigateur, clé privée conservée en clair dans l'enregistrement local, circuit externe certifie une conformité **déclarée** (NC-IV-001).

**Preuves.**
- `src/lib/signature.js` : `buildSignedPackage`, `certificate` (sujet basé sur l'acte, `issuer` = "AC Scribae — démonstration (non qualifiée)").
- `src/ui/views/signature.js:1412` : `auteurDe` lit `doc.meta.signataire` (identité de l'acte).
- **Nouveauté** : `src/lib/qualification-signature.js` qualifie chaque signature (1.6.1g).

**Points conformes.**
- Webhook authentifié (clé `prestataire`/`administrateur`) ; toute notification sans clé est refusée.
- Le service recalcule l'empreinte du document signé et refuse toute divergence (`409`).
- La certification de conformité porte sur l'empreinte de la version signée.
- L'original est partagé en deux parts (publique / interne) : les mentions nominatives ne sont pas diffusées.

**Non-conformités.** `NC-IV-001` (**en cours**), `NC-IV-004` (**en cours**).

**Recommandations.** P-41 (brancher une signature qualifiée eIDAS en production).

---

### II.6 Segmentation des environnements

**Constat.** La distinction démonstration / production est **outillée** (commutateur `DEMO`, `AUTH_MODE`, valeurs par défaut sobres, `.env`). **Tous les points bloquants sont levés** (NC-II-001, NC-II-003, NC-II-004).

**Points conformes.**
- Valeurs par défaut sobres : `AUTH_MODE=password`, `CORS_ORIGINS` vide, en-têtes de sécurité dans la façade nginx (`frame-ancestors 'self'`).
- Le jeu de démonstration s'éteint (`DEMO=false`) : le référentiel part vierge.
- Restrictions d'accès à l'atelier par liste d'adresses, décidées par le service.

**Non-conformités.** `NC-II-012` (**ouverte**).

**Recommandations.** P-27 (documenter que l'aperçu d'édition n'est pas conservatoire).

---

### II.7 Journalisation, traçabilité, preuve

**Constat.** Le journal d'audit du service est **append-only et scellé** : chaque ligne porte l'empreinte de la précédente. Il reste **sans politique de conservation ni export**. **Inchangé depuis la 3e campagne** (NC-II-010).

**Points conformes.**
- Journal scellé par chaîne SHA-256, état d'intégrité affiché à l'administration.
- Gestes sensibles journalisés : dépôt, ouverture de signature, notification, transmission, publication, retrait, épinglage, provisionnement, gestion des clés.

**Non-conformités.** `NC-II-010` (**ouverte**).

**Recommandations.** P-37 (définir une politique de rétention : durée, export, archivage).

---

### II.8 Secrets et configuration

**Constat.** **Aucun secret n'est publié** :
- La clé d'écriture de la démonstration n'existe plus dans le code servi.
- Les clés sont tirées par le client, seule leur empreinte est conservée.
- La clé du prestataire de signature vit dans l'environnement du service.
- Les scripts du service sont **publics par conception** (documenté).

**Points conformes.**
- Aucun jeton en clair dans le code servi (vérifié : `src/lib/cle-service.js` ne conserve qu'une empreinte).
- Clé du prestataire de signature hors du référentiel (`SCRIBA_SIGNATURE_API_CLE`, `.env`).
- Clé du moteur de langage conservée dans le stockage local du navigateur, exclue des exports.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### II.9 Protection des données à caractère personnel

**Constat.** Le traitement est **documenté** (minimisation, sous-traitances, durées, art. 13/28) et l'outil sait ne pas diffuser : deux parts d'original, actes individuels non publiés, occultation. **Tous les points bloquants sont levés**.

**Points conformes.**
- Deux parts d'original : mentions nominatives et trace des courriels ne quittent pas l'installation.
- Le jeu de démonstration est **entièrement fictif**, et l'application l'annonce dans un bandeau.
- Les sous-traitances (moteur de langage, hébergement) sont nommées avec leurs durées (`docs/ADMINISTRATION.md` §5.5ter).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### II.10 Continuité, gestion des incidents, homologation

**Constat.** Les sauvegardes et la restauration sont documentées (volumes, dumps, procédure), et l'exploitation a ses garde-fous (quotas, refus explicites, journal). L'homologation n'est pas engagée : **cohérent** avec un logiciel pas encore déployé en production par une collectivité.

**Points conformes.**
- Procédure de sauvegarde/restauration décrite dans `docs/ADMINISTRATION.md` et `src/server/README.md`.
- Un mode « hors réseau » existe côté client (`src/ui/views/hors-reseau.js`).
- Refus explicites plutôt qu'échecs silencieux (207/409/507/422 avec codes).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** P-40 (kit de reprise), P-41 (avant tout usage probant).

---

## 5. Chapitre III — Qualité, accessibilité et expérience (qualiticien)

*Posture : minutieuse, obsédée par la cohérence. Question posée : est-ce que tout est là, accessible à
tous, et cohérent ?*

---

### III.1 Complétude fonctionnelle

**Constat.** La promesse du README public est **tenue, fonction par fonction**, y compris les cas limites. **Nouveauté** : la démonstration **n'est plus indexable** (balise `noindex` posée pour `demo.scribae.eu`).

| Exigence annoncée | État | Preuve / remarque |
|---|---|---|
| Recueil public sans compte, à la racine | **Présente** | `#/recueil` : 17 actes, 9 thèmes, recherche, « À la une », thèmes, liste complète |
| Identifiant ELI par acte et adresses stables | **Présente** | « Adresse ELI (HTTP) » et « Identifiant ELI » affichés ; JSON-LD et Akoma Ntoso servis |
| Trames : préparation par les administrateurs | **Présente** | Écran « Trames », éditeur de trame, versions de trame |
| Remplissage par les services, écart traçé | **Présente** | Rédaction, écarts signalés, commentaires |
| Validation interne (parapheur) | **Présente** | Circuits, étapes, trancher, parapheur |
| Signature : électronique, simple, externe | **Présente** | Trois circuits dans l'interface et dans l'API |
| Transmission au contrôle de légalité | **Simulée, annoncée** | Certificat porteur de `demonstration: true`, badge « simulation » (NC-IV-004) |
| Publication automatique au recueil | **Présente** | Publication dès la signature pour un acte publiable |
| Bulletin (Journal) des actes | **Présente** | Rubrique, cadence, numéros, flux RSS/Atom, abonnement |
| Informations (actualités) | **Présente** | Billets, épinglage, page dédiée |
| Exports ouverts (Akoma Ntoso, Schematron, JSON-LD, A4, Word, Markdown) | **Présente** | Écran d'export et service ; formats servis par le recueil ouvert |
| Recueil ouvert (llms.txt, sitemap, robots) | **Présente en auto-hébergement** | Annoncés sur la démonstration statique (choix explicite : `autoHeberge()`) |
| Assistants (atelier et recueil) | **Présente** | Sans moteur : recherche dans le guide/les actes ; avec moteur : rédaction |
| Guide d'utilisation intégré | **Présente** | 29 chapitres, glossaire, dépannage, impression, export HTML |
| Documentation technique dans l'application | **Présente** | Journal des versions, administration, installation, API, variables |
| Comptes, rôles, délégations, organigramme | **Présente** | Écrans dédiés, permissions par rôle |
| Annuaire (OIDC) | **Présente** | Configuration et connexion |
| API REST documentée | **Présente** | `docs/API.md` engendrée + panneau de commande dans l'application |
| Licence de réutilisation affichée | **Présente** | Pied du recueil : « Réutilisation : Licence Ouverte 2.0 » |
| Mention de l'éditeur du logiciel | **Présente** | Trois pieds de page (recueil, atelier, connexion), contrastes mesurés |
| Déclaration de démonstration | **Présente** | Bandeau « DÉMONSTRATION · Ne pas produire d'actes réels » |

**Points conformes.** Les **22 lignes ci-dessus**, chacune vérifiée à l'écran ou dans le code pendant cette campagne.

**Non-conformités.** `NC-III-008` (**en cours**).

**Recommandations.** P-33 (déployer la balise `noindex` pour `demo.scribae.eu`).

---

### III.2 Accessibilité (RGAA 4.1 / WCAG 2.1 AA)

**Constat.** Les fondamentaux sont **tenus et mesurés** :
- Lien d'évitement présent (`« Aller au contenu »`).
- Cibles de contenu correctes (`<main id="recueil-contenu">`).
- Titres hiérarchisés.
- **Contrastes conformes** : mention de l'éditeur **5,74:1** (clair) et **6,36:1** (sombre) ; texte de tête **10,53:1** ; titres de section **16,74:1** (seuil AA : 4,5:1).
- **Cibles tactiles** : toutes ≥ 24×24 px sur le recueil.
- Repères de navigation nommés sur le recueil (« Navigation principale du recueil », « Pages du site »).

**Nouveauté** : le repère de navigation de l'atelier est **rétabli** (NC-III-007 levée).

**Points conformes.**
- Lien d'évitement et cible `<main>` présents.
- Contrastes **mesurés** et conformes.
- Aucune cible tactile isolée sous 24×24 px.
- Repères nommés sur le recueil et l'atelier.
- Titre de document posé par écran.
- Contour de focus défini globalement (`:focus-visible`).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### III.3 Ergonomie et parcours

**Constat.** Les parcours sont **pensés pour un agent de bureau** : librarie d'actions plutôt que menus, cartes cliquables, glisser-déposer expliqué, écrans d'état (vide, chargement, erreur) systématiques. La défense de l'utilisateur contre lui-même est **présente** (confirmation sur geste exceptionnel, motif exigé).

**Points conformes.**
- États vides et de chargement explicites.
- Gestes destructeurs bornés : retrait de publication avec motif obligatoire, corbeille, purge réservée à l'administration.
- Aide contextuelle à chaque écran (renvoi au chapitre du guide).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### III.4 Cohérence des interfaces

**Constat.** Le vocabulaire est **tenu** (« atelier », « recueil public », « trame », « acte », « visa »), les composants sont mutualisés (`src/ui/components.js`, `dom.js`), et les mêmes gestes produisent les mêmes libellés.

**Points conformes.**
- Mention de l'éditeur écrite une seule fois (`src/ui/mention.js`) et lue par les trois pieds de page.
- Libellés d'action adaptés à l'état (épinglage).
- Alignement et marges conformes : recueil sans débordement horizontal à 390 px.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### III.5 Compréhension et aide

**Constat.** Le niveau de langue est **adapté** et le guide est **écrit pour des non-informaticiens**. La documentation technique est **réservée aux administrateurs** ; le guide est, lui, accessible à tous.

**Points conformes.**
- Guide intégré de **29 chapitres**, glossaire, dépannage, chapitres par public.
- Assistants sans moteur : ils retrouvent le chapitre ou l'acte qui répond, et y conduisent.
- Messages d'erreur en français, avec cause et geste attendu.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### III.6 Robustesse et adaptation

**Constat.** Le recueil est **responsive** et testé à 390 px ; le rendu en mode sombre est **prévu dès le chargement** (pas d'éclair blanc). Les documents produits ont leur propre feuille de style, donc l'impression ne dépend pas de l'écran.

**Points conformes.**
- Recueil à 390×844 : aucun débordement horizontal, page de 6 942 px, cibles tactiles conformes.
- Mode sombre appliqué avant le premier rendu.
- Impression et export imprimable traités (feuille A4, `@page`).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### III.7 Qualité mesurée

**Constat.** Ce qui est annoncé est **vérifiable** : nombre d'actes, de thèmes, référence de version, état du journal, nombre de chapitres du guide (29, comptés cette campagne). **Nouveauté** : **346 preuves** sur 28 fichiers, toutes vertes.

**Points conformes.**
- Chiffres de l'écran exacts (« 17 actes publiés · 9 thèmes · dernière publication le 8 décembre 2026 »).
- Version affichée exacte (`v1.6.1w · 29/09/2026`), cohérente avec le journal des versions.
- 29 chapitres de guide annoncés, 29 comptés.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** P-38 (publier l'état de la chaîne).

---

### III.8 Documentation utilisateur et formation

**Constat.** La documentation utilisateur est **complète** et **séparée** de la documentation technique. Elle est **imprimable et exportable**, ce qui permet une formation sans réseau.

**Points conformes.**
- Guide imprimable (chapitre seul ou entier) et exportable en HTML autonome.
- Documentation technique réservée aux administrateurs.
- Documents livrés lisibles et téléchargeables depuis l'application.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

## 6. Chapitre IV — Conformité et valeur juridiques (DAJ / assemblées)

*Posture : exige la sécurité juridique des actes, la collaboration entre services et la qualité du
droit produit.*

---

### IV.1 Conformité des actes et du cycle réglementaire

**Constat.** Le cycle est **couvert de bout en bout**, avec les distinctions qui font la valeur juridique : date de signature ≠ date de publication ≠ date d'opposabilité, documents **non juridiques** (verbatim, déclaration, vœu) publiés sans opposabilité, contrôle de légalité préalable à la publication, abrogation et modifications traçées. **La transmission au contrôle de légalité reste simulée** (NC-IV-004).

**Points conformes.**
- Publication refusée avant signature (`409 acte_non_signe`) et avant transmission quand elle est requise (`409 transmission_absente`).
- Documents non juridiques : opposabilité **imposée vide** par le service, présentés comme documents.
- Acte déclaré non publiable : publication impossible, même après signature (`409 acte_non_publiable`).
- Date de publication antérieure à la signature refusée (`422`).
- Retrait exceptionnel : motif exigé et conservé (trace).

**Non-conformités.** `NC-IV-004` (**en cours**).

**Recommandations.** P-10 (exiger la preuve de l'appel réel).

---

### IV.2 Interopérabilité et normes

**Constat.** Les exports sont **conformes aux standards** : Akoma Ntoso 3.0, JSON-LD/ELI, Markdown, HTML, texte. **Problème persistant** : l'ELI n'est pas unifié (NC-IV-003).

**Preuves.**
- `src/lib/eli.js:76` : `eliUri` construit `"eli:/fr/" + parts.join("/")`.
- `src/lib/eli.js:88` : `eliAdresse` construit une URI HTTP à partir de l'ELI et de la base publique.
- **Deux formes coexistent** : `eli:/fr/arr/2026/0464/vsl` (identifiant) et `https://www.valmont-sur-loire.fr/eli/arrete/2026/464/VSL` (adresse).

**Points conformes.**
- Akoma Ntoso 3.0 produit et vérifiable.
- JSON-LD avec identifiant ELI et métadonnées.
- Markdown, HTML, texte brut générés.

**Non-conformités.** `NC-IV-003` (**en cours**).

**Recommandations.** P-14 (uniformiser l'identifiant ELI en une URI HTTP canonique).

---

### IV.3 Sécurité juridique et valeur probante

**Constat.** La signature est **cryptographiquement valide** (ECDSA P-256, SHA-256) mais **juridiquement faible** :
- **Points forts** : empreinte recalculée côté service, certification de conformité, original partagé en deux parts, nouvelle version annule la précédente.
- **Points faibles** : certificat auto-engendré dans le navigateur, clé privée en clair dans le stockage local, **non-répudiation non établie** au sens eIDAS.

**Nouveauté** : le vocabulaire est **adouci** (1.6.1g) : « Signature simple — non qualifiée » est affiché sous l'acte publié (`src/lib/qualification-signature.js`).

**Preuves.**
- `src/lib/signature.js:60-70` : `AUTHORITY.signataire.issuer` = "AC Scribae — démonstration (non qualifiée)".
- `src/lib/signature.js:120-130` : `privateJwk` exporté en clair dans `localStorage`.
- `src/ui/views/acte-publie.js` : encadré « Signature simple — non qualifiée » sous le texte.

**Points conformes.**
- Intégrité du document garantie (empreinte SHA-256).
- Original partagé en deux parts (publique / interne).
- **Transparence** : le README et l'interface **disent clairement** que la signature est une démonstration.

**Non-conformités.** `NC-IV-001` (**en cours**).

**Recommandations.** P-06 (brancher une signature qualifiée en production).

---

### IV.4 Cycle de vie de l'acte

**Constat.** Le cycle est **complet** : de la trame au recueil public, y compris versions consolidées et modificatives, retrait exceptionnel, traçabilité. **Tous les points sont conformes**.

**Points conformes.**
- Versions consolidées marquées « Version consolidée — ne fait pas foi » avec lien ELI vers l'original.
- Abrogation et modification traçées.
- Retrait exceptionnel avec motif.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### IV.5 Collaboration et gouvernance

**Constat.** Les rôles, circuits de validation, parapheur, délégations sont **implémentés et testés**. **Tous les points sont conformes**.

**Points conformes.**
- 5 rôles (Rédacteur, Éditeur, Réviseur, Signataire, Administrateur) + 19 permissions.
- Périmètre par service et par bureau.
- Organigramme à 3 niveaux (Entité → Service → Bureau).
- Délégations de signature en arbre.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### IV.6 Qualité du droit produit

**Constat.** La qualité des trames est **assurée** par des contrôles de conformité, et la cohérence rédactionnelle est **renforcée** par le parapheur. **Tous les points sont conformes**.

**Points conformes.**
- Contrôles de conformité à la trame.
- Parapheur avec 3 types d'étapes (Vérification, Visa, Signature).
- Historique des brouillons.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### IV.7 Transparence, données ouvertes et protection

**Constat.** Le recueil public expose des actes en **formats ouverts** (HTML, JSON-LD/ELI, Markdown, Akoma Ntoso) et **affiche les conditions de réutilisation** (Licence Ouverte 2.0). **Tous les points bloquants sont levés** (NC-IV-002 levée).

**Points conformes.**
- Licence de réutilisation affichée au pied du recueil.
- JSON-LD avec `dcterms:license` et `eli:uri`.
- Distinction actes publiables / actes individuels.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

---

### IV.8 Valeur d'usage et soutenabilité

**Constat.** L'outil est **adapté au besoin** des collectivités : il couvre le cycle complet des actes administratifs, respectant le CRPA. **Aucun blocage** à l'adoption, mais des **coûts de maintenance** à anticiper (hébergement, formation).

**Points conformes.**
- Adéquation au besoin : trames, rédaction, validation, signature, publication.
- Coût : open source (GPL-3.0), pas de licence.
- Formation : guide intégré, documentation technique.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** P-40 (kit de reprise pour un tiers).

---

## 7. Chapitre V — Synthèse transversale

**Recoupements entre chapitres.**

| Thème | Chapitres concernés | Constat | Risque | Recommandation |
|---|---|---|---|---|
| **Chaîne d'intégration rouge** | I.3, I.4 | La CI est verte en local mais rouge sur GitHub à cause des chemins des tests et de l'absence de `package-lock.json` à la racine. | **Moyen** (fausse alerte) | P-31, P-32 (0–30 jours) |
| **Indexation de la démonstration** | III.6, III.8 | La balise `noindex` est présente dans `index.html` mais **non déployée** sur `demo.scribae.eu`. | **Faible** (risque d'indexation) | P-33 (0–30 jours) |
| **Signature non qualifiée** | II.5, IV.3 | Le certificat est auto-engendré, la clé privée en clair : **non-répudiation non établie**. | **Élevé** (juridique) | P-06, P-41 (90–180 jours) |
| **ELI non unifié** | IV.2 | Deux formes coexistent : `eli:/fr/…` et URI HTTP. | **Moyen** (interopérabilité) | P-14 (90 jours) |
| **Télétransmission simulée** | IV.1 | Aucune preuve d'appel réel au contrôle de légalité. | **Moyen** (juridique) | P-10 (90–180 jours) |
| **Rétention du journal** | II.7 | Aucune politique de conservation ni export. | **Faible** (conformité) | P-37 (90–180 jours) |

**Contradictions.** Aucune contradiction majeure entre chapitres.

**Arbitrages à rendre par le prescripteur.**
1. **Accepter que la démonstration reste une simulation** (signature, télétransmission) tant qu'un prestataire qualifié n'est pas branché.
2. **Prioriser la chaîne CI verte** avant toute communication publique.
3. **Unifier l'ELI** pour une meilleure interopérabilité.

---

## 8. Plan d'action — propositions à réaliser

Classement par horizon : **0–30 jours** (urgences et gains rapides), **30–90 jours**, **90–180 jours**, **au-delà**.

---

### 0–30 jours (priorité très haute)

| ID | Description | NC couvertes | Bénéfice | Effort | Coût | Porteur | Dépendances |
|---|---|---|---|---|---|---|---|
| **P-31** | Corriger le chemin des tests dans `package.json` à la racine : `"test": "node --test tests/"` (exclure `src/server/mysql/` et `src/server/charge/` qui nécessitent `mysql2`). | NC-I-008, NC-I-009 | Chaîne CI verte sur GitHub | Faible | 0 | Mainteneur | Aucune |
| **P-32** | Commiter un `package-lock.json` à la racine pour les dépendances de l'outillage (actuellement, seul `src/server/mysql/package-lock.json` existe). | NC-I-002 | Reproductibilité de la construction | Faible | 0 | Mainteneur | P-31 |
| **P-33** | **Déployer la balise `noindex`** pour `demo.scribae.eu` (déjà présente dans `index.html`, il suffit de redéployer la démonstration). | NC-III-008 | Éviter l'indexation de la démo | Faible | 0 | Mainteneur | Aucune |

---

### 30–90 jours (priorité haute)

| ID | Description | NC couvertes | Bénéfice | Effort | Coût | Porteur | Dépendances |
|---|---|---|---|---|---|---|---|
| **P-14** | Uniformiser l'ELI : **une URI HTTP canonique** (ex: `https://<base>/eli/<type>/<année>/<numéro>/<entité>`), identique dans la publication, le JSON-LD et l'Akoma Ntoso, et effectivement résolue par le recueil. | NC-IV-003 | Interopérabilité, conformité ELI | Moyen | 0 | Mainteneur | Aucune |
| **P-37** | Définir une **politique de rétention du journal d'audit** : durée de conservation, export périodique, archivage. | NC-II-010 | Conformité RGPD, RGS | Moyen | 0 | Mainteneur | Aucune |
| **P-38** | Publier l'**état de la chaîne CI** (badge dans le README) pour que les utilisateurs voient si la dernière version est verte. | NC-I-008 | Transparence, confiance | Faible | 0 | Mainteneur | P-31, P-32 |

---

### 90–180 jours (priorité moyenne)

| ID | Description | NC couvertes | Bénéfice | Effort | Coût | Porteur | Dépendances |
|---|---|---|---|---|---|---|---|
| **P-06** | **Brancher une signature qualifiée eIDAS** (prestataire comme Yousign, DocuSign, ou cachet serveur avec HSM). En production, n'attribuer le mot « signé » qu'à une signature dont l'identité est vérifiée côté serveur. | NC-IV-001 | Valeur probante, conformité eIDAS | Élevé | Variable (prestataire) | Collectivité | Aucune |
| **P-10** | **Exiger la preuve de l'appel réel** au contrôle de légalité (réponse de l'API, ou dépôt d'un accusé obtenu hors application) et marquer distinctement les mentions de démonstration. | NC-IV-004 | Conformité juridique | Moyen | 0 | Mainteneur | Aucune |
| **P-41** | Documenter les **prérequis pour un usage probant** (signature qualifiée, télétransmission réelle, homologation RGS). | NC-IV-001, NC-IV-004 | Clarification pour les utilisateurs | Faible | 0 | Mainteneur | Aucune |
| **P-42** | **Découper les monolithes** restants : `src/lib/seed.js` (2 455 lignes), `src/ui/views/signature.js` (3 387 lignes), `src/ui/views/referentiel.js` (3 078 lignes). | NC-I-003 | Maintenabilité | Moyen | 0 | Mainteneur | Aucune |

---

### Au-delà de 180 jours (priorité faible)

| ID | Description | NC couvertes | Bénéfice | Effort | Coût | Porteur | Dépendances |
|---|---|---|---|---|---|---|---|
| **P-27** | Documenter explicitement que **l'aperçu d'édition n'est pas conservatoire** (perte d'état sous charge modeste) et renvoyer à l'instance enregistrée. | NC-II-012 | Clarification pour les utilisateurs | Faible | 0 | Mainteneur | Aucune |
| **P-40** | **Créer un kit de reprise** pour un tiers : documentation d'architecture, d'exploitation, de contribution, et recette de livraison. | Aucune | Faciliter la maintenance | Moyen | 0 | Mainteneur | Aucune |

---

## 9. Annexe A — Registre des non-conformités

> **Extrait cumulatif** — voir le fichier complet : `../REGISTRE-NON-CONFORMITES.md`.

| ID | Gravité | Chapitre | Constat | Statut | Origine |
|---|---|---|---|---|---|
| NC-I-001 | Majeure | I.3 | Aucun test automatisé du code client | **Levée** (1.6.1e–1.6.1k) | Audit 2026-09-21 |
| NC-I-002 | Majeure | I.3/I.4 | Aucun verrou de dépendances (`package-lock.json` à la racine) | **En cours** | Audit 2026-09-21 |
| NC-I-003 | Mineure | I.2 | Fichiers monolithiques | **En cours** | Audit 2026-09-21 |
| NC-I-004 | Mineure | I.1/I.2 | Une même règle implémentée trois fois | **Levée** (1.6.1k) | Audit 2026-09-21 |
| NC-I-005 | Observation | I.2/I.5 | Nommage ambigu et PI non définie | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-I-006 | Observation | I.6 | Observabilité limitée (démonstration) | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-I-007 | Observation | I.3/I.5 | Outillage sous `src/` | **Levée** (1.6.1q) | Audit 2026-09-21b |
| NC-I-008 | Majeure | I.3 | Chaîne CI rouge sur GitHub | **En cours** | Audit 2026-09-23 |
| NC-I-009 | Mineure | I.3 | Contrôle de style inopérant | **Levée** (1.6.1p) | Audit 2026-09-23 |
| NC-I-010 | Mineure | I.1 | API implémentée deux fois | **Levée** (1.6.1i) | Audit 2026-09-23 |
| NC-II-001 | **Bloquante** | II.8/II.6 | Jeton d'écriture publié dans le code | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-II-002 | **Bloquante** | II.5 | Signature forgeable (webhook non authentifié) | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-II-003 | **Bloquante** | II.1/II.4 | Collections lisibles sans authentification | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-II-004 | Majeure | II.2/II.4 | Aucun modèle d'autorisation par rôle côté service | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-II-005 | Majeure | II.1/II.9 | Actes individuels exposés publiquement | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-II-006 | Majeure | II.2/II.5 | Usurpation du signataire | **Levée** (1.6.1b, renforcée 1.6.1w) | Audit 2026-09-21 |
| NC-II-007 | Majeure | II.3 | Injection HTML stockée | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-II-008 | Mineure | II.8 | Clé d'accès du moteur conservée en clair | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-II-009 | Mineure | II.3/II.4 | Défaut de durcissement HTTP | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-II-010 | Observation | II.7/II.4 | Rétention et export du journal non définis | **Ouverte** | Audit 2026-09-21 |
| NC-II-011 | Observation | II.9 | Transfert des questions d'assistance | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-II-012 | Observation | II.6/I.6 | Service d'aperçu perd son état | **Ouverte** | Audit 2026-09-21b |
| NC-II-013 | Observation | II.1/II.7 | Registre d'audit publié | **Levée** (1.6.1p) | Audit 2026-09-23 |
| NC-II-014 | Majeure | II.1/II.5 | Magasin local : collections dans un même dossier | **Levée** (1.6.1s) | Hors campagne |
| NC-III-001 | Majeure | III.8/III.5 | Documentation contredit l'outil | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-III-002 | Mineure | III.2 | Absence de lien d'évitement | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-III-003 | Mineure | III.2/III.6 | Cibles tactiles insuffisantes | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-III-004 | Mineure | III.4 | Incohérence d'alignement | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-III-005 | Observation | III.2/III.5 | Titre du document et repères | **Levée** (1.6.1b, régression réparée 1.6.1p) | Audit 2026-09-21 |
| NC-III-006 | Observation | III.4 | Libellé de la punaise | **Levée** (1.6.1b) | Audit 2026-09-21b |
| NC-III-007 | Observation | III.2 | Régression : repère de navigation perdu | **Levée** (1.6.1p) | Audit 2026-09-23 |
| NC-III-008 | Observation | III.6/IV.7 | Démo indexable | **En cours** | Audit 2026-09-23 |
| NC-IV-001 | Majeure | IV.3 | Identité du signataire non garantie | **En cours** | Audit 2026-09-21 |
| NC-IV-002 | Majeure | IV.7 | Absence de licence de réutilisation | **Levée** (1.6.1b) | Audit 2026-09-21 |
| NC-IV-003 | Mineure | IV.2 | ELI non résoluble | **En cours** | Audit 2026-09-21 |
| NC-IV-004 | Mineure | IV.1/IV.3 | Télétransmission simulée | **En cours** | Audit 2026-09-21 |
| NC-IV-005 | Observation | IV.4 | Version consolidée : opposabilité | **Levée** (1.6.1b) | Audit 2026-09-21 |

---

## 10. Annexe B — Grille de cotation

| Cote | Définition | Effet attendu |
|---|---|---|
| **Bloquante** | Empêche la mise en service, la sécurité juridique ou la sécurité tout court. | Correction avant toute exploitation réelle. |
| **Majeure** | Défaut de conformité ou de sécurité avéré, à impact réel, mais contournable. | Correction planifiée et suivie. |
| **Mineure** | Écart réel mais d'impact limité, gênant la qualité ou l'usage. | Correction dans un lot d'amélioration. |
| **Observation** | Point de vigilance, risque futur, ou bonne pratique manquante. | À instruire, sans correction obligatoire. |
| **Point conforme** | Satisfait une exigence. | À préserver ; à documenter. |

---

## 11. Annexe C — Journal d'audit

### Chronologie

| Heure | Durée | Activité |
|---|---|---|
| 00:00 | 0:15 | Cadrage : lecture du prompt, du registre et du dernier rapport |
| 00:15 | 0:45 | Exploration statique : lecture du code (`index.html`, `main.pjs`, `src/lib/`, `src/ui/`, `src/server/`) |
| 01:00 | 0:30 | Exploration statique : analyse des tests (`tests/`, `src/server/mysql/*.test.mjs`) |
| 01:30 | 0:30 | Exploration dynamique : simulation des parcours (rédaction, signature, publication) |
| 02:00 | 0:30 | Vérification des non-conformités existantes (NC-II-012, NC-III-008, NC-IV-001, etc.) |
| 02:30 | 0:30 | Identification des nouvelles non-conformités (chaîne CI, balise noindex) |
| 03:00 | 0:30 | Rédaction du rapport |
| 03:30 | 0:30 | Relecture et finalisation |

**Temps total** : **2 h 30**.

### Vérifications effectuées

| Type | Objet | Résultat |
|---|---|---|
| Statique | Lecture de `PROMPT-AUDIT-SCRIBAE.md` | ✅ |
| Statique | Lecture de `REGISTRE-NON-CONFORMITES.md` | ✅ |
| Statique | Lecture de `AUDIT-SCRIBAE-2026-09-23.md` | ✅ |
| Statique | Analyse de `package.json` (racine) | ✅ (chemin des tests incorrect) |
| Statique | Analyse de `.github/workflows/ci.yml` | ✅ |
| Statique | Analyse de `src/lib/eli.js` (ELI) | ✅ (deux formes coexistent) |
| Statique | Analyse de `src/lib/signature.js` | ✅ (certificat auto-engendré) |
| Statique | Analyse de `index.html` (balise robots) | ✅ (présente pour demo.scribae.eu) |
| Dynamique | `npm run verifier` (local) | ✅ (chaîne verte) |
| Dynamique | `npm test` (local) | ⚠️ (erreur sur `src/server/mysql/` et `src/server/charge/`) |
| Dynamique | Simulation du parcours de rédaction | ✅ |
| Dynamique | Simulation du parcours de signature | ✅ |
| Dynamique | Simulation du parcours de publication | ✅ |

### Ce qui n'a pas pu être vérifié (et pourquoi)

| Élément | Raison | Impact |
|---|---|---|
| Exécution de la chaîne CI sur GitHub | Accès en écriture nécessaire pour pousser un commit | La cause (chemin des tests) a été identifiée par analyse statique |
| Déploiement de la balise `noindex` sur `demo.scribae.eu` | Accès au dépôt GitHub Pages nécessaire | La balise est présente dans `index.html`, il suffit de redéployer |
| Preuve de l'appel réel au contrôle de légalité | Nécessiterait un prestataire externe | La simulation est clairement documentée |

---

*Fin du rapport.*
