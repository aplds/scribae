// ============================================================================
// Modifier un acte publié.
//
// On n'édite plus un formulaire : on édite L'ACTE. Le document en vigueur est
// ouvert dans un éditeur en place (« style traitement de texte ») ; le rédacteur
// réécrit les articles, les abroge ou en insère. Chaque geste est relevé, et à
// la confirmation DEUX actes sont produits :
//   • l'acte modificatif, qui porte juridiquement la modification ;
//   • la version consolidée de l'acte d'origine, qui trace ce qui a changé et
//     deviendra la version en vigueur une fois la modification publiée.
//
// La suite du circuit est ensuite guidée : l'acte modificatif part en signature,
// puis en publication ; la version consolidée est publiée sous le même
// identifiant ELI que l'acte d'origine et le supplante, sans jamais le faire
// disparaître : l'acte d'origine reste accessible dans l'historique des versions.
// ============================================================================
import { state, touch, navigate, redrawView, can, actePubliable, journaliser, circuitDe, etapeAParachever, trameById, parapheurActif, revisionPour, peutTrancher, circuitSignatureDe, estCircuitExterne, versionSigneeDeActe, certificationDeActeExterne } from "../state.js";
import { h, clear, button, toast, modal, fitPaper, icon } from "../dom.js";
import { textField, selectField, emptyState, helpLink, confirmDialog, promptDialog, abrogationBadge, abrogationPhrase } from "../components.js";
import { openActe } from "./rediger.js";
import { fullName } from "../../lib/users.js";
import {
  etapeActive, validationAJour, avancement, VALIDATION_STATUTS, ETAPE_STATUTS, etiquetteEtape,
} from "../../lib/validation.js";
import {
  formalites, statutExecution, dateExecutoire, dateLimiteRecours, ecartJours, aujourdhui,
  recoursDe, recoursTypeLabel,
} from "../../lib/execution.js";
import { revisionsDe, restaurerRevision } from "../../lib/historique-brouillons.js";
import { soumettreCircuit, reprendreCircuit, carteDecision } from "../parapheur-actions.js";
import { etatRevision } from "../../lib/revision.js";
import { rapportConformite } from "../../lib/conformite.js";
import { carteDossierRevision, carteRapport, carteDecision as carteDecisionRevision } from "../revision-cartes.js";
import { ouvrirFormulaireFormalite } from "../execution-actions.js";
import {
  amendVocab, buildModificatif, buildConsolidated, articlesOf,
  targetPhrase, defaultConsiderant, planSummary, numericToken, designationThe, fillTemplate as fill,
} from "../../lib/amend.js";
import {
  cleanDoc, planFromSession, revertArticleByEId, newInserted,
  addSlot, dropSlot,
} from "../../lib/amend-edit.js";
import { buildEditableDocument } from "./amend-editor.js";
import { signerPicker } from "../signer-picker.js";
import { compile, interpolate } from "../../lib/compile.js";
import { reserverNumero, fixerSequence, prochainNumeroLibre } from "../../lib/numbering.js";
import { renderDocument, applyPaper } from "../../lib/render.js";
import { exportAkn, exportJsonLd, exportMarkdown, exportStandaloneHtml, exportWordDoc, printDocument } from "../../lib/export.js";
import { boutonPdfA, boutonsPdfA } from "../pdfa.js";
import { parseDocumentFile } from "../../lib/akn.js";
import { ecarts, locateAddr } from "../../lib/redaction.js";
import { estAbroge } from "../../lib/abrogations.js";
import { natureOfActe, identification, visaAdoption, annexesVocab, libelleAnnexe, appellationAnnexe, appellationAnnexeDefinie, refDecision, numeroAffiche, avecDe } from "../../lib/annexes.js";
import { annexesJointes, libellePartAnnexe } from "../../lib/annexe-docs.js";
import { download, uid, pickFile, formatDate, todayIso, debounce } from "../../lib/util.js";

const NATURES = {
  original: { label: "Acte d'origine", color: "info" },
  modificatif: { label: "Acte modificatif", color: "warning" },
  consolide: { label: "Version consolidée", color: "success" },
  importe: { label: "Acte importé", color: "info" },
};
export const natureOf = (a) => NATURES[a?.kind] || NATURES.original;

// ------------------------------------------------------------ accès aux actes
// Un acte rédigé à partir d'une trame se compile ; un acte importé, un acte
// modificatif ou une version consolidée transportent leur document.
//
// Le document rendu porte en outre les documents ANNEXÉS (voir
// src/lib/annexe-docs.js) : l'original de l'acte qui les adopte est suivi de
// leur texte, partout — à l'écran, à l'impression, dans les exports, dans
// l'original signé et dans la version en ligne publiée. C'est ici qu'on les
// résout, parce que c'est ici que le registre est connu.
export function docOfActe(a) {
  if (!a) return null;
  if (a.doc) { ajouterAnnexes(a.doc, a); return a.doc; }
  const trame = state.trames.find((t) => t.id === a.trameId);
  if (!trame) return null;
  const doc = compile(trame, a.values || {}, state.config, { overrides: a.overrides });
  doc.kind = "original";
  ajouterAnnexes(doc, a);
  return doc;
}

// Les documents annexés à un acte, attachés à son document. La source est le
// document lui-même (`meta.annexes`, le cas d'un acte modificatif qui adopte la
// nouvelle rédaction d'une annexe) ou les valeurs de l'acte (`values.__annexes`,
// le cas d'une rédaction ordinaire). Un document qui porte DÉJÀ ses annexes
// (un acte modificatif, dont le texte adopté est bâti avec lui) n'est pas
// retouché : ce qu'il transporte fait foi.
function ajouterAnnexes(doc, acte) {
  if (!doc || (doc.annexeDocs || []).length) return;
  const source = (doc.meta?.annexes || []).length ? doc.meta.annexes : (acte.values?.__annexes || []);
  const joints = annexesJointes(source, {
    actes: state.actes, trames: state.trames, config: state.config, acteId: acte.id,
  });
  if (joints.length) doc.annexeDocs = joints;
}

// Écarts à la trame d'un acte : ce que le rédacteur a réécrit et que les
// administrateurs doivent voir. Non bloquant.
export function ecartsOfActe(a) {
  if (!a) return { count: 0, list: [] };
  if (Array.isArray(a.ecarts) && a.ecarts.length) return { count: a.ecarts.length, list: a.ecarts };
  if (a.overrides && a.trameId) {
    const trame = state.trames.find((t) => t.id === a.trameId);
    if (trame) {
      const list = ecarts(trame, a.overrides, state.config);
      return { count: list.length, list };
    }
  }
  return { count: 0, list: [] };
}

export function canModify(a) {
  return !!docOfActe(a);
}

// ------------------------------------------------------------------ session
// L'état d'édition vit dans `state.modifier` : il survit à un redessin de la
// vue (un aller-retour dans le guide, par exemple) sans rien perdre.
function startSession(a) {
  const raw = docOfActe(a);
  if (!raw) {
    toast("Trame d'origine introuvable : cet acte est affichable mais pas modifiable.", "error");
    return false;
  }
  // On travaille sur le texte EN VIGUEUR (une version consolidée est nettoyée de
  // ses marques de modification : on réécrit le texte tel qu'il est aujourd'hui).
  const doc = cleanDoc(raw);
  const designation = doc.meta?.designation || amendVocab(state.config).designation;
  // Une ANNEXE (un règlement intérieur adopté par une délibération, un tableau
  // adopté par une décision) ne se modifie pas comme un acte ordinaire : l'acte
  // modificatif en ADOPTE la nouvelle rédaction, présentée en suivi des
  // modifications. C'est le mode par défaut ici — la modification « classique »
  // (mention expresse article par article) reste possible en le décochant.
  // Voir src/lib/annexes.js et le module `amend`.
  const annexe = doc.meta?.nature === "annexe";
  // L'appellation de l'acte MODIFICATIF. Pour un acte ordinaire, c'est celle de
  // l'acte qu'il modifie (une délibération se modifie par une délibération).
  // Pour une ANNEXE, c'est celle de l'acte qui l'adopte — une délibération
  // adopte le règlement intérieur : l'annexe ne donne pas son nom à l'acte.
  const adoption = annexe ? (a.values?.__adoption || a.adoptePar || doc.meta?.adoption || null) : null;
  const desMod = annexe ? (adoption?.designation || amendVocab(state.config).designation) : designation;
  state.modifier = {
    base: {
      acteId: a.id,
      doc,
      designation,
      label: acteLabel(a, doc),
      previousTrail: doc.trail || [],
      warnings: doc.warnings || [],
      numero: doc.meta?.numero || "",
      dateSignature: doc.meta?.dateSignature || "",
      eli: doc.meta?.eli || "",
      kind: a.kind || "original",
      statut: a.statut || "",
      published: !!a.publication || a.statut === "publie",
    },
    edits: {},
    removed: [],
    inserted: [],
    // Structure du texte : les ajouts et retraits de paragraphes, de lignes de
    // liste et de lignes de tableau (voir lib/amend-edit.js).
    layout: {},
    ajouts: {},
    // Renumérotation : un numéro réattribué par article, ou la renumérotation
    // continue de tout le dispositif (« utile pour un acte avec beaucoup de
    // trous » — les articles abrogés dont le numéro est repris disparaissent).
    renumerote: {},
    renumeroteTout: false,
    meta: defaultMeta(doc, desMod, designation),
    // `showChanges` : le suivi des modifications de la version consolidée est
    // une option d'affichage, décochée par défaut (voir `paintPreview`).
    // Pour une ANNEXE, elle est cochée : la nouvelle rédaction adoptée se lit
    // avec ses ajouts et ses suppressions apparents.
    ui: { preview: "modificatif", showChanges: annexe },
    // L'annexe, et le mode d'adoption (décochable → modification classique).
    annexe,
    suivi: annexe,
  };
  return true;
}

export function modifierFromActe(a) {
  if (!startSession(a)) return;
  navigate("modifier/" + a.id);
}

export function acteLabel(a, doc) {
  const d = doc || docOfActe(a);
  const num = a?.numero || d?.meta?.numero || "";
  const date = a?.dateSignature || d?.meta?.dateSignature || "";
  // Une annexe n'a pas de numéro : on la nomme par la décision qui l'adopte, et
  // sous une forme qui se glisse dans une phrase (« Modifier l'annexe à la
  // délibération n° … », « … les articles de l'annexe à la délibération n° … »).
  if (!num && d?.meta?.nature === "annexe") return appellationAnnexeDefinie(a, state.config);
  return `${num ? "n° " + num : "(sans numéro)"}${date ? " du " + formatDate(date, "date-long") : ""}`;
}

function defaultMeta(doc, designation, cibleDesignation) {
  const config = state.config;
  const entityId = doc.meta?.entity?.id || config.entities?.[0]?.id || "";
  const entity = (config.entities || []).find((e) => e.id === entityId) || config.entities?.[0];
  const des = designation || amendVocab(config).designation;
  // La désignation de la CIBLE (« le règlement intérieur n°… du … ») n'est pas
  // toujours celle de l'acte modificatif : une délibération adopte le règlement
  // intérieur. Voir `startSession`.
  const cible = targetPhrase(doc, cibleDesignation || des, config);
  const objet = doc.meta?.nature === "annexe"
    ? fill(annexesVocab(config).adoptObjet, {
      target: cible, targetInSentence: cible, targetDe: avecDe(cible), designation: des,
      designationThe: designationThe(des),
      designationLower: des.charAt(0).toLowerCase() + des.slice(1),
    })
    : `modification de ${cible}`;
  return {
    // Le numéro proposé est un numéro LIBRE : la séquence saute les rangs déjà
    // portés par un acte ou annulés (voir src/lib/sequence.js).
    numero: entity ? prochainNumeroLibre(config, { entity, actes: state.actes }).numero : "",
    designation: des,
    objet,
    dateSignature: todayIso(),
    dateEffet: "",
    entityId: entity?.id || "",
    signataireId: doc.meta?.signataire?.id || "",
    signataireFonction: "",
    visas: [],
    considerants: [defaultConsiderant(doc, cibleDesignation || des, config)],
    addEntry: true,
    addExecution: true,
  };
}

