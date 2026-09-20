// ============================================================================
// L'assistant, à l'écran — la pastille de Plume dans l'atelier, celle de
// Publia sur le recueil.
//
// Une seule coquille pour les deux : un personnage posé dans un coin, une
// bulle qui propose une question de temps en temps (le clin d'œil à l'aide
// contextuelle d'autrefois), et un panneau de conversation. Ce qui change d'un
// assistant à l'autre, c'est ce qu'il SAIT — et cela ne se règle pas ici, mais
// dans src/lib/assistant.js et Administration › Assistants.
//
// Ce qui SE RÈGLE, en revanche : le NOM et L'ICÔNE (Administration › Assistants,
// par l'administrateur) — la coquille les relit à chaque redessin, sans être
// reconstruite, pour que le changement se voie sans recharger la page ; et
// l'assistant LUI-MÊME, que chaque agent peut éteindre pour son compte dans le
// menu de son nom (une préférence de poste : voir `assistantsChooser`).
//
// Les réponses de l'assistant contiennent des LIENS : le guide pour l'atelier
// (« #/aide/<id> »), un acte du recueil pour Publia (« ?acte=<clé> »). On les
// intercepte ici et on les ouvre par le routeur — le lecteur reste dans
// l'application, sans recharger la page et sans onglet de plus.
// ============================================================================
import { h, clear, icon } from "./dom.js";
import { renderMarkdown } from "./markdown.js";
import { state, onChange, emit, navigate } from "./state.js";
import { ASSISTANTS, ASSISTANT_IDS, assistantSettings, assistantIdentite, assistantActif, assistantVisible, assistantPref, reglerPrefAssistant, moteurDe, repondre } from "../lib/assistant.js";
import { estVisiteur } from "../lib/users.js";
import { get } from "../lib/remote.js";

// L'état de chaque conversation vit ici, hors du DOM : il survit donc aux
// redessins de l'application (navigation, journal, changement de référentiel),
// et ne survit pas à un rechargement — une conversation d'aide n'est pas une
// donnée que l'on conserve.
const sessions = {
  atelier: { messages: [], ouvert: false, occupe: false, arret: null, bulleVue: false, notices: false },
  public: { messages: [], ouvert: false, occupe: false, arret: null, bulleVue: false, notices: false, publications: null, chargement: null },
};

const LIBELLES_ECRAN = {
  trames: "Trames", trame: "Éditeur de trame", rediger: "Rédiger un acte", actes: "Actes",
  acte: "Détail d'un acte", modifier: "Modifier un acte", signature: "Signature & publication",
  delegations: "Organigramme des délégations",
  publications: "Publications (ELI)", publication: "Consultation d'une publication",
  execution: "Exécution & délais", revision: "Révision", parapheur: "Parapheur",
  referentiel: "Administration", styles: "Feuilles de style", comptes: "Comptes et rôles",
  corbeille: "Corbeille", connexion: "Connexion", aide: "Guide d'utilisation",
  docs: "Documentation technique", recueil: "Recueil public", sansacces: "Mon accès",
};

// ------------------------------------------------------------------ fabrique
// Les identités courantes, par assistant : la coquille est bâtie UNE fois, mais
// le nom et l'icône se relisent à chaque redessin (l'administrateur peut les
// changer pendant que la page est ouverte).
const identites = {};

