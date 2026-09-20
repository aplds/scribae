// ============================================================================
// Révision — le bureau du réviseur.
//
// Le réviseur s'intercale entre l'envoi à signature décidé par le rédacteur et
// l'envoi effectif. Cet écran est son bureau : ce qui l'attend, ce qui attend un
// autre réviseur, ce qui a été révisé, ce qui a été rejeté.
//
// Pour chaque acte, il a sous les yeux le RAPPORT DE CONFORMITÉ (voir
// src/lib/conformite.js) : ce qui est vérifiable automatiquement — contrôles de
// la trame, structure du document, visas et références, mentions, publicité,
// écarts et annotations. Le rapport ne décide pas : l'opportunité, la légalité de
// fond et le style restent l'affaire du réviseur, et c'est lui qui valide ou
// rejette.
//
// La révision porte sur un TEXTE : l'empreinte du texte soumis est mémorisée.
// Si l'acte est réécrit après coup — ici même, par le réviseur qui corrige une
// faute de frappe — l'empreinte le dit.
// ============================================================================
import { state, navigate, redrawView, can, trameById, fileRevision, peutTrancher, actePubliable } from "../state.js";
import { h, button } from "../dom.js";
import { emptyState, helpLink } from "../components.js";
import { targetLabel } from "../../lib/scope.js";
import { etatRevision } from "../../lib/revision.js";
import { rapportConformite } from "../../lib/conformite.js";
import { carteRapport, carteDecision, carteDossierRevision } from "../revision-cartes.js";
import { docOfActe } from "./modifier.js";

const TABS = [
  { id: "aReviser", label: "À réviser par moi" },
  { id: "attente", label: "En attente d'un autre réviseur" },
  { id: "valides", label: "Révisés" },
  { id: "rejets", label: "Rejetés" },
];

export function renderRevision(root) {
  const ui = (state.revision = state.revision || { tab: "aReviser", acteId: "" });
  const config = state.config;
  const file = fileRevision();
  const liste = file[ui.tab] || [];
  if (!ui.acteId || !liste.some((a) => a.id === ui.acteId)) ui.acteId = liste[0]?.id || "";
  const acte = liste.find((a) => a.id === ui.acteId) || null;
  const paint = () => redrawView();

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Révision" }),
      h("p", { class: "page-head__sub", text: "Le contrôle des actes avant leur signature. Le réviseur reçoit un rapport de conformité, peut corriger l'acte, le valider — il part alors en signature — ou le rejeter, et l'acte revient en brouillon chez son rédacteur avec le motif." }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("revision", "Comment faire ?"),
      button("Registre des actes", { variant: "secondary", icon: "list", onClick: () => navigate("actes") }),
    ),
  ));

  root.appendChild(h("div", { class: "parapheur-resume" },
    resume((file.aReviser || []).length, "à réviser par moi", "primary"),
    resume((file.attente || []).length, "en attente d'un autre réviseur", "info"),
    resume((file.valides || []).length, "révisés, prêts à signer", "success"),
    resume((file.rejets || []).length, "rejetés, revenus en brouillon", "warning"),
  ));

  const tabs = h("div", { class: "fr-tabs" });
  for (const t of TABS) {
    const n = (file[t.id] || []).length;
    tabs.appendChild(h("button", {
      class: "fr-tab" + (ui.tab === t.id ? " fr-tab--active" : ""),
      text: t.label + (n ? ` (${n})` : ""),
      onClick: () => { ui.tab = t.id; ui.acteId = ""; paint(); },
    }));
  }
  root.appendChild(tabs);

  const grid = h("div", { class: "parapheur-grid" });
  const left = h("div", { class: "fr-stack" });
  const right = h("div", { class: "fr-stack" });
  grid.appendChild(left);
  grid.appendChild(right);
  root.appendChild(grid);

  if (!liste.length) {
    left.appendChild(emptyState(videDe(ui.tab), button("Voir le registre", { variant: "secondary", onClick: () => navigate("actes") })));
    return;
  }

  left.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: TABS.find((t) => t.id === ui.tab).label }),
    h("p", { class: "fr-small fr-muted", text: liste.length + " acte(s)" }),
  ));
  const listBox = h("div", { class: "sig-list" });
  left.appendChild(listBox);
  for (const a of liste) {
    const etat = etatRevision(a) || {};
    listBox.appendChild(h("button", {
      class: "sig-item" + (a.id === acte?.id ? " is-on" : "") + (peutTrancher(a) ? " is-todo" : ""),
      onClick: () => { ui.acteId = a.id; paint(); },
    },
      h("span", { class: "sig-item__num fr-mono", text: a.numero || "sans n°" }),
      h("span", { class: "sig-item__obj", text: a.objet || docOfActe(a)?.meta?.objet || "—" }),
      h("span", { class: "fr-badge fr-badge--" + (etat.caduque ? "warning" : etat.color || "info"), text: etat.caduque ? "caduque" : etat.label || "—" }),
      peutTrancher(a) ? h("span", { class: "fr-badge fr-badge--brand", text: "à moi" }) : null,
    ));
  }

  if (acte) right.appendChild(carteActe(acte, paint));
}

