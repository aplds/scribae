# Déploiement auto-hébergé — Scribae

Ce dossier contient tout ce qu'il faut pour faire tourner **Scribae en autonomie** (sans
l'édition en ligne), sur un serveur dédié, avec Docker : l'application (servie par nginx), l'API du
service (Node), la base de données (MariaDB) et un conteneur d'un instant, qui remet le compte
applicatif de la base au mot de passe du `.env` avant que le service ne démarre. Quatre conteneurs,
un réseau interne, deux volumes (les données, et la racine servie par nginx).

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
         ▲
db-init (node:20-alpine)     quelques secondes au démarrage : le compte applicatif
                             reçoit le mot de passe du .env, PUIS le schéma est
                             appliqué (schema.sql), puis il s'arrête
```

> La documentation d'**exploitation** (rôles, sauvegardes, supervision, piste d'audit,
> migration depuis la démonstration, limites) est dans **`../docs/ADMINISTRATION.md`**. Ce fichier-ci
> ne décrit que l'installation.

## 1. Ce qu'il faut avant de commencer

- Un serveur (Linux conseillé) avec **Docker** et le **plugin `docker compose`** ;
- le dépôt de l'application — le dossier qui contient **`src/`** (le client exporté) ; le
  présent fichier se trouve dans son sous-dossier `src/server/`. Il sert de **contexte de
  construction** : la pile ne monte plus aucun fichier de l'hôte dans ses conteneurs
  (voir § 9 bis) ;
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
| `DB_ROOT_PASSWORD` | mot de passe administrateur de MariaDB (compte `root`). Il sert aussi à **aligner le compte applicatif** sur `DB_PASSWORD` et à **appliquer le schéma** à chaque démarrage (service `db-init`), et à l'amorçage du dossier de données |
| `DB_PASSWORD` | mot de passe du compte applicatif `scriba` — la pile le **repose** sur le compte de la base à chaque démarrage (§ 3), sans toucher aux données : c'est aussi avec ce compte que `db-init` applique ensuite le schéma |
| `API_TOKENS` | `libellé:empreinte_sha256` — les jetons de **déploiement** acceptés en écriture (facultatif : les clés d'API créées dans l'application le remplacent) |
| `API_TOKEN` | le même jeton, **en clair**, remis à l'application (facultatif) |
| `HTTP_PORT` | port publié sur l'hôte (8080 par défaut) |
| `APP_DIR` | dossier du **dépôt**. **Sans objet** pour la pile fournie : la façade est construite et embarque déjà le code (voir § 9 bis) |
| `AUTO_MIGRATE` | `true` (le défaut de cette pile) : le service applique `schema.sql` au démarrage — le fichier ne supprime rien, et une installation neuve est utilisable du premier coup. Il l'applique aussi **quand il se rétablit** après une panne de base : une réparation faite pendant que le service tourne n'exige pas de le recréer. `false` : la migration se lance à la main (§ 3) |
| `API_BASE` | adresse de l'API vue par le navigateur — **vide** = même origine |
| `CORS_ORIGINS` | origines autorisées à appeler l'API, séparées par des virgules. **Vide = aucune** : inutile quand l'application est servie par le même domaine (cas du déploiement fourni — le navigateur n'appelle pas d'autre origine). À renseigner seulement si l'application est servie par une **autre origine** que le service (`CORS_ORIGINS=https://actes.exemple.fr`) ; `*` ne transporte aucune session, il ne convient qu'à un accès sans cookie |

