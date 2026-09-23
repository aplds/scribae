// ============================================================================
// Épreuves des adresses IP (`ips.mjs`) : lecture d'une adresse, d'une entrée de
// liste blanche (adresse, CIDR, champ, plage abrégée), et décision d'accès.
//
//   node --test src/server/mysql/
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  lireAdresse, ecrireAdresse, estAdresse, lireEntree, lireListe, lireListeBrute,
  autorisee, autoriseeDans, resumeListe, estInterne, adresseDeLEntete,
} from "./ips.mjs";

// ------------------------------------------------------------------- adresses

test("les adresses IPv4 se lisent et s'écrivent", () => {
  assert.equal(ecrireAdresse("192.168.001.024"), "192.168.1.24");
  assert.equal(ecrireAdresse("0.0.0.0"), "0.0.0.0");
  assert.equal(ecrireAdresse("255.255.255.255"), "255.255.255.255");
  assert.equal(ecrireAdresse("256.1.1.1"), "");
  assert.equal(ecrireAdresse("192.168.1"), "");
  assert.equal(ecrireAdresse("192.168.1.1.1"), "");
});

test("les adresses IPv6 se lisent et s'écrivent, forme comprimée comprise", () => {
  assert.equal(ecrireAdresse("2001:0db8:0000:0000:0000:0000:0000:0001"), "2001:db8::1");
  assert.equal(ecrireAdresse("2001:db8::1"), "2001:db8::1");
  assert.equal(ecrireAdresse("::1"), "::1");
  assert.equal(ecrireAdresse("::"), "::");
  assert.equal(ecrireAdresse("fe80::1"), "fe80::1");
  assert.equal(ecrireAdresse("2001:db8::1::2"), "");
});

test("une adresse IPv4 écrite à la mode IPv6 désigne la même adresse", () => {
  assert.equal(ecrireAdresse("::ffff:192.168.1.24"), "192.168.1.24");
  assert.equal(ecrireAdresse("::ffff:c0a8:118"), "192.168.1.24");
  assert.deepEqual(lireAdresse("::ffff:10.0.0.1"), lireAdresse("10.0.0.1"));
});

test("estAdresse refuse ce qui n'est pas une adresse", () => {
  assert.equal(estAdresse("192.168.1.1"), true);
  assert.equal(estAdresse("intranet"), false);
  assert.equal(estAdresse("", ), false);
  assert.equal(estAdresse(null), false);
  assert.equal(estAdresse("10.0.0.*"), false);
});

// --------------------------------------------------------------------- entrées

test("une entrée seule se lit comme un champ d'une adresse", () => {
  const e = lireEntree(" 192.168.1.24 ");
  assert.equal(e.libelle, "192.168.1.24");
  assert.equal(e.bits, 32);
  assert.equal(e.debut, e.fin);
});

test("un préfixe CIDR couvre exactement son réseau", () => {
  assert.equal(lireEntree("192.168.0.0/16").libelle, "192.168.0.0/16");
  // Une adresse d'hôte est ramenée à son réseau : « 192.168.1.24/16 » vaut
  // « 192.168.0.0/16 », comme le veut la notation CIDR.
  assert.equal(lireEntree("192.168.1.24/16").libelle, "192.168.0.0/16");
  assert.equal(lireEntree("10.0.0.0/8").fin - lireEntree("10.0.0.0/8").debut, 16777215n);
  assert.equal(lireEntree("0.0.0.0/0").libelle, "0.0.0.0/0");
  assert.equal(lireEntree("2001:db8::/32").libelle, "2001:db8::/32");
});

test("un champ d'adresses va de borne à borne", () => {
  const e = lireEntree("10.0.0.0-10.0.0.255");
  assert.equal(e.libelle, "10.0.0.0-10.0.0.255");
  assert.equal(e.debut + 255n, e.fin);
  assert.ok(lireEntree("10.0.0.255-10.0.0.0").erreur);
  assert.ok(lireEntree("10.0.0.0-2001:db8::1").erreur);
  assert.ok(lireEntree("10.0.0.0-nord").erreur);
});

test("une plage abrégée vaut le champ qu'elle couvre", () => {
  assert.equal(lireEntree("10.0.0.*").libelle, "10.0.0.0-10.0.0.255");
  assert.equal(lireEntree("192.168.*.*").libelle, "192.168.0.0-192.168.255.255");
  // Le nombre d'octets FIXES donne la largeur, les étoiles couvrent le reste :
  // « 10.* » et « 10.*.* » décrivent le même champ.
  assert.equal(lireEntree("10.*").libelle, "10.0.0.0-10.255.255.255");
  assert.equal(lireEntree("10.*.*").libelle, "10.0.0.0-10.255.255.255");
  assert.ok(lireEntree("10.0.0.1*").erreur);
  assert.ok(lireEntree("10.*.0.*").erreur);
  assert.ok(lireEntree("*").erreur);
});

