// ============================================================================
// Bulletins — la cadence, la composition, les abonnés, les envois, les flux.
//
// Ces épreuves tiennent la règle du bulletin, et rien d'autre :
//
//   1. une période ne contient QUE ses publications ;
//   2. pas de publication, pas de bulletin ;
//   3. un acte publié deux fois dans la période n'y figure qu'une fois ;
//   4. les actes sont classés par entité, puis par thématique ;
//   5. un bulletin paraît quand sa période est close, et c'est alors qu'il part
//      par courriel — une seule fois — aux abonnés CONFIRMÉS ;
//   6. le désabonnement retire les courriels encore en file.
//
// Tout est éprouvé avec une horloge figée et un faux `save` : aucune base, aucun
// réseau, aucun courriel réel.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  CADENCES, createBulletins, decaler, dateParution, debutUnite, distanceUnites,
  enIso, etatBulletinsVide, intervalleTexte, libelleCadence, libellePeriode,
  normaliserCadence, periodeDe, periodePrecedente, periodeSuivante,
} from "./bulletins.mjs";

// ------------------------------------------------------------------ outils
const sha256 = (s) => {
  // Une empreinte déterministe et courte : ces épreuves n'éprouvent pas SHA-256
  // (il vient de Node), seulement la stabilité des jetons.
  let h = 2166136261;
  const t = String(s);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0").repeat(8).slice(0, 64);
};

let compteur = 0;
const alea = (n = 8) => "g" + (++compteur).toString(36).padStart(n, "0");

function banc({ reglages = {}, publications = [], courriel = null, maintenant = "2026-09-20T08:00:00.000Z", options = {} } = {}) {
  const etat = etatBulletinsVide();
  const ecrits = [];
  const journalCourriel = [];
  let now = () => maintenant;
  const api = createBulletins({
    state: { bulletins: etat },
    sha256, alea, now: () => now(),
    save: (json) => { ecrits.push(json); return true; },
    reglages: async () => reglages,
    publications: async () => publications,
    courriel,
    tracer: (e) => journalCourriel.push(e),
    baseUrl: "https://actes.exemple.fr",
    journal: () => {},
    ...options,
  });
  return { api, etat, ecrits, journalCourriel, horloge: (iso) => { now = () => iso; } };
}

// Une publication minimale du service.
const pub = (o) => ({
  cle: o.cle || "acte@" + (o.datePublication || "2026-01-01") + "-originale",
  eliUri: o.eliUri || "eli:/fr/dec/2026/0001/ent",
  numero: o.numero || "2026-0001",
  objet: o.objet || "Objet de l'acte",
  nature: o.nature || "decision",
  entityName: o.entityName || "Commune d'Exemple",
  themeId: o.themeId || "urbanisme",
  themeLabel: o.themeLabel || "Urbanisme et voirie",
  dateDocument: o.dateDocument || o.datePublication,
  datePublication: o.datePublication || "2026-01-01",
  dateOpposabilite: o.dateOpposabilite || "2026-01-02",
  kind: o.kind || "originale",
  ...(o.reste || {}),
});

// Un faux service SMTP : il note ce qu'on lui remet, et peut refuser.
function fauxCourriel({ refuse = false } = {}) {
  const envois = [];
  return {
    envois,
    etat: () => ({ disponible: !refuse, configure: true, actif: !refuse, hote: "smtp.exemple.fr", port: 587, expediteur: "actes@exemple.fr", raison: refuse ? "Le serveur SMTP a refusé." : "" }),
    envoyer: async (m) => {
      envois.push(m);
      return refuse ? { envoye: false, raison: "Le serveur SMTP a refusé." } : { envoye: true, destinataires: m.destinataires, detail: "Accepté" };
    },
  };
}

const REGLAGES = {
  actif: true, titre: "Bulletin officiel de la commune", titreBulletin: "Bulletin officiel",
  cadence: { id: "mensuelle" }, parutionJours: 0,
  base: "https://actes.exemple.fr", pied: "Commune d'Exemple",
};

// ======================================================= la cadence et les périodes
test("cadence : les cadences nommées se normalisent en unité et pas", () => {
  assert.deepEqual(
    ["quotidienne", "hebdomadaire", "bimensuelle", "mensuelle", "bimestrielle", "trimestrielle", "semestrielle", "annuelle"].map((id) => {
      const c = normaliserCadence({ id });
      return [c.id, c.unite, c.pas];
    }),
    [
      ["quotidienne", "jour", 1], ["hebdomadaire", "semaine", 1], ["bimensuelle", "demi-mois", 1],
      ["mensuelle", "mois", 1], ["bimestrielle", "mois", 2], ["trimestrielle", "trimestre", 1],
      ["semestrielle", "mois", 6], ["annuelle", "an", 1],
    ],
  );
});

