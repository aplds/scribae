// ============================================================================
// Tests de la COMPÉTENCE DE SIGNATURE — `node --test`.
//
// Trois règles, qui tiennent aux corrections de cette version :
//
//   1. QUI SIGNE. La signature est apposée par le TITULAIRE de l'acte — le
//      dernier étage de sa chaîne de signature — et par lui seul, et il faut
//      porter la QUALITÉ de signataire. Un délégant figure dans la chaîne (c'est
//      de lui que le pouvoir descend), mais l'acte attend la signature de son
//      délégataire : il ne signe pas « à sa place ». Un compte habilité à
//      ENVOYER l'acte en signature (un réviseur, un rédacteur) ne l'engage pas
//      davantage. C'est ce que réunit `peutSignerEffectivement`.
//   2. LA FILE. Ce qu'un signataire a à signer, et ce qu'il suit — la signature
//      qu'il a donnée par ses délégataires — ne se confondent pas : la file
//      n'engage que les actes SIGNÉS, et n'attend que les actes dont il est le
//      titulaire. Un acte pris SANS signataire explicite relève du SIGNATAIRE
//      PRINCIPAL de son entité : il doit donc figurer dans sa file.
//   3. LE VISITEUR SIGNATAIRE. Un compte marqué « Visiteur » mais porteur d'une
//      qualité cumulée (signataire, réviseur) n'est pas renvoyé à l'écran « pas
//      d'accès » : sa qualité lui rouvre le seul écran qu'elle commande.
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
// Une chaîne à deux étages : une autorité de tête, et l'adjoint à qui elle a
// délégué. L'acte est signé par l'adjoint ; le maire (le délégant) est dans la
// chaîne sans être le titulaire.
const TETE = { id: "p-tete", civility: "Monsieur", firstName: "Claude", lastName: "FAURE", entityId: "ent1" };
const DELEG = { id: "p-deleg", civility: "Madame", firstName: "Alice", lastName: "MARTIN", entityId: "ent1" };
const TIERS = { id: "p-tiers", civility: "Monsieur", firstName: "Bob", lastName: "DURAND", entityId: "ent1" };

const DELEGATION = {
  id: "del1", fromId: "p-tete", toId: "p-deleg",
  qualiteM: "adjoint au maire en charge de l'urbanisme",
  qualiteF: "adjointe au maire en charge de l'urbanisme",
  du: "", au: "", active: true, entityId: "ent1",
};

function referentiel({ delegations = [DELEGATION] } = {}) {
  return {
    config: {
      people: [TETE, DELEG, TIERS],
      entities: [{ id: "ent1", code: "VSL", name: "Ville de Valmont", signerPersonId: "p-tete" }],
      services: [], roles: [], refs: [], delegations,
      signature: { mode: "electronique" },
    },
  };
}

const TRAME = { id: "tpl1", name: "Délibération", familyId: "fam1", actTypeId: "at1", nature: "acte", entityId: "ent1", publishable: true };

const acteDeBase = (patch = {}) => ({
  id: "a1", numero: "2026-001-VSL", objet: "délibération d'essai", trameId: "tpl1",
  entityId: "ent1", statut: "pret", values: { signataire: "p-deleg" },
  ...patch,
});

// ================================================================ qui peut signer
test("peutSignerEffectivement : seul le TITULAIRE de la chaîne signe, et il faut la qualité", async (t) => {
  const mod = await charger("../src/lib/signataires.js");
  const users = await charger("../src/lib/users.js");
  if (!mod || !users) return t.skip("module indisponible hors navigateur");
  const { config } = referentiel();
  const acte = acteDeBase();
  const compte = (o) => users.newUser(o);

  const titulaire = compte({ id: "u-tit", login: "a.martin", personId: "p-deleg", roles: ["signataire"] });
  const sansQualite = compte({ id: "u-sq", login: "a.martin2", personId: "p-deleg", roles: ["redacteur"] });
  const delegant = compte({ id: "u-del", login: "c.faure", personId: "p-tete", roles: ["signataire"] });
  const tiers = compte({ id: "u-t", login: "b.durand", personId: "p-tiers", roles: ["signataire"] });

  // Le titulaire, porteur de la qualité : il signe.
  const c = mod.peutSignerEffectivement(config, titulaire, acte, TRAME);
  assert.equal(c.ok, true, "le titulaire porteur de la qualité signe");
  assert.equal(c.effectif, true);
  assert.equal(c.motif, "");

  // Le délégant EST dans la chaîne — il voit l'acte — mais l'acte attend la
  // signature de son délégataire : il ne signe pas à sa place.
  const cd = mod.peutSignerEffectivement(config, delegant, acte, TRAME);
  assert.equal(cd.effectif, false, "le délégant n'est pas le dernier étage de la chaîne");
  assert.equal(cd.ok, false, "un délégant ne signe pas à la place de son délégataire");
  assert.match(cd.motif, /attend la signature de son titulaire/);

  // Le TITULAIRE sans la QUALITÉ ne signe pas non plus : il peut envoyer, non
  // engager.
  const sq = mod.peutSignerEffectivement(config, sansQualite, acte, TRAME);
  assert.equal(sq.effectif, true, "il est bien le titulaire");
  assert.equal(sq.ok, false, "sans la qualité de signataire, la signature est refusée");
  assert.match(sq.motif, /qualité de signataire/);

  // Un compte hors de la chaîne : refusé.
  const ct = mod.peutSignerEffectivement(config, tiers, acte, TRAME);
  assert.equal(ct.ok, false);
  assert.match(ct.motif, /chaîne de signature/);
});

