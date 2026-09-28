// ============================================================================
// LA VERSION D'UNE PUBLICATION, éprouvée — `node --test`.
//
// Une publication ne s'ÉCRASE pas : le service la range sous une clé qui porte
// son « expression de date », si bien que DEUX expressions différentes donnent
// deux VERSIONS du même identifiant ELI — l'ancienne reste à l'historique — et
// que la MÊME expression rend la publication déjà déposée.
//
// C'est cette mécanique qui permet à la démonstration de RATTRAPER ses
// publications quand le jeu change (voir src/lib/publication-version.js et
// src/ui/demo-publications.js) : un jeu modifié publie une version nouvelle au
// lieu de laisser en ligne le texte périmé — l'écueil que ce fichier ferme.
//
// IL ÉPROUVE LES DEUX CÔTÉS :
//   • les RÈGLES DU CLIENT (src/lib/publication-version.js) — le suffixe du jeu,
//     l'expression, la clé d'idempotence —, sur leurs bornes ;
//   • le CONTRAT DU SERVICE, contre le service de démonstration chargé en
//     mémoire depuis `index.html` (le même que `tests/conformite-service.test.mjs`
//     et `tests/persistance-double-tampon.test.mjs`) : c'est là que se joue la
//     propriété dont le client dépend, à savoir que la clé d'idempotence DOIT
//     porter l'expression — sans quoi un appel rejoué pour une version nouvelle
//     rendrait l'ANCIENNE, et la version neuve ne verrait jamais le jour.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  suffixeJeu, expressionDeJeu, publicationDuJeu, cleIdempotencePublication,
} from "../src/lib/publication-version.js";

// ----------------------------------------------------------------------------
// 1. LES RÈGLES DU CLIENT

test("suffixeJeu : le suffixe d'une version de jeu", () => {
  assert.equal(suffixeJeu(53), "-s53");
  assert.equal(suffixeJeu(7), "-s7");
});

test("expressionDeJeu : la date du document, suivie du suffixe quand il y en a un", () => {
  assert.equal(expressionDeJeu("2026-01-20", "-s53"), "2026-01-20-s53");
  // Sans suffixe, l'expression reste la date : le comportement d'une publication
  // manuelle (qui ne pose pas d'expression) est inchangé.
  assert.equal(expressionDeJeu("2026-01-20", ""), "2026-01-20");
  assert.equal(expressionDeJeu("", "-s53"), "-s53");
});

test("publicationDuJeu : seule une publication qui porte le suffixe est à jour", () => {
  // C'est la règle qui fait PUBLIER : une publication absente, ou dont la clé ne
  // porte pas le suffixe du jeu, est périmée.
  assert.equal(publicationDuJeu({ cle: "arr-2026-0401-vsl@2026-01-20-s53-originale" }, "-s53"), true);
  assert.equal(publicationDuJeu({ cle: "arr-2026-0401-vsl@2026-01-20-originale" }, "-s53"), false,
    "une publication SANS le suffixe du jeu est périmée : c'est ce qui la rattrape");
  assert.equal(publicationDuJeu(null, "-s53"), false, "une publication absente est périmée");
  assert.equal(publicationDuJeu(undefined, "-s53"), false);
  // Sans suffixe demandé, il n'y a rien à rattraper : tout est « à jour ».
  assert.equal(publicationDuJeu(null, ""), true);
  assert.equal(publicationDuJeu({ cle: "x" }, ""), true);
});

test("cleIdempotencePublication : la clé porte l'expression, et deux expressions se distinguent", () => {
  const eli = "eli:/fr/arr/2026/0401/vsl", d = "2026-01-20";
  const v53 = cleIdempotencePublication(eli, d, "originale", expressionDeJeu(d, suffixeJeu(53)));
  const v54 = cleIdempotencePublication(eli, d, "originale", expressionDeJeu(d, suffixeJeu(54)));
  assert.match(v53, /-2026-01-20-s53$/);
  assert.notEqual(v53, v54, "deux versions du jeu ne peuvent pas partager la même clé d'idempotence");
  // Sans expression, la clé est celle d'avant — une publication manuelle garde
  // donc exactement le comportement d'hier.
  assert.equal(cleIdempotencePublication(eli, d, "originale", ""), `${eli}@${d}-originale`);
  assert.equal(cleIdempotencePublication(eli, d, "informative", undefined), `${eli}@${d}-informative`);
});

// ----------------------------------------------------------------------------
// 2. LE CONTRAT DU SERVICE

const SKIP = "index.html illisible ici";

