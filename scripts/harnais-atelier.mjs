// ============================================================================
// Harnais de l'ATELIER — éprouver le dépôt depuis l'atelier, sans terminal.
//
// POURQUOI CE FICHIER. L'atelier (Perchance) n'a ni système de fichiers ni
// processus : ni `node --check`, ni `npm test`, ni les générateurs n'y sont
// lançables tels quels. Ce harnais comble l'écart SANS DUPLIQUER UNE SEULE
// RÈGLE : il charge les scripts du dépôt EUX-MÊMES (`scripts/verifier-style.mjs`,
// `scripts/generer-*.mjs`, `tests/*.test.mjs`) et leur fournit des doublures de
// `node:fs`, `node:path`, `node:url`, `node:crypto` — les lectures et les
// écritures retombant dans `src/`.
//
// OÙ IL VIT. `scripts/harnais-atelier.mjs` : c'est de l'OUTILLAGE, à sa place
// attendue dans le dépôt livré. `npm test` ne le voit pas (il ne se nomme pas
// `*.test.mjs`) ; `npm run syntaxe` le parse comme un module — il doit donc
// rester un module valide, sans `return` au premier niveau.
//
// CE QU'ON LUI DEMANDE, ET CE QU'ON EN ATTEND. Les appels exacts, les chiffres
// attendus et les garde-fous sont dans `src/docs/ATELIER.md`. En résumé, depuis
// l'outil `execute_js` de l'agent :
//
//   const src = await fs.readTextFile("src/scripts/harnais-atelier.mjs");
//   const h = await import(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
//   return h.texte(await h.verifier({ fs }));   // syntaxe + style + épreuves
//   return await h.regenerer({ fs });           // VARIABLES.md, API.md, logiciel-engendre.mjs
//   return await h.epreuves({ fs, cibles: ["src/server/mysql/actes.test.mjs"] });
//
// LES LIMITES, ÉCRITES POUR NE PAS SURPRENDRE (détail : `docs/ATELIER.md` § 6) :
//   • pas de processus : `node:child_process` lève. La syntaxe est donc vérifiée
//     par le parseur d'esbuild (`verifierSyntaxe`), pas par `node --check` —
//     même service rendu, autre outil ;
//   • les chemins sont VIRTUELS et ancrés à la racine du dépôt : la racine
//     virtuelle (`/`) EST `src/` dans l'atelier, et `import.meta.url` est réécrit
//     en `file:///…` pour que `new URL("..", import.meta.url)` calcule juste
//     (`scripts/racine-code.mjs`) ;
//   • une épreuve qui exige un vrai Node (spawnSync, mysql2, réseau) est SAUTÉE,
//     jamais verte par accident.
// ============================================================================

const ESBUILD_URL = "https://esm.sh/esbuild-wasm@0.21.5?bundle";
const ESBUILD_WASM = "https://esm.sh/esbuild-wasm@0.21.5/esbuild.wasm";

