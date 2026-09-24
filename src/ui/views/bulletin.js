// ============================================================================
// Bulletin — le Journal des actes administratifs, tenu par la collectivité.
//
// Le recueil publie ses actes au fil de l'eau ; le BULLETIN les rassemble par
// PÉRIODE et les diffuse : une sous-page du recueil par numéro, un flux RSS et
// Atom, un courriel aux abonnés. Une période EST un bulletin ; pas de
// publication sur la période, pas de numéro.
//
// Cet écran ne CALCULE rien : il lit l'état du TABLEAU DE BORD du service (voir
// src/lib/bulletins-service.js) et lui demande ses gestes — composer les numéros
// échus, montrer la période en cours à titre provisoire, adresser un numéro aux
// abonnés, retirer un abonné. Tout ce qui se décide — la cadence, le titre, la
// fenêtre de parution — se règle dans Administration › Publication (« Bulletin
// des actes »), à côté du recueil dont il est une forme.
//
// Deux choses sont montrées côte à côte, et ne se confondent pas :
//   • les NUMÉROS — ce qui est paru, ce qui est en cours (provisoire), et ce qui
//     est parti par courriel ;
//   • les ABONNÉS — qui reçoit le bulletin, dans quel état (attente, confirmé,
//     désabonné), avec le lien de désabonnement propre à chacun.
// ============================================================================
import { state, redrawView, can, navigate, oublierBulletinsRecueil } from "../state.js";
import { h, button, toast, badge } from "../dom.js";
import { confirmDialog, emptyState } from "../components.js";
import { copyText, formatDate } from "../../lib/util.js";
import { publicationSettings } from "../../lib/eli.js";
import {
  libelleCadence, titreBulletin, adresseBulletins, adresseBulletin, adresseBulletinFichier,
  adresseFluxBulletin, etatAbonneLabel, etatAbonneBadge,
} from "../../lib/bulletins.js";
import * as bs from "../../lib/bulletins-service.js";
import { amorcerBulletin } from "../demo-publications.js";

export function renderBulletin(root) {
  state.ui = state.ui || {};
  const u = (state.ui.bulletin = state.ui.bulletin || { charge: false, action: "" });
  const reglages = publicationSettings(state.config);
  const gerer = can("bulletin.gerer");
  const admin = can("referentiel.gerer");

  root.appendChild(pageHead(u, gerer));
  root.appendChild(h("div", { class: "fr-stack" }, corps(u, gerer, admin, reglages)));

  // La PREMIÈRE lecture : elle est asynchrone, et le redessin la suit. On ne la
  // relance pas à chaque redessin — c'est `u.charge` qui le dit, et les gestes
  // rafraîchissent eux-mêmes l'état (voir bulletins-service.js).
  if (!u.charge && !u.chargement) {
    u.chargement = true;
    // En DÉMONSTRATION, le service ne voit pas le référentiel du poste : les
    // réglages du bulletin lui sont déposés AVANT la lecture, sinon l'écran
    // lirait un bulletin éteint qu'un administrateur vient d'allumer (voir
    // src/ui/demo-publications.js, `amorcerBulletin`).
    amorcerBulletin({ silencieux: true })
      .then(() => Promise.all([bs.chargerTableau({ silencieux: true }), bs.chargerPublic({ silencieux: true })]))
      .finally(() => { u.chargement = false; u.charge = true; redrawView(); });
  }
}

function pageHead(u, gerer) {
  const actif = bs.etat.tableau ? bs.etat.tableau.actif : null;
  return h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Bulletin" }),
      h("p", { class: "page-head__sub", text: "Le Journal des actes : le recueil rassemblé par période, adressé à ses abonnés et suivi par un flux. "
        + "Les actes y sont classés par entité, puis par thématique — l'ordre de lecture d'un bulletin officiel. Une période sans publication ne donne aucun numéro." })),
    h("div", { class: "page-head__actions" },
      actif === null ? null : badge(actif ? "Bulletin ouvert" : "Bulletin éteint", actif ? "success" : "info"),
      u.chargement ? h("span", { class: "fr-small fr-muted", text: "Lecture…" }) : null,
      button("Ouvrir le recueil public", { variant: "secondary", icon: "globe", onClick: () => navigate("recueil") }),
      can("referentiel.gerer") ? button("Réglages du bulletin", { variant: "secondary", icon: "grid", onClick: () => navigate("referentiel") }) : null,
      gerer ? button("Composer les numéros échus", { variant: "primary", icon: "refresh", onClick: () => agir(u, () => bs.generer({}), "Numéros composés.") }) : null));
}

