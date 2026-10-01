// ============================================================================
// Relais HTTP du service — la numérotation externe en auto-hébergement.
//
// L'application attribue parfois le numéro d'un acte à un service tiers (un
// document Grist, un référentiel interne) : depuis le navigateur, un tel appel
// se heurte au CORS, et certains services refusent l'en-tête `Authorization`
// d'une origine inconnue. Dans l'édition en ligne, la plateforme fournit ce
// relais (`root.superFetch`) ; en auto-hébergement, rien ne le fournissait —
// seule restait la voie « appel direct ». Ce module est le relais côté service
// (`POST /v1/relais`, voir server.mjs) : le navigateur poste la demande au
// service, et c'est le SERVICE qui appelle le tiers.
//
// UN RELAIS OUVERT EST UNE FAILLE (SSRF) : un appelant authentifié pourrait
// sonder l'intranet ou le service de métadonnées du nuage par son entremise.
// D'où quatre verrous, testés un par un dans `relais.test.mjs` :
//
//   1. la route exige une IDENTITÉ (session, ou clé de service en mode demo) ;
//   2. l'hôte visé doit figurer dans la liste blanche `SCRIBA_RELAIS_HOTES`
//      (comparaison exacte, insensible à la casse — un sous-domaine ne passe
//      pas pour son parent) ;
//   3. l'hôte est RÉSOLU, et toute adresse privée est refusée (bouclage,
//      réseaux locaux, lien-local, métadonnées du nuage) — c'est ce qui ferme
//      le ré-ancrage DNS, qu'une liste blanche seule ne voit pas ;
//   4. méthode blanche (GET/POST/PUT/PATCH), pas d'identifiants dans l'adresse,
//      en-têtes de transport reconstruits par `fetch` (jamais repris), corps
//      plafonné — et la clé d'API du tiers ne transite que dans les en-têtes,
//      jamais dans un journal (server.mjs ne journalise que l'hôte et l'issue).
//
// Module presque pur : `hoteAutorise`, `adressePrivee` et `preparer` ne touchent
// ni au réseau ni au système. Seul `relayer` sort, avec le `fetch` et la
// résolution injectés — les épreuves y branchent des doublures, et le service
// n'a qu'à appeler sans rien fournir (défauts : le `fetch` global et le DNS
// de Node, chargé en différé pour que le module reste importable partout).
// ============================================================================

// Les méthodes que la numérotation externe emploie (voir src/lib/numbering.js,
// `METHODES`) : rien d'autre ne passe — ni TRACE, ni CONNECT, ni une méthode
// inventée.
export const METHODES_AUTORISEES = ["GET", "POST", "PUT", "PATCH"];

// Le corps que le navigateur confie au relais, et la réponse qu'on lui rend :
// la numérotation échange du JSON court — au-delà, c'est un autre usage, et il
// passe par un autre canal.
export const CORPS_MAX = 1024 * 1024;
export const REPONSE_MAX = 1024 * 1024;

// Le tiers a trente secondes : la numérotation attend déjà avec son propre
// délai côté navigateur, et un relais qui pend indéfiniment retient un
// gestionnaire du service.
export const DELAI_DEFAUT_MS = 30000;

// Les en-têtes que le relais ne reprend JAMAIS de la demande : ce sont ceux du
// transport, que `fetch` reconstruit pour la liaison au tiers — les recopier,
// c'est au mieux les fausser, au pire les détourner.
const ENTETES_REPRIS_JAMAIS = new Set([
  "host", "connection", "content-length", "transfer-encoding", "keep-alive",
  "upgrade", "trailer", "te", "proxy-authenticate", "proxy-authorization",
]);

// ------------------------------------------------------------------ l'hôte
// L'hôte tel qu'on le compare : minuscules, sans point final — « Exemple.FR. »
// et « exemple.fr » sont le même hôte, et on ne veut pas que l'écriture décide.
export function normaliserHote(hote) {
  return String(hote || "").trim().toLowerCase().replace(/\.+$/, "");
}

