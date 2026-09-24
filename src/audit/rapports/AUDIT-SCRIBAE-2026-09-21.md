---
titre: Audit Scribae — 2026-09-21
version_outil: 1.2.0
duree: 01:32
chapitres: 4
non_conformites: 27 (bloquantes 3, majeures 9, mineures 9, observations 6)
points_conformes: 106
propositions: 16
registre: src/audit/REGISTRE-NON-CONFORMITES.md
precedent: —
---


> **Document de travail — un audit constate, il ne certifie pas.** Ce rapport le premier ne corrige rien : il
> relève, prouve et propose. Les non-conformités qu'il établit sont suivies dans le **registre
> cumulatif** (`../REGISTRE-NON-CONFORMITES.md`), où leur **statut évolue** d'une campagne à l'autre —
> une fiche lue ici peut être **levée depuis**, ou au contraire encore **ouverte**. Les termes employés
> (gravité, cotation, preuve, contrat de sortie) sont définis par le cadre : `../PROMPT-AUDIT-SCRIBAE.md`.
# Audit Scribae — 2026-09-21

## 1. En-tête

| | |
|---|---|
| **Objet** | Audit complet de Scribae — éditeur de trames et d'actes administratifs |
| **Cible** | `https://perchance.org/scribae` (démonstrateur « mairie de Valmont-sur-Loire ») |
| **Version de l'outil** | `APP_VERSION = 1.2.0` (`src/lib/version.js`), première entrée datée du changelog = 1.2.0 (cohérente) |
| **Périmètre** | `main.pjs`, `index.html` (dont le script `type="text/x-server-plugin"`), et l'intégralité de `src/` : 136 fichiers, ~66 400 lignes, ~3,8 Mo. Application à l'exécution (parcours, exports, API, persistance, assistants), interfaces (recueil public, atelier, responsive, impression), données de démonstration, documentation (`README.md`, `SPEC.md`, `CHANGELOG.md`, `TODO.md`, `docs/`, guide intégré). |
| **Hors périmètre** | Composants de la plateforme Perchance (moteur, hébergement, plugins tiers) — leur **usage** par Scribae est en revanche audité ; prestataires tiers et API préfectorale (la **manière** dont Scribae s'y branche est auditée) ; infrastructure de la collectivité cliente. |
| **Méthode** | §5 du cadre : cadrage → exploration statique (lecture de code) → exploration dynamique (exécution réelle dans la prévisualisation : parcours, appels d'API, exports, rôles, viewports, clavier, contrastes) → instruction → rédaction → restitution. |
| **Durée** | ≈ 1 h 32 (détail : annexe C). |
| **Auditeurs** | Quatre regards : Chapitre I — DSI ; Chapitre II — RSSI ; Chapitre III — qualiticien ; Chapitre IV — DAJ / service des assemblées. |
| **Références** | `src/README.md`, `src/SPEC.md`, `src/CHANGELOG.md`, `src/TODO.md`, `src/docs/ADMINISTRATION.md`, `src/docs/GITHUB.md`, `src/server/README.md`, `src/server/mysql/README.md`, guide intégré (`src/wiki.js`). |
| **Pièces** | Rapport présent ; `src/audit/REGISTRE-NON-CONFORMITES.md` ; `src/audit/PROMPT-AUDIT-SCRIBAE.md` (cadre) ; `src/audit/README.md`. |
| **Rapport précédent** | aucun (audit initial). |
| **Aucune correction** | Conformément au §9, cet audit n'a modifié ni `main.pjs`, ni `index.html`, ni `src/` (hors le dossier `src/audit/` qu'il produit). Le seul geste d'écriture commis sur l'outil l'a été **pendant les tests** et a été **annulé** (publication de sonde retirée) — voir annexe C. |

---

## 2. Synthèse pour la direction

**Appréciation générale.** Scribae est une réalisation sérieuse, documentée et fonctionnelle, très
au-dessus de l'ordinaire des démonstrateurs : la chaîne trame → acte → révision → signature →
transmission → publication → recueil → ELI est réellement instrumentée, les exports Akoma Ntoso 3.0
sont bien formés et complets, la cryptographie de signature est réelle (ECDSA P-256 / SHA-256), la
persistance et la synchronisation par révisions existent, un guide de 24 chapitres accompagne
l'utilisateur, et un déploiement auto-hébergé Docker est fourni. **Le socle est bon ; la barrière de
sécurité, elle, n'existe pas encore.** L'outil est bâti comme un démonstrateur partagé mais il
expose un **recueil public** et une **API d'écriture** : en l'état, un tiers anonyme peut publier au
recueil un acte fabriqué et signer à la place d'un signataire. Ce n'est pas un défaut de finition,
c'est un défaut de conception à traiter avant toute exploitation, même en démonstration ouverte.

**Note par chapitre** (appréciation qualitative, non moyennée — les quatre regards sont
irréductibles) :

| Chapitre | Appréciation | En une phrase |
|---|---|---|
| **I — DSI** | Bon avec réserves | Architecture claire et séparation des responsabilités réussie ; mais **aucun test du code client, aucune CI, aucun verrou de dépendances**, et des monolithes (fichiers de 2 000 à 3 100 lignes). |
| **II — RSSI** | **Non conforme** | Trois non-conformités **bloquantes** : jeton d'écriture public, signature forgeable, collections lisibles sans authentification. L'usurpation du signataire est **confirmée** en code et en exécution. |
| **III — Qualité** | Satisfaisant | Accessibilité de base respectée (contrastes conformes, focus visible, libellés, responsive sans débordement) ; points à corriger sur le lien d'évitement, les cibles tactiles, et surtout une **documentation qui contredit l'outil**. |
| **IV — Juridique** | Insuffisant en l'état | Les actes, délais et exports sont juridiquement outillés (bon point), mais la **valeur probante de la signature n'est pas garantie**, la **licence de réutilisation manque**, et l'identifiant ELI n'est pas résoluble. |

**Les dix risques majeurs** (par ordre de gravité décroissante) :

1. **NC-II-002 — Signature forgeable.** Un tiers anonyme peut faire passer un acte pour signé au nom
   de n'importe qui, et le publier. *(Bloquante)*
2. **NC-II-001 — Jeton d'écriture public.** Toutes les écritures de l'API (dépôt, signature,
   publication, synchronisation des collections) sont ouvertes à quiconque lit le code servi.
   *(Bloquante)*
3. **NC-II-003 — Comptes et référentiel lisibles sans authentification.** Fuite de données
   personnelles et de la configuration dès que le service détient des données. *(Bloquante)*
4. **NC-II-004 — Aucune autorisation par rôle côté serveur.** Un même jeton permet de réécrire la
   collection des comptes (élévation de privilèges). *(Majeure)*
5. **NC-II-006 — Usurpation du signataire dans l'application.** L'identité signée est celle de
   l'acte, pas celle de l'opérateur ; l'action est ouverte au rôle Rédacteur. *(Majeure)*
6. **NC-II-005 — Actes individuels exposés.** Le texte d'actes « non publiables » (sanctions,
   revalorisations) est lisible en clair sur une route publique. *(Majeure)*
7. **NC-II-007 — XSS stocké dans le recueil public.** Le HTML publié est inséré sans assainissement.
   *(Majeure)*
8. **NC-IV-001 — Identité du signataire non garantie / clé privée en clair.** La « signature
   vérifiable » ne prouve pas l'auteur. *(Majeure)*
9. **NC-IV-002 — Pas de licence de réutilisation au recueil.** Obligation de publicité des conditions
   de réutilisation non satisfaite. *(Majeure)*
10. **NC-III-001 — Documentation contredisant l'outil** (guide, SPEC, README public) — trompe
    l'utilisateur et l'auditeur futurs. *(Majeure)*

**Trajectoire recommandée.** Ne pas « durcir » la démonstration : **séparer**. Un démonstrateur
peut rester ouvert s'il est explicitement non autoritaire (données fictives, aucun recueil public
réel, écritures locales au poste). Dès qu'un recueil public et une API d'écriture existent, il faut
un service autoritaire : jeton par client hors du code servi, autorisation par route et par rôle,
webhook authentifié, lecture des actes non publiés protégée, licence de réutilisation affichée.
Le socle auto-hébergé (`src/server/mysql/`) fournit déjà plusieurs de ces briques (scrypt, sessions
`HttpOnly`, CSRF, refus des écritures `users`/`config` par un non-admin) : la trajectoire consiste à
**porter ces mêmes règles dans le service embarqué**, puis à n'exposer en ligne que le premier.

---

## 3. Chapitre I — Systèmes d'information (DSI)

> **Question directrice.** « Est-ce que je peux faire tourner, faire évoluer, faire auditer et
> reprendre ça sans l'auteur, dans dix ans, avec une équipe ? »

### I.1 — Architecture et découpage

**Constat.** L'application est un front découpé avec soin : 57 modules `src/lib/` (métier, pur ou
quasi pur), 22 vues `src/ui/views/`, une coquille `src/ui/app.js`, un `index.html` qui n'est
qu'une enveloppe, et un script serveur embarqué. La persistance est isolée derrière un contrat
(`src/lib/db/contract.js`) et deux pilotes interchangeables (IndexedDB local, service distant), si
bien que le reste du code ignore où vivent les données. Le service expose un contrat REST décrit en
OpenAPI (`GET /v1/`) et dispose d'un portage serveur autonome (`src/server/mysql/`) — la démo et la
cible partagent donc le même contrat. Les responsabilités sont, à la lecture, respectées : le
métier ne fait pas de DOM, les vues ne font pas de persistance.

**Points conformes.**
- Séparation front / service / persistance réellement tenue ; pilote de persistance interchangeable
  (`src/lib/db/index.js`, `local.js`, `service.js`).
