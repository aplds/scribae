// ============================================================================
// Comptes locaux — le client du service des comptes (mode « password »).
//
// Le service de la collectivité (voir src/server/mysql/comptes.mjs) est le SEUL
// à connaître les mots de passe : il les vérifie, ouvre une session et la garde
// dans un cookie `HttpOnly`. L'application ne voit jamais un mot de passe
// conservé, ni un dérivé : elle envoie ce que l'agent a tapé, reçoit une session,
// et appelle le reste de l'API avec le cookie.
//
// Trois choses à savoir :
//   • les appels portent `credentials: "include"` : sans cela, le navigateur
//     n'enverrait pas le cookie de session (et la session serait inutile) ;
//   • toute ÉCRITURE porte l'en-tête `x-csrf-token`, relu du cookie `scribae_csrf`
//     que le service a posé à la connexion (double envoi) : un autre site ne
//     peut pas le lire, donc ne peut pas agir à la place de l'agent ;
//   • le mode du service est découvert par `GET /v1/auth/config` : c'est lui qui
//     fait autorité (voir src/lib/auth.js, `setDeploiementAuth`).
// ============================================================================

const base = () => String(globalThis.__SCRIBA_API_BASE__ ?? "").replace(/\/+$/, "");

export const COOKIE_CSRF = "scribae_csrf";

// Les cookies ne sont lisibles ici que par leur nom, et seulement s'ils ne sont
// pas `HttpOnly` — c'est exactement le cas du jeton anti-CSRF, et jamais celui
// de la session.
export function lireCookie(nom) {
  try {
    for (const part of String(document.cookie || "").split(";")) {
      const i = part.indexOf("=");
      if (i < 0) continue;
      if (part.slice(0, i).trim() === nom) return decodeURIComponent(part.slice(i + 1).trim());
    }
  } catch (e) { /* document.cookie indisponible : on s'en passe */ }
  return "";
}

export const jetonCsrf = () => lireCookie(COOKIE_CSRF);
export const enteteCsrf = () => {
  const j = jetonCsrf();
  return j ? { "x-csrf-token": j } : {};
};

async function appel(method, chemin, corps) {
  let res;
  try {
    res = await fetch(base() + chemin, {
      method,
      credentials: "include",
      headers: {
        ...(corps === undefined ? {} : { "content-type": "application/json" }),
        ...(method === "GET" ? {} : enteteCsrf()),
      },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
  } catch (e) {
    return { ok: false, status: 0, injoignable: true, body: { erreur: "Le service des comptes est injoignable.", code: "service_injoignable" } };
  }
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  return { ok: res.ok, status: res.status, body: data || {}, headers: res.headers };
}

// ------------------------------------------------ découverte du mode du service
// `{ auth: "demo" | "password", demo, motDePasseMin, marque? }`. Un service
// injoignable (édition en ligne, page statique) rend `{ ok: false }` : l'appelant
// en conclut que le mode est celui du référentiel.
export const modeService = () => appel("GET", "/v1/auth/config");

// Les réglages de RÉFÉRENTIEL posés par le `.env` du déploiement (identité,
// vocabulaire, numérotation, délais, recueil, fonctions) : `{ variables, erreurs }`.
// L'application les applique par-dessus le référentiel (voir
// src/lib/deploiement-config.js). Route publique ; un service injoignable
// (édition en ligne, page statique) rend `{ ok: false }`.
export const configService = () => appel("GET", "/v1/config");

// ------------------------------------------------------------------ connexion
export const connexion = (login, motDePasse) => appel("POST", "/v1/auth/connexion", { login, motDePasse });
export const connexionDemo = (userId) => appel("POST", "/v1/auth/demo", { userId });
export const sessionCourante = () => appel("GET", "/v1/auth/session");
export const deconnexion = () => appel("POST", "/v1/auth/deconnexion");
export const changerMotDePasse = (ancien, nouveau) => appel("POST", "/v1/auth/mot-de-passe", { ancien, nouveau });

// ------------------------------------------------------- administration
export const etatComptes = () => appel("GET", "/v1/auth/comptes");
// Sans `motDePasse`, le service en ENGENDRE un et le rend une seule fois.
export const definirMotDePasse = (userId, motDePasse, { mustChange = true } = {}) =>
  appel("POST", `/v1/auth/comptes/${encodeURIComponent(userId)}/mot-de-passe`, motDePasse ? { motDePasse, mustChange } : {});
export const retirerMotDePasse = (userId) =>
  appel("DELETE", `/v1/auth/comptes/${encodeURIComponent(userId)}/mot-de-passe`);

// Le message d'erreur d'une réponse, tel que le service l'écrit.
export const messageErreur = (r) => (r && r.body && (r.body.erreur || r.body.message)) || "Le service des comptes a refusé la demande.";
