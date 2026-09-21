// ============================================================================
// Courriel — les notifications par courriel.
//
// Deux choses bien distinctes, réunies ici :
//
//  1. La POLITIQUE de notification : quels événements donnent lieu à un
//     courriel, avec quel expéditeur, et à qui. Elle est une DONNÉE du
//     référentiel (`config.courriel`) : l'administrateur la règle, elle suit
//     l'export, et rien n'est codé en dur.
//
//  2. L'ENVOI : c'est le SERVICE qui l'exécute (voir src/server/mysql/
//     courriel.mjs). L'application n'a JAMAIS accès au serveur SMTP ni à son
//     mot de passe : elle demande au service d'envoyer, et le service parle au
//     serveur SMTP de la collectivité. C'est le seul endroit de l'application
//     où un courriel peut réellement partir.
//
// Rien ici ne lève jamais : un courriel qui ne part pas est TRACÉ (au journal,
// et dans le dossier interne de l'acte concerné), jamais subi par l'agent. Quand
// le service n'est pas configuré — dans l'aperçu, ou en édition statique — le
// courriel est simplement constaté « non envoyé », avec son motif.
//
// Ce module ne connaît pas l'état de l'application : ce qui vient d'elle (les
// actes, les comptes, la marque) lui est passé en argument.
// ============================================================================

import { get, post, errorMessage } from "./remote.js";
import { journaliser } from "./collab.js";

// --------------------------------------------------------- le catalogue
// Chaque événement dit ce qu'il annonce, qui le reçoit par défaut, et s'il est
// allumé à l'installation. Les identifiants sont stables : ils sont écrits dans
// le référentiel, et repris dans le dossier interne des actes signés.
export const EVENEMENTS = [
  {
    id: "demande_signature",
    label: "Acte à signer",
    destinataires: "le signataire désigné",
    defaut: true,
    sujet: (ctx) => `[À signer] ${ctx.reference}`,
  },
  {
    id: "signature_donnee",
    label: "Acte signé",
    destinataires: "le rédacteur et les éditeurs",
    defaut: true,
    sujet: (ctx) => `[Signé] ${ctx.reference}`,
  },
  {
    id: "acte_publie",
    label: "Acte publié",
    destinataires: "le rédacteur et les éditeurs",
    defaut: true,
    sujet: (ctx) => `[Publié] ${ctx.reference}`,
  },
  {
    id: "acte_a_valider",
    label: "Acte à valider (parapheur)",
    destinataires: "l'agent dont c'est l'étape",
    defaut: true,
    sujet: (ctx) => `[À valider] ${ctx.reference}`,
  },
  {
    id: "acte_a_reviser",
    label: "Acte à réviser",
    destinataires: "les réviseurs compétents",
    defaut: true,
    sujet: (ctx) => `[À réviser] ${ctx.reference}`,
  },
  {
    id: "notification_interesse",
    label: "Notification à l'intéressé",
    destinataires: "les destinataires désignés",
    // Un acte individuel DOIT être notifié à l'intéressé : le courriel est le
    // moyen ordinaire. L'agent qui l'envoie le demande explicitement ; ce
    // réglage est la politique générale, pas la décision.
    defaut: true,
    sujet: (ctx) => `Notification — ${ctx.reference}`,
  },
];

export const evenementDe = (id) => EVENEMENTS.find((e) => e.id === id) || null;

// --------------------------------------------------------- les réglages
export const COURRIEL_DEFAUT = {
  actif: true,
  expediteurNom: "",
  repondreA: "",
  copieService: "",
  evenements: Object.fromEntries(EVENEMENTS.map((e) => [e.id, e.defaut])),
};

export function courrielSettings(config) {
  const c = (config && config.courriel) || {};
  const evenements = { ...COURRIEL_DEFAUT.evenements, ...(c.evenements || {}) };
  return {
    ...COURRIEL_DEFAUT,
    ...c,
    actif: c.actif !== false,
    evenements,
  };
}

export const evenementActif = (config, id) => courrielSettings(config).evenements[id] === true;

// ------------------------------------------------- état du service d'envoi
// L'état du service de courriel : joignable, configuré, quel hôte, quel
// expéditeur. Il ne porte AUCUN secret — le mot de passe SMTP ne quitte jamais
// le serveur. Mis en cache quelques secondes : l'écran d'administration le
// relit sans harceler le service.
let cacheEtat = null;
let cacheAt = 0;
const ETAT_TTL = 15000;

