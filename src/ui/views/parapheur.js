// ============================================================================
// Parapheur — le circuit de validation des actes.
//
// Avant d'être signé, un acte passe par un CIRCUIT : les étapes définies dans le
// référentiel (Administration › Circuits de validation), chacune confiée à un rôle.
// Cet écran est le bureau du valideur : ce qui m'attend, ce qui attend un autre,
// ce qui est prêt à partir en signature.
//
// Le circuit est SÉQUENTIEL — on ne passe pas au visa de la direction avant le
// bon pour accord du chef de service — et il porte sur un TEXTE : l'empreinte du
// texte validé est mémorisée. Si l'acte est réécrit après coup, la validation
// devient caduque et l'écran le dit, plutôt que de laisser signer autre chose
// que ce qui a été approuvé.
// ============================================================================
import {
  state, navigate, redrawView, can, circuitDe, parapheur as fileParapheur, trameById, etapeAParachever,
} from "../state.js";
import { h, button } from "../dom.js";
import { emptyState, helpLink } from "../components.js";
import { formatDate } from "../../lib/util.js";
import { targetLabel } from "../../lib/scope.js";
import {
  etapeActive, validationAJour, avancement, ETAPE_STATUTS, VALIDATION_STATUTS, etiquetteEtape, STEP_ROLES,
} from "../../lib/validation.js";
import { soumettreCircuit, reprendreCircuit, carteDecision } from "../parapheur-actions.js";
import { docOfActe } from "./modifier.js";

// Les identifiants d'onglet SONT les clés de la file rendue par `parapheur()`
// (src/ui/state.js) : un seul vocabulaire, donc pas de risque de décalage.
const TABS = [
  { id: "aMoi", label: "À valider par moi" },
  { id: "enCours", label: "En cours" },
  { id: "valides", label: "Validés" },
  { id: "rejets", label: "Renvoyés ou refusés" },
];

export function renderParapheur(root, params) {
  const ui = (state.parapheur = state.parapheur || { tab: "aMoi", acteId: "" });
  const config = state.config;
  const file = fileParapheur();
  const liste = file[ui.tab] || [];
  if (!ui.acteId || !liste.some((a) => a.id === ui.acteId)) ui.acteId = liste[0]?.id || "";
  const acte = liste.find((a) => a.id === ui.acteId) || null;
  const paint = () => redrawView();

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Parapheur" }),
      h("p", { class: "page-head__sub", text: "Le circuit de validation des actes : chaque étape est une vérification, un visa ou la signature, confiée à un rôle du référentiel. En principe, le circuit s'ouvre par une vérification du réviseur, et se clôt par la signature. Tant que le circuit n'est pas achevé, l'acte ne part pas en signature." }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("parapheur", "Comment faire ?"),
      button("Registre des actes", { variant: "secondary", icon: "list", onClick: () => navigate("actes") }),
    ),
  ));

  // Bandeau de synthèse : ce qui m'attend compte avant tout le reste.
  root.appendChild(h("div", { class: "parapheur-resume" },
    resume((file.aMoi || []).length, "à valider par moi", "primary"),
    resume((file.enCours || []).length, "en attente d'un autre valideur", "info"),
    resume((file.valides || []).length, "validés, prêts à signer", "success"),
    resume((file.rejets || []).length, "renvoyés ou refusés", "warning"),
    resume((file.horsCircuit || []).length, "hors circuit", ""),
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
  root.appendChild(grid);
  const left = h("div", { class: "fr-stack" });
  const right = h("div", { class: "fr-stack" });
  grid.appendChild(left);
  grid.appendChild(right);

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
    const mine = !!etapeMienne(a);
    const v = a.validation;
    const etat = v ? (VALIDATION_STATUTS[v.statut] || {}) : {};
    listBox.appendChild(h("button", {
      class: "sig-item" + (a.id === acte?.id ? " is-on" : "") + (mine ? " is-todo" : ""),
      onClick: () => { ui.acteId = a.id; paint(); },
    },
      h("span", { class: "sig-item__num fr-mono", text: a.numero || "sans n°" }),
      h("span", { class: "sig-item__obj", text: a.objet || docOfActe(a)?.meta?.objet || "—" }),
      h("span", { class: "fr-badge fr-badge--" + (validationAJour(a) ? (etat.color || "info") : "warning"), text: validationAJour(a) ? (etat.label || "—") : "caduque" }),
      mine ? h("span", { class: "fr-badge fr-badge--brand", text: "à moi" }) : null,
    ));
  }

  if (acte) right.appendChild(carteActe(acte, paint));
}

