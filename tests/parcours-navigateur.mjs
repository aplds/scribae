// ============================================================================
// LES PARCOURS CRITIQUES, REJOUÉS EN INTÉGRATION CONTINUE.
//
//   node tests/parcours-navigateur.mjs
//
// POURQUOI CE FICHIER EXISTE (audit, NC-I-002). `tests/parcours.mjs` éprouve ce
// que l'utilisateur FAIT — ouvrir le recueil, se connecter, rédiger, publier,
// consulter —, sur l'application VIVANTE. Ces épreuves-là ne peuvent pas être
// jouées par `node --test` : elles ont besoin d'un DOM, d'une mise en page et
// d'un moteur de rendu. Jusqu'ici elles n'étaient donc jouées qu'à la main, dans
// l'aperçu de l'atelier — c'est-à-dire jamais au moment où elles servent : au
// moment de livrer. Les deux défauts qui ont fait écrire cette suite (le recueil
// qui reprenait la main sur l'atelier, la rubrique Informations qui
// disparaissait) étaient verts partout ailleurs, et cassés à l'écran.
//
// CE QUE FAIT CE SCRIPT. Il monte l'application en ÉDITION STATIQUE — le mode
// que sert GitHub Pages (voir `src/pages/host.js`) : le service de démonstration
// embarqué dans `index.html` est hébergé par la page elle-même, le stockage est
// IndexedDB —, ouvre un VRAI Chromium sans interface, ouvre une session
// d'administration, puis importe la suite de l'atelier (`tests/parcours.mjs`)
// et la joue. Aucune dépendance n'entre dans le dépôt : le script sert lui-même
// les fichiers du dépôt, avec les types MIME qu'un navigateur exige pour un
// module ES (une façade mal étiquetée laisse la page blanche — audit, NC-I-009).
//
// CE QU'IL FAUT POUR LE LANCER. Playwright, installé HORS VERROU (la CI le fait
// ainsi : le dépôt n'y gagne aucune dépendance, et `npm ci` reste reproductible) :
//
//   npm install --no-save --no-package-lock playwright@1.49.1
//   ./node_modules/.bin/playwright install --with-deps chromium
//   node tests/parcours-navigateur.mjs
//
// SON VERDICT. Code de sortie 1 dès qu'un parcours a échoué, et une ANNOTATION
// par échec (« ::error:: ») — pour la même raison que
// `scripts/annoncer-echecs.sh` : une chaîne rouge dont personne ne distingue la
// cause ne rend pas le service qu'une chaîne rend (NC-I-008). Il écrit aussi une
// capture d'écran (`parcours-echec.png`) quand quelque chose casse : c'est ce
// que lit un humain, et aucune annotation ne remplace une image.
// ============================================================================
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

// ------------------------------------------------------------------ la racine
// L'application est le dossier qui PORTE `index.html`. Deux dispositions
// existent, comme pour tout l'outillage de ce dépôt : le dépôt livré range le
// code sous `src/` et la page à sa racine (l'épreuve est alors `tests/…`) ;
// l'atelier range tout sous `src/` en laissant la page à la racine. On essaie
// les deux, et l'on garde celui qui porte la page — un chemin figé serait faux
// dans l'autre disposition (audit, NC-I-009).
const RACINE = await (async () => {
  for (const relatif of ["..", "../.."]) {
    const dossier = fileURLToPath(new URL(relatif + "/", import.meta.url));
    try { await stat(join(dossier, "index.html")); return dossier; }
    catch (e) { /* disposition suivante */ }
  }
  throw new Error("index.html introuvable : l'épreuve ne sait pas où est l'application.");
})();

// --------------------------------------------------------------- le serveur
// Ce que la page demande, et le type avec lequel un navigateur l'accepte. Le
// `.mjs` est le point sensible : servi en `application/octet-stream`, il est
// REFUSÉ comme module ES et la page reste blanche (voir le CHANGELOG 1.6.1o).
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".pdf": "application/pdf",
  ".akn": "application/akn+xml; charset=utf-8",
  ".zip": "application/zip",
};

