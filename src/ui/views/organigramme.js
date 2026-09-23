// ============================================================================
// Écran « Organigramme » — entités, services et bureaux.
//
// C'est le pendant structurel de l'écran des délégations, et il en reprend la
// présentation : un CANVAS qu'on déplace et qu'on zoome (voir src/ui/zoom.js),
// des nœuds courts dont la fiche s'ouvre au clic, et une seconde présentation en
// LISTE pour les écrans étroits.
//
// L'objet n'est pourtant pas le même. Les délégations montrent une CHAÎNE DE
// POUVOIR (qui signe à la place de qui) ; l'organigramme montre la STRUCTURE :
//
//   ENTITÉ    la personne morale, ou la structure qui agit sous son nom
//     └── SERVICE   un regroupement humain, rattaché à une entité
//           └── BUREAU   la maille fine, à laquelle un compte est rattaché
//
// Deux choses se règlent ici, et nulle part ailleurs :
//
//   • le SIGNATAIRE PRINCIPAL d'une entité — la personne qui signe ses actes à
//     défaut de signataire désigné dans la trame (son directeur, son maire, son
//     président), et la qualité sous laquelle elle signe. Voir
//     src/lib/compile.js, qui s'en sert comme signataire par défaut ;
//   • le RATTACHEMENT d'une entité — une régie du cinéma municipale, un service
//     doté d'un directeur, n'ont pas de personnalité morale propre : l'entité se
//     déclare RATTACHÉE à une autre, et l'acte sait à qui elle se rattache, sans
//     cesser d'avoir sa vie propre (ses services, son signataire, ses actes).
//
// Lecture ouverte à tous les comptes ; écriture réservée à qui tient le
// référentiel (permission `referentiel.gerer`).
// ============================================================================
import { state, touch, redrawView, can, journaliser } from "../state.js";
import { h, clear, button, toast, modal } from "../dom.js";
import { textField, selectField, choiceField, confirmDialog, sectionHeader, helpLink, emptyState } from "../components.js";
import {
  ENTITY_KINDS, kindLabel, newEntite,
  entitesOf, entiteById, estAutonome, enfantsDe,
  parentDeService, servicesSous, enfantsServices,
  organigramme, entitesHorsArbre, statsOrganigramme,
} from "../../lib/organigramme.js";
import { personName } from "../../lib/render.js";
import { newService, newBureau } from "../../lib/scope.js";
import { cadreZoom } from "../zoom.js";

// ------------------------------------------------------------------ utilitaires
// Les deux lettres de l'emblème d'un nœud : le code de l'entité (« VSL » → « VS »),
// à défaut les premières lettres de son nom.
const sigle = (s) => String(s || "").trim().replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";

const personnes = (c) => (c.people || []).map((p) => ({
  value: p.id,
  label: personName(p) + ((c.roles || []).find((r) => r.id === p.roles?.[0]) ? " — " + (c.roles || []).find((r) => r.id === p.roles[0]).label : ""),
}));

const rolesOption = (c) => (c.roles || []).map((r) => ({ value: r.id, label: r.label || r.id }));

function ligneInfo(label, valeur) {
  return h("div", { class: "org-fiche__ligne" },
    h("span", { class: "org-fiche__etq", text: label }),
    h("span", { class: "org-fiche__val", text: valeur || "—" }));
}

