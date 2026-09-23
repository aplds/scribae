// ============================================================================
// Tests du domaine « comptes locaux » (mode mot de passe).
//
//   node --test          (ou: npm test)
//
// Le domaine est pur : on lui injecte une empreinte (du `node:crypto`), une
// horloge que l'on avance à la main, et une persistance en mémoire. Aucune base,
// aucun réseau — donc on peut éprouver le blocage après échecs, l'expiration
// d'une session, l'anti-CSRF, sans attendre et sans rien installer.
//
// Ce qui est VÉRIFIÉ ici n'est pas la forme des réponses mais les propriétés qui
// font la sûreté du mécanisme : aucun dérivé ne sort jamais du service, deux
// comptes de même mot de passe ont des dérivés différents, un échec ne dit pas
// si l'identifiant existe, une écriture sans en-tête anti-CSRF est refusée, et
// le blocage après plusieurs échecs cède au bout du délai.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes as octetsAlea, scryptSync, timingSafeEqual } from "node:crypto";
import {
  createComptes, scellerMotDePasse, verifierMotDePasse, lireScelle, motDePasseFaible,
  genererMotDePasse, normaliserLogin, COOKIE_SESSION, COOKIE_CSRF, SEUIL_ECHECS,
  MDP_MIN_LONGUEUR, MDP_MAX_LONGUEUR,
} from "./comptes.mjs";

// ---------------------------------------------------------------- outillage
// Le port de crypto attendu par le domaine, tenu par le VRAI `node:crypto` :
// c'est exactement celui du service (voir server.mjs, `cryptoPort`).
const crypto = {
  randomBytes: (n) => octetsAlea(n),
  scrypt: (mdp, sel, { N, r, p, keylen }) =>
    scryptSync(String(mdp), Buffer.from(sel), keylen, { N, r, p, maxmem: 256 * N * r }),
  sha256: (s) => createHash("sha256").update(String(s), "utf8").digest("hex"),
  b64: (o) => Buffer.from(o).toString("base64"),
  deb64: (t) => new Uint8Array(Buffer.from(String(t), "base64")),
  meme: (a, b) => {
    const A = Buffer.from(a), B = Buffer.from(b);
    return A.length === B.length && timingSafeEqual(A, B);
  },
};

// Un scrypt plus léger que celui de la production : les tests éprouvent la
// MÉCANIQUE, pas le coût. Le coût se règle par `SCRYPT_N` dans le `.env`.
const SCRYPT_TEST = { N: 1024, r: 8, p: 1 };

const COMPTES = [
  { id: "u-admin", login: "j.mercier", firstName: "Julie", lastName: "Mercier", role: "administrateur", roles: ["administrateur"], source: "local", active: true },
  { id: "u-red", login: "p.dubois", firstName: "Paul", lastName: "Dubois", role: "redacteur", roles: ["redacteur"], source: "local", active: true },
  { id: "u-demo", login: "demo", firstName: "Démo", lastName: "Admin", role: "administrateur", roles: ["administrateur"], source: "demo", active: true },
];

const MDP_ADMIN = "Charbon-9-Vertige";
const MDP_RED = "Prairie-4-Lanterne";

// La persistance en mémoire : les mêmes méthodes que `createStoreMysql`, avec
// les MÊMES noms de colonnes (le domaine lit `must_change`, `bloque_jusqua`…).
function memoire() {
  const users = new Map(COMPTES.map((c) => [c.id, { ...c }]));
  const mdps = new Map();
  const sessions = new Map();
  const at = () => new Date().toISOString();
  return {
    users, mdps, sessions,
    async lireCompte(id) { return users.get(String(id)) || null; },
    async lireCompteParLogin(login) {
      const l = normaliserLogin(login);
      for (const u of users.values()) if (normaliserLogin(u.login) === l) return u;
      return null;
    },
    async ecrireCompte(c) { users.set(String(c.id), { ...c }); },
    async listerComptesDemo() { return [...users.values()].filter((u) => u.source === "demo"); },
    async lireMdp(userId) { return mdps.get(String(userId)) || null; },
    async ecrireMdp(userId, { hash, mustChange = false }) {
      mdps.set(String(userId), { hash, must_change: mustChange ? 1 : 0, echecs: 0, bloque_jusqua: null, updated_at: at() });
    },
    async majEchecs(userId, { echecs, bloqueJusqua }) {
      const m = mdps.get(String(userId));
      if (!m) return;
      m.echecs = Number(echecs) || 0;
      m.bloque_jusqua = bloqueJusqua || null;
    },
    async listerMdp() {
      return [...mdps.entries()].map(([userId, m]) => ({
        userId, mustChange: !!m.must_change, echecs: m.echecs, bloqueJusqua: m.bloque_jusqua, updatedAt: m.updated_at,
      }));
    },
    async supprimerMdp(userId) {
      mdps.delete(String(userId));
      for (const [k, s] of sessions) if (s.user_id === String(userId)) sessions.delete(k);
    },
    async creerSession(s) { sessions.set(String(s.tokenHash), { user_id: String(s.userId), expires_at: s.expiresAt, last_seen_at: s.at }); },
    async lireSession(h) { return sessions.get(String(h)) || null; },
    async toucherSession(h, at) { const s = sessions.get(String(h)); if (s) s.last_seen_at = at; },
    async supprimerSession(h) { sessions.delete(String(h)); },
    async purgerSessions(at) { for (const [k, s] of sessions) if (new Date(s.expires_at) < new Date(at)) sessions.delete(k); },
  };
}

