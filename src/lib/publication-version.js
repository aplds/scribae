// ============================================================================
// La VERSION d'une publication : ce qui distingue deux versions d'un même acte.
//
// Une publication ne s'ÉCRASE pas. Le service la range sous une CLÉ qui porte
// son « expression de date » (voir `hPublier` et `clePublication`, index.html) :
// deux expressions différentes donnent deux VERSIONS du même identifiant ELI —
// l'ancienne reste à l'historique —, et la même expression rend la publication
// déjà déposée (idempotence).
//
// Le JEU DE DÉMONSTRATION se sert de cette mécanique pour ne jamais laisser en
// ligne un texte périmé : ses publications portent un SUFFIXE qui dit la VERSION
// DU JEU. Un jeu modifié — une livraison — publie donc une version NOUVELLE au
// lieu de s'en tenir à « une publication existe », ce qui montrerait l'ancien
// texte au recueil pour toujours (voir src/ui/demo-publications.js).
//
// Ces règles vivent ici, UNE SEULE FOIS : le client qui publie (voir `publier`,
// src/ui/views/signature.js) et l'amorçage qui décide s'il doit republier (voir
// `amorcerRecueil`, src/ui/demo-publications.js) les partagent — et l'épreuve
// les exerce sans navigateur (`src/tests/version-publication.test.mjs`).
// ============================================================================

// Le suffixe qui marque une publication comme celle d'une version donnée du jeu
// (voir `SUFFIXE_JEU`, src/ui/demo-publications.js).
export const suffixeJeu = (seedVersion) => "-s" + String(seedVersion);

// L'expression de date d'une publication : la date du document, suivie du
// suffixe du jeu quand il y en a un. C'est elle qui fait la clé de version.
export const expressionDeJeu = (dateDocument, suffixe) => String(dateDocument || "") + (suffixe || "");

// La publication détenue par le service est-elle celle de CE jeu ? Vraie dès
// qu'elle porte le suffixe — et donc toujours vraie quand aucun suffixe n'est
// demandé (rien à rattraper). Une publication ABSENTE, ou dont la clé ne porte
// pas le suffixe, est PÉRIMÉE : c'est ce qui fait publier.
export const publicationDuJeu = (resume, suffixe) => !suffixe || !!(resume && String(resume.cle || "").includes(suffixe));

// La clé d'idempotence d'une publication : l'ELI, la date du document, le genre,
// et l'expression quand elle est posée. Elle DOIT porter l'expression : le
// service dédoublonne sur cette clé AVANT de regarder l'expression (voir
// `hPublier`, index.html), si bien qu'un appel rejoué pour une version nouvelle
// avec l'ancienne clé rendrait la publication ANCIENNE — la version neuve ne
// verrait jamais le jour.
export const cleIdempotencePublication = (eliUri, dateDocument, kind, expression) =>
  `${eliUri}@${dateDocument}-${kind}${expression ? "-" + expression : ""}`;
