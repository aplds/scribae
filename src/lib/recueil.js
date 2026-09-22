// ============================================================================
// Recueil public — le pendant « citoyen » de la publication.
//
// Le recueil est un site : il liste les actes publiés, les cherche, et rend le
// TEXTE de chacun DANS la page (et non dans un cadre ou un fichier à
// télécharger), comme le fait un recueil officiel. Il ne montre rien de
// l'atelier : ni trame, ni brouillon, ni compte.
//
// Les fonctions de ce module sont pures : elles ne touchent pas au DOM de
// l'application, elles préparent du HTML à partir de la VERSION PUBLIÉE
// (`formats.html`), seul document que le visiteur reçoit. On n'en prélève que
// le TEXTE : la charte de l'acte (sa feuille de style) habille le PAPIER — la
// version en ligne, elle, suit l'apparence du recueil.
//
// Le module donne aussi au recueil ses ADRESSES (celles qu'on partage et que
// citent les moteurs) et ses représentations lisibles par machine — le
// « recueil ouvert » : Markdown, texte brut, JSON. Voir plus bas, et
// `src/server/mysql/actes.mjs` pour le service qui les sert en production.
// ============================================================================
import { formatDate, uid } from "./util.js";

// ------------------------------------------------ extraction de la version publiée

// La version en ligne publiée est une page autonome. On en prélève ce qui sert
// à la rendre DANS la page du recueil : le document lui-même (`.doc`) et le
// certificat de transmission déposé à côté. Le titre porté par le document est
// saisi au passage : c'est lui que le recueil affiche en tête, comme un recueil
// officiel — et non le libellé court de l'objet. La feuille de style publiée
// n'est pas prélevée : elle vaut pour le document papier (PDF, Word, page
// autonome), pas pour la version web.
export function extraireVersion(html) {
  const vide = { html: "", transmis: "", titre: "", docTitre: "", recueil: "" };
  if (!html) return vide;
  let dom;
  try { dom = new DOMParser().parseFromString(String(html), "text/html"); }
  catch (e) { return vide; }
  if (!dom || !dom.documentElement) return vide;
  const doc = dom.querySelector(".doc");
  const paper = dom.querySelector(".paper");
  const transmis = dom.querySelector(".transmis");
  const titreEl = dom.querySelector(".doc-title");
  return {
    html: doc ? doc.outerHTML : (paper ? paper.innerHTML : (dom.body ? dom.body.innerHTML : "")),
    transmis: transmis ? transmis.outerHTML : "",
    titre: dom.querySelector("title") ? dom.querySelector("title").textContent : "",
    docTitre: titreEl ? String(titreEl.textContent || "").replace(/\s+/g, " ").trim() : "",
    recueil: dom.querySelector(".hdr__rep") ? dom.querySelector(".hdr__rep").textContent : "",
  };
}

// ------------------------------------------------------------------ mise en page du texte
// Le texte publié est INTÉGRÉ à la page du recueil : plus de feuille A4 dans un
// cadre, mais un texte qui occupe TOUTE la largeur disponible — la présentation
// d'un recueil officiel en ligne. La charte de l'acte n'entre pas ici : le
// document est rendu avec les styles de lecture de l'application (`.doc*`,
// src/css/app.css), que cette feuille-ci ajuste pour le web — police de
// l'interface, largeur, et couleurs ramenées sur l'apparence thémée du recueil
// (`--ink-public`, `--brand-public` — voir src/css/app.css).
export const CSS_DOCUMENT_WEB = `
.recueil-acte {
  background: none;
  --ink: var(--ink-public); --ink-2: var(--ink-2-public); --brand: var(--brand-public);
}
.recueil-acte .paper { width: auto; min-height: 0; margin: 0; padding: 0; background: none; box-shadow: none; }
.recueil-acte .doc {
  font-family: var(--font-ui);
  font-size: 1.05rem; line-height: 1.75; color: var(--ink); letter-spacing: 0;
}
.recueil-acte .doc-title, .recueil-acte .doc-sheet-header, .recueil-acte .doc-sheet-footer { display: none; }
.recueil-acte .doc-authority { font-size: 1.02rem; font-weight: 600; margin: 0 0 1.1em; }
.recueil-acte .doc-visas { margin: 0 0 1.1em; }
.recueil-acte .doc-visas-label { font-weight: 600; }
.recueil-acte .doc-enact { letter-spacing: .12em; margin: 1.4em 0; }
.recueil-acte .doc-article { margin: 0 0 1.7em; }
.recueil-acte .doc-article-head {
  font-family: var(--font-ui); font-size: .95rem; font-weight: 700;
  color: var(--brand); margin: 0 0 .45em; letter-spacing: .01em;
}
.recueil-acte .doc-article-num { color: inherit; }
.recueil-acte .doc-article-heading { font-weight: 400; color: var(--ink-2); }
.recueil-acte .doc-table th, .recueil-acte .doc-table td { border: 1px solid var(--border-strong); padding: 6px 8px; }
.recueil-acte .doc-table th { background: var(--bg-alt); }
.recueil-acte .doc-quote { border-left-color: var(--border-strong); }
.recueil-acte .doc-mention, .recueil-acte .doc-amend-mention { font-size: .92rem; color: var(--ink-2); }
/* Articles abrogés. Le recueil affiche l'acte dans sa rédaction en vigueur :
   l'article abrogé garde son intitulé et la mention de l'acte qui l'a abrogé,
   mais sa RÉDACTION — conservée dans la version en ligne — reste masquée. La
   case « Afficher les articles abrogés » (classe posée sur ce même bloc) la
   fait apparaître, barrée, comme une pièce d'archive. */
.recueil-acte .doc-abroge-corps { display: none; }
.recueil-acte.afficher-abroges .doc-abroge-corps {
  display: block; margin: .5em 0 0; padding: 2px 0 2px 12px;
  border-left: 3px solid var(--border-strong); color: var(--ink-2);
  text-decoration: line-through; text-decoration-color: var(--ink-muted);
}
.recueil-acte .doc-abroge-label {
  font-size: .78rem; font-weight: 600; letter-spacing: .03em; text-transform: uppercase;
  color: var(--ink-muted); text-decoration: none; margin: 0 0 .2em;
}
.recueil-abroges {
  display: flex; align-items: center; gap: 8px; margin: 0 0 1.2em;
  font-size: .88rem; color: var(--ink-2); cursor: pointer;
}
.recueil-abroges input { width: 16px; height: 16px; accent-color: var(--brand-public); }
@media print { .recueil-acte .doc-abroge-corps { display: none !important; } .recueil-abroges { display: none !important; } }
.recueil-acte .doc-signature { margin-top: 2em; }
.recueil-acte .transmis {
  margin-top: 1.7em; border-left: 3px solid var(--brand); background: var(--bg);
  padding: 10px 12px; border-radius: 3px; font-family: var(--font-ui); font-size: .82rem; color: var(--ink);
}
.recueil-acte .transmis strong { display: block; font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-2); }
.recueil-acte .transmis .ref { font-family: var(--font-mono); font-size: .76rem; color: var(--ink-muted); }
@media print {
  .recueil-acte .doc { font-size: 11pt; }
}`;