// ------------------------------------------------------------------- entrée
export function renderModifier(root, params) {
  const id = params?.id;
  if (id) {
    const a = state.actes.find((x) => x.id === id);
    if (!a) {
      root.appendChild(emptyState("Acte introuvable dans le registre.", button("Voir le registre", { variant: "primary", onClick: () => navigate("actes") })));
      return;
    }
    // Un acte non publiable (acte individuel) ne se modifie pas par voie
    // d'acte modificatif : il n'y a pas de texte publié à consolider. On le
    // corrige directement dans l'éditeur de rédaction. Une ANNEXE fait
    // exception : elle suit le régime des annexes — son acte modificatif en
    // ADOPTE la nouvelle rédaction (voir `startSession` et src/lib/annexes.js).
    if (!actePubliable(a) && natureOfActe(a, state.trames) !== "annexe") {
      root.appendChild(emptyState(
        "Cet acte est un acte individuel : sa trame l'a déclaré non publiable. Il ne fait pas l'objet d'un acte modificatif — corrigez-le directement dans l'éditeur de rédaction.",
        button("Corriger l'acte", { variant: "primary", icon: "note", onClick: () => openActe(a) })));
      return;
    }
    if (!state.modifier || state.modifier.base?.acteId !== id) {
      if (!startSession(a)) {
        root.appendChild(emptyState("Cet acte ne peut pas être modifié (document d'origine absent).", button("Voir le registre", { variant: "primary", onClick: () => navigate("actes") })));
        return;
      }
    }
  }
  if (!state.modifier) { renderChooser(root); return; }
  renderWorkspace(root);
}

// Choix de l'acte à modifier
function renderChooser(root) {
  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Modifier un acte" }),
      h("p", { class: "page-head__sub", text: "Choisissez l'acte à modifier, ou importez le fichier XML de l'acte publié. Vous l'éditerez directement dans le document ; la modification produit un acte modificatif et la version consolidée de l'acte d'origine." }),
    ),
    h("div", { class: "page-head__actions" }, helpLink("modifier", "Comment faire ?")),
  ));

  root.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Importer le fichier de l'acte publié" }),
    h("p", { class: "fr-small fr-muted", text: "Fichier Akoma Ntoso (.akn.xml) exporté par l'application ou par un autre outil, ou document JSON exporté par l'application. L'acte importé est ajouté au registre, puis vous l'éditez comme n'importe quel autre acte." }),
    h("div", { class: "fr-row" },
      button("Choisir un fichier…", { variant: "primary", icon: "upload", onClick: importFile }),
    ),
  ));

  const actes = [...state.actes].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const card = h("div", { class: "fr-card" }, h("h2", { class: "fr-card__title", text: "Actes du registre" }));
  if (!actes.length) {
    card.appendChild(h("p", { class: "fr-muted", text: "Aucun acte enregistré pour l'instant. Rédigez un acte, ou importez le fichier d'un acte publié." }));
    card.appendChild(h("div", { class: "fr-row" },
      button("Rédiger un acte", { variant: "secondary", onClick: () => navigate("rediger") }),
    ));
  } else {
    const table = h("table", { class: "fr-table" },
      h("thead", {}, h("tr", {},
        h("th", { text: "Numéro" }), h("th", { text: "Objet" }), h("th", { text: "Nature" }),
        h("th", { text: "Statut" }), h("th", {}))));
    const tb = h("tbody");
    for (const a of actes) {
      const doc = docOfActe(a);
      const n = natureOf(a);
      tb.appendChild(h("tr", {},
        h("td", { class: "fr-mono", text: numeroAffiche(a, state.config, state.trames) || "—" }),
        h("td", { text: a.objet || doc?.meta?.objet || "—" }),
        h("td", {}, h("span", { class: "fr-badge fr-badge--" + n.color, text: n.label })),
        h("td", { class: "fr-small", text: statusText(a) }, abrogationBadge(a)),
        h("td", {}, h("div", { class: "fr-row" },
          (actePubliable(a) || natureOfActe(a, state.trames) === "annexe")
            ? button(natureOfActe(a, state.trames) === "annexe" ? "Modifier l'annexe" : "Modifier", {
              variant: "primary", size: "sm",
              onClick: () => { if (startSession(a)) navigate("modifier/" + a.id); },
            })
            // Acte non publiable : pas d'acte modificatif, correction directe.
            : button("Corriger", { variant: "primary", size: "sm", icon: "note", title: "Acte individuel non publiable : correction directe", onClick: () => openActe(a) }),
          doc ? button("Ouvrir", { variant: "tertiary", size: "sm", onClick: () => navigate("acte/" + a.id) }) : null,
        )),
      ));
    }
    table.appendChild(tb);
    card.appendChild(h("div", { class: "fr-table-wrap" }, table));
  }
  root.appendChild(card);

  root.appendChild(h("div", { class: "fr-card fr-card--soft" },
    h("h2", { class: "fr-card__title", text: "Ce que produit une modification" }),
    h("p", { class: "fr-small", text: "1. L'acte modificatif : un acte à part entière, dont chaque article modifie un article de l'acte d'origine (remplacement, abrogation, insertion)." }),
    h("p", { class: "fr-small", text: "2. La version consolidée : l'acte d'origine à jour. Elle est présentée dans sa rédaction en vigueur, chaque article modifié portant la mention de l'acte qui l'a modifié ; l'affichage du suivi des modifications (ajouts, suppressions et tableau récapitulatif) est une option, décochée par défaut." }),
    h("p", { class: "fr-small fr-muted", text: "L'acte modificatif est ensuite signé puis publié ; à sa publication, la version consolidée est publiée sous le même identifiant ELI que l'acte d'origine et devient la version en vigueur. L'acte d'origine reste accessible dans l'historique." }),
  ));
}

function statusText(a) {
  const map = {
    brouillon: "Brouillon", pret: "Prêt", en_signature: "En signature", signee: "Signé",
    publie: "Publié", abroge: "Abrogé", en_attente: "En attente de publication",
  };
  const kind = a.kind === "consolide" ? "Version consolidée — " : "";
  return kind + (map[a.statut] || a.statut || "Brouillon");
}

async function importFile() {
  const f = await pickFile(".xml,.akn,.json,.txt");
  if (!f) return;
  let doc;
  try { doc = parseDocumentFile(f.text, f.name); }
  catch (e) { toast(e.message, "error"); return; }
  const now = new Date().toISOString();
  const acte = {
    id: uid("acte"),
    kind: "importe",
    trameId: doc.meta?.trameId || "",
    trameName: doc.meta?.trameName || "",
    serviceId: doc.meta?.serviceId || "",
    bureauId: doc.meta?.bureauId || "",
    numero: doc.meta?.numero || "",
    objet: doc.meta?.objet || "",
    entityId: doc.meta?.entity?.id || "",
    dateSignature: doc.meta?.dateSignature || "",
    statut: doc.meta?.statut || "publie",
    source: f.name,
    createdAt: now, updatedAt: now,
    values: null, doc, eli: doc.meta?.eli || "", issues: [],
  };
  state.actes.push(acte);
  touch("actes", { rerender: false });
  toast(`Acte importé : ${acte.numero || f.name}`, "success");
  if (startSession(acte)) navigate("modifier/" + acte.id);
}

