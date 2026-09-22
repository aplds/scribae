import { state, touch, navigate, redrawView, can, visibleTrames, tramesCorbeille, mettreALaCorbeille, trameEstDisponible } from "../state.js";
import { resetDraft } from "./rediger.js";
import { h, button, toast, clear, icon } from "../dom.js";
import { newTrame, tramePublishable } from "../../lib/schema.js";
import { targetLabel, serviceById, servicesInScope, coversAllServices, authorLabel } from "../../lib/scope.js";
import { download, pickBinaryFile } from "../../lib/util.js";
import { exampleTrameFile, readTrameFile } from "../../lib/trame-format.js";
import { importerTrameDocument } from "../import-trame.js";
import { boutonDisponibilite } from "../mise-a-disposition.js";
import { confirmDialog, promptDialog, statusBadge, emptyState, textField, choiceField, orgFields } from "../components.js";
import { helpLink } from "../components.js";
import { modal } from "../dom.js";
import { countNotes } from "../annotations.js";

// Auteur d'une contribution (ici, la trame elle-même) : le service du compte
// connecté — voir `authorLabel` (src/lib/scope.js).
const authorOf = () => authorLabel(state.config, state.user) || "Service";

export function renderTrames(root) {
  const config = state.config;
  const ui = (state.ui = state.ui || {});
  if (ui.family === undefined) ui.family = "";
  if (ui.status === undefined) ui.status = "";
  if (ui.q === undefined) ui.q = "";

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Trames d'actes" }),
      h("p", { class: "page-head__sub", text: "Modèles préparés par les administrateurs : structure, champs, règles et commentaires. Les services les remplissent sans jamais repartir d'une page blanche." }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("ouvrir", "Comment ça marche ?"),
      can("trames.gerer") ? button("Fichier d'exemple", { variant: "secondary", icon: "download", title: "Télécharger un modèle JSON documenté pour préparer vos trames en amont", onClick: downloadExample }) : null,
      can("trames.gerer") ? button("Importer une trame", { variant: "secondary", icon: "upload", title: "Depuis un document Word (.docx) ou LibreOffice (.odt) — l'application en propose une trame, que vous relirez avant de l'enregistrer — ou depuis un fichier de trames (.json)", onClick: importTrame }) : null,
      can("trames.gerer") ? button("Nouvelle trame", { variant: "primary", icon: "plus", onClick: () => createTrame() }) : null,
    ),
  ));

  // premier pas : un rappel visible tant que le guide n'a pas été écarté
  if (!(config.ui && config.ui.guideSeen)) {
    root.appendChild(h("div", { class: "welcome fr-card" },
      h("div", { class: "welcome__text" },
        h("h2", { class: "fr-card__title", style: { margin: 0 }, text: "Vous débutez ?" }),
        h("p", { class: "fr-small fr-muted", style: { margin: "4px 0 0" }, text: "Le guide explique tout en 10 minutes : choisir un modèle, remplir le formulaire, exporter le document et l'envoyer pour signature." }),
      ),
      h("div", { class: "welcome__actions" },
        button("Lire le guide", { variant: "primary", icon: "info", onClick: () => navigate("aide/demarrer") }),
        button("J'ai compris", { variant: "tertiary", size: "sm", onClick: () => {
          state.config.ui = { ...(state.config.ui || {}), guideSeen: true };
          touch("config", { rerender: false });
          redrawView();
        } }),
      ),
    ));
  }

  // filtres
  const filters = h("div", { class: "fr-row", style: { gap: "10px" } },
    h("input", {
      class: "fr-input", style: { maxWidth: "260px" }, placeholder: "Rechercher…", value: ui.q,
      on: { input: (e) => { ui.q = e.target.value; redraw(); } },
    }),
    (() => {
      const s = h("select", { class: "fr-select", style: { maxWidth: "260px" }, on: { change: (e) => { ui.family = e.target.value; redraw(); } } });
      s.appendChild(h("option", { value: "", text: "Toutes les familles" }));
      for (const f of config.families || []) {
        const o = h("option", { value: f.id, text: f.label });
        if (f.id === ui.family) o.selected = true;
        s.appendChild(o);
      }
      return s;
    })(),
    (() => {
      const s = h("select", { class: "fr-select", style: { maxWidth: "180px" }, on: { change: (e) => { ui.status = e.target.value; redraw(); } } });
      for (const [v, l] of [["", "Tous les statuts"], ["draft", "Brouillon"], ["published", "Mise à disposition"], ["archived", "Archivée"]]) {
        const o = h("option", { value: v, text: l });
        if (v === ui.status) o.selected = true;
        s.appendChild(o);
      }
      return s;
    })(),
  );
  root.appendChild(filters);

  const listEl = h("div");
  root.appendChild(listEl);

  // Seule la liste est reconstruite : les filtres ne sont jamais re-rendus, donc
  // le champ de recherche garde le focus pendant la frappe.
  function redraw() {
    clear(listEl);
    paintList();
  }

  function paintList() {
    const visibles = visibleTrames();
    const items = visibles.filter((t) => {
      if (ui.family && t.familyId !== ui.family) return false;
      if (ui.status && t.status !== ui.status) return false;
      if (ui.q && !(t.name + " " + t.description).toLowerCase().includes(ui.q.toLowerCase())) return false;
      return true;
    });

    if (!items.length) {
      const horsPerimetre = state.trames.length > visibles.length;
      const gerer = can("trames.gerer");
      listEl.appendChild(emptyState(
        visibles.length
          ? "Aucune trame ne correspond au filtre."
          : (horsPerimetre
              ? "Aucune trame dans votre périmètre (service et bureaux). Les trames des autres services ne vous sont pas accessibles : demandez à un administrateur de rattacher une trame à votre service, ou de la rendre générale."
              : "Aucune trame pour l'instant."),
        !visibles.length
          ? (gerer
              ? button("Créer la première trame", { variant: "primary", icon: "plus", onClick: () => createTrame() })
              : button("Lire le guide", { variant: "secondary", icon: "info", onClick: () => navigate("aide/demarrer") }))
          : null,
      ));
      return;
    }

    const grid = h("div", { class: "fr-grid fr-grid--2" });
    for (const t of items) grid.appendChild(trameCard(t, redraw));
    listEl.appendChild(grid);

    // Les trames retirées ne disparaissent pas : elles attendent à la corbeille.
    const corbeille = tramesCorbeille().length;
    if (corbeille) {
      listEl.appendChild(h("p", { class: "fr-small fr-muted", style: { marginTop: "12px" } },
        `${corbeille} trame(s) à la corbeille. `,
        button("Ouvrir la corbeille", { variant: "tertiary", size: "sm", icon: "trash", onClick: () => navigate("corbeille") })));
    }
  }

  paintList();
}

