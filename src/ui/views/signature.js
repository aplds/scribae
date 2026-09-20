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
import { state, touch, navigate, redrawView, can, actePubliable, journaliser, circuitDe, parapheurActif, controleLegaliteActif, revisionPour, revisionRequisePour, visibleActes } from "../state.js";
import { h, clear, button, toast, modal, icon, badge } from "../dom.js";
import { textField, selectField, emptyState, helpLink, confirmDialog } from "../components.js";
import { docOfActe, natureOf } from "./modifier.js";
import { exportAkn, printHtml, documentCss, exportMarkdown } from "../../lib/export.js";
import { renderDocument, applyPaper, documentToText } from "../../lib/render.js";
import { styleForDoc } from "../../lib/styles.js";
import { formatDate, download, todayIso } from "../../lib/util.js";
import {
  publicationSettings, eliUri as eliUriOf, opposability, opposabilityRule,
  buildWebVersion, publicationJsonLd, normalizeUrl,
} from "../../lib/eli.js";
import { PRESTATAIRE, prestataire } from "../../lib/signature.js";
import { validationPourSignature, avancement } from "../../lib/validation.js";
import { enregistrerFormalite } from "../../lib/execution.js";
import { CONTROLE_LEGALITE, verifierCertificatTransmission } from "../../lib/legalite.js";
import { get, post, connect, apiStatus, errorMessage, beginFlow, onStatus, recordExternal } from "../../lib/remote.js";
import { renderApiTab } from "./api-console.js";
import { soumettreARevision } from "../revision-actions.js";
import { appliquerAbrogations } from "../abrogations-apply.js";
import { hasRole, fullName } from "../../lib/users.js";
import {
  ROLE_SIGNATAIRE, personneDeCompte, etatRapprochement, rapprocher,
  placeDansChaine,
} from "../../lib/signataires.js";
import { fileSignature as fileSignatureDe } from "../state.js";

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

// Les messages de la publication se taisent pendant l'amorçage du recueil de
// démonstration (voir src/ui/demo-publications.js) : l'agent n'a pas à voir
// passer les notifications d'un geste que personne n'a demandé.
let silencieux = false;
const dire = (message, kind) => { if (!silencieux) toast(message, kind); };

const TABS = [
  // « Ma signature » n'apparaît qu'au signataire : c'est SA file, et l'onglet
  // par lequel il entre. Le circuit de signature, lui, montre tous les actes du
  // périmètre — donc, pour un signataire, ceux de son champ de compétence.
  { id: "ma-signature", label: "Ma signature", signataire: true },
  { id: "circuit", label: "Circuit de signature" },
  { id: "publication", label: "Publication (ELI)", perm: "signature.gerer" },
  { id: "api", label: "API & journal", perm: "api.gerer" },
];

export function renderSignature(root, params) {
  const ui = (state.signature = state.signature || { tab: null, acteId: null });
  const signataire = hasRole(state.user, ROLE_SIGNATAIRE);
  // L'onglet d'entrée d'un signataire est sa file ; celui d'un autre compte,
  // le circuit de signature (comportement historique).
  if (!ui.tab) ui.tab = signataire ? "ma-signature" : "circuit";
  if (ui.tab === "ma-signature" && !signataire) ui.tab = "circuit";
  if (ui.tab === "api" && !can("api.gerer")) ui.tab = "circuit";
  if (ui.tab === "publication" && !can("signature.gerer")) ui.tab = "circuit";
  const config = state.config;
  const settings = publicationSettings(config);
  // Les actes de CET écran sont ceux que le compte peut voir — un signataire
  // n'y trouve donc que son champ de compétence (voir visibleActes).
  const actes = visibleActes();
  const docs = new Map();
  for (const a of actes) { try { docs.set(a.id, docOfActe(a)); } catch { docs.set(a.id, null); } }
  const redraw = () => redrawView();
  const paint = () => { try { redraw(); } catch (e) { console.error(e); } };
  // Les actions de cet écran (envoyer en signature, publier) ne sont ouvertes que
  // lorsque le service répond : on redessine l'écran dès que son état change,
  // sinon un bouton calculé pendant la connexion resterait désactivé.
  watchApiStatus(apiStatus().status);
  // Le service est ouvert dès l'affichage de l'écran (sinon l'action resterait
  // désactivée jusqu'à ce qu'un appel soit déclenché ailleurs).
  try { connect(); } catch (e) { /* signalé par l'étiquette d'état */ }

  if (!actes.length) {
    root.appendChild(h("div", { class: "page-head" },
      h("div", { class: "page-head__text" },
        h("h1", { class: "page-head__title", text: "Signature & publication" }),
        h("p", { class: "page-head__sub", text: signataire
          ? "Les actes dont la signature relève de vous apparaissent ici, et nulle part ailleurs dans l'atelier."
          : "Envoi des actes finalisés en signature, puis publication et attribution de l'identifiant ELI." }),
      ),
      h("div", { class: "page-head__actions" }, helpLink("signature", "Comment faire ?")),
    ));
    root.appendChild(signataire
      ? emptyState("Aucun acte n'attend votre signature pour l'instant.", null)
      : emptyState("Aucun acte à signer pour l'instant : rédigez d'abord un acte.",
        button("Rédiger un acte", { variant: "primary", onClick: () => navigate("rediger") })));
    return;
  }

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Signature & publication" }),
      h("p", { class: "page-head__sub", text: signataire
        ? "Vous signez avec votre compte, rapproché de votre compte sur l'outil de signature. L'acte signé devient opposable à sa publication."
        : "L'acte signé devient opposable à sa publication. Le service de publication attribue alors son identifiant ELI." }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("signature", "Comment faire ?"),
      statusBadgeEl(),
      can("signature.gerer") ? button("Publications", { variant: "secondary", icon: "list", onClick: () => navigate("publications") }) : null,
    ),
  ));

  const tabs = h("div", { class: "fr-tabs" });
  for (const t of TABS) {
    if (t.signataire && !signataire) continue;
    if (t.perm && !can(t.perm)) continue;
    tabs.appendChild(h("button", {
      class: "fr-tab" + (ui.tab === t.id ? " fr-tab--active" : ""),
      text: t.label,
      onClick: () => { ui.tab = t.id; paint(); },
    }));
  }
  root.appendChild(tabs);

  if (ui.tab === "ma-signature") renderMaSignature(root, { docs, ui, paint, config, settings });
  else if (ui.tab === "circuit") renderCircuit(root, { docs, ui, paint, config, settings });
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

