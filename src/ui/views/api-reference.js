// ============================================================================
// Écran « API REST » — la référence COMPLÈTE, et le panneau de commande.
//
// Deux volets, comme une documentation d'API qui se respecte :
//
//   • à gauche, toutes les routes, groupées par famille (service, comptes,
//     persistance, actes, signature, publication, courriel, adresses du site) ;
//   • à droite, la route ouverte : ce qu'elle fait, qui peut l'appeler, ses
//     paramètres, son corps, ses réponses et ses codes d'erreur — puis le
//     PANNEAU DE COMMANDE, qui la joue pour de vrai.
//
// Le panneau de commande n'est pas un simulateur : il appelle le service par
// `call()` (voir src/lib/remote.js), exactement comme le reste de
// l'application. Chaque appel part donc dans le journal « API & journal », avec
// sa requête, sa réponse et sa durée — un essai n'est jamais perdu.
//
// La description des routes vit dans src/lib/api-reference.js (et se recopie
// dans src/docs/API.md) : cet écran ne fait que la présenter et l'exécuter.
// ============================================================================
import { state, navigate } from "../state.js";
import { h, clear, button, toast } from "../dom.js";
import { textField, sectionHeader } from "../components.js";
import { copyText } from "../../lib/util.js";
import { call, apiStatus } from "../../lib/remote.js";
import { publicationSettings } from "../../lib/eli.js";
import { cleService } from "../../lib/cle-service.js";
import {
  API_REFERENCE, GROUPES_API, OPERATION, operationsDuGroupe,
  exempleChemin, curlDe, ROLES_API, CODES_ERREUR,
} from "../../lib/api-reference.js";

const METHOD_COULEUR = { GET: "info", POST: "brand", DELETE: "error" };

// L'adresse de base de l'API : celle du déploiement auto-hébergé quand on y est,
// celle de la démonstration sinon. C'est la même règle que l'onglet « API &
// journal » (src/ui/views/api-console.js), pour que les deux écrans parlent de
// la même adresse.
const baseApi = () => globalThis.__SCRIBA_SELF_HOSTED__
  ? ((globalThis.__SCRIBA_API_BASE__ || "").replace(/\/+$/, "") || globalThis.location.origin)
  : "https://api.valmont-sur-loire.fr";

// L'état de l'écran (route ouverte, chemin et corps en cours de frappe, réponse
// du dernier appel). Il vit dans `state.ui` : un redessin ne doit pas perdre ce
// qu'on était en train d'écrire.
function ui() {
  const s = (state.ui = state.ui || {});
  s.apiRef = s.apiRef || { op: "sante", chemin: "", corps: "", jeton: "", reponse: null, enCours: false };
  return s.apiRef;
}

