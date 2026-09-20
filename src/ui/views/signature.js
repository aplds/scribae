// ============================================================================
// Signature électronique et publication.
//
// Cet écran est un CLIENT de l'API REST : il ne fait rien « en direct ». Chaque
// geste (déposer l'acte, ouvrir un circuit, signer, publier) se traduit par un
// appel à l'API, et c'est le service qui tient l'état. Le déroulé est visible
// dans l'onglet « API & journal ».
//
// Le prestataire de signature (type ESUP-Signature) est simulé : il reçoit le
// document, ouvre le circuit, et c'est lui qui produit la signature. Sa
// notification (webhook) revient au service, qui vérifie l'empreinte du
// document avant d'accepter la signature.
// ============================================================================
import { state, touch, navigate, redrawView, can, actePubliable, journaliser, circuitDe } from "../state.js";
import { h, clear, button, toast, modal, icon, badge } from "../dom.js";
import { textField, selectField, emptyState, helpLink, confirmDialog } from "../components.js";
import { docOfActe, natureOf } from "./modifier.js";
import { exportAkn, printHtml, documentCss } from "../../lib/export.js";
import { renderDocument, applyPaper } from "../../lib/render.js";
import { styleForDoc } from "../../lib/styles.js";
import { formatDate, download, todayIso } from "../../lib/util.js";
import {
  publicationSettings, eliUri as eliUriOf, opposability, opposabilityRule,
  buildWebVersion, publicationJsonLd, normalizeUrl,
} from "../../lib/eli.js";
import { PRESTATAIRE, prestataire } from "../../lib/signature.js";
import { validationPourSignature, avancement } from "../../lib/validation.js";
import { get, post, connect, apiStatus, errorMessage, beginFlow, onStatus } from "../../lib/remote.js";
import { renderApiTab } from "./api-console.js";

const STATUTS = {
  brouillon: ["Brouillon", "warning"],
  pret: ["Prêt à signer", "info"],
  exporte: ["Exporté", "info"],
  en_signature: ["En signature", "warning"],
  signee: ["Signé", "success"],
  publie: ["Publié", "success"],
  en_attente: ["En attente de publication", "info"],
  abroge: ["Abrogé", "error"],
};

export const statutLabel = (s) => (STATUTS[s] || [, s || "Brouillon"])[0];
export const statutColor = (s) => (STATUTS[s] || ["", "warning"])[1];

const TABS = [
  { id: "circuit", label: "Circuit de signature" },
  { id: "publication", label: "Publication (ELI)" },
  { id: "api", label: "API & journal", perm: "api.gerer" },
];

export function renderSignature(root, params) {
  const ui = (state.signature = state.signature || { tab: "circuit", acteId: null });
  if (ui.tab === "api" && !can("api.gerer")) ui.tab = "circuit";
  const config = state.config;
  const settings = publicationSettings(config);
  const docs = new Map();
  for (const a of state.actes) { try { docs.set(a.id, docOfActe(a)); } catch { docs.set(a.id, null); } }
  const redraw = () => redrawView();
  const paint = () => { try { redraw(); } catch (e) { console.error(e); } };
  // Les actions de cet écran (envoyer en signature, publier) ne sont ouvertes que
  // lorsque le service répond : on redessine l'écran dès que son état change,
  // sinon un bouton calculé pendant la connexion resterait désactivé.
  watchApiStatus(apiStatus().status);
  // Le service est ouvert dès l'affichage de l'écran (sinon l'action resterait
  // désactivée jusqu'à ce qu'un appel soit déclenché ailleurs).
  try { connect(); } catch (e) { /* signalé par l'étiquette d'état */ }

  if (!state.actes.length) {
    root.appendChild(h("div", { class: "page-head" },
      h("div", { class: "page-head__text" },
        h("h1", { class: "page-head__title", text: "Signature & publication" }),
        h("p", { class: "page-head__sub", text: "Envoi des actes finalisés en signature, puis publication et attribution de l'identifiant ELI." }),
      ),
      h("div", { class: "page-head__actions" }, helpLink("signature", "Comment faire ?")),
    ));
    root.appendChild(emptyState("Aucun acte à signer pour l'instant : rédigez d'abord un acte.",
      button("Rédiger un acte", { variant: "primary", onClick: () => navigate("rediger") })));
    return;
  }

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Signature & publication" }),
      h("p", { class: "page-head__sub", text: "L'acte signé devient opposable à sa publication. Le service de publication attribue alors son identifiant ELI." }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("signature", "Comment faire ?"),
      statusBadgeEl(),
      button("Publications", { variant: "secondary", icon: "list", onClick: () => navigate("publications") }),
    ),
  ));

  const tabs = h("div", { class: "fr-tabs" });
  for (const t of TABS) {
    if (t.perm && !can(t.perm)) continue;
    tabs.appendChild(h("button", {
      class: "fr-tab" + (ui.tab === t.id ? " fr-tab--active" : ""),
      text: t.label,
      onClick: () => { ui.tab = t.id; paint(); },
    }));
  }
  root.appendChild(tabs);

  if (ui.tab === "circuit") renderCircuit(root, { docs, ui, paint, config, settings });
  else if (ui.tab === "publication") renderPublication(root, { docs, ui, paint, config, settings });
  else renderApiTab(root, { ui, paint });
}

// Un seul observateur d'état à la fois : chaque rendu de l'écran remplace le
// précédent, sinon les redessins s'empileraient.
let stopStatusWatch = null;
let watchedStatus = null;
function watchApiStatus(current) {
  if (stopStatusWatch) { stopStatusWatch(); stopStatusWatch = null; }
  watchedStatus = current;
  stopStatusWatch = onStatus(() => {
    if (apiStatus().status === watchedStatus) return;
    redrawView();
  });
}

function statusBadgeEl() {
  const s = apiStatus();
  const map = {
    online: ["success", "Service joignable"],
    connecting: ["info", "Connexion au service…"],
    offline: ["warning", "Reconnexion au service…"],
    error: ["error", "Service en erreur"],
    blocked: ["error", "Service refusé (adresse non autorisée)"],
    unavailable: ["warning", "Service indisponible ici"],
  };
  const [color, label] = map[s.status] || map.unavailable;
  return h("span", { id: "api-status", class: "fr-badge fr-badge--" + color, title: s.detail || "", text: label });
}

// ------------------------------------------------------------------ le circuit