// -------------------------------------------------------------- ma signature
// La file du signataire. Deux temps, comme pour le parapheur et la révision :
// ce qui attend SA signature, et ce qui est signé au titre de sa délégation.
// L'écran dit aussi avec QUOI il signe : son compte de l'outil de signature,
// et l'état du rapprochement.
function renderMaSignature(root, ctx) {
  const { docs, ui, paint, config, settings } = ctx;
  const personne = personneDeCompte(config, state.user);
  const etat = personne ? etatRapprochement(config, state.users, personne.id) : null;
  const file = fileSignatureDe();
  const nom = personne ? [personne.civility, personne.firstName, personne.lastName].filter(Boolean).join(" ") : fullName(state.user);

  // ------------------------------------------------ l'identité et le compte
  const rapproche = h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Avec quel compte vous signez" }),
    h("div", { class: "sig-ident" },
      h("div", { class: "fr-stack" },
        h("p", { class: "fr-small fr-muted", style: { margin: 0 }, text: "Signataire" }),
        h("p", { style: { margin: 0 } }, h("strong", { text: nom || "—" })),
        h("p", { class: "fr-small", style: { margin: 0 }, text: personne ? ((config.roles || []).find((r) => r.id === personne.roles?.[0])?.label || "qualité non renseignée") : "Aucune personne du référentiel n'est rattachée à ce compte." })),
      h("div", { class: "fr-stack" },
        h("p", { class: "fr-small fr-muted", style: { margin: 0 }, text: "Compte de l'application" }),
        h("p", { style: { margin: 0 } }, h("strong", { text: etat?.compte ? (fullName(etat.compte) + " · " + (etat.compte.login || "")) : "—" })),
        h("p", { class: "fr-small fr-muted", style: { margin: 0 }, text: etat?.courriel || "adresse inconnue" })),
      h("div", { class: "fr-stack" },
        h("p", { class: "fr-small fr-muted", style: { margin: 0 }, text: "Compte sur l'outil de signature" }),
        h("p", { style: { margin: 0 } }, h("strong", { text: etat?.compteOutil || "—" })),
        etat?.ok
          ? h("span", { class: "fr-badge fr-badge--success", text: "Rapproché" })
          : h("span", { class: "fr-badge fr-badge--warning", text: "À rapprocher" }))),
    !personne
      ? h("div", { class: "fr-alert fr-alert--warning", style: { marginTop: "10px" } },
        h("p", { class: "fr-alert__title", text: "Aucune personne du référentiel" }),
        h("p", { class: "fr-small", text: "Un signataire signe au nom d'une personne : rattachez ce compte à celle qu'il tient dans « Comptes et rôles » (« Personne du référentiel — qui signe »). C'est ce lien qui donne la qualité et ouvre le champ de compétence." }))
      : null,
    etat && !etat.ok
      ? h("div", { class: "fr-alert fr-alert--warning", style: { marginTop: "10px" } },
        h("p", { class: "fr-alert__title", text: "Rapprochement nécessaire" }),
        h("p", { class: "fr-small", text: etat.motif }),
        personne
          ? h("p", { class: "fr-small fr-muted", text: "L'annuaire de la collectivité (OIDC) délivre le compte de l'application et provisionne le même agent sur l'outil de signature : le rapprochement les relie." })
          : null,
        personne
          ? button("Rapprocher avec l'outil de signature", {
            variant: "primary", size: "sm", icon: "check",
            onClick: async () => {
              const r = rapprocher(config, state.users, personne.id, { par: fullName(state.user) || state.user?.login || "" });
              if (!r.ok) { toast(r.motif, "warning"); return; }
              touch("config");
              await journaliser({
                action: "signature.rapproche", cible: "personne", cibleLabel: nom,
                detail: `compte rapproché de l'outil de signature (${r.etat.compteOutil})`, to: [],
              });
              toast("Compte rapproché de l'outil de signature.", "success");
              paint();
            },
          })
          : null)
      : null,
    etat?.ok
      ? h("p", { class: "fr-small fr-muted", style: { marginTop: "8px" }, text: `Rapproché le ${formatDate(String(etat.declare?.rapprocheLe || "").slice(0, 10), "date-long")}${etat.declare?.par ? " par " + etat.declare.par : ""}.` })
      : null);

  root.appendChild(rapproche);

  // ------------------------------------------------- ce qui attend ma signature
  if (!file.aSigner.length) {
    root.appendChild(h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: "Actes qui attendent votre signature" }),
      h("p", { class: "fr-small fr-muted", text: "Aucun acte n'attend votre signature." })));
  } else {
    root.appendChild(h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: `Actes qui attendent votre signature (${file.aSigner.length})` }),
      h("p", { class: "fr-small fr-muted", text: "Vérifiez le document, puis signez : l'empreinte du texte signé est conservée, et la publication suit la signature." }),
      ...file.aSigner.map((a) => elementSignature(a, docs, paint, config))));
  }

  // ------------------------------------------- ce qui est signé sous ma délégation
  if (file.engagee.length) {
    root.appendChild(h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: "Signés au titre de votre signature" }),
      h("p", { class: "fr-small fr-muted", text: "Ces actes sont signés par vos délégataires : votre signature y est engagée par délégation ou subdélégation, vous les suivez sans les signer vous-même." }),
      h("ul", { class: "sig-file" },
        ...file.engagee.map((a) => h("li", { class: "sig-file__item" },
          h("span", { class: "sig-file__num fr-mono", text: a.numero || "sans n°" }),
          h("span", { class: "sig-file__obj", text: a.objet || "—" }),
          h("span", { class: "fr-small fr-muted", text: personne ? placeDansChaine(config, a, state.trames.find((t) => t.id === a.trameId), personne.id) : "" }),
          button("Ouvrir", { variant: "tertiary", size: "sm", icon: "eye", onClick: () => navigate("acte/" + a.id) }))))));
  }
}

