// ============================================================================
// Bulletins — le Journal (ou Bulletin) officiel des actes administratifs.
//
// Un recueil publie ses actes un par un, au fil de l'eau. Un JOURNAL les
// RASSEMBLE : c'est la forme sous laquelle une collectivité porte ses actes à
// la connaissance de tous « en un seul document », à une cadence régulière — la
// forme d'un bulletin officiel, du bulletin municipal, du journal officiel de
// la collectivité.
//
// Le bulletin se définit par une CADENCE, qui découpe le temps en PÉRIODES :
// quotidienne, hebdomadaire, bimensuelle (deux par mois), mensuelle,
// bimestrielle, trimestrielle, semestrielle, annuelle — ou personnalisée (tous
// les N jours, semaines, demi-mois, mois, trimestres, années). Une période EST
// un bulletin : son identifiant est sa date de début, si bien que composer deux
// fois la même période ne crée jamais deux bulletins.
//
// Trois règles font le comportement, et elles sont volontairement simples :
//
//   1. un bulletin ne couvre QUE sa période : les publications dont la date de
//      publication tombe dans l'intervalle [début, fin] ;
//   2. S'IL N'Y A AUCUNE PUBLICATION, IL N'Y A PAS DE BULLETIN — la période est
//      marquée « vide » et ne sera plus examinée ;
//   3. un acte publié deux fois dans la même période (une version consolidée)
//      ne figure qu'une fois : c'est la dernière version de la période qui est
//      listée, les précédentes sont signalées comme remplacées.
//
// À l'intérieur du bulletin, les actes sont CLASSÉS PAR ENTITÉ, puis par
// thématique : c'est l'ordre de lecture d'un journal officiel — d'abord qui a
// pris l'acte, puis de quoi il traite.
//
// Le bulletin se diffuse par trois canaux, et les trois viennent d'ici :
//
//   • une SOUS-PAGE du recueil public, une par bulletin (`/recueil/bulletins/<id>`) ;
//   • un FLUX RSS 2.0 et Atom 1.0 (`/recueil/bulletins.rss`, `.atom`) ;
//   • un COURRIEL aux abonnés, par le serveur SMTP de la collectivité, avec le
//     lien de désabonnement propre à chacun.
//
// Ce module est PUR : il ne connaît ni Node, ni MySQL, ni le réseau. Tout lui est
// INJECTÉ —
//
//   state    l'état mutable du service (`state.bulletins` : abonnés, périodes)
//   sha256   une empreinte SHA-256 (jetons d'abonnement, empreinte du bulletin)
//   alea     un tirage aléatoire (le secret qui sert aux jetons)
//   now      l'horloge
//   save     la persistance : renvoie false si la capacité est dépassée
//   reglages une fonction asynchrone qui rend les réglages EFFECTIFS (titre,
//            cadence, activation) — le service les lit là où l'administration
//            les a écrits
//   courriel l'envoi (`courriel.mjs`), ou null (aucun SMTP : l'envoi est alors
//            refusé, et TRACÉ, jamais silencieux)
//   tracer   une ligne au journal des courriels (voir server.mjs, sb_courriel)
//   publications  une fonction qui rend les publications du service, dans la
//            forme attendue par le composeur (voir server.mjs)
//
// Le service HTTP (`server.mjs`) ne fait que traduire : c'est ce qui garantit
// que le recueil servi et le bulletin composé parlent d'une seule voix.
// ============================================================================

import { dateRfc } from "./smtp.mjs";

const SERVICE = "Service de signature et de publication";

export const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// ---------------------------------------------------------------- les cadences
// Une cadence est décrite par une UNITÉ et un PAS : « toutes les N unités ». Les
// cadences nommées ne sont que des raccourcis de lecture — l'administration voit
// « Mensuelle », et le moteur, lui, compte des mois. La cadence PERSONNALISÉE
// ouvre les autres combinaisons sans qu'il faille en livrer une par cas.
//
// `demi-mois` découpe un mois en deux périodes (1er → 15, 16 → fin) : c'est la
// « bimensuelle » des journaux officiels, celle qui paraît deux fois par mois.
export const CADENCES = [
  { id: "quotidienne", label: "Quotidienne", unite: "jour", pas: 1, resume: "un bulletin par jour" },
  { id: "hebdomadaire", label: "Hebdomadaire", unite: "semaine", pas: 1, resume: "un bulletin par semaine (du lundi au dimanche)" },
  { id: "bimensuelle", label: "Bimensuelle (deux par mois)", unite: "demi-mois", pas: 1, resume: "deux bulletins par mois (du 1er au 15, puis du 16 au dernier jour)" },
  { id: "mensuelle", label: "Mensuelle", unite: "mois", pas: 1, resume: "un bulletin par mois" },
  { id: "bimestrielle", label: "Bimestrielle (tous les deux mois)", unite: "mois", pas: 2, resume: "un bulletin tous les deux mois" },
  { id: "trimestrielle", label: "Trimestrielle", unite: "trimestre", pas: 1, resume: "un bulletin par trimestre" },
  { id: "semestrielle", label: "Semestrielle", unite: "mois", pas: 6, resume: "un bulletin tous les six mois" },
  { id: "annuelle", label: "Annuelle", unite: "an", pas: 1, resume: "un bulletin par an" },
  { id: "personnalisee", label: "Personnalisée", unite: "", pas: 0, resume: "toutes les N unités (jours, semaines, demi-mois, mois, trimestres, années)" },
];

export const UNITES = [
  { id: "jour", label: "jours", singulier: "jour" },
  { id: "semaine", label: "semaines", singulier: "semaine" },
  { id: "demi-mois", label: "demi-mois", singulier: "demi-mois" },
  { id: "mois", label: "mois", singulier: "mois" },
  { id: "trimestre", label: "trimestres", singulier: "trimestre" },
  { id: "an", label: "années", singulier: "année" },
];

export const cadenceParId = (id) => CADENCES.find((c) => c.id === String(id || "").trim().toLowerCase()) || null;

// Le pas accepté pour une unité : un entier de 1 à 60, et TOUJOURS 1 pour le
// demi-mois (il n'existe pas de « demi-mois de 15 jours » : la découpe est
// 1→15 puis 16→fin). Un pas refusé rend 0, et la cadence est déclarée illisible
// plutôt que d'inventer une découpe.
function pasAccepte(unite, pas) {
  if (!UNITES.some((u) => u.id === unite)) return 0;
  const n = Number(pas);
  if (unite === "demi-mois") return n === 1 ? 1 : 0;
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : 0;
}

// La cadence NORMALISÉE : celle que le moteur emploie, et que le client reçoit.
// Une cadence illisible rend `null` ; l'appelant décide alors quoi faire (le
// service, lui, retombe sur « mensuelle »).
export function normaliserCadence(v) {
  if (!v) return null;
  const brut = typeof v === "string" ? { id: v } : v;
  const nommee = cadenceParId(brut.id || brut.cadence || brut.mode);
  const personnalisee = !nommee || nommee.id === "personnalisee";
  const unite = personnalisee ? String(brut.unite || "").trim().toLowerCase() : nommee.unite;
  const pas = pasAccepte(unite, personnalisee ? (brut.pas === undefined || brut.pas === "" ? 1 : brut.pas) : nommee.pas);
  if (!pas) return null;
  const id = nommee ? nommee.id : "personnalisee";
  const ancre = /^\d{4}-\d{2}-\d{2}$/.test(String(brut.ancre || "")) ? String(brut.ancre) : "";
  return { id, unite, pas, ancre, label: (nommee || {}).label || "Personnalisée", resume: libelleCadence({ id, unite, pas }) };
}

// « un bulletin par mois », « un bulletin tous les 3 mois »… : la cadence telle
// qu'on la lit.
export function libelleCadence(c) {
  if (!c) return "";
  const nommee = cadenceParId(c.id);
  if (nommee && nommee.id !== "personnalisee") return nommee.resume;
  const u = UNITES.find((x) => x.id === c.unite) || { label: c.unite, singulier: c.unite };
  return c.pas === 1 ? "un bulletin par " + u.singulier : "un bulletin tous les " + c.pas + " " + u.label;
}

// ------------------------------------------------------------------- les dates
// Tout est calculé sur des dates ISO (« 2026-09-01 ») et en UTC : un bulletin ne
// doit pas changer de période selon le fuseau du poste qui le compose.

const D = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
};
const pad = (n, l = 2) => String(n).padStart(l, "0");
export const enIso = ({ y, m, d }) => y + "-" + pad(m) + "-" + pad(d);
export const jourDe = (iso) => { const x = D(iso); return x ? enIso(x) : ""; };
const joursDansMois = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const msJour = 86400000;
const ms = (iso) => { const x = D(iso); return Date.UTC(x.y, x.m - 1, x.d); };
export const comparer = (a, b) => (String(a || "") < String(b || "") ? -1 : String(a || "") > String(b || "") ? 1 : 0);

