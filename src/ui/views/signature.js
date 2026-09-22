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
import { state, touch, navigate, redrawView, can, actePubliable, journaliser, circuitDe, parapheurActif, controleLegaliteActif, revisionPour, revisionRequisePour, visibleActes, trameById, reviseursDe, modeSignatureDe, circuitSignatureDe, peutCertifier, estCircuitExterne } from "../state.js";
import { h, clear, button, toast, modal, icon, badge } from "../dom.js";
import { textField, selectField, emptyState, helpLink, confirmDialog } from "../components.js";
import { docOfActe, natureOf } from "./modifier.js";
import { natureOfActe, appellationAnnexe, estReglement } from "../../lib/annexes.js";
import { licenceReutilisation } from "../../lib/recueil.js";
import { natureDe, natureDocs, natureJuridiqueDe } from "../../lib/schema.js";
import { annexesJointes } from "../../lib/annexe-docs.js";
import { exportAkn, printHtml, documentCss, exportMarkdown, exportStandaloneHtml } from "../../lib/export.js";
import { renderDocument, applyPaper, documentToText } from "../../lib/render.js";
import { styleForDoc } from "../../lib/styles.js";
import { formatDate, download, todayIso } from "../../lib/util.js";
import {
  publicationSettings, eliUri as eliUriOf, opposability, opposabilityRule,
  buildWebVersion, publicationJsonLd, normalizeUrl,
} from "../../lib/eli.js";
import { PRESTATAIRE, prestataire, buildSignedPackage, partiePublique, dossierInterne } from "../../lib/signature.js";
import {
  envoyerNotification, tracesCourriel, dossierSignatureInterne, destinatairesRole,
  destinataireDeCompte,
} from "../../lib/courriel.js";
import { validationPourSignature, avancement, empreinteTexte } from "../../lib/validation.js";
import {
  circuitPour, circuitsDisponibles, modeSignature, modeLabel, MODES_TRAME, trameModeLabel,
  versionSignee, certificationDe, estCertifie, publicationExternePossible,
  statutExterneLabel, statutExterneColor, dossierSimple, signeeSimple,
  reglagesPrestataire, circuitElectroniqueSimule, motifCircuitSimule,
} from "../../lib/externe.js";
import { enregistrerFormalite } from "../../lib/execution.js";
import { CONTROLE_LEGALITE, verifierCertificatTransmission } from "../../lib/legalite.js";
import { get, post, connect, apiStatus, errorMessage, beginFlow, onStatus, recordExternal } from "../../lib/remote.js";
import { renderApiTab } from "./api-console.js";
import { soumettreARevision } from "../revision-actions.js";
import { appliquerAbrogations } from "../abrogations-apply.js";
import { hasRole, fullName } from "../../lib/users.js";
import {
  ROLE_SIGNATAIRE, personneDeCompte, etatRapprochement, rapprocher,
  placeDansChaine, competenceDuCompte,
} from "../../lib/signataires.js";
import { fileSignature as fileSignatureDe } from "../state.js";

// ---------------------------------------------- publier, oui ; faire droit, non
// Un verbatim de séance, une déclaration, un vœu se publient au recueil sans
// jamais devenir opposables. Ces trois aides disent la chose d'un seul endroit,
// pour que les marches du circuit, le journal et la notification s'accordent :
// quand la publication porte `juridique:false`, on n'annonce ni opposabilité ni
// date d'entrée en vigueur — on dit « publié », et « document non opposable ».
const pubNonJuridique = (p) => !!p && p.juridique === false;
const titreEtapePublication = (p) => (pubNonJuridique(p) ? "Publié au recueil" : "Publié et opposable");
const lignesEtapePublication = (p) => [`ELI ${p.eliUri}`, pubNonJuridique(p) ? "Document non opposable" : `Opposable le ${formatDate(p.dateOpposabilite)}`];
// La publication pas encore franchie : elle n'existe pas encore, mais la nature
// du document dit déjà ce qu'elle sera — un verbatim, une déclaration, un vœu
// se publient « au recueil », sans opposabilité. Sans cela, la marche porterait
// « Publié et opposable » avant même que l'acte ne soit publié.
const publicationAttendue = (acte) => acte.publication || { juridique: natureJuridiqueDe(acte) };
const lignesAttentePublication = (p) => (pubNonJuridique(p)
  ? ["En attente de publication au recueil", "Document non opposable"]
  : ["En attente de publication"]);

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
        ? "Vous signez avec votre compte, rapproché de votre compte sur l'outil de signature. L'acte signé part au recueil, où il reçoit son identifiant ELI : un acte qui fait droit y devient opposable, un document s'y donne à lire."
        : "L'acte signé part au recueil, où le service lui attribue son identifiant ELI : un acte qui fait droit y devient opposable, un document s'y donne à lire." }),
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
    const externes = file.aSigner.filter((a) => modeSignatureDe(a) === "externe");
    root.appendChild(h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: `Actes qui attendent votre signature (${file.aSigner.length})` }),
      h("p", { class: "fr-small fr-muted", text: "Vérifiez le document, puis signez : l'empreinte du texte signé est conservée, et la publication suit la signature." }),
      // Les actes du circuit externe ne se signent pas ici : le document se
      // télécharge, se signe hors de l'application, et sa version signée est
      // déposée au retour. On le dit, plutôt que de laisser croire à un clic.
      externes.length ? h("div", { class: "fr-alert fr-alert--info", style: { marginTop: "10px" } },
        h("p", { class: "fr-alert__title", text: externes.length === 1 ? "Un acte se signe hors de l'application" : externes.length + " actes se signent hors de l'application" }),
        h("p", { class: "fr-small", text: "Ces actes suivent le circuit externe (papier, ou outil tiers) : il n'y a pas de signature à donner dans l'application. Le document prêt à signer se télécharge, se signe hors de l'application, puis sa version signée (PDF) est déposée — et le réviseur certifie sa conformité avant la publication." })) : null,
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
  // Circuit externe : le signataire ne signe pas dans l'application. On lui
  // remet le document (il l'emporte, le fait signer), puis on dépose la version
  // signée — mêmes gestes que dans le circuit de signature.
  if (modeSignatureDe(a) === "externe") return elementSignatureExterne(a, doc, paint, blocking, raison);
  // Signature SIMPLE : le signataire signe ICI, avec son compte. Le geste ouvre
  // le circuit (et dépose l'acte au service), puis recueille la signature — la
  // trace nominative reste dans l'original interne, jamais dans la publication.
  if (modeSignatureDe(a) === "simple") {
    const engage = !!(a.api?.acteId && a.api?.signatureId && a.api?.niveau !== "avancee");
    return h("div", { class: "sig-file__item sig-file__item--action" },
      h("span", { class: "sig-file__num fr-mono", text: a.numero || "sans n°" }),
      h("span", { class: "sig-file__obj", text: a.objet || doc?.meta?.objet || "—" }),
      h("span", { class: "fr-small fr-muted", text: engage ? "circuit ouvert — prêt à signer" : "signature dans l'application" }),
      button("Vérifier et signer", {
        variant: "primary", size: "sm", icon: "lock",
        disabled: apiStatus().status !== "online" || !!raison,
        title: raison || "Vérifier le document, puis le signer avec votre compte",
        onClick: () => engagerSignatureSimple(a, doc, { docs, paint }),
      }));
  }
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

// La ligne d'un acte du circuit externe dans la file du signataire.
function elementSignatureExterne(a, doc, paint, blocking, raison) {
  const ctx = { docs: new Map([[a.id, doc]]), paint };
  const sg = versionSignee(a);
  const cert = certificationDe(a) || {};
  const statut = !a.externe ? "à remettre au signataire"
    : !sg ? "document remis — en attente de la signature"
      : cert.statut === "conforme" ? "version signée — conformité certifiée"
        : cert.statut === "non_conforme" ? "conformité refusée — à redéposer"
          : "version signée déposée";
  return h("div", { class: "sig-file__item sig-file__item--action" },
    h("span", { class: "sig-file__num fr-mono", text: a.numero || "sans n°" }),
    h("span", { class: "sig-file__obj", text: a.objet || doc?.meta?.objet || "—" }),
    h("span", { class: "fr-small fr-muted", text: statut }),
    !a.externe
      ? button("Remettre le document à signer", {
        variant: "primary", size: "sm", icon: "download",
        disabled: !!blocking.length || !pretPourSignatureAction(a).ok,
        title: raison || "Télécharger le document prêt à signer : il sera signé hors de l'application",
        onClick: () => envoyerEnSignature(a, ctx, { ouvrirOutil: false }),
      })
      : (!sg || cert.statut === "non_conforme")
        ? button("Ajouter la version signée", {
          variant: "primary", size: "sm", icon: "upload", title: "Déposer le PDF signé hors de l'application",
          onClick: () => ajouterVersionSignee(a, doc, ctx),
        })
        : button("Voir la version signée", { variant: "secondary", size: "sm", icon: "eye", onClick: () => voirVersionSignee(a) }));
}

// Les portes que l'acte doit avoir franchies avant la signature : parapheur
// puis révision. On les interroge sans redessiner.
// Dans le circuit externe, la RÉVISION ne se place pas ici : le contrôle du
// réviseur porte sur la pièce signée, après coup (certification de conformité).
function pretPourSignatureAction(a) {
  const para = parapheurActif() ? validationPourSignature(a) : { ok: true, raison: "" };
  if (!para.ok) return para;
  if (modeSignatureDe(a) === "externe") return { ok: true, raison: "" };
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
  // Une ANNEXE ne se signe pas : c'est l'acte qui l'adopte qui est signé, et sa
  // signature lui donne son autorité — l'original de cet acte est suivi du texte
  // de l'annexe (voir src/lib/annexe-docs.js). Le circuit de signature n'a donc
  // pas lieu d'être pour elle : on le dit, et on renvoie vers l'acte d'adoption.
  const estAnnexe = natureOfActe(acte, state.trames) === "annexe";
  // Le circuit de CET acte : électronique (l'API du prestataire — le
  // comportement historique) ou EXTERNE (le document est téléchargé, signé hors
  // de l'application, puis la version signée est déposée en PDF et certifiée par
  // le réviseur). Le réglage est général, et la trame peut trancher — l'imposer
  // ou l'autoriser. Voir src/lib/externe.js.
  const trame = trameById(acte.trameId);
  const circuitSig = circuitSignatureDe(acte);
  const modeSig = modeSignatureDe(acte);
  const externe = modeSig === "externe";
  const simple = modeSig === "simple";
  // Le passage au parapheur conditionne l'envoi en signature : le service
  // refuse d'ouvrir un circuit sur un acte dont le circuit de validation n'est
  // pas achevé (voir hEnvoyerEnSignature dans index.html).
  // Le parapheur n'est plus expérimental (1.5.0) : il conditionne l'envoi dès
  // qu'un circuit s'applique à l'acte.
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

  if (estAnnexe) {
    // Le circuit n'existe pas pour une annexe : on montre l'acte qui l'adopte,
    // puisque c'est lui qui porte la signature.
    const adoption = acte.adoptePar || doc?.meta?.adoption || null;
    const adoptant = adoption ? state.actes.find((x) => x.id === adoption.acteId) : null;
    right.appendChild(h("div", { class: "fr-card" },
      // Une annexe n'a pas de numéro : son titre renvoie à la décision qui
      // l'adopte (voir src/lib/annexes.js).
      h("h2", { class: "fr-card__title", text: appellationAnnexe(acte, state.config) }),
      h("p", { class: "fr-small fr-muted", text: [acte.objet, doc?.meta?.entity?.name].filter(Boolean).join(" · ") }),
      h("div", { class: "fr-alert fr-alert--info" },
        h("p", { class: "fr-alert__title", text: "Une annexe ne se signe pas" }),
        h("p", { class: "fr-small", text: "Elle n'a pas d'autorité propre : c'est l'acte qui l'adopte qui est signé, et sa signature la lui donne. L'original de cet acte est suivi du texte de l'annexe, dans le même document. Il n'y a donc ici ni envoi en signature, ni publication séparée." })),
      adoption
        ? h("div", { class: "fr-row", style: { marginTop: "10px" } },
          h("span", { class: "fr-small", text: `Adoptée par ${adoption.designation || "un acte"} n° ${adoption.numero || "—"}${adoption.date ? " du " + formatDate(adoption.date, "date-long") : ""}.` }),
          h("span", { class: "fr-spacer" }),
          adoptant ? button("Ouvrir l'acte d'adoption", { variant: "primary", size: "sm", icon: "upload", onClick: () => { ui.acteId = adoptant.id; paint(); } }) : null)
        : h("p", { class: "fr-small fr-muted", style: { margin: "10px 0 0" }, text: "Aucun acte d'adoption n'est désigné : ouvrez le document à la rédaction et désignez, dans la carte « Annexe », l'acte qui l'adopte." }),
      adoption && !adoptant
        ? h("p", { class: "fr-small fr-muted", style: { margin: "4px 0 0" }, text: "L'acte d'adoption n'est pas au registre de ce poste." })
        : null,
    ));
  } else {
    right.appendChild(h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: `Circuit — ${acte.numero || "acte sans numéro"}` }),
      h("p", { class: "fr-small fr-muted", text: [acte.objet, doc?.meta?.entity?.name].filter(Boolean).join(" · ") }),
      h("div", { class: "sig-circuit-mode" },
        h("span", { class: "fr-badge fr-badge--" + (externe ? "warning" : "info"), text: modeLabel(modeSig) }),
        h("span", { class: "fr-small fr-muted", text: circuitSig.source === "trame" ? "réglé par la trame" : "réglage général" })),
      h("div", { class: "sig-steps" },
        // Les étapes sont numérotées par POSITION : la marche « Parapheur »
        // disparaît quand aucun circuit ne s'applique, sans trou dans la
        // numérotation.
        ...(externe
          ? etapesExterne({
            parapheur, validation: acte.validation, para, paraAvancement, circuit: circuitDe(acte),
            blocking, doc, acte, publiable,
          })
          : simple
            ? etapesSimple({
              parapheur, validation: acte.validation, para, paraAvancement, circuit: circuitDe(acte),
              blocking, doc, acte, publiable, rev,
            })
            : etapesCircuit({
              parapheur, validation: acte.validation, para, paraAvancement, circuit: circuitDe(acte),
              blocking, doc, acte, signed, publiable, rev,
              controleLegalite, transmission: acte.execution?.transmission || null,
            })).map((e, i) => stepEl(i + 1, e.title, e.done, e.lines)),
      ),
    ));
  }

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
  } else if (estAnnexe) {
    const adoption = acte.adoptePar || doc?.meta?.adoption || null;
    const adoptant = adoption ? state.actes.find((x) => x.id === adoption.acteId) : null;
    actions.appendChild(h("p", { class: "fr-small" },
      "Une annexe ne se signe pas et ne se publie pas pour elle-même : c'est l'acte qui l'adopte qui porte la signature, et son texte suit cet acte dans l'original signé. Envoyez donc en signature ",
      h("strong", { text: "l'acte d'adoption" }), ", non l'annexe."));
    actions.appendChild(h("div", { class: "fr-row" },
      adoptant ? button("Ouvrir l'acte d'adoption", { variant: "primary", size: "sm", icon: "upload", onClick: () => { ui.acteId = adoptant.id; paint(); } }) : null,
      button("Voir le document", { variant: "tertiary", size: "sm", icon: "note", onClick: () => navigate("acte/" + acte.id) }),
    ));
  } else if (externe) {
    actionsExterne(actions, row, { acte, doc, trame, circuitSig, paint, blocking, para, parapheur, publiable });
  } else if (simple && !signed) {
    actionsSimple(actions, row, { acte, doc, trame, circuitSig, paint, blocking, para, parapheur, publiable });
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
    row.appendChild(button("Télécharger l'original", { variant: "tertiary", icon: "download", onClick: () => download(`${(acte.numero || "acte").replace(/[^\w-]+/g, "_")}-original-signe.json`, JSON.stringify(partiePublique(acte.original), null, 2), "application/json") }));
    // Le dossier de signature interne — coordonnées du signataire, compte,
    // moyen d'authentification, courriels. Il n'est proposé que lorsqu'il existe
    // (signature simple, ou circuit électronique).
    if (dossierInterne(acte.original)) {
      row.appendChild(button("Dossier de signature (interne)…", { variant: "tertiary", icon: "lock", title: "Les mentions nominatives conservées au registre — non diffusées au public", onClick: () => voirDossierInterne(acte) }));
    }
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
  if (blocking.length && !estAnnexe) {
    actions.appendChild(h("div", { class: "fr-alert fr-alert--error", style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: "Signature impossible en l'état" }),
      ...blocking.map((b) => h("p", { class: "fr-small", text: "• " + b.message })),
    ));
  }
  if (parapheur && !signed && !para.ok && !estAnnexe) {
    actions.appendChild(h("div", { class: "fr-alert fr-alert--warning", style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: "Parapheur non achevé" }),
      h("p", { class: "fr-small", text: para.raison }),
      h("p", { class: "fr-small fr-muted", text: "Le service refuse d'ouvrir un circuit de signature sur un acte dont la validation n'est pas achevée : c'est ce qui garantit que l'acte signé est bien celui qui a été approuvé." }),
    ));
  }
  // Révision : le contrôle du réviseur. Tant qu'elle n'est pas faite, l'acte ne
  // part pas — et le service refuse lui aussi d'ouvrir le circuit. (Dans le
  // circuit externe, le contrôle du réviseur ne se place PAS ici : il porte sur
  // la version signée déposée, et c'est la certification de conformité.)
  if (!externe && rev.requise && !signed && !rev.ok && !estAnnexe) {
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
// que si un circuit s'applique à l'acte, et la marche « Transmis au
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
      title: titreEtapePublication(publicationAttendue(acte)),
      done: acte.statut === "publie" && !!acte.publication,
      lines: acte.publication ? lignesEtapePublication(acte.publication) : lignesAttentePublication(publicationAttendue(acte)),
    }
    : {
      title: "Non publié (acte individuel)",
      done: signed,
      lines: ["La trame a déclaré cet acte non publiable.", "L'acte signé est conservé au registre et notifié à l'intéressé."],
    });
  return etapes;
}

