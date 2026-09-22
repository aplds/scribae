// ============================================================================
// SÉQUENCE DE NUMÉROTATION — le noyau pur.
//
// Le système interne de numérotation tient dans ce module, et nulle part
// ailleurs : le motif du numéro, le remplissage, l'année, la SÉQUENCE (le rang
// du prochain numéro) et sa PORTÉE — un chrono unique pour la collectivité, ou
// un chrono PAR ENTITÉ ou PAR TYPE D'ACTE. Il sait aussi RELIRE un numéro
// composé pour en retrouver le rang, l'année et le code d'entité : c'est ce qui
// permet à l'écran « Chrono de numérotation » de classer, filtrer et repérer les
// trous sans que l'administration décrive deux fois son motif.
//
// Module PUR, sans AUCUNE importation : il est employé par la compilation
// (`lib/compile.js`) comme par la numérotation externe (`lib/numbering.js`), et
// il ne doit pas y avoir de cycle entre les deux.
// ============================================================================

// Le gabarit livré de l'appel à un service de numérotation externe (Grist…).
// Voir lib/numbering.js pour l'appel lui-même.
export const EXTERNE_DEFAUT = {
  transport: "relais",
  url: "",
  method: "POST",
  headers: "Authorization: Bearer VOTRE_CLE_API\nContent-Type: application/json",
  body: '{"records":[{"fields":{"Objet":"{objet}","Annee":{year},"Entite":"{entityCode}"}}]}',
  valeur: "records[0].id",
  reference: "records[0].id",
  pattern: "",
  timeoutMs: 15000,
};

// Le gabarit d'un document Grist. L'API de Grist n'accepte pas l'en-tête
// Authorization depuis un navigateur (elle ne l'autorise que pour les origines
// qu'on lui a déclarées) : le relais est donc le transport qui marche.
export const GABARIT_GRIST = {
  transport: "relais",
  url: "https://docs.getgrist.com/api/docs/VOTRE_DOCUMENT/tables/Numerotation/records",
  method: "POST",
  headers: "Authorization: Bearer VOTRE_CLE_API\nContent-Type: application/json",
  body: '{"records":[{"fields":{"Objet":"{objet}","Annee":{year},"Entite":"{entityCode}"}}]}',
  valeur: "records[0].id",
  reference: "records[0].id",
  pattern: "",
  timeoutMs: 15000,
};

// Les portées d'une séquence interne : une par collectivité (« global »), une
// par entité, ou une par type d'acte.
export const PORTEES = [
  { value: "global", label: "Un seul chrono pour toute la collectivité" },
  { value: "entite", label: "Un chrono par entité (chaque code d'entité a sa séquence)" },
  { value: "type", label: "Un chrono par type d'acte" },
];

// Le réglage complet, complété par les défauts : un référentiel antérieur à la
// numérotation externe s'ouvre sans migration, comme une charte ancienne reste
// imprimable (voir src/lib/styles.js).
export function numberingSettings(config) {
  const n = (config && config.numbering) || {};
  return {
    ...n,
    source: n.source === "externe" ? "externe" : "interne",
    pattern: n.pattern || "{year}-{seq}-{entityCode}",
    pad: Number(n.pad) || 3,
    year: Number(n.year) || new Date().getFullYear(),
    portee: ["entite", "type"].includes(n.portee) ? n.portee : "global",
    sequences: n.sequences && typeof n.sequences === "object" ? n.sequences : {},
    annules: Array.isArray(n.annules) ? n.annules : [],
    externe: { ...EXTERNE_DEFAUT, ...(n.externe || {}) },
  };
}

export const estExterne = (config) => numberingSettings(config).source === "externe";

// ------------------------------------------------------------- la séquence
// La clé du compteur, selon la portée : « global », le code de l'entité, ou le
// type d'acte. C'est cette clé qui range le rang dans `numbering.sequences`.
export const cleSequence = (config, { entity, actTypeId = "" } = {}) => {
  const n = numberingSettings(config);
  if (n.portee === "entite") return entity?.code || "XX";
  if (n.portee === "type") return String(actTypeId || "acte");
  return "global";
};