function construire(qui) {
  const d = ASSISTANTS[qui];
  let ide = assistantIdentite(state.config, qui);
  const s = sessions[qui];

  const fil = h("div", { class: "assist__fil", role: "log", "aria-live": "polite", "aria-label": "Conversation" });
  const suggestions = h("div", { class: "assist__suggestions" });
  const champ = h("textarea", {
    class: "assist__champ", rows: 2, placeholder: d.placeholder, "aria-label": d.placeholder,
    on: { keydown: (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); } } },
  });
  const boutonEnvoyer = h("button", { class: "fr-btn fr-btn--primary fr-btn--sm", type: "submit", text: "Envoyer" });
  const boutonArreter = h("button", {
    class: "fr-btn fr-btn--tertiary fr-btn--sm", type: "button", hidden: true, text: "Arrêter",
    on: { click: () => { s.arret?.abort(); } },
  });
  const avertissement = h("div", { class: "fr-alert fr-alert--warning assist__avertissement", hidden: true });
  const saisie = h("form", {
    class: "assist__saisie",
    on: { submit: (e) => { e.preventDefault(); envoyer(); } },
  }, champ, h("div", { class: "assist__actions" }, boutonArreter, boutonEnvoyer));

  const panneau = h("div", { class: "assist__panneau", hidden: true, role: "dialog", "aria-label": d.titre },
    h("header", { class: "assist__tete" },
      h("img", { class: "assist__avatar", src: ide.avatar, alt: "" }),
      h("div", { class: "assist__ident" },
        h("strong", { class: "assist__nom", text: ide.nom }),
        h("span", { class: "assist__titre", text: d.titre })),
      h("div", { class: "assist__tete-outils" },
        h("button", { class: "fr-btn fr-btn--tertiary fr-btn--icon fr-btn--sm", type: "button", title: "Effacer la conversation", "aria-label": "Effacer la conversation", on: { click: () => effacer() } }, icon("trash", 15)),
        h("button", { class: "fr-btn fr-btn--tertiary fr-btn--icon fr-btn--sm", type: "button", title: "Fermer", "aria-label": "Fermer", on: { click: () => ouvrir(false) } }, icon("x", 16)))),
    fil,
    h("footer", { class: "assist__pied" }, suggestions, avertissement, saisie,
      h("p", { class: "assist__note", text: d.note })));

  const bulleTexte = h("span", { class: "assist__bulle-texte" });
  const bulleTete = h("span", { class: "assist__bulle-tete", text: ide.nom + " propose" });
  const bulle = h("div", { class: "assist__bulle", hidden: true },
    h("button", {
      class: "assist__bulle-corps", type: "button",
      on: { click: () => { const q = bulle.dataset.question || ""; ouvrir(true); bulle.hidden = true; if (q) envoyer(q); } },
    }, bulleTete, bulleTexte),
    h("button", { class: "assist__bulle-fermer", type: "button", title: "Masquer", "aria-label": "Masquer", on: { click: () => { s.bulleVue = true; bulle.hidden = true; } } }, icon("x", 12)));

  const pastille = h("button", {
    class: "assist__pastille", type: "button", title: d.titre + " — cliquez pour ouvrir la conversation",
    "aria-label": d.titre, "aria-expanded": "false",
    on: { click: () => ouvrir(!s.ouvert) },
  }, h("img", { class: "assist__avatar-assis", src: ide.avatar, alt: "" }), h("span", { class: "assist__pastille-nom", text: ide.nom }));

  const racine = h("div", { class: "assist assist--" + qui, hidden: true, "data-assistant": qui }, bulle, panneau, pastille);

  // Le nom et l'icône se relisent : l'administrateur peut les changer pendant
  // que la page est ouverte, et le changement doit se voir sans la recharger.
  // Les images portent toutes la classe `assist__avatar*` (le portrait du
  // panneau, celui de la pastille, et le petit des messages).
  identites[qui] = () => {
    const neuf = assistantIdentite(state.config, qui);
    if (neuf.nom === ide.nom && neuf.avatar === ide.avatar) return;
    ide = neuf;
    for (const img of racine.querySelectorAll("img[class^='assist__avatar'], img.assist__mini")) img.src = ide.avatar;
    for (const el of racine.querySelectorAll(".assist__nom, .assist__pastille-nom")) el.textContent = ide.nom;
    bulleTete.textContent = ide.nom + " propose";
  };

  // ------------------------------------------------------- les liens des réponses
  // Un lien des réponses est INTERNE quand il vise le guide (« #/aide/<id> ») ou
  // un acte du recueil (l'adresse de la page, « ?acte=<clé> ») : on l'ouvre par
  // le routeur — le lecteur reste dans l'application, la page ne se recharge pas,
  // et aucun onglet ne s'ouvre. Tout le reste (adresse extérieure, fichier) est
  // laissé au navigateur.
  racine.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const lien = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!lien || !racine.contains(lien)) return;
    const route = routeInterne(lien.getAttribute("href"));
    if (!route) return;
    e.preventDefault();
    e.stopPropagation();
    ouvrir(false);
    navigate(route.path, route.extra);
  });

  // ---------------------------------------------------------------- affichage
  function defiler() { fil.scrollTop = fil.scrollHeight; }

  function bulleDe(role, contenu, { attente = false } = {}) {
    const corps = h("div", { class: "assist__contenu" });
    if (attente) corps.appendChild(h("span", { class: "assist__points" }, h("i"), h("i"), h("i")));
    else if (contenu) corps.appendChild(renderMarkdown(contenu));
    fil.appendChild(h("div", { class: "assist__msg assist__msg--" + (role === "user" ? "moi" : "bot") },
      role === "user" ? null : h("img", { class: "assist__mini", src: ide.avatar, alt: "" }),
      corps));
    defiler();
    return corps;
  }

  function peindreFil() {
    clear(fil);
    if (!s.messages.length) bulleDe("assistant", d.accueil);
    else for (const m of s.messages) bulleDe(m.role, m.texte);
    defiler();
  }

  function peindreSuggestions() {
    clear(suggestions);
    const reglages = assistantSettings(state.config, qui);
    // Sur le recueil, quand un acte est ouvert, ses propres questions passent en
    // tête : elles montrent au lecteur ce qu'il peut demander de CET acte.
    const surUnActe = qui === "public" && !!cleConsultee();
    const liste = [
      ...(surUnActe ? QUESTIONS_ACTE : []),
      ...(reglages.prompts || []).filter((p) => p && p.texte),
    ];
    const montrer = liste.length && !s.messages.length && moteurDe(state.config, qui).type !== "aucun";
    suggestions.hidden = !montrer;
    if (!montrer) return;
    for (const p of liste) {
      suggestions.appendChild(h("button", {
        class: "assist__suggestion", type: "button", text: p.label || p.texte,
        on: { click: () => envoyer(p.texte) },
      }));
    }
  }

  // Le moteur manque, ou l'assistant est éteint : on le dit, plutôt que de
  // laisser une zone de saisie qui ne répondrait jamais.
  function peindreDisponibilite() {
    const moteur = moteurDe(state.config, qui);
    const indisponible = moteur.type === "aucun";
    avertissement.hidden = !indisponible;
    saisie.hidden = indisponible;
    if (!indisponible) return;
    clear(avertissement);
    avertissement.appendChild(h("p", { class: "fr-alert__title", text: "L'assistant n'a pas de moteur" }));
    avertissement.appendChild(h("p", { class: "fr-small", text: moteur.raison }));
    if (state.user && !estVisiteur(state.user)) {
      avertissement.appendChild(h("p", {},
        h("button", {
          class: "fr-btn fr-btn--tertiary fr-btn--sm", type: "button", text: "Régler les assistants",
          on: { click: () => { ouvrir(false); state.ui = state.ui || {}; state.ui.refTab = "assistants"; navigate("referentiel"); } },
        })));
    }
  }

  function majBoutons() {
    boutonArreter.hidden = !s.occupe;
    boutonEnvoyer.disabled = s.occupe;
    champ.disabled = s.occupe;
    racine.classList.toggle("is-occupe", s.occupe);
  }

  function effacer() {
    s.messages = [];
    peindreFil();
    peindreSuggestions();
  }

  function ouvrir(valeur) {
    s.ouvert = valeur !== false;
    panneau.hidden = !s.ouvert;
    pastille.setAttribute("aria-expanded", s.ouvert ? "true" : "false");
    racine.classList.toggle("is-ouvert", s.ouvert);
    if (s.ouvert) {
      bulle.hidden = true;
      s.bulleVue = true;
      peindreDisponibilite();
      peindreSuggestions();
      if (!fil.childElementCount) peindreFil();
      champ.focus();
      defiler();
    }
  }

  // ------------------------------------------------------------- la question
  async function envoyer(questionForcee) {
    if (s.occupe) return;
    const texte = String(questionForcee != null ? questionForcee : champ.value || "").trim();
    if (!texte) return;
    champ.value = "";
    s.messages.push({ role: "user", texte });
    bulleDe("user", texte);
    const historique = s.messages.slice(0, -1).map((m) => ({ role: m.role, texte: m.texte }));
    const cible = bulleDe("assistant", null, { attente: true });
    s.occupe = true;
    majBoutons();
    peindreSuggestions();

    const controleur = new AbortController();
    s.arret = controleur;
    let courant = "";
    let dernier = 0;
    const peindre = () => {
      const t = Date.now();
      if (t - dernier < 60) return;
      dernier = t;
      clear(cible);
      cible.appendChild(renderMarkdown(courant));
      defiler();
    };

    try {
      const publications = qui === "public" ? await publicationsPubliques() : null;
      const acteCourant = qui === "public" ? await acteConsulte() : null;
      const reponse = await repondre({
        config: state.config, qui, question: texte, historique,
        ecran: state.route?.view || "", ecranLabel: LIBELLES_ECRAN[state.route?.view] || "",
        publications, acteCourant, signal: controleur.signal,
        onChunk: (ajout, complet) => { courant = complet || (courant + ajout); peindre(); },
      });
      courant = String(reponse || courant || "").trim();
      clear(cible);
      if (courant) cible.appendChild(renderMarkdown(courant));
      else cible.appendChild(h("p", { class: "fr-muted", text: "Pas de réponse." }));
      s.messages.push({ role: "assistant", texte: courant });
      defiler();
    } catch (e) {
      clear(cible);
      if (e && e.name === "AbortError") {
        if (courant.trim()) {
          cible.appendChild(renderMarkdown(courant));
          s.messages.push({ role: "assistant", texte: courant.trim() });
        } else {
          cible.appendChild(h("p", { class: "fr-muted", text: "Réponse interrompue." }));
        }
      } else {
        const raison = (e && (e.raison || e.message)) || String(e);
        cible.appendChild(h("div", { class: "fr-alert fr-alert--warning" },
          h("p", { class: "fr-alert__title", text: "Pas de réponse" }),
          h("p", { class: "fr-small", text: raison })));
      }
      defiler();
    } finally {
      s.occupe = false;
      s.arret = null;
      majBoutons();
      peindreSuggestions();
    }
  }

  // La bulle d'invitation : un clin d'œil à l'aide contextuelle d'autrefois —
  // elle propose une question de temps en temps, jamais deux fois de suite.
  if (!s.bulleVue) {
    setTimeout(() => {
      if (s.bulleVue || s.ouvert || s.messages.length) return;
      const liste = (assistantSettings(state.config, qui).prompts || []).filter((p) => p && p.texte);
      if (!liste.length || moteurDe(state.config, qui).type === "aucun") return;
      const p = liste[Math.floor(Math.random() * liste.length)];
      bulleTexte.textContent = p.texte;
      bulle.dataset.question = p.texte;
      bulle.hidden = false;
      s.bulleVue = true;
    }, qui === "atelier" ? 14000 : 20000);
  }

  peindreFil();
  return racine;
}