// ---------------------------------------------- les marches du circuit externe
// Le circuit SANS API : le document est remis au signataire (téléchargé), signé
// hors de l'application, puis déposé en PDF — et le RÉVISEUR certifie que la
// pièce signée est conforme à la version numérique qui sera publiée. Les
// marches du parapheur restent, quand la fonction est active : elles portent sur
// le texte, en amont, et ne dépendent pas du mode de signature.
function etapesExterne({ parapheur, validation, para, paraAvancement, circuit, blocking, doc, acte, publiable }) {
  const etapes = [{
    title: "Acte finalisé",
    done: !!(acte.values || acte.doc),
    lines: [
      blocking.length ? `${blocking.length} contrôle(s) bloquant(s) : la remise au signataire est déconseillée` : "Aucun contrôle bloquant",
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
        lines: [circuit ? "Aucun circuit ouvert : le document est remis au signataire sans validation préalable." : "Aucun circuit ne s'applique à cet acte."],
      });
  }
  // La révision en amont n'est pas une marche de ce circuit : le contrôle du
  // réviseur a lieu APRÈS la signature, sur la pièce signée (marche suivante).
  // Si l'acte a tout de même été révisé, sa trace est conservée ici.
  if (acte.revision) {
    const r = acte.revision;
    etapes.push({
      title: "Révision — contrôle du texte",
      done: r.statut === "valide",
      lines: [r.statut === "valide"
        ? `Révisé par ${r.valideParNom || "—"} le ${formatDate(String(r.valideLe || "").slice(0, 10))}`
        : "Révision non aboutie : elle ne conditionne pas le circuit externe (le contrôle porte sur la pièce signée)."],
    });
  }
  etapes.push({
    title: "Document remis au signataire",
    done: !!acte.externe,
    lines: acte.externe
      ? [
        `Remis le ${formatDate(String(acte.externe.demandeLe || "").slice(0, 10))}${acte.externe.demandeParNom ? " par " + acte.externe.demandeParNom : ""}`,
        acte.externe.document?.empreinte ? "Empreinte du document remis " + acte.externe.document.empreinte : "",
        "Signature hors de l'application (papier ou outil tiers).",
      ].filter(Boolean)
      : ["En attente : « Envoyer à signature » télécharge le document prêt à signer."],
  });
  const sg = versionSignee(acte);
  etapes.push({
    title: "Version signée déposée",
    done: !!sg,
    lines: sg
      ? [
        `${sg.nom || "document signé"}${sg.taille ? " (" + tailleLisible(sg.taille) + ")" : ""}`,
        `Déposé le ${formatDate(String(sg.deposeLe || "").slice(0, 10))}${sg.deposeParNom ? " par " + sg.deposeParNom : ""}`,
        sg.sha256 ? "Empreinte SHA-256 " + String(sg.sha256).slice(0, 16) + "…" : "",
      ].filter(Boolean)
      : ["En attente du dépôt de la version signée (PDF)."],
  });
  // La certification de conformité — la marche propre au réviseur dans ce
  // circuit. Elle n'existe que si un réviseur est compétent pour l'acte. Avant
  // la remise du document, le dossier n'existe pas encore : on interroge alors
  // la compétence des réviseurs, pour annoncer la marche à venir.
  const requise = acte.externe ? !!acte.externe.certificationRequise : revisionRequisePour(acte);
  const cert = certificationDe(acte) || {};
  etapes.push(requise
    ? {
      title: "Conformité certifiée par le réviseur",
      done: cert.statut === "conforme",
      lines: [
        cert.statut === "conforme" ? `Certifié conforme par ${cert.parNom || "—"} le ${formatDate(String(cert.le || "").slice(0, 10))}`
          : cert.statut === "non_conforme" ? "Conformité refusée" + (cert.motif ? " : " + cert.motif : "")
            : "En attente : le réviseur compare la pièce signée à la version numérique.",
        "La certification porte sur la PIÈCE signée, non sur le texte avant signature.",
      ],
    }
    : {
      title: "Conformité certifiée par le réviseur",
      done: !!sg,
      lines: ["Aucun réviseur n'est compétent pour cet acte : la certification n'est pas requise.", "L'acte est publié sur la foi de la version signée déposée."],
    });
  etapes.push(publiable
    ? {
      title: titreEtapePublication(publicationAttendue(acte)),
      done: acte.statut === "publie" && !!acte.publication,
      lines: acte.publication ? lignesEtapePublication(acte.publication) : lignesAttentePublication(publicationAttendue(acte)),
    }
    : {
      title: "Non publié (acte individuel)",
      done: !!sg,
      lines: ["La trame a déclaré cet acte non publiable.", "L'acte signé est conservé au registre et notifié à l'intéressé."],
    });
  return etapes;
}

// Les actions du circuit externe : remettre le document, déposer la version
// signée, certifier la conformité, publier. Chaque geste n'apparaît que
// lorsqu'il a un sens pour l'état du dossier.
function actionsExterne(actions, row, { acte, doc, trame, circuitSig, paint, blocking, para, parapheur, publiable }) {
  const sg = versionSignee(acte);
  const cert = certificationDe(acte) || {};
  const requise = !!(acte.externe && acte.externe.certificationRequise);
  const pret = !blocking.length && para.ok;
  const ctx = { docs: new Map([[acte.id, doc]]), paint };

  actions.appendChild(h("p", { class: "fr-small", text: "Circuit externe : le document est TÉLÉCHARGÉ prêt à signer, signé hors de l'application (papier ou outil tiers), puis la version signée est DÉPOSÉE en PDF. Le réviseur compétent certifie ensuite que la pièce signée est conforme à la version numérique qui sera publiée." }));

  // 1. La remise du document — ou la reprise du circuit sur un autre circuit,
  //    quand la trame laisse le choix.
  if (!acte.externe) {
    const envoi = (mode) => {
      if (mode) acte.signatureMode = mode;
      envoyerEnSignature(acte, ctx, { ouvrirOutil: false });
    };
    if (circuitSig.choix) {
      actions.appendChild(h("p", { class: "fr-small", text: "La trame autorise les deux circuits : choisissez celui de cet acte." }));
      row.appendChild(button("Signer dans l'application (électronique)", {
        variant: "secondary", icon: "lock", disabled: !pret,
        title: pret ? "Déposer l'acte et ouvrir le circuit du prestataire" : "L'acte comporte un contrôle bloquant ou un parapheur non achevé",
        onClick: () => envoi("electronique"),
      }));
      row.appendChild(button("Envoyer à signature (circuit externe)", {
        variant: "primary", icon: "download", disabled: !pret,
        title: pret ? "Télécharger le document prêt à signer : il sera signé hors de l'application" : "L'acte comporte un contrôle bloquant ou un parapheur non achevé",
        onClick: () => envoi("externe"),
      }));
    } else {
      row.appendChild(button("Envoyer à signature — télécharger le document", {
        variant: "primary", icon: "download", disabled: !pret,
        title: pret ? "Télécharger le document prêt à signer : il sera signé hors de l'application" : "L'acte comporte un contrôle bloquant ou un parapheur non achevé",
        onClick: () => envoi(null),
      }));
    }
    if (parapheur && !para.ok) {
      row.appendChild(button("Ouvrir le parapheur", {
        variant: "secondary", icon: "check",
        onClick: () => { state.parapheur = { tab: "enCours", acteId: acte.id }; navigate("parapheur"); },
      }));
    }
  } else {
    // 2. Le document est remis : on peut le réimprimer, et déposer la version
    //    signée dès qu'elle revient.
    row.appendChild(button("Imprimer / enregistrer en PDF", {
      variant: "secondary", icon: "download",
      onClick: () => printHtml(documentPretsASigner(acte, doc, trame)),
    }));
    row.appendChild(button("Télécharger à nouveau", {
      variant: "tertiary", icon: "download",
      onClick: () => telechargerDocumentASigner(acte, doc, trame),
    }));
    if (!sg || cert.statut === "non_conforme") {
      row.appendChild(button("Ajouter la version signée (PDF)…", {
        variant: "primary", icon: "upload", onClick: () => ajouterVersionSignee(acte, doc, ctx),
      }));
    }
  }

  // 3. La version signée est déposée : on la consulte, et le réviseur certifie.
  if (sg) {
    row.appendChild(button("Voir la version signée", {
      variant: "secondary", icon: "eye", onClick: () => voirVersionSignee(acte),
    }));
    if (requise && cert.statut !== "conforme") {
      if (peutCertifier(acte)) {
        row.appendChild(button("Certifier la conformité…", {
          variant: "primary", icon: "check", onClick: () => certifierConformite(acte, doc, ctx),
        }));
      } else {
        actions.appendChild(h("div", { class: "fr-alert fr-alert--info", style: { marginTop: "10px" } },
          h("p", { class: "fr-alert__title", text: "En attente de la certification du réviseur" }),
          h("p", { class: "fr-small", text: "Un réviseur est compétent pour cet acte : la conformité de la pièce signée doit être certifiée avant la publication. Le réviseur ouvre l'acte depuis son écran « Révision » (onglet « Certifications »)." })));
      }
    }
  }

  // 4. La publication, une fois la conformité acquise.
  const possible = publicationExternePossible(acte);
  if (sg && possible.ok && publiable && acte.statut !== "publie") {
    row.appendChild(button("Publier maintenant", { variant: "primary", icon: "check", onClick: () => { state.signature.tab = "publication"; paint(); } }));
  }
  if (sg && possible.ok && !publiable) {
    actions.appendChild(h("div", { class: "fr-alert fr-alert--info", style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: "Acte non publiable" }),
      h("p", { class: "fr-small", text: "Signé, l'acte est conservé au registre et suffit à produire ses effets. La trame dont il est issu étant déclarée non publiable (acte individuel), il n'est pas déposé au recueil et ne reçoit pas d'identifiant ELI." })));
  }
  if (requise && cert.statut === "non_conforme") {
    actions.appendChild(h("div", { class: "fr-alert fr-alert--error", style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: "Conformité refusée par le réviseur" }),
      h("p", { class: "fr-small", text: cert.motif || "Le réviseur a constaté une non-conformité entre la pièce signée et la version numérique." }),
      h("p", { class: "fr-small fr-muted", text: "Déposez une version signée conforme (corrigée, ou signée de nouveau), puis soumettez-la à la certification." })));
  }
  if (requise && cert.statut === "conforme") {
    actions.appendChild(h("p", { class: "fr-small fr-muted", style: { marginTop: "6px" },
      text: `Conformité certifiée par ${cert.parNom || "le réviseur"} le ${formatDate(String(cert.le || "").slice(0, 10))}.` }));
  }
  if (!acte.externe && trame) {
    const c = circuitPour(state.config, trame);
    actions.appendChild(h("p", { class: "fr-small fr-muted", style: { marginTop: "6px" }, text: trameModeLabel(trame.signature || "") + " — " + modeLabel(c.mode) + " retenu pour cette trame." }));
  }
}

// ============================================================================
// SIGNATURE ÉLECTRONIQUE SIMPLE — la signature donnée DANS l'application.
//
// C'est le circuit qui n'appelle aucun prestataire et ne fait rien circuler hors
// de l'application : le signataire désigné ouvre l'acte, vérifie le document, et
// signe avec SON compte. La cryptographie est la même que pour le circuit
// électronique (empreinte SHA-256, signature ECDSA, horodatage) ; ce qui change,
// c'est qui signe, et où va la trace.
//
// La trace nominative — nom, courriel, compte, moyen d'authentification,
// horodatage — est consignée dans le DOSSIER INTERNE de l'original. Ce dossier
// n'est jamais diffusé : la publication ne porte que la part publique de
// l'original (nom, fonction, empreinte, date), et le service ne sert le dossier
// interne que sur une route protégée. Voir src/lib/signature.js
// (`partiePublique`) et src/server/mysql/actes.mjs (`sansInterne`).
// ============================================================================

