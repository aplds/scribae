# Construire une image Docker autonome

Ce document explique comment **bâtir une image Docker unique** contenant tout Scribae —
le service Node, la façade nginx et le code de l'application —, comment la **publier**
sur un registre (Docker Hub, GHCR, un registre privé…), et comment la **lancer**.

> L'**autre** façon de déployer est le `docker-compose.yml` de `src/server/` : trois
> services séparés (`db`, `api`, `web`), le code de l'application **embarqué dans l'image
> de la façade**. L'image autonome, elle, **embarque** ce code : elle se lance sans
> dépôt, et c'est elle qu'on publie sur un registre. Voir `src/server/README.md` pour la
> pile Compose.

## 1. Ce que contient l'image

```
┌─────────────────────────────────────────────────────────────┐
│  scribae  (un conteneur)                                     │
│                                                              │
│  nginx :80 ── sert l'application ── /src/… ── code embarqué  │
│      │                                                       │
│      └── relaie /v1/ ──► Node :8080 ── le service            │
│                              │                               │
└──────────────────────────────┼───────────────────────────────┘
                               ▼
                        MariaDB / MySQL            (EXTERNE)
```

La **base de données n'est pas dans l'image** : c'est un état qui se sauvegarde et se
conserve à part. L'image se connecte à une base MariaDB / MySQL joignable
(`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).

## 2. Prérequis

- **Docker** (avec BuildKit, livré avec Docker Engine ≥ 20.10) ;
- un **dépôt** contenant `src/` (la racine de ce dépôt — c'est le contexte de construction) ;
- pour publier : un compte sur un registre, et `docker login` fait au préalable.

## 3. Construire

Depuis la **racine du dépôt** (le dossier qui contient `src/`) :

```bash
docker build -f src/server/Dockerfile -t scribae:1.5.3 .
```

Le contexte est la racine du dépôt ; le Dockerfile ne copie que `src/`, donc la taille du
contexte n'entre pas dans l'image. Un fichier d'exclusion (`src/server/Dockerfile.dockerignore`)
écarte `.git`, `node_modules`, `scratch`… quand votre version de Docker le reconnaît.

Vérifier ensuite :

```bash
docker image ls scribae:1.5.3
docker run --rm scribae:1.5.3 nginx -v
```

## 4. Publier sur un registre

### 4.1. Étiqueter et pousser (mono-architecture)

```bash
REGISTRE=moncompte          # compte Docker Hub, ou ghcr.io/moncompte, ou un registre privé
VERSION=1.5.3

docker build -f src/server/Dockerfile -t "$REGISTRE/scribae:$VERSION" .
docker tag "$REGISTRE/scribae:$VERSION" "$REGISTRE/scribae:latest"
docker push "$REGISTRE/scribae:$VERSION"
docker push "$REGISTRE/scribae:latest"
```

### 4.2. Publier plusieurs architectures (amd64 + arm64)

Avec `buildx`, on construit et pousse en une fois — l'image tirée s'adapte alors au serveur
(Intel/AMD ou ARM, comme un Raspberry Pi ou un serveur Ampere) :

```bash
docker buildx create --use --name scribae-builder     # une fois
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f src/server/Dockerfile \
  -t "$REGISTRE/scribae:$VERSION" -t "$REGISTRE/scribae:latest" \
  --push .
```

> Une étiquette `latest` mobile est commode, mais une installation de service gagne à
> ÉPINGLER une version (`scribae:1.5.3`) : `docker pull` reproductible, et mise à jour
> délibérée.

## 5. Lancer

### 5.1. Avec une base MariaDB dans un réseau dédié

```bash
docker network create scribae

# 1) la base
docker run -d --name scribae-db --network scribae --restart unless-stopped \
  -e MARIADB_ROOT_PASSWORD='un-mot-de-passe-root-long' \
  -e MARIADB_DATABASE=scriba \
  -e MARIADB_USER=scriba \
  -e MARIADB_PASSWORD='le-mot-de-passe-applicatif' \
  -v scribae-donnees:/var/lib/mysql \
  mariadb:11

# 2) Scribae
docker run -d --name scribae --network scribae --restart unless-stopped \
  -p 8080:80 \
  -e DB_HOST=scribae-db \
  -e DB_USER=scriba \
  -e DB_PASSWORD='le-mot-de-passe-applicatif' \
  -e DB_NAME=scriba \
  -e DB_ROOT_PASSWORD='un-mot-de-passe-root-long' \
  -e AUTO_MIGRATE=true \
  -e AUTH_MODE=password \
  -e ADMIN_LOGIN=admin \
  -e ADMIN_PASSWORD='un-mot-de-passe-long-et-unique' \
  -e COOKIE_SECURE=false \
  -e SCRIBA_IDENTITE_NOM="Ville d'Exemple" \
  -e SCRIBA_IDENTITE_ADRESSE='https://actes.exemple.fr' \
  "$REGISTRE/scribae:$VERSION"
```

- `DB_ROOT_PASSWORD` est le mot de passe root de la base ci-dessus : le conteneur s'en sert, **au
  démarrage seulement**, pour remettre le compte applicatif au mot de passe de `DB_PASSWORD` et
  appliquer le schéma — sinon, un dossier de données déjà initialisé garderait l'ancien mot de passe
  et une base sans tables. Omettre la variable quand la base est administrée ailleurs (§ 5.2).

- `AUTO_MIGRATE=true` applique le schéma au premier démarrage (tables créées si absentes).
  C'est **idempotent** ; on peut le laisser, ou le retirer une fois la base en service. Depuis la
  **1.5.3d**, le service l'applique aussi quand il se rétablit après une panne de base.
- `COOKIE_SECURE=false` n'est là que pour l'essai **en clair** sur `http://`. En
  production (HTTPS), laissez la valeur par défaut (`true`).
- `-p 8080:80` publie la façade ; `web` dans la pile Compose publiait `HTTP_PORT`.

L'application répond alors sur `http://<serveur>:8080`.

### 5.2. Avec la base ailleurs sur le réseau

Retirez le conteneur `db` et pointez l'image sur votre base existante :

```bash
docker run -d --name scribae --restart unless-stopped -p 8080:80 \
  -e DB_HOST=192.168.1.20 -e DB_PORT=3306 \
  -e DB_USER=scriba -e DB_PASSWORD='…' -e DB_NAME=scriba \
  -e AUTH_MODE=password -e ADMIN_PASSWORD='…' \
  "$REGISTRE/scribae:$VERSION"
```

Vérifiez que votre serveur MariaDB accepte les connexions distantes (`bind-address`,
compte `'scriba'@'%'`, pare-feu), et que le trafic est chiffré ou confiné au réseau local.

Ici, pas de `DB_ROOT_PASSWORD` : la base est administrée par son propre service. Si le compte
applicatif doit être remis au mot de passe de ce conteneur (ou le schéma appliqué), faites-le à la
main — `docker exec scribae node /srv/service/server.mjs --reconcilier` avec `DB_ROOT_PASSWORD`
fourni le temps de la commande (§ 9).

### 5.3. Le même service, en Compose

```yaml
# docker-compose.yml — à côté d'un fichier .env (voir src/server/env.example)
services:
  db:
    image: mariadb:11
    restart: unless-stopped
    environment:
      MARIADB_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:?}
      MARIADB_DATABASE: ${DB_NAME:-scriba}
      MARIADB_USER: ${DB_USER:-scriba}
      MARIADB_PASSWORD: ${DB_PASSWORD:?}
    volumes: [donnees:/var/lib/mysql]

  scribae:
    image: ${SCRIBA_IMAGE:-moncompte/scribae:1.5.3}
    restart: unless-stopped
    environment:
      DB_HOST: db
      DB_USER: ${DB_USER:-scriba}
      DB_PASSWORD: ${DB_PASSWORD:?}
      DB_NAME: ${DB_NAME:-scriba}
      DB_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:?}
      AUTO_MIGRATE: "true"
      AUTH_MODE: ${AUTH_MODE:-password}
      ADMIN_LOGIN: ${ADMIN_LOGIN:-admin}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:?}
      COOKIE_SECURE: ${COOKIE_SECURE:-true}
      DEMO: ${DEMO:-false}
      SCRIBA_IDENTITE_NOM: ${SCRIBA_IDENTITE_NOM:-}
      SCRIBA_IDENTITE_ADRESSE: ${SCRIBA_IDENTITE_ADRESSE:-}
    ports: ["${HTTP_PORT:-8080}:80"]
    depends_on: [db]

volumes: { donnees: }
```

## 6. Configurer

Toute la configuration passe par l'**environnement** du conteneur. La référence complète
— rôle, type, bornes, exemple de chaque variable — est dans
[`VARIABLES.md`](VARIABLES.md) (et dans l'application : *Documentation technique › Variables
de déploiement*). Les plus utiles au démarrage :

| Variable | Rôle |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | la base de données. Avec `DB_ROOT_PASSWORD`, le conteneur **remet lui-même le compte applicatif** au mot de passe de son environnement et **applique le schéma** à chaque démarrage (voir § 9) ; sans lui, ces deux gestes se font à la main (`node /srv/service/server.mjs --reconcilier`) |
| `DB_ROOT_PASSWORD` | mot de passe administrateur de la base : il n'est lu que pour l'alignement du compte applicatif et le schéma, au démarrage. À omettre quand la base est administrée ailleurs — le conteneur ne touche alors à rien |
| `AUTO_MIGRATE=true` | appliquer le schéma au démarrage (premier lancement, et à chaque reprise de la base) |
| `AUTH_MODE` | `password` (défaut sûr) ou `demo` (essai, sans mot de passe) |
| `ADMIN_LOGIN`, `ADMIN_PASSWORD` | le compte d'administration, créé au premier démarrage |
| `DEMO=false` | référentiel **vierge** : aucune donnée fictive |
| `COOKIE_SECURE` | `true` en production (HTTPS) |
| `SCRIBA_IDENTITE_NOM`, `SCRIBA_IDENTITE_ADRESSE`, `SCRIBA_IDENTITE_COULEUR` | l'identité de la collectivité, **déclarée** |
| `SCRIBA_*` (vocabulaire, numérotation, délais, recueil, fonctions) | les réglages de référentiel, **déclaratifs** |

Les variables `SCRIBA_*` sont **appliquées par-dessus le référentiel** à chaque démarrage :
le `.env` l'emporte sur ce qui a été saisi dans l'interface, et le référentiel enregistré
n'est pas modifié. Une variable retirée du `.env` n'est plus imposée au lancement suivant —
l'interface reprend la main sur la valeur enregistrée.

## 7. Première ouverture

1. Ouvrez l'application (`http://<serveur>:8080`).
2. Connectez-vous avec `ADMIN_LOGIN` / `ADMIN_PASSWORD`. Le service a créé ce compte au
   premier démarrage ; changez son mot de passe dès la première connexion s'il a circulé.
3. **Administration › Identité** : vérifiez le nom, l'emblème, l'adresse de base.
4. Créez les autres comptes dans **Comptes et rôles**, ou branchez l'annuaire (OIDC).

Si `ADMIN_PASSWORD` ne respecte pas la politique (longueur, classes de caractères),
**aucun compte n'est créé** — et l'écran de connexion le dit, avec le motif. Corrigez la
variable et relancez le conteneur.

## 8. TLS (production)

Le conteneur écoute en HTTP sur le port 80. Placez-le **derrière un reverse-proxy TLS** et
ne publiez pas le port sur l'extérieur. Exemple avec Caddy sur le même hôte :

```
actes.exemple.fr {
    reverse_proxy 127.0.0.1:8080
}
```

La signature électronique utilise `crypto.subtle`, qui n'existe qu'en **contexte
sécurisé** (HTTPS, ou `http://localhost` en essai) : sans TLS, la signature ne fonctionne
pas.

## 9. Exploitation

```bash
docker logs -f scribae            # le service journalise au démarrage, dont les variables refusées
docker exec scribae node /srv/service/server.mjs --reconcilier  # remettre le compte applicatif au mot de passe du conteneur, puis appliquer le schéma (DB_ROOT_PASSWORD requis)
docker exec scribae node /srv/service/server.mjs --migrate      # appliquer le schéma seul (compte déjà en règle)
docker exec -it scribae sh        # dans le conteneur
```

Le conteneur fait **déjà** ces deux gestes au démarrage lorsque `DB_ROOT_PASSWORD` lui est fourni
(§ 6) ; depuis la **1.5.3d**, le service rééprouve en outre la base à la demande : une panne
réparée pendant qu'il tourne n'exige pas de le recréer.

- **Mise à jour** : `docker pull "$REGISTRE/scribae:$VERSION"`, puis arrêtez et relancez le
  conteneur avec la nouvelle étiquette (ou `docker compose up -d` si vous utilisez le
  Compose du § 5.3). Appliquez la migration si le schéma a changé.
- **Sauvegardes** : la base se sauvegarde comme toute base MariaDB
  (`mariadb-dump`). Voir « Sauvegardes » dans `src/docs/ADMINISTRATION.md`. Pensez à
  sauvegarder la configuration (les variables d'environnement) à part : elle ne vit
  nulle part dans l'image.
- **Registre privé** : l'image ne contient **aucun secret** (les mots de passe viennent de
  l'environnement au lancement), mais elle embarque votre code — un registre privé reste
  préférable pour une collectivité.

## 9 bis. Si la façade refuse de démarrer : « Permission denied »

Sur certaines machines, un conteneur n'a pas le droit de **lire** les fichiers montés depuis
l'hôte — étiquette de sécurité (SELinux, AppArmor), système de fichiers réseau (NFS, SMB), partage
de machine virtuelle, espace de noms d'utilisateurs. nginx le dit alors ainsi, et refuse de
démarrer :

```
/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration
find: /docker-entrypoint.d/40-scriba-web.sh: Permission denied
10-listen-on-ipv6-by-default.sh: info: /etc/nginx/conf.d/default.conf is not a file or does not exist
2026/09/23 12:19:05 [emerg] 1#1: open() "/etc/nginx/conf.d/default.conf" failed (13: Permission denied)
nginx: [emerg] open() "/etc/nginx/conf.d/default.conf" failed (13: Permission denied)
```

Ce n'est pas un droit du fichier qu'on corrigerait quelque part : **`stat` lui-même est refusé**
(le script `10-listen-on-ipv6…` ne voit même pas que le fichier existe), et `root` dans le
conteneur n'y peut rien — le refus vient du montage, pas du fichier. D'où la règle des deux voies
de déploiement :

- **l'image autonome** (ce document) et la **pile Compose de `src/server/`** ne montent AUCUN
  fichier de l'hôte : le code, la façade et le schéma entrent dans les images. C'est la voie à
  suivre sur une machine de ce genre — rien à régler, rien à étiqueter ;
- si vous devez conserver un montage de votre côté, donnez-lui l'option **`:z`** (par exemple
  `- ./mon-dossier:/srv/app:ro,z`) : Docker réétiquette alors le fichier pour le conteneur. C'est
  la cause la plus fréquente, et la seule correction qui ne demande pas de reconstruire.

## 10. Reconstruire après une modification du code

```bash
git pull                       # ou mettre à jour le dossier
docker build -f src/server/Dockerfile -t "$REGISTRE/scribae:$VERSION" .
docker push "$REGISTRE/scribae:$VERSION"
```

Pensez à incrémenter la version (`APP_VERSION` dans `src/lib/version.js`) et à compléter
`src/CHANGELOG.md` : une étiquette de registre qui ne change pas de version ne se
distingue pas d'une autre.

## 11. Voir aussi

- `src/server/README.md` — la pile Docker Compose (trois services, tous construits : aucun
  fichier de l'hôte n'est monté) ;
- `src/docs/VARIABLES.md` — la référence des variables d'environnement ;
- `src/docs/ADMINISTRATION.md` — l'exploitation : rôles, sauvegardes, supervision, migration.
