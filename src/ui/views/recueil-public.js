// ============================================================================
// Recueil public — la partie « citoyen ».
//
// Un site, et rien d'autre : l'identité de la collectivité, le titre du
// recueil, une recherche, la liste des actes publiés — et, pour chacun, son
// texte rendu DANS la page. Aucun compte n'est requis, et rien de l'atelier
// n'apparaît ici : ni trame, ni brouillon, ni circuit, ni compte.
//
// La route est publique (« #/recueil » et « #/recueil/<clé> ») : elle est
// reconnue AVANT le contrôle de session (voir src/ui/app.js). Ce que le lecteur
// voit vient du service de publication — le même que celui qui attribue les
// identifiants ELI : un acte n'est là que s'il a été réellement publié, et seul
// l'original signé fait foi.
// ============================================================================
import { state, can, navigate, majUrlRecherche } from "../state.js";
import { h, clear, button, icon } from "../dom.js";
import { estVisiteur } from "../../lib/users.js";
import { demoNotice } from "../notice.js";
import { get, bodyOf } from "../../lib/remote.js";
import { publicationSettings } from "../../lib/eli.js";
import { formatDate } from "../../lib/util.js";
import { filtrerPublications, facettes, parAnnee, parTheme, dernieresPublications, publicationsEnVigueur, publicationsEpinglees,
  SANS_THEME, themeLabel, themeDescription,
  hrefRecueil, hrefActe, adresseRecueil, adresseActe,
  adresseFichier, urlFormat, FORMATS_OUVERTS, FICHIERS_OUVERTS, autoHeberge,
  estEliUri, publicationParEli,
  texteDePublication, markdownDePublication, jsonDePublication,
  recueilsExternes, recueilExterneTypeLabel, urlRecueilExterne, periodeRecueil,
  mentionsPubliques, blocsMention } from "../../lib/recueil.js";
import { licenceReutilisation } from "../../lib/recueil.js";
import { corpsDeLActe, setListePublications, natureLabel, themeDePublication, themeLabelDePublication, blocOriginal, blocPieces, blocSignature, blocVersions, blocDonneesPubliques } from "./acte-publie.js";

export function renderRecueilPublic(root, params) {
  monte = { root, params: params || {} };
  const st = etat();
  charger(st);
  root.appendChild(vue(st, monte.params));
}

// ------------------------------------------------------------------ état

let monte = null;

function etat() {
  const st = (state.recueil = state.recueil || {});
  if (st.liste === undefined) st.liste = null;
  st.chargement = !!st.chargement;
  st.criteres = st.criteres || { q: "", nature: "", annee: "", entity: "", theme: "" };
  if (st.criteres.theme === undefined) st.criteres.theme = "";
  st.actes = st.actes || {};
  if (st.afficherAbroges === undefined) st.afficherAbroges = false;
  return st;
}

function rafraichir() {
  if (!monte) return;
  clear(monte.root);
  monte.root.appendChild(vue(etat(), monte.params));
}

function charger(st) {
  if (st.liste || st.chargement) return;
  st.chargement = true;
  get("/v1/publications", { label: "Recueil public", source: "lecture" })
    .then((r) => {
      st.liste = r.ok ? (bodyOf(r).publications || []) : [];
      st.erreur = r.ok ? null : bodyOf(r).erreur || `Registre indisponible (${r.status}).`;
    })
    .catch((e) => { st.erreur = String((e && e.message) || e); st.liste = []; })
    .finally(() => { st.chargement = false; rafraichir(); });
}

// La clé d'un acte porte un « @ » : on la range sous une clé préfixée pour ne
// jamais confondre « acte non chargé » et « acte en cours de chargement ».
//
// Une lecture qui ÉCHOUE se distingue d'un acte qui n'existe pas : un service
// momentanément indisponible (délai dépassé, canal fermé) ne veut pas dire que
// l'acte est introuvable, et l'écran doit pouvoir le RÉESSAYER au lieu de
// condamner la page. Voir `acte()`.
function chargerActe(st, cle) {
  if (!cle || st.actes["#" + cle]) return;
  st.actes["#" + cle] = { chargement: true };
  get("/v1/publications/" + encodeURIComponent(cle), { label: "Acte publié", source: "lecture" })
    .then((r) => { st.actes["#" + cle] = r.ok ? r.body : { erreur: (r.body && r.body.erreur) || `Acte introuvable (${r.status}).`, transitoire: r.status !== 404 }; })
    .catch((e) => { st.actes["#" + cle] = { erreur: String((e && e.message) || e), transitoire: true }; })
    .finally(() => rafraichir());
}

// Relire un acte après un échec : la lecture était peut-être seulement prématurée
// (le service n'était pas encore là), et rien ne justifie de laisser la page sur
// une erreur qu'un second essai dissiperait.
function relireActe(st, cle) {
  if (!cle) return;
  delete st.actes["#" + cle];
  chargerActe(st, cle);
  rafraichir();
}

// ------------------------------------------------------------------ métadonnées
// Ce qu'un moteur de recherche ou un agent lit d'une page qu'il n'exécute pas :
// le titre, la description, l'adresse canonique, les représentations disponibles
// et les données structurées (JSON-LD). Ces balises portent `data-recueil` :
// l'application les retire en quittant le recueil (voir `retirerMetaRecueil`),
// pour rendre à l'atelier son propre titre.

const MARQUE_META = "data-recueil";
let titreOrigine = null;

function retirerBalises() {
  for (const el of document.querySelectorAll("[" + MARQUE_META + "]")) el.remove();
}

// Quitte le recueil : l'atelier reprend son titre et ses métadonnées. Appelée
// dès que la route n'est plus publique (voir src/ui/app.js).
export function retirerMetaRecueil() {
  retirerBalises();
  if (document.documentElement.hasAttribute("data-recueil-titre")) {
    if (titreOrigine !== null) document.title = titreOrigine;
    document.documentElement.removeAttribute("data-recueil-titre");
  }
}

function poserTitre(t) {
  if (titreOrigine === null) titreOrigine = document.title;
  document.title = t;
  document.documentElement.setAttribute("data-recueil-titre", "");
}

const poserMeta = (attrs) => document.head.appendChild(h("meta", { ...attrs, [MARQUE_META]: "" }));
const poserLien = (attrs) => document.head.appendChild(h("link", { ...attrs, [MARQUE_META]: "" }));

