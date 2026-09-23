# syntax=docker/dockerfile:1
# ============================================================================
# Scribae — IMAGE AUTONOME (un seul conteneur : service + façade + application).
#
# C'est l'alternative au `docker-compose.yml` de ce dossier. La pile Compose
# sépare trois services (db, api, web), tous CONSTRUITS (aucun fichier de l'hôte
# n'y est monté : voir web/Dockerfile) ; cette image-ci embarque tout — le
# service Node, nginx et le code de l'application — pour être publiée sur un
# registre (Docker Hub, GHCR…) et lancée d'une commande, sans dépôt ni dossier
# local.
#
# La base de données reste EXTERNE : MariaDB / MySQL est un état qui se sauvegarde
# et se conserve à part, pas une couche d'image. Voir src/docs/DOCKER.md.
#
# Construire (depuis la RACINE du dépôt — le contexte inclut `src/`) :
#
#   docker build -f src/server/Dockerfile -t <compte>/scribae:<version> .
#
# L'image de base est ÉPINGLÉE PAR EMPREINTE (et non par simple étiquette) : une
# étiquette comme `20-alpine` désigne ce que le registre publie ce jour-là, si
# bien que deux constructions séparées dans le temps ne produisent pas le même
# artefact. Pour reprendre l'étiquette courante :
#   docker buildx imagetools inspect node:20-alpine
# ============================================================================
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

LABEL org.opencontainers.image.title="Scribae"
LABEL org.opencontainers.image.description="Éditeur de trames et d'actes administratifs : rédaction, signature, publication au recueil (ELI)."
LABEL org.opencontainers.image.licenses="GPL-3.0-only"
LABEL org.opencontainers.image.source="https://github.com/"

# nginx sert l'application ; gettext fournit `envsubst`, qui remplit `config.js`
# depuis l'environnement du conteneur (voir standalone-entrypoint.sh).
RUN apk add --no-cache nginx gettext

# --------------------------------------------------------------- le service
WORKDIR /srv/service
COPY src/server/mysql/package.json src/server/mysql/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY src/server/mysql/ ./
ENV NODE_ENV=production

# ----------------------------------------------------------------- la façade
COPY src/server/web/index.html src/server/web/host.js src/server/web/favicon.svg src/server/web/config.js.template /srv/templates/
# La façade. Alpine inclut `/etc/nginx/http.d/*.conf` (et NON `/etc/nginx/conf.d/`),
# c'est donc là qu'atterrit notre configuration — à la place du serveur par défaut.
COPY src/server/nginx.standalone.conf /etc/nginx/http.d/default.conf
COPY src/server/standalone-entrypoint.sh /usr/local/bin/scribae-entrypoint
RUN chmod +x /usr/local/bin/scribae-entrypoint

# ------------------------------------------------------- le code de l'application
# Ce que sert nginx sous /src/ : le client, le guide intégré et les documents
# (« Documentation technique »).
COPY src /srv/app/src

# `COPY` REPREND les droits de la source — le dépôt, ou l'archive décompressée
# dont il vient. Un fichier arrivé en 0600, ou une arborescence en 0700, donnerait
# des 403 dans le navigateur : le processus de travail de nginx n'est pas root et
# ne peut pas lire ce que seul root peut lire. On rétablit donc franchement la
# lecture — il n'y a là ni secret, ni donnée d'exécution (le seul fichier qui
# porte un jeton, `config.js`, est engendré au démarrage dans /srv/www).
RUN chmod 644 /etc/nginx/http.d/default.conf \
 && chmod -R a+rX /srv/templates /srv/app

ENV SCRIBA_SERVICE_DIR=/srv/service
EXPOSE 80

# Le conteneur tient deux processus (Node et nginx) : l'entrée les surveille et
# les arrête ensemble. Voir standalone-entrypoint.sh.
ENTRYPOINT ["/usr/local/bin/scribae-entrypoint"]