// Le libellé court d'un circuit, pour un bouton.
const libelleCourt = (m) => modeLabel(m).replace(/\s*\(.*\)\s*$/, "");

// Les destinataires « côté administration » d'un acte : son rédacteur, et les
// comptes qui portent le rôle d'éditeur — ceux qu'un retour signé intéresse.
function destinatairesAdministration(acte) {
  const createur = state.users.find((u) => u.id === acte.createdBy);
  return [createur, ...state.users.filter((u) => u.id !== createur?.id && (u.roles || [u.role] || []).includes("editeur"))]
    .map((u) => destinataireDeCompte(u)).filter(Boolean);
}

// Les marches du circuit simple : pas de remise, pas de dépôt de PDF, pas de
// certification. Le document est vérifié puis signé, et le dossier interne est
// la dernière marche avant la publication.
function etapesSimple({ parapheur, validation, para, paraAvancement, circuit, blocking, doc, acte, publiable, rev }) {
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
  if (rev?.requise) {
    const r = acte.revision;
    etapes.push({
      title: "Révision — contrôle avant signature",
      done: rev.ok,
      lines: [r ? (r.statut === "rejete" ? "Rejeté : " + (r.motif || "motif au dossier")
        : r.statut === "en_attente" ? "En attente" + (r.demandeeParNom ? ` (soumis par ${r.demandeeParNom})` : "")
          : `${r.valideParNom || "révisé"} le ${formatDate(String(r.valideLe || "").slice(0, 10))}`) : "Pas encore soumis au réviseur", rev.ok ? "" : rev.raison].filter(Boolean),
    });
  }
  const d = dossierSimple(acte) || {};
  etapes.push({
    title: "Signé dans l'application",
    done: signeeSimple(acte),
    lines: signeeSimple(acte)
      ? [
        `Signé le ${formatDate(String(d.signeLe || "").slice(0, 10), "date-long")}`,
        d.parNom ? "Par " + d.parNom : "",
        d.empreinte ? "Empreinte SHA-256 " + String(d.empreinte).slice(0, 16) + "…" : "",
      ].filter(Boolean)
      : ["En attente : le signataire vérifie le document, puis le signe avec son compte."],
  });
  etapes.push({
    title: "Dossier de signature (interne)",
    done: !!(d.interne && d.interne.signataire),
    lines: d.interne
      ? [
        d.interne.signataire?.courriel ? "Adresse du signataire : " + d.interne.signataire.courriel : "",
        d.interne.authentification || "",
        "Ces mentions ne sont pas diffusées : le public ne voit que le nom, la fonction et la date.",
      ].filter(Boolean)
      : ["Constitué à la signature (adresse, compte, moyen d'authentification)."],
  });
  etapes.push({
    title: "Déposé au service",
    done: !!acte.api?.acteId,
    lines: acte.api ? [`Identifiant ${acte.api.acteId}`, acte.api.sha256 ? "Empreinte SHA-256 " + acte.api.sha256.slice(0, 16) + "…" : ""].filter(Boolean) : ["En attente du dépôt (au premier geste de signature)."],
  });
  etapes.push(publiable
    ? {
      title: titreEtapePublication(publicationAttendue(acte)),
      done: acte.statut === "publie" && !!acte.publication,
      lines: acte.publication ? lignesEtapePublication(acte.publication) : lignesAttentePublication(publicationAttendue(acte)),
    }
    : {
      title: "Non publié (acte individuel)",
      done: signeeSimple(acte),
      lines: ["La trame a déclaré cet acte non publiable.", "L'acte signé est conservé au registre et notifié à l'intéressé."],
    });
  return etapes;
}

// Les actions du circuit simple : le geste de signature, et le choix du circuit
// quand la trame en ouvre plusieurs.
function actionsSimple(actions, row, { acte, doc, trame, circuitSig, paint, blocking, para, parapheur }) {
  const pret = !blocking.length && para.ok;
  const ctx = { docs: new Map([[acte.id, doc]]), paint };
  const auteur = auteurDe(acte, doc);
  actions.appendChild(h("p", { class: "fr-small", text: "Signature électronique simple : l'acte est signé DANS l'application, par le signataire désigné, avec son compte. La signature est horodatée et vérifiable par empreinte. Les mentions nominatives (adresse électronique, compte, moyen d'authentification) restent dans l'ORIGINAL INTERNE : le recueil public ne montre que le nom, la fonction et la date." }));

  if (!auteur.courriel) {
    // L'adresse ne vit PAS sur la personne du référentiel (elle n'y a pas de
    // champ) : elle vit sur le COMPTE du signataire (Comptes et rôles), ou vient
    // de l'annuaire. Le message dit donc où aller — et ce qui manque au juste :
    // le compte, son courriel, ou le rapprochement.
    const etat = auteur.personId ? etatRapprochement(state.config, state.users, auteur.personId) : null;
    const compte = etat?.compte || null;
    const qui = auteur.nom || "ce signataire";
    const texte = !compte
      ? `Aucun compte de l'application n'est rattaché à ${qui} : un signataire signe avec son compte. Dans « Comptes et rôles », ouvrez son compte (ou créez-le), rattachez-le à sa personne du référentiel, puis renseignez son courriel — c'est cette adresse qui identifie le signataire.`
      : `Le compte de ${qui} (${compte.login || compte.id}) n'a pas de courriel : sa trace nominative serait incomplète. Renseignez-le dans « Comptes et rôles », puis rapprochez le compte depuis « Ma signature ».`;
    actions.appendChild(h("div", { class: "fr-alert fr-alert--warning", style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: "Signataire sans adresse" }),
      h("p", { class: "fr-small", text: texte }),
      h("div", { class: "fr-row", style: { marginTop: "6px" } },
        can("comptes.gerer")
          ? button("Ouvrir « Comptes et rôles »", { variant: "secondary", size: "sm", icon: "lock", onClick: () => navigate("comptes") })
          : h("p", { class: "fr-small fr-muted", text: "Demandez à un administrateur de renseigner ce courriel (Administration › Comptes et rôles)." }))));
  }
  if (auteur.nom) {
    actions.appendChild(h("div", { class: "sig-cert" },
      h("h3", { text: "Le signataire" }),
      kv("Nom", auteur.nom),
      kv("Fonction", auteur.fonction),
      kv("Adresse", auteur.courriel),
      kv("Compte de l'application", auteur.compteOutil || auteur.compteId || "")));
  }

  if (circuitSig.choix) {
    const dispo = circuitsDisponibles(state.config, trame);
    actions.appendChild(h("p", { class: "fr-small", text: "La trame ouvre plusieurs circuits : choisissez celui de cet acte." }));
    for (const m of dispo) {
      row.appendChild(button(libelleCourt(m), {
        variant: m === "simple" ? "primary" : "secondary", icon: "lock", disabled: !pret,
        title: pret ? libelleCourt(m) : "L'acte comporte un contrôle bloquant ou un parapheur non achevé",
        onClick: async () => { acte.signatureMode = m; if (m !== "simple") await envoyerEnSignature(acte, ctx); else await engagerSignatureSimple(acte, doc, ctx); },
      }));
    }
  } else {
    row.appendChild(button("Vérifier et signer", {
      variant: "primary", icon: "lock", disabled: !pret,
      title: pret ? "Vérifier le document, puis le signer avec votre compte" : "L'acte comporte un contrôle bloquant ou un parapheur non achevé",
      onClick: () => engagerSignatureSimple(acte, doc, ctx),
    }));
  }
  if (parapheur && !para.ok) {
    row.appendChild(button("Ouvrir le parapheur", {
      variant: "secondary", icon: "check",
      onClick: () => { state.parapheur = { tab: "enCours", acteId: acte.id }; navigate("parapheur"); },
    }));
  }
  const rev = revisionPour(acte);
  if (rev.requise) {
    row.appendChild(button("Ouvrir la révision", {
      variant: "secondary", icon: "eye",
      onClick: () => { state.revision = { tab: rev.ok ? "rejets" : "aReviser", acteId: acte.id }; navigate("revision"); },
    }));
  }
}

// Le corps du dépôt : les mêmes métadonnées que le circuit électronique, mais
// déclarées « simple » pour que le service sache à quel circuit il a affaire.
function corpsDepot(acte, doc, { signatureMode }) {
  const parapheur = parapheurActif();
  const rev = revisionPour(acte);
  return {
    akn: aknOf(acte, doc),
    numero: acte.numero || doc.meta?.numero || "",
    objet: acte.objet || doc.meta?.objet || "",
    nature: doc.meta?.actTypeId || "Décision",
    entityId: doc.meta?.entity?.id || "", entityName: doc.meta?.entity?.name || "",
    dateSignature: acte.dateSignature || doc.meta?.dateSignature || "",
    trameId: acte.trameId || "", ecarts: (acte.ecarts || []).length,
    ...themeDe(acte, doc),
    publishable: actePubliable(acte),
    controleLegalite: controleLegaliteActif(),
    signatureMode,
    validation: parapheur && acte.validation ? {
      statut: acte.validation.statut, circuitLabel: acte.validation.circuitLabel || "",
      empreinte: acte.validation.empreinte || "", closLe: acte.validation.closLe || "",
      etapes: (acte.validation.steps || []).map((s) => s.statut),
    } : null,
    revision: rev.requise && acte.revision ? {
      statut: acte.revision.statut, empreinte: acte.revision.empreinte || "",
      valideLe: acte.revision.valideLe || "", corrige: acte.revision.corrige === true, par: acte.revision.valideParNom || "",
    } : null,
  };
}

// Le geste d'entrée dans le circuit simple : les portes (parapheur, révision),
// puis le dépôt et l'ouverture du circuit — et la fenêtre de signature s'ouvre.
async function engagerSignatureSimple(acte, doc, ctx) {
  const config = state.config;
  const parapheur = parapheurActif();
  const para = parapheur ? validationPourSignature(acte) : { ok: true, raison: "" };
  if (!para.ok) { toast(para.raison, "warning"); return; }
  const rev = revisionPour(acte);
  if (rev.requise && !rev.ok) {
    if (acte.revision?.statut === "en_attente") { toast("L'acte est déjà en attente de révision.", "info"); return; }
    await soumettreARevision(acte, { paint: ctx.paint });
    return;
  }
  // PORTE DE COMPÉTENCE. La signature simple est apposée au nom du SIGNATAIRE
  // DÉSIGNÉ par l'acte : l'opérateur doit donc être lui-même ce signataire, ou
  // un délégataire en vigueur dans la chaîne de signature de l'acte (voir
  // src/lib/signataires.js). Sans cette porte, n'importe quel compte porteur de
  // la permission de signer apposait la signature au nom d'un autre.
  const competence = competenceDuCompte(config, state.user, acte, trameById(acte.trameId));
  if (!competence.ok) {
    toast("Votre compte n'est pas dans la chaîne de signature de cet acte : vous ne pouvez pas signer à la place du signataire désigné. Faites-vous désigner, ou attendez une délégation en vigueur.", "error");
    return;
  }
  const auteur = auteurDe(acte, doc);
  if (!auteur.courriel) { toast("Le signataire n'a pas d'adresse électronique : sa trace nominative serait incomplète.", "warning"); return; }
  const settings = publicationSettings(config);
  const token = settings.jetonDemonstration;
  const flow = beginFlow(`Signature simple — ${acte.numero || acte.id}`);
  try {
    if (!acte.api?.acteId) {
      const dep = await post("/v1/actes", corpsDepot(acte, doc, { signatureMode: "simple" }), { token, flow, label: "Dépôt de l'acte (signature simple)" });
      if (!dep.ok) { toast(errorMessage(dep), "error"); return; }
      acte.api = { ...(acte.api || {}), acteId: dep.body.id, sha256: dep.body.sha256, deposeLe: dep.body.deposeLe };
      touch("actes", { rerender: false });
    }
    if (!acte.api?.signatureId) {
      const sig = await post(`/v1/actes/${acte.api.acteId}/signature`, {
        signataires: [{ nom: auteur.nom, courriel: auteur.courriel, fonction: auteur.fonction, ordre: 1, compte: auteur.compteOutil || "" }],
        niveau: "simple",
        urlNotification: "https://api.valmont-sur-loire.fr/v1/webhooks/signature",
      }, { token, flow, label: "Ouverture du circuit de signature simple" });
      if (!sig.ok) { toast(errorMessage(sig), "error"); return; }
      acte.api = { ...(acte.api || {}), signatureId: sig.body.signatureId, niveau: "simple", statut: "en_attente", signataire: auteur.nom };
      acte.signatureMode = "simple";
      acte.statut = "en_signature";
      acte.updatedAt = new Date().toISOString();
      touch("actes", { rerender: false });
    }
  } catch (e) { toast(String((e && e.message) || e), "error"); return; }

  // La demande de signature : elle part par courriel quand le service de
  // courriel est configuré (sinon elle est tracée « non envoyée »).
  await envoyerNotification("demande_signature", {
    config, acte, doc, brand: config.brand.name,
    destinataires: [{ nom: auteur.nom, courriel: auteur.courriel }],
    complement: `L'acte ${acte.numero ? "n° " + acte.numero : ""} « ${acte.objet || ""} » vous est présenté pour signature. Ouvrez Scribae, vérifiez le document, puis signez-le avec votre compte.`,
  });
  ctx.paint();
  fenetreSignatureSimple(acte, doc, ctx);
}

