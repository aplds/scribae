// ============================================================================
// L'ÉCRAN DES REPRISES D'ACTES ANCIENS.
//
// Une collectivité qui installe Scribae a derrière elle des décennies d'actes
// signés sur papier, publiés à l'affichage ou dans un bulletin qu'on ne trouve
// plus. Cet écran les fait entrer au recueil : le rédacteur écrit leur texte,
// règle à la main leur DATE DE PUBLICATION D'ORIGINE (nécessairement antérieure
// au jour), joint l'ORIGINAL SIGNÉ (le scan), et publie d'un seul geste.
//
// Rien de tout cela ne passe par le circuit de signature : un acte ancien a
// déjà été signé. La reprise ne signe pas, elle CONSERVE la preuve de ce qui a
// été signé — et elle le dit au lecteur, en bas de la page publiée (la mention
// est composée par `buildWebVersion` à partir de `MENTION_REPRISE`, et reprise
// telle quelle par le recueil).
//
// Une reprise peut être un ACTE, ou un TEXTE AUTONOME — un règlement intérieur,
// une charte, un texte ancien qu'on veut pouvoir consulter pour lui-même. Dans
// le second cas elle reçoit le code ELI du règlement (`eli:/fr/reg/…`).
//
// Les reprises vivent dans leur PROPRE collection (`state.reprises`), et non
// dans le registre des actes : elles ne suivent ni le parapheur, ni la
// signature, ni la numérotation courante, et elles ne doivent donc pas se mêler
// aux listes d'actes, au chrono ni à la recherche. Le module PUR qui porte les
// règles est `src/lib/reprise.js` ; ici, on saisit, on prévisualise, on dépose
// et on publie.
// ============================================================================
import {
  state, touch, navigate, redrawView, can, journaliser, entityById,
} from "../state.js";
import { inScope } from "../../lib/scope.js";
import { h, clear, button, toast, fitPaper } from "../dom.js";
import { textField, selectField, choiceField, emptyState, helpLink, confirmDialog, acteStatutBadge } from "../components.js";
import { uid, formatDate } from "../../lib/util.js";
import {
  KIND_REPRISE, GENRES, genreDe, validerReprise, dateMaxReprise,
  docReprise, numeroPourEli, actTypeEli, MENTION_REPRISE,
} from "../../lib/reprise.js";
import { publicationSettings, eliUri as eliUriOf, eliAdresse, buildWebVersion, publicationJsonLd, normalizeUrl } from "../../lib/eli.js";
import { exportAkn, exportMarkdown } from "../../lib/export.js";
import { renderDocument, applyPaper, documentToText } from "../../lib/render.js";
import { styleForDoc } from "../../lib/styles.js";
import { recueilsExternes, mentionsPubliques, licenceReutilisation } from "../../lib/recueil.js";
import { post, errorMessage, beginFlow } from "../../lib/remote.js";
import { fullName } from "../../lib/users.js";

// Une reprise neuve : tout est vide, et le genre par défaut est « acte ». Le
// numéro, la date et l'original restent à la charge du rédacteur — c'est le
// principe même d'une reprise (voir `validerReprise`).
function repriseVide() {
  const maintenant = new Date().toISOString();
  const entite = (state.config?.entities || [])[0] || null;
  return {
    id: uid("reprise"),
    kind: KIND_REPRISE,
    trameId: "", trameName: "Reprise d'acte ancien",
    numero: "", objet: "", titre: "", texte: "", provenance: "",
    annexe: false,
    actTypeId: (state.config?.actTypes || [])[0]?.id || "decision",
    familyId: "",
    entityId: entite?.id || "",
    datePublication: "",
    original: null,
    statut: "brouillon",
    createdAt: maintenant, updatedAt: maintenant,
    createdBy: state.user?.id || "",
    createdByName: state.user ? fullName(state.user) : "",
    doc: null,
  };
}

// Les reprises VISIBLES : un rédacteur ne voit que les siennes, l'administration
// les voit toutes — la même règle que les actes du registre, sans les portes de
// la révision et de la signature (une reprise ne passe par aucun circuit).
export const reprisesVisibles = () => (state.reprises || [])
  .filter((r) => {
    if (!r) return false;
    if (!can("actes.tous") && r.createdBy && r.createdBy !== state.user?.id) return false;
    return inScope(state.config, state.user, r);
  })
  .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