// Un banc d'essai : le domaine, son magasin, et une horloge que l'on avance.
async function banc({ demo = false, mdpMin = MDP_MIN_LONGUEUR } = {}) {
  const store = memoire();
  let horloge = new Date("2026-03-10T12:00:00.000Z");
  const comptes = createComptes({
    store, crypto, now: () => horloge, sessionJours: 12, mdpMin,
    scryptParams: SCRYPT_TEST, demoAutorise: demo, sessionRequise: true,
  });
  const route = (method, path, { body = null, headers = {}, ctx = {} } = {}) =>
    comptes.route({ method, path, headers, body }, { secure: true, ip: "10.0.0.1", ...ctx });
  const avancer = (ms) => { horloge = new Date(horloge.getTime() + ms); };
  return { store, comptes, route, avancer, maintenant: () => horloge };
}

function cookies(reponse) {
  const brut = [].concat(reponse.headers["set-cookie"] || []);
  const out = {};
  for (const c of brut) {
    const [paire, ...attributs] = String(c).split(";");
    const i = paire.indexOf("=");
    if (i < 0) continue;
    out[paire.slice(0, i).trim()] = { valeur: paire.slice(i + 1).trim(), attributs: attributs.map((a) => a.trim()) };
  }
  return out;
}

// Le cookie d'une session ouverte, tel que le navigateur le renverrait.
function enteteSession(reponse, { csrf = true } = {}) {
  const c = cookies(reponse);
  const cookie = `${COOKIE_SESSION}=${c[COOKIE_SESSION].valeur}`
    + (csrf ? `; ${COOKIE_CSRF}=${c[COOKIE_CSRF].valeur}` : "");
  return { cookie, csrf: csrf ? c[COOKIE_CSRF].valeur : "" };
}

// Ouvre une session et rend de quoi parler au service « en tant que » ce compte.
async function connecter(banc, login, motDePasse) {
  const res = await banc.route("POST", "/v1/auth/connexion", { body: { login, motDePasse } });
  return { res, ...enteteSession(res) };
}

const poserMdp = async (banc, userId, motDePasse, mustChange = false) => {
  await banc.store.ecrireMdp(userId, { hash: await scellerMotDePasse(crypto, motDePasse, SCRYPT_TEST), mustChange });
};

