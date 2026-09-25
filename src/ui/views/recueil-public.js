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
import { state, can, navigate, majUrlRecherche, majUrlPublique } from "../state.js";
import { h, clear, button, icon } from "../dom.js";
import { estVisiteur } from "../../lib/users.js";
import { brandLogoUrl } from "../../lib/theme.js";
import { demoNotice } from "../notice.js";
import { chatErreurEl } from "../chats-erreur.js";
import { mentionAffichee, contenuMention } from "../mention.js";
import { renderMarkdown } from "../markdown.js";
import { agentsAvecActesReserves } from "../../lib/atelier-acces.js";
import { informationsOrdonnees, informationParSlug, resumeInfo, minutesDeLecture }
  from "../../lib/informations.js";
import { publicationsLocales, publicationLocale, informationsLocales }
  from "../../lib/publications-locales.js";
import { amorcerRecueil, amorcageEnCours } from "../demo-publications.js";
import { isLocalMode } from "../../lib/db/index.js";
import { get, post, bodyOf, errorMessage } from "../../lib/remote.js";
import { publicationSettings } from "../../lib/eli.js";
import { formatDate } from "../../lib/util.js";
import * as bs from "../../lib/bulletins-service.js";
import { adresseBulletins, adresseBulletin, adresseBulletinFichier, adresseFluxBulletin, hrefBulletinFichier, hrefFluxBulletin } from "../../lib/bulletins.js";
import { texteDeBulletin, markdownDeBulletin, jsonDeBulletin, fluxDeBulletins } from "../../lib/bulletins-formats.js";
import { filtrerPublications, facettes, parAnnee, parTheme, dernieresPublications, publicationsEnVigueur, publicationsEpinglees,
  SANS_THEME, themeLabel, themeDescription,
  hrefRecueil, hrefActe, adresseRecueil, adresseActe,
  adresseFichier, urlFormat, FORMATS_OUVERTS, FICHIERS_OUVERTS, autoHeberge, basePublique,
  estEliUri, publicationParEli,
  hrefPage, hrefInfo, adressePage, adresseInfo, pagePublique, PAGES_PUBLIQUES,
  cssPersonnalisee, mentionPublique, informationsReglages as reglagesInformations,
  texteDePublication, markdownDePublication, jsonDePublication,
  recueilsExternes, recueilExterneTypeLabel, urlRecueilExterne, periodeRecueil,
  blocsMention } from "../../lib/recueil.js";
import { licenceReutilisation } from "../../lib/recueil.js";
import { corpsDeLActe, setListePublications, natureLabel, themeDePublication, themeLabelDePublication, blocOriginal, blocPieces, blocSignature, blocVersions, blocDonneesPubliques, blocMentionReprise } from "./acte-publie.js";

export function renderRecueilPublic(root, params) {
  monte = { root, params: params || {} };
  const st = etat();
  charger(st);
  chargerInformations(st);
  chargerBulletins(st);
  // L'espace public est à la RACINE (1.5.3) : l'adresse de la page le dit. On la
  // remet d'aplomb ici — le drapeau d'atelier qu'on a pu suivre, et l'ancien
  // « ?recueil=1 », n'y ont pas leur place.
  majUrlPublique();
  // La feuille de la collectivité s'applique AVANT que la page soit dessinée :
  // le lecteur ne doit pas voir la charte par défaut clignoter.
  poserCssPersonnalisee();
  root.appendChild(vue(st, monte.params));
}

// ------------------------------------------------------------------ état

let monte = null;

function etat() {
  const st = (state.recueil = state.recueil || {});
  if (st.liste === undefined) st.liste = null;
  // Les informations publiées : leur propre chargement, leur propre erreur. Elles
  // n'empêchent ni n'attendent le recueil des actes — un recueil sans billet
  // reste un recueil.
  if (st.infos === undefined) st.infos = null;
  st.chargement = !!st.chargement;
  st.criteres = st.criteres || { q: "", nature: "", annee: "", entity: "", theme: "" };
  if (st.criteres.theme === undefined) st.criteres.theme = "";
  st.actes = st.actes || {};
  // Le BULLETIN : l'état public du service (voir `chargerBulletins`), et les
  // numéros lus à leur adresse. `st.bulletins` reste `undefined` tant qu'on n'a
  // rien demandé — c'est la distinction qui évite de redemander à chaque
  // redessin.
  st.bulletinsActes = st.bulletinsActes || {};
  if (st.afficherAbroges === undefined) st.afficherAbroges = false;
  return st;
}

// Le recueil se redessine pour lui-même à trois occasions : une lecture qui
// aboutit, une invalidation venue de l'ATELIER (un dépôt de démonstration, un
// réglage du bulletin), et les gestes du lecteur (un filtre, une recherche).
// Les trois passent par ici.
//
// DEUX RÈGLES, et l'une comme l'autre vient d'un défaut constaté en
// démonstration.
//
//  • Le recueil ne se redessine que s'il est l'ÉCRAN AFFICHÉ. Une lecture lancée
//    au montage peut aboutir après que le lecteur a quitté la page publique —
//    pour l'atelier, par exemple. Le recueil se réécrivait alors PAR-DESSUS
//    l'écran où l'on était : l'atelier disparaissait sans qu'on ait rien
//    demandé, et l'on retombait sur le recueil. La route dit ce qui est
//    affiché : on n'écrit que si elle porte encore le recueil.
//
//  • Le redessin RÉARME les lectures. Invalider l'état (« les informations sont
//    à relire ») ne suffisait pas : rien ne relançait la lecture, et la rubrique
//    des informations — invalidée après un dépôt — ne revenait plus jamais, ni
//    sur la page d'accueil, ni dans le pied de page. Les trois lectures sont
//    idempotentes : chacune sort d'elle-même quand la donnée est là ou qu'une
//    lecture est en vol. Les réarmer ici rend le recueil capable de se réparer,
//    quel que soit l'ordre des événements.
function rafraichir() {
  if (!monte) return;
  if (!ecranPublic()) return;
  const st = etat();
  charger(st);
  chargerInformations(st);
  chargerBulletins(st);
  clear(monte.root);
  monte.root.appendChild(vue(st, monte.params));
}

// Le recueil est-il l'écran affiché ? La route par défaut EST le recueil
// (1.5.3), et une route illisible y ramène aussi (voir `normaliserRoute`,
// src/ui/app.js) : c'est le même critère que celui qui commande l'affichage.
const ecranPublic = () => String((state.route && state.route.view) || "recueil") === "recueil";

// Redessiner le recueil depuis l'EXTÉRIEUR : l'atelier l'invalide après un dépôt
// ou un réglage. `redrawView` est le redessin de l'atelier — il ne fait rien
// quand l'écran public est affiché —, si bien que l'application enregistre
// celui-ci comme redessin de l'écran public (voir `renderRootMaintenant`,
// src/ui/app.js).
export const redessinerRecueilPublic = () => rafraichir();

// Le recueil montre TOUT ce qui est publié : ce que le service rend, et, à
// défaut, ce que le poste détient. Le service reste la source ; mais un service
// remis à zéro, un aperçu qui reconstruit son état, une page hors ligne ne
// doivent pas faire disparaître du recueil des actes réellement publiés — les
// enregistrements rendus à la publication sont gardés sur leurs actes (voir
// src/lib/publications-locales.js), et on les relit ici.
function charger(st) {
  if (st.liste || st.chargement) return;
  st.chargement = true;
  get("/v1/publications", { label: "Recueil public", source: "lecture" })
    .then((r) => {
      const duService = r.ok ? (bodyOf(r).publications || []) : [];
      st.liste = fusionnerPublications(duService);
      st.erreur = st.liste.length || r.ok ? null : bodyOf(r).erreur || `Registre indisponible (${r.status}).`;
    })
    .catch((e) => {
      const locales = publicationsLocales(registreLocal(), { reserveVue: voitReserve() });
      st.liste = locales;
      st.erreur = locales.length ? null : String((e && e.message) || e);
    })
    .finally(() => { st.chargement = false; rafraichir(); });
}

