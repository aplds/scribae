// ============================================================================
// Informations — les billets publiés au recueil public.
//
// Un recueil d'actes dit ce qui fait droit. La rubrique « Informations » dit le
// reste : un changement d'horaires, une réunion publique, des travaux, une
// fermeture exceptionnelle, la parution d'un nouveau recueil. Ces nouvelles ne
// se signent pas et ne reçoivent pas d'identifiant ELI ; elles se publient.
//
// L'écran fait deux colonnes : à gauche les billets (recherche, état, plus
// récents d'abord, épinglés en tête), à droite le billet ouvert — son titre, sa
// date, son auteur, son résumé, son texte, et ses deux drapeaux (publié,
// épinglé). Un brouillon se garde sans se publier : c'est le geste ordinaire —
// on écrit d'abord, on publie ensuite. Publier un billet vide est refusé, et le
// service ne sert que les billets publiés (voir src/server/mysql/informations.mjs
// et GET /v1/informations).
//
// Rien ici n'est un acte : pas de numéro, pas de circuit, pas de signature, pas
// d'ELI. C'est ce qui rend la rubrique simple — et c'est ce qui la rend utile.
// ============================================================================
import { state, touch, redrawView, can, navigate } from "../state.js";
import { h, button, toast, icon } from "../dom.js";
import { textField, confirmDialog, emptyState } from "../components.js";
import { renderMarkdown } from "../markdown.js";
import { formatDate } from "../../lib/util.js";
import { fullName } from "../../lib/users.js";
import {
  nouvelleInformation, slugUnique, manquePourPublier, resumeInfo, minutesDeLecture,
  toutesInformations, informationsPubliees, informationsDeLAtelier,
} from "../../lib/informations.js";
import { adresseInfo } from "../../lib/recueil.js";

// La date du jour, au format attendu par les billets (AAAA-MM-JJ).
const aujourdHui = () => new Date().toISOString().slice(0, 10);
const idNeuf = () => "info-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Le recueil public a lu la liste des billets ; elle vient de changer sous lui.
// On invalide sa lecture pour qu'il la refasse — sans cela, un billet qu'on
// vient de publier n'apparaîtrait pas au public avant un rechargement de la
// page, alors que le propos de l'écran est justement de le rendre visible.
// (Le brouillon, lui, reste écarté : le recueil ne montre que le publié.)
function invaliderRecueil() {
  if (state.recueil) state.recueil.infos = null;
}

export function renderInformations(root) {
  const ui = (state.ui = state.ui || {});
  if (ui.infoQ === undefined) ui.infoQ = "";
  if (ui.infoEtat === undefined) ui.infoEtat = "";
  if (ui.infoSel === undefined) ui.infoSel = null;
  if (ui.infoApercu === undefined) ui.infoApercu = false;

  const gerer = can("informations.gerer");
  const liste = toutesInformations(state.informations);
  if (ui.infoSel && !liste.some((i) => i.id === ui.infoSel)) ui.infoSel = null;
  if (!ui.infoSel && liste.length) ui.infoSel = informationsDeLAtelier(liste)[0].id;

  root.appendChild(pageHead(gerer, liste));
  root.appendChild(h("div", { class: "infos" },
    colonneListe(liste, gerer),
    colonneBillet(liste, gerer)));
}

function pageHead(gerer, liste) {
  const publiees = informationsPubliees(liste).length;
  const brouillons = liste.length - publiees;
  return h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Informations publiées" }),
      h("p", { class: "page-head__sub", text: "Les nouvelles que la collectivité affiche sur son recueil public : actualités, avis, communications. "
        + "Un billet se publie sans être signé ni numéroté — il apparaît sur le site public dès qu'il est publié, à son adresse propre." })),
    h("div", { class: "page-head__actions" },
      h("span", { class: "fr-small fr-muted", text: `${publiees} publiée${publiees > 1 ? "s" : ""}${brouillons ? ", " + brouillons + " brouillon" + (brouillons > 1 ? "s" : "") : ""}` }),
      button("Voir le recueil public", { variant: "secondary", icon: "globe", onClick: () => navigate("recueil") }),
      gerer ? button("Nouvelle information", { variant: "primary", icon: "plus", onClick: creer }) : null));
}

