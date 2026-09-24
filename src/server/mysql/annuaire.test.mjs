// ============================================================================
// Tests de la publication de l'annuaire (src/server/mysql/annuaire.mjs).
//
//   node --test          (ou: npm test)
//
// Ce module est la seule chose que le SERVICE publie de l'annuaire, sur une
// route PUBLIQUE (`GET /v1/auth/config`, lue avant toute session). Ces épreuves
// tiennent donc trois choses, dans cet ordre d'importance :
//   1. AUCUN secret ne sort : ce qui n'est pas dans la liste blanche ne peut pas
//      être publié, quel que soit ce que le référentiel contient ;
//   2. la précédence est celle du reste du `.env` (le déploiement l'emporte) ;
//   3. une correspondance de groupes douteuse est écartée, jamais devinée.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { annuairePublic, CHAMPS_PUBLICS, CHAMPS_ENDPOINTS } from "./annuaire.mjs";

test("sans réglage, il n'y a rien à publier", () => {
  assert.equal(annuairePublic({}), null);
  assert.equal(annuairePublic({ variables: {}, referentiel: {} }), null);
  assert.equal(annuairePublic({ referentiel: { brand: { name: "Ville" } } }), null,
    "un référentiel sans annuaire ne publie rien");
  assert.equal(annuairePublic({ referentiel: { auth: { issuer: "" } } }), null,
    "une valeur vide ne compte pas comme un réglage");
});

test("le référentiel est publié, seconde porte comprise", () => {
  const out = annuairePublic({
    referentiel: {
      auth: {
        annuaire: true, issuer: "https://annuaire.exemple.fr/realms/agents",
        clientId: "scribae", scopes: "openid profile email",
        roleClaim: "groups", unknownPolicy: "deny", defaultRole: "redacteur",
        roleMap: [{ claim: "scribae-admins", role: "administrateur" }],
        endpoints: { token: "https://annuaire.exemple.fr/token" },
      },
    },
  });
  assert.equal(out.annuaire, true);
  assert.equal(out.issuer, "https://annuaire.exemple.fr/realms/agents");
  assert.equal(out.clientId, "scribae");
  assert.deepEqual(out.roleMap, [{ claim: "scribae-admins", role: "administrateur" }]);
  assert.deepEqual(out.endpoints, { token: "https://annuaire.exemple.fr/token" });
});

test("le .env l'emporte sur le référentiel, champ par champ", () => {
  const out = annuairePublic({
    variables: {
      "auth.issuer": "https://env.exemple.fr",
      "auth.endpoints.jwks": "https://env.exemple.fr/certs",
      "auth.annuaire": true,
    },
    referentiel: {
      auth: {
        issuer: "https://annuaire.exemple.fr", clientId: "scribae",
        endpoints: { jwks: "https://annuaire.exemple.fr/certs", token: "https://annuaire.exemple.fr/token" },
      },
    },
  });
  assert.equal(out.issuer, "https://env.exemple.fr", "le déploiement fait foi");
  assert.equal(out.clientId, "scribae", "le champ que le .env ne pose pas vient du référentiel");
  assert.deepEqual(out.endpoints, {
    jwks: "https://env.exemple.fr/certs",           // posé par le .env
    token: "https://annuaire.exemple.fr/token",     // venu du référentiel
  });
});

test("ce qui n'est pas dans la liste blanche ne sort JAMAIS", () => {
  const out = annuairePublic({
    variables: { "auth.clientSecret": "s3cr3t", "auth.mode": "oidc" },
    referentiel: {
      auth: {
        issuer: "https://annuaire.exemple.fr", clientSecret: "un-secret-de-client",
        mode: "oidc", demoAccounts: false, unChampInconnu: { a: 1 },
      },
      autre: { secret: "non" },
    },
  });
  assert.equal(out.clientSecret, undefined, "un secret de client n'est jamais publié");
  assert.equal(out.mode, undefined, "le MODE est porté par le déploiement (AUTH_MODE), pas publié ici");
  assert.equal(out.demoAccounts, undefined, "les comptes de démonstration sont un réglage du déploiement");
  assert.equal(out.unChampInconnu, undefined);
  assert.equal(out.autre, undefined);
  assert.deepEqual(Object.keys(out).sort(), ["issuer"]);
});

test("la liste blanche est celle des deux côtés", () => {
  // Le navigateur tient la même liste (ANNUAIRE_CLES, src/lib/auth.js) : les
  // épreuves de src/tests/purs.test.mjs vérifient qu'elles ne divergent pas.
  assert.equal(CHAMPS_PUBLICS.length, 19);
  assert.ok(CHAMPS_PUBLICS.includes("annuaire"));
  assert.ok(CHAMPS_PUBLICS.includes("roleMap"));
  assert.equal(CHAMPS_ENDPOINTS.length, 4);
});

test("une correspondance de groupes douteuse est écartée, jamais devinée", () => {
  const out = annuairePublic({
    referentiel: {
      auth: {
        issuer: "https://annuaire.exemple.fr",
        roleMap: [{ claim: "a", role: "editeur" }, null, { claim: "", role: "editeur" }, { claim: "b" }, { claim: "c", role: "redacteur" }],
      },
    },
  });
  assert.deepEqual(out.roleMap, [{ claim: "a", role: "editeur" }, { claim: "c", role: "redacteur" }]);
  // Une correspondance ENTIÈREMENT illisible n'est pas publiée du tout : les
  // rôles par défaut du navigateur s'appliquent, plutôt qu'une liste vide qui
  // ferait « aucun groupe reconnu » pour tout le monde.
  const vide = annuairePublic({ referentiel: { auth: { issuer: "https://a.fr", roleMap: "scribae-admins=administrateur" } } });
  assert.equal(vide.roleMap, undefined);
});
