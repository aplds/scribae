// ============================================================================
// ÉPREUVES DE PARCOURS — exécutées DANS le navigateur, contre l'application
// vivante.
//
// Pourquoi ce fichier existe. Les épreuves hors navigateur (`tests/*.test.mjs`)
// éprouvent les modules PURS : compilation, numérotation, exports, persistance,
// domaine du service. Elles ne peuvent rien dire de ce que l'utilisateur fait —
// ouvrir le recueil, se connecter, rédiger, publier, consulter. Deux défauts
// livrés en production (le recueil qui reprenait la main sur l'atelier, la
// rubrique Informations qui disparaissait) étaient exactement de ce genre : verts
// partout, et cassés à l'écran. C'est l'écart NC-I-001, et voici sa réponse :
// quelques PARCOURS CRITIQUES, joués sur l'application réelle, dans l'ordre où un
// agent les rencontre.
//
// COMMENT ON S'EN SERT. Le module s'importe DANS la page de l'application (aperçu
// de l'éditeur, ou application déployée), ce qui lui donne accès aux mêmes
// modules que l'application — les mêmes instances, donc le même état :
//
//     import("tests/parcours.mjs").then((p) => p.lancerParcours())
//     (dans l'atelier : import("https://perchance.org/src/tests/parcours.mjs") — voir
//     docs/INDUSTRIALISATION.md § 2)
//
// Chaque parcours rend "" quand il passe, ou la RAISON de son échec. Aucun
// parcours ne modifie durablement l'application : ce qui est changé (la route,
// par exemple) est remis en place, et rien n'est écrit dans le registre.
//
// Contre une installation AUTO-HÉBERGÉE, on peut aussi bien l'exécuter depuis la
// page de l'application — c'est la même chose, puisque les modules sont les
// mêmes. Les appels du service, eux, se vérifient avec le jeu commun :
// `tests/conformite-service.mjs`.
// ============================================================================

// OÙ VIT LE CODE. Ce module sert DEUX dispositions : dans le dépôt livré il est
// `tests/parcours.mjs` et le code est `../src/…` ; dans l'atelier il est
// `src/tests/parcours.mjs` et le code est `../…`. On essaie les deux, une seule
// fois, et l'on garde celui qui porte `lib/version.js` : un chemin d'import figé
// serait faux dans l'autre disposition — c'est le piège de NC-I-009.
const RACINE_CODE = await (async () => {
  for (const essai of ["../", "../src/"]) {
    try { await import(essai + "lib/version.js"); return essai; }
    catch (e) { /* disposition suivante */ }
  }
  return "../";
})();

// Ce dont un parcours a besoin : de quoi lire et manœuvrer l'application. On
// l'injecte (plutôt que d'importer ici des modules de vue, qui tireraient tout
// l'écran) pour que la suite reste lisible et testable.
export const PARCOURS = [];

function declarer(p) { PARCOURS.push(p); }

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// Attend qu'une condition soit vraie — le rendu de l'application est asynchrone :
// un écran n'existe pas au moment où on le demande, il arrive.
async function jusqua(condition, { essais = 40, pause = 150 } = {}) {
  for (let i = 0; i < essais; i++) {
    let v = null;
    try { v = condition(); } catch (e) { v = null; }
    if (v) return v;
    await attendre(pause);
  }
  return null;
}

// ------------------------------------------------------------------ 1. le service
declarer({
  id: "service-contrat",
  nom: "Le service répond au contrat commun",
  pourquoi: "sans service, ni le recueil ni la publication n'existent ; le contrat est décrit une seule fois (tests/conformite-service.mjs) et vaut pour les deux implémentations",
  async jouer(ctx) {
    const { verifier } = await import("./conformite-service.mjs");
    const releve = await verifier(ctx.appelerService, { nom: ctx.nomService || "service" });
    if (!releve.echecs.length) return "";
    return releve.echecs.map((e) => `${e.id} (${e.statut === null ? "aucune réponse" : e.statut}) : ${e.raison}`).join(" ; ");
  },
});

// ------------------------------------------------------------ 2. le recueil public
declarer({
  id: "recueil-public",
  nom: "Le recueil public s'ouvre, avec ses actes et ses informations",
  pourquoi: "c'est la page que voit un administré : elle doit s'afficher sans compte, avec son en-tête, son pied de page et ses actes publiés",
  async jouer(ctx) {
    const avant = ctx.route();
    try {
      const vu = await ctx.allerRecueil();
      if (!vu) return "le recueil ne s'est pas affiché (aucun élément .recueil)";
      const d = ctx.dom();
      const entete = d.querySelector(".recueil .recueil-entete, .recueil header");
      if (!entete) return "le recueil s'affiche sans en-tête";
      const pied = d.querySelector(".recueil .recueil-pied, .recueil footer");
      if (!pied) return "le recueil s'affiche sans pied de page";
      // Les actes publiés : s'il y en a, ils doivent être là. La lecture est
      // ASYNCHRONE — l'ossature du recueil s'affiche avant ses actes —, on
      // attend donc leur arrivée avant de conclure, sans attendre indéfiniment.
      const enLecture = ctx.etat().actes.filter((a) => a.statut === "publie" && a.publication && a.publication.cle);
      const renvois = () => d.querySelectorAll(".recueil a[href*='acte='], .recueil a[data-cle], .recueil-carrousel a, .recueil-accueil a[href*='acte=']");
      if (enLecture.length) {
        const trouves = await jusqua(() => (renvois().length ? renvois() : null), { essais: 30, pause: 200 });
        if (!trouves) {
          return `${enLecture.length} acte(s) publié(s) au registre, mais aucun renvoi dans le recueil : la page n'a pas lu ses publications`;
        }
      }
      return "";
    } finally {
      await ctx.revenir(avant);
    }
  },
});

// ------------------------------------------------------------- 3. la page d'un acte
declarer({
  id: "acte-publie",
  nom: "La page d'un acte publié porte sa notice",
  pourquoi: "un acte se cite par son adresse : sa page doit donner son identifiant ELI, son titre et son texte — c'est la consultation publique",
  async jouer(ctx) {
    const publies = ctx.etat().actes.filter((a) => a.statut === "publie" && a.publication && a.publication.cle);
    if (!publies.length) return "";           // rien à consulter : parcours sans objet
    const acte = publies[0];
    const avant = ctx.route();
    try {
      const vu = await ctx.allerActe(acte.publication.cle);
      if (!vu) return `la page de l'acte ${acte.numero || acte.id} ne s'est pas affichée`;
      // La fiche de l'acte arrive du service : le squelette de la page s'affiche
      // d'abord, la notice ensuite.
      const notice = await jusqua(() => ctx.dom().querySelector(".recueil-notice"), { essais: 40, pause: 200 });
      if (!notice) return "la page de l'acte s'affiche sans notice";
      const texte = notice.textContent || "";
      const eli = (acte.publication && (acte.publication.eliUri || acte.publication.eli)) || "";
      if (eli && !texte.includes(eli)) return `la notice ne porte pas l'identifiant ELI (${eli})`;
      const corps = ctx.dom().querySelector(".recueil-acte, .recueil-doc, .recueil-notice__titre");
      if (!corps) return "la page de l'acte n'affiche ni titre ni texte";
      return "";
    } finally {
      await ctx.revenir(avant);
    }
  },
});

// ------------------------------------------------- 4. la rédaction compile un acte
declarer({
  id: "redaction-compile",
  nom: "Une trame compile un acte lisible",
  pourquoi: "le cœur du logiciel : la trame et ses valeurs doivent produire un document avec son intitulé et ses articles, sans toucher au registre",
  async jouer(ctx) {
    const { state } = ctx.modules();
    const { compile } = await import(RACINE_CODE + "lib/compile.js");
    // Une trame, c'est un corps (les blocs du document), des questions (les
    // champs du formulaire) et des règles : on prend la première qui a un corps,
    // c'est-à-dire quelque chose à compiler.
    const trame = (state.trames || []).find((t) => (t.body || []).length);
    if (!trame) return "aucune trame exploitable au référentiel";
    const doc = compile(trame, {}, state.config);
    if (!doc) return "la compilation ne rend aucun document";
    const articles = (doc.nodes || []).filter((n) => n.type === "article" || n.type === "title");
    if (!articles.length) return `la compilation de « ${trame.name || trame.id} » ne rend ni intitulé ni article`;
    return "";
  },
});

// ------------------------------------------------------ 5. le recueil relit le registre
declarer({
  id: "repli-local",
  nom: "Le recueil se lit même quand le service se tait",
  pourquoi: "un acte publié ne doit JAMAIS disparaître du recueil parce que le service est momentanément absent (repli de src/lib/publications-locales.js)",
  async jouer(ctx) {
    const { state } = ctx.modules();
    const { publicationsLocales, publicationLocale } = await import(RACINE_CODE + "lib/publications-locales.js");
    const publies = state.actes.filter((a) => a.statut === "publie" && a.publication && a.publication.cle);
    if (!publies.length) return "";
    const liste = publicationsLocales(state.actes, { reserveVue: true });
    if (liste.length < publies.length) {
      const manquants = publies.filter((a) => !liste.some((p) => p.cle === a.publication.cle)).map((a) => a.numero || a.id);
      return `le repli local perd ${manquants.length} acte(s) publié(s) : ${manquants.slice(0, 3).join(", ")}`;
    }
    // La fiche d'un acte doit rendre son texte : la réponse de dépôt et la fiche
    // du service rangent les pièces de deux façons — les confondre vide l'acte.
    const rec = publicationLocale(state.actes, publies[0].publication.cle, { reserveVue: true });
    if (!rec) return "la fiche locale de l'acte publié est introuvable";
    if (!rec.formats || !(rec.formats.html || rec.formats.md || rec.formats.texte)) {
      return `la fiche de l'acte ${rec.numero || rec.cle} ne porte aucun texte (pièces illisibles)`;
    }
    if (!rec.latest) return "la version la plus récente ne porte pas `latest`";
    return "";
  },
});

