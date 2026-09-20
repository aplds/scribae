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
  journaliser, circuitDe, signalerRedaction, libererRedaction, quiRedige,
} from "../state.js";
import { fullName } from "../../lib/users.js";
import { ajouterRevision } from "../../lib/revisions.js";
import { demarrerValidation, etapeActive, validationAJour, VALIDATION_STATUTS } from "../../lib/validation.js";
import { h, clear, button, icon, toast, modal, fitPaper } from "../dom.js";
import { compile, interpolate, nextNumero } from "../../lib/compile.js";
import { applyPaper } from "../../lib/render.js";
import { exportAkn, exportSchematron, exportJsonLd, exportMarkdown, exportStandaloneHtml, exportWordDoc, printDocument } from "../../lib/export.js";
import { download, uid, debounce, formatDate } from "../../lib/util.js";
import { helpLink, emptyState, sectionHeader, statusBadge, acteStatutLabel, acteStatutColor, isDraftable } from "../components.js";
import { targetLabel } from "../../lib/scope.js";
import { tramePublishable } from "../../lib/schema.js";
import { safeEval } from "../../lib/expr.js";
import { listSlots, locateAddr, fieldIdsInText } from "../../lib/redaction.js";
import { buildRedactionDoc, controlFor, focusFieldWidget, hiddenPassages, bindConfig, closeTokenEditor } from "./wysiwyg.js";

export function openActe(acte) {
  state.ui = state.ui || {};
  state.ui.openActeId = acte.id;
  navigate("rediger/" + acte.trameId);
}

// Repartir d'une page blanche (appelé par les entrées « Rédiger » du menu).
// Seul le brouillon est oublié : les autres réglages d'interface (filtres des
// listes, recherche de trame…) sont conservés.
export function resetDraft() {
  state.rediger = null;
  state.ui = { ...(state.ui || {}), openActeId: null };
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
        h("td", {}, h("span", { class: "fr-badge fr-badge--" + acteStatutColor(a.statut), text: acteStatutLabel(a.statut) })),
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
  const existing = openId ? state.actes.find((a) => a.id === openId) : null;

  const needInit = !state.rediger
    || state.rediger.trameId !== trame.id
    || (existing && state.rediger.acteId !== existing.id)
    || (!existing && state.rediger.acteId && !state.rediger.fresh);
  if (needInit) {
    state.rediger = existing
      ? { trameId: trame.id, acteId: existing.id, values: structuredClone(existing.values || {}), statut: existing.statut }
      : freshDraft(trame);
  }
  const draft = state.rediger;
  const config = state.config;
  // Verrou souple : on annonce l'acte en cours de rédaction au reste de
  // l'installation (voir src/lib/collab.js). Posé à l'entrée, relâché à la
  // sortie de l'écran (drawView) — un poste fermé net est oublié au bout de
  // 70 secondes.
  if (draft.acteId) signalerRedaction(draft.acteId, draft.values.numero || draft.values.objet || "");
  bindConfig(config);
  draft.values.__overrides = draft.values.__overrides || {};
  const overrides = draft.values.__overrides;
  const sources = new Map(listSlots(trame, config).map((s) => [s.addr, s.original]));
  const fieldsInText = fieldIdsInText(trame);
  const ui = (draft.ui = draft.ui || { tab: "completer", showAll: false });
  let counterEls = null;

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
  }

  // Où en est l'acte dans le circuit de validation : c'est une information de
  // premier plan pour le rédacteur — il saura s'il doit relancer un valideur, et
  // surtout que modifier un acte validé remet le circuit en jeu.
  function paintParapheur() {
    const el = root.querySelector("#rediger-parapheur");
    if (!el) return;
    clear(el);
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
    tabsBar.replaceChildren();
    for (const t of [
      { id: "completer", label: "À compléter" + (nbTodo ? ` (${nbTodo})` : "") },
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
      row.appendChild(h("div", { class: "fr-row", style: { marginBottom: "6px" } },
        button("Réserver le prochain numéro", { variant: "tertiary", size: "sm", icon: "check", onClick: reserveNumber }),
      ));
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
  function reserveNumber() {
    draft.values.numero = nextNumero(config, config.entities.find((e) => e.id === draft.values.__entityId));
    config.numbering.seq += 1;
    touch("config", { rerender: false });
    paintFull();
    toast("Numéro réservé : " + draft.values.numero, "success");
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
  const entityId = state.config.entities?.[0]?.id;
  return {
    trameId: trame.id,
    acteId: null,
    fresh: true,
    values: {
      __entityId: entityId,
      __overrides: {},
      dateSignature: new Date().toISOString().slice(0, 10),
    },
  };
}
