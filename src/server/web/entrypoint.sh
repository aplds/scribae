#!/bin/sh
# ============================================================================
# Prépare la racine de nginx (/srv/www) à partir des modèles de /srv/templates et
# de l'environnement du conteneur.
#
# Ce script est CUIT DANS L'IMAGE de la façade (`Dockerfile`), à l'emplacement
# /docker-entrypoint.d/40-scriba-web.sh, et c'est l'entrée de l'image nginx qui
# l'appelle — avant de démarrer nginx. Rien n'est monté depuis la machine qui
# déploie : les modèles sont dans l'image, et /srv/www est un volume (il se vide
# quand le conteneur est recréé, d'où cette préparation à chaque démarrage).
#
# Il est écrit pour être EXÉCUTÉ comme pour être SOURCÉ (selon que l'entrée de
# l'image le trouve exécutable ou non) : il évite donc `exit` et `set -e`, qui
# interrompraient l'entrée dans le second cas, et il signale ses erreurs dans le
# journal du conteneur sans empêcher nginx de démarrer pour un favicon manquant.
# ============================================================================

WWW=/srv/www
TPL=/srv/templates
erreur=0

mkdir -p "$WWW" || erreur=1

for f in index.html host.js favicon.svg; do
  if [ -r "$TPL/$f" ]; then
    cp "$TPL/$f" "$WWW/$f" || erreur=1
    # Le processus de travail de nginx n'est pas root : la coquille doit être
    # lisible par tous, quel que soit le mode du modèle dans l'image.
    chmod 644 "$WWW/$f" 2>/dev/null || true
  else
    echo "Scribae — modèle manquant dans l'image : $TPL/$f"
    erreur=1
  fi
done

export API_BASE="${API_BASE:-}"
export API_TOKEN="${API_TOKEN:-}"
export AUTH_MODE="${AUTH_MODE:-}"
export DEMO_ACCOUNTS="${DEMO_ACCOUNTS:-}"
export DEMO="${DEMO:-}"

if [ -r "$TPL/config.js.template" ]; then
  if command -v envsubst >/dev/null 2>&1; then
    envsubst '${API_BASE} ${API_TOKEN} ${AUTH_MODE} ${DEMO_ACCOUNTS} ${DEMO}' < "$TPL/config.js.template" > "$WWW/config.js" || erreur=1
  else
    sed -e "s|\${API_BASE}|$API_BASE|g" -e "s|\${API_TOKEN}|$API_TOKEN|g" \
      -e "s|\${AUTH_MODE}|$AUTH_MODE|g" -e "s|\${DEMO_ACCOUNTS}|$DEMO_ACCOUNTS|g" \
      -e "s|\${DEMO}|$DEMO|g" \
      "$TPL/config.js.template" > "$WWW/config.js" || erreur=1
  fi
  chmod 644 "$WWW/config.js" 2>/dev/null || true
fi

if [ "$erreur" = "1" ]; then
  echo "Scribae — la préparation de $WWW a échoué (image incomplète : reconstruisez la façade, « docker compose build web »)."
else
  echo "Scribae — application préparée dans $WWW (API : ${API_BASE:-même origine}, mode : ${AUTH_MODE:-référentiel})."
fi