export function renderReprises(root) {
  const ui = (state.ui = state.ui || {});
  const liste = reprisesVisibles();
  if (ui.repriseId && !liste.some((r) => r.id === ui.repriseId)) ui.repriseId = null;

  if (ui.repriseId) {
    root.appendChild(editeur(liste.find((r) => r.id === ui.repriseId)));
    return;
  }
  root.appendChild(pageHead(liste));
  root.appendChild(explication());
  if (!liste.length) {
    root.appendChild(h("div", { class: "fr-card" },
      emptyState("Aucune reprise pour l'instant. « Reprendre un acte ancien » fait entrer au recueil un acte antérieur à sa mise en service, publié à titre informatif.",
        can("actes.reprendre") ? button("Reprendre un acte ancien", { variant: "primary", icon: "plus", onClick: () => ouvrir(null) }) : null)));
    return;
  }
  root.appendChild(historique(liste));
}

function pageHead(liste) {
  const publiees = liste.filter((r) => r.statut === "publie").length;
  return h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Reprises d'actes anciens" }),
      h("p", { class: "page-head__sub", text: "Les actes antérieurs à la mise en service du recueil : le rédacteur en écrit le texte, règle la date de publication d'origine et joint l'original signé. La reprise est publiée immédiatement, à titre informatif." })),
    h("div", { class: "page-head__actions" },
      helpLink("reprises", "Comment faire ?"),
      h("span", { class: "fr-small fr-muted", text: `${publiees} publiée${publiees > 1 ? "s" : ""}${liste.length - publiees ? `, ${liste.length - publiees} en préparation` : ""}` }),
      can("actes.reprendre") ? button("Reprendre un acte ancien", { variant: "primary", icon: "plus", onClick: () => ouvrir(null) }) : null));
}

function explication() {
  return h("div", { class: "fr-card fr-card--soft reprises__explication" },
    h("h2", { class: "fr-card__title", text: "Ce qu'est une reprise" }),
    h("p", { class: "fr-small", text: "Une reprise fait entrer au recueil un acte qui lui est antérieur. Elle se publie d'un seul geste : il n'y a ni parapheur, ni signature, ni révision — l'acte a déjà été signé, et c'est son original que l'on conserve." }),
    h("ul", { class: "fr-small" },
      h("li", { text: "La date de publication se règle à la main, et reste nécessairement antérieure à aujourd'hui." }),
      h("li", { text: "L'original signé (PDF, ou image scannée) est joint à la main : c'est lui qui fait foi." }),
      h("li", { text: "Le recueil indique, au bas de la page, que l'acte est publié à titre informatif uniquement." }),
      h("li", { text: "Un texte autonome — un règlement intérieur, une charte — se reprend aussi, et se consulte alors pour lui-même." })));
}

// ---------------------------------------------------------------- l'historique

function historique(liste) {
  const t = h("table", { class: "fr-table reprises__table" },
    h("thead", {}, h("tr", {},
      h("th", { text: "Numéro" }), h("th", { text: "Intitulé" }), h("th", { text: "Genre" }),
      h("th", { text: "Publié le" }), h("th", { text: "État" }), h("th", {}))));
  const tb = h("tbody");
  for (const r of liste) {
    tb.appendChild(h("tr", {},
      h("td", { class: "fr-mono", text: r.numero || "—" }),
      h("td", { text: r.titre || r.objet || "—" }),
      h("td", { class: "fr-small", text: genreDe(r).label }),
      h("td", { class: "fr-small", text: r.datePublication ? formatDate(r.datePublication) : "—" }),
      h("td", {}, acteStatutBadge(r.statut)),
      h("td", {}, h("div", { class: "fr-row" },
        can("actes.reprendre") ? button(r.statut === "publie" ? "Ouvrir" : "Continuer", { variant: "secondary", size: "sm", icon: "note", onClick: () => ouvrir(r) }) : null,
        r.statut === "publie" && r.publication?.cle ? button("Voir au recueil", { variant: "tertiary", size: "sm", icon: "globe", onClick: () => navigate("recueil/" + encodeURIComponent(r.publication.cle)) }) : null))));
  }
  t.appendChild(tb);
  return h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Reprises enregistrées" }),
    h("div", { class: "fr-table-wrap" }, t));
}

function ouvrir(r) {
  if (!r) {
    const n = repriseVide();
    state.reprises.push(n);
    touch("reprises", { rerender: false });
    r = n;
  }
  state.ui.repriseId = r.id;
  redrawView();
}

// ------------------------------------------------------------------ l'atelier

