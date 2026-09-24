---
titre: Audit Scribae — 2026-09-21 (2e campagne, après mise en œuvre)
version_outil: 1.2.0
duree: 2h10
chapitres: 4
non_conformites: 30
points_conformes: 86
propositions: 14
registre: src/audit/REGISTRE-NON-CONFORMITES.md
precedent: src/audit/rapports/AUDIT-SCRIBAE-2026-09-21.md
---


> **Document de travail — un audit constate, il ne certifie pas.** Ce rapport de la deuxième campagne ne corrige rien : il
> relève, prouve et propose. Les non-conformités qu'il établit sont suivies dans le **registre
> cumulatif** (`../REGISTRE-NON-CONFORMITES.md`), où leur **statut évolue** d'une campagne à l'autre —
> une fiche lue ici peut être **levée depuis**, ou au contraire encore **ouverte**. Les termes employés
> (gravité, cotation, preuve, contrat de sortie) sont définis par le cadre : `../PROMPT-AUDIT-SCRIBAE.md`.
# Audit Scribae — 2e campagne (2026-09-21)

**Objet.** Deuxième campagne d'audit de `https://perchance.org/scribae`, menée **après la mise
en œuvre des recommandations** de la première campagne. Elle constate ce qui a été corrigé, ce
qui ne l'a pas été, et ce qui apparaît. Elle **reprend** le registre et le rapport précédent
(`rapports/AUDIT-SCRIBAE-2026-09-21.md`), conformément au cadre
(`src/audit/PROMPT-AUDIT-SCRIBAE.md` §0 et §9.10).

**Ce que cette campagne ajoute à la méthode.** À la demande du prescripteur, la vérification
dynamique passe **aussi par l'interface** : les gestes ont été faits par les écrans (clics,
formulaires, listes, modales), comme les ferait un agent — provisionnement du service, création
et révocation de clés, lecture du journal d'audit, mise à la une d'un acte, recherche au
recueil, ouverture d'un acte publié, mesures d'accessibilité à 390 px de large, captures
d'écran. Les appels directs à l'API ne servent plus qu'à **confirmer** ce que l'écran a montré.
Le §5.4 du cadre demandait déjà ces parcours ; la première campagne les avait partiellement
déduits du code.

**Périmètre.** `main.pjs`, `index.html` (y compris le script serveur), l'intégralité de `src/`,
l'application à l'exécution, ses interfaces, ses données de démonstration et sa documentation.
Hors périmètre : la plateforme Perchance elle-même, le prestataire de signature externe,
l'infrastructure de la collectivité (§2.2 du cadre), **mais leur usage par Scribae est audité**.

**Distinction tenue.** L'audit sépare systématiquement **l'outil de démonstration** (ce qui
tourne sur `perchance.org/scribae`, avec ses limites assumées) du **déploiement cible**
(service auto-hébergé, MySQL/MariaDB, SMTP). La confusion entre les deux est restée un objet
d'audit : elle a produit, cette fois, un constat précis (§ II.6, NC-II-012).

**Moyens.** Quatre regards (DSI, RSSI, qualiticien, DAJ), une durée réelle de **2 h 10**
(détail en Annexe C), **une trentaine de vérifications à l'écran**, des mesures instrumentées
(`getBoundingClientRect`, contrastes calculés WCAG, ordre de tabulation), des captures d'écran
et des citations de code avec références `fichier:ligne`.

**Pièces.**
- `src/audit/REGISTRE-NON-CONFORMITES.md` (registre cumulatif mis à jour : 30 fiches) ;
- `src/audit/rapports/AUDIT-SCRIBAE-2026-09-21.md` (campagne 1 — référence de comparaison) ;
- `src/audit/PROMPT-AUDIT-SCRIBAE.md` (cadre).

---

## 1. Synthèse pour la direction

### 1.1 Appréciation générale