export function renderApiReference(root) {
  const u = ui();
  const op = OPERATION[u.op] || API_REFERENCE[0];

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "API REST" }),
      h("p", { class: "page-head__sub", text: "Toute la surface du service : les routes, qui peut les appeler, ce qu'elles attendent et ce qu'elles répondent — et un panneau pour les jouer réellement. Les appels partent au service avec les mêmes règles que l'application : ils apparaissent dans « API & journal » avec leur requête, leur réponse et leur durée." })),
    h("div", { class: "page-head__actions" },
      h("span", {
        class: "fr-badge fr-badge--" + (apiStatus().state === "online" ? "success" : "warning"),
        text: "service : " + apiStatus().state,
      }),
      button("Description OpenAPI", { variant: "secondary", size: "sm", icon: "download", onClick: () => ouvrirOpenapi() }),
      button("Journal des appels", { variant: "secondary", size: "sm", icon: "list", onClick: () => { state.ui.sigTab = "api"; navigate("signature"); } }),
    ),
  ));

  const grid = h("div", { class: "api-ref" });
  const side = h("div", { class: "api-ref__side" });
  const main = h("div", { class: "api-ref__main" });
  grid.appendChild(side);
  grid.appendChild(main);
  root.appendChild(grid);

  // ------------------------------------------------------- sommaire des routes
  const carte = h("div", { class: "fr-card fr-card--soft api-ref__liste" });
  for (const g of GROUPES_API) {
    const ops = operationsDuGroupe(g.id);
    if (!ops.length) continue;
    carte.appendChild(h("p", { class: "api-ref__groupe", text: g.label, title: g.resume }));
    for (const o of ops) {
      carte.appendChild(h("button", {
        class: "api-ref__item" + (o.id === op.id ? " is-on" : ""),
        onClick: () => { state.ui.apiRef = { ...u, op: o.id, chemin: "", corps: "", reponse: null }; redrawSelf(root); },
      },
        h("span", { class: "fr-badge fr-badge--" + (METHOD_COULEUR[o.methode] || "info"), text: o.methode }),
        h("span", { class: "api-ref__item-txt" },
          h("span", { class: "api-ref__item-nom", text: o.resume }),
          h("span", { class: "fr-small fr-muted fr-mono", text: o.chemin }))));
    }
  }
  side.appendChild(carte);

  // -------------------------------------------------------- la route ouverte
  main.appendChild(enteteOp(op));
  main.appendChild(h("article", { class: "fr-card api-ref__doc" },
    h("p", { text: op.description || "" }),
    op.params && op.params.length ? h("div", { class: "fr-table-wrap" },
      h("table", { class: "fr-table" },
        h("thead", {}, h("tr", {}, h("th", { text: "Paramètre" }), h("th", { text: "Type" }), h("th", { text: "Rôle" }))),
        h("tbody", {}, ...op.params.map((p) => h("tr", {},
          h("td", {}, h("code", { text: p.nom })),
          h("td", { text: p.type || "string" }),
          h("td", { text: p.description || "" })))))) : null,
    op.champs && op.champs.length ? h("div", {},
      h("h3", { class: "api-ref__sous", text: "Champs notables" }),
      h("div", { class: "fr-table-wrap" },
        h("table", { class: "fr-table" },
          h("thead", {}, h("tr", {}, h("th", { text: "Champ" }), h("th", { text: "Type" }), h("th", { text: "Sens" }))),
          h("tbody", {}, ...op.champs.map((c) => h("tr", {},
            h("td", {}, h("code", { text: c.cle })),
            h("td", { text: c.type }),
            h("td", { text: c.description }))))))) : null,
    h("h3", { class: "api-ref__sous", text: "Réponses" }),
    h("div", { class: "fr-table-wrap" },
      h("table", { class: "fr-table" },
        h("thead", {}, h("tr", {}, h("th", { text: "Code" }), h("th", { text: "Sens" }))),
        h("tbody", {}, ...(op.reponses || []).map((r) => h("tr", {},
          h("td", {}, h("span", { class: "fr-badge fr-badge--" + (r.code < 300 ? "success" : r.code < 500 ? "warning" : "error"), text: String(r.code) })),
          h("td", { text: r.description || "" }))))))
  ));

  // ------------------------------------------------------- le panneau de commande
  main.appendChild(panneau(op, u, root));
  main.appendChild(h("hr", { class: "fr-sep" }));
  main.appendChild(sectionHeader("Mémento"));
  main.appendChild(memoApi());
}

// L'en-tête de la route : méthode, chemin, rôle requis, et la note de service
// (route servie par le service auto-hébergé seulement, ou par la plateforme).
function enteteOp(op) {
  const authLabel = op.auth === "public" ? "route publique (aucune clé)" : "rôle minimal : " + op.auth;
  return h("div", { class: "fr-card api-ref__tete" },
    h("div", { class: "fr-row", style: { flexWrap: "wrap", alignItems: "center", gap: "8px" } },
      h("span", { class: "fr-badge fr-badge--" + (METHOD_COULEUR[op.methode] || "info"), text: op.methode }),
      h("code", { class: "api-ref__chemin", text: exempleChemin(op) }),
      h("span", { class: "fr-spacer" }),
      h("span", { class: "fr-badge fr-badge--" + (op.auth === "public" ? "info" : "warning"), title: authLabel, text: op.auth === "public" ? "public" : op.auth })),
    h("p", { class: "fr-small fr-muted", style: { margin: "6px 0 0" }, text: [
      authLabel,
      op.service === "auto-heberge" ? "servie par le service auto-hébergé (src/server/mysql)" : "",
      op.service === "plateforme" ? "servie par le service de la plateforme" : "",
    ].filter(Boolean).join(" · ") }),
  );
}

