// ============================================================================
// Les RÔLES tels que le service les oppose aux requêtes.
//
// Le service ne connaît pas les permissions fines de l'application
// (src/lib/users.js, PERMS) : il ne garde que le RANG dont il a besoin pour
// ses gardes (`{ min }`, `{ exact }`). Mais il doit connaître TOUS les rôles
// de l'application — y compris les qualités cumulables (réviseur,
// signataire) et le visiteur —, sans quoi un compte qui ne porte qu'elles
// retombe sur le repli « lecteur » et se voit refuser ce que l'application
// lui offre : un signataire titulaire, par exemple, voyait son bouton
// « Vérifier et signer » (que `peutSignerEffectivement` lui accorde) répondre
// « Rôle insuffisant » au dépôt.
//
//   administrateur  tout ;
//   editeur         écrit le référentiel et les communications ;
//   redacteur       rédige, dépose, envoie en signature, publie ;
//   reviseur        contrôle avant signature (qualité cumulable) ;
//   signataire      engage sa signature (qualité cumulable) ;
//   lecteur         lit ce que le recueil ne montre pas ;
//   visiteur        authentifié sans accès : ne lit rien par l'API ;
//   prestataire     hors hiérarchie (la seule notification de signature).
//
// Le réviseur et le signataire valent le rédacteur (rang 2) : ce sont des
// agents de l'atelier, et le dépôt comme l'ouverture d'un circuit font partie
// du geste de signature. La signature ELLE-MÊME ne s'en contente pas : elle
// est opposée à la personne (`porteSignature`, src/server/mysql/actes.mjs),
// et une clé de service — qui ne porte aucune personne — ne signe jamais au
// nom de quelqu'un.
//
// Ce module est PUR : ni Node, ni réseau. C'est ce qui permet de l'éprouver
// seul (roles.test.mjs) et dans l'atelier.
// ============================================================================

export const ROLES_CONNUES = [
  "administrateur", "editeur", "redacteur", "reviseur",
  "signataire", "lecteur", "visiteur", "prestataire",
];

export const RANG_ROLE = {
  administrateur: 4,
  editeur: 3,
  redacteur: 2,
  reviseur: 2,
  signataire: 2,
  lecteur: 1,
  visiteur: 0,
};

// Les rôles d'un compte, dans l'ordre où le compte les porte (`roles`, et
// `role` seul pour un compte enregistré avant le cumul).
export function rolesDeCompte(compte) {
  if (compte && Array.isArray(compte.roles) && compte.roles.length) return compte.roles.filter((r) => typeof r === "string");
  if (compte && typeof compte.role === "string" && compte.role) return [compte.role];
  return [];
}

// Le rôle d'un compte : le plus fort de ses rôles. Un compte qui ne porte que
// des qualités cumulables (signataire seul, visiteur + signataire) vaut donc
// sa qualité — et non le repli « lecteur », qui lui fermait le dépôt et
// l'ouverture du circuit. Un compte sans rôle connu est un visiteur : par
// défaut, on refuse, on n'ouvre pas.
export function roleDeCompte(compte) {
  const roles = rolesDeCompte(compte);
  let meilleur = "visiteur";
  let rang = -1;
  for (const r of roles) {
    if (r === "prestataire") continue;
    const rangR = RANG_ROLE[r];
    if (rangR === undefined) continue;
    if (rangR > rang) {
      rang = rangR;
      meilleur = r;
    }
  }
  return meilleur;
}

export function roleAutorise(role, regle) {
  if (!regle) return true;
  if (regle.exact) return regle.exact.includes(role);
  if (regle.min) return (RANG_ROLE[role] || 0) >= RANG_ROLE[regle.min];
  return true;
}
