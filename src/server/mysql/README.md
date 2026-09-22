# Service de la collectivité — Node + MySQL / MariaDB

Ce dossier contient le **service** de Scribae : le serveur HTTP qui branche
l'application (qui vit dans le navigateur) sur la base **MySQL / MariaDB** de la
collectivité, et qui porte le **dépôt des actes, la signature et la publication**.

Il expose **deux familles de ressources** :

| Famille | Ressources | Persistance |
|---|---|---|
| **Données** | `GET /v1/db/health`, `GET /v1/db/collections/{collection}`, `POST /v1/db/collections/{collection}/sync` | `sb_record`, `sb_collection`, `sb_journal` |
| **Actes** | `/v1/actes…`, `/v1/signatures…`, `/v1/webhooks/signature`, `/v1/actes/{id}/transmission`, `/v1/actes/{id}/dossier-signature`, `/v1/publications…`, `/v1/eli/…`, `POST /v1/admin/purge`, `GET /v1/health`, `GET /v1/` (OpenAPI) | `sb_etat` |
| **Courriel** | `GET /v1/courriel`, `POST /v1/courriel/envoi`, `POST /v1/courriel/test` | `sb_courriel` (+ `SMTP_*` du `.env`) |
| **Réglages** | `GET /v1/config` (réglages de référentiel posés par le `.env`, voir § 9) | — |

Le contrat de la famille « données » est **le même** que celui du service de
démonstration : l'application ne voit aucune différence et
n'a besoin que d'une **adresse** et d'un **jeton**. La famille « actes » est le portage
du service de signature et de publication (`actes.mjs`, sans dépendance à Node).

```
navigateur (Scribae)              service                         base
  src/lib/db/service.js  ──── HTTP ────▶  server.mjs (Node)  ── SQL ──▶  MySQL / MariaDB
  src/lib/remote.js                      :8080              mysql2       sb_record, sb_etat…
```

> **Pourquoi un serveur intermédiaire ?** Un navigateur ne peut pas parler le protocole de
> MySQL (TCP binaire) et ne doit surtout pas détenir les identifiants de la base. Le service
> est donc la seule pièce qui connaît la base ; il n'accepte que des appels HTTP authentifiés
> par jeton. Il n'ouvre **aucune connexion sortante**.

> **Déploiement complet.** Ce fichier décrit le service et sa base. Pour installer
> l'ensemble (nginx + service + MariaDB) avec Docker, y compris le réseau interne et TLS,
> voir **`../README.md`**. L'exploitation courante est décrite dans
> **`../../docs/ADMINISTRATION.md`**.

## 1. Préparer la base

Avec Docker, MariaDB exécute `schema.sql` à sa création (voir `../docker-compose.yml`).
À la main :

```sql
CREATE DATABASE scriba CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'scriba'@'%' IDENTIFIED BY 'changez-moi';
GRANT SELECT, INSERT, UPDATE, DELETE ON scriba.* TO 'scriba'@'%';
FLUSH PRIVILEGES;
```

Le service peut aussi créer les tables lui-même (`--migrate`). Les objets créés :

| Objet | Rôle |
|---|---|
| `sb_collection` | une ligne par collection, avec son compteur de révision |
| `sb_record` | **le cœur** : un enregistrement par trame / acte / compte / objet du référentiel |
| `sb_journal` | registre des modifications : qui a écrit quoi, quand |
| `sb_etat` | l'état du service de signature et de publication (document JSON unique) |
| `sb_courriel` | le journal des envois de courriel : quand, quel événement, quels destinataires, quel objet, envoyé ou non et pourquoi |
| `v_acte`, `v_trame` | vues de lecture en clair (objet, numéro, statut, service…) |
| `v_collection` | synthèse : nombre d'enregistrements et révision par collection |

## 2. Installer et démarrer le service

```bash
cd src/server/mysql
cp env.example .env        # puis renseignez la base et les jetons
npm install
node server.mjs --migrate  # crée ou met à jour le schéma
node server.mjs            # (ou: npm start)
npm test                   # tests du domaine signature/publication (aucune base requise)
```

Avec Docker (la pile complète db + api + web) :