function editeur(r) {
  const config = state.config;
  const publie = r.statut === "publie";
  const grid = h("div", { class: "reprises__grille" });
  const form = h("div", { class: "fr-stack reprises__form" });
  const apercu = h("div", { class: "fr-stack reprises__apercu" });
  grid.appendChild(form);
  grid.appendChild(apercu);

  // Toute saisie est enregistrée au fil de l'eau : la reprise est un brouillon,
  // et le rédacteur ne perd rien en changeant d'écran.
  const maj = (champ, valeur) => {
    r[champ] = valeur;
    r.updatedAt = new Date().toISOString();
    touch("reprises", { rerender: false });
    peindreApercu();
  };

  const entete = h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: publie ? "Reprise publiée" : "Reprendre un acte ancien" }),
      h("p", { class: "page-head__sub", text: "Le texte se compose librement. Les lignes « Article 1er », « # TITRE I » et « - » donnent sa structure au document." })),
    h("div", { class: "page-head__actions" },
      button("Retour aux reprises", { variant: "tertiary", icon: "doc", onClick: () => { state.ui.repriseId = null; redrawView(); } }),
      !publie ? button("Publier au recueil", { variant: "primary", icon: "globe", onClick: () => publier(r) }) : null,
      !publie ? button("Supprimer le brouillon", { variant: "tertiary", icon: "trash", size: "sm", onClick: () => supprimerReprise(r) }) : null,
      publie && r.eli ? button("Voir au recueil", { variant: "secondary", icon: "globe", onClick: () => navigate("recueil/" + encodeURIComponent(r.publication?.cle || "")) }) : null));

  // ------------------------------------------------------------- les champs
  form.appendChild(h("div", { class: "fr-card fr-stack" },
    h("h2", { class: "fr-card__title", text: "L'acte repris" }),
    textField({ label: "Intitulé de l'acte", value: r.titre, required: true, help: "Tel qu'il se lit en tête du document.", onChange: (v) => maj("titre", v) }),
    choiceField({
      label: "Genre", value: r.annexe ? "annexe" : "acte",
      options: [{ value: "acte", label: GENRES.acte.label }, { value: "annexe", label: GENRES.annexe.label }],
      help: GENRES.annexe.aide,
      onChange: (v) => { maj("annexe", v === "annexe"); redrawView(); },
    }),
    !r.annexe ? selectField({
      label: "Nature de l'acte", value: r.actTypeId, required: true,
      options: (config.actTypes || []).map((t) => ({ value: t.id, label: t.label })),
      onChange: (v) => { maj("actTypeId", v); redrawView(); },
    }) : null,
    textField({ label: "Numéro d'origine", value: r.numero, required: true, help: "Le numéro que l'acte portait (« 1998-042 »). Son année date l'identifiant ELI.", placeholder: "1998-042", onChange: (v) => maj("numero", v) }),
    champDate({ label: "Date de publication d'origine", value: r.datePublication, required: true, max: dateMaxReprise(),
      help: "Nécessairement antérieure à aujourd'hui : le recueil ne date pas un acte ancien du jour de sa reprise.",
      onChange: (v) => maj("datePublication", v) }),
    entiteSelect(r, maj),
    selectField({
      label: "Thème (facultatif)", value: r.familyId, placeholder: "— Aucun thème —",
      options: (config.families || []).map((f) => ({ value: f.id, label: f.label })),
      help: "Le thème sous lequel le recueil public classe l'acte.",
      onChange: (v) => maj("familyId", v),
    }),
    textField({ label: "Provenance (facultatif)", value: r.provenance, help: "D'où vient l'original : « Registre des délibérations, 1998 », « Bulletin municipal n° 42 »…", onChange: (v) => maj("provenance", v) })));

  form.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Texte de l'acte" }),
    h("p", { class: "fr-small fr-muted", text: "Une ligne blanche sépare les paragraphes. Une ligne « Article 3 » (ou « Article 3 — Objet ») ouvre un article ; « # », « ## », « ### » ouvrent un titre, un chapitre, une section ; « - » fait une liste. Le reste est un paragraphe." }),
    textField({ label: "Texte", value: r.texte, rows: 22, required: true, placeholder: "Article 1er — Objet\nLa présente délibération…", onChange: (v) => maj("texte", v) })));

  form.appendChild(carteOriginal(r, peindreApercu));

  // ------------------------------------------------------------- l'aperçu
  const paperBox = h("div", { class: "paper-box reprises__paper" });
  const paper = h("div", { class: "paper paper--lecture" });
  paperBox.appendChild(paper);
  apercu.appendChild(h("div", { class: "fr-card fr-card--soft" },
    h("h2", { class: "fr-card__title", text: "Aperçu du document publié" }),
    h("p", { class: "fr-small fr-muted", text: "La version en ligne, telle que le recueil la montre." })));
  apercu.appendChild(paperBox);
  const mentionBox = h("p", { class: "reprises__mention fr-small" });
  apercu.appendChild(h("div", { class: "fr-card reprises__mention-card" },
    h("h2", { class: "fr-card__title", text: "Mention portée au bas de la page" }),
    mentionBox));

  function peindreApercu() {
    clear(paper);
    const doc = docReprise(r, { config, entity: entityById(r.entityId) || (config.entities || [])[0] || null, eliHttp: "" });
    const style = applyPaper(paper, doc, config, { style: styleForDoc(config, doc) });
    paper.appendChild(renderDocument(doc, config, { showNotes: false, showTrail: false, annexes: false, style }));
    requestAnimationFrame(() => fitPaper(paperBox, paper));
    const valide = validerReprise(r, { maintenant: new Date() });
    clear(mentionBox);
    mentionBox.appendChild(h("span", { class: "reprises__mention-texte", text: MENTION_REPRISE }));
    if (valide.length) {
      mentionBox.appendChild(h("span", { class: "reprises__blocage", text: "Pour publier : " + valide.map((e) => e.message).join(" ") }));
    } else {
      mentionBox.appendChild(h("span", { class: "reprises__pret", text: "Prête à publier." }));
    }
  }

  const ctn = h("div", { class: "reprises" }, entete, grid);
  requestAnimationFrame(peindreApercu);
  return ctn;
}

