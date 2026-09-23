// ============================================================================
// Les INFORMATIONS du recueil public — les billets que l'administration publie.
//
// Un recueil d'actes ne dit que ce qui fait droit. Une collectivité a pourtant
// des choses à dire qui ne sont pas des actes : un changement d'horaires, une
// réunion publique, des travaux, une fermeture exceptionnelle, la parution d'un
// nouveau recueil. Ces nouvelles ne se signent pas, ne reçoivent pas d'identifiant
// ELI, et ne se rangent pas dans le registre des actes — c'est pourtant là que
// les administrés les cherchent.
//
// Un billet porte : un titre, un résumé (ce que l'on voit dans la liste), un
// corps en Markdown, une date, un auteur, et deux drapeaux — `publie` (il est
// visible au public) et `epingle` (il passe en tête). Rien de plus : c'est un
// billet, pas un acte.
//
// Module PUR : il ne touche pas au DOM, et ne connaît ni le service ni le
// navigateur. `src/ui/views/informations.js` et `src/ui/views/recueil-public.js`
// s'en servent.
// ============================================================================

const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Le libellé court d'un billet : c'est son ADRESSE (« ?info=marche-de-noel »).
// Il se déduit du titre, et il est stable : un billet qui change de titre garde
// son adresse, sans quoi les liens déjà partagés se casseraient. On retire les
// accents (une adresse se recopie), la ponctuation et les mots vides de tête.
export function slugInfo(titre) {
  const base = sansAccents(titre)
    .toLowerCase()
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (base || "information").slice(0, 80).replace(/-+$/, "");
}

// Un libellé court UNIQUE dans la liste : deux billets qui portent le même titre
// ne doivent pas se disputer la même adresse. Le second reçoit un suffixe.
export function slugUnique(titre, liste, saufId = "") {
  const base = slugInfo(titre);
  const pris = new Set((liste || []).filter((i) => i && i.id !== saufId).map((i) => i.slug).filter(Boolean));
  if (!pris.has(base)) return base;
  let n = 2;
  while (pris.has(base + "-" + n)) n += 1;
  return base + "-" + n;
}

export const estPubliee = (info) => !!info && info.publie === true;
export const estEpinglee = (info) => !!info && info.epingle === true;

// Les billets publiés, du plus récent au plus ancien. La date de publication
// fait foi ; à défaut (un brouillon, un billet mal daté), on retombe sur la date
// de création : un billet sans date ne doit pas disparaître du recueil.
export function informationsPubliees(liste) {
  return (liste || []).filter(estPubliee).sort(parDate);
}

export const toutesInformations = (liste) => [...(liste || [])].sort(parDate);

function parDate(a, b) {
  const da = String(a.date || a.creeLe || "");
  const db = String(b.date || b.creeLe || "");
  if (da === db) return String(b.titre || "").localeCompare(String(a.titre || ""));
  return db.localeCompare(da);
}

// Les billets ÉPINGLÉS d'abord (dans l'ordre des dates), puis les autres : c'est
// l'ordre d'affichage du recueil.
export function informationsOrdonnees(liste) {
  const publiees = informationsPubliees(liste);
  return [...publiees.filter(estEpinglee), ...publiees.filter((i) => !estEpinglee(i))];
}

// L'ordre de l'ATELIER : tous les billets, brouillons compris. C'est un ordre
// DISTINCT de celui du recueil public, et il doit l'être : `informationsOrdonnees`
// est l'ordre du SITE — il ne connaît que les billets publiés (voir plus haut) —,
// et le réutiliser ici ferait disparaître les brouillons de la liste : le filtre
// « Brouillons » n'aurait jamais rien à montrer, et un billet écrit mais non
// publié serait introuvable dans l'écran qui sert à l'écrire. Les épinglés
// restent en tête : c'est l'ordre que l'administration connaît déjà.
export function informationsDeLAtelier(liste) {
  const tous = toutesInformations(liste);
  return [...tous.filter(estEpinglee), ...tous.filter((i) => !estEpinglee(i))];
}

export const derniereInformation = (liste) => informationsPubliees(liste)[0] || null;

export function informationParSlug(liste, slug) {
  const s = String(slug || "").trim().toLowerCase();
  if (!s) return null;
  return informationsPubliees(liste).find((i) => i.slug === s) || null;
}

// Le résumé affiché dans la liste : celui que l'administrateur a écrit, ou, à
// défaut, le début du corps — le premier paragraphe, débarrassé de sa mise en
// forme. On ne laisse jamais une carte vide.
export function resumeInfo(info, max = 220) {
  const ecrit = String(info?.resume || "").trim();
  const texte = ecrit || premierParagraphe(info?.corps);
  const plat = texte.replace(/\s+/g, " ").trim();
  if (plat.length <= max) return plat;
  const coupe = plat.slice(0, max);
  const espace = coupe.lastIndexOf(" ");
  return (espace > max * 0.6 ? coupe.slice(0, espace) : coupe).replace(/[,;:.]$/, "") + "…";
}