// Une entrée de la liste blanche vaut pour UN hôte, avec un port facultatif
// (« grist.exemple.fr », « grist.exemple.fr:8443 »). Sans port, l'entrée vaut
// pour l'hôte sur TOUS ses ports — c'est la lecture ordinaire d'une liste
// d'hôtes ; qui veut n'ouvrir qu'un service épingle son port. Avec un port,
// seul ce port passe : changer de port, c'est changer de service, et la liste
// blanche ne s'étend pas au jugé.
export function hoteAutorise(hote, port, allowlist) {
  const h = normaliserHote(hote);
  if (!h) return false;
  for (const entree of allowlist || []) {
    const e = normaliserHote(entree);
    if (!e) continue;
    const i = e.lastIndexOf(":");
    // Un « : » suivi d'un port — mais pas le « :: » d'une adresse IPv6, qui
    // n'entre ici qu'entre crochets et se compare telle quelle.
    const aUnPort = i > 0 && /^\d+$/.test(e.slice(i + 1)) && !e.includes("::");
    if (aUnPort) {
      if (e.slice(0, i) === h && e.slice(i + 1) === String(port || "")) return true;
    } else if (e === h) {
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------- les adresses privées
// Ce que le relais ne touche jamais, même allowlisté : si l'administrateur a
// inscrit un nom qui résout vers l'intérieur (erreur, ou ré-ancrage DNS monté
// après coup), la résolution le dit — et c'est elle qui a le dernier mot.
function ipv4Privee(octets) {
  const [a, b] = octets;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 169 && b === 254)
    || a === 0 || a >= 224;
}

export function adressePrivee(ip) {
  let s = String(ip || "").trim().toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (!s) return true;
  // IPv4-mappée (« ::ffff:192.168.0.1 ») : c'est l'adresse embarquée qui décide.
  if (s.includes(":") && s.includes(".")) s = s.slice(s.lastIndexOf(":") + 1);
  if (/^[0-9.]+$/.test(s)) {
    const octets = s.split(".");
    if (octets.length !== 4 || octets.some((o) => !/^\d{1,3}$/.test(o) || Number(o) > 255)) return true;
    return ipv4Privee(octets.map(Number));
  }
  if (!s.includes(":")) return true;
  if (s === "::1" || s === "::") return true;
  const premier = s.split(":").find((g) => g !== "");
  const n = parseInt(premier || "0", 16);
  if (Number.isNaN(n)) return true;
  // ULA (fc00::/7), lien-local (fe80::/10), multidiffusion (ff00::/8) : jamais.
  if ((n & 0xfe00) === 0xfc00 || (n & 0xffc0) === 0xfe80 || (n & 0xff00) === 0xff00) return true;
  // Seule l'unicast globale (2000::/3) passe ; le reste (plages réservées, de
  // documentation, de traduction…) n'a rien à faire au bout d'un relais.
  return (n & 0xe000) !== 0x2000;
}

// ---------------------------------------------------------------- la demande
// Valide la demande du navigateur et la normalise — ou rend le motif du refus.
// Ne résout rien, n'appelle rien : la résolution et l'appel sont l'affaire de
// `relayer`, sous les verrous 2 et 3.
export function preparer(demande, { hotes = [] } = {}) {
  const urlBrute = demande && demande.url != null ? String(demande.url) : "";
  let url;
  try {
    url = new URL(urlBrute);
  } catch (e) {
    return { erreur: "adresse illisible", code: "adresse_invalide" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { erreur: "protocole refusé (http ou https uniquement)", code: "protocole_refuse" };
  }
  // Des identifiants dans l'adresse partiraient au tiers dans l'en-tête
  // `Authorization` reconstruit : on ne veut ni les y mettre, ni les voir.
  if (url.username || url.password) {
    return { erreur: "adresse à identifiants refusée", code: "adresse_invalide" };
  }
  const methode = String((demande && demande.method) || "GET").toUpperCase();
  if (!METHODES_AUTORISEES.includes(methode)) {
    return { erreur: `méthode refusée (${METHODES_AUTORISEES.join(", ")} uniquement)`, code: "methode_refusee" };
  }
  const hote = normaliserHote(url.hostname);
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (!hoteAutorise(hote, port, hotes)) {
    return { erreur: `hôte non autorisé (${hote}) : renseignez SCRIBA_RELAIS_HOTES`, code: "hote_non_autorise", hote };
  }
  const entetes = {};
  const bruts = (demande && demande.headers) || {};
  const noms = Object.keys(bruts);
  if (noms.length > 20) {
    return { erreur: "trop d'en-têtes (20 au plus)", code: "demande_invalide" };
  }
  for (const nom of noms) {
    const n = String(nom).trim().toLowerCase();
    const v = String(bruts[nom] ?? "");
    if (!n || ENTETES_REPRIS_JAMAIS.has(n)) continue;
    if (n.length > 128 || v.length > 8192) {
      return { erreur: "en-tête démesuré", code: "demande_invalide" };
    }
    entetes[nom] = v;
  }
  const corps = demande && demande.body != null ? String(demande.body) : "";
  if (corps.length > CORPS_MAX) {
    return { erreur: "corps trop volumineux (1 Mo au plus)", code: "corps_trop_volumineux" };
  }
  return {
    requete: {
      adresse: url.protocol + "//" + url.host + url.pathname + url.search,
      hote, port, methode, entetes, corps,
    },
  };
}

function statutDeVerrou(code) {
  return code === "corps_trop_volumineux" ? 413
    : code === "hote_non_autorise" ? 403
      : 400;
}

// ----------------------------------------------------------------- l'appel
// Mène la demande de bout en bout : verrous, résolution, appel, réponse
// plafonnée. Rend `{ statut, corps, tronque }` — ou `{ refus }`, que server.mjs
// convertit en réponse d'erreur.
//
// `resolution` et `fetchImpl` sont injectés : les épreuves y branchent des
// doublures, et server.mjs le DNS de Node (voir son appel). Ils ne sont PAS
// importés ici — un `node:dns` statique, ou même différé, rendrait ce module
// inimportable hors de Node (l'empaqueteur de l'atelier résout les imports au
// montage), alors que les épreuves s'en passent très bien.
export async function relayer(demande, { hotes = [], delaiMs = DELAI_DEFAUT_MS, fetchImpl = null, resolution = null } = {}) {
  const validee = preparer(demande, { hotes });
  if (validee.erreur) {
    return { refus: { statut: statutDeVerrou(validee.code), erreur: validee.erreur, code: validee.code, hote: validee.hote } };
  }
  const { requete } = validee;
  // Verrou 3 : l'hôte est résolu AVANT l'appel, et toute adresse privée —
  // bouclage, intranet, lien-local, métadonnées du nuage — refuse l'appel,
  // même allowlisté. Une résolution impossible refuse de même : un relais qui
  // appellerait « au jugé » n'en est pas un.
  if (typeof resolution !== "function") {
    return { refus: { statut: 503, erreur: "relais indisponible ici", code: "relais_indisponible" } };
  }
  let adresses;
  try {
    adresses = await resolution(requete.hote);
  } catch (e) {
    return { refus: { statut: 502, erreur: `hôte irresoluble (${requete.hote})`, code: "hote_irresoluble", hote: requete.hote } };
  }
  const liste = Array.isArray(adresses) ? adresses : [adresses];
  if (!liste.length || liste.some((a) => adressePrivee(a && a.address || a))) {
    return { refus: { statut: 403, erreur: `adresse privée refusée (${requete.hote})`, code: "adresse_privee", hote: requete.hote } };
  }
  const appel = fetchImpl || globalThis.fetch;
  if (typeof appel !== "function") {
    return { refus: { statut: 503, erreur: "relais indisponible ici", code: "relais_indisponible" } };
  }
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const minuteur = ctrl ? setTimeout(() => ctrl.abort(), Math.max(1000, Number(delaiMs) || DELAI_DEFAUT_MS)) : null;
  try {
    const reponse = await appel(requete.adresse, {
      method: requete.methode,
      headers: requete.entetes,
      body: requete.corps || undefined,
      signal: ctrl ? ctrl.signal : undefined,
      redirect: "follow",
    });
    const texte = await reponse.text();
    return {
      statut: reponse.status,
      corps: texte.length > REPONSE_MAX ? texte.slice(0, REPONSE_MAX) : texte,
      tronque: texte.length > REPONSE_MAX,
    };
  } catch (e) {
    const abrupte = e && (e.name === "AbortError" || /aborted|timeout/i.test(e.message || ""));
    return {
      refus: {
        statut: 502,
        erreur: abrupte
          ? `le tiers n'a pas répondu en ${Math.round((Number(delaiMs) || DELAI_DEFAUT_MS) / 1000)} s (${requete.hote})`
          : `appel impossible (${requete.hote})`,
        code: "relais_echec",
        hote: requete.hote,
      },
    };
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
}

// Le contrat OpenAPI de la route — une seule source de vérité avec le code
// ci-dessus, comme les autres domaines (voir server.mjs, `courrielPaths`).
export function relaisPaths() {
  return {
    "/v1/relais": {
      post: {
        operationId: "relaisHttp",
        summary: "Relais HTTP vers un tiers autorisé",
        description: "Appelle un service tiers (numérotation externe) pour le compte du navigateur, qui ne peut pas toujours l'appeler lui-même (CORS). L'hôte doit figurer dans SCRIBA_RELAIS_HOTES, et toute adresse privée est refusée même allowlistée. Exige une identité (session, ou clé de service).",
        tags: ["Service"],
        responses: {
          200: { description: "Réponse du tiers : `statut`, `corps` (texte, 1 Mo au plus) et `tronque`." },
          401: { description: "Identité absente." },
          403: { description: "Hôte non autorisé, ou adresse privée." },
          413: { description: "Corps confié trop volumineux." },
          429: { description: "Trop de requêtes." },
          502: { description: "Le tiers est injoignable." },
        },
      },
    },
  };
}
