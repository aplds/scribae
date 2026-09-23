// ============================================================================
// Courriel — la part réseau : la socket, la configuration, et rien d'autre.
//
// Le protocole SMTP vit dans smtp.mjs (pur, vérifiable). Ici, on lui donne un
// VRAI transport : une socket TCP, ou TLS. C'est aussi le seul endroit où la
// configuration du serveur SMTP est lue — et le mot de passe n'en sort jamais :
// ni l'application, ni le navigateur, ni les réponses de l'API ne le voient.
//
// Toute la configuration vient du `.env` du déploiement (voir env.example) :
//
//   SMTP_HOST           le serveur SMTP de la collectivité
//   SMTP_PORT           son port (587 par défaut — soumission avec STARTTLS)
//   SMTP_SECURE         auto | starttls | ssl | aucune
//   SMTP_USER / SMTP_PASS   les identifiants du compte d'envoi (facultatif si le
//                       relais accepte le serveur lui-même)
//   SMTP_FROM           l'adresse d'expédition (ex. ne-pas-repondre@commune.fr)
//   SMTP_FROM_NAME      le nom affiché de l'expéditeur
//   SMTP_REPLY_TO       l'adresse de réponse (facultatif)
//   SMTP_NOTIF_ACTIVE   false pour éteindre les notifications sans rien effacer
//   SMTP_TLS_INSECURE   true pour accepter un certificat non vérifiable
//                       (essai seulement — jamais en service)
//
// Sans SMTP_HOST, le service l'annonce et refuse d'envoyer : une notification
// « non envoyée » est TRACÉE, jamais silencieuse.
// ============================================================================

import net from "node:net";
import tls from "node:tls";
import { analyseurReponse, clientSMTP, ErreurSMTP } from "./smtp.mjs";

const env = (k, d = "") => (process.env[k] === undefined ? d : String(process.env[k]));
const num = (k, d) => (process.env[k] === undefined ? d : Number(process.env[k]) || d);
const bool = (k, d = false) => (process.env[k] === undefined ? d : String(process.env[k]).trim().toLowerCase() === "true");

export const SMTP = {
  hote: env("SMTP_HOST", "").trim(),
  port: num("SMTP_PORT", 587),
  securise: env("SMTP_SECURE", "auto").trim().toLowerCase(),
  utilisateur: env("SMTP_USER", "").trim(),
  motDePasse: env("SMTP_PASS", ""),
  expediteur: env("SMTP_FROM", "").trim(),
  expediteurNom: env("SMTP_FROM_NAME", "").trim(),
  repondreA: env("SMTP_REPLY_TO", "").trim(),
  timeoutMs: num("SMTP_TIMEOUT_MS", 20000),
  notifActive: env("SMTP_NOTIF_ACTIVE", "true").trim().toLowerCase() !== "false",
  tlsInsecure: bool("SMTP_TLS_INSECURE", false),
};

// Le mode de chiffrement retenu : « ssl » (TLS dès la connexion — port 465),
// « starttls » (on monte le chiffrement après EHLO), ou « aucune » (relais local
// qui ne chiffre pas). « auto » devine d'après le port.
export function modeTls() {
  const s = SMTP.securise;
  if (["ssl", "tls", "implicite", "implicit", "smtps"].includes(s)) return "ssl";
  if (["starttls", "oui"].includes(s)) return "starttls";
  if (["aucune", "none", "clair", "false", "non"].includes(s)) return "aucune";
  return SMTP.port === 465 ? "ssl" : "starttls";
}

// L'état du service — AUCUN secret. C'est ce que l'écran d'administration
// affiche, et ce que l'application interroge avant de proposer un envoi.
export function etat() {
  const mode = modeTls();
  const configure = !!(SMTP.hote && SMTP.expediteur);
  const raison = !SMTP.hote
    ? "Aucun serveur SMTP n'est configuré sur ce déploiement (SMTP_HOST absent du .env)."
    : !SMTP.expediteur
      ? "Aucune adresse d'expédition n'est configurée (SMTP_FROM)."
      : !SMTP.notifActive
        ? "L'envoi des notifications est éteint (SMTP_NOTIF_ACTIVE=false)."
        : "";
  return {
    disponible: configure && SMTP.notifActive,
    configure,
    actif: SMTP.notifActive,
    hote: SMTP.hote,
    port: SMTP.port,
    securise: mode,
    authentifie: !!SMTP.utilisateur,
    expediteur: SMTP.expediteur,
    expediteurNom: SMTP.expediteurNom,
    repondreA: SMTP.repondreA,
    raison,
  };
}