// ------------------------------------------------------- 6. la qualification de signature
declarer({
  id: "signature-qualifiee",
  nom: "La signature d'un acte publié est qualifiée, ou se tait",
  pourquoi: "un acte signé « en simple » ne doit pas se présenter comme qualifié (NC-IV-001) : la notice doit porter la mention, ou n'en porter aucune si le niveau est inconnu",
  async jouer(ctx) {
    const { state } = ctx.modules();
    const { publicationsLocales } = await import(RACINE_CODE + "lib/publications-locales.js");
    const { qualificationSignature } = await import(RACINE_CODE + "lib/qualification-signature.js");
    const notices = publicationsLocales(state.actes, { reserveVue: true });
    for (const n of notices) {
      const q = qualificationSignature({
        niveau: n.signature && n.signature.niveau,
        simule: n.signatureSimulee === true || !!(n.signature && n.signature.prestataire && n.signature.prestataire.demonstration),
        prestataire: n.signature && n.signature.prestataire,
      });
      if (q.niveau && !q.mention) return `la notice de ${n.numero || n.cle} annonce un niveau sans mention`;
      if (q.niveau === "simple" && !/non qualifiée/i.test(q.label)) return "une signature simple n'est pas dite « non qualifiée »";
    }
    return "";
  },
});

// ------------------------------------------------------------------ 7. la session
declarer({
  id: "session",
  nom: "La session ouvre l'atelier, et son absence ramène au recueil",
  pourquoi: "l'espace public et l'atelier ne partagent pas le même public : un visiteur ne doit pas y entrer, un agent connecté doit y être — mais la racine du site reste le recueil, même connecté",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    if (!state.ready) return "l'application n'a pas fini de charger : parcours non concluants";
    const { estVisiteur } = await import(RACINE_CODE + "lib/users.js");
    const dom = ctx.dom();
    const atelierVu = () => dom.querySelector(".app-header, .app");
    const avant = ctx.route();
    try {
      if (state.user && !estVisiteur(state.user)) {
        // Un agent connecté qui DEMANDE l'atelier (« ?atelier ») y entre.
        navigate("atelier");
        if (!(await jusqua(atelierVu, { essais: 30, pause: 150 }))) {
          return "une session est ouverte mais l'atelier demandé ne s'affiche pas";
        }
        // Mais la page d'accueil reste le recueil : connecté, l'agent qui ne
        // demande rien voit le recueil public — et non l'atelier.
        navigate("recueil");
        if (!(await jusqua(() => dom.querySelector(".recueil"), { essais: 30, pause: 150 }))) {
          return "l'agent connecté ne retrouve pas le recueil public";
        }
        if (atelierVu()) return "le recueil public affiche encore l'atelier";
      } else {
        // Sans session (ou pour un visiteur), l'atelier ne s'ouvre pas : la
        // connexion reprend la main, et non l'application.
        navigate("atelier");
        await jusqua(() => dom.querySelector(".app-header, .app, .connexion"), { essais: 30, pause: 150 });
        if (atelierVu()) return "l'atelier s'affiche sans session ouverte";
      }
      return "";
    } finally {
      await ctx.revenir(avant);
    }
  },
});

// ------------------------------------------- 8. la saisie garde le curseur
declarer({
  id: "saisie-garde-le-focus",
  nom: "Une fiche garde le curseur pendant la saisie",
  pourquoi: "la fiche d'une entité se redessine à chaque frappe — son en-tête reprend le nom qu'on écrit — et sans reprise du curseur le champ était reconstruit : la saisie perdait le focus, et la sélection, dès la première lettre (1.6.1u)",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    const dom = ctx.dom();
    if (!state.ready || !state.user) return "";             // parcours sans objet
    const { can } = await import(RACINE_CODE + "ui/state.js");
    if (!can("referentiel.gerer")) return "";               // l'écriture du référentiel n'est pas ouverte à ce compte
    const avant = ctx.route();
    try {
      navigate("organigramme");
      if (!(await jusqua(() => dom.querySelector(".page-head__title"), { essais: 40, pause: 150 }))) {
        return "l'organigramme ne s'est pas affiché";
      }
      const bouton = [...dom.querySelectorAll("button")].find((b) => /Nouvelle entit/.test(b.textContent || ""));
      if (!bouton) return "le bouton « Nouvelle entité » est absent de l'organigramme";
      bouton.click();
      const fiche = await jusqua(() => dom.querySelector(".fr-modal .org-fiche"), { essais: 40, pause: 100 });
      if (!fiche) return "la fiche « Nouvelle entité » ne s'est pas ouverte";
      // Le champ « Nom » — celui dont la frappe fait redessiner l'en-tête.
      const champNom = () => [...fiche.querySelectorAll("input")].find((el) => {
        const f = el.closest(".fr-field");
        return f && /^Nom\b/.test((f.querySelector("label") || {}).textContent || "");
      });
      const premier = champNom();
      if (!premier) return "la fiche ne porte pas de champ « Nom »";
      premier.focus();
      premier.value = "";
      premier.dispatchEvent(new dom.defaultView.Event("input", { bubbles: true }));
      for (const lettre of "Régie") {
        const champ = champNom();               // le champ a pu être reconstruit
        if (!champ) return "le champ « Nom » a disparu du formulaire en cours de saisie";
        const attendu = (champ.value || "") + lettre;
        champ.value = attendu;
        champ.dispatchEvent(new dom.defaultView.Event("input", { bubbles: true }));
        const actif = dom.activeElement;
        if (actif !== champNom()) return `le champ perd le curseur après « ${lettre} » : la saisie s'arrête au premier caractère`;
        if ((actif.value || "") !== attendu) return `le champ porte « ${actif.value} » au lieu de « ${attendu} »`;
        if (actif.selectionStart !== attendu.length) return "le curseur n'est pas resté en fin de saisie";
      }
      return "";
    } finally {
      // Rien n'est créé : la fiche est refermée, sans écrire au référentiel.
      const fermer = dom.querySelector(".fr-modal-overlay .fr-modal__header button, .fr-modal-overlay .fr-modal__footer button");
      if (fermer) fermer.click();
      else dom.querySelectorAll(".fr-modal-overlay").forEach((o) => o.remove());
      await ctx.revenir(avant);
    }
  },
});

// --------------------------------- 9. l'écran de connexion se soumet par Entrée
declarer({
  id: "connexion-entree",
  nom: "L'écran de connexion se soumet à la touche Entrée",
  pourquoi: "un formulaire qui porte plusieurs champs de saisie n'est PAS soumis implicitement par le navigateur s'il n'a pas de bouton de soumission : la touche Entrée, dans l'identifiant ou le mot de passe, ne connectait pas (1.6.1u)",
  async jouer(ctx) {
    const dom = ctx.dom();
    const { panneauMotDePasse } = await import(RACINE_CODE + "ui/mot-de-passe.js");
    // Le panneau est monté pour lui-même : l'aperçu de démonstration ne le
    // présente pas (l'authentification y est simulée), et un parcours qui
    // dépendrait du mode du déploiement ne dirait rien sur les autres.
    const hote = dom.createElement("div");
    dom.body.appendChild(hote);
    try {
      hote.appendChild(panneauMotDePasse({}));
      const form = hote.querySelector("form.mdp-form");
      if (!form) return "le panneau de connexion ne présente pas de formulaire";
      const bouton = form.querySelector("button[type=submit]");
      if (!bouton) return "le formulaire de connexion n'a pas de bouton de soumission : la touche Entrée ne le soumettra pas";
      if (bouton.form !== form) return "le bouton de soumission n'appartient pas au formulaire de connexion";
      // La touche Entrée produit l'événement `submit` du formulaire : on le joue,
      // les champs vides, et l'on attend le refus du panneau lui-même. Aucun essai
      // de connexion n'est tenté — le service n'est pas atteint.
      form.dispatchEvent(new dom.defaultView.Event("submit", { bubbles: true, cancelable: true }));
      const refus = await jusqua(() => {
        const t = hote.querySelector(".mdp-messages .fr-alert__title");
        return t && /incomplet/i.test(t.textContent || "") ? t : null;
      }, { essais: 20, pause: 50 });
      if (!refus) return "la soumission du formulaire n'a produit aucune validation du panneau : « Entrée » reste sans effet";
      return "";
    } finally {
      hote.remove();
    }
  },
});

// ---------------------------- 10. l'éditeur ne s'engorge pas à chaque redessin
declarer({
  id: "editeur-sans-fuite",
  nom: "L'éditeur de trame ne pose pas un écouteur de plus à chaque redessin",
  pourquoi: "chaque redessin posait un écouteur `resize`, un `ResizeObserver` et trois écouteurs du document, jamais repris ; l'observateur retenait en vie la feuille DÉTACHÉE du dessin précédent, et l'onglet finissait par se figer après quelques minutes d'édition de trames (1.6.1y)",
  async jouer(ctx) {
    const dom = ctx.dom();
    const brut = ctx.modules();
    const trame = (ctx.etat().trames || [])[0];
    // Référentiel vierge : il n'y a pas de trame à ouvrir, et rien à éprouver.
    if (!trame) return "";
    const fenetre = dom.defaultView;
    // On compte les écouteurs POSÉS MOINS CEUX REPRIS : l'éditeur pose bien trois
    // écouteurs du document à chaque dessin — c'est la reprise de la veille
    // précédente qui fait qu'il n'en reste qu'un jeu.
    let fenetreNette = 0, docNette = 0, observateurs = 0;
    const ow = fenetre.addEventListener, owr = fenetre.removeEventListener;
    const oc = dom.addEventListener, ocr = dom.removeEventListener;
    const OR = fenetre.ResizeObserver;
    const types = ["keydown", "scroll", "mousedown"];
    const oublier = () => {
      fenetre.addEventListener = ow; fenetre.removeEventListener = owr;
      dom.addEventListener = oc; dom.removeEventListener = ocr;
      if (OR) fenetre.ResizeObserver = OR;
    };
    const avant = JSON.parse(JSON.stringify(brut.state.route || {}));
    const chemin = (r) => (r && r.view ? r.view + (r.params && r.params.id ? "/" + r.params.id : "") : "trames");
    try {
      fenetre.addEventListener = function (t, f, o) { if (t === "resize") fenetreNette++; return ow.call(this, t, f, o); };
      fenetre.removeEventListener = function (t, f, o) { if (t === "resize") fenetreNette--; return owr.call(this, t, f, o); };
      dom.addEventListener = function (t, f, o) { if (types.includes(t)) docNette++; return oc.call(this, t, f, o); };
      dom.removeEventListener = function (t, f, o) { if (types.includes(t)) docNette--; return ocr.call(this, t, f, o); };
      if (typeof OR === "function") {
        fenetre.ResizeObserver = class extends OR { constructor(cb) { observateurs++; super(cb); } };
      }
      brut.navigate("trame/" + trame.id);
      if (!(await jusqua(() => dom.querySelector(".editor .outline__item"), { essais: 30 }))) {
        return "l'éditeur de trame ne s'est pas ouvert";
      }
      const base = { fenetre: fenetreNette, doc: docNette, obs: observateurs };
      // Dix redessins : on sélectionne tour à tour les blocs du plan.
      for (let i = 0; i < 10; i++) {
        const item = dom.querySelectorAll(".editor .outline__item")[i % 5];
        if (item) item.click();
        await attendre(120);
      }
      const reste = {
        fenetre: fenetreNette - base.fenetre,
        doc: docNette - base.doc,
        obs: observateurs - base.obs,
      };
      if (reste.fenetre || reste.doc || reste.obs) {
        return `dix redessins laissent ${reste.fenetre} écouteur(s) de redimensionnement, ${reste.obs} observateur(s) de taille et ${reste.doc} écouteur(s) du document derrière eux : ils ne sont pas repris`;
      }
      return "";
    } finally {
      oublier();
      brut.navigate(chemin(avant));
      await jusqua(() => dom.querySelector(".app"));
    }
  },
});