// La fenêtre de signature : le document sous les yeux, l'identité du signataire,
// l'empreinte, et une déclaration à cocher. C'est ce que le signataire atteste —
// et ce que le dossier interne conservera.
function fenetreSignatureSimple(acte, doc, ctx) {
  const config = state.config;
  const auteur = auteurDe(acte, doc);
  const empreinte = acte.api?.sha256 || empreinteTexte(acte);

  const paperBox = h("div", { class: "paper-box sig-paper" });
  const paper = h("div", { class: "paper" });
  paper.style.fontFamily = config.brand.documentFont || "";
  applyPaper(paper, doc, config);
  paper.appendChild(renderDocument(doc, config, {}));
  paperBox.appendChild(paper);

  const caseVerifie = h("input", { type: "checkbox" });
  const bouton = button("Signer l'acte", { variant: "primary", icon: "lock", disabled: true, title: "Cochez la déclaration pour signer" });
  caseVerifie.addEventListener("change", () => { bouton.disabled = !caseVerifie.checked; bouton.title = ""; });

  const body = h("div", { class: "fr-stack" },
    h("div", { class: "fr-alert fr-alert--info" },
      h("p", { class: "fr-alert__title", text: "Signature électronique simple — dans l'application" }),
      h("p", { class: "fr-small", text: "En signant, vous engagez votre signature sur ce document. L'empreinte du texte, l'horodatage et vos mentions nominatives (nom, fonction, adresse électronique, compte) sont consignés dans le dossier INTERNE de l'acte : elles ne sont pas diffusées au public, qui ne voit que votre nom, votre fonction et la date." })),
    h("div", { class: "fr-grid fr-grid--2" },
      h("div", { class: "fr-card fr-card--soft" },
        h("h3", { class: "fr-card__title", text: "Vous signez en tant que" }),
        kv("Nom", auteur.nom),
        kv("Fonction", auteur.fonction),
        kv("Adresse", auteur.courriel),
        kv("Compte", auteur.compteOutil || auteur.compteId || ""),
        auteur.rapproche ? null : h("p", { class: "fr-small fr-muted", text: "Le compte n'est pas rapproché de l'annuaire : la signature restera valable, mais la traçabilité du rapprochement est incomplète." })),
      h("div", { class: "fr-card fr-card--soft" },
        h("h3", { class: "fr-card__title", text: "Ce qui est signé" }),
        kv("Acte", (acte.numero || "") + (acte.objet ? " — " + acte.objet : "")),
        kv("Entité", doc?.meta?.entity?.name || ""),
        kv("Empreinte SHA-256", empreinte, true))),
    h("div", { class: "sig-doc-view", style: { height: "38vh" } }, paperBox),
    h("label", { class: "fr-check" }, caseVerifie,
      "Je déclare avoir vérifié le document ci-dessus et j'engage ma signature sur son contenu."));

  const m = modal({
    title: "Signer l'acte — " + (acte.numero || ""),
    wide: true,
    body,
    actions: (close) => [
      button("Renoncer", { variant: "secondary", onClick: close }),
      bouton,
    ],
  });
  bouton.addEventListener("click", async () => {
    bouton.disabled = true;
    bouton.textContent = "Signature en cours…";
    const ok = await signerSimple(acte, doc, ctx);
    if (ok) m.close();
    else { bouton.disabled = false; bouton.textContent = "Signer l'acte"; }
  });
  requestAnimationFrame(() => {
    const r = paperBox.getBoundingClientRect();
    paper.style.transform = `scale(${Math.min(1, (r.width * 0.9) / (paper.offsetWidth || 794))})`;
    paper.style.transformOrigin = "top left";
  });
}

// La signature à proprement parler : le paquet signé (cryptographie réelle), la
// notification au service — qui VÉRIFIE l'empreinte —, l'original, puis la
// publication.
async function signerSimple(acte, doc, ctx) {
  const config = state.config;
  if (!acte.api?.signatureId) { toast("Aucun circuit ouvert pour cet acte.", "error"); return false; }
  // Le contrôle de compétence est rejoué ici : `signerSimple` est aussi
  // atteignable sans passer par `engagerSignatureSimple`.
  if (!competenceDuCompte(config, state.user, acte, trameById(acte.trameId)).ok) {
    toast("Votre compte n'est pas dans la chaîne de signature de cet acte : signature refusée.", "error");
    return false;
  }
  const flow = beginFlow(`Signature simple — ${acte.numero || acte.id}`);
  const auteur = auteurDe(acte, doc);
  const akn = aknOf(acte, doc);
  let pack;
  try {
    const bodyHtml = renderDocument(doc, config, {}).outerHTML.replace(/^<article[^>]*>/, "").replace(/<\/article>$/, "");
    pack = await buildSignedPackage({
      akn, pageHtml: bodyHtml, pageCss: documentCss(config, styleForDoc(config, doc)),
      numero: acte.numero || doc.meta?.numero || "", objet: acte.objet || doc.meta?.objet || "",
      signataire: auteur, prestataire: null, brand: config.brand.name,
      interne: dossierSignatureInterne({ signataire: auteur, courriels: tracesCourriel(acte), poste: navigator.userAgent, operateur: { id: state.user?.id || "", nom: nomDeCompte(), courriel: state.user?.email || "", compte: state.user?.login || "" } }),
    });
  } catch (e) { toast("Signature impossible : " + String((e && e.message) || e), "error"); return false; }

  try {
    const notif = await post("/v1/webhooks/signature", { signatureId: acte.api.signatureId, statut: "signee", documentSigne: pack }, { token: publicationSettings(config).jetonDemonstration, flow, label: "Notification au service (signature simple)" });
    if (!notif.ok) { toast("Le service a refusé la signature : " + errorMessage(notif), "error"); return false; }
  } catch (e) { toast(String((e && e.message) || e), "error"); return false; }

  const sig = pack.signatures[0];
  const at = sig.signeLe || new Date().toISOString();
  acte.original = pack;
  acte.signatureSimple = {
    signeLe: at,
    empreinte: pack.document.sha256,
    algorithme: sig.algorithme,
    valeur: String(sig.valeur || ""),
    par: state.user?.id || "",
    parNom: auteur.nom,
    parCourriel: auteur.courriel,
    compteOutil: auteur.compteOutil || "",
    niveau: "simple",
    interne: pack.interne,
  };
  acte.api = { ...(acte.api || {}), statut: "signee", akn };
  acte.signatureMode = "simple";
  acte.statut = "signee";
  acte.signeLe = at;
  acte.updatedAt = new Date().toISOString();
  touch("actes", { rerender: false });

  await journaliser({
    action: "signature.simple", cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
    detail: `signé dans l'application par ${auteur.nom}${auteur.courriel ? " <" + auteur.courriel + ">" : ""} — empreinte ${String(pack.document.sha256).slice(0, 16)}… ; mentions nominatives conservées à l'original interne`,
    to: [acte.createdBy, "role:editeur"].filter(Boolean),
  });
  toast("Acte signé : la signature est horodatée et vérifiable.", "success");

  await envoyerNotification("signature_donnee", {
    config, acte, doc, brand: config.brand.name,
    destinataires: destinatairesAdministration(acte),
    complement: `L'acte ${acte.numero ? "n° " + acte.numero : ""} a été signé dans l'application par ${auteur.nom}.`,
  });
  await publierApresSignature(acte, ctx.paint);
  return true;
}

// La part INTERNE de l'original, telle qu'elle est déposée avec la publication :
// ce que le service conservera au registre sans jamais le diffuser. Elle ne
// transporte pas de copie du texte — le public a déjà le document ; elle porte
// ce qui l'identifie nominativement, et la trace des courriels.
function originalInterneDe(acte) {
  const d = dossierInterne(acte.original) || {};
  return {
    format: "application/vnd.actes.original-interne+json",
    version: 1,
    reference: acte.numero || "",
    objet: acte.objet || "",
    document: { sha256: (acte.original && acte.original.document && acte.original.document.sha256) || "" },
    signataire: d.signataire || {},
    operateur: d.operateur || {},
    authentification: d.authentification || "",
    poste: d.poste || "",
    adresseIp: d.adresseIp || "",
    horodatage: (acte.original && acte.original.horodatage) || null,
    courriels: tracesCourriel(acte),
    remarque: "Part non diffusée de l'original signé : mentions nominatives du signataire et trace des notifications. Elle est conservée au registre et n'est servie par aucune route publique.",
  };
}