// ------------------------------------------------------------------ les liens
// Un lien interne : le guide (« #/aide/<id> ») ou un acte du recueil (l'adresse
// de la page elle-même, « ?acte=<clé> »). Rendus par `renderMarkdown`, ces liens
// portent un libellé lisible — jamais une adresse technique.
function routeInterne(href) {
  const h = String(href || "").trim();
  if (h.startsWith("#/")) { const r = h.slice(2); return r ? { path: r } : null; }
  try {
    const url = new URL(h, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname) return null;
    const cle = url.searchParams.get("acte");
    if (cle) return { path: "recueil/" + encodeURIComponent(cle), extra: url.searchParams.get("format") ? { format: url.searchParams.get("format") } : {} };
    if (url.searchParams.has("recueil")) return { path: "recueil" };
  } catch (e) { /* adresse illisible : on laisse le navigateur faire */ }
  return null;
}

// L'acte que le visiteur consulte : sa route le dit. C'est lui que Publia reçoit
// en entier (texte et versions), pour répondre sur son contenu, sa portée, ses
// modifications — sans qu'on ait à lui demander de quoi on parle.
const cleConsultee = () =>
  (state.route?.view === "recueil" && state.route.params?.id ? decodeURIComponent(state.route.params.id) : "");

// Les questions proposées sur l'acte consulté : elles ne remplacent pas celles de
// l'administrateur, elles les précèdent quand un acte est ouvert.
const QUESTIONS_ACTE = [
  { id: "acte-prevoit", label: "Que prévoit cet acte ?", texte: "Que prévoit l'acte que je consulte ? Faites-m'en un résumé." },
  { id: "acte-modifie", label: "A-t-il été modifié ?", texte: "L'acte que je consulte a-t-il été modifié ou remplacé depuis sa publication ?" },
  { id: "acte-quand", label: "Depuis quand s'applique-t-il ?", texte: "À partir de quand l'acte que je consulte s'applique-t-il, et qui est concerné ?" },
];

