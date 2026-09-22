// ============================================================================
// Tests de l'amorçage du compte d'administration.
//
//   node --test          (ou: npm test)
//
// Le cas qui a motivé ce module : `ADMIN_PASSWORD` ne satisfaisait pas la
// politique, l'amorçage était refusé — mais seulement dans les journaux. L'agent
// ne voyait qu'« Identifiant ou mot de passe incorrect ». On vérifie donc ici que
// le verdict PORTE le motif, et qu'un mot de passe refusé n'installe aucun compte.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { amorcerAdministrateur, nomDe, slug } from "./amorcage.mjs";

// Un « port » de comptes en mémoire, aux mêmes méthodes que comptes.mjs. Rien
// de ce module ne touche à la base : c'est ce qui rend l'amorçage éprouvable.
function fauxComptes({ existants = [], etats = [], panne = null } = {}) {
  const appels = { ecrire: [], motDePasse: [] };
  return {
    appels,
    async lireCompteParLogin(login) {
      if (panne) throw panne;
      return existants.find((c) => c.login === login) || null;
    },
    async etatComptes() { return etats; },
    async ecrireCompte(compte) { appels.ecrire.push(compte); existants.push(compte); },
    async definirMotDePasse(id, motDePasse, opts) {
      appels.motDePasse.push({ id, motDePasse, opts });
      return { ok: true, userId: id };
    },
  };
}

const MDP_VALIDE = "Charbon-9-Vertige";
const base = { adminLogin: "j.mercier", adminNom: "Julie Mercier", mdpMin: 12 };

test("utils : identifiant et nom", () => {
  assert.equal(slug("Julie Mercier"), "juliemercier");
  assert.deepEqual(nomDe("Julie Mercier"), { firstName: "Julie", lastName: "Mercier" });
  assert.deepEqual(nomDe(""), { firstName: "", lastName: "" });
});

test("un ADMIN_PASSWORD non conforme n'installe AUCUN compte, et le motif le dit", async () => {
  const comptes = fauxComptes();
  const r = await amorcerAdministrateur({ ...base, adminPassword: "court", comptes });
  assert.equal(r.ok, false);
  assert.match(r.motif, /ADMIN_PASSWORD refusé/);
  assert.equal(r.compte, null);
  assert.deepEqual(comptes.appels.ecrire, []);
  assert.deepEqual(comptes.appels.motDePasse, []);
});

test("un ADMIN_PASSWORD repris de l'identifiant est refusé", async () => {
  const comptes = fauxComptes();
  const r = await amorcerAdministrateur({ ...base, adminPassword: "j.mercier-2026!!", comptes });
  assert.equal(r.ok, false);
  assert.match(r.motif, /ADMIN_PASSWORD refusé/);
  assert.deepEqual(comptes.appels.ecrire, []);
});

test("un ADMIN_LOGIN vide est signalé comme tel", async () => {
  const comptes = fauxComptes();
  const r = await amorcerAdministrateur({ ...base, adminLogin: "  ", adminPassword: MDP_VALIDE, comptes });
  assert.equal(r.ok, false);
  assert.match(r.motif, /ADMIN_LOGIN/);
});

