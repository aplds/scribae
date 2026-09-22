---
titre: Anticipation de bugs — persistance, session et anti-CSRF (audit ciblé)
date: 2026-09-22
version_outil: 1.3.2 (correctifs 1.3.2n)
perimetre: écriture refusée → file d'attente → état de la base ; session, cookies, anti-CSRF, CORS
methode: lecture ligne à ligne du code livré, épreuves automatisées, vérification dans l'aperçu en direct
nature: chasse aux bugs ciblée (corrige), et NON l'audit en quatre chapitres de src/audit/
---

# Anticipation de bugs — persistance, session et anti-CSRF

**Objet.** Cet audit ne suit pas le contrat de `src/audit/PROMPT-AUDIT-SCRIBAE.md` : il porte
sur **une seule chaîne**, celle qui a produit les pannes rapportées coup sur coup (« 77 écritures en
attente », « csrf_invalide », une pastille rouge qui se contredit). Il **corrige** ce qu'il trouve
— c'est l'inverse de l'audit de conformité, qui constate et propose sans toucher au code — si bien
que le registre `src/audit/REGISTRE-NON-CONFORMITES.md` n'a pas été touché (voir §5).

**La chaîne auditée**, de bout en bout :

```
geste de l'agent
  → db.write()                       src/lib/db/index.js
    → pilote (service HTTP)          src/lib/db/service.js
      → session + cookie + anti-CSRF src/lib/motdepasse.js, src/ui/state.js
      → service de la collectivité   src/server/mysql/server.mjs + comptes.mjs
  → en cas d'échec : file d'attente  src/lib/db/index.js (queueWrite, flushPending)
  → état montré à l'exploitant       src/ui/views/referentiel.js (+ src/ui/app.js)
```

**Méthode.** Lecture intégrale de `src/lib/db/*.js`, `src/lib/motdepasse.js`, `src/lib/auth.js`,
`src/lib/collab.js`, `src/server/mysql/{server,comptes,entetes}.mjs` ; relecture des chemins
d'écriture du dépôt (`src/lib/store.js`, `src/ui/state.js`, `src/ui/views/referentiel.js`) ;
épreuves automatisées (98 tests, dont 3 ajoutés) ; recherche systématique des autres lecteurs de
cookie, des autres porteurs de jeton et des autres appels à `db.write`.

---

## 1. Ce qui a été corrigé (menu `1.3.2n`)

Chaque constat porte un identifiant stable (`C-n`), une gravité, une preuve, et le correctif
appliqué.

### C-1 — Une écriture refusée bloquait toute la file derrière elle (majeure)

**Constat.** `flushPending` parcourait les écritures en attente **dans l'ordre** et s'arrêtait à la
première qui échouait (`break`, `src/lib/db/index.js:337`). Or une entrée peut être refusée **par
nature** : une écriture de `users` ou de `config` — collections réservées à l'administrateur
(`COLLECTIONS_ADMIN`, `src/server/mysql/server.mjs:135`) — mise de côté alors qu'une session
d'administrateur tenait le poste, rejouée après qu'un compte ordinaire a pris sa place : le service
répond `403 droit_requis`, pour toujours.

**Effet.** Les collections suivantes — les actes que l'agent venait d'écrire, son journal, sa
présence — ne partaient **jamais** plus. « Renvoyer maintenant » échouait à l'identique (même
entrée en tête), l'état restait rouge, et il ne restait que « Abandonner ces écritures », qui perd
le travail de tout le monde. C'est un scénario de poste partagé, pas un cas d'école.

**Correctif.** Chaque entrée est essayée : celles qui échouent restent en attente (rien n'est
perdu), celles qui peuvent passer passent, et le motif rapporte le premier refus **et** ce qui a été
transmis malgré tout (`src/lib/db/index.js:337`). Deux épreuves nouvelles couvrent le cas (file
`users` + `presence`, la seconde passe pendant que la première est refusée).

### C-2 — Les deux cookies de la connexion tenaient sur une seule ligne (majeure)

**Constat.** `entetesSurs` (`src/server/mysql/entetes.mjs:44`) ramenait toute valeur d'en-tête à une
**chaîne** (`String(valeur)`). Les deux cookies posés à la connexion — session `HttpOnly` et jeton
anti-CSRF lisible — forment un **tableau** ; les joindre donne
`scribae_session=…; Path=/…,scribae_csrf=…; Path=/…` : une valeur invalide (`Set-Cookie` est le seul
en-tête qu'on ne peut pas replier), que les navigateurs ne lisent que par tolérance, chacun avec son
heuristique de découpage.

**Effet.** Le couple session + anti-CSRF est exactement ce qu'il ne faut pas abîmer : un découpage
malheureux (ou un mandataire strict) perd le jeton, et **toutes** les écritures sont refusées
`csrf_invalide` alors que la connexion vient de réussir.

**Correctif.** Un en-tête à plusieurs valeurs reste un **tableau** jusqu'à `writeHead` (Node écrit
une ligne par valeur) ; une valeur douteuse est écartée seule, les autres passent. Épreuve ajoutée.