// Ce que le LECTEUR a le droit de voir : un acte à diffusion restreinte n'est
// montré qu'à un agent connecté venu d'un réseau autorisé. C'est la règle du
// service ; le repli local doit appliquer la même, sans quoi il divulguerait
// une circulaire interne que le service, lui, cache.
const voitReserve = () => !!(state.user && agentsAvecActesReserves(true));

// LE REGISTRE LOCAL, pour le repli et la fusion : les actes du registre ET les
// reprises d'actes anciens (voir src/lib/reprise.js). Une reprise publiée est une
// publication du recueil comme une autre : elle doit apparaître même quand le
// service ne répond pas — un poste qui la détient la montre.
const registreLocal = () => [...(state.actes || []), ...(state.reprises || [])];

// La fusion : les publications du service d'abord, puis celles que le poste
// détient et que le service ne rend pas encore. On écarte celles dont
// l'identifiant ELI est déjà servi — le recueil ne présente qu'une version par
// identifiant (`corpus`), et deux enregistrements de la même version
// l'afficheraient deux fois.
function fusionnerPublications(duService) {
  const locales = publicationsLocales(registreLocal(), { reserveVue: voitReserve() });
  if (!locales.length) return duService;
  const cles = new Set(duService.map((p) => String(p.cle || "")));
  const elis = new Set(duService.map((p) => String(p.eliUri || "")).filter(Boolean));
  const ajout = locales.filter((p) => !cles.has(String(p.cle)) && !(p.eliUri && elis.has(String(p.eliUri))));
  if (!ajout.length) return duService;
  return [...duService, ...ajout]
    .sort((a, b) => String(b.publieeLe || b.datePublication || "").localeCompare(String(a.publieeLe || a.datePublication || "")));
}

// Les INFORMATIONS : le service les sert comme le recueil — une seule porte
// publique (« /v1/informations »), qui ne rend que les billets publiés. Un
// service muet ou une version qui ne les sert pas encore laisse la liste VIDE
// plutôt qu'en erreur : le recueil ne s'arrête pas parce qu'il n'a pas de
// nouvelles à donner (voir la note 1.5.3).
// Une lecture peut en remplacer une autre : l'état est invalidé (les
// informations sont à relire) alors qu'une lecture est encore en vol, et la
// réponse de l'ancienne arriverait APRÈS celle de la nouvelle — en écrasant la
// bonne. Chaque lecture reçoit donc son rang, et seule la plus récente écrit.
let rangInfos = 0;

function chargerInformations(st) {
  if (st.infos !== null || st.chargementInfos) return;
  st.chargementInfos = true;
  const rang = (rangInfos += 1);
  const poser = (duService) => { if (rang === rangInfos) st.infos = fusionnerInformations(duService); };
  get("/v1/informations", { label: "Informations publiées", source: "lecture" })
    .then((r) => poser(r.ok ? (bodyOf(r).informations || []) : []))
    .catch(() => poser([]))
    .finally(() => { if (rang === rangInfos) { st.chargementInfos = false; rafraichir(); } });
}

// Les billets publiés : ceux du service, et — en régime LOCAL — ceux de
// l'atelier, qui ne lui ont pas encore été déposés. Le régime local est le seul
// où l'atelier et le recueil peuvent diverger : en régime « service », la
// collection du service EST la base de l'atelier, et c'est elle qui fait foi.
// Fusionner là serait nuisible : un billet dépublié au service ressurgirait du
// poste, et le recueil montrerait ce que l'atelier vient de retirer.
function fusionnerInformations(duService) {
  if (!isLocalMode()) return duService;
  const locales = informationsLocales(state.informations);
  if (!locales.length) return duService;
  const connues = new Set(duService.map((i) => String(i.id)));
  return [...duService, ...locales.filter((i) => !connues.has(String(i.id)))];
}

// ---------------------------------------------------------------- le Bulletin
// Le BULLETIN (ou Journal) des actes est une SOUS-PAGE de l'espace public, comme
// les mentions légales : le recueil rassemblé par période, une adresse par
// numéro. Le service le compose et le sert (page, flux, abonnement — voir
// src/server/mysql/bulletins.mjs) ; ici, on le PRÉSENTE, et on laisse le lecteur
// s'abonner.
//
// Rien n'est calculé : la cadence, la prochaine parution et les numéros parus
// viennent de `GET /v1/bulletins` (voir src/lib/bulletins-service.js). Un service
// qui ne connaît pas la route — mode local, aperçu hors ligne, version
// antérieure — laisse la sous-page ABSENTE, et le pied de page cesse de
// l'annoncer : on ne promet pas une page qu'on ne peut pas servir.
//
// `st.bulletins` suit trois états, et la distinction compte :
//   undefined  on n'a pas encore demandé ;
//   null       on a demandé, et il n'y a pas de bulletin à montrer ;
//   objet      l'état public du bulletin.
function chargerBulletins(st) {
  if (st.bulletins !== undefined || st.chargementBulletins) return;
  st.chargementBulletins = true;
  bs.chargerPublic({ silencieux: true })
    .catch(() => null)
    .finally(() => {
      st.chargementBulletins = false;
      st.bulletins = bs.etat.publicEtat || null;
      rafraichir();
    });
}

// Les numéros d'un bulletin : leur liste, telle que l'état public la donne. Le
// bulletin est « ouvert » quand le service le dit (`actif`), et un numéro
// PROVISOIRE (la période en cours) n'a pas d'adresse publique — il ne se suit
// donc pas, et ne se montre pas dans la liste des numéros parus.
const bulletinOuvert = (st) => !!(st.bulletins && st.bulletins.actif === true);
const numerosParus = (st) => ((st.bulletins && st.bulletins.bulletins) || []).filter((b) => !b.provisoire);

// Un numéro, demandé à son adresse. Le même cache que les actes : la clé porte
// un « # » pour ne jamais confondre « pas encore demandé » et « en cours de
// chargement ».
function chargerBulletin(st, id) {
  const k = "#" + id;
  const cur = st.bulletinsActes[k];
  if (cur && (cur.chargement || cur.rec || cur.erreur)) return;
  st.bulletinsActes[k] = { chargement: true };
  get("/v1/bulletins/" + encodeURIComponent(id), { label: "Bulletin " + id, source: "lecture" })
    .then((r) => {
      st.bulletinsActes[k] = r.ok
        ? { rec: bodyOf(r) }
        : { erreur: errorMessage(r) || ("Bulletin indisponible (" + r.status + ").") };
    })
    .catch((e) => { st.bulletinsActes[k] = { erreur: String((e && e.message) || e) }; })
    .finally(() => rafraichir());
}

