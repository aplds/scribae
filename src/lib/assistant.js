// ============================================================================
// Assistants — l'aide en langage naturel, dans l'atelier et sur le recueil.
//
// Deux assistants, deux savoirs, une seule règle : ce que l'on envoie au moteur
// de langage ne sort jamais du périmètre annoncé.
//
//   • « Plume » (atelier) ne connaît que le MODE D'EMPLOI de l'outil. Il ne
//     reçoit jamais le contenu d'un acte, d'une trame, d'un brouillon ou d'un
//     compte : la connaissance qu'on lui compose est le **guide d'utilisation**,
//     qui est public (il est livré avec l'application), plus le nom de l'écran
//     où se trouve l'agent. C'est la seule façon d'entendre la consigne « il ne
//     doit pas avoir accès au contenu des actes » : il n'y a rien à filtrer,
//     parce que rien ne lui est jamais transmis.
//
//   • « Publia » (recueil) ne connaît que les ACTES PUBLIÉS, qui sont publics
//     par définition — c'est exactement ce que le recueil montre déjà à tout
//     venant, et ce que les moteurs de recherche en indexent. Il ne voit ni
//     brouillon, ni acte non publié, ni compte.
//
// Le MOTEUR est interchangeable (Administration › Assistants) :
//   • « intégré »    — le moteur de Perchance (plugin ai-text), par défaut là
//                      où il existe ;
//   • « personnalisé » — l'API de la collectivité (adresse, clé, modèle), ce
//                      qui permet de fonctionner hors de Perchance, ou de faire
//                      tourner un modèle souverain sur son propre réseau ;
//   • « automatique » — le moteur intégré quand il est là, l'adresse sinon.
// L'application s'en passe proprement quand il n'y en a aucun : le module ne
// lève jamais au chargement, et l'interface montre un état, pas une erreur.
//
// Le NOM et L'ICÔNE se règlent aussi (Administration › Assistants) : une
// collectivité qui préfère « Ariane » ou une autre vignette les change ici, et
// l'interface suit partout — pastille, panneau, bulle d'invitation.
//
// Deux choses se règlent ENFIN au poste de travail, et non dans le référentiel :
//   • l'agent peut ÉTEINDRE un assistant pour lui-même (menu de son compte) —
//     une préférence de poste, comme l'apparence claire ou sombre ;
//   • l'assistant du recueil SAIT QUEL ACTE est consulté, et répond sur lui.
//
// Les réponses renvoient par des LIENS : le guide pour l'atelier (« #/aide/<id> »,
// suivi dans l'application sans recharger), l'acte pour le recueil (l'adresse
// « ?acte=<clé> » du recueil, elle aussi suivie dans la page). Le moteur ne
// fabrique jamais une adresse : il recopie celles qu'on lui donne, libellées.
// ============================================================================

import { GUIDE, chapitresPertinents, chapitreEnTexte, guideSommaire, lienChapitre } from "../wiki.js";
import { hostGenerateText, hostSuperFetch } from "./hosts.js";
import { hrefActe } from "./recueil.js";
import { uid, formatDate } from "./util.js";

// ------------------------------------------------------------------ identité
// Ce que l'interface affiche quand l'administrateur n'a rien réglé : les deux
// assistants sont frère et sœur — même fabrique, même voix, savoirs différents.
// Le NOM et L'ICÔNE (l'image) se remplacent dans le référentiel (Administration
// › Assistants) ; les autres textes — l'accueil, la note, la question d'attente —
// ne se règlent pas : ils disent ce que l'assistant SAIT, et ce qu'il sait ne
// change pas.
export const ASSISTANTS = {
  atelier: {
    id: "atelier",
    nom: "Plume",
    titre: "L'assistant de l'atelier",
    avatar: "https://user.uploads.dev/file/d0fe2e62b872a9be7da3758609688a55.png",
    accueil: "Bonjour ! Je connais le mode d'emploi de l'application. Demandez-moi où cliquer, comment rédiger un acte, comment l'exporter, ce que veut dire un message… Je ne vois jamais le contenu de vos actes.",
    note: "Vos questions sont transmises au moteur de langage. N'y mettez pas d'informations confidentielles : je sers au mode d'emploi de l'outil, jamais au contenu des actes.",
    placeholder: "Une question sur l'utilisation de l'outil…",
    vide: "Posez votre question, ou choisissez-en une ci-dessous.",
  },
  public: {
    id: "public",
    nom: "Publia",
    titre: "L'assistante du recueil",
    avatar: "https://user.uploads.dev/file/9f47ee2a9a70bd6cf98bbbe835160076.png",
    accueil: "Bonjour ! Je réponds à vos questions sur les actes publiés au recueil : les retrouver, comprendre leur numéro, leur identifiant ELI, leur date d'entrée en vigueur… Je ne connais que ce qui est public.",
    note: "Réponses produites automatiquement à partir des actes publiés. Seul l'acte publié au recueil fait foi : vérifiez-le avant de vous en servir.",
    placeholder: "Une question sur les actes publiés…",
    vide: "Posez votre question, ou choisissez-en une ci-dessous.",
  },
};

