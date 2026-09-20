# Service de la collectivité — Node + MySQL / MariaDB

Ce dossier contient le **service** de Scribae : le serveur HTTP qui branche
l'application (qui vit dans le navigateur) sur la base **MySQL / MariaDB** de la
collectivité, et qui porte le **dépôt des actes, la signature et la publication**.

Il expose **deux familles de ressources** :

| Famille | Ressources | Persistance |
|---|---|---|
| **Données** | `GET /v1/db/health`, `GET /v1/db/collections/{collection}`, `POST /v1/db/collections/{collection}/sync` | `sb_record`, `sb_collection`, `sb_journal` |
| **Actes** | `/v1/actes…`, `/v1/signatures…`, `/v1/webhooks/signature`, `/v1/publications…`, `/v1/eli/…`, `GET /v1/health`, `GET /v1/` (OpenAPI) | `sb_etat` |

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

## 4. Brancher l'application

Dans l'application : **Référentiel › Base de données** →

- mode **Serveur externe — MySQL / MariaDB** ;
- **Adresse** : `https://donnees.exemple.fr`, ou **vide** si l'application est servie par le
  même serveur que l'API (cas du déploiement auto-hébergé fourni) ;
- **Jeton** : le jeton en clair de l'étape 3 ;
- *Tester la connexion*, puis *Appliquer et recharger* ;
- enfin *Envoyer les données à la base* pour installer le référentiel de départ.

Le réglage est **propre au poste** (il n'est pas exporté avec le référentiel) : chaque poste
vise la même base. La **session** de connexion, elle, reste locale.

## 5. Liste de contrôle avant mise en service

- **TLS obligatoire** : placez le service derrière un reverse-proxy HTTPS (nginx, Caddy,
  Traefik). Le jeton circule en clair dans l'en-tête sinon.
- **CORS** : en auto-hébergement, application et API partagent l'origine — `*` convient ;
  sinon, listez les origines exactes dans `CORS_ORIGINS`.
- **Sauvegardes** : `mariadb-dump scriba | gzip > scriba-$(date +%F).sql.gz`, planifié ; test
  de restauration annuel.
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