function renderCircuit(root, ctx) {
  const { docs, ui, paint, config, settings } = ctx;
  const acts = [...state.actes].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  if (!ui.acteId || !acts.some((a) => a.id === ui.acteId)) ui.acteId = defaultCircuitActe(acts, docs).id;
  const acte = acts.find((a) => a.id === ui.acteId);
  const doc = docs.get(acte.id);

  const grid = h("div", { class: "sig-grid" });
  const left = h("div", { class: "fr-stack" });
  const right = h("div", { class: "fr-stack" });
  grid.appendChild(left); grid.appendChild(right);
  root.appendChild(grid);

  // ------------------------------------------------- colonne des actes
  left.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Actes" }),
    h("p", { class: "fr-small fr-muted", text: "Sélectionnez l'acte à envoyer en signature. L'acte est déposé auprès du service, puis auprès du prestataire de signature." }),
  ));
  const listBox = h("div", { class: "sig-list" });
  left.appendChild(listBox);
  for (const a of acts) {
    const d = docs.get(a.id);
    const [label, color] = STATUTS[a.statut] || STATUTS.brouillon;
    listBox.appendChild(h("button", {
      class: "sig-item" + (a.id === acte.id ? " is-on" : ""),
      onClick: () => { ui.acteId = a.id; paint(); },
    },
      h("span", { class: "sig-item__num fr-mono", text: a.numero || "sans n°" }),
      h("span", { class: "sig-item__obj", text: a.objet || d?.meta?.objet || "—" }),
      h("span", { class: "fr-badge fr-badge--" + color, text: label }),
    ));
  }

  // ------------------------------------------------ colonne du circuit
  const blocking = (acte.issues || doc?.issues || []).filter((i) => i.level === "blocking");
  // Acte individuel : sa trame l'a déclaré non publiable. Le circuit s'arrête à
  // la signature, il n'y a pas de cinquième étape « publié et opposable ».
  const publiable = actePubliable(acte);
  const signed = !!(acte.original || acte.statut === "signee" || acte.statut === "publie");
  // Le passage au parapheur conditionne l'envoi en signature : le service
  // refuse d'ouvrir un circuit sur un acte dont le circuit de validation n'est
  // pas achevé (voir hEnvoyerEnSignature dans index.html).
  const para = validationPourSignature(acte);
  const paraAvancement = avancement(acte.validation);

  right.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: `Circuit — ${acte.numero || "acte sans numéro"}` }),
    h("p", { class: "fr-small fr-muted", text: [acte.objet, doc?.meta?.entity?.name].filter(Boolean).join(" · ") }),
    h("div", { class: "sig-steps" },
      stepEl(1, "Acte finalisé", !!acte.values || !!acte.doc, [
        blocking.length ? `${blocking.length} contrôle(s) bloquant(s) : la signature est déconseillée` : "Aucun contrôle bloquant",
        doc?.meta?.eli ? "ELI pressenti : " + normalizeUrl(doc.meta.eli) : "",
      ].filter(Boolean)),
      !acte.validation
        ? stepEl(2, "Parapheur", true, [circuitDe(acte) ? "Aucun circuit ouvert : l'acte part en signature sans validation préalable." : "Aucun circuit ne s'applique à cet acte."])
        : stepEl(2, "Parapheur — " + (acte.validation.circuitLabel || "circuit de validation"), para.ok, [
          `${paraAvancement.faites}/${paraAvancement.total} étape(s) franchie(s)`,
          para.ok ? "" : para.raison,
        ].filter(Boolean)),
      stepEl(3, "Déposé au service", !!acte.api?.acteId, acte.api ? [`Identifiant ${acte.api.acteId}`, acte.api.sha256 ? "Empreinte SHA-256 " + acte.api.sha256.slice(0, 16) + "…" : ""].filter(Boolean) : ["En attente d'envoi"]),
      stepEl(4, "Envoyé en signature", acte.api?.statut && acte.api.statut !== "depose", acte.api?.signataire ? [`Signataire : ${acte.api.signataire}`, `Prestataire : ${PRESTATAIRE.nom}`] : ["En attente"]),
      stepEl(5, "Signé", !!(acte.original || acte.statut === "signee" || acte.statut === "publie"), acte.original ? [`Signé le ${formatDate(String(acte.original.signatures?.[0]?.signeLe || "").slice(0, 10))}`, (acte.original.signatures?.[0]?.certificat?.sujet || "")] : ["En attente de la signature"]),
      publiable
        ? stepEl(6, "Publié et opposable", acte.statut === "publie" && !!acte.publication, acte.publication ? [`ELI ${acte.publication.eliUri}`, `Opposable le ${formatDate(acte.publication.dateOpposabilite)}`] : ["En attente de publication"])
        : stepEl(6, "Non publié (acte individuel)", signed, ["La trame a déclaré cet acte non publiable.", "L'acte signé est conservé au registre et notifié à l'intéressé."]),
    ),
  ));

  // actions
  const actions = h("div", { class: "fr-card" }, h("h2", { class: "fr-card__title", text: "Actions" }));
  const row = h("div", { class: "fr-row" });
  actions.appendChild(row);

  if (acte.kind === "consolide") {
    // La version consolidée ne suit pas le circuit ordinaire : elle est publiée
    // automatiquement avec l'acte modificatif qui l'a produite.
    const modActe = state.actes.find((x) => x.id === acte.modificatifId);
    const socle = state.actes.find((x) => x.id === acte.baseId);
    actions.appendChild(h("p", { class: "fr-small", text: "Cette version consolidée est le texte à jour de l'acte d'origine. Elle ne se signe pas séparément : elle est publiée en même temps que l'acte modificatif qui l'a produite, sous le même identifiant ELI que l'acte d'origine." }));
    actions.appendChild(h("div", { class: "fr-row" },
      modActe ? button("Ouvrir l'acte modificatif", { variant: "primary", size: "sm", icon: "upload", onClick: () => { ui.acteId = modActe.id; paint(); } }) : null,
      socle ? button("Voir l'acte d'origine", { variant: "secondary", size: "sm", icon: "eye", onClick: () => navigate("acte/" + socle.id) }) : null,
      button("Voir le document", { variant: "tertiary", size: "sm", icon: "note", onClick: () => navigate("acte/" + acte.id) }),
    ));
  } else if (!signed) {
    row.appendChild(button(acte.api?.acteId ? "Reprendre le circuit" : "Envoyer en signature", {
      variant: "primary", icon: "upload",
      disabled: apiStatus().status !== "online" || blocking.length > 0 || !para.ok,
      title: blocking.length ? "L'acte comporte un contrôle bloquant" : !para.ok ? para.raison : "Déposer l'acte et ouvrir le circuit de signature",
      onClick: () => envoyerEnSignature(acte, { docs, paint }),
    }));
    if (!para.ok) {
      row.appendChild(button("Ouvrir le parapheur", {
        variant: "secondary", icon: "check",
        onClick: () => { state.parapheur = { tab: "enCours", acteId: acte.id }; navigate("parapheur"); },
      }));
    }
    if (acte.api?.acteId) {
      row.appendChild(button("Ouvrir l'outil de signature", {
        variant: "secondary", icon: "lock", onClick: () => ouvrirOutil(acte, doc, { docs, paint }),
      }));
      row.appendChild(button("Relever le statut", {
        variant: "tertiary", icon: "refresh", onClick: () => releverStatut(acte, { paint }),
      }));
    }
  } else {
    row.appendChild(button("Voir l'original signé", { variant: "secondary", icon: "eye", onClick: () => voirOriginal(acte) }));
    row.appendChild(button("Télécharger l'original", { variant: "tertiary", icon: "download", onClick: () => download(`${(acte.numero || "acte").replace(/[^\w-]+/g, "_")}-original-signe.json`, JSON.stringify(acte.original, null, 2), "application/json") }));
    if (publiable && acte.statut !== "publie") {
      row.appendChild(button("Publier maintenant", { variant: "primary", icon: "check", onClick: () => { state.signature.tab = "publication"; paint(); } }));
    }
    if (!publiable) {
      actions.appendChild(h("div", { class: "fr-alert fr-alert--info", style: { marginTop: "10px" } },
        h("p", { class: "fr-alert__title", text: "Acte non publiable" }),
        h("p", { class: "fr-small", text: "Signé, l'acte est conservé au registre et suffit à produire ses effets. La trame dont il est issu étant déclarée non publiable (acte individuel : revalorisation d'un traitement, sanction…), il n'est pas déposé au recueil et ne reçoit pas d'identifiant ELI." }),
      ));
    }
  }
  if (blocking.length) {
    actions.appendChild(h("div", { class: "fr-alert fr-alert--error", style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: "Signature impossible en l'état" }),
      ...blocking.map((b) => h("p", { class: "fr-small", text: "• " + b.message })),
    ));
  }
  if (!signed && !para.ok) {
    actions.appendChild(h("div", { class: "fr-alert fr-alert--warning", style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: "Parapheur non achevé" }),
      h("p", { class: "fr-small", text: para.raison }),
      h("p", { class: "fr-small fr-muted", text: "Le service refuse d'ouvrir un circuit de signature sur un acte dont la validation n'est pas achevée : c'est ce qui garantit que l'acte signé est bien celui qui a été approuvé." }),
    ));
  }
  right.appendChild(actions);

  if (acte.api) {
    right.appendChild(h("div", { class: "fr-card fr-card--soft" },
      h("h3", { class: "fr-card__title", text: "Suivi technique" }),
      kv("Service", acte.api.acteId),
      kv("Circuit", acte.api.signatureId),
      kv("Dossier prestataire", acte.api.docId),
      kv("Empreinte déposée", acte.api.sha256),
      kv("Lien de signature", acte.api.lienSignature, true),
    ));
  }
}