function creer() {
  const info = nouvelleInformation({ auteur: fullName(state.user) || "", date: aujourdHui() });
  info.id = idNeuf();
  state.informations = [...(state.informations || []), info];
  state.ui.infoSel = info.id;
  state.ui.infoApercu = false;
  touch("informations");
  invaliderRecueil();
  redrawView();
}

// ---------------------------------------------------------------- la liste
function colonneListe(liste, gerer) {
  const ui = state.ui;
  const filtrees = filtrer(liste);
  const colonne = h("div", { class: "infos__liste" });
  colonne.appendChild(h("div", { class: "infos__filtres" },
    h("input", {
      class: "fr-input", type: "search", placeholder: "Rechercher un titre, un texte…", value: ui.infoQ,
      "aria-label": "Rechercher dans les informations",
      on: { input: (e) => { ui.infoQ = e.target.value; redrawListe(); } },
    }),
    (() => {
      const s = h("select", { class: "fr-select", "aria-label": "État des billets", on: { change: (e) => { ui.infoEtat = e.target.value; redrawListe(); } } });
      for (const [v, l] of [["", "Toutes"], ["publie", "Publiées"], ["brouillon", "Brouillons"]]) {
        const o = h("option", { value: v, text: l });
        if (v === ui.infoEtat) o.selected = true;
        s.appendChild(o);
      }
      return s;
    })()));
  const corps = h("div", { class: "infos__items" });
  if (!liste.length) {
    corps.appendChild(emptyState(gerer
      ? "Aucune information pour l'instant. « Nouvelle information » écrit le premier billet — il reste brouillon tant qu'on ne le publie pas."
      : "Aucune information publiée pour l'instant."));
  } else if (!filtrees.length) {
    corps.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun billet ne correspond à ce filtre." }));
  } else {
    for (const i of filtrees) corps.appendChild(itemListe(i));
  }
  colonne.appendChild(corps);

  // Seule la liste est reconstruite pendant la frappe : le champ garde le focus.
  function redrawListe() {
    const items = colonne.querySelector(".infos__items");
    if (!items) { redrawView(); return; }
    items.replaceChildren();
    const l = filtrer(state.informations);
    if (!l.length) items.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun billet ne correspond à ce filtre." }));
    for (const i of l) items.appendChild(itemListe(i));
  }
  return colonne;
}

function filtrer(liste) {
  const ui = state.ui;
  const q = String(ui.infoQ || "").trim().toLowerCase();
  return informationsDeLAtelier(liste).filter((i) => {
    if (ui.infoEtat === "publie" && !i.publie) return false;
    if (ui.infoEtat === "brouillon" && i.publie) return false;
    if (!q) return true;
    return [i.titre, i.resume, i.corps, i.auteur].filter(Boolean).join(" ").toLowerCase().includes(q);
  });
}

function itemListe(info) {
  const actif = state.ui.infoSel === info.id;
  const lien = h("button", {
    class: "infos__item" + (actif ? " is-on" : ""), type: "button",
    on: { click: () => { state.ui.infoSel = info.id; state.ui.infoApercu = false; redrawView(); } },
  },
    h("span", { class: "infos__item-haut" },
      h("span", { class: "fr-badge fr-badge--" + (info.publie ? "success" : "warning"), text: info.publie ? "Publiée" : "Brouillon" }),
      info.epingle ? h("span", { class: "fr-badge fr-badge--info", text: "Épinglée" }) : null),
    h("span", { class: "infos__item-titre", text: info.titre || "(sans titre)" }),
    h("span", { class: "infos__item-pied" },
      h("span", { text: info.date ? formatDate(info.date) : "sans date" }),
      h("span", { text: info.auteur || "" })));
  return lien;
}