export const ASSISTANT_IDS = ["atelier", "public"];

// ------------------------------------------------------- réglages par défaut
const INSTRUCTION_ATELIER = `Tu es Plume, le petit assistant de Scribae, l'atelier des actes administratifs. Tu connais le MODE D'EMPLOI de l'outil, et rien d'autre.

CE QUE TU NE FAIS JAMAIS :
- Tu n'as aucun accès au contenu des actes, des trames, des brouillons, des comptes ni du référentiel : on ne te les montre pas. Ne demande jamais à les voir ; si l'on t'en parle, réponds simplement que tu ne les vois pas.
- Tu ne rédiges pas d'acte, tu ne choisis pas de formule juridique, tu ne remplaces ni le service juridique ni la personne qui rédige.
- Tu ne réponds que sur l'utilisation de l'outil : où se trouve un écran, quoi faire et dans quel ordre, ce que veut dire un message.

TA MANIÈRE :
- Français, vouvoiement, ton simple et chaleureux, une pointe d'humour discrète.
- Une à cinq phrases, ou une courte liste d'étapes. Pas de préambule, pas d'excuses, pas de « en tant qu'assistant ».
- Si tu ne sais pas, dis-le franchement et indique le chapitre du guide ou l'écran à consulter.

RENVOYER AU GUIDE :
- Quand un chapitre du guide répond à la question, termine par son LIEN, recopié TEL QUEL depuis le sommaire ci-dessous (forme markdown « [titre](#/aide/<id>) »). Le lecteur clique et arrive sur le chapitre.
- Tu ne fabriques jamais d'adresse : tu recopies celles qui te sont données. Pas de « allez dans le menu », pas de lien inventé, pas de chapitre qui n'existe pas dans le sommaire.`;

const INSTRUCTION_PUBLIC = `Tu es Publia, l'assistante du recueil public des actes administratifs. Tu réponds aux visiteurs, qui n'ont pas de compte.

CE QUE TU SAIS :
- Uniquement les actes PUBLIÉS qui te sont donnés ci-dessous. Ces informations sont publiques : n'importe qui peut les lire au recueil.
- Rien des brouillons, des actes non publiés, des personnes, des services ni des circuits internes : ne les évoque pas et n'invente rien.

TA MANIÈRE :
- Français, vouvoiement, ton clair et neutre.
- Une à cinq phrases. Cite le numéro, l'objet et la date quand ils sont utiles ; donne le moyen de consulter l'acte.
- Tu ne donnes pas de conseil juridique et tu n'interprètes pas le droit : tu décris ce qui est publié, et tu renvoies vers la collectivité pour le reste.
- Si l'acte demandé n'est pas dans la liste, dis-le simplement : il n'est peut-être pas publié, ou il est plus ancien que les actes listés.

RENVOYER À UN ACTE :
- Chaque acte porte, ci-dessous, son LIEN, déjà écrit en markdown : « [numéro — objet](adresse) ». Pour conduire le lecteur à un acte, recopie CE lien tel quel (tu peux raccourcir le libellé, mais l'adresse se recopie caractère pour caractère).
- Tu n'écris JAMAIS d'adresse toi-même, et tu ne parles JAMAIS de « clé », de « paramètre », de « ?acte= » ni d'identifiant technique : le lecteur clique sur un lien, il ne compose pas d'adresse.
- Quand un acte est en cours de consultation (il est annoncé ci-dessous), réponds d'abord SUR LUI : ce qu'il prévoit, son champ d'application, ses dates, ses versions, ses modifications. C'est la question que le lecteur se pose, même s'il ne la formule pas.`;

const PROMPTS_ATELIER = [
  { id: "pa-rediger", label: "Comment rédiger un acte ?", texte: "Comment est-ce que je rédige un acte à partir d'une trame ?" },
  { id: "pa-retrouver", label: "Retrouver un acte", texte: "Où est-ce que je retrouve un acte que j'ai déjà enregistré ?" },
  { id: "pa-signer", label: "Envoyer en signature", texte: "Quelles sont les étapes pour envoyer un acte en signature ?" },
  { id: "pa-message", label: "Un message rouge", texte: "Que veut dire un message de contrôle affiché en rouge sous un champ ?" },
  { id: "pa-exporter", label: "Exporter l'acte", texte: "Comment est-ce que j'exporte un acte en Word ou en PDF ?" },
  { id: "pa-modifier", label: "Corriger un acte signé", texte: "Comment corriger un acte qui est déjà signé ?" },
];

