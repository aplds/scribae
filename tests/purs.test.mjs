// ============================================================================
// Tests des modules PURS — `node --test`.
//
// Le pari de l'application est que le MÉTIER ne touche ni au DOM ni au réseau :
// ces modules peuvent donc être éprouvés sans navigateur, sans base et sans
// service. C'est ce que fait ce fichier, et c'est le socle sur lequel les tests
// de parcours (à venir) pourront s'appuyer.
//
//   node --test tests/
//
// Les modules sont chargés DYNAMIQUEMENT : un module qui exigerait un
// navigateur (DOMParser, localStorage) ferait échouer l'import, et ses tests
// sont alors simplement SAUTÉS au lieu de faire tomber la suite. Un test qu'on
// ne peut pas exécuter ici ne doit pas cacher les tests qu'on peut exécuter.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

// ------------------------------------------------------------------ expressions
test("expr : arithmétique, comparaisons et logique", async (t) => {
  const expr = await charger("../src/lib/expr.js");
  if (!expr) return t.skip("module indisponible hors navigateur");
  assert.equal(expr.evaluate("1 + 2 * 3"), 7);
  assert.equal(expr.evaluate("(1 + 2) * 3"), 9);
  assert.equal(expr.evaluate("2 > 1"), true);
  assert.equal(expr.evaluate("'a' !== 'b'"), true);
  assert.equal(expr.evaluate("true && false"), false);
  assert.equal(expr.evaluate("false || 3"), true);
  assert.equal(expr.evaluate("1 ? 'oui' : 'non'"), "oui");
});

test("expr : contexte, membres et index", async (t) => {
  const expr = await charger("../src/lib/expr.js");
  if (!expr) return t.skip("module indisponible hors navigateur");
  const ctx = { acte: { numero: "2026-001", tags: ["a", "b"] }, seuil: 2 };
  assert.equal(expr.evaluate("acte.numero", ctx), "2026-001");
  assert.equal(expr.evaluate("acte.tags[1]", ctx), "b");
  assert.equal(expr.evaluate("seuil * 10", ctx), 20);
});

test("expr : l'opérateur `in` couvre les listes et les chaînes", async (t) => {
  const expr = await charger("../src/lib/expr.js");
  if (!expr) return t.skip("module indisponible hors navigateur");
  assert.equal(expr.evaluate("'x' in liste", { liste: ["x", "y"] }), true);
  assert.equal(expr.evaluate("'z' in liste", { liste: ["x", "y"] }), false);
  assert.equal(expr.evaluate("'x' in 'xyz'"), true);
});

test("expr : une expression invalide est SIGNALÉE, jamais exécutée", async (t) => {
  const expr = await charger("../src/lib/expr.js");
  if (!expr) return t.skip("module indisponible hors navigateur");
  // Le contrôle rend un verdict sans lever ; `evaluate` lève sur une erreur.
  assert.equal(expr.checkExpr("1 +").ok, false);
  assert.equal(typeof expr.checkExpr("1 +").error, "string");
  assert.equal(expr.checkExpr("1 + 1").ok, true);
  assert.throws(() => expr.evaluate("1 +"));
  // Aucun `eval` : une tentative de sortie du langage ne trouve rien à évaluer.
  assert.equal(expr.evaluate("this"), undefined);
});

// ------------------------------------------------------------------ assainissement
test("sanitize : les adresses dangereuses sont refusées", async (t) => {
  const s = await charger("../src/lib/sanitize.js");
  if (!s) return t.skip("module indisponible hors navigateur");
  assert.equal(s.adresseSure("https://exemple.fr/acte", false), true);
  assert.equal(s.adresseSure("/eli/arr/2026/0001/vsl", false), true);
  assert.equal(s.adresseSure("#recueil-contenu", false), true);
  assert.equal(s.adresseSure("mailto:maire@exemple.fr", false), true);
  // Schémas exécutables — y compris obfusqués par espace ou tabulation.
  assert.equal(s.adresseSure("javascript:alert(1)", false), false);
  assert.equal(s.adresseSure("java\tscript:alert(1)", false), false);
  assert.equal(s.adresseSure(" JAVASCRIPT:alert(1)", false), false);
  assert.equal(s.adresseSure("vbscript:msgbox(1)", false), false);
  // Données : une image matricielle peut être une SOURCE, un HTML jamais.
  assert.equal(s.adresseSure("data:image/png;base64,AAAA", true), true);
  assert.equal(s.adresseSure("data:text/html;base64,AAAA", true), false);
  assert.equal(s.adresseSure("data:image/png;base64,AAAA", false), false);
});

test("sanitize : le fragment publié perd ce qui peut exécuter", async (t) => {
  const s = await charger("../src/lib/sanitize.js");
  if (!s || typeof DOMParser === "undefined") return t.skip("DOMParser requis");
  const propre = s.assainirHtml(
    '<p onclick="x()">a</p><script>bad()</script>' +
    '<a href="javascript:y()">l</a><em>b</em><img src="data:image/png;base64,AA">' +
    '<iframe src="https://tiers"></iframe>',
  );
  assert.doesNotMatch(propre, /onclick/);
  assert.doesNotMatch(propre, /<script/);
  assert.doesNotMatch(propre, /javascript:/);
  assert.doesNotMatch(propre, /<iframe/);
  assert.match(propre, /<em>b<\/em>/);
  assert.match(propre, /data:image\/png/);
});

