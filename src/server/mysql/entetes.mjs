// ============================================================================
// En-têtes HTTP : rien qui puisse faire tomber le service.
//
// Node refuse TOUT caractère non ASCII dans une valeur d'en-tête (RFC 7230) :
// `res.writeHead()` lève alors `TypeError [ERR_INVALID_CHAR]`. Le service
// portait `x-service: « Scribae — service de la collectivité »` — un tiret
// cadratin et des accents — sur CHAQUE réponse. L'exception n'étant rattrapée
// nulle part, elle remontait au gestionnaire global, qui rappelait `send()`,
// qui levait à son tour : le processus sortait (`exit 1`), le conteneur
// redémarrait en boucle, et nginx servait des 502.
//
// Deux protections, réunies ici pour être éprouvées sans base ni réseau :
//   1. `entetesSurs` écarte AVANT écriture toute valeur douteuse : un en-tête
//      n'est jamais un véhicule pour une donnée d'entrée (origine de requête,
//      message d'erreur, nom d'acte…) ;
//   2. `ecrireEntetes` encadre `writeHead` : même un en-tête imprévu ne fait pas
//      sortir le processus — on se rabat sur un jeu minimal.
// ============================================================================

// Le nom technique du service : entièrement ASCII, réservé aux EN-TÊTES. Le nom
// affiché (« Scribae — service de la collectivité ») reste pour les journaux et
// les corps JSON, où l'UTF-8 est légitime.
export const SERVICE_ID = "scribae";

// RFC 7230 : un nom est un « token », une valeur est une suite d'ASCII
// imprimable (tabulation tolérée).
const RFC7230_VALEUR = /^[\t\x20-\x7e]*$/;
const RFC7230_NOM = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

const journalDefaut = (message) => console.error(message);

// Rend une copie des en-têtes où ne subsistent que les couples nom/valeur
// valides. Toute valeur écartée est signalée au journal — jamais silencieusement
// transmise.
export function entetesSurs(entetes, { journal = journalDefaut } = {}) {
  const surs = {};
  for (const [nom, valeur] of Object.entries(entetes)) {
    const v = valeur === null || valeur === undefined ? "" : String(valeur);
    if (!RFC7230_NOM.test(nom) || !RFC7230_VALEUR.test(v)) {
      journal(`[entete] valeur refusée pour « ${nom} » (caractère non ASCII ou de contrôle) : en-tête écarté.`);
      continue;
    }
    surs[nom] = v;
  }
  return surs;
}

// Écrit les en-têtes de la réponse. En cas d'échec, retente avec le minimum
// vital plutôt que de laisser l'exception abattre le processus. Rend `true` si
// une réponse a pu être amorcée.
export function ecrireEntetes(res, status, entetes, { journal = journalDefaut } = {}) {
  try {
    if (!res.headersSent) res.writeHead(status, entetes);
    return true;
  } catch (e) {
    journal(`[entete] writeHead a échoué, repli sur les en-têtes minimaux : ${e && e.message}`);
    try {
      if (!res.headersSent) res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      return true;
    } catch (e2) {
      journal(`[entete] le repli minimal a échoué : ${e2 && e2.message}`);
      try { res.destroy(); } catch (e3) { /* rien à faire */ }
      return false;
    }
  }
}