// Le premier paragraphe « de texte » d'un corps Markdown : on saute les titres,
// les listes, les citations et les traits — ce qui suit n'est pas un résumé.
function premierParagraphe(corps) {
  const lignes = String(corps || "").replace(/\r\n?/g, "\n").split("\n");
  const garde = [];
  for (const ligne of lignes) {
    const l = ligne.trim();
    if (!l) { if (garde.length) break; continue; }
    if (/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||```|~~~|-{3,}|\*{3,})/.test(l)) { if (garde.length) break; continue; }
    garde.push(l);
  }
  return garde.join(" ").replace(/[*_`]/g, "");
}

// Un texte de billet, prêt pour un aperçu en clair (métadonnées d'un lien, d'un
// moteur de recherche, d'un résumé d'agent).
export const infoEnTexte = (info) => resumeInfo(info, 300);

// Le temps de lecture, en minutes — un repère que tout site d'information
// affiche, et qui se calcule : 200 mots par minute, arrondi au minimum à 1.
export function minutesDeLecture(info) {
  const mots = String(info?.corps || "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(mots / 200));
}

// Ce qu'un billet doit avoir pour être publié : un titre et un corps. On le
// vérifie AVANT de poser `publie` : publier un billet vide n'a pas de sens, et
// le service refuse de le servir.
export function manquePourPublier(info) {
  const manques = [];
  if (!String(info?.titre || "").trim()) manques.push("titre");
  if (!String(info?.corps || "").trim()) manques.push("texte");
  if (!String(info?.date || "").trim()) manques.push("date");
  return manques;
}

// Un billet neuf, avec ses valeurs par défaut. `auteur` reçoit le nom de la
// personne qui l'écrit : c'est lui qui est affiché sur le recueil.
export function nouvelleInformation({ auteur = "", date = "" } = {}) {
  return {
    id: "",
    titre: "",
    slug: "",
    resume: "",
    corps: "",
    date: date || new Date().toISOString().slice(0, 10),
    auteur,
    publie: false,
    epingle: false,
    creeLe: new Date().toISOString(),
    modifieLe: "",
  };
}

// La PERSONNALISATION du site public : une feuille de style libre, écrite par
// l'administration dans l'atelier, injectée telle quelle dans la page. Elle est
// écrite par un administrateur (jamais par un visiteur) et ne contient que du
// CSS — elle ne peut pas exécuter de code.
//
// La portée est le site public SEUL : l'atelier et le recueil partagent le même
// document, donc on ne parle pas de « :root » mais du conteneur du recueil, qui
// porte la classe `.recueil`. C'est là que se posent les variables ci-dessous, et
// c'est ce qui permet de recolorer le recueil sans toucher à l'atelier.
export const PORTEE_CSS = ".recueil";

// Les variables que la feuille du recueil honore, montrées à l'administrateur :
// ce que l'on peut changer sans connaître le reste de la feuille. Une liste
// écrite ici est une AIDE, pas une contrainte : la personnalisation étant du CSS
// libre, une collectivité peut viser n'importe quel élément de la page.
export const VARIABLES_CSS = [
  { nom: "--brand", role: "Couleur d'accent du site public (liens, badges, filets)." },
  { nom: "--brand-soft", role: "Fond des accents (encadrés, pastilles)." },
  { nom: "--ink", role: "Couleur du texte." },
  { nom: "--ink-2", role: "Texte secondaire (chapeaux, résumés)." },
  { nom: "--ink-muted", role: "Mentions discrètes (dates, compléments)." },
  { nom: "--bg", role: "Fond des blocs (en-tête, cartes, pied de page)." },
  { nom: "--bg-alt", role: "Fond de la page." },
  { nom: "--border", role: "Filets ordinaires." },
  { nom: "--border-strong", role: "Filets marqués (encadrés, séparateurs)." },
  { nom: "--font-ui", role: "Police du site (une police distante peut être chargée par la feuille)." },
  { nom: "--font-mono", role: "Police des références (identifiant ELI, adresses)." },
  { nom: "--radius", role: "Arrondi des angles." },
  { nom: "--recueil-largeur", role: "Largeur maximale du contenu (1180 px par défaut)." },
];

// L'exemple montré dans l'éditeur : une charte de deux lignes, la plus fréquente
// des demandes — une couleur, une largeur.
export const EXEMPLE_CSS = [
  "/* Votre charte, appliquée au seul site public. */",
  ".recueil {",
  "  --brand: #0f7b6c;",
  "  --recueil-largeur: 1080px;",
  "}",
].join("\n");
