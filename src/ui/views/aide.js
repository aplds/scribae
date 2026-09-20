import { state, navigate } from "../state.js";
import { h, clear, button, icon, toast } from "../dom.js";
import { GUIDE, SHOTS, findChapter, chapterIndex, searchGuide } from "../../wiki.js";
import { APP_NAME, markEl } from "../brand.js";

// ============================================================================
// Guide d'utilisation (wiki intégré). Le contenu vit dans src/wiki.js : ce
// fichier ne fait que le mettre en page. Public visé : agents peu à l'aise avec
// l'informatique — d'où les grandes étapes numérotées, les encadrés et les
// captures légendées.
// ============================================================================

// Mini-mise en forme du contenu : **gras** et `code`.
function rich(text) {
  const frag = document.createDocumentFragment();
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const p of parts) {
    if (!p) continue;
    if (p.startsWith("**") && p.endsWith("**")) frag.appendChild(h("strong", { text: p.slice(2, -2) }));
    else if (p.startsWith("`") && p.endsWith("`")) frag.appendChild(h("code", { class: "gkbd", text: p.slice(1, -1) }));
    else frag.appendChild(document.createTextNode(p));
  }
  return frag;
}

const chip = (text, cls = "") => h("span", { class: "gchip " + cls, text });

function shotBlock(b) {
  const shot = SHOTS[b.shot] || {};
  const box = h("figure", { class: "gshot" });
  if (shot.url) {
    const wrap = h("div", { class: "gshot__frame" });
    wrap.appendChild(h("img", { src: shot.url, alt: shot.caption || "" }));
    for (const m of shot.marks || []) {
      // boîte en pointillés autour de l'élément visé + pastille numérotée sur un
      // coin (jamais par-dessus le libellé), ramenée à l'intérieur du cadre si
      // l'élément touche un bord de l'image.
      const nearLeft = (m.x - m.w / 2) < 1.8;
      const nearTop = (m.y - m.h / 2) < 3.2;
      wrap.appendChild(h("span", { class: "gshot__box", style: { left: m.x + "%", top: m.y + "%", width: m.w + "%", height: m.h + "%" } },
        h("span", { class: "gshot__mark", style: { left: nearLeft ? "100%" : "0%", top: nearTop ? "100%" : "0%" }, text: String(m.n) })));
    }
    box.appendChild(wrap);
  } else {
    box.appendChild(h("div", { class: "gshot__pending", text: "Illustration à venir" }));
  }
  if (shot.caption) box.appendChild(h("figcaption", { class: "gshot__caption", text: shot.caption }));
  if (shot.marks && shot.marks.length) {
    box.appendChild(h("ol", { class: "gshot__legend" }, ...shot.marks.map((m) =>
      h("li", {}, h("span", { class: "gshot__num", text: String(m.n) }), rich(m.label)))));
  }
  return box;
}

function mailMock() {
  const row = (n, label, value, cls = "") => h("div", { class: "gmail__row " + cls },
    h("span", { class: "gshot__num", text: String(n) }),
    h("span", { class: "gmail__label", text: label }),
    h("span", { class: "gmail__value", text: value }));
  return h("div", { class: "gmail" },
    h("div", { class: "gmail__bar" }, "Nouveau message"),
    h("div", { class: "gmail__body" },
      row(1, "À", "prenom.nom@exemple.fr"),
      row(2, "Objet", "Acte 2026-401 — pour signature"),
      row(3, "Votre message", "Bonjour, veuillez trouver ci-joint l'arrêté de nomination pour signature."),
      h("div", { class: "gmail__row" },
        h("span", { class: "gshot__num", text: "4" }),
        h("span", { class: "gmail__label", text: "Pièce jointe" }),
        h("span", { class: "gmail__attach" }, icon("note", 14), h("span", { text: "decision-2026-401.pdf" }))),
      h("div", { class: "gmail__row" },
        h("span", { class: "gshot__num", text: "5" }),
        h("span", { class: "gmail__label", text: "" }),
        h("span", { class: "gmail__send", text: "Envoyer" })),
    ),
    h("p", { class: "gshot__caption", text: "À quoi ressemble un message prêt à partir : l'adresse, un objet clair, une phrase, le fichier joint, puis Envoyer." }),
  );
}