// L'acte sur lequel s'ouvre le circuit : le premier qui attend encore un geste
// (rédigé, non signé, sans contrôle bloquant) ; à défaut, le dernier acte signé,
// plutôt que le premier de la liste (qui peut être un brouillon incomplet).
function defaultCircuitActe(acts, docs) {
  const signed = (a) => !!(a.original || a.statut === "signee" || a.statut === "publie");
  const blocking = (a) => (a.issues || docs.get(a.id)?.issues || []).some((i) => i.level === "blocking");
  return acts.find((a) => !signed(a) && !blocking(a) && a.kind !== "consolide")
    || acts.find((a) => !signed(a) && !blocking(a))
    || acts.find(signed)
    || acts[0];
}

function kv(k, v, mono) {
  if (!v) return null;
  return h("p", { class: "fr-small", style: { margin: "2px 0" } },
    h("span", { class: "fr-muted", text: k + " : " }),
    h("span", { class: mono ? "fr-mono sig-kv" : "sig-kv", text: v }));
}

function stepEl(n, title, done, lines) {
  return h("div", { class: "sig-step" + (done ? " is-done" : "") },
    h("span", { class: "sig-step__dot", text: done ? "✓" : String(n) }),
    h("div", { class: "sig-step__body" },
      h("p", { class: "sig-step__title", text: title }),
      ...(lines || []).map((l) => h("p", { class: "sig-step__line", text: l })),
    ),
  );
}

// --------------------------------------------------------- envoi et signature

function aknOf(acte, doc) {
  const trame = state.trames.find((t) => t.id === acte.trameId);
  return exportAkn(doc, state.config, trame);
}

// Libellé d'un acte dans le journal et les notifications : le numéro s'il
// existe, sinon l'objet, sinon l'identifiant technique.
const libelleActe = (acte) => acte.numero || acte.objet || acte.id;

function auteurDe(acte, doc) {
  const sig = doc?.meta?.signataire;
  const config = state.config;
  return {
    nom: sig ? [sig.civility, sig.firstName, sig.lastName].filter(Boolean).join(" ") : (doc?.meta?.entity?.authorityFormula || "Signataire"),
    fonction: sig ? ((config.roles || []).find((r) => r.id === sig.roles?.[0])?.label || "") : "",
    courriel: sig?.courriel || "",
    entite: doc?.meta?.entity?.name || "",
  };
}

async function envoyerEnSignature(acte, ctx) {
  const config = state.config;
  const doc = ctx.docs.get(acte.id) || docOfActe(acte);
  const settings = publicationSettings(config);
  const token = settings.jetonDemonstration;
  // Porte du parapheur : l'acte signé doit être l'acte approuvé. Le service
  // applique la même règle (409 « validation_incomplete »), mais on évite un
  // aller-retour voué à l'échec et on explique le motif à l'agent.
  const para = validationPourSignature(acte);
  if (!para.ok) { toast(para.raison, "warning"); return; }
  const flow = beginFlow(`Dépôt et envoi en signature — ${acte.numero || acte.id}`);
  const akn = aknOf(acte, doc);
  const auteur = auteurDe(acte, doc);
  try {
    const dep = await post("/v1/actes", {
      akn, numero: acte.numero || doc.meta?.numero || "", objet: acte.objet || doc.meta?.objet || "",
      nature: doc.meta?.actTypeId || "Décision", entityId: doc.meta?.entity?.id || "", entityName: doc.meta?.entity?.name || "",
      dateSignature: acte.dateSignature || doc.meta?.dateSignature || "", trameId: acte.trameId || "",
      ecarts: (acte.ecarts || []).length,
      // La publication est une propriété de la trame : le service ne connaît pas
      // les trames, donc on la lui transmet au dépôt, et il la fera respecter.
      publishable: actePubliable(acte),
      // L'état du parapheur accompagne l'acte : le service peut ainsi refuser
      // d'ouvrir un circuit sur un acte non validé, et l'empreinte du texte
      // validé reste attachée à l'acte signé.
      validation: acte.validation ? {
        statut: acte.validation.statut,
        circuitLabel: acte.validation.circuitLabel || "",
        empreinte: acte.validation.empreinte || "",
        closLe: acte.validation.closLe || "",
        etapes: (acte.validation.steps || []).map((s) => s.statut),
      } : null,
    }, { token, flow, label: "Dépôt de l'acte finalisé" });
    if (!dep.ok) { toast(errorMessage(dep), "error"); return; }
    const apiActeId = dep.body.id;

    const sig = await post(`/v1/actes/${apiActeId}/signature`, {
      signataires: [{ nom: auteur.nom, courriel: auteur.courriel, fonction: auteur.fonction, ordre: 1 }],
      niveau: "avancee",
      urlNotification: "https://api.valmont-sur-loire.fr/v1/webhooks/signature",
    }, { token, flow, label: "Envoi en signature (ouverture du circuit)" });
    if (!sig.ok) { toast(errorMessage(sig), "error"); return; }
    const signatureId = sig.body.signatureId;

    // Passerelle vers le prestataire : en production ces appels sortants sont
    // émis par le service ; dans la démonstration, ils partent d'ici.
    const d = await prestataire.creerDocument({ xml: akn, titre: acte.objet || doc.meta?.objet || "", reference: acte.numero || "", flow });
    await prestataire.ajouterSignataire({ docId: d.id, signataire: auteur, flow });
    const started = await prestataire.demarrer({ docId: d.id, flow });

    acte.api = {
      acteId: apiActeId, signatureId, docId: d.id, statut: "en_attente",
      sha256: dep.body.sha256, lienSignature: started.lienSignature || sig.body.lienSignature,
      signataire: auteur.nom, deposeLe: dep.body.deposeLe,
    };
    acte.statut = "en_signature";
    touch("actes", { rerender: false });
    toast("Acte déposé et circuit de signature ouvert.", "success");
    await journaliser({
      action: "signature.depot", cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
      detail: `déposé au service (${apiActeId}), circuit ${signatureId} ouvert`,
      to: [acte.createdBy, "role:editeur"],
    });
    ctx.paint();
    await ouvrirOutil(acte, doc, ctx, true);
  } catch (e) {
    toast(String((e && e.message) || e), "error");
  }
}