- Contrat de données explicite et documenté (`src/lib/db/contract.js`) : collections, granularité
  par enregistrement, synchronisation par révisions et gestion des conflits.
- Portage serveur complet du domaine signature/publication (`src/server/mysql/actes.mjs`) sous le
  même contrat : une démonstration peut devenir un service.
- API décrite en OpenAPI (`index.html`, `openapi()`).

**Non-conformités.** NC-I-004 (même règle écrite trois fois : `sansInterne` / `partiePublique`),
NC-I-003 (monolithes de vues et de CSS).

**Recommandations.** Extraire la règle « partie publique de l'original » et l'empreinte SHA-256 en un
point unique ; découper les vues les plus volumineuses. (P-04)

### I.2 — Qualité et lisibilité du code

**Constat.** Le code est remarquablement commenté — d'un commentaire **explicatif**, qui dit le
*pourquoi* et cite les incidents passés (par exemple la longueur d'état sur 16 bits, ou l'absence
d'`Intl` dans le moteur du service), ce qui est la meilleure forme de documentation pour une reprise.
Les conventions sont homogènes (identifiants suffixés par type, listes fonctionnelles). Le point
noir est la **taille** de certains fichiers et une duplication de règle.

**Points conformes.**
- Commentaires utiles et orientés décision ; pièges connus consignés dans le README (« Pièges
  connus »), y compris un piège subtil de double-encodage des clés de publication.
- Nommage des identifiants DOM cohérent (`…El`, `…Btn`, `…Ctn`, `…Input`).
- Modules métier purs, testables par construction.

**Non-conformités.** NC-I-003 (fichiers monolithiques), NC-I-004 (duplication), NC-I-005 (nommage
ambigu `revision.js` / `revisions.js` ; propriété intellectuelle non définie).

**Recommandations.** Scinder ; renommer ; trancher la licence. (P-04, P-12)

### I.3 — Environnements, tests, industrialisation

**Constat.** C'est la faiblesse la plus lourde du chapitre. **Aucun test** ne couvre le code de
l'application ; seuls le service auto-hébergé dispose de deux fichiers de tests (`node --test`).
Aucune intégration continue, aucune analyse statique, aucun verrou de dépendances. Les environnements
démo / recette / production ne sont **pas séparés par des artefacts** mais par un réglage et par des
variables d'environnement — ce qui est acceptable techniquement, mais laisse la démonstration
publique jouer le rôle de recette.

**Points conformes.**
- Deux fichiers de tests unitaires côté serveur (`src/server/mysql/comptes.test.mjs`,
  `actes.test.mjs`) et script `test` déclaré.
- Déploiement reproductible dans sa forme (`docker-compose.yml`, `schema.sql`, `env.example`,
  migration explicite `--migrate`), avec un `README` d'installation pas à pas.
- Version figée unique et procédure de versionnement claire (`src/lib/version.js`, `CHANGELOG.md`).

**Non-conformités.** NC-I-001 (aucun test du code client), NC-I-002 (pas de CI/lint/verrou).

**Recommandations.** Poser un socle de tests sur les modules purs puis sur les parcours ; ajouter un
pipeline minimal et un verrou de dépendances. (P-03)

### I.4 — Dépendances et chaîne d'approvisionnement

**Constat.** Le code client ne tire **aucune** bibliothèque d'un CDN : tout est local — bon point
rare et précieux. Les seules dépendances externes sont les cinq plugins de la plateforme Perchance
(`kv`, `server-plugin`, `super-fetch-plugin`, `upload-plugin`, `ai-text-plugin`), importés par
`main.pjs` **sans numéro de version** et chargés à l'exécution : un changement côté plateforme peut
donc modifier le comportement de Scribae sans qu'aucune trace ne le signale. Côté serveur,
`mysql2` est en plage (`^3.11.3`) sans verrou, et les images Docker sont flottantes.

**Points conformes.**
- Aucune dépendance JavaScript tierce côté client (pas de CDN, pas de `node_modules` dans le front).
- Dépendance serveur unique et minimale (`mysql2`), pile Docker documentée.

**Non-conformités.** NC-I-002 (images et dépendances non épinglées, pas de verrou).

**Recommandations.** Épingler les images par empreinte, committer un `package-lock.json`, et
documenter (ou tester) la compatibilité avec les plugins de la plateforme. (P-03)

### I.5 — Gouvernance du code

**Constat.** La gouvernance est étonnamment soignée pour un projet porté par une seule main :
`APP_VERSION` unique et cohérent avec la première entrée datée du `CHANGELOG`, distinction explicite
entre les numéros de version (logiciel / service / format d'état / jeu de démonstration), et une
règle écrite : on n'incrémente la version qu'une fois livrée. La revue par un tiers, en revanche,
n'existe pas, et la propriété intellectuelle n'est pas tranchée.

**Points conformes.**
- `APP_VERSION` = 1.2.0 cohérent avec `CHANGELOG.md` ; version affichée dans l'interface.
- Changelog tenu, avec une section « Non publié » et des entrées datées reconstituant l'histoire.
- Traçabilité applicative des gestes (journal des faits) et de la collaboration (présence).

**Non-conformités.** NC-I-005 (licence absente, droits du code généré non définis ; nommage ambigu).

**Recommandations.** Statuer sur la licence et sur les droits ; instaurer une relecture avant fusion.
(P-12)

### I.6 — Exploitation

**Constat.** Le mode auto-hébergé est exploitable : sonde `GET /v1/health`, collections et
sauvegardes documentées, commandes de restauration, requêtes SQL utiles, sections « Dépannage » et
« Mise à jour ». Le **mode démonstration**, lui, n'est pas un mode de conservation : son état durable
est un tampon de taille fixe évidé par ancienneté (`MAX_ACTES = 80`, `MAX_PUBLIES = 40`,
`MAX_SIGNATURES = 80`), et un simple appui sur « Réinstaller la démonstration » efface le jeu. Le
service embarqué peut également être redémarré (le canal temps réel a été observé fermé puis
réinitialisé pendant les tests), ce qui réamorce son état.

**Points conformes.**
- Sonde de santé avec **indicateur de place occupée / capacité** (`GET /v1/health`), utile pour voir
  venir la saturation.
- Sauvegarde, restauration, migration et sondes documentées pour l'auto-hébergement
  (`src/docs/ADMINISTRATION.md` § 7–9, `src/server/README.md`).
- Piste d'audit applicative (journal, présence) et écran d'administration.

**Non-conformités.** NC-I-006 (observation : le mode démo n'est pas un mode de conservation).

**Recommandations.** Interdire par construction l'usage du mode démonstration en service réel, et
l'écrire noir sur blanc dans les deux documents d'administration. (P-11)

### I.7 — Souveraineté, hébergement, réversibilité

**Constat.** En l'état, l'application est hébergée par un tiers (Perchance) et ses données vivent soit
dans le navigateur de l'utilisateur (IndexedDB), soit dans l'état du service de la plateforme. La
réversibilité est en revanche **excellente** : exports complets à tout moment (référentiel, trames,
actes, JSON, Akoma Ntoso, Word, PDF), et un déploiement auto-hébergé clé en main (nginx, Node,
MariaDB) qui ne parle à aucun service tiers. Aucun verrouillage propriétaire.

**Points conformes.**
- Export complet des données depuis l'interface, dans des formats ouverts et normés.
- Pile auto-hébergeable fournie et documentée ; le service n'ouvre aucune connexion sortante
  (`Dockerfile` : « Le service n'ouvre aucune connexion sortante »).
- Aucune dépendance à un CDN ou à un service tiers pour le fonctionnement de base.

**Non-conformités.** Aucune propre à cette section (la dépendance à Perchance en mode démo est la
contrepartie assumée du « rien à installer » ; elle est traitée en NC-II-006 et NC-IV-002).

**Recommandations.** Faire de l'auto-hébergement la voie d'exploitation par défaut dès qu'un acte
réel est en jeu. (P-11)

### I.8 — Documentation et reprise par un tiers

**Constat.** Il existe un corpus documentaire considérable : `README.md` (~215 Ko), `SPEC.md`
(~196 Ko), `ADMINISTRATION.md` (~81 Ko), `CHANGELOG.md` (~112 Ko), `TODO.md` (~51 Ko), `GITHUB.md`,
`server/README.md`, `server/mysql/README.md`, et un guide intégré de 24 chapitres. Un tiers qui
arrive peut donc comprendre l'outil. Deux réserves : la documentation de référence est **un seul
fichier** de 2 672 lignes, et elle **contredit l'outil** sur des points fonctionnels (assistant
déclaré hors périmètre alors qu'il est livré ; SPEC en retard sur le code).

**Points conformes.**
- Corpus riche, structuré, tenu à jour au fil des versions ; guide utilisateur de 24 chapitres,
  glossaire et fiche mémo, index de recherche.
- Documentation technique **lue depuis les fichiers du dépôt** dans l'application, donc impossible à
  désynchroniser de la version servie.

**Non-conformités.** NC-I-003 (monolithe documentaire), NC-III-001 (contradictions document ↔ outil,
instruite au chapitre III).

**Recommandations.** Scinder le README et faire relire la documentation à l'aune de l'écran réel à
chaque livraison. (P-04, P-11)

---

## 4. Chapitre II — Sécurité des systèmes d'information (RSSI)

> **Question directrice.** « Qui peut faire quoi, à qui, avec quelles données, et qu'est-ce qui reste
> comme trace ? »

### II.1 — Cartographie et classification des données

**Constat.** Trois familles de données cohabitent : des **données administratives publiques** (actes
publiés, recueil), des **données administratives non publiques** (brouillons, actes individuels non
publiables, circuits), et des **données à caractère personnel** (comptes : nom, courriel,
rattachements, rôles, historique de connexion ; dossiers internes de signature : coordonnées,
authentification, trace des courriels). Les données circulent du navigateur vers le service, et des
vues publiques exposent une partie des actes. La classification **existe dans l'intention** (le
service sépare explicitement une « part publique » d'une « part interne » de l'original signé) mais
elle n'est **pas appliquée aux routes de lecture**.

**Points conformes.**
- Partition explicite de l'original signé entre part publique et part interne
  (`partiePublique`, `dossierInterne`, `sansInterne`), et route dédiée pour la part interne.
- Les listes de l'API ne renvoient que des métadonnées, jamais les documents (`resumeActe`,
  `resumePublication`).
- La part interne n'apparaît sur **aucune** route publique (vérifié : `GET /v1/publications/{cle}`
  retire `originalInterne` de la réponse).
- Démonstration explicitement signalée comme fictive, y compris dans le recueil public (bandeau).

**Non-conformités.** NC-II-003 (collections lisibles sans authentification), NC-II-005 (actes
individuels exposés), NC-II-008 (clé de moteur de langage rangée dans le référentiel).

**Recommandations.** Appliquer la classification aux routes : le public ne lit que le publié. (P-01,
P-05)

### II.2 — Comptes, authentification, habilitations

**Constat.** Il y a **deux modèles d'authentification**, très inégaux. **(1)** La plateforme de
démonstration s'authentifie par un **jeton d'API unique**, sans notion de rôle ; les comptes de
l'application n'y servent qu'à l'affichage et aux permissions d'interface — donc à rien de
contraignant. **(2)** Le service auto-hébergé, à l'inverse, est soigné : en mode `password`, scrypt
avec sel aléatoire par compte, comparaison à temps constant, session par jeton aléatoire de 32 octets
dont seule l'empreinte est en base, cookie `HttpOnly`, jeton anti-CSRF à double envoi, comptage des
échecs et blocage temporaire, et refus explicite des écritures `users`/`config` par un non-admin. Le
problème est que **le mode que la documentation met en avant** (« rien à installer ») est le premier.

**Points conformes.**
- Service auto-hébergé : scrypt (paramétrable, `SCRYPT_N`), sel par compte, comparaison à temps
  constant, rehachage automatique au besoin (`src/server/mysql/comptes.mjs`).
- Sessions par cookie `HttpOnly` ; jeton anti-CSRF à double envoi ; session et CSRF distincts ;
  `COOKIE_SECURE` par défaut, `SESSION_DAYS` plafonné.
- Protection contre l'énumération (empreinte factice) et contre les tentatives répétées.
- Le contrôle d'accès par rôles est **déclaré une seule fois** (`PERMS`, `src/lib/users.js`) et sert
  à la fois au contrôle et à la documentation affichée — bonne conception.

**Non-conformités.** NC-II-004 (aucune autorisation par rôle côté service ; jeton unique et
`force:true` accepté), NC-II-001 (le jeton est public).

**Recommandations.** Porter les rôles dans le service et refuser toute écriture hors périmètre. (P-01)

### II.3 — Sécurité applicative

**Constat.** Revue ligne à ligne du service (`index.html`, script serveur). Le service se défend bien
sur plusieurs points : SHA-256 synchrone implémenté à la main (pas de dépendance), réduction
systématique des entrées à des champs bornés (`normaliser*`), refus des corps trop volumineux,
sérialisation JSON propre, et gestion d'erreur qui ne fuit pas de pile au client. Le rendu des
**documents compilés** dans l'atelier est sain (construction par nœuds texte). Le point faible est
**une insertion `innerHTML`** de la version publiée dans la page publique, sans assainissement. Par
ailleurs, les erreurs de validation métier sont détaillées (codes stables), ce qui facilite
l'intégration.

**Points conformes.**
- Rendu des documents par nœuds texte (`textContent` / `createTextNode` dans `src/lib/render.js`) :
  pas d'injection par le contenu des actes dans l'atelier.
- Réduction systématique et bornage des champs d'entrée ; corps borné (`MAX_DOC`, `MAX_BODY`).
- Messages d'erreur structurés avec codes stables, sans trace technique exposée.
- Rendu Markdown de la documentation sans interprétation HTML (`src/ui/markdown.js`).

**Non-conformités.** NC-II-007 (insertion `innerHTML` de la version publiée).

**Recommandations.** Assainir la version en ligne avant insertion, ou la reconstruire depuis l'Akoma
Ntoso, et poser une CSP. (P-07)

### II.4 — Sécurité de l'API

**Constat.** Les routes sont lisibles et cohérentes (table `ROUTES`), mais la ligne de partage
public / protégé est mal placée. Sont **publiques sans jeton** : `GET /v1/actes`, `GET
/v1/actes/{id}`, `GET /v1/actes/{id}/document`, `GET /v1/signatures`, `GET /v1/signatures/{id}`,
`GET /v1/signatures/{id}/document-signe`, `GET /v1/publications*`, `GET /v1/eli/*`, **`GET
/v1/db/collections/{collection}`**, et `POST /v1/webhooks/signature`. Il n'existe **aucun** contrôle
d'accès par route ni par rôle : un même jeton ouvre toutes les écritures. La limitation de débit
(90 écritures/minute par connexion, `allowWrite`) protège les écritures mais pas les lectures.

**Points conformes.**
- Table de routage unique et lisible ; réponses normalisées ; idempotence (`Idempotency-Key`) et
  « idempotence en vol » sur le dépôt.
- Limitation de débit des écritures ; message d'erreur explicite en cas de dépassement.
- Journal des échanges consultable dans l'application (console API).

**Non-conformités.** NC-II-003 (lectures sensibles publiques), NC-II-001 et NC-II-004 (écritures à
jeton unique public), NC-II-009 (durcissement HTTP ; CORS `*` par défaut), NC-II-010 (débit et
journal, observation).

**Recommandations.** Définir explicitement la matrice « route × auth × rôle », protéger les lectures
d'actes non publiés et toute collection, authentifier le webhook. (P-02, P-05, P-09)

### II.5 — Signature, intégrité et non-répudiation

> **Point d'entrée du prompt §4.2 — « usurpation possible du signataire » : CONFIRMÉ, qualifié, documenté.**

**Constat.** Le point d'entrée est **vérifié**, et par deux voies indépendantes.

**(1) Côté service (NC-II-002).** La notification de signature (`POST /v1/webhooks/signature`) est
**publique** et non signée. Le seul contrôle est l'égalité de l'empreinte SHA-256 du document fourni
avec celle du dépôt — or le document déposé est lui-même **lisible sans jeton**
(`GET /v1/actes/{id}/document`). L'auditeur a reproduit la chaîne complète : dépôt d'un acte (201),
lecture du document sans en-tête (200), ouverture d'un circuit (202), notification **forgée sans
aucun en-tête** marquant l'acte `signee` avec un signataire arbitraire (200), puis publication au
recueil public sous ELI (201, acte visible dans `GET /v1/publications`). La publication a été
retirée après constat.

**(2) Côté application (NC-II-006).** Pour la signature « simple », l'identité signée est celle du
**signataire désigné par l'acte** (`auteurDe` lit `doc.meta.signataire`), jamais celle de
l'opérateur ; le contrôle amont ne vérifie ni la compétence ni la qualité du signataire ; l'action
n'est gardée que par `actes.signer`, accordée au rôle Rédacteur. Le certificat est engendré dans le
navigateur de l'opérateur, au nom déclaré.

**Ce que la signature garantit réellement.** L'intégrité (le document signé est bien celui déposé),
l'horodatage, et la **cohérence interne** du paquet (la valeur de signature vérifie contre la clé
publique embarquée dans le certificat). Elle ne garantit **pas l'identité** de l'auteur : n'importe
qui peut produire un certificat au nom de n'importe qui. Le vocabulaire de l'interface (« Signé »,
« signature horodatée et vérifiable ») dépasse donc ce que la mécanique établit.

