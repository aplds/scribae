// ============================================================================
// Les bandeaux d'information — les messages de l'administration.
//
// LE BESOIN. Le bandeau de démonstration dit une chose (« cette installation
// joue un jeu fictif »), décidée par le DÉPLOIEMENT. Mais une collectivité en
// service a, elle aussi, des choses à dire EN TÊTE de l'application — et sur le
// recueil public : « maintenance programmée samedi de 8 h à 12 h », « dépôt des
// actes suspendu pendant la bascule », « bienvenue sur le nouveau recueil ».
// Ce sont des MESSAGES D'ADMINISTRATION : un titre, une couleur, un contenu —
// enregistrés dans le référentiel, préparés à l'avance, affichés quand
// l'administrateur les allume.
//
// UNE SEULE IMPLÉMENTATION. Le bandeau de démonstration (`demoNotice`) garde sa
// règle à lui (voir src/ui/notice.js) ; tout le reste — maintenance, alerte,
// annonce — passe par ICI : la donnée (`config.bandeaux`, voir
// src/lib/schema.js), la sélection (`bandeauxActifs`) et le rendu
// (`bandeauxNotice`, src/ui/notice.js). Il n'y a pas de second mécanisme.
//
// LA DONNÉE. Un bandeau, c'est :
//   • `titre`   — la pastille (« Maintenance programmée ») ;
//   • `texte`   — le contenu, en toutes lettres ;
//   • `couleur` — l'une des quatre valeurs de COULEURS_BANDEAU ;
//   • `actif`   — affiché seulement quand c'est vrai : on PRÉPARE un bandeau
//                 (maintenance du mois prochain) puis on l'allume le moment venu.
// Un bandeau sans titre ni texte ne dit rien : il ne s'affiche pas.
// ============================================================================
import { uid } from "./util.js";

// Les quatre couleurs, et rien d'autre : un bandeau se lit d'un coup d'œil,
// pas avec la charte complète. Les libellés disent l'USAGE, pas la teinte.
export const COULEURS_BANDEAU = [
  { id: "info", label: "Bleu — information" },
  { id: "avertissement", label: "Orange — avertissement" },
  { id: "urgence", label: "Rouge — urgence" },
  { id: "succes", label: "Vert — confirmation" },
];

export const couleurBandeau = (id) =>
  COULEURS_BANDEAU.some((c) => c.id === id) ? id : "info";

export function newBandeau(patch = {}) {
  return {
    id: uid("bd"),
    titre: "",
    texte: "",
    couleur: "info",
    actif: true,
    ...patch,
  };
}

// Les bandeaux à afficher : allumés, et qui disent quelque chose. L'ordre du
// référentiel est l'ordre d'affichage — l'administration les ordonne comme les
// renvois du recueil (voir src/ui/views/referentiel.js).
export function bandeauxActifs(config) {
  const liste = Array.isArray(config?.bandeaux) ? config.bandeaux : [];
  return liste.filter((b) => b && b.actif && (String(b.titre || "").trim() || String(b.texte || "").trim()));
}
