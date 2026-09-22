// ============================================================================
// Réglages de référentiel POSÉS PAR LE DÉPLOIEMENT.
//
// Le fichier `.env` du service auto-hébergé peut déclarer des réglages qui,
// jusqu'ici, ne se réglaient qu'un clic après l'autre dans l'interface : identité
// de la collectivité, vocabulaire des actes, numérotation, délais, recueil
// public, fonctions expérimentales. Le registre de ces variables vit dans
// `src/server/mysql/variables.mjs` — une seule déclaration ; le service les
// valide et les rend, et ce module les applique.
//
// Trois idées :
//
//   1. le service (`.env`) est plus FORT que le référentiel, comme il l'est déjà
//      pour `AUTH_MODE` (voir src/lib/auth.js) : une variable posée l'emporte sur
//      la valeur réglée dans l'interface ;
//   2. l'application ne VOIT que le résultat : `appliquerOptions()` pose les
//      valeurs reçues (chemins pointés) dans l'objet `config`, une fois, au
//      démarrage — le reste du code lit `config` comme avant, sans rien savoir
//      du déploiement ;
//   3. rien n'est PERSISTÉ par ce module : le référentiel enregistré reste celui
//      de l'administrateur ; le déploiement le recouvre à chaque chargement. Une
//      variable retirée du `.env` n'est donc plus imposée au lancement suivant,
//      et l'interface reprend la main sur la valeur enregistrée.
//
// Module PUR (aucune dépendance) : il s'éprouve seul, et ne parle ni au réseau
// ni au stockage.
// ============================================================================

// Les chemins interdits : une réponse d'API ne doit pas pouvoir atteindre le
// prototype du référentiel.
const INTERDITS = new Set(["__proto__", "constructor", "prototype"]);

// Le déploiement connu : `{ variables, erreurs }`, ou `null` si aucun
// déploiement ne parle (aperçu en ligne, page statique).
let deploiement = null;
// L'ÉTAT DU PRESTATAIRE DE SIGNATURE, tel que le service le rend (`ETAT` de la
// réponse : transport, adresse, niveau, chemins — et `cle`, un booléen, jamais
// la clé). C'est le SERVICE qui sait si le circuit électronique est réellement
// branché : lui seul détient la clé. L'Administration › Signature s'en sert
// pour le dire, plutôt que de laisser croire à une simulation.
let prestataire = null;

const estObjet = (o) => !!o && typeof o === "object" && !Array.isArray(o);

// Enregistre ce que le service a rendu sur `GET /v1/config`. Rend le
// déploiement retenu, ou `null` si la source ne dit rien d'exploitable.
export function setDeploiementConfig(source) {
  prestataire = estObjet(source) && estObjet(source.prestataire) ? source.prestataire : null;
  if (!estObjet(source) || !estObjet(source.variables)) { deploiement = null; return null; }
  const variables = {};
  for (const [chemin, valeur] of Object.entries(source.variables)) {
    if (typeof chemin !== "string" || !chemin) continue;
    const parts = chemin.split(".");
    if (parts.some((p) => !p || INTERDITS.has(p))) continue;
    variables[chemin] = valeur;
  }
  const erreurs = Array.isArray(source.erreurs)
    ? source.erreurs.filter(estObjet).map((e) => ({
      variable: String(e.variable || ""),
      valeur: e.valeur === undefined ? "" : String(e.valeur),
      motif: String(e.motif || ""),
    }))
    : [];
  deploiement = { variables, erreurs };
  return deploiement;
}

export const optionsDeployees = () => deploiement;
export const aDesOptionsDeployees = () => !!deploiement && Object.keys(deploiement.variables).length > 0;
// L'état du prestataire de signature tel que le SERVICE le voit, ou null quand
// aucun service ne parle (aperçu en ligne, page statique).
export const prestataireDeploye = () => prestataire;

// Le réglage est-il POSÉ par le déploiement (et non par le référentiel) ? Sert à
// l'interface : un champ fixé par le `.env` se signale plutôt que de laisser
// croire qu'une saisie tiendra.
export function poseParLeDeploiement(chemin) {
  return !!deploiement && Object.prototype.hasOwnProperty.call(deploiement.variables, chemin);
}

// Applique les réglages au référentiel, EN PLACE, et le rend. Sans déploiement,
// le référentiel est rendu tel quel.
export function appliquerOptions(config) {
  if (!config || !deploiement) return config;
  for (const [chemin, valeur] of Object.entries(deploiement.variables)) {
    poser(config, chemin, valeur);
  }
  return config;
}

// Pose une valeur à un chemin « a.b.c », en créant les niveaux manquants. Un
// niveau qui n'est pas un objet (une chaîne, par exemple) est remplacé : le
// déploiement a le dernier mot.
export function poser(base, chemin, valeur) {
  const parts = String(chemin).split(".").filter(Boolean);
  if (!parts.length) return base;
  let noeud = base;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!estObjet(noeud[parts[i]])) noeud[parts[i]] = {};
    noeud = noeud[parts[i]];
  }
  noeud[parts[parts.length - 1]] = valeur;
  return base;
}