// ---------------------------------------------------------------- l'écran
export function renderOrganigramme(root) {
  const c = state.config;
  c.entities = c.entities || [];
  c.services = c.services || [];
  const ui = (state.ui = state.ui || {});
  if (ui.orgView !== "liste") ui.orgView = "organigramme";
  // DEUX DROITS, distincts : l'ENTITÉ (la personne morale) reste à
  // l'administrateur ; les SERVICES et leurs bureaux sont aussi à l'éditeur
  // (permission `organigramme.gerer`). Un éditeur dessine donc la structure de
  // la collectivité sans pouvoir créer ni supprimer une personne morale.
  const peutEntites = can("referentiel.gerer");
  const peutServices = can("organigramme.gerer");
  const peutGerer = peutEntites;
  const stats = statsOrganigramme(c);

  const save = () => touch("config", { rerender: false });
  const paint = () => { save(); redrawView(); };
  const droits = { peutEntites, peutServices, save, paint };

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Organigramme" }),
      h("p", { class: "page-head__sub", text: "La structure au nom de laquelle les actes sont pris : les entités (commune, établissements, régies…), les services qui les composent, et les bureaux auxquels les comptes sont rattachés. Cliquez un nœud pour ouvrir sa fiche — y désigner le signataire principal d'une entité, la rattacher à une autre, ou renseigner ses services et leurs bureaux. Un service peut dépendre d'un autre service, ou du bureau d'un autre service : les agents affectés à un service de tête voient alors les actes de toute la chaîne en contrebas. Une entité rattachée agit au nom d'une autre (une régie municipale, par exemple) sans perdre sa vie propre : son directeur, ses services, ses actes." }),
    ),
    h("div", { class: "page-head__actions" },
      peutGerer ? button("Nouvelle entité", { variant: "primary", icon: "plus", onClick: () => ouvrirFicheEntite(c, { ...droits, creer: true }) }) : null,
      helpLink("administrateurs", "Aide"),
    ),
  ));

  if (!peutServices) {
    root.appendChild(h("p", { class: "org-lecseule" },
      h("span", { class: "fr-badge fr-badge--info", text: "Consultation" }),
      h("span", { text: " L'organigramme est visible par tous ; seuls les administrateurs et les éditeurs peuvent le modifier." })));
  }

  if (!c.entities.length) {
    root.appendChild(emptyState(
      "Aucune entité au référentiel : la collectivité se décrit dans Administration › Entités, ou se dessine ici.",
      peutGerer ? button("Créer la première entité", { variant: "primary", icon: "plus", onClick: () => ouvrirFicheEntite(c, { ...droits, creer: true }) }) : null,
    ));
    return;
  }

  // Les compteurs : ce que l'organigramme contient, et ce qui manque.
  const carte = (label, valeur, detail, ton) => h("div", { class: "chrono-kpi" + (ton ? " chrono-kpi--" + ton : "") },
    h("span", { class: "chrono-kpi__val", text: String(valeur) }),
    h("span", { class: "chrono-kpi__lab", text: label }),
    detail ? h("span", { class: "chrono-kpi__det", text: detail }) : null);
  root.appendChild(h("div", { class: "chrono-kpis" },
    carte("Entités", stats.entites, stats.rattachees ? stats.rattachees + " rattachée(s)" : "toutes autonomes"),
    carte("Services", stats.services, stats.bureaux + " bureau(x)"),
    carte("Services rattachés", stats.servicesRattaches, stats.servicesRattaches ? "au-dessous d'un autre" : "tous à la racine"),
    carte("Sans signataire principal", stats.sansSignataire, stats.sansSignataire ? "à désigner" : "toutes désignées", stats.sansSignataire ? "warning" : ""),
  ));

  const arbre = organigramme(c);
  root.appendChild(barreOutils(ui, arbre.length));

  const fiche = (noeud) => {
    if (noeud.type === "service") ouvrirFicheService(c, { ...droits, service: noeud.service });
    else if (noeud.type === "bureau") ouvrirFicheBureau(c, { ...droits, service: noeud.service, bureau: noeud.bureau });
    else ouvrirFicheEntite(c, { ...droits, entite: noeud.entite });
  };

  root.appendChild(ui.orgView === "liste" ? vueListe(c, arbre, fiche) : vueOrganigramme(c, arbre, fiche));

  const orphelines = entitesHorsArbre(c);
  if (orphelines.length) root.appendChild(horsArbre(c, orphelines, fiche));
}

// --------------------------------------------------------------- barre d'outils
function barreOutils(ui, nb) {
  const bascule = (id, label) => h("button", {
    class: "org-bascule__btn" + (ui.orgView === id ? " is-active" : ""),
    type: "button", role: "tab", "aria-selected": String(ui.orgView === id),
    onClick: () => { ui.orgView = id; redrawView(); },
  }, label);
  return h("div", { class: "org-outils" },
    h("div", { class: "org-bascule", role: "tablist", "aria-label": "Présentation" },
      bascule("organigramme", "Organigramme"),
      bascule("liste", "Liste")),
    h("span", { class: "fr-small fr-muted", text: nb + (nb > 1 ? " entités de tête" : " entité de tête") }),
    h("div", { class: "fr-spacer" }),
    h("div", { class: "org-legende", "aria-hidden": "true" },
      h("span", { class: "org-legende__i org-legende__i--tete", text: "Entité autonome" }),
      h("span", { class: "org-legende__i org-legende__i--del", text: "Entité rattachée" }),
      h("span", { class: "org-legende__i org-legende__i--svc", text: "Service" }),
      h("span", { class: "org-legende__i org-legende__i--sous", text: "Bureau" })),
  );
}