function trameCard(t, redraw) {
  const config = state.config;
  const gerer = can("trames.gerer");
  const family = (config.families || []).find((f) => f.id === t.familyId);
  const noteCount = countNotes(t.body);
  const scoped = (t.entityIds || []).length
    ? t.entityIds.map((id) => config.entities.find((e) => e.id === id)?.code).filter(Boolean).join(", ")
    : "toutes entités";

  return h("div", { class: "fr-card fr-card--pied" },
    h("div", { class: "fr-row" },
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto" }, text: t.name }),
      statusBadge(t.status),
    ),
    h("p", { class: "fr-card__sub", text: [family?.label, "v" + t.version, scoped].filter(Boolean).join(" · ") }),
    t.description ? h("p", { class: "fr-small fr-muted", text: t.description }) : null,
    h("div", { class: "fr-row", style: { gap: "6px", margin: "8px 0" } },
      t.serviceId
        ? h("span", { class: "fr-badge fr-badge--info", text: targetLabel(config, t.serviceId, t.bureauId) })
        : h("span", { class: "fr-badge", text: "Trame générale" }),
      !tramePublishable(t)
        ? h("span", { class: "fr-badge fr-badge--warning", title: "Les actes issus de cette trame ne sont pas publiés au recueil (actes individuels).", text: "Non publiable" })
        : null,
      h("span", { class: "fr-badge", text: `${(t.fields || []).length} champ${(t.fields || []).length > 1 ? "s" : ""}` }),
      h("span", { class: "fr-badge", text: `${(t.rules || []).length} règle${(t.rules || []).length > 1 ? "s" : ""}` }),
      noteCount ? h("span", { class: "fr-badge fr-badge--info", text: `${noteCount} commentaire${noteCount > 1 ? "s" : ""}` }) : null,
    ),
    // Un brouillon ne sort pas de l'atelier : on le dit là où on le voit, plutôt
    // que de laisser croire qu'un service peut déjà s'en servir.
    !trameEstDisponible(t)
      ? h("p", { class: "fr-small fr-muted", style: { margin: "0 0 6px" }, text: t.status === "archived"
        ? "Trame archivée : elle n'est proposée à personne. Retirez-la des archives pour la remettre à disposition."
        : "Brouillon : les services ne la voient pas encore. Mettez-la à disposition quand elle sera prête." })
      : null,
    // Les gestes sont rangés en deux groupes : à gauche ce qui part du modèle
    // (l'ouvrir, rédiger, l'offrir aux services ou le retirer), à droite les
    // gestes secondaires, réduits à leur icône. Sans cela, cinq boutons sur une
    // ligne se cassent en trois lignes bancales dans une carte étroite.
    h("div", { class: "fr-row", style: { justifyContent: "space-between", rowGap: "6px" } },
      h("div", { class: "fr-row" },
        gerer ? button("Ouvrir l'éditeur", { variant: "primary", icon: "doc", onClick: () => navigate("trame/" + t.id) }) : null,
        button("Rédiger", { variant: gerer ? "secondary" : "primary", onClick: () => { resetDraft(); navigate("rediger/" + t.id); } }),
        gerer ? boutonDisponibilite(t, { size: "sm", variant: "secondary", court: true }) : null,
      ),
      h("div", { class: "fr-row" },
        gerer ? button("", { variant: "tertiary", icon: "copy", title: "Dupliquer", onClick: () => duplicate(t, redraw) }) : null,
        gerer ? button("", { variant: "tertiary", icon: "download", title: "Exporter (JSON)", onClick: () => exportTrame(t) }) : null,
        gerer ? button("", { variant: "tertiary", icon: "trash", title: "Supprimer", onClick: () => remove(t, redraw) }) : null,
      ),
    ),
  );
}

