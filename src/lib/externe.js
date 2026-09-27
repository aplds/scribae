// ============================================================================
// Circuit de signature EXTERNE — la signature sans API (papier, outil tiers).
//
// Tout ne passe pas par un prestataire branché en API. Beaucoup de
// collectivités font signer leurs actes sur PAPIER — ou par un outil tiers que
// l'application ne pilote pas (un parapheur hors ligne, un service de
// signature web sans API, une signature manuscrite scannée). Le circuit
// ÉLECTRONIQUE (voir src/ui/views/signature.js et index.html) ne convient donc
// pas toujours : il suppose un prestataire joignable.
//
// Ce module décrit l'autre circuit, celui qui n'appelle AUCUNE API de
// signature :
//
//   1. le RÉDACTEUR « envoie à signature » — ce qui, ici, veut dire
//      TÉLÉCHARGER le document prêt à signer (une page A4 imprimable, avec son
//      bordereau de remise) ;
//   2. le signataire signe HORS de l'application (stylo, ou outil tiers) ;
//   3. le rédacteur RENTRE la version signée dans la base — un PDF — par
//      « Ajouter la version signée » ;
//   4. le RÉVISEUR CERTIFIE LA CONFORMITÉ du document signé (le PDF, qui porte
//      la signature manuscrite) avec la version numérique qui sera publiée.
//      Son contrôle ne porte plus sur le texte avant signature, mais sur la
//      PIÈCE signée : c'est ce qui garantit que ce qui est publié est bien ce
//      qui a été signé ;
//   5. la publication dépose la version en ligne ET le PDF signé, et le recueil
//      public montre ce PDF comme « l'original » — le document tel qu'il a été
//      mis en ligne.
//
// Le mode se règle à DEUX niveaux, et rien n'est codé en dur :
//
//   • GLOBALEMENT (Administration › Signature) : le circuit ordinaire de la
//     collectivité — électronique (défaut, comportement historique), ou
//     externe ;
//   • PAR TRAME (`trame.signature`) : une trame peut IMPOSER le circuit
//     externe (un registre qui se signe au stylo ne se signe pas autrement),
//     l'AUTORISER (le rédacteur choisit, acte par acte), imposer le circuit
//     électronique, ou suivre le réglage global.
//
// Ce module est pur : il ne connaît ni le DOM ni l'état de l'application.
// ============================================================================
import { prestataireDeploye, signatureInterneDeploye, controleLegaliteDeploye } from "./deploiement-config.js";

// --------------------------------------------------------------- les réglages
// Le circuit général de la collectivité. « electronique » est le comportement
// historique : sans réglage, rien ne change.
export const SIGNATURE_MODES = [
  {
    id: "electronique",
    label: "Circuit électronique (prestataire, API)",
    hint: "L'acte est déposé auprès du service, puis signé dans l'outil du prestataire. La signature est vérifiée par empreinte, et la publication suit automatiquement.",
  },
  {
    id: "simple",
    label: "Signature électronique simple (dans l'application)",
    hint: "Le signataire signe DANS Scribae, avec son compte. La signature est horodatée et sa trace nominative (nom, courriel, compte, moyen d'authentification) est conservée dans l'original interne — jamais diffusée au public, qui ne voit que le nom, la fonction et la date.",
  },
  {
    id: "interne",
    label: "Signature interne (c'est le service qui signe)",
    hint: "Le SERVICE détient la clé privée du signataire, scellée au repos, et signe lui-même : la clé ne quitte jamais le serveur, et le poste ne reçoit que l'original signé (certificat, empreinte, horodatage). C'est une signature avancée au sens d'eIDAS, sans être qualifiée. Elle suppose un coffre — donc l'auto-hébergement : le service de démonstration ne l'offre pas.",
  },
  {
    id: "externe",
    label: "Circuit externe (papier ou outil tiers, sans API)",
    hint: "Le rédacteur télécharge le document prêt à signer, le fait signer hors de l'application, puis dépose la version signée en PDF. Le réviseur certifie la conformité du PDF avec la version numérique avant publication.",
  },
];

export const SIGNATURE_DEFAUT = { mode: "electronique" };

const MODES_VALIDES = ["electronique", "simple", "interne", "externe"];