test("une entrée incomprise est rendue comme erreur, jamais ignorée", () => {
  assert.ok(lireEntree("nord").erreur);
  assert.ok(lireEntree("300.1.1.1").erreur);
  assert.ok(lireEntree("10.0.0.0/33").erreur);
  assert.ok(lireEntree("2001:db8::/129").erreur);
  assert.ok(lireEntree("10.0.0.0/abc").erreur);
  assert.equal(lireEntree("   # commentaire"), null);
  assert.equal(lireEntree(""), null);
});

// ---------------------------------------------------------------------- listes

test("une liste se découpe sur les virgules, les points-virgules et les retours", () => {
  const { entrees, erreurs } = lireListe("10.0.0.0/8, 192.168.1.24; 172.16.0.0-172.16.0.9\n::1");
  assert.equal(entrees.length, 4);
  assert.equal(erreurs.length, 0);
});

test("une liste signale ses fautes sans perdre ses entrées valides", () => {
  const { entrees, erreurs } = lireListe("10.0.0.0/8, nord, 192.168.1.1");
  assert.equal(entrees.length, 2);
  assert.equal(erreurs.length, 1);
  assert.equal(erreurs[0].entree, "nord");
});

test("un commentaire derrière une entrée est ignoré", () => {
  const { entrees } = lireListe("10.0.0.0/8 # le siège, 192.168.1.0/24 # l'annexe");
  assert.equal(entrees.length, 2);
  assert.equal(entrees[0].libelle, "10.0.0.0/8");
});

test("lireListeBrute garde l'écriture de l'exploitant", () => {
  const { retenues, erreurs } = lireListeBrute(["10.0.0.*", "192.168.1.24"]);
  assert.deepEqual(retenues.map((r) => r.texte), ["10.0.0.*", "192.168.1.24"]);
  assert.equal(retenues[0].libelle, "10.0.0.0-10.0.0.255");
  assert.equal(erreurs.length, 0);
});

// ------------------------------------------------------------------ la question

test("l'adresse est reconnue dans les trois écritures, et refusée hors du champ", () => {
  const liste = lireListe("10.0.0.0/8, 192.168.0.0-192.168.0.255, 2001:db8::/32").entrees;
  assert.equal(autorisee("10.1.2.3", liste), true);
  assert.equal(autorisee("192.168.0.255", liste), true);
  assert.equal(autorisee("192.168.1.1", liste), false);
  assert.equal(autorisee("2001:db8::abcd", liste), true);
  assert.equal(autorisee("2001:db9::1", liste), false);
  assert.equal(autorisee("nord", liste), false);
});

test("une adresse IPv4 mappée est reconnue par une règle IPv4", () => {
  const liste = lireListe("10.0.0.0/8").entrees;
  assert.equal(autorisee("::ffff:10.1.2.3", liste), true);
});

test("autoriseeDans lit la forme du .env", () => {
  assert.equal(autoriseeDans("10.1.2.3", "10.0.0.0/8, 192.168.1.1"), true);
  assert.equal(autoriseeDans("8.8.8.8", "10.0.0.0/8"), false);
  assert.equal(autoriseeDans("10.1.2.3", ""), false);
  assert.equal(autoriseeDans("10.1.2.3", ["10.0.0.0/8"]), true);
});

test("le résumé dit l'absence de restriction plutôt que rien", () => {
  assert.equal(resumeListe(""), "aucune restriction d'adresse");
  assert.equal(resumeListe("10.0.0.0/8, 192.168.1.24"), "10.0.0.0/8, 192.168.1.24");
  assert.match(resumeListe("10.0.0.0/8, nord"), /1 entrée\(s\) refusée\(s\)/);
});

// --------------------------------------------------------------- espaces privés

test("les espaces réservés sont reconnus", () => {
  for (const ip of ["10.1.2.3", "172.16.0.1", "172.31.255.254", "192.168.1.1", "127.0.0.1", "169.254.0.1", "100.64.0.1"]) {
    assert.equal(estInterne(ip), true, ip + " est un espace réservé");
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "192.169.0.1", "93.184.216.34"]) {
    assert.equal(estInterne(ip), false, ip + " est publique");
  }
  assert.equal(estInterne("fc00::1"), true);
  assert.equal(estInterne("fe80::1"), true);
  assert.equal(estInterne("2001:db8::1"), false);
});

// -------------------------------------------------------- adresse de l'appelant

test("l'adresse vient de X-Forwarded-For, sinon de la prise", () => {
  assert.equal(adresseDeLEntete({ "x-forwarded-for": "10.0.0.1, 172.16.0.1" }, "127.0.0.1"), "10.0.0.1");
  assert.equal(adresseDeLEntete({}, "192.168.1.24"), "192.168.1.24");
  assert.equal(adresseDeLEntete({}, "::ffff:10.0.0.1"), "10.0.0.1");
  assert.equal(adresseDeLEntete({}, ""), "");
});