**Points conformes.**
- Cryptographie réelle et vérifiable : ECDSA P-256 / SHA-256, certificat par titulaire, horodatage
  signé par une autorité distincte ; vérification refaite à la consultation.
- Contrôle d'intégrité systématique du document signé contre le document déposé (le document signé
  qui diverge est **refusé**, 409).
- Circuit de validation (parapheur) et circuit de révision positionnés **côté service** comme portes
  de la signature (refus 409 `validation_incomplete` / `revision_incomplete`).
- Chaîne « signé → transmis → publié » tenue par le **service**, non par le client.
- Partition public / interne de l'original, et vérification de cohérence de la certification externe.
- Documentation honnête sur le caractère non qualifié du certificat (guide et GITHUB).

**Non-conformités.** NC-II-002 (bloquante), NC-II-006 (majeure), NC-IV-001 (majeure, instruite au
chapitre IV).

**Recommandations.** Authentifier le prestataire sur le webhook ; vérifier l'identité de l'opérateur
contre la chaîne de signature avant de signer ; protéger la lecture du document déposé ; aligner le
vocabulaire de l'interface sur ce qui est réellement prouvé. (P-02, P-06)

### II.6 — Segmentation des environnements

> **Point d'entrée du prompt §4.2 — « démo et production insuffisamment segmentées » : CONFIRMÉ, qualifié, documenté.**

**Constat.** La segmentation repose sur des **réglages** (`mode`, `AUTH_MODE`, variables
d'environnement) et non sur des artefacts ou des instances distinctes. Trois conséquences vérifiées :
**(a)** le **même service** sert la démonstration et le recueil public ; **(b)** le **même jeton** de
démonstration est à la fois la clé d'écriture de la démonstration **et** celle utilisée pour publier
au recueil public ; **(c)** l'identité ELI et la configuration de démonstration (collectivité
fictive) produisent des identifiants et des URL de production apparente
(`https://www.valmont-sur-loire.fr/eli/…`) pour des actes de démonstration. Le bandeau
« DÉMONSTRATION », présent partout (bon point), atténue le risque de confusion pour un humain, mais
ne constitue pas une cloison technique : les données fictives et les écritures réelles partagent le
même état.