// --------------------------------------------------------------- recherche

// Comparaison « à la française » : on ignore la casse, les accents et les
// espaces surnuméraires, pour que « arrete » trouve « Arrêté ».
export function normaliser(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

// Le thème « sans thème » : les actes publiés avant que le thème ne soit
// transmis au service, ou issus d'une trame sans famille. Il porte son propre
// identifiant, pour que « les actes sans thème » se distingue de « tous les
// actes » — sans quoi la tuile correspondante serait inutilisable.
export const SANS_THEME = "__sans__";

// Un critère vide ne filtre pas. La recherche porte sur ce qu'un lecteur voit
// dans la liste : numéro, objet, nature, thème, entité, recueil, identifiant ELI.
// `themeOf` rend le thème d'une publication (voir `parTheme`) : il sert au filtre
// « thème » et à la recherche, qui doit trouver « urbanisme ».
export function filtrerPublications(liste, criteres = {}, themeOf) {
  const q = normaliser(criteres.q);
  const mots = q ? q.split(" ").filter(Boolean) : [];
  return (liste || []).filter((p) => {
    if (criteres.nature && p.nature !== criteres.nature) return false;
    if (criteres.theme && themeDe(p, themeOf) !== criteres.theme) return false;
    if (criteres.annee && String(anneeDe(p)) !== String(criteres.annee)) return false;
    if (criteres.entity && String(p.entityName || "") !== String(criteres.entity)) return false;
    if (!mots.length) return true;
    const champs = normaliser([p.numero, p.objet, p.nature, p.themeLabel, p.themeId, cleTheme(themeDe(p, themeOf)), p.entityName, p.recueil, p.eliUri, p.title].filter(Boolean).join(" "));
    return mots.every((m) => champs.includes(m));
  });
}

// Le thème d'une publication, jamais vide : `SANS_THEME` quand il n'y en a pas.
const themeDe = (p, themeOf) => (themeOf ? themeOf(p) : p.themeId) || SANS_THEME;
// Le même, mais vide quand il n'y en a pas : pour la recherche, où l'identifiant
// du thème (« fam-urbanisme ») se cherche comme le mot qu'il contient.
const cleTheme = (t) => (t === SANS_THEME ? "" : t);

// L'année d'un acte : celle de sa date de publication, à défaut celle du
// numéro (les actes sont numérotés « <année>-<séquence>-<entité> »).
export function anneeDe(p) {
  const d = String(p.datePublication || "");
  if (/^\d{4}/.test(d)) return d.slice(0, 4);
  const n = String(p.numero || "").match(/^(\d{4})/);
  return n ? n[1] : "";
}

// Les valeurs proposées au lecteur pour filtrer, déduites de ce qui est publié
// (aucune liste figée : si rien n'a été publié sous une nature ou un thème, il ne
// s'affiche pas). Les publications retirées — elles n'existent plus — sortent de
// ces listes comme du recueil.
export function facettes(liste, themeOf) {
  const list = liste || [];
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  return {
    natures: uniq(list.map((p) => p.nature)).sort(),
    themes: uniq(list.map((p) => themeDe(p, themeOf))).sort(),
    annees: uniq(list.map((p) => anneeDe(p))).sort().reverse(),
    entities: uniq(list.map((p) => p.entityName)).sort(),
  };
}

// ------------------------------------------------------------------ thèmes
// La « matière » d'un acte — ce que le recueil public appelle son THÈME : la
// famille de la trame dont l'acte est issu (« Urbanisme et voirie », « Police
// administrative », « Finances et budget »…). C'est par elle qu'un lecteur
// cherche un acte : « les arrêtés d'urbanisme » se lisent mieux que « les
// arrêtés ».
//
// La publication porte son thème depuis qu'il lui est transmis au dépôt
// (`themeId`, `themeLabel` — voir src/ui/views/signature.js). Les actes publiés
// avant sont retrouvés par la vue, à partir de l'acte local (voir
// src/ui/views/recueil-public.js) : `themeOf` est alors une fonction.

// Une publication est « en vigueur » si elle est la dernière version publiée
// sous son identifiant ELI. Les versions antérieures restent consultables, mais
// elles ne comptent ni dans les statistiques, ni dans les thèmes, ni dans le
// carrousel : un acte ne se présente qu'une fois.
export const estEnVigueur = (p) => !!p && p.latest !== false;

export const publicationsEnVigueur = (liste) => (liste || []).filter(estEnVigueur);

// Les dernières publications, de la plus récente à la plus ancienne : ce que
// montre le carrousel de la page d'accueil.
export function dernieresPublications(liste, n = 6) {
  return [...publicationsEnVigueur(liste)]
    .sort((a, b) => String(b.datePublication || "").localeCompare(String(a.datePublication || ""))
      || String(b.publieeLe || "").localeCompare(String(a.publieeLe || "")))
    .slice(0, n);
}

// Les actes ÉPINGLÉS — ceux que l'administration a mis en avant d'un geste,
// depuis l'onglet « Actes ». Le recueil les présente dans sa bande « À la
// une », avant les derniers actes publiés : c'est la place d'un règlement
// intérieur, d'une charte, d'un document qu'on vient chercher. Comme le
// carrousel, la bande ne montre que les versions EN VIGUEUR — un acte ne se
// présente qu'une fois, même épinglé.
export const estEpinglee = (p) => !!p && p.epingle === true;

export function publicationsEpinglees(liste) {
  return publicationsEnVigueur(liste)
    .filter(estEpinglee)
    .sort((a, b) => String(b.datePublication || "").localeCompare(String(a.datePublication || ""))
      || String(b.publieeLe || "").localeCompare(String(a.publieeLe || "")));
}

// Le libellé et la présentation d'un thème, lus au référentiel. Le libellé est
// éditable (Administration › Familles) : le recueil suit ce que l'administration a
// écrit.
export function themeLabel(id, families) {
  if (!id) return "";
  const f = (families || []).find((x) => x.id === id);
  return (f && f.label) || "";
}

export function themeDescription(id, families) {
  if (!id) return "";
  const f = (families || []).find((x) => x.id === id);
  return (f && f.description) || "";
}

// La répartition des publications par thème : les thèmes les plus fournis
// d'abord, puis par ordre alphabétique. Les publications sans thème (actes
// publiés avant que le thème ne soit transmis, ou trame sans famille) sont
// rassemblées sous `SANS_THEME` — la vue les nomme « Autres actes » et les range
// en dernier.
export function parTheme(liste, themeOf) {
  const groupes = new Map();
  for (const p of liste || []) {
    const id = themeDe(p, themeOf);
    if (!groupes.has(id)) groupes.set(id, []);
    groupes.get(id).push(p);
  }
  return [...groupes.entries()]
    .map(([id, items]) => ({ id, items: [...items], count: items.length }))
    .sort((a, b) => (a.id === SANS_THEME ? 1 : b.id === SANS_THEME ? -1 : 0)
      || b.count - a.count || String(a.id).localeCompare(String(b.id)));
}

// Groupement par année, du plus récent au plus ancien, pour une liste qui se
// lit comme un recueil (et non comme un journal de dépôts).
export function parAnnee(liste) {
  const groupes = new Map();
  for (const p of liste || []) {
    const a = anneeDe(p) || "Sans date";
    if (!groupes.has(a)) groupes.set(a, []);
    groupes.get(a).push(p);
  }
  return [...groupes.entries()]
    .sort((x, y) => String(y[0]).localeCompare(String(x[0])))
    .map(([annee, items]) => ({
      annee,
      items: [...items].sort((a, b) => String(b.datePublication || "").localeCompare(String(a.datePublication || ""))),
    }));
}

// ------------------------------------------------ recueils extérieurs et renvois
// Un recueil n'est jamais seul. Une collectivité peut avoir tenu, avant de
// passer à Scribae, d'AUTRES recueils : un recueil « bis » monté à part pour
// une raison technique (une entité autonome, un périmètre séparé), ou des
// recueils **inactifs** — plus alimentés — que des changements de logiciel ont
// laissés derrière eux, parfois plusieurs à la suite. Le public, lui, cherche
// un acte, pas l'histoire des prestataires : le recueil lui dit donc OÙ
// chercher ailleurs, et où toute question de droit trouve sa réponse.
//
// Ces renvois sont des DONNÉES du référentiel
// (`config.publication.recueilsExternes`) : l'administration les écrit, les
// ordonne et les retire sans toucher au code. Trois natures, parce que les
// trois ne se lisent pas de la même façon :
//
//   • « bis »        un recueil parallèle, tenu hors de Scribae ;
//   • « inactif »    un recueil qui n'est plus alimenté, avec la période qu'il
//                    couvre (« actes publiés du … au … ») : c'est ce qui
//                    distingue deux recueils successifs, et dit au lecteur où
//                    s'arrête l'un, où commence l'autre ;
//   • « ressource »  un site de référence (Légifrance, service-public.gouv.fr…),
//                    qui ne contient pas les actes de la collectivité mais les
//                    textes et les démarches qui les entourent.
export const TYPES_RECUEIL_EXTERNE = [
  { id: "bis", label: "Recueil « bis »", hint: "Un recueil parallèle, tenu hors de Scribae." },
  { id: "inactif", label: "Recueil inactif", hint: "Un recueil qui n'est plus alimenté — précisez la période couverte." },
  { id: "ressource", label: "Site de référence", hint: "Un site à consulter (Légifrance, service-public.gouv.fr…)." },
];

export const recueilExterneTypeLabel = (id) =>
  (TYPES_RECUEIL_EXTERNE.find((t) => t.id === id) || {}).label || "Recueil";

// Les renvois livrés avec l'application : ils ne sont pas codés « en dur » dans
// la page — ce sont des entrées ordinaires de la liste, que l'administration
// peut modifier ou retirer. Le bouton « Rétablir » de l'écran de réglage les
// fait revenir d'un clic quand on les a supprimés par mégarde.
export const RENVOIS_RECOMMANDES = [
  {
    id: "rex-legifrance", type: "ressource",
    label: "Légifrance — le service public de la diffusion du droit",
    url: "https://www.legifrance.gouv.fr/",
    note: "Les textes officiels : codes, lois, décrets et arrêtés.",
  },
  {
    id: "rex-service-public", type: "ressource",
    label: "service-public.gouv.fr — le site officiel de l'administration française",
    url: "https://www.service-public.gouv.fr/",
    note: "Les démarches et les droits des usagers.",
  },
];

export function newRecueilExterne(patch = {}) {
  return { id: uid("rex"), label: "", url: "", type: "bis", du: "", au: "", note: "", ...patch };
}

// Les renvois EFFECTIFS : ceux qui portent une adresse. Une entrée à moitié
// remplie — un libellé sans adresse — ne s'imprime pas : mieux vaut un renvoi
// absent qu'un lien qui ne mène nulle part.
export function recueilsExternes(config) {
  const list = (config && config.publication && config.publication.recueilsExternes) || [];
  return list.filter((r) => r && String(r.url || "").trim());
}

// L'adresse d'un renvoi, complétée d'un schéma si l'administration a saisi
// « www.exemple.fr » : un lien sans schéma serait relatif, et mènerait à une
// page du recueil qui n'existe pas.
export function urlRecueilExterne(r) {
  return urlAvecSchema(r && r.url);
}

// La période COUVERTE par un recueil inactif : « actes publiés du … au … ».
// Chacune des deux bornes est facultative — un recueil dont on ne connaît que
// l'année de fin reste utile — et rien ne s'affiche si aucune n'est renseignée.
export function periodeRecueil(r) {
  if (!r) return "";
  const du = r.du ? formatDate(r.du, "date-long") : "";
  const au = r.au ? formatDate(r.au, "date-long") : "";
  if (du && au) return `actes publiés du ${du} au ${au}`;
  if (du) return `actes publiés depuis le ${du}`;
  if (au) return `actes publiés jusqu'au ${au}`;
  return "";
}

// ---------------------------------------------------- mentions du pied de page
//
// Un espace public se termine par ses mentions : celles que la loi fait figurer
// au pied d'un site public, et qu'une collectivité veut pouvoir adapter à sa
// situation. DEUX mentions sont prévues, parce que ce sont les deux qu'un
// administré vient chercher en bas de page :
//
//   • « légales »        qui édite le recueil, et à quelles conditions les actes
//                        qu'il diffuse sont publiés, exécutoires et opposables ;
//   • « accessibilite »  ce que la collectivité doit à l'accessibilité de son
//                        service en ligne, et la voie ouverte à qui rencontre un
//                        obstacle.
//
// Chacune se présente de TROIS façons (`mode`) :
//
//   • « texte »   le texte est écrit dans le référentiel et s'affiche en bas de
//                 page, déplié à la demande du lecteur ;
//   • « lien »    le pied de page ne porte qu'un lien — celui des mentions
//                 légales du site principal de la collectivité, par exemple ;
//   • « aucune »  la mention ne s'affiche pas.
//
// Rien n'est codé dans la page : tout vient du référentiel
// (`config.publication.mentions`), que l'administration écrit, remplace par un
// lien ou éteint (Administration › Publication › « Mentions du recueil public »).
export const MENTIONS_PUBLIQUES = [
  {
    id: "legales",
    label: "Mentions légales",
    hint: "Qui édite le recueil, et les règles de publication, d'exécution et d'opposabilité des actes.",
  },
  {
    id: "reutilisation",
    label: "Conditions de réutilisation",
    hint: "La licence sous laquelle les informations publiées ici peuvent être réutilisées (obligation de publicité des conditions de réutilisation, CRPA art. L. 322-1).",
  },
  {
    id: "accessibilite",
    label: "Mentions d'accessibilité",
    hint: "L'accessibilité du service en ligne, et la voie ouverte à qui rencontre un obstacle.",
  },
];

// Les textes LIVRÉS. Ils sont écrits pour être vrais d'une collectivité
// quelconque : ils ne nomment personne, et rappellent les règles applicables
// plutôt que la situation d'une commune en particulier. L'administration les
// adapte (identité de l'éditeur, coordonnées, état de conformité) — et le jeu de
// démonstration les remplace par ceux de la fiction (voir src/lib/seed.js).
export const MENTIONS_DEFAUT = {
  legales: {
    mode: "texte",
    titre: "Mentions légales",
    lien: "",
    lienLabel: "",
    texte: [
      "Ce recueil est édité par la collectivité, qui publie ici les actes administratifs qu'elle prend. Les règles qui s'attachent à cette publication sont rappelées ci-dessous.",
      "Publication et opposabilité. Les actes pris par les autorités communales sont exécutoires de plein droit dès qu'il a été procédé à leur publication ou à leur affichage, ainsi qu'à leur transmission au représentant de l'État (article L. 2131-1 du code général des collectivités territoriales). Une fois cette double formalité accomplie, ils sont opposables aux tiers. La date à laquelle chaque acte devient exécutoire est indiquée sur la page qui le diffuse.",
      "Voies et délais de recours. Un acte administratif peut faire l'objet d'un recours gracieux ou, à défaut, d'un recours contentieux devant le tribunal administratif compétent, dans un délai de deux mois à compter de sa publication (article R. 421-1 du code de justice administrative). Le recours gracieux formé dans ce délai l'interrompt : un nouveau délai court à compter de la réponse de la collectivité.",
      "Conservation des originaux. Les actes signés sont conservés par la collectivité et peuvent être consultés sur demande auprès du service compétent ; la version diffusée dans ce recueil ne se substitue pas au document signé.",
    ].join("\n\n"),
  },
  // La publicité des conditions de réutilisation est une OBLIGATION : les
  // informations publiques mises en ligne doivent pouvoir être réutilisées, et
  // les conditions de cette réutilisation doivent être rendues publiques
  // (articles L. 321-1 et L. 322-1 du code des relations entre le public et
  // l'administration). Le texte livré nomme la licence par défaut et renvoie à
  // son texte ; l'administration le remplace par celui de sa propre licence.
  reutilisation: {
    mode: "texte",
    titre: "Réutilisation des informations",
    lien: "",
    lienLabel: "",
    texte: [
      "Les informations publiées dans ce recueil sont des informations publiques : elles peuvent être réutilisées à d'autres fins que celles pour lesquelles elles ont été produites, y compris à des fins commerciales, sous réserve du respect de la licence indiquée ci-dessous.",
      "Licence. Sauf mention contraire portée sur un document, ces informations sont mises à disposition sous la Licence Ouverte / Open Licence 2.0 (Etalab), qui autorise la reproduction, la diffusion et la réutilisation, y compris commerciale, à condition de mentionner la source et la date de dernière mise à jour, et de ne pas altérer le sens des documents. Le texte de cette licence est publié par la collectivité et accompagne le présent recueil.",
      "Documents non réutilisables. Ne peuvent pas être réutilisés, et sont exclus de cette licence : les logos, les marques et les signes distinctifs de la collectivité ; les documents dont la communication ne relève pas d'une obligation, ou qui contiennent des données à caractère personnel (un acte individuel est conservé et communicable sur demande, mais n'est pas publié ici) ; les œuvres protégées par un droit d'auteur dont la collectivité ne détient pas les droits.",
      "Garantie. La collectivité s'attache à la qualité des informations publiées, mais ne peut garantir qu'elles sont exemptes d'erreur ni qu'elles demeurent à jour : le texte de référence est l'original signé, et seul celui-ci fait foi. Il appartient à toute personne réutilisant ces informations de vérifier le texte signé avant tout usage.",
    ].join("\n\n"),
  },
  accessibilite: {
    mode: "texte",
    titre: "Accessibilité",
    lien: "",
    lienLabel: "",
    texte: [
      "Ce service de communication publique en ligne relève des obligations d'accessibilité prévues par l'article 47 de la loi n° 2005-102 du 11 février 2005. La collectivité s'attache à le rendre accessible conformément au référentiel général d'amélioration de l'accessibilité (RGAA).",
      "Déclaration d'accessibilité. L'état de conformité du service, les contenus qui ne sont pas accessibles et les mesures de correction retenues sont décrits dans la déclaration d'accessibilité publiée par la collectivité, accompagnée de son schéma pluriannuel de mise en accessibilité et du plan d'actions de l'année en cours.",
      "Signaler un obstacle. Si vous n'arrivez pas à accéder à un contenu ou à une fonctionnalité, signalez-le à la collectivité : écrivez au service dont les coordonnées figurent en bas de page, ou utilisez le formulaire de contact du site de la collectivité. Vous pouvez également saisir le Défenseur des droits, compétent en matière d'accessibilité des services de communication publique en ligne.",
    ].join("\n\n"),
  },
};

// Les mentions livrées, en COPIE : un référentiel neuf les reçoit, et il les
// modifie ensuite sans jamais toucher au texte livré — que le bouton « Rétablir
// le texte livré » de l'écran de réglage fait revenir d'un clic.
export function mentionsParDefaut() {
  return Object.fromEntries(MENTIONS_PUBLIQUES.map((m) => [m.id, { ...MENTIONS_DEFAUT[m.id] }]));
}

// L'adresse d'un lien écrit par l'administration, complétée d'un schéma si elle
// a saisi « www.exemple.fr » : un lien sans schéma serait relatif, et mènerait à
// une page du recueil qui n'existe pas.
export function urlAvecSchema(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : "https://" + u;
}

// La mention telle qu'elle s'affiche, ou `null` quand il n'y a rien à montrer :
// une mention éteinte, un lien sans adresse ou un texte vide ne s'impriment
// pas — mieux vaut une mention absente qu'une rubrique vide en bas de page.
export function mentionPublique(config, id) {
  const def = MENTIONS_DEFAUT[id] || {};
  const brut = (((config && config.publication && config.publication.mentions) || {})[id]) || {};
  const m = { ...def, ...brut };
  const mode = m.mode === "lien" || m.mode === "aucune" ? m.mode : "texte";
  const titre = String(m.titre || "").trim() || (MENTIONS_PUBLIQUES.find((x) => x.id === id) || {}).label || "";
  if (mode === "aucune") return null;
  if (mode === "lien") {
    const url = urlAvecSchema(m.lien);
    if (!url) return null;
    return { id, mode, titre, url, lienLabel: String(m.lienLabel || "").trim() || titre };
  }
  const texte = String(m.texte || "").trim();
  if (!texte) return null;
  return { id, mode: "texte", titre, texte };
}

export function mentionsPubliques(config) {
  return MENTIONS_PUBLIQUES.map((m) => mentionPublique(config, m.id)).filter(Boolean);
}

// ---------------------------------------------------- licence de réutilisation
// La licence sous laquelle les informations du recueil sont réutilisables. Elle
// se règle dans le référentiel (`config.publication.licence`), et elle est
// reprise dans la page (pied du recueil) comme dans le JSON-LD publié — de
// sorte que les conditions de réutilisation soient publiques ET lisibles par
// une machine. La Licence Ouverte 2.0 est le défaut : c'est la licence des
// informations publiques en France, et c'est celle que recommande Etalab.
export const LICENCE_DEFAUT = {
  nom: "Licence Ouverte / Open Licence 2.0",
  url: "https://www.etalab.gouv.fr/wp-content/uploads/2017/04/ETALAB-Licence-Ouverte-v2.0.pdf",
  mention: "Source des données et documents : la collectivité. Réutilisation autorisée sous Licence Ouverte 2.0.",
};

export function licenceReutilisation(config) {
  const l = (config && config.publication && config.publication.licence) || {};
  const nom = String(l.nom || "").trim() || LICENCE_DEFAUT.nom;
  const url = String(l.url || "").trim() || LICENCE_DEFAUT.url;
  const mention = String(l.mention || "").trim() || LICENCE_DEFAUT.mention;
  return { nom, url, mention };
}

// Le découpage d'un texte de mention en BLOCS, pour l'impression. L'administration
// écrit au plus simple : une ligne vide sépare deux paragraphes, et une ligne qui
// commence par « - » ou « • » devient une puce. Pas de balisage à apprendre, et
// rien d'autre à retenir — le texte reste un texte.
export function blocsMention(texte) {
  const blocs = [];
  for (const morceau of String(texte || "").split(/\n\s*\n/)) {
    const t = morceau.trim();
    if (!t) continue;
    const lignes = t.split("\n").map((l) => l.trim()).filter(Boolean);
    const puces = lignes.filter((l) => /^([-•*]|\d+[.)])\s+/.test(l));
    if (puces.length === lignes.length && lignes.length) {
      blocs.push({ type: "ul", items: lignes.map((l) => l.replace(/^([-•*]|\d+[.)])\s+/, "")) });
    } else {
      blocs.push({ type: "p", texte: lignes.join(" ") });
    }
  }
  return blocs;
}

