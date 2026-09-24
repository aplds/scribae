// ============================================================================
// Écran « Organigramme des délégations ».
//
// Il était auparavant un onglet de l'Administration — donc invisible à qui n'a
// pas les clés du référentiel. Or savoir QUI peut signer à la place de qui
// intéresse tout le monde : l'écran est désormais ouvert à tous les comptes, et
// seuls les administrateurs et les éditeurs peuvent le modifier (permission
// `delegations.gerer`, voir src/lib/users.js).
//
// La lecture est un ORGANIGRAMME : chaque chaîne part de son autorité de tête et
// descend, de délégation en sous-délégation. Un nœud reste court — qui, sous
// quelle qualité, dans quelle organisation — et c'est la FICHE, ouverte au clic,
// qui porte le détail : le pouvoir reçu, son étendue, la décision qui le fonde,
// ses dates, et ce que la signature produira au bout de la chaîne.
//
// Une seconde présentation, en LISTE indentée, sert les écrans étroits : un
// organigramme y obligerait à faire défiler horizontalement.
//
// Toute la lecture et toute l'écriture passent par src/lib/delegations.js :
// cet écran ne fait que montrer, saisir et vérifier.
// ============================================================================

import { state, touch, redrawView, can, personById, entityById, navigate, journaliser, setUsers, currentUser } from "../state.js";
import { h, clear, button, toast, modal, field as frField } from "../dom.js";
import { textField, selectField, choiceField, confirmDialog, sectionHeader, helpLink, emptyState } from "../components.js";
import { formatDate, todayIso } from "../../lib/util.js";
import { get } from "../../lib/remote.js";
import {
  newDelegation, arbreDelegations, entiteDeDelegation, qualiteDeDelegation,
  qualitePersonne, genreDe, avecArticle, lignesQualites, decisionsDeSignature, libelleDecision,
  DECISIONS, CHAMPS_DECISION,
  sourceDeDecision, intituleDecision, lienDecision, lienDeReference, decisionRenseignee, decisionsManquantes,
} from "../../lib/delegations.js";
import { personName, personSignatureName } from "../../lib/render.js";
import { cadreZoom } from "../zoom.js";
import { initialsOf, fullName, hasRole } from "../../lib/users.js";
import {
  ROLE_SIGNATAIRE, assurerRoleSignataire, etatRapprochement, rapprocher, deRapprocher,
} from "../../lib/signataires.js";

// Désigner quelqu'un comme signataire lui donne la QUALITÉ de signataire. C'est
// le geste de cet écran, et il vaut même pour un éditeur : la gestion des
// comptes n'est pas requise (voir src/lib/signataires.js). La qualité suit la
// PERSONNE, non la délégation : on ne la retire pas quand une délégation
// disparaît, car la même personne peut signer en son nom propre ailleurs.
function assurerSignataire(personId) {
  if (!personId || !can("delegations.gerer")) return;
  const res = assurerRoleSignataire(state.users, personId);
  if (!res.ajoute || !res.compte) return;
  setUsers(state.users).then(() => {
    journaliser({
      action: "role.signataire", cible: "compte", cibleLabel: fullName(res.compte),
      detail: "qualité de signataire attribuée en le désignant dans l'organigramme des délégations",
      to: [res.compte.id],
    });
    toast(`${fullName(res.compte)} est désormais signataire.`, "success");
  });
}

// --------------------------------------------------------- rang et état d'un nœud
// Le rang se lit à la couleur (voir la légende et le CSS) : l'autorité de tête,
// la délégation, puis les sous-délégations — numérotées, parce qu'on en compte
// rarement plus de deux et que « Sous-délégation 2 » dit mieux l'étage que « 3 ».
function rangDe(noeud) {
  if (!noeud.delegation) return { classe: "tete", label: "Autorité de tête" };
  if ((noeud.niveau || 1) <= 1) return { classe: "del", label: "Délégation" };
  return { classe: "sous", label: "Sous-délégation " + (noeud.niveau - 1) };
}

// Une délégation suspendue ou hors de ses dates est SIGNALÉE, jamais cachée :
// l'arbre doit montrer ce qui existe, y compris ce qui ne s'applique plus.
function etatDe(del) {
  if (!del) return null;
  if (del.active === false) return { classe: "off", label: "Suspendue" };
  const auj = todayIso();
  if (del.au && String(del.au) < auj) return { classe: "off", label: "Échue" };
  if (del.du && String(del.du) > auj) return { classe: "off", label: "À venir" };
  return null;
}

const optionsPersonnes = (c) => (c.people || []).map((p) => ({
  value: p.id,
  label: personName(p) + (qualitePersonne(c, p) ? " — " + qualitePersonne(c, p) : ""),
}));

const optionsEntites = (c) => (c.entities || []).map((e) => ({ value: e.id, label: e.name + (e.code ? " (" + e.code + ")" : "") }));

// Les références qui peuvent fonder un pouvoir de signer : des décisions et
// autres actes, pas des codes ni des règlements — on ne tient pas un pouvoir de
// signer du code général des collectivités territoriales.
const refsDecision = (c) => (c.refs || [])
  .filter((r) => r.active !== false && !["code", "reglement", "instruction"].includes(r.kind))
  .map((r) => ({ value: r.id, label: (r.label || r.id).slice(0, 110) }));

// D'où vient une décision, dans l'ordre où cela se lit. « Non renseignée » n'est
// pas un cul-de-sac : l'intitulé ET l'adresse s'y saisissent à la main (voir
// `champAdresseDeDecision`), et `sourceDeDecision` (lib/delegations.js) reconnaît
// le lien externe à la seule présence d'une adresse.
const SOURCES_DECISION = [
  { value: "", label: "Non renseignée" },
  { value: "publication", label: "Acte publié au recueil" },
  { value: "lien", label: "Lien externe" },
  { value: "ref", label: "Référence" },
];

// ------------------------------------------- les décisions publiées au recueil
// Une décision peut être un acte PUBLIÉ par cette installation : le lien du visa
// est alors l'adresse du recueil en ligne. La liste vient du REGISTRE PUBLIC —
// l'écran ne lit rien d'autre (voir src/ui/views/publications.js, qui fait de
// même). Elle est chargée à la demande, une fois, et l'échec est silencieux :
// sans elle, on désigne encore la décision par une référence ou par une adresse.
let PUBLIEES = null;            // null = pas encore chargées
let publieesEnCours = false;
const abonnesPubliees = new Set();

function chargerPubliees(onCharge) {
  if (onCharge) abonnesPubliees.add(onCharge);
  if (PUBLIEES || publieesEnCours) return;
  publieesEnCours = true;
  get("/v1/publications", { label: "Décisions publiées au recueil", source: "lecture" })
    .then((r) => { PUBLIEES = r.ok ? (r.body.publications || []) : []; })
    .catch(() => { PUBLIEES = []; })
    .finally(() => {
      publieesEnCours = false;
      const fns = [...abonnesPubliees];
      abonnesPubliees.clear();
      for (const f of fns) f();
    });
}