function contactBlock() {
  const b = state.config.brand || {};
  const lines = [b.supportName, b.supportPhone, b.supportEmail].filter(Boolean);
  return h("div", { class: "gcontact" },
    h("h3", { class: "gcontact__title" }, icon("info", 16), h("span", { text: "Besoin d'aide ?" })),
    lines.length
      ? h("p", { text: "En cas de blocage, contactez : " + lines.join(" — ") })
      : h("p", { text: "En cas de blocage, adressez-vous à l'administrateur de l'application. Ses coordonnées n'ont pas encore été renseignées (on les ajoute dans Référentiel → Identité, champs « Contact d'aide »)." }),
    h("p", { class: "fr-small fr-muted", text: "Avant d'appeler, notez le message affiché à l'écran : cela fait gagner beaucoup de temps." }),
  );
}

function blockNode(b) {
  switch (b.t) {
    case "p":
      return h("p", { class: "gtext" }, rich(b.text));
    case "steps":
      return h("ol", { class: "gsteps" }, ...b.items.map((it) =>
        h("li", { class: "gstep" }, h("div", { class: "gstep__text" }, rich(it.text)),
          it.detail ? h("div", { class: "gstep__detail" }, rich(it.detail)) : null)));
    case "stepscard":
      return h("div", { class: "gcard gcard--steps" },
        h("h3", { class: "gcard__title", text: b.title }),
        h("ol", { class: "gsteps gsteps--compact" }, ...b.items.map((it) => h("li", { class: "gstep" }, h("div", { class: "gstep__text" }, rich(it))))));
    case "list":
      return h("ul", { class: "glist" }, ...b.items.map((it) => h("li", {}, rich(it))));
    case "note":
      return h("div", { class: "gnote gnote--" + (b.kind || "info") },
        h("h3", { class: "gnote__title" }, icon(b.kind === "warn" ? "warn" : b.kind === "ok" ? "check" : "info", 16), h("span", { text: b.title })),
        h("p", {}, rich(b.text)));
    case "terms":
      return h("dl", { class: "gterms" }, ...b.items.flatMap((it) => [
        h("dt", { class: "gterms__term", text: it.term }),
        h("dd", { class: "gterms__def" }, rich(it.def)),
      ]));
    case "table": {
      const t = h("table", { class: "gtable" });
      t.appendChild(h("thead", {}, h("tr", {}, ...b.head.map((c) => h("th", { text: c })))));
      t.appendChild(h("tbody", {}, ...b.rows.map((r) => h("tr", {}, ...r.map((c) => h("td", {}, rich(c))))))); 
      return h("div", { class: "fr-table-wrap" }, t);
    }
    case "faq":
      return h("div", { class: "gfaq" }, ...b.items.map((it) =>
        h("details", { class: "gfaq__item" },
          h("summary", { class: "gfaq__q", text: it.q }),
          h("p", { class: "gfaq__a" }, rich(it.a)))));
    case "shot":
      return shotBlock(b);
    case "svg":
      return b.name === "mail" ? mailMock() : null;
    case "colors":
      return h("div", { class: "gcard" },
        h("h3", { class: "gcard__title", text: "Le code des couleurs" }),
        h("ul", { class: "glist" },
          h("li", {}, h("span", { class: "gdot gdot--ok" }), rich("**Vert** : c'est bon, vous pouvez continuer.")),
          h("li", {}, h("span", { class: "gdot gdot--ko" }), rich("**Rouge** : quelque chose bloque l'export. Lisez le message, corrigez la case.")),
          h("li", {}, h("span", { class: "gdot gdot--warn" }), rich("**Orange** : c'est à vérifier, mais vous pouvez continuer.")),
        ));
    case "contact":
      return contactBlock();
    case "next":
      return h("div", { class: "gnext" },
        h("span", { class: "fr-small fr-muted", text: "À lire ensuite" }),
        button(b.label, { variant: "primary", icon: "down", onClick: () => navigate("aide/" + b.chapter) }));
    default:
      return null;
  }
}