// ------------------------------------------------------------ le mot de passe
test("un mot de passe est scellé, jamais conservé en clair", async () => {
  const scelle = await scellerMotDePasse(crypto, MDP_ADMIN, SCRYPT_TEST);
  assert.match(scelle, /^scrypt\$1024\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.ok(!scelle.includes(MDP_ADMIN));
});

test("deux scellements du même mot de passe diffèrent (sel tiré au hasard)", async () => {
  const a = await scellerMotDePasse(crypto, MDP_ADMIN, SCRYPT_TEST);
  const b = await scellerMotDePasse(crypto, MDP_ADMIN, SCRYPT_TEST);
  assert.notEqual(a, b);
  assert.ok((await verifierMotDePasse(crypto, MDP_ADMIN, a, SCRYPT_TEST)).ok);
  assert.ok((await verifierMotDePasse(crypto, MDP_ADMIN, b, SCRYPT_TEST)).ok);
});

test("la vérification refuse un mauvais mot de passe, un scellé illisible, un dérivé incohérent", async () => {
  const scelle = await scellerMotDePasse(crypto, MDP_ADMIN, SCRYPT_TEST);
  assert.equal((await verifierMotDePasse(crypto, MDP_ADMIN + "x", scelle, SCRYPT_TEST)).ok, false);
  assert.equal((await verifierMotDePasse(crypto, MDP_ADMIN, "n'importe quoi", SCRYPT_TEST)).ok, false);
  assert.equal(lireScelle(crypto, "scrypt$1024$8$1$pas-du-base64$xx"), null);
});

test("un dérivé scellé avec des paramètres plus faibles demande un recalcul", async () => {
  const faible = await scellerMotDePasse(crypto, MDP_ADMIN, { N: 1024, r: 8, p: 1 });
  const v = await verifierMotDePasse(crypto, MDP_ADMIN, faible, { N: 65536, r: 8, p: 1 });
  assert.equal(v.ok, true);
  assert.equal(v.needsRehash, true);
});

// Le service ne dérive PAS sur le fil principal (voir le port de server.mjs et
// l'étude de charge) : le port de crypto peut donc rendre une PROMESSE. Le
// domaine doit l'attendre sans que cela change rien — c'est ce contrat que ce
// test fixe, pour qu'un retour au dérivé synchrone ne passe pas inaperçu.
test("le port de crypto peut rendre le dérivé par une promesse", async () => {
  const cryptoTardif = {
    ...crypto,
    scrypt: (mdp, sel, o) => new Promise((r) => { const cle = crypto.scrypt(mdp, sel, o); r(cle); }),
  };
  const scelle = await scellerMotDePasse(cryptoTardif, MDP_ADMIN, SCRYPT_TEST);
  assert.ok((await verifierMotDePasse(cryptoTardif, MDP_ADMIN, scelle, SCRYPT_TEST)).ok);
  assert.equal((await verifierMotDePasse(cryptoTardif, MDP_ADMIN + "x", scelle, SCRYPT_TEST)).ok, false);
});

test("la politique de mot de passe écarte les cas les plus devinables", () => {
  assert.ok(motDePasseFaible("j.mercier", "court", 12));
  assert.ok(motDePasseFaible("j.mercier", "motdepasse12", 12));
  assert.ok(motDePasseFaible("j.mercier", "JMercier-2026!!", 12));
  assert.ok(motDePasseFaible("j.mercier", "aaaaaaaaaaaaaa", 12));   // une seule classe de caractères
  assert.ok(motDePasseFaible("j.mercier", "a".repeat(MDP_MAX_LONGUEUR + 1), 12));
  assert.equal(motDePasseFaible("j.mercier", MDP_ADMIN, 12), null);
});

test("un mot de passe provisoire est lisible, copiable, et sans caractères confondables", () => {
  for (let i = 0; i < 20; i++) {
    const m = genererMotDePasse(crypto);
    assert.match(m, /^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
    assert.ok(!/[0O1lI]/.test(m));
    assert.equal(motDePasseFaible("j.mercier", m, 12), null);
  }
});

// --------------------------------------------------------------- le service
test("la configuration publique ne dit que ce qu'il faut, et jamais un dérivé", async () => {
  const b = await banc({ demo: false });
  await poserMdp(b, "u-admin", MDP_ADMIN);
  const res = await b.route("GET", "/v1/auth/config");
  assert.equal(res.status, 200);
  assert.equal(res.body.auth, "password");
  assert.equal(res.body.demo, false);
  assert.equal(res.body.motDePasseMin, MDP_MIN_LONGUEUR);
  assert.equal(JSON.stringify(res.body).includes("scrypt"), false);
  assert.equal(res.body.demoComptes, undefined, "aucun compte n'est annoncé quand la démonstration est fermée");
});

test("la démonstration ouverte annonce ses comptes — et seulement eux, sans mot de passe", async () => {
  const b = await banc({ demo: true });
  await poserMdp(b, "u-admin", MDP_ADMIN);
  const res = await b.route("GET", "/v1/auth/config");
  assert.equal(res.body.demoComptes.length, 1);
  assert.equal(res.body.demoComptes[0].id, "u-demo");
  assert.equal(JSON.stringify(res.body).includes("u-admin"), false);
});

test("la connexion refuse sans jamais dire si l'identifiant existe", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  const inconnu = await b.route("POST", "/v1/auth/connexion", { body: { login: "personne", motDePasse: "un-mot-de-passe-long" } });
  const faux = await b.route("POST", "/v1/auth/connexion", { body: { login: "j.mercier", motDePasse: "un-mot-de-passe-long" } });
  assert.equal(inconnu.status, 401);
  assert.equal(faux.status, 401);
  assert.equal(inconnu.body.erreur, faux.body.erreur, "le message ne doit pas distinguer les deux cas");
  assert.equal(inconnu.body.code, "identifiants_invalides");
});

test("la connexion ouvre une session : cookie HttpOnly pour le jeton, cookie lisible pour le CSRF", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  const res = await connecter(b, "J.MERCIER", MDP_ADMIN);   // la casse est indifférente
  assert.equal(res.res.status, 200);
  assert.equal(res.res.body.utilisateur.id, "u-admin");
  assert.equal(res.res.body.mustChange, false);
  assert.equal(JSON.stringify(res.res.body).includes("scrypt"), false, "aucun dérivé ne sort du service");
  const c = cookies(res.res);
  assert.ok(c[COOKIE_SESSION].attributs.includes("HttpOnly"));
  assert.ok(c[COOKIE_SESSION].attributs.includes("Secure"));
  assert.ok(c[COOKIE_SESSION].attributs.includes("SameSite=Lax"));
  assert.equal(c[COOKIE_CSRF].attributs.includes("HttpOnly"), false, "le jeton anti-CSRF doit être lisible par la page");
  // Le jeton anti-CSRF voyage AUSSI dans le corps, dès la connexion. Le cookie
  // n'est lisible que par les pages de SON hôte : une application servie par un
  // autre hôte que le service n'en verrait rien, et ses PREMIÈRES écritures —
  // celles du démarrage, juste après la connexion — partaient sans en-tête et
  // étaient refusées, jusqu'à ce qu'une relecture de session le lui rende.
  assert.equal(res.res.body.csrf, c[COOKIE_CSRF].valeur, "la connexion rend le jeton anti-CSRF, comme /v1/auth/session");
});

