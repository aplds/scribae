// ============================================================================
// LE MAGASIN FICHIER — le service sans MariaDB.
//
// POURQUOI. Une collectivité peut vouloir un service d'actes sans administrer de
// serveur de base de données : un poste, une petite mairie, une machine où l'on
// ne veut qu'un logiciel. Le volume tient dans quelques mégaoctets, et une
// sauvegarde par simple copie de dossier vaut alors mieux qu'un `mysqldump` que
// personne ne pense à lancer. `STOCKAGE=fichier` range donc tout dans un
// dossier (`DATA_DIR`, `./data` par défaut), EN CLAIR — lisible, inspectable,
// copiable :
//
//   data/
//     etat.json                  l'état de signature/publication (un document)
//     collections/<nom>.json     une collection = { revision, records }
//     journal.jsonl              le journal technique (une ligne JSON par geste)
//     courriel.jsonl             la trace des courriels (une ligne par envoi)
//     secrets/mots-de-passe.json les empreintes de mots de passe (jamais en clair)
//     secrets/sessions.json      les sessions ouvertes
//     STOCKAGE.json              la version du rangement (pour les migrations)
//     LISEZ-MOI.txt              ce que ce dossier contient, et comment le sauver
//
// CE QUI NE CHANGE PAS. Le protocole est celui du magasin (voir magasin.mjs) :
// mêmes révisions, mêmes conflits, même journal, même recherche de compte par
// identifiant. L'application ne peut pas distinguer une installation MariaDB
// d'une installation à fichiers — c'est délibéré, et c'est ce qui permet aux
// épreuves du domaine de passer sur les deux.
//
// CE QUI CHANGE. L'écriture est atomique (fichier temporaire puis renommage) et
// SÉRIALISÉE par une file interne : deux requêtes concurrentes ne peuvent pas
// s'écrire l'une par-dessus l'autre. Le service est un processus unique ; les
// commandes de ligne de commande (`--mot-de-passe`) écrivent, elles, dans leur
// propre processus — on ne les lance donc pas PENDANT que le service tourne
// (c'est dit dans docs/ADMINISTRATION.md).
//
// LES PRIMITIVES DE DISQUE SONT INJECTÉES. Le module ne connaît pas `node:fs` :
// il reçoit un objet `io` (lire, écrire, renommer, supprimer, lister,
// créerDossier) et des chemins RELATIFS au dossier de données. C'est ce qui
// permet de l'éprouver entièrement en mémoire (magasin-fichier.test.mjs), sans
// écrire un octet sur le disque de la machine qui exécute les épreuves.
// ============================================================================

import * as disque from "node:fs/promises";
import { emptyState } from "./actes.mjs";
import { synchroniser as synchroniserCommun } from "./magasin.mjs";

// --------------------------------------------------------------------- disque
// L'implémentation par défaut, sur le dossier de données. `ecrireTexte` n'est
// jamais appelé seul pour une écriture durable : `ecrireAtomique` écrit un
// fichier temporaire, puis le RENOMME — un renommage est atomique sur un même
// système de fichiers, donc un lecteur voit toujours soit l'ancien contenu, soit
// le nouveau, jamais un fichier à moitié écrit (coupure de courant comprise).
//
// Le module est importé en ESPACE DE NOMS (`* as disque`) et les chemins sont
// assemblés par concaténation : ce fichier n'a ainsi AUCUNE dépendance à
// `node:path`, et reste importable par le harnais d'épreuves — qui n'a ni
// système de fichiers, ni module `path` (voir magasin-fichier.test.mjs, qui
// injecte son propre `io` en mémoire).
export function ioDisque(dossier) {
  const abs = (p) => `${dossier}/${p}`;
  const absent = (e) => e && (e.code === "ENOENT" || e.code === "ENOTDIR");
  return {
    async lireTexte(p) {
      try { return await disque.readFile(abs(p), "utf8"); } catch (e) { if (absent(e)) return null; throw e; }
    },
    async ecrireTexte(p, texte) { await disque.writeFile(abs(p), texte, "utf8"); },
    async renommer(a, b) { await disque.rename(abs(a), abs(b)); },
    async supprimer(p) { try { await disque.unlink(abs(p)); } catch (e) { if (!absent(e)) throw e; } },
    async lister(p) { try { return await disque.readdir(abs(p)); } catch (e) { if (absent(e)) return []; throw e; } },
    async creerDossier(p) { await disque.mkdir(abs(p), { recursive: true }); },
  };
}