// Le dossier de signature interne, sous les yeux de qui peut y accéder (agent,
// administrateur) — et jamais d'un lecteur du recueil public.
export function voirDossierInterne(acte) {
  const pack = acte.original || {};
  const d = dossierInterne(pack) || (acte.signatureSimple && acte.signatureSimple.interne) || {};
  const s = d.signataire || {};
  const sig = (pack.signatures || [])[0] || {};
  const traces = tracesCourriel(acte);
  const body = h("div", { class: "fr-stack" },
    h("div", { class: "fr-alert fr-alert--info" },
      h("p", { class: "fr-alert__title", text: "Part non diffusée de l'original" }),
      h("p", { class: "fr-small", text: "Ces mentions identifient nominativement le signataire : elles restent au registre et ne figurent ni dans la publication, ni dans le recueil public, ni dans l'export JSON de l'original. Elles se lisent ici, ou par la route protégée du service (dossier de signature), jamais par une adresse publique." })),
    h("div", { class: "sig-cert" },
      h("h3", { text: "Signataire" }),
      kv("Nom", s.nom), kv("Fonction", s.fonction),
      kv("Adresse électronique", s.courriel),
      kv("Personne du référentiel", s.personId),
      kv("Compte de l'application", s.compteId),
      kv("Compte de signature", s.compte || s.compteOutil)),
    h("div", { class: "sig-cert" },
      h("h3", { text: "Authentification" }),
      kv("Moyen", d.authentification),
      kv("Poste", d.poste),
      kv("Adresse réseau", d.adresseIp)),
    h("div", { class: "sig-cert" },
      h("h3", { text: "Horodatage et empreinte" }),
      kv("Signé le", acte.signatureSimple?.signeLe || sig.signeLe ? new Date(acte.signatureSimple?.signeLe || sig.signeLe).toLocaleString("fr-FR") : ""),
      kv("Empreinte du document", pack.document?.sha256, true),
      kv("Algorithme", sig.algorithme || acte.signatureSimple?.algorithme),
      kv("Horodatage émis par", pack.horodatage?.emisPar)),
    h("div", { class: "sig-cert" },
      h("h3", { text: "Courriels de notification" }),
      traces.length
        ? h("div", { class: "fr-stack" }, ...traces.map((t) => h("p", { class: "fr-small", style: { margin: 0 } },
          h("span", { class: "fr-muted", text: new Date(t.at).toLocaleString("fr-FR") + " — " }),
          h("span", { class: t.envoye ? "" : "fr-error-text", text: (t.envoye ? "envoyé à " : "NON envoyé à ") + t.destinataire + (t.envoye ? "" : " (" + (t.motif || "motif inconnu") + ")") }))))
        : h("p", { class: "fr-small fr-muted", text: "Aucun courriel n'a été adressé au titre de cet acte." })),
  );
  const contenu = JSON.stringify(originalInterneDe(acte), null, 2);
  modal({
    title: "Dossier de signature — " + (acte.numero || ""),
    wide: true,
    body,
    actions: (close) => [
      button("Télécharger le dossier (JSON)", {
        variant: "tertiary", icon: "download",
        onClick: () => download(`${(acte.numero || "acte").replace(/[^\w-]+/g, "_")}-dossier-signature.json`, contenu, "application/json"),
      }),
      button("Fermer", { variant: "secondary", onClick: close }),
    ],
  });
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

// Qui agit : le nom du compte connecté, tel qu'il s'inscrit dans le dossier.
const nomDeCompte = () => fullName(state.user) || state.user?.login || "";

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

// ============================================================================
// CIRCUIT EXTERNE — la signature sans API.
//
// Le rédacteur « envoie à signature » : il TÉLÉCHARGE le document prêt à
// signer. Puis, la version signée revenue (papier scanné, ou PDF d'un outil
// tiers), il la DÉPOSE. Le réviseur compétent CERTIFIE enfin la conformité de
// la pièce signée avec la version numérique qui sera publiée — c'est le
// contrôle qui remplace, dans ce circuit, la révision d'avant signature.
// ============================================================================

const echap = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const tailleLisible = (n) => {
  const b = Number(n) || 0;
  if (b < 1024) return b + " o";
  if (b < 1024 * 1024) return Math.round(b / 1024) + " Ko";
  return (b / 1024 / 1024).toFixed(1) + " Mo";
};

// L'empreinte SHA-256 d'un fichier : c'est elle qui attache la pièce signée à
// l'acte, et que le réviseur retrouve sur le document déposé.
async function sha256Fichier(fichier) {
  const buf = await fichier.arrayBuffer();
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Le DOCUMENT PRÊT À SIGNER : le document compilé, précédé d'un bordereau de
// remise — de quoi établir, imprimer et faire circuler la pièce hors de
// l'application. Le bordereau porte la référence, l'empreinte du texte remis et
// la marche à suivre ; il s'imprime avec le document.
export function documentPretsASigner(acte, doc, trame) {
  const config = state.config;
  const base = exportStandaloneHtml(doc, config, trame || trameById(acte.trameId));
  const ex = acte.externe || {};
  const em = ex.document?.empreinte || empreinteTexte(acte);
  const remisLe = ex.demandeLe ? formatDate(String(ex.demandeLe).slice(0, 10), "date-long") : formatDate(todayIso(), "date-long");
  const bordereau = `
<div class="bordereau">
  <div class="bordereau__tete">
    <strong>Document prêt à signer</strong>
    <span>Signature hors de l'application — circuit externe</span>
  </div>
  <table class="bordereau__refs">
    <tr><th>Référence</th><td>${echap(acte.numero || doc?.meta?.numero || "—")}</td></tr>
    <tr><th>Objet</th><td>${echap(acte.objet || doc?.meta?.objet || "—")}</td></tr>
    <tr><th>Entité</th><td>${echap(doc?.meta?.entity?.name || "—")}</td></tr>
    <tr><th>Trame</th><td>${echap((trame?.name || doc?.meta?.trameName || "—") + " v" + (trame?.version || doc?.meta?.trameVersion || ""))}</td></tr>
    <tr><th>Remis le</th><td>${echap(remisLe)}${ex.demandeParNom ? " par " + echap(ex.demandeParNom) : ""}</td></tr>
    <tr><th>Empreinte du document</th><td class="mono">${echap(em)}</td></tr>
  </table>
  <p class="bordereau__note">Ce document n'a pas encore été signé. Faites-le signer hors de l'application (signature manuscrite, ou outil tiers), puis déposez la version signée au format PDF dans l'application, par « Ajouter la version signée ». La conformité de la pièce signée avec la version numérique sera certifiée par le réviseur avant la publication. Signez sur la ou les pages de signature ; ne portez aucune mention manuscrite ailleurs qu'à l'emplacement prévu.</p>
</div>`;
  const css = `
.bordereau{border:1.5px solid #000;border-radius:3px;padding:12px 14px;margin:0 0 18px;background:#fff;font-family:${config.brand.uiFont || "system-ui, sans-serif"};font-size:12px}
.bordereau__tete{display:flex;justify-content:space-between;align-items:baseline;gap:12px;border-bottom:1px solid #000;padding-bottom:6px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em}
.bordereau__tete strong{font-size:13px}
.bordereau__tete span{font-size:10px;text-transform:none;letter-spacing:0}
.bordereau__refs{border-collapse:collapse;width:100%}
.bordereau__refs th{text-align:left;font-weight:600;padding:2px 10px 2px 0;vertical-align:top;white-space:nowrap;width:1%}
.bordereau__refs td{padding:2px 0;vertical-align:top}
.bordereau__refs td.mono{font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all}
.bordereau__note{margin:8px 0 0;font-size:11px;color:#333}
@media print{.bordereau{page-break-inside:avoid}}
`;
  return base.replace("</head>", "<style>" + css + "</style></head>").replace('<div class="wrap">', '<div class="wrap">' + bordereau);
}

// « Envoyer à signature », dans le circuit externe : la remise du document. Le
// fichier est téléchargé dans la foulée — c'est le geste même de l'envoi — et
// l'acte est déposé au service (sans circuit de signature) pour porter plus tard
// la version signée, la certification et la publication.
export async function envoyerEnSignatureExterne(acte, doc, ctx, { trame } = {}) {
  const config = state.config;
  const t = trame || trameById(acte.trameId);
  const requise = revisionRequisePour(acte);
  const at = new Date().toISOString();
  const empreinte = empreinteTexte(acte);
  acte.signatureMode = "externe";
  acte.externe = {
    ...(acte.externe || {}),
    mode: "externe",
    statut: "a_signer",
    demandeLe: at,
    demandePar: state.user?.id || "",
    demandeParNom: nomDeCompte(),
    document: { empreinte, genereLe: at, reference: acte.numero || doc?.meta?.numero || "" },
    certificationRequise: requise,
  };
  acte.statut = "en_signature";
  acte.updatedAt = at;
  touch("actes", { rerender: false });
  telechargerDocumentASigner(acte, doc, t);
  const settings = publicationSettings(config);
  const token = settings.jetonDemonstration;
  const flow = beginFlow(`Remise du document à signer — ${acte.numero || acte.id}`);
  try {
    await assurerActeDepose(acte, doc, { token, flow });
  } catch (e) { dire("Dépôt au service : " + String((e && e.message) || e), "warning"); }
  await journaliser({
    action: "signature.externe_remise", cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
    detail: "circuit externe — document prêt à signer téléchargé" + (requise ? " ; la conformité devra être certifiée par un réviseur avant publication" : ""),
    to: [acte.createdBy, "role:editeur"].filter(Boolean),
  });
  dire("Document prêt à signer téléchargé : il circule hors de l'application. Une fois signé, déposez la version signée (PDF).", "success");
  ctx.paint();
}

// Télécharger le document prêt à signer (une page A4 imprimable, avec son
// bordereau de remise).
export function telechargerDocumentASigner(acte, doc, trame) {
  const nom = String(acte.numero || "acte").replace(/[^\w-]+/g, "_");
  download(`${nom}-a-signer.html`, documentPretsASigner(acte, doc, trame), "text/html");
}

// S'assure que l'acte est déposé au service (sans circuit de signature), et
// rend son identifiant. Un acte déposé puis perdu par le service (redémarrage)
// est redéposé — les routes d'écriture le retrouvent alors par son empreinte.
async function assurerActeDepose(acte, doc, { token, flow }) {
  if (acte.api?.acteId) {
    const chk = await get(`/v1/actes/${acte.api.acteId}`, { flow, label: "Vérification de l'acte déposé", source: "lecture" });
    if (chk.ok) return acte.api.acteId;
  }
  const dep = await post("/v1/actes", {
    akn: aknOf(acte, doc),
    numero: acte.numero || doc?.meta?.numero || "", objet: acte.objet || doc?.meta?.objet || "",
    nature: doc?.meta?.actTypeId || "Décision", entityId: doc?.meta?.entity?.id || "", entityName: doc?.meta?.entity?.name || "",
    dateSignature: acte.dateSignature || doc?.meta?.dateSignature || "", trameId: acte.trameId || "",
    ecarts: (acte.ecarts || []).length,
    ...themeDe(acte, doc),
    publishable: actePubliable(acte),
    controleLegalite: controleLegaliteActif(),
    signatureMode: "externe",
    certificationRequise: !!(acte.externe && acte.externe.certificationRequise),
  }, { token, flow, label: "Dépôt de l'acte (circuit externe)" });
  if (!dep.ok) { dire("Dépôt au service : " + errorMessage(dep), "warning"); return ""; }
  acte.api = { ...(acte.api || {}), acteId: dep.body.id, sha256: dep.body.sha256, deposeLe: dep.body.deposeLe, statut: "externe" };
  touch("actes", { rerender: false });
  return dep.body.id;
}

// « Ajouter la version signée » : la saisie du PDF signé. On vérifie que c'est
// bien un PDF, on calcule son empreinte SHA-256, on le dépose (il sera montré
// comme l'original sur le recueil public), et on l'inscrit au dossier.
function ajouterVersionSignee(acte, doc, ctx) {
  const fichierInput = h("input", { type: "file", accept: "application/pdf,.pdf" });
  fichierInput.className = "fr-input";
  const info = h("div", { class: "fr-stack", style: { marginTop: "8px" } });
  const confirmer = button("Déposer la version signée", { variant: "primary", icon: "upload", disabled: true });
  let fichier = null;
  let empreinte = "";

  fichierInput.addEventListener("change", async () => {
    clear(info);
    fichier = (fichierInput.files && fichierInput.files[0]) || null;
    empreinte = "";
    confirmer.disabled = true;
    if (!fichier) return;
    if (!/pdf/i.test(fichier.type) && !/\.pdf$/i.test(fichier.name)) {
      info.appendChild(h("div", { class: "fr-alert fr-alert--error" },
        h("p", { class: "fr-alert__title", text: "Fichier PDF attendu" }),
        h("p", { class: "fr-small", text: "La version signée se dépose au format PDF : c'est la pièce qui sera conservée et montrée comme l'original. Scannez ou enregistrez le document signé en PDF." })));
      return;
    }
    info.appendChild(h("p", { class: "fr-small fr-muted", text: "Calcul de l'empreinte…" }));
    try {
      empreinte = await sha256Fichier(fichier);
      clear(info);
      info.appendChild(h("div", { class: "sig-cert" },
        kv("Fichier", fichier.name),
        kv("Taille", tailleLisible(fichier.size)),
        kv("Empreinte SHA-256", empreinte, true)));
      confirmer.disabled = false;
    } catch (e) {
      clear(info);
      info.appendChild(h("p", { class: "fr-small", text: "Calcul de l'empreinte impossible : " + String((e && e.message) || e) }));
    }
  });

  const m = modal({
    title: "Ajouter la version signée — " + (acte.numero || ""),
    wide: true,
    body: h("div", { class: "fr-stack" },
      h("p", { class: "fr-small", text: "Déposez le document signé hors de l'application, au format PDF (signature manuscrite scannée, ou PDF produit par l'outil tiers). Il devient la pièce de référence de l'acte, et c'est lui qui sera montré comme l'original dans le recueil public." }),
      h("div", { class: "fr-field" },
        h("label", { class: "fr-label", text: "Version signée (PDF)" }),
        fichierInput),
      info,
      acte.externe && acte.externe.certificationRequise
        ? h("p", { class: "fr-small fr-muted", text: "Un réviseur est compétent pour cet acte : sa conformité avec la version numérique devra être certifiée avant la publication." })
        : h("p", { class: "fr-small fr-muted", text: "Aucun réviseur n'est compétent pour cet acte : la version signée déposée suffit à la publication." })),
    actions: (close) => [
      button("Renoncer", { variant: "secondary", onClick: close }),
      confirmer,
    ],
  });
  confirmer.addEventListener("click", async () => {
    if (!fichier) return;
    confirmer.disabled = true;
    const ok = await deposerVersionSignee(acte, doc, fichier, empreinte, ctx);
    if (ok) m.close();
    else confirmer.disabled = false;
  });
}

async function deposerVersionSignee(acte, doc, fichier, empreinte, ctx) {
  const config = state.config;
  const settings = publicationSettings(config);
  const token = settings.jetonDemonstration;
  const flow = beginFlow(`Dépôt de la version signée — ${acte.numero || acte.id}`);
  try {
    dire("Téléversement de la version signée…", "info");
    const up = await root.uploadPlugin(fichier);
    if (!up || up.error || !up.url) {
      dire("Le dépôt de la version signée a échoué" + (up && up.error ? " (" + up.error + ")" : "") + " : l'acte n'a pas été déclaré signé.", "error");
      return false;
    }
    const at = new Date().toISOString();
    const signe = {
      url: up.url, sha256: empreinte, nom: fichier.name, taille: fichier.size,
      type: "application/pdf", deposeLe: at, deposePar: state.user?.id || "", deposeParNom: nomDeCompte(),
    };
    const requise = acte.externe ? !!acte.externe.certificationRequise : revisionRequisePour(acte);
    acte.signatureMode = "externe";
    acte.externe = { ...(acte.externe || {}), mode: "externe", statut: "signe_depose", signe, certificationRequise: requise, certification: {} };
    acte.statut = "signee";
    acte.signeLe = at;
    acte.updatedAt = at;
    delete acte.original;
    touch("actes", { rerender: false });

    const apiId = await assurerActeDepose(acte, doc, { token, flow });
    if (apiId) {
      const res = await post(`/v1/actes/${apiId}/signature-externe`, { signe, certificationRequise: requise }, { token, flow, label: "Déclaration de la version signée" });
      if (!res.ok) dire("Le service a refusé la version signée : " + errorMessage(res), "warning");
    }
    const reviseurs = requise ? reviseursDe(acte) : [];
    await journaliser({
      action: "signature.externe_depose", cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
      detail: `version signée déposée (${fichier.name}, ${tailleLisible(fichier.size)}) — empreinte ${String(empreinte).slice(0, 16)}…`
        + (requise ? " ; en attente de la certification de conformité" : "; aucun réviseur compétent, la publication peut suivre"),
      to: [acte.createdBy, ...reviseurs.map((u) => u.id)].filter(Boolean),
    });
    dire(requise
      ? "Version signée déposée. Elle attend la certification de conformité du réviseur."
      : "Version signée déposée. Elle peut être publiée.", "success");
    ctx.paint();
    if (!requise) await publierApresVerification(acte, ctx.paint);
    return true;
  } catch (e) {
    dire(String((e && e.message) || e), "error");
    return false;
  }
}

// Voir la version signée — la pièce déposée, dans son cadre de lecture.
export function voirVersionSignee(acte) {
  const sg = versionSignee(acte);
  if (!sg?.url) { toast("Aucune version signée n'a été déposée pour cet acte.", "error"); return; }
  const cert = certificationDe(acte) || {};
  const body = h("div", { class: "fr-stack" },
    h("div", { class: "fr-row" },
      h("a", { class: "fr-btn fr-btn--secondary", href: sg.url, target: "_blank", rel: "noopener" }, "Ouvrir dans un onglet"),
      button("Télécharger le PDF", { variant: "secondary", icon: "download", onClick: () => { const a = h("a", { href: sg.url, download: sg.nom || "acte-signe.pdf" }); document.body.appendChild(a); a.click(); a.remove(); } })),
    h("div", { class: "sig-doc-view" }, h("iframe", { class: "sig-doc-frame", src: sg.url, title: "Version signée" })),
    h("div", { class: "sig-cert" },
      h("h3", { text: "Version signée" }),
      kv("Fichier", sg.nom),
      kv("Taille", tailleLisible(sg.taille)),
      kv("Déposé le", sg.deposeLe ? new Date(sg.deposeLe).toLocaleString("fr-FR") : "", false),
      kv("Déposé par", sg.deposeParNom),
      kv("Empreinte SHA-256", sg.sha256, true),
      cert.statut === "conforme"
        ? h("p", { class: "fr-small", text: `Conformité certifiée par ${cert.parNom || "le réviseur"} le ${formatDate(String(cert.le || "").slice(0, 10))} — la pièce signée est conforme à la version numérique publiée.` })
        : cert.statut === "non_conforme"
          ? h("p", { class: "fr-small fr-error-text", text: "Conformité refusée par le réviseur : " + (cert.motif || "") })
          : h("p", { class: "fr-small fr-muted", text: "Conformité non certifiée à ce jour." })),
  );
  modal({
    title: "Version signée — " + (acte.numero || ""),
    wide: true,
    body,
    actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })],
  });
}

// « Certifier la conformité » — le geste du réviseur dans le circuit externe.
// Il a sous les yeux la pièce signée (le PDF) et la version numérique dont
// l'empreinte est rappelée ; il déclare que les deux concordent.
export function certifierConformite(acte, doc, ctx) {
  const sg = versionSignee(acte) || {};
  const cert = certificationDe(acte) || {};
  const empreinte = empreinteTexte(acte);
  const points = [
    { id: "signataire", label: "La pièce signée porte la signature du signataire désigné, avec sa qualité apparente." },
    { id: "texte", label: "Le texte signé est identique, au fond et à la forme, à la version numérique qui sera publiée." },
    { id: "complet", label: "Le document est complet : toutes les pages sont présentes, sans rature ni surcharge non approuvée." },
    { id: "date", label: "La date de signature portée sur la pièce est cohérente avec l'acte." },
  ];
  const cases = new Map();
  const coches = h("div", { class: "fr-stack" });
  for (const p of points) {
    const c = h("input", { type: "checkbox" });
    cases.set(p.id, c);
    coches.appendChild(h("label", { class: "fr-check" }, c, p.label));
  }
  const remarque = h("textarea", { class: "fr-textarea", rows: 2, placeholder: "Observation (facultatif) — ce qui a été vérifié, une réserve éventuelle…" });
  const boutonCertifier = button("Certifier conforme", { variant: "primary", icon: "check", disabled: true });
  const boutonRefuser = button("Refuser la conformité…", { variant: "danger", icon: "warn" });
  const maj = () => { boutonCertifier.disabled = ![...cases.values()].every((c) => c.checked); };
  for (const c of cases.values()) c.addEventListener("change", maj);

  const m = modal({
    title: "Certifier la conformité — " + (acte.numero || ""),
    wide: true,
    body: h("div", { class: "fr-stack" },
      h("p", { class: "fr-small", text: "Vous certifiez que la version signée déposée est conforme à la version numérique de l'acte qui sera publiée. C'est ce contrôle qui remplace, dans le circuit externe, la révision d'avant signature : l'acte a été signé hors de l'application, et la pièce signée devient l'original." }),
      h("div", { class: "fr-grid fr-grid--2" },
        h("div", { class: "fr-card fr-card--soft" },
          h("h3", { class: "fr-card__title", text: "Version numérique" }),
          kv("Acte", (acte.numero || "") + " — " + (acte.objet || doc?.meta?.objet || "")),
          kv("Empreinte du texte", empreinte, true),
          button("Ouvrir l'acte", { variant: "tertiary", size: "sm", icon: "eye", onClick: () => { m.close(); navigate("acte/" + acte.id); } })),
        h("div", { class: "fr-card fr-card--soft" },
          h("h3", { class: "fr-card__title", text: "Version signée" }),
          kv("Fichier", sg.nom),
          kv("Empreinte SHA-256", sg.sha256, true),
          button("Voir la pièce signée", { variant: "tertiary", size: "sm", icon: "eye", onClick: () => voirVersionSignee(acte) }))),
      h("div", { class: "sig-doc-view", style: { height: "38vh" } },
        h("iframe", { class: "sig-doc-frame", src: sg.url, title: "Version signée" })),
      h("p", { class: "fr-label", text: "Points de contrôle" }),
      coches,
      h("div", { class: "fr-field" }, h("label", { class: "fr-label", text: "Observation" }), remarque)),
    actions: (close) => [
      button("Renoncer", { variant: "secondary", onClick: close }),
      boutonRefuser,
      boutonCertifier,
    ],
  });

  boutonCertifier.addEventListener("click", async () => {
    boutonCertifier.disabled = true;
    const ok = await enregistrerCertification(acte, doc, {
      statut: "conforme",
      points: [...cases.entries()].filter(([, c]) => c.checked).map(([id]) => id),
      remarque: remarque.value.trim(),
    }, ctx);
    if (ok) m.close(); else boutonCertifier.disabled = false;
  });
  boutonRefuser.addEventListener("click", async () => {
    const motif = (remarque.value || "").trim();
    if (motif.length < 8) { toast("Le motif du refus est obligatoire : dites ce qui ne concorde pas (au moins 8 caractères).", "warning"); remarque.focus(); return; }
    boutonRefuser.disabled = true;
    const ok = await enregistrerCertification(acte, doc, { statut: "non_conforme", motif, remarque: motif }, ctx);
    if (ok) m.close(); else boutonRefuser.disabled = false;
  });
}