test("sans session, tout ce qui touche aux comptes est refusé", async () => {
  const b = await banc();
  for (const [method, path] of [["GET", "/v1/auth/session"], ["GET", "/v1/auth/comptes"], ["POST", "/v1/auth/deconnexion"], ["POST", "/v1/auth/mot-de-passe"]]) {
    const res = await b.route(method, path, { body: {} });
    assert.equal(res.status, 401, `${method} ${path}`);
    assert.equal(res.body.code, "session_absente");
  }
});

test("la session rendue par /v1/auth/session dit le compte, l'état de son mot de passe, et rend le jeton anti-CSRF", async () => {
  const b = await banc();
  await poserMdp(b, "u-red", MDP_RED, true);
  const s = await connecter(b, "p.dubois", MDP_RED);
  const res = await b.route("GET", "/v1/auth/session", { headers: { cookie: s.cookie } });
  assert.equal(res.status, 200);
  assert.equal(res.body.utilisateur.id, "u-red");
  assert.equal(res.body.mustChange, true);
  // Le jeton anti-CSRF voyage AUSSI dans le corps. Il vit dans le cookie (double
  // envoi), mais `document.cookie` ne montre que les cookies de l'hôte de la
  // page : une application servie par un autre hôte que le service ne peut pas le
  // lire, et sans ce jeton elle n'écrirait jamais (voir CHANGELOG, note 1.3.2m).
  assert.equal(res.body.csrf, s.csrf);
});