// La page des bulletins parus : la cadence, la prochaine parution, le formulaire
// d'abonnement, et les numéros du plus récent au plus ancien.
function pageBulletinsVue(st) {
  if (st.bulletins === undefined) {
    return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
      h("p", { class: "recueil-vide", text: "Chargement du bulletin…" }));
  }
  if (!bulletinOuvert(st)) {
    metaSousPage("Bulletin introuvable", "");
    return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
      filSousPage("Bulletin"),
      h("div", { class: "recueil-vide" },
        h("h1", { text: "Le bulletin n'est pas publié ici" }),
        h("p", { text: "Cette collectivité n'a pas ouvert de bulletin des actes. Le recueil, lui, reste consultable." }),
        h("a", { class: "recueil-lien", href: hrefRecueil() }, "Retour au recueil"),
        chatErreurEl(404, { legende: "Bulletin introuvable" })));
  }
  const etatB = st.bulletins;
  const nums = numerosParus(st);
  metaSousPage(etatB.titre, etatB.sousTitre || "Les actes administratifs publiés, rassemblés par période.", adresseBulletins());
  const tete = h("header", { class: "recueil-souspage__tete" },
    h("h1", { class: "recueil-souspage__titre", text: etatB.titre }),
    etatB.sousTitre ? h("p", { class: "recueil-souspage__chapo", text: etatB.sousTitre }) : null,
    h("p", { class: "recueil-bulletins__cadence", text: [etatB.cadence ? "Parution " + (etatB.cadence.resume || etatB.cadence.label) : "",
      etatB.prochaine ? "prochain numéro : " + etatB.prochaine.libelle + (etatB.prochaine.parution ? ", le " + formatDate(etatB.prochaine.parution) : "") : ""].filter(Boolean).join(" · ") }),
    h("p", { class: "recueil-bulletins__liens" },
      h("a", { class: "recueil-lien", href: hrefFluxBulletin("rss") }, "Flux RSS"),
      h("span", { text: " · " }),
      h("a", { class: "recueil-lien", href: hrefFluxBulletin("atom") }, "Atom")));
  return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
    filSousPage(etatB.titre),
    tete,
    formulaireAbonnement(etatB),
    h("h2", { class: "recueil-souspage__titre", style: { fontSize: "1.1rem" }, text: "Numéros parus" }),
    nums.length
      ? h("ul", { class: "recueil-bulletins__liste" }, ...nums.map((b) => itemNumero(b)))
      : h("p", { class: "recueil-vide", text: "Aucun numéro n'est encore paru. Le premier paraîtra à la clôture de la période en cours, s'il y a des actes publiés." }));
}

function itemNumero(b) {
  return h("li", { class: "recueil-bulletins__item" },
    h("a", { class: "recueil-bulletins__titre", href: hrefBulletinDuNumero(b.id), text: b.titre }),
    h("span", { class: "recueil-bulletins__meta", text: [b.debut && b.fin ? "du " + formatDate(b.debut) + " au " + formatDate(b.fin) : "", b.nombre + (b.nombre > 1 ? " actes" : " acte")].filter(Boolean).join(" · ") }),
    h("span", { class: "recueil-bulletins__formats" },
      ["json", "md", "txt"].map((x, i) => h("span", {}, i ? " " : "", h("a", { class: "recueil-lien", href: hrefBulletinFichier(b.id, x), text: "." + x })))));
}

// L'adresse de suivi d'un numéro, DANS la page : la sous-page de l'espace public.
// `adresseBulletin` est l'adresse qu'on cite (absolue) ; c'est celle-ci qui se
// suit, comme pour un acte.
const hrefBulletinDuNumero = (id) => (autoHeberge()
  ? "/recueil/bulletins/" + encodeURIComponent(id)
  : location.pathname + "?bulletin=" + encodeURIComponent(id));

// Le formulaire d'abonnement. Double consentement : la demande part, un courriel
// de confirmation suit, et l'abonnement ne prend effet qu'une fois son lien
// ouvert — l'écran le dit, pour qu'on ne s'étonne pas de ne rien recevoir.
function formulaireAbonnement(etatB) {
  if (!etatB.abonnement) {
    return h("section", { class: "recueil-abon" },
      h("h2", { class: "recueil-abon__titre", text: "Recevoir le bulletin" }),
      h("p", { class: "recueil-abon__aide", text: etatB.motifAbonnement || "L'abonnement par courriel n'est pas ouvert sur ce recueil." }));
  }
  const courriel = h("input", { class: "fr-input", type: "email", required: true, autocomplete: "email", placeholder: "prenom.nom@exemple.fr", "aria-label": "Votre adresse électronique" });
  const nom = h("input", { class: "fr-input", type: "text", autocomplete: "name", placeholder: "Votre nom (facultatif)", "aria-label": "Votre nom" });
  const message = h("p", { class: "recueil-abon__message fr-small", hidden: true });
  const form = h("form", { class: "recueil-abon__form" },
    h("label", { class: "recueil-abon__label", text: "Votre adresse électronique" }), courriel,
    h("label", { class: "recueil-abon__label", text: "Votre nom (facultatif)" }), nom,
    h("div", {}, button("Demander l'abonnement", { variant: "primary", type: "submit" })),
    message);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    message.hidden = false;
    clear(message);
    message.appendChild(h("span", { class: "spinner", "aria-hidden": "true" }));
    message.appendChild(h("span", { text: " Envoi de la demande…" }));
    try {
      const r = await post("/v1/bulletins/abonnement", { courriel: courriel.value.trim(), nom: nom.value.trim() }, { label: "Abonnement au bulletin", source: "application" });
      const corps = bodyOf(r);
      clear(message);
      message.appendChild(h("span", { text: (r.ok ? (corps.message || "Demande enregistrée.") : (corps.erreur || "La demande n'a pas pu être enregistrée.")) }));
      if (r.ok) { courriel.value = ""; nom.value = ""; }
    } catch (err) {
      clear(message);
      message.appendChild(h("span", { text: String((err && err.message) || err) }));
    }
  });
  return h("section", { class: "recueil-abon" },
    h("h2", { class: "recueil-abon__titre", text: "Recevoir le bulletin" }),
    h("p", { class: "recueil-abon__aide", text: "L'abonnement est gratuit. Chaque numéro vous est adressé le jour de sa parution, et vous pouvez vous désabonner d'un seul clic, depuis n'importe quel message. Un courriel de confirmation vous sera adressé : l'abonnement ne prend effet qu'une fois son lien ouvert." }),
    form);
}