function corps(u, gerer, admin, reglages) {
  // Le service n'a pas répondu : le dire, plutôt que de montrer un bulletin vide
  // qui passerait pour un bulletin sans numéro. En mode LOCAL, ce n'est pas une
  // panne mais une impossibilité : le bulletin demande le service.
  if (bs.etat.disponible === false) {
    return h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: "Le Bulletin demande le service de données" }),
      h("p", { class: "fr-card__sub", text: bs.etat.motif || "Le service n'a pas répondu : le recueil et le bulletin sont tenus par lui. En mode local, les données restent sur ce poste et le bulletin — qui publie une page, un flux et des courriels — n'est pas disponible." }),
      h("p", { class: "fr-small fr-muted", text: bs.etat.erreur || "" }),
      button("Réessayer", { variant: "primary", onClick: () => { u.charge = false; bs.oublier(); redrawView(); } }));
  }
  const t = bs.etat.tableau;
  if (!t) return h("div", { class: "fr-card" }, h("p", { class: "fr-muted", text: "Lecture de l'état du bulletin…" }));

  const blocs = [etatBloc(t, reglages, gerer)];

  // La période EN COURS : son aperçu n'existe que si l'on demande à le composer
  // (il change à chaque publication). Il est PROVISOIRE, et ne part jamais.
  const provisoire = t.apercu && t.apercu.provisoire ? t.apercu : null;
  if (provisoire) blocs.push(apercuBloc(provisoire, gerer, u));
  else if (gerer && t.actif) blocs.push(h("p", { class: "fr-small fr-muted" },
    h("span", { text: "La période en cours n'est pas encore composée. " }),
    button("Voir un aperçu du numéro en cours", { variant: "tertiary", size: "sm", icon: "eye", onClick: () => agir(u, () => bs.generer({ enCours: true }), "Aperçu composé.") }),
    h("span", { text: " — il est provisoire, et n'est adressé à personne." })));

  blocs.push(numerosBloc(t, gerer, u));
  blocs.push(abonnesBloc(t, admin, u));
  blocs.push(envoisBloc(t));
  return h("div", { class: "fr-stack" }, ...blocs);
}

// ------------------------------------------------------------- l'état du bulletin
function etatBloc(t, reglages, gerer) {
  const carte = (label, valeur, detail) => h("div", { class: "bul-stat" },
    h("span", { class: "bul-stat__l", text: label }),
    h("strong", { class: "bul-stat__v", text: valeur }),
    detail ? h("span", { class: "bul-stat__d", text: detail }) : null);
  const prochaine = t.prochaine;
  const ab = t.abonnes || {};
  return h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: t.titre || reglages.titre }),
    h("p", { class: "fr-card__sub", text: (t.sousTitre || reglages.sousTitre || "") || "Le bulletin rassemble les actes publiés sur sa période." }),
    h("div", { class: "bul-stats" },
      carte("Cadence", t.cadence ? t.cadence.label : "—", t.cadence ? t.cadence.resume : ""),
      carte("Période en cours", prochaine ? prochaine.libelle : "—", prochaine ? "du " + formatDate(prochaine.debut) + " au " + formatDate(prochaine.fin) : ""),
      carte("Prochaine parution", prochaine && prochaine.parution ? formatDate(prochaine.parution) : "—", "à la clôture de la période"),
      carte("Numéros parus", String(t.bulletins || 0), t.periodesExaminees ? t.periodesExaminees + " période(s) examinée(s)" : ""),
      carte("Abonnés", String(ab.confirmes || 0), (ab.attente ? ab.attente + " en attente · " : "") + (ab.retires ? ab.retires + " désabonné(s)" : "personnes recevant le bulletin")),
      carte("En attente d'envoi", String(t.enAttente || 0), "livraisons en file")),
    h("div", { class: "bul-liens" },
      lienCopiable("Adresse publique", adresseBulletins()),
      lienCopiable("Flux RSS", adresseFluxBulletin("rss")),
      lienCopiable("Flux Atom", adresseFluxBulletin("atom"))),
    h("p", { class: "fr-small fr-muted" },
      h("span", { text: "Réglages : " }),
      h("span", { text: (t.titreBulletin ? "« " + t.titreBulletin + " »" : "titre du bulletin") + ", " + libelleCadence(t.cadence) + ". " }),
      h("span", { text: t.cadenceAppliquee ? "Dernière cadence appliquée : " + t.cadenceAppliquee + ". " : "" }),
      h("span", { text: "Titre d'un numéro : « " + titreBulletin({ titre: t.titre, titreBulletin: t.titreBulletin }, 1, "septembre 2026") + " ». " }),
      h("span", { text: "Le service observe le calendrier avec un décalage d'au plus " + (t.intervalleMin || "quelques") + " minute(s) : « Composer les numéros échus » force la passe." })));
}