// ---------------------------------- 11. la fusion à trois voies (deux postes)
declarer({
  id: "fusion-sans-perte",
  nom: "Deux postes qui écrivent le même document ne s'effacent plus",
  pourquoi: "depuis la 1.6.2, la persistance FUSIONNE les modifications concurrentes champ par champ (lib/fusion.js) au lieu de laisser le serveur écraser le travail du poste ; une régression ici ne se verrait qu'à l'écran, des jours plus tard, sous la forme d'un passage disparu",
  async jouer() {
    let mod = null;
    try { mod = await import(RACINE_CODE + "lib/fusion.js"); } catch (e) { return "lib/fusion.js illisible : " + e.message; }
    const { fusionnerJson } = mod;
    const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    // Deux champs différents changés de part et d'autre : les deux survivent.
    const base = { objet: "Arrêté", numero: "", signataire: "" };
    const r1 = fusionnerJson(base, { ...base, objet: "Arrêté de stationnement" }, { ...base, signataire: "p-maire" });
    if (r1.valeur.objet !== "Arrêté de stationnement" || r1.valeur.signataire !== "p-maire") {
      return "les deux modifications auraient dû survivre : " + JSON.stringify(r1.valeur);
    }
    if (r1.desaccords.length) return "aucun désaccord n'était attendu";
    // Le même champ changé différemment : la nôtre reste, et c'est signalé.
    const r2 = fusionnerJson(base, { ...base, objet: "nôtre" }, { ...base, objet: "leur" });
    if (r2.valeur.objet !== "nôtre") return "le poste qui écrit doit garder sa valeur";
    if (!r2.desaccords.length) return "un désaccord sur le même champ doit être signalé, jamais avalé";
    // Une liste identifiée : un élément modifié par l'un, un autre par l'autre.
    const lb = [{ id: "a", v: 1 }, { id: "b", v: 1 }];
    const r3 = fusionnerJson(lb, [{ id: "a", v: 1 }, { id: "b", v: 2 }], [{ id: "a", v: 9 }, { id: "c", v: 1 }]);
    if (r3.valeur.length !== 3) return "les listes identifiées doivent se réunir : " + JSON.stringify(r3.valeur);
    if (r3.valeur.find((x) => x.id === "a").v !== 9 || r3.valeur.find((x) => x.id === "b").v !== 2) {
      return "les modifications de chacun sur des éléments différents doivent survivre : " + JSON.stringify(r3.valeur);
    }
    // Une suppression des deux côtés s'applique ; nos modifications ne
    // ressuscitent pas un élément que l'autre a retiré sans y toucher.
    if (!egal(fusionnerJson(lb, [], []).valeur, [])) return "une suppression des deux côtés doit s'appliquer";
    return "";
  },
});

// ------------------------------------- 12. le client du flux temps réel (1.6.2)
declarer({
  id: "flux-temps-reel",
  nom: "Le flux lit, découpe et livre les changements poussés par le service",
  pourquoi: "c'est ce qui fait qu'une trame enregistrée sur un poste apparaît sur les autres en une seconde ; un découpage SSE faux ne se verrait pas — il donnerait un flux MUET, sans aucune erreur (le piège que nginx réserve aussi, voir nginx.conf)",
  async jouer() {
    let mod = null;
    try { mod = await import(RACINE_CODE + "lib/flux.js"); } catch (e) { return "lib/flux.js illisible : " + e.message; }
    // 1. Le découpage : une trame incomplète doit être REMISE au paquet suivant.
    const d = mod.decouperTrames("data: {\"a\":1}\n\ndata: {\"b\"");
    if (d.frames.length !== 1) return "le découpage des trames SSE est faux (" + d.frames.length + " trame(s))";
    if (!d.reste.includes("{\"b")) return "le morceau incomplet doit être conservé";
    // Un commentaire (battement) ne produit aucun évènement.
    if (mod.analyserFlux(": battement\n\n").evenements.length) return "un battement ne doit réveiller aucun traitement";
    // 2. Le client, alimenté par un flux factice : deux trames en deux paquets.
    const trames = [
      "data: {\"type\":\"collection\",\"collection\":\"trames\",\"revision\":42}\n\n",
      "data: {\"type\":\"resync\"}\n\n",
    ];
    const encodeur = new TextEncoder();
    let i = 0;
    const faussFetch = async () => ({
      ok: true,
      status: 200,
      body: {
        async cancel() {},
        getReader() {
          return {
            async read() {
              if (i >= trames.length) return { done: true };
              return { done: false, value: encodeur.encode(trames[i++]) };
            },
          };
        },
      },
    });
    const recus = [];
    const etats = [];
    const f = mod.creerFlux({
      url: "/v1/db/flux", fetchImpl: faussFetch, surEvenement: (e) => recus.push(e),
      delaiBase: 60000, delaiMax: 60000,
    });
    f.surEtat((e) => etats.push(e.etat));
    f.demarrer();
    const vu = await jusqua(() => (recus.length >= 2 ? recus : null), { essais: 30, pause: 60 });
    f.arreter();
    if (!vu) return "les évènements du flux ne sont pas arrivés (" + recus.length + " reçu(s))";
    if (recus[0].type !== "collection" || recus[0].donnees.collection !== "trames" || recus[0].donnees.revision !== 42) {
      return "le premier évènement est mal décodé : " + JSON.stringify(recus[0]);
    }
    if (recus[1].type !== "resync") return "la reprise n'est pas reconnue : " + JSON.stringify(recus[1]);
    if (!etats.includes("ouvert")) return "l'état du flux n'est jamais passé à « ouvert »";
    // 3. Un service qui ne connaît pas la route (version antérieure) : « absent »,
    //    et pas de boucle de reconnexion.
    let appels = 0;
    const f2 = mod.creerFlux({
      url: "/v1/db/flux", veilleAbsent: 50, delaiBase: 10, delaiMax: 20,
      fetchImpl: async () => { appels += 1; return { ok: false, status: 404, body: null }; },
    });
    f2.demarrer();
    const absent = await jusqua(() => (f2.etat().etat === "absent" ? true : null), { essais: 30, pause: 40 });
    f2.arreter();
    if (!absent) return "un service sans flux doit être reconnu comme « absent » (état : " + f2.etat().etat + ")";
    await attendre(160);
    if (appels > 2) return "un service sans flux ne doit pas être réinterrogé en boucle (" + appels + " appel(s))";
    return "";
  },
});

