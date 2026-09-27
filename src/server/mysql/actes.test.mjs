// ============================================================================
// Tests du domaine « signature et publication ».
//
//   node --test          (ou: npm test)
//
// Le domaine est pur : on lui injecte une empreinte (crypto de Node), une
// horloge figée et une persistance en mémoire. Aucune base, aucun réseau.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createActesApi, emptyState } from "./actes.mjs";

const sha256 = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");
const AKN = "<akomaNtoso><body>Arrêté n°2026-401</body></akomaNtoso>";
const JETON = "Bearer bon";

function banc({ save = () => true, controleLegalite = null } = {}) {
  const state = emptyState();
  const api = createActesApi({ state, sha256, save, controleLegalite, now: () => "2026-03-10T12:00:00.000Z" });
  const authorize = (headers) => (String(headers.authorization || "").includes(JETON)
    ? null
    : { status: 401, headers: {}, body: { erreur: "absent", code: "jeton_absent" } });
  const call = async (method, path, body, headers = {}, ctx = {}) =>
    (await api.route({ method, path, headers, body }, { authorize, rate: () => false, ...ctx }));
  return { state, api, call };
}

test("santé et description OpenAPI", async () => {
  const { call } = banc();
  const sante = (await call("GET", "/v1/health"));
  assert.equal(sante.status, 200);
  assert.equal(sante.body.statut, "ok");
  const spec = (await call("GET", "/v1/"));
  assert.equal(spec.status, 200);
  assert.ok(spec.body.paths["/v1/actes"]);
  assert.equal(spec.body.servers[0].url, "/");
});

test("une écriture sans jeton est refusée", async () => {
  const { call } = banc();
  assert.equal((await call("POST", "/v1/actes", { akn: AKN })).status, 401);
});

test("dépôt d'un acte, puis idempotence tant que le circuit est ouvert", async () => {
  const { api, call } = banc();
  const premier = (await call("POST", "/v1/actes", { akn: AKN, numero: "2026-401", dateSignature: "2026-03-10" }, { authorization: JETON }));
  assert.equal(premier.status, 201);
  assert.equal(premier.body.id, "ACT-0001");
  assert.ok(api.takeDirty(), "l'état doit être marqué à écrire");
  assert.equal(api.takeDirty(), null, "l'état ne doit être écrit qu'une fois");

  const second = (await call("POST", "/v1/actes", { akn: AKN }, { authorization: JETON }));
  assert.equal(second.status, 200);
  assert.equal(second.body.idempotent, true);
  assert.equal(second.body.id, premier.body.id);
});

test("un document trop volumineux est refusé", async () => {
  const state = emptyState();
  const api = createActesApi({ state, sha256, save: () => true, maxDoc: 10 });
  const res = (await api.route({ method: "POST", path: "/v1/actes", headers: { authorization: JETON }, body: { akn: AKN } }, { authorize: () => null }));
  assert.equal(res.status, 413);
});

test("la publication précède obligatoirement la signature", async () => {
  const { call } = banc();
  const a = (await call("POST", "/v1/actes", { akn: AKN }, { authorization: JETON })).body;
  const res = (await call("POST", `/v1/actes/${a.id}/publication`, { html: "x", akn: AKN, original: {}, eliUri: "eli:/fr/arr/2026/0401/iam" }, { authorization: JETON }));
  assert.equal(res.status, 409);
  assert.equal(res.body.code, "acte_non_signe");
});

test("le webhook n'accepte pas un document différent de celui déposé", async () => {
  const { state, call } = banc();
  const a = (await call("POST", "/v1/actes", { akn: AKN }, { authorization: JETON })).body;
  const s = (await call("POST", `/v1/actes/${a.id}/signature`, {}, { authorization: JETON })).body;

  // La notification du prestataire n'est pas publique : sans clé, elle est
  // refusée (voir src/CHANGELOG.md, « Le webhook du prestataire de signature
  // est authentifié »).
  assert.equal((await call("POST", "/v1/webhooks/signature", { signatureId: s.signatureId })).status, 401);

  const faux = (await call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn: AKN + "FALSIFIÉ" }, signatures: [{ signeLe: "2026-03-10T12:10:00.000Z" }] },
  }, { authorization: JETON }));
  assert.equal(faux.status, 409);
  assert.equal(faux.body.code, "empreinte_divergente");
  assert.equal(state.signatures[s.signatureId].statut, "rejetee");

  const vrai = (await call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z", algorithme: "ECDSA P-256 / SHA-256", signataire: { nom: "Yann Dubois", fonction: "Maire" } }] },
  }, { authorization: JETON }));
  assert.equal(vrai.status, 200);
  assert.equal(vrai.body.statut, "signee");
  assert.equal(state.actes[a.id].statut, "signee");
});

test("publication : ELI, registre, idempotence et date d'opposabilité", async () => {
  const { call } = banc();
  const a = (await call("POST", "/v1/actes", { akn: AKN, numero: "2026-401", dateSignature: "2026-03-10" }, { authorization: JETON })).body;
  const s = (await call("POST", `/v1/actes/${a.id}/signature`, {}, { authorization: JETON })).body;
  (await call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] },
  }, { authorization: JETON }));

  const corps = { html: "<html>x</html>", akn: AKN, eliUri: "eli:/fr/arr/2026/0401/iam", datePublication: "2026-03-11", original: { document: { sha256: sha256(AKN) }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] } };
  const publie = (await call("POST", `/v1/actes/${a.id}/publication`, corps, { authorization: JETON, "idempotency-key": "idem-1" }));
  assert.equal(publie.status, 201);
  assert.equal(publie.body.eliUri, "eli:/fr/arr/2026/0401/iam");
  const cle = publie.body.cle;

  const rejeu = (await call("POST", `/v1/actes/${a.id}/publication`, corps, { authorization: JETON, "idempotency-key": "idem-1" }));
  assert.equal(rejeu.status, 200);
  assert.equal(rejeu.body.idempotent, true);

  const anterieure = (await call("POST", `/v1/actes/${a.id}/publication`, { ...corps, datePublication: "2026-01-01" }, { authorization: JETON }));
  assert.equal(anterieure.status, 422);
  assert.equal(anterieure.body.code, "date_publication_anterieure");

  assert.equal((await call("GET", "/v1/publications")).body.publications.length, 1);
  assert.ok(Array.isArray((await call("GET", `/v1/publications/${encodeURIComponent(cle)}`)).body.versions));
  assert.equal((await call("GET", "/v1/eli/arr/2026/0401/iam")).status, 200);
  assert.equal((await call("GET", "/v1/eli/arr/2026/9999/zzz")).status, 404);
  assert.equal((await call("GET", "/v1/actes", null, { authorization: JETON })).body.actes.length, 1);
});

test("contrôle de légalité : transmettre avant de publier, et le certificat est conservé", async () => {
  const { call } = banc();
  const a = (await call("POST", "/v1/actes", { akn: AKN, numero: "2026-402", dateSignature: "2026-03-10", controleLegalite: true }, { authorization: JETON })).body;
  // Le dépôt RETIENT l'exigence : sa réponse est brève (identifiant, empreinte),
  // c'est la fiche de l'acte déposé qui la rend.
  assert.equal((await call("GET", `/v1/actes/${a.id}`, null, { authorization: JETON })).body.controleLegalite, true, "le dépôt retient l'exigence de transmission");

  // Avant la signature, il n'y a rien à transmettre.
  const tropTot = (await call("POST", `/v1/actes/${a.id}/transmission`, {}, { authorization: JETON }));
  assert.equal(tropTot.status, 409);
  assert.equal(tropTot.body.code, "acte_non_signe");

  const s = (await call("POST", `/v1/actes/${a.id}/signature`, {}, { authorization: JETON })).body;
  (await call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] },
  }, { authorization: JETON }));

  // Signé mais non transmis : la publication est refusée par le service.
  const corps = { html: "<html>x</html>", akn: AKN, eliUri: "eli:/fr/arr/2026/0402/iam", datePublication: "2026-03-11", original: { document: { sha256: sha256(AKN) }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] } };
  const sans = (await call("POST", `/v1/actes/${a.id}/publication`, corps, { authorization: JETON }));
  assert.equal(sans.status, 409);
  assert.equal(sans.body.code, "transmission_absente");

  // La transmission délivre le certificat, scellé sur l'empreinte du document.
  const t = (await call("POST", `/v1/actes/${a.id}/transmission`, {}, { authorization: JETON }));
  assert.equal(t.status, 201);
  assert.ok(t.body.certificat.mention.startsWith("Transmis au contrôle de légalité le "), t.body.certificat.mention);
  assert.equal(t.body.certificat.empreinte, sha256(AKN));
  assert.equal((await call("POST", `/v1/actes/${a.id}/transmission`, {}, { authorization: JETON })).body.idempotent, true);
  const lu = (await call("GET", `/v1/actes/${a.id}/transmission`, null, { authorization: JETON }));
  assert.equal(lu.status, 200);
  assert.equal(lu.body.reference, t.body.reference);

  // Transmis : la publication passe, et le registre garde le certificat.
  const publie = (await call("POST", `/v1/actes/${a.id}/publication`, { ...corps, transmission: t.body.certificat }, { authorization: JETON }));
  assert.equal(publie.status, 201);
  const rec = (await call("GET", `/v1/publications/${encodeURIComponent(publie.body.cle)}`)).body;
  assert.equal(rec.transmission.mention, t.body.certificat.mention);
});

