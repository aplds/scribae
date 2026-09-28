// ============================================================================
// LES ÉTATS D'UN ACTE — une seule table, pour tout le logiciel.
//
// Le même état se lisait autrement selon l'écran : « Prêt » sur le registre, le
// chrono, le détail et les modifications, « Prêt à signer » sur l'écran de
// signature ; « Exporté » était vert ici et bleu là. Cinq tables en recopiaient
// le vocabulaire (voir NC-III-011). C'est exactement ce que le dépôt s'interdit
// ailleurs : « une règle, une seule mise en œuvre ».
//
// La table vit donc dans `lib/` — ni DOM, ni état d'application — et les écrans
// la LISENT, ils ne la recopient pas. Le libellé arbitré est « Prêt » : c'est
// celui de la majorité des écrans, celui du glossaire du guide, et celui qui
// tient dans une colonne de registre (l'étape de validation, elle, garde son
// verdict « Prêt à signer », qui est une autre notion — voir lib/validation.js).
// L'état `exporte` garde la couleur `success` de la table d'origine.
//
// `chrono` s'en sert pour ses lignes d'acte et n'y ajoute que ses trois états
// propres (numéro annulé, rang libre, numéro attribué par un service).
// ============================================================================

export const ACTE_STATUTS = {
  brouillon: { label: "Brouillon", color: "warning" },
  pret: { label: "Prêt", color: "info" },
  exporte: { label: "Exporté", color: "success" },
  en_signature: { label: "En signature", color: "warning" },
  signee: { label: "Signé", color: "success" },
  publie: { label: "Publié", color: "success" },
  en_attente: { label: "En attente de publication", color: "info" },
  abroge: { label: "Abrogé", color: "error" },
};

export const acteStatut = (s) => ACTE_STATUTS[s] || null;
export const acteStatutLabel = (s) => ACTE_STATUTS[s]?.label || s || "Brouillon";
export const acteStatutColor = (s) => ACTE_STATUTS[s]?.color || "warning";

// Un acte encore modifiable dans l'éditeur de rédaction : un acte signé ou
// publié ne se réécrit pas, il se modifie (acte modificatif + version consolidée).
export const isDraftable = (s) => !["signee", "publie", "en_attente", "abroge"].includes(s || "brouillon");
