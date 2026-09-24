// ============================================================================
// ELI (European Legislation Identifier) et version en ligne.
//
// La publication produit trois choses indissociables :
//   • une **version en ligne** de l'acte (page web autonome, style recueil
//     officiel), déposée sur le service de publication ;
//   • un **identifiant ELI** qui nomme l'acte de façon stable et citable, et
//     une URL à laquelle la version en ligne répond ;
//   • les **dates** qui font l'opposabilité : date de signature (l'acte),
//     date de publication (le dépôt au recueil) et date d'entrée en vigueur
//     (au lendemain de la publication, par défaut).
//
// L'original signé reste consultable : l'identifiant ELI désigne le texte
// consolidé, la manifestation « original signé » désigne la pièce signée.
// ============================================================================

import { renderDocument } from "./render.js";
import { formatDate } from "./util.js";
import { A4_WIDTH, A4_HEIGHT, A4_MARGIN, A4_BREAK_CSS } from "./paper.js";
import { cleService } from "./cle-service.js";
import { LICENCE_DEFAUT, CSS_DOCUMENT_WEB } from "./recueil.js";
import { qualificationSignature } from "./qualification-signature.js";

const ELI_CODES = {
  decision: "dec",
  reglement: "reg",
  deliberation: "delib",
  arrete: "arr",
  note: "note",
  convention: "conv",
};

export const DEFAULT_PUBLICATION = {
  recueil: "Recueil des actes administratifs",
  opposabilite: { mode: "lendemain", jours: 1 },
  // Publication AUTOMATIQUE au recueil : dès le retour de signature, un acte
  // publiable est publié (et devient opposable). Éteinte, l'acte signé s'arrête
  // au registre : c'est le réglage d'une administration qui publie dans son
  // propre système, et n'attend pas de recueil de cette application.
  auto: true,
  // Clé d'écriture du service : elle n'est JAMAIS inscrite ici (le code est
  // public). Elle vient du déploiement (`__SCRIBA_API_TOKEN__`) ou du réglage
  // local de persistance, remis au porteur par src/lib/cle-service.js.
  jetonDemonstration: "",
  prestataire: {
    nom: "ESUP-Signature (simulation)",
    baseUrl: "https://signature.valmont-sur-loire.fr/api/v1",
    niveau: "signature avancée — certificat de démonstration",
  },
};

export function publicationSettings(config) {
  const p = (config && config.publication) || {};
  return {
    ...DEFAULT_PUBLICATION,
    ...p,
    // La clé d'écriture ne se règle ni dans le référentiel (partagé) ni ici :
    // elle vient du déploiement ou du réglage local du poste (voir
    // src/lib/cle-service.js). Le champ garde son nom pour les appelants.
    jetonDemonstration: cleService(),
    opposabilite: { ...DEFAULT_PUBLICATION.opposabilite, ...(p.opposabilite || {}) },
    prestataire: { ...DEFAULT_PUBLICATION.prestataire, ...(p.prestataire || {}) },
  };
}

function eliCode(config, actTypeId) {
  const t = (config?.actTypes || []).find((x) => x.id === actTypeId);
  if (t?.eliCode) return t.eliCode;
  return ELI_CODES[actTypeId] || String(actTypeId || "acte").slice(0, 4);
}

// ELI « colonne » : eli:/fr/dec/2026/0401/iam
export function eliUri({ config, actTypeId, numero, entityCode, year }) {
  const seq = (String(numero || "").match(/^(\d{4})-(\d+)/) || [])[2] || String(config?.numbering?.seq || "");
  const y = year || (String(numero || "").match(/^(\d{4})/) || [])[1] || config?.numbering?.year || new Date().getFullYear();
  const parts = [eliCode(config, actTypeId), y, String(seq).padStart(4, "0"), String(entityCode || "").toLowerCase()].filter(Boolean);
  return "eli:/fr/" + parts.join("/");
}

// L'identifiant ELI et son ADRESSE ne sont pas la même chose, et le nommer sans
// ambiguïté évite la confusion (NC-IV-003, P-18) :
//   • l'IDENTIFIANT est la forme « eli:/fr/… » — une clé STABLE, non résoluble
//     telle quelle ; c'est elle qui sert de repère interne et d'`@id` de travail ;
//   • l'ADRESSE est l'URI HTTP(S) dérivée sous la base publique — c'est elle qui
//     se cite, se partage et se résout, et c'est elle que porte le `FRBRuri` du
//     document Akoma Ntoso (voir src/lib/export.js).
export const eliIdentifiant = (v) => String(v || "").trim();