test("cadence : la cadence personnalisée accepte une unité et un pas, refuse le reste", () => {
  const c = normaliserCadence({ id: "personnalisee", unite: "jour", pas: 10 });
  assert.equal(c.unite, "jour");
  assert.equal(c.pas, 10);
  assert.equal(libelleCadence(c), "un bulletin tous les 10 jours");
  assert.equal(normaliserCadence({ id: "personnalisee", unite: "quinzaine", pas: 2 }), null);
  assert.equal(normaliserCadence({ id: "personnalisee", unite: "mois", pas: 0 }), null);
  // Le demi-mois n'a qu'un pas possible : 1→15 puis 16→fin.
  assert.equal(normaliserCadence({ id: "personnalisee", unite: "demi-mois", pas: 2 }), null);
  assert.equal(normaliserCadence({ id: "personnalisee", unite: "demi-mois", pas: 1 }).pas, 1);
  assert.equal(normaliserCadence("inconnue"), null);
});

test("périodes : la période mensuelle est le mois civil, et elle s'enchaîne", () => {
  const c = { id: "mensuelle" };
  const p = periodeDe("2026-09-17", c);
  assert.deepEqual(p, { debut: "2026-09-01", fin: "2026-09-30" });
  assert.deepEqual(periodeSuivante(p, c), { debut: "2026-10-01", fin: "2026-10-31" });
  assert.deepEqual(periodePrecedente(p, c), { debut: "2026-08-01", fin: "2026-08-31" });
  // Février d'une année bissextile, et passage d'année.
  assert.deepEqual(periodeDe("2028-02-10", c), { debut: "2028-02-01", fin: "2028-02-29" });
  assert.deepEqual(periodeSuivante({ debut: "2026-12-01", fin: "2026-12-31" }, c), { debut: "2027-01-01", fin: "2027-01-31" });
});

test("périodes : la semaine commence le lundi", () => {
  const c = { id: "hebdomadaire" };
  assert.deepEqual(periodeDe("2026-09-17", c), { debut: "2026-09-14", fin: "2026-09-20" });
  assert.deepEqual(periodeDe("2026-09-20", c), { debut: "2026-09-14", fin: "2026-09-20" });
  assert.deepEqual(periodeDe("2026-09-21", c), { debut: "2026-09-21", fin: "2026-09-27" });
});

test("périodes : la bimensuelle découpe le mois en deux, sans trou ni recouvrement", () => {
  const c = { id: "bimensuelle" };
  assert.deepEqual(periodeDe("2026-09-03", c), { debut: "2026-09-01", fin: "2026-09-15" });
  assert.deepEqual(periodeDe("2026-09-16", c), { debut: "2026-09-16", fin: "2026-09-30" });
  assert.deepEqual(periodeSuivante({ debut: "2026-09-16", fin: "2026-09-30" }, c), { debut: "2026-10-01", fin: "2026-10-15" });
  assert.deepEqual(periodePrecedente({ debut: "2026-10-01", fin: "2026-10-15" }, c), { debut: "2026-09-16", fin: "2026-09-30" });
  assert.deepEqual(periodeDe("2026-02-16", c), { debut: "2026-02-16", fin: "2026-02-28" });
});

test("périodes : quotidienne, trimestrielle, annuelle, et une période de plusieurs jours", () => {
  assert.deepEqual(periodeDe("2026-09-17", { id: "quotidienne" }), { debut: "2026-09-17", fin: "2026-09-17" });
  assert.deepEqual(periodeDe("2026-09-17", { id: "trimestrielle" }), { debut: "2026-07-01", fin: "2026-09-30" });
  assert.deepEqual(periodeDe("2026-09-17", { id: "annuelle" }), { debut: "2026-01-01", fin: "2026-12-31" });
  assert.deepEqual(periodeDe("2026-09-17", { id: "personnalisee", unite: "jour", pas: 10 }), { debut: "2026-09-17", fin: "2026-09-26" });
  assert.deepEqual(periodeDe("2026-09-21", { id: "personnalisee", unite: "jour", pas: 10 }), { debut: "2026-09-21", fin: "2026-09-30" });
});

test("périodes : l'ancrage fixe la découpe des cadences longues", () => {
  const c = { id: "personnalisee", unite: "mois", pas: 2, ancre: "2026-01-01" };
  assert.deepEqual(periodeDe("2026-03-10", c), { debut: "2026-03-01", fin: "2026-04-30" });
  assert.deepEqual(periodeDe("2026-02-10", c), { debut: "2026-01-01", fin: "2026-02-28" });
  const c2 = { id: "personnalisee", unite: "mois", pas: 2, ancre: "2026-02-01" };
  assert.deepEqual(periodeDe("2026-03-10", c2), { debut: "2026-02-01", fin: "2026-03-31" });
  // Sans ancrage, la découpe part de la date examinée : c'est ce qui rend la
  // cadence stable une fois qu'une date de mise en service est enregistrée.
  assert.deepEqual(periodeDe("2026-09-17", { id: "personnalisee", unite: "mois", pas: 3 }), { debut: "2026-09-01", fin: "2026-11-30" });
});