// ----------------------------------------------------------------------------
// L'API DU PRESTATAIRE DE SIGNATURE (circuit « electronique »).
//
// Le circuit électronique suppose un prestataire joignable — ESUP-Signature, un
// parapheur, l'outil de la collectivité. Jusqu'ici, seule la démonstration
// simulait ce prestataire : en production, il n'y avait NULLE PART où régler
// son adresse, son niveau de signature, sa clé d'API ni son délai. Ces réglages
// sont donc réunis ici (`config.signature.api`), posés à la main dans
// Administration › Signature ou déclarés dans le `.env` du déploiement
// (`SCRIBA_SIGNATURE_API_*`, voir src/server/mysql/variables.mjs).
//
// La CLÉ DU PRESTATAIRE ne vit PAS ici : c'est un secret, il ne se recopie ni
// dans le référentiel, ni dans un export, ni dans la réponse d'une route. Elle
// reste au SERVICE (`SCRIBA_SIGNATURE_API_CLE`) qui seul appelle le prestataire.
//
// `transport` : « service » (c'est le service de la collectivité qui appelle le
// prestataire — seul moyen de garder la clé côté serveur), ou « demonstration »
// (le circuit est simulé : aucun appel sortant, ce qui reste le défaut tant
// qu'aucune adresse n'est renseignée).
export const SIGNATURE_API_DEFAUT = {
  transport: "service",       // service | demonstration
  url: "",                    // base du prestataire, ex. https://signature.exemple.fr/api/v1
  prestataire: "esup-signature", // identifiant du prestataire (libellé technique)
  niveau: "avancee",          // simple | avancee | qualifiee
  urlNotification: "",        // laissée vide = l'adresse du service + /v1/webhooks/signature
  timeoutMs: 20000,
  // Points de terminaison du prestataire, relatifs à `url` — les mêmes jetons
  // que la numérotation externe : {document} {signature} {acte} {numero}.
  cheminDocument: "/documents",
  cheminSignataires: "/documents/{document}/signataires",
  cheminDemarrer: "/documents/{document}/demarrer",
  cheminStatut: "/documents/{document}",
};

const NIVEAUX_VALIDES = ["simple", "avancee", "qualifiee"];

export function signatureSettings(config) {
  const s = (config && config.signature) || {};
  const a = s.api || {};
  return {
    ...SIGNATURE_DEFAUT,
    ...s,
    mode: MODES_VALIDES.includes(s.mode) ? s.mode : "electronique",
    api: {
      ...SIGNATURE_API_DEFAUT,
      ...a,
      niveau: NIVEAUX_VALIDES.includes(a.niveau) ? a.niveau : SIGNATURE_API_DEFAUT.niveau,
      transport: a.transport === "demonstration" ? "demonstration" : "service",
      timeoutMs: Number(a.timeoutMs) || SIGNATURE_API_DEFAUT.timeoutMs,
    },
  };
}

// Le prestataire est-il RÉELLEMENT branché ? Une adresse renseignée, et un
// transport autre que la simulation. C'est cette question qui décide si
// l'application annonce un circuit électronique opérationnel ou une simulation.
export const prestataireBranche = (config) => {
  const a = signatureSettings(config).api;
  return a.transport !== "demonstration" && !!String(a.url || "").trim();
};

// ----------------------------------------------------------------------------
// LE CIRCUIT ÉLECTRONIQUE EST-IL SIMULÉ ?
//
// La question ne se tranche pas dans le navigateur : c'est le SERVICE qui sait
// s'il détient la clé du prestataire (`SCRIBA_SIGNATURE_API_CLE`) et s'il
// appellera vraiment son API. Sans service (aperçu en ligne, page statique), ou
// quand le service dit qu'il n'est pas branché, le circuit est SIMULÉ : c'est
// l'application qui joue le prestataire, sans rien faire sortir de la
// collectivité. Voir src/lib/deploiement-config.js (l'état rendu par
// `GET /v1/config`) et src/ui/views/signature.js, qui en tire la façon de mener
// l'acte : lien réel du prestataire, ou outil de démonstration embarqué.
// ----------------------------------------------------------------------------
export const prestataireDuService = () => prestataireDeploye();

export const circuitElectroniqueSimule = () => {
  const svc = prestataireDeploye();
  // Pas de service qui parle : rien ne peut sortir, donc simulation.
  if (!svc) return true;
  // Le service dit lui-même s'il est branché (adresse ET clé présentes).
  return !svc.actif;
};

