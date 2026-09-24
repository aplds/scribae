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
import { VARIABLES, ROLES_CONNUS, lireVariables, poser, wikiMarkdown } from "./variables.mjs";

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
    SCRIBA_SIGNATURE_MODE: "externe",
    SCRIBA_IDENTITE_COULEUR: "#123abc",
    SCRIBA_IDENTITE_EMBLEME_SOMBRE: "https://actes.exemple.fr/blason-clair.svg",
    SCRIBA_RECUEIL_OPPOSABILITE: "jours",
  });
  assert.deepEqual(r.erreurs, []);
  assert.equal(r.valeurs["brand.name"], "Ville d'Exemple");
  assert.equal(r.valeurs["brand.baseUri"], "https://actes.exemple.fr", "barre oblique finale retirée");
  assert.equal(r.valeurs["numbering.pad"], 4);
  assert.equal(r.valeurs["publication.auto"], false);
  assert.equal(r.valeurs["signature.mode"], "externe");
  assert.equal(r.valeurs["brand.color"], "#123abc");
  assert.equal(r.valeurs["brand.logoUrlDark"], "https://actes.exemple.fr/blason-clair.svg",
    "l'emblème du thème sombre se range à son propre chemin");
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

// ------------------------------------------------- annuaire de la collectivité
// Les variables `SCRIBA_ANNUAIRE_*` : elles rendent l'annuaire déclaratif, et
// c'est par elles qu'un parc se branche sans cliquer dans chaque interface.
test("l'annuaire se déclare dans le .env, et la correspondance se lit en couples", () => {
  const r = lireVariables({
    SCRIBA_ANNUAIRE_ISSUER: "https://annuaire.exemple.fr/realms/agents",
    SCRIBA_ANNUAIRE_CLIENT_ID: "scribae-application",
    SCRIBA_ANNUAIRE_SECONDE_PORTE: "oui",
    SCRIBA_ANNUAIRE_ROLES: "scribae-administrateurs=administrateur, scribae-editeurs=editeur",
    SCRIBA_ANNUAIRE_JWKS_URL: "https://annuaire.exemple.fr/realms/agents/protocol/openid-connect/certs",
    SCRIBA_ANNUAIRE_SANS_GROUPE: "default",
    SCRIBA_ANNUAIRE_ROLE_DEFAUT: "redacteur",
    SCRIBA_ANNUAIRE_SIGNATURE: "true",
  });
  assert.deepEqual(r.erreurs, []);
  assert.equal(r.valeurs["auth.issuer"], "https://annuaire.exemple.fr/realms/agents");
  assert.equal(r.valeurs["auth.clientId"], "scribae-application");
  assert.equal(r.valeurs["auth.annuaire"], true);
  assert.deepEqual(r.valeurs["auth.roleMap"], [
    { claim: "scribae-administrateurs", role: "administrateur" },
    { claim: "scribae-editeurs", role: "editeur" },
  ]);
  assert.equal(r.valeurs["auth.endpoints.jwks"], "https://annuaire.exemple.fr/realms/agents/protocol/openid-connect/certs");
  assert.equal(r.valeurs["auth.unknownPolicy"], "default");
  assert.equal(r.valeurs["auth.defaultRole"], "redacteur");
  assert.equal(r.valeurs["auth.requireSignature"], true);
});

test("une correspondance de groupes fautive est refusée ENTIÈREMENT", () => {
  // Un couple mal formé, un groupe vide ou un rôle inconnu : la variable est
  // refusée, et la correspondance du référentiel reste en place. Une demi-
  // correspondance donnerait des rôles faux — pire que pas de correspondance.
  for (const mauvais of ["scribae-admins", "=administrateur", "scribae-admins=superadmin", "scribae-admins=administrateur, scribae-editeurs"]) {
    const r = lireVariables({ SCRIBA_ANNUAIRE_ROLES: mauvais });
    assert.equal(r.erreurs.length, 1, `« ${mauvais} » doit être refusé`);
    assert.equal(r.erreurs[0].variable, "SCRIBA_ANNUAIRE_ROLES");
    assert.equal(r.valeurs["auth.roleMap"], undefined, "la correspondance fautive n'est pas appliquée");
  }
});

test("les rôles de la correspondance sont ceux de l'application", () => {
  // La liste de référence est ROLE_ORDER (src/lib/users.js) ; les épreuves du
  // navigateur (src/tests/purs.test.mjs) vérifient que les deux listes sont
  // identiques — la copie locale tient ce module PUR, sans dépendance.
  assert.deepEqual(ROLES_CONNUS, ["visiteur", "redacteur", "reviseur", "signataire", "editeur", "administrateur"]);
  const r = lireVariables({ SCRIBA_ANNUAIRE_ROLE_DEFAUT: "prestataire" });
  assert.equal(r.erreurs.length, 1, "un rôle qui n'existe pas dans l'application est refusé");
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

// ------------------------------------------- les modèles de `.env`
// DEUX MODÈLES coexistent : celui du dépôt (`src/server/env.example`, à côté du
// `docker-compose.yml`, que l'exploitant copie) et celui du service
// (`src/server/mysql/env.example`, qui vit dans son image). Une variable décrite
// dans le wiki mais absente des DEUX est introuvable au moment où l'on compose
// son `.env` — ce qui est arrivé à `RATE_MAX_CONNEXIONS` : la limite existait
// dans le code, le wiki la décrivait, et aucun modèle n'en parlait. L'épreuve
// tient la règle du projet : « un descripteur, une ligne dans `env.example`,
// puis on régénère le wiki ».
test("chaque variable du registre se pose dans un `.env.example`", async (t) => {
  let readFile = null;
  try { ({ readFile } = await import("node:fs/promises")); } catch (e) { readFile = null; }
  if (typeof readFile !== "function") return t.skip("lecture de fichier indisponible hors dépôt");
  const lire = async (chemins) => {
    for (const c of chemins) { try { return await readFile(c, "utf8"); } catch (e) { /* essai suivant */ } }
    return null;
  };
  // Chemins relatifs au dépôt (le dossier courant de `node --test`), avec le
  // repli « racine = src/ » si l'outillage est déplacé un jour.
  const modeles = [
    await lire(["src/server/env.example", "server/env.example"]),
    await lire(["src/server/mysql/env.example", "server/mysql/env.example", "env.example"]),
  ].filter(Boolean);
  assert.ok(modeles.length, "les modèles de `.env` sont introuvables");
  const manquantes = VARIABLES
    .map((v) => v.env)
    .filter((nom) => !modeles.some((modele) => new RegExp("^#?\\s*" + nom + "=", "m").test(modele)));
  assert.deepEqual(manquantes, [],
    "variables décrites dans le wiki et absentes de tout `.env.example` : " + manquantes.join(", "));
});
