#!/bin/bash
# ============================================================================
# Scribae — Construire et publier l'image Docker autonome.
#
# Cette image embarque le service Node, nginx et le code de l'application.
# La base de données reste EXTERNE (MariaDB/MySQL à déployer séparément).
#
# USAGE
#   ./build-and-push.sh [image-name] [version] [latest]
#
# Le registre n'est PAS un argument : il se donne par `DOCKER_REGISTRY`.
# La VERSION non plus, tant qu'on ne veut pas la forcer : sans second argument,
# elle est LUE dans `src/lib/version.js` (`APP_VERSION`), qui est la source
# unique du numéro du logiciel (voir src/README.md). La recopier ici ferait dire
# au tag ce que le logiciel ne dit plus.
#
# EXEMPLES
#   ./build-and-push.sh                          # Build local (scribae:<version du dépôt>)
#   ./build-and-push.sh scribae <version> true   # Build + tag :latest, version forcée
#   DOCKER_REGISTRY=ghcr.io/ ./build-and-push.sh moncompte   # Build + push
#
# ENVIRONNEMENT
#   DOCKER_REGISTRY   Registre de destination (ex: ghcr.io/, docker.io/) ; vide = pas de push
#   DOCKER_USER       Utilisateur (pour le login)
#   DOCKER_PASSWORD   Mot de passe/token (pour le login)
#
# PRÉ-REQUIS
#   - Docker installé
#   - L'arborescence du dépôt intacte : le script retrouve la racine tout seul, où qu'on le lance
# ============================================================================

set -euo pipefail

# --- Configuration -----------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Le script vit dans src/server/, donc la racine = 2 niveaux au-dessus
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"  # Racine du dépôt