### C-3 — Une application servie par une autre origine ne pouvait pas écrire (majeure)

**Constat.** `corsHeaders` (`src/server/mysql/server.mjs:322`) autorisait bien l'origine déclarée,
mais ne posait **pas** `access-control-allow-credentials`, et `x-csrf-token` ne figurait pas dans
`access-control-allow-headers` (ni `DELETE` dans les méthodes).

**Effet.** Toutes les écritures partent en `credentials: "include"` quand la porte est une session :
sans `allow-credentials`, le navigateur **refuse la réponse**, et le refus ressemble à une panne
réseau. L'écriture était rangée en attente (« Serveur de données injoignable »), la pastille
passait à l'orange, et l'exploitant cherchait une coupure qui n'existait pas. Le défaut de
`x-csrf-token` faisait échouer le contrôle préalable (OPTIONS) : la requête n'atteignait jamais le
service.

**Correctif.** `access-control-allow-credentials: true` quand une origine **précise** est autorisée
(jamais avec `*`, que la spécification interdit de combiner avec les cookies), `x-csrf-token`
déclaré, `DELETE` autorisé. La documentation qui conseillait `CORS_ORIGINS=*` « quand l'API est
derrière la même façade » est corrigée : dans ce cas il n'y a **rien à faire**, le défaut étant de
n'autoriser aucune origine.

### C-4 — La connexion ne rendait pas son jeton anti-CSRF (majeure)

**Constat.** `GET /v1/auth/session` rend le jeton anti-CSRF dans le corps depuis la note 1.3.2m
(`src/server/mysql/comptes.mjs:595`), mais **`/v1/auth/connexion` et `/v1/auth/demo` ne le
faisaient pas** (`comptes.mjs:556`), alors que le commentaire de `src/lib/motdepasse.js` l'annonçait.

**Effet.** Sur un service, la page qui ne peut pas lire son cookie (autre hôte) gardait un jeton
vide jusqu'à sa première relecture de session — et les écritures de **démarrage** (données semées,
première présence, journal) partaient sans en-tête et étaient refusées. C'est la même panne que la
note 1.3.2m, sur le chemin qui la précède.

**Correctif.** La connexion (et la connexion de démonstration) rendent le jeton dans leur réponse,
comme la session ; le jeton gardé en mémoire est oublié à la déconnexion (`oubliJeton`,
`src/lib/motdepasse.js:48`), pour qu'une session fermée ne survive pas dans une écriture. Épreuve
ajoutée.

### C-5 — Un refus de rôle se lisait sans phrase (mineure)

**Constat.** `expliquerRefus` (`src/lib/db/index.js:224`) ne connaissait que `csrf_invalide`.

**Effet.** Un `droit_requis` (ou `force_reserve_admin`) s'affichait « Écriture refusée par le
service », suivi du seul conseil « Rechargez la page ; si cela persiste, reconnectez-vous » —
trompeur, puisque le geste juste est de se reconnecter **en administrateur**, ou d'abandonner cette
écriture-là. Un `session_absente` renvoyait la même phrase, sans nommer la cause (cookie qui ne
traverse pas). L'écran *Base de données* ne disait pas non plus **quelle** collection avait été
refusée.

**Correctif.** Chaque refus connu a sa phrase et son geste (`droit_requis`, `force_reserve_admin`,
`session_absente`, `jeton_invalide`/`jeton_absent`/`jeton_non_configure`, `csrf_invalide`), et le
motif du dernier renvoi **nomme la collection** (`src/ui/views/referentiel.js:795`).

### C-6 — Un pilote bâti pendant un redémarrage du service ne se réparait jamais (majeure)

**Constat.** Le pilote est construit une fois, au démarrage, sur ce que **la page** annonce ;
`GET /v1/auth/config` — qui fait autorité — est demandé juste après, une seule fois
(`src/ui/state.js:184`). Si cet appel échoue (service en train de redémarrer, réseau qui hésite),
le pilote garde `credentials: "same-origin"` et **aucun** anti-CSRF, et rien ne redemande jamais le
mode.

**Effet.** Chaque écriture était refusée `csrf_invalide` (ou `session_absente`) **pour toujours**,
et « Renvoyer maintenant » échouait à l'identique : seule une relecture de la page réparait. Le
premier geste de l'agent après un démarrage malchanceux ne s'enregistrait pas, sans que rien ne le
dise.

