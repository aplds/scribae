// ============================================================================
// Collaboration dans l'en-tête : qui est là, et ce qui m'attend.
//
// Deux objets, mis à jour d'eux-mêmes (sans redessiner l'application — sinon on
// perdrait le curseur de l'agent à chaque battement de cœur) :
//
//   • la PRÉSENCE : combien de postes travaillent en ce moment, sur quel écran,
//     et qui rédige quoi. Cliquer un poste qui rédige un acte ouvre cet acte.
//   • la CLOCHE : les notifications, c'est-à-dire les entrées du journal qui
//     désignent le compte courant — un acte soumis au parapheur, un bon pour
//     accord donné sur mon acte, une signature, une publication.
//
// Les données viennent de src/lib/collab.js ; ici, il n'y a que l'affichage.
// ============================================================================
import { h, clear, icon, button, toast } from "./dom.js";
import {
  state, navigate, surChangementCollab, presencesActives,
  notifications, marquerVu,
} from "./state.js";
import { formatDate } from "../lib/util.js";

let unsubs = [];
let panneau = null;

// Monte (ou remonte) les deux témoins dans le conteneur d'outils de l'en-tête.
export function monterBarreCollab(container) {
  unsubs.forEach((f) => { try { f(); } catch (e) { /* déjà retiré */ } });
  unsubs = [];
  clear(container);
  const presence = h("div", { class: "collab-presence" });
  const cloche = h("div", { class: "collab-cloche" });
  container.appendChild(presence);
  container.appendChild(cloche);
  const maj = () => { peindrePresence(presence); peindreCloche(cloche); };
  unsubs.push(surChangementCollab(maj));
  unsubs.push(() => fermerPanneau());
  maj();
}

function fermerPanneau() {
  if (!panneau) return;
  panneau.remove();
  panneau = null;
  document.removeEventListener("click", onDoc, true);
}
const onDoc = (e) => { if (panneau && !panneau.contains(e.target)) fermerPanneau(); };

// ------------------------------------------------------------------ présence
function peindrePresence(box) {
  clear(box);
  const actifs = presencesActives();
  const autres = actifs.filter((p) => p.userId !== state.user?.id);
  const monte = h("button", {
    class: "collab-presence__btn", type: "button",
    title: actifs.length > 1
      ? "Postes connectés : " + actifs.map((p) => p.byName + (p.ecran ? " (" + p.ecran + ")" : "")).join(", ")
      : "Vous êtes seul connecté pour l'instant",
    on: { click: (e) => { e.stopPropagation(); basculerPanneauPrecence(box); } },
  },
    h("span", { class: "collab-presence__dots" }, ...actifs.slice(0, 4).map((p, i) =>
      h("span", { class: "collab-presence__dot", style: { zIndex: String(10 - i) }, text: initiales(p.byName) }))),
    actifs.length ? h("span", { class: "collab-presence__n", text: actifs.length > 4 ? "+" + (actifs.length - 4) : String(actifs.length) }) : null,
  );
  box.appendChild(monte);
  box.title = autres.length ? autres.length + " autre(s) poste(s) connecté(s)" : "";
}

function basculerPanneauPrecence(ancre) {
  const deja = panneau?.dataset.kind === "presence";
  fermerPanneau();
  if (deja) return;
  const actifs = presencesActives();
  const corps = h("div", { class: "collab-panel__body" });
  if (!actifs.length) corps.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucune présence détectée." }));
  for (const p of actifs) {
    const moi = p.userId === state.user?.id;
    corps.appendChild(h("div", { class: "collab-panel__row" + (moi ? " is-me" : "") },
      h("span", { class: "collab-presence__dot", text: initiales(p.byName) }),
      h("span", { class: "collab-panel__text" },
        h("strong", { text: p.byName + (moi ? " (vous)" : "") }),
        h("span", { class: "fr-small fr-muted", text: [libelleEcran(p.ecran), p.acteLabel ? "→ " + p.acteLabel : ""].filter(Boolean).join(" · ") || "—" })),
      !moi && p.acteId
        ? h("button", { class: "fr-btn fr-btn--tertiary fr-btn--sm", text: "Ouvrir", on: { click: () => { fermerPanneau(); navigate("acte/" + p.acteId); } } })
        : null,
    ));
  }
  ouvrirPanneau(ancre, "presence", "Postes connectés", corps);
}

// ------------------------------------------------------------------- cloche
async function peindreCloche(box) {
  clear(box);
  if (!state.user) return;
  const liste = await notifications({});
  const nonLus = liste.filter((e) => !e.lu).length;
  const b = h("button", {
    class: "collab-cloche__btn" + (nonLus ? " is-on" : ""), type: "button",
    title: nonLus ? nonLus + " nouvelle(s) notification(s)" : "Notifications",
    on: { click: (e) => { e.stopPropagation(); basculerPanneauCloche(box); } },
  }, icon("info", 16), nonLus ? h("span", { class: "collab-cloche__n", text: String(nonLus > 9 ? "9+" : nonLus) }) : null);
  box.appendChild(b);
}

