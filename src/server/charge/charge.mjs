#!/usr/bin/env node

// ============================================================================
// ÉTUDE DE CHARGE DU SERVICE — la commande.
//
//   node src/server/charge/charge.mjs --url https://actes.exemple.fr \
//        --profils public=40,lecteur=8,redacteur=8,editeur=3,administrateur=1 \
//        --duree 120 --ecriture flux --sortie rapport.md
//
//   node src/server/charge/charge.mjs --sans-base --profils public=40,redacteur=8 \
//        --duree 60
//
// CE QUE LA CAMPAGNE MESURE. Pour chaque geste : la durée, le code de réponse et
// le volume. Le rapport classe les gestes du pire au meilleur (p50, p95, p99,
// max), donne le débit, les codes, et — en mode `--sans-base` — le NOMBRE
// D'ORDRES SQL que le service a adressés à la base pour tenir cette charge. Ce
// dernier chiffre est le plus utile au développeur : il ne dépend pas du moteur
// de stockage, et il dit où le service passe son temps.
//
// PRUDENCE. Les campagnes d'écriture (`--ecriture`) MODIFIENT les données de la
// cible. Sur une adresse qui n'est pas la boucle locale, il faut le dire
// explicitement (`--confirme`), et la cible doit être un déploiement de travail —
// jamais la base de service d'une collectivité.
// ============================================================================

import { readFile, writeFile } from "node:fs/promises";
import { creerClient, decouvrir, potVide } from "./client.mjs";
import { lancerCharge } from "./moteur.mjs";
import { planDepuisSpec, effectifTotal } from "./profils.mjs";
import { rapportMarkdown, resumer } from "./statistiques.mjs";
import { MDP_DE_CHARGE, semer, semerComptes } from "./semence.mjs";

const AIDE = `Étude de charge du service Scribae.

  --url <adresse>          service à éprouver (ex. http://localhost:8080)
  --sans-base              lance le service sur place, avec une base EN MÉMOIRE
                           (aucune base à installer ; voir faux-mysql.mjs)
  --port <n>               port du service lancé par --sans-base (défaut 8099)
  --profils <spec>         public=40,lecteur=8,redacteur=8,editeur=3,
                           reviseur=1,signataire=1,administrateur=1
                           (défaut : public=20,lecteur=4,redacteur=6,administrateur=1)
  --duree <s>              fenêtre mesurée, en secondes (défaut 60)
  --pensee <ms>            temps de pensée moyen entre deux gestes (défaut 1500 ;
                           0 = saturation : chaque poste enchaîne sans pause,
                           en rendant la main à la boucle d'événements)
  --montee <ms>            étalement des connexions (défaut 0 : toutes ensemble)
  --graine <n>             graine d'aléa (défaut 1) — même graine, même trafic
  --ecriture <niveau>      aucune | flux | pleine   (défaut aucune)
                             flux   : la présence et le journal des postes
                             pleine : en plus, l'enregistrement des actes
  --comptes <fichier.json> identifiants par rôle : {"redacteur":{"login":"…","motDePasse":"…"}}
  --connexion <l:mdp>      identifiants d'administration (découverte, semence,
                           et à défaut pour tous les rôles)
  --jeton <clé>            clé d'API (mode AUTH_MODE=demo)
  --semence                garnit la cible avant de mesurer (actes, trames,
                           informations, publications) — voir semence.mjs
  --actes <n>              actes du registre à semer (défaut 60)
  --trames <n>             trames à semer (défaut 25)
  --taille-acte <car.>     taille d'un acte semé (défaut 45000)
  --publications <n>       actes publiés au recueil à semer (défaut 12)
  --latence <ms>           latence SQL simulée par ordre (--sans-base)
  --sortie <fichier>       rapport Markdown (défaut rapport-charge-<date>.md)
  --confirme               confirme une campagne d'ÉCRITURE hors boucle locale
  --silence                n'affiche pas la progression
  --aide                   cette aide
`;

// ------------------------------------------------------------------ arguments
export function analyserArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const nom = a.slice(2);
    const eq = nom.indexOf("=");
    if (eq > 0) { args[nom.slice(0, eq)] = nom.slice(eq + 1); continue; }
    const suivant = argv[i + 1];
    if (suivant === undefined || suivant.startsWith("--")) { args[nom] = true; continue; }
    args[nom] = suivant;
    i += 1;
  }
  return args;
}

