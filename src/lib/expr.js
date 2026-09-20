// Langage d'expression sûr (aucun eval / new Function).
// Sert aux conditions d'affichage, aux règles métier et à la génération Schematron.

const KEYWORDS = new Set(["true", "false", "null", "in", "not", "and", "or"]);

const PUNCT = [
  "===", "!==", "==", "!=", "<=", ">=", "&&", "||",
  "?", ":", "(", ")", "[", "]", ",", ".", "!", "<", ">", "+", "-", "*", "/", "%",
];

function tokenize(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'" || c === '"') {
      const q = c;
      let j = i + 1, val = "";
      while (j < n && src[j] !== q) {
        if (src[j] === "\\" && j + 1 < n) { val += src[j + 1]; j += 2; }
        else { val += src[j]; j++; }
      }
      if (j >= n) throw new Error("Chaîne non terminée");
      out.push({ t: "str", v: val });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9]/.test(src[j])) j++;
      if (src[j] === "." && /[0-9]/.test(src[j + 1] || "")) {
        j++;
        while (j < n && /[0-9]/.test(src[j])) j++;
      }
      out.push({ t: "num", v: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_\u00c0-\u024f]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_\u00c0-\u024f]/.test(src[j])) j++;
      const word = src.slice(i, j);
      out.push({ t: KEYWORDS.has(word) ? "kw" : "id", v: word });
      i = j;
      continue;
    }
    const p = PUNCT.find((x) => src.startsWith(x, i));
    if (!p) throw new Error(`Caractère inattendu « ${c} » en position ${i}`);
    out.push({ t: "punct", v: p });
    i += p.length;
  }
  out.push({ t: "eof" });
  return out;
}

function parse(src) {
  const toks = tokenize(src);
  let pos = 0;
  const peek = (k = 0) => toks[pos + k];
  const at = (v) => peek().t === "punct" && peek().v === v;
  const atKw = (v) => peek().t === "kw" && peek().v === v;
  const eat = (v) => { if (!at(v)) throw new Error(`Attendu « ${v} »`); pos++; };
  const eatKw = (v) => { if (!atKw(v)) throw new Error(`Attendu « ${v} »`); pos++; };

  function ternary() {
    const test = or();
    if (at("?")) { pos++; const a = ternary(); eat(":"); const b = ternary(); return { k: "cond", test, a, b }; }
    return test;
  }
  function or() {
    let l = and();
    while (at("||") || atKw("or")) { if (at("||")) pos++; else pos++; const r = and(); l = { k: "or", l, r }; }
    return l;
  }
  function and() {
    let l = not();
    while (at("&&") || atKw("and")) { pos++; const r = not(); l = { k: "and", l, r }; }
    return l;
  }
  function not() {
    if (at("!") || atKw("not")) { pos++; return { k: "not", e: not() }; }
    return cmp();
  }
  function cmp() {
    let l = add();
    for (;;) {
      if (["==", "!=", "===", "!==", "<", "<=", ">", ">="].includes(peek().v) && peek().t === "punct") {
        const op = peek().v; pos++;
        l = { k: "cmp", op, l, r: add() };
      } else if (atKw("in")) { pos++; l = { k: "in", l, r: add() }; }
      else return l;
    }
  }
  function add() {
    let l = mul();
    while (at("+") || at("-")) { const op = peek().v; pos++; l = { k: "arith", op, l, r: mul() }; }
    return l;
  }
  function mul() {
    let l = unary();
    while (at("*") || at("/") || at("%")) { const op = peek().v; pos++; l = { k: "arith", op, l, r: unary() }; }
    return l;
  }
  function unary() {
    if (at("-")) { pos++; return { k: "neg", e: unary() }; }
    return postfix();
  }
  function postfix() {
    let e = primary();
    for (;;) {
      if (at(".")) { pos++; const id = peek(); if (id.t !== "id" && id.t !== "kw") throw new Error("Propriété attendue"); pos++; e = { k: "member", obj: e, key: { k: "lit", v: id.v } }; }
      else if (at("[")) { pos++; const idx = ternary(); eat("]"); e = { k: "member", obj: e, key: idx }; }
      else return e;
    }
  }
  function primary() {
    const t = peek();
    if (t.t === "num" || t.t === "str") { pos++; return { k: "lit", v: t.v }; }
    if (t.t === "kw") {
      if (t.v === "true") { pos++; return { k: "lit", v: true }; }
      if (t.v === "false") { pos++; return { k: "lit", v: false }; }
      if (t.v === "null") { pos++; return { k: "lit", v: null }; }
      throw new Error(`Mot-clé inattendu « ${t.v} »`);
    }
    if (at("(")) { pos++; const e = ternary(); eat(")"); return e; }
    if (at("[")) {
      pos++;
      const items = [];
      if (!at("]")) {
        for (;;) { items.push(ternary()); if (at(",")) { pos++; continue; } break; }
      }
      eat("]");
      return { k: "list", items };
    }
    if (t.t === "id") {
      pos++;
      if (at("(")) {
        pos++;
        const args = [];
        if (!at(")")) { for (;;) { args.push(ternary()); if (at(",")) { pos++; continue; } break; } }
        eat(")");
        return { k: "call", name: t.v, args };
      }
      return { k: "name", name: t.v };
    }
    throw new Error(`Expression inattendue « ${t.v ?? t.t} »`);
  }

  const ast = ternary();
  if (peek().t !== "eof") throw new Error(`Reste inattendu : « ${peek().v} »`);
  return ast;
}

const truthy = (v) => {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim() !== "";
  return !!v;
};

function toNum(v) {
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return isFinite(n) ? n : NaN;
}