const etapeMienne = (a) => !!state.user && !!etapePourUI(a);

// L'étape que le compte courant peut franchir sur cet acte. On délègue à
// `etapeAParachever` (src/ui/state.js) : c'est LUI qui sait lire les rôles — y
// compris les qualités cumulées du réviseur et du signataire —, et l'écran du
// parapheur ne redéfinit pas cette règle de son côté.
const etapePourUI = (a) => etapeAParachever(a);

function resume(n, label, color) {
  return h("div", { class: "parapheur-resume__item" + (n && color === "primary" ? " is-hot" : "") },
    h("strong", { text: String(n) }),
    h("span", { text: label }));
}

// Le nom court du rôle d'une étape, tel qu'on le lit dans une phrase : la
// première partie de l'intitulé de `STEP_ROLES` (« Réviseur », « Éditeur »…).
function libelleRole(role) {
  const r = STEP_ROLES.find((x) => x.id === role);
  return (r ? r.label.split(" (")[0] : role || "valideur").toLowerCase();
}

function videDe(tab) {  if (tab === "aMoi") return "Rien ne vous attend : aucun acte de votre périmètre n'est à votre étape.";
  if (tab === "enCours") return "Aucun acte en attente d'un autre valideur.";
  if (tab === "valides") return "Aucun acte validé en attente de signature.";
  return "Aucun acte renvoyé ni refusé.";
}

// --------------------------------------------------------------------------
function carteActe(a, paint) {
  const config = state.config;
  const trame = trameById(a.trameId);
  const doc = docOfActe(a);
  const circuit = circuitDe(a);
  const v = a.validation;
  const etat = v ? (VALIDATION_STATUTS[v.statut] || {}) : {};
  const box = h("div", { class: "fr-stack" });

  box.appendChild(h("div", { class: "fr-card" },
    h("div", { class: "fr-row" },
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 },
        text: (a.numero || "acte sans numéro") + " — " + (a.objet || doc?.meta?.objet || "") }),
      v ? h("span", { class: "fr-badge fr-badge--" + (validationAJour(a) ? (etat.color || "info") : "warning"), text: validationAJour(a) ? (etat.label || "") : "validation caduque" }) : h("span", { class: "fr-badge", text: "hors circuit" }),
    ),
    h("p", { class: "fr-small fr-muted", text: [
      trame?.name || "trame absente",
      a.serviceId ? targetLabel(config, a.serviceId, a.bureauId) : "acte général",
      a.createdByName ? "rédigé par " + a.createdByName : "",
    ].filter(Boolean).join(" · ") }),
    h("div", { class: "fr-row" },
      button("Voir l'acte", { variant: "tertiary", size: "sm", icon: "eye", onClick: () => navigate("acte/" + a.id) }),
      can("actes.rediger") ? button("Ouvrir en rédaction", { variant: "tertiary", size: "sm", icon: "note", onClick: () => { state.ui = { ...(state.ui || {}), openActeId: a.id }; navigate("rediger/" + a.trameId); } }) : null,
      can("actes.signer") && v?.statut === "valide" ? button("Signer", { variant: "tertiary", size: "sm", icon: "lock", onClick: () => { state.signature = { tab: "circuit", acteId: a.id }; navigate("signature"); } }) : null,
    ),
  ));

  // ------------------------------------------------------ le circuit
  if (!v) {
    box.appendChild(h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: "Aucun circuit ouvert" }),
      circuit
        ? h("div", {},
          h("p", { class: "fr-small", text: `Le circuit « ${circuit.label} » s'applique à cet acte : ${circuit.steps.length} étape(s).` }),
          h("div", { class: "fr-row" }, button("Soumettre au circuit", { variant: "primary", icon: "upload", onClick: () => soumettreCircuit(a, circuit) })))
        : h("p", { class: "fr-small fr-muted", text: "Aucun circuit du référentiel ne s'applique à cet acte (aucun circuit actif, ou la trame demande explicitement « aucun »). L'acte peut partir directement en signature." }),
    ));
    return box;
  }

  const av = avancement(v);
  const caduque = !validationAJour(a);
  if (caduque) {
    box.appendChild(h("div", { class: "fr-alert fr-alert--warning" },
      h("p", { class: "fr-alert__title", text: "Validation caduque" }),
      h("p", { class: "fr-small", text: "Le texte de l'acte a été modifié après le passage au parapheur : ce qui a été validé n'est plus ce que porte l'acte. Le circuit doit être repris avant la signature." }),
      h("div", { class: "fr-row" },
        circuit ? button("Reprendre le circuit depuis la première étape", { variant: "primary", size: "sm", icon: "refresh", onClick: () => reprendreCircuit(a, circuit) }) : null),
    ));
  }

  box.appendChild(h("div", { class: "fr-card" },
    h("div", { class: "fr-row" },
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: v.circuitLabel || "Circuit" }),
      h("span", { class: "fr-small fr-muted", text: `${av.faites}/${av.total} étape(s)` }),
    ),
    h("p", { class: "fr-small fr-muted", text: `Ouvert le ${formatDate(String(v.demarreLe || "").slice(0, 10))} par ${v.demarreParNom || "—"}` }),
    h("div", { class: "sig-steps" }, ...(v.steps || []).map((s, i) => etapeEl(s, i, v))),
  ));

  // ------------------------------------------------------- mes actions
  const mienne = etapePourUI(a);
  if (mienne && !caduque) box.appendChild(carteDecision(a, mienne));
  else if (v.statut === "en_cours" && !caduque) {
    const suivante = etapeActive(v);
    box.appendChild(h("div", { class: "fr-card fr-card--soft" },
      h("p", { class: "fr-small", text: suivante
        ? `L'étape ouverte est « ${suivante.label} » (${etiquetteEtape(suivante.kind).label.toLowerCase()} — ${libelleRole(suivante.role)}${suivante.serviceScoped ? ", du service concerné" : ""}). Elle n'est pas de votre ressort.`
        : "Toutes les étapes sont franchies." })));
  }
  if (v.statut === "valide" && !caduque) {
    box.appendChild(h("div", { class: "fr-card fr-card--soft" },
      h("p", { class: "fr-small", text: `Circuit achevé le ${formatDate(String(v.closLe || "").slice(0, 10))}. L'acte peut être envoyé en signature.` }),
      h("div", { class: "fr-row" },
        can("actes.signer") ? button("Aller à la signature", { variant: "primary", size: "sm", icon: "lock", onClick: () => { state.signature = { tab: "circuit", acteId: a.id }; navigate("signature"); } }) : null,
        can("actes.gerer") ? button("Reprendre le circuit", { variant: "tertiary", size: "sm", icon: "refresh", onClick: () => reprendreCircuit(a, circuit) }) : null)));
  }
  if (v.statut === "refuse" || v.statut === "renvoye") {
    box.appendChild(h("div", { class: "fr-card fr-card--soft" },
      h("p", { class: "fr-small", text: v.statut === "refuse"
        ? "Le circuit a été refusé. L'acte revient en rédaction : corrigez-le, puis soumettez-le de nouveau."
        : "L'acte a été renvoyé en rédaction pour modification." }),
      h("div", { class: "fr-row" },
        can("actes.rediger") ? button("Corriger l'acte", { variant: "primary", size: "sm", icon: "note", onClick: () => { state.ui = { ...(state.ui || {}), openActeId: a.id }; navigate("rediger/" + a.trameId); } }) : null,
        circuit ? button("Reprendre le circuit", { variant: "secondary", size: "sm", icon: "refresh", onClick: () => reprendreCircuit(a, circuit) }) : null)));
  }
  return box;
}

