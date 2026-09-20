// ============================================================================
// Les gestes de la révision, partagés.
//
// Soumettre un acte au réviseur, le valider, le rejeter : ces trois gestes sont
// les mêmes partout où la révision apparaît — sur son propre écran
// (src/ui/views/revision.js), sur la fiche d'un acte (src/ui/views/modifier.js),
// et dans le flux d'envoi en signature (src/ui/views/signature.js), où le geste
// du rédacteur DÉCLENCHE la soumission au lieu de l'envoi.
//
// Les écrire une fois évite que ces écrans divergent dans ce qu'ils
// journalisent et dans les notifications qu'ils envoient.
//
// Aucun de ces gestes ne touche au texte de l'acte : ils font avancer son état
// de révision (`acte.revision`), journalisent le fait, préviennent les
// intéressés, et redessinent.
// ============================================================================
import { state, touch, journaliser, redrawView, can, reviseursDe, pretPourParapheur } from "./state.js";
import { toast } from "./dom.js";
import { fullName } from "../lib/users.js";
import { demanderRevision, validerRevision, rejeterRevision } from "../lib/revision.js";

const libelle = (a) => a.numero || a.objet || a.id;

// Le rédacteur envoie l'acte : il part au réviseur au lieu de partir en
// signature. L'empreinte du texte soumis est mémorisée (voir src/lib/revision.js).
export async function soumettreARevision(a, { paint = redrawView, silencieux = false } = {}) {
  const reviseurs = reviseursDe(a);
  demanderRevision(a, state.user, { reviseurs });
  a.updatedAt = new Date().toISOString();
  await journaliser({
    action: "revision.depot", cible: "acte", cibleLabel: libelle(a), acteId: a.id,
    detail: "soumis à la révision" + (reviseurs.length ? " — " + reviseurs.map((u) => fullName(u)).join(", ") : ""),
    to: reviseurs.map((u) => u.id),
  });
  touch("actes", { rerender: false });
  if (!silencieux) toast("Acte soumis au réviseur : il partira en signature après son contrôle.", "success");
  paint();
}

// Le réviseur valide : l'acte part en signature (c'est ce que la validation
// d'un acte révisé déclenche). Si le compte qui valide ne peut pas envoyer, ou
// si le parapheur n'est pas achevé, l'acte reste révisé et l'écran le dit —
// plutôt que de laisser croire qu'il est parti.
export async function validerRevisionActe(a, { paint = redrawView, rapport = null } = {}) {
  const r = validerRevision(a, state.user, rapport);
  if (!r) { toast("Cet acte n'est pas soumis à la révision.", "warning"); return false; }
  a.updatedAt = new Date().toISOString();
  await journaliser({
    action: "revision.validation", cible: "acte", cibleLabel: libelle(a), acteId: a.id,
    detail: "révisé et validé par " + (fullName(state.user) || "—")
      + (r.corrige ? ` — texte corrigé (${r.corrections || 1} version(s) de correction)` : "")
      + (rapport ? ` — rapport : ${rapport.compte.erreurs} erreur(s), ${rapport.compte.avertissements} point(s) à vérifier` : ""),
    to: [a.createdBy, "role:editeur"].filter(Boolean),
  });
  touch("actes", { rerender: false });

  const para = pretPourParapheur(a);
  if (!para.ok) {
    toast("Acte révisé. Le parapheur n'est pas achevé : la signature attend sa reprise.", "warning");
    paint();
    return false;
  }
  if (!can("actes.signer")) {
    toast("Acte révisé. Il attend l'envoi en signature : un compte habilité doit le déclencher.", "info");
    paint();
    return false;
  }
  // L'acte part en signature par le chemin réel — le même que celui du bouton
  // « Envoyer en signature ». L'outil de signature ne s'ouvre pas dans la foulée :
  // la révision n'est pas un geste de signature.
  const { envoyerEnSignature } = await import("./views/signature.js");
  await envoyerEnSignature(a, { docs: new Map(), paint }, { ouvrirOutil: false });
  return true;
}

// Le réviseur rejette : l'acte revient en BROUILLON chez son rédacteur, et le
// motif lui est communiqué. Un rejet sans motif n'est pas un rejet : il n'y a
// rien à corriger.
export async function rejeterRevisionActe(a, motif, { paint = redrawView, rapport = null } = {}) {
  const m = String(motif || "").trim();
  if (!m) { toast("Le motif du rejet est obligatoire : c'est lui qui dit quoi corriger.", "warning"); return false; }
  if (!rejeterRevision(a, state.user, m, rapport)) return false;
  a.statut = "brouillon";
  a.updatedAt = new Date().toISOString();
  await journaliser({
    action: "revision.rejet", cible: "acte", cibleLabel: libelle(a), acteId: a.id,
    detail: "rejeté en révision : " + m,
    to: [a.createdBy, "role:editeur"].filter(Boolean),
  });
  touch("actes", { rerender: false });
  toast("Acte rejeté : il revient en brouillon chez son rédacteur, avec le motif.", "warning");
  paint();
  return true;
}