**Les trois non-conformités bloquantes sont levées.** La première campagne relevait que la clé
d'écriture de l'API était **publiée dans le code client**, que le webhook du prestataire de
signature permettait de **fabriquer une signature**, et que **toutes les collections** — comptes
compris — étaient **lisibles sans authentification**. Ces trois défauts sont corrigés, et non
seulement contournés : le service ne contient plus **aucun** secret, il refuse d'écrire tant
qu'il n'a pas été provisionné, chaque clé porte un **rôle** appliqué **côté serveur**, la
notification de signature exige un rôle dédié, et la lecture des actes non publiés comme des
comptes est fermée. Les huit non-conformités majeures restantes sont levées ou ramenées à un
résidu explicite (deux « en cours » sur des sujets de méthode, un sur la valeur probante de la
signature — qui touche à un choix d'infrastructure, pas au code).

Sur le fond, **le logiciel est passé d'une démonstration prometteuse mais ouverte à un socle
défendable**. Ce qui rendait le premier audit sévère — « n'importe qui peut écrire, n'importe
qui peut lire » — a disparu.

### 1.2 Le mot de chaque auditeur

| Chapitre | Cote | Ce qui a changé depuis la campagne 1 |
|---|---|---|
| **I — DSI** | **Passable, en progression nette** | L'outillage existe désormais : vérification de syntaxe sans dépendance (`npm run lint`), premiers tests hors navigateur (`npm test`), pipeline d'intégration continue, images Docker épinglées par empreinte, version de `mysql2` fixée. Restent : ni verrou de dépendances (`package-lock.json`), ni analyse statique, ni test de parcours ; et les monolithes du premier rapport sont intacts. |
| **II — RSSI** | **Bon** | Les trois bloquantes sont levées et **revérifiées à l'exécution**, y compris par les écrans. Modèle d'autorisation par rôle porté par le service, provisionnement à clé tirée par le poste (empreinte seule côté service), journal d'audit **tenu par le service** et chaîné par empreinte, en-têtes de durcissement, atterrissage des valeurs par défaut (CORS fermé, comptes à mot de passe). Restent : `force:true` offert à tout porteur d'un rôle d'écriture, export/rétention du journal non définis, et une **fragilité d'exploitation** observée sur le service de démonstration (perte d'état au redémarrage — NC-II-012). |
| **III — Qualité et accessibilité** | **Bon** | Lien d'évitement, cibles tactiles portées à 24 px (mesurées), note de pied réalignée, titre de document par écran, repère de navigation : les quatre points du premier rapport sont traités et **mesurés**. La documentation ne contredit plus l'outil. Restent des écarts de libellé (NC-III-006) et, plus largement, l'absence de tests d'accessibilité reproductibles. |
| **IV — DAJ / assemblées** | **Bon, avec une réserve juridique assumée** | La licence est **écrite** (logiciel sous GPL-3.0, réutilisation des actes sous Licence Ouverte 2.0, position sur le code produit par l'IA), la licence de réutilisation est **affichée au recueil et exposée en JSON-LD**, l'identifiant ELI est devenu une **adresse HTTP** dans l'Akoma Ntoso, et la version consolidée porte désormais une mention **« ne fait pas foi »** reliée à l'original signé. Réserve : la signature reste un **certificat auto-engendré** dans le navigateur (NC-IV-001) — c'est le seul point qui empêche de dire « valeur probante pleine ». |

### 1.3 Les dix risques majeurs, par ordre décroissant

1. **Valeur probante de la signature** — le certificat est engendré par le navigateur au nom
   déclaré : la vérification prouve l'intégrité, pas l'identité (NC-IV-001, *en cours*).
2. **Le « mode démonstration » peut être pris pour un service** — son état est évinçé, n'a ni
   sauvegarde ni restauration, et il **redémarre en perdant tout** (NC-II-012, NC-I-006).
3. **`force:true` sur la synchronisation** — un éditeur peut écraser une écriture concurrente
   hors contrôle de révision (NC-II-004, résidu).
4. **Aucun verrou de dépendances ni analyse statique** — la CI existe mais ne garantit pas la
   reproductibilité (NC-I-002, *en cours*).
5. **Aucun test de parcours** — la couverture s'arrête aux modules purs ; un écran peut casser
   sans être vu (NC-I-001, *en cours*).
6. **Fichiers monolithiques** (jusqu'à 3 146 lignes ; README de ~215 Ko) — coût de reprise
   (NC-I-003).
7. **Une même règle écrite trois fois** (partie publique de l'original, empreinte) — risque de
   divergence (NC-I-004).
8. **Journal d'audit sans politique de conservation ni d'export** (NC-II-010, *en cours*).
9. **Identifiant ELI non résoluble en tant qu'URI** : `eliUri` reste la forme `eli:/…` — la
   divergence avec l'Akoma Ntoso est corrigée, pas la nature de l'identifiant (NC-IV-003).
10. **Télétransmission simulée produisant une mention ambiguë** (NC-IV-004).

### 1.4 Trajectoire recommandée

**La sécurité est passée de « à refaire » à « à entretenir ».** La priorité se déplace donc :
d'abord **industrialiser** (verrou de dépendances, tests de parcours : P-20, P-21), ensuite
**purger les résidus de conception** (P-17 `force`, P-18 ELI, P-19 mention de transmission),
enfin **préparer l'exploitation réelle** (sauvegarde testée, supervision : P-26) et **la
valeur probante** (signature qualifiée : P-25 — décision d'infrastructure, pas de code).

Aucune correction n'est requise avant mise en service. Les six non-conformités encore ouvertes
ou en cours sont **contournables**, documentées, et n'exposent ni les données ni la sécurité
d'un service correctement déployé.

---

## 2. Chapitre I — Systèmes d'information (DSI)

**Question directrice.** « Est-ce que je peux faire tourner, faire évoluer, faire auditer et
reprendre ça sans l'auteur, dans dix ans, avec une équipe ? »

**Posture.** L'outillage est arrivé — c'est la vraie nouvelle de cette campagne. Une base de
tests existe, une vérification de syntaxe est exécutable partout, une chaîne d'intégration
continue est décrite, et les dépendances d'images sont figées. Il reste que **rien de tout cela
ne teste les parcours** : ce qui est éprouvé, ce sont les modules purs, pas l'écran. Un auditeur
externe dirait aujourd'hui : « je peux reprendre ; je serais prudent sur les évolutions. »

### I.1 Architecture et découpage

**Constat.** L'architecture reste ce qu'elle était — et c'est une force — : `main.pjs` ne porte
que le `$meta` et les imports de plateforme ; `index.html` porte la coquille, le service et le
point d'entrée ; `src/lib/` porte le métier (modules purs pour l'essentiel), `src/ui/` les vues,
`src/server/` le déploiement auto-hébergé. Cette campagne ajoute **trois modules** au métier, tous
purs et sans dépendance :
- `src/lib/cle-service.js` — le **porteur en mémoire** de la clé du service
  (`definirCleService` / `cleService`, `src/lib/cle-service.js:16` et `:21`) : la clé n'est plus
  dans le code, mais le reste de l'application la lit par un point unique ;
- `src/lib/cles-service.js` — les appels de **provisionnement et d'administration des clés**,
  avec un tirage cryptographique **côté poste** (`tirerCle`, `src/lib/cles-service.js:33`) ;
- `src/lib/sanitize.js` — l'**assainissement** du fragment publié (`assainirHtml`,
  `src/lib/sanitize.js:63`) et le contrôle des adresses (`adresseSure`, `:38`).

**Points conformes.**
- Séparation nette front / service / persistance, tenue dans cette campagne : le durcissement a
  été fait **dans le service** (`index.html`) et la persistance du jeton dans la façade
  (`src/lib/db/index.js`), sans contaminer les vues.
- Le contrat de persistance (`src/lib/db/contract.js` + trois pilotes `local`, `service`,
  `external`) n'a pas bougé alors que l'autorisation changeait sous lui : le couplage est
  correct.

**Non-conformités.** NC-I-004 (une même règle écrite trois fois — *ouverte*).

**Recommandations.** (P-22) Extraire la règle « partie publique de l'original » et l'empreinte
SHA-256 en un point unique.

### I.2 Qualité et lisibilité du code

**Constat.** Les fichiers nouveaux sont courts, commentés au niveau du pourquoi, et homogènes
avec l'existant. Les trois modules ajoutés pèsent 25, 78 et ~100 lignes : c'est le bon gabarit.
Les monolithes, eux, n'ont pas bougé d'une ligne : `src/css/app.css` (3 146 lignes),
`src/ui/views/signature.js` (3 135), `src/SPEC.md` (2 702), `src/README.md` (2 672 avant cette
campagne).

**Points conformes.**
- Commentaires d'intention systématiques (chaque module nouveau ouvre sur *ce qu'il fait* et
  *pourquoi*), ce qui rend le code auditable sans l'auteur.
- Convention de nommage des identifiants DOM (`Btn`, `El`, `Ctn`, `Input`) respectée dans les
  ajouts.

**Non-conformités.** NC-I-003 (monolithes — *ouverte*), NC-I-004 (*ouverte*), NC-I-005
(nommage `revision.js` / `revisions.js` — *en cours* : la licence est tranchée, le renommage ne
l'est pas).

**Recommandations.** (P-22, P-23) Découper par opportunité (le prochain chantier qui touche
`signature.js`) ; renommer `revisions.js` en `historique-brouillons.js`.

### I.3 Environnements, tests, industrialisation

**Constat.** C'est le poste qui a le plus progressé. Trois briques nouvelles :
1. **vérification de syntaxe sans dépendance** — `src/scripts/verifier-syntaxe.mjs` passe
   `node --check` sur **tout** le JavaScript du dépôt. Exécuté ici sur **120 fichiers** (par un
   analyseur différent, esbuild-wasm, Node n'étant pas disponible dans l'atelier) : **aucune
   faute** ;
2. **tests hors navigateur** — `src/tests/purs.test.mjs` éprouve `expr.js`, `sanitize.js`,
   `numbering.js`, `version.js`, avec des assertions rejouées **dans la page** (les huit
   assertions sensibles ont été exécutées : `checkExpr("1 +")` rend `{ok:false}`,
   `assainirHtml` retire `onclick`, `<script>`, `javascript:`, `<iframe>` et conserve `<em>` et
   les images `data:image/…`) ;
3. **chaîne d'intégration continue** — `src/github/ci.yml` (à recopier en
   `.github/workflows/ci.yml`) exécute syntaxe + tests, puis les tests du service.

**Points conformes.**
- `npm run lint` sans aucune dépendance : pas de chaîne d'approvisionnement à auditer pour
  vérifier le code.
- `npm test` couvre des modules **réellement purs** ; un module exigeant un navigateur **fait
  sauter** ses tests au lieu de faire tomber la suite — choix documenté et correct.
- Un travail de CI est dédié au service auto-hébergé, séparé du client.

**Non-conformités.** NC-I-001 (*en cours* : base posée, aucune couverture des parcours),
NC-I-002 (*en cours* : le `package-lock.json` n'est pas livré, aucun linter), NC-I-007
(*ouverte* : l'outillage vit dans `src/` alors qu'il doit être recopié à la racine du dépôt).

**Recommandations.** (P-20) Produire et commiter le verrou, passer la CI à `npm ci`, ajouter un
linter. (P-21) Écrire les premiers tests de parcours. (P-27) Trancher le rangement de
l'outillage.

### I.4 Dépendances et chaîne d'approvisionnement

**Constat.** Les dépendances sont désormais **fichées**, ce que la campagne 1 appelait de ses
vœux :
- `mysql2` passe de `^3.11.3` à **`3.11.3`** (`src/server/mysql/package.json`) ;
- les images Docker sont **épinglées par empreinte** : `node:20-alpine@sha256:fb4cd12c…`
  (`src/server/mysql/Dockerfile`), `mariadb:11@sha256:79d59758…` et
  `nginx:alpine@sha256:62ff2089…` (`src/server/docker-compose.yml`). Les empreintes ont été
  relevées sur le registre public le jour de l'audit, avec la commande de reprise écrite en
  commentaire ;
- `src/LICENSE.md` établit la **table des dépendances** : une seule (mit, `mysql2`) — le moteur
  SMTP, `scrypt`, les sessions et l'anti-CSRF du service sont écrits sur place.

**Points conformes.**
- Les plugins de plateforme sont **importés par nom** (`main.pjs`), jamais recopiés : rien à
  auditer de ce côté.
- Aucun blob compilé, aucune bibliothèque minifiée injectée : le code servi est le code source.
- Le service auto-hébergé n'installe que ce qu'il déclare ; le `Dockerfile` utilise `npm ci`
  quand un verrou est présent, et `npm install` sinon (repli explicite).

**Non-conformités.** NC-I-002 (*en cours* : le verrou manque, donc `npm ci` ne s'active pas).

**Recommandations.** (P-20) Le verrou d'abord ; les empreintes ensuite, à chaque montée de
version.

### I.5 Gouvernance du code

**Constat.** `APP_VERSION` reste la source unique du numéro (`src/lib/version.js`), le
`CHANGELOG.md` tient une section **Non publié** désormais nourrie des changements de cette
campagne (rubrique `Sécurité` : neuf entrées — provisionnement à clé, fermeture des collections,
webhook authentifié, assainissement du recueil, secret hors du référentiel, journal du service,
durcissement, valeurs par défaut sûres ; rubrique `Ajouté` : licence, outillage). La
**propriété intellectuelle** est tranchée : `src/LICENSE.md` fixe le régime du logiciel
(GPL-3.0, cohérent avec le fichier `LICENSE` du dépôt), celui des actes publiés (Licence Ouverte
2.0 par défaut) et celui du **code produit par l'IA** (titulaire : le propriétaire du dépôt ;
même licence, sans régime à part). `src/docs/GITHUB.md` ne dit plus « tous droits réservés ».

**Points conformes.**
- Une seule source pour le numéro de version ; le `version` de `package.json` la suit.
- Journal des versions tenu au moment de livrer, pas avant (règle écrite et respectée).
- Licence documentée, y compris pour le code assisté par IA, et lisible **dans l'application**
  (*Documentation technique › Licence*).

**Non-conformités.** NC-I-005 (*en cours* : seul le renommage reste).

**Recommandations.** (P-23) Le renommage, à l'occasion.

### I.6 Exploitation

**Constat.** Le service expose `GET /v1/health` avec la place occupée **et** la capacité utile
(`index.html`, `hSante`), ce qui permet de voir venir un état trop gros — bon point de la
campagne 1, conservé. Le **journal d'audit du service** ajoute un instrument d'exploitation
réel : il se lit depuis l'interface (« Journal d'audit du service ») et rend `Chaîne intègre —
n entrée(s) » (vérifié). En revanche, l'exploitation du **mode démonstration** reste
problématique, et c'est un constat nouveau de cette campagne : voir NC-II-012.

**Points conformes.**
- Capacité et occupation publiées par la route de santé.
- Journal du service consultable à l'écran, sans outil externe.

**Non-conformités.** NC-I-006 (*levée* : la documentation interdit désormais l'usage du mode
démonstration comme mode de conservation — `src/docs/ADMINISTRATION.md` § 7.5 et § 7.6),
NC-II-012 (*ouverte*, voir chapitre II).

**Recommandations.** (P-26) Instruments d'exploitation : sauvegarde et restauration **testées**,
supervision, procédure d'incident.

### I.7 Souveraineté, hébergement, réversibilité

**Constat.** Inchangé et satisfaisant : le logiciel n'est lié à aucun hébergeur (édition
statique, plateforme ou pile Docker), les données s'exportent (JSON, Akoma Ntoso, HTML, Word,
Markdown, texte), et les secrets ont quitté les données exportées (la clé du moteur de langage
n'est plus dans le référentiel ; la clé du service ne vit plus dans le code).

**Points conformes.**
- Trois formes d'exploitation au choix (statique, plateforme, auto-hébergé), sans réécriture.
- Export complet des données et des formats normés ; aucune dépendance à un service propriétaire.
- Secrets hors des exports (nouveauté : `src/lib/store.js`, `sansSecrets`, et la clé conservée
  par poste).

**Non-conformités.** Aucune.

**Recommandations.** Aucune.

### I.8 Documentation et reprise par un tiers

**Constat.** La documentation de reprise existe maintenant pour ce qui manquait :
`src/docs/INDUSTRIALISATION.md` dit **comment vérifier, tester et livrer**, où vivent les
fichiers, ce qui **reste à mettre en place**, et comment reprendre les empreintes d'images. Elle
est lisible **dans l'application** (*Documentation technique › Vérifier, tester, livrer*),
vérifié. `src/README.md` a reçu les trois modules nouveaux, les documents d'audit, les tests,
l'outillage et la licence dans son inventaire d'architecture. Reste le problème de fond de la
campagne 1 : un `README.md` de ~215 Ko reste le point d'entrée unique du développeur.

**Points conformes.**
- Un document de reprise dédié à l'outillage, avec l'état réel (livré / à faire) explicite.
- Inventaire d'architecture à jour, module par module, y compris les ajouts de cette campagne.
- La documentation d'administration écrit ce que la démonstration **n'est pas**.

**Non-conformités.** NC-I-003 (*ouverte* : scinder le README en documents thématiques).

**Recommandations.** (P-22) Scinder `README.md` à l'occasion du prochain chantier documentaire.

---

## 3. Chapitre II — Sécurité des systèmes d'information (RSSI)

**Question directrice.** « Qui peut faire quoi, à qui, avec quelles données, et qu'est-ce qui
reste comme trace ? »

**Posture.** Les deux points d'entrée du cadre (§4.2) sont **confirmés et levés**, et les trois
bloquantes avec eux. Le modèle de sécurité a changé de nature : il n'y a plus de porte unique
aux écritures, mais des **clés à rôle**, vérifiées **côté service**, et plus de secret dans le
code servi. J'ai testé les rôles comme un attaquant le ferait — par l'interface d'abord, puis en
confirmant à l'API — et le résultat est bon. Deux résidus et un constat d'exploitation
subsistent.

### II.1 Cartographie et classification des données

**Constat.** La classification est désormais **écrite dans le service** et appliquée par
collection (`index.html:1260` et `:1272`) :

| Collection | Lecture | Écriture |
|---|---|---|
| `trames`, `meta` | **publique** (documents de travail) | `editeur` |
| `config`, `actes`, `presence`, `journal` | `lecteur` | `administrateur` / `redacteur` |
| `users` | `administrateur` | `administrateur` |

L'écriture de `users` et `config` exige un **administrateur** : c'est précisément ce qui ferme
l'élévation de privilèges relevée en campagne 1 (un jeton d'écriture pouvait s'inscrire lui-même
comme administrateur).

**Points conformes.**
- Classification formalisée (sensibilité par collection), et non plus implicite.
- Le publié reste public, le reste ne l'est pas : « rien de ce qui n'est pas publié ne sort ».

**Non-conformités.** NC-II-003 (*levée*).

**Recommandations.** Aucune.

### II.2 Comptes, authentification, habilitations

**Constat.** Le service ne connaît plus un jeton unique mais des **clés portant un rôle** :
`RANG = { administrateur: 4, editeur: 3, redacteur: 2, lecteur: 1 }` (`index.html:74`) plus le
rôle à part `prestataire`. Le provisionnement est un **geste unique** : la **première** clé est
tirée par le poste, seule son **empreinte SHA-256** est conservée, et l'écran la montre **une
seule fois** (`hBootstrap`, `index.html:580`). Les clés se créent, se listent (jamais leur
empreinte ni leur valeur — `hListeCles`, `:601`) et se révoquent, avec un garde-fou : **on ne
révoque pas la dernière clé d'administration** (`hRevoquerCle`, `:623`).

**Vérifié par l'interface.** Provisionnement depuis *Administration › Base de données*
(bouton « Provisionner le service ») → modale « Clé d'administration du service » + toast
« Service provisionné » ; « Voir les clés » → la clé d'administration ; « Générer une clé de
poste » → clé de rôle `editeur` ; « Révoquer » sur la clé d'administration → **refus** :
« Impossible de révoquer la dernière clé d'administration : le service se retrouverait sans
administrateur. » ; révocation de la clé de poste → « Clé révoquée ». **Puis confirmé à l'API** :
une clé `lecteur` obtient 200 sur `GET /v1/actes`, mais 403 `role_insuffisant` sur
`/v1/db/collections/users`, `/v1/journal`, `/v1/auth/cles`, sur un dépôt d'acte et sur une
synchronisation ; une clé `administrateur` obtient 200 sur `/v1/auth/cles`.

**Points conformes.**
- Aucun secret dans le code servi ; le service neuf est en **lecture seule**.
- Hiérarchie de rôles appliquée **côté serveur** (le client ne décide de rien).
- Révocation protégée contre le verrouillage de l'administration ; trace au journal.

**Non-conformités.** NC-II-001 (*levée*), NC-II-004 (*levée*, avec le résidu `force` ci-dessous),
NC-II-006 (*levée*).

**Recommandations.** (P-17) Restreindre `force` aux administrateurs.

### II.3 Sécurité applicative

**Constat.** L'injection HTML stockée est fermée : la version en ligne reçue du service passe
par `assainirHtml` avant toute insertion (`src/ui/views/acte-publie.js:192` et `:198`), et
l'assainisseur retire les balises actives, les gestionnaires `on…` et les schémas dangereux
(« le fragment publié perd ce qui peut exécuter »). Le langage d'expression du logiciel n'utilise
**pas** `eval` (`src/lib/expr.js`) : une tentative de sortie du langage ne trouve rien à
évaluer. Le service auto-hébergé interroge MySQL par requêtes **paramétrées** (`mysql2`), sans
concaténation de SQL.

**Points conformes.**
- Liste blanche de balises/attributs ; contrôle des adresses (`javascript:`, `vbscript:`,
  `data:text/html` refusés, y compris obfusqués par espace ou tabulation).
- Aucun `eval`, aucun `new Function` dans le moteur d'expression.
- Requêtes SQL paramétrées côté service.

**Non-conformités.** NC-II-007 (*levée*), NC-II-009 (*levée*).

**Recommandations.** Aucune.

### II.4 Sécurité de l'API

**Constat.** Chaque route **déclare** le rôle qu'elle exige, et le contrôle est fait avant le
gestionnaire (`authFail`, `index.html:350`). Exemples vérifiés :

| Route | Rôle exigé | Vérification |
|---|---|---|
| `GET /v1/health`, `GET /v1/publications`, `GET /v1/auth/etat` | public | 200 sans clé |
| `GET /v1/db/collections/{col}` | par collection (§II.1) | `users` → 403 sans clé ; `trames` → 200 |
| `POST /v1/db/collections/{col}/sync` | par collection | `lecteur` → 403 `role_insuffisant` |
| `GET /v1/actes`, `…/document`, `/v1/signatures` | `lecteur` | 403 sans clé ; 200 avec `lecteur` |
| `POST /v1/actes`, `…/signature`, `…/publication` | `redacteur` | `lecteur` → 403 |
| `POST /v1/publications/{cle}/epingle` | `editeur` | — |
| `…/retrait`, `/v1/journal`, `/v1/auth/cles`, `…/dossier-signature` | `administrateur` | `lecteur` → 403 |
| `POST /v1/webhooks/signature` | `{exact:["prestataire","administrateur"]}` | sans clé → 403 |

Les refus portent un **code** stable (`service_non_provisionne`, `jeton_absent`,
`jeton_invalide`, `role_insuffisant`) et le rôle effectif de la clé, ce qui rend le diagnostic
possible sans divulgation. La limitation de débit sur les écritures (90/min par connexion) est
conservée.

**Points conformes.**
- Autorisation au niveau de la route, avec codes d'erreur distincts et exploitables.
- Le service **non provisionné** ne sert que le public (état vérifié : `/v1/auth/etat` →
  `provisionne:false`).
- En-têtes de durcissement sur chaque réponse de l'API (`nosniff`, `no-store`,
  `referrer-policy`).

**Non-conformités.** NC-II-001, NC-II-002, NC-II-003, NC-II-004 (*levées*).

**Recommandations.** Aucune.

### II.5 Signature, intégrité et non-répudiation

**Constat.** Le point d'entrée « usurpation du signataire » du cadre est **confirmé et corrigé**,
et la forge de signature est fermée :
1. **la notification du prestataire exige un rôle** (`{exact:["prestataire","administrateur"]}`,
   `index.html:1405`) : un tiers anonyme ne peut plus faire passer un acte à « signée » ;
2. **le document déposé n'est plus public** : `GET /v1/actes/{id}/document` exige `lecteur`
   (vérifié : 403 sans clé) ;
3. **la signature est confrontée à la compétence de l'opérateur** : `competenceDuCompte` est
   appelé **avant** d'engager ou d'apposer une signature simple
   (`src/ui/views/signature.js:1150`, `:1264`) et à nouveau dans le circuit électronique
   (`:2187`), avec un refus explicite : « Votre compte n'est pas dans la chaîne de signature de
   cet acte : vous ne pouvez pas signer à la place du signataire désigné. » ;
4. **l'opérateur est tracé distinctement du signataire** dans le dossier interne
   (`src/lib/courriel.js`, `operateur`), et le dossier interne n'est servi par **aucune** route
   publique (il exige `administrateur`) ;
5. l'intégrité du paquet signé (empreinte SHA-256 comparée à celle du document déposé) reste
   vérifiée par le service.

**Points conformes.**
- Porte de compétence effective sur les trois chemins de signature, refus explicites, journalisés.
- Original signé **partagé en deux** (part publique / part interne nominative) : la part interne
  ne sort que par la route protégée.
- Le circuit externe porte la **certification de conformité du réviseur**, avec empreinte.

**Non-conformités.** NC-II-002 (*levée*), NC-II-006 (*levée* : la porte est en place et rejouée ;
le scénario complet d'usurpation n'a pas pu être **rejoué de bout en bout**, le jeu de
démonstration exigeant le passage préalable par un réviseur compétent — voir Annexe C).

**Recommandations.** (P-25) Signature qualifiée ou cachet serveur (le fond juridique, NC-IV-001).

### II.6 Segmentation des environnements

**Constat.** La segmentation est **documentée** mais pas **technique** : le mode de démonstration
reste un service partagé sans cloisonnement, dont l'état est évinçé par ancienneté. La
documentation d'exploitation écrit désormais noir sur blanc ce qu'il **n'est pas**
(`src/docs/ADMINISTRATION.md` § 7.5 : « Ce service n'est pas un service d'archivage » ; § 7.6 :
« La plateforme de démonstration n'est pas un service » — données partagées, état évincé, ni
sauvegarde ni restauration, pas de SMTP).

Cette campagne apporte un **constat nouveau et précis** : dans l'**aperçu d'édition**, le service
embarqué **redémarre et perd tout son état** dès que l'activité dépasse un seuil modeste
(NC-II-012, fiche ci-dessous). Deux publications tiennent ; la troisième provoque une fermeture
de canal en **code 1011**, et le service repart **vide** — clés de provisionnement comprises. La
conséquence pratique est qu'**un service redevient en lecture seule après un redémarrage**, ce
qui, sur un déploiement où les clés ne seraient pas persistées, serait un incident
d'exploitation majeur. Le service auto-hébergé, lui, range son état en base (`sb_etat`,
`src/server/mysql/state.mjs`) : les clés y survivent à un redémarrage — mais **ce point n'a pas
pu être éprouvé** (Annexe C).

**Points conformes.**
- Trois environnements distincts à l'installation : édition statique, plateforme, service dédié.
- La documentation interdit explicitement l'usage de la démonstration en service réel.
- Les secrets sont propres à chaque environnement (clé tirée par le poste, jamais partagée).

**Non-conformités.** NC-II-012 (*ouverte*), NC-I-006 (*levée*).

**Recommandations.** (P-27) Instances distinctes démonstration / recette / production.

### II.7 Journalisation, traçabilité, preuve

**Constat.** Le journal d'audit **du service** est né (`journaliser`, `index.html:643` ;
`journalScelle`, `:653` ; `hJournal`, `:662`). Chaque geste sensible y laisse une ligne —
dépôt, ouverture de circuit, notification, transmission, publication, retrait, épinglage,
provisionnement, création et révocation de clés — et chaque ligne **scelle la précédente** par
son empreinte, si bien qu'une altération rompt la chaîne.

**Vérifié par l'interface** (bouton « Journal d'audit du service ») : « Chaîne intègre —
3 entrée(s) conservée(s) », avec les trois lignes horodatées et lisibles
(`provisionnement`, `cle_creee`, `cle_revoquee`). Le journal est **tenu par le service**, non par
le poste qui a fait le geste : c'est ce qui le rend opposable. Les courriels non partis sont
tracés avec leur motif (`src/lib/courriel.js`), et l'export/rétention du journal reste, lui,
hors périmètre.

**Points conformes.**
- Piste d'audit côté service, chaînée par empreinte, avec contrôle de scellement à la lecture.
- Trace de l'opérateur distincte du signataire (dossier interne de signature).
- Trace des courriels, y compris les échecs et leurs motifs.

**Non-conformités.** NC-II-010 (*en cours* : le journal n'a ni politique de conservation ni
export normé).

**Recommandations.** (P-24) Export, rétention et inaltérabilité hors service du journal.

### II.8 Secrets et configuration

**Constat.** Plus aucun secret dans le code servi :
- la clé d'écriture n'existe plus en clair dans `index.html` ni dans un module client ; elle est
  **tirée par le poste** au provisionnement, conservée par poste (`db.getSettings().token`), et
  lue par un point unique (`cleService()`, `src/lib/cle-service.js:21`) ;
- la **clé du moteur de langage** a quitté le référentiel : elle est rangée dans le **stockage
  local du navigateur** (`cleMoteur` / `reglerCleMoteur`, `src/lib/assistant.js:238` et `:242`),
  **migrée** hors de la configuration à la lecture (`:180`), **retirée** à l'écriture
  (`sansSecrets`, `src/lib/store.js`), et donc **absente des exports** ;
- le **mot de passe SMTP** ne quitte jamais le serveur (il n'est jamais transmis au client).

**Points conformes.**
- Aucun jeton, aucune clé, aucun mot de passe dans le code servi (vérifié par recherche).
- Coffre local par poste pour la clé du moteur ; aide du champ conforme à la réalité.
- Comparaison d'empreinte **à temps constant** (`egalConstant`, `index.html:320`).

**Non-conformités.** NC-II-008 (*levée*), NC-II-011 (*levée* : le transfert au moteur est
documenté avec destinataire, finalité, données, localisation et durée —
`src/docs/ADMINISTRATION.md` § 5.5 ter, tableau RGPD art. 13/28).

**Recommandations.** Aucune.

### II.9 Protection des données à caractère personnel

**Constat.** Les actes **individuels** (revalorisations, sanctions) ne sont plus lisibles par
tout le monde : la lecture du dépôt exige `lecteur`, la publication reste le seul chemin ouvert,
et le service refuse par ailleurs de publier un acte `publishable:false`. Les données des
comptes (identifiant, courriel, rôles) ne sortent plus sans clé d'administration. Le transfert
vers le moteur de langage est documenté, et l'extinction des assistants est présentée comme le
moyen de ne rien transférer.

**Points conformes.**
- Actes individuels ni lisibles, ni publiable par le service (double barrière).
- Comptes lus seulement par l'administration ; aucune route ouverte ne les rend.
- Transfert d'assistance documenté ; minimisation tenue par construction (aucun contenu d'acte
  joint par l'atelier).

**Non-conformités.** NC-II-005 (*levée*), NC-II-011 (*levée*).

**Recommandations.** Aucune.

### II.10 Continuité, gestion des incidents, homologation

**Constat.** La procédure de sauvegarde/restauration du service auto-hébergé existe
(`src/docs/ADMINISTRATION.md` § 8), et la documentation précise les tables qui **doivent** être
dans un dump en mode comptes locaux (`sb_motdepasse`, `sb_session`) — sans quoi l'installation
serait inaccessible. Rien n'a bougé sur la démarche d'homologation (RGS/ANSSI) ni sur la
supervision. La restauration n'a pas été **testée** — elle est décrite, ce n'est pas la même
chose.

**Points conformes.**
- Procédure de sauvegarde documentée, avec les pièges connus identifiés.
- Le mode de démonstration est explicitement écarté comme mode de conservation.

**Non-conformités.** NC-I-006 (*levée*), NC-II-010 (*en cours*).

**Recommandations.** (P-26) Test de restauration, supervision, procédure d'incident.

### Fiche nouvelle — NC-II-012 (ouverte)

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | II.6 — Segmentation des environnements ; I.6 — Exploitation |
| Constat | Dans l'**aperçu d'édition**, le service embarqué **redémarre et perd l'intégralité de son état** dès que l'activité dépasse un seuil modeste. Reproduit trois fois : après **deux** publications (≈ 209 Ko d'état pour une capacité annoncée de 26 Mio), toute opération suivante échoue par `WebSocket closed (code 1011)`, puis `GET /v1/health` rend `objets:{actes:0,signatures:0,publications:0}` et `GET /v1/auth/etat` rend `provisionne:false` — **la clé de provisionnement est perdue avec le reste**. Interruptions observées : à la 2ᵉ opération avec 1,2 s d'espacement, à la 3ᵉ avec 4 s, puis encore à la 3ᵉ avec 50 s d'espacement entre deux évaluations distinctes. En revanche, **une publication isolée réussit systématiquement** (476 ms pour dépôt + signature + webhook + publication). |
| Exigence de référence | ISO/IEC 25010 (fiabilité, disponibilité) ; ISO/IEC 27002 (continuité) ; RGS (disponibilité) ; cadre §2.3 (distinction démonstration / production). |
| Preuve | `index.html` (routes et `saveDb`, `MAX_CHARS`) ; journaux des appels : `POST /v1/actes` → 201, `POST /v1/actes/ACT-0001/signature` → 202, `POST /v1/webhooks/signature` → 200, `POST /v1/actes/ACT-0001/publication` → 201, puis `POST /v1/actes` → `WebSocket closed (code 1011)` ; `GET /v1/health` avant : `utilise:106759` / `:208748` ; après : `utilise:4`, `objets:0`. Recette d'amorçage : `src/ui/demo-publications.js` (`PAUSE_AMORCAGE`, `REPRISES_MAX`). |
| Recommandation | (a) **Documenter** que l'aperçu d'édition n'est pas un environnement de démonstration tenable : l'y écrire comme tel, et renvoyer à l'instance enregistrée ; (b) **vérifier et documenter** la persistance des clés au redémarrage du service auto-hébergé (état en base, `sb_etat`) ; (c) si la perte d'état devait se reproduire **sur un service en service**, la traiter comme un incident de disponibilité (le service redevient silencieusement en lecture seule). Voir P-27. |
| Effort | Faible (documentation) à moyen (diagnostic du moteur de démonstration) |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Ouverte** |
| Origine | Audit 2026-09-21b |

---

## 4. Chapitre III — Qualité, accessibilité et expérience (qualiticien)

**Question directrice.** « Est-ce que tout est là, est-ce que c'est accessible à tous, et est-ce
que tout se comporte de la même façon ? »

**Posture.** Les quatre écarts d'accessibilité de la campagne 1 sont traités, et cette fois
**mesurés** — pas déduits du code. Le recueil public a été parcouru comme le ferait un habitant :
recherche, thèmes, ouverture d'un acte, pied de page. Cette campagne ajoute la mesure qui
manquait : les contrastes **calculés** (WCAG) et les cibles tactiles **mesurées à 390 px**.

### III.1 Complétude fonctionnelle

**Constat.** La complétude est celle de la campagne 1, à jour des changements de cette campagne :
les quatre fonctions du plan (provisionnement, administration des clés, journal du service,
licence de réutilisation) sont **livrées et atteignables à l'écran**.

| Exigence (source) | État |
|---|---|
| Chaîne trame → acte → validation → signature → transmission → publication → recueil | Présente (3 circuits de signature) |
| Identifiant ELI, exports Akoma Ntoso / Schematron / JSON-LD / HTML / Word / Markdown | Présente |
| Recueil public sans compte, recherche, thèmes, versions | Présente (parcourue) |
| Provisionnement et administration des clés du service | **Présente** (ajout de cette campagne ; exercée) |
| Journal d'audit du service, chaîné | **Présente** (ajout ; exercée) |
| Licence de réutilisation affichée et exposée en métadonnées | **Présente** (ajout ; vérifiée) |
| Version consolidée : mention « ne fait pas foi » reliée à l'original | **Présente** (ajout ; vérifiée à l'exécution) |
| Assistant de rédaction (moteur de langage) | Présente (documentée comme livrée) |
| Résumé quotidien | Absente (hors périmètre, assumé) |

**Points conformes.**
- Aucune promesse de l'accueil ou du guide n'est contredite par l'écran (point de campagne 1,
  revérifié).

**Non-conformités.** NC-III-001 (*levée*).

**Recommandations.** Aucune.

### III.2 Accessibilité (RGAA 4.1 / WCAG 2.1 AA)

**Constat.** Mesures faites dans la page, sur le recueil public :
- **lien d'évitement** « Aller au contenu » → `#recueil-contenu`, classe `recueil-evitement`
  (présent ; cible `<main id="recueil-contenu" tabindex="-1">`) ;
- **repère de navigation** `<nav aria-label="Navigation principale du recueil">` (compté : 1) ;
- **cibles tactiles** : points du carrousel **24 × 24 px** (contre 8 × 8 en campagne 1) ; croix
  d'effacement de la recherche **24 × 24 px** (contre 15 × 18) ; fermeture de la bulle
  d'assistance **24 × 24 px** par la feuille de style ;
- **contrastes calculés** (WCAG 2.1, rapport de luminance) : méta de carte **6,53:1** ; intitulé
  de carte **14,35:1** ; tuile de thème **7,79:1** ; note de pied de page **6,36:1** ; badge
  « à la une » **5,70:1** ; titre de section **15,16:1** — tous **au-dessus** du seuil AA
  (4,5:1 pour le texte courant, 3:1 pour le grand texte) ;
- **titre de document par écran** : « Trames — Ville de Valmont-sur-Loire »,
  « Recueil des actes administratifs — … », « Documentation technique », « Acte introuvable —
  recueil » (relevés successifs) ;
- **alignement** de la note de pied de page : `text-align: left` (contre `center` en campagne 1).

**Points conformes.**
- Lien d'évitement présent, cible focusable, styles dédiés (`src/css/app.css:2755` et `:2756`).
- Repère de navigation nommé ; régions `header` / `main` / `footer` correctement balisées.
- Contrastes conformes AA sur les six éléments mesurés.
- Cibles tactiles conformes au seuil 24 px partout où mesurable.

**Non-conformités.** NC-III-002 (*levée*), NC-III-003 (*levée*), NC-III-005 (*levée*).
**Réserve de vérification :** la **révélation visuelle** du lien d'évitement à la prise de focus
n'a pas pu être observée — le document de l'aperçu n'obtient jamais le focus clavier
(`document.hasFocus()` = `false`), et la règle `:focus` ne s'applique donc pas. Le nœud,
l'attribut `href`, la cible et la règle CSS sont vérifiés ; l'effet visuel, non (Annexe C).

**Recommandations.** (P-28) Un test d'accessibilité reproductible (contrastes, cibles, ordre de
tabulation) plutôt qu'une vérification manuelle par campagne.

### III.3 Ergonomie et parcours

**Constat.** Les parcours exercés cette campagne se tiennent : le provisionnement se fait en
**deux gestes** (choisir le mode, cliquer), avec un **état lu à l'écran** qui dit exactement où
l'on en est (« Ce service n'a encore aucune clé : il est en LECTURE SEULE… » puis
« Service provisionné : chaque clé en circulation porte un rôle… »). La révocation affiche le
refus en clair, motif compris. La mise à la une répond par un toast explicite (« Acte mis à la
une du recueil public »). Le parcours de recherche du recueil efface bien le carrousel et la
grille de thèmes pendant la recherche, et les restitue à l'effacement (vérifié : titres relevés
avant / pendant / après).

