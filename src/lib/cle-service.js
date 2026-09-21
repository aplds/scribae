// ============================================================================
// Clé du service de publication.
//
// La clé d'écriture n'est PAS inscrite dans l'application : elle est remise au
// poste (déploiement auto-hébergé : `__SCRIBA_API_TOKEN__` ; démonstration :
// saisie ou tirée au hasard par un administrateur), conservée dans le réglage
// local de persistance, et seule son empreinte SHA-256 vit côté service.
//
// Ce module n'est que le PORTEUR de la clé en mémoire : `db/index.js` la lui
// remet au chargement et à chaque changement de réglage, et les vues la lisent
// par `cleService()` (elles n'ont pas à connaître le réglage de persistance).
// ============================================================================

let cle = "";

export function definirCleService(valeur) {
  cle = String(valeur || "");
  return cle;
}

export function cleService() {
  return String(globalThis.__SCRIBA_API_TOKEN__ || cle || "");
}
