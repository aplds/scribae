// ============================================================================
// Rédiger un acte.
//
// Le document est le formulaire : le rédacteur écrit directement dans la page,
// comme dans un traitement de texte. Les pastilles bleues sont les champs
// prévus par la trame (on clique dessus pour les renseigner). Le texte prérempli
// par les administrateurs peut être réécrit librement : sa réécriture est
// conservée, signalée « hors trame » et visible des administrateurs, sans jamais
// bloquer l'export.
//
// Le panneau de droite sert de filet de sécurité : il liste ce qu'il reste à
// compléter (y compris les champs qui ne figurent pas dans le texte) et les
// écarts à la trame.
// ============================================================================
import {
  state, touch, navigate, redrawView, can, visibleTrames, visibleActes,
  journaliser, circuitDe, signalerRedaction, libererRedaction, quiRedige, parapheurActif,
  revisionPour,
} from "../state.js";
import { fullName } from "../../lib/users.js";
import { ajouterRevision } from "../../lib/revisions.js";
import { demarrerValidation, etapeActive, validationAJour, VALIDATION_STATUTS } from "../../lib/validation.js";
import { etatRevision } from "../../lib/revision.js";
import { h, clear, button, icon, toast, modal, fitPaper } from "../dom.js";
import { compile, interpolate } from "../../lib/compile.js";
import { applyPaper, personSignatureName } from "../../lib/render.js";
import { lignesQualites, decisionsDeSignature } from "../../lib/delegations.js";
import { exportAkn, exportSchematron, exportJsonLd, exportMarkdown, exportStandaloneHtml, exportWordDoc, printDocument } from "../../lib/export.js";
import { download, uid, debounce, formatDate, todayIso } from "../../lib/util.js";
import { helpLink, emptyState, sectionHeader, statusBadge, acteStatutLabel, acteStatutColor, isDraftable, confirmDialog, selectField, textField, abrogationBadge } from "../components.js";
import { targetLabel } from "../../lib/scope.js";
import { tramePublishable } from "../../lib/schema.js";
import { estExterne, reserverNumero } from "../../lib/numbering.js";
import { safeEval } from "../../lib/expr.js";
import { listSlots, locateAddr, fieldIdsInText } from "../../lib/redaction.js";
import { abrogationVocab, clauseAbrogation, cibleTexte, KINDS, designationDe as designationDeActe } from "../../lib/abrogations.js";
import { entreeEnVigueur } from "../../lib/execution.js";
import { buildRedactionDoc, controlFor, focusFieldWidget, hiddenPassages, bindConfig, closeTokenEditor } from "./wysiwyg.js";
import { signerPicker } from "../signer-picker.js";
import { champFonction, roleDeFonction } from "../../lib/fonctions.js";

export function openActe(acte) {
  state.ui = state.ui || {};
  state.ui.openActeId = acte.id;
  navigate("rediger/" + acte.trameId);
}

// Repartir d'une page blanche (appelé par les entrées « Rédiger » du menu).
// Seul le brouillon est oublié : les autres réglages d'interface (filtres des
// listes, recherche de trame…) sont conservés. L'intention d'abrogation, elle,
// survit : elle désigne ce que l'acte à rédiger devra abroger (voir
// `redigerAbrogation`), et se consomme à l'ouverture du brouillon.
export function resetDraft() {
  state.rediger = null;
  state.ui = { ...(state.ui || {}), openActeId: null };
}

// Rédiger un acte pour ABROGER un autre acte (ou l'un de ses articles) : c'est
// le geste du registre quand un acte publié ne peut pas être mis à la
// corbeille. On ne devine pas la trame : on dépose l'intention, et le
// rédacteur choisit la trame qui portera l'acte d'abrogation (voir
// `renderChooser`, qui l'annonce, et `renderRediger`, qui l'applique).
export function redigerAbrogation(abrogation) {
  state.redigerIntent = { abrogation, tab: "abrogations" };
  state.rediger = null;
  state.ui = { ...(state.ui || {}), openActeId: null };
  navigate("rediger");
}