test("contrôle de légalité : une DÉCLARATION vaut transmission, sans appel à l'API", async () => {
  const { call } = banc();
  const a = (await call("POST", "/v1/actes", { akn: AKN, numero: "2026-403", dateSignature: "2026-03-10", controleLegalite: true }, { authorization: JETON })).body;
  const s = (await call("POST", `/v1/actes/${a.id}/signature`, {}, { authorization: JETON })).body;
  (await call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] },
  }, { authorization: JETON }));

  // Une déclaration incomplète ne vaut rien : il faut dire À QUI et À QUELLE DATE.
  const sansDate = await call("POST", `/v1/actes/${a.id}/transmission`, { declaration: { destinataire: "Préfecture" } }, { authorization: JETON });
  assert.equal(sansDate.status, 422);
  assert.equal(sansDate.body.code, "declaration_incomplete");
  const sansDest = await call("POST", `/v1/actes/${a.id}/transmission`, { declaration: { at: "2026-03-11" } }, { authorization: JETON });
  assert.equal(sansDest.status, 422);
  assert.equal(sansDest.body.champ, "destinataire");

  // La déclaration enregistre une transmission, SANS appel sortant : le certificat
  // est une DÉCLARATION, et sa mention nomme son auteur.
  const d = await call("POST", `/v1/actes/${a.id}/transmission`, {
    declaration: { at: "2026-03-11", destinataire: "Préfecture — contrôle de légalité", reference: "2026-03-DELEG-0184", motif: "API injoignable", personId: "per-004", auteur: "Jeanne MARTIN" },
  }, { authorization: JETON });
  assert.equal(d.status, 201);
  assert.equal(d.body.declaration, true);
  assert.equal(d.body.demonstration, false);
  assert.equal(d.body.certificat.nature, "Déclaration de transmission au contrôle de légalité");
  assert.match(d.body.certificat.mention, /\(déclaration de Jeanne MARTIN\)/);
  assert.equal(d.body.reference, "2026-03-DELEG-0184");
  // Le service DIT ce qu'il a pu attester : ici il n'identifie pas les personnes
  // (banc sans session), donc la déclaration est « déclarée », et le client le
  // reprend tel quel (voir NC-II-017) — il ne la présente pas comme vérifiée.
  assert.equal(d.body.attribution, "declaree");
  assert.equal(d.body.auteur, "Jeanne MARTIN");
  const lu = await call("GET", `/v1/actes/${a.id}/transmission`, null, { authorization: JETON });
  assert.equal(lu.body.declaration.attribution, "declaree");

  // La publication passe : la déclaration a levé la porte.
  const corps = { html: "<html>x</html>", akn: AKN, eliUri: "eli:/fr/arr/2026/0403/iam", datePublication: "2026-03-12", original: { document: { sha256: sha256(AKN) }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] } };
  assert.equal((await call("POST", `/v1/actes/${a.id}/publication`, corps, { authorization: JETON })).status, 201);
});

test("déclaration de transmission opposée à l'opérateur, et à sa compétence", async () => {
  const b = await bancSession();
  const a = (await b.call("POST", "/v1/actes", { akn: AKN, numero: "2026-702", revision: { statut: "valide", reviseurs: ["per-004"] } })).body;
  const circ = (await b.call("POST", `/v1/actes/${a.id}/signature`, {})).body;
  await b.call("POST", "/v1/webhooks/signature", {
    signatureId: circ.signatureId,
    documentSigne: { document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] },
  });

  // 1. On ne déclare pas à la place d'un autre.
  const autrui = await b.call("POST", `/v1/actes/${a.id}/transmission`, {
    declaration: { at: "2026-03-11", destinataire: "Préfecture", personId: "per-004" },
  }, { identite: b.session(AUTRE) });
  assert.equal(autrui.status, 403);
  assert.equal(autrui.body.code, "declaration_non_habilitée");

  // 2. Hors compétence : l'acte n'a été révisé que par per-004, et l'opérateur est
  //    per-009 — il déclare en son propre nom, mais cet acte n'est pas le sien.
  const hors = await b.call("POST", `/v1/actes/${a.id}/transmission`, {
    declaration: { at: "2026-03-11", destinataire: "Préfecture", personId: "per-009" },
  }, { identite: b.session(AUTRE) });
  assert.equal(hors.status, 403);
  assert.equal(hors.body.code, "declaration_non_habilitée");

  // 3. Le réviseur compétent déclare : accepté, « vérifiée », et le NOM inscrit
  //    vient du référentiel — non du corps.
  const ok = await b.call("POST", `/v1/actes/${a.id}/transmission`, {
    declaration: { at: "2026-03-11", destinataire: "Préfecture", auteur: "Faux Nom", personId: "per-004" },
  }, { identite: b.session(MAIRE) });
  assert.equal(ok.status, 201);
  assert.match(ok.body.certificat.mention, /Jeanne MARTIN/);
  assert.equal(ok.body.attribution, "verifiee", "le service dit qu'il a pu opposer la déclaration à l'opérateur");
  assert.equal(b.state.actes[a.id].transmission.declaration.attribution, "verifiee");
});

test("le routage : hors domaine, méthode et débit", async () => {
  const { call, api } = banc();
  assert.equal((await call("GET", "/v1/db/health")), null, "les routes de données ne relèvent pas de ce domaine");
  assert.equal((await call("DELETE", "/v1/actes")).status, 405);

  const limite = (await api.route({ method: "POST", path: "/v1/actes", headers: {}, body: { akn: AKN } }, { rate: () => true }));
  assert.equal(limite.status, 429);
});

test("la capacité de l'état est respectée", async () => {
  const { call } = banc({ save: () => false });
  const res = (await call("POST", "/v1/actes", { akn: AKN }, { authorization: JETON }));
  assert.equal(res.status, 507);
});

// Le repère d'une carte mise à la une SUR LA PAGE du recueil (le CSS porte aussi
// `.carte--une` : on compte donc la classe complète, pas le seul suffixe).
const CARTE_UNE = 'class="carte carte--une"';

// Dépose, signe (webhook) et publie un acte — le trajet complet, en trois appels.
async function publier(call, { numero, eliUri, dateDocument, datePublication, html = "<html>x</html>", ...extra }) {
  const akn = `<akomaNtoso><body>Acte ${numero} du ${dateDocument}</body></akomaNtoso>`;
  const a = (await call("POST", "/v1/actes", { akn, numero, dateSignature: dateDocument }, { authorization: JETON })).body;
  const s = (await call("POST", `/v1/actes/${a.id}/signature`, {}, { authorization: JETON })).body;
  (await call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] },
  }, { authorization: JETON }));
  return (await call("POST", `/v1/actes/${a.id}/publication`, {
    html, akn, eliUri, datePublication, ...extra,
    original: { document: { sha256: sha256(akn) }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] },
  }, { authorization: JETON }));
}

