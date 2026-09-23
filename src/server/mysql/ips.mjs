// ============================================================================
// Adresses IP : lire une liste blanche, et dire si une adresse y figure.
//
// Sert à RESTREINDRE L'ACCÈS À L'ATELIER à certaines adresses — le cas d'une
// commune qui n'ouvre son outil qu'à son intranet (voir la variable de
// déploiement `SCRIBA_ATELIER_IPS`, registre `variables.mjs`). La liste est
// écrite par l'exploitant dans le `.env` du déploiement, et c'est le SERVICE qui
// l'applique : le navigateur ne décide jamais de son propre droit d'entrer, une
// adresse annoncée par le client ne prouvant rien.
//
// Ce que la liste accepte, entrée par entrée :
//   • une adresse seule        « 192.168.1.24 »          (IPv4 ou IPv6)
//   • un préfixe CIDR          « 192.168.0.0/16 », « 2001:db8::/32 »
//   • un CHAMP d'adresses      « 10.0.0.0-10.0.0.255 »   (bornes incluses)
//   • une plage abrégée        « 10.0.0.* »              (équivaut à /24)
//   • un commentaire derrière « # » est ignoré
// Une entrée incomprise n'est JAMAIS ignorée en silence : elle est rendue à part
// (`erreurs`), et le service la signale au démarrage plutôt que de laisser
// croire à une restriction qui n'existe pas.
//
// Module PUR : ni Node, ni navigateur, ni dépendance. Il s'éprouve seul
// (`ips.test.mjs`).
// ============================================================================

const BITS_V4 = 32;
const BITS_V6 = 128;

const B2 = (v) => BigInt(v);
const v4Max = (B2(1) << B2(BITS_V4)) - B2(1);
const v6Max = (B2(1) << B2(BITS_V6)) - B2(1);
const maxDe = (bits) => (bits === BITS_V4 ? v4Max : v6Max);
const ecrire = (v, bits) => (bits === BITS_V4 ? ecrireV4(v) : ecrireV6(v));

// ---------------------------------------------------------------- IPv4
const V4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

// « 192.168.1.24 » → 3232235800n. Les zéros de tête sont acceptés (« 010 » vaut
// 10 : ce n'est pas de l'octal dans une adresse IP), mais un octet hors bornes
// n'est pas une adresse.
function lireV4(txt) {
  const m = V4.exec(txt);
  if (!m) return null;
  let v = B2(0);
  for (let i = 1; i <= 4; i += 1) {
    const o = Number(m[i]);
    if (!Number.isInteger(o) || o > 255) return null;
    v = (v << B2(8)) | B2(o);
  }
  return v;
}

function ecrireV4(v) {
  return [24n, 16n, 8n, 0n].map((d) => Number((v >> d) & 255n)).join(".");
}

// ---------------------------------------------------------------- IPv6
// Un groupe de 0 à 4 chiffres hexadécimaux, ou une adresse IPv4 en queue (les
// deux écritures d'une adresse IPv6 mixte).
function lireV6(txt) {
  const t = String(txt).trim();
  if (!t.includes(":")) return null;
  const double = t.split("::");
  if (double.length > 2) return null;

  const lireGroupes = (partie) => {
    const bouts = partie.split(":").filter((x) => x !== "");
    const groupes = [];
    for (let i = 0; i < bouts.length; i += 1) {
      const bout = bouts[i];
      if (i === bouts.length - 1 && bout.includes(".")) {
        const v4 = lireV4(bout);
        if (v4 === null) return null;
        groupes.push(Number((v4 >> 16n) & 65535n));
        groupes.push(Number(v4 & 65535n));
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(bout)) return null;
        groupes.push(parseInt(bout, 16));
      }
    }
    return groupes;
  };

  let groupes;
  if (double.length === 2) {
    const tete = lireGroupes(double[0]);
    const queue = lireGroupes(double[1]);
    if (tete === null || queue === null) return null;
    const manquants = 8 - (tete.length + queue.length);
    if (manquants < 1) return null;
    groupes = [...tete, ...Array(manquants).fill(0), ...queue];
  } else {
    groupes = lireGroupes(t);
    if (groupes === null || groupes.length !== 8) return null;
  }
  return groupes.reduce((acc, g) => (acc << 16n) | B2(g), 0n);
}

