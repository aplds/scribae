// ============================================================================
// LE COMPTE APPLICATIF DE LA BASE — les ordres SQL qui le remettent au `.env`.
//
// POURQUOI CE MODULE EXISTE. MariaDB crée le compte applicatif au PREMIER
// démarrage d'un dossier de données VIERGE, et jamais ensuite : changer
// `DB_PASSWORD` dans le `.env` ne change PAS le mot de passe inscrit en base, et
// le service se voit alors refuser l'accès (« Access denied for user
// 'scriba'@… ») alors que le `.env` est correct. Le remède est une poignée
// d'ordres SQL — et ces ordres se construisent ICI, à part, pour être éprouvés
// sans base : une apostrophe mal échappée dans un mot de passe serait sinon une
// panne silencieuse, découverte le jour où l'on en a le moins besoin.
//
// Module PUR : ni Node, ni MySQL, ni réseau. Le service s'en sert
// (`server.mjs`, `--reconcilier`) ; le compose l'appelle à chaque démarrage
// (service `db-init`).
//
// Ce que ces ordres NE font pas : ils ne touchent à aucune TABLE et à aucune
// DONNÉE. Ils créent la base si elle manque, créent le compte si elle manque, et
// lui donnent le mot de passe et les droits du `.env`.
// ============================================================================

// Un LITTÉRAL de chaîne SQL — pour un nom de compte, un hôte, un mot de passe.
// On entoure d'apostrophes et on double ce qui, sinon, sortirait de la chaîne :
//   • l'apostrophe, doublée (`''`) ;
//   • la barre oblique inverse, doublée elle aussi : MySQL et MariaDB la
//     traitent comme un caractère d'échappement À L'INTÉRIEUR d'une chaîne, si
//     bien qu'un mot de passe finissant par « \ » avalerait l'apostrophe fermante.
// Un mot de passe contenant « '; DROP DATABASE … » reste ainsi ce qu'il est :
// une valeur, jamais une commande.
export function litteral(valeur) {
  return "'" + String(valeur == null ? "" : valeur).replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
}

// Un IDENTIFIANT SQL — un nom de base, de table, de colonne. Il ne s'échappe pas
// comme une chaîne : il s'entoure d'accents graves, doublés s'ils apparaissent.
export function identifiant(valeur) {
  return "`" + String(valeur == null ? "" : valeur).replace(/`/g, "``") + "`";
}

// LES ORDRES, dans l'ordre où ils doivent courir :
//   • `CREATE DATABASE IF NOT EXISTS` — la base peut manquer (compte créé à la
//     main, base supprimée, base externe neuve) ;
//   • `CREATE USER IF NOT EXISTS` — le compte peut manquer pour les mêmes
//     raisons ;
//   • `ALTER USER … IDENTIFIED BY` — LE cœur : le mot de passe devient celui du
//     `.env`, même si le compte existait déjà avec un autre ;
//   • `GRANT ALL PRIVILEGES ON <base>.*` — les droits sur la SEULE base de
//     l'application (jamais `*.*`) ;
//   • `FLUSH PRIVILEGES` — que la prise en compte soit immédiate.
// `IDENTIFIED BY` est compris de MariaDB 10.2+ comme de MySQL 5.7+ — et il
// CONSERVE le greffon d'authentification du compte s'il en a un (MySQL 8 le crée
// en `caching_sha2_password`, que le service sait présenter).
//
// `hote` vaut « % » comme le compte créé par l'image MariaDB (`MARIADB_USER_HOST`
// par défaut) : le compte est joignable depuis le RÉSEAU INTERNE de la pile (le
// port de la base n'est jamais publié). Un hôte plus étroit n'aurait pas de sens
// ici : l'adresse du service dans le réseau change à chaque recréation.
export function sqlCompteApplicatif({ base, utilisateur, motDePasse, hote = "%" }) {
  const b = identifiant(base);
  const compte = litteral(utilisateur) + "@" + litteral(hote);
  const mdp = litteral(motDePasse);
  return [
    `CREATE DATABASE IF NOT EXISTS ${b} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    `CREATE USER IF NOT EXISTS ${compte} IDENTIFIED BY ${mdp};`,
    `ALTER USER ${compte} IDENTIFIED BY ${mdp};`,
    `GRANT ALL PRIVILEGES ON ${b}.* TO ${compte};`,
    "FLUSH PRIVILEGES;",
  ].join("\n");
}
