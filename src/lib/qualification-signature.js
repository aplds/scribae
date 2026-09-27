// ============================================================================
// La QUALIFICATION d'une signature — et ce que l'acte publié doit en dire.
//
// Un acte opposable se reconnaît à sa signature, et une signature n'a pas
// toujours la même valeur : le règlement (UE) n° 910/2014 (eIDAS) distingue la
// signature électronique SIMPLE, AVANCÉE et QUALIFIÉE, et seule la dernière
// produit l'effet d'une signature manuscrite devant un juge. Scribae sait
// produire les trois familles :
//
//   • « simple »    — le signataire signe DANS l'application, avec son compte
//                     (ouverture de session et déclaration cochée) ; la clé est
//                     engendrée par le navigateur ;
//   • « avancee »   — un prestataire signe, et son certificat est vérifié ;
//   • « avancee »   (variante INTERNE) — c'est le SERVICE de la collectivité qui
//                     signe, avec la clé du signataire gardée scellée dans son
//                     coffre : la clé ne quitte jamais le serveur, ce qui est
//                     exactement la condition eIDAS de la signature avancée
//                     (contrôle exclusif de la clé par le signataire) — mais
//                     l'autorité d'émission n'est pas qualifiée ;
//   • « externe »   — l'acte est signé hors de l'application (papier ou outil
//                     tiers) et la version signée est déposée et certifiée.
//
// Or la valeur probante ne se déduit pas du geste : elle se DIT. Un acte publié
// par une signature simple ne doit pas se présenter comme un acte signé au sens
// plein — l'audit l'a relevé (NC-IV-001 : « ce qui est simulé doit être nommé »),
// et la mention est la seule réponse tenable tant qu'aucun prestataire qualifié
// n'est branché. Ce module porte donc, en un seul endroit, la phrase qui
// qualifie chaque circuit — celle que la version publiée affiche et que le
// JSON-LD transporte.
//
// Module PUR : ni DOM, ni état, ni configuration — il reçoit un niveau et deux
// faits (prestataire simulé, prestataire nommé) et rend la qualification.
// ============================================================================

// Les niveaux connus, du moins au plus fort. « externe » n'est pas un degré de
// eIDAS : c'est le circuit où la signature a été donnée HORS de l'application,
// et où c'est le PDF déposé qui fait foi.
export const NIVEAUX = ["simple", "avancee", "qualifiee", "externe"];

export const niveauConnu = (n) => (NIVEAUX.includes(String(n || "")) ? String(n) : "");

// La phrase du niveau le plus faible — celle qui prévient.
export const MENTION_SIMPLE =
  "Signature électronique simple, donnée dans l'application par le signataire, avec son compte. "
  + "Elle n'est pas une signature qualifiée au sens du règlement (UE) n° 910/2014 (eIDAS) : elle établit "
  + "l'identité du signataire dans l'application, et non devant un tiers. La valeur probante de l'acte "
  + "repose sur l'original conservé et sur la vérifiabilité de sa signature, non sur un certificat qualifié.";

export const MENTION_AVANCEE_SIMULEE =
  "Signature électronique avancée, produite par un prestataire de signature SIMULÉ sur cette installation : "
  + "le certificat est un certificat de démonstration et n'a pas la valeur d'une signature qualifiée "
  + "(règlement (UE) n° 910/2014, eIDAS).";

// LA VARIANTE INTERNE : ce n'est pas un prestataire qui a signé, c'est le service
// de la collectivité lui-même, avec une clé qu'il détient seul. La distinction
// compte pour qui lit l'acte : le signataire et l'émetteur du certificat
// appartiennent à la même organisation, et l'autorité d'émission n'est pas une
// autorité de confiance qualifiée. Le dire est ce qui tient la qualification.
export const MENTION_AVANCEE_INTERNE =
  "Signature électronique avancée, produite par le SERVICE de la collectivité : la clé privée du signataire est "
  + "détenue et scellée par le service, et ne quitte jamais le serveur — le poste de signature n'y a pas accès. "
  + "L'autorité qui a émis le certificat est interne à la collectivité : cette signature n'est donc pas qualifiée "
  + "au sens du règlement (UE) n° 910/2014 (eIDAS), qui suppose un prestataire de confiance qualifié.";

