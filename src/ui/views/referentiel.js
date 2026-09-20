import { state, touch, applyBrand, redrawView, navigate, setUsers, resetDemoUsers, can, applyAuthMode, journalPour } from "../state.js";
import { h, clear, button, toast, icon, modal } from "../dom.js";
import { download, pickFile, uid, formatDate } from "../../lib/util.js";
import { textField, selectField, choiceField, confirmDialog, promptDialog, sectionHeader, helpLink } from "../components.js";
import { clearAll, saveConfig } from "../../lib/store.js";
import * as db from "../../lib/db/index.js";
import { seedConfig, seedTrames } from "../../lib/seed.js";
import { amendVocab } from "../../lib/amend.js";
import { newService, newBureau } from "../../lib/scope.js";
import { newCircuit, newStep, STEP_ROLES, STEP_KINDS } from "../../lib/validation.js";
import { DELAIS_DEFAUT } from "../../lib/execution.js";
import { DEMO_TEXT } from "../notice.js";
import { annuairePanel } from "../oidc.js";

const TABS = [
  { id: "identite", label: "Identité" },
  { id: "vocabulaire", label: "Vocabulaire" },
  { id: "numerotation", label: "Numérotation" },
  { id: "entites", label: "Entités" },
  { id: "services", label: "Services" },
  { id: "personnes", label: "Personnes" },
  { id: "roles", label: "Rôles" },
  { id: "refs", label: "Références" },
  { id: "mentions", label: "Mentions" },
  { id: "familles", label: "Familles" },
  { id: "acttypes", label: "Types d'actes" },
  { id: "circuits", label: "Circuits de validation" },
  { id: "delais", label: "Exécution & délais" },
  { id: "annuaire", label: "Annuaire (OIDC)" },
  { id: "base", label: "Base de données" },
  { id: "journal", label: "Journal d'audit" },
  { id: "donnees", label: "Données" },
];

