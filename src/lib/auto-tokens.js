// ============================================================================
// Les JETONS AUTOMATIQUES : ce que l'application remplit seule.
//
// La collectivité, le signataire, la date, le numéro : ces informations ne se
// saisissent pas, elles se savent. Un rédacteur qui compose le texte d'un acte
// doit pourtant pouvoir les poser dans une phrase (« le maire de {{entity.name}} »,
// « à compter du {{dateEffet|date-long}} ») : c'est ce que cette liste rend
// possible, par glisser-déposer, dans l'éditeur de trame comme dans l'atelier
// de rédaction.
//
// Elle vit ici, et non dans une vue, parce que les deux écrans s'en servent.
// ============================================================================
export const AUTO_TOKENS = [
  { token: "entity.name", label: "Nom de la collectivité" },
  { token: "entity.seatCity", label: "Ville du siège" },
  { token: "entity.code", label: "Code de l'entité" },
  { token: "autorite", label: "L'autorité de l'acte (l'assemblée, ou la collectivité)" },
  { token: "signataire.fonction", label: "Fonction du signataire" },
  { token: "signataire.qualite", label: "Qualité du signataire (accordée en genre)" },
  { token: "signataire.autorite.qualiteArticleMaj", label: "L'autorité, avec article (« Le maire » / « La maire »)" },
  { token: "signataire.civility", label: "Civilité du signataire" },
  { token: "signataire.firstName", label: "Prénom du signataire" },
  { token: "signataire.lastName", label: "Nom du signataire" },
  { token: "numero", label: "Numéro de l'acte" },
  { token: "dateSignature|date-long", label: "Date de signature, en toutes lettres" },
];

// Les jetons propres aux ACTES D'ASSEMBLÉE : proposés seulement quand la trame
// déclare produire une délibération (`trame.assemblee`). Voir src/lib/conseils.js.
export const AUTO_TOKENS_CONSEIL = [
  { token: "conseil.name", label: "Nom de l'assemblée délibérante" },
  { token: "conseil.authorityFormula", label: "Formule d'autorité de l'assemblée (« Le conseil municipal de … »)" },
  { token: "conseil.signerQualite", label: "Qualité du signataire appelée par l'assemblée (« maire », « président du conseil d'administration »)" },
  { token: "conseil.signerQualiteArticleMaj", label: "Cette qualité, avec article et majuscule (« Le maire »)" },
];