function ecrireV6(v) {
  const groupes = [];
  for (let i = 7; i >= 0; i -= 1) groupes.push(Number((v >> B2(16 * i)) & 65535n).toString(16));
  // Forme comprimée (RFC 5952) : la plus longue suite de groupes nuls devient
  // « :: ». C'est l'écriture qu'un agent reconnaît.
  let meilleurDebut = -1;
  let meilleureLongueur = 0;
  let debut = -1;
  for (let i = 0; i <= 8; i += 1) {
    if (i < 8 && groupes[i] === "0") {
      if (debut < 0) debut = i;
    } else if (debut >= 0) {
      if (i - debut > meilleureLongueur) { meilleureLongueur = i - debut; meilleurDebut = debut; }
      debut = -1;
    }
  }
  if (meilleureLongueur < 2) return groupes.join(":");
  const avant = groupes.slice(0, meilleurDebut).join(":");
  const apres = groupes.slice(meilleurDebut + meilleureLongueur).join(":");
  return avant + "::" + apres;
}

// « ::ffff:192.168.1.1 » et « ::ffff:c0a8:101 » désignent la MÊME adresse IPv4 :
// un service derrière une pile double peut annoncer l'une ou l'autre. On rend
// l'IPv4 sous-jacente, pour qu'une liste écrite en IPv4 reconnaisse une IPv4
// arrivée en écriture mixte.
function demapperIPv4(v) {
  return (v >> 32n) === 65535n ? v & v4Max : null;
}

// ------------------------------------------------------- lecture d'une adresse
// Rend { valeur, bits } ou null. Une écriture mixte (« ::ffff:192.168.1.1 ») est
// ramenée à l'IPv4 qu'elle désigne.
export function lireAdresse(txt) {
  const t = String(txt == null ? "" : txt).trim();
  if (!t) return null;
  const v4 = lireV4(t);
  if (v4 !== null) return { valeur: v4, bits: BITS_V4 };
  const v6 = lireV6(t);
  if (v6 === null) return null;
  const mappe = demapperIPv4(v6);
  if (mappe !== null) return { valeur: mappe, bits: BITS_V4 };
  return { valeur: v6, bits: BITS_V6 };
}

// L'écriture canonique d'une adresse, ou "" si elle est illisible.
export function ecrireAdresse(txt) {
  const a = lireAdresse(txt);
  return a ? ecrire(a.valeur, a.bits) : "";
}

export const estAdresse = (txt) => !!lireAdresse(txt);

