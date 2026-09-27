// ============================================================================
// Tests du FLUX du service — `node --test`.
//
// Ce que ces épreuves protègent : le hub qui pousse « ce qui vient de changer »
// aux postes (voir src/server/mysql/flux.mjs). Trois propriétés comptent, et
// aucune ne se voit à l'écran avant qu'il ne soit trop tard :
//   • un poste LENT ne bloque ni le service ni les autres (l'évènement est
//     abandonné pour lui, et il reçoit une reprise) ;
//   • une connexion MORTE est retirée au lieu d'accumuler ;
//   • le flux ne transporte AUCUN contenu — le nom d'une collection, sa
//     révision, et rien d'autre (c'est ce qui le rend inoffensif).
// Le module est PUR : on lui injecte ses abonnés, sans serveur ni réseau.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { creerFlux } from "./flux.mjs";

// Un abonné de laboratoire : il retient ce qu'on lui écrit, et peut refuser
// (c'est ainsi qu'un `res.write` de Node dit « mon tampon est plein »).
// L'état vit dans une CLOSURE, jamais sur `this` : le hub garde les fonctions
// `ecrire`/`fermer` et les appelle détachées de cet objet, donc un état porté par
// `this` serait perdu (c'est exactement le défaut que ces épreuves ont révélé).
function abonneMemoire({ lenteur = 0 } = {}) {
  const recu = [];
  const etat = { refus: lenteur, ferme: false };
  return {
    recu,
    get refus() { return etat.refus; },
    set refus(v) { etat.refus = v; },
    ecrire(texte) {
      if (etat.refus > 0) { etat.refus -= 1; return false; }
      recu.push(texte);
      return true;
    },
    get ferme() { return etat.ferme; },
    fermer() { etat.ferme = true; },
    // Les évènements utiles : ce que l'abonné a reçu, décodé.
    evenements() {
      return recu.join("").split("\n\n").filter(Boolean).map((bloc) => {
        const ligne = bloc.split("\n").find((l) => l.startsWith("data: "));
        return ligne ? JSON.parse(ligne.slice(6)) : null;
      }).filter(Boolean);
    },
  };
}

test("flux : un changement est poussé à tous les abonnés", () => {
  const flux = creerFlux();
  const a = abonneMemoire();
  const b = abonneMemoire();
  flux.abonner(a);
  flux.abonner(b);
  const servis = flux.publier({ type: "collection", collection: "trames", revision: 12 });
  assert.equal(servis, 2);
  assert.deepEqual(a.evenements(), [{ type: "collection", collection: "trames", revision: 12 }]);
  assert.deepEqual(b.evenements(), a.evenements());
  assert.equal(flux.compter(), 2);
  assert.deepEqual(flux.resume(), { abonnes: 2, publies: 1, abandonnes: 0, max: 256 });
});

test("flux : un abonné LENT est abandonné, puis remis d'aplomb par une reprise", () => {
  const flux = creerFlux();
  const lent = abonneMemoire({ lenteur: 2 });   // refusera l'évènement PUIS la reprise
  const vif = abonneMemoire();
  const a = flux.abonner(lent);
  flux.abonner(vif);
  flux.publier({ type: "collection", collection: "actes", revision: 3 });
  // Les autres ne sont pas ralentis : le vif a bien reçu son évènement.
  assert.equal(vif.evenements().length, 1);
  assert.equal(lent.evenements().length, 0, "l'abonné lent n'a rien reçu : c'est le principe");
  assert.equal(flux.resume().abandonnes, 1);
  // La reprise ne part PAS dans la foulée : elle attend qu'il redevienne
  // écrivable — sinon on écrirait dans un tampon déjà plein.
  flux.publier({ type: "collection", collection: "actes", revision: 4 });
  assert.equal(lent.evenements().length, 0, "la reprise elle-même échoue : on n'insiste pas");
  assert.equal(flux.rendre(a.id), true, "le retour à l'écriture déclenche la reprise");
  const types = lent.evenements().map((e) => e.type);
  assert.ok(types.includes("resync"), "il doit relire tout ce qu'il a manqué");
  assert.equal(flux.rendre(a.id), false, "pas de reprise en double");
});

test("flux : une connexion morte est retirée, pas gardée en vie", () => {
  const flux = creerFlux();
  const mort = {
    ecrire() { throw new Error("EPIPE"); },
    fermer() {},
  };
  flux.abonner(mort);
  const vivant = abonneMemoire();
  flux.abonner(vivant);
  flux.publier({ type: "collection", collection: "presence", revision: 1 });
  assert.equal(flux.compter(), 1, "l'abonné qui lève est retiré");
  assert.equal(vivant.evenements().length, 1);
});

test("flux : le service refuse au-delà de sa borne, sans casser ceux qui écoutent", () => {
  const flux = creerFlux({ max: 2 });
  const a = flux.abonner(abonneMemoire());
  const b = flux.abonner(abonneMemoire());
  const c = flux.abonner(abonneMemoire());
  assert.ok(a && b);
  assert.equal(c, null, "au-delà de la borne, l'abonné est refusé (le poste retombera sur le sondage)");
  a.retirer();
  assert.ok(flux.abonner(abonneMemoire()), "une place libérée se reprend");
});

test("flux : le battement est un commentaire, pas un évènement", () => {
  const flux = creerFlux();
  const a = abonneMemoire();
  flux.abonner(a);
  flux.battement();
  assert.equal(a.evenements().length, 0, "un battement ne réveille aucun traitement");
  assert.ok(a.recu.join("").startsWith(": battement"), "c'est un commentaire SSE");
});

test("flux : le flux ne transporte AUCUN contenu", () => {
  const flux = creerFlux();
  const a = abonneMemoire();
  flux.abonner(a);
  // Ce que le service publie ne doit porter que des repères : la collection, la
  // révision, le nombre d'enregistrements touchés, leurs identifiants. Jamais
  // une valeur — c'est ce qui rend le flux inoffensif s'il est intercepté.
  flux.publier({ type: "collection", collection: "actes", revision: 7, n: 2, ids: ["acte-1", "acte-2"] });
  const ev = a.evenements()[0];
  assert.deepEqual(Object.keys(ev).sort(), ["collection", "ids", "n", "revision", "type"]);
  assert.equal(JSON.stringify(ev).includes("payload"), false);
  assert.equal(JSON.stringify(ev).includes("valeurs"), false);
});

test("flux : fermer tous les abonnés ferme vraiment", () => {
  const flux = creerFlux();
  const a = abonneMemoire();
  const b = abonneMemoire();
  flux.abonner(a);
  flux.abonner(b);
  assert.equal(flux.fermerTous(), 2);
  assert.equal(a.ferme, true);
  assert.equal(b.ferme, true);
  assert.equal(flux.compter(), 0);
});