**Points conformes.**
- Bandeau de démonstration visible dans l'atelier **et** sur le recueil public, non masquable par
  l'utilisateur.
- La démonstration statique (GitHub Pages) est reconnue et son service embarqué étiqueté honnêtement
  (« Service embarqué — ce navigateur », rien n'est partagé).
- Un mode d'exploitation distinct existe (auto-hébergé), avec ses propres variables et sa propre
  base.

**Non-conformités.** NC-II-001, NC-II-003, NC-II-004 (les trois découlent de la non-segmentation),
NC-IV-002 (trajectoire de mise en service).

**Recommandations.** Une instance ne doit être que démonstration **ou** exploitation. En
démonstration ouverte : écritures locales au poste, aucun recueil public réel, jeton absent. En
exploitation : service dédié, jeton par client, hors du code servi. (P-01, P-11)

### II.7 — Journalisation, traçabilité, preuve

**Constat.** L'application journalise les gestes (collection `journal`), la présence des postes, et
les échanges API (console). Ces traces sont utiles à l'exploitation et à la collaboration. Elles ne
constituent **pas** une piste d'audit opposable : elles sont écrites par le même canal que le reste,
donc modifiables par qui peut écrire ; elles ne sont ni signées ni inaltérables ; et leur export /
rétention est explicitement **hors périmètre** (`src/SPEC.md` § 5). L'horodatage des actes est, lui,
porté par la signature et par la publication (bon point).

**Points conformes.**
- Journal applicatif des faits (« qui a fait quoi »), source des notifications, avec des entrées
  lisibles ; présence des postes pour la collaboration.
- Console API : chaque échange (requête, réponse, statut, durée) est consultable — outil de
  diagnostic réel.
- Horodatages portés par l'original signé et par la publication ; retraits et abrogations laissent
  une trace applicative.

**Non-conformités.** NC-II-010 (observation : journal non inaltérable, rétention hors périmètre).

**Recommandations.** Un journal d'audit append-only côté serveur, horodaté, exportable et conservé.
(P-10)

### II.8 — Secrets et configuration

**Constat.** En dehors du jeton d'API (NC-II-001, bloquant) et de la clé du moteur de langage
(NC-II-008), le projet tient une bonne discipline : aucun secret dans `docker-compose.yml` (tout
vient du `.env`), mots de passe jamais conservés (seule l'empreinte scrypt), clés de signature
confinées au poste. Le point noir est structurel : **le code servi est public**. Tout ce qui y est
écrit est lisible, et tout ce que l'application conserve dans sa configuration partageable l'est
aussi.

**Points conformes.**
- Aucun secret en dur dans les fichiers de déploiement ; `.env.example` explicite et commenté.
- Mots de passe jamais conservés en clair ; empreintes seules ; jetons révocables par retrait d'une
  ligne de configuration.
- Carte des clés publiques dans un dossier de stockage local dédié.

**Non-conformités.** NC-II-001 (bloquante), NC-II-008 (clé du moteur de langage), NC-II-011
(observation : transfert vers un moteur tiers).

**Recommandations.** Règle simple : **aucun secret dans ce qui est servi** ; injection par le
déploiement ; secrets hors du référentiel partagé. (P-01, P-08)

### II.9 — Protection des données à caractère personnel

**Constat.** Les données personnelles traitées sont celles des agents (comptes) et celles des
signataires (dossier interne). La partition public/interne est un **vrai** effort de minimisation
(bon point). Mais deux manquements : la lecture des collections expose les comptes (NC-II-003), et le
traitement associé aux assistants (questions transmises à un moteur de langage) n'est pas documenté
(NC-II-011). Aucune analyse d'impact n'est fournie, ni aucune mention de durées de conservation (le
mode démonstration évince par ancienneté, ce qui n'est pas une politique de conservation).

**Points conformes.**
- Minimisation par la partition public / interne de l'original (nom et fonction publics ; courriel,
  compte, authentification, courriels internes).
- Le service **retire** activement ces champs même si le client les lui laisse (`sansInterne`) —
  défense en profondeur appréciable.
- Consentement/avertissement explicite avant d'interroger un assistant ; l'atelier ne joint jamais le
  contenu des actes.

**Non-conformités.** NC-II-003, NC-II-005, NC-II-008, NC-II-011.

**Recommandations.** Protéger les comptes ; documenter les traitements (assistants) ; écrire la
politique de conservation. (P-01, P-05, P-08)

### II.10 — Continuité, gestion des incidents, homologation

**Constat.** Pour l'auto-hébergement, la documentation couvre la sauvegarde, la restauration, la
mise à jour et le dépannage (bon point). Pour la démonstration, aucune continuité n'est prévue — ce
qui est cohérent avec sa nature, mais doit être **écrit** pour éviter qu'on l'utilise en service.
Aucune démarche d'homologation (RGS, ANSSI) n'est engagée ni mentionnée ; aucune procédure de
gestion d'incident de sécurité (constat, qualification, notification CNIL) n'est documentée.

**Points conformes.**
- Procédures de sauvegarde / restauration / migration documentées et outillées pour l'auto-hébergé.
- Sonde de santé et journal applicatif pour la détection.

**Non-conformités.** NC-I-006 (observation), NC-II-010 (observation).

**Recommandations.** Rédiger une note « ce que la démonstration n'est pas » et une fiche
« incident de sécurité » minimale. (P-11)

---

## 5. Chapitre III — Qualité, accessibilité et expérience (qualiticien)

> **Question directrice.** « Est-ce que tout est là, est-ce que c'est accessible à tous, et est-ce
> que tout se comporte de la même façon ? »

### III.1 — Complétude fonctionnelle

**Constat.** L'outil tient l'essentiel de ses promesses ; les manques sont **déclarés** honnêtement
(`src/SPEC.md` § 5 « Hors périmètre v1 », `src/CHANGELOG.md` « Limites assumées »). Le tableau
ci-dessous confronte les promesses (accueil, README, GITHUB, SPEC) au réel.

| Exigence annoncée | Source | État constaté | Statut |
|---|---|---|---|
| Trames : structure, champs, règles exécutables, commentaires, import/export JSON | GITHUB « Ce que fait le logiciel » | Présent (`src/lib/schema.js`, `trame-format.js`, `doc-import.js`, import Word/ODT) | **Présente** |
| Éditeur de trame (glisser-déposer, inspecteur, commentaires) | GITHUB | Présent (`src/ui/views/editor.js`) | **Présente** |
| Rédaction en place, écarts « hors trame », contrôles | GITHUB | Présent (`src/lib/redaction.js`, `compile.js`) | **Présente** |
| Trois circuits de signature (électronique, simple, externe) | GITHUB | Présents (`src/lib/signature.js`, `src/ui/views/signature.js`) | **Présente** |
| Parapheur, révision avant envoi | SPEC § 2.8.1 | Présents (`src/lib/validation.js`, `revision.js`) | **Présente** |
| Exécution & délais, contrôle de légalité, recours | GITHUB | Présent (`src/lib/execution.js`, `legalite.js`) | **Présente** |
| Modifier / abroger / consolider, versions | GITHUB | Présent (`amend.js`, `revisions.js`, `abrogations.js`) | **Présente** |
| Recueil public, ELI, formats lisibles par machine | GITHUB | Présent (`src/lib/recueil.js`, `eli.js`) | **Présente** |
| Exports Akoma Ntoso 3.0, Schematron, JSON-LD, HTML, Word, Markdown, JSON | GITHUB, README | Présents (`src/lib/export.js`, `akn.js`) — AKN vérifié bien formé et complet | **Présente** |
| Guide intégré (24 chapitres, glossaire, dépannage) | GITHUB | Présent, 24 chapitres comptés (`src/wiki.js`) | **Présente** |
| Annuaire OIDC, comptes locaux | ADMINISTRATION § 4.3–4.4 | Présents (`src/lib/oidc.js`, `auth.js`, `motdepasse.js`) | **Présente** |
| Courriel (six notifications, SMTP) | GITHUB, ADMINISTRATION § 5.5 quinquies | Présent côté service auto-hébergé ; **indisponible** sur la démonstration (déclaré) | **Partielle (assumée)** |
| Assistants (Plume, Publia) | GITHUB, ADMINISTRATION § 5.5 ter | Présents et actifs par défaut | **Présente — mais SPEC les déclare hors périmètre** (NC-III-001) |
| Publication automatique dès signature | README, GITHUB | Présente (`DEFAULT_PUBLICATION.auto = true`) | **Présente** |
| Transmission au contrôle de légalité par API | SPEC § 2.8 (expérimental) | Simulée, éteinte par défaut | **Partielle (assumée)** |
| PDF/A certifié, bordereau SEDA, export `.docx` natif | SPEC § 5 | Absents | **Absente (déclarée)** |
| Bibliothèque de trames par URL publique | SPEC § 5 | Absente | **Absente (déclarée)** |
| Suppléance nominative, envoi réel des notifications, export du journal | SPEC § 5 | Absents | **Absente (déclarée)** |

**Lecture.** Aucune promesse **centrale** n'est absente sans avoir été déclarée. La seule
complétude fautive n'est pas un manque mais une **contradiction documentaire** : la SPEC range encore
l'assistant dans le hors-périmètre alors qu'il est livré.

**Points conformes.** Complétude réelle sur le cœur du métier ; honnêteté des limites déclarées ;
tableau des permissions et documentation alignés sur le code.

**Non-conformités.** NC-III-001.

**Recommandations.** Tenir le tableau « hors périmètre » à jour à chaque livraison. (P-11)

### III.2 — Accessibilité (RGAA 4.1 / WCAG 2.1 AA)

**Constat.** Vérifications automatisées dans la prévisualisation (DOM réel, recueil public et
atelier) : **aucun défaut de contraste** détecté sur les textes visibles (calcul du ratio appliqué
aux nœuds de texte effectivement rendus) ; tous les champs de formulaire ont une étiquette ou un nom
accessible ; aucune image sans attribut `alt` (les images décoratives ont un `alt` vide, ce qui est
correct) ; aucun `tabindex` positif ; la prise de focus est visible (règle `:focus-visible` globale,
outline 2 px) ; la langue est déclarée (`lang="fr"`). Deux manques réels : pas de **lien
d'évitement** sur le recueil public (RGAA 12.7), et des **cibles tactiles trop petites** sur les
contrôles du carrousel.

**Points conformes.**
- Contrastes conformes (aucun échec relevé, texte normal et grand texte) sur les écrans testés.
- Focus visible et homogène ; composants natifs (`button`, `a`, `input`) plutôt que des `div`
  cliquables ; libellés `aria-label` sur les commandes iconiques du carrousel.
- Structure de titres correcte sur le recueil (un `h1`, puis `h2`/`h3` sans saut de niveau).
- Langue déclarée ; images décoratives marquées ; repères `header` / `main` / `footer` présents.
- Impression : feuilles `@media print` présentes et cohérentes (masquage de la navigation, format
  A4) — vérifié dans le code, non vérifié visuellement (annexe C).

**Non-conformités.** NC-III-002 (lien d'évitement), NC-III-003 (cibles tactiles), NC-III-005
(observation : titre de document, repères).

**Recommandations.** Ajouter le lien d'évitement et agrandir les cibles tactiles. (P-13)

### III.3 — Ergonomie et parcours

**Constat.** Les parcours sont découpés en étapes numérotées affichées dans l'application (circuit de
signature en six marche), les actions sont contextuelles et les états (vide, chargement, erreur,
succès) sont prévus ; les erreurs métier sont expliquées en français et souvent accompagnées de la
porte à franchir (« Révision requise avant la signature »). Les actions destructrices demandent
confirmation (retrait de publication avec motif). L'ensemble est de bonne tenue.

**Points conformes.**
- Circuits visualisés en étapes, avec l'état de chaque porte (parapheur, révision, dépôt, signature,
  publication).
- États vides et de chargement traités ; messages d'erreur actionnables.
- Confirmations explicites et **motif exigé** sur le geste de retrait.

**Non-conformités.** aucune propre (voir recoupement NC-III-001, qui fausse la prévision du
parcours).

**Recommandations.** Aligner le guide sur le parcours réel. (P-11)

### III.4 — Cohérence des interfaces

**Constat.** Le design est homogène (composants, vocabulaire, ordre des actions, pastilles de statut)
et s'appuie sur un système cohérent (classes `fr-*`). Une seule rupture relevée : la note de pied de
page du recueil est centrée alors que tout le reste est aligné à gauche.

**Points conformes.**
- Vocabulaire et composants cohérents d'un écran à l'autre ; statuts colorés normalisés.
- États de chargement, de vide et d'erreur présents dans les vues.

**Non-conformités.** NC-III-004.

**Recommandations.** Corriger l'alignement. (P-13)

### III.5 — Compréhension et aide

**Constat.** Le guide intégré (24 chapitres) est écrit dans une langue simple, sans jargon, avec des
cas « que faire si… », un glossaire et une fiche mémo imprimable ; l'aide contextuelle est présente
sur les écrans (bouton « Comment faire ? ») ; les messages emploient la langue des services. C'est un
point fort réel. La réserve est que le guide décrit parfois un outil qui n'est plus tout à fait
celui-ci (NC-III-001).

**Points conformes.**
- Guide de 24 chapitres accessible depuis l'application, recherche interne, glossaire, mémo.
- Aide contextuelle par écran ; messages en français administratif clair, sans faute relevée.

**Non-conformités.** NC-III-001 (contradiction sur la signature et l'envoi).

**Recommandations.** Corriger le chapitre « Bienvenue ». (P-11)

### III.6 — Robustesse et adaptation

**Constat.** Vérifié en conditions réelles à **390 × 844** (mobile) et **1440 × 1000** (poste) : aucun
débordement horizontal, aucune superposition sur les écrans testés (recueil public, écran de
signature). Le recueil adapte sa mise en page (carrousel et liste en une colonne, filtres repliés) ;
les blocs de recherche et de filtres restent utilisables. Le masquage des sections pendant une
recherche active est un comportement volontaire (attribut `hidden`), et non un défaut d'affichage —
vérifié. La navigation clavier est possible (éléments natifs, focus visible). Réserve : le rendu
exact d'**impression** n'a pas pu être vérifié visuellement.

**Points conformes.**
- Responsive effectif (aucun débordement à 390 px ni à 1440 px sur les écrans testés).
- Feuilles `@media print` présentes et structurées (A4, marges, masquages) — non vérifié visuellement.
- Navigation clavier possible ; prise de focus visible.

**Non-conformités.** NC-III-003 (cibles tactiles), NC-III-005 (observation).

**Recommandations.** Agrandir les cibles ; vérifier l'impression sur poste. (P-13)

### III.7 — Qualité mesurée

**Constat.** L'outil **se vérifie lui-même** : les actes sont confrontés à leur trame (contrôles
bloquants / avertissements, écarts « hors trame » conservés et signalés), la conformité est
recalculée, et un rapport de conformité est produit. C'est une qualité mesurée *dans* le produit.
En revanche, l'outil **lui-même** n'est pas mesuré : aucun indicateur de qualité logicielle, aucune
campagne de tests, aucun seuil d'acceptation (renvoi NC-I-001).

**Points conformes.**
- Contrôles de conformité de l'acte à la trame, avec niveaux bloquant / avertissement.
- Écarts « hors trame » conservés et signalés, plutôt que silencieusement corrigés.
- Vérification de la signature refaite à la consultation de l'acte publié.

**Non-conformités.** aucune propre (renvoi NC-I-001).

**Recommandations.** Définir un socle d'indicateurs (tests, couverture des parcours critiques). (P-03)

### III.8 — Documentation utilisateur et formation

**Constat.** Le guide est complet et pédagogique ; la fiche mémo imprimable sert la formation. Les
réserves sont de **justesse** : le guide et le README public contredisent l'outil sur la signature,
l'envoi de messages et les services tiers (NC-III-001), et la SPEC (§ 5) est en retard sur le code.
Aucun support de formation dédié n'est fourni (les chapitres peuvent en tenir lieu).

**Points conformes.**
- Guide exhaustif par écran, orienté « un geste par étape », avec fiche mémo pour la formation.
- Documentation technique **lue depuis le dépôt** dans l'application (jamais désynchronisée du
  fichier réel).