export function etatCache() { return cacheEtat; }

export async function etatService({ force = false } = {}) {
  const maintenant = Date.now();
  if (!force && cacheEtat && maintenant - cacheAt < ETAT_TTL) return cacheEtat;
  try {
    const res = await get("/v1/courriel", { label: "État du service de courriel", source: "lecture" });
    cacheEtat = res.ok
      ? { ...res.body, joignable: true }
      : { joignable: true, disponible: false, raison: errorMessage(res) };
  } catch (e) {
    cacheEtat = { joignable: false, disponible: false, raison: String((e && e.message) || e) };
  }
  cacheAt = maintenant;
  return cacheEtat;
}

export const servicePret = () => !!(cacheEtat && cacheEtat.disponible);

// ------------------------------------------------- résolution des destinataires
// Un destinataire est toujours { nom, courriel }. On ne garde que les adresses
// plausibles, et on déduplique par adresse : personne ne reçoit deux fois le
// même courriel.
const COURRIEL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function destinataireDeCompte(user) {
  if (!user || user.active === false) return null;
  const courriel = String(user.email || "").trim();
  if (!COURRIEL_VALIDE.test(courriel)) return null;
  return { nom: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.login || "", courriel, compteId: user.id };
}

// Les comptes qui portent un rôle, avec une adresse utilisable.
export const destinatairesRole = (users, roleId) =>
  (users || []).filter((u) => u?.active !== false && ((u.roles || [u.role]) || []).includes(roleId)).map(destinataireDeCompte).filter(Boolean);

export function destinatairesUniques(liste) {
  const vus = new Set();
  const out = [];
  for (const d of liste || []) {
    const courriel = String((d && d.courriel) || "").trim();
    if (!COURRIEL_VALIDE.test(courriel)) continue;
    const cle = courriel.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({ nom: String((d && d.nom) || "").trim(), courriel });
  }
  return out;
}

// ------------------------------------------------------------ les messages
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const dateFr = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
};

// Le contexte d'un acte, tel qu'il entre dans un message : sa référence, son
// objet, son entité, son adresse publique quand il est publié.
function contexte({ acte, doc, brand, lien, complement } = {}) {
  const reference = (acte && (acte.numero || acte.objet || acte.id)) || (doc && doc.meta?.numero) || "un acte";
  return {
    reference,
    numero: (acte && acte.numero) || doc?.meta?.numero || "",
    objet: (acte && acte.objet) || doc?.meta?.objet || "",
    entite: doc?.meta?.entity?.name || brand || "",
    brand: brand || "",
    lien: lien || "",
    complement: complement || "",
  };
}