// ------------------------------------------------------------------ liens

// La page publique du recueil. Une installation auto-hébergée est un vrai site
// (le service sert /recueil…, sans JavaScript) ; ailleurs — démonstration
// statique, plateforme — il n'y a pas de serveur, et c'est la page elle-même qui
// adresse ses actes par des paramètres de requête.
export const autoHeberge = () => !!globalThis.__SCRIBA_SELF_HOSTED__;

export function basePublique() {
  if (autoHeberge()) return location.origin;
  // La page, jamais le sous-domaine interne : c'est l'adresse que le lecteur
  // peut citer et partager.
  const nom = globalThis.generatorName;
  if (nom) return "https://perchance.org/" + nom;
  return location.origin + location.pathname;
}

// L'adresse du recueil entier, puis celle d'un acte. C'est l'adresse de
// RÉFÉRENCE d'un acte publié : celle qu'on cite, qu'on partage, et que
// recopient les moteurs.
export const adresseRecueil = () => (autoHeberge() ? basePublique() + "/recueil" : basePublique() + "?recueil=1");

export const adresseActe = (cle) => (autoHeberge()
  ? basePublique() + "/recueil/" + encodeURIComponent(cle)
  : basePublique() + "?acte=" + encodeURIComponent(cle));

// Le lien d'un acte du recueil (sans clé : le recueil lui-même).
export const lienRecueil = (cle) => (cle ? adresseActe(cle) : adresseRecueil());