// Le rang de séquence courant d'une portée (le prochain numéro à tirer). Une
// portée qui n'a pas encore de compteur part de la séquence générale
// (`numbering.seq`) : passer d'un chrono global à des chronos par entité ne
// demande donc rien à ressaisir.
export function sequenceCourante(config, options = {}) {
  const n = numberingSettings(config);
  const cle = cleSequence(config, options);
  if (n.portee !== "global") {
    const range = n.sequences[cle];
    if (range !== undefined && range !== null && range !== "") return Math.max(1, Number(range) || 1);
  }
  return Math.max(1, Number(n.seq) || 1);
}

// Incrémente le compteur de la portée qui vient de servir. C'est le SEUL endroit
// où la séquence avance : les écrans de rédaction et de modification l'appellent
// au lieu de toucher à `config.numbering.seq`.
export function incrementerSequence(config, options = {}) {
  return fixerSequence(config, sequenceCourante(config, options), options);
}

// Fixe le compteur de la portée APRÈS le rang donné : c'est ce qu'appelle une
// RÉSERVATION, qui a pu sauter des numéros déjà pris (`prochainNumeroLibre`).
// Un rang inférieur au compteur courant ne le fait jamais reculer — une
// séquence administrative ne revient pas en arrière.
export function fixerSequence(config, rang, options = {}) {
  const n = numberingSettings(config);
  const cle = cleSequence(config, options);
  const prochain = Math.max(sequenceCourante(config, options), Math.floor(Number(rang) || 0) + 1);
  if (n.portee === "global") {
    config.numbering = { ...(config.numbering || {}), seq: prochain };
  } else {
    config.numbering = {
      ...(config.numbering || {}),
      sequences: { ...(n.sequences || {}), [cle]: prochain },
    };
  }
  return prochain;
}

// Annule un numéro : il n'est plus « disponible » (personne ne le reprendra à
// l'aveugle), et le chrono le montre comme annulé, avec son motif. Le numéro
// lui-même n'est PAS recyclé : une séquence administrative ne revient pas en
// arrière, c'est ce qui fait foi.
export function annulerNumero(config, { numero, seq = null, annee = null, entityCode = "", motif = "", par = "" } = {}) {
  const n = numberingSettings(config);
  const list = [...(n.annules || [])];
  if (!numero || list.some((a) => a.numero === numero)) return list;
  list.push({
    numero: String(numero),
    seq: seq == null ? seqDeNumero(config, numero) : seq,
    annee: annee == null ? n.year : annee,
    entityCode: String(entityCode || ""),
    motif: String(motif || ""),
    at: new Date().toISOString(),
    par: String(par || ""),
  });
  config.numbering = { ...(config.numbering || {}), annules: list };
  return list;
}

// ------------------------------------------------------ lecture d'un numéro
// Le motif ramené à une expression régulière : chaque jeton connu devient un
// groupe de capture nommé. C'est ce qui permet de RELIRE un numéro composé.
const JETONS_MOTIF = ["year", "seq", "entityCode", "actTypeId", "valeur"];
const echapper = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function motifVersRegex(motif) {
  const m = String(motif || "").trim();
  if (!m) return null;
  let re = "^";
  let i = 0;
  const rx = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
  let match;
  while ((match = rx.exec(m))) {
    re += echapper(m.slice(i, match.index));
    re += JETONS_MOTIF.includes(match[1]) ? `(?<${match[1]}>[A-Za-z0-9]+)` : "[A-Za-z0-9]+";
    i = rx.lastIndex;
  }
  re += echapper(m.slice(i)) + "$";
  try { return new RegExp(re); } catch (e) { return null; }
}

const lireMotif = (config, numero) => {
  const n = numberingSettings(config);
  const s = String(numero || "").trim();
  if (!s) return null;
  for (const motif of [n.pattern, n.externe && n.externe.pattern]) {
    const re = motifVersRegex(motif);
    const m = re && re.exec(s);
    if (m) return m;
  }
  return null;
};

