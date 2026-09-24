// ============================================================================
// Les chats des pages d'erreur, vus par l'application.
//
// La RÈGLE — quel code illustre quel code, où est l'image, comment la décrire —
// vit une seule fois, sous `src/server/mysql/chats-erreur.mjs` : c'est le seul
// emplacement que le service (image Docker) et le navigateur peuvent importer
// tous les deux (voir l'en-tête de ce fichier-là). Ce module-ci n'ajoute que ce
// qui est propre à l'application : la LECTURE DU RÉGLAGE, qui vit dans le
// référentiel public (`config.publication.chatsErreur`, éteint par défaut).
//
// L'application et le service public doivent dire la même chose, sinon
// l'administration allumerait l'option sans rien voir changer sur le recueil —
// d'où le module partagé plutôt que deux tables de correspondance.
// ============================================================================

export { CHAT_SOURCE, CODES_CHAT, codeChat, urlChat, chatPour } from "../server/mysql/chats-erreur.mjs";

// Le réglage, tel qu'il s'écrit dans le référentiel. Vrai seulement s'il est
// posé explicitement : un référentiel antérieur n'a pas le champ, et l'absence
// vaut « éteint » — la seule valeur sûre pour un appel à un tiers.
export const chatsErreurActifs = (config) =>
  !!(config && config.publication && config.publication.chatsErreur === true);