**Points conformes.**
- Messages de refus actionnables (« Faites-vous désigner, ou attendez une délégation en
  vigueur. »).
- États de chargement, vide et erreur distincts (le recueil vide affiche un état vide, pas une
  erreur) ; l'écran d'un acte non publié dit « Acte introuvable » sans casser la page.
- Retour utilisateur systématique (toasts) sur les gestes d'administration.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### III.4 Cohérence des interfaces

**Constat.** Une incohérence nouvelle, relevée à l'écran : le **libellé de la punaise** varie
selon l'emplacement et selon l'état. Dans la liste des actes, l'infobulle dit « Épingler — l'acte
sera à la « une » dès sa publication » — y compris pour un acte **déjà publié**, où le geste est
immédiat ; et le même geste porte un autre libellé (« Mettre à la « une » du recueil public »)
dans la rangée d'actions de la fiche. Un agent qui cherche « comment épingler » peut hésiter.

**Points conformes.**
- Vocabulaire homogène ailleurs (le provisionnement, les rôles, les refus parlent la même
  langue dans l'interface et dans l'administration).
- Les états (vide, chargement, erreur, succès) sont cohérents d'un écran à l'autre.

**Non-conformités.** NC-III-004 (*levée*), NC-III-006 (*ouverte* — voir fiche).