const libelleNatureActe = (c, id) => {
  if (!id) return "";
  const t = (c.actTypes || []).find((x) => x.id === id);
  return t ? t.label : String(id);
};

// L'intitulé d'une décision publiée, tel qu'il se vise sur l'acte : « l'arrêté
// n° 2026-401-VSL du 20 janvier 2026 portant délégation de signature à… ».
// C'est un INSTANTANÉ : l'intitulé est rangé avec la délégation, pour que le
// référentiel reste lisible sans interroger le registre.
const intituleDePublication = (c, p) => {
  const nature = (libelleNatureActe(c, p.nature) || "acte").toLowerCase();
  const article = /^[aàâäeéèêëiîïoôöuùûüyh]/i.test(nature) ? "l'" : "le ";
  const objet = String(p.objet || "").trim();
  return article + nature
    + (p.numero ? " n° " + p.numero : "")
    + (p.dateDocument ? " du " + formatDate(p.dateDocument, "date-long") : "")
    + (objet ? " portant " + objet.charAt(0).toLowerCase() + objet.slice(1) : "");
};

const libellePublication = (p) => [p.numero ? "n° " + p.numero : "", p.objet || "", p.dateDocument ? formatDate(p.dateDocument) : ""].filter(Boolean).join(" — ");

// Ce qui manque, dit en français : « la décision de nomination (intitulé et
// lien) et la décision de délégation (lien) ». L'article défini est porté ici
// parce que toutes les phrases qui appellent ce résumé sont construites autour
// de lui (« Il manque ici… », « Décisions à renseigner : … »).
const resumeManque = (manque) => manque
  .map((x) => "la " + x.libelle + " (" + x.manque.join(" et ") + ")")
  .join(manque.length > 1 ? " et " : ", ");

// Une ligne « étiquette / valeur », pour la lecture seule.
function ligneInfo(label, valeur) {
  return h("div", { class: "org-fiche__ligne" },
    h("span", { class: "org-fiche__etq", text: label }),
    h("span", { class: "org-fiche__val", text: valeur || "—" }));
}

// ---------------------------------------------------------------- l'écran
export function renderDelegations(root) {
  const c = state.config;
  c.delegations = c.delegations || [];
  const ui = (state.ui = state.ui || {});
  if (ui.delegView !== "liste") ui.delegView = "organigramme";
  const peutGerer = can("delegations.gerer");

  const save = () => touch("config", { rerender: false });
  const paint = () => { save(); redrawView(); };

  const commun = { peutGerer, save, paint };
  const ouvrir = (noeud) => ouvrirFiche(c, { ...commun, noeud, ouvrir, creer });
  // `onFermer` : ce que la fiche appelante doit refaire quand cette fenêtre se
  // referme. « Ajouter une sous-délégation » s'en sert pour rester ouverte
  // derrière et se redessiner (voir `ouvrirFiche`).
  const creer = (fromId = "", onFermer = null) => ouvrirFiche(c, { ...commun, noeud: null, nouvelle: true, fromId, ouvrir, creer, onFermer });

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Organigramme des délégations" }),
      h("p", { class: "page-head__sub", text: "Qui peut signer à la place de qui. Chaque chaîne descend d'une autorité de tête, de délégation en sous-délégation, et l'acte signé au bout porte toutes les qualités traversées. Chaque délégation s'établit par deux décisions — celle qui nomme le délégataire, celle qui le délègue — désignées d'un acte publié au recueil ou d'un lien externe : l'acte signé les vise, et publie leur lien. Cliquez un acteur pour ouvrir sa fiche." }),
    ),
    h("div", { class: "page-head__actions" },
      peutGerer ? button("Nouvelle délégation", { variant: "primary", icon: "plus", onClick: () => creer() }) : null,
      helpLink("administrateurs", "Aide"),
    ),
  ));

  if (!peutGerer) {
    root.appendChild(h("p", { class: "org-lecseule" },
      h("span", { class: "fr-badge fr-badge--info", text: "Consultation" }),
      h("span", { text: " L'organigramme est visible par tous ; seuls les administrateurs et les éditeurs peuvent le modifier." })));
  }

  if (!c.delegations.length) {
    root.appendChild(emptyState(
      "Aucune délégation pour l'instant : chaque acte est signé par l'autorité qui le rend, sans mention de délégation.",
      peutGerer ? button("Créer la première délégation", { variant: "primary", icon: "plus", onClick: () => creer() }) : null,
    ));
    return;
  }

  const arbre = arbreDelegations(c);
  root.appendChild(barreOutils(ui, c.delegations.length));
  root.appendChild(ui.delegView === "liste" ? vueListe(c, arbre, ouvrir) : vueOrganigramme(c, arbre, ouvrir));

  // Ce qui n'apparaît dans aucun arbre : un délégant vide, inconnu du
  // référentiel, ou un cycle. On le montre quand même — sans quoi ces
  // délégations disparaîtraient de l'écran sans que personne ne s'en aperçoive.
  const vues = idsDansArbre(arbre);
  const orphelines = c.delegations.filter((d) => !vues.has(d.id));
  if (orphelines.length) root.appendChild(nonRattachees(c, orphelines, ouvrir));
}

// --------------------------------------------------------------- barre d'outils
function barreOutils(ui, nb) {
  const bascule = (id, label) => h("button", {
    class: "org-bascule__btn" + (ui.delegView === id ? " is-active" : ""),
    type: "button", role: "tab", "aria-selected": String(ui.delegView === id),
    onClick: () => { ui.delegView = id; redrawView(); },
  }, label);
  return h("div", { class: "org-outils" },
    h("div", { class: "org-bascule", role: "tablist", "aria-label": "Présentation" },
      bascule("organigramme", "Organigramme"),
      bascule("liste", "Liste")),
    h("span", { class: "fr-small fr-muted", text: nb + (nb > 1 ? " délégations" : " délégation") }),
    h("div", { class: "fr-spacer" }),
    h("div", { class: "org-legende", "aria-hidden": "true" },
      h("span", { class: "org-legende__i org-legende__i--tete", text: "Autorité de tête" }),
      h("span", { class: "org-legende__i org-legende__i--del", text: "Délégation" }),
      h("span", { class: "org-legende__i org-legende__i--sous", text: "Sous-délégation" })),
  );
}

// Les identifiants des délégations effectivement posées dans l'arbre.
function idsDansArbre(arbre) {
  const vues = new Set();
  const marcher = (noeuds) => {
    for (const n of noeuds) {
      if (n.delegation) vues.add(n.delegation.id);
      marcher(n.enfants || []);
    }
  };
  marcher(arbre);
  return vues;
}

