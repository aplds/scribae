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
import { state, navigate, redrawView, can, trameById, fileRevision, fileCertification, peutTrancher, peutCertifier, actePubliable, estCircuitExterne, versionSigneeDeActe, certificationDeActeExterne } from "../state.js";
import { h, button } from "../dom.js";
import { emptyState, helpLink } from "../components.js";
import { targetLabel } from "../../lib/scope.js";
import { etatRevision } from "../../lib/revision.js";
import { rapportConformite } from "../../lib/conformite.js";
import { carteRapport, carteDecision, carteDossierRevision } from "../revision-cartes.js";
import { docOfActe } from "./modifier.js";
import { voirVersionSignee, certifierConformite } from "./signature.js";
import { formatDate } from "../../lib/util.js";
import { empreinteTexte } from "../../lib/validation.js";

const TABS = [
  { id: "aReviser", label: "À réviser par moi" },
  { id: "attente", label: "En attente d'un autre réviseur" },
  { id: "valides", label: "Révisés" },
  { id: "rejets", label: "Rejetés" },
  // Le circuit EXTERNE a son propre contrôle : le réviseur certifie la
  // conformité de la PIÈCE signée avec la version numérique qui sera publiée.
  { id: "certifications", label: "Certifications (signature externe)" },
];

export function renderRevision(root) {
  const ui = (state.revision = state.revision || { tab: "aReviser", acteId: "" });
  const config = state.config;
  const cert = fileCertification();
  const file = { ...fileRevision(), certifications: [...cert.aCertifier, ...cert.attente] };
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
    (file.certifications || []).length ? resume(file.certifications.length, "conformité(s) à certifier (signature externe)", "warning") : null,
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
    const externe = estCircuitExterne(a) && versionSigneeDeActe(a);
    const etat = etatRevision(a) || {};
    const cert = certificationDeActeExterne(a) || {};
    const badge = externe
      ? (cert.statut === "conforme" ? ["success", "conformité certifiée"] : cert.statut === "non_conforme" ? ["error", "conformité refusée"] : ["warning", "à certifier"])
      : [etat.caduque ? "warning" : etat.color || "info", etat.caduque ? "caduque" : etat.label || "—"];
    listBox.appendChild(h("button", {
      class: "sig-item" + (a.id === acte?.id ? " is-on" : "") + ((externe ? peutCertifier(a) : peutTrancher(a)) ? " is-todo" : ""),
      onClick: () => { ui.acteId = a.id; paint(); },
    },
      h("span", { class: "sig-item__num fr-mono", text: a.numero || "sans n°" }),
      h("span", { class: "sig-item__obj", text: a.objet || docOfActe(a)?.meta?.objet || "—" }),
      h("span", { class: "fr-badge fr-badge--" + badge[0], text: badge[1] }),
      (externe ? peutCertifier(a) : peutTrancher(a)) ? h("span", { class: "fr-badge fr-badge--brand", text: "à moi" }) : null,
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
  if (tab === "certifications") return "Aucune version signée n'attend de certification : aucun acte du circuit externe n'est déposé, ou toutes les conformités sont acquises.";
  return "Aucun acte rejeté. Les rejets restent ici : le motif et le dossier disent ce qui a été demandé.";
}

// La carte d'une CERTIFICATION DE CONFORMITÉ (circuit externe). Le réviseur a
// sous les yeux la pièce signée déposée — le PDF — et la version numérique ; il
// atteste que les deux concordent. C'est le contrôle qui remplace, dans ce
// circuit, la révision d'avant signature.
function carteCertification(a, doc, paint) {
  const config = state.config;
  const trame = trameById(a.trameId);
  const sg = versionSigneeDeActe(a) || {};
  const cert = certificationDeActeExterne(a) || {};
  const rapport = doc ? rapportConformite(doc, { config, trame, acte: a, publiable: actePubliable(a) }) : null;
  const box = h("div", { class: "fr-stack" });
  const badge = cert.statut === "conforme" ? ["success", "conformité certifiée"] : cert.statut === "non_conforme" ? ["error", "conformité refusée"] : ["warning", "à certifier"];
  box.appendChild(h("div", { class: "fr-card" },
    h("div", { class: "fr-row" },
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: (a.numero || "acte sans numéro") + " — " + (a.objet || doc?.meta?.objet || "") }),
      h("span", { class: "fr-badge fr-badge--" + badge[0], text: badge[1] })),
    h("p", { class: "fr-small fr-muted", text: [trame?.name || "trame absente", "signé hors application (circuit externe)", a.serviceId ? targetLabel(config, a.serviceId, a.bureauId) : "acte général"].filter(Boolean).join(" · ") }),
    h("p", { class: "fr-small", text: "Cet acte a été signé HORS de l'application. Votre contrôle ne porte pas sur le texte avant signature : il porte sur la PIÈCE signée déposée, que vous comparez à la version numérique qui sera publiée." }),
    h("div", { class: "fr-row" },
      button("Voir la version signée (PDF)", { variant: "primary", icon: "lock", onClick: () => voirVersionSignee(a) }),
      button("Voir la version numérique", { variant: "secondary", icon: "note", onClick: () => navigate("acte/" + a.id) }),
      can("actes.rediger") ? button("Ouvrir en rédaction", { variant: "tertiary", size: "sm", icon: "edit", onClick: () => { state.ui = { ...(state.ui || {}), openActeId: a.id }; navigate("rediger/" + a.trameId); } }) : null)));

  const dl = h("dl", { class: "recueil-dl" });
  const ligne = (k, v) => { if (v === undefined || v === null || v === "") return; dl.appendChild(h("dt", { text: k })); dl.appendChild(h("dd", { text: String(v) })); };
  ligne("Fichier signé", sg.nom);
  ligne("Déposé le", sg.deposeLe ? new Date(sg.deposeLe).toLocaleString("fr-FR") : "");
  ligne("Déposé par", sg.deposeParNom);
  ligne("Empreinte SHA-256 de la pièce signée", sg.sha256);
  ligne("Empreinte du texte (version numérique)", cert.empreinte || empreinteTexte(a) || "—");
  box.appendChild(h("div", { class: "fr-card fr-card--soft" },
    h("h3", { class: "fr-card__title", text: "La pièce signée" }),
    dl));

  if (cert.statut === "conforme" || cert.statut === "non_conforme") {
    box.appendChild(h("div", { class: "fr-alert fr-alert--" + (cert.statut === "conforme" ? "success" : "error") },
      h("p", { class: "fr-alert__title", text: cert.statut === "conforme" ? "Conformité certifiée" : "Conformité refusée" }),
      h("p", { class: "fr-small", text: [cert.parNom ? "Par " + cert.parNom : "", cert.le ? "le " + formatDate(String(cert.le).slice(0, 10)) : ""].filter(Boolean).join(" · ") }),
      cert.motif ? h("p", { class: "fr-small", text: "Motif : " + cert.motif }) : null,
      cert.remarque && cert.remarque !== cert.motif ? h("p", { class: "fr-small fr-muted", text: "Observation : " + cert.remarque }) : null));
  }

  if (cert.statut !== "conforme") {
    if (peutCertifier(a)) {
      box.appendChild(h("div", { class: "fr-card" },
        h("h3", { class: "fr-card__title", text: "Votre décision" }),
        h("p", { class: "fr-small fr-muted", text: "Ouvrez la pièce signée, comparez-la à la version numérique, puis certifiez la conformité — ou refusez-la, en disant ce qui ne concorde pas (l'acte attendra alors une version signée conforme)." }),
        h("div", { class: "fr-row" },
          button("Certifier la conformité…", { variant: "primary", icon: "check", onClick: () => certifierConformite(a, doc, { docs: new Map([[a.id, doc]]), paint }) }))));
    } else {
      box.appendChild(h("div", { class: "fr-card fr-card--soft" },
        h("p", { class: "fr-small", text: "La version signée attend la décision d'un autre réviseur compétent : vous n'êtes pas compétent pour cet acte (ou vous n'avez pas la qualité de réviseur)." })));
    }
  }

  if (rapport) box.appendChild(carteRapport(rapport));
  return box;
}

// --------------------------------------------------------------------------
function carteActe(a, paint) {
  const config = state.config;
  const trame = trameById(a.trameId);
  const doc = docOfActe(a);
  // Circuit EXTERNE : le contrôle du réviseur porte sur la pièce signée, non
  // sur le texte avant signature. La carte est celle de la certification de
  // conformité.
  if (estCircuitExterne(a) && versionSigneeDeActe(a)) return carteCertification(a, doc, paint);
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