async function enregistrerCertification(acte, doc, decision, ctx) {
  const config = state.config;
  const settings = publicationSettings(config);
  const token = settings.jetonDemonstration;
  const flow = beginFlow(`Certification de conformité — ${acte.numero || acte.id}`);
  const at = new Date().toISOString();
  const sg = versionSignee(acte) || {};
  const certification = {
    statut: decision.statut,
    par: state.user?.id || "",
    parNom: nomDeCompte(),
    le: at,
    empreinte: empreinteTexte(acte),
    sha256Signe: sg.sha256 || "",
    points: decision.points || [],
    remarque: decision.remarque || "",
    motif: decision.motif || "",
  };
  acte.externe = { ...(acte.externe || {}), certification };
  acte.externe.statut = decision.statut === "conforme" ? "certifie" : "refuse";
  if (decision.statut !== "conforme") {
    // La conformité refusée renvoie la pièce : l'acte attend une nouvelle
    // version signée. La publication reste fermée.
    acte.statut = "en_signature";
    delete acte.signeLe;
  }
  acte.updatedAt = at;
  touch("actes", { rerender: false });
  try {
    const apiId = await assurerActeDepose(acte, doc, { token, flow });
    if (apiId) {
      const res = await post(`/v1/actes/${apiId}/conformite`, { certification }, { token, flow, label: "Certification de conformité" });
      if (!res.ok) dire("Le service a refusé la certification : " + errorMessage(res), "warning");
    }
  } catch (e) { dire(String((e && e.message) || e), "warning"); }
  await journaliser({
    action: decision.statut === "conforme" ? "signature.conformite_certifiee" : "signature.conformite_refusee",
    cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
    detail: decision.statut === "conforme"
      ? `conformité de la version signée certifiée par ${certification.parNom} — conforme à la version numérique (empreinte ${String(certification.empreinte).slice(0, 16)}…)`
      : `conformité REFUSÉE par ${certification.parNom} : ${decision.motif}`,
    to: [acte.createdBy, "role:editeur"].filter(Boolean),
  });
  if (decision.statut === "conforme") {
    dire("Conformité certifiée : la pièce signée est conforme à la version numérique.", "success");
    ctx.paint();
    await publierApresVerification(acte, ctx.paint);
  } else {
    dire("Conformité refusée : l'acte attend une version signée conforme.", "warning");
    ctx.paint();
  }
  return true;
}

// La suite de la version signée : la publication, quand elle est automatique.
// Mêmes règles que le retour de signature électronique — l'étape du contrôle de
// légalité d'abord (fonction expérimentale), puis la publication d'un acte
// publiable ; un acte individuel s'arrête au registre.
async function publierApresVerification(acte, paint) {
  const doc = docOfActe(acte);
  const possible = publicationExternePossible(acte);
  if (!possible.ok) { dire(possible.raison, "warning"); paint(); return; }
  if (publicationSettings(state.config).auto === false) {
    dire("Version signée prête. La publication automatique est désactivée : l'acte reste au registre, à publier le moment venu.", "success");
    await journaliser({
      action: "publication.automatique_eteinte", cible: "acte", cibleLabel: libelleActe(acte), acteId: acte.id,
      detail: "version signée prête — publication automatique désactivée (Administration › Publication)", to: [acte.createdBy],
    });
    paint();
    return;
  }
  if (!actePubliable(acte)) {
    dire("Acte signé — acte individuel : conservé au registre, non publié au recueil.", "success");
    paint();
    return;
  }
  if (!doc) { paint(); return; }
  if (!acte.api?.acteId) {
    dire("Version signée prête. Elle peut maintenant être publiée.", "success");
    paint();
    return;
  }
  if (controleLegaliteActif() && !acte.execution?.transmission) {
    dire("Version signée — transmission au contrôle de légalité…", "info");
    if (!(await transmettreAuControleDeLegalite(acte, doc))) { paint(); return; }
  }
  const settings = publicationSettings(state.config);
  await publier(acte, doc, {
    datePublication: todayIso(), mode: settings.opposabilite.mode, jours: settings.opposabilite.jours,
    recueil: settings.recueil, publishConsolide: true,
  }, paint);
}

// La pièce signée, présentée au service de publication : c'est elle « l'original »
// d'un acte mené par le circuit externe — un PDF, non un paquet JSON signé.
export function originalExternePourPublication(acte, doc) {
  const sg = versionSignee(acte) || {};
  const cert = certificationDe(acte) || {};
  const auteur = doc ? auteurDe(acte, doc) : { nom: "", fonction: "" };
  return {
    format: "application/pdf",
    externe: true,
    url: sg.url || "",
    nom: sg.nom || "",
    document: { sha256: sg.sha256 || "", akn: acte.api?.akn || "" },
    pageHtml: "",
    signatures: [{
      signataire: { nom: auteur.nom, fonction: auteur.fonction },
      signeLe: acte.signeLe || sg.deposeLe || "",
      algorithme: "signature hors application — circuit externe (papier ou outil tiers)",
      valeur: "",
      certificat: null,
      externe: true,
    }],
    horodatage: null,
    certification: {
      statut: cert.statut || "",
      par: cert.par || "", parNom: cert.parNom || "", le: cert.le || "",
      empreinte: cert.empreinte || "", sha256Signe: cert.sha256Signe || "",
      points: cert.points || [], remarque: cert.remarque || "",
    },
  };
}

// Le geste d'envoi en signature est exporté : le bureau de la révision le
// déclenche à la validation d'un acte révisé (« si l'acte est validé, il part en
// signature »), par ce chemin-là et pas un autre.
export async function envoyerEnSignature(acte, ctx, { ouvrirOutil: ouvrir = true } = {}) {
  // Une ANNEXE ne part pas en signature : elle tient son autorité de l'acte qui
  // l'adopte, et c'est cet acte qui est signé — son original étant suivi du texte
  // de l'annexe (voir src/lib/annexe-docs.js).
  if (natureOfActe(acte, state.trames) === "annexe") {
    toast("Une annexe ne se signe pas : envoyez en signature l'acte qui l'adopte.", "warning");
    return;
  }
  const doc = ctx.docs.get(acte.id) || docOfActe(acte);
  const trame = trameById(acte.trameId);
  // DEUX CIRCUITS. Le circuit EXTERNE ne passe par aucun prestataire : le
  // document est téléchargé prêt à signer, signé hors de l'application, puis la
  // version signée est déposée (voir plus bas). Le circuit électronique suit le
  // chemin historique — dépôt au service, ouverture du circuit, outil du
  // prestataire.
  if (modeSignatureDe(acte) === "externe") {
    await envoyerEnSignatureExterne(acte, doc, ctx, { trame });
    return;
  }
  // CIRCUIT SIMPLE : la signature est donnée dans l'application. Le geste
  // n'ouvre pas l'outil d'un prestataire, il ouvre la fenêtre de signature du
  // signataire — même chemin que depuis « Ma signature ».
  if (modeSignatureDe(acte) === "simple") {
    await engagerSignatureSimple(acte, doc, ctx);
    return;
  }
  return envoyerEnSignatureElectronique(acte, doc, ctx, { ouvrir });
}