// ------------------------------------------------------------- l'organigramme
// L'arbre est un CANVAS : on le saisit au curseur pour le déplacer, la molette
// règle le cran, la barre flottante le fait aussi (voir src/ui/zoom.js).
function vueOrganigramme(c, arbre, ouvrir) {
  const org = h("div", { class: "org" });
  for (const racine of arbre) org.appendChild(branche(c, racine, ouvrir, true));
  return cadreZoom(org, { mode: "canvas", cle: "delegations", classe: "org-scroll" });
}

function branche(c, noeud, ouvrir, racine = false) {
  const el = h("div", { class: "org-branch" });
  el.appendChild(noeudCarte(c, noeud, ouvrir));
  const enfants = noeud.enfants || [];
  if (enfants.length) {
    const kids = h("div", { class: "org-children" });
    for (const e of enfants) kids.appendChild(branche(c, e, ouvrir));
    el.appendChild(kids);
  }
  return el;
}

// ----------------------------------------------------------------- en liste
function vueListe(c, arbre, ouvrir) {
  const wrap = h("div", { class: "org-liste" });
  const poser = (noeud, niveau) => {
    wrap.appendChild(h("div", { class: "org-liste__ligne", style: { paddingLeft: niveau * 26 + "px" } },
      niveau > 0 ? h("span", { class: "org-liste__cran", "aria-hidden": "true", text: "└" }) : null,
      noeudCarte(c, noeud, ouvrir, "ligne")));
    for (const e of noeud.enfants || []) poser(e, niveau + 1);
  };
  for (const r of arbre) poser(r, 0);
  return wrap;
}

// -------------------------------------------------------------------- un nœud
function noeudCarte(c, noeud, ouvrir, mode = "carte") {
  const del = noeud.delegation || null;
  const p = noeud.person || null;
  const genre = genreDe(p);
  const rang = rangDe(noeud);
  const etat = etatDe(del);
  // Une délégation sans ses deux décisions n'établit rien : on le dit sur le
  // nœud, plutôt que de laisser croire qu'elle existe (voir decisionsManquantes).
  const manque = del ? decisionsManquantes(c, del) : [];
  const brut = del
    ? (qualiteDeDelegation(del, genre) || qualitePersonne(c, p))
    : (qualitePersonne(c, p) || p?.fonction || "");
  const qualite = brut ? avecArticle(brut, genre) : "Qualité à renseigner";
  const entite = entityById(del ? entiteDeDelegation(c, del) : (p?.entityId || ""));
  const nom = p ? personName(p) : "Délégataire à choisir";

  return h("button", {
    class: "org-node org-node--" + rang.classe + (mode === "ligne" ? " org-node--ligne" : "") + (etat ? " org-node--off" : "") + (manque.length ? " org-node--incomplet" : "") + (p ? "" : " org-node--vide"),
    type: "button",
    title: "Ouvrir la fiche de " + (p ? personName(p) : "cette délégation"),
    onClick: () => ouvrir(noeud),
  },
    h("span", { class: "org-node__haut" },
      h("span", { class: "org-node__init org-node__init--" + rang.classe, text: initialsOf(p) || "?" }),
      h("span", { class: "org-node__corps" },
        h("span", { class: "org-node__nom", text: nom }),
        h("span", { class: "org-node__qual", text: qualite }))),
    h("span", { class: "org-node__pied" },
      h("span", { class: "org-badge org-badge--" + rang.classe, text: rang.label }),
      entite && entite.code ? h("span", { class: "org-node__ent", text: entite.code }) : null,
      manque.length ? h("span", { class: "org-badge org-badge--manque", title: "Décisions manquantes : " + resumeManque(manque), text: "Décisions à compléter" }) : null,
      etat ? h("span", { class: "org-badge org-badge--off", text: etat.label }) : null),
  );
}

// ------------------------------------------------------------ non rattachées
function nonRattachees(c, orphelines, ouvrir) {
  const box = h("div", { class: "fr-alert fr-alert--warning", style: { marginTop: "18px" } },
    h("p", { class: "fr-alert__title", text: "Délégations non rattachées" }),
    h("p", { class: "fr-small", text: "Leur délégant n'est pas renseigné, ne figure pas dans le référentiel des personnes, ou forme un cycle : elles n'apparaissent pas dans l'organigramme. Ouvrez la fiche pour corriger le délégant." }));
  const liste = h("div", { class: "org-orph" });
  for (const d of orphelines) {
    const p = personById(d.toId);
    liste.appendChild(h("button", {
      class: "org-orph__item", type: "button",
      onClick: () => ouvrir({ delegation: d, person: p, niveau: 1, enfants: [] }),
    },
      h("span", { class: "org-orph__nom", text: p ? personName(p) : "Délégataire à choisir" }),
      h("span", { class: "fr-small fr-muted", text: d.qualiteM || "qualité à renseigner" })));
  }
  box.appendChild(liste);
  return box;
}

