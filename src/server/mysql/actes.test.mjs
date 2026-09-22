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

function banc({ save = () => true } = {}) {
  const state = emptyState();
  const api = createActesApi({ state, sha256, save, now: () => "2026-03-10T12:00:00.000Z" });
  const authorize = (headers) => (String(headers.authorization || "").includes(JETON)
    ? null
    : { status: 401, headers: {}, body: { erreur: "absent", code: "jeton_absent" } });
  const call = (method, path, body, headers = {}, ctx = {}) =>
    api.route({ method, path, headers, body }, { authorize, rate: () => false, ...ctx });
  return { state, api, call };
}

test("santé et description OpenAPI", () => {
  const { call } = banc();
  const sante = call("GET", "/v1/health");
  assert.equal(sante.status, 200);
  assert.equal(sante.body.statut, "ok");
  const spec = call("GET", "/v1/");
  assert.equal(spec.status, 200);
  assert.ok(spec.body.paths["/v1/actes"]);
  assert.equal(spec.body.servers[0].url, "/");
});

test("une écriture sans jeton est refusée", () => {
  const { call } = banc();
  assert.equal(call("POST", "/v1/actes", { akn: AKN }).status, 401);
});

test("dépôt d'un acte, puis idempotence tant que le circuit est ouvert", () => {
  const { api, call } = banc();
  const premier = call("POST", "/v1/actes", { akn: AKN, numero: "2026-401", dateSignature: "2026-03-10" }, { authorization: JETON });
  assert.equal(premier.status, 201);
  assert.equal(premier.body.id, "ACT-0001");
  assert.ok(api.takeDirty(), "l'état doit être marqué à écrire");
  assert.equal(api.takeDirty(), null, "l'état ne doit être écrit qu'une fois");

  const second = call("POST", "/v1/actes", { akn: AKN }, { authorization: JETON });
  assert.equal(second.status, 200);
  assert.equal(second.body.idempotent, true);
  assert.equal(second.body.id, premier.body.id);
});

test("un document trop volumineux est refusé", () => {
  const state = emptyState();
  const api = createActesApi({ state, sha256, save: () => true, maxDoc: 10 });
  const res = api.route({ method: "POST", path: "/v1/actes", headers: { authorization: JETON }, body: { akn: AKN } }, { authorize: () => null });
  assert.equal(res.status, 413);
});

test("la publication précède obligatoirement la signature", () => {
  const { call } = banc();
  const a = call("POST", "/v1/actes", { akn: AKN }, { authorization: JETON }).body;
  const res = call("POST", `/v1/actes/${a.id}/publication`, { html: "x", akn: AKN, original: {}, eliUri: "eli:/fr/arr/2026/0401/iam" }, { authorization: JETON });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, "acte_non_signe");
});

test("le webhook n'accepte pas un document différent de celui déposé", () => {
  const { state, call } = banc();
  const a = call("POST", "/v1/actes", { akn: AKN }, { authorization: JETON }).body;
  const s = call("POST", `/v1/actes/${a.id}/signature`, {}, { authorization: JETON }).body;

  // La notification du prestataire n'est pas publique : sans clé, elle est
  // refusée (voir src/CHANGELOG.md, « Le webhook du prestataire de signature
  // est authentifié »).
  assert.equal(call("POST", "/v1/webhooks/signature", { signatureId: s.signatureId }).status, 401);

  const faux = call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn: AKN + "FALSIFIÉ" }, signatures: [{ signeLe: "2026-03-10T12:10:00.000Z" }] },
  }, { authorization: JETON });
  assert.equal(faux.status, 409);
  assert.equal(faux.body.code, "empreinte_divergente");
  assert.equal(state.signatures[s.signatureId].statut, "rejetee");

  const vrai = call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z", algorithme: "ECDSA P-256 / SHA-256", signataire: { nom: "Yann Dubois", fonction: "Maire" } }] },
  }, { authorization: JETON });
  assert.equal(vrai.status, 200);
  assert.equal(vrai.body.statut, "signee");
  assert.equal(state.actes[a.id].statut, "signee");
});