function lienCopiable(label, url) {
  const a = h("a", { class: "fr-link", href: url, target: "_blank", rel: "noopener", text: url });
  return h("span", { class: "bul-lien" },
    h("span", { class: "fr-muted", text: label + " : " }),
    a,
    button("Copier", { variant: "tertiary", size: "sm", onClick: async () => { await copyText(url); toast("Adresse copiée.", "success"); } }));
}

// ------------------------------------------------------- l'aperçu de la période
function apercuBloc(b, gerer, u) {
  const box = h("div", { class: "fr-card bul-apercu" });
  box.appendChild(h("div", { class: "bul-apercu__tete" },
    h("h2", { class: "fr-card__title", text: b.titre }),
    badge("Provisoire — non adressé", "warning")));
  box.appendChild(h("p", { class: "fr-card__sub", text: "Ce numéro couvre la période EN COURS : il ne part pas par courriel, et n'a pas d'adresse publique. À la clôture de la période, il devient définitif et s'adresse aux abonnés." }));
  box.appendChild(corpsBulletin(b));
  if (gerer) box.appendChild(h("div", { class: "bul-apercu__actions" },
    button("Rafraîchir l'aperçu", { variant: "secondary", size: "sm", icon: "refresh", onClick: () => agir(u, () => bs.generer({ enCours: true }), "Aperçu rafraîchi.") })));
  return box;
}

// -------------------------------------------------------------- les numéros
function numerosBloc(t, gerer, u) {
  const liste = (t.bulletinsListe || []).filter((b) => !b.provisoire);
  const box = h("div", { class: "fr-card" });
  box.appendChild(h("h2", { class: "fr-card__title", text: "Numéros parus" }));
  box.appendChild(h("p", { class: "fr-card__sub", text: "Chaque numéro a son adresse sur le recueil public, ses formats (JSON, Markdown, texte) et son compte d'envois. Un numéro déjà adressé peut l'être de nouveau — les abonnés confirmés le recevront une seconde fois." }));
  if (!liste.length) {
    box.appendChild(emptyState(t.actif
      ? "Aucun numéro n'est encore paru. Le premier paraîtra à la clôture de la période en cours, s'il y a des actes publiés."
      : "Le bulletin est éteint : aucun numéro ne se compose. Son réglage est dans Administration › Publication."));
    return box;
  }
  const table = h("table", { class: "fr-table fr-small bul-table" },
    h("thead", {}, h("tr", {},
      h("th", { text: "Numéro" }), h("th", { text: "Période" }), h("th", { text: "Actes" }),
      h("th", { text: "Envoi" }), h("th", { text: "Formats" }), h("th", { text: "" }))));
  const corps = h("tbody", {});
  for (const b of liste) {
    const envoi = b.envoi;
    const etatEnvoi = !envoi ? "non adressé"
      : envoi.termineLe ? `${envoi.fait}/${envoi.total} adressé(s)${envoi.echecs ? ", " + envoi.echecs + " échec(s)" : ""}`
      : `${envoi.fait}/${envoi.total} en cours`;
    corps.appendChild(h("tr", {},
      h("td", {}, h("a", { class: "fr-link", href: adresseBulletin(b.id), target: "_blank", rel: "noopener", text: b.titre })),
      h("td", { text: (b.debut ? formatDate(b.debut) : "") + " → " + (b.fin ? formatDate(b.fin) : "") }),
      h("td", { text: String(b.nombre) }),
      h("td", { text: etatEnvoi }),
      h("td", {},
        ["json", "md", "txt"].map((x, i) => h("span", {}, i ? " " : "",
          h("a", { class: "fr-link fr-small", href: adresseBulletinFichier(b.id, x), target: "_blank", rel: "noopener", text: "." + x })))),
      h("td", { class: "bul-table__actions" },
        button("Voir", { variant: "tertiary", size: "sm", onClick: () => window.open(adresseBulletin(b.id), "_blank", "noopener") }),
        gerer ? button("Adresser aux abonnés", {
          variant: "secondary", size: "sm",
          onClick: () => agir(u, () => bs.envoyer(b.id), "Bulletin mis en file : les abonnés le reçoivent."),
        }) : null)));
  }
  table.appendChild(corps);
  box.appendChild(h("div", { class: "fr-table-wrap" }, table));
  return box;
}