function publierMeta(st, cle) {
  const rec = cle ? st.actes["#" + cle] : null;
  // Tant que l'acte n'est pas connu, on n'annonce rien : une page ne se décrit
  // qu'une fois qu'elle sait ce qu'elle montre.
  if (cle && (!rec || rec.chargement)) return;
  retirerBalises();
  if (!cle) { listeMeta(st); return; }
  if (rec && !rec.erreur) { acteMeta(rec); return; }
  // Acte introuvable : il n'y a rien à annoncer, et surtout rien à indexer.
  poserTitre("Acte introuvable — recueil");
  poserMeta({ name: "robots", content: "noindex" });
}

function listeMeta(st) {
  const brand = state.config?.brand || {};
  const settings = publicationSettings(state.config);
  // Ce que le recueil MONTRE par défaut : la version la plus récente de chaque
  // acte. Le décompte des métadonnées suit la même règle que la liste.
  const enVigueur = publicationsEnVigueur(st.liste || []);
  const total = enVigueur.length;
  const themes = parTheme(enVigueur, themeDePublication)
    .map((g) => (g.id ? themeLabel(g.id, state.config?.families) : null)).filter(Boolean);
  poserTitre([settings.recueil, brand.name].filter(Boolean).join(" — "));
  poserMeta({ name: "description", content: `Recueil des actes publiés${brand.name ? " de " + brand.name : ""} : ${total} acte${total > 1 ? "s" : ""} consultable${total > 1 ? "s" : ""}, classés par thème${themes.length ? " (" + themes.slice(0, 6).join(", ") + ")" : ""}, avec leur identifiant ELI et leur texte.` });
  poserLien({ rel: "canonical", href: adresseRecueil() });
  // Les fichiers du recueil entier n'existent que là où un serveur les sert.
  if (autoHeberge()) {
    poserLien({ rel: "alternate", type: "application/json", href: adresseFichier("recueil.json") });
    poserLien({ rel: "alternate", type: "text/plain", href: adresseFichier("llms.txt") });
  }
}

function acteMeta(rec) {
  const settings = publicationSettings(state.config);
  const titre = [rec.objet || rec.numero || "Acte", settings.recueil].filter(Boolean).join(" — ");
  const desc = [
    rec.entityName,
    natureLabel(rec.nature),
    rec.numero ? "n° " + rec.numero : "",
    rec.objet,
    rec.datePublication ? "publié le " + formatDate(rec.datePublication) : "",
  ].filter(Boolean).join(" — ");
  poserTitre(titre);
  poserMeta({ name: "description", content: desc });
  poserMeta({ property: "og:type", content: "article" });
  poserMeta({ property: "og:title", content: titre });
  poserMeta({ property: "og:description", content: desc });
  poserMeta({ property: "og:url", content: adresseActe(rec.cle) });
  poserLien({ rel: "canonical", href: adresseActe(rec.cle) });
  // Chaque représentation est annoncée : un agent sait ainsi ce qu'il peut
  // demander, à quelle adresse, et dans quel type.
  for (const f of FORMATS_OUVERTS) poserLien({ rel: "alternate", type: f.type, href: urlFormat(rec.cle, f.ext) });
  const jsonld = rec.formats && rec.formats.jsonld;
  if (!jsonld) return;
  try { JSON.parse(jsonld); } catch (e) { return; }
  const s = document.createElement("script");
  s.type = "application/ld+json";
  s.setAttribute(MARQUE_META, "");
  s.textContent = jsonld;
  document.head.appendChild(s);
}

// ------------------------------------------------------------------ la vue

function vue(st, params) {
  // Les actes publiés connus du recueil : c'est par eux que se résolvent les
  // liens écrits sous forme d'identifiant ELI, dans les documents publiés.
  setListePublications(st.liste);
  // Un acte demandé PAR SON IDENTIFIANT ELI (« ?eli=… ») : c'est une adresse de
  // l'instance, et elle doit ouvrir l'acte. Le recueil traduit l'identifiant en
  // celui de l'acte et poursuit normalement — la page, elle, prend l'adresse de
  // l'acte : le lien ELI a tenu sa promesse, et l'adresse montrée reste celle
  // qu'on cite (voir src/lib/recueil.js, `adresseEli`).
  const demande = String(params.eli || "").trim();
  if (demande && estEliUri(demande) && !params.id) {
    const cible = publicationParEli(st.liste, demande);
    if (cible) {
      params.id = encodeURIComponent(cible.cle);
      params.eli = "";
      majUrlRecherche({ acte: cible.cle });
    } else if (st.erreur) {
      // Le registre n'a pas pu être lu : on ne peut rien dire de l'identifiant.
      return h("div", { class: "recueil" }, entete(), h("main", { class: "recueil-main", id: "recueil-contenu", tabindex: "-1" },
        h("div", { class: "recueil-vide" },
          h("h2", { text: "Le recueil est momentanément indisponible" }),
          h("p", { text: st.erreur }),
          button("Réessayer", { variant: "primary", onClick: () => { st.liste = null; st.erreur = null; st.chargement = false; charger(st); rafraichir(); } }))), pied(st));
    } else if (!st.liste) {
      // La liste n'est pas encore là : on ne déclare rien. Le chargement la
      // fera venir, et la page se redessinera (voir `charger`).
      return h("div", { class: "recueil" }, entete(), h("main", { class: "recueil-main", id: "recueil-contenu", tabindex: "-1" },
        h("p", { class: "recueil-vide", text: "Recherche de l'acte…" })), pied(st));
    } else {
      return h("div", { class: "recueil" }, entete(), h("main", { class: "recueil-main", id: "recueil-contenu", tabindex: "-1" },
        h("div", { class: "recueil-vide" },
          h("h2", { text: "Aucun acte ne porte cet identifiant" }),
          h("p", { text: `Le recueil ne connaît pas « ${demande} ». L'acte est peut-être publié sous un autre identifiant, ou pas encore publié.` }),
          h("a", { class: "recueil-lien", href: hrefRecueil() }, "Retour au recueil"))), pied(st));
    }
  }
  const cle = params.id ? decodeURIComponent(params.id) : "";
  if (cle) chargerActe(st, cle);
  publierMeta(st, cle);
  // Une représentation demandée (`&format=md`, `&format=json`…) se sert comme un
  // document : sans notice, sans navigation, sans pied de page — le texte seul,
  // tel qu'un agent qui a suivi l'adresse le lit.
  if (cle && FORMATS_OUVERTS.some((f) => f.ext === params.format)) return representation(st, cle, params.format);
  return h("div", { class: "recueil" + (cle ? " recueil--acte" : "") },
    // Le recueil est public, mais s'il montre des données de démonstration, il
    // le dit : le bandeau marque l'installation, pas l'acte. Le lien « Réglage »
    // n'apparaît qu'à un administrateur connecté ; un visiteur ne voit que la
    // mention.
    demoNotice(can("referentiel.gerer")
      ? button("Réglage", { variant: "tertiary", size: "sm", onClick: () => navigate("referentiel") })
      : null),
    entete(),
    cle ? acte(st, cle) : accueil(st),
    pied(st));
}