// Le rang de séquence lu dans un numéro composé (« 2026-0412-VSL » → 412).
// Renvoie null quand le numéro ne se lit pas (numéro saisi à la main).
export function seqDeNumero(config, numero) {
  const m = lireMotif(config, numero);
  if (m) {
    const g = m.groups || {};
    if (g.seq != null) {
      const v = Number(g.seq);
      if (Number.isFinite(v)) return v;
    }
    const premier = (m[1] || "").match(/\d+/);
    if (premier) return Number(premier[0]);
  }
  const g = String(numero || "").match(/\d+/g);
  return g && g.length ? Number(g[g.length - 1]) : null;
}

// L'année inscrite dans un numéro, à défaut l'année du référentiel.
export function anneeDeNumero(config, numero) {
  const m = lireMotif(config, numero);
  const g = (m && m.groups) || {};
  if (g.year && /^\d{4}$/.test(g.year)) return Number(g.year);
  const a = String(numero || "").match(/(20\d{2})/);
  return a ? Number(a[1]) : numberingSettings(config).year;
}

// Le code d'entité inscrit dans un numéro.
export function entiteCodeDeNumero(config, numero) {
  const m = lireMotif(config, numero);
  return (m && m.groups && m.groups.entityCode) || "";
}

// -------------------------------------------------------- composer un numéro
// Le numéro que compose la séquence interne pour un rang donné. C'est LA
// composition, en un seul endroit : le numéro proposé à la rédaction, celui
// qu'une réservation retient, et celui que l'écran de modification montre au
// rédacteur en sortent tous les trois.
export function composerNumeroInterne(config, { seq, entity, actTypeId = "" } = {}) {
  const n = numberingSettings(config);
  const rang = String(seq == null ? sequenceCourante(config, { entity, actTypeId }) : seq);
  return String(n.pattern)
    .replace("{year}", String(n.year))
    .replace("{seq}", rang.padStart(n.pad, "0"))
    .replace("{entityCode}", entity?.code || "XX")
    .replace("{actTypeId}", String(actTypeId || "acte"));
}

// Le numéro proposé par la séquence interne. Vide quand la source est externe :
// le numéro viendra du service, au moment de rédiger (voir lib/numbering.js).
export function nextNumero(config, entity, actTypeId = "") {
  const n = numberingSettings(config);
  if (n.source === "externe") return "";
  return composerNumeroInterne(config, { seq: sequenceCourante(config, { entity, actTypeId }), entity, actTypeId });
}

// Les numéros déjà PORTÉS par un acte. Le chrono, la réservation et l'écran de
// numérotation s'en servent pour ne pas proposer deux fois le même numéro : un
// numéro est un fait, il ne se distribue pas à deux actes.
export function numerosPris(actes) {
  const pris = new Set();
  for (const a of actes || []) {
    const numero = String((a && (a.numero || (a.values && a.values.numero))) || "").trim();
    if (numero) pris.add(numero);
  }
  return pris;
}

// Le prochain numéro LIBRE de la portée : on part du compteur, et on avance tant
// que le numéro composé est déjà porté par un acte, ou annulé au chrono. Sans
// cette garde, un compteur resté en arrière (numéros attribués hors de
// l'application, données reprises d'un autre outil, passage d'année) proposerait
// un numéro déjà utilisé — et le registre porterait deux actes du même numéro.
//
// Rend `{ numero, seq, sautes }` : le numéro, le rang retenu, et le nombre de
// rangs enjambés (que la rédaction peut signaler).
export function prochainNumeroLibre(config, { entity, actTypeId = "", actes = [], annules = null, limite = 10000 } = {}) {
  const n = numberingSettings(config);
  if (n.source === "externe") return { numero: "", seq: null, sautes: 0 };
  const pris = actes instanceof Set ? actes : numerosPris(actes);
  const annulesSet = annules instanceof Set
    ? annules
    : new Set((annules || n.annules || []).map((a) => String((a && a.numero) || a || "")));
  const depart = sequenceCourante(config, { entity, actTypeId });
  for (let i = 0; i < limite; i += 1) {
    const seq = depart + i;
    const numero = composerNumeroInterne(config, { seq, entity, actTypeId });
    if (!pris.has(numero) && !annulesSet.has(numero)) return { numero, seq, sautes: i };
  }
  return { numero: "", seq: null, sautes: limite };
}
