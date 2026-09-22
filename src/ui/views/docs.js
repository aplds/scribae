// ============================================================================
// Documentation technique — lire les documents du dépôt depuis l'application.
//
// `src/docs/ADMINISTRATION.md`, `src/server/README.md`, `SPEC.md`, `LICENSE.md`…
// décrivent l'exploitation, la sécurité, les sauvegardes, l'auto-hébergement, la
// licence. Ils vivent dans les fichiers du logiciel : cet écran les rend
// consultables là où on les cherche — dans l'application — sans dépôt ni
// éditeur de texte.
//
// Les fichiers sont lus à la demande (jamais embarqués dans le code) puis mis
// en cache pour la session ; ils sont affichés bruts et téléchargeables tels
// quels, pour être joints à un dossier d'exploitation.
// ============================================================================
import { state, navigate } from "../state.js";
import { h, clear, button, toast } from "../dom.js";
import { emptyState } from "../components.js";
import { renderMarkdown, outlineOf } from "../markdown.js";
import { copyText, download } from "../../lib/util.js";
import { printHtml } from "../../lib/export.js";
import { CHANGELOG_PATH, versionLabel, releasedLabel } from "../../lib/version.js";

// Les documents du dépôt, dans l'ordre où un responsable informatique les
// ouvre : d'abord l'exploitation, ensuite l'installation, enfin la conception.
const DOCUMENTS = [
  {
    id: "changelog", group: "Suivi",
    path: CHANGELOG_PATH, title: "Journal des versions",
    desc: "Ce qui a changé, version par version, et depuis quand. La première entrée datée est la version en service.",
  },
  {
    id: "administration", group: "Exploitation",
    path: "src/docs/ADMINISTRATION.md", title: "Administration et exploitation",
    desc: "Où vivent les données, sécurité, sauvegardes, migration depuis la démonstration, limites.",
  },
  {
    id: "installation", group: "Exploitation",
    path: "src/server/README.md", title: "Installer l'application (Docker)",
    desc: "La pile nginx + service Node + MariaDB, les volumes, les sauvegardes, la mise en service.",
  },
  {
    id: "service", group: "Exploitation",
    path: "src/server/mysql/README.md", title: "Service de données (MySQL / MariaDB)",
    desc: "Le schéma de la base, les routes du service, l'édition du conteneur.",
  },
  {
    id: "variables", group: "Exploitation",
    path: "src/docs/VARIABLES.md", title: "Variables de déploiement",
    desc: "Toutes les variables du fichier .env — service et référentiel —, leur rôle, leur type et leurs bornes. Document engendré.",
  },
  {
    id: "api", group: "Exploitation",
    path: "src/docs/API.md", title: "API REST — référence",
    desc: "Toutes les routes de l'API : rôle exigé, paramètres, corps, réponses, champs et exemple cURL. Document engendré.",
  },
  {
    id: "docker", group: "Exploitation",
    path: "src/docs/DOCKER.md", title: "Construire une image Docker autonome",
    desc: "Bâtir une image unique (service + façade + application), la publier sur un registre, et la lancer.",
  },
  {
    id: "industrialisation", group: "Exploitation",
    path: "src/docs/INDUSTRIALISATION.md", title: "Vérifier, tester, livrer",
    desc: "Les commandes de vérification, ce qui est testé sans navigateur, la CI, et ce qui reste à mettre en place.",
  },
  {
    id: "spec", group: "Conception",
    path: "src/SPEC.md", title: "Spécification fonctionnelle",
    desc: "Ce que fait le logiciel, écran par écran, et ce qui n'y est pas.",
  },
  {
    id: "readme", group: "Conception",
    path: "src/README.md", title: "Notes de développement",
    desc: "Architecture du code, rôle de chaque module, partis pris techniques.",
  },
  {
    id: "todo", group: "Conception",
    path: "src/TODO.md", title: "Chantiers ouverts",
    desc: "Ce qui reste à faire, par ordre d'importance, et pourquoi.",
  },
  {
    id: "licence", group: "Conception",
    path: "src/LICENSE.md", title: "Licence",
    desc: "Le régime du logiciel, les conditions de réutilisation des actes publiés, et le statut du code produit par l'IA.",
  },
];