**Correctif.** `reparerPilote` (`src/lib/db/index.js:541`) est appelé au premier refus rejouable
(`csrf_invalide`, `session_absente`) — par une écriture comme par le renvoi d'une entrée en attente
— et par « Renvoyer maintenant » : il redemande son mode au service, relit la session (dont le
jeton anti-CSRF), refait le pilote si le régime a changé, puis l'écriture est rejouée **une** fois.
Une seule réparation par renvoi, espacée de vingt secondes en automatique, pour ne pas marteler un
service en panne ; et le renvoi ne peut plus se demander à lui-même la réparation en cours (garde
`reparationEnCours`, `health()` comprise). Épreuve ajoutée.

### C-7 — `refresh` documentaire : le défaut de `CORS_ORIGINS` et l'ambiguïté de `AUTH_MODE` (mineure)

`src/docs/ADMINISTRATION.md` annonçait `CORS_ORIGINS` = `*` et `AUTH_MODE` = `demo` : deux valeurs
qui ne correspondent ni au code (`""`, `src/server/mysql/server.mjs:92`) ni au `.env` livré
(`password`). Corrigé dans `ADMINISTRATION.md`, `src/server/README.md` et
`src/server/mysql/README.md`, avec la raison (les cookies ne traversent pas `*`, et un conteneur
lancé hors du compose retombe sur `demo`).

---

## 2. Ce qui reste ouvert (à arbitrer)

Ces points **n'ont pas** été corrigés : ils demandent un choix (produit ou exploitation), ou
touchent des chemins dont la correction pourrait casser autre chose. Ils sont classés par ce qu'ils
coûteraient.

### O-1 — `GET /v1/db/health` est publique et décrit l'infrastructure (gravité moyenne)

`src/server/mysql/server.mjs:748` sert la route **sans session ni jeton**, dans les deux modes, et
sa réponse contient `base.hote`, `base.port`, `base.schema` et la version du moteur. Un anonyme
énumère donc l'hôte, le port et la version de la base.

*Proposition.* Exiger une session en mode « mot de passe ». **Attention** : le client interroge
cette route au démarrage (`src/ui/app.js:471`, et `rafraichirPilote` → `health()`), y compris
**avant** qu'une session soit ouverte — il faudrait donc que le premier `401` soit traité comme
« session requise » et non comme une erreur, sinon la pastille passerait au rouge sur l'écran de
connexion. Effort : faible mais à faire avec l'épreuve correspondante.

### O-2 — Le mode « Service de démonstration » n'a pas de sens en auto-hébergement (observation)

Dans un déploiement auto-hébergé, il n'y a pas de socket (`src/lib/hosts.js`,
`hostSocketFactory`) : choisir « Service de démonstration — partagé » donne un pilote « socket »
dont les appels passent en réalité par HTTP (`src/lib/remote.js`, `useHttp()`). Deux conséquences
silencieuses : la limite de taille appliquée est celle du socket (850 Kio au lieu de 8 Mio,
`src/lib/db/contract.js`), et l'essai d'écriture du bouton *Tester la connexion* n'est **pas**
exécuté (`src/lib/db/service.js:142`, le transport socket est exclu). L'aide affichée, elle,
promet « 50 Mio durables » — vrai sur Perchance, faux ici.

*Proposition.* Marquer l'entrée « service » comme indisponible quand `__SCRIBA_SELF_HOSTED__` est
posé, et adapter son aide — comme le fait déjà `src/lib/db/index.js` pour l'édition statique
(`__SCRIBA_STATIC__`).

### O-3 — Une entrée définitivement refusée est réessayée toutes les trente secondes (observation)

Depuis C-1, une entrée refusée ne bloque plus les autres, mais elle reste en file et le renvoi
automatique la représente indéfiniment (une requête refusée toutes les 30 s, par poste). « Renvoyer
maintenant » existe, mais rien ne suspend la reprise.

*Proposition.* Mémoriser le dernier refus **définitif** (`401`/`403`) par collection, et ne plus
réessayer cette collection qu'au prochain geste explicite ou après reconnexion — l'écran le
dirait (« refusée, en attente d'un geste »).

### O-4 — Un compte ordinaire tente des écritures d'administration au démarrage (mineure)

`bootstrap()` écrit `users` — et parfois `config` — quand le référentiel a besoin d'une migration
(`src/lib/store.js:487` et suivantes, appelée pourtant à chaque connexion). Sur un poste dont le
compte n'est pas administrateur, le service répond `403 droit_requis` : le refus est **légitime**,
mais il allume la pastille d'erreur et, depuis C-5, affiche une phrase d'action — pour une
opération que l'application n'avait pas à demander.

*Proposition.* Ignorer les migrations qui touchent `users`/`config` quand la session n'est pas
administrateur (le référentiel restera ce qu'il est, et le prochain administrateur le mettra à
jour).

### O-5 — Un montage inter-**site** ne peut pas marcher, et rien ne le dit avant l'essai (observation)

Les deux cookies sont posés `SameSite=Lax` : si le service est sur un autre **site** (autre domaine
enregistrable) que l'application, le navigateur ne joint pas le cookie de session, et le service
répond `401 session_absente`. La phrase de C-5 l'explique **après** l'échec ; l'écran de réglages,
lui, n'avertit pas.

*Proposition.* Dans *Administration › Base de données*, comparer le domaine de l'adresse saisie à
celui de la page et avertir avant l'essai (ou préciser que le service doit être joint sur le même
domaine, sous `/v1/`).

