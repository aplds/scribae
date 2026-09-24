// ============================================================================
// Épreuves des chats de pages d'erreur (`chats-erreur.mjs`).
//
//   node --test src/server/mysql/
//
// Le module est PUR : il ne touche ni au disque ni au réseau, et se laisse donc
// éprouver entièrement hors ligne. Ce qui compte ici est le REPLI : une page ne
// doit jamais lier une adresse de http.cat qui rendrait autre chose que le code
// annoncé — un 404 de http.cat sur une page 403, par exemple, serait un
// mensonge. C'est cette règle-là que l'on vérifie.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";

import { CHAT_SOURCE, CODES_CHAT, codeChat, urlChat, chatPour } from "./chats-erreur.mjs";

test("le catalogue des codes publiés est cohérent", () => {
  assert.ok(CODES_CHAT.length > 50, "le relevé de http.cat porte bien des dizaines de codes");
  assert.deepEqual([...CODES_CHAT].sort((a, b) => a - b), CODES_CHAT, "le catalogue est trié");
  assert.equal(new Set(CODES_CHAT).size, CODES_CHAT.length, "aucun code n'est écrit deux fois");
  // Les codes que NOUS servons vraiment : s'ils disparaissaient du relevé, le
  // repli les remplacerait en silence, et l'illustration changerait de sens.
  for (const c of [400, 403, 404, 500, 503]) assert.ok(CODES_CHAT.includes(c), `le code ${c} est publié`);
});

test("un code publié est servi tel quel", () => {
  assert.equal(codeChat(404), 404);
  assert.equal(codeChat(403), 403);
  assert.equal(codeChat(503), 503);
  assert.equal(codeChat("404"), 404, "une chaîne numérique se lit comme un nombre");
  assert.equal(codeChat(404.9), 404, "un code décimal est tronqué");
});

test("un code non publié tombe sur le représentant de sa classe", () => {
  // 299 n'existe pas chez http.cat ; 200, oui.
  assert.equal(codeChat(299), 200);
  assert.equal(codeChat(207), 207, "207 existe : il n'est pas replié");
  assert.equal(codeChat(431), 431);
  assert.equal(codeChat(432), 400, "un 4xx absent tombe sur le 400");
  assert.equal(codeChat(505), 500, "un 5xx absent tombe sur le 500");
  assert.equal(codeChat(199), 100);
  assert.equal(codeChat(399), 300);
});

test("hors des bornes HTTP, il n'y a pas d'image du tout", () => {
  assert.equal(codeChat(99), null);
  assert.equal(codeChat(600), null);
  assert.equal(codeChat(999), null, "http.cat rendrait SON 404 : on ne lie rien");
  assert.equal(codeChat(0), null, "le fichier « 0 » existe, mais 0 n'est pas un code d'erreur");
  assert.equal(codeChat(-1), null);
  assert.equal(codeChat(""), null);
  assert.equal(codeChat("abc"), null);
  assert.equal(codeChat(null), null);
  assert.equal(codeChat(undefined), null);
  assert.equal(codeChat(NaN), null);
  assert.equal(codeChat(Infinity), null);
});

test("l'adresse lie le code EFFECTIVEMENT servi", () => {
  assert.equal(urlChat(404), "https://http.cat/404");
  assert.equal(urlChat(299), "https://http.cat/200", "l'adresse porte le code replié");
  assert.equal(urlChat(999), null);
  assert.equal(CHAT_SOURCE, "https://http.cat");
});

test("chatPour rend ce qu'une page d'erreur doit dire", () => {
  const chat = chatPour(404);
  assert.equal(chat.code, 404);
  assert.equal(chat.affiche, 404);
  assert.equal(chat.url, "https://http.cat/404");
  assert.equal(chat.source, CHAT_SOURCE);
  assert.match(chat.alt, /404/, "le texte de remplacement nomme l'erreur");
  assert.equal(chat.legende, "Page introuvable");
  // Le code AFFICHÉ reste celui de la page, même quand l'image est repliée : le
  // lecteur lit « 299 », l'image illustre un 200 — c'est la page qui a raison.
  const replie = chatPour(299);
  assert.equal(replie.code, 200);
  assert.equal(replie.affiche, 299);
  assert.equal(chatPour(999), null);
});

test("chatPour laisse une page dire sa propre légende et son propre alt", () => {
  const chat = chatPour(503, { legende: "Service momentanément indisponible", alt: "Chat endormi" });
  assert.equal(chat.legende, "Service momentanément indisponible");
  assert.equal(chat.alt, "Chat endormi");
  // Un code sans légende écrite reçoit une légende neutre, jamais rien.
  const sansLegende = chatPour(507);
  assert.equal(sansLegende.legende, "Erreur 507");
});

test("tous les codes publiés rendent une légende non vide", () => {
  for (const c of CODES_CHAT) {
    if (c === 0) continue; // le « 0 » du catalogue n'est pas une erreur de page
    const chat = chatPour(c);
    assert.ok(chat && chat.legende && chat.url, `le code ${c} rend une figure complète`);
  }
});