function createTrame() {
  const config = state.config;
  // Pas de nom prérempli : « Nouvelle trame » se retrouverait tel quel dans la liste.
  // Vide, on retombe sur un nom composé du type d'acte — au moins descriptif.
  let name = "";
  let familyId = config.families?.[0]?.id || "";
  let actTypeId = config.actTypes?.[0]?.id || "decision";
  let serviceId = coversAllServices(config, state.user) ? "" : (servicesInScope(config, state.user)[0]?.id || "");
  let bureauId = "";
  const body = h("div", {},
    h("p", { class: "fr-small fr-muted", text: "Trois réponses suffisent pour commencer. La trame est créée avec un squelette prêt à compléter (intitulé, autorité, visas, considérants, formule d'édiction, article, signature) : vous le remplirez ensuite dans l'éditeur, en glissant ce qu'il vous faut." }),
    textField({
      label: "Comment appellerez-vous cette trame ?", value: name, required: true,
      help: "Le nom que verront vos collègues dans la liste. Exemple : « Arrêté de nomination d'un agent ».",
      onChange: (v) => (name = v),
    }),
    choiceField({
      label: "De quelle nature sont les actes qu'elle produira ?",
      value: actTypeId,
      options: (config.actTypes || []).map((a) => ({ value: a.id, label: a.label })),
      help: "Ce choix donne sa formule d'édiction à l'acte (« ARRÊTE », « DÉCIDE »…) et son intitulé de départ.",
      onChange: (v) => (actTypeId = v),
    }),
    choiceField({
      label: "Dans quel domaine ?",
      value: familyId,
      options: (config.families || []).map((f) => ({ value: f.id, label: f.label })),
      help: "Une famille regroupe les trames d'un même sujet : elle sert à les retrouver et à leur appliquer la même charte.",
      onChange: (v) => (familyId = v),
    }),
    orgFields({
      serviceId, bureauId,
      label: "Service gestionnaire",
      help: "Le service (et éventuellement le bureau) auquel la trame est réservée. Sans service, la trame est générale : tous les services peuvent la remplir.",
      onChange: (s, b) => { serviceId = s; bureauId = b; },
    }),
  );
  const m = modal({
    title: "Nouvelle trame",
    body,
    actions: (close) => [
      button("Annuler", { variant: "secondary", onClick: () => close() }),
      button("Créer", {
        variant: "primary",
        onClick: () => {
          // L'intitulé et la formule d'édiction reprennent le référentiel (type
          // d'acte choisi, vocabulaire) plutôt que les valeurs génériques.
          const typeLabel = (config.actTypes || []).find((a) => a.id === actTypeId)?.label || "Acte";
          const t = newTrame({ name: name.trim() || typeLabel + " — nouvelle trame", familyId, actTypeId, version: versionTag(), serviceId, bureauId });
          const titleNode = t.body.find((n) => n.type === "title");
          if (titleNode) titleNode.text = `${typeLabel} n°{{numero}} du {{dateSignature|date-long}} portant {{objet}}`;
          const enactNode = t.body.find((n) => n.type === "enact");
          if (enactNode) enactNode.text = config.vocab?.enact || "DÉCIDE";
          t.owner = authorOf();
          state.trames.push(t);
          touch("trames");
          close();
          navigate("trame/" + t.id);
        },
      }),
    ],
  });
}

