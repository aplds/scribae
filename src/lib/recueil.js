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
import { formatDate } from "./util.js";

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
    kind: r.kind || "originale",
    enVigueur: r.latest !== false,
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
    `- Entrée en vigueur : ${rec.dateOpposabilite ? formatDate(rec.dateOpposabilite, "date-long") : "—"}`,
    `- Adresse : ${adresseActe(rec.cle)}`,
    "",
    "---",
    "",
    "Seul l'original signé fait foi ; le texte ci-dessous est la version diffusée en ligne.",
  ].join("\n");
}


// Le certificat de transmission au contrôle de légalité, déposé sur le
// document : le recueil le porte sous l'acte, comme la version en ligne.
export function mentionDeTransmission(t) {
  if (!t || !t.mention) return "";
  return t.reference ? `${t.mention} — réf. ${t.reference}` : t.mention;
}