test("une session dont le cookie anti-CSRF a disparu en reçoit un neuf", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  const s = await connecter(b, "j.mercier", MDP_ADMIN);
  // Cookie de session SEUL : le navigateur a refusé le cookie anti-CSRF (essai en
  // clair avec COOKIE_SECURE=true), ou la session a été ouverte par un autre
  // outil. Sans ce rattrapage, aucune écriture ne passerait avant la prochaine
  // connexion, sans autre issue que de se reconnecter.
  const seul = `${COOKIE_SESSION}=${cookies(s.res)[COOKIE_SESSION].valeur}`;
  const res = await b.route("GET", "/v1/auth/session", { headers: { cookie: seul } });
  assert.equal(res.status, 200);
  assert.ok(res.body.csrf, "un jeton neuf est rendu");
  assert.match(String([].concat(res.headers["set-cookie"] || [])[0] || ""), new RegExp(COOKIE_CSRF + "="), "et reposé en cookie");
  // Le navigateur garde le cookie reposé : l'écriture suivante passe.
  const neuf = { cookie: `${seul}; ${COOKIE_CSRF}=${res.body.csrf}`, csrf: res.body.csrf };
  const ecriture = await b.route("POST", "/v1/auth/mot-de-passe", {
    body: { ancien: MDP_ADMIN, nouveau: "Renouvele-2026" }, headers: { cookie: neuf.cookie, "x-csrf-token": neuf.csrf },
  });
  assert.equal(ecriture.status, 200);
});

test("une session expirée est refusée, puis effacée", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  const s = await connecter(b, "j.mercier", MDP_ADMIN);
  b.avancer(13 * 24 * 3600 * 1000);
  const res = await b.route("GET", "/v1/auth/session", { headers: { cookie: s.cookie } });
  assert.equal(res.status, 401);
  assert.equal(b.store.sessions.size, 0, "la session expirée est retirée");
});

test("une écriture sans en-tête anti-CSRF est refusée, même avec une session valide", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  const s = await connecter(b, "j.mercier", MDP_ADMIN);
  const sansEntete = await b.route("POST", "/v1/auth/mot-de-passe", {
    body: { ancien: MDP_ADMIN, nouveau: "Peu-Importe-2026" }, headers: { cookie: s.cookie },
  });
  assert.equal(sansEntete.status, 403);
  assert.equal(sansEntete.body.code, "csrf_invalide");
  const avecUnAutre = await b.route("POST", "/v1/auth/mot-de-passe", {
    body: { ancien: MDP_ADMIN, nouveau: "Peu-Importe-2026" },
    headers: { cookie: s.cookie, "x-csrf-token": "un-autre-jeton" },
  });
  assert.equal(avecUnAutre.status, 403);
  const bon = await b.route("POST", "/v1/auth/mot-de-passe", {
    body: { ancien: MDP_ADMIN, nouveau: "Peu-Importe-2026" },
    headers: { cookie: s.cookie, "x-csrf-token": s.csrf },
  });
  assert.equal(bon.status, 200);
});

test("changer son mot de passe exige l'ancien, refuse un mot de passe faible, et lève le caractère provisoire", async () => {
  const b = await banc();
  await poserMdp(b, "u-red", MDP_RED, true);
  const s = await connecter(b, "p.dubois", MDP_RED);
  const entetes = { cookie: s.cookie, "x-csrf-token": s.csrf };

  const mauvais = await b.route("POST", "/v1/auth/mot-de-passe", { body: { ancien: "pas-le-bon", nouveau: "Lanterne-7-Prairie" }, headers: entetes });
  assert.equal(mauvais.status, 400);
  assert.equal(mauvais.body.code, "ancien_mot_de_passe");

  const faible = await b.route("POST", "/v1/auth/mot-de-passe", { body: { ancien: MDP_RED, nouveau: "court" }, headers: entetes });
  assert.equal(faible.status, 422);
  assert.equal(faible.body.code, "mot_de_passe_faible");

  const identique = await b.route("POST", "/v1/auth/mot-de-passe", { body: { ancien: MDP_RED, nouveau: MDP_RED }, headers: entetes });
  assert.equal(identique.status, 400);
  assert.equal(identique.body.code, "mot_de_passe_identique");

  const bon = await b.route("POST", "/v1/auth/mot-de-passe", { body: { ancien: MDP_RED, nouveau: "Lanterne-7-Prairie" }, headers: entetes });
  assert.equal(bon.status, 200);
  const apres = await b.route("GET", "/v1/auth/session", { headers: { cookie: s.cookie } });
  assert.equal(apres.body.mustChange, false);
  assert.equal((await b.route("POST", "/v1/auth/connexion", { body: { login: "p.dubois", motDePasse: MDP_RED } })).status, 401);
  assert.equal((await b.route("POST", "/v1/auth/connexion", { body: { login: "p.dubois", motDePasse: "Lanterne-7-Prairie" } })).status, 200);
});

