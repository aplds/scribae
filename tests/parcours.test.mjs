// ============================================================================
// Tests du PARCOURS d'un acte et de la file du signataire — `node --test`.
//
// Ce qui est fixé ici tient en deux règles, et les deux se voient à l'écran :
//
//   1. L'ORDRE DES PORTES. Le parapheur (le circuit du référentiel) vient
//      d'abord, la révision ensuite, la signature après — et, dans le circuit
//      externe, la révision devient la CERTIFICATION de conformité, après la
//      signature. Une timeline qui inverserait ces portes ferait croire à un
//      contrôle qui n'a pas eu lieu, ou au mauvais moment.
//   2. Une ANNEXE ne se signe pas. Elle ne doit donc pas apparaître « prête à
//      signer » dans la file d'un signataire, même quand la chaîne de signature
//      de sa trame désigne la même personne que celle de l'acte qui l'adopte.
//
//   node --test tests/
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

// --------------------------------------------------------------- un référentiel
// Le plus petit référentiel qui exerce l'ordre des portes : un circuit à deux
// étapes (une vérification, un visa), une entité dont le signataire principal
// est une personne du référentiel, et un compte réviseur — c'est lui qui rend la
// révision obligatoire.
const CIRCUIT = {
  id: "cir-general", label: "Circuit général", active: true,
  trameIds: [], familyIds: [], entityIds: [],
  steps: [
    { id: "etp-v", kind: "verification", label: "Vérification du dossier", role: "reviseur", targetType: "role", serviceScoped: false, optional: false },
    { id: "etp-a", kind: "visa", label: "Visa de la direction", role: "editeur", targetType: "role", serviceScoped: false, optional: false },
  ],
};

const PERSONNE = { id: "p1", civility: "M.", firstName: "Jean", lastName: "Martin" };

function referentiel({ circuits = [CIRCUIT], users = [{ id: "u-rev", login: "r.vis", roles: ["reviseur"], active: true }], signature = {} } = {}) {
  return {
    config: {
      circuits,
      signature: { mode: "electronique", ...signature },
      people: [PERSONNE],
      entities: [{ id: "ent1", code: "VSL", signerPersonId: "p1" }],
      services: [],
      delegations: [],
      roles: [],
    },
    users,
    trames: [{
      id: "tpl1", name: "Délibération", familyId: "fam1", actTypeId: "at1",
      nature: "acte", entityId: "ent1", publishable: true,
    }],
  };
}

const acteDeBase = (patch = {}) => ({
  id: "a1", numero: "2026-001-VSL", objet: "délibération d'essai", trameId: "tpl1",
  entityId: "ent1", statut: "pret", createdByName: "Sophie LECLERC", values: { signataire: "p1" },
  validation: {
    circuitId: CIRCUIT.id, circuitLabel: CIRCUIT.label, statut: "valide", empreinte: "",
    steps: [
      { id: "etp-v", label: "Vérification du dossier", role: "reviseur", kind: "verification", targetType: "role", cibleLabel: "Réviseur (contrôle avant la signature)", statut: "valide", byName: "Alice ROUSSEL", at: "2026-03-01T10:00:00.000Z" },
      { id: "etp-a", label: "Visa de la direction", role: "editeur", kind: "visa", targetType: "role", cibleLabel: "Éditeur (chef de service, rédacteur en chef)", statut: "valide", byName: "Sophie LECLERC", at: "2026-03-02T10:00:00.000Z" },
    ],
  },
  ...patch,
});

// L'empreinte de validation doit être à jour, sinon la phase est lue « à faire ».
async function coherent(validation, acte) {
  const v = await charger("../src/lib/validation.js");
  return v ? { ...validation, empreinte: v.empreinteTexte(acte) } : validation;
}

