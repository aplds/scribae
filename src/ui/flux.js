// ============================================================================
// LE FLUX, CÂBLÉ À L'APPLICATION.
//
// `lib/flux.js` est le TRANSPORT (ouvrir, lire, reprendre, découper) ; ce module
// est ce qui décide QUOI EN FAIRE : quel service appeler, avec quels en-têtes, et
// à qui remettre les évènements. Il ne connaît pas l'état de l'application — il
// n'importe donc pas `state.js`, ce qui éviterait un cycle d'imports — et il
// reçoit ce qu'il faut par abonnement : `surFlux(fn)` pour chaque évènement,
// `surEtat(fn)` pour l'état de la liaison.
//
// QUAND IL S'ACTIVE, ET QUAND IL SE TAIT. Le flux n'existe que sur un service
// AUTO-HÉBERGÉ (`__SCRIBA_SELF_HOSTED__`, transport HTTP). Partout ailleurs — la
// démonstration statique, le service embarqué de l'aperçu, le stockage local — il
// n'y a personne pour pousser : l'application garde son sondage périodique, et
// rien ne change. C'est la contrainte que porte la demande : travailler à
// plusieurs se fait sur le serveur, en conditions réelles.
// ============================================================================

import { creerFlux, ETATS } from "../lib/flux.js";
import { cleService } from "../lib/cle-service.js";
import { sessionDeService } from "../lib/auth.js";
import * as db from "../lib/db/index.js";

let instance = null;
let enMarche = false;
const abonnesEvenements = new Set();
const abonnesEtat = new Set();

// Le flux n'a de sens que là où les écritures vont à un service HTTP : c'est lui
// qui sait tenir une réponse ouverte. Le mode « démonstration » (socket) et le
// stockage local n'en ont pas.
export function disponible() {
  return db.isShared() && db.driverId() === "service:http";
}

export function urlDuFlux() {
  const reglages = db.getSettings();
  const base = String((reglages && reglages.url) || "").replace(/\/+$/, "");
  return base + "/v1/db/flux";
}

// Les en-têtes de la LECTURE : la session du service quand il y en a une (elle
// voyage par le cookie, non lisible par le script), la clé d'API sinon.
function entetes() {
  if (sessionDeService()) return {};
  const cle = cleService();
  return cle ? { authorization: "Bearer " + cle } : {};
}

function prevenirEtat(e) {
  for (const f of abonnesEtat) { try { f(e); } catch (err) { console.warn("[flux] écouteur d'état en échec :", err); } }
}

function prevenirEvenement(e) {
  for (const f of abonnesEvenements) { try { f(e); } catch (err) { console.warn("[flux] traitement en échec :", err); } }
}

export const surFlux = (fn) => { abonnesEvenements.add(fn); return () => abonnesEvenements.delete(fn); };
export const surEtatFlux = (fn) => { abonnesEtat.add(fn); try { fn(etat()); } catch (e) { /* sans conséquence */ } return () => abonnesEtat.delete(fn); };

export function etat() {
  if (!instance) return { etat: disponible() ? ETATS.inactif : ETATS.absent, detail: disponible() ? "" : "Ce déploiement n'a pas de service temps réel.", ouvert: false };
  return { ...instance.etat(), ouvert: instance.ouvert() };
}

export const ouvert = () => !!instance && instance.ouvert();

// Le flux meurt en silence quand un onglet passe en veille (le navigateur gèle
// ses minuteurs, un mandataire coupe la connexion inactive). On le reprend donc
// au retour de l'onglet, et au retour du réseau — sans attendre le délai de
// reprise, qui peut être d'une minute.
let reveilsPoses = false;
function installerReveils() {
  if (reveilsPoses || typeof document === "undefined") return;
  reveilsPoses = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reveiller();
  });
  globalThis.addEventListener?.("online", () => reveiller());
}

export function demarrer() {
  if (enMarche) return false;
  if (!disponible()) { prevenirEtat(etat()); return false; }
  enMarche = true;
  installerReveils();
  instance = creerFlux({
    url: urlDuFlux(),
    entetes: entetes(),
    credentials: sessionDeService() ? "include" : "same-origin",
    surEvenement: prevenirEvenement,
  });
  instance.surEtat(prevenirEtat);
  instance.demarrer();
  return true;
}

export function arreter() {
  enMarche = false;
  if (instance) instance.arreter();
  instance = null;
  prevenirEtat(etat());
  return true;
}

// Après une connexion (ou une déconnexion), la porte a changé : les en-têtes ne
// sont plus les mêmes. On repart donc d'une liaison neuve — un flux ouvert avec
// les droits d'avant serait, au mieux, inutile.
export function relancer() {
  arreter();
  return demarrer();
}

// L'onglet redevient visible : si la liaison est tombée pendant la veille, on la
// reprend tout de suite, sans attendre le délai de reprise.
export function reveiller() {
  if (instance && !instance.ouvert()) instance.resynchroniser();
}