async function releverStatut(acte, ctx) {
  const flow = beginFlow("Relève du statut");
  try {
    const res = await get(`/v1/signatures/${acte.api.signatureId}`, { flow, label: "Suivi du circuit de signature" });
    if (!res.ok) { toast(errorMessage(res), "error"); return; }
    acte.api.statut = res.body.statut;
    if (res.body.statut === "signee") { acte.statut = "signee"; acte.original = res.body.documentSigne || acte.original; }
    touch("actes", { rerender: false });
    toast("Statut du circuit : " + res.body.statut, "info");
    ctx.paint();
  } catch (e) { toast(String((e && e.message) || e), "error"); }
}

// L'écran du prestataire de signature : volontairement distinct de
// l'application (autre en-tête, autre vocabulaire) — c'est un autre service.
async function ouvrirOutil(acte, doc, ctx, autoOpen) {
  if (!acte.api?.docId) { toast("Aucun circuit ouvert pour cet acte.", "error"); return; }
  const config = state.config;
  const auteur = auteurDe(acte, doc);
  let dossier = prestataire.dossier(acte.api.docId);
  if (!dossier) {
    // Le prestataire a redémarré (ou la page a été rechargée) : on redépose.
    const akn = aknOf(acte, doc);
    const d = await prestataire.creerDocument({ xml: akn, titre: acte.objet || "", reference: acte.numero || "", flow: null });
    acte.api.docId = d.id;
    await prestataire.ajouterSignataire({ docId: d.id, signataire: auteur, flow: null });
    await prestataire.demarrer({ docId: d.id, flow: null });
    dossier = prestataire.dossier(d.id);
    touch("actes", { rerender: false });
  }

  const paperBox = h("div", { class: "paper-box sig-paper" });
  const paper = h("div", { class: "paper" });
  paper.style.fontFamily = config.brand.documentFont || "";
  applyPaper(paper, doc, config);
  paper.appendChild(renderDocument(doc, config, {}));
  paperBox.appendChild(paper);

  const box = h("div", { class: "sig-tool" },
    h("div", { class: "sig-tool__bar" },
      h("span", { class: "sig-tool__mark", text: "ESUP" }),
      h("div", { class: "sig-tool__title" },
        h("strong", { text: PRESTATAIRE.nom }),
        h("span", { text: `Circuit ${acte.api.signatureId} · dossier ${acte.api.docId}` })),
      h("span", { class: "sig-tool__ext", text: PRESTATAIRE.baseUrl }),
    ),
    h("div", { class: "sig-tool__body" },
      h("div", { class: "sig-tool__doc" }, paperBox),
      h("aside", { class: "sig-tool__side" },
        h("h3", { text: "À signer" }),
        h("p", { class: "fr-small", text: acte.objet || "" }),
        h("p", { class: "fr-small fr-muted", text: "Signataire" }),
        h("p", { class: "fr-small", text: [auteur.nom, auteur.fonction].filter(Boolean).join(" — ") }),
        h("p", { class: "fr-small fr-muted", text: "Niveau demandé" }),
        h("p", { class: "fr-small", text: "Signature avancée (certificat de démonstration)" }),
        h("p", { class: "fr-small fr-muted", text: "Empreinte du document" }),
        h("p", { class: "fr-mono fr-small", text: (acte.api.sha256 || "").slice(0, 32) + "…" }),
        h("p", { class: "fr-small fr-muted", style: { marginTop: "10px" }, text: "En signant, l'empreinte du document est signée par votre certificat et horodatée. Le service de publication vérifiera cette empreinte avant d'accepter l'acte." }),
      )),
    h("div", { class: "sig-tool__foot" }),
  );

  const m = modal({
    title: "Outil de signature — prestataire",
    wide: true,
    body: box,
    actions: (close) => [
      button("Refuser", { variant: "tertiary", onClick: async () => { close(); await refuser(acte, ctx); } }),
      button("Signer l'acte", {
        variant: "primary", icon: "lock",
        onClick: async (ev) => {
          const b = ev.currentTarget;
          b.disabled = true; b.textContent = "Signature en cours…";
          try { await signer(acte, doc, ctx); close(); }
          catch (e) { toast(String((e && e.message) || e), "error"); b.disabled = false; b.textContent = "Signer l'acte"; }
        },
      }),
    ],
  });
  requestAnimationFrame(() => {
    const r = m.el.getBoundingClientRect();
    paper.style.transform = `scale(${Math.min(1, (r.width * 0.55) / (paper.offsetWidth || 794))})`;
    paper.style.transformOrigin = "top left";
  });
}

async function refuser(acte, ctx) {
  const flow = beginFlow("Refus de signature");
  try {
    await post("/v1/webhooks/signature", { signatureId: acte.api.signatureId, statut: "refusee", motif: "Refus du signataire (démonstration)" }, { flow, label: "Notification de refus" });
    acte.api.statut = "refusee";
    acte.statut = "pret";
    touch("actes", { rerender: false });
    toast("Signature refusée : l'acte revient en rédaction.", "warning");
    await journaliser({
      action: "signature.refus", cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
      detail: "signature refusée par le signataire : l'acte revient en rédaction",
      to: [acte.createdBy, "role:editeur"],
    });
    ctx.paint();
  } catch (e) { toast(String((e && e.message) || e), "error"); }
}

async function signer(acte, doc, ctx) {
  const config = state.config;
  const flow = beginFlow(`Signature — ${acte.numero || acte.id}`);
  const auteur = auteurDe(acte, doc);
  const akn = aknOf(acte, doc);
  const bodyHtml = renderDocument(doc, config, {}).outerHTML.replace(/^<article[^>]*>/, "").replace(/<\/article>$/, "");
  const pack = await prestataire.signer({
    docId: acte.api.docId, signataire: auteur, pageHtml: bodyHtml, brand: config.brand.name,
    pageCss: documentCss(config, styleForDoc(config, doc)), flow,
  });
  const notif = await post("/v1/webhooks/signature", {
    signatureId: acte.api.signatureId, statut: "signee", documentSigne: pack,
  }, { flow, label: "Notification au service (retour de l'acte signé)" });
  if (!notif.ok) { toast("Le service a refusé la signature : " + errorMessage(notif), "error"); return; }
  const suivi = await get(`/v1/signatures/${acte.api.signatureId}`, { flow, label: "Confirmation du statut" });
  acte.original = pack;
  acte.api.statut = "signee";
  acte.api.akn = akn;
  acte.statut = "signee";
  acte.signeLe = pack.signatures[0].signeLe;
  acte.updatedAt = new Date().toISOString();
  touch("actes", { rerender: false });
  toast("Acte signé. Il peut maintenant être publié.", "success");
  await journaliser({
    action: "signature.signe", cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
    detail: `signé par ${auteur.nom} — empreinte ${String(pack.document?.sha256 || "").slice(0, 16)}…`,
    to: [acte.createdBy, "role:editeur"],
  });
  ctx.paint();
}

// ---------------------------------------------------------------- publication