export function renderReferentiel(root) {
  const ui = (state.ui = state.ui || {});
  ui.refTab = ui.refTab || "identite";

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Référentiel" }),
      h("p", { class: "page-head__sub", text: "Tout ce qui est configurable : marques, entités, services et bureaux, personnes, rôles, références juridiques, mentions, numérotation, vocabulaire. Rien de tout cela n'est codé dans l'application." }),
    ),
    h("div", { class: "page-head__actions" }, helpLink("administrateurs", "Aide")),
  ));

  const tabs = h("div", { class: "fr-tabs" });
  for (const t of TABS) {
    tabs.appendChild(h("button", {
      class: "fr-tab" + (ui.refTab === t.id ? " fr-tab--active" : ""),
      text: t.label,
      onClick: () => { ui.refTab = t.id; redraw(); },
    }));
  }
  root.appendChild(tabs);
  const body = h("div");
  root.appendChild(body);

  function redraw() { redrawView(); }

  const c = state.config;
  const save = () => { touch("config", { rerender: false }); applyBrand(); };

  if (ui.refTab === "identite") {
    body.appendChild(card("Marque et identité de l'organisation", "Ces valeurs alimentent l'en-tête de l'application et les métadonnées des actes. La couleur pilote les tokens du design system.",
      textField({ label: "Nom", value: c.brand.name, onChange: (v) => { c.brand.name = v; save(); } }),
      textField({ label: "Nom court (initiale du bandeau)", value: c.brand.shortName, onChange: (v) => { c.brand.shortName = v; save(); } }),
      textField({ label: "Base des URI (ELI)", value: c.brand.baseUri, help: "Ex. https://www.exemple.fr/eli", onChange: (v) => { c.brand.baseUri = v; save(); } }),
      h("div", { class: "fr-grid fr-grid--2" },
        textField({ label: "Couleur principale", value: c.brand.color, onChange: (v) => { c.brand.color = v; save(); redraw(); } }),
        textField({ label: "Couleur principale (survol)", value: c.brand.colorDark, onChange: (v) => { c.brand.colorDark = v; save(); } }),
      ),
      h("div", { class: "fr-row" },
        h("span", { class: "fr-badge", style: { background: c.brand.color, color: "#fff" }, text: "aperçu" }),
        h("button", { class: "fr-btn fr-btn--primary", text: "Bouton principal" }),
        h("button", { class: "fr-btn fr-btn--secondary", text: "Bouton secondaire" }),
      ),
      (() => {
        const logo = c.brand.logoUrl || "";
        const integre = logo.startsWith("data:");
        return h("div", { class: "fr-grid fr-grid--2" },
          textField({
            label: "URL du logo (facultatif)",
            value: integre ? "" : logo,
            placeholder: integre ? "logo intégré à la démonstration" : "",
            help: integre ? "La démonstration embarque un logo (image intégrée au référentiel). Saisissez une URL ici pour le remplacer." : "Ex. https://www.exemple.fr/logo.png",
            onChange: (v) => { c.brand.logoUrl = v.trim() || (integre ? logo : ""); save(); redraw(); },
          }),
          logo ? h("div", { class: "fr-row", style: { alignItems: "center", gap: "10px", paddingTop: "22px" } },
            h("img", { src: logo, alt: "", style: { height: "40px", borderRadius: "var(--radius)", border: "1px solid var(--border)", padding: "2px" } }),
            button("Retirer", { variant: "tertiary", size: "sm", onClick: () => { c.brand.logoUrl = ""; save(); redraw(); } }),
          ) : null,
        );
      })(),
      textField({ label: "Police d'interface", value: c.brand.uiFont || "", onChange: (v) => { c.brand.uiFont = v; save(); } }),
      textField({ label: "Police des documents", value: c.brand.documentFont || "", help: "Valeur de repli. La présentation des actes (police, logo, en-tête, filets…) se règle par feuille de style.", onChange: (v) => { c.brand.documentFont = v; save(); } }),
      can("trames.styles") ? h("p", { class: "fr-hint", style: { margin: "2px 0 0" } },
        "La charte graphique des actes — polices, logo, en-tête, diviseurs — se règle dans ",
        button("Feuilles de style", { variant: "tertiary", size: "sm", onClick: () => navigate("styles") }),
        ".",
      ) : null,
    ));
    body.appendChild(card("Contact d'aide", "Ces coordonnées apparaissent dans le guide, à la fin des chapitres, sous « Besoin d'aide ? ». Laissez vide si vous ne voulez rien afficher.",
      h("div", { class: "fr-grid fr-grid--2" },
        textField({ label: "Service ou personne à contacter", value: c.brand.supportName || "", onChange: (v) => { c.brand.supportName = v; save(); } }),
        textField({ label: "Téléphone", value: c.brand.supportPhone || "", onChange: (v) => { c.brand.supportPhone = v; save(); } }),
      ),
      textField({ label: "Adresse électronique", value: c.brand.supportEmail || "", onChange: (v) => { c.brand.supportEmail = v; save(); } }),
    ));
    body.appendChild(card("Mention de démonstration",
      "Tant qu'elle est affichée, un bandeau en tête de l'application rappelle que cette installation n'est pas en production : données fictives, signature électronique simulée. Coupez-la au moment de la mise en service réelle — le bandeau disparaît immédiatement.",
      choiceField({
        label: "Afficher le bandeau « Démonstration »",
        value: c.brand.demo !== false,
        options: [{ value: true, label: "Afficher" }, { value: false, label: "Masquer" }],
        help: "Le réglage est conservé dans le référentiel : il suit les données exportées et importées.",
        onChange: (v) => { c.brand.demo = v; touch("config"); },
      }),
      textField({
        label: "Texte du bandeau", value: c.brand.demoText || "", rows: 2,
        placeholder: DEMO_TEXT,
        help: "Laissez vide pour revenir au texte d'origine. Utile pour dire « recette », « bac à sable »…",
        onChange: (v) => {
          c.brand.demoText = v; save();
          const live = document.querySelector(".app-demo__text");
          if (live) live.textContent = v.trim() || DEMO_TEXT;
        },
      }),
    ));
  }

  if (ui.refTab === "vocabulaire") {
    body.appendChild(card("Vocabulaire des actes", "Les intitulés produits dans les documents. Adaptez-les à votre pratique rédactionnelle.",
      textField({ label: "Formule d'édiction", value: c.vocab.enact, onChange: (v) => { c.vocab.enact = v; save(); } }),
      textField({ label: "Intitulé d'article", value: c.vocab.articleLabel, onChange: (v) => { c.vocab.articleLabel = v; save(); } }),
      textField({ label: "Préfixe de visa", value: c.vocab.visasLabel, onChange: (v) => { c.vocab.visasLabel = v; save(); } }),
      textField({ label: "Ponctuation de fin de visa", value: c.vocab.visaSeparator ?? ",", onChange: (v) => { c.vocab.visaSeparator = v; save(); } }),
      textField({ label: "Préfixe de considérant", value: c.vocab.recitalsLabel, onChange: (v) => { c.vocab.recitalsLabel = v; save(); } }),
    ));

    // Tournures de la modification d'acte : elles produisent l'acte modificatif.
    c.vocab.amendment = { ...amendVocab(c) };
    const am = c.vocab.amendment;
    const amField = (key, label, help) => textField({
      label, value: am[key], help,
      onChange: (v) => { am[key] = v; save(); },
    });
    body.appendChild(card("Modification d'acte — tournures",
      "Ces phrases composent l'acte modificatif. Jetons remplacés : {designation} {designationLower} {numero} {date} {target} (l'acte modifié, seul) {targetInSentence} (l'acte modifié, dans une phrase) {article} {newArticle} {dateEffet} {authority}.",
      h("div", { class: "fr-grid fr-grid--2" },
        amField("designation", "Nature de l'acte par défaut", "Ex. Décision, Arrêté, Délibération."),
        amField("targetInSentence", "L'acte modifié, dans une phrase", "Ex. « la {designationLower} n°{numero} du {date} » ou « l'arrêté n°{numero} du {date} »."),
      ),
      amField("title", "Intitulé de l'acte modificatif"),
      amField("replace", "Remplacement d'un article"),
      amField("abrogate", "Abrogation d'un article"),
      amField("insertAfter", "Insertion d'un article après"),
      amField("insertBefore", "Insertion d'un article avant"),
      amField("append", "Ajout en fin de dispositif"),
      amField("entry", "Article d'entrée en vigueur"),
      amField("entryDefault", "Entrée en vigueur sans date d'effet"),
      amField("execution", "Article d'exécution"),
      amField("considerant", "Considérant proposé par défaut"),
      amField("consolidatedNotice", "Avertissement de la version consolidée"),
      h("div", { class: "fr-grid fr-grid--2" },
        amField("trailTitle", "Titre du tableau des modifications"),
        textField({
          label: "Colonnes du tableau", value: (am.trailHead || []).join(" | "),
          onChange: (v) => { am.trailHead = v.split("|").map((s) => s.trim()); save(); },
        }),
      ),
      h("p", { class: "fr-small fr-muted", style: { margin: "10px 0 0" },
        text: "Ces trois mentions s'affichent sous l'intitulé d'un article dans la version consolidée lorsque le suivi des modifications n'est pas affiché (option décochée par défaut). Jetons : {designationThe} (« la décision »), {designation}, {designationLower}, {numero}, {date}." }),
      h("div", { class: "fr-grid fr-grid--2" },
        amField("mentionReplace", "Mention d'un article modifié"),
        amField("mentionAbrogate", "Mention d'un article abrogé"),
      ),
      h("div", { class: "fr-grid fr-grid--2" },
        amField("mentionInsert", "Mention d'un article inséré"),
        amField("mentionThen", "Liaison entre deux modifications successives"),
      ),
    ));
  }

  if (ui.refTab === "numerotation") {
    body.appendChild(card("Numérotation et identifiants", "Le motif compose le numéro d'acte ; le motif ELI compose l'identifiant persistant et les URI de publication.",
      textField({ label: "Motif du numéro", value: c.numbering.pattern, help: "Jetons : {year} {seq} {entityCode}", onChange: (v) => { c.numbering.pattern = v; save(); } }),
      textField({ label: "Prochain numéro de séquence", value: c.numbering.seq, type: "number", onChange: (v) => { c.numbering.seq = Number(v) || 0; save(); } }),
      textField({ label: "Longueur de la séquence", value: c.numbering.pad, type: "number", onChange: (v) => { c.numbering.pad = Number(v) || 3; save(); } }),
      textField({ label: "Année de référence", value: c.numbering.year, type: "number", onChange: (v) => { c.numbering.year = Number(v) || new Date().getFullYear(); save(); } }),
      textField({ label: "Motif ELI", value: c.numbering.eliPattern, help: "Jetons : {baseUri} {actTypeId} {year} {seq} {entityCode}", onChange: (v) => { c.numbering.eliPattern = v; save(); } }),
    ));
  }

  if (ui.refTab === "entites") {
    body.appendChild(listPanel({
      title: "Entités", help: "Commune, établissements publics, associations, services : toute structure citée ou signataire d'un acte. Le code alimente la numérotation.",
      items: c.entities, factory: () => ({ id: uid("ent"), code: "XXX", kind: "commune", name: "Nouvelle entité", legalName: "", seatCity: "", tribunal: "", parentId: "" }),
      fields: (rec) => [
        { key: "code", label: "Code", type: "text" },
        { key: "kind", label: "Nature", type: "select", options: ["commune", "etablissement-public", "etablissement", "association", "service"] },
        { key: "name", label: "Nom", type: "text" },
        { key: "nameWithArt", label: "Nom avec article (dans une phrase)", type: "text", help: "Ex. « la commune de Valmont-sur-Loire »" },
        { key: "authorityFormula", label: "Formule d'autorité", type: "text", help: "Ligne d'en-tête de l'acte, ex. « Le maire de Valmont-sur-Loire »" },
        { key: "legalName", label: "Dénomination juridique", type: "text" },
        { key: "seatCity", label: "Ville du siège", type: "text" },
        { key: "tribunal", label: "Tribunal administratif compétent", type: "text" },
        { key: "parentId", label: "Entité de rattachement", type: "select", options: c.entities.filter((e) => e.id !== rec.id).map((e) => ({ value: e.id, label: e.name })), placeholder: "—" },
      ],
      save,
    }));
  }

  if (ui.refTab === "services") {
    body.appendChild(servicesPanel(save, redraw));
  }

  if (ui.refTab === "personnes") {
    body.appendChild(listPanel({
      title: "Personnes", help: "Signataires et bénéficiaires d'actes. Chaque personne peut porter des références (acte de nomination, contrat…).",
      items: c.people, factory: () => ({ id: uid("p"), civility: "Madame", firstName: "", lastName: "", entityId: c.entities[0]?.id || "", roles: [] }),
      fields: () => [
        { key: "civility", label: "Civilité", type: "select", options: ["Madame", "Monsieur", "Monsieur le", "Madame la"] },
        { key: "firstName", label: "Prénom", type: "text" },
        { key: "lastName", label: "Nom", type: "text" },
        { key: "entityId", label: "Entité", type: "select", options: c.entities.map((e) => ({ value: e.id, label: e.name })), placeholder: "—" },
        { key: "roles", label: "Rôles", type: "multichoice", options: c.roles.map((r) => ({ value: r.id, label: r.label })) },
      ],
      save,
    }));
  }

  if (ui.refTab === "roles") {
    body.appendChild(listPanel({
      title: "Rôles", help: "Fonctions utilisables pour qualifier une personne (apparaît sous la signature).",
      items: c.roles, factory: () => ({ id: uid("role"), label: "Nouveau rôle" }),
      fields: () => [{ key: "label", label: "Libellé", type: "text" }],
      save,
    }));
  }

  if (ui.refTab === "refs") {
    body.appendChild(listPanel({
      title: "Références juridiques et actes", help: "Textes et actes réutilisables dans les visas. Une référence rattachée à une entité est retenue automatiquement quand la trame demande « la référence de cette nature pour l'entité signataire ».",
      items: c.refs, factory: () => ({ id: uid("ref"), kind: "decret", label: "", entityId: "", scope: "all", active: true, source: "" }),
      fields: (rec) => [
        { key: "kind", label: "Nature", type: "text", help: "Ex. decret, arrete, decision, deliberation, reglement" },
        { key: "label", label: "Intitulé complet", type: "textarea" },
        { key: "entityId", label: "Entité rattachée", type: "select", options: c.entities.map((e) => ({ value: e.id, label: e.name })), placeholder: "— toutes —" },
        { key: "scope", label: "Portée", type: "select", options: [{ value: "all", label: "Générale" }, { value: "entity", label: "Par entité" }] },
        { key: "active", label: "En vigueur", type: "boolean" },
        { key: "source", label: "URL de la source", type: "text" },
      ],
      save,
    }));
  }

  if (ui.refTab === "mentions") {
    body.appendChild(listPanel({
      title: "Mentions", help: "Blocs de texte réutilisables (voies et délais de recours, publication, portée informationnelle). Les jetons {{…}} y sont interprétés.",
      items: c.mentions, factory: () => ({ id: uid("men"), kind: "publication", label: "", text: "" }),
      fields: () => [
        { key: "kind", label: "Nature", type: "select", options: [{ value: "recours", label: "Voies et délais de recours" }, { value: "publication", label: "Publication" }, { value: "notification", label: "Notification (acte individuel)" }, { value: "autre", label: "Autre" }] },
        { key: "label", label: "Libellé", type: "text" },
        { key: "text", label: "Texte", type: "textarea", rows: 4 },
      ],
      save,
    }));
  }

  if (ui.refTab === "familles") {
    body.appendChild(listPanel({
      title: "Familles d'actes", help: "Classement des trames (nominations, délégations, tarifs…).",
      items: c.families, factory: () => ({ id: uid("fam"), label: "Nouvelle famille" }),
      fields: () => [{ key: "label", label: "Libellé", type: "text" }],
      save,
    }));
  }

  if (ui.refTab === "acttypes") {
    body.appendChild(listPanel({
      title: "Types d'actes", help: "Nature juridique de l'acte ; le type alimente les métadonnées et la référence ELI.",
      items: c.actTypes, factory: () => ({ id: "nouveau", label: "Nouveau type", aknElement: "act" }),
      fields: () => [
        { key: "id", label: "Identifiant", type: "text" },
        { key: "label", label: "Libellé", type: "text" },
        { key: "aknElement", label: "Élément Akoma Ntoso", type: "text" },
      ],
      save,
    }));
  }

  if (ui.refTab === "annuaire") {
    body.appendChild(annuairePanel(save, redraw, card));
  }

  if (ui.refTab === "base") {
    body.appendChild(databasePanel());
  }

  if (ui.refTab === "circuits") {
    body.appendChild(circuitsPanel(save, redraw));
  }

  if (ui.refTab === "delais") {
    body.appendChild(delaisPanel(save, redraw));
  }

  if (ui.refTab === "journal") {
    body.appendChild(journalPanel());
  }

  if (ui.refTab === "donnees") {
    body.appendChild(card("Données", "Sauvegarde et restauration complètes : référentiel, trames, actes et comptes. Un fichier suffit pour installer l'application dans une autre structure.",
      h("div", { class: "fr-row" },
        button("Exporter tout (JSON)", { variant: "primary", icon: "download", onClick: exportAll }),
        button("Importer un fichier", { variant: "secondary", icon: "upload", onClick: importAll }),
      ),
      h("hr", { class: "fr-sep" }),
      h("p", { class: "fr-small fr-muted", text: `Actuellement : ${c.entities.length} entités · ${(c.services || []).length} services · ${c.people.length} personnes · ${c.refs.length} références · ${state.trames.length} trames · ${state.actes.length} actes · ${state.users.length} comptes.` }),
      h("div", { class: "fr-row" },
        button("Vider le référentiel", { variant: "secondary", danger: true, onClick: resetConfig }),
        button("Réinstaller le jeu de démonstration", { variant: "tertiary", onClick: resetAll }),
      ),
      h("hr", { class: "fr-sep" }),
      h("p", { class: "fr-small fr-muted", text: "Les comptes et leurs rôles se gèrent dans « Comptes et rôles »." }),
      h("p", { class: "fr-small fr-muted", text: "Le mode de connexion — comptes de l'application, ou annuaire de la collectivité (OIDC) — se règle dans l'onglet « Annuaire (OIDC) ». Brancher l'annuaire désactive automatiquement les comptes de démonstration." }),
      h("p", { class: "fr-small fr-muted", text: "Le rangement des données — stockage de ce navigateur, service partagé, ou base MySQL / MariaDB de la collectivité — se règle dans l'onglet « Base de données »." }),
      h("div", { class: "fr-row" },
        button("Comptes et rôles", { variant: "secondary", icon: "lock", onClick: () => navigate("comptes") }),
        button("Base de données", { variant: "secondary", icon: "grid", onClick: () => { ui.refTab = "base"; redraw(); } }),
      ),
    ));
  }
}

