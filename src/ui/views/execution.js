// ============================================================================
// Exécution & délais — l'échéancier des formalités.
//
// Un acte signé n'est pas encore exécutoire. Il le devient quand la dernière
// formalité REQUISE est accomplie : transmission au contrôle de légalité,
// publication au recueil, notification aux intéressés — les trois ne se
// cumulent pas de la même façon selon la nature de l'acte (voir
// src/lib/execution.js). C'est de cette date, et non de la signature, que court
// le délai de recours.
//
// Cet écran est le tableau de bord de cette mécanique : ce qui reste à faire,
// ce qui traîne, et jusqu'à quand un acte peut être contesté. Enregistrer une
// formalité est une CONSTATATION : l'application ne peut pas savoir seule qu'un
// courrier est parti, c'est l'agent qui l'atteste, avec sa référence.
//
// Deux autres gestes s'y font, qui portent sur le même dossier :
//   • noter l'existence d'un RECOURS, avec sa date d'introduction — elle ferme
//     le délai, et l'acte reste contesté jusqu'à la décision du juge ;
//   • DÉLIVRER une pièce : l'état des formalités (pour tout acte), et
//     l'attestation de non-recours (pour un acte définitif que personne n'a
//     contesté). Voir src/lib/execution-documents.js.
// ============================================================================
import {
  state, touch, navigate, redrawView, can, visibleActes,
  actePubliable, trameById, alertesDe, journaliser,
} from "../state.js";
import { h, button, toast } from "../dom.js";
import { emptyState, helpLink } from "../components.js";
import { formatDate } from "../../lib/util.js";
import { targetLabel } from "../../lib/scope.js";
import {
  formalites, statutExecution, dateExecutoire, dateLimiteRecours, delais,
  ecartJours, aujourdhui, recoursDe, recoursTypeLabel,
} from "../../lib/execution.js";
import { etatFormalitesHtml, attestationNonRecoursHtml } from "../../lib/execution-documents.js";
import { printHtml } from "../../lib/export.js";
import { ouvrirFormulaireFormalite, ouvrirFormulaireRecours } from "../execution-actions.js";
import { docOfActe } from "./modifier.js";

const TABS = [
  { id: "faire", label: "Formalités à accomplir" },
  { id: "recours", label: "Recours" },
  { id: "definitifs", label: "Définitifs" },
  { id: "tous", label: "Tous les actes signés" },
];