function resume(n, label, color) {
  return h("div", { class: "parapheur-resume__item" + (n && color === "primary" ? " is-hot" : "") },
    h("strong", { text: String(n) }),
    h("span", { text: label }));
}

function videDe(tab) {
  if (tab === "aReviser") return "Rien ne vous attend : aucun acte de votre compétence n'attend votre contrôle.";
  if (tab === "attente") return "Aucun acte en attente d'un autre réviseur.";
  if (tab === "valides") return "Aucun acte révisé en attente de signature.";
  return "Aucun acte rejeté. Les rejets restent ici : le motif et le dossier disent ce qui a été demandé.";
}

// --------------------------------------------------------------------------
function carteActe(a, paint) {
  const config = state.config;
  const trame = trameById(a.trameId);
  const doc = docOfActe(a);
  const etat = etatRevision(a) || {};
  const r = a.revision || {};
  const rapport = doc ? rapportConformite(doc, { config, trame, acte: a, publiable: actePubliable(a) }) : null;
  const box = h("div", { class: "fr-stack" });

  box.appendChild(h("div", { class: "fr-card" },
    h("div", { class: "fr-row" },
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 },
        text: (a.numero || "acte sans numéro") + " — " + (a.objet || doc?.meta?.objet || "") }),
      h("span", { class: "fr-badge fr-badge--" + (etat.caduque ? "warning" : etat.color || "info"), text: etat.caduque ? "révision caduque" : etat.label || "—" }),
    ),
    h("p", { class: "fr-small fr-muted", text: [
      trame?.name || "trame absente",
      a.serviceId ? targetLabel(config, a.serviceId, a.bureauId) : "acte général",
      a.createdByName ? "rédigé par " + a.createdByName : "",
    ].filter(Boolean).join(" · ") }),
    h("div", { class: "fr-row" },
      button("Voir l'acte", { variant: "tertiary", size: "sm", icon: "eye", onClick: () => navigate("acte/" + a.id) }),
      can("actes.rediger") ? button("Ouvrir en rédaction (corriger)", { variant: "tertiary", size: "sm", icon: "note", onClick: () => { state.ui = { ...(state.ui || {}), openActeId: a.id }; navigate("rediger/" + a.trameId); } }) : null,
      can("actes.signer") && r.statut === "valide" ? button("Suite du circuit", { variant: "tertiary", size: "sm", icon: "lock", onClick: () => { state.signature = { tab: "circuit", acteId: a.id }; navigate("signature"); } }) : null,
    ),
  ));

  // ------------------------------------------------ la trace de la révision
  box.appendChild(carteDossierRevision(a, etat));

  // ------------------------------------------------------- rapport
  if (rapport) box.appendChild(carteRapport(rapport));

  // ------------------------------------------------------- décision
  if (r.statut === "en_attente" && peutTrancher(a)) box.appendChild(carteDecision(a, rapport));
  else if (r.statut === "en_attente") {
    box.appendChild(h("div", { class: "fr-card fr-card--soft" },
      h("p", { class: "fr-small", text: "L'acte attend la décision d'un autre réviseur compétent. Vous n'êtes pas compétent pour celui-ci (ou vous n'avez pas la qualité de réviseur)." })));
  }
  return box;
}