const nombre = (v, d) => (v === undefined || v === true ? d : Number(v));
const horodatage = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const BOUCLE_LOCALE = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/i;
const hoteDe = (url) => { try { return new URL(url).hostname; } catch (e) { return ""; } };

// ------------------------------------------------- le service lancé sur place
// `--sans-base` : le VRAI service (`src/server/mysql/server.mjs`), sur une vraie
// socket, mais avec une base en mémoire à la place de MySQL. Le crochet de
// chargement (`crochets.mjs`) substitue `mysql2/promise` ; rien d'autre n'est
// touché — ni le serveur HTTP de Node, ni le chiffrement, ni le disque.
async function demarrerServiceInterne({ args, journal }) {
  const port = String(nombre(args.port, 8099));
  const { register } = await import("node:module");
  register("./crochets.mjs", import.meta.url);
  process.env.PORT = port;
  process.env.HOST = "127.0.0.1";
  process.env.DB_HOST = "127.0.0.1";
  process.env.DB_PORT = "3306";
  process.env.DB_USER = "scriba";
  process.env.DB_PASSWORD = "base-de-charge";
  process.env.DB_NAME = "scriba";
  process.env.AUTO_MIGRATE = "true";
  process.env.AUTH_MODE = "password";
  process.env.COOKIE_SECURE = "false";
  process.env.ADMIN_LOGIN = "charge-admin";
  process.env.ADMIN_PASSWORD = MDP_DE_CHARGE;
  process.env.ADMIN_NOM = "Administrateur de charge";
  process.env.DEMO_ACCOUNTS = "false";
  delete process.env.SCRIBA_ATELIER_IPS;
  // La latence SQL simulée est lue par `mysql-bouchon.mjs` à son chargement.
  if (args.latence) process.env.SCRIBA_CHARGE_LATENCE = String(nombre(args.latence, 0));
  process.argv = [process.argv[0], "server.mjs"];   // aucun --reconcilier/--migrate

  journal("Démarrage du service sur place (base en mémoire)…");
  await import("../mysql/server.mjs");
  if (globalThis.__SCRIBA_BASE__) globalThis.__SCRIBA_BASE__.definirMotDePasse("base-de-charge");
  const url = "http://127.0.0.1:" + port;
  const limite = Date.now() + 30000;
  let dernier = "";
  while (Date.now() < limite) {
    try {
      const r = await fetch(url + "/v1/db/health");
      if (r.ok) { journal("Service prêt : " + url); return { url, base: globalThis.__SCRIBA_BASE__ || null }; }
      dernier = "HTTP " + r.status;
    } catch (e) { dernier = String((e && e.message) || e); }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Le service n'a pas répondu dans les 30 s (" + dernier + ").");
}

// -------------------------------------------------------------- les identifiants
async function lireComptes(args) {
  if (!args.comptes) return {};
  const texte = await readFile(String(args.comptes), "utf8");
  const doc = JSON.parse(texte);
  const out = {};
  for (const [role, v] of Object.entries(doc)) {
    if (typeof v === "string") {
      const [login, motDePasse] = v.split(":");
      out[role] = { login, motDePasse };
    } else if (v && typeof v === "object") {
      out[role] = { login: v.login || v.identifiant || "", motDePasse: v.motDePasse || v.password || "" };
    }
  }
  return out;
}

const depuisConnexion = (args) => {
  if (!args.connexion) return null;
  const i = String(args.connexion).indexOf(":");
  if (i <= 0) return null;
  return { login: String(args.connexion).slice(0, i), motDePasse: String(args.connexion).slice(i + 1) };
};

// ------------------------------------------------------------------ principale
async function principale() {
  const args = analyserArgs(process.argv.slice(2));
  if (args.aide) { process.stdout.write(AIDE); return; }

  const journal = (m) => { if (!args.silence) console.log(m); };
  const ecriture = String(args.ecriture || "aucune").toLowerCase();
  if (!["aucune", "flux", "pleine"].includes(ecriture)) {
    throw new Error(`--ecriture doit valoir aucune, flux ou pleine (reçu : « ${args.ecriture} »).`);
  }

  // ---------------------------------------------------------------- la cible
  let url = args.url ? String(args.url) : "";
  let base = null;
  if (args["sans-base"]) {
    const lance = await demarrerServiceInterne({ args, journal });
    url = lance.url;
    base = lance.base;
  }
  if (!url) throw new Error("Indiquez --url <adresse>, ou --sans-base pour lancer le service sur place.");
  const hote = hoteDe(url);
  if (ecriture !== "aucune" && !BOUCLE_LOCALE.test(hote) && !args.confirme) {
    throw new Error(
      "Campagne d'ÉCRITURE sur « " + hote + " » : elle modifierait ses données (registre, présence, journal).\n" +
      "Si c'est bien ce que vous voulez — sur un déploiement de TRAVAIL, jamais sur la base de service d'une collectivité —, ajoutez --confirme.",
    );
  }

  const client = creerClient({ base: url, jeton: args.jeton ? String(args.jeton) : "" });
  let comptes = {};
  const connexionAdmin = depuisConnexion(args);
  if (connexionAdmin) comptes.administrateur = connexionAdmin;
  comptes = { ...comptes, ...(await lireComptes(args)) };
  // Lancé sur place, le service amorce lui-même son compte d'administration :
  // c'est celui-là que la campagne emploie, sans rien demander à l'opérateur.
  if (args["sans-base"] && !comptes.administrateur) {
    comptes.administrateur = { login: "charge-admin", motDePasse: MDP_DE_CHARGE };
  }

  // ------------------------------------------------- la session privilégiée
  // Elle sert à la reconnaissance et à la semence : c'est elle qui lit les
  // publications et les collections, et qui crée les comptes de charge.
  const potAdmin = potVide();
  if (!client.jeton) {
    const identifiants = comptes.administrateur;
    if (!identifiants) {
      throw new Error("Sans --jeton, il faut des identifiants d'administration : --connexion login:motDePasse, ou --comptes fichier.json (rôle « administrateur »).");
    }
    const r = await client.envoyer(potAdmin, { method: "POST", chemin: "/v1/auth/connexion", corps: identifiants });
    if (r.status !== 200) throw new Error(`Connexion d'administration refusée (${r.status}) : ${(r.json && (r.json.erreur || r.json.message)) || r.texte.slice(0, 160)}`);
    if (r.json && r.json.csrf) potAdmin.enteteCsrf = r.json.csrf;
    journal(`Session d'administration ouverte (« ${identifiants.login} »).`);
  }

  // ------------------------------------------------------------- la semence
  let resumeSemence = null;
  if (args.semence || args["sans-base"]) {
    journal("Semence de la cible…");
    if (!client.jeton) {
      const comptesDeCharge = await semerComptes(client, potAdmin).catch((e) => { journal("  comptes de charge : " + e.message); return {}; });
      for (const [role, v] of Object.entries(comptesDeCharge)) if (!comptes[role]) comptes[role] = v;
    }
    resumeSemence = await semer(client, potAdmin, {
      actes: nombre(args.actes, 60),
      trames: nombre(args.trames, 25),
      informations: nombre(args.informations, 8),
      publications: nombre(args.publications, 12),
      tailleActe: nombre(args["taille-acte"], 45000),
    });
    journal(`Semence : ${resumeSemence.actes} actes, ${resumeSemence.trames} trames, ${resumeSemence.informations} informations, ${resumeSemence.publications} publications.`);
    for (const e of resumeSemence.erreurs) journal("  semence : " + e);
  }

  // --------------------------------------------------------- la reconnaissance
  const ctx = await decouvrir(client, potAdmin);
  journal(`Cible : ${ctx.publications.length} publication(s), ${ctx.actes.length} acte(s), ${ctx.trames.length} trame(s) au registre, ${ctx.informations.length} information(s).`);
  if (!ctx.publications.length) journal("  (aucune publication : le recueil public n'aura pas de matière — voyez --semence)");

  // ----------------------------------------------------------------- le plan
  const spec = args.profils ? String(args.profils) : "public=20,lecteur=4,redacteur=6,administrateur=1";
  const ecartes = [];
  const plan = planDepuisSpec(spec).filter((p) => {
    if (!p.profil.session || client.jeton) return true;
    const c = comptes[p.profil.role] || comptes["*"];
    if (c && c.login) return true;
    ecartes.push(p.profil.id);
    return false;
  });
  if (ecartes.length) journal(`Profils écartés faute d'identifiants : ${ecartes.join(", ")} (renseignez --comptes).`);
  if (!effectifTotal(plan)) throw new Error("Aucun profil à jouer.");
  journal("Plan de charge : " + plan.map((p) => `${p.profil.id}×${p.effectif}`).join(", "));
  journal(`Durée ${nombre(args.duree, 60)} s, pensée ${nombre(args.pensee, 1500)} ms, montée ${nombre(args.montee, 0)} ms, écriture « ${ecriture} ».`);

  // ---------------------------------------------------------------- la charge
  let dernierAffichage = 0;
  const resultat = await lancerCharge({
    plan,
    contexte: ctx,
    requete: (poste, demande) => client.requete(poste, demande),
    ouvrirPoste: (poste) => client.ouvrirSession({ ...poste, identifiants: comptes[poste.profil.role] || comptes["*"] }),
    dureeMs: nombre(args.duree, 60) * 1000,
    penseeMs: nombre(args.pensee, 1500),
    monteeMs: nombre(args.montee, 0),
    graine: nombre(args.graine, 1),
    ecriture,
    surPas: (agregat, debut) => {
      if (args.silence) return;
      const t = Date.now();
      if (t - dernierAffichage < 3000) return;
      dernierAffichage = t;
      const ecoule = ((t - debut) / 1000).toFixed(0);
      process.stdout.write(`\r  ${ecoule}s — ${agregat.total} requêtes, ${(agregat.total / Math.max(1, (t - debut) / 1000)).toFixed(0)} req/s, ${agregat.erreurs} échec(s)     `);
    },
  });
  if (!args.silence) process.stdout.write("\r" + " ".repeat(90) + "\r");

  const agregat = resultat.agregat;
  const sql = base ? base.stats() : null;
  const notes = [];
  if (resumeSemence) notes.push(`Cible semée avant la mesure : ${resumeSemence.actes} actes, ${resumeSemence.trames} trames, ${resumeSemence.publications} publications.`);
  if (base) notes.push("Campagne jouée sur le service lancé SUR PLACE, avec une base EN MÉMOIRE : les latences disent le coût du SERVICE, pas celui d'un serveur de base.");
  if (ecartes.length) notes.push(`Profils écartés faute d'identifiants : ${ecartes.join(", ")}.`);
  if (ecriture !== "aucune") notes.push(`Campagne d'ÉCRITURE (« ${ecriture} ») : la cible a été modifiée.`);

  const rapport = rapportMarkdown({
    cible: url,
    debut: resultat.debut,
    fin: resultat.fin,
    effectif: resultat.effectif,
    agregat,
    sql,
    latence: nombre(args.latence, 0),
    pensee: nombre(args.pensee, 1500),
    notes,
  });

  const fichier = String(args.sortie || `rapport-charge-${horodatage()}.md`);
  await writeFile(fichier, rapport, "utf8");

  const total = resumer([...agregat.etapes.values()].flatMap((e) => e.ms));
  console.log("");
  console.log(`Requêtes : ${agregat.total} — débit ${(agregat.total / Math.max(0.001, (resultat.fin - resultat.debut) / 1000)).toFixed(1)} /s — échecs ${agregat.erreurs}`);
  console.log(`Latence globale : p50 ${total.p50} ms, p95 ${total.p95} ms, p99 ${total.p99} ms, max ${total.max} ms`);
  const pire = [...agregat.etapes.values()].map((e) => ({ nom: e.nom, r: resumer(e.ms) })).sort((a, b) => b.r.p99 - a.r.p99).slice(0, 6);
  for (const p of pire) console.log(`  ${p.nom} : p50 ${p.r.p50} / p95 ${p.r.p95} / p99 ${p.r.p99} / max ${p.r.max} ms`);
  if (sql) console.log(`Ordres SQL : ${sql.ordres} (${(sql.ordres / Math.max(1, agregat.total)).toFixed(2)} par requête HTTP)`);
  console.log(`Rapport écrit : ${fichier}`);

  // Le service lancé sur place n'a plus rien à faire : on rend la main.
  if (base) process.exit(0);
}

principale().catch((e) => {
  console.error("");
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
