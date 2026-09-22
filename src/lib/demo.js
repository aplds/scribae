// ============================================================================
// Le commutateur de démonstration — une seule source de vérité.
//
// L'application connaissait DEUX notions qui ne se recouvraient pas :
//
//   1. le DÉPLOIEMENT (`.env`) : `AUTH_MODE`, `DEMO_ACCOUNTS` — il ne gouvernait
//      que la CONNEXION (quels comptes sont proposés, s'il faut un mot de passe) ;
//   2. le RÉFÉRENTIEL : `config.brand.demo` — il ne gouvernait que le BANDEAU,
//      quelques valeurs par défaut et la régénération du jeu fictif.
//
// Résultat : même « hors démonstration », l'application semait et affichait une
// collectivité fictive, parce que `bootstrap()` appelait `seedConfig()`,
// `seedTrames()`, `seedActes()` et `seedUsers()` sans consulter le déploiement.
//
// Il n'y a plus qu'un commutateur : `DEMO` du `.env` (voir src/server/mysql/
// server.mjs et server/env.example), exposé au navigateur par
// `GET /v1/auth/config` et par `window.__SCRIBA_AUTH__`. Quand il est ÉTEINT,
// l'outil est une page vierge : aucune donnée fictive, aucune mention de
// collectivité fictive, nulle part.
//
// `config.brand.demo` survit comme MIROIR : `bootstrap()` le recopie du
// déploiement quand celui-ci parle, pour que le réglage voyage avec les données
// exportées et importées — mais il ne décide plus rien. Sans déploiement (aperçu
// en ligne, site statique), c'est lui qui fait foi : c'est le seul cas où il n'y
// a personne d'autre pour répondre.
// ============================================================================
import { deploiementAuth, deploiementDePage } from "./auth.js";

// Ce que dit le déploiement, ou `null` s'il ne dit rien (aperçu, page statique).
// `demoJeu` est le champ explicite ; à défaut, le mode « demo » implique le jeu
// de démonstration (c'est le sens historique de `AUTH_MODE=demo`).
export function demoDeploiement() {
  const d = deploiementAuth() || deploiementDePage();
  if (!d) return null;
  if (typeof d.demoJeu === "boolean") return d.demoJeu;
  if (d.mode) return String(d.mode) === "demo";
  return null;
}

// Le déploiement impose-t-il le commutateur ? (Vrai dès qu'un service répond ou
// qu'un `config.js` est posé — c'est-à-dire sur une installation auto-hébergée.)
export const demoRegleParLeDeploiement = () => demoDeploiement() !== null;

// LA question : cette installation est-elle une démonstration ?
export function demoActif(config) {
  const d = demoDeploiement();
  if (d !== null) return d;
  return config?.brand?.demo !== false;
}

// Un référentiel est VIERGE quand rien n'a été construit : ni entités, ni
// services, ni bureaux, ni personnes, ni rôles, ni références, ni familles.
// C'est le marqueur qui remplace, hors démonstration, les repères du jeu fictif
// (`acte-demo-*`, `tpl-*`, `source: "demo"`, DEMO_USER_IDS) : ces repères ne
// veulent rien dire sur une installation réelle, et une installation réelle ne
// les porte jamais.
export function referentielVierge(config) {
  if (!config) return true;
  const vide = (l) => !Array.isArray(l) || l.length === 0;
  return vide(config.entities) && vide(config.councils) && vide(config.services)
    && vide(config.people) && vide(config.roles) && vide(config.refs)
    && vide(config.families) && vide(config.mentions);
}

// Un registre est vierge quand il ne porte ni trame, ni acte, ni compte.
export function registreVierge(trames, actes, users) {
  const vide = (l) => !Array.isArray(l) || l.length === 0;
  return vide(trames) && vide(actes) && vide(users);
}