// ------------------------------------------------------------------- chapitre
function renderChapter(root, chapter) {
  const i = chapterIndex(chapter.id);
  const prev = GUIDE.chapters[i - 1];
  const next = GUIDE.chapters[i + 1];

  root.appendChild(h("div", { class: "guide gchapter" },
    h("div", { class: "gchapter__head" },
      button("Guide d'utilisation", { variant: "tertiary", icon: "list", onClick: () => navigate("aide") }),
      h("div", { class: "fr-spacer" }),
      button("Imprimer ce chapitre", { variant: "secondary", icon: "download", size: "sm", onClick: () => printGuide(chapter.id) }),
    ),
    h("div", { class: "gchapter__meta" },
      h("span", { class: "gcount", text: `Étape ${i + 1} sur ${GUIDE.chapters.length}` }),
      h("span", { class: "gtime", text: `⏱ ${chapter.minutes} min de lecture` }),
      chapter.audience === "admin" ? chip("Pour les administrateurs", "gchip--admin") : chip("Pour tout le monde"),
    ),
    h("h1", { class: "gchapter__title", text: chapter.title }),
    h("p", { class: "gchapter__lead", text: chapter.short }),
    h("div", { class: "gchapter__body" }, ...chapter.blocks.map(blockNode).filter(Boolean)),
    h("div", { class: "gnav" },
      h("p", { class: "gnav__hint fr-small fr-muted" },
        (prev ? "Précédent : " + prev.title : "") + (prev && next ? "   ·   " : "") + (next ? "Suivant : " + next.title : "")),
      prev ? button("◀ Précédent", { variant: "secondary", onClick: () => navigate("aide/" + prev.id) }) : button("Sommaire du guide", { variant: "secondary", onClick: () => navigate("aide") }),
      h("div", { class: "fr-spacer" }),
      next ? button("Suivant ▶", { variant: "primary", onClick: () => navigate("aide/" + next.id) }) : button("Revenir au sommaire", { variant: "secondary", onClick: () => navigate("aide") }),
    ),
  ));
}

// --------------------------------------------------------------------- sommaire
function chapterCard(c) {
  const i = chapterIndex(c.id);
  return h("div", { class: "gcard gcard--link", on: { click: () => navigate("aide/" + c.id) } },
    h("div", { class: "gcard__row" },
      h("span", { class: "gcard__num", text: String(i + 1) }),
      h("div", { class: "gcard__text" },
        h("h3", { class: "gcard__title", text: c.title }),
        h("p", { class: "gcard__sub", text: c.short }),
        h("div", { class: "gcard__tags" },
          h("span", { class: "fr-small fr-muted", text: `⏱ ${c.minutes} min` }),
          c.audience === "admin" ? chip("Administrateurs", "gchip--admin") : null,
        ),
      ),
      h("span", { class: "gcard__go" }, icon("down", 16)),
    ));
}

function renderHome(root) {
  const box = h("div", { class: "guide" });
  const b = state.config.brand || {};
  box.appendChild(h("div", { class: "guide__hero" },
    h("div", { class: "guide__hero-text" },
      h("p", { class: "guide__brand" }, markEl(20), h("span", { text: APP_NAME })),
      h("h1", { class: "guide__title", text: GUIDE.title }),
      h("p", { class: "guide__sub", text: GUIDE.subtitle }),
      h("p", { class: "fr-small fr-muted", text: (b.name ? b.name + " · " : "") + "Mise à jour : " + GUIDE.updated }),
    ),
    h("div", { class: "guide__hero-actions" },
      button("Commencer (2 min)", { variant: "primary", icon: "info", onClick: () => navigate("aide/demarrer") }),
      button("Imprimer tout le guide", { variant: "secondary", icon: "download", onClick: () => printGuide(null) }),
    ),
  ));

  // recherche
  const results = h("div");
  const input = h("input", { class: "fr-input guide__search", type: "search", placeholder: "Chercher un mot : exporter, numéro, mot de passe…" });
  const paint = () => {
    const found = searchGuide(input.value);
    if (!input.value.trim()) { results.hidden = true; clear(results); return; }
    clear(results);
    results.hidden = false;
    results.appendChild(h("p", { class: "fr-small fr-muted", text: found.length ? `${found.length} chapitre(s) parlent de « ${input.value} »` : `Aucun chapitre ne parle de « ${input.value} ».` }));
    for (const c of found) results.appendChild(chapterCard(c));
  };
  input.addEventListener("input", paint);
  results.hidden = true;
  box.appendChild(h("div", { class: "guide__searchbox" }, h("label", { class: "fr-label", text: "Chercher dans le guide" }), input, results));

  // parcours guidés
  box.appendChild(h("div", { class: "guide__paths" }, ...GUIDE.pathways.map((p) =>
    h("div", { class: "gpath" },
      h("h3", { class: "gpath__title", text: p.label }),
      h("p", { class: "gpath__hint", text: p.hint }),
      h("div", { class: "gpath__links" }, ...p.chapters.map((id) => {
        const c = findChapter(id);
        return c ? h("button", { class: "gpath__link", on: { click: () => navigate("aide/" + id) }, text: c.title }) : null;
      })),
    ))));

  box.appendChild(h("h2", { class: "guide__h2", text: "Tous les chapitres" }));
  box.appendChild(h("div", { class: "guide__cards" }, ...GUIDE.chapters.map(chapterCard)));

  // Les informaticiens ne cherchent pas dans le guide d'utilisation : on leur
  // ouvre la documentation d'exploitation depuis l'écran où ils arrivent.
  box.appendChild(h("div", { class: "guide__tech fr-card fr-card--soft" },
    h("div", { class: "guide__tech-text" },
      h("h2", { class: "fr-card__title", text: "Documentation technique (administrateurs)" }),
      h("p", { class: "fr-small fr-muted", text: "Où vivent les données, sécurité, sauvegardes, installation auto-hébergée, migration depuis la démonstration : les documents livrés avec le logiciel, lisibles ici même." })),
    h("div", { class: "fr-row" },
      button("Ouvrir la documentation", { variant: "secondary", icon: "doc", onClick: () => navigate("docs") }),
      button("Installation (Docker)", { variant: "tertiary", size: "sm", onClick: () => navigate("docs/installation") }),
    )));

  box.appendChild(contactBlock());
  root.appendChild(box);
}

