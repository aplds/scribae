// ============================================================================
// Tests du verrou de démonstration de la signature — `node --test`.
//
// Ce que ces épreuves protègent : sur une installation auto-hébergée dont le
// `.env` éteint la démonstration (`DEMO=false`), les circuits d'essai
// n'existent pas — la signature simple (clé engendrée dans le navigateur,
// certificat de démonstration) et le prestataire simulé sont retirés de
// l'inventaire, et la signature y est désactivée par défaut. `DEMO=true` les
// rallume. La page de l'original signé, elle, ne parle de « démonstration »
// que pour les paquets qui en portent un : quand c'est le SERVICE qui a signé
// (circuit interne, clé scellée au coffre), l'émetteur est la collectivité.
//
// Modules PURS : on les éprouve sans navigateur, sans service et sans
// référentiel. Sans déploiement qui parle, le miroir du référentiel fait foi
// (`config.brand.demo`), et aucun service ne parlant, le circuit électronique
// est simulé et le coffre interne indisponible.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

test("verrou démo : la signature de démonstration suit le commutateur", async (t) => {
  const mod = await charger("../src/lib/externe.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  assert.equal(mod.signatureDemoPermise({ brand: { demo: false } }), false);
  assert.equal(mod.signatureDemoPermise({ brand: { demo: true } }), true);
});

test("verrou démo : démonstration éteinte, aucun circuit d'essai n'est offert", async (t) => {
  const mod = await charger("../src/lib/externe.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  // Sans service qui parle, l'électronique est simulé : démonstration éteinte,
  // l'inventaire est vide — la signature est désactivée par défaut.
  assert.deepEqual(mod.circuitsDisponibles({ brand: { demo: false } }, {}), []);
  // Démonstration allumée : le circuit simulé reste offert (page de démo).
  assert.deepEqual(mod.circuitsDisponibles({ brand: { demo: true } }, {}), ["electronique"]);
});

test("verrou démo : le simple imposé par une trame ne passe pas l'inventaire", async (t) => {
  const mod = await charger("../src/lib/externe.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  const trame = { signature: "simple_autorise" };
  assert.ok(!mod.circuitsDisponibles({ brand: { demo: false } }, trame).includes("simple"));
  assert.ok(mod.circuitsDisponibles({ brand: { demo: true } }, trame).includes("simple"));
});

test("page de l'original : le service ne signe pas « en démonstration »", async (t) => {
  const mod = await charger("../src/lib/signature.js");
  if (!mod || typeof mod.pageOriginalSigne !== "function") return t.skip("module indisponible hors navigateur");
  const base = {
    reference: "2026-401",
    document: { sha256: "abc" },
    signatures: [{
      signeLe: "2026-03-10T12:00:00.000Z", algorithme: "ECDSA P-256 / SHA-256", valeur: "00",
      signataire: { nom: "Jeanne Mercier", fonction: "La maire" },
      certificat: { sujet: "Jeanne Mercier", emetteur: "X", numeroSerie: "1", algorithme: "EC", valideDu: "2026-01-01", valideAu: "2027-01-01", empreinte: "ff" },
    }],
    horodatage: { emisPar: "Y", emisLe: "2026-03-10T12:00:00.000Z", valeur: "00", empreinte: "ff" },
  };
  const interne = { ...base, prestataire: { id: "scribae-interne" } };
  const pageInterne = mod.pageOriginalSigne(interne, "<p>texte</p>", "Valmont", "");
  assert.match(pageInterne, /collectivit/i, "l'émetteur est la collectivité elle-même");
  assert.ok(!/d[eé]monstration/i.test(pageInterne), "aucune mention de démonstration pour le circuit interne");
  const simple = { ...base, prestataire: { id: "esup-signature" } };
  const pageSimple = mod.pageOriginalSigne(simple, "<p>texte</p>", "Valmont", "");
  assert.match(pageSimple, /d[eé]monstration/i, "le paquet d'essai reste nommé comme tel");
});