// ------------------------------------------------------------- base de données
// On ne range pas ici des données : on choisit *où* elles vivent. Le réglage
// est propre au poste (il n'est pas exporté avec le référentiel) : chaque poste
// peut viser la même base partagée.
function databasePanel() {
  const ui = state.ui;
  ui.dbDraft = ui.dbDraft || { ...db.getSettings() };
  const d = ui.dbDraft;

  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("h2", { class: "fr-card__title", text: "Base de données" }));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: "Où sont rangés le référentiel, les trames, les actes et les comptes. En démonstration, le stockage du navigateur suffit ; en exploitation, l'application se branche sur la base de la collectivité (MySQL / MariaDB) et tous les postes travaillent alors sur les mêmes données." }));

  const active = db.getSettings();
  const st = db.status();
  const live = h("div", { class: "fr-row", style: { flexWrap: "wrap", gap: "8px", alignItems: "center", margin: "10px 0 18px", minHeight: "22px" } });

  wrap.appendChild(h("div", { class: "fr-row", style: { flexWrap: "wrap", gap: "8px", alignItems: "center" } },
    h("span", { class: "fr-badge fr-badge--info", text: "En service : " + db.modeById(active.mode).label }),
    stateBadge(db.status()),
    db.pendingCount() ? h("span", { class: "fr-badge fr-badge--warning", text: `${db.pendingCount()} écriture(s) en attente de la base` }) : null,
    h("div", { class: "fr-spacer" }),
    button("Tester la connexion", {
      variant: "secondary", size: "sm", icon: "refresh",
      onClick: async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        clear(live);
        live.appendChild(h("span", { class: "fr-small fr-muted", text: "Test en cours…" }));
        const res = await db.test(d);
        clear(live);
        live.appendChild(h("span", { class: `fr-badge fr-badge--${res.ok ? "success" : "error"}`, text: res.ok ? "Connexion réussie" : "Échec de la connexion" }));
        live.appendChild(h("span", { class: "fr-small fr-muted", text: res.detail || "" }));
        btn.disabled = false;
      },
    }),
  ));
  wrap.appendChild(live);

  const fields = h("div");
  const paintFields = () => {
    clear(fields);
    if (d.mode === "external") {
      fields.appendChild(textField({
        label: "Adresse du service de données", value: d.url || "", placeholder: "https://donnees.valmont-sur-loire.fr",
        help: "L'URL de base du serveur déployé (voir src/server/README.md). Laissez vide si l'application est servie par ce même serveur — c'est le cas du déploiement auto-hébergé ; sinon les chemins /v1/db/… y sont ajoutés.",
        onChange: (v) => { d.url = v.trim(); },
      }));
      fields.appendChild(textField({
        label: "Jeton d'API", value: d.token || "",
        help: "Jeton d'écriture remis par l'administrateur de la base. Seule son empreinte SHA-256 est conservée côté serveur.",
        onChange: (v) => { d.token = v.trim(); },
      }));
    } else if (d.mode === "service") {
      fields.appendChild(h("p", { class: "fr-hint", text: "Aucun réglage : ce mode utilise le jeton du service de démonstration, déjà inscrit dans l'application. Rien à installer, et les données sont partagées entre les postes." }));
    }
  };

  wrap.appendChild(choiceField({
    label: "Mode de persistance",
    value: d.mode,
    options: db.MODES.map((m) => ({ value: m.id, label: m.label })),
    onChange: (v) => { d.mode = v; redrawView(); },
  }));
  wrap.appendChild(h("p", { class: "fr-hint", text: db.modeById(d.mode).help }));
  wrap.appendChild(fields);
  paintFields();

  const dirty = d.mode !== active.mode
    || (d.mode === "external" && ((d.url || "") !== (active.url || "") || (d.token || "") !== (active.token || "")));
  wrap.appendChild(h("div", { class: "fr-row", style: { marginTop: "10px" } },
    button("Appliquer et recharger", {
      variant: "primary", icon: "check", disabled: !dirty,
      onClick: async () => {
        await db.setSettings({ mode: d.mode, url: d.url || "", token: d.token || "" }, { silent: true });
        toast("Base de données enregistrée — rechargement…", "success");
        location.reload();
      },
    }),
    dirty ? h("span", { class: "fr-small fr-muted", text: "Le changement prend effet au rechargement de l'application." }) : h("span", { class: "fr-small fr-muted", text: "Réglage à jour." }),
  ));

  wrap.appendChild(h("hr", { class: "fr-sep" }));
  wrap.appendChild(h("h3", { style: { fontSize: ".95rem", margin: "0 0 6px" }, text: "Transfert de données" }));
  wrap.appendChild(h("p", { class: "fr-small fr-muted", text: "Pour installer la base, ou pour repartir des données d'un poste : ces deux opérations travaillent sur les données affichées à l'écran." }));

  const counts = h("p", { class: "fr-small fr-muted" });
  const c = state.config;
  counts.textContent = `À l'écran : ${c.entities.length} entités · ${(c.services || []).length} services · ${state.trames.length} trames · ${state.actes.length} actes · ${state.users.length} comptes.`;

  const report = h("div", { class: "fr-small" });
  const showReport = (rows, verb) => {
    clear(report);
    const bad = rows.filter((r) => !r.ok);
    report.appendChild(h("p", { class: bad.length ? "fr-error-text" : "fr-small", text: bad.length ? `${verb} : ${bad.length} collection(s) en échec — ${bad.map((b) => b.name + " (" + b.error + ")").join(", ")}` : `${verb} : terminé.` }));
  };

  wrap.appendChild(h("div", { class: "fr-row", style: { flexWrap: "wrap", gap: "8px", marginTop: "8px" } },
    button(db.isShared() ? "Envoyer les données à la base" : "Copier vers le stockage local", {
      variant: "secondary", icon: "upload",
      onClick: async () => {
        const rows = await db.push({ config: state.config, trames: state.trames, actes: state.actes, users: state.users });
        const bad = rows.filter((r) => !r.ok);
        if (bad.length) { showReport(rows, "Envoi"); toast("Envoi partiel — voir le détail", "error"); }
        else { clear(report); report.appendChild(h("p", { class: "fr-small", text: "Envoi terminé : le référentiel, les trames, les actes et les comptes ont été écrits dans la base." })); toast("Données envoyées à la base", "success"); }
        redrawView();
      },
    }),
    button("Récupérer depuis la base", {
      variant: "secondary", icon: "download",
      disabled: !db.isShared(),
      onClick: async () => {
        const ok = await confirmDialog("Récupérer depuis la base", "Les données affichées seront remplacées par celles de la base de données. Les modifications non enregistrées sur ce poste seront perdues.", { confirmLabel: "Récupérer" });
        if (!ok) return;
        const res = await db.pull();
        const rows = Object.entries(res).map(([name, r]) => ({ name, ...r }));
        showReport(rows, "Récupération");
        if (res.config?.ok) { state.config = res.config.value; applyBrand(); }
        if (res.trames?.ok) state.trames = res.trames.value || [];
        if (res.actes?.ok) state.actes = res.actes.value || [];
        if (res.users?.ok) { state.users = res.users.value || []; await setUsers(state.users); }
        toast("Données récupérées depuis la base", "success");
        redrawView();
      },
    }),
  ));
  wrap.appendChild(counts);
  wrap.appendChild(report);
  wrap.appendChild(h("p", { class: "fr-small fr-muted", style: { marginTop: "10px" }, text: "La session et les réglages de ce poste restent locaux. Le jeton de la base n'est jamais exporté avec le référentiel." }));

  return wrap;
}