function versionTag() {
  const d = new Date();
  return String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0");
}

async function duplicate(t, redraw) {
  const name = await promptDialog("Dupliquer la trame", "Nom de la copie", t.name + " (copie)");
  if (!name) return;
  const copy = structuredClone(t);
  copy.id = "tpl-" + Math.random().toString(36).slice(2, 9);
  copy.name = name;
  copy.status = "draft";
  copy.version = versionTag();
  state.trames.push(copy);
  touch("trames");
  toast("Trame dupliquée", "success");
}

function exportTrame(t) {
  download(`${t.id}.json`, JSON.stringify({ kind: "trame", version: 1, trame: t }, null, 2));
}

// Télécharge un fichier d'exemple documenté : la structure attendue pour
// préparer ses trames dans un éditeur de texte, puis les réimporter.
function downloadExample() {
  download("trame-exemple.json", JSON.stringify(exampleTrameFile(), null, 2), "application/json");
  toast("Fichier d'exemple téléchargé — complétez la partie « trame », puis réimportez-le.", "info");
}

// Import : un DOCUMENT (Word ou LibreOffice) dont on propose une trame — non
// enregistrée, à relire dans l'éditeur — ou un FICHIER DE TRAMES (JSON), qui
// entre directement au registre. Les deux formats ne se lisent pas de la même
// façon (le premier est binaire), donc on les distingue par l'extension.
const EST_DOCUMENT = /\.(docx|odt)$/i;
const EST_FICHIER_TRAMES = /\.(json|txt)$/i;

