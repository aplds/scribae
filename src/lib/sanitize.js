// ============================================================================
// Assainissement du HTML publié.
//
// Le texte d'un acte publié arrive du RECUEIL — donc d'une donnée que
// l'application n'a pas forcément produite elle-même. Le poser tel quel dans la
// page (`innerHTML`) exécuterait le script qu'un client y aurait laissé : c'est
// une injection HTML stockée, et la victime est le visiteur du recueil public.
//
// `assainirHtml` fait donc ce que fait un assainisseur : il ANALYSE le fragment
// (avec DOMParser, qui n'exécute rien), puis retire tout ce qui peut exécuter
// du code — balises actives, attributs `on…`, adresses `javascript:` — en
// conservant la mise en forme du document (titres, listes, tableaux, liens,
// images, classes et styles en ligne, qui ne peuvent exécuter que du CSS).
//
// Ce n'est pas une liste d'interdits (elle serait toujours incomplète) mais une
// liste d'AUTORISÉS : ce qui n'y figure pas disparaît, y compris les balises
// qu'un futur navigateur inventerait.
// ============================================================================

const TAGS_AUTORISEES = new Set([
  "a", "abbr", "article", "aside", "b", "blockquote", "br", "caption", "cite", "code", "col", "colgroup",
  "dd", "del", "dfn", "div", "dl", "dt", "em", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4",
  "h5", "h6", "header", "hr", "i", "img", "ins", "kbd", "li", "main", "mark", "nav", "ol", "p", "pre",
  "q", "s", "samp", "section", "small", "span", "strong", "sub", "summary", "sup", "table", "tbody",
  "td", "tfoot", "th", "thead", "time", "tr", "u", "ul", "var", "wbr",
]);

// Attributs de présentation et de structure. Les identifiants et les classes
// sont conservés pour que la mise en page du recueil s'applique ; ils ne
// peuvent rien exécuter.
const ATTRS_AUTORISES = new Set([
  "class", "id", "title", "lang", "dir", "role", "alt", "width", "height", "colspan", "rowspan", "scope",
  "start", "reversed", "datetime", "cite", "value", "type", "src", "href", "target", "rel", "style",
]);

const ADRESSES_SURES = /^(?:https?:|mailto:|tel:|#|\/|\.{0,2}\/)/i;

export function adresseSure(valeur, estSource) {
  const brut = String(valeur == null ? "" : valeur);
  // Les navigateurs ignorent espaces et caractères de contrôle dans un schéma :
  // « java\tscript: » est du JavaScript. On normalise donc AVANT de juger.
  const s = brut.replace(/[\u0000-\u0020\u00a0]+/g, "").toLowerCase();
  if (!s) return true;
  if (s.startsWith("javascript:") || s.startsWith("vbscript:") || s.startsWith("blob:")) return false;
  if (s.startsWith("data:")) {
    // Seules les images matricielles sont admises, et seulement comme SOURCE.
    // `data:image/svg+xml` est écarté : un SVG peut porter du script.
    return !!estSource && /^data:image\/(png|jpe?g|gif|webp|avif);/i.test(s);
  }
  return ADRESSES_SURES.test(s);
}

function styleSure(valeur) {
  const s = String(valeur == null ? "" : valeur);
  const n = s.replace(/[\u0000-\u0020\u00a0]+/g, "").toLowerCase();
  // `expression()` (ancien IE) et une `url()` en javascript: n'ont rien à faire
  // dans une déclaration de style.
  return !/expression\(|javascript:|vbscript:|behavior:/.test(n);
}

// Renvoie un fragment HTML SÛR (jamais exécutable) : c'est ce que la page
// publique peut poser avec `innerHTML`.
export function assainirHtml(html) {
  const source = String(html == null ? "" : html);
  if (!source) return "";
  if (typeof DOMParser === "undefined") {
    // Pas d'analyseur : on retire tout, plutôt que de risquer d'exécuter.
    return "";
  }
  let doc;
  try { doc = new DOMParser().parseFromString(source, "text/html"); }
  catch (e) { return ""; }
  if (!doc || !doc.body) return "";

  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    const tag = el.tagName.toLowerCase();
    if (!TAGS_AUTORISEES.has(tag)) {
      // On retire la balise active avec son contenu : un <script> ne doit pas
      // laisser son texte dans la page, même inerte.
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const nom = attr.name.toLowerCase();
      if (nom.startsWith("on")) { el.removeAttribute(attr.name); continue; }
      if (nom === "style") {
        if (!styleSure(attr.value)) el.removeAttribute(attr.name);
        continue;
      }
      if (nom === "href" || nom === "src" || nom === "xlink:href" || nom === "action" || nom === "formaction" || nom === "poster") {
        if (!adresseSure(attr.value, nom === "src" || nom === "poster")) el.removeAttribute(attr.name);
        continue;
      }
      if (!ATTRS_AUTORISES.has(nom) && !nom.startsWith("aria-") && !nom.startsWith("data-")) {
        el.removeAttribute(attr.name);
      }
    }
    // Une cible `_blank` sans `rel` ouvre une porte à l'hameçonnage.
    if (el.tagName.toLowerCase() === "a") {
      const cible = el.getAttribute("target") || "";
      if (cible && cible !== "_self" && cible !== "_blank") el.setAttribute("target", "_blank");
      if ((el.getAttribute("target") || "") === "_blank") {
        const rel = new Set((el.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
        rel.add("noopener"); rel.add("noreferrer");
        el.setAttribute("rel", Array.from(rel).join(" "));
      }
    }
  }
  return doc.body.innerHTML;
}