const PROMPTS_PUBLIC = [
  { id: "pp-derniers", label: "Les derniers actes", texte: "Quels sont les derniers actes publiés ?" },
  { id: "pp-chercher", label: "Trouver un acte", texte: "Comment est-ce que je recherche un acte dans le recueil ?" },
  { id: "pp-eli", label: "L'identifiant ELI", texte: "Qu'est-ce que l'identifiant ELI d'un acte, et à quoi sert-il ?" },
  { id: "pp-opposable", label: "Un acte opposable", texte: "Qu'est-ce qu'un acte opposable, et à partir de quand le devient-il ?" },
  { id: "pp-urbanisme", label: "Actes d'urbanisme", texte: "Y a-t-il des actes publiés qui concernent l'urbanisme ?" },
];

// Un assistant « vierge » : rien que des valeurs par défaut. Le référentiel ne
// range que les écarts (voir `assistantSettings`), pour qu'une amélioration des
// réglages livrés profite aussi aux installations existantes.
export function assistantDefaut(qui) {
  const base = ASSISTANTS[qui] || ASSISTANTS.atelier;
  return {
    actif: true,
    nom: base.nom,             // remplaçable par l'administrateur
    avatar: base.avatar,       // l'icône (une image), remplaçable aussi
    moteur: "auto",            // "auto" | "integre" | "personnalise"
    url: "",                   // adresse de l'API du moteur personnalisé
    cle: "",                   // clé d'accès (facultative)
    entete: "authorization",   // en-tête qui porte la clé
    modele: "",                // nom du modèle, si l'API en attend un
    protocole: "openai",       // "openai" | "texte"
    relais: false,             // passer par le relais sans CORS de la plateforme
    instruction: qui === "public" ? INSTRUCTION_PUBLIC : INSTRUCTION_ATELIER,
    prompts: (qui === "public" ? PROMPTS_PUBLIC : PROMPTS_ATELIER).map((p) => ({ ...p })),
  };
}

export const assistantsDefaut = () => ({ atelier: assistantDefaut("atelier"), public: assistantDefaut("public") });

export const estAssistant = (qui) => ASSISTANT_IDS.includes(qui);

// Les réglages EFFECTIFS d'un assistant : les écarts du référentiel par-dessus
// les valeurs livrées. Une liste de prompts vide est prise au sérieux (c'est un
// choix : « aucune suggestion »), un texte d'instruction vide aussi (il est
// alors simplement absent de l'invite).
export function assistantSettings(config, qui) {
  const d = assistantDefaut(qui);
  const c = (config && config.assistant && config.assistant[qui]) || {};
  return {
    ...d,
    ...c,
    // Un nom ou une icône VIDES ne sont pas un choix : c'est un réglage effacé,
    // et les valeurs livrées reprennent la main (l'interface ne montre jamais
    // un assistant sans nom ni sans visage).
    nom: String(c.nom || "").trim() || d.nom,
    avatar: String(c.avatar || "").trim() || d.avatar,
    prompts: Array.isArray(c.prompts) ? c.prompts : d.prompts,
  };
}

export const assistantActif = (config, qui) => assistantSettings(config, qui).actif !== false;

// Ce que l'interface affiche : le nom et l'icône EFFECTIFS (réglés, ou livrés).
export function assistantIdentite(config, qui) {
  const s = assistantSettings(config, qui);
  const d = ASSISTANTS[qui] || ASSISTANTS.atelier;
  return { nom: s.nom, avatar: s.avatar, titre: d.titre, accueil: d.accueil, note: d.note, placeholder: d.placeholder };
}

// -------------------------------------------------- préférences de poste
// L'agent peut ÉTEINDRE un assistant pour lui seul — une préférence de poste,
// comme l'apparence claire ou sombre (voir src/lib/theme.js) : elle vit dans le
// stockage du navigateur, par COMPTE (deux agents qui partagent un poste gardent
// chacun la leur), et ne touche pas au référentiel. Absence de réglage = allumé.
const PREF_KEY = (qui, userId) => "scribae.assistant." + qui + "." + String(userId || "");

export function assistantPref(qui, userId) {
  if (!userId) return true;
  try { return localStorage.getItem(PREF_KEY(qui, userId)) !== "0"; } catch (e) { return true; }
}

export function reglerPrefAssistant(qui, userId, allume) {
  if (!userId) return true;
  const v = allume !== false;
  try { localStorage.setItem(PREF_KEY(qui, userId), v ? "1" : "0"); } catch (e) { /* poste sans stockage */ }
  return v;
}

// L'assistant se montre-t-il à CE compte ? Le réglage de l'administrateur
// (« éteint » pour tout le monde) prime — l'agent ne peut pas le rallumer ; sa
// propre préférence éteint ensuite le sien. Sans session (visiteur du recueil),
// seule la décision de l'administrateur compte.
export const assistantVisible = (config, user, qui) =>
  assistantActif(config, qui) && assistantPref(qui, user && user.id);

// Écriture d'un réglage : on n'inscrit dans le référentiel que la clé touchée.
export function reglerAssistant(config, qui, patch) {
  config.assistant = config.assistant || {};
  config.assistant[qui] = { ...(config.assistant[qui] || {}), ...patch };
  return config.assistant[qui];
}

