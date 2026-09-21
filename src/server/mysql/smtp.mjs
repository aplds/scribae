// ============================================================================
// Client SMTP — le protocole, à l'état pur.
//
// Ce module parle SMTP, et RIEN d'autre : il ne connaît ni `net`, ni `tls`, ni
// la configuration du déploiement. Tout ce qui touche au réseau lui est INJECTÉ
// sous forme d'un « transport » :
//
//   {
//     lireReponse()            → { code, texte, lignes }   la réponse en cours
//     ecrire(ligne)            → void                      une ligne à envoyer
//     demarrerTls(servername)  → transport                 la session chiffrée
//     fermer()                 → void
//   }
//
// C'est ce qui rend le protocole VÉRIFIABLE : on branche un transport qui
// rejoue des réponses écrites d'avance, et on lit le dialogue qui en sort (voir
// `dialogueSMTP`). Le vrai transport — une socket TCP ou TLS — vit dans
// courriel.mjs, avec le reste du code propre à Node.
//
// Le dialogue suit la RFC 5321 : EHLO (avec ses capacités), STARTTLS si le
// serveur l'annonce, AUTH PLAIN ou LOGIN, MAIL FROM / RCPT TO / DATA, puis QUIT.
// Rien n'est inventé : un serveur qui refuse une commande fait échouer l'envoi,
// avec son code et son message — c'est ce que l'administrateur doit lire pour
// corriger sa configuration.
// ============================================================================

const CRLF = "\r\n";

// L'UTF-8 → base64, sans dépendre de `Buffer` : c'est ce qui rend ce module
// exécutable partout (Node, navigateur, banc d'essai), et donc vérifiable.
const base64 = (texte) => {
  const octets = new TextEncoder().encode(String(texte ?? ""));
  let binaire = "";
  for (let i = 0; i < octets.length; i++) binaire += String.fromCharCode(octets[i]);
  return btoa(binaire);
};

// ------------------------------------------------------------ encodage MIME
// Un sujet non-ASCII s'écrit en « encoded-word » (RFC 2047) : les serveurs et
// les clients de messagerie attendent cette forme, pas de l'UTF-8 nu dans
// l'en-tête.
export function encoderMot(texte) {
  const s = String(texte ?? "");
  if (!/[^\x20-\x7e]/.test(s)) return s;
  return "=?UTF-8?B?" + base64(s) + "?=";
}

// Un corps en base64, découpé en lignes de 76 caractères (RFC 2045). On encode
// plutôt que de « plier » les lignes : c'est ce qui garantit qu'un texte long,
// accentué, avec des lignes vides, arrive intact.
export function encoderCorps(texte) {
  return base64(texte).replace(/(.{76})/g, "$1" + CRLF);
}

// L'en-tête `Date` au format RFC 5322 (avec le décalage, pas de secondes
// décimales) et un `Message-ID` qui porte le domaine de l'expéditeur.
export function dateRfc(date = new Date()) {
  const jours = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mois = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = (n) => String(n).padStart(2, "0");
  const d = date;
  const tz = -d.getTimezoneOffset();
  const signe = tz >= 0 ? "+" : "-";
  const tzh = p(Math.floor(Math.abs(tz) / 60));
  const tzm = p(Math.abs(tz) % 60);
  return `${jours[d.getDay()]}, ${p(d.getDate())} ${mois[d.getMonth()]} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${signe}${tzh}${tzm}`;
}

export function messageId(domaine) {
  const d = String(domaine || "scribae.local").replace(/^.*@/, "");
  return "<" + Date.now().toString(36) + "." + Math.random().toString(36).slice(2, 10) + "@" + d + ">";
}

const adresse = (v) => {
  const courriel = String((v && v.courriel) || v || "").trim();
  const nom = String((v && v.nom) || "").trim();
  if (!nom) return courriel;
  return encoderMot(nom) + " <" + courriel + ">";
};

const listeAdresses = (liste) => (liste || []).map(adresse).filter(Boolean);

