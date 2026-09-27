---
titre: Audit Scribae — 2026-09-27
version_outil: 1.6.3
duree: 1 h 35
chapitres: 4
non_conformites: 41 (bloquantes 3, majeures 12, mineures 13, observations 13)
points_conformes: 108
propositions: 9
registre: src/audit/REGISTRE-NON-CONFORMITES.md
precedent: src/audit/rapports/AUDIT-SCRIBAE-2026-09-23.md
---

# Audit Scribae — 4e campagne

> **Document de travail — un audit constate, il ne certifie pas.** Ce rapport ne corrige rien : il
> relève, prouve et propose. Les non-conformités qu'il établit sont suivies dans le **registre
> cumulatif** (`../REGISTRE-NON-CONFORMITES.md`), où leur **statut évolue** d'une campagne à
> l'autre — une fiche lue ici peut être **levée depuis**, ou au contraire encore **ouverte**. Les
> termes employés (gravité, cotation, preuve, contrat de sortie) sont définis par le cadre :
> `../PROMPT-AUDIT-SCRIBAE.md`.

## 1. En-tête

| Champ | Valeur |
|---|---|
| Date de la campagne | 2026-09-27 |
| Version auditée | **1.6.3** (`src/lib/version.js`), **sur la copie de travail** (Perchance : `main.pjs`, `index.html`, `src/`) — non publiée à la date de la campagne |
| Cibles | l'application à l'exécution dans l'aperçu (service de démonstration embarqué), l'intégralité de `src/` (310 fichiers, 139 678 lignes, ≈ 9,6 Mo), les deux implémentations du service (émulateur de `index.html` et service Node `src/server/mysql/`), et, pour le cadrage, la copie **publiée** (`github.com/aplds/scribae`, `https://demo.scribae.eu`) |
| Méthode | cadre `PROMPT-AUDIT-SCRIBAE.md` §5 : cadrage, exploration statique (lecture, mesures, empreintes), exploration dynamique (parcours, appels d'API réels, captures, viewports), instruction, rédaction, restitution |
| Durée | **1 h 35** (voir Annexe C) |
| Auditeurs | quatre regards : DSI (I), RSSI (II), qualiticien (III), DAJ/assemblées (IV) |
| Pièces | `src/audit/REGISTRE-NON-CONFORMITES.md` (41 fiches) ; rapport précédent `rapports/AUDIT-SCRIBAE-2026-09-23.md` |
| Ce que cette campagne ajoute | la campagne précédente regardait un **logiciel publié** ; celle-ci regarde un logiciel dont on a **branché les accès** — elle vérifie une à une les sorties réseau, la part réelle de chaque appel, et la porte qui empêche de **signer à la place d'un autre** |

> **Lecture.** Le rapport est un document de travail. Les non-conformités portent un identifiant
> **stable** (`NC-<chapitre>-<numéro>`) : une fiche ouverte le 2026-09-21 garde son identifiant ici,
> avec son statut revérifié lorsque la campagne a pu le faire.

---

## 2. Synthèse pour la direction

**Appréciation générale.** Scribae 1.6.3 est un logiciel cohérent, installable, et dont le travail
de cette livraison porte sur le point exact que la campagne précédente avait laissé ouvert : **ce
qui sort sur le réseau sort vraiment, et ce qui engage une personne est opposé à cette personne**.
La télétransmission au contrôle de légalité n'est plus une simple constatation locale : le service
appelle désormais l'API d'envoi (`src/server/mysql/controle-legalite.mjs`), la clé reste au serveur,
et un refus de l'API **n'est jamais** converti en certificat — il échoue en `502 transmission_echec`
sans rien enregistrer. La simulation, quand aucun appel n'a lieu, reste **marquée** (`demonstration:
true` + réserve imprimée sur le document) : la non-conformité **NC-IV-004** de la campagne
précédente est donc **levée**.

Le second travail est une porte, et elle est aujourd'hui **doublée**. Côté interface,
`peutSignerEffectivement` exige d'être le **titulaire** de la chaîne et de porter la qualité de
signataire (acquis de la 1.6.1w) ; un parcours réel le revérifie sur l'intégralité du jeu de
démonstration (**759 paires** acte × compte, 26/26 au parcours). Côté **service** — c'est le neuf,
et c'est la réponse directe à « personne ne peut signer à la place de quelqu'un d'autre » —,
`porteSignature` **oppose l'opérateur au signataire** dès que le service identifie les personnes :
un appel direct au webhook, hors de l'interface et avec un jeton valide, ne peut plus engager la
signature d'autrui (`403 signature_non_habilitée`, circuit `rejetee`), le nom imprimé venant du
référentiel du service et jamais du corps. La **certification de conformité** a la même porte. La
fiche **NC-II-006** est renforcée en conséquence.

Deux réserves, que cette campagne établit et qui n'étaient pas au dossier :

1. **La porte ne vaut que là où le service connaît les personnes.** Sur le service de
   **démonstration** — celui que la plateforme héberge, et celui sur lequel un visiteur essaie
   l'outil —, les comptes vivent dans le navigateur : le service n'a **aucune identité** à opposer,
   et la signature y porte l'attribution `declaree` (elle dit ce que le client affirme, non ce que
   le service a constaté). C'est une limite assumée du démonstrateur, désormais **écrite** ; elle
   disparaît dès que le déploiement fait authentifier les personnes (`AUTH_MODE=password` ou
   annuaire). Fiche **NC-II-017**, statut **Acceptée**.
2. **La copie publiée et la copie de travail ont divergé.** Le dépôt `github.com/aplds/scribae`
   sert `APP_VERSION = "1.6.1w"` et porte un **registre d'audit version 5** (campagnes 4 et 5,
   fiches `NC-I-015`, `NC-I-016`, `NC-II-015`) ; la copie de travail est en **1.6.3** avec un
   registre **version 3**. Deux lignées cohabitent, avec des numéros et des dossiers de qualité
   différents. Fiche **NC-I-017**.

**Note par chapitre** (appréciation d'auditeur, non une mesure) :

| Chapitre | Note | Ce qui la fonde |
|---|---|---|
| I — Systèmes d'information | **6 / 10** | accès réseau réels et testés, modules purs, 418 épreuves vertes en atelier ; mais deux lignées divergentes, monolithes, API écrite deux fois, état de la chaîne non vérifiable de l'extérieur |
| II — Sécurité | **8,5 / 10** | la porte de signature est désormais tenue par le service lui-même ; secret de télétransmission de portée « service », absent de `GET /v1/config` et des journaux ; restent la court-circuitabilité de la formalité et la limite du démonstrateur |
| III — Qualité, accessibilité, expérience | **8,5 / 10** | interface cohérente, états de chargement/erreur systématiques, recueil complet ; documentation à réaligner par endroits ; démonstration encore indexable |
| IV — Conformité et valeur juridique | **8 / 10** | la transmission est réelle quand elle est branchée, et marquée sinon ; restent la non-répudiation hors signature interne, l'ELI non unifié et les refus du contrôle de légalité non traités |

**Les dix risques majeurs.**

| # | Risque | Fiche |
|---|---|---|
| 1 | Deux lignées cohabitent (1.6.3 / 1.6.1w) avec des registres d'audit différents : on peut publier, auditer ou citer la mauvaise copie | **NC-I-017** |
| 2 | La formalité de transmission peut être **court-circuitée** par une `reference` fournie à l'API : l'appel réel n'a pas lieu et la publication reste possible | **NC-II-016** |
| 3 | Les **refus** du contrôle de légalité (rejet, demande d'observations) ne sont pas traités : tout refus est un `502` rejouable, non un état du dossier | **NC-IV-006** |
| 4 | Le client de télétransmission n'a **jamais parlé** à une vraie passerelle @ctes : le format des accusés n'est pas confronté au réel | NC-IV-006 |
| 5 | La non-répudiation n'est pas établie hors signature interne (certificat auto-engendré, clé privée locale) | NC-IV-001 |
| 6 | Sur la **démonstration**, le service ne peut opposer aucune identité : une clé peut déclarer n'importe quel signataire | NC-II-017 (Acceptée) |
| 7 | L'ELI reste non unifié (identifiant `eli:/fr/…` et adresse HTTP coexistent) | NC-IV-003 |
| 8 | Rétention et export du journal d'audit non définis | NC-II-010 |
| 9 | La démonstration publiée est **indexable** (`/robots.txt` → 404) alors que son jeu de données est fictif | NC-III-008 |
| 10 | Reprise par un tiers freinée : monolithes, règles dupliquées, API écrite deux fois | NC-I-003, NC-I-010 |

**Trajectoire recommandée.** Deux gestes courts et un chantier : **réconcilier les deux lignées**
(récupérer du dépôt publié le registre d'audit et les rapports des campagnes 4 et 5, décider
laquelle fait foi, republier une copie unique) ; **borner l'entrée `reference`** de la route de
transmission (la retirer, ou la nommer et l'exiger comme une « constatation hors application »
tracée, et l'inscrire au contrat OpenAPI) ; puis, à l'horizon 30–90 jours, **traiter les refus** du
contrôle de légalité et **éprouver** le client contre une vraie passerelle. Rien de tout cela
n'empêche la démonstration publique : ce qui est simulé est nommé, et la porte de signature tient
partout où des personnes sont identifiées.

---

## 3. Chapitre I — Systèmes d'information (DSI)

*Posture : informaticien sénior, hostile au « vibe coding ». Question posée : peut-on reprendre ce
logiciel dans dix ans, avec une équipe, sans l'auteur ?*

### I.1 Architecture et découpage

**Constat.** Le découpage tient : `src/lib/` (domaine pur), `src/ui/` (interfaces), `src/lib/db/`
(contrat de persistance + pilotes local / service), `src/server/mysql/` (service auto-hébergé),
`index.html` (service de démonstration), `main.pjs` (configuration). Le module de télétransmission
appartient à la **bonne** couche : il vit au service (`src/server/mysql/controle-legalite.mjs`,
module pur à `fetch` injecté), à côté du client du prestataire de signature
(`src/server/mysql/signature.mjs`) — les deux seuls modules qui sortent sur le réseau le font du
côté qui détient les clés. Deux entorses connues subsistent : l'API est **écrite deux fois**, et
`index.html` mêle document, amorçage et implémentation du service.

**Points conformes.**
- Le client d'un service tiers **n'est jamais** dans le navigateur quand il porte une clé : télétransmission (`controle-legalite.mjs`) et prestataire de signature (`signature.mjs`) vivent au service.
- Le domaine reste pur : `createControleLegalite({ api, cle, fetchImpl, journal })` reçoit son transport et son journal, donc s'éprouve seul (`controle-legalite.test.mjs`, 9 épreuves, sans réseau).
- Le contrat de persistance est inchangé (`src/lib/db/contract.js`) : la même interface sert la démonstration et la production.

**Non-conformités.** `NC-I-003` (monolithes), `NC-I-010` (API écrite deux fois), `NC-I-017`
(lignées divergentes).

**Recommandations.** P-48 (réconcilier les lignées) ; P-52 (épreuve de conformité entre les deux
services, déjà en place — l'étendre aux routes neuves).

### I.2 Qualité et lisibilité du code

**Constat.** Le code est régulier, commenté en français, et les commentaires expliquent le
*pourquoi* — le module de télétransmission en est un bon exemple : il énonce en tête qu'il est « le
seul endroit du service qui appelle réellement cette API », et pourquoi la clé ne peut pas vivre
ailleurs. Les fichiers les plus longs restent `src/ui/views/signature.js` et
`src/ui/views/referentiel.js`.

**Points conformes.**
- 233 modules `.js`/`.mjs` : aucun `debugger` livré ; la syntaxe est contrôlée par
  `scripts/verifier-syntaxe.mjs`.
- Le module de télétransmission ne journalise **jamais** la clé : le journal du service reçoit
  l'adresse, le code HTTP, la durée et la référence d'accusé (`controle-legalite.mjs`, `appeler`).

**Non-conformités.** `NC-I-003`.

**Recommandations.** P-52 (rembourser la dette de structure).

### I.3 Environnements, tests, industrialisation

**Constat.** Les épreuves existent et sont vertes là où elles s'exécutent : **418 / 437** en
atelier (37 fichiers), les 19 restantes tenant à l'environnement d'exécution (pas de `node:crypto`,
pas de `child_process`, pas de réseau sortant). La livraison de cette campagne a **ajouté** des
épreuves ciblées et vertes : `controle-legalite.test.mjs` (9/9), et cinq cas neufs dans
`actes.test.mjs` (30/30). L'état de la chaîne d'intégration du dépôt publié, lui, n'a pas pu être
revérifié (l'API GitHub exige des droits d'administration).

**Points conformes.**
- 37 fichiers d'épreuves ; `actes.test.mjs` (30), `bulletins.test.mjs` (32), `comptes.test.mjs` (39), `ips.test.mjs` (19).
- Les cas neufs couvrent la transmission réelle (`demonstration:false`, `api.simule:false`), le **refus** de l'API (`502` + rien d'enregistré + rejeu possible), le rétablissement refusé au rédacteur et accepté à l'administration, et la compilation.
- Le jeu d'appels commun aux deux services (`src/tests/conformite-service.mjs`) est joué des deux côtés.

**Non-conformités.** `NC-I-008` (état de la chaîne non vérifiable), `NC-I-002` (verrou de
dépendances).

**Recommandations.** P-50 (rendre la chaîne verte), P-51 (verrou + `npm ci`).

### I.4 Dépendances et chaîne d'approvisionnement

**Constat.** Aucune dépendance nouvelle n'est venue de cette livraison : le module de
télétransmission n'utilise que `fetch` (Node 18+) et `AbortController`. Le nombre de dépendances
reste faible (greffons Perchance déclarés en tête de `main.pjs`, `mysql2` côté serveur). La
traçabilité des versions reste le point faible.

**Points conformes.**
- `controle-legalite.mjs` : zéro dépendance (ni `http`, ni bibliothèque) — le transport est injecté.
- `mysql2` fixé à une version exacte ; images Docker épinglées par empreinte.

**Non-conformités.** `NC-I-002`.

**Recommandations.** P-51.

### I.5 Gouvernance du code

**Constat.** La gouvernance est mature (version unique, journal des versions, notes
intermédiaires), mais cette campagne met au jour une **incohérence de gouvernance** : la copie
publiée et la copie de travail ne racontent pas la même histoire (versions, changelogs et registres
d'audit différents). Une règle pourtant écrite dans le README — « comparer avant d'écrire », « le
dépôt fait foi ou il est en retard, on le dit » — n'a pas été tenue entre les deux lignées.

**Points conformes.**
- `APP_VERSION` reproduit le titre de la première entrée datée du changelog (vérifié : `1.6.3`).
- Le miroir du service (`logiciel-engendre.mjs`) est engendré depuis `version.js` ; son épreuve est verte (4/4).

**Non-conformités.** **NC-I-017** (lignées divergentes).

**Recommandations.** P-48.

### I.6 Exploitation

**Constat.** L'exploitation gagne deux capacités réelles : la télétransmission sort du serveur
(jamais du poste), et l'état de la télétransmission est **publié** (`GET /v1/config`,
`controleLegalite`), donc affichable par l'administration. L'observabilité reste sommaire (journal
scellé, santé, quotas) et la rétention du journal n'est pas définie.

**Points conformes.**
- État de la télétransmission publié sans secret : `cle` est un **booléen**, jamais la clé.
- Une ligne de bannière au démarrage annonce le branchement (« télétransmission BRANCHÉE » / « SIMULÉE — motif »).
- Quotas et éviction (`MAX_PUBLIES`, `MAX_ACTES`, `MAX_CHARS`) toujours en place.

**Non-conformités.** `NC-II-010` (rétention et export du journal), `NC-IV-006` (refus non traités).

**Recommandations.** P-49.

### I.7 Souveraineté, hébergement, réversibilité

**Constat.** Le logiciel reste réversible : le domaine ne dépend d'aucun service tiers, la
persistance a deux pilotes, les données s'exportent, et l'appel sortant de la télétransmission part
du **serveur de la collectivité** avec une adresse choisie par elle. La dépendance à la plateforme
Perchance est réelle mais non captive.

**Points conformes.**
- L'adresse et la clé de l'API @ctes sont des variables du `.env` du service (`SCRIBA_CONTROLE_LEGALITE_*`), pas des constantes du logiciel.
- Un service non branché **le dit** (motif) au lieu de simuler en silence.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** P-49 (plan de sortie, déjà proposé).

### I.8 Documentation et reprise par un tiers

**Constat.** La documentation est abondante (README 3 857 lignes, SPEC 3 800, changelog 4 434) et
couvre l'exploitation. Le point de friction reste le **volume** ; cette campagne y ajoute un
friction nouvelle, celle de la **divergence** : le registre d'audit de la copie de travail ne
contient pas les fiches de la copie publiée.

**Points conformes.**
- `docs/API.md` (engendré) décrit la route de transmission et son `502 transmission_echec` (vérifié : 2 occurrences).
- Le guide et la documentation technique sont imprimables/exportables.

**Non-conformités.** `NC-I-017`, `NC-I-003`.

**Recommandations.** P-48, P-52.

---

## 4. Chapitre II — Sécurité des systèmes d'information (RSSI)

*Posture : raisonnement d'attaquant. Question posée : qui peut faire quoi, à qui, avec quelles
données, et qu'est-ce qui reste comme trace ?* Les deux points d'entrée du cadre (§4.2 —
segmentation démonstration/production, usurpation du signataire) sont instruits en **II.5** (porte
de signature), **II.6** (segmentation) et **II.8** (secrets).

### II.1 Cartographie et classification des données

**Constat.** Le classement des données continue d'**agir** (collections sensibles réservées,
actes individuels non publiés, publications réservées aux agents). Deux pièces neuves entrent dans
la circulation : l'acte signé qui part vers la préfecture (donnée publique, mais dont le trajet
emprunte le réseau) et l'accusé de réception, qui devient un **certificat** sur le document.

**Points conformes.**
- La clé de télétransmission est de portée « service » (`portee: "service", secret: true`) : jamais dans le référentiel, jamais dans une réponse.
- Les mentions nominatives restent dans la part **interne** de l'original (deux parts), donc absentes du recueil et de `GET /v1/publications`.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** P-49.

### II.2 Comptes, authentification, habilitations

**Constat.** Le modèle de rôles reste appliqué route par route. La nouveauté est l'**opposition
d'identité** : sur un service qui identifie les personnes, la signature est opposée à l'opérateur.

**Points conformes.**
- Comparaison des clés à temps constant (`egalConstant`, `index.html:373`).
- Clés tirées par le client, seule l'empreinte conservée ; séparation des pouvoirs (refus de révoquer la dernière clé d'administration).
- Comptes locaux (scrypt, blocage, session `HttpOnly` + anti-CSRF) et annuaire (OIDC) : c'est **leur** présence qui rend la porte de signature effective.

**Non-conformités.** `NC-II-017` (aucune identité opposable sur la démonstration — statut Acceptée).

**Recommandations.** P-53 (nommer la limite du démonstrateur où une signature s'affiche).

### II.3 Sécurité applicative

**Constat.** Les risques classiques sont traités (contenu publié assaini, rendu par nœuds de texte,
erreurs normalisées). La revue de cette campagne n'a pas trouvé de chemin d'injection neuf. Un
point d'attention **neuf** est en revanche relevé sur la route de transmission : elle lit des
champs de corps non documentés (voir II.4 et NC-II-016).

**Points conformes.**
- Assainissement du document publié (`src/lib/sanitize.js`) ; rendu par `textContent`/`createTextNode` ailleurs.
- Le service ne fabrique jamais un certificat d'apparence réelle sans appel réel : le champ `demonstration` est posé et la mention le dit.
- Les erreurs de la télétransmission ne fuient pas la clé : le détail est borné (`res.texte.slice(0, 240)`).

**Non-conformités.** `NC-II-016` (court-circuit de la formalité).

**Recommandations.** P-47.

### II.4 Sécurité de l'API

**Constat.** L'API est classée par rôle, borne ses entrées et annonce ses réponses (OpenAPI
engendré). La route de transmission (`POST /v1/actes/{id}/transmission`, rôle `redacteur`) est
**le point faible neuf** : elle honore un champ `reference` du corps qui **court-circuite l'appel
réel** (`actes.mjs` : `if (!reference && controleLegalite && controleLegalite.actif())`). L'appel
n'a alors pas lieu, le certificat porte `demonstration: true`, et l'acte dispose pourtant d'une
`transmission` — ce qui suffit à lever le contrôle de publication
(`409 transmission_absente`). Le corps de cette route n'est **pas** décrit dans `docs/API.md`.

**Points conformes.**
- Route réservée à `redacteur` ; refus d'un acte non signé (`409 acte_non_signe`).
- Idempotence de la transmission (un acte déjà transmis renvoie son certificat).
- `502 transmission_echec` **sans rien enregistrer** : l'épreuve `actes.test.mjs` le vérifie (rien n'est écrit, le rejeu aboutit).

**Non-conformités.** **NC-II-016** (Mineure).

**Recommandations.** P-47.

### II.5 Signature, intégrité et non-répudiation

**Constat.** C'est le cœur de cette campagne. L'intégrité était déjà tenue (empreinte recalculée,
divergence refusée, certification liée à l'empreinte de la pièce). Ce qui **change**, c'est
l'identité : l'interface, puis le **service**, opposent désormais l'opérateur au signataire. Le
service va plus loin que l'interface : il **réécrit le nom** du signataire depuis son propre
référentiel, et refuse tout paquet qui désigne une autre personne que l'opérateur.

**Points conformes.**
- `porteSignature` (`actes.mjs`) : une **session** doit porter le `personId` du signataire (`403 signature_non_habilitée` sinon ; `signataire_non_identifie` si le paquet ne nomme personne ; `signature_sans_identite` si l'appelant est une clé). Le **nom** vient du référentiel du service, jamais du corps.
- La **certification de conformité** est opposée de même au réviseur (`403 conformite_non_habilitée`).
- Chaque signature consigne son **opérateur** (`sig.operateur`) et son **attribution** (`verifiee` | `declaree` | `reprise` | `compilation`) ; `sig.verifie` n'est vrai que pour `verifiee`.
- La **reprise** (repose au registre d'un original déjà signé) et la **compilation** (version consolidée) ne sont **pas** des signatures : les drapeaux `reprise`/`compilation` les **nomment**, et le service les **réserve à l'administration** — un rédacteur reçoit `403`.
- Le webhook reste authentifié et l'empreinte recalculée (`409 empreinte_divergente`).
- À l'interface, `enregistrerCertification`/`certifierConformite` rejouent `peutCertifier` ; `publierConsolide` exige le titulaire ou l'administration ; `retablirActe` pré-vérifie le titulaire ou l'administration.

**Non-conformités.** `NC-IV-001` (non-répudiation hors signature interne), `NC-II-017` (limite du
démonstrateur), `NC-II-006` (renforcée, non rouverte).

**Recommandations.** P-41 (déjà proposé : certificat qualifié ou mention explicite).

### II.6 Segmentation des environnements

**Constat.** La frontière démonstration / production est **outillée** (commutateur `DEMO`,
`AUTH_MODE`) et, depuis cette campagne, **lisible dans le comportement** : sur un service qui
n'identifie pas les personnes, l'attribution est `declaree` ; sur un service qui les identifie,
elle est `verifiee`. Le point d'entrée du cadre (« frontières floues ») est donc traité pour la
**configuration** ; il reste vrai pour le **code** (deux implémentations) et pour la
**démonstration** (état non conservatoire).

**Points conformes.**
- Sur la démonstration, `GET /v1/config` publie `controleLegalite.transport = "demonstration"` avec son **motif** (« …la télétransmission y est simulée, et le certificat le dit ») — vérifié dynamiquement.
- Les valeurs par défaut restent sûres (`AUTH_MODE=password`, `CORS_ORIGINS` vide, `frame-ancestors 'self'`).

**Non-conformités.** `NC-II-012` (démonstration non conservatoire), `NC-I-010`, `NC-II-017`.

**Recommandations.** P-53.

### II.7 Journalisation, traçabilité, preuve

**Constat.** Le journal reste scellé (chaîne SHA-256) et couvre les gestes sensibles. La campagne
ajoute un fait journalisé : l'**appel sortant** de la télétransmission, avec l'adresse, le statut et
la durée (`recordExternal`, sans la clé). La rétention et l'export manquent toujours.

**Points conformes.**
- L'appel réel est tracé ; l'échec aussi (`journal({ url, statut: 0, erreur })`).
- Un `403` de signature **marque le circuit `rejetee`** avec son motif : la tentative laisse une trace.

**Non-conformités.** `NC-II-010`.

**Recommandations.** P-37 (déjà proposé).

### II.8 Secrets et configuration

**Constat.** Aucun secret nouveau n'est exposé. La clé de télétransmission est déclarée
`secret: true`, de portée service, et n'apparaît **ni** dans `GET /v1/config` (où `cle` est un
booléen) **ni** dans les journaux.

**Points conformes.**
- `SCRIBA_CONTROLE_LEGALITE_API_CLE` : `portee: "service", secret: true` (`variables.mjs`).
- `GET /v1/config` rend `controleLegalite.cle = false` en démonstration (vérifié dynamiquement) ; la clé n'est jamais servie.
- La clé ne sort que dans l'en-tête `Authorization: Bearer` vers l'API @ctes (`controle-legalite.mjs`).
- Le code servi ne contient aucun jeton (`src/lib/cle-service.js` ne porte la clé qu'en mémoire, le service n'en garde que l'empreinte).
- `src/server/env.example` décrit les six variables nouvelles sans valeur.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### II.9 Protection des données à caractère personnel

**Constat.** Le traitement reste documenté et l'outil sait ne pas diffuser (deux parts d'original,
actes individuels non publiés, occultation). Le point de vigilance reste la **démonstration
publique** : comptes fictifs ouverts d'un clic, installation partagée où n'importe qui peut écrire
— assumé, écrit dans le README, et sans donnée réelle.

**Points conformes.**
- Deux parts d'original : la télétransmission n'ajoute aucune diffusion de mentions nominatives (le corps envoyé porte le document et les métadonnées de l'acte, pas le dossier interne).
- Le jeu de démonstration est entièrement fictif, et l'application l'annonce (bandeau orange, vérifié à l'écran).
- Ce rapport ne recopie ni donnée personnelle réelle, ni secret (règle de cadre respectée).

**Non-conformités.** Aucune nouvelle. (Renvoi : `NC-II-012`.)

**Recommandations.** P-33 (indexation de la démonstration).

### II.10 Continuité, gestion des incidents, homologation

**Constat.** Sauvegardes et restauration sont documentées ; l'exploitation a ses garde-fous
(quotas, refus explicites, journal). L'homologation n'est pas engagée — cohérent avec un logiciel
qui n'est pas encore déployé en production par une collectivité, et cela doit rester écrit.

**Points conformes.**
- Refus explicites plutôt qu'échecs silencieux (`409`, `502`, `507`, `422` avec codes).
- Un mode « hors réseau » existe côté client.
- Un échec de télétransmission est **rejouable** : il ne perd rien et ne bloque pas l'acte.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** P-47, P-49.

---

## 5. Chapitre III — Qualité, accessibilité et expérience (qualiticien)

*Posture : minutieuse, obsédée par la cohérence. Question posée : est-ce que tout est là,
accessible à tous, et cohérent ?*

### III.1 Complétude fonctionnelle

**Constat.** La promesse reste tenue, fonction par fonction. Cette campagne **corrige** une ligne du
tableau de la campagne précédente : la transmission au contrôle de légalité n'est plus seulement
« simulée, annoncée » — elle est **réelle quand le service est branché**, et l'application
l'annonce dans les deux cas.

| Exigence annoncée | État | Preuve / remarque |
|---|---|---|
| Recueil public sans compte, à la racine | **Présente** | `#/recueil` : en-tête, recherche, « Informations », « À la une », thèmes, liste ; vérifié à l'écran |
| Identifiant ELI par acte et adresses stables | **Présente** | ELI affiché, JSON-LD et Akoma Ntoso servis |
| Trames : préparation par les administrateurs | **Présente** | Écran « Trames », éditeur de trame |
| Remplissage par les services, écart tracé | **Présente** | Rédaction, écarts signalés, commentaires |
| Validation interne (parapheur) | **Présente** | Circuits, étapes, tranchage |
| Signature : électronique, simple, externe, interne | **Présente** | Quatre circuits ; **la signature n'est apposée que par le titulaire** (interface **et** service) |
| Transmission au contrôle de légalité | **Réelle si branchée, sinon simulée et marquée** | `controle-legalite.mjs` ; `GET /v1/config` ; panneau Administration › Expérimentale (vérifié dynamiquement) |
| Publication automatique au recueil | **Présente** | Publication dès la signature pour un acte publiable |
| Bulletin (Journal) des actes | **Présente** | Cadence, numéros, flux RSS/Atom, abonnement |
| Informations (actualités) | **Présente** | Billets, épinglage, page dédiée |
| Exports ouverts (Akoma Ntoso, Schematron, JSON-LD, A4, Word, Markdown) | **Présente** | Écran d'export et service |
| Recueil ouvert (llms.txt, sitemap, robots) | **Présente en auto-hébergement** | Non annoncés sur la démonstration statique (choix explicite) |
| Assistants (atelier et recueil) | **Présente** | Guide et actes |
| Guide d'utilisation intégré | **Présente** | 32 chapitres |
| Documentation technique dans l'application | **Présente** | Journal des versions, administration, installation, API, variables |
| Comptes, rôles, délégations, organigramme | **Présente** | Écrans dédiés, permissions par rôle |
| Annuaire (OIDC) | **Présente** | Configuration et connexion |
| API REST documentée | **Présente** | `docs/API.md` engendré + panneau de commande |
| Licence de réutilisation affichée | **Présente** | Pied du recueil |
| Mention de l'éditeur du logiciel | **Présente** | Trois pieds de page |
| Déclaration de démonstration | **Présente** | Bandeau orange (vérifié à l'écran) |

**Points conformes.** Les vingt lignes ci-dessus.

**Non-conformités.** `NC-III-008` (indexation de la démonstration), `NC-I-017` (documentation
divergente).

**Recommandations.** P-33, P-48.

### III.2 Accessibilité (RGAA 4.1 / WCAG 2.1 AA)

**Constat.** Les fondamentaux restent tenus (lien d'évitement, titres hiérarchisés, contrastes
conformes, cibles tactiles suffisantes, repères nommés). Le parcours de cette campagne a
**reconfirmé** la présence du lien d'évitement et du repère de navigation de l'atelier
(`NC-III-007` toujours levée). La vérification au lecteur d'écran n'a pas pu être refaite (voir
Annexe C).

**Points conformes.**
- Lien d'évitement « Aller au contenu » présent sur le recueil (vérifié dans le DOM).
- Titres de document posés par écran (« Recueil des actes administratifs — Ville de Valmont-sur-Loire »).
- Contour de focus global (`:focus-visible`).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### III.3 Ergonomie et parcours

**Constat.** Les parcours sont pensés pour un agent de bureau (cartes cliquables, états de
chargement, confirmation des gestes exceptionnels). La nouveauté est un **refus mieux expliqué** :
quand un compte tente de signer hors compétence, l'application ne propose plus le geste — et le
service, lui, refuse en le **disant** (« Cette signature engage une autre personne que vous… »).

**Points conformes.**
- États vides et de chargement explicites ; aide contextuelle à chaque écran.
- Le parcours `signature-hors-competence` (26e épreuve) vérifie **à l'écran** qu'aucun bouton de signature ne s'offre sur un acte hors compétence (759 paires acte × compte).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### III.4 Cohérence des interfaces

**Constat.** Le vocabulaire et les composants restent mutualisés. Cette campagne n'a pas trouvé
d'incohérence d'interface neuve ; le panneau « Expérimentale » affiche correctement l'état simulé
**du service** (et non une adresse d'exemple), ce qui était l'objet d'une correction de la 1.6.3.

**Points conformes.**
- Mention de l'éditeur écrite une seule fois (`src/ui/mention.js`), lue par les trois pieds de page.
- L'état réel de la télétransmission (`réelle` / `simulée` + motif) est affiché dans Administration › Expérimentale quand l'étape est activée — vérifié dynamiquement.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### III.5 Compréhension et aide

**Constat.** Le niveau de langue reste adapté ; les messages d'erreur nomment la cause et le geste
attendu. Le message de refus de signature hors compétence en est un bon exemple
(« … seul son titulaire peut l'apposer, depuis son propre compte »).

**Points conformes.**
- Guide intégré (32 chapitres), glossaire, dépannage.
- Messages d'erreur en français, avec cause et geste attendu.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### III.6 Robustesse et adaptation

**Constat.** Le recueil reste responsive ; le mode sombre est appliqué avant le premier rendu. La
capture de cette campagne a été prise en thème sombre, et n'a pas montré de débordement horizontal.

**Points conformes.**
- Rendu en mode sombre dès le chargement (script d'amorçage dans `index.html`).
- Documents produits avec feuille A4 propre à l'impression.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** P-33.

### III.7 Qualité mesurée

**Constat.** Ce qui est annoncé reste vérifiable (nombre d'actes, de thèmes, version, chapitres du
guide). Cette campagne ajoute un chiffre vérifiable : **418 épreuves vertes sur 437** en atelier.

**Points conformes.**
- Version affichée cohérente avec le journal des versions (`1.6.3`).
- Chiffres de l'écran cohérents avec les données (`69 actes`, `25 trames` du jeu de démonstration).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** P-50 (publier l'état de la chaîne).

### III.8 Documentation utilisateur et formation

**Constat.** Documentation utilisateur complète et séparée de la documentation technique ;
imprimable et exportable. Le point faible reste la documentation **de développement** (volume), et
désormais sa **divergence** entre les deux copies (I.8).

**Points conformes.**
- Guide imprimable (chapitre ou entier) et exportable en HTML autonome.
- Documentation technique réservée aux administrateurs (`docs.voir`).

**Non-conformités.** `NC-I-017`.

**Recommandations.** P-48, P-52.

---

## 6. Chapitre IV — Conformité et valeur juridiques (DAJ / assemblées)

*Posture : exige la sécurité juridique des actes, la collaboration entre services et la qualité du
droit produit.*

### IV.1 Conformité des actes et du cycle réglementaire

**Constat.** Le cycle est couvert de bout en bout, avec les distinctions qui font la valeur
juridique. La nouveauté de cette campagne est **positive** : la transmission au contrôle de
légalité cesse d'être une formalité « pour l'apparence ». Quand le service est branché, l'acte part
réellement, l'accusé de réception devient le certificat, et un refus **ne fabrique pas** de
certificat. Quand il ne l'est pas, le certificat **le dit**.

**Points conformes.**
- Publication refusée avant transmission quand elle est requise (`409 transmission_absente`), après le contrôle de signature, avant celui de la date.
- Transmission refusée avant signature (`409 acte_non_signe`), idempotente après.
- Un refus de l'API rend `502 transmission_echec` : **rien n'est enregistré**, l'acte reste signé/non transmis, le rejeu est possible.
- Le certificat simulé porte `demonstration: true` et sa mention porte la réserve (« transmission simulée, sans appel sortant »).
- Documents non juridiques : opposabilité imposée vide.

**Non-conformités.** **NC-IV-006** (refus non traités), `NC-II-016` (court-circuit).

**Recommandations.** P-46, P-47.

### IV.2 Interopérabilité et normes

**Constat.** Les formats sont ceux du domaine (Akoma Ntoso 3.0, ELI, JSON-LD, Markdown, texte,
HTML). Le point faible reste **l'unification de l'ELI**.

**Points conformes.**
- ELI attribué à la publication, stable par acte, versions successives sous le même identifiant.
- Formats servis par le recueil ouvert ; JSON-LD complet.

**Non-conformités.** `NC-IV-003` (ELI non unifié).

**Recommandations.** P-39 (déjà proposé).

### IV.3 Sécurité juridique et valeur probante

**Constat.** L'intégrité est mécaniquement garantie ; **l'identité** progresse nettement — le
service oppose désormais l'opérateur au signataire — mais la **non-répudiation** au sens d'eIDAS
n'est pas établie pour les circuits simples et électronique simulé (certificat auto-engendré, clé
privée locale). Cette campagne **ajoute** une garantie de plus : le nom inscrit vient du référentiel
du service, non du corps de la requête.

**Points conformes.**
- Nom du signataire **réécrit** depuis le référentiel du service (`porteSignature`) : on ne se fait pas passer pour un autre en changeant le champ `nom`.
- Empreinte du document signé recalculée et comparée avant acceptation (`409` sinon).
- Attribution et opérateur consignés ; la reprise et la compilation sont **nommées** et réservées à l'administration.
- Certification de conformité du réviseur exigée quand elle est requise, et opposée au réviseur.

**Non-conformités.** `NC-IV-001` (non-répudiation), `NC-II-017` (démonstration).

**Recommandations.** P-41.

### IV.4 Cycle de vie de l'acte

**Constat.** Le cycle est complet (trame → acte → validation → signature → transmission →
publication → recueil → versions → abrogation → retrait). La reprise et la compilation sont
désormais **distinguées** d'une signature, et leur attribution le dit.

**Points conformes.**
- Versions publiées listées sous un même identifiant ; version consolidée « ne fait pas foi » et liée à l'original.
- Abrogations et modifications tracées (acte modificatif + consolidé) ; la compilation est attribuée `compilation`.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** P-46.

### IV.5 Collaboration et gouvernance

**Constat.** Rôles, circuits de validation, parapheur, délégations et concurrence d'accès sont
traités ; la séparation des pouvoirs est explicite et, depuis cette campagne, **tenue par le
service** autant que par l'interface.

**Points conformes.**
- Champ de compétence du signataire opposé aux trois chemins de signature, à l'interface.
- Opposition opérateur / signataire au service, pour la signature **et** la certification.
- Relecture et concurrence d'accès (révisions, conflits repris côté client).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### IV.6 Qualité du droit produit

**Constat.** Des contrôles de conformité existent (écarts signalés, contrôles des mentions, rapport
de conformité du réviseur) et le guide porte une doctrine rédactionnelle. Rien de nouveau n'est venu
dégrader ce point.

**Points conformes.**
- Écarts de saisie signalés et tracés.
- Contrôles de conformité de l'acte et de ses annexes.
- Guide qui explique le droit (visa, considérant, formule d'édiction, opposabilité).

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### IV.7 Transparence, données ouvertes et protection

**Constat.** La licence de réutilisation est affichée et inscrite dans le JSON-LD ; les fichiers
ouverts sont annoncés là où un serveur les sert. Deux points de vigilance déjà ouverts : la
démonstration est indexable (`/robots.txt` → 404, revérifié) et le registre d'audit est publié —
désormais **en deux exemplaires divergents** (NC-I-017), ce qui aggrave NC-II-013.

**Points conformes.**
- Licence en clair dans le pied du recueil ; `dcterms:license` et `eli:uri` dans le JSON-LD.
- Actes réservés aux agents hors de toute diffusion publique.

**Non-conformités.** `NC-III-008`, `NC-II-013` (renforcée par `NC-I-017`).

**Recommandations.** P-33, P-34.

### IV.8 Valeur d'usage et soutenabilité

**Constat.** Le logiciel reste soutenable : autonome, sans dépendance payante, installable par une
collectivité, avec une démonstration publique. Le coût de reprise reste réel, et la divergence des
deux copies l'**aggrave** : un repreneur ne sait pas, en l'état, quelle version fait foi.

**Points conformes.**
- Auto-hébergement documenté ; données exportables ; formats ouverts ; licence libre.
- La télétransmission se branche par `.env`, sans redéveloppement.

**Non-conformités.** `NC-I-003`, `NC-I-010`, `NC-I-017`.

**Recommandations.** P-48, P-52.

---

## 7. Chapitre V — Synthèse transversale

**Recoupements.** Trois causes expliquent les constats de cette campagne :

1. **une garantie d'identité qui n'existe que là où des personnes sont identifiées** (NC-II-017 →
   II.2, II.5, II.6) : la porte nouvelle est solide, mais elle ne vaut rien sur le service de
   démonstration, où les comptes vivent dans le navigateur. Le discours doit donc toujours dire
   *où* elle s'applique ;
2. **une même route qui obéit à deux régimes sans que le contrat le dise** (NC-II-016 → II.3, II.4,
   IV.1) : la route de transmission est « réelle quand branchée » **sauf** si l'appelant fournit une
   `reference`, champ non documenté qui rétablit l'ancien comportement (certificat local) tout en
   levant le contrôle de publication ;
3. **un dossier de qualité qui se dédouble** (NC-I-017 → I.5, I.8, IV.7) : deux lignées cohabitent,
   avec des versions et des registres d'audit différents ; c'est la cause commune des constats de
   gouvernance de cette campagne.

**Risques systémiques.** Le risque n° 1 n'est pas technique, il est de **preuve** : tant que deux
copies divergent, un audit — celui-ci compris — porte sur une copie dont on ne peut pas affirmer
qu'elle est la bonne. La réconciliation des lignées est donc à faire **avant** d'ajouter du
fonctionnel, non parce qu'elle est grave en soi, mais parce qu'elle conditionne la valeur de tout
le reste.

**Contradictions à trancher par le prescripteur.**

| Question | Arbitrage attendu |
|---|---|
| Quelle copie fait foi ? | Celle du dépôt publié **ou** celle de l'atelier, mais il faut trancher, récupérer l'autre, et republier une copie unique (P-48). |
| La route de transmission doit-elle accepter une `reference` fournie ? | Non par défaut : soit on la retire, soit on la nomme « constatation hors application » (champ explicite, motif, journal) et on l'inscrit au contrat (P-47). |
| La signature « déclarée » de la démonstration est-elle acceptable ? | Oui pour la démonstration (jeu fictif, bandeau, attribution `declaree`), **non** pour un déploiement : c'est ce que la porte de service garantit dès que `AUTH_MODE` identifie les personnes (NC-II-017). |
| Faut-il traiter les refus du contrôle de légalité maintenant ? | À l'horizon 30–90 jours : sans cela, une collectivité branchée ne saura pas quoi faire d'un rejet (NC-IV-006). |

---

## 8. Plan d'action — propositions à réaliser

| Id | Proposition | Couvre | Bénéfice | Effort | Porteur | Horizon |
|---|---|---|---|---|---|---|
| **P-48** | **Réconcilier les deux lignées** : récupérer du dépôt publié le registre d'audit (v5) et les rapports des campagnes 4 et 5, arbitrer la lignée qui fait foi, republier une copie unique, et vérifier que `APP_VERSION` et la première entrée datée du changelog concordent | NC-I-017, NC-II-013 | Un audit, une version, un dossier de qualité : la copie auditée est la bonne | Moyen | auteur | **0–30 j** |
| **P-47** | **Borner l'entrée `reference`** de la route de transmission : la retirer, ou la nommer « constatation hors application » (champ explicite, motif exigé, journal), l'ajouter au contrat OpenAPI, et refuser qu'elle lève `transmission_absente` sans trace | NC-II-016, IV.1 | La formalité obligatoire ne se court-circuite plus par un champ non documenté | Faible | auteur | **0–30 j** |
| **P-33** | **Maîtriser l'indexation** de la démonstration (`robots.txt` / `noindex` **dans la démonstration seulement**), documenté dans `docs/GITHUB.md` | NC-III-008 | Pas de fiche fictive dans un moteur de recherche | Faible | auteur | **0–30 j** |
| **P-50** | **Rendre la chaîne verte** et publier son état (badge) : corriger ce qui échoue, vérifier que les deux travaux passent, et rendre l'état lisible sans droits d'administration | NC-I-008, III.7 | Le contrôle redevient une garantie et un argument | Faible | auteur | **0–30 j** |
| **P-51** | **Verrou de dépendances** (`package-lock.json`) et passage à `npm ci` | NC-I-002 | Construction reproductible | Faible | auteur | 30–90 j |
| **P-46** | **Traiter les refus du contrôle de légalité** (rejet, demande d'observations) : un état du dossier, un motif porté au certificat, un geste de l'agent — au lieu d'un `502` unique | NC-IV-006 | L'aller-retour complet de la formalité | Moyen | auteur | 30–90 j |
| **P-53** | **Nommer la limite du démonstrateur** là où une signature s'affiche : pastille « signature déclarée (démonstration) » portée par l'acte, en plus du bandeau | NC-II-017 | Personne ne confond une démonstration avec une preuve | Faible | auteur | 30–90 j |
| **P-49** | **Éprouver le client de télétransmission contre une vraie passerelle** (ou un banc reproduisant le format @ctes et ses codes de refus) | NC-IV-006 | Le format des accusés est validé avant le premier client | Moyen | auteur | 90–180 j |
| **P-52** | **Rembourser la dette de structure** : découper `app.css` et les deux gros écrans, factoriser les règles dupliquées, extraire le domaine du service de démonstration | NC-I-003, NC-I-004, NC-I-010 | Coût de reprise divisé | Moyen | auteur | 90–180 j |

*(Les propositions P-31 à P-43 de la campagne précédente restent valides ; celles qui étaient
couvertes par cette livraison — la transmission réelle (P-41, volet transmission) — sont soldées,
et les autres sont reprises ci-dessus lorsqu'elles touchent un constat encore ouvert.)*

---

## 9. Annexe A — Registre des non-conformités (extrait)

Le registre complet — fiches, constats, preuves, recommandations, efforts, échéances — est tenu
dans `src/audit/REGISTRE-NON-CONFORMITES.md` (**41 fiches**). Extrait à la fin de cette campagne :

| Fiche | Cote | Statut | Constat en une ligne |
|---|---|---|---|
| NC-I-001 | Majeure | Levée | Épreuves de parcours écrites |
| NC-I-002 | Majeure | En cours | Verrou de dépendances absent |
| NC-I-003 | Mineure | En cours | Monolithes |
| NC-I-004 | Mineure | Levée | Règles dupliquées factorisées |
| NC-I-005 | Observation | Levée | Licence tranchée, nommage clarifié |
| NC-I-006 | Observation | Levée | Démonstration présentée comme non conservatoire |
| NC-I-007 | Observation | Levée | Outillage rangé correctement |
| NC-I-008 | Majeure | En cours | État de la chaîne d'intégration non vérifiable |
| NC-I-009 | Mineure | Levée | Contrôle de style opérant |
| NC-I-010 | Mineure | Levée | Jeu d'appels commun aux deux services |
| **NC-I-017** | **Majeure** | **Ouverte** | **La copie de travail et la copie publiée ont divergé (version, changelog, registre)** |
| NC-II-001 | Bloquante | Levée | Plus de jeton d'écriture publié ; clés à rôles |
| NC-II-002 | Bloquante | Levée | Webhook authentifié, empreinte recalculée |
| NC-II-003 | Bloquante | Levée | Collections sensibles réservées |
| NC-II-004 | Majeure | Levée | Rôles appliqués côté serveur |
| NC-II-005 | Majeure | Levée | Actes individuels fermés à l'anonyme |
| NC-II-006 | Majeure | Levée (renforcée 1.6.3) | Signature opposée à l'opérateur, à l'interface **et** au service |
| NC-II-007 | Majeure | Levée | Contenu publié assaini (XSS) |
| NC-II-008 | Mineure | Levée | Clé de moteur hors du référentiel |
| NC-II-009 | Mineure | Levée | Valeurs par défaut sûres, en-têtes de sécurité |
| NC-II-010 | Observation | En cours | Rétention et export du journal non définis |
| NC-II-011 | Observation | Levée | Sous-traitances documentées |
| NC-II-012 | Observation | **Ouverte** | Démonstration non conservatoire |
| NC-II-013 | Observation | Levée | Registre d'audit chapeauté |
| NC-II-014 | Mineure | Levée | Dossiers de collections distincts |
| **NC-II-016** | **Mineure** | **Ouverte** | **La formalité de transmission se court-circuite par une `reference` fournie** |
| **NC-II-017** | **Observation** | **Acceptée** | **Sur la démonstration, le service ne peut opposer aucune identité** |
| NC-III-001 | Majeure | Levée | Documentation réalignée |
| NC-III-002 | Mineure | Levée | Lien d'évitement présent |
| NC-III-003 | Mineure | Levée | Cibles tactiles conformes |
| NC-III-004 | Mineure | Levée | Alignement du pied de page corrigé |
| NC-III-005 | Observation | Levée | Repère de navigation de l'atelier rétabli |
| NC-III-006 | Observation | Levée | Libellé d'épinglage adapté à l'état |
| NC-III-007 | Observation | Levée | (suivi de NC-III-005) |
| NC-III-008 | Observation | En cours | Démonstration indexable (`/robots.txt` → 404, revérifié) |
| NC-IV-001 | Majeure | En cours | Non-répudiation non établie hors signature interne |
| NC-IV-002 | Majeure | Levée | Licences affichées et inscrites |
| NC-IV-003 | Mineure | En cours | ELI non unifié |
| **NC-IV-004** | **Mineure** | **Levée** | **La télétransmission est réelle quand le service est branché** |
| NC-IV-005 | Observation | Levée | Version consolidée qualifiée |
| **NC-IV-006** | **Mineure** | **Ouverte** | **Les refus du contrôle de légalité ne sont pas traités ; le client n'a jamais parlé à une vraie passerelle** |

Bilan : **41 fiches** — 29 levées, 4 ouvertes, 7 en cours, 1 acceptée ; 3 bloquantes (toutes
levées). Quatre fiches nouvelles cette campagne (`NC-I-017`, `NC-II-016`, `NC-II-017`,
`NC-IV-006`) et **une fiche levée** (`NC-IV-004`).

## 10. Annexe B — Grille de cotation

| Cote | Définition | Effet attendu |
|---|---|---|
| **Bloquante** | Empêche la mise en service, la sécurité juridique ou la sécurité tout court. | Correction avant toute exploitation réelle. |
| **Majeure** | Défaut de conformité ou de sécurité avéré, à impact réel, mais contournable. | Correction planifiée et suivie. |
| **Mineure** | Écart réel mais d'impact limité, gênant la qualité ou l'usage. | Correction dans un lot d'amélioration. |
| **Observation** | Point de vigilance, risque futur, ou bonne pratique manquante. | À instruire, sans correction obligatoire. |
| **Point conforme** | Satisfait une exigence. | À préserver ; à documenter. |

## 11. Annexe C — Journal d'audit

**Chronologie et temps passé (1 h 35).**

| Séquence | Travail | Temps |
|---|---|---|
| Cadrage | cadre d'audit, annexes, registre (37 fiches), rapport précédent, note de version 1.6.3 | 10 min |
| Chapitre I | inventaire de `src/` (310 fichiers, 139 678 lignes, ≈ 9,6 Mo), mesure des documents, lecture du module de télétransmission, des variables et de la génération d'`API.md` | 20 min |
| Chapitre II | revue du service : `porteSignature`, `hWebhookSignature`, `hTransmettre`, `hConformite` (opposition d'identité, attribution, court-circuit), secrets et configuration, journal | 25 min |
| Chapitre III | parcours réel dans l'aperçu : recueil public (DOM + capture), écran de connexion, écran Administration › Expérimentale (état réel de la télétransmission), vue API REST, mesures | 20 min |
| Chapitre IV | cycle réglementaire (transmission réelle / marquée), ELI, licence, registre public | 10 min |
| Rédaction | rapport, registre (statuts revérifiés, 4 fiches ajoutées, synthèse recalculée, historique) | 10 min |

**Vérifications effectuées.**

- **Épreuves d'atelier** : les 37 fichiers d'épreuves joués dans le harnais → **418 vertes / 437** ;
  les 19 restantes sont environnementales (pas de `node:crypto` : `jws` 0/5 ; pas de
  `child_process` : `industrialisation` 0/4 ; pas de réseau sortant : `purs` 26/28, découverte OIDC ;
  `pilote-persistance` 2/8, `amorcage-demo` 1/2 — échecs **connus et reproduits hors de cette
  campagne**).
- **Épreuves neuves** : `controle-legalite.test.mjs` **9/9**, `actes.test.mjs` **30/30** (dont 5 cas
  neufs : transmission réelle, refus → `502` sans écriture, rétablissement, compilation,
  attribution `verifiee`).
- **Parcours navigateur** : `contexteDeLApercu()` + `lancerParcours()` → **26/26**, dont le parcours
  neuf `signature-hors-competence` (balayage des **759 paires** acte × compte ; aucun bouton de
  signature sur un acte hors compétence).
- **Service de l'aperçu (dynamique)** : `GET /v1/health` → 200 ; `GET /v1/auth/etat` → `mode:
  "demonstration"` ; `GET /v1/config` → `controleLegalite { actif:false, transport:"demonstration",
  cle:false, motif:"…la télétransmission y est simulée…" }` et `prestataire { actif:false, … }` —
  **aucune clé** dans la réponse.
- **Panneau Administration › Expérimentale** : avec l'étape activée, le bloc affiche l'état **réel**
  du service (« Transmission simulée par le service — Cette page n'est pas servie par le service de
  la collectivité… ») et la recette `.env` ; le réglage a été remis à son état initial.
- **Vue API REST** : la route `/v1/actes/{id}/transmission` est présente ; `docs/API.md` (engendré)
  porte `transmission_echec` (502) — vérifié par lecture du fichier.
- **Copie publiée** (cadrage) : `raw.githubusercontent.com/aplds/scribae/main/src/lib/version.js`
  → `APP_VERSION = "1.6.1w"`, `APP_RELEASED = "2026-09-29"` ; la première entrée datée de son
  changelog est `[1.6.1w] — 2026-09-29` ; son registre d'audit est en **version 5** (`mis_a_jour:
  2026-09-30`, 39 fiches, campagnes 4 et 5) ; `https://demo.scribae.eu/robots.txt` → **404**.

**Ce qui n'a pas pu être vérifié, et pourquoi.**

1. **La porte de signature côté service, en vrai, sur un service à session.** L'aperçu sert un
   service de **démonstration** (`mode: "demonstration"`), qui n'identifie aucune personne : la
   branche d'opposition ne s'y déclenche pas. Elle est vérifiée par les **épreuves** d'atelier
   (`actes.test.mjs`, contexte à session) et par lecture de code — **non** par un appel réel contre
   un service auto-hébergé. À rejouer sur une installation à `AUTH_MODE=password` ou `oidc`.
2. **Le court-circuit par `reference`** (`NC-II-016`) : établi par **lecture de code**
   (`actes.mjs` : `if (!reference && controleLegalite && controleLegalite.actif())` et
   `demonstration = !appelReel`), **non reproduit dynamiquement** — l'aperçu n'a pas de service
   branché, et le parcours n'a pas d'acte signé disponible pour l'essai. À rejouer sur un service
   branché sur un banc.
3. **L'état de la chaîne d'intégration du dépôt publié** : les journaux d'exécution exigent des
   droits d'administration (API GitHub). L'état des deux contrôles n'est donc **pas** instruit.
4. **Le rendu complet du recueil public en capture d'image** : la capture a été obtenue en
   **excluant les images** (l'attente des médias distants figeait le moteur de capture) ; le
   **DOM** du recueil a été vérifié intégralement (en-tête, bouton « Se connecter », recherche,
   informations, « À la une », thèmes), mais la composition **avec** les images n'a pas été jugée.
5. **La navigation au clavier et le lecteur d'écran** : l'aperçu ne reçoit pas d'événements
   clavier réels ; l'ordre de tabulation et le contour de focus restent vérifiés par la règle CSS
   et par le parcours existant, non par un parcours clavier réel.
6. **La télétransmission vers une vraie passerelle** : aucun accès @ctes n'existe dans l'atelier ;
   le module n'a été éprouvé que contre un `fetch` de banc (`controle-legalite.test.mjs`).

*Fin du rapport.*