test("publication : ELI, registre, idempotence et date d'opposabilité", () => {
  const { call } = banc();
  const a = call("POST", "/v1/actes", { akn: AKN, numero: "2026-401", dateSignature: "2026-03-10" }, { authorization: JETON }).body;
  const s = call("POST", `/v1/actes/${a.id}/signature`, {}, { authorization: JETON }).body;
  call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] },
  }, { authorization: JETON });

  const corps = { html: "<html>x</html>", akn: AKN, eliUri: "eli:/fr/arr/2026/0401/iam", datePublication: "2026-03-11", original: { document: { sha256: sha256(AKN) }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] } };
  const publie = call("POST", `/v1/actes/${a.id}/publication`, corps, { authorization: JETON, "idempotency-key": "idem-1" });
  assert.equal(publie.status, 201);
  assert.equal(publie.body.eliUri, "eli:/fr/arr/2026/0401/iam");
  const cle = publie.body.cle;

  const rejeu = call("POST", `/v1/actes/${a.id}/publication`, corps, { authorization: JETON, "idempotency-key": "idem-1" });
  assert.equal(rejeu.status, 200);
  assert.equal(rejeu.body.idempotent, true);

  const anterieure = call("POST", `/v1/actes/${a.id}/publication`, { ...corps, datePublication: "2026-01-01" }, { authorization: JETON });
  assert.equal(anterieure.status, 422);
  assert.equal(anterieure.body.code, "date_publication_anterieure");

  assert.equal(call("GET", "/v1/publications").body.publications.length, 1);
  assert.ok(Array.isArray(call("GET", `/v1/publications/${encodeURIComponent(cle)}`).body.versions));
  assert.equal(call("GET", "/v1/eli/arr/2026/0401/iam").status, 200);
  assert.equal(call("GET", "/v1/eli/arr/2026/9999/zzz").status, 404);
  assert.equal(call("GET", "/v1/actes", null, { authorization: JETON }).body.actes.length, 1);
});

test("contrôle de légalité : transmettre avant de publier, et le certificat est conservé", () => {
  const { call } = banc();
  const a = call("POST", "/v1/actes", { akn: AKN, numero: "2026-402", dateSignature: "2026-03-10", controleLegalite: true }, { authorization: JETON }).body;
  // Le dépôt RETIENT l'exigence : sa réponse est brève (identifiant, empreinte),
  // c'est la fiche de l'acte déposé qui la rend.
  assert.equal(call("GET", `/v1/actes/${a.id}`, null, { authorization: JETON }).body.controleLegalite, true, "le dépôt retient l'exigence de transmission");

  // Avant la signature, il n'y a rien à transmettre.
  const tropTot = call("POST", `/v1/actes/${a.id}/transmission`, {}, { authorization: JETON });
  assert.equal(tropTot.status, 409);
  assert.equal(tropTot.body.code, "acte_non_signe");

  const s = call("POST", `/v1/actes/${a.id}/signature`, {}, { authorization: JETON }).body;
  call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] },
  }, { authorization: JETON });

  // Signé mais non transmis : la publication est refusée par le service.
  const corps = { html: "<html>x</html>", akn: AKN, eliUri: "eli:/fr/arr/2026/0402/iam", datePublication: "2026-03-11", original: { document: { sha256: sha256(AKN) }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] } };
  const sans = call("POST", `/v1/actes/${a.id}/publication`, corps, { authorization: JETON });
  assert.equal(sans.status, 409);
  assert.equal(sans.body.code, "transmission_absente");

  // La transmission délivre le certificat, scellé sur l'empreinte du document.
  const t = call("POST", `/v1/actes/${a.id}/transmission`, {}, { authorization: JETON });
  assert.equal(t.status, 201);
  assert.ok(t.body.certificat.mention.startsWith("Transmis au contrôle de légalité le "), t.body.certificat.mention);
  assert.equal(t.body.certificat.empreinte, sha256(AKN));
  assert.equal(call("POST", `/v1/actes/${a.id}/transmission`, {}, { authorization: JETON }).body.idempotent, true);
  const lu = call("GET", `/v1/actes/${a.id}/transmission`, null, { authorization: JETON });
  assert.equal(lu.status, 200);
  assert.equal(lu.body.reference, t.body.reference);

  // Transmis : la publication passe, et le registre garde le certificat.
  const publie = call("POST", `/v1/actes/${a.id}/publication`, { ...corps, transmission: t.body.certificat }, { authorization: JETON });
  assert.equal(publie.status, 201);
  const rec = call("GET", `/v1/publications/${encodeURIComponent(publie.body.cle)}`).body;
  assert.equal(rec.transmission.mention, t.body.certificat.mention);
});

