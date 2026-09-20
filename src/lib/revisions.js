// ============================================================================
// Historique des brouillons.
//
// Un acte enregistré plusieurs fois ne laisse aucune trace de ses états
// précédents : on ne voit que la dernière version. Ce module ajoute cette
// mémoire — l'équivalent des « versions » d'un traitement de texte.
//
// À chaque enregistrement, l'état PRÉCÉDENT est conservé (valeurs + écarts),
// avec la date, l'auteur et un libellé qui dit pourquoi cette version a été
// faite. Les vingt dernières sont gardées : au-delà, la plus ancienne sort. Un
// acte qui vient d'être repris peut ainsi être ramené à une version antérieure
// en un clic — le geste n'efface rien, il crée une nouvelle révision.
//
// C'est un historique de TRAVAIL, pas d'archivage : la mémoire juridique de
// l'acte, elle, est dans les versions publiées et dans le journal.
// ============================================================================

export const REVISIONS_MAX = 20;

// Copie l'état courant de l'acte dans son historique. À appeler AVANT de
// modifier les valeurs (on archive ce qui existait), jamais après.
export function ajouterRevision(acte, { label = "Enregistrement", by = "", byName = "" } = {}) {
  if (!acte) return null;
  const rev = {
    id: "rev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 5),
    at: new Date().toISOString(),
    by,
    byName,
    label,
    statut: acte.statut || "",
    numero: acte.numero || "",
    objet: acte.objet || "",
    values: structuredClone(acte.values || {}),
    overrides: structuredClone(acte.overrides || {}),
  };
  const liste = Array.isArray(acte.revisions) ? acte.revisions : [];
  acte.revisions = [...liste, rev].slice(-REVISIONS_MAX);
  return rev;
}

export const revisionsDe = (acte) =>
  [...(acte?.revisions || [])].sort((a, b) => String(b.at).localeCompare(String(a.at)));

// Restaure une révision : l'état actuel est d'abord archivé (on ne perd rien),
// puis la révision choisie devient l'état courant.
export function restaurerRevision(acte, revId, { by = "", byName = "" } = {}) {
  const rev = (acte?.revisions || []).find((r) => r.id === revId);
  if (!rev) return null;
  ajouterRevision(acte, { label: "Avant retour à une version antérieure", by, byName });
  acte.values = structuredClone(rev.values || {});
  acte.overrides = structuredClone(rev.overrides || {});
  acte.statut = rev.statut || "pret";
  acte.updatedAt = new Date().toISOString();
  return rev;
}

export const nbRevisions = (acte) => (acte?.revisions || []).length;