**Non-conformités.** NC-III-001.

**Recommandations.** Reprendre les passages contredits par l'outil. (P-11)

---

## 6. Chapitre IV — Conformité et valeur juridiques (DAJ / assemblées)

> **Question directrice.** « Est-ce que les actes produits ici sont juridiquement sûrs, opposables,
> archivables, et est-ce que ça améliore vraiment ce que produit mon administration ? »

### IV.1 — Conformité des actes et du cycle réglementaire

**Constat.** Le cycle est outillé sérieusement : élaboration sur trame avec contrôles ; signature ;
**transmission au contrôle de légalité** (étape distincte, la transmission — et non la publication —
faisant courir le délai de deux mois) ; **publication** avec date ; **opposabilité** calculée (au
lendemain, ou après N jours) ; **exécutoire** = dernière formalité requise ; délai de recours
contentieux de **deux mois** ; suivi d'un **recours introduit** qui ferme le délai et interdit
d'attester à tort l'absence de recours ; abrogation et modification avec entrée en vigueur à l'effet
de l'acte porteur. Le service refuse de publier un acte non signé, un acte déclaré non publiable, ou
un acte soumis au contrôle de légalité non transmis. C'est un travail de fond, rare, et qui mérite
d'être souligné.

**Points conformes.**
- Dates distinctes et calculs corrects : signature, publication, opposabilité, exécutoire, recours.
- Refus côté **service** des publications irrégulières (non signé, non publiable, non transmis) —
  la règle n'est pas seulement affichée, elle est appliquée.
- Transmission au contrôle de légalité comme étape propre, avec accusé de réception conservé sur le
  document (certificat).
- Abrogation possible **dès la rédaction**, visa d'un acte ou d'un article, effet à l'entrée en
  vigueur, mentions « Modifié / Abrogé / Ajouté par ».
- Retrait de publication traité comme **geste exceptionnel** : motif technique exigé, trace
  conservée, réversibilité, et documentation qui dit que l'acte se modifie ou s'abroge plutôt que de
  se retirer.

**Non-conformités.** NC-IV-004 (télétransmission simulée, mineure).

**Recommandations.** Brancher la vraie télétransmission ou marquer sans ambiguïté la mention de
démonstration. (P-10)

### IV.2 — Interopérabilité et normes

**Constat.** Vérifié en exécution : les exports Akoma Ntoso 3.0 des actes publiés sont **bien formés**
(XML parsé, espace de noms `http://docs.oasis-open.org/legaldocml/ns/akn/3.0`) et **complets**
(FRBRWork / FRBRExpression / FRBRManifestation, pays, numéro, dates, auteur, titre, préface,
préambule, corps, conclusions, annexes, cycle de vie). Les JSON-LD parsent et portent le vocabulaire
ELI et schema.org. Les représentations Markdown et texte existent. Le Schematron est produit comme
traduction **partielle et assumée** des règles métier (les règles non traduisibles sont conservées en
commentaire, jamais inventées — honnêteté notable). Réserve : l'identifiant ELI lui-même n'est pas
résoluble et diverge de l'URI du document Akoma Ntoso.