function entiteSelect(r, maj) {
  const entites = state.config?.entities || [];
  if (entites.length <= 1) return null;
  return selectField({
    label: "Entité", value: r.entityId, required: true,
    options: entites.map((e) => ({ value: e.id, label: e.name + (e.code ? " (" + e.code + ")" : "") })),
    onChange: (v) => maj("entityId", v),
  });
}

// Un champ de date : le champ simple de `components.js` n'expose pas de borne,
// et la borne est ici la règle elle-même (la date doit être antérieure au jour).
function champDate({ label, value, onChange, max, required, help }) {
  const input = h("input", { class: "fr-input", type: "date", value: value || "", max: max || "", on: { input: (e) => onChange(e.target.value) } });
  const wrap = h("div", {}, input);
  return h("div", { class: "fr-field" },
    h("label", { class: "fr-label", text: label + (required ? " *" : "") }), wrap,
    help ? h("p", { class: "fr-hint-text", text: help + (max ? ` (au plus tard le ${formatDate(max)}).` : "") }) : null);
}

// ------------------------------------------------------------------ l'original

// L'original signé est joint À LA MAIN : on le dépose (upload-plugin) et l'on
// garde son adresse, son empreinte et sa taille sur la reprise. C'est cette
// pièce que le recueil montrera comme l'original — la reprise, elle, ne signe
// rien.
function carteOriginal(r, paint) {
  const card = h("div", { class: "fr-card fr-stack" });
  const info = h("div", { class: "reprises__original" });
  const input = h("input", { class: "fr-input", type: "file", accept: "application/pdf,.pdf,image/png,image/jpeg,image/webp,image/tiff" });

  const peindre = () => {
    clear(info);
    const o = r.original;
    if (!o) {
      info.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun original joint. L'original signé est exigé pour publier." }));
      return;
    }
    info.appendChild(h("div", { class: "fr-stack" },
      h("p", { class: "fr-small", text: `Fichier : ${o.nom || "original"} (${tailleLisible(o.taille)})` }),
      o.sha256 ? h("p", { class: "fr-small fr-muted fr-mono reprises__empreinte", text: "SHA-256 " + o.sha256 }) : null,
      h("div", { class: "fr-row" },
        h("a", { class: "fr-btn fr-btn--secondary fr-btn--sm", href: o.url, target: "_blank", rel: "noopener" }, "Ouvrir"),
        button("Retirer", { variant: "tertiary", size: "sm", icon: "trash", onClick: () => { r.original = null; touch("reprises", { rerender: false }); peindre(); if (paint) paint(); } }))));
  };

  input.addEventListener("change", async () => {
    const fichier = input.files?.[0];
    if (!fichier) return;
    const attendu = /pdf|image\/(png|jpeg|webp|tiff)/i.test(fichier.type) || /\.(pdf|png|jpe?g|webp|tiff?)$/i.test(fichier.name);
    if (!attendu) { toast("Fichier attendu : PDF, ou image scannée (PNG, JPEG, WebP, TIFF).", "error"); input.value = ""; return; }
    input.disabled = true;
    clear(info);
    info.appendChild(h("p", { class: "fr-small fr-muted", text: "Dépôt de l'original en cours…" }));
    try {
      const sha256 = await sha256Fichier(fichier);
      const up = await root.uploadPlugin(fichier);
      if (!up || up.error || !up.url) { throw new Error(up && up.error ? String(up.error) : "dépôt refusé par le service de fichiers"); }
      r.original = { url: up.url, sha256, nom: fichier.name, taille: fichier.size, type: fichier.type || "", deposeLe: new Date().toISOString(), deposePar: state.user?.id || "", deposeParNom: state.user ? fullName(state.user) : "" };
      r.updatedAt = new Date().toISOString();
      touch("reprises", { rerender: false });
      toast("Original joint.", "success");
      peindre();
      if (paint) paint();
    } catch (e) {
      clear(info);
      info.appendChild(h("p", { class: "fr-small fr-error-text", text: "Le dépôt de l'original a échoué : " + String((e && e.message) || e) }));
    } finally {
      input.disabled = false;
      input.value = "";
    }
  });

  card.appendChild(h("h2", { class: "fr-card__title", text: "Original signé" }));
  card.appendChild(h("p", { class: "fr-small fr-muted", text: "Le document signé tel qu'il a été conservé : un PDF, ou le scan de la pièce papier. C'est lui qui fait foi ; la version en ligne n'en est qu'une lecture." }));
  card.appendChild(input);
  card.appendChild(info);
  peindre();
  return card;
}