test("dates : les outils de base tiennent leurs bornes", () => {
  assert.equal(debutUnite("2026-09-17", "semaine"), "2026-09-14");
  assert.equal(distanceUnites("demi-mois", "2026-09-16", "2026-10-01"), 1);
  assert.equal(distanceUnites("mois", "2026-01-01", "2027-01-01"), 12);
  assert.equal(decaler("2026-01-31", "mois", 1), "2026-02-28");
  assert.equal(decaler("2026-12-31", "jour", 1), "2027-01-01");
  assert.equal(enIso({ y: 2026, m: 3, d: 7 }), "2026-03-07");
});

test("libellés : la période se lit comme un en-tête de journal", () => {
  assert.equal(intervalleTexte("2026-09-01", "2026-09-30"), "du 1er au 30 septembre 2026");
  assert.equal(intervalleTexte("2026-09-29", "2026-10-05"), "du 29 septembre au 5 octobre 2026");
  assert.equal(intervalleTexte("2026-09-05", "2026-09-05"), "du 5 septembre 2026");
  assert.equal(libellePeriode(periodeDe("2026-09-17", { id: "mensuelle" }), { id: "mensuelle" }), "septembre 2026");
  assert.equal(libellePeriode(periodeDe("2026-09-05", { id: "bimensuelle" }), { id: "bimensuelle" }), "1er–15 septembre 2026");
  assert.equal(libellePeriode(periodeDe("2026-09-17", { id: "bimensuelle" }), { id: "bimensuelle" }), "16–30 septembre 2026");
  assert.equal(libellePeriode(periodeDe("2026-09-17", { id: "trimestrielle" }), { id: "trimestrielle" }), "3e trimestre 2026");
  assert.equal(libellePeriode(periodeDe("2026-09-17", { id: "hebdomadaire" }), { id: "hebdomadaire" }), "semaine du 14 au 20 septembre 2026");
  assert.equal(libellePeriode(periodeDe("2026-09-17", { id: "annuelle" }), { id: "annuelle" }), "2026");
  assert.equal(dateParution({ debut: "2026-09-01", fin: "2026-09-30" }, { parutionJours: 1 }), "2026-10-02");
});