export function ajouterJours(iso, n) {
  const x = D(iso);
  if (!x) return "";
  const t = new Date(ms(enIso(x)) + n * msJour);
  return enIso({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

export function ajouterMois(iso, n) {
  const x = D(iso);
  if (!x) return "";
  const total = x.y * 12 + (x.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return enIso({ y, m, d: Math.min(x.d, joursDansMois(y, m)) });
}

export const finDeMois = (iso) => { const x = D(iso); return enIso({ y: x.y, m: x.m, d: joursDansMois(x.y, x.m) }); };
export const premierDuMois = (iso) => { const x = D(iso); return enIso({ y: x.y, m: x.m, d: 1 }); };

// Le premier jour de l'UNITÉ qui contient la date : le début du jour, le lundi
// de la semaine, le 1er ou le 16 du mois, le 1er du mois, du trimestre, de
// l'année.
export function debutUnite(iso, unite) {
  const x = D(iso);
  if (!x) return "";
  if (unite === "jour") return enIso(x);
  if (unite === "semaine") {
    const t = new Date(ms(enIso(x)));
    return ajouterJours(enIso(x), -((t.getUTCDay() + 6) % 7));
  }
  if (unite === "demi-mois") return enIso({ y: x.y, m: x.m, d: x.d <= 15 ? 1 : 16 });
  if (unite === "mois") return enIso({ y: x.y, m: x.m, d: 1 });
  if (unite === "trimestre") return enIso({ y: x.y, m: 3 * Math.floor((x.m - 1) / 3) + 1, d: 1 });
  if (unite === "an") return enIso({ y: x.y, m: 1, d: 1 });
  return "";
}

// La seconde moitié du mois pour un début de demi-mois : 0 pour le 1→15, 1 pour
// le 16→fin. C'est ce qui permet de compter les demi-mois comme des unités.
const moitie = (iso) => (D(iso).d <= 15 ? 0 : 1);

// La distance, en unités, entre deux DÉBUTS d'unité (le second moins le premier).
export function distanceUnites(unite, a, b) {
  const x = D(a), y = D(b);
  if (!x || !y) return 0;
  const mois = (y.y - x.y) * 12 + (y.m - x.m);
  if (unite === "jour") return Math.round((ms(enIso(y)) - ms(enIso(x))) / msJour);
  if (unite === "semaine") return Math.round((ms(enIso(y)) - ms(enIso(x))) / (7 * msJour));
  if (unite === "demi-mois") return mois * 2 + (moitie(enIso(y)) - moitie(enIso(x)));
  if (unite === "mois") return mois;
  if (unite === "trimestre") return Math.round(mois / 3);
  if (unite === "an") return y.y - x.y;
  return 0;
}

// Le début du demi-mois qui suit (sens = +1) ou qui précède (sens = -1).
function demiMoisVoisin(debut, sens) {
  const x = D(debut);
  if (sens > 0) return x.d <= 15 ? enIso({ y: x.y, m: x.m, d: 16 }) : premierDuMois(ajouterMois(debut, 1));
  return x.d > 15 ? enIso({ y: x.y, m: x.m, d: 1 }) : enIso({ ...D(ajouterMois(debut, -1)), d: 16 });
}

// Un pas de N unités, en avant (N > 0) ou en arrière (N < 0), à partir d'un
// DÉBUT d'unité.
export function decaler(debut, unite, n) {
  if (!n) return debut;
  if (unite === "jour") return ajouterJours(debut, n);
  if (unite === "semaine") return ajouterJours(debut, 7 * n);
  if (unite === "mois") return ajouterMois(debut, n);
  if (unite === "trimestre") return ajouterMois(debut, 3 * n);
  if (unite === "an") return ajouterMois(debut, 12 * n);
  if (unite === "demi-mois") {
    let courant = debut;
    for (let i = 0; i < Math.abs(n); i++) courant = demiMoisVoisin(courant, n > 0 ? 1 : -1);
    return courant;
  }
  return debut;
}

// LA PÉRIODE qui contient une date. La suite des périodes est ancrée sur la date
// d'ancrage (`ancre`) : sans elle, « tous les deux mois » commencerait au mois du
// jour où l'on regarde, et la découpe changerait à chaque composition. La période
// rendue est `{ debut, fin }`, bornes INCLUSES.
export function periodeDe(iso, cadence) {
  const c = normaliserCadence(cadence);
  const jour = jourDe(iso);
  if (!c || !jour) return null;
  const ancre = debutUnite(c.ancre || jour, c.unite);
  const debut = debutUnite(jour, c.unite);
  const n = distanceUnites(c.unite, ancre, debut);
  const reste = ((n % c.pas) + c.pas) % c.pas;
  const d = reste ? decaler(debut, c.unite, -reste) : debut;
  return { debut: d, fin: ajouterJours(decaler(d, c.unite, c.pas), -1) };
}

export function periodeSuivante(periode, cadence) {
  const c = normaliserCadence(cadence);
  const debut = decaler(periode.debut, c.unite, c.pas);
  return { debut, fin: ajouterJours(decaler(debut, c.unite, c.pas), -1) };
}

export function periodePrecedente(periode, cadence) {
  const c = normaliserCadence(cadence);
  return { debut: decaler(periode.debut, c.unite, -c.pas), fin: ajouterJours(periode.debut, -1) };
}

// Une date écrite en clair, sans Intl (même rendu partout).
export function dateLongue(iso) {
  const x = D(iso);
  return x ? x.d + " " + MOIS_FR[x.m - 1] + " " + x.y : "";
}

export function dateCourte(iso, { annee = true } = {}) {
  const x = D(iso);
  if (!x) return "";
  return (x.d === 1 ? "1er" : String(x.d)) + " " + MOIS_FR[x.m - 1] + (annee ? " " + x.y : "");
}

// « du 1er au 30 septembre 2026 », « du 29 septembre au 5 octobre 2026 »,
// « du 5 septembre 2026 » (un seul jour).
export function intervalleTexte(debut, fin) {
  const a = D(debut), b = D(fin);
  if (!a || !b) return "";
  if (debut === fin) return "du " + dateCourte(debut);
  const memeMois = a.y === b.y && a.m === b.m;
  // Même mois : le mois n'est écrit qu'une fois — « du 1er au 30 septembre 2026 ».
  const premier = memeMois ? (a.d === 1 ? "1er" : String(a.d)) : dateCourte(debut, { annee: a.y !== b.y });
  return "du " + premier + " au " + dateCourte(fin);
}

// Le libellé COURT d'une période — celui qui tient dans un titre de bulletin :
// « septembre 2026 », « 1er–15 septembre 2026 », « semaine du 1er au 7 septembre
// 2026 », « 1er septembre 2026 », « 2026 ».
export function libellePeriode(periode, cadence) {
  const c = normaliserCadence(cadence);
  const a = D(periode.debut), b = D(periode.fin);
  if (!c || !a || !b) return intervalleTexte(periode.debut, periode.fin);
  if (c.unite === "an") return periode.debut.slice(0, 4);
  if (c.unite === "mois") {
    if (c.pas === 1) return MOIS_FR[a.m - 1] + " " + a.y;
    if (a.y === b.y) return MOIS_FR[a.m - 1] + "–" + MOIS_FR[b.m - 1] + " " + a.y;
    return MOIS_FR[a.m - 1] + " " + a.y + " – " + MOIS_FR[b.m - 1] + " " + b.y;
  }
  if (c.unite === "trimestre") {
    if (c.pas === 1) {
      const q = Math.floor((a.m - 1) / 3) + 1;
      return (q === 1 ? "1er" : q + "e") + " trimestre " + a.y;
    }
    if (a.y === b.y) return MOIS_FR[a.m - 1] + "–" + MOIS_FR[b.m - 1] + " " + a.y;
    return MOIS_FR[a.m - 1] + " " + a.y + " – " + MOIS_FR[b.m - 1] + " " + b.y;
  }
  if (c.unite === "demi-mois") return (a.d > 15 ? "16–" + b.d : "1er–" + b.d) + " " + MOIS_FR[a.m - 1] + " " + a.y;
  if (c.unite === "semaine") return "semaine " + intervalleTexte(periode.debut, periode.fin);
  return intervalleTexte(periode.debut, periode.fin);
}

// La date de PARUTION d'une période : le lendemain de sa fin, décalée du délai
// réglé (`parutionJours`). C'est le jour où le bulletin devient disponible.
export function dateParution(periode, { parutionJours = 1 } = {}) {
  return ajouterJours(periode.fin, Math.max(0, Number(parutionJours) || 0) + 1);
}

// ============================================================================
// L'ÉTAT DU BULLETIN
// ============================================================================
// Il vit dans l'état du service (`sb_etat`), à côté des actes et des
// publications : ce sont des données d'EXPLOITATION, et elles portent des
// adresses électroniques d'abonnés — elles n'ont donc rien à faire dans le
// référentiel, qui se recopie sur tous les postes.
export function etatBulletinsVide() {
  return {
    v: 1,
    secret: "",       // tiré au hasard : il sert à fabriquer les jetons d'abonnement
    depuis: "",       // date de mise en service : aucun bulletin n'est composé avant
    cadence: "",      // la cadence avec laquelle les périodes ont été parcourues
    periodes: {},     // { "<début>": { etat, composeLe, publieLe, envoi, bulletin } }
    abonnes: {},      // { "<id>": { id, courriel, nom, etat, creeLe, confirmeLe, ... } }
    file: [],         // livraisons en attente : { bulletin, abonne, essais, dernier, motif }
    envois: [],       // trace des dernières passes d'envoi (bornée)
  };
}

const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;

export function courrielValide(v) {
  const s = String(v || "").trim();
  return s.length >= 6 && s.length <= 190 && EMAIL.test(s) ? s : "";
}

// L'identifiant d'un abonné : l'empreinte de son adresse. Elle est stable (une
// personne qui se réabonne retrouve la même fiche) et ne révèle rien de plus que
// l'adresse elle-même, qui n'est de toute façon servie qu'à l'administration.
const idAbonne = (sha256, courriel) => "ab-" + sha256(String(courriel || "").trim().toLowerCase()).slice(0, 16);

export function createBulletins({
  state,
  sha256,
  alea = () => String(Math.random()).slice(2),
  now = () => new Date().toISOString(),
  save,
  reglages = async () => ({}),
  publications = async () => [],
  courriel = null,
  tracer = null,
  maxBulletins = 60,
  maxAbonnes = 2000,
  maxEnvoisParPasse = 40,
  maxPeriodesParPasse = 60,
  baseUrl = "",
  journal = () => {},
}) {
  let dirty = null;

  // L'état des bulletins. Il est créé À LA DEMANDE : un service dont l'état date
  // d'avant les bulletins, ou que l'administration vient de purger, n'a pas de
  // clé `bulletins` — et c'est très bien ainsi.
  function etat() {
    if (!state.bulletins || typeof state.bulletins !== "object") state.bulletins = etatBulletinsVide();
    const b = state.bulletins;
    if (!b.periodes) b.periodes = {};
    if (!b.abonnes) b.abonnes = {};
    if (!b.file) b.file = [];
    if (!b.envois) b.envois = [];
    return b;
  }

  // Le secret des jetons. Il est tiré UNE FOIS puis conservé : sans cela, les
  // liens de confirmation et de désabonnement changeraient à chaque
  // redémarrage, et les courriels déjà partis ne vaudraient plus rien. Il n'est
  // créé que par un chemin qui ÉCRIT (une passe, un abonnement, un geste
  // d'administration) — jamais par une simple lecture.
  function secret() {
    const b = etat();
    if (!b.secret) { b.secret = sha256("scribae|abonnement|" + alea(48) + "|" + nowIso()); journal("secret d'abonnement créé"); }
    return b.secret;
  }

  function persist() {
    const s = JSON.stringify(state);
    if (!save || save(s)) { dirty = s; return true; }
    return false;
  }

  const nowIso = () => String(now());
  const aujourdhui = () => nowIso().slice(0, 10);

  // --------------------------------------------------------------- réglages
  // Les réglages EFFECTIFS : ce que le référentiel dit, complété par les défauts
  // du module. Le service les lit là où l'administration les a écrits — il n'y a
  // donc pas un second jeu de réglages à tenir à jour.
  const DEFAUTS = {
    actif: false,
    titre: "Bulletin des actes administratifs",
    cadence: { id: "mensuelle" },
    parutionJours: 1,
  };
  // Le dernier état de réglages lu : il sert l'APERÇU synchrone des pages du
  // recueil (voir `apercu`), qui se rendent sans attendre.
  let cache = null;

  async function lireReglages() {
    let brut = {};
    try { brut = (await reglages()) || {}; } catch (e) { journal("réglages du bulletin illisibles : " + String((e && e.message) || e)); brut = {}; }
    const cadence = normaliserCadence(brut.cadence) || normaliserCadence(DEFAUTS.cadence);
    cache = {
      actif: brut.actif === true,
      titre: String(brut.titre || "").trim() || DEFAUTS.titre,
      titreBulletin: String(brut.titreBulletin || "").trim(),
      sousTitre: String(brut.sousTitre || "").trim(),
      cadence,
      parutionJours: Number.isInteger(Number(brut.parutionJours)) ? Math.max(0, Math.min(31, Number(brut.parutionJours))) : DEFAUTS.parutionJours,
      entete: String(brut.entete || "").trim(),
      pied: String(brut.pied || "").trim(),
      expediteurNom: String(brut.expediteurNom || "").trim(),
      repondreA: String(brut.repondreA || "").trim(),
      // L'adresse publique du recueil : c'est elle qui donne aux courriels leurs
      // liens (le service, lui, ne voit pas l'adresse du visiteur quand il
      // compose un bulletin tout seul).
      base: String(brut.base || baseUrl || "").replace(/\/+$/, ""),
    };
    return cache;
  }

  // ------------------------------------------------------------ composition
  function composer({ periode, cadence, reglages: r, publications: liste, annee, rang, provisoire }) {
    const entites = new Map();
    let total = 0;
    for (const p of liste) {
      const nom = String(p.entityName || "").trim() || "(sans entité)";
      const theme = String(p.themeLabel || "").trim() || "Autres actes";
      if (!entites.has(nom)) entites.set(nom, new Map());
      const themes = entites.get(nom);
      if (!themes.has(theme)) themes.set(theme, []);
      themes.get(theme).push({
        cle: p.cle,
        eliUri: p.eliUri || "",
        numero: p.numero || "",
        objet: p.objet || "",
        nature: p.nature || "",
        themeId: p.themeId || "",
        themeLabel: p.themeLabel || "",
        entityName: nom,
        dateDocument: p.dateDocument || "",
        datePublication: p.datePublication || "",
        dateOpposabilite: p.dateOpposabilite || "",
        kind: p.kind || "originale",
        juridique: p.juridique === false ? false : undefined,
        natureDoc: p.natureDoc || undefined,
        remplacee: (p.remplacee || 0) > 0,
        recueil: p.recueil || "",
      });
      total += 1;
    }
    const ordreTexte = (a, b) => String(a).localeCompare(String(b), "fr", { sensitivity: "base" });
    const listeEntites = [...entites.entries()]
      .filter(([, themes]) => themes.size)
      .map(([nom, themes]) => ({
        nom,
        nombre: [...themes.values()].reduce((n, l) => n + l.length, 0),
        themes: [...themes.entries()]
          .map(([label, actes]) => ({
            id: actes[0].themeId || "",
            label,
            nombre: actes.length,
            actes: actes.sort((a, b) => comparer(a.datePublication, b.datePublication) || ordreTexte(a.numero, b.numero) || ordreTexte(a.objet, b.objet)),
          }))
          .sort((a, b) => ordreTexte(a.label, b.label)),
      }))
      // Les actes sans entité ferment la marche : ils ne sont pas une rubrique,
      // seulement ce qui n'en a pas.
      .sort((a, b) => (a.nom === "(sans entité)" ? 1 : b.nom === "(sans entité)" ? -1 : ordreTexte(a.nom, b.nom)));

    const libelle = libellePeriode(periode, cadence);
    const bulletin = {
      id: periode.debut,
      debut: periode.debut,
      fin: periode.fin,
      annee,
      rang,
      cadence: cadence.id,
      titre: (r.titreBulletin || r.titre) + " n° " + rang + " — " + libelle,
      libelle,
      sousTitre: r.sousTitre,
      entete: r.entete,
      pied: r.pied,
      nombre: total,
      entites: listeEntites,
      provisoire: !!provisoire,
      composeLe: nowIso(),
      empreinte: "",
    };
    bulletin.empreinte = sha256(JSON.stringify([bulletin.id, bulletin.titre, bulletin.nombre, bulletin.entites]));
    return bulletin;
  }

  // Les publications d'une période, telles qu'elles entrent dans le bulletin :
  // la dernière version de chaque identifiant ELI (une version consolidée
  // publiée dans la période ne fait pas apparaître l'acte deux fois), et la
  // mention de ce qu'elle remplace.
  function publicationsDe(periode, liste) {
    const dedans = (liste || []).filter((p) => {
      const d = String(p.datePublication || "").slice(0, 10);
      return d >= periode.debut && d <= periode.fin;
    });
    const dernieres = new Map();
    for (const p of dedans) {
      const k = String(p.eliUri || p.cle);
      const deja = dernieres.get(k);
      if (!deja) { dernieres.set(k, { ...p, remplacee: 0 }); continue; }
      if (comparer(String(p.datePublication || ""), String(deja.datePublication || "")) >= 0) {
        dernieres.set(k, { ...p, remplacee: (deja.remplacee || 0) + 1 });
      } else {
        deja.remplacee += 1;
      }
    }
    return [...dernieres.values()];
  }

  // Le numéro du bulletin : un rang CONTINU dans l'année (« Bulletin n° 12 —
  // 2026 »), comme un journal officiel. Il est attribué à la première
  // composition de la période, et ne bouge plus.
  function rangPour(annee, debut) {
    let rang = 0;
    for (const k of Object.keys(etat().periodes)) {
      const x = etat().periodes[k];
      if (x && x.bulletin && x.bulletin.annee === annee && comparer(x.bulletin.debut, debut) < 0) rang += 1;
    }
    return rang + 1;
  }

  // Compose (ou recompose) la période demandée. Ne touche PAS aux envois : c'est
  // `programmer()` qui décide d'informer les abonnés.
  function composerPeriode(periode, r, options = {}) {
    const b = etat();
    const provisoire = !!options.provisoire;
    const annee = Number(periode.fin.slice(0, 4));
    const existante = b.periodes[periode.debut];
    const rang = (existante && existante.bulletin && existante.bulletin.rang) || rangPour(annee, periode.debut);
    const dedans = publicationsDe(periode, options.publications || []);
    if (!dedans.length) {
      // RÈGLE 2 : pas de publication, pas de bulletin. La période est marquée,
      // pour ne pas être réexaminée à chaque passe. Une recomposition PROVISOIRE
      // qui ne trouve plus rien retire le bulletin provisoire (les publications
      // ont été retirées entre-temps).
      if (provisoire && existante && existante.bulletin) { delete b.periodes[periode.debut]; return null; }
      b.periodes[periode.debut] = { etat: "vide", examineLe: nowIso() };
      return null;
    }
    const bulletin = composer({ periode, cadence: r.cadence, reglages: r, publications: dedans, annee, rang, provisoire });
    b.periodes[periode.debut] = {
      etat: provisoire ? "provisoire" : "publie",
      composeLe: (existante && existante.bulletin && existante.bulletin.composeLe) || bulletin.composeLe,
      majLe: nowIso(),
      publieLe: provisoire ? null : ((existante && existante.publieLe) || nowIso()),
      envoi: (existante && existante.envoi) || null,
      bulletin,
    };
    return bulletin;
  }

  // ----------------------------------------------- la passe automatique
  // `assurer()` est appelée au démarrage, puis à intervalle régulier (voir
  // server.mjs), et par le bouton « Générer » de l'administration. Elle clôt les
  // périodes ÉCHUES, compose celles qui ne sont plus vides, puis vide la FILE
  // D'ENVOI — c'est le seul endroit qui écrit et qui envoie.
  async function assurer() {
    const r = await lireReglages();
    const b = etat();
    const passe = { actif: r.actif, composees: [], publies: [], vides: [], envois: { total: 0, ok: 0, echecs: 0 }, motif: "" };
    if (!r.actif) { passe.motif = "Le bulletin est éteint."; return passe; }

    // LA MISE EN SERVICE. À la première passe, on remonte à la plus ancienne
    // publication que le recueil détient — un bulletin qui paraît alors couvre
    // l'histoire déjà publiée — mais pas au-delà de `maxBulletins` périodes : un
    // recueil de dix ans ne fait pas paraître cent bulletins d'un coup.
    if (b.cadence !== r.cadence.id) b.cadence = r.cadence.id;
    const liste = await publications();
    if (!b.depuis) {
      const enCours = periodeDe(aujourdhui(), r.cadence);
      const plusAncienne = liste.map((p) => String(p.datePublication || "").slice(0, 10)).filter(Boolean).sort()[0] || "";
      if (plusAncienne && enCours) {
        const debutPublication = (periodeDe(plusAncienne, r.cadence) || {}).debut || "";
        const borne = decaler(enCours.debut, r.cadence.unite, -maxBulletins * r.cadence.pas);
        b.depuis = debutPublication && comparer(debutPublication, borne) > 0 ? debutPublication : borne;
      } else {
        // Aucune publication : il n'y a rien à rassembler, et donc aucune raison
        // de parcourir des périodes vides en remontant le temps.
        b.depuis = enCours ? enCours.debut : aujourdhui();
      }
      journal("mise en service du bulletin à la période du " + b.depuis);
    }

    let periode = periodeDe(b.depuis, r.cadence);
    let parcourues = 0;
    const auj = aujourdhui();
    // On ne parcourt que des périodes ÉCHUES : un bulletin paraît quand sa
    // période est terminée (au plus tôt le lendemain, selon `parutionJours`).
    while (periode && periode.fin < auj && parcourues < maxPeriodesParPasse) {
      parcourues += 1;
      const connue = b.periodes[periode.debut];
      if (!connue || connue.etat === "provisoire") {
        const bulletin = composerPeriode(periode, r, { publications: liste, provisoire: false });
        if (bulletin) {
          passe.composees.push(bulletin.id);
          passe.publies.push(bulletin.id);
          programmerInterne(bulletin, r);
        } else if (!connue) {
          passe.vides.push(periode.debut);
        }
      }
      const suivante = periodeSuivante(periode, r.cadence);
      if (!suivante || comparer(suivante.debut, periode.debut) <= 0) break;
      periode = suivante;
    }

    passe.envois = await viderFile(r);
    const elagues = elaguer();
    if (passe.composees.length || passe.vides.length || passe.envois.total || elagues) persist();
    if (passe.composees.length) journal("bulletins composés : " + passe.composees.join(", "));
    return passe;
  }

  // La mémoire du service ne grandit pas sans fin : on ne garde que les derniers
  // bulletins (`maxBulletins`), les marques de périodes vides récentes, et les
  // fiches d'abonnés utiles. Ce qui sort n'est pas perdu — les bulletins publiés
  // restent des documents que le recueil peut resservir — mais le JOURNAL de
  // bord du service, lui, reste borné (l'état est écrit d'un bloc en base).
  function elaguer() {
    const b = etat();
    let retires = 0;
    const avecBulletin = Object.keys(b.periodes).filter((k) => b.periodes[k] && b.periodes[k].bulletin);
    if (avecBulletin.length > maxBulletins) {
      const ordonnees = avecBulletin.sort((x, y) => comparer(y, x));
      for (const k of ordonnees.slice(maxBulletins)) { delete b.periodes[k]; retires += 1; }
    }
    const vides = Object.keys(b.periodes).filter((k) => b.periodes[k] && !b.periodes[k].bulletin);
    if (vides.length > maxBulletins * 4) {
      const ordonnees = vides.sort((x, y) => comparer(y, x));
      for (const k of ordonnees.slice(maxBulletins * 4)) { delete b.periodes[k]; retires += 1; }
    }
    const fiches = Object.keys(b.abonnes);
    const actifs = fiches.filter((k) => b.abonnes[k].etat !== "retire");
    if (fiches.length > maxAbonnes * 3) {
      const retires2 = fiches.filter((k) => b.abonnes[k].etat === "retire").sort((x, y) => comparer(b.abonnes[y].desaboLe || "", b.abonnes[x].desaboLe || ""));
      for (const k of retires2.slice(Math.max(0, actifs.length))) { delete b.abonnes[k]; retires += 1; }
    }
    // Une file d'attente plus longue que la population abonnée signale des
    // livraisons devenues sans objet : on la borne.
    if (b.file.length > Math.max(1000, (actifs.length || 1) * 4)) { b.file.splice(0, b.file.length - Math.max(1000, actifs.length * 4)); retires += 1; }
    return retires;
  }

  // ---------------------------------------------------------- les abonnés
  const jeton = (genre, abonne) => sha256("scribae|" + genre + "|" + secret() + "|" + abonne).slice(0, 40);
  const lienConfirmation = (a, r) => ((r && r.base) || "") + "/recueil/bulletins/confirmation?jeton=" + encodeURIComponent(jeton("conf", a.id));
  const lienDesabonnement = (a, r) => ((r && r.base) || "") + "/recueil/bulletins/desabonnement?jeton=" + encodeURIComponent(jeton("desabo", a.id));

  function resumeAbonne(a) {
    return {
      id: a.id, courriel: a.courriel, nom: a.nom || "",
      etat: a.etat, creeLe: a.creeLe || "", confirmeLe: a.confirmeLe || "",
      desaboLe: a.desaboLe || "", source: a.source || "",
    };
  }

  // L'INSCRIPTION. Elle ne dit JAMAIS si l'adresse était déjà là : la réponse est
  // la même dans les deux cas, sinon elle servirait à savoir qui est abonné au
  // bulletin. Une adresse déjà confirmée reçoit simplement un nouveau courriel de
  // confirmation.
  async function abonner({ courriel: adresse, nom = "", ip = "", source = "recueil" }) {
    const r = await lireReglages();
    const mail = courrielValide(adresse);
    if (!mail) return { ok: false, status: 422, motif: "Cette adresse électronique n'est pas valide." };
    if (!r.actif) return { ok: false, status: 409, motif: "Le bulletin n'est pas ouvert sur ce recueil." };
    const b = etat();
    const id = idAbonne(sha256, mail);
    const existante = b.abonnes[id];
    const actifs = Object.keys(b.abonnes).filter((k) => b.abonnes[k].etat !== "retire").length;
    if (!existante && actifs >= maxAbonnes) return { ok: false, status: 507, motif: "Le nombre maximal d'abonnés est atteint sur ce service." };
    const fiche = existante || { id, courriel: mail, nom: String(nom || "").slice(0, 120), etat: "attente", creeLe: nowIso(), source: String(source || "").slice(0, 40) };
    if (nom) fiche.nom = String(nom).slice(0, 120);
    fiche.ip = String(ip || fiche.ip || "").slice(0, 64);
    if (fiche.etat !== "confirme") fiche.etat = "attente";
    b.abonnes[id] = fiche;
    const lien = lienConfirmation(fiche, r);
    // L'envoi du courriel de confirmation : c'est lui qui fait la preuve que
    // l'adresse existe et que son titulaire est d'accord.
    const envoi = await envoyerCourriel({
      destinataires: [{ courriel: fiche.courriel, nom: fiche.nom }],
      sujet: "Confirmez votre abonnement — " + r.titre,
      texte: [
        "Vous demandez à recevoir « " + r.titre + " » par courriel.",
        "",
        "Pour confirmer votre abonnement, ouvrez cette adresse :",
        lien,
        "",
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message :",
        "aucune inscription n'a lieu sans cette confirmation.",
      ].join("\n"),
      html: enveloppeHtml(r, `<p>Vous demandez à recevoir «&nbsp;<strong>${html(r.titre)}</strong>&nbsp;» par courriel.</p>
<p><a href="${html(lien)}">Confirmer mon abonnement</a></p>
<p style="color:#5a6472;font-size:13px">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : aucune inscription n'a lieu sans cette confirmation.</p>`),
      evenement: "bulletin_abonnement",
      cible: fiche.id,
    });
    persist();
    return {
      ok: true, status: 202, abonne: resumeAbonne(fiche),
      envoye: !!envoi.envoye, motif: envoi.envoye ? "" : (envoi.motif || ""),
      message: envoi.envoye
        ? "Un courriel de confirmation vient d'être envoyé à " + fiche.courriel + ". L'abonnement prend effet dès que le lien qu'il contient est ouvert."
        : "Votre demande est enregistrée, mais le courriel de confirmation n'a pas pu être envoyé" + (envoi.motif ? " (" + envoi.motif + ")" : "") + " : l'abonnement n'est pas encore actif.",
    };
  }

  // La confirmation (le lien du courriel). Un jeton inconnu ne dit rien de plus
  // qu'« invalide » : il ne révèle pas l'existence d'une fiche.
  async function confirmer(jetonRecu) {
    const b = etat();
    const j = String(jetonRecu || "").trim();
    if (!j) return { ok: false, status: 400, motif: "Jeton de confirmation absent." };
    const r = await lireReglages();
    for (const id of Object.keys(b.abonnes)) {
      const a = b.abonnes[id];
      if (!a || jeton("conf", id) !== j) continue;
      if (a.etat !== "confirme") { a.etat = "confirme"; a.confirmeLe = nowIso(); persist(); }
      return { ok: true, status: 200, abonne: resumeAbonne(a), desabonnement: r.base ? lienDesabonnement(a, r) : "" };
    }
    return { ok: false, status: 404, motif: "Ce lien de confirmation n'est plus valable." };
  }

  async function desabonner(jetonRecu) {
    const b = etat();
    const j = String(jetonRecu || "").trim();
    if (!j) return { ok: false, status: 400, motif: "Jeton de désabonnement absent." };
    for (const id of Object.keys(b.abonnes)) {
      const a = b.abonnes[id];
      if (!a || jeton("desabo", id) !== j) continue;
      a.etat = "retire";
      a.desaboLe = nowIso();
      // Les livraisons en attente de cette personne sont retirées : un
      // désabonnement qui laisserait un courriel en file serait un mensonge.
      b.file = b.file.filter((x) => x.abonne !== id);
      persist();
      return { ok: true, status: 200, abonne: resumeAbonne(a) };
    }
    return { ok: false, status: 404, motif: "Ce lien de désabonnement n'est plus valable." };
  }

  // ------------------------------------------------------------ les envois
  // Un bulletin publié est mis en file pour CHAQUE abonné confirmé : une
  // livraison à la fois, chacune portant son propre lien de désabonnement. La
  // file est vidée par `assurer()`, par petits paquets — un service qui aurait
  // 2 000 abonnés ne bloque pas son fil principal pendant une heure, et une
  // livraison refusée est réessayée à la passe suivante, puis abandonnée avec
  // son motif.
  function programmerInterne(bulletin, r) {
    const b = etat();
    const fiches = Object.keys(b.abonnes).map((k) => b.abonnes[k]).filter((a) => a && a.etat === "confirme");
    const deja = new Set(b.file.map((x) => x.abonne + "|" + x.bulletin));
    for (const a of fiches) if (!deja.has(a.id + "|" + bulletin.id)) b.file.push({ bulletin: bulletin.id, abonne: a.id, essais: 0, dernier: "", motif: "" });
    const p = b.periodes[bulletin.id];
    if (p) p.envoi = { total: fiches.length, fait: 0, echecs: 0, depuis: nowIso(), termineLe: fiches.length ? null : nowIso() };
    return fiches.length;
  }

  // Le geste d'administration : (re)mettre le bulletin en file et vider la file
  // tout de suite, pour ne pas attendre la passe suivante.
  async function programmer(bulletin) {
    const r = await lireReglages();
    const n = programmerInterne(bulletin, r);
    persist();
    return n;
  }

  // Le courriel d'un bulletin pour un abonné : le sujet, le texte, le HTML — et
  // le lien de désabonnement propre à cette personne, qui doit figurer dans
  // CHAQUE message (c'est la règle, et c'est aussi ce qui distingue un bulletin
  // d'un indésirable).
  function messageDeBulletin(bulletin, abonne, r) {
    const adresse = ((r && r.base) || "");
    const lien = adresse + "/recueil/bulletins/" + encodeURIComponent(bulletin.id);
    const rss = adresse + "/recueil/bulletins.rss";
    const desabo = lienDesabonnement(abonne, r);
    const sujet = bulletin.titre + (bulletin.nombre ? " — " + bulletin.nombre + " acte" + (bulletin.nombre > 1 ? "s" : "") : "");
    const texte = [
      texteBulletin(bulletin, { lien, base: adresse }),
      "",
      "—",
      "Vous recevez ce message parce que vous êtes abonné à « " + r.titre + " ».",
      lien ? "Lire le bulletin en ligne : " + lien : "",
      rss ? "Flux RSS : " + rss : "",
      "Se désabonner : " + desabo,
    ].filter(Boolean).join("\n");
    return {
      sujet, texte,
      html: htmlDeBulletin(bulletin, { lien, rss, desabo, r, base: adresse }),
      entetes: [
        "List-Unsubscribe: <" + desabo + ">",
        "List-Id: <" + slugId(r.titre) + ">",
        "Precedence: bulk",
      ],
    };
  }

  async function viderFile(r) {
    const b = etat();
    const passe = { total: 0, ok: 0, echecs: 0 };
    if (!b.file.length) return passe;
    // UNE TENTATIVE PAR LIVRAISON ET PAR PASSE. Une livraison qui échoue repart
    // en fin de file : elle sera réessayée à la passe SUIVANTE (le service passe
    // toutes les quelques minutes), pas dans la foulée — un serveur SMTP qui
    // refuse ne se déride pas en trois secondes. `restants` compte les livraisons
    // présentes au début de la passe : une livraison réessayée n'est donc pas
    // reprise dans la même passe, même si la file est courte.
    let restants = b.file.length;
    while (restants > 0 && passe.total < maxEnvoisParPasse && b.file.length) {
      const item = b.file.shift();
      restants -= 1;
      const periode = b.periodes[item.bulletin];
      const bulletin = periode && periode.bulletin;
      const abonne = b.abonnes[item.abonne];
      // Cas à retirer sans bruit : livraison devenue sans objet (bulletin
      // retiré, abonné désabonné ou disparu).
      if (!bulletin || !abonne || abonne.etat !== "confirme") continue;
      const message = messageDeBulletin(bulletin, abonne, r);
      const envoi = await envoyerCourriel({
        destinataires: [{ courriel: abonne.courriel, nom: abonne.nom }],
        sujet: message.sujet, texte: message.texte, html: message.html, entetes: message.entetes,
        evenement: "bulletin", cible: bulletin.id,
      });
      passe.total += 1;
      if (envoi.envoye) {
        passe.ok += 1;
        if (periode.envoi) periode.envoi.fait = (periode.envoi.fait || 0) + 1;
      } else {
        item.essais = (item.essais || 0) + 1;
        item.dernier = nowIso();
        item.motif = String(envoi.motif || "").slice(0, 200);
        // Trois tentatives, puis la livraison est ABANDONNÉE avec son motif :
        // elle reste lisible dans l'état du bulletin, et l'échec est compté.
        if (item.essais >= 3) {
          passe.echecs += 1;
          if (periode.envoi) periode.envoi.echecs = (periode.envoi.echecs || 0) + 1;
        } else {
          b.file.push(item);
        }
      }
      if (periode && periode.envoi) periode.envoi.termineLe = b.file.some((x) => x.bulletin === bulletin.id) ? null : nowIso();
    }
    if (passe.total) {
      b.envois.push({ le: nowIso(), total: passe.total, ok: passe.ok, echecs: passe.echecs });
      if (b.envois.length > 40) b.envois.splice(0, b.envois.length - 40);
      persist();
    }
    return passe;
  }

  // Le port d'envoi : toujours un objet, jamais une exception qui remonterait au
  // fil principal. Le journal des courriels est tenu par l'appelant (`tracer`),
  // qui écrit dans `sb_courriel`.
  async function envoyerCourriel({ destinataires, sujet, texte, html, entetes, evenement, cible }) {
    const r = await lireReglages();
    if (!courriel || typeof courriel.envoyer !== "function") {
      const motif = "Ce service n'a pas accès à un serveur SMTP : l'envoi par courriel n'est actif qu'avec le service auto-hébergé (SMTP_HOST).";
      if (tracer) tracer({ evenement, cible, destinataires, sujet, envoye: false, motif });
      return { envoye: false, motif };
    }
    let res;
    try {
      res = await courriel.envoyer({
        destinataires, sujet, texte, html, entetes,
        expediteurNom: r.expediteurNom || undefined,
        repondreA: r.repondreA || undefined,
      });
    } catch (e) {
      res = { envoye: false, raison: String((e && e.message) || e) };
    }
    if (tracer) tracer({ evenement, cible, destinataires, sujet, envoye: !!res.envoye, motif: res.envoye ? "" : (res.raison || "") });
    return { envoye: !!res.envoye, motif: res.envoye ? "" : (res.raison || "L'envoi a échoué.") };
  }

  // ------------------------------------------------------------- les lectures
  function liste() {
    return Object.keys(etat().periodes)
      .map((k) => etat().periodes[k])
      .filter((p) => p && p.bulletin)
      .map((p) => p.bulletin)
      .sort((a, c) => comparer(c.debut, a.debut));
  }

  function resume(bulletin) {
    const p = etat().periodes[bulletin.id] || {};
    return {
      id: bulletin.id, titre: bulletin.titre, libelle: bulletin.libelle,
      debut: bulletin.debut, fin: bulletin.fin, annee: bulletin.annee, rang: bulletin.rang,
      nombre: bulletin.nombre, provisoire: bulletin.provisoire === true,
      composeLe: bulletin.composeLe, publieLe: p.publieLe || null,
      empreinte: bulletin.empreinte,
      envoi: p.envoi || null,
      entites: (bulletin.entites || []).map((e) => ({ nom: e.nom, nombre: e.nombre })),
    };
  }

  const lire = (id) => {
    const p = etat().periodes[String(id || "")];
    return p && p.bulletin ? p.bulletin : null;
  };

  // Un APERÇU synchrone, pour les pages du recueil qui se rendent sans attendre
  // (l'accueil, le plan du site, llms.txt) : l'état du bulletin tel que la
  // dernière lecture des réglages l'a laissé. Une passe au démarrage le remplit.
  function apercu() {
    const listeB = liste();
    if (!cache || !cache.actif) return { actif: false, titre: "", sousTitre: "", cadence: null, bulletins: [], url: "", flux: { rss: "", atom: "" } };
    return {
      actif: true,
      titre: cache.titre,
      sousTitre: cache.sousTitre,
      cadence: cache.cadence,
      bulletins: listeB.slice(0, 8).map(resume),
      nombre: listeB.length,
      url: "/recueil/bulletins",
      flux: { rss: "/recueil/bulletins.rss", atom: "/recueil/bulletins.atom" },
    };
  }

  // Ce que le recueil public affiche : l'état du bulletin et ses derniers
  // numéros. `actif: false` dit au client de n'en rien montrer.
  async function publicEtat() {
    const r = await lireReglages();
    if (!r.actif) return { actif: false };
    const b = etat();
    const enCours = periodeDe(aujourdhui(), r.cadence);
    const suivante = enCours && enCours.fin >= aujourdhui() ? enCours : (enCours ? periodeSuivante(enCours, r.cadence) : null);
    const abonnementOuvert = !!(r.base) && !!(courriel && typeof courriel.envoyer === "function");
    return {
      actif: true,
      titre: r.titre,
      sousTitre: r.sousTitre,
      cadence: { id: r.cadence.id, label: r.cadence.label, resume: r.cadence.resume },
      abonnement: abonnementOuvert,
      motifAbonnement: abonnementOuvert ? "" : (r.base ? "Ce service n'a pas accès à un serveur SMTP : l'abonnement par courriel n'est pas ouvert." : "L'adresse publique du recueil n'est pas configurée (SCRIBA_PUBLIQUE_URL) : l'abonnement par courriel n'est pas ouvert."),
      prochaine: suivante ? { debut: suivante.debut, fin: suivante.fin, libelle: libellePeriode(suivante, r.cadence), parution: dateParution(suivante, r) } : null,
      bulletins: liste().map(resume),
      depuis: b.depuis || "",
    };
  }

  // L'état vu par l'administration : les réglages effectifs, ce qui reste à
  // envoyer, les abonnés, les dernières passes.
  async function tableauDeBord(base) {
    const r = await lireReglages();
    const b = etat();
    const enCours = periodeDe(aujourdhui(), r.cadence);
    const suivante = enCours && enCours.fin >= aujourdhui() ? enCours : (enCours ? periodeSuivante(enCours, r.cadence) : null);
    const etatCourriel = courriel && typeof courriel.etat === "function" ? courriel.etat() : null;
    // Le numéro de la période EN COURS, en ENTIER : c'est l'aperçu que
    // l'administration relit avant la parution, avec ses entités, ses thèmes et
    // ses actes. Il n'a pas d'adresse publique, et n'est jamais adressé.
    const apercu = liste().find((x) => x.provisoire) || null;
    return {
      actif: r.actif,
      titre: r.titre,
      titreBulletin: r.titreBulletin,
      sousTitre: r.sousTitre,
      cadence: { id: r.cadence.id, label: r.cadence.label, unite: r.cadence.unite, pas: r.cadence.pas, ancre: r.cadence.ancre, resume: r.cadence.resume },
      cadences: CADENCES.map((c) => ({ id: c.id, label: c.label, resume: c.resume })),
      unites: UNITES,
      parutionJours: r.parutionJours,
      base: r.base,
      depuis: b.depuis || "",
      cadenceAppliquee: b.cadence || "",
      prochaine: suivante ? { debut: suivante.debut, fin: suivante.fin, libelle: libellePeriode(suivante, r.cadence), parution: dateParution(suivante, r) } : null,
      periodesExaminees: Object.keys(b.periodes).length,
      bulletins: liste().length,
      // La LISTE, et pas seulement le compte : l'écran d'administration doit
      // pouvoir montrer les numéros — y compris quand le bulletin vient d'être
      // éteint, et que l'état public ne les rend plus.
      bulletinsListe: liste().map(resume),
      apercu,
      enAttente: b.file.length,
      abonnes: {
        total: Object.keys(b.abonnes).filter((k) => b.abonnes[k].etat !== "retire").length,
        confirmes: Object.keys(b.abonnes).filter((k) => b.abonnes[k].etat === "confirme").length,
        attente: Object.keys(b.abonnes).filter((k) => b.abonnes[k].etat === "attente").length,
        retires: Object.keys(b.abonnes).filter((k) => b.abonnes[k].etat === "retire").length,
      },
      abonnesListe: Object.keys(b.abonnes)
        .map((k) => b.abonnes[k])
        .sort((a, c) => comparer(c.creeLe, a.creeLe))
        .map((a) => ({ ...resumeAbonne(a), lienDesabonnement: base ? lienDesabonnement(a, r) : "" })),
      file: b.file.slice(0, 50),
      envois: b.envois.slice(-6).reverse(),
      courriel: etatCourriel,
      flux: { rss: (r.base || "") + "/recueil/bulletins.rss", atom: (r.base || "") + "/recueil/bulletins.atom" },
    };
  }

  // ------------------------------------------------------- les représentations
  // Le contenu d'un bulletin, sans mise en page : il sert la page du recueil, le
  // courriel, le Markdown et le JSON — une seule description, quatre habits.
  function texteBulletin(bulletin, { lien = "", base = "" } = {}) {
    const lignes = [bulletin.titre, ""];
    if (bulletin.sousTitre) lignes.push(bulletin.sousTitre, "");
    lignes.push("Période : " + intervalleTexte(bulletin.debut, bulletin.fin), "");
    if (!bulletin.nombre) lignes.push("Aucun acte n'a été publié sur cette période.", "");
    for (const e of bulletin.entites) {
      lignes.push(e.nom.toUpperCase(), "");
      for (const t of e.themes) {
        lignes.push("  " + t.label);
        for (const a of t.actes) {
          lignes.push("    • " + ([a.numero, a.objet].filter(Boolean).join(" — ") || a.cle) + (a.remplacee ? " (version consolidée)" : ""));
          const d = [
            a.datePublication ? "publié le " + dateLongue(a.datePublication) : "",
            a.dateOpposabilite ? "en vigueur le " + dateLongue(a.dateOpposabilite) : (a.juridique === false ? "document non opposable" : ""),
            a.eliUri ? "ELI " + a.eliUri : "",
          ].filter(Boolean).join(" · ");
          if (d) lignes.push("      " + d);
          if (base && a.cle) lignes.push("      " + base + "/recueil/" + encodeURIComponent(a.cle));
        }
        lignes.push("");
      }
    }
    if (lien) lignes.push("Bulletin en ligne : " + lien, "");
    if (bulletin.pied) lignes.push(bulletin.pied, "");
    return lignes.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function markdownBulletin(bulletin, { lien = "" } = {}) {
    const l = ["# " + bulletin.titre, "", "_" + intervalleTexte(bulletin.debut, bulletin.fin) + " · " + bulletin.nombre + " acte" + (bulletin.nombre > 1 ? "s" : "") + "_", ""];
    if (bulletin.sousTitre) l.push(bulletin.sousTitre, "");
    if (!bulletin.nombre) l.push("Aucun acte n'a été publié sur cette période.", "");
    for (const e of bulletin.entites) {
      l.push("## " + e.nom, "");
      for (const t of e.themes) {
        l.push("### " + t.label, "");
        for (const a of t.actes) {
          const titre = [a.numero, a.objet].filter(Boolean).join(" — ") || a.cle;
          const meta = [
            a.datePublication ? "publié le " + dateLongue(a.datePublication) : "",
            a.dateOpposabilite ? "en vigueur le " + dateLongue(a.dateOpposabilite) : "",
            a.remplacee ? "version consolidée" : "",
          ].filter(Boolean).join(" · ");
          l.push("- " + titre + (meta ? " — _" + meta + "_" : "") + (a.eliUri ? " (`" + a.eliUri + "`)" : ""));
        }
        l.push("");
      }
    }
    if (lien) l.push("Bulletin en ligne : " + lien, "");
    return l.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  function jsonBulletin(bulletin, { base = "" } = {}) {
    return {
      id: bulletin.id,
      titre: bulletin.titre,
      libelle: bulletin.libelle,
      sousTitre: bulletin.sousTitre || "",
      entete: bulletin.entete || "",
      pied: bulletin.pied || "",
      debut: bulletin.debut,
      fin: bulletin.fin,
      annee: bulletin.annee,
      rang: bulletin.rang,
      cadence: bulletin.cadence,
      nombre: bulletin.nombre,
      provisoire: bulletin.provisoire === true,
      composeLe: bulletin.composeLe,
      empreinte: bulletin.empreinte,
      url: base + "/recueil/bulletins/" + encodeURIComponent(bulletin.id),
      entites: (bulletin.entites || []).map((e) => ({
        nom: e.nom, nombre: e.nombre,
        themes: e.themes.map((t) => ({
          id: t.id, label: t.label, nombre: t.nombre,
          actes: t.actes.map((a) => ({
            cle: a.cle,
            eliUri: a.eliUri, numero: a.numero, objet: a.objet, nature: a.nature,
            entityName: a.entityName,
            dateDocument: a.dateDocument, datePublication: a.datePublication, dateOpposabilite: a.dateOpposabilite,
            kind: a.kind, juridique: a.juridique, natureDoc: a.natureDoc, remplacee: !!a.remplacee,
            url: base + "/recueil/" + encodeURIComponent(a.cle),
          })),
        })),
      })),
    };
  }

  // --------------------------------------------------------------- les flux
  // RSS 2.0 et Atom 1.0 : deux écritures du même fil, parce que les lecteurs de
  // flux ne parlent pas tous la même. Chaque entrée est UN BULLETIN — c'est la
  // parution, pas l'acte, que l'on suit.
  const xmlEsc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

  function resumeFlux(b) {
    const tete = intervalleTexte(b.debut, b.fin) + " — " + b.nombre + " acte" + (b.nombre > 1 ? "s" : "") + ".";
    const actes = [];
    for (const e of b.entites) for (const t of e.themes) for (const a of t.actes) actes.push([a.numero, a.objet].filter(Boolean).join(" — "));
    return [tete].concat(actes.slice(0, 12)).concat(actes.length > 12 ? ["…"] : []).join(" ");
  }

  async function flux({ base = "", limite = 20, mode = "rss" } = {}) {
    const r = await lireReglages();
    const racine = String(base || r.base || "").replace(/\/+$/, "");
    const adresse = racine + "/recueil/bulletins";
    const items = liste().filter((b) => !b.provisoire).slice(0, Math.max(1, Math.min(200, limite)));
    const maj = (items[0] && items[0].composeLe) || nowIso();
    if (mode === "atom") {
      return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xmlEsc(r.titre)}</title>
  <subtitle>${xmlEsc(r.sousTitre || "Les actes administratifs publiés, rassemblés par période.")}</subtitle>
  <link href="${xmlEsc(racine + "/recueil/bulletins.atom")}" rel="self" type="application/atom+xml"/>
  <link href="${xmlEsc(adresse)}" rel="alternate" type="text/html"/>
  <id>${xmlEsc(adresse)}</id>
  <updated>${xmlEsc(maj)}</updated>
  <generator>${xmlEsc(SERVICE)}</generator>
${items.map((b) => `  <entry>
    <title>${xmlEsc(b.titre)}</title>
    <link href="${xmlEsc(adresse + "/" + encodeURIComponent(b.id))}"/>
    <id>${xmlEsc(adresse + "/" + encodeURIComponent(b.id))}</id>
    <updated>${xmlEsc(b.composeLe)}</updated>
    <published>${xmlEsc(b.composeLe)}</published>
    <summary type="text">${xmlEsc(resumeFlux(b))}</summary>
    <content type="text">${xmlEsc(texteBulletin(b, { lien: adresse + "/" + encodeURIComponent(b.id) }))}</content>
  </entry>`).join("\n")}
</feed>
`;
    }
    return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${xmlEsc(r.titre)}</title>
  <link>${xmlEsc(adresse)}</link>
  <description>${xmlEsc(r.sousTitre || "Les actes administratifs publiés, rassemblés par période.")}</description>
  <language>fr</language>
  <lastBuildDate>${xmlEsc(dateRfc(new Date(maj)))}</lastBuildDate>
  <generator>${xmlEsc(SERVICE)}</generator>
  <ttl>720</ttl>
  <atom:link href="${xmlEsc(racine + "/recueil/bulletins.rss")}" rel="self" type="application/rss+xml"/>
${items.map((b) => `  <item>
    <title>${xmlEsc(b.titre)}</title>
    <link>${xmlEsc(adresse + "/" + encodeURIComponent(b.id))}</link>
    <guid isPermaLink="true">${xmlEsc(adresse + "/" + encodeURIComponent(b.id))}</guid>
    <pubDate>${xmlEsc(dateRfc(new Date(b.composeLe)))}</pubDate>
    <description>${xmlEsc(resumeFlux(b))}</description>
  </item>`).join("\n")}
</channel>
</rss>
`;
  }

  // ============================================================ le routage
  // Les routes du bulletin : l'état public (`/v1/bulletins`), un bulletin, et
  // les gestes — abonnement (public), confirmation et désabonnement (publics,
  // par jeton), administration (tableau de bord, génération, envoi, abonnés).
  const ok = (status, body, headers) => ({ status, headers: headers || {}, body });
  const err = (status, message, extra) => ({ status, headers: {}, body: { erreur: message, ...(extra || {}) } });

  const hEtatPublic = async () => ok(200, await publicEtat());

  function hLire(ctx) {
    const b = lire(ctx.params.id);
    if (!b) return err(404, "Bulletin inconnu : " + ctx.params.id, { code: "bulletin_inconnu" });
    return ok(200, { ...jsonBulletin(b, { base: ctx.base || "" }) });
  }

  async function hAbonner(ctx) {
    const corps = ctx.body || {};
    const r = await abonner({ courriel: corps.courriel || corps.email, nom: corps.nom, ip: ctx.ip, source: "recueil" });
    if (!r.ok) return err(r.status, r.motif, { code: "abonnement_refuse" });
    return ok(r.status, { abonne: { courriel: r.abonne.courriel, etat: r.abonne.etat }, envoye: r.envoye, motif: r.motif, message: r.message });
  }

  async function hConfirmer(ctx) {
    const j = (ctx.body && (ctx.body.jeton || ctx.body.token)) || (ctx.query && ctx.query.jeton);
    const r = await confirmer(j);
    if (!r.ok) return err(r.status, r.motif, { code: "confirmation_invalide" });
    return ok(200, { confirme: true, abonne: r.abonne, desabonnement: r.desabonnement, message: "Votre abonnement est confirmé : vous recevrez chaque bulletin par courriel." });
  }

  async function hDesabonner(ctx) {
    const j = (ctx.body && (ctx.body.jeton || ctx.body.token)) || (ctx.query && ctx.query.jeton);
    const r = await desabonner(j);
    if (!r.ok) return err(r.status, r.motif, { code: "desabonnement_invalide" });
    return ok(200, { desabonne: true, abonne: r.abonne, message: "Votre abonnement est résilié : aucun courriel ne vous sera plus adressé." });
  }

  const hTableauDeBord = async (ctx) => ok(200, await tableauDeBord(ctx.base));

  // La génération à la demande. Trois usages : composer les périodes écoulées
  // depuis une date (mise en service tardive), reprendre les périodes échues, ou
  // composer LA PÉRIODE EN COURS (`enCours`) — le geste « paraître aujourd'hui ».
  async function hGenerer(ctx) {
    const corps = ctx.body || {};
    const r = await lireReglages();
    if (!r.actif) return err(409, "Le bulletin est éteint sur ce service : activez-le avant de générer.", { code: "bulletin_eteint" });
    const b = etat();
    if (corps.depuis && /^\d{4}-\d{2}-\d{2}$/.test(String(corps.depuis))) b.depuis = String(corps.depuis);
    if (corps.enCours) {
      const enCours = periodeDe(aujourdhui(), r.cadence);
      const bulletin = composerPeriode(enCours, r, { publications: await publications(), provisoire: true });
      persist();
      if (!bulletin) return ok(200, { compose: [], message: "Aucun acte n'a encore été publié sur la période en cours : il n'y a pas de bulletin à composer." });
      return ok(201, { compose: [bulletin.id], bulletin: resume(bulletin), message: "Le bulletin « " + bulletin.titre + " » est composé. Il deviendra définitif à la fin de la période, et sera alors adressé aux abonnés." });
    }
    const avant = new Set(Object.keys(b.periodes));
    const passe = await assurer();
    const nouveaux = Object.keys(b.periodes).filter((k) => !avant.has(k) && b.periodes[k].bulletin);
    return ok(200, {
      compose: nouveaux, vides: passe.vides, publies: passe.publies, envois: passe.envois,
      bulletins: passe.composees.length,
      message: nouveaux.length
        ? nouveaux.length + " bulletin(s) composé(s)."
        : "Aucune période échue n'avait d'actes à rassembler : il n'y a rien de nouveau à composer.",
    });
  }

  async function hEnvoyer(ctx) {
    const p = etat().periodes[ctx.params.id];
    if (!p || !p.bulletin) return err(404, "Bulletin inconnu : " + ctx.params.id, { code: "bulletin_inconnu" });
    if (p.bulletin.provisoire) return err(409, "Ce bulletin est provisoire : il ne s'envoie qu'une fois la période close.", { code: "bulletin_provisoire" });
    const n = await programmer(p.bulletin);
    const envois = await viderFile(await lireReglages());
    return ok(200, {
      bulletin: p.bulletin.id, programme: n, envois,
      message: n
        ? n + " abonné(s) confirmé(s) : le bulletin part par courriel."
        : "Aucun abonné confirmé : le bulletin n'a personne à qui être adressé.",
    });
  }

  function hRetirerAbonne(ctx) {
    const b = etat();
    const fiche = b.abonnes[ctx.params.id];
    if (!fiche) return err(404, "Abonné inconnu : " + ctx.params.id, { code: "abonne_inconnu" });
    fiche.etat = "retire";
    fiche.desaboLe = nowIso();
    b.file = b.file.filter((x) => x.abonne !== fiche.id);
    persist();
    return ok(200, { retire: true, abonne: resumeAbonne(fiche) });
  }

  const ROUTES = [
    // --- public ------------------------------------------------------------
    { m: "GET", p: /^\/v1\/bulletins$/, f: hEtatPublic },
    { m: "POST", p: /^\/v1\/bulletins\/abonnement$/, ecrit: true, f: hAbonner },
    { m: "POST", p: /^\/v1\/bulletins\/abonnement\/confirmation$/, ecrit: true, f: hConfirmer },
    { m: "POST", p: /^\/v1\/bulletins\/abonnement\/desabonnement$/, ecrit: true, f: hDesabonner },
    { m: "GET", p: /^\/v1\/bulletins\/([^/]+)$/, f: hLire },
    // --- administration -----------------------------------------------------
    { m: "GET", p: /^\/v1\/bulletins\/administration\/tableau$/, role: { min: "editeur" }, f: hTableauDeBord },
    { m: "POST", p: /^\/v1\/bulletins\/administration\/generer$/, role: { min: "editeur" }, ecrit: true, f: hGenerer },
    { m: "POST", p: /^\/v1\/bulletins\/([^/]+)\/envoyer$/, role: { min: "editeur" }, ecrit: true, f: hEnvoyer },
    { m: "POST", p: /^\/v1\/bulletins\/abonnes\/([^/]+)\/retirer$/, role: { min: "administrateur" }, ecrit: true, f: hRetirerAbonne },
  ];

  function route(req, ctx = {}) {
    const method = String(req.method || "GET").toUpperCase();
    const path = String(req.path || "/");
    const q = path.indexOf("?");
    const clean = q >= 0 ? path.slice(0, q) : path;
    const query = {};
    if (q >= 0) for (const [k, v] of new URLSearchParams(path.slice(q + 1))) query[k] = v;
    const headers = req.headers || {};
    let trouve = false;
    for (const r of ROUTES) {
      const m = r.p.exec(clean);
      if (!m) continue;
      trouve = true;
      if (r.m !== method && !(r.m === "GET" && method === "HEAD")) continue;
      if (r.role && typeof ctx.authorize === "function") {
        const refus = ctx.authorize(headers, r.role);
        if (refus) return refus;
      }
      if (r.ecrit && typeof ctx.rate === "function" && ctx.rate(req)) {
        return err(429, "Trop de requêtes : ralentissez.", { code: "trop_de_requetes" });
      }
      const params = m[1] !== undefined ? { id: decodeURIComponent(m[1]) } : {};
      return r.f({ params, body: req.body, headers, ip: req.ip, query, agent: ctx.agent === true, base: ctx.base || "" });
    }
    return trouve ? err(405, "Méthode " + method + " non autorisée sur " + clean, { code: "methode_non_autorisee" }) : null;
  }

  const takeDirty = () => { const d = dirty; dirty = null; return d; };

  return {
    route, takeDirty,
    assurer, programmer, viderFile,
    liste, lire, resume, jsonBulletin, texteBulletin, markdownBulletin, flux,
    publicEtat, tableauDeBord, lireReglages, apercu,
    abonner, confirmer, desabonner, liensDe: (a, r) => ({ confirmation: lienConfirmation(a, r), desabonnement: lienDesabonnement(a, r) }),
    reinitialiser: () => { state.bulletins = etatBulletinsVide(); persist(); },
    compter: () => ({ bulletins: liste().length, abonnes: Object.keys(etat().abonnes).filter((k) => etat().abonnes[k].etat !== "retire").length, file: etat().file.length }),
    secret,
  };
}

// --------------------------------------------------------------- utilitaires
function html(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const slugId = (s) => String(s || "bulletin").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "bulletin";

// L'ossature d'un courriel : une seule colonne, des styles en ligne, et rien qui
// dépende d'une feuille de style — les clients de messagerie ne l'appliquent pas.
export function enveloppeHtml(reglages, corps) {
  const entete = (reglages && reglages.entete) || "";
  const pied = (reglages && reglages.pied) || "";
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#161616;max-width:680px">
${entete ? `<p style="white-space:pre-line;color:#5a6472;font-size:13px;margin:0 0 14px">${html(entete)}</p>` : ""}
${corps}
${pied ? `<p style="color:#5a6472;font-size:12px;margin-top:22px;border-top:1px solid #d5dbe4;padding-top:10px;white-space:pre-line">${html(pied)}</p>` : ""}
</div>`;
}

// Le HTML du bulletin dans un courriel — c'est un message, pas une page : les
// entités et les thèmes y sont des titres, les actes une liste de liens.
export function htmlDeBulletin(bulletin, { lien = "", rss = "", desabo = "", r = {}, base = "" } = {}) {
  const acte = (a) => {
    const href = a.cle && base ? base + "/recueil/" + encodeURIComponent(a.cle) : "";
    const titre = [a.numero, a.objet].filter(Boolean).join(" — ") || a.cle;
    const meta = [
      a.datePublication ? "publié le " + dateLongue(a.datePublication) : "",
      a.dateOpposabilite ? "en vigueur le " + dateLongue(a.dateOpposabilite) : (a.juridique === false ? "document non opposable" : ""),
      a.remplacee ? "version consolidée" : "",
    ].filter(Boolean).join(" · ");
    return `      <li style="margin:0 0 9px">
        ${href ? `<a href="${html(href)}" style="color:#000091;font-weight:600;text-decoration:none">${html(titre)}</a>` : `<span style="font-weight:600">${html(titre)}</span>`}
        ${meta ? `<div style="color:#5a6472;font-size:13px">${html(meta)}</div>` : ""}
      </li>`;
  };
  const corps = [
    `<h1 style="font-size:20px;margin:0 0 4px">${html(bulletin.titre)}</h1>`,
    `<p style="margin:0 0 18px;color:#5a6472">${html(intervalleTexte(bulletin.debut, bulletin.fin))} · ${bulletin.nombre} acte${bulletin.nombre > 1 ? "s" : ""}</p>`,
    bulletin.sousTitre ? `<p style="margin:0 0 16px">${html(bulletin.sousTitre)}</p>` : "",
    bulletin.nombre === 0 ? "<p>Aucun acte n'a été publié sur cette période.</p>" : "",
    ...bulletin.entites.map((e) => [
      `<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#000091;margin:22px 0 6px;border-bottom:1px solid #d5dbe4;padding-bottom:4px">${html(e.nom)}</h2>`,
      ...e.themes.map((t) => [
        `<h3 style="font-size:14px;margin:12px 0 4px">${html(t.label)}</h3>`,
        `<ul style="margin:0;padding-left:18px">`,
        ...t.actes.map(acte),
        `</ul>`,
      ].join("\n")),
    ].join("\n")),
    lien ? `<p style="margin-top:24px"><a href="${html(lien)}" style="background:#000091;color:#ffffff;padding:9px 14px;text-decoration:none;border-radius:4px;display:inline-block">Lire le bulletin en ligne</a></p>` : "",
    rss ? `<p style="margin:10px 0 0;font-size:13px;color:#5a6472">S'abonner au flux : <a href="${html(rss)}">${html(rss)}</a></p>` : "",
    desabo ? `<p style="margin:6px 0 0;font-size:12px;color:#5a6472">Se désabonner : <a href="${html(desabo)}">${html(desabo)}</a></p>` : "",
  ].filter(Boolean).join("\n");
  return enveloppeHtml(r, corps);
}