// ------------------------------------------------------- les actes publiés
// Ce que l'assistant du recueil reçoit : la liste des publications, telle que
// le recueil l'affiche déjà. On la lit dans le registre public — jamais dans
// les actes de l'atelier : il n'y a donc rien à filtrer, et rien à craindre.
//
// Le registre ne donne que les métadonnées ; les actes les plus récents sont
// relus un par un pour que leur TEXTE accompagne la liste. C'est ce qui permet
// à l'assistant de répondre « que prévoit cet acte ? » — et ces textes-là sont
// publics, le recueil les affiche à qui les demande.
const ACTES_DETAILLES = 8;

async function publicationsPubliques() {
  const s = sessions.public;
  if (Array.isArray(s.publications)) return s.publications;
  if (!s.chargement) {
    s.chargement = (async () => {
      let liste = Array.isArray(state.recueil?.liste) ? state.recueil.liste : null;
      if (!liste) {
        const r = await get("/v1/publications", { label: "Assistant du recueil", source: "lecture" }).catch(() => null);
        liste = r && r.ok ? (r.body.publications || []) : [];
      }
      const recents = liste.filter((p) => p && p.latest !== false).slice(0, ACTES_DETAILLES);
      await Promise.all(recents.map(async (p) => {
        if (!p.cle || p.formats) return;
        try {
          const r = await get("/v1/publications/" + encodeURIComponent(p.cle), { label: "Acte publié", source: "lecture" });
          if (r.ok && r.body && r.body.formats) p.formats = r.body.formats;
        } catch (e) { /* l'extrait manquera : la question restera sans réponse de fond */ }
      }));
      s.publications = liste;
      return liste;
    })().finally(() => { s.chargement = null; });
  }
  return s.chargement;
}

