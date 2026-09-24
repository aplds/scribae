// ============================================================================
// L'OUTILLAGE ÉPROUVÉ SUR LA DISPOSITION LIVRÉE.
//
// Pourquoi ce fichier existe. Le contrôle de style a été longtemps vert dans la
// copie de travail et rouge dans le dépôt livré — sans qu'une seule règle ait
// changé. La cause n'était pas dans une règle mais dans le CHEMIN des fichiers :
// l'outillage vivait alors sous `src/`, les exemptions étaient écrites pour une
// racine nue (`scripts/…`, `server/…`), et le parcours rendait des chemins
// préfixés par « ./ » qui ne correspondaient plus à aucune exemption. Résultat :
// les trois
// lignes du script qui citent le mot-clé de point d'arrêt (dans ses propres
// commentaires et dans sa règle) étaient comptées comme des erreurs — la règle
// censée les exempter ne les voyait plus —, le script sortait en code 1, et la
// chaîne d'intégration était rouge à chaque envoi (audit, NC-I-008, NC-I-009).
//
// Une faute de ce genre ne se voit PAS dans le code : elle se voit dans
// l'exécution. C'est donc l'exécution qu'on éprouve ici — le script lancé tel
// qu'il est livré, sur l'arborescence livrée.
//
// Le chemin du script est résolu depuis l'adresse de CE module, jamais depuis le
// répertoire courant : l'épreuve passe donc depuis n'importe quel dossier. Là où
// aucun processus enfant ne peut être lancé (harnais en navigateur, par
// exemple), l'épreuve est SAUTÉE plutôt que fausse : un environnement qui ne
// sait pas lancer Node ne prouve rien sur ce contrôle.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

function cheminScript(nom) {
  try { return fileURLToPath(new URL("../scripts/" + nom, import.meta.url)); }
  catch (e) { return null; }
}

function lancer(nomScript, args = []) {
  const chemin = cheminScript(nomScript);
  if (!chemin || typeof process === "undefined" || !process.execPath) return null;
  return spawnSync(process.execPath, [chemin, ...args], { encoding: "utf8" });
}

const SKIP = "aucun processus enfant accessible ici";

test("le contrôle de style passe sur la disposition livrée", (ctx) => {
  const res = lancer("verifier-style.mjs");
  if (!res || res.status === null) return ctx.skip(SKIP);
  assert.equal(res.status, 0, "le contrôle de style doit sortir en 0 :\n" + res.stdout + res.stderr);
});

test("le contrôle de style passe aussi en mode strict", (ctx) => {
  const res = lancer("verifier-style.mjs", ["--strict"]);
  if (!res || res.status === null) return ctx.skip(SKIP);
  assert.equal(res.status, 0, "aucun avertissement n'est toléré en mode strict :\n" + res.stdout + res.stderr);
});

test("le contrôle de style voit bien tout le code", (ctx) => {
  const res = lancer("verifier-style.mjs");
  if (!res || res.status === null) return ctx.skip(SKIP);
  // Un parcours qui ne trouve aucun fichier sortirait lui aussi en 0 : le
  // décompte est donc la garde qui manquait.
  const vu = /(\d+) fichier\(s\)/.exec(res.stdout || "");
  assert.ok(vu, "le rapport doit annoncer le nombre de fichiers analysés :\n" + res.stdout);
  assert.ok(Number(vu[1]) >= 100, "le parcours doit voir tout le code (vu : " + vu[1] + " fichiers)");
});

// ----------------------------------------------------------------------------
// LA FAÇADE SERT-ELLE LES MODULES QUE LE CLIENT IMPORTE ?
//
// L'épreuve naît d'une panne réelle, et d'une panne SILENCIEUSE : sur une
// installation auto-hébergée, la façade servait les modules `.mjs` en
// `application/octet-stream` — la table des types d'nginx (`mime.types`) ne
// connaît que `js`. Le navigateur REFUSE d'exécuter un module dont le type MIME
// n'est pas du JavaScript (le contrôle est strict pour les modules ES), le
// graphe d'imports cassait en amont, `app.js` ne s'exécutait jamais, et la page
// restait BLANCHE : rien à l'écran, rien dans le journal de nginx, qui répondait
// `200` pour un fichier simplement mal étiqueté (voir le CHANGELOG, 1.6.1o).
//
// L'épreuve tient donc la règle qui manquait : si le CLIENT importe un module
// d'une extension que nginx ne sert pas en JavaScript, la façade doit la
// déclarer. Elle ne compare pas des listes figées : elle lit les extensions
// réellement importées par le code client, et exige que `nginx.conf` — et la
// variante autonome — les servent en `application/javascript`.
//
// Là où le dépôt n'est pas lisible (harnais en navigateur), l'épreuve est
// SAUTÉE : un environnement qui ne sait pas lire ces fichiers ne prouve rien.
const RACINE_TEST = (() => {
  try { return fileURLToPath(new URL("..", import.meta.url)); }
  catch (e) { return null; }
})();

// Le code vit sous `src/` à la racine du dépôt livré, et à la racine de
// l'outillage dans l'atelier (voir tests/README.md) : on essaie les deux
// préfixes plutôt que d'en figer un, et les appels n'ont pas à s'en soucier.
async function lire(chemin) {
  if (!RACINE_TEST) return null;
  for (const prefixe of ["src/", ""]) {
    try { return await readFile(fileURLToPath(new URL(prefixe + chemin, new URL("..", import.meta.url))), "utf8"); }
    catch (e) { /* préfixe suivant */ }
  }
  return null;
}

test("la façade sert en JavaScript les extensions que le client importe", async (ctx) => {
  if (!RACINE_TEST) return ctx.skip(SKIP);
  // Les modules CLIENT (le navigateur) : ceux du service ne sont pas servis par
  // la façade, et leurs `import` de Node ne regardent pas une extension.
  const client = ["lib/chats-erreur.js", "lib/signature.js", "lib/db/index.js"];
  let sources, confs;
  try {
    sources = await Promise.all(client.map((f) => lire(f)));
    confs = await Promise.all([
      lire("server/nginx.conf"),
      lire("server/nginx.standalone.conf"),
    ]);
  } catch (e) { return ctx.skip(SKIP); }
  if (sources.some((s) => s === null) || confs.some((c) => c === null)) return ctx.skip(SKIP);

  // Les extensions importées EN RELATIF par le client, hors `.js` (servi par la
  // table des types d'nginx) : c'est là que le piège se referme.
  const extensions = new Set();
  for (const source of sources) {
    const re = /from\s*["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(source))) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue;
      const ext = (/\.([a-z0-9]+)$/i.exec(spec) || [])[1];
      if (ext && ext !== "js") extensions.add(ext);
    }
  }
  assert.ok(extensions.size, "l'épreuve doit trouver au moins une extension non-`js` importée par le client (sinon elle ne prouve rien)");

  for (const [nom, conf] of [["nginx.conf", confs[0]], ["nginx.standalone.conf", confs[1]]]) {
    for (const ext of extensions) {
      // La déclaration attendue : l'extension nommée dans un `location`, et un
      // type JavaScript à proximité (les deux écritures admises : `application/`
      // ou `text/javascript`).
      const bloc = new RegExp("(^|[^\\w])\\." + ext + "\\b[\\s\\S]{0,240}?javascript");
      assert.match(conf, bloc, `${nom} doit servir les « .${ext} » en JavaScript (le navigateur refuse un module servi en application/octet-stream : la page reste blanche)`);
    }
  }
});