function stateBadge(st) {
  const map = {
    ok: ["success", "Base disponible"],
    offline: ["warning", "Service injoignable"],
    error: ["error", "Erreur de connexion"],
    unknown: ["info", "État inconnu"],
  };
  const [color, label] = map[st.state] || map.unknown;
  return h("span", { class: `fr-badge fr-badge--${color}`, title: st.detail || "", text: label });
}

function card(title, sub, ...children) {
  return h("div", { class: "fr-card", style: { maxWidth: "900px" } },
    h("h2", { class: "fr-card__title", text: title }),
    sub ? h("p", { class: "fr-card__sub", text: sub }) : null,
    ...children);
}

// -------------------------------------------------------------- services
// Les services sont l'échelon auquel les comptes sont rattachés, et chaque
// service regroupe des bureaux. Les bureaux sont donc édités *dans* le service
// (liste imbriquée) plutôt que dans un onglet séparé.
function servicesPanel(save, redraw) {
  const c = state.config;
  c.services = c.services || [];
  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("div", { class: "fr-row" },
    h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: "Services et bureaux" }),
    button("Ajouter un service", {
      variant: "secondary", size: "sm", icon: "plus",
      onClick: () => { c.services.push(newService({ entityId: c.entities?.[0]?.id || "" })); save(); redraw(); },
    }),
  ));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: "Un service regroupe des bureaux. Les comptes sont rattachés à des services : par défaut, un compte a accès à tous les bureaux de son service, et l'administrateur peut ensuite restreindre son accès à certains bureaux (onglet « Comptes et rôles »)." }));

  const listEl = h("div", { class: "fr-stack", style: { marginTop: "10px" } });
  wrap.appendChild(listEl);

  const counts = (serviceId) => state.users.filter((u) => (u.memberships || []).some((m) => m.serviceId === serviceId)).length;

  if (!c.services.length) listEl.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun service. Sans service, les trames restent générales et tous les comptes voient tout." }));

  c.services.forEach((rec, i) => {
    rec.bureaux = rec.bureaux || [];
    const box = h("div", { class: "fr-card", style: { background: "var(--bg-alt)" } });
    box.appendChild(h("div", { class: "fr-row" },
      h("strong", { class: "fr-small", text: `${rec.code || "?"} — ${rec.name || "Sans nom"}` }),
      h("span", { class: "fr-badge", text: `${rec.bureaux.length} bureau${rec.bureaux.length > 1 ? "x" : ""}` }),
      h("span", { class: "fr-badge fr-badge--info", text: `${counts(rec.id)} compte(s)` }),
      h("div", { class: "fr-spacer" }),
      button("", { variant: "tertiary", icon: "up", size: "sm", title: "Monter", onClick: () => { if (i > 0) { const [x] = c.services.splice(i, 1); c.services.splice(i - 1, 0, x); save(); redraw(); } } }),
      button("", { variant: "tertiary", icon: "down", size: "sm", title: "Descendre", onClick: () => { if (i < c.services.length - 1) { const [x] = c.services.splice(i, 1); c.services.splice(i + 1, 0, x); save(); redraw(); } } }),
      button("", { variant: "tertiary", icon: "trash", size: "sm", title: "Supprimer le service", onClick: () => removeService(rec, save, redraw) }),
    ));
    box.appendChild(h("div", { class: "fr-grid fr-grid--2" },
      textField({ label: "Code", value: rec.code || "", help: "Abréviation affichée dans les listes (ex. DSI).", onChange: (v) => { rec.code = v; save(); } }),
      textField({ label: "Nom du service", value: rec.name || "", onChange: (v) => { rec.name = v; save(); } }),
    ));
    if (c.entities?.length) {
      box.appendChild(selectField({
        label: "Entité de rattachement", value: rec.entityId || "", placeholder: "—",
        options: c.entities.map((e) => ({ value: e.id, label: e.name })),
        onChange: (v) => { rec.entityId = v; save(); },
      }));
    }

    box.appendChild(h("span", { class: "fr-label", style: { marginTop: "8px" }, text: "Bureaux" }));
    if (!rec.bureaux.length) box.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun bureau : tout le service est traité d'un seul tenant." }));
    for (const b of rec.bureaux) {
      box.appendChild(h("div", { class: "fr-row", style: { gap: "6px", flexWrap: "nowrap" } },
        h("input", {
          class: "fr-input", style: { flex: "1 1 auto", minWidth: "0" }, value: b.name || "",
          placeholder: "Nom du bureau",
          on: { input: (e) => { b.name = e.target.value; save(); } },
        }),
        button("", {
          variant: "tertiary", icon: "trash", size: "sm", title: "Supprimer le bureau",
          onClick: () => removeBureau(rec, b, save, redraw),
        }),
      ));
    }
    box.appendChild(h("div", { class: "fr-row", style: { marginTop: "6px" } },
      button("Ajouter un bureau", { variant: "secondary", size: "sm", icon: "plus", onClick: () => { rec.bureaux.push(newBureau()); save(); redraw(); } }),
    ));
    listEl.appendChild(box);
  });
  return wrap;
}