// Un fichier du recueil ouvert : le plan du site, l'index, la présentation aux
// agents. Servis par un déploiement serveur (voir noms ci-dessous) ; un
// déploiement statique ne les sert pas.
export const adresseFichier = (nom) => basePublique() + "/" + String(nom).replace(/^\/+/, "");

// L'adresse à SUIVRE depuis la page elle-même : relative, elle ne quitte jamais
// le cadre (suivre une adresse absolue de la page publique ouvrirait la page
// publique dans la page). C'est celle des liens ; `adresseActe` est celle qu'on
// copie — et les deux se répondent : `?acte=<clé>` dans la page, `/recueil/<clé>`
// sur un déploiement serveur.
export const hrefRecueil = () => (autoHeberge() ? "/recueil" : location.pathname + "?recueil=1");

// --------------------------------------------------- recueil ouvert : les robots
// Un acte publié est une DONNÉE publique : c'est elle que consultent les moteurs
// de recherche et les agents (LLMs). Ce que ceux-ci ne savent pas faire, c'est
// exécuter une application : il leur faut des adresses stables et des
// représentations qu'ils savent lire. Cette section fabrique les deux.
//
// Sur une installation auto-hébergée, ces représentations sont servies par le
// service lui-même (voir src/server/mysql/actes.mjs) : /robots.txt, /llms.txt,
// /sitemap.xml, /recueil.json, /recueil, /recueil/<clé> et /recueil/<clé>.<ext>.
// Ailleurs, la page les rend elle-même (`?acte=<clé>&format=md`), pour les
// lecteurs qui exécutent le JavaScript.