**Authentification.** Par défaut (`AUTH_MODE=password`), l'application exige une **session** :
identifiant et mot de passe vérifiés par le service, puis un cookie. Pour un **essai**, passez au
mode de démonstration (`AUTH_MODE=demo`) : l'application liste alors les comptes du référentiel et
un clic ouvre la session — le jeton ci-dessus est alors la seule barrière des écritures. La
variable vaut pour le **service** *et* pour la **façade** : celle-ci l'annonce au navigateur, qui
sait donc, dès son premier appel, si la porte est une session ou un jeton (les deux défauts doivent
rester d'accord : `password`).

| Variable | Rôle |
|---|---|
| `AUTH_MODE` | `password` : identifiant + mot de passe vérifiés par le service, session par cookie |
| `DEMO_ACCOUNTS` | `true` laisse le raccourci « choisir un compte » ouvert (recette) ; `false` (défaut en mode password) le ferme |
| `ADMIN_LOGIN`, `ADMIN_PASSWORD` | le compte d'administration, créé **au premier démarrage** (ensuite le mot de passe n'est plus relu : il se change dans l'application). Si le compte **disparaît** du référentiel alors que le service garde son mot de passe, il est **rétabli au démarrage suivant** (mot de passe conservé) — voir § 5 |
| `ADMIN_NOM`, `ADMIN_EMAIL`, `ADMIN_ENTITY` | son nom, son adresse, son entité de rattachement |
| `SESSION_DAYS`, `MDP_MIN_LONGUEUR`, `SCRYPT_N` | durée de session, longueur minimale, coût du dérivé |
| `COOKIE_SECURE` | `true` en production ; `false` **seulement** pour un essai en clair |
| `SCRIBA_ANNUAIRE_*` | l'**annuaire de la collectivité** (OpenID Connect), **déclaratif** : émetteur, `client_id`, portées, correspondance des groupes (`SCRIBA_ANNUAIRE_ROLES=…=administrateur, …=editeur`), politique des agents sans groupe, périmètre, seconde porte, points de terminaison. Aucun secret (client **public**, PKCE). Ces réglages sont **publiés** par `GET /v1/auth/config` : l'écran de connexion peut donc proposer l'annuaire **même en mode `password`**, où le référentiel n'est lisible qu'avec une session. Voir `../docs/VARIABLES.md`, groupe « Annuaire (OIDC) », et `mysql/annuaire.mjs` |

**L'annuaire de la collectivité.** Il se règle dans l'application (Administration › Annuaire) ou,
pour tout un parc d'un coup, par les variables `SCRIBA_ANNUAIRE_*` ci-dessus. `AUTH_MODE=oidc` en
fait la **porte ordinaire** ; `SCRIBA_ANNUAIRE_SECONDE_PORTE=true` le propose **en plus** de la
porte ordinaire (comptes locaux, ou comptes de l'application). Dans les deux cas, les comptes
locaux restent ouverts (porte de service).

**Depuis 1.6.1p, c'est le SERVICE qui est le client OIDC.** La route `POST /v1/auth/annuaire`
(`comptes.mjs`, branchement dans `annuaire-service.mjs`) découvre le fournisseur, échange le code
d'autorisation avec le vérificateur PKCE que le navigateur lui remet, vérifie le jeton d'identité
(`jws.mjs` : clés du `jwks_uri`, RS/PS/ES — `alg: none` et `HS*` refusés), écrit le compte au
référentiel puis ouvre **sa** session : les mêmes cookies que la connexion par mot de passe. Rien
ne part du navigateur vers le fournisseur, donc **le fournisseur n'a pas besoin d'ouvrir le CORS**
(c'était la cause du « Découverte impossible (Failed to fetch) » de l'onglet), et un agent entré
par l'annuaire **lit les actes** — la seconde porte est alors proposée même en
`AUTH_MODE=password`. Le service l'annonce dans `GET /v1/auth/config` (champ `annuaireService`).
Pour un accès aux données par l'annuaire sans passer par le service, protégez-le **en amont** (SSO
devant l'application) ou réglez-le en mode à jeton.

**Les clés d'API.** Un administrateur crée des **clés d'API à rôles** (*Administration › Base de
données* → « Créer une clé d'API ») : ce sont des **comptes de service** — ils n'apparaissent nulle
part dans « Comptes et rôles », ni parmi les personnes — remis à un script, un poste ou un outil
tiers. Une clé se présente en `Authorization: Bearer <clé>` et n'ouvre que les routes de son rôle
(`lecteur`, `redacteur`, `editeur`, `administrateur`, `prestataire`) ; le service n'en conserve que
l'empreinte SHA-256, et la valeur ne s'affiche qu'une fois, à la création. Ces clés sont acceptées
**dans tous les modes** : en mode `password`, une requête portant une clé n'a pas de cookie, et ne
présente donc pas d'anti-CSRF. Les `API_TOKENS` du `.env` restent, eux, les **jetons de
déploiement** — utiles en mode `demo`, quand aucune session n'existe — et peuvent rester vides en
mode `password`. Le service tient en outre un **journal d'audit scellé** (`GET /v1/journal`) et
refuse de révoquer la **dernière** clé d'administration (`409 derniere_cle_admin`).

Le reste du mode `password` est inchangé : le compte d'administration crée les autres dans
*Comptes et rôles*, et un administrateur enfermé dehors reprend la main avec
`docker compose exec api node server.mjs --mot-de-passe <identifiant>` (le mot de passe est lu sur
l'entrée standard). Cette commande est la **porte de secours** : si le compte a disparu du
référentiel — une remise à zéro des collections, un import de données sans les comptes —, elle le
**crée** (rôle administrateur) au lieu de refuser, et elle vérifie la politique du mot de passe
avant d'écrire quoi que ce soit. Le service, de son côté, **rétablit son compte d'administration
au démarrage** quand le référentiel l'a perdu et que son mot de passe est resté (le mot de passe
est conservé, jamais remplacé). Le détail — ce qui est conservé, le blocage, les sessions, les
sauvegardes — est dans **`../docs/ADMINISTRATION.md` § 4.3 bis et § 6.1 bis**.

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
```

- une variable **vide ou absente** ne change rien : le référentiel garde sa valeur ;
- une valeur **refusée** (type, choix, borne) n'est pas appliquée, et le motif est journalisé
  par le service (`docker compose logs api`) et rendu par `GET /v1/config` ;
- le **`.env` l'emporte** sur l'interface à chaque démarrage ; le référentiel enregistré, lui,
  n'est pas modifié — retirer la variable suffit à rendre la main à l'administrateur.

La référence complète (les deux portées — service et référentiel —, avec rôle, type, bornes
et exemple) est dans **`../docs/VARIABLES.md`**, engendrée depuis le registre :

```bash
node scripts/generer-variables.mjs
```

Pour ajouter une variable : un descripteur dans le registre, une ligne dans `env.example`,
et régénérer le wiki. Le service la valide et la transporte sans autre code.

## 2 ter. Publier une image autonome

Pour diffuser Scribae sans le dossier du dépôt, `Dockerfile` (à la racine de `src/server/`)
bâtit une **image unique** contenant le service, nginx et le code de l'application :

```bash
docker build -f src/server/Dockerfile -t moncompte/scribae:1.5.2 .
```

Voir **`../docs/DOCKER.md`** : construction, publication sur un registre (Docker Hub, GHCR),
multi-architecture, lancement et exploitation.

## 3. Démarrer

```bash
docker compose up -d --build
docker compose logs -f api        # doit finir par : « … à l'écoute sur http://0.0.0.0:8080 »
```

Un service de plus apparaît dans `docker compose ps` : **`db-init`**, « exited (0) ». C'est normal,
et c'est voulu : il travaille quelques secondes puis s'arrête (voir plus bas). L'ordre est
`db` → `db-init` → `api` → `web`.

Le **compte applicatif** de la base suit le `.env`, **et le schéma suit le compte** : `db-init`
s'occupe des deux, dans cet ordre. MariaDB ne crée le compte `scriba` qu'au **premier** démarrage
d'un dossier de données vierge : changer `DB_PASSWORD` ensuite ne change plus rien en base, et le
service se voit refuser l'accès (`Access denied for user 'scriba'@…`) alors que le `.env` est
correct. C'est la panne d'installation la plus fréquente, et elle est silencieuse. `db-init` la
supprime : à chaque `docker compose up -d`, il remet le compte applicatif au mot de passe de
`DB_PASSWORD` (avec `DB_ROOT_PASSWORD`), **puis applique `schema.sql`** avec ce compte tout neuf.
Les deux pannes vont de pair : une base dont le compte était refusé n'a jamais reçu son schéma
(l'application n'avait pas de quoi le créer), et une réparation qui s'arrêterait au compte
laisserait « `Table 'scriba.sb_record' doesn't exist` » au premier écran. `schema.sql` ne contient
que des `CREATE TABLE IF NOT EXISTS` et des vues : il ne **détruit** rien, même sur une base en
service. Pour refaire les deux gestes seuls :

```bash
docker compose run --rm db-init
```

Le service applique **aussi** le schéma à son démarrage (`AUTO_MIGRATE=true`, le défaut de cette
pile) **et chaque fois qu'il se rétablit** après une panne de base : une panne réparée pendant que
le service tourne — compte aligné, base recréée — n'exige donc **pas** de le recréer. Le bandeau
« base indisponible » disparaît de lui-même, les tables manquantes se créent, et le compte
d'administration du `.env` s'amorce si c'est la base qui l'avait empêché. Rien n'est monté dans
MariaDB — le service est seul à connaître le schéma, et cela vaut aussi pour une base **externe**
(§ 5), ou pour un dossier de données qui existait déjà.

Pour une **base déjà en service** (mise à jour du schéma, `AUTO_MIGRATE=false`), la migration se
lance à la main :

```bash
docker compose exec api node server.mjs --migrate
```

L'application répond sur `http://<serveur>:${HTTP_PORT}` (par défaut `http://localhost:8080`).

## 4. Première ouverture

1. Ouvrez l'application et connectez-vous :
   - **`AUTH_MODE=demo`** (mode d'essai) : avec un compte administrateur de démonstration ;
   - **`AUTH_MODE=password`** (le **défaut**) : avec `ADMIN_LOGIN` / `ADMIN_PASSWORD` du `.env` — le
     service a créé ce compte au démarrage (le journal de `api` le dit ; s'il a refusé, il en donne
     le motif). Changez ce mot de passe dès la première connexion si le `.env` a circulé, puis créez
     les autres comptes dans *Comptes et rôles*.

     > **Modifier le `.env` exige de RECRÉER le service** : `docker compose up -d --force-recreate
     > api` (ou `up -d`). `docker compose restart` relance le même conteneur **sans relire le
     > `.env`** — les anciennes valeurs restent en place, et le journal signale alors un refus qui
     > ne correspond pas au fichier ;
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

Par défaut, seul le conteneur **web** publie un port. `api`, `db-init` et `db` ne sont joignables
que sur le **réseau interne** `interne` (bridge Docker) : c'est le sens de la requête de base de
données externe — la base est sur le même réseau virtuel que l'API, qui la désigne par son
**nom de service** (`DB_HOST=db`).

Pour héberger la base **hors** de cette pile Docker (autre hôte du réseau local) :

```
# .env
DB_HOST=192.168.1.20        # l'hôte de la base
DB_PORT=3306
```

puis `docker compose up -d`. Les services `db` **et** `db-init` du compose peuvent alors être
retirés (le second ne vise que la base de cette pile : c'est voulu — l'alignement du compte ne
s'applique jamais à une base distante sans qu'on le demande ; sur une base externe, on l'obtient
avec `docker compose run --rm --no-deps api node server.mjs --reconcilier`, si l'on a les
identifiants root de ce serveur). Vérifiez que
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
| `web` en boucle, log `find: /docker-entrypoint.d/40-scriba-web.sh: Permission denied` puis `[emerg] open() "/etc/nginx/conf.d/default.conf" failed (13: Permission denied)` | la machine qui déploie **refuse au conteneur la lecture des fichiers montés depuis l'hôte** — étiquette SELinux ou AppArmor, système de fichiers réseau (NFS, SMB), partage de machine virtuelle, espace de noms d'utilisateurs. Ce n'est pas un droit du fichier : `stat` lui-même est refusé (le script `10-listen-on-ipv6…` ne voit même pas que le fichier existe), et `root` dans le conteneur n'y peut rien | depuis la **1.5.3b**, cette pile ne monte plus AUCUN fichier de l'hôte : la façade et le code sont **construits** dans l'image. Mettez le dépôt à jour, puis `docker compose build --pull && docker compose up -d`. Sur une version antérieure : ajoutez `:z` aux trois montages de `web` (SELinux), ou passez à l'**image autonome** (`Dockerfile`, qui n'exige aucun montage — `../docs/DOCKER.md`) |
| `api` en boucle, log `Access denied for user 'scriba'@…` | le compte applicatif **en base** a un autre mot de passe que `DB_PASSWORD` : MariaDB ne pose ce mot de passe qu'au **premier** démarrage du dossier de données. Depuis la **1.5.3c**, la pile le repose elle-même (service `db-init`) — si l'erreur est là quand même, c'est que `db-init` n'a PAS pu le faire | `docker compose logs db-init` : il dit pourquoi. Le plus souvent, `DB_ROOT_PASSWORD` n'est plus celui du dossier de données (lui aussi n'est posé qu'à la création) — retrouvez l'ancien, ou repartez d'un dossier vierge (`docker compose down -v && docker compose up -d` — **au prix des données**). À la main, la même réparation : `docker compose run --rm db-init` — compte **et** schéma. Depuis la **1.5.3d**, le service se rétablit **seul** une fois la base réparée (il la rééprouve à la demande) : il n'y a pas à le recréer |
| L'application affiche « base hors ligne » | API ou base injoignable | `docker compose ps`, `docker compose logs api` ; l'application reste utilisable sur son miroir local |
| `/v1/db/health` répond `503 base_indisponible` | schéma absent, identifiants refusés, ou base injoignable — le corps porte le `remede` | voir la ligne `Table '…sb_record'` ci-dessous : c'est le même geste |
| `Table '…sb_record' doesn't exist` sur l'écran de connexion | la base répond, mais le **schéma n'a jamais été appliqué** à CETTE base : c'est le cas après une panne d'identifiants réparée à la main (le service avait démarré avant, et `AUTO_MIGRATE` ne court qu'au démarrage), ou celui d'une base **externe** reçue sans schéma, ou d'un `.env` qui porte `AUTO_MIGRATE=false` | un seul geste répare compte **et** schéma : `docker compose run --rm db-init` — `schema.sql` est idempotent et **n'efface rien**. Si le compte est déjà bon : `docker compose exec api node server.mjs --migrate`. Depuis la **1.5.3d**, le service rééprouve la base et se recharge **de lui-même** : **pas besoin de le recréer**. Retirez `AUTO_MIGRATE=false` (le défaut de la pile est `true`) pour que le schéma s'applique toujours de lui-même |
| « Aucun compte d'administration installé » alors que `ADMIN_LOGIN`/`ADMIN_PASSWORD` sont renseignés | le compte n'a pas pu être créé : table des comptes absente (l'écran le dit comme une **panne**), ou mot de passe **reçu** non conforme (le journal donne le motif exact) | appliquer le schéma (`docker compose run --rm db-init`) : depuis la **1.5.3d**, le service **réamorce lui-même** ce compte dès que la base répond ; sur une version antérieure, recréez le service (`docker compose up -d --force-recreate api`). Si le motif ne correspond pas au `.env`, voir la ligne suivante |
| Une valeur refusée au démarrage (« RÉGLAGE DE SERVICE REFUSÉ », « REFUSÉE ») qui **ne correspond pas** au `.env` | le conteneur a gardé l'environnement de sa **création** : `docker compose restart` relance le même conteneur **sans relire le `.env`** | `docker compose config` (ce que compose calcule, `.env` compris) et `docker compose exec api env` (ce que le conteneur porte) pour comparer, puis `docker compose up -d --force-recreate api` |
| Toutes les écritures répondent `503 jeton_non_configure` | `API_TOKENS` vide | générer un jeton (voir § 2) |
| Écritures `403 jeton_invalide` | `API_TOKEN` ne correspond pas à l'empreinte de `API_TOKENS` | recalculer `printf '%s' "$API_TOKEN" \| sha256sum` |
| Le navigateur bloque les appels (`CORS`) | application et API sur des origines différentes | renseigner `CORS_ORIGINS` avec l'origine de l'application |
| La signature ne fonctionne pas | page servie en `http://` (hors `localhost`) | passer en HTTPS (WebCrypto exige un contexte sécurisé) |
| Page blanche | deux causes, à distinguer par la console : **(1)** un module qui ne se charge pas (souvent : façade non reconstruite après une mise à jour du dépôt, donc 404 sur un fichier récent) ; **(2)** un module `.mjs` servi avec un type MIME non-JavaScript | **(1)** l'ouvrir : vérifier que `/src/ui/app.js` répond 200 ; le code est **dans l'image de la façade**, reconstruisez-la (`docker compose build web && docker compose up -d web`) — ou montez-la le temps d'un correctif (§ 9 bis). **(2)** si la console dit « Expected a JavaScript module script but the server responded with a MIME type of "application/octet-stream" » pour une adresse `/src/…mjs`, la façade est **antérieure au correctif 1.6.1o** : la table des types de nginx (`mime.types`) ne connaît pas l'extension `mjs`, et `nginx.conf` ne la déclarait pas — deux modules partagés avec le service (`chats-erreur.mjs`, `original-signe.mjs`) étaient donc servis en `application/octet-stream`, que le navigateur **refuse** pour un module ES (contrôle strict du type MIME). Le graphe d'imports casse, `app.js` ne s'exécute jamais, la page reste blanche. Reconstruire la façade (`docker compose up -d --build web`) : `nginx.conf` déclare désormais `application/javascript` pour `\.mjs$` |
| Un acte publié n'apparaît pas sur `/recueil` | la façade ne route pas le recueil vers l'API | `nginx.conf` intercepte `/robots.txt`, `/llms.txt`, `/sitemap.xml`, `/recueil.json`, `/recueil` et `/eli` **avant** la page de l'application (`location /`) ; après une modification de `nginx.conf`, reconstruire et recréer la façade (`docker compose up -d --build web`) |

## 9 bis. Travailler sur le code sans reconstruire la façade

La façade **embarque** le code de l'application : une modification du dépôt s'applique par
`docker compose up -d --build` (quelques secondes, et rien d'autre ne bouge). Pour travailler
**sans reconstruire** — mise au point sur un serveur, correctif d'urgence —, rendez la main à un
montage en le déclarant dans un `docker-compose.override.yml`, à côté du compose (compose lit les
deux fichiers) :

```yaml
services:
  web:
    volumes:
      - ${APP_DIR:-../../}:/srv/app:ro            # le code, monté depuis le dépôt
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro   # (facultatif) les réglages
```

Le conteneur lit alors `/srv/app/src/…` depuis le dépôt, et `docker compose up -d web` suffit.
Deux réserves :

- sur une machine à **SELinux**, ajoutez `:z` au montage (`:/srv/app:ro,z`) : sans lui, le
  conteneur n'a pas le droit de lire le dépôt — c'est exactement la panne que la construction
  évite (§ 9) ;
- la coquille, le modèle de `config.js` et les réglages d'nginx restent, eux, dans l'image :
  pour les changer, reconstruisez la façade.

Créez le dépôt une fois, déployez, puis **retirez** ce montage : une installation de service
gagne la construction (droits, étiquettes et chemins ne dépendent plus de la machine).

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

**Le bulletin (ou Journal) des actes.** Quand la collectivité a **ouvert** son bulletin
(*Administration › Bulletin*, § 5.5 septies de `../docs/ADMINISTRATION.md`), la façade sert aussi
le rendez-vous périodique — tout cela **sans JavaScript**, et tout cela `404` quand le bulletin est
éteint :

| Adresse | Contenu |
|---|---|
| `/recueil/bulletins` | le sommaire des numéros parus, et le formulaire d'abonnement |
| `/recueil/bulletins/<période>` | un numéro : les entités, leurs thématiques, les actes |
| `/recueil/bulletins/<période>.<ext>` | un numéro en données : `.json`, `.md`, `.txt` |
| `/recueil/bulletins.rss` | le flux RSS 2.0 des numéros parus (type `application/rss+xml`) |
| `/recueil/bulletins.atom` | le même flux en Atom 1.0 |
| `/recueil/bulletins/abonnement` | `POST` du formulaire d'abonnement (double consentement) |
| `/recueil/bulletins/confirmation?jeton=…` | le lien du courriel de confirmation |
| `/recueil/bulletins/desabonnement?jeton=…` | le désabonnement, en **deux** temps (le lien d'un courriel se montre, il ne se déclenche pas tout seul) |

Le numéro **provisoire** de la période en cours n'a pas d'adresse : il n'est ni servi, ni adressé.
Les envois, eux, sont le fait du **service**, qui clôt les périodes et vide sa file d'envoi à
chaque passe (au démarrage, puis toutes les `SCRIBA_BULLETIN_INTERVALLE_MIN` minutes) — voir
`mysql/bulletins.mjs`, `mysql/server.mjs` (`passeBulletins`) et `mysql/courriel.mjs`.

**Les actes réservés aux agents.** Une publication peut être **réservée** (`reserve` : circulaires
internes, consignes aux agents). Ces adresses ne les servent alors **qu'à l'appelant qui porte une
session ou une clé de service** : un visiteur anonyme ne les trouve ni dans la liste, ni à leur
adresse, ni dans `/recueil.json`, `/llms.txt` ou `/sitemap.xml`. L'acte reste *publié* pour autant
(son identifiant ELI, sa page et ses versions existent) : c'est sa **diffusion** qui est restreinte.
En mode `demo` (où il n'y a pas de session), un visiteur anonyme ne les voit donc pas ; la fonction
est pleinement active en mode `password` ou par annuaire, et pour tout appel qui présente une clé.

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
  docker-compose.yml   les QUATRE services (db, db-init, api, web) ; AUCUN fichier
                       de l'hôte n'est monté : api, db-init et web sont construits
  nginx.conf           façade : application + proxy /v1/ (cuit dans l'image de la façade)
  Dockerfile           IMAGE AUTONOME : service + façade + application en un conteneur
  nginx.standalone.conf  la façade de l'image autonome (API sur 127.0.0.1)
  standalone-entrypoint.sh  l'amorçage de l'image autonome (Node + nginx)
  Dockerfile.dockerignore  ce qui n'entre pas dans le contexte de construction
  env.example          modèle de .env (à copier en .env)
  web/                 l'édition auto-hébergée de l'application ET sa façade
    Dockerfile           LA FAÇADE : nginx + nos réglages + la coquille + le code
    Dockerfile.dockerignore  ce qui n'entre pas dans son contexte de construction
    index.html           coquille (remplace l'index.html d'origine)
    host.js              hôtes d'exécution simulés : stockage IndexedDB + HTTP
    config.js.template   adresse et jeton de l'API, remplis au démarrage du conteneur
    entrypoint.sh        prépare /srv/www (-> /docker-entrypoint.d/40-scriba-web.sh)
    favicon.svg
  mysql/               le service (Node) et le schéma
    server.mjs           HTTP : /v1/db/… (données), /v1/… (signature/publication),
                         /v1/auth/… (comptes), /v1/config (réglages déclaratifs)
    variables.mjs        REGISTRE DES VARIABLES DU .env (source de vérité du wiki)
    variables.test.mjs   tests du registre (`npm test`)
    annuaire.mjs         ce que le service PUBLIE de l'annuaire (liste blanche, aucun
                         secret) : relu du référentiel, variables SCRIBA_ANNUAIRE_*
                         par-dessus — l'écran de connexion y lit l'annuaire branché,
                         même en mode « comptes locaux »
    annuaire.test.mjs    épreuves de la publication de l'annuaire (`npm test`)
    actes.mjs            domaine signature/publication (sans dépendance à Node),
                         et les PAGES PUBLIQUES rendues côté serveur (recueil, actes,
                         bulletins, flux RSS/Atom) : HTML et CSS, sans JavaScript
    actes-bulletins.test.mjs  épreuves des pages publiques du bulletin (`npm test`)
    bulletins.mjs        LE BULLETIN (ou Journal) des actes : périodes, cadences,
                         numéros, abonnés, file d'envoi (sans dépendance à Node —
                         sha256 et horloge lui sont injectés)
    bulletins.test.mjs   tests du bulletin (`npm test`)
    courriel.mjs         composition et envoi des courriels du service (bulletin,
                         abonnements, confirmations), par le client SMTP
    smtp.mjs             client SMTP : EHLO, STARTTLS, AUTH LOGIN/PLAIN, envoi —
                         transport injecté, donc éprouvable sans réseau
    comptes.mjs          domaine des comptes locaux : mots de passe, sessions (sans
                         dépendance à Node — le port de crypto lui est injecté)
    comptes.test.mjs     tests du domaine des comptes (`npm test`)
    state.mjs            état du service en base (table sb_etat)
    compte-base.mjs      LE COMPTE APPLICATIF DE LA BASE : les ordres SQL qui le
                         (re)mettent au mot de passe du .env (module pur)
    compte-base.test.mjs épreuves de l'échappement SQL et des ordres (`npm test`)
    schema.sql           schéma MariaDB / MySQL
    Dockerfile  package.json  env.example  README.md
  charge/              ÉTUDE DE CHARGE (jamais chargée par le service) : postes
                       simulés à tous les rôles plus le public, base en mémoire,
                       rapport. Voir charge/README.md et docs/PERFORMANCE.md
```

## 12. Ce que le service tient (mesuré)

`server/charge/` met le service à l'épreuve de postes simulés. Relevé sur le service lancé sur
place : **3 200 requêtes/s** avec 41 postes en saturation, aucune erreur ; 60 postes avec des
connexions étalées sans attente notable ; 12 publications au recueil servies sans un ordre SQL.

Un réglage mérite d'être connu avant une mise en service :

```yaml
  api:
    environment:
      UV_THREADPOOL_SIZE: "8"   # 4 par défaut ; le dérivé de mot de passe s'exécute là
```

Le dérivé de mot de passe (`scrypt`) s'exécute sur le pool de fils de Node : avec les 4 fils par
défaut, vingt agents qui se connectent dans la même minute attendent en six vagues. Mesures,
scénarios et raisonnement : [`../docs/PERFORMANCE.md`](../docs/PERFORMANCE.md).
