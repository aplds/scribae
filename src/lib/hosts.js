// ============================================================================
// Hôtes d'exécution : où l'application trouve ses deux services.
//
// L'application n'a que deux dépendances d'environnement :
//
//   kv                  stockage clé/valeur par dossier (référentiel, trames,
//                       actes, comptes, métadonnées, session)
//   createServerSocket  canal vers l'API du service (dépôt, signature,
//                       publication, base de données partagée)
//
// Les deux sont normalement posés par l'hébergement, sur l'objet global `root`.
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