// ------------------------------------------------------------------ l'atelier
function renderWorkspace(root) {
  const config = state.config;
  const mod = state.modifier;
  const base = mod.base;

  // ------------------------------------------------------------------ entête
  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Modifier " + base.label }),
      // Une annexe n'est pas « un acte d'origine » comme un autre : on le dit
      // pour ce qu'elle est (voir src/lib/annexes.js).
      h("p", { class: "page-head__sub", text: `${base.doc.meta?.nature === "annexe" ? "Annexe" : natureOf({ kind: base.kind }).label} · ${base.doc.meta?.objet || ""}${base.published ? " · publié" : ""}` }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("modifier", "Aide"),
      button("Changer d'acte", { variant: "tertiary", icon: "doc", onClick: () => { state.modifier = null; redrawView(); } }),
      button("Confirmer la modification", { variant: "primary", icon: "check", onClick: openMetaModal }),
    ),
  ));

  if (base.warnings?.length) {
    root.appendChild(h("div", { class: "fr-alert fr-alert--info" },
      h("p", { class: "fr-alert__title", text: "À vérifier sur l'acte repris" }),
      ...base.warnings.map((wn) => h("p", { class: "fr-small", text: "• " + wn })),
    ));
  }

  const grid = h("div", { class: "redaction-grid" });
  root.appendChild(grid);

  // ------------------------------------------------------- colonne document
  const docCol = h("div", { class: "fr-stack mod-col--doc" });
  const sideCol = h("div", { class: "fr-stack mod-col--side" });
  grid.appendChild(docCol);
  grid.appendChild(sideCol);

  docCol.appendChild(h("div", { class: "fr-card fr-card--soft" },
    h("p", { class: "fr-small", style: { margin: 0 } },
      h("strong", { text: "Écrivez directement dans l'acte. " }),
      "Réécrivez un article comme dans un traitement de texte ; ",
      h("span", { class: "amend-tool amend-tool--demo", text: "abroger" }),
      " le retire, ",
      h("span", { class: "amend-tool amend-tool--demo", text: "+ article après" }),
      " en insère un. Les passages que vous modifiez sont surlignés en orange."),
    h("p", { class: "fr-small fr-muted", style: { margin: "4px 0 0" } },
      "La structure du texte se travaille aussi : les outils d'un paragraphe ou d'une ligne (", h("span", { class: "amend-tool amend-tool--demo", text: "+ §" }), ", ", h("span", { class: "amend-tool amend-tool--demo", text: "✕" }), ", ", h("span", { class: "amend-tool amend-tool--demo", text: "+ ligne" }), ") ajoutent ou retirent un paragraphe, une ligne de liste, une ligne de tableau. Le bouton « n° » d'un article lui réattribue un numéro."),
    h("p", { class: "fr-small fr-muted", style: { margin: "4px 0 0" } },
      "Le préambule (intitulé, visas, considérants) et le bloc de signature appartiennent à l'acte d'origine : ils ne sont pas modifiables ici."),
  ));

  const paperBox = h("div", { class: "paper-box" });
  const paper = h("div", { class: "paper paper--edit" });
  paper.style.fontFamily = config.brand.documentFont || "";
  paperBox.appendChild(paper);
  docCol.appendChild(paperBox);

  const summaryBox = h("div", { class: "fr-card" });
  const actionsBox = h("div", { class: "fr-card fr-card--soft" });
  const previewCard = h("div", { class: "fr-card" });
  sideCol.appendChild(actionsBox);
  sideCol.appendChild(summaryBox);
  sideCol.appendChild(previewCard);
  sideCol.appendChild(trailCard());

  // ------------------------------------------------------------- rendu
  const paintSideSoon = debounce(() => paintSide(), 220);

  mod.action = (name, payload = {}) => {
    switch (name) {
      case "edited":
      case "refresh":
        paintSideSoon();
        break;
      case "abrogate":
        if (!mod.removed.includes(payload.key)) mod.removed.push(payload.key);
        paintAll();
        break;
      case "restore":
        mod.removed = mod.removed.filter((k) => k !== payload.key);
        paintAll();
        break;
      case "abrogateAll":
        mod.removed = articlesOf(base.doc).map((n) => n.eId || n.path || n.id);
        paintAll();
        break;
      case "restoreAll":
        mod.removed = [];
        paintAll();
        break;
      // --- structure : ajouter / retirer un paragraphe, une ligne
      case "addBlock":
        addSlot(mod, payload.container, payload.count, payload.after || null, { type: payload.type || "para" });
        paintAll();
        break;
      case "dropBlock":
        dropSlot(mod, payload.container, payload.count, payload.slot, payload.addr);
        paintAll();
        break;
      case "addLine":
        addSlot(mod, payload.container, payload.count, payload.after || null, { type: payload.kind || "item" });
        paintAll();
        break;
      case "dropLine":
        dropSlot(mod, payload.container, payload.count, payload.slot, payload.addr);
        paintAll();
        break;
      // --- numérotation
      case "renumber":
        renumber(payload);
        break;
      case "renumberAll":
        mod.renumeroteTout = payload.on === true;
        paintAll();
        break;
      case "insert": {
        const anchor = payload.position === "end" ? "" : (payload.node?.eId || payload.node?.path || payload.node?.id || "");
        mod.inserted.push(newInserted(anchor, payload.position || "after", { anchorLabel: payload.node?.numLabel || "" }));
        paintAll();
        break;
      }
      case "removeInserted":
        mod.inserted = mod.inserted.filter((x) => x !== payload.ins);
        paintAll();
        break;
      case "addPara":
        payload.ins.blocks.push({ id: uid("it"), type: "para", text: "" });
        paintAll();
        break;
      case "removePara":
        payload.ins.blocks.splice(payload.index, 1);
        paintAll();
        break;
      default:
        paintAll();
    }
  };

  // Les numéros déjà pris dans le texte en vigueur (renumérotations comprises) et
  // par les articles insérés : c'est ce qui permet de refuser un numéro occupé.
  function numbersUsed(exceptKey) {
    const label = config?.vocab?.articleLabel || "Article";
    const used = new Map();
    for (const n of articlesOf(base.doc)) {
      const key = n.eId || n.path || n.id;
      if (key === exceptKey) continue;
      const renum = mod.renumerote?.[key];
      const num = renum || numericToken(n.numLabel);
      if (num) used.set(String(num), renum ? `${label} ${renum} (après renumérotation)` : (n.numLabel || ""));
    }
    for (const a of planFromSession(base.doc, mod, { designation: mod.meta.designation })) {
      if (a.newNum) used.set(String(a.newNum), "un article inséré");
    }
    return used;
  }

  // Réattribuer un numéro à un article : le numéro doit être LIBRE. Un champ
  // vide remet le numéro d'origine.
  async function renumber({ key, node }) {
    const current = mod.renumerote?.[key] || numericToken(node?.numLabel) || "";
    const v = await promptDialog(
      "Réattribuer un numéro",
      `Numéro de « ${node?.numLabel || "cet article"} » — le numéro doit être libre. Laissez vide pour revenir au numéro d'origine.`,
      current,
    );
    if (v === null) return;
    const num = String(v).trim();
    if (!num) {
      delete mod.renumerote[key];
      paintAll();
      return;
    }
    const pris = numbersUsed(key);
    if (pris.has(num)) {
      toast(`Le numéro « ${num} » est déjà porté par ${pris.get(num)} : un numéro doit être libre.`, "error");
      return;
    }
    mod.renumerote[key] = num;
    paintAll();
  }

  function build() {
    const plan = planFromSession(base.doc, mod, { designation: mod.meta.designation });
    const changes = plan.filter((a) => a.action !== "keep");
    const renum = { map: mod.renumerote || {}, all: mod.renumeroteTout === true };
    if (!changes.length) return { plan, changes, modificatif: null, consolide: null, suivi: false };
    // Le mode « adoption » (celui des ANNEXES) : l'acte modificatif en adopte la
    // nouvelle rédaction, et cette rédaction suit l'acte modificatif signé.
    // Voir src/lib/annexes.js et `buildModificatif` (amend.js).
    const suivi = mod.annexe === true && mod.suivi === true;
    const consolide = buildConsolidated(base.doc, plan, mod.meta, config, { previousTrail: base.previousTrail, showChanges: mod.ui.showChanges, renum });
    // Ce qui est ANNEXÉ à l'acte modificatif : la nouvelle rédaction de l'annexe,
    // sous son propre numéro et sa propre adresse de recueil.
    const annexesSuivi = suivi ? [{
      acteId: base.acteId || "",
      numero: base.doc.meta?.numero || "",
      designation: base.designation,
      date: mod.meta.dateSignature || base.doc.meta?.dateSignature || "",
      objet: base.doc.meta?.objet || mod.meta.objet || "",
      eli: consolide.meta?.eli || base.doc.meta?.eli || "",
    }] : [];
    const modificatif = buildModificatif(base.doc, plan, { ...mod.meta, adoption: suivi, adoptionTarget: suivi ? targetPhrase(base.doc, base.designation, config) : "", adoptionAnnexe: suivi ? (base.acteId || null) : null, annexes: annexesSuivi }, config);
    if (suivi) {
      // La NOUVELLE RÉDACTION de l'annexe part AVEC l'acte qui l'adopte : son
      // original en est suivi (voir src/lib/annexe-docs.js). C'est le texte
      // consolidé qui est annexé — celui qui vient d'être adopté —, et non
      // l'ancienne rédaction que l'acte remplace.
      modificatif.annexeDocs = [{
        ref: annexesSuivi[0],
        acte: { id: base.acteId || "" },
        doc: consolide,
        libelle: libellePartAnnexe(annexesSuivi[0], null, config),
      }];
      // La nouvelle rédaction de l'annexe cite l'acte qui vient de l'adopter :
      // le visa remplace celui de l'adoption précédente, s'il y en avait un.
      const visa = visaAdoption(identification({ id: "", numero: mod.meta.numero, dateSignature: mod.meta.dateSignature, eli: modificatif.meta.eli }, mod.meta.designation), config);
      const v = (consolide.nodes || []).find((n) => n.type === "visas");
      if (v && visa) v.items = [{ id: "visa-adoption", text: visa, lien: modificatif.meta.eli || "" }, ...(v.items || []).filter((it) => it.id !== "visa-adoption")];
    }
    return { plan, changes, modificatif, consolide, suivi };
  }

  function paintDoc() {
    clear(paper);
    // La charte de l'acte donne ses marges à la feuille d'édition.
    applyPaper(paper, base.doc, config);
    paper.appendChild(buildEditableDocument(base.doc, config, mod));
  }

  function paintAll() {
    paintDoc();
    paintSide();
    requestAnimationFrame(() => fitPaper(paperBox, paper));
  }

  function paintSide() {
    const b = build();
    mod.lastBuild = b;
    paintActions();
    paintSummary(b);
    paintPreview(b);
  }

  // ------------------------------------------------------------------- gestes
  // Ce qui porte sur l'acte ENTIER : l'abroger d'un coup (l'acte modificatif
  // abrogera alors tous ses articles), et la numérotation du dispositif.
  function paintActions() {
    clear(actionsBox);
    const arts = articlesOf(base.doc);
    const tous = arts.length > 0 && arts.every((n) => mod.removed.includes(n.eId || n.path || n.id));
    actionsBox.appendChild(h("h2", { class: "fr-card__title", text: "L'acte entier" }));
    // Une ANNEXE ne se modifie pas article par article : l'acte modificatif en
    // adopte la nouvelle rédaction, présentée en suivi des modifications. Le
    // mode classique (mention expresse) reste à un clic — c'est ce que demande
    // parfois une décision qui vise expressément un article.
    if (mod.annexe) {
      actionsBox.appendChild(h("p", { class: "fr-small", style: { margin: "0 0 6px" },
        text: "Ce document est une ANNEXE : par défaut, l'acte modificatif en adopte la nouvelle rédaction (elle lui est annexée, avec le suivi des modifications, et son texte suit l'acte modificatif signé)." }));
      actionsBox.appendChild(checkbox("Modification par adoption (suivi des modifications)", mod.suivi === true, (v) => { mod.suivi = v; paintSide(); }));
      if (!mod.suivi) {
        actionsBox.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "2px 0 0" },
          text: "Décoché : modification classique, article par article (« L'article 3 du règlement intérieur est remplacé par… »)." }));
      }
      actionsBox.appendChild(h("hr", { class: "fr-sep" }));
    }
    actionsBox.appendChild(tous
      ? h("p", { class: "fr-small", style: { margin: "0 0 8px" }, text: "Tous les articles sont abrogés : la version consolidée ne portera plus aucune disposition en vigueur." })
      : h("p", { class: "fr-small fr-muted", style: { margin: "0 0 8px" }, text: "Abroger l'acte d'un seul geste retire tous ses articles ; chacun reste rétablissable dans le document." }));
    actionsBox.appendChild(h("div", { class: "fr-row" },
      tous
        ? button("Rétablir tous les articles", { variant: "tertiary", size: "sm", icon: "refresh", onClick: () => mod.action("restoreAll") })
        : button("Abroger tout l'acte", {
          variant: "tertiary", size: "sm", icon: "trash",
          onClick: async () => {
            const ok = await confirmDialog(
              "Abroger tout l'acte",
              `L'acte modificatif abrogera les ${arts.length} article(s) de ${base.label} : la version consolidée ne portera plus aucune disposition en vigueur. L'acte d'origine reste au recueil.`,
              { confirmLabel: "Abroger tout l'acte", danger: true },
            );
            if (ok) mod.action("abrogateAll");
          },
        })));

    actionsBox.appendChild(h("hr", { class: "fr-sep" }));
    actionsBox.appendChild(h("h3", { style: { margin: "0 0 6px", fontSize: ".95rem" }, text: "Numérotation du dispositif" }));
    actionsBox.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0 0 6px" },
      text: "Le bouton « n° » d'un article lui réattribue un numéro (il doit être libre). « Tout renuméroter » rend la numérotation continue — utile pour un acte troué par les abrogations." }));
    actionsBox.appendChild(checkbox("Tout renuméroter", mod.renumeroteTout === true, (v) => mod.action("renumberAll", { on: v })));
    const renum = Object.entries(mod.renumerote || {});
    if (renum.length) {
      const ul = h("ul", { class: "mod-changes" });
      for (const [key, num] of renum) {
        const node = articlesOf(base.doc).find((n) => (n.eId || n.path || n.id) === key);
        ul.appendChild(h("li", { class: "mod-change" },
          h("div", { class: "mod-change__head" },
            h("span", { class: "mod-change__article", text: node?.numLabel || "" }),
            h("span", { class: "mod-change__action", text: "portera le n° " + num }),
            button("Annuler", { variant: "tertiary", size: "sm", icon: "x", onClick: () => { delete mod.renumerote[key]; paintAll(); } }))));
      }
      actionsBox.appendChild(ul);
    }
    if (mod.renumeroteTout) {
      actionsBox.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "6px 0 0" },
        text: "La renumérotation continue s'applique à tout le dispositif et l'emporte sur les numéros réattribués un par un." }));
    }
  }

  // ------------------------------------------------------- récapitulatif
  function paintSummary(b) {
    clear(summaryBox);
    summaryBox.appendChild(h("h2", { class: "fr-card__title", text: "Modifications relevées" }));
    if (!b.changes.length) {
      summaryBox.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucune modification pour l'instant. Réécrivez directement un article dans le document : tout ce qui change apparaîtra ici, sans rien perdre du reste." }));
      return;
    }
    summaryBox.appendChild(h("p", { class: "fr-small fr-muted", text: `${b.changes.length} modification(s) relevée(s). Vérifiez la nouvelle rédaction — la version consolidée les intègre toutes.` }));
    const list = h("ul", { class: "mod-changes" });
    for (const a of b.plan) {
      const row = planSummary([a], config)[0];
      const fresh = a.action === "append" || a.action === "insert-after" || a.action === "insert-before";
      list.appendChild(h("li", { class: "mod-change" },
        h("div", { class: "mod-change__head" },
          h("span", { class: "mod-change__article", text: fresh ? "Nouvel article" : (row.article || "—") }),
          h("span", { class: "mod-change__action", text: row.actionLabel }),
          button("Annuler", { variant: "tertiary", size: "sm", icon: "x", title: "Ne pas tenir compte de cette modification", onClick: () => revert(a) })),
        row.detail ? h("p", { class: "mod-change__detail", text: row.detail }) : null,
      ));
    }
    summaryBox.appendChild(list);
  }

  function revert(a) {
    if (a.insId) {
      mod.inserted = mod.inserted.filter((x) => x.id !== a.insId);
    } else if (a.targetEId) {
      revertArticleByEId(mod, mod.base.doc, a.targetEId);
    }
    paintAll();
  }

  // ---------------------------------------------------------- aperçus
  function paintPreview(b) {
    clear(previewCard);
    const tab = mod.ui.preview || "modificatif";
    previewCard.appendChild(h("div", { class: "fr-tabs" },
      ...[["modificatif", "Acte modificatif"], ["consolide", "Version consolidée"]].map(([id, label]) => h("button", {
        class: "fr-tab" + (tab === id ? " fr-tab--active" : ""),
        text: label,
        onClick: () => { mod.ui.preview = id; paintSide(); },
      }))));

    // La version consolidée peut être présentée avec ou sans le suivi des
    // modifications. Sans lui, elle est le texte en vigueur, chaque article
    // touché portant sous son intitulé la mention de l'acte modificatif.
    const tracking = mod.ui.showChanges === true;
    if (tab === "consolide") {
      previewCard.appendChild(h("div", { class: "mod-preview__opt" },
        checkbox("Afficher le suivi des modifications", tracking, (v) => { mod.ui.showChanges = v; paintSide(); }),
        h("p", { class: "fr-small fr-muted", style: { margin: "2px 0 0" },
          text: tracking
            ? "Ajouts et suppressions apparents, et tableau des modifications en fin de document."
            : "Texte en vigueur seulement : chaque article modifié porte la mention « Modifié par … du … » sous son intitulé." })));
    }

    const doc = tab === "consolide" ? b.consolide : b.modificatif;
    if (!doc) {
      previewCard.appendChild(h("p", { class: "fr-small fr-muted", text: "L'aperçu du document apparaîtra dès la première modification." }));
      return;
    }
    const box = h("div", { class: "paper-box mod-preview" });
    const p = h("div", { class: "paper" });
    p.style.fontFamily = config.brand.documentFont || "";
    applyPaper(p, doc, config);
    p.appendChild(renderDocument(doc, config, { showChanges: tab === "consolide" && tracking }));
    box.appendChild(p);
    previewCard.appendChild(box);
    previewCard.appendChild(h("div", { class: "fr-row", style: { marginTop: "8px" } },
      button("Agrandir", { variant: "secondary", size: "sm", icon: "eye", onClick: () => previewModal(doc, tab) }),
      button("Exporter…", { variant: "secondary", size: "sm", icon: "download", onClick: () => exportMenu(tab, b) }),
      button("Imprimer / PDF", { variant: "secondary", size: "sm", onClick: () => printDocument(doc, config, null) }),
      boutonPdfA(doc, config, { base: fileName(doc, tab), size: "sm" }),
      button("Word (.doc)", { variant: "secondary", size: "sm", onClick: () => download(fileName(doc, tab) + ".doc", exportWordDoc(doc, config, null), "application/msword") }),
    ));
    requestAnimationFrame(() => fitPaper(box, p));
  }

  // L'aperçu de la colonne est une vignette (l'A4 y tient réduit) : cette
  // fenêtre affiche le document à sa taille réelle, dans une modale large.
  function previewModal(doc, tab) {
    const box = h("div", { class: "paper-box mod-preview mod-preview--full" });
    const p = h("div", { class: "paper" });
    p.style.fontFamily = config.brand.documentFont || "";
    applyPaper(p, doc, config);
    p.appendChild(renderDocument(doc, config, { showChanges: tab === "consolide" && mod.ui.showChanges === true }));
    box.appendChild(p);
    modal({
      title: tab === "consolide" ? "Version consolidée" : "Acte modificatif",
      body: box,
      wide: true,
      actions: (close) => [
        button("Imprimer / PDF", { variant: "secondary", onClick: () => printDocument(doc, config, null) }),
        boutonPdfA(doc, config, { base: fileName(doc, tab) }),
        button("Fermer", { variant: "secondary", onClick: close }),
      ],
    });
  }

  // ------------------------------------------------------- suite du circuit
  function trailCard() {
    return h("div", { class: "fr-card fr-card--soft" },
      h("h2", { class: "fr-card__title", text: "Le circuit après la modification" }),
      h("p", { class: "fr-small", text: "1. Vous confirmez : l'acte modificatif et la version consolidée sont générés d'un seul geste." }),
      h("p", { class: "fr-small", text: "2. L'acte modificatif est envoyé en signature électronique, puis publié au recueil." }),
      h("p", { class: "fr-small", text: "3. À sa publication, la version consolidée est publiée sous le même identifiant ELI que l'acte d'origine : elle devient la version en vigueur et supplante l'acte d'origine." }),
      h("p", { class: "fr-small fr-muted", text: "4. L'acte d'origine n'est jamais effacé : il reste consultable, avec ses versions consolidées successives, dans l'historique des versions publiées sous son ELI." }),
    );
  }

  // ------------------------------------------------------------ export
  function fileName(doc, tab) {
    const num = (doc.meta?.numero || "acte").replace(/[^\w-]+/g, "_");
    return num + (tab === "consolide" ? "_consolidee" : "_modificatif");
  }

  function exportMenu(tab, b) {
    const doc = tab === "consolide" ? b.consolide : b.modificatif;
    if (!doc) return;
    const consolide = tab === "consolide";
    const name = fileName(doc, tab);
    const body = h("div", { class: "fr-stack" });
    const row = (label, fn, mime) => button(label, { variant: "secondary", onClick: () => download(name + suffixOf(label), fn(), mime) });
    const suffixOf = (label) => (label.includes("Ntoso") ? ".akn.xml" : label.includes("HTML") ? ".html" : label.includes("JSON-LD") ? ".jsonld" : label.includes("Markdown") ? ".md" : ".json");
    body.appendChild(h("div", { class: "fr-row" },
      row("Akoma Ntoso (.akn.xml)", () => exportAkn(doc, config), "application/xml"),
      row("HTML complet", () => exportStandaloneHtml(doc, config), "text/html"),
    ));
    body.appendChild(h("div", { class: "fr-row" },
      row("JSON-LD (ELI)", () => exportJsonLd(doc, config), "application/ld+json"),
      row("Markdown", () => exportMarkdown(doc, config), "text/markdown"),
      row("Document (JSON)", () => JSON.stringify({ kind: "document", doc }, null, 2), "application/json"),
    ));
    body.appendChild(h("div", { class: "fr-row" },
      button("Imprimer / PDF", { variant: "secondary", onClick: () => printDocument(doc, config, null) }),
      button("Word (.doc)", { variant: "secondary", onClick: () => download(name + ".doc", exportWordDoc(doc, config, null), "application/msword") }),
    ));
    body.appendChild(h("div", { class: "fr-row" }, ...boutonsPdfA(doc, config, { base: name })));
    body.appendChild(h("p", { class: "fr-small fr-muted", text: "Référence ELI : " + (doc.meta?.eli || "—") + (consolide ? " — même « work » que l'acte d'origine : la consolidation en est une nouvelle version." : "") }));
    if (consolide) body.appendChild(h("p", { class: "fr-small fr-muted", text: doc.meta?.consolidated?.showChanges === true ? "Suivi des modifications affiché : ajouts et suppressions apparents, tableau en fin de document." : "Suivi des modifications masqué : texte en vigueur, mention sous chaque article modifié. Se règle depuis l'onglet « Version consolidée » de l'écran de modification." }));
    modal({ title: consolide ? "Exporter la version consolidée" : "Exporter l'acte modificatif", body, actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })] });
  }

  // -------------------------------------------- confirmation & génération
  function openMetaModal() {
    const b = build();
    if (!b.changes.length) {
      toast("Aucune modification : réécrivez d'abord un article dans le document (réattribuer un numéro, à lui seul, ne produit pas d'acte modificatif).", "warning");
      return;
    }
    const body = h("div", { class: "fr-stack" });
    body.appendChild(h("div", { class: "fr-alert fr-alert--info" },
      h("p", { class: "fr-alert__title", text: `${b.changes.length} modification(s) seront apportées` }),
      h("p", { class: "fr-small", text: "Un acte modificatif sera créé, et l'acte d'origine sera consolidé pour tenir compte de ces modifications. L'acte d'origine n'est pas retouché." })));

    const meta = h("div", { class: "fr-stack" });
    const numeroInput = h("input", { class: "fr-input", value: mod.meta.numero, on: { input: (e) => { mod.meta.numero = e.target.value; } } });
    meta.appendChild(h("div", { class: "fr-field" },
      h("label", { class: "fr-label" }, "Numéro de l'acte modificatif", h("span", { class: "fr-required", text: " *" })),
      h("div", { class: "fr-row" }, h("div", { style: { flex: "1 1 auto" } }, numeroInput),
        button("Réserver", { variant: "tertiary", size: "sm", icon: "check", title: "Prendre le prochain numéro de la séquence", onClick: async (ev) => {
          const entity = config.entities.find((e) => e.id === mod.meta.entityId) || config.entities[0];
          const b = ev.currentTarget;
          b.disabled = true;
          b.appendChild(h("span", { class: "spinner", "aria-hidden": "true" }));
          try {
            const res = await reserverNumero(config, entity, {
              entityId: mod.meta.entityId,
              objet: mod.meta.objet || "",
              date: mod.meta.dateSignature || todayIso(),
              actTypeId: mod.meta.actTypeId || "",
              actes: state.actes,
            });
            mod.meta.numero = res.numero;
            mod.meta.numeroSource = res.source === "externe"
              ? { source: "externe", ref: res.ref || "", valeur: res.valeur || "", at: new Date().toISOString() }
              : null;
            if (res.source === "interne") {
              // La séquence est fixée au rang RÉSERVÉ : elle enjambe les numéros
              // déjà pris au lieu de les proposer une seconde fois.
              fixerSequence(config, res.seq, { entity, actTypeId: mod.meta.actTypeId || "" });
              touch("config", { rerender: false });
            }
            numeroInput.value = mod.meta.numero;
            toast("Numéro réservé : " + mod.meta.numero
              + (res.sautes ? ` (${res.sautes} rang(s) déjà pris, enjambé(s))` : ""), "success");
          } catch (e) {
            toast(String((e && e.message) || e), "error");
          }
          b.disabled = false;
          b.querySelector(".spinner")?.remove();
        } }))));

    meta.appendChild(h("div", { class: "fr-grid fr-grid--2" },
      textField({ label: "Nature de l'acte", value: mod.meta.designation, help: "« Décision », « Arrêté »…", onChange: (v) => { mod.meta.designation = v; } }),
      textField({ label: "Date de signature", type: "date", value: mod.meta.dateSignature, onChange: (v) => { mod.meta.dateSignature = v; } }),
    ));
    meta.appendChild(h("div", { class: "fr-grid fr-grid--2" },
      textField({ label: "Date d'effet", type: "date", value: mod.meta.dateEffet, help: "Laissez vide : « au lendemain de la publication ».", onChange: (v) => { mod.meta.dateEffet = v; } }),
      selectField({
        label: "Entité", value: mod.meta.entityId, placeholder: "— Entité —",
        options: (config.entities || []).map((e) => ({ value: e.id, label: e.name + (e.code ? " (" + e.code + ")" : "") })),
        onChange: (v) => { mod.meta.entityId = v; },
      }),
    ));
    // Le signataire de l'acte modificatif se choisit comme partout : par sa
    // FONCTION d'abord (voir src/ui/signer-picker.js), jamais dans un annuaire
    // de noms.
    const trameBase = state.trames.find((t) => t.id === mod.base?.trameId) || null;
    meta.appendChild(h("div", { class: "fr-field" },
      h("label", { class: "fr-label", text: "Signataire" }),
      signerPicker({
        config, showQualite: true,
        scope: {
          entityId: mod.meta.entityId || "", familyId: trameBase?.familyId || "",
          actTypeId: trameBase?.actTypeId || "", date: mod.meta.dateSignature || "",
        },
        personId: mod.meta.signataireId || "",
        fonctionKey: mod.meta.signataireFonction || "",
        onPerson: (v) => { mod.meta.signataireId = v; },
        onFonction: (cle) => { mod.meta.signataireFonction = cle; },
      })));
    meta.appendChild(textField({ label: "Objet", value: mod.meta.objet, rows: 2, onChange: (v) => { mod.meta.objet = v; } }));
    meta.appendChild(textField({
      label: "Considérants (un par ligne)", value: (mod.meta.considerants || []).join("\n"), rows: 3,
      onChange: (v) => { mod.meta.considerants = v.split("\n").map((s) => s.trim()).filter(Boolean); },
    }));
    meta.appendChild(textField({
      label: "Visas complémentaires (un par ligne)", value: (mod.meta.visas || []).join("\n"), rows: 2,
      help: "Le visa de l'acte modifié est ajouté automatiquement.",
      onChange: (v) => { mod.meta.visas = v.split("\n").map((s) => s.trim()).filter(Boolean); },
    }));
    meta.appendChild(h("div", { class: "fr-row" },
      checkbox("Article d'entrée en vigueur", mod.meta.addEntry !== false, (v) => { mod.meta.addEntry = v; }),
      checkbox("Article d'exécution", mod.meta.addExecution !== false, (v) => { mod.meta.addExecution = v; }),
    ));
    body.appendChild(meta);

    modal({
      title: "Confirmer la modification",
      wide: true,
      body,
      actions: (close) => [
        button("Annuler", { variant: "secondary", onClick: close }),
        button("Générer les deux actes", { variant: "primary", icon: "check", onClick: () => { close(); generate(); } }),
      ],
    });
  }

  async function generate() {
    const b = build();
    if (!b.changes.length) { toast("Aucune modification saisie : rien à générer.", "warning"); return; }
    if (!mod.meta.numero) { toast("Attribuez un numéro à l'acte modificatif.", "error"); return; }

    const now = new Date().toISOString();
    const baseId = base.acteId || null;
    const baseActe = baseId ? state.actes.find((x) => x.id === baseId) : null;
    const orgOf = { serviceId: baseActe?.serviceId || "", bureauId: baseActe?.bureauId || "" };
    const authorOf = { createdBy: state.user?.id || "", createdByName: state.user ? fullName(state.user) : "" };

    const modActe = {
      id: uid("acte"), kind: "modificatif",
      trameId: "", trameName: "Acte modificatif",
      numero: mod.meta.numero, objet: mod.meta.objet,
      entityId: mod.meta.entityId, dateSignature: mod.meta.dateSignature || "",
      ...orgOf, ...authorOf,
      statut: "pret", createdAt: now, updatedAt: now,
      values: null, doc: b.modificatif, eli: b.modificatif.meta.eli, issues: [],
      numeroSource: mod.meta.numeroSource || null,
      baseId, baseEli: base.doc.meta?.eli || "", baseNumero: base.doc.meta?.numero || "",
      amendsId: baseId, amendsEli: base.doc.meta?.eli || "", amendsNumero: base.doc.meta?.numero || "",
      amends: b.modificatif.amendments, source: "modification",
      // L'annexe dont cet acte adopte la nouvelle rédaction (mode « suivi »).
      adopteAnnexeId: b.suivi ? (baseId || "") : "",
    };
    const consActe = {
      id: uid("acte"), kind: "consolide",
      trameId: "", trameName: "Version consolidée",
      numero: base.doc.meta?.numero || "",
      objet: base.doc.meta?.objet || mod.meta.objet,
      entityId: base.doc.meta?.entity?.id || mod.meta.entityId,
      dateSignature: base.doc.meta?.dateSignature || "",
      ...orgOf, ...authorOf,
      statut: "en_attente", createdAt: now, updatedAt: now,
      values: null, doc: b.consolide, eli: b.consolide.meta.eli, issues: [],
      baseId, baseEli: base.doc.meta?.eli || "", modificatifId: modActe.id, modificationIds: [modActe.id],
      consolidatesId: baseId, consolidatesEli: base.doc.meta?.eli || "",
      trail: b.consolide.trail, source: "consolidation", pendingConsolidation: true,
      // La version consolidée d'une annexe EST l'annexe : sa nature la suit.
      nature: base.doc.meta?.nature === "annexe" ? "annexe" : "acte",
    };
    modActe.consolideId = consActe.id;
    state.actes.push(modActe, consActe);
    if (baseActe) {
      baseActe.modificationIds = [...new Set([...(baseActe.modificationIds || []), modActe.id])];
      baseActe.consolidationIds = [...new Set([...(baseActe.consolidationIds || []), consActe.id])];
      baseActe.lastConsolideId = consActe.id;
      // L'acte abrogé DANS SON ENSEMBLE : la mention est portée dès maintenant,
      // en attente — c'est la publication de la version consolidée qui la rend
      // effective (voir `publierConsolide`, views/signature.js).
      if (b.consolide?.meta?.consolidated?.abrogation) {
        baseActe.abrogePar = {
          acteId: modActe.id,
          numero: modActe.numero,
          designation: modActe.doc?.meta?.designation || "",
          date: modActe.dateSignature || "",
          eli: modActe.eli || "",
          enAttente: true,
        };
      }
      // Une ANNEXE qui vient d'être adoptée en nouvelle rédaction : sa fiche
      // dit désormais par quel acte, et ses visas le portent (le document
      // consolidé ci-dessus a reçu le visa ; on met la fiche à jour pour que la
      // prochaine compilation dise la même chose).
      if (b.suivi && mod.annexe) {
        const adoption = identification(modActe, mod.meta.designation);
        baseActe.values = { ...(baseActe.values || {}), __adoption: adoption };
        baseActe.adoptePar = adoption;
        baseActe.nature = "annexe";
      }
      baseActe.updatedAt = now;
    }
    touch("actes");
    state.modifier = null;
    toast("Acte modificatif et version consolidée enregistrés.", "success");
    proposeNext(modActe, consActe, base);
  }

  function proposeNext(modActe, consActe, base0) {
    modal({
      title: "Deux actes ont été produits",
      body: h("div", { class: "fr-stack" },
        resultLine("Acte modificatif", modActe, "Il porte la modification : il part en signature, puis est publié."),
        // Une annexe n'a pas de numéro : on dit par quelle décision elle tient
        // son texte (voir src/lib/annexes.js).
        resultLine("Version consolidée", consActe, base0.doc.meta?.nature === "annexe"
          ? `Texte de l'annexe à jour (adoptée par ${refDecision(base0.doc.meta?.adoption) || "la décision modificative"}). Elle devient la version en vigueur dès que l'acte modificatif est publié.`
          : `Texte de l'acte n° ${base0.doc.meta?.numero || "—"} à jour. Elle devient la version en vigueur dès que l'acte modificatif est publié.`),
        h("p", { class: "fr-small fr-muted", text: "L'acte d'origine n'est pas modifié : il reste consultable, et son historique de versions enregistre la consolidation." }),
      ),
      actions: (close) => [
        button("Plus tard", { variant: "tertiary", onClick: close }),
        button("Voir la version consolidée", { variant: "secondary", onClick: () => { close(); navigate("acte/" + consActe.id); } }),
        button("Envoyer l'acte modificatif en signature", {
          variant: "primary", icon: "lock",
          onClick: () => { close(); state.signature = { tab: "circuit", acteId: modActe.id }; navigate("signature"); },
        }),
      ],
    });
  }

  function resultLine(title, acte, note) {
    return h("div", { class: "fr-card fr-card--soft" },
      h("div", { class: "fr-row", style: { alignItems: "baseline" } },
        h("strong", { text: title }),
        h("span", { class: "fr-badge fr-badge--success", text: acte.numero || "" }),
        h("span", { class: "fr-small fr-muted", text: acte.objet || "" })),
      h("p", { class: "fr-small fr-muted", style: { margin: "4px 0 0" }, text: note || "" }),
    );
  }

  paintAll();
}