export function renderExecution(root, params) {
  const ui = (state.execution = state.execution || { tab: "faire", acteId: "" });
  const config = state.config;
  const d = delais(config);
  const signes = visibleActes().filter((a) => a.original || a.statut === "signee" || a.statut === "publie");

  const fiche = (a) => {
    const opts = { publiable: actePubliable(a), trame: trameById(a.trameId) };
    return { opts, st: statutExecution(a, config, opts), alertes: alertesDe(a) };
  };
  const tout = signes.map((a) => ({ a, ...fiche(a) })).sort((x, y) => String(y.a.dateSignature || "").localeCompare(String(x.a.dateSignature || "")));
  const listes = {
    faire: tout.filter((x) => x.st.code === "en_attente"),
    // L'onglet « Recours » réunit les deux temps du contentieux : le délai qui
    // court encore, et le recours déjà introduit. On y constate l'un comme
    // l'autre — et c'est de là que part l'attestation de non-recours, quand le
    // délai est échu sans qu'aucun recours n'ait été enregistré.
    recours: tout.filter((x) => x.st.code === "executoire" || x.st.code === "recours"),
    definitifs: tout.filter((x) => x.st.code === "definitif"),
    tous: tout,
  };
  const liste = listes[ui.tab] || [];
  if (!ui.acteId || !liste.some((x) => x.a.id === ui.acteId)) ui.acteId = liste[0]?.a.id || "";
  const courant = liste.find((x) => x.a.id === ui.acteId) || null;
  const paint = () => redrawView();

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Exécution & délais" }),
      h("p", { class: "page-head__sub", text: "Ce qui reste à faire pour qu'un acte devienne exécutoire, et jusqu'à quand il peut être contesté. Le délai de recours court à compter de l'exécutoire, pas de la signature." }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("execution", "Comment faire ?"),
      can("referentiel.gerer") ? button("Régler les délais", { variant: "tertiary", icon: "gear", onClick: () => { state.ui = { ...(state.ui || {}), refTab: "delais" }; navigate("referentiel"); } }) : null,
      button("Registre des actes", { variant: "secondary", icon: "list", onClick: () => navigate("actes") }),
    ),
  ));

  root.appendChild(h("p", { class: "fr-small fr-muted", style: { marginTop: "-6px" },
    text: `Délais en vigueur : recours contentieux ${d.recoursMois} mois · transmission souhaitée sous ${d.transmissionJours} jours · publication sous ${d.publicationJours} jours · notification sous ${d.notificationJours} jours.` }));

  const recoursOuverts = tout.filter((x) => x.st.code === "executoire").length;
  const recoursIntroduits = tout.filter((x) => x.st.code === "recours").length;
  root.appendChild(h("div", { class: "parapheur-resume" },
    resume(listes.faire.length, "formalités en attente", "primary"),
    resume(recoursOuverts, recoursOuverts > 1 ? "recours ouverts" : "recours ouvert", "info"),
    resume(recoursIntroduits, recoursIntroduits > 1 ? "recours introduits" : "recours introduit", "warning"),
    resume(listes.definitifs.length, "définitifs", "success"),
    resume(tout.length, "actes signés", ""),
  ));

  const tabs = h("div", { class: "fr-tabs" });
  for (const t of TABS) {
    const n = (listes[t.id] || []).length;
    tabs.appendChild(h("button", {
      class: "fr-tab" + (ui.tab === t.id ? " fr-tab--active" : ""),
      text: t.label + (n ? ` (${n})` : ""),
      onClick: () => { ui.tab = t.id; ui.acteId = ""; paint(); },
    }));
  }
  root.appendChild(tabs);

  const grid = h("div", { class: "parapheur-grid" });
  root.appendChild(grid);
  const left = h("div", { class: "fr-stack" });
  const right = h("div", { class: "fr-stack" });
  grid.appendChild(left);
  grid.appendChild(right);

  if (!tout.length) {
    left.appendChild(emptyState("Aucun acte signé pour l'instant : l'échéancier se remplit à partir du moment où un acte est signé."));
    return;
  }
  if (!liste.length) {
    left.appendChild(emptyState("Rien dans cette liste."));
    return;
  }

  const listBox = h("div", { class: "sig-list" });
  left.appendChild(listBox);
  for (const x of liste) {
    const alerte = x.alertes.find((al) => al.niveau === "error") || x.alertes[0];
    listBox.appendChild(h("button", {
      class: "sig-item" + (x.a.id === courant?.a.id ? " is-on" : "") + (alerte && alerte.niveau === "error" ? " is-todo" : ""),
      onClick: () => { ui.acteId = x.a.id; paint(); },
    },
      h("span", { class: "sig-item__num fr-mono", text: x.a.numero || "sans n°" }),
      h("span", { class: "sig-item__obj", text: x.a.objet || docOfActe(x.a)?.meta?.objet || "—" }),
      h("span", { class: "fr-badge fr-badge--" + x.st.color, text: x.st.label }),
      alerte ? h("span", { class: "fr-badge fr-badge--" + (alerte.niveau === "error" ? "error" : alerte.niveau === "warning" ? "warning" : "info"), text: alerte.niveau === "info" ? "i" : "!" }) : null,
    ));
  }

  if (courant) right.appendChild(ficheActe(courant, paint));
}

function resume(n, label, color) {
  return h("div", { class: "parapheur-resume__item" + (n && color === "primary" ? " is-hot" : "") },
    h("strong", { text: String(n) }),
    h("span", { text: label }));
}

