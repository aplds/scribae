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
import { styleForDoc } from "./styles.js";
import { documentCss } from "./export.js";
import { A4_WIDTH, A4_HEIGHT, A4_MARGIN, A4_BREAK_CSS } from "./paper.js";

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
  // Jeton d'API de démonstration. En exploitation, chaque application cliente
  // reçoit son propre jeton et seule son empreinte est conservée côté service.
  jetonDemonstration: "ak_demo_19de0ff93719f8484db433a0106aa022e034891defb1fd92",
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
    // Le déploiement auto-hébergé peut fournir le jeton d'écriture de l'API de
    // signature (voir src/server/web/host.js) ; sinon celui du référentiel, et
    // à défaut le jeton de démonstration.
    jetonDemonstration: globalThis.__SCRIBA_API_TOKEN__ || p.jetonDemonstration || DEFAULT_PUBLICATION.jetonDemonstration,
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

export function parseEliUri(uri) {
  const m = String(uri || "").match(/^eli:\/fr\/(.+)$/);
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
  if (!t || !t.mention) return "";
  const ref = t.reference ? `<span class="ref">réf. ${esc(t.reference)}` + (t.sceau ? ` — sceau ${esc(String(t.sceau).slice(0, 24))}…` : "") + `</span>` : "";
  return `<div class="transmis"><strong>Contrôle de légalité</strong>${esc(t.mention)}${ref ? "<br>" + ref : ""}</div>`;
}

// La page publiée : c'est le document déposé sur le service de publication.
// Autonome (CSS inclus), elle reste lisible même sortie de l'application.
export function buildWebVersion({ doc, config, record }) {
  const settings = publicationSettings(config);
  const brand = config.brand || {};
  const r = record || {};
  const style = styleForDoc(config, doc);
  const body = doc ? renderDocument(doc, config, { style, abrogations: true }).outerHTML : (r.bodyHtml || "");
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
.eli{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.78rem;word-break:break-all}
.side{background:#fff;border:1px solid #d5dbe4;border-radius:4px;padding:14px 16px;font-size:.85rem;margin-bottom:14px}
.side h3{margin:0 0 8px;font-size:.95rem}
.side dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:2px 10px}
.side dt{color:#5a6472}
.side dd{margin:0}
.oppo{border-left:4px solid #0b5a2b;background:#f2f8f4;padding:10px 12px;border-radius:3px;margin:0 0 14px}
.oppo strong{display:block;font-size:.95rem}
.formats{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.formats span{border:1px solid #c7cfdb;border-radius:3px;padding:2px 7px;font-size:.76rem;color:#3a3a3a}
/* Le corps de l'acte est habillé par sa charte graphique (feuille de style) :
   mêmes règles que le HTML autonome et le PDF — la version en ligne ne se
   présente pas autrement que l'acte imprimé. */
${documentCss(config, style)}
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
</div></div>
<div class="crumb">Accueil &rsaquo; Actes administratifs &rsaquo; ${esc(r.themeLabel || "")}${r.themeLabel ? " &rsaquo; " : ""}${esc(r.nature || "")} &rsaquo; ${esc(r.numero || "")} <span class="eli">(${esc(r.eliUri || "")})</span></div>
<div class="main"><div class="grid">
  <div class="paper"><div class="doc">${body}</div>${transmissionBlock(r)}</div>
  <div class="pub-aside">
    <div class="side">
      <h3>Publication</h3>
      <dl>
        <dt>Recueil</dt><dd>${esc(r.recueil || settings.recueil)}</dd>
        <dt>Publié le</dt><dd>${esc(dlong(r.datePublication))}</dd>
        <dt>${r.kind === "consolidee" ? "Texte consolidé au" : "Signé le"}</dt><dd>${esc(dlong(r.dateDocument))}</dd>
        <dt>Auteur</dt><dd>${esc(r.auteur || "")}</dd>
        ${r.themeLabel ? `<dt>Thème</dt><dd>${esc(r.themeLabel)}</dd>` : ""}
        <dt>ELI</dt><dd class="eli">${esc(r.eliUri || "")}</dd>
      </dl>
      <div class="formats">${formatLinks.map(([l]) => `<span>${esc(l)}</span>`).join("")}</div>
    </div>
    <div class="oppo">
      <strong>Opposabilité</strong>
      Entrée en vigueur : ${esc(dlong(r.dateOpposabilite))}<br>
      <span style="font-size:.8rem;color:#3a3a3a">${esc(r.opposabiliteRule || "")}</span>
    </div>
    <div class="side">
      <h3>${r.kind === "consolidee" ? "Version consolidée" : "Original"}</h3>
      <p style="margin:0">${r.kind === "consolidee"
        ? `Texte de l'acte à jour des modifications publiées, diffusé à titre informatif. L'acte d'origine signé reste consultable sous le même identifiant ELI (versions antérieures).`
        : `L'acte signé est conservé et consultable : <span class="eli">${esc(String(r.originalSha256 || "").slice(0, 24))}…</span>`}</p>
    </div>
  </div>
</div></div>
<div class="foot">Version en ligne générée depuis l'acte signé. Seul l'original signé fait foi ; cette version est diffusée à titre informatif.</div>
</body></html>`;
}

// ------------------------------------------------------------------ JSON-LD

export function publicationJsonLd(record) {
  const r = record || {};
  return JSON.stringify({
    "@context": {
      eli: "http://data.europa.eu/eli/ontology#",
      schema: "https://schema.org/",
      dcterms: "http://purl.org/dc/terms/",
    },
    "@type": "eli:LegalResource",
    "@id": r.eliUri,
    "eli:title": r.title || "",
    "eli:id_local": r.numero || "",
    "eli:type_document": r.actTypeId || "",
    "eli:date_document": r.dateDocument || "",
    "eli:date_publication": r.datePublication || "",
    "eli:first_date_entry_in_force": r.dateOpposabilite || "",
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
    "schema:legislationIdentifier": r.numero || "",
    "eli:signature": r.signature ? {
      "eli:signatory": r.signature.signataires || [],
      "eli:date": r.signature.signeLe || "",
      "eli:algorithm": r.signature.algorithme || "",
      "eli:digest": r.originalSha256 || "",
    } : undefined,
  }, null, 2);
}