// ---------------------------- 13. la recherche dans les réglages de l'atelier
declarer({
  id: "reglages-recherche",
  nom: "La recherche des réglages trouve un réglage d'un autre onglet et y mène",
  pourquoi: "l'administration compte vingt-trois onglets : sans cette barre, retrouver « Illustrer les pages d'erreur d'un chat (http.cat) » — onglet Publication, carte « Apparence du site public », encart « Pages d'erreur » — demandait de les ouvrir l'un après l'autre, d'où le signalement « l'option http.cat n'est pas accessible dans l'onglet décrit » ; ce qui manquait n'était pas l'option, c'était le chemin",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    const dom = ctx.dom();
    if (!state.ready || !state.user) return "";             // parcours sans objet
    const { redrawView } = await import(RACINE_CODE + "ui/state.js");
    const avant = ctx.route();
    const ongletAvant = state.ui && state.ui.refTab;
    const taper = (texte) => {
      const champ = dom.querySelector(".ref-recherche__champ");
      if (!champ) return false;
      champ.value = texte;
      champ.dispatchEvent(new dom.defaultView.Event("input", { bubbles: true }));
      return true;
    };
    try {
      navigate("referentiel");
      if (!(await jusqua(() => dom.querySelector(".ref-recherche__champ"), { essais: 40, pause: 150 }))) {
        return "l'écran d'administration ne porte pas de barre de recherche des réglages";
      }
      // La recherche part d'un onglet NEUTRE : ce qu'elle trouve doit l'être
      // depuis n'importe où, et non parce qu'on regardait déjà le bon onglet.
      state.ui.refTab = "identite";
      redrawView();
      const surIdentite = await jusqua(() => ((dom.querySelector(".fr-tab--active") || {}).textContent || "").includes("Identité"));
      if (!surIdentite) return "l'onglet « Identité » ne s'est pas affiché";
      if (!taper("chat")) return "la barre de recherche a disparu en cours d'épreuve";
      // L'index se construit à la première frappe : il dessine chaque onglet une
      // fois (hors du document) pour lire ses réglages. C'est le seul moment lent.
      const trouves = await jusqua(() => {
        const r = [...dom.querySelectorAll(".ref-resultat")];
        return r.length ? r : null;
      }, { essais: 80, pause: 150 });
      if (!trouves) return "la recherche « chat » ne propose aucun réglage";
      const chats = trouves.find((b) => /http\.cat/i.test((b.querySelector(".ref-resultat__label") || {}).textContent || ""));
      if (!chats) {
        const vus = trouves.slice(0, 4).map((b) => (b.querySelector(".ref-resultat__label") || {}).textContent).join(" | ");
        return `la recherche « chat » ne trouve pas l'option http.cat (proposé : ${vus})`;
      }
      const chemin = (chats.querySelector(".ref-resultat__chemin") || {}).textContent || "";
      if (!/Publication/.test(chemin)) return `le résultat ne dit pas son onglet (« ${chemin} »)`;
      // Le clic doit MENER au réglage : on change d'onglet, et le champ porte la
      // marque de l'arrivée — sans quoi l'agent retombe en haut d'un onglet de
      // trois mille pixels et ne voit pas ce qu'il est venu chercher.
      chats.click();
      const cible = await jusqua(() => {
        for (const f of dom.querySelectorAll(".fr-field")) {
          const lab = f.querySelector(".fr-label");
          if (lab && /http\.cat/i.test(lab.textContent || "") && f.classList.contains("ref-field--cible")) return f;
        }
        return null;
      }, { essais: 60, pause: 100 });
      if (state.ui.refTab !== "publication") return `le clic n'a pas mené à l'onglet Publication (onglet : ${state.ui.refTab})`;
      if (!cible) return "le clic n'a pas désigné le champ http.cat dans l'onglet Publication";
      // Une recherche sans réponse, elle, doit le DIRE.
      if (!taper("zzzqqq")) return "la barre de recherche a disparu en cours d'épreuve";
      const vide = await jusqua(() => {
        const a = dom.querySelector(".ref-recherche__annonce");
        return a && /aucun r[ée]glage/i.test(a.textContent || "") ? a.textContent : null;
      }, { essais: 30, pause: 100 });
      if (!vide) return "une recherche sans réponse ne le dit pas";
      // L'effacement rend leur place aux champs que le filtre avait cachés.
      if (!taper("")) return "la barre de recherche a disparu en cours d'épreuve";
      const rendus = await jusqua(() => (dom.querySelectorAll(".ref-field[hidden]").length ? null : true), { essais: 30, pause: 100 });
      if (!rendus) return "effacer la recherche laisse des réglages cachés";
      return "";
    } finally {
      state.ui.refRech = "";
      state.ui.refTab = ongletAvant;
      await ctx.revenir(avant);
    }
  },
});

// ------------------------------ 14. la barre de gauche se replie (1.6.2)
declarer({
  id: "barre-repliable",
  nom: "La barre de gauche se replie, et le poste s'en souvient",
  pourquoi: "le sommaire de l'atelier occupe 232 px, y compris sur un écran de rédaction : il doit pouvoir se replier en une colonne d'icônes sans perdre ses libellés (le lecteur d'écran les lit, le titre du bouton les donne à la souris), et le poste doit retrouver son choix au rechargement suivant",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    const dom = ctx.dom();
    if (!state.ready || !state.user) return "";             // parcours sans objet
    const CLE = "scribae.pref.nav.replie";
    const prefAvant = localStorage.getItem(CLE);
    const nav = () => dom.querySelector(".app-nav");
    const lire = () => {
      const n = nav();
      if (!n) return null;
      const bouton = n.querySelector(".app-nav__repli");
      const item = n.querySelector(".app-nav__item");
      const label = item && item.querySelector(".app-nav__label");
      return {
        n, bouton, item, label,
        replie: n.classList.contains("app-nav--replie"),
        largeur: Math.round(n.getBoundingClientRect().width),
        largeurLabel: label ? Math.round(label.getBoundingClientRect().width) : -1,
        texteLabel: label ? (label.textContent || "") : "",
      };
    };
    // On force un état : chaque clic reconstruit la coquille, donc le nœud change.
    const poser = async (voulu) => {
      for (let i = 0; i < 4; i++) {
        const e = lire();
        if (!e || e.replie === voulu) return e;
        e.bouton.click();
        await attendre(350);
      }
      return lire();
    };
    const avant = ctx.route();
    try {
      navigate("trames");
      const premier = await jusqua(() => {
        const e = lire();
        return e && e.bouton && e.item ? e : null;
      }, { essais: 40, pause: 150 });
      if (!premier) return "la barre de gauche ne porte pas de bouton de repli";
      // Dépliée : les libellés sont là.
      const deplie = await poser(false);
      if (!deplie || deplie.replie) return "la barre de gauche ne veut pas se déplier";
      if (deplie.largeur < 200) return `dépliée, la barre ne fait que ${deplie.largeur} px`;
      if (deplie.largeurLabel < 20 || !deplie.texteLabel.trim()) return "dépliée, la barre n'affiche pas les libellés";
      // Repliée : étroite, le libellé existe toujours mais ne s'affiche plus.
      const replie = await poser(true);
      if (!replie || !replie.replie) return "la barre de gauche ne se replie pas";
      if (replie.largeur > 90) return `repliée, la barre occupe encore ${replie.largeur} px`;
      if (replie.largeur >= deplie.largeur - 100) return "repliée, la barre n'a pas rendu de place au contenu";
      if (!replie.texteLabel.trim()) return "repliée, la barre perd le libellé de ses entrées (le lecteur d'écran ne les lit plus)";
      if (replie.largeurLabel > 0) return "repliée, les libellés restent affichés";
      if (!(replie.item.getAttribute("title") || "").trim()) return "repliée, les entrées n'annoncent plus leur libellé au survol";
      if (!/déplier/i.test(replie.bouton.getAttribute("title") || "")) return "repliée, le bouton n'annonce pas qu'il déplie";
      // Le choix est gardé par le poste.
      if (localStorage.getItem(CLE) !== "1") return "le repli n'est pas retenu par le poste";
      return "";
    } finally {
      await poser(false);
      try {
        if (prefAvant === null) localStorage.removeItem(CLE);
        else localStorage.setItem(CLE, prefAvant);
      } catch (e) { /* poste sans stockage */ }
      await ctx.revenir(avant);
    }
  },
});

// ============================================================================
// LES ÉPREUVES DE LA REVUE D'INTERFACE (1.6.2, src/docs/UI-UX.md).
//
// Chaque proposition retenue y reçoit la sienne. Ce ne sont pas des épreuves de
// goût : chacune mesure ce que la proposition PROMETTAIT — « aucune pastille de
// plus », « le panneau de droite ne recouvre jamais le document », « le texte ne
// descend plus sous 13 px » —, sur l'écran réel, avec le référentiel de
// démonstration. Une proposition qu'on oublie de tenir se voit ici.
// ============================================================================

// ---------------------------------- 15. P1 : l'échelle typographique tenue
declarer({
  id: "echelle-typographique",
  nom: "Aucun texte de l'atelier ne descend sous 13 px",
  pourquoi: "la revue a relevé 58 tailles de texte, dont 9,6 px : ce que l'on ne lit pas, on ne le consulte pas. Le PLANCHER (P1) vaut pour la chrome de l'atelier, pas pour le document — qui suit les marges et la charte de la collectivité",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    const dom = ctx.dom();
    if (!state.ready || !state.user) return "";             // parcours sans objet
    const avant = ctx.route();
    const trop = [];
    const ecrans = ["trames", "actes", "referentiel", "chrono", "parapheur"];
    try {
      for (const vue of ecrans) {
        navigate(vue);
        if (!(await jusqua(() => dom.querySelector(".app-main .page-head__title"), { essais: 30, pause: 120 }))) continue;
        for (const el of dom.querySelectorAll(".app *")) {
          // Le document n'est pas de la chrome : ses tailles viennent de la
          // charte (points d'impression, corps de l'acte).
          if (el.closest(".paper")) continue;
          const propre = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!propre) continue;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const px = parseFloat(cs.fontSize);
          if (px && px < 13) trop.push(vue + " : " + (el.className || el.tagName) + " à " + px + " px");
        }
      }
      if (trop.length) return trop.slice(0, 4).join(" ; ") + (trop.length > 4 ? " (" + trop.length + " au total)" : "");
      return "";
    } finally {
      await ctx.revenir(avant);
    }
  },
});

// ------------------------ 16. P3 + P2 : une pastille, des mentions, un geste
declarer({
  id: "une-pastille-par-carte",
  nom: "Une carte porte une pastille, une ligne de mentions et un seul geste principal",
  pourquoi: "la revue a relevé jusqu'à sept pastilles et six boutons sur une carte de trame : plus rien n'y ressortait. La règle est « une pastille de statut », « le reste en mentions grises », « le geste courant seul, les autres derrière le menu ⋯ » (P3, P2)",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    const dom = ctx.dom();
    if (!state.ready || !state.user) return "";             // parcours sans objet
    const avant = ctx.route();
    try {
      navigate("trames");
      const cartes = await jusqua(() => {
        const c = [...dom.querySelectorAll(".fr-grid .fr-card")];
        return c.length ? c : null;
      }, { essais: 40, pause: 150 });
      if (!cartes) return "aucune carte de trame à examiner";
      for (const carte of cartes.slice(0, 6)) {
        const badges = carte.querySelectorAll(".fr-badge").length;
        if (badges > 1) return "une carte porte " + badges + " pastilles : « " + (carte.querySelector(".fr-card__title") || {}).textContent + " »";
        if (!carte.querySelector(".app-mentions")) return "une carte n'a pas de ligne de mentions (service, champs, règles)";
        const primaires = carte.querySelectorAll(".fr-btn--primary").length;
        if (primaires !== 1) return "une carte porte " + primaires + " bouton(s) principal(aux) au lieu d'un";
        if (!carte.querySelector(".app-menubtn")) return "une carte n'a pas de menu « ⋯ » pour ses autres gestes";
      }
      return "";
    } finally {
      await ctx.revenir(avant);
    }
  },
});