async function removeService(rec, save, redraw) {
  const n = state.users.filter((u) => (u.memberships || []).some((m) => m.serviceId === rec.id)).length;
  const ok = await confirmDialog("Supprimer le service",
    `« ${rec.code || "?"} — ${rec.name} » sera retiré du référentiel.${n ? ` ${n} compte(s) y sont rattachés : ce rattachement sera également supprimé.` : ""}`,
    { confirmLabel: "Supprimer", danger: true });
  if (!ok) return;
  state.config.services = state.config.services.filter((s) => s.id !== rec.id);
  let touchedUsers = false;
  for (const u of state.users) {
    if ((u.memberships || []).some((m) => m.serviceId === rec.id)) {
      u.memberships = u.memberships.filter((m) => m.serviceId !== rec.id);
      touchedUsers = true;
    }
  }
  if (touchedUsers) await setUsers(state.users);
  save(); redraw();
}

async function removeBureau(service, bureau, save, redraw) {
  const n = state.users.filter((u) => (u.memberships || []).some((m) => Array.isArray(m.bureaux) && m.bureaux.includes(bureau.id))).length;
  const ok = await confirmDialog("Supprimer le bureau",
    `« ${bureau.name || "Bureau"} » sera retiré du service « ${service.name} ».${n ? ` Son retrait élargit l'accès de ${n} compte(s) restreint(s) à certains bureaux.` : ""}`,
    { confirmLabel: "Supprimer", danger: true });
  if (!ok) return;
  service.bureaux = service.bureaux.filter((b) => b.id !== bureau.id);
  let touchedUsers = false;
  for (const u of state.users) for (const m of u.memberships || []) {
    if (Array.isArray(m.bureaux) && m.bureaux.includes(bureau.id)) { m.bureaux = m.bureaux.filter((id) => id !== bureau.id); touchedUsers = true; }
  }
  if (touchedUsers) await setUsers(state.users);
  save(); redraw();
}