// La représentation d'un acte, telle qu'un agent la lit : le document brut dans
// un `<pre>`. Le JSON porte les métadonnées et le texte ; le Markdown la
// structure ; l'Akoma Ntoso le document normé.
function representation(st, cle, format) {
  const f = FORMATS_OUVERTS.find((x) => x.ext === format);
  const rec = st.actes["#" + cle];
  const box = h("div", { class: "recueil-machine" });
  const contenu = !rec || rec.chargement ? "Chargement…"
    : rec.erreur ? "Acte introuvable."
    : format === "json" ? JSON.stringify(jsonDePublication(rec, state.config), null, 2)
    : format === "md" ? markdownDePublication(rec)
    : format === "txt" ? texteDePublication(rec)
    : (rec.formats && rec.formats.akn) || "";
  box.appendChild(h("pre", { class: "recueil-machine__contenu", text: contenu }));
  if (rec && !rec.chargement && !rec.erreur) {
    box.appendChild(h("p", { class: "recueil-machine__note" },
      h("a", { class: "recueil-lien", href: hrefActe(cle), text: "Voir l'acte dans le recueil" }),
      h("span", { text: " — " + f.label + " · " + f.hint })));
  }
  return box;
}

// Les liens internes du recueil portent l'adresse qu'un robot suivrait
// (« ?acte=<clé> », « ?eli=<identifiant> ») — mais dans la page, on les suit sans
// recharger : le recueil est rendu par l'application, et un rechargement ferait
// perdre au lecteur sa recherche et son défilement. On intercepte donc les liens
// qui ne visent que la page elle-même, et on laisse faire tout le reste (nouvel
// onglet, clic modifié, adresses absolues).
//
// Les adresses d'acte sont reconnues depuis N'IMPORTE QUEL écran : un acte
// publié se cite aussi depuis l'atelier (« Publications (ELI) »), et le clic doit
// mener au recueil — c'est l'adresse publique, la seule que l'on puisse citer.
document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
  if (!a) return;
  const url = new URL(a.getAttribute("href"), location.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname) return;
  const acte = url.searchParams.get("acte");
  const eli = url.searchParams.get("eli");
  if (acte) {
    e.preventDefault();
    const f = url.searchParams.get("format");
    navigate("recueil/" + encodeURIComponent(acte), f ? { format: f } : {});
  } else if (eli) {
    e.preventDefault();
    navigate("recueil", { eli });
  } else if (url.searchParams.has("recueil")) {
    e.preventDefault();
    navigate("recueil");
  }
});

// L'entrée de l'application, depuis l'espace public. Le recueil étant
// l'interface publique de l'installation — celle que voit un visiteur qui n'a
// pas de compte —, la porte est ici : un visiteur y trouve **« Se connecter »**
// (comptes de l'application ou annuaire, selon le référentiel), un agent
// connecté **« Retour à l'application »**, et un visiteur authentifié sans rôle
// **« Mon accès »** — qui mène à l'écran expliquant qu'il n'a pas d'accès (voir
// src/ui/views/sans-acces.js).
function porteApplication() {
  const aller = (e) => { e.preventDefault(); navigate("trames"); };
  const u = state.user;
  if (!u) return h("a", { class: "recueil-out recueil-out--entree", href: "#/trames", on: { click: aller } },
    icon("lock", 14), h("span", { text: "Se connecter" }));
  if (estVisiteur(u)) return h("a", { class: "recueil-out", href: "#/trames", on: { click: aller } },
    icon("info", 14), h("span", { text: "Mon accès" }));
  return h("a", { class: "recueil-out", href: "#/trames", on: { click: aller } },
    icon("grid", 14), h("span", { text: "Retour à l'application" }));
}

// L'identité du recueil : la structure qui publie, et le titre du recueil. Le
// logiciel, lui, ne se nomme pas ici.
function entete() {
  const brand = state.config?.brand || {};
  const settings = publicationSettings(state.config);
  const marque = brand.logoUrl
    ? h("img", { class: "recueil-ident__logo", src: brand.logoUrl, alt: "" })
    : h("span", { class: "recueil-ident__logo recueil-ident__logo--mark", text: (brand.shortName || brand.name || "?").slice(0, 3).toUpperCase() });
  return h("header", { class: "recueil-header" },
    // Le lien d'évitement est le PREMIER élément focusable de la page : au
    // clavier, la première tabulation l'atteint et mène droit au contenu, sans
    // traverser l'en-tête et ses liens (RGAA 12.7).
    h("a", { class: "recueil-evitement", href: "#recueil-contenu", text: "Aller au contenu" }),
    h("div", { class: "recueil-header__in" },
      h("a", { class: "recueil-ident", href: hrefRecueil(), title: "Accueil du recueil" },
        marque,
        h("span", { class: "recueil-ident__text" },
          h("span", { class: "recueil-ident__org", text: brand.name || "" }),
          h("span", { class: "recueil-ident__title", text: settings.recueil }))),
      h("nav", { class: "recueil-header__out", "aria-label": "Navigation principale du recueil" }, porteApplication())));
}