function renderPublication(root, ctx) {
  const { docs, ui, paint, config, settings } = ctx;
  const form = (ui.pub = ui.pub || { datePublication: todayIso(), mode: settings.opposabilite.mode, jours: settings.opposabilite.jours, recueil: settings.recueil, publishConsolide: true });
  const acts = [...state.actes].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  // Deux files distinctes : les actes publiables attendent leur dépôt au recueil,
  // les actes non publiables (actes individuels) s'arrêtent à la signature.
  const aSigner = acts.filter((a) => (a.statut === "signee" || (a.original && a.statut !== "publie")) && actePubliable(a));
  const nonPubliables = acts.filter((a) => a.original && a.statut !== "publie" && !actePubliable(a));
  const publies = acts.filter((a) => a.statut === "publie" && a.publication);
  const autres = acts.filter((a) => a.statut !== "signee" && a.statut !== "publie" && !a.original && a.kind !== "consolide");

  const grid = h("div", { class: "sig-grid" });
  const left = h("div", { class: "fr-stack" });
  const right = h("div", { class: "fr-stack" });
  grid.appendChild(left); grid.appendChild(right);
  root.appendChild(grid);

  left.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Actes signés, prêts à publier" }),
    h("p", { class: "fr-small fr-muted", text: "La publication dépose la version en ligne, attribue l'identifiant ELI et fixe la date d'opposabilité. Un acte non signé ne peut pas être publié : le service refuse l'appel (409)." }),
  ));

  if (!aSigner.length) {
    left.appendChild(h("div", { class: "fr-card fr-card--soft" },
      h("p", { class: "fr-small fr-muted", text: "Aucun acte signé en attente de publication." })));
  }

  for (const a of aSigner) {
    const doc = docs.get(a.id);
    const eliU = doc ? eliUriOf({ config, actTypeId: doc.meta?.actTypeId, numero: a.numero || doc.meta?.numero, entityCode: doc.meta?.entity?.code }) : "—";
    const url = doc ? normalizeUrl(doc.meta?.eli) : "";
    const card = h("div", { class: "fr-card" },
      h("div", { class: "sig-pub__head" },
        h("strong", { text: `${a.numero || "acte"} — ${a.objet || doc?.meta?.objet || ""}` }),
        h("span", { class: "fr-badge fr-badge--success", text: "signé le " + formatDate(String(a.signeLe || "").slice(0, 10)) })),
      h("div", { class: "sig-pub__meta" },
        h("span", { class: "fr-mono fr-small", text: eliU }),
        h("span", { class: "fr-mono fr-small fr-muted", text: url })),
      h("div", { class: "fr-grid fr-grid--2", style: { marginTop: "8px" } },
        textField({ label: "Recueil", value: form.recueil, onChange: (v) => { form.recueil = v; } }),
        textField({ label: "Date de publication", type: "date", value: form.datePublication, onChange: (v) => { form.datePublication = v; paint(); } }),
      ),
      h("div", { class: "fr-grid fr-grid--2" },
        selectField({
          label: "Entrée en vigueur", value: form.mode,
          options: [{ value: "lendemain", label: "Le lendemain de la publication" }, { value: "jours", label: "Après un nombre de jours" }],
          onChange: (v) => { form.mode = v; paint(); },
        }),
        form.mode === "jours" ? textField({ label: "Nombre de jours", type: "number", value: form.jours, onChange: (v) => { form.jours = Number(v) || 0; paint(); } }) : null,
      ),
      h("p", { class: "fr-small", style: { margin: "0 0 6px" } },
        h("strong", { text: "Nature publiée : " }),
        kindLabel(a) + (a.kind === "modificatif" ? " — l'acte modificatif est publié sous son propre identifiant ELI." : ".")),
      consolidationNotice(a, form, paint),
      h("div", { class: "oppo-preview" },
        h("strong", { text: "Opposabilité" }),
        h("span", { text: `Entrée en vigueur le ${formatDate(opposability(form.datePublication, { opposabilite: { mode: form.mode, jours: form.jours } }))} (${opposabilityRule({ opposabilite: { mode: form.mode, jours: form.jours } })})` })),
      dateIncoherente(a, doc, form) ? h("div", { class: "fr-alert fr-alert--warning" },
        h("p", { class: "fr-alert__title", text: "Date de publication incohérente" }),
        h("p", { class: "fr-small", text: `L'acte est signé le ${formatDate(a.dateSignature || doc?.meta?.dateSignature)} : la publication ne peut pas le précéder. Le service refusera l'appel (422).` })) : null,
      h("div", { class: "fr-row" },
        button("Publier et attribuer l'ELI", {
          variant: "primary", icon: "upload",
          disabled: apiStatus().status !== "online" || dateIncoherente(a, doc, form),
          onClick: () => publier(a, doc, { ...form }, paint),
        }),
        button("Voir l'acte", { variant: "tertiary", icon: "eye", onClick: () => navigate("acte/" + a.id) }),
      ),
    );
    left.appendChild(card);
  }

  // Actes individuels : ils sont signés, mais leur trame les a déclarés non
  // publiables. Ils ne passent donc jamais par la publication ni par l'ELI.
  if (nonPubliables.length) {
    const cardNp = h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: "Actes non publiables (conservés)" }),
      h("p", { class: "fr-small fr-muted", text: "Ces actes relèvent d'une trame déclarée non publiable : actes individuels (revalorisation d'un traitement, sanction, etc.). Ils ne sont pas déposés au recueil ; la signature suffit à leur opposabilité à l'égard de l'intéressé, et l'original signé reste conservé au registre." }),
    );
    for (const a of nonPubliables) {
      const doc = docs.get(a.id);
      cardNp.appendChild(h("div", { class: "sig-pub__line" },
        h("div", {},
          h("strong", { text: `${a.numero || "acte"} — ${a.objet || doc?.meta?.objet || ""}` }),
          h("p", { class: "fr-small fr-muted", text: `Signé le ${formatDate(String(a.signeLe || "").slice(0, 10))} · trame non publiable` })),
        h("div", { class: "fr-row" },
          button("Voir l'acte", { variant: "secondary", size: "sm", icon: "eye", onClick: () => navigate("acte/" + a.id) }))));
    }
    left.appendChild(cardNp);
  }

  // Publications déjà faites
  const cardPub = h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Publications" }),
    h("p", { class: "fr-small fr-muted", text: "Registre des versions déposées au recueil, avec leur identifiant ELI et leurs dates." }),
  );
  if (!publies.length) {
    cardPub.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucune publication pour l'instant." }));
  }
  for (const a of publies) {
    const p = a.publication;
    cardPub.appendChild(h("div", { class: "sig-pub__line" },
      h("div", {},
        h("strong", { text: `${p.numero} — ${p.objet || ""}` }),
        h("p", { class: "fr-mono fr-small", text: p.eliUri }),
        h("p", { class: "fr-small fr-muted", text: `Publié le ${formatDate(p.datePublication)} · opposable le ${formatDate(p.dateOpposabilite)} · ${p.recueil}` })),
      h("div", { class: "fr-row" },
        button("Consulter", { variant: "secondary", size: "sm", icon: "eye", onClick: () => navigate("publication/" + encodeURIComponent(p.cle)) }),
        button("Registre", { variant: "tertiary", size: "sm", onClick: () => navigate("publications") }),
      )));
  }
  left.appendChild(cardPub);

  // ------------------------------------------------ colonne didactique
  right.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "La chaîne d'intégrité" }),
    h("p", { class: "fr-small", text: "1. L'acte est déposé : le service en calcule l'empreinte SHA-256." }),
    h("p", { class: "fr-small", text: "2. Le prestataire signe : l'empreinte est signée par le certificat du signataire et horodatée." }),
    h("p", { class: "fr-small", text: "3. Le service vérifie lui-même que le document signé a bien la même empreinte que le document déposé — sinon il refuse (409)." }),
    h("p", { class: "fr-small", text: "4. La publication attribue l'ELI, fixe la date de publication et la date d'opposabilité, et conserve l'original signé." }),
    h("p", { class: "fr-small", text: "5. Les actes individuels (revalorisation d'un traitement, sanction…) relèvent d'une trame déclarée non publiable : signés et conservés, mais jamais déposés au recueil. Le service refuse de les publier (409)." }),
  ));

  right.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Vérifier une règle de l'API" }),
    h("p", { class: "fr-small fr-muted", text: "Appelez la publication sur un acte qui n'est pas signé : le service doit refuser avec le statut 409." }),
    h("div", { class: "fr-row" },
      button("Tenter de publier un acte non signé", {
        variant: "secondary", icon: "warn", disabled: apiStatus().status !== "online" || !autres.length,
        onClick: () => tenterPublicationNonSignee(autres, { paint }),
      }))));
  if (!autres.length) {
    right.lastChild.appendChild(h("p", { class: "fr-small fr-muted", text: "Tous vos actes sont signés ou publiés : la règle n'a pas d'acte à démontrer." }));
  }
}