// ---------------------------------------------------------------- le billet
function colonneBillet(liste, gerer) {
  const info = liste.find((i) => i.id === state.ui.infoSel);
  const colonne = h("div", { class: "infos__billet" });
  if (!info) {
    colonne.appendChild(h("div", { class: "fr-card infos__vide" },
      h("h2", { class: "fr-card__title", style: { margin: 0 }, text: "Aucun billet ouvert" }),
      h("p", { class: "fr-small fr-muted", style: { margin: "4px 0 0" }, text: gerer
        ? "Choisissez un billet dans la liste, ou créez-en un."
        : "Choisissez un billet dans la liste." })));
    return colonne;
  }

  const maj = (cle, valeur) => {
    // L'adresse du billet suit son titre TANT QU'il n'est pas publié ; une fois
    // publié, elle ne bouge plus — les liens déjà partagés continuent de mener au
    // billet, même si son titre est retouché.
    if (cle === "titre" && !info.publie) info.slug = slugUnique(valeur, state.informations, info.id);
    info[cle] = valeur;
    info.modifieLe = new Date().toISOString();
    touch("informations");
    invaliderRecueil();
    if (cle === "titre" || cle === "date" || cle === "auteur") redrawView();
  };

  const tete = h("div", { class: "infos__billet-tete" },
    h("div", { class: "infos__billet-titres" },
      h("span", { class: "fr-badge fr-badge--" + (info.publie ? "success" : "warning"), text: info.publie ? "Publiée" : "Brouillon" }),
      info.slug ? h("span", { class: "fr-small fr-muted fr-mono", text: "?info=" + info.slug }) : null),
    h("div", { class: "fr-row", style: { gap: "8px" } },
      info.slug ? h("a", {
        class: "fr-btn fr-btn--tertiary fr-btn--sm", href: adresseInfo(info.slug),
        target: "_blank", rel: "noopener noreferrer", title: "Ouvrir le billet sur le recueil public",
      }, icon("globe", 14), h("span", { text: "Voir" })) : null,
      button(state.ui.infoApercu ? "Écrire" : "Aperçu", {
        variant: "secondary", size: "sm", icon: "eye",
        onClick: () => { state.ui.infoApercu = !state.ui.infoApercu; redrawView(); },
      })));

  const corps = h("div", { class: "infos__billet-corps" });
  if (state.ui.infoApercu) {
    corps.appendChild(apercuBillet(info));
  } else if (!gerer) {
    corps.appendChild(h("p", { class: "fr-small fr-muted", text: "Vous consultez les informations : leur écriture demande la permission « informations.gerer »." }));
    corps.appendChild(lectureBillet(info));
  } else {
    corps.appendChild(formulaire(info, maj));
  }

  colonne.append(tete, corps);
  if (gerer) colonne.appendChild(actions(info, maj));
  return colonne;
}

function formulaire(info, maj) {
  const bloc = h("div", { class: "infos__form" });
  bloc.appendChild(textField({
    label: "Titre", value: info.titre, required: true,
    help: "Le titre devient l'adresse du billet (« ?info=… ») tant qu'il n'est pas publié : après publication, l'adresse ne change plus.",
    onChange: (v) => maj("titre", v),
  }));
  bloc.appendChild(h("div", { class: "infos__deux" },
    textField({ label: "Date", value: info.date, type: "date", help: "La date affichée sur le recueil. C'est elle qui ordonne les billets.", onChange: (v) => maj("date", v) }),
    textField({ label: "Auteur", value: info.auteur, placeholder: "Service communication", help: "Le service qui signe la communication.", onChange: (v) => maj("auteur", v) })));
  bloc.appendChild(textField({
    label: "Résumé", value: info.resume, rows: 3,
    placeholder: "Ce que l'on voit du billet dans la liste et sur la page d'accueil.",
    help: "Facultatif : sans résumé, la liste affiche le début du texte.", onChange: (v) => maj("resume", v),
  }));
  bloc.appendChild(textField({
    label: "Texte", value: info.corps, rows: 16,
    placeholder: "Le texte du billet. Markdown accepté : # titres, **gras**, listes à puces, tableaux, liens…",
    help: "Mise en forme Markdown.", onChange: (v) => maj("corps", v),
  }));
  bloc.appendChild(h("div", { class: "fr-row", style: { gap: "18px" } },
    caseACocher("Publiée sur le recueil public", info.publie, (v) => publier(info, maj, v)),
    caseACocher("Épinglée en tête", info.epingle, (v) => maj("epingle", v))));
  bloc.appendChild(h("p", { class: "fr-small fr-muted", text: info.modifieLe
    ? "Dernière modification : " + new Date(info.modifieLe).toLocaleString("fr-FR")
    : "Jamais modifiée depuis sa création." }));
  return bloc;
}