// ------------------------------------------------------------------ détails
// Lecture seule d'un document d'acte (acte importé, modificatif, consolidée).
export function renderActeDetail(root, params) {
  const config = state.config;
  const a = state.actes.find((x) => x.id === params.id);
  if (!a) {
    root.appendChild(emptyState("Acte introuvable.", button("Voir le registre", { variant: "primary", onClick: () => navigate("actes") })));
    return;
  }
  const doc = docOfActe(a);
  if (!doc) {
    root.appendChild(emptyState("Le document de cet acte est indisponible (trame d'origine absente).", button("Voir le registre", { variant: "primary", onClick: () => navigate("actes") })));
    return;
  }
  const n = natureOf(a);
  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      // Une ANNEXE n'a pas de numéro à montrer : son titre dit ce qu'elle est,
      // et sa ligne de contexte renvoie à la décision qui l'adopte (voir
      // src/lib/annexes.js).
      h("h1", { class: "page-head__title", text: natureOfActe(a, state.trames) === "annexe"
        ? (doc.meta?.designation || "Annexe")
        : `${doc.meta?.designation || "Acte"} n° ${a.numero || doc.meta?.numero || "—"}` }),
      h("p", { class: "page-head__sub", text: (natureOfActe(a, state.trames) === "annexe"
        ? [appellationAnnexe(a, state.config), a.objet || doc.meta?.objet]
        : [n.label, a.objet || doc.meta?.objet, doc.meta?.eli]).filter(Boolean).join(" · ") }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("modifier", "Aide"),
      button("Registre", { variant: "secondary", icon: "list", onClick: () => navigate("actes") }),
      can("actes.gerer") && canModify(a)
        ? ((actePubliable(a) || natureOfActe(a, state.trames) === "annexe")
          ? button(natureOfActe(a, state.trames) === "annexe" ? "Modifier l'annexe" : "Modifier cet acte",
            { variant: "secondary", icon: "refresh",
              title: natureOfActe(a, state.trames) === "annexe" ? "L'acte modificatif adoptera la nouvelle rédaction de l'annexe (suivi des modifications)" : "",
              onClick: () => modifierFromActe(a) })
          : button("Corriger cet acte", { variant: "secondary", icon: "note", title: "Acte individuel non publiable : correction directe, sans acte modificatif", onClick: () => openActe(a) }))
        : null,
      a.publication ? button("Version en ligne", { variant: "secondary", icon: "eye", onClick: () => navigate("publication/" + encodeURIComponent(a.publication.cle)) }) : null,
      button("Exporter…", { variant: "primary", icon: "download", onClick: () => exportDocMenu(doc, a) }),
    ),
  ));

  const trace = [
    a.createdByName ? `Rédigé par ${a.createdByName}` : "",
    a.createdAt ? `le ${formatDate(String(a.createdAt).slice(0, 10))}` : "",
    a.updatedAt && a.updatedAt !== a.createdAt ? `· dernière modification le ${formatDate(String(a.updatedAt).slice(0, 10))}` : "",
  ].filter(Boolean).join(" ");
  if (trace) root.appendChild(h("p", { class: "fr-small fr-muted", style: { marginTop: "-6px" }, text: trace }));

  // L'abrogation subie : c'est un fait du dossier, et il change la lecture de
  // tout ce qui suit — l'acte n'est plus en vigueur. On le dit en tête de fiche.
  if (abrogationPhrase(a)) {
    root.appendChild(h("div", { class: "fr-alert fr-alert--" + (estAbroge(a) ? "warning" : "info"), style: { marginBottom: "12px" } },
      h("p", { class: "fr-alert__title", text: estAbroge(a) ? "Acte abrogé" : "Abrogation prévue" }),
      h("p", { class: "fr-small", text: abrogationPhrase(a) }),
    ));
  }

  // D'où vient le numéro : un numéro attribué par un service externe est
  // rattaché à la ligne créée chez ce service (voir src/lib/numbering.js).
  if (a.numeroSource) {
    root.appendChild(h("p", { class: "fr-small fr-muted", style: { marginTop: "-6px" },
      text: `Numéro attribué par le service de numérotation${a.numeroSource.ref ? ` — référence ${a.numeroSource.ref}` : ""}${a.numeroSource.at ? `, le ${formatDate(String(a.numeroSource.at).slice(0, 10))}` : ""}.` }));
  }

  // Les annexes : le lien entre un acte et les documents qu'il adopte. C'est un
  // fait du dossier, comme l'abrogation — il se lit en tête de fiche, parce
  // qu'il dit d'où le document tire son existence. Voir src/lib/annexes.js.
  const annexes = annexesCard(a, doc);
  if (annexes) root.appendChild(annexes);

  const history = historyCard(a, doc);
  if (history) root.appendChild(history);

  // Le parapheur : où en est l'acte dans son circuit de validation, et ce que
  // le lecteur peut y faire. C'est la même mécanique que l'écran « Parapheur »,
  // ramenée sur la fiche de l'acte concerné. La carte n'apparaît que si un
  // circuit s'applique vraiment à l'acte.
  if (parapheurActif()) root.appendChild(parapheurCard(a));

  // La révision : le contrôle avant la signature (voir src/lib/revision.js).
  // Elle est INDÉPENDANTE du parapheur : un acte peut être révisé sans circuit,
  // et un circuit peut être achevé sans réviseur compétent. La carte apparaît
  // dès qu'un réviseur est compétent pour l'acte, ou que l'acte porte déjà son
  // dossier de révision.
  const revue = revisionCard(a);
  if (revue) root.appendChild(revue);

  // signature et publication
  // Le circuit EXTERNE (papier ou outil tiers, voir src/lib/externe.js) ne
  // produit pas d'`a.original` : sa pièce signée est le PDF déposé. On présente
  // donc les deux cas de la même façon — ce qui compte, c'est qu'un document
  // signé existe et ce qu'il est advenu de sa conformité.
  const externe = estCircuitExterne(a);
  const vs = externe ? versionSigneeDeActe(a) : null;
  const certif = externe ? certificationDeActeExterne(a) : null;
  const signee = !!(a.original || vs);
  if (a.original || vs || a.externe || a.publication || a.statut === "signee" || a.statut === "publie" || a.statut === "en_signature" || a.statut === "en_attente") {
    const p = a.publication || null;
    root.appendChild(h("div", { class: "fr-card fr-card--soft" },
      h("h2", { class: "fr-card__title", text: "Signature et publication" }),
      a.original
        ? h("p", { class: "fr-small" },
          h("strong", { text: "Acte signé. " }),
          `Signé le ${formatDate(String(a.original.signatures?.[0]?.signeLe || "").slice(0, 10))} par ${a.original.signatures?.[0]?.signataire?.nom || "—"} · empreinte SHA-256 ${String(a.original.document?.sha256 || "").slice(0, 24)}…`)
        : vs
        ? h("p", { class: "fr-small" },
          h("strong", { text: "Version signée déposée. " }),
          `Déposée le ${formatDate(String(vs.deposeLe || "").slice(0, 10))} par ${vs.deposeParNom || "—"} · empreinte SHA-256 ${String(vs.sha256 || "").slice(0, 24)}… `,
          certif && certif.statut === "conforme"
            ? `Conformité certifiée par ${certif.parNom || "—"} le ${formatDate(String(certif.le || "").slice(0, 10))}.`
            : certif && certif.statut === "non_conforme"
            ? `Conformité refusée par ${certif.parNom || "—"}${certif.motif ? " : « " + certif.motif + " »" : "."}`
            : "Conformité avec la version numérique en attente de certification par le réviseur.")
        : h("p", { class: "fr-small", text: a.externe && a.externe.statut === "a_signer" ? "Document remis au signataire : la version signée n'a pas encore été déposée." : a.statut === "en_signature" ? "Circuit de signature ouvert, en attente de signature." : a.statut === "en_attente" ? "En attente : la version consolidée sera publiée en même temps que l'acte modificatif." : "Acte non signé." }),
      p ? h("div", {},
        h("p", { class: "fr-small" }, h("strong", { text: "Publié. " }), `ELI ${p.eliUri}`),
        h("p", { class: "fr-small fr-muted", text: [`Publié le ${formatDate(p.datePublication)}`, p.juridique === false ? "document non opposable" : `entrée en vigueur le ${formatDate(p.dateOpposabilite)}`, p.recueil || ""].filter(Boolean).join(" · ") }),
      ) : null,
      // Un acte retiré du recueil garde la trace du retrait et de son motif :
      // c'est un geste exceptionnel, il ne doit pas s'oublier.
      a.retraits?.length ? h("div", { class: "fr-alert fr-alert--warning", style: { marginTop: "8px" } },
        h("p", { class: "fr-alert__title", text: "Retiré du recueil" }),
        ...a.retraits.slice(-3).map((r) => h("p", { class: "fr-small", text: `Le ${formatDate(String(r.le || "").slice(0, 10))}${r.auteur ? " par " + r.auteur : ""} — motif technique : ${r.motif}` })),
        h("p", { class: "fr-small fr-muted", text: "Un acte publié ne se retire pas : le retrait est exceptionnel et ne se justifie que par un motif technique. Il est conservé ici et au journal d'audit." })) : null,
      !actePubliable(a) ? h("div", { class: "fr-alert fr-alert--info", style: { marginTop: "8px" } },
        h("p", { class: "fr-alert__title", text: "Acte non publiable" }),
        h("p", { class: "fr-small", text: "Acte individuel : sa trame est déclarée non publiable. Signé et conservé au registre, il n'est pas déposé au recueil et ne reçoit pas d'identifiant ELI. Sa correction se fait directement, sans acte modificatif." })) : null,
      h("div", { class: "fr-row" },
        a.original ? button("Voir l'original signé", { variant: "secondary", size: "sm", icon: "lock", onClick: () => import("./signature.js").then((m) => m.voirOriginal(a)) }) : null,
        !a.original && vs ? button("Voir la version signée", { variant: "secondary", size: "sm", icon: "lock", onClick: () => import("./signature.js").then((m) => m.voirVersionSignee(a)) }) : null,
        p ? button("Consulter la version en ligne", { variant: "primary", size: "sm", icon: "eye", onClick: () => navigate("publication/" + encodeURIComponent(p.cle)) }) : null,
        (signee ? (actePubliable(a) ? can("signature.gerer") : can("actes.signer")) : can("actes.signer")) && a.statut !== "publie" && a.kind !== "consolide"
          ? button(
            actePubliable(a) ? (signee ? "Publication" : "Signer") : (signee ? "Suivi du circuit" : "Signer"),
            { variant: "tertiary", size: "sm", icon: "upload", onClick: () => { state.signature = { tab: actePubliable(a) && signee ? "publication" : "circuit", acteId: a.id }; navigate("signature"); } })
          : null,
      ),
    ));
  }

  // Le caractère exécutoire : un acte signé n'est pas encore opposable. Il le
  // devient quand la dernière formalité requise est accomplie, et c'est de là
  // que court le délai de recours. Une ANNEXE n'a rien de tout cela : elle ne
  // se signe ni ne se publie, et n'a donc pas de formalités propres — c'est
  // l'acte qui l'adopte qui les accomplit, et c'est de sa signature que le
  // délai de recours court.
  if (natureOfActe(a, state.trames) === "annexe") {
    root.appendChild(h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: "Caractère exécutoire" }),
      h("p", { class: "fr-small fr-muted", text: "Une annexe ne se signe ni ne se publie pour elle-même : elle n'a pas de délai qui coure de son fait. Son texte suit l'acte qui l'adopte, et c'est cet acte — sa signature, sa transmission, sa publication — qui la rend applicable. Le délai de recours contentieux court donc de la publicité de l'acte d'adoption." })));
  } else {
    root.appendChild(executionCard(a));
  }

  const ec = ecartsOfActe(a);
  if (ec.count) {
    root.appendChild(h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: `Écarts à la trame (${ec.count})` }),
      h("p", { class: "fr-small fr-muted", text: "Le rédacteur a adapté ces passages par rapport au modèle. L'acte reste valable : c'est un signalement, pas une erreur. Profitez-en pour faire évoluer la trame si l'adaptation est récurrente ou légitime." }),
      ...ec.list.map((e) => {
        const loc = locateAddr(doc, e.addr);
        return h("div", { class: "rx-ecart" },
          h("div", { class: "rx-ecart__head" }, h("span", { class: "rx-ecart__where", text: [loc.area, loc.label].filter(Boolean).join(" · ") })),
          h("p", { class: "rx-ecart__line" },
            h("span", { class: "rx-ecart__k", text: "trame" }),
            h("span", { class: "rx-ecart__was", text: interpolate(e.original, doc.ctx || {}) || "—" })),
          h("p", { class: "rx-ecart__line" },
            h("span", { class: "rx-ecart__k", text: "acte" }),
            h("span", { class: "rx-ecart__now", text: interpolate(e.current, doc.ctx || {}) || "(texte supprimé)" })));
      }),
    ));
  }

  // Version consolidée : le suivi des modifications est une option d'affichage
  // (décochée par défaut). Le choix est enregistré sur le document : les
  // exports, la signature et la version publiée le reprennent.
  if (doc.kind === "consolide") {
    doc.meta.consolidated = doc.meta.consolidated || {};
    const suivi = doc.meta.consolidated.showChanges === true;
    // Ce qui a été publié est figé : si la version en ligne a été déposée avec
    // l'autre présentation, on le dit, plutôt que de laisser croire qu'elle suit.
    const publieAvecSuivi = /class="doc-ins"|class="doc-trail"/.test(a.publication?.html || "");
    root.appendChild(h("div", { class: "doc-optbar" },
      checkbox("Afficher le suivi des modifications", suivi, (v) => {
        doc.meta.consolidated.showChanges = v;
        a.updatedAt = new Date().toISOString();
        touch("actes");
      }),
      h("p", { class: "fr-small fr-muted", style: { margin: "2px 0 0" },
        text: suivi
          ? "Ajouts et suppressions apparents, et tableau des modifications en fin de document."
          : "Texte en vigueur, avec la mention de l'acte modificatif sous chaque article touché." }),
      a.publication && publieAvecSuivi !== suivi
        ? h("p", { class: "fr-small fr-muted", style: { margin: "2px 0 0" }, text: "La version en ligne déjà publiée garde la présentation retenue au moment de sa publication ; ce choix vaut pour l'affichage et les exports de la fiche." })
        : null));
  }

  // L'historique des brouillons : les états successifs de l'acte avant sa
  // signature, et le retour à l'un d'eux.
  const rv = revisionsCard(a);
  if (rv) root.appendChild(rv);

  const box = h("div", { class: "paper-box" });
  const paper = h("div", { class: "paper" });
  paper.style.fontFamily = config.brand.documentFont || "";
  applyPaper(paper, doc, config);
  paper.appendChild(renderDocument(doc, config, {}));
  box.appendChild(paper);
  root.appendChild(box);
  requestAnimationFrame(() => fitPaper(box, paper));
}

