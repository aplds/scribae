// ============================================================================
// LE BULLETIN (ou Journal) des actes — le vocabulaire des cadences, les
// réglages, et les adresses publiques.
//
// Le recueil publie ses actes au fil de l'eau ; le bulletin les RASSEMBLE par
// PÉRIODE et les diffuse : une sous-page du recueil par numéro, un flux RSS et
// Atom, un courriel aux abonnés. Une période EST un bulletin, et s'il n'y a
// aucune publication sur la période, il n'y a pas de bulletin.
//
// LA CADENCE est une UNITÉ et un PAS (« toutes les N unités ») ; les cadences
// NOMMÉES (« mensuelle », « trimestrielle »…) ne sont que des raccourcis de
// lecture. Ce vocabulaire recopie celui du service
// (`src/server/mysql/bulletins.mjs`, qui en est la source de vérité) : le paquet
// du service est déployé SEUL dans l'image Docker (voir src/server/README.md),
// et rien du navigateur ne peut l'importer.
//
// Le client ne CALCULE aucune période : ce sont les libellés, la période en
// cours et la prochaine parution que le SERVICE rend (`GET /v1/bulletins` et
// `/v1/bulletins/administration/tableau`). Ici, on ne fait que nommer les
// cadences et bâtir les adresses — une seule fois, pour tout l'écran.
// ============================================================================
import { autoHeberge, basePublique } from "./recueil.js";

// Les cadences nommées, dans l'ordre où on les propose. `resume` décrit la
// découpe, parce que c'est elle qu'un administrateur veut lire (« deux bulletins
// par mois, du 1er au 15 puis du 16 au dernier jour ») — pas le mot.
export const CADENCES_BULLETIN = [
  { id: "quotidienne", label: "Quotidienne", unite: "jour", pas: 1, resume: "un bulletin par jour" },
  { id: "hebdomadaire", label: "Hebdomadaire", unite: "semaine", pas: 1, resume: "un bulletin par semaine, du lundi au dimanche" },
  { id: "bimensuelle", label: "Bimensuelle (deux par mois)", unite: "demi-mois", pas: 1, resume: "deux bulletins par mois : du 1er au 15, puis du 16 au dernier jour" },
  { id: "mensuelle", label: "Mensuelle", unite: "mois", pas: 1, resume: "un bulletin par mois civil" },
  { id: "bimestrielle", label: "Bimestrielle (tous les deux mois)", unite: "mois", pas: 2, resume: "un bulletin tous les deux mois" },
  { id: "trimestrielle", label: "Trimestrielle", unite: "trimestre", pas: 1, resume: "un bulletin par trimestre" },
  { id: "semestrielle", label: "Semestrielle", unite: "mois", pas: 6, resume: "un bulletin tous les six mois" },
  { id: "annuelle", label: "Annuelle", unite: "an", pas: 1, resume: "un bulletin par an" },
  { id: "personnalisee", label: "Personnalisée", unite: "", pas: 0, resume: "toutes les N unités, au choix" },
];

// Les unités qu'une cadence personnalisée peut employer. Le demi-mois est
// toujours d'un pas de 1 : il n'existe pas de « demi-mois de quinze jours » —
// la découpe est 1→15, puis 16→fin.
export const UNITES_BULLETIN = [
  { id: "jour", label: "jours", singulier: "jour" },
  { id: "semaine", label: "semaines", singulier: "semaine" },
  { id: "demi-mois", label: "demi-mois", singulier: "demi-mois" },
  { id: "mois", label: "mois", singulier: "mois" },
  { id: "trimestre", label: "trimestres", singulier: "trimestre" },
  { id: "an", label: "années", singulier: "année" },
];

export const cadenceParId = (id) => CADENCES_BULLETIN.find((c) => c.id === String(id || "").trim().toLowerCase()) || null;
export const cadenceLabel = (id) => (cadenceParId(id) || {}).label || "Personnalisée";
export const uniteLabel = (id) => (UNITES_BULLETIN.find((u) => u.id === id) || {}).label || String(id || "");

// La cadence telle que le moteur l'emploie : `{ id, unite, pas, ancre }`. Une
// cadence illisible rend `null` — l'appelant décide alors quoi faire (l'écran
// retombe sur « mensuelle », le service aussi).
export function normaliserCadence(v) {
  if (!v) return null;
  const brut = typeof v === "string" ? { id: v } : v;
  const nommee = cadenceParId(brut.id || brut.cadence || brut.mode);
  const personnalisee = !nommee || nommee.id === "personnalisee";
  const unite = personnalisee ? String(brut.unite || "").trim().toLowerCase() : nommee.unite;
  if (!UNITES_BULLETIN.some((u) => u.id === unite)) return null;
  const n = Number(personnalisee ? (brut.pas === undefined || brut.pas === "" ? 1 : brut.pas) : nommee.pas);
  const pas = unite === "demi-mois" ? (n === 1 ? 1 : 0) : (Number.isInteger(n) && n >= 1 && n <= 60 ? n : 0);
  if (!pas) return null;
  const ancre = /^\d{4}-\d{2}-\d{2}$/.test(String(brut.ancre || "")) ? String(brut.ancre) : "";
  return { id: nommee ? nommee.id : "personnalisee", unite, pas, ancre };
}