// ------------------------------------------------------------- l'organigramme
function vueOrganigramme(c, arbre, fiche) {
  const org = h("div", { class: "org" });
  for (const racine of arbre) org.appendChild(brancheEntite(c, racine, fiche));
  return cadreZoom(org, { mode: "canvas", cle: "organigramme", classe: "org-scroll" });
}

function brancheEntite(c, noeud, fiche) {
  const el = h("div", { class: "org-branch" });
  el.appendChild(noeudEntite(c, noeud, fiche));
  const enfants = [];
  for (const s of noeud.services || []) enfants.push(brancheService(c, s, fiche));
  for (const e of noeud.enfants || []) enfants.push(brancheEntite(c, e, fiche));
  if (enfants.length) {
    const kids = h("div", { class: "org-children" });
    for (const k of enfants) kids.appendChild(k);
    el.appendChild(kids);
  }
  return el;
}

// Un SERVICE peut pendre sous un autre service, ou sous le BUREAU d'un autre
// service (voir src/lib/organigramme.js) : la branche descend donc récursivement,
// et un bureau peut à son tour porter des services.
function brancheService(c, noeud, fiche) {
  const el = h("div", { class: "org-branch" });
  el.appendChild(noeudService(c, noeud.service, noeud.bureaux, noeud.parent, fiche));
  const enfants = [];
  for (const b of noeud.bureaux || []) enfants.push(brancheBureau(c, noeud.service, b.bureau, b.enfants, fiche));
  for (const s of noeud.enfants || []) enfants.push(brancheService(c, s, fiche));
  if (enfants.length) {
    const kids = h("div", { class: "org-children" });
    for (const k of enfants) kids.appendChild(k);
    el.appendChild(kids);
  }
  return el;
}

function brancheBureau(c, service, bureau, enfants, fiche) {
  const el = h("div", { class: "org-branch" });
  el.appendChild(noeudBureau(c, service, bureau, enfants, fiche));
  const kids = (enfants || []).map((s) => brancheService(c, s, fiche));
  if (kids.length) {
    const box = h("div", { class: "org-children" });
    for (const k of kids) box.appendChild(k);
    el.appendChild(box);
  }
  return el;
}

function noeudEntite(c, noeud, fiche) {
  const e = noeud.entite;
  const sig = noeud.signataire;
  const enfant = enfantsDe(c, e.id).length;
  const svc = (noeud.services || []).length;
  return h("button", {
    class: "org-node org-node--" + (noeud.autonome ? "tete" : "del") + (sig ? "" : " org-node--incomplet"),
    type: "button",
    title: "Ouvrir la fiche de " + e.name,
    onClick: () => fiche({ type: "entite", entite: e }),
  },
    h("span", { class: "org-node__haut" },
      h("span", { class: "org-node__init org-node__init--" + (noeud.autonome ? "tete" : "del"), text: sigle(e.code || e.name) || "?" }),
      h("span", { class: "org-node__corps" },
        h("span", { class: "org-node__nom", text: e.name }),
        h("span", { class: "org-node__qual", text: sig ? "Signe : " + personName(sig.personne) : "Signataire principal à désigner" }))),
    h("span", { class: "org-node__pied" },
      h("span", { class: "org-badge org-badge--" + (noeud.autonome ? "tete" : "del"), text: noeud.autonome ? "Entité" : "Rattachée" }),
      e.code ? h("span", { class: "org-node__ent", text: e.code }) : null,
      !noeud.autonome && noeud.entiteParente ? h("span", { class: "org-badge org-badge--sous", text: "de " + noeud.entiteParente.name }) : null,
      svc ? h("span", { class: "org-badge", text: svc + " service(s)" }) : null,
      enfant ? h("span", { class: "org-badge", text: enfant + " rattachée(s)" }) : null),
  );
}