test("après cinq échecs le compte est bloqué, puis se débloque au bout du délai", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  for (let i = 0; i < SEUIL_ECHECS; i++) {
    const res = await b.route("POST", "/v1/auth/connexion", { body: { login: "j.mercier", motDePasse: "faux-mot-de-passe-" + i } });
    assert.equal(res.status, 401);
  }
  const bloque = await b.route("POST", "/v1/auth/connexion", { body: { login: "j.mercier", motDePasse: MDP_ADMIN } });
  assert.equal(bloque.status, 429, "le BON mot de passe est refusé tant que le compte est bloqué");
  assert.equal(bloque.body.code, "trop_de_tentatives");
  assert.ok(Number(bloque.headers["retry-after"]) > 0);

  b.avancer(16 * 60 * 1000);
  const rouvert = await b.route("POST", "/v1/auth/connexion", { body: { login: "j.mercier", motDePasse: MDP_ADMIN } });
  assert.equal(rouvert.status, 200, "le blocage cède de lui-même");
});

test("un compte désactivé ne peut pas se connecter, et sa session meurt avec lui", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  const s = await connecter(b, "j.mercier", MDP_ADMIN);
  assert.equal(s.res.status, 200);
  b.store.users.get("u-admin").active = false;
  assert.equal((await b.route("GET", "/v1/auth/session", { headers: { cookie: s.cookie } })).status, 401);
  assert.equal((await b.route("POST", "/v1/auth/connexion", { body: { login: "j.mercier", motDePasse: MDP_ADMIN } })).status, 401);
});

test("la déconnexion ferme la session côté service", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  const s = await connecter(b, "j.mercier", MDP_ADMIN);
  const res = await b.route("POST", "/v1/auth/deconnexion", { headers: { cookie: s.cookie, "x-csrf-token": s.csrf } });
  assert.equal(res.status, 200);
  assert.ok(cookies(res)[COOKIE_SESSION].attributs.some((a) => /^Max-Age=0$/.test(a)), "le cookie de session est effacé");
  assert.equal((await b.route("GET", "/v1/auth/session", { headers: { cookie: s.cookie } })).status, 401);
});

// -------------------------------------------------------- administration
test("l'état des comptes donne d'un compte ce que l'administrateur doit savoir, sans le dérivé", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  await poserMdp(b, "u-red", MDP_RED, true);
  const s = await connecter(b, "j.mercier", MDP_ADMIN);
  const res = await b.route("GET", "/v1/auth/comptes", { headers: { cookie: s.cookie } });
  assert.equal(res.status, 200);
  const red = res.body.comptes.find((c) => c.userId === "u-red");
  assert.equal(red.defini, true);
  assert.equal(red.mustChange, true);
  assert.equal(red.echecs, 0);
  assert.equal(red.bloque, false);
  assert.equal(JSON.stringify(res.body).includes("scrypt"), false);
});

test("seul un administrateur administre les mots de passe", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  await poserMdp(b, "u-red", MDP_RED);
  const s = await connecter(b, "p.dubois", MDP_RED);
  const lecture = await b.route("GET", "/v1/auth/comptes", { headers: { cookie: s.cookie } });
  assert.equal(lecture.status, 403);
  const pose = await b.route("POST", "/v1/auth/comptes/u-admin/mot-de-passe", {
    body: { motDePasse: "Prise-De-Controle-9" }, headers: { cookie: s.cookie, "x-csrf-token": s.csrf },
  });
  assert.equal(pose.status, 403);
});

test("remettre un mot de passe : le service en engendre un, le rend une fois, et exige son changement", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  const s = await connecter(b, "j.mercier", MDP_ADMIN);
  const entetes = { cookie: s.cookie, "x-csrf-token": s.csrf };
  const res = await b.route("POST", "/v1/auth/comptes/u-red/mot-de-passe", { headers: entetes });
  assert.equal(res.status, 200);
  assert.match(res.body.motDePasse, /^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
  assert.equal(res.body.provisoire, true);
  const etat = (await b.route("GET", "/v1/auth/comptes", { headers: entetes })).body.comptes.find((c) => c.userId === "u-red");
  assert.equal(etat.mustChange, true);

  const session = await connecter(b, "p.dubois", res.body.motDePasse);
  assert.equal(session.res.status, 200);
  assert.equal(session.res.body.mustChange, true);
});

