// ============================================================================
// SITES — de quel domaine relève une adresse, et deux adresses sont-elles sur le
// même site ?
//
// POURQUOI CE MODULE. Les deux cookies que le service pose à la connexion
// (session `HttpOnly` et jeton anti-CSRF) sont `SameSite=Lax` : c'est la bonne
// valeur — elle empêche un autre site de faire agir le navigateur à la place de
// l'agent (voir l'audit ciblé du 22/09/2026, § 3). Mais elle a une conséquence
// qu'il faut DIRE : si le service est sur un autre SITE que l'application, le
// navigateur ne joint pas ces cookies, et le service répond `401 session_absente`
// alors qu'il fonctionne. C'est le point O-5 de cet audit : la phrase existait
// (`expliquerRefus`, code `session_absente`), mais seulement APRÈS l'échec —
// l'écran de réglages n'avertissait pas.
//
// Ici, la règle est écrite UNE fois : le domaine enregistrable (« site »), et la
// comparaison de deux adresses. Sans liste publique des suffixes de domaine
// (elle pèserait bien plus que cette fonction), on compare les deux derniers
// libellés — assez pour le cas visé (application et service sous le même
// domaine), et un doute ne coûte qu'un AVERTISSEMENT, jamais un refus.
//
// `null` en premier argument = « compare avec le site de la PAGE », ce qui est
// le cas d'usage : un agent qui saisit l'adresse de son service.
// ============================================================================

const hoteDePage = () => {
  try { return (typeof location !== "undefined" && location && location.host) || ""; } catch (e) { return ""; }
};

// Le domaine enregistrable, tel qu'on peut l'approcher sans liste de suffixes :
// les deux derniers libellés (« app.collectivite.fr » → « collectivite.fr »,
// « service.gouv.example » → « example »). Un hôte sans point (« localhost »)
// est son propre domaine.
export const domaineDe = (hote) => {
  const parties = String(hote || "").toLowerCase().split(".").filter(Boolean);
  if (parties.length <= 2) return parties.join(".");
  return parties.slice(-2).join(".");
};

// Localhost et l'adresse de boucle : un développement en deux ports ne relève
// pas de la règle des cookies (le navigateur traite `localhost` comme un site
// unique, quel que soit le port).
const estLocal = (hote) => /^(localhost|127[.]0[.]0[.]1)(:\d+)?$/.test(String(hote || "").toLowerCase());

// L'hôte d'une adresse saisie, ou "" si elle n'est pas encore analysable (une
// saisie en cours de frappe ne doit rien affirmer).
export function hoteDeAdresse(url) {
  const brut = String(url || "").trim();
  if (!brut) return "";
  try {
    const u = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(brut) ? brut : "https://" + brut);
    return u.host || "";
  } catch (e) { return ""; }
}

// Deux adresses sont-elles sur le même SITE ? `null`/"" pour la seconde = celui
// de la page.
export function memeSite(urlService, urlPage = null) {
  const hoteService = hoteDeAdresse(urlService);
  // Adresse vide = même origine (le service du déploiement, sous /v1/) : c'est
  // justement le montage qui marche, il n'y a rien à comparer.
  if (!hoteService) return true;
  const hotePage = urlPage === null ? hoteDePage() : hoteDeAdresse(urlPage);
  if (!hotePage) return true;
  if (hoteService === hotePage) return true;
  if (estLocal(hoteService) && estLocal(hotePage)) return true;
  return domaineDe(hoteService) === domaineDe(hotePage);
}

// L'avertissement à afficher sous le champ, ou "" s'il n'y a rien à dire.
export function avertissementSite(urlService, urlPage = null) {
  const hoteService = hoteDeAdresse(urlService);
  if (!hoteService) return "";
  const hotePage = urlPage === null ? hoteDePage() : hoteDeAdresse(urlPage);
  if (!hotePage || hoteService === hotePage) return "";
  if (estLocal(hoteService) && estLocal(hotePage)) return "";
  if (domaineDe(hoteService) === domaineDe(hotePage)) return "";
  return `Le service est sur « ${domaineDe(hoteService)} » et l'application sur « ${domaineDe(hotePage)} » : `
    + "deux SITES différents. Les cookies du service (session et anti-CSRF) sont posés `SameSite=Lax` — ils ne traversent "
    + "PAS d'un site à l'autre, et le service refusera alors chaque écriture (`session_absente`) tout en répondant aux lectures. "
    + "Servez le service sous `/v1/` du même domaine (laissez l'adresse vide), ou sur un sous-domaine du domaine de l'application.";
}