function noeudService(c, service, bureaux, parent, fiche) {
  const nb = enfantsServices(c, service.id).length
    + (bureaux || []).reduce((n, b) => n + (b.enfants || []).length, 0);
  return h("button", {
    class: "org-node org-node--svc",
    type: "button",
    title: "Ouvrir la fiche du service " + service.name,
    onClick: () => fiche({ type: "service", service }),
  },
    h("span", { class: "org-node__haut" },
      h("span", { class: "org-node__init org-node__init--svc", text: "§" }),
      h("span", { class: "org-node__corps" },
        h("span", { class: "org-node__nom", text: service.name }),
        h("span", { class: "org-node__qual", text: (bureaux || []).length + " bureau(x)" + (nb ? " · " + nb + " rattaché(s)" : "") }))),
    h("span", { class: "org-node__pied" },
      h("span", { class: "org-badge org-badge--svc", text: "Service" }),
      service.code ? h("span", { class: "org-node__ent", text: service.code }) : null,
      parent ? h("span", { class: "org-badge org-badge--sous", text: "de " + (parent.type === "bureau" ? parent.bureau.name : parent.service.name) }) : null),
  );
}

function noeudBureau(c, service, bureau, enfants, fiche) {
  const nb = (enfants || []).length;
  return h("button", {
    class: "org-node org-node--sous org-node--petit",
    type: "button",
    title: "Ouvrir la fiche du bureau " + bureau.name,
    onClick: () => fiche({ type: "bureau", service, bureau }),
  },
    h("span", { class: "org-node__haut" },
      h("span", { class: "org-node__init org-node__init--sous", text: "·" }),
      h("span", { class: "org-node__corps" },
        h("span", { class: "org-node__nom", text: bureau.name }),
        h("span", { class: "org-node__qual", text: service.name + (nb ? " · " + nb + " service(s) rattaché(s)" : "") }))),
  );
}

// ----------------------------------------------------------------- en liste
function vueListe(c, arbre, fiche) {
  const wrap = h("div", { class: "org-liste" });
  const poser = (el, niveau) => {
    wrap.appendChild(h("div", { class: "org-liste__ligne", style: { paddingLeft: niveau * 26 + "px" } },
      niveau > 0 ? h("span", { class: "org-liste__cran", "aria-hidden": "true", text: "└" }) : null, el));
  };
  const parcourirService = (noeud, niveau) => {
    poser(noeudService(c, noeud.service, noeud.bureaux, noeud.parent, fiche), niveau);
    for (const b of noeud.bureaux || []) {
      poser(noeudBureau(c, noeud.service, b.bureau, b.enfants, fiche), niveau + 1);
      for (const s of b.enfants || []) parcourirService(s, niveau + 2);
    }
    for (const s of noeud.enfants || []) parcourirService(s, niveau + 1);
  };
  const parcourir = (noeud, niveau) => {
    poser(noeudEntite(c, noeud, fiche), niveau);
    for (const s of noeud.services || []) parcourirService(s, niveau + 1);
    for (const e of noeud.enfants || []) parcourir(e, niveau + 1);
  };
  for (const r of arbre) parcourir(r, 0);
  return wrap;
}

function horsArbre(c, orphelines, fiche) {
  const box = h("div", { class: "fr-alert fr-alert--warning", style: { marginTop: "18px" } },
    h("p", { class: "fr-alert__title", text: "Entités hors arbre" }),
    h("p", { class: "fr-small", text: "Leur rattachement forme une boucle (elles se rattachent l'une à l'autre) : elles n'apparaissent pas dans l'organigramme. Ouvrez leur fiche pour corriger le rattachement." }));
  const liste = h("div", { class: "org-orph" });
  for (const e of orphelines) {
    liste.appendChild(h("button", { class: "org-orph__item", type: "button", onClick: () => fiche({ type: "entite", entite: e }) },
      h("span", { class: "org-orph__nom", text: e.name }),
      h("span", { class: "fr-small fr-muted", text: e.code || "" })));
  }
  box.appendChild(liste);
  return box;
}