test("peutSignerEffectivement : un compte sans personne rattachée ne signe rien", async (t) => {
  const mod = await charger("../src/lib/signataires.js");
  const users = await charger("../src/lib/users.js");
  if (!mod || !users) return t.skip("module indisponible hors navigateur");
  const { config } = referentiel();
  const orphelin = users.newUser({ id: "u-o", login: "o.orph", roles: ["signataire"] });
  const c = mod.peutSignerEffectivement(config, orphelin, acteDeBase(), TRAME);
  assert.equal(c.ok, false);
});

// ==================================================================== la file
test("fileSignature : engagee ne contient QUE les actes signés, et le signataire principal est bien titulaire", async (t) => {
  const mod = await charger("../src/lib/signataires.js");
  const users = await charger("../src/lib/users.js");
  if (!mod || !users) return t.skip("module indisponible hors navigateur");
  const { config } = referentiel();
  const trameDe = (a) => (a?.trameId === "tpl1" ? TRAME : null);

  const delegant = users.newUser({ id: "u-del", login: "c.faure", personId: "p-tete", roles: ["signataire"] });
  const delegataire = users.newUser({ id: "u-deg", login: "a.martin", personId: "p-deleg", roles: ["signataire"] });

  const enAttente = acteDeBase({ id: "a-att", statut: "en_signature" });
  const signe = acteDeBase({ id: "a-sign", statut: "signee", original: { signatures: [{ valeur: "x" }] } });

  // Le délégant SUIT la signature donnée par son délégataire : l'acte signé est
  // dans sa file « engagée », et rien n'attend sa signature.
  const fileTete = mod.fileSignature(config, delegant, [enAttente, signe], trameDe);
  assert.deepEqual(fileTete.aSigner.map((a) => a.id), []);
  assert.deepEqual(fileTete.engagee.map((a) => a.id), ["a-sign"],
    "un acte encore en attente n'a rien à faire dans la file « engagée »");

  // Le délégataire, lui, a l'acte non signé à signer, et l'acte signé à suivre.
  const fileDeleg = mod.fileSignature(config, delegataire, [enAttente, signe], trameDe);
  assert.deepEqual(fileDeleg.aSigner.map((a) => a.id), ["a-att"]);
  assert.deepEqual(fileDeleg.engagee.map((a) => a.id), ["a-sign"]);

  // Un acte pris SANS signataire explicite relève du SIGNATAIRE PRINCIPAL de son
  // entité (ici le maire, p-tete) : il doit apparaître dans sa file à signer —
  // c'était le bug du circuit simple, où ces actes n'apparaissaient jamais.
  const sansSignataire = { id: "a-ent", objet: "arrêté pris sans signataire désigné", trameId: "tpl1", entityId: "ent1", statut: "pret", values: {} };
  assert.equal(mod.signataireEffectif(config, sansSignataire, TRAME), "p-tete");
  const fileEntite = mod.fileSignature(config, delegant, [sansSignataire], trameDe);
  assert.deepEqual(fileEntite.aSigner.map((a) => a.id), ["a-ent"],
    "l'acte dont le signataire est le principal de l'entité attend la signature de celui-ci");
});

// ============================================================ visiteur signataire
test("can / estVisiteur : une qualité cumulée rouvre au visiteur le seul écran qu'elle commande", async (t) => {
  const users = await charger("../src/lib/users.js");
  if (!users) return t.skip("module indisponible hors navigateur");

  // Visiteur + signataire : la qualité ouvre la signature, et rien d'autre.
  const vs = users.newUser({ id: "u-vs", login: "v.sig", personId: "p-deleg", roles: ["visiteur", "signataire"] });
  assert.equal(users.estVisiteur(vs), false, "une qualité qui ouvre quelque chose écarte le renvoi « pas d'accès »");
  assert.equal(users.can(vs, "actes.signer"), true, "le visiteur signataire accède à l'écran de signature");
  assert.equal(users.can(vs, "trames.voir"), false, "sa qualité ne lui ouvre rien de plus");
  assert.equal(users.can(vs, "actes.rediger"), false);
  assert.equal(users.can(vs, "signature.gerer"), false);
  assert.deepEqual(users.permissionsDeQualites(vs), ["actes.signer"]);

  // Visiteur seul : aucune permission, et l'écran « pas d'accès ».
  const v = users.newUser({ id: "u-v", login: "v.seul", roles: ["visiteur"] });
  assert.equal(users.estVisiteur(v), true);
  assert.equal(users.can(v, "actes.signer"), false);

  // Visiteur + réviseur : la qualité de réviseur ouvre la révision. La
  // permission `actes.signer` est partagée avec les rédacteurs et les éditeurs
  // (elle couvre l'ENVOI en signature) : un réviseur l'a donc aussi.
  const vr = users.newUser({ id: "u-vr", login: "v.rev", roles: ["visiteur", "reviseur"] });
  assert.equal(users.estVisiteur(vr), false);
  assert.equal(users.can(vr, "actes.reviser"), true);
  assert.equal(users.can(vr, "trames.voir"), false, "sa qualité ne lui ouvre rien de plus");

  // Un rôle ordinaire (non cumulable) ne survit pas au profil Visiteur : le
  // profil ferme l'atelier.
  const va = users.newUser({ id: "u-va", login: "v.admin", roles: ["visiteur", "administrateur"] });
  assert.equal(users.estVisiteur(va), true, "le profil Visiteur prime sur un rôle ordinaire");
  assert.equal(users.can(va, "referentiel.gerer"), false);
});