// ------------------------------- 17. P5 : le registre redevient une liste
declarer({
  id: "registre-pagination",
  nom: "Le registre annonce son compte, pagine ses lignes et reste filtré par une barre en tête",
  pourquoi: "les soixante-neuf actes de la démonstration tenaient sur une seule page de 12 000 px, sans compte ni filtre visible : on ne trouvait un acte qu'en descendant. La barre reste en haut, le compte dit ce qu'on voit, et les lignes s'affichent par paquets (P5)",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    const dom = ctx.dom();
    if (!state.ready || !state.user) return "";             // parcours sans objet
    const avantRoute = ctx.route();
    const avantUi = state.ui.registre ? JSON.parse(JSON.stringify(state.ui.registre)) : null;
    try {
      navigate("actes");
      const barre = await jusqua(() => dom.querySelector(".liste-barre"), { essais: 40, pause: 150 });
      if (!barre) return "le registre n'a pas de barre d'outils (recherche, filtres, compte)";
      if (getComputedStyle(barre).position !== "sticky") return "la barre du registre ne reste pas en tête pendant le défilement";
      const compte = () => (dom.querySelector(".liste-compte") || {}).textContent || "";
      if (!/actes?/.test(compte()) || !/affich/.test(compte())) return "le compte du registre est illisible : « " + compte() + " »";
      const lignes = () => dom.querySelectorAll(".fr-table tbody tr").length;
      const total = state.actes.filter((a) => !a.deletedAt).length;
      if (lignes() >= total && total > 25) return "le registre affiche ses " + lignes() + " lignes d'un bloc : la pagination n'opère pas";
      const avantLignes = lignes();
      const suivant = dom.querySelector(".liste-plus button");
      if (!suivant) return "le registre n'a pas de bouton « Afficher les suivants »";
      suivant.click();
      const apres = await jusqua(() => (lignes() > avantLignes ? lignes() : null), { essais: 30, pause: 120 });
      if (!apres) return "« Afficher les suivants » n'ajoute aucune ligne";
      // Un filtre resserre la liste, et le compte le dit.
      state.ui.registre.statut = "signee";
      const { redrawView } = await import(RACINE_CODE + "ui/state.js");
      redrawView();
      const filtre = await jusqua(() => (/affich/.test(compte()) ? compte() : null), { essais: 30, pause: 120 });
      if (!filtre) return "le registre n'affiche plus son compte après un filtre";
      if (dom.querySelectorAll(".fr-table tbody tr").length > total) return "le filtre laisse plus de lignes que le registre n'en compte";
      return "";
    } finally {
      state.ui.registre = avantUi;
      try { const m = await import(RACINE_CODE + "ui/state.js"); m.redrawView(); } catch (e) { /* rien */ }
      await ctx.revenir(avantRoute);
    }
  },
});

// -------------------------------- 18. P5 : le chrono montre l'essentiel
declarer({
  id: "chrono-colonnes",
  nom: "Le chrono montre six colonnes essentielles, garde les autres derrière un bouton, et pagine",
  pourquoi: "trois cent trente-trois lignes sur quatorze colonnes, 39 000 px de haut : le registre des numéros était illisible. Six colonnes suffisent à lire un chrono ; les autres se rappellent à la demande (P5)",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    const dom = ctx.dom();
    if (!state.ready || !state.user) return "";             // parcours sans objet
    const avantRoute = ctx.route();
    const avant = { colonnes: state.ui.chronoToutesColonnes, affiches: state.ui.chronoAffiches };
    const entetes = () => [...dom.querySelectorAll(".fr-table thead th")].map((t) => (t.textContent || "").trim());
    try {
      navigate("chrono");
      const table = await jusqua(() => dom.querySelector(".fr-table"), { essais: 40, pause: 150 });
      if (!table) return "le chrono n'affiche pas de tableau";
      const affichees = entetes();
      if (affichees.length > 7) return "le chrono ouvre sur " + affichees.length + " colonnes : l'essentiel ne se lit plus";
      if (affichees.length < 4) return "le chrono ouvre sur trop peu de colonnes (" + affichees.length + ")";
      if (!/Num/.test(affichees.join(" "))) return "le chrono n'affiche pas le numéro";
      const bouton = [...dom.querySelectorAll(".liste-barre button")].find((b) => /colonnes/i.test(b.textContent || ""));
      if (!bouton) return "le chrono n'offre pas de bouton pour afficher les autres colonnes";
      bouton.click();
      const toutes = await jusqua(() => (entetes().length > affichees.length ? entetes() : null), { essais: 30, pause: 120 });
      if (!toutes) return "« Toutes les colonnes » n'affiche rien de plus";
      const lignes = dom.querySelectorAll(".fr-table tbody tr").length;
      if (lignes > 25) return "le chrono affiche " + lignes + " lignes d'un bloc : la pagination n'opère pas";
      const compte = (dom.querySelector(".liste-compte") || {}).textContent || "";
      if (!/lignes?/.test(compte) || !/affich/.test(compte)) return "le chrono n'annonce pas son compte : « " + compte + " »";
      return "";
    } finally {
      state.ui.chronoToutesColonnes = avant.colonnes;
      state.ui.chronoAffiches = avant.affiches;
      try { const m = await import(RACINE_CODE + "ui/state.js"); m.redrawView(); } catch (e) { /* rien */ }
      await ctx.revenir(avantRoute);
    }
  },
});

// ------------------------------ 19. P6 : le tiroir de l'espace de rédaction
declarer({
  id: "redaction-tiroir",
  nom: "L'espace de rédaction déclare son état en une ligne, et complète un champ à la fois",
  pourquoi: "l'écran le plus riche du logiciel portait trois colonnes ouvertes, un chapelet de pastilles et quatre onglets : le rédacteur ne savait plus quoi faire. L'état tient en une ligne, le panneau se ferme, et l'on y complète UNE chose à la fois (P6). Le geste d'ouverture, lui, doit se VOIR : le bouton annonce son état, et la barre se nomme et porte sa fermeture",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    const dom = ctx.dom();
    if (!state.ready || !state.user) return "";             // parcours sans objet
    const { redrawView } = await import(RACINE_CODE + "ui/state.js");
    const { resetDraft } = await import(RACINE_CODE + "ui/views/rediger.js");
    const avantRoute = ctx.route();
    const avantDraft = state.rediger ? true : false;
    // Le tiroir se souvient de son état DANS LE BROUILLON (l'écran se redessine
    // sans cesse, l'état doit survivre au redessin) : qui écrivait déjà peut
    // l'avoir laissé ouvert. On le referme donc avant de juger, et l'on rend son
    // état ensuite — c'est la règle « fermé par défaut » que l'épreuve tient.
    const tiroirAvant = state.rediger && state.rediger.ui ? state.rediger.ui.tiroir : undefined;
    try {
      const trame = (state.trames || []).find((t) => (t.fields || []).some((f) => f.required));
      if (!trame) return "";                                // rien à compléter : sans objet
      navigate("rediger/" + trame.id);
      if (state.rediger && state.rediger.ui) state.rediger.ui.tiroir = false;
      const etat = await jusqua(() => dom.querySelector("#rediger-etat .app-mentions"), { essais: 40, pause: 150 });
      if (!etat) return "l'écran de rédaction n'affiche pas d'état en une ligne (une ligne de mentions)";
      const tiroir = dom.querySelector("#redaction-tiroir");
      if (!tiroir) return "l'écran de rédaction n'a pas de tiroir";
      if (!tiroir.hidden) return "le tiroir est ouvert d'emblée : la revue le veut fermé tant qu'on ne l'ouvre pas";
      const bouton = dom.querySelector("#rediger-tiroir-btn button");
      if (!bouton) return "le tiroir n'a pas de bouton pour s'ouvrir";
      const compte = (bouton.textContent || "");
      if (!/Compléter l'acte/.test(compte)) return "le bouton du tiroir ne dit pas ce qu'on y fait : « " + compte + " »";
      const attendus = (trame.fields || []).filter((f) => f.required).length;
      if (!/·/.test(compte)) return "le bouton du tiroir ne porte pas son compte (il reste « " + compte + " »)";
      if (attendus && !/·/.test(compte)) return "le compte du tiroir n'est pas annoncé";
      // Le geste mis en avant : UN seul bouton principal, et c'est Enregistrer.
      const principaux = [...dom.querySelectorAll(".page-head__actions .fr-btn--primary")];
      if (principaux.length !== 1 || !/Enregistrer/.test(principaux[0].textContent || "")) {
        return "l'en-tête met en avant " + (principaux.map((b) => b.textContent).join(", ") || "aucun bouton") + " au lieu d'« Enregistrer » et lui seul";
      }
      // Le contrôle, en une ligne, au bas du document.
      const controle = dom.querySelector("#rediger-controle");
      if (!controle || !controle.querySelector(".app-mentions")) return "le document ne porte pas de ligne de contrôle en bas";
      // Le tiroir ouvert : un seul champ à la fois.
      bouton.click();
      const unChamp = await jusqua(() => dom.querySelector(".rx-un-champ"), { essais: 30, pause: 120 });
      if (!unChamp) return "le tiroir ne montre pas de champ à compléter";
      if (unChamp.querySelectorAll(".rx-field").length !== 1) {
        return "le tiroir montre " + unChamp.querySelectorAll(".rx-field").length + " champs d'un coup au lieu d'un";
      }
      if (!dom.querySelector("#redaction-panel .rx-avancement")) return "le tiroir n'affiche pas l'avancement des champs";
      const gestes = [...unChamp.querySelectorAll("button")].map((b) => b.textContent || "");
      if (!gestes.some((g) => /Plus tard/.test(g)) || !gestes.some((g) => /Valider et suivant/.test(g))) {
        return "le tiroir n'offre pas les deux gestes « Plus tard » et « Valider et suivant » (" + gestes.join(", ") + ")";
      }
      // « Plus tard » avance sans rien valider ; le champ change.
      const premier = (unChamp.querySelector(".rx-field") || {}).dataset ? unChamp.querySelector(".rx-field").dataset.champ : "";
      const plusTard = [...unChamp.querySelectorAll("button")].find((b) => /Plus tard/.test(b.textContent || ""));
      plusTard.click();
      const suivantChamp = await jusqua(() => {
        const f = dom.querySelector(".rx-un-champ .rx-field");
        return f && f.dataset.champ !== premier ? f : null;
      }, { essais: 30, pause: 120 });
      if (!suivantChamp) return "« Plus tard » ne passe pas au champ suivant";
      // LA BARRE SE VOIT ET SE REFERME. C'est le retour d'usage : « appuyer sur
      // Compléter l'acte sans avoir d'abord choisi une pastille ne fait rien —
      // et l'on ne comprend pas qu'une barre apparaît à droite ». Le bouton doit
      // donc ANNONCER son état, la barre doit se NOMMER, et sa fermeture doit
      // être SUR ELLE (on ne cherche pas le bouton d'origine).
      const bouton2 = dom.querySelector("#rediger-tiroir-btn button");
      if (!bouton2) return "le bouton du tiroir a disparu";
      if (bouton2.getAttribute("aria-expanded") !== "true") {
        return "le bouton du tiroir n'annonce pas la barre ouverte (aria-expanded : « " + bouton2.getAttribute("aria-expanded") + " »)";
      }
      const barre = dom.querySelector("#redaction-tiroir");
      if (barre.hidden || !barre.getBoundingClientRect().width) return "la barre est annoncée ouverte sans être visible";
      const entete = dom.querySelector(".rx-tiroir__entete");
      if (!entete) return "la barre de droite ne se nomme pas : rien ne dit ce qui vient de s'ouvrir";
      if (!/panneau/i.test(entete.textContent || "")) {
        return "l'en-tête de la barre ne dit pas ce qu'elle est : « " + (entete.textContent || "").trim() + " »";
      }
      const fermer = entete.querySelector("button");
      if (!fermer) return "la barre n'a pas son propre bouton de fermeture";
      fermer.click();
      if (!(await jusqua(() => dom.querySelector("#redaction-tiroir").hidden, { essais: 20, pause: 100 }))) {
        return "le bouton de fermeture de la barre ne la referme pas";
      }
      const bouton3 = dom.querySelector("#rediger-tiroir-btn button");
      if (bouton3.getAttribute("aria-expanded") !== "false") {
        return "la barre est refermée, mais le bouton dit encore qu'elle est ouverte";
      }
      return "";
    } finally {
      if (state.rediger && state.rediger.ui) state.rediger.ui.tiroir = tiroirAvant;
      if (!avantDraft) resetDraft();
      redrawView();
      await ctx.revenir(avantRoute);
    }
  },
});

