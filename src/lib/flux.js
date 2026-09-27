// ============================================================================
// LE FLUX — ce qui vient de changer, poussé par le service aux postes.
//
// POURQUOI CE MODULE. Jusqu'ici, un poste ne savait pas qu'un autre venait
// d'écrire : le registre se relisait à l'ouverture d'un écran, et la présence se
// sondait toutes les trente secondes (voir lib/collab.js). Travailler à deux sur
// la même trame supposait donc d'attendre, ou de recharger la page — ce n'est pas
// travailler ensemble.
//
// Le service auto-hébergé expose maintenant un FLUX : une réponse HTTP tenue
// ouverte, qui reçoit chaque changement sous la forme minimale
// `{ type: "collection", collection, revision }` — le NOM de ce qui a changé et
// sa révision, jamais le contenu (le poste relit la collection par le chemin
// autorisé : le flux ne révèle donc rien, et ne peut rien laisser fuiter).
//
// POURQUOI PAS `EventSource`. Un `EventSource` ne porte pas d'en-tête
// `Authorization` : en mode « clé d'API » (AUTH_MODE=demo sur un service
// distant), le flux serait refusé. On lit donc le flux avec `fetch` et un
// lecteur de corps — un vrai client SSE écrit à la main, qui porte les mêmes
// en-têtes que le pilote de données (voir lib/db/service.js) : session du
// service quand il y en a une, clé sinon.
//
// CE MODULE EST LE TRANSPORT, et rien d'autre : il sait ouvrir, lire, découper
// les trames SSE, reprendre après une coupure et dire son état. Le câblage à
// l'application (quelles collections relire, et ce qu'on en fait) vit dans
// ui/flux.js. Le décodeur de trames et le découpeur sont PURS, et donc éprouvés
// hors navigateur comme dans la page (tests/parcours.mjs).
// ============================================================================

// Les états du flux, tels que l'écran les montre.
export const ETATS = {
  inactif: "inactif",       // pas encore démarré
  connexion: "connexion",   // ouverture en cours
  ouvert: "ouvert",         // le service pousse
  absent: "absent",         // ce service ne connaît pas le flux (version antérieure)
  erreur: "erreur",         // refus, panne, ou flux interrompu
  arrete: "arrete",         // arrêté volontairement
};

// Délais de reprise : courts au début (une coupure réseau d'un instant se
// rattrape tout de suite), plafonnés ensuite. Le hasard évite que tous les
// postes d'un même service reviennent au même instant après un redémarrage.
export const DELAI_BASE = 1200;
export const DELAI_MAX = 60000;
// Un service qui ne connaît pas la route ne se réveille pas en boucle : on le
// réinterroge de loin en loin (une montée de version du service ne se voit
// qu'après un rechargement de la page, de toute façon).
export const VEILLE_ABSENT = 600000;

// ---------------------------------------------------------------- découpage SSE
// Un flux SSE est une suite de trames séparées par une ligne VIDE (la
// spécification admet `\n\n`, `\r\n\r\n` et `\r\r`). Le dernier morceau reçu peut
// être incomplet : on le rend tel quel, pour qu'il soit repris au paquet suivant.
export const SEPARATEUR = /\r\n\r\n|\n\n|\r\r/;

export function decouperTrames(tampon) {
  const frames = [];
  let reste = String(tampon == null ? "" : tampon);
  for (;;) {
    const i = reste.search(SEPARATEUR);
    if (i === -1) break;
    const sep = SEPARATEUR.exec(reste.slice(i))[0];
    frames.push(reste.slice(0, i));
    reste = reste.slice(i + sep.length);
  }
  return { frames, reste };
}