**Recommandations.** (P-28) Aligner les libellés de la punaise sur l'état réel de l'acte.

### III.5 Compréhension et aide

**Constat.** Le guide et les aides contextuelles disent désormais la vérité sur les assistants
(la note de la zone de saisie prévient du transfert au moteur), sur les annexes (ni signées ni
publiées pour elles-mêmes), et sur le circuit de signature. Le nouveau vocabulaire de
l'autorisation est **expliqué là où il apparaît** : l'aide du champ de clé dit ce que le service
conserve (l'empreinte), ce que le poste peut faire sans clé (lire le recueil public, ne rien
écrire), et que la clé n'est montrée qu'une fois.

**Points conformes.**
- Aides contextuelles présentes sur les réglages sensibles ; messages en français d'agent, sans
  jargon (pas de « token », pas de « CORS » non expliqué).
- Le guide couvre les trois circuits de signature et les cas de refus.

**Non-conformités.** NC-III-001 (*levée*).

**Recommandations.** Aucune.

### III.6 Robustesse et adaptation

**Constat.** Mesures à **390 × 844 px** (téléphone) : `scrollWidth` du document = `innerWidth`
= 390 → **aucun débordement horizontal** ; aucun élément dépassant le bord droit (balayage du
DOM) ; les points du carrousel restent à 24 px. À **874 px** puis à 390 px, la mise en page tient
en colonne unique, sans éléments rognés. L'impression reste traitée (feuille A4, `@page`), non
rejouée ici.