test("sans ADMIN_PASSWORD et sans compte, rien n'est créé et on dit quoi faire", async () => {
  const comptes = fauxComptes();
  const r = await amorcerAdministrateur({ ...base, adminPassword: "", comptes });
  assert.equal(r.ok, false);
  assert.match(r.motif, /ADMIN_PASSWORD n'est pas renseigné/);
  assert.deepEqual(comptes.appels.ecrire, []);
});

test("un mot de passe conforme crée le compte et pose le mot de passe", async () => {
  const comptes = fauxComptes();
  const r = await amorcerAdministrateur({
    ...base, adminPassword: MDP_VALIDE, adminEmail: "mairie@exemple.fr", adminEntity: "e-1", comptes,
  });
  assert.equal(r.ok, true);
  assert.equal(r.compte.id, "u-jmercier");
  assert.equal(r.compte.login, "j.mercier");
  assert.deepEqual(r.compte.roles, ["administrateur"]);
  assert.equal(r.compte.entityId, "e-1");
  assert.equal(comptes.appels.ecrire.length, 1);
  assert.equal(comptes.appels.motDePasse.length, 1);
  assert.equal(comptes.appels.motDePasse[0].motDePasse, MDP_VALIDE);
  assert.equal(comptes.appels.motDePasse[0].opts.mustChange, false);
  assert.equal(r.motif, "");
});

test("un référentiel injoignable est une PANNE, pas un refus de mot de passe", async () => {
  const panne = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:3306"), { code: "ECONNREFUSED" });
  const comptes = fauxComptes({ panne });
  const r = await amorcerAdministrateur({ ...base, adminPassword: MDP_VALIDE, comptes });
  assert.equal(r.ok, false);
  assert.equal(r.panne, panne);
  assert.match(r.motif, /injoignable/);
  assert.doesNotMatch(r.motif, /ADMIN_PASSWORD refusé/);
});

test("un compte existant sans mot de passe ne peut pas entrer, et le motif le dit", async () => {
  const existant = { id: "u-jmercier", login: "j.mercier", role: "administrateur", roles: ["administrateur"] };
  const comptes = fauxComptes({ existants: [existant], etats: [] });
  const r = await amorcerAdministrateur({ ...base, adminPassword: "", comptes });
  assert.equal(r.ok, false);
  assert.match(r.motif, /n'a pas de mot de passe/);
  assert.deepEqual(comptes.appels.motDePasse, []);
});

test("un ADMIN_PASSWORD conforme est posé sur le compte existant sans mot de passe", async () => {
  const existant = { id: "u-jmercier", login: "j.mercier", role: "administrateur", roles: ["administrateur"] };
  const comptes = fauxComptes({ existants: [existant], etats: [] });
  const r = await amorcerAdministrateur({ ...base, adminPassword: MDP_VALIDE, comptes });
  assert.equal(r.ok, true);
  assert.equal(comptes.appels.motDePasse.length, 1);
  assert.match(r.message, /posé sur le compte/);
});

test("un compte existant qui a déjà un mot de passe n'est pas touché", async () => {
  const existant = { id: "u-jmercier", login: "j.mercier", role: "administrateur", roles: ["administrateur"] };
  const comptes = fauxComptes({ existants: [existant], etats: [{ userId: "u-jmercier", defini: true }] });
  const r = await amorcerAdministrateur({ ...base, adminPassword: MDP_VALIDE, comptes });
  assert.equal(r.ok, true);
  assert.deepEqual(comptes.appels.motDePasse, []);
  assert.equal(r.message, "");
});

test("un compte sans le rôle administrateur est signalé par un avertissement", async () => {
  const existant = { id: "u-jmercier", login: "j.mercier", role: "redacteur", roles: ["redacteur"] };
  const comptes = fauxComptes({ existants: [existant], etats: [{ userId: "u-jmercier", defini: true }] });
  const r = await amorcerAdministrateur({ ...base, adminPassword: MDP_VALIDE, comptes });
  assert.equal(r.ok, true);
  assert.match(r.avertissement, /rôle administrateur/);
});

// ---------------------------- la réparation : le compte a disparu, le mot de passe est resté
// Le cas qui a enfermé une installation dehors (note 1.3.2p) : « Repartir d'un
// référentiel vierge » effaçait les comptes de la collection `users`, mais pas
// leurs mots de passe — ceux-ci vivent chez le service, dans `sb_motdepasse`,
// hors du référentiel. Le compte d'administration disparaissait, son mot de
// passe restait orphelin, et `ADMIN_PASSWORD` ayant été retiré du `.env` (comme
// le recommande la documentation une fois le mot de passe changé depuis
// l'application), plus personne ne pouvait se connecter.
test("un compte disparu du référentiel est RÉTABLI si son mot de passe est resté", async () => {
  const comptes = fauxComptes({ existants: [], etats: [{ userId: "u-jmercier", defini: true }] });
  const r = await amorcerAdministrateur({ ...base, adminPassword: "", comptes });
  assert.equal(r.ok, true);
  assert.equal(r.compte.id, "u-jmercier");
  assert.equal(r.compte.login, "j.mercier");
  assert.deepEqual(r.compte.roles, ["administrateur"]);
  assert.equal(comptes.appels.ecrire.length, 1, "le compte est réécrit au référentiel");
  assert.deepEqual(comptes.appels.motDePasse, [], "le mot de passe existant n'est PAS remplacé");
  assert.match(r.message, /RÉTABLI/);
  assert.match(r.avertissement, /Comptes et rôles/);
});

test("un mot de passe resté sous un AUTRE identifiant ne rétablit rien", async () => {
  // L'identifiant du compte d'un `.env` est « u- » + slug du login : un mot de
  // passe orphelin rangé sous un autre identifiant n'est pas celui de ce compte,
  // et l'amorçage ne doit pas inventer un compte avec.
  const comptes = fauxComptes({ existants: [], etats: [{ userId: "u-autre", defini: true }] });
  const r = await amorcerAdministrateur({ ...base, adminPassword: "", comptes });
  assert.equal(r.ok, false);
  assert.match(r.motif, /ADMIN_PASSWORD n'est pas renseigné/);
  assert.deepEqual(comptes.appels.ecrire, []);
});

test("le refus d'un compte absent dit les DEUX gestes qui le réparent", async () => {
  const comptes = fauxComptes({ existants: [], etats: [] });
  const r = await amorcerAdministrateur({ ...base, adminPassword: "", comptes });
  assert.match(r.motif, /ADMIN_PASSWORD/, "poser le mot de passe dans le .env");
  assert.match(r.motif, /up -d/, "recréer le conteneur — un simple redémarrage ne relit pas le .env");
  assert.match(r.motif, /--mot-de-passe/, "ou la commande de secours");
});
