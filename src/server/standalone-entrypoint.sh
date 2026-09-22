#!/bin/sh
# ============================================================================
# Scribae — amorçage de l'IMAGE AUTONOME (voir Dockerfile).
#
# Le conteneur tient DEUX processus : le service Node (127.0.0.1:8080) et nginx
# (port 80), qui sert l'application et relaie /v1/. Ce script les met en route,
# les surveille, et les arrête proprement ensemble — si l'un tombe, l'autre
# aussi, pour que Docker redémarre le conteneur au lieu de servir à moitié.
#
# Il prépare aussi /srv/www (la coquille et `config.js`, engendré de
# l'environnement) à partir des modèles de /srv/templates.
# ============================================================================
set -eu

TPL=/srv/templates
WWW=/srv/www
SERVICE_DIR="${SCRIBA_SERVICE_DIR:-/srv/service}"

# --- l'application servie par nginx -----------------------------------------
mkdir -p "$WWW"
for f in index.html host.js favicon.svg; do
  cp "$TPL/$f" "$WWW/$f"
done

# `config.js` : adresse et jeton de l'API, mode d'authentification et commutateur
# de démonstration, tels que le navigateur les découvre avant tout appel réseau.
export API_BASE="${API_BASE:-}"
export API_TOKEN="${API_TOKEN:-}"
export AUTH_MODE="${AUTH_MODE:-}"
export DEMO_ACCOUNTS="${DEMO_ACCOUNTS:-}"
export DEMO="${DEMO:-}"
envsubst '${API_BASE} ${API_TOKEN} ${AUTH_MODE} ${DEMO_ACCOUNTS} ${DEMO}' \
  < "$TPL/config.js.template" > "$WWW/config.js"
chmod 644 "$WWW/config.js" 2>/dev/null || true

# --- les deux processus ------------------------------------------------------
echo "Scribae — Image autonome : service Node + nginx (API ${API_BASE:-même origine}, mode ${AUTH_MODE:-référentiel})."

node "$SERVICE_DIR/server.mjs" &
NODE_PID=$!

nginx -g 'daemon off;' &
NGINX_PID=$!

arret() {
  kill -TERM "$NODE_PID" "$NGINX_PID" 2>/dev/null || true
}
trap arret TERM INT

# On surveille les deux : le premier qui s'arrête interrompt le conteneur.
while kill -0 "$NODE_PID" 2>/dev/null && kill -0 "$NGINX_PID" 2>/dev/null; do
  sleep 1
done

echo "Scribae — un processus s'est arrêté ; arrêt du conteneur."
arret
wait "$NODE_PID" 2>/dev/null || true
wait "$NGINX_PID" 2>/dev/null || true
exit 0