// Pourquoi le circuit est simulé, en une phrase — celle qu'on montre à
// l'administrateur. Quand le service parle, c'est SON motif qui fait foi.
export function motifCircuitSimule(config) {
  const svc = prestataireDeploye();
  if (svc) return svc.motif || (svc.actif ? "" : "Le prestataire n'est pas configuré sur le service.");
  const a = signatureSettings(config).api;
  if (a.transport === "demonstration") return "Le transport est réglé sur « demonstration » : aucun appel sortant.";
  if (!String(a.url || "").trim()) return "Aucune adresse de prestataire n'est renseignée : le circuit électronique est simulé.";
  return "Cette page n'est pas servie par le service de la collectivité : le prestataire ne peut pas être appelé d'ici.";
}

// ----------------------------------------------------------------------------
// LA SIGNATURE INTERNE EST-ELLE OFFERTE PAR CE SERVICE ?
//
// Elle suppose un COFFRE : le service détient la clé privée du signataire,
// scellée au repos sous une clé du `.env` (`SCRIBA_SIGNATURE_KV_KEY`). Le service
// dit lui-même s'il en tient un (`GET /v1/config`, champ `signatureInterne`) —
// c'est la seule réponse qui vaille : un poste ne peut pas savoir si le serveur
// a un coffre, et une page statique encore moins. Sans service qui parle (aperçu
// en ligne, page statique) ou sans clé de scellement, le circuit est ÉTEINT, et
// on le dit plutôt que d'offrir un geste qui sera refusé.
// ----------------------------------------------------------------------------
export const signatureInterneDuService = () => signatureInterneDeploye();

export const signatureInterneDisponible = () => {
  const c = signatureInterneDeploye();
  return !!(c && c.disponible === true);
};

// Pourquoi la signature interne n'est pas offerte, en une phrase — celle qu'on
// montre à l'agent et à l'administrateur. Vide quand elle est disponible.
export function motifSignatureInterne() {
  const c = signatureInterneDeploye();
  if (c) return c.disponible === true ? "" : (c.motif || "Le service n'a pas de coffre de signature interne.");
  return "Cette page n'est pas servie par le service de la collectivité : la signature interne suppose un coffre, et donc l'auto-hébergement (voir src/server/README.md).";
}

// Le prestataire « interne » : ce que la qualification de la signature doit
// savoir de l'émetteur. Il n'est pas un tiers — c'est le service lui-même — et
// la mention de l'acte publié le dit (voir qualification-signature.js).
export const PRESTATAIRE_INTERNE = { id: "scribae-interne", nom: "Signature interne du service" };

// ----------------------------------------------------------------------------
// LA TÉLÉTRANSMISSION AU CONTRÔLE DE LÉGALITÉ EST-ELLE RÉELLE ?
//
// L'application peut ACTIVER l'étape (Administration › Expérimentale), mais elle
// ne sait pas si le service, lui, appellera vraiment l'API @ctes : cela dépend de
// la clé et de l'adresse posées dans le `.env` du déploiement, que le navigateur
// ne voit jamais. C'est le service qui le dit (`GET /v1/config`, champ
// `controleLegalite`) — et c'est ce que l'écran d'administration affiche, pour ne
// pas laisser croire à une transmission réelle là où le certificat ne sera qu'une
// simulation marquée.
// ----------------------------------------------------------------------------
export const controleLegaliteDuService = () => controleLegaliteDeploye();

export const controleLegaliteReelle = () => {
  const c = controleLegaliteDeploye();
  return !!(c && c.actif === true);
};

// Pourquoi la transmission n'est pas réelle, en une phrase — celle qu'on montre à
// l'administrateur. Vide quand elle l'est.
export function motifControleLegaliteSimule() {
  const c = controleLegaliteDeploye();
  if (c) return c.actif === true ? "" : (c.motif || "Le service n'appelle pas l'API du contrôle de légalité.");
  return "Cette page n'est pas servie par le service de la collectivité : la télétransmission ne peut partir que du service auto-hébergé (voir src/server/README.md).";
}

