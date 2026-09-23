// ============================================================================
// Le BULLETIN servi par le recueil — les pages publiques, l'abonnement, la
// confirmation, le désabonnement, le flux, le plan de site et le llms.txt.
//
// Ces épreuves tiennent le pont entre les deux domaines : `bulletins.mjs`
// compose les numéros, `actes.mjs` les SERT (voir `pageBulletins`), et le
// service branche l'un sur l'autre. Ce qui est éprouvé ici, c'est exactement
// cela — un lecteur qui ouvre `/recueil/bulletins`, s'abonne depuis un vrai
// formulaire, confirme, se désabonne ; et un recueil dont le bulletin est
// ÉTEINT, dont les adresses n'existent alors pas.
//
// Aucune base, aucun réseau : un faux `save`, un faux courriel, une horloge
// figée.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { createActesApi, emptyState } from "./actes.mjs";
import { createBulletins } from "./bulletins.mjs";

// -------------------------------------------------------------------- outils
const sha256 = (s) => {
  let h = 2166136261;
  const t = String(s);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0").repeat(8).slice(0, 64);
};

const HOTE = { host: "actes.exemple.fr", "x-forwarded-proto": "https" };
const BASE = "https://actes.exemple.fr";

// Une publication du recueil, telle que le service l'écrit.
const publication = (o = {}) => ({
  cle: o.cle || "2026-412-vsl@2026-09-10",
  eli: "eli:/fr/dec/2026/0412/vsl",
  eliUri: o.eliUri || "eli:/fr/dec/2026/0412/vsl",
  url: "",
  numero: o.numero || "2026-412-VSL",
  nature: "deliberation",
  themeId: o.themeId || "urbanisme",
  themeLabel: o.themeLabel || "Urbanisme et voirie",
  objet: o.objet || "Autorisation d'occuper le domaine public",
  entityName: o.entityName || "Commune d'Exemple",
  dateDocument: o.dateDocument || "2026-09-08",
  datePublication: o.datePublication || "2026-09-10",
  dateOpposabilite: o.dateOpposabilite || "2026-09-11",
  kind: "originale",
  recueil: "Recueil des actes administratifs",
  brandName: "Commune d'Exemple",
  publieeLe: (o.datePublication || "2026-09-10") + "T09:00:00.000Z",
  reserve: o.reserve === true,
  formats: { html: '<div class="doc"><p>Texte de l\'acte.</p></div>', md: "# Acte\n\nTexte.", texte: "Texte de l'acte." },
});

function fauxCourriel() {
  const envois = [];
  return {
    envois,
    etat: () => ({ disponible: true, configure: true, actif: true, hote: "smtp.exemple.fr", port: 587, expediteur: "actes@exemple.fr", raison: "" }),
    envoyer: async (m) => { envois.push(m); return { envoye: true, destinataires: m.destinataires, detail: "Accepté" }; },
  };
}

// Le banc : l'état, le domaine des actes, celui des bulletins, et de quoi agir.
function banc({ actif = true, publications = [publication()], maintenant = "2026-10-05T08:00:00.000Z", courriel = fauxCourriel() } = {}) {
  const state = emptyState();
  for (const p of publications) state.publies[p.cle] = p;
  const ecrits = [];
  const reglages = {
    actif,
    titre: "Bulletin officiel de la commune",
    titreBulletin: "Bulletin officiel",
    sousTitre: "Les actes de la commune, rassemblés par période.",
    cadence: { id: "mensuelle" },
    parutionJours: 0,
    base: BASE,
  };
  const bulletins = createBulletins({
    state, sha256,
    alea: (n = 32) => sha256("graine|" + n),
    now: () => maintenant,
    save: (json) => { ecrits.push(json); return true; },
    reglages: async () => reglages,
    publications: async () => api.publicationsPubliques(false),
    courriel,
    tracer: () => {},
    baseUrl: BASE,
    journal: () => {},
  });
  const api = createActesApi({
    state, sha256, now: () => maintenant,
    save: (json) => { ecrits.push(json); return true; },
    bulletins,
  });
  const appeler = (method, path, body, entetes) => api.route(
    { method, path, headers: entetes || HOTE, body: body || null, ip: "10.0.0.9" },
    { agent: false, authorize: () => null, rate: () => false, base: BASE },
  );
  // Le DISPATCH du service : le domaine des actes d'abord, puis celui des
  // bulletins — c'est exactement ce que fait `handle` dans server.mjs.
  const router = async (method, path, corps, contexte) => {
    const requete = { method, path, headers: HOTE, body: corps || null, ip: "10.0.0.9" };
    const ctx = { agent: false, authorize: () => null, rate: () => false, base: BASE, ...(contexte || {}) };
    return (await api.route(requete, ctx)) || (await bulletins.route(requete, ctx));
  };
  return { state, bulletins, api, ecrits, reglages, courriel, maintenant, appeler, router };
}

