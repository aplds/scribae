#!/bin/sh
# ============================================================================
# Prépare la racine de nginx (/srv/www) à partir des modèles (web/*) et de
# l'environnement du conteneur. Exécuté par l'entrypoint de l'image nginx (volume
# monté dans /docker-entrypoint.d/), avant le démarrage de nginx.
#
# Le script est « sourcé » (il n'est pas exécutable) : il évite donc `exit` et
# `set -e`, pour ne pas interrompre l'entrypoint de l'image ; il signale ses
# erreurs dans le journal du conteneur.
# ============================================================================

WWW=/srv/www
TPL=/srv/templates
erreur=0

mkdir -p "$WWW" || erreur=1

for f in index.html host.js favicon.svg; do
  if [ -r "$TPL/$f" ]; then
    cp "$TPL/$f" "$WWW/$f" || erreur=1
  else
    echo "Scribae — modèle manquant : $TPL/$f"
    erreur=1
  fi
done

export API_BASE="${API_BASE:-}"
export API_TOKEN="${API_TOKEN:-}"
export AUTH_MODE="${AUTH_MODE:-}"
export DEMO_ACCOUNTS="${DEMO_ACCOUNTS:-}"

if [ -r "$TPL/config.js.template" ]; then
  if command -v envsubst >/dev/null 2>&1; then
    envsubst '${API_BASE} ${API_TOKEN} ${AUTH_MODE} ${DEMO_ACCOUNTS}' < "$TPL/config.js.template" > "$WWW/config.js" || erreur=1
  else
    sed -e "s|\${API_BASE}|$API_BASE|g" -e "s|\${API_TOKEN}|$API_TOKEN|g" \
      -e "s|\${AUTH_MODE}|$AUTH_MODE|g" -e "s|\${DEMO_ACCOUNTS}|$DEMO_ACCOUNTS|g" \
      "$TPL/config.js.template" > "$WWW/config.js" || erreur=1
  fi
  chmod 644 "$WWW/config.js" 2>/dev/null || true
fi

if [ "$erreur" = "1" ]; then
  echo "Scribae — la préparation de $WWW a échoué ; vérifiez le montage de ./web."
else
  echo "Scribae — application préparée dans $WWW (API : ${API_BASE:-même origine}, mode : ${AUTH_MODE:-référentiel})."
fi