// Les réglages du prestataire tels que le service les reçoit au dépôt de
// l'acte et à l'ouverture du circuit : jamais la clé, qui ne quitte pas le
// serveur. C'est ce que l'application joint à `POST /v1/actes/{id}/signature`.
export function reglagesPrestataire(config) {
  const a = signatureSettings(config).api;
  return {
    transport: a.transport,
    url: String(a.url || "").trim(),
    prestataire: a.prestataire,
    niveau: a.niveau,
    urlNotification: String(a.urlNotification || "").trim(),
    timeoutMs: a.timeoutMs,
    chemins: {
      document: a.cheminDocument,
      signataires: a.cheminSignataires,
      demarrer: a.cheminDemarrer,
      statut: a.cheminStatut,
    },
  };
}

export const modeLabel = (id) =>
  (SIGNATURE_MODES.find((m) => m.id === id) || SIGNATURE_MODES[0]).label;

// Le réglage porté par une TRAME. Deux valeurs nouvelles : le circuit externe
// est IMPOSÉ, ou seulement AUTORISÉ (le rédacteur tranche, acte par acte).
export const MODES_TRAME = [
  { id: "", label: "Automatique — suit le réglage général" },
  { id: "electronique", label: "Circuit électronique imposé" },
  { id: "simple_impose", label: "Signature simple imposée (dans l'application)" },
  { id: "simple_autorise", label: "Signature simple autorisée (au choix du rédacteur)" },
  { id: "interne_impose", label: "Signature interne imposée (c'est le service qui signe)" },
  { id: "interne_autorise", label: "Signature interne autorisée (au choix du rédacteur)" },
  { id: "externe_impose", label: "Circuit externe imposé" },
  { id: "externe_autorise", label: "Circuit externe autorisé (au choix du rédacteur)" },
];

export const trameModeLabel = (id) => (MODES_TRAME.find((m) => m.id === id) || MODES_TRAME[0]).label;

// ---------------------------------------------------------------- résolution
// Le circuit applicable à une trame. Rend :
//   mode          le circuit retenu par défaut (electronique | simple | externe) ;
//   choix         true si le rédacteur peut choisir, acte par acte ;
//   externePermis true si le circuit externe est ouvert pour cette trame ;
//   simplePermis  true si la signature simple est ouverte pour cette trame ;
//   source        « trame » ou « global » — ce qui a décidé ;
//   impose        true si aucun choix n'est laissé.
//
// `circuitsDisponibles` dit, à partir de cette résolution, les circuits entre
// lesquels le rédacteur peut réellement trancher — c'est ce que l'écran
// « Signature » présente, et rien d'autre.
export function circuitPour(config, trame) {
  const t = String((trame && trame.signature) || "");
  const g = signatureSettings(config).mode;
  if (t === "externe_impose") return { mode: "externe", choix: false, externePermis: true, simplePermis: false, internePermis: false, impose: true, source: "trame" };
  if (t === "interne_impose") return { mode: "interne", choix: false, externePermis: false, simplePermis: false, internePermis: true, impose: true, source: "trame" };
  if (t === "simple_impose") return { mode: "simple", choix: false, externePermis: false, simplePermis: true, internePermis: false, impose: true, source: "trame" };
  if (t === "electronique") return { mode: "electronique", choix: false, externePermis: false, simplePermis: false, internePermis: false, impose: true, source: "trame" };
  if (t === "externe_autorise") return { mode: g, choix: true, externePermis: true, simplePermis: false, internePermis: false, impose: false, source: "trame" };
  if (t === "interne_autorise") return { mode: g, choix: true, externePermis: false, simplePermis: false, internePermis: true, impose: false, source: "trame" };
  if (t === "simple_autorise") return { mode: g, choix: true, externePermis: false, simplePermis: true, internePermis: false, impose: false, source: "trame" };
  return { mode: g, choix: false, externePermis: g === "externe", simplePermis: g === "simple", internePermis: g === "interne", impose: g !== "electronique", source: "global" };
}

