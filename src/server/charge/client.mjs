// ============================================================================
// LE CLIENT HTTP DU TEST DE CHARGE — des cookies, une session, un anti-CSRF.
//
// POURQUOI PAS UN SIMPLE `fetch`. Le service ne parle pas à des requêtes
// anonymes interchangeables : il ouvre une SESSION par poste (cookie), exige le
// jeton anti-CSRF sur chaque écriture, et sert des données différentes selon
// l'identité. Un test de charge qui n'aurait pas de session ne mesurerait que
// les routes publiques — c'est-à-dire la moitié de la charge, et la plus facile.
//
// Chaque poste a donc SON pot à cookies, comme un onglet de navigateur. C'est
// aussi ce qui rend le test honnête côté service : chaque poste paie la
// vérification de session (`sb_session` + `sb_record`) à chaque appel, comme le
// feraient de vrais agents.
// ============================================================================

const COOKIE_SESSION = "scribae_session";
const COOKIE_CSRF = "scribae_csrf";

// Les cookies d'une réponse. `getSetCookie` (Node 20) rend la liste ; à défaut,
// on découpe l'en-tête replié sur les débuts de cookie.
function cookiesDe(res) {
  const h = res.headers;
  if (h && typeof h.getSetCookie === "function") return h.getSetCookie() || [];
  const brut = (h && h.get("set-cookie")) || "";
  return brut ? brut.split(/,(?=\s*[^;=,\s]+=)/) : [];
}

export function potVide() {
  return { cookies: new Map(), enteteCsrf: "" };
}

function poserCookies(pot, liste) {
  for (const brut of liste) {
    const morceau = String(brut).split(";")[0];
    const i = morceau.indexOf("=");
    if (i <= 0) continue;
    const nom = morceau.slice(0, i).trim();
    const valeur = morceau.slice(i + 1).trim();
    if (valeur === "") pot.cookies.delete(nom);
    else pot.cookies.set(nom, valeur);
  }
}

const enteteCookies = (pot) => [...pot.cookies].map(([k, v]) => k + "=" + v).join("; ");

// ---------------------------------------------------------------------------
// Le client. `base` : l'adresse du service (sans barre finale). `jeton` : une
// clé d'API (mode « demo ») — dans ce cas il n'y a pas de session à ouvrir, et
// `ouvrirSession` ne fait rien.
// ---------------------------------------------------------------------------
// L'ADRESSE DE CHAQUE POSTE. Le service compte les requêtes PAR ADRESSE pour se
// protéger (connexions, écritures). Si tous les postes simulés partageaient la
// même adresse, la campagne ne mesurerait pas soixante agents mais UN agent
// soixante fois plus bavard : le limiteur refuserait des gestes normaux, et le
// rapport accuserait la protection d'une faute qui n'est pas la sienne. Chaque
// poste reçoit donc son adresse, transmise comme le fait le reverse-proxy du
// déploiement (`x-forwarded-for`).
export function adresseDePoste(poste) {
  if (!poste || !poste.index) return "";
  if (!poste.adresseSource) {
    const n = poste.index - 1;
    poste.adresseSource = `10.${20 + Math.floor(n / 65536)}.${Math.floor(n / 256) % 256}.${(n % 256) + 1}`;
  }
  return poste.adresseSource;
}