function cmpValues(op, l, r) {
  switch (op) {
    case "==": case "===": return eq(l, r);
    case "!=": case "!==": return !eq(l, r);
    default: break;
  }
  const bothNum = typeof l === "number" || typeof r === "number";
  const a = bothNum ? toNum(l) : l;
  const b = bothNum ? toNum(r) : r;
  switch (op) {
    case "<": return a < b;
    case "<=": return a <= b;
    case ">": return a > b;
    case ">=": return a >= b;
    default: throw new Error(`Opérateur inconnu ${op}`);
  }
}

function eq(l, r) {
  if (l === r) return true;
  if (typeof l === "number" || typeof r === "number") {
    const a = toNum(l), b = toNum(r);
    if (!isNaN(a) && !isNaN(b)) return a === b;
  }
  if (Array.isArray(l) && Array.isArray(r)) return l.length === r.length && l.every((x, i) => eq(x, r[i]));
  return false;
}

const BUILTINS = {
  exists: (v) => v !== undefined && v !== null && !(typeof v === "string" && v.trim() === ""),
  empty: (v) => !truthy(v),
  len: (v) => (Array.isArray(v) ? v.length : String(v ?? "").length),
  count: (v) => (Array.isArray(v) ? v.length : 0),
  contains: (a, b) => {
    if (Array.isArray(a)) return a.some((x) => eq(x, b));
    return String(a ?? "").toLowerCase().includes(String(b ?? "").toLowerCase());
  },
  startswith: (a, b) => String(a ?? "").toLowerCase().startsWith(String(b ?? "").toLowerCase()),
  endswith: (a, b) => String(a ?? "").toLowerCase().endsWith(String(b ?? "").toLowerCase()),
  matches: (a, re) => {
    try { return new RegExp(String(re)).test(String(a ?? "")); } catch { return false; }
  },
  lower: (a) => String(a ?? "").toLowerCase(),
  upper: (a) => String(a ?? "").toUpperCase(),
  trim: (a) => String(a ?? "").trim(),
  num: toNum,
  money: (a) => toNum(a),
  date: (a) => (typeof a === "string" ? a.slice(0, 10) : ""),
  today: () => new Date().toISOString().slice(0, 10),
  diff_days: (a, b) => {
    const pa = Date.parse(String(a)), pb = Date.parse(String(b));
    if (isNaN(pa) || isNaN(pb)) return NaN;
    return Math.round((pa - pb) / 86400000);
  },
  min: (...a) => Math.min(...a.flat().map(toNum)),
  max: (...a) => Math.max(...a.flat().map(toNum)),
  sum: (a) => (Array.isArray(a) ? a.reduce((s, x) => s + toNum(x), 0) : toNum(a)),
  join: (a, s = ", ") => (Array.isArray(a) ? a.join(s) : String(a ?? "")),
  any: (a) => (Array.isArray(a) ? a.some(truthy) : truthy(a)),
  all: (a) => (Array.isArray(a) ? a.every(truthy) : truthy(a)),
  coalesce: (...a) => a.find((x) => truthy(x)) ?? "",
  abs: (a) => Math.abs(toNum(a)),
};

function ev(node, ctx) {
  switch (node.k) {
    case "lit": return node.v;
    case "list": return node.items.map((x) => ev(x, ctx));
    case "name": {
      if (Object.prototype.hasOwnProperty.call(ctx, node.name)) return ctx[node.name];
      return undefined;
    }
    case "member": {
      const obj = ev(node.obj, ctx);
      const key = ev(node.key, ctx);
      if (obj == null) return undefined;
      return obj[key];
    }
    case "call": {
      const fn = BUILTINS[node.name] || (ctx && typeof ctx[node.name] === "function" ? ctx[node.name] : null);
      if (!fn) throw new Error(`Fonction inconnue « ${node.name} »`);
      return fn(...node.args.map((a) => ev(a, ctx)));
    }
    case "not": return !truthy(ev(node.e, ctx));
    case "neg": return -toNum(ev(node.e, ctx));
    case "and": return truthy(ev(node.l, ctx)) ? truthy(ev(node.r, ctx)) : false;
    case "or": return truthy(ev(node.l, ctx)) ? true : truthy(ev(node.r, ctx));
    case "cond": return truthy(ev(node.test, ctx)) ? ev(node.a, ctx) : ev(node.b, ctx);
    case "cmp": return cmpValues(node.op, ev(node.l, ctx), ev(node.r, ctx));
    case "in": {
      const l = ev(node.l, ctx), r = ev(node.r, ctx);
      if (Array.isArray(r)) return r.some((x) => eq(x, l));
      return String(r ?? "").includes(String(l ?? ""));
    }
    case "arith": {
      const l = ev(node.l, ctx), r = ev(node.r, ctx);
      const a = toNum(l), b = toNum(r);
      switch (node.op) {
        case "+": return typeof l === "string" || typeof r === "string" ? String(l ?? "") + String(r ?? "") : a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "%": return a % b;
        default: throw new Error("Opérateur arithmétique inconnu");
      }
    }
    default: throw new Error("Nœud d'expression inconnu : " + node.k);
  }
}

export function compileExpr(src) {
  const ast = parse(String(src ?? ""));
  return (ctx = {}) => ev(ast, ctx);
}

export function parseExpr(src) {
  return parse(String(src ?? ""));
}

export function evaluate(src, ctx = {}) {
  return compileExpr(src)(ctx);
}

// Renvoie { ok, value } ou { ok:false, error } — jamais d'exception qui remonte.
export function safeEval(src, ctx = {}) {
  if (src == null || String(src).trim() === "") return { ok: true, value: true };
  try {
    return { ok: true, value: evaluate(src, ctx) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function checkExpr(src) {
  try {
    parse(String(src ?? ""));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