// ------------------------------------------------------------------- épreuves
test("publications : le composeur ne reçoit que la dernière version visible", () => {
  const ancienne = publication({ cle: "2026-412-vsl@2026-09-01", datePublication: "2026-09-01", eliUri: "eli:/fr/dec/2026/0412/vsl" });
  const recente = publication({ cle: "2026-412-vsl@2026-09-10", datePublication: "2026-09-10", eliUri: "eli:/fr/dec/2026/0412/vsl", numero: "2026-412-VSL" });
  const reservee = publication({ cle: "note@2026-09-12", datePublication: "2026-09-12", eliUri: "eli:/fr/note/2026/0001/vsl", reserve: true });
  const b = banc({ publications: [ancienne, recente, reservee] });
  const liste = b.api.publicationsPubliques(false);
  assert.equal(liste.length, 1, "seule la dernière version entre, et jamais une publication réservée");
  assert.equal(liste[0].cle, recente.cle);
  assert.equal(liste[0].themeLabel, "Urbanisme et voirie");
  assert.ok(Object.prototype.hasOwnProperty.call(liste[0], "datePublication"));
});

test("recueil : les pages du bulletin servent le sommaire, et le formulaire d'abonnement", async () => {
  const b = banc();
  await b.bulletins.assurer();
  const out = await b.appeler("GET", "/recueil/bulletins");
  assert.equal(out.status, 200);
  assert.match(out.headers["content-type"], /text\/html/);
  assert.match(out.body, /Bulletin officiel de la commune/);
  assert.match(out.body, /action="https:\/\/actes\.exemple\.fr\/recueil\/bulletins\/abonnement"/);
  assert.match(out.body, /method="post"/);
  assert.match(out.body, /Bulletin officiel n° 1 — septembre 2026/);
  assert.match(out.body, /flux RSS/);
});