**Points conformes.**
- Aucun débordement horizontal mesuré à 390 px.
- Adaptation en colonne unique, contrôles tactiles conservés.
- Mise en page d'impression spécifique (A4) présente dans les styles d'export.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** Aucune.

### III.7 Qualité mesurée

**Constat.** Aucun indicateur de qualité n'est produit par le logiciel ni par la CI : pas de
taux de couverture, pas de mesure d'accessibilité, pas de compte de non-conformités suivi. Ce qui
existe — le journal des versions et l'exposition de `APP_VERSION` — est conservé.

**Points conformes.**
- Numéro de version exposé et cohérent entre `src/lib/version.js`, le `CHANGELOG.md` et le menu
  du compte.

**Non-conformités.** NC-I-001 (*en cours*), NC-I-002 (*en cours*).

**Recommandations.** (P-21, P-28) Les indicateurs naîtront des tests.

### III.8 Documentation utilisateur et formation

**Constat.** La documentation utilisateur (guide intégré) est fidèle à l'écran pour tout ce qui a
été parcouru ; la documentation technique a gagné un document (`INDUSTRIALISATION`) et la
licence, tous deux lisibles **dans l'application** (vérifié : les deux figuresnt au sommaire de
*Documentation technique*, et le document se rend sans erreur). Reste le point de campagne 1 : la
documentation est **volumineuse** et non découpée.

**Points conformes.**
- Documentation technique accessible aux administrateurs depuis l'application, lue depuis les
  fichiers du dépôt (aucune copie à maintenir).
- Les nouveaux documents sont intégrés au sommaire et à l'impression.

**Non-conformités.** NC-I-003 (*ouverte*).

**Recommandations.** (P-22) Scinder la documentation de référence.

### Fiche nouvelle — NC-III-006 (ouverte)

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | III.4 — Cohérence des interfaces |
| Constat | Le geste d'épinglage porte **deux libellés** selon l'emplacement, et l'infobulle ignore l'état de l'acte : dans la liste des actes, **41 boutons** portent le titre « Épingler — l'acte sera à la « une » dès sa publication », y compris sur un acte **déjà publié** (où l'effet est immédiat) ; la rangée d'actions de la même ligne porte le titre « Mettre à la « une » du recueil public ». Après épinglage, le bouton ne change pas de libellé (« Épingler » reste « Épingler », sans passe au « Désépingler » attendu). |
| Exigence de référence | ISO/IEC 25010 (cohérence, utilisabilité) ; RGAA/WCAG (intitulés explicites) ; exigence III.4 du cadre. |
| Preuve | Relevé `page_eval` de la liste des actes (`button[title]` : 41 occurrences du même libellé, dont la ligne `2026-403-VSL`, statut « Publié ») ; même ligne, bouton d'action « Mettre à la « une » du recueil public » ; après clic, toast « Acte mis à la une du recueil public » et `epingle:true` au service, sans changement de libellé. |
| Recommandation | Un libellé unique, adapté à l'état : « Épingler à la une » / « Retirer de la une », avec la distinction utile (« dès sa publication » réservée aux actes non publiés). Voir P-28. |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 90–180 jours |
| Statut | **Ouverte** |
| Origine | Audit 2026-09-21b |

---

## 5. Chapitre IV — Conformité et valeur juridiques (DAJ / assemblées)

**Question directrice.** « Est-ce que les actes produits ici sont juridiquement sûrs,
opposables, archivables, et est-ce que ça améliore vraiment ce que produit mon administration ? »

**Posture.** Le chapitre le plus amélioré après la sécurité. La licence existe, elle est
affichée, elle est exposée en métadonnées ; l'identifiant ELI est une adresse dans le document
normé ; la version consolidée dit qu'elle ne fait pas foi. Un point de fond reste, et c'est une
décision, pas un développement : **la signature**.

### IV.1 Conformité des actes et du cycle réglementaire

**Constat.** Le cycle n'a pas changé, et il est correct : la date de publication pilote
l'opposabilité (le lendemain, ou après un délai réglé), la transmission au contrôle de légalité
s'intercale **avant** la publication quand l'acte la requiert (le service refuse de publier sans
transmission : 409 `transmission_absente`), et les délais de recours sont suivis. La
télétransmission reste **simulée** (accusé fabriqué par le service), et c'est l'objet de
NC-IV-004.

**Points conformes.**
- Opposabilité calculée et affichée ; mention de recours produite sur le document.
- Le contrôle de légalité conditionne la publication, côté service (barrière serveur).

**Non-conformités.** NC-IV-004 (*ouverte* : la mention produite reste ambiguë).

**Recommandations.** (P-19) Marquer distinctement une transmission simulée.

### IV.2 Interopérabilité et normes

**Constat.** Deux progrès nets :
1. l'**adresse ELI** du document Akoma Ntoso est une **URI HTTP** (`FRBRuri` =
   `baseUri + "/eli/" + chemin`) tandis que `FRBRthis` conserve l'identifiant : la divergence
   relevée en campagne 1 entre le document normé et la publication est **corrigée** ;