// ------------------------------------------------------------- parapheur
// Où en est l'acte dans son circuit de validation. La carte dit trois choses :
// le circuit applicable, la trace des étapes (qui a décidé quoi, quand, et
// avec quelle observation), et ce que le lecteur peut faire maintenant — y
// compris constater que la validation est devenue caduque parce que le texte a
// été réécrit depuis.
function parapheurCard(a) {
  const circuit = circuitDe(a);
  const v = a.validation;
  const box = h("div", { class: "fr-card" });
  const caduque = v ? !validationAJour(a) : false;
  const etat = v ? (VALIDATION_STATUTS[v.statut] || {}) : {};

  box.appendChild(h("div", { class: "fr-row" },
    h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: "Parapheur" }),
    v
      ? h("span", { class: "fr-badge fr-badge--" + (caduque ? "warning" : (etat.color || "info")), text: caduque ? "validation caduque" : (etat.label || "") })
      : h("span", { class: "fr-badge", text: "hors circuit" }),
  ));

  if (!v) {
    box.appendChild(h("p", { class: "fr-small fr-muted", text: circuit
      ? `Le circuit « ${circuit.label} » s'applique à cet acte : ${circuit.steps.length} étape(s). Il n'a pas encore été soumis.`
      : "Aucun circuit du référentiel ne s'applique à cet acte : il part en signature sans validation préalable." }));
    if (circuit && can("actes.rediger")) {
      box.appendChild(h("div", { class: "fr-row" },
        button("Soumettre au circuit", { variant: "primary", size: "sm", icon: "upload", onClick: () => soumettreCircuit(a, circuit) })));
    }
    return box;
  }

  const av = avancement(v);
  box.appendChild(h("p", { class: "fr-small fr-muted", text: [
    v.circuitLabel || "Circuit de validation",
    `ouvert le ${formatDate(String(v.demarreLe || "").slice(0, 10))}`,
    v.demarreParNom ? "par " + v.demarreParNom : "",
    `${av.faites}/${av.total} étape(s)`,
  ].filter(Boolean).join(" · ") }));

  if (caduque) {
    box.appendChild(h("div", { class: "fr-alert fr-alert--warning", style: { margin: "8px 0" } },
      h("p", { class: "fr-alert__title", text: "Validation caduque" }),
      h("p", { class: "fr-small", text: "Le texte de l'acte a été modifié après le passage au parapheur : ce qui a été validé n'est plus ce que porte l'acte. Le circuit doit être repris avant la signature." })));
  }

  box.appendChild(h("div", { class: "sig-steps" }, ...(v.steps || []).map((s, i) => etapeTraceEl(s, i, v))));

  const mienne = etapeAParachever(a);
  if (mienne && !caduque && can("actes.valider")) {
    box.appendChild(carteDecision(a, mienne, { heading: "h3" }));
  } else if (v.statut === "en_cours" && !caduque) {
    const suivante = etapeActive(v);
    box.appendChild(h("p", { class: "fr-small fr-muted", text: suivante
      ? `L'étape ouverte est « ${suivante.label} » : elle n'est pas de votre ressort.`
      : "Toutes les étapes sont franchies." }));
  }

  const reparables = ["valide", "refuse", "renvoye"].includes(v.statut) || caduque;
  if (can("actes.valider") && circuit && reparables) {
    box.appendChild(h("div", { class: "fr-row", style: { marginTop: "8px" } },
      button("Reprendre le circuit", { variant: "tertiary", size: "sm", icon: "refresh", onClick: () => reprendreCircuit(a, circuit) }),
      v.statut === "valide" && can("actes.signer")
        ? button("Aller à la signature", { variant: "primary", size: "sm", icon: "lock", onClick: () => { state.signature = { tab: "circuit", acteId: a.id }; navigate("signature"); } })
        : null,
      (v.statut === "refuse" || v.statut === "renvoye") && can("actes.rediger")
        ? button("Corriger l'acte", { variant: "primary", size: "sm", icon: "note", onClick: () => openActe(a) })
        : null));
  }
  return box;
}