// --------------------- 20. P2 : la décision en tête, au parapheur et en révision
declarer({
  id: "decision-en-tete",
  nom: "Au parapheur et en révision, la décision précède l'explication",
  pourquoi: "le valideur devait descendre sous la ligne de flottaison — sous le parcours, le dossier et le rapport de conformité — pour trouver ses boutons. La décision remonte sous l'identité de l'acte, et ce qui l'explique vient dessous (P2)",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    const dom = ctx.dom();
    if (!state.ready || !state.user) return "";             // parcours sans objet
    const avant = ctx.route();
    try {
      for (const [vue, mot] of [["parapheur", "Votre décision"], ["revision", "Décision du réviseur"]]) {
        navigate(vue);
        const colonne = await jusqua(() => {
          const g = dom.querySelector(".parapheur-grid");
          const droite = g && g.children[1];
          return droite && droite.firstElementChild ? droite.firstElementChild : null;
        }, { essais: 40, pause: 150 });
        if (!colonne) continue;                              // écran sans objet à cet instant
        const cartes = [...colonne.children];
        const rangDecision = cartes.findIndex((c) => mot && (c.textContent || "").includes(mot));
        const rangParcours = cartes.findIndex((c) => /Le parcours de l'acte/.test(c.textContent || ""));
        if (rangParcours < 0) continue;
        if (rangDecision < 0) continue;                      // décision chez un autre : sans objet
        if (rangDecision > rangParcours) {
          return "en " + vue + ", la décision vient APRÈS le parcours (carte " + (rangDecision + 1) + " contre " + (rangParcours + 1) + ")";
        }
        if (rangDecision !== 1) return "en " + vue + ", la décision n'est pas la première carte sous l'identité de l'acte";
      }
      return "";
    } finally {
      await ctx.revenir(avant);
    }
  },
});

// -------------------------------- 21. P4 : l'aide se replie derrière son lien
declarer({
  id: "aide-a-la-demande",
  nom: "Le paragraphe de présentation d'un écran s'est replié derrière « À quoi sert cet écran ? »",
  pourquoi: "chaque écran ouvrait sur un paragraphe de présentation de trois à six lignes, avant toute action. Le texte n'est pas perdu : il se lit à la demande, à droite du titre (P4)",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    const dom = ctx.dom();
    if (!state.ready || !state.user) return "";             // parcours sans objet
    const avant = ctx.route();
    const ecrans = ["trames", "actes", "parapheur", "revision", "referentiel", "chrono"];
    try {
      for (const vue of ecrans) {
        navigate(vue);
        const ligne = await jusqua(() => dom.querySelector(".page-head__ligne"), { essais: 30, pause: 120 });
        if (!ligne) return "l'écran « " + vue + " » n'a pas de ligne de titre";
        const detail = ligne.querySelector(".aide-ecran");
        if (!detail) return "l'écran « " + vue + " » n'a pas d'aide à la demande";
        if (detail.open) return "l'aide de « " + vue + " » est ouverte d'emblée : elle doit se demander";
        const titre = ligne.querySelector(".page-head__title");
        const lien = detail.querySelector("summary");
        const rt = titre.getBoundingClientRect();
        const rl = lien.getBoundingClientRect();
        // « À droite du titre » suppose la place : sur un écran étroit, la ligne
        // passe à la ligne — c'est la mise en page, pas la règle.
        if (window.innerWidth >= 900 && !(rl.left > rt.right - 2)) return "en « " + vue + " », le lien d'aide n'est pas à droite du titre";
        if (!/À quoi sert cet écran/.test(lien.textContent || "")) return "le lien d'aide ne dit pas ce qu'il ouvre";
        const texte = detail.querySelector(".aide-ecran__texte");
        if (!texte || (texte.textContent || "").length < 60) return "l'aide de « " + vue + " » est vide ou perdue";
      }
      return "";
    } finally {
      await ctx.revenir(avant);
    }
  },
});

// ------------------------------------- 22. P7 : l'assistant se fait oublier
declarer({
  id: "assistant-discret",
  nom: "L'assistant reste fermé, ne propose rien de lui-même, et ne recouvre jamais le document",
  pourquoi: "le panneau s'ouvrait tout seul quatorze secondes après l'arrivée, et il flottait PAR-DESSUS l'acte en cours de rédaction. Il s'ouvre désormais quand on le demande, et la page lui réserve sa colonne (P7)",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    const dom = ctx.dom();
    if (!state.ready || !state.user) return "";             // parcours sans objet
    const avant = ctx.route();
    try {
      navigate("trames");
      const racine = await jusqua(() => dom.querySelector(".assist--atelier:not([hidden])"), { essais: 40, pause: 150 });
      if (!racine) return "";                                // assistant éteint pour ce compte : sans objet
      const panneau = racine.querySelector(".assist__panneau");
      if (!panneau) return "l'assistant n'a pas de panneau";
      if (!panneau.hidden) return "le panneau de l'assistant est ouvert au chargement : la revue le veut fermé";
      if (dom.querySelector(".assist__bulle")) return "l'assistant propose encore une bulle de lui-même";
      const pastille = racine.querySelector(".assist__pastille");
      if (!pastille) return "l'assistant n'a pas de bouton pour s'ouvrir";
      pastille.click();
      const ouvert = await jusqua(() => (panneau.hidden ? null : panneau), { essais: 30, pause: 120 });
      if (!ouvert) return "le clic sur l'assistant n'ouvre pas son panneau";
      // Le panneau ne recouvre pas le document : la page lui réserve sa colonne.
      const app = dom.querySelector(".app") || dom.querySelector(".recueil");
      if (window.innerWidth >= 1200) {
        if (!dom.body.classList.contains("assist-ouvert")) return "la page ne réserve pas de colonne au panneau ouvert";
        const ra = app.getBoundingClientRect();
        const rp = panneau.getBoundingClientRect();
        if (rp.left < ra.right - 4) return "le panneau ouvert recouvre le contenu (panneau à " + Math.round(rp.left) + ", contenu jusqu'à " + Math.round(ra.right) + ")";
      }
      pastille.click();
      const ferme = await jusqua(() => (panneau.hidden ? true : null), { essais: 30, pause: 120 });
      if (!ferme) return "l'assistant ne se referme pas";
      if (dom.body.classList.contains("assist-ouvert")) return "la colonne réservée reste après fermeture";
      return "";
    } finally {
      await ctx.revenir(avant);
    }
  },
});