```bash
cd src/server
cp env.example .env        # mots de passe, jetons
docker compose up -d --build
```

## 3. Le jeton d'API

Le service ne reconnaît que des **empreintes SHA-256**. Pour créer un jeton :

```bash
JETON=$(openssl rand -hex 32)      # un long secret aléatoire
printf '%s' "$JETON" | sha256sum   # l'empreinte à mettre dans API_TOKENS
echo "$JETON"                      # le jeton en clair : à saisir dans l'application
```

Dans `API_TOKENS` (séparés par des virgules, format `libellé:empreinte`) :

```
API_TOKENS=application:0f3a…,import:91b2…
```

Le libellé n'est qu'une commodité : il apparaît dans `sb_journal.actor`, ce qui permet de
savoir **quel client** a écrit. Le jeton en clair n'est jamais transmis au service autrement
que dans l'en-tête `Authorization: Bearer …`, et n'est jamais conservé côté serveur.

Le **même** jeton sert pour les deux familles de ressources (données et actes) : c'est la
même autorisation d'écriture.

> **Mode « comptes locaux » (`AUTH_MODE=password`).** Les jetons d'API ne sont alors **plus
> acceptés** : la porte est la session de l'agent (identifiant + mot de passe, vérifiés par le
> service), et une écriture sans session est refusée (401). `API_TOKENS` peut rester vide. Le
> compte d'administration se configure dans le `.env` (`ADMIN_LOGIN`, `ADMIN_PASSWORD`) ; il est
> créé au premier démarrage, puis gère les autres comptes depuis *Comptes et rôles*. Les tables
> `sb_motdepasse` et `sb_session` (voir `schema.sql`) portent les dérivés `scrypt` et les
> sessions, et font partie de la sauvegarde. Détail : `../../docs/ADMINISTRATION.md` § 4.3 bis.

## 4. Brancher l'application

Dans l'application : **Administration › Base de données** →

- mode **Serveur externe — MySQL / MariaDB** ;
- **Adresse** : `https://donnees.exemple.fr`, ou **vide** si l'application est servie par le
  même serveur que l'API (cas du déploiement auto-hébergé fourni) ;
- **Jeton** : le jeton en clair de l'étape 3 ;
- *Tester la connexion*, puis *Appliquer et recharger* ;
- enfin *Envoyer les données à la base* pour installer le référentiel de départ.

