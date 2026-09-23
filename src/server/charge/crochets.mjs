// ============================================================================
// Crochets de chargement de Node — pour remplacer `mysql2/promise`.
//
// POURQUOI. `server.mjs` construit sa file de connexions avec
// `mysql.createPool(...)` : c'est la seule dépendance du service, et la seule
// chose qui l'empêche de démarrer sans base installée. Ce crochet
// (`module.register`, Node 20.6+) substitue à `mysql2/promise` la base en
// mémoire de `faux-mysql.mjs`. Tout le reste — le serveur HTTP de Node, le
// chiffrement, le disque — reste le VRAI : c'est bien le service, sur une vraie
// socket, que la charge éprouve.
//
// Ce fichier ne sert qu'au mode `--sans-base`. Sur une base installée, on ne
// passe pas par ici.
// ============================================================================

export async function resolve(specifier, contexte, suivant) {
  if (specifier === "mysql2/promise" || specifier === "mysql2") {
    return { url: new URL("./mysql-bouchon.mjs", import.meta.url).href, shortCircuit: true };
  }
  return suivant(specifier, contexte);
}