// ------------------------------------------------------------------ accueil
// La page d'accueil du recueil. Trois étages, dans l'ordre où un visiteur les
// parcourt :
//
//   1. l'ENTRÉE — où l'on est, ce que l'on peut trouver, et la recherche ;
//   2. les DERNIERS ACTES PUBLIÉS — un carrousel : la matière vivante du recueil,
//      et non un registre ;
//   3. les THÈMES — chaque acte relève d'une matière (urbanisme, police,
//      finances…), et c'est par elle qu'on y accède le plus naturellement.
//
// La liste complète, groupée par année, ferme la page. Les actes gardent leur
// place dans un recueil : c'est la porte d'entrée qui change.
//
// DÈS QU'UNE RECHERCHE EST POSÉE, les étages de PARCOURS s'effacent : le
// carrousel des derniers actes et la grille des thèmes ne répondent pas à une
// recherche, et les laisser au-dessus des résultats obligerait le lecteur à les
// franchir pour lire ce qu'il a demandé. Il ne reste alors que la recherche et
// ses résultats, et « Effacer les filtres » ramène la page d'accueil telle
// qu'elle était. `peindreResultats` pose la même règle au fil de la frappe — la
// page n'est pas redessinée, seuls les résultats le sont.
let sectionCarrousel = null;
let sectionThemes = null;

function accueil(st) {
  const main = h("main", { class: "recueil-main", id: "recueil-contenu", tabindex: "-1" });
  sectionCarrousel = null;
  sectionThemes = null;
  if (st.chargement) { main.appendChild(h("p", { class: "recueil-vide", text: "Chargement du recueil…" })); return main; }
  if (st.erreur) {
    main.appendChild(h("div", { class: "recueil-vide" },
      h("h2", { text: "Le recueil est momentanément indisponible" }),
      h("p", { text: st.erreur }),
      button("Réessayer", { variant: "primary", onClick: () => { st.liste = null; st.erreur = null; rafraichir(); } })));
    return main;
  }
  const tous = st.liste || [];
  if (!tous.length) {
    main.appendChild(h("div", { class: "recueil-vide" },
      h("h2", { text: "Aucun acte publié pour l'instant" }),
      h("p", { text: "Les actes apparaissent ici dès qu'ils sont publiés au recueil, avec leur identifiant ELI et leur texte." })));
    return main;
  }
  main.appendChild(hero(st));
  const une = aLaUne(st);
  if (une) main.appendChild(une);
  const car = carrousel(st);
  if (car) { car.hidden = filtreActif(st); sectionCarrousel = car; main.appendChild(car); }
  const themes = themesZone(st);
  if (themes) { themes.hidden = filtreActif(st); sectionThemes = themes; main.appendChild(themes); }
  main.appendChild(zoneResultats(st, corpus(st).length));
  return main;
}

// Ce que le recueil présente : par défaut la version la PLUS RÉCENTE de chaque
// acte publié — un acte ne se lit et ne se compte qu'une fois. Les versions
// antérieures restent consultables (bloc « Versions » de la fiche de l'acte), et
// la case « Afficher les versions antérieures » les fait rentrer dans la liste et
// dans ses compteurs.
function corpus(st) {
  const tous = st.liste || [];
  return st.afficherAnterieures ? tous : publicationsEnVigueur(tous);
}

// ---------------------------------------------------------------- l'entrée

function hero(st) {
  const brand = state.config?.brand || {};
  const settings = publicationSettings(state.config);
  const tous = st.liste || [];
  const enVigueur = publicationsEnVigueur(tous);
  const themes = parTheme(tous, themeDePublication);
  const derniere = enVigueur.map((p) => String(p.datePublication || "")).filter(Boolean).sort().pop() || "";
  const stats = [
    enVigueur.length + (enVigueur.length > 1 ? " actes publiés" : " acte publié"),
    themes.length + (themes.length > 1 ? " thèmes" : " thème"),
    derniere ? "dernière publication le " + formatDate(derniere) : "",
  ].filter(Boolean).join(" · ");
  return h("section", { class: "recueil-hero" },
    brand.name ? h("p", { class: "recueil-hero__eyebrow", text: brand.name }) : null,
    h("h1", { class: "recueil-hero__title", text: settings.recueil }),
    h("p", { class: "recueil-hero__lead", text: "Retrouvez ici les arrêtés, délibérations, décisions et règlements publiés"
      + (brand.name ? " par " + brand.name : "")
      + " : cherchez un acte, ou laissez-vous guider par thème. Chaque acte se lit en ligne, avec son identifiant ELI." }),
    recherche(st),
    h("p", { class: "recueil-hero__stats", text: stats }));
}

// La recherche, posée dans l'entrée. La frappe ne redessine que la liste des
// résultats : le champ garde le focus et le curseur.
function recherche(st) {
  const champ = h("input", {
    class: "recueil-input", type: "search", "aria-label": "Rechercher dans le recueil",
    placeholder: "Rechercher un acte : numéro, objet, organisation, thème…", value: st.criteres.q,
  });
  const croix = h("button", { class: "recueil-recherche__x", type: "button", title: "Effacer la recherche", hidden: !st.criteres.q, onClick: () => { st.criteres.q = ""; champ.value = ""; croix.hidden = true; peindreResultats(st); } }, "×");
  champ.addEventListener("input", () => { st.criteres.q = champ.value; croix.hidden = !champ.value; peindreResultats(st); });
  return h("div", { class: "recueil-recherche recueil-recherche--hero" }, icon("search", 19), champ, croix);
}

// ---------------------------------------------------------------- à la une
// Les actes ÉPINGLÉS — ceux que l'administration a mis en avant depuis l'onglet
// « Actes » (voir views/actes.js). Ils ouvrent la page, dans leur propre bande :
// c'est là qu'on trouve le règlement intérieur, la charte, le document qu'on
// vient chercher, et non un acte parmi les derniers publiés.
//
// La bande s'efface dès qu'une recherche ou un filtre est posé : le lecteur est
// alors dans ses résultats, et une mise en avant n'y répond pas. Comme le
// carrousel, elle ne montre que les actes EN VIGUEUR.
let bandeUne = null;

function aLaUne(st) {
  bandeUne = null;
  const epingles = publicationsEpinglees(st.liste || []);
  if (!epingles.length) return null;
  const piste = h("ul", { class: "recueil-carrousel__piste recueil-carrousel__piste--une", "aria-label": "Actes mis en avant par l'administration" });
  for (const p of epingles) piste.appendChild(carte(p, true));
  bandeUne = h("section", { class: "recueil-section recueil-une", hidden: filtreActif(st) },
    h("div", { class: "recueil-section__tete" },
      h("div", { class: "recueil-section__titres" },
        h("h2", { class: "recueil-section__title", text: "À la une" }),
        h("p", { class: "recueil-section__sous", text: "Les actes que l'administration met en avant." }))),
    piste);
  return bandeUne;
}