function dateIncoherente(acte, doc, form) {
  const signe = acte.dateSignature || doc?.meta?.dateSignature || "";
  return !!(form.datePublication && signe && form.datePublication < signe);
}

async function publier(acte, doc, form, paint) {
  // Garde-fou côté client : le service refuse lui aussi (409), mais on évite
  // d'envoyer une requête vouée à l'échec pour un acte individuel.
  if (!actePubliable(acte)) { toast("Cet acte est déclaré non publiable par sa trame : il ne peut pas être déposé au recueil.", "error"); return; }
  const config = state.config;
  const settings = publicationSettings(config);
  const token = settings.jetonDemonstration;
  const flow = beginFlow(`Publication — ${acte.numero || acte.id}`);
  const akn = acte.api?.akn || aknOf(acte, doc);
  const trame = state.trames.find((t) => t.id === acte.trameId);
  const eliU = eliUriOf({ config, actTypeId: doc.meta?.actTypeId, numero: acte.numero || doc.meta?.numero, entityCode: doc.meta?.entity?.code });
  const url = normalizeUrl(doc.meta?.eli);
  const dateOpposabilite = opposability(form.datePublication, { opposabilite: { mode: form.mode, jours: form.jours } });
  const rule = opposabilityRule({ opposabilite: { mode: form.mode, jours: form.jours } });
  const record = {
    eliUri: eliU, url, numero: acte.numero || doc.meta?.numero || "", nature: doc.meta?.actTypeId || "Décision",
    title: (doc.nodes.find((n) => n.type === "title")?.text) || acte.objet || "",
    objet: acte.objet || doc.meta?.objet || "", entityName: doc.meta?.entity?.name || "",
    dateDocument: acte.dateSignature || doc.meta?.dateSignature || "", datePublication: form.datePublication,
    dateOpposabilite, opposabiliteRule: rule, recueil: form.recueil, kind: kindFor(acte),
    auteur: auteurDe(acte, doc).nom, originalSha256: acte.original?.document?.sha256 || "",
  };
  const html = buildWebVersion({ doc, config, record });
  const jsonld = publicationJsonLd({ ...record, brandName: config.brand.name, signature: { signataires: [{ nom: record.auteur }], signeLe: acte.signeLe, algorithme: "ECDSA P-256 / SHA-256" } });
  const kind = kindFor(acte);
  const payload = {
    eliUri: eliU, url, work: url, numero: record.numero, nature: record.nature, objet: record.objet,
    entityCode: doc.meta?.entity?.code || "", brandName: config.brand.name,
    dateDocument: record.dateDocument, datePublication: form.datePublication, dateOpposabilite,
    opposabiliteRule: rule, recueil: form.recueil, auteur: record.auteur, kind,
    html, akn, jsonld, original: acte.original,
  };
  const opts = { token, flow, label: "Publication de l'acte signé", idempotencyKey: `${eliU}@${record.dateDocument}-${kind}` };
  try {
    let res = await post(`/v1/actes/${acte.api.acteId}/publication`, payload, opts);
    if (!res.ok && res.status === 404) {
      // Le service ne connaît pas (ou plus) cet acte — redémarrage du service, ou
      // acte signé sur un autre poste. On le lui redépose avec sa signature déjà
      // approuvée, puis on republie.
      if (await retablirActe(acte, doc, { token, flow })) res = await post(`/v1/actes/${acte.api.acteId}/publication`, payload, opts);
    }
    if (!res.ok) { toast(errorMessage(res), "error"); return; }
    acte.publication = { ...res.body, html, akn, jsonld };
    acte.statut = "publie";
    acte.eli = eliU;
    acte.datePublication = form.datePublication;
    acte.dateOpposabilite = dateOpposabilite;
    acte.updatedAt = new Date().toISOString();
    // Le registre public a changé : on invalide son cache pour qu'il se recharge.
    state.pubRegistre = { chargement: false };
    touch("actes", { rerender: false });
    toast(`Acte publié — ELI ${eliU}`, "success");
    await journaliser({
      action: "publication.publie", cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
      detail: `publié sous l'ELI ${eliU}, opposable le ${dateOpposabilite}`,
      to: [acte.createdBy, "role:editeur"],
    });

    // Une modification n'est complète que lorsque le texte consolidé est publié :
    // c'est lui qui devient la version en vigueur de l'acte d'origine.
    if (kind === "modificative" && form.publishConsolide !== false) {
      const cons = acte.consolideId ? state.actes.find((x) => x.id === acte.consolideId) : null;
      if (cons && cons.statut !== "publie") {
        toast("Publication de la version consolidée…", "info");
        await publierConsolide(cons, form, { token, flow });
      }
    }
    paint();
  } catch (e) { toast(String((e && e.message) || e), "error"); }
}

// Nature de la version déposée au recueil : elle découle de l'acte, elle ne se
// choisit pas (un acte modificatif est publié comme acte modificatif, une
// consolidation comme version consolidée).
const kindFor = (a) => (a.kind === "modificatif" ? "modificative" : a.kind === "consolide" ? "consolidee" : "originale");
const kindLabel = (a) => (a.kind === "modificatif" ? "Acte modificatif" : a.kind === "consolide" ? "Version consolidée" : "Version originale");

// Encart affiché sur la carte d'un acte modificatif : la consolidation qui
// l'accompagne sera publiée sous le même ELI que l'acte d'origine.
function consolidationNotice(acte, form, paint) {
  if (acte.kind !== "modificatif") return null;
  const cons = acte.consolideId ? state.actes.find((x) => x.id === acte.consolideId) : null;
  if (!cons) return null;
  const socle = acte.baseId ? state.actes.find((x) => x.id === acte.baseId) : null;
  const cb = h("input", { type: "checkbox", checked: form.publishConsolide !== false });
  cb.addEventListener("change", () => { form.publishConsolide = cb.checked; });
  return h("div", { class: "fr-alert fr-alert--info", style: { margin: "10px 0" } },
    h("p", { class: "fr-alert__title", text: "Version consolidée" }),
    h("p", { class: "fr-small", text: `À la publication de cet acte modificatif, la version consolidée${cons.numero ? " n° " + cons.numero : ""} sera publiée sous le même identifiant ELI que ${socle ? "l'acte n° " + (socle.numero || "—") : "l'acte d'origine"}. Elle deviendra la version en vigueur et supplantera l'acte d'origine, qui restera consultable dans l'historique des versions.` }),
    h("label", { class: "fr-check" }, cb, "Publier aussi la version consolidée"),
  );
}