// L'acte CONSULTÉ, en entier : sa fiche (métadonnées), ses versions publiées
// sous le même identifiant, et son texte. On préfère l'enregistrement que la vue
// du recueil a déjà lu — c'est le même —, et à défaut on le demande au registre.
// Rien de plus que ce que le recueil affiche déjà à qui ouvre l'acte.
async function acteConsulte() {
  const cle = cleConsultee();
  if (!cle) return null;
  const deja = state.recueil?.actes?.["#" + cle];
  if (deja && !deja.chargement && !deja.erreur) return deja;
  try {
    const r = await get("/v1/publications/" + encodeURIComponent(cle), { label: "Acte consulté", source: "lecture" });
    return r.ok && r.body ? r.body : null;
  } catch (e) { return null; }
}

// ------------------------------------------------------------------ montage
let monte = false;

// Les deux pastilles vivent dans la page, hors de la coquille : elles ne sont
// donc pas reconstruites à chaque redessin, et la conversation ne se perd pas
// quand on change d'écran. C'est leur VISIBILITÉ qui suit la route.
export function monterAssistants() {
  if (monte) return;
  monte = true;
  const atelier = construire("atelier");
  const public_ = construire("public");
  document.body.appendChild(atelier);
  document.body.appendChild(public_);

  const maj = () => {
    const vue = state.route?.view || "";
    const publicRoute = vue === "recueil";
    atelier.hidden = !(state.ready && state.user && !estVisiteur(state.user) && !publicRoute && assistantVisible(state.config, state.user, "atelier"));
    public_.hidden = !(state.ready && publicRoute && assistantVisible(state.config, state.user, "public"));
    // Le nom et l'icône peuvent avoir changé : on les relit.
    identites.atelier?.();
    identites.public?.();
  };
  onChange(maj);
  maj();
}

// ------------------------------------------------- le réglage de l'agent
// Chaque agent peut ÉTEINDRE un assistant pour son seul compte : c'est une
// préférence de POSTE (comme l'apparence claire ou sombre), et non un réglage de
// l'installation — l'administrateur, lui, les allume ou les éteint pour tout le
// monde dans Administration › Assistants (voir src/lib/assistant.js). Ce bloc se
// pose dans le menu du compte (voir src/ui/app.js).
export function assistantsChooser() {
  const u = state.user;
  if (!u) return null;
  const dispo = ASSISTANT_IDS.filter((qui) => assistantActif(state.config, qui));
  if (!dispo.length) return null;
  const wrap = h("div", { class: "app-user__assist" },
    h("div", { class: "app-user__assistlabel" },
      icon("bulle", 13), h("span", { text: "Assistants" })));
  const row = h("div", { class: "app-user__assists" });
  for (const qui of dispo) {
    const ide = assistantIdentite(state.config, qui);
    const allume = assistantPref(qui, u.id);
    row.appendChild(h("button", {
      class: "app-user__assistbtn" + (allume ? " is-on" : ""),
      type: "button",
      "aria-pressed": allume ? "true" : "false",
      title: (allume ? "Masquer " + ide.nom : "Afficher " + ide.nom) + " pour votre compte (« " + ide.titre + " »)",
      on: { click: () => { reglerPrefAssistant(qui, u.id, !allume); emit(); } },
    },
      h("img", { class: "app-user__assistimg" + (allume ? "" : " is-off"), src: ide.avatar, alt: "" }),
      h("span", { text: ide.nom }),
      icon(allume ? "eye" : "x", 13)));
  }
  wrap.appendChild(row);
  return wrap;
}