// ------------------------------------------------------------- révision
// Le contrôle avant signature. La carte dit trois choses : où en est l'acte
// devant le réviseur, ce que le rapport de conformité relève, et ce que le
// lecteur peut faire — y compris lire le motif d'un rejet. Les briques
// d'affichage sont partagées avec l'écran « Révision »
// (src/ui/revision-cartes.js) : c'est le même dossier, lu par les mêmes gens.
function revisionCard(a) {
  const rev = revisionPour(a);
  const r = a.revision;
  if (!rev.requise && !r) return null;
  const etat = etatRevision(a) || {};
  const doc = docOfActe(a);
  const rapport = doc ? rapportConformite(doc, { config: state.config, trame: trameById(a.trameId), acte: a, publiable: actePubliable(a) }) : null;
  const box = h("div", { class: "fr-stack" });

  box.appendChild(h("div", { class: "fr-card" },
    h("div", { class: "fr-row" },
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: "Révision" }),
      h("span", { class: "fr-badge fr-badge--" + (etat.caduque ? "warning" : etat.color || "info"), text: etat.caduque ? "révision caduque" : etat.label || "hors révision" }),
      h("div", { class: "fr-spacer" }),
      can("actes.reviser")
        ? button("Ouvrir la révision", { variant: "tertiary", size: "sm", icon: "eye", onClick: () => { state.revision = { tab: r?.statut === "en_attente" ? "aReviser" : "rejets", acteId: a.id }; navigate("revision"); } })
        : null,
    ),
    h("p", { class: "fr-small fr-muted", text: rev.requise
      ? "Un réviseur est compétent pour cet acte : il le contrôle avant sa signature — le texte révisé est celui qui part en signature."
      : "Aucun réviseur n'est compétent pour cet acte : il part en signature sans contrôle préalable." }),
    !r && rev.requise ? h("p", { class: "fr-small", text: "Soumettez-le à la révision depuis « Signature & publication » : l'envoi en signature le transmet d'abord au réviseur." }) : null,
  ));

  if (r) box.appendChild(carteDossierRevision(a, etat));
  if (r?.statut === "en_attente" && peutTrancher(a) && can("actes.reviser")) box.appendChild(carteDecisionRevision(a, rapport, { heading: "h3" }));
  if (rapport) box.appendChild(carteRapport(rapport));
  return box;
}