export const MENTION_AVANCEE =
  "Signature électronique avancée, produite par un prestataire de signature et vérifiée par le service. "
  + "Elle n'est pas qualifiée au sens du règlement (UE) n° 910/2014 (eIDAS) : cette qualification suppose un "
  + "prestataire de confiance qualifié.";

export const MENTION_QUALIFIEE =
  "Signature électronique qualifiée, délivrée par un prestataire de confiance qualifié "
  + "(règlement (UE) n° 910/2014, eIDAS).";

export const MENTION_EXTERNE =
  "Signature apposée hors de l'application (papier ou outil tiers). C'est la version signée déposée qui fait "
  + "foi ; l'application en conserve la pièce et garde trace de sa conformité.";

// Le libellé COURT : ce qu'on écrit dans une pastille ou une ligne de notice.
const LABELS = {
  simple: "Signature simple — non qualifiée",
  avancee: "Signature avancée",
  qualifiee: "Signature qualifiée",
  externe: "Signature externe",
};

// La qualification d'une signature, telle qu'un acte publié doit la présenter.
//
//   niveau      un des NIVEAUX, ou "" si l'information manque (ancien
//               enregistrement : on ne devine pas, on se tait) ;
//   simule      le prestataire est-il simulé sur cette installation ?
//   prestataire le nom du prestataire, s'il est connu — ou l'objet
//               `{ id, nom }`. L'identifiant `scribae-interne` dit que c'est le
//               SERVICE qui a signé : la mention le nomme alors pour ce qu'il est.
export function qualificationSignature({ niveau = "", simule = false, prestataire = "" } = {}) {
  const n = niveauConnu(niveau);
  const id = String((prestataire && prestataire.id) || "").trim();
  const nom = String((prestataire && prestataire.nom) || prestataire || "").trim();
  const interne = id === "scribae-interne";
  if (!n) return { niveau: "", label: "", mention: "", qualifiee: false, simulee: false, interne: false, avertissement: false };
  const mention = n === "simple" ? MENTION_SIMPLE
    : n === "qualifiee" ? MENTION_QUALIFIEE
    : n === "externe" ? MENTION_EXTERNE
    : interne ? MENTION_AVANCEE_INTERNE
    : (simule ? MENTION_AVANCEE_SIMULEE : MENTION_AVANCEE);
  return {
    niveau: n,
    label: LABELS[n] + (nom && n === "avancee" ? ` (${interne ? "par le service" : nom})` : ""),
    mention,
    qualifiee: n === "qualifiee",
    simulee: n === "avancee" ? !!simule && !interne : false,
    // L'émetteur est le service lui-même : ni un tiers, ni — surtout — une
    // autorité qualifiée. La notice de l'acte publié peut le dire.
    interne,
    // Ce qui doit se voir : tout ce qui n'est pas qualifié, et tout ce qui est simulé.
    avertissement: n !== "qualifiee" || (!!simule && !interne),
  };
}

// Le niveau d'un acte de l'ATELIER, quand on connaît son circuit : c'est ce que
// la publication transmet au service (`niveau`), et ce qui permet au recueil de
// qualifier la signature des années plus tard, sans relire l'acte.
//
//   circuit                 « simple » | « electronique » | « interne » | « externe »
//   niveauPrestataire       le niveau réglé pour le prestataire (Administration
//                           › Signature) : « simple », « avancee », « qualifiee »
export function niveauDepuisCircuit(circuit, niveauPrestataire = "") {
  const c = String(circuit || "");
  if (c === "externe") return "externe";
  if (c === "simple") return "simple";
  // La signature interne est « avancée » par construction (la clé est sous le
  // contrôle exclusif du signataire, et un certificat est émis) : elle ne peut
  // pas être déclarée qualifiée, faute d'autorité de confiance qualifiée.
  if (c === "interne") return "avancee";
  if (c === "electronique") return niveauConnu(niveauPrestataire) || "avancee";
  return "";
}