// L'écoute est sur la BOUCLE LOCALE, et ce n'est pas un détail : `127.0.0.1`
// est un « contexte sûr » pour un navigateur, alors qu'une adresse de réseau ne
// l'est pas — sans quoi `crypto.subtle` serait absent, et tout ce qui calcule
// une empreinte (le dépôt, la signature, le scellement du journal) tomberait.
const site = await new Promise((resoudre, rejeter) => {
  const serveur = createServer(async (requete, reponse) => {
    try {
      const chemin = decodeURIComponent(new URL(requete.url, "http://127.0.0.1").pathname);
      const cible = normalize(join(RACINE, chemin.endsWith("/") ? chemin + "index.html" : chemin));
      if (!cible.startsWith(RACINE)) { reponse.writeHead(403); reponse.end("hors du dépôt"); return; }
      const info = await stat(cible);
      if (!info.isFile()) { reponse.writeHead(404); reponse.end("introuvable"); return; }
      const corps = await readFile(cible);
      reponse.writeHead(200, {
        "content-type": TYPES[extname(cible).toLowerCase()] || "application/octet-stream",
        "content-length": corps.length,
        "cache-control": "no-store",
      });
      reponse.end(corps);
    } catch (e) {
      reponse.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      reponse.end("introuvable");
    }
  });
  serveur.on("error", rejeter);
  serveur.listen(0, "127.0.0.1", () => resoudre({ serveur, base: "http://127.0.0.1:" + serveur.address().port }));
});

// ----------------------------------------------------------- playwright
async function chargerPlaywright() {
  try { return await import("playwright"); }
  catch (e) {
    throw new Error("Playwright est introuvable : installez-le hors verrou — "
      + "npm install --no-save --no-package-lock playwright@1.49.1, puis "
      + "./node_modules/.bin/playwright install --with-deps chromium");
  }
}

// ------------------------------------- ce qu'on injecte DANS la page
// Un module, injecté dans la page, parce que `import()` y résout ses adresses
// comme la page elle-même — et surtout parce que c'est LA MÊME instance des
// modules que celle de l'application (donc le même état). Il ouvre la session
// d'administration, puis joue la suite et dépose son relevé sur `window`.
// Le code est écrit en lignes plutôt qu'en gabarit : un accent grave dans un
// gabarit se lirait de travers, et cette panne-là est silencieuse.
const INJECTION = [
  "(async () => {",
  "  const pause = (ms) => new Promise((r) => setTimeout(r, ms));",
  "  const poser = (v) => { window.__scribaeParcours = v; };",
  "  try {",
  "    const m = await import('/src/ui/state.js');",
  "    for (let i = 0; i < 240 && !m.state.ready; i += 1) await pause(250);",
  "    if (!m.state.ready) throw new Error('application non prete : state.ready reste faux');",
  "    const comptes = (m.state.users || []).filter((u) => u.active !== false);",
  "    const admin = comptes.find((u) => (u.roles || []).indexOf('administrateur') >= 0);",
  "    const cible = admin || comptes[0] || null;",
  "    if (!cible) throw new Error('aucun compte au referentiel : la demonstration n a pas ete semee');",
  "    if (!m.state.user) {",
  "      const ouvert = await m.login(cible.id);",
  "      if (!ouvert) throw new Error('la session d administration ne s est pas ouverte pour ' + cible.id);",
  "    }",
  "    for (let i = 0; i < 160 && !m.state.user; i += 1) await pause(250);",
  "    if (!m.state.user) throw new Error('aucune session ouverte apres login : les parcours seraient tous « sans objet »');",
  "    for (let i = 0; i < 160 && !document.querySelector('.app-header'); i += 1) await pause(250);",
  "    let p = null; let dernier = null;",
  "    for (const chemin of ['/src/tests/parcours.mjs', '/tests/parcours.mjs']) {",
  "      try { p = await import(chemin); break; } catch (e) { dernier = e; }",
  "    }",
  "    if (!p) throw new Error('la suite de parcours est introuvable — ' + String((dernier && dernier.message) || dernier));",
  "    const ctx = await p.contexteDeLApercu();",
  "    const releve = await p.lancerParcours(ctx);",
  "    poser({",
  "      session: { id: m.state.user.id, login: m.state.user.login || '', roles: m.state.user.roles || [] },",
  "      releve,",
  "    });",
  "  } catch (e) { poser({ erreur: String((e && e.stack) || e) }); }",
  "})();",
].join("\n");

// L'échappement attendu par la commande de workflow : `%` d'abord, puis les
// caractères de contrôle. Une annotation est publique, et c'est par elle que la
// cause d'un échec se lit sans avoir accès au journal.
const echapper = (texte) => String(texte)
  .replace(/%/g, "%25")
  .replace(/\r/g, "%0D")
  .replace(/\n/g, "%0A")
  .slice(0, 1400);