test("épingler un acte : le drapeau suit l'ACTE, et le recueil le montre", async () => {
  const { call } = banc();
  const p1 = (await publier(call, { numero: "2026-501", eliUri: "eli:/fr/del/2026/0501/iam", dateDocument: "2026-03-10", datePublication: "2026-03-11" }));
  assert.equal(p1.status, 201);
  const cle = p1.body.cle;
  assert.equal(p1.body.epingle, false, "un acte n'est pas à la une par défaut");

  // Écrire sans jeton est refusé ; une publication inconnue aussi.
  assert.equal((await call("POST", `/v1/publications/${encodeURIComponent(cle)}/epingle`, { epingle: true })).status, 401);
  assert.equal((await call("POST", "/v1/publications/inconnue%40x/epingle", { epingle: true }, { authorization: JETON })).status, 404);

  const pose = (await call("POST", `/v1/publications/${encodeURIComponent(cle)}/epingle`, { epingle: true, auteur: "Yann Dubois" }, { authorization: JETON }));
  assert.equal(pose.status, 200);
  assert.equal(pose.body.epingle, true);
  assert.equal(pose.body.versions, 1);

  // Le drapeau paraît dans la liste publique, dans les données ouvertes et sur la
  // page du recueil — c'est par là que le visiteur le voit.
  assert.equal((await call("GET", "/v1/publications")).body.publications.find((p) => p.cle === cle).epingle, true);
  assert.equal(JSON.parse((await call("GET", "/recueil.json")).body).actes.find((a) => a.cle === cle).epingle, true);
  const page = (await call("GET", "/recueil"));
  assert.ok(page.body.includes("À la une"), "la bande « À la une » doit être rendue");
  assert.equal((page.body.match(new RegExp(CARTE_UNE, "g")) || []).length, 1);

  // Une NOUVELLE VERSION du même acte hérite du drapeau : l'acte reste à la une.
  const p2 = (await publier(call, { numero: "2026-501", eliUri: "eli:/fr/del/2026/0501/iam", dateDocument: "2026-04-01", datePublication: "2026-04-02" }));
  assert.equal(p2.status, 201);
  assert.notEqual(p2.body.cle, cle);
  assert.equal(p2.body.epingle, true, "la version publiée plus tard hérite de la une");
  assert.equal((await call("GET", "/v1/publications")).body.publications.filter((p) => p.epingle === true).length, 2, "le drapeau vaut pour toutes les versions de l'acte");
  // La bande « À la une » n'en montre qu'UNE (la version en vigueur), et l'acte
  // n'est pas répété dans les « derniers actes publiés » juste en dessous.
  assert.equal(((await call("GET", "/recueil")).body.match(new RegExp(CARTE_UNE, "g")) || []).length, 1);

  // Le retrait vaut pour l'ACTE entier — d'un seul geste, sur n'importe quelle version.
  const retire = (await call("POST", `/v1/publications/${encodeURIComponent(p2.body.cle)}/epingle`, { epingle: false }, { authorization: JETON }));
  assert.equal(retire.status, 200);
  assert.equal(retire.body.epingle, false);
  assert.equal((await call("GET", "/v1/publications")).body.publications.some((p) => p.epingle === true), false);
  assert.equal((await call("GET", "/recueil")).body.includes(CARTE_UNE), false);
});

test("retirer une publication : motif exigé, l'acte redevient signé, la trace reste", async () => {
  const { state, call } = banc();
  // DEUX versions publiées sous le même ELI : le retrait ne vise que celle qu'il
  // désigne, l'autre reste au recueil.
  const eli = "eli:/fr/del/2026/0601/iam";
  const p1 = await publier(call, { numero: "2026-601", eliUri: eli, dateDocument: "2026-03-10", datePublication: "2026-03-11" });
  const p2 = await publier(call, { numero: "2026-601", eliUri: eli, dateDocument: "2026-04-01", datePublication: "2026-04-02" });
  assert.equal(p1.status, 201);
  assert.equal(p2.status, 201);
  assert.notEqual(p1.body.cle, p2.body.cle);

  // Sans jeton : refusé. Publication inconnue : 404. Motif trop court : 422.
  assert.equal((await call("POST", `/v1/publications/${encodeURIComponent(p1.body.cle)}/retrait`, { motif: "dépôt en double" })).status, 401);
  assert.equal((await call("POST", "/v1/publications/inconnue%40x/retrait", { motif: "dépôt en double" }, { authorization: JETON })).status, 404);
  const sans = (await call("POST", `/v1/publications/${encodeURIComponent(p1.body.cle)}/retrait`, { motif: "trop" }, { authorization: JETON }));
  assert.equal(sans.status, 422);
  assert.equal(sans.body.code, "motif_absent");

  const retire = (await call("POST", `/v1/publications/${encodeURIComponent(p1.body.cle)}/retrait`, { motif: "Dépôt en double du même arrêté.", auteur: "Yann Dubois" }, { authorization: JETON }));
  assert.equal(retire.status, 200);
  assert.equal(retire.body.statut, "signee", "l'acte redevient publiable");
  assert.equal(retire.body.retraits, 1);
  assert.equal(state.publies[p1.body.cle], undefined, "la version visée quitte le registre");
  assert.ok(state.publies[p2.body.cle], "l'autre version du même ELI reste publiée");
  // La trace est conservée sur l'acte, et inscrite au journal scellé du service.
  assert.equal(state.actes[retire.body.acteId].retraits[0].motif, "Dépôt en double du même arrêté.");
  const journal = (await call("GET", "/v1/journal", null, { authorization: JETON })).body;
  assert.equal(journal.scelle, true);
  assert.ok(journal.entrees.some((e) => e.geste === "publication_retiree"), "le retrait laisse une ligne au journal");
  // Le recueil ne montre plus la version retirée.
  assert.equal((await call("GET", "/v1/publications")).body.publications.some((p) => p.cle === p1.body.cle), false);
});

test("le recueil servi porte les renvois extérieurs et les mentions du pied de page", async () => {
  const { call } = banc();
  const p = await publier(call, {
    numero: "2026-701", eliUri: "eli:/fr/arr/2026/0701/iam", dateDocument: "2026-03-10", datePublication: "2026-03-11",
    recueil: "Recueil des actes de la commune", brandName: "Commune d'Exemple",
    recueilsExternes: [
      { id: "rex-1", type: "bis", label: "Recueil historique", url: "https://www.exemple.fr/ancien" },
      { id: "rex-2", type: "ressource", label: "Légifrance", url: "https://www.legifrance.gouv.fr/", note: "Les textes officiels." },
    ],
    mentions: [
      { id: "legales", mode: "texte", titre: "Mentions légales", texte: "Les actes publiés ici sont exécutoires dans les conditions de droit commun.\nRecours : deux mois." },
      { id: "accessibilite", mode: "lien", titre: "Accessibilité", url: "https://www.exemple.fr/accessibilite", lienLabel: "La déclaration d'accessibilité" },
    ],
  });
  assert.equal(p.status, 201);

  // La page du recueil (sans JavaScript) porte le bloc de renvois et le pied de page.
  const page = (await call("GET", "/recueil")).body;
  assert.ok(page.includes("Vous ne trouvez pas ce que vous recherchez ?"), "le bloc de renvois est rendu");
  assert.ok(page.includes("https://www.exemple.fr/ancien") && page.includes("Recueil historique"));
  assert.ok(page.includes("Sites de référence") && page.includes("https://www.legifrance.gouv.fr/"));
  assert.ok(page.includes("Mentions légales") && page.includes("Recours : deux mois."));
  assert.ok(page.includes("https://www.exemple.fr/accessibilite"), "une mention « lien » est rendue comme un lien");

  // Les données ouvertes portent les mêmes renvois et mentions.
  const json = JSON.parse((await call("GET", "/recueil.json")).body);
  assert.equal(json.renvois.length, 2);
  assert.equal(json.renvois.find((r) => r.type === "ressource").url, "https://www.legifrance.gouv.fr/");
  assert.equal(json.mentions.length, 2);
  assert.equal(json.recueil.titre, "Recueil des actes de la commune");
  assert.equal(json.recueil.collectivite, "Commune d'Exemple");

  // Et l'index pour les agents (llms.txt) les annonce aussi.
  const llms = (await call("GET", "/llms.txt")).body;
  assert.ok(llms.includes("## Autres recueils et sites de référence"));
  assert.ok(llms.includes("[Légifrance](https://www.legifrance.gouv.fr/)"));
  assert.ok(llms.includes("## Mentions du site"));
});