// Publication de la version consolidée : elle est déposée et signée comme la
// manifestation de la modification, puis publiée sous l'ELI de l'acte d'origine
// (même « work », nouvelle version) — d'où sa place de version en vigueur.
async function publierConsolide(cons, form, { token, flow }) {
  const config = state.config;
  const doc = docOfActe(cons);
  if (!doc) { toast("Version consolidée introuvable.", "error"); return; }
  const akn = exportAkn(doc, config, null);
  const auteur = auteurDe(cons, doc);
  const eliU = eliUriOf({ config, actTypeId: doc.meta?.actTypeId, numero: doc.meta?.numero, entityCode: doc.meta?.entity?.code });
  const url = normalizeUrl(doc.meta?.eli);
  const dateOpposabilite = opposability(form.datePublication, { opposabilite: { mode: form.mode, jours: form.jours } });
  const rule = opposabilityRule({ opposabilite: { mode: form.mode, jours: form.jours } });
  try {
    const dep = await post("/v1/actes", {
      akn, numero: doc.meta?.numero || "", objet: cons.objet || doc.meta?.objet || "",
      nature: doc.meta?.actTypeId || "Décision", entityId: doc.meta?.entity?.id || "", entityName: doc.meta?.entity?.name || "",
      dateSignature: doc.meta?.dateSignature || "", trameId: "", ecarts: 0,
    }, { token, flow, label: "Dépôt de la version consolidée" });
    if (!dep.ok) { toast("Version consolidée — dépôt : " + errorMessage(dep), "error"); return; }

    const circ = await post(`/v1/actes/${dep.body.id}/signature`, {
      signataires: [{ nom: auteur.nom, courriel: auteur.courriel, fonction: auteur.fonction, ordre: 1 }],
      niveau: "avancee",
    }, { token, flow, label: "Circuit de signature de la version consolidée" });
    if (!circ.ok) { toast("Version consolidée — circuit : " + errorMessage(circ), "error"); return; }

    // La consolidation est une compilation : elle est signée du même signataire
    // que l'acte modifié, et horodatée au moment de sa publication.
    const d = await prestataire.creerDocument({ xml: akn, titre: cons.objet || doc.meta?.objet || "", reference: doc.meta?.numero || "", flow });
    await prestataire.ajouterSignataire({ docId: d.id, signataire: auteur, flow });
    await prestataire.demarrer({ docId: d.id, flow });
    const bodyHtml = renderDocument(doc, config, {}).outerHTML.replace(/^<article[^>]*>/, "").replace(/<\/article>$/, "");
    const pack = await prestataire.signer({ docId: d.id, signataire: auteur, pageHtml: bodyHtml, brand: config.brand.name, pageCss: documentCss(config, styleForDoc(config, doc)), flow });
    const notif = await post("/v1/webhooks/signature", { signatureId: circ.body.signatureId, statut: "signee", documentSigne: pack }, { token, flow, label: "Signature de la version consolidée" });
    if (!notif.ok) { toast("Version consolidée — signature : " + errorMessage(notif), "error"); return; }

    const record = {
      eliUri: eliU, url, numero: doc.meta?.numero || "", nature: doc.meta?.actTypeId || "Décision",
      title: doc.nodes.find((n) => n.type === "title")?.text || cons.objet || "",
      objet: cons.objet || doc.meta?.objet || "", entityName: doc.meta?.entity?.name || "",
      // La version consolidée est datée du jour de la consolidation (et non de la
      // signature de l'acte d'origine) : c'est « le texte tel qu'il est » après
      // la modification, et c'est cette date qui la place après les versions
      // antérieures sous le même identifiant ELI.
      dateDocument: doc.meta?.consolidated?.date || doc.meta?.dateSignature || "",
      datePublication: form.datePublication,
      dateOpposabilite, opposabiliteRule: rule, recueil: form.recueil, kind: "consolidee",
      auteur: auteur.nom, originalSha256: pack.document.sha256,
    };
    const html = buildWebVersion({ doc, config, record });
    const jsonld = publicationJsonLd({ ...record, brandName: config.brand.name, signature: { signataires: [{ nom: auteur.nom }], signeLe: pack.signatures[0].signeLe, algorithme: "ECDSA P-256 / SHA-256" } });
    // Chaque consolidation publiée sous le même ELI doit avoir sa propre clé : on
    // date l'expression du document du jour de la consolidation.
    const dateExpression = String(doc.meta?.consolidated?.at || new Date().toISOString()).replace(/[^\d]/g, "").slice(0, 14);
    const payload = {
      eliUri: eliU, url, work: url, numero: record.numero, nature: record.nature, objet: record.objet,
      entityCode: doc.meta?.entity?.code || "", brandName: config.brand.name,
      dateDocument: record.dateDocument, datePublication: form.datePublication, dateExpression,
      dateOpposabilite, opposabiliteRule: rule, recueil: form.recueil, auteur: record.auteur,
      kind: "consolidee", html, akn, jsonld, original: pack,
    };
    const res = await post(`/v1/actes/${dep.body.id}/publication`, payload, {
      token, flow, label: "Publication de la version consolidée",
      idempotencyKey: `${eliU}@${dateExpression}-consolidee`,
    });
    if (!res.ok) { toast("Version consolidée — publication : " + errorMessage(res), "error"); return; }

    Object.assign(cons, {
      api: {
        acteId: dep.body.id, signatureId: circ.body.signatureId, docId: d.id, statut: "signee",
        sha256: dep.body.sha256, lienSignature: `${PRESTATAIRE.baseUrl}/signature/${circ.body.signatureId}`,
        signataire: auteur.nom, deposeLe: dep.body.deposeLe, akn,
      },
      original: pack, signeLe: pack.signatures[0].signeLe,
      statut: "publie", publication: { ...res.body, html, akn, jsonld },
      eli: eliU, datePublication: form.datePublication, dateOpposabilite,
      updatedAt: new Date().toISOString(), pendingConsolidation: false,
    });
    state.pubRegistre = { chargement: false };
    touch("actes", { rerender: false });
    toast(`Version consolidée publiée — elle devient la version en vigueur sous l'ELI ${eliU}`, "success");
    await journaliser({
      action: "publication.publie", cible: "acte", cibleLabel: libelleActe(cons), acteId: cons.id,
      detail: `version consolidée publiée sous l'ELI ${eliU} : elle devient la version en vigueur`,
      to: [cons.createdBy, "role:editeur"],
    });
  } catch (e) { toast("Version consolidée : " + String((e && e.message) || e), "error"); }
}