async function basculerPanneauCloche(ancre) {
  const deja = panneau?.dataset.kind === "cloche";
  fermerPanneau();
  if (deja) return;
  const liste = await notifications({});
  const corps = h("div", { class: "collab-panel__body" });
  if (!liste.length) {
    corps.appendChild(h("p", { class: "fr-small fr-muted", text: "Rien à signaler. Les notifications arrivent quand un acte de votre périmètre change d'étape : soumission au parapheur, bon pour accord, renvoi, signature, publication." }));
  }
  for (const e of liste.slice(0, 40)) {
    corps.appendChild(h("button", {
      class: "collab-panel__row collab-panel__row--notif" + (e.lu ? "" : " is-new"),
      on: { click: () => { fermerPanneau(); if (e.acteId) navigate("acte/" + e.acteId); } },
    },
      h("span", { class: "collab-panel__text" },
        h("strong", { text: e.cibleLabel ? libelleAction(e.action) + " — " + e.cibleLabel : libelleAction(e.action) }),
        h("span", { class: "fr-small", text: e.detail || "" }),
        h("span", { class: "fr-small fr-muted", text: [e.byName, quand(e.at)].filter(Boolean).join(" · ") })),
    ));
  }
  const pied = h("div", { class: "collab-panel__foot" },
    h("span", { class: "fr-small fr-muted", text: liste.length + " notification(s)" }),
    button("Tout marquer comme lu", { variant: "tertiary", size: "sm", icon: "check", onClick: async () => { await marquerVu(); fermerPanneau(); toast("Notifications marquées comme lues", "success"); } }),
  );
  ouvrirPanneau(ancre, "cloche", "Notifications", corps, pied);
}

function ouvrirPanneau(ancre, kind, titre, corps, pied) {
  panneau = h("div", { class: "collab-panel", dataset: { kind } },
    h("div", { class: "collab-panel__head" }, h("strong", { text: titre })),
    corps,
    pied || null,
  );
  ancre.appendChild(panneau);
  setTimeout(() => document.addEventListener("click", onDoc, true), 0);
}

// ------------------------------------------------------------------ libellés
function initiales(nom) {
  const parts = String(nom || "?").split(/[\s.-]+/).filter(Boolean);
  const deux = (parts.length > 1 ? parts[parts.length - 1][0] + parts[0][0] : parts[0]?.slice(0, 2) || "?").toUpperCase();
  return deux;
}

const ACTIONS = {
  "parapheur.depot": "Acte soumis au parapheur",
  "parapheur.accord": "Bon pour accord",
  "parapheur.passe": "Étape passée",
  "parapheur.refus": "Acte refusé",
  "parapheur.renvoi": "Acte renvoyé",
  "parapheur.reprise": "Circuit repris",
  "revision.depot": "Acte soumis à la révision",
  "revision.validation": "Acte révisé",
  "revision.rejet": "Acte rejeté en révision",
  "formalite.transmission": "Transmission enregistrée",
  "formalite.publication": "Publication enregistrée",
  "formalite.notification": "Notification enregistrée",
  "formalite.effacement": "Constatation effacée",
  "acte.enregistrement": "Acte enregistré",
  "acte.creation": "Acte créé",
  "signature.depot": "Acte déposé",
  "signature.signe": "Acte signé",
  "signature.refus": "Signature refusée",
  "publication.publie": "Acte publié",
  corbeille: "Objet mis à la corbeille",
  restauration: "Objet restauré",
  suppression: "Objet supprimé définitivement",
  trame: "Trame modifiée",
  compte: "Compte modifié",
  referentiel: "Référentiel modifié",
};
const libelleAction = (a) => ACTIONS[a] || a || "Modification";

const ECRANS = {
  trames: "registre des trames", trame: "éditeur de trame", rediger: "rédaction",
  actes: "registre des actes", acte: "fiche d'un acte", modifier: "modification d'acte",
  signature: "signature", publications: "publications", referentiel: "administration",
  styles: "feuilles de style", comptes: "comptes", parapheur: "parapheur", revision: "révision",
  execution: "exécution & délais", corbeille: "corbeille", aide: "guide", docs: "documentation",
};
const libelleEcran = (e) => ECRANS[e] || e || "";

function quand(at) {
  const t = Date.parse(at || "");
  if (!t) return "";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return "il y a " + min + " min";
  if (min < 1440) return "il y a " + Math.round(min / 60) + " h";
  return "le " + formatDate(String(at).slice(0, 10));
}