const __enc = new TextEncoder();
const __dec = new TextDecoder();
const __toU8 = (x, e) => {
  if (typeof x === "string") {
    if (!e || e === "utf8" || e === "utf-8" || e === "ascii" || e === "latin1" || e === "binary") return __enc.encode(x);
    if (e === "base64") { const b = atob(x); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
    if (e === "base64url") return __toU8(x.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (e === "hex") { const u = new Uint8Array(Math.floor(x.length / 2)); for (let i = 0; i < u.length; i++) u[i] = parseInt(x.substr(i * 2, 2), 16); return u; }
    return __enc.encode(x);
  }
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  if (Array.isArray(x)) return new Uint8Array(x);
  return __enc.encode(String(x));
};
const __decode = (u, e) => {
  if (e === "hex") return Array.from(u, (x) => x.toString(16).padStart(2, "0")).join("");
  if (e === "base64" || e === "base64url") { let s = ""; for (const x of u) s += String.fromCharCode(x); let r = btoa(s); if (e === "base64url") r = r.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); return r; }
  if (e === "latin1" || e === "binary") { let s = ""; for (const x of u) s += String.fromCharCode(x); return s; }
  return __dec.decode(u);
};
const __bufferifier = (u) => { u.toString = function (ee) { return __decode(u, ee); }; return u; };
globalThis.Buffer = {
  from: (x, e) => __bufferifier(__toU8(x, e)),
  alloc: (n) => __bufferifier(new Uint8Array(n)),
  concat: (arr) => { let n = 0; for (const a of arr) n += a.length; const u = new Uint8Array(n); let o = 0; for (const a of arr) { u.set(a, o); o += a.length; } return __bufferifier(u); },
  isBuffer: () => false,
};
globalThis.__SKIP = Symbol("skip");
const SHIMS = {};
SHIMS["node:test"] = `
const __t = globalThis.__TESTS = globalThis.__TESTS || [];
function test(name, fn){ __t.push({ name, fn }); }
test.test = test; test.only = test; test.skip = () => {}; test.todo = () => {};
test.before = () => {}; test.after = () => {}; test.beforeEach = () => {}; test.afterEach = () => {};
test.describe = (n, f) => { try { f(); } catch (e) {} };
test.it = test;
export default test; export { test };
`;
SHIMS["node:assert/strict"] = `
class AssertionError extends Error { constructor(m){ super(typeof m === "string" ? m : JSON.stringify(m)); this.name = "AssertionError"; } }
function deepEq(a, b){
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== "object") return false;
  const ta = Object.prototype.toString.call(a); if (ta !== Object.prototype.toString.call(b)) return false;
  if (ta === "[object Date]") return a.getTime() === b.getTime();
  if (ta === "[object RegExp]") return String(a) === String(b);
  if (ArrayBuffer.isView(a) || a instanceof ArrayBuffer){
    const av = a instanceof ArrayBuffer ? new Uint8Array(a) : new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const bv = b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    if (av.length !== bv.length) return false;
    for (let i = 0; i < av.length; i++) if (av[i] !== bv[i]) return false;
    return true;
  }
  if (Array.isArray(a)){ if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!deepEq(a[i], b[i])) return false; return true; }
  if (a instanceof Set){ if (a.size !== b.size) return false; for (const v of a) if (!b.has(v)) return false; return true; }
  if (a instanceof Map){ if (a.size !== b.size) return false; for (const [k, v] of a) { if (!b.has(k) || !deepEq(b.get(k), v)) return false; } return true; }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka){ if (!Object.prototype.hasOwnProperty.call(b, k)) return false; if (!deepEq(a[k], b[k])) return false; }
  return true;
}
function fail(m){ throw new AssertionError(m || "Échec de l'assertion"); }
const montre = (v) => { try { return typeof v === "string" ? JSON.stringify(v) : String(v); } catch (e) { return String(v); } };
const correspond = (err, atendu) => {
  if (atendu === undefined || atendu === null) return true;
  if (typeof atendu === "function" && atendu.prototype instanceof Error) return err instanceof atendu;
  if (atendu instanceof RegExp) return atendu.test(String(err && err.message));
  if (typeof atendu === "object"){ for (const k of Object.keys(atendu)) { if (!(k in err) || !deepEq(err[k], atendu[k])) return false; } return true; }
  return true;
};
// Comme Node : un second argument CHAÎNE est le message de l'assertion, pas un critère.
const lireAtendu = (a, b) => (typeof a === "string" ? { atendu: undefined, message: a } : { atendu: a, message: typeof b === "string" ? b : undefined });
const assert = (v, m) => { if (!v) fail(m || "La valeur attendue est vraie"); };
assert.ok = assert;
assert.equal = (a, b, m) => { if (a != b) fail(m || ("attendu " + montre(b) + ", obtenu " + montre(a))); };
assert.notEqual = (a, b, m) => { if (a == b) fail(m || ("ne devait pas valoir " + montre(b))); };
assert.strictEqual = (a, b, m) => { if (a !== b) fail(m || ("attendu " + montre(b) + ", obtenu " + montre(a))); };
assert.notStrictEqual = (a, b, m) => { if (a === b) fail(m || ("ne devait pas valoir " + montre(b))); };
assert.deepEqual = assert.deepStrictEqual = (a, b, m) => { if (!deepEq(a, b)) fail(m || ("structures différentes : " + montre(a) + " != " + montre(b))); };
assert.notDeepEqual = assert.notDeepStrictEqual = (a, b, m) => { if (deepEq(a, b)) fail(m || "les structures devaient différer"); };
assert.match = (s, re, m) => { if (!re.test(String(s))) fail(m || ("ne correspond pas à " + re + " : " + montre(s))); };
assert.doesNotMatch = (s, re, m) => { if (re.test(String(s))) fail(m || ("ne devait pas correspondre à " + re)); };
assert.throws = (fn, a, b) => { const r = lireAtendu(a, b); let v; try { v = fn(); } catch (e) { if (correspond(e, r.atendu)) return e; fail(r.message || ("erreur inattendue : " + (e && e.message))); } fail(r.message || "aucune erreur levée"); };
assert.doesNotThrow = (fn, m) => { try { fn(); } catch (e) { fail(typeof m === "string" ? m : ("erreur levée : " + (e && e.message))); } };
assert.rejects = async (fn, a, b) => { const r = lireAtendu(a, b); try { await (typeof fn === "function" ? fn() : fn); } catch (e) { if (correspond(e, r.atendu)) return e; fail(r.message || ("rejet inattendu : " + (e && e.message))); } fail(r.message || "aucun rejet"); };
assert.doesNotReject = async (fn, m) => { try { await (typeof fn === "function" ? fn() : fn); } catch (e) { fail(typeof m === "string" ? m : ("rejet inattendu : " + (e && e.message))); } };
assert.fail = (m) => fail(typeof m === "string" ? m : (m && m.message));
assert.ifError = (v) => { if (v) fail(String(v)); };
export default assert; export { assert };
`;
SHIMS["node:assert"] = SHIMS["node:assert/strict"];
SHIMS["node:crypto"] = `
const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
function sha256(u8){
  const l = u8.length;
  const total = (((l + 8) >> 6) + 1) << 6;
  const msg = new Uint8Array(total); msg.set(u8); msg[l] = 0x80;
  const dv = new DataView(msg.buffer);
  const bits = l * 8; dv.setUint32(total - 8, Math.floor(bits / 4294967296)); dv.setUint32(total - 4, bits >>> 0);
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w = new Uint32Array(64);
  for (let i = 0; i < total; i += 64){
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4);
    for (let j = 16; j < 64; j++){ const a = w[j-15], b = w[j-2]; w[j] = (w[j-16] + (rotr(a,7)^rotr(a,18)^(a>>>3)) + w[j-7] + (rotr(b,17)^rotr(b,19)^(b>>>10))) >>> 0; }
    let [a,b,c,d,e,f,g,hh] = h;
    for (let j = 0; j < 64; j++){
      const t1 = (hh + (rotr(e,6)^rotr(e,11)^rotr(e,25)) + ((e&f)^(~e&g)) + K[j] + w[j]) >>> 0;
      const t2 = ((rotr(a,2)^rotr(a,13)^rotr(a,22)) + ((a&b)^(a&c)^(b&c))) >>> 0;
      hh=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    h[0]=(h[0]+a)>>>0; h[1]=(h[1]+b)>>>0; h[2]=(h[2]+c)>>>0; h[3]=(h[3]+d)>>>0; h[4]=(h[4]+e)>>>0; h[5]=(h[5]+f)>>>0; h[6]=(h[6]+g)>>>0; h[7]=(h[7]+hh)>>>0;
  }
  const out = new Uint8Array(32); const od = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) od.setUint32(i * 4, h[i]);
  return out;
}
const enc = (d) => typeof d === "string" ? new TextEncoder().encode(d) : (d instanceof Uint8Array ? d : new Uint8Array(d));
export function createHash(algo){
  if (String(algo).replace("-","").toLowerCase() !== "sha256") throw new Error("shim : algorithme non pris en charge " + algo);
  let buf = new Uint8Array(0);
  return {
    update(d){ const b = enc(d); const n = new Uint8Array(buf.length + b.length); n.set(buf); n.set(b, buf.length); buf = n; return this; },
    digest(e){ const h = sha256(buf); if (!e) return h; if (String(e).toLowerCase() === "hex") return Array.from(h, (x) => x.toString(16).padStart(2, "0")).join(""); if (String(e).toLowerCase() === "base64") return btoa(String.fromCharCode(...h)); return h; },
    copy(){ const c = createHash("sha256"); c.update(buf); return c; },
  };
}
export const randomBytes = (n) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return globalThis.Buffer.from(b); };
export const randomUUID = () => crypto.randomUUID();
export const randomFillSync = (b) => { crypto.getRandomValues(b); return b; };
export function scryptSync(pw, salt, len){ let out = new Uint8Array(0); let bloc = enc(String(pw)).slice(); const s = enc(salt); for (let i = 0; i < 4 && out.length < len; i++){ const c = createHash("sha256"); c.update(bloc); c.update(s); c.update(String(i)); bloc = new Uint8Array(c.digest()); const n = new Uint8Array(out.length + bloc.length); n.set(out); n.set(bloc, out.length); out = n; } return out.slice(0, len); }
export function timingSafeEqual(a, b){ a = enc(a); b = enc(b); if (a.length !== b.length) throw new Error("longueurs différentes"); let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; }
export const webcrypto = globalThis.crypto;
export const constants = {};
export default { createHash, randomBytes, randomUUID, randomFillSync, scryptSync, timingSafeEqual, webcrypto, constants };
`;
SHIMS["node:path"] = `
export const join = (...p) => p.filter((x) => x !== "").join("/").replace(/\\/+/g, "/");
export const resolve = (...p) => join(...p);
export const dirname = (p) => String(p).replace(/\\/[^/]*$/, "") || ".";
export const basename = (p) => String(p).replace(/.*\\//, "");
export const extname = (p) => { const m = /\\.[^./]*$/.exec(String(p)); return m ? m[0] : ""; };
export const relative = (a, b) => String(b).replace(String(a).replace(/\\/$/, "") + "/", "");
export const sep = "/";
export default { join, resolve, dirname, basename, extname, relative, sep };
`;
SHIMS["node:url"] = `
export const fileURLToPath = (u) => String(u).replace(/^file:\\/\\//, "");
export const pathToFileURL = (p) => ({ href: "file://" + p });
export default { fileURLToPath, pathToFileURL };
`;
SHIMS["node:fs/promises"] = `
const reels = new Set(globalThis.__SNAPSHOT || []);
const P = (p) => String(p).replace(/^file:/, "").replace(/^[/]+/, "").replace(/^[.][/]/, "");
const reel = (p) => { const s = P(p); if (reels.has(s)) return s; if (reels.has("src/" + s)) return "src/" + s; return s; };
// Un DOSSIER ne se résout pas comme un fichier : les dossiers ne figurent pas
// dans l'inventaire des fichiers, et la racine virtuelle est src/ — l'arbre que
// la plateforme conserve, équivalent de la racine du dépôt livré. scratch/ et
// imports/ voisinent à côté, mais ne font pas partie du dépôt.
const reelDossier = (p) => {
  const s = P(p).replace(/[/]+$/, "");
  if (s === "") return "src";
  if (s === "src" || s.startsWith("src/")) return s;
  return "src/" + s;
};
const enfants = (p) => {
  const dir = reelDossier(p);
  const prefixe = dir + "/";
  const vus = new Set(); const liste = [];
  for (const f of reels) {
    if (prefixe && !f.startsWith(prefixe)) continue;
    const reste = f.slice(prefixe.length);
    if (!reste) continue;
    const segment = reste.split("/")[0];
    const estDossier = reste.includes("/");
    if (vus.has(segment)) continue;
    vus.add(segment);
    liste.push({ name: segment, isDirectory: () => estDossier, isFile: () => !estDossier });
  }
  return liste;
};
export const readFile = async (p, e) => {
  const c = reel(p);
  return (e === undefined || e === null || /^utf-?8$/i.test(e) || e === "ascii" || e === "latin1" || e === "binary")
    ? globalThis.__FS.readTextFile(c) : globalThis.__FS.readFile(c);
};
export const writeFile = async (p, d) => globalThis.__FS.writeTextFile(reel(p), typeof d === "string" ? d : new TextDecoder().decode(d));
export const mkdir = async () => {};
export const rm = async () => {};
export const stat = async (p) => ({ isFile: () => reels.has(reel(p)), isDirectory: () => !reels.has(reel(p)), size: 0 });
export const readdir = async (p, o) => { const l = enfants(p); return o && o.withFileTypes ? l : l.map((x) => x.name); };
export const access = async (p) => { if (!reels.has(reel(p)) && !enfants(p).length) { const err = new Error("ENOENT " + p); err.code = "ENOENT"; throw err; } };
export default { readFile, writeFile, mkdir, rm, stat, readdir, access };
`;
SHIMS["node:fs"] = `
const reels = new Set(globalThis.__SNAPSHOT || []);
const P = (p) => String(p).replace(/^file:/, "").replace(/^[/]+/, "").replace(/^[.][/]/, "");
const reel = (p) => { const s = P(p); if (reels.has(s)) return s; if (reels.has("src/" + s)) return "src/" + s; return s; };
export const existsSync = (p) => reels.has(reel(p));
export const readFileSync = () => { throw new Error("shim : readFileSync indisponible (l'atelier n'a pas de lecture synchrone)"); };
export const mkdirSync = () => {};
export default { existsSync, readFileSync, mkdirSync };
`;
SHIMS["node:child_process"] = `
export const spawnSync = () => { throw new Error("shim : spawnSync indisponible (pas de node)"); };
export const execSync = () => { throw new Error("shim : execSync indisponible"); };
export default { spawnSync, execSync };
`;
SHIMS["mysql2/promise"] = `
const aucun = () => { throw new Error("shim : mysql2 indisponible"); };
export const createPool = aucun;
export const createConnection = aucun;
export default { createPool, createConnection };
`;
SHIMS["mysql2"] = SHIMS["mysql2/promise"];
for (const m of ["node:net", "node:tls", "node:http", "node:https", "node:zlib", "node:stream", "node:events", "node:os", "node:util", "node:async_hooks"]) {
  SHIMS[m] = `const aucun = () => { throw new Error("shim : module natif indisponible"); }; export default {}; export const createServer = aucun; export const connect = aucun;`;
}
// --- Les chemins : un seul arbre, deux noms --------------------------------
// Le dépôt livré range le code sous `src/` et l'outillage à sa racine ; dans
// l'atelier, TOUT vit sous `src/`. Le harnais prend la seconde disposition pour
// la première : la racine virtuelle EST `src/`. Un chemin virtuel
// « scripts/x.mjs » se lit donc `src/scripts/x.mjs` sur le disque de l'atelier,
// et un chemin d'épreuve écrit pour le dépôt (`../src/lib/…`) se résout tout seul.

let __snapshot = new Set();
const __modules = new Map();

const normaliser = (p) => {
  const parts = [];
  for (const segment of String(p).split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
};

const sansProtocole = (p) => normaliser(String(p).replace(/^file:/, ""));

const reel = (v) => {
  const s = sansProtocole(v);
  if (__snapshot.has(s)) return s;
  if (__snapshot.has("src/" + s)) return "src/" + s;
  return s;
};

const virtuel = (r) => {
  const s = normaliser(r);
  return s.startsWith("src/") ? s.slice(4) : s;
};

const message = (e) => String((e && e.stack) || e).split("\n").slice(0, 6).join(" | ");

async function preparer(fs) {
  const liste = await fs.listFiles();
  __snapshot = new Set(liste.filter((f) => f.writable !== false).map((f) => f.path));
  __modules.clear();
  globalThis.__FS = fs;
  globalThis.__SNAPSHOT = [...__snapshot];
}

// --- esbuild, chargé une seule fois par exécution --------------------------
let __esbuild = null;
async function esbuildPret() {
  if (!__esbuild) __esbuild = (async () => {
    const { default: esbuild } = await import(ESBUILD_URL);
    await esbuild.initialize({ wasmURL: ESBUILD_WASM });
    return esbuild;
  })();
  return __esbuild;
}

// --- Le montage : doublures, résolution virtuelle, import.meta.url ---------
async function monter(fs) {
  await preparer(fs);
  const esbuild = await esbuildPret();
  const plugin = {
    name: "atelier",
    setup(build) {
      build.onResolve({ filter: /^node:/ }, (a) => (SHIMS[a.path] ? { path: a.path, namespace: "doublure" } : null));
      build.onResolve({ filter: /^mysql2([/].*)?$/ }, (a) => (SHIMS[a.path] ? { path: a.path, namespace: "doublure" } : null));
      build.onResolve({ filter: /^[.][.]?[/]/ }, (a) => {
        if (a.namespace === "doublure") return null;
        const dossier = virtuel(a.importer).replace(/[/][^/]*$/, "");
        return { path: reel(normaliser(dossier + "/" + a.path)), namespace: "atelier" };
      });
      build.onLoad({ filter: /.*/, namespace: "doublure" }, (a) => ({ contents: SHIMS[a.path], loader: "js", resolveDir: "/" }));
      build.onLoad({ filter: /.*/, namespace: "atelier" }, async (a) => ({
        contents: (await fs.readTextFile(a.path)).replace(/import[.]meta[.]url/g, JSON.stringify("file:///" + virtuel(a.path))),
        loader: "js",
        resolveDir: "/",
      }));
    },
  };
  // Les épreuves chargent parfois un module par `await import("…")` DYNAMIQUE
  // (une chaîne dans une variable) : esbuild ne peut pas l'inliner. On le
  // détourne vers ce résolveur, qui rejoue la résolution virtuelle.
  //
  // LE REGISTRE PARTAGÉ, ET POURQUOI. `node --test` exécute UN FICHIER par
  // PROCESSUS : dans un fichier, tous les `import` rendent le MÊME module (donc
  // le même état). Le harnais, lui, construit un bundle par import dynamique :
  // `charger("../src/lib/store.js")` et `charger("../src/lib/auth.js")` donnaient
  // donc DEUX copies d'`auth.js`, et un test qui règle l'une ne se voyait pas
  // dans l'autre — des échecs qui n'existaient que dans l'atelier (voir
  // docs/ATELIER.md § 3.3). Le registre répare cela : `uneEpreuve` fait
  // importer D'AVANCE, dans le bundle du fichier, tous les modules que la source
  // cite en clair (ils sont alors partagés, puisque esbuild les inline), et le
  // résolveur les sert ici au lieu de reconstruire un second bundle.
  const registre = new Map();
  globalThis.__dynEnregistrer = (cle, ns) => { registre.set(cle, ns); };
  // Un registre vit le temps d'UN fichier d'épreuve : deux fichiers ne partagent
  // jamais un module, exactement comme deux processus.
  globalThis.__dynVider = () => { registre.clear(); __modules.clear(); };
  globalThis.__makeDyn = (dossierVirtuel) => async (spec) => {
    const s = String(spec);
    const vp = s.startsWith(".") ? normaliser(dossierVirtuel + "/" + s) : sansProtocole(s);
    const candidats = [reel(vp), vp, "src/" + vp];
    for (const candidat of candidats) {
      if (registre.has(candidat)) return registre.get(candidat);
    }
    let derniere = null;
    for (const candidat of candidats) {
      try { await fs.readTextFile(candidat); return await importer(fs, esbuild, plugin, candidat); }
      catch (e) { derniere = e; }
    }
    throw derniere || new Error("harnais : module introuvable « " + s + " »");
  };
  return { esbuild, plugin };
}

// `esnext` et non `es2020` : le dépôt est servi TEL QUEL (pas de compilation),
// il a donc droit à ce que Node 20 et les navigateurs savent faire — les
// fichiers de l'atelier emploient l'`await` de premier niveau.
const OPTIONS = { bundle: true, format: "esm", write: false, platform: "neutral", target: "esnext", logLevel: "silent" };

const prelude = (cheminReel, code) =>
  "const __dyn = globalThis.__makeDyn(" + JSON.stringify(virtuel(cheminReel).replace(/[/][^/]*$/, "")) + ");\n"
  + code.replace(/import\s*\(/g, "__dyn(");

// Le « shebang » des scripts livrés (`#!/usr/bin/env node`) est mis en
// commentaire : esbuild le remonterait en tête du bundle, AVANT notre prélude —
// et un `#!` au milieu d'un module est une faute de syntaxe.
const sansShebang = (texte) => String(texte).replace(/^#!/, "//");

const construire = (fs, esbuild, plugin, cheminReel, contenu) =>
  esbuild.build({ ...OPTIONS, plugins: [plugin], stdin: { contents: sansShebang(contenu), sourcefile: virtuel(cheminReel), resolveDir: "/" } });

async function importer(fs, esbuild, plugin, cheminReel) {
  if (__modules.has(cheminReel)) return __modules.get(cheminReel);
  const promesse = (async () => {
    const res = await construire(fs, esbuild, plugin, cheminReel, await fs.readTextFile(cheminReel));
    return import(URL.createObjectURL(new Blob([prelude(cheminReel, res.outputFiles[0].text)], { type: "text/javascript" })));
  })();
  __modules.set(cheminReel, promesse);
  return promesse;
}

// --- Les trois services du harnais ----------------------------------------

// 1. La syntaxe : le parseur d'esbuild tient lieu de `node --check`.
export async function verifierSyntaxe({ fs } = {}) {
  await preparer(fs);
  const esbuild = await esbuildPret();
  const liste = [...__snapshot].filter((p) => p.startsWith("src/") && /[.](m?js)$/.test(p)).sort();
  const fautes = [];
  for (const p of liste) {
    try { await esbuild.transform(await fs.readTextFile(p), { loader: "js" }); }
    catch (e) { fautes.push({ fichier: p, erreur: message(e) }); }
  }
  return { controles: liste.length, fautes };
}

// 2. Le style : le script LIVRÉ, exécuté tel quel (`--strict` par défaut).
export async function verifierStyle({ fs, strict = true } = {}) {
  return lancerScript({ fs, script: "src/scripts/verifier-style.mjs", argv: strict ? ["--strict"] : [] });
}

// 3. Les épreuves : un fichier par construction, comme `node --test` les isole.
export async function epreuves({ fs, cibles = null } = {}) {
  const { esbuild, plugin } = await monter(fs);
  const liste = cibles && cibles.length ? cibles.map(reel) : decouvrir();
  const resultats = [];
  for (const fichier of liste) resultats.push(await uneEpreuve(fs, esbuild, plugin, fichier));
  const totalOk = resultats.reduce((s, r) => s + (r.ok || 0), 0);
  const totalTests = resultats.reduce((s, r) => s + (r.total || 0), 0);
  return { totalOk, totalTests, resultats };
}

const decouvrir = () => [...__snapshot]
  .filter((p) => /[.]test[.]mjs$/.test(p) && (p.startsWith("src/tests/") || p.startsWith("src/server/")))
  .sort();

// Les MODULES que la source cite EN CLAIR (« ../src/lib/…js », « ./actes.mjs ») :
// ce sont eux que l'épreuve chargera. Les faire entrer dans SON bundle, c'est
// garantir qu'un module importé deux fois est le MÊME — la règle de `node --test`
// à l'intérieur d'un fichier. On ne retient que les chemins qui EXISTENT et qui
// portent une extension de MODULE : la source cite aussi des fichiers qu'elle
// LIT (`index.html`, `env.example`), et les importer ferait échouer la
// construction.
async function modulesPartages(fs, dossierVirtuel, source) {
  const trouves = new Map();
  for (const m of String(source).matchAll(/["']([.][.]?\/[^"'\n]*)["']/g)) {
    const spec = m[1];
    if (!/[.](m?js)$/.test(spec)) continue;
    if (trouves.has(spec)) continue;
    const vp = normaliser(dossierVirtuel + "/" + spec);
    for (const cle of [reel(vp), vp, "src/" + vp]) {
      try { await fs.readTextFile(cle); trouves.set(spec, cle); break; }
      catch (e) { /* chemin suivant */ }
    }
  }
  return [...trouves].map(([spec, cle]) => ({ spec, cle }));
}

// Ce qui les enregistre est ajouté À LA SOURCE, et non au bundle : c'est esbuild
// qui doit voir ces `import` pour les INLINER (un import dynamique à littéral
// est inliné dès lors qu'on ne découpe pas le bundle). Chaque entrée est
// protégée : un module qui refuse de se charger hors navigateur reste
// « introuvable » pour l'épreuve, comme avant — il ne fait pas tomber la
// construction.
const codePartage = (liste) => liste
  .map(({ spec, cle }) => "try { globalThis.__dynEnregistrer(" + JSON.stringify(cle)
    + ", await import(" + JSON.stringify(spec) + ")); } catch (e) { /* non partageable */ }")
  .join("\n");

async function uneEpreuve(fs, esbuild, plugin, fichier) {
  globalThis.__TESTS = [];
  // UN FICHIER = UN PROCESSUS, comme sous `node --test` : rien de ce qu'un
  // fichier a chargé ne doit survivre au suivant (voir `__dynVider`).
  if (globalThis.__dynVider) globalThis.__dynVider();
  let code;
  try {
    const source = await fs.readTextFile(fichier);
    const partages = await modulesPartages(fs, virtuel(fichier).replace(/[/][^/]*$/, ""), source);
    const res = await construire(fs, esbuild, plugin, fichier, source + "\n" + codePartage(partages));
    code = prelude(fichier, res.outputFiles[0].text);
  } catch (e) {
    return { fichier, erreur: "construction : " + message(e), ok: 0, total: 0, sautes: 0, echecs: [] };
  }
  try { await import(URL.createObjectURL(new Blob([code], { type: "text/javascript" }))); }
  catch (e) { return { fichier, erreur: "import : " + message(e), ok: 0, total: 0, sautes: 0, echecs: [] }; }
  const liste = globalThis.__TESTS;
  let ok = 0; let sautes = 0; const echecs = [];
  for (const t of liste) {
    const faux = { test: (n, f) => f(), diagnostic: () => {}, plan: () => {}, end: () => {}, skip: () => { throw globalThis.__SKIP; } };
    try { await t.fn(faux); ok++; }
    catch (e) {
      if (e === globalThis.__SKIP) { sautes++; continue; }
      const piste = String((e && e.stack) || "").split("\n").find((l) => /\d+:\d+/.test(l) && !/harnais/.test(l));
      echecs.push(t.name + "  ==>  " + String((e && e.message) || e) + (piste ? "   [" + piste.trim() + "]" : ""));
    }
  }
  return { fichier, total: liste.length, ok, sautes, echecs };
}

// 4. Un script du dépôt, exécuté tel quel (les générateurs, les contrôles…).
export async function lancerScript({ fs, script, argv = [] } = {}) {
  const { esbuild, plugin } = await monter(fs);
  const chemin = reel(script);
  let sortie = "";
  const ajouter = (...a) => { sortie += a.map((x) => (typeof x === "string" ? x : String(x))).join(" ") + "\n"; };
  const vraiConsole = globalThis.console;
  const vraiProcess = globalThis.process;
  globalThis.console = { log: ajouter, warn: ajouter, error: ajouter, info: ajouter, debug: ajouter };
  globalThis.process = {
    argv: ["/usr/bin/node", virtuel(chemin), ...argv],
    execPath: "/usr/bin/node",
    env: {},
    platform: "linux",
    version: "v20.0.0",
    versions: { node: "20.0.0" },
    cwd: () => "/",
    exit: (code = 0) => { const e = new Error("sortie " + code); e.__sortie = code; throw e; },
  };
  try {
    let code;
    try {
      const res = await construire(fs, esbuild, plugin, chemin, await fs.readTextFile(chemin));
      code = prelude(chemin, res.outputFiles[0].text);
    } catch (e) { return { script: chemin, ok: false, code: 1, sortie, erreur: "construction : " + message(e) }; }
    try {
      await import(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
      return { script: chemin, ok: true, code: 0, sortie };
    } catch (e) {
      if (e && typeof e.__sortie === "number") return { script: chemin, ok: e.__sortie === 0, code: e.__sortie, sortie };
      return { script: chemin, ok: false, code: 1, sortie, erreur: "exécution : " + message(e) };
    }
  } finally {
    globalThis.console = vraiConsole;
    globalThis.process = vraiProcess;
  }
}

// 5. Les trois documents engendrés, par leurs générateurs LIVRÉS.
export async function regenerer({ fs } = {}) {
  const scripts = ["src/scripts/generer-variables.mjs", "src/scripts/generer-api.mjs", "src/scripts/generer-logiciel.mjs"];
  const resultats = [];
  for (const script of scripts) resultats.push(await lancerScript({ fs, script }));
  return { ok: resultats.every((r) => r.ok), resultats };
}

// 6. Tout, dans l'ordre de `npm run verifier` : syntaxe, style, épreuves.
export async function verifier({ fs, epreuvesAussi = true } = {}) {
  const syntaxe = await verifierSyntaxe({ fs });
  const style = await verifierStyle({ fs });
  const rapport = { syntaxe, style, ok: syntaxe.fautes.length === 0 && style.code === 0 };
  if (epreuvesAussi) {
    rapport.epreuves = await epreuves({ fs });
    // UN SAUT N'EST PAS UN ÉCHEC. Les épreuves que le navigateur ne peut pas
    // jouer — il n'y a pas de processus ici, ni de `node:crypto` complet, ni
    // d'installation réelle à comparer — s'appellent elles-mêmes `t.skip`.
    // Les compter comme des échecs rendrait le verdict faux, et ferait chasser
    // un fantôme à chaque tour (voir src/docs/ATELIER.md § 3.3).
    rapport.sauts = rapport.epreuves.resultats.reduce((n, r) => n + (r.sautes || 0), 0);
    rapport.echecs = rapport.epreuves.resultats.reduce((n, r) => n + (r.echecs ? r.echecs.length : 0) + (r.erreur ? 1 : 0), 0);
    rapport.ok = rapport.ok && rapport.echecs === 0;
  }
  return rapport;
}

const derniereLigne = (s) => String(s || "").trim().split("\n").filter(Boolean).slice(-1)[0] || "";

// Un verdict court, fait pour être RENDU tel quel par l'outil de l'agent.
// Il distingue l'ÉCHEC (une régression : quelque chose qui marchait ne marche
// plus) du SAUT (une épreuve que le navigateur ne peut pas jouer — pas de
// processus, pas de `node:crypto` complet, pas d'installation réelle). Le second
// est un fait d'environnement, listé dans `docs/ATELIER.md` § 3.3 ; le confondre
// avec le premier est le PLUS GRAND risque de l'atelier — chasser un fantôme.
export function texte(rapport) {
  const lignes = [];
  lignes.push("Syntaxe : " + rapport.syntaxe.controles + " fichier(s), " + rapport.syntaxe.fautes.length + " faute(s).");
  for (const f of rapport.syntaxe.fautes.slice(0, 8)) lignes.push("  - " + f.fichier + " :: " + f.erreur);
  lignes.push("Style : code " + rapport.style.code + (rapport.style.erreur ? " (" + rapport.style.erreur + ")" : "") + " — " + derniereLigne(rapport.style.sortie));
  if (rapport.epreuves) {
    const echecs = rapport.epreuves.resultats.reduce((n, r) => n + (r.echecs ? r.echecs.length : 0) + (r.erreur ? 1 : 0), 0);
    const sautes = rapport.epreuves.resultats.reduce((n, r) => n + (r.sautes || 0), 0);
    lignes.push("Épreuves : " + rapport.epreuves.totalOk + "/" + rapport.epreuves.totalTests
      + " — " + echecs + " échec(s) et " + sautes + " saut(s). Un saut n'est pas un échec (voir src/docs/ATELIER.md § 3.3) ; un échec, lui, est une régression.");
    for (const r of rapport.epreuves.resultats) {
      if (!r.erreur && r.ok === r.total && !r.echecs.length) continue;   // les fichiers verts n'encombrent pas
      const apercu = (r.echecs || []).slice(0, 2).map((e) => (e.length > 160 ? e.slice(0, 160) + "…" : e));
      lignes.push("  " + (r.erreur ? "ERREUR " : "") + r.fichier + " " + (r.erreur || (r.ok + "/" + r.total) + (r.sautes ? " (+" + r.sautes + " sautés)" : "")) + (apercu.length ? "  " + JSON.stringify(apercu) : ""));
    }
  }
  const faute = rapport.syntaxe.fautes.length > 0 || rapport.style.code !== 0;
  lignes.push("Verdict : " + (faute
    ? "À REVOIR — corriger la syntaxe ou le style ci-dessus"
    : rapport.ok
      ? "tout est vert" + (rapport.sauts ? " (" + rapport.sauts + " saut(s) d'environnement)" : "")
      : "À REVOIR — les épreuves ci-dessus portent un échec"));
  return lignes.join("\n");
}