// Les circuits entre lesquels un acte peut être mené, d'après la résolution
// ci-dessus : toujours celui qui est retenu, plus ceux que la trame ouvre.
//
// La SIGNATURE INTERNE n'y figure que si le SERVICE dit qu'il en tient le coffre
// (`signatureInterneDisponible`) : offrir un circuit que le service refusera
// ferait perdre un geste à l'agent. Un circuit IMPOSÉ, lui, reste affiché même
// éteint — c'est un réglage à corriger, et l'écran le dit.
export function circuitsDisponibles(config, trame) {
  const c = circuitPour(config, trame);
  if (!c.choix) return [c.mode];
  const liste = [c.mode];
  if (c.externePermis && !liste.includes("externe")) liste.push("externe");
  if (c.simplePermis && !liste.includes("simple")) liste.push("simple");
  if (c.internePermis && !liste.includes("interne")) liste.push("interne");
  const offerts = liste.filter((m) => m !== "interne" || signatureInterneDisponible());
  return offerts.length ? offerts : liste;
}

// Le circuit effectivement retenu pour un ACTE : le choix du rédacteur, quand
// la trame le laisse choisir, ne peut pas sortir de ce qu'elle autorise.
//
// Un acte DÉJÀ ENGAGÉ dans un circuit y reste : dès qu'un dossier de signature
// externe est ouvert (`acte.externe`), qu'un circuit électronique l'est
// (`acte.api`), ou que la signature simple a été donnée (`acte.signatureSimple`),
// son circuit est acquis. Changer le réglage général ou la trame ne déplace pas
// un acte en cours de route — sinon un acte déjà signé sur papier se retrouverait
// à devoir l'être par le prestataire.
export function modeSignature(config, trame, acte) {
  if (acte && acte.externe) return "externe";
  if (acte && acte.signatureSimple) return "simple";
  // Un acte signé par le SERVICE (`signatureInterne`) est acquis à ce circuit,
  // comme les deux autres : changer le réglage général ne le déplace pas.
  if (acte && acte.signatureInterne) return "interne";
  // Un acte dont le circuit SIMPLE est ouvert porte lui aussi un `acte.api` : le
  // dépôt au service est commun aux deux circuits (c'est le même dossier, seul
  // le niveau demandé diffère). Sans ce test, il serait relu « électronique » dès
  // le rechargement suivant, et la fenêtre de signature céderait la place à
  // l'outil du prestataire — pour un acte que le signataire doit signer ici.
  if (acte && (acte.signatureMode === "simple" || (acte.api && acte.api.niveau === "simple"))) return "simple";
  // Le circuit INTERNE, lui aussi, passe par un dépôt /v1/actes : `niveau` y vaut
  // « interne ». Même raison de le reconnaître avant le circuit électronique.
  if (acte && (acte.signatureMode === "interne" || (acte.api && acte.api.niveau === "interne"))) return "interne";
  if (acte && acte.api && acte.api.acteId) return "electronique";
  const c = circuitPour(config, trame);
  if (!c.choix) return c.mode;
  const m = acte && acte.signatureMode;
  if (m && circuitsDisponibles(config, trame).includes(m)) return m;
  return c.mode;
}

// ------------------------------------------------------------- l'état du dossier
// Un acte mené par le circuit externe porte son dossier de signature dans
// `acte.externe` :
//
//   statut        a_signer | signe_depose | certifie | refuse
//   demandeLe     quand le document prêt à signer a été remis
//   document      { empreinte, genereLe, reference } — le document remis
//   signe         { url, sha256, nom, taille, deposeLe, deposePar, deposeParNom }
//   certification { statut, par, parNom, le, empreinte, sha256Signe, points, motif }
//   certificationRequise  true si un réviseur est compétent pour l'acte, et
//                         doit donc certifier la conformité avant publication
export const STATUTS_EXTERNE = {
  a_signer: { label: "Document remis au signataire", color: "warning" },
  signe_depose: { label: "Version signée déposée", color: "info" },
  certifie: { label: "Conformité certifiée", color: "success" },
  refuse: { label: "Conformité refusée", color: "error" },
};

export const statutExterne = (acte) => (acte && acte.externe && acte.externe.statut) || "";
export const statutExterneLabel = (s) => (STATUTS_EXTERNE[s] || { label: s || "—" }).label;
export const statutExterneColor = (s) => (STATUTS_EXTERNE[s] || { color: "info" }).color;

// Le document remis a-t-il été signé et déposé ?
export const versionSignee = (acte) => (acte && acte.externe && acte.externe.signe) || null;

// La certification du réviseur.
export const certificationDe = (acte) => (acte && acte.externe && acte.externe.certification) || null;
export const certificationRequise = (acte) => !!(acte && acte.externe && acte.externe.certificationRequise);
export const estCertifie = (acte) => (certificationDe(acte) || {}).statut === "conforme";