const { chromium } = await chargerPlaywright();
const navigateur = await chromium.launch();
const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
const page = await contexte.newPage();

// Ce que la page dit pendant l'épreuve. Les modules manquants et les erreurs
// d'exécution sont la première chose qu'on cherche devant un échec : les garder
// fait la différence entre « un parcours a échoué » et « la page n'a jamais
// démarré ».
const bruits = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") bruits.push("console." + m.type() + " : " + m.text()); });
page.on("pageerror", (e) => bruits.push("exception : " + String((e && e.message) || e)));
page.on("requestfailed", (r) => bruits.push("requete échouée : " + r.url() + " (" + ((r.failure() && r.failure().errorText) || "?") + ")"));

let verdict = 1;
try {
  await page.goto(site.base + "/", { waitUntil: "load", timeout: 90000 });
  await page.waitForSelector(".connexion, .app-header, .recueil", { timeout: 90000 });
  await page.addScriptTag({ type: "module", content: INJECTION });
  const releve = await page
    .waitForFunction(() => window.__scribaeParcours || null, null, { timeout: 300000, polling: 500 })
    .then((h) => h.jsonValue());

  if (releve.erreur) {
    console.log("::error file=tests/parcours-navigateur.mjs::" + echapper("l'application n'a pas pu être menée jusqu'aux parcours — " + releve.erreur));
    console.error("ÉPREUVE INTERROMPUE\n" + releve.erreur);
  } else {
    const { session, releve: r } = releve;
    console.log("Scribae — parcours critiques dans Chromium (édition statique).");
    console.log("Session : " + (session.login || session.id) + " [" + (session.roles || []).join(", ") + "]");
    // Le service a-t-il répondu ? C'est ce qui dit si la suite a JUGÉ. L'édition
    // statique héberge le service dans la page (src/pages/host.js) : il doit
    // répondre. S'il s'est tu, les parcours qui en dépendent se déclarent « sans
    // objet » (NC-II-012) et un relevé « tout vert » ne vaudrait rien — on le dit,
    // et l'épreuve échoue plutôt que de faire passer un théâtre.
    if (r.service && r.service.joignable === false) {
      console.log("::error file=tests/parcours.mjs::" + echapper("le service n'a pas répondu (" + (r.service.detail || "sans détail") + ") : les parcours qui en dépendent n'ont rien pu juger"));
    }
    for (const p of r.resultats) {
      console.log((p.ok ? "  ok    " : "  ÉCHEC ") + p.id + " — " + p.nom + (p.ok ? "" : "\n          " + p.raison));
    }
    console.log("\n" + r.total + " parcours : " + r.ok + " réussi(s), " + r.echecs.length + " en échec."
      + (r.service ? " Service : " + (r.service.joignable ? "joignable" : "MUET") + "." : ""));
    for (const e of r.echecs) {
      console.log("::error file=tests/parcours.mjs,title=" + echapper("parcours " + e.id) + "::" + echapper(e.nom + " — " + e.raison));
    }
    if (bruits.length) {
      console.log("\nCe que la page a signalé pendant l'épreuve :");
      for (const b of bruits.slice(0, 40)) console.log("  " + b);
    }
    if (!r.echecs.length && (!r.service || r.service.joignable !== false)) verdict = 0;
  }
} catch (e) {
  console.log("::error file=tests/parcours-navigateur.mjs::" + echapper("épreuve interrompue — " + ((e && e.message) || e)));
  console.error("ÉPREUVE INTERROMPUE\n" + ((e && e.stack) || e));
} finally {
  if (verdict !== 0) {
    // Une image, parce qu'aucune annotation ne dit ce qui était à l'écran.
    try { await page.screenshot({ path: join(RACINE, "parcours-echec.png"), fullPage: false }); console.log("\nCapture d'écran : parcours-echec.png"); }
    catch (e) { console.log("(capture d'écran impossible : " + ((e && e.message) || e) + ")"); }
    if (bruits.length) { console.log("\nCe que la page a signalé :"); for (const b of bruits.slice(0, 40)) console.log("  " + b); }
  }
  await navigateur.close().catch(() => {});
  await new Promise((r) => site.serveur.close(r));
}

process.exit(verdict);