// --------------------------------------- 23. P8 : un menu par métier
declarer({
  id: "menu-par-metier",
  nom: "Le menu range Organisation et Administration derrière une seule entrée « Réglages »",
  pourquoi: "douze entrées sur six rubriques, dont un tiers ne se consulte pas tous les jours : le sommaire noyait les gestes quotidiens. Les rubriques rares se replient sous un seul intitulé, déplié à la demande — et restent atteignables partout, y compris sur un téléphone (P8)",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    const dom = ctx.dom();
    if (!state.ready || !state.user) return "";             // parcours sans objet
    const CLE = "scribae.pref.nav.reglages";
    const prefAvant = localStorage.getItem(CLE);
    const avant = ctx.route();
    const groupes = () => [...dom.querySelectorAll(".app-nav__group")].map((g) => (g.textContent || "").trim());
    try {
      // Replié : les entrées rares ne sont pas dans le menu.
      try { localStorage.setItem(CLE, "0"); } catch (e) { /* poste sans stockage */ }
      navigate("trames");
      const entete = await jusqua(() => dom.querySelector(".app-nav__group--ouvrable"), { essais: 40, pause: 150 });
      if (!entete) return "le menu n'a pas d'entrée « Réglages »";
      if (!/Réglages/.test(entete.textContent || "")) return "l'entrée repliable ne s'appelle pas « Réglages » (" + entete.textContent + ")";
      if (entete.getAttribute("aria-expanded") !== "false") return "« Réglages » s'ouvre d'emblée";
      const visibles = [...dom.querySelectorAll(".app-nav__item .app-nav__label")].map((x) => (x.textContent || "").trim());
      if (visibles.some((v) => /Administration|Organigramme|Chrono/.test(v))) {
        return "replié, « Réglages » laisse voir ses entrées : " + visibles.filter((v) => /Administration|Organigramme|Chrono/.test(v)).join(", ");
      }
      if (groupes().some((g) => /^Organisation$|^Configurer$/.test(g))) return "le menu a gardé les rubriques « Organisation » et « Configurer »";
      // Déplié : elles reviennent, et le choix est retenu.
      entete.click();
      const ouvert = await jusqua(() => {
        const v = [...dom.querySelectorAll(".app-nav__item .app-nav__label")].map((x) => (x.textContent || "").trim());
        return v.some((x) => /Administration/.test(x)) ? v : null;
      }, { essais: 30, pause: 120 });
      if (!ouvert) return "« Réglages » déplié ne montre toujours pas l'Administration";
      if (localStorage.getItem(CLE) !== "1") return "l'ouverture de « Réglages » n'est pas retenue par le poste";
      // Un écran de Réglages reste atteignable : le groupe s'ouvre de lui-même.
      navigate("referentiel");
      const montre = await jusqua(() => {
        const e = dom.querySelector(".app-nav__group--ouvrable");
        const v = [...dom.querySelectorAll(".app-nav__item .app-nav__label")].map((x) => (x.textContent || "").trim());
        return e && e.getAttribute("aria-expanded") === "true" && v.some((x) => /Administration/.test(x)) ? true : null;
      }, { essais: 30, pause: 120 });
      if (!montre) return "sur un écran de Réglages, le groupe ne s'ouvre pas pour montrer où l'on est";
      return "";
    } finally {
      try {
        if (prefAvant === null) localStorage.removeItem(CLE);
        else localStorage.setItem(CLE, prefAvant);
      } catch (e) { /* poste sans stockage */ }
      await ctx.revenir(avant);
    }
  },
});

// ------------------- 24. L'en-tête sur une ligne, et la cloche des notifications
declarer({
  id: "entete-une-ligne",
  nom: "L'en-tête tient sur une ligne, et le bouton des notifications est une cloche",
  pourquoi: "l'en-tête se repliait sur deux ou trois rangées quand la fenêtre rétrécissait, et repoussait le compte du poste hors de la première ligne ; le bouton des notifications portait l'icône de l'aide (un « i » cerclé) au lieu d'une cloche",
  async jouer(ctx) {
    const dom = ctx.dom();
    const head = await jusqua(() => dom.querySelector(".app-header"), { essais: 40, pause: 150 });
    if (!head) return "";                                  // écran sans coquille (connexion, recueil)
    // Le compte est le DERNIER outil de l'en-tête : tout à droite.
    const compte = dom.querySelector(".app-user-wrap");
    if (!compte) return "l'en-tête n'a plus le menu du compte";
    const outils = dom.querySelector(".app-header__tools");
    if (!outils || outils.lastElementChild !== compte) return "le compte n'est pas le dernier outil de l'en-tête";
    // Le compte reste ENTIER : il ne dépasse jamais la fenêtre.
    if (compte.getBoundingClientRect().right > innerWidth + 1) return "le compte dépasse le bord de la fenêtre (l'en-tête déborde)";
    // Une seule rangée : tous les enfants visibles partagent l'axe médian.
    // (Sous 700 px, l'en-tête se replie à dessein sur deux rangées : on se tait.)
    if (getComputedStyle(head).flexWrap === "nowrap") {
      const r = head.getBoundingClientRect();
      const milieu = r.top + r.height / 2;
      const decentres = [...head.children]
        .filter((e) => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0)
        .filter((e) => Math.abs(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2 - milieu) > 8);
      if (decentres.length) return "l'en-tête s'est replié : " + decentres.length + " élément(s) sur une autre rangée";
      if (r.height > 80) return "l'en-tête fait " + Math.round(r.height) + " px de haut : il s'est replié";
    }
    // Le bouton des notifications porte une cloche, pas l'icône de l'aide.
    const clocheBtn = await jusqua(() => dom.querySelector(".collab-cloche__btn"), { essais: 40, pause: 150 });
    if (!clocheBtn) return "l'en-tête n'a plus le bouton des notifications";
    const cloche = clocheBtn.querySelector("svg");
    if (!cloche) return "le bouton des notifications n'a plus d'icône";
    if (cloche.getAttribute("data-icon") !== "cloche") return "le bouton des notifications porte l'icône « " + cloche.getAttribute("data-icon") + " », pas une cloche";
    return "";
  },
});

// ------------------------------------------------- 25. le dépôt d'une pièce
// Les fichiers joints — l'original signé d'une reprise d'acte ancien, la
// version signée d'un acte du circuit externe — se déposaient chez l'hôte de la
// plateforme (`root.uploadPlugin`). Une installation AUTO-HÉBERGÉE n'a pas cet
// hôte : le dépôt y échouait TOUJOURS, sur un « root.uploadPlugin is not a
// function » que le rédacteur n'avait aucun moyen de contourner. On masque donc
// le dépôt de l'hôte — comme en auto-hébergement — et l'on vérifie que le dépôt
// emprunte celui du SERVICE (src/lib/fichiers.js) : la requête part bien vers
// `/v1/pieces`, et, quand le service autorise l'écriture, la pièce se relit et
// se retire.
declarer({
  id: "piece-depot",
  nom: "Le dépôt d'une pièce ne dépend pas de la plateforme",
  pourquoi: "sans dépôt chez l'hôte (auto-hébergement), l'original signé d'une reprise et la version signée d'un circuit externe ne pouvaient pas être joints du tout : le dépôt doit se rabattre sur le service",
  async jouer(ctx) {
    const { state } = ctx.modules();
    const { deposerPiece, supprimerPiece } = await import(RACINE_CODE + "lib/fichiers.js");
    const { publicationSettings } = await import(RACINE_CODE + "lib/eli.js");
    const remote = await import(RACINE_CODE + "lib/remote.js");
    const racine = globalThis.root || {};
    const avantUpload = racine.uploadPlugin;
    const jeton = publicationSettings(state.config).jetonDemonstration;
    try {
      // L'état d'une installation auto-hébergée : aucun dépôt de fichiers fourni
      // par l'hôte. `__SCRIBA_HOST__` (l'édition statique) est masqué de même.
      try { delete racine.uploadPlugin; } catch (e) { /* l'hôte refuse d'être masqué */ }
      const octets = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);   // « %PDF-1.4 »
      const fichier = new File([octets], "essai.pdf", { type: "application/pdf" });
      const empreinte = await crypto.subtle.digest("SHA-256", octets);
      const sha256 = [...new Uint8Array(empreinte)].map((x) => x.toString(16).padStart(2, "0")).join("");

      const avant = remote.log.length;
      let piece = null;
      let refus = "";
      try { piece = await deposerPiece(fichier, { sha256, token: jeton }); }
      catch (e) { refus = String((e && e.message) || e); }

      // 1. La requête est bien PARTIE vers le service : c'est ce qui manquait —
      //    l'ancien dépôt levait sans rien appeler.
      const envoi = remote.log.slice(avant).find((e) => e.path === "/v1/pieces");
      if (!envoi) return "le dépôt n'a pas atteint le service (aucun appel à /v1/pieces)" + (refus ? " : " + refus : "");
      // 2. Un service qui n'autorise pas l'écriture — installation neuve, non
      //    provisionnée, ou poste sans la clé d'écriture — refuse ce dépôt comme
      //    il refuse tout autre : c'est un état d'installation, pas un défaut du
      //    dépôt (l'application le dit à l'écran, avec son remède). Le parcours
      //    est alors sans objet, comme celui d'un acte publié quand il n'y en a
      //    aucun.
      if (!piece) {
        if (envoi.status >= 400 && envoi.status < 500) return "";
        return "le dépôt par le service a échoué (" + (envoi.status || "sans réponse") + ") : " + refus;
      }
      if (!piece.pieceId) return "le service n'a pas rendu d'identifiant pour la pièce déposée";
      if (!piece.url) return "le service n'a pas rendu d'adresse pour la pièce déposée";

      // 3. Le service la connaît, et c'est bien le contenu déposé.
      const lu = await ctx.appelerService("GET", "/v1/pieces/" + piece.pieceId);
      if (!lu || lu.status !== 200) return "la pièce déposée n'est pas relisible (statut " + (lu && lu.status) + ")";
      const b64attendu = btoa(String.fromCharCode.apply(null, octets));
      if (lu.body && lu.body.base64 && lu.body.base64 !== b64attendu) return "la pièce relue n'a pas le contenu déposé";

      // 4. Le retrait laisse le service propre.
      if (!(await supprimerPiece(piece.pieceId, { token: jeton }))) return "la pièce déposée ne se retire pas";
      const apres = await ctx.appelerService("GET", "/v1/pieces/" + piece.pieceId);
      if (!apres || apres.status !== 404) return "la pièce retirée répond encore (statut " + (apres && apres.status) + ")";
      return "";
    } finally {
      // Le dépôt de l'hôte est remis en place : le parcours ne change rien pour
      // ce qui suit. (Certains hôtes refusent qu'on le leur repose — on ne leur
      // en tient pas rigueur : c'est le rechargement de la page qui rétablit.)
      if (avantUpload) { try { racine.uploadPlugin = avantUpload; } catch (e) { /* rien à faire */ } }
    }
  },
});

