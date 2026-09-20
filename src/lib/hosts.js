// ============================================================================
// Hôtes d'exécution : où l'application trouve les services de son hôte.
//
// L'application a trois dépendances d'environnement :
//
//   kv                  stockage clé/valeur par dossier (référentiel, trames,
//                       actes, comptes, métadonnées, session)
//   createServerSocket  canal vers l'API du service (dépôt, signature,
//                       publication, base de données partagée)
//   superFetch          relais HTTP sans CORS, pour les services tiers que le
//                       navigateur ne peut pas appeler lui-même (numérotation
//                       externe — voir src/lib/numbering.js). Facultatif : son
//                       absence ne prive que cette fonction.
//
// Les trois sont normalement posés par l'hébergement, sur l'objet global `root`.
// L'édition statique (GitHub Pages) les fournit autrement, dans
// `window.__SCRIBA_HOST__` (voir `src/pages/host.js`) : ce module est le seul
// endroit qui sait où chercher, pour que le reste de l'application n'ait jamais
// à le deviner.
// ============================================================================

export function hostKv() {
  const host = globalThis.__SCRIBA_HOST__;
  if (host && host.kv) return host.kv;
  return globalThis.root?.kv || globalThis.kv || null;
}

export function hostSocketFactory() {
  const host = globalThis.__SCRIBA_HOST__;
  if (host && typeof host.createServerSocket === "function") return host.createServerSocket;
  return typeof globalThis.root?.createServerSocket === "function" ? globalThis.root.createServerSocket : null;
}

// Relais HTTP : un `fetch` qui n'est pas soumis au CORS, pour les services
// tiers que le navigateur ne peut pas appeler lui-même (numérotation externe —
// voir src/lib/numbering.js). Fourni par la plateforme (`root.superFetch`) ;
// l'auto-hébergement peut le poser dans `__SCRIBA_HOST__`.
export function hostSuperFetch() {
  const host = globalThis.__SCRIBA_HOST__;
  if (host && typeof host.superFetch === "function") return host.superFetch;
  return typeof globalThis.root?.superFetch === "function" ? globalThis.root.superFetch : null;
}

// Moteur de langage intégré (`generateText`, le plugin ai-text de Perchance).
// FACULTATIF : il n'existe que sur Perchance. Hors de là — page servie en
// statique, ou déploiement auto-hébergé — l'application n'a pas de moteur par
// défaut, et l'administrateur branche celui de la collectivité à la place
// (Administration › Assistants). Voir src/lib/assistant.js.
//
// La fonction est rendue LIÉE à son objet : détachée de `root`, elle perdrait
// le contexte sur lequel le plugin s'appuie.
export function hostGenerateText() {
  const host = globalThis.__SCRIBA_HOST__;
  if (host && typeof host.generateText === "function") return host.generateText.bind(host);
  const racine = globalThis.root;
  return racine && typeof racine.generateText === "function" ? racine.generateText.bind(racine) : null;
}