function caseACocher(label, valeur, onChange) {
  const input = h("input", { type: "checkbox", checked: !!valeur, on: { change: (e) => onChange(e.target.checked) } });
  return h("label", { class: "fr-check" }, input, h("span", { text: label }));
}

// Publier est un GESTE, pas une case : un billet sans titre ni texte n'a rien à
// faire sur le recueil, et le service refuserait de le servir. On le vérifie
// donc AVANT de poser le drapeau (voir `manquePourPublier`).
function publier(info, maj, valeur) {
  if (!valeur) { maj("publie", false); return; }
  const manques = manquePourPublier(info);
  if (manques.length) {
    toast("Pour publier, il faut un " + manques.join(", un ") + ".", "warning");
    redrawView();
    return;
  }
  if (!info.slug) info.slug = slugUnique(info.titre, state.informations, info.id);
  maj("publie", true);
  toast("Information publiée au recueil — elle est visible au public.", "success");
  redrawView();
}

function actions(info, maj) {
  return h("div", { class: "infos__actions" },
    button(info.publie ? "Dépublier" : "Publier", {
      variant: info.publie ? "secondary" : "primary",
      icon: info.publie ? "x" : "check",
      onClick: () => publier(info, maj, !info.publie),
    }),
    info.publie ? null : button("Aperçu", { variant: "tertiary", icon: "eye", onClick: () => { state.ui.infoApercu = true; redrawView(); } }),
    h("span", { class: "infos__actions-pousse" }),
    button("Supprimer", { variant: "tertiary", icon: "trash", onClick: () => supprimer(info) }));
}

async function supprimer(info) {
  const ok = await confirmDialog("Supprimer cette information ?", `« ${info.titre || "sans titre"} » sera retirée définitivement du recueil${info.publie ? " public" : ""}.`, { confirmLabel: "Supprimer", danger: true });
  if (!ok) return;
  state.informations = state.informations.filter((i) => i.id !== info.id);
  state.ui.infoSel = null;
  touch("informations");
  invaliderRecueil();
  toast("Information supprimée.", "success");
  redrawView();
}

// ------------------------------------------------------------------ aperçus
function apercuBillet(info) {
  const manques = manquePourPublier(info);
  return h("div", { class: "infos__apercu" },
    h("p", { class: "fr-small fr-muted", text: manques.length
      ? "Aperçu — il manque encore : " + manques.join(", ") + "."
      : "Aperçu du billet tel qu'il apparaîtra sur le recueil public." }),
    info.publie ? null : h("p", { class: "fr-small", text: "Ce billet est un BROUILLON : il n'apparaît pas sur le recueil public." }),
    lectureBillet(info));
}

function lectureBillet(info) {
  return h("article", { class: "infos__lecture" },
    h("p", { class: "infos__lecture-meta" },
      h("span", { text: info.date ? formatDate(info.date) : "sans date" }),
      info.auteur ? h("span", { text: " · " + info.auteur }) : null,
      h("span", { text: " · " + minutesDeLecture(info) + " min de lecture" })),
    h("h2", { class: "infos__lecture-titre", text: info.titre || "(sans titre)" }),
    resumeInfo(info) ? h("p", { class: "infos__lecture-chapo", text: resumeInfo(info) }) : null,
    h("div", { class: "md infos__lecture-corps" }, renderMarkdown(info.corps)));
}