export function creerClient({ base, jeton = "", agent = "scribae-charge/1.0", timeoutMs = 60000 }) {
  const racine = String(base || "").replace(/\/+$/, "");

  async function envoyer(pot, { method = "GET", chemin, corps, entetes = {} }) {
    const url = racine + chemin;
    const tete = {
      "user-agent": agent,
      accept: "application/json, text/html;q=0.9, */*;q=0.8",
      ...(jeton ? { authorization: "Bearer " + jeton } : {}),
      ...(pot && pot.adresse ? { "x-forwarded-for": pot.adresse } : {}),
      ...(pot && pot.cookies.size ? { cookie: enteteCookies(pot) } : {}),
      ...entetes,
    };
    const csrf = (pot && pot.enteteCsrf) || (pot && pot.cookies.get(COOKIE_CSRF)) || "";
    if (corps !== undefined && method !== "GET" && csrf) tete["x-csrf-token"] = csrf;
    let corpsTexte;
    if (corps !== undefined) {
      tete["content-type"] = "application/json";
      corpsTexte = typeof corps === "string" ? corps : JSON.stringify(corps);
    }
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const minuteur = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    let res;
    try {
      res = await fetch(url, { method, headers: tete, body: corpsTexte, redirect: "manual", signal: ctrl ? ctrl.signal : undefined });
    } finally {
      if (minuteur) clearTimeout(minuteur);
    }
    if (pot) poserCookies(pot, cookiesDe(res));
    const texte = await res.text().catch(() => "");
    let json = null;
    try { json = texte ? JSON.parse(texte) : null; } catch (e) { json = null; }
    return { status: res.status, octets: texte.length, json, texte, entetes: res.headers };
  }

  // Ouvre la session d'un poste. Sans jeton, c'est une vraie connexion : le
  // service dérive le mot de passe (scrypt) — c'est le geste le plus coûteux
  // qu'un agent lui demande, et celui qu'un afflux d'agents simultanés rend
  // critique. Le mesurer est l'un des buts de la campagne.
  async function ouvrirSession(poste) {
    if (jeton || !poste.profil.session) return {};
    const identifiants = poste.identifiants || {};
    if (!identifiants.login) throw new Error("Aucun identifiant pour le profil " + poste.profil.id + " : voyez --comptes.");
    const pot = potVide();
    pot.adresse = adresseDePoste(poste);
    const res = await envoyer(pot, {
      method: "POST",
      chemin: "/v1/auth/connexion",
      corps: { login: identifiants.login, motDePasse: identifiants.motDePasse },
    });
    if (res.status !== 200) throw new Error("Connexion refusée (" + res.status + ") pour « " + identifiants.login + " » : " + ((res.json && (res.json.erreur || res.json.message)) || res.texte.slice(0, 120)));
    if (res.json && res.json.csrf) pot.enteteCsrf = res.json.csrf;
    const utilisateur = (res.json && res.json.utilisateur) || {};
    return { pot, userId: utilisateur.id || identifiants.login, nom: utilisateur.login || identifiants.login, role: utilisateur.role || poste.profil.role };
  }

  // Un poste SANS session (le visiteur du recueil) : son « pot » est vide.
  const requete = async (poste, demande) => {
    if (!poste.pot) { poste.pot = potVide(); poste.pot.adresse = adresseDePoste(poste); }
    return envoyer(poste.pot, demande);
  };

  return { envoyer, ouvrirSession, requete, base: racine, jeton };
}

// ---------------------------------------------------------------------------
// LA RECONNAISSANCE : ce que la campagne apprend de la cible avant de charger.
// Sans cette étape, les postes simulés n'auraient rien à lire ni à cliquer —
// et une étude de charge sur des 404 ne dit rien de personne.
// ---------------------------------------------------------------------------
export async function decouvrir(client, pot) {
  const ctx = { publications: [], elis: [], actes: [], trames: [], informations: [], config: [], etat: {} };
  const lire = async (chemin) => {
    try {
      const r = await client.envoyer(pot, { method: "GET", chemin });
      return r.status === 200 ? r.json : null;
    } catch (e) { return null; }
  };

  ctx.etat.config = await lire("/v1/auth/config");
  const pubs = await lire("/v1/publications");
  for (const p of (pubs && pubs.publications) || []) {
    if (!p || !p.cle) continue;
    ctx.publications.push({ cle: p.cle, eliUri: p.eliUri || "", numero: p.numero || "" });
    const chemin = String(p.eliUri || "").replace(/^eli:\/fr\//, "");
    if (chemin) ctx.elis.push("/eli/" + chemin);
  }
  for (const nom of ["actes", "trames", "informations", "config"]) {
    const doc = await lire("/v1/db/collections/" + nom);
    const records = (doc && doc.records) || [];
    ctx[nom] = records
      .filter((r) => r && r.payload && typeof r.payload === "object")
      .map((r) => ({ id: r.id, rev: r.rev, ord: r.ord, payload: r.payload }));
  }
  return ctx;
}