function listPanel({ title, help, items, fields, factory, save }) {
  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("div", { class: "fr-row" },
    h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: title }),
    button("Ajouter", { variant: "secondary", size: "sm", icon: "plus", onClick: () => { items.push(factory()); save(); rerenderPanel(); } }),
  ));
  if (help) wrap.appendChild(h("p", { class: "fr-card__sub", text: help }));
  const listEl = h("div", { class: "fr-stack" });
  wrap.appendChild(listEl);
  renderRows();
  function rerenderPanel() { clear(listEl); renderRows(); }

  function renderRows() {
    if (!items.length) { listEl.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun élément." })); return; }
    items.forEach((rec, i) => {
      const box = h("div", { class: "fr-card", style: { background: "var(--bg-alt)" } });
      box.appendChild(h("div", { class: "fr-row" },
        h("strong", { class: "fr-small", text: String(rec.label || rec.name || rec.id || ("#" + (i + 1))).slice(0, 70) }),
        h("div", { class: "fr-spacer" }),
        button("", { variant: "tertiary", icon: "up", size: "sm", title: "Monter", onClick: () => { if (i > 0) { const [x] = items.splice(i, 1); items.splice(i - 1, 0, x); save(); rerenderPanel(); } } }),
        button("", { variant: "tertiary", icon: "down", size: "sm", title: "Descendre", onClick: () => { if (i < items.length - 1) { const [x] = items.splice(i, 1); items.splice(i + 1, 0, x); save(); rerenderPanel(); } } }),
        button("", { variant: "tertiary", icon: "trash", size: "sm", title: "Supprimer", onClick: async () => {
          const ok = await confirmDialog("Supprimer", "Cet élément sera retiré du référentiel.", { confirmLabel: "Supprimer", danger: true });
          if (ok) { items.splice(i, 1); save(); rerenderPanel(); }
        } }),
      ));
      for (const f of fields(rec)) {
        const set = (v) => { rec[f.key] = v; save(); };
        if (f.type === "textarea") box.appendChild(textField({ label: f.label, value: rec[f.key] || "", rows: f.rows || 3, help: f.help, onChange: set }));
        else if (f.type === "boolean") box.appendChild(h("label", { class: "fr-check" }, (() => { const cb = h("input", { type: "checkbox", checked: !!rec[f.key] }); cb.addEventListener("change", () => set(cb.checked)); return cb; })(), f.label));
        else if (f.type === "select") box.appendChild(selectField({ label: f.label, value: rec[f.key] || "", help: f.help, placeholder: f.placeholder ?? "—", options: (f.options || []).map(normOpt), onChange: set }));
        else if (f.type === "multichoice") box.appendChild(choiceField({ label: f.label, value: rec[f.key] || [], help: f.help, multi: true, options: (f.options || []).map(normOpt), onChange: set }));
        else box.appendChild(textField({ label: f.label, value: rec[f.key] ?? "", help: f.help, onChange: set }));
      }
      listEl.appendChild(box);
    });
  }
  return wrap;
}

const normOpt = (o) => (typeof o === "string" ? { value: o, label: o } : o);