// ============================================================================
// Les fiches — une par sorte de nœud.
// ============================================================================
function ouvrirFicheEntite(c, opts) {
  const { peutEntites, peutServices, save, paint } = opts;
  const nouvelle = !!opts.creer;
  const e = nouvelle ? newEntite() : opts.entite;

  const body = h("div", { class: "org-fiche" });
  const m = modal({
    title: nouvelle ? "Nouvelle entité" : "Fiche — " + e.name + (e.code ? " (" + e.code + ")" : ""),
    body, wide: true,
    actions: (close) => {
      const out = [];
      if (peutEntites && nouvelle) out.push(button("Créer l'entité", { variant: "primary", icon: "plus", onClick: () => {
        if (!String(e.name || "").trim()) { toast("Donnez un nom à l'entité.", "warning"); return; }
        if (entitesOf(c).some((x) => x.code && x.code === e.code)) { toast("Le code « " + e.code + " » est déjà pris par une autre entité : il alimente la numérotation.", "warning"); return; }
        c.entities.push(e);
        journaliser({ action: "referentiel.entite", cible: "referentiel", cibleLabel: e.name, detail: "création depuis l'organigramme" });
        paint();
        close();
      } }));
      if (peutEntites && !nouvelle) out.push(button("Supprimer", { variant: "tertiary", icon: "trash", onClick: async () => {
        const enfants = enfantsDe(c, e.id);
        if (enfants.length) { toast("Détachez d'abord les entités rattachées à celle-ci : " + enfants.map((x) => x.name).join(", ") + ".", "warning"); return; }
        if (!(await confirmDialog("Supprimer cette entité ?", "Les actes déjà pris en son nom ne sont pas touchés, mais elle ne sera plus proposée à la rédaction."))) return;
        const i = c.entities.indexOf(e);
        if (i >= 0) c.entities.splice(i, 1);
        journaliser({ action: "referentiel.entite", cible: "referentiel", cibleLabel: e.name, detail: "suppression" });
        paint();
        close();
      } }));
      out.push(button("Fermer", { variant: "secondary", onClick: close }));
      return out;
    },
  });

  const tete = () => h("div", { class: "org-fiche__tete" },
    h("span", { class: "org-node__init org-node__init--lg org-node__init--" + (estAutonome(e) ? "tete" : "del"), text: sigle(e.code || e.name) || "?" }),
    h("div", { class: "org-fiche__ident" },
      h("span", { class: "org-fiche__nom", text: e.name || "Entité sans nom" }),
      h("span", { class: "org-fiche__qual", text: [kindLabel(e.kind), e.code, estAutonome(e) ? "autonome" : "rattachée"].filter(Boolean).join(" · ") })));

  const peindre = () => {
    clear(body);
    body.appendChild(tete());
    if (!peutEntites) {
      body.appendChild(sectionHeader("L'entité"));
      body.appendChild(h("div", { class: "org-fiche__bloc" },
        ligneInfo("Nom", e.name), ligneInfo("Code", e.code), ligneInfo("Nature", kindLabel(e.kind)),
        ligneInfo("Autonomie", estAutonome(e) ? "Autonome (personnalité morale propre)" : "Rattachée à " + (entiteById(c, e.parentId)?.name || "—")),
        ligneInfo("Formule d'autorité", e.authorityFormula),
        ligneInfo("Signataire principal", e.signerPersonId ? personName((c.people || []).find((p) => p.id === e.signerPersonId)) : ""),
        ligneInfo("Qualité de signature", (c.roles || []).find((r) => r.id === e.signerRoleId)?.label || "")));
    } else {
      body.appendChild(sectionHeader("L'identité"));
      body.appendChild(h("div", { class: "fr-grid fr-grid--2" },
        textField({ label: "Nom", value: e.name, onChange: (v) => { e.name = v; save(); peindre(); } }),
        textField({ label: "Code (alimente la numérotation)", value: e.code, onChange: (v) => { e.code = v.toUpperCase(); save(); } }),
        selectField({
          label: "Nature", value: e.kind, options: ENTITY_KINDS.map((k) => ({ value: k.id, label: k.label })),
          onChange: (v) => { e.kind = v; save(); },
        }),
        textField({
          label: "Formule d'autorité", value: e.authorityFormula || "", placeholder: "ex. {qualite} de Valmont-sur-Loire",
          help: "La ligne d'autorité de l'entité, telle qu'elle s'imprime en tête des actes : « Le maire de… », « La présidente du CCAS de… ». {qualite} reçoit la qualité du signataire, accordée en genre.",
          onChange: (v) => { e.authorityFormula = v; save(); },
        }),
        textField({ label: "Dénomination juridique", value: e.legalName || "", onChange: (v) => { e.legalName = v; save(); } }),
        textField({ label: "Commune du siège", value: e.seatCity || "", onChange: (v) => { e.seatCity = v; save(); } }),
      ));

      body.appendChild(h("hr", { class: "fr-sep" }));
      body.appendChild(sectionHeader("Autonomie et rattachement"));
      body.appendChild(h("div", { class: "fr-stack" },
        choiceField({
          label: "Personnalité morale", value: estAutonome(e),
          options: [{ value: true, label: "Entité autonome" }, { value: false, label: "Rattachée à une autre entité" }],
          help: "Une entité rattachée agit au nom d'une autre — une régie du cinéma municipale, un service doté d'un directeur — mais garde sa vie propre : son signataire principal, ses services, ses actes. Le rattachement n'est qu'une présentation de l'organigramme.",
          onChange: (v) => { e.autonome = v; save(); peindre(); },
        }),
        selectField({
          label: "Rattachée à", value: e.parentId || "",
          options: entitesOf(c).filter((x) => x.id !== e.id).map((x) => ({ value: x.id, label: x.name + (x.code ? " (" + x.code + ")" : "") })),
          placeholder: "— Aucune (entité de tête) —",
          help: "Sert aussi d'ordre dans l'organigramme, y compris pour une entité autonome.",
          onChange: (v) => { e.parentId = v; save(); peindre(); },
        })));

      // ----------------------------------------------- le signataire principal
      body.appendChild(h("hr", { class: "fr-sep" }));
      body.appendChild(sectionHeader("Signataire principal"));
      body.appendChild(h("p", { class: "fr-small fr-muted", text: "La personne qui signe les actes de cette entité quand la trame n'en désigne aucun — son directeur, son maire, son président. La qualité désignée avec elle sert de fonction de signature, sans écraser un choix du rédacteur." }));
      body.appendChild(h("div", { class: "fr-grid fr-grid--2" },
        selectField({
          label: "Personne", value: e.signerPersonId || "", options: personnes(c), placeholder: "— Aucune —",
          onChange: (v) => { e.signerPersonId = v; save(); peindre(); },
        }),
        selectField({
          label: "Qualité de signature", value: e.signerRoleId || "", options: rolesOption(c), placeholder: "— Sa qualité usuelle —",
          onChange: (v) => { e.signerRoleId = v; save(); peindre(); },
        })));
    }

    // Ce que l'entité porte, en lecture.
    const svc = (c.services || []).filter((s) => s.entityId === e.id);
    const bureaux = svc.reduce((n, s) => n + (s.bureaux || []).length, 0);
    body.appendChild(h("hr", { class: "fr-sep" }));
    body.appendChild(sectionHeader("Ce qu'elle porte"));
    body.appendChild(h("div", { class: "org-fiche__bloc" },
      ligneInfo("Services", svc.length ? svc.map((s) => s.name).join(", ") : ""),
      ligneInfo("Bureaux", bureaux ? String(bureaux) : ""),
      ligneInfo("Entités rattachées", enfantsDe(c, e.id).map((x) => x.name).join(", "))));

    if (peutServices) {
      body.appendChild(h("p", { class: "fr-small" },
        button("Ajouter un service", { variant: "tertiary", size: "sm", icon: "plus", onClick: () => {
          const s = newService({ entityId: e.id });
          c.services.push(s);
          save();
          m.close();
          ouvrirFicheService(c, { peutEntites, peutServices, save, paint, service: s });
        } })));
    }
  };
  peindre();
}