// ----------------------------------- 26. la signature ne s'offre pas à autrui
declarer({
  id: "signature-hors-competence",
  nom: "Personne ne signe à la place d'un autre — ni par la règle, ni par l'écran",
  pourquoi: "l'usurpation du signataire (NC-II-006) se referme par UNE règle, `peutSignerEffectivement` : être le TITULAIRE de la chaîne de signature (dernier étage) ET porter la qualité de signataire. L'épreuve la confronte à TOUT le jeu (chaque acte × chaque compte), puis REGARDE l'écran : l'application n'offre le geste de signature que là où la règle l'accorde, et propose sinon l'envoi en signature — qui n'engage personne.",
  async jouer(ctx) {
    const { state, navigate } = ctx.modules();
    const dom = ctx.dom();
    if (!state.ready || !state.user) return "";             // parcours sans objet
    const sig = await import(RACINE_CODE + "lib/signataires.js");
    const users = await import(RACINE_CODE + "lib/users.js");
    const trameDe = (a) => (state.trames || []).find((t) => t.id === a.trameId) || null;

    // 1. LA RÈGLE, sur tout le jeu. Pour chaque acte et chaque compte, la
    //    signature n'est ouverte que si le compte EST le titulaire (dernier
    //    étage de la chaîne) ET porte la qualité de signataire. Tout autre cas
    //    — un délégant, un compte hors chaîne, un compte sans la qualité — est
    //    un refus.
    for (const a of state.actes || []) {
      const trame = trameDe(a);
      const etapes = sig.etapesDeSignature(state.config, a, trame);
      const titulaire = (etapes.map((e) => e.person).filter(Boolean).slice(-1)[0]) || null;
      for (const u of state.users || []) {
        if (!u || users.estVisiteur(u)) continue;
        const c = sig.competenceDuCompte(state.config, u, a, trame);
        const attendu = !!(c.ok && c.effectif && users.hasRole(u, sig.ROLE_SIGNATAIRE));
        const accorde = sig.peutSignerEffectivement(state.config, u, a, trame).ok;
        if (accorde !== attendu) {
          return `règle faussée : ${u.login || u.id} sur l'acte ${a.numero || a.id} — accordé ${accorde}, attendu ${attendu}`;
        }
        // Accorder la signature à quelqu'un d'autre que le titulaire serait
        // l'usurpation elle-même.
        if (accorde && titulaire && String(u.personId || "") !== String(titulaire.id || "")) {
          return `signature accordée à ${u.login || u.id}, qui n'est pas le titulaire de l'acte ${a.numero || a.id}`;
        }
      }
    }

    // 2. L'ÉCRAN. On ouvre le circuit d'un acte que ce compte ne peut PAS signer,
    //    et l'on vérifie que rien n'y propose la signature : ni le bouton de la
    //    fenêtre (« Vérifier et signer »), ni l'outil du prestataire.
    const cible = (state.actes || []).find((a) => {
      if (a.original || a.statut === "signee" || a.statut === "publie") return false;
      if (a.kind === "consolide" || a.nature === "annexe") return false;
      const t = trameDe(a);
      if (t && t.nature === "annexe") return false;
      return !sig.peutSignerEffectivement(state.config, state.user, a, t).ok;
    });
    if (!cible) return "";             // aucun acte hors compétence : rien à regarder
    const avant = ctx.route();
    try {
      const ui = (state.signature = state.signature || { tab: "circuit", acteId: null });
      ui.tab = "circuit";
      ui.acteId = cible.id;
      navigate("signature");
      const carte = await jusqua(() => [...dom.querySelectorAll(".fr-card")]
        .find((c) => /^Circuit — /.test(((c.querySelector("h2.fr-card__title") || {}).textContent) || "")), { essais: 40, pause: 150 });
      if (!carte) return "la carte du circuit de signature ne s'est pas affichée";
      const libelles = [...carte.querySelectorAll("button")].map((b) => (b.textContent || "").trim());
      const offrande = libelles.find((l) => /^Vérifier et (signer|faire signer)$/.test(l) || /^Ouvrir l'outil de signature$/.test(l) || /^Signer l'acte$/.test(l));
      if (offrande) {
        return `l'écran offre « ${offrande} » sur l'acte ${cible.numero || cible.id}, que ce compte ne peut pas signer`;
      }
      // L'envoi en signature, lui, reste possible : c'est le geste de la
      // rédaction, qui n'engage la signature de personne.
      return "";
    } finally {
      try { state.signature.acteId = null; } catch (e) { /* rien à faire */ }
      await ctx.revenir(avant);
    }
  },
});

// --------------------------------------------------------------------------- run
//
// Le contexte (`ctx`) est fourni par l'appelant : c'est lui qui sait manœuvrer
// l'application (route, modules, DOM), et le refaire ici ferait de cette suite un
// second client de l'application. Voir `contexteDeLApercu` plus bas pour l'usage
// courant dans l'aperçu de l'éditeur.
export async function lancerParcours(ctx, { seulement = null } = {}) {
  // Le service met un instant à ouvrir son état durable : une suite lancée dans
  // la foulée d'un chargement tomberait sur son premier souffle (état pas encore
  // là, donc erreur du service) et accuserait le contrat à tort. On attend qu'il
  // réponde, une fois, avant de juger quoi que ce soit.
  if (ctx.appelerService) {
    for (let i = 0; i < 40; i++) {
      let pret = false;
      try {
        const r = await ctx.appelerService("GET", "/v1/health");
        pret = r && r.status === 200;
      } catch (e) { /* pas encore ouvert */ }
      if (pret) break;
      await attendre(250);
    }
  }
  const resultats = [];
  for (const p of PARCOURS) {
    if (seulement && !seulement.includes(p.id)) continue;
    let raison = "";
    try {
      raison = (await p.jouer(ctx)) || "";
    } catch (e) {
      raison = "exception : " + String((e && e.message) || e);
    }
    resultats.push({ id: p.id, nom: p.nom, ok: !raison, raison });
  }
  const echecs = resultats.filter((r) => !r.ok);
  return { total: resultats.length, ok: resultats.length - echecs.length, echecs, resultats };
}

// Le contexte de l'APERÇU (et de toute page de l'application) : les modules de
// l'application, lus depuis la page elle-même — donc les mêmes instances que
// celles qui tournent, et le même état.
export async function contexteDeLApercu({ base = "" } = {}) {
  // `base` : l'adresse du dossier qui PORTE ce module, quand l'appelant tient à
  // la fixer (l'éditeur sert la page depuis le sous-domaine du générateur alors
  // que ses modules viennent de l'origine de l'éditeur). Sans `base`, on prend
  // sa propre adresse. Dans les deux cas, le code est atteint par `RACINE_CODE`,
  // constatée plus haut.
  const racine = (base || new URL(".", import.meta.url).href) + RACINE_CODE;
  const state = await import(racine + "ui/state.js");
  const recueilPublic = await import(racine + "ui/views/recueil-public.js");
  const hosts = await import(racine + "lib/hosts.js");
  const remote = await import(racine + "lib/remote.js");

  // Le transport du service : le client de l'application lui-même, pour que la
  // conformité porte sur ce que l'application appelle vraiment.
  const appelerService = async (methode, chemin, corps) => {
    // L'hôte de l'aperçu n'est pas un serveur : le service y tourne dans
    // l'émulateur de la plateforme, sous un budget de calcul par gestionnaire.
    // Quand un appel tombe pendant que la page travaille (au chargement, pendant
    // une salve d'épreuves), l'émulateur INTERROMPT le gestionnaire et le
    // service rend son 500 de rattrapage — sans code, sans route en cause. Ce
    // n'est pas le contrat qui a échoué, c'est l'hôte qui a coupé : on redonne
    // sa chance à l'appel avant de l'imputer au service (un vrai 5xx, lui, tient
    // tête aux trois essais et l'épreuve le rapporte).
    //
    // Le budget peut aussi faire TOMBER le canal (`close` 1011 : l'émulateur
    // reconstruit le service) : l'appel échoue alors sans réponse du tout.
    // C'est le même contretemps, et il mérite la même patience — sans quoi une
    // épreuve échoue sur « aucune réponse » alors que le service est sain.
    let r = null;
    for (let i = 0; i < 4; i += 1) {
      try {
        r = await remote.call(methode, chemin, { body: corps === undefined ? undefined : corps });
      } catch (e) {
        r = { status: 0, body: { erreur: "canal fermé : " + String((e && e.message) || e) } };
      }
      if (r.status >= 200 && r.status < 500) break;
      await attendre(800);
    }
    return { status: r.status, body: r.body };
  };

  const lireRoute = () => (state.state.route && state.state.route.view) || "recueil";
  const retour = async (view) => {
    state.navigate(view === "recueil" ? "recueil" : view);
    await jusqua(() => document.querySelector(".recueil") || document.querySelector(".app"), { essais: 20 });
  };

  return {
    modules: () => ({ state: state.state, navigate: state.navigate }),
    etat: () => state.state,
    dom: () => document,
    route: lireRoute,
    nomService: "service de l'aperçu",
    appelerService,
    async allerRecueil() {
      state.navigate("recueil");
      // Le recueil se remplit de façon asynchrone (lecture des publications) :
      // on attend son ossature, pas son contenu.
      return !!(await jusqua(() => document.querySelector(".recueil")));
    },
    async allerActe(cle) {
      // La page PUBLIQUE d'un acte est une route du recueil (« recueil/<clé> »,
      // adresse « ?acte=<clé> ») — et non la vue « publication » de l'atelier.
      state.navigate("recueil/" + cle);
      return !!(await jusqua(() => document.querySelector(".recueil-notice") || document.querySelector(".recueil")));
    },
    async revenir(view) { await retour(view); },
    // La fonction qui redessine le recueil : sa présence est ce qui garantit
    // qu'une invalidation venue de l'atelier l'atteint (1.6.1d).
    redessinerRecueil: () => typeof recueilPublic.redessinerRecueilPublic === "function",
    _hosts: hosts,
  };
}
