// ============================================================================
// Les gestes du parapheur, partagés.
//
// Soumettre un acte au circuit, enregistrer la décision d'une étape, reprendre
// un circuit : ces gestes sont les mêmes partout où le parapheur apparaît — sur
// son propre écran (src/ui/views/parapheur.js) et sur la fiche d'un acte
// (src/ui/views/modifier.js). Les écrire une fois évite que les deux écrans
// divergent dans ce qu'ils journalisent et dans les notifications qu'ils
// envoient.
//
// Aucun de ces gestes ne touche au document : ils ne font qu'avancer l'état du
// circuit (`acte.validation`), journaliser le fait, et redessiner l'écran.
// ============================================================================
import { state, touch, journaliser, redrawView } from "./state.js";
import { h, button, toast } from "./dom.js";
import { promptDialog } from "./components.js";
import {
  demarrerValidation, redemarrerValidation, appliquerDecision, etapeActive,
  verdictDe, actionDe, etiquetteEtape,
} from "../lib/validation.js";

// Le destinataire d'une étape, sous la forme que le journal et les
// notifications attendent : « role:reviseur », « personne:p-x » (le compte
// rattaché à cette personne sera prévenu), « service:svc-x ». Un seul
// vocabulaire, donc une étape confiée à un service s'annonce à ses agents sans
// que rien ici ne le sache.
const destinataireEtape = (etape) => {
  if (!etape) return "";
  const type = etape.targetType || "role";
  if (type === "personne") return etape.personId ? "personne:" + etape.personId : "";
  if (type === "service") return etape.serviceId ? "service:" + etape.serviceId : "";
  return etape.role ? "role:" + etape.role : "";
};

// Ouvrir le circuit sur un acte. Le circuit porte sur le texte ENREGISTRÉ : les
// appelants enregistrent d'abord, puis soumettent.
export async function soumettreCircuit(a, circuit, { paint = redrawView } = {}) {
  if (!circuit) { toast("Aucun circuit ne s'applique à cet acte.", "warning"); return; }
  demarrerValidation(a, circuit, state.user, state.config);
  a.updatedAt = new Date().toISOString();
  const etape = etapeActive(a.validation);
  await journaliser({
    action: "parapheur.depot", cible: "acte", cibleLabel: a.numero || a.id, acteId: a.id,
    detail: `soumis au circuit « ${circuit.label} »` + (etape ? ` — étape « ${etape.label} »` : ""),
    to: [destinataireEtape(etape), etape && etape.kind !== "verification" ? "role:reviseur" : ""].filter(Boolean),
  });
  touch("actes", { rerender: false });
  toast("Acte soumis au circuit de validation", "success");
  paint();
}

// Reprendre le circuit depuis la première étape : les décisions déjà prises
// restent lisibles dans le journal, mais elles ne valent plus — l'acte doit être
// de nouveau approuvé.
export async function reprendreCircuit(a, circuit, { paint = redrawView } = {}) {
  if (!circuit) { toast("Aucun circuit ne s'applique à cet acte.", "warning"); return; }
  const motif = await promptDialog("Reprendre le circuit", "Motif de la reprise (il sera conservé au journal) :", "");
  if (motif === null) return;
  const avant = a.validation?.statut;
  redemarrerValidation(a, circuit, state.user, state.config);
  a.updatedAt = new Date().toISOString();
  await journaliser({
    action: "parapheur.reprise", cible: "acte", cibleLabel: a.numero || a.id, acteId: a.id,
    detail: `circuit repris depuis la première étape (état précédent : ${avant || "—"})${motif ? " — " + motif : ""}`,
    to: ["role:editeur", "role:administrateur"],
  });
  touch("actes", { rerender: false });
  toast("Circuit repris depuis la première étape", "success");
  paint();
}

// Enregistrer une décision sur l'étape ouverte. Un renvoi ou un refus doit être
// motivé : c'est la seule règle, et elle est vérifiée ici comme sur l'écran.
// `libelle` permet de nommer l'acte autrement selon la nature de l'étape
// (« Avis donné » pour une étape consultative).
export async function deciderEtape(a, etape, decision, commentaire, { paint = redrawView, libelle = "" } = {}) {
  const texte = String(commentaire || "").trim();
  if ((decision === "refuse" || decision === "renvoye") && !texte) {
    toast("Un renvoi ou un refus doit être motivé.", "warning");
    return;
  }
  const dit = libelle || (decision === "valide" ? verdictDe(etape.kind)
    : decision === "passe" ? "Étape passée" : decision === "refuse" ? "Acte refusé" : "Acte renvoyé en rédaction");
  appliquerDecision(a, etape.id, decision, state.user, texte);
  a.updatedAt = new Date().toISOString();
  const v = a.validation;
  const suivante = etapeActive(v);
  const destinataires = [];
  if (decision === "valide" || decision === "passe") {
    if (suivante) destinataires.push(destinataireEtape(suivante));
    // L'étape de vérification intéresse le réviseur, même quand elle n'est pas
    // la première : c'est lui qui contrôle, et le circuit le lui annonce.
    if (suivante && suivante.kind === "verification") destinataires.push("role:reviseur");
    if (v.statut === "valide") destinataires.push(a.createdBy || "", "role:administrateur", "role:signataire");
  } else {
    destinataires.push(a.createdBy || "", "role:editeur");
  }
  await journaliser({
    action: decision === "valide" ? "parapheur.accord" : decision === "passe" ? "parapheur.passe" : decision === "refuse" ? "parapheur.refus" : "parapheur.renvoi",
    cible: "acte", cibleLabel: a.numero || a.id, acteId: a.id,
    detail: `${dit} — étape « ${etape.label} »${texte ? " : " + texte : ""}`,
    to: destinataires.filter(Boolean),
  });
  touch("actes", { rerender: false });
  toast(dit, decision === "refuse" ? "warning" : "success");
  paint();
}

// La carte de décision, telle qu'elle doit apparaître quand l'étape ouverte est
// de mon ressort. Elle est partagée pour que l'écran du parapheur et la fiche de
// l'acte proposent exactement les mêmes choix. Le geste principal porte le verbe
// de la nature de l'étape : « Vérifier », « Donner mon visa », « Marquer prêt à
// signer ».
export function carteDecision(a, etape, { heading = "h2" } = {}) {
  const nature = etiquetteEtape(etape.kind);
  const zone = h("textarea", { class: "fr-textarea", rows: 3, placeholder: "Observation (obligatoire pour un renvoi ou un refus)" });
  return h("div", { class: "fr-card parapheur-decision" },
    h(heading, { class: "fr-card__title", text: "Votre décision" }),
    h("p", { class: "fr-small fr-muted", text: nature.label + " — " + etape.label + (etape.help ? " : " + etape.help : "") }),
    h("p", { class: "fr-small fr-muted", text: nature.hint }),
    h("label", { class: "fr-label", text: "Observation" }),
    zone,
    h("div", { class: "fr-row", style: { marginTop: "10px" } },
      button(actionDe(etape.kind), {
        variant: "primary", icon: "check",
        onClick: () => deciderEtape(a, etape, "valide", zone.value),
      }),
      button("Renvoyer en rédaction", { variant: "secondary", icon: "refresh", onClick: () => deciderEtape(a, etape, "renvoye", zone.value) }),
      button("Refuser", { variant: "danger", icon: "x", onClick: () => deciderEtape(a, etape, "refuse", zone.value) }),
      etape.optional ? button("Passer cette étape", { variant: "tertiary", onClick: () => deciderEtape(a, etape, "passe", zone.value) }) : null,
    ),
  );
}
