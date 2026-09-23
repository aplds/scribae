// ============================================================================
// LES MESURES D'UNE ÉTUDE DE CHARGE — et ce qu'on en dit.
//
// POURQUOI DES CENTILES. Une moyenne ne dit rien d'une attente : un service qui
// répond en 30 ms quatre-vingt-dix-neuf fois et en 4 s la centième fois a une
// excellente moyenne et une expérience détestable. Ce qu'un agent remarque, ce
// sont les p99 et les maxima — et ce sont eux, ici, qui déclenchent les alertes.
//
// Module PUR : des nombres entrent, un tableau et du Markdown sortent.
// ============================================================================

// `valeurs` : une liste de durées en millisecondes (non triée).
export function centile(valeurs, p) {
  if (!valeurs || !valeurs.length) return 0;
  const trie = [...valeurs].sort((a, b) => a - b);
  const rang = (Math.max(0, Math.min(100, p)) / 100) * (trie.length - 1);
  const bas = Math.floor(rang);
  const haut = Math.ceil(rang);
  if (bas === haut) return trie[bas];
  return trie[bas] + (trie[haut] - trie[bas]) * (rang - bas);
}

export function resumer(valeurs) {
  if (!valeurs || !valeurs.length) return { n: 0, min: 0, moyenne: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0 };
  let somme = 0;
  let max = 0;
  // Le minimum et le maximum sont calculés EN BOUCLE, jamais par `Math.min(…v)` :
  // la saturation produit des seaux de plusieurs dizaines de milliers de durées,
  // et l'étalement d'un tel tableau en arguments fait sauter la pile (mesuré,
  // sur une campagne « pensée zéro »). Une boucle ne coûte rien et ne casse pas.
  let min = valeurs[0];
  for (const v of valeurs) { somme += v; if (v > max) max = v; if (v < min) min = v; }
  return {
    n: valeurs.length,
    min: Math.round(min * 10) / 10,
    moyenne: Math.round((somme / valeurs.length) * 10) / 10,
    p50: Math.round(centile(valeurs, 50) * 10) / 10,
    p90: Math.round(centile(valeurs, 90) * 10) / 10,
    p95: Math.round(centile(valeurs, 95) * 10) / 10,
    p99: Math.round(centile(valeurs, 99) * 10) / 10,
    max: Math.round(max * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// L'AGRÉGAT. Le moteur range chaque mesure dans un seau : un par étape, un par
// profil. On y garde les durées (pour les centiles), les codes HTTP et le
// volume échangé — de quoi écrire un rapport sans avoir conservé 200 000 lignes.
// ---------------------------------------------------------------------------
export function creerAgregat() {
  return { etapes: new Map(), profils: new Map(), total: 0, erreurs: 0, octets: 0, debut: 0, fin: 0 };
}

function seau(agregat, table, nom) {
  if (!table.has(nom)) table.set(nom, { nom, n: 0, erreurs: 0, ms: [], statuts: new Map(), octets: 0 });
  return table.get(nom);
}

export function noter(agregat, mesure) {
  const { etape: nom, profil, ms, statut, octets = 0, erreur = "" } = mesure;
  const e = seau(agregat, agregat.etapes, nom);
  e.n += 1;
  e.ms.push(ms);
  e.octets += octets;
  const code = erreur ? "réseau" : String(statut);
  e.statuts.set(code, (e.statuts.get(code) || 0) + 1);
  if (erreur) e.erreurs += 1;
  const p = seau(agregat, agregat.profils, profil || "(sans profil)");
  p.n += 1;
  p.ms.push(ms);
  p.octets += octets;
  if (erreur) p.erreurs += 1;
  agregat.total += 1;
  agregat.octets += octets;
  if (erreur) agregat.erreurs += 1;
}

// Les étapes où quelque chose ne va pas — ce que le rapport met en tête.
export function alertes(agregat, { p99Ms = 1000, p95Ms = 500 } = {}) {
  const out = [];
  for (const [nom, e] of agregat.etapes) {
    const r = resumer(e.ms);
    const refus = [...e.statuts].filter(([c]) => /^5\d\d$|^429$|^réseau$/.test(c));
    const refusN = refus.reduce((s, [, n]) => s + n, 0);
    if (refusN) out.push({ nom, gravite: "erreur", texte: `${refusN} réponse(s) refusée(s) (${refus.map(([c, n]) => c + "×" + n).join(", ")}).` });
    if (r.p99 > p99Ms) out.push({ nom, gravite: "latence", texte: `p99 à ${r.p99} ms (seuil ${p99Ms} ms) — un agent sur cent attend plus de ${Math.round(r.p99)} ms.` });
    else if (r.p95 > p95Ms) out.push({ nom, gravite: "latence", texte: `p95 à ${r.p95} ms (seuil ${p95Ms} ms).` });
  }
  return out.sort((a, b) => (a.gravite === b.gravite ? 0 : a.gravite === "erreur" ? -1 : 1));
}

// --------------------------------------------------------------------- rapport
const f = (n) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
const milliers = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const tableau = (entetes, lignes) => [
  "| " + entetes.join(" | ") + " |",
  "|" + entetes.map(() => "---").join("|") + "|",
  ...lignes.map((l) => "| " + l.join(" | ") + " |"),
].join("\n");

export function rapportMarkdown({ cible, debut, fin, effectif, agregat, sql = null, latence = 0, pensee = 0, notes = [] }) {
  const dureeS = Math.max(0.001, (fin - debut) / 1000);
  const etapes = [...agregat.etapes.values()].map((e) => ({ ...e, r: resumer(e.ms) }));
  const profils = [...agregat.profils.values()].map((p) => ({ ...p, r: resumer(p.ms) }));
  const lignesE = [...etapes].sort((a, b) => b.r.p99 - a.r.p99);
  const codes = new Map();
  for (const [, e] of agregat.etapes) for (const [c, n] of e.statuts) codes.set(c, (codes.get(c) || 0) + n);

  const l = [];
  l.push("# Étude de charge — Scribae");
  l.push("");
  l.push(`- **Cible** : \`${cible}\``);
  l.push(`- **Postes simulés** : ${effectif}`);
  l.push(`- **Durée** : ${f(dureeS)} s`);
  l.push(`- **Débit** : ${f(agregat.total / dureeS)} requêtes/s (${milliers(agregat.total)} requêtes)`);
  l.push(`- **Volume échangé** : ${f(agregat.octets / 1024 / 1024)} Mio (${f(agregat.octets / dureeS / 1024)} Kio/s)`);
  l.push(`- **Erreurs** : ${agregat.erreurs} (${f((agregat.erreurs / Math.max(1, agregat.total)) * 100)} %)`);
  if (pensee) l.push(`- **Temps de pensée** : ${pensee} ms en moyenne entre deux gestes`);
  if (latence) l.push(`- **Latence SQL simulée** : ${latence} ms par ordre`);
  l.push("");

  const al = alertes(agregat);
  if (al.length) {
    l.push("## Points d'attention");
    l.push("");
    for (const a of al) l.push(`- **${a.nom}** — ${a.texte}`);
    l.push("");
  } else {
    l.push("## Points d'attention");
    l.push("");
    l.push("Aucun : ni refus (5xx, 429), ni p99 au-delà du seuil.");
    l.push("");
  }

  l.push("## Latence par geste (du pire au meilleur)");
  l.push("");
  l.push(tableau(
    ["Geste", "Appels", "Err.", "p50", "p90", "p95", "p99", "max", "Kio/s"],
    lignesE.map((e) => [
      e.nom, milliers(e.n), String(e.erreurs), f(e.r.p50), f(e.r.p90), f(e.r.p95), f(e.r.p99), f(e.r.max),
      f(e.octets / dureeS / 1024),
    ]),
  ));
  l.push("");

  l.push("## Latence par profil");
  l.push("");
  l.push(tableau(
    ["Profil", "Appels", "Err.", "p50", "p95", "p99", "max"],
    profils.sort((a, b) => b.r.p99 - a.r.p99).map((p) => [p.nom, milliers(p.n), String(p.erreurs), f(p.r.p50), f(p.r.p95), f(p.r.p99), f(p.r.max)]),
  ));
  l.push("");

  l.push("## Codes de réponse");
  l.push("");
  l.push(tableau(["Code", "Nombre"], [...codes].sort((a, b) => b[1] - a[1]).map(([c, n]) => [c, milliers(n)])));
  l.push("");

  if (sql) {
    l.push("## Côté base de données");
    l.push("");
    l.push(`- **Ordres SQL** : ${milliers(sql.ordres)} (${f(sql.ordres / dureeS)} /s) — ${f(sql.ordres / Math.max(1, agregat.total))} par requête HTTP`);
    l.push(`- **Temps passé dans la base** : ${f(sql.ms / 1000)} s (${f((sql.ms / Math.max(1, fin - debut)) * 100)} % de la durée)`);
    l.push("");
    l.push(tableau(["Table", "Ordres"], Object.entries(sql.parTable || {}).sort((a, b) => b[1] - a[1]).map(([t, n]) => [t, milliers(n)])));
    l.push("");
    l.push(tableau(["Genre", "Ordres"], Object.entries(sql.parGenre || {}).sort((a, b) => b[1] - a[1]).map(([g, n]) => [g, milliers(n)])));
    l.push("");
    l.push("> Cette base est une base EN MÉMOIRE (mode `--sans-base`) : elle compte les ordres et ne les exécute pas comme un moteur de stockage. Le nombre d'ordres, lui, est une propriété du service et ne change pas d'une base à l'autre.");
    l.push("");
  }

  if (notes.length) {
    l.push("## Notes de la campagne");
    l.push("");
    for (const n of notes) l.push(`- ${n}`);
    l.push("");
  }

  return l.join("\n");
}
