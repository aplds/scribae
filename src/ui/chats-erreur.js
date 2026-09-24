// ============================================================================
// Le chat d'une page d'erreur, côté atelier.
//
// Les écrans d'erreur de l'atelier — « Atelier hors réseau » (403), « Pas
// d'accès » (403), l'alerte d'affichage et l'échec d'initialisation (500) —
// appellent `chatErreurEl` : elle rend la figure si l'administration a allumé
// les chats d'erreur, et `null` sinon. Les vues n'ont donc pas à connaître le
// réglage, ni l'adresse de l'image, ni le repli par classe : elles disent
// seulement QUEL code illustre leur panne.
//
// L'image est posée en `loading="lazy"` : rien n'est demandé à http.cat tant que
// la figure n'entre pas dans la fenêtre. C'est une politesse pour le tiers, et
// cela ne change rien pour un écran qui, lui, est visible tout de suite.
// ============================================================================

import { h } from "./dom.js";
import { state } from "./state.js";
import { chatPour, chatsErreurActifs } from "../lib/chats-erreur.js";

export function chatErreurEl(code, options = {}) {
  if (!chatsErreurActifs(state.config)) return null;
  const chat = chatPour(code, options);
  if (!chat) return null;
  return h("figure", { class: "chat-erreur" },
    h("img", {
      class: "chat-erreur__img", src: chat.url, alt: chat.alt,
      loading: "lazy", decoding: "async", referrerpolicy: "no-referrer",
    }),
    h("figcaption", { class: "chat-erreur__legende", text: chat.legende }),
    h("p", { class: "chat-erreur__source" },
      h("a", { href: chat.source, target: "_blank", rel: "noopener noreferrer", text: "http.cat" })),
  );
}