test("les liens par l'identifiant ELI mènent à l'acte, dans l'instance", async () => {
  const { call } = banc();
  // L'acte cité, publié au recueil : c'est lui que le lien doit atteindre.
  const cite = (await publier(call, { numero: "2026-401", eliUri: "eli:/fr/arr/2026/0401/iam", dateDocument: "2026-03-10", datePublication: "2026-03-11" }));
  assert.equal(cite.status, 201);
  // L'acte qui le cite par son identifiant ELI — le cas d'un visa d'adoption, ou
  // d'une annexe —, et qui cite aussi un identifiant que le recueil ne connaît
  // pas : celui-là doit rester une mention, sans lien.
  const html = `<html><body><div class="doc"><ul class="doc-visas">`
    + `<li><a class="doc-visas-link" href="eli:/fr/arr/2026/0401/iam" target="_blank" rel="noopener noreferrer" title="eli:/fr/arr/2026/0401/iam">l'arrêté n°2026-401, qui l'adopte ;</a></li>`
    + `<li><a class="doc-visas-link" href="eli:/fr/arr/2026/9999/zzz" target="_blank" rel="noopener noreferrer" title="eli:/fr/arr/2026/9999/zzz">un acte absent du recueil ;</a></li>`
    + `<li><a class="doc-visas-link" href="https://www.exemple.fr/delib.pdf" target="_blank" rel="noopener noreferrer">une source externe ;</a></li>`
    + `</ul></div></body></html>`;
  const porteur = (await publier(call, { numero: "2026-402", eliUri: "eli:/fr/arr/2026/0402/iam", dateDocument: "2026-03-10", datePublication: "2026-03-11", html }));

  // La page servie ne porte plus AUCUN identifiant en guise d'adresse : celui du
  // recueil est devenu l'adresse de l'acte cité, l'autre est resté du TEXTE, et
  // la source externe n'a pas été touchée.
  const page = (await call("GET", "/recueil/" + encodeURIComponent(porteur.body.cle), null, { host: "recueil.exemple.fr" }));
  assert.equal(page.status, 200);
  assert.equal(String(page.body).includes('href="eli:'), false);
  assert.ok(String(page.body).includes(`href="https://recueil.exemple.fr/recueil/${encodeURIComponent(cite.body.cle)}"`), "le lien ELI doit mener à l'acte cité");
  assert.ok(String(page.body).includes('data-eli="eli:/fr/arr/2026/0401/iam"'));
  assert.equal((String(page.body).match(/recueil-lien-eli--hors/g) || []).length, 1, "l'identifiant inconnu reste une mention, sans lien");
  assert.ok(String(page.body).includes('href="https://www.exemple.fr/delib.pdf"'), "une adresse externe n'est pas touchée");

  // L'identifiant ELI comme ADRESSE : il mène à l'acte, et à sa version en vigueur.
  const redirection = (await call("GET", "/eli/arr/2026/0401/iam", null, { host: "recueil.exemple.fr" }));
  assert.equal(redirection.status, 302);
  assert.equal(redirection.headers.location, `https://recueil.exemple.fr/recueil/${encodeURIComponent(cite.body.cle)}`);
  assert.equal((await call("GET", "/eli/arr/2026/9999/zzz", null, { host: "recueil.exemple.fr" })).status, 404);
});

test("les chats des pages d'erreur : éteints par défaut, allumés par la publication", async () => {
  const { call } = banc();
  const recueil = { host: "recueil.exemple.fr" };

  // Sans publication portant le réglage, les pages d'erreur du recueil restent
  // SOBRES : aucune image tierce n'est demandée au visiteur.
  const sobre = (await call("GET", "/recueil/acte-qui-nexiste-pas", null, recueil));
  assert.equal(sobre.status, 404);
  assert.equal(String(sobre.body).includes("http.cat"), false, "aucune image tierce par défaut");
  assert.equal(String(sobre.body).includes("chat-erreur"), false);

  // Une publication qui PORTE le réglage allumé.
  const p = await publier(call, { numero: "2026-801", eliUri: "eli:/fr/arr/2026/0801/iam", dateDocument: "2026-03-10", datePublication: "2026-03-11", chatsErreur: true });
  assert.equal(p.status, 201);

  const acteAbsent = (await call("GET", "/recueil/acte-qui-nexiste-pas", null, recueil));
  assert.equal(acteAbsent.status, 404);
  assert.ok(String(acteAbsent.body).includes('class="chat-erreur"'), "l'acte introuvable est illustré");
  assert.ok(String(acteAbsent.body).includes("https://http.cat/404"), "le 404 de http.cat est lié");
  assert.ok(String(acteAbsent.body).includes("Page introuvable"));

  // L'identifiant ELI inconnu et le bulletin absent portent le même ornement.
  const eliInconnu = (await call("GET", "/eli/arr/2026/9999/zzz", null, recueil));
  assert.equal(eliInconnu.status, 404);
  assert.ok(String(eliInconnu.body).includes("https://http.cat/404"));
  const bulletinAbsent = (await call("GET", "/recueil/bulletins", null, recueil));
  assert.equal(bulletinAbsent.status, 404);
  assert.ok(String(bulletinAbsent.body).includes("https://http.cat/404"));

  // Le réglage voyage avec la publication, et c'est la PLUS RÉCENTE qui le
  // porte qui décide : une publication qui l'éteint l'éteint pour le recueil.
  const off = await publier(call, { numero: "2026-802", eliUri: "eli:/fr/arr/2026/0802/iam", dateDocument: "2026-04-01", datePublication: "2026-04-02", chatsErreur: false });
  assert.equal(off.status, 201);
  const apres = (await call("GET", "/recueil/acte-qui-nexiste-pas", null, recueil));
  assert.equal(String(apres.body).includes("http.cat"), false, "la plus récente qui porte le réglage l'emporte");
});

test("une reprise d'acte ancien se publie SANS signature, avec son original joint", async () => {
  const { call } = banc();
  const akn = "<akomaNtoso><body>Délibération n°1998-042 du 12 juin 1998</body></akomaNtoso>";
  // Le dépôt DÉCLARE la reprise : c'est ce qui autorise le service à la publier
  // sans signature. La date d'origine (1998) reste antérieure au jour.
  const a = (await call("POST", "/v1/actes", { akn, numero: "1998-042", dateSignature: "1998-06-12", reprise: true }, { authorization: JETON })).body;
  const corps = {
    html: "<html>reprise</html>", akn, eliUri: "eli:/fr/delib/1998/042/iam",
    dateDocument: "1998-06-12", datePublication: "1998-06-12",
    kind: "reprise", informative: true, reprise: true, auteur: "Yann Dubois",
    provenance: "Registre des délibérations, 1998",
    originalExterne: { url: "https://exemple.fr/1998-042.pdf", sha256: "abc", nom: "1998-042.pdf", taille: 1234, type: "application/pdf" },
  };
  const publie = (await call("POST", `/v1/actes/${a.id}/publication`, corps, { authorization: JETON }));
  assert.equal(publie.status, 201);
  assert.equal(publie.body.reprise, true);
  assert.equal(publie.body.provenance, "Registre des délibérations, 1998");

  const rec = (await call("GET", `/v1/publications/${encodeURIComponent(publie.body.cle)}`)).body;
  assert.equal(rec.reprise, true);
  assert.equal(rec.kind, "reprise");
  assert.equal(rec.originalExterne.url, "https://exemple.fr/1998-042.pdf", "l'original joint est conservé comme la pièce qui fait foi");
  assert.equal(rec.original, null, "une reprise n'a pas de paquet signé");
  assert.equal(rec.signature, null, "une reprise n'a pas de signature à présenter");
  // La liste du recueil la nomme et la marque, sans avoir à relire la fiche.
  const notice = (await call("GET", "/v1/publications")).body.publications.find((p) => p.cle === publie.body.cle);
  assert.equal(notice.reprise, true);
  assert.equal(notice.provenance, "Registre des délibérations, 1998");
});