const LISEZ_MOI = [
  "Dossier de données de Scribae (STOCKAGE=fichier).",
  "",
  "Ces fichiers sont les données du service, EN CLAIR : ils contiennent le",
  "référentiel, les trames, les actes, les compte-rendus de signature et de",
  "publication. Les mots de passe n'y figurent jamais en clair (seule leur",
  "empreinte scrypt est conservée), mais tout le reste est lisible tel quel.",
  "",
  "SAUVEGARDE : copiez ce dossier entier. C'est tout.",
  "RESTAURATION : replacez-le à la place de celui-ci, service arrêté.",
  "",
  "Ne modifiez pas ces fichiers à la main : la cohérence des révisions (et donc",
  "la détection des conflits entre postes) en dépend.",
  "",
].join("\n");

// ------------------------------------------------------------------ fabrique
export function creerMagasinFichier({ dossier = "./data", io = ioDisque(dossier), journal = () => {} } = {}) {
  // La FILE D'ÉCRITURE. Node est mono-fil, mais une écriture se compose de
  // plusieurs `await` (lire, modifier, écrire le temporaire, renommer) : deux
  // requêtes peuvent s'y entrelacer et perdre l'une des deux modifications. Toute
  // écriture passe donc par cette file, une à la fois.
  let file = Promise.resolve();
  const enfiler = (travail) => {
    const suite = file.then(travail, travail);
    file = suite.then(() => {}, () => {});
    return suite;
  };

  async function ecrireAtomique(chemin, texte) {
    await io.ecrireTexte(chemin + ".tmp", texte);
    await io.renommer(chemin + ".tmp", chemin);
  }

  // ------------------------------------------------------------- collections
  // Un document de collection : `{ revision, records: { <id>: { rev, ord, payload } } }`.
  // `revision` est celle de la COLLECTION (elle avance à chaque écriture
  // appliquée) ; `rev` est celle de l'ENREGISTREMENT — c'est elle que compare le
  // contrôle de conflit, exactement comme la colonne `revision` de `sb_record`.
  async function lireDoc(nom) {
    const texte = await io.lireTexte(`collections/${nom}.json`);
    if (texte === null) return { revision: 0, records: {} };
    const d = JSON.parse(texte);
    return { revision: Number(d.revision) || 0, records: d.records && typeof d.records === "object" ? d.records : {} };
  }

  async function ecrireDoc(nom, doc) {
    await ecrireAtomique(`collections/${nom}.json`, JSON.stringify(doc));
  }

  const ordre = (a, b) => (a.ord !== b.ord ? a.ord - b.ord : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  async function lireCollection(nom) {
    const doc = await lireDoc(nom);
    return Object.entries(doc.records)
      .map(([id, r]) => ({ id, rev: Number(r.rev) || 0, ord: Number(r.ord) || 0, payload: r.payload === undefined ? null : r.payload }))
      .sort(ordre);
  }

  // Écriture d'UN enregistrement hors synchronisation (l'amorçage du compte
  // d'administration, la remise d'un mot de passe) : la révision de la
  // collection avance, comme le fait `sync` et comme le fait le magasin MySQL
  // (comptes.mjs, `ecrireCompte`).
  async function ecrireEnregistrementDirect(nom, id, payload, actor = "service") {
    return enfiler(async () => {
      const doc = await lireDoc(nom);
      doc.revision += 1;
      doc.records[String(id)] = { rev: doc.revision, ord: doc.records[String(id)] ? doc.records[String(id)].ord || 0 : 0, payload };
      await ecrireDoc(nom, doc);
      return { rev: doc.revision };
    });
  }

  // --------------------------------------------------------------- journaux
  async function ajouterLignes(chemin, lignes) {
    const ancien = (await io.lireTexte(chemin)) || "";
    await ecrireAtomique(chemin, ancien + lignes.map((l) => JSON.stringify(l)).join("\n") + "\n");
  }

  const journaliserCourriel = (champs) => enfiler(() => ajouterLignes("courriel.jsonl", [{
    evenement: String(champs.evenement || "courriel").slice(0, 64),
    acte_id: champs.acteId || null,
    cible: champs.cible || null,
    destinataires: (champs.destinataires || []).map((d) => (d && d.courriel) || d).filter(Boolean).join(", ").slice(0, 2000) || null,
    sujet: String(champs.sujet || "").slice(0, 255) || null,
    envoye: !!champs.envoye,
    motif: String(champs.motif || "").slice(0, 500) || null,
    acteur: champs.acteur || null,
    remote_ip: champs.ip || null,
    at: new Date().toISOString(),
  }]));

  async function derniersCourriels(n = 20) {
    const texte = (await io.lireTexte("courriel.jsonl")) || "";
    const lignes = texte.split("\n").filter((l) => l.trim());
    return lignes.slice(-Math.max(1, Math.min(100, Number(n) || 20))).reverse()
      .map((l) => { try { return JSON.parse(l); } catch (e) { return null; } })
      .filter(Boolean)
      .map((r) => ({ ...r, envoye: r.envoye === true }));
  }

  // ------------------------------------------------------------- les secrets
  // Les mots de passe et les sessions. Ce sont les SEULS fichiers qui pourraient
  // porter un secret, et ils n'en portent pas : `hash` est un dérivé scrypt, les
  // sessions ne sont rangées que par l'EMPREINTE de leur jeton (voir
  // comptes.mjs). Le reste du dossier est public par nature.
  const lireSecrets = async (nom) => {
    const texte = await io.lireTexte(`secrets/${nom}.json`);
    if (texte === null) return {};
    try { return JSON.parse(texte) || {}; } catch (e) { return {}; }
  };
  const ecrireSecrets = (nom, objet) => enfiler(() => ecrireAtomique(`secrets/${nom}.json`, JSON.stringify(objet)));
  const modifierSecrets = (nom, fn) => enfiler(async () => {
    const objet = await lireSecrets(nom);
    const rendu = fn(objet) || objet;
    await ecrireAtomique(`secrets/${nom}.json`, JSON.stringify(rendu));
    return rendu;
  });

  const iso = (v) => (v == null || v === "" ? null : new Date(v).toISOString());

  // ------------------------------------------------------- le magasin des comptes
  // Même surface que `createStoreMysql` (comptes.mjs) — et mêmes FORMES de
  // réponse : le domaine lit `ligne.expires_at`, `mdp.bloque_jusqua`, etc. La
  // correspondance n'est donc pas un détail de rangement, c'est le contrat du
  // magasin des comptes, et il est identique pour les deux.
  const store = {
    async lireCompte(id) {
      const doc = await lireDoc("users");
      const r = doc.records[String(id)];
      return r && r.payload ? r.payload : null;
    },
    async lireCompteParLogin(login) {
      const doc = await lireDoc("users");
      const voulu = String(login).toLowerCase();
      for (const r of Object.values(doc.records)) {
        const p = r && r.payload;
        if (p && String(p.login || "").toLowerCase() === voulu) return p;
      }
      return null;
    },
    async ecrireCompte(compte) {
      await ecrireEnregistrementDirect("users", String(compte.id), compte, "service");
      return true;
    },
    async listerComptesDemo() {
      const doc = await lireDoc("users");
      return Object.values(doc.records).map((r) => r && r.payload).filter((p) => p && p.source === "demo");
    },
    async lireMdp(userId) {
      const mdp = await lireSecrets("mots-de-passe");
      return mdp[String(userId)] || null;
    },
    async ecrireMdp(userId, { hash, mustChange = false }) {
      await modifierSecrets("mots-de-passe", (m) => {
        m[String(userId)] = { hash, must_change: mustChange ? 1 : 0, echecs: 0, bloque_jusqua: null, updated_at: new Date().toISOString() };
        return m;
      });
    },
    async majEchecs(userId, { echecs, bloqueJusqua }) {
      await modifierSecrets("mots-de-passe", (m) => {
        const l = m[String(userId)];
        if (l) { l.echecs = Number(echecs) || 0; l.bloque_jusqua = iso(bloqueJusqua); l.updated_at = new Date().toISOString(); }
        return m;
      });
    },
    async listerMdp() {
      const mdp = await lireSecrets("mots-de-passe");
      return Object.entries(mdp).map(([userId, l]) => ({
        userId, mustChange: !!l.must_change, echecs: Number(l.echecs) || 0,
        bloqueJusqua: l.bloque_jusqua || null, updatedAt: l.updated_at || null,
      }));
    },
    async supprimerMdp(userId) {
      await modifierSecrets("mots-de-passe", (m) => { delete m[String(userId)]; return m; });
      await modifierSecrets("sessions", (s) => { for (const [h, v] of Object.entries(s)) if (String(v.user_id) === String(userId)) delete s[h]; return s; });
    },
    async creerSession({ tokenHash, userId, at, expiresAt, ip, userAgent }) {
      await modifierSecrets("sessions", (s) => {
        s[tokenHash] = {
          user_id: String(userId), created_at: iso(at), last_seen_at: iso(at),
          expires_at: iso(expiresAt), remote_ip: ip || null, user_agent: String(userAgent || "").slice(0, 255) || null,
        };
        return s;
      });
    },
    async lireSession(tokenHash) {
      const s = await lireSecrets("sessions");
      return s[tokenHash] || null;
    },
    async toucherSession(tokenHash, at) {
      await modifierSecrets("sessions", (s) => { if (s[tokenHash]) s[tokenHash].last_seen_at = iso(at); return s; });
    },
    async supprimerSession(tokenHash) {
      await modifierSecrets("sessions", (s) => { delete s[tokenHash]; return s; });
    },
    async purgerSessions(at) {
      const seuil = new Date(at).getTime();
      await modifierSecrets("sessions", (s) => {
        for (const [h, v] of Object.entries(s)) if (new Date(v.expires_at).getTime() < seuil) delete s[h];
        return s;
      });
    },
  };

  // ------------------------------------------------------------------- le magasin
  return {
    type: "fichier",
    resume: {
      driver: "fichier",
      // NON PARTAGÉE : deux postes ne peuvent pas écrire dans le même dossier par
      // le réseau sans se marcher dessus — le rangement par fichiers suppose UN
      // service, sur UNE machine. C'est dit à l'écran de santé, et dans la
      // documentation.
      partagee: false,
      message: "Données rangées en fichiers, dans le dossier de données du service.",
      base: { hote: "dossier local", port: 0, schema: dossier },
    },
    store,

    async lireConfig() {
      const doc = await lireDoc("config");
      const r = doc.records["self"];
      return r && r.payload ? r.payload : null;
    },

    async lireEtat() {
      try {
        const texte = await io.lireTexte("etat.json");
        if (texte === null) return { etat: emptyState(), degrade: false };
        return { etat: { ...emptyState(), ...JSON.parse(texte) }, degrade: false };
      } catch (e) {
        // Fichier absent = installation neuve (ce n'est PAS dégradé) ; fichier
        // illisible ou corrompu = état de secours, et on le DIT — comme le fait
        // le magasin MySQL quand la table manque.
        console.error("État du service illisible :", e.message);
        return { etat: emptyState(), degrade: true };
      }
    },

    async ecrireEtat(json) {
      await enfiler(() => ecrireAtomique("etat.json", json));
      return true;
    },

    lireCollection,

    async lireRevisionCollection(nom) { return (await lireDoc(nom)).revision; },

    async synchroniser(opts) {
      return enfiler(async () => {
        const doc = await lireDoc(opts.collection);
        const lignes = [];
        const t = {
          async lireRevision() { return doc.revision; },
          async ecrireRevision(_nom, n) { doc.revision = n; },
          async lireEnregistrement(_nom, id) {
            const r = doc.records[id];
            return r ? { rev: Number(r.rev) || 0, ord: Number(r.ord) || 0, payload: r.payload === undefined ? null : r.payload } : null;
          },
          async ecrireEnregistrement(_nom, { id, rev, ord, payload }) { doc.records[id] = { rev, ord, payload }; },
          async supprimerEnregistrement(_nom, id) { delete doc.records[id]; },
          async journaliser(entrees) { for (const e of entrees) lignes.push({ ...e, at: new Date().toISOString() }); },
        };
        const r = await synchroniserCommun(t, opts);
        if (r.applied.length) {
          await ecrireDoc(opts.collection, doc);
          if (lignes.length) await ajouterLignes("journal.jsonl", lignes);
        }
        return r;
      });
    },

    async sante() {
      // Le pendant de « la base répond-elle ? » : le dossier est-il là, et
      // utilisable ? `creerDossier` est idempotent — c'est aussi ce qui fait
      // qu'une première installation se met en route toute seule.
      await io.creerDossier("collections");
      await io.creerDossier("secrets");
      const noms = await io.lister("collections");
      const collections = {};
      for (const f of noms) {
        if (!f.endsWith(".json")) continue;
        const doc = await lireDoc(f.slice(0, -5));
        collections[f.slice(0, -5)] = { records: Object.keys(doc.records).length, revision: doc.revision };
      }
      return { moteur: "fichiers JSON", collections };
    },

    journaliserCourriel,
    derniersCourriels,

    async preparer() {
      await io.creerDossier("collections");
      await io.creerDossier("secrets");
      const version = await io.lireTexte("STOCKAGE.json");
      if (version === null) {
        await ecrireAtomique("STOCKAGE.json", JSON.stringify({ format: 1, cree: new Date().toISOString() }, null, 2) + "\n");
        await ecrireAtomique("LISEZ-MOI.txt", LISEZ_MOI);
        journal("info", `Rangement par fichiers : dossier de données créé (${dossier}).`);
        return { appliquees: ["dossier de données"], aJour: 1, total: 1 };
      }
      journal("info", `Rangement par fichiers : dossier de données déjà en place (${dossier}).`);
      return { appliquees: [], aJour: 1, total: 1 };
    },

    // Pas de compte de base à aligner : le dossier EST le compte.
    async reconcilier() {
      return { fait: false, sansObjet: true, motif: "Le rangement par fichiers n'a pas de compte de base de données à aligner." };
    },

    async fermer() { /* rien à libérer : la file d'écriture se vide d'elle-même */ },
  };
}