// Le corps d'un message : un texte simple (les pieds de page des clients de
// messagerie le préfèrent), et une version HTML sobre pour ceux qui l'affichent.
function corpsPour(evenement, ctx) {
  const entete = ctx.brand ? ctx.brand + " — " + ctx.reference : ctx.reference;
  const lignes = [entete];
  if (ctx.objet) lignes.push("Objet : " + ctx.objet);
  if (ctx.entite) lignes.push("Entité : " + ctx.entite);
  if (ctx.complement) lignes.push("", ctx.complement);
  if (ctx.lien) lignes.push("", "Lien : " + ctx.lien);
  lignes.push("", "Ce message est envoyé automatiquement par Scribae. Merci de ne pas y répondre" + (ctx.repondreA ? " — écrivez à " + ctx.repondreA : "") + ".");
  const texte = lignes.join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#161616;line-height:1.5">
<p style="font-weight:600;margin:0 0 6px">${esc(entete)}</p>
${ctx.objet ? `<p style="margin:0 0 4px">Objet : ${esc(ctx.objet)}</p>` : ""}
${ctx.entite ? `<p style="margin:0 0 4px">Entité : ${esc(ctx.entite)}</p>` : ""}
${ctx.complement ? `<p style="margin:10px 0">${esc(ctx.complement)}</p>` : ""}
${ctx.lien ? `<p style="margin:10px 0"><a href="${esc(ctx.lien)}">Consulter l'acte</a></p>` : ""}
<p style="margin:14px 0 0;font-size:12px;color:#555">Ce message est envoyé automatiquement par Scribae. Merci de ne pas y répondre${ctx.repondreA ? " — écrivez à " + esc(ctx.repondreA) : ""}.</p>
</div>`;
  return { texte, html };
}

// ------------------------------------------------------------- l'envoi
// `envoyerNotification(evenement, ctx)` est le point d'entrée unique. Il rend
// toujours une trace : { evenement, destinataires, envoye, motif, at }. Les
// traces d'un acte sont conservées sur l'acte (`acte.courriels`) et dans son
// dossier interne — c'est la piste, et c'est aussi ce qui empêche un doublon.
export async function envoyerNotification(evenement, {
  config, users, acte, doc, brand, destinataires, copie, sujet, complement, lien, texte, html, contexteDossier = true, marquerActe = true,
} = {}) {
  const at = new Date().toISOString();
  const reglages = courrielSettings(config);
  const ev = evenementDe(evenement);
  const trace = { evenement, at, destinataires: [], envoye: false, motif: "" };
  const ctx = contexte({ acte, doc, brand, lien, complement });
  ctx.repondreA = reglages.repondreA;
  const destinatairesResolus = destinatairesUniques(destinataires || []);

  // Abandon : le motif est consigné au journal, ET sur l'acte — c'est la trace
  // que lit son dossier interne. Un courriel qui ne part pas se voit, il ne
  // disparaît pas silencieusement ; et comme la trace est marquée « non
  // envoyée », elle ne bloque pas une nouvelle tentative (voir l'anti-doublon
  // plus bas, qui ne compte que les envois réussis).
  const abandon = async (motif) => {
    trace.motif = motif;
    if (acte && marquerActe) {
      for (const d of destinatairesResolus) {
        acte.courriels = [...(acte.courriels || []), { evenement, destinataire: d.courriel, at, envoye: false, motif }];
      }
    }
    await journaliser({
      action: "courriel.non_envoye", cible: acte ? "acte" : "courriel", cibleLabel: ctx.reference, acteId: (acte && acte.id) || "",
      detail: "courriel NON envoyé (" + evenement + ") : " + motif, to: [],
    });
    return trace;
  };

  if (!ev) return abandon("Événement de notification inconnu : " + evenement);
  if (!reglages.actif) return abandon("Les notifications par courriel sont éteintes (Administration › Courriel).");
  if (reglages.evenements[evenement] !== true) return abandon("Cet événement n'est pas notifié par courriel (Administration › Courriel).");

  trace.destinataires = destinatairesResolus.map((d) => d.courriel);
  if (!destinatairesResolus.length) return abandon("Aucun destinataire avec une adresse utilisable.");
  // Anti-doublon : ce qui est déjà parti pour cet acte et cet événement ne repart
  // pas (une relance de la même action ne double pas les courriels).
  const deja = new Set((acte?.courriels || []).filter((c) => c.evenement === evenement && c.envoye).map((c) => String(c.destinataire || "").toLowerCase()));
  const aEnvoyer = destinatairesResolus.filter((d) => !deja.has(d.courriel.toLowerCase()));
  if (!aEnvoyer.length) { trace.envoye = true; trace.motif = "Déjà notifié (aucun nouvel envoi)."; return trace; }

  const message = (texte || html) ? { sujet: sujet || "", texte: texte || "", html: html || "" } : { sujet: (sujet || (ev.sujet ? ev.sujet(ctx) : ctx.reference)), ...corpsPour(evenement, ctx) };

  const etat = await etatService();
  if (!etat.disponible) return abandon(etat.raison || "Le service de courriel n'est pas configuré sur ce déploiement.");

  try {
    const res = await post("/v1/courriel/envoi", {
      evenement,
      acteId: acte?.id || "",
      cible: ctx.reference,
      destinataires: aEnvoyer,
      // La copie : celle demandée, plus la copie systématique du référentiel
      // (la boîte du service, par exemple).
      copie: destinatairesUniques([
        ...(copie || []),
        ...(reglages.copieService ? [{ nom: "", courriel: reglages.copieService }] : []),
      ]).map((d) => d.courriel),
      sujet: message.sujet,
      texte: message.texte,
      html: message.html,
      expediteurNom: reglages.expediteurNom || "",
      repondreA: reglages.repondreA || "",
    }, { label: "Envoi d'un courriel — " + (message.sujet || evenement) });

    if (res.ok && res.body && res.body.envoye !== false) {
      trace.envoye = true;
      trace.destinataires = (res.body.destinataires || aEnvoyer.map((d) => d.courriel));
      trace.id = res.body.id || "";
    } else {
      trace.motif = errorMessage(res);
    }
  } catch (e) {
    trace.motif = String((e && e.message) || e);
  }

  if (acte && marquerActe) for (const d of aEnvoyer) acte.courriels = [...(acte.courriels || []), { evenement, destinataire: d.courriel, at, envoye: trace.envoye, motif: trace.motif }];

  if (!trace.envoye && !trace.motif) trace.motif = "Envoi impossible.";
  await journaliser({
    action: trace.envoye ? "courriel.envoye" : "courriel.non_envoye",
    cible: evenement === "notification_interesse" ? "notification" : "acte",
    cibleLabel: ctx.reference,
    acteId: (acte && acte.id) || "",
    detail: (trace.envoye ? "courriel envoyé : " : "courriel NON envoyé : ")
      + message.sujet + " → " + aEnvoyer.map((d) => d.courriel).join(", ")
      + (trace.envoye ? "" : " (" + trace.motif + ")"),
    to: [],
  });
  return trace;
}

// ------------------------------------------------------------ courriel de test
// Depuis l'écran d'administration : vérifier que le serveur SMTP répond. Le
// message part sans passer par la politique de notification — c'est un essai,
// pas un événement.
export async function envoyerTest(config, courriel) {
  const reglages = courrielSettings(config);
  const etat = await etatService({ force: true });
  if (!etat.disponible) return { envoye: false, motif: etat.raison || "Le service de courriel n'est pas configuré." };
  try {
    const res = await post("/v1/courriel/test", {
      destinataires: destinatairesUniques([{ nom: "", courriel }]),
      expediteurNom: reglages.expediteurNom || "",
      repondreA: reglages.repondreA || "",
    }, { label: "Courriel de test" });
    if (!res.ok) return { envoye: false, motif: errorMessage(res) };
    return { envoye: res.body.envoye !== false, motif: res.body.envoye === false ? (res.body.raison || "Refusé par le service.") : "", detail: res.body.detail || "" };
  } catch (e) {
    return { envoye: false, motif: String((e && e.message) || e) };
  }
}

// -------------------------------------------------- le dossier interne d'un acte
// Ce que la signature simple inscrit dans l'original interne : l'identité
// nominative du signataire, son compte, la façon dont il s'est authentifié, et
// les courriels qui lui ont été adressés. C'est ce dossier qui n'est pas
// diffusé au public.
export function dossierSignatureInterne({ signataire, courriels, ip, poste, operateur } = {}) {
  return {
    signataire: {
      nom: signataire?.nom || "",
      fonction: signataire?.fonction || "",
      courriel: signataire?.courriel || "",
      personId: signataire?.personId || "",
      compteId: signataire?.compteId || "",
      compte: signataire?.compteOutil || signataire?.compteId || "",
      entite: signataire?.entite || "",
    },
    // L'OPÉRATEUR est distinct du signataire : c'est le compte connecté qui a
    // accompli le geste. Il coïncide avec le signataire quand celui-ci signe en
    // son nom ; il en diffère quand il signe au titre d'une délégation. La
    // distinction est ce qui permet de répondre à « qui a signé ? » ET à « qui
    // tenait le clavier ? » (voir src/lib/signataires.js, contrôle de
    // compétence avant signature).
    operateur: {
      id: operateur?.id || "",
      nom: operateur?.nom || "",
      courriel: operateur?.courriel || "",
      compte: operateur?.compte || "",
    },
    authentification: "Compte de l'application — session ouverte (Scribae)",
    poste: poste || "",
    adresseIp: ip || "",
    courriels: (courriels || []).map((c) => ({ evenement: c.evenement, destinataire: c.destinataire, at: c.at, envoye: c.envoye, motif: c.motif || "" })),
  };
}

// Les traces de courriel d'un acte, mises en forme pour l'affichage.
export function tracesCourriel(acte) {
  return (acte?.courriels || []).slice().sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}