// ------------------------------------------------------- lecture d'une entrée
// Une entrée de liste → { debut, fin, bits, libelle } (bornes incluses), ou
// { entree, erreur }. Le libellé est l'écriture normale de l'entrée : c'est lui
// qu'un écran affiche, et il distingue « 10.0.0.0/24 » d'un simple « 10.0.0.1 ».
export function lireEntree(brut) {
  const t = String(brut == null ? "" : brut).split("#")[0].trim();
  if (!t) return null;
  const faute = (motif) => ({ entree: t, erreur: motif });

  // Champ « debut-fin » : le tiret n'existe dans aucune écriture d'adresse, il
  // ne peut donc pas être pris pour un signe.
  if (t.includes("-")) {
    const [g, d] = t.split("-");
    const debut = lireAdresse(g);
    const fin = lireAdresse(d);
    if (!debut || !fin) return faute("champ d'adresses : les deux bornes doivent être des adresses");
    if (debut.bits !== fin.bits) return faute("champ d'adresses : bornes de familles différentes (IPv4 / IPv6)");
    if (debut.valeur > fin.valeur) return faute("champ d'adresses : la borne basse dépasse la borne haute");
    return { debut: debut.valeur, fin: fin.valeur, bits: debut.bits, libelle: ecrire(debut.valeur, debut.bits) + "-" + ecrire(fin.valeur, fin.bits) };
  }

  // Plage abrégée « 10.0.0.* » (IPv4 seulement) : les étoiles ne peuvent occuper
  // que la FIN de l'adresse, et elles couvrent tout ce qui reste.
  if (t.includes("*")) {
    const m = /^(\d{1,3}(?:\.\d{1,3})*)(?:\.\*)+$/.exec(t);
    if (!m) return faute("plage abrégée : syntaxe attendue « 10.0.0.* »");
    const fixes = m[1].split(".");
    // Le nombre d'octets FIXES donne la largeur du champ, et les étoiles — qui
    // ne peuvent occuper que la fin — couvrent tout le reste : « 10.* » vaut
    // « 10.0.0.0-10.255.255.255 », comme « 10.*.* ».
    const reste = 4 - fixes.length;
    if (!reste) return faute("plage abrégée : la dernière étoile doit couvrir au moins un octet");
    const debut = lireV4(fixes.concat(Array(reste).fill("0")).join("."));
    const fin = lireV4(fixes.concat(Array(reste).fill("255")).join("."));
    if (debut === null || fin === null) return faute("plage abrégée : adresse IPv4 attendue");
    return { debut, fin, bits: BITS_V4, libelle: ecrireV4(debut) + "-" + ecrireV4(fin) };
  }

  // Préfixe CIDR.
  if (t.includes("/")) {
    const i = t.lastIndexOf("/");
    const adresse = lireAdresse(t.slice(0, i));
    const taille = String(t.slice(i + 1)).trim();
    if (!adresse) return faute("préfixe : l'adresse qui précède « / » est illisible");
    if (!/^\d{1,3}$/.test(taille)) return faute("préfixe : la longueur après « / » doit être un nombre");
    const n = Number(taille);
    if (n < 0 || n > adresse.bits) return faute(`préfixe : la longueur doit être comprise entre 0 et ${adresse.bits}`);
    const haut = maxDe(adresse.bits);
    const masque = n === 0 ? B2(0) : (haut << B2(adresse.bits - n)) & haut;
    const debut = adresse.valeur & masque;
    const fin = debut | (haut & ~masque);
    return { debut, fin, bits: adresse.bits, libelle: ecrire(debut, adresse.bits) + "/" + n };
  }

  // Adresse seule : un champ d'une seule adresse.
  const a = lireAdresse(t);
  if (!a) return faute("adresse illisible (IPv4 ou IPv6 attendue)");
  return { debut: a.valeur, fin: a.valeur, bits: a.bits, libelle: ecrire(a.valeur, a.bits) };
}

// ------------------------------------------------------------- lire une liste
const decouper = (brut) => (Array.isArray(brut) ? brut : String(brut == null ? "" : brut).split(/[,\n;]/));

// La liste → ses entrées utilisables et ses erreurs. Une entrée vide est
// simplement sautée : c'est une virgule de trop, pas une faute.
export function lireListe(brut) {
  const entrees = [];
  const erreurs = [];
  for (const item of decouper(brut)) {
    const r = lireEntree(item);
    if (!r) continue;
    if (r.erreur) erreurs.push({ entree: r.entree, motif: r.erreur });
    else entrees.push(r);
  }
  return { entrees, erreurs, vide: entrees.length === 0 };
}

// La même chose, en gardant l'écriture ORIGINALE de chaque entrée : c'est elle
// que montre l'écran d'administration (« ce que l'exploitant a écrit »).
export function lireListeBrute(brut) {
  const retenues = [];
  const erreurs = [];
  for (const item of decouper(brut)) {
    const t = String(item == null ? "" : item).split("#")[0].trim();
    if (!t) continue;
    const r = lireEntree(t);
    if (r.erreur) erreurs.push({ entree: r.entree, motif: r.erreur });
    else retenues.push({ texte: t, libelle: r.libelle, bits: r.bits });
  }
  return { retenues, erreurs };
}

