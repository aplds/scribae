// ============================================================================
// LES PROFILS DE CHARGE — qui fait quoi devant le service.
//
// POURQUOI CE MODULE EST SÉPARÉ. Ce que le service reçoit dépend entièrement de
// ce que l'application lui demande : un visiteur anonyme qui lit le recueil ne
// coûte pas la même chose qu'un rédacteur qui enregistre un acte, et qu'un
// administrateur qui rouvre le référentiel. Modeler ces gestes À PART, dans un
// module PUR (aucune horloge, aucun réseau, aucun aléa non injecté), permet de
// les relire, de les corriger et de les ÉPROUVER — c'est la partie du test de
// charge qui doit dire la vérité sur le trafic réel.
//
// D'OÙ VIENNENT CES GESTES. Ils sont recopiés du comportement de l'application
// (`src/lib/db/`, `src/lib/collab.js`, `src/ui/state.js`) :
//   • à l'ouverture d'une session, le poste lit le référentiel, les trames, les
//     actes, les comptes et les informations — un `GET` par collection ;
//   • un BATTEMENT DE CŒUR toutes les 25 secondes réécrit la présence du poste
//     (lecture puis écriture — `ecrirePresence`, collab.mjs) ;
//   • un SONDAGE toutes les 30 secondes relit la présence et le journal ;
//   • chaque geste qui compte (enregistrer, soumettre, signer) écrit le journal ;
//   • les visiteurs, eux, ne font que LIRE le recueil et ses formats ouverts.
//
// CE QUI N'Y EST PAS. Ni le rendu (c'est le navigateur), ni le PDF/A, ni les
// appels au prestataire de signature : ce sont des coûts du poste ou de tiers,
// pas du service. Le test de charge dit ce que le SERVEUR reçoit et ce qu'il en
// fait.
// ============================================================================