**Points conformes.**
- Akoma Ntoso 3.0 : document bien formé et complet (vérifié sur six publications), avec niveaux FRBR
  et métadonnées ELI.
- JSON-LD/ELI, Markdown, texte brut, HTML autonome produits pour chaque publication.
- Schematron produit et documenté comme partiel, avec mention explicite des limites.
- Journal des versions et licence des formats : exports ouverts, sans dépendance à l'éditeur.

**Non-conformités.** NC-IV-003 (ELI non résoluble et divergent).

**Recommandations.** Uniformiser l'identifiant ELI (URI HTTP canonique, identique partout). (P-14)

### IV.3 — Sécurité juridique et valeur probante

**Constat.** C'est la faiblesse la plus lourde du chapitre, et elle irrigue les autres. L'original
signé est conservé, partitionné, et sa signature est vérifiable — mais la vérification porte sur la
cohérence **interne** du paquet : elle ne prouve pas qui a signé (NC-IV-001). La clé privée est
rangée en clair dans le stockage du navigateur. Dans le circuit externe, la « certification de
conformité » est une **déclaration** de l'opérateur (le service ne vérifie pas la signature du PDF,
il enregistre une empreinte), et une nouvelle version signée annule la certification précédente
(heureuse prudence). La chaîne de conservation et l'archivage légal (NF Z42-013) ne sont pas
couverts : le format d'archivage est l'export, pas un paquet d'archivage.

**Points conformes.**
- Original signé conservé et partitionné ; vérification d'intégrité refaite à la consultation.
- Horodatage signé par une autorité distincte ; empreinte du document figée au dépôt.
- Le service **refuse** une certification qui ne porte pas sur la pièce déposée (empreintes
  différentes).
- Une nouvelle version signée remet à zéro la certification de conformité.

**Non-conformités.** NC-IV-001 (majeure), NC-IV-004 (mineure).

**Recommandations.** Signature qualifiée branchée en production ; ne pas nommer « signé » ce qui
n'est qu'attribué. (P-06, P-10)

### IV.4 — Cycle de vie de l'acte

**Constat.** Le cycle est bien outillé : de la trame au recueil, avec **modification** (édition en
place puis consolidation), **abrogation** (acte ou article), **versions** publiées sous un même ELI et
« version en vigueur » mise en avant, **retrait exceptionnel**, et un historique des brouillons.
Réserve : sur une version consolidée, l'articulation entre la consolidation et l'original signé n'est
pas suffisamment explicitée à l'écran.

**Points conformes.**
- Versions multiples sous le même ELI, avec version en vigueur identifiée et historique consultable.
- Consolidation informative assumée (la mention dit que seul l'original fait foi).
- Abrogation et modification tracées, avec mentions de modification dans le texte.

**Non-conformités.** NC-IV-005 (observation).

**Recommandations.** Rendre plus explicite la valeur de la version consolidée. (P-14)

### IV.5 — Collaboration et gouvernance

**Constat.** Présents : parapheur (circuit de validation par le référentiel, avec décisions
motivées), révision avant signature avec compétence paramétrable par service/famille/type d'acte,
délégations et subdélégations avec organigramme lisible par tous et modifiable par les seuls
éditeurs/administrateurs, réattribution de numéro, présence des postes et verrou souple. Le verrou de
rédaction **avertit sans empêcher** (déclaré hors périmètre pour la version « exclusive »).

**Points conformes.**
- Circuit de révision avec compétence limitée et configurable ; refus de signer un acte non révisé,
  appliqué **côté service**.
- Délégations / subdélégations et organigramme ; rapprochement du compte de l'outil de signature.
- Journal des gestes et notifications ; présence des postes et verrou souple signalé.

**Non-conformités.** aucune propre.

**Recommandations.** Documenter le caractère **non bloquant** du verrou souple. (P-11)

### IV.6 — Qualité du droit produit

**Constat.** L'outil agit positivement sur la qualité rédactionnelle : structure imposée par la
trame, contrôles bloquants et avertissements, écarts « hors trame » visibles, vocabulaire et mentions
paramétrables (voies et délais de recours, portée informative), charte graphique conforme aux usages,
et un contrôle de légalité **interne** par la révision. C'est précisément l'apport de valeur :
empêcher la ressaisie et les oublis, rendre visible l'écart.

**Points conformes.**
- Contrôles de conformité et signalement visible des écarts ; mentions de recours paramétrables.
- Feuilles de style (charte) appliquées de façon homogène au papier, au PDF et à la version en ligne.
- Contrôle interne (révision) et circuit de validation (parapheur) disponibles.

**Non-conformités.** aucune propre.

**Recommandations.** Aucune spécifique.

### IV.7 — Transparence, données ouvertes et protection

**Constat.** Le recueil public, ouvert sans compte, avec adresses citables, identifiant ELI et
représentations lisibles par machine, est un vrai service rendu aux administrés — c'est un point
fort. Mais **aucune condition de réutilisation** n'est publiée, alors que la publicité de ces
conditions est une obligation légale pour les documents administratifs diffusés en ligne ; et la
protection des données personnelles repose sur un cloisonnement partiel seulement (les actes
individuels restent lisibles, les comptes sont exposés — chapitre II).

**Points conformes.**
- Recueil public accessible sans compte, avec recherche, classement par thème et par année.
- Adresses citables, identifiant ELI, JSON-LD/Schema.org, Markdown et texte brut pour les moteurs et
  les agents.
- Séparation public / interne de l'original et avertissement sur les assistants.

**Non-conformités.** NC-IV-002 (licence), avec recoupement NC-II-005 et NC-II-011.

**Recommandations.** Afficher une licence de réutilisation et l'exposer dans les métadonnées. (P-12)

### IV.8 — Valeur d'usage et soutenabilité

**Constat.** La valeur d'usage est réelle : tout est réglable sans toucher au code (entités,
services, personnes, rôles, types d'actes, circuits, délais, numérotation, charte), les données
s'exportent, l'installation tient en quelques commandes, et un mode « rien à installer » permet
d'essayer. La soutenabilité est en revanche fragilisée par l'absence de tests et de chaîne
d'intégration (chapitre I) et par la dépendance à la plateforme en mode démonstration. Le coût de
formation est faible grâce au guide ; le coût de reprise par un tiers reste élevé à cause des
monolithes.

**Points conformes.**
- Configuration intégralement externalisée dans le référentiel ; exports complets.
- Guide utilisateur (formation) et documentation d'administration (exploitation).
- Deux voies de déploiement (statique simple, serveur complet).

**Non-conformités.** recoupements NC-I-001, NC-I-002, NC-I-003.

**Recommandations.** Investir dans les tests et la modularité avant toute mise en service réelle.
(P-03, P-04)

---

## 7. Chapitre V — Synthèse transversale

**Recoupements entre chapitres.**

| Faisceau | Chapitres | Nature |
|---|---|---|
| Démonstration et exploitation non segmentées | II.6 (premier instructeur), I.7, IV.2 | La même racine produit trois effets : écritures ouvertes (II), dépendance à un tiers (I), actes de démonstration publiés « comme en production » (IV). |
| Absence de barrière serveur | II.2 → II.4 → II.5 | Un unique jeton public (II.2/II.4) rend la signature forgeable (II.5) : ce n'est pas trois défauts indépendants mais un seul manque d'autorisation. |
| Documentation en retard sur le code | III.8 (premier instructeur), I.8, IV.2 | Guide, SPEC et README public divergents ; en corriger un sans les autres laisse la contradiction. |
| Reprise par un tiers | I.2/I.3/I.8 → IV.8 | Monolithes, absence de tests et de CI élèvent le coût de reprise et pèsent sur la soutenabilité. |
| Confiance dans la signature | II.5 → IV.3 → IV.1 | L'identité non garantie (II) et la télétransmission simulée (IV) affaiblissent la valeur probante d'un outil par ailleurs rigoureux sur les délais. |

**Risques systémiques.**

1. **Le démonstrateur fait fonction de production.** Le recueil public est réel, l'API est réelle,
   mais les protections supposent un environnement de démonstration. Tant que la segmentation n'est
   pas technique, tout durcissement restera local.
2. **La sécurité repose sur l'interface.** Les permissions `PERMS` sont appliquées dans le navigateur
   seulement ; le code étant public, elles ne contraignent rien. La bonne nouvelle est que la brique
   serveur **existe déjà** (`src/server/mysql/`) et sait faire ce qui manque.
3. **Le capital de confiance dépasse le capital de preuve.** L'outil *paraît* sûr (« Signé »,
   « vérifiable », « contre la préfecture ») plus qu'il ne l'*est* (identité non vérifiée,
   transmission simulée). C'est le risque le plus dommageable en matière administrative.
4. **La documentation constitue un actif… à double tranchant.** Riche et honnête sur les limites,
   elle affirme par ailleurs des choses fausses sur des points sensibles (signature, services
   tiers), ce qui constitue un risque en cas de contrôle ou de contentieux.

**Contradictions relevées.**

