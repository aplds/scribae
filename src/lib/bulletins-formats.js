// ============================================================================
// Les représentations d'un bulletin : texte, Markdown, JSON, et le FLUX.
//
// Elles existent ici pour la même raison que celles des actes (voir
// src/lib/recueil.js, `texteDePublication`) : sur un déploiement AUTO-HÉBERGÉ,
// c'est le service qui sert les fichiers — /recueil/bulletins/<id>.md,
// /recueil/bulletins.rss — et l'application ne les rend jamais elle-même. Mais
// la page de démonstration n'a pas de serveur : ses adresses passent par des
// PARAMÈTRES (« ?bulletin=<id>&format=md », « ?bulletins=rss »), et il faut
// alors que quelqu'un compose la représentation. C'est ce module.
//
// LA SOURCE DE VÉRITÉ RESTE LE SERVICE (src/server/mysql/bulletins.mjs,
// `texteBulletin`, `markdownBulletin`, `flux`) : ce fichier en est le miroir, et
// toute retouche du format se fait là-bas d'abord, ici ensuite. Deux raisons de
// ne pas fusionner : le paquet du service est déployé seul dans l'image Docker
// (il n'importe rien du navigateur), et la page, elle, n'a pas de serveur pour
// lui répondre.
// ============================================================================
import { formatDate } from "./util.js";

// « 5 septembre 2026 » : la même écriture que le service (`dateLongue`).
export const dateLongue = (iso) => formatDate(iso, "date-long");

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// La date courte d'un intervalle : le mois ne s'écrit qu'une fois quand les deux
// bornes le partagent — « du 1er au 30 septembre 2026 ». `annee: false` la retire,
// pour l'intervalle qui change d'année (« du 29 septembre au 5 octobre 2026 »).
const jourCourt = (iso, annee = true) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!m) return String(iso || "");
  const jour = Number(m[3]) === 1 ? "1er" : String(Number(m[3]));
  return jour + " " + MOIS_FR[Number(m[2]) - 1] + (annee ? " " + m[1] : "");
};

// L'intervalle d'une période, en clair. Miroir de `intervalleTexte` du service.
export function intervalleDeBulletin(debut, fin) {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(debut || "").trim());
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fin || "").trim());
  if (!a || !b) return "";
  if (debut === fin) return "du " + dateLongue(debut);
  const memeMois = a[1] === b[1] && a[2] === b[2];
  const premier = memeMois ? jourCourt(debut) : jourCourt(debut, a[1] !== b[1]);
  return "du " + premier + " au " + dateLongue(fin);
}

// Le titre d'un acte dans une liste : son numéro, puis son objet.
export const titreActe = (a) => [a.numero, a.objet].filter(Boolean).join(" — ") || String(a.cle || "");

const lignesDActe = (a, { base = "" } = {}) => {
  const l = ["    • " + titreActe(a) + (a.remplacee ? " (version consolidée)" : "")];
  const d = [
    a.datePublication ? "publié le " + dateLongue(a.datePublication) : "",
    a.dateOpposabilite ? "en vigueur le " + dateLongue(a.dateOpposabilite) : (a.juridique === false ? "document non opposable" : ""),
    a.eliUri ? "ELI " + a.eliUri : "",
  ].filter(Boolean).join(" · ");
  if (d) l.push("      " + d);
  if (base && a.cle) l.push("      " + base + "?acte=" + encodeURIComponent(a.cle));
  return l;
};