export const FORMATS_OUVERTS = [
  { ext: "json", label: "JSON", type: "application/json", hint: "Métadonnées, données ELI et texte, en une seule réponse." },
  { ext: "md", label: "Markdown", type: "text/markdown", hint: "Le texte de l'acte, structuré — le plus lisible pour un agent." },
  { ext: "txt", label: "Texte brut", type: "text/plain", hint: "Le texte seul, sans mise en forme." },
  { ext: "akn", label: "Akoma Ntoso", type: "application/akn+xml", hint: "Le document normé (archivage, échange)." },
];

// L'adresse d'une représentation d'un acte : le fichier du site auto-hébergé,
// ou le paramètre de format de la page.
export const urlFormat = (cle, ext) => (autoHeberge()
  ? adresseActe(cle) + "." + ext
  : basePublique() + "?acte=" + encodeURIComponent(cle) + "&format=" + ext);

// L'adresse à SUIVRE depuis la page elle-même — relative, elle ne quitte jamais
// le cadre. C'est celle des liens ; `adresseActe` est celle qu'on copie.
export const hrefActe = (cle) => (autoHeberge()
  ? "/recueil/" + encodeURIComponent(cle)
  : location.pathname + "?acte=" + encodeURIComponent(cle));

export const hrefFormat = (cle, ext) => (autoHeberge()
  ? "/recueil/" + encodeURIComponent(cle) + "." + ext
  : location.pathname + "?acte=" + encodeURIComponent(cle) + "&format=" + ext);