### O-6 — La présence et le journal amplifient les états rouges (observation)

Chaque battement de cœur (25 s, `src/lib/collab.js:34`) refait une lecture — qui déclenche le
renvoi de la file — puis une écriture. En cas de refus, l'écran reçoit donc un message d'erreur
toutes les 25 s, et la file peut grossir d'une entrée de plus (compaction faite).

*Proposition.* Espacer le battement en état d'erreur (repli à 2 min), et ne pas remonter à l'écran
un refus de présence ou de journal (collections déjà `SILENT_COLLECTIONS`,
`src/lib/db/contract.js:40`, pour les conflits).

---

## 3. Ce qui a été vérifié conforme

- **Le double envoi anti-CSRF garde son sens.** Le jeton reste dans un cookie non `HttpOnly`, la
  comparaison est à temps constant (`csrfValide`, `src/server/mysql/comptes.mjs:508`), et l'en-tête
  `x-csrf-token` n'est autorisé en CORS **que** pour les origines déclarées : un autre site ne peut
  ni lire le jeton (pas d'en-tête CORS autorisant la réponse) ni l'envoyer (contrôle préalable
  refusé).
- **La session ne laisse pas de secret en clair** : seul le SHA-256 du jeton est en base, les mots
  de passe sont scellés par `scrypt`, un identifiant inconnu répond exactement comme un mot de passe
  faux. `GET /v1/auth/session` repose un cookie anti-CSRF absent, et la déconnexion efface les deux
  cookies côté service.
- **L'essai d'écriture ne dépose rien.** La synchronisation vide (`essaiEcriture`,
  `src/lib/db/service.js:142`) traverse la garde complète, mais un corps sans `upserts` ni `deletes`
  n'écrit aucun enregistrement et ne fait pas avancer de révision : seul l'enregistrement de la
  collection dans `sb_collection` (un `INSERT IGNORE`) est créé. C'est le prix, assumé, d'un test
  qui dit vraiment si la base accepte d'écrire.
- **La file tient ses règles** : une écriture par collection (compaction à l'écriture **et** à la
  relecture, `compacterFile`), un lot forcé qui n'est pas effacé par une écriture ordinaire, un
  motif conservé dans `kv.actesPending`.
- **Les refus du serveur portent tous `code` et phrase** : les trois fabriques `err()` gardent leurs
  signatures documentées (celle des données `(message, options)`, celle des comptes
  `(code, message)`), et les deux refus de session/anti-CSRF sont bien formés (corrigé en 1.3.2m).

---

## 4. Ce qui n'a pas pu être vérifié

- **La base réelle.** Aucun MySQL/MariaDB, aucun Docker dans l'environnement de travail : le
  service n'a été éprouvé que par ses tests purs (`node --test`, 98 épreuves) et par lecture. Le
  comportement des dates UTC (note `1.3.2`) et des transactions reste à confirmer sur une instance
  réelle.
- **Le contrôle préalable CORS par un vrai navigateur.** Les en-têtes CORS sont validés par lecture
  et par les tests d'en-têtes, **pas** par un appel `OPTIONS` émis d'une autre origine : c'est le
  navigateur qui applique cette règle, et aucun navigateur n'a été mis dans cette configuration.
- **Le déploiement `web` (nginx).** La façon dont la façade sert `/v1/` (même origine) et dont
  `nginx.conf` relaie le contrôle préalable n'a pas été éprouvée ici.

---

## 5. Note pour l'audit de conformité

Ce document **n'est pas** un rapport d'audit au sens de `src/audit/PROMPT-AUDIT-SCRIBAE.md` : il
corrige, là où l'audit constate. Il ne remplace donc ni le rapport de la série
(`src/audit/rapports/`), ni la mise à jour du registre des non-conformités, et **aucune** entrée
`NC-<chapitre>-<numéro>` n'a été créée ou modifiée. Si l'un de ces constats doit être suivi par la
démarche d'audit, il appartient à l'auditeur de le reformuler selon la grille de cotation
(§ 6.1 du prompt) et de lui donner un identifiant stable.