// ============================================================================
// Choix de l'acte à rédiger
//
// L'onglet « Rédiger un acte » ouvre ce choix — et non plus la première trame de
// la liste, comme si le service n'en avait qu'une. On y reprend la rédaction en
// cours, un acte enregistré encore modifiable, ou l'on part d'une trame du
// référentiel. Le filtre évite de parcourir les modèles un par un dès que la
// collectivité en compte quelques dizaines.
// ============================================================================
function renderChooser(root) {
  const config = state.config;
  const ui = (state.ui = state.ui || {});
  if (ui.redigerQ === undefined) ui.redigerQ = "";

  const trames = visibleTrames();
  const actes = visibleActes();
  const enCours = state.rediger ? trames.find((t) => t.id === state.rediger.trameId) : null;

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Rédiger un acte" }),
      h("p", { class: "page-head__sub", text: "Choisissez l'acte à rédiger : une trame du référentiel, ou un acte déjà commencé. Le document s'ouvre ensuite dans l'éditeur de rédaction." }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("rediger", "Comment faire ?"),
      can("trames.voir") ? button("Voir les trames", { variant: "secondary", icon: "doc", onClick: () => navigate("trames") }) : null,
    ),
  ));

  // ------------------------------------------------- intention d'abrogation
  // Une abrogation à rédiger vient d'être demandée (registre : un acte publié
  // ne va pas à la corbeille). On le dit, et l'on attend le choix de la trame :
  // l'intention suivra le prochain brouillon ouvert.
  if (state.redigerIntent?.abrogation) {
    const a = state.redigerIntent.abrogation;
    root.appendChild(h("div", { class: "fr-alert fr-alert--info", style: { marginBottom: "12px" } },
      h("p", { class: "fr-alert__title", text: "Un acte d'abrogation est à rédiger" }),
      h("p", { class: "fr-small", text: `L'acte à rédiger doit abroger : ${a.kind === "article" ? `l'article ${a.article || ""} de ${cibleTexte(a)}` : cibleTexte(a)}. Choisissez ci-dessous la trame qui portera cet acte — la clause sera prévue d'avance.` }),
      h("div", { class: "fr-row", style: { marginTop: "6px" } },
        button("Renoncer", { variant: "tertiary", size: "sm", onClick: () => { state.redigerIntent = null; redrawView(); } })),
    ));
  }

  // ------------------------------------------------- rédaction en cours
  if (enCours) {
    const d = state.rediger;
    root.appendChild(h("div", { class: "fr-card", style: { borderLeft: "3px solid var(--brand)" } },
      h("div", { class: "fr-row" },
        h("div", { style: { flex: "1 1 auto" } },
          h("h2", { class: "fr-card__title", style: { margin: 0 }, text: "Rédaction en cours" }),
          h("p", { class: "fr-card__sub", text: [enCours.name, "v" + enCours.version, d.values?.numero ? "n° " + d.values.numero : "sans numéro"].join(" · ") }),
        ),
        h("div", { class: "fr-row" },
          button("Continuer", { variant: "primary", icon: "note", onClick: () => {
            // Le brouillon en cours est conservé : on rouvre sa trame en gardant
            // l'acte éventuellement repris, sans repartir de zéro.
            state.ui.openActeId = d.acteId || null;
            navigate("rediger/" + enCours.id);
          } }),
          button("Abandonner", { variant: "tertiary", icon: "trash", onClick: () => { resetDraft(); redrawView(); toast("Rédaction abandonnée"); } }),
        ),
      ),
    ));
  }

  // ------------------------------------------------- actes à reprendre
  const aReprendre = actes
    .filter((a) => isDraftable(a.statut) && a.values && state.trames.some((t) => t.id === a.trameId))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  if (aReprendre.length) {
    root.appendChild(h("div", { style: { marginTop: "18px" } },
      sectionHeader("Reprendre un acte enregistré", h("span", { class: "fr-small fr-muted", text: aReprendre.length + " acte(s) encore modifiable(s)" }))));
    const table = h("table", { class: "fr-table" },
      h("thead", {}, h("tr", {},
        h("th", { text: "Numéro" }), h("th", { text: "Objet" }), h("th", { text: "Trame" }),
        h("th", { text: "Modifié le" }), h("th", { text: "Statut" }), h("th", {}))));
    const tb = h("tbody");
    for (const a of aReprendre.slice(0, 12)) {
      const trame = state.trames.find((t) => t.id === a.trameId);
      tb.appendChild(h("tr", {},
        h("td", { class: "fr-mono", text: a.numero || "—" }),
        h("td", { text: a.objet || "—" }),
        h("td", { class: "fr-small", text: trame?.name || "—" }),
        h("td", { class: "fr-small fr-muted", text: a.updatedAt ? formatDate(String(a.updatedAt).slice(0, 10), "date-short") : "—" }),
        h("td", {}, h("span", { class: "fr-badge fr-badge--" + acteStatutColor(a.statut), text: acteStatutLabel(a.statut) }), abrogationBadge(a)),
        h("td", {}, button("Reprendre", { variant: "secondary", size: "sm", icon: "note", onClick: () => openActe(a) })),
      ));
    }
    table.appendChild(tb);
    root.appendChild(h("div", { class: "fr-table-wrap" }, table));
    if (aReprendre.length > 12) {
      root.appendChild(h("p", { class: "fr-small fr-muted", text: `Les ${aReprendre.length - 12} autres actes modifiables sont dans le registre (menu « Actes »).` }));
    }
  }

  // ------------------------------------------------- choix de la trame
  root.appendChild(h("div", { style: { marginTop: "18px" } }, sectionHeader("Partir d'une trame")));

  if (!trames.length) {
    root.appendChild(emptyState(
      state.trames.length
        ? "Aucune trame dans votre périmètre (service et bureaux). Les trames des autres services ne vous sont pas accessibles : demandez à un administrateur de rattacher une trame à votre service, ou de la rendre générale."
        : "Aucune trame pour l'instant.",
      can("trames.gerer") ? button("Créer une trame", { variant: "primary", icon: "plus", onClick: () => navigate("trames") }) : button("Lire le guide", { variant: "secondary", icon: "info", onClick: () => navigate("aide/demarrer") })));
    return;
  }

  const parTrame = new Map();
  for (const a of actes) parTrame.set(a.trameId, (parTrame.get(a.trameId) || 0) + 1);

  const q = h("input", {
    class: "fr-input", style: { maxWidth: "320px" }, placeholder: "Rechercher une trame…", value: ui.redigerQ,
    on: { input: (e) => { ui.redigerQ = e.target.value; paintList(); } },
  });
  root.appendChild(h("div", { class: "fr-row", style: { marginBottom: "10px" } }, q));

  const listEl = h("div");
  root.appendChild(listEl);

  // Seule la liste est reconstruite : le champ de recherche garde le focus.
  function paintList() {
    clear(listEl);
    const needle = (ui.redigerQ || "").toLowerCase();
    const items = trames.filter((t) => {
      if (!needle) return true;
      const service = t.serviceId ? targetLabel(config, t.serviceId, t.bureauId) : "trame générale";
      const family = (config.families || []).find((f) => f.id === t.familyId)?.label || "";
      return (t.name + " " + (t.description || "") + " " + service + " " + family).toLowerCase().includes(needle);
    });
    if (!items.length) {
      listEl.appendChild(emptyState("Aucune trame ne correspond à la recherche."));
      return;
    }
    const grid = h("div", { class: "fr-grid fr-grid--2" });
    for (const t of items) grid.appendChild(chooserTrameCard(t, parTrame.get(t.id) || 0));
    listEl.appendChild(grid);
  }

  paintList();
}

function chooserTrameCard(t, nbActes) {
  const config = state.config;
  const family = (config.families || []).find((f) => f.id === t.familyId);
  const commentaires = (t.body || []).reduce((n, node) => n + (node.notes?.length || 0) + (node.blocks || []).reduce((m, b) => m + (b.notes?.length || 0), 0), 0);
  const regles = (t.rules || []).length;
  return h("div", { class: "fr-card" },
    h("div", { class: "fr-row" },
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto" }, text: t.name }),
      statusBadge(t.status),
    ),
    h("p", { class: "fr-card__sub", text: [family?.label, "v" + t.version].filter(Boolean).join(" · ") }),
    t.description ? h("p", { class: "fr-small fr-muted", text: t.description }) : null,
    h("div", { class: "fr-row", style: { gap: "6px", margin: "8px 0" } },
      t.serviceId
        ? h("span", { class: "fr-badge fr-badge--info", text: targetLabel(config, t.serviceId, t.bureauId) })
        : h("span", { class: "fr-badge", text: "Trame générale" }),
      h("span", { class: "fr-badge", text: (t.fields || []).length + " champs" }),
      regles ? h("span", { class: "fr-badge", text: regles + " règle" + (regles > 1 ? "s" : "") }) : null,
      !tramePublishable(t) ? h("span", { class: "fr-badge fr-badge--warning", title: "Les actes issus de cette trame ne sont pas publiés au recueil (actes individuels).", text: "Non publiable" }) : null,
      nbActes ? h("span", { class: "fr-badge", text: nbActes + " acte" + (nbActes > 1 ? "s" : "") }) : null,
      commentaires ? h("span", { class: "fr-badge fr-badge--info", text: commentaires + " commentaire" + (commentaires > 1 ? "s" : "") }) : null,
    ),
    h("div", { class: "fr-row" },
      button("Rédiger", { variant: "primary", icon: "note", onClick: () => { resetDraft(); navigate("rediger/" + t.id); } }),
      can("trames.gerer") ? button("Éditer la trame", { variant: "secondary", icon: "doc", onClick: () => navigate("trame/" + t.id) }) : null,
    ),
  );
}

export function renderRediger(root, params) {
  if (!params || !params.id) { renderChooser(root); return; }
  const trame = state.trames.find((t) => t.id === params.id) || state.trames[0];
  if (!trame) {
    root.appendChild(emptyState("Aucune trame disponible.", button("Créer une trame", { variant: "primary", onClick: () => navigate("trames") })));
    return;
  }
  state.ui = state.ui || {};
  const openId = params.id ? state.ui.openActeId : null;
  // L'acte repris doit être CELUI de la trame ouverte : une trame changée (ou
  // une adresse suivie à la main) ne doit pas charger les valeurs d'un autre
  // acte sous une autre trame.
  const existing = openId ? state.actes.find((a) => a.id === openId && a.trameId === trame.id) : null;

  const needInit = !state.rediger
    || state.rediger.trameId !== trame.id
    || (existing && state.rediger.acteId !== existing.id)
    || (!existing && state.rediger.acteId && !state.rediger.fresh);
  if (needInit) {
    state.rediger = existing
      ? { trameId: trame.id, acteId: existing.id, values: structuredClone(existing.values || {}), statut: existing.statut, numeroSource: existing.numeroSource || null }
      : freshDraft(trame);
  }
  const draft = state.rediger;
  const config = state.config;
  // L'entité de l'acte : une trame peut en imposer une (une trame d'office ne se
  // rédige pas au nom de la commune). Si le brouillon en porte une autre — trame
  // changée, trame restreinte —, on la rectifie, pour que le sélecteur, le
  // document et la chaîne de délégations disent la même chose.
  const entitesPermises = (config.entities || []).filter((e) => !trame.entityIds?.length || trame.entityIds.includes(e.id));
  if (entitesPermises.length && !entitesPermises.some((e) => e.id === draft.values.__entityId)) {
    draft.values.__entityId = entitesPermises[0].id;
  }
  // Verrou souple : on annonce l'acte en cours de rédaction au reste de
  // l'installation (voir src/lib/collab.js). Posé à l'entrée, relâché à la
  // sortie de l'écran (drawView) — un poste fermé net est oublié au bout de
  // 70 secondes.
  if (draft.acteId) signalerRedaction(draft.acteId, draft.values.numero || draft.values.objet || "");
  bindConfig(config);
  draft.values.__overrides = draft.values.__overrides || {};
  draft.values.__abrogations = Array.isArray(draft.values.__abrogations) ? draft.values.__abrogations : [];
  const overrides = draft.values.__overrides;
  const sources = new Map(listSlots(trame, config).map((s) => [s.addr, s.original]));
  const fieldsInText = fieldIdsInText(trame);
  const ui = (draft.ui = draft.ui || { tab: "completer", showAll: false });
  let counterEls = null;
  let signaturePreviewEl = null;

  // Intention venue d'un autre écran (registre : « abroger un acte publié ») :
  // on l'applique une seule fois, à l'ouverture du brouillon.
  if (state.redigerIntent?.abrogation) {
    draft.values.__abrogations.push({ id: uid("abr"), ...state.redigerIntent.abrogation });
    if (state.redigerIntent.tab) ui.tab = state.redigerIntent.tab;
    state.redigerIntent = null;
  }

  let doc = compile(trame, draft.values, config, { markMissing: true });

  // ---------------------------------------------------------- publication
  const redraw = () => redrawView();
  const rx = {
    trame, config, values: draft.values, overrides, sources,
    get doc() { return doc; },
    setField(id, value) { draft.values[id] = value; },
    markDirty() {},
    paintSoon: debounce(() => paintPaper(), 130),
    paintPanelSoon: debounce(() => paintStatus(), 200),
    paintFull: () => { closeTokenEditor(); redraw(); },
  };
  const paintFull = rx.paintFull;
  const paintSoon = rx.paintSoon;

  // ------------------------------------------------------------------ entête
  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: existing ? "Reprise d'un acte" : "Rédiger un acte" }),
      h("p", { class: "page-head__sub", text: `${trame.name} · v${trame.version}${draft.values.numero ? " · n° " + draft.values.numero : ""}` }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("rediger", "Comment faire ?"),
      entityPicker(),
      h("span", { id: "rediger-badge" }),
      h("span", { id: "rediger-parapheur" }),
      h("span", { id: "rediger-revision" }),
      button("Changer d'acte", { variant: "tertiary", icon: "doc", title: "Choisir une autre trame, ou reprendre un acte commencé", onClick: () => navigate("rediger") }),
      button("Enregistrer", { variant: "secondary", icon: "check", onClick: save }),
      button("Exporter…", { variant: "primary", icon: "download", onClick: () => exportMenu() }),
    ),
  ));

  // Un autre poste rédige le même acte : on le dit, plutôt que de laisser deux
  // personnes s'étonner d'un conflit à l'enregistrement.
  const autre = draft.acteId ? quiRedige(draft.acteId) : null;
  if (autre) {
    root.appendChild(h("div", { class: "fr-alert fr-alert--warning", style: { margin: "0 0 12px" } },
      h("p", { class: "fr-alert__title", text: "Cet acte est ouvert sur un autre poste" }),
      h("p", { class: "fr-small", text: `${autre.byName} le rédige en ce moment. Vous pouvez continuer, mais le dernier enregistrement envoyé à la base l'emporte : mieux vaut convenir de qui travaille dessus.` }),
    ));
  }

  // Acte individuel : la trame est déclarée non publiable. On le dit dès la
  // rédaction, pour que l'agent ne cherche pas ensuite la case « publier ».
  if (!tramePublishable(trame)) {
    root.appendChild(h("div", { class: "fr-alert fr-alert--info", style: { margin: "0 0 12px" } },
      h("p", { class: "fr-alert__title", text: "Acte non publiable" }),
      h("p", { class: "fr-small", text: "Cette trame est déclarée non publiable : l'acte sera signé et conservé au registre, mais il ne sera pas déposé au recueil des actes administratifs (acte individuel). Il reste imprimable et exportable pour sa notification à l'intéressé." }),
    ));
  }

  const cols = h("div", { class: "redaction-grid" });
  root.appendChild(cols);

  // ------------------------------------------------------- colonne document
  const docCol = h("div", { class: "fr-stack redaction-col--doc" });
  cols.appendChild(docCol);
  docCol.appendChild(h("div", { class: "fr-card fr-card--soft redaction-hint" },
    h("p", { class: "fr-small", style: { margin: 0 } },
      h("strong", { text: "Écrivez directement dans le document. " }),
      "Cliquez sur une pastille bleue pour renseigner un champ, et sur n'importe quel texte pour le corriger comme dans un traitement de texte.",
    ),
    h("p", { class: "fr-small fr-muted", style: { margin: "4px 0 0" } },
      "Ce que vous réécrivez est conservé, mais signalé aux administrateurs comme ",
      h("span", { class: "rw-tagmini", text: "hors trame" }),
      " — ce n'est pas bloquant : adapter une rédaction est parfois nécessaire.",
    ),
  ));
  const paperBox = h("div", { class: "paper-box" });
  const paper = h("div", { class: "paper paper--edit" });
  paper.style.fontFamily = config.brand.documentFont || "";
  paperBox.appendChild(paper);
  docCol.appendChild(paperBox);

  // -------------------------------------------------------- colonne panneau
  const sideCol = h("div", { class: "fr-stack redaction-col--side" });
  cols.appendChild(sideCol);
  const tabsBar = h("div", { class: "fr-tabs", style: { marginBottom: "0" } });
  const panelBody = h("div", { class: "fr-card", id: "redaction-panel" });
  sideCol.appendChild(tabsBar);
  sideCol.appendChild(panelBody);

  renderTabs();
  paintPaper(true);
  paintStatus();
  paintPanel();

  // ------------------------------------------------------------------ rendu
  function paintPaper(refit = false) {
    doc = compile(trame, draft.values, config, { markMissing: true });
    majSourcesAbrogations();
    clear(paper);
    applyPaper(paper, doc, config);
    paper.appendChild(buildRedactionDoc(rx));
    requestAnimationFrame(() => fitPaper(paperBox, paper));
    paintBadge();
    if (refit) requestAnimationFrame(() => fitPaper(paperBox, paper));
  }

  function paintStatus() {
    // Le texte peut avoir été réécrit depuis le dernier rendu de la page : on
    // recalcule le document pour que compteurs, écarts et contrôles soient justes.
    doc = compile(trame, draft.values, config, { markMissing: true });
    paintBadge();
    renderTabs();
    // Le panneau se rafraîchit, sauf si le curseur y est : le reconstruire
    // ferait perdre la saisie en cours.
    const a = document.activeElement;
    if (!a || !panelBody.contains(a)) paintPanel();
  }

  function paintBadge() {
    const el = root.querySelector("#rediger-badge");
    if (!el) return;
    clear(el);
    const blocking = doc.issues.filter((i) => i.level === "blocking").length;
    const nbEcarts = doc.ecarts.length;
    el.appendChild(h("span", { class: "fr-badge fr-badge--" + (blocking ? "error" : "success"), text: blocking ? `${blocking} bloquant(s)` : "prêt à exporter" }));
    if (nbEcarts) {
      el.appendChild(h("span", {
        class: "fr-badge fr-badge--warning", style: { marginLeft: "6px" },
        title: "Passages réécrits par rapport à la trame : visibles par les administrateurs, non bloquants.",
        text: `${nbEcarts} écart${nbEcarts > 1 ? "s" : ""} à la trame`,
      }));
    }
    paintParapheur();
    paintRevision();
  }

  // Où en est l'acte devant le réviseur : le rédacteur doit savoir que son
  // « envoi en signature » passera d'abord par un contrôle — et, si l'acte a été
  // REJETÉ, lire le motif sans quitter sa rédaction : c'est lui qui doit
  // corriger.
  function paintRevision() {
    const el = root.querySelector("#rediger-revision");
    if (!el) return;
    clear(el);
    const acte = draft.acteId ? state.actes.find((x) => x.id === draft.acteId) : null;
    if (!acte) return;
    const rev = revisionPour(acte);
    if (!rev.requise && !acte.revision) return;
    const etat = etatRevision(acte);
    if (!etat) {
      el.appendChild(h("span", { class: "fr-badge fr-badge--info", title: "Un réviseur contrôle cet acte entre l'envoi en signature et la signature.", text: "révision à venir" }));
      return;
    }
    el.appendChild(h("span", {
      class: "fr-badge fr-badge--" + (etat.caduque ? "warning" : etat.color),
      title: "Révision de l'acte",
      text: etat.caduque ? "révision caduque" : etat.label,
    }));
    const r = acte.revision || {};
    if (r.statut === "rejete" && r.motif) {
      el.appendChild(h("span", {
        class: "fr-small", style: { marginLeft: "6px" }, title: r.motif,
        text: "Motif du rejet : « " + (r.motif.length > 120 ? r.motif.slice(0, 117) + "…" : r.motif) + " »",
      }));
    } else if (r.statut === "valide" && r.corrige) {
      el.appendChild(h("span", { class: "fr-small fr-muted", style: { marginLeft: "6px" }, text: "texte corrigé par le réviseur" }));
    } else if (r.statut === "en_attente") {
      el.appendChild(h("span", { class: "fr-small fr-muted", style: { marginLeft: "6px" }, text: "en attente du réviseur" }));
    }
  }

  // Où en est l'acte dans le circuit de validation : c'est une information de
  // premier plan pour le rédacteur — il saura s'il doit relancer un valideur, et
  // surtout que modifier un acte validé remet le circuit en jeu.
  function paintParapheur() {
    const el = root.querySelector("#rediger-parapheur");
    if (!el) return;
    clear(el);
    // Parapheur éteint (fonction expérimentale) : rien à dire au rédacteur.
    if (!parapheurActif()) return;
    const acte = draft.acteId ? state.actes.find((x) => x.id === draft.acteId) : null;
    if (!acte) {
      el.appendChild(h("span", { class: "fr-badge", title: "Cet acte n'est pas encore parvenu au parapheur : enregistrez-le, puis soumettez-le.", text: "hors parapheur" }));
      return;
    }
    const v = acte.validation;
    if (!v) {
      const circuit = circuitDe(acte);
      if (!circuit) {
        el.appendChild(h("span", { class: "fr-badge", title: "Aucun circuit du référentiel ne s'applique à cet acte.", text: "hors parapheur" }));
        return;
      }
      el.appendChild(button("Soumettre au circuit", {
        variant: "tertiary", size: "sm", icon: "upload",
        title: `Circuit « ${circuit.label} » : ${circuit.steps.length} étape(s)`,
        onClick: () => soumettre(acte),
      }));
      return;
    }
    const caduque = !validationAJour(acte);
    const etat = caduque ? { label: "Validation caduque", color: "warning" } : (VALIDATION_STATUTS[v.statut] || { label: v.statut, color: "info" });
    el.appendChild(h("span", { class: "fr-badge fr-badge--" + etat.color, title: "Circuit « " + (v.circuitLabel || "") + " »", text: etat.label }));
    const change = JSON.stringify(draft.values) !== JSON.stringify(acte.values);
    const ouverte = etapeActive(v);
    const note = caduque
      ? "Le texte validé n'est plus celui de l'acte : le circuit doit être repris."
      : change
        ? "Modifications non enregistrées : les enregistrer rendra la validation caduque."
        : ouverte ? "En attente : " + ouverte.label : "";
    if (note) el.appendChild(h("span", { class: "fr-small fr-muted", style: { marginLeft: "6px" }, text: note }));
  }

  // Soumettre l'acte au circuit : on enregistre d'abord (le circuit porte sur le
  // texte enregistré, pas sur les frappes en cours), puis on ouvre le circuit.
  async function soumettre(acte) {
    const circuit = circuitDe(acte);
    if (!circuit) { toast("Aucun circuit ne s'applique à cet acte.", "warning"); return; }
    save();
    demarrerValidation(acte, circuit, state.user);
    acte.updatedAt = new Date().toISOString();
    const etape = etapeActive(acte.validation);
    await journaliser({
      action: "parapheur.depot", cible: "acte", cibleLabel: acte.numero || acte.id, acteId: acte.id,
      detail: `soumis au circuit « ${circuit.label} »` + (etape ? " — étape « " + etape.label + " »" : ""),
      to: [etape ? (etape.role === "administrateur" ? "role:administrateur" : "role:editeur") : ""].filter(Boolean),
    });
    touch("actes", { rerender: false });
    toast("Acte enregistré et soumis au circuit de validation", "success");
    redraw();
  }

  function renderTabs() {
    const nbTodo = requiredTodo();
    const nbCtrl = doc.issues.length + doc.ecarts.length;
    const nbAbr = (draft.values.__abrogations || []).length;
    tabsBar.replaceChildren();
    for (const t of [
      { id: "completer", label: "À compléter" + (nbTodo ? ` (${nbTodo})` : "") },
      { id: "abrogations", label: "Abrogations" + (nbAbr ? ` (${nbAbr})` : "") },
      { id: "controle", label: "Contrôle & écarts" + (nbCtrl ? ` (${nbCtrl})` : "") },
    ]) {
      tabsBar.appendChild(h("button", {
        class: "fr-tab" + (ui.tab === t.id ? " fr-tab--active" : ""), text: t.label,
        onClick: () => { ui.tab = t.id; redraw(); },
      }));
    }
  }
  function paintPanel() {
    clear(panelBody);
    if (ui.tab === "completer") paintCompleter(panelBody);
    else if (ui.tab === "abrogations") paintAbrogations(panelBody);
    else paintControle(panelBody);
  }

  // ------------------------------------------------------- onglet compléter
  // Le rédacteur voit d'abord ce qui est OBLIGATOIRE et manquant. Les champs
  // facultatifs (date d'effet, plafond, abrogation…) sont là pour l'aider, pas
  // pour l'inquiéter : ils restent repliés.
  function paintCompleter(box) {
    const all = applicableFields();
    const missing = all.filter((f) => isEmpty(f, draft.values[f.id]));
    const req = missing.filter((f) => f.required);
    const opt = missing.filter((f) => !f.required);
    box.appendChild(h("div", { class: "fr-row" },
      h("strong", { text: req.length ? `${req.length} champ(s) obligatoire(s) à compléter` : "Tous les champs obligatoires sont renseignés", style: { color: req.length ? "var(--error)" : "var(--success)" } }),
      h("span", { class: "fr-spacer" }),
      h("span", { class: "fr-small fr-muted", text: `${all.length - missing.length}/${all.length}` }),
    ));
    box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "4px 0 10px" },
      text: "Complétez dans le document (pastilles bleues) ou ici : les deux sont liés." }));
    counterEls = { strong: box.querySelector("strong"), count: box.querySelector(".fr-small.fr-muted") };

    if (!req.length && !opt.length) {
      box.appendChild(h("p", { class: "fr-small", style: { color: "var(--success)" }, text: "✓ Rien à compléter. Relisez le document, puis enregistrez." }));
    }
    let currentGroup = null;
    for (const f of req) {
      const g = f.group || "Autres";
      if (g !== currentGroup) { currentGroup = g; box.appendChild(h("div", { class: "rx-group", text: g })); }
      box.appendChild(fieldRow(f));
    }
    if (opt.length) {
      const det = h("details", { class: "rx-hidden", open: ui.showAll ? "" : null },
        h("summary", { text: `${opt.length} champ(s) facultatif(s) non renseigné(s)` }));
      det.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "6px 0" },
        text: "Ces informations ne sont utiles que dans certains cas (par exemple : un plafond de chèque si les chèques sont admis)." }));
      for (const f of opt) det.appendChild(fieldRow(f));
      box.appendChild(det);
    }
    // Tous les champs, y compris ceux déjà renseignés (relecture, correction).
    const done = all.filter((f) => !missing.includes(f));
    if (done.length) {
      const det = h("details", { class: "rx-hidden", open: ui.showAll ? "" : null },
        h("summary", { text: `${done.length} champ(s) déjà renseigné(s)` }));
      let g = null;
      for (const f of done) {
        const gname = f.group || "Autres";
        if (gname !== g) { g = gname; det.appendChild(h("div", { class: "rx-group", text: g })); }
        det.appendChild(fieldRow(f));
      }
      box.appendChild(det);
    }

    // Passages masqués par une condition
    const hidden = hiddenPassages(trame, doc);
    if (hidden.length) {
      box.appendChild(h("details", { class: "rx-hidden" },
        h("summary", { text: `${hidden.length} passage(s) non affiché(s) pour l'instant` }),
        h("p", { class: "fr-small fr-muted", text: "Un passage conditionnel apparaît dès que la condition est remplie (par exemple un moyen de paiement choisi)." }),
        ...hidden.map((pr) => h("p", { class: "fr-small", style: { margin: "2px 0" } },
          h("strong", { text: pr.label }), h("span", { class: "fr-muted", text: " — si " + pr.when }))),
      ));
    }
  }

  function applicableFields() {
    return (trame.fields || []).filter((f) => !f.appliesWhen || safeEval(f.appliesWhen, doc.ctx).value);
  }

  // Aperçu de la signature sous le champ « Signataire ». La qualité s'accorde en
  // genre et, si le signataire tient sa signature d'une délégation, la chaîne
  // des qualités s'ajoute — c'est un fait du référentiel, pas du document. Le
  // rédacteur voit ainsi ce qui figurera au bas de l'acte.
  //
  // Le périmètre de l'acte (entité, famille, type, date) traverse tout : c'est
  // lui qui décide de QUELLE chaîne de délégations s'applique — celle de la
  // commune, celle de l'office… — et quelle fonction peut être tenue.
  function signatureScope() {
    return {
      entityId: draft.values.__entityId || "",
      familyId: trame.familyId || "",
      actTypeId: trame.actTypeId || "",
      date: draft.values.dateSignature || "",
    };
  }

  // Le rôle sous lequel le signataire signe, quand la fonction retenue en est
  // un (voir src/lib/fonctions.js).
  function signatureRole() {
    const champ = (trame.fields || []).find((f) => f.type === "signataire" || f.id === "signataire");
    return roleDeFonction(draft.values[champFonction(champ?.id || "signataire")] || "");
  }

  function refreshSignaturePreview() {
    if (!signaturePreviewEl) return;
    const id = draft.values.signataire;
    const personne = id ? (config.people || []).find((p) => p.id === id) : null;
    signaturePreviewEl.replaceChildren();
    signaturePreviewEl.hidden = !personne;
    if (!personne) return;
    const lignes = lignesQualites(config, id, { ...signatureScope(), roleId: signatureRole() });
    signaturePreviewEl.appendChild(h("p", { class: "rx-signature__label", text: "Au bas de l'acte" }));
    for (const ligne of lignes) signaturePreviewEl.appendChild(h("p", { class: "doc-signature-role", text: ligne }));
    signaturePreviewEl.appendChild(h("p", { class: "doc-signature-name", text: personSignatureName(personne) }));
    if (lignes.length > 1) {
      signaturePreviewEl.appendChild(h("p", { class: "rx-signature__note",
        text: "Signe par délégation : la chaîne des qualités vient du référentiel (écran Délégations)." }));
    }
    // Les décisions que l'acte visera au titre de la signature : par étage de
    // la chaîne, du sommet vers le signataire, la nomination puis la
    // délégation (voir src/lib/delegations.js).
    const decisions = decisionsDeSignature(config, id, signatureScope());
    if (decisions.length) {
      signaturePreviewEl.appendChild(h("p", { class: "rx-signature__label", text: decisions.length > 1 ? `Décisions visées (${decisions.length})` : "Décision visée" }));
      for (const x of decisions) {
        signaturePreviewEl.appendChild(h("p", { class: "rx-signature__note", text: `${config.vocab?.visasLabel || "Vu"} ${x.label}` }));
      }
    }
  }

  function fieldRow(f) {
    const empty = isEmpty(f, draft.values[f.id]);
    const row = h("div", { class: "rx-field" + (empty ? " rx-field--empty" : "") });
    const inText = fieldsInText.has(f.id);
    const head = h("div", { class: "rx-field__head" },
      h("span", { class: "rx-field__label", text: f.label }),
      f.required ? h("span", { class: "fr-required", text: "*" }) : h("span", { class: "rx-opt", text: "facultatif" }),
      h("span", { class: "fr-spacer" }),
      inText
        ? h("button", {
          class: "rx-jump", title: "Voir cet endroit dans le document", type: "button",
          onClick: () => { if (!focusFieldWidget(paper, f.id)) toast("Ce champ n'apparaît pas dans le document", "info"); },
        }, icon("eye", 13))
        : h("span", { class: "rx-out", title: "Ce champ n'apparaît pas dans le texte de l'acte", text: "hors texte" }),
    );
    row.appendChild(head);
    if (f.help) row.appendChild(h("p", { class: "fr-hint", text: f.help }));
    if (f.id === "numero") {
      // Le numéro vient soit de la séquence de l'application, soit d'un service
      // externe (Administration › Numérotation) : dans ce second cas, le bouton
      // demande le numéro, et l'acte retient la ligne qui le porte.
      const ext = estExterne(config);
      const zone = h("div", { class: "fr-row", style: { marginBottom: "6px", flexWrap: "wrap", alignItems: "center" } });
      zone.appendChild(button(
        ext ? (draft.values.numero ? "Redemander un numéro" : "Demander le numéro") : "Réserver le prochain numéro",
        { variant: "tertiary", size: "sm", icon: "check", onClick: reserveNumber }));
      if (ext) zone.appendChild(h("span", { class: "fr-small fr-muted", text: sourceNumero() }));
      row.appendChild(zone);
    }
    if (f.type === "signataire" || f.id === "signataire") {
      signaturePreviewEl = h("div", { class: "rx-signature" });
      // On ne choisit pas un nom dans un annuaire : on choisit une FONCTION,
      // puis, parmi ceux qui ont qualité pour la tenir, qui signe (voir
      // src/ui/signer-picker.js).
      row.appendChild(signerPicker({
        field: f, config, scope: signatureScope(),
        personId: draft.values[f.id] || "",
        fonctionKey: draft.values[champFonction(f.id)] || "",
        onPerson: (v) => {
          draft.values[f.id] = v;
          row.classList.toggle("rx-field--empty", isEmpty(f, v));
          refreshSignaturePreview();
          paintSoon();
          updateCounter();
        },
        onFonction: (cle) => {
          draft.values[champFonction(f.id)] = cle;
          refreshSignaturePreview();
          paintSoon();
        },
      }));
      row.appendChild(signaturePreviewEl);
      refreshSignaturePreview();
      return row;
    }
    row.appendChild(controlFor(f, draft.values[f.id], (v) => {
      draft.values[f.id] = v;
      row.classList.toggle("rx-field--empty", isEmpty(f, v));
      paintSoon();
      updateCounter();
    }));
    return row;
  }

  function updateCounter() {
    if (ui.tab !== "completer" || !counterEls) return;
    const all = applicableFields();
    const missing = all.filter((f) => isEmpty(f, draft.values[f.id]));
    const req = missing.filter((f) => f.required).length;
    if (counterEls.strong) {
      counterEls.strong.textContent = req ? `${req} champ(s) obligatoire(s) à compléter` : "Tous les champs obligatoires sont renseignés";
      counterEls.strong.style.color = req ? "var(--error)" : "var(--success)";
    }
    if (counterEls.count) counterEls.count.textContent = `${all.length - missing.length}/${all.length}`;
    renderTabs();
  }

  // --------------------------------------------------------- onglet contrôle
  function paintControle(box) {
    const blocking = doc.issues.filter((i) => i.level === "blocking");
    const warnings = doc.issues.filter((i) => i.level === "warning");
    box.appendChild(h("h3", { class: "rx-h3", text: "Contrôles de la trame" }));
    if (!doc.issues.length) {
      box.appendChild(h("p", { class: "fr-small", style: { color: "var(--success)", margin: 0 }, text: "✓ Aucun contrôle en échec." }));
    } else {
      for (const i of [...blocking, ...warnings]) {
        box.appendChild(h("p", { class: "fr-small", style: { margin: "0 0 4px", color: i.level === "blocking" ? "var(--error)" : "var(--warning)" } },
          (i.level === "blocking" ? "✗ " : "⚠ ") + i.message));
      }
      if (blocking.length) box.appendChild(h("p", { class: "fr-small fr-muted", text: `${blocking.length} contrôle(s) bloquant(s) : l'export est désactivé tant qu'ils ne sont pas levés.` }));
    }
    if (doc.missing.length) {
      box.appendChild(h("p", { class: "fr-small fr-muted", style: { marginTop: "6px" }, text: "Références non résolues : " + doc.missing.slice(0, 6).join(", ") }));
    }

    box.appendChild(h("hr", { class: "fr-sep" }));
    box.appendChild(h("h3", { class: "rx-h3", text: "Écarts à la trame" }));
    if (!doc.ecarts.length) {
      box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: 0 }, text: "Aucun passage réécrit : le texte suit exactement le modèle." }));
      return;
    }
    box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0 0 8px" },
      text: `${doc.ecarts.length} passage(s) réécrit(s) par rapport au modèle. C'est autorisé, mais les administrateurs le verront.` }));
    for (const e of doc.ecarts) {
      const loc = locateAddr(doc, e.addr);
      const card = h("div", { class: "rx-ecart" },
        h("div", { class: "rx-ecart__head" },
          h("span", { class: "rx-ecart__where", text: [loc.area, loc.label].filter(Boolean).join(" · ") }),
          h("span", { class: "fr-spacer" }),
          button("Revenir à la trame", {
            variant: "tertiary", size: "sm",
            onClick: () => { delete overrides[e.addr]; redraw(); toast("Texte du modèle rétabli", "success"); },
          }),
        ),
        h("p", { class: "rx-ecart__line" },
          h("span", { class: "rx-ecart__k", text: "modèle" }),
          h("span", { class: "rx-ecart__was", text: interpolate(e.original, doc.ctx) || "—" })),
        h("p", { class: "rx-ecart__line" },
          h("span", { class: "rx-ecart__k", text: "vous" }),
          h("span", { class: "rx-ecart__now", text: interpolate(e.current, doc.ctx) || "(texte supprimé)" })),
      );
      box.appendChild(card);
    }
  }

  // ---------------------------------------------------- onglet abrogations
  // Un acte peut, par lui-même, prévoir l'abrogation d'un AUTRE acte — ou de
  // l'un de ses articles. C'est la clause de fin de dispositif (« L'arrêté n° …
  // du … est abrogé à compter de l'entrée en vigueur du présent arrêté »). Elle
  // prend effet au jour de l'ENTRÉE EN VIGUEUR de l'acte, et non de sa
  // publication : c'est ce que dit le texte (voir src/lib/abrogations.js), et
  // c'est ce que fait l'application le moment venu (src/ui/abrogations-apply.js).
  //
  // L'acte visé se désigne EXPRESSÉMENT quand il est au registre : on le choisit
  // dans la liste, et l'application retient de quoi l'appliquer (numéro, ELI).
  // Un acte qu'elle ne connaît pas ne se vise que par un texte libre.
  function designationActe() {
    return (config.actTypes || []).find((t) => t.id === trame.actTypeId)?.label || draft.values.designation || "Acte";
  }
  function designationDe(acte) {
    return designationDeActe(acte, config, state.trames.find((x) => x.id === acte?.trameId));
  }
  // Le document d'un acte du registre — ceux qui ne transportent pas le leur se
  // recompilent depuis leur trame. Volontairement local : importer `docOfActe`
  // de modifier.js créerait un cycle (modifier.js importe openActe d'ici).
  function docCible(a) {
    if (!a) return null;
    if (a.doc) return a.doc;
    const t = state.trames.find((x) => x.id === a.trameId);
    if (!t) return null;
    try { return compile(t, a.values || {}, config, { overrides: a.overrides }); } catch (e) { return null; }
  }
  // Les articles d'un acte, tels qu'on peut les viser : leur numéro SEUL (le
  // mot « Article » est porté par le modèle de clause) et leur identifiant
  // stable. Le libellé affiché, lui, reste « Article 2 — … ».
  function articlesDe(a) {
    const label = config.vocab?.articleLabel || "Article";
    const re = new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "i");
    const d = docCible(a);
    return (d?.nodes || [])
      .filter((node) => node.type === "article" && !node.abrogation)
      .map((node) => {
        const numLabel = String(node.numLabel || "");
        return { eId: node.eId || "", num: numLabel.replace(re, ""), numLabel, heading: node.heading || "" };
      });
  }

  // Les clauses d'abrogation ne viennent pas de la trame : elles sont engendrées
  // par les entrées saisies ici. On les inscrit dans l'inventaire des
  // emplacements éditables, pour que les corriger dans le document ne soit pas
  // signalé comme un écart (« hors trame ») — c'est un texte de l'application.
  function majSourcesAbrogations() {
    for (const k of [...sources.keys()]) {
      if (k === "abrogations" || k.startsWith("abrogations.")) sources.delete(k);
    }
    const list = draft.values.__abrogations || [];
    if (!list.length) return;
    const V = abrogationVocab(config);
    sources.set("abrogations.heading", V.heading);
    const des = designationActe();
    list.forEach((a, i) => sources.set(`abrogations.blocks.${i}`, clauseAbrogation(a, { config, designation: des })));
  }
  // Toute retouche de la liste décale les clauses : les réécritures faites dans
  // le document (adresses `abrogations…`) ne veulent plus rien dire. On les
  // oublie, plutôt que de laisser une clause fantôme se coller au mauvais acte.
  function oublierOverridesAbrogation() {
    for (const k of Object.keys(overrides)) {
      if (k === "abrogations" || k.startsWith("abrogations.")) delete overrides[k];
    }
  }

  function libelleCible(a) {
    if (a.kind === "article") return `${cibleTexte(a)} — article ${a.article || "…"}`;
    return cibleTexte(a) || "(cible à préciser)";
  }

  function paintAbrogations(box) {
    const list = draft.values.__abrogations || [];
    box.appendChild(h("h3", { class: "rx-h3", text: "Abrogations prévues par l'acte" }));
    box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0 0 10px" },
      text: "L'acte peut abroger un autre acte du registre, ou l'un de ses articles. La clause prend effet à l'entrée en vigueur de l'acte, non à sa publication." }));
    if (!list.length) {
      box.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucune abrogation prévue : l'acte ne touche pas aux actes existants." }));
    } else {
      for (const a of list) box.appendChild(abrogationCard(a));
    }
    box.appendChild(h("div", { class: "fr-row", style: { marginTop: "10px" } },
      button("Prévoir une abrogation", { variant: "secondary", icon: "plus", onClick: () => abrogationModal(null) })));
    if (list.length) {
      const jour = entreeEnVigueur({ values: draft.values }, config);
      box.appendChild(h("p", { class: "fr-small fr-muted", style: { marginTop: "10px" },
        text: jour
          ? `Entrée en vigueur retenue : ${formatDate(jour)}. Les abrogations prendront effet ce jour-là.`
          : "Les abrogations prendront effet au jour de l'entrée en vigueur de l'acte : renseignez la date d'effet (ou la publication) pour la connaître." }));
    }
  }

  function abrogationCard(a) {
    const des = designationActe();
    return h("div", { class: "rx-field" },
      h("div", { class: "rx-field__head" },
        h("span", { class: "rx-field__label", text: libelleCible(a) }),
        h("span", { class: "fr-spacer" }),
        button("", { variant: "tertiary", size: "sm", icon: "note", title: "Modifier cette abrogation", onClick: () => abrogationModal(a) }),
        button("", { variant: "tertiary", size: "sm", icon: "trash", title: "Retirer cette abrogation", onClick: () => retirerAbrogation(a) }),
      ),
      h("p", { class: "fr-small", style: { margin: "4px 0 0" }, text: clauseAbrogation(a, { config, designation: des }) }),
      h("p", { class: "fr-small fr-muted", style: { margin: "2px 0 0" }, text: "Effet : à l'entrée en vigueur de l'acte." }),
    );
  }

  function retirerAbrogation(a) {
    const list = draft.values.__abrogations || [];
    const i = list.indexOf(a);
    if (i >= 0) list.splice(i, 1);
    oublierOverridesAbrogation();
    redraw();
    toast("Abrogation retirée", "info");
  }

  // Choix de la cible. On ne fait pas saisir un numéro : on choisit l'acte dans
  // le registre (et, s'il s'agit d'un article, l'article dans son texte), et
  // l'application retient la photographie de ce qu'elle vise — un acte signé ne
  // se réécrit pas ensuite.
  function abrogationModal(entry) {
    const maj = !!entry;
    const val = {
      id: entry?.id || uid("abr"),
      kind: entry?.kind || "acte",
      acteId: entry?.acteId || "",
      numero: entry?.numero || "", designation: entry?.designation || "",
      date: entry?.date || "", eli: entry?.eli || "",
      article: entry?.article || "", articleEId: entry?.articleEId || "",
      texte: entry?.texte || "", clause: entry?.clause || "",
    };
    // Les actes visables : le registre vivant, hors versions consolidées (elles
    // ne sont pas des actes, mais des états d'un acte) et hors l'acte lui-même.
    const actes = (state.actes || [])
      .filter((x) => !x.deletedAt && x.kind !== "consolide" && x.id !== draft.acteId)
      .sort((a, b) => String(b.dateSignature || b.updatedAt || "").localeCompare(String(a.dateSignature || a.updatedAt || "")));
    const acteDe = (id) => actes.find((x) => x.id === id) || null;

    const corps = h("div", { class: "fr-stack" });
    let apercuEl = null;
    // L'aperçu dit la clause RÉELLE : on y reporte ce que l'acte choisi porte
    // (numéro, nature, date), comme le fera l'enregistrement.
    const cibleApercu = () => {
      const a = acteDe(val.acteId);
      if (!a) return val;
      return {
        ...val,
        numero: a.numero || "",
        designation: designationDe(a),
        date: a.dateSignature || a.values?.dateSignature || "",
        eli: a.eli || docCible(a)?.meta?.eli || "",
      };
    };
    const apercuTexte = () => clauseAbrogation(cibleApercu(), { config, designation: designationActe() });
    const majApercu = () => { if (apercuEl) apercuEl.textContent = apercuTexte(); };

    function peindre() {
      clear(corps);
      corps.appendChild(selectField({
        label: "Objet de l'abrogation", value: val.kind,
        options: KINDS.map((k) => ({ value: k.id, label: k.label })),
        help: "Un acte du registre se vise expressément : l'application saura l'appliquer le moment venu.",
        onChange: (v) => { val.kind = v; val.article = ""; val.articleEId = ""; peindre(); },
      }));
      if (val.kind === "texte") {
        corps.appendChild(textField({
          label: "Désignation de l'acte visé", value: val.texte, rows: 2,
          placeholder: "ex. l'arrêté préfectoral n° 12-345 du 3 mars 2019",
          help: "Un acte que l'application ne connaît pas ne peut être visé que par son texte : elle ne pourra pas le marquer abrogé.",
          onChange: (v) => { val.texte = v; majApercu(); },
        }));
      } else {
        corps.appendChild(selectField({
          label: "Acte visé au registre", value: val.acteId, placeholder: "— Choisir un acte —",
          options: actes.map((a) => ({
            value: a.id,
            label: [a.numero || "(sans numéro)", a.objet || docCible(a)?.meta?.objet || ""].filter(Boolean).join(" — "),
          })),
          help: actes.length ? "" : "Aucun autre acte au registre pour l'instant : visez alors un acte hors application.",
          onChange: (v) => { val.acteId = v; val.article = ""; val.articleEId = ""; peindre(); },
        }));
        if (val.kind === "article") {
          if (!val.acteId) {
            corps.appendChild(h("p", { class: "fr-small fr-muted", text: "Choisissez d'abord l'acte dont un article est abrogé." }));
          } else {
            const arts = articlesDe(acteDe(val.acteId));
            corps.appendChild(arts.length
              ? selectField({
                label: "Article abrogé", value: val.articleEId || arts.find((x) => x.num === val.article)?.numLabel || "", placeholder: "— Choisir un article —",
                options: arts.map((x) => ({ value: x.eId || x.numLabel, label: `${x.numLabel}${x.heading ? " — " + x.heading : ""}` })),
                onChange: (v) => {
                  const art = arts.find((x) => (x.eId || x.numLabel) === v);
                  val.articleEId = art?.eId || "";
                  val.article = art?.num || "";
                  peindre();
                },
              })
              : h("p", { class: "fr-small fr-muted", text: "Cet acte ne comporte pas d'article repérable dans l'application." }));
          }
        }
      }
      corps.appendChild(textField({
        label: "Réécrire la clause (facultatif)", value: val.clause, rows: 2,
        placeholder: apercuTexte(),
        help: "Laissez vide pour la clause type. Vous pourrez aussi la corriger directement dans le document.",
        onChange: (v) => { val.clause = v; majApercu(); },
      }));
      corps.appendChild(h("div", { class: "fr-alert fr-alert--info" },
        h("p", { class: "fr-alert__title", text: "Clause qui figurera dans l'acte" }),
        (apercuEl = h("p", { class: "fr-small", style: { margin: 0 }, text: apercuTexte() }))));
    }
    peindre();

    modal({
      title: maj ? "Modifier l'abrogation prévue" : "Prévoir une abrogation",
      wide: true,
      body: corps,
      actions: (close) => [
        button("Annuler", { variant: "secondary", onClick: close }),
        button(maj ? "Enregistrer" : "Ajouter", {
          variant: "primary", icon: "check",
          onClick: () => {
            if (val.kind !== "texte" && !val.acteId) { toast("Choisissez l'acte visé.", "warning"); return; }
            if (val.kind === "article" && !val.article) { toast("Choisissez l'article abrogé.", "warning"); return; }
            if (val.kind === "texte" && !String(val.texte).trim()) { toast("Indiquez la désignation de l'acte visé.", "warning"); return; }
            const a = acteDe(val.acteId);
            if (a) {
              val.numero = a.numero || "";
              val.designation = designationDe(a);
              val.date = a.dateSignature || a.values?.dateSignature || "";
              val.eli = a.eli || docCible(a)?.meta?.eli || "";
            }
            const list = (draft.values.__abrogations = draft.values.__abrogations || []);
            const i = entry ? list.indexOf(entry) : -1;
            if (i >= 0) list[i] = val; else list.push(val);
            oublierOverridesAbrogation();
            close();
            redraw();
            toast(maj ? "Abrogation modifiée" : "Abrogation prévue par l'acte", "success");
          },
        }),
      ],
    });
  }

  // ------------------------------------------------------------- utilitaires
  function requiredTodo() {
    return applicableFields().filter((f) => f.required && isEmpty(f, draft.values[f.id])).length;
  }

  function entityPicker() {
    return h("div", { class: "redaction-entity" },
      h("select", {
        class: "fr-select", "aria-label": "Entité concernée",
        on: {
          change: (e) => { draft.values.__entityId = e.target.value; touch("config", { rerender: false }); paintFull(); },
        },
      }, ...(config.entities || [])
        .filter((e) => !trame.entityIds?.length || trame.entityIds.includes(e.id))
        .map((e) => {
          const o = h("option", { value: e.id, text: e.name + (e.code ? " (" + e.code + ")" : "") });
          if (e.id === draft.values.__entityId) o.selected = true;
          return o;
        })),
    );
  }

  // ---------------------------------------------------------------- actions
  // Ce que l'on sait de l'origine du numéro : un numéro venu d'un service
  // externe est rattaché à la ligne qui le porte chez ce service.
  function sourceNumero() {
    const s = draft.numeroSource;
    if (s && s.ref) return `attribué par le service de numérotation (référence ${s.ref})`;
    if (s) return "attribué par le service de numérotation";
    return "Le numéro est attribué par le service, pas par l'application.";
  }

  async function reserveNumber(ev) {
    const btn = ev?.currentTarget;
    const ext = estExterne(config);
    if (ext && draft.values.numero) {
      const ok = await confirmDialog("Redemander un numéro ?",
        "Un nouveau numéro sera demandé au service : la ligne précédente n'est pas retirée, et ce numéro-là reste consommé chez lui. À ne faire que si le numéro actuel n'a pas servi.",
        { confirmLabel: "Redemander" });
      if (!ok) return;
    }
    if (btn) {
      btn.disabled = true;
      btn.appendChild(h("span", { class: "spinner", "aria-hidden": "true" }));
    }
    try {
      const res = await reserverNumero(config, config.entities.find((e) => e.id === draft.values.__entityId), {
        entityId: draft.values.__entityId,
        objet: String(draft.values.objet || "").split("\n")[0],
        date: draft.values.dateSignature || todayIso(),
        trameId: trame.id,
        actTypeId: trame.actTypeId || "",
      });
      draft.values.numero = res.numero;
      draft.numeroSource = res.source === "externe"
        ? { source: "externe", ref: res.ref || "", valeur: res.valeur || "", at: new Date().toISOString(), par: state.user?.id || "", parName: state.user ? fullName(state.user) : "" }
        : null;
      if (res.source === "interne") {
        config.numbering.seq += 1;
        touch("config", { rerender: false });
      }
      paintFull();
      toast("Numéro réservé : " + res.numero, "success");
      // Une attribution externe est un fait : elle sort de l'application et
      // engage une ligne chez le service. Elle entre donc au journal.
      if (res.source === "externe") {
        journaliser({
          action: "numero.attribution_externe",
          cible: "acte",
          cibleLabel: res.numero,
          acteId: draft.acteId || "",
          detail: "attribué par le service de numérotation" + (res.ref ? ` (référence ${res.ref})` : ""),
          to: [],
        });
      }
    } catch (e) {
      if (btn) { btn.disabled = false; btn.querySelector(".spinner")?.remove(); }
      toast(String((e && e.message) || e), "error");
    }
  }
  rx.reserveNumber = reserveNumber;

  function save() {
    const nouveau = !draft.acteId;
    doc = compile(trame, draft.values, config);
    const blocking = doc.issues.filter((i) => i.level === "blocking").length;
    const now = new Date().toISOString();
    const ecarts = doc.ecarts.map((e) => {
      const l = locateAddr(doc, e.addr);
      return { addr: e.addr, label: [l.area, l.label].filter(Boolean).join(" · "), original: e.original, current: e.current };
    });
    if (draft.acteId) {
      const a = state.actes.find((x) => x.id === draft.acteId);
      // Historique des brouillons : on archive l'état PRÉCÉDENT avant de
      // l'écraser — à condition qu'il ait réellement changé (enregistrer deux
      // fois de suite sans rien modifier n'a pas à encombrer l'historique).
      const change = JSON.stringify(a.values || {}) !== JSON.stringify(draft.values)
        || JSON.stringify(a.overrides || {}) !== JSON.stringify(overrides);
      if (change) ajouterRevision(a, { label: "Enregistrement", by: state.user?.id || "", byName: state.user ? fullName(state.user) : "" });
      Object.assign(a, {
        values: structuredClone(draft.values), statut: blocking ? "brouillon" : "pret",
        updatedAt: now, issues: doc.issues, eli: doc.meta.eli,
        overrides: structuredClone(overrides), ecarts,
        numero: draft.values.numero || "", objet: draft.values.objet || "",
        numeroSource: draft.numeroSource || null,
        serviceId: trame.serviceId || "", bureauId: trame.bureauId || "",
        createdBy: a.createdBy || state.user?.id || "",
        createdByName: a.createdByName || (state.user ? fullName(state.user) : ""),
      });
    } else {
      const acte = {
        id: uid("acte"),
        trameId: trame.id,
        trameName: trame.name,
        serviceId: trame.serviceId || "",
        bureauId: trame.bureauId || "",
        numero: draft.values.numero || "",
        objet: draft.values.objet || "",
        numeroSource: draft.numeroSource || null,
        entityId: draft.values.__entityId,
        dateSignature: draft.values.dateSignature || "",
        statut: blocking ? "brouillon" : "pret",
        createdAt: now,
        updatedAt: now,
        createdBy: state.user?.id || "",
        createdByName: state.user ? fullName(state.user) : "",
        values: structuredClone(draft.values),
        overrides: structuredClone(overrides),
        ecarts,
        issues: doc.issues,
        eli: doc.meta.eli,
      };
      state.actes.push(acte);
      draft.acteId = acte.id;
      draft.fresh = false;
      // Le brouillon ouvre désormais l'acte qu'il vient de créer : sans cela, le
      // redessin qui suit l'enregistrement repartirait d'une page blanche (voir
      // `needInit` plus haut), et le rédacteur croirait son texte perdu.
      state.ui = { ...(state.ui || {}), openActeId: acte.id };
    }
    touch("actes", { rerender: false });
    // Le journal garde la trace de chaque enregistrement — sans notifier
    // personne : enregistrer son propre travail ne concerne que soi.
    journaliser({
      action: nouveau ? "acte.creation" : "acte.enregistrement",
      cible: "acte",
      cibleLabel: draft.values.numero || draft.values.objet || "acte sans numéro",
      acteId: draft.acteId,
      detail: [
        blocking ? "enregistré malgré " + blocking + " contrôle(s) bloquant(s)" : "prêt à exporter",
        ecarts.length ? ecarts.length + " écart(s) à la trame" : "",
      ].filter(Boolean).join(" · "),
      to: [],
    });
    toast(ecarts.length ? `Acte enregistré (${ecarts.length} écart(s) signalé(s))` : "Acte enregistré", "success");
    redraw();
  }

  function exportMenu() {
    doc = compile(trame, draft.values, config);
    const blocking = doc.issues.filter((i) => i.level === "blocking");
    const base = (draft.values.numero || trame.id).replace(/[^\w-]+/g, "_");
    const body = h("div", { class: "fr-stack" });
    if (blocking.length) {
      body.appendChild(h("div", { class: "fr-alert fr-alert--error" },
        h("p", { class: "fr-alert__title", text: "Export bloqué par les contrôles" }),
        ...blocking.map((b) => h("p", { class: "fr-small", text: "• " + b.message }))));
    }
    if (doc.ecarts.length) {
      body.appendChild(h("div", { class: "fr-alert fr-alert--warning" },
        h("p", { class: "fr-alert__title", text: `${doc.ecarts.length} écart(s) à la trame` }),
        h("p", { class: "fr-small", text: "Ces passages ont été réécrits. Ils n'empêchent pas l'export et restent visibles par les administrateurs." })));
    }
    const row = (label, fn) => button(label, { variant: "secondary", disabled: !!blocking.length, onClick: () => fn() });
    body.appendChild(h("div", { class: "fr-row" },
      row("Akoma Ntoso (.akn.xml)", () => download(base + ".akn.xml", exportAkn(doc, config, trame), "application/xml")),
      row("Schematron (.sch)", () => download(base + ".sch", exportSchematron(doc, config, trame), "application/xml")),
    ));
    body.appendChild(h("div", { class: "fr-row" },
      row("HTML complet", () => download(base + ".html", exportStandaloneHtml(doc, config, trame), "text/html")),
      row("JSON-LD (ELI)", () => download(base + ".jsonld", exportJsonLd(doc, config), "application/ld+json")),
      row("Markdown", () => download(base + ".md", exportMarkdown(doc, config), "text/markdown")),
    ));
    body.appendChild(h("div", { class: "fr-row" },
      row("Imprimer / PDF", () => printDocument(doc, config, trame)),
      row("Word (.doc)", () => download(base + ".doc", exportWordDoc(doc, config, trame), "application/msword")),
      row("Acte (JSON)", () => download(base + ".acte.json", JSON.stringify({
        kind: "acte",
        trame: { id: trame.id, version: trame.version },
        values: draft.values,
        overrides,
        ecarts: doc.ecarts.map((e) => ({ addr: e.addr, label: e.label, original: e.original, current: e.current })),
        meta: doc.meta, issues: doc.issues, notes: doc.notes,
      }, null, 2))),
    ));
    modal({ title: "Exporter l'acte", body, actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })] });
  }

  rx.save = save;
  rx.exportMenu = exportMenu;
}

// --------------------------------------------------------------------------
function isEmpty(f, v) {
  if (v == null || v === "") return true;
  if (Array.isArray(v) && !v.length) return true;
  if (f?.type === "boolean") return false;
  return false;
}

function freshDraft(trame) {
  // L'entité par défaut : la première que la trame autorise (une trame
  // d'établissement n'a qu'une entité possible).
  const permises = (state.config.entities || []).filter((e) => !trame.entityIds?.length || trame.entityIds.includes(e.id));
  const entityId = permises[0]?.id || state.config.entities?.[0]?.id || "";
  return {
    trameId: trame.id,
    acteId: null,
    fresh: true,
    values: {
      __entityId: entityId,
      __overrides: {},
      // Les abrogations prévues par l'acte : des cibles (acte ou article du
      // registre, ou texte libre) que l'application appliquera le jour de
      // l'entrée en vigueur — voir src/lib/abrogations.js.
      __abrogations: [],
      dateSignature: new Date().toISOString().slice(0, 10),
    },
  };
}