test("un acte qui n'a pas été déposé comme reprise ne se publie pas sans signature", async () => {
  const { call } = banc();
  const a = (await call("POST", "/v1/actes", { akn: AKN }, { authorization: JETON })).body;
  const res = (await call("POST", `/v1/actes/${a.id}/publication`, {
    html: "x", akn: AKN, eliUri: "eli:/fr/arr/2026/0401/iam", informative: true, reprise: true,
  }, { authorization: JETON }));
  assert.equal(res.status, 409);
  assert.equal(res.body.code, "acte_non_reprise");
});

// ------------------------------------------------------ le circuit de signature EXTERNE
// L'acte a été signé HORS de l'application (papier, ou outil tiers que le client
// ne pilote pas). Le client dépose la version signée et son empreinte, puis — si
// le dépôt a déclaré la certification requise — la conformité attestée par un
// réviseur. C'est le SERVICE qui tient l'ordre « version signée -> conformité
// certifiée -> publié » : ces épreuves le tiennent d'un bout à l'autre, et le
// jeu d'appels commun (`tests/conformite-service.mjs`) tient la présence des deux
// routes des DEUX côtés du contrat.
test("le circuit externe : la publication attend la version signée, puis la conformité", async () => {
  const { state, call } = banc();
  const akn = "<akomaNtoso><body>Arrêté n°2026-701</body></akomaNtoso>";
  const a = (await call("POST", "/v1/actes", {
    akn, numero: "2026-701", dateSignature: "2026-03-10",
    signatureMode: "externe", certificationRequise: true,
  }, { authorization: JETON })).body;
  assert.equal(state.actes[a.id].signatureMode, "externe");
  assert.equal(state.actes[a.id].certificationRequise, true);

  const publier = () => call("POST", `/v1/actes/${a.id}/publication`,
    { html: "<html>acte</html>", akn, eliUri: "eli:/fr/arr/2026/0701/iam", original: {} },
    { authorization: JETON });

  // 1. Rien n'est signé : le motif est celui DU CIRCUIT, pas l'« acte_non_signe » général.
  const avant = await publier();
  assert.equal(avant.status, 409, "étape 1 : publier avant toute signature");
  assert.equal(avant.body.code, "version_signee_absente", "étape 1 : code");

  // 2. Un acte qui ne suit PAS ce circuit refuse une version signée externe.
  // Un document DIFFÉRENT : le dépôt d'un document identique encore en circuit
  // est idempotent, et rendrait le même acte (donc le même circuit).
  const autre = (await call("POST", "/v1/actes", {
    akn: "<akomaNtoso><body>Arrêté n°2026-702</body></akomaNtoso>", numero: "2026-702",
  }, { authorization: JETON })).body;
  const horsCircuit = await call("POST", `/v1/actes/${autre.id}/signature-externe`,
    { signe: { url: "https://exemple.fr/0702-signe.pdf", sha256: "a".repeat(64), nom: "0702-signe.pdf" } },
    { authorization: JETON });
  assert.equal(horsCircuit.status, 409, "étape 2 : statut");
  assert.equal(horsCircuit.body.code, "circuit_non_externe", "étape 2 : code");

  // 3. La version signée est déposée : l'acte passe « signée », mais reste non publiable.
  const signe = await call("POST", `/v1/actes/${a.id}/signature-externe`, {
    signe: { url: "https://exemple.fr/0701-signe.pdf", sha256: "b".repeat(64), nom: "0701-signe.pdf", taille: 4321, deposeLe: "2026-03-10T13:00:00.000Z" },
  }, { authorization: JETON });
  assert.equal(signe.status, 201);
  assert.equal(signe.body.statut, "signee");
  assert.equal(state.actes[a.id].originalExterne.url, "https://exemple.fr/0701-signe.pdf");
  const encore = await publier();
  assert.equal(encore.status, 409, "étape 3 : publier avant la conformité");
  assert.equal(encore.body.code, "conformite_non_certifiee", "étape 3 : code");

  // 4. Une certification qui ne porte pas sur la pièce déposée n'atteste rien.
  const incoherente = await call("POST", `/v1/actes/${a.id}/conformite`, {
    certification: { statut: "conforme", sha256Signe: "c".repeat(64), parNom: "Réviseur" },
  }, { authorization: JETON });
  assert.equal(incoherente.status, 409, "étape 4 : statut");
  assert.equal(incoherente.body.code, "certification_incoherente", "étape 4 : code");

  // 5. Une conformité REFUSÉE remet l'acte en attente : c'est le SERVICE qui l'applique.
  const nonConforme = await call("POST", `/v1/actes/${a.id}/conformite`, {
    certification: { statut: "non_conforme", sha256Signe: "b".repeat(64), motif: "page manquante" },
  }, { authorization: JETON });
  assert.equal(nonConforme.status, 201);
  assert.equal(state.actes[a.id].statut, "depose");
  assert.equal((await publier()).body.code, "conformite_non_certifiee");

  // 6. Une NOUVELLE version signée annule la certification, puis la conformité
  //    certifiée ouvre enfin la publication.
  await call("POST", `/v1/actes/${a.id}/signature-externe`, {
    signe: { url: "https://exemple.fr/0701-signe-v2.pdf", sha256: "d".repeat(64), nom: "0701-signe-v2.pdf" },
  }, { authorization: JETON });
  assert.equal(state.actes[a.id].certification, null, "une nouvelle pièce annule l'ancienne certification");
  assert.equal((await publier()).body.code, "conformite_non_certifiee");
  const certifie = await call("POST", `/v1/actes/${a.id}/conformite`, {
    certification: { statut: "conforme", sha256Signe: "d".repeat(64), parNom: "Réviseur", le: "2026-03-10T14:00:00.000Z" },
  }, { authorization: JETON });
  assert.equal(certifie.status, 201);
  const publie = await publier();
  assert.equal(publie.status, 201);

  // La publication PORTE la version signée et sa certification : c'est elle
  // « l'original » que le recueil public montre pour cet acte.
  const rec = (await call("GET", `/v1/publications/${encodeURIComponent(publie.body.cle)}`)).body;
  assert.equal(rec.originalExterne.url, "https://exemple.fr/0701-signe-v2.pdf");
  assert.equal(rec.originalExterne.certification.statut, "conforme");

  // 7. Un acte déjà publié ne remplace pas sa version signée.
  const deja = await call("POST", `/v1/actes/${a.id}/signature-externe`,
    { signe: { url: "https://exemple.fr/autre.pdf", sha256: "e".repeat(64), nom: "autre.pdf" } },
    { authorization: JETON });
  assert.equal(deja.status, 409, "étape 7 : re-signer un acte publié");
  assert.equal(deja.body.code, "deja_publie");
});

test("un acte déclaré non publiable ne se publie pas, même signé", async () => {
  const { call } = banc();
  const akn = "<akomaNtoso><body>Décision individuelle n°2026-721</body></akomaNtoso>";
  const a = (await call("POST", "/v1/actes", {
    akn, numero: "2026-721", publishable: false, signatureMode: "externe",
  }, { authorization: JETON })).body;
  await call("POST", `/v1/actes/${a.id}/signature-externe`,
    { signe: { url: "https://exemple.fr/0721.pdf", sha256: "f".repeat(64), nom: "0721.pdf" } },
    { authorization: JETON });
  const res = await call("POST", `/v1/actes/${a.id}/publication`,
    { html: "x", akn, original: {}, eliUri: "eli:/fr/dec/2026/0721/iam" }, { authorization: JETON });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, "acte_non_publiable");
});