async function importTrame() {
  const f = await pickBinaryFile(".docx,.odt,.json,.txt");
  if (!f) return;

  if (EST_DOCUMENT.test(f.name)) return void (await importerTrameDocument(f));

  if (!EST_FICHIER_TRAMES.test(f.name)) {
    modal({
      title: "Format non reconnu",
      body: h("div", { class: "fr-stack" },
        h("p", { text: `« ${f.name} » n'est pas dans un format accepté.` }),
        h("p", { class: "fr-small fr-muted", text: "Importez un document Word (.docx) ou LibreOffice (.odt) : l'application en propose une trame, que vous relirez dans l'éditeur avant de l'enregistrer. Ou un fichier de trames (.json) préparé hors de l'application — le « Fichier d'exemple » montre sa structure." })),
      actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })],
    });
    return;
  }

  const { trames, issues, warnings } = readTrameFile(await f.text());
  if (issues.length) {
    modal({
      title: "Import impossible",
      body: h("div", { class: "fr-stack" },
        h("p", { text: trames.length
          ? `${trames.length} trame(s) valide(s) ont été lues, mais le fichier contient des erreurs :`
          : "Le fichier n'a pas pu être lu :" }),
        ...issues.slice(0, 12).map((m) => h("p", { class: "fr-small", text: "• " + m })),
        issues.length > 12 ? h("p", { class: "fr-small fr-muted", text: `… et ${issues.length - 12} autre(s).` }) : null,
        h("p", { class: "fr-small fr-muted", text: "Téléchargez le fichier d'exemple depuis « Fichier d'exemple » pour voir la structure attendue." })),
      actions: (close) => [
        button("Télécharger l'exemple", { variant: "secondary", icon: "download", onClick: () => downloadExample() }),
        button("Fermer", { variant: "secondary", onClick: () => close() }),
      ],
    });
    if (!trames.length) return;
  }
  for (const t of trames) state.trames.push(t);
  touch("trames");
  toast(`${trames.length} trame${trames.length > 1 ? "s" : ""} importée${trames.length > 1 ? "s" : ""}`, "success");
  // Un fichier peut déclarer ses trames « mises à disposition » (c'est le cas
  // d'un export réimporté). On le dit : ces trames-là sont visibles des
  // services dès maintenant, sans que personne ait appuyé sur le bouton.
  const dejaDisponibles = trames.filter(trameEstDisponible).length;
  if (warnings.length || dejaDisponibles) {
    modal({
      title: "Import terminé — points à vérifier",
      body: h("div", { class: "fr-stack" },
        h("p", { text: "Les trames ont été importées." + (warnings.length ? " Ces points ont été complétés ou corrigés automatiquement :" : "") }),
        ...warnings.slice(0, 12).map((m) => h("p", { class: "fr-small", text: "• " + m })),
        warnings.length > 12 ? h("p", { class: "fr-small fr-muted", text: `… et ${warnings.length - 12} autre(s).` }) : null,
        dejaDisponibles
          ? h("p", { class: "fr-small fr-muted", text: `${dejaDisponibles} trame(s) arrivent avec le statut « mise à disposition » : elles sont déjà proposées aux services. Les autres restent des brouillons, à vous de les mettre à disposition quand elles seront prêtes.` })
          : null),
      actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })],
    });
  }
}

// Suppression réversible : la trame part à la corbeille, d'où elle peut être
// rétablie. Les actes déjà rédigés à partir d'elle ne sont jamais affectés —
// ils portent leur propre copie des valeurs.
async function remove(t, redraw) {
  const ok = await confirmDialog(
    "Mettre la trame à la corbeille",
    `« ${t.name} » quittera la liste des modèles et ne pourra plus servir de point de départ, mais rien n'est effacé : elle reste dans la corbeille, d'où elle peut être rétablie. Les actes déjà rédigés ne sont pas affectés.`,
    { confirmLabel: "Mettre à la corbeille", danger: true },
  );
  if (!ok) return;
  await mettreALaCorbeille("trame", t);
  toast("Trame placée à la corbeille — elle peut être rétablie", "warning");
}
