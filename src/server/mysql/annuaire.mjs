// ============================================================================
// L'ANNUAIRE DE LA COLLECTIVITÉ, publié par le SERVICE.
//
// Pourquoi le service s'en mêle. Le référentiel (collection `config`) porte les
// réglages de l'annuaire, que l'administrateur saisit dans Administration ›
// Annuaire. Mais en mode « comptes locaux » — et en mode « oidc » —, ce
// référentiel n'est lisible QU'AVEC UNE SESSION : l'écran de connexion, qui
// vient avant toute session, n'y a pas accès. Or c'est lui qui doit savoir si
// l'annuaire est branché, au nom de quel fournisseur, et avec quelle
// correspondance de groupes. Le service lit donc le référentiel POUR lui et le
// publie dans `GET /v1/auth/config`, la route publique que l'écran de connexion
// interroge déjà (mode du déploiement, état de la base, amorçage du compte
// d'administration).
//
// Rien de secret ne sort d'ici, et c'est ce que la LISTE BLANCHE garantit : seuls
// les champs énumérés ci-dessous sont publiés. L'application est un CLIENT OIDC
// PUBLIC (flux code d'autorisation + PKCE) : elle ne détient aucun secret, un
// `client_secret` n'existe nulle part, et un champ qui n'est pas dans la liste —
// quel qu'il soit — n'est jamais rendu. C'est la même liste que celle du
// navigateur (`ANNUAIRE_CLES`, src/lib/auth.js), et les tests des deux côtés
// vérifient qu'elles ne divergent pas.
//
// La PRÉCÉDENCE est celle du reste du `.env` : le déploiement l'emporte sur le
// référentiel. Les valeurs posées ici sont déjà VALIDÉES (registre des
// variables, src/server/mysql/variables.mjs) — une valeur refusée n'arrive
// jamais jusqu'ici.
//
// Module PUR : aucune dépendance, ni à Node, ni à la base. Il s'éprouve seul
// (`annuaire.test.mjs`).
// ============================================================================

export const CHAMPS_PUBLICS = [
  "annuaire", "test", "issuer", "clientId", "scopes", "redirectUri", "prompt",
  "roleClaim", "roleMap", "unknownPolicy", "defaultRole",
  "serviceClaim", "entityClaim", "authoritative", "autoProvision", "useUserinfo",
  "requireSignature", "disableDemo", "allowRecovery",
];

export const CHAMPS_ENDPOINTS = ["authorization", "token", "jwks", "userinfo"];

const estObjet = (o) => !!o && typeof o === "object" && !Array.isArray(o);

// Une correspondance de groupes lisible par le navigateur : `[{ claim, role }]`,
// deux chaînes non vides. Toute autre forme est ÉCARTÉE — mieux vaut publier
// l'annuaire sans correspondance que des rôles faux.
function correspondancePropre(valeur) {
  if (!Array.isArray(valeur)) return undefined;
  const out = [];
  for (const row of valeur) {
    if (!estObjet(row)) continue;
    const claim = String(row.claim == null ? "" : row.claim).trim();
    const role = String(row.role == null ? "" : row.role).trim();
    if (!claim || !role) continue;
    out.push({ claim, role });
  }
  return out.length ? out : undefined;
}

// Ce que le SERVICE publie de l'annuaire, ou `null` s'il n'y a rien à publier
// (aucun réglage ni dans le `.env`, ni dans le référentiel) — le navigateur
// retombe alors sur le référentiel qu'il a sous la main, comme avant.
//
//   variables   les valeurs du `.env` de portée référentiel, par chemin pointé
//               (« auth.issuer », « auth.endpoints.token »…) : voir `lireVariables`.
//   referentiel le document `config` relu du magasin, ou `null` (base
//               injoignable : on publie alors ce que le `.env` dit, et rien de plus).
export function annuairePublic({ variables = {}, referentiel = null } = {}) {
  const ref = estObjet(referentiel) && estObjet(referentiel.auth) ? referentiel.auth : {};
  const out = {};
  for (const cle of CHAMPS_PUBLICS) {
    const posee = variables["auth." + cle];
    const valeur = posee !== undefined ? posee : ref[cle];
    if (valeur === undefined || valeur === null || valeur === "") continue;
    if (cle === "roleMap") {
      const propre = correspondancePropre(valeur);
      if (propre) out.roleMap = propre;
      continue;
    }
    out[cle] = valeur;
  }
  const refEp = estObjet(ref.endpoints) ? ref.endpoints : {};
  const ep = {};
  for (const cle of CHAMPS_ENDPOINTS) {
    const posee = variables["auth.endpoints." + cle];
    const valeur = posee !== undefined ? posee : refEp[cle];
    if (valeur === undefined || valeur === null || valeur === "") continue;
    ep[cle] = valeur;
  }
  if (Object.keys(ep).length) out.endpoints = ep;
  return Object.keys(out).length ? out : null;
}
