// ============================================================================
// Numérotation des actes d'où vient le numéro.
//
// Deux sources, réglées dans Administration › Numérotation :
//
//   interne   la séquence de l'application (`numbering.seq`), incrémentée
//             localement. C'est le réglage d'origine, et il suffit à la
//             plupart des collectivités.
//   externe   un service à qui l'on DEMANDE le numéro au moment de rédiger.
//             Le cas d'usage courant est un document Grist : la création d'une
//             ligne y attribue le numéro, et le service renvoie la ligne créée.
//
// Le module ne connaît ni le DOM ni l'état de l'application : il compose la
// requête à partir du référentiel, l'envoie, lit la réponse et rend le numéro.
// Chaque échange est JOURNALISÉ (voir remote.js) : il apparaît dans « API &
// journal » au même titre que les appels au prestataire de signature.
//
// Deux transports :
//   relais   l'appel passe par le relais HTTP de l'hôte : aucun CORS à
//            négocier, et c'est le seul moyen d'atteindre un service qui
//            refuse l'en-tête Authorization depuis un navigateur (c'est le cas
//            de Grist). Les en-têtes transitent par le relais, clé comprise.
//   direct   l'appel part du navigateur : l'API doit autoriser l'origine de
//            l'application (CORS). Le service de numérotation doit compter
//            l'origine de l'application parmi ses origines de confiance.
//
// Le module est PUR : rien n'y écrit dans le référentiel. C'est l'appelant
// (l'écran de rédaction) qui enregistre le numéro et incrémente la séquence.
// ============================================================================
import { getPath, todayIso } from "./util.js";
import { nextNumero } from "./compile.js";
import { recordExternal, beginFlow } from "./remote.js";
import { hostSuperFetch } from "./hosts.js";

export const SOURCES = [
  { value: "interne", label: "Séquence interne de l'application" },
  { value: "externe", label: "API externe — le numéro est attribué par un service" },
];

export const TRANSPORTS = [
  { value: "relais", label: "Par le relais HTTP (contourne CORS)" },
  { value: "direct", label: "Appel direct du navigateur (l'API doit autoriser le CORS)" },
];

export const METHODES = [
  { value: "POST", label: "POST — créer une ligne (défaut)" },
  { value: "GET", label: "GET — lire le prochain numéro" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
];

// Jetons disponibles dans l'adresse, les en-têtes et le corps de la requête.
// Le motif du numéro en accepte un de plus : {valeur}, la valeur brute rendue
// par le service. Seuls les jetons connus sont remplacés — les accolades d'un
// corps JSON traversent donc la substitution sans être touchées.
export const JETONS = [
  ["{valeur}", "la valeur brute rendue par le service (ex. 412, ou l'identifiant de la ligne créée)"],
  ["{entityCode}", "le code de l'entité de l'acte (VSL, CCAS…)"],
  ["{entity}", "le nom de l'entité"],
  ["{year}", "l'année de référence du référentiel"],
  ["{seq}", "le rang de séquence (complété par des zéros selon la longueur réglée)"],
  ["{objet}", "l'objet de l'acte (les premières lignes)"],
  ["{date}", "la date de signature de l'acte, à défaut le jour même"],
  ["{trameId}", "l'identifiant de la trame"],
  ["{actTypeId}", "le type d'acte (arrêté, décision…)"],
];

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

// Le réglage complet, complété par les défauts : un référentiel antérieur à la
// numérotation externe s'ouvre sans migration, comme une charte ancienne reste
// imprimable (voir src/lib/styles.js).
export function numberingSettings(config) {
  const n = config?.numbering || {};
  return {
    ...n,
    source: n.source === "externe" ? "externe" : "interne",
    pattern: n.pattern || "{year}-{seq}-{entityCode}",
    pad: Number(n.pad) || 3,
    year: Number(n.year) || new Date().getFullYear(),
    externe: { ...EXTERNE_DEFAUT, ...(n.externe || {}) },
  };
}

export const estExterne = (config) => numberingSettings(config).source === "externe";

// ------------------------------------------------ gabarits : jetons et chemins

export function remplacerJetons(gabarit, jetons) {
  if (gabarit == null) return "";
  return String(gabarit).replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,
    (tout, cle) => (cle in jetons ? String(jetons[cle] ?? "") : tout));
}

// « records[0].id » — la notation des chemins JSON que Grist publie — ramenée à
// celle de util.getPath, qui raisonne en points.
export const cheminNormalise = (chemin) => String(chemin || "").replace(/\[(\d+)\]/g, ".$1");

export function jetonsNumerotation(config, ctx = {}) {
  const n = numberingSettings(config);
  const entity = ctx.entity
    || (config?.entities || []).find((e) => e.id === ctx.entityId)
    || {};
  const brut = ctx.valeur;
  return {
    year: String(n.year),
    seq: String(n.seq).padStart(n.pad, "0"),
    entityCode: entity.code || "XX",
    entity: entity.name || "",
    objet: String(ctx.objet || ""),
    date: ctx.date || todayIso(),
    trameId: String(ctx.trameId || ""),
    actTypeId: String(ctx.actTypeId || ""),
    valeur: brut == null ? "" : String(brut),
  };
}