// Retour aux réglages livrés : on efface les écarts, les valeurs par défaut
// reprennent la main (et suivront les prochaines livraisons).
export function reinitialiserAssistant(config, qui) {
  if (config.assistant) delete config.assistant[qui];
}

// --------------------------------------------------------------- le moteur
// Quel moteur répond, et pourquoi il n'y en a pas. `raison` est rédigée pour
// être MONTRÉE telle quelle à l'utilisateur.
export function moteurDe(config, qui) {
  const s = assistantSettings(config, qui);
  const integre = hostGenerateText();
  if (s.moteur === "personnalise") {
    return s.url ? { type: "personnalise" }
      : { type: "aucun", raison: "Aucune adresse de moteur n'est renseignée pour cet assistant. Un administrateur peut en régler une (Administration › Assistants)." };
  }
  if (s.moteur === "integre") {
    return integre ? { type: "integre" }
      : { type: "aucun", raison: "Le moteur intégré n'existe que sur Perchance. Ici, l'application a besoin de l'adresse d'un moteur (Administration › Assistants)." };
  }
  if (integre) return { type: "integre" };
  if (s.url) return { type: "personnalise" };
  return { type: "aucun", raison: "Aucun moteur de langage n'est disponible dans cette installation. Un administrateur peut en brancher un (Administration › Assistants)." };
}

export const assistantDisponible = (config, qui) => assistantActif(config, qui) && moteurDe(config, qui).type !== "aucun";

// ------------------------------------------------------------- budget de mots
// Le moteur intégré sait compter les jetons et annoncer sa fenêtre utile ; à
// défaut (moteur personnalisé, aperçu statique), on estime, large et prudent, à
// quatre caractères par jeton.
function budget() {
  const gt = hostGenerateText();
  if (gt) {
    try {
      const m = gt({ getMetaObject: true });
      if (m && typeof m.countTokens === "function" && m.countTokens) {
        const max = Math.max(1200, Math.round((m.idealMaxContextTokens || 6000) * 0.5));
        return { compter: (t) => m.countTokens(String(t)), max };
      }
    } catch (e) { /* le moteur ne se laisse pas interroger : on estime */ }
  }
  return { compter: (t) => Math.ceil(String(t).length / 4), max: 2600 };
}

// ------------------------------------------------- connaissance de l'atelier
// Le nom des chapitres utiles à chaque écran. C'est ce qui donne à l'assistant
// une réponse utile dès la première question, sans lui envoyer tout le guide.
const CHAPITRES_ECRAN = {
  trames: ["administrateurs", "chartes"],
  trame: ["administrateurs", "chartes"],
  rediger: ["rediger", "messages", "export"],
  actes: ["retrouver", "export"],
  acte: ["retrouver", "signature", "execution"],
  modifier: ["modifier"],
  delegations: ["ouvrir", "administrateurs", "signature"],
  signature: ["signature", "parapheur"],
  publications: ["publication"],
  publication: ["publication"],
  execution: ["execution"],
  revision: ["revision"],
  parapheur: ["parapheur"],
  referentiel: ["administrateurs", "comptes", "annuaire"],
  styles: ["chartes"],
  comptes: ["comptes", "annuaire"],
  corbeille: ["corbeille"],
  connexion: ["demarrer", "ouvrir"],
  aide: ["demarrer"],
  docs: ["administrateurs"],
};

// Compose ce que l'assistant de l'atelier a le droit de savoir : le guide, et le
// nom de l'écran où l'on se trouve. Rien d'autre — jamais un acte, jamais une
// trame, jamais un compte.
//
// Le guide entier ferait vingt mille jetons : on joint donc les chapitres qui
// RÉPONDENT à la question, puis ceux de l'écran courant, puis un socle de
// chapitres toujours utiles — dans cet ordre, pour que le budget profite
// d'abord à ce qui sert. Les deux premiers sont donnés largement, les suivants
// plus court, et le sommaire de TOUS les chapitres reste sous les yeux du
// modèle : il peut ainsi renvoyer au bon chapitre même s'il n'en a pas le
// détail. Un chapitre trop long est coupé plutôt qu'écarté.
const SOCLE = ["demarrer", "export", "messages", "memo", "retrouver", "depannage"];
const PLAFOND = [3200, 3200, 2000, 1800, 1800, 1800, 1600];

// Tronque un texte court à `max` caractères, sur une fin de ligne quand il y en
// a une : un lien markdown coupé en deux ne serait plus recopiable.
function suiteTronquee(texte, max) {
  const t = String(texte || "");
  if (t.length <= max) return t;
  const coupe = t.lastIndexOf("\n", max);
  return coupe > max * 0.5 ? t.slice(0, coupe) : t.slice(0, max);
}