export const hrefFichier = (nom) => autoHeberge() ? "/" + nom : location.pathname + "?fichier=" + nom;

// Les fichiers du recueil ouvert, tels qu'un déploiement serveur les sert.
export const FICHIERS_OUVERTS = [
  { nom: "llms.txt", label: "llms.txt", hint: "Le recueil présenté aux agents, en Markdown (convention llms.txt)." },
  { nom: "recueil.json", label: "recueil.json", hint: "L'index de tous les actes publiés, lisible par machine." },
  { nom: "sitemap.xml", label: "sitemap.xml", hint: "Le plan du site : une adresse par acte, pour les moteurs." },
  { nom: "robots.txt", label: "robots.txt", hint: "Ce qui peut être parcouru, et où trouver le plan." },
];

// ------------------------------------------------------ liens par l'identifiant ELI
//
// Un acte en cite un autre PAR SON IDENTIFIANT ELI (« eli:/fr/arr/2026/0464/vsl ») :
// c'est cet identifiant qui est écrit dans le document publié — il ne change
// jamais, même si l'adresse du site change. Mais un identifiant n'est pas une
// adresse : aucun navigateur ne sait l'ouvrir. C'est donc à l'INSTANCE de le
// traduire, et elle seule le peut — elle connaît ses actes publiés.
//
// D'où deux usages, et une seule table de correspondance. L'identifiant ELI
// désigne l'ACTE (et non une version) : deux versions publiées sous le même
// identifiant désignent le même acte, et c'est la version EN VIGUEUR que le
// recueil présente — donc celle que le lien doit atteindre.
//
//   • les liens portés par un document publié (un visa d'adoption, une annexe) :
//     `resoudreLiensEli` remplace, dans la page, l'identifiant par l'adresse de
//     l'acte visé — le lecteur reste dans l'instance ;
//   • l'identifiant comme ADRESSE (« ?eli=… » dans la page, « /eli/… » sur un
//     déploiement auto-hébergé) : un lecteur qui a un ELI sous les yeux ouvre
//     l'acte sans rien connaître des adresses internes du recueil.

export const ELI_PREFIXE = "eli:/fr/";

export const estEliUri = (v) => /^eli:\/fr\//i.test(String(v || "").trim());

// La clé de comparaison de deux écritures du même identifiant (la casse et les
// espaces d'un identifiant recopié à la main ne doivent pas le rendre inconnu).
export const cleEli = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, "").replace(/\/+$/, "");

// L'index des actes publiés par identifiant ELI. La liste arrive de la plus
// récente à la plus ancienne (voir /v1/publications) : la première version
// rencontrée sous un identifiant est retenue, sauf si elle n'est plus en vigueur.
export function indexEli(publications) {
  const index = new Map();
  for (const p of publications || []) {
    if (!p || !p.eliUri || !p.cle) continue;
    const k = cleEli(p.eliUri);
    const deja = index.get(k);
    if (!deja || (deja.latest === false && p.latest !== false)) index.set(k, p);
  }
  return index;
}

// L'acte publié que désigne un identifiant ELI (null s'il n'est pas au recueil).
export function publicationParEli(liste, eli) {
  return estEliUri(eli) ? indexEli(liste).get(cleEli(eli)) || null : null;
}