// ---------------------------------------------------------------- la question
// L'entrée qui AUTORISE l'adresse, ou null. C'est elle que montre le simulateur
// de l'écran d'administration (« autorisée par 10.0.0.0/8 ») : une réponse
// « oui » sans la règle qui la fonde ne se vérifie pas.
export function entreeAutorisee(ip, liste) {
  const a = lireAdresse(ip);
  if (!a) return null;
  for (const e of liste || []) {
    if (e.bits !== a.bits) continue;
    if (a.valeur >= e.debut && a.valeur <= e.fin) return e;
  }
  return null;
}

// L'adresse est-elle dans l'un des champs ? Une liste VIDE n'autorise personne
// — c'est le sens même d'une liste blanche —, mais l'appelant distingue « liste
// vide » de « adresse refusée » : liste vide veut dire « la restriction n'est
// pas réglée », et l'accès reste alors ouvert.
export const autorisee = (ip, liste) => !!entreeAutorisee(ip, liste);

// Le raccourci qu'utilise le service : la liste brute (chaîne ou tableau) et
// l'adresse de l'appelant.
export const autoriseeDans = (ip, brut) => autorisee(ip, lireListe(brut).entrees);

// ------------------------------------------------------------------- affichage
// Un résumé d'une ligne, pour l'écran d'administration et les journaux.
export function resumeListe(brut) {
  const { entrees, erreurs, vide } = lireListe(brut);
  if (vide) return "aucune restriction d'adresse";
  const tete = entrees.map((e) => e.libelle).join(", ");
  return erreurs.length ? `${tete} (${erreurs.length} entrée(s) refusée(s))` : tete;
}

// Les espaces réservés (RFC 1918, boucle locale, lien-local) : ils servent au
// message affiché à l'agent — « vous passez par le réseau interne », ou non —
// jamais à décider. Une adresse publique peut très bien être celle d'un intranet
// d'entreprise, et une adresse privée très bien être refusée.
export function estInterne(ip) {
  const a = lireAdresse(ip);
  if (!a) return false;
  if (a.bits === BITS_V4) {
    const v = a.valeur;
    return dansV4(v, "10.0.0.0", 8) || dansV4(v, "172.16.0.0", 12) || dansV4(v, "192.168.0.0", 16)
      || dansV4(v, "127.0.0.0", 8) || dansV4(v, "169.254.0.0", 16) || dansV4(v, "100.64.0.0", 10);
  }
  // fc00::/7 (adresses locales uniques) et fe80::/10 (lien-local).
  return prefixe(a.valeur, BITS_V6, 7) === prefixe(lireV6("fc00::"), BITS_V6, 7)
    || prefixe(a.valeur, BITS_V6, 10) === prefixe(lireV6("fe80::"), BITS_V6, 10);
}

const prefixe = (v, bits, n) => v >> B2(bits - n);

function dansV4(v, base, taille) {
  const b = lireV4(base);
  const haut = (v4Max << B2(BITS_V4 - taille)) & v4Max;
  return (v & haut) === (b & haut);
}

// L'adresse de l'appelant, telle que le service la voit : derrière la façade
// nginx, c'est le premier maillon de « X-Forwarded-For » ; en direct, c'est
// l'adresse de la prise. On ne descend pas plus loin : un en-tête que le client
// peut écrire ne vaut que par la confiance qu'on accorde au proxy qui l'a posé.
export function adresseDeLEntete(headers = {}, adresseDistante = "") {
  const xff = String(headers["x-forwarded-for"] || headers["X-Forwarded-For"] || "").split(",")[0].trim();
  const brute = xff || String(adresseDistante || "").trim();
  return ecrireAdresse(brute) || String(brute || "").trim();
}
