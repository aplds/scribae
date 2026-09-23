// ============================================================================
// Domaine « signature et publication » — portage du service de la plateforme.
//
// Ce module est le cœur métier de l'API : dépôt des actes, circuits de
// signature, notification du prestataire, publication et résolution ELI. Il est
// **pur** : aucune dépendance à Node, à MySQL ou au réseau. Tout ce qui vient du
// dehors est injecté —
//
//   state    l'état mutable (actes, signatures, publications, bulletins)
//   sha256   une empreinte SHA-256 synchrone (crypto de Node, ou l'implémentation
//            embarquée côté plateforme)
//   now      l'horloge
//   save     la persistance : renvoie false si la capacité est dépassée
//   bulletins  le domaine des Bulletins (voir bulletins.mjs) : les sous-pages
//            par bulletin, les flux RSS/Atom et l'abonnement. Il est INJECTÉ —
//            ce module n'en connaît que l'aperçu (`apercu`) et les lectures
//            publiques, et il s'en passe quand le déploiement n'en a pas.
//
// Il expose `route(req, ctx)` où `req` est `{ method, path, headers, body }` et
// `ctx` fournit l'autorisation (`authorize`) et la limitation de débit (`rate`).
// Le serveur HTTP (`server.mjs`) n'a plus qu'à traduire : c'est ce qui garantit
// que le service auto-hébergé et celui de la plateforme se comportent pareil.
// ============================================================================

import { etatBulletinsVide, intervalleTexte } from "./bulletins.mjs";

const SERVICE = "Service de signature et de publication";
const SERVICE_VERSION = "1.0.0";

export function emptyState() {
  return { v: 1, seq: 0, actes: {}, signatures: {}, publies: {}, idem: {}, cles: {}, journal: [], bulletins: etatBulletinsVide() };
}

// LA FEUILLE DU RECUEIL OUVERT. Une seule copie : l'accueil du recueil, la page
// d'un bulletin et les pages d'abonnement s'y réfèrent (voir `pageBulletins`).
// Le recueil est SERVI ainsi, sans JavaScript, à des lecteurs qui n'ont que leur
// navigateur : la feuille suit donc le thème clair ou sombre du système.
const CSS_RECUEIL = `\n:root{--ink:#161616;--muted:#5a6472;--brand:#000091;--soft:#eef1fb;--line:#d5dbe4;--bg:#f5f6f8;--card:#fff}
@media(prefers-color-scheme:dark){:root{--ink:#e8e8ea;--muted:#a4adba;--brand:#8fa4ff;--soft:#1d2334;--line:#39414c;--bg:#14161a;--card:#1b1e25}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
a{color:var(--brand)}main{max-width:1000px;margin:0 auto;padding:0 20px 60px}
.hdr{background:var(--card);border-bottom:1px solid var(--line)}
.hdr__in{max-width:1000px;margin:0 auto;padding:12px 20px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.hdr__org{font-size:.84rem;color:var(--muted)}.hdr__titre{font-weight:700}
.hero{margin:0 0 8px;padding:30px 0 22px}
.hero h1{font-size:2rem;line-height:1.2;margin:0 0 8px}
.hero p{margin:0;color:var(--muted);max-width:70ch}
.hero .stats{margin-top:10px;font-size:.86rem}
h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:30px 0 10px}
/* Les derniers actes : une ligne qui défile, sans JavaScript. */
.piste{list-style:none;display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 12px;margin:0}
.carte{flex:0 0 min(84vw,300px);scroll-snap-align:start;background:var(--card);border:1px solid var(--line);border-top:4px solid var(--brand);border-radius:6px;padding:14px 15px;display:flex;flex-direction:column;gap:5px}
.carte__theme{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--brand)}
/* La bande « À la une » : les actes mis en avant par l'administration. */
.carte--une{background:var(--soft);border-top-color:var(--brand)}
.carte__epingle{font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--brand)}
.carte__objet{font-size:1.02rem;font-weight:600;line-height:1.35;color:var(--ink);text-decoration:none}
.carte__objet:hover{color:var(--brand)}
.carte__meta,.carte__date{font-size:.8rem;color:var(--muted)}
.carte__date{margin-top:auto}
/* Les thèmes : une grille de tuiles, qui mènent chacune à ses actes. */
.tuiles{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;padding:0;margin:0}
.tuile a{display:flex;flex-direction:column;gap:3px;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:12px 14px;text-decoration:none;color:inherit;height:100%}
.tuile a:hover{border-color:var(--brand)}
.tuile__nom{font-weight:600;line-height:1.3}
.tuile__n{font-size:.8rem;color:var(--muted)}
.theme>h3{font-size:1.05rem;margin:26px 0 8px;padding-bottom:5px;border-bottom:1px solid var(--line)}
ul{list-style:none;padding:0;margin:0}
.acte{padding:9px 0;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:2px}
.acte__objet{color:var(--ink);text-decoration:none}.acte__objet:hover{color:var(--brand)}
.acte__m{color:var(--muted);font-size:.82rem}
.f{font-size:.78rem}.f a{text-decoration:none;border:1px solid var(--line);border-radius:3px;padding:1px 5px;margin-right:3px}
.vide{color:var(--muted)}
.donnees{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);font-size:.86rem;color:var(--muted)}
.donnees a{margin-right:10px}
/* Le BULLETIN : un sommaire de numéros, puis, dans un numéro, les entités et
   leurs thèmes — la même liste que le recueil, mais groupée par période. */
.bul-list{list-style:none;padding:0;margin:0}
.bul-item{display:flex;flex-direction:column;gap:2px;padding:11px 0;border-bottom:1px solid var(--line)}
.bul-item__t{color:var(--ink);text-decoration:none;font-weight:600}
.bul-item__t:hover{color:var(--brand)}
.bul-item__m{color:var(--muted);font-size:.82rem}
.bul__ent{margin:26px 0 0}
.bul__ent>h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.07em;color:var(--brand);margin:0 0 4px;border-bottom:1px solid var(--line);padding-bottom:5px}
.bul__ent .acte__objet{font-weight:500}
.petit{font-size:.82rem;color:var(--muted)}
.sommaire{margin:0 0 18px;font-size:.92rem}.sommaire a{margin-right:10px}
/* Le formulaire d'abonnement : les pages du recueil se lisent sans JavaScript,
   et s'abonner doit pouvoir se faire sans lui — un vrai formulaire, donc. */
.abon{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:16px 18px;margin:22px 0 8px;max-width:560px}
.abon h2{margin:0 0 6px;color:var(--ink);text-transform:none;letter-spacing:0;font-size:1.02rem}
.abon p{margin:0 0 12px;color:var(--muted);font-size:.9rem}
.abon form{display:flex;flex-direction:column;gap:8px}
.abon label{font-size:.82rem;color:var(--muted);margin-bottom:-4px}
.abon input{padding:9px 11px;border:1px solid var(--line);border-radius:4px;background:var(--bg);color:var(--ink);font:inherit;font-size:.95rem}
.abon button{align-self:flex-start;margin-top:4px;padding:9px 16px;border:0;border-radius:4px;background:var(--brand);color:#fff;font:inherit;font-weight:600;cursor:pointer}
.abon .ok{border-left:4px solid var(--brand);padding-left:12px;color:var(--ink)}
.abon .ko{border-left:4px solid #b3261e;padding-left:12px;color:var(--ink)}
`;