// ---------------------------------------------------------- les derniers actes
// Un carrousel : la piste défile au doigt, à la molette ou par les flèches, et
// les points disent où l'on est. Le défilement est NATIF (`scroll-snap`) : sans
// JavaScript, la piste reste utilisable ; les flèches ne sont qu'un confort. On
// n'y montre que les actes EN VIGUEUR : un acte ne se présente qu'une fois — et
// pas deux fois sur la même page, puisque les actes épinglés ont leur bande
// au-dessus.
function carrousel(st) {
  const epingles = new Set(publicationsEpinglees(st.liste || []).map((p) => p.cle));
  const derniers = dernieresPublications((st.liste || []).filter((p) => !epingles.has(p.cle)), 8);
  if (!derniers.length) return null;
  const piste = h("ul", { class: "recueil-carrousel__piste", tabindex: "0", "aria-label": "Derniers actes administratifs publiés" });
  for (const p of derniers) piste.appendChild(carte(p));
  const prec = fleche(piste, -1, "left", "Actes précédents");
  const suiv = fleche(piste, 1, "right", "Actes suivants");
  const points = h("div", { class: "recueil-carrousel__points" });
  const pas = () => {
    const c = piste.querySelector(".recueil-carte");
    if (!c || !piste.clientWidth) return 0;
    const ecart = parseFloat(getComputedStyle(piste).columnGap || "12") || 12;
    return c.getBoundingClientRect().width + ecart;
  };
  const maj = () => {
    const p = pas();
    if (!p) return;
    const max = piste.scrollWidth - piste.clientWidth - 2;
    prec.disabled = piste.scrollLeft <= 2;
    suiv.disabled = piste.scrollLeft >= max;
    const actif = Math.round(piste.scrollLeft / p);
    [...points.children].forEach((d, i) => {
      d.classList.toggle("is-on", i === actif);
      if (i === actif) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
    });
  };
  derniers.forEach((p, i) => points.appendChild(h("button", {
    class: "recueil-carrousel__point", type: "button",
    "aria-label": "Aller à l'acte " + (i + 1) + (p.objet ? " : " + p.objet : ""),
    onClick: () => { const q = pas(); if (q) piste.scrollTo({ left: i * q, behavior: "smooth" }); },
  })));
  piste.addEventListener("scroll", maj, { passive: true });
  // La mesure demande que la piste soit posée dans la page : on la fait au
  // premier rafraîchissement d'affichage.
  requestAnimationFrame(maj);
  return h("section", { class: "recueil-section recueil-carrousel", "aria-roledescription": "carrousel" },
    h("div", { class: "recueil-section__tete" },
      h("h2", { class: "recueil-section__title", text: "Derniers actes administratifs publiés" }),
      h("div", { class: "recueil-carrousel__nav" }, prec, points, suiv)),
    piste);
}

function fleche(piste, sens, icone, label) {
  return h("button", {
    class: "recueil-carrousel__fleche", type: "button", "aria-label": label,
    onClick: () => {
      const c = piste.querySelector(".recueil-carte");
      const ecart = parseFloat(getComputedStyle(piste).columnGap || "12") || 12;
      const largeur = (c ? c.getBoundingClientRect().width : piste.clientWidth) + ecart;
      piste.scrollBy({ left: sens * largeur, behavior: "smooth" });
    },
  }, icon(icone, 18));
}

function carte(p, une = false) {
  const id = themeDePublication(p);
  const el = h("li", { class: "recueil-carte" + (une ? " recueil-carte--une" : "") },
    h("a", { class: "recueil-carte__lien", href: hrefActe(p.cle) },
      // Le repère de la mise en avant : le lecteur comprend pourquoi cet acte
      // ouvre la page, et le retrouve tel quel dans la liste.
      une ? h("span", { class: "recueil-carte__epingle", text: "À la une" }) : null,
      h("span", { class: "recueil-carte__theme" + (id ? "" : " is-sans"),
        text: themeLabelDePublication(p) || "Sans thème" }),
      h("span", { class: "recueil-carte__objet", text: p.objet || p.numero || "Acte" }),
      h("span", { class: "recueil-carte__meta", text: [p.numero, p.entityName].filter(Boolean).join(" · ") }),
      h("span", { class: "recueil-carte__date", text: p.datePublication ? "publié le " + formatDate(p.datePublication) : "" })));
  if (id) el.style.setProperty("--h", String(hueDe(id)));
  return el;
}

// ---------------------------------------------------------------- les thèmes
// Chaque acte publié relève d'une matière — la famille de sa trame. Les thèmes
// se présentent en grille, avec leur présentation (Administration › Familles) et le
// nombre d'actes ; un clic restreint la liste à ce thème.

function themesZone(st) {
  const groupes = parTheme(corpus(st), themeDePublication);
  if (!groupes.length) return null;
  const grille = h("ul", { class: "recueil-themes__grille" });
  for (const g of groupes) {
    const actif = String(st.criteres.theme || "") === g.id;
    const tuile = h("button", {
      class: "recueil-theme" + (actif ? " is-on" : "") + (g.id === SANS_THEME ? " is-sans" : ""),
      type: "button", "data-theme": g.id, "aria-pressed": actif ? "true" : "false",
      onClick: () => choisirTheme(st, g.id),
    },
      h("span", { class: "recueil-theme__puce" }),
      h("span", { class: "recueil-theme__corps" },
        h("span", { class: "recueil-theme__nom", text: libelleTheme(g.id) }),
        h("span", { class: "recueil-theme__desc", text: presentationTheme(g.id) })),
      h("span", { class: "recueil-theme__n", text: g.count + (g.count > 1 ? " actes" : " acte") }));
    if (g.id !== SANS_THEME) tuile.style.setProperty("--h", String(hueDe(g.id)));
    grille.appendChild(h("li", {}, tuile));
  }
  return h("section", { class: "recueil-section recueil-themes" },
    h("div", { class: "recueil-section__tete" },
      h("div", { class: "recueil-section__titres" },
        h("h2", { class: "recueil-section__title", text: "Parcourir par thème" }),
        h("p", { class: "recueil-section__sous", text: "Les actes sont classés par matière : choisissez un thème pour voir ses actes." }))),
    grille);
}

