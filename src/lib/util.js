export const uid = (p = "id") =>
  p + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

export const clone = (v) => (v === undefined ? v : structuredClone(v));

export const debounce = (fn, ms = 300) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const slug = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function isDate(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
}

export function formatDate(value, style = "date-long") {
  if (!value) return "";
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const [, y, mm, dd] = m;
  const d = Number(dd), mo = Number(mm);
  if (style === "date-short") return `${dd}/${mm}/${y}`;
  if (style === "date-iso") return s;
  if (style === "date-month") return `${MONTHS[mo - 1]} ${y}`;
  const day = d === 1 ? "1er" : String(d);
  return `${day} ${MONTHS[mo - 1]} ${y}`;
}

export function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatMoney(value, locale = "fr-FR") {
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!isFinite(n)) return String(value ?? "");
  return n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function capitalize(s) {
  const t = String(s ?? "");
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

export function titleCase(s) {
  return String(s ?? "").toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

export function download(filename, text, mime = "application/json") {
  const blob = text instanceof Blob ? text : new Blob([text], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function pickFile(accept = ".json") {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () => resolve({ name: f.name, text: String(r.result) });
      r.readAsText(f);
    };
    input.click();
  });
}

export function getPath(obj, path) {
  if (!path) return obj;
  const parts = String(path).split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function setPath(obj, path, value) {
  const parts = String(path).split(".").filter(Boolean);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object") cur[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

export function stripTags(html) {
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent || "").replace(/\s+/g, " ").trim();
}

export const sortBy = (arr, key, dir = 1) =>
  [...arr].sort((a, b) => {
    const x = typeof key === "function" ? key(a) : a?.[key];
    const y = typeof key === "function" ? key(b) : b?.[key];
    return String(x ?? "").localeCompare(String(y ?? ""), "fr", { numeric: true }) * dir;
  });

export function normalizeSpace(s) {
  return String(s ?? "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
}

// Copie dans le presse-papiers, avec repli pour les contextes sans API clipboard.
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e2) { return false; }
  }
}
