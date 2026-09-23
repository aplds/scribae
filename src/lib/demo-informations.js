// ============================================================================
// Jeu de démonstration — les INFORMATIONS du recueil public.
//
// Trois billets et un brouillon, écrits comme le ferait un service de
// communication d'une commune, et rattachés à la fiction de Valmont-sur-Loire :
// ils parlent des événements que les actes de démonstration organisent (la fête
// du village, le marché de Noël, la cérémonie du 11 novembre) et des documents
// que le recueil publie au même moment (la grille tarifaire).
//
// Le brouillon est là pour montrer le geste : on écrit d'abord, on publie
// ensuite — et un brouillon n'apparaît JAMAIS sur le recueil public.
//
// Ce module ne sert QUE la démonstration (`DEMO`, voir src/lib/demo.js) : une
// installation réelle part d'une liste vide, que l'administration remplit.
// ============================================================================

export const SEED_INFORMATIONS = [
  {
    id: "info-demo-fete",
    titre: "Valmont en fête : la fête du village revient les 3 et 4 octobre",
    slug: "valmont-en-fete-2026",
    resume: "Deux journées de fête sur la place de la République : marché des producteurs, repas partagé, concert et feu d'artifice. Les arrêtés de circulation et de stationnement sont publiés au recueil.",
    corps: [
      "La fête du village **« Valmont en fête »** se tiendra les **samedi 3 et dimanche 4 octobre 2026**, comme chaque année sur la place de la République et dans les rues du centre.",
      "",
      "## Au programme",
      "",
      "- **Samedi** : marché des producteurs et des artisans de 10 h à 19 h, repas partagé à 20 h, concert sur la place à 21 h 30, feu d'artifice à 23 h.",
      "- **Dimanche** : brocante de 8 h à 18 h, démonstrations des associations sportives et culturelles, spectacle pour enfants à 15 h.",
      "",
      "## Circulation et stationnement",
      "",
      "La circulation sera interdite dans le périmètre de la fête et le stationnement réorganisé du vendredi 2 octobre à 18 h au lundi 5 octobre à 8 h.",
      "",
      "Ces mesures font l'objet des arrêtés publiés au recueil des actes administratifs, avec le plan de circulation et le programme détaillé en annexe :",
      "",
      "- [Arrêté portant organisation de la fête du village](?page=informations)",
      "- Plan de circulation et de stationnement (annexe)",
      "- Programme de la fête (annexe)",
      "",
      "> Les riverains sont invités à déplacer leur véhicule avant le vendredi 2 octobre à 18 h.",
    ].join("\n"),
    date: "2026-09-22",
    auteur: "Service communication",
    publie: true,
    epingle: true,
    creeLe: "2026-09-15T09:10:00.000Z",
    modifieLe: "2026-09-20T16:40:00.000Z",
  },
  {
    id: "info-demo-tarifs",
    titre: "Les tarifs des services municipaux changent au 1er janvier 2027",
    slug: "tarifs-municipaux-2027",
    resume: "Restauration scolaire, accueil de loisirs, conservatoire, salles municipales : la nouvelle grille tarifaire, adoptée par délibération, entre en vigueur le 1er janvier 2027.",
    corps: [
      "Le conseil municipal a adopté la **nouvelle grille tarifaire des services municipaux** pour l'année 2027. Elle entre en vigueur le **1er janvier 2027**.",
      "",
      "Les tarifs de la restauration scolaire, de l'accueil de loisirs, du conservatoire et de la location des salles municipales sont révisés. Le quotient familial reste la règle pour les prestations sociales : aucune famille ne voit sa facture augmenter de plus de 2 %.",
      "",
      "La délibération et la grille, qui en fait partie intégrante, sont publiées au recueil des actes administratifs : elles s'y consultent pour elles-mêmes, comme un règlement.",
    ].join("\n"),
    date: "2026-09-14",
    auteur: "Direction des finances",
    publie: true,
    epingle: false,
    creeLe: "2026-09-10T14:05:00.000Z",
    modifieLe: "",
  },
  {
    id: "info-demo-noel",
    titre: "Marché de Noël : les exposants peuvent s'inscrire",
    slug: "marche-de-noel-2026-inscriptions",
    resume: "Le marché de Noël se tiendra du 18 au 20 décembre sur le parvis de l'église. Les artisans et producteurs locaux disposent d'un mois pour déposer leur demande de chalet.",
    corps: [
      "Le **marché de Noël** de Valmont-sur-Loire se tiendra du **vendredi 18 au dimanche 20 décembre 2026**, sur le parvis de l'église et la place du Marché.",
      "",
      "Six chalets de bois sont mis à disposition des artisans, commerçants et producteurs locaux. Les demandes se déposent auprès du service des affaires générales **avant le 15 novembre** ; elles sont attribuées dans l'ordre d'arrivée, une priorité étant réservée aux exposants de la commune.",
      "",
      "L'arrêté portant organisation du marché, qui fixe les emplacements et les horaires, est publié au recueil.",
    ].join("\n"),
    date: "2026-10-19",
    auteur: "Service des affaires générales",
    publie: true,
    epingle: false,
    creeLe: "2026-10-15T11:20:00.000Z",
    modifieLe: "",
  },
  {
    id: "info-demo-voeux",
    titre: "Cérémonie des vœux : la date est fixée",
    slug: "ceremonie-des-voeux-2027",
    resume: "La cérémonie des vœux du maire se tiendra le 9 janvier 2027 à la salle des fêtes. Invitations envoyées début décembre.",
    corps: [
      "La **cérémonie des vœux du maire** se tiendra le **samedi 9 janvier 2027 à 11 h**, à la salle des fêtes.",
      "",
      "Brouillon — la date et le lieu seront confirmés par la publication de l'arrêté correspondant.",
    ].join("\n"),
    date: "2026-11-30",
    auteur: "Cabinet du maire",
    publie: false,
    epingle: false,
    creeLe: "2026-11-24T08:00:00.000Z",
    modifieLe: "",
  },
];

export const seedInformations = () => SEED_INFORMATIONS.map((i) => ({ ...i }));
