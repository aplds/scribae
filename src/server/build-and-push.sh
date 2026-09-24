#!/bin/bash
# ============================================================================
# Scribae — Construire et publier l'image Docker autonome.
#
# Cette image embarque le service Node, nginx et le code de l'application.
# La base de données reste EXTERNE (MariaDB/MySQL à déployer séparément).
#
# USAGE
#   ./build-and-push.sh [registry/] [version] [latest]
#
# EXEMPLES
#   ./build-and-push.sh                          # Build local uniquement
#   ./build-and-push.sh ghcr.io/ toncompte        # Build + push vers ghcr.io/toncompte
#   ./build-and-push.sh docker.io/ scribae v1.0  # Push vers docker.io/scribae:v1.0
#   ./build-and-push.sh myregistry/ scribae 1.6.1q true  # Avec tag latest
#
# ENVIRONNEMENT
#   DOCKER_REGISTRY   Registry alternatif (ex: ghcr.io, docker.io)
#   DOCKER_USER       Utilisateur (pour le login)
#   DOCKER_PASSWORD    Mot de passe/token (pour le login)
#
# PRÉ-REQUIS
#   - Docker installé
#   - Être positionné à la RACINE du dépôt (pas dans src/server/)
# ============================================================================

set -euo pipefail

# --- Configuration -----------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"  # Racine du dépôt

# Valeurs par défaut (peuvent être écrasées par les arguments)
REGISTRY="${DOCKER_REGISTRY:-}"          # Ex: ghcr.io/, docker.io/, ou vide pour local
IMAGE_NAME="${1:-scribae}"               # Nom de l'image
IMAGE_VERSION="${2:-1.6.1q}"            # Version (tag)
PUSH_LATEST="${3:-false}"               # Ajouter un tag :latest ? (true/false)

# Chemins
DOCKERFILE="$SCRIPT_DIR/Dockerfile"
CONTEXT_DIR="$REPO_ROOT"                # Contexte = racine du dépôt (inclut src/)

# --- Fonctions ---------------------------------------------------------------
usage() {
  echo "Usage: $0 [registry/] [image-name] [version] [push-latest]"
  echo ""
  echo "Exemples:"
  echo "  $0                                    # Build local (scribae:1.6.1q)"
  echo "  $0 myregistry/ myapp 1.6.1q true      # Build + push avec :latest"
  echo "  $0 ghcr.io/ scribae 1.6.1q            # Push vers ghcr.io/scribae:1.6.1q"
  exit 1
}

check_prerequisites() {
  if ! command -v docker &> /dev/null; then
    echo "❌ ERREUR : Docker n'est pas installé ou non disponible dans PATH"
    exit 1
  fi
  
  if [ ! -f "$DOCKERFILE" ]; then
    echo "❌ ERREUR : Dockerfile non trouvé à $DOCKERFILE"
    echo "   Exécutez ce script depuis la racine du dépôt."
    exit 1
  fi
  
  if [ ! -d "$CONTEXT_DIR/src" ]; then
    echo "❌ ERREUR : Contexte Docker incomplet (src/ manquant)"
    echo "   Positionnez-vous à la racine du dépôt : cd /chemin/vers/scribae"
    exit 1
  fi
}

login_to_registry() {
  local registry="$1"
  
  # Pas besoin de login pour le build local ou pour Docker Hub (si déjà logué)
  if [ -z "$registry" ]; then
    return 0
  fi
  
  # Extraire le nom du registry (avant le /)
  local registry_host="${registry%/}"
  
  # Vérifier si déjà logué
  if docker info | grep -q "Username: $DOCKER_USER"; then
    echo "✅ Déjà connecté à $registry_host"
    return 0
  fi
  
  # Tentative de login
  if [ -n "${DOCKER_USER:-}" ] && [ -n "${DOCKER_PASSWORD:-}" ]; then
    echo "🔐 Connexion à $registry_host..."
    if echo "$DOCKER_PASSWORD" | docker login --username "$DOCKER_USER" --password-stdin "$registry_host" 2>/dev/null; then
      echo "✅ Connecté à $registry_host"
      return 0
    fi
  fi
  
  echo "⚠️  Impossible de se connecter à $registry_host"
  echo "   Assurez-vous d'être déjà logué via : docker login $registry_host"
  return 1
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
  docker push "$tag"
  echo "✅ Push terminé : $tag"
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
    push_image "$PRIMARY_TAG"
    
    if [ "$PUSH_LATEST" = "true" ] || [ "$PUSH_LATEST" = "1" ]; then
      echo ""
      push_image "$LATEST_TAG"
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