// La page d'UN numéro : ses entités, leurs thématiques, leurs actes.
function bulletinVue(st, id) {
  const k = "#" + id;
  const cur = st.bulletinsActes[k];
  if (!cur || cur.chargement) {
    return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
      h("p", { class: "recueil-vide", text: "Chargement du bulletin…" }));
  }
  if (cur.erreur) {
    metaSousPage("Bulletin introuvable", "");
    return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
      filSousPage("Bulletin introuvable"),
      h("div", { class: "recueil-vide" },
        h("h1", { text: "Ce bulletin n'est pas disponible" }),
        h("p", { text: cur.erreur }),
        h("a", { class: "recueil-lien", href: hrefPage("bulletins") }, "Tous les bulletins"),
        chatErreurEl(404, { legende: "Bulletin introuvable" })));
  }
  const b = cur.rec;
  // Un numéro PROVISOIRE (la période en cours) n'a pas d'adresse publique : il ne
  // vit qu'au tableau de bord, où l'administration le relit avant parution. Le
  // service le refuse (« bulletin_provisoire ») ; la page le dit de même.
  if (b.provisoire) {
    metaSousPage("Bulletin non paru", "");
    return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
      filSousPage("Bulletin non paru"),
      h("div", { class: "recueil-vide" },
        h("h1", { text: "Ce numéro n'est pas encore paru" }),
        h("p", { text: "Il couvre la période en cours : il deviendra définitif à sa clôture, s'il y a des actes publiés dedans." }),
        h("a", { class: "recueil-lien", href: hrefPage("bulletins") }, "Tous les bulletins")));
  }
  metaSousPage(b.titre, b.sousTitre || (b.debut + " — " + b.nombre + " acte(s)"), adresseBulletin(b.id));
  const tete = h("header", { class: "recueil-souspage__tete" },
    h("h1", { class: "recueil-souspage__titre", text: b.titre }),
    h("p", { class: "recueil-souspage__chapo", text: [b.debut && b.fin ? "du " + formatDate(b.debut) + " au " + formatDate(b.fin) : "", b.nombre + (b.nombre > 1 ? " actes" : " acte")].filter(Boolean).join(" · ") }),
    b.sousTitre ? h("p", { text: b.sousTitre }) : null,
    h("p", { class: "recueil-bulletins__liens" },
      h("span", { text: "Ce numéro en données : " }),
      ["json", "md", "txt"].map((x, i) => h("span", {}, i ? " " : "", h("a", { class: "recueil-lien", href: hrefBulletinFichier(b.id, x), text: "." + x })))));
  const corps = (b.entites || []).map((e) => {
    const themes = (e.themes || []).map((t) => {
      const actes = (t.actes || []).map((a) => {
        const mentions = [
          a.datePublication ? "publié le " + formatDate(a.datePublication) : "",
          a.juridique === false ? "document non opposable" : a.dateOpposabilite ? "en vigueur le " + formatDate(a.dateOpposabilite) : "",
          a.remplacee ? "version consolidée" : "",
        ].filter(Boolean).join(" · ");
        return h("li", { class: "recueil-bulletin__acte" },
          h("a", { class: "recueil-lien", href: hrefActe(a.cle), text: [a.numero, a.objet].filter(Boolean).join(" — ") || a.cle }),
          mentions ? h("span", { class: "recueil-bulletin__meta", text: mentions }) : null);
      });
      return h("div", { class: "recueil-bulletin__theme" },
        h("h3", { text: t.label }),
        h("ul", { class: "recueil-bulletin__actes" }, ...actes));
    });
    return h("section", { class: "recueil-bulletin__entite" },
      h("h2", { class: "recueil-bulletin__nom", text: e.nom }),
      ...themes);
  });
  return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
    filSousPage(b.titre),
    tete,
    corps.length ? h("div", { class: "recueil-bulletin" }, ...corps) : h("p", { class: "recueil-vide", text: "Aucun acte n'a été publié sur cette période." }),
    h("p", { class: "recueil-bulletins__liens", style: { marginTop: "22px" } },
      h("a", { class: "recueil-lien", href: hrefPage("bulletins") }, "Tous les bulletins"),
      h("span", { text: " · " }),
      h("a", { class: "recueil-lien", href: hrefFluxBulletin("rss") }, "Flux RSS")));
}

// ------------------------------------------------------ les pages « machine »
// Un numéro servi en données (« ?bulletin=<id>&format=md »), et le flux du
// bulletin (« ?bulletins=rss ») : deux adresses qu'un agent ou un lecteur de flux
// suit. Sur un déploiement AUTO-HÉBERGÉ, ce sont des FICHIERS servis par le
// service (/recueil/bulletins/<id>.md, /recueil/bulletins.rss) et ces pages ne
// sont jamais rendues. Ici, la page compose elle-même ce qu'un serveur servirait
// — le texte seul, dans un `<pre>`, comme la représentation d'un acte.
function pageMachine(titre, url, contenu, note) {
  metaSousPage(titre, "", url);
  const box = h("div", { class: "recueil-machine" },
    h("pre", { class: "recueil-machine__contenu", text: contenu }));
  if (note) box.appendChild(h("p", { class: "recueil-machine__note", text: note }));
  return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
    filSousPage(titre), box);
}

const FORMATS_BULLETIN = ["json", "md", "txt"].map((ext) => FORMATS_OUVERTS.find((f) => f.ext === ext)).filter(Boolean);

// Un numéro demandé dans l'un de ses formats. Le service rend, sur un
// déploiement serveur, exactement les mêmes octets.
function bulletinFormatVue(st, id, format) {
  const f = FORMATS_BULLETIN.find((x) => x.ext === format);
  const cur = st.bulletinsActes["#" + id];
  const contenu = !cur || cur.chargement ? "Chargement…"
    : cur.erreur ? "Bulletin introuvable."
    : cur.rec && cur.rec.provisoire ? "Ce numéro n'est pas encore paru : il couvre la période en cours."
    : format === "json" ? jsonDeBulletin(cur.rec)
    : format === "md" ? markdownDeBulletin(cur.rec, { lien: adresseBulletin(id) })
    : texteDeBulletin(cur.rec, { lien: adresseBulletin(id) });
  const note = cur && cur.rec
    ? "Un numéro de bulletin en " + f.label + " — " + f.hint
    : "";
  return pageMachine(cur && cur.rec ? cur.rec.titre + " (" + f.label + ")" : "Bulletin", adresseBulletinFichier(id, format), contenu, note);
}

// Le flux du bulletin : ce que suit un lecteur de flux. Les numéros sont
// demandés au service, du plus récent au plus ancien, et bornés comme sur le
// serveur (20 entrées).
function chargerFlux(st, mode) {
  if (st.flux && (st.flux.mode === mode || st.flux.chargement)) return;
  st.flux = { mode, chargement: true };
  (async () => {
    // `st.recueil.bulletins` est une COPIE, prise au chargement de la page (voir
    // `chargerBulletins`). Le flux, lui, est une adresse machine : il se compose
    // sur l'état LE PLUS FRAIS. Sans cette relecture, un bulletin ouvert pendant
    // la vie de la page — ou un état lu avant que la configuration ne soit
    // déposée — laisserait un flux vide alors que le bulletin existe.
    let publicEtat = st.bulletins;
    if (!publicEtat || publicEtat.actif !== true) {
      publicEtat = (await bs.chargerPublic({ silencieux: true })) || publicEtat || null;
    }
    st.bulletins = publicEtat;
    if (!publicEtat || publicEtat.actif !== true) { st.flux = { mode, contenu: "" }; return; }
    const ids = ((publicEtat.bulletins || []).filter((b) => !b.provisoire)).slice(0, 20).map((b) => b.id);
    const recs = await bs.chargerNumeros(ids);
    st.flux = {
      mode,
      contenu: fluxDeBulletins(recs, {
        titre: (publicEtat && publicEtat.titre) || publicationSettings(state.config).recueil || "",
        sousTitre: (publicEtat && publicEtat.sousTitre) || "",
        base: basePublique(),
        mode,
      }),
    };
  })().catch((e) => { st.flux = { mode, erreur: String((e && e.message) || e) }; })
    .finally(() => rafraichir());
}

function fluxVue(st, mode) {
  const f = st.flux;
  const titre = "Flux " + (mode === "atom" ? "Atom" : "RSS");
  if (st.bulletins === undefined) return pageMachine(titre, adresseFluxBulletin(mode), "Composition du flux…", "");
  // Un bulletin éteint n'a pas de flux du tout : le service répond « 404 » sur
  // son adresse, la page le dit de même (voir src/server/mysql/actes.mjs,
  // `hBulletinFlux`).
  if (!bulletinOuvert(st)) {
    metaSousPage("Flux introuvable", "");
    return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
      filSousPage("Flux du bulletin"),
      h("div", { class: "recueil-vide" },
        h("h1", { text: "Ce recueil n'a pas de bulletin" }),
        h("p", { text: "Cette collectivité n'a pas ouvert de bulletin des actes : il n'y a donc pas de flux à suivre. Le recueil, lui, reste consultable." }),
        h("a", { class: "recueil-lien", href: hrefRecueil() }, "Retour au recueil"),
        chatErreurEl(404, { legende: "Flux introuvable" })));
  }
  if (!f || f.chargement) return pageMachine(titre, adresseFluxBulletin(mode), "Composition du flux…", "");
  if (f.erreur) return pageMachine(titre, adresseFluxBulletin(mode), "Le flux n'a pas pu être composé :\n\n" + f.erreur, "");
  return pageMachine(titre, adresseFluxBulletin(mode), f.contenu,
    "Le flux des numéros parus. Sur un déploiement auto-hébergé, cette adresse est un fichier servi par le service (application/" + mode + "+xml) : c'est celle que l'on donne à un lecteur de flux.");
}

