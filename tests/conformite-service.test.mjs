// ============================================================================
// LA CONFORMITÉ DES DEUX SERVICES, éprouvée — `node --test`.
//
// Le jeu d'appels vit dans `tests/conformite-service.mjs`, une seule fois
// pour les deux implémentations (écart NC-I-010). Ici, on l'exécute contre le
// service de DÉMONSTRATION, chargé en mémoire depuis `index.html` — le script
// `text/x-server-plugin` est du JavaScript ordinaire, et il s'instancie sans
// navigateur (il reçoit son état durable en argument). Aucune base, aucun
// réseau, aucun secret : c'est ce qui rend l'épreuve exécutable partout, à
// commencer par la chaîne d'intégration.
//
// Contre une installation AUTO-HÉBERGÉE, le même jeu s'exécute en donnant son
// adresse : `SCRIBA_CONFORMITE_URL=https://recueil.exemple.fr npm test`. Les
// deux relevés sont alors comparés appel par appel, et tout écart est signalé —
// c'est le contrôle qui manquait pour que les deux services ne dérivent pas
// l'un de l'autre sans que personne ne le voie.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { APPELS, verifier, comparer } from "./conformite-service.mjs";

// Le fichier de la page : à la racine du dépôt, donc dans le dossier COURANT
// (les commandes s'exécutent depuis la racine). Les autres essais couvrent une
// exécution lancée d'ailleurs.
const CHEMINS_INDEX = ["index.html", "../../index.html", "../index.html"];

async function lireIndex() {
  let readFile = null;
  try { ({ readFile } = await import("node:fs/promises")); } catch (e) { readFile = null; }
  if (typeof readFile !== "function") return null;
  for (const chemin of CHEMINS_INDEX) {
    try { return await readFile(chemin, "utf8"); } catch (e) { /* on essaie le suivant */ }
  }
  return null;
}

// Le service de démonstration, instancié comme le fait `src/pages/host.js` :
// on relit le script `text/x-server-plugin` de la page et on l'exécute avec un
// `self` local et son état durable.
function instancierServiceDemo(html) {
  const m = String(html || "").match(/<script[^>]*type="text\/x-server-plugin"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("le script du service de démonstration est introuvable dans index.html");
  const boite = {};
  const etat = new Uint8Array(8000004 + 2);
  const rpc = new Function("state", "self", m[1] + "\n;return self.rpc;")(etat, boite);
  if (!rpc || typeof rpc.api !== "function") throw new Error("le service de démonstration ne rend pas son API");
  return rpc;
}

// Le transport du service de démonstration : ses échanges sont SYNCHRONES (le
// service répond dans l'appel), on en fait une promesse pour la forme.
const transportDemo = (rpc) => async (methode, chemin, corps) => {
  const brut = rpc.api(null, JSON.stringify({ method: methode, path: chemin, headers: {}, body: corps === undefined ? null : corps }));
  const r = JSON.parse(brut);
  return { status: r.status, body: r.body };
};

// Le transport d'une installation auto-hébergée : de simples appels HTTP.
const transportHttp = (base) => async (methode, chemin, corps) => {
  const res = await fetch(String(base).replace(/\/+$/, "") + chemin, {
    method: methode,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  let body = null;
  try { body = await res.json(); } catch (e) { body = null; }
  return { status: res.status, body };
};

// Ce qu'un échec doit dire : l'appel, ce qui était attendu, ce qui est venu.
const detail = (r) => `${r.id} (${r.statut === null ? "aucune réponse" : r.statut}) : ${r.raison} — ${r.pourquoi || ""}`;

let rpcDemo = null;
test("le service de démonstration respecte le contrat commun", async () => {
  const html = await lireIndex();
  if (!html) return;                       // hors du dépôt : rien à éprouver ici
  rpcDemo = instancierServiceDemo(html);
  const releve = await verifier(transportDemo(rpcDemo), { nom: "démonstration" });
  assert.equal(releve.echecs.length, 0, "écarts de conformité :\n  - " + releve.echecs.map(detail).join("\n  - "));
  assert.equal(releve.total, APPELS.length);
});

test("le jeu d'appels couvre bien le contrat, frontières comprises", () => {
  // Un jeu qui ne vérifierait plus rien passerait au vert : on exige donc
  // quelques appels qui ne peuvent pas disparaître sans que l'on s'en aperçoive.
  const ids = APPELS.map((a) => a.id);
  for (const requis of ["health", "publications", "publication-inconnue", "depublication", "ecriture-sans-cle", "comptes-sans-cle"]) {
    assert.ok(ids.includes(requis), `l'appel « ${requis} » manque au jeu de conformité`);
  }
  assert.ok(APPELS.length >= 12, `le jeu doit couvrir le contrat (${APPELS.length} appels)`);
});

const url = (typeof process !== "undefined" && process.env && process.env.SCRIBA_CONFORMITE_URL) || "";
test("une installation auto-hébergée répond le même contrat que la démonstration", async (t) => {
  if (!url) return t.skip("SCRIBA_CONFORMITE_URL n'est pas renseignée : rien à comparer");
  if (!rpcDemo) rpcDemo = instancierServiceDemo(await lireIndex());
  const [a, b] = await Promise.all([
    verifier(transportDemo(rpcDemo), { nom: "démonstration" }),
    verifier(transportHttp(url), { nom: "auto-hébergée" }),
  ]);
  assert.equal(b.echecs.length, 0, "l'installation auto-hébergée s'écarte du contrat :\n  - " + b.echecs.map(detail).join("\n  - "));
  const ecarts = comparer(a, b);
  assert.equal(ecarts.length, 0, "les deux installations divergent :\n  - " + ecarts.map((e) => `${e.id} : démonstration ${e.a}, auto-hébergée ${e.b} (${e.raison})`).join("\n  - "));
});