// --------------------------------- les portes du parapheur et de la révision
// Le dépôt PORTE l'état du parapheur et de la révision du client ; le service ne
// les exécute pas, mais refuse d'ouvrir une signature tant qu'ils ne sont pas
// achevés. C'est ce qui garantit que l'acte signé est celui qui a été approuvé.
test("le parapheur et la révision gardent l'ouverture de la signature", async () => {
  const akn = "<akomaNtoso><body>Arrêté n°2026-711</body></akomaNtoso>";
  const deposer = (call, champs) => call("POST", "/v1/actes", { akn, ...champs }, { authorization: JETON });

  const enAttente = banc();
  const a1 = (await deposer(enAttente.call, {
    numero: "2026-711",
    validation: { statut: "en_cours", circuitLabel: "Vérification puis visa", etapes: ["verification"] },
    revision: { statut: "valide" },
  })).body;
  const refusValidation = await enAttente.call("POST", `/v1/actes/${a1.id}/signature`, {}, { authorization: JETON });
  assert.equal(refusValidation.status, 409);
  assert.equal(refusValidation.body.code, "validation_incomplete");

  const revision = banc();
  const a2 = (await deposer(revision.call, {
    numero: "2026-712",
    validation: { statut: "valide", circuitLabel: "Vérification puis visa" },
    revision: { statut: "en_attente", parNom: "Réviseur" },
  })).body;
  const refusRevision = await revision.call("POST", `/v1/actes/${a2.id}/signature`, {}, { authorization: JETON });
  assert.equal(refusRevision.status, 409);
  assert.equal(refusRevision.body.code, "revision_incomplete");

  // Les deux portes franchies : la signature s'ouvre.
  const pret = banc();
  const a3 = (await deposer(pret.call, {
    numero: "2026-713",
    validation: { statut: "valide", circuitLabel: "Vérification puis visa" },
    revision: { statut: "valide", parNom: "Réviseur" },
  })).body;
  const ouvre = await pret.call("POST", `/v1/actes/${a3.id}/signature`, {}, { authorization: JETON });
  assert.equal(ouvre.status, 202);
  assert.equal(ouvre.body.statut, "en_attente");
  assert.equal(pret.state.actes[a3.id].statut, "en_signature");
});

// ------------------------------------------------------ la signature interne
// Le circuit où c'est le SERVICE qui signe : la clé privée du signataire est
// détenue par le service (scellée au repos) et ne quitte jamais le serveur. Deux
// choses s'éprouvent ICI, et rien d'autre : la route refuse QUAND ELLE NE PEUT
// PAS (sans coffre), et quand elle peut, elle signe, conserve la part interne,
// et rend un original que la vérification accepte.
test("la signature interne : le service signe, ou refuse en le disant", async () => {
  const { portWebcrypto, createSignatureInterne, verifierOriginal } = await import("./signature-interne.mjs");
  const cryptoPort = portWebcrypto(globalThis.crypto.subtle);
  const aknInterne = "<akomaNtoso><body>Arrêté n°2026-601</body></akomaNtoso>";

  // 1. SANS COFFRE : refus franc, avec son motif — jamais une simulation au nom
  //    du service (c'est le constat NC-IV-001, pris par l'autre bout).
  const sans = banc();
  const a1 = (await sans.call("POST", "/v1/actes", { akn: aknInterne }, { authorization: JETON })).body;
  const refus = await sans.call("POST", `/v1/actes/${a1.id}/signature`, { mode: "interne", signataires: [{ nom: "Jeanne MARTIN" }] }, { authorization: JETON });
  assert.equal(refus.status, 409);
  assert.equal(refus.body.code, "signature_interne_indisponible");
  assert.ok(String(refus.body.motif || "").length > 20, "le refus dit son motif");
  assert.equal(sans.state.actes[a1.id].statut, "depose", "un refus ne touche pas à l'acte");

  // 2. AVEC COFFRE : le service signe. Une clé de scellement de 32 octets suffit
  //    (ici en hexadécimal), et le coffre vit dans l'état du service.
  const etat = emptyState();
  const coffre = {};
  const signatureInterne = createSignatureInterne({
    crypto: cryptoPort, cle: "a".repeat(64), coffre, brand: "Ville de Valmont-sur-Loire",
  });
  const api = createActesApi({
    state: etat, sha256, save: () => true, now: () => "2026-03-10T12:00:00.000Z", signatureInterne,
  });
  const authorize = (headers) => (String(headers.authorization || "").includes(JETON)
    ? null
    : { status: 401, headers: {}, body: { erreur: "absent", code: "jeton_absent" } });
  const call = async (method, path, body, headers = {}) =>
    api.route({ method, path, headers, body }, { authorize, rate: () => false });

  const a2 = (await call("POST", "/v1/actes", { akn: aknInterne, numero: "2026-601" }, { authorization: JETON })).body;
  const c = await call("POST", `/v1/actes/${a2.id}/signature`, {
    mode: "interne",
    signataires: [{ nom: "Jeanne MARTIN", courriel: "j.martin@vsl.fr", personId: "per-004", fonction: "Maire" }],
    operateur: { id: "u-12", nom: "Jeanne MARTIN" },
  }, { authorization: JETON });

  assert.equal(c.status, 201);
  assert.equal(c.body.niveau, "interne");
  assert.equal(c.body.statut, "signee");
  assert.equal(c.body.documentSigne.prestataire.id, "scribae-interne");
  assert.equal(c.body.documentSigne.format, "application/vnd.actes.original-signe+json");

  // L'acte déposé : signé, avec sa date, son circuit et sa part INTERNE (celle
  // que la route protégée rend, et que le recueil ne voit jamais).
  assert.equal(etat.actes[a2.id].statut, "signee");
  assert.match(String(etat.actes[a2.id].signeLe || ""), /^\d{4}-\d{2}-\d{2}T/, "l'acte porte sa date de signature");
  assert.equal(etat.actes[a2.id].signatureId, c.body.signatureId);
  assert.equal(etat.actes[a2.id].originalInterne.signataire.courriel, "j.martin@vsl.fr");
  assert.equal(etat.signatures[c.body.signatureId].niveau, "interne");
  assert.equal(etat.signatures[c.body.signatureId].simulation, false, "le service a réellement signé");

  // L'original est VÉRIFIABLE : c'est ce qui rend le circuit utilisable sans rien
  // de plus (le recueil le contrôle par la même règle).
  const verif = await verifierOriginal(cryptoPort, c.body.documentSigne);
  assert.equal(verif.ok, true, verif.checks.map((x) => x.label + "=" + x.ok).join(" | "));

  // La part NOMINATIVE ne sort pas par la route du recueil.
  const pub = (await call("GET", `/v1/signatures/${c.body.signatureId}/document-signe`, null, { authorization: JETON })).body;
  assert.equal(pub.documentSigne.interne, undefined);
  assert.equal(pub.documentSigne.signatures[0].signataire.courriel, undefined);
  assert.equal(pub.documentSigne.signatures[0].signataire.nom, "Jeanne MARTIN", "le nom, lui, est public");

  // Le coffre : une fiche pour le signataire, une pour l'horodatage, et jamais
  // une clé privée en clair.
  assert.equal(Object.keys(coffre).length, 2);
  assert.equal(JSON.stringify(coffre).includes('"d"'), false);

  // Une SECONDE demande est refusée : l'acte est déjà signé.
  const deja = await call("POST", `/v1/actes/${a2.id}/signature`, { mode: "interne", signataires: [{ nom: "Jeanne MARTIN" }] }, { authorization: JETON });
  assert.equal(deja.status, 409);
  assert.equal(deja.body.code, "deja_signe");
});

// ============================================================================
// LA PORTE DE SIGNATURE — personne ne signe à la place d'un autre.
//
// C'est le constat NC-II-006 du registre. Quand le SERVICE identifie les
// personnes (déploiement à session : AUTH_MODE=password ou oidc), il oppose le
// signataire déclaré à l'opérateur, et il prend le NOM au référentiel — jamais au
// corps de la requête. Sans identité (mode « demo »), il ne simule pas la
// vérification : il la DÉCLARE absente (`attribution: « declaree »`).
// ============================================================================
const REFERENTIEL = {
  people: [
    { id: "per-004", civility: "Mme", firstName: "Jeanne", lastName: "MARTIN" },
    { id: "per-009", civility: "M.", firstName: "Paul", lastName: "DURAND" },
  ],
};

