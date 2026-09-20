// ============================================================================
// Recherche globale — un seul champ pour tout l'outil.
//
// Actes, trames, personnes, services, références, comptes, chapitres du guide :
// une même requête, des résultats groupés. L'index est reconstruit à chaque
// ouverture (les données changent tout le temps), et le texte des actes est
// indexé en plus de leur titre : « garderie » trouve l'acte dont on a réécrit
// l'article, même si le mot n'est ni dans le numéro ni dans l'objet.
//
// Ouverture au clavier : Ctrl+K (ou Cmd+K), ou « / » quand on n'est pas déjà
// dans un champ de saisie.
// ============================================================================
import { state, navigate, can, visibleActes, visibleTrames } from "./state.js";
import { h, clear, icon } from "./dom.js";
import { renderDocument } from "../lib/render.js";
import { stripTags } from "../lib/util.js";
import { targetLabel } from "../lib/scope.js";
import { construireIndex, chercher } from "../lib/search.js";
import { GUIDE } from "../wiki.js";
import { docOfActe } from "./views/modifier.js";

const TEXTES_MAX = 120;

let overlay = null;

export function rechercheOuverte() {
  return !!overlay;
}

let retirerEcouteur = null;

export function fermerRecherche() {
  if (!overlay) return;
  if (retirerEcouteur) { retirerEcouteur(); retirerEcouteur = null; }
  overlay.remove();
  overlay = null;
}

// Échap ferme la recherche quelle que soit la cible du clavier (le focus peut
// quitter le champ sans quitter la superposition).
function ecouterEchap() {
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); fermerRecherche(); } };
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}

export function ouvrirRecherche(requeteDepart = "") {
  fermerRecherche();
  const index = construireIndex({
    config: state.config,
    actes: visibleActes(),
    trames: visibleTrames(),
    personnes: state.config?.people || [],
    references: state.config?.refs || [],
    services: state.config?.services || [],
    comptes: can("comptes.gerer") ? state.users : [],
    guide: (GUIDE.chapters || []).map((c) => ({ id: c.id, title: c.title, text: [c.short, c.keywords].filter(Boolean).join(" ") })),
    textes: textesDesActes(),
    libelleService: (id, bureauId) => targetLabel(state.config, id, bureauId),
  });

  const input = h("input", {
    class: "gs__input", type: "text", autocomplete: "off", spellcheck: "false",
    placeholder: "Rechercher un acte, une trame, une personne, une référence…",
    value: requeteDepart,
  });
  const resultats = h("div", { class: "gs__results" });
  const boite = h("div", { class: "gs__box", role: "dialog", "aria-label": "Recherche globale" },
    h("div", { class: "gs__bar" }, icon("info", 16), input, h("kbd", { class: "gs__kbd", text: "Échap" })),
    resultats,
    h("p", { class: "gs__help", text: "↑ ↓ pour parcourir · Entrée pour ouvrir · Échap pour fermer" }),
  );
  overlay = h("div", { class: "gs", on: { click: (e) => { if (e.target === overlay) fermerRecherche(); } } }, boite);
  document.body.appendChild(overlay);

  let courant = 0;
  let aplatis = [];

  const peindre = () => {
    clear(resultats);
    const q = input.value.trim();
    if (q.length < 2) {
      resultats.appendChild(h("p", { class: "gs__empty", text: "Tapez au moins deux lettres. La recherche porte sur le registre des actes, les trames, les personnes, les services, les références juridiques, les comptes et le guide." }));
      aplatis = [];
      return;
    }
    const groupes = chercher(index, q);
    if (!groupes.length) {
      resultats.appendChild(h("p", { class: "gs__empty", text: `Aucun résultat pour « ${q} ».` }));
      aplatis = [];
      return;
    }
    aplatis = groupes.flatMap((g) => g.items);
    if (courant >= aplatis.length) courant = 0;
    let i = 0;
    for (const g of groupes) {
      resultats.appendChild(h("div", { class: "gs__group", text: g.label }));
      for (const item of g.items) {
        const n = i++;
        resultats.appendChild(h("button", {
          class: "gs__item" + (n === courant ? " is-on" : ""),
          dataset: { i: String(n) },
          on: {
            click: () => ouvrir(aplatis[n]),
            mouseenter: () => { courant = n; marquer(); },
          },
        },
          iconeDe(item.kind),
          h("span", { class: "gs__item-text" },
            h("span", { class: "gs__item-title", text: item.titre || "(sans titre)" }),
            item.sous ? h("span", { class: "gs__item-sub", text: item.sous }) : null),
          item.statut ? h("span", { class: "fr-badge", text: libelleStatut(item.statut) }) : null,
        ));
      }
    }
    marquer();
  };

  const marquer = () => {
    resultats.querySelectorAll(".gs__item").forEach((el) => el.classList.toggle("is-on", Number(el.dataset.i) === courant));
    const on = resultats.querySelector(".gs__item.is-on");
    if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
  };

  const ouvrir = (item) => {
    if (!item) return;
    if (item.kind === "personne" || item.kind === "service" || item.kind === "reference") {
      state.ui = { ...(state.ui || {}), refTab: item.extra?.tab || "identite" };
    }
    fermerRecherche();
    navigate(item.route);
  };

  input.addEventListener("input", () => { courant = 0; peindre(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (aplatis.length) { courant = (courant + 1) % aplatis.length; marquer(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (aplatis.length) { courant = (courant - 1 + aplatis.length) % aplatis.length; marquer(); } }
    else if (e.key === "Enter") { e.preventDefault(); ouvrir(aplatis[courant]); }
    else if (e.key === "Escape") { e.preventDefault(); fermerRecherche(); }
  });
  overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerRecherche(); });
  retirerEcouteur = ecouterEchap();

  peindre();
  input.focus();
  if (!requeteDepart) input.select();
}

// Le texte des actes : document compilé, ramené à du texte brut. Indexé en
// entier pour une poignée d'actes, tronqué au-delà (le titre suffit alors, et
// l'index reste rapide même sur un gros registre).
function textesDesActes() {
  const out = {};
  const actes = [...visibleActes()].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  for (const a of actes.slice(0, TEXTES_MAX)) {
    try {
      const doc = docOfActe(a);
      if (!doc) continue;
      out[a.id] = stripTags(renderDocument(doc, state.config, {}).outerHTML).slice(0, 4000);
    } catch (e) { /* un acte illisible n'empêche pas la recherche */ }
  }
  return out;
}

function iconeDe(kind) {
  const map = { acte: "doc", trame: "doc", personne: "eye", service: "grid", reference: "list", compte: "lock", guide: "info" };
  return h("span", { class: "gs__item-icon" }, icon(map[kind] || "info", 15));
}

function libelleStatut(s) {
  const map = { brouillon: "brouillon", pret: "prêt", en_signature: "en signature", signee: "signé", publie: "publié", draft: "brouillon", published: "publiée", archived: "archivée" };
  return map[s] || s;
}

// Raccourcis d'ouverture, posés une fois au démarrage de l'application.
export function installerRaccourcis() {
  document.addEventListener("keydown", (e) => {
    const cible = e.target;
    const saisie = cible && (cible.tagName === "INPUT" || cible.tagName === "TEXTAREA" || cible.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "k") {
      e.preventDefault();
      ouvrirRecherche();
      return;
    }
    if (e.key === "/" && !saisie && !overlay) {
      e.preventDefault();
      ouvrirRecherche();
    }
  });
}