export function contexteAtelier({ ecran = "", ecranLabel = "", question = "" } = {}) {
  const { compter, max } = budget();
  const chapitre = (id) => GUIDE.chapters.find((c) => c.id === id);
  const ordre = [];
  const ajouter = (id) => { if (id && chapitre(id) && !ordre.includes(id)) ordre.push(id); };
  for (const c of chapitresPertinents(question, 3)) ajouter(c.id);
  for (const id of CHAPITRES_ECRAN[ecran] || []) ajouter(id);
  for (const id of SOCLE) ajouter(id);

  let entete = "Ceci est le guide d'utilisation de l'application, découpé en chapitres.";
  if (ecranLabel) entete += " L'agent se trouve en ce moment sur l'écran « " + ecranLabel + " ».";
  entete += "\n\nTable des chapitres du guide. Chaque ligne porte son LIEN — à recopier tel quel"
    + " pour renvoyer au chapitre (il s'ouvre dans l'application) :\n" + guideSommaire() + "\n";

  let reste = max - compter(entete) - compter("Chapitres détaillés :\n");
  const detailles = [];
  const ecartes = [];
  ordre.forEach((id, i) => {
    const c = chapitre(id);
    const plafond = PLAFOND[Math.min(i, PLAFOND.length - 1)];
    const entier = chapitreEnTexte(c) + "\nLien de ce chapitre : " + lienChapitre(c);
    // On coupe sur une FIN DE LIGNE : couper au caractère près casserait le lien
    // markdown que l'assistant doit recopier.
    const coupe = entier.length > plafond ? suiteTronquee(entier, plafond) + "\n[… la suite est dans le guide — " + lienChapitre(c) + "]" : entier;
    const cout = compter(coupe) + 2;
    if (cout <= reste) { detailles.push(coupe); reste -= cout; return; }
    if (reste > 400) {
      detailles.push(suiteTronquee(coupe, Math.max(600, reste * 4)) + "\n[… la suite est dans le guide — " + lienChapitre(c) + "]");
      reste = 0;
    } else {
      ecartes.push(c.title);
    }
  });
  let texte = entete + "\nChapitres détaillés :\n\n" + detailles.join("\n\n");
  if (ecartes.length) texte += "\n\n(Chapitres non détaillés ici, à consulter dans le guide : " + ecartes.join(", ") + ".)";
  return texte;
}

// ------------------------------------------------ connaissance du recueil
// Ce que l'assistant public a le droit de savoir : les ACTES PUBLIÉS, tels que
// le recueil les montre. Les actes les plus récents sont accompagnés d'un
// extrait de leur texte, pour pouvoir répondre sur leur contenu ; les autres
// sont résumés par leurs métadonnées.
//
// Deux choses comptent ici :
//   • chaque acte porte son LIEN, déjà libellé (« [numéro — objet](adresse) »),
//     que l'assistant recopie — il n'écrit jamais d'adresse, et ne parle jamais
//     de « clé » ni de « paramètre » : le lecteur clique, il ne compose rien ;
//   • l'acte EN COURS DE CONSULTATION est annoncé à part, et en entier (texte
//     compris) : l'assistant répond alors sur lui — ce qu'il prévoit, sa portée,
//     ses dates, ses versions, ses modifications — sans qu'on le lui demande.
export function contextePublic({ publications = [], config = null, acte = null } = {}) {
  const { compter, max } = budget();
  const recueil = (config && config.publication && config.publication.recueil) || "Recueil des actes administratifs";
  const tous = (publications || []).filter((p) => p && p.latest !== false);
  const entete = "Recueil : « " + recueil + " ». " + tous.length + " acte" + (tous.length > 1 ? "s" : "") + " publié" + (tous.length > 1 ? "s" : "") + "."
    + (tous.length ? " Chaque acte porte son LIEN, à recopier pour y conduire le lecteur." : "");
  if (!tous.length && !acte) return entete + " Aucun acte n'est publié pour le moment.";

  let reste = max - compter(entete);
  let texte = entete;

  // ------------------------------------------ l'acte que le visiteur consulte
  if (acte) {
    const fiche = fichePublique(acte, config, {
      complet: true,
      texteMax: Math.max(1500, Math.floor(reste * 1.6)),
      versions: acte.versions || [],
    });
    const cout = compter(fiche) + 4;
    if (cout <= reste) { texte += "\n\n" + fiche; reste -= cout; }
    else { texte += "\n\n" + fichePublique(acte, config, { complet: true, texteMax: 700, versions: acte.versions || [] }); reste = Math.max(0, reste - cout); }
  }

  if (!tous.length) return texte;
  texte += "\n\nActes publiés :\n";
  reste -= compter("\n\nActes publiés :\n");
  const lignes = [];
  tous.slice(0, 80).forEach((p, i) => {
    const l = ["- " + designation(p, config)];
    l.push("  " + resumeDates(p));
    if (p.eliUri) l.push("  identifiant ELI : " + p.eliUri);
    // Le lien : c'est lui, et lui seul, que l'assistant recopie.
    if (p.cle) l.push("  lien : " + lienPublic(p, config));
    // Les dix plus récents portent un extrait de leur texte : c'est ce qui
    // permet de répondre « que prévoit cet acte ? » sans envoyer tout le
    // recueil au moteur.
    if (i < 10 && p.formats && p.formats.texte) {
      const extrait = String(p.formats.texte).replace(/\s+/g, " ").trim().slice(0, 500);
      if (extrait) l.push("  début du texte : " + extrait + (String(p.formats.texte).length > 500 ? " […]" : ""));
    }
    const bloc = l.join("\n");
    const cout = compter(bloc) + 1;
    if (cout > reste) return;
    reste -= cout;
    lignes.push(bloc);
  });
  texte += lignes.join("\n");
  if (tous.length > lignes.length) texte += "\n\n(" + (tous.length - lignes.length) + " acte(s) plus ancien(s) ne sont pas détaillés ici.)";
  return texte;
}

