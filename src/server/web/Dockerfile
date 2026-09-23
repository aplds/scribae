# syntax=docker/dockerfile:1
# ============================================================================
# Scribae — LA FAÇADE de la pile Compose (`docker-compose.yml`, service `web`).
#
# POURQUOI UNE IMAGE, ET NON DES MONTAGES. La façade a besoin de trois choses :
# les réglages de nginx, le script d'amorçage et le code de l'application. Les
# MONTER depuis l'hôte marche sur une machine conciliante, et échoue partout
# ailleurs : nginx reçoit alors « Permission denied » et ne démarre pas, parce
# que ce ne sont pas les droits du fichier qui commandent, mais ceux du système
# de fichiers, de l'étiquette de sécurité (SELinux, AppArmor) et de l'espace de
# noms d'utilisateurs de la machine qui héberge — trois choses que le dépôt ne
# peut ni voir, ni corriger. CUITES DANS L'IMAGE, elles ont les mêmes droits
# partout, et la façade démarre sans rien exiger de l'hôte.
#
# (Le service `api` est construit de la même façon, par `mysql/Dockerfile` : les
# deux services se ressemblent maintenant.)
#
# CONSTRUIRE — depuis `src/server/`, par `docker compose up -d --build` (le
# contexte déclaré dans le compose est la RACINE du dépôt, ce qui laisse copier
# le code de l'application en même temps que la façade) :
#
#   docker compose build web
#
# Ouvrir ce fichier directement demanderait le même contexte :
#   docker build -f src/server/web/Dockerfile -t scribae-web .
# depuis la racine du dépôt.
#
# L'image de base est ÉPINGLÉE PAR EMPREINTE, comme celles du compose et de
# `../mysql/Dockerfile` : une étiquette comme `nginx:alpine` désigne ce que le
# registre publie ce jour-là. Pour reprendre l'étiquette courante :
#   docker buildx imagetools inspect nginx:alpine
# ============================================================================
FROM nginx:alpine@sha256:62ff2089abf5a9ed33bd232895bef5e22f7bb4b200675cec49a5ebc48e3d4ac8

# --------------------------------------------------------------- la façade
# Les réglages d'nginx : le serveur par défaut de l'image cède la place.
COPY src/server/nginx.conf /etc/nginx/conf.d/default.conf

# La coquille de l'application et le modèle de `config.js`, que l'amorçage
# recopie dans la racine (`/srv/www`, un volume) en remplissant les variables.
COPY src/server/web/index.html src/server/web/host.js src/server/web/favicon.svg src/server/web/config.js.template /srv/templates/

# L'amorçage : l'entrée de l'image nginx exécute (ou source) les scripts de
# `/docker-entrypoint.d/`. Le nôtre y entre DÉJÀ nommé et déjà exécutable — il ne
# dépend donc d'aucun droit de la machine qui déploie.
COPY src/server/web/entrypoint.sh /docker-entrypoint.d/40-scriba-web.sh

# ------------------------------------------------- le code de l'application
# Ce que nginx sert sous `/src/` : le client, le guide intégré et les documents
# (« Documentation technique »). L'arborescence attendue est identique à celle du
# dépôt (`/srv/app/src/…`) : `nginx.conf` et l'image autonome n'ont pas à savoir
# d'où vient le code.
COPY src/ /srv/app/src/

# ------------------------------------------------------------------ les droits
# `COPY` REPREND les droits de la source — le dépôt, ou l'archive décompressée
# dont il vient. Un fichier arrivé en 0600, ou une arborescence en 0700, donnerait
# des 403 dans le navigateur : le processus de travail de nginx n'est pas root et
# ne peut pas lire ce que seul root peut lire. On rétablit donc franchement la
# lecture — il n'y a là ni secret, ni donnée d'exécution (le seul fichier qui
# porte un jeton, `config.js`, est engendré au démarrage dans `/srv/www`, et
# n'entre jamais dans une image).
RUN chmod 755 /docker-entrypoint.d/40-scriba-web.sh \
 && chmod 644 /etc/nginx/conf.d/default.conf \
 && chmod -R a+rX /srv/templates /srv/app

EXPOSE 80