// Une trame → les couples `champ: valeur` qu'elle porte. Les lignes de
// commentaire (`: battement`) sont ignorées — c'est ce que le service envoie
// pour maintenir la connexion ouverte sans rien annoncer.
export function analyserTrame(trame) {
  const out = { evenement: "message", donnees: [], reprise: null, id: null };
  for (const ligne of String(trame == null ? "" : trame).split(/\r\n|\n|\r/)) {
    if (!ligne || ligne.startsWith(":")) continue;
    const i = ligne.indexOf(":");
    const champ = i === -1 ? ligne : ligne.slice(0, i);
    let valeur = i === -1 ? "" : ligne.slice(i + 1);
    if (valeur.startsWith(" ")) valeur = valeur.slice(1);
    if (champ === "event") out.evenement = valeur;
    else if (champ === "data") out.donnees.push(valeur);
    else if (champ === "retry") { const n = Number(valeur); if (Number.isFinite(n) && n > 0) out.reprise = n; }
    else if (champ === "id") out.id = valeur;
  }
  return out;
}

// Une trame → l'évènement à traiter (ou `null` pour un commentaire de
// battement, qui ne porte rien).
export function evenementDeTrame(trame) {
  const t = analyserTrame(trame);
  if (!t.donnees.length) return null;
  const texte = t.donnees.join("\n");
  let donnees = texte;
  try { donnees = JSON.parse(texte); } catch (e) { donnees = texte; }   // un flux tolérant : une donnée illisible est rendue telle quelle
  return {
    type: t.evenement === "message" ? (donnees && donnees.type) || "message" : t.evenement,
    donnees,
    id: t.id,
    reprise: t.reprise,
  };
}

// Une suite de trames → les évènements à traiter, et la reprise demandée par le
// service s'il en a demandé une.
export function analyserFlux(tampon) {
  const { frames } = decouperTrames(tampon);
  const evenements = [];
  let reprise = null;
  for (const f of frames) {
    const ev = evenementDeTrame(f);
    if (!ev) continue;
    if (ev.reprise != null) reprise = ev.reprise;
    evenements.push({ type: ev.type, donnees: ev.donnees, id: ev.id });
  }
  return { evenements, reprise };
}