// ------------------------------------------------------------------ aléa semé
// Un tirage REPRODUCTIBLE : deux exécutions de mêmes graines rejouent le même
// trafic. Sans cela, deux mesures ne se comparent pas.
export function mulberry32(graine) {
  let a = graine >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const choisir = (liste, alea) => (liste && liste.length ? liste[Math.floor(alea() * liste.length) % liste.length] : null);

// Un tirage pondéré sur les étapes d'un profil.
export function tirerEtapes(etapes, alea) {
  const total = etapes.reduce((s, e) => s + (e.poids === undefined ? 1 : e.poids), 0);
  if (total <= 0) return null;
  let n = alea() * total;
  for (const e of etapes) {
    n -= e.poids === undefined ? 1 : e.poids;
    if (n <= 0) return e;
  }
  return etapes[etapes.length - 1];
}

// Un temps de PENSÉE : le délai entre deux gestes d'un agent. Une loi
// exponentielle de moyenne `moyenneMs` (le cas le plus courant en file
// d'attente) : beaucoup de gestes rapprochés, quelques pauses longues.
export const penser = (moyenneMs, alea) => (moyenneMs <= 0 ? 0 : -Math.log(1 - alea() * 0.98) * moyenneMs);

// ----------------------------------------------------------------- les étapes
// Une étape décrit une requête : `construire` la fabrique pour un poste donné
// (elle peut rendre `null` — l'étape est alors sautée faute de matière), et
// `apres` range ce que la réponse apprend (une clé de publication, une
// révision). Le moteur ne connaît que ce contrat.
export const etape = (nom, construire, apres = null, poids = 1) => ({ nom, construire, apres, poids });

const sync = (upserts, deletes = []) => ({ upserts, deletes });

// Les collections telles que le contrat de persistance les nomme (voir
// src/lib/db/contract.js). L'application les lit une par une au démarrage.
const COLLECTION = (nom) => etape(
  "collections/" + nom,
  (a) => ({ method: "GET", chemin: "/v1/db/collections/" + nom }),
  (a, res) => {
    // Le poste apprend les RÉVISIONS des enregistrements : c'est ce qu'il
    // renvoie en écrivant (contrôle de concurrence).
    if (!res || !res.json || !Array.isArray(res.json.records)) return;
    a.memoire.collections = a.memoire.collections || {};
    a.memoire.collections[nom] = res.json.records.map((r) => ({ id: r.id, rev: r.rev, ord: r.ord, payload: r.payload }));
  },
);

// La lecture d'une collection, dans la variante « avec matière » : les actes et
// les trames servent ensuite à préparer une écriture réaliste.
const collectionAvecMatiere = (nom, cle, min = 1) => etape(
  "collections/" + nom,
  (a, ctx) => {
    if (!ctx[cle] || ctx[cle].length < min) return null;
    return { method: "GET", chemin: "/v1/db/collections/" + nom };
  },
  (a, res, ctx) => {
    if (!res || !res.json || !Array.isArray(res.json.records)) return;
    ctx[cle] = res.json.records
      .filter((r) => r && r.payload && typeof r.payload === "object")
      .map((r) => ({ id: r.id, rev: r.rev, ord: r.ord, payload: r.payload }));
    a.memoire.collections = a.memoire.collections || {};
    a.memoire.collections[nom] = ctx[cle].map((r) => ({ id: r.id, rev: r.rev, ord: r.ord }));
  },
);

// --- le visiteur anonyme : la lecture du recueil ouvert ---------------------
export const etapesPublic = (ctx) => [
  etape("public/recueil", () => ({ method: "GET", chemin: "/recueil" }), null, 35),
  etape("public/acte", (a, c) => {
    const p = choisir(c.publications, a.alea);
    return p && p.cle ? { method: "GET", chemin: "/recueil/" + encodeURIComponent(p.cle) } : null;
  }),
  etape("public/recueil.json", () => ({ method: "GET", chemin: "/recueil.json" }), null, 5),
  etape("public/publications", () => ({ method: "GET", chemin: "/v1/publications" }), null, 10),
  etape("public/publication", (a, c) => {
    const p = choisir(c.publications, a.alea);
    return p && p.cle ? { method: "GET", chemin: "/v1/publications/" + encodeURIComponent(p.cle) } : null;
  }, null, 10),
  etape("public/informations", () => ({ method: "GET", chemin: "/v1/informations" }), null, 5),
  etape("public/eli", (a, c) => (c.elis && c.elis.length ? { method: "GET", chemin: c.elis[Math.floor(a.alea() * c.elis.length) % c.elis.length] } : null), null, 5),
  etape("public/sitemap", () => ({ method: "GET", chemin: "/sitemap.xml" }), null, 2),
  etape("public/llms", () => ({ method: "GET", chemin: "/llms.txt" }), null, 2),
  etape("public/sante", () => ({ method: "GET", chemin: "/v1/health" }), null, 1),
];

// --- l'agent connecté : ce que l'application demande ------------------------
// Chaque rôle reçoit les gestes qui lui sont ouverts — un rédacteur n'ouvre pas
// le référentiel, un administrateur le rouvre et gère les comptes.
export function etapesAgent(role, { ecriture = "aucune" } = {}) {
  const lit = [
    etape("agent/session", () => ({ method: "GET", chemin: "/v1/auth/session" }), null, 4),
    COLLECTION("informations"),
    etape("collections/config", () => ({ method: "GET", chemin: "/v1/db/collections/config" }), null, 8),
    collectionAvecMatiere("actes", "actes", 1),
    collectionAvecMatiere("trames", "trames", 1),
    etape("agent/depot", () => ({ method: "GET", chemin: "/v1/actes" }), null, 5),
    etape("agent/publications", () => ({ method: "GET", chemin: "/v1/publications" }), null, 6),
  ];
  const journal = role === "administrateur"
    ? [etape("agent/service-journal", () => ({ method: "GET", chemin: "/v1/journal" }), null, 3),
      etape("agent/comptes", () => ({ method: "GET", chemin: "/v1/auth/comptes" }), null, 2)]
    : [];
  // Les ÉCRITURES de l'agent : elles portent sur SES actes (un par poste), avec
  // la révision qu'il vient de lire — c'est exactement ce que fait
  // `saveActes` côté navigateur, qui n'envoie que les enregistrements changés.
  const ecrit = [];
  if (ecriture === "pleine") {
    ecrit.push(etape("agent/sync-acte", (a, c) => {
      const acte = a.memoire.acte || choisir(c.actes, a.alea);
      if (!acte) return null;
      const payload = { ...acte.payload, objet: String(acte.payload.objet || "Acte") + " — mention de charge " + a.index };
      return { method: "POST", chemin: "/v1/db/collections/actes/sync", corps: sync([{ id: acte.id, rev: acte.rev, ord: acte.ord || 0, payload }]) };
    }, (a, res) => {
      const applique = res && res.json && Array.isArray(res.json.applied) ? res.json.applied[0] : null;
      if (applique && a.memoire.acte) a.memoire.acte = { ...a.memoire.acte, rev: applique.rev };
    }, 3));
    ecrit.push(etape("agent/journal", (a) => ({
      method: "POST",
      chemin: "/v1/db/collections/journal/sync",
      corps: sync([{
        id: "j-charge-" + a.index + "-" + (a.memoire.n = (a.memoire.n || 0) + 1),
        rev: null,
        ord: 0,
        payload: {
          id: "j-charge-" + a.index + "-" + a.memoire.n,
          at: new Date().toISOString(),
          action: "modification",
          cible: "charge",
          detail: "Geste simulé par le test de charge",
          by: a.userId || "",
          byName: a.nom || "",
        },
      }]),
    }), null, 2));
  }
  if (role === "editeur" && ecriture === "pleine") {
    ecrit.push(etape("agent/sync-informations", (a, c) => {
      const info = choisir(c.informations, a.alea);
      if (!info) return null;
      return { method: "POST", chemin: "/v1/db/collections/informations/sync", corps: sync([{ id: info.id, rev: info.rev, ord: info.ord || 0, payload: { ...info.payload, majLe: new Date().toISOString() } }]) };
    }, null, 2));
  }
  if (role === "administrateur" && ecriture === "pleine") {
    ecrit.push(etape("agent/sync-config", (a, c) => {
      const self = (c.config || []).find((r) => r.id === "self");
      if (!self) return null;
      return { method: "POST", chemin: "/v1/db/collections/config/sync", corps: sync([{ id: "self", rev: self.rev, ord: 0, payload: self.payload }]) };
    }, null, 1));
  }
  return [...lit, ...journal, ...ecrit].filter(Boolean);
}

// --- le FOND : le trafic que le poste émet sans que personne ne le touche ----
// C'est lui qui grossit avec le nombre d'agents, et c'est lui qu'on oublie
// souvent de compter : une présence toutes les 25 s, un sondage toutes les 30 s,
// par poste ouvert.
export const fondAgent = () => [
  {
    nom: "fond/battement",
    periodeMs: 25000,
    etapes: [
      etape("fond/presence-lue", () => ({ method: "GET", chemin: "/v1/db/collections/presence" }), (a, res) => {
        const moi = (res && res.json && res.json.records || []).find((r) => r.id === a.userId);
        a.memoire.presence = moi ? { rev: moi.rev, ord: moi.ord } : null;
      }),
      etape("fond/presence-ecrite", (a) => {
        if (a.ecriture === "aucune") return null;
        return {
          method: "POST",
          chemin: "/v1/db/collections/presence/sync",
          corps: sync([{
            id: a.userId,
            rev: a.memoire.presence ? a.memoire.presence.rev : null,
            ord: a.memoire.presence ? a.memoire.presence.ord : 0,
            payload: {
              id: a.userId, userId: a.userId, byName: a.nom, role: a.role,
              at: new Date().toISOString(), acteId: "", acteLabel: "", ecran: a.memoire.ecran || "charge",
            },
          }]),
        };
      }, (a, res) => {
        const applique = res && res.json && Array.isArray(res.json.applied) ? res.json.applied[0] : null;
        if (applique) a.memoire.presence = { rev: applique.rev, ord: 0 };
      }),
    ],
  },
  {
    nom: "fond/sondage",
    periodeMs: 30000,
    etapes: [
      etape("fond/sondage-presence", () => ({ method: "GET", chemin: "/v1/db/collections/presence" })),
      etape("fond/sondage-journal", () => ({ method: "GET", chemin: "/v1/db/collections/journal" })),
    ],
  },
];

// ------------------------------------------------------------------ les profils
export const PROFILS = [
  {
    id: "public",
    libelle: "Visiteur du recueil (sans compte)",
    role: null,
    session: false,
    etapes: etapesPublic,
    fond: () => [],
  },
  {
    id: "lecteur",
    libelle: "Lecteur (consulte le registre)",
    role: "lecteur",
    session: true,
    etapes: (ctx, o) => etapesAgent("lecteur", o),
    fond: fondAgent,
  },
  {
    id: "redacteur",
    libelle: "Rédacteur (enregistre ses actes)",
    role: "redacteur",
    session: true,
    etapes: (ctx, o) => etapesAgent("redacteur", o),
    fond: fondAgent,
  },
  {
    id: "editeur",
    libelle: "Éditeur (trames et rédaction)",
    role: "editeur",
    session: true,
    etapes: (ctx, o) => etapesAgent("editeur", o),
    fond: fondAgent,
  },
  {
    id: "reviseur",
    libelle: "Réviseur (contrôle avant signature)",
    role: "reviseur",
    session: true,
    etapes: (ctx, o) => etapesAgent("redacteur", o),
    fond: fondAgent,
  },
  {
    id: "signataire",
    libelle: "Signataire (signe au titre de sa délégation)",
    role: "signataire",
    session: true,
    etapes: (ctx, o) => etapesAgent("redacteur", o),
    fond: fondAgent,
  },
  {
    id: "administrateur",
    libelle: "Administrateur (référentiel, comptes)",
    role: "administrateur",
    session: true,
    etapes: (ctx, o) => etapesAgent("administrateur", o),
    fond: fondAgent,
  },
];

export const profilParId = (id) => PROFILS.find((p) => p.id === id) || null;

// « public=40,redacteur=6,administrateur=2 » → un plan de charge.
// Les profils sans effectif ne pèsent rien ; l'ordre suit la liste des profils.
export function planDepuisSpec(spec) {
  const plan = [];
  for (const morceau of String(spec || "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const [id, n] = morceau.split("=").map((s) => s.trim());
    const profil = profilParId(id);
    if (!profil) throw new Error(`Profil inconnu : « ${id} » (connus : ${PROFILS.map((p) => p.id).join(", ")})`);
    const effectif = Number(n === undefined ? 1 : n);
    if (!Number.isFinite(effectif) || effectif < 0) throw new Error(`Effectif invalide pour « ${id} » : ${n}`);
    if (effectif > 0) plan.push({ profil, effectif });
  }
  return plan;
}

export const effectifTotal = (plan) => plan.reduce((s, p) => s + p.effectif, 0);

export const profilsSansSession = (plan) => plan.filter((p) => !p.profil.session);
export const profilsAvecSession = (plan) => plan.filter((p) => p.profil.session);