// La rubrique de la page d'accueil : les derniers numéros, quand le bulletin est
// ouvert. Elle s'efface d'elle-même quand il n'y a rien à montrer — pas de
// rubrique vide, pas de promesse en l'air.
function zoneBulletins(st) {
  if (!bulletinOuvert(st)) return null;
  const nums = numerosParus(st).slice(0, 4);
  if (!nums.length) return null;
  return h("section", { class: "recueil-bulletins-zone" },
    h("h2", { text: st.bulletins.titre || "Le bulletin des actes" }),
    h("p", { class: "recueil-bulletins-zone__chapo", text: "Les actes publiés sur une période, rassemblés en un numéro" + (st.bulletins.cadence ? " — " + (st.bulletins.cadence.resume || st.bulletins.cadence.label) : "") + "." }),
    h("ul", { class: "recueil-bulletins__liste" }, ...nums.map((b) => itemNumero(b))),
    h("p", { class: "recueil-bulletins__liens" },
      h("a", { class: "recueil-lien", href: hrefPage("bulletins") }, "Tous les bulletins"),
      h("span", { text: " · " }),
      h("a", { class: "recueil-lien", href: hrefFluxBulletin("rss") }, "Flux RSS")));
}

// La clé d'un acte porte un « @ » : on la range sous une clé préfixée pour ne
// jamais confondre « acte non chargé » et « acte en cours de chargement ».
//
// Une lecture qui ÉCHOUE se distingue d'un acte qui n'existe pas : un service
// momentanément indisponible (délai dépassé, canal fermé) ne veut pas dire que
// l'acte est introuvable, et l'écran doit pouvoir le RÉESSAYER au lieu de
// condamner la page. Voir `acte()`.
// La fiche d'un acte : celle du service, ou — à défaut — l'enregistrement gardé
// sur l'acte par la publication (mêmes pièces : version en ligne, formats,
// original signé). Un service muet ne doit pas rendre « introuvable » un acte
// que le poste détient.
function chargerActe(st, cle) {
  if (!cle || st.actes["#" + cle]) return;
  st.actes["#" + cle] = { chargement: true };
  const locale = publicationLocale(registreLocal(), cle, { reserveVue: voitReserve() });
  get("/v1/publications/" + encodeURIComponent(cle), { label: "Acte publié", source: "lecture" })
    .then((r) => {
      st.actes["#" + cle] = r.ok ? r.body
        : locale || { erreur: (r.body && r.body.erreur) || `Acte introuvable (${r.status}).`, transitoire: r.status !== 404 };
    })
    .catch((e) => {
      st.actes["#" + cle] = locale || { erreur: String((e && e.message) || e), transitoire: true };
    })
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
  const perso = document.getElementById(ID_CSS_PERSO);
  if (perso) perso.remove();
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

// ---------------------------------------- la feuille de la collectivité (CSS)
// La personnalisation du site public (Administration › Publication › Apparence) :
// une feuille libre, injectée APRÈS celle de l'application — elle l'emporte donc
// là où elle parle. Elle porte son propre identifiant, et se retire avec le
// recueil : l'atelier, lui, garde l'apparence du logiciel (voir
// `retirerMetaRecueil`). Le texte vient du référentiel, écrit par un
// administrateur ; il n'est jamais injecté ailleurs que dans un `<style>`.
//
// ELLE SE POSE À LA FIN DU CORPS, et non dans l'en-tête : la feuille de
// l'application est chargée DEUX fois — une fois en ligne par la page (`index.html`
// porte un `<link>` tout en bas), une fois par le module de style — et un
// `<style>` d'en-tête passerait avant le `<link>`, donc perdrait contre lui. La
// conséquence n'est pas théorique : `--recueil-largeur` est déclarée sur
// `.recueil` par la feuille de l'application, et une charte qui la reprend n'aurait
// aucun effet. En fin de corps, la feuille de la collectivité est la DERNIÈRE lue :
// à spécificité égale, elle gagne — ce que la promesse de l'écran suppose.
const ID_CSS_PERSO = "recueil-css-personnalisee";

function poserCssPersonnalisee() {
  const css = cssPersonnalisee(state.config);
  const existant = document.getElementById(ID_CSS_PERSO);
  if (existant && existant.textContent === css) return;
  if (existant) existant.remove();
  if (!css) return;
  const el = document.createElement("style");
  el.id = ID_CSS_PERSO;
  el.textContent = css;
  (document.body || document.head).appendChild(el);
}

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
  // Les SOUS-PAGES de l'espace public (1.5.3) : mentions légales, accessibilité,
  // conditions de réutilisation, et la liste des informations publiées — chacune
  // avec son adresse, comme un acte. Elles viennent APRÈS la traduction des liens
  // ELI (un acte demandé par son identifiant prime) et AVANT la fiche d'un acte :
  // une adresse ne porte qu'une chose.
  const pageId = String(params.page || "").trim();
  if (pageId) return enveloppe(st, pageId === "bulletins" ? pageBulletinsVue(st) : pagePubliqueVue(st, pageId));
  const slug = String(params.info || "").trim();
  if (slug) return enveloppe(st, informationVue(st, slug));
  // LE FLUX DU BULLETIN (« ?bulletins=rss », « ?bulletins=atom ») : l'adresse
  // que suit un lecteur de flux. Elle porte le fil, jamais la page.
  const flux = String(params.bulletins || "").trim();
  if (flux === "rss" || flux === "atom") { chargerFlux(st, flux); return enveloppe(st, fluxVue(st, flux)); }
  // UN NUMÉRO DE BULLETIN, à son adresse : « ?bulletin=<période> ». C'est le
  // pendant de « ?acte=<clé> » — une adresse qui porte une chose, et rien
  // d'autre. En données (« &format=md »), il se sert comme un document : le texte
  // seul, sans notice.
  const num = String(params.bulletin || "").trim();
  if (num) {
    chargerBulletin(st, num);
    const format = FORMATS_BULLETIN.some((f) => f.ext === params.format) ? params.format : "";
    return enveloppe(st, format ? bulletinFormatVue(st, num, format) : bulletinVue(st, num));
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
  const page = url.searchParams.get("page");
  const info = url.searchParams.get("info");
  const bulletin = url.searchParams.get("bulletin");
  const bulletins = url.searchParams.get("bulletins");
  if (acte) {
    e.preventDefault();
    const f = url.searchParams.get("format");
    navigate("recueil/" + encodeURIComponent(acte), f ? { format: f } : {});
  } else if (eli) {
    e.preventDefault();
    navigate("recueil", { eli });
  } else if (page) {
    e.preventDefault();
    navigate("recueil", { page });
  } else if (info) {
    e.preventDefault();
    navigate("recueil", { info });
  } else if (bulletin) {
    // Un NUMÉRO, et sa représentation en données (« &format=md ») : les deux se
    // suivent sans recharger la page.
    e.preventDefault();
    const f = url.searchParams.get("format");
    navigate("recueil", f ? { bulletin, format: f } : { bulletin });
  } else if (bulletins) {
    e.preventDefault();
    navigate("recueil", { bulletins });
  } else if (url.searchParams.has("recueil")) {
    e.preventDefault();
    navigate("recueil");
  }
});