// L'adresse d'`index.html` : au-dessus de `tests/`, dans les deux dispositions
// (dépôt livré et atelier). Un module sans adresse hiérarchique ne doit pas
// faire échouer l'épreuve, seulement la faire changer de chemin.
async function lireIndex() {
  const noms = [];
  try {
    const { fileURLToPath } = await import("node:url");
    for (const rel of ["../../index.html", "../index.html"]) {
      try { noms.push(fileURLToPath(new URL(rel, import.meta.url))); } catch (e) { /* adresse non hiérarchique */ }
    }
  } catch (e) { /* node:url indisponible */ }
  noms.push("index.html", "../../index.html", "../index.html");
  for (const nom of noms) {
    try { return await readFile(nom, "utf8"); } catch (e) { /* essai suivant */ }
  }
  return null;
}

// Le service de démonstration, instancié comme `src/pages/host.js` le fait : on
// relit le script `text/x-server-plugin` de la page et on l'exécute avec un
// `self` local et son état durable (double tampon, voir
// `tests/persistance-double-tampon.test.mjs`).
function monterService(html) {
  const m = String(html || "").match(/<script[^>]*type="text\/x-server-plugin"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("le script du service de démonstration est introuvable dans index.html");
  const rpc = new Function("state", "self", m[1] + "\n;return self.rpc;")(new Uint8Array(4 + 2 * (8000000 + 2)), {});
  if (!rpc || typeof rpc.api !== "function") throw new Error("le service de démonstration ne rend pas son API");
  return rpc;
}

// Le transport : le service répond dans l'appel, on en fait une promesse. Les
// en-têtes comptent ici — c'est par l'un d'eux que voyage la clé d'idempotence.
function transport(rpc) {
  return async (methode, chemin, corps, entetes = {}) => {
    const brut = rpc.api(null, JSON.stringify({
      method: methode, path: chemin, headers: entetes,
      body: corps === undefined ? null : corps,
    }));
    const r = JSON.parse(brut);
    return { status: r.status, body: r.body };
  };
}

const JETON = "cle-d-epreuve-0123456789abcdefghij";
const ELI = "eli:/fr/arr/2026/test/1";
const DATE = "2026-03-10";
const AUTH = { authorization: "Bearer " + JETON };

// Deux versions publiées dans la MÊME milliseconde partageraient leur heure de
// dépôt, et l'ordre du recueil (du plus récent au plus ancien) ne les
// distinguerait plus. La pause donne à chaque version son instant — c'est aussi
// ce que fait la vie réelle, où deux versions sont publiées à des moments
// différents.
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Un acte de REPRISE : publié sans signature ni circuit (l'acte ancien a déjà
// été signé), ce qui laisse l'épreuve se concentrer sur le versionnement.
async function acteDeReprise(api) {
  const dep = await api("POST", "/v1/actes", {
    akn: "<akomaNtoso><body><p>Épreuve de versionnement.</p></body></akomaNtoso>",
    numero: "2026-TEST-1", objet: "Épreuve de versionnement", nature: "Arrêté",
    entityId: "etp-test", entityName: "Commune d'épreuve", dateSignature: DATE, reprise: true,
  }, AUTH);
  assert.equal(dep.status, 201, "le dépôt doit être accepté : " + JSON.stringify(dep.body));
  return dep.body.id;
}

const corpsPublication = (expression) => ({
  eliUri: ELI, dateDocument: DATE, datePublication: "2026-03-12",
  html: "<p>Version " + expression + "</p>", akn: "<akomaNtoso/>",
  numero: "2026-TEST-1", nature: "Arrêté", entityName: "Commune d'épreuve", auteur: "Épreuve",
  reprise: true, original: { format: "application/vnd.actes.original-signe+json", document: { akn: "<akomaNtoso/>", sha256: "0" } },
});

test("le service versionne par l'expression, et dédoublonne par la clé qui la porte", async (t) => {
  const html = await lireIndex();
  if (!html) return t.skip(SKIP);
  const api = transport(monterService(html));
  const b = await api("POST", "/v1/auth/bootstrap", { cle: JETON, role: "administrateur", label: "Épreuve de versionnement" });
  assert.equal(b.status, 201, "le provisionnement initial doit être accepté : " + JSON.stringify(b.body));
  const id = await acteDeReprise(api);
  const lire = async () => (await api("GET", "/v1/publications")).body.publications;
  const versions = async () => (await lire()).filter((p) => p.eliUri === ELI).map((p) => p.cle);

  // --- VERSION 1, un jeu donné --------------------------------------------
  const expr1 = expressionDeJeu(DATE, suffixeJeu(53));
  const cle1 = cleIdempotencePublication(ELI, DATE, "originale", expr1);
  const p1 = await api("POST", `/v1/actes/${id}/publication`, { ...corpsPublication(expr1), dateExpression: expr1 }, { ...AUTH, "idempotency-key": cle1 });
  assert.equal(p1.status, 201, "la première publication doit être créée : " + JSON.stringify(p1.body));
  assert.ok(p1.body.cle.endsWith("-s53-originale"), "la clé de la version porte l'expression du jeu, vu : " + p1.body.cle);
  assert.deepEqual(await versions(), [p1.body.cle]);

  // --- LA MÊME version rejouée : rien de nouveau --------------------------
  const p1bis = await api("POST", `/v1/actes/${id}/publication`, { ...corpsPublication(expr1), dateExpression: expr1 }, { ...AUTH, "idempotency-key": cle1 });
  assert.equal(p1bis.status, 200);
  assert.equal(p1bis.body.idempotent, true, "le même appel ne crée pas une seconde version");
  assert.equal(p1bis.body.cle, p1.body.cle);
  assert.equal((await versions()).length, 1);

  // --- VERSION 2, le jeu suivant ------------------------------------------
  // L'expression change : c'est une version NOUVELLE du même identifiant, et
  // l'ancienne reste à l'historique.
  const expr2 = expressionDeJeu(DATE, suffixeJeu(54));
  const cle2 = cleIdempotencePublication(ELI, DATE, "originale", expr2);
  await pause(5);
  const p2 = await api("POST", `/v1/actes/${id}/publication`, { ...corpsPublication(expr2), dateExpression: expr2 }, { ...AUTH, "idempotency-key": cle2 });
  assert.equal(p2.status, 201, "une expression nouvelle crée une version nouvelle : " + JSON.stringify(p2.body));
  assert.notEqual(p2.body.cle, p1.body.cle);
  const apres2 = await versions();
  assert.equal(apres2.length, 2, "les deux versions coexistent");
  assert.equal(apres2[0], p2.body.cle, "le recueil rend la PLUS RÉCENTE en tête, par identifiant ELI");
  assert.equal(apres2[1], p1.body.cle);
  // Et c'est LA propriété dont dépend l'amorçage : la première vue d'un
  // identifiant dans la liste est sa version la plus récente.
  const liste = await lire();
  const premiere = liste.find((p) => p.eliUri === ELI);
  assert.equal(premiere.cle, p2.body.cle, "l'amorçage de démonstration lit la première vue : ce doit être la plus récente");
  assert.equal(premiere.latest, true);
});

test("les dents : une clé d'idempotence SANS l'expression rendrait l'ancienne version", async (t) => {
  const html = await lireIndex();
  if (!html) return t.skip(SKIP);
  const api = transport(monterService(html));
  await api("POST", "/v1/auth/bootstrap", { cle: JETON, role: "administrateur", label: "Épreuve des dents" });
  const id = await acteDeReprise(api);

  // CE QUE FAISAIT LE CLIENT D'AVANT : la clé ne portait que l'ELI, la date et le
  // genre — pas l'expression. Une publication posée ainsi...
  const naive = cleIdempotencePublication(ELI, DATE, "originale", "");
  const expr1 = expressionDeJeu(DATE, suffixeJeu(53));
  const p1 = await api("POST", `/v1/actes/${id}/publication`, { ...corpsPublication(expr1), dateExpression: expr1 }, { ...AUTH, "idempotency-key": naive });
  assert.equal(p1.status, 201);

  // ... et un appel REJOUÉ pour une version NOUVELLE avec la même clé rend
  // l'ANCIENNE (le service dédoublonne sur la clé avant de regarder
  // l'expression) : c'est la version périmée qui resterait en ligne pour
  // toujours. C'est le défaut que la clé qui porte l'expression ferme.
  const expr2 = expressionDeJeu(DATE, suffixeJeu(54));
  const p2 = await api("POST", `/v1/actes/${id}/publication`, { ...corpsPublication(expr2), dateExpression: expr2 }, { ...AUTH, "idempotency-key": naive });
  assert.equal(p2.status, 200);
  assert.equal(p2.body.idempotent, true, "avec la même clé, l'expression neuve n'est jamais publiée");
  assert.equal(p2.body.cle, p1.body.cle, "le service rend la version ANCIENNE");
  const pubs = (await api("GET", "/v1/publications")).body.publications.filter((p) => p.eliUri === ELI);
  assert.equal(pubs.length, 1, "aucune version nouvelle n'est apparue");

  // La clé qui PORTE l'expression, elle, publie bien la version neuve.
  const porteuse = cleIdempotencePublication(ELI, DATE, "originale", expr2);
  const p3 = await api("POST", `/v1/actes/${id}/publication`, { ...corpsPublication(expr2), dateExpression: expr2 }, { ...AUTH, "idempotency-key": porteuse });
  assert.equal(p3.status, 201, "la clé qui porte l'expression publie la version neuve");
  assert.notEqual(p3.body.cle, p1.body.cle);
  assert.equal((await api("GET", "/v1/publications")).body.publications.filter((p) => p.eliUri === ELI).length, 2);
});