test("le routage : hors domaine, méthode et débit", () => {
  const { call, api } = banc();
  assert.equal(call("GET", "/v1/db/health"), null, "les routes de données ne relèvent pas de ce domaine");
  assert.equal(call("DELETE", "/v1/actes").status, 405);

  const limite = api.route({ method: "POST", path: "/v1/actes", headers: {}, body: { akn: AKN } }, { rate: () => true });
  assert.equal(limite.status, 429);
});

test("la capacité de l'état est respectée", () => {
  const { call } = banc({ save: () => false });
  const res = call("POST", "/v1/actes", { akn: AKN }, { authorization: JETON });
  assert.equal(res.status, 507);
});

// Le repère d'une carte mise à la une SUR LA PAGE du recueil (le CSS porte aussi
// `.carte--une` : on compte donc la classe complète, pas le seul suffixe).
const CARTE_UNE = 'class="carte carte--une"';

// Dépose, signe (webhook) et publie un acte — le trajet complet, en trois appels.
function publier(call, { numero, eliUri, dateDocument, datePublication, html = "<html>x</html>" }) {
  const akn = `<akomaNtoso><body>Acte ${numero} du ${dateDocument}</body></akomaNtoso>`;
  const a = call("POST", "/v1/actes", { akn, numero, dateSignature: dateDocument }, { authorization: JETON }).body;
  const s = call("POST", `/v1/actes/${a.id}/signature`, {}, { authorization: JETON }).body;
  call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] },
  }, { authorization: JETON });
  return call("POST", `/v1/actes/${a.id}/publication`, {
    html, akn, eliUri, datePublication,
    original: { document: { sha256: sha256(akn) }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] },
  }, { authorization: JETON });
}

test("épingler un acte : le drapeau suit l'ACTE, et le recueil le montre", () => {
  const { call } = banc();
  const p1 = publier(call, { numero: "2026-501", eliUri: "eli:/fr/del/2026/0501/iam", dateDocument: "2026-03-10", datePublication: "2026-03-11" });
  assert.equal(p1.status, 201);
  const cle = p1.body.cle;
  assert.equal(p1.body.epingle, false, "un acte n'est pas à la une par défaut");

  // Écrire sans jeton est refusé ; une publication inconnue aussi.
  assert.equal(call("POST", `/v1/publications/${encodeURIComponent(cle)}/epingle`, { epingle: true }).status, 401);
  assert.equal(call("POST", "/v1/publications/inconnue%40x/epingle", { epingle: true }, { authorization: JETON }).status, 404);

  const pose = call("POST", `/v1/publications/${encodeURIComponent(cle)}/epingle`, { epingle: true, auteur: "Yann Dubois" }, { authorization: JETON });
  assert.equal(pose.status, 200);
  assert.equal(pose.body.epingle, true);
  assert.equal(pose.body.versions, 1);

  // Le drapeau paraît dans la liste publique, dans les données ouvertes et sur la
  // page du recueil — c'est par là que le visiteur le voit.
  assert.equal(call("GET", "/v1/publications").body.publications.find((p) => p.cle === cle).epingle, true);
  assert.equal(JSON.parse(call("GET", "/recueil.json").body).actes.find((a) => a.cle === cle).epingle, true);
  const page = call("GET", "/recueil");
  assert.ok(page.body.includes("À la une"), "la bande « À la une » doit être rendue");
  assert.equal((page.body.match(new RegExp(CARTE_UNE, "g")) || []).length, 1);

  // Une NOUVELLE VERSION du même acte hérite du drapeau : l'acte reste à la une.
  const p2 = publier(call, { numero: "2026-501", eliUri: "eli:/fr/del/2026/0501/iam", dateDocument: "2026-04-01", datePublication: "2026-04-02" });
  assert.equal(p2.status, 201);
  assert.notEqual(p2.body.cle, cle);
  assert.equal(p2.body.epingle, true, "la version publiée plus tard hérite de la une");
  assert.equal(call("GET", "/v1/publications").body.publications.filter((p) => p.epingle === true).length, 2, "le drapeau vaut pour toutes les versions de l'acte");
  // La bande « À la une » n'en montre qu'UNE (la version en vigueur), et l'acte
  // n'est pas répété dans les « derniers actes publiés » juste en dessous.
  assert.equal((call("GET", "/recueil").body.match(new RegExp(CARTE_UNE, "g")) || []).length, 1);

  // Le retrait vaut pour l'ACTE entier — d'un seul geste, sur n'importe quelle version.
  const retire = call("POST", `/v1/publications/${encodeURIComponent(p2.body.cle)}/epingle`, { epingle: false }, { authorization: JETON });
  assert.equal(retire.status, 200);
  assert.equal(retire.body.epingle, false);
  assert.equal(call("GET", "/v1/publications").body.publications.some((p) => p.epingle === true), false);
  assert.equal(call("GET", "/recueil").body.includes(CARTE_UNE), false);
});