async function envoyerEnSignatureElectronique(acte, doc, ctx, { ouvrir = true } = {}) {
  const config = state.config;
  const settings = publicationSettings(config);
  const token = settings.jetonDemonstration;
  // Porte du parapheur : l'acte signé doit être l'acte approuvé. Le service
  // applique la même règle (409 « validation_incomplete »), mais on évite un
  // aller-retour voué à l'échec et on explique le motif à l'agent.
  // Aucun circuit applicable : aucune porte de ce côté, et l'état de validation
  // n'est pas transmis au service.
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
      // Les réglages du prestataire, tels qu'ils sont réglés dans cette
      // installation (Administration › Signature, éventuellement recouverts par
      // le .env). Le service en a besoin pour appeler le bon prestataire, avec
      // le bon niveau et les bons points de terminaison. AUCUNE CLÉ n'y figure :
      // elle ne vit qu'auprès du service.
      api: reglagesPrestataire(config),
    }, { token, flow, label: "Envoi en signature (ouverture du circuit)" });
    if (!sig.ok) { toast(errorMessage(sig), "error"); return; }
    const signatureId = sig.body.signatureId;

    // Passerelle vers le prestataire. DEUX CAS, et ils ne se mélangent pas :
    //
    //   • le SERVICE est branché sur un prestataire (il détient la clé) : c'est
    //     LUI qui vient de déposer le document et d'ouvrir le circuit, avec les
    //     réglages qu'on lui a transmis. Le poste n'invente rien : il reprend
    //     le dossier et le lien de signature que le service a rendus ;
    //   • sinon, la démonstration : c'est l'application qui joue le prestataire,
    //     ici, en trois appels simulés.
    const simule = circuitElectroniqueSimule();
    let docId = sig.body.dossier || "";
    let lienSignature = sig.body.lienSignature || "";
    if (simule) {
      const d = await prestataire.creerDocument({ xml: akn, titre: acte.objet || doc.meta?.objet || "", reference: acte.numero || "", flow });
      await prestataire.ajouterSignataire({ docId: d.id, signataire: auteur, flow });
      const started = await prestataire.demarrer({ docId: d.id, flow });
      docId = d.id;
      lienSignature = started.lienSignature || lienSignature;
    }

    acte.api = {
      acteId: apiActeId, signatureId, docId, statut: "en_attente",
      sha256: dep.body.sha256, lienSignature,
      signataire: auteur.nom, deposeLe: dep.body.deposeLe,
      simulation: simule,
      prestataire: sig.body.prestataire || null,
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
    // La demande de signature : par courriel quand le service de courriel est
    // configuré (sinon elle est tracée « non envoyée »).
    if (auteur.courriel) {
      await envoyerNotification("demande_signature", {
        config, acte, doc, brand: config.brand.name,
        destinataires: [{ nom: auteur.nom, courriel: auteur.courriel }],
        complement: `L'acte ${acte.numero ? "n° " + acte.numero : ""} « ${acte.objet || ""} » vous est présenté pour signature dans l'outil du prestataire (${PRESTATAIRE.nom}).`,
      });
    }
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

// Le circuit est mené par un prestataire RÉELLEMENT branché sur le service : la
// signature se donne CHEZ LUI, dans son outil, et non dans cette page. On ne
// montre donc pas l'écran de démonstration : on donne le lien, et le geste qui
// relève le statut (c'est le prestataire qui prévient le service, par le
// webhook, quand la signature est donnée).
function ouvrirLienPrestataire(acte, ctx, autoOpen) {
  const url = acte.api?.lienSignature || "";
  const infos = acte.api?.prestataire || {};
  const m = modal({
    title: "Signature chez le prestataire",
    body: h("div", { class: "fr-stack" },
      h("p", { text: "Cet acte a été déposé auprès du prestataire de signature. C'est dans SON outil, et non ici, que la signature est donnée : l'application ne reçoit jamais le document avant qu'il ne revienne signé, et il revient par la notification du prestataire — vérifiée par son empreinte." }),
      h("p", { class: "fr-small fr-muted", text: [
        infos.nom ? "Prestataire : " + infos.nom : "",
        acte.api?.docId ? "dossier " + acte.api.docId : "",
        acte.api?.signatureId ? "circuit " + acte.api.signatureId : "",
      ].filter(Boolean).join(" · ") }),
      url
        ? h("p", {}, h("a", { class: "deleg-lien", href: url, target: "_blank", rel: "noopener noreferrer", text: url }))
        : h("p", { class: "fr-small fr-muted", text: "Le prestataire n'a pas rendu de lien de signature : ouvrez son outil, ou relevez le statut du circuit." }),
      h("p", { class: "fr-small fr-muted", text: "Quand la signature sera donnée, le prestataire préviendra le service : le premier « Relever le statut » fera revenir l'acte signé." })),
    actions: (close) => [
      button("Relever le statut", { variant: "secondary", icon: "refresh", onClick: async () => { close(); await releverStatut(acte, ctx); } }),
      button("Fermer", { variant: "secondary", onClick: close }),
    ],
  });
  // Le geste d'envoi ouvre le prestataire de lui-même : c'est ce que l'agent
  // attend en cliquant « Envoyer en signature ».
  if (autoOpen && url) { try { window.open(url, "_blank", "noopener"); } catch (e) { /* le lien reste dans la fenêtre */ } }
  return m;
}

// L'écran du prestataire de signature (SIMULÉ) : volontairement distinct de
// l'application (autre en-tête, autre vocabulaire) — c'est un autre service.
async function ouvrirOutil(acte, doc, ctx, autoOpen) {
  if (!acte.api?.docId) { toast("Aucun circuit ouvert pour cet acte.", "error"); return; }
  // Prestataire réellement branché : la signature n'est pas donnée ici.
  if (!circuitElectroniqueSimule() && acte.api?.lienSignature) { ouvrirLienPrestataire(acte, ctx, autoOpen); return; }
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
  // Même porte de compétence que la signature simple : le circuit externe
  // (prestataire) est ouvert au nom du signataire désigné, pas du premier
  // compte venu (voir src/lib/signataires.js).
  if (!competenceDuCompte(config, state.user, acte, trameById(acte.trameId)).ok) {
    toast("Votre compte n'est pas dans la chaîne de signature de cet acte : signature refusée.", "error");
    return;
  }
  const flow = beginFlow(`Signature — ${acte.numero || acte.id}`);
  const auteur = auteurDe(acte, doc);
  const akn = aknOf(acte, doc);
  const bodyHtml = renderDocument(doc, config, {}).outerHTML.replace(/^<article[^>]*>/, "").replace(/<\/article>$/, "");
  const pack = await prestataire.signer({
    docId: acte.api.docId, signataire: auteur, pageHtml: bodyHtml, brand: config.brand.name,
    pageCss: documentCss(config, styleForDoc(config, doc)), flow,
    // Le dossier interne voyage AVEC l'original, comme pour la signature simple :
    // l'original est scindé en deux à la publication (part publique / part
    // interne), quel que soit le circuit.
    interne: dossierSignatureInterne({ signataire: auteur, courriels: tracesCourriel(acte), poste: navigator.userAgent, operateur: { id: state.user?.id || "", nom: nomDeCompte(), courriel: state.user?.email || "", compte: state.user?.login || "" } }),
  });
  const notif = await post("/v1/webhooks/signature", {
    signatureId: acte.api.signatureId, statut: "signee", documentSigne: pack,
  }, { token: publicationSettings(config).jetonDemonstration, flow, label: "Notification au service (retour de l'acte signé)" });
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
  await envoyerNotification("signature_donnee", {
    config, acte, doc, brand: config.brand.name,
    destinataires: destinatairesAdministration(acte),
    complement: `L'acte ${acte.numero ? "n° " + acte.numero : ""} a été signé par ${auteur.nom}.`,
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
    toast(natureOfActe(acte, state.trames) === "annexe"
      ? "Annexe — elle ne se publie pas pour elle-même : son texte suit l'acte qui l'adopte."
      : "Acte signé — acte individuel : conservé au registre, non publié au recueil.", "success");
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
  // Les actes du circuit EXTERNE dont la conformité n'est pas encore certifiée
  // n'attendent pas la publication : ils attendent le réviseur, et figurent dans
  // un encart à part.
  const signeOuSignee = (a) => !!(a.original || versionSignee(a) || a.statut === "signee");
  // Les ANNEXES ne sont ni signées ni publiées pour elles-mêmes : leur texte suit
  // l'acte qui les adopte (voir src/lib/annexe-docs.js). Elles ont donc leur
  // propre encart, et ne figurent ni dans les actes à publier, ni dans les actes
  // individuels (dont la trame est déclarée non publiable).
  const estAnnexe = (a) => natureOfActe(a, state.trames) === "annexe";
  const annexes = acts.filter((a) => estAnnexe(a) && a.statut !== "publie");
  const aSigner = acts.filter((a) => signeOuSignee(a) && a.statut !== "publie" && actePubliable(a) && (!estCircuitExterne(a) || publicationExternePossible(a).ok));
  const enCertification = acts.filter((a) => estCircuitExterne(a) && versionSignee(a) && a.statut !== "publie" && !publicationExternePossible(a).ok);
  const nonPubliables = acts.filter((a) => signeOuSignee(a) && a.statut !== "publie" && !actePubliable(a) && !estAnnexe(a));
  const publies = acts.filter((a) => a.statut === "publie" && a.publication);
  const autres = acts.filter((a) => a.statut !== "signee" && a.statut !== "publie" && !a.original && !versionSignee(a) && a.kind !== "consolide");

  const grid = h("div", { class: "sig-grid" });
  const left = h("div", { class: "fr-stack" });
  const right = h("div", { class: "fr-stack" });
  grid.appendChild(left); grid.appendChild(right);
  root.appendChild(grid);

  left.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Actes signés, prêts à publier" }),
    h("p", { class: "fr-small fr-muted", text: "La publication dépose la version en ligne, attribue l'identifiant ELI et fixe la date d'opposabilité d'un acte qui fait droit. Un document (verbatim, déclaration, vœu) se publie pour être donné à lire : il n'en reçoit ni opposabilité ni entrée en vigueur. Un acte non signé ne peut pas être publié : le service refuse l'appel (409)." }),
  ));

  if (!aSigner.length) {
    left.appendChild(h("div", { class: "fr-card fr-card--soft" },
      h("p", { class: "fr-small fr-muted", text: "Aucun acte signé en attente de publication." })));
  }

  for (const a of aSigner) {
    const doc = docs.get(a.id);
    const trame = trameById(a.trameId);
    // Un document non juridique (verbatim, déclaration, vœu) se publie sans
    // jamais devenir opposable : la carte de publication ne propose donc ni
    // règle d'entrée en vigueur, ni aperçu d'opposabilité.
    const nonJuridique = !natureJuridiqueDe(trame);
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
      // Un document non juridique n'a pas d'entrée en vigueur : on n'en règle ni
      // la règle ni le délai — la publication le donne à lire, un point c'est tout.
      nonJuridique
        ? h("p", { class: "fr-small fr-muted", style: { margin: "0 0 6px" }, text: `Document non juridique (${natureDocs(natureDe(trame)).label.toLowerCase()}) : publié au recueil pour être porté à la connaissance de tous, il n'a ni opposabilité ni entrée en vigueur.` })
        : h("div", { class: "fr-grid fr-grid--2" },
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
        h("strong", { text: nonJuridique ? "Portée" : "Opposabilité" }),
        h("span", { text: nonJuridique
          ? "Document non opposable : publié pour être porté à la connaissance de tous, il ne crée ni droits ni obligations."
          : `Entrée en vigueur le ${formatDate(opposability(form.datePublication, { opposabilite: { mode: form.mode, jours: form.jours } }))} (${opposabilityRule({ opposabilite: { mode: form.mode, jours: form.jours } })})` })),
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

  // Actes du CIRCUIT EXTERNE dont la version signée attend la certification de
  // conformité du réviseur : ils ne peuvent pas encore être publiés. Le
  // réviseur compétent y trouve le geste, sans quitter l'écran.
  if (enCertification.length) {
    const cardCert = h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: "Versions signées en attente de certification" }),
      h("p", { class: "fr-small fr-muted", text: "Circuit externe : la pièce signée a été déposée. Le réviseur compétent certifie qu'elle est conforme à la version numérique, et la publication suit." }));
    for (const a of enCertification) {
      const doc = docs.get(a.id);
      const cert = certificationDe(a) || {};
      const sg = versionSignee(a) || {};
      cardCert.appendChild(h("div", { class: "sig-pub__line" },
        h("div", {},
          h("strong", { text: `${a.numero || "acte"} — ${a.objet || doc?.meta?.objet || ""}` }),
          h("p", { class: "fr-small fr-muted", text: [
            "signée hors application",
            sg.nom ? sg.nom : "",
            sg.deposeLe ? "déposée le " + formatDate(String(sg.deposeLe).slice(0, 10)) : "",
            cert.statut === "non_conforme" ? "conformité refusée" : "conformité à certifier",
          ].filter(Boolean).join(" · ") })),
        h("div", { class: "fr-row" },
          button("Voir la version signée", { variant: "secondary", size: "sm", icon: "eye", onClick: () => voirVersionSignee(a) }),
          peutCertifier(a)
            ? button("Certifier la conformité…", { variant: "primary", size: "sm", icon: "check", onClick: () => certifierConformite(a, doc, { docs, paint }) })
            : h("span", { class: "fr-small fr-muted", text: "en attente d'un réviseur compétent" }),
          button("Voir l'acte", { variant: "tertiary", size: "sm", icon: "note", onClick: () => navigate("acte/" + a.id) }))));
    }
    left.appendChild(cardCert);
  }

  // Les ANNEXES : adoptées par un autre acte, leur texte suit l'acte d'adoption
  // dans l'original signé. Ni elles ne se signent, ni elles ne se publient pour
  // elles-mêmes : on le dit, et on renvoie vers l'acte qui les porte.
  if (annexes.length) {
    const cardAn = h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: "Annexes adoptées" }),
      h("p", { class: "fr-small fr-muted", text: "Une annexe ne tient pas son autorité d'elle-même : c'est l'acte qui l'adopte qui est signé, et son original est suivi du texte de l'annexe. Publiez l'acte d'adoption : l'annexe y est comprise. Un RÈGLEMENT, lui, est en outre publié À PART au recueil, à titre informatif : son texte en vigueur s'y consulte pour lui-même, comme un code, sous son propre identifiant." }));
    for (const a of annexes) {
      const doc = docs.get(a.id);
      const adoption = a.adoptePar || doc?.meta?.adoption || null;
      const adoptant = adoption ? state.actes.find((x) => x.id === adoption.acteId) : null;
      const reglement = estReglement(trameById(a.trameId));
      cardAn.appendChild(h("div", { class: "sig-pub__line" },
        h("div", {},
          h("strong", { text: `${a.numero || "acte"} — ${a.objet || doc?.meta?.objet || ""}` }),
          h("p", { class: "fr-small fr-muted", text: adoption
            ? `Annexe adoptée par ${adoption.designation || "un acte"} n° ${adoption.numero || "—"}`
            : "Annexe — aucun acte d'adoption désigné" }),
          reglement
            ? h("p", { class: "fr-small fr-muted", text: a.publication
              ? `Règlement publié à part au recueil, à titre informatif — ${a.publication.eliUri || ""}`
              : "Règlement — publié à part au recueil dès que son acte d'adoption est publié." })
            : null),
        h("div", { class: "fr-row" },
          adoptant ? button("Acte d'adoption", { variant: "secondary", size: "sm", icon: "upload", onClick: () => { ui.acteId = adoptant.id; ui.tab = "circuit"; paint(); } }) : null,
          reglement && a.publication?.cle ? button("Voir au recueil", { variant: "secondary", size: "sm", icon: "globe", onClick: () => navigate("recueil/" + encodeURIComponent(a.publication.cle)) }) : null,
          button("Voir l'acte", { variant: "tertiary", size: "sm", icon: "eye", onClick: () => navigate("acte/" + a.id) }))));
    }
    left.appendChild(cardAn);
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
        h("p", { class: "fr-small fr-muted", text: [`Publié le ${formatDate(p.datePublication)}`, pubNonJuridique(p) ? "document non opposable" : `opposable le ${formatDate(p.dateOpposabilite)}`, p.recueil].filter(Boolean).join(" · ") })),
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
    h("p", { class: "fr-small", text: "4. La publication attribue l'ELI, fixe la date de publication — et, pour un acte qui fait droit, la date d'opposabilité —, et conserve l'original signé." }),
    h("p", { class: "fr-small", text: "5. Les actes individuels (revalorisation d'un traitement, sanction…) relèvent d'une trame déclarée non publiable : signés et conservés, mais jamais déposés au recueil. Le service refuse de les publier (409)." }),
    h("p", { class: "fr-small", text: "6. Une annexe (un règlement intérieur adopté par une délibération) ne se signe ni ne se publie pour elle-même : c'est l'acte qui l'adopte qui est signé, et l'original de cet acte est suivi du texte de l'annexe." }),
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
  // d'envoyer une requête vouée à l'échec pour un acte individuel ou une annexe.
  if (!actePubliable(acte)) {
    dire(natureOfActe(acte, state.trames) === "annexe"
      ? "Une annexe ne se publie pas pour elle-même : son texte suit l'acte qui l'adopte, et c'est cet acte qui est publié au recueil."
      : "Cet acte est déclaré non publiable par sa trame : il ne peut pas être déposé au recueil.", "error");
    return;
  }
  // Le circuit externe a ses propres conditions : la version signée doit être
  // déposée, et sa conformité certifiée quand un réviseur est compétent. Le
  // service applique les mêmes règles (409 version_signee_absente /
  // conformite_non_certifiee).
  const externe = modeSignatureDe(acte) === "externe";
  if (externe) {
    const possible = publicationExternePossible(acte);
    if (!possible.ok) { dire(possible.raison, "error"); return; }
    if (!acte.api?.acteId) { dire("L'acte n'est pas déposé auprès du service : impossible de publier.", "error"); return; }
  }
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
  // FAIT DROIT ou NON ? Un verbatim, une déclaration, un vœu se publient, mais
  // ne créent pas de droits : leur publication n'emporte ni opposabilité, ni
  // délais d'exécution. On le dit à la publication elle-même (`juridique`), et
  // l'on n'inscrit aucune date d'entrée en vigueur — le recueil, la version en
  // ligne et le JSON-LD s'y conforment (voir src/lib/eli.js).
  const juridique = !trame || natureJuridiqueDe(trame);
  const natureDoc = trame ? natureDe(trame) : "acte";
  const dateOpposabilite = juridique ? opposability(form.datePublication, { opposabilite: { mode: form.mode, jours: form.jours } }) : "";
  const rule = juridique ? opposabilityRule({ opposabilite: { mode: form.mode, jours: form.jours } }) : "";
  const theme = themeDe(acte, doc);
  // L'« original » : le paquet signé du circuit électronique, ou — circuit
  // externe — la pièce signée déposée (le PDF), avec la certification du
  // réviseur. C'est ce que la publication conserve et que le recueil montre.
  //
  // Il part en DEUX : la part PUBLIQUE (document, signatures réduites au nom et
  // à la fonction, horodatage) part au recueil ; la part INTERNE (adresse du
  // signataire, compte, moyen d'authentification, courriels) est déposée à part,
  // rangée au registre, et n'est servie par aucune route publique. Voir
  // src/lib/signature.js (partiePublique) et src/server/mysql/actes.mjs.
  const originalBrut = externe ? originalExternePourPublication(acte, doc) : acte.original;
  const original = originalBrut ? partiePublique(originalBrut) : originalBrut;
  const originalExterne = externe ? original : null;
  const originalInterne = !externe && originalBrut ? originalInterneDe(acte) : null;
  const record = {
    eliUri: eliU, url, numero: acte.numero || doc.meta?.numero || "", nature: doc.meta?.actTypeId || "Décision",
    // Le type d'acte et l'entité voyagent AVEC la publication : c'est ce que le
    // JSON-LD publie (`eli:type_document`, `eli:passed_by`), et ce que la notice
    // du recueil relit. Sans eux le type restait vide, et l'autorité anonyme.
    actTypeId: doc.meta?.actTypeId || "",
    entityId: doc.meta?.entity?.id || "",
    ...theme,
    title: (doc.nodes.find((n) => n.type === "title")?.text) || acte.objet || "",
    objet: acte.objet || doc.meta?.objet || "", entityName: doc.meta?.entity?.name || "",
    dateDocument: acte.dateSignature || doc.meta?.dateSignature || "", datePublication: form.datePublication,
    dateOpposabilite, opposabiliteRule: rule, recueil: form.recueil, kind: kindFor(acte),
    // Le document FAIT-IL DROIT ? `false` pour un verbatim, une déclaration, un
    // vœu : le recueil les présente comme des documents, sans opposabilité.
    juridique, natureDoc,
    auteur: auteurDe(acte, doc).nom, originalSha256: (original && original.document && original.document.sha256) || "",
    originalExterne,
    // Le certificat de transmission au contrôle de légalité, s'il y en a un :
    // la version en ligne en porte la mention, et le registre des publications
    // le conserve (voir src/lib/eli.js).
    transmission: acte.execution?.transmission?.certificat || null,
    // Les annexes : l'acte d'adoption quand le document publié EST une annexe, et
    // les documents annexés à l'acte. La version en ligne les dit — une annexe
    // héritée peut avoir son propre enregistrement, et l'acte qui l'adopte
    // rappelle alors son intitulé. Voir src/lib/annexes.js.
    adoption: acte.adoptePar || doc.meta?.adoption || null,
    annexes: (acte.annexes?.length ? acte.annexes : doc.meta?.annexes) || [],
  };
  const html = buildWebVersion({ doc, config, record });
  const jsonld = publicationJsonLd({ ...record, brandName: config.brand.name, licence: licenceReutilisation(config), signature: { signataires: [{ nom: record.auteur }], signeLe: acte.signeLe, algorithme: externe ? "signature hors application — circuit externe" : "ECDSA P-256 / SHA-256" } });
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
    // La publication dit si le document FAIT DROIT : le service la range telle
    // quelle, et le recueil s'en sert pour ne pas présenter un verbatim ou un
    // vœu comme un acte opposable (voir src/server/mysql/actes.mjs).
    juridique, natureDoc,
    html, akn, jsonld, md, texte, original, transmission: record.transmission,
    // Un acte ÉPINGLÉ (mis en avant depuis l'onglet « Actes ») dépose son
    // drapeau avec sa version en ligne : le recueil public le présentera dans sa
    // bande « À la une ». Le service l'hérite aussi d'une version à l'autre, par
    // identifiant ELI (voir hPublier) — l'acte modifié reste donc à la une.
    ...(acte.epingle ? { epingle: true } : {}),
    ...theme,
  };
  if (originalExterne) payload.originalExterne = originalExterne;
  // La part interne de l'original : le service la range au registre, et ne la
  // sert jamais par une route publique. Les courriels envoyés au titre de l'acte
  // y sont joints — c'est la trace de qui a été prévenu, et quand.
  if (originalInterne) payload.originalInterne = originalInterne;
  const opts = { token, flow, label: "Publication de l'acte signé", idempotencyKey: `${eliU}@${record.dateDocument}-${kind}` };
  try {
    let res = await post(`/v1/actes/${acte.api.acteId}/publication`, payload, opts);
    // Le service ne connaît pas (ou plus) cet acte — redémarrage du service, ou
    // acte signé sur un autre poste : 404. Ou bien il connaît l'acte mais a
    // perdu son dossier externe (sa version signée, sa certification) : 409
    // « version_signee_absente » / « conformite_non_certifiee » alors que le
    // client, lui, les détient. Dans les deux cas on rejoue le dossier auprès du
    // service, puis on republie : ce qui est publié est ce que le client a.
    const perdu = !res.ok && externe && res.status === 409
      && (res.body?.code === "version_signee_absente" || res.body?.code === "conformite_non_certifiee");
    if (!res.ok && (res.status === 404 || perdu)) {
      const rétabli = externe ? await retablirActeExterne(acte, doc, { token, flow }) : await retablirActe(acte, doc, { token, flow });
      if (rétabli) res = await post(`/v1/actes/${acte.api.acteId}/publication`, payload, opts);
    }
    if (!res.ok) { dire(errorMessage(res), "error"); return; }
    // La réponse du service porte la version signée du circuit externe ; on la
    // reprend pour que la fiche de l'acte et l'onglet « Original signé » la
    // montrent sans relire le registre (le service la renvoie depuis peu ; le
    // repli par `originalExterne` local couvre une réponse antérieure).
    acte.publication = { ...res.body, html, akn, jsonld, md, texte, ...(originalExterne ? { originalExterne } : {}) };
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
      detail: juridique ? `publié sous l'ELI ${eliU}, opposable le ${dateOpposabilite}` : `publié au recueil sous l'ELI ${eliU} (document non opposable)`,
      to: [acte.createdBy, "role:editeur"],
    });
    // La notification de publication : par courriel quand le service de courriel
    // est configuré (sinon elle est tracée « non envoyée »).
    await envoyerNotification("acte_publie", {
      config, acte, doc, brand: config.brand.name,
      destinataires: destinatairesAdministration(acte),
      complement: juridique
        ? `L'acte est publié au recueil sous l'identifiant ${eliU}. Il devient opposable le ${dateOpposabilite}.`
        : `Le document est publié au recueil sous l'identifiant ${eliU}. Il ne fait pas droit : il n'est pas opposable.`,
    });
    // Un acte qui prévoyait des abrogations peut désormais les faire courir :
    // elles prennent effet au jour de son ENTRÉE EN VIGUEUR (voir
    // src/ui/abrogations-apply.js — idempotent).
    appliquerAbrogations().catch((e) => console.warn("Abrogations :", e));

    // Les RÈGLEMENTS annexés à l'acte : leur texte en vigueur part au recueil
    // dans la foulée, à titre informatif (voir `publierReglements`). Un acte qui
    // n'adopte qu'un tableau (une grille tarifaire) n'en déclenche aucun.
    await publierReglements(acte, doc, { token, flow, datePublication: form.datePublication, recueil: form.recueil });

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