// Le libellé d'une nature d'acte, lu au référentiel (même règle que le recueil).
function libelleNature(config, id) {
  if (!id) return "";
  const t = ((config && config.actTypes) || []).find((x) => x.id === id);
  return t ? t.label : String(id).charAt(0).toUpperCase() + String(id).slice(1);
}

const designation = (p, config) =>
  [[libelleNature(config, p.nature) || "Acte", p.numero ? "n° " + p.numero : ""].filter(Boolean).join(" "),
    p.objet ? " — " + p.objet : ""].join("");

function resumeDates(p) {
  return [
    p.dateDocument ? "acte du " + formatDate(p.dateDocument) : "",
    p.datePublication ? "publié le " + formatDate(p.datePublication) : "",
    p.dateOpposabilite ? "entrée en vigueur le " + formatDate(p.dateOpposabilite) : "",
  ].filter(Boolean).join(", ") || "dates non renseignées";
}

// Le lien d'un acte, prêt à recopier : le libellé dit de quel acte il s'agit,
// et l'adresse est celle que le recueil suit SANS recharger la page.
function lienPublic(p, config) {
  const label = [p.numero ? "n° " + p.numero : "", p.objet || ""].filter(Boolean).join(" — ") || designation(p, config);
  return "[" + label + "](" + hrefActe(p.cle) + ")";
}

// La fiche d'un acte pour l'assistant. `complet` y joint le texte (entier quand
// il tient dans le budget) et les versions publiées sous le même identifiant :
// c'est ce qui permet de répondre sur la PORTÉE de l'acte, ses MODIFICATIONS et
// ses ÉVOLUTIONS, pas seulement sur son existence.
function fichePublique(acte, config, { complet = false, texteMax = 800, versions = [] } = {}) {
  const p = acte || {};
  const l = [];
  l.push("L'ACTE QUE LE VISITEUR CONSULTE EN CE MOMENT — réponds d'abord sur lui, même s'il ne l'a pas nommé :");
  l.push("- " + designation(p, config));
  if (p.entityName) l.push("  autorité : " + p.entityName + (p.auteur ? " (rédigé par " + p.auteur + ")" : ""));
  if (p.themeLabel || p.themeId) l.push("  matière : " + (p.themeLabel || p.themeId));
  l.push("  " + resumeDates(p));
  if (p.eliUri) l.push("  identifiant ELI : " + p.eliUri + " (stable : il désigne toujours la version en vigueur)");
  l.push("  rédaction : " + (p.kind === "consolidee" ? "version consolidée (mise à jour de ses modifications)" : p.kind === "modificative" ? "version modificative" : "version initiale") + (p.latest === false ? ", supplantée par une version plus récente" : ", en vigueur"));
  if (versions && versions.length > 1) {
    const tri = [...versions].sort((x, y) => String(x.dateDocument || "").localeCompare(String(y.dateDocument || "")));
    l.push("  versions publiées sous ce même identifiant (de la plus ancienne à la plus récente) : " +
      tri.map((v, i) => (v.kind === "consolidee" ? "consolidation" : v.kind === "modificative" ? "modification" : "version initiale") + " du " + formatDate(v.dateDocument) + (i === tri.length - 1 ? " (version en vigueur)" : "") + (v.cle === p.cle ? " [celle qui est consultée]" : "")).join(" · "));
  }
  if (p.cle) l.push("  lien : " + lienPublic(p, config));
  if (complet && p.formats && p.formats.texte) {
    const corps = String(p.formats.texte).replace(/[ \t]+/g, " ").trim();
    const coupe = corps.length > texteMax ? corps.slice(0, texteMax) + "\n[…] (texte abrégé — le lecteur lit l'acte entier en suivant le lien)" : corps;
    if (coupe) l.push("  texte " + (corps.length > texteMax ? "abrégé " : "") + "de l'acte :\n" + coupe);
  } else if (p.formats && p.formats.texte) {
    const extrait = String(p.formats.texte).replace(/\s+/g, " ").trim().slice(0, 400);
    if (extrait) l.push("  début du texte : " + extrait + (String(p.formats.texte).length > 400 ? " […]" : ""));
  }
  return l.join("\n");
}