// ============================================================================
// La fiche d'un acteur — ouverte au clic sur un nœud.
//
// Elle sert les deux publics du même écran : celui qui CONSULTE y lit le
// pouvoir, son étendue, sa décision et ce que la signature produira ; celui qui
// ADMINISTRE y trouve les mêmes champs en saisie. Les deux voient le même
// aperçu de signature, qui se met à jour à la frappe.
// ============================================================================
function ouvrirFiche(c, opts) {
  const { peutGerer, save, paint, ouvrir, creer } = opts;
  const nouvelle = !!opts.nouvelle;
  // Une délégation neuve vit HORS du référentiel jusqu'à « Créer » : abandonner
  // la fiche ne laisse donc aucune délégation vide derrière soi.
  const d = nouvelle ? newDelegation({ fromId: opts.fromId || "" }) : (opts.noeud?.delegation || null);
  const autorite = !nouvelle && !d;
  const niveau = nouvelle ? 1 : (opts.noeud?.niveau || 1);
  const personne = autorite ? (opts.noeud?.person || null) : personById(d?.toId);
  // Les sous-délégations (ou, pour une autorité de tête, les délégations
  // qu'elle a données), RELUES à chaque dessin : en ajouter une depuis cette
  // fiche ne doit pas obliger à la refermer pour la voir apparaître.
  const enfants = () => {
    const id = autorite ? personne?.id : d?.toId;
    if (!id) return [];
    return (c.delegations || [])
      .filter((x) => x.fromId === id && x.toId !== id)
      .map((x) => ({ delegation: x, person: personById(x.toId), niveau: 1, enfants: [] }));
  };

  // La personne de la fiche, relue à chaque dessin : le délégataire se choisit
  // ICI, et la tête comme le bloc « compte et signature électronique » doivent
  // suivre ce choix sans qu'on ait à rouvrir la fiche.
  const personneCourante = () => (autorite ? (opts.noeud?.person || null) : personById(d?.toId));

  const body = h("div", { class: "org-fiche" });
  let apercu = null;
  let majBanniere = null;       // l'avis « décisions renseignées / à compléter »
  const etats = [];             // les états des deux décisions, rafraîchis à la frappe
  const choixSource = [];       // les pastilles « D'où vient la décision », relues à la frappe

  const titre = autorite
    ? "Fiche — " + (personName(personne) || "autorité de tête")
    : nouvelle ? "Nouvelle délégation" : "Fiche — " + (personName(personne) || "délégation");

  const m = modal({
    title: titre, body, wide: true,
    // La fiche n'est pas la seule fenêtre ouverte : « Ajouter une sous-délégation »
    // en ouvre une seconde PAR-DESSUS, sans refermer celle-ci (voir `ouvrirFiche`
    // et `onFermer`). Quand la fenêtre fille se referme — la sous-délégation
    // créée, ou l'abandon —, la fiche reprend la main et se redessine pour
    // montrer la chaîne à jour.
    onClose: () => opts.onFermer && opts.onFermer(),
    actions: (close) => {
      const out = [];
      if (peutGerer && autorite) out.push(button("Nouvelle délégation de cette autorité", { variant: "secondary", icon: "plus", onClick: () => { creer(personne?.id || "", () => peindre()); } }));
      if (peutGerer && nouvelle) out.push(button("Créer la délégation", { variant: "primary", icon: "plus", onClick: () => {
        if (!d.fromId) { toast("Choisissez d'abord le délégant.", "warning"); return; }
        if (!d.toId) { toast("Choisissez ensuite le délégataire.", "warning"); return; }
        if (d.fromId === d.toId) { toast("Une autorité ne se délègue pas sa propre signature.", "warning"); return; }
        // Un signataire ne se configure pas sans ses deux décisions : c'est par
        // elles, et par elles seules, que la délégation existe — et l'acte les
        // vise, avec leur lien. Voir src/lib/delegations.js.
        const manque = decisionsManquantes(configLecture(), d);
        if (manque.length) {
          toast("Décisions à renseigner : " + resumeManque(manque) + ".", "warning");
          return;
        }
        c.delegations.push(d);
        // La désignation vaut qualité : le délégataire signe, et l'autorité de
        // tête dont la signature est engagée est signataire elle aussi.
        assurerSignataire(d.fromId);
        assurerSignataire(d.toId);
        paint();
        close();
      } }));
      if (peutGerer && !autorite && !nouvelle) out.push(button("Supprimer", { variant: "tertiary", icon: "trash", onClick: async () => {
        const nom = personName(personne) || "ce délégataire";
        if (!(await confirmDialog("Supprimer cette délégation ?", "La signature de " + nom + " ne passera plus par cette chaîne : l'acte repartira de l'autorité de tête."))) return;
        const i = c.delegations.indexOf(d);
        if (i >= 0) c.delegations.splice(i, 1);
        paint();
        close();
      } }));
      out.push(button("Fermer", { variant: "secondary", onClick: close }));
      return out;
    },
  });

  // Une délégation neuve n'est pas encore dans le référentiel : pour que
  // l'aperçu dise ce qu'elle produira, on la fait lire comme si elle y était.
  const configLecture = () => (nouvelle ? { ...c, delegations: [...c.delegations, d] } : c);

  // Le champ délégataire se choisit, comme partout, parmi les personnes du
  // référentiel ; le délégant aussi. On ne se délègue pas à soi-même : la
  // personne du délégant est retirée de la liste.
  const optionsDelegataires = () => optionsPersonnes(c).filter((o) => o.value !== d.fromId);

  // L'en-tête et les badges dépendent du délégataire, de sa qualité et des
  // dates : ce sont les seules parties qu'un simple changement de valeur
  // oblige à redessiner sans reconstruire toute la fiche.
  function teteFiche() {
    const personne = personneCourante();
    const genre = genreDe(personne);
    const rang = autorite ? rangDe({ delegation: null }) : rangDe({ delegation: d, niveau });
    const etat = autorite ? null : etatDe(d);
    const manque = autorite ? [] : decisionsManquantes(configLecture(), d);
    const brut = autorite
      ? (qualitePersonne(c, personne) || personne?.fonction || "")
      : (qualiteDeDelegation(d, genre) || qualitePersonne(c, personne));
    const entite = entityById(autorite ? (personne?.entityId || "") : entiteDeDelegation(configLecture(), d));
    return h("div", { class: "org-fiche__tete" },
      h("span", { class: "org-node__init org-node__init--lg org-node__init--" + rang.classe, text: initialsOf(personne) || "?" }),
      h("div", { class: "org-fiche__ident" },
        h("strong", { class: "org-fiche__nom", text: personne ? personName(personne) : "Délégataire à choisir" }),
        h("span", { class: "org-fiche__qual", text: brut ? avecArticle(brut, genre) : "Qualité à renseigner" }),
        h("div", { class: "fr-row", style: { gap: "6px", marginTop: "6px" } },
          h("span", { class: "org-badge org-badge--" + rang.classe, text: rang.label }),
          entite && entite.code ? h("span", { class: "org-node__ent", text: entite.code }) : null,
          manque.length ? h("span", { class: "org-badge org-badge--manque", title: "Décisions manquantes : " + resumeManque(manque), text: "Décisions à compléter" }) : null,
          etat ? h("span", { class: "org-badge org-badge--off", text: etat.label }) : null)));
  }

  // ------------------------------------------------------------ l'aperçu
  // Ce que la signature donnera : c'est le seul moyen de vérifier l'accord en
  // genre, l'ordre des étages et la série des visas sans rédiger un acte pour
  // voir. Recalculé à la frappe — c'est tout l'intérêt de la fiche.
  function majApercu() {
    clear(apercu);
    if (autorite) { majAutorite(); return; }
    const p = personById(d.toId);
    if (!p) {
      apercu.appendChild(h("p", { class: "fr-small fr-muted", text: "Choisissez le délégataire : la signature qu'il produira s'affichera ici." }));
      return;
    }
    // Une délégation HORS D'EFFET — suspendue, échue, ou pas encore commencée —
    // ne produit ni ligne de signature ni décision visée : le dire ici, plutôt
    // que d'afficher « Aucune décision renseignée », qui laisserait croire que
    // rien n'a été saisi alors que les deux décisions sont bel et bien là.
    const etat = etatDe(d);
    if (etat) {
      apercu.appendChild(h("div", { class: "fr-alert fr-alert--info" },
        h("p", { class: "fr-alert__title", text: "Délégation hors d'effet — " + etat.label.toLowerCase() }),
        h("p", { class: "fr-small", text: "Ses deux décisions sont bien renseignées : hors d'effet, elle ne produit ni ligne de signature ni décision visée, et les actes repartent de l'autorité de tête. " + (d.active === false ? "Remettez-la « En vigueur » dans « La durée et l'état » pour la rétablir." : "Corrigez ses dates dans « La durée et l'état » pour la rétablir.") })));
      return;
    }
    const portee = { familyId: d.familyId || "", actTypeId: d.actTypeId || "", entityId: entiteDeDelegation(configLecture(), d) };
    const lignes = lignesQualites(configLecture(), p.id, portee);
    const decisions = decisionsDeSignature(configLecture(), p.id, portee);
    if (lignes.length) {
      apercu.appendChild(h("div", { class: "deleg-apercu" },
        h("span", { class: "inspector__label", text: "Lignes de signature" }),
        ...lignes.map((l, i) => h("p", { class: "deleg-apercu__l" + (i === 0 ? " deleg-apercu__l--tete" : ""), text: l })),
        h("p", { class: "deleg-apercu__l deleg-apercu__l--nom", text: personSignatureName(p) || "—" })));
    } else {
      apercu.appendChild(h("p", { class: "fr-small fr-muted", text: "Renseignez la qualité du délégataire : sans elle, la ligne de signature serait vide." }));
    }
    apercu.appendChild(h("div", { class: "deleg-apercu" },
      h("span", { class: "inspector__label", text: decisions.length > 1 ? "Décisions visées (" + decisions.length + ")" : "Décision visée" }),
      decisions.length
        ? h("div", {}, ...decisions.map((x) => h("p", { class: "deleg-apercu__l" },
          (c.vocab?.visasLabel || "Vu") + " ",
          x.lien
            ? h("a", { class: "deleg-apercu__lien", href: x.lien, target: "_blank", rel: "noopener noreferrer", title: x.lien, text: x.label })
            : x.label)))
        : h("p", { class: "fr-small fr-muted", text: "Aucune décision renseignée : l'acte ne visera rien au titre de la signature." })));
    if (decisions.length && decisions.some((x) => !x.lien)) {
      apercu.appendChild(h("p", { class: "fr-small fr-muted", text: "Les décisions soulignées sont des liens : le lecteur de l'acte publié (page du recueil, PDF) clique pour ouvrir la décision." }));
    }
  }

  // ------------------------------------------------- ce qui est propre à l'autorité de tête
  function majAutorite() {
    const roles = (personne?.roles || []).map((id) => (c.roles || []).find((r) => r.id === id)?.label || id).filter(Boolean);
    const refId = personne?.fondementRefId || "";
    const lien = lienDeReference(c, refId);
    apercu.appendChild(h("div", { class: "org-fiche__bloc" },
      ligneInfo("Rôle", roles.join(", ")),
      ligneInfo("Organisation", entityById(personne?.entityId)?.name || ""),
      ligneInfo("Décision fondant son pouvoir", libelleDecision(c, refId, "") || "non renseignée"),
      lien
        ? h("div", { class: "org-fiche__ligne" },
          h("span", { class: "org-fiche__etq", text: "Lien" }),
          h("span", { class: "org-fiche__val" }, h("a", { class: "deleg-lien", href: lien, target: "_blank", rel: "noopener noreferrer", text: lien })))
        : null,
      ligneInfo("Délégations données", String(c.delegations.filter((x) => x.fromId === personne?.id).length))));
    if (!lien && refId) {
      apercu.appendChild(h("p", { class: "fr-small fr-muted", text: "Cette décision ne porte pas d'adresse : renseignez son « URL de la source » (Administration › Références) pour que les actes s'y lient." }));
    }
    if (can("referentiel.gerer")) {
      apercu.appendChild(h("p", { class: "fr-small" },
        button("Ouvrir sa fiche dans le référentiel", { variant: "tertiary", size: "sm", icon: "gear", onClick: () => { state.ui.refTab = "personnes"; navigate("referentiel"); } })));
    }
  }

  // ------------------------------------------------------------- le dessin
  function peindre() {
    clear(body);
    etats.length = 0;
    choixSource.length = 0;
    majBanniere = null;
    body.appendChild(teteFiche());
    apercu = h("div", { class: "fr-stack" });
    body.appendChild(sectionHeader(autorite ? "L'autorité de tête" : "Ce que la signature donnera"));
    body.appendChild(apercu);

    if (!autorite) {
      body.appendChild(h("hr", { class: "fr-sep" }));
      body.appendChild(sectionHeader("Le pouvoir"));
      body.appendChild(peutGerer ? blocPouvoir() : blocPouvoirLecture());

      body.appendChild(h("hr", { class: "fr-sep" }));
      body.appendChild(sectionHeader("L'étendue de la délégation"));
      body.appendChild(peutGerer ? blocEtendue() : blocEtendueLecture());

      body.appendChild(h("hr", { class: "fr-sep" }));
      body.appendChild(sectionHeader("Les décisions fondant la signature"));
      body.appendChild(peutGerer ? blocDecisions() : blocDecisionsLecture());

      body.appendChild(h("hr", { class: "fr-sep" }));
      body.appendChild(sectionHeader("La durée et l'état"));
      body.appendChild(peutGerer ? blocDuree() : blocDureeLecture());
    }

    const blocSig = blocSignature();
    if (blocSig) {
      body.appendChild(h("hr", { class: "fr-sep" }));
      body.appendChild(sectionHeader("Compte et signature électronique"));
      body.appendChild(blocSig);
    }

    const listeEnfants = enfants();
    if (listeEnfants.length) {
      const libelle = autorite ? "Délégataires" : "Sous-délégations";
      body.appendChild(h("hr", { class: "fr-sep" }));
      body.appendChild(sectionHeader(libelle));
      const liste = h("div", { class: "org-orph" });
      for (const e of listeEnfants) {
        const p = e.person;
        liste.appendChild(h("button", { class: "org-orph__item", type: "button", onClick: () => { m.close(); ouvrir(e); } },
          h("span", { class: "org-orph__nom", text: p ? personName(p) : "Délégataire à choisir" }),
          h("span", { class: "fr-small fr-muted", text: qualiteDeDelegation(e.delegation, genreDe(p)) || "qualité à renseigner" })));
      }
      body.appendChild(liste);
    }

    if (peutGerer && !autorite && !nouvelle) {
      body.appendChild(h("p", { class: "fr-small" },
        button("Ajouter une sous-délégation", {
          variant: "tertiary", size: "sm", icon: "plus",
          // La fiche de la sous-délégation s'ouvre PAR-DESSUS celle-ci : la
          // chaîne qu'on était en train de lire ne disparaît pas, et se
          // redessine quand la nouvelle fiche se referme.
          onClick: () => creer(d.toId || "", () => peindre()),
        })));
    }

    majApercu();
  }

  // --- saisie ---------------------------------------------------------------
  function blocPouvoir() {
    return h("div", { class: "fr-grid fr-grid--2" },
      selectField({
        label: "Délégant — l'autorité qui délègue", value: d.fromId || "", options: optionsPersonnes(c), placeholder: "— Choisir —",
        help: "L'autorité dont la compétence descend. Elle ne tient elle-même sa signature d'aucune délégation : elle est la tête de la chaîne. La désigner ici lui donne la qualité de signataire.",
        onChange: (v) => { d.fromId = v; if (d.toId === v) d.toId = ""; assurerSignataire(v); paint(); peindre(); },
      }),
      selectField({
        label: "Délégataire — celui qui signe", value: d.toId || "", options: optionsDelegataires(), placeholder: "— Choisir —",
        help: "C'est de cette personne que part la chaîne : un acte qu'elle signe portera les qualités traversées. La désigner lui donne la qualité de signataire.",
        onChange: (v) => { d.toId = v; assurerSignataire(v); paint(); peindre(); },
      }),
      selectField({
        label: "Organisation, dans le nom de laquelle elle est donnée", value: d.entityId || "", options: optionsEntites(c), placeholder: "— Celle du délégant —",
        help: "Une délégation donnée dans une autre organisation ne s'applique pas aux actes de celle-ci : c'est ce qui rend les chaînes indépendantes les unes des autres.",
        onChange: (v) => { d.entityId = v; paint(); peindre(); },
      }),
      h("div", { class: "org-fiche__ligne" },
        h("span", { class: "org-fiche__etq", text: "Chaîne rattachée à" }),
        h("span", { class: "org-fiche__val", text: entityById(entiteDeDelegation(configLecture(), d))?.name || "—" })));
  }

  function blocPouvoirLecture() {
    return h("div", { class: "org-fiche__bloc" },
      ligneInfo("Délégant", personName(personById(d.fromId))),
      ligneInfo("Délégataire", personName(personne)),
      ligneInfo("Organisation", entityById(entiteDeDelegation(c, d))?.name || ""));
  }

  function blocEtendue() {
    return h("div", { class: "fr-grid fr-grid--2" },
      textField({
        label: "Qualité du délégataire, au masculin", value: d.qualiteM || "", placeholder: "ex. adjoint au maire en charge de l'urbanisme",
        help: "Sans article : l'application écrit « l'adjoint… » ou « le maire… » selon le genre du délégataire.",
        onChange: (v) => { d.qualiteM = v; save(); majLeger(); },
      }),
      textField({
        label: "La même, au féminin", value: d.qualiteF || "", placeholder: "ex. adjointe au maire en charge de l'urbanisme",
        help: "Laisser vide pour reprendre la forme masculine.",
        onChange: (v) => { d.qualiteF = v; save(); majLeger(); },
      }),
      textField({
        label: "Matières déléguées (pour mémoire)", value: d.matieres || "", placeholder: "ex. autorisations d'urbanisme, permis de construire",
        onChange: (v) => { d.matieres = v; save(); },
      }),
      selectField({
        label: "Famille de trames visée", value: d.familyId || "", options: (c.families || []).map((f) => ({ value: f.id, label: f.label || f.id })),
        placeholder: "— Toutes les familles —",
        help: "Restreint la délégation. Une délégation qui nomme une famille ne s'applique qu'aux actes de cette famille.",
        onChange: (v) => { d.familyId = v; paint(); peindre(); },
      }),
      selectField({
        label: "Type d'acte visé", value: d.actTypeId || "", options: (c.actTypes || []).map((a) => ({ value: a.id, label: a.label })),
        placeholder: "— Tous les types —",
        onChange: (v) => { d.actTypeId = v; paint(); peindre(); },
      }));
  }

  function blocEtendueLecture() {
    const famille = (c.families || []).find((f) => f.id === d.familyId);
    const type = (c.actTypes || []).find((a) => a.id === d.actTypeId);
    return h("div", { class: "org-fiche__bloc" },
      ligneInfo("Qualité (masculin / féminin)", [d.qualiteM, d.qualiteF].filter(Boolean).join(" / ")),
      ligneInfo("Matières déléguées", d.matieres),
      ligneInfo("Famille de trames", famille ? (famille.label || famille.id) : ""),
      ligneInfo("Type d'acte", type ? type.label : ""));
  }

  // ------------------------------------------ les deux décisions fondant la signature
  // Un signataire en délégation ne se configure pas sans ses deux décisions :
  // celle qui le NOMME et celle qui le DÉLÈGUE. Chacune se désigne d'un acte
  // publié au recueil (le lien est celui du recueil en ligne), d'une référence du
  // référentiel (le lien est son « URL de la source ») ou d'une adresse externe.
  // L'acte publié portera l'intitulé ET le lien — sur le web comme en PDF.
  function blocDecisions() {
    const banniere = h("div", { class: "deleg-decision__etat" });
    majBanniere = () => {
      clear(banniere);
      const manque = decisionsManquantes(configLecture(), d);
      if (!manque.length) {
        banniere.appendChild(h("p", { class: "fr-small fr-muted", text: "Ces deux décisions sont visées sur les actes signés au bout de la chaîne, avec leur lien : sur le web comme en PDF, le lecteur clique." }));
        return;
      }
      banniere.appendChild(h("div", { class: "fr-alert fr-alert--warning" },
        h("p", { class: "fr-alert__title", text: nouvelle ? "Décisions à renseigner" : "Délégation incomplète" }),
        h("p", { class: "fr-small", text: "Une délégation de signature s'établit par DEUX décisions : celle qui nomme le délégataire et celle qui lui donne la délégation. Il manque ici " + resumeManque(manque) + "." }),
        h("p", { class: "fr-small", text: nouvelle
          ? "La délégation ne peut pas être créée en l'état : l'acte n'aurait rien à viser, et le pouvoir de signer ne serait pas établi."
          : "L'acte ne peut pas se fonder sur cette délégation en l'état : le contrôle de conformité le signale, et la signature reste bloquée." })));
    };
    majBanniere();
    return h("div", { class: "fr-stack" },
      banniere,
      blocDecision("nomination"),
      blocDecision("acte"));
  }

  function blocDecision(base) {
    const ch = CHAMPS_DECISION[base];
    const source = sourceDeDecision(d, base);
    const corps = h("div", { class: "deleg-decision__corps" });
    const etat = h("p", { class: "deleg-decision__state" });
    const peindreEtat = () => {
      const r = decisionRenseignee(configLecture(), d, base);
      etat.className = "deleg-decision__state" + (r.ok ? " is-ok" : " is-manque");
      etat.textContent = r.ok
        ? "Renseignée — le visa portera son lien."
        : "À compléter : " + (r.manque.includes("intitulé") ? "l'intitulé" : "") + (r.manque.length === 2 ? " et " : "") + (r.manque.includes("lien") ? "l'adresse (le lien)" : "") + ".";
    };
    etats.push(peindreEtat);
    peindreEtat();

    // Le contrôle qui dépend de la source : un acte publié, une référence, une
    // adresse. Le choix ci-dessus en décide.
    clear(corps);
    const controle = controleurDeDecision(base, ch, source);
    if (controle) corps.appendChild(controle);
    // L'adresse, quand la source choisie n'en donne pas encore : décision sans
    // source, ou référence du référentiel qui ne porte pas la sienne. Sans ce
    // champ, l'intitulé se remplissait sans qu'aucune adresse ne pût être
    // saisie : la décision restait incomplète et la délégation impossible à
    // créer, sans que rien ne dise où l'adresse attendue s'écrivait.
    const adresse = champAdresseDeDecision(base, ch, source);
    if (adresse) corps.appendChild(adresse);

    const choix = choiceField({
      label: "D'où vient la décision",
      value: source,
      options: SOURCES_DECISION,
      onChange: (v) => {
        // Une seule source à la fois : les autres champs sont effacés, sans
        // quoi l'intitulé et le lien pourraient venir de deux endroits. Le
        // choix lui-même est rangé (`…Source`) — un choix d'« acte publié »
        // encore vide doit se distinguer de « non renseignée ».
        if (v === sourceDeDecision(d, base)) return;   // re-clic : rien à effacer
        d[ch.cle] = ""; d[ch.url] = ""; d[ch.refId] = "";
        d[base + "Source"] = v;
        if (v === "publication" && !PUBLIEES) chargerPubliees(() => peindre());
        save(); paint(); peindre();
      },
    });
    // La pastille suit la frappe : saisir une adresse ci-dessous fait de la
    // décision un lien externe, et le choix doit le dire — sans reconstruire la
    // fiche, qui réécrirait le champ sous les doigts de celui qui le remplit.
    const relireChoix = () => {
      const v = sourceDeDecision(d, base);
      [...choix.querySelectorAll(".fr-choice")].forEach((b, i) => b.classList.toggle("is-on", SOURCES_DECISION[i].value === v));
    };
    choixSource.push(relireChoix);

    return h("div", { class: "deleg-decision" },
      h("div", { class: "deleg-decision__tete" },
        h("span", { class: "deleg-decision__titre", text: base === "nomination" ? "Décision de nomination" : "Décision de délégation" }),
        h("span", { class: "deleg-decision__aide", text: base === "nomination"
          ? "L'acte qui a nommé le délégataire à sa fonction (arrêté de nomination, délibération d'élection…)."
          : "L'acte par lequel la délégation de signature lui a été donnée." })),
      choix,
      corps,
      // L'intitulé qui sera visé. Quand la décision est une RÉFÉRENCE du
      // référentiel, c'est son libellé qui s'imprime : on le montre, sans le
      // laisser corriger ici (c'est la référence qu'il faut changer).
      source === "ref"
        ? frField("Intitulé visé sur l'acte",
          h("p", { class: "deleg-decision__intitule", text: intituleDecision(configLecture(), d, base) || "—" }),
          { help: "L'intitulé vient de la référence choisie (Administration › Références)." })
        : textField({
          label: "Intitulé visé sur l'acte",
          value: d[base] || "",
          placeholder: base === "nomination" ? "ex. l'arrêté du maire du 2 avril 2026 portant nomination d'Éric BERNARD en qualité d'adjoint" : "ex. l'arrêté du maire du 10 avril 2026 portant délégation de signature aux adjoints",
          help: "Ce que l'acte imprime après « " + (c.vocab?.visasLabel || "Vu") + " ». Il commence par l'article (« l'arrêté… », « la délibération… »). Rempli d'office quand vous choisissez un acte publié.",
          onChange: (v) => { d[base] = v; save(); majLeger(); },
        }),
      etat);
  }

  // Le contrôle de la source choisie.
  function controleurDeDecision(base, ch, source) {
    if (source === "publication") {
      if (!PUBLIEES) {
        if (!publieesEnCours) chargerPubliees(() => peindre());
        return h("p", { class: "fr-small fr-muted", text: publieesEnCours ? "Chargement des actes publiés au recueil…" : "Le registre des publications est indisponible : désignez la décision par une référence du référentiel ou par un lien externe." });
      }
      if (!PUBLIEES.length) {
        return h("p", { class: "fr-small fr-muted", text: "Aucun acte n'est publié au recueil pour l'instant : publiez-le d'abord (écran Signature & publication), ou désignez la décision par une référence du référentiel ou par un lien externe." });
      }
      return selectField({
        label: "Acte publié au recueil",
        value: ch.cle && d[ch.cle] ? d[ch.cle] : "",
        placeholder: "— Choisir un acte publié —",
        options: PUBLIEES.map((p) => ({ value: p.cle, label: libellePublication(p) })),
        help: "Le lien du visa sera l'adresse de cet acte au recueil — elle suit l'acte, et ne se recopie pas à la main.",
        onChange: (v) => {
          const p = PUBLIEES.find((x) => x.cle === v);
          d[ch.cle] = v;
          if (p) d[base] = intituleDePublication(configLecture(), p);
          save(); paint(); peindre();
        },
      });
    }
    if (source === "ref") {
      const sansLien = !!d[ch.refId] && !lienDecision(configLecture(), d, base);
      return selectField({
        label: "Référence du référentiel",
        value: d[ch.refId] || "",
        placeholder: "— Choisir une référence —",
        options: refsDecision(c),
        help: sansLien
          ? "Cette référence ne porte pas d'adresse : saisissez-la ci-dessous, ou renseignez son « URL de la source » (Administration › Références)."
          : "Le lien du visa sera l'« URL de la source » de la référence (Administration › Références).",
        onChange: (v) => {
          d[ch.refId] = v;
          const lib = libelleDecision(configLecture(), v, "");
          if (lib) d[base] = lib;
          save(); paint(); peindre();
        },
      });
    }
    if (source === "lien") {
      return textField({
        label: "Adresse (lien externe)",
        type: "url",
        value: d[ch.url] || "",
        placeholder: "https://…",
        help: "L'adresse où la décision se lit : site de la collectivité, Légifrance, intranet… Elle est posée sur le visa de l'acte, et s'ouvre d'un clic.",
        onChange: (v) => { d[ch.url] = v; save(); majLeger(); },
      });
    }
    return null;
  }

  // L'adresse saisie à la main, pour les sources qui n'en donnent pas encore :
  // une décision sans source (dont l'intitulé se saisit, et dont l'adresse doit
  // pouvoir se saisir aussi), ou une référence du référentiel qui ne porte pas la
  // sienne. La source n'est pas rangée pour autant : `sourceDeDecision` déduit
  // « lien externe » de la seule présence d'une adresse, et la pastille du choix
  // se relit à la frappe (voir `choixSource`). Sans ce champ, la décision restait
  // INCOMPLÉTABLE : l'écran refusait de créer la délégation faute de lien.
  function champAdresseDeDecision(base, ch, source) {
    // L'« acte publié » a son propre contrôle — le menu des actes — et le
    // « lien externe » EST ce champ : rien à ajouter dans ces deux cas.
    if (source === "lien" || source === "publication") return null;
    // La source en donne déjà une (référence qui porte son adresse) : inutile.
    if (lienDecision(configLecture(), d, base)) return null;
    return textField({
      label: "Adresse de la décision",
      type: "url",
      value: d[ch.url] || "",
      placeholder: "https://…",
      help: source === "ref"
        ? "L'adresse à porter au visa. Elle peut aussi s'inscrire une fois pour toutes sur la référence (Administration › Références)."
        : "L'adresse où la décision se lit : site de la collectivité, Légifrance, intranet… Elle est posée sur le visa de l'acte, et s'ouvre d'un clic. Saisir une adresse fait de la décision un lien externe ; pour un acte publié au recueil ou une référence du référentiel, choisissez d'abord cette source ci-dessus.",
      onChange: (v) => { d[ch.url] = v; save(); majLeger(); },
    });
  }

  function blocDecisionsLecture() {
    const bloc = h("div", { class: "org-fiche__bloc" });
    const manque = decisionsManquantes(c, d);
    if (manque.length) {
      bloc.appendChild(h("div", { class: "fr-alert fr-alert--warning", style: { marginBottom: "8px" } },
        h("p", { class: "fr-alert__title", text: "Délégation incomplète" }),
        h("p", { class: "fr-small", text: "Il manque " + resumeManque(manque) + " : le pouvoir de signer ne s'établit pas par cette délégation." })));
    }
    for (const base of DECISIONS) {
      const ch = CHAMPS_DECISION[base];
      const r = decisionRenseignee(c, d, base);
      bloc.appendChild(ligneInfo(
        base === "nomination" ? "Décision de nomination" : "Décision de délégation",
        r.intitule || "non renseignée"));
      if (r.lien) {
        bloc.appendChild(h("div", { class: "org-fiche__ligne" },
          h("span", { class: "org-fiche__etq", text: "Lien" }),
          h("span", { class: "org-fiche__val" },
            h("a", { href: r.lien, target: "_blank", rel: "noopener noreferrer", class: "deleg-lien", text: r.lien }))));
      }
      if (!r.ok) {
        bloc.appendChild(h("p", { class: "fr-small fr-muted", text: "Manque " + r.manque.join(" et ") + (base === "nomination" ? " (décision de nomination)." : " (décision de délégation).") }));
      }
    }
    return bloc;
  }

  function blocDuree() {
    return h("div", { class: "fr-grid fr-grid--2" },
      textField({ label: "En vigueur du", type: "date", value: d.du || "", onChange: (v) => { d.du = v; save(); majLeger(); } }),
      textField({ label: "au", type: "date", value: d.au || "", onChange: (v) => { d.au = v; save(); majLeger(); } }),
      choiceField({
        label: "État", value: d.active !== false,
        options: [{ value: true, label: "En vigueur" }, { value: false, label: "Suspendue" }],
        help: "Suspendue, la délégation reste dans l'organigramme mais ne s'applique plus : les actes repartent de l'autorité de tête.",
        onChange: (v) => { d.active = v; paint(); peindre(); },
      }));
  }

  function blocDureeLecture() {
    return h("div", { class: "org-fiche__bloc" },
      ligneInfo("En vigueur", d.du || d.au ? [d.du ? "du " + formatDate(d.du) : "", d.au ? "au " + formatDate(d.au) : ""].filter(Boolean).join(" ") : ""),
      ligneInfo("État", d.active === false ? "Suspendue" : "En vigueur"));
  }

  // ------------------------------------------- compte et signature électronique
  // Un signataire signe avec SON compte : celui de l'annuaire de la collectivité
  // (OIDC), et celui que l'outil de signature lui connaît. Le rapprochement des
  // deux se fait ici — c'est le pendant de la désignation, qui, elle, donne la
  // qualité de signataire au compte (voir src/lib/signataires.js).
  function blocSignature() {
    const personne = personneCourante();
    if (!personne) return null;
    const etat = etatRapprochement(c, state.users, personne.id);
    const estSignataire = etat.compte ? hasRole(etat.compte, ROLE_SIGNATAIRE) : false;
    return h("div", { class: "org-fiche__bloc" },
      ligneInfo("Compte de l'application", etat.compte ? `${fullName(etat.compte)} · ${etat.compte.login || ""}` : "aucun compte rattaché"),
      ligneInfo("Qualité de signataire", estSignataire ? "oui" : (etat.compte ? "non" : "—")),
      ligneInfo("Compte de l'outil de signature", etat.compteOutil || "—"),
      ligneInfo("Rapprochement", etat.ok
        ? `fait le ${formatDate(String(etat.declare?.rapprocheLe || "").slice(0, 10), "date-long")}${etat.declare?.par ? " par " + etat.declare.par : ""}`
        : etat.motif),
      peutGerer
        ? h("div", { class: "fr-row", style: { marginTop: "6px" } },
          etat.ok
            ? button("Rapprocher de nouveau", { variant: "tertiary", size: "sm", icon: "refresh", onClick: async () => {
              const r = rapprocher(c, state.users, personne.id, { par: fullName(currentUser()) || "" });
              if (!r.ok) { toast(r.motif, "warning"); return; }
              paint(); peindre();
              toast("Rapprochement enregistré.", "success");
            } })
            : button("Rapprocher avec l'outil de signature", { variant: "primary", size: "sm", icon: "check", onClick: async () => {
              const r = rapprocher(c, state.users, personne.id, { par: fullName(currentUser()) || "" });
              if (!r.ok) { toast(r.motif, "warning"); return; }
              await journaliser({
                action: "signature.rapproche", cible: "personne", cibleLabel: personName(personne),
                detail: `compte rapproché de l'outil de signature (${r.etat.compteOutil})`, to: [],
              });
              paint(); peindre();
              toast("Compte rapproché de l'outil de signature.", "success");
            } }),
          etat.ok ? button("Retirer le rapprochement", { variant: "tertiary", size: "sm", icon: "x", onClick: () => {
            deRapprocher(c, personne.id); paint(); peindre();
          } }) : null)
        : null);
  }

  peindre();

  // Un changement de qualité, de décision ou de date se reflète dans l'aperçu
  // et dans l'arbre, mais ne reconstruit PAS la fiche : réécrire le champ sous
  // les doigts de celui qui le remplit lui ferait perdre sa place.
  function majLeger() {
    redrawView();
    majApercu();
    const t = body.querySelector(".org-fiche__tete");
    if (t) t.replaceWith(teteFiche());
    // L'état des décisions et l'avis général suivent la frappe : c'est ce qui
    // dit, sans quitter la fiche, si la délégation est complète.
    majBanniere?.();
    for (const f of etats) f();
    for (const f of choixSource) f();
  }
}
