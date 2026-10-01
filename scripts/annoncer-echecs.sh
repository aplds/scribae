#!/usr/bin/env bash
# ============================================================================
# Scribae — ANNONCER LES ÉPREUVES ROUGES.
#
# POURQUOI CE SCRIPT. `node --test` écrit son verdict dans le journal du travail,
# et ce journal n'est lisible QUE par un administrateur du dépôt : qui voit la
# chaîne rouge n'apprend pas QUELLE épreuve a lâché, ni pourquoi. Une chaîne
# rouge dont personne ne distingue la cause ne rend pas le service qu'une chaîne
# rend (audit, NC-I-008) : la CI appelait donc ce script après un échec, et il
# transforme le journal en ANNOTATIONS GitHub (« ::error:: »). Une annotation est
# attachée au commit, visible dans l'onglet « Checks », et interrogeable par
# l'API publique — donc lisible par quiconque, et pas seulement par le dépôt.
#
# CE QU'IL ÉCRIT. Une annotation par épreuve rouge — LE FICHIER qui la porte, la
# ligne rouge (son nom), et le message d'assertion quand il tient sur une ligne
# —, et le résumé du journal dans le récapitulatif du travail
# (`$GITHUB_STEP_SUMMARY`), qui est, lui, fait pour être lu par la personne qui
# ouvre la chaîne, et que sa longueur ne limite pas.
#
# IL NE DÉCIDE DE RIEN. Il ne fait que rendre lisible ce qui a déjà échoué : son
# code de sortie est toujours 0, et c'est l'appelant qui rend le verdict.
#
# Usage (depuis la racine du dépôt) :
#   bash scripts/annoncer-echecs.sh <journal-des-épreuves>
# ============================================================================
set -u

JOURNAL="${1:-}"
if [ -z "$JOURNAL" ] || [ ! -r "$JOURNAL" ]; then
  echo "annoncer-echecs : journal illisible (« ${JOURNAL:-aucun} ») — rien à annoncer."
  exit 0
fi

# LES DEUX RAPPORTEURS SONT GUETTÉS. `node --test` écrit en TAP quand sa sortie
# n'est pas un terminal (c'est le cas en CI), et en « spec » quand elle l'est
# (c'est le cas à la main). Les deux formes sont donc reconnues : une croix, ou
# « not ok ».
ROUGES="$(grep -aE '^[[:space:]]*(not ok [0-9]+|✖)' "$JOURNAL" | head -n 10 || true)"

if [ -n "$ROUGES" ]; then
  # Une annotation par épreuve rouge : LE FICHIER (la ligne « # Subtest: » du
  # rapport TAP qui la porte), puis la ligne rouge elle-même — son nom suffit à
  # retrouver l'épreuve. Quand le message d'assertion tient sur une ligne
  # (« error: 'attendu 2, obtenu 0' »), il est joint ; quand il est multiligne
  # (TAP « error: |- »), il est dans le récapitulatif ci-dessous, qui, lui, n'a
  # pas de limite de longueur. Les sauts de ligne sont encodés comme l'exige la
  # commande de workflow, et le message est borné à 1400 caractères.
  awk '
    function esc(s) { gsub(/%/, "%25", s); gsub(/\r/, "%0D", s); return s }
    /^#[ \t]*Subtest:/ { f = $0; sub(/^#[ \t]*Subtest:[ \t]*/, "", f) }
    /^[ \t]*(not ok [0-9]+|✖)/ { print "::error::" esc(f) " | " esc($0) }
    /^[ \t]*error: / { if ($0 !~ /^[ \t]*error:[ \t]*\|-?[ \t]*$/) print "::error::" esc(f) " | " esc($0) }
  ' "$JOURNAL" | cut -c1-1400 | head -n 20
  echo "annoncer-echecs : $(printf '%s\n' "$ROUGES" | wc -l) épreuve(s) rouge(s) annoncée(s) en annotations."
else
  echo "::error::Les épreuves ont échoué, et le journal ne porte aucune ligne rouge reconnaissable — lisez-le ci-dessous."
fi

# LE JOURNAL LUI-MÊME, dans le récapitulatif du travail : c'est ce que lit la
# personne qui clique sur la chaîne rouge, et il est plus complet que les
# annotations (qui sont bornées et limitées en nombre).
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## Épreuves en échec"
    echo
    echo "Les dix lignes rouges, telles quelles :"
    echo
    echo '```'
    printf '%s\n' "$ROUGES"
    echo '```'
    echo
    echo "Les quarante dernières lignes du journal :"
    echo
    echo '```'
    tail -n 40 "$JOURNAL"
    echo '```'
  } >> "$GITHUB_STEP_SUMMARY"
fi

exit 0