// Le message complet : en-têtes, puis corps. Un corps HTML ET un corps texte
// voyagent ensemble (multipart/alternative) : les clients qui n'affichent pas le
// HTML lisent le texte, jamais un message vide.
export function construireMessage({
  de, a, cc, repondreA, sujet, texte = "", html = "", domain = "", date = new Date(),
} = {}) {
  const expediteur = adresse(de);
  const destinataires = listeAdresses(a);
  const copies = listeAdresses(cc);
  const entetes = [
    "Date: " + dateRfc(date),
    "From: " + (expediteur || "Scribae <scribae@" + (domain || "localhost") + ">"),
    "To: " + destinataires.join(", "),
    ...(copies.length ? ["Cc: " + copies.join(", ")] : []),
    ...(repondreA ? ["Reply-To: " + adresse(repondreA)] : []),
    "Subject: " + encoderMot(sujet || ""),
    "Message-ID: " + messageId((de && de.courriel) || domain),
    "MIME-Version: 1.0",
    "Auto-Submitted: auto-generated",
  ];
  const corpsTexte = String(texte || "").replace(/\r?\n/g, CRLF);
  if (!html) {
    return entetes.concat([
      'Content-Type: text/plain; charset="utf-8"',
      "Content-Transfer-Encoding: base64",
      "",
      encoderCorps(corpsTexte),
    ]).join(CRLF);
  }
  const frontiere = "scribae-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  return entetes.concat([
    'Content-Type: multipart/alternative; boundary="' + frontiere + '"',
    "",
    "--" + frontiere,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encoderCorps(corpsTexte),
    "--" + frontiere,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encoderCorps(String(html || "").replace(/\r?\n/g, CRLF)),
    "--" + frontiere + "--",
  ]).join(CRLF);
}

// -------------------------------------------------------------- le protocole

// Le « point final » du corps : une ligne qui ne contient qu'un point termine le
// message ; toute ligne du corps qui COMMENCE par un point doit donc être
// doublée, sinon elle serait prise pour la fin (RFC 5321 §4.5.2).
export function doublerPoints(texte) {
  return String(texte ?? "").replace(/\r?\n\./g, CRLF + "..").replace(/^\./, "..");
}

// Un analyseur de réponses : on lui pousse ce que le serveur a dit, il en sort
// les réponses complètes. Une réponse SMTP peut tenir sur plusieurs lignes
// (« 250-… » tant que le 4e caractère est un tiret, « 250 … » sur la dernière).
export function analyseurReponse() {
  let tampon = "";
  // Une réponse est complète dès qu'une de ses lignes ne porte PAS le tiret de
  // continuation (la ligne « 250 … » qui clôt le bloc « 250-… »).
  const extraire = () => {
    const completes = tampon.split(CRLF).slice(0, -1);   // la dernière est un fragment
    if (!completes.length) return null;
    let k = 0;
    while (k < completes.length && /^\d{3}-/.test(completes[k])) k++;
    if (k >= completes.length) return null;              // le bloc multiligne n'est pas fini
    const prises = completes.slice(0, k + 1);
    tampon = tampon.slice((prises.join(CRLF) + CRLF).length);
    const texte = prises.join(" ");
    return { code: Number((texte.match(/^(\d{3})/) || [])[1] || 0), texte, lignes: prises };
  };
  return {
    pousser(morceau) { tampon += morceau; return true; },
    suivant: extraire,
    reste: () => tampon,
  };
}

// Les capacités annoncées par le serveur après EHLO : « STARTTLS », « AUTH
// PLAIN LOGIN », « SIZE 10240000 »…
export function capacitesDe(lignes) {
  const cap = { brut: [], auth: [], starttls: false, size: 0, tls: false };
  for (const l of lignes || []) {
    const m = /^\d{3}[ -](.*)$/.exec(String(l));
    const mot = (m ? m[1] : "").trim();
    if (!mot) continue;
    cap.brut.push(mot);
    const [cle, ...reste] = mot.split(/\s+/);
    const k = cle.toUpperCase();
    if (k === "STARTTLS") cap.starttls = true;
    else if (k === "AUTH") cap.auth = reste.map((x) => x.toUpperCase());
    else if (k === "SIZE") cap.size = Number(reste[0]) || 0;
  }
  return cap;
}

export class ErreurSMTP extends Error {
  constructor(code, message, commande) {
    super(`SMTP ${code || ""} : ${message}`.trim());
    this.name = "ErreurSMTP";
    this.code = code || 0;
    this.commande = commande || "";
  }
}

const b64 = (s) => base64(s);