async function bancSession() {
  const { portWebcrypto, createSignatureInterne } = await import("./signature-interne.mjs");
  const state = emptyState();
  const coffre = {};
  const signatureInterne = createSignatureInterne({
    crypto: portWebcrypto(globalThis.crypto.subtle), cle: "b".repeat(64), coffre, brand: "Ville de Valmont-sur-Loire",
  });
  const api = createActesApi({
    state, sha256, save: () => true, now: () => "2026-03-10T12:00:00.000Z",
    signatureInterne, referentiel: async () => REFERENTIEL,
  });
  const call = async (method, path, body, { identite = null, sessionRequise = true } = {}) =>
    api.route({ method, path, headers: { authorization: JETON }, body }, { authorize: () => null, rate: () => false, identite, sessionRequise });
  const session = (compte) => ({ type: "session", ...compte });
  return { state, api, call, session, coffre };
}

const MAIRE = { id: "u-12", login: "j.martin", email: "j.martin@vsl.fr", personId: "per-004" };
const AUTRE = { id: "u-13", login: "p.durand", email: "p.durand@vsl.fr", personId: "per-009" };

test("signature opposée à l'opérateur : on ne signe pas à la place d'un autre", async () => {
  const b = await bancSession();
  const a = (await b.call("POST", "/v1/actes", { akn: AKN, numero: "2026-701" })).body;

  // 1. Un AUTRE compte pour un signataire déclaré : refus, et l'acte n'est pas
  //    touché. C'est le scénario d'usurpation, pris par la porte du service.
  const refus = await b.call("POST", `/v1/actes/${a.id}/signature`, {
    mode: "interne",
    signataires: [{ nom: "Jeanne MARTIN", courriel: "j.martin@vsl.fr", personId: "per-004" }],
  }, { identite: b.session(AUTRE) });
  assert.equal(refus.status, 403);
  assert.equal(refus.body.code, "signature_non_habilitée");
  assert.equal(b.state.actes[a.id].statut, "depose", "un refus ne touche pas à l'acte");

  // 2. Une CLÉ de service n'est pas une personne : elle ne signe pas au nom d'un
  //    signataire, quel que soit son rôle.
  const parCle = await b.call("POST", `/v1/actes/${a.id}/signature`, {
    mode: "interne", signataires: [{ nom: "Jeanne MARTIN", personId: "per-004" }],
  }, { identite: { type: "cle", role: "administrateur", label: "script" } });
  assert.equal(parCle.status, 403);
  assert.equal(parCle.body.code, "signature_sans_identite");

  // 3. Un compte sans personne rattachée ne peut pas signer : la signature serait
  //    anonyme.
  const sansPersonne = await b.call("POST", `/v1/actes/${a.id}/signature`, {
    mode: "interne", signataires: [{ nom: "Jeanne MARTIN", personId: "per-004" }],
  }, { identite: b.session({ id: "u-99", login: "sans.personne", personId: "" }) });
  assert.equal(sansPersonne.status, 403);
  assert.equal(sansPersonne.body.code, "operateur_non_identifie");

  // 4. LE TITULAIRE signe — et le NOM inscrit vient du RÉFÉRENTIEL, même si le
  //    corps déclarait « Le Maire ».
  const ok = await b.call("POST", `/v1/actes/${a.id}/signature`, {
    mode: "interne",
    signataires: [{ nom: "Le Maire", courriel: "j.martin@vsl.fr", personId: "per-004", fonction: "Maire" }],
  }, { identite: b.session(MAIRE) });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.documentSigne.signatures[0].signataire.nom, "Mme Jeanne MARTIN", "le nom vient du référentiel");
  assert.equal(ok.body.documentSigne.signatures[0].signataire.personId, "per-004");
  assert.equal(b.state.signatures[ok.body.signatureId].attribution, "verifiee");
  assert.equal(b.state.signatures[ok.body.signatureId].verifie, true);
  // L'opérateur consigné est celui du SERVICE, non celui que le corps déclare.
  assert.equal(b.state.actes[a.id].originalInterne.operateur.personId, "per-004");
});

test("sans session, le service ne prétend pas avoir vérifié (mode demo)", async () => {
  const b = await bancSession();
  const a = (await b.call("POST", "/v1/actes", { akn: AKN })).body;
  const c = await b.call("POST", `/v1/actes/${a.id}/signature`, {
    mode: "interne", signataires: [{ nom: "Jeanne MARTIN", personId: "per-004" }],
  }, { sessionRequise: false });
  assert.equal(c.status, 201);
  assert.equal(b.state.signatures[c.body.signatureId].attribution, "declaree");
  assert.equal(b.state.signatures[c.body.signatureId].verifie, false);
});

test("le webhook refuse la signature apportée par un autre (circuit simple)", async () => {
  const b = await bancSession();
  const a = (await b.call("POST", "/v1/actes", { akn: AKN })).body;
  const circ = (await b.call("POST", `/v1/actes/${a.id}/signature`, {
    signataires: [{ nom: "Jeanne MARTIN", personId: "per-004" }], niveau: "simple",
  })).body;
  const pack = (personId) => ({
    document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:10:00.000Z" }],
    interne: { signataire: { nom: "Jeanne MARTIN", personId } },
  });

  // Le compte d'un autre apporte le paquet signé au nom du maire : refus.
  const faux = await b.call("POST", "/v1/webhooks/signature",
    { signatureId: circ.signatureId, documentSigne: pack("per-004") }, { identite: b.session(AUTRE) });
  assert.equal(faux.status, 403);
  assert.equal(faux.body.code, "signature_non_habilitée");
  assert.equal(b.state.actes[a.id].statut, "en_signature", "un refus ne fait pas passer l'acte à signée");

  // Le titulaire, lui, apporte la sienne : acceptée et marquée vérifiée.
  const bon = await b.call("POST", "/v1/webhooks/signature",
    { signatureId: circ.signatureId, documentSigne: pack("per-004") }, { identite: b.session(MAIRE) });
  assert.equal(bon.status, 200);
  assert.equal(b.state.actes[a.id].statut, "signee");
  assert.equal(b.state.signatures[circ.signatureId].attribution, "verifiee");
});

test("la certification de conformité est opposée à l'opérateur", async () => {
  const b = await bancSession();
  const a = (await b.call("POST", "/v1/actes", { akn: AKN, signatureMode: "externe" })).body;
  const signe = (await b.call("POST", `/v1/actes/${a.id}/signature-externe`, {
    signe: { url: "https://vsl.fr/signe.pdf", sha256: sha256("pdf"), nom: "signe.pdf" },
    certificationRequise: true,
  })).body;
  assert.equal(signe.statut, "signee");

  // Un autre compte certifie au nom du réviseur : refus.
  const faux = await b.call("POST", `/v1/actes/${a.id}/conformite`, {
    certification: { statut: "conforme", parNom: "Mme Jeanne MARTIN", personId: "per-004", sha256Signe: sha256("pdf") },
  }, { identite: b.session(AUTRE) });
  assert.equal(faux.status, 403);
  assert.equal(faux.body.code, "conformite_non_habilitée");
  assert.equal(b.state.actes[a.id].certification, null, "un refus n'inscrit rien");

  // Le réviseur lui-même : accepté, avec son nom pris au référentiel.
  const ok = await b.call("POST", `/v1/actes/${a.id}/conformite`, {
    certification: { statut: "conforme", parNom: "Jeanne", personId: "per-004", sha256Signe: sha256("pdf") },
  }, { identite: b.session(MAIRE) });
  assert.equal(ok.status, 201);
  assert.equal(b.state.actes[a.id].certification.parNom, "Mme Jeanne MARTIN");
  assert.equal(b.state.actes[a.id].certification.parCompte.personId, "per-004");
});

// ============================================================================
// LA TÉLÉTRANSMISSION RÉELLE, ET LA REPOSE AU REGISTRE.
// ============================================================================

// Un faux client de contrôle de légalité : on lui dit ce que l'API rend, et il
// note ce qu'on lui a transmis. C'est le SEUL point de contact avec @ctes, et
// c'est ce qui rend la télétransmission éprouvable sans réseau.
function fauxControle({ reference = "AR-2026-9001", recuLe = "2026-03-10T13:00:00.000Z", echec = null } = {}) {
  const transmis = [];
  return {
    transmis,
    actif: () => true,
    etat: () => ({ actif: true, transport: echec ? "demonstration" : "service", url: "https://ctes.exemple.fr/v1", motif: echec || "" }),
    reglages: () => ({ url: "https://ctes.exemple.fr/v1" }),
    transmettre: async (t) => {
      transmis.push(t);
      if (echec) throw new Error(echec);
      return { reference, recuLe, destinataire: t.destinataire, statut: 201 };
    },
  };
}

