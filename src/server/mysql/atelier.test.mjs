// ============================================================================
// Épreuves de l'accès à l'atelier (`atelier.mjs`) : d'où vient la liste, ce
// qu'elle autorise, et ce que l'on répond à qui n'a pas le droit d'entrer.
//
//   node --test src/server/mysql/
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";

import { listeRetenue, etat, corpsRefus, resume, CLE_IPS, CLE_MESSAGE, MESSAGE_DEFAUT } from "./atelier.mjs";

test("sans liste, l'atelier est ouvert — et l'état le dit", () => {
  const e = etat({ ip: "203.0.113.9" });
  assert.equal(e.actif, false);
  assert.equal(e.autorise, true);
  assert.equal(e.source, "");
});

test("la liste du déploiement l'emporte sur celle du référentiel", () => {
  const e = etat({ ip: "10.1.2.3", ipsDeploiement: "10.0.0.0/8", ipsReferentiel: "192.168.1.0/24" });
  assert.equal(e.actif, true);
  assert.equal(e.autorise, true);
  assert.equal(e.source, "deploiement");
  assert.deepEqual(e.liste, ["10.0.0.0/8"]);
});

test("le référentiel sert quand le déploiement ne dit rien", () => {
  const e = etat({ ip: "192.168.1.5", ipsReferentiel: ["192.168.1.0/24"] });
  assert.equal(e.actif, true);
  assert.equal(e.autorise, true);
  assert.equal(e.source, "referentiel");
  assert.equal(e.interne, true);
});

test("une liste fautive est rapportée, et FERME l'atelier", () => {
  // Le déploiement a écrit quelque chose : même illisible, il ne doit pas être
  // écarté au profit du référentiel — sinon la restriction disparaîtrait sans
  // que personne ne le sache. Et surtout, il ne doit pas laisser l'atelier
  // OUVERT : une faute de frappe dans la liste blanche ferme la porte, elle ne
  // l'ouvre pas. C'est la règle du « fail-closed », et elle se vérifie ici.
  const e = etat({ ip: "10.0.0.1", ipsDeploiement: "nord", ipsReferentiel: "10.0.0.0/8" });
  assert.equal(e.source, "deploiement");
  assert.equal(e.actif, true);
  assert.equal(e.autorise, false, "aucune adresse n'entre dans un atelier dont la liste est illisible");
  assert.equal(e.liste.length, 0);
  assert.equal(e.erreurs.length, 1);
  assert.equal(e.erreurs[0].entree, "nord");
});

test("une entrée valide suffit à restreindre, les fautes restent visibles", () => {
  const e = etat({ ip: "8.8.8.8", ipsDeploiement: ["10.0.0.0/8", "nord"] });
  assert.equal(e.actif, true);
  assert.equal(e.autorise, false);
  assert.equal(e.erreurs.length, 1);
});

test("l'état nomme la règle qui autorise, et se tait quand elle refuse", () => {
  const e = etat({ ip: "10.1.2.3", ipsReferentiel: "192.168.1.0/24, 10.0.0.0/8" });
  assert.equal(e.autorise, true);
  assert.equal(e.regle, "10.0.0.0/8");
  const r = etat({ ip: "8.8.8.8", ipsReferentiel: "10.0.0.0/8" });
  assert.equal(r.autorise, false);
  assert.equal(r.regle, "");
  // Sans restriction, il n'y a pas de règle à montrer : l'accès n'en a pas.
  assert.equal(etat({ ip: "8.8.8.8" }).regle, "");
});

test("l'état dit si l'adresse est seulement LISIBLE", () => {
  // Le simulateur s'appuie là-dessus : « Refusée » pour « n'importe quoi »
  // ferait croire à une règle là où il n'y a qu'une faute de frappe.
  assert.equal(etat({ ip: "10.0.0.1" }).connue, true);
  assert.equal(etat({ ip: "2001:db8::1" }).connue, true);
  assert.equal(etat({ ip: "n'importe quoi" }).connue, false);
  assert.equal(etat({ ip: "" }).connue, false);
});

test("le message de refus est celui du réglage, sinon celui livré", () => {
  assert.equal(etat({ ip: "1.2.3.4", ipsDeploiement: "10.0.0.0/8", message: "  Passer par le VPN  " }).message, "Passer par le VPN");
  assert.equal(etat({ ip: "1.2.3.4", ipsDeploiement: "10.0.0.0/8" }).message, MESSAGE_DEFAUT);
});

test("le corps du refus est explicite, et ne dépend d'aucun secret", () => {
  const r = corpsRefus({ message: "Réseau interne", ip: "1.2.3.4", interne: false });
  assert.deepEqual(r, {
    erreur: "Réseau interne",
    code: "atelier_hors_reseau",
    ip: "1.2.3.4",
    interne: false,
    atelier: { actif: true, autorise: false },
  });
});

test("le résumé du démarrage dit l'état de la restriction", () => {
  assert.equal(resume(""), "Accès à l'atelier : ouvert (aucune restriction d'adresse).");
  assert.equal(resume("   # rien "), "Accès à l'atelier : ouvert (aucune restriction d'adresse).");
  assert.equal(resume("10.0.0.0/8, 192.168.1.*"), "Accès à l'atelier : restreint à 10.0.0.0/8, 192.168.1.*");
  assert.equal(resume("10.0.0.0/8", "Intranet"), "Accès à l'atelier : restreint à 10.0.0.0/8 — message : Intranet");
  // Une liste entièrement illisible FERME : le journal doit le crier, pas dire
  // « ouvert ».
  assert.match(resume("nord"), /^Accès à l'atelier : FERMÉ/);
  assert.match(resume("nord, 10.0.0.999"), /FERMÉ/);
});

test("les clés du registre sont celles que lisent le service et l'application", () => {
  assert.equal(CLE_IPS, "publication.atelier.ips");
  assert.equal(CLE_MESSAGE, "publication.atelier.message");
});

test("listeRetenue ne confond pas « rien demandé » et « illisible »", () => {
  assert.equal(listeRetenue("", "").demandee, false);
  assert.equal(listeRetenue("", "").entrees.length, 0);
  assert.equal(listeRetenue("   ", "  # rien   ").demandee, false, "un commentaire ne demande rien");
  assert.equal(listeRetenue("nord", "").demandee, true, "une entrée illisible est une liste DEMANDÉE");
  assert.equal(listeRetenue("nord", "").entrees.length, 0);
  assert.equal(listeRetenue("nord", "").erreurs.length, 1);
  assert.equal(listeRetenue("10.0.0.0/8", "").entrees.length, 1);
  assert.equal(listeRetenue("10.0.0.0/8", "").demandee, true);
});