// ------------------------------------------------------------------ données
function exportAll() {
  download(`referentiel-actes-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({
    kind: "actes-app", version: 1,
    exportedAt: new Date().toISOString(),
    config: state.config, trames: state.trames, actes: state.actes, users: state.users,
  }, null, 2));
}

async function importAll() {
  const f = await pickFile(".json");
  if (!f) return;
  try {
    const d = JSON.parse(f.text);
    if (d.config) { state.config = d.config; await saveConfig(state.config); applyBrand(); }
    if (Array.isArray(d.trames)) state.trames = d.trames;
    if (Array.isArray(d.actes)) state.actes = d.actes;
    touch("trames"); touch("actes");
    if (Array.isArray(d.users) && d.users.length) await setUsers(d.users);
    // Le référentiel importé peut changer le mode d'authentification (annuaire
    // ou comptes de l'application) : on réapplique, sinon les comptes de
    // démonstration resteraient actifs alors que l'annuaire est branché.
    await applyAuthMode();
    toast("Données importées", "success");
  } catch (e) {
    toast("Import impossible : " + e.message, "error");
  }
}

async function resetConfig() {
  const ok = await confirmDialog("Vider le référentiel", "Entités, personnes, rôles, références, mentions, familles et types d'actes seront remis à zéro. Les trames et les actes sont conservés.", { confirmLabel: "Vider", danger: true });
  if (!ok) return;
  const keep = { brand: state.config.brand, numbering: state.config.numbering, vocab: state.config.vocab };
  state.config = { ...state.config, entities: [], services: [], people: [], roles: [], refs: [], mentions: [], families: [], actTypes: state.config.actTypes.length ? state.config.actTypes : [{ id: "decision", label: "Décision", aknElement: "act" }] };
  touch("config");
  toast("Référentiel vidé");
}

async function resetAll() {
  const ok = await confirmDialog("Réinstaller la démonstration", "Référentiel, trames, actes et comptes locaux seront remplacés par le jeu de données initial.", { confirmLabel: "Réinstaller", danger: true });
  if (!ok) return;
  await clearAll();
  state.config = seedConfig();
  state.trames = seedTrames();
  state.actes = [];
  touch("config"); touch("trames"); touch("actes");
  await resetDemoUsers();
  applyBrand();
  toast("Jeu de démonstration réinstallé", "success");
}

// ------------------------------------------------- circuits de validation
// Un circuit est une DONNÉE du référentiel, pas une règle codée : c'est ici
// qu'on décide du chemin que suit un acte avant la signature, et de qui le
// valide. Le parapheur (src/lib/validation.js) ne fait que l'appliquer — un
// référentiel sans circuit n'a donc aucun parapheur, ce qui préserve le
// comportement d'origine.
function circuitsPanel(save, redraw) {
  const c = state.config;
  c.circuits = c.circuits || [];
  const wrap = h("div", { class: "fr-stack", style: { maxWidth: "980px" } });
  const paint = () => { save(); redraw(); };

  wrap.appendChild(h("div", { class: "fr-card" },
    h("div", { class: "fr-row" },
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: "Circuits de validation" }),
      button("Nouveau circuit", { variant: "secondary", size: "sm", icon: "plus", onClick: () => { c.circuits.push(newCircuit()); paint(); } }),
    ),
    h("p", { class: "fr-card__sub", text: "Le chemin que suit un acte avant d'être signé : une suite d'étapes, chacune confiée à un rôle, qui demande un bon pour accord ou un simple avis. Les étapes sont séquentielles. Un circuit sans ciblage s'applique à tous les actes ; un circuit ciblé l'emporte sur lui." }),
  ));

  if (!c.circuits.length) {
    wrap.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun circuit : les actes partent en signature sans validation préalable." }));
  }
  c.circuits.forEach((cir, i) => wrap.appendChild(circuitCard(cir, i, paint)));
  return wrap;
}

function circuitCard(cir, i, paint) {
  const c = state.config;
  const garder = () => touch("config", { rerender: false });
  const box = h("div", { class: "fr-card", style: { background: "var(--bg-alt)" } });

  box.appendChild(h("div", { class: "fr-row" },
    h("strong", { text: cir.label || "Circuit sans nom" }),
    h("span", { class: "fr-badge fr-badge--" + (cir.active === false ? "warning" : "success"), text: cir.active === false ? "inactif" : "actif" }),
    h("span", { class: "fr-small fr-muted", text: (cir.steps || []).length + " étape(s)" }),
    h("div", { class: "fr-spacer" }),
    button("", { variant: "tertiary", size: "sm", icon: "up", title: "Monter", onClick: () => { if (i === 0) return; const [x] = c.circuits.splice(i, 1); c.circuits.splice(i - 1, 0, x); paint(); } }),
    button("", { variant: "tertiary", size: "sm", icon: "down", title: "Descendre", onClick: () => { if (i >= c.circuits.length - 1) return; const [x] = c.circuits.splice(i, 1); c.circuits.splice(i + 1, 0, x); paint(); } }),
    button("", { variant: "tertiary", size: "sm", icon: "trash", title: "Supprimer", onClick: async () => {
      const ok = await confirmDialog("Supprimer le circuit", `« ${cir.label} » cessera de s'appliquer aux nouveaux actes. Les circuits déjà ouverts sur des actes en cours restent inchangés.`, { confirmLabel: "Supprimer", danger: true });
      if (!ok) return;
      c.circuits.splice(i, 1);
      paint();
    } }),
  ));

  box.appendChild(textField({ label: "Libellé", value: cir.label || "", onChange: (v) => { cir.label = v; garder(); } }));
  box.appendChild(textField({ label: "Description", value: cir.description || "", rows: 2, help: "À quoi sert ce circuit (facultatif).", onChange: (v) => { cir.description = v; garder(); } }));

  const actif = h("input", { type: "checkbox", checked: cir.active !== false });
  actif.addEventListener("change", () => { cir.active = actif.checked; paint(); });
  box.appendChild(h("label", { class: "fr-check" }, actif, "Circuit actif (un circuit inactif ne s'applique à aucun nouvel acte)"));

  // ------------------------------------------------------------- ciblage
  box.appendChild(sectionHeader("À quels actes ce circuit s'applique-t-il ?"));
  box.appendChild(h("p", { class: "fr-small fr-muted", text: "Sans aucune sélection, le circuit s'applique à tous les actes (circuit général de l'établissement). Dès qu'un ciblage est posé, le circuit ne s'applique qu'aux actes correspondants — et il l'emporte sur un circuit général." }));
  box.appendChild(choiceField({
    label: "Trames concernées", value: cir.trameIds || [], multi: true,
    options: state.trames.map((t) => ({ value: t.id, label: t.name })),
    onChange: (v) => { cir.trameIds = v; garder(); },
  }));
  box.appendChild(choiceField({
    label: "Familles d'actes", value: cir.familyIds || [], multi: true,
    options: (c.families || []).map((f) => ({ value: f.id, label: f.label || f.id })),
    onChange: (v) => { cir.familyIds = v; garder(); },
  }));
  box.appendChild(choiceField({
    label: "Entités signataires", value: cir.entityIds || [], multi: true,
    options: (c.entities || []).map((e) => ({ value: e.id, label: e.name })),
    onChange: (v) => { cir.entityIds = v; garder(); },
  }));

  // ------------------------------------------------------------- étapes
  box.appendChild(sectionHeader("Étapes du circuit",
    button("Ajouter une étape", { variant: "tertiary", size: "sm", icon: "plus", onClick: () => { (cir.steps = cir.steps || []).push(newStep()); paint(); } })));
  if (!(cir.steps || []).length) {
    box.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucune étape : ce circuit n'ouvrira pas de parapheur." }));
  }
  (cir.steps || []).forEach((s, j) => box.appendChild(etapeEdit(s, j, cir, paint)));
  return box;
}

function etapeEdit(s, j, cir, paint) {
  const garder = () => touch("config", { rerender: false });
  const sub = h("div", { class: "fr-card", style: { background: "var(--bg)" } });
  sub.appendChild(h("div", { class: "fr-row" },
    h("strong", { class: "fr-small", text: `Étape ${j + 1} — ${s.label || ""}` }),
    h("div", { class: "fr-spacer" }),
    button("", { variant: "tertiary", size: "sm", icon: "up", title: "Monter", onClick: () => { if (j === 0) return; const [x] = cir.steps.splice(j, 1); cir.steps.splice(j - 1, 0, x); paint(); } }),
    button("", { variant: "tertiary", size: "sm", icon: "down", title: "Descendre", onClick: () => { if (j >= cir.steps.length - 1) return; const [x] = cir.steps.splice(j, 1); cir.steps.splice(j + 1, 0, x); paint(); } }),
    button("", { variant: "tertiary", size: "sm", icon: "trash", title: "Supprimer", onClick: () => { cir.steps.splice(j, 1); paint(); } }),
  ));
  sub.appendChild(textField({ label: "Intitulé de l'étape", value: s.label || "", onChange: (v) => { s.label = v; garder(); } }));
  sub.appendChild(selectField({ label: "Rôle attendu", value: s.role || "editeur", options: STEP_ROLES.map((r) => ({ value: r.id, label: r.label })), onChange: (v) => { s.role = v; garder(); } }));
  sub.appendChild(selectField({ label: "Nature", value: s.kind || "accord", help: "Un bon pour accord conditionne la suite ; un avis est consultatif.", options: STEP_KINDS.map((k) => ({ value: k.id, label: k.label })), onChange: (v) => { s.kind = v; garder(); } }));
  const scope = h("input", { type: "checkbox", checked: s.serviceScoped !== false });
  scope.addEventListener("change", () => { s.serviceScoped = scope.checked; garder(); });
  sub.appendChild(h("label", { class: "fr-check" }, scope, "Le valideur doit relever du service de l'acte"));
  const opt = h("input", { type: "checkbox", checked: !!s.optional });
  opt.addEventListener("change", () => { s.optional = opt.checked; garder(); });
  sub.appendChild(h("label", { class: "fr-check" }, opt, "Étape facultative (elle peut être passée)"));
  sub.appendChild(textField({ label: "Consigne affichée au valideur", value: s.help || "", rows: 2, onChange: (v) => { s.help = v; garder(); } }));
  return sub;
}