const tailleLisible = (n) => {
  const b = Number(n) || 0;
  if (b < 1024) return b + " o";
  if (b < 1024 * 1024) return Math.round(b / 1024) + " Ko";
  return (b / 1024 / 1024).toFixed(1) + " Mo";
};

async function sha256Fichier(fichier) {
  const buf = await fichier.arrayBuffer();
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- la publication

// La publication d'une reprise : un dépôt, puis une publication — sans circuit
// de signature, et d'un seul geste. Elle se publie À TITRE INFORMATIF
// (`informative: true`) : pas d'opposabilité, pas d'entrée en vigueur, et le
// drapeau `reprise` dit de quelle information il s'agit. La mention qui
// l'explique est portée par la version en ligne elle-même.
async function publier(r) {
  const config = state.config;
  const erreurs = validerReprise(r, { maintenant: new Date() });
  if (erreurs.length) {
    toast(erreurs[0].message, "error");
    return;
  }
  if (!can("actes.reprendre")) { toast("La reprise d'actes anciens est réservée aux rédacteurs.", "error"); return; }
  const settings = publicationSettings(config);
  const token = settings.jetonDemonstration;
  const flow = beginFlow(`Reprise — ${r.numero || r.titre || "acte ancien"}`);
  const entity = entityById(r.entityId) || (config.entities || [])[0] || null;
  const numeroEli = numeroPourEli(r);
  const eliUri = eliUriOf({ config, actTypeId: actTypeEli(r), numero: numeroEli, entityCode: entity?.code });
  const url = normalizeUrl(eliAdresse({ config, eliUri }) || "");
  const doc = docReprise(r, { config, entity, eliHttp: url });
  const theme = themeDeReprise(r, config);
  const auteur = state.user ? fullName(state.user) : "";
  const datePublication = r.datePublication;
  const akn = exportAkn(doc, config);
  const originalExterne = r.original ? { ...r.original } : null;

  const record = {
    eliUri, url, numero: r.numero, nature: doc.meta.actTypeId,
    actTypeId: doc.meta.actTypeId, entityId: entity?.id || "", entityName: entity?.name || "",
    ...theme,
    title: r.titre || r.objet || "",
    objet: r.objet || r.titre || "",
    dateDocument: datePublication, datePublication,
    dateOpposabilite: "", opposabiliteRule: "", recueil: settings.recueil,
    kind: KIND_REPRISE, reprise: true, informative: true,
    auteur, provenance: r.provenance || "",
    originalExterne, signature: null,
  };
  const html = buildWebVersion({ doc, config, record });
  const jsonld = publicationJsonLd({ ...record, brandName: config.brand.name, licence: licenceReutilisation(config) });
  const md = exportMarkdown(doc, config, { notes: false });
  const texte = documentToText(doc, config);

  const payload = {
    eliUri, url, work: url, numero: r.numero, nature: doc.meta.actTypeId, objet: record.objet,
    entityCode: entity?.code || "", brandName: config.brand.name,
    dateDocument: datePublication, datePublication, dateOpposabilite: "", opposabiliteRule: "",
    recueil: settings.recueil, auteur, provenance: r.provenance || "", kind: KIND_REPRISE,
    // Publication informative, et reprise : le service ne réclame ni signature
    // ni paquet signé, et il garde la pièce jointe comme original.
    informative: true, reprise: true,
    originalExterne,
    html, akn, jsonld, md, texte,
    ...diffusionRecueil(config),
    ...theme,
  };

  try {
    // 1. Le dépôt. Un acte déposé « reprise » autorise le service à le publier
    //    sans signature (voir `hPublier`) ; il n'entre dans aucun circuit.
    const dep = await post("/v1/actes", {
      akn, numero: r.numero, objet: record.objet, nature: doc.meta.actTypeId,
      entityId: entity?.id || "", entityName: entity?.name || "",
      dateSignature: datePublication, trameId: "",
      reprise: true, publishable: true,
      ...theme,
    }, { token, flow, label: "Dépôt de la reprise" });
    if (!dep.ok) { toast("Dépôt au service : " + errorMessage(dep), "error"); return; }
    const acteId = dep.body.id;

    // 2. La publication, dans la foulée — c'est le geste du bouton.
    const res = await post(`/v1/actes/${acteId}/publication`, payload, {
      token, flow, label: "Publication de la reprise",
      idempotencyKey: `${eliUri}@${datePublication}-reprise`,
    });
    if (!res.ok) { toast("Publication : " + errorMessage(res), "error"); return; }

    Object.assign(r, {
      statut: "publie", eli: eliUri, designation: doc.meta.designation,
      actTypeId: doc.meta.actTypeId, objet: record.objet,
      doc, publication: { ...res.body, html, akn, jsonld, md, texte, originalExterne },
      api: { acteId, sha256: dep.body.sha256, statut: "reprise" },
      updatedAt: new Date().toISOString(),
    });
    touch("reprises", { rerender: false });
    // Le recueil public a lu sa liste : on l'invalide pour que la reprise y
    // apparaisse sans recharger la page.
    state.pubRegistre = { chargement: false };
    if (state.recueil) { state.recueil.liste = null; state.recueil.actes = {}; }
    await journaliser({
      action: "publication.reprise", cible: "acte", cibleLabel: `${r.numero} — ${r.titre || r.objet}`,
      acteId: r.id,
      detail: `reprise d'un acte ancien publiée sous l'ELI ${eliUri} (publication informative, du ${formatDate(datePublication)})`,
      to: ["role:editeur"],
    });
    toast(`Reprise publiée — ELI ${eliUri}`, "success");
    redrawView();
  } catch (e) {
    toast(String((e && e.message) || e), "error");
  }
}

// Les réglages de diffusion du recueil public voyagent avec la publication : le
// service auto-hébergé ne connaît pas le référentiel (voir la publication
// ordinaire, `src/ui/views/signature.js`).
const diffusionRecueil = (config) => ({
  recueilsExternes: recueilsExternes(config),
  mentions: mentionsPubliques(config),
  chatsErreur: config?.publication?.chatsErreur === true,
});

function themeDeReprise(r, config) {
  if (!r.familyId) return { themeId: "", themeLabel: "" };
  const f = (config.families || []).find((x) => x.id === r.familyId);
  return { themeId: r.familyId, themeLabel: (f && f.label) || "" };
}

// La suppression d'un brouillon de reprise (une reprise publiée, elle, se retire
// du recueil par le geste prévu : la dépublication, réservée à l'administration).
export async function supprimerReprise(r) {
  const ok = await confirmDialog("Supprimer cette reprise", `La reprise « ${r.titre || r.numero || "sans titre"} » sera effacée du registre. Elle n'a pas été publiée.`, { confirmLabel: "Supprimer", danger: true });
  if (!ok) return;
  const i = (state.reprises || []).findIndex((x) => x.id === r.id);
  if (i >= 0) state.reprises.splice(i, 1);
  state.ui.repriseId = null;
  touch("reprises");
  await journaliser({ action: "reprise.supprimee", cible: "acte", cibleLabel: r.numero || r.titre || "reprise", detail: "brouillon de reprise supprimé", to: [] });
  redrawView();
}