// --------------------------------------------------------------------------
function ficheActe({ a, st, alertes, opts }, paint) {
  const config = state.config;
  const box = h("div", { class: "fr-stack" });
  const exe = dateExecutoire(a, opts);
  const limite = dateLimiteRecours(a, config, opts);
  const jours = limite ? ecartJours(aujourdhui(), limite) : null;

  box.appendChild(h("div", { class: "fr-card" },
    h("div", { class: "fr-row" },
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: (a.numero || "acte sans numéro") + " — " + (a.objet || "") }),
      h("span", { class: "fr-badge fr-badge--" + st.color, text: st.label })),
    h("p", { class: "fr-small fr-muted", text: [
      trameById(a.trameId)?.name || "",
      a.serviceId ? targetLabel(config, a.serviceId, a.bureauId) : "acte général",
      a.original ? "signé le " + formatDate(String(a.signeLe || a.dateSignature || "").slice(0, 10)) : "",
    ].filter(Boolean).join(" · ") }),
    exe
      ? h("p", { class: "fr-small" }, h("strong", { text: "Exécutoire le " + formatDate(exe) + ". " }),
        st.recours
          ? `${recoursTypeLabel(st.recours.type) || "Recours"} introduit le ${formatDate(st.recours.introduitLe)} : le délai de recours contentieux est clos, l'acte est contesté.`
          : limite ? `Délai de recours contentieux : ${jours >= 0 ? jours + " jour(s) restant(s)" : "échu depuis " + Math.abs(jours) + " jour(s)"} (jusqu'au ${formatDate(limite)}).` : "")
      : h("p", { class: "fr-small fr-muted", text: st.code === "document"
        ? "Document non juridique : publié au recueil, il ne fait pas droit — aucune opposabilité, aucun délai de recours."
        : "L'acte n'est pas encore exécutoire : au moins une formalité requise manque." }),
    h("div", { class: "fr-row" },
      button("Voir l'acte", { variant: "tertiary", size: "sm", icon: "eye", onClick: () => navigate("acte/" + a.id) }),
      can("actes.gerer") ? button("Modifier", { variant: "tertiary", size: "sm", icon: "refresh", onClick: () => import("./modifier.js").then((m) => m.modifierFromActe(a)) }) : null,
    ),
  ));

  if (alertes.length) {
    box.appendChild(h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: "Alertes" }),
      ...alertes.map((al) => h("p", { class: "fr-small exec-alerte exec-alerte--" + al.niveau, text: "• " + al.message })),
    ));
  }

  // ------------------------------------------------------ les formalités
  const form = formalites(a, opts);
  box.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Formalités" }),
    h("p", { class: "fr-small fr-muted", text: "Une formalité « requise » conditionne le caractère exécutoire. Une formalité non requise peut tout de même être enregistrée : elle est alors conservée au dossier, sans bloquer l'acte." }),
    h("div", { class: "exec-formalites" }, ...form.map((f) => ligne(a, f, paint))),
    // L'état des formalités se délivre pour TOUT acte signé, quel que soit son
    // état : c'est la pièce de suivi du dossier, celle qu'on classe ou qu'on
    // joint à une demande de subvention.
    h("div", { class: "fr-row", style: { marginTop: "10px" } },
      button("État des formalités (PDF)", {
        variant: "tertiary", size: "sm", icon: "download",
        title: "Le détail des formalités et de leurs dates, sur une page à imprimer ou à enregistrer en PDF",
        onClick: () => delivrerPiece(a, opts, "etat"),
      }),
      h("span", { class: "fr-small fr-muted", text: "Le détail des formalités et de leurs dates, prêt à classer au dossier." })),
  ));

  // ---------------------------------------------------------- le recours
  if (["executoire", "recours", "definitif"].includes(st.code)) {
    box.appendChild(carteRecours(a, st, opts, paint));
  }

  box.appendChild(h("div", { class: "fr-card fr-card--soft" },
    h("h3", { class: "fr-card__title", text: "À quoi sert cet écran" }),
    h("p", { class: "fr-small", text: st.code === "document"
      ? "Un document qui ne fait pas droit — verbatim de séance, déclaration, vœu — se publie pour être donné à lire : aucune formalité ne conditionne son opposabilité, puisqu'il n'en a pas, et aucun délai de recours ne court à son encontre."
      : "La transmission au contrôle de légalité fait courir le délai de deux mois du représentant de l'État. La publication rend l'acte opposable aux tiers. La notification le rend opposable à la personne concernée." }),
    h("p", { class: "fr-small fr-muted", text: "L'application ne peut pas savoir seule qu'un courrier est parti : chaque formalité est une constatation, horodatée et signée de son auteur, conservée au journal." }),
  ));
  return box;
}