// Dépose un acte et le fait signer par le webhook — le trajet minimal.
async function deposerEtSigner(call, corps) {
  const a = (await call("POST", "/v1/actes", { akn: AKN, ...corps }, { authorization: JETON })).body;
  const s = (await call("POST", "/v1/actes/" + a.id + "/signature", {}, { authorization: JETON })).body;
  await call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] },
  }, { authorization: JETON });
  return a;
}

test("contrôle de légalité : l'API branchée transmet réellement, et le certificat le dit", async () => {
  const faux = fauxControle();
  const { call, state } = banc({ controleLegalite: faux });
  const a = await deposerEtSigner(call, { numero: "2026-501", controleLegalite: true });

  const t = (await call("POST", "/v1/actes/" + a.id + "/transmission", { auteur: "Yann DUBOIS", entite: "Ville de Valmont-sur-Loire" }, { authorization: JETON }));
  assert.equal(t.status, 201);
  // L'appel a bien eu lieu, avec l'acte et son empreinte.
  assert.equal(faux.transmis.length, 1);
  assert.equal(faux.transmis[0].akn, AKN);
  assert.equal(faux.transmis[0].empreinte, sha256(AKN));
  // Le certificat est celui de l'API, et il ne se présente PAS comme une simulation.
  assert.equal(t.body.reference, "AR-2026-9001");
  assert.equal(t.body.recuLe, "2026-03-10T13:00:00.000Z");
  assert.equal(t.body.demonstration, false);
  assert.equal(t.body.certificat.demonstration, false);
  assert.equal(t.body.certificat.nature, "Accusé de réception de télétransmission");
  assert.equal(t.body.certificat.mention.includes("démonstration"), false, "une transmission réelle ne porte pas la réserve");
  assert.equal(state.actes[a.id].transmission.api.simule, false);
});

test("contrôle de légalité : un refus de l'API laisse l'acte NON transmis, et le service ne fabrique rien", async () => {
  const faux = fauxControle({ echec: "Le contrôle de légalité a refusé la transmission (422) — acte hors délai." });
  const { call, state } = banc({ controleLegalite: faux });
  const a = await deposerEtSigner(call, { numero: "2026-502", controleLegalite: true });

  const echec = await call("POST", "/v1/actes/" + a.id + "/transmission", {}, { authorization: JETON });
  assert.equal(echec.status, 502);
  assert.equal(echec.body.code, "transmission_echec");
  assert.equal(state.actes[a.id].transmission, undefined, "aucun certificat n'est enregistré sur un échec");
  assert.equal(state.actes[a.id].statut, "signee", "l'acte reste signé : la transmission pourra être rejouée");
  const suite = await call("POST", "/v1/actes/" + a.id + "/transmission", {}, { authorization: JETON });
  assert.equal(suite.status, 502, "l'API refuse toujours : le service ne fabrique pas de certificat");
});

test("le rétablissement au registre : le titulaire, ou l'administration — et c'est marqué", async () => {
  const b = await bancSession();
  const ADMIN = { id: "u-01", login: "admin", email: "admin@vsl.fr", personId: "per-001", role: "administrateur", roles: ["administrateur"] };
  const a = (await b.call("POST", "/v1/actes", { akn: AKN, numero: "2026-801" })).body;
  const circ = (await b.call("POST", "/v1/actes/" + a.id + "/signature", {
    signataires: [{ nom: "Jeanne MARTIN", personId: "per-004" }], niveau: "simple",
  })).body;
  const pack = {
    document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:10:00.000Z" }],
    interne: { signataire: { nom: "Jeanne MARTIN", personId: "per-004" } },
  };

  // Un RÉDACTEUR (ni titulaire, ni administrateur) ne repose pas la signature
  // d'un autre : le drapeau « reprise » ne lui donne aucun droit.
  const redacteur = await b.call("POST", "/v1/webhooks/signature",
    { signatureId: circ.signatureId, documentSigne: pack, reprise: true },
    { identite: b.session({ ...AUTRE, role: "redacteur", roles: ["redacteur"] }) });
  assert.equal(redacteur.status, 403);
  assert.equal(redacteur.body.code, "signature_non_habilitée");

  // L'ADMINISTRATEUR, lui, repose l'original — et le geste est NOMMÉ : la
  // signature n'est pas présentée comme vérifiée, elle est une reprise.
  const admin = await b.call("POST", "/v1/webhooks/signature",
    { signatureId: circ.signatureId, documentSigne: pack, reprise: true },
    { identite: b.session(ADMIN) });
  assert.equal(admin.status, 200);
  assert.equal(b.state.actes[a.id].statut, "signee");
  assert.equal(b.state.signatures[circ.signatureId].attribution, "reprise");
  assert.equal(b.state.signatures[circ.signatureId].operateur.personId, "per-001", "l'opérateur qui a posé est consigné");
  assert.equal(b.state.signatures[circ.signatureId].verifie, false);
});

test("la compilation d'une version consolidée : posée par l'administration, et nommée", async () => {
  const b = await bancSession();
  const ADMIN = { id: "u-01", login: "admin", email: "admin@vsl.fr", personId: "per-001", role: "administrateur", roles: ["administrateur"] };
  const a = (await b.call("POST", "/v1/actes", { akn: AKN, numero: "2026-802" })).body;
  const circ = (await b.call("POST", "/v1/actes/" + a.id + "/signature", {
    signataires: [{ nom: "Jeanne MARTIN", personId: "per-004" }], niveau: "avancee",
  })).body;
  const pack = {
    document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:10:00.000Z" }],
    interne: { signataire: { nom: "Jeanne MARTIN", personId: "per-004" } },
  };
  const pose = await b.call("POST", "/v1/webhooks/signature",
    { signatureId: circ.signatureId, documentSigne: pack, compilation: true },
    { identite: b.session(ADMIN) });
  assert.equal(pose.status, 200);
  assert.equal(b.state.signatures[circ.signatureId].attribution, "compilation");
  assert.equal(b.state.signatures[circ.signatureId].operateur.personId, "per-001");

  // Sans le drapeau, l'administrateur qui n'est pas le signataire est refusé :
  // l'exception ne s'ouvre que sur un geste NOMMÉ.
  const a2 = (await b.call("POST", "/v1/actes", { akn: AKN, numero: "2026-803" })).body;
  const circ2 = (await b.call("POST", "/v1/actes/" + a2.id + "/signature", {
    signataires: [{ nom: "Jeanne MARTIN", personId: "per-004" }], niveau: "avancee",
  })).body;
  const sansDrapeau = await b.call("POST", "/v1/webhooks/signature",
    { signatureId: circ2.signatureId, documentSigne: pack },
    { identite: b.session(ADMIN) });
  assert.equal(sansDrapeau.status, 403);
  assert.equal(sansDrapeau.body.code, "signature_non_habilitée");
});

test("le titulaire apporte sa propre signature : attribuée vérifiée, avec son opérateur", async () => {
  const b = await bancSession();
  const a = (await b.call("POST", "/v1/actes", { akn: AKN, numero: "2026-804" })).body;
  const circ = (await b.call("POST", "/v1/actes/" + a.id + "/signature", {
    signataires: [{ nom: "Jeanne MARTIN", personId: "per-004" }], niveau: "simple",
  })).body;
  const bon = await b.call("POST", "/v1/webhooks/signature", {
    signatureId: circ.signatureId,
    documentSigne: { document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:10:00.000Z" }], interne: { signataire: { nom: "Le Maire", personId: "per-004" } } },
  }, { identite: b.session(MAIRE) });
  assert.equal(bon.status, 200);
  assert.equal(b.state.signatures[circ.signatureId].attribution, "verifiee");
  assert.equal(b.state.signatures[circ.signatureId].operateur.personId, "per-004");
});
