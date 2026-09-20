// ============================================================================
// Hôtes d'exécution — édition auto-hébergée.
//
// Dans l'édition en ligne, deux services sont fournis par l'environnement et atteints
// via l'objet global `root` :
//
//   root.kv                 stockage clé/valeur par dossier
//   root.createServerSocket canal vers l'API du service
//
// Hors de cet environnement, ce fichier fournit le premier (IndexedDB — le stockage du
// navigateur, donc le mode « local » reste disponible) et signale au second qu'il
// doit passer par HTTP : `src/lib/remote.js` appelle alors directement l'API REST
// du service auto-hébergé (`/v1/...`), servie par le même domaine.
//
// `config.js` (produit par le conteneur à partir de son environnement) peut poser
// `window.__SCRIBA_CONFIG__ = { apiBase, apiToken }`. Rien n'est obligatoire : sans
// jeton, seules les lectures publiques de l'API fonctionnent.
//
// Un troisième service d'hôte est FACULTATIF : un relais HTTP sans CORS
// (`superFetch`), que réclame la numérotation externe (Administration ›
// Numérotation) pour atteindre un service tiers — Grist, par exemple. Il n'est
// **pas** fourni ici : une installation auto-hébergée ne peut donc appeler un
// service de numérotation qu'en « appel direct », avec l'origine de l'application
// déclarée origine de confiance chez le service. Un relais côté service est au
// programme (voir `src/TODO.md`) : il aurait sa place dans ce fichier.
// ============================================================================
(function () {
  "use strict";

  var config = window.__SCRIBA_CONFIG__ || {};
  window.__SCRIBA_SELF_HOSTED__ = true;
  window.__SCRIBA_API_BASE__ = config.apiBase || "";
  if (config.apiToken) window.__SCRIBA_API_TOKEN__ = config.apiToken;

  // Les services de la plateforme ont la priorité s'ils existent déjà.
  if (window.root && window.root.kv) return;

  // --------------------------------------------------------------- stockage
  var DB_NAME = "scriba-publicus";
  var DB_VERSION = 1;
  var STORE = "kv";
  var SEP = "\u0000";

  var memoire = new Map();
  var degrade = false;
  var opening = null;

  function ouvrir() {
    if (opening) return opening;
    opening = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("IndexedDB indisponible")); return; }
      var req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains(STORE)) {
          var s = d.createObjectStore(STORE, { keyPath: "id" });
          s.createIndex("folder", "folder", { unique: false });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("ouverture impossible")); };
      req.onblocked = function () { reject(new Error("base déjà ouverte dans un autre onglet")); };
    });
    return opening;
  }

  // Le repli mémoire n'intervient que si IndexedDB est inaccessible (navigation
  // privée, quota, navigateur ancien) : l'application reste utilisable, sans
  // persistance — exactement comme le fait le pilote local.
  function basculerMemoire(e) {
    if (!degrade) {
      degrade = true;
      console.warn("Stockage IndexedDB indisponible, repli en mémoire pour cette session :", (e && e.message) || e);
    }
  }

  function requete(ref) {
    return new Promise(function (resolve, reject) {
      ref.onsuccess = function () { resolve(ref.result); };
      ref.onerror = function () { reject(ref.error); };
    });
  }

  function executer(mode, fn) {
    return ouvrir().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(STORE, mode);
        var out;
        try { out = fn(t.objectStore(STORE)); } catch (e) { reject(e); return; }
        t.oncomplete = function () { Promise.resolve(out).then(resolve, reject); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  var cle = function (folder, key) { return folder + SEP + String(key); };

  function get(folder, key) {
    if (degrade) return Promise.resolve(memoire.get(cle(folder, key)));
    return executer("readonly", function (s) { return requete(s.get(cle(folder, key))); })
      .then(function (r) { return r ? r.value : undefined; })
      .catch(function (e) { basculerMemoire(e); return memoire.get(cle(folder, key)); });
  }

  function set(folder, key, value) {
    memoire.set(cle(folder, key), value);
    if (degrade) return Promise.resolve();
    return executer("readwrite", function (s) {
      return requete(s.put({ id: cle(folder, key), folder: folder, key: String(key), value: value }));
    }).catch(function (e) { basculerMemoire(e); });
  }

  function del(folder, key) {
    memoire.delete(cle(folder, key));
    if (degrade) return Promise.resolve();
    return executer("readwrite", function (s) { return requete(s.delete(cle(folder, key))); })
      .catch(function (e) { basculerMemoire(e); });
  }

  function tous(folder) {
    if (degrade) {
      var out = [];
      memoire.forEach(function (v, k) {
        if (k.slice(0, folder.length + 1) === folder + SEP) out.push({ key: k.slice(folder.length + 1), value: v });
      });
      return Promise.resolve(out);
    }
    return executer("readonly", function (s) { return requete(s.index("folder").getAll(folder)); })
      .then(function (rows) { return (rows || []).map(function (r) { return { key: r.key, value: r.value }; }); })
      .catch(function (e) { basculerMemoire(e); return tous(folder); });
  }

  function dossier(nom) {
    return {
      get: function (key) { return get(nom, key); },
      set: function (key, value) { return set(nom, key, value); },
      delete: function (key) { return del(nom, key); },
      keys: function () { return tous(nom).then(function (rows) { return rows.map(function (r) { return r.key; }); }); },
      values: function () { return tous(nom).then(function (rows) { return rows.map(function (r) { return r.value; }); }); },
      entries: function () { return tous(nom).then(function (rows) { return rows.map(function (r) { return [r.key, r.value]; }); }); },
      getMany: function (keys) { return Promise.all((keys || []).map(function (k) { return get(nom, k); })); },
      setMany: function (pairs) {
        return (pairs || []).reduce(function (p, pair) { return p.then(function () { return set(nom, pair[0], pair[1]); }); }, Promise.resolve());
      },
      deleteMany: function (keys) {
        return (keys || []).reduce(function (p, k) { return p.then(function () { return del(nom, k); }); }, Promise.resolve());
      },
      update: function (key, fn) {
        return get(nom, key).then(function (cur) {
          var next = fn(cur);
          return set(nom, key, next).then(function () { return next; });
        });
      },
      clear: function () {
        return tous(nom).then(function (rows) {
          return rows.reduce(function (p, r) { return p.then(function () { return del(nom, r.key); }); }, Promise.resolve());
        });
      },
    };
  }

  var dossiers = Object.create(null);
  window.root = window.root || {};
  window.root.kv = new Proxy({}, {
    get: function (_, nom) {
      if (typeof nom !== "string") return undefined;
      return dossiers[nom] || (dossiers[nom] = dossier(nom));
    },
  });
})();