// -------------------------------------------------------- les sous-pages
//
// L'espace public n'est pas qu'une liste d'actes : il porte aussi les textes
// qu'un site public doit porter — mentions légales, accessibilité, conditions de
// réutilisation — et les INFORMATIONS que la collectivité publie. Chacun a son
// adresse (« ?page=… », « ?info=… »), donc son titre, ses métadonnées, son fil
// d'Ariane, et se partage comme une page.
//
// Les sous-pages reprennent l'ossature du recueil (bandeau, en-tête, pied) : on
// ne quitte pas le site, on change de page.

function enveloppe(st, main) {
  return h("div", { class: "recueil recueil--page" },
    demoNotice(can("referentiel.gerer")
      ? button("Réglage", { variant: "tertiary", size: "sm", onClick: () => navigate("referentiel") })
      : null),
    entete(),
    main,
    pied(st));
}

function filSousPage(label) {
  return h("nav", { class: "recueil-fil", "aria-label": "Fil d'Ariane" },
    h("a", { href: hrefRecueil() }, "Recueil des actes"),
    h("span", { class: "recueil-fil__sep", text: "›" }),
    h("span", { text: label }));
}

// Les métadonnées d'une sous-page : elle mérite les mêmes égards qu'un acte —
// un titre, une description, une adresse canonique —, sinon elle se partage mal.
function metaSousPage(titre, description, url) {
  const settings = publicationSettings(state.config);
  retirerBalises();
  poserTitre([titre, settings.recueil].filter(Boolean).join(" — "));
  const desc = description || "";
  if (desc) poserMeta({ name: "description", content: desc });
  poserMeta({ property: "og:type", content: "website" });
  poserMeta({ property: "og:title", content: titre });
  if (desc) poserMeta({ property: "og:description", content: desc });
  if (url) { poserMeta({ property: "og:url", content: url }); poserLien({ rel: "canonical", href: url }); }
}

// Le début d'un texte de mention, en clair : ce qu'un moteur affiche sous le
// titre. On prend le premier paragraphe, on le coupe court.
function resumeDeTexte(texte, max = 200) {
  const b = blocsMention(texte).find((x) => x.type === "p");
  const plat = String((b && b.texte) || "").replace(/\s+/g, " ").trim();
  if (plat.length <= max) return plat;
  const coupe = plat.slice(0, max);
  const espace = coupe.lastIndexOf(" ");
  return (espace > max * 0.6 ? coupe.slice(0, espace) : coupe).replace(/[,;:.]$/, "") + "…";
}

// Les blocs d'un texte de mention, rendus : paragraphes et listes. Le même
// rendu sert au pied de page replié et à la sous-page complète.
function blocsDeMention(texte) {
  return blocsMention(texte).map((b) => {
    if (b.type !== "ul") return h("p", { text: b.texte });
    return h("ul", { class: "recueil-mention__liste" }, ...b.items.map((it) => h("li", { text: it })));
  });
}

function pagePubliqueVue(st, id) {
  const def = pagePublique(id);
  if (!def) {
    metaSousPage("Page introuvable", "");
    return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
      filSousPage("Page introuvable"),
      h("div", { class: "recueil-vide" },
        h("h1", { text: "Cette page n'existe pas" }),
        h("p", { text: "L'adresse ne correspond à aucune page de ce recueil." }),
        h("a", { class: "recueil-lien", href: hrefRecueil() }, "Retour au recueil"),
        chatErreurEl(404, { legende: "Page introuvable" })));
  }
  if (def.id === "informations") return pageInformations(st);
  const m = mentionPublique(state.config, def.mention);
  const titre = m ? m.titre : def.label;
  metaSousPage(titre, m && m.mode === "texte" ? resumeDeTexte(m.texte) : "", adressePage(def.id));
  return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
    filSousPage(titre),
    h("article", { class: "recueil-souspage__texte" },
      h("h1", { class: "recueil-souspage__titre", text: titre }),
      m && m.mode === "lien"
        ? h("p", {}, h("a", { class: "recueil-lien", href: m.url, target: "_blank", rel: "noopener noreferrer", title: m.url, text: m.lienLabel }))
        : null,
      m && m.mode === "texte" ? blocsDeMention(m.texte) : null,
      !m ? h("p", { class: "recueil-vide", text: "Cette page n'est pas publiée pour l'instant." }) : null));
}

// La page des INFORMATIONS : la liste complète, du plus récent au plus ancien,
// les billets épinglés d'abord. Une rubrique de la page d'accueil en montre les
// trois premiers ; c'est ici qu'on les lit tous.
function pageInformations(st) {
  const reglages = reglagesInformations(state.config);
  const titre = reglages.titre;
  metaSousPage(titre, reglages.intro || "Les informations publiées par la collectivité.", adressePage("informations"));
  const tete = h("header", { class: "recueil-souspage__tete" },
    h("h1", { class: "recueil-souspage__titre", text: titre }),
    reglages.intro ? h("p", { class: "recueil-souspage__chapo", text: reglages.intro }) : null);
  return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
    filSousPage(titre),
    tete,
    listeInfos(st, "page"));
}

// La page d'UNE information : son titre, sa date, son auteur, son texte.
function informationVue(st, slug) {
  if (st.infos === null) {
    return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
      h("p", { class: "recueil-vide", text: "Chargement de l'information…" }));
  }
  const info = informationParSlug(st.infos, slug);
  if (!info) {
    metaSousPage("Information introuvable", "");
    return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
      filSousPage("Information introuvable"),
      h("div", { class: "recueil-vide" },
        h("h1", { text: "Cette information n'existe pas" }),
        h("p", { text: "Le billet a peut-être été retiré, ou son adresse a changé : les billets publiés sont accessibles depuis la page des informations." }),
        h("a", { class: "recueil-lien", href: hrefPage("informations") }, "Toutes les informations"),
        chatErreurEl(404, { legende: "Information introuvable" })));
  }
  const reglages = reglagesInformations(state.config);
  const resume = resumeInfo(info, 300);
  metaSousPage(info.titre, resume, adresseInfo(info.slug));
  poserMeta({ property: "og:type", content: "article" });
  return h("main", { class: "recueil-main recueil-souspage", id: "recueil-contenu", tabindex: "-1" },
    filSousPage(reglages.titre),
    h("article", { class: "recueil-info" },
      metaInfo(info),
      h("h1", { class: "recueil-info__titre", text: info.titre }),
      resume ? h("p", { class: "recueil-info__chapo", text: resume }) : null,
      h("div", { class: "md recueil-info__corps" }, renderMarkdown(info.corps)),
      h("p", { class: "recueil-info__retour" },
        h("a", { class: "recueil-lien", href: hrefPage("informations") }, "← Toutes les informations"))));
}

const metaInfo = (info) => h("p", { class: "recueil-info__meta" },
  h("time", { datetime: info.date || info.creeLe || "", text: info.date ? formatDate(info.date) : "" }),
  info.auteur ? h("span", { text: " · " + info.auteur }) : null,
  h("span", { text: " · " + minutesDeLecture(info) + " min de lecture" }));

function listeInfos(st, variante) {
  if (st.infos === null) return h("p", { class: "recueil-vide", text: "Chargement des informations…" });
  const liste = informationsOrdonnees(st.infos);
  if (!liste.length) {
    return h("div", { class: "recueil-vide" },
      h("h2", { text: "Aucune information publiée pour l'instant" }),
      h("p", { text: "Les informations publiées par la collectivité apparaîtront ici." }));
  }
  return h("ul", { class: "recueil-infos__liste recueil-infos__liste--" + variante },
    ...liste.map((i) => carteInfo(i)));
}