// ---------------------------------------------------------------------- export
// Version imprimable : on réutilise le CSS déjà présent dans la page (app.js le
// recopie dans un <style> au démarrage) et le rendu DOM des chapitres, pour ne
// pas maintenir deux mises en page différentes.
export function guidePrintableHtml(scope) {
  const chapters = scope ? [findChapter(scope)].filter(Boolean) : GUIDE.chapters;
  const holder = h("div", { class: "guide" });
  const b = state.config.brand || {};
  holder.appendChild(h("div", { class: "guide__hero" },
    h("p", { class: "guide__brand" }, markEl(20), h("span", { text: APP_NAME })),
    h("h1", { class: "guide__title", text: GUIDE.title }),
    h("p", { class: "guide__sub", text: GUIDE.subtitle }),
    h("p", { class: "fr-small", text: (b.name ? b.name + " · " : "") + "Mise à jour : " + GUIDE.updated })));
  for (const c of chapters) {
    const i = chapterIndex(c.id);
    holder.appendChild(h("div", { class: "gchapter gchapter--print" },
      h("div", { class: "gchapter__meta" },
        h("span", { class: "gcount", text: `Étape ${i + 1} sur ${GUIDE.chapters.length}` }),
        h("span", { class: "gtime", text: `⏱ ${c.minutes} min de lecture` })),
      h("h1", { class: "gchapter__title", text: c.title }),
      h("p", { class: "gchapter__lead", text: c.short }),
      h("div", { class: "gchapter__body" }, ...c.blocks.map(blockNode).filter(Boolean))));
  }
  const css = [...document.querySelectorAll("style")].map((s) => s.textContent).join("\n");
  const brand = (state.config.brand && state.config.brand.name) || "";
  const title = (scope ? findChapter(scope)?.title + " — " : "") + GUIDE.title + (brand ? " (" + brand + ")" : "");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${css}</style>` +
    `<style>body{background:#fff;text-align:left;margin:0}.guide{width:21cm;max-width:100%;margin:0 auto;padding:18px 22px}` +
    `.gchapter{page-break-after:always}.gchapter:last-child{page-break-after:auto}.gchapter--print{box-shadow:none;border:0}` +
    `@media print{@page{size:A4 portrait;margin:20mm 18mm}.gnav,.gchapter__head{display:none}.guide{width:auto;max-width:none;padding:0}.gchapter{break-after:page}}</style></head><body>${holder.outerHTML}</body></html>`;
}

// Impression du guide (chapitre seul ou complet) : onglet dédié, repli iframe.
export function printGuide(scope) {
  const html = guidePrintableHtml(scope);
  let win = null;
  try { win = window.open("", "_blank"); } catch (e) { win = null; }
  if (win && win.document) {
    win.document.open(); win.document.write(html); win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch (e) {} }, 500);
    toast("Guide ouvert dans un nouvel onglet", "success");
    return "onglet";
  }
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const d = frame.contentDocument;
  d.open(); d.write(html); d.close();
  const go = () => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) {} setTimeout(() => frame.remove(), 1500); };
  if (d.readyState === "complete") setTimeout(go, 300); else frame.onload = () => setTimeout(go, 300);
  return "iframe";
}

// Utilisé par les outils de vérification / la fabrication d'un fichier à partager.
if (typeof window !== "undefined") window.__guidePrintableHtml = guidePrintableHtml;

// ----------------------------------------------------------------------- route
export function renderAide(root, params) {
  const chapter = params && params.id ? findChapter(params.id) : null;
  const el = h("div");
  root.appendChild(el);
  if (chapter) renderChapter(el, chapter);
  else renderHome(el);
}