test("parcours : le parapheur vient AVANT la révision, qui vient AVANT la signature", async (t) => {
  const mod = await charger("../src/lib/parcours.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  const { config, users, trames } = referentiel();

  const acte = acteDeBase({ statut: "en_attente" });
  acte.validation = await coherent(acte.validation, acte);
  const p = mod.parcoursDeActe(acte, { config, trames, users });

  assert.deepEqual(p.phases.map((x) => x.cle), ["redaction", "parapheur", "revision", "signature", "publication"]);
  assert.equal(p.phases.find((x) => x.cle === "parapheur").etat, "fait");
  assert.equal(p.phases.find((x) => x.cle === "revision").etat, "encours", "la révision reste la porte ouverte");
  assert.match(p.phases.find((x) => x.cle === "revision").position, /après le parapheur/);
  assert.equal(p.courante, "revision");
});

test("parcours : le parapheur montre ses étapes, leur nature et leur titulaire", async (t) => {
  const mod = await charger("../src/lib/parcours.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  const { config, users, trames } = referentiel();

  const p = mod.parcoursDeActe(acteDeBase(), { config, trames, users });
  const para = p.phases.find((x) => x.cle === "parapheur");
  assert.equal(para.sousEtapes.length, 2);
  assert.equal(para.sousEtapes[0].nature, "Vérification");
  assert.match(para.sousEtapes[1].nature, /^Visa/);
  assert.equal(para.sousEtapes[0].fait, true);
  assert.match(para.sousEtapes[0].titulaire, /Réviseur/);
});

test("parcours : sans réviseur compétent, la porte de la révision N'EXISTE PAS", async (t) => {
  const mod = await charger("../src/lib/parcours.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  const users = [{ id: "u-edit", login: "e.dit", roles: ["editeur"], active: true }];
  const { config, trames } = referentiel({ users });

  const p = mod.parcoursDeActe(acteDeBase(), { config, trames, users });
  assert.deepEqual(p.phases.map((x) => x.cle), ["redaction", "parapheur", "signature", "publication"]);
});

test("parcours : la signature est franchie une fois l'acte signé", async (t) => {
  const mod = await charger("../src/lib/parcours.js");
  const val = await charger("../src/lib/validation.js");
  if (!mod || !val) return t.skip("module indisponible hors navigateur");
  const { config, users, trames } = referentiel();

  const acte = acteDeBase({ statut: "signee", revision: { statut: "valide", empreinte: "" }, original: { signatures: [] } });
  acte.validation = await coherent(acte.validation, acte);
  acte.revision.empreinte = val.empreinteTexte(acte);

  const p = mod.parcoursDeActe(acte, { config, trames, users });
  assert.equal(p.phases.find((x) => x.cle === "signature").etat, "fait");
  assert.equal(p.phases.find((x) => x.cle === "revision").etat, "fait");
  assert.equal(p.courante, "publication");
});

test("parcours : une porte PASSÉE SANS ÊTRE FRANCHIE se dit « sans objet », sans faire croire qu'elle attend", async (t) => {
  const mod = await charger("../src/lib/parcours.js");
  const val = await charger("../src/lib/validation.js");
  if (!mod || !val) return t.skip("module indisponible hors navigateur");
  const { config, users, trames } = referentiel();

  // Un acte signé ET publié, sans aucune trace de révision — alors qu'un
  // réviseur est compétent pour sa trame. C'est le cas des actes antérieurs à la
  // fonction, ou de ceux dont le contrôle n'était pas requis ce jour-là. Dire la
  // révision « en cours » serait faux : l'acte est plus loin qu'elle, et le fil
  // se contredirait (une porte « ouverte » entre deux puces vertes).
  const acte = acteDeBase({ statut: "publie", original: { signatures: [] }, publication: { le: "2026-03-10T10:00:00.000Z" } });
  acte.validation = await coherent(acte.validation, acte);

  const p = mod.parcoursDeActe(acte, { config, trames, users });
  const rev = p.phases.find((x) => x.cle === "revision");
  assert.equal(rev.etat, "sansobjet", "la révision n'a pas été franchie : elle n'est pas « en cours »");
  assert.match(rev.hint, /n'a pas été franchie/);
  assert.equal(p.phases.find((x) => x.cle === "signature").etat, "fait");
  assert.equal(p.courante, "publication");
  assert.ok(!p.phases.some((x) => x.etat === "encours"), "aucune porte n'est ouverte : l'acte est publié");

  // Et l'inverse reste vrai : un acte qui n'est PAS allé plus loin garde sa
  // porte ouverte (c'est ce que la correction ne doit pas casser).
  const enCours = acteDeBase({ statut: "en_attente" });
  enCours.validation = await coherent(enCours.validation, enCours);
  const q = mod.parcoursDeActe(enCours, { config, trames, users });
  assert.equal(q.phases.find((x) => x.cle === "revision").etat, "encours");
  assert.equal(q.courante, "revision");
});

test("parcours : en circuit externe, la certification prend la place de la révision, APRÈS la signature", async (t) => {
  const mod = await charger("../src/lib/parcours.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  const { config, users, trames } = referentiel({ signature: { mode: "externe" } });

  const acte = acteDeBase({
    statut: "signee",
    externe: { statut: "signe_depose", certificationRequise: true, certification: { statut: "en_attente" } },
  });
  acte.validation = await coherent(acte.validation, acte);
  const cles = mod.parcoursDeActe(acte, { config, trames, users }).phases.map((x) => x.cle);
  assert.deepEqual(cles, ["redaction", "parapheur", "signature", "certification", "publication"]);
  assert.ok(!cles.includes("revision"), "en externe, la révision n'est pas une porte en amont");
});

test("parcours : une ANNEXE n'a ni signature ni révision — elle est adoptée", async (t) => {
  const mod = await charger("../src/lib/parcours.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  const { config, users, trames } = referentiel();
  trames.push({ id: "tpl-reg", name: "Règlement intérieur (annexe)", nature: "annexe", reglement: true, publishable: false });

  const annexe = {
    id: "an1", objet: "règlement intérieur du conseil", trameId: "tpl-reg", nature: "annexe",
    statut: "pret", createdByName: "Sophie LECLERC", values: { signataire: "p1" },
    adoptePar: { acteId: "a1", numero: "2026-001-VSL", designation: "délibération", date: "2026-03-01" },
  };
  const p = mod.parcoursDeActe(annexe, { config, trames, users });
  const cles = p.phases.map((x) => x.cle);
  assert.ok(p.annexe);
  assert.ok(!cles.includes("signature"));
  assert.deepEqual(cles, ["redaction", "adoption", "information"]);
  assert.equal(p.phases.find((x) => x.cle === "adoption").etat, "fait");
});

test("fileSignature : une ANNEXE ne se retrouve pas dans la file du signataire", async (t) => {
  const mod = await charger("../src/lib/signataires.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  const { config, trames } = referentiel();
  trames.push({ id: "tpl-reg", name: "Règlement (annexe)", nature: "annexe", publishable: false });
  const trameDe = (a) => trames.find((x) => x.id === a.trameId) || null;

  const compte = { id: "u-sig", login: "j.martin", personId: "p1", roles: ["signataire"], active: true };
  const normale = acteDeBase({ id: "a2", statut: "pret" });
  const annexe = { id: "an2", objet: "règlement", trameId: "tpl-reg", nature: "annexe", statut: "pret", values: { signataire: "p1" } };

  const file = mod.fileSignature(config, compte, [normale, annexe], trameDe);
  assert.deepEqual(file.aSigner.map((a) => a.id), ["a2"]);
  assert.deepEqual(file.engagee, []);
});