// Les options du sélecteur « Dépend de » : les autres services, et les bureaux
// des autres services — c'est ainsi qu'un service pend sous un bureau. On écarte
// le service lui-même et tout ce qui pend sous lui : la chaîne bouclerait.
function optionsParent(c, s) {
  const interdits = servicesSous(c, s.id);
  const out = [];
  for (const x of c.services) {
    if (interdits.has(x.id)) continue;
    out.push({ value: x.id, label: "Service — " + x.name + (x.code ? " (" + x.code + ")" : "") });
  }
  for (const x of c.services) {
    if (interdits.has(x.id)) continue;
    for (const b of (x.bureaux || [])) out.push({ value: b.id, label: "Bureau — " + x.name + " › " + b.name });
  }
  return out;
}

// Ce qui pend sous un service : ses services rattachés, et ceux qui pendent sous
// ses bureaux. Sert à montrer le périmètre sans le décrire.
function sousDeService(c, s) {
  const vus = servicesSous(c, s.id);
  vus.delete(s.id);
  return c.services.filter((x) => vus.has(x.id));
}

function ouvrirFicheService(c, opts) {
  const { peutEntites, peutServices, save, paint } = opts;
  const s = opts.service;
  const body = h("div", { class: "org-fiche" });
  const m = modal({
    title: "Fiche — " + s.name,
    body, wide: true,
    actions: (close) => {
      const out = [];
      if (peutServices) out.push(button("Supprimer", { variant: "tertiary", icon: "trash", onClick: async () => {
        // Un service qui en porte d'autres ne part pas sans prévenir : on
        // DÉTACHE sa descendance, qui remonte à la racine de son entité.
        const enfants = enfantsServices(c, s.id)
          .concat((s.bureaux || []).flatMap((b) => enfantsServices(c, b.id)));
        if (enfants.length) {
          const ok = await confirmDialog("Supprimer ce service et détacher sa descendance ?",
            "Il porte " + enfants.length + " service(s) rattaché(s) : " + enfants.map((x) => x.name).join(", ") + ". Ils remonteront à la racine de leur entité.",
            { confirmLabel: "Supprimer et détacher", danger: true });
          if (!ok) return;
          for (const x of enfants) x.parentId = "";
        } else if (!(await confirmDialog("Supprimer ce service ?", "Les comptes qui lui sont rattachés garderont leur rattachement, mais le service ne figurera plus dans l'organigramme."))) return;
        const i = c.services.indexOf(s);
        if (i >= 0) c.services.splice(i, 1);
        journaliser({ action: "referentiel.service", cible: "referentiel", cibleLabel: s.name, detail: "suppression depuis l'organigramme" });
        save();
        close();
        paint();
      } }));
      out.push(button("Fermer", { variant: "secondary", onClick: close }));
      return out;
    },
  });

  const peindre = () => {
    clear(body);
    const parent = parentDeService(c, s);
    body.appendChild(h("div", { class: "org-fiche__tete" },
      h("span", { class: "org-node__init org-node__init--lg org-node__init--svc", text: "§" }),
      h("div", { class: "org-fiche__ident" },
        h("span", { class: "org-fiche__nom", text: s.name }),
        h("span", { class: "org-fiche__qual", text: [s.code, entiteById(c, s.entityId)?.name].filter(Boolean).join(" · ") }))));

    const sous = sousDeService(c, s);
    const libelleParent = parent
      ? (parent.type === "bureau" ? parent.bureau.name + " (bureau de " + parent.service.name + ")" : parent.service.name)
      : "— rattaché directement à l'entité —";

    if (!peutServices) {
      body.appendChild(h("div", { class: "org-fiche__bloc" },
        ligneInfo("Nom", s.name), ligneInfo("Code", s.code), ligneInfo("Entité", entiteById(c, s.entityId)?.name || ""),
        ligneInfo("Dépend de", libelleParent),
        ligneInfo("Bureaux", (s.bureaux || []).map((b) => b.name).join(", ")),
        ligneInfo("Services rattachés", sous.length ? sous.map((x) => x.name).join(", ") : "")));
      return;
    }

    body.appendChild(sectionHeader("Le service"));
    body.appendChild(h("div", { class: "fr-grid fr-grid--2" },
      textField({ label: "Nom", value: s.name, onChange: (v) => { s.name = v; save(); peindre(); } }),
      textField({ label: "Code", value: s.code || "", onChange: (v) => { s.code = v.toUpperCase(); save(); } }),
      selectField({
        label: "Entité de rattachement", value: s.entityId || "",
        options: entitesOf(c).map((x) => ({ value: x.id, label: x.name + (x.code ? " (" + x.code + ")" : "") })),
        placeholder: "— Choisir —",
        help: "Le service appartient à une entité : ses actes relèvent de celle-ci, et les comptes rattachés à ses bureaux en héritent le périmètre.",
        onChange: (v) => { s.entityId = v; save(); peindre(); },
      })));

    body.appendChild(h("hr", { class: "fr-sep" }));
    body.appendChild(sectionHeader("Rattachement"));
    body.appendChild(h("p", { class: "fr-small fr-muted", text: "Un service peut dépendre d'un autre service, ou du BUREAU d'un autre service. Les agents affectés au service de tête voient alors les actes de toute la chaîne en contrebas : le périmètre suit le rattachement." }));
    body.appendChild(selectField({
      label: "Dépend de", value: s.parentId || "",
      options: optionsParent(c, s),
      placeholder: "— Rattaché directement à l'entité —",
      help: "Laisser vide pour un service de tête. Choisir un service, ou le bureau d'un service.",
      onChange: (v) => { s.parentId = v; save(); peindre(); },
    }));
    if (sous.length) body.appendChild(h("p", { class: "fr-small fr-muted", text: "Couvert par ce service : " + sous.map((x) => x.name).join(", ") + "." }));

    body.appendChild(h("hr", { class: "fr-sep" }));
    body.appendChild(sectionHeader("Les bureaux"));
    body.appendChild(h("p", { class: "fr-small fr-muted", text: "Le bureau est la maille fine : un compte est rattaché à un service et, par défaut, à tous ses bureaux. L'administrateur peut ensuite restreindre son accès à certains bureaux (Administration › Comptes et rôles). Un service peut aussi pendre sous un bureau : les deux se combinent." }));
    s.bureaux = s.bureaux || [];
    for (const b of s.bureaux) {
      const enfants = enfantsServices(c, b.id);
      body.appendChild(h("div", { class: "org-bureau-ligne" },
        textField({
          label: "Bureau" + (enfants.length ? " — porte " + enfants.length + " service(s) rattaché(s)" : ""),
          value: b.name,
          onChange: (v) => { b.name = v; save(); },
        }),
        button("Retirer", { variant: "tertiary", size: "sm", icon: "trash", onClick: () => {
          const i = s.bureaux.indexOf(b);
          if (i >= 0) s.bureaux.splice(i, 1);
          // Les services qui pendaient sous ce bureau remontent au service.
          for (const x of enfants) x.parentId = s.id;
          save();
          peindre();
        } })));
    }
    body.appendChild(h("p", { class: "fr-small" },
      button("Ajouter un bureau", { variant: "tertiary", size: "sm", icon: "plus", onClick: () => {
        s.bureaux.push(newBureau());
        save();
        peindre();
      } })));
    if (!peutEntites) {
      body.appendChild(h("p", { class: "fr-small fr-muted", text: "L'ajout et la suppression d'une ENTITÉ restent réservés à l'administrateur ; les services et leurs bureaux se modifient ici." }));
    }
  };
  peindre();
}

