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
  # Le processus de travail de nginx n'est pas root : la coquille doit rester
  # lisible par tous, quel que soit le mode du modèle dans l'image.
  chmod 644 "$WWW/$f" 2>/dev/null || true
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

# --- le compte de la base, puis le schéma -------------------------------------
# Même geste que le service `db-init` de la pile Compose, et pour la même raison :
# MariaDB ne pose le mot de passe du compte applicatif qu'au PREMIER démarrage d'un
# dossier de données vierge — un `DB_PASSWORD` modifié ensuite est refusé par la
# base alors que l'environnement du conteneur est correct. Quand le mot de passe
# root est fourni, le compte est donc remis au mot de passe du conteneur, PUIS le
# schéma est appliqué avec ce compte (`schema.sql` est idempotent : il ne détruit
# rien). Sans `DB_ROOT_PASSWORD`, on ne touche à rien : la base est administrée
# ailleurs, et c'est `docker exec … --reconcilier` qui s'en charge à la main.
# Le geste ne bloque jamais le démarrage : au pire, il le dit et le service prend
# la suite en journalisant l'état réel de la base.
if [ -n "${DB_ROOT_PASSWORD:-}" ]; then
  echo "Scribae — Compte applicatif et schéma : alignement sur l'environnement (DB_ROOT_PASSWORD fourni)."
  node "$SERVICE_DIR/server.mjs" --reconcilier \
    || echo "Scribae — Alignement impossible : le service démarre quand même et dira l'état de la base."
fi

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