// Le client : un transport + des réglages, et `envoyer()` qui déroule tout le
// dialogue. `journal` reçoit chaque étape (les secrets sont masqués) : c'est ce
// que montrent l'écran d'administration et le journal du service.
export function clientSMTP(transport, {
  hote = "localhost",
  utilisateur = "",
  motDePasse = "",
  securise = "auto",          // "auto" | "starttls" | "aucune"
  nomLocal = "localhost",
  timeoutMs = 20000,
  journal = () => {},
} = {}) {
  let t = transport;
  let cap = { auth: [], starttls: false, size: 0, tls: false, brut: [] };
  const trace = [];
  const noter = (sens, ligne) => {
    // Le secret ne se journalise JAMAIS : la commande d'authentification
    // (`AUTH PLAIN <jeton>`) est masquée, et les lignes d'identifiants (AUTH
    // LOGIN) ne passent pas par ici — elles ont leur propre repère.
    const brut = String(ligne || "");
    const e = { sens, ligne: /^AUTH\s/i.test(brut) ? "AUTH « identifiants masqués »" : brut };
    trace.push(e);
    journal(e);
  };

  const lire = async (attendu, commande) => {
    const rep = await t.lireReponse();
    noter("<", rep.code + " " + rep.texte);
    if (attendu && !attendu.includes(rep.code)) throw new ErreurSMTP(rep.code, rep.texte, commande);
    return rep;
  };
  const envoyer = async (commande, attendu) => {
    noter(">", commande);
    await t.ecrire(commande + CRLF);
    return lire(attendu, commande);
  };

  const ehlo = async () => {
    let rep;
    try {
      rep = await envoyer("EHLO " + nomLocal, null);
    } catch (e) { rep = null; }
    if (rep && rep.code === 250) {
      cap = capacitesDe(rep.lignes);
      cap.tls = !!t.chiffre;
      return cap;
    }
    // Un serveur ancien ne connaît pas EHLO : on retombe sur HELO, sans
    // capacités — donc sans STARTTLS ni AUTH annoncés.
    const h = await envoyer("HELO " + nomLocal, [250]);
    cap = capacitesDe(h.lignes);
    cap.tls = !!t.chiffre;
    return cap;
  };

  return {
    trace,
    capacites: () => cap,

    async envoyer({ de, a, cc, repondreA, sujet, texte, html, domain }) {
      // 1. Salutation du serveur.
      await lire([220], "");
      // 2. EHLO.
      cap = await ehlo();
      // 3. Chiffrement. En « auto », on monte TLS si le serveur l'annonce ; en
      //    « starttls », on l'EXIGE (un serveur qui ne l'annonce pas fait
      //    échouer l'envoi — mieux vaut un échec visible qu'un mot de passe en
      //    clair) ; en « aucune », on reste en clair (relais local uniquement).
      const veutTls = securise === "starttls" || (securise === "auto" && cap.starttls);
      if (veutTls) {
        if (!cap.starttls && !cap.tls) throw new ErreurSMTP(0, "le serveur n'annonce pas STARTTLS et la configuration l'exige", "STARTTLS");
        if (cap.starttls && !cap.tls) {
          await envoyer("STARTTLS", [220]);
          t = await t.demarrerTls(hote);
          cap = await ehlo();
        }
      }
      // 4. Authentification.
      if (utilisateur) {
        const methodes = cap.auth.length ? cap.auth : ["PLAIN", "LOGIN"];
        if (methodes.includes("PLAIN")) {
          await envoyer("AUTH PLAIN " + b64("\u0000" + utilisateur + "\u0000" + motDePasse), [235]);
        } else if (methodes.includes("LOGIN")) {
          await envoyer("AUTH LOGIN", [334]);
          noter(">", "« identifiant masqué »");
          await t.ecrire(b64(utilisateur) + CRLF);
          await lire([334], "AUTH LOGIN (identifiant)");
          noter(">", "« mot de passe masqué »");
          await t.ecrire(b64(motDePasse) + CRLF);
          await lire([235], "AUTH LOGIN (mot de passe)");
        } else {
          throw new ErreurSMTP(0, "le serveur n'annonce aucune méthode d'authentification connue (" + (cap.auth.join(", ") || "aucune") + ")", "AUTH");
        }
      }
      // 5. L'enveloppe, puis le message.
      const expediteur = String((de && de.courriel) || de || "").trim();
      if (!expediteur) throw new ErreurSMTP(0, "aucune adresse d'expédition n'est configurée (SMTP_FROM)", "MAIL FROM");
      await envoyer("MAIL FROM:<" + expediteur + ">", [250]);
      const destinataires = [...new Set([...(a || []), ...(cc || [])].map((d) => String((d && d.courriel) || d || "").trim()).filter(Boolean))];
      if (!destinataires.length) throw new ErreurSMTP(0, "aucun destinataire", "RCPT TO");
      for (const d of destinataires) await envoyer("RCPT TO:<" + d + ">", [250, 251]);
      await envoyer("DATA", [354]);
      const message = construireMessage({ de, a, cc, repondreA, sujet, texte, html, domain: domain || expediteur.split("@")[1] || "" });
      noter(">", "[message : " + String(sujet || "").length + " caractères d'objet, corps " + message.length + " octets]");
      await t.ecrire(doublerPoints(message) + CRLF + "." + CRLF);
      const fin = await lire([250], "fin du message");
      // 6. Au revoir.
      try { await envoyer("QUIT", [221]); } catch (e) { /* certains serveurs coupent sans répondre */ }
      try { await t.fermer(); } catch (e) { /* déjà fermé */ }
      return { ok: true, destinataires, reponse: fin.texte, trace: trace.slice() };
    },
  };
}
