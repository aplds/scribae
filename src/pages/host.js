// ============================================================================
// Édition statique (GitHub Pages) — hôtes d'exécution.
//
// L'application attend deux services de son hébergement, et les réclame par un
// point unique (`src/lib/hosts.js`) :
//
//   kv                  stockage clé/valeur par dossier
//   createServerSocket  canal vers l'API du service (dépôt, signature,
//                       publication, base de données partagée)
//
// Un troisième est FACULTATIF : un relais HTTP sans CORS (`superFetch`), que
// réclame la numérotation externe (Administration › Numérotation) pour atteindre un
// service tiers — Grist, par exemple — qu'un navigateur ne peut pas appeler
// lui-même. Il n'est **pas** fourni ici : sur une page statique, la numérotation
// externe ne fonctionne qu'en **appel direct**, avec l'origine de l'application
// déclarée origine de confiance chez le service. Un relais côté service est au
// programme (voir `src/TODO.md`).
//
// D'ordinaire l'hébergement les pose sur l'objet global `root`. Sur une page
// servie en statique (GitHub Pages), aucun des deux n'existe : ce fichier les
// fournit — sous `window.__SCRIBA_HOST__`, que `hosts.js` consulte en premier —
// pour que la démonstration soit complète **sans serveur**.
//
//   • le stockage est une base **IndexedDB** du navigateur (repli en mémoire si
//     elle est inaccessible) — exactement ce que fait le déploiement
//     auto-hébergé (`src/server/web/host.js`) ;
//   • le service est **le script serveur embarqué dans `index.html`** : on le
//     relit dans le DOM et on l'exécute ici, dans la page, avec un état durable
//     (IndexedDB). C'est le même code que celui qui tourne côté serveur — la
//     démonstration statique n'en réimplémente pas une ligne, elle l'héberge
//     dans l'onglet. Conséquence : ce service-ci est **propre au navigateur**,
//     donc ses fonctions dites « partagées » ne le sont qu'entre les onglets
//     d'un même poste (le libellé du mode le dit dans l'application).
//
// Ce fichier ne fait **rien** dans l'environnement d'édition, ni sur une page
// déjà servie par la plateforme, ni dans le déploiement auto-hébergé : les vrais
// services y sont présents. Poser `window.__SCRIBA_FORCE_STATIC__ = true` avant
// son exécution force l'inverse — c'est ainsi qu'on relit l'édition statique
// depuis l'éditeur.
//
// PARTAGE ENTRE POSTES. Par défaut, l'édition statique héberge son service, et
// son état vit donc dans le navigateur de chaque visiteur : deux personnes ne
// voient pas la même chose. Poser `window.__SCRIBA_SERVICE_URL__` AVANT ce
// fichier (une ligne dans `index.html`, ou un script de déploiement) branche la
// page sur un VRAI service — celui de `src/server/`, ou toute installation qui
// répond au même contrat : le stockage local reste (réglages, session, file
// d'attente), mais les collections passent par l'API (`/v1/db/…`), servie par
// ce service. C'est le geste qui donne un « recueil partagé » à un fork servi
// par GitHub Pages, sans rien changer d'autre : le service doit alors autoriser
// l'origine de la page (`CORS_ORIGINS`), et la page passe par le domaine du
// service (cookies de session et HTTP). Un service injoignable ne casse rien :
// l'application garde ses données locales et le dit par sa pastille d'état.
// ============================================================================
(function () {
  "use strict";

  var force = window.__SCRIBA_FORCE_STATIC__ === true;
  if (!force) {
    if (window.__SCRIBA_SELF_HOSTED__) return;                     // nginx : host.js du déploiement
    if (typeof window.generatorName === "string") return;           // servie par la plateforme
    if (typeof window.generatorPublicId === "string") return;
    if (window.root && window.root.kv && window.root.createServerSocket) return;
  }

  // Service distant : la page n'héberge plus le service, elle l'appelle. Les
  // services que l'application consulte sont fournis par `hosts.js` : sans
  // `createServerSocket`, `remote.js` passe par HTTP (voir `useHttp`), et le
  // pilotage de la base suit l'édition auto-hébergée (`mode: "external"`).
  var serviceUrl = String(window.__SCRIBA_SERVICE_URL__ || "").replace(/\/+$/, "");
  var serviceDistant = !!serviceUrl;
  if (serviceDistant) {
    window.__SCRIBA_SELF_HOSTED__ = true;
    window.__SCRIBA_API_BASE__ = serviceUrl;
  }
  // Ce que le bandeau de tête doit dire : une page servie en fichiers, mais
  // reliée à un service commun, n'est pas « sans partage » (voir src/ui/notice.js).
  window.__SCRIBA_STATIC_SHARED__ = serviceDistant;

  window.__SCRIBA_STATIC__ = true;
  // L'application lit les deux services dans `window.__SCRIBA_HOST__` (voir
  // `src/lib/hosts.js`). L'environnement d'édition ne se laisse pas écrire dans
  // son objet `root` : on ne le touche jamais. Sur une page statique, `root`
  // n'existe pas non plus — mais s'il existait un jour, on le laisserait
  // intact et le service viendrait quand même de ce fichier.
  var hote = window.__SCRIBA_HOST__ = window.__SCRIBA_HOST__ || {};
  var racineCreee = !window.root;
  if (racineCreee) window.root = {};

  // ------------------------------------------------------------------ la base
  // Une seule base pour les deux services : « kv » (dossiers de l'application)
  // et « service » (état durable du service embarqué).
  //
  // Le nom porte celui de l'édition : le déploiement auto-hébergé a la sienne
  // (« scriba-publicus », un magasin). Deux éditions ne partagent donc jamais
  // une base — et n'ont jamais à s'entendre sur un numéro de version.
  var DB_NAME = "scriba-publicus-static";
  var DB_VERSION = 1;
  var STORE_KV = "kv";
  var STORE_SERVICE = "service";
  var SEP = "\u0000";

  var ouverture = null;
  var degrade = false;
  var memoire = new Map();

  function ouvrir() {
    if (ouverture) return ouverture;
    ouverture = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("IndexedDB indisponible")); return; }
      var req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains(STORE_KV)) {
          var s = d.createObjectStore(STORE_KV, { keyPath: "id" });
          s.createIndex("folder", "folder", { unique: false });
        }
        if (!d.objectStoreNames.contains(STORE_SERVICE)) d.createObjectStore(STORE_SERVICE, { keyPath: "id" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("ouverture impossible")); };
      req.onblocked = function () { reject(new Error("base déjà ouverte dans un autre onglet")); };
    });
    return ouverture;
  }

  // Le repli mémoire n'intervient que si IndexedDB est inaccessible (navigation
  // privée, quota, navigateur ancien) : l'application reste utilisable, sans
  // persistance.
  function basculerMemoire(e) {
    if (degrade) return;
    degrade = true;
    console.warn("Stockage IndexedDB indisponible, repli en mémoire pour cette session :", (e && e.message) || e);
  }

  function requete(ref) {
    return new Promise(function (resolve, reject) {
      ref.onsuccess = function () { resolve(ref.result); };
      ref.onerror = function () { reject(ref.error); };
    });
  }

  function executer(store, mode, fn) {
    return ouvrir().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(store, mode);
        var out;
        try { out = fn(t.objectStore(store), t); } catch (e) { reject(e); return; }
        t.oncomplete = function () { Promise.resolve(out).then(resolve, reject); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  // ------------------------------------------------------------ 1. root.kv
  var cleKv = function (dossier, key) { return dossier + SEP + String(key); };

  function kvGet(dossier, key) {
    if (degrade) return Promise.resolve(memoire.get(cleKv(dossier, key)));
    return executer(STORE_KV, "readonly", function (s) { return requete(s.get(cleKv(dossier, key))); })
      .then(function (r) { return r ? r.value : undefined; })
      .catch(function (e) { basculerMemoire(e); return memoire.get(cleKv(dossier, key)); });
  }

  function kvSet(dossier, key, value) {
    memoire.set(cleKv(dossier, key), value);
    if (degrade) return Promise.resolve();
    return executer(STORE_KV, "readwrite", function (s) {
      return requete(s.put({ id: cleKv(dossier, key), folder: dossier, key: String(key), value: value }));
    }).catch(function (e) { basculerMemoire(e); });
  }

  function kvDel(dossier, key) {
    memoire.delete(cleKv(dossier, key));
    if (degrade) return Promise.resolve();
    return executer(STORE_KV, "readwrite", function (s) { return requete(s.delete(cleKv(dossier, key))); })
      .catch(function (e) { basculerMemoire(e); });
  }

  function kvTous(dossier) {
    if (degrade) {
      var out = [];
      memoire.forEach(function (v, k) {
        if (k.slice(0, dossier.length + 1) === dossier + SEP) out.push({ key: k.slice(dossier.length + 1), value: v });
      });
      return Promise.resolve(out);
    }
    return executer(STORE_KV, "readonly", function (s) { return requete(s.index("folder").getAll(dossier)); })
      .then(function (rows) { return (rows || []).map(function (r) { return { key: r.key, value: r.value }; }); })
      .catch(function (e) { basculerMemoire(e); return kvTous(dossier); });
  }

  function dossier(nom) {
    return {
      get: function (key) { return kvGet(nom, key); },
      set: function (key, value) { return kvSet(nom, key, value); },
      delete: function (key) { return kvDel(nom, key); },
      keys: function () { return kvTous(nom).then(function (rows) { return rows.map(function (r) { return r.key; }); }); },
      values: function () { return kvTous(nom).then(function (rows) { return rows.map(function (r) { return r.value; }); }); },
      entries: function () { return kvTous(nom).then(function (rows) { return rows.map(function (r) { return [r.key, r.value]; }); }); },
      getMany: function (keys) { return Promise.all((keys || []).map(function (k) { return kvGet(nom, k); })); },
      setMany: function (pairs) {
        return (pairs || []).reduce(function (p, pair) { return p.then(function () { return kvSet(nom, pair[0], pair[1]); }); }, Promise.resolve());
      },
      deleteMany: function (keys) {
        return (keys || []).reduce(function (p, k) { return p.then(function () { return kvDel(nom, k); }); }, Promise.resolve());
      },
      update: function (key, fn) {
        return kvGet(nom, key).then(function (cur) {
          var next = fn(cur);
          return kvSet(nom, key, next).then(function () { return next; });
        });
      },
      clear: function () {
        return kvTous(nom).then(function (rows) {
          return rows.reduce(function (p, r) { return p.then(function () { return kvDel(nom, r.key); }); }, Promise.resolve());
        });
      },
    };
  }

  var dossiers = Object.create(null);
  hote.kv = new Proxy({}, {
    get: function (_, nom) {
      if (typeof nom !== "string") return undefined;
      return dossiers[nom] || (dossiers[nom] = dossier(nom));
    },
  });

  // ------------------------------------- 2. root.createServerSocket (le service)
  // L'état du service est un tableau d'octets : c'est la mémoire durable qu'il
  // attend (`state`), et son format est le sien (en-tête de 4 unités UTF-16,
  // puis le JSON). On lui donne la capacité qu'il annonce : 8 000 000 caractères.
  var STATE_UNITS = 8000004 + 2;
  var stateBytes = null;
  var demarrage = null;
  var rpc = null;
  var enregistrement = false;
  var aEnregistrer = false;

  function lireService(cle) {
    if (degrade) return Promise.resolve(memoire.get("service" + SEP + cle));
    return executer(STORE_SERVICE, "readonly", function (s) { return requete(s.get(cle)); })
      .then(function (r) { return r ? r.value : undefined; })
      .catch(function (e) { basculerMemoire(e); return memoire.get("service" + SEP + cle); });
  }

  function ecrireService(cle, valeur) {
    memoire.set("service" + SEP + cle, valeur);
    if (degrade) return Promise.resolve();
    return executer(STORE_SERVICE, "readwrite", function (s) { return requete(s.put({ id: cle, value: valeur })); })
      .catch(function (e) { basculerMemoire(e); });
  }

  // On n'écrit que la partie utilisée de l'état (les écritures suivantes sont
  // bien plus légères que les 16 Mio de la capacité nominale).
  var ENTETE = 4;              // unités : version, longueur (2 unités), réservé
  var VERSION_ETAT = 2;        // doit suivre STATE_VERSION du script serveur

  function etatUtilise() {
    try {
      var u16 = new Uint16Array(stateBytes.buffer, 0, ENTETE);
      if (u16[0] !== VERSION_ETAT) return ENTETE * 2;
      var n = u16[1] + u16[2] * 65536;
      return Math.min(stateBytes.byteLength, (ENTETE + n) * 2);
    } catch (e) { return stateBytes ? stateBytes.byteLength : ENTETE * 2; }
  }

  function planifierEnregistrement() {
    aEnregistrer = true;
    if (enregistrement) return;
    enregistrement = true;
    (function boucle() {
      if (!aEnregistrer) { enregistrement = false; return; }
      aEnregistrer = false;
      var copie = stateBytes.slice(0, Math.max(4, etatUtilise()));
      ecrireService("etat", copie).then(boucle, boucle);
    })();
  }

  function service() {
    if (rpc) return rpc;
    var el = document.querySelector('script[type="text/x-server-plugin"]');
    var source = el ? (el.textContent || "") : "";
    if (!source) throw new Error("le script du service est introuvable dans la page");
    // Le script se termine par `self.rpc = {…}` : on lui fournit un `self` local
    // et on récupère ce qu'il y a déposé. Aucun `eval` du code par l'appelant :
    // c'est bien le service qui route et répond.
    var boite = {};
    var fabrique = new Function("state", "self", source + "\n;return self.rpc;");
    rpc = fabrique(stateBytes, boite);
    return rpc;
  }

  function demarrer() {
    if (demarrage) return demarrage;
    demarrage = lireService("etat").then(function (sauve) {
      var octets = new Uint8Array(STATE_UNITS * 2);
      if (sauve && sauve.byteLength) octets.set(sauve.subarray(0, Math.min(sauve.byteLength, octets.byteLength)));
      stateBytes = octets;
      console.info("Scribae — édition statique : service de démonstration embarqué (état dans ce navigateur).");
    }, function (e) {
      stateBytes = new Uint8Array(STATE_UNITS * 2);
      console.warn("Scribae — édition statique : état du service non persistant —", (e && e.message) || e);
    });
    return demarrage;
  }

  function api(raw) {
    return demarrer().then(function () {
      var sortie;
      try {
        sortie = service().api(null, raw);
      } catch (e) {
        sortie = JSON.stringify({
          status: 500, headers: {},
          body: { erreur: "Service embarqué indisponible : " + ((e && e.message) || e) },
        });
      }
      var methode = "GET";
      try { methode = String((JSON.parse(raw) || {}).method || "GET").toUpperCase(); } catch (e) {}
      if (methode !== "GET") planifierEnregistrement();
      return sortie;
    });
  }

  // Le service embarqué n'est monté que si la page n'est PAS reliée à un service
  // distant : dans ce second cas, c'est `remote.js` qui appelle l'API par HTTP
  // (la présence d'un `createServerSocket` l'en empêcherait).
  hote.createServerSocket = serviceDistant ? null : function () {
    var ouverts = [];
    var fermes = [];
    var sock = {
      readyState: 0,
      url: String(window.location.href),
      rpc: { api: api },
      send: function () {},
      addEventListener: function (type, fn) {
        if (type === "open") ouverts.push(fn);
        else if (type === "close") fermes.push(fn);
      },
      removeEventListener: function (type, fn) {
        var liste = type === "open" ? ouverts : type === "close" ? fermes : null;
        if (!liste) return;
        var i = liste.indexOf(fn);
        if (i >= 0) liste.splice(i, 1);
      },
      close: function () {
        if (sock.readyState === 3) return;
        sock.readyState = 3;
        fermes.forEach(function (f) { try { f({ code: 1000, reason: "fermeture demandée" }); } catch (e) {} });
      },
    };
    // Le canal s'ouvre au tour suivant : l'appelant a le temps de s'abonner, et
    // l'état durable est chargé avant la première requête.
    demarrer().then(function () {
      sock.readyState = 1;
      ouverts.forEach(function (f) { try { f({ type: "open" }); } catch (e) {} });
    });
    return sock;
  };

  // Sur une page statique, les deux services sont aussi exposés sur `root`,
  // comme le fait l'hébergement : tout code qui interroge cet objet les trouve.
  if (racineCreee) {
    window.root.kv = hote.kv;
    if (hote.createServerSocket) window.root.createServerSocket = hote.createServerSocket;
  }
})();
