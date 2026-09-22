// ============================================================================
// Tests des en-têtes HTTP.
//
//   node --test          (ou: npm test)
//
// Le service est tombé en boucle de redémarrage parce qu'un en-tête portait un
// tiret cadratin : Node REFUSE tout caractère non ASCII dans une valeur
// d'en-tête (`ERR_INVALID_CHAR`), l'exception n'était rattrapée nulle part, et
// le processus sortait. Ces tests tiennent les deux protections : l'écartement
// des valeurs douteuses, et le repli qui empêche l'exception de remonter.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { SERVICE_ID, entetesSurs, ecrireEntetes } from "./entetes.mjs";

// Un `ServerResponse` factice : on décide combien de fois `writeHead` lève, et
// on peut vérifier ce qui a été écrit — sans socket, sans réseau.
function fauxRes({ echecs = 0 } = {}) {
  return {
    headersSent: false,
    writableEnded: false,
    dit: null,
    detruit: false,
    appels: 0,
    writeHead(status, entetes) {
      this.appels += 1;
      if (this.appels <= echecs) {
        throw new TypeError("Invalid character in header content ['x-service']");
      }
      this.headersSent = true;
      this.dit = { status, entetes };
    },
    destroy() { this.detruit = true; },
  };
}

const noter = () => {
  const notes = [];
  return { notes, journal: (m) => notes.push(m) };
};

test("le jeton d'en-tête du service est un « token » ASCII", () => {
  // Un « token » RFC 7230 : ni espace, ni accent, ni tiret cadratin.
  assert.match(SERVICE_ID, /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/);
  assert.match(SERVICE_ID, /^[\x20-\x7e]+$/);
});

test("une valeur non ASCII est écartée, jamais transmise", () => {
  const { notes, journal } = noter();
  const surs = entetesSurs({
    "x-service": "Scribae — service de la collectivité",
    "content-type": "application/json; charset=utf-8",
  }, { journal });
  assert.equal(surs["x-service"], undefined);
  assert.equal(surs["content-type"], "application/json; charset=utf-8");
  assert.equal(notes.length, 1);
  assert.match(notes[0], /x-service/);
});

test("une origine de requête fantaisiste ne peut pas atteindre l'en-tête", () => {
  const { notes, journal } = noter();
  const surs = entetesSurs({ "access-control-allow-origin": "https://exemple.fr/\u2014" }, { journal });
  assert.deepEqual(surs, {});
  assert.equal(notes.length, 1);
});

test("une valeur de contrôle (retour à la ligne) est écartée", () => {
  const { journal } = noter();
  assert.deepEqual(entetesSurs({ "x-essai": "a\r\nx-injecte: 1" }, { journal }), {});
});

test("un en-tête refusé n'abat pas la réponse : repli sur le minimum", () => {
  const { notes, journal } = noter();
  const res = fauxRes({ echecs: 1 });
  const rendu = ecrireEntetes(res, 200, { "x-service": "ok" }, { journal });
  assert.equal(rendu, true);
  assert.equal(res.headersSent, true);
  assert.equal(res.appels, 2, "writeHead a été retenté");
  assert.equal(res.dit.entetes["content-type"], "application/json; charset=utf-8");
  assert.equal(res.dit.entetes["x-service"], undefined, "le repli ne reprend pas l'en-tête fautif");
  assert.equal(notes.length, 1);
  assert.equal(res.detruit, false);
});

test("même quand le repli échoue, rien n'est levé et la socket est détruite", () => {
  const { notes, journal } = noter();
  const res = fauxRes({ echecs: 99 });
  let rendu;
  assert.doesNotThrow(() => { rendu = ecrireEntetes(res, 200, { "x-service": "ok" }, { journal }); });
  assert.equal(rendu, false);
  assert.equal(res.detruit, true);
  assert.equal(notes.length, 2);
});

test("aucune valeur valide n'est modifiée au passage", () => {
  const { journal } = noter();
  const entetes = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=300",
    "set-cookie": "scribae_session=abc; Path=/; HttpOnly; SameSite=Lax",
    "retry-after": "60",
  };
  assert.deepEqual(entetesSurs(entetes, { journal }), entetes);
});