function carteInfo(info) {
  return h("li", { class: "recueil-info-carte" + (info.epingle ? " is-epinglee" : "") },
    h("a", { class: "recueil-info-carte__lien", href: hrefInfo(info.slug) },
      info.epingle ? h("span", { class: "recueil-info-carte__epingle", text: "Épinglé" }) : null,
      h("span", { class: "recueil-info-carte__date", text: info.date ? formatDate(info.date) : "" }),
      h("span", { class: "recueil-info-carte__titre", text: info.titre }),
      h("span", { class: "recueil-info-carte__resume", text: resumeInfo(info) }),
      h("span", { class: "recueil-info-carte__pied" },
        info.auteur ? h("span", { text: info.auteur }) : null,
        h("span", { text: minutesDeLecture(info) + " min de lecture" }))));
}

// La rubrique des informations sur la page d'accueil : les billets les plus
// récents (épinglés d'abord), et le renvoi vers la liste complète. Elle
// s'efface dès qu'une recherche est posée, comme les autres étages de parcours.
let sectionInfos = null;

function informationsZone(st) {
  sectionInfos = null;
  const reglages = reglagesInformations(state.config);
  if (!reglages.actif) return null;
  const liste = informationsOrdonnees(st.infos || []);
  if (!liste.length) return null;
  const montrees = liste.slice(0, 3);
  const zone = h("section", { class: "recueil-section recueil-infos", hidden: filtreActif(st) },
    h("div", { class: "recueil-section__tete" },
      h("div", { class: "recueil-section__titres" },
        h("h2", { class: "recueil-section__title", text: reglages.titre }),
        h("p", { class: "recueil-section__sous", text: reglages.intro || "Les nouvelles publiées par la collectivité." })),
      h("a", { class: "recueil-lien", href: hrefPage("informations") }, "Toutes les informations")),
    h("ul", { class: "recueil-infos__liste recueil-infos__liste--accueil" }, ...montrees.map((i) => carteInfo(i))));
  sectionInfos = zone;
  return zone;
}

// L'avis donné à un agent connecté venu d'un réseau autorisé : les actes à
// diffusion restreinte lui sont montrés (c'est le service qui les sert, pas la
// page), et il doit le savoir — sans quoi il croirait que tout le monde les voit.
function noteReserve(st) {
  if (!state.user || !agentsAvecActesReserves(true)) return null;
  const n = (st.liste || []).filter((p) => p.reserve).length;
  if (!n) return null;
  return h("p", { class: "recueil-reserve-note" }, icon("lock", 15),
    h("span", { text: n > 1
      ? `Vous êtes identifié : ${n} actes à diffusion restreinte vous sont affichés ici, signalés « Réservé aux agents ».`
      : "Vous êtes identifié : un acte à diffusion restreinte vous est affiché ici, signalé « Réservé aux agents »." }));
}


// l'interface publique de l'installation — celle que voit un visiteur qui n'a
// pas de compte —, la porte est ici : un visiteur y trouve **« Se connecter »**
// (comptes de l'application ou annuaire, selon le référentiel), un agent
// connecté **« Retour à l'application »**, et un visiteur authentifié sans rôle
// **« Mon accès »** — qui mène à l'écran expliquant qu'il n'a pas d'accès (voir
// src/ui/views/sans-acces.js).
function porteApplication(variante = "entete") {
  const pied = variante === "pied";
  const aller = (e) => { e.preventDefault(); navigate("trames"); };
  const cls = pied ? "recueil-pied__connexion" : "recueil-out recueil-out--entree";
  const t = pied ? 16 : 14;
  const u = state.user;
  if (!u) return h("a", { class: cls, href: "#/trames", on: { click: aller } },
    icon("lock", t), h("span", { text: "Se connecter" }));
  if (estVisiteur(u)) return h("a", { class: cls, href: "#/trames", on: { click: aller } },
    icon("info", t), h("span", { text: "Mon accès" }));
  return h("a", { class: cls, href: "#/trames", on: { click: aller } },
    icon("grid", t), h("span", { text: "Retour à l'application" }));
}