const findDoc = (id) => DOCUMENTS.find((d) => d.id === id) || DOCUMENTS[0];
// Les documents sont lus une fois par session : ils ne changent pas sous les
// pieds de l'utilisateur, et un aller-retour réseau par clic serait inutile.
const cache = (state.docTech = state.docTech || { texte: {} });

// ---------------------------------------------------------------- lecture
async function load(doc) {
  if (cache.texte[doc.id] != null) return cache.texte[doc.id];
  const res = await fetch(doc.path);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const text = await res.text();
  cache.texte[doc.id] = text;
  return text;
}

// ------------------------------------------------------------------ écran
export function renderDocs(root, params) {
  const doc = findDoc(params && params.id);

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Documentation technique" }),
      h("p", { class: "page-head__sub", text: "Les documents livrés avec le logiciel : exploitation, installation, conception. Lecture directe, sans dépôt ni éditeur de texte." }),
    ),
    h("div", { class: "page-head__actions" },
      h("span", {
        class: "fr-badge fr-badge--brand",
        title: "Version du logiciel en service, livrée le " + releasedLabel(),
        text: versionLabel() + " · " + releasedLabel(),
      }),
      button("Guide d'utilisation", { variant: "secondary", icon: "info", onClick: () => navigate("aide") }),
    ),
  ));

  const grid = h("div", { class: "docs-grid" });
  const side = h("div", { class: "docs-side" });
  const body = h("div", { class: "docs-body" });
  grid.appendChild(side);
  grid.appendChild(body);
  root.appendChild(grid);

  // --- sommaire des documents
  const sideCard = h("div", { class: "fr-card fr-card--soft" }, h("h2", { class: "fr-card__title", text: "Documents" }));
  let lastGroup = "";
  for (const d of DOCUMENTS) {
    if (d.group !== lastGroup) {
      lastGroup = d.group;
      sideCard.appendChild(h("p", { class: "docs-side__group", text: d.group }));
    }
    sideCard.appendChild(h("button", {
      class: "docs-side__item" + (d.id === doc.id ? " is-on" : ""),
      onClick: () => navigate("docs/" + d.id),
    },
      h("strong", { text: d.title }),
      h("span", { class: "fr-small fr-muted", text: d.path }),
    ));
  }
  side.appendChild(sideCard);

  // --- document courant
  const head = h("div", { class: "fr-card fr-card--soft docs-head" },
    h("div", { class: "docs-head__text" },
      h("h2", { class: "fr-card__title", text: doc.title }),
      h("p", { class: "fr-small fr-muted", text: doc.desc }),
      h("p", { class: "docs-path" }, h("code", { text: doc.path })),
    ),
    h("div", { class: "fr-row docs-head__actions" },
      button("Copier le chemin", { variant: "tertiary", size: "sm", icon: "copy", title: doc.path, onClick: () => copyText(doc.path).then(() => toast("Chemin copié : " + doc.path, "success")) }),
      button("Imprimer", { variant: "tertiary", size: "sm", onClick: () => printCurrent(doc) }),
      button("Télécharger", { variant: "tertiary", size: "sm", icon: "download", onClick: () => downloadText(doc) }),
    ),
  );
  body.appendChild(head);

  const view = h("div", { class: "fr-card docs-view" });
  body.appendChild(view);

  view.appendChild(h("p", { class: "fr-small fr-muted docs-loading" },
    h("span", { class: "spinner", "aria-hidden": "true" }), " Lecture du document…"));

  load(doc).then((text) => {
    clear(view);
    const outline = outlineOf(text);
    if (outline.length) {
      const som = h("nav", { class: "docs-toc" }, h("strong", { text: "Sommaire" }));
      for (const o of outline) {
        som.appendChild(h("a", {
          href: "#" + o.id, class: "docs-toc__link" + (o.level === 3 ? " is-sub" : ""), text: o.title,
          onClick: (e) => {
            e.preventDefault();
            const target = view.querySelector("#" + CSS.escape(o.id));
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
          },
        }));
      }
      view.appendChild(som);
    }
    view.appendChild(h("article", { class: "md" }, renderMarkdown(text)));
  }).catch((err) => {
    clear(view);
    view.appendChild(emptyState(
      "Le document « " + doc.path + " » n'a pas pu être lu (" + err.message + ").",
      null,
    ));
    view.appendChild(h("p", { class: "fr-small fr-muted", text: "Le fichier fait partie du logiciel : ouvrez-le depuis les fichiers du générateur, ou depuis le dépôt si vous l'avez téléchargé. Dans un aperçu non enregistré, certains navigateurs ne peuvent pas servir les fichiers sources tant que le générateur n'a pas été enregistré." }));
  });

  // L'ancre visée par un lien du sommaire reste visible malgré l'en-tête collant.
  view.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='#']");
    if (!a || a.classList.contains("docs-toc__link")) return;
    const target = view.querySelector(a.getAttribute("href"));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
}