// --------------------------------------------------------------- le recours
// Un acte exécutoire peut être contesté, et l'administration apprend le recours
// par la pièce qu'elle reçoit. C'est ce fait qu'on note ici — sa date
// d'introduction est celle qui ferme le délai de recours contentieux. Un acte
// définitif, lui, n'a fait l'objet d'aucun recours : c'est ce que l'attestation
// de non-recours certifie, et c'est pourquoi elle ne se délivre que là.
function carteRecours(a, st, opts, paint) {
  const rec = st.recours || recoursDe(a);
  const jours = st.limite ? ecartJours(aujourdhui(), st.limite) : null;
  const peutConstater = can("signature.gerer") || can("actes.gerer");
  const box = h("div", { class: "fr-card" });

  box.appendChild(h("div", { class: "fr-row" },
    h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: "Recours" }),
    h("span", {
      class: "fr-badge fr-badge--" + (rec ? "warning" : st.code === "definitif" ? "success" : "info"),
      text: rec ? "Recours introduit" : st.code === "definitif" ? "Aucun recours" : "Délai ouvert",
    })));

  if (rec) {
    box.appendChild(h("p", { class: "fr-small" },
      h("strong", { text: (recoursTypeLabel(rec.type) || "Recours") + " introduit le " + formatDate(rec.introduitLe) + ". " }),
      "Le délai de recours contentieux est clos depuis cette introduction : l'acte est contesté, et il le reste jusqu'à la décision du juge."));
    box.appendChild(h("p", { class: "fr-small fr-muted", text: [
      rec.demandeur ? "auteur : " + rec.demandeur : "",
      rec.ref ? "réf. " + rec.ref : "",
      rec.byName ? "mentionné par " + rec.byName : "",
      rec.enregistreLe ? "noté le " + formatDate(String(rec.enregistreLe).slice(0, 10)) : "",
    ].filter(Boolean).join(" · ") }));
    if (rec.note) box.appendChild(h("p", { class: "fr-small exec-observation", text: "« " + rec.note + " »" }));
    box.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucune attestation de non-recours ne peut être délivrée : elle certifie qu'il n'y a pas eu de recours." }));
    if (peutConstater) {
      box.appendChild(h("div", { class: "fr-row" },
        button("Corriger la mention", { variant: "tertiary", size: "sm", icon: "refresh", onClick: () => ouvrirFormulaireRecours(a, { paint }) })));
    }
    return box;
  }

  if (st.code === "executoire") {
    box.appendChild(h("p", { class: "fr-small", text: `Le délai de recours contentieux court jusqu'au ${formatDate(st.limite)} (${jours} jour(s) restant(s)).` }));
    box.appendChild(h("p", { class: "fr-small fr-muted", text: "Si un recours est introduit contre l'acte — requête au tribunal, déféré du préfet, recours gracieux —, notez-le : c'est la date d'introduction qui ferme le délai." }));
    if (peutConstater) {
      box.appendChild(h("div", { class: "fr-row" },
        button("Enregistrer un recours", { variant: "secondary", size: "sm", icon: "note", onClick: () => ouvrirFormulaireRecours(a, { paint }) })));
    }
    return box;
  }

  box.appendChild(h("p", { class: "fr-small", text: `Le délai de recours contentieux a expiré le ${formatDate(st.limite)} sans qu'aucun recours n'ait été enregistré : l'acte est définitif.` }));
  box.appendChild(h("p", { class: "fr-small fr-muted", text: "Une attestation de non-recours peut être délivrée à un tiers qui en fait la demande — pour un dossier de subvention, une vente, un contentieux qui l'exige." }));
  if (peutConstater) {
    box.appendChild(h("div", { class: "fr-row" },
      button("Attestation de non-recours (PDF)", {
        variant: "secondary", size: "sm", icon: "download",
        title: "Attester qu'aucun recours n'a été introduit contre cet acte",
        onClick: () => delivrerPiece(a, opts, "attestation"),
      }),
      button("Un recours a été introduit", { variant: "tertiary", size: "sm", icon: "note", onClick: () => ouvrirFormulaireRecours(a, { paint }) })));
  }
  return box;
}

