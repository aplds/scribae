// ============================================================================
// Tests du registre des variables de déploiement.
//
//   node --test          (ou: npm test)
//
// Le registre est la source de vérité du `.env` : le wiki, la validation et le
// transport vers le navigateur en découlent. Ces tests tiennent trois choses :
// le registre est COHÉRENT (pas de doublon, tout descripteur est documenté), la
// conversion REFUSE au lieu d'approximer, et le wiki ne laisse JAMAIS filtrer un
// secret.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { VARIABLES, lireVariables, poser, wikiMarkdown } from "./variables.mjs";

// ------------------------------------------------------------ cohérence
test("chaque variable est déclarée et documentée", () => {
  assert.ok(VARIABLES.length > 40, "le registre couvre le service et le référentiel");
  for (const v of VARIABLES) {
    assert.match(v.env, /^[A-Z][A-Z0-9_]+$/, `nom de variable : ${v.env}`);
    assert.ok(["referentiel", "service"].includes(v.portee), `portée : ${v.env}`);
    assert.ok(v.type, `type manquant : ${v.env}`);
    assert.ok(v.groupe, `groupe manquant : ${v.env}`);
    assert.ok(v.libelle, `libellé manquant : ${v.env}`);
    assert.ok(v.description, `description manquante : ${v.env}`);
    if (v.portee === "referentiel") assert.match(v.cle, /^[a-zA-Z][\w.]*$/, `chemin : ${v.env}`);
    if (v.type === "choix") assert.ok(Array.isArray(v.choix) && v.choix.length, `choix : ${v.env}`);
  }
});

test("aucun nom de variable ni aucun chemin n'est déclaré deux fois", () => {
  const vus = new Set();
  for (const v of VARIABLES) {
    assert.equal(vus.has("env:" + v.env), false, `doublon : ${v.env}`);
    vus.add("env:" + v.env);
  }
  const chemins = new Set();
  for (const v of VARIABLES) {
    if (v.portee !== "referentiel") continue;
    assert.equal(chemins.has(v.cle), false, `chemin en double : ${v.cle}`);
    chemins.add(v.cle);
  }
});

// ------------------------------------------------------------ lecture
test("un environnement vide ne pose rien et ne signale rien", () => {
  const r = lireVariables({});
  assert.deepEqual(r.valeurs, {});
  assert.deepEqual(r.erreurs, []);
});

test("une valeur vide ou d'espaces vaut « non posée »", () => {
  const r = lireVariables({ SCRIBA_IDENTITE_NOM: "   ", SCRIBA_DELAI_RECOURS_MOIS: "" });
  assert.deepEqual(r.valeurs, {});
});

test("les valeurs valides sont converties et rangées par chemin", () => {
  const r = lireVariables({
    SCRIBA_IDENTITE_NOM: "Ville d'Exemple",
    SCRIBA_IDENTITE_ADRESSE: "https://actes.exemple.fr/",
    SCRIBA_NUMERO_REMPLISSAGE: "4",
    SCRIBA_RECUEIL_AUTO: "non",
    SCRIBA_PARAPHEUR: "1",
    SCRIBA_SIGNATURE_MODE: "externe",
    SCRIBA_IDENTITE_COULEUR: "#123abc",
    SCRIBA_RECUEIL_OPPOSABILITE: "jours",
  });
  assert.deepEqual(r.erreurs, []);
  assert.equal(r.valeurs["brand.name"], "Ville d'Exemple");
  assert.equal(r.valeurs["brand.baseUri"], "https://actes.exemple.fr", "barre oblique finale retirée");
  assert.equal(r.valeurs["numbering.pad"], 4);
  assert.equal(r.valeurs["publication.auto"], false);
  assert.equal(r.valeurs["experimental.parapheur"], true);
  assert.equal(r.valeurs["signature.mode"], "externe");
  assert.equal(r.valeurs["brand.color"], "#123abc");
  assert.equal(r.valeurs["publication.opposabilite.mode"], "jours");
});