// ------------------------------------------------------------------ numérotation
test("numbering : gabarit et jetons inconnus", async (t) => {
  const n = await charger("../src/lib/numbering.js");
  if (!n) return t.skip("module indisponible hors navigateur");
  assert.equal(n.remplacerJetons("{year}-{seq}", { year: 2026, seq: "007" }), "2026-007");
  // Un jeton inconnu n'est PAS remplacé : il reste lisible tel quel.
  assert.equal(n.remplacerJetons("{year}-{inconnu}", { year: 2026 }), "2026-{inconnu}");
  assert.equal(n.cheminNormalise("articles[2].clauses[0]"), "articles.2.clauses.0");
  const entetes = n.lireEntetes("Authorization: Bearer x\nContent-Type: application/json");
  assert.equal(entetes.Authorization, "Bearer x");
  assert.equal(entetes["Content-Type"], "application/json");
});

// ------------------------------------------------------------------ version
test("version : numéro sémantique et libellés", async (t) => {
  const v = await charger("../src/lib/version.js");
  if (!v) return t.skip("module indisponible hors navigateur");
  assert.match(v.APP_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(v.versionLabel("1.2.3"), "v1.2.3");
  assert.equal(v.releasedLabel("2026-09-21"), "21/09/2026");
});

// ------------------------------------------------------------------ assemblées
test("conseils : l'assemblée d'une entité, et la qualité qui signe", async (t) => {
  const c = await charger("../src/lib/conseils.js");
  if (!c) return t.skip("module indisponible hors navigateur");
  const config = {
    roles: [
      { id: "maire", m: "maire", f: "maire", label: "Maire" },
      { id: "president-ca", m: "président du conseil d'administration", f: "présidente du conseil d'administration", label: "Président du CA" },
    ],
    councils: [
      { id: "cm", entityId: "vsl", name: "Conseil municipal de V", authorityFormula: "Le conseil municipal de V", signerRoleId: "maire", actif: true },
      { id: "ca", entityId: "oph", name: "Conseil d'administration de l'O", authorityFormula: "Le conseil d'administration de l'O", signerRoleId: "president-ca", actif: true },
    ],
  };
  assert.equal(c.conseilPourActe(config, { entityId: "vsl" }).id, "cm");
  assert.equal(c.conseilPourActe(config, { entityId: "oph" }).id, "ca");
  assert.equal(c.conseilPourActe(config, { entityId: "vsl", conseilId: "ca" }).id, "ca");
  assert.equal(c.conseilPourActe(config, { entityId: "inconnu" }), null);
  const e = c.enrichirConseil(config, config.councils[1], { signataire: { civility: "Madame" } });
  assert.equal(e.signerQualite, "présidente du conseil d'administration");
  assert.equal(e.signerQualiteArticleMaj, "La présidente du conseil d'administration");
});

test("compile : un acte d'assemblée porte la formule du conseil", async (t) => {
  const compileMod = await charger("../src/lib/compile.js");
  const schemaMod = await charger("../src/lib/schema.js");
  if (!compileMod || !schemaMod || !schemaMod.newTrame) return t.skip("module indisponible hors navigateur");
  const { compile } = compileMod;
  const { newTrame, newNode } = schemaMod;
  const config = {
    brand: { baseUri: "https://exemple.fr" },
    roles: [{ id: "maire", m: "maire", f: "maire", label: "Maire" }],
    entities: [{ id: "vsl", code: "VSL", kind: "commune", name: "Ville de V", nameWithArt: "la ville de V", authorityFormula: "{qualite} de V" }],
    councils: [{ id: "cm", entityId: "vsl", name: "Conseil municipal de V", authorityFormula: "Le conseil municipal de V", signerRoleId: "maire", actif: true }],
    people: [{ id: "p1", civility: "Madame", firstName: "A", lastName: "B", roles: ["maire"], entityId: "vsl" }],
    refs: [], mentions: [], families: [], actTypes: [{ id: "deliberation", label: "Délibération" }],
    numbering: { year: 2026, seq: 1, eliPattern: "{baseUri}/eli/{actTypeId}/{year}/{seq}/{entityCode}", pad: 3 },
  };
  const trame = newTrame({
    id: "t", name: "Délibération", actTypeId: "deliberation", assemblee: true,
    fields: [{ id: "numero", type: "text" }, { id: "objet", type: "text" }, { id: "dateSignature", type: "date" }, { id: "signataire", type: "signataire" }],
    body: [newNode("authority", { text: "{{autorite}}" }), newNode("signature", { place: "{{entity.seatCity}}" })],
  });
  const doc = compile(trame, { numero: "2026-001-VSL", objet: "x", dateSignature: "2026-01-01", signataire: "p1", __entityId: "vsl" }, config);
  const autorite = (doc.nodes.find((n) => n.type === "authority") || {}).text;
  assert.equal(autorite, "Le conseil municipal de V");
  assert.equal(doc.meta.conseil && doc.meta.conseil.signerRoleId, "maire");
});

// ------------------------------------------------------------------ ELI
test("eli : l'identifiant et l'adresse ne se confondent pas", async (t) => {
  const e = await charger("../src/lib/eli.js");
  if (!e) return t.skip("module indisponible hors navigateur");
  const config = { brand: { baseUri: "https://exemple.fr/" } };
  assert.equal(e.eliIdentifiant("eli:/fr/arr/2026/0464/vsl"), "eli:/fr/arr/2026/0464/vsl");
  assert.equal(e.eliAdresse({ config, eliUri: "eli:/fr/arr/2026/0464/vsl" }), "https://exemple.fr/eli/arr/2026/0464/vsl");
  assert.equal(e.eliAdresse({ config: { brand: { baseUri: "" } }, eliUri: "eli:/fr/arr/2026/0464/vsl" }), "");
});

// ------------------------------------------------------------------ transmission
test("legalite : une transmission simulée porte une mention qualifiée", async (t) => {
  const l = await charger("../src/lib/legalite.js");
  if (!l) return t.skip("module indisponible hors navigateur");
  const reel = await l.certificatTransmission({ reference: "AR-1", recuLe: "2026-01-02T09:14:00Z", destinataire: "Préfecture", empreinte: "abc" });
  const simule = await l.certificatTransmission({ reference: "AR-1", recuLe: "2026-01-02T09:14:00Z", destinataire: "Préfecture", empreinte: "abc", demonstration: true });
  assert.equal(reel.demonstration, false);
  assert.doesNotMatch(reel.mention, /simulation/i);
  assert.equal(simule.demonstration, true);
  assert.match(simule.mention, /simulée/);
  // Le sceau se recalcule des mêmes mentions : il lie le certificat au document.
  const v = await l.verifierCertificatTransmission(simule, { empreinte: "abc" });
  assert.equal(v.ok, true);
});

// ------------------------------------------------------------------ apparence
test("theme : l'emblème du thème sombre, et le repli sur l'emblème ordinaire", async (t) => {
  const theme = await charger("../src/lib/theme.js");
  if (!theme) return t.skip("module indisponible hors navigateur");
  const brand = { logoUrl: "clair.png", logoUrlDark: "sombre.png" };
  assert.equal(theme.brandLogoUrl(brand, { dark: false }), "clair.png");
  assert.equal(theme.brandLogoUrl(brand, { dark: true }), "sombre.png", "le thème sombre prend la variante");
  assert.equal(theme.brandLogoUrl({ logoUrl: "clair.png" }, { dark: true }), "clair.png",
    "sans variante, l'emblème ordinaire sert dans les deux thèmes");
  assert.equal(theme.brandLogoUrl({ logoUrlDark: "sombre.png" }, { dark: false }), "",
    "la variante ne s'emploie jamais sur le thème clair");
  assert.equal(theme.brandLogoUrl({}), "");
  assert.equal(theme.brandLogoUrl(null), "");
});

// ------------------------------------------------------------------ comptes
// Ce que la remise à zéro du référentiel a le droit d'emporter : les comptes du
// jeu de démonstration, jamais ceux du déploiement (note 1.3.2p).
test("auth : les comptes appartiennent-ils au déploiement ?", async (t) => {
  const auth = await charger("../src/lib/auth.js");
  if (!auth) return t.skip("module indisponible hors navigateur");
  auth.setDeploiementAuth({ mode: "password", demo: true, demoJeu: true });
  assert.equal(auth.comptesDuDeploiement(), true, "comptes locaux : ils ne partent pas avec le référentiel");
  auth.setDeploiementAuth({ mode: "oidc", demo: false, demoJeu: false });
  assert.equal(auth.comptesDuDeploiement(), true, "annuaire : les comptes non plus");
  auth.setDeploiementAuth({ mode: "demo", demo: true, demoJeu: true });
  assert.equal(auth.comptesDuDeploiement(), false, "en démonstration, les comptes sont ceux du jeu fictif");
  auth.setDeploiementAuth(null);
  assert.equal(auth.comptesDuDeploiement(), false, "sans déploiement (aperçu, page statique) : rien à épargner");
});

// ------------------------------------------------------ annuaire (seconde porte)
// L'annuaire peut être branché de deux façons : comme porte ORDINAIRE (mode
// « oidc »), ou À CÔTÉ de la porte ordinaire (comptes locaux, comptes de
// l'application) — c'est la « seconde porte ». Ces épreuves tiennent la règle
// qui décide si l'écran de connexion la propose : une case cochée sans
// fournisseur n'ouvre rien, et une porte qui n'ouvrirait aucune donnée (service
// à session) n'est pas proposée non plus.
test("annuaire : la seconde porte ne s'ouvre que sur un fournisseur réellement branché", async (t) => {
  const auth = await charger("../src/lib/auth.js");
  if (!auth) return t.skip("module indisponible hors navigateur");
  auth.setDeploiementAuth(null);

  const base = { mode: "demo", annuaire: true, issuer: "https://annuaire.exemple.fr", clientId: "scribae" };
  assert.equal(auth.annuairePropose({ auth: base }), true);
  assert.equal(auth.annuaireSecondePorte({ auth: base }), true);

  // Un fournisseur incomplet n'ouvre rien : cocher la case ne suffit pas.
  assert.equal(auth.annuairePropose({ auth: { ...base, clientId: "" } }), false);
  assert.equal(auth.annuairePropose({ auth: { ...base, issuer: "" } }), false);
  assert.equal(auth.annuaireFermePour({ auth: { ...base, clientId: "" } }), "Identifiant du client (client_id) manquant.");

  // L'annuaire d'essai est un choix EXPLICITE : il ouvre la porte sans adresse.
  assert.equal(auth.annuairePropose({ auth: { mode: "demo", annuaire: true, test: true } }), true);
  assert.equal(auth.isTestProvider(auth.authConfig({ auth: { mode: "demo", annuaire: true, test: true } })), true);

  // Seconde porte non demandée : rien à proposer, même avec un fournisseur.
  assert.equal(auth.annuairePropose({ auth: { ...base, annuaire: false } }), false);
  assert.equal(auth.annuaireFermePour({ auth: { ...base, annuaire: false } }), "");

  // Porte ordinaire : elle reste proposée, quoi qu'il arrive.
  assert.equal(auth.annuairePropose({ auth: { mode: "oidc" } }), true);
  assert.equal(auth.annuaireSecondePorte({ auth: { mode: "oidc", annuaire: true } }), false,
    "en mode annuaire, la seconde porte n'existe pas : il est déjà la porte ordinaire");
});

test("annuaire : une porte qui n'ouvrirait aucune donnée n'est pas proposée", async (t) => {
  const auth = await charger("../src/lib/auth.js");
  if (!auth) return t.skip("module indisponible hors navigateur");
  const config = { auth: { mode: "demo", annuaire: true, issuer: "https://annuaire.exemple.fr", clientId: "scribae" } };

  // Sans service, ou sur un service à jeton : les données suivent la session de
  // l'application, la porte est proposée.
  auth.setDeploiementAuth(null);
  assert.equal(auth.annuairePropose(config), true);

  // Service à SESSION (comptes locaux), mais ANTÉRIEUR au branchement : il ne
  // sait pas ouvrir une session à partir de l'annuaire, qui n'ouvrirait alors
  // qu'une identité, pas les actes — la porte n'est pas proposée, et la raison
  // est dite.
  auth.setDeploiementAuth({ mode: "password", demo: false, demoJeu: false, session: true });
  assert.equal(auth.annuaireParLeService(), false, "un service muet ne promet rien");
  assert.equal(auth.annuairePropose(config), false);
  assert.match(auth.annuaireFermePour(config), /session de service/);

  // Service À JOUR (`annuaireService`) : c'est LUI le client OIDC, il ouvre SA
  // session — la porte est donc proposée, même quand les données se lisent par
  // une session. C'est ce que le service publie dans `GET /v1/auth/config`.
  auth.setDeploiementAuth({ mode: "password", demo: false, demoJeu: false, session: true, annuaireService: true });
  assert.equal(auth.annuaireParLeService(), true);
  assert.equal(auth.annuairePropose(config), true, "le service ouvre la session : la porte mène quelque part");
  assert.equal(auth.annuaireFermePour(config), "");
  // …mais pas sans fournisseur : la porte reste une adresse et un identifiant.
  assert.equal(auth.annuairePropose({ auth: { ...config.auth, clientId: "" } }), false);
  assert.match(auth.annuaireFermePour({ auth: { ...config.auth, clientId: "" } }), /client_id/);
  auth.setDeploiementAuth(null);
});

test("annuaire : les réglages publiés par le service recouvrent le référentiel", async (t) => {
  const auth = await charger("../src/lib/auth.js");
  if (!auth) return t.skip("module indisponible hors navigateur");

  // En mode « comptes locaux », le référentiel n'est pas lisible avant la
  // session : c'est le SERVICE qui publie les réglages de l'annuaire.
  auth.setDeploiementAuth({
    mode: "password", demo: false,
    annuaire: {
      annuaire: true, issuer: "https://annuaire.deploiement.fr", clientId: "scribae",
      roleMap: [{ claim: "scribae-admins", role: "administrateur" }],
      endpoints: { token: "https://annuaire.deploiement.fr/token" },
    },
  });
  const a = auth.authConfig({ auth: { issuer: "https://annuaire.du-referentiel.fr", scopes: "openid email" } });
  assert.equal(a.issuer, "https://annuaire.deploiement.fr", "le service fait foi");
  assert.equal(a.scopes, "openid email", "ce que le service ne publie pas vient du référentiel");
  assert.deepEqual(a.roleMap, [{ claim: "scribae-admins", role: "administrateur" }]);
  assert.equal(a.endpoints.token, "https://annuaire.deploiement.fr/token");
  assert.equal(a.mode, "password", "le MODE vient du déploiement (AUTH_MODE)");
  assert.equal(auth.providerProblems(a).length, 0);
  auth.setDeploiementAuth(null);

  // Un service antérieur ne publie rien : le référentiel reprend la main.
  const b = auth.authConfig({ auth: { issuer: "https://annuaire.du-referentiel.fr" } });
  assert.equal(b.issuer, "https://annuaire.du-referentiel.fr");
});

test("annuaire : la liste blanche du navigateur est celle du service", async (t) => {
  const auth = await charger("../src/lib/auth.js");
  const serveur = await charger("../src/server/mysql/annuaire.mjs");
  if (!auth || !serveur) return t.skip("module indisponible hors navigateur");
  assert.deepEqual(auth.ANNUAIRE_CLES.slice().sort(), serveur.CHAMPS_PUBLICS.slice().sort(),
    "les deux listes blanches ne doivent pas diverger");
});

// QUAND LE SERVICE FAIT LA CONNEXION, C'EST LUI QU'ON INTERROGE. Le navigateur ne
// parle plus au fournisseur — ni pour la découverte, ni pour l'échange du code.
// C'est ce qui fait fonctionner un annuaire qui n'ouvre pas le CORS, et ce qui
// ouvre la seconde porte en mode « comptes locaux ». On l'éprouve en posant un
// faux réseau : le service auto-hébergé est repéré par `__SCRIBA_SELF_HOSTED__`,
// et ses appels passent par `fetch` (voir src/lib/remote.js).
test("annuaire : quand le service est le client OIDC, la découverte et l'échange passent par lui", async (t) => {
  const auth = await charger("../src/lib/auth.js");
  const oidc = await charger("../src/lib/oidc.js");
  if (!auth || !oidc) return t.skip("module indisponible hors navigateur");
  const vraiFetch = globalThis.fetch;
  const appels = [];
  const reponse = (status, body) => ({
    ok: status < 400, status, headers: { forEach() {} },
    json: async () => body, text: async () => JSON.stringify(body),
  });
  try {
    globalThis.__SCRIBA_SELF_HOSTED__ = true;
    globalThis.__SCRIBA_API_BASE__ = "https://service.exemple.fr";
    globalThis.fetch = async (url, init = {}) => {
      appels.push({ url: String(url), init });
      if (String(url).endsWith("/v1/auth/annuaire/decouverte")) {
        return reponse(200, { ok: true, source: "découverte", endpoints: {
          issuer: "https://annuaire.maville.fr",
          authorization_endpoint: "https://annuaire.maville.fr/auth",
          token_endpoint: "https://annuaire.maville.fr/token",
          jwks_uri: "https://annuaire.maville.fr/certs",
          userinfo_endpoint: "",
        } });
      }
      if (String(url).endsWith("/v1/auth/annuaire")) {
        return reponse(200, {
          utilisateur: { id: "u-1", role: "editeur" }, created: true, linked: "création",
          role: "editeur", visiteur: false, mustChange: false, csrf: "jeton",
          checks: [{ label: "Signature", ok: true, detail: "vérifiée" }], warnings: [],
        });
      }
      throw new Error("appel inattendu : " + url);
    };
    auth.setDeploiementAuth({ mode: "password", demo: false, session: true, annuaireService: true });
    assert.equal(auth.annuaireParLeService(), true);
    const effective = auth.authConfig({ auth: { annuaire: true, issuer: "https://annuaire.maville.fr", clientId: "scribae" } });

    const ep = await oidc.discover(effective);
    assert.equal(ep.token_endpoint, "https://annuaire.maville.fr/token");
    assert.equal(appels[0].url, "https://service.exemple.fr/v1/auth/annuaire/decouverte", "c'est le SERVICE qui lit le document");
    // La connexion ne désigne pas de fournisseur : c'est celui du service, et il
    // n'appartient pas au navigateur de le choisir (l'Administration › Annuaire,
    // elle, éprouve l'adresse saisie).
    assert.deepEqual(JSON.parse(appels[0].init.body), { issuer: "" });

    const res = await oidc.connexionParLeService({ code: "le-code", verifier: "le-verificateur", redirectUri: "https://actes.maville.fr/", nonce: "n-1" });
    assert.equal(appels[1].url, "https://service.exemple.fr/v1/auth/annuaire");
    assert.deepEqual(JSON.parse(appels[1].init.body),
      { code: "le-code", verifier: "le-verificateur", redirectUri: "https://actes.maville.fr/", nonce: "n-1" });
    assert.equal(res.session.utilisateur.id, "u-1", "la session du service est adoptée telle quelle");
    assert.equal(res.checks.length, 1, "les contrôles du service remontent jusqu'à l'écran");
  } finally {
    globalThis.fetch = vraiFetch;
    delete globalThis.__SCRIBA_SELF_HOSTED__;
    delete globalThis.__SCRIBA_API_BASE__;
    auth.setDeploiementAuth(null);
  }
});

// Les règles « revendications → compte » sont écrites DEUX FOIS : côté navigateur
// (src/lib/oidc.js, pour un branchement qui n'a pas de service), et côté service
// (src/server/mysql/annuaire-service.mjs, qui est le client OIDC depuis 1.6.1p).
// Le second ne peut pas importer le premier : l'image du service ne contient que
// son dossier. Ces épreuves confrontent donc les deux implémentations sur les
// mêmes revendications — rôle, périmètre, identité — et sur les CONTRÔLES du
// jeton, dont les libellés sont montrés à l'administrateur après la connexion :
// il doit lire la même chose, que la vérification ait eu lieu ici ou là.
test("annuaire : les règles du service disent la même chose que celles du navigateur", async (t) => {
  const auth = await charger("../src/lib/auth.js");
  const oidc = await charger("../src/lib/oidc.js");
  const serveur = await charger("../src/server/mysql/annuaire-service.mjs");
  if (!auth || !oidc || !serveur) return t.skip("module indisponible hors navigateur");
  auth.setDeploiementAuth(null);

  const reglages = {
    mode: "password", annuaire: true,
    issuer: "https://annuaire.maville.fr/realms/agents", clientId: "scribae",
    roleClaim: "groups", unknownPolicy: "deny", defaultRole: "redacteur",
    roleMap: [{ claim: "scribae-admins", role: "administrateur" }, { claim: "scribae-editeurs", role: "editeur" }],
    serviceClaim: "services", entityClaim: "entity",
  };
  const config = { auth: reglages, services: [{ id: "s-urb", code: "urbanisme" }], entities: [{ id: "e-vsl", code: "VSL" }] };
  const cas = [
    { groups: ["scribae-editeurs"], services: ["urbanisme"], entity: "VSL", given_name: "Claire", family_name: "Martin", email: "claire.martin@maville.fr" },
    { groups: ["scribae-admins"] },
    { groups: ["inconnu"] },
    { groups: [] },
    { realm_access: { roles: ["scribae-editeurs"] } },
    {},
  ];

  for (const claims of cas) {
    const etiquete = JSON.stringify(claims);
    const cote = oidc.mapRole(reglages, claims);
    const duService = serveur.roleDepuisRevendications(reglages, claims);
    assert.equal(duService.role, cote.role, "rôle : " + etiquete);
    assert.equal(duService.visiteur, cote.visiteur, "accès : " + etiquete);
  }

  for (const claims of cas) {
    const etiquete = JSON.stringify(claims);
    const parLeNavigateur = oidc.claimsToAccount(config, { sub: "a-1", ...claims });
    const parLeService = serveur.revendicationsVersCompte({ referentiel: config, auth: reglages, claims: { sub: "a-1", ...claims } });
    assert.equal(parLeService.patch.role, parLeNavigateur.patch.role, "rôle écrit : " + etiquete);
    assert.equal(parLeService.patch.oidcSub, parLeNavigateur.patch.oidcSub, "identifiant du fournisseur : " + etiquete);
    assert.equal(parLeService.patch.oidcClaim, parLeNavigateur.patch.oidcClaim, "groupe reconnu : " + etiquete);
    assert.equal(parLeService.patch.oidcClaims, parLeNavigateur.patch.oidcClaims, "groupes reçus : " + etiquete);
    assert.equal(parLeService.patch.firstName, parLeNavigateur.patch.firstName, "prénom : " + etiquete);
    assert.equal(parLeService.patch.lastName, parLeNavigateur.patch.lastName, "nom : " + etiquete);
    assert.deepEqual(parLeService.patch.memberships, parLeNavigateur.patch.memberships, "périmètre : " + etiquete);
    assert.equal(parLeService.patch.entityId, parLeNavigateur.patch.entityId, "entité : " + etiquete);
  }

  // Les CONTRÔLES du jeton : mêmes libellés, même ordre, même verdict — c'est ce
  // tableau que l'administrateur relit dans « Connexion à l'annuaire vérifiée ».
  const b64url = (objet) => btoa(unescape(encodeURIComponent(JSON.stringify(objet))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const jeton = [
    b64url({ alg: "RS256", kid: "k1" }),
    b64url({ sub: "a-1", iss: reglages.issuer, aud: "scribae", exp: 1, iat: 1 }),
    "une-signature",
  ].join(".");
  const parLeNavigateur = await oidc.verifyIdToken(reglages, jeton, { nonce: "", endpoints: {} });
  const parLeService = await serveur.verifierJeton({
    auth: reglages, idToken: jeton, nonce: "", jwks: null,
    jwksErreur: "aucune adresse de clés publiée (jwks_uri)",
    crypto: { verifierJws: () => false }, now: () => new Date(),
  });
  assert.deepEqual(parLeService.checks.map((c) => c.label), parLeNavigateur.checks.map((c) => c.label),
    "les contrôles affichés sont les mêmes, dans le même ordre");
  assert.deepEqual(parLeService.checks.map((c) => c.ok), parLeNavigateur.checks.map((c) => c.ok),
    "et ils rendent le même verdict");
  assert.equal(parLeService.ok, parLeNavigateur.ok);
});

// ------------------------------------------------------------------ rôles
// Les rôles de la correspondance d'annuaire (variables.mjs, ROLES_CONNUS) sont
// une COPIE de ROLE_ORDER (le module du service reste pur, sans dépendance) :
// ces deux épreuves tiennent la copie honnête.
test("rôles : la copie du service est celle de l'application", async (t) => {
  const users = await charger("../src/lib/users.js");
  const variables = await charger("../src/server/mysql/variables.mjs");
  if (!users || !variables) return t.skip("module indisponible hors navigateur");
  assert.deepEqual(variables.ROLES_CONNUS.slice().sort(), users.ROLE_ORDER.slice().sort());
});

// ------------------------------------------------------ séquence de numérotation
// Le chrono ne distribue jamais deux fois le même numéro : la réservation enjambe
// les rangs déjà portés par un acte, ou annulés. Sans cette garde, un compteur
// resté en arrière (numéros attribués hors de l'application, reprise d'un autre
// outil, passage d'année) proposerait un numéro déjà pris.
// Voir src/lib/sequence.js et src/lib/numbering.js.
test("sequence : le prochain numéro enjambe les rangs déjà pris", async (t) => {
  const seq = await charger("../src/lib/sequence.js");
  if (!seq) return t.skip("module indisponible hors navigateur");
  const config = { numbering: { seq: 10, pad: 3, year: 2026, pattern: "{year}-{seq}-{entityCode}" } };
  const entity = { code: "VSL" };

  assert.equal(seq.sequenceCourante(config, { entity }), 10);
  assert.equal(seq.nextNumero(config, entity), "2026-010-VSL");
  assert.equal(seq.prochainNumeroLibre(config, { entity, actes: [] }).numero, "2026-010-VSL");

  // Trois rangs déjà pris (dont un lu dans les valeurs du brouillon).
  const actes = [
    { numero: "2026-010-VSL" },
    { numero: "2026-011-VSL" },
    { values: { numero: "2026-012-VSL" } },
  ];
  const libre = seq.prochainNumeroLibre(config, { entity, actes });
  assert.equal(libre.numero, "2026-013-VSL");
  assert.equal(libre.seq, 13);
  assert.equal(libre.sautes, 3);

  // Le compteur se fixe APRÈS le rang réservé, et ne recule jamais.
  assert.equal(seq.fixerSequence(config, libre.seq, { entity }), 14);
  assert.equal(seq.fixerSequence(config, 2, { entity }), 14);
  assert.equal(seq.sequenceCourante(config, { entity }), 14);

  // Un numéro annulé n'est pas réattribué à l'aveugle.
  const c2 = { numbering: { seq: 1, pad: 3, year: 2026, annules: [{ numero: "2026-001-VSL", motif: "erreur de saisie" }] } };
  assert.equal(seq.prochainNumeroLibre(c2, { entity, actes: [] }).numero, "2026-002-VSL");
});

test("sequence : la portée tient un compteur par entité ou par type d'acte", async (t) => {
  const seq = await charger("../src/lib/sequence.js");
  if (!seq) return t.skip("module indisponible hors navigateur");
  const base = { seq: 7, pad: 3, year: 2026, pattern: "{year}-{seq}-{entityCode}" };

  const parEntite = { numbering: { ...base, portee: "entite" } };
  const vsl = { code: "VSL" };
  const ccas = { code: "CCAS" };
  assert.equal(seq.cleSequence(parEntite, { entity: ccas }), "CCAS");
  // Une portée sans compteur part de la séquence générale : rien à ressaisir.
  assert.equal(seq.sequenceCourante(parEntite, { entity: ccas }), 7);
  seq.fixerSequence(parEntite, 7, { entity: vsl });
  assert.equal(seq.sequenceCourante(parEntite, { entity: vsl }), 8);
  assert.equal(seq.sequenceCourante(parEntite, { entity: ccas }), 7, "chaque entité a son chrono");

  const parType = { numbering: { ...base, portee: "type" } };
  assert.equal(seq.cleSequence(parType, { actTypeId: "arrete" }), "arrete");
  seq.fixerSequence(parType, 7, { actTypeId: "arrete" });
  assert.equal(seq.sequenceCourante(parType, { actTypeId: "arrete" }), 8);
  assert.equal(seq.sequenceCourante(parType, { actTypeId: "deliberation" }), 7);
});

test("sequence : un numéro composé se relit (rang, année, entité)", async (t) => {
  const seq = await charger("../src/lib/sequence.js");
  if (!seq) return t.skip("module indisponible hors navigateur");
  const config = { numbering: { seq: 1, pad: 3, year: 2026, pattern: "{year}-{seq}-{entityCode}" } };
  assert.equal(seq.seqDeNumero(config, "2026-412-VSL"), 412);
  assert.equal(seq.anneeDeNumero(config, "2026-412-VSL"), 2026);
  assert.equal(seq.entiteCodeDeNumero(config, "2026-412-VSL"), "VSL");
  // Un motif surnuméraire qui change de forme : la relecture suit le motif.
  const c2 = { numbering: { seq: 1, year: 2026, pattern: "{entityCode}/{actTypeId}/{year}/{seq}" } };
  assert.equal(seq.seqDeNumero(c2, "VSL/arrete/2026/7"), 7);
  assert.equal(seq.entiteCodeDeNumero(c2, "VSL/arrete/2026/7"), "VSL");
});

// --------------------------------------------------------------- chrono
// L'écran « Chrono de numérotation » se bâtit sur ce noyau : chaque acte
// numéroté donne une ligne, les rangs jamais attribués en donnent une aussi.
test("chrono : les lignes, les rangs libres et les filtres", async (t) => {
  const chrono = await charger("../src/lib/chrono.js");
  if (!chrono) return t.skip("module indisponible hors navigateur");
  const config = {
    entities: [{ id: "e1", code: "VSL", name: "Ville" }],
    actTypes: [{ id: "arrete", label: "Arrêté" }],
    numbering: { seq: 4, pad: 3, year: 2026, pattern: "{year}-{seq}-{entityCode}" },
  };
  const actes = [
    { id: "a1", numero: "2026-001-VSL", objet: "premier", entityId: "e1", statut: "publie", createdAt: "2026-01-05" },
    { id: "a2", numero: "2026-003-VSL", objet: "troisième", entityId: "e1", statut: "brouillon", createdAt: "2026-01-09" },
    { id: "a3", values: { numero: "" }, objet: "sans numéro : hors chrono" },
  ];
  const lignes = chrono.lignesChrono(config, actes);
  assert.equal(lignes.length, 2, "un acte sans numéro n'entre pas au chrono");

  const libres = chrono.rangsLibres(config, lignes);
  assert.deepEqual(libres.map((l) => l.seq), [2], "le rang 2 n'a jamais été tiré");

  const toutes = [...lignes, ...libres];
  assert.equal(chrono.resumeChrono(config, toutes).total, 2);
  assert.equal(chrono.resumeChrono(config, toutes).libres, 1);

  const masque = chrono.filtrerTrier(toutes, { ...chrono.FILTRES_VIDES, libres: false });
  assert.equal(masque.length, 2, "les rangs libres se masquent");

  const cherche = chrono.filtrerTrier(toutes, { ...chrono.FILTRES_VIDES, q: "premier" });
  assert.deepEqual(cherche.map((l) => l.numero), ["2026-001-VSL"]);

  const titre = chrono.tableauDe(lignes)[0];
  assert.equal(titre.length, chrono.COLONNES_CHRONO.length, "l'export a les mêmes colonnes que le tableau");
  assert.equal(titre[0], "Numéro");
});

// ---------------------------------------------------- informations du recueil
// L'ordre de l'ATELIER ne peut pas être celui du SITE : la liste de l'écran
// « Informations » doit montrer les BROUILLONS — sinon le filtre « Brouillons »
// n'a rien à filtrer, et un billet écrit mais non publié devient introuvable
// dans l'écran qui sert à l'écrire. Le recueil public, lui, ne connaît que les
// billets publiés et ne doit jamais en laisser sortir un seul. Deux publics,
// deux ordres, deux fonctions : c'est ce que ce test fixe.
test("informations : l'atelier voit les brouillons, le recueil public non", async (t) => {
  const inf = await charger("../src/lib/informations.js");
  if (!inf) return t.skip("module indisponible hors navigateur");
  const liste = [
    { id: "i1", slug: "publie-epingle", titre: "A", publie: true, epingle: true, date: "2026-03-01" },
    { id: "i2", slug: "publie-recent", titre: "B", publie: true, epingle: false, date: "2026-05-01" },
    { id: "i3", slug: "brouillon", titre: "C", publie: false, epingle: false, date: "2026-06-01" },
  ];
  // L'épinglé ouvre la liste, puis le plus récent — brouillon compris.
  assert.deepEqual(inf.informationsDeLAtelier(liste).map((i) => i.id), ["i1", "i3", "i2"]);
  assert.deepEqual(inf.informationsOrdonnees(liste).map((i) => i.id), ["i1", "i2"],
    "le recueil public ne sert jamais un brouillon");
  assert.equal(inf.informationParSlug(liste, "brouillon"), null,
    "l'adresse d'un brouillon ne répond pas au public");

  // Ce qu'il faut pour publier : un titre, un texte, une date.
  assert.deepEqual(inf.manquePourPublier({ titre: "T", corps: "C", date: "2026-01-01" }), []);
  assert.deepEqual(inf.manquePourPublier({ titre: "", corps: "", date: "" }), ["titre", "texte", "date"]);
});

// ------------------------------------------------- le contrat `GET /v1/auth/config`
// Le service publie dans `GET /v1/auth/config` ce que le client doit savoir de
// son état : le mode, ce qu'il sait faire de ses portes (comptes locaux, session,
// et s'il est le client OIDC), l'état de l'amorçage de son compte
// d'administration. Le client les recueille dans `setDeploiementAuth`
// (src/lib/auth.js), qui n'accepte QUE les champs qu'on lui passe : un champ
// publié mais oublié en route est un champ PERDU, et le client se rabat alors sur
// ses suppositions — sans que rien ne le signale, ni ici ni dans les journaux du
// service.
//
// C'est arrivé : `annuaireService` oublié dans `chargerModeDeploiement` faisait
// passer un service À JOUR pour un service ANTÉRIEUR. La découverte repartait du
// navigateur — donc « Failed to fetch » chez un fournisseur qui n'ouvre pas le
// CORS —, et la seconde porte n'était pas proposée. Cette épreuve fixe le
// contrat : chaque champ que `setDeploiementAuth` LIT doit être TRANSMIS par
// `chargerModeDeploiement`.
test("service : les champs que le client lit de `GET /v1/auth/config` lui sont tous transmis", async (t) => {
  let readFile = null;
  try { ({ readFile } = await import("node:fs/promises")); } catch (e) { readFile = null; }
  if (typeof readFile !== "function") return t.skip("lecture de fichier indisponible hors dépôt");
  const lire = async (chemins) => {
    for (const c of chemins) { try { return await readFile(c, "utf8"); } catch (e) { /* essai suivant */ } }
    return null;
  };
  // Chemins relatifs au dépôt (le dossier courant de `node --test`), avec le
  // repli « racine = src/ » si l'outillage est déplacé un jour.
  const auth = await lire(["src/lib/auth.js", "lib/auth.js"]);
  const etat = await lire(["src/ui/state.js", "ui/state.js"]);
  if (!auth || !etat) return t.skip("sources illisibles hors du dépôt");

  const debut = auth.indexOf("export function setDeploiementAuth");
  const fin = auth.indexOf("export const deploiementAuth");
  assert.ok(debut >= 0 && fin > debut, "setDeploiementAuth est introuvable dans src/lib/auth.js");
  const contrat = auth.slice(debut, fin);
  const champs = [...new Set([...contrat.matchAll(/source\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))];
  assert.ok(champs.length > 10, "le contrat des champs n'a pas pu être lu");
  assert.ok(champs.includes("annuaireService") && champs.includes("adminPanne"), "contrat incomplet");

  const d = etat.indexOf("export async function chargerModeDeploiement");
  const f = etat.indexOf("// La marque de la collectivité");
  assert.ok(d >= 0 && f > d, "chargerModeDeploiement est introuvable dans src/ui/state.js");
  const chargement = etat.slice(d, f);
  const perdus = champs.filter((c) => !new RegExp("(^|[\\s{,])" + c + "\\s*:").test(chargement));
  assert.deepEqual(perdus, [],
    "champs publiés par le service et perdus avant d'atteindre le client : " + perdus.join(", "));

  // Le RATTRAPAGE du mode (`reparerPilote`, src/lib/db/index.js) interroge lui
  // aussi le service, après un appel refusé : c'est l'autre porte par laquelle le
  // drapeau peut manquer, et il n'ouvre le reste de l'état qu'en second.
  const bd = await lire(["src/lib/db/index.js", "lib/db/index.js"]);
  assert.ok(bd, "src/lib/db/index.js est introuvable");
  assert.match(bd, /setDeploiementAuth\(\{[\s\S]{0,400}?annuaireService/,
    "le rattrapage du mode doit reprendre `annuaireService` du service");
});

// ------------------------------------------------------ l'outillage se vérifie aussi
// `scripts/analyse-imports.mjs` est PUR : il ne lit que le texte qu'on lui donne.
// C'est ce qui permet de l'éprouver ici, à côté des modules du métier, au lieu de
// le croire sur parole. La règle sert au contrôle de style (`npm run style`), qui
// refuse un import que plus personne n'emploie — le TODO en portait la liste
// (dix-neuf fichiers, quarante et une mentions), et c'est ce contrôle qui
// l'empêche de se reformer.
test("imports : un nom que personne n'emploie est signalé, et lui seul", async (t) => {
  const analyse = await charger("../scripts/analyse-imports.mjs");
  if (!analyse) return t.skip("module indisponible hors dépôt");
  const noms = (code) => analyse.importsInutilises(code).map((u) => u.nom);

  // Ce qui est employé ne dit rien ; ce qui ne l'est pas est nommé.
  assert.deepEqual(noms("import { h, clear } from \"./dom.js\";\nclear();\n"), ["h"]);
  assert.deepEqual(noms("import * as db from \"./db.js\";\ndb.save();\n"), []);
  assert.deepEqual(noms("import X from \"./x.js\";\nX();\n"), []);
  assert.deepEqual(noms("import X from \"./x.js\";\n"), ["X"]);
  assert.deepEqual(noms("import { a as b } from \"./z.js\";\nb();\n"), []);
  assert.deepEqual(noms("import { a as b } from \"./z.js\";\n"), ["b"]);
  assert.deepEqual(noms("import X, { a, b } from \"./z.js\";\nX(); b();\n"), ["a"]);
  // Une déclaration multiligne, et un import « d'effet » (aucun nom à vérifier).
  assert.deepEqual(noms("import {\n  un,\n  deux,\n} from \"./z.js\";\ndeux();\n"), ["un"]);
  assert.deepEqual(noms("import \"./effet.js\";\n"), []);

  // Le numéro de ligne est celui de la DÉCLARATION : c'est ce que lit le rapport.
  const plusBas = "const a = 1;\nconst b = 2;\nimport { perdu } from \"./z.js\";\n";
  assert.deepEqual(analyse.importsInutilises(plusBas), [{ nom: "perdu", ligne: 3 }]);

  // Un nom cité ailleurs — fût-ce dans un commentaire — tient l'import pour
  // employé : mieux vaut manquer un défaut que d'en inventer un.
  assert.deepEqual(noms("import { h } from \"./x.js\";\n// h servira plus tard\n"), []);
});
