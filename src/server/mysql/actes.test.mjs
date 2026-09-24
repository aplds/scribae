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