// ------------------------------------------------------------------ le client
// `creerFlux` rend une instance : `demarrer()`, `arreter()`, `etat()`,
// `surEtat(fn)`, `resynchroniser()`. `fetchImpl` est injectable — c'est ce qui
// permet d'éprouver la reprise, le découpage et la livraison sans réseau.
export function creerFlux({
  url,
  entetes = {},
  credentials = "same-origin",
  fetchImpl = null,
  surEvenement = () => {},
  delaiBase = DELAI_BASE,
  delaiMax = DELAI_MAX,
  veilleAbsent = VEILLE_ABSENT,
  journal = (message) => console.warn("[flux] " + message),
} = {}) {
  const lire = fetchImpl || ((u, o) => globalThis.fetch(u, o));
  let etat = ETATS.inactif;
  let detail = "";
  let essais = 0;
  let minuteur = null;
  let controleur = null;
  let vivant = false;
  let enLecture = null;
  const ecouteurs = new Set();

  const changer = (nouvel, pourquoi = "") => {
    if (etat === nouvel && detail === pourquoi) return;
    etat = nouvel;
    detail = pourquoi || "";
    for (const f of ecouteurs) { try { f({ etat, detail }); } catch (e) { journal("écouteur en échec : " + e); } }
  };

  const attendre = (ms) => new Promise((r) => {
    minuteur = setTimeout(() => { minuteur = null; r(); }, ms);
  });

  const delai = (base = delaiBase) => Math.min(delaiMax, base * Math.pow(2, Math.min(essais, 6))) + Math.round(Math.random() * 400);

  // Une lecture complète : ouvre, lit jusqu'à la fermeture, découpe et livre.
  async function lireUneFois() {
    controleur = typeof AbortController === "function" ? new AbortController() : null;
    let res;
    try {
      res = await lire(url, {
        method: "GET",
        headers: { accept: "text/event-stream", ...entetes },
        credentials,
        cache: "no-store",
        signal: controleur ? controleur.signal : undefined,
      });
    } catch (e) {
      if (!vivant) return;
      return { panne: String((e && e.message) || e) };
    }
    if (!vivant) { try { res.body?.cancel?.(); } catch (e) { /* déjà fermé */ } return; }
    if (!res.ok) return { refus: res.status };
    if (!res.body || typeof res.body.getReader !== "function") return { panne: "le service ne sert pas de flux lisible" };

    changer(ETATS.ouvert);
    essais = 0;
    const lecteur = res.body.getReader();
    const decodeur = new TextDecoder();
    let tampon = "";
    for (;;) {
      let morceau;
      try { morceau = await lecteur.read(); }
      catch (e) { return vivant ? { panne: String((e && e.message) || e) } : {}; }
      if (morceau.done) return {};
      tampon += decodeur.decode(morceau.value, { stream: true });
      const { frames, reste } = decouperTrames(tampon);
      tampon = reste;
      // Un flux qui débiterait sans fin sans jamais terminer une trame ferait
      // grossir ce tampon : on le borne (une trame est un petit objet JSON).
      if (tampon.length > 1_000_000) tampon = "";
      for (const f of frames) {
        const ev = evenementDeTrame(f);
        if (ev) livrer({ type: ev.type, donnees: ev.donnees, id: ev.id });
      }
    }
  }

  function livrer(evenement) {
    try { surEvenement(evenement); }
    catch (e) { journal("traitement en échec : " + ((e && e.message) || e)); }
  }

  async function boucle() {
    while (vivant) {
      changer(ETATS.connexion);
      const r = await lireUneFois();
      if (!vivant) return;
      if (r.refus === 401 || r.refus === 403) {
        changer(ETATS.erreur, `refus du service (${r.refus})`);
        essais += 1;
      } else if (r.refus === 404 || r.refus === 405 || r.refus === 501) {
        // Ce service ne connaît pas la route : c'est une version antérieure.
        // Inutile de frapper : l'application retombe sur le sondage, et l'on
        // réessaie de loin en loin.
        changer(ETATS.absent, `le service ne propose pas de flux (${r.refus})`);
        await attendre(veilleAbsent);
        continue;
      } else if (r.refus) {
        changer(ETATS.erreur, `refus du service (${r.refus})`);
        essais += 1;
      } else if (r.panne) {
        changer(ETATS.erreur, r.panne);
        essais += 1;
      } else {
        // Fermeture propre : le service s'est reconstruit, ou un mandataire a
        // coupé une connexion inactive. On revient, sans compter comme un échec.
        changer(ETATS.connexion, "flux interrompu, reprise");
      }
      if (!vivant) return;
      await attendre(delai());
    }
  }

  return {
    demarrer() {
      if (vivant) return false;
      vivant = true;
      essais = 0;
      enLecture = boucle();
      return true;
    },
    arreter() {
      if (!vivant) return false;
      vivant = false;
      if (minuteur) { clearTimeout(minuteur); minuteur = null; }
      try { controleur?.abort(); } catch (e) { /* déjà fermé */ }
      controleur = null;
      enLecture = null;
      changer(ETATS.arrete);
      return true;
    },
    // Reprendre tout de suite, sans attendre le délai de reprise : quand l'onglet
    // redevient visible, ou quand l'agent le demande.
    resynchroniser() {
      if (!vivant) return this.demarrer();
      if (etat === ETATS.ouvert) return false;
      if (minuteur) { clearTimeout(minuteur); minuteur = null; }
      try { controleur?.abort(); } catch (e) { /* déjà fermé */ }
      return true;
    },
    surEtat(fn) { ecouteurs.add(fn); try { fn({ etat, detail }); } catch (e) { journal("écouteur en échec : " + e); } return () => ecouteurs.delete(fn); },
    etat: () => ({ etat, detail }),
    ouvert: () => etat === ETATS.ouvert,
    url,
  };
}
