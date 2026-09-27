// ============================================================================
// FUSION À TROIS VOIES — « ne rien perdre » quand deux postes écrivent.
//
// Le problème, tel qu'il se pose vraiment. La persistance partagée écrit
// ENREGISTREMENT PAR ENREGISTREMENT, avec une révision par enregistrement : un
// poste qui envoie une modification sur une révision périmée reçoit un CONFLIT au
// lieu d'écraser (voir docs/PERSISTANCE.md et magasin.mjs). C'est ce qui protège
// le travail des autres — mais la réponse au conflit était « le serveur gagne » :
// le poste perdait ce qu'il venait d'écrire, en bloc, et l'on découvrait le
// lendemain qu'une relecture avait effacé trois paragraphes.
//
// Or deux personnes qui modifient le même acte ne modifient presque jamais le
// MÊME CHAMP : l'une corrige l'objet, l'autre la date de signature ; l'une ajoute
// un visa, l'autre renseigne le numéro. Une fusion par CHAMP garde les deux.
//
// LA BASE. Une fusion à trois voies demande trois états :
//   • `base`  — l'état du serveur tel que CE poste le connaissait avant d'écrire
//               (c'est le `rev`/`json` de l'index de persistance : il est déjà
//               là, exactement pour cela) ;
//   • `notre` — ce que le poste veut écrire ;
//   • `leur`  — ce que le serveur détient à l'instant du conflit (le conflit le
//               renvoie : `payload`).
// Une valeur qui n'a bougé que d'un côté est prise de ce côté ; une valeur qui a
// bougé des deux côtés ne se devine pas — on garde LA NÔTRE et on la SIGNALE
// (l'écran la montre, le journal la garde). Jamais de perte silencieuse.
//
// CE QUI SE FUSIONNE FINEMENT
//   • les objets, clé par clé (y compris le référentiel, qui en est un) ;
//   • les listes d'objets IDENTIFIÉS (chaque élément porte un `id` unique) : les
//     trames, les actes, les comptes, mais aussi les listes INTERNES d'un
//     document — les articles, les visas, les items d'une liste, les questions
//     d'une trame. Une liste où l'un ajoute un visa et l'autre en retire un
//     autre donne le bon résultat.
// Ce qui ne se fusionne pas : les valeurs SIMPLES (un texte, une date, un
// nombre) et les listes NON identifiées (une liste de chaînes : les entités
// rattachées, par exemple). Là, le dernier qui écrit l'emporte et le désaccord
// est signalé — deviner une intention dans « a ; b ; c » n'aurait aucun sens.
//
// Le module est PUR : ni DOM, ni réseau, ni horloge. Il est donc éprouvé hors
// navigateur (tests/fusion.test.mjs) et employé par la façade de persistance
// (lib/db/index.js).
// ============================================================================

import { stableStringify } from "./db/contract.js";

// Profondeur maximale de fusion. Les documents de l'application sont des arbres
// peu profonds (document → blocs → items) ; au-delà, on cesse de descendre et le
// sous-arbre est traité comme une valeur simple — c'est un garde-fou, pas une
// limite qu'on atteint.
const PROFONDEUR_MAX = 24;

export const estObjet = (v) => !!v && typeof v === "object" && !Array.isArray(v);
export const egal = (a, b) => stableStringify(a) === stableStringify(b);

// Une liste « fusionnable » : tous ses éléments sont des objets porteurs d'un
// identifiant unique et non vide. Une liste vide l'est (par vacuité), ce qui
// permet à un poste qui part d'une liste vide de fusionner avec un poste qui
// part d'une liste pleine.
export function estListeIdentifiee(v) {
  if (!Array.isArray(v)) return false;
  const vus = new Set();
  for (const x of v) {
    if (!estObjet(x)) return false;
    const id = x.id;
    if (id === undefined || id === null || id === "") return false;
    const k = String(id);
    if (vus.has(k)) return false;
    vus.add(k);
  }
  return true;
}