test("poser un mot de passe à la main refuse un mot de passe faible", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  const s = await connecter(b, "j.mercier", MDP_ADMIN);
  const res = await b.route("POST", "/v1/auth/comptes/u-red/mot-de-passe", {
    body: { motDePasse: "court" }, headers: { cookie: s.cookie, "x-csrf-token": s.csrf },
  });
  assert.equal(res.status, 422);
  assert.equal(res.body.code, "mot_de_passe_faible");
});

test("retirer le mot de passe ferme l'accès — et les sessions ouvertes", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  await poserMdp(b, "u-red", MDP_RED);
  const admin = await connecter(b, "j.mercier", MDP_ADMIN);
  const red = await connecter(b, "p.dubois", MDP_RED);
  const res = await b.route("DELETE", "/v1/auth/comptes/u-red/mot-de-passe", {
    headers: { cookie: admin.cookie, "x-csrf-token": admin.csrf },
  });
  assert.equal(res.status, 200);
  assert.equal((await b.route("GET", "/v1/auth/session", { headers: { cookie: red.cookie } })).status, 401);
  assert.equal((await b.route("POST", "/v1/auth/connexion", { body: { login: "p.dubois", motDePasse: MDP_RED } })).status, 401);
  const etat = (await b.route("GET", "/v1/auth/comptes", { headers: { cookie: admin.cookie } })).body.comptes.find((c) => c.userId === "u-red");
  assert.equal(etat, undefined, "un compte sans mot de passe n'a plus d'état de mot de passe");
});

test("un compte inconnu ne peut pas recevoir de mot de passe", async () => {
  const b = await banc();
  await poserMdp(b, "u-admin", MDP_ADMIN);
  const s = await connecter(b, "j.mercier", MDP_ADMIN);
  const res = await b.route("POST", "/v1/auth/comptes/personne/mot-de-passe", {
    body: { motDePasse: "Un-Mot-De-Passe-9" }, headers: { cookie: s.cookie, "x-csrf-token": s.csrf },
  });
  assert.equal(res.status, 404);
  assert.equal(res.body.code, "compte_inconnu");
});

// ------------------------------------------------------------ démonstration
test("les comptes de démonstration restent fermés quand le déploiement les ferme", async () => {
  const b = await banc({ demo: false });
  const res = await b.route("POST", "/v1/auth/demo", { body: { userId: "u-demo" } });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, "demonstration_desactivee");
});

test("les comptes de démonstration ouverts entrent sans mot de passe — et eux seuls", async () => {
  const b = await banc({ demo: true });
  const refus = await b.route("POST", "/v1/auth/demo", { body: { userId: "u-admin" } });
  assert.equal(refus.status, 401);
  assert.equal(refus.body.code, "compte_non_demonstration");
  const res = await b.route("POST", "/v1/auth/demo", { body: { userId: "u-demo" } });
  assert.equal(res.status, 200);
  assert.equal(res.body.utilisateur.id, "u-demo");
  const session = await b.route("GET", "/v1/auth/session", { headers: { cookie: enteteSession(res).cookie } });
  assert.equal(session.body.utilisateur.id, "u-demo");
});

test("fermer la démonstration referme les sessions de démonstration", async () => {
  // Deux services sur la MÊME base : l'un laisse la démonstration ouverte,
  // l'autre la ferme. C'est exactement ce qui se passe au redémarrage du service
  // avec `DEMO_ACCOUNTS=false` : la session ouverte la veille ne vaut plus rien.
  const store = memoire();
  const horloge = () => new Date("2026-03-10T12:00:00.000Z");
  const ouvert = createComptes({ store, crypto, now: horloge, scryptParams: SCRYPT_TEST, demoAutorise: true, sessionRequise: true });
  const ferme = createComptes({ store, crypto, now: horloge, scryptParams: SCRYPT_TEST, demoAutorise: false, sessionRequise: true });
  const appeler = (service, method, path, opts = {}) =>
    service.route({ method, path, headers: opts.headers || {}, body: opts.body || null }, { secure: true, ip: "10.0.0.1" });

  const res = await appeler(ouvert, "POST", "/v1/auth/demo", { body: { userId: "u-demo" } });
  assert.equal(res.status, 200);
  const cookie = enteteSession(res).cookie;
  assert.equal((await appeler(ouvert, "GET", "/v1/auth/session", { headers: { cookie } })).status, 200);
  assert.equal((await appeler(ferme, "GET", "/v1/auth/session", { headers: { cookie } })).status, 401);
});