// Rétablit un acte signé auprès du service : dépôt du document Akoma Ntoso tel
// qu'il a été signé (donc avec la même empreinte), ouverture du circuit, puis
// notification de la signature déjà approuvée. Le service vérifie l'empreinte du
// document signé avant d'accepter — même règle que dans le circuit normal.
async function retablirActe(acte, doc, { token, flow }) {
  const akn = acte.original?.document?.akn || acte.api?.akn || aknOf(acte, doc);
  const auteur = auteurDe(acte, doc);
  const dep = await post("/v1/actes", {
    akn, numero: acte.numero || doc?.meta?.numero || "", objet: acte.objet || doc?.meta?.objet || "",
    nature: doc?.meta?.actTypeId || "Décision", entityId: doc?.meta?.entity?.id || "", entityName: doc?.meta?.entity?.name || "",
    dateSignature: acte.dateSignature || doc?.meta?.dateSignature || "", trameId: acte.trameId || "",
    ecarts: (acte.ecarts || []).length, publishable: actePubliable(acte),
  }, { token, flow, label: "Redépôt de l'acte signé" });
  if (!dep.ok) { toast(errorMessage(dep), "error"); return false; }
  const apiActeId = dep.body.id;
  const circ = await post(`/v1/actes/${apiActeId}/signature`, {
    signataires: [{ nom: auteur.nom, courriel: auteur.courriel, fonction: auteur.fonction, ordre: 1 }],
    niveau: "avancee",
  }, { token, flow, label: "Rétablissement du circuit de signature" });
  if (!circ.ok) { toast(errorMessage(circ), "error"); return false; }
  const signatureId = circ.body.signatureId;
  const notif = await post("/v1/webhooks/signature", {
    signatureId, statut: "signee", documentSigne: acte.original,
  }, { token, flow, label: "Notification de la signature déjà approuvée" });
  if (!notif.ok) { toast(errorMessage(notif), "error"); return false; }
  acte.api = {
    ...(acte.api || {}),
    acteId: apiActeId, signatureId, statut: "signee", sha256: dep.body.sha256,
    lienSignature: `${PRESTATAIRE.baseUrl}/signature/${signatureId}`,
    signataire: auteur.nom, deposeLe: dep.body.deposeLe, akn,
  };
  touch("actes", { rerender: false });
  return true;
}

async function tenterPublicationNonSignee(autres, ctx) {
  const a = autres[0];
  const doc = docOfActe(a);
  const config = state.config;
  const settings = publicationSettings(config);
  const flow = beginFlow("Contre-épreuve : publier un acte non signé");
  const akn = aknOf(a, doc);
  try {
    const dep = await post("/v1/actes", {
      akn, numero: a.numero || doc?.meta?.numero || "", objet: a.objet || "", nature: doc?.meta?.actTypeId || "Décision",
      entityId: doc?.meta?.entity?.id || "", entityName: doc?.meta?.entity?.name || "",
      dateSignature: a.dateSignature || "", trameId: a.trameId || "", ecarts: 0,
    }, { token: settings.jetonDemonstration, flow, label: "Dépôt (contre-épreuve)" });
    if (!dep.ok) { toast(errorMessage(dep), "error"); return; }
    const res = await post(`/v1/actes/${dep.body.id}/publication`, {
      eliUri: eliUriOf({ config, actTypeId: doc?.meta?.actTypeId, numero: a.numero, entityCode: doc?.meta?.entity?.code }),
      dateDocument: a.dateSignature || "", datePublication: todayIso(), html: "<p>—</p>", akn, jsonld: "",
      original: { format: "application/vnd.actes.original-signe+json", document: { akn, sha256: "" } },
    }, { token: settings.jetonDemonstration, flow, label: "Tentative de publication sans signature" });
    if (res.status === 409) {
      modal({
        title: "Le service a refusé la publication — c'est le comportement attendu",
        body: h("div", { class: "fr-stack" },
          h("p", { text: "Réponse HTTP " + res.status + " " + (res.body.code ? "(" + res.body.code + ")" : "") + " : " + (res.body.erreur || errorMessage(res)) }),
          h("p", { class: "fr-small fr-muted", text: "Un acte ne devient opposable qu'une fois signé puis publié : le service refuse donc de publier un acte qui n'a pas franchi l'étape de signature. C'est cette règle qui est démontrée ici." }),
          h("pre", { class: "fr-mono fr-codebox", text: JSON.stringify(res.body, null, 2) })),
        actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })],
      });
    } else {
      toast("Réponse inattendue : " + res.status, "warning");
    }
    ctx.paint();
  } catch (e) { toast(String((e && e.message) || e), "error"); }
}

// ------------------------------------------------------------- l'original signé

export function voirOriginal(acte) {
  const pack = acte.original;
  if (!pack) { toast("Aucun original signé pour cet acte.", "error"); return; }
  const s = pack.signatures?.[0] || {};
  const h0 = pack.horodatage || {};
  const body = h("div", { class: "fr-stack" },
    h("div", { class: "fr-row" },
      button("Ouvrir la page de l'original", { variant: "secondary", icon: "eye", onClick: () => ouvrirPage(pack.pageHtml, "Original signé") }),
      button("Imprimer / PDF", { variant: "secondary", icon: "download", onClick: () => printHtml(pack.pageHtml) }),
      button("Télécharger (JSON)", { variant: "secondary", icon: "download", onClick: () => download(`${(pack.reference || "acte").replace(/[^\w-]+/g, "_")}-original-signe.json`, JSON.stringify(pack, null, 2), "application/json") }),
    ),
    h("div", { class: "sig-cert" },
      h("h3", { text: "Signature" }),
      kv("Signataire", s.signataire?.nom),
      kv("Fonction", s.signataire?.fonction),
      kv("Signé le", new Date(s.signeLe).toLocaleString("fr-FR")),
      kv("Algorithme", s.algorithme),
      kv("Empreinte du document", pack.document?.sha256, true),
      kv("Valeur de signature", String(s.valeur || "").slice(0, 64) + "…", true),
    ),
    h("div", { class: "sig-cert" },
      h("h3", { text: "Certificat" }),
      kv("Sujet", s.certificat?.sujet), kv("Émetteur", s.certificat?.emetteur),
      kv("Numéro de série", s.certificat?.numeroSerie, true),
      kv("Validité", `${new Date(s.certificat?.valideDu).toLocaleDateString("fr-FR")} → ${new Date(s.certificat?.valideAu).toLocaleDateString("fr-FR")}`),
      kv("Empreinte", String(s.certificat?.empreinte || "").slice(0, 32) + "…", true),
    ),
    h("div", { class: "sig-cert" },
      h("h3", { text: "Horodatage" }),
      kv("Émis par", h0.emisPar), kv("Émis le", h0.emisLe ? new Date(h0.emisLe).toLocaleString("fr-FR") : ""),
      kv("Jeton", String(h0.valeur || "").slice(0, 64) + "…", true),
    ),
    h("p", { class: "fr-small fr-muted", text: "La vérification de cette signature (empreinte, clé publique du certificat, horodatage) est faite à la consultation de la publication, dans « Publications »." }),
  );
  modal({ title: "Original signé — " + (pack.reference || acte.numero || ""), wide: true, body, actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })] });
}

export function ouvrirPage(html, title) {
  const w = h("div", { class: "sig-doc-view" });
  const frame = h("iframe", { class: "sig-doc-frame", sandbox: "allow-same-origin", srcdoc: html || "<p>Document indisponible</p>" });
  w.appendChild(frame);
  modal({ title: title, wide: true, body: w, actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })] });
}