2. le JSON-LD porte `eli:uri` (l'adresse) **et** `@id` (l'identifiant), plus
   `dcterms:license` — les conditions de réutilisation voyagent avec les données (vérifié à
   l'exécution : `{"@id":"https://www.etalab.gouv.fr/…/ETALAB-Licence-Ouverte-v2.0.pdf",
   "dcterms:title":"Licence Ouverte / Open Licence 2.0","rdfs:comment":"…"}`).

**Points conformes.**
- Six formats d'export, tous normés ou ouverts ; JSON-LD enrichi (ELI + licence).
- Cohérence Akoma Ntoso ↔ JSON-LD sur l'**adresse** de l'acte.

**Non-conformités.** NC-IV-003 (*en cours* : l'identifiant conservé par la publication
(`eliUri`) reste la forme `eli:/fr/…`, non résoluble en tant qu'URI ; l'adresse existe à côté,
mais deux champs coexistent).

**Recommandations.** (P-18) Faire de `eliUri` l'URI HTTP canonique, ou exposer les deux champs
nommés sans ambiguïté (`eliIdentifiant` / `eliAdresse`).

### IV.3 Sécurité juridique et valeur probante

**Constat.** Ce qui est établi : l'original signé est conservé, sa vérification est reproductible
et son intégrité contrôlée par le service ; l'original est **partagé en deux** (part publique
nominativement réduite / part interne), et la part interne ne sort que par une route
d'administration — c'est une avancée réelle sur la protection des mentions nominatives. Ce qui
n'est **pas** établi : **qui** a signé. Le certificat est engendré par le navigateur au nom
déclaré par l'acte, et la clé privée reste dans le stockage du navigateur (NC-IV-001). La porte
de compétence (§II.5) empêche désormais de signer **à la place d'un autre** dans l'application ;
elle ne transforme pas un certificat de démonstration en signature qualifiée.

**Points conformes.**
- Original signé conservé, vérifiable, avec sa part interne protégée.
- La certification de conformité du réviseur (circuit externe) est horodatée et liée à
  l'empreinte de la pièce signée.

**Non-conformités.** NC-IV-001 (*en cours* : le fond du sujet est l'infrastructure de
signature).

**Recommandations.** (P-25) Brancher la chaîne eIDAS de la collectivité.

### IV.4 Cycle de vie de l'acte

**Constat.** Le cycle de vie est complet (natives, modificatives, consolidées, abrogations,
retrait exceptionnel motivé et tracé). La nouveauté de cette campagne porte sur la **lisibilité
juridique des versions**, qui était l'objet de NC-IV-005 : la page d'une version consolidée
porte désormais un encadré **« Version consolidée — ne fait pas foi »** qui dit que
l'opposabilité et la date d'entrée en vigueur sont celles de l'acte d'origine modifié, et
renvoie par un **lien** à l'original signé sous le même identifiant ELI, avec sa date
(vérifié à l'exécution : le lien est produit et pointe sur l'identifiant de l'acte d'origine).

**Points conformes.**
- Distinction explicite original / version en ligne / version consolidée, désormais portée par
  le texte de la mention, non plus seulement par le titre du bloc.
- Le renvoi use du mécanisme d'identification par ELI (résolu en adresse par l'application et
  par le service, sans JavaScript).

**Non-conformités.** NC-IV-005 (*levée*).

**Recommandations.** Aucune.

### IV.5 Collaboration et gouvernance

**Constat.** Inchangé : parapheur (circuit de validation), délégations (arbre des chaînes de
signature), commentaires posés et suivis, journal d'audit applicatif, présence des postes. La
**compétence** est désormais exploitée au-delà de l'affichage : elle gouverne la signature
(§II.5) et filtre la file « Ma signature ».

**Points conformes.**
- Circuit de validation avec empreinte du texte validé (l'acte déposé doit correspondre).
- Délégations prises en compte par la porte de compétence (signataire **ou** délégataire en
  vigueur).
- Journalisation des gestes de circuit.

**Non-conformités.** Aucune.

**Recommandations.** Aucune.

### IV.6 Qualité du droit produit

**Constat.** Les contrôles de conformité à la trame, le rapport de conformité et le schéma
Schematron sont inchangés. La **doctrine** de la signature a, elle, été corrigée : le guide ne
dit plus que l'outil « ne signe pas à votre place » (c'était faux depuis le circuit simple).

**Points conformes.**
- Rapport de conformité et Schematron exportés avec l'acte.
- Documentation de la signature alignée sur les trois circuits réels.

**Non-conformités.** NC-III-001 (*levée*).

**Recommandations.** Aucune.

### IV.7 Transparence, données ouvertes et protection

**Constat.** Le recueil public affiche désormais, en pied de page, les **conditions de
réutilisation** : « Réutilisation : Licence Ouverte / Open Licence 2.0 — Source des données et
documents : la collectivité. Réutilisation autorisée sous Licence Ouverte 2.0. » (relevé à
l'écran), mention **configurable** (Administration › Publication › Mentions du recueil public ;
champs « Nom de la licence » et « Adresse du texte de la licence » relevés), et **exposée en
JSON-LD** (`dcterms:license`). C'est la réponse directe à l'obligation de publicité des
conditions de réutilisation (CRPA art. L. 322-6). La licence du **logiciel** est, elle, écrite
dans `src/LICENSE.md` (GPL-3.0, cohérent avec le `LICENSE` du dépôt) et `src/docs/GITHUB.md` ne
dit plus « tous droits réservés ».

**Points conformes.**
- Licence de réutilisation affichée au recueil **et** dans les métadonnées.
- Licence du logiciel tranchée, y compris le statut du code produit par l'IA.
- Renvois vers les autres recueils et les sites de référence présents en pied de page.

**Non-conformités.** NC-IV-002 (*levée*).

**Recommandations.** Aucune.

### IV.8 Valeur d'usage et soutenabilité

**Constat.** La soutenabilité progresse par le code : moins de secrets à gérer par l'exploitant
(plus de jeton en dur à faire circuler), une explication claire du provisionnement dans
l'installation, et une licence qui autorise la collectivité à reprendre le logiciel. La
documentation d'exploitation dit maintenant ce que la démonstration **n'est pas** — c'est
exactement ce qu'un directeur des affaires juridiques veut lire avant d'engager son service.

**Points conformes.**
- Reprise possible du logiciel dans le cadre de la licence GPL-3.0.
- Installation expliquée à un service informatique, sans dépendance à l'auteur.
- Limites de la démonstration écrites noir sur blanc.

**Non-conformités.** Aucune nouvelle.

**Recommandations.** (P-26) Outiller l'exploitation réelle.

---

## 6. Chapitre V — Synthèse transversale

### 6.1 Recoupements entre chapitres

| Sujet | Chapitres | Lecture transversale |
|---|---|---|
| Provisionnement des clés | II.2 / I.7 / III.5 / IV.8 | Une même brique sert la sécurité (plus de secret servi), la réversibilité (clé par poste, révocable), la compréhension (aide du champ) et la soutenabilité (l'exploitant sait quoi faire). **C'est le geste le plus rentable de la campagne.** |
| Journal d'audit du service | II.7 / I.6 / IV.3 | Sécurité (piste opposable), exploitation (instrument de diagnostic), droit (traçabilité). Sa faiblesse — ni export ni rétention — se voit dans les trois chapitres : P-24. |
| Mode démonstration | II.6 / I.6 / III.6 / IV.8 | Le fourre-tout du rapport : ni conservatoire, ni cloisonné, ni fiable sous charge (NC-II-012), mais bien documenté comme tel (NC-I-006 levée). Le risque est **d'usage**, pas de conception : c'est P-27. |
| Identifiant ELI | IV.2 / IV.4 / II.1 | Un identifiant qui n'est pas une adresse complique la citation (IV), l'interopérabilité (IV) et la classification (les lecteurs distinguent mal identifiant et adresse) : P-18. |
| Signature | IV.3 / II.5 / III.3 | La « porte de compétence » ferme l'usurpation **dans le geste** (II), rassure le service prescripteur (IV), et se voit dans le parcours de signature (III) — mais la valeur probante (IV.3) reste une décision d'infrastructure. |

### 6.2 Risques systémiques

1. **Le démonstrateur tient lieu de service dans les esprits.** Trois chapitres heurtent le même
   mur : un état évinçable, non sauvegardé, partagé entre visiteurs, qui redémarre sans prévenir.
   La documentation le dit désormais ; l'**interface** ne le dit pas partout (le bandeau
   « Démonstration » existe, mais rien n'indique à l'agent que ce qu'il publie peut disparaître).
2. **La qualité repose sur la vigilance, pas sur l'outillage.** Les tests existent pour les
   modules purs ; les parcours, l'accessibilité et les libellés ne sont vérifiés que par des
   campagnes d'audit humaines. Un test de non-régression transforme ces constats en garanties
   (P-21, P-28).
3. **Deux champs pour une même identité (ELI).** L'identifiant et l'adresse coexistent : c'est
   fonctionnel aujourd'hui, ambigu demain.

### 6.3 Contradictions relevées

- **`force:true`** est décrit comme « reprise de données par un administrateur », mais il est
  offert à **tout porteur d'un rôle d'écriture sur la collection** (un éditeur sur `trames`, par
  exemple). La documentation et le contrôle ne disent pas la même chose : P-17.
- **La signature est présentée comme horodatée et vérifiable** dans l'interface, avec une note
  de démonstration dans le guide : le vocabulaire de l'écran reste plus affirmatif que ce que la
  preuve établit (identité). Recommandation maintenue depuis la campagne 1 : bannir le mot
  « signé » sans qualificatif tant que l'identité n'est pas vérifiée côté serveur.
- **Le service se dit « durable »** (l'interface parle d'état durable, `hDbHealth` répond
  « démonstration (état durable) ») alors qu'il **perd tout à son redémarrage** (NC-II-012) :
  « durable » au sens de *persistant*, non au sens de *garanti*. À reformuler.

### 6.4 Arbitrages à rendre par le prescripteur

1. **Quel environnement de démonstration ?** Une instance dédiée avec base réelle, ou un
   démonstrateur explicitement éphémère, l'interface disant alors ce qu'il advient des données.
2. **Comment signer ?** Prestataire qualifié, cachet serveur, ou porte-clés : la réponse commande
   le vocabulaire et les mentions produites.
3. **Quelle politique de conservation du journal ?** Durée, format, qui peut le lire, et
   comment il s'exporte vers l'archivage.
4. **Quelle forme pour l'identifiant ELI ?** URI HTTP canonique unique, ou identifiant + adresse
   explicitement nommés.
5. **L'outillage reste-t-il dans `src/` ou rejoint-il la racine du dépôt ?** (NC-I-007)

---

## 7. Plan d'action — propositions à réaliser

Effort : F (≤ 1 j-h), M (2–10 j-h), É (> 10 j-h). Le coût est indicatif ; le porteur est
proposé.

### Horizon 0–30 jours

| Id | Proposition | NC couvertes | Bénéfice | Effort | Coût | Porteur | Dépendances |
|---|---|---|---|---|---|---|---|
| **P-17** | **Restreindre `force:true`** de la synchronisation au rôle `administrateur`, et **journaliser** chaque contournement de contrôle de révision. | NC-II-004 (résidu) | Supprime l'écrasement silencieux d'une écriture concurrente par un éditeur. | F | 1 | RSSI | — |
| **P-18** | **Nommer l'identité ELI sans ambiguïté** : `eliIdentifiant` (la forme `eli:/fr/…`) et `eliAdresse` (l'URI HTTP), dans la publication, le JSON-LD, l'Akoma Ntoso et la page ; à défaut, faire d'`eliUri` l'URI HTTP canonique. | NC-IV-003 | Interopérabilité et citabilité réelles. | F | 1–2 | DSI + DAJ | — |
| **P-19** | **Marquer distinctement une télétransmission simulée** : le certificat porte `demonstration:true` quand l'appel sortant n'a pas eu lieu, et la mention « Transmis au contrôle de légalité… » est alors qualifiée. | NC-IV-004 | Lève l'ambiguïté d'une mention opposable. | F | 1 | DAJ | — |
| **P-20** | **Verrouiller les dépendances** : produire `package-lock.json` (service), passer la CI à `npm ci`, consigner les empreintes d'images dans une note de version. | NC-I-002 | Livraisons reproductibles. | F | 1 | DSI | — |

### Horizon 30–90 jours

| Id | Proposition | NC couvertes | Bénéfice | Effort | Coût | Porteur | Dépendances |
|---|---|---|---|---|---|---|---|
| **P-21** | **Premiers tests de parcours** (bout en bout) : dépôt → signature → publication → recueil, et provisionnement → clé → révocation. | NC-I-001 | Transforme les constats d'audit en garanties. | M | 6–10 | DSI | P-20 |
| **P-22** | **Découper et dédupliquer** : extraire « partie publique de l'original » et l'empreinte en un point unique ; scinder `README.md`, `signature.js`, `app.css`. | NC-I-003, NC-I-004 | Baisse le coût de reprise, supprime le risque de divergence. | M | 8–15 | DSI | P-21 |
| **P-23** | **Renommer** `src/lib/revisions.js` → `historique-brouillons.js`. | NC-I-005 | Lève l'ambiguïté de nommage. | F | 1 | DSI | — |
| **P-24** | **Journal du service : export, rétention, inaltérabilité** ; documenter qui peut le lire et sous quel format il s'archive. | NC-II-010 | Piste d'audit opposable dans le temps. | M | 3–5 | RSSI + DAJ | — |
| **P-27** | **Trancher la démonstration** : documenter l'éphémérité du service d'aperçu **dans l'interface** aussi ; vérifier la persistance des clés au redémarrage du service auto-hébergé ; décider d'une instance de démonstration dédiée. | NC-II-012, NC-I-007 | Supprime l'usage réel d'un environnement non conservatoire. | M | 3–6 | DSI + RSSI | — |
| **P-28** | **Cohérence des libellés et non-régression de l'accessibilité** : libellé unique de la punaise selon l'état ; test reproductible des contrastes, cibles tactiles et intitulés. | NC-III-006, III.2 | Qualité tenue sans campagne manuelle. | F | 2–3 | qualiticien | P-21 |

### Horizon 90–180 jours

| Id | Proposition | NC couvertes | Bénéfice | Effort | Coût | Porteur | Dépendances |
|---|---|---|---|---|---|---|---|
| **P-25** | **Valeur probante** : brancher la chaîne eIDAS de la collectivité (prestataire, cachet serveur ou porte-clés), n'attribuer le mot « signé » qu'à une identité vérifiée côté serveur, et définir l'archivage (paquet d'archivage). | NC-IV-001 | Seul point empêchant de dire « valeur probante pleine ». | É | > 20 | DAJ + DSI | arbitrage n° 2 |
| **P-26** | **Exploitation réelle** : test de restauration, supervision, procédure d'incident, plan de reprise. | NC-I-006, NC-II-010 | Le service peut être exploité sans l'auteur. | M | 5–10 | DSI | P-20, P-24 |
| **P-30** | **Analyse statique et formateur** (linter), dans la CI. | NC-I-002 | Attrape ce que la syntaxe ne voit pas. | F | 2–3 | DSI | P-20 |

### Au-delà

| Id | Proposition | NC couvertes | Bénéfice | Effort | Coût | Porteur |
|---|---|---|---|---|---|---|
| **P-29** | **Segmentation technique** : instances distinctes démonstration / recette / production, jeux de données étanches, aucun identifiant partagé ; puis homologation (RGS/ANSSI). | NC-II-012, I-007 | Supprime la cause racine des constats d'environnement. | É | > 30 | DSI + RSSI |

---

## 8. Annexe A — Registre des non-conformités (extrait cumulé)

L'extrait ci-dessous est **identique** au fichier `src/audit/REGISTRE-NON-CONFORMITES.md`
(fiches complètes : constat, exigence, preuve, recommandation, effort, priorité, échéance,
statut, origine). Rappel des statuts : `Ouverte` · `En cours` · `Levée` · `Régression` ·
`Acceptée` · `Obsolète`.

| Id | Gravité | Chapitre | Constat (résumé) | Statut |
|---|---|---|---|---|
| NC-I-001 | Majeure | I.3 | Base de tests purs + CI livrées ; **aucun test de parcours**. | En cours |
| NC-I-002 | Majeure | I.3/I.4 | CI + lint (syntaxe **et style**) + images épinglées ; **pas de verrou de dépendances**. | En cours |
| NC-I-003 | Mineure | I.2/I.8 | Fichiers monolithiques (jusqu'à 3 146 lignes ; README ~215 Ko). | Ouverte |
| NC-I-004 | Mineure | I.1/I.2 | Règle « partie publique » et empreinte SHA-256 toujours implémentées trois fois. | Ouverte |
| NC-I-005 | Observation | I.2/I.5 | Licence tranchée (`src/LICENSE.md`) ; `revisions.js` renommé `historique-brouillons.js`. | Levée |
| NC-I-006 | Observation | I.6 | Le mode démonstration n'est pas un mode de conservation : **écrit** dans la documentation. | Levée |
| NC-I-007 | Observation | I.3 | L'outillage vit dans `src/` et doit être recopié à la racine du dépôt. | Ouverte |
| **NC-II-001** | **Bloquante** | II.8/II.6 | Plus aucun secret dans le code servi ; service neuf en lecture seule ; clés à rôle. | **Levée** |
| **NC-II-002** | **Bloquante** | II.5 | Webhook authentifié (rôle `prestataire`) ; document déposé non public. | **Levée** |
| **NC-II-003** | **Bloquante** | II.1/II.4 | Collections protégées par sensibilité ; comptes réservés à l'administration. | **Levée** |
| NC-II-004 | Majeure | II.2/II.4 | Rôles appliqués côté serveur (vérifié) ; `force:true` réservé au rôle `administrateur` et journalisé. | Levée |
| NC-II-005 | Majeure | II.1/II.9 | Actes non publiés et documents déposés non lisibles sans clé. | Levée |
| NC-II-006 | Majeure | II.2/II.5 | Porte de compétence sur les trois chemins de signature (parcours complet non rejoué). | Levée |
| NC-II-007 | Majeure | II.3 | Version en ligne assainie avant insertion. | Levée |
| NC-II-008 | Mineure | II.8 | Clé du moteur hors du référentiel, par poste, absente des exports. | Levée |
| NC-II-009 | Mineure | II.3/II.4 | CORS fermé par défaut, comptes à mot de passe par défaut, en-têtes, images épinglées. | Levée |
| NC-II-010 | Observation | II.7 | Journal du service chaîné livré ; comparaison à temps constant ; **export/rétention non définis**. | En cours |
| NC-II-011 | Observation | II.9 | Transfert au moteur documenté (art. 13/28). | Levée |
| NC-II-012 | Observation | II.6 | Le service d'aperçu redémarre et perd son état (1011) sous charge modeste. | Ouverte |
| NC-III-001 | Majeure | III.8 | Documentation réalignée (guide, SPEC, page publique). | Levée |
| NC-III-002 | Mineure | III.2 | Lien d'évitement + cible focusable (révélation au focus non vérifiable). | Levée |
| NC-III-003 | Mineure | III.2 | Cibles tactiles portées à 24 × 24 px (mesurées). | Levée |
| NC-III-004 | Mineure | III.4 | Note de pied de page alignée à gauche (mesurée). | Levée |
| NC-III-005 | Observation | III.2 | Titre de document par écran et repère de navigation (mesurés). | Levée |
| NC-III-006 | Observation | III.4 | Libellé de la punaise unique et adapté à l'état (publié / non publié). | Levée |
| NC-IV-001 | Majeure | IV.3 | Opérateur tracé, compétence vérifiée ; **certificat toujours auto-engendré**. | En cours |
| NC-IV-002 | Majeure | IV.7 | Licence de réutilisation affichée + JSON-LD ; licence logicielle tranchée. | Levée |
| NC-IV-003 | Mineure | IV.2 | `FRBRuri` HTTP + `eli:uri` ; `eliUri` reste la forme `eli:/…`. | En cours |
| NC-IV-004 | Mineure | IV.1 | Télétransmission toujours simulée, mais **mention qualifiée** (« démonstration », badge « simulation »). | En cours |
| NC-IV-005 | Observation | IV.4 | Mention « ne fait pas foi » reliée à l'original (vérifiée). | Levée |

**Bilan : 30 fiches — bloquantes 3 (3 levées), majeures 9 (6 levées, 3 en cours), mineures 9
(5 levées, 2 en cours, 2 ouvertes), observations 9 (6 levées, 1 en cours, 2 ouvertes).**

> Mise à jour (2026-09-21c) : les statuts ci-dessus tiennent compte des remédiations menées après
> la campagne — voir § 11.

---

## 9. Annexe B — Grille de cotation

| Cote | Définition | Effet attendu |
|---|---|---|
| **Bloquante** | Empêche la mise en service, la sécurité juridique ou la sécurité tout court. | Correction avant toute exploitation réelle. |
| **Majeure** | Défaut de conformité ou de sécurité avéré, à impact réel, mais contournable. | Correction planifiée et suivie. |
| **Mineure** | Écart réel mais d'impact limité, gênant la qualité ou l'usage. | Correction dans un lot d'amélioration. |
| **Observation** | Point de vigilance, risque futur, ou bonne pratique manquante. | À instruire, sans correction obligatoire. |
| **Point conforme** | Satisfait une exigence. | À préserver ; à documenter. |

Une non-conformité est cotée au niveau du **chapitre qui l'instruit en premier** ; les
recoupements entre chapitres sont signalés, non dupliqués (cadre §6.1).

---

## 10. Annexe C — Journal d'audit

### 10.1 Chronologie et temps passé

| Phase | Ce qui a été fait | Temps |
|---|---|---|
| Cadrage | Reprise du cadre, du registre et du rapport de campagne 1 ; lecture de l'état des lieux | 10 min |
| Chapitre I | Revue des fichiers nouveaux ; inventaire d'architecture ; exécution d'un contrôle de syntaxe sur **120 fichiers** ; relevé des dépendances et des empreintes d'images ; lecture de la CI et de la documentation d'industrialisation | 25 min |
| Chapitre II | **Parcours d'interface** : provisionnement du service (bouton), lecture de la clé, liste des clés, génération d'une clé de poste, révocation (refus de la dernière clé d'administration, puis révocation effective), lecture du journal d'audit du service ; puis **confirmation à l'API** : état d'autorisation, sensibilité des collections, rôles (clé `lecteur` vs `administrateur`), webhook et dépôt sans clé ; tentative de rejeu du scénario d'usurpation (bloquée par l'exigence de révision) ; reproduction de NC-II-012 | 35 min |
| Chapitre III | **Parcours d'interface du recueil** : recherche (carrousel et thèmes effacés puis restitués), ouverture d'un acte publié (aucun `script`, aucun attribut `on…`, aucun `iframe` dans le contenu rendu), mise à la une d'un acte depuis la liste (toast + effet au service), lecture du pied de page (mentions légales, accessibilité, licence) ; **mesures** : contraste WCAG de six éléments, cibles tactiles, débordement à 390 px, ordre des titres, titres de document, alignement ; **captures** d'écran (atelier, panneau « Base de données », recueil avec « À la une », mobile) ; lecture de la documentation technique dans l'application | 30 min |
| Chapitre IV | Relevé de la licence affichée et du JSON-LD (`dcterms:license`, `eli:uri`) ; vérification à l'exécution de la mention « ne fait pas foi » d'une version consolidée et de son lien vers l'original ; revue du cycle de vie, des exports et du circuit de signature | 15 min |
| Rédaction | Rapport et mise à jour du registre | 20 min |
| **Total** | | **2 h 10** |

### 10.2 Vérifications effectuées (liste)

**Par l'interface (gestes réels)**
1. Provisionnement du service depuis *Administration › Base de données* (modale de clé, toast).
2. Liste des clés, génération d'une clé de poste, révocation (refus puis succès).
3. Lecture du journal d'audit du service (scellement et entrées).
4. Changement de compte par l'écran de connexion (entrée en tant qu'administrateur).
5. Sélection d'un acte dans « Signature & publication » (onglet « Circuit de signature »).
6. Mise à la une d'un acte publié depuis la liste des actes (toast + effet constaté à l'API).
7. Recherche au recueil public (avant / pendant / après), ouverture d'un acte publié.
8. Lecture des mentions de pied de page et de la licence affichée.
9. Lecture de la documentation technique (nouveaux documents).
10. Lecture des réglages de publication (licence, mentions, renvois).

**Mesures instrumentées**
11. Contraste WCAG calculé sur 6 éléments du recueil (5,70:1 à 15,16:1).
12. Cibles tactiles : points de carrousel, croix de recherche (24 × 24 px).
13. Débordement horizontal à 390 × 844 px (nul) ; balayage des éléments hors cadre (aucun).
14. Titres de document relevés sur 4 écrans ; repères `nav`/`main` comptés.
15. Absence de `script`, `on…`, `iframe` dans le contenu rendu d'un acte publié.

**Contrôles techniques**
16. Contrôle de syntaxe de **120 fichiers** (analyseur esbuild-wasm ; Node absent de l'atelier) — aucune faute.
17. Rejeu des assertions des tests purs dans la page (expressions, assainissement, numérotation, version).
18. Vérification du JSON-LD d'une publication (licence, adresse ELI, identifiant).
19. Vérification de la mention de version consolidée et du lien vers l'original.
20. Recherche d'absence de secret dans le code servi ; relevé des empreintes d'images Docker.
21. Test des rôles à l'API : clé `lecteur` (200 / 403 `role_insuffisant` selon la route), clé
    `administrateur`, service non provisionné (403 `service_non_provisionne`).

### 10.3 Ce qui n'a pas pu être vérifié, et pourquoi

| Point | Pourquoi |
|---|---|
| Scénario complet d'usurpation de signature | Le jeu de démonstration ne laisse **aucun acte en attente de signature** : chaque acte « prêt » exige d'abord la validation d'un réviseur compétent, et le passage en signature exige un dépôt au service. La porte de compétence a été vérifiée par lecture de code (trois points d'appel) et par les messages de refus, **pas par le parcours** |
| Révélation visuelle du lien d'évitement | Le document de l'aperçu n'obtient **jamais le focus clavier** (`document.hasFocus()` = `false`) : la règle `:focus` ne s'applique pas. Nœud, attribut, cible et CSS vérifiés ; effet visuel non observé |
| Fermeture de la bulle d'assistance (cible tactile) | La bulle n'était pas affichée au moment des mesures ; la règle de taille (24 px) est vérifiée dans la feuille de style, pas sur l'élément rendu |
| Fidélité du texte publié au document signé | Le recueil public a été **vidé** par le redémarrage du service d'aperçu (NC-II-012) avant la comparaison fine ; la chaîne d'intégrité (empreinte) reste vérifiée par le service |
| Service auto-hébergé (Docker / MySQL / SMTP / OIDC) | Non exécutable dans l'atelier : revue de code seulement (`src/server/`) |
| Sauvegarde/restauration réelles | Aucune base de production disponible |
| Impression et export Word/PDF | Non rejoués cette campagne (inchangés depuis la campagne 1, où ils avaient été vus) |
| Tests `npm test` / `npm run lint` par Node | Node n'est pas disponible dans l'atelier : la syntaxe a été contrôlée par un analyseur équivalent, et les assertions rejouées dans la page |

### 10.4 Écarts de méthode assumés

- Les **captures d'écran** ont été produites par un rendu DOM (html2canvas) et non par une
  capture native ; les **couleurs** ont donc été **mesurées** dans le DOM plutôt que lues sur
  l'image, et les défauts de contraste rapportés par une première lecture d'image **n'ont pas été
  retenus** après mesure (5,70:1 à 15,16:1 : conformes). C'est la règle « preuve ou silence » :
  une impression d'écran ne vaut pas une mesure.
- L'auditeur a **provisionné le service de démonstration** et **publié deux actes** pour exercer
  les parcours demandés ; le redémarrage ultérieur du service (NC-II-012) a effacé ces dépôts.
  **Aucune donnée réelle** n'a été créée ; le registre et le rapport ne recopient ni clé, ni
  jeton, ni donnée personnelle.

---

## 11. Suivi des remédiations (mise à jour 2026-09-21c)

Ce rapport reste un **instantané** de la campagne. Le tableau ci-dessous enregistre ce qui a été
**mis en œuvre depuis**, reçoit la preuve correspondante (exercée dans l'aperçu ou vérifiée dans
le code), et donne le nouvel état de chaque recommandation. Le registre
(`REGISTRE-NON-CONFORMITES.md`) porte la même mise à jour, fiche par fiche.

| Recommandation | État | Ce qui a été fait (preuve) |
|---|---|---|
| **P-17** — `force:true` réservé aux administrateurs | **Faite** | Le contournement du contrôle de révision reçoit **403 `force_reserve_admin`** hors rôle `administrateur`, et chaque appel est **journalisé** (`sync_force`) — dans le service de démonstration (`index.html`, `hDbSync`) comme dans le service auto-hébergé (`src/server/mysql/server.mjs`, `sync(…, estAdmin)`). Descriptions OpenAPI alignées des deux côtés. |
| **P-18** — Nommer l'identité ELI sans ambiguïté | **Faite (partielle)** | `src/lib/eli.js` expose désormais `eliIdentifiant` (la forme `eli:/fr/…`) et `eliAdresse({ config, eliUri })` (l'URI HTTP déréférençable) ; la page d'un acte publié (`views/acte-publie.js`) les présente sous deux libellés distincts, « **Identifiant ELI** » et « **Adresse ELI (HTTP)** ». Reste à **unifier** les deux formes en une seule dans la publication, le JSON-LD et l'Akoma Ntoso (voir P-14). |
| **P-19** — Marquer une télétransmission simulée | **Faite (partielle)** | `certificatTransmission({ demonstration })` (`src/lib/legalite.js`) porte `demonstration: true` : sa **nature** devient « Simulation d'accusé de réception de télétransmission », son **émetteur** « Simulation locale (aucun appel à l'API @ctes) », et la **mention** « Transmis au contrôle de légalité le … (mention de démonstration — transmission simulée, sans appel sortant) » (`mentionDeTransmissionSimulee`). Le bloc de recueil affiche un badge « **simulation** » (`src/lib/eli.js`). L'écran de transmission et le service (`index.html` `hTransmettre`, `src/server/mysql/actes.mjs`) propagent le drapeau. Reste l'exigence de **preuve de l'appel réel**. |
| **P-21** — Premiers tests (modules purs) | **Faite (partielle)** | `src/tests/purs.test.mjs` couvre en outre les **assemblées** (résolution de l'assemblée d'un acte, qualité du signataire en genre), la **formule d'autorité d'un acte d'assemblée** à la compilation, `eliAdresse`, et la **mention de transmission simulée** ; assertions rejouées dans la page. Les **tests de parcours** (bout en bout) restent à écrire. |
| **P-23** — Renommer `revisions.js` | **Faite** | `src/lib/revisions.js` → **`src/lib/historique-brouillons.js`**, imports et documentation (`README.md`, `TODO.md`) suivis. L'ambiguïté avec `src/lib/revision.js` est levée (NC-I-005). |
| **P-24** — Journal : export et rétention | **Faite (partielle)** | Le journal du service (Administration › Base de données) offre un bouton « **Exporter (JSON)** » et annonce sa rétention (« 2 000 dernières entrées »). Restent l'inaltérabilité hors service et la rétention légale outillée. |
| **P-28** — Cohérence des libellés de la punaise | **Faite** | `libelleEpinglage` (`src/ui/views/actes.js`) : « Épingler à la une du recueil public » / « **Retirer de la une du recueil public** » selon l'état, la précision « l'acte y sera mis dès sa publication » n'étant donnée que pour un acte **non publié** ; les deux emplacements s'accordent (NC-III-006). Le test d'accessibilité reproductible reste à écrire. |
| **P-30** — Analyse statique (linter) | **Faite** | `src/scripts/verifier-style.mjs`, sans dépendance : **refuse** `debugger` hors `scripts/`, **signale** `var` et `console.log` dans le code client (`--strict` pour en faire des erreurs) ; branché dans `npm run lint`, à côté de `verifier-syntaxe.mjs`. |
| **P-20** — Verrou de dépendances | **Bloquée dans l'atelier** | `npm`/`Node` ne sont pas disponibles ici : `package-lock.json` ne peut pas être produit. **À faire** au premier poste disposant de Node (`npm install` puis commit du verrou, passage de la CI à `npm ci`). |
| **P-22, P-25, P-26, P-27, P-29** | **Non commencées** | Inscrites au backlog (découpage/déduplication, remédiation aidée, exploitation réelle, rangement, segmentation technique). |

**Vérifications de cette mise à jour.** Contrôle de syntaxe sur les **122 fichiers JavaScript de
`src/`** et les scripts de `index.html` (analyseur esbuild-wasm ; Node absent de l'atelier) :
aucune faute. Exercice dans l'aperçu : compilation d'une délibération
(autorité rendue par `{{autorite}}`), conformité d'un acte d'assemblée, et rejeu des assertions
pures. Le détail des preuves est, pour chaque fiche, dans `REGISTRE-NON-CONFORMITES.md`.