// ---------------------------------------------------------------- l'invite
function composerInvite({ qui, instruction, connaissances, historique }) {
  const nom = ASSISTANTS[qui]?.nom || "Assistant";
  const log = (historique || [])
    .map((m) => (m.role === "user" ? "Vous" : nom) + " : " + String(m.texte || "").trim())
    .join("\n\n");
  const tache = qui === "public"
    ? "TÂCHE : réponds à la dernière question, uniquement à partir des actes publiés ci-dessus. Si un acte est en cours de consultation, réponds d'abord sur lui (ce qu'il prévoit, sa portée, ses dates, ses versions publiées, ses modifications). Pour renvoyer à un acte, recopie son lien markdown tel quel. Si l'acte demandé n'est pas dans la liste, dis-le simplement. Français, vouvoiement, une à cinq phrases."
    : "TÂCHE : réponds à la dernière question, uniquement à partir de ce que tu sais ci-dessus. Si la réponse n'y est pas, dis-le et renvoie au chapitre du guide par son LIEN (recopié tel quel), ou nomme l'écran à ouvrir. Français, vouvoiement, une à cinq phrases.";
  return [
    instruction,
    "",
    "### CE QUE TU SAIS (et rien d'autre)",
    connaissances,
    "### FIN DE CE QUE TU SAIS",
    "",
    "### CONVERSATION",
    log,
    "### FIN DE LA CONVERSATION",
    "",
    tache,
  ].join("\n");
}

// ---------------------------------------------------------------- réponses
export class AssistantIndisponible extends Error {
  constructor(message) {
    super(message);
    this.name = "AssistantIndisponible";
    this.raison = message;
  }
}

// Le point d'entrée unique : l'interface ne connaît que celui-là.
//   question      la question posée (facultative quand `historique` la porte)
//   historique    les échanges précédents : [{role: "user"|"assistant", texte}]
//   acteCourant   (recueil) l'acte que le visiteur consulte en ce moment
//   onChunk       (texteAjouté, texteComplet) appelé au fil de la génération
//   signal        AbortSignal, pour pouvoir interrompre la génération
export async function repondre({ config, qui, question = "", historique = [], ecran = "", ecranLabel = "", publications = null, acteCourant = null, onChunk = null, signal = null } = {}) {
  if (!estAssistant(qui)) throw new AssistantIndisponible("Assistant inconnu.");
  const s = assistantSettings(config, qui);
  const instruction = String(s.instruction || "").trim() || assistantDefaut(qui).instruction;
  const connaissances = qui === "public"
    ? contextePublic({ publications: publications || [], config, acte: acteCourant })
    : contexteAtelier({ ecran, ecranLabel, question });
  const hist = [...historique];
  if (question) hist.push({ role: "user", texte: question });
  const invite = composerInvite({ qui, instruction, connaissances, historique: hist });

  const moteur = moteurDe(config, qui);
  if (moteur.type === "aucun") throw new AssistantIndisponible(moteur.raison);
  if (moteur.type === "integre") return viaMoteurIntegre(hostGenerateText(), { invite, onChunk, signal });
  return viaMoteurPersonnalise(s, { instruction, connaissances, historique: hist, invite, onChunk, signal });
}

async function viaMoteurIntegre(gt, { invite, onChunk, signal }) {
  const promesse = gt({
    instruction: invite,
    onChunk: onChunk ? (d) => onChunk(d.textChunk || "", d.fullTextSoFar || "") : undefined,
  });
  // La promesse non attendue du plugin porte `.stop()` : c'est par lui que
  // « Arrêter » interrompt vraiment la génération côté service.
  if (signal && typeof promesse?.stop === "function") {
    signal.addEventListener("abort", () => { try { promesse.stop(); } catch (e) { /* déjà fini */ } }, { once: true });
  }
  const r = await promesse;
  return String(r && r.text != null ? r.text : r || "").trim();
}

// ------------------------------------------------- moteur personnalisé (API)
// Deux protocoles, parce que ce sont les deux formes que l'on rencontre :
//   • « openai » — l'API des complétions de conversation : messages
//     rôle/contenu, flux SSE (« data: {…} ») ou réponse JSON. C'est ce que
//     parlent OpenAI, Mistral, Groq, OpenRouter, Ollama, LM Studio, vLLM — et
//     donc, très souvent, le service que la collectivité héberge elle-même.
//   • « texte » — un appel simple { prompt, modele } qui rend { texte }.
//
// Le relais sans CORS de la plateforme est proposé en option : sans lui, un
// moteur qui n'autorise pas l'origine de l'application restera injoignable
// depuis le navigateur (c'est la règle CORS, pas une limite de l'application).
function transportFetch(s, url, options) {
  const relais = s.relais === true ? hostSuperFetch() : null;
  return relais ? relais(url, options) : fetch(url, options);
}