// La cadence, en une phrase : « toutes les 2 semaines », « un bulletin par
// mois civil ». C'est ce qu'on affiche quand on ne peut pas montrer le menu.
export function libelleCadence(cadence) {
  const c = normaliserCadence(cadence);
  if (!c) return "Cadence illisible";
  const nommee = cadenceParId(c.id);
  if (nommee && nommee.id !== "personnalisee") return nommee.resume;
  const u = UNITES_BULLETIN.find((x) => x.id === c.unite) || { label: c.unite, singulier: c.unite };
  return c.pas === 1 ? "un bulletin par " + u.singulier : "un bulletin toutes les " + c.pas + " " + u.label;
}

// LES RÉGLAGES EFFECTIFS du bulletin, lus dans le référentiel. Les valeurs par
// défaut sont celles du schéma (voir src/lib/schema.js) : ce lecteur ne fait que
// les rendre lisibles, sans jamais inventer un réglage qui n'existe pas.
export function bulletinReglages(config) {
  const b = (config && config.publication && config.publication.bulletin) || {};
  const jours = Number(b.parutionJours);
  return {
    actif: b.actif === true,
    titre: String(b.titre || "").trim() || "Bulletin des actes administratifs",
    titreBulletin: String(b.titreBulletin || "").trim(),
    sousTitre: String(b.sousTitre || "").trim(),
    cadence: normaliserCadence(b.cadence) || normaliserCadence("mensuelle"),
    parutionJours: Number.isInteger(jours) ? Math.max(0, Math.min(31, jours)) : 1,
    entete: String(b.entete || "").trim(),
    pied: String(b.pied || "").trim(),
    expediteurNom: String(b.expediteurNom || "").trim(),
    repondreA: String(b.repondreA || "").trim(),
  };
}

// Le titre d'un numéro, tel que le service le compose : un gabarit, un rang, et
// la période. On le dit ici pour que l'aperçu de l'écran d'administration dise
// exactement ce que le service produira.
export function titreBulletin(reglages, rang, libelle) {
  const base = String((reglages && reglages.titreBulletin) || (reglages && reglages.titre) || "Bulletin").trim();
  return `${base} n° ${rang} — ${libelle}`;
}

// --------------------------------------------------------------- les adresses
// Sur un déploiement serveur, le bulletin est une SOUS-PAGE du recueil
// (`/recueil/bulletins`) ; dans la page de démonstration, c'est une sous-page de
// l'espace public (`?page=bulletins`). Les deux se répondent, comme pour les
// actes (voir src/lib/recueil.js).
export const adresseBulletins = () => (autoHeberge()
  ? basePublique() + "/recueil/bulletins"
  : basePublique() + "?page=bulletins");

export const adresseBulletin = (id) => (autoHeberge()
  ? adresseBulletins() + "/" + encodeURIComponent(id)
  : basePublique() + "?bulletin=" + encodeURIComponent(id));

// L'adresse d'une représentation d'un numéro (JSON, Markdown, texte). Elle suit
// exactement la règle des actes (voir src/lib/recueil.js, `urlFormat`) : un
// FICHIER sur un déploiement serveur, un PARAMÈTRE de format dans la page
// ailleurs. Sans cela, l'adresse statique d'un bulletin se terminerait par
// « ?bulletin=2026-09-01.md » — un identifiant illisible.
export const adresseBulletinFichier = (id, ext) => (autoHeberge()
  ? adresseBulletin(id) + "." + ext
  : basePublique() + "?bulletin=" + encodeURIComponent(id) + "&format=" + ext);

// L'adresse à SUIVRE depuis la page elle-même : relative, elle ne quitte jamais
// le cadre. C'est celle des liens ; `adresseBulletin` est celle qu'on copie.
export const hrefBulletinFichier = (id, ext) => (autoHeberge()
  ? adresseBulletin(id) + "." + ext
  : location.pathname + "?bulletin=" + encodeURIComponent(id) + "&format=" + ext);

// Le flux des numéros : deux écritures du même fil (les lecteurs de flux ne
// parlent pas tous la même langue). Le service les sert ; la démonstration les
// rend aussi, à sa façon.
export const adresseFluxBulletin = (mode = "rss") => (autoHeberge()
  ? adresseBulletins() + (mode === "atom" ? ".atom" : ".rss")
  : basePublique() + "?bulletins=" + (mode === "atom" ? "atom" : "rss"));

// Le flux qu'on SUIT (lien de la page), par opposition à celui qu'on cite.
export const hrefFluxBulletin = (mode = "rss") => (autoHeberge()
  ? adresseBulletins() + (mode === "atom" ? ".atom" : ".rss")
  : location.pathname + "?bulletins=" + (mode === "atom" ? "atom" : "rss"));

// L'adresse à SUIVRE depuis la page publique elle-même : relative, elle ne
// quitte jamais le cadre. C'est celle des liens ; `adresseBulletin` est celle
// qu'on copie et qu'on cite.
export const hrefBulletins = () => (autoHeberge() ? "/recueil/bulletins" : location.pathname + "?page=bulletins");
export const hrefBulletin = (id) => (autoHeberge()
  ? "/recueil/bulletins/" + encodeURIComponent(id)
  : location.pathname + "?bulletin=" + encodeURIComponent(id));

// L'état d'un abonné, en clair. La double confirmation se lit ainsi :
// « attente » = le courriel de confirmation est parti, l'abonnement n'est pas
// encore actif.
export const ETATS_ABONNE = {
  attente: { label: "En attente de confirmation", badge: "warning" },
  confirme: { label: "Abonné", badge: "success" },
  retire: { label: "Désabonné", badge: "info" },
};
export const etatAbonneLabel = (etat) => (ETATS_ABONNE[etat] || {}).label || String(etat || "");
export const etatAbonneBadge = (etat) => (ETATS_ABONNE[etat] || {}).badge || "info";