export function eliAdresse({ config, eliUri } = {}) {
  const base = String((config && config.brand && config.brand.baseUri) || "").replace(/\/+$/, "");
  const id = String(eliUri || "").trim();
  if (!base || !/^eli:\/fr\//i.test(id)) return "";
  return base + "/eli/" + id.replace(/^eli:\/fr\//i, "");
}

export function parseEliUri(uri) {  const m = String(uri || "").match(/^eli:\/fr\/(.+)$/);
  if (!m) return null;
  const [code, year, seq, ...rest] = m[1].split("/");
  return { code, year, seq, entity: rest.join("/") };
}

// Les URL construites depuis le référentiel peuvent contenir un segment « eli »
// en double selon la valeur de baseUri : on normalise avant publication.
export function normalizeUrl(u) {
  return String(u || "")
    .replace(/([^:/])\/{2,}/g, "$1/")
    .replace(/\/eli\/eli\//g, "/eli/")
    .replace(/\/+$/, "");
}

// Date d'opposabilité : « au lendemain de la publication » (règle par défaut),
// ou après un nombre de jours fixé par le référentiel.
export function opposability(datePublication, settings = DEFAULT_PUBLICATION) {
  if (!datePublication) return "";
  const d = new Date(datePublication + "T12:00:00Z");
  if (isNaN(d.getTime())) return "";
  const days = settings.opposabilite?.mode === "jours" ? Math.max(0, Number(settings.opposabilite.jours) || 0) : 1;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function opposabilityRule(settings = DEFAULT_PUBLICATION) {
  return settings.opposabilite?.mode === "jours"
    ? `${settings.opposabilite.jours || 0} jour(s) après la publication`
    : "le lendemain de la publication";
}

// ------------------------------------------------------------- version en ligne

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const dlong = (x) => (x ? formatDate(x, "date-long") : "—");

// Certificat de transmission au contrôle de légalité, DÉPOSÉ SUR LE DOCUMENT :
// l'acte publié porte la mention délivrée par l'API d'envoi. C'est la marque de
// l'étape qui s'est intercalée entre la signature et la publication.
function transmissionBlock(r) {
  const t = r.transmission;
  if (!t) return "";
  const mention = t.mention || (t.certificat && t.certificat.mention) || "";
  if (!mention) return "";
  const simule = t.demonstration === true || (t.certificat && t.certificat.demonstration === true);
  const ref = t.reference ? `<span class="ref">réf. ${esc(t.reference)}` + (t.sceau || (t.certificat && t.certificat.sceau) ? ` — sceau ${esc(String(t.sceau || t.certificat.sceau).slice(0, 24))}…` : "") + `</span>` : "";
  return `<div class="transmis"><strong>Contrôle de légalité</strong>${simule ? "<span class=\"transmis-simule\">simulation</span>" : ""}${esc(mention)}${ref ? "<br>" + ref : ""}</div>`;
}

// LA QUALIFICATION DE LA SIGNATURE, déposée avec le document publié. Un acte
// signé « en simple » (dans l'application, avec un compte) n'a pas la valeur
// d'une signature qualifiée : le dire sur l'acte publié est la seule position
// tenable tant qu'aucun prestataire qualifié n'est branché (NC-IV-001). La
// mention est rendue DANS le document — comme le certificat de transmission —,
// donc elle s'imprime avec lui, au lieu de rester dans une colonne latérale que
// l'impression écarte.
function signatureBlock(r) {
  const sig = r.signature || {};
  const q = qualificationSignature({
    niveau: sig.niveau,
    simule: r.signatureSimulee === true || !!(sig.prestataire && sig.prestataire.demonstration),
    prestataire: sig.prestataire,
  });
  if (!q.mention) return "";
  return `<div class="signature${q.avertissement ? " signature--avertissement" : ""}">`
    + `<strong>${esc(q.label || "Signature")}</strong>${esc(q.mention)}</div>`;
}

// La page publiée : c'est le document déposé sur le service de publication.
// Autonome (CSS inclus), elle reste lisible même sortie de l'application.
export function buildWebVersion({ doc, config, record }) {
  const settings = publicationSettings(config);
  const brand = config.brand || {};
  const r = record || {};
  // Publication INFORMATIVE : le texte consolidé d'un RÈGLEMENT, publié pour
  // lui-même à titre d'information. Sa page autonome ne se présente donc pas
  // comme celle d'un acte : pas d'opposabilité, pas de « publié le », pas de
  // renvoi à un original signé — c'est la décision d'adoption qui fait foi.
  const info = r.informative === true;
  // DOCUMENT NON JURIDIQUE (verbatim d'assemblée, déclaration, vœu) : publié au
  // recueil, mais sans portée juridique propre — donc sans opposabilité, sans
  // entrée en vigueur et sans délai de recours. La page le dit à sa place, au
  // lieu de la mention d'opposabilité.
  const nonJuridique = r.juridique === false;
  // Version CONSOLIDÉE : elle ne remplace pas l'original signé, qui seul fait
  // foi. Le renvoi à l'original est un lien ELI (« eli:/fr/… ») : l'application
  // comme le service le traduisent en ADRESSE de l'acte visé (voir
  // src/lib/recueil.js, `resoudreLiensEli`, et src/server/mysql/actes.mjs). Un
  // identifiant que le recueil ne connaît pas y reste une simple mention.
  const versionOrigine = (r.versions || []).find((v) => v && v.kind === "originale" && v.eliUri) || null;
  const lienOrigine = versionOrigine
    ? `<a href="${esc(versionOrigine.eliUri)}">${esc([versionOrigine.numero ? "n° " + versionOrigine.numero : "l'acte d'origine", versionOrigine.dateDocument ? "du " + dlong(versionOrigine.dateDocument) : ""].filter(Boolean).join(" "))}</a>`
    : "l'acte d'origine";
  // La version en ligne ne suit PAS la charte de l'entité : elle suit la
  // FEUILLE DE STYLE WEB (voir `CSS_DOCUMENT_WEB`, lib/recueil.js). Deux
  // entités aux chartes différentes — logo, police, filets, couleurs — doivent
  // présenter leurs actes à l'identique sur l'interface publique. La charte
  // habille le PAPIER (aperçu, PDF, Word, PDF/A) ; la page publiée suit la
  // cohérence du recueil. D'où `sheet: false` : le document est rendu sans
  // `data-sheet`, sans l'en-tête ni le pied de la charte.
  const body = doc ? renderDocument(doc, config, { sheet: false, abrogations: true }).outerHTML : (r.bodyHtml || "");
  const formatLinks = [
    ["HTML", "text/html"],
    ["Akoma Ntoso", "application/akn+xml"],
    ["JSON-LD", "application/ld+json"],
    ["Original signé", "application/vnd.actes.original-signe+json"],
  ];
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="eli" content="${esc(r.eliUri || "")}">
<meta name="dcterms.date" content="${esc(r.datePublication || "")}">
<title>${esc(r.title || r.numero || "Acte")} — ${esc(brand.name || "")}</title>
<style>
:root{--brand:${esc(brand.color || "#000091")};--ink:#161616}
*{box-sizing:border-box}
body{margin:0;background:#f5f6f8;color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.5}
a{color:var(--brand)}
.hdr{background:#fff;border-bottom:1px solid #d5dbe4}
.hdr__in{max-width:calc(${A4_WIDTH} + 354px);margin:0 auto;padding:12px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.hdr__mark{font-weight:700}
.hdr__rep{font-size:.82rem;color:#5a6472}
.crumb{max-width:calc(${A4_WIDTH} + 354px);margin:0 auto;padding:8px 18px;font-size:.8rem;color:#5a6472}
.main{max-width:calc(${A4_WIDTH} + 354px);margin:0 auto;padding:0 18px 60px}
.grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;align-items:start}
@media(max-width:820px){.grid{grid-template-columns:1fr}}
.paper{width:100%;background:#fff;padding:${A4_MARGIN};box-shadow:0 1px 3px rgba(0,0,0,.1)}
/* La colonne de gauche vaut exactement 21 cm (voir la largeur du gabarit) :
   c'est alors une véritable feuille A4, et elle prend la hauteur du papier.
   En deçà, la page reste fluide — un A4 écrasé serait illisible. */
@media(min-width:1180px){.paper{min-height:${A4_HEIGHT}}}
@media(max-width:820px){.paper{padding:20px 18px}}
.badge{display:inline-block;background:#e7edf7;color:var(--brand);border-radius:4px;padding:2px 8px;font-size:.76rem;font-weight:600}
/* Publication RÉSERVÉE AUX AGENTS (circulaire interne) : la page le dit à sa
   place, pour qu'un lecteur connecté sache pourquoi elle n'est pas au recueil
   public. Voir src/server/mysql/actes.mjs (le drapeau reserve). */
.badge--reserve{background:#fdecea;color:#8a1c10}
.reserve{border-left:4px solid #8a1c10;background:#fdf1f0;padding:10px 12px;border-radius:3px;margin:0 0 14px}
.reserve strong{display:block;font-size:.95rem}
.eli{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.78rem;word-break:break-all}
.side{background:#fff;border:1px solid #d5dbe4;border-radius:4px;padding:14px 16px;font-size:.85rem;margin-bottom:14px}
.side h3{margin:0 0 8px;font-size:.95rem}
.side dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:2px 10px}
.side dt{color:#5a6472}
.side dd{margin:0}
/* La liste des annexes : des intitulés longs (et des ELI) qui doivent se replier
   plutôt que déborder de la colonne. */
.side ul{margin:0;padding-left:18px}
.side li{margin:2px 0;overflow-wrap:anywhere}
.oppo{border-left:4px solid #0b5a2b;background:#f2f8f4;padding:10px 12px;border-radius:3px;margin:0 0 14px}
.oppo strong{display:block;font-size:.95rem}
/* Un document non juridique (verbatim, déclaration, vœu) : publié, mais sans
   opposabilité. Le bandeau reste, sa couleur dit qu'il n'y a rien à exécuter. */
.oppo--doc{border-left-color:#5a6472;background:#f7f8fa}
.formats{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.formats span{border:1px solid #c7cfdb;border-radius:3px;padding:2px 7px;font-size:.76rem;color:#3a3a3a}
/* Le corps de l'acte porte la FEUILLE DE STYLE WEB de la version en ligne : la
   charte graphique de l'entité n'est PAS appliquée ici (voir CSS_DOCUMENT_WEB,
   lib/recueil.js). Deux entités qui suivent deux chartes différentes
   présentent leurs actes à l'identique sur l'interface publique ; la charte,
   elle, habille le papier (aperçu, PDF, Word, PDF/A). */
${CSS_DOCUMENT_WEB}
/* Les marques de la version consolidée sont propres à la publication. */
.doc ins{background:#e8f6ec;text-decoration:none;box-shadow:inset 0 0 0 1px #b8e0c4}
.doc del{background:#fbeceb;box-shadow:inset 0 0 0 1px #f0c9c7;color:#7a7a7a}
/* Articles abrogés : la version en ligne conserve leur ancienne rédaction (le
   recueil la révèle sur demande, « Afficher les articles abrogés »), mais la
   page publiée et son impression ne la montrent pas d'elles-mêmes. */
.doc-article--abroge .doc-abroge-corps{display:none}
@media print{.doc-article--abroge .doc-abroge-corps{display:none!important}}
.foot{max-width:calc(${A4_WIDTH} + 354px);margin:0 auto;padding:14px 18px;color:#5a6472;font-size:.78rem}
/* Certificat de transmission au contrôle de légalité, déposé sur le document. */
.transmis{margin-top:1.6em;border-left:4px solid var(--brand);background:#f4f6fb;padding:10px 12px;border-radius:3px;font-size:.84rem}
.transmis strong{display:block;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;color:#3a3a3a}
.transmis .ref{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.76rem;color:#5a6472}
.transmis .transmis-simule{display:inline-block;margin-left:6px;padding:0 6px;border-radius:3px;background:#fdecea;color:#8a1c10;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em}
/* La qualification de la signature, portée par l'acte publié lui-même (voir
   \`signatureBlock\`) : elle s'imprime avec le document, et sa couleur dit
   qu'elle demande l'attention du lecteur (signature non qualifiée, ou
   prestataire simulé). */
.signature{margin-top:1.2em;border-left:4px solid var(--brand);background:#f4f6fb;padding:10px 12px;border-radius:3px;font-size:.84rem}
.signature strong{display:block;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;color:#3a3a3a}
.signature--avertissement{border-left-color:#8a6d10;background:#fdf8ea}
/* Un acte cité par son identifiant ELI : le service résout le lien vers l'acte,
   quand il est publié au recueil ; sinon la mention reste, soulignée de pointillés
   et non cliquable (voir src/server/mysql/actes.mjs, resoudreLiensEli). */
.recueil-lien-eli--hors{border-bottom:1px dotted #c7cfdb;cursor:help;text-decoration:none}
/* Impression de la version en ligne : seule la page de l'acte est imprimée,
   sur A4 — mêmes marges que le document d'origine, donc mêmes sauts de page. */
${A4_BREAK_CSS}
@media print{
  body{background:#fff}
  .hdr,.crumb,.pub-aside,.foot{display:none!important}
  .main{max-width:none;padding:0}
  .grid{display:block}
  .paper{width:auto;min-height:0;padding:0;box-shadow:none}
}
</style></head><body>
<div class="hdr"><div class="hdr__in">
  <span class="hdr__mark">${esc(brand.name || "")}</span>
  <span class="hdr__rep">${esc(r.recueil || settings.recueil)}</span>
  <span class="badge">${esc(r.nature || "Acte")} ${esc(r.numero || "")}</span>
  ${r.reserve ? `<span class="badge badge--reserve">Diffusion réservée aux agents</span>` : ""}
</div></div>
<div class="crumb">Accueil &rsaquo; ${info ? "Règlements" : nonJuridique ? "Documents" : "Actes administratifs"} &rsaquo; ${esc(r.themeLabel || "")}${r.themeLabel ? " &rsaquo; " : ""}${esc(r.nature || "")}${r.numero ? " &rsaquo; " + esc(r.numero) : ""} <span class="eli">(${esc(r.eliUri || "")})</span></div>
<div class="main">${r.reserve ? `<div class="reserve"><strong>Diffusion réservée aux agents</strong>Cet acte est publié au recueil, mais sa diffusion est restreinte : il n'est montré qu'aux personnes connectées. Il ne figure pas dans la liste publique des actes, ni dans les index ouverts (recueil.json, llms.txt, sitemap.xml).</div>` : ""}<div class="grid">
  <div class="paper doc-web"><div class="doc">${body}</div>${signatureBlock(r)}${transmissionBlock(r)}</div>
  <div class="pub-aside">
    <div class="side">
      <h3>Publication</h3>
      <dl>
        ${info ? `<dt>Texte</dt><dd>${esc(r.nature || "Règlement")}</dd>
        <dt>Adopté par</dt><dd>${esc([r.adoption && r.adoption.designation, r.adoption && r.adoption.numero ? "n° " + r.adoption.numero : "", r.adoption && r.adoption.date ? "du " + dlong(r.adoption.date) : ""].filter(Boolean).join(" ") || "—")}</dd>
        <dt>Date du texte</dt><dd>${esc(dlong(r.dateDocument))}</dd>` : `<dt>Recueil</dt><dd>${esc(r.recueil || settings.recueil)}</dd>
        <dt>Publié le</dt><dd>${esc(dlong(r.datePublication))}</dd>
        <dt>${r.kind === "consolidee" ? "Texte consolidé au" : "Signé le"}</dt><dd>${esc(dlong(r.dateDocument))}</dd>
        <dt>Auteur</dt><dd>${esc(r.auteur || "")}</dd>`}
        ${r.themeLabel ? `<dt>Thème</dt><dd>${esc(r.themeLabel)}</dd>` : ""}
        <dt>ELI</dt><dd class="eli">${esc(r.eliUri || "")}</dd>
      </dl>
      <div class="formats">${formatLinks.map(([l]) => `<span>${esc(l)}</span>`).join("")}</div>
    </div>
    ${info ? `<div class="side"><h3>Texte informatif</h3>
      <p style="margin:0">Ce texte est publié A TITRE INFORMATIF. Il n'est pas signé et ne se publie pas pour lui-même : il tient son autorité de la décision qui l'adopte, dont l'original signé est suivi de son texte. Seule cette décision fait foi.</p>
    </div>` : nonJuridique ? `<div class="oppo oppo--doc">
      <strong>Document non opposable</strong>
      Ce document est publié au recueil pour être porté à la connaissance de tous — c'est un <em>${esc(r.natureDoc === "verbatim" ? "verbatim de séance" : r.natureDoc === "declaration" ? "texte de déclaration" : r.natureDoc === "voeu" ? "vœu de l'assemblée" : "document")}</em>. Il n'a pas de portée juridique propre : il ne crée ni droits ni obligations, aucune entrée en vigueur ne s'y attache, et aucun délai de recours ne court à compter de sa publication.
    </div>` : `<div class="oppo">
      <strong>${r.kind === "consolidee" ? "Version consolidée — ne fait pas foi" : "Opposabilité"}</strong>
      ${r.kind === "consolidee"
        ? `Ce texte réunit le texte d'origine et ses modifications publiées : il est diffusé à titre informatif et <strong>ne fait pas foi</strong>. L'opposabilité et la date d'entrée en vigueur sont celles de l'acte d'origine modifié, ${lienOrigine} : c'est son original signé qui peut être opposé.`
        : `Entrée en vigueur : ${esc(dlong(r.dateOpposabilite))}<br>
      <span style="font-size:.8rem;color:#3a3a3a">${esc(r.opposabiliteRule || "")}</span>`}
    </div>`}
    ${r.adoption ? `<div class="side"><h3>Annexe</h3>
      <p style="margin:0">Document adopté par <strong>${esc(r.adoption.designation || "un acte")} n° ${esc(r.adoption.numero || "—")}</strong>${r.adoption.date ? ` du ${esc(dlong(r.adoption.date))}` : ""}. Il tient son autorité de cet acte d'adoption, dont l'original signé est suivi de son texte.</p>
      ${r.adoption.eli ? `<p class="eli" style="margin:6px 0 0">${esc(r.adoption.eli)}</p>` : ""}
    </div>` : ""}
    ${(r.annexes || []).length ? `<div class="side"><h3>Annexes</h3>
      <p style="margin:0 0 6px">Documents adoptés par cet acte : leur texte suit l'acte dans l'original signé.</p>
      <ul style="margin:0;padding-left:18px">
        ${r.annexes.map((a) => `<li>${esc(a.designation || "Annexe")} n° ${esc(a.numero || "—")}${a.date ? ` du ${esc(dlong(a.date))}` : ""}${a.objet ? ` — ${esc(a.objet)}` : ""}${a.eli ? ` <span class="eli">${esc(a.eli)}</span>` : ""}</li>`).join("")}
      </ul>
    </div>` : ""}
    <div class="side">
      <h3>${info ? "Texte informatif" : r.kind === "consolidee" ? "Version consolidée" : (r.originalExterne && r.originalExterne.url ? "Original signé (version signée)" : "Original")}</h3>
      <p style="margin:0">${info
        ? `Ce texte n'a pas d'original signé à lui : il tient son autorité de la décision qui l'adopte, dont l'original signé est suivi de son texte. Seule cette décision fait foi.`
        : r.originalExterne && r.originalExterne.url
        ? `L'acte a été signé hors de l'application. <a href="${esc(r.originalExterne.url)}" target="_blank" rel="noopener">Ouvrir la version signée (PDF)</a> — c'est elle qui fait foi, telle qu'elle a été mise en ligne.${r.originalExterne.certification && r.originalExterne.certification.statut === "conforme" ? `<br><span style="font-size:.84rem">Conformité certifiée${r.originalExterne.certification.parNom ? " par " + esc(r.originalExterne.certification.parNom) : ""}${r.originalExterne.certification.le ? " le " + esc(dlong(r.originalExterne.certification.le)) : ""}.</span>` : ""}`
        : r.kind === "consolidee"
          ? `Texte à jour des modifications publiées, diffusé à titre informatif : <strong>il ne fait pas foi</strong>. La pièce de référence est l'original signé de l'acte d'origine modifié, ${lienOrigine}, conservé sous le même identifiant ELI — c'est lui qui peut être opposé, et les versions antérieures restent consultables.`
          : `L'acte signé est conservé et consultable : <span class="eli">${esc(String(r.originalSha256 || "").slice(0, 24))}…</span>`}</p>
    </div>
  </div>
</div></div>
<div class="foot">${info ? "Texte publié à titre informatif. Il n'est pas signé : seule la décision qui l'adopte fait foi, et son original signé est suivi de son texte." : "Version en ligne générée depuis l'acte signé. Seul l'original signé fait foi ; cette version est diffusée à titre informatif."}</div>
</body></html>`;
}

// ------------------------------------------------------------------ JSON-LD

export function publicationJsonLd(record) {
  const r = record || {};
  // Les conditions de réutilisation font partie de la publication : le JSON-LD
  // les porte dans le vocabulaire Dublin Core, à côté du reste (CRPA art.
  // L. 322-1). À défaut de licence réglée, la Licence Ouverte 2.0 s'applique.
  const licence = r.licence || LICENCE_DEFAUT;
  const qual = qualificationSignature({
    niveau: (r.signature || {}).niveau,
    simule: r.signatureSimulee === true || !!((r.signature || {}).prestataire && (r.signature || {}).prestataire.demonstration),
    prestataire: (r.signature || {}).prestataire,
  });
  return JSON.stringify({
    "@context": {
      eli: "http://data.europa.eu/eli/ontology#",
      schema: "https://schema.org/",
      dcterms: "http://purl.org/dc/terms/",
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    },
    "@type": "eli:LegalResource",
    "@id": r.eliUri,
    // L'URI HTTP canonique de la ressource : c'est elle qu'un système tiers
    // peut suivre (l'ELI « eli:/fr/… » est un identifiant, pas une adresse).
    "eli:uri": r.url || undefined,
    "eli:title": r.title || "",
    "eli:id_local": r.numero || "",
    "eli:type_document": r.actTypeId || "",
    "eli:date_document": r.dateDocument || "",
    "eli:date_publication": r.datePublication || "",
    // Un document non juridique (verbatim, déclaration, vœu) n'a pas d'entrée en
    // vigueur : la clé est alors OMISE, plutôt que publiée vide — un consommateur
    // du JSON-LD ne doit pas lire une date d'entrée en vigueur qui n'existe pas.
    "eli:first_date_entry_in_force": r.dateOpposabilite || undefined,
    "eli:published_in": { "@type": "eli:OfficialJournal", "dcterms:title": r.recueil || "" },
    "eli:passed_by": { "@id": r.entityId || undefined, "schema:name": r.entityName || "" },
    "eli:jurisdiction": "FR",
    "eli:language": "fra",
    "eli:is_realized_by": [
      { "@type": "eli:Format", "eli:format": "text/html", "eli:language": "fra" },
      { "@type": "eli:Format", "eli:format": "application/akn+xml", "eli:language": "fra" },
      { "@type": "eli:Format", "eli:format": "application/vnd.actes.original-signe+json", "eli:language": "fra" },
    ],
    "eli:related_to": (r.versions || []).map((v) => ({ "@id": v.eliUri || undefined, "eli:date_document": v.dateDocument, "dcterms:description": v.label })),
    "dcterms:description": r.objet || "",
    "dcterms:subject": r.themeLabel ? { "dcterms:title": r.themeLabel } : undefined,
    "dcterms:creator": { "@type": "schema:Organization", "schema:name": r.brandName || "" },
    "dcterms:license": { "@id": licence.url, "dcterms:title": licence.nom, "rdfs:comment": licence.mention },
    "schema:legislationIdentifier": r.numero || "",
    "eli:signature": r.signature ? {
      "eli:signatory": r.signature.signataires || [],
      "eli:date": r.signature.signeLe || "",
      "eli:algorithm": r.signature.algorithme || "",
      "eli:digest": r.originalSha256 || "",
      // Le NIVEAU de la signature, et la phrase qui le qualifie : un acte signé
      // « en simple » ne doit pas se faire passer pour qualifié, même lu par une
      // machine (voir src/lib/qualification-signature.js, NC-IV-001).
      "eli:signature_level": qual.niveau || undefined,
      "dcterms:description": qual.mention || undefined,
    } : undefined,
  }, null, 2);
}