function ouvrirFicheBureau(c, opts) {
  const { peutEntites, peutServices, save, paint } = opts;
  const { service, bureau } = opts;
  const enfants = enfantsServices(c, bureau.id);
  const body = h("div", { class: "org-fiche" });
  const m = modal({
    title: "Fiche — " + bureau.name,
    body,
    actions: (close) => {
      const out = [];
      if (peutServices) out.push(button("Supprimer", { variant: "tertiary", icon: "trash", onClick: async () => {
        if (!(await confirmDialog("Supprimer ce bureau ?",
          enfants.length
            ? enfants.length + " service(s) pendent sous ce bureau : ils remonteront au service « " + service.name + " ». Les comptes qui étaient restreints à ce bureau perdront cette restriction."
            : "Les comptes qui lui sont rattachés perdront cette restriction d'accès."))) return;
        const i = (service.bureaux || []).indexOf(bureau);
        if (i >= 0) service.bureaux.splice(i, 1);
        for (const x of enfants) x.parentId = service.id;
        journaliser({ action: "referentiel.bureau", cible: "referentiel", cibleLabel: bureau.name, detail: "suppression depuis l'organigramme" });
        save();
        close();
        paint();
      } }));
      out.push(button("Fermer", { variant: "secondary", onClick: close }));
      return out;
    },
  });
  body.appendChild(h("div", { class: "org-fiche__bloc" },
    ligneInfo("Bureau", bureau.name),
    ligneInfo("Service", service.name),
    ligneInfo("Entité", entiteById(c, service.entityId)?.name || ""),
    ligneInfo("Services rattachés", enfants.length ? enfants.map((x) => x.name).join(", ") : "")));
  if (peutServices) {
    body.appendChild(sectionHeader("Renommer"));
    body.appendChild(textField({
      label: "Nom du bureau", value: bureau.name,
      onChange: (v) => { bureau.name = v; save(); },
    }));
    body.appendChild(h("p", { class: "fr-small" },
      button("Ouvrir le service", { variant: "tertiary", size: "sm", icon: "org", onClick: () => { m.close(); ouvrirFicheService(c, { peutEntites, peutServices, save, paint, service }); } })));
  }
}