// Une ligne de la file : l'acte, son état, et le geste de signature. L'acte pas
// encore déposé l'est au premier clic — c'est le même chemin que « Envoyer en
// signature », avec l'outil ouvert dans la foulée.
function elementSignature(a, docs, paint, config) {
  const doc = docs.get(a.id) || null;
  const blocking = (a.issues || doc?.issues || []).filter((i) => i.level === "blocking");
  const dejaDepose = !!a.api?.docId;
  const pret = pretPourSignatureAction(a);
  const raison = blocking.length ? "L'acte comporte un contrôle bloquant." : (!pret.ok ? pret.raison : "");
  return h("div", { class: "sig-file__item sig-file__item--action" },
    h("span", { class: "sig-file__num fr-mono", text: a.numero || "sans n°" }),
    h("span", { class: "sig-file__obj", text: a.objet || doc?.meta?.objet || "—" }),
    h("span", { class: "fr-small fr-muted", text: dejaDepose ? "circuit ouvert — " + (a.api?.statut || "") : "à déposer" }),
    button(dejaDepose ? "Signer" : "Déposer et signer", {
      variant: "primary", size: "sm", icon: "lock",
      disabled: apiStatus().status !== "online" || !!raison,
      title: raison || "Ouvrir l'outil de signature pour cet acte",
      onClick: async () => {
        const ctx = { docs, paint };
        if (dejaDepose) await ouvrirOutil(a, doc, ctx, true);
        else await envoyerEnSignature(a, ctx, { ouvrirOutil: true });
      },
    }));
}

// Les portes que l'acte doit avoir franchies avant la signature : parapheur
// (fonction expérimentale) puis révision. On les interroge sans redessiner.
function pretPourSignatureAction(a) {
  const para = parapheurActif() ? validationPourSignature(a) : { ok: true, raison: "" };
  if (!para.ok) return para;
  return revisionPour(a);
}

// ------------------------------------------------------------------ le circuit

