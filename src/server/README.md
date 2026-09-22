# Déploiement auto-hébergé — Scribae

Ce dossier contient tout ce qu'il faut pour faire tourner **Scribae en autonomie** (sans
l'édition en ligne), sur un serveur dédié, avec Docker : l'application (servie par nginx), l'API du
service (Node) et la base de données (MariaDB). Trois conteneurs, un réseau interne, un
volume.

```
navigateur
   │  https://actes.example.fr           (ou http://serveur:8080 en essai)
   ▼
web  (nginx:alpine)          sert l'application et proxy /v1/ vers api
   │  http://api:8080   (réseau interne, non publié)
   ▼
api  (node:20-alpine)        /v1/db/… (données)  +  /v1/… (signature, publication)
   │  mysql://db:3306    (réseau interne, non publié)
   ▼
db   (mariadb:11)            tables sb_collection / sb_record / sb_journal / sb_etat
```

> La documentation d'**exploitation** (rôles, sauvegardes, supervision, piste d'audit,
> migration depuis la démonstration, limites) est dans **`../docs/ADMINISTRATION.md`**. Ce fichier-ci
> ne décrit que l'installation.

## 1. Ce qu'il faut avant de commencer

- Un serveur (Linux conseillé) avec **Docker** et le **plugin `docker compose`** ;
- le dossier de l'application — celui qui contient **`src/` et `index.html`** (le
  client exporté) ; le présent fichier se trouve dans son sous-dossier `src/server/` ;
- pour la production : un **nom de domaine** et un **reverse-proxy TLS** (voir § 6). La
  signature électronique utilise `crypto.subtle`, qui n'existe que dans un **contexte
  sécurisé** : HTTPS, ou `http://localhost` en essai.

## 2. Configurer

```bash
cd src/server
cp env.example .env
```

Générez un jeton d'API (le secret qui autorise les écritures) :

```bash
JETON=$(openssl rand -hex 32)
echo "API_TOKEN (en clair, pour l'application) : $JETON"
printf '%s' "$JETON" | sha256sum      # → empreinte, pour API_TOKENS
```

Renseignez ensuite `.env` :

| Variable | Rôle |
|---|---|
| `DB_ROOT_PASSWORD` | mot de passe administrateur de MariaDB (compte `root`) |
| `DB_PASSWORD` | mot de passe du compte applicatif `scriba` |
| `API_TOKENS` | `libellé:empreinte_sha256` — les jetons acceptés en écriture |
| `API_TOKEN` | le même jeton, **en clair**, remis à l'application |
| `HTTP_PORT` | port publié sur l'hôte (8080 par défaut) |
| `APP_DIR` | dossier qui contient `src/` et `index.html` (`../../` par défaut) |
| `API_BASE` | adresse de l'API vue par le navigateur — **vide** = même origine |
| `CORS_ORIGINS` | origines autorisées ; `*` convient quand l'API est derrière la même façade |

**Authentification.** Par défaut (`AUTH_MODE=demo`), l'application liste les comptes du référentiel
et un clic ouvre la session — c'est le mode de démonstration, et le jeton ci-dessus est alors la
seule barrière des écritures. Pour une installation réelle, activez les **comptes locaux** :

| Variable | Rôle |
|---|---|
| `AUTH_MODE` | `password` : identifiant + mot de passe vérifiés par le service, session par cookie |
| `DEMO_ACCOUNTS` | `true` laisse le raccourci « choisir un compte » ouvert (recette) ; `false` (défaut en mode password) le ferme |
| `ADMIN_LOGIN`, `ADMIN_PASSWORD` | le compte d'administration, créé **au premier démarrage** (ensuite le mot de passe n'est plus relu) |
| `ADMIN_NOM`, `ADMIN_EMAIL`, `ADMIN_ENTITY` | son nom, son adresse, son entité de rattachement |
| `SESSION_DAYS`, `MDP_MIN_LONGUEUR`, `SCRYPT_N` | durée de session, longueur minimale, coût du dérivé |
| `COOKIE_SECURE` | `true` en production ; `false` **seulement** pour un essai en clair |