// --------------------------------------------------------------- utilitaires
function textOf(doc) {
  return cache.texte[doc.id] || "";
}

function downloadText(doc) {
  const text = textOf(doc);
  if (!text) { toast("Document pas encore lu.", "warning"); return; }
  download(doc.path.split("/").pop(), text, "text/markdown");
}

// Impression du document seul : le texte mis en forme, avec son chemin en
// en-tête — c'est ce qui identifie la pièce dans un dossier d'exploitation ou
// une remise à un prestataire.
function printCurrent(doc) {
  const text = textOf(doc);
  if (!text) { toast("Document pas encore lu.", "warning"); return; }
  printHtml(printableHtml(doc, text));
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function printableHtml(doc, text) {
  const rendered = h("article", { class: "md" }, renderMarkdown(text));
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>${escapeHtml(doc.title)}</title>
<style>
body { margin: 0; background: #fff; color: #161616; font-family: Georgia, "Times New Roman", serif; font-size: 11.5pt; line-height: 1.5; }
.doc { max-width: 17cm; margin: 0 auto; padding: 1.5cm 0; }
.doc-src { font-family: system-ui, sans-serif; font-size: .78rem; color: #666; margin: 0 0 1.4em; }
h1, h2, h3, h4 { font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; line-height: 1.25; break-after: avoid; }
h1 { font-size: 1.5em; }
h2 { font-size: 1.2em; margin-top: 1.5em; border-bottom: 1px solid #ddd; padding-bottom: .2em; }
h3 { font-size: 1.03em; margin-top: 1.2em; }
p { margin: 0 0 .7em; text-align: justify; }
ul, ol { margin: 0 0 .9em; padding-left: 1.3em; }
li { margin-bottom: .2em; }
table { border-collapse: collapse; width: 100%; font-size: .85em; margin: 0 0 1em; font-family: system-ui, sans-serif; }
th, td { border: 1px solid #bbb; padding: 4px 7px; text-align: left; vertical-align: top; }
th { background: #f2f4f7; }
pre { background: #f6f6f6; border: 1px solid #e0e0e0; border-radius: 3px; padding: 8px 10px; overflow-x: auto; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .8em; line-height: 1.35; }
code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .9em; }
blockquote { margin: 0 0 1em; padding: 6px 12px; border-left: 3px solid #bbb; color: #444; }
hr { border: 0; border-top: 1px solid #ddd; margin: 1.6em 0; }
@page { size: A4 portrait; margin: 18mm; }
</style></head><body>
<div class="doc">
<h1>${escapeHtml(doc.title)}</h1>
<p class="doc-src">${escapeHtml(doc.path)} — Scribae</p>
${rendered.innerHTML}
</div>
</body></html>`;
}

// Utilisée par le guide : « la documentation technique des administrateurs ».
export const DOC_TECH = { id: DOCUMENTS[0].id, title: DOCUMENTS[0].title, path: DOCUMENTS[0].path };