// ------------------------------------------------------------- le transport
// Une socket, enveloppée pour parler le langage attendu par smtp.mjs : écrire
// une ligne, lire une réponse (parfois sur plusieurs lignes), monter le
// chiffrement, fermer. `chiffre` dit si la session est déjà protégée.
function transport(socket, chiffre) {
  const analyseur = analyseurReponse();
  const enAttente = [];
  const pretes = [];
  let erreur = null;

  const livrer = () => {
    let rep;
    while ((rep = analyseur.suivant())) {
      const attente = enAttente.shift();
      if (attente) attente.resolve(rep);
      else pretes.push(rep);
    }
  };
  const echouer = (e) => {
    erreur = e;
    while (enAttente.length) enAttente.shift().reject(e);
  };

  socket.setEncoding?.("utf8");
  socket.on("data", (morceau) => { analyseur.pousser(morceau); livrer(); });
  socket.on("error", echouer);
  socket.on("close", () => { if (!erreur) echouer(new Error("Le serveur a fermé la connexion.")); });
  socket.on("timeout", () => { try { socket.destroy(); } catch (e) { /* déjà détruit */ } echouer(new Error("Le serveur SMTP n'a pas répondu dans le délai imparti.")); });
  socket.setTimeout?.(SMTP.timeoutMs);

  return {
    chiffre,
    ecrire: (texte) => { socket.write(texte); },
    lireReponse: () => {
      if (pretes.length) return Promise.resolve(pretes.shift());
      if (erreur) return Promise.reject(erreur);
      return new Promise((resolve, reject) => enAttente.push({ resolve, reject }));
    },
    demarrerTls: (servername) => new Promise((resolve, reject) => {
      const securisee = tls.connect({ socket, servername, rejectUnauthorized: !SMTP.tlsInsecure });
      securisee.once("secureConnect", () => resolve(transport(securisee, true)));
      securisee.once("error", reject);
    }),
    fermer: () => new Promise((resolve) => {
      try { socket.end(); } catch (e) { /* déjà fermé */ }
      setTimeout(resolve, 40);
    }),
  };
}

function connecter() {
  return new Promise((resolve, reject) => {
    const mode = modeTls();
    let socket;
    if (mode === "ssl") socket = tls.connect({ host: SMTP.hote, port: SMTP.port, servername: SMTP.hote, rejectUnauthorized: !SMTP.tlsInsecure });
    else socket = net.connect({ host: SMTP.hote, port: SMTP.port });
    const surErreur = (e) => { try { socket.destroy(); } catch (x) { /* rien */ } reject(new Error("Connexion au serveur SMTP " + SMTP.hote + ":" + SMTP.port + " impossible — " + e.message)); };
    socket.once("error", surErreur);
    const pret = () => { socket.removeListener("error", surErreur); resolve(transport(socket, mode === "ssl")); };
    if (mode === "ssl") socket.once("secureConnect", pret);
    else socket.once("connect", pret);
  });
}

function delai(promesse, ms, message) {
  let t;
  return Promise.race([
    promesse.finally(() => clearTimeout(t)),
    new Promise((_, reject) => { t = setTimeout(() => reject(new Error(message)), ms); }),
  ]);
}

// -------------------------------------------------------------- l'envoi
// Rend toujours un objet : { envoye, destinataires, detail, raison }. Une erreur
// SMTP est convertie en `raison` lisible — c'est ce que l'agent verra au
// journal, et ce que l'administrateur doit lire pour corriger son .env.
export async function envoyer({ destinataires, copie, sujet, texte, html, expediteurNom, repondreA, entetes } = {}) {
  const st = etat();
  if (!st.disponible) return { envoye: false, raison: st.raison || "Le service de courriel n'est pas configuré." };
  const liste = (destinataires || []).map((d) => ({ nom: (d && d.nom) || "", courriel: String((d && d.courriel) || d || "").trim() })).filter((d) => d.courriel);
  if (!liste.length) return { envoye: false, raison: "Aucun destinataire." };
  const t0 = Date.now();
  try {
    const socket = await delai(connecter(), SMTP.timeoutMs, "Connexion au serveur SMTP trop longue.");
    const trace = [];
    const client = clientSMTP(socket, {
      hote: SMTP.hote, utilisateur: SMTP.utilisateur, motDePasse: SMTP.motDePasse,
      securise: modeTls() === "starttls" ? "starttls" : "aucune",
      nomLocal: env("SMTP_HELO_NAME", SMTP.hote) || "localhost",
      journal: (e) => trace.push(e),
    });
    const r = await delai(client.envoyer({
      de: { nom: expediteurNom || SMTP.expediteurNom, courriel: SMTP.expediteur },
      a: liste,
      cc: (copie || []).map((c) => ({ nom: "", courriel: String((c && c.courriel) || c || "").trim() })).filter((c) => c.courriel),
      repondreA: repondreA || SMTP.repondreA,
      sujet, texte, html, entetes,
      domain: SMTP.expediteur.split("@")[1] || "",
    }), SMTP.timeoutMs, "Le serveur SMTP n'a pas terminé le dialogue dans le délai imparti.");
    return { envoye: true, destinataires: r.destinataires, detail: "Accepté par le serveur (" + r.reponse + ")", trace, ms: Date.now() - t0 };
  } catch (e) {
    return { envoye: false, raison: (e instanceof ErreurSMTP ? e.message : String((e && e.message) || e)), ms: Date.now() - t0 };
  }
}

// Le courriel de test : le même chemin, un message qui ne ressemble à aucun
// événement — il ne se confond pas avec une notification dans le dossier.
export function tester({ destinataires, expediteurNom, repondreA } = {}) {
  const heure = new Date().toLocaleString("fr-FR");
  return envoyer({
    destinataires,
    expediteurNom,
    repondreA,
    sujet: "Test de configuration — Scribae",
    texte: [
      "Ce message vérifie que Scribae sait joindre le serveur SMTP de la collectivité.",
      "",
      "S'il vous parvient, la configuration d'envoi est opérationnelle : les notifications d'actes pourront partir par courriel.",
      "",
      "Envoyé le " + heure + ".",
    ].join("\n"),
    html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#161616">
<p>Ce message vérifie que Scribae sait joindre le serveur SMTP de la collectivité.</p>
<p>S'il vous parvient, la configuration d'envoi est opérationnelle : les notifications d'actes pourront partir par courriel.</p>
<p style="color:#555;font-size:12px">Envoyé le ${heure}.</p></div>`,
  });
}

export { ErreurSMTP };