test("les liens par l'identifiant ELI mènent à l'acte, dans l'instance", () => {
  const { call } = banc();
  // L'acte cité, publié au recueil : c'est lui que le lien doit atteindre.
  const cite = publier(call, { numero: "2026-401", eliUri: "eli:/fr/arr/2026/0401/iam", dateDocument: "2026-03-10", datePublication: "2026-03-11" });
  assert.equal(cite.status, 201);
  // L'acte qui le cite par son identifiant ELI — le cas d'un visa d'adoption, ou
  // d'une annexe —, et qui cite aussi un identifiant que le recueil ne connaît
  // pas : celui-là doit rester une mention, sans lien.
  const html = `<html><body><div class="doc"><ul class="doc-visas">`
    + `<li><a class="doc-visas-link" href="eli:/fr/arr/2026/0401/iam" target="_blank" rel="noopener noreferrer" title="eli:/fr/arr/2026/0401/iam">l'arrêté n°2026-401, qui l'adopte ;</a></li>`
    + `<li><a class="doc-visas-link" href="eli:/fr/arr/2026/9999/zzz" target="_blank" rel="noopener noreferrer" title="eli:/fr/arr/2026/9999/zzz">un acte absent du recueil ;</a></li>`
    + `<li><a class="doc-visas-link" href="https://www.exemple.fr/delib.pdf" target="_blank" rel="noopener noreferrer">une source externe ;</a></li>`
    + `</ul></div></body></html>`;
  const porteur = publier(call, { numero: "2026-402", eliUri: "eli:/fr/arr/2026/0402/iam", dateDocument: "2026-03-10", datePublication: "2026-03-11", html });

  // La page servie ne porte plus AUCUN identifiant en guise d'adresse : celui du
  // recueil est devenu l'adresse de l'acte cité, l'autre est resté du TEXTE, et
  // la source externe n'a pas été touchée.
  const page = call("GET", "/recueil/" + encodeURIComponent(porteur.body.cle), null, { host: "recueil.exemple.fr" });
  assert.equal(page.status, 200);
  assert.equal(String(page.body).includes('href="eli:'), false);
  assert.ok(String(page.body).includes(`href="https://recueil.exemple.fr/recueil/${encodeURIComponent(cite.body.cle)}"`), "le lien ELI doit mener à l'acte cité");
  assert.ok(String(page.body).includes('data-eli="eli:/fr/arr/2026/0401/iam"'));
  assert.equal((String(page.body).match(/recueil-lien-eli--hors/g) || []).length, 1, "l'identifiant inconnu reste une mention, sans lien");
  assert.ok(String(page.body).includes('href="https://www.exemple.fr/delib.pdf"'), "une adresse externe n'est pas touchée");

  // L'identifiant ELI comme ADRESSE : il mène à l'acte, et à sa version en vigueur.
  const redirection = call("GET", "/eli/arr/2026/0401/iam", null, { host: "recueil.exemple.fr" });
  assert.equal(redirection.status, 302);
  assert.equal(redirection.headers.location, `https://recueil.exemple.fr/recueil/${encodeURIComponent(cite.body.cle)}`);
  assert.equal(call("GET", "/eli/arr/2026/9999/zzz", null, { host: "recueil.exemple.fr" }).status, 404);
});