// Un résumé lisible d'une valeur, pour le compte rendu d'un désaccord — jamais
// le document entier : une phrase suffit à dire ce qui a divergé.
export function resume(v, max = 120) {
  if (v === undefined) return "(absent)";
  const t = typeof v === "string" ? v : stableStringify(v);
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function fusionner(base, notre, leur, ctx) {
  // Une seule règle pour les cas simples, dans cet ordre :
  if (egal(notre, leur)) return leur;             // les deux disent la même chose
  if (egal(notre, base)) return leur;             // seul « leur » a bougé
  if (egal(leur, base)) return notre;             // seul « nous » a bougé
  // Les deux ont bougé, différemment : on descend si la forme s'y prête.
  if (ctx.profondeur < PROFONDEUR_MAX) {
    const t = { ...ctx, profondeur: ctx.profondeur + 1 };
    if (estObjet(base) && estObjet(notre) && estObjet(leur)) return fusionnerObjets(base, notre, leur, t);
    if (estListeIdentifiee(base) && estListeIdentifiee(notre) && estListeIdentifiee(leur)) return fusionnerListes(base, notre, leur, t);
  }
  // Rien à deviner : la nôtre est conservée, et le désaccord est signalé.
  if (ctx.desaccords.length < ctx.maxDesaccords) {
    ctx.desaccords.push({ chemin: ctx.chemin || "(racine)", base: resume(base), notre: resume(notre), leur: resume(leur) });
  }
  return notre;
}

function fusionnerObjets(base, notre, leur, ctx) {
  const out = {};
  const cles = new Set([...Object.keys(base), ...Object.keys(notre), ...Object.keys(leur)]);
  for (const k of cles) {
    // Une clé absente des trois côtés (ou `undefined` partout) n'existe pas : on
    // ne la fait pas naître d'une fusion (elle viendrait d'un `undefined` en
    // mémoire, que le transport JSON ne porte de toute façon pas).
    if (notre[k] === undefined && leur[k] === undefined) continue;
    const v = fusionner(base[k], notre[k], leur[k], { ...ctx, chemin: ctx.chemin ? ctx.chemin + "." + k : k });
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function fusionnerListes(base, notre, leur, ctx) {
  const parId = (liste) => new Map(liste.map((x) => [String(x.id), x]));
  const b = parId(base), n = parId(notre), l = parId(leur);
  // L'ORDRE vient de « leur » — c'est l'état que le serveur détient, donc le
  // plus récent —, suivi de nos ajouts, dans notre ordre : deux postes qui
  // ajoutent chacun un élément à la fin obtiennent les deux, dans un ordre
  // stable et prévisible.
  const ordre = [...l.keys(), ...n.keys()];
  const out = [];
  const vus = new Set();
  for (const id of ordre) {
    if (vus.has(id)) continue;
    vus.add(id);
    const dansNous = n.has(id), dansLeur = l.has(id), dansBase = b.has(id);
    const chemin = (ctx.chemin ? ctx.chemin + "[" + id + "]" : id);
    const signaler = () => {
      if (ctx.desaccords.length < ctx.maxDesaccords) {
        ctx.desaccords.push({
          chemin,
          base: resume(dansBase ? b.get(id) : undefined),
          notre: resume(dansNous ? n.get(id) : undefined),
          leur: resume(dansLeur ? l.get(id) : undefined),
        });
      }
    };
    if (dansNous && dansLeur) {
      out.push(fusionner(dansBase ? b.get(id) : {}, n.get(id), l.get(id), { ...ctx, chemin }));
      continue;
    }
    if (dansLeur) {
      // Nous ne l'avons plus : nous l'avons supprimé — ou nous ne l'avons jamais eu.
      if (!dansBase) { out.push(l.get(id)); continue; }                  // il est à eux : on le garde
      if (egal(b.get(id), l.get(id))) continue;                          // supprimé de notre côté, intact de l'autre : on honore
      signaler(); out.push(l.get(id));                                   // nous l'avons supprimé, ils l'ont modifié : on garde LEUR travail
      continue;
    }
    // Ils ne l'ont plus : ils l'ont supprimé — ou c'est notre ajout.
    if (!dansBase) { out.push(n.get(id)); continue; }                    // c'est notre ajout
    if (egal(b.get(id), n.get(id))) continue;                            // supprimé de leur côté, intact du nôtre : on honore
    signaler(); out.push(n.get(id));                                     // ils l'ont supprimé, nous l'avons modifié : on garde le NÔTRE
  }
  return out;
}

// Une écriture en attente de renvoi, que la base a refusée en conflit, se
// reprend ici : `{ valeur, desaccords }`.
//
//   base  l'état du serveur tel que ce poste le connaissait (objet relu, ou
//         `undefined` si l'enregistrement n'était pas connu de ce poste)
//   notre ce que ce poste veut écrire
//   leur  ce que le serveur détient (le `payload` rendu par le conflit)
export function fusionnerJson(base, notre, leur, { maxDesaccords = 20 } = {}) {
  const desaccords = [];
  const valeur = fusionner(base, notre, leur, { chemin: "", desaccords, maxDesaccords, profondeur: 0 });
  return { valeur, desaccords };
}

// De quoi écrire une phrase à l'écran : « objet », « visas[vis-2] »…
export function libelleDesaccord(d) {
  const c = String(d && d.chemin ? d.chemin : "");
  if (!c || c === "(racine)") return "l'ensemble du document";
  return c.replace(/\./g, " › ").replace(/\[/g, " ").replace(/\]/g, "");
}

// Le compte rendu, borné : au-delà de cinq désaccords, dire « et N autres »
// vaut mieux qu'énumérer tout le document.
export function decrireDesaccords(desaccords, max = 5) {
  const liste = Array.isArray(desaccords) ? desaccords : [];
  if (!liste.length) return "";
  const tete = liste.slice(0, max).map(libelleDesaccord).join(", ");
  return liste.length > max ? `${tete} et ${liste.length - max} autre(s)` : tete;
}
