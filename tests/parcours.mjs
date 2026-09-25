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

// --------------------------------------------------------------------------- run
//
// Le contexte (`ctx`) est fourni par l'appelant : c'est lui qui sait manœuvrer
// l'application (route, modules, DOM), et le refaire ici ferait de cette suite un
// second client de l'application. Voir `contexteDeLApercu` plus bas pour l'usage
// courant dans l'aperçu de l'éditeur.
export async function lancerParcours(ctx, { seulement = null } = {}) {
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
    const r = await remote.call(methode, chemin, { body: corps === undefined ? undefined : corps });
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