// Une étape du circuit, telle qu'elle a été franchie (ou non) : c'est la trace
// des décisions, pas la file d'attente — d'où l'usage des mêmes classes que
// l'écran du parapheur.
function etapeTraceEl(s, i, v) {
  const info = ETAPE_STATUTS[s.statut] || ETAPE_STATUTS.en_attente;
  const ouverte = s.statut === "en_attente" && etapeActive(v)?.id === s.id;
  return h("div", { class: "sig-step" + (s.statut === "valide" || s.statut === "passe" ? " is-done" : "") + (ouverte ? " is-open" : "") },
    h("span", { class: "sig-step__dot", text: s.statut === "en_attente" ? String(i + 1) : (s.statut === "refuse" ? "✗" : s.statut === "renvoye" ? "↩" : "✓") }),
    h("div", { class: "sig-step__body" },
      h("p", { class: "sig-step__title" },
        s.label,
        h("span", { class: "fr-badge fr-badge--" + info.color, style: { marginLeft: "6px" }, text: info.label }),
        h("span", { class: "fr-badge", style: { marginLeft: "4px" }, text: etiquetteEtape(s.kind).label }),
        s.optional ? h("span", { class: "fr-badge", style: { marginLeft: "4px" }, text: "facultative" }) : null,
      ),
      h("p", { class: "sig-step__line", text: s.at ? `${s.byName || "—"} · le ${formatDate(String(s.at).slice(0, 10))}` : (ouverte ? "Étape ouverte" : "En attente") }),
      s.comment ? h("p", { class: "sig-step__line parapheur-comment", text: "« " + s.comment + " »" }) : null,
    ),
  );
}

// ------------------------------------------------- caractère exécutoire
// Les formalités qui rendent l'acte opposable, et le délai de recours qui en
// découle. La fiche dit l'essentiel et renvoie à l'échéancier pour agir — sauf
// pour les formalités que l'on peut constater d'ici.
function executionCard(a) {
  const opts = { publiable: actePubliable(a), trame: trameById(a.trameId) };
  const st = statutExecution(a, state.config, opts);
  const exe = dateExecutoire(a, opts);
  const limite = dateLimiteRecours(a, state.config, opts);
  const jours = limite ? ecartJours(aujourdhui(), limite) : null;
  const form = formalites(a, opts);
  const rec = recoursDe(a);
  const box = h("div", { class: "fr-card" });

  box.appendChild(h("div", { class: "fr-row" },
    h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: "Caractère exécutoire" }),
    h("span", { class: "fr-badge fr-badge--" + st.color, text: st.label }),
  ));

  box.appendChild(st.code === "document"
    // Un verbatim, une déclaration, un vœu : publié au recueil, mais il ne fait
    // pas droit. On le dit ici plutôt que d'afficher une opposabilité qui
    // n'existe pas (voir src/lib/execution.js, STATUTS_EXECUTION).
    ? h("p", { class: "fr-small fr-muted", text: "Document non juridique : publié au recueil pour être lu, il ne fait pas droit — ni caractère exécutoire, ni délai de recours. Seule la publication le concerne." })
    : exe
      ? h("p", { class: "fr-small" },
        h("strong", { text: "Exécutoire le " + formatDate(exe) + ". " }),
        rec
          ? `${recoursTypeLabel(rec.type) || "Recours"} introduit le ${formatDate(rec.introduitLe)} : le délai de recours est clos, l'acte est contesté.`
          : limite ? `Délai de recours contentieux jusqu'au ${formatDate(limite)} (${jours >= 0 ? jours + " jour(s) restant(s)" : "échu depuis " + Math.abs(jours) + " jour(s)"}).` : "")
      : h("p", { class: "fr-small fr-muted", text: st.code === "brouillon"
        ? "L'acte n'est pas signé : le caractère exécutoire se constate après la signature."
        : "L'acte n'est pas encore exécutoire : " + (st.manquantes || []).map((m) => m.court).join(" et ") + " manque(nt)." }));

  // Le recours du dossier : sa date d'introduction ferme le délai, et c'est elle
  // qui interdit d'attester qu'il n'y a pas eu de recours. On le note depuis
  // l'échéancier ; ici, la fiche le rappelle.
  if (rec) {
    const lignes = [
      rec.demandeur ? "Auteur : " + rec.demandeur : "",
      rec.ref ? "Réf. " + rec.ref : "",
      rec.byName ? "noté par " + rec.byName : "",
    ].filter(Boolean).join(" · ");
    if (lignes) box.appendChild(h("p", { class: "fr-small fr-muted", text: lignes }));
    if (rec.note) box.appendChild(h("p", { class: "fr-small", text: "« " + rec.note + " »" }));
  }

  box.appendChild(h("div", { class: "exec-formalites", style: { marginTop: "8px" } }, ...form.map((f) => h("div", { class: "exec-formalite" + (f.fait ? " is-done" : "") },
    h("div", { class: "exec-formalite__head" },
      h("strong", { text: f.label }),
      h("span", { class: "fr-badge fr-badge--" + (f.fait ? "success" : f.requis ? "warning" : "info"), text: f.fait ? "Accomplie" : f.requis ? "À accomplir" : "Non requise" })),
    h("p", { class: "fr-small" + (f.fait ? "" : " fr-muted"), text: f.fait
      ? ["le " + formatDate(f.at), f.ref ? "réf. " + f.ref : "", f.parEli ? "constatée par la chaîne ELI" : "", f.byName ? "par " + f.byName : ""].filter(Boolean).join(" · ")
      : (f.id === "signature" ? "L'acte n'est pas signé." : f.requis ? "Aucune constatation enregistrée." : "Formalité non requise : elle peut tout de même être constatée au dossier.") }),
    // Certificat de transmission au contrôle de légalité, s'il y en a un : il a
    // été déposé sur le document par l'API d'envoi (voir src/lib/legalite.js).
    f.certificat ? h("p", { class: "fr-small exec-certificat" },
      h("strong", { text: "Certificat de transmission" }),
      h("span", { text: f.certificat.mention || "" }),
      h("span", { class: "fr-muted", text: [
        f.certificat.reference ? " · réf. " + f.certificat.reference : "",
        f.certificat.sceau ? " · sceau " + String(f.certificat.sceau).slice(0, 16) + "…" : "",
      ].filter(Boolean).join("") })) : null,
    f.id !== "signature" && !(f.id === "publication" && f.parEli) && (can("signature.gerer") || can("actes.gerer"))
      ? h("div", { class: "fr-row" },
        button(f.fait ? "Corriger" : "Enregistrer", {
          variant: f.fait ? "tertiary" : "secondary", size: "sm", icon: f.fait ? "refresh" : "check",
          onClick: () => ouvrirFormulaireFormalite(a, f),
        }))
      : null,
  ))));

  box.appendChild(h("div", { class: "fr-row", style: { marginTop: "8px" } },
    button("Ouvrir l'échéancier", { variant: "secondary", size: "sm", icon: "gear", onClick: () => { state.execution = { tab: "tous", acteId: a.id }; navigate("execution"); } })));
  return box;
}