// L'identité du recueil : la structure qui publie, et le titre du recueil. Le
// logiciel, lui, ne se nomme pas ici.
function entete() {
  const brand = state.config?.brand || {};
  const settings = publicationSettings(state.config);
  // L'emblème de la structure qui publie — dans la variante du thème courant :
  // le recueil suit le thème du poste (et celui du système, tant que le choix
  // d'apparence est « Automatique »), donc il se redessine avec lui.
  const logo = brandLogoUrl(brand);
  const marque = logo
    ? h("img", { class: "recueil-ident__logo", src: logo, alt: "" })
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
  sectionInfos = null;
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
    // Aucun acte publié ne veut pas dire aucun site : une collectivité qui n'a
    // pas encore publié d'acte peut déjà publier des informations. On garde
    // alors l'entrée et la rubrique ; sans rien du tout, on le dit simplement.
    const infos = informationsZone(st);
    if (infos) { main.appendChild(hero(st)); main.appendChild(infos); return main; }
    // PREMIER LANCEMENT D'UNE DÉMONSTRATION : elle dépose ses actes et ses
    // billets au service au démarrage, ce qui prend quelques secondes. Annoncer
    // « aucun acte publié » pendant ce temps serait faux — et c'est exactement
    // ce qu'un visiteur voyait. On dit ce qui se passe, et on offre de relancer.
    if (amorcageEnCours()) {
      // La page se redessine d'elle-même : l'amorçage peut s'arrêter sans
      // qu'aucune écriture ne le signale (un service injoignable, par exemple),
      // et une page figée sur « se prépare » serait un mensonge de plus.
      setTimeout(() => { if (monte) rafraichir(); }, 2000);
      main.appendChild(h("div", { class: "recueil-vide" },
        h("h2", {}, h("span", { class: "spinner", "aria-hidden": "true" }), " Le recueil se prépare"),
        h("p", { text: "Cette installation de démonstration dépose ses actes et ses informations au recueil public. Quelques secondes suffisent, et seulement au premier lancement." }),
        h("div", { class: "recueil-vide__actions" },
          button("Réessayer maintenant", { variant: "secondary", onClick: () => amorcerRecueil().catch(() => {}) }))));
      return main;
    }
    main.appendChild(h("div", { class: "recueil-vide" },
      h("h2", { text: "Aucun acte publié pour l'instant" }),
      h("p", { text: "Les actes apparaissent ici dès qu'ils sont publiés au recueil, avec leur identifiant ELI et leur texte." })));
    return main;
  }
  main.appendChild(hero(st));
  // Un agent connecté venu d'un réseau autorisé voit aussi les actes à
  // diffusion restreinte : on le lui dit, en tête de page.
  const note = noteReserve(st);
  if (note) main.appendChild(note);
  // Les informations publiées par l'administration : la vie de la collectivité,
  // au-dessus du registre — c'est ce qu'un visiteur vient chercher d'abord.
  const infos = informationsZone(st);
  if (infos) main.appendChild(infos);
  const une = aLaUne(st);
  if (une) main.appendChild(une);
  const car = carrousel(st);
  if (car) { car.hidden = filtreActif(st); sectionCarrousel = car; main.appendChild(car); }
  const themes = themesZone(st);
  if (themes) { themes.hidden = filtreActif(st); sectionThemes = themes; main.appendChild(themes); }
  // Le BULLETIN, quand il est ouvert : les derniers numéros. C'est la forme sous
  // laquelle beaucoup de collectivités portent leurs actes à la connaissance de
  // tous — une page, un flux, un courriel — et le recueil s'y ouvre.
  const bz = zoneBulletins(st);
  if (bz) { bz.hidden = filtreActif(st); main.appendChild(bz); }
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
    // La phrase se lit quel que soit le nom de la structure (« Ville de… »,
    // « CCAS de… », « Préfecture de… ») : c'est ELLE qui publie ses actes, et
    // l'apposition « publiés par Ville de X » ne se dit pas en français.
    h("p", { class: "recueil-hero__lead", text: brand.name
      ? brand.name + " publie ici ses arrêtés, délibérations, décisions et règlements : cherchez un acte, ou laissez-vous guider par thème. Chaque acte se lit en ligne, avec son identifiant ELI."
      : "Retrouvez ici les arrêtés, délibérations, décisions et règlements publiés par la collectivité : cherchez un acte, ou laissez-vous guider par thème. Chaque acte se lit en ligne, avec son identifiant ELI." }),
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
        // Un acte à DIFFUSION RESTREINTE, vu par un agent connecté : on le
        // signale, pour qu'il ne s'étonne pas de ne pas le trouver ailleurs.
        p.reserve ? h("span", { class: "recueil-item__reserve", text: "Réservé aux agents" }) : null,
        theme ? h("span", { class: "recueil-item__theme", text: theme }) : null,
        h("span", { class: "recueil-item__nature", text: natureLabel(p.nature) }),
        h("span", { class: "recueil-item__num", text: p.numero || "" }),
        // Une REPRISE d'acte ancien se signale dans la liste : sa date ferait
        // croire à un acte fraîchement publié, alors qu'elle n'est là qu'à titre
        // informatif (voir `blocMentionReprise`, le bas de sa page).
        p.reprise === true ? h("span", { class: "recueil-item__reprise", text: "reprise" }) : null,
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
        : h("a", { class: "recueil-lien", href: hrefRecueil() }, "Retour au recueil"),
      // Le code suit la cause : une panne passagère du service (503) n'est pas un
      // acte introuvable (404). Voir src/ui/chats-erreur.js.
      chatErreurEl(rec.transitoire ? 503 : 404)));
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
    blocDonneesPubliques(rec),
    // LA MENTION DE REPRISE ferme la page : le lecteur qui est allé jusqu'au
    // bout y lit que l'acte est publié à titre informatif uniquement.
    blocMentionReprise(rec));
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
    // Une REPRISE n'est pas un acte du registre : son fil le dit, comme la page
    // publiée (voir `buildWebVersion`, src/lib/eli.js), plutôt que de la présenter
    // sous la nature d'un acte ordinaire.
    h("span", { text: courant && courant.reprise === true
      ? ["Reprises d'actes anciens", courant.numero].filter(Boolean).join(" · ")
      : courant ? [courant.numero, courant.nature ? natureLabel(courant.nature) : ""].filter(Boolean).join(" · ") : "Acte" }));
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
  if (sectionInfos) sectionInfos.hidden = filtreActif(st);
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
  const recueils = liste.filter((r) => r.type !== "ressource");
  const ressources = liste.filter((r) => r.type === "ressource");
  // Le bloc porte AUSSI la mention des actes à DIFFUSION RESTREINTE : certaines
  // publications sont réservées aux agents connectés (circulaires internes,
  // consignes de service) et ne figurent donc pas dans ce recueil public. Le
  // lecteur ne peut pas deviner leur existence : la phrase est donc TOUJOURS
  // là, y compris quand aucun recueil extérieur n'est déclaré. Voir
  // src/server/mysql/actes.mjs (`reserve`) et src/lib/eli.js.
  return h("section", { class: "recueil-ailleurs" + (variante === "resultats" ? " recueil-ailleurs--resultats" : "") },
    h("h2", { class: "recueil-ailleurs__titre", text: "Vous ne trouvez pas ce que vous recherchez ?" }),
    h("p", { class: "recueil-ailleurs__lead", text: "Les actes que vous cherchez figurent peut-être dans un autre recueil, ou sur un site de référence." }),
    h("p", { class: "recueil-ailleurs__lead recueil-ailleurs__lead--agents", text: "Certains actes sont réservés aux agents de la collectivité — circulaires internes, consignes de service : leur diffusion est restreinte, et ils ne figurent pas dans ce recueil public. Les agents les consultent depuis leur espace, une fois connectés." }),
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

// Les MENTIONS de l'espace public — mentions légales (les conditions auxquelles
// un acte publié ici est exécutoire et opposable), conditions de réutilisation,
// accessibilité — viennent du référentiel (`config.publication.mentions`, voir
// `mentionsPubliques`). Depuis la 1.5.3, chacune a SA PAGE (« ?page=… », voir
// `pagePubliqueVue`) : un texte légal se lit sur sa page et se cite par son
// adresse, et le pied de page se contente de les annoncer (`pagesPubliques`).
// L'administration écrit le texte, le remplace par un simple lien ou l'éteint.

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
    // Le SOMMAIRE du site : les sous-pages (mentions, accessibilité,
    // informations) ont chacune leur adresse — on les annonce ici. Ce qui n'est
    // pas publié ne s'annonce pas : on ne renvoie pas vers une page vide.
    pagesPubliques(st).length ? h("nav", { class: "recueil-pied__pages", "aria-label": "Pages du site" },
      ...pagesPubliques(st).flatMap((p, i) => [
        i ? h("span", { class: "recueil-pied__sep", text: " · " }) : null,
        h("a", { class: "recueil-lien", href: hrefPage(p.id), text: p.label }),
      ])) : null,
    // La porte de l'application, en bas de page : c'est là qu'un agent la
    // cherche (« Se connecter »), et l'en-tête la porte aussi.
    h("p", { class: "recueil-pied__acces" }, porteApplication("pied")),
    // LE BULLETIN, quand il est ouvert : son entrée et son flux. Il s'annonce
    // ici comme les sous-pages — et il cesse de s'annoncer quand il est éteint,
    // ou que le service ne le sert pas.
    bulletinOuvert(st) ? h("p", { class: "recueil-pied__bulletin" },
      h("a", { class: "recueil-lien", href: hrefPage("bulletins"), text: "Bulletins des actes" }),
      h("span", { class: "recueil-pied__sep", text: " · " }),
      h("a", { class: "recueil-lien", href: hrefFluxBulletin("rss"), text: "Flux RSS" }),
      h("span", { class: "recueil-pied__sep", text: " · " }),
      h("a", { class: "recueil-lien", href: hrefFluxBulletin("atom"), text: "Atom" })) : null,
    // Les MENTIONS ne se replient plus ici : depuis la 1.5.3, chaque texte a sa
    // SOUS-PAGE (« ?page=legales », « ?page=accessibilite »), annoncée par le
    // sommaire ci-dessus — un texte légal se lit sur sa page, et se cite par son
    // adresse. Le pied de page n'en garde que la licence, dont la publicité est
    // une obligation (voir plus haut).
    //
    // LA MENTION DE L'ÉDITEUR DU LOGICIEL ferme le pied : « Propulsé par
    // Scribae — GPLv3 ». Elle se règle (Administration › Identité) et peut donc
    // être éteinte — voir src/ui/mention.js, qui en porte le texte.
    mentionAffichee() ? h("p", { class: "recueil-pied__propulse" }, ...contenuMention()) : null,
  );
}

// Les pages que le site publie RÉELLEMENT : une mention éteinte ne s'annonce
// pas, et la rubrique des informations n'a de sens qu'avec des billets.
function pagesPubliques(st) {
  const reglages = reglagesInformations(state.config);
  return PAGES_PUBLIQUES.filter((p) => (p.id === "informations"
    ? reglages.actif && informationsOrdonnees(st.infos || []).length > 0
    : !!mentionPublique(state.config, p.mention)));
}
