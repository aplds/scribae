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
  revisionPour, revisionRequisePour,
} from "../state.js";
import { fullName } from "../../lib/users.js";
import { ajouterRevision } from "../../lib/historique-brouillons.js";
import { circuitFor, etapeActive, validationAJour, VALIDATION_STATUTS } from "../../lib/validation.js";
import { soumettreCircuit } from "../parapheur-actions.js";
import { etatRevision } from "../../lib/revision.js";
import { h, clear, button, icon, toast, modal, fitPaper } from "../dom.js";
import { cadreZoom } from "../zoom.js";
import { compile, interpolate } from "../../lib/compile.js";
import { applyPaper, personSignatureName, renderDocument } from "../../lib/render.js";
import { styleForDoc } from "../../lib/styles.js";
import { lignesQualites, decisionsDeSignature } from "../../lib/delegations.js";
import { exportAkn, exportSchematron, exportJsonLd, exportMarkdown, exportStandaloneHtml, exportWordDoc, printDocument } from "../../lib/export.js";
import { boutonsPdfA } from "../pdfa.js";
import { download, uid, debounce, formatDate, todayIso, normalizeSpace } from "../../lib/util.js";
import { helpLink, emptyState, sectionHeader, acteStatutLabel, acteStatutColor, isDraftable, confirmDialog, selectField, textField, choiceField, abrogationBadge } from "../components.js";
import { targetLabel } from "../../lib/scope.js";
import { tramePublishable, natureDe, NODE_MAP, newNode, ladderOf, paramsBloc, choixDe, PARA_ALIGNS, PARA_INDENTS, LIST_MARKERS, LIST_NUMBERINGS, TABLE_LAYOUTS, TABLE_ALIGNS, TABLE_CAPTION_POS, RECITAL_FINS } from "../../lib/schema.js";
import { estExterne, reserverNumero, fixerSequence } from "../../lib/numbering.js";
import { safeEval } from "../../lib/expr.js";
import { listSlots, locateAddr, fieldIdsInText, valeurReglage } from "../../lib/redaction.js";
import { abrogationVocab, clauseAbrogation, cibleTexte, KINDS, designationDe as designationDeActe } from "../../lib/abrogations.js";
import { entreeEnVigueur } from "../../lib/execution.js";
import { buildRedactionDoc, controlFor, focusFieldWidget, focusNodeWidget, hiddenPassages, bindConfig, closeTokenEditor } from "./wysiwyg.js";
import { AUTO_TOKENS } from "../../lib/auto-tokens.js";
import { annotationStrip, notesByPath, countNotes } from "../annotations.js";
import { signerPicker } from "../signer-picker.js";
import { champFonction, roleDeFonction } from "../../lib/fonctions.js";
import { ordresModifies, rangerCommeLaTrame, ordreConteneur, rangDe, deplacerVers, aOrdre } from "../../lib/ordre.js";
import {
  ajoutsDe, ajouterA, ajoutPour, retirerAjoutPour, suppressions, supprimer, retablir, slotsAjoutes, majAjout,
} from "../../lib/structure.js";
import { glissable } from "../dnd.js";
import { trameEstDisponible } from "../mise-a-disposition.js";
import { natureOfActe, identification, annexesVocab, libelleAnnexe, appellationAnnexe, numeroAffiche } from "../../lib/annexes.js";
import { annexesJointes, libellePartAnnexe } from "../../lib/annexe-docs.js";

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

  const trames = visibleTrames().filter(trameEstDisponible);
  const actes = visibleActes();
  // La rédaction en cours est cherchée dans TOUTES les trames visibles, pas
  // seulement celles qui sont à disposition : si le modèle a été retiré entre
  // temps, celui qui écrivait doit pouvoir finir son acte.
  const enCours = state.rediger ? visibleTrames().find((t) => t.id === state.rediger.trameId) : null;

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
        h("td", { class: "fr-mono", text: numeroAffiche(a, state.config, state.trames) || "—" }),
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
        ? "Aucune trame n'est proposée à votre périmètre (service et bureaux). Un modèle n'apparaît ici qu'une fois MIS À DISPOSITION par un administrateur : si vous attendiez une trame, demandez-lui de l'ouvrir."
        : "Aucune trame pour l'instant.",
      can("trames.gerer") ? button("Voir les trames", { variant: "primary", icon: "doc", onClick: () => navigate("trames") }) : button("Lire le guide", { variant: "secondary", icon: "info", onClick: () => navigate("aide/demarrer") })));
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
  const commentaires = countNotes(t.body);
  const regles = (t.rules || []).length;
  return h("div", { class: "fr-card fr-card--pied" },
    h("div", { class: "fr-row" },
      // Pas de pastille de statut ici : cette liste ne contient QUE des trames
      // mises à disposition (voir renderChooser) — elle serait la même partout.
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto" }, text: t.name }),
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
  const trame = visibleTrames().find((t) => t.id === params.id);
  if (!trame) {
    root.appendChild(emptyState(
      "Cette trame ne vous est pas accessible : elle n'existe plus, ou elle relève d'un autre service.",
      button("Choisir une trame", { variant: "primary", onClick: () => { resetDraft(); navigate("rediger"); } })));
    return;
  }
  state.ui = state.ui || {};
  const openId = params.id ? state.ui.openActeId : null;
  // L'acte repris doit être CELUI de la trame ouverte : une trame changée (ou
  // une adresse suivie à la main) ne doit pas charger les valeurs d'un autre
  // acte sous une autre trame.
  const existing = openId ? state.actes.find((a) => a.id === openId && a.trameId === trame.id) : null;

  // Un brouillon n'est pas ouvert à la rédaction : c'est la règle générale de
  // l'application (le modèle n'est proposé qu'une fois mis à disposition). Trois
  // exceptions, et elles comptent : un éditeur doit pouvoir essayer son modèle
  // avant de l'ouvrir aux services ; une rédaction DÉJÀ COMMENCÉE garde l'accès
  // (retirer la trame sous les pieds de celui qui écrit serait absurde) ; et
  // rouvrir un ACTE enregistré — depuis le parapheur, la révision ou la file de
  // signature — doit rester possible, même si le modèle a été retiré entre-temps.
  const dejaCommencee = state.rediger?.trameId === trame.id || !!existing;
  if (!trameEstDisponible(trame) && !can("trames.gerer") && !dejaCommencee) {
    root.appendChild(h("div", { class: "fr-alert fr-alert--warning" },
      h("p", { class: "fr-alert__title", text: "Cette trame n'est pas encore disponible" }),
      h("p", { class: "fr-small", text: `« ${trame.name} » est encore en brouillon : elle sera proposée à la rédaction dès qu'un administrateur l'aura mise à disposition.` }),
      h("div", { style: { marginTop: "8px" } },
        button("Choisir une autre trame", { variant: "primary", onClick: () => { resetDraft(); navigate("rediger"); } }))));
    return;
  }

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
  // Les emplacements des blocs et éléments AJOUTÉS (voir lib/structure.js) : ils
  // sont éditables comme les autres, mais leur origine est l'ajout lui-même —
  // sans quoi leur texte serait signalé comme un écart à une trame qui ne le
  // contient pas.
  for (const s of slotsAjoutes(draft.values)) sources.set(s.addr, s.original);
  const fieldsInText = fieldIdsInText(trame);
  // `ui.selPath` : l'adresse du bloc désigné — cliquer un bloc ouvre ses
  // options dans l'onglet « Bloc ». Une adresse périmée est simplement ignorée
  // (voir `paintBloc`). `ui.arme` : la variable cliquée dans la bibliothèque,
  // en attente d'un clic dans le texte (le repli du glisser-déposer).
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

  // Le document du brouillon, et les documents qu'il ANNEXE : l'original de
  // l'acte qui les adopte est suivi de leur texte, et c'est ici qu'on les
  // résout — le registre est sous la main (voir src/lib/annexe-docs.js). Ils
  // sont joints à chaque compilation, donc aux exports comme à l'écran.
  const compileDoc = () => {
    const d = compile(trame, draft.values, config, { markMissing: true });
    const joints = annexesJointes(draft.values, {
      actes: state.actes, trames: state.trames, config, acteId: draft.acteId || "",
    });
    if (joints.length) d.annexeDocs = joints;
    return d;
  };
  let doc = compileDoc();

  // ---------------------------------------------------------- publication
  const redraw = () => redrawView();
  const rx = {
    trame, config, values: draft.values, overrides, sources,
    get doc() { return doc; },
    get selPath() { return ui.selPath || null; },
    get arme() { return ui.arme || null; },
    setField(id, value) { draft.values[id] = value; },
    markDirty() {},
    paintSoon: debounce(() => paintPaper(), 130),
    paintPanelSoon: debounce(() => paintStatus(), 200),
    paintFull: () => { closeTokenEditor(); redraw(); },
    // Cliquer un bloc : on le désigne dans le panneau, SANS redessiner la page
    // (le curseur de saisie reste où il est). Seul le panneau se rafraîchit.
    selectBlock: (path) => selectBlock(path),
    desarmer: () => { ui.arme = null; paintPalette(); },
    // Retirer un bloc (ou un élément) du document — jamais de la trame.
    supprimer: (addr) => supprimerAdresse(addr),
    // Ajouter un élément à une liste (visa, considérant, item).
    ajouterElement: (nodePath, refAddr) => ajouterElement(nodePath, refAddr),
    // Ajouter un bloc après un bloc existant.
    menuAjout: (anchor, containerPath, rang, position) => menuAjout(anchor, containerPath, rang, position),
    // Ce qui est saisi dans un bloc AJOUTÉ vit dans l'ajout, pas dans les écarts.
    onCommit: (addr, src) => {
      if (majAjout(draft.values, addr, src)) {
        delete overrides[addr];
        sources.set(addr, src);
      }
    },
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
      // L'action mise en avant est le PROCHAIN PAS du parcours (soumettre au
      // circuit, aller à la signature…), pas l'export : exporter est un geste
      // de sortie, à faire en fin de course, et le mettre en avant laissait
      // croire au rédacteur novice que son acte était terminé une fois exporté.
      h("span", { id: "rediger-suite" }),
      button("Exporter…", { variant: "tertiary", icon: "download", title: "Imprimer, transmettre ou archiver l'acte — ce n'est pas la fin du parcours : un acte se valide, se signe et se publie.", onClick: () => exportMenu() }),
    ),
  ));

  // Le parcours de l'acte, en une ligne : où en est-on, et quelle est la suite.
  // C'est ce qui répond à la question « et maintenant, je fais quoi ? » — le
  // rédacteur novice ne devine pas que le circuit, puis la signature, puis la
  // publication s'enchaînent après la rédaction.
  const parcours = h("div", { class: "rx-parcours", id: "rediger-parcours" });
  root.appendChild(parcours);

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
  const paper = h("div", { class: "paper paper--edit" });
  paper.style.fontFamily = config.brand.documentFont || "";
  // Le document est un CANVAS : la molette (Ctrl) ou la barre règle le cran, et
  // le fond se déplace au curseur — voir src/ui/zoom.js.
  const paperBox = cadreZoom(paper, { mode: "feuille", cle: "redaction", classe: "paper-box" });
  docCol.appendChild(annexeCard());
  docCol.appendChild(paperBox);
  // Le TEXTE des documents annexés : il suit l'acte, mais il ne se rédige pas
  // ici — il vit dans son propre acte, où l'on va le corriger. On le montre donc
  // en lecture seule, sous le document, à la place où il sera imprimé.
  const annexesBox = h("div", { class: "rx-annexes-doc" });
  docCol.appendChild(annexesBox);
  docCol.appendChild(annexesCard());

  // -------------------------------------------------------- colonne panneau
  const sideCol = h("div", { class: "fr-stack redaction-col--side" });
  cols.appendChild(sideCol);
  // La bibliothèque de variables reste OUVERTE au-dessus des onglets : insérer
  // un champ ne doit jamais demander d'abord d'aller le chercher ailleurs. On
  // la glisse dans le document — ou on la clique, puis on clique dans le texte.
  const varChips = h("div", { class: "var-lib__chips" });
  const varSearch = h("input", {
    class: "fr-input var-lib__search", type: "search", placeholder: "Chercher une variable…",
    on: { input: (e) => { ui.rechercheVar = e.target.value; paintPalette(); } },
  });
  const paletteCard = h("details", { class: "fr-card var-lib", open: true },
    h("summary", { class: "var-lib__head" }, icon("palette", 15),
      h("span", { class: "var-lib__title", text: "Variables" }),
      h("span", { class: "var-lib__aide", text: "à glisser dans le document" })),
    varSearch,
    varChips,
  );
  sideCol.appendChild(paletteCard);

  const tabsBar = h("div", { class: "fr-tabs", style: { marginBottom: "0" } });
  const panelBody = h("div", { class: "fr-card", id: "redaction-panel" });
  sideCol.appendChild(tabsBar);
  sideCol.appendChild(panelBody);

  // Le premier rendu vient APRÈS toutes les déclarations du corps de la
  // fonction : `paintBloc` et la bibliothèque lisent des constantes définies
  // plus bas (`TYPE_NOMS`, `ELEMENT_VIDE`…) — les appeler ici les prendrait
  // dans leur zone morte. Voir la fin de `renderRediger`.

  // ------------------------------------------------------------------ rendu
  function paintPaper() {
    doc = compileDoc();
    majSourcesAbrogations();
    clear(paper);
    applyPaper(paper, doc, config);
    paper.appendChild(buildRedactionDoc(rx));
    paintAnnexesParts();
    paintBadge();
  }

  // Le texte des documents ANNEXÉS, en lecture seule, à la suite du document :
  // l'original signé de l'acte les porte dans cet ordre exact (voir
  // src/lib/annexe-docs.js). On ne les rédige pas ici — ils ont leur propre
  // acte, et ils changeront là-bas, pas dans une copie.
  function paintAnnexesParts() {
    clear(annexesBox);
    const joints = doc.annexeDocs || [];
    if (!joints.length) return;
    for (const joint of joints) {
      const box = h("div", { class: "paper-box rx-annexe-paper" });
      box.dataset.annexeId = joint.acte.id;
      const bandeau = h("div", { class: "rx-annexe-paper__bandeau" },
        h("span", { class: "rx-annexe-paper__label", text: annexesVocab(config).label || "Annexe" }),
        h("span", { class: "rx-annexe-paper__titre", text: joint.libelle }),
        h("span", { class: "fr-spacer" }),
        button("Ouvrir l'annexe dans son acte", {
          variant: "tertiary", size: "sm", icon: "eye",
          onClick: () => navigate("acte/" + joint.acte.id),
        }),
      );
      box.appendChild(bandeau);
      box.appendChild(h("p", { class: "rx-annexe-paper__note fr-small fr-muted",
        text: "Ce texte n'est pas rédigé ici : il suit son acte dans l'original signé, sans signature propre." }));
      const feuille = h("div", { class: "paper paper--lecture" });
      const style = applyPaper(feuille, joint.doc, config, { style: styleForDoc(config, doc) });
      feuille.appendChild(renderDocument(joint.doc, config, {
        showNotes: false, showTrail: false, annexes: false, sansSignature: true, style,
      }));
      box.appendChild(feuille);
      annexesBox.appendChild(box);
      requestAnimationFrame(() => fitPaper(box, feuille));
    }
  }

  function paintStatus() {
    // Le texte peut avoir été réécrit depuis le dernier rendu de la page : on
    // recalcule le document pour que compteurs, écarts et contrôles soient justes.
    doc = compileDoc();
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
    // Les consignes laissées par la trame : un bouton, à côté de l'état de
    // l'acte, pour qu'elles ne se perdent pas dans le fil de la lecture.
    const nbNotes = (doc.notes || []).length;
    if (nbNotes) {
      el.appendChild(h("button", {
        class: "fr-badge fr-badge--info", type: "button",
        style: { marginLeft: "6px", cursor: "pointer" },
        title: "Commentaires laissés par les administrateurs dans la trame — cliquez pour les lire",
        text: `${nbNotes} consigne${nbNotes > 1 ? "s" : ""} de la trame`,
        onClick: () => { ui.tab = "consignes"; redraw(); },
      }));
    }
    paintParapheur();
    paintRevision();
    paintParcours();
    paintSuite();
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
    // Aucun circuit applicable : rien à dire au rédacteur.
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

  // ------------------------------------------------------------- parcours
  // Où en est l'acte, et quelle est la suite. Un acte suit toujours le même
  // chemin — on le rédige, on le soumet au circuit, un réviseur le contrôle
  // quand la collectivité l'exige, on le signe, on le publie — mais ce chemin
  // n'est pas visible dans l'écran de rédaction : le rédacteur devait le
  // connaître par cœur. Cette ligne le lui montre, et met en avant le geste à
  // faire maintenant (voir `paintSuite`, qui pose le bouton dans l'en-tête).
  function parcoursDe(acte) {
    const circuit = acte ? circuitDe(acte) : circuitFor(state.config, { trame });
    const v = acte?.validation;
    const valide = !!(v && validationAJour(acte) && v.statut === "valide");
    const signe = !!(acte && (acte.original || ["signee", "publie", "en_attente"].includes(acte.statut || "")));
    const publie = !!(acte && (acte.publication || acte.statut === "publie"));
    const rev = acte ? revisionPour(acte) : { requise: false };
    const etapes = [
      { cle: "rediger", label: "Rédiger", fait: !!acte, hint: acte ? "" : "en cours d'écriture" },
    ];
    if (circuit) etapes.push({ cle: "circuit", label: "Soumettre au circuit", fait: valide, hint: circuit.label });
    if (rev.requise) etapes.push({ cle: "revision", label: "Révision", fait: acte?.revision?.statut === "valide", hint: "contrôle avant signature" });
    etapes.push({ cle: "signer", label: "Signer", fait: signe, hint: "" });
    if (tramePublishable(trame)) etapes.push({ cle: "publier", label: "Publier", fait: publie, hint: "recueil des actes" });
    // La première étape non faite est celle où l'on se trouve ; les suivantes
    // sont à venir. Si tout est fait, il n'y a plus d'étape en cours.
    let encours = false;
    for (const e of etapes) {
      if (e.fait) e.etat = "fait";
      else if (!encours) { e.etat = "encours"; encours = true; }
      else e.etat = "avenir";
    }
    return etapes;
  }

  function paintParcours() {
    const el = root.querySelector("#rediger-parcours");
    if (!el) return;
    clear(el);
    const acte = draft.acteId ? state.actes.find((x) => x.id === draft.acteId) : null;
    const etapes = parcoursDe(acte);
    const liste = h("ol", { class: "rx-parcours__liste" });
    etapes.forEach((e, i) => {
      liste.appendChild(h("li", {
        class: "rx-parcours__etape rx-parcours__etape--" + e.etat,
        title: e.hint || "",
      },
        h("span", { class: "rx-parcours__puce" }, h("span", { class: "rx-parcours__num", text: String(i + 1) })),
        h("span", { class: "rx-parcours__label", text: e.label }),
      ));
    });
    el.appendChild(liste);
    // Ce que le rédacteur doit retenir, en une phrase : l'export n'est pas la
    // fin du parcours.
    const libelle = h("span", { class: "rx-parcours__note" });
    const faites = etapes.filter((e) => e.etat === "fait").length;
    if (faites === etapes.length) {
      libelle.textContent = "Parcours terminé : l'acte est signé" + (tramePublishable(trame) ? " et publié au recueil." : " et conservé au registre.");
    } else {
      const courante = etapes.find((e) => e.etat === "encours");
      libelle.textContent = "Étape en cours : " + (courante?.label || "") + ". Exporter sert à imprimer ou transmettre l'acte — ce n'est pas la fin du parcours.";
    }
    el.appendChild(libelle);
  }

  // Le bouton mis en avant dans l'en-tête : le prochain geste, et lui seul.
  // Ailleurs, les gestes utiles sont déjà là (enregistrer, exporter) ; ici on
  // répond à « je fais quoi maintenant ? ».
  function paintSuite() {
    const el = root.querySelector("#rediger-suite");
    if (!el) return;
    clear(el);
    const acte = draft.acteId ? state.actes.find((x) => x.id === draft.acteId) : null;
    if (!acte) return;
    const circuit = circuitDe(acte);
    const v = acte.validation;
    if (!v && circuit) {
      el.appendChild(button("Soumettre au circuit", {
        variant: "primary", icon: "upload",
        title: `Circuit « ${circuit.label} » : ${circuit.steps.length} étape(s)`,
        onClick: () => soumettre(acte),
      }));
      return;
    }
    if (validationAJour(acte) && v?.statut === "valide" && can("actes.signer")) {
      const signe = acte.original || ["signee", "publie", "en_attente"].includes(acte.statut || "");
      el.appendChild(button(signe ? "Signature et publication" : "Aller à la signature", {
        variant: "primary", icon: "lock",
        title: signe ? "Signer puis publier l'acte" : "Le circuit est validé : l'acte passe à la signature",
        onClick: () => { state.signature = { tab: "circuit", acteId: acte.id }; navigate("signature"); },
      }));
    }
  }

  // Soumettre l'acte au circuit : on enregistre d'abord (le circuit porte sur le
  // texte enregistré, pas sur les frappes en cours), puis on ouvre le circuit.
  // Le geste lui-même est partagé avec le parapheur et la fiche de l'acte
  // (src/ui/parapheur-actions.js) : une seule façon de journaliser le dépôt et
  // de prévenir l'étape ouverte, quel que soit l'écran d'où l'on part.
  async function soumettre(acte) {
    const circuit = circuitDe(acte);
    if (!circuit) { toast("Aucun circuit ne s'applique à cet acte.", "warning"); return; }
    save();
    await soumettreCircuit(acte, circuit, { paint: redraw });
  }

  // ------------------------------------------------------ annexes & adoption
  // Une ANNEXE est un document ADOPTÉ par un autre — un règlement intérieur
  // adopté par une délibération, un tableau tarifaire adopté par une décision.
  // L'annexe NE SE SIGNE PAS : c'est l'acte d'adoption qui est signé, et c'est
  // sa signature qui donne à l'annexe son autorité. L'original de l'acte
  // d'adoption est donc SUIVI du document annexé, dans le même document, à la
  // suite de la signature (voir src/lib/annexe-docs.js). Les deux gestes sont
  // symétriques, et se font ici :
  //
  //   • dans l'annexe, on désigne l'ACTE D'ADOPTION — dont le visa s'ajoute de
  //     lui-même en tête des visas (« Vu la délibération n°… du …, qui
  //     l'adopte ») ;
  //   • dans l'acte qui adopte, on annonce les documents ANNEXÉS — ils sont
  //     listés à la fin du dispositif, et leur texte suit l'acte.
  //
  // Ce qu'on fige ici, c'est l'IDENTIFICATION de l'autre acte (numéro, nature,
  // date, adresse de recueil), non l'acte lui-même : sa fiche reste la source
  // vivante. Voir src/lib/annexes.js.
  function designationDeActe(a) {
    const tr = state.trames.find((x) => x.id === a?.trameId);
    return (config.actTypes || []).find((x) => x.id === tr?.actTypeId)?.label || a?.designation || "";
  }
  // Déclarées en fonctions (et non en `const`) : `annexeCard()` est appelée dès
  // la construction de la colonne du document, plus haut dans ce rendu.
  function candidatsAdoption() { return state.actes.filter((a) => !a.deletedAt && natureOfActe(a, state.trames) !== "annexe"); }
  function candidatsAnnexes() { return state.actes.filter((a) => !a.deletedAt && natureOfActe(a, state.trames) === "annexe"); }
  function libelleActe(a) {
    // Une annexe n'a pas de numéro : on la nomme par la décision qui l'adopte.
    if (natureOfActe(a, state.trames) === "annexe") return appellationAnnexe(a, config) + (a.objet ? " — " + a.objet : "");
    return `${designationDeActe(a) || "Acte"} n° ${a.numero || "(sans numéro)"}${a.objet ? " — " + a.objet : ""}`;
  }

  function annexeCard() {
    if (natureDe(trame) !== "annexe") return h("span", { hidden: true });
    const box = h("div", { class: "fr-card fr-card--soft rx-annexe" });
    box.appendChild(h("p", { class: "rx-annexe__titre",
      text: "Annexe — ce document ne se signe pas et ne porte pas de numéro propre : il s'identifie par la décision qui l'adopte, et son texte suit cet acte dans le même document." }));
    box.appendChild(selectField({
      label: "Acte d'adoption",
      value: draft.values.__adoption?.acteId || "",
      placeholder: "— À désigner (document non encore adopté) —",
      options: candidatsAdoption().map((a) => ({ value: a.id, label: libelleActe(a).slice(0, 130) })),
      help: "L'acte qui adopte ce document, et dont il tient son autorité : c'est lui qui est signé, et son original est suivi de ce texte. Il est rappelé en tête des visas. Laissez vide tant que l'adoption n'est pas décidée.",
      onChange: (v) => {
        const a = state.actes.find((x) => x.id === v);
        draft.values.__adoption = a ? identification(a, designationDeActe(a)) : null;
        toast(a ? "Acte d'adoption enregistré" : "Acte d'adoption retiré", "success");
        redraw();
      },
    }));
    return box;
  }

  function annexesCard() {
    if (natureDe(trame) === "annexe") return h("span", { hidden: true });
    const list = draft.values.__annexes || [];
    const box = h("div", { class: "fr-card fr-card--soft rx-annexes" },
      h("div", { class: "fr-row" },
        h("strong", { class: "fr-small", text: annexesVocab(config).sectionTitle }),
        h("span", { class: "fr-spacer" }),
        button("Joindre une annexe", { variant: "secondary", size: "sm", icon: "plus", onClick: joindreAnnexe })),
      h("p", { class: "fr-small fr-muted", style: { margin: "2px 0 6px" }, text: list.length
        ? "Ces documents sont annexés à l'acte : ils sont annoncés à la fin de son dispositif, et leur texte suit l'acte dans l'original signé. Ils ne sont ni signés ni publiés pour eux-mêmes."
        : "Aucun document annexé. Un règlement intérieur adopté par une délibération, un tableau tarifaire adopté par une décision : joignez-les ici." }),
    );
    list.forEach((a, i) => {
      box.appendChild(h("div", { class: "fr-row rx-annexe__ligne" },
        h("span", { class: "fr-small", text: libelleAnnexe(a, config) + (a.objet ? " — " + a.objet : "") }),
        h("span", { class: "fr-spacer" }),
        button("Voir dans le document", { variant: "tertiary", size: "sm", icon: "eye",
          title: "Aller au texte de cette annexe, à la suite du document",
          onClick: () => {
            const part = annexesBox.querySelector(`[data-annexe-id="${a.acteId}"]`);
            if (part) part.scrollIntoView({ behavior: "smooth", block: "start" });
            else toast("Le texte de cette annexe n'est pas disponible : son acte est introuvable au registre.", "info");
          } }),
        button("", { variant: "tertiary", icon: "trash", size: "sm", title: "Retirer cette annexe",
          onClick: () => { const l = [...list]; l.splice(i, 1); draft.values.__annexes = l; redraw(); } })));
    });
    return box;
  }

  function joindreAnnexe() {
    const deja = new Set((draft.values.__annexes || []).map((a) => a.acteId));
    const dispo = candidatsAnnexes().filter((a) => !deja.has(a.id));
    const corps = h("div", { class: "fr-stack" });
    corps.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: 0 },
      text: "Les documents qu'une trame a déclarés « Annexe » (onglet Trame de l'éditeur de trame). Ils seront annoncés à la fin du dispositif, et leur texte suivra l'acte dans l'original signé." }));
    if (!dispo.length) {
      corps.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucune annexe enregistrée pour l'instant. Rédigez d'abord le document depuis une trame de nature « Annexe »." }));
    }
    for (const a of dispo) {
      corps.appendChild(button(libelleActe(a), {
        variant: "secondary", onClick: () => { draft.values.__annexes = [...(draft.values.__annexes || []), identification(a, designationDeActe(a))]; m.close(); redraw(); toast("Annexe jointe à l'acte", "success"); },
      }));
    }
    const m = modal({
      title: "Joindre une annexe",
      body: corps,
      actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })],
    });
  }

  function renderTabs() {
    const nbTodo = requiredTodo();
    const nbCtrl = doc.issues.length + doc.ecarts.length;
    const nbAbr = (draft.values.__abrogations || []).length;
    const nbNotes = (doc.notes || []).length;
    tabsBar.replaceChildren();
    for (const t of [
      // L'onglet du bloc désigné n'apparaît que quand un bloc l'est : il porte
      // ses réglages, ses éléments et sa suppression (voir `paintBloc`).
      ui.selPath ? { id: "bloc", label: "Bloc" } : null,
      { id: "completer", label: "À compléter" + (nbTodo ? ` (${nbTodo})` : "") },
      // Les consignes de la trame : l'onglet n'apparaît que s'il y en a, mais
      // elles s'affichent de toute façon DANS le document (voir ui/annotations.js).
      nbNotes ? { id: "consignes", label: `Consignes (${nbNotes})` } : null,
      { id: "abrogations", label: "Abrogations" + (nbAbr ? ` (${nbAbr})` : "") },
      { id: "controle", label: "Contrôle & écarts" + (nbCtrl ? ` (${nbCtrl})` : "") },
    ].filter(Boolean)) {
      tabsBar.appendChild(h("button", {
        class: "fr-tab" + (ui.tab === t.id ? " fr-tab--active" : ""), text: t.label,
        onClick: () => { ui.tab = t.id; redraw(); },
      }));
    }
  }
  function paintPanel() {
    clear(panelBody);
    if (ui.tab === "bloc" && ui.selPath) paintBloc(panelBody);
    else if (ui.tab === "consignes" && (doc.notes || []).length) paintConsignes(panelBody);
    else if (ui.tab === "abrogations") paintAbrogations(panelBody);
    else if (ui.tab === "controle") paintControle(panelBody);
    else paintCompleter(panelBody);
  }

  // ======================================================= bibliothèque de vars
  // Toutes les variables du document, dans le panneau de droite, prêtes à être
  // glissées dans le texte. C'était le principal manque de l'atelier : les
  // champs n'existaient que sous forme de pastilles dans les phrases, sans
  // moyen d'en poser un là où on en avait besoin.
  function puceVar(kind, label, token, icone) {
    const actif = !!ui.arme && ui.arme.token === token;
    const btn = h("button", {
      class: "puce" + (actif ? " is-on" : ""), type: "button",
      title: actif ? `${label} — cliquez dans le texte pour l'insérer` : label,
      onClick: (e) => {
        e.preventDefault(); e.stopPropagation();
        ui.arme = actif ? null : { token, label };
        paintPalette();
        if (ui.arme) toast(`${label} : cliquez dans le texte à l'endroit voulu`, "info");
      },
    }, h("span", { class: "fr-icon" }, icon(icone || "doc", 13)), h("span", { class: "puce__label", text: label }));
    return glissable(btn, { kind, token, label });
  }

  function paintPalette() {
    if (!varChips) return;
    const q = String(ui.rechercheVar || "").trim().toLowerCase();
    const garde = (lbl) => !q || String(lbl).toLowerCase().includes(q);
    clear(varChips);
    // Une annexe n'a pas de numéro propre : la variable n'a rien à y faire, et
    // sa valeur serait vide (voir src/lib/annexes.js).
    const champs = (trame.fields || []).filter((f) => !(natureDe(trame) === "annexe" && f.id === "numero") && garde(f.label || f.id));
    // Le jeton « numero » n'a pas de sens dans une annexe, qui n'en a pas
    // (voir src/lib/annexes.js).
    const autos = AUTO_TOKENS.filter((t) => !(natureDe(trame) === "annexe" && t.token === "numero") && garde(t.label));
    if (!champs.length && !autos.length) {
      varChips.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: 0 }, text: "Aucune variable ne correspond." }));
      return;
    }
    const groupe = (titre, puces) => {
      if (!puces.length) return;
      varChips.appendChild(h("div", { class: "var-lib__groupe" },
        h("span", { class: "var-lib__titre", text: titre }),
        h("div", { class: "palette__puces" }, ...puces)));
    };
    groupe("Vos champs", champs.map((f) => puceVar("champ", f.label || f.id, "{{" + f.id + "}}", "doc")));
    groupe("Rempli automatiquement", autos.map((t) => puceVar("auto", t.label, "{{" + t.token + "}}", "check")));
  }

  // ================================================= structure & blocs désignés
  // Cliquer un bloc, c'est le désigner : le panneau montre alors tout ce qui le
  // concerne. On ne redessine PAS la page — le curseur de saisie ne doit pas
  // être volé par un simple clic.
  function selectBlock(path) {
    if (!path) return;
    const deja = ui.selPath === path && ui.tab === "bloc";
    ui.selPath = path;
    ui.tab = "bloc";
    for (const el of paper.querySelectorAll(".mv")) el.classList.toggle("mv--sel", el.dataset.node === path);
    if (!deja) paintStatus();
  }

  // La liste de la TRAME qui porte un conteneur (`body`, `body.3.blocks`,
  // `body.2.items`). Sert à connaître le nombre de blocs d'origine — les rangs
  // des ajouts commencent juste après (voir lib/structure.js).
  function listeTrame(containerPath) {
    const parts = String(containerPath || "").split(".").filter(Boolean);
    let cur = trame;
    for (const p of parts) cur = cur?.[/^\d+$/.test(p) ? Number(p) : p];
    return Array.isArray(cur) ? cur : null;
  }

  const parentPathDe = (path) => String(path || "").split(".").slice(0, -1).join(".");

  function supprimerAdresse(addr) {
    if (!addr) return;
    if (ajoutPour(draft.values, addr)) {
      retirerAjoutPour(draft.values, addr);
      toast("Élément ajouté retiré", "info");
    } else {
      supprimer(draft.values, addr);
      toast("Bloc retiré du document — « Contrôle & écarts » permet de le rétablir", "info");
    }
    if (ui.selPath === addr) {
      ui.selPath = null;
      if (ui.tab === "bloc") ui.tab = "controle";
    }
    paintFull();
  }

  const ELEMENT_VIDE = {
    visas: () => ({ id: uid("v"), text: "" }),
    considerants: () => ({ id: uid("c"), text: "Considérant que ", when: "" }),
    list: () => ({ id: uid("i"), text: "", when: "" }),
  };
  const ETIQUETTE_ELEMENT = { visas: "Un visa", considerants: "Un considérant", list: "Un élément" };

  // Ajouter un visa, un considérant ou un élément à une liste : un seul clic,
  // puis on écrit. L'élément appartient au DOCUMENT, pas à la trame.
  function ajouterElement(nodePath, refAddr) {
    const trameNode = nodeAt(trame, nodePath);
    if (!trameNode) return;
    const itemsPath = `${nodePath}.items`;
    const count = (trameNode.items || []).length;
    const ordre = ordreConteneur(draft.values, itemsPath, count);
    const i = refAddr ? ordre.indexOf(rangDe(refAddr)) + 1 : null;
    const entree = ajouterA(draft.values, itemsPath, (ELEMENT_VIDE[trameNode.type] || ELEMENT_VIDE.list)(), i, count);
    paintFull();
    const addr = `${itemsPath}.${entree.rang}`;
    requestAnimationFrame(() => {
      paper.querySelector(`[data-slot="${addr}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    toast((ETIQUETTE_ELEMENT[trameNode.type] || "Un élément") + " ajouté au document", "success");
  }

  // Les types de bloc qu'un conteneur accepte : on n'ouvre pas une signature au
  // milieu d'un article, et l'intitulé de l'acte ne se duplique pas.
  function typesAjoutables(containerPath) {
    if (containerPath === "body") return ["article", "division", "para", "list", "table", "considerants", "visas", "mention", "raw"];
    return ["para", "list", "table", "considerants", "visas", "mention", "raw", "division"];
  }

  // Ajouter un bloc neuf à une place donnée. La fenêtre ne propose que ce que le
  // conteneur accepte — c'est le « revenir à la liste pour ajouter » du
  // rédacteur, à un clic de la barre d'outils du bloc.
  function menuAjout(anchor, containerPath, rang, position) {
    const corps = h("div", { class: "fr-stack" });
    const m = modal({
      title: "Ajouter un bloc au document",
      body: corps,
      actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })],
    });
    for (const id of typesAjoutables(containerPath)) {
      const t = NODE_MAP[id] || { label: id, hint: "" };
      corps.appendChild(h("button", {
        class: "fr-btn fr-btn--secondary", type: "button", style: { justifyContent: "flex-start" },
        onClick: () => {
          const count = (listeTrame(containerPath) || []).length;
          const ordre = ordreConteneur(draft.values, containerPath, count);
          const i = Math.max(0, ordre.indexOf(Number(rang)) + (position === "avant" ? 0 : 1));
          const entree = ajouterA(draft.values, containerPath, newNode(id), i, count);
          ui.selPath = `${containerPath}.${entree.rang}`;
          ui.tab = "bloc";
          m.close();
          paintFull();
          toast(t.label + " ajouté au document", "success");
        },
      }, h("span", { class: "fr-icon" }, icon(t.icon || "doc", 15)), h("span", { text: t.label }),
        h("span", { class: "fr-spacer" }), h("span", { class: "fr-small fr-muted", text: t.hint || "" })));
    }
    corps.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "6px 0 0" },
      text: "Ce bloc est ajouté au document, non à la trame : les administrateurs le verront signalé comme un ajout de la rédaction." }));
  }

  // ============================================================ onglet « Bloc »
  // Tout ce qui concerne le bloc désigné, à un seul endroit : ce qu'il est, sa
  // place, son intitulé, sa numérotation, son échelon, ses éléments, et sa
  // suppression. Le pendant rédaction de l'inspecteur de l'éditeur de trame.
  function nodeDuDoc(path) {
    let found = null;
    const walk = (list) => (list || []).forEach((n) => {
      if (found) return;
      if (n.path === path) { found = n; return; }
      walk(n.blocks);
    });
    walk(doc.nodes);
    return found;
  }

  function paintBloc(box) {
    const path = ui.selPath;
    const node = path ? nodeDuDoc(path) : null;
    const trameNode = path ? nodeAt(trame, path) : null;
    const ajout = path ? ajoutPour(draft.values, path) : null;
    if (!node) {
      box.appendChild(h("div", { class: "inspector__section" },
        h("p", { class: "fr-small fr-muted", style: { margin: 0 },
          text: "Le bloc désigné n'apparaît plus dans le document (il a été retiré, ou sa condition n'est plus remplie). Choisissez-en un autre, ou rétablissez-le dans « Contrôle & écarts »." })));
      return;
    }
    const fixe = ["title", "authority", "annexes"].includes(node.type);
    const container = parentPathDe(path);
    const trameList = listeTrame(container);
    const count = (trameList || []).length;
    const rang = rangDe(path);
    const ordre = ordreConteneur(draft.values, container, count);
    const pos = ordre.indexOf(rang);
    const precedent = ordre[pos - 1];
    const suivant = ordre[pos + 1];
    const apresSuivant = ordre[pos + 2];
    const typeLabel = NODE_MAP[node.type]?.label || node.type;

    const sec = (children) => h("div", { class: "inspector__section" }, ...children);

    box.appendChild(sec([
      h("span", { class: "inspector__label" }, "Bloc désigné · ", h("strong", { text: typeLabel })),
      h("p", { class: "fr-small fr-muted", style: { margin: 0 },
        text: ajout ? "Bloc ajouté par la rédaction : il n'existe pas dans la trame." : "Bloc de la trame." }),
      h("p", { class: "fr-small", style: { margin: "6px 0 0" }, text: libelleAdresse(path) }),
    ]));

    if (!fixe) {
      const bouger = (versRang) => {
        if (deplacerVers(draft.values, container, count, rang, versRang)) {
          paintFull();
          toast("Bloc déplacé", "success");
        }
      };
      box.appendChild(sec([
        h("div", { class: "fr-row", style: { flexWrap: "wrap" } },
          button("Monter", { variant: "tertiary", size: "sm", icon: "up", disabled: pos <= 0, onClick: () => bouger(precedent) }),
          button("Descendre", { variant: "tertiary", size: "sm", icon: "down", disabled: suivant === undefined, onClick: () => bouger(apresSuivant === undefined ? null : apresSuivant) }),
          h("span", { class: "fr-spacer" }),
          button(ajout ? "Retirer cet ajout" : "Retirer du document", {
            variant: "tertiary", size: "sm", icon: "trash",
            onClick: () => supprimerAdresse(path),
          })),
        h("p", { class: "fr-small fr-muted", style: { margin: "6px 0 0" },
          text: ajout
            ? "Le bloc ajouté est retiré du document ; il n'existe nulle part ailleurs."
            : "Le bloc est retiré du document, non de la trame : « Contrôle & écarts » permet de le rétablir." }),
      ]));
    }

    // Intitulé, numérotation, échelon : les réglages du bloc. On écrit dans les
    // écarts (`__overrides`) — la trame, elle, ne bouge pas.
    const lire = (k, defaut) => (overrides[path + "." + k] !== undefined ? overrides[path + "." + k] : defaut);
    // `relance` : un réglage qui change la FORME du panneau (la numérotation
    // manuelle fait apparaître le champ du numéro) demande un redessin complet.
    // Une simple saisie de texte, non — le focus doit rester dans le champ.
    const ecrire = (k, v, relance = true) => {
      const original = trameNode?.[k] ?? "";
      if (String(v) === String(original)) delete overrides[path + "." + k];
      else overrides[path + "." + k] = v;
      if (relance) paintFull(); else paintSoon();
    };
    if (node.type === "article" || node.type === "division") {
      const reglages = [];
      reglages.push(textField({
        label: node.type === "article" ? "Intitulé de l'article" : "Intitulé de la division",
        value: lire("heading", trameNode?.heading ?? ""),
        help: "Laissez vide pour suivre la trame. Une modification est signalée aux administrateurs comme un écart.",
        onChange: (v) => {
          const original = trameNode?.heading ?? "";
          if (normalizeSpace(v) === normalizeSpace(original)) delete overrides[path + ".heading"];
          else overrides[path + ".heading"] = v;
          paintSoon();
        },
      }));
      if (node.type === "division") {
        reglages.push(selectField({
          label: "Échelon dans la hiérarchie",
          value: String(lire("level", trameNode?.level ?? 1)),
          options: ladderOf(trame).map((n) => ({ value: String(n.level), label: `${n.label} — échelon ${n.level}` })),
          help: "L'échelle elle-même se règle dans la trame (onglet « Trame », rubrique « Hiérarchie »).",
          onChange: (v) => ecrire("level", Number(v)),
        }));
      }
      reglages.push(selectField({
        label: "Numérotation",
        value: String(lire("numMode", trameNode?.numMode ?? "auto")),
        options: [{ value: "auto", label: "Automatique" }, { value: "fixed", label: "Écrite à la main" }],
        help: "Automatique : le numéro suit l'ordre des articles. Écrite à la main : le numéro est celui que vous tapez (« Article R. 1 »).",
        onChange: (v) => {
          const num = String(lire("num", trameNode?.num ?? "")).trim();
          if (v === "fixed") {
            // Passer en numérotation manuelle ne doit pas effacer le numéro :
            // on part de celui qui s'affiche (« Article 2 »).
            if (!num) overrides[path + ".num"] = node.numLabel || "";
          } else if (overrides[path + ".num"] !== undefined) {
            delete overrides[path + ".num"];   // redevenu automatique : rien à signaler
          }
          ecrire("numMode", v);
        },
      }));
      if (String(lire("numMode", "auto")) === "fixed") {
        reglages.push(textField({
          label: "Texte du numéro", value: lire("num", trameNode?.num ?? ""),
          onChange: (v) => ecrire("num", v, false),
        }));
      }
      box.appendChild(sec([h("span", { class: "inspector__label", text: "Réglages du bloc" }), ...reglages]));
    }

    // La MISE EN FORME d'un bloc de texte se règle ici aussi — alignement,
    // retrait, encadré, marque de liste, disposition de tableau, formule des
    // considérants. Ce sont des RÉGLAGES du bloc au même titre que l'intitulé
    // d'un article : ils s'écrivent dans les écarts, la trame ne bouge pas, et
    // « Contrôle & écarts » les présente aux administrateurs. Tout part des
    // défauts déclarés par la trame (`paramsBloc`, lib/schema.js) : régler un
    // bloc sur ce qu'il était déjà ne crée donc aucun écart.
    const defautsForme = paramsBloc(trameNode || {});
    const lireForme = (k) => {
      const v = overrides[path + "." + k];
      return v !== undefined ? valeurReglage(k, v) : defautsForme[k];
    };
    const ecrireForme = (k, v, relance = true) => {
      const original = defautsForme[k];
      if (String(v) === String(original ?? "")) delete overrides[path + "." + k];
      else overrides[path + "." + k] = v;
      if (relance) paintFull(); else paintSoon();
    };
    const forme = [];
    if (node.type === "para") {
      forme.push(
        selectField({
          label: "Alignement", value: lireForme("align"), options: choixDe(PARA_ALIGNS),
          help: "« Comme la feuille de style » suit la charte de la collectivité.",
          onChange: (v) => ecrireForme("align", v),
        }),
        selectField({ label: "Retrait", value: lireForme("indent"), options: choixDe(PARA_INDENTS), onChange: (v) => ecrireForme("indent", v) }),
        choiceField({
          label: "Encadré", value: !!lireForme("boxed"),
          options: [{ value: false, label: "Non" }, { value: true, label: "Oui" }],
          onChange: (v) => ecrireForme("boxed", v),
        }),
      );
    } else if (node.type === "list") {
      const ordonne = !!lireForme("ordered");
      forme.push(
        choiceField({
          label: "Genre de liste", value: ordonne,
          options: [{ value: false, label: "À puces" }, { value: true, label: "Numérotée" }],
          onChange: (v) => ecrireForme("ordered", v),
        }),
        ordonne
          ? selectField({ label: "Numérotation", value: lireForme("numbering"), options: choixDe(LIST_NUMBERINGS), onChange: (v) => ecrireForme("numbering", v) })
          : selectField({ label: "Marqueur", value: lireForme("marker"), options: choixDe(LIST_MARKERS), onChange: (v) => ecrireForme("marker", v) }),
        ordonne ? textField({
          label: "Numéro de départ", type: "number", value: lireForme("start"),
          onChange: (v) => ecrireForme("start", Math.max(1, Number(v) || 1)),
        }) : null,
      );
    } else if (node.type === "table") {
      forme.push(
        selectField({ label: "Position de la légende", value: lireForme("captionPos"), options: choixDe(TABLE_CAPTION_POS), onChange: (v) => ecrireForme("captionPos", v) }),
        choiceField({
          label: "Ligne d'en-tête", value: lireForme("head") !== false,
          options: [{ value: true, label: "Oui" }, { value: false, label: "Non" }],
          onChange: (v) => ecrireForme("head", v),
        }),
        selectField({ label: "Disposition", value: lireForme("layout"), options: choixDe(TABLE_LAYOUTS), onChange: (v) => ecrireForme("layout", v) }),
        selectField({ label: "Alignement des cellules", value: lireForme("align"), options: choixDe(TABLE_ALIGNS), onChange: (v) => ecrireForme("align", v) }),
      );
    } else if (node.type === "considerants") {
      forme.push(
        textField({
          label: "Formule devant chaque considérant", value: lireForme("formule"),
          placeholder: "Considérant que",
          help: "Placée devant le texte de chaque considérant, sauf s'il la porte déjà. Laissez vide pour ne rien ajouter.",
          onChange: (v) => ecrireForme("formule", v, false),
        }),
        selectField({ label: "Ponctuation finale", value: lireForme("fin"), options: choixDe(RECITAL_FINS), onChange: (v) => ecrireForme("fin", v) }),
        choiceField({
          label: "En un seul alinéa", value: !!lireForme("inline"),
          options: [{ value: false, label: "Un par paragraphe" }, { value: true, label: "Tous suivis" }],
          onChange: (v) => ecrireForme("inline", v),
        }),
      );
    }
    const champsForme = forme.filter(Boolean);
    if (champsForme.length) {
      box.appendChild(sec([h("span", { class: "inspector__label", text: "Mise en forme" }), ...champsForme]));
    }

    box.appendChild(sec([
      h("span", { class: "inspector__label", text: "Ajouter dans ce bloc" }),
      h("div", { class: "fr-choices" }, ...boutonsAjoutBloc(node, path, container, rang)),
    ]));

    // Les éléments d'une liste se règlent ici aussi : c'est l'autre « revenir à
    // la liste » que réclamait la rédaction.
    if (["visas", "considerants", "list"].includes(node.type) && trameNode) {
      const items = h("div", { class: "fr-stack" });
      const itemsPath = `${path}.items`;
      const countItems = (trameNode.items || []).length;
      const ordreItems = ordreConteneur(draft.values, itemsPath, countItems);
      (node.items || []).forEach((it, i) => {
        const idx = (trameNode.items || []).findIndex((x) => x.id === it.id);
        const addr = idx >= 0 ? `${path}.items.${idx}` : (it.ajout ? it.path : "");
        const rang = addr ? rangDe(addr) : -1;
        const pos = ordreItems.indexOf(rang);
        const bougerItem = (versRang) => {
          if (deplacerVers(draft.values, itemsPath, countItems, rang, versRang)) { paintFull(); toast("Élément déplacé", "success"); }
        };
        const ligne = h("div", { class: "rx-field" });
        ligne.appendChild(h("div", { class: "rx-field__head" },
          h("span", { class: "rx-field__label", text: `#${i + 1}${it.ajout ? " · ajouté" : ""}` }),
          h("span", { class: "fr-spacer" }),
          addr ? button("", { variant: "tertiary", size: "sm", icon: "up", title: "Monter cet élément",
            disabled: pos <= 0, onClick: () => bougerItem(ordreItems[pos - 1]) }) : null,
          addr ? button("", { variant: "tertiary", size: "sm", icon: "down", title: "Descendre cet élément",
            disabled: pos < 0 || pos >= ordreItems.length - 1, onClick: () => bougerItem(ordreItems[pos + 2]) }) : null,
          button("", { variant: "tertiary", size: "sm", icon: "eye", title: "Voir dans le document",
            onClick: () => { if (!focusNodeWidget(paper, addr)) focusSlot(paper, addr); } }),
          addr ? button("", { variant: "tertiary", size: "sm", icon: "trash", title: it.ajout ? "Retirer cet élément ajouté" : "Retirer cet élément du document",
            onClick: () => supprimerAdresse(addr) }) : null,
        ));
        const ta = h("textarea", { class: "fr-textarea", rows: 2 });
        ta.value = idx >= 0 ? (overrides[addr] !== undefined ? overrides[addr] : (trameNode.items[idx]?.text || "")) : (ajoutPour(draft.values, addr)?.node.text || "");
        ta.addEventListener("input", () => {
          if (idx >= 0) {
            const original = trameNode.items[idx]?.text || "";
            if (normalizeSpace(ta.value) === normalizeSpace(original)) delete overrides[addr];
            else overrides[addr] = ta.value;
          } else if (addr) {
            majAjout(draft.values, addr, ta.value);
            sources.set(addr, ta.value);
          }
          paintSoon();
        });
        ligne.appendChild(ta);
        items.appendChild(ligne);
      });
      box.appendChild(sec([
        sectionHeader("Éléments", button("Ajouter", { variant: "secondary", size: "sm", icon: "plus", onClick: () => ajouterElement(path, "") })),
        ...(node.items || []).length ? [items] : [h("p", { class: "fr-small fr-muted", text: "Aucun élément affiché pour l'instant." })],
      ]));
    }

    const notes = (doc.notes || []).filter((n) => n.path === path);
    if (notes.length) {
      box.appendChild(sec([
        sectionHeader("Consignes de la trame sur ce bloc", null),
        annotationStrip({ notes, bare: true }),
      ]));
    }

    const when = trameNode?.when;
    if (when) {
      box.appendChild(sec([
        h("span", { class: "inspector__label", text: "Condition d'affichage" }),
        h("p", { class: "fr-small fr-muted", style: { margin: 0 }, text: when + " — un passage conditionnel n'apparaît que si la condition est remplie." }),
      ]));
    }
  }

  // Les boutons « ajouter » adaptés au bloc désigné : un paragraphe dans un
  // article, un visa dans une liste de visas, un bloc à la suite…
  function boutonsAjoutBloc(node, path, container, rang) {
    const out = [];
    if (node.type === "article" || node.type === "division") {
      for (const id of ["para", "list", "table", "considerants"]) {
        out.push(button(NODE_MAP[id].label, { variant: "tertiary", size: "sm", icon: "plus",
          onClick: () => ajouterDansConteneur(`${path}.blocks`, id) }));
      }
      return out;
    }
    if (node.type === "visas" || node.type === "considerants" || node.type === "list") {
      out.push(button(ETIQUETTE_ELEMENT[node.type], { variant: "tertiary", size: "sm", icon: "plus",
        onClick: () => ajouterElement(path, "") }));
      return out;
    }
    out.push(button("Après ce bloc", { variant: "tertiary", size: "sm", icon: "plus",
      onClick: (e) => menuAjout(e.currentTarget, container, rang, "apres") }));
    return out;
  }

  // Ajoute un bloc à la fin d'un conteneur de blocs (les paragraphes d'un
  // article ou d'une division). Le bloc ajouté est désigné aussitôt, pour qu'on
  // puisse l'écrire et le régler sans le chercher.
  function ajouterDansConteneur(containerPath, type) {
    const count = (listeTrame(containerPath) || []).length;
    const entree = ajouterA(draft.values, containerPath, newNode(type || "para"), null, count);
    ui.selPath = `${containerPath}.${entree.rang}`;
    ui.tab = "bloc";
    paintFull();
    toast((NODE_MAP[type]?.label || "Bloc") + " ajouté au document", "success");
  }

  // Fait défiler jusqu'à un emplacement d'élément (les pastilles `data-slot`).
  function focusSlot(paperEl, addr) {
    const el = paperEl.querySelector(`[data-slot="${addr}"]`);
    if (!el) return false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    return true;
  }

  // Un libellé lisible pour une adresse de bloc ou d'élément de la TRAME — les
  // blocs retirés ne sont plus dans le document compilé, `locateAddr` ne peut
  // donc pas les nommer.
  const TYPE_NOMS = {
    title: "Intitulé", authority: "Formule d'autorité", visas: "Visas", considerants: "Considérants",
    enact: "Formule d'édiction", division: "Division", article: "Article", para: "Paragraphe",
    list: "Liste", table: "Tableau", signature: "Signature", mention: "Mention", raw: "Passage libre",
  };
  function libelleAdresse(addr) {
    const m = String(addr).match(/^(.*)\.items\.(\d+)$/);
    if (m) {
      const parent = nodeAt(trame, m[1]);
      return `${TYPE_NOMS[parent?.type] || "Liste"} · élément ${Number(m[2]) + 1}`;
    }
    const n = nodeAt(trame, addr);
    if (!n) return addr;
    const t = TYPE_NOMS[n.type] || n.type;
    const titre = n.heading || n.text;
    return titre ? `${t} — ${resume(titre, 50)}` : t;
  }

  // ------------------------------------------------------- onglet consignes
  // Ce que les administrateurs ont laissé dans la trame : à lire avant de
  // remplir. Ces commentaires ne sont pas publiés — mais ils sont là, dans le
  // document, sous le passage qu'ils visent, et repris ici avec le lien qui y
  // mène.
  function paintConsignes(box) {
    const groups = notesByPath(doc.notes || []);
    const parChemin = new Map();
    const walk = (ns) => (ns || []).forEach((n) => { if (n.path) parChemin.set(n.path, n); walk(n.blocks); });
    walk(doc.nodes);
    box.appendChild(h("div", { class: "fr-row" },
      h("strong", { text: groups.size > 1 ? `${groups.size} passages commentés par la trame` : "Un passage commenté par la trame" }),
    ));
    box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "4px 0 10px" },
      text: "Consignes, explications ou points à arbitrer laissés par les administrateurs : ils accompagnent la rédaction et ne sont pas publiés avec l'acte. Le document les affiche aussi, sous chaque passage concerné." }));
    for (const [path, list] of groups) {
      box.appendChild(h("div", { class: "cmt-group" },
        h("div", { class: "cmt-group__head" },
          h("button", {
            class: "cmt-group__jump", type: "button", title: "Voir ce passage dans le document",
            onClick: () => { if (!focusNodeWidget(paper, path)) toast("Ce passage n'est pas affiché (condition non remplie).", "info"); },
          }, icon("eye", 13), h("span", { class: "cmt-group__label", text: libelleBloc(parChemin.get(path)) })),
          h("span", { class: "fr-badge fr-badge--info", text: String(list.length) }),
        ),
        h("div", { class: "cmt-group__body" }, annotationStrip({ notes: list, bare: true })),
      ));
    }
  }

  function libelleBloc(n) {
    if (!n) return "Le document";
    switch (n.type) {
      // `numLabel` porte déjà le mot (« Article 2 », « Titre Ier ») : on ne le
      // répète pas.
      case "article": return [n.numLabel || "Article", n.heading].filter(Boolean).join(" — ");
      case "division": return [n.numLabel || n.levelLabel || "Division", n.heading].filter(Boolean).join(" — ");
      case "title": return "Intitulé de l'acte";
      case "authority": return "Formule d'autorité";
      case "visas": return "Visas";
      case "considerants": return "Considérants";
      case "enact": return "Formule d'édiction";
      case "para": return "Paragraphe";
      case "list": return "Liste";
      case "table": return "Tableau";
      case "signature": return "Signature";
      case "mention": return "Mention";
      case "annexes": return "Annexes";
      default: return "Bloc du document";
    }
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
    return (trame.fields || []).filter((f) =>
      // Une annexe ne se signe pas : son signataire est celui de l'acte qui
      // l'adopte, et le champ n'a donc pas lieu d'être dans son atelier de
      // rédaction (voir src/lib/compile.js, qui l'écarte aussi à la compilation).
      !(natureDe(trame) === "annexe" && f.type === "signataire")
      // Une annexe n'a pas de numéro propre non plus : ni dans son atelier, ni
      // dans le compte des champs à compléter (voir src/lib/annexes.js).
      && !(natureDe(trame) === "annexe" && f.id === "numero")
      && (!f.appliesWhen || safeEval(f.appliesWhen, doc.ctx).value));
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
      // Une annexe n'arrive jamais ici : `applicableFields()` écarte le champ
      // « numero » pour elle (elle n'a pas de numéro propre, et la séquence
      // n'est pas consommée — voir src/lib/annexes.js).
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
  // « Article 2 — Paragraphe », pour un ajout : son texte peut être vide tant
  // qu'on ne l'a pas écrit.
  function libelleAjout(a) {
    const type = a.node?.type;
    const t = TYPE_NOMS[type] || (a.container.endsWith(".items") ? "Élément" : "Bloc");
    const texte = a.node?.text || a.node?.heading || "";
    return texte ? `${t} — ${resume(texte, 50)}` : t;
  }

  function paintControle(box) {
    const blocking = doc.issues.filter((i) => i.level === "blocking");
    const warnings = doc.issues.filter((i) => i.level === "warning");
    // Ce que la rédaction a changé à la STRUCTURE du document : un bloc retiré,
    // un paragraphe ou un visa ajouté. Ce n'est pas un contrôle, et le modèle
    // n'est pas touché — mais rien ne doit pouvoir disparaître sans trace.
    const supp = suppressions(draft.values);
    const ajouts = [];
    for (const [container, list] of Object.entries(draft.values.__ajouts || {})) {
      for (const a of list || []) ajouts.push({ container, addr: `${container}.${a.rang}`, node: a.node });
    }
    if (supp.length || ajouts.length) {
      box.appendChild(h("h3", { class: "rx-h3", text: "Structure du document" }));
      box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0 0 8px" },
        text: "Ce que vous avez ajouté ou retiré par rapport à la trame. La trame n'est pas modifiée : les administrateurs verront ces changements signalés." }));
      for (const addr of supp) {
        box.appendChild(h("div", { class: "rx-ecart", style: { borderLeftColor: "var(--warning)" } },
          h("div", { class: "rx-ecart__head" },
            h("span", { class: "rx-ecart__where", text: "Retiré · " + libelleAdresse(addr) }),
            h("span", { class: "fr-spacer" }),
            button("Rétablir", { variant: "tertiary", size: "sm", icon: "refresh",
              onClick: () => { retablir(draft.values, addr); redraw(); toast("Bloc rétabli dans le document", "success"); } })),
          h("p", { class: "fr-small fr-muted", style: { margin: "2px 0 0" }, text: "Le passage reste dans la trame ; il n'est plus dans le document." })));
      }
      for (const a of ajouts) {
        box.appendChild(h("div", { class: "rx-ecart", style: { borderLeftColor: "var(--brand)" } },
          h("div", { class: "rx-ecart__head" },
            h("span", { class: "rx-ecart__where", text: "Ajouté · " + libelleAjout(a) }),
            h("span", { class: "fr-spacer" }),
            button("", { variant: "tertiary", size: "sm", icon: "eye", title: "Voir et régler ce bloc",
              onClick: () => { ui.selPath = a.addr; ui.tab = "bloc"; redraw(); } }),
            button("", { variant: "tertiary", size: "sm", icon: "trash", title: "Retirer ce bloc ajouté",
              onClick: () => supprimerAdresse(a.addr) }))));
      }
      box.appendChild(h("hr", { class: "fr-sep" }));
    }
    // L'ordre des blocs : un geste de mise en page, pas un contrôle. Il se dit
    // à part, et se défait d'un clic (« Ranger comme la trame »).
    const ordres = ordresModifies(draft.values);
    if (ordres.length) {
      box.appendChild(h("h3", { class: "rx-h3", text: "Ordre du document" }));
      box.appendChild(h("div", { class: "rx-ecart", style: { borderLeftColor: "var(--brand)" } },
        h("div", { class: "rx-ecart__head" },
          h("span", { class: "rx-ecart__where", text: `${ordres.length} endroit(s) réordonné(s)` }),
          h("span", { class: "fr-spacer" }),
          button("Ranger comme la trame", {
            variant: "tertiary", size: "sm", icon: "refresh",
            onClick: () => { rangerCommeLaTrame(draft.values); redraw(); toast("Ordre du modèle rétabli", "success"); },
          })),
        h("p", { class: "fr-small fr-muted", style: { margin: 0 },
          text: "Vous avez déplacé des blocs (articles, divisions, paragraphes) par rapport au modèle. La trame elle-même n'est pas modifiée ; les administrateurs le verront." }),
      ));
      box.appendChild(h("hr", { class: "fr-sep" }));
    }
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
    const nbTextes = doc.ecarts.filter((e) => !e.reglage).length;
    const nbReglages = doc.ecarts.length - nbTextes;
    box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0 0 8px" },
      text: [
        nbTextes ? `${nbTextes} passage(s) réécrit(s)` : "",
        nbReglages ? `${nbReglages} réglage(s) de bloc modifié(s)` : "",
      ].filter(Boolean).join(" · ") + " par rapport au modèle. C'est autorisé, mais les administrateurs le verront." }));
    const ligne = (k, cls, v) => h("p", { class: "rx-ecart__line" },
      h("span", { class: "rx-ecart__k", text: k }), h("span", { class: cls, text: v }));
    for (const e of doc.ecarts) {
      const loc = locateAddr(doc, e.addr);
      const card = h("div", { class: "rx-ecart" },
        h("div", { class: "rx-ecart__head" },
          h("span", { class: "rx-ecart__where", text: [loc.area, loc.label].filter(Boolean).join(" · ") }),
          h("span", { class: "fr-spacer" }),
          button("Revenir à la trame", {
            variant: "tertiary", size: "sm",
            onClick: () => { delete overrides[e.addr]; redraw(); toast("Réglage du modèle rétabli", "success"); },
          }),
        ),
        e.reglage
          ? ligne("modèle", "rx-ecart__was", libelleReglage(e.addr, e.original))
          : ligne("modèle", "rx-ecart__was", interpolate(e.original, doc.ctx) || "—"),
        e.reglage
          ? ligne("vous", "rx-ecart__now", libelleReglage(e.addr, e.current))
          : ligne("vous", "rx-ecart__now", interpolate(e.current, doc.ctx) || "(texte supprimé)"),
      );
      box.appendChild(card);
    }
  }

  // Un réglage se lit en clair (jamais « first » ni « 3 » tout court).
  function libelleReglage(addr, v) {
    const k = String(addr).split(".").pop();
    // La valeur d'un choix se dit par son libellé, celui du vocabulaire qui l'a
    // proposé (voir les listes de `lib/schema.js`).
    const dans = (liste, defaut = "—") => (liste.find((x) => String(x.id) === String(v ?? ""))?.label) || defaut;
    const ouiNon = () => (v === true || v === "true" ? "Oui" : "Non");
    if (k === "numMode") return String(v) === "fixed" || String(v) === "manual" ? "Écrite à la main" : "Automatique";
    if (k === "level") {
      const n = ladderOf(trame).find((x) => String(x.level) === String(v));
      return (n?.label || "Échelon") + " (échelon " + v + ")";
    }
    if (k === "align") return dans(PARA_ALIGNS);
    if (k === "indent") return dans(PARA_INDENTS);
    if (k === "marker") return dans(LIST_MARKERS);
    if (k === "numbering") return dans(LIST_NUMBERINGS);
    if (k === "layout") return dans(TABLE_LAYOUTS);
    if (k === "captionPos") return dans(TABLE_CAPTION_POS);
    if (k === "fin") return dans(RECITAL_FINS, "Aucune");
    if (k === "ordered") return v ? "Numérotée" : "À puces";
    if (k === "boxed" || k === "inline" || k === "head") return ouiNon();
    return String(v ?? "—") || "—";
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
        actes: state.actes,
      });
      draft.values.numero = res.numero;
      draft.numeroSource = res.source === "externe"
        ? { source: "externe", ref: res.ref || "", valeur: res.valeur || "", at: new Date().toISOString(), par: state.user?.id || "", parName: state.user ? fullName(state.user) : "" }
        : null;
      if (res.source === "interne") {
        // Le compteur est fixé au rang RÉSERVÉ : la séquence saute ainsi les
        // numéros déjà pris, au lieu de les proposer de nouveau.
        fixerSequence(config, res.seq, {
          entity: config.entities.find((e) => e.id === draft.values.__entityId),
          actTypeId: trame.actTypeId || "",
        });
        touch("config", { rerender: false });
      }
      paintFull();
      toast("Numéro réservé : " + res.numero
        + (res.sautes ? ` (${res.sautes} rang(s) déjà pris, enjambé(s))` : ""), "success");
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
    doc = compileDoc();
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
        nature: natureDe(trame),
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
        // L'annexe et son acte d'adoption, ou les documents annexés à l'acte :
        // deux liens figés par la rédaction (voir src/lib/annexes.js).
        nature: natureDe(trame),
        adoptePar: draft.values.__adoption || null,
        annexes: draft.values.__annexes || [],
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
    doc = compileDoc();
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
    // Le PDF/A : la forme d'ARCHIVAGE, à côté du PDF d'impression. Les deux
    // niveaux sont offerts — PDF/A-2b est le défaut, PDF/A-1b reste utile aux
    // systèmes qui n'acceptent que la première version de la norme.
    body.appendChild(h("div", { class: "fr-row" },
      ...boutonsPdfA(doc, config, { base, disabled: !!blocking.length }),
    ));
    modal({ title: "Exporter l'acte", body, actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })] });
  }

  rx.save = save;
  rx.exportMenu = exportMenu;

  // Le premier rendu de l'écran — une fois TOUT le corps de la fonction évalué
  // (voir le commentaire plus haut, à la place des colonnes).
  paintPaper();
  paintPalette();
  paintStatus();
  paintPanel();
}

// --------------------------------------------------------------------------
// L'adresse d'un bloc dans la TRAME (`body.3`, `body.3.blocks.1`, `body.2.items.0`).
// Défini ici plutôt qu'importé de l'éditeur de trame : modifier.js importe ce
// module, et le cycle n'apporterait rien.
function nodeAt(trame, path) {
  const parts = String(path || "").split(".").filter(Boolean);
  let cur = trame;
  for (const p of parts) {
    if (cur == null) return null;
    cur = cur[/^\d+$/.test(p) ? Number(p) : p];
  }
  return cur || null;
}

const resume = (text, max) => {
  const t = String(text || "");
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
};

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