test("recueil : un numéro se lit en HTML, en JSON, en Markdown et en texte", async () => {
  const b = banc();
  await b.bulletins.assurer();
  const html = await b.appeler("GET", "/recueil/bulletins/2026-09-01");
  assert.equal(html.status, 200);
  assert.match(html.body, /Commune d&#39;Exemple|Commune d'Exemple/);
  assert.match(html.body, /Urbanisme et voirie/);
  assert.match(html.body, /Autorisation d'occuper le domaine public/);
  assert.match(html.body, /https:\/\/actes\.exemple\.fr\/recueil\/2026-412-vsl%402026-09-10/);
  const json = await b.appeler("GET", "/recueil/bulletins/2026-09-01.json");
  assert.equal(json.status, 200);
  const donnees = JSON.parse(json.body);
  assert.equal(donnees.id, "2026-09-01");
  assert.equal(donnees.nombre, 1);
  assert.equal(donnees.entites[0].themes[0].actes[0].numero, "2026-412-VSL");
  const md = await b.appeler("GET", "/recueil/bulletins/2026-09-01.md");
  assert.equal(md.status, 200);
  assert.match(md.body, /^# Bulletin officiel n° 1 — septembre 2026/m);
  const txt = await b.appeler("GET", "/recueil/bulletins/2026-09-01.txt");
  assert.equal(txt.status, 200);
  assert.match(txt.body, /COMMUNE D'EXEMPLE/);
});

test("recueil : un numéro inconnu, et un numéro provisoire, n'ont pas d'adresse", async () => {
  // Octobre a aussi un acte : la période EN COURS se compose donc en provisoire —
  // et c'est précisément ce qui ne doit pas avoir d'adresse publique.
  const octobre = publication({ cle: "2026-455-vsl@2026-10-02", eliUri: "eli:/fr/dec/2026/0455/vsl", numero: "2026-455-VSL", dateDocument: "2026-10-02", datePublication: "2026-10-02", dateOpposabilite: "2026-10-03" });
  const b = banc({ publications: [publication(), octobre] });
  await b.bulletins.assurer();
  assert.equal((await b.appeler("GET", "/recueil/bulletins/1999-01-01")).status, 404);
  const compose = await b.router("POST", "/v1/bulletins/administration/generer", { enCours: true });
  assert.equal(compose.status, 201);
  assert.equal((await b.appeler("GET", "/recueil/bulletins/2026-10-01")).status, 404);
  const provisoire = b.bulletins.lire("2026-10-01");
  assert.ok(provisoire && provisoire.provisoire, "la période en cours se compose, mais reste provisoire");
  assert.equal(provisoire.nombre, 1);
});

test("recueil : le flux RSS et Atom portent un item par numéro", async () => {
  const b = banc();
  await b.bulletins.assurer();
  const rss = await b.appeler("GET", "/recueil/bulletins.rss");
  assert.equal(rss.status, 200);
  assert.match(rss.headers["content-type"], /application\/rss\+xml/);
  assert.match(rss.body, /<rss version="2.0"/);
  assert.match(rss.body, /<link>https:\/\/actes\.exemple\.fr\/recueil\/bulletins\/2026-09-01<\/link>/);
  const atom = await b.appeler("GET", "/recueil/bulletins.atom");
  assert.equal(atom.status, 200);
  assert.match(atom.headers["content-type"], /application\/atom\+xml/);
  assert.match(atom.body, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
});

test("recueil : éteint, le bulletin n'existe pas — ni page, ni flux, ni lien", async () => {
  const b = banc({ actif: false });
  await b.bulletins.assurer();
  assert.equal((await b.appeler("GET", "/recueil/bulletins")).status, 404);
  assert.equal((await b.appeler("GET", "/recueil/bulletins.rss")).status, 404);
  assert.equal((await b.appeler("GET", "/recueil/bulletins/2026-09-01")).status, 404);
  const accueil = await b.appeler("GET", "/recueil");
  assert.equal(accueil.status, 200);
  assert.doesNotMatch(accueil.body, /Derniers bulletins/);
  assert.doesNotMatch(accueil.body, /bulletins\.rss/);
});

test("abonnement : un vrai formulaire, un double consentement, et rien qui fuie", async () => {
  const b = banc();
  await b.bulletins.assurer();
  const demande = await b.appeler("POST", "/recueil/bulletins/abonnement", { courriel: "lecteur@exemple.fr", nom: "Camille" });
  assert.equal(demande.status, 200);
  assert.match(demande.headers["content-type"], /text\/html/);
  assert.match(demande.body, /courriel de confirmation/i);
  // Le courriel de confirmation est parti, avec son lien.
  assert.equal(b.courriel.envois.length, 1);
  assert.match(b.courriel.envois[0].texte, /\/recueil\/bulletins\/confirmation\?jeton=/);
  const abonnes = Object.values(b.state.bulletins.abonnes);
  assert.equal(abonnes.length, 1);
  assert.equal(abonnes[0].etat, "attente");
  // La confirmation, par le lien du courriel.
  const lien = /(https:\/\/[^\s]+\/recueil\/bulletins\/confirmation\?jeton=[^\s]+)/.exec(b.courriel.envois[0].texte)[1];
  const confirme = await b.appeler("GET", new URL(lien).pathname + new URL(lien).search);
  assert.equal(confirme.status, 200);
  assert.match(confirme.body, /Abonnement confirmé/);
  assert.equal(Object.values(b.state.bulletins.abonnes)[0].etat, "confirme");
  // Une adresse invalide est refusée, en page — jamais en JSON.
  const refus = await b.appeler("POST", "/recueil/bulletins/abonnement", { courriel: "pas-une-adresse" });
  assert.equal(refus.status, 200);
  assert.match(refus.body, /pas valide/);
  assert.match(refus.headers["content-type"], /text\/html/);
});

test("désabonnement : le lien du courriel demande, le second geste retire", async () => {
  const b = banc();
  await b.bulletins.assurer();
  await b.appeler("POST", "/recueil/bulletins/abonnement", { courriel: "lecteur@exemple.fr" });
  const lien = /(https:\/\/[^\s]+\/recueil\/bulletins\/confirmation\?jeton=[^\s]+)/.exec(b.courriel.envois[0].texte)[1];
  await b.appeler("GET", new URL(lien).pathname + new URL(lien).search);
  const fiche = Object.values(b.state.bulletins.abonnes)[0];
  assert.equal(fiche.etat, "confirme");
  // Le lien de désabonnement, tel qu'il figure dans le courriel du bulletin.
  const desabo = b.bulletins.liensDe(fiche, { base: BASE }).desabonnement;
  const chemin = "/recueil/bulletins/desabonnement?jeton=" + new URL(desabo).searchParams.get("jeton");
  // Premier temps : la page demande confirmation, et RIEN ne change.
  const demande = await b.appeler("GET", chemin);
  assert.equal(demande.status, 200);
  assert.match(demande.body, /Confirmer le désabonnement/);
  assert.equal(Object.values(b.state.bulletins.abonnes)[0].etat, "confirme");
  // Second temps : l'abonné est retiré.
  const confirme = await b.appeler("GET", chemin + "&confirmer=1");
  assert.equal(confirme.status, 200);
  assert.match(confirme.body, /Désabonnement enregistré/);
  assert.equal(Object.values(b.state.bulletins.abonnes)[0].etat, "retire");
});

test("recueil : l'accueil annonce les bulletins, et le plan de site les porte", async () => {
  const b = banc();
  await b.bulletins.assurer();
  const accueil = await b.appeler("GET", "/recueil");
  assert.equal(accueil.status, 200);
  assert.match(accueil.body, /Derniers bulletins/);
  assert.match(accueil.body, /recueil\/bulletins\/2026-09-01/);
  assert.match(accueil.body, /application\/rss\+xml/);
  const plan = await b.appeler("GET", "/sitemap.xml");
  assert.match(plan.body, /https:\/\/actes\.exemple\.fr\/recueil\/bulletins</);
  assert.match(plan.body, /https:\/\/actes\.exemple\.fr\/recueil\/bulletins\/2026-09-01</);
  const llms = await b.appeler("GET", "/llms.txt");
  assert.match(llms.body, /## Bulletins/);
  assert.match(llms.body, /flux RSS|Flux RSS/);
  const robots = await b.appeler("GET", "/robots.txt");
  assert.match(robots.body, /Bulletins et flux/);
});

test("recueil : les adresses des actes continuent de répondre (l'ordre des routes)", async () => {
  const b = banc();
  await b.bulletins.assurer();
  const acte = await b.appeler("GET", "/recueil/2026-412-vsl%402026-09-10");
  assert.equal(acte.status, 200);
  assert.match(acte.body, /Texte de l'acte/);
  const acteJson = await b.appeler("GET", "/recueil/2026-412-vsl%402026-09-10.json");
  assert.equal(acteJson.status, 200);
  assert.equal(JSON.parse(acteJson.body).numero, "2026-412-VSL");
  // Un acte qui porte le nom d'une page du bulletin n'est pas avalé : la route
  // du bulletin a la priorité, et le reste tombe en 404 d'acte publié.
  const inconnu = await b.appeler("GET", "/recueil/2026-09-01");
  assert.equal(inconnu.status, 404);
});

test("bulletin : les routes d'administration exigent un rôle, et le tableau rend l'état", async () => {
  const b = banc();
  await b.bulletins.assurer();
  const garde = { authorize: (h, regle) => (regle && regle.min === "editeur" ? { status: 403, headers: {}, body: { erreur: "Rôle insuffisant." } } : null) };
  const refus = await b.router("GET", "/v1/bulletins/administration/tableau", null, garde);
  assert.equal(refus.status, 403);
  const out = await b.router("GET", "/v1/bulletins/administration/tableau", null, { authorize: () => null });
  assert.equal(out.status, 200);
  assert.equal(out.body.titre, "Bulletin officiel de la commune");
  assert.equal(out.body.cadence.id, "mensuelle");
  assert.equal(out.body.bulletins, 1);
  assert.ok(out.body.flux.rss.endsWith("/recueil/bulletins.rss"));
  // L'état public, lui, ne se garde pas — et ne rend aucun abonné.
  const publicEtat = await b.router("GET", "/v1/bulletins");
  assert.equal(publicEtat.status, 200);
  assert.equal(publicEtat.body.actif, true);
  assert.equal(publicEtat.body.abonnes, undefined);
  assert.equal(publicEtat.body.bulletins.length, 1);
});

test("bulletin : la purge du service emporte aussi les bulletins et les abonnés", async () => {
  const b = banc();
  await b.bulletins.assurer();
  await b.appeler("POST", "/recueil/bulletins/abonnement", { courriel: "lecteur@exemple.fr" });
  assert.equal(b.bulletins.compter().bulletins, 1);
  assert.equal(b.bulletins.compter().abonnes, 1);
  const purge = await b.appeler("POST", "/v1/admin/purge", { confirmation: "repurge" });
  assert.equal(purge.status, 200);
  assert.equal(b.bulletins.compter().bulletins, 0);
  assert.equal(b.bulletins.compter().abonnes, 0);
  assert.equal(Object.keys(b.state.publies).length, 0);
});