// ------------------------------------------------------------ délais
// Les délais ne sont pas des constantes juridiques universelles : ce sont des
// objectifs de gestion, réglables par la collectivité. Le seul qui soit
// juridiquement structurant est le délai de recours contentieux (deux mois à
// compter de l'exécutoire) — il est ici pour mémoire, et peut être ajusté si
// l'établissement relève d'un régime particulier.
function delaisPanel(save, redraw) {
  const c = state.config;
  const d = (c.delais = { ...DELAIS_DEFAUT, ...(c.delais || {}) });
  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("h2", { class: "fr-card__title", text: "Exécution & délais" }));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: "Ce qui rend un acte exécutoire, et ce qui fait courir le délai de recours. Ces valeurs alimentent l'échéancier (écran « Exécution & délais ») : elles ne bloquent rien, elles signalent ce qui traîne." }));
  const num = (label, key, help) => textField({
    label, type: "number", value: String(d[key]), help,
    onChange: (v) => { d[key] = Math.max(0, Number(v) || 0); save(); },
  });
  wrap.appendChild(num("Délai de recours contentieux (mois)", "recoursMois",
    "Deux mois à compter de l'exécutoire (transmission au contrôle de légalité, et publication ou notification)."));
  wrap.appendChild(num("Transmission au contrôle de légalité (jours)", "transmissionJours",
    "Objectif : au-delà, l'échéancier signale un retard de transmission."));
  wrap.appendChild(num("Publication au recueil (jours)", "publicationJours",
    "Objectif de publication après la signature."));
  wrap.appendChild(num("Notification (jours)", "notificationJours",
    "Objectif de notification d'un acte individuel après la signature."));
  wrap.appendChild(h("hr", { class: "fr-sep" }));
  wrap.appendChild(h("p", { class: "fr-small fr-muted", text: "Les formalités REQUISES pour un acte donné se règlent sur la trame concernée : « transmission » et « notification » peuvent y être déclarées toujours requises ou jamais requises. La publication suit la publiable de la trame. Voir onglet « Trames » de l'éditeur de trame, puis l'écran « Exécution & délais » pour le suivi." }));
  wrap.appendChild(h("div", { class: "fr-row" },
    button("Rétablir les valeurs par défaut", { variant: "tertiary", size: "sm", icon: "refresh", onClick: () => { c.delais = { ...DELAIS_DEFAUT }; save(); redraw(); } })));
  return wrap;
}

// --------------------------------------------------------- journal d'audit
// Le journal n'est pas un fichier technique : c'est le registre des faits de
// l'installation, lisible par un administrateur — qui a soumis, qui a validé,
// qui a signé, qui a publié, qui a constaté une formalité. Les 300 derniers
// faits sont conservés ; au-delà, le plus ancien sort.
function journalPanel() {
  const entries = journalPour({ user: state.user, tous: true });
  const wrap = h("div", { class: "fr-card", style: { maxWidth: "1100px" } });
  wrap.appendChild(h("h2", { class: "fr-card__title", text: "Journal d'audit" }));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: `Les faits de l'installation, du plus récent au plus ancien : soumissions au parapheur, décisions, signatures, publications, constatations de formalités, mises à la corbeille. Chaque entrée porte son auteur et son horodatage. ${entries.length} entrée(s) conservée(s).` }));

  const q = h("input", { class: "fr-input", type: "search", placeholder: "Filtrer (numéro, objet, auteur, action…)" });
  wrap.appendChild(h("div", { class: "fr-field" }, h("label", { class: "fr-label", text: "Rechercher" }), q));
  const liste = h("div", { class: "journal-liste" });
  wrap.appendChild(liste);

  function paint() {
    const needle = q.value.trim().toLowerCase();
    clear(liste);
    const filtrees = needle
      ? entries.filter((e) => [e.action, actionLabel(e.action), e.byName, e.role, e.cibleLabel, e.detail, e.cible, e.numero].filter(Boolean).join(" ").toLowerCase().includes(needle))
      : entries;
    if (!filtrees.length) {
      liste.appendChild(h("p", { class: "fr-small fr-muted", text: entries.length ? "Aucun fait ne correspond à cette recherche." : "Aucun fait enregistré pour l'instant." }));
      return;
    }
    for (const e of filtrees) liste.appendChild(journalLine(e));
  }
  q.addEventListener("input", paint);
  paint();
  return wrap;
}

function journalLine(e) {
  const acte = e.acteId ? state.actes.find((a) => a.id === e.acteId) : null;
  return h("div", { class: "journal-line" },
    h("div", { class: "journal-line__when" },
      h("strong", { text: new Date(e.at).toLocaleDateString("fr-FR") }),
      h("span", { class: "fr-small fr-muted", text: new Date(e.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) })),
    h("div", { class: "journal-line__body" },
      h("div", { class: "fr-row" },
        h("span", { class: "fr-badge fr-badge--" + actionColor(e.action), text: actionLabel(e.action) }),
        e.cibleLabel ? h("strong", { class: "fr-small", text: e.cibleLabel }) : null),
      h("p", { class: "fr-small", text: e.detail || "" }),
      h("p", { class: "fr-small fr-muted", text: [
        e.byName ? "par " + e.byName + (e.role ? ` (${e.role})` : "") : "",
        (e.to || []).length ? "→ " + (e.to || []).map(libelleTo).join(", ") : "",
      ].filter(Boolean).join(" · ") })),
    acte ? button("Voir l'acte", { variant: "tertiary", size: "sm", icon: "eye", onClick: () => navigate("acte/" + acte.id) }) : null,
  );
}

const JOURNAL_ACTIONS = {
  "parapheur.depot": ["Passage au parapheur", "info"],
  "parapheur.accord": ["Bon pour accord", "success"],
  "parapheur.passe": ["Étape passée", "info"],
  "parapheur.refus": ["Refus au parapheur", "error"],
  "parapheur.renvoi": ["Renvoi en rédaction", "warning"],
  "parapheur.reprise": ["Reprise du circuit", "warning"],
  "signature.depot": ["Envoi en signature", "info"],
  "signature.signe": ["Signature", "success"],
  "signature.refus": ["Signature refusée", "warning"],
  "publication.publie": ["Publication", "success"],
  "formalite.transmission": ["Transmission au contrôle de légalité", "info"],
  "formalite.publication": ["Publication constatée", "info"],
  "formalite.notification": ["Notification", "info"],
  "formalite.effacement": ["Constatation effacée", "warning"],
  "acte.creation": ["Création d'acte", "info"],
  "acte.enregistrement": ["Enregistrement d'acte", "info"],
  "acte.restauration": ["Retour à une version", "warning"],
  "corbeille": ["Mise à la corbeille", "warning"],
  "restauration": ["Restauration", "success"],
  "suppression": ["Suppression définitive", "error"],
};

const actionLabel = (a) => (JOURNAL_ACTIONS[a] ? JOURNAL_ACTIONS[a][0] : (a || "Fait"));
const actionColor = (a) => (JOURNAL_ACTIONS[a] ? JOURNAL_ACTIONS[a][1] : "info");
const libelleTo = (v) => (String(v).startsWith("role:") ? "rôle " + String(v).slice(5) : String(v).startsWith("service:") ? "service " + String(v).slice(8) : v);