En mode `password`, les jetons d'API ne sont plus acceptés (`API_TOKENS` / `API_TOKEN` peuvent
rester vides), le compte d'administration crée les autres dans *Comptes et rôles*, et un
administrateur enfermé dehors reprend la main avec
`docker compose exec api node server.mjs --mot-de-passe <identifiant>` (le mot de passe est lu sur
l'entrée standard). Le détail — ce qui est conservé, le blocage, les sessions, les sauvegardes —
est dans **`../docs/ADMINISTRATION.md` § 4.3 bis et § 6.1 bis**.

Le jeton en clair n'est **jamais** transmis à la base : le serveur ne connaît que son
empreinte SHA-256. Il est en revanche servi au navigateur dans `config.js` (l'application est
publique — voir « Sécurité » dans `../docs/ADMINISTRATION.md`).

## 2 bis. Les réglages déclaratifs (identité, vocabulaire, numérotation…)

Le `.env` ne fait pas que brancher le service : il peut aussi **poser des réglages de
référentiel** qui, sinon, se saisissent un clic après l'autre dans l'interface. Ils sont
déclarés une fois — dans le registre [`mysql/variables.mjs`](mysql/variables.mjs) —, validés
par le service au démarrage, et transmis au navigateur par `GET /v1/config`, qui les applique
**par-dessus le référentiel** :

```
SCRIBA_IDENTITE_NOM=Ville d'Exemple
SCRIBA_IDENTITE_ADRESSE=https://actes.exemple.fr
SCRIBA_DELAI_RECOURS_MOIS=2
SCRIBA_RECUEIL_OPPOSABILITE=jours
SCRIBA_PARAPHEUR=true
```

- une variable **vide ou absente** ne change rien : le référentiel garde sa valeur ;
- une valeur **refusée** (type, choix, borne) n'est pas appliquée, et le motif est journalisé
  par le service (`docker compose logs api`) et rendu par `GET /v1/config` ;
- le **`.env` l'emporte** sur l'interface à chaque démarrage ; le référentiel enregistré, lui,
  n'est pas modifié — retirer la variable suffit à rendre la main à l'administrateur.

La référence complète (les deux portées — service et référentiel —, avec rôle, type, bornes
et exemple) est dans **`../docs/VARIABLES.md`**, engendrée depuis le registre :

```bash
node src/scripts/generer-variables.mjs
```

Pour ajouter une variable : un descripteur dans le registre, une ligne dans `env.example`,
et régénérer le wiki. Le service la valide et la transporte sans autre code.

## 2 ter. Publier une image autonome

Pour diffuser Scribae sans le dossier du dépôt, `Dockerfile` (à la racine de `src/server/`)
bâtit une **image unique** contenant le service, nginx et le code de l'application :

```bash
docker build -f src/server/Dockerfile -t moncompte/scribae:1.3.1 .
```

Voir **`../docs/DOCKER.md`** : construction, publication sur un registre (Docker Hub, GHCR),
multi-architecture, lancement et exploitation.

## 3. Démarrer

```bash
docker compose up -d --build
docker compose logs -f api        # doit finir par : « … à l'écoute sur http://0.0.0.0:8080 »
```

Au **premier** démarrage, MariaDB est vide : elle exécute `mysql/schema.sql` (monté dans son
`docker-entrypoint-initdb.d`) et crée les tables. C'est suffisant pour une installation neuve.

Pour une **base déjà en service** (mise à jour du schéma), lancez la migration explicitement :

```bash
docker compose exec api node server.mjs --migrate
```

L'application répond sur `http://<serveur>:${HTTP_PORT}` (par défaut `http://localhost:8080`).

## 4. Première ouverture

1. Ouvrez l'application et connectez-vous :
   - **`AUTH_MODE=demo`** (défaut) : avec un compte administrateur de démonstration ;
   - **`AUTH_MODE=password`** : avec `ADMIN_LOGIN` / `ADMIN_PASSWORD` du `.env` — le service a créé
     ce compte au démarrage (le journal de `api` le dit). Changez ce mot de passe dès la première
     connexion si le `.env` a circulé, puis créez les autres comptes dans *Comptes et rôles* ;
2. **Administration › Base de données** : le mode doit déjà être « **Serveur externe — MySQL /
   MariaDB** », l'adresse **vide** (même origine) et le jeton celui de `.env` (en mode `password`,
   aucun jeton n'est nécessaire — laissez le champ vide) ;
3. *Envoyer les données à la base* pour y installer le référentiel de départ (la base est
   vide au premier démarrage) ;
4. **Administration › Identité › Mention de démonstration** : masquez le bandeau orange quand
   l'installation devient une installation de service.

Chaque poste se connecte à la **même** base : les données (référentiel, trames, actes,
comptes) sont partagées, et deux postes qui modifient des objets *différents* ne se gênent
jamais. La session et les certificats de signature restent, eux, propres au poste.

## 5. Réseau

Par défaut, seul le conteneur **web** publie un port. `api` et `db` ne sont joignables que
sur le **réseau interne** `interne` (bridge Docker) : c'est le sens de la requête de base de
données externe — la base est sur le même réseau virtuel que l'API, qui la désigne par son
**nom de service** (`DB_HOST=db`).

Pour héberger la base **hors** de cette pile Docker (autre hôte du réseau local) :

```
# .env
DB_HOST=192.168.1.20        # l'hôte de la base
DB_PORT=3306
```

puis `docker compose up -d` (le service `db` du compose peut alors être retiré). Vérifiez que
le serveur MariaDB accepte les connexions distantes (`bind-address`, compte `'scriba'@'%'`,
pare-feu) et que le trafic est chiffré ou confiné au réseau local — le mot de passe de la
base circule sinon en clair.

## 6. TLS (production)

Le conteneur `web` écoute en HTTP. Placez devant lui un reverse-proxy TLS et ne publiez pas
`HTTP_PORT` sur l'extérieur. Exemple avec Caddy :

```
actes.example.fr {
    reverse_proxy 127.0.0.1:8080
}
```

Ou en nginx :

```nginx
server {
  listen 443 ssl http2;
  server_name actes.example.fr;
  ssl_certificate     /etc/letsencrypt/live/actes.example.fr/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/actes.example.fr/privkey.pem;
  client_max_body_size 16m;
  location / { proxy_pass http://127.0.0.1:8080; proxy_set_header Host $host;
               proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
               proxy_set_header X-Forwarded-Proto $scheme; }
}
```

Reportez ensuite l'adresse publique dans `.env` si le navigateur doit appeler l'API
directement (`API_BASE=https://actes.example.fr`) — vide suffit quand tout passe par la même
façade, ce qui est le cas ici.

## 7. Sauvegardes

La base est une base MariaDB ordinaire ; les sauvegardes habituelles s'appliquent.

```bash
# sauvegarde (schéma + données + état du service)
docker compose exec -T db mariadb-dump -u root -p"$DB_ROOT_PASSWORD" --single-transaction \
  --routines --triggers scriba | gzip > scriba-$(date +%F).sql.gz

# restauration
gunzip -c scriba-2026-09-19.sql.gz | docker compose exec -T db \
  mariadb -u root -p"$DB_ROOT_PASSWORD" scriba
```

Le **volume** `donnees` contient les fichiers de MariaDB ; sauvegarder le volume à chaud ne
remplace pas un dump. Voir `../docs/ADMINISTRATION.md` § « Sauvegardes » pour la politique
(retenue, test de restauration, quoi sauvegarder en plus : `.env` et le référentiel exporté).

## 8. Mise à jour

```bash
git pull                     # ou remplacez le dossier de l'application
docker compose up -d --build # reconstruit l'image api, recharge la façade
docker compose exec api node server.mjs --migrate   # si le schéma a changé
```

`docker compose down` arrête tout sans perdre les données (le volume `donnees` survit) ;
`docker compose down -v` **efface** la base — à ne jamais faire sur une installation de
service.

## 9. Dépannage

| Symptôme | Cause probable | Remède |
|---|---|---|
| `api` redémarre en boucle, log `Access denied for user` | `DB_PASSWORD` différent entre `db` et `api`, ou base initialisée avec un autre mot de passe | aligner `.env`, ou `docker compose down -v` **si** les données peuvent être perdues |
| L'application affiche « base hors ligne » | API ou base injoignable | `docker compose ps`, `docker compose logs api` ; l'application reste utilisable sur son miroir local |
| `/v1/db/health` répond `503 base_indisponible` | schéma absent | `docker compose exec api node server.mjs --migrate` |
| Toutes les écritures répondent `503 jeton_non_configure` | `API_TOKENS` vide | générer un jeton (voir § 2) |
| Écritures `403 jeton_invalide` | `API_TOKEN` ne correspond pas à l'empreinte de `API_TOKENS` | recalculer `printf '%s' "$API_TOKEN" \| sha256sum` |
| Le navigateur bloque les appels (`CORS`) | application et API sur des origines différentes | renseigner `CORS_ORIGINS` avec l'origine de l'application |
| La signature ne fonctionne pas | page servie en `http://` (hors `localhost`) | passer en HTTPS (WebCrypto exige un contexte sécurisé) |
| Page blanche | modules non chargés | ouvrir la console : vérifier que `/src/ui/app.js` répond 200 et que le montage `APP_DIR` pointe bien sur le dossier contenant `src/` |
| Un acte publié n'apparaît pas sur `/recueil` | la façade ne route pas le recueil vers l'API | `nginx.conf` intercepte `/robots.txt`, `/llms.txt`, `/sitemap.xml`, `/recueil.json`, `/recueil` et `/eli` **avant** la page de l'application (`location /`) ; vérifier que le conteneur `web` a bien été recréé après modification |

## 10. Recueil ouvert : ce que la façade sert sans JavaScript

Le service sert lui-même les adresses que lisent les **moteurs de recherche** et les **agents**
(voir `../lib/recueil.js` et `mysql/actes.mjs`). nginx les route vers l'API **avant** la page de
l'application :

| Adresse | Contenu |
|---|---|
| `/robots.txt` | ce qui peut être parcouru, et où trouver le plan |
| `/llms.txt` | le recueil présenté aux agents, en Markdown (convention `llms.txt`) |
| `/sitemap.xml` | le plan du site : une adresse par acte publié |
| `/recueil.json` | l'index complet des actes publiés, lisible par machine |
| `/recueil` | la liste des actes, en HTML rendu côté serveur |
| `/recueil/<clé>` | la page d'un acte, en HTML rendu côté serveur |
| `/recueil/<clé>.<ext>` | une représentation : `.json`, `.md`, `.txt`, `.akn` |
| `/eli/<code>/<année>/<n°>/<entité>` | l'identifiant ELI comme adresse : redirige (302) vers la page de l'acte en vigueur |

Ces réponses portent un `cache-control` public court. Les actes **retirés** du recueil disparaissent
aussi de ces adresses. Aucun réglage n'est nécessaire côté application : c'est la publication qui
ouvre l'acte.

Les liens **ELI** que porte un acte publié (« eli:/fr/… », un visa d'adoption par exemple) y sont
résolus : le service, qui détient les publications, remplace l'identifiant par l'adresse de l'acte
visé ; un identifiant qu'il ne connaît pas reste une mention, sans lien. La page servie se lit donc
sans JavaScript, et un lien ELI y mène toujours à un acte de l'instance.

**Les règlements publiés à part.** Un **règlement** annexé (voir `../SPEC.md` § 2.2.4 ter) fait
l'objet d'une publication **informative**, déposée par `hPublier` avec `informative: true` et **sans
original** : le service l'accepte, laisse `original` et `signature` nuls, **ne touche pas à l'état de
l'acte déposé**, et rend `informative` et `adoption` (l'acte qui l'adopte) dans la publication et
dans `resumePublication`. Son identifiant porte le code `reg` (`eli:/fr/reg/…`) ; les publications
successives du même règlement partagent cet identifiant et en sont les **versions**, la dernière
déposée étant celle que le recueil montre. Comme pour un acte, les adresses `/eli/reg/…`,
`/recueil/<clé>` et les représentations restent valables.

## 11. Arborescence

```
src/server/
  docker-compose.yml   les trois services (db, api, web)
  nginx.conf           façade : application + proxy /v1/ (monté dans le conteneur web)
  Dockerfile           IMAGE AUTONOME : service + façade + application en un conteneur
  nginx.standalone.conf  la façade de l'image autonome (API sur 127.0.0.1)
  standalone-entrypoint.sh  l'amorçage de l'image autonome (Node + nginx)
  Dockerfile.dockerignore  ce qui n'entre pas dans le contexte de construction
  env.example          modèle de .env (à copier en .env)
  web/                 l'édition auto-hébergée de l'application
    index.html           coquille (remplace l'index.html d'origine)
    host.js              hôtes d'exécution simulés : stockage IndexedDB + HTTP
    config.js.template   adresse et jeton de l'API, remplis au démarrage du conteneur
    entrypoint.sh        prépare /srv/www
    favicon.svg
  mysql/               le service (Node) et le schéma
    server.mjs           HTTP : /v1/db/… (données), /v1/… (signature/publication),
                         /v1/auth/… (comptes), /v1/config (réglages déclaratifs)
    variables.mjs        REGISTRE DES VARIABLES DU .env (source de vérité du wiki)
    variables.test.mjs   tests du registre (`npm test`)
    actes.mjs            domaine signature/publication (sans dépendance à Node)
    comptes.mjs          domaine des comptes locaux : mots de passe, sessions (sans
                         dépendance à Node — le port de crypto lui est injecté)
    comptes.test.mjs     tests du domaine des comptes (`npm test`)
    state.mjs            état du service en base (table sb_etat)
    schema.sql           schéma MariaDB / MySQL
    Dockerfile  package.json  env.example  README.md
```