// -------------------------------------------------- historique des brouillons
// Les états successifs de l'acte, conservés à chaque enregistrement. Revenir à
// l'un d'eux n'efface rien : l'état courant est archivé au passage, et le
// circuit de validation, s'il existait, devra être repris.
function revisionsCard(a) {
  const revs = revisionsDe(a);
  if (!revs.length) return null;
  const box = h("div", { class: "fr-card fr-card--soft" },
    h("h2", { class: "fr-card__title", text: `Historique des brouillons (${revs.length})` }),
    h("p", { class: "fr-small fr-muted", text: "Chaque enregistrement conserve l'état précédent. Revenir à une version archive d'abord l'état courant : rien ne se perd. Les vingt dernières versions sont conservées." }));

  for (const r of revs) {
    box.appendChild(h("div", { class: "sig-pub__line" },
      h("div", {},
        h("strong", { text: r.label + " — " + (r.numero || "sans n°") }),
        h("p", { class: "fr-small fr-muted", text: [
          r.at ? "le " + new Date(r.at).toLocaleString("fr-FR") : "",
          r.byName ? "par " + r.byName : "",
          r.objet || "",
        ].filter(Boolean).join(" · ") })),
      can("actes.rediger")
        ? button("Restaurer cette version", {
          variant: "tertiary", size: "sm", icon: "refresh",
          onClick: async () => {
            const ok = await confirmDialog("Restaurer cette version", "L'état actuel de l'acte sera archivé dans l'historique, puis remplacé par cette version. Si un circuit de validation est ouvert, il devra être repris.", { confirmLabel: "Restaurer" });
            if (!ok) return;
            const rev = restaurerRevision(a, r.id, { by: state.user?.id || "", byName: fullName(state.user) });
            if (!rev) { toast("Cette version n'est plus disponible.", "warning"); return; }
            await journaliser({
              action: "acte.restauration", cible: "acte", cibleLabel: a.numero || a.id, acteId: a.id,
              detail: `retour à la version « ${r.label} » du ${new Date(r.at).toLocaleString("fr-FR")}${a.validation ? " — le circuit de validation doit être repris" : ""}`,
              to: [a.createdBy || "", "role:editeur"],
            });
            touch("actes", { rerender: false });
            toast("Version restaurée", "success");
            redrawView();
          },
        })
        : null,
    ));
  }
  return box;
}

// -------------------------------------------------- historique des versions
// Chaîne des modifications subies par un acte : les actes modificatifs publiés
// et leurs consolidations successives. C'est la mémoire de l'acte : chaque
// modification y laisse une trace, et l'acte d'origine reste toujours lisible.
// --------------------------------------------------- annexes et acte d'adoption
// Un acte peut être une ANNEXE (un règlement intérieur adopté par une
// délibération, un tableau adopté par une décision), ou porter des annexes. Le
// lien est un fait du dossier : d'où le document tire son existence, et ce qu'il
// annexe. Il se lit donc en tête de la fiche. Voir src/lib/annexes.js.
function annexesCard(a, doc) {
  const cfg = state.config;
  const commeAnnexe = natureOfActe(a, state.trames) === "annexe";
  const adoption = a.adoptePar || doc.meta?.adoption || null;
  const docs = ((Array.isArray(a.annexes) && a.annexes.length ? a.annexes : (doc.meta?.annexes || [])) || []).filter(Boolean);
  if (!commeAnnexe && !docs.length) return null;

  // Le renvoi vers un acte du registre : sa fiche est la source vivante. Une
  // identification figée peut ne correspondre à aucun acte (import, purge) —
  // on l'imprime alors telle quelle, sans lien.
  const renvoi = (id, texte) => {
    const x = id ? state.actes.find((y) => y.id === id) : null;
    if (!x) return h("span", { text: texte });
    return h("a", {
      class: "rx-annexe__lien", href: "#/acte/" + x.id, title: x.objet || "",
      onClick: (e) => { e.preventDefault(); navigate("acte/" + x.id); },
      text: texte,
    });
  };

  const card = h("div", { class: "fr-card fr-card--soft rx-annexe" });
  if (commeAnnexe) {
    card.appendChild(h("h2", { class: "fr-card__title", text: "Annexe" }));
    card.appendChild(h("p", { class: "fr-small", text: "Ce document est adopté par un autre acte : il ne tient pas son autorité de lui-même. Une annexe ne se signe pas — c'est l'acte qui l'adopte qui est signé, et l'original de cet acte est suivi du texte de l'annexe, dans le même document. Elle n'est donc ni signée ni publiée pour elle-même." }));
    if (adoption) {
      card.appendChild(h("p", { class: "fr-small" },
        h("span", { class: "fr-muted", text: "Acte d'adoption : " }),
        renvoi(adoption.acteId, `${adoption.designation || "Acte"} n° ${adoption.numero || "—"}${adoption.date ? " du " + formatDate(adoption.date) : ""}${adoption.objet ? " — " + adoption.objet : ""}`)));
    } else {
      card.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun acte d'adoption n'est encore désigné : tant qu'il l'est, rien ne donne à ce document son autorité ni sa place dans le recueil." }));
    }
    card.appendChild(h("p", { class: "fr-small fr-muted", text: "Sa modification suit le régime des annexes : l'acte modificatif en adopte la nouvelle rédaction, présentée en suivi des modifications, et cette rédaction suit l'acte modificatif signé. Une modification classique reste possible par mention expresse, article par article." }));
  }
  if (docs.length) {
    card.appendChild(h("h2", { class: "fr-card__title", text: `Documents annexés (${docs.length})` }));
    card.appendChild(h("p", { class: "fr-small fr-muted", text: "Adoptés par le présent acte : ils sont annoncés à la fin de son dispositif, et leur texte suit l'acte dans l'original signé. Ils ne sont ni signés ni publiés pour eux-mêmes." }));
    for (const d of docs) {
      card.appendChild(h("p", { class: "fr-small" }, renvoi(d.acteId, libelleAnnexe(d, cfg))));
    }
  }
  return card;
}

function historyCard(a, doc) {
  const base = (a.kind === "original" || a.kind === "importe" || !a.baseId)
    ? a
    : state.actes.find((x) => x.id === a.baseId) || null;
  const liens = state.actes.filter((x) => x.baseId && base && x.baseId === base.id);
  const mods = liens.filter((x) => x.kind === "modificatif");
  const cons = liens.filter((x) => x.kind === "consolide");
  const chain = [
    a.amendsNumero || a.amendsEli ? ["Modifie", `${a.amendsNumero || ""} ${a.amendsEli ? "(" + a.amendsEli + ")" : ""}`] : null,
    a.consolidatesEli ? ["Consolide", a.consolidatesEli] : null,
    doc.trail?.length ? ["Modifications intégrées", doc.trail.map((t) => `${t.designation || "acte"} n°${t.numero} du ${formatDate(t.date)}`).join(" ; ")] : null,
  ].filter(Boolean);

  if (!chain.length && !liens.length) return null;

  const card = h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Historique des modifications" }),
  );

  const enVigueur = cons.filter((x) => x.statut === "publie").sort((x, y) => String(y.updatedAt || "").localeCompare(String(x.updatedAt || "")))[0] || null;
  if (enVigueur && enVigueur.id !== a.id) {
    card.appendChild(h("div", { class: "fr-alert fr-alert--info" },
      h("p", { class: "fr-alert__title", text: "Cet acte a été supplanté par sa version consolidée" }),
      h("p", { class: "fr-small", text: `La version consolidée du ${formatDate(enVigueur.datePublication || enVigueur.updatedAt?.slice(0, 10))} tient lieu de version en vigueur. L'acte d'origine reste consultable ci-dessous, dans sa rédaction signée.` }),
      h("div", { class: "fr-row" },
        button("Ouvrir la version en vigueur", { variant: "primary", size: "sm", icon: "eye", onClick: () => navigate("acte/" + enVigueur.id) }),
        enVigueur.publication ? button("Version en ligne", { variant: "secondary", size: "sm", icon: "eye", onClick: () => navigate("publication/" + encodeURIComponent(enVigueur.publication.cle)) }) : null)));
  } else if (enVigueur && enVigueur.id === a.id) {
    card.appendChild(h("p", { class: "fr-small", text: "Cette version consolidée est la version en vigueur de l'acte. L'acte d'origine et les consolidations antérieures restent consultables ci-dessous." }));
  }

  if (liens.length) {
    const t = h("table", { class: "fr-table fr-table--small" },
      h("thead", {}, h("tr", {},
        h("th", { text: "Acte" }), h("th", { text: "Date" }), h("th", { text: "Nature" }),
        h("th", { text: "Statut" }), h("th", { text: "Version publiée" }), h("th", {}))));
    const tb = h("tbody");
    const rows = [{ acte: base || a, label: "Texte d'origine", isBase: true }]
      .concat(mods.map((m) => ({ acte: m, label: "Modification" })))
      .concat(cons.map((c) => ({ acte: c, label: "Consolidation" })))
      .sort((x, y) => String(x.acte.createdAt || "").localeCompare(String(y.acte.createdAt || "")));
    for (const r of rows) {
      const x = r.acte;
      const nat = natureOf(x);
      const pub = x.publication;
      // Une consolidation est datée du jour de la consolidation : sa date de
      // signature est celle de l'acte d'origine, qu'elle reprend.
      const quand = x.kind === "consolide"
        ? (x.datePublication || x.doc?.meta?.consolidated?.at?.slice(0, 10) || x.updatedAt?.slice(0, 10))
        : (x.dateSignature || x.updatedAt?.slice(0, 10));
      tb.appendChild(h("tr", { class: r.acte.id === a.id ? "mod-hist--current" : "" },
        h("td", {},
          h("strong", { text: x.numero || "—" }),
          h("div", { class: "fr-small fr-muted", text: r.isBase ? r.label : (x.objet || "") })),
        h("td", { class: "fr-small", text: formatDate(quand) }),
        h("td", {}, h("span", { class: "fr-badge fr-badge--" + nat.color, text: nat.label })),
        h("td", {}, h("span", { class: "fr-badge fr-badge--" + (x.statut === "publie" ? "success" : x.statut === "en_attente" ? "info" : "warning"), text: statusText(x) })),
        h("td", { class: "fr-mono fr-small", text: pub?.eliUri || (x.kind === "consolide" ? "en attente" : "—") }),
        h("td", {}, h("div", { class: "fr-row" },
          x.id !== a.id ? button("Ouvrir", { variant: "tertiary", size: "sm", onClick: () => navigate("acte/" + x.id) }) : h("span", { class: "fr-badge fr-badge--success", text: "affiché" }),
          pub ? button("En ligne", { variant: "tertiary", size: "sm", icon: "eye", onClick: () => navigate("publication/" + encodeURIComponent(pub.cle)) }) : null)),
      ));
    }
    t.appendChild(tb);
    card.appendChild(h("div", { class: "fr-table-wrap" }, t));
  } else if (chain.length) {
    for (const [k, v] of chain) card.appendChild(h("p", { class: "fr-small" }, h("strong", { text: k + " : " }), v));
  }

  card.appendChild(h("p", { class: "fr-small fr-muted", text: "Chaque modification publiée laisse une trace : l'acte modificatif qui l'a portée, et la version consolidée correspondante. Rien n'est effacé — c'est l'historique des modifications dans le temps." }));
  return card;
}

function exportDocMenu(doc, acte) {
  const name = (acte.numero || "acte").replace(/[^\w-]+/g, "_");
  const body = h("div", { class: "fr-stack" },
    h("div", { class: "fr-row" },
      button("Akoma Ntoso (.akn.xml)", { variant: "secondary", onClick: () => download(name + ".akn.xml", exportAkn(doc, state.config), "application/xml") }),
      button("HTML complet", { variant: "secondary", onClick: () => download(name + ".html", exportStandaloneHtml(doc, state.config), "text/html") }),
    ),
    h("div", { class: "fr-row" },
      button("JSON-LD (ELI)", { variant: "secondary", onClick: () => download(name + ".jsonld", exportJsonLd(doc, state.config), "application/ld+json") }),
      button("Markdown", { variant: "secondary", onClick: () => download(name + ".md", exportMarkdown(doc, state.config), "text/markdown") }),
      button("Document (JSON)", { variant: "secondary", onClick: () => download(name + ".document.json", JSON.stringify({ kind: "document", doc }, null, 2)) }),
    ),
    h("div", { class: "fr-row" },
      button("Imprimer / PDF", { variant: "secondary", onClick: () => printDocument(doc, state.config, null) }),
      button("Word (.doc)", { variant: "secondary", onClick: () => download(name + ".doc", exportWordDoc(doc, state.config, null), "application/msword") }),
    ),
    h("div", { class: "fr-row" }, ...boutonsPdfA(doc, state.config, { base: name })),
    h("p", { class: "fr-small fr-muted", text: "Référence ELI : " + (doc.meta?.eli || "—") }),
  );
  modal({ title: "Exporter — " + (acte.numero || "acte"), body, actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })] });
}

// ------------------------------------------------------------------ outils
function checkbox(label, checked, onChange) {
  const c = h("input", { type: "checkbox", checked: !!checked });
  c.addEventListener("change", () => onChange(c.checked));
  return h("label", { class: "fr-check" }, c, label);
}