export function createActesApi({
  state,
  sha256,
  now = () => new Date().toISOString(),
  save,                       // (json) → true si l'état a été accepté
  maxDoc = 400000,
  maxPublies = 40,
  maxSignatures = 80,
  maxActes = 80,
  // LE DOMAINE DES BULLETINS (voir bulletins.mjs) — le Journal des actes, qui
  // rassemble les publications d'une période en un bulletin, le diffuse par
  // flux et par courriel. Il est INJECTÉ par le service, seul à connaître les
  // réglages, le courriel et l'état des abonnés ; le recueil, lui, ne fait que
  // servir ses pages publiques (voir `pageBulletins`). Absent, les adresses du
  // Bulletin n'existent pas — c'est le cas du service embarqué de la
  // plateforme, qui n'est pas un site.
  bulletins = null,
  // Le PRESTATAIRE DE SIGNATURE (voir signature.mjs) : le seul composant qui
  // appelle réellement l'API du prestataire, avec la clé — qui ne quitte pas le
  // serveur. Absent (ou non configuré), le circuit électronique reste en
  // simulation : le service renvoie alors les réglages qu'on lui a transmis,
  // sans rien appeler au-dehors.
  prestataire = null,
  // Le mode d'authentification du déploiement (« password », « oidc », « demo »).
  // Il ne change pas la gestion des clés d'API — elles servent toujours de comptes
  // de service — mais il dit à l'écran d'administration si le service est déjà
  // administrable par une session (auquel cas il n'y a rien à « provisionner »).
  authMode = "demo",
}) {
  const db = state;
  let dirty = null;           // dernier état sérialisé, en attente d'écriture
  // Le domaine des bulletins, s'il est branché. On éprouve l'INTERFACE plutôt
  // que la simple présence : un objet d'une autre forme ne doit pas faire
  // échouer le rendu du recueil.
  const bul = bulletins && typeof bulletins.apercu === "function" && typeof bulletins.publicEtat === "function" ? bulletins : null;
  // Les adresses du Bulletin, dérivées de celle du recueil : une seule règle,
  // un seul endroit (voir `pageBulletins` et le flux).
  const adresseBulletins = (base) => base + "/recueil/bulletins";
  const adresseBulletin = (base, id) => adresseBulletins(base) + "/" + encodeURIComponent(id);
  const adresseFlux = (base, mode) => adresseBulletins(base) + (mode === "atom" ? ".atom" : ".rss");

  const nowIso = () => now();
  const today = () => nowIso().slice(0, 10);

  // ------------------------------------------------ contrôle de légalité
  // L'étape de transmission au contrôle de légalité : l'acte signé part vers
  // l'API d'envoi de la préfecture, qui en accuse réception. L'accusé de
  // réception vaut certificat informatique de transmission (« Transmis au
  // contrôle de légalité le … à … »), déposé sur le document. Le service ne
  // transmet que si le client le lui a demandé au dépôt (`controleLegalite`), et
  // refuse alors de publier un acte dont la transmission manque. Mêmes règles,
  // mêmes mentions que le service de la plateforme (voir index.html).
  // L'adresse est un EXEMPLE : la transmission du service est simulée
  // (`simule: true`), et un déploiement réel pointe vers son propre point de
  // terminaison @ctes.
  const CONTROLE_LEGALITE = {
    destinataire: "Préfecture — contrôle de légalité",
    mode: "ctes",
    apiUrl: "https://api.ctes.exemple.fr/v1/transmissions",
  };
  const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  // Sans Intl : la mention doit être identique à celle produite côté client.
  function dateHeureFr(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const h = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return d.getDate() + " " + MOIS_FR[d.getMonth()] + " " + d.getFullYear() + " à " + h + " h " + mi;
  }

  function certificatTransmission({ reference, recuLe, destinataire, empreinte, demonstration = false }) {
    const d = destinataire || CONTROLE_LEGALITE.destinataire;
    const r = recuLe || nowIso();
    return {
      nature: demonstration ? "Simulation d'accusé de réception de télétransmission" : "Accusé de réception de télétransmission",
      emisPar: demonstration ? "Simulation locale (aucun appel à l'API @ctes)" : "Contrôle de légalité — télétransmission @ctes",
      emisLe: r,
      destinataire: d,
      reference: String(reference || ""),
      empreinte: String(empreinte || ""),
      algorithme: "SHA-256",
      demonstration: !!demonstration,
      sceau: sha256([reference, r, d, empreinte].join("|")),
      mention: demonstration
        ? "Transmis au contrôle de légalité le " + dateHeureFr(r) + " (mention de démonstration — transmission simulée, sans appel sortant)"
        : "Transmis au contrôle de légalité le " + dateHeureFr(r),
    };
  }

  function persist() {
    const s = JSON.stringify(db);
    if (!save || save(s)) { dirty = s; return true; }
    return false;
  }

  function nextId(prefix, table) {
    let n = (db.seq || 0) + 1;
    let id;
    do { id = prefix + "-" + String(n).padStart(4, "0"); n++; } while (table[id]);
    db.seq = n;
    return id;
  }

  // Éviction : on ne garde que les plus récentes (la plus ancienne sort d'abord).
  function evince(table, max, dateKey) {
    const keys = Object.keys(table);
    if (keys.length <= max) return;
    keys.sort((a, b) => String(table[a][dateKey] || "").localeCompare(String(table[b][dateKey] || "")));
    for (const k of keys.slice(0, keys.length - max)) delete table[k];
  }

  function slug(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  }

  const ok = (status, body, headers) => ({ status, headers: headers || {}, body });
  const err = (status, message, extra, headers) => ({ status, headers: headers || {}, body: { erreur: message, ...(extra || {}) } });

  // ------------------------------------------------- la part publique d'un original
  // Un original signé a DEUX parts : sa part publique (le document, ses
  // signatures, son horodatage) et son dossier INTERNE — les données
  // personnelles du signataire (adresse électronique, compte, moyen
  // d'authentification) et la trace des courriels qui lui ont été adressés. La
  // signature « simple », donnée dans l'application, se signale ainsi sans
  // diffuser les coordonnées de l'agent.
  //
  // `sansInterne` retire la part interne et, dans l'identité du signataire, tout
  // ce qui n'a pas à être publié. C'est cette fonction qui est appliquée à
  // CHAQUE lecture publique — la seule garantie que rien ne fuit par une route
  // qu'on aurait oublié de fermer.
  function sansInterne(v) {
    if (!v || typeof v !== "object") return v;
    const { interne, ...reste } = v;
    if (!Array.isArray(v.signatures)) return reste;
    return {
      ...reste,
      signatures: v.signatures.map((s) => {
        const sig = { ...((s && s.signataire) || {}) };
        delete sig.courriel; delete sig.personId; delete sig.compteId; delete sig.compteOutil; delete sig.rapproche;
        return { ...s, signataire: sig };
      }),
    };
  }

  // -------------------------------------------------------------- projections
  function resumeActe(a) {
    return { id: a.id, numero: a.numero, objet: a.objet, nature: a.nature, entityName: a.entityName, dateSignature: a.dateSignature, statut: a.statut, sha256: a.sha256, controleLegalite: a.controleLegalite === true, transmission: a.transmission || null, deposeLe: a.deposeLe, signatureId: a.signatureId || null, publication: a.publication || null };
  }
  function resumeSignature(s) {
    return { id: s.id, acteId: s.acteId, numero: s.numero, statut: s.statut, signataires: s.signataires, creeLe: s.creeLe, signeLe: s.signeLe || null, motif: s.motif || null, empreinte: (s.documentSigne && s.documentSigne.document && s.documentSigne.document.sha256) || null };
  }
  function resumePublication(p, latest) {
    return { cle: p.cle, eli: p.eli, eliUri: p.eliUri, url: p.url, numero: p.numero, nature: p.nature, themeId: p.themeId || "", themeLabel: p.themeLabel || "", objet: p.objet, entityName: p.entityName, dateDocument: p.dateDocument, datePublication: p.datePublication, dateOpposabilite: p.dateOpposabilite, kind: p.kind, recueil: p.recueil, publieeLe: p.publieeLe, latest: !!latest, epingle: p.epingle === true, reserve: p.reserve === true, transmission: p.transmission || null, versions: p.versions || [], informative: p.informative === true, adoption: p.adoption || null, juridique: p.juridique === false ? false : undefined, natureDoc: p.natureDoc || undefined };
  }

  // ------------------------------------------- publications réservées aux agents
  // Une publication peut être RÉSERVÉE AUX AGENTS : elle est bien publiée (elle a
  // son identifiant ELI, son original, ses versions), mais le recueil public ne
  // la sert qu'aux porteurs d'une session — une circulaire interne, une consigne
  // aux agents, un acte dont la diffusion est restreinte. Les adresses PUBLIQUES
  // (`/v1/publications…`, le recueil, `recueil.json`, `llms.txt`, `sitemap.xml`)
  // l'écartent donc pour un visiteur anonyme : c'est `agent` — vrai quand la
  // requête porte une session ou une clé de service — qui l'autorise.
  //
  // Le drapeau suit la PUBLICATION, comme les autres réglages de diffusion : une
  // nouvelle version d'une circulaire reprend la case de sa trame (voir
  // src/lib/schema.js, `reserve`) ou du formulaire de publication.
  const reservee = (p) => !!p && p.reserve === true;
  const visiblePour = (p, agent) => !!p && (agent || !reservee(p));
  // Les versions PUBLIQUES d'une publication : celles qu'un visiteur anonyme a
  // le droit de voir. Un agent les voit toutes (il peut avoir besoin de
  // l'historique d'une circulaire).
  const versionsVisibles = (eliUri, agent) => versionsOf(eliUri).filter((p) => visiblePour(p, agent));
  // Le repère de « dernière version » ne doit jamais désigner, pour un visiteur
  // anonyme, une version réservée : la dernière version VISIBLE fait foi.
  function dernierVisible(eliUri, agent) {
    const v = versionsVisibles(eliUri, agent);
    return v.length ? v[v.length - 1] : null;
  }

  function clePublication(eliUri, dateExpr) {
    return slug(eliUri.replace(/^eli:\/fr\//, "")) + "@" + (dateExpr || today());
  }

  function versionsOf(eliUri) {
    const all = Object.keys(db.publies).map((k) => db.publies[k]).filter((p) => p.eliUri === eliUri);
    all.sort((a, b) => String(a.dateDocument || "").localeCompare(String(b.dateDocument || "")) || String(a.publieeLe || "").localeCompare(String(b.publieeLe || "")));
    return all;
  }
  function latestOf(eliUri) {
    const v = versionsOf(eliUri);
    return v.length ? v[v.length - 1] : null;
  }

  const eliKey = (p) => "eli:/fr/" + [p.code, p.annee, p.numero, p.entite].filter(Boolean).join("/");

  // ------------------------------------------------------------------ OpenAPI
  function openapi() {
    return {
      openapi: "3.1.0",
      info: {
        title: SERVICE,
        version: SERVICE_VERSION,
        description: "API de dépôt, de signature électronique et de publication des actes administratifs. Les lectures sont publiques ; les écritures exigent un jeton d'API (Authorization: Bearer).",
      },
      servers: [{ url: "/", description: "Service de la collectivité" }],
      security: [],
      paths: {
        "/v1/health": { get: { operationId: "sante", summary: "État du service", description: "Vérifie que le service répond et donne le nombre d'objets conservés.", tags: ["Service"], responses: { 200: { description: "Service disponible" } } } },
        "/v1/actes": {
          get: { operationId: "listerActes", summary: "Lister les actes déposés", tags: ["Actes"], responses: { 200: { description: "Liste des actes finalisés reçus par le service" } } },
          post: {
            operationId: "deposerActe", summary: "Déposer un acte finalisé", tags: ["Actes"],
            description: "Reçoit l'acte finalisé (Akoma Ntoso) et le conserve en vue de la signature. Redéposer un document identique encore en circuit renvoie le même acte (200 au lieu de 201). Le champ `controleLegalite` (false par défaut) déclare que l'acte doit être transmis au contrôle de légalité avant sa publication.",
            security: [{ bearerAuth: [] }],
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["akn"], properties: { akn: { type: "string", description: "Le document Akoma Ntoso 3.0" }, numero: { type: "string" }, objet: { type: "string" }, nature: { type: "string" }, themeId: { type: "string", description: "Famille de la trame dont l'acte est issu : le THÈME sous lequel le recueil public classe l'acte." }, themeLabel: { type: "string", description: "Libellé du thème au dépôt." }, entityId: { type: "string" }, entityName: { type: "string" }, dateSignature: { type: "string", format: "date" }, trameId: { type: "string" }, ecarts: { type: "integer" }, controleLegalite: { type: "boolean", default: false, description: "true si l'acte doit être transmis au contrôle de légalité avant publication" } } } } } },
            responses: { 201: { description: "Acte déposé" }, 200: { description: "Acte déjà déposé (idempotent)" }, 401: { description: "Jeton absent" }, 403: { description: "Jeton invalide" }, 413: { description: "Document trop volumineux" } },
          },
        },
        "/v1/actes/{id}": { get: { operationId: "lireActe", summary: "Lire un acte déposé", tags: ["Actes"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "L'acte et ses métadonnées" }, 404: { description: "Acte inconnu" } } } },
        "/v1/actes/{id}/document": { get: { operationId: "lireDocumentActe", summary: "Télécharger le document Akoma Ntoso", tags: ["Actes"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Document au format application/akn+xml" }, 404: { description: "Acte inconnu" } } } },
        "/v1/actes/{id}/signature": {
          post: {
            operationId: "envoyerEnSignature", summary: "Envoyer un acte en signature", tags: ["Signature"],
            description: "Ouvre un circuit de signature auprès du prestataire (ESUP-Signature ou équivalent). Le service renvoie immédiatement un identifiant de circuit ; ce sont le prestataire (par notification) puis le suivi qui feront évoluer l'état. Le corps porte les réglages du prestataire (`api`) : transport, adresse, identifiant, niveau, adresse de notification, délai et points de terminaison. Quand le transport vaut « service » et qu'une adresse ET une clé sont configurées (SCRIBA_SIGNATURE_API_CLE), c'est le SERVICE qui appelle le prestataire : la réponse porte alors le lien de signature réel (`lienSignature`, `dossier`) ; sinon le circuit est simulé (`simulation: true`), et rien ne sort de la collectivité. La clé du prestataire n'est jamais transmise par le client, ni écrite au registre.",
            security: [{ bearerAuth: [] }],
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { signataires: { type: "array", items: { type: "object", properties: { nom: { type: "string" }, courriel: { type: "string" }, fonction: { type: "string" }, ordre: { type: "integer" } } } }, niveau: { type: "string", enum: ["simple", "avancee", "qualifiee"] }, urlNotification: { type: "string", description: "URL appelée par le prestataire à l'issue de la signature" }, api: { type: "object", description: "Réglages du prestataire de signature (voir Administration › Signature). Aucun secret : la clé reste au service.", properties: { transport: { type: "string", enum: ["service", "demonstration"] }, url: { type: "string" }, prestataire: { type: "string" }, niveau: { type: "string" }, urlNotification: { type: "string" }, timeoutMs: { type: "integer" }, cheminDocument: { type: "string" }, cheminSignataires: { type: "string" }, cheminDemarrer: { type: "string" }, cheminStatut: { type: "string" } } } } } } } },
            responses: { 202: { description: "Circuit ouvert" }, 404: { description: "Acte inconnu" }, 409: { description: "Acte déjà signé" }, 401: { description: "Jeton absent" } },
          },
        },
        "/v1/webhooks/signature": {
          post: {
            operationId: "notifierSignature", summary: "Notification du prestataire (retour de l'acte signé)", tags: ["Signature"],
            description: "Appelée par le prestataire lorsque la signature est apposée. Le service recalcule l'empreinte SHA-256 du document signé et la compare à celle de l'acte déposé : une différence est refusée (409), la signature n'est jamais acceptée sur un document qui n'est pas celui qui a été déposé.",
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["signatureId", "documentSigne"], properties: { signatureId: { type: "string" }, statut: { type: "string", enum: ["signee", "refusee"] }, documentSigne: { type: "object", description: "L'original signé (document + signatures + horodatage)" } } } } } },
            responses: { 200: { description: "Notification acceptée" }, 404: { description: "Circuit inconnu" }, 409: { description: "Empreinte du document signé différente de celle déposée" } },
          },
        },
        "/v1/signatures": { get: { operationId: "listerSignatures", summary: "Lister les circuits de signature", tags: ["Signature"], responses: { 200: { description: "Circuits ouverts" } } } },
        "/v1/signatures/{id}": { get: { operationId: "suivreSignature", summary: "Suivre un circuit de signature", tags: ["Signature"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Statut du circuit (en_attente, signee, refusee, rejetee)" }, 404: { description: "Circuit inconnu" } } } },
        "/v1/signatures/{id}/document-signe": { get: { operationId: "lireDocumentSigne", summary: "Récupérer l'acte signé", tags: ["Signature"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "L'original signé" }, 404: { description: "Acte signé non disponible" } } } },
        "/v1/actes/{id}/transmission": {
          post: {
            operationId: "transmettreControleLegalite", summary: "Transmettre l'acte signé au contrôle de légalité", tags: ["Contrôle de légalité"],
            description: "Adresse l'acte signé à l'API d'envoi du contrôle de légalité (télétransmission @ctes). L'accusé de réception délivré vaut certificat informatique de transmission : « Transmis au contrôle de légalité le … à … ». Le service refuse (409) de transmettre un acte qui n'est pas signé ; un acte déjà transmis renvoie son certificat tel quel (idempotent).",
            security: [{ bearerAuth: [] }],
            requestBody: { required: false, content: { "application/json": { schema: { type: "object", properties: { at: { type: "string", description: "Horodatage de la remise (ISO 8601) ; à défaut, l'heure du service" }, mode: { type: "string", enum: ["ctes", "prefecture", "sous_prefecture", "arrete_controle", "autre"] }, destinataire: { type: "string" }, auteur: { type: "string" }, entite: { type: "string" } } } } } },
            responses: { 201: { description: "Transmis : certificat de transmission délivré" }, 200: { description: "Acte déjà transmis (idempotent)" }, 404: { description: "Acte inconnu" }, 409: { description: "Acte non signé (code `acte_non_signe`)" }, 401: { description: "Jeton absent" } },
          },
          get: { operationId: "lireTransmission", summary: "Lire le certificat de transmission d'un acte", tags: ["Contrôle de légalité"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "La transmission et son certificat" }, 404: { description: "Acte inconnu, ou acte non transmis (code `transmission_absente`)" } } },
        },
        "/v1/actes/{id}/dossier-signature": { get: { operationId: "lireDossierSignature", summary: "Lire le dossier de signature interne", description: "Rend la PART INTERNE de l'original signé : identité nominative du signataire (nom, courriel), compte, moyen d'authentification, et trace des courriels de notification. Ces données ne sont jamais diffusées au public — elles ne sortent que par cette route, sur un acte déposé, donc derrière une session ou un jeton.", security: [{ bearerAuth: [] }], tags: ["Signature"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Le dossier interne" }, 401: { description: "Jeton absent" }, 404: { description: "Acte inconnu, ou aucun dossier interne (code `dossier_absent`)" } } } },
        "/v1/actes/{id}/publication": {
          post: {
            operationId: "publierActe", summary: "Publier l'acte signé et attribuer son ELI", tags: ["Publication"],
            description: "Dépose la version en ligne au recueil et attribue l'identifiant ELI. La publication est refusée (409) tant que l'acte n'est pas signé : c'est la chaîne d'intégrité ; refusée aussi (409) si l'acte a été déclaré soumis au contrôle de légalité mais n'a pas encore été transmis (code `transmission_absente`) ; et refusée (422) si la date de publication précède la date de signature. Fournir un en-tête « Idempotency-Key » rend l'appel rejouable sans créer de doublon.",
            security: [{ bearerAuth: [] }],
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["html", "akn", "original"], properties: { recueil: { type: "string" }, themeId: { type: "string", description: "Famille de la trame : le thème sous lequel le recueil public classe l'acte." }, themeLabel: { type: "string", description: "Libellé du thème." }, datePublication: { type: "string", format: "date" }, opposabilite: { type: "object", properties: { mode: { type: "string", enum: ["lendemain", "jours"] }, jours: { type: "integer" } } }, kind: { type: "string", enum: ["originale", "consolidee", "modificative"] }, html: { type: "string", description: "La version en ligne" }, akn: { type: "string" }, jsonld: { type: "string" }, md: { type: "string", description: "Le texte de l'acte en Markdown (sert les robots et les agents)" }, texte: { type: "string", description: "Le texte de l'acte en texte brut" }, original: { type: "object", description: "L'original signé — sa part PUBLIQUE (document, signatures, horodatage). Le dossier interne en est retiré avant conservation." }, originalInterne: { type: "object", description: "La part INTERNE de l'original : coordonnées du signataire, compte, authentification, courriels. Conservée au registre, jamais servie par une route publique (voir /v1/actes/{id}/dossier-signature)." } } } } } },
            responses: { 201: { description: "Publié : ELI attribué" }, 200: { description: "Appel rejoué (Idempotency-Key)" }, 404: { description: "Acte inconnu" }, 409: { description: "Acte non signé" }, 422: { description: "Version en ligne manquante" } },
          },
        },
        "/v1/admin/purge": { post: { operationId: "purgerService", summary: "Remettre le service à zéro", description: "Vide les actes déposés, les circuits de signature et les publications — le pendant côté service du bouton « Repartir d'un référentiel vierge ». Le recueil public lit le service : vider le seul navigateur laisserait les publications de démonstration en ligne. Exige `{ \"confirmation\": \"repurge\" }` : un appel accidentel ne doit pas l'emporter. Réservé à l'administration.", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["confirmation"], properties: { confirmation: { type: "string", description: "Le mot « repurge »" } } } } } }, tags: ["Administration"], responses: { 200: { description: "Service purgé" }, 400: { description: "Confirmation absente (code `confirmation_absente`)" }, 403: { description: "Rôle insuffisant" } } } },
        "/v1/publications": { get: { operationId: "listerPublications", summary: "Registre public des publications", description: "Les publications, de la plus récente à la plus ancienne. Les publications marquées `reserve` (circulaires internes) ne sont rendues qu'à l'appelant qui porte une session ou une clé de service ; elles sont invisibles aux visiteurs anonymes.", tags: ["Publication"], responses: { 200: { description: "Publications, de la plus récente à la plus ancienne" } } } },
        "/v1/informations": { get: { operationId: "listerInformations", summary: "Informations publiées au recueil", description: "Les billets publiés par la collectivité (actualités, avis, communications), du plus récent au plus ancien. Route PUBLIQUE : seuls les billets publiés (`publie: true`) sont rendus ; un brouillon ne sort que vers une identité de rôle `editeur` au moins.", tags: ["Publication"], responses: { 200: { description: "Les informations publiées" } } } },
        "/v1/publications/{cle}": { get: { operationId: "lirePublication", summary: "Lire une publication (version en ligne, formats, original)", description: "Renvoie 404 pour une publication réservée quand l'appelant est anonyme — une publication réservée n'existe pas hors session.", tags: ["Publication"], parameters: [{ name: "cle", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Publication complète" }, 404: { description: "Publication inconnue" } } } },
        "/v1/publications/{cle}/epingle": { post: { operationId: "epinglerPublication", summary: "Épingler un acte au recueil (le mettre à la une)", description: "Met en avant un acte publié sur la page d'accueil du recueil public (bande « À la une »). Le drapeau suit l'ACTE — son identifiant ELI — et non la version déposée : il est posé sur toutes les versions publiées sous cet identifiant, et une version publiée plus tard l'hérite. Le geste est réversible (`epingle: false`) et ne touche pas au texte publié.", security: [{ bearerAuth: [] }], tags: ["Publication"], parameters: [{ name: "cle", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["epingle"], properties: { epingle: { type: "boolean", description: "true pour mettre à la une, false pour l'en retirer" }, auteur: { type: "string", description: "Qui a épinglé (pour la trace)" } } } } } }, responses: { 200: { description: "Publication épinglée ou désépinglée" }, 404: { description: "Publication inconnue" } } } },
        "/v1/eli/{code}/{annee}/{numero}/{entite}": { get: { operationId: "resoudreEli", summary: "Résoudre un identifiant ELI", tags: ["Publication"], description: "Renvoie la version en vigueur et l'historique des versions publiées sous le même ELI.", parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }, { name: "annee", in: "path", required: true, schema: { type: "string" } }, { name: "numero", in: "path", required: true, schema: { type: "string" } }, { name: "entite", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "La version en vigueur et ses versions" }, 404: { description: "ELI inconnu" } } } },
      },
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
    };
  }

  // ------------------------------------------------------------------ routage
  const lireActe = (id) => db.actes[id] || null;
  const lireSignature = (id) => db.signatures[id] || null;
  const lirePublication = (cle) => db.publies[cle] || null;

  function hSante() {
    return ok(200, {
      statut: "ok", service: SERVICE, version: SERVICE_VERSION, maintenant: nowIso(),
      objets: { actes: Object.keys(db.actes).length, signatures: Object.keys(db.signatures).length, publications: Object.keys(db.publies).length },
    });
  }

  function hDeposerActe(ctx) {
    const b = ctx.body || {};
    if (!b.akn || typeof b.akn !== "string") return err(400, "Le corps de la requête doit contenir le document `akn`.", { code: "document_absent" });
    if (b.akn.length > maxDoc) return err(413, `Document trop volumineux (${b.akn.length} caractères, maximum ${maxDoc}).`, { code: "document_trop_volumineux" });
    const sha = sha256(b.akn);
    // Idempotence « en vol » : redéposer un document déjà reçu et encore en
    // circuit renvoie le même acte. Un acte déjà signé ou publié n'est jamais
    // renvoyé : un nouveau circuit s'ouvre sur un nouveau dépôt.
    for (const id in db.actes) {
      const a = db.actes[id];
      if (a.sha256 === sha && (a.statut === "depose" || a.statut === "en_signature")) {
        return ok(200, { id, href: "/v1/actes/" + id, sha256: sha, deposeLe: a.deposeLe, idempotent: true }, { location: "/v1/actes/" + id });
      }
    }
    const id = nextId("ACT", db.actes);
    const acte = {
      id, akn: b.akn, sha256: sha,
      numero: b.numero || "", objet: b.objet || "", nature: b.nature || "Acte",
      // Le THÈME de l'acte — la famille de sa trame : c'est par lui que le
      // recueil public classe les actes. Le service ne connaît pas les trames ;
      // le client le lui dit au dépôt, et la publication le reprend.
      themeId: b.themeId || "", themeLabel: b.themeLabel || "",
      entityId: b.entityId || "", entityName: b.entityName || "",
      dateSignature: b.dateSignature || "", trameId: b.trameId || "", ecarts: b.ecarts || 0,
      // Le client dit si l'acte doit être transmis au contrôle de légalité avant
      // sa publication (fonction éteinte par défaut côté client).
      controleLegalite: b.controleLegalite === true,
      statut: "depose", deposeLe: nowIso(),
    };
    db.actes[id] = acte;
    evince(db.actes, maxActes, "deposeLe");
    if (!persist()) { delete db.actes[id]; return err(507, "Le service n'a plus de place disponible."); }
    return ok(201, { id, href: "/v1/actes/" + id, sha256: sha, statut: acte.statut, deposeLe: acte.deposeLe }, { location: "/v1/actes/" + id });
  }

  // --------------------------------------------------------------------------
  // ENVOYER EN SIGNATURE — l'ouverture du circuit.
  //
  // Deux façons de le mener, réglées par le référentiel (`signature.api`, voir
  // src/lib/externe.js) et par le `.env` du déploiement :
  //
  //   • le transport vaut « service » et une adresse ET une clé sont
  //     configurées : c'est CE SERVICE qui appelle le prestataire, par
  //     signature.mjs — la clé ne sort jamais du serveur. Le client reçoit le
  //     lien de signature réel, et le prestataire préviendra le service par le
  //     webhook ;
  //   • sinon : le circuit est SIMULÉ. Le service tient le registre, et c'est
  //     l'application qui joue le prestataire (c'est le mode de la
  //     démonstration, et celui d'une collectivité qui n'a pas encore branché
  //     le sien). Rien ne sort de la collectivité.
  //
  // Le client transmet ses réglages (`api`) : ils sont ceux du référentiel, et
  // le `.env` les a éventuellement écrasés. Ils servent à la simulation, et
  // restent enregistrés sur le circuit, pour que la lecture d'un dossier dise
  // toujours d'où le numéro et le lien venaient. JAMAIS la clé.
  // --------------------------------------------------------------------------
  async function hEnvoyerEnSignature(ctx) {
    const acte = lireActe(ctx.params.id);
    if (!acte) return err(404, "Acte déposé inconnu : " + ctx.params.id);
    if (acte.statut === "signee" || acte.statut === "publie") return err(409, "Cet acte est déjà signé (" + acte.statut + ").", { code: "deja_signe" });
    const b = ctx.body || {};
    const signataires = Array.isArray(b.signataires) && b.signataires.length ? b.signataires : [{ nom: "Signataire non précisé" }];
    const reglages = { ...(b.api || {}) };
    const niveau = b.niveau || reglages.niveau || "avancee";
    const urlNotification = b.urlNotification || reglages.urlNotification || "/v1/webhooks/signature";

    // Le prestataire est-il réellement branché côté service ? Le circuit
    // « simple » (niveau simple) n'y touche jamais : il se signe DANS
    // l'application, avec le compte du signataire — voir src/lib/externe.js.
    const branche = !!(prestataire && prestataire.actif()) && niveau !== "simple";
    const id = nextId("SIG", db.signatures);
    const sig = {
      id, acteId: acte.id, numero: acte.numero, acteSha256: acte.sha256,
      statut: "en_attente", signataires, niveau,
      urlNotification,
      prestataire: reglages.prestataire || "esup-signature",
      // Les réglages reçus — jamais la clé, qui n'est même pas transmise par le
      // client : elle ne vit qu'auprès du service (SCRIBA_SIGNATURE_API_CLE).
      api: { ...reglages },
      simulation: !branche,
      creeLe: nowIso(), documentSigne: null,
    };

    // Le dépôt réel auprès du prestataire : trois appels, dont la réponse porte
    // l'identifiant du dossier et le lien de signature. Un échec n'ouvre PAS le
    // circuit : le registre reste intact, et le client sait quoi corriger.
    let depot = null;
    if (branche) {
      try {
        depot = await prestataire.provisionner({
          akn: acte.akn, reference: acte.numero || acte.id, numero: acte.numero || "",
          objet: acte.objet || "", acteId: acte.id, empreinte: acte.sha256,
          signataires: signataires.map((s) => ({ ...s, niveau: s.niveau || niveau })),
        });
      } catch (e) {
        return err(502, "Le circuit n'a pas pu être ouvert auprès du prestataire : " + String((e && e.message) || e), { code: "prestataire_indisponible" });
      }
      sig.docId = depot.document;
      sig.lienSignature = depot.lienSignature || "";
    } else {
      // Simulation : le lien est celui que l'application jouera elle-même — il
      // ne pointe nulle part de réel, et le dossier est le circuit lui-même.
      sig.docId = id;
      sig.lienSignature = (reglages.url || "") + "/signature/" + id;
    }

    db.signatures[id] = sig;
    acte.statut = "en_signature";
    acte.signatureId = id;
    evince(db.signatures, maxSignatures, "creeLe");
    if (!persist()) { delete db.signatures[id]; acte.statut = "depose"; return err(507, "Le service n'a plus de place disponible."); }

    const infoPrestataire = branche
      ? depot.prestataire
      : {
        id: reglages.prestataire || "esup-signature",
        nom: (reglages.prestataire || "esup-signature") + " (simulation)",
        baseUrl: reglages.url || "",
        niveau,
        demonstration: true,
      };
    return ok(202, {
      signatureId: id,
      statut: "en_attente",
      acteId: acte.id,
      empreinte: acte.sha256,
      signataires,
      niveau,
      simulation: !branche,
      dossier: sig.docId || id,
      lienSignature: sig.lienSignature || "",
      relevé_apres_secondes: 20,
      prestataire: {
        ...infoPrestataire,
        document: (reglages.cheminDocument || "/documents"),
        signataires: (reglages.cheminSignataires || "/documents/{document}/signataires"),
        demarrer: (reglages.cheminDemarrer || "/documents/{document}/demarrer"),
        statut: (reglages.cheminStatut || "/documents/{document}"),
      },
      notifications: { url: sig.urlNotification, evenement: "signature.terminee" },
    }, { location: "/v1/signatures/" + id });
  }

  function hWebhookSignature(ctx) {
    const b = ctx.body || {};
    const sig = lireSignature(b.signatureId);
    if (!sig) return err(404, "Circuit de signature inconnu : " + (b.signatureId || "(absent)"));
    if (b.statut === "refusee") { sig.statut = "refusee"; sig.motif = b.motif || "Signature refusée par le signataire"; persist(); return ok(200, { recu: true, signatureId: sig.id, statut: sig.statut }); }
    const pack = b.documentSigne;
    if (!pack || !pack.document || typeof pack.document.akn !== "string") return err(400, "Notification invalide : `documentSigne.document.akn` est attendu.", { code: "document_absent" });
    const acte = lireActe(sig.acteId);
    if (!acte) return err(404, "Acte d'origine introuvable pour ce circuit.");
    // Contrôle d'intégrité fait par le service lui-même : le document signé doit
    // être exactement le document déposé.
    const sha = sha256(pack.document.akn);
    if (sha !== acte.sha256) {
      sig.statut = "rejetee";
      sig.motif = "Empreinte du document signé différente de celle du document déposé";
      persist();
      return err(409, "Signature refusée : le document signé ne correspond pas au document déposé.", {
        code: "empreinte_divergente",
        empreinte_deposee: acte.sha256,
        empreinte_signee: sha,
      });
    }
    sig.statut = "signee";
    sig.documentSigne = pack;
    sig.signeLe = (pack.signatures && pack.signatures[0] && pack.signatures[0].signeLe) || nowIso();
    acte.statut = "signee";
    acte.signeLe = sig.signeLe;
    if (!persist()) return err(507, "Le service n'a plus de place disponible.");
    return ok(200, { recu: true, signatureId: sig.id, acteId: acte.id, statut: "signee", signeLe: sig.signeLe, empreinte: sha });
  }

  // Télétransmission au contrôle de légalité : l'acte signé part vers l'API
  // d'envoi, qui accuse réception. Le service refuse de transmettre un acte qui
  // n'est pas signé, et renvoie son certificat tel quel si l'acte l'a déjà été.
  function hTransmettre(ctx) {
    const acte = lireActe(ctx.params.id);
    if (!acte) return err(404, "Acte déposé inconnu : " + ctx.params.id);
    if (acte.statut !== "signee" && acte.statut !== "publie") {
      return err(409, "Un acte ne peut être transmis au contrôle de légalité qu'après signature.", { code: "acte_non_signe", statut: acte.statut });
    }
    if (acte.transmission) return ok(200, { ...acte.transmission, idempotent: true });
    const b = ctx.body || {};
    const recuLe = b.at || nowIso();
    const reference = b.reference || ("AR-" + String(recuLe).slice(0, 7) + "-" + String(Object.keys(db.actes).length).padStart(4, "0"));
    const destinataire = b.destinataire || CONTROLE_LEGALITE.destinataire;
    const empreinte = acte.sha256;
    // Aucun appel sortant n'est fait ici : l'accusé de réception est fabriqué
    // localement, et la mention le dit. Une intégration @ctes réelle lèvera ce
    // marqueur (`demonstration: false`). Voir NC-IV-004 et P-19.
    const certificat = certificatTransmission({ reference, recuLe, destinataire, empreinte, demonstration: true });
    acte.transmission = {
      reference, recuLe, destinataire, mode: b.mode || CONTROLE_LEGALITE.mode,
      empreinte, auteur: String(b.auteur || "").slice(0, 120), entite: String(b.entite || "").slice(0, 160),
      api: { url: CONTROLE_LEGALITE.apiUrl, statut: 202, simule: true },
      demonstration: true,
      certificat, transmisLe: nowIso(),
    };
    if (!persist()) { delete acte.transmission; return err(507, "Le service n'a plus de place disponible."); }
    return ok(201, {
      acteId: acte.id, numero: acte.numero, reference, recuLe, destinataire,
      mode: acte.transmission.mode, empreinte, certificat,
      document: "/v1/actes/" + acte.id + "/document",
      certificatUrl: "/v1/actes/" + acte.id + "/transmission",
      ressource: "/v1/actes/" + acte.id + "/transmission",
    }, { location: "/v1/actes/" + acte.id + "/transmission" });
  }

  function hPublier(ctx) {
    const acte = lireActe(ctx.params.id);
    if (!acte) return err(404, "Acte déposé inconnu : " + ctx.params.id);
    if (acte.statut !== "signee" && acte.statut !== "publie") {
      return err(409, "Un acte ne peut être publié qu'après signature.", { code: "acte_non_signe", statut: acte.statut });
    }
    // Étape de transmission au contrôle de légalité : lorsque le client l'a
    // demandée au dépôt, l'acte ne peut pas être publié avant d'avoir été
    // transmis. C'est le service qui tient l'ordre signé → transmis → publié.
    if (acte.controleLegalite === true && !acte.transmission) {
      return err(409, "Cet acte doit être transmis au contrôle de légalité avant sa publication.", { code: "transmission_absente", statut: acte.statut, controleLegalite: true });
    }
    const b = ctx.body || {};
    // PUBLICATION INFORMATIVE : le texte consolidé d'un RÈGLEMENT annexé, publié
    // pour lui-même à titre d'information (voir SPEC § 2.2.4 ter). Elle
    // n'appartient pas à l'acte déposé auquel elle est rattachée — elle n'a ni
    // signature ni original propres, et ne touche donc pas à l'état de cet acte.
    // C'est la règle MINIMALE qui l'autorise : tout le reste de la mécanique de
    // publication (clé, ELI, versions, épinglage) est celle des actes.
    const informative = b.informative === true;
    if (!b.html || !b.akn) return err(422, "La version en ligne (`html`) et le document Akoma Ntoso (`akn`) sont requis pour publier.", { code: "version_en_ligne_absente" });
    if (!b.original && !informative) return err(422, "L'original signé (`original`) est requis : c'est lui qui est conservé et opposable.", { code: "original_absent" });
    const idem = ctx.headers["idempotency-key"] || ctx.headers["Idempotency-Key"];
    if (idem && db.idem[idem]) {
      const p = lirePublication(db.idem[idem]);
      if (p) return ok(200, { ...resumePublication(p, latestOf(p.eliUri) === p), idempotent: true });
    }
    const eliUri = b.eliUri || "";
    if (!eliUri) return err(422, "L'identifiant ELI (`eliUri`) est requis.", { code: "eli_absent" });
    const datePublication = b.datePublication || today();
    const dateDocument = b.dateDocument || acte.dateSignature || "";
    if (dateDocument && datePublication < dateDocument) {
      return err(422, "La date de publication ne peut pas précéder la date de signature de l'acte.", { code: "date_publication_anterieure", dateDocument, datePublication });
    }
    const dateExpr = b.dateExpression || dateDocument || datePublication;
    const cle = clePublication(eliUri, dateExpr + "-" + (b.kind || "originale"));
    if (db.publies[cle]) return ok(200, { ...resumePublication(db.publies[cle], true), idempotent: true });

    const rec = {
      cle, eli: eliUri, eliUri, url: b.url || "", work: b.work || "",
      numero: b.numero || (informative ? "" : acte.numero), nature: b.nature || acte.nature, objet: b.objet || acte.objet,
      themeId: b.themeId || acte.themeId || "", themeLabel: b.themeLabel || acte.themeLabel || "",
      entityId: acte.entityId, entityName: acte.entityName, entityCode: b.entityCode || "",
      // Un document non juridique n'a PAS d'entrée en vigueur : le service ne
      // retient aucune date d'opposabilité, même si un client en proposait une.
      dateDocument, datePublication, dateOpposabilite: b.juridique === false ? "" : (b.dateOpposabilite || ""),
      opposabiliteRule: b.opposabiliteRule || "", recueil: b.recueil || "", auteur: b.auteur || "",
      // Un document NON JURIDIQUE (verbatim, déclaration, vœu) : publié au
      // recueil, mais sans opposabilité. Le drapeau vient du client, qui l'a lu
      // sur la nature de la trame ; il voyage avec la publication et jusqu'au
      // recueil, qui présente alors le document sans entrée en vigueur.
      juridique: b.juridique === false ? false : undefined,
      natureDoc: b.natureDoc || undefined,
      kind: b.kind || "originale", brandName: b.brandName || "",
      // Une publication INFORMATIVE (le règlement consolidé d'une annexe) et,
      // pour toute publication, l'acte qui l'adopte s'il y en a un : le recueil
      // s'en sert pour rattacher le règlement à sa décision d'adoption.
      informative: informative || undefined,
      adoption: b.adoption || null,
      // L'ÉPINGLAGE suit l'ACTE (son identifiant ELI), non la version déposée :
      // une version publiée plus tard hérite donc du drapeau déjà posé — un
      // règlement intérieur qu'on modifie reste « à la une ». Voir
      // hEpinglerPublication.
      epingle: b.epingle === true || versionsOf(eliUri).some((v) => v.epingle === true),
      // La publication peut être RÉSERVÉE AUX AGENTS (circulaire interne) : le
      // recueil public ne la sert alors qu'aux porteurs d'une session. C'est le
      // client qui le demande — d'après la trame (Administration › Trames) ou la
      // case cochée au moment de publier ; le service le range tel quel.
      reserve: b.reserve === true || undefined,
      sha256: sha256(b.akn), formats: { html: b.html, akn: b.akn, jsonld: b.jsonld || "", md: b.md || "", texte: b.texte || "" },
      // La part PUBLIQUE de l'original : ce que le recueil montre et vérifie. On
      // lui applique `sansInterne` — un client qui aurait laissé le dossier
      // interne dans l'original ne le fait pas entrer par cette porte. Une
      // publication informative n'en a pas : elle n'est pas signée.
      original: informative || !b.original ? null : (() => {
        const o = sansInterne(b.original) || {};
        return {
          format: o.format || "application/vnd.actes.original-signe+json",
          sha256: (o.document && o.document.sha256) || "",
          pageHtml: o.pageHtml || "",
          signatures: o.signatures || [],
          horodatage: o.horodatage || null,
          signaturesUrl: "/v1/eli/" + slug(eliUri.replace(/^eli:\/fr\//, "")) + "/original",
        };
      })(),
      // La part INTERNE, conservée au registre et JAMAIS servie par une route
      // publique : coordonnées du signataire, compte, authentification, courriels.
      originalInterne: b.originalInterne || ((b.original && b.original.interne) ? b.original : null) || acte.originalInterne || null,
      signature: informative || !b.original ? null : (() => {
        const o = sansInterne(b.original) || {};
        const sigs = o.signatures || [];
        return {
          prestataire: o.prestataire || null,
          niveau: b.niveau || (o.externe ? "externe" : o.prestataire ? "avancee" : "simple"),
          signataires: sigs.map((s) => ({ nom: s.signataire && s.signataire.nom, fonction: s.signataire && s.signataire.fonction })),
          signeLe: (sigs[0] && sigs[0].signeLe) || "",
          algorithme: (sigs[0] && sigs[0].algorithme) || "",
        };
      })(),
      ecarts: acte.ecarts || 0,
      signataireActe: b.auteur || "",
      // Le certificat de transmission au contrôle de légalité accompagne la
      // publication : la version publiée en porte la mention, et le registre
      // garde l'accusé de réception.
      transmission: b.transmission || acte.transmission || null,
      publieeLe: nowIso(), misAJourLe: nowIso(),
    };
    db.publies[cle] = rec;
    if (idem) db.idem[idem] = cle;
    // La publication informative ne fait PAS de l'acte déposé l'acte publié :
    // c'est elle qui EST le règlement, non l'acte d'adoption (dont le dépôt et
    // la signature ne sont pas concernés). L'acte garde donc son état.
    if (!informative) {
      acte.statut = "publie";
      acte.publication = cle;
    }
    // Le dossier interne garde aussi l'acte : l'agent qui ouvre le dossier de
    // signature le retrouve sans relire la publication.
    if (rec.originalInterne) acte.originalInterne = rec.originalInterne;
    evince(db.publies, maxPublies, "publieeLe");
    if (!persist()) { delete db.publies[cle]; return err(507, "Le service n'a plus de place disponible."); }
    const versions = versionsOf(eliUri).map((p) => resumePublication(p, false));
    return ok(201, {
      cle, eli: eliUri, eliUri, url: rec.url,
      numero: rec.numero, nature: rec.nature, objet: rec.objet,
      themeId: rec.themeId, themeLabel: rec.themeLabel,
      dateDocument, datePublication, dateOpposabilite: rec.dateOpposabilite,
      opposabilite: rec.opposabiliteRule,
      recueil: rec.recueil,
      epingle: rec.epingle === true,
      reserve: rec.reserve === true,
      informative: rec.informative === true,
      juridique: rec.juridique === false ? false : undefined,
      natureDoc: rec.natureDoc || undefined,
      adoption: rec.adoption || null,
      versions,
      ressource: "/v1/publications/" + encodeURIComponent(cle),
      original: rec.original ? { format: rec.original.format, sha256: rec.original.sha256, signatures: (rec.signature && rec.signature.signataires || []).length, href: rec.original.signaturesUrl } : null,
      formats: ["text/html", "application/akn+xml", "application/ld+json"].concat(rec.original ? [rec.original.format] : []),
    }, { location: "/v1/publications/" + encodeURIComponent(cle) });
  }

  // ÉPINGLER un acte au recueil : le mettre en avant sur sa page d'accueil (la
  // bande « À la une » — la place d'un règlement intérieur, d'une charte). Le
  // geste ne touche pas au texte publié : il lève ou pose un drapeau, et se
  // défait aussi simplement qu'il s'est fait.
  //
  // Le drapeau suit l'ACTE — son identifiant ELI — et non la version publiée :
  // on le pose donc sur TOUTES les versions publiées sous cet identifiant, et
  // une version publiée plus tard l'hérite (voir hPublier). Un acte qu'on
  // modifie reste ainsi « à la une ». Même contrat que le service de la
  // plateforme (voir index.html).
  function hEpinglerPublication(ctx) {
    const cle = decodeURIComponent(ctx.params.cle);
    const p = lirePublication(cle);
    if (!p) return err(404, "Publication inconnue : " + cle, { code: "publication_inconnue" });
    const epingle = !!(ctx.body && ctx.body.epingle);
    const auteur = String((ctx.body && ctx.body.auteur) || "").slice(0, 120);
    const versions = versionsOf(p.eliUri);
    const avant = versions.map((v) => ({ epingle: v.epingle, epingleLe: v.epingleLe, epinglePar: v.epinglePar }));
    for (const v of versions) { v.epingle = epingle; v.epingleLe = nowIso(); v.epinglePar = auteur; }
    if (!persist()) {
      versions.forEach((v, i) => Object.assign(v, avant[i]));
      return err(507, "Le service n'a plus de place disponible.");
    }
    return ok(200, {
      ...resumePublication(p, latestOf(p.eliUri) === p),
      epingle, versions: versions.length,
      ressource: "/v1/publications/" + encodeURIComponent(cle),
    });
  }

  function hResoudreEli(ctx) {
    const eliUri = eliKey(ctx.params);
    const versions = versionsVisibles(eliUri, ctx.agent);
    if (!versions.length) return err(404, "Aucune publication ne porte l'identifiant " + eliUri + ".", { code: "eli_inconnu" });
    const enVigueur = versions[versions.length - 1];
    return ok(200, {
      eli: eliUri, eliUri, enVigueur: resumePublication(enVigueur, true),
      versions: versions.map((p, i) => resumePublication(p, i === versions.length - 1)),
      texte: { html: enVigueur.formats.html, akn: enVigueur.formats.akn, jsonld: enVigueur.formats.jsonld },
      original: enVigueur.original,
      ressource: "/v1/publications/" + encodeURIComponent(enVigueur.cle),
    }, { "content-location": "/v1/publications/" + encodeURIComponent(enVigueur.cle) });
  }

  // ------------------------------------- recueil ouvert : les robots et les LLMs
  // Un acte publié n'est pas seulement une page pour l'œil : c'est une DONNÉE
  // publique, que consultent aussi les moteurs de recherche et les agents
  // (LLMs). Cette couche leur donne ce qu'ils savent lire — des adresses
  // stables, un type de contenu exact, et du texte sans mise en page :
  //
  //   /robots.txt           ce qui peut être parcouru
  //   /llms.txt             le recueil présenté aux agents (convention llms.txt)
  //   /sitemap.xml          le plan du site, une adresse par acte
  //   /recueil.json         l'index complet, lisible par machine
  //   /recueil              la liste des actes, en HTML simple (sans JavaScript)
  //   /recueil/<clé>        la page publiée d'un acte
  //   /recueil/<clé>.<ext>  le même acte en json, md, txt, akn ou html
  //
  // Elle vit ici, dans le service, parce que c'est lui qui détient les
  // publications et qu'il répond sur le domaine du recueil (voir nginx.conf).
  // Le service embarqué de la plateforme n'en a pas : il n'est pas un site — il
  // répond à l'application, dans l'onglet, et rien de public ne l'interroge.
  // Toutes les adresses sont bâties sur l'origine de la requête (`Host`), pour
  // être justes quel que soit le domaine du déploiement.

  const htmlEsc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const TEXTE = { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=600" };
  const MARKDOWN = { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=600" };
  const XML = { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=600" };
  const HTML_PUBLIC = { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" };
  const JSON_PUBLIC = { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" };

  // L'origine publique telle que le visiteur l'a demandée. Sans en-tête `Host`
  // (appel interne), les adresses restent relatives : le recueil servi en direct
  // les donne toujours absolues, ce dont le plan du site a besoin.
  function origine(headers) {
    const h = headers || {};
    const host = String(h["x-forwarded-host"] || h.host || "").split(",")[0].trim();
    if (!host) return "";
    const proto = String(h["x-forwarded-proto"] || "").split(",")[0].trim()
      || (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ? "http" : "https");
    return proto + "://" + host;
  }
  const adresseRecueil = (base) => base + "/recueil";
  const adresseActe = (base, cle) => adresseRecueil(base) + "/" + encodeURIComponent(cle);
  const adresseFormat = (base, cle, ext) => adresseActe(base, cle) + "." + ext;

  // Une date écrite en clair, sans Intl (même rendu partout).
  function dateLongue(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return "";
    return Number(m[3]) + " " + MOIS_FR[Number(m[2]) - 1] + " " + m[1];
  }

  // Les publications, de la plus récente à la plus ancienne : c'est l'ordre de
  // lecture d'un recueil. `agent` écarte les publications réservées aux agents
  // quand la requête ne porte pas de session (voir `reservee`).
  function publicationsTriees(agent) {
    return Object.keys(db.publies).map((k) => db.publies[k])
      .filter((p) => visiblePour(p, agent))
      .sort((a, b) => String(b.datePublication || "").localeCompare(String(a.datePublication || ""))
        || String(b.publieeLe || "").localeCompare(String(a.publieeLe || "")));
  }

  // Les publications dans la forme qu'attend le COMPOSEUR DE BULLETINS (voir
  // bulletins.mjs) : la dernière version de chaque identifiant ELI — un acte
  // consolidé ne doit pas figurer deux fois dans le bulletin —, et seulement les
  // champs dont le bulletin a besoin pour classer et présenter les actes. C'est
  // le service qui la lui injecte : le bulletin et le recueil parlent ainsi
  // d'une seule voix, sans que le module des bulletins connaisse les
  // publications.
  //
  // `agent` vaut FAUX par défaut : un bulletin part par courriel et se lit en
  // clair sur le recueil, il ne peut donc pas divulguer les publications
  // réservées aux agents.
  function publicationsPubliques(agent) {
    const vue = [];
    for (const p of publicationsTriees(agent === true)) {
      if (dernierVisible(p.eliUri, agent === true) !== p) continue;
      vue.push({
        cle: p.cle,
        eliUri: p.eliUri || "",
        numero: p.numero || "",
        objet: p.objet || "",
        nature: p.nature || "",
        themeId: p.themeId || "",
        themeLabel: p.themeLabel || "",
        entityName: p.entityName || "",
        dateDocument: p.dateDocument || "",
        datePublication: p.datePublication || "",
        dateOpposabilite: p.dateOpposabilite || "",
        kind: p.kind || "originale",
        juridique: p.juridique === false ? false : undefined,
        natureDoc: p.natureDoc || "",
        recueil: p.recueil || "",
      });
    }
    return vue;
  }

  // Une fiche d'index : ce qu'un moteur, un agent ou un lecteur a besoin de
  // savoir d'un acte sans ouvrir son texte.
  function ficheActe(p, base) {
    const cle = p.cle;
    return {
      cle,
      eliUri: p.eliUri || "",
      url: adresseActe(base, cle),
      numero: p.numero || "",
      nature: p.nature || "",
      themeId: p.themeId || "",
      themeLabel: p.themeLabel || "",
      objet: p.objet || "",
      entityName: p.entityName || "",
      recueil: p.recueil || "",
      dateDocument: p.dateDocument || "",
      datePublication: p.datePublication || "",
      dateOpposabilite: p.dateOpposabilite || "",
      kind: p.kind || "originale",
      enVigueur: latestOf(p.eliUri) === p,
      // Mis en avant sur l'accueil du recueil (bande « À la une ») : le drapeau
      // suit l'ACTE — l'identifiant ELI —, non la version déposée.
      epingle: p.epingle === true,
      sha256: p.sha256 || "",
      formats: {
        html: adresseFormat(base, cle, "html"),
        json: adresseFormat(base, cle, "json"),
        markdown: adresseFormat(base, cle, "md"),
        texte: adresseFormat(base, cle, "txt"),
        akn: adresseFormat(base, cle, "akn"),
      },
    };
  }

  function indexRecueil(base, agent) {
    const liste = publicationsTriees(agent);
    const premier = liste[0] || {};
    return {
      recueil: { titre: premier.recueil || "", collectivite: premier.brandName || "", langue: "fr" },
      genereLe: nowIso(),
      nombre: liste.length,
      themes: themesDe(liste, base),
      note: "Les actes administratifs publiés sont publics. Les conditions de réutilisation relèvent de la collectivité.",
      actes: liste.map((p) => ficheActe(p, base)),
    };
  }

  // Les thèmes du recueil — la famille de la trame de chaque acte (« Urbanisme et
  // voirie », « Police administrative »…). C'est le classement que présente la
  // page d'accueil du recueil public : il se donne aussi aux agents, en données.
  function themesDe(liste, base) {
    const groupes = new Map();
    for (const p of liste) {
      const id = p.themeId || "";
      if (!groupes.has(id)) groupes.set(id, { id, label: p.themeLabel || "", nombre: 0 });
      groupes.get(id).nombre += 1;
    }
    return [...groupes.values()].sort((a, b) => b.nombre - a.nombre || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  // Un acte, en une phrase : c'est la description que reprennent les moteurs et
  // les agents (balise `description`, en-tête de page, llms.txt). On n'y met pas
  // la nature (un identifiant technique, « arrete ») : l'objet suffit et se lit.
  function resumeLisible(p, max = 300) {
    const objet = String(p.objet || "").trim();
    const debut = objet ? objet.charAt(0).toUpperCase() + objet.slice(1) : "Acte administratif";
    const parts = [
      debut + (p.numero ? " (n°" + p.numero + ")" : "") + ".",
      p.themeLabel ? "Thème : " + p.themeLabel + "." : "",
      p.entityName ? p.entityName + "." : "",
      p.datePublication ? "Publié le " + dateLongue(p.datePublication)
        + (p.juridique === false ? " (document non opposable)" : p.dateOpposabilite ? ", entrée en vigueur le " + dateLongue(p.dateOpposabilite) : "") + "." : "",
    ].filter(Boolean);
    const texte = parts.join(" ").replace(/\s+/g, " ").trim();
    return texte.length > max ? texte.slice(0, max - 1).trimEnd() + "…" : texte;
  }

  // Le texte brut d'une page publiée : les balises retirées, les blocs séparés
  // par une ligne vide. On ne garde que le corps du document (entre `.doc` et la
  // colonne de droite de la page) : l'en-tête et le pied de la page publiée sont
  // du décor, pas de l'acte. Sert de repli aux publications déposées avant que
  // le texte brut et le Markdown ne soient joints (`formats.texte`, plus bas).
  function texteDeHtml(html) {
    let h = String(html || "");
    const debut = h.indexOf('<div class="doc"');
    if (debut >= 0) {
      const fin = h.indexOf('<div class="pub-aside"', debut);
      h = h.slice(debut, fin > 0 ? fin : undefined);
    }
    return h
      .replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<\/(p|div|li|h1|h2|h3|h4|tr|section|article|blockquote|ul|ol|header|footer|aside|td|th|dd|dt|strong)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, " ")
      .split("\n").map((l) => l.trim()).join("\n")
      .replace(/\n{3,}/g, "\n\n").trim();
  }

  const formatsDe = (p) => (p && p.formats) || {};
  const texteDe = (p) => (formatsDe(p).texte || "").trim() || texteDeHtml(formatsDe(p).html);

  // Le Markdown d'un acte : celui déposé à la publication, ou, à défaut (acte
  // publié avant que ce format n'existe), un Markdown minimal mais complet —
  // titre, métadonnées, texte.
  function markdownDe(p) {
    const depose = (formatsDe(p).md || "").trim();
    if (depose) return depose + "\n";
    const objet = String(p.objet || "").trim();
    const titre = objet ? objet.charAt(0).toUpperCase() + objet.slice(1) : (p.numero || "Acte");
    const lignes = [
      `# ${titre}${p.numero ? " (n°" + p.numero + ")" : ""}`,
      "",
      [p.entityName, p.recueil].filter(Boolean).join(" · "),
      "",
      `- Identifiant ELI : \`${p.eliUri || "—"}\``,
      `- Date de l'acte : ${dateLongue(p.dateDocument) || "—"}`,
      `- Publié le : ${dateLongue(p.datePublication) || "—"}`,
      p.juridique === false
        ? "- Document non opposable : ce document est publié pour être porté à la connaissance de tous ; il ne crée ni droits ni obligations, et aucune entrée en vigueur ne s'y attache."
        : `- Entrée en vigueur : ${dateLongue(p.dateOpposabilite) || "—"}`,
      "",
      "---",
      "",
      texteDe(p),
      "",
      "---",
      "",
      "Seul l'original signé fait foi ; le texte ci-dessus est la version diffusée en ligne.",
    ];
    return lignes.join("\n");
  }

  function jsonDeActe(p, base) {
    const f = ficheActe(p, base);
    let jsonld = null;
    try { jsonld = formatsDe(p).jsonld ? JSON.parse(formatsDe(p).jsonld) : null; } catch (e) { jsonld = null; }
    return {
      ...f,
      auteur: p.auteur || "",
      opposabiliteRule: p.opposabiliteRule || "",
      transmission: p.transmission || null,
      signature: p.signature || null,
      original: {
        format: (p.original && p.original.format) || "",
        sha256: (p.original && p.original.sha256) || "",
        horodatage: (p.original && p.original.horodatage) || null,
        verifiable: (p.original && p.original.signaturesUrl) || "",
      },
      versions: versionsOf(p.eliUri).map((x) => resumePublication(x, latestOf(x.eliUri) === x)),
      jsonld,
      texte: texteDe(p),
    };
  }

  // ------------------------------------------- les liens par l'identifiant ELI
  // Un acte publié cite ses fondements par leur identifiant ELI (« eli:/fr/… ») :
  // l'identifiant ne change jamais, mais ce n'est pas une adresse — aucun
  // navigateur ne sait l'ouvrir. Le service, lui, connaît tous ses actes : il
  // remplace l'identifiant par l'adresse de l'acte visé, DANS l'instance. C'est le
  // pendant exact de ce que fait le recueil de l'application (voir
  // src/lib/recueil.js, `resoudreLiensEli`) — la page servie ici se lit donc sans
  // JavaScript, comme le reste du recueil ouvert.
  //
  // L'identifiant désigne l'ACTE : deux versions publiées sous le même
  // identifiant désignent le même acte, et c'est la version EN VIGUEUR que le
  // lien doit atteindre. Un identifiant que le recueil ne connaît pas est laissé
  // en TEXTE : un lien qui ne mène nulle part vaut moins que pas de lien.
  const cleEli = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, "").replace(/\/+$/, "");
  const RE_ANCRE_ELI = /<a\b([^>]*?)href="(eli:\/fr\/[^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi;

  function indexEli() {
    const index = new Map();
    for (const k of Object.keys(db.publies)) {
      const p = db.publies[k];
      if (!p || !p.eliUri || !p.cle) continue;
      index.set(cleEli(p.eliUri), latestOf(p.eliUri) || p);
    }
    return index;
  }

  function resoudreLiensEli(html, base) {
    const brut = String(html || "");
    if (brut.indexOf("eli:/fr/") < 0) return brut;
    const index = indexEli();
    return brut.replace(RE_ANCRE_ELI, (m, avant, eli, apres, texte) => {
      const p = index.get(cleEli(eli));
      if (!p) {
        return `<span class="recueil-lien-eli--hors" title="Acte non publié dans ce recueil — identifiant ELI ${htmlEsc(eli)}">${texte}</span>`;
      }
      const attrs = (avant + apres).replace(/\stitle="[^"]*"/gi, "").replace(/\s+/g, " ").trim();
      return `<a${attrs ? " " + attrs : ""} href="${htmlEsc(adresseActe(base, p.cle))}" data-eli="${htmlEsc(eli)}" title="Acte cité par son identifiant ELI — ${htmlEsc(eli)}">${texte}</a>`;
    });
  }

  // La page publiée d'un acte, complétée pour les moteurs : description, adresse
  // de référence, formats jumeaux et données structurées (JSON-LD). On n'ajoute
  // que ce qui manque — le titre de la page déposée est conservé, jamais doublé.
  function pageActe(p, base) {
    const html = resoudreLiensEli(formatsDe(p).html, base);
    const cle = p.cle;
    const bloc = [
      `<meta name="description" content="${htmlEsc(resumeLisible(p))}">`,
      `<meta name="robots" content="index, follow">`,
      `<meta property="og:type" content="article">`,
      `<meta property="og:title" content="${htmlEsc([p.objet || p.numero || "Acte", p.recueil].filter(Boolean).join(" — "))}">`,
      `<meta property="og:description" content="${htmlEsc(resumeLisible(p))}">`,
      `<meta property="og:url" content="${htmlEsc(adresseActe(base, cle))}">`,
      `<link rel="canonical" href="${htmlEsc(adresseActe(base, cle))}">`,
      `<link rel="alternate" type="application/json" href="${htmlEsc(adresseFormat(base, cle, "json"))}" title="Données de l'acte (JSON)">`,
      `<link rel="alternate" type="text/markdown" href="${htmlEsc(adresseFormat(base, cle, "md"))}" title="Texte de l'acte (Markdown)">`,
      `<link rel="alternate" type="text/plain" href="${htmlEsc(adresseFormat(base, cle, "txt"))}" title="Texte de l'acte (texte brut)">`,
      `<link rel="alternate" type="application/akn+xml" href="${htmlEsc(adresseFormat(base, cle, "akn"))}" title="Akoma Ntoso 3.0">`,
      formatsDe(p).jsonld ? `<script type="application/ld+json">${formatsDe(p).jsonld}</script>` : "",
      `<meta name="generator" content="${htmlEsc(SERVICE)}">`,
    ].filter(Boolean).join("\n");
    if (!html) {
      const titre = [p.objet || p.numero || "Acte", p.entityName].filter(Boolean).join(" — ");
      return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${htmlEsc(titre)}</title>${bloc}</head><body><h1>${htmlEsc(titre)}</h1><pre>${htmlEsc(texteDe(p))}</pre></body></html>`;
    }
    // Après le titre de la page déposée quand il existe : la balise `charset`
    // reste dans les premiers octets, et le titre du document est celui de
    // l'acte — jamais deux.
    const apresTitre = /<\/title>/i.exec(html);
    const apresEntete = /<head[^>]*>/i.exec(html);
    const point = apresTitre || apresEntete;
    if (!point) return bloc + "\n" + html;
    const sansTitre = apresTitre
      ? bloc
      : `<title>${htmlEsc([p.objet || p.numero || "Acte", p.entityName].filter(Boolean).join(" — "))}</title>\n` + bloc;
    return html.slice(0, point.index + point[0].length) + "\n" + sansTitre + html.slice(point.index + point[0].length);
  }

  // La page d'accueil du recueil, en HTML simple : elle se lit sans JavaScript,
  // et ses liens sont de vraies adresses — c'est ainsi qu'un moteur découvre les
  // actes. Elle suit l'accueil de l'application (voir
  // src/ui/views/recueil-public.js) : les derniers actes publiés défilent sur
  // une ligne, les THÈMES se présentent en grille, puis chaque thème donne ses
  // actes. Un lecteur qui n'exécute pas le JavaScript — un robot, un agent, une
  // machine — reçoit la même page que les autres.
  function pageRecueil(base, agent) {
    const liste = publicationsTriees(agent);
    const premier = liste[0] || {};
    const titre = premier.recueil || "Recueil des actes administratifs";
    const collectivite = premier.brandName || "";
    // Les actes ÉPINGLÉS : ceux que l'administration a mis en avant. Ils ouvrent
    // la page, dans la bande « À la une » (voir src/lib/recueil.js et la vue
    // src/ui/views/recueil-public.js : la même règle).

    const epingles = liste.filter((p) => dernierVisible(p.eliUri, agent) === p && p.epingle === true);
    // Les derniers actes publiés : la version en vigueur de chaque identifiant
    // ELI, de la plus récente à la plus ancienne — SANS les actes épinglés, qui
    // ont déjà leur bande au-dessus : un acte ne se présente qu'une fois.
    const dernieres = liste.filter((p) => dernierVisible(p.eliUri, agent) === p && p.epingle !== true).slice(0, 8);
    // Les actes rangés par thème, les thèmes les plus fournis d'abord.
    const groupes = new Map();
    for (const p of liste) {
      const id = p.themeId || "";
      if (!groupes.has(id)) groupes.set(id, { id, label: p.themeLabel || "", items: [] });
      groupes.get(id).items.push(p);
    }
    const themes = [...groupes.values()].sort((a, b) => b.items.length - a.items.length
      || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
    const nomTheme = (t) => t.label || "Autres actes";
    const ancreTheme = (t) => "#theme-" + (t.id || "autres");

    const carte = (p) => `<li class="carte${p.epingle === true ? " carte--une" : ""}">`
      + `${p.epingle === true ? '<span class="carte__epingle">à la une</span>' : ""}<span class="carte__theme">${htmlEsc(p.themeLabel || "Sans thème")}</span>`
      + `<a class="carte__objet" href="${htmlEsc(adresseActe(base, p.cle))}">${htmlEsc(p.objet || p.numero || "Acte")}</a>`
      + `<span class="carte__meta">${htmlEsc([p.numero, p.entityName].filter(Boolean).join(" · "))}</span>`
      + `<span class="carte__date">${p.datePublication ? "publié le " + htmlEsc(dateLongue(p.datePublication)) : ""}</span></li>`;

    const ligne = (p) => `<li class="acte"><a class="acte__objet" href="${htmlEsc(adresseActe(base, p.cle))}">${htmlEsc(p.objet || p.numero || "Acte")}</a>`
      + `<span class="acte__m">${htmlEsc([p.numero, p.entityName, p.datePublication ? "publié le " + dateLongue(p.datePublication) : "", dernierVisible(p.eliUri, agent) === p ? "" : "version antérieure", p.epingle === true ? "à la une" : ""].filter(Boolean).join(" · "))}</span>`
      + ` <span class="f">${["json", "md", "txt", "akn"].map((e) => `<a href="${htmlEsc(adresseFormat(base, p.cle, e))}">${e}</a>`).join(" ")}</span></li>`;

    const grille = themes.map((t) => `<li class="tuile"><a href="${htmlEsc(ancreTheme(t))}">`
      + `<span class="tuile__nom">${htmlEsc(nomTheme(t))}</span>`
      + `<span class="tuile__n">${t.items.length} acte${t.items.length > 1 ? "s" : ""}</span></a></li>`).join("");

    const sections = themes.map((t) => `<section class="theme" id="${htmlEsc("theme-" + (t.id || "autres"))}">`
      + `<h3>${htmlEsc(nomTheme(t))}</h3><ul>${t.items.map(ligne).join("")}</ul></section>`).join("");

    const vide = `<p class="vide">Aucun acte n'est publié pour l'instant.</p>`;
    const derniere = premier.datePublication ? dateLongue(premier.datePublication) : "";
    const stats = [liste.length + (liste.length > 1 ? " actes publiés" : " acte publié"),
      themes.length + (themes.length > 1 ? " thèmes" : " thème"),
      derniere ? "dernière publication le " + derniere : ""].filter(Boolean).join(" · ");

    // LE BULLETIN, s'il est ouvert sur ce recueil : l'accueil en donne l'entrée,
    // parce que c'est la forme sous laquelle beaucoup de lecteurs suivent les
    // actes — un numéro à la fois, à la cadence que la collectivité a choisie.
    // `apercu()` est SYNCHRONE (réglages en cache, bulletins en mémoire) : la
    // page se rend sans attendre, et sans interroger la base.
    const bulApercu = bul ? bul.apercu() : null;
    const derniersBulletins = bulApercu && bulApercu.actif ? bulApercu.bulletins : [];
    const blocBulletins = derniersBulletins.length
      ? `<h2>Derniers bulletins</h2>\n<ul class="bul-list">${derniersBulletins.map((b) => `<li class="bul-item"><a class="bul-item__t" href="${htmlEsc(adresseBulletin(base, b.id))}">${htmlEsc(b.titre)}</a><span class="bul-item__m">${htmlEsc(intervalleTexte(b.debut, b.fin) + " · " + b.nombre + (b.nombre > 1 ? " actes" : " acte"))}</span></li>`).join("")}</ul>\n<p class="petit"><a href="${htmlEsc(adresseBulletins(base))}">Tous les bulletins</a>${bulApercu.cadence ? " — parution " + htmlEsc(bulApercu.cadence.resume) : ""} · <a href="${htmlEsc(adresseFlux(base, "rss"))}">flux RSS</a> · <a href="${htmlEsc(adresseFlux(base, "atom"))}">Atom</a></p>\n`
      : "";

    return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEsc(titre)}${collectivite ? " — " + htmlEsc(collectivite) : ""}</title>
<meta name="description" content="${htmlEsc([titre, collectivite, liste.length + " acte(s) publié(s)", themes.map(nomTheme).join(", ")].filter(Boolean).join(" · "))}">
<link rel="canonical" href="${htmlEsc(adresseRecueil(base))}">
<link rel="alternate" type="application/json" href="${htmlEsc(base + "/recueil.json")}" title="Index des actes (JSON)">
<link rel="alternate" type="text/markdown" href="${htmlEsc(base + "/llms.txt")}" title="Recueil pour les agents (llms.txt)">
${derniersBulletins.length ? `<link rel="alternate" type="application/rss+xml" href="${htmlEsc(adresseFlux(base, "rss"))}" title="${htmlEsc(bulApercu.titre)}">\n` : ""}<style>${CSS_RECUEIL}</style></head><body>
<header class="hdr"><div class="hdr__in"><span class="hdr__org">${htmlEsc(collectivite)}</span><span class="hdr__titre">${htmlEsc(titre)}</span></div></header>
<main>
${liste.length ? `<section class="hero">
<h1>${htmlEsc(titre)}</h1>
<p>Les actes administratifs publiés${collectivite ? " par " + htmlEsc(collectivite) : ""}, classés par thème : retrouvez les arrêtés, délibérations et décisions qui vous intéressent, et lisez leur texte en ligne.</p>
<p class="stats">${htmlEsc(stats)}</p>
</section>
${epingles.length ? `<h2>À la une</h2>\n<ul class="piste piste--une">${epingles.map(carte).join("")}</ul>\n` : ""}<h2>Derniers actes administratifs publiés</h2>
<ul class="piste">${dernieres.map(carte).join("")}</ul>
${blocBulletins}
<h2>Parcourir par thème</h2>
<ul class="tuiles">${grille}</ul>
<h2>Tous les actes publiés</h2>
${sections}` : vide}
<p class="donnees">Données publiques :
<a href="${htmlEsc(base + "/recueil.json")}">recueil.json</a>
<a href="${htmlEsc(base + "/llms.txt")}">llms.txt</a>
<a href="${htmlEsc(base + "/sitemap.xml")}">sitemap.xml</a>
${derniersBulletins.length ? `<a href="${htmlEsc(adresseBulletins(base))}">bulletins</a>\n<a href="${htmlEsc(adresseFlux(base, "rss"))}">bulletins.rss</a>\n` : ""}Chaque acte est aussi disponible en <code>.json</code>, <code>.md</code>, <code>.txt</code> et <code>.akn</code>.</p>
</main></body></html>`;
  }

  function robotsTxt(base) {
    return [
      "# Recueil des actes administratifs — parcours libre.",
      "# Les actes publiés sont publics : ils peuvent être indexés et cités.",
      "User-agent: *",
      "Allow: /",
      "Disallow: /v1/",
      "",
      "# Pour les assistants : le recueil est aussi décrit en Markdown.",
      "# llms.txt : " + base + "/llms.txt",
      "# Index des actes : " + base + "/recueil.json",
      "# Bulletins et flux : " + base + "/recueil/bulletins, " + base + "/recueil/bulletins.rss",
      "",
      "Sitemap: " + base + "/sitemap.xml",
      "",
    ].join("\n");
  }

  // llms.txt : la convention qui présente un site aux agents. Le sommaire en
  // Markdown, une ligne par acte, avec ses métadonnées et son adresse.
  function llmsTxt(base, agent) {
    const liste = publicationsTriees(agent);
    const premier = liste[0] || {};
    const titre = premier.recueil || "Recueil des actes administratifs";
    const annees = new Map();
    for (const p of liste) {
      const annee = (String(p.datePublication || p.dateDocument || "").slice(0, 4)) || "Sans date";
      if (!annees.has(annee)) annees.set(annee, []);
      annees.get(annee).push(p);
    }
    const lignes = [
      `# ${titre}${premier.brandName ? " — " + premier.brandName : ""}`,
      "",
      `> ${liste.length} acte${liste.length > 1 ? "s" : ""} administratif${liste.length > 1 ? "s" : ""} publié${liste.length > 1 ? "s" : ""}${premier.brandName ? " par " + premier.brandName : ""}, avec leur identifiant ELI, leurs dates et leur texte intégral. Chaque acte est une donnée publique : il est ici en HTML, JSON, Markdown, texte brut et Akoma Ntoso.`,
      "",
      "Les actes sont rangés par année de publication, du plus récent au plus ancien. Une même décision peut avoir plusieurs versions publiées sous le même identifiant ELI : seule la plus récente est en vigueur.",
      "",
      "Chaque acte relève d'un THÈME — la matière dont il traite (urbanisme, police administrative, finances, marchés publics…) : c'est par elle que le recueil public les présente.",
      "",
      "## Données",
      "",
      `- [Index complet des actes](${base}/recueil.json) : métadonnées, liens et formats de chaque acte.`,
      `- [Plan du site](${base}/sitemap.xml) : une adresse par acte.`,
      `- [Recueil des actes](${adresseRecueil(base)}) : la liste, en HTML.`,
      "",
      "## Actes publiés",
      "",
    ];
    if (!liste.length) lignes.push("Aucun acte n'est publié pour l'instant.");
    for (const [annee, actes] of annees) {
      lignes.push(`### ${annee}`, "");
      for (const p of actes) {
        const d = [p.entityName, p.datePublication ? "publié le " + dateLongue(p.datePublication) : "",
          p.juridique === false ? "document non opposable" : p.dateOpposabilite ? "en vigueur le " + dateLongue(p.dateOpposabilite) : "",
          p.epingle === true ? "à la une" : "",
          dernierVisible(p.eliUri, agent) === p ? "" : "version antérieure"].filter(Boolean).join(" · ");
        lignes.push(`- [${[p.numero, p.objet].filter(Boolean).join(" — ")}](${adresseActe(base, p.cle)}) : ${d}.${p.themeLabel ? " Thème : " + p.themeLabel + "." : ""} ELI : \`${p.eliUri || "—"}\`. Formats : [JSON](${adresseFormat(base, p.cle, "json")}), [Markdown](${adresseFormat(base, p.cle, "md")}), [texte](${adresseFormat(base, p.cle, "txt")}).`);
      }
      lignes.push("");
    }
    // LE BULLETIN, quand il est ouvert : c'est le même recueil, mais rassemblé
    // par période. Un agent qui suit l'actualité d'une collectivité suit le
    // bulletin ; on le lui donne donc ici, avec son flux.
    const apercuBul = bul ? bul.apercu() : null;
    if (apercuBul && apercuBul.actif) {
      lignes.push("## Bulletins", "");
      lignes.push(`Le recueil rassemble aussi ses actes en un BULLETIN, à parution ${apercuBul.cadence ? (apercuBul.cadence.resume || apercuBul.cadence.label) : "périodique"} : chaque numéro couvre une période, et classe les actes par entité puis par thématique.`, "");
      lignes.push(`- [Bulletins parus](${adresseBulletins(base)}) : un numéro par période, en HTML.`, "");
      lignes.push(`- [Flux RSS](${adresseFlux(base, "rss")}) et [Atom](${adresseFlux(base, "atom")}) : une entrée par numéro.`, "");
      const nums = bul.liste().filter((b) => !b.provisoire);
      for (const b of nums.slice(0, 20)) lignes.push(`- [${b.titre}](${adresseBulletin(base, b.id)}) : ${intervalleTexte(b.debut, b.fin)}, ${b.nombre} acte${b.nombre > 1 ? "s" : ""}. Formats : [JSON](${adresseBulletin(base, b.id)}.json), [Markdown](${adresseBulletin(base, b.id)}.md), [texte](${adresseBulletin(base, b.id)}.txt).`);
      if (nums.length > 20) lignes.push(`- … et ${nums.length - 20} autre(s) numéro(s), à l'adresse des bulletins.`);
      lignes.push("");
    }
    lignes.push("Toute réutilisation est libre sous réserve du droit applicable aux documents administratifs.", "");
    return lignes.join("\n");
  }

  function sitemapXml(base, agent) {
    const urls = [{ loc: adresseRecueil(base), lastmod: "" }].concat(publicationsTriees(agent).map((p) => ({
      loc: adresseActe(base, p.cle),
      lastmod: String(p.publieeLe || p.datePublication || "").slice(0, 10),
    })));
    // LES BULLETINS PARUS sont des documents du recueil à part entière : une
    // adresse par numéro, au plan du site comme les actes.
    const apercuBul = bul ? bul.apercu() : null;
    if (apercuBul && apercuBul.actif) {
      urls.push({ loc: adresseBulletins(base), lastmod: "" });
      for (const b of bul.liste()) urls.push({ loc: adresseBulletin(base, b.id), lastmod: String(b.composeLe || "").slice(0, 10) });
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${htmlEsc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`;
  }

  // Une représentation d'un acte, avec son type de contenu exact. C'est ce que
  // lit un agent : du texte, du JSON ou du XML, jamais une page à déchiffrer.
  const REPRESENTATIONS = {
    json: (p, base) => [JSON_PUBLIC, JSON.stringify(jsonDeActe(p, base), null, 2)],
    md: (p) => [MARKDOWN, markdownDe(p)],
    txt: (p) => [TEXTE, texteDe(p) + "\n"],
    markdown: (p) => [MARKDOWN, markdownDe(p)],
    akn: (p) => [{ "content-type": "application/akn+xml; charset=utf-8", "cache-control": "public, max-age=600" }, formatsDe(p).akn || ""],
    xml: (p) => [{ "content-type": "application/akn+xml; charset=utf-8", "cache-control": "public, max-age=600" }, formatsDe(p).akn || ""],
    html: (p, base) => [HTML_PUBLIC, pageActe(p, base)],
  };

  // L'IDENTIFIANT ELI COMME ADRESSE : /eli/<code>/<annee>/<numero>/<entite>.
  // L'identifiant désigne l'acte ; cette adresse est donc l'acte, dans
  // l'instance — et elle ne change pas quand l'adresse de sa page change. On
  // redirige vers la page du recueil, où le lecteur trouve le texte, l'original
  // signé et les autres versions publiées sous le même identifiant.
  function hEliAdresse(ctx) {
    const base = origine(ctx.headers);
    const eliUri = eliKey(ctx.params);
    const p = dernierVisible(eliUri, ctx.agent);
    if (!p) {
      const message = "Le recueil ne connaît pas l'identifiant ELI " + eliUri + ".";
      return ok(404, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Identifiant ELI inconnu</title><meta name="robots" content="noindex"><link rel="canonical" href="${htmlEsc(adresseRecueil(base))}"></head><body><h1>Identifiant ELI inconnu</h1><p>${htmlEsc(message)}</p><p><a href="${htmlEsc(adresseRecueil(base))}">Retour au recueil des actes</a></p></body></html>`, HTML_PUBLIC);
    }
    return ok(302, "", { location: adresseActe(base, p.cle) });
  }

  // =============================================================== le BULLETIN
  // Le Bulletin — le Journal des actes administratifs — se sert d'ICI, avec le
  // recueil : même page, même feuille de style, même origine. Un lecteur qui
  // suit les actes par numéro lit le même HTML que celui qui découvre le
  // recueil, sans JavaScript ; et un abonné qui ouvre le lien d'un courriel
  // tombe sur ces pages.
  //
  //   /recueil/bulletins                        le sommaire, et l'abonnement
  //   /recueil/bulletins.rss  (et .atom)        le flux des numéros parus
  //   /recueil/bulletins/<id>                   un numéro : entités → thèmes
  //   /recueil/bulletins/<id>.<json|md|txt>     ses représentations
  //   /recueil/bulletins/abonnement             (POST) la demande d'abonnement
  //   /recueil/bulletins/confirmation?jeton=…   le lien du courriel d'abonnement
  //   /recueil/bulletins/desabonnement?jeton=…  le désabonnement, en deux temps
  //
  // Un Bulletin ÉTEINT n'existe pas : ces adresses rendent 404, comme si le
  // module n'avait jamais été branché. C'est un réglage de la collectivité, pas
  // une panne — et un recueil sans bulletin ne doit pas annoncer une rubrique
  // vide. Le formulaire d'abonnement, lui, poste sur une adresse du SITE (et non
  // sur l'API) : il fonctionne donc sans JavaScript, et la réponse est une page.
  const BULLETIN_ABSENT = "Le bulletin des actes n'est pas ouvert sur ce recueil.";

  // Le titre du recueil et le nom de la collectivité, comme en tête de l'accueil :
  // ils viennent des publications, qui les portent.
  function enteteRecueil() {
    const premier = publicationsTriees(false)[0] || {};
    return { titre: premier.recueil || "Recueil des actes administratifs", collectivite: premier.brandName || "" };
  }

  // L'ossature d'une page du Bulletin : la même que le recueil, à ceci près
  // qu'elle n'est jamais indexée en double — chaque page porte son adresse
  // canonique.
  function ossature(base, { titre, sous = "", corps, canonique = "" }) {
    const c = enteteRecueil();
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEsc(titre)}${c.collectivite ? " — " + htmlEsc(c.collectivite) : ""}</title>
<link rel="canonical" href="${htmlEsc(canonique || adresseBulletins(base))}">
<link rel="alternate" type="application/rss+xml" href="${htmlEsc(adresseFlux(base, "rss"))}" title="${htmlEsc(titre)}">
<style>${CSS_RECUEIL}</style></head><body>
<header class="hdr"><div class="hdr__in"><span class="hdr__org">${htmlEsc(c.collectivite)}</span><a class="hdr__titre" href="${htmlEsc(adresseRecueil(base))}" style="color:inherit;text-decoration:none">${htmlEsc(c.titre)}</a></div></header>
<main>
<section class="hero"><h1>${htmlEsc(titre)}</h1>${sous ? "<p>" + sous + "</p>" : ""}</section>
${corps}
</main></body></html>`;
  }

  function pageBulletin404(base, message) {
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bulletin introuvable</title><meta name="robots" content="noindex">
<link rel="canonical" href="${htmlEsc(adresseRecueil(base))}">
<style>${CSS_RECUEIL}</style></head><body>
<header class="hdr"><div class="hdr__in"><span class="hdr__titre">Bulletin introuvable</span></div></header>
<main><section class="hero"><h1>Bulletin introuvable</h1><p>${htmlEsc(message)}</p>
<p class="sommaire"><a href="${htmlEsc(adresseRecueil(base))}">Le recueil des actes</a></p></section></main></body></html>`;
  }

  // Les réglages EFFECTIFS du bulletin, ou null s'il est éteint (ou absent). On
  // les relit à chaque page : un réglage changé dans l'administration se voit
  // donc tout de suite, sans redémarrer le service. La lecture qui suit recharge
  // aussi l'aperçu synchrone de l'accueil (`apercu`) dans le même mouvement.
  async function bulletinReglages() {
    if (!bul) return null;
    try { const r = await bul.lireReglages(); return r && r.actif ? r : null; } catch (e) { return null; }
  }

  // Le sommaire des numéros parus, et l'abonnement.
  async function pageBulletins(base) {
    const etatB = await bul.publicEtat();
    const nums = (etatB.bulletins || []).filter((b) => b.provisoire !== true);
    const liste = nums.length
      ? `<ul class="bul-list">${nums.map((b) => `<li class="bul-item"><a class="bul-item__t" href="${htmlEsc(adresseBulletin(base, b.id))}">${htmlEsc(b.titre)}</a>`
        + `<span class="bul-item__m">${htmlEsc([intervalleTexte(b.debut, b.fin), b.nombre + (b.nombre > 1 ? " actes" : " acte"), (b.entites || []).map((e) => e.nom).slice(0, 4).join(", ")].filter(Boolean).join(" · "))}</span>`
        + `<span class="f">${["json", "md", "txt"].map((x) => `<a href="${htmlEsc(adresseBulletin(base, b.id) + "." + x)}">${x}</a>`).join(" ")}</span></li>`).join("")}</ul>`
      : `<p class="vide">Aucun bulletin n'a encore paru. Le premier paraîtra à la clôture de la période en cours.</p>`;
    const cadence = etatB.cadence ? `Le recueil rassemble ses actes en un bulletin ${htmlEsc(etatB.cadence.resume || etatB.cadence.label)}.` : "";
    const prochaine = etatB.prochaine ? `Prochaine parution : ${htmlEsc(etatB.prochaine.libelle)}${etatB.prochaine.parution ? ", le " + htmlEsc(dateLongue(etatB.prochaine.parution)) : ""}.` : "";
    const abon = etatB.abonnement
      ? `<section class="abon" id="abonnement">
<h2>Recevoir le bulletin par courriel</h2>
<p>L'abonnement est gratuit. Chaque numéro vous est adressé le jour de sa parution, et vous pouvez vous désabonner d'un seul clic, depuis n'importe quel message.</p>
<form method="post" action="${htmlEsc(base + "/recueil/bulletins/abonnement")}">
<label for="courriel">Votre adresse électronique</label>
<input type="email" id="courriel" name="courriel" required autocomplete="email" placeholder="prenom.nom@exemple.fr">
<label for="nom">Votre nom (facultatif)</label>
<input type="text" id="nom" name="nom" autocomplete="name">
<button type="submit">Demander l'abonnement</button>
</form>
<p class="petit">Un courriel de confirmation vous sera adressé : l'abonnement ne prend effet qu'une fois le lien qu'il contient ouvert. Votre adresse ne sert qu'à l'envoi du bulletin et n'est transmise à personne.</p>
</section>`
      : `<section class="abon"><h2>Recevoir le bulletin par courriel</h2><p>${htmlEsc(etatB.motifAbonnement || "L'abonnement par courriel n'est pas ouvert sur ce recueil.")}</p></section>`;
    return ossature(base, {
      titre: etatB.titre,
      sous: [cadence, prochaine].filter(Boolean).join(" "),
      corps: `${abon}
<h2>Bulletins parus</h2>
${liste}
<p class="petit" style="margin-top:16px">Suivre le bulletin : <a href="${htmlEsc(adresseFlux(base, "rss"))}">flux RSS</a> · <a href="${htmlEsc(adresseFlux(base, "atom"))}">Atom</a>.</p>
<p class="donnees">Un bulletin rassemble les actes publiés sur sa période, classés par entité puis par thématique.
<a href="${htmlEsc(adresseRecueil(base))}">Le recueil des actes</a></p>`,
    });
  }

  // Un numéro, dans son classement : les ENTITÉS, puis leurs THÉMATIQUES, puis
  // les actes — l'ordre de lecture d'un journal officiel.
  function pageBulletin(b, base) {
    const sections = (b.entites || []).map((e) => `<section class="bul__ent"><h2>${htmlEsc(e.nom)}</h2>`
      + e.themes.map((t) => `<h3>${htmlEsc(t.label)}</h3><ul>${t.actes.map((a) => `<li class="acte">`
        + `<a class="acte__objet" href="${htmlEsc(adresseActe(base, a.cle))}">${htmlEsc([a.numero, a.objet].filter(Boolean).join(" — ") || a.cle)}</a>`
        + `<span class="acte__m">${htmlEsc([a.datePublication ? "publié le " + dateLongue(a.datePublication) : "", a.juridique === false ? "document non opposable" : a.dateOpposabilite ? "en vigueur le " + dateLongue(a.dateOpposabilite) : "", a.remplacee ? "version consolidée" : "", a.eliUri].filter(Boolean).join(" · "))}</span>`
        + `<span class="f">${["json", "md", "txt"].map((x) => `<a href="${htmlEsc(adresseFormat(base, a.cle, x))}">${x}</a>`).join(" ")}</span></li>`).join("")}</ul>`).join(""))
      .join("");
    const sous = htmlEsc(intervalleTexte(b.debut, b.fin) + " · " + b.nombre + (b.nombre > 1 ? " actes" : " acte"));
    return ossature(base, {
      titre: b.titre,
      canonique: adresseBulletin(base, b.id),
      sous: b.sousTitre ? sous + "<br>" + htmlEsc(b.sousTitre) : sous,
      corps: `${sections || `<p class="vide">Aucun acte n'a été publié sur cette période.</p>`}
<p class="sommaire" style="margin-top:24px">Ce bulletin en données : ${["json", "md", "txt"].map((x) => `<a href="${htmlEsc(adresseBulletin(base, b.id) + "." + x)}">${x}</a>`).join(" ")}</p>
<p class="donnees">Un bulletin rassemble les actes publiés sur sa période, classés par entité puis par thématique.
<a href="${htmlEsc(adresseBulletins(base))}">Tous les bulletins</a> · <a href="${htmlEsc(adresseFlux(base, "rss"))}">flux RSS</a> · <a href="${htmlEsc(adresseRecueil(base))}">le recueil</a></p>`,
    });
  }

  // Le résultat d'une demande d'abonnement, d'une confirmation, d'un
  // désabonnement : une page, jamais du JSON — c'est un lecteur qui l'a demandé,
  // depuis un formulaire ou depuis un courriel.
  function pageAbonnement(base, res) {
    const bon = !!(res && res.ok);
    const message = (res && (res.message || res.motif)) || "";
    return ossature(base, {
      titre: bon ? "Abonnement enregistré" : "L'abonnement n'a pas pu être enregistré",
      corps: `<section class="abon"><p class="${bon ? "ok" : "ko"}">${htmlEsc(message)}</p>
<p><a href="${htmlEsc(bon ? adresseBulletins(base) : adresseBulletins(base) + "#abonnement")}">${bon ? "Voir les bulletins parus" : "Revenir au formulaire"}</a></p></section>`,
    });
  }

  function pageConfirmation(base, res) {
    const bon = !!(res && res.ok);
    return ossature(base, {
      titre: bon ? "Abonnement confirmé" : "Lien de confirmation invalide",
      corps: bon
        ? `<section class="abon"><p class="ok">Votre abonnement au bulletin est confirmé${res.abonne && res.abonne.courriel ? " pour " + htmlEsc(res.abonne.courriel) : ""} : vous recevrez chaque numéro par courriel, à sa parution.</p>
<p class="petit">Vous pouvez vous désabonner à tout moment — le lien figure au bas de chaque message.</p>
<p><a href="${htmlEsc(adresseBulletins(base))}">Voir les bulletins parus</a></p></section>`
        : `<section class="abon"><p class="ko">${htmlEsc((res && res.motif) || "Ce lien n'est plus valable.")}</p>
<p><a href="${htmlEsc(adresseBulletins(base))}">Retour aux bulletins</a></p></section>`,
    });
  }

  // Le désabonnement se fait en DEUX temps : le lien du courriel montre une page,
  // et c'est un second geste qui retire l'abonné. Un courriel ne se désabonne
  // donc pas par le seul fait d'être ouvert ou scanné.
  function pageDesabonnementDemande(base, jeton) {
    const suite = adresseBulletins(base) + "/desabonnement?jeton=" + encodeURIComponent(String(jeton || "")) + "&confirmer=1";
    return ossature(base, {
      titre: "Se désabonner du bulletin",
      corps: `<section class="abon">
<p>Vous êtes sur le point de ne plus recevoir le bulletin par courriel.</p>
<p><a href="${htmlEsc(suite)}" style="display:inline-block;background:var(--brand);color:#fff;padding:9px 14px;border-radius:4px;text-decoration:none;font-weight:600">Confirmer le désabonnement</a></p>
<p class="petit">Rien n'est changé tant que vous n'avez pas confirmé : si vous fermez cette page, vous continuerez à recevoir le bulletin.</p></section>`,
    });
  }

  function pageDesabonnementResultat(base, res) {
    const bon = !!(res && res.ok);
    return ossature(base, {
      titre: bon ? "Désabonnement enregistré" : "Lien de désabonnement invalide",
      corps: bon
        ? `<section class="abon"><p class="ok">Vous ne recevrez plus le bulletin par courriel.</p>
<p class="petit">Aucune autre donnée n'a été modifiée, et les bulletins parus restent lisibles ici comme par le flux.</p>
<p><a href="${htmlEsc(adresseBulletins(base))}">Voir les bulletins parus</a></p></section>`
        : `<section class="abon"><p class="ko">${htmlEsc((res && res.motif) || "Ce lien n'est plus valable.")}</p>
<p><a href="${htmlEsc(adresseBulletins(base))}">Retour aux bulletins</a></p></section>`,
    });
  }

  // ------------------------------------------------------------------ routage
  const TEXTE_FLUX = (mode) => ({ "content-type": (mode === "atom" ? "application/atom+xml" : "application/rss+xml") + "; charset=utf-8", "cache-control": "public, max-age=600" });

  async function hBulletins(ctx) {
    const base = origine(ctx.headers);
    if (!(await bulletinReglages())) return ok(404, pageBulletin404(base, BULLETIN_ABSENT), HTML_PUBLIC);
    return ok(200, await pageBulletins(base), HTML_PUBLIC);
  }

  async function hBulletinFlux(ctx) {
    const base = origine(ctx.headers);
    if (!(await bulletinReglages())) return ok(404, BULLETIN_ABSENT, TEXTE);
    const mode = String(ctx.params.id || "rss").toLowerCase() === "atom" ? "atom" : "rss";
    return ok(200, await bul.flux({ base, mode }), TEXTE_FLUX(mode));
  }

  async function hBulletin(ctx) {
    const base = origine(ctx.headers);
    if (!(await bulletinReglages())) return ok(404, pageBulletin404(base, BULLETIN_ABSENT), HTML_PUBLIC);
    let id = decodeURIComponent(String(ctx.params.id || ""));
    let ext = "html";
    const point = id.lastIndexOf(".");
    if (point > 0 && ["json", "md", "txt", "markdown"].includes(id.slice(point + 1).toLowerCase())) {
      ext = id.slice(point + 1).toLowerCase();
      id = id.slice(0, point);
    }
    const b = bul.lire(id);
    // Un bulletin PROVISOIRE (la période en cours) n'a pas d'adresse publique : il
    // n'existe qu'au tableau de bord, où l'administration le relit avant parution.
    if (!b || b.provisoire) {
      const message = "Le bulletin demandé n'existe pas : " + id;
      return ext === "html" ? ok(404, pageBulletin404(base, message), HTML_PUBLIC) : err(404, message, { code: "bulletin_inconnu" });
    }
    if (ext === "json") return ok(200, JSON.stringify(bul.jsonBulletin(b, { base }), null, 2), JSON_PUBLIC);
    if (ext === "md" || ext === "markdown") return ok(200, bul.markdownBulletin(b), MARKDOWN);
    if (ext === "txt") return ok(200, bul.texteBulletin(b, { base }), TEXTE);
    return ok(200, pageBulletin(b, base), HTML_PUBLIC);
  }

  async function hAbonnementBulletins(ctx) {
    const base = origine(ctx.headers);
    if (!(await bulletinReglages())) return ok(404, pageBulletin404(base, BULLETIN_ABSENT), HTML_PUBLIC);
    const corps = ctx.body && typeof ctx.body === "object" ? ctx.body : {};
    const res = await bul.abonner({ courriel: corps.courriel || corps.email || "", nom: corps.nom || "", ip: ctx.ip || "", source: "recueil" });
    return ok(200, pageAbonnement(base, res), HTML_PUBLIC);
  }

  async function hConfirmationBulletin(ctx) {
    const base = origine(ctx.headers);
    if (!(await bulletinReglages())) return ok(404, pageBulletin404(base, BULLETIN_ABSENT), HTML_PUBLIC);
    return ok(200, pageConfirmation(base, await bul.confirmer(String((ctx.query && ctx.query.jeton) || ""))), HTML_PUBLIC);
  }

  async function hDesabonnementBulletin(ctx) {
    const base = origine(ctx.headers);
    if (!(await bulletinReglages())) return ok(404, pageBulletin404(base, BULLETIN_ABSENT), HTML_PUBLIC);
    const jeton = String((ctx.query && ctx.query.jeton) || "");
    if (String((ctx.query && ctx.query.confirmer) || "") !== "1") return ok(200, pageDesabonnementDemande(base, jeton), HTML_PUBLIC);
    return ok(200, pageDesabonnementResultat(base, await bul.desabonner(jeton)), HTML_PUBLIC);
  }

  // /recueil/<clé> et /recueil/<clé>.<ext>
  function hActePublic(ctx) {
    const base = origine(ctx.headers);
    let cle = String(ctx.params.cle || "");
    let ext = "html";
    const point = cle.lastIndexOf(".");
    if (point > 0 && Object.prototype.hasOwnProperty.call(REPRESENTATIONS, cle.slice(point + 1).toLowerCase())) {
      ext = cle.slice(point + 1).toLowerCase();
      cle = cle.slice(0, point);
    }
    cle = decodeURIComponent(cle);
    const p = lirePublication(cle);
    // Une publication RÉSERVÉE AUX AGENTS ne se lit pas sans session : pour un
    // visiteur anonyme, elle n'existe pas — et on ne dit pas qu'elle existe.
    if (!p || !visiblePour(p, ctx.agent)) {
      const message = "Acte publié inconnu : " + cle;
      return ext === "html"
        ? ok(404, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Acte introuvable</title><meta name="robots" content="noindex"><link rel="canonical" href="${htmlEsc(adresseRecueil(base))}"></head><body><h1>Acte introuvable</h1><p>${htmlEsc(message)}</p><p><a href="${htmlEsc(adresseRecueil(base))}">Retour au recueil des actes</a></p></body></html>`, HTML_PUBLIC)
        : err(404, message, { code: "publication_inconnue" });
    }
    const [entetes, corps] = REPRESENTATIONS[ext](p, base);
    return ok(200, corps, entetes);
  }

  // ---------------------------------------------------- remise à zéro du service
  // Le pendant côté SERVICE du bouton « Repartir d'un référentiel vierge » (voir
  // src/ui/views/referentiel.js). Le recueil public lit le service : vider le
  // seul navigateur laisserait les publications de démonstration en ligne. La
  // purge vide actes déposés, circuits de signature et publications — et exige un
  // mot de confirmation explicite, pour qu'un appel accidentel ne l'emporte pas.
  function hPurger(ctx) {
    const corps = ctx.body && typeof ctx.body === "object" ? ctx.body : {};
    if (String(corps.confirmation || "") !== "repurge") {
      return err(400, "Confirmation absente : envoyer {\"confirmation\": \"repurge\"}.", { code: "confirmation_absente" });
    }
    const avant = { actes: Object.keys(db.actes).length, signatures: Object.keys(db.signatures).length, publies: Object.keys(db.publies).length };
    db.actes = {};
    db.signatures = {};
    db.publies = {};
    db.idem = {};
    db.seq = 0;
    // LES BULLETINS PARTENT AUSSI : ils rassemblent des publications qui
    // n'existent plus, et leurs abonnés recevraient des numéros d'un référentiel
    // effacé. La remise à zéro est donc complète, ou elle n'est pas.
    if (bul && typeof bul.reinitialiser === "function") bul.reinitialiser();
    persist();
    return ok(200, { purge: true, avant });
  }

  // ======================================================== clés d'API et journal
  // LES CLÉS D'API de l'administration — des COMPTES DE SERVICE : un
  // administrateur en crée une depuis l'interface, lui donne un rôle, et la
  // remet à un script, un poste, un outil tiers. Elles n'existent QUE pour
  // l'API : ce ne sont pas des comptes du référentiel, elles n'apparaissent donc
  // nulle part dans « Comptes et rôles », ni dans les listes de personnes, ni
  // dans l'annuaire. Le service n'en conserve que l'empreinte SHA-256 — jamais
  // la valeur, qui ne circule que du poste vers le service.
  //
  // Elles s'ajoutent aux jetons du DÉPLOIEMENT (`API_TOKENS`), que le serveur
  // HTTP connaît déjà : celles-ci se gèrent à chaud, sans toucher au `.env`.
  // Voir `cleDeJeton`, appelée par server.mjs pour l'autorisation.
  const ROLES_CLE = ["administrateur", "editeur", "redacteur", "lecteur", "prestataire"];

  function cles() { db.cles = db.cles || {}; return db.cles; }

  // L'identité portée par un jeton, ou null : on compare les EMPREINTES, jamais
  // les valeurs. C'est la seule porte par laquelle une clé d'API entre.
  function cleDeJeton(jeton) {
    const h = sha256(String(jeton || ""));
    const table = cles();
    for (const id of Object.keys(table)) {
      const c = table[id];
      if (c && c.hash === h) return { id, role: c.role, label: c.label || "" };
    }
    return null;
  }

  function nouvelleCleId() {
    return "CLE-" + String(Date.now()).slice(-6) + "-" + String(Math.floor(Math.random() * 46636)).padStart(3, "0");
  }

  // LE JOURNAL D'AUDIT DU SERVICE : chaque geste sensible y laisse une ligne, et
  // chaque ligne scelle la précédente par son empreinte — modifier une ligne
  // rompt la chaîne, ce que `scelle` révèle à la relecture. C'est la piste
  // d'audit OPPOSABLE : elle ne dépend pas du bon vouloir du poste qui a agi.
  function journaliser(geste, detail) {
    db.journal = db.journal || [];
    const precedent = db.journal.length ? db.journal[db.journal.length - 1].sceau : "";
    const e = { n: db.journal.length + 1, le: nowIso(), geste: String(geste || "").slice(0, 60), detail: String(detail || "").slice(0, 400) };
    e.sceau = sha256([precedent, e.n, e.le, e.geste, e.detail].join("|"));
    db.journal.push(e);
    if (db.journal.length > 2000) db.journal.splice(0, db.journal.length - 2000);
    return e;
  }
  function journalScelle(j) {
    let precedent = "";
    for (const e of j || []) {
      if (e.sceau !== sha256([precedent, e.n, e.le, e.geste, e.detail].join("|"))) return false;
      precedent = e.sceau;
    }
    return true;
  }

  // ÉTAT PUBLIC de l'autorisation : le client apprend s'il doit proposer de
  // provisionner le service, sans rien apprendre des clés elles-mêmes.
  function hEtatAuth() {
    // Un service dont l'administration se fait par SESSION (mode « mot de
    // passe » ou annuaire) est déjà administré : il n'y a rien à « provisionner »,
    // et l'écran montre la gestion des clés plutôt que le geste d'installation.
    const parSession = authMode === "password" || authMode === "oidc";
    return ok(200, { provisionne: parSession || Object.keys(cles()).length > 0, roles: ROLES_CLE, mode: parSession ? "session" : "service" });
  }

  // PROVISIONNEMENT : le tout premier dépôt de clé, quand le service n'en a
  // aucune — le geste d'installation, en mode « demo » surtout (en mode
  // « mot de passe », l'administration se fait par la session). La clé est
  // tirée par le client : le service n'en voit jamais la valeur.
  function hBootstrap(ctx) {
    const table = cles();
    if (Object.keys(table).length) {
      return err(409, "Ce service est déjà provisionné : le provisionnement initial ne s'exécute qu'une fois.", { code: "service_deja_provisionne" });
    }
    const b = ctx.body || {};
    const jeton = String(b.cle || b.token || "");
    if (jeton.length < 32) return err(422, "La clé doit compter au moins 32 caractères (tirez-la au hasard).", { code: "cle_trop_courte" });
    const role = ROLES_CLE.includes(b.role) && b.role !== "prestataire" ? b.role : "administrateur";
    const id = nouvelleCleId();
    table[id] = { hash: sha256(jeton), role, label: String(b.label || "Administrateur").slice(0, 80), creeLe: nowIso() };
    journaliser("provisionnement", "Service provisionné (clé « " + table[id].label + " », rôle " + role + ").");
    if (!persist()) { delete table[id]; return err(507, "Le service n'a plus de place disponible."); }
    return ok(201, { id, role, label: table[id].label, creeLe: table[id].creeLe });
  }

  // La liste des clés — identifiant, libellé, rôle, date : jamais la valeur,
  // jamais l'empreinte.
  function hListeCles() {
    const table = cles();
    return ok(200, {
      provisionne: Object.keys(table).length > 0,
      cles: Object.keys(table).map((id) => ({ id, role: table[id].role, label: table[id].label || "", creeLe: table[id].creeLe })),
    });
  }

  // Créer une clé : c'est le geste de l'administrateur qui dote un script, un
  // poste ou un outil d'un compte de service. Le rôle est choisi exprès — une
  // clé de lecture ne doit pas pouvoir publier.
  function hCreerCle(ctx) {
    const table = cles();
    const b = ctx.body || {};
    const jeton = String(b.cle || b.token || "");
    if (jeton.length < 32) return err(422, "La clé doit compter au moins 32 caractères.", { code: "cle_trop_courte" });
    const role = ROLES_CLE.includes(b.role) ? b.role : "lecteur";
    const id = nouvelleCleId();
    table[id] = { hash: sha256(jeton), role, label: String(b.label || "").slice(0, 80), creeLe: nowIso() };
    journaliser("cle_creee", "Clé « " + (table[id].label || id) + " » créée (rôle " + role + ").");
    if (!persist()) { delete table[id]; return err(507, "Le service n'a plus de place disponible."); }
    return ok(201, { id, role, label: table[id].label, creeLe: table[id].creeLe });
  }

  // Révoquer une clé. On refuse de révoquer la DERNIÈRE clé d'administration :
  // le service se retrouverait sans moyen d'être administré.
  function hRevoquerCle(ctx) {
    const table = cles();
    const id = String(ctx.params.id || "");
    if (!table[id]) return err(404, "Clé inconnue : " + id, { code: "cle_inconnue" });
    const admins = Object.keys(table).filter((k) => table[k].role === "administrateur");
    if (table[id].role === "administrateur" && admins.length <= 1) {
      return err(409, "Impossible de révoquer la dernière clé d'administration : le service se retrouverait sans administrateur.", { code: "derniere_cle_admin" });
    }
    const label = table[id].label || id;
    delete table[id];
    journaliser("cle_revoquee", "Clé « " + label + " » révoquée.");
    persist();
    return ok(200, { id, revoquee: true });
  }

  function hJournal(ctx) {
    const j = (db.journal || []).slice();
    const limite = Math.max(1, Math.min(2000, Number(ctx.body && ctx.body.limite) || 200));
    return ok(200, { entrees: j.slice(-limite), total: j.length, scelle: journalScelle(j), algorithme: "SHA-256 (chaîne)" });
  }

  const ROUTES = [
    { m: "GET", p: /^\/v1\/health$/, f: hSante, tag: "service" },
    { m: "GET", p: /^\/v1\/?$/, f: () => ok(200, openapi()), tag: "service" },
    // --- clés d'API et journal du service (comptes de service de l'API) -------
    // `/v1/auth/etat` est PUBLIC (le client doit savoir s'il doit provisionner) ;
    // le reste est réservé à l'administration.
    { m: "GET", p: /^\/v1\/auth\/etat$/, f: hEtatAuth },
    { m: "POST", p: /^\/v1\/auth\/bootstrap$/, ecrit: true, f: hBootstrap },
    { m: "GET", p: /^\/v1\/auth\/cles$/, role: { min: "administrateur" }, f: hListeCles },
    { m: "POST", p: /^\/v1\/auth\/cles$/, role: { min: "administrateur" }, ecrit: true, f: hCreerCle },
    { m: "POST", p: /^\/v1\/auth\/cles\/([^/]+)\/revoquer$/, role: { min: "administrateur" }, ecrit: true, f: hRevoquerCle },
    { m: "GET", p: /^\/v1\/journal$/, role: { min: "administrateur" }, f: hJournal },
    // Les actes DÉPOSÉS ne sont pas publics : la publication l'est (voir
    // /v1/publications), le dépôt non — il porte les actes individuels
    // (sanctions, revalorisations), les circuits en cours et leurs empreintes.
    // Une clé de LECTURE suffit pour les consulter ; c'était une lecture
    // anonyme, et c'était un défaut.
    { m: "GET", p: /^\/v1\/actes$/, role: { min: "lecteur" }, f: () => ok(200, { actes: Object.keys(db.actes).map((k) => resumeActe(db.actes[k])).sort((a, b) => String(b.deposeLe).localeCompare(String(a.deposeLe))) }) },
    { m: "POST", p: /^\/v1\/actes$/, role: { min: "redacteur" }, ecrit: true, f: hDeposerActe },
    { m: "GET", p: /^\/v1\/actes\/([^/]+)$/, role: { min: "lecteur" }, f: (ctx) => { const a = lireActe(ctx.params.id); return a ? ok(200, resumeActe(a)) : err(404, "Acte déposé inconnu : " + ctx.params.id); } },
    { m: "GET", p: /^\/v1\/actes\/([^/]+)\/document$/, role: { min: "lecteur" }, f: (ctx) => { const a = lireActe(ctx.params.id); return a ? ok(200, { id: a.id, format: "application/akn+xml", document: a.akn, sha256: a.sha256 }) : err(404, "Acte déposé inconnu : " + ctx.params.id); } },
    { m: "POST", p: /^\/v1\/actes\/([^/]+)\/signature$/, role: { min: "redacteur" }, ecrit: true, f: hEnvoyerEnSignature },
    { m: "POST", p: /^\/v1\/actes\/([^/]+)\/transmission$/, role: { min: "redacteur" }, ecrit: true, f: hTransmettre },
    { m: "GET", p: /^\/v1\/actes\/([^/]+)\/transmission$/, role: { min: "lecteur" }, f: (ctx) => { const a = lireActe(ctx.params.id); if (!a) return err(404, "Acte déposé inconnu : " + ctx.params.id); return a.transmission ? ok(200, { acteId: a.id, numero: a.numero, controleLegalite: a.controleLegalite === true, ...a.transmission }) : err(404, "Aucune transmission enregistrée pour cet acte.", { code: "transmission_absente" }); } },
    // Le DOSSIER INTERNE de la signature : la part de l'original qui ne se
    // diffuse pas. Elle n'est servie que sur un acte déposé — donc derrière une
    // session (mode « mot de passe ») ou un jeton (mode « demo ») — et jamais par
    // une route publique du recueil.
    { m: "GET", p: /^\/v1\/actes\/([^/]+)\/dossier-signature$/, role: { min: "administrateur" }, f: (ctx) => {
        const a = lireActe(ctx.params.id);
        if (!a) return err(404, "Acte déposé inconnu : " + ctx.params.id);
        const dossier = a.originalInterne || null;
        if (!dossier) return err(404, "Aucun dossier de signature interne pour cet acte.", { code: "dossier_absent" });
        return ok(200, { acteId: a.id, numero: a.numero, dossier });
      } },
    { m: "POST", p: /^\/v1\/actes\/([^/]+)\/publication$/, role: { min: "redacteur" }, ecrit: true, f: hPublier },
    { m: "GET", p: /^\/v1\/signatures$/, role: { min: "lecteur" }, f: () => ok(200, { signatures: Object.keys(db.signatures).map((k) => resumeSignature(db.signatures[k])).sort((a, b) => String(b.creeLe).localeCompare(String(a.creeLe))) }) },
    // Le document signé est servi SANS sa part interne : c'est une lecture de
    // l'original, pas du dossier de signature (voir /dossier-signature).
    { m: "GET", p: /^\/v1\/signatures\/([^/]+)\/document-signe$/, role: { min: "lecteur" }, f: (ctx) => { const s = lireSignature(ctx.params.id); return s && s.documentSigne ? ok(200, { signatureId: s.id, acteId: s.acteId, documentSigne: sansInterne(s.documentSigne) }) : err(404, "Aucun document signé pour ce circuit : " + ctx.params.id); } },
    { m: "GET", p: /^\/v1\/signatures\/([^/]+)$/, role: { min: "lecteur" }, f: (ctx) => { const s = lireSignature(ctx.params.id); return s ? ok(200, resumeSignature(s)) : err(404, "Circuit de signature inconnu : " + ctx.params.id); } },
    // La notification du prestataire n'est PAS publique : elle était ouverte, et
    // un tiers pouvait donc faire signer un acte au nom de qui il voulait (le
    // seul contrôle était l'empreinte du document — publique). Elle exige une
    // clé dédiée au PRESTATAIRE (`API_TOKENS="prestataire|prestataire:<hash>"`),
    // ou la clé d'administration.
    { m: "POST", p: /^\/v1\/webhooks\/signature$/, role: { exact: ["prestataire", "administrateur"] }, ecrit: true, f: hWebhookSignature },
    { m: "POST", p: /^\/v1\/admin\/purge$/, role: { min: "administrateur" }, ecrit: true, f: hPurger },
    { m: "GET", p: /^\/v1\/publications$/, f: (ctx) => {
        const all = Object.keys(db.publies).map((k) => db.publies[k]).filter((p) => visiblePour(p, ctx.agent));
        const latestKeys = new Set(all.map((p) => dernierVisible(p.eliUri, ctx.agent)).filter(Boolean).map((p) => p.cle));
        return ok(200, { publications: all.map((p) => resumePublication(p, latestKeys.has(p.cle))).sort((a, b) => String(b.publieeLe).localeCompare(String(a.publieeLe))) });
      } },
    { m: "POST", p: /^\/v1\/publications\/([^/]+)\/epingle$/, role: { min: "editeur" }, ecrit: true, f: hEpinglerPublication },
    { m: "GET", p: /^\/v1\/publications\/([^/]+)$/, f: (ctx) => {
        const cle = decodeURIComponent(ctx.params.cle);
        const p = lirePublication(cle);
        // Une publication réservée aux agents n'existe pas, pour un visiteur
        // anonyme : même réponse qu'une clé inconnue, et on ne dit rien de plus.
        if (!p || !visiblePour(p, ctx.agent)) return err(404, "Publication inconnue : " + cle, { code: "publication_inconnue" });
        const versions = versionsVisibles(p.eliUri, ctx.agent).map((x) => resumePublication(x, dernierVisible(x.eliUri, ctx.agent) === x));
        // Le dossier interne ne sort JAMAIS par cette route : c'est une lecture
        // de la publication, côté public comme côté agent, et il n'en fait pas
        // partie. Il se lit par /v1/actes/{id}/dossier-signature.
        const { originalInterne, ...pub } = p;
        return ok(200, { ...pub, latest: dernierVisible(p.eliUri, ctx.agent) === p, versions });
      } },
    { m: "GET", p: /^\/v1\/eli\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/original$/, f: (ctx) => {
        const eliUri = eliKey(ctx.params);
        const p = dernierVisible(eliUri, ctx.agent);
        return p ? ok(200, { eli: eliUri, cle: p.cle, original: p.original, signature: p.signature }) : err(404, "ELI inconnu : " + eliUri);
      } },
    { m: "GET", p: /^\/v1\/eli\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/, f: hResoudreEli },
    // --- le recueil ouvert (hors /v1/ : ce sont les adresses du site) ---------
    { m: "GET", p: /^\/robots\.txt$/, f: (ctx) => ok(200, robotsTxt(origine(ctx.headers)), TEXTE) },
    { m: "GET", p: /^\/llms\.txt$/, f: (ctx) => ok(200, llmsTxt(origine(ctx.headers), ctx.agent), MARKDOWN) },
    { m: "GET", p: /^\/sitemap\.xml$/, f: (ctx) => ok(200, sitemapXml(origine(ctx.headers), ctx.agent), XML) },
    { m: "GET", p: /^\/recueil\.json$/, f: (ctx) => ok(200, JSON.stringify(indexRecueil(origine(ctx.headers), ctx.agent), null, 2), JSON_PUBLIC) },
    { m: "GET", p: /^\/recueil\/?$/, f: (ctx) => ok(200, pageRecueil(origine(ctx.headers), ctx.agent), HTML_PUBLIC) },
    // --- le BULLETIN (voir bulletins.mjs, injecté par le service) -------------
    // Ces adresses viennent AVANT `/recueil/(.+)`, qui les avalerait : leur ordre
    // est la seule chose qui les protège. Le sommaire et le flux d'abord, puis
    // les gestes d'abonnement, puis un numéro — et enfin l'acte publié.
    { m: "GET", p: /^\/recueil\/bulletins\.(rss|atom)$/, f: hBulletinFlux },
    { m: "GET", p: /^\/recueil\/bulletins\/confirmation$/, f: hConfirmationBulletin },
    { m: "GET", p: /^\/recueil\/bulletins\/desabonnement$/, f: hDesabonnementBulletin },
    { m: "POST", p: /^\/recueil\/bulletins\/abonnement$/, ecrit: true, f: hAbonnementBulletins },
    { m: "GET", p: /^\/recueil\/bulletins\/abonnement$/, f: (ctx) => ok(302, "", { location: adresseBulletins(origine(ctx.headers)) + "#abonnement" }) },
    { m: "GET", p: /^\/recueil\/bulletins\/?$/, f: hBulletins },
    { m: "GET", p: /^\/recueil\/bulletins\/([^/]+)$/, f: hBulletin },
    { m: "GET", p: /^\/recueil\/(.+)$/, f: hActePublic },
    // L'identifiant ELI comme adresse (le lien que porte un acte publié, et
    // qu'un lecteur peut recopier) : voir `hEliAdresse`.
    { m: "GET", p: /^\/eli\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/?$/, f: hEliAdresse },
  ];

  // `ctx` : { authorize(headers) → null | {status, body, code}, rate(req) → bool }
  function route(req, ctx = {}) {
    const method = String(req.method || "GET").toUpperCase();
    const path = String(req.path || "/");
    const q = path.indexOf("?");
    const clean = q >= 0 ? path.slice(0, q) : path;
    // Les paramètres de l'adresse : les pages du Bulletin s'en servent — le jeton
    // du courriel de confirmation, le « confirmer » du désabonnement.
    const query = {};
    if (q >= 0) for (const [k, v] of new URLSearchParams(path.slice(q + 1))) query[k] = v;
    const headers = req.headers || {};

    let cheminTrouve = false;
    for (const r of ROUTES) {
      const m = r.p.exec(clean);
      if (!m) continue;
      cheminTrouve = true;
      // Un moteur commence souvent par HEAD : on répond comme à un GET, sans
      // corps (le serveur HTTP s'en charge).
      if (r.m !== method && !(r.m === "GET" && method === "HEAD")) continue;
      // `role` dit le rôle minimal (« lecteur »…« administrateur »), ou une
      // liste exacte (le prestataire de signature). `auth: "jeton"` reste
      // accepté pour compatibilité et vaut « au moins rédacteur ».
      if ((r.auth === "jeton" || r.role) && typeof ctx.authorize === "function") {
        const bad = ctx.authorize(headers, r.role || { min: "redacteur" });
        if (bad) return bad;
      }
      if (r.ecrit && typeof ctx.rate === "function" && ctx.rate(req)) {
        return err(429, "Trop de requêtes d'écriture : ralentissez (limite : 90 par minute).", { code: "trop_de_requetes" }, { "retry-after": "60" });
      }
      const params = { 0: m[0] };
      if (m[1] !== undefined) { params.id = m[1]; params.cle = m[1]; }
      if (m[2] !== undefined) { params.code = m[1]; params.annee = m[2]; params.numero = m[3]; params.entite = m[4]; }
      return r.f({ params, body: req.body, headers, conn: req.conn, path: clean, query, ip: req.ip, agent: ctx.agent === true });
    }
    return cheminTrouve
      ? err(405, "Méthode " + method + " non autorisée sur " + clean, { code: "methode_non_autorisee" })
      : null;   // hors du domaine de ce module (le serveur décide : 404 ou autre route)
  }

  // État à écrire après la requête (null s'il n'y a rien à faire).
  const takeDirty = () => { const d = dirty; dirty = null; return d; };

  // L'identité d'une CLÉ d'API (un compte de service), pour l'autorisation du
  // serveur HTTP : c'est par cette fonction que les clés créées dans
  // l'administration ouvrent les routes (voir server.mjs). `null` si le jeton
  // n'est pas une clé connue — ce n'est pas une erreur, seulement « pas une clé ».
  const cleDeJetonOuNull = (jeton) => { try { return cleDeJeton(jeton); } catch (e) { return null; } };

  return { route, takeDirty, openapi, emptyState, cleDeJeton: cleDeJetonOuNull, publicationsPubliques };
}