// L'acte peut-il être publié du point de vue du circuit externe ? Trois
// conditions : la version signée est déposée, la conformité est certifiée
// (quand un réviseur est compétent), et rien n'est en attente.
export function publicationExternePossible(acte) {
  if (!versionSignee(acte)) {
    return { ok: false, raison: "La version signée n'a pas encore été déposée : l'acte ne peut pas être publié." };
  }
  if (certificationRequise(acte)) {
    const c = certificationDe(acte) || {};
    if (c.statut === "non_conforme") {
      return { ok: false, raison: "Le réviseur a refusé de certifier la conformité de la version signée" + (c.motif ? " : « " + c.motif + " »" : ".") };
    }
    if (c.statut !== "conforme") {
      return { ok: false, raison: "La conformité de la version signée attend la certification du réviseur." };
    }
  }
  return { ok: true, raison: "" };
}

// L'acte est-il « signé » au sens du circuit externe (la pièce existe) ?
export const signeeExterne = (acte) => !!versionSignee(acte);

// ---------------------------------------------------- la signature simple
// Le dossier de la signature donnée DANS l'application : le signataire a signé
// avec son compte, et tout ce qui l'identifie nominativement est consigné ici —
// pour la part non diffusable de l'original. Ces accesseurs lisent l'acte, quel
// que soit l'endroit où le dossier a été posé (`acte.signatureSimple`).
export const dossierSimple = (acte) => (acte && acte.signatureSimple) || null;
export const dossierSimpleInterne = (acte) => {
  const d = dossierSimple(acte);
  return (d && d.interne) || null;
};
export const signeeSimple = (acte) => !!(acte && acte.signatureSimple && acte.signatureSimple.signeLe);

// -------------------------------------------------- la signature interne
// Le dossier de la signature donnée par le SERVICE : le signataire n'a pas de
// clé sur son poste — c'est le service qui signe avec la sienne, gardée scellée
// dans son coffre. L'acte porte alors `acte.signatureInterne` : la trace du
// geste (date, empreinte, algorithme, valeur) et le dossier interne que le
// service a renvoyé. Mêmes lecteurs que la signature simple, autre circuit.
export const dossierInterneSignature = (acte) => (acte && acte.signatureInterne) || null;
export const dossierInterneSignatureInterne = (acte) => {
  const d = dossierInterneSignature(acte);
  return (d && d.interne) || null;
};
export const signeeInterne = (acte) => !!(acte && acte.signatureInterne && acte.signatureInterne.signeLe);

// ------------------------------------------------------------------ libellés
export const phraseCircuit = (config, trame) => {
  const c = circuitPour(config, trame);
  if (c.impose && c.mode === "externe") return "Circuit externe imposé par la trame : le document est signé hors de l'application, puis la version signée est déposée.";
  if (c.impose && c.mode === "simple") return "Signature simple imposée par la trame : l'acte est signé dans l'application, par le signataire, avec son compte.";
  if (c.impose && c.mode === "interne") return "Signature interne imposée par la trame : c'est le SERVICE qui signe, avec la clé du signataire gardée scellée dans son coffre.";
  if (c.choix) {
    const n = circuitsDisponibles(config, trame).map((m) => modeLabel(m).replace(/^Circuit /, "").replace(/^Signature /, "")).join(", ou ");
    return `Cette trame ouvre plusieurs circuits : le rédacteur choisit, acte par acte, entre ${n}.`;
  }
  if (c.mode === "externe") return "Le circuit externe est le circuit général de la collectivité : les actes sont signés hors de l'application, puis la version signée est déposée.";
  if (c.mode === "simple") return "La signature électronique simple est le circuit général de la collectivité : les actes sont signés dans l'application, par le signataire, avec son compte.";
  if (c.mode === "interne") {
    return signatureInterneDisponible()
      ? "La signature interne est le circuit général de la collectivité : c'est le service qui signe, avec la clé du signataire, gardée scellée dans son coffre."
      : "La signature interne est le circuit général de la collectivité, mais ce service n'en tient pas le coffre : " + motifSignatureInterne();
  }
  return "Circuit électronique : l'acte est signé dans l'outil du prestataire.";
};