// Le numéro composé à partir de la valeur rendue par le service. Le motif est
// celui de la numérotation externe, à défaut le motif principal. {seq} reçoit la
// valeur complétée par des zéros SI c'est un entier : un service qui rend déjà
// un numéro mis en forme (« 2026/0412 ») n'est jamais abîmé.
//
// Sans valeur (appel pour la séquence locale), le rang du référentiel est
// conservé : la fonction compose alors le même numéro que `nextNumero`.
export function composerNumero(config, brut, ctx = {}) {
  const n = numberingSettings(config);
  const jetons = jetonsNumerotation(config, ctx);
  if (brut != null && brut !== "") {
    const s = String(brut);
    jetons.valeur = s;
    jetons.seq = /^\d+$/.test(s) ? s.padStart(n.pad, "0") : s;
  }
  return remplacerJetons(n.externe.pattern || n.pattern, jetons);
}

// « Nom: valeur » par ligne — une ligne vide ou commençant par # est ignorée.
export function lireEntetes(texte) {
  const out = {};
  for (const ligne of String(texte || "").split("\n")) {
    const l = ligne.trim();
    if (!l || l.startsWith("#")) continue;
    const i = l.indexOf(":");
    if (i < 1) continue;
    out[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return out;
}

export const relaisDisponible = () => typeof hostSuperFetch() === "function";

// --------------------------------------------------------------- l'appel

async function envoyer({ url, method, headers, body, transport, timeoutMs }) {
  const relais = hostSuperFetch();
  const parRelais = transport !== "direct";
  if (parRelais && typeof relais !== "function") {
    throw new Error("Le relais HTTP n'est pas disponible ici : passez la numérotation externe en « appel direct », ou servez l'application depuis votre propre domaine.");
  }
  const f = parRelais ? relais : fetch;
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const duree = Math.max(1000, Number(timeoutMs) || EXTERNE_DEFAUT.timeoutMs);
  const minuteur = ctrl ? setTimeout(() => ctrl.abort(), duree) : null;
  try {
    const res = await f(url, {
      method,
      headers,
      body: body || undefined,
      signal: ctrl ? ctrl.signal : undefined,
    });
    const texte = await res.text();
    let data = texte;
    try { data = texte ? JSON.parse(texte) : null; } catch (e) { /* réponse non JSON : on garde le texte */ }
    return { status: res.status, ok: res.ok !== false && res.status >= 200 && res.status < 300, data, texte };
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw new Error(`Le service de numérotation n'a pas répondu en ${Math.round(duree / 1000)} s.`);
    }
    throw new Error(`Service de numérotation injoignable : ${(e && e.message) || e}`);
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
}

const extrait = (res) => {
  const t = typeof res.texte === "string" && res.texte ? res.texte : JSON.stringify(res.data ?? "");
  return t ? " — " + t.slice(0, 240) : "";
};

// Demande un numéro au service externe. Rend { valeur, numero, ref, reponse }.
export async function demanderNumero(config, ctx = {}, opts = {}) {
  const n = numberingSettings(config);
  const ext = n.externe;
  const jetons = jetonsNumerotation(config, ctx);
  const url = remplacerJetons(ext.url, jetons).trim();
  if (!url) throw new Error("Aucune adresse n'est renseignée : Administration › Numérotation › API externe.");
  const method = String(ext.method || "POST").toUpperCase();
  const headers = lireEntetes(remplacerJetons(ext.headers, jetons));
  const body = ["POST", "PUT", "PATCH"].includes(method) ? remplacerJetons(ext.body, jetons).trim() : "";
  const label = opts.label || "Attribution d'un numéro d'acte";
  const flow = opts.flow || beginFlow(label);
  const requete = { url, method, headers, body: body || null };
  const t0 = (globalThis.performance || Date).now();
  const ms = () => Math.round(((globalThis.performance || Date).now()) - t0);

  let res;
  try {
    res = await envoyer({ url, method, headers, body, transport: ext.transport, timeoutMs: ext.timeoutMs });
  } catch (e) {
    recordExternal({ service: "numerotation", method, url, request: requete, response: { erreur: String(e.message || e) }, status: 0, ms: ms(), flow, label });
    throw e;
  }
  recordExternal({ service: "numerotation", method, url, request: requete, response: res.data, status: res.status, ms: ms(), flow, label });

  if (!res.ok) throw new Error(`Le service de numérotation a répondu ${res.status}${extrait(res)}.`);
  const brut = getPath(res.data, cheminNormalise(ext.valeur));
  if (brut == null || brut === "") {
    throw new Error(`Le service a répondu, mais rien ne se trouve au chemin « ${ext.valeur} »${extrait(res)}.`);
  }
  const refBrute = ext.reference ? getPath(res.data, cheminNormalise(ext.reference)) : undefined;
  return {
    valeur: brut,
    numero: composerNumero(config, brut, ctx),
    ref: refBrute == null ? "" : String(refBrute),
    reponse: res.data,
    statut: res.status,
  };
}

// Le point d'entrée de l'écran de rédaction : quelle que soit la source, il rend
// le même objet. La séquence interne n'est PAS incrémentée ici (l'appelant
// l'enregistre), pour que l'écriture du référentiel reste au même endroit.
export async function reserverNumero(config, entity, ctx = {}) {
  if (!estExterne(config)) {
    return { numero: nextNumero(config, entity), source: "interne", ref: "", valeur: "" };
  }
  const r = await demanderNumero(config, { ...ctx, entity }, {
    label: ctx.label || `Attribution du numéro — ${entity?.name || "acte"}`,
  });
  return { numero: r.numero, source: "externe", ref: r.ref, valeur: String(r.valeur ?? ""), reponse: r.reponse };
}