// --------------------------------------------------------------- les abonnés
function abonnesBloc(t, admin, u) {
  const liste = t.abonnesListe || [];
  const box = h("div", { class: "fr-card" });
  box.appendChild(h("h2", { class: "fr-card__title", text: "Abonnés" }));
  box.appendChild(h("p", { class: "fr-card__sub", text: "Les personnes qui reçoivent le bulletin par courriel. L'inscription est à DOUBLE CONSENTEMENT : une demande reste « en attente » jusqu'à ce que la personne ouvre le lien de confirmation reçu par courriel. Un désabonnement retire aussi les courriels encore en file." }));
  if (!liste.length) {
    box.appendChild(emptyState("Aucun abonné pour l'instant. Les lecteurs s'inscrivent depuis la page publique du bulletin" + (t.actif ? "" : " — qui n'est ouverte que si le bulletin l'est") + "."));
    return box;
  }
  const table = h("table", { class: "fr-table fr-small bul-table" },
    h("thead", {}, h("tr", {},
      h("th", { text: "Adresse" }), h("th", { text: "Nom" }), h("th", { text: "État" }),
      h("th", { text: "Inscrit le" }), h("th", { text: "Confirmé le" }), h("th", { text: "" }))));
  const corps = h("tbody", {});
  for (const a of liste) {
    corps.appendChild(h("tr", {},
      h("td", { class: "fr-mono fr-small", text: a.courriel }),
      h("td", { text: a.nom || "—" }),
      h("td", {}, badge(etatAbonneLabel(a.etat), etatAbonneBadge(a.etat))),
      h("td", { text: a.creeLe ? formatDate(a.creeLe, "date-court") : "" }),
      h("td", { text: a.confirmeLe ? formatDate(a.confirmeLe, "date-court") : (a.desaboLe ? "désabonné le " + formatDate(a.desaboLe, "date-court") : "—") }),
      h("td", { class: "bul-table__actions" },
        a.lienDesabonnement ? button("Copier le lien de désabonnement", {
          variant: "tertiary", size: "sm",
          onClick: async () => { await copyText(a.lienDesabonnement); toast("Lien copié.", "success"); },
        }) : null,
        admin && a.etat !== "retire" ? button("Retirer", {
          variant: "secondary", size: "sm", danger: true,
          onClick: async () => {
            const ok = await confirmDialog("Retirer cet abonné ?", a.courriel + " ne recevra plus le bulletin par courriel. La personne pourra se réabonner d'elle-même depuis la page publique.", { confirmLabel: "Retirer", danger: true });
            if (ok) agir(u, () => bs.retirerAbonne(a.id), "Abonné retiré.");
          },
        }) : null)));
  }
  table.appendChild(corps);
  box.appendChild(h("div", { class: "fr-table-wrap" }, table));
  return box;
}