- SPEC § 5 (« assistant hors périmètre ») vs `main.pjs` et le store (assistants livrés et activés).
- Guide chapitre « Bienvenue » (« ne signe pas / n'envoie pas ») vs circuits de signature et service
  de courriel.
- `src/docs/GITHUB.md` (« n'envoie rien à un service tiers ») vs assistants interrogés.
- CHANGELOG 1.0.0 (« aucun appel sortant réel ») — exact pour la signature, mais le service émet par
  ailleurs des connexions (relais de numérotation via `super-fetch`) ; à nuancer.
- README (jeton « pas un secret ») vs un recueil public qui en dépend pour écrire.

**Arbitrages à rendre par le prescripteur.**

1. **Usage de la démonstration.** Confirme-t-on que `perchance.org/scribae` est un démonstrateur
   ouvert (données fictives, écritures locales, pas de recueil « réel ») — ou attend-on qu'il serve
   de recette à une mise en service ? La réponse commande l'urgence de P-01/P-02.
2. **Niveau de signature visé.** Signature simple interne (usage courant), avancée, ou qualifiée
   ? Le choix fixe le prestataire, le coût et le vocabulaire de l'interface.
3. **Périmètre de publication.** Le recueil est-il l'instrument officiel de publicité (alors la
   licence de réutilisation et l'archivage deviennent obligatoires), ou un canal secondaire ?
4. **Cible d'hébergement.** Plateforme (rapide) ou serveur de la collectivité (maîtrisé) ? Le second
   est prêt ; le premier suppose d'accepter les limitations du service embarqué.
5. **Conservation.** Que doit-on conserver, combien de temps, et sous quel format d'archivage ?

---

## 8. Plan d'action — propositions à réaliser

Effort : F (faible, ≤ 1 jour-homme), M (moyen, 2–10 j-h), É (élevé, > 10 j-h). Coût indicatif en
journées-hommes (j-h) ; le porteur est indicatif.

### Horizon 0–30 jours (urgences et gains rapides)

| Id | Proposition | NC couvertes | Bénéfice | Effort | Coût | Porteur | Dépendances |
|---|---|---|---|---|---|---|---|
| **P-01** | **Sortir le jeton d'écriture du code servi** : injecter le jeton par le déploiement (le service auto-hébergé le fait déjà via `API_TOKEN`) ; sur la démonstration, supprimer le jeton et n'autoriser que les écritures locales. | NC-II-001, NC-II-004, NC-II-006 | Ferme l'accès en écriture à tout tiers ; supprime l'élévation de privilèges. | M | 4–6 | DSI/RSSI | aucune (brique existante) |
| **P-02** | **Authentifier le webhook de signature** (secret partagé/HMAC ou mTLS) et **protéger la lecture du document déposé** ; vérifier au moins que la notification provient du prestataire attendu. | NC-II-002, NC-II-005 | Supprime la forge de signature et la fuite du document déposé. | M | 5–8 | RSSI | P-01 |
| **P-03** | **Socle qualité** : premier lot de tests automatisés (modules purs `compile`, `expr`, `execution`, `numbering`, `eli`, `akn`), pipeline minimal (lint + tests), `package-lock.json`, images Docker épinglées. | NC-I-001, NC-I-002 | Rend les évolutions sûres et les livraisons reproductibles. | M | 6–10 | DSI | aucune |
| **P-11** | **Remettre la documentation au réel** : corriger le guide « Bienvenue », sortir l'assistant du hors-périmètre SPEC, nuancer le README public, écrire noir sur blanc ce que la démonstration n'est pas et le caractère non bloquant du verrou souple. | NC-III-001, NC-I-006 | Supprime les affirmations fausses ; sert la soutenabilité et la défense en cas de contrôle. | F | 2–3 | DAJ + éditeur | aucune |
| **P-12** | **Trancher la licence** : licence de réutilisation affichée sur le recueil (et dans le JSON-LD), licence du logiciel, droits du code généré. | NC-IV-002, NC-I-005 | Satisfait l'obligation de publicité des conditions de réutilisation. | F | 1–2 | DAJ | arbitrage n°3 |

### Horizon 30–90 jours

| Id | Proposition | NC couvertes | Bénéfice | Effort | Coût | Porteur | Dépendances |
|---|---|---|---|---|---|---|---|
| **P-04** | **Découper et dédupliquer** : extraire la règle « partie publique de l'original » et l'empreinte en un point unique ; renommer `revisions.js` ; découper `signature.js`, `referentiel.js`, `app.css` ; scinder le README en documents thématiques. | NC-I-003, NC-I-004, NC-I-005 | Baisse le coût de reprise ; supprime le risque de divergence de règle. | M | 8–15 | DSI | P-03 |
| **P-05** | **Protéger les actes non publiés** : exiger une session ou un jeton pour `GET /v1/actes*` et `GET /v1/signatures*` ; ne laisser ouvert que le publié. | NC-II-005, NC-II-003 | Protège les actes individuels (sanctions, revalorisations) et les circuits. | M | 3–5 | RSSI | P-01 |
| **P-06** | **Vérifier l'identité du signataire** : comparer l'opérateur à la chaîne de signature (`competenceDuCompte`) et refuser la signature hors compétence ; tracer l'opérateur distinctement du signataire ; adapter le vocabulaire (« signature de démonstration, non opposable »). | NC-II-006, NC-IV-001 | Rétablit le principe « qui signe, signe » et la non-répudiation. | M | 4–7 | RSSI + DAJ | P-01 |
| **P-07** | **Assainir la version en ligne** avant insertion (`innerHTML`), ou la reconstruire depuis l'Akoma Ntoso ; poser une CSP. | NC-II-007 | Ferme l'XSS stocké sur la page publique. | M | 3–5 | RSSI | aucune |
| **P-08** | **Sortir les secrets du référentiel** : clé du moteur de langage hors de la configuration partagée et des exports ; documenter le transfert vers le moteur (art. 13/28) ; proposer l'extinction par défaut des assistants. | NC-II-008, NC-II-011 | Conformité RGPD et hygiène des secrets. | M | 3–6 | RSSI | P-01 |
| **P-09** | **Durcir les valeurs par défaut** : CORS restreint à l'origine de l'application, `AUTH_MODE=password` recommandé, en-têtes de sécurité, comparaison de jeton à temps constant. | NC-II-009, NC-II-010 | Réduit la surface d'attaque à l'installation. | F | 2–3 | RSSI | aucune |
| **P-13** | **Accessibilité** : lien d'évitement sur le recueil, cibles tactiles ≥ 24 px (points du carrousel, croix de recherche, fermeture d'assistance), alignement de la note de pied, titre de document par écran, repère de navigation. | NC-III-002, NC-III-003, NC-III-004, NC-III-005 | Conformité RGAA/WCAG et confort mobile. | F | 2–4 | qualiticien | aucune |

### Horizon 90–180 jours

| Id | Proposition | NC couvertes | Bénéfice | Effort | Coût | Porteur | Dépendances |
|---|---|---|---|---|---|---|---|
| **P-10** | **Preuve et traçabilité** : journal d'audit append-only côté serveur, horodaté et exportable ; conservation/archivage définis ; télétransmission au contrôle de légalité réelle **ou** mention de démonstration non ambiguë. | NC-II-010, NC-IV-004, NC-IV-001 | Rend la piste d'audit opposable et lève l'ambiguïté de la transmission. | É | 12–20 | RSSI + DAJ | P-01, P-06 |
| **P-14** | **Interopérabilité ELI** : URI ELI HTTP canonique identique dans la publication, le JSON-LD et l'Akoma Ntoso ; clarté de la version consolidée (mention « ne fait pas foi » reliée à l'original). | NC-IV-003, NC-IV-005 | Interopérabilité réelle et lisibilité juridique des versions. | M | 5–8 | DAJ + DSI | P-03 |

### Au-delà

| Id | Proposition | NC couvertes | Bénéfice | Effort | Coût | Porteur |
|---|---|---|---|---|---|---|
| **P-15** | **Segmentation technique des environnements** : instances distinctes démonstration / recette / production, jeux de données étanches, aucun identifiant partagé ; puis homologation (RGS/ANSSI), plan de reprise, gestion des incidents. | NC-II-006, NC-I-006, NC-II-010 | Supprime la cause racine du chapitre II. | É | > 30 | DSI + RSSI |
| **P-16** | **Signature qualifiée** : brancher la chaîne eIDAS de la collectivité, cachet serveur ou porte-clés matériel, et archivage légal (paquet d'archivage). | NC-IV-001 | Valeur probante pleine et conservation légale. | É | > 25 | DAJ + DSI |

---

## 9. Annexe A — Registre des non-conformités (extrait cumulé)

L'extrait ci-dessous est **identique** au fichier `src/audit/REGISTRE-NON-CONFORMITES.md` (fiches
complètes : constat, exigence, preuve, recommandation, effort, priorité, échéance, statut, origine).