function entetesDe(s) {
  const h = { "content-type": "application/json" };
  const cle = String(s.cle || "").trim();
  if (!cle) return h;
  if (s.entete === "x-api-key") h["x-api-key"] = cle;
  else if (s.entete === "aucune") { /* clé rangée, mais volontairement non envoyée */ }
  else h["authorization"] = "Bearer " + cle;
  return h;
}

function messageErreur(status, corps) {
  return "Le moteur a refusé la requête (" + status + ")" + (corps ? " : " + corps : "") + ".";
}

async function viaMoteurPersonnalise(s, { instruction, connaissances, historique, invite, onChunk, signal }) {
  const url = String(s.url || "").trim();
  if (!url) throw new AssistantIndisponible("Aucune adresse de moteur n'est renseignée pour cet assistant.");
  const entetes = entetesDe(s);
  const corps = s.protocole === "texte"
    ? { prompt: invite, ...(s.modele ? { modele: s.modele, model: s.modele } : {}) }
    : {
        ...(s.modele ? { model: s.modele } : {}),
        stream: true,
        messages: [
          { role: "system", content: [instruction, connaissances].filter(Boolean).join("\n\n") },
          ...historique.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.texte || "") })),
        ],
      };

  let reponse;
  try {
    reponse = await transportFetch(s, url, { method: "POST", headers: entetes, body: JSON.stringify(corps), signal });
  } catch (e) {
    if (e && e.name === "AbortError") throw e;
    throw new Error("Le moteur est injoignable (" + ((e && e.message) || e) + "). Vérifiez l'adresse, et que le service accepte les appels venus de cette page (CORS).");
  }
  if (!reponse || reponse.ok === false) {
    const txt = reponse ? await texteDe(reponse) : "";
    throw new Error(messageErreur(reponse ? reponse.status : "?", txt.slice(0, 300)));
  }
  const type = (reponse.headers && typeof reponse.headers.get === "function" ? reponse.headers.get("content-type") : "") || "";
  if (/event-stream/i.test(type) && reponse.body && typeof reponse.body.getReader === "function") {
    return lireFlux(reponse.body, onChunk, extraireDelta);
  }
  const texte = extraireTexte(await texteDe(reponse));
  if (onChunk && texte) onChunk(texte, texte);
  return texte.trim();
}

async function texteDe(reponse) {
  try { return await reponse.text(); } catch (e) { return ""; }
}

// Flux : SSE (« data: {…} ») ou NDJSON (une réponse JSON par ligne, comme
// Ollama) — les deux se lisent de la même façon dès lors que l'on tolère
// l'absence du préfixe.
async function lireFlux(flux, onChunk, extraire) {
  const lecteur = flux.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";
  let texte = "";
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    tampon += decodeur.decode(value, { stream: true });
    const lignes = tampon.split(/\r?\n/);
    tampon = lignes.pop() || "";
    for (const ligne of lignes) {
      const t = ligne.trim();
      if (!t || t.startsWith(":")) continue;
      const donnee = t.startsWith("data:") ? t.slice(5).trim() : t;
      if (!donnee || donnee === "[DONE]") continue;
      let objet;
      try { objet = JSON.parse(donnee); } catch (e) { continue; }
      const ajout = extraire(objet);
      if (ajout) { texte += ajout; if (onChunk) onChunk(ajout, texte); }
    }
  }
  return texte.trim();
}

function extraireDelta(o) {
  const choix = o && o.choices && o.choices[0];
  const d = choix && (choix.delta || choix.message);
  const c = d && d.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p) => (typeof p === "string" ? p : p && p.text) || "").join("");
  if (o && o.message && typeof o.message.content === "string") return o.message.content;   // Ollama
  return "";
}

// Un corps de réponse qui n'est pas un flux : JSON d'API, ou texte brut.
function extraireTexte(brut) {
  const t = String(brut || "").trim();
  if (!t) return "";
  if (t[0] === "{" || t[0] === "[") {
    let o;
    try { o = JSON.parse(t); } catch (e) { o = null; }
    if (o && !Array.isArray(o)) {
      const choix = o.choices && o.choices[0];
      const c = choix && (choix.message ? choix.message.content : choix.text);
      if (typeof c === "string") return c;
      if (Array.isArray(c)) return c.map((p) => (typeof p === "string" ? p : p && p.text) || "").join("");
      if (o.message && typeof o.message.content === "string") return o.message.content;
      for (const k of ["texte", "text", "reponse", "réponse", "response", "content", "output"]) {
        if (typeof o[k] === "string") return o[k];
      }
    }
  }
  // NDJSON complet (un objet par ligne) : on recolle les morceaux.
  if (t.includes("\n")) {
    const morceaux = t.split(/\r?\n/).map((l) => { try { return extraireDelta(JSON.parse(l)); } catch (e) { return ""; } });
    if (morceaux.some(Boolean)) return morceaux.join("");
  }
  return t;
}

// ------------------------------------------------------- identifiant de prompt
export const nouvelIdPrompt = () => uid("ap");