Le réglage est **propre au poste** (il n'est pas exporté avec le référentiel) : chaque poste
vise la même base. La **session** de connexion, elle, reste locale.

> **Adresse vide = même hôte, et c'est le réglage à préférer.** Les cookies ne sont lisibles que
> par les pages de leur hôte : si l'application est servie par un hôte et le service par un autre,
> le navigateur envoie bien les cookies, mais le JavaScript de la page **ne peut pas lire le jeton
> anti-CSRF** — et chaque écriture est refusée (`csrf_invalide`) alors que les lectures passent. Le
> service rend donc aussi le jeton dans le corps de `GET /v1/auth/session` (et il le repose en
> cookie s'il a disparu), ce qui rend ce montage *possible* ; mais le déploiement fourni — nginx de
> la même origine, `/v1/` en proxy — est le seul qui n'expose pas à ce piège.

## 5. Liste de contrôle avant mise en service

- **Mode d'authentification** : `AUTH_MODE=demo` (démonstration, jetons d'API) ou
  `AUTH_MODE=password` (comptes locaux). En mode `demo`, **ne pas exposer** l'installation :
  placer l'application derrière un VPN ou un portail, car le jeton d'écriture est public.
- **Commutateur de démonstration** : `DEMO=false` pour une installation réelle — l'outil part
  d'un **référentiel vierge**, sans aucune donnée fictive. À `true` (ou vide en mode `demo`), le
  jeu fictif livré est installé et le bandeau « Démonstration » s'affiche. Une installation déjà
  peuplée se nettoie par *Administration › Données › « Repartir d'un référentiel vierge »*.
- **TLS obligatoire** : placez le service derrière un reverse-proxy HTTPS (nginx, Caddy,
  Traefik). Le jeton circule en clair dans l'en-tête sinon — et, en mode `password`, le mot de
  passe de l'agent aussi.
- **CORS** : rien à faire quand application et API partagent l'origine (le déploiement fourni) —
  le défaut est de n'autoriser **aucune** origine. Si l'application est servie par une **autre
  origine**, listez-la exactement dans `CORS_ORIGINS` (`https://actes.exemple.fr`) : le service
  renvoie alors `access-control-allow-credentials`, sans quoi le navigateur refuse la réponse à
  toute écriture (`credentials: "include"`, la session étant dans un cookie) et l'écriture est
  rangée en attente comme une panne réseau. `*` ne transporte aucune session : il ne convient
  qu'à un accès sans cookie.
- **Sauvegardes** : `mariadb-dump scriba | gzip > scriba-$(date +%F).sql.gz`, planifié ; test
  de restauration annuel — le dump doit inclure `sb_motdepasse` et `sb_session`.
- **Droits** : l'utilisateur SQL n'a besoin que de `SELECT, INSERT, UPDATE, DELETE`.
- **Journalisation** : conservez `sb_journal` (purge annuelle possible) — c'est la piste
  d'audit des modifications d'actes.
- **Dimensionnement** : un acte pèse quelques dizaines de Kio ; quelques milliers d'actes
  tiennent dans quelques centaines de Mio.
- **Reverse-proxy** : `client_max_body_size 16m;` côté nginx (les envois de collections
  passent en une requête, plafonnée par `MAX_BODY`).

## 6. Explorer en SQL

```sql
-- le registre des actes, en clair
SELECT numero, objet, statut, service_id, updated_at FROM v_acte ORDER BY updated_at DESC;

-- qui a modifié quoi, sur les dernières 24 h
SELECT at, collection, record_id, action, actor
FROM sb_journal WHERE at > NOW() - INTERVAL 1 DAY ORDER BY at DESC;

-- l'état de chaque collection
SELECT * FROM v_collection;

-- les actes d'un service, tels qu'ils sont indexés
SELECT acte_id, numero, objet FROM v_acte WHERE service_id = 'svc-regie';
```

## 7. Points de conception

- **Documents + colonnes indexées.** `sb_record.payload` conserve le document **octet pour
  octet** (`LONGTEXT`, pas `JSON` : le type `JSON` de MySQL renormalise les clés, ce qui ferait
  croire à l'application que le document a changé à chaque aller-retour). Les colonnes
  `numero`, `statut`, `service_id`… sont **recopiées par le service** à chaque écriture : elles
  rendent les documents interrogeables en SQL sans jamais être saisies à la main.
- **Révisions et conflits.** Chaque enregistrement porte sa révision ; une écriture qui cite
  une autre révision est **refusée** et la version de la base est renvoyée. Deux postes ne
  s'écrasent donc pas en silence.
- **Synchronisation par différences.** L'application n'envoie que les enregistrements qui ont
  changé (comparaison JSON canonique). L'écriture d'un acte ne réécrit pas le référentiel.
- **État du service en base.** L'état de signature et de publication est un document JSON
  unique (`sb_etat`, une ligne) réécrit à chaque dépôt, signature ou publication : il suit les
  mêmes sauvegardes et la même réplication que les données, et survit au remplacement d'un
  conteneur.
- **Domaine pur côté actes.** `actes.mjs` ne dépend ni de Node, ni de MySQL, ni du réseau :
  tout lui est injecté (état, empreinte SHA-256, horloge, persistance). C'est ce qui garantit
  que le service auto-hébergé et celui de démonstration se comportent de la même façon, et
  c'est ce qui le rend testable hors ligne.
- **Domaine pur côté comptes.** `comptes.mjs` suit la même règle : le port de crypto
  (`randomBytes`, `scrypt`, `sha256`, comparaison à temps constant) et la persistance lui sont
  injectés, ce qui permet d'éprouver le blocage après échecs, l'expiration d'une session et
  l'anti-CSRF **sans base ni attente** (`comptes.test.mjs`, `npm test`). En production, seule
  la table `sb_motdepasse` connaît les dérivés `scrypt` — jamais un mot de passe.
- **Moteur SMTP sans dépendance.** `smtp.mjs` implémente lui-même le dialogue SMTP (RFC 5321,
  2045, 2047) plutôt que d'ajouter une bibliothèque : c'est une centaine de lignes à auditer, et
  le **transport est injecté** (`lireReponse`, `ecrire`, `demarrerTls`, `fermer`), donc le moteur
  s'éprouve **sans réseau ni serveur** — c'est ainsi qu'il a été vérifié (réponses multilignes,
  capacités EHLO, `STARTTLS`, `AUTH LOGIN` et `AUTH PLAIN`, `MAIL FROM`/`RCPT TO`/`DATA`, sujet
  encodé, corps texte + HTML). Le mot de passe n'apparaît dans aucun journal.
- **La part interne de l'original est rangée, pas servie.** `hPublier` sépare l'original signé en
  deux : la part **publique** (`original`) part au recueil et se sert par les routes ouvertes ;
  la part **interne** (`originalInterne`) — mentions nominatives du signataire et trace des
  courriels — est conservée avec l'acte et ne se sert que par `GET /v1/actes/{id}/dossier-signature`,
  protégée par le jeton.

## 8. Le courriel (serveur SMTP)

Le service peut envoyer les **notifications** de Scribae par le serveur de messagerie de la
collectivité. Il lit sa configuration dans le `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`, `SMTP_REPLY_TO`, `SMTP_NOTIF_ACTIVE`,
`SMTP_TLS_INSECURE`, `SMTP_HELO_NAME`, `SMTP_TIMEOUT_MS` — voir `env.example`). **Sans
`SMTP_HOST`**, la chaîne d'envoi est simplement **indisponible** : `GET /v1/courriel` le dit,
`/v1/courriel/envoi` et `/v1/courriel/test` répondent `503 courriel_indisponible`, et
l'application trace chaque notification « non envoyée ». Rien d'autre ne change : c'est le
réglage normal d'une installation sans messagerie.