# Valeurs par défaut (peuvent être écrasées par les arguments)
REGISTRY="${DOCKER_REGISTRY:-}"          # Ex: ghcr.io/, docker.io/, ou vide pour local
IMAGE_NAME="${1:-scribae}"               # Nom de l'image
VERSION_FICHIER="$REPO_ROOT/src/lib/version.js"
VERSION_DU_DEPOT=""
if [ -r "$VERSION_FICHIER" ]; then
  # `APP_VERSION = "<version>";` → <version>. C'est la SEULE source du numéro : le
  # dépôt n'en tient pas de copie (voir src/lib/version.js).
  VERSION_DU_DEPOT="$(sed -n 's/.*APP_VERSION *= *"\([^"]*\)".*/\1/p' "$VERSION_FICHIER" | head -n 1)"
fi
IMAGE_VERSION="${2:-${VERSION_DU_DEPOT:-developpement}}"   # Version (tag)
PUSH_LATEST="${3:-false}"               # Ajouter un tag :latest ? (true/false)

# Chemins
DOCKERFILE="$SCRIPT_DIR/Dockerfile"
CONTEXT_DIR="$REPO_ROOT"                # Contexte = racine du dépôt (inclut src/)

# --- Fonctions ---------------------------------------------------------------
usage() {
  echo "Usage: $0 [image-name] [version] [push-latest]"
  echo ""
  echo "Le registre se donne par DOCKER_REGISTRY (vide : build local seulement)."
  echo "Sans version, elle est lue dans src/lib/version.js (APP_VERSION)."
  echo ""
  echo "Exemples:"
  echo "  $0                                    # Build local (scribae:<version du dépôt>)"
  echo "  $0 scribae <version> true             # Build + tag :latest (version forcée)"
  echo "  DOCKER_REGISTRY=ghcr.io/ $0 moncompte # Build + push"
  exit 1
}

check_prerequisites() {
  if ! command -v docker &> /dev/null; then
    echo "❌ ERREUR : Docker n'est pas installé ou non disponible dans PATH"
    exit 1
  fi
  
  if [ ! -f "$DOCKERFILE" ]; then
    echo "❌ ERREUR : Dockerfile non trouvé à $DOCKERFILE"
    exit 1
  fi
  
  if [ ! -d "$CONTEXT_DIR/src" ]; then
    echo "❌ ERREUR : Contexte Docker incomplet (src/ manquant)"
    echo "   REPO_ROOT calculé : $REPO_ROOT"
    echo "   CONTEXT_DIR : $CONTEXT_DIR"
    echo "   Vérifiez que src/ existe bien à cet endroit."
    exit 1
  fi
}

# Où le client Docker range ses identifiants (le fichier que `docker login`
# écrit). `DOCKER_CONFIG` déplace ce dossier ; sans lui, c'est `~/.docker`.
fichier_identifiants() {
  if [ -n "${DOCKER_CONFIG:-}" ]; then
    echo "$DOCKER_CONFIG/config.json"
  else
    echo "$HOME/.docker/config.json"
  fi
}

# Le registre porte-t-il déjà une entrée d'identification ? On lit le FICHIER, et
# non la sortie de `docker info` : celle-ci dépend de la version du client et du
# démon (elle ne dit pas la même chose selon qu'on emploie un magasin
# d'identifiants ou non), alors que `auths` est écrit par `docker login` depuis
# toujours. C'est une INDICATION, pas une décision : plus bas, c'est le `push`
# lui-même qui tranche — un magasin d'identifiants (`credsStore`) peut n'écrire
# aucune entrée `auths` et pourtant fournir le jeton.
registre_deja_renseigne() {
  local registry_host="$1"
  local cfg
  cfg="$(fichier_identifiants)"
  [ -r "$cfg" ] || return 1
  grep -q "\"$registry_host\"" "$cfg" 2>/dev/null && return 0
  return 1
}

login_to_registry() {
  local registry="$1"

  # Pas besoin de login pour le build local.
  if [ -z "$registry" ]; then
    return 0
  fi

  # Extraire le nom du registry (avant le /)
  local registry_host="${registry%/}"

  # Des identifiants sont fournis : on se connecte, et un refus est un refus (on
  # ne pousse pas avec un compte dont la base vient de dire non).
  if [ -n "${DOCKER_USER:-}" ] && [ -n "${DOCKER_PASSWORD:-}" ]; then
    echo "🔐 Connexion à $registry_host..."
    if echo "$DOCKER_PASSWORD" | docker login --username "$DOCKER_USER" --password-stdin "$registry_host"; then
      echo "✅ Connecté à $registry_host"
      return 0
    fi
    echo "❌ Connexion refusée par $registry_host."
    echo "   Vérifiez DOCKER_USER et DOCKER_PASSWORD (un JETON, pour un registre qui en exige un)."
    return 1
  fi

  # Aucun identifiant fourni : on ne devine pas, et l'on n'empêche rien. Si une
  # entrée existe pour ce registre, on le dit ; sinon, on rappelle quoi faire —
  # mais on TENTE le push, car un magasin d'identifiants peut très bien fournir
  # le jeton sans que ce fichier en garde trace.
  if registre_deja_renseigne "$registry_host"; then
    echo "✅ Identifiants trouvés pour $registry_host ($(fichier_identifiants))"
  else
    echo "ℹ️  Aucun identifiant fourni (DOCKER_USER / DOCKER_PASSWORD) et rien dans $(fichier_identifiants)."
    echo "   Le push est tenté quand même : si Docker n'a pas de session, il le dira et le remède est « docker login $registry_host »."
  fi
  return 0
}

build_image() {
  local tag="$1"
  echo "🛠️  Construction de l'image : $tag"
  
  docker build \
    -f "$DOCKERFILE" \
    -t "$tag" \
    "$CONTEXT_DIR" \
    2>&1 | grep -v "^#" | sed 's/^/  /'
  
  echo "✅ Image construite : $tag"
}

tag_image() {
  local source="$1"
  local target="$2"
  echo "🏷️  Tag $source → $target"
  docker tag "$source" "$target"
}

push_image() {
  local tag="$1"
  echo "📤 Push de $tag..."
  if docker push "$tag"; then
    echo "✅ Push terminé : $tag"
    return 0
  fi
  # Un push qui échoue est presque toujours une session absente : le dire, et
  # donner le remède, vaut mieux que renvoyer l'erreur brute de Docker.
  echo "❌ Le push de $tag a échoué."
  echo "   Le plus souvent : aucune session ouverte pour ce registre."
  echo "     docker login ${REGISTRY%/}"
  echo "   ou relancez ce script avec DOCKER_USER et DOCKER_PASSWORD."
  echo "   L'image construite localement n'est pas perdue : « docker push $tag »."
  return 1
}

# --- Vérifications -------------------------------------------------------------
if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
fi

check_prerequisites

# --- Construction --------------------------------------------------------------
FULL_IMAGE_NAME="$IMAGE_NAME"
if [ -n "$REGISTRY" ]; then
  FULL_IMAGE_NAME="${REGISTRY}${IMAGE_NAME}"
fi

PRIMARY_TAG="${FULL_IMAGE_NAME}:${IMAGE_VERSION}"

# Build l'image principale
echo "================================================================"
echo " BUILD SCRIBAE"
echo "================================================================"
build_image "$PRIMARY_TAG"

# --- Tag supplémentaire (latest) -------------------------------------------------
if [ "$PUSH_LATEST" = "true" ] || [ "$PUSH_LATEST" = "1" ]; then
  LATEST_TAG="${FULL_IMAGE_NAME}:latest"
  echo "================================================================"
  echo " TAG LATEST"
echo "================================================================"
  tag_image "$PRIMARY_TAG" "$LATEST_TAG"
fi

# --- Push (si registry spécifié) --------------------------------------------------
if [ -n "$REGISTRY" ]; then
  echo "================================================================"
  echo " LOGIN + PUSH"
echo "================================================================"
  
  if login_to_registry "$REGISTRY"; then
    echo ""
    if ! push_image "$PRIMARY_TAG"; then
      echo ""
      echo "⚠️  L'image est construite localement, mais elle n'a PAS été publiée."
      exit 1
    fi

    if [ "$PUSH_LATEST" = "true" ] || [ "$PUSH_LATEST" = "1" ]; then
      echo ""
      if ! push_image "$LATEST_TAG"; then
        echo "⚠️  $PRIMARY_TAG est publiée ; l'étiquette « latest » ne l'est pas."
        exit 1
      fi
    fi

    echo ""
    echo "🎉 SUCCÈS !"
    echo "   Images publiées :"
    echo "   - $PRIMARY_TAG"
    if [ "$PUSH_LATEST" = "true" ] || [ "$PUSH_LATEST" = "1" ]; then
      echo "   - $LATEST_TAG"
    fi
  else
    echo "⚠️  Login échoué. Images construites localement mais non poussées."
    echo "   Pour pousser manuellement plus tard :"
    echo "   docker push $PRIMARY_TAG"
    if [ "$PUSH_LATEST" = "true" ] || [ "$PUSH_LATEST" = "1" ]; then
      echo "   docker push $LATEST_TAG"
    fi
  fi
else
  echo ""
  echo "🎉 SUCCÈS !"
  echo "   Image construite localement : $PRIMARY_TAG"
  if [ "$PUSH_LATEST" = "true" ] || [ "$PUSH_LATEST" = "1" ]; then
    echo "   Tag supplémentaire : $LATEST_TAG"
  fi
fi

echo ""
echo "================================================================"
echo " POUR DÉPLOYER AVEC PORTAINER"
echo "================================================================"
echo "1. Copiez les variables depuis src/server/env.example dans votre .env"
echo "2. Dans Portainer :"
echo "   - Créez un conteneur avec l'image : $PRIMARY_TAG"
echo "   - Mappez le port 8080:80"
echo "   - Ajoutez toutes les variables d'environnement"
echo "3. Démarrez le conteneur"
echo ""
echo "Documentation : src/server/README.md"