// ======================================================= la composition
test("composition : les actes sont classés par entité, puis par thématique", () => {
  const publications = [
    pub({ datePublication: "2026-09-04", entityName: "Ville", themeLabel: "Finances", cle: "a@1", eliUri: "eli:/fr/dec/2026/0001/v" }),
    pub({ datePublication: "2026-09-02", entityName: "Ville", themeLabel: "Urbanisme et voirie", cle: "a@2", eliUri: "eli:/fr/dec/2026/0002/v" }),
    pub({ datePublication: "2026-09-03", entityName: "Centre communal d'action sociale", themeLabel: "Finances", cle: "a@3", eliUri: "eli:/fr/dec/2026/0003/c" }),
    pub({ datePublication: "2026-09-01", entityName: "Ville", themeLabel: "Finances", cle: "a@4", eliUri: "eli:/fr/dec/2026/0004/v" }),
  ];
  const { api } = banc({ reglages: REGLAGES, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  return api.assurer().then((passe) => {
    const b = api.lire("2026-09-01");
    assert.ok(b, "le bulletin de septembre est composé");
    assert.equal(passe.composees.length, 1);
    assert.equal(b.nombre, 4);
    // Entités : CCAS avant Ville (ordre alphabétique) ; thèmes par libellé ;
    // actes par date de publication.
    assert.deepEqual(b.entites.map((e) => e.nom), ["Centre communal d'action sociale", "Ville"]);
    const ville = b.entites[1];
    assert.deepEqual(ville.themes.map((t) => t.label), ["Finances", "Urbanisme et voirie"]);
    assert.deepEqual(ville.themes[0].actes.map((a) => a.cle), ["a@4", "a@1"]);
    // Le titre porte le rang de l'année et le libellé de la période.
    assert.equal(b.titre, "Bulletin officiel n° 1 — septembre 2026");
  });
});

test("composition : une période sans publication ne donne aucun bulletin", () => {
  const { api, etat } = banc({ reglages: REGLAGES, publications: [], maintenant: "2026-10-05T08:00:00.000Z" });
  etat.depuis = "2026-09-01";
  return api.assurer().then((passe) => {
    assert.deepEqual(passe.composees, []);
    assert.deepEqual(passe.vides, ["2026-09-01"]);
    assert.equal(etat.periodes["2026-09-01"].etat, "vide");
    assert.equal(api.liste().length, 0);
    // La période examinée ne l'est plus : la passe suivante ne la reprend pas.
    return api.assurer();
  }).then((seconde) => {
    assert.deepEqual(seconde.vides, []);
  });
});

test("composition : un acte publié deux fois dans la période n'y figure qu'une fois", () => {
  const publications = [
    pub({ datePublication: "2026-09-03", cle: "a@3", eliUri: "eli:/fr/reg/2026/0009/v", kind: "originale" }),
    pub({ datePublication: "2026-09-21", cle: "b@21", eliUri: "eli:/fr/reg/2026/0009/v", kind: "consolidee" }),
  ];
  const { api } = banc({ reglages: REGLAGES, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  return api.assurer().then(() => {
    const b = api.lire("2026-09-01");
    assert.equal(b.nombre, 1);
    const acte = b.entites[0].themes[0].actes[0];
    assert.equal(acte.kind, "consolidee");
    assert.equal(acte.remplacee, true, "la version précédente est signalée comme remplacée");
  });
});

test("composition : seules les publications de la période entrent dans le bulletin", () => {
  const publications = [
    pub({ datePublication: "2026-08-31", cle: "a@8", eliUri: "eli:/fr/dec/2026/0001/v" }),
    pub({ datePublication: "2026-09-10", cle: "a@9", eliUri: "eli:/fr/dec/2026/0002/v" }),
    pub({ datePublication: "2026-10-01", cle: "a@10", eliUri: "eli:/fr/dec/2026/0003/v" }),
  ];
  const { api } = banc({ reglages: REGLAGES, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  return api.assurer().then(() => {
    const b = api.lire("2026-09-01");
    assert.equal(b.nombre, 1);
    assert.equal(b.entites[0].themes[0].actes[0].cle, "a@9");
  });
});

test("composition : une période en cours ne devient jamais un bulletin définitif", () => {
  const publications = [pub({ datePublication: "2026-09-10" })];
  const { api } = banc({ reglages: REGLAGES, publications, maintenant: "2026-09-20T08:00:00.000Z" });
  return api.assurer().then((passe) => {
    assert.deepEqual(passe.composees, [], "la période en cours n'est pas close");
    // Le geste « paraître aujourd'hui » : composer la période en cours.
    return api.route({ method: "POST", path: "/v1/bulletins/administration/generer", headers: {}, body: { enCours: true } }, { authorize: () => null, rate: () => false });
  }).then((out) => {
    assert.equal(out.status, 201);
    const b = api.lire("2026-09-01");
    assert.equal(b.provisoire, true);
    assert.equal(api.liste().length, 1);
  });
});

test("composition : deux périodes échues donnent deux bulletins numérotés dans l'année", () => {
  const publications = [
    pub({ datePublication: "2026-08-10", cle: "a@8", eliUri: "eli:/fr/dec/2026/0001/v" }),
    pub({ datePublication: "2026-09-10", cle: "a@9", eliUri: "eli:/fr/dec/2026/0002/v" }),
  ];
  const { api, etat } = banc({ reglages: REGLAGES, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  etat.depuis = "2026-08-01";
  return api.assurer().then(() => {
    const liste = api.liste();
    assert.equal(liste.length, 2);
    assert.equal(liste[0].titre, "Bulletin officiel n° 2 — septembre 2026");
    assert.equal(liste[1].titre, "Bulletin officiel n° 1 — août 2026");
  });
});

test("composition : changer de cadence ne réécrit pas les bulletins déjà parus", async () => {
  const publications = [
    pub({ datePublication: "2026-08-10", cle: "a@8", eliUri: "eli:/fr/dec/2026/0001/v" }),
    pub({ datePublication: "2026-09-10", cle: "a@9", eliUri: "eli:/fr/dec/2026/0002/v" }),
  ];
  const mensuel = banc({ reglages: REGLAGES, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  await mensuel.api.assurer();
  assert.equal(mensuel.api.liste().length, 2);
  const empreintes = mensuel.api.liste().map((b) => [b.id, b.titre, b.empreinte]);
  // Le même service passe à l'hebdomadaire : il reprend l'état de la veille.
  const hebdo = banc({ reglages: { ...REGLAGES, cadence: { id: "hebdomadaire" } }, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  Object.assign(hebdo.etat, JSON.parse(JSON.stringify(mensuel.etat)));
  const passe = await hebdo.api.assurer();
  // Les bulletins mensuels sont INTACTS (ce sont des documents parus)…
  for (const [id, titre, empreinte] of empreintes) {
    const b = hebdo.api.lire(id);
    assert.equal(b.titre, titre);
    assert.equal(b.empreinte, empreinte);
  }
  // …et la nouvelle cadence produit ses propres périodes, en plus.
  assert.ok(passe.composees.length > 0, "l'hebdomadaire compose à partir de la mise en service");
  assert.ok(hebdo.api.liste().some((b) => b.cadence === "hebdomadaire"));
  assert.equal(hebdo.etat.cadence, "hebdomadaire");
});

// ======================================================= les abonnés
test("abonnés : l'inscription est confirmée par un lien, et le jeton est stable", async () => {
  const courriel = fauxCourriel();
  const { api, etat } = banc({ reglages: REGLAGES, courriel });
  const r = await api.abonner({ courriel: "citoyen@exemple.fr", nom: "Camille" });
  assert.equal(r.ok, true);
  assert.equal(r.envoye, true);
  assert.equal(courriel.envois.length, 1);
  const fiche = Object.values(etat.abonnes)[0];
  assert.equal(fiche.etat, "attente");
  // Le lien de confirmation figure dans le message, et il porte le jeton dérivé.
  const jeton = api.liensDe(fiche, REGLAGES).confirmation.match(/jeton=([^&]+)/)[1];
  assert.ok(courriel.envois[0].texte.includes(decodeURIComponent(jeton)));
  // Le jeton ne change pas d'un appel à l'autre…
  assert.equal(api.liensDe(fiche, REGLAGES).confirmation, api.liensDe(fiche, REGLAGES).confirmation);
  // …et il ne dépend pas du secret laissé vide : le secret est créé et conservé.
  assert.ok(etat.secret && etat.secret.length >= 32);
  const conf = await api.confirmer(jeton);
  assert.equal(conf.ok, true);
  assert.equal(etat.abonnes[fiche.id].etat, "confirme");
  // Un jeton inconnu est refusé sans rien dire de plus.
  assert.equal((await api.confirmer("inconnu")).status, 404);
});

test("abonnés : une adresse invalide est refusée, une adresse déjà inscrite ne dit rien", async () => {
  const courriel = fauxCourriel();
  const { api, etat } = banc({ reglages: REGLAGES, courriel });
  assert.equal((await api.abonner({ courriel: "pas-une-adresse" })).status, 422);
  await api.abonner({ courriel: "citoyen@exemple.fr" });
  const fiche = Object.values(etat.abonnes)[0];
  assert.equal(fiche.etat, "attente");
  // La seconde demande ne révèle pas que l'adresse est connue : la réponse est
  // la même forme, l'inscription suit son cours.
  const seconde = await api.abonner({ courriel: "CITOYEN@exemple.fr" });
  assert.equal(seconde.ok, true);
  assert.equal(Object.keys(etat.abonnes).length, 1, "une seule fiche par adresse");
});

test("abonnés : sans serveur SMTP, la demande est enregistrée mais l'abonnement reste en attente", async () => {
  const { api, etat } = banc({ reglages: REGLAGES, courriel: null });
  const r = await api.abonner({ courriel: "citoyen@exemple.fr" });
  assert.equal(r.ok, true);
  assert.equal(r.envoye, false);
  assert.match(r.motif, /SMTP/);
  assert.equal(Object.values(etat.abonnes)[0].etat, "attente");
});

test("abonnés : le désabonnement retire aussi les courriels en attente", async () => {
  const courriel = fauxCourriel();
  const publications = [pub({ datePublication: "2026-09-10" })];
  const { api, etat } = banc({ reglages: REGLAGES, courriel, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  await api.abonner({ courriel: "citoyen@exemple.fr" });
  const fiche = Object.values(etat.abonnes)[0];
  await api.confirmer(api.liensDe(fiche, REGLAGES).confirmation.match(/jeton=([^&]+)/)[1]);
  etat.file.push({ bulletin: "2026-09-01", abonne: fiche.id, essais: 0 });
  const desabo = api.liensDe(fiche, REGLAGES).desabonnement.match(/jeton=([^&]+)/)[1];
  const r = await api.desabonner(desabo);
  assert.equal(r.ok, true);
  assert.equal(etat.abonnes[fiche.id].etat, "retire");
  assert.equal(etat.file.length, 0, "la file est vidée pour cette personne");
  // Un désabonnement ne s'ajoute pas à la liste des destinataires.
  const remis = await api.abonner({ courriel: "citoyen@exemple.fr" });
  assert.equal(remis.ok, true);
  assert.equal(etat.abonnes[fiche.id].etat, "attente", "une réinscription repasse par la confirmation");
});

// ======================================================= les envois
test("envois : le bulletin part une fois, aux seuls abonnés confirmés", async () => {
  const courriel = fauxCourriel();
  const publications = [pub({ datePublication: "2026-09-10" })];
  const { api, etat } = banc({ reglages: REGLAGES, courriel, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  await api.abonner({ courriel: "confirme@exemple.fr" });
  await api.abonner({ courriel: "attente@exemple.fr" });
  const [a, b] = Object.values(etat.abonnes);
  await api.confirmer(api.liensDe(a, REGLAGES).confirmation.match(/jeton=([^&]+)/)[1]);
  courriel.envois.length = 0;
  const passe = await api.assurer();
  assert.deepEqual(passe.composees, ["2026-09-01"]);
  assert.equal(courriel.envois.length, 1, "seul l'abonné confirmé reçoit le bulletin");
  assert.equal(courriel.envois[0].destinataires[0].courriel, a.courriel);
  assert.match(courriel.envois[0].sujet, /Bulletin officiel n° 1 — septembre 2026/);
  // Le message porte le lien de désabonnement propre à la personne, et les
  // en-têtes qui vont avec un envoi en nombre.
  assert.match(courriel.envois[0].texte, /Se désabonner : https:\/\/actes\.exemple\.fr\/recueil\/bulletins\/desabonnement/);
  assert.ok(courriel.envois[0].entetes.some((h) => /^List-Unsubscribe: </.test(h)));
  assert.equal(etat.file.length, 0);
  assert.equal(etat.periodes["2026-09-01"].envoi.fait, 1);
  // Une nouvelle passe n'envoie rien : le bulletin est paru.
  const seconde = await api.assurer();
  assert.equal(seconde.envois.total, 0);
  assert.equal(courriel.envois.length, 1);
  assert.equal(b.etat, "attente");
});

test("envois : un refus du serveur est réessayé, puis abandonné avec son motif", async () => {
  const courriel = fauxCourriel({ refuse: true });
  const publications = [pub({ datePublication: "2026-09-10" })];
  const { api, etat } = banc({ reglages: REGLAGES, courriel, publications, maintenant: "2026-10-05T08:00:00.000Z", options: { maxEnvoisParPasse: 10 } });
  await api.abonner({ courriel: "citoyen@exemple.fr" });
  const fiche = Object.values(etat.abonnes)[0];
  await api.confirmer(api.liensDe(fiche, REGLAGES).confirmation.match(/jeton=([^&]+)/)[1]);
  courriel.envois.length = 0;
  await api.assurer();
  assert.equal(etat.file.length, 1);
  assert.equal(etat.file[0].essais, 1);
  assert.match(etat.file[0].motif, /refusé/);
  await api.assurer();
  await api.assurer();
  assert.equal(etat.file.length, 0, "trois tentatives, puis abandon");
  assert.equal(etat.envois[etat.envois.length - 1].echecs, 1);
  assert.equal(etat.periodes["2026-09-01"].envoi.echecs, 1);
});

test("envois : le geste d'administration renvoie le bulletin aux abonnés", async () => {
  const courriel = fauxCourriel();
  const publications = [pub({ datePublication: "2026-09-10" })];
  const { api, etat } = banc({ reglages: REGLAGES, courriel, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  await api.abonner({ courriel: "citoyen@exemple.fr" });
  const fiche = Object.values(etat.abonnes)[0];
  await api.confirmer(api.liensDe(fiche, REGLAGES).confirmation.match(/jeton=([^&]+)/)[1]);
  await api.assurer();
  courriel.envois.length = 0;
  const out = await api.route({ method: "POST", path: "/v1/bulletins/2026-09-01/envoyer", headers: {}, body: {} }, { authorize: () => null, rate: () => false });
  assert.equal(out.status, 200);
  assert.equal(courriel.envois.length, 1, "le renvoi repart");
  // Un bulletin provisoire, lui, ne s'envoie pas : on compose celui de la
  // période EN COURS (octobre, en ajoutant un acte publié ce mois-là).
  const acteOctobre = pub({ datePublication: "2026-10-02", cle: "a@10", eliUri: "eli:/fr/dec/2026/0003/v" });
  publications.push(acteOctobre);
  await api.route({ method: "POST", path: "/v1/bulletins/administration/generer", headers: {}, body: { enCours: true } }, { authorize: () => null, rate: () => false });
  const provisoire = await api.route({ method: "POST", path: "/v1/bulletins/2026-10-01/envoyer", headers: {}, body: {} }, { authorize: () => null, rate: () => false });
  assert.equal(provisoire.status, 409);
  assert.equal(provisoire.body.code, "bulletin_provisoire");
});

// ======================================================= les lectures et les flux
test("recueil : l'état public expose la cadence, la prochaine parution et les numéros", async () => {
  const courriel = fauxCourriel();
  const publications = [pub({ datePublication: "2026-09-10" })];
  const { api } = banc({ reglages: REGLAGES, courriel, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  await api.assurer();
  const etatPublic = await api.publicEtat();
  assert.equal(etatPublic.actif, true);
  assert.equal(etatPublic.titre, "Bulletin officiel de la commune");
  assert.equal(etatPublic.abonnement, true);
  assert.equal(etatPublic.prochaine.debut, "2026-10-01");
  assert.equal(etatPublic.bulletins.length, 1);
  assert.equal(etatPublic.bulletins[0].id, "2026-09-01");
});

test("recueil : éteint, le bulletin ne se montre pas", async () => {
  const { api } = banc({ reglages: { ...REGLAGES, actif: false } });
  assert.deepEqual(await api.publicEtat(), { actif: false });
  assert.equal((await api.route({ method: "GET", path: "/v1/bulletins", headers: {} }, {})).body.actif, false);
});

test("flux : RSS 2.0 et Atom 1.0 portent un item par bulletin", async () => {
  const publications = [
    pub({ datePublication: "2026-08-10", cle: "a@8", eliUri: "eli:/fr/dec/2026/0001/v", objet: "Travaux <rue> & voirie" }),
    pub({ datePublication: "2026-09-10", cle: "a@9", eliUri: "eli:/fr/dec/2026/0002/v" }),
  ];
  const { api, etat } = banc({ reglages: REGLAGES, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  etat.depuis = "2026-08-01";
  await api.assurer();
  const rss = await api.flux({ mode: "rss" });
  const atom = await api.flux({ mode: "atom" });
  assert.match(rss, /^<\?xml version="1\.0" encoding="utf-8"\?>/);
  assert.match(rss, /<rss version="2\.0"/);
  assert.equal((rss.match(/<item>/g) || []).length, 2);
  assert.match(rss, /<link>https:\/\/actes\.exemple\.fr\/recueil\/bulletins\/2026-09-01<\/link>/);
  assert.match(rss, /<atom:link href="https:\/\/actes\.exemple\.fr\/recueil\/bulletins\.rss" rel="self"/);
  // Le contenu est échappé : un « & » ou un « < » dans un objet ne casse pas le XML.
  assert.match(rss, /Travaux &lt;rue&gt; &amp; voirie/);
  assert.match(atom, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.equal((atom.match(/<entry>/g) || []).length, 2);
  assert.match(atom, /<updated>2026-10-05T08:00:00\.000Z<\/updated>/);
  // Le lien vers l'adresse HUMAINE du recueil porte son rôle : un `<link>` sans
  // « rel » vaut « alternate », mais le dire évite qu'un lecteur s'y trompe.
  assert.match(atom, /<link href="https:\/\/actes\.exemple\.fr\/recueil\/bulletins" rel="alternate" type="text\/html"\/>/);
  // Le document se REFERME : `<channel>` a son `</channel>`, `<feed>` son
  // `</feed>`. Un fil auquel il manque une balise n'est pas un fil — un lecteur
  // le rejette en bloc, et il ne l'aurait pas dit ici sans cette épreuve (le
  // `</channel>` a manqué une fois : les balises ouvrantes se voyaient toutes).
  assert.match(rss, /<\/channel>\s*<\/rss>\s*$/);
  assert.match(atom, /<\/feed>\s*$/);
});

test("représentations : texte, Markdown et JSON disent la même chose", async () => {
  const publications = [pub({ datePublication: "2026-09-10", objet: "Règlement intérieur" })];
  const { api } = banc({ reglages: REGLAGES, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  await api.assurer();
  const b = api.lire("2026-09-01");
  const texte = api.texteBulletin(b, { base: "https://actes.exemple.fr" });
  assert.match(texte, /Bulletin officiel n° 1 — septembre 2026/);
  assert.match(texte, /COMMUNE D'EXEMPLE/);
  assert.match(texte, /• 2026-0001 — Règlement intérieur/);
  assert.match(texte, /https:\/\/actes\.exemple\.fr\/recueil\//);
  const md = api.markdownBulletin(b);
  assert.match(md, /^# Bulletin officiel n° 1 — septembre 2026/m);
  assert.match(md, /^## Commune d'Exemple$/m);
  assert.match(md, /^### Urbanisme et voirie$/m);
  const json = api.jsonBulletin(b, { base: "https://actes.exemple.fr" });
  assert.equal(json.id, "2026-09-01");
  assert.equal(json.entites[0].themes[0].actes[0].url, "https://actes.exemple.fr/recueil/acte%402026-09-10-originale");
});

// ======================================================= le routage
test("routage : les routes publiques répondent, les routes d'administration exigent un rôle", async () => {
  const publications = [pub({ datePublication: "2026-09-10" })];
  const { api } = banc({ reglages: REGLAGES, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  await api.assurer();
  const garde = { authorize: (h, regle) => (regle && regle.min === "editeur" ? { status: 403, headers: {}, body: { erreur: "Rôle insuffisant." } } : null), rate: () => false };
  assert.equal((await api.route({ method: "GET", path: "/v1/bulletins", headers: {} }, garde)).status, 200);
  assert.equal((await api.route({ method: "GET", path: "/v1/bulletins/2026-09-01", headers: {} }, garde)).status, 200);
  assert.equal((await api.route({ method: "GET", path: "/v1/bulletins/2026-01-01", headers: {} }, garde)).status, 404);
  assert.equal((await api.route({ method: "GET", path: "/v1/bulletins/administration/tableau", headers: {} }, garde)).status, 403);
  assert.equal((await api.route({ method: "GET", path: "/v1/bulletins/administration/tableau", headers: {} }, { ...garde, authorize: () => null })).status, 200);
  assert.equal(await api.route({ method: "GET", path: "/v1/autre-chose", headers: {} }, garde), null, "hors du domaine du module");
});

test("routage : le tableau de bord dit où en est le service, sans jamais rendre un jeton", async () => {
  const courriel = fauxCourriel();
  const publications = [pub({ datePublication: "2026-09-10" })];
  const { api, etat } = banc({ reglages: REGLAGES, courriel, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  await api.abonner({ courriel: "citoyen@exemple.fr" });
  await api.assurer();
  const tdb = await api.tableauDeBord("https://actes.exemple.fr");
  assert.equal(tdb.actif, true);
  assert.equal(tdb.cadence.id, "mensuelle");
  assert.equal(tdb.bulletins, 1);
  assert.equal(tdb.abonnes.total, 1);
  assert.equal(tdb.abonnes.attente, 1);
  assert.equal(tdb.abonnes.confirmes, 0);
  assert.equal(tdb.abonnesListe.length, 1);
  assert.equal(tdb.abonnesListe[0].courriel, "citoyen@exemple.fr");
  assert.match(tdb.abonnesListe[0].lienDesabonnement, /^https:\/\/actes\.exemple\.fr\/recueil\/bulletins\/desabonnement\?jeton=/);
  assert.equal(tdb.flux.rss, "https://actes.exemple.fr/recueil/bulletins.rss");
  // Le jeton n'apparaît que dans le LIEN (il est dérivé du secret) : aucune
  // réponse ne rend le secret lui-même.
  assert.ok(!JSON.stringify(tdb).includes(etat.secret));
});

test("état : le secret et les bulletins survivent au redémarrage du service", async () => {
  const publications = [pub({ datePublication: "2026-09-10" })];
  const premier = banc({ reglages: REGLAGES, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  await premier.api.assurer();
  const secret = premier.etat.secret;
  const sauvegarde = JSON.parse(JSON.stringify(premier.etat));
  // Un service rechargé depuis la base reprend le même état.
  const second = banc({ reglages: REGLAGES, publications, maintenant: "2026-10-06T08:00:00.000Z" });
  Object.assign(second.etat, sauvegarde);
  const passe = await second.api.assurer();
  assert.equal(second.etat.secret, secret, "le secret ne change pas d'un démarrage à l'autre");
  assert.deepEqual(passe.composees, [], "le bulletin déjà composé n'est pas recomposé");
  assert.equal(second.api.liste().length, 1);
});

test("purge : l'état des bulletins se remet à zéro", async () => {
  const publications = [pub({ datePublication: "2026-09-10" })];
  const { api, etat } = banc({ reglages: REGLAGES, publications, maintenant: "2026-10-05T08:00:00.000Z" });
  await api.assurer();
  assert.equal(api.liste().length, 1);
  api.reinitialiser();
  assert.equal(api.liste().length, 0);
  assert.equal(Object.keys(etat.abonnes).length, 0);
  assert.equal(etat.secret, "");
});

test("cadences : toutes les cadences nommées produisent une période valide sur une année", () => {
  for (const c of CADENCES) {
    if (c.id === "personnalisee") continue;
    let p = periodeDe("2026-01-01", { id: c.id });
    assert.ok(p.debut <= "2026-01-01" && p.fin >= "2026-01-01", c.id + " : la période contient la date");
    let n = 0;
    let jours = 0;
    // On compte les périodes jusqu'à couvrir l'année : la boucle ACCUMULE avant
    // de tester, sans quoi la dernière période (celle qui finit au 31 décembre)
    // ne serait jamais comptée.
    for (;;) {
      jours += distanceUnites("jour", p.debut, p.fin) + 1;
      n += 1;
      if (p.fin >= "2026-12-31" || n > 400) break;
      const suivante = periodeSuivante(p, { id: c.id });
      assert.equal(suivante.debut, decaler(p.fin, "jour", 1), c.id + " : les périodes se touchent (" + p.fin + " → " + suivante.debut + ")");
      assert.ok(suivante.fin >= suivante.debut, c.id + " : la période n'est pas vide");
      p = suivante;
    }
    assert.ok(n > 0 && n <= 400, c.id + " : la suite des périodes avance");
    assert.ok(jours >= 350 && jours <= 380, c.id + " : une année couvre environ 365 jours (" + jours + " jours, " + n + " périodes)");
  }
});