L'application — qui n'a **jamais** accès au mot de passe SMTP — demande l'envoi
(`POST /v1/courriel/envoi`, protégé par le jeton) et le service parle au serveur. Chaque envoi
est journalisé dans `sb_courriel`, et l'écran « Administration › Courriel » en montre les
derniers. Le message d'essai (`POST /v1/courriel/test`) ne suit pas la politique de
notification de l'application : c'est un essai de la chaîne.

## 9. Les réglages déclaratifs (`GET /v1/config`)

Le `.env` ne règle pas que le service : il peut aussi **poser des réglages de référentiel**
— identité de la collectivité, vocabulaire des actes, numérotation, délais, recueil public,
fonctions expérimentales — qui se font d'ordinaire dans l'interface. Le registre
[variables.mjs](variables.mjs) en est la **source de vérité** : chaque variable y est
déclarée avec sa portée, son type, ses bornes et son rôle.

- au **démarrage**, le service lit et VALIDE ces variables ; une valeur refusée (type, choix
  ou borne) n'est **jamais** appliquée, et son motif est journalisé ;
- `GET /v1/config` rend `{ variables, erreurs }` : les réglages posés (chemins pointés, ex.
  `{ "brand.name": "Ville d'Exemple", "numbering.pad": 3 }`) et les valeurs refusées ;
- l'application les applique **par-dessus le référentiel** à chaque démarrage
  (voir `../lib/deploiement-config.js`) : le `.env` l'emporte, et le référentiel enregistré
  reste celui de l'administrateur ;
- la route est **publique** et ne porte **aucun secret** : ce sont les informations que le
  recueil public affiche déjà, et l'écran de connexion en a besoin avant toute session.

La référence complète des variables — les deux portées, avec rôle, type, bornes et exemple —
est engendrée depuis ce registre dans **`../../docs/VARIABLES.md`** :

```bash
node scripts/generer-variables.mjs     # depuis la racine du dépôt (src/)
```

Pour **ajouter** une variable : un descripteur dans `variables.mjs`, une ligne dans
`env.example`, puis régénérer le wiki. Rien d'autre — la validation, le transport au
navigateur et la documentation en découlent.

