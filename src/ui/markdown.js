// ============================================================================
// Markdown → DOM, pour la documentation technique livrée avec le logiciel.
//
// Les fichiers `docs/ADMINISTRATION.md`, `SPEC.md`, `README.md`… sont écrits
// pour être lus dans un dépôt : ils ne servent à rien s'ils restent invisibles
// depuis l'application. Ce module les rend lisibles dans l'écran
// « Documentation technique » (voir `ui/views/docs.js`).
//
// Le sous-ensemble couvert est exactement celui qu'utilisent ces fichiers :
// titres (#, ##, ###), paragraphes, listes à puces et numérotées, tableaux,
// blocs de code délimités par ```, citations, traits de séparation, et en ligne
// **gras**, *italique*, `code` et [liens](url).
//
// Tout le texte est inséré par `h()`, donc en nœuds texte : aucune balise du
// fichier n'est interprétée comme du HTML.
// ============================================================================
import { h } from "./dom.js";

// ------------------------------------------------------------------ en ligne
// Les marqueurs sont traités de gauche à droite, et le contenu d'un gras ou
// d'un italique est rendu récursivement (il contient souvent du `code`).
function inline(text) {
  const out = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok[0] === "`") {
      out.push(h("code", { class: "md-code", text: tok.slice(1, -1) }));
    } else if (tok.startsWith("**")) {
      out.push(h("strong", {}, inline(tok.slice(2, -2))));
    } else if (tok[0] === "*") {
      out.push(h("em", {}, inline(tok.slice(1, -1))));
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      out.push(h("a", { href: link[2], rel: "noreferrer noopener", target: "_blank", text: link[1] }));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Dans un tableau, `\|` est un tube échappé : il appartient à la cellule et ne
// la coupe pas (c'est ainsi qu'on écrit un tube dans un bout de code).
const cells = (line) => {
  const body = line.replace(/^\||\|$/g, "");
  const out = [];
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\" && body[i + 1] === "|") { cur += "|"; i++; continue; }
    if (c === "|") { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
};
const isSeparator = (line) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes("-");

// ------------------------------------------------------------------- blocs
// `decalage` décale d'un cran les titres du document (1 → les `#` se rendent en
// `h2`) : un document AFFICHÉ DANS un écran se range sous le titre de l'écran,
// et la classe suit le niveau (`md-h2`), donc l'apparence aussi — décaler la
// seule balise laisserait le titre du document à la taille d'un titre de page.
export function renderMarkdown(text, opts = {}) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const frag = document.createDocumentFragment();
  const decalage = Math.max(0, Number(opts.decalage) || 0);
  let i = 0;

  // Les ancres d'un même document doivent être UNIQUES : la chronique des
  // versions répète ses rubriques (« Corrigé », « Modifié »…), et deux titres
  // portant la même ancre donneraient des identifiants dupliqués — un document
  // invalide, et un sommaire qui mène au mauvais titre. Le premier garde
  // l'ancre, les suivants prennent un rang ; `outlineOf` compte exactement de
  // la même façon, sinon le sommaire viserait à côté.
  const ancres = new Map();
  const ancre = (texte) => {
    const base = slug(texte);
    const n = (ancres.get(base) || 0) + 1;
    ancres.set(base, n);
    return n === 1 ? base : base + "-" + n;
  };

  // Une ligne « qui continue » (alinéa d'un paragraphe ou d'un point de liste)
  // n'est pas un nouveau bloc : on la recolle à ce qui précède.
  const isBlockStart = (l, n) =>
    /^\s{0,3}```/.test(l) || /^#{1,6}\s/.test(l) || /^---+\s*$/.test(l) ||
    /^[-*]\s+/.test(l) || /^\d+[.)]\s+/.test(l) || /^>\s?/.test(l) ||
    (/^\|/.test(l) && isSeparator(lines[n + 1] || ""));

  // Un bloc de code peut être décalé de quelques espaces : c'est le cas des
  // commandes placées sous un point de liste. Le retrait du délimiteur est
  // retiré du contenu (sinon la première ligne part à droite).
  const fence = (start) => {
    const m = /^(\s{0,3})```(.*)$/.exec(lines[start]);
    const indent = m[1];
    const buf = [];
    let n = start + 1;
    while (n < lines.length && !/^\s{0,3}```\s*$/.test(lines[n])) {
      buf.push(lines[n].startsWith(indent) ? lines[n].slice(indent.length) : lines[n]);
      n++;
    }
    return { node: h("pre", { class: "md-pre" }, h("code", { text: buf.join("\n") })), next: n + 1 };
  };

  const paragraph = (start) => {
    const buf = [];
    let n = start;
    while (n < lines.length && lines[n].trim() && !isBlockStart(lines[n], n)) { buf.push(lines[n].trim()); n++; }
    return { node: h("p", {}, inline(buf.join(" "))), next: n };
  };

  const list = (start, ordered) => {
    const node = h(ordered ? "ol" : "ul", { class: "md-list" });
    const re = ordered ? /^(\d+)[.)]\s+(.*)$/ : /^[-*]\s+(.*)$/;
    let n = start;
    // Une liste interrompue (par un bloc de code, une citation) reprend à son
    // numéro : sans `start`, Markdown renuméroterait « 1, 2 » une suite qui
    // commençait à « 2, 3 ».
    if (ordered) {
      const first = re.exec(lines[start]);
      if (first && first[1] !== "1") node.setAttribute("start", first[1]);
    }
    while (n < lines.length) {
      const m = re.exec(lines[n]);
      if (!m) break;
      const buf = [ordered ? m[2] : m[1]];
      n++;
      while (n < lines.length && lines[n].trim() && !re.exec(lines[n]) && !isBlockStart(lines[n], n)) {
        buf.push(lines[n].trim());
        n++;
      }
      node.appendChild(h("li", {}, inline(buf.join(" "))));
    }
    return { node, next: n };
  };

  const table = (start) => {
    const node = h("table", { class: "md-table" });
    node.appendChild(h("thead", {}, h("tr", {}, ...cells(lines[start]).map((c) => h("th", {}, inline(c))))));
    const body = h("tbody");
    let n = start + 2;
    while (n < lines.length && /^\|/.test(lines[n])) {
      body.appendChild(h("tr", {}, ...cells(lines[n]).map((c) => h("td", {}, inline(c)))));
      n++;
    }
    node.appendChild(body);
    return { node: h("div", { class: "md-table-wrap" }, node), next: n };
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^\s{0,3}```/.test(line)) {
      const r = fence(i);
      frag.appendChild(r.node);
      i = r.next;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(4, heading[1].length + decalage);
      frag.appendChild(h("h" + level, { class: "md-h md-h" + level, id: ancre(heading[2]) }, inline(heading[2].replace(/\*\*/g, ""))));
      i++;
      continue;
    }

    if (/^---+\s*$/.test(line)) { frag.appendChild(h("hr", { class: "md-hr" })); i++; continue; }

    if (/^\|/.test(line) && isSeparator(lines[i + 1] || "")) {
      const r = table(i);
      frag.appendChild(r.node);
      i = r.next;
      continue;
    }

    if (/^[-*]\s+/.test(line)) { const r = list(i, false); frag.appendChild(r.node); i = r.next; continue; }
    if (/^\d+[.)]\s+/.test(line)) { const r = list(i, true); frag.appendChild(r.node); i = r.next; continue; }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      frag.appendChild(h("blockquote", { class: "md-quote" }, h("p", {}, inline(buf.join(" ")))));
      continue;
    }

    const r = paragraph(i);
    frag.appendChild(r.node);
    i = r.next > i ? r.next : i + 1;
  }
  return frag;
}

// Ancre lisible pour un titre (« § 4.3 Sécurité » → « 4-3-securite »).
export function slug(text) {
  return "md-" + String(text).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

// Sommaire du document : les titres de niveau 2 et 3, dans l'ordre. Les ancres
// sont numérotées comme au rendu (`renderMarkdown`), tous niveaux confondus :
// le sommaire mène donc toujours au titre qu'il nomme.
export function outlineOf(text) {
  const out = [];
  const ancres = new Map();
  const ancre = (t) => {
    const base = slug(t);
    const n = (ancres.get(base) || 0) + 1;
    ancres.set(base, n);
    return n === 1 ? base : base + "-" + n;
  };
  for (const line of String(text || "").split("\n")) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!m) continue;
    const id = ancre(m[2]);
    if (m[1].length >= 2 && m[1].length <= 3) out.push({ level: m[1].length, title: m[2].replace(/\*\*/g, ""), id });
  }
  return out;
}