function panneau(op, u, root) {
  const box = h("div", { class: "fr-card api-ref__commande" });
  box.appendChild(h("h2", { class: "fr-card__title", text: "Panneau de commande" }));
  box.appendChild(h("p", { class: "fr-card__sub", text: "L'appel part réellement au service, avec le jeton ou la session de ce poste. Un appel d'écriture MODIFIE les données : relisez le corps avant d'envoyer." }));

  const chemin = textField({
    label: "Chemin",
    value: u.chemin || exempleChemin(op),
    help: "Pré-rempli avec un exemple. Les identifiants (ACT-…, SIG-…) sont à remplacer par les vôtres.",
    onChange: (v) => { u.chemin = v; },
  });
  const cheminInput = chemin.querySelector("input");
  const corps = textField({
    label: "Corps de la requête (JSON)",
    value: u.corps || (op.corps ? JSON.stringify(op.corps, null, 2) : ""),
    rows: 8,
    help: op.corps ? "Le corps attendu par la route. Modifiable : c'est un vrai appel." : "Cette route n'attend aucun corps.",
    onChange: (v) => { u.corps = v; },
  });
  const corpsInput = corps.querySelector("textarea");
  const jeton = textField({
    label: "Jeton d'API (mode « demo » seulement)",
    value: u.jeton || cleService() || publicationSettings(state.config).jetonDemonstration || "",
    help: "En mode mot de passe ou annuaire, la session et son cookie suffisent : laissez vide. Le jeton n'est jamais enregistré dans le référentiel.",
    onChange: (v) => { u.jeton = v; },
  });
  const jetonInput = jeton.querySelector("input");
  if (op.auth === "public") jetonInput.value = "";

  const resultat = h("div", { class: "api-ref__resultat" });
  const peindreReponse = () => {
    clear(resultat);
    const r = u.reponse;
    if (!r) { resultat.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun appel encore envoyé." })); return; }
    resultat.appendChild(h("div", { class: "fr-row", style: { flexWrap: "wrap", alignItems: "center", gap: "8px" } },
      h("span", { class: "fr-badge fr-badge--" + (r.status >= 200 && r.status < 300 ? "success" : r.status === 0 ? "error" : "warning"), text: String(r.status) }),
      h("span", { class: "fr-small fr-muted", text: r.ms + " ms" }),
      h("span", { class: "fr-small fr-muted", text: (r.methode || op.methode) + " " + (r.chemin || "") })));
    resultat.appendChild(h("pre", { class: "fr-mono api-ref__corps", text: JSON.stringify(r.body, null, 2) }));
  };
  peindreReponse();

  const envoyer = button("Envoyer la requête", {
    variant: "primary", icon: "check",
    onClick: async () => {
      const p = cheminInput.value.trim();
      if (!p) { toast("Renseignez le chemin.", "warning"); return; }
      let corpsValeur = null;
      if (op.methode !== "GET") {
        const txt = corpsInput ? corpsInput.value.trim() : "";
        if (txt) {
          try { corpsValeur = JSON.parse(txt); }
          catch (e) { toast("Le corps n'est pas du JSON valide : " + String((e && e.message) || e), "error"); return; }
        }
      }
      u.enCours = true;
      try {
        const r = await call(op.methode, p, {
          body: corpsValeur,
          token: jetonInput.value.trim() || null,
          label: "Panneau de commande — " + op.resume,
          source: "console",
        });
        u.reponse = { status: r.status, ms: r.ms, body: r.body, methode: op.methode, chemin: p };
        toast(op.methode + " " + p + " → " + r.status, r.ok ? "success" : "warning");
      } catch (e) {
        u.reponse = { status: 0, ms: 0, body: { erreur: String((e && e.message) || e) }, methode: op.methode, chemin: p };
        toast(String((e && e.message) || e), "error");
      } finally {
        u.enCours = false;
        peindreReponse();
      }
    },
  });

  box.appendChild(h("div", { class: "fr-grid fr-grid--2" }, chemin, jeton));
  box.appendChild(corps);
  box.appendChild(h("div", { class: "fr-row", style: { flexWrap: "wrap", gap: "8px" } },
    envoyer,
    button("Copier en cURL", {
      variant: "secondary", icon: "copy",
      onClick: () => copyText(curlDe(op, { base: baseApi(), token: jetonInput.value.trim() || "VOTRE_JETON", base64: "" }))
        .then(() => toast("Commande cURL copiée.", "success")),
    }),
    button("Réinitialiser", {
      variant: "tertiary", icon: "refresh",
      onClick: () => { u.chemin = ""; u.corps = ""; u.reponse = null; redrawSelf(root); },
    }),
    h("span", { class: "fr-spacer" }),
    h("span", { class: "fr-small fr-muted", text: "Adresse de base : " + baseApi() }),
  ));
  box.appendChild(h("h3", { class: "api-ref__sous", text: "Réponse" }));
  box.appendChild(resultat);

  // L'aperçu cURL se maintient à la frappe du chemin : c'est la commande qu'on
  // colle dans un ticket ou une documentation d'intégration.
  const apercu = h("pre", { class: "fr-mono api-ref__curl", text: curlDe(op, { base: baseApi(), token: jetonInput.value.trim() || "VOTRE_JETON" }) });
  const majApercu = () => {
    apercu.textContent = curlDe({ ...op, chemin: cheminInput.value.trim() || op.chemin },
      { base: baseApi(), token: jetonInput.value.trim() || "VOTRE_JETON" });
  };
  cheminInput.addEventListener("input", majApercu);
  jetonInput.addEventListener("input", majApercu);
  box.appendChild(h("h3", { class: "api-ref__sous", text: "En ligne de commande" }));
  box.appendChild(apercu);

  return box;
}

// Redessine l'écran sans changer de route : les deux volets se réordonnent, et
// la sélection suit. On repasse par le rendu de la vue, pour que l'état affiché
// vienne toujours du même endroit.
function redrawSelf(root) {
  clear(root);
  renderApiReference(root);
}

// Le document OpenAPI vit sur le service : on l'ouvre dans un onglet, et l'on
// explique quoi en faire. C'est lui que lisent Postman, Insomnia et les clients
// générés.
async function ouvrirOpenapi() {
  const url = baseApi().replace(/\/+$/, "") + "/v1/";
  try { window.open(url, "_blank", "noopener"); } catch (e) { /* le lien reste affiché */ }
  try { await copyText(url); toast("Adresse du document OpenAPI copiée : " + url, "success"); }
  catch (e) { toast("Document OpenAPI : " + url, "info"); }
}

// ---------------------------------------------------------------------------
// Les deux mémentos : les rôles, et les codes d'erreur. Ils tiennent en un
// tableau chacun — c'est ce qu'on cherche en déboguant une intégration.
// ---------------------------------------------------------------------------
export function memoApi() {
  return h("div", { class: "fr-grid fr-grid--2" },
    h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: "Rôles des clés et des comptes" }),
      h("p", { class: "fr-card__sub", text: "Une route exige un rôle minimal ; les rôles sont hiérarchiques (administrateur > editeur > redacteur > lecteur), sauf « prestataire », hors hiérarchie." }),
      h("div", { class: "fr-table-wrap" }, h("table", { class: "fr-table" },
        h("thead", {}, h("tr", {}, h("th", { text: "Rôle" }), h("th", { text: "Ce qu'il ouvre" }))),
        h("tbody", {}, ...ROLES_API.map((r) => h("tr", {}, h("td", {}, h("code", { text: r.role })), h("td", { text: r.droits }))))))),
    h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: "Codes d'erreur" }),
      h("p", { class: "fr-card__sub", text: "Le corps d'une erreur porte toujours un `code` : c'est lui qu'on teste, jamais le message (qui, lui, est fait pour être lu)." }),
      h("div", { class: "fr-table-wrap" }, h("table", { class: "fr-table" },
        h("thead", {}, h("tr", {}, h("th", { text: "Code" }), h("th", { text: "Sens" }))),
        h("tbody", {}, ...CODES_ERREUR.map((c) => h("tr", {}, h("td", {}, h("code", { text: c.code })), h("td", { text: c.sens }))))))));
}
