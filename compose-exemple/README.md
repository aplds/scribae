# Un premier déploiement en deux conteneurs

Ce dossier donne à un administrateur **un service Scribae qui tourne**, avec
Docker seul : la base de données (MariaDB) et l'application (l'image publiée
`docker.io/aplds/scribae`), qui embarque le service Node, nginx et le code. Rien
n'est construit ici, et il n'y a rien à cloner d'autre que ce dépôt.

C'est le **point de départ** ; la pile complète — tout construite depuis le
dépôt, avec ses services d'amorçage et de façade — est dans
`../src/server/docker-compose.yml`.

## Démarrage

```bash
cp env.example .env      # renseignez DB_ROOT_PASSWORD, DB_PASSWORD, ADMIN_PASSWORD
docker compose up -d
docker compose logs -f scribae
```

L'application répond sur **http://\<adresse du serveur\>:8080**. Connectez-vous
avec `ADMIN_LOGIN` et `ADMIN_PASSWORD` : le compte est créé au premier démarrage.

Sans MariaDB à administrer du tout ? Le service sait aussi ranger ses données
dans un simple **dossier** (`STOCKAGE=fichier`, voir `../src/docs/ADMINISTRATION.md`) :
c'est le choix d'un poste ou d'une très petite structure.

## Ce que le fichier `env.example` contient, et ce qu'il ne contient pas

Trois valeurs à renseigner — les deux mots de passe de la base et celui du
premier compte —, plus les quelques réglages dont un premier essai dépend (port
publié, mode d'authentification, cookie de session, jeu de démonstration).

**Le reste ne s'écrit pas ici.** L'identité de la collectivité, le vocabulaire des
actes, la numérotation, les délais, le recueil, les bulletins, l'annuaire : tout
cela se règle depuis l'écran **Administration**, et se documente dans
`../src/docs/VARIABLES.md`. Un réglage qu'on préfère poser dans `.env` s'y ajoute
tel quel — le fichier entier est transmis au service.

## Après le premier essai

- **Architecture** : l'image publiée est construite pour **amd64** (`linux/amd64`). Sur un
  serveur ARM (Raspberry Pi, Ampere…), il faut la construire depuis le dépôt :
  `docker build -f src/server/Dockerfile -t scribae .` (la recette multi-architecture est dans
  `../src/docs/DOCKER.md` § 4.2, et le script `../src/server/build-and-push.sh` l'automatise).
- **TLS** : placez Scribae derrière un reverse proxy (nginx, Caddy, Traefik) et
  repassez `COOKIE_SECURE` à `true`. Voir `../src/docs/ADMINISTRATION.md`.
- **Sauvegardes** : tout l'état est dans le volume `donnees` (la base). Une
  sauvegarde se fait par `mariadb-dump` ou par copie du volume ; la procédure est
  décrite dans `../src/docs/ADMINISTRATION.md` § 8.
- **Mise à jour** : `docker compose pull && docker compose up -d`. Le schéma est
  appliqué au démarrage, sans perte de données.
- **Ce qui reste à faire à la main** : les comptes des agents, le référentiel, les
  trames. Le **Guide** intégré à l'application (29 chapitres) est écrit pour les
  administrateurs ; commencez par lui.

## Fichiers

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | les deux services, le volume des données, le réseau interne |
| `env.example` | les variables du premier démarrage, à copier en `.env` (jamais versionné) |
