---
titre: Audit Scribae — 2026-09-23
version_outil: 1.6.0
duree: 1 h 45
chapitres: 4
non_conformites: 36 (bloquantes 3, majeures 10, mineures 11, observations 12)
points_conformes: 114
propositions: 13
registre: src/audit/REGISTRE-NON-CONFORMITES.md
precedent: src/audit/rapports/AUDIT-SCRIBAE-2026-09-21b.md
---

# Audit Scribae — 3e campagne

> **Document de travail — un audit constate, il ne certifie pas.** Ce rapport ne corrige rien : il
> relève, prouve et propose. Les non-conformités qu'il établit sont suivies dans le **registre
> cumulatif** (`../REGISTRE-NON-CONFORMITES.md`), où leur **statut évolue** d'une campagne à
> l'autre — une fiche lue ici peut être **levée depuis**, ou au contraire encore **ouverte**. Les
> termes employés (gravité, cotation, preuve, contrat de sortie) sont définis par le cadre :
> `../PROMPT-AUDIT-SCRIBAE.md`.

## 1. En-tête

| Champ | Valeur |
|---|---|
| Date de la campagne | 2026-09-23 |
| Version auditée | **1.6.0** (`src/lib/version.js`), publiée sur GitHub le 2026-09-23 (envoi `efaade3`), avec deux notes intermédiaires déjà écrites : `1.6.1a` (démarrage du service) et `1.6.1b` (mention de l'éditeur, adresse de la démonstration) |
| Cibles | le dépôt `github.com/aplds/scribae` (copie publiée), la démonstration `https://demo.scribae.eu` (GitHub Pages), l'application à l'exécution dans l'aperçu, l'intégralité de `src/` (231 fichiers, 114 314 lignes, 8,5 Mo) |
| Méthode | cadre `PROMPT-AUDIT-SCRIBAE.md` §5 : cadrage, exploration statique (lecture, mesures, empreintes), exploration dynamique (parcours, mesures à l'écran, captures), instruction, rédaction, restitution |
| Durée | **1 h 45** (voir Annexe C) |
| Auditeurs | quatre regards : DSI (I), RSSI (II), qualiticien (III), DAJ/assemblées (IV) |
| Pièces | `src/audit/REGISTRE-NON-CONFORMITES.md` (36 fiches) ; rapport précédent `rapports/AUDIT-SCRIBAE-2026-09-21b.md` |
| Ce que cette campagne ajoute | la première campagne regardait un outil ; celle-ci regarde un **logiciel publié** — dépôt public, démonstration en ligne, chaîne d'intégration — que son auteur s'apprête à **faire connaître** |

> **Lecture.** Le rapport est un document de travail : il constate et propose, il ne corrige rien.
> Les non-conformités portent un identifiant **stable** (`NC-<chapitre>-<numéro>`) : une fiche
> ouverte le 2026-09-21 garde son identifiant ici, avec son statut revérifié.

---

## 2. Synthèse pour la direction

**Appréciation générale.** Scribae 1.6.0 n'est plus un prototype : c'est un logiciel cohérent, documenté
(3 452 lignes de notes de développement, 3 425 de spécification, un guide intégré de 29 chapitres), dont
les parties pures sont désormais **testées** (226 épreuves), dont la licence est tranchée (GPL-3.0 +
Licence Ouverte 2.0), et qui sait se déployer de deux façons (démonstration statique, service
auto-hébergé nginx + Node + MariaDB). Aucune non-conformité **bloquante** n'est ouverte : les trois de
la première campagne sont levées et revérifiées.

Le changement de nature de cette campagne est ailleurs : **l'outil devient public**. Les trois constats
qui comptent ne portent donc pas sur des fonctions, mais sur ce qui entoure la publication :

1. **la mécanique de contrôle est cassée** : la chaîne d'intégration livrée est rouge depuis sa mise en
   service (4 envois, 4 échecs), et le contrôle de style échoue sur son propre code — donc ne contrôle
   rien (NC-I-008, NC-I-009) ;
2. **la valeur probante de la signature reste une démonstration** : certificat auto-engendré dans le
   navigateur, clé privée conservée en clair, télétransmission simulée qui fabrique son certificat
   (NC-IV-001, NC-IV-004) — c'est écrit dans le README public, ce qui est honnête, mais doit le rester
   partout ;
3. **le dépôt publie son propre registre d'audit**, fiches ouvertes comprises (NC-II-013) : excellent
   signe de sérieux pour un lecteur attentif, matière à citation à contresens pour un lecteur pressé.

**Note par chapitre** (appréciation d'auditeur, non une mesure) :

| Chapitre | Note | Ce qui la fonde |
|---|---|---|
| I — Systèmes d'information | **6 / 10** | architecture claire, modules purs, tests en progrès ; mais chaîne rouge, pas de verrou de dépendances, monolithes, API implémentée deux fois |
| II — Sécurité | **8 / 10** | aucune non-conformité bloquante ouverte : secrets hors du code, rôles côté serveur, webhook authentifié, XSS fermée, journal scellé ; restent la valeur probante de la signature et la rétention du journal |
| III — Qualité, accessibilité, expérience | **8,5 / 10** | recueil public complet, contrastes mesurés, absence de débordement à 390 px, cibles tactiles conformes, 29 chapitres de guide ; une régression de repère de navigation et une démonstration indexable |
| IV — Conformité et valeur juridique | **7 / 10** | le cycle réglementaire est trait pour trait couvert (publicité, opposabilité, transmission, abrogation, versions) ; l'ELI reste à unifier et les signaux forts (signature, télétransmission) sont des simulations annoncées |

**Les dix risques majeurs.**

| # | Risque | Fiche |
|---|---|---|
| 1 | La chaîne d'intégration ne garantit rien (rouge sur 4 envois sur 4) : un échec réel ne se distinguerait pas du bruit | NC-I-008 |
| 2 | Le contrôle de style ne s'applique pas à la disposition livrée : il échoue sur lui-même et n'exempte plus le service | NC-I-009 |
| 3 | Aucun verrou de dépendances (`package-lock.json`) : la reproductibilité de la construction n'est pas assurée | NC-I-002 |
| 4 | L'identité du signataire n'est pas garantie (certificat auto-engendré, clé privée locale) : la non-répudiation n'est pas établie | NC-IV-001 |
| 5 | Le certificat de télétransmission au contrôle de légalité est produit localement (simulation) | NC-IV-004 |
| 6 | L'ELI n'est pas unifié (identifiant `eli:/fr/…` et adresse HTTP coexistent) : interopérabilité à consolider | NC-IV-003 |
| 7 | La rétention et l'export du journal d'audit ne sont pas définis | NC-II-010 |
| 8 | La démonstration publiée est indexable par les moteurs, alors que son jeu de données est fictif | NC-III-008 |
| 9 | Le registre d'audit est public, fiches ouvertes comprises | NC-II-013 |
| 10 | La reprise par un tiers est freinée : monolithes (3 609 / 3 452 / 3 425 / 3 336 lignes), duplication de règles, API écrite deux fois | NC-I-003, NC-I-004, NC-I-010 |

**Trajectoire recommandée.** Avant de faire connaître Scribae : **rendre la chaîne verte** (corriger le
chemin d'exemption, instruire l'échec du travail « Service auto-hébergé », commiter un verrou de
dépendances) et **maîtriser l'indexation** de la démonstration. Puis, sans urgence mais sans relâche :
les épreuves de parcours, la rétention du journal, la reprise du repère de navigation. Les gros
chantiers — unification de l'ELI, certificat de signature qualifié, transmission réelle, découpage des
monolithes — appartiennent à l'horizon 90–180 jours et n'empêchent pas une démonstration publique
honnête, à condition que chaque chose soit nommée pour ce qu'elle est : c'est le cas aujourd'hui dans
le README et dans l'application (bandeau « DÉMONSTRATION », mentions de simulation), et c'est ce qui
doit le rester.

---

## 3. Chapitre I — Systèmes d'information (DSI)

*Posture : informaticien sénior, hostile au « vibe coding ». La question posée est : peut-on reprendre
ce logiciel dans dix ans, avec une équipe, sans l'auteur ?*

### I.1 Architecture et découpage

**Constat.** Le découpage est lisible et tenu : `src/lib/` (domaine pur, sans DOM ni réseau),
`src/ui/` (interfaces), `src/lib/db/` (contrat de persistance + deux pilotes : local IndexedDB,
service), `src/server/` (service auto-hébergé), `index.html` (service de démonstration), `main.pjs`
(configuration). Les modules purs sont majoritaires et importables hors navigateur — c'est ce qui rend
les tests possibles. Deux entorses : l'API est **écrite deux fois** (démonstration et service
auto-hébergé), et `index.html` mêle, dans un même fichier, le document, l'amorçage et une
implémentation complète du service.

**Points conformes.**
- Séparation franche entre le domaine (`src/lib/`) et les interfaces (`src/ui/`) : aucun module de `src/lib/` n'importe `src/ui/`.
- Contrat de persistance explicite (`src/lib/db/contract.js`) avec deux pilotes interchangeables — c'est ce qui permet la même interface en démonstration et en production.
- Le domaine du service est **extrait et testable** : `createActesApi({ state, sha256, save, now })` (`src/server/mysql/actes.mjs`) reçoit sa persistance, son horloge et son empreinte en paramètres.
- Aucune dépendance à un framework : le rendu passe par `src/ui/dom.js` (`h`), ce qui rend l'ensemble inspectable sans outillage.

**Non-conformités.** `NC-I-010` (l'API implémentée deux fois), `NC-I-004` (trois règles réécrites),
`NC-I-003` (monolithes).

**Recommandations.** Extraire le domaine du service de démonstration pour que `index.html` ne soit plus
qu'un adaptateur, ou — à moindre coût — écrire une **épreuve de conformité** qui joue le même jeu
d'appels contre les deux implémentations (P-37).

### I.2 Qualité et lisibilité du code

**Constat.** Le code est régulier, commenté en français, et les commentaires expliquent le *pourquoi*
(parti pris visible dans tout `src/`). La taille des fichiers reste le point faible : `src/css/app.css`
3 609 lignes, `src/README.md` 3 452, `src/SPEC.md` 3 425, `src/ui/views/signature.js` 3 336,
`src/ui/views/referentiel.js` 3 078.

**Points conformes.**
- Aucun `debugger` dans le code livré, aucune syntaxe fautive : 179 fichiers JavaScript analysés, tous **parsables** (analyse de cette campagne).
- Les outils de contrôle sont écrits sans dépendance tierce (`src/scripts/verifier-syntaxe.mjs`, `verifier-style.mjs`) : rien à auditer dans la chaîne d'approvisionnement de l'outillage.

**Non-conformités.** `NC-I-003` (monolithes), `NC-I-004` (duplication : `sansInterne`,
`sha256Hex`, `partiePublique`).

**Recommandations.** Traiter le découpage comme un remboursement progressif : premier découpage sur
`src/css/app.css` (feuilles par domaine) et sur `src/ui/views/signature.js` (déjà subdivisé en
sous-modules) ; remplacer les trois règles dupliquées par un module commun (P-42).

### I.3 Environnements, tests, industrialisation

**Constat.** C'est le chantier le plus avancé et, en même temps, le plus trompeur. Les tests existent
(16 fichiers, 226 épreuves) et la chaîne existe (`.github/workflows/ci.yml`, deux travaux) — mais
**elle est rouge depuis sa mise en service** : les 4 envois sur `main` ont échoué, et le contrôle de
style échoue pour une raison reproductible qui tient au **chemin** de ses fichiers (NC-I-009).

**Points conformes.**
- 16 fichiers de tests, **226 épreuves**, exécutables hors navigateur (`node --test`, `src/package.json`) ; **35 épreuves** dans `src/tests/` (dont 19 pour le seul fichier des modules purs), **163** pour le domaine du service et **28** pour la charge ; le pilote de persistance a les siennes (8, vérifiées seules).
- Un banc de charge existe (`src/server/charge/`) avec des profils nommés (afflux, saturation, distance) et des briques de faux MySQL : rare à ce stade d'un projet.
- La livraison est **reproductible à la main** : l'export du dépôt suit une recette écrite (liste de fichiers racine, empreintes des images Docker épinglées, `mysql2` fixé à `3.11.3`).

**Non-conformités.** `NC-I-008` (chaîne rouge), `NC-I-009` (contrôle de style inopérant),
`NC-I-002` (verrou de dépendances absent).

**Recommandations.** P-31 (rendre la chaîne verte), P-32 (verrou + `npm ci`), P-38 (publier l'état de la
chaîne).

### I.4 Dépendances et chaîne d'approvisionnement

**Constat.** Les dépendances sont rares et identifiées : 5 greffons Perchance déclarés en tête de
`main.pjs` (`kv`, `server`, `super-fetch`, `upload`, `ai-text`), `mysql2` côté serveur, aucune
bibliothèque de rendu. Le point faible n'est pas le nombre mais la **traçabilité** : aucun verrou.

**Points conformes.**
- Cinq greffons, tous déclarés et commentés dans `main.pjs` avec la raison de leur présence.
- Images Docker épinglées par empreinte ; `mysql2` fixé à une version exacte.
- Aucune bibliothèque tierce dans le contrôle qualité (analyse écrite à la main).

**Non-conformités.** `NC-I-002` (verrou de dépendances absent).

**Recommandations.** P-32.

### I.5 Gouvernance du code

**Constat.** La gouvernance est étonnamment mature pour un projet de cette taille : version unique
(`src/lib/version.js`), journal des versions en 2 881 lignes, convention de **notes intermédiaires**
(lettres) documentée et respectée, licence tranchée, mentions d'héritage (l'IA a produit du code,
c'est dit). La chaîne de contrôle est en revanche défaillante (I.3).

**Points conformes.**
- Source unique du numéro de version, avec la règle écrite « la première entrée datée sans lettre du journal doit y correspondre ».
- Journal des versions tenu depuis la 1.3.0, entrées datées, rubriques normalisées, entrées anciennes jamais réécrites.
- Licence explicite (GPL-3.0-only pour le logiciel, Licence Ouverte 2.0 pour les données) et fichier `LICENSE` à la racine du dépôt.

**Non-conformités.** `NC-I-002`, `NC-I-008` (gouvernance sans contrôle mécanique).

**Recommandations.** P-31, P-38.

### I.6 Exploitation

**Constat.** L'exploitation est documentée (installation Docker, variables, sauvegardes, migration
depuis la démonstration) et la démonstration est explicitement présentée comme **non conservatoire**.
L'observabilité reste celle d'un service de démonstration : un journal d'audit scellé, un état de
santé, des quotas — pas de métriques ni d'export.

**Points conformes.**
- Journal d'audit append-only scellé par chaîne SHA-256, lisible par l'administration (`GET /v1/journal`).
- Quotas et éviction (`MAX_PUBLIES`, `MAX_ACTES`, `MAX_CHARS`) : un service de démonstration ne peut pas être saturé par accident.
- Documentation d'exploitation complète (`src/docs/ADMINISTRATION.md` 1 855 lignes, `src/server/README.md`, `docs/DOCKER.md`).

**Non-conformités.** `NC-II-010` (rétention et export du journal non définis), `NC-I-006` (levée :
la démonstration est présentée comme non conservatoire).

**Recommandations.** P-37.

### I.7 Souveraineté, hébergement, réversibilité

**Constat.** Le logiciel est **réversible par construction** : le domaine ne dépend d'aucun service
tiers, la persistance a deux pilotes, les données s'exportent (JSON du référentiel, paquets d'actes),
et l'auto-hébergement complet est fourni (nginx + Node + MariaDB). La dépendance à la plateforme
Perchance est réelle mais **non captive** : le dépôt publié tourne seul sur GitHub Pages et sur un
serveur, ce que cette campagne a vérifié.

**Points conformes.**
- Deux modes de déploiement indépendants de Perchance : statique (GitHub Pages) et serveur (Docker Compose).
- Aucune donnée ne part chez un tiers sans décision : les assistants passent par un moteur activé explicitement, et les questions envoyées sont documentées (`docs/ADMINISTRATION.md` § 5.5ter).
- Les actes publiés sortent dans des formats ouverts et normés (Akoma Ntoso, ELI, JSON-LD, Markdown, texte), donc lisibles sans Scribae.

**Non-conformités.** Aucune nouvelle. (Renvoi : `NC-II-011`, levée.)

**Recommandations.** P-40 (plan de sortie : ce qu'un repreneur doit savoir pour continuer sans la plateforme — à joindre à `README.md`).

### I.8 Documentation et reprise par un tiers

**Constat.** La documentation est abondante et à jour — au point qu'elle devient un monolithe. Elle
couvre l'architecture, l'exploitation, l'installation, la sécurité, la vérification et la livraison
(`src/docs/INDUSTRIALISATION.md`). Le point de friction pour un repreneur n'est pas le manque, c'est le
**volume** et la dispersion (3 452 lignes de notes de développement, 3 425 de spécification).

**Points conformes.**
- Un fichier d'entrée clair (`src/README.md`) avec table des modules et « flux de travail Perchance ↔ GitHub ».
- Un document d'industrialisation qui dit ce qui est vérifié sans navigateur, ce qui ne l'est pas, et comment livrer.
- Une documentation d'exploitation orientée exploitant (sauvegardes, restauration, incidents).

**Non-conformités.** `NC-I-003` (volume documentaire lui-même), `NC-I-007` (outillage rangé sous `src/`,
ce qui complique la lecture du dépôt).

**Recommandations.** P-42 (découpage), P-31 (que la documentation de vérification dise vrai : elle
annonce les deux contrôles, ils sont en échec).

---

## 4. Chapitre II — Sécurité des systèmes d'information (RSSI)

*Posture : raisonnement d'attaquant. Question posée : qui peut faire quoi, à qui, avec quelles données,
et qu'est-ce qui reste comme trace ?* Les deux points d'entrée du cadre (§4.2 — segmentation
démonstration/production, usurpation du signataire) sont instruits dans II.5, II.6 et II.9.

### II.1 Cartographie et classification des données

**Constat.** Les données sont classées et le classement **agit** : collections sensibles réservées,
actes individuels non publiés, publications réservées aux agents, secrets exclus des exports. La
nouveauté de cette campagne est périphérique : le **registre d'audit** lui-même est publié (NC-II-013).

**Points conformes.**
- Collections classées par sensibilité (`user`/`admin`) et lecture refusée sans clé : le référentiel n'est plus lisible par un anonyme.
- Les actes individuels (non publiables) et leurs documents exigent une clé : `GET /v1/actes` sans clé est refusé.
- Les publications réservées aux agents sont invisibles d'un visiteur anonyme (liste, recherche, `recueil.json`, `llms.txt`, `sitemap.xml`, adresse directe).
- Les secrets (clé de moteur, clés d'API) sont exclus des exports et des collections (`sansSecrets`).

**Non-conformités.** `NC-II-013` (registre public), `NC-II-012` (démonstration non conservatoire).

**Recommandations.** P-34.

### II.2 Comptes, authentification, habilitations

**Constat.** Le modèle de rôles est appliqué **côté serveur**, route par route, et vérifié : une clé
`lecteur` obtient 200 sur `/v1/actes` et 403 `role_insuffisant` sur `users`, `journal`, `cles`, le
dépôt et la synchronisation. Le contournement du contrôle de révision (`force`) est réservé à
l'administrateur et journalisé. L'usurpation du signataire — point d'entrée du cadre — est traitée
(II.5).

**Points conformes.**
- Comparaison des clés à temps constant (`egalConstant`, `index.html:323`).
- Clés tirées par le client, seule leur empreinte SHA-256 conservée côté service ; service neuf en lecture seule jusqu'au provisionnement.
- Séparation des pouvoirs : le service refuse de révoquer la dernière clé d'administration.
- Comptes locaux et annuaire (OIDC) traités, mot de passe haché, changement de mot de passe par l'agent.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** P-37 (rétention) ; rien d'autre.

### II.3 Sécurité applicative

**Constat.** Le risque d'injection HTML stockée est traité à la source : la version en ligne d'un acte
est **assainie** avant insertion, et le rendu passe par `textContent`. La revue de cette campagne n'a
pas trouvé de nouveau chemin d'injection. Le point de faiblesse n'est plus dans l'application mais
dans **ses contrôles** (NC-I-009).

**Points conformes.**
- `assainirHtml` appliqué au document publié ; vérifié à l'écran (aucun `script`, `on…`, `iframe` dans un acte publié).
- Rendu par nœuds de texte (`src/lib/render.js`) ailleurs : pas de `innerHTML` de contenu utilisateur.
- Erreurs normalisées par le service (`err(...)` avec code), sans fuite de trace technique.

**Non-conformités.** `NC-I-009` (le contrôle de style qui échoue n'exempte plus le service : dérive de l'outillage, pas faille d'exécution).

**Recommandations.** P-31.

### II.4 Sécurité de l'API

**Constat.** L'API est classée par rôle, borne ses entrées (taille de document, nombre d'enregistrements,
quota de base), journalise les gestes sensibles, et **annonce** ses réponses dans une description
OpenAPI engendrée depuis la même source que la documentation. La démonstration et la production
divergent encore sur un point : la première ne voit pas l'adresse de l'appelant (la restriction
d'accès à l'atelier y est simulée).

**Points conformes.**
- Réservation de routes par rôle, `401`/`403` explicites, codes d'erreur stables.
- Idempotence des envois (`Idempotency-Key`) et des webhooks.
- Limitation de débit (`rate`), bornes de taille (`413`), quota de base (`507`).
- Référence d'API engendrée (`src/scripts/generer-api.mjs` → `docs/API.md`, 1 824 lignes) : document et application ne peuvent pas se contredire.

**Non-conformités.** Aucune nouvelle. (Renvoi : `NC-II-010`, rétention.)

**Recommandations.** P-37.

### II.5 Signature, intégrité et non-répudiation

**Constat.** Le circuit est solide **en intégrité** et reste faible **en identité**. Le webhook du
prestataire exige une clé authentifiée, l'empreinte est recalculée côté service, une nouvelle version
signée annule la certification précédente, la compétence du signataire est vérifiée et l'opérateur est
tracé. Mais le certificat du signataire est engendré dans le navigateur, la clé privée est conservée en
clair dans l'enregistrement local, et le circuit externe certifie une conformité **déclarée** : la
non-répudiation n'est pas établie au sens du règlement eIDAS.

**Points conformes.**
- Webhook authentifié (clé `prestataire`/`administrateur`) ; toute notification sans clé est refusée — vérifié.
- Le service recalcule l'empreinte du document signé et refuse toute divergence (`409`), y compris pour la pièce PDF du circuit externe.
- La certification de conformité porte sur l'empreinte de la version signée : une empreinte différente est refusée (`409 certification_incoherente`).
- L'original est partagé en deux parts (publique / interne) : les mentions nominatives ne sont pas diffusées.
- Une nouvelle version signée **annule** la certification précédente (pas de certification héritée).

**Non-conformités.** `NC-IV-001` (identité du signataire), `NC-IV-004` (télétransmission simulée).

**Recommandations.** P-41.

### II.6 Segmentation des environnements

**Constat.** La distinction démonstration / production est désormais **outillée** (commutateur `DEMO`,
`AUTH_MODE`, valeurs par défaut sûres, `.env`), et documentée. Le point d'entrée du cadre (« frontières
floues ») est donc traité pour la configuration ; il reste vrai pour le **code** (API écrite deux fois,
NC-I-010) et pour la **démonstration** (état non conservatoire, NC-II-012).

**Points conformes.**
- Valeurs par défaut sûres : `AUTH_MODE=password`, `CORS_ORIGINS` vide, en-têtes de sécurité dans la façade nginx (`frame-ancestors 'self'`).
- Le jeu de démonstration s'éteint (`DEMO=false`) : le référentiel part vierge, sans trace de la collectivité fictive.
- Restrictions d'accès à l'atelier par liste d'adresses, décidées par le service (et non par le client).

**Non-conformités.** `NC-II-012` (démonstration non conservatoire), `NC-I-010` (deux implémentations).

**Recommandations.** P-33, P-37.

### II.7 Journalisation, traçabilité, preuve

**Constat.** Le journal d'audit du service est append-only et **scellé** : chaque ligne porte
l'empreinte de la précédente, ce qui rend toute modification visible. Il reste sans politique de
conservation ni export.

**Points conformes.**
- Journal scellé par chaîne SHA-256, état d'intégrité affiché à l'administration (« Chaîne intègre »).
- Gestes sensibles journalisés : dépôt, ouverture de signature, notification, transmission, publication, retrait, épinglage, provisionnement, gestion des clés, et même le contournement de révision (`sync_force`).
- Le journal est tenu par le service (côté serveur), non par le poste client.

**Non-conformités.** `NC-II-010`.

**Recommandations.** P-37.

### II.8 Secrets et configuration

**Constat.** Plus aucun secret n'est publié : la clé d'écriture de la démonstration n'existe plus dans
le code servi, les clés sont tirées par le client, seule l'empreinte est conservée, et la clé du
prestataire de signature vit dans l'environnement du service. Les scripts du service sont **publics
par conception** — ce que la documentation rappelle.

**Points conformes.**
- Aucun jeton en clair dans le code servi (vérifié : `src/lib/cle-service.js` ne conserve qu'une empreinte).
- Clé du prestataire de signature hors du référentiel (`SCRIBA_SIGNATURE_API_CLE`, `.env`).
- Clé du moteur de langage conservée dans le stockage local du navigateur, exclue des exports.
- `src/server/env.example` pour décrire les variables sans les valeurs.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### II.9 Protection des données à caractère personnel

**Constat.** Le traitement est documenté (minimisation, sous-traitances, durées, art. 13/28) et l'outil
sait ne pas diffuser : deux parts d'original, actes individuels non publiés, occultation. Le point de
vigilance reste la **démonstration publique** : comptes fictifs qui s'ouvrent d'un clic, et une
installation partagée où n'importe qui peut écrire — assumé, écrit dans le README, et sans donnée réelle.

**Points conformes.**
- Deux parts d'original : mentions nominatives et trace des courriels ne quittent pas l'installation.
- Le jeu de démonstration est **entièrement fictif**, et l'application l'annonce dans un bandeau (« Ne pas produire d'actes réels avec cette installation »).
- Les sous-traitances (moteur de langage, hébergement) sont nommées avec leurs durées (`docs/ADMINISTRATION.md` § 5.5ter).
- Le rapport d'audit ne recopie ni donnée personnelle réelle ni secret (règle de cadre respectée par ce rapport).

**Non-conformités.** Aucune nouvelle. (Renvoi : `NC-II-012`.)

**Recommandations.** P-33.

### II.10 Continuité, gestion des incidents, homologation

**Constat.** Les sauvegardes et la restauration sont documentées (volumes, dumps, procédure), et
l'exploitation a ses garde-fous (quotas, refus explicites, journal). L'homologation, elle, n'est pas
engagée : c'est cohérent avec un logiciel qui n'est pas encore déployé en production par une
collectivité, et cela doit rester écrit.

**Points conformes.**
- Procédure de sauvegarde/restauration décrite dans `docs/ADMINISTRATION.md` et `src/server/README.md`.
- Un mode « hors réseau » existe côté client (`src/ui/views/hors-reseau.js`) : l'outil dit ce qu'il peut faire sans service.
- Refus explicites plutôt qu'échecs silencieux (207/409/507/422 avec codes).

**Non-conformités.** Aucune nouvelle (l'absence d'homologation est hors périmètre tant qu'aucun
déploiement réel n'est en service).

**Recommandations.** P-40 (kit de reprise), P-41 (avant tout usage probant).

---

## 5. Chapitre III — Qualité, accessibilité et expérience (qualiticien)

*Posture : minutieuse, obsédée par la cohérence. Question posée : est-ce que tout est là, accessible à
tous, et cohérent ?*

### III.1 Complétude fonctionnelle

**Constat.** La promesse du README public est tenue, fonction par fonction, jusqu'aux cas limites
(acte individuel, réservé aux agents, circuit externe, version consolidée, retrait exceptionnel).
Deux écarts : le repère de navigation de l'atelier (perdu, NC-III-007) et la démonstration indexable
(NC-III-008).

| Exigence annoncée | État | Preuve / remarque |
|---|---|---|
| Recueil public sans compte, à la racine | **Présente** | `#/recueil` : 17 actes, 9 thèmes, recherche, « À la une », thèmes, liste complète |
| Identifiant ELI par acte et adresses stables | **Présente** | « Adresse ELI (HTTP) » et « Identifiant ELI » affichés ; JSON-LD et Akoma Ntoso servis |
| Trames : préparation par les administrateurs | **Présente** | Écran « Trames », éditeur de trame, versions de trame |
| Remplissage par les services, écart tracé | **Présente** | Rédaction, écarts signalés, commentaires |
| Validation interne (parapheur) | **Présente** | Circuits, étapes, trancher, parapheur |
| Signature : électronique, simple, externe | **Présente** | Trois circuits dans l'interface et dans l'API |
| Transmission au contrôle de légalité | **Simulée, annoncée** | Certificat porteur de `demonstration: true`, badge « simulation » (NC-IV-004) |
| Publication automatique au recueil | **Présente** | Publication dès la signature pour un acte publiable |
| Bulletin (Journal) des actes | **Présente** | Rubrique, cadence, numéros, flux RSS/Atom, abonnement |
| Informations (actualités) | **Présente** | Billets, épinglage, page dédiée |
| Exports ouverts (Akoma Ntoso, Schematron, JSON-LD, A4, Word, Markdown) | **Présente** | Écran d'export et service ; formats servis par le recueil ouvert |
| Recueil ouvert (llms.txt, sitemap, robots) | **Présente en auto-hébergement** | Non annoncés sur la démonstration statique (choix explicite : `autoHeberge()`) |
| Assistants (atelier et recueil) | **Présente** | Sans moteur : recherche dans le guide/les actes ; avec moteur : rédaction |
| Guide d'utilisation intégré | **Présente** | 29 chapitres, glossaire, dépannage, impression, export HTML |
| Documentation technique dans l'application | **Présente** | Journal des versions, administration, installation, API, variables |
| Comptes, rôles, délégations, organigramme | **Présente** | Écrans dédiés, permissions par rôle |
| Annuaire (OIDC) | **Présente** | Configuration et connexion |
| API REST documentée | **Présente** | `docs/API.md` engendré + panneau de commande dans l'application |
| Licence de réutilisation affichée | **Présente** | Pied du recueil : « Réutilisation : Licence Ouverte 2.0 » |
| Mention de l'éditeur du logiciel | **Présente** | Trois pieds de page (recueil, atelier, connexion), contrastes mesurés |
| Déclaration de démonstration | **Présente** | Bandeau « DÉMONSTRATION … Ne pas produire d'actes réels » |

**Points conformes.** Les vingt et une lignes ci-dessus, chacune vérifiée à l'écran ou dans le code
pendant cette campagne (voir Annexe C).

**Non-conformités.** `NC-III-007`, `NC-III-008`.

**Recommandations.** P-33, P-36.

### III.2 Accessibilité (RGAA 4.1 / WCAG 2.1 AA)

**Constat.** Les fondamentaux sont tenus et **mesurés** : lien d'évitement, cible de contenu, titres
hiérarchisés, contrastes conformes en clair comme en sombre, cibles tactiles suffisantes, repères de
navigation nommés sur le recueil. Une régression : le repère de navigation de l'atelier.

**Points conformes.**
- Lien d'évitement « Aller au contenu » présent et cible `<main id="recueil-contenu">` ; règle de révélation au focus (`.recueil-evitement:focus`).
- Contrastes mesurés : mention de l'éditeur et texte de pied **5,74:1** (clair, sur blanc) et **6,36:1** (sombre) ; texte de tête **10,53:1** ; titres de section **16,74:1** — au-delà du seuil AA (4,5:1).
- Aucune cible tactile isolée sous 24 × 24 px sur le recueil (16 éléments plus petits, tous **liens en pleine phrase**, donc hors critère).
- Repères nommés sur le recueil : « Navigation principale du recueil », « Pages du site » ; un seul `header`/`nav`/`main`/`footer` visible (les panneaux d'assistant sont fermés, donc hors arbre d'accessibilité).
- Titre de document posé par écran (« Recueil des actes administratifs — Ville de Valmont-sur-Loire », « Trames — Ville de Valmont-sur-Loire »).
- Contour de focus défini globalement (`:focus-visible`, `src/css/app.css:117`).

**Non-conformités.** `NC-III-007` (repère de navigation de l'atelier — régression).

**Recommandations.** P-36.

### III.3 Ergonomie et parcours

**Constat.** Les parcours sont pensés pour un agent de bureau : librarie d'actions plutôt que menus,
cartes cliquables, glisser-déposer expliqué, écrans d'état (vide, chargement, erreur) systématiques. La
défense de l'utilisateur contre lui-même est présente (confirmation sur geste exceptionnel, motif exigé).

**Points conformes.**
- États vides et de chargement explicites (« Chargement du recueil… », état vide du bulletin, spinners).
- Gestes destructeurs bornés : retrait de publication avec motif obligatoire, corbeille, purge réservée à l'administration.
- Aide contextuelle à chaque écran (renvoi au chapitre du guide).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### III.4 Cohérence des interfaces

**Constat.** Le vocabulaire est tenu (« atelier », « recueil public », « trame », « acte », « visa »),
les composants sont mutualisés (`src/ui/components.js`, `dom.js`) et les mêmes gestes produisent les
mêmes libellés. Le pied de page « Propulsé par Scribae — GPLv3 » est identique aux trois endroits où il
apparaît, par construction (un seul module).

**Points conformes.**
- Mention de l'éditeur écrite une seule fois (`src/ui/mention.js`) et lue par les trois pieds de page.
- Libellés d'action adaptés à l'état (épinglage), messages d'erreur normalisés.
- Alignement et marges conformes : recueil sans débordement horizontal à 390 px (`scrollWidth = clientWidth = 390`).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### III.5 Compréhension et aide

**Constat.** Le niveau de langue est adapté et le guide est écrit pour des non-informaticiens. La
documentation technique est réservée aux administrateurs ; le guide est, lui, accessible à tous.

**Points conformes.**
- Guide intégré de 29 chapitres, glossaire, dépannage, chapitres par public.
- Assistants sans moteur : ils retrouvent le chapitre ou l'acte qui répond, et y conduisent.
- Messages d'erreur en français, avec cause et geste attendu.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### III.6 Robustesse et adaptation

**Constat.** Le recueil est responsive et testé à 390 px ; le rendu en mode sombre est prévu dès le
chargement (pas d'éclair blanc). Les documents produits ont leur propre feuille de style, donc
l'impression ne dépend pas de l'écran.

**Points conformes.**
- Recueil à 390 × 844 : aucun débordement horizontal, page de 6 942 px, cibles tactiles conformes, titre à 27,2 px (pas de débordement de texte).
- Mode sombre appliqué avant le premier rendu (script d'amorçage dans `index.html`).
- Impression et export imprimable traités (feuille A4, `@page`).

**Non-conformités.** Aucune nouvelle. (Renvoi : `NC-III-008`.)

**Recommandations.** P-33.

### III.7 Qualité mesurée

**Constat.** Ce qui est annoncé est vérifiable : nombre d'actes, de thèmes, référence de version, état
du journal, nombre de chapitres du guide (29, comptés cette campagne). C'est rare et cela doit être
préservé — c'est aussi ce qui rend l'exposition publique défendable.

**Points conformes.**
- Chiffres de l'écran exacts (« 17 actes publiés · 9 thèmes · dernière publication le 8 décembre 2026 »).
- Version affichée exacte (`v1.6.0 · 22/09/2026`), cohérente avec le journal des versions.
- 29 chapitres de guide annoncés, 29 comptés.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** P-38 (publier l'état de la chaîne, qui est aujourd'hui le seul indicateur manquant).

### III.8 Documentation utilisateur et formation

**Constat.** La documentation utilisateur est complète et séparée de la documentation technique. Elle
est imprimable et exportable, ce qui permet une formation sans réseau. Le point faible reste la
documentation **de développement**, volumineuse (I.8).

**Points conformes.**
- Guide imprimable (chapitre seul ou entier) et exportable en HTML autonome.
- Documentation technique réservée aux administrateurs (permission `docs.voir`).
- Documents livrés lisibles et téléchargeables depuis l'application.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** P-42.

---

## 6. Chapitre IV — Conformité et valeur juridiques (DAJ / assemblées)

*Posture : exige la sécurité juridique des actes, la collaboration entre services et la qualité du
droit produit.*

### IV.1 Conformité des actes et du cycle réglementaire

**Constat.** Le cycle est couvert de bout en bout, avec les distinctions qui font la valeur juridique :
date de signature ≠ date de publication ≠ date d'opposabilité, documents **non juridiques** (verbatim,
déclaration, vœu) publiés sans opposabilité, contrôle de légalité préalable à la publication,
abrogation et modifications tracées. La transmission au contrôle de légalité, elle, est simulée et
**le dit**.

**Points conformes.**
- Publication refusée avant signature (`409 acte_non_signe`) et avant transmission quand elle est requise (`409 transmission_absente`).
- Documents non juridiques : opposabilité **imposée vide** par le service, et présentés comme documents.
- Acte déclaré non publiable : publication impossible, même après signature (`409 acte_non_publiable`).
- Date de publication antérieure à la signature refusée (`422`).
- Retrait exceptionnel : motif exigé et conservé (trace).

**Non-conformités.** `NC-IV-004` (transmission simulée).

**Recommandations.** P-41.

### IV.2 Interopérabilité et normes

**Constat.** Les formats sont ceux du domaine : Akoma Ntoso 3.0, ELI, JSON-LD/Schema.org, Markdown,
texte, HTML. Le point faible est **l'unification de l'ELI** : deux formes coexistent (identifiant
`eli:/fr/…` et adresse HTTP), distinguées à l'écran mais non unifiées.

**Points conformes.**
- ELI attribué à la publication, stable par acte, et versions successives servies sous le même identifiant.
- Formats servis par le recueil ouvert (JSON, Markdown, texte, Akoma Ntoso) + `llms.txt` et `sitemap.xml` en auto-hébergement.
- JSON-LD complet (licence, ELI, dates), donc exploitable par un moteur ou un agent.

**Non-conformités.** `NC-IV-003` (ELI non unifié).

**Recommandations.** P-39.

### IV.3 Sécurité juridique et valeur probante

**Constat.** L'intégrité est mécaniquement garantie (empreintes recalculées, refus en cas de
divergence) ; **l'identité ne l'est pas** (certificat auto-engendré, clé privée en clair). L'application
est honnête sur ce point : mentions de simulation, badge « simulation », README qui dit que le
certificat n'est pas qualifié au sens eIDAS.

**Points conformes.**
- Original signé partagé en deux parts : la partie publique est vérifiable, la partie nominative reste interne.
- Empreinte du document signé recalculée et comparée avant acceptation (`409` sinon).
- Certification de conformité du réviseur exigée quand elle est déclarée requise (`409 conformite_non_certifiee`).
- Distinction explicite original / version en ligne / version consolidée (« ne fait pas foi »).

**Non-conformités.** `NC-IV-001` (identité du signataire), `NC-IV-004` (télétransmission simulée).

**Recommandations.** P-41.

### IV.4 Cycle de vie de l'acte

**Constat.** Le cycle est complet : trame → acte → validation → signature → transmission →
publication → recueil → versions (consolidée, modificative) → abrogation → retrait exceptionnel. La
version consolidée est présentée pour ce qu'elle est, avec renvoi à l'original.

**Points conformes.**
- Versions publiées listées sous un même identifiant, avec « version en vigueur » / « version antérieure ».
- Version consolidée marquée « ne fait pas foi » et liée à l'original.
- Abrogations et modifications tracées (acte modificatif + consolidé).

**Non-conformités.** Aucune nouvelle. (Renvoi : `NC-IV-003`.)

**Recommandations.** P-39.

### IV.5 Collaboration et gouvernance

**Constat.** Les rôles, circuits de validation, parapheur, délégations et la concurrence d'accès sont
traités (révisions, conflits renvoyés au client et affichés). La séparation des pouvoirs est explicite
(un signataire ne signe que dans son champ de compétence).

**Points conformes.**
- Circuits de validation (parapheur) avec étapes, tranchage, empreinte du texte validé.
- Délégations et organigramme éditables dès le rôle éditeur.
- Concurrence d'accès : contrôle de révision, conflits signalés et repris côté client.
- Champ de compétence du signataire opposé aux trois chemins de signature.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### IV.6 Qualité du droit produit

**Constat.** Des contrôles de conformité existent (écarts signalés au rédacteur, contrôles sur les
mentions, cohérence des visas) et le guide porte une doctrine rédactionnelle. Rien de nouveau n'est venu
dégrader ce point.

**Points conformes.**
- Écarts de saisie signalés et tracés (un écart est un signal, pas une faute).
- Contrôles de conformité de l'acte et de ses annexes (règlements : publication informative autonome).
- Guide intégré qui explique le droit (visa, considérant, formule d'édiction, opposabilité).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### IV.7 Transparence, données ouvertes et protection

**Constat.** La licence de réutilisation est affichée en clair au recueil (obligation du CRPA) et
inscrite dans le JSON-LD ; les fichiers ouverts sont annoncés là où un serveur les sert. Deux points de
vigilance : la démonstration est indexable (NC-III-008) et le registre d'audit est publié (NC-II-013).

**Points conformes.**
- Licence de réutilisation en clair dans le pied du recueil, sans dépliage.
- `dcterms:license` et `eli:uri` dans le JSON-LD.
- Fichiers ouverts (llms.txt, recueil.json, sitemap.xml, robots.txt) annoncés **seulement** là où le service les sert.
- Actes réservés aux agents hors de toute diffusion publique (liste, recherche, fichiers ouverts, adresse).

**Non-conformités.** `NC-III-008`, `NC-II-013`.

**Recommandations.** P-33, P-34.

### IV.8 Valeur d'usage et soutenabilité

**Constat.** Le logiciel est soutenable : autonome, sans dépendance payante, installable par une
collectivité, et l'adoption est préparée (guide, assistants, démonstration publique, onze comptes
fictifs). Le coût de reprise, lui, est réel (monolithes, duplication) — c'est le prix de la vitesse
d'écriture des derniers mois.

**Points conformes.**
- Démonstration publique, sans installation, avec comptes fictifs ouverts d'un clic.
- Auto-hébergement documenté (Docker Compose, variables, sauvegardes, migration depuis la démonstration).
- Aucun verrou : données exportables, formats ouverts, licence libre.

**Non-conformités.** `NC-I-003`, `NC-I-010` (coût de reprise).

**Recommandations.** P-40, P-42.

---

## 7. Chapitre V — Synthèse transversale

**Recoupements.** Trois causes expliquent la plupart des constats de cette campagne :

1. **l'outillage de contrôle a été écrit pour une disposition qui n'est pas celle livrée** (NC-I-009 →
   NC-I-008, NC-I-007) : le contrôle existe, il est même documenté, mais il ne s'exécute pas ;
2. **la démonstration et le service ont divergé en deux implémentations** (NC-I-010) : chaque
   correction doit être faite deux fois, et rien ne le vérifie — c'est aussi ce qui rend la frontière
   démonstration/production fragile (point d'entrée du cadre, NC-II-012) ;
3. **ce qui est simulé doit être nommé** : signature (NC-IV-001) et télétransmission (NC-IV-004) sont
   des simulations annoncées ; le risque n'est pas technique mais de communication — et il augmente
   avec l'exposition publique.

**Risques systémiques.** Une chaîne rouge (NC-I-008) rend **tous** les autres constats moins fiables :
rien ne garantit que l'état publié fonctionne, sinon l'essai manuel. C'est le premier point à corriger,
non parce qu'il est le plus grave, mais parce qu'il conditionne la crédibilité des autres.

**Contradictions à trancher par le prescripteur.**

| Question | Arbitrage attendu |
|---|---|
| La démonstration doit-elle être indexable ? | Non : c'est un jeu fictif. Ajouter `noindex`/`robots.txt` **dans la démonstration seulement** (P-33). |
| Le dépôt doit-il publier son registre d'audit ? | Oui, mais chapeauté : c'est un document de travail, et il faut le dire là où un lecteur le rencontre (P-34). |
| La signature peut-elle servir en production ? | Pas en l'état pour un acte opposable (NC-IV-001) : soit un prestataire qualifié, soit une mention explicite « signature simple, non qualifiée » dans l'acte publié. |
| Faut-il arrêter les fonctions pour consolider ? | Oui, jusqu'à ce que la chaîne soit verte et les épreuves de parcours écrites (P-31, P-35) — c'est aussi ce qui rend l'exposition publique confortable. |

---

## 8. Plan d'action — propositions à réaliser

| Id | Proposition | Couvre | Bénéfice | Effort | Porteur | Horizon |
|---|---|---|---|---|---|---|
| **P-31** | Rendre la chaîne verte : corriger le chemin d'exemption du contrôle de style, ajouter une épreuve qui l'exécute **sur la disposition livrée**, instruire l'échec du travail « Service auto-hébergé » | NC-I-008, NC-I-009 | Le contrôle redevient une garantie ; une régression future se voit | Faible | auteur | **0–30 j** |
| **P-32** | Verrou de dépendances (`package-lock.json`) et passage à `npm ci` dans la chaîne | NC-I-002 | Construction reproductible | Faible | auteur | **0–30 j** |
| **P-33** | Maîtriser l'indexation de la démonstration : `robots.txt` ou `noindex` **dans la démonstration statique**, documenté dans `docs/GITHUB.md` | NC-III-008 | Pas de fiche fictive dans un moteur de recherche | Faible | auteur | **0–30 j** |
| **P-34** | Chapeau « document de travail » en tête du registre et des rapports, renvoi depuis le README du dépôt à la synthèse d'audit plutôt qu'aux fiches | NC-II-013 | Un lecteur pressé ne cite pas une non-conformité hors contexte | Faible | auteur | **0–30 j** |
| **P-35** | Épreuves de parcours (navigateur) sur les cinq parcours critiques : connexion, rédaction, validation, publication, consultation publique — et jeu d'appels commun aux deux implémentations du service | NC-I-001, NC-I-010 | La promesse publique est vérifiée automatiquement | Moyen | auteur | 30–90 j |
| **P-36** | Reposer et épingler le repère de navigation de l'atelier (`aria-label`) | NC-III-007 | Navigation compréhensible au lecteur d'écran | Faible | auteur | 30–90 j |
| **P-37** | Politique de rétention et export du journal d'audit (durée, format, qui exporte) | NC-II-010 | Preuve exploitable hors de l'application | Moyen | auteur | 30–90 j |
| **P-38** | Fiche de tête du dépôt : badge d'état de la chaîne, version courante, état des deux démonstrations, statut de l'audit | NC-I-008, III.7 | Un visiteur (forum, évaluation) voit l'état réel en dix secondes | Faible | auteur | 30–90 j |
| **P-39** | Unifier l'ELI en une seule forme HTTP canonique (publication, JSON-LD, Akoma Ntoso) | NC-IV-003 | Interopérabilité réelle, adresses citables | Moyen | auteur | 90–180 j |
| **P-40** | Kit de reprise : « continuer sans l'auteur » (architecture, points d'entrée, recettes de livraison, ce qui n'est pas couvert) | NC-I-003, I.8 | Un tiers reprend le logiciel sans l'auteur | Moyen | auteur | 90–180 j |
| **P-41** | Valeur probante : certificat de signature qualifié (ou mention explicite « non qualifiée » dans l'acte publié) et transmission réelle avec preuve de l'appel | NC-IV-001, NC-IV-004 | Les actes opposables le sont pour de vrai | Élevé | auteur + prestataire | 90–180 j |
| **P-42** | Rembourser la dette de structure : découper `app.css` et les deux gros écrans, factoriser les trois règles dupliquées | NC-I-003, NC-I-004 | Coût de reprise divisé | Moyen | auteur | 90–180 j |
| **P-43** | Mesurer publiquement ce qui est promis : temps de premier rendu, nombre de requêtes, empreinte de page sur la démonstration, et le publier dans le README | III.7 | Argument vérifiable pour une communication publique | Faible | auteur | 30–90 j |

*(Aucune proposition ne demande d'interrompre une fonctionnalité en cours : les trois premières
suffisent à rendre la publication défendable.)*

---

## 9. Annexe A — Registre des non-conformités (synthèse)

Le registre complet — fiches, constats, preuves, recommandations, efforts, échéances — est tenu dans
`src/audit/REGISTRE-NON-CONFORMITES.md` (36 fiches). Extrait à la fin de cette campagne :

| Fiche | Cote | Statut | Constat en une ligne |
|---|---|---|---|
| NC-I-001 | Majeure | En cours | Aucune épreuve de parcours ; base de tests en progrès (226 épreuves) |
| NC-I-002 | Majeure | En cours, aggravée | Chaîne rouge, aucun verrou de dépendances |
| NC-I-003 | Mineure | Ouverte | Monolithes (3 609 / 3 452 / 3 425 / 3 336 lignes) |
| NC-I-004 | Mineure | Ouverte | Trois règles implémentées deux fois |
| NC-I-005 | Observation | Levée | Licence tranchée, nommage clarifié |
| NC-I-006 | Observation | Levée | Démonstration présentée comme non conservatoire |
| NC-I-007 | Observation | Ouverte | Outillage rangé sous `src/` |
| NC-I-008 | Majeure | **Ouverte** | Chaîne d'intégration rouge sur 4 envois sur 4 |
| NC-I-009 | Mineure | **Ouverte** | Contrôle de style inopérant dans la disposition livrée |
| NC-I-010 | Mineure | **Ouverte** | API implémentée deux fois (démonstration / service) |
| NC-II-001 | Bloquante | Levée | Plus de jeton d'écriture publié ; clés à rôles |
| NC-II-002 | Bloquante | Levée | Webhook authentifié, empreinte recalculée |
| NC-II-003 | Bloquante | Levée | Collections sensibles réservées |
| NC-II-004 | Majeure | Levée | Rôles appliqués côté serveur |
| NC-II-005 | Majeure | Levée | Actes individuels fermés à l'anonyme |
| NC-II-006 | Majeure | Levée | Compétence du signataire vérifiée, opérateur tracé |
| NC-II-007 | Majeure | Levée | Contenu publié assaini (XSS) |
| NC-II-008 | Mineure | Levée | Clé de moteur hors du référentiel |
| NC-II-009 | Mineure | Levée | Valeurs par défaut sûres, en-têtes de sécurité |
| NC-II-010 | Observation | En cours | Rétention et export du journal non définis |
| NC-II-011 | Observation | Levée | Sous-traitances documentées |
| NC-II-012 | Observation | Ouverte | Démonstration non conservatoire |
| NC-II-013 | Observation | **Ouverte** | Registre d'audit publié avec ses fiches ouvertes |
| NC-III-001 | Majeure | Levée | Documentation réalignée sur l'outil |
| NC-III-002 | Mineure | Levée | Lien d'évitement présent |
| NC-III-003 | Mineure | Levée | Cibles tactiles conformes |
| NC-III-004 | Mineure | Levée | Alignement du pied de page corrigé |
| NC-III-005 | Observation | **Régression** | Repère de navigation de l'atelier perdu |
| NC-III-006 | Observation | Levée | Libellé d'épinglage adapté à l'état |
| NC-III-007 | Observation | **Ouverte** | (régression de NC-III-005, suivi dédié) |
| NC-III-008 | Observation | **Ouverte** | Démonstration indexable |
| NC-IV-001 | Majeure | En cours | Signature : identité et non-répudiation non établies |
| NC-IV-002 | Majeure | Levée | Licences affichées et inscrites |
| NC-IV-003 | Mineure | En cours | ELI non unifié |
| NC-IV-004 | Mineure | En cours | Télétransmission simulée |
| NC-IV-005 | Observation | Levée | Version consolidée qualifiée |

Bilan : **36 fiches** — 20 levées, 9 ouvertes, 6 en cours, 1 régression ; 6 nouvelles cette campagne
(`NC-I-008`, `NC-I-009`, `NC-I-010`, `NC-II-013`, `NC-III-007`, `NC-III-008`).

## 10. Annexe B — Grille de cotation

| Cote | Définition | Effet attendu |
|---|---|---|
| **Bloquante** | Empêche la mise en service, la sécurité juridique ou la sécurité tout court. | Correction avant toute exploitation réelle. |
| **Majeure** | Défaut de conformité ou de sécurité avéré, à impact réel, mais contournable. | Correction planifiée et suivie. |
| **Mineure** | Écart réel mais d'impact limité, gênant la qualité ou l'usage. | Correction dans un lot d'amélioration. |
| **Observation** | Point de vigilance, risque futur, ou bonne pratique manquante. | À instruire, sans correction obligatoire. |
| **Point conforme** | Satisfait une exigence. | À préserver ; à documenter. |

## 11. Annexe C — Journal d'audit

**Chronologie et temps passé (1 h 45).**

| Séquence | Travail | Temps |
|---|---|---|
| Cadrage | cadre d'audit, annexes, registre (36 fiches), rapport précédent, note de version 1.6.0 | 10 min |
| Chapitre I | inventaire du dépôt (231 fichiers, 114 314 lignes, 8,5 Mo), mesures de taille, analyse syntaxique des 179 fichiers JavaScript, inventaire des dépendances et de l'outillage | 25 min |
| Chapitre II | forensique du dépôt publié (API GitHub : envois, exécutions de la chaîne, travaux, annotations), reproduction du défaut d'exemption, secrets et routes du service, lecture des chemins de signature | 25 min |
| Chapitre III | parcours réel dans l'aperçu : recueil public (desktop, 390 px), mesures de contraste (clair **et** sombre), cibles tactiles, repères et titres, captures d'écran (deux), complétude exigence par exigence | 20 min |
| Chapitre IV | cycle réglementaire dans le code et à l'écran, formats et ELI, licence, journal | 15 min |
| Rédaction | rapport, registre (statuts revérifiés, 6 fiches ajoutées, synthèse recalculée) | 10 min |

**Vérifications effectuées (extrait).**

- Inventaire complet de `src/` et du dépôt publié (liste des fichiers racine, présence/absence de verrou, publication de `src/audit/`).
- Analyse syntaxique de 179 fichiers `.js`/`.mjs` : aucun fichier non parsable.
- Recherche de `debugger` : aucune occurrence hors de l'outillage ; les mentions de l'outillage provoquent l'échec (reproduit).
- API GitHub : 16 exécutions, dont 4 « Intégration continue » toutes en échec ; étapes en échec identifiées ; journaux **inaccessibles** (403).
- Démonstration publiée : `HEAD /robots.txt` → 404 ; `GET /index.html` (178 325 octets) sans balise `robots` ; `src/lib/version.js` servi = 1.6.0 ; `src/CHANGELOG.md` servi à jour (`1.6.1b` en tête).
- Application dans l'aperçu : recueil public (titres, lien d'évitement, pied, licence, mention), version affichée (`v1.6.0 · 22/09/2026`), contrastes (5,74 à 16,74 selon les éléments, deux thèmes), cibles tactiles, débordement à 390 px (aucun), repères `nav`, pieds de page de l'atelier.
- Chargement de la démonstration publiée depuis le navigateur (trois adresses : racine, `?page=mentions-legales`, `?page=bulletins`) : toutes chargées.
- Lecture des chemins sensibles : signature (`src/lib/signature.js`), télétransmission (`src/lib/legalite.js`), ELI (`src/lib/eli.js`), clés (`src/lib/cle-service.js`), journal (`index.html`).

**Ce qui n'a pas pu être vérifié, et pourquoi.**

1. **Les journaux d'exécution de la chaîne d'intégration** : l'API GitHub exige des droits d'administration sur le dépôt (`403 Must have admin rights to Repository`). La cause du second travail en échec (« Service auto-hébergé ») n'est donc **pas instruite** : seule la première (contrôle de style) a pu être reproduite. La reproduction en atelier des épreuves de `src/server/mysql/actes.test.mjs` donne cinq échecs (« Signature de démonstration impossible »), ce qui est **une hypothèse**, non une preuve de la cause en intégration.
2. **Le rendu des sous-pages publiques** (`?page=bulletins`, `?page=mentions-legales`, `?page=…`) : une navigation plein document vers ces adresses fige l'environnement d'aperçu (deux fois reproduit, sur deux adresses différentes). Les trois adresses **chargent** bien depuis le navigateur sur la démonstration publiée (vérifié), mais leur **contenu rendu** n'a pas pu être inspecté. À rejouer sur la démonstration ou sur une installation auto-hébergée.
3. **La navigation clavier réelle et le lecteur d'écran** : l'aperçu ne reçoit pas d'événements clavier réels, donc l'ordre de tabulation et le contour de focus ont été vérifiés par la règle CSS (`:focus-visible`, `.recueil-evitement:focus`) et non par un parcours au clavier.
4. **Le pied de page de l'écran de connexion** (mention de l'éditeur) : lu dans le code (`src/ui/views/connexion.js`) et mesuré sur les deux autres pieds, mais pas observé à l'écran (session ouverte dans l'aperçu).
5. **Le service sous charge et la démonstration non conservatoire** (`NC-II-012`) : non revérifiés dans cette campagne (le banc de charge existe, il n'a pas été rejoué).
6. **Le détail du contenu des sous-pages** (accessibilité, mentions légales) : même limite que le point 2.

*Fin du rapport.*