| Id | Gravité | Chapitre | Constat (résumé) | Statut |
|---|---|---|---|---|
| NC-I-001 | Majeure | I.3 | Aucun test automatisé du code client (seuls deux tests, côté serveur). | Ouverte |
| NC-I-002 | Majeure | I.3/I.4 | Aucune CI, aucun lint, aucun verrou de dépendances ; images Docker flottantes. | Ouverte |
| NC-I-003 | Mineure | I.2/I.8 | Fichiers monolithiques (jusqu'à 3 146 lignes ; README de ~215 Ko). | Ouverte |
| NC-I-004 | Mineure | I.1/I.2 | Règle « partie publique de l'original » et empreinte SHA-256 implémentées plusieurs fois. | Ouverte |
| NC-I-005 | Observation | I.2/I.5 | Nommage ambigu `revision.js`/`revisions.js` ; licence et droits du code généré non tranchés. | Ouverte |
| NC-I-006 | Observation | I.6 | Le mode démonstration n'est pas un mode de conservation (état évidé par ancienneté). | Ouverte |
| **NC-II-001** | **Bloquante** | II.8/II.6 | Jeton d'écriture publié dans le code client, portée globale. | Ouverte |
| **NC-II-002** | **Bloquante** | II.5 | Webhook de signature public, intégrité fondée sur une empreinte publique : signature forgeable. | Ouverte |
| **NC-II-003** | **Bloquante** | II.1/II.4 | Collections (dont comptes) lisibles sans authentification. | Ouverte |
| NC-II-004 | Majeure | II.2/II.4 | Aucune autorisation par rôle côté service ; jeton unique ; `force:true` accepté. | Ouverte |
| NC-II-005 | Majeure | II.1/II.9 | Actes individuels (non publiables) exposés publiquement. | Ouverte |
| NC-II-006 | Majeure | II.2/II.5 | Usurpation du signataire : l'identité signée est celle de l'acte, non de l'opérateur. | Ouverte |
| NC-II-007 | Majeure | II.3 | Injection HTML stockée dans le recueil public (XSS). | Ouverte |
| NC-II-008 | Mineure | II.8 | Clé d'accès d'un moteur de langage conservée en clair dans le référentiel. | Ouverte |
| NC-II-009 | Mineure | II.3/II.4 | Durcissement HTTP insuffisant ; CORS `*` par défaut. | Ouverte |
| NC-II-010 | Observation | II.7/II.4 | Comparaison de jeton non à temps constant ; journal non inaltérable ; rétention hors périmètre. | Ouverte |
| NC-II-011 | Observation | II.9 | Questions d'assistance transmises à un moteur tiers, sans documentation RGPD. | Ouverte |
| NC-III-001 | Majeure | III.8 | Documentation contredisant l'outil (guide, SPEC, README public). | Ouverte |
| NC-III-002 | Mineure | III.2 | Pas de lien d'évitement sur le recueil public (RGAA 12.7). | Ouverte |
| NC-III-003 | Mineure | III.2/III.6 | Cibles tactiles de 8 × 8 px (carrousel, croix, fermeture). | Ouverte |
| NC-III-004 | Mineure | III.4 | Note de pied centrée, contenu aligné à gauche. | Ouverte |
| NC-III-005 | Observation | III.2/III.5 | Titre de document non posé dans l'atelier ; aucun repère de navigation sur le recueil. | Ouverte |
| NC-IV-001 | Majeure | IV.3 | Identité du signataire non garantie ; clé privée en clair dans le navigateur. | Ouverte |
| NC-IV-002 | Majeure | IV.7 | Absence de licence de réutilisation au recueil ; licence logicielle indéfinie. | Ouverte |
| NC-IV-003 | Mineure | IV.2 | Identifiant ELI non résoluble ; divergence ELI ↔ `FRBRuri` Akoma Ntoso. | Ouverte |
| NC-IV-004 | Mineure | IV.1/IV.3 | Télétransmission simulée produisant un certificat fabriqué localement. | Ouverte |
| NC-IV-005 | Observation | IV.4 | Version consolidée : opposabilité et articulation à l'original à clarifier. | Ouverte |

---

## 10. Annexe B — Grille de cotation (rappel du §6.1 du cadre)

| Cote | Définition | Effet attendu |
|---|---|---|
| **Bloquante** | Empêche la mise en service, la sécurité juridique ou la sécurité tout court. | Correction avant toute exploitation réelle. |
| **Majeure** | Défaut de conformité ou de sécurité avéré, à impact réel, mais contournable. | Correction planifiée et suivie. |
| **Mineure** | Écart réel mais d'impact limité, gênant la qualité ou l'usage. | Correction dans un lot d'amélioration. |
| **Observation** | Point de vigilance, risque futur, ou bonne pratique manquante. | À instruire, sans correction obligatoire. |
| **Point conforme** | Satisfait une exigence. | À préserver ; à documenter. |

La cotation tient compte de la probabilité, de l'impact et de la réversibilité. Une non-conformité
est cotée au niveau du chapitre qui l'instruit en premier ; les recoupements sont signalés au
chapitre V.

---

## 11. Annexe C — Journal d'audit

### Chronologie et temps passé

| Phase | Contenu | Durée |
|---|---|---|
| Cadrage | Chargement du cadre et de ses annexes (inexistantes : créées), détermination de `APP_VERSION`, lecture de `main.pjs`, `index.html` (script serveur), structure des documents (README, SPEC, TODO, CHANGELOG, ADMINISTRATION, GITHUB, server). | ~10 min |
| Chapitre I (DSI) | Architecture (modules, contrat de persistance, portage serveur), inventaire des fichiers et des tailles, recherche de tests/CI/lint/verrou, gouvernance (`version.js`, changelog), dépendances (plugins, Docker, `package.json`). | ~16 min |
| Chapitre II (RSSI) | Lecture ligne à ligne du service ; revue de `auth`, `users`, `motdepasse`, `oidc`, `signature`, `externe`, `assistant`, `db/*`, `remote` ; **tests dynamiques** des routes (lecture de collection sans jeton, écriture avec le jeton public, forge de signature et publication, nettoyage) ; analyse des injections et des secrets. | ~22 min |
| Chapitre III (qualiticien) | Parcours publics et atelier (connexion, rôles), **tests de viewport** 390 × 844 et 1440 × 1000, mesures de débordement et de cibles tactiles, audit automatisé (titres, repères, étiquettes, `alt`, `tabindex`, `aria-live`), calcul de contrastes, lecture du guide (24 chapitres) et comparaison au réel, captures d'écran visuelles. | ~20 min |
| Chapitre IV (DAJ) | Cycle réglementaire, délais et recours (`execution.js`), exports publiés (parsing XML de six publications, JSON-LD, Markdown), ELI, valeur probante, licence, versions. | ~14 min |
| Synthèse, plan d'action, rédaction | Recoupements, arbitrages, propositions, registre, rapport. | ~10 min |
| **Total** | | **≈ 1 h 32** |

### Vérifications effectuées (échantillon)

- Exécution réelle de l'application (rechargement, connexion par un compte de démonstration, parcours
  d'écrans, recherche au recueil) ; lecture des erreurs de console et des erreurs du moteur.
- Appels d'API réels depuis le canal du service : `GET /v1/health`, `GET /v1/db/collections/{c}`,
  `POST …/sync` (sans jeton puis avec le jeton), `POST /v1/actes`, `GET /v1/actes/{id}/document`,
  `POST /v1/actes/{id}/signature`, `POST /v1/webhooks/signature`, `POST /v1/actes/{id}/publication`,
  `POST /v1/publications/{cle}/retrait`, `GET /v1/publications`, `GET /v1/publications/{cle}`.
- Analyse des exports publiés : XML parsé (six publications bien formées, espace de noms Akoma Ntoso
  3.0), JSON-LD parsé, Markdown et texte présents.
- Mesures d'accessibilité : contrastes (aucun échec), étiquettes de formulaire, `alt`, repères, ordre
  des titres, `tabindex`, `aria-live`, focus visible.
- Mesures de mise en page : 390 × 844 et 1440 × 1000, débordement horizontal (aucun), tailles des
  cibles interactives (relevé des 10 plus petites).
- Captures visuelles : page d'accueil du recueil (hero, résultats), recueil en mobile, atelier
  (signature) en mobile.

### Ce qui n'a pas pu être vérifié (et pourquoi)

- **Usurpation du signataire par l'interface** : le parcours a été établi par lecture du code
  (`auteurDe`, `signerSimple`, `engagerSignatureSimple`) et par vérification que l'écran et l'action
  sont ouverts au rôle Rédacteur ; l'exécution complète n'a pas été reproduite, l'acte de test du
  périmètre étant soumis à révision (porte qui interrompt le parcours avant la signature).
- **Impression** (rendu papier du recueil, du document, PDF) : les feuilles `@media print` ont été
  lues et jugées cohérentes, mais la sortie imprimée n'a pas été capturée (pas d'émulation
  d'impression dans l'environnement).
- **Lecteur d'écran** : aucun lecteur d'écran réel n'a été utilisé ; les vérifications portent sur le
  DOM, les noms accessibles et les propriétés ARIA, non sur une restitution vocale.
- **SMTP et courriel** : indisponible sur la démonstration (déclaré) ; les envois réels du service
  auto-hébergé n'ont pas été exécutés (pas d'instance déployée pendant l'audit).
- **Annuaire OIDC** : le fournisseur d'essai intégré et la logique de vérification (JWKS, PKCE,
  revendications) ont été lus, mais aucun annuaire réel n'a été branché pour un test de bout en bout.
- **Service auto-hébergé (Node/MySQL)** : non déployé pendant l'audit ; son comportement a été
  apprécié par lecture approfondie du code (scrypt, sessions, CSRF, autorisations, routes), non par
  exécution. Les conclusions le concernant sont donc **de niveau lecture de code**.
- **Comportement de la plateforme Perchance** : hors périmètre ; l'usage qu'en fait Scribae a, lui,
  été observé.
- **Base MySQL / MariaDB** : non déployée ; schéma (`schema.sql`) lu, non exécuté.

### Incidence sur l'outil

Un unique geste d'écriture a été commis pendant les tests dynamiques, sur le service de
démonstration, pour établir deux non-conformités : dépôt d'un acte de sonde, ouverture d'un circuit,
notification de signature forgée, publication au recueil. La publication a été **retirée
immédiatement** (`POST /v1/publications/{cle}/retrait`, 200) et les sollicitations d'indices de
dessin d'écriture ont été annulées. L'acte de sonde déposé n'est pas supprimable par l'API
(aucune route de suppression d'acte déposé) : il reste dans l'état du service de démonstration, sans
publication. Aucun fichier de l'outil (`main.pjs`, `index.html`, `src/` hors `src/audit/`) n'a été
modifié. **Nota** : l'état du service de démonstration peut être réinitialisé depuis
*Administration › Données › Réinstaller la démonstration*.

---

*Fin du rapport. Registre : `src/audit/REGISTRE-NON-CONFORMITES.md`. Cadre : `src/audit/PROMPT-AUDIT-SCRIBAE.md`.*