// ---------------------------------------------------------------- les envois
function envoisBloc(t) {
  const box = h("div", { class: "fr-card" });
  box.appendChild(h("h2", { class: "fr-card__title", text: "Envois et serveur de courriel" }));
  const c = t.courriel;
  box.appendChild(h("p", { class: "fr-card__sub", text: c && c.disponible
    ? `Le service expédie par ${c.hote}:${c.port} (${c.securise}), au nom de ${c.expediteur}.`
    : "Le service n'a pas de serveur SMTP configuré : l'abonnement par courriel n'est pas ouvert, et les demandes restent en attente. Renseignez SMTP_HOST dans le .env du service (voir Documentation technique › Installation)." }));
  const passes = t.envois || [];
  if (!passes.length) {
    box.appendChild(emptyState("Aucune passe d'envoi n'a encore eu lieu."));
    return box;
  }
  const table = h("table", { class: "fr-table fr-small bul-table" },
    h("thead", {}, h("tr", {},
      h("th", { text: "Le" }), h("th", { text: "Numéro" }), h("th", { text: "Tentées" }),
      h("th", { text: "Parties" }), h("th", { text: "Échecs" }))));
  const corps = h("tbody", {});
  for (const p of passes) {
    corps.appendChild(h("tr", {},
      h("td", { text: p.le ? formatDate(p.le, "date-court") : "" }),
      h("td", { text: p.bulletin || "—" }),
      h("td", { text: String(p.total || 0) }),
      h("td", { text: String(p.ok || 0) }),
      h("td", { text: String(p.echecs || 0) })));
  }
  table.appendChild(corps);
  box.appendChild(h("div", { class: "fr-table-wrap" }, table));
  return box;
}

// ------------------------------------------------------- le corps d'un bulletin
// L'aperçu montre EXACTEMENT la structure que la page publique et le courriel
// rendent : les entités, leurs thématiques, leurs actes. Une seule description du
// contenu, trois habits (voir `texteBulletin`, `markdownBulletin` et
// `htmlDeBulletin` dans src/server/mysql/bulletins.mjs).
function corpsBulletin(b) {
  const box = h("div", { class: "bul-corps" });
  const entites = b.entites || [];
  if (!entites.length) {
    box.appendChild(h("p", { class: "fr-muted", text: b.nombre ? "Ce numéro ne rend pas le détail de ses entités." : "Aucun acte n'est publié sur cette période." }));
    return box;
  }
  for (const e of entites) {
    const bloc = h("section", { class: "bul-ent" }, h("h3", { class: "bul-ent__nom", text: e.nom }));
    for (const t of e.themes || []) {
      bloc.appendChild(h("h4", { class: "bul-ent__theme", text: t.label + (t.nombre ? " (" + t.nombre + ")" : "") }));
      const ul = h("ul", { class: "bul-ent__actes" });
      for (const a of t.actes || []) {
        ul.appendChild(h("li", {},
          h("a", { class: "fr-link", href: "#/recueil/" + encodeURIComponent(a.cle), text: [a.numero, a.objet].filter(Boolean).join(" — ") || a.cle }),
          h("span", { class: "fr-small fr-muted", text: " " + [a.datePublication ? "publié le " + formatDate(a.datePublication) : "", a.remplacee ? "version consolidée" : ""].filter(Boolean).join(" · ") })));
      }
      bloc.appendChild(ul);
    }
    box.appendChild(bloc);
  }
  return box;
}

// -------------------------------------------------------------------- les gestes
async function agir(u, action, succes) {
  if (u.action) return;
  u.action = "…";
  redrawView();
  try {
    // Les réglages du bulletin d'abord : un geste porte sur l'état que
    // l'administration vient de régler, non sur celui d'hier (voir
    // src/ui/demo-publications.js, `amorcerBulletin`).
    await amorcerBulletin({ silencieux: true });
    await action();
    // Le geste a changé l'état du service : la page publique en garde une copie
    // (numéros parus, bulletins ouverts) qui vient d'être périmée.
    oublierBulletinsRecueil();
    toast(succes || "C'est fait.", "success");
  } catch (e) {
    toast(String((e && e.message) || e), "error");
  } finally {
    u.action = "";
    u.charge = false;
    redrawView();
  }
}