// ------------------------------------------------------------------- pièces
// Délivrer une pièce de l'exécution (l'état des formalités, ou l'attestation de
// non-recours) : elle s'ouvre dans un onglet d'impression, d'où l'agent
// l'imprime ou l'enregistre en PDF. La délivrance entre au journal : une pièce
// sortie du registre est un fait du dossier, comme la constatation d'une
// formalité — on doit pouvoir dire qui l'a produite et quand.
const nomUtilisateur = (u) => (u ? [u.firstName, u.lastName].filter(Boolean).join(" ") : "");

async function delivrerPiece(a, opts, kind) {
  const config = state.config;
  const doc = docOfActe(a);
  const qui = nomUtilisateur(state.user);
  const args = { acte: a, doc, config, opts, qui };
  const html = kind === "etat" ? etatFormalitesHtml(args) : attestationNonRecoursHtml(args);
  const mode = printHtml(html, { titre: `${kind === "etat" ? "etat-des-formalites" : "attestation-de-non-recours"}-${a.numero || a.id}.html` });
  if (mode !== "onglet") {
    toast(mode === "telechargement"
      ? "Le navigateur n'a pas ouvert d'onglet : la pièce a été téléchargée — ouvrez-la et imprimez-la (Ctrl+P)."
      : "L'impression n'a pas pu être lancée : autorisez les fenêtres surgissantes pour ce site.", "warning");
  }
  await journaliser({
    action: kind === "etat" ? "document.etat_formalites" : "document.attestation_non_recours",
    cible: "acte", cibleLabel: a.numero || a.id, acteId: a.id,
    detail: kind === "etat"
      ? "état des formalités délivré" + (opts?.publiable === false ? " (acte individuel)" : "")
      : "attestation de non-recours délivrée",
    to: [a.createdBy || "", "role:editeur"].filter(Boolean),
  });
}

// --------------------------------------------------------------------------
function ligne(a, f, paint) {
  const info = f.fait ? "success" : f.requis ? "warning" : "info";
  const etiquette = f.fait ? "Accomplie" : f.requis ? "À accomplir" : "Facultative";
  return h("div", { class: "exec-formalite" + (f.fait ? " is-done" : "") },
    h("div", { class: "exec-formalite__head" },
      h("strong", { text: f.label }),
      h("span", { class: "fr-badge fr-badge--" + info, text: etiquette }),
    ),
    f.fait
      ? h("p", { class: "fr-small", text: [
        "le " + formatDate(f.at),
        f.ref ? "réf. " + f.ref : "",
        f.parEli ? "constatée par la chaîne ELI" : "",
        f.byName ? "par " + f.byName : "",
        f.destinataires ? "destinataires : " + f.destinataires : "",
      ].filter(Boolean).join(" · ") })
      : h("p", { class: "fr-small fr-muted", text: f.id === "signature" ? "L'acte n'est pas signé." : "Aucune constatation enregistrée." }),
    // Certificat informatique de transmission : déposé sur le document par
    // l'API d'envoi du contrôle de légalité (voir src/lib/legalite.js).
    f.certificat ? h("p", { class: "fr-small exec-certificat" },
      h("strong", { text: "Certificat de transmission" }),
      h("span", { text: f.certificat.mention || "" }),
      h("span", { class: "fr-muted", text: [
        f.certificat.reference ? " · réf. " + f.certificat.reference : "",
        f.certificat.sceau ? " · sceau " + String(f.certificat.sceau).slice(0, 16) + "…" : "",
      ].filter(Boolean).join("") })) : null,
    !["signature", "publication"].includes(f.id) || (f.id === "publication" && !f.parEli)
      ? h("div", { class: "fr-row" },
        can("signature.gerer") || can("actes.gerer")
          ? button(f.fait ? "Corriger" : "Enregistrer", {
            variant: f.fait ? "tertiary" : "secondary", size: "sm", icon: f.fait ? "refresh" : "check",
            onClick: () => ouvrirFormulaireFormalite(a, f),
          })
          : null)
      : null,
  );
}