// Le chemin d'un identifiant dans l'espace public : un segment par élément de
// l'identifiant (« eli:/fr/arr/2026/0464/vsl » → « arr/2026/0464/vsl »).
const segmentsEli = (eli) => String(eli || "").replace(/^eli:\/fr\//i, "").split("/").filter(Boolean);

// L'adresse de l'identifiant — celle qu'on cite et qu'on partage. Auto-hébergé,
// c'est une adresse du site (« /eli/arr/2026/0464/vsl »), que le service sait
// résoudre lui-même ; ailleurs, elle passe par la page (« ?eli=… »).
export const adresseEli = (eli) => {
  if (!estEliUri(eli)) return "";
  return autoHeberge()
    ? basePublique() + "/eli/" + segmentsEli(eli).map(encodeURIComponent).join("/")
    : basePublique() + "?eli=" + encodeURIComponent(String(eli).trim());
};

// La même, à SUIVRE depuis la page : relative, elle ne quitte jamais le cadre.
export const hrefEli = (eli) => {
  if (!estEliUri(eli)) return "";
  return autoHeberge()
    ? "/eli/" + segmentsEli(eli).map(encodeURIComponent).join("/")
    : location.pathname + "?eli=" + encodeURIComponent(String(eli).trim());
};

// Les liens ELI d'un document publié, RÉSOLUS dans l'instance. `liste` est la
// liste des publications du recueil (voir /v1/publications) : sans elle, on ne
// décide rien — les liens sont seulement annotés (`data-eli`), et l'appelant
// repasse quand la liste est là (l'acte cité est peut-être publié).
//
// Un lien résolu garde la mention écrite — l'intitulé de l'acte cité — et prend
// l'adresse de l'acte visé. Un identifiant que le recueil ne connaît pas est
// laissé en TEXTE : un lien qui ne mène nulle part vaut moins que pas de lien.
export function resoudreLiensEli(racine, { liste, href } = {}) {
  if (!racine) return { resolus: 0, inconnus: 0, differe: 0 };
  const liens = [...racine.querySelectorAll("a[href], a[data-eli]")].filter((a) =>
    estEliUri(a.getAttribute("href")) || estEliUri(a.getAttribute("data-eli")));
  if (!liens.length) return { resolus: 0, inconnus: 0, differe: 0 };
  if (!Array.isArray(liste)) {
    for (const a of liens) if (!a.getAttribute("data-eli")) a.setAttribute("data-eli", a.getAttribute("href") || "");
    return { resolus: 0, inconnus: 0, differe: liens.length };
  }
  const index = indexEli(liste);
  let resolus = 0;
  let inconnus = 0;
  for (const a of liens) {
    const eli = String(a.getAttribute("data-eli") || a.getAttribute("href") || "").trim();
    const p = index.get(cleEli(eli));
    if (p) {
      a.setAttribute("href", (href || hrefActe)(p.cle));
      a.setAttribute("data-eli", eli);
      a.classList.add("recueil-lien-eli");
      a.setAttribute("title", "Acte cité par son identifiant ELI — " + eli);
      // Un lien interne ne s'ouvre pas dans un onglet : il se suit dans la page,
      // comme tous les liens du recueil (un nouvel onglet ouvrirait l'adresse
      // interne du cadre, qui n'est pas faite pour être visitée directement).
      a.removeAttribute("target");
      a.removeAttribute("rel");
      resolus++;
    } else {
      const span = document.createElement("span");
      span.className = "recueil-lien-eli recueil-lien-eli--hors";
      span.setAttribute("data-eli", eli);
      span.setAttribute("title", "Acte non publié dans ce recueil — identifiant ELI " + eli);
      span.textContent = a.textContent;
      a.replaceWith(span);
      inconnus++;
    }
  }
  return { resolus, inconnus, differe: 0 };
}

// Le texte d'un acte publié, en clair : le texte déposé à la publication, ou,
// à défaut, celui du document publié.
export function texteDePublication(rec) {
  const depose = rec && rec.formats && rec.formats.texte;
  if (depose && String(depose).trim()) return String(depose).trim() + "\n";
  const html = (rec && rec.formats && rec.formats.html) || "";
  const dom = html ? corpsPublie(html) : null;
  if (!dom) return "";
  const lignes = [];
  for (const el of dom.children) {
    const t = textDeBloc(el);
    if (t) lignes.push(t);
  }
  return lignes.join("\n\n").trim() + "\n";
}

// Le Markdown d'un acte publié : celui déposé à la publication, ou, à défaut,
// refait depuis le document publié — c'est la structure de l'acte (intitulé,
// articles, listes, tableaux) qui donne les titres et les listes.
export function markdownDePublication(rec) {
  const depose = rec && rec.formats && rec.formats.md;
  if (depose && String(depose).trim()) return String(depose).trim() + "\n";
  const entete = enteteMarkdown(rec || {});
  const html = (rec && rec.formats && rec.formats.html) || "";
  const dom = html ? corpsPublie(html) : null;
  if (!dom) return entete + "\n" + texteDePublication(rec) + "\n";
  const lignes = [];
  for (const el of dom.children) {
    const md = markdownDeBloc(el);
    if (md) lignes.push(md);
  }
  return entete + "\n" + lignes.join("\n\n").trim() + "\n";
}

// L'enregistrement d'un acte pour un agent : les métadonnées, les données
// structurées (JSON-LD/ELI) et le texte, en une seule réponse.
export function jsonDePublication(rec, config) {
  const r = rec || {};
  let jsonld = null;
  try { jsonld = r.formats && r.formats.jsonld ? JSON.parse(r.formats.jsonld) : null; } catch (e) { jsonld = null; }
  return {
    cle: r.cle,
    eliUri: r.eliUri || "",
    url: adresseActe(r.cle),
    numero: r.numero || "",
    nature: r.nature || "",
    themeId: r.themeId || "",
    themeLabel: r.themeLabel || "",
    objet: r.objet || "",
    entityName: r.entityName || "",
    recueil: r.recueil || (config && config.brand && config.brand.name) || "",
    dateDocument: r.dateDocument || "",
    datePublication: r.datePublication || "",
    dateOpposabilite: r.dateOpposabilite || "",
    opposabiliteRule: r.opposabiliteRule || "",
    // Un document NON JURIDIQUE (verbatim, déclaration, vœu) : publié au recueil,
    // mais sans opposabilité ni entrée en vigueur. `juridique: false` le dit aux
    // agents comme au recueil public.
    juridique: r.juridique === false ? false : undefined,
    natureDoc: r.natureDoc || undefined,
    kind: r.kind || "originale",
    enVigueur: r.latest !== false,
    // Mis en avant sur la page d'accueil du recueil (bande « À la une ») : le
    // drapeau suit l'ACTE — l'identifiant ELI — et non la version déposée.
    epingle: r.epingle === true,
    auteur: r.auteur || "",
    sha256: r.sha256 || "",
    transmission: r.transmission || null,
    signature: r.signature || null,
    original: r.original ? { format: r.original.format, sha256: r.original.sha256, horodatage: r.original.horodatage || null, verifie: r.original.verified === true } : null,
    formats: Object.fromEntries(FORMATS_OUVERTS.map((f) => [f.ext, urlFormat(r.cle, f.ext)])),
    jsonld,
    texte: texteDePublication(rec),
  };
}

// L'origine du document publié, réduite au corps de l'acte : l'en-tête et le
// pied de la page publiée sont du décor, pas de l'acte.
function corpsPublie(html) {
  try {
    const dom = new DOMParser().parseFromString(String(html), "text/html");
    return dom.querySelector(".doc") || null;
  } catch (e) { return null; }
}

const TEXTE_BLOC = (el) => String(el.textContent || "").replace(/\s+/g, " ").trim();

// Le texte d'un bloc du document publié, sans mise en forme. Les notes de
// préparation n'en font pas partie : elles ne sont pas publiées.
function textDeBloc(el) {
  if (el.classList && el.classList.contains("doc-notes")) return "";
  if (el.tagName === "UL" || el.tagName === "OL") {
    const lignes = [...el.children].map((li) => TEXTE_BLOC(li)).filter(Boolean);
    return lignes.join("\n");
  }
  if (el.classList.contains("doc-table-wrap")) {
    const lignes = [...el.querySelectorAll("tr")].map((tr) =>
      [...tr.children].map((c) => TEXTE_BLOC(c)).filter(Boolean).join(" | "));
    return lignes.filter(Boolean).join("\n");
  }
  const propre = TEXTE_BLOC(el);
  if (propre) return propre;
  const lignes = [];
  for (const enfant of el.children) {
    const t = textDeBloc(enfant);
    if (t) lignes.push(t);
  }
  return lignes.join("\n\n");
}

// Le Markdown d'un bloc du document publié, d'après sa classe : c'est la même
// structure que celle des documents compilés (voir src/lib/render.js).
function markdownDeBloc(el) {
  const c = el.classList;
  const t = TEXTE_BLOC(el);
  if (c.contains("doc-sheet-header") || c.contains("doc-sheet-footer") || c.contains("doc-consolidation") || c.contains("doc-notes")) return "";
  if (c.contains("doc-title")) return "# " + t;
  if (c.contains("doc-authority")) return "*" + t + "*";
  if (c.contains("doc-visas")) return [...el.children].map((li) => "- " + TEXTE_BLOC(li)).join("\n");
  if (c.contains("doc-recitals")) return [...el.children].map((p) => "> " + TEXTE_BLOC(p)).join("\n\n");
  if (c.contains("doc-enact")) return "**" + t + "**";
  if (c.contains("doc-article")) {
    const lignes = [];
    const tete = el.querySelector(".doc-article-head");
    if (tete) lignes.push("## " + TEXTE_BLOC(tete));
    const mention = el.querySelector(".doc-amend-mention");
    if (mention) lignes.push("*" + TEXTE_BLOC(mention) + "*");
    for (const b of el.children) {
      if (b === tete || b === mention) continue;
      const md = markdownDeBloc(b);
      if (md) lignes.push(md);
    }
    return lignes.join("\n\n");
  }
  if (c.contains("doc-table-wrap")) {
    const tete = el.querySelector("thead tr");
    const colonnes = tete ? [...tete.children].map((x) => TEXTE_BLOC(x)) : [];
    if (!colonnes.length) return t;
    const lignes = ["| " + colonnes.join(" | ") + " |", "| " + colonnes.map(() => "---").join(" | ") + " |"];
    for (const tr of el.querySelectorAll("tbody tr")) lignes.push("| " + [...tr.children].map((x) => TEXTE_BLOC(x)).join(" | ") + " |");
    return (el.querySelector(".doc-table-caption") ? "**" + TEXTE_BLOC(el.querySelector(".doc-table-caption")) + "**\n\n" : "") + lignes.join("\n");
  }
  if (c.contains("doc-list")) return [...el.children].map((li, i) => (el.tagName === "OL" ? (i + 1) + ". " : "- ") + TEXTE_BLOC(li)).join("\n");
  if (c.contains("doc-quote")) return [...el.children].map((x) => "> " + TEXTE_BLOC(x)).join("\n\n");
  if (c.contains("doc-signature")) return "*" + t.replace(/\s*·\s*/, " — ") + "*";
  if (c.contains("doc-mention") || c.contains("doc-amend-mention")) return "> " + t;
  if (c.contains("doc-p")) return t;
  // Bloc inconnu : son texte, ou celui de ses enfants.
  if (t) return t;
  return [...el.children].map((x) => markdownDeBloc(x)).filter(Boolean).join("\n\n");
}

// L'en-tête Markdown d'un acte : son titre, ses métadonnées, et le rappel que
// seul l'original signé fait foi.
function enteteMarkdown(rec) {
  const objet = String(rec.objet || "").trim();
  const titre = objet ? objet.charAt(0).toUpperCase() + objet.slice(1) : (rec.numero || "Acte");
  return [
    `# ${titre}${rec.numero ? " (n°" + rec.numero + ")" : ""}`,
    "",
    [rec.entityName, rec.recueil].filter(Boolean).join(" · "),
    "",
    `- Identifiant ELI : \`${rec.eliUri || "—"}\``,
    rec.themeLabel ? `- Thème : ${rec.themeLabel}` : "",
    `- Date de l'acte : ${rec.dateDocument ? formatDate(rec.dateDocument, "date-long") : "—"}`,
    `- Publié le : ${rec.datePublication ? formatDate(rec.datePublication, "date-long") : "—"}`,
    rec.juridique === false
      ? "- Document non opposable : publié pour être porté à la connaissance de tous, il ne crée ni droits ni obligations, et aucune entrée en vigueur ne s'y attache."
      : `- Entrée en vigueur : ${rec.dateOpposabilite ? formatDate(rec.dateOpposabilite, "date-long") : "—"}`,
    `- Adresse : ${adresseActe(rec.cle)}`,
    "",
    "---",
    "",
    "Seul l'original signé fait foi ; le texte ci-dessous est la version diffusée en ligne.",
  ].join("\n");
}


// Le certificat de transmission au contrôle de légalité, déposé sur le
// document : le recueil le porte sous l'acte, comme la version en ligne. Une
// transmission SIMULÉE (aucun appel sortant) porte sa mention qualifiée — voir
// src/lib/legalite.js et NC-IV-004 / P-19.
export function mentionDeTransmission(t) {
  if (!t) return "";
  const mention = t.mention || (t.certificat && t.certificat.mention) || "";
  if (!mention) return "";
  const simule = t.demonstration === true || (t.certificat && t.certificat.demonstration === true);
  const qualifie = simule && !/démonstration/i.test(mention) ? mention + " (transmission simulée, sans appel sortant)" : mention;
  return qualifie + (t.reference ? ` — réf. ${t.reference}` : "");
}