const libelleTheme = (id) => (id === SANS_THEME ? "Autres actes" : themeLabel(id, state.config?.families));
const presentationTheme = (id) => (id === SANS_THEME
  ? "Actes publiés avant le classement par thème."
  : themeDescription(id, state.config?.families));

function choisirTheme(st, id) {
  // Re-cliquer le thème actif le retire : le geste se défait comme il s'est fait.
  st.criteres.theme = String(st.criteres.theme || "") === id ? "" : id;
  peindreResultats(st);
  // Un thème n'est pas un filtre technique : on amène le lecteur à ses actes.
  const cible = monte && monte.root.querySelector(".recueil-resultats");
  if (cible) cible.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Un teinte stable par thème : la même famille garde la même couleur d'un bout à
// l'autre du recueil. Elle n'est qu'un repère visuel — le libellé, lui, suffit.
function hueDe(id) {
  const s = String(id || "");
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 3600;
  return n % 360;
}

// ------------------------------------------------------- résultats et filtres

function zoneResultats(st, total) {
  const base = corpus(st);
  const resultats = filtrerPublications(base, st.criteres, themeDePublication);
  const zone = h("div", { class: "recueil-resultats" });
  zone.appendChild(sommaire(st, total, resultats.length));
  zone.appendChild(filtres(st, base));
  zone.appendChild(liste(resultats));
  // Au bout des résultats — quand le lecteur a cherché ou filtré, ou que sa
  // recherche ne donne rien —, on lui dit où chercher ailleurs. Sur la liste
  // complète, non filtrée, le bas de page s'en charge déjà (voir `pied`) : le
  // bloc n'est pas répété deux fois sur la même page.
  if (filtreActif(st) || !resultats.length) {
    const ailleurs = blocAilleurs("resultats");
    if (ailleurs) zone.appendChild(ailleurs);
  }
  return zone;
}

const filtreActif = (st) => !!(st.criteres.q || st.criteres.nature || st.criteres.annee || st.criteres.entity || st.criteres.theme);

function sommaire(st, total, affiches) {
  const filtre = filtreActif(st);
  return h("div", { class: "recueil-section__tete recueil-resultats__tete" },
    h("div", { class: "recueil-section__titres" },
      h("h2", { class: "recueil-section__title", text: filtre ? "Résultats de votre recherche" : "Tous les actes publiés" }),
      h("p", { class: "recueil-section__sous", text: filtre
        ? `${affiches} acte${affiches > 1 ? "s" : ""} sur ${total}`
        : `${total} acte${total > 1 ? "s" : ""} publié${total > 1 ? "s" : ""}, du plus récent au plus ancien` })),
    filtre ? h("button", { class: "recueil-lien", type: "button", onClick: () => { st.criteres = { q: "", nature: "", annee: "", entity: "", theme: "" }; rafraichir(); } }, "Effacer les filtres") : null);
}

function liste(resultats) {
  const box = h("div", { class: "recueil-listes" });
  if (!resultats.length) {
    box.appendChild(h("p", { class: "recueil-vide", text: "Aucun acte ne correspond à votre recherche." }));
    return box;
  }
  for (const groupe of parAnnee(resultats)) {
    const section = h("section", { class: "recueil-annee" },
      h("h3", { class: "recueil-annee__title", text: groupe.annee }));
    const items = h("ul", { class: "recueil-actes" });
    for (const p of groupe.items) items.appendChild(item(p));
    section.appendChild(items);
    box.appendChild(section);
  }
  return box;
}

function item(p) {
  const theme = themeLabelDePublication(p);
  return h("li", { class: "recueil-item" },
    h("a", { class: "recueil-item__lien", href: hrefActe(p.cle) },
      h("span", { class: "recueil-item__haut" },
        p.epingle ? h("span", { class: "recueil-item__epingle", text: "À la une" }) : null,
        theme ? h("span", { class: "recueil-item__theme", text: theme }) : null,
        h("span", { class: "recueil-item__nature", text: natureLabel(p.nature) }),
        h("span", { class: "recueil-item__num", text: p.numero || "" }),
        p.latest === false ? h("span", { class: "recueil-item__marque", text: "version antérieure" }) : null),
      h("span", { class: "recueil-item__objet", text: p.objet || p.title || "" }),
      h("span", { class: "recueil-item__bas" },
        h("span", { class: "recueil-item__entite", text: p.entityName || "" }),
        h("span", { class: "recueil-item__date", text: "publié le " + formatDate(p.datePublication) }))));
}

// ------------------------------------------------------------------ un acte

function acte(st, cle) {
  const main = h("main", { class: "recueil-main", id: "recueil-contenu", tabindex: "-1" });
  const courant = (st.liste || []).find((p) => p.cle === cle) || null;
  main.appendChild(fil(courant));
  const rec = st.actes["#" + cle];
  if (!rec || rec.chargement) { main.appendChild(h("p", { class: "recueil-vide", text: "Chargement de l'acte…" })); return main; }
  if (rec.erreur) {
    // Une panne passagère n'est pas un acte introuvable : on le dit, et on offre
    // de réessayer (le service peut n'avoir pas encore répondu).
    main.appendChild(h("div", { class: "recueil-vide" },
      h("h2", { text: rec.transitoire ? "Le recueil est momentanément indisponible" : "Acte introuvable" }),
      h("p", { text: rec.erreur }),
      rec.transitoire
        ? h("div", { class: "recueil-vide__actions" },
          button("Réessayer", { variant: "primary", onClick: () => relireActe(st, cle) }),
          h("a", { class: "recueil-lien", href: hrefRecueil() }, "Retour au recueil"))
        : h("a", { class: "recueil-lien", href: hrefRecueil() }, "Retour au recueil")));
    return main;
  }

  const { notice, texte } = corpsDeLActe(rec);
  // Les articles abrogés que la version en ligne conserve : le lecteur peut les
  // afficher d'un clic (leur rédaction est barrée, comme une pièce d'archive).
  // Tant qu'il ne le demande pas, il ne lit que le texte en vigueur.
  const nbAbroges = texte.querySelectorAll(".doc-abroge-corps").length;
  texte.classList.toggle("afficher-abroges", !!st.afficherAbroges && nbAbroges > 0);
  const article = h("article", { class: "recueil-article" },
    notice,
    nbAbroges ? basculeAbroges(st, texte, nbAbroges) : null,
    h("div", { class: "recueil-lecture" }, texte),
    blocOriginal(rec),
    blocPieces(rec),
    blocSignature(rec),
    blocDonneesPubliques(rec));
  if (rec.versions && rec.versions.length > 1) article.appendChild(blocVersions(rec, { href: hrefActe }));
  main.appendChild(article);
  return main;
}

// La case « Afficher les articles abrogés » : elle appartient à la lecture — on
// bascule la classe sur le bloc de texte, sans redessiner la page (le lecteur
// garde sa position).
function basculeAbroges(st, texte, nb) {
  const input = h("input", { type: "checkbox", checked: !!st.afficherAbroges });
  input.addEventListener("change", () => {
    st.afficherAbroges = input.checked;
    texte.classList.toggle("afficher-abroges", input.checked);
  });
  return h("label", { class: "recueil-abroges" },
    input,
    h("span", { text: nb > 1 ? `Afficher les ${nb} articles abrogés` : "Afficher l'article abrogé" }));
}

function fil(courant) {
  return h("nav", { class: "recueil-fil", "aria-label": "Fil d'Ariane" },
    h("a", { href: hrefRecueil() }, "Recueil des actes"),
    h("span", { class: "recueil-fil__sep", text: "›" }),
    h("span", { text: courant ? [courant.numero, courant.nature ? natureLabel(courant.nature) : ""].filter(Boolean).join(" · ") : "Acte" }));
}

// ------------------------------------------------------------------ filtres

// Les filtres fins, sous la liste : le thème, la nature, l'année, l'organisation.
// Le thème est aussi offert, plus haut, sous forme de tuiles : c'est le même état,
// vu de deux endroits.
function filtres(st, base) {
  const f = facettes(base || corpus(st), themeDePublication);
  const theme = selecteur("Thème", f.themes.filter((x) => x !== SANS_THEME), st.criteres.theme, (v) => { st.criteres.theme = v; peindreResultats(st); }, libelleTheme);
  const nature = selecteur("Nature", f.natures, st.criteres.nature, (v) => { st.criteres.nature = v; peindreResultats(st); }, natureLabel);
  const annee = selecteur("Année", f.annees, st.criteres.annee, (v) => { st.criteres.annee = v; peindreResultats(st); }, (x) => x);
  const entity = f.entities.length > 1
    ? selecteur("Organisation", f.entities, st.criteres.entity, (v) => { st.criteres.entity = v; peindreResultats(st); }, (x) => x)
    : null;
  return h("div", { class: "recueil-filtres" },
    h("span", { class: "recueil-filtres__label", text: "Filtrer :" }), theme, nature, annee, entity,
    versionsAnterieures(st));
}

// La case des versions antérieures : elle ne s'affiche que si le recueil en
// détient (un acte modifié ou consolidé en produit). Elle ne paraît pas dans le
// filtre ordinaire — quelques rares actes, pas une facette.
function versionsAnterieures(st) {
  if (!(st.liste || []).some((p) => p.latest === false)) return null;
  const input = h("input", { type: "checkbox", checked: !!st.afficherAnterieures });
  input.addEventListener("change", () => { st.afficherAnterieures = input.checked; rafraichir(); });
  return h("label", { class: "recueil-anciennes", title: "Les versions antérieures ne comptent pas deux fois : le recueil présente chaque acte dans sa rédaction en vigueur." },
    input, h("span", { text: "Afficher les versions antérieures" }));
}

function selecteur(label, valeurs, valeur, onChange, labeler) {
  const sel = h("select", { class: "recueil-select", "aria-label": label });
  sel.appendChild(h("option", { value: "", text: label + " : tous" }));
  for (const v of valeurs) sel.appendChild(h("option", { value: v, text: labeler ? labeler(v) : v, selected: String(v) === String(valeur || "") }));
  sel.addEventListener("change", () => onChange(sel.value));
  return sel;
}

// Redessine la zone des résultats (liste), sans toucher au reste de la page — et
// remet les tuiles de thème au diapason : elles montrent le même état.
function peindreResultats(st) {
  if (!monte) return;
  const ancien = monte.root.querySelector(".recueil-resultats");
  if (!ancien) { rafraichir(); return; }
  ancien.replaceWith(zoneResultats(st, corpus(st).length));
  for (const t of monte.root.querySelectorAll(".recueil-theme")) {
    const on = String(st.criteres.theme || "") === t.dataset.theme;
    t.classList.toggle("is-on", on);
    t.setAttribute("aria-pressed", on ? "true" : "false");
  }
  // La mise en avant n'a pas sa place au milieu d'une recherche : elle s'efface
  // dès qu'un filtre est posé (voir `aLaUne`).
  if (bandeUne) bandeUne.hidden = filtreActif(st);
  // Les étages de PARCOURS suivent la même règle : le carrousel et les thèmes
  // s'effacent dès qu'une recherche est posée, pour laisser les résultats seuls
  // sous l'entrée (voir `accueil`).
  if (sectionCarrousel) sectionCarrousel.hidden = filtreActif(st);
  if (sectionThemes) sectionThemes.hidden = filtreActif(st);
  // Le renvoi du bas de page suit la même règle : quand le lecteur est dans une
  // recherche, il l'a sous les yeux au bout de ses résultats — on l'efface donc
  // du pied de page, pour ne pas le montrer deux fois.
  const ailleursPied = monte.root.querySelector(".recueil-pied .recueil-ailleurs");
  if (ailleursPied) ailleursPied.hidden = filtreActif(st);
}

// -------------------------------------------------- recueils extérieurs
// « Vous ne trouvez pas ce que vous recherchez ? » — le renvoi du recueil vers
// les recueils qu'il ne gère pas (un recueil « bis », des recueils inactifs avec
// leur période) et vers les sites de référence (Légifrance, service-public.gouv.fr).
//
// Les renvois sont des données du référentiel (`config.publication.recueilsExternes`,
// Administration › Publication) : c'est l'administration qui les écrit, les
// ordonne et les retire. Le bloc se montre à DEUX endroits — en bas de page de
// l'espace public, et au bout des résultats de recherche (voir `zoneResultats`
// et `pied`) —, mais jamais deux fois sur la même page.
function blocAilleurs(variante) {
  const liste = recueilsExternes(state.config);
  if (!liste.length) return null;
  const recueils = liste.filter((r) => r.type !== "ressource");
  const ressources = liste.filter((r) => r.type === "ressource");
  return h("section", { class: "recueil-ailleurs" + (variante === "resultats" ? " recueil-ailleurs--resultats" : "") },
    h("h2", { class: "recueil-ailleurs__titre", text: "Vous ne trouvez pas ce que vous recherchez ?" }),
    h("p", { class: "recueil-ailleurs__lead", text: "Les actes que vous cherchez figurent peut-être dans un autre recueil, ou sur un site de référence." }),
    recueils.length ? groupeAilleurs("Autres recueils", recueils) : null,
    ressources.length ? groupeAilleurs("Sites de référence", ressources) : null);
}

function groupeAilleurs(titre, liste) {
  const ul = h("ul", { class: "recueil-ailleurs__liste" });
  for (const r of liste) ul.appendChild(itemAilleurs(r));
  return h("div", { class: "recueil-ailleurs__groupe" },
    h("h3", { class: "recueil-ailleurs__groupe-titre", text: titre }),
    ul);
}

function itemAilleurs(r) {
  const url = urlRecueilExterne(r);
  const periode = periodeRecueil(r);
  return h("li", { class: "recueil-ailleurs__item" + (r.type === "inactif" ? " is-inactif" : "") },
    h("a", { class: "recueil-ailleurs__lien", href: url, target: "_blank", rel: "noopener noreferrer", title: url },
      h("span", { class: "recueil-ailleurs__nom", text: r.label || url }),
      icon("globe", 14)),
    h("span", { class: "recueil-ailleurs__tags" },
      h("span", { class: "recueil-ailleurs__type recueil-ailleurs__type--" + (r.type || "bis"), text: recueilExterneTypeLabel(r.type) }),
      periode ? h("span", { class: "recueil-ailleurs__periode", text: periode }) : null),
    r.note ? h("span", { class: "recueil-ailleurs__note", text: r.note }) : null);
}

// ------------------------------------------------------------------ pied

// Les MENTIONS du pied de page : les mentions légales — qui rappellent à quelles
// conditions un acte publié ici est exécutoire et opposable — et les mentions
// d'accessibilité. Elles viennent du référentiel (`config.publication.mentions`,
// voir src/lib/recueil.js, `mentionsPubliques`) : l'administration écrit le
// texte, le remplace par un simple lien (les mentions du site principal de la
// collectivité, par exemple) ou l'éteint. Le texte se replie sous son titre
// (`<details>`) : présent dans la page — donc trouvable et lisible par un agent
// comme par un moteur —, il ne noie pas le pied de page sous plusieurs écrans de
// lecture. Un lien, lui, s'affiche tel quel.
function blocMentions() {
  const mentions = mentionsPubliques(state.config);
  if (!mentions.length) return null;
  const section = h("section", { class: "recueil-pied__mentions" });
  for (const m of mentions) {
    if (m.mode === "lien") {
      section.appendChild(h("p", { class: "recueil-pied__mention-lien" },
        h("a", { class: "recueil-lien", href: m.url, target: "_blank", rel: "noopener noreferrer", title: m.url, text: m.lienLabel })));
      continue;
    }
    const corps = h("div", { class: "recueil-mention__texte" });
    for (const b of blocsMention(m.texte)) {
      if (b.type === "ul") {
        const ul = h("ul", { class: "recueil-mention__liste" });
        for (const it of b.items) ul.appendChild(h("li", { text: it }));
        corps.appendChild(ul);
      } else {
        corps.appendChild(h("p", { text: b.texte }));
      }
    }
    section.appendChild(h("details", { class: "recueil-mention" },
      h("summary", { class: "recueil-mention__titre", text: m.titre }),
      corps));
  }
  return section;
}

function pied(st) {
  const brand = state.config?.brand || {};
  // Le renvoi vers les autres recueils vit ici, en bas de page — mais il
  // s'efface quand le lecteur est dans une recherche : il l'a alors trouvé au
  // bout de ses résultats (voir `zoneResultats`), et le bloc ne se répète pas.
  // L'effacement se fait par l'attribut `hidden`, que `peindreResultats` met à
  // jour au fil de la frappe — le pied de page n'étant pas redessiné.
  const ailleurs = blocAilleurs();
  if (ailleurs) ailleurs.hidden = filtreActif(st);
  return h("footer", { class: "recueil-pied" },
    ailleurs,
    h("p", { class: "recueil-pied__ligne", text: [brand.name, brand.supportName].filter(Boolean).join(" — ") }),
    h("p", { class: "recueil-pied__note", text: "Seul l'original signé fait foi ; le texte diffusé ici est donné à titre informatif." }),
    // La licence de réutilisation, en clair et sans dépliage : sa publicité est
    // une obligation (CRPA art. L. 322-1), elle ne doit pas se chercher.
    (() => {
      const lic = licenceReutilisation(state.config);
      return h("p", { class: "recueil-pied__licence" },
        h("span", { text: "Réutilisation : " }),
        lic.url
          ? h("a", { class: "recueil-lien", href: lic.url, target: "_blank", rel: "noopener noreferrer", title: lic.nom, text: lic.nom })
          : h("span", { text: lic.nom }),
        h("span", { text: " — " + lic.mention }));
    })(),
    // Le recueil ouvert, annoncé à ceux qui consultent les données : les fichiers
    // que le service sert aux moteurs et aux agents. Ils n'existent que là où un
    // serveur les sert (voir src/server/mysql/actes.mjs).
    autoHeberge() ? h("p", { class: "recueil-pied__ouvert" },
      h("span", { text: "Recueil ouvert : " }),
      ...FICHIERS_OUVERTS.flatMap((f, i) => [
        i ? h("span", { class: "recueil-pied__sep", text: " · " }) : null,
        h("a", { class: "recueil-lien", href: adresseFichier(f.nom), title: f.hint, text: f.nom }),
      ])) : null,
    // Les mentions viennent en DERNIER : c'est là qu'un lecteur les cherche, et
    // c'est là qu'un site public les met.
    blocMentions());
}