// Le texte d'un numéro : la forme que lit un agent, un lecteur d'écran, ou un
// courriel qui n'accepte pas le HTML.
export function texteDeBulletin(b, { lien = "", base = "" } = {}) {
  const l = [b.titre, ""];
  if (b.sousTitre) l.push(b.sousTitre, "");
  l.push("Période : " + intervalleDeBulletin(b.debut, b.fin), "");
  if (!b.nombre) l.push("Aucun acte n'a été publié sur cette période.", "");
  for (const e of b.entites || []) {
    l.push(String(e.nom || "").toUpperCase(), "");
    for (const t of e.themes || []) {
      l.push("  " + t.label);
      for (const a of t.actes || []) l.push(...lignesDActe(a, { base }));
      l.push("");
    }
  }
  if (lien) l.push("Bulletin en ligne : " + lien, "");
  if (b.pied) l.push(b.pied, "");
  return l.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// Le Markdown : la même structure, avec les titres que les moteurs et les agents
// savent lire.
export function markdownDeBulletin(b, { lien = "" } = {}) {
  const l = ["# " + b.titre, "", "_" + intervalleDeBulletin(b.debut, b.fin) + " · " + b.nombre + " acte" + (b.nombre > 1 ? "s" : "") + "_", ""];
  if (b.sousTitre) l.push(b.sousTitre, "");
  if (!b.nombre) l.push("Aucun acte n'a été publié sur cette période.", "");
  for (const e of b.entites || []) {
    l.push("## " + e.nom, "");
    for (const t of e.themes || []) {
      l.push("### " + t.label, "");
      for (const a of t.actes || []) {
        const meta = [
          a.datePublication ? "publié le " + dateLongue(a.datePublication) : "",
          a.dateOpposabilite ? "en vigueur le " + dateLongue(a.dateOpposabilite) : "",
          a.remplacee ? "version consolidée" : "",
        ].filter(Boolean).join(" · ");
        l.push("- " + titreActe(a) + (meta ? " — _" + meta + "_" : "") + (a.eliUri ? " (`" + a.eliUri + "`)" : ""));
      }
      l.push("");
    }
  }
  if (lien) l.push("Bulletin en ligne : " + lien, "");
  return l.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// Le JSON d'un numéro : exactement ce que le service rend à son adresse
// (/v1/bulletins/<id>), c'est-à-dire ce qu'un agent reçoit. Rien de plus.
export const jsonDeBulletin = (b) => JSON.stringify(b, null, 2) + "\n";

// ----------------------------------------------------------------- le flux
// RSS 2.0 et Atom 1.0 : deux écritures du même fil, parce que les lecteurs de
// flux ne parlent pas tous la même langue. Chaque entrée est UN NUMÉRO — c'est
// la parution, et non l'acte, que l'on suit.
const xml = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const resumeDeFlux = (b) => {
  const tete = intervalleDeBulletin(b.debut, b.fin) + " — " + b.nombre + " acte" + (b.nombre > 1 ? "s" : "") + ".";
  const actes = [];
  for (const e of b.entites || []) for (const t of e.themes || []) for (const a of t.actes || []) actes.push(titreActe(a));
  return [tete].concat(actes.slice(0, 12)).concat(actes.length > 12 ? ["…"] : []).join(" ");
};

const dateRfc = (iso) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toUTCString();
};

// `recs` : les numéros EN ENTIER, du plus récent au plus ancien (le service les
// rend ainsi), sans les provisoires.
export function fluxDeBulletins(recs, { titre = "", sousTitre = "", base = "", mode = "rss", maj = "" } = {}) {
  const adresse = String(base || "").replace(/\/+$/, "") + "?page=bulletins";
  const items = (recs || []).filter((b) => b && !b.provisoire);
  const date = maj || (items[0] && items[0].composeLe) || new Date().toISOString();
  const sous = sousTitre || "Les actes administratifs publiés, rassemblés par période.";
  const lienDe = (b) => String(base || "").replace(/\/+$/, "") + "?bulletin=" + encodeURIComponent(b.id);
  if (mode === "atom") {
    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xml(titre)}</title>
  <subtitle>${xml(sous)}</subtitle>
  <link href="${xml(String(base || "").replace(/\/+$/, "") + "?bulletins=atom")}" rel="self" type="application/atom+xml"/>
  <link href="${xml(adresse)}" rel="alternate" type="text/html"/>
  <id>${xml(adresse)}</id>
  <updated>${xml(date)}</updated>
  <generator>Scribae</generator>
${items.map((b) => `  <entry>
    <title>${xml(b.titre)}</title>
    <link href="${xml(lienDe(b))}"/>
    <id>${xml(lienDe(b))}</id>
    <updated>${xml(b.composeLe || date)}</updated>
    <published>${xml(b.composeLe || date)}</published>
    <summary type="text">${xml(resumeDeFlux(b))}</summary>
    <content type="text">${xml(texteDeBulletin(b, { lien: lienDe(b) }))}</content>
  </entry>`).join("\n")}
</feed>
`;
  }
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${xml(titre)}</title>
  <link>${xml(adresse)}</link>
  <description>${xml(sous)}</description>
  <language>fr</language>
  <lastBuildDate>${xml(dateRfc(date))}</lastBuildDate>
  <generator>Scribae</generator>
  <ttl>720</ttl>
  <atom:link href="${xml(String(base || "").replace(/\/+$/, "") + "?bulletins=rss")}" rel="self" type="application/rss+xml"/>
${items.map((b) => `  <item>
    <title>${xml(b.titre)}</title>
    <link>${xml(lienDe(b))}</link>
    <guid isPermaLink="true">${xml(lienDe(b))}</guid>
    <pubDate>${xml(dateRfc(b.composeLe || date))}</pubDate>
    <description>${xml(resumeDeFlux(b))}</description>
  </item>`).join("\n")}
</channel>
</rss>
`;
}