function etapeEl(s, i, v) {
  const info = ETAPE_STATUTS[s.statut] || ETAPE_STATUTS.en_attente;
  const nature = etiquetteEtape(s.kind);
  const ouverte = s.statut === "en_attente" && etapeActive(v)?.id === s.id;
  return h("div", { class: "sig-step" + (s.statut === "valide" || s.statut === "passe" ? " is-done" : "") + (ouverte ? " is-open" : "") },
    h("span", { class: "sig-step__dot", text: s.statut === "en_attente" ? String(i + 1) : (s.statut === "refuse" ? "✗" : s.statut === "renvoye" ? "↩" : "✓") }),
    h("div", { class: "sig-step__body" },
      h("p", { class: "sig-step__title" },
        s.label,
        h("span", { class: "fr-badge fr-badge--" + info.color, style: { marginLeft: "6px" }, text: info.label }),
        h("span", { class: "fr-badge", style: { marginLeft: "4px" }, text: nature.label }),
        s.optional ? h("span", { class: "fr-badge", style: { marginLeft: "4px" }, text: "facultative" }) : null,
      ),
      h("p", { class: "sig-step__line", text: s.at ? `${s.byName || "—"} · le ${formatDate(String(s.at).slice(0, 10))}` : (ouverte ? "Étape ouverte" : "En attente") }),
      s.comment ? h("p", { class: "sig-step__line parapheur-comment", text: "« " + s.comment + " »" }) : null,
    ),
  );
}