// ============================================================================
// LES RÈGLEMENTS — la publication informative autonome d'une annexe normative.
//
// Un RÈGLEMENT (voir src/lib/annexes.js, `estReglement`) est une annexe d'un
// genre particulier : un texte NORMATIF, qui se consulte pour lui-même, comme un
// code. Un code, en droit, n'est pas un texte signé : il est COMPOSÉ par les
// lois et les décrets qui en créent, modifient ou suppriment les articles. Un
// règlement intérieur fonctionne de même : une délibération l'adopte, une autre
// en adopte une nouvelle rédaction, et le texte EN VIGUEUR est celui qu'on lit.
//
// Le recueil en donne donc une publication INFORMATIVE autonome, à côté de sa
// place dans l'acte qui l'adopte : son texte en vigueur s'y consulte sous son
// propre identifiant (une fois créé, jamais changé — c'est lui qui rend les
// versions successives solidaires : un règlement modifié est le MÊME règlement),
// et les publications successives en sont les VERSIONS, la dernière déposée
// étant celle que le recueil montre (voir `versionsOf` côté service).
//
// Cette publication n'est ni signée ni opposable, et elle le dit : elle ne porte
// pas d'original (`informative: true` le déclare au service), et le recueil la
// présente « à titre informatif ». Elle n'appartient pas à l'acte d'adoption :
// celui-ci garde son état, sa publication et sa place.
//
// Elle se déclenche à la publication de l'acte qui adopte le règlement — donc
// aussi à l'amorçage de démonstration, qui passe par `publier`.
async function publierReglements(acte, doc, { token, flow, datePublication, recueil }) {
  const config = state.config;
  const joints = annexesJointes(doc?.meta?.annexes, { actes: state.actes, trames: state.trames, config, acteId: acte.id });
  const reglements = joints.filter((j) => estReglement(j.trame) && j.doc);
  if (!reglements.length || !acte.api?.acteId) return;
  // L'auteur du règlement, c'est le signataire de l'acte qui l'adopte : c'est sa
  // signature qui donne au règlement son autorité (voir src/lib/annexes.js).
  const auteur = auteurDe(acte, doc);
  for (const j of reglements) {
    const reg = j.doc;
    const a = j.acte;                       // l'annexe au registre : c'est ELLE le règlement
    // L'identifiant du règlement est CRÉÉ une fois — à partir du premier acte qui
    // l'adopte — puis CONSERVÉ sur l'annexe. On ne le redemande jamais : c'est ce
    // qui fait qu'une modification publie une VERSION, non un autre document.
    const eli = a.eli || eliUriOf({ config, actTypeId: j.trame.actTypeId || "reglement", numero: acte.numero || doc?.meta?.numero, entityCode: doc?.meta?.entity?.code });
    const title = reg.nodes.find((n) => n.type === "title")?.text || a.objet || j.trame.name || "Règlement";
    const designation = (config.actTypes || []).find((t) => t.id === j.trame.actTypeId)?.label || j.trame.name || "Règlement";
    // Ce qui rattache le règlement à sa décision d'adoption : c'est l'ACTE qui
    // l'adopte — son numéro, sa date, son identifiant ELI —, et non
    // l'identification figée de l'annexe (qui, n'ayant pas de numéro, ne dit
    // rien d'utile ici). Le recueil s'en sert pour écrire « Annexe à la
    // délibération n°… du … » et y renvoyer.
    const adoption = {
      acteId: acte.id,
      numero: acte.numero || doc?.meta?.numero || "",
      designation: doc?.meta?.designation || "Acte",
      date: acte.dateSignature || doc?.meta?.dateSignature || "",
      eli: eliUriOf({ config, actTypeId: doc?.meta?.actTypeId, numero: acte.numero || doc?.meta?.numero, entityCode: doc?.meta?.entity?.code }),
      objet: acte.objet || doc?.meta?.objet || "",
    };
    const record = {
      eliUri: eli, url: "", numero: "", nature: designation,
      ...themeDe(a, reg),
      title, objet: reg.meta?.objet || a.objet || "",
      entityName: reg.meta?.entity?.name || doc?.meta?.entity?.name || "",
      dateDocument: datePublication, datePublication,
      dateOpposabilite: "", opposabiliteRule: "", recueil: recueil || "",
      kind: "informative", auteur: auteur.nom, adoption,
    };
    const html = buildWebVersion({ doc: reg, config, record });
    const akn = exportAkn(reg, config, j.trame);
    const jsonld = publicationJsonLd({ ...record, brandName: config.brand.name, licence: licenceReutilisation(config) });
    const md = exportMarkdown(reg, config, { notes: false });
    const texte = documentToText(reg, config);
    const payload = {
      eliUri: eli, url: "", work: "", numero: "", nature: record.nature, objet: record.objet,
      entityCode: doc?.meta?.entity?.code || "", brandName: config.brand.name,
      dateDocument: record.dateDocument, datePublication,
      dateOpposabilite: "", opposabiliteRule: "", recueil: record.recueil, auteur: record.auteur,
      kind: "informative", html, akn, jsonld, md, texte,
      // Le service n'attend ni signature ni original : cette publication est le
      // texte du règlement, à titre informatif — pas un acte opposable.
      informative: true, adoption,
      ...themeDe(a, reg),
    };
    try {
      const res = await post(`/v1/actes/${acte.api.acteId}/publication`, payload, {
        token, flow, label: "Publication informative du règlement",
        idempotencyKey: `${eli}@${datePublication}-informative`,
      });
      if (!res.ok) { dire("Règlement — publication informative : " + errorMessage(res), "warning"); continue; }
      // Le registre local garde l'identifiant du règlement (il le réutilisera à
      // la prochaine adoption), sa publication et sa date.
      Object.assign(a, {
        eli, publication: { ...res.body, html, akn, jsonld, md, texte },
        datePublication, updatedAt: new Date().toISOString(),
      });
      touch("actes", { rerender: false });
    } catch (e) {
      dire("Règlement — publication informative : " + String((e && e.message) || e), "warning");
    }
  }
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

    // Prestataire réellement branché : c'est le SERVICE qui a déposé le document
    // et ouvert le circuit, et la signature se donne chez le prestataire. Le
    // poste ne peut donc pas simuler la signature ici : on donne le lien, et
    // l'acte reviendra signé par la notification du prestataire.
    if (!circuitElectroniqueSimule()) {
      toast("Version consolidée : le circuit est ouvert auprès du prestataire. La signature s'y donne ; l'acte reviendra signé par sa notification.", "info");
      if (circ.body && circ.body.lienSignature) { try { window.open(circ.body.lienSignature, "_blank", "noopener"); } catch (e) { /* le lien reste au journal */ } }
      return;
    }

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
      // La version consolidée d'une annexe porte le lien d'adoption : elle EST
      // l'annexe en vigueur. Voir src/lib/annexes.js.
      adoption: cons.adoptePar || doc.meta?.adoption || null,
      annexes: (cons.annexes?.length ? cons.annexes : doc.meta?.annexes) || [],
    };
    const html = buildWebVersion({ doc, config, record });
    const jsonld = publicationJsonLd({ ...record, brandName: config.brand.name, licence: licenceReutilisation(config), signature: { signataires: [{ nom: auteur.nom }], signeLe: pack.signatures[0].signeLe, algorithme: "ECDSA P-256 / SHA-256" } });
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

// Rétablit un acte du CIRCUIT EXTERNE auprès du service : le document est
// redéposé, puis la version signée et la certification sont rejouées. Le
// service retrouve ainsi l'état qui autorise la publication, sans qu'un circuit
// de signature électronique soit ouvert.
async function retablirActeExterne(acte, doc, { token, flow }) {
  const apiId = await assurerActeDepose(acte, doc, { token, flow });
  if (!apiId) return false;
  const sg = versionSignee(acte);
  if (sg) {
    const res = await post(`/v1/actes/${apiId}/signature-externe`, { signe: sg, certificationRequise: !!acte.externe?.certificationRequise }, { token, flow, label: "Rétablissement de la version signée" });
    if (!res.ok) { dire("Rétablissement de la version signée : " + errorMessage(res), "error"); return false; }
  }
  const cert = certificationDe(acte);
  if (cert && cert.statut) {
    const res = await post(`/v1/actes/${apiId}/conformite`, { certification: cert }, { token, flow, label: "Rétablissement de la certification de conformité" });
    if (!res.ok) { dire("Rétablissement de la certification : " + errorMessage(res), "error"); return false; }
  }
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
  // Circuit externe : l'original est la PIÈCE signée déposée (le PDF), et non
  // le paquet signé du prestataire.
  if (modeSignatureDe(acte) === "externe" || versionSignee(acte)) { voirVersionSignee(acte); return; }
  const pack = acte.original;
  if (!pack) { toast("Aucun original signé pour cet acte.", "error"); return; }
  const s = pack.signatures?.[0] || {};
  const h0 = pack.horodatage || {};
  const body = h("div", { class: "fr-stack" },
    h("div", { class: "fr-row" },
      button("Ouvrir la page de l'original", { variant: "secondary", icon: "eye", onClick: () => ouvrirPage(pack.pageHtml, "Original signé") }),
      button("Imprimer / PDF", { variant: "secondary", icon: "download", onClick: () => printHtml(pack.pageHtml) }),
      // L'export porte la part PUBLIQUE de l'original : le dossier interne
      // (adresse, compte, authentification) n'a pas à sortir du registre par un
      // fichier téléchargé — il se consulte par « Dossier de signature (interne) ».
      button("Télécharger (JSON)", { variant: "secondary", icon: "download", onClick: () => download(`${(pack.reference || "acte").replace(/[^\w-]+/g, "_")}-original-signe.json`, JSON.stringify(partiePublique(pack), null, 2), "application/json") }),
      dossierInterne(pack) ? button("Dossier de signature (interne)…", { variant: "tertiary", icon: "lock", onClick: () => voirDossierInterne(acte) }) : null,
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