test("une valeur refusée n'est PAS appliquée, et son motif est rendu", () => {
  const r = lireVariables({
    SCRIBA_SIGNATURE_MODE: "pigeon",
    SCRIBA_NUMERO_REMPLISSAGE: "3",
    SCRIBA_DELAI_RECOURS_MOIS: "quinze",
    SCRIBA_IDENTITE_COULEUR: "bleu",
    SCRIBA_IDENTITE_ADRESSE: "ftp://exemple.fr",
  });
  assert.equal(r.erreurs.length, 4);
  assert.equal(r.valeurs["signature.mode"], undefined);
  assert.equal(r.valeurs["delais.recoursMois"], undefined);
  assert.equal(r.valeurs["brand.color"], undefined);
  assert.equal(r.valeurs["brand.baseUri"], undefined);
  assert.equal(r.valeurs["numbering.pad"], 3, "les valeurs valides du même lot passent");
  for (const e of r.erreurs) assert.ok(e.variable && e.motif);
});

test("une borne est respectée", () => {
  assert.equal(lireVariables({ SCRIBA_NUMERO_REMPLISSAGE: "0" }).erreurs.length, 1);
  assert.equal(lireVariables({ SCRIBA_NUMERO_REMPLISSAGE: "11" }).erreurs.length, 1);
  assert.equal(lireVariables({ SCRIBA_DELAI_RECOURS_MOIS: "99" }).erreurs.length, 1);
});

test("la portée « service » rend les réglages du service, et pas ceux du référentiel", () => {
  const env = {
    DB_HOST: "db", DB_POOL: "12", COOKIE_SECURE: "false", SMTP_SECURE: "starttls",
    CORS_ORIGINS: "https://a.fr, https://b.fr",
    SCRIBA_IDENTITE_NOM: "Ville d'Exemple",
  };
  const r = lireVariables(env, "service");
  assert.deepEqual(r.erreurs, []);
  assert.equal(r.valeurs.DB_HOST, "db");
  assert.equal(r.valeurs.DB_POOL, 12);
  assert.equal(r.valeurs.COOKIE_SECURE, false);
  assert.deepEqual(r.valeurs.CORS_ORIGINS, ["https://a.fr", "https://b.fr"]);
  assert.equal(r.valeurs["brand.name"], undefined, "un réglage de référentiel ne fuit pas dans le service");
});

test("un réglage de service n'est jamais transmis au navigateur", () => {
  const r = lireVariables({ DB_HOST: "db", DB_PASSWORD: "secret", AUTH_MODE: "password" });
  assert.deepEqual(r.valeurs, {});
});

test("la fonction ne rend jamais la valeur d'un secret", () => {
  const r = lireVariables({ DB_PASSWORD: "un-mot-de-passe", SMTP_PASS: "autre", DB_HOST: "db" }, "service");
  assert.deepEqual(r.erreurs, []);
  assert.equal(r.valeurs.DB_HOST, "db");
  assert.equal("DB_PASSWORD" in r.valeurs, false);
  assert.equal("SMTP_PASS" in r.valeurs, false);
  assert.equal(JSON.stringify(r).includes("un-mot-de-passe"), false);
});

// ------------------------------------------------------------ poser
test("poser crée les niveaux intermédiaires", () => {
  const o = {};
  poser(o, "publication.opposabilite.mode", "jours");
  poser(o, "brand.name", "Ville d'Exemple");
  assert.deepEqual(o, { brand: { name: "Ville d'Exemple" }, publication: { opposabilite: { mode: "jours" } } });
});

test("poser remplace une valeur scalaire par un objet pour descendre", () => {
  const o = { publication: { auto: true } };
  poser(o, "publication.auto", false);
  assert.equal(o.publication.auto, false);
});

// ------------------------------------------------------------ wiki
test("le wiki décrit toutes les variables, sans jamais montrer un secret", () => {
  const md = wikiMarkdown();
  for (const v of VARIABLES) {
    assert.ok(md.includes("`" + v.env + "`"), `variable absente du wiki : ${v.env}`);
  }
  // Aucune valeur d'exemple pour un secret : ni mot de passe, ni jeton.
  assert.ok(md.includes("| `SMTP_PASS` |"), "SMTP_PASS est documenté");
  const ligne = md.split("\n").find((l) => l.startsWith("| `SMTP_PASS` |"));
  assert.ok(ligne && ligne.includes("(secret)"), "le wiki n'affiche pas d'exemple pour un secret");
  assert.equal(/SMTP_PASS=\S/.test(md), false);
});