function renderCircuit(root, ctx) {
  const { docs, ui, paint, config, settings } = ctx;
  const acts = visibleActes().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
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
  // Le parapheur est une fonction expérimentale : éteint, il ne conditionne
  // rien et n'apparaît pas dans le circuit (Administration › Expérimentale).
  const parapheur = parapheurActif();
  const para = parapheur ? validationPourSignature(acte) : { ok: true, raison: "" };
  const paraAvancement = avancement(acte.validation);
  // Révision : le contrôle du réviseur, entre l'envoi décidé par le rédacteur et
  // l'envoi effectif (voir src/lib/revision.js). Elle n'existe que s'il y a un
  // réviseur compétent pour l'acte ; `rev.requise` dit si la marche existe.
  const rev = revisionPour(acte);
  const enRevision = acte.revision?.statut === "en_attente";
  // Transmission au contrôle de légalité : fonction expérimentale, éteinte par
  // défaut. Active, elle ajoute une marche ENTRE la signature et la
  // publication, et l'acte signé y passe automatiquement (voir plus bas).
  const controleLegalite = controleLegaliteActif();

  right.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: `Circuit — ${acte.numero || "acte sans numéro"}` }),
    h("p", { class: "fr-small fr-muted", text: [acte.objet, doc?.meta?.entity?.name].filter(Boolean).join(" · ") }),
    h("div", { class: "sig-steps" },
      // Les étapes sont numérotées par POSITION : la marche « Parapheur »
      // disparaît quand la fonction expérimentale est éteinte, sans trou dans la
      // numérotation.
      ...etapesCircuit({
        parapheur, validation: acte.validation, para, paraAvancement, circuit: circuitDe(acte),
        blocking, doc, acte, signed, publiable, rev,
        controleLegalite, transmission: acte.execution?.transmission || null,
      }).map((e, i) => stepEl(i + 1, e.title, e.done, e.lines)),
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
    const libelle = enRevision ? "Transmis au réviseur" : (rev.requise && !rev.ok ? "Soumettre au réviseur" : (acte.api?.acteId ? "Reprendre le circuit" : "Envoyer en signature"));
    row.appendChild(button(libelle, {
      variant: "primary", icon: enRevision ? "check" : "upload",
      disabled: apiStatus().status !== "online" || blocking.length > 0 || !para.ok || enRevision,
      title: blocking.length ? "L'acte comporte un contrôle bloquant"
        : !para.ok ? para.raison
          : enRevision ? "L'acte attend la décision du réviseur"
            : rev.requise && !rev.ok ? "L'acte sera transmis au réviseur, qui le validera ou le rejettera"
              : "Déposer l'acte et ouvrir le circuit de signature",
      onClick: () => envoyerEnSignature(acte, { docs, paint }),
    }));
    if (parapheur && !para.ok) {
      row.appendChild(button("Ouvrir le parapheur", {
        variant: "secondary", icon: "check",
        onClick: () => { state.parapheur = { tab: "enCours", acteId: acte.id }; navigate("parapheur"); },
      }));
    }
    if (rev.requise) {
      row.appendChild(button("Ouvrir la révision", {
        variant: "secondary", icon: "eye",
        onClick: () => { state.revision = { tab: enRevision ? "aReviser" : "rejets", acteId: acte.id }; navigate("revision"); },
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
  if (parapheur && !signed && !para.ok) {
    actions.appendChild(h("div", { class: "fr-alert fr-alert--warning", style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: "Parapheur non achevé" }),
      h("p", { class: "fr-small", text: para.raison }),
      h("p", { class: "fr-small fr-muted", text: "Le service refuse d'ouvrir un circuit de signature sur un acte dont la validation n'est pas achevée : c'est ce qui garantit que l'acte signé est bien celui qui a été approuvé." }),
    ));
  }
  // Révision : le contrôle du réviseur. Tant qu'elle n'est pas faite, l'acte ne
  // part pas — et le service refuse lui aussi d'ouvrir le circuit.
  if (rev.requise && !signed && !rev.ok) {
    const rejete = acte.revision?.statut === "rejete";
    actions.appendChild(h("div", { class: "fr-alert fr-alert--" + (rejete ? "error" : "warning"), style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: enRevision ? "En attente de révision" : rejete ? "Acte rejeté en révision" : "Révision requise avant la signature" }),
      h("p", { class: "fr-small", text: rev.raison }),
      h("p", { class: "fr-small fr-muted", text: rejete
        ? "Corrigez l'acte, puis soumettez-le de nouveau au réviseur : c'est le nouvel envoi qui vaut demande de révision."
        : "Un réviseur est compétent pour cet acte : « Envoyer en signature » le transmet d'abord au réviseur, qui le validera (l'acte part alors en signature) ou le rejettera (il revient en brouillon, avec le motif)." }),
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

// Les marches du circuit de signature, dans l'ordre — SANS numérotation : le
// numéro est la position dans cette liste. La marche « Parapheur » n'y figure
// que si la fonction expérimentale est active, et la marche « Transmis au
// contrôle de légalité » que si la sienne l'est : la liste, plutôt qu'une suite
// d'appels numérotés à la main, évite un trou dans la numérotation.
function etapesCircuit({ parapheur, validation, para, paraAvancement, circuit, blocking, doc, acte, signed, publiable, rev, controleLegalite, transmission }) {
  const etapes = [{
    title: "Acte finalisé",
    done: !!(acte.values || acte.doc),
    lines: [
      blocking.length ? `${blocking.length} contrôle(s) bloquant(s) : la signature est déconseillée` : "Aucun contrôle bloquant",
      doc?.meta?.eli ? "ELI pressenti : " + normalizeUrl(doc.meta.eli) : "",
    ].filter(Boolean),
  }];
  if (parapheur) {
    etapes.push(validation
      ? {
        title: "Parapheur — " + (validation.circuitLabel || "circuit de validation"),
        done: para.ok,
        lines: [`${paraAvancement.faites}/${paraAvancement.total} étape(s) franchie(s)`, para.ok ? "" : para.raison].filter(Boolean),
      }
      : {
        title: "Parapheur",
        done: true,
        lines: [circuit ? "Aucun circuit ouvert : l'acte part en signature sans validation préalable." : "Aucun circuit ne s'applique à cet acte."],
      });
  }
  // La marche de la révision n'apparaît que si un réviseur est compétent pour
  // l'acte : sans réviseur, il n'y a pas de contrôle à montrer.
  if (rev?.requise) {
    const r = acte.revision;
    etapes.push({
      title: "Révision — contrôle avant signature",
      done: rev.ok,
      lines: [
        r ? (r.statut === "rejete" ? "Rejeté : " + (r.motif || "motif au dossier")
          : r.statut === "en_attente" ? "En attente" + (r.demandeeParNom ? ` (soumis par ${r.demandeeParNom})` : "")
            : `${r.valideParNom || "révisé"} le ${formatDate(String(r.valideLe || "").slice(0, 10))}${r.corrige ? " · texte corrigé" : ""}`)
          : "Pas encore soumis au réviseur",
        rev.ok ? "" : rev.raison,
      ].filter(Boolean),
    });
  }
  etapes.push({
    title: "Déposé au service",
    done: !!acte.api?.acteId,
    lines: acte.api
      ? [`Identifiant ${acte.api.acteId}`, acte.api.sha256 ? "Empreinte SHA-256 " + acte.api.sha256.slice(0, 16) + "…" : ""].filter(Boolean)
      : ["En attente d'envoi"],
  });
  etapes.push({
    title: "Envoyé en signature",
    done: !!(acte.api?.statut && acte.api.statut !== "depose"),
    lines: acte.api?.signataire ? [`Signataire : ${acte.api.signataire}`, `Prestataire : ${PRESTATAIRE.nom}`] : ["En attente"],
  });
  etapes.push({
    title: "Signé",
    done: !!(acte.original || acte.statut === "signee" || acte.statut === "publie"),
    lines: acte.original
      ? [`Signé le ${formatDate(String(acte.original.signatures?.[0]?.signeLe || "").slice(0, 10))}`, (acte.original.signatures?.[0]?.certificat?.sujet || "")]
      : ["En attente de la signature"],
  });
  // La transmission au contrôle de légalité s'intercale ICI : après le retour
  // signé, avant la publication. Elle n'existe que si la fonction est active.
  if (controleLegalite) {
    etapes.push({
      title: "Transmis au contrôle de légalité",
      done: !!transmission,
      lines: transmission
        ? [transmission.certificat?.mention || `Transmis le ${formatDate(transmission.at)}`, transmission.ref ? `réf. ${transmission.ref}` : "", transmission.certificat?.sceau ? `sceau ${String(transmission.certificat.sceau).slice(0, 16)}…` : ""].filter(Boolean)
        : ["En attente de la télétransmission (API @ctes)"],
    });
  }
  etapes.push(publiable
    ? {
      title: "Publié et opposable",
      done: acte.statut === "publie" && !!acte.publication,
      lines: acte.publication
        ? [`ELI ${acte.publication.eliUri}`, `Opposable le ${formatDate(acte.publication.dateOpposabilite)}`]
        : ["En attente de publication"],
    }
    : {
      title: "Non publié (acte individuel)",
      done: signed,
      lines: ["La trame a déclaré cet acte non publiable.", "L'acte signé est conservé au registre et notifié à l'intéressé."],
    });
  return etapes;
}

// --------------------------------------------------------- envoi et signature

function aknOf(acte, doc) {
  const trame = state.trames.find((t) => t.id === acte.trameId);
  return exportAkn(doc, state.config, trame);
}

// Le THÈME de l'acte — la famille de sa trame, celle qui classe l'acte dans le
// recueil public (« Urbanisme et voirie », « Police administrative »…). Le
// service ne connaît pas les trames : le thème lui est donc transmis au dépôt,
// il le conserve sur l'acte, et la publication le reprend. C'est lui qui donne
// au recueil sa page par thème — voir src/lib/recueil.js.
function themeDe(acte, doc) {
  const id = (state.trames.find((t) => t.id === acte?.trameId)?.familyId) || doc?.meta?.familyId || "";
  if (!id) return { themeId: "", themeLabel: "" };
  const f = (state.config?.families || []).find((x) => x.id === id);
  return { themeId: id, themeLabel: (f && f.label) || "" };
}

// Libellé d'un acte dans le journal et les notifications : le numéro s'il
// existe, sinon l'objet, sinon l'identifiant technique.
const libelleActe = (acte) => acte.numero || acte.objet || acte.id;

// Qui signe : la personne désignée par l'acte, son compte, et le compte que
// l'outil de signature lui connaît. C'est cet ensemble que le prestataire
// reçoit — un signataire sans compte rapproché signerait anonymement.
function auteurDe(acte, doc) {
  const sig = doc?.meta?.signataire;
  const config = state.config;
  const etat = sig?.id ? etatRapprochement(config, state.users, sig.id) : null;
  return {
    nom: sig ? [sig.civility, sig.firstName, sig.lastName].filter(Boolean).join(" ") : (doc?.meta?.entity?.authorityFormula || "Signataire"),
    fonction: sig ? ((config.roles || []).find((r) => r.id === sig.roles?.[0])?.label || "") : "",
    courriel: String(etat?.courriel || sig?.courriel || "").trim(),
    entite: doc?.meta?.entity?.name || "",
    // Le rapprochement : la personne, son compte, et le compte de l'outil de
    // signature (voir src/lib/signataires.js).
    personId: sig?.id || "",
    compteId: etat?.compte?.id || "",
    compteOutil: etat?.compteOutil || "",
    rapproche: !!etat?.ok,
  };
}

// Le geste d'envoi en signature est exporté : le bureau de la révision le
// déclenche à la validation d'un acte révisé (« si l'acte est validé, il part en
// signature »), par ce chemin-là et pas un autre.
export async function envoyerEnSignature(acte, ctx, { ouvrirOutil: ouvrir = true } = {}) {
  const config = state.config;
  const doc = ctx.docs.get(acte.id) || docOfActe(acte);
  const settings = publicationSettings(config);
  const token = settings.jetonDemonstration;
  // Porte du parapheur : l'acte signé doit être l'acte approuvé. Le service
  // applique la même règle (409 « validation_incomplete »), mais on évite un
  // aller-retour voué à l'échec et on explique le motif à l'agent.
  // Parapheur éteint (fonction expérimentale) : aucune porte de ce côté, et
  // l'état de validation n'est pas transmis au service.
  const parapheur = parapheurActif();
  const para = parapheur ? validationPourSignature(acte) : { ok: true, raison: "" };
  if (!para.ok) { toast(para.raison, "warning"); return; }
  // Porte de la RÉVISION : le geste du rédacteur ne fait pas partir l'acte en
  // signature, il le SOUMET au réviseur (voir src/lib/revision.js). C'est le
  // réviseur qui, en le validant, déclenche l'envoi — par ce même chemin.
  const rev = revisionPour(acte);
  if (rev.requise && !rev.ok) {
    if (acte.revision?.statut === "en_attente") { toast("L'acte est déjà en attente de révision.", "info"); return; }
    await soumettreARevision(acte, { paint: ctx.paint });
    return;
  }
  const flow = beginFlow(`Dépôt et envoi en signature — ${acte.numero || acte.id}`);
  const akn = aknOf(acte, doc);
  const auteur = auteurDe(acte, doc);
  try {
    const dep = await post("/v1/actes", {
      akn, numero: acte.numero || doc.meta?.numero || "", objet: acte.objet || doc.meta?.objet || "",
      nature: doc.meta?.actTypeId || "Décision", entityId: doc.meta?.entity?.id || "", entityName: doc.meta?.entity?.name || "",
      dateSignature: acte.dateSignature || doc.meta?.dateSignature || "", trameId: acte.trameId || "",
      ecarts: (acte.ecarts || []).length,
      // Le thème (la famille de la trame) part avec l'acte : c'est ce qui
      // permettra au recueil public de classer l'acte, et à ses lecteurs de le
      // retrouver par matière.
      ...themeDe(acte, doc),
      // La publication est une propriété de la trame : le service ne connaît pas
      // les trames, donc on la lui transmet au dépôt, et il la fera respecter.
      publishable: actePubliable(acte),
      // L'étape de transmission au contrôle de légalité est demandée au dépôt
      // (fonction expérimentale) : le service refusera alors de publier l'acte
      // tant que sa transmission n'aura pas été enregistrée.
      controleLegalite: controleLegaliteActif(),
      // L'état du parapheur accompagne l'acte : le service peut ainsi refuser
      // d'ouvrir un circuit sur un acte non validé, et l'empreinte du texte
      // validé reste attachée à l'acte signé.
      validation: parapheur && acte.validation ? {
        statut: acte.validation.statut,
        circuitLabel: acte.validation.circuitLabel || "",
        empreinte: acte.validation.empreinte || "",
        closLe: acte.validation.closLe || "",
        etapes: (acte.validation.steps || []).map((s) => s.statut),
      } : null,
      // L'état de la RÉVISION accompagne l'acte de la même façon : le service
      // refuse d'ouvrir un circuit sur un acte dont la révision n'est pas
      // faite, et la trace de qui a révisé quoi reste attachée à l'acte signé.
      revision: rev.requise && acte.revision ? {
        statut: acte.revision.statut,
        empreinte: acte.revision.empreinte || "",
        valideLe: acte.revision.valideLe || "",
        corrige: acte.revision.corrige === true,
        par: acte.revision.valideParNom || "",
      } : null,
    }, { token, flow, label: "Dépôt de l'acte finalisé" });
    if (!dep.ok) { toast(errorMessage(dep), "error"); return; }
    const apiActeId = dep.body.id;

    const sig = await post(`/v1/actes/${apiActeId}/signature`, {
      signataires: [{ nom: auteur.nom, courriel: auteur.courriel, fonction: auteur.fonction, ordre: 1, compte: auteur.compteOutil || "" }],
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
    toast(rev.requise
      ? "Acte déposé et circuit de signature ouvert après révision."
      : "Acte déposé et circuit de signature ouvert.", "success");
    await journaliser({
      action: "signature.depot", cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
      detail: `déposé au service (${apiActeId}), circuit ${signatureId} ouvert`
        + (rev.requise ? ` — révisé${acte.revision?.corrige ? " après correction" : ""}` : ""),
      to: [acte.createdBy, "role:editeur"],
    });
    ctx.paint();
    if (ouvrir) await ouvrirOutil(acte, doc, ctx, true);
  } catch (e) {
    toast(String((e && e.message) || e), "error");
  }
}

async function releverStatut(acte, ctx) {
  const flow = beginFlow("Relève du statut");
  try {
    const res = await get(`/v1/signatures/${acte.api.signatureId}`, { flow, label: "Suivi du circuit de signature" });
    if (!res.ok) { toast(errorMessage(res), "error"); return; }
    const dejaSigne = !!(acte.original || acte.statut === "signee" || acte.statut === "publie");
    acte.api.statut = res.body.statut;
    if (res.body.statut === "signee") { acte.statut = "signee"; acte.original = res.body.documentSigne || acte.original; }
    touch("actes", { rerender: false });
    // Le retour signé vaut publication : c'est la relève qui l'a constaté.
    if (res.body.statut === "signee" && !dejaSigne && acte.original) { await publierApresSignature(acte, ctx.paint); return; }
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
        h("p", { class: "fr-small fr-muted", text: "Compte de signature" }),
        h("p", { class: "fr-small", text: auteur.compteOutil || "aucun compte rapproché" }),
        auteur.rapproche ? null : h("p", { class: "fr-small sig-tool__warn", text: "Ce signataire n'a pas encore été rapproché de l'outil de signature : la signature serait anonyme. Le rapprochement se fait depuis « Ma signature », ou depuis sa fiche dans l'organigramme des délégations." }),
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
  await journaliser({
    action: "signature.signe", cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
    detail: `signé par ${auteur.nom} — empreinte ${String(pack.document?.sha256 || "").slice(0, 16)}…`,
    to: [acte.createdBy, "role:editeur"],
  });
  // Le retour signé publie l'acte publiable : l'agent n'a pas d'autre geste à
  // faire. Un acte individuel (trame non publiable) s'arrête à la signature.
  await publierApresSignature(acte, ctx.paint);
}

// Suite automatique du retour signé. L'étape de transmission au contrôle de
// légalité s'intercale d'abord (quand la fonction est active) : l'acte signé est
// télétransmis, et son certificat est déposé sur le document. Vient ensuite la
// publication : un acte publiable part au recueil ; un acte individuel — trame
// déclarée non publiable — est conservé au registre et notifié à l'intéressé,
// sans dépôt.
//
// Toute cette suite est éteinte par le réglage « publication automatique »
// (Administration › Publication) : une administration qui publie dans son propre
// système ne veut pas voir l'application déposer les actes à sa place.
async function publierApresSignature(acte, paint) {
  const doc = docOfActe(acte);
  const publiable = actePubliable(acte);
  if (publicationSettings(state.config).auto === false) {
    toast("Acte signé. La publication automatique est désactivée : l'acte reste au registre, à publier le moment venu.", "success");
    await journaliser({
      action: "publication.automatique_eteinte", cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
      detail: "acte signé — publication automatique désactivée (Administration › Publication)",
      to: [acte.createdBy],
    });
    paint();
    return;
  }
  // 1. L'étape de transmission au contrôle de légalité. Tant qu'elle n'a pas
  // abouti, l'acte n'est pas publié : c'est l'ordre « signé → transmis →
  // publié », que le service applique lui aussi (409 transmission_absente).
  if (controleLegaliteActif() && doc && acte.api?.acteId) {
    toast("Acte signé — transmission au contrôle de légalité…", "info");
    const transmis = await transmettreAuControleDeLegalite(acte, doc);
    if (!transmis) { paint(); return; }
  }
  // 2. La publication.
  if (!publiable) {
    toast("Acte signé — acte individuel : conservé au registre, non publié au recueil.", "success");
    paint();
    return;
  }
  if (!doc || !acte.api?.acteId) {
    toast("Acte signé. Il peut maintenant être publié.", "success");
    paint();
    return;
  }
  const settings = publicationSettings(state.config);
  // La publication ne peut pas précéder la signature : si la date de l'acte est
  // postérieure à aujourd'hui, c'est elle qui est retenue.
  const dateSignature = acte.dateSignature || doc.meta?.dateSignature || "";
  const datePublication = dateSignature && dateSignature > todayIso() ? dateSignature : todayIso();
  toast("Acte signé — publication automatique au recueil…", "info");
  await publier(acte, doc, {
    datePublication, mode: settings.opposabilite.mode, jours: settings.opposabilite.jours,
    recueil: settings.recueil, publishConsolide: true,
  }, paint);
}

// ------------------------------------------------- transmission au contrôle de légalité
// L'acte signé est adressé à l'API d'envoi du contrôle de légalité, qui en
// accuse réception : cet accusé de réception vaut certificat de transmission
// (« Transmis au contrôle de légalité le … à … »). Le certificat est déposé sur
// le document — l'original signé et la version publiée — et la formalité est
// constatée par le service, sans geste de l'agent. C'est alors seulement que
// l'acte est publié (voir publierApresSignature).
async function transmettreAuControleDeLegalite(acte, doc) {
  const settings = publicationSettings(state.config);
  const flow = beginFlow(`Transmission au contrôle de légalité — ${acte.numero || acte.id}`);
  const auteur = auteurDe(acte, doc);
  const at = new Date().toISOString();
  const empreinte = acte.original?.document?.sha256 || acte.api?.sha256 || "";
  const t0 = (globalThis.performance || Date).now();
  try {
    const res = await post(`/v1/actes/${acte.api.acteId}/transmission`, {
      at, mode: CONTROLE_LEGALITE.mode, destinataire: CONTROLE_LEGALITE.destinataire,
      auteur: auteur.nom, entite: auteur.entite,
    }, { token: settings.jetonDemonstration, flow, label: "Télétransmission au contrôle de légalité (@ctes)" });
    // L'appel sortant vers l'API d'envoi est tracé comme les autres : le journal
    // de l'API montre ce qui est réellement parti, et vers quelle adresse.
    recordExternal({
      service: CONTROLE_LEGALITE.id, method: "POST", url: CONTROLE_LEGALITE.apiUrl,
      request: { numero: acte.numero, objet: acte.objet, destinataire: CONTROLE_LEGALITE.destinataire, mode: CONTROLE_LEGALITE.mode, empreinte, auteur: auteur.nom },
      response: res.ok ? { reference: res.body.reference, recuLe: res.body.recuLe, certificat: res.body.certificat?.mention } : (res.body || null),
      status: res.status, ms: Math.round(((globalThis.performance || Date).now()) - t0), flow,
      label: "Télétransmission à la préfecture",
    });
    if (!res.ok) { dire("Transmission au contrôle de légalité : " + errorMessage(res), "error"); return false; }
    const certificat = res.body.certificat;
    enregistrerFormalite(acte, "transmission", {
      at: String(res.body.recuLe || at).slice(0, 10),
      ref: res.body.reference, mode: res.body.mode || CONTROLE_LEGALITE.mode,
      certificat,
      api: { url: CONTROLE_LEGALITE.apiUrl, statut: res.status, recuLe: res.body.recuLe },
      by: state.user?.id, byName: [state.user?.firstName, state.user?.lastName].filter(Boolean).join(" ") || auteur.nom,
    });
    // Le certificat est déposé SUR LE DOCUMENT : l'original signé le porte, et
    // la version publiée le reprendra (voir src/lib/eli.js).
    if (acte.original) acte.original.transmission = certificat;
    acte.updatedAt = new Date().toISOString();
    touch("actes", { rerender: false });
    dire(certificat?.mention || "Acte transmis au contrôle de légalité.", "success");
    await journaliser({
      action: "formalite.transmission", cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
      detail: `télétransmis au contrôle de légalité (${res.body.reference || "sans référence"}) — ${certificat?.mention || ""}`,
      to: [acte.createdBy, "role:editeur"],
    });
    return true;
  } catch (e) {
    dire("Transmission au contrôle de légalité : " + String((e && e.message) || e), "error");
    return false;
  }
}

// ---------------------------------------------------------------- publication

function renderPublication(root, ctx) {
  const { docs, ui, paint, config, settings } = ctx;
  const form = (ui.pub = ui.pub || { datePublication: todayIso(), mode: settings.opposabilite.mode, jours: settings.opposabilite.jours, recueil: settings.recueil, publishConsolide: true });
  const acts = visibleActes().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
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
  if (!actePubliable(acte)) { dire("Cet acte est déclaré non publiable par sa trame : il ne peut pas être déposé au recueil.", "error"); return; }
  // L'étape de transmission au contrôle de légalité vaut aussi pour la
  // publication MANUELLE : quand elle est active et qu'elle n'a pas encore eu
  // lieu (transmission automatique en échec, acte signé avant l'activation), on
  // transmet d'abord — le service refuserait de publier (409 transmission_absente).
  if (controleLegaliteActif() && acte.api?.acteId && !acte.execution?.transmission) {
    if (!(await transmettreAuControleDeLegalite(acte, doc))) return;
  }
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
  const theme = themeDe(acte, doc);
  const record = {
    eliUri: eliU, url, numero: acte.numero || doc.meta?.numero || "", nature: doc.meta?.actTypeId || "Décision",
    ...theme,
    title: (doc.nodes.find((n) => n.type === "title")?.text) || acte.objet || "",
    objet: acte.objet || doc.meta?.objet || "", entityName: doc.meta?.entity?.name || "",
    dateDocument: acte.dateSignature || doc.meta?.dateSignature || "", datePublication: form.datePublication,
    dateOpposabilite, opposabiliteRule: rule, recueil: form.recueil, kind: kindFor(acte),
    auteur: auteurDe(acte, doc).nom, originalSha256: acte.original?.document?.sha256 || "",
    // Le certificat de transmission au contrôle de légalité, s'il y en a un :
    // la version en ligne en porte la mention, et le registre des publications
    // le conserve (voir src/lib/eli.js).
    transmission: acte.execution?.transmission?.certificat || null,
  };
  const html = buildWebVersion({ doc, config, record });
  const jsonld = publicationJsonLd({ ...record, brandName: config.brand.name, signature: { signataires: [{ nom: record.auteur }], signeLe: acte.signeLe, algorithme: "ECDSA P-256 / SHA-256" } });
  const kind = kindFor(acte);
  // Le texte de l'acte voyage avec sa publication, en Markdown et en texte brut :
  // c'est ce que lisent les moteurs et les agents (voir le recueil ouvert,
  // `src/server/mysql/actes.mjs`). Les notes de préparation en sont ÉCARTÉES :
  // c'est l'acte qui est publié, pas les notes de l'atelier.
  const md = exportMarkdown(doc, config, { notes: false });
  const texte = documentToText(doc, config);
  const payload = {
    eliUri: eliU, url, work: url, numero: record.numero, nature: record.nature, objet: record.objet,
    entityCode: doc.meta?.entity?.code || "", brandName: config.brand.name,
    dateDocument: record.dateDocument, datePublication: form.datePublication, dateOpposabilite,
    opposabiliteRule: rule, recueil: form.recueil, auteur: record.auteur, kind,
    html, akn, jsonld, md, texte, original: acte.original, transmission: record.transmission,
    ...theme,
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
    if (!res.ok) { dire(errorMessage(res), "error"); return; }
    acte.publication = { ...res.body, html, akn, jsonld, md, texte };
    acte.statut = "publie";
    acte.eli = eliU;
    acte.datePublication = form.datePublication;
    acte.dateOpposabilite = dateOpposabilite;
    acte.updatedAt = new Date().toISOString();
    // Le registre public a changé : on invalide son cache pour qu'il se recharge.
    state.pubRegistre = { chargement: false };
    touch("actes", { rerender: false });
    dire(`Acte publié — ELI ${eliU}`, "success");
    await journaliser({
      action: "publication.publie", cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
      detail: `publié sous l'ELI ${eliU}, opposable le ${dateOpposabilite}`,
      to: [acte.createdBy, "role:editeur"],
    });
    // Un acte qui prévoyait des abrogations peut désormais les faire courir :
    // elles prennent effet au jour de son ENTRÉE EN VIGUEUR (voir
    // src/ui/abrogations-apply.js — idempotent).
    appliquerAbrogations().catch((e) => console.warn("Abrogations :", e));

    // Une modification n'est complète que lorsque le texte consolidé est publié :
    // c'est lui qui devient la version en vigueur de l'acte d'origine.
    if (kind === "modificative" && form.publishConsolide !== false) {
      const cons = acte.consolideId ? state.actes.find((x) => x.id === acte.consolideId) : null;
      if (cons && cons.statut !== "publie") {
        dire("Publication de la version consolidée…", "info");
        await publierConsolide(cons, form, { token, flow });
      }
    }
    paint();
  } catch (e) { dire(String((e && e.message) || e), "error"); }
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
      ...themeDe(cons, doc),
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
    const md = exportMarkdown(doc, config, { notes: false });
    const texte = documentToText(doc, config);
    // Chaque consolidation publiée sous le même ELI doit avoir sa propre clé : on
    // date l'expression du document du jour de la consolidation.
    const dateExpression = String(doc.meta?.consolidated?.at || new Date().toISOString()).replace(/[^\d]/g, "").slice(0, 14);
    const payload = {
      eliUri: eliU, url, work: url, numero: record.numero, nature: record.nature, objet: record.objet,
      entityCode: doc.meta?.entity?.code || "", brandName: config.brand.name,
      dateDocument: record.dateDocument, datePublication: form.datePublication, dateExpression,
      dateOpposabilite, opposabiliteRule: rule, recueil: form.recueil, auteur: record.auteur,
      kind: "consolidee", html, akn, jsonld, md, texte, original: pack,
      ...themeDe(cons, doc),
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
      statut: "publie", publication: { ...res.body, html, akn, jsonld, md, texte },
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
    // Une consolidation qui retire TOUTES les dispositions de l'acte vaut
    // abrogation de l'acte : elle devient opposable avec elle (voir
    // `abrogePar`, et ui/abrogations-apply.js pour les abrogations prévues).
    const socle = cons.consolidatesId ? state.actes.find((x) => x.id === cons.consolidatesId) : null;
    if (socle && doc.meta?.consolidated?.abrogation) {
      socle.abrogePar = {
        acteId: cons.id, numero: cons.numero || "", designation: doc.meta?.designation || "",
        date: doc.meta?.consolidated?.date || doc.meta?.dateSignature || "", eli: eliU,
        dateEntreeEnVigueur: dateOpposabilite, enAttente: false,
      };
      socle.updatedAt = new Date().toISOString();
      touch("actes", { rerender: false });
      await journaliser({
        action: "abrogation.appliquee", cible: "acte", cibleLabel: socle.numero || socle.id, acteId: socle.id,
        detail: `acte abrogé par la version consolidée publiée sous l'ELI ${eliU}`, to: [],
      });
    }
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
    controleLegalite: controleLegaliteActif(),
    ...themeDe(acte, doc),
  }, { token, flow, label: "Redépôt de l'acte signé" });
  if (!dep.ok) { dire(errorMessage(dep), "error"); return false; }
  const apiActeId = dep.body.id;
  const circ = await post(`/v1/actes/${apiActeId}/signature`, {
    signataires: [{ nom: auteur.nom, courriel: auteur.courriel, fonction: auteur.fonction, ordre: 1 }],
    niveau: "avancee",
  }, { token, flow, label: "Rétablissement du circuit de signature" });
  if (!circ.ok) { dire(errorMessage(circ), "error"); return false; }
  const signatureId = circ.body.signatureId;
  const notif = await post("/v1/webhooks/signature", {
    signatureId, statut: "signee", documentSigne: acte.original,
  }, { token, flow, label: "Notification de la signature déjà approuvée" });
  if (!notif.ok) { dire(errorMessage(notif), "error"); return false; }
  // L'acte déclaré soumis au contrôle de légalité ne peut pas être publié par le
  // service sans une transmission enregistrée — et un redépôt efface cet état.
  // On le rétablit avec la référence et la date DÉJÀ constatées sur l'acte : la
  // même transmission est rejouée, il ne s'en produit pas une seconde.
  const transmission = acte.execution?.transmission;
  if (controleLegaliteActif() && transmission) {
    const tr = await post(`/v1/actes/${apiActeId}/transmission`, {
      at: transmission.at, reference: transmission.ref, mode: transmission.mode,
      destinataire: transmission.destinataire || transmission.certificat?.destinataire,
      auteur: auteur.nom, entite: auteur.entite,
    }, { token, flow, label: "Rétablissement de la transmission au contrôle de légalité" });
    if (!tr.ok) { dire(errorMessage(tr), "error"); return false; }
  }
  acte.api = {
    ...(acte.api || {}),
    acteId: apiActeId, signatureId, statut: "signee", sha256: dep.body.sha256,
    lienSignature: `${PRESTATAIRE.baseUrl}/signature/${signatureId}`,
    signataire: auteur.nom, deposeLe: dep.body.deposeLe, akn,
  };
  touch("actes", { rerender: false });
  return true;
}

// Amorçage du recueil de démonstration : dépôt, signature déjà approuvée, puis
// publication — le tout silencieusement (voir src/ui/demo-publications.js).
// On repasse par un dépôt NEUF (plutôt que par l'identifiant d'API de la
// fiction de démonstration) : un service déjà utilisé peut détenir un autre
// acte sous ce même identifiant, et le nôtre doit être déposé pour ce qu'il est.
export async function publierActeDuSeed(acte, doc, form) {
  const avant = silencieux;
  silencieux = true;
  try {
    const token = publicationSettings(state.config).jetonDemonstration;
    const flow = beginFlow("Amorçage du recueil (démonstration)");
    if (!(await retablirActe(acte, doc, { token, flow }))) return false;
    // La publication locale est retirée le temps de l'appel : elle dit ainsi si
    // le service a RÉELLEMENT publié (un acte déjà « publié » au registre ne doit
    // pas faire passer un échec pour un succès).
    const avantPublication = acte.publication || null;
    acte.publication = null;
    await publier(acte, doc, form, () => {});
    if (!acte.publication) { acte.publication = avantPublication; return false; }
    return true;
  } finally { silencieux = avant; }
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
      ...themeDe(a, doc),
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
    // Le certificat de transmission au contrôle de légalité : déposé sur le
    // document après la signature, il atteste de la remise à la préfecture. Le
    // sceau est vérifié à l'affichage, comme la signature l'est à la consultation
    // d'une publication.
    pack.transmission ? h("div", { class: "sig-cert" },
      h("h3", { text: "Certificat de transmission" }),
      h("p", { class: "fr-small", style: { margin: "0 0 8px" }, text: pack.transmission.mention || "" }),
      kv("Référence", pack.transmission.reference),
      kv("Destinataire", pack.transmission.destinataire),
      kv("Délivré le", pack.transmission.emisLe ? new Date(pack.transmission.emisLe).toLocaleString("fr-FR") : ""),
      kv("Délivré par", pack.transmission.emisPar),
      kv("Empreinte du document", pack.transmission.empreinte, true),
      kv("Sceau", pack.transmission.sceau, true),
      h("p", { class: "fr-small" }, stateControle(pack.transmission, pack.document?.sha256)),
    ) : null,
    h("p", { class: "fr-small fr-muted", text: "La vérification de cette signature (empreinte, clé publique du certificat, horodatage) est faite à la consultation de la publication, dans « Publications ». Le sceau du certificat de transmission, lui, est vérifié ci-dessus." }),
  );
  modal({ title: "Original signé — " + (pack.reference || acte.numero || ""), wide: true, body, actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })] });
}

// L'état de la vérification du sceau du certificat de transmission, rempli dès
// que le calcul asynchrone a répondu (le bloc est construit de façon synchrone).
function stateControle(certificat, empreinte) {
  const el = h("span", { class: "fr-muted", text: "vérification du sceau…" });
  verifierCertificatTransmission(certificat, { empreinte })
    .then((r) => { el.textContent = (r.ok ? "✓ " : "✗ ") + r.detail; el.className = r.ok ? "" : "fr-error-text"; })
    .catch(() => { el.textContent = "vérification impossible"; });
  return el;
}

export function ouvrirPage(html, title) {
  const w = h("div", { class: "sig-doc-view" });
  const frame = h("iframe", { class: "sig-doc-frame", sandbox: "allow-same-origin", srcdoc: html || "<p>Document indisponible</p>" });
  w.appendChild(frame);
  modal({ title: title, wide: true, body: w, actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })] });
}
