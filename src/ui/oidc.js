// ============================================================================
// Interface de l'authentification par annuaire (OpenID Connect).
//
// Trois morceaux :
//   - `loginPanel()`        l'écran de connexion quand l'annuaire est branché :
//                           un bouton (ou l'annuaire d'essai), et la porte de
//                           secours vers les comptes de l'application ;
//   - `handleAuthReturn()`  le retour du fournisseur (paramètres `code` /
//                           `error` dans l'URL), appelé au démarrage ;
//   - `annuairePanel()`     le réglage complet, onglet « Annuaire » du
//                           référentiel (réservé à `referentiel.gerer`).
//
// Rien n'est caché à l'utilisateur : ce que le fournisseur a annoncé, ce que
// l'application en a fait (rôle, périmètre) et ce qui a été vérifié sont
// affichés, parce que c'est exactement ce qu'un administrateur doit contrôler
// avant de mettre l'installation en service.
// ============================================================================
import { h, clear, button, icon, modal, toast } from "./dom.js";
import { textField, selectField, choiceField, confirmDialog, helpLink } from "./components.js";
import { state, loginWithClaims, applyAuthMode } from "./state.js";
import { ROLES, ROLE_ORDER, accountUsable, isDemoUser, sourceOf, estVisiteur } from "../lib/users.js";
import { scopeLabel } from "../lib/scope.js";
import {
  AUTH_MODES, UNKNOWN_POLICIES, authConfig, emptyAuth, isOidc, isTestProvider,
  providerLabel, providerProblems, redirectUriFor, demoAccountsDisabled, modeDeploiement,
} from "../lib/auth.js";
import {
  AuthError, buildAuthorizationUrl, completeAuthorizationFromUrl, discover,
  TEST_IDENTITIES, testIdToken, readClaims, previewAccount,
} from "../lib/oidc.js";

// ------------------------------------------------------------------- état
// Dernier échec d'authentification : il survit au rechargement de l'écran de
// connexion (qui est redessiné à chaque changement) mais meurt avec l'onglet.
let lastError = "";
export const authError = () => lastError;
export const setAuthError = (m) => { lastError = m || ""; };

// ------------------------------------------------- écran de connexion
// L'écran de connexion ne propose QUE l'annuaire quand il est branché : les
// comptes de démonstration sont désactivés, et ne sont pas même affichés. La
// porte de secours (voir `allowRecovery`) permet de revenir aux comptes de
// l'application si le fournisseur est injoignable — c'est un choix explicite de
// l'administrateur, réglable dans le référentiel.
export function loginPanel() {
  const auth = authConfig(state.config);
  const test = isTestProvider(auth);
  const problems = providerProblems(auth);
  const slot = h("div", { class: "oidc-login__messages" });
  const paintMessages = () => {
    clear(slot);
    if (lastError) slot.appendChild(h("div", { class: "fr-alert fr-alert--error" },
      h("p", { class: "fr-alert__title", text: "Connexion impossible" }),
      h("p", { text: lastError })));
    for (const p of problems) slot.appendChild(h("p", { class: "fr-small fr-muted", text: p }));
  };

  const cta = h("button", { type: "button", class: "fr-btn fr-btn--primary oidc-login__cta" },
    icon("lock", 16),
    h("span", { text: "Se connecter avec " + providerLabel(auth) }),
  );
  cta.addEventListener("click", async () => {
    setAuthError("");
    cta.disabled = true;
    const r = await startOidcLogin();
    if (r && r.redirected) return;      // la page part chez le fournisseur
    cta.disabled = false;
    paintMessages();
  });

  const box = h("div", { class: "oidc-login" },
    h("div", { class: "oidc-login__provider" },
      h("span", { class: "fr-badge fr-badge--" + (test ? "warning" : "success"), text: test ? "annuaire d'essai" : "annuaire de la collectivité" }),
      h("span", { class: "oidc-login__url fr-mono", text: test ? "aucun fournisseur branché" : String(auth.issuer) }),
    ),
    cta,
    test ? h("p", { class: "fr-small fr-muted", text: "L'annuaire d'essai est intégré à l'application : il exerce tout le mécanisme (jetons, groupes, rôles, périmètre) sans aucun appel réseau. Ses jetons ne sont pas vérifiés — ce n'est pas une authentification. Branchez votre fournisseur dans Administration › Annuaire." }) : null,
    slot,
    recoveryBox(auth),
  );
  paintMessages();
  return box;
}

// Porte de secours : ramener l'installation sur les comptes de l'application.
function recoveryBox(auth) {
  if (auth.allowRecovery === false) return null;
  return h("details", { class: "oidc-login__recovery" },
    h("summary", { text: "L'annuaire est injoignable ?" }),
    h("p", { class: "fr-small fr-muted", text: "Cette porte de secours ramène l'installation sur les comptes de l'application (ceux de la démonstration redeviennent disponibles). Elle évite de rester bloqué à l'écran de connexion quand le fournisseur d'identité ne répond plus. Un administrateur peut la retirer dans Administration › Annuaire, une fois l'annuaire éprouvé ; en production, le contrôle d'accès réel reste la protection du service de données." }),
    h("div", { class: "fr-row" },
      button("Revenir aux comptes de l'application", {
        variant: "secondary", size: "sm", icon: "refresh",
        onClick: async () => {
          const ok = await confirmDialog("Revenir aux comptes de l'application",
            "Le mode d'authentification repasse sur les comptes de l'application : les comptes de démonstration sont réactivés et la connexion se fait à nouveau en choisissant un compte, sans mot de passe.",
            { confirmLabel: "Revenir aux comptes de l'application" });
          if (!ok) return;
          state.config.auth = { ...emptyAuth(), ...(state.config.auth || {}), mode: "demo" };
          const r = await applyAuthMode();
          toast(r.restored + " compte(s) réactivé(s). Reconnexion par les comptes de l'application.", "warning");
        },
      }),
    ),
  );
}

// Démarre une connexion : redirection chez le fournisseur, ou fenêtre de choix
// d'identité pour l'annuaire d'essai.
export async function startOidcLogin() {
  const auth = authConfig(state.config);
  try {
    if (isTestProvider(auth)) {
      testProviderDialog(auth);
      return { test: true };
    }
    const redirectUri = redirectUriFor(auth);
    const { url } = await buildAuthorizationUrl(auth, { redirectUri });
    location.assign(url);
    return { redirected: true };
  } catch (e) {
    const msg = (e && e.message) || String(e);
    setAuthError(msg);
    return { error: msg };
  }
}

// Retour du fournisseur. Appelé au démarrage, avant l'affichage : l'URL porte
// `code` et `state` (ou `error`). On nettoie l'URL dans tous les cas, pour
// qu'un rechargement ne rejoue pas l'échange du code (un code est à usage
// unique : le rejouer échouerait).
export async function handleAuthReturn() {
  const params = new URLSearchParams(location.search || "");
  const code = params.get("code");
  const error = params.get("error");
  const stateParam = params.get("state");
  if (!(code && stateParam) && !error) return { handled: false };

  const cleanUrl = () => {
    try { if (location.search) history.replaceState(null, "", location.pathname + (location.hash || "")); } catch { /* ignore */ }
  };
  const auth = authConfig(state.config);
  cleanUrl();

  if (!isOidc(state.config)) {
    setAuthError("Une réponse d'annuaire est revenue alors que l'application est réglée sur les comptes de l'application (le mode d'authentification a changé depuis le début de la connexion).");
    return { handled: true, ok: false, error: lastError };
  }
  if (isTestProvider(auth)) {
    setAuthError("Une réponse d'annuaire est revenue alors que l'annuaire d'essai est branché : recommencez la connexion.");
    return { handled: true, ok: false, error: lastError };
  }
  try {
    const res = await completeAuthorizationFromUrl(auth, { search: location.search, redirectUri: redirectUriFor(auth) });
    if (!res) return { handled: false };
    const session = await loginWithClaims(res.claims);
    if (!session.ok) {
      setAuthError(session.reason);
      return { handled: true, ok: false, error: session.reason };
    }
    setAuthError("");
    try {
      // Un visiteur n'a pas à recevoir le contrôle de connexion par-dessus son
      // écran : il n'a pas ouvert de session dans l'atelier, et sa page dit
      // déjà, groupes compris, pourquoi l'accès lui est fermé. Le contrôle
      // reste pour tous ceux qui entrent réellement dans l'application.
      if (!estVisiteur(session.user)) showAuthControl(res, session);
    } catch (e) {
      // L'affichage du contrôle ne doit jamais faire échouer une connexion
      // pourtant vérifiée : on se contente de le signaler dans la console.
      console.warn("Contrôle de connexion non affiché :", e);
    }
    return { handled: true, ok: true, created: session.created, warnings: res.warnings };
  } catch (e) {
    const msg = e instanceof AuthError ? e.message : ((e && e.message) || String(e));
    setAuthError(msg);
    return { handled: true, ok: false, error: msg };
  }
}

// Ce qui a été vérifié sur le jeton, et ce que l'application en a fait.
export function showAuthControl(res, session) {
  const u = session.user;
  const checks = h("table", { class: "fr-table oidc-checks" },
    h("thead", {}, h("tr", {}, h("th", { text: "Contrôle" }), h("th", { text: "Résultat" }))),
  );
  const tb = h("tbody");
  for (const c of res.checks || []) {
    tb.appendChild(h("tr", {},
      h("td", { text: c.label }),
      h("td", {}, h("span", { class: "fr-badge fr-badge--" + (c.ok ? "success" : c.optional ? "warning" : "error"), text: c.ok ? "conforme" : (c.optional ? "non vérifié" : "refusé") }),
        h("span", { class: "fr-small fr-muted", style: { marginLeft: "6px" }, text: c.detail || "" }))));
  }
  checks.appendChild(tb);
  modal({
    title: "Connexion à l'annuaire vérifiée",
    wide: true,
    body: h("div", {},
      h("p", { text: "Le fournisseur a authentifié " + (u.firstName || "") + " " + (u.lastName || "") + " (" + (u.email || session.linked) + ")." }),
      h("p", { class: "fr-small fr-muted", text: "Rôle attribué par l'annuaire : " + (ROLES[u.role]?.label || u.role) + " · Groupe reconnu : " + (u.oidcClaim || "—") + " · Périmètre : " + scopeLabel(state.config, u) }),
      checks,
      estVisiteur(u) ? h("div", { class: "fr-alert fr-alert--warning" },
        h("p", { class: "fr-alert__title", text: "Aucun accès à l'application" }),
        h("p", { text: "L'identité est vérifiée, mais aucun de vos groupes ne correspond à un rôle de l'application : votre compte est Visiteur. Vous arrivez sur la page d'accueil publique, qui explique la situation et donne le contact du service qui gère l'application." }),
      ) : null,
      (res.warnings || []).length ? h("div", { class: "fr-alert fr-alert--warning" }, ...res.warnings.map((w) => h("p", { text: w }))) : null,
      h("p", { class: "fr-small fr-muted", text: session.created ? "Un compte a été créé pour cet agent dans l'application." : "Le compte existant a été repris (" + session.linked + ")." }),
    ),
    actions: (close) => [button("Fermer", { variant: "primary", onClick: close })],
  });
}

// ----------------------------------------------------- annuaire d'essai
function testProviderDialog(auth) {
  const list = h("div", { class: "oidc-test" });
  const m = modal({
    title: "Annuaire d'essai — choisir une identité",
    wide: true,
    body: h("div", {},
      h("p", { text: "Cet annuaire est intégré à l'application : il produit exactement les mêmes revendications qu'un fournisseur (subject, adresse, groupes, services, entité) et passe par le même code d'attribution des rôles. Ses jetons ne sont pas signés : c'est un exercice de branchement, pas une authentification." }),
      h("p", { class: "fr-small fr-muted", text: "Rôle et périmètre affichés ci-dessous sont calculés avec le réglage ACTUEL du référentiel (Revendication des rôles : « " + auth.roleClaim + " »)." }),
      list,
    ),
    actions: (close) => [button("Annuler", { variant: "secondary", onClick: close })],
  });
  for (const it of TEST_IDENTITIES) {
    const pv = previewAccount(state.config, it);
    const role = pv.role.denied ? null : ROLES[pv.role.role];
    const row = h("button", { type: "button", class: "oidc-test__row" + (pv.role.denied ? " is-denied" : "") },
      h("span", { class: "oidc-test__name" },
        h("span", { text: it.name }),
        h("span", { class: "fr-small fr-muted", text: it.role + " · " + it.email }),
      ),
      h("span", { class: "oidc-test__claims fr-mono", text: (it.groups || []).join(", ") || "aucun groupe" }),
      pv.role.denied
        ? h("span", { class: "fr-badge fr-badge--error", text: "connexion refusée" })
        : h("span", { class: "oidc-test__role" },
          h("span", { class: "fr-badge fr-badge--" + role.badge, text: role.label }),
          h("span", { class: "fr-small fr-muted", text: pv.role.visiteur ? "aucun accès" : ((it.services || []).join(", ") || "aucun service") })),
    );
    row.addEventListener("click", async () => {
      m.close();
      await finishTestLogin(auth, it);
    });
    list.appendChild(row);
  }
}

async function finishTestLogin(auth, identity) {
  const claims = readClaims(testIdToken(authConfig(state.config), identity));
  const res = await loginWithClaims(claims);
  if (!res.ok) {
    setAuthError(res.reason);
    toast(res.reason, "error");
    return;
  }
  setAuthError("");
  toast("Session ouverte : " + (ROLES[res.role]?.label || res.role) + (res.created ? " (compte créé)" : " (compte repris)"), "success");
}

// =========================================================== référentiel
// Onglet « Annuaire » : mode de connexion, fournisseur, correspondance des
// rôles, porte de secours. `card` est le gabarit d'encart du référentiel.
export function annuairePanel(save, redraw, card) {
  const c = state.config;
  c.auth = { ...emptyAuth(), ...(c.auth || {}) };
  const a = c.auth;
  a.endpoints = { ...emptyAuth().endpoints, ...(a.endpoints || {}) };
  const wrap = h("div");
  const epSlot = h("div", { class: "oidc-endpoints" });
  const commit = () => { save(); };
  const change = async (fn, opts = {}) => { fn(); commit(); if (opts.auth) { await applyAuthMode(); } if (opts.rerender) redraw(); };

  // Le mode « comptes locaux » (mot de passe) ne se règle PAS ici : il dépend du
  // service qui héberge l'application, et c'est son fichier `.env` qui fait foi
  // (`AUTH_MODE=password`, voir src/server/README.md). On ne l'offre donc pas au
  // choix du référentiel — sinon un administrateur pourrait exiger un mot de
  // passe qu'aucun service ne vérifie, et se retrouver enfermé dehors.
  const impose = modeDeploiement();
  const modesReferentiel = AUTH_MODES.filter((m) => m.id !== "password");
  const demoOuverts = !demoAccountsDisabled(state.config);

  wrap.appendChild(card("Mode de connexion",
    "L'application sait ouvrir une session de deux façons, que vous choisissez ici : par ses propres comptes (démonstration, sans mot de passe), ou par l'annuaire de la collectivité (OpenID Connect). Brancher l'annuaire désactive automatiquement les comptes de démonstration : ils ne sont plus proposés à la connexion et ne peuvent plus ouvrir de session. Un troisième mode — des comptes locaux protégés par un mot de passe — ne se règle pas ici : il dépend du service qui héberge l'application, et s'active dans le fichier `.env` du déploiement (`AUTH_MODE=password`).",
    impose === "password"
      ? h("div", { class: "fr-alert fr-alert--info" },
        h("p", { class: "fr-alert__title", text: "Mode « comptes locaux » imposé par le déploiement" }),
        h("p", { text: "Le service qui héberge l'application exige un identifiant et un mot de passe (AUTH_MODE=password). Ce réglage du déploiement prime sur le référentiel : le choix ci-dessous est sans effet tant qu'il est en place." }))
      : choiceField({
        label: "Qui délivre les identités ?",
        value: a.mode,
        options: modesReferentiel.map((m) => ({ value: m.id, label: m.label })),
        help: modesReferentiel.find((m) => m.id === a.mode)?.summary,
        onChange: (v) => change(() => {
          a.mode = v;
          // Aucun fournisseur encore renseigné : l'annuaire d'essai prend le
          // relais, pour ne jamais bloquer l'installation sur un écran de
          // connexion inutilisable.
          if (v === "oidc" && !String(a.issuer || "").trim()) a.test = true;
        }, { auth: true, rerender: true }),
      }),
    statusLine(),
    h("div", { style: { marginTop: "10px" } }, helpLink("annuaire", "Comment brancher l'annuaire")),
  ));

  if (a.mode !== "oidc" || impose === "password") {
    wrap.appendChild(card("Comptes de démonstration",
      demoOuverts
        ? "Les comptes de démonstration sont actifs : l'écran de connexion les présente par profil (administrateur, éditeur, rédacteur) et un clic ouvre la session, sans mot de passe. C'est le réglage d'origine, pour essayer l'application."
        : "Les comptes de démonstration sont fermés : seul un compte local (identifiant et mot de passe) ouvre une session.",
      h("p", { class: "fr-small fr-muted", text: impose === "password"
        ? (demoOuverts
          ? "Sur ce service, le raccourci « choisir un compte » reste ouvert (DEMO_ACCOUNTS=true) : pratique pour essayer, à fermer en service dans le fichier `.env`."
          : "C'est le service qui en décide (DEMO_ACCOUNTS=false dans le fichier `.env`) : le référentiel n'a pas voix au chapitre dans ce mode.")
        : "Pour passer en production, choisissez « Annuaire de la collectivité (OIDC) » ci-dessus : les comptes de démonstration seront désactivés automatiquement, et pourront être réactivés si l'on revient à ce mode." }),
    ));
    return wrap;
  }

  // -------------------------------------------------------- fournisseur
  // Le choix affiché suit le réglage ENREGISTRÉ (`test`), pas le repli
  // automatique : un administrateur qui choisit « fournisseur de la
  // collectivité » doit voir les champs à remplir, même si aucune adresse n'est
  // encore saisie (l'annuaire d'essai assure alors la connexion, voir plus bas).
  const test = !!a.test;
  const fallbackTest = !test && isTestProvider(a);
  wrap.appendChild(card("Fournisseur d'identité",
    "L'application est un client public : elle ne détient aucun secret. La connexion utilise le flux « code d'autorisation » avec PKCE (S256), et le jeton d'identité est vérifié (émetteur, audience, validité, nonce, signature) avant qu'une session ne soit ouverte.",
    choiceField({
      label: "Annuaire utilisé",
      value: test ? "test" : "reel",
      options: [{ value: "reel", label: "Fournisseur OIDC de la collectivité" }, { value: "test", label: "Annuaire d'essai intégré" }],
      help: test ? "Aucun appel réseau : pratique pour vérifier le mécanisme, et filet de sécurité tant qu'aucun fournisseur n'est renseigné." : "La connexion se fait chez le fournisseur.",
      onChange: (v) => change(() => { a.test = v === "test"; }, { auth: true, rerender: true }),
    }),
    fallbackTest ? h("div", { class: "fr-alert fr-alert--warning" },
      h("p", { class: "fr-alert__title", text: "Aucun fournisseur renseigné" }),
      h("p", { text: "En attendant l'adresse de l'émetteur et l'identifiant du client, l'annuaire d'essai intégré assure la connexion : les comptes de démonstration restent désactivés, et l'écran de connexion le signale." }),
    ) : null,
    test
      ? h("div", {},
        h("p", { class: "fr-small fr-muted", text: "L'annuaire d'essai propose des identités fictives, avec des groupes et des services. Il passe par le même code d'attribution des rôles : c'est le moyen le plus rapide de régler « Rôles et périmètre » ci-dessous." }),
        h("div", { class: "fr-row" }, button("Tester une connexion", { variant: "secondary", icon: "lock", onClick: () => testProviderDialog(authConfig(c)) })),
      )
      : h("div", {},
        h("div", { class: "fr-grid fr-grid--2" },
          textField({ label: "Adresse du fournisseur (émetteur)", value: a.issuer, placeholder: "https://annuaire.valmont-sur-loire.fr/realms/agents", help: "L'adresse publiée dans les jetons (revendication « iss »), sans le /.well-known/openid-configuration.", onChange: (v) => { a.issuer = v.trim(); commit(); } }),
          textField({ label: "Identifiant du client (client_id)", value: a.clientId, placeholder: "scribae-application", help: "L'application déclarée chez le fournisseur, en client public (sans secret), avec PKCE.", onChange: (v) => { a.clientId = v.trim(); commit(); } }),
        ),
        h("div", { class: "fr-grid fr-grid--2" },
          textField({ label: "Portées demandées (scope)", value: a.scopes, help: "« openid » est indispensable ; « profile » et « email » fournissent le nom et l'adresse.", onChange: (v) => { a.scopes = v.trim(); commit(); } }),
          textField({ label: "Invite (prompt)", value: a.prompt, placeholder: "—", help: "Vide en général. « select_account » force le choix du compte à chaque connexion.", onChange: (v) => { a.prompt = v.trim(); commit(); } }),
        ),
        h("div", { class: "fr-grid fr-grid--2" },
          textField({
            label: "Adresse de retour (redirect_uri)", value: a.redirectUri, placeholder: redirectUriFor(a),
            help: "Doit être déclarée À L'IDENTIQUE chez le fournisseur. Vide = l'adresse de la page courante.",
            onChange: (v) => { a.redirectUri = v.trim(); commit(); },
          }),
          h("div", { class: "fr-row", style: { alignItems: "flex-end", paddingBottom: "6px" } },
            button("Copier l'adresse à déclarer", {
              variant: "tertiary", size: "sm", icon: "copy",
              onClick: async () => {
                try { await navigator.clipboard.writeText(redirectUriFor(a)); toast("Adresse copiée", "success"); }
                catch { toast(redirectUriFor(a), "info"); }
              },
            }),
          ),
        ),
        h("div", { class: "fr-row", style: { marginTop: "6px" } },
          button("Vérifier la découverte du fournisseur", { variant: "secondary", icon: "refresh", onClick: () => runDiscovery(epSlot, c) }),
        ),
        epSlot,
        h("details", { class: "fr-details" },
          h("summary", { text: "Points de terminaison (si la découverte est bloquée)" }),
          h("p", { class: "fr-small fr-muted", text: "À renseigner seulement si le fournisseur n'expose pas /.well-known/openid-configuration à l'application : recopiez-les depuis sa documentation." }),
          textField({ label: "Authorisation", value: a.endpoints.authorization, onChange: (v) => { a.endpoints.authorization = v.trim(); commit(); } }),
          textField({ label: "Jeton (token)", value: a.endpoints.token, onChange: (v) => { a.endpoints.token = v.trim(); commit(); } }),
          textField({ label: "Clés de signature (jwks)", value: a.endpoints.jwks, onChange: (v) => { a.endpoints.jwks = v.trim(); commit(); } }),
          textField({ label: "Informations utilisateur (userinfo)", value: a.endpoints.userinfo, onChange: (v) => { a.endpoints.userinfo = v.trim(); commit(); } }),
        ),
        h("div", { class: "fr-grid fr-grid--2" },
          choiceField({
            label: "Compléter par /userinfo", value: a.useUserinfo !== false,
            options: [{ value: true, label: "Oui" }, { value: false, label: "Non" }],
            help: "Utile quand les groupes ne figurent pas dans le jeton d'identité.",
            onChange: (v) => { a.useUserinfo = v; commit(); },
          }),
          choiceField({
            label: "Exiger la vérification de la signature", value: a.requireSignature !== false,
            options: [{ value: true, label: "Oui" }, { value: false, label: "Non" }],
            help: "Refuse un jeton dont la signature n'a pas pu être contrôlée avec les clés publiées (jwks_uri). À ne désactiver qu'en connaissance de cause.",
            onChange: (v) => { a.requireSignature = v; commit(); },
          }),
        ),
      ),
  ));

  // ------------------------------------------------- rôles et périmètre
  wrap.appendChild(card("Rôles et périmètre",
    "Le rôle de l'agent vient des groupes annoncés par l'annuaire : le premier groupe reconnu décide. Le périmètre (services et bureaux) se déduit des revendications de service, en rapprochant les codes de ceux du référentiel.",
    h("div", { class: "fr-grid fr-grid--2" },
      textField({ label: "Revendication des groupes", value: a.roleClaim, placeholder: "groups", help: "Chemin dans le jeton : « groups », « roles », « realm_access.roles »…", onChange: (v) => { a.roleClaim = v.trim(); commit(); redraw(); } }),
      selectField({
        label: "Agent sans groupe reconnu", value: a.unknownPolicy, options: UNKNOWN_POLICIES.map((p) => ({ value: p.id, label: p.label })),
        help: "« Aucun accès » est le réglage sûr : l'agent est authentifié par l'annuaire, mais l'application ne lui ouvre rien — il arrive sur un écran qui le lui explique et le renvoie vers l'espace public.",
        onChange: (v) => { a.unknownPolicy = v; commit(); redraw(); },
      }),
    ),
    a.unknownPolicy === "default" ? selectField({
      label: "Rôle de repli", value: a.defaultRole,
      options: ROLE_ORDER.map((r) => ({ value: r, label: ROLES[r].label })),
      help: "Le rôle le plus étroit est recommandé : « Rédacteur » pour un agent qui n'a rien demandé, « Visiteur » pour ne lui ouvrir aucun accès.",
      onChange: (v) => { a.defaultRole = v; commit(); },
    }) : null,
    h("h3", { class: "oidc-sub", text: "Correspondance des groupes" }),
    roleMapEditor(a, commit, redraw),
    h("div", { class: "fr-grid fr-grid--2" },
      textField({ label: "Revendication des services", value: a.serviceClaim, placeholder: "services", help: "Contient un ou plusieurs codes de service du référentiel (ex. DSI, SG, CCAS).", onChange: (v) => { a.serviceClaim = v.trim(); commit(); } }),
      textField({ label: "Revendication de l'entité", value: a.entityClaim, placeholder: "entity", help: "Code de l'entité de rattachement (ex. VSL, CCAS).", onChange: (v) => { a.entityClaim = v.trim(); commit(); } }),
    ),
    h("div", { class: "fr-grid fr-grid--2" },
      choiceField({
        label: "Les groupes de l'annuaire font foi", value: a.authoritative !== false,
        options: [{ value: true, label: "Oui" }, { value: false, label: "Non" }],
        help: "Oui : le rôle et le périmètre sont repris à chaque connexion. Non : l'annuaire authentifie seulement, et les rôles réglés dans « Comptes et rôles » sont conservés.",
        onChange: (v) => { a.authoritative = v; commit(); },
      }),
      choiceField({
        label: "Créer les comptes inconnus", value: a.autoProvision !== false,
        options: [{ value: true, label: "Oui" }, { value: false, label: "Non" }],
        help: "Oui : un agent de l'annuaire qui n'a pas encore de compte en reçoit un à sa première connexion. Non : il faut pré-enregistrer son adresse dans « Comptes et rôles ».",
        onChange: (v) => { a.autoProvision = v; commit(); },
      }),
    ),
    h("p", { class: "fr-small fr-muted", text: "Un compte reconnu (par son identifiant d'annuaire, ou par son adresse) conserve son historique : ses actes, ses trames et ses commentaires restent les siens. Seuls l'identité, le rôle et le périmètre sont repris de l'annuaire." }),
  ));

  // -------------------------------------------------------- porte de secours
  wrap.appendChild(card("Porte de secours",
    "Si le fournisseur ne répond plus, personne ne peut plus entrer dans l'application — y compris pour réparer la configuration. Cette porte permet, depuis l'écran de connexion, de revenir aux comptes de l'application.",
    choiceField({
      label: "Autoriser le retour aux comptes de l'application depuis l'écran de connexion",
      value: a.allowRecovery !== false,
      options: [{ value: true, label: "Autoriser" }, { value: false, label: "Retirer" }],
      help: "À retirer une fois l'annuaire éprouvé. Rappel : l'application est un client, son code est public ; le contrôle d'accès réel est celui du service de données (jeton, réseau, SSO devant l'application).",
      onChange: (v) => { a.allowRecovery = v; commit(); redraw(); },
    }),
  ));

  return wrap;
}

function statusLine() {
  const c = state.config;
  const off = demoAccountsDisabled(c);
  const demo = state.users.filter(isDemoUser);
  const actifs = demo.filter((u) => u.active !== false).length;
  const oidc = state.users.filter((u) => sourceOf(u) === "oidc").length;
  return h("div", { class: "fr-row", style: { flexWrap: "wrap", gap: "8px", marginTop: "10px" } },
    off
      ? h("span", { class: "fr-badge fr-badge--warning", text: demo.length - actifs + " compte(s) de démonstration désactivé(s)" })
      : h("span", { class: "fr-badge fr-badge--info", text: actifs + " compte(s) de démonstration actif(s)" }),
    oidc ? h("span", { class: "fr-badge fr-badge--success", text: oidc + " compte(s) rattaché(s) à l'annuaire" }) : null,
    state.user && !accountUsable(c, state.user)
      ? h("span", { class: "fr-badge fr-badge--error", text: "le compte connecté n'est plus utilisable" })
      : null,
  );
}

async function runDiscovery(slot, config) {
  clear(slot);
  slot.appendChild(h("p", { class: "fr-small fr-muted", text: "Interrogation du fournisseur…" }));
  try {
    const ep = await discover(authConfig(config));
    clear(slot);
    const rows = [
      ["Émetteur (iss)", ep.issuer],
      ["Autorisation", ep.authorization_endpoint],
      ["Jeton", ep.token_endpoint],
      ["Clés de signature", ep.jwks_uri || "— non publié : la signature ne pourra pas être vérifiée —"],
      ["Informations utilisateur", ep.userinfo_endpoint || "— non publié —"],
    ];
    slot.appendChild(h("div", { class: "fr-alert fr-alert--success" },
      h("p", { class: "fr-alert__title", text: "Configuration lue (" + ep.source + ")" }),
      ...rows.map(([k, v]) => h("p", { class: "fr-small" }, h("strong", { text: k + " : " }), h("span", { class: "fr-mono", text: String(v || "—") }))),
    ));
  } catch (e) {
    clear(slot);
    slot.appendChild(h("div", { class: "fr-alert fr-alert--error" },
      h("p", { class: "fr-alert__title", text: "Découverte impossible" }),
      h("p", { text: (e && e.message) || String(e) }),
      h("p", { class: "fr-small fr-muted", text: "Un fournisseur qui refuse les appels depuis le navigateur (absence d'en-têtes CORS) empêche aussi la connexion : autorisez l'adresse de l'application dans sa configuration. À défaut, saisissez les points de terminaison à la main." }),
    ));
  }
}

function roleMapEditor(a, commit, redraw) {
  const box = h("div", { class: "oidc-rolemap" });
  const paint = () => {
    clear(box);
    (a.roleMap || []).forEach((row, i) => {
      box.appendChild(h("div", { class: "fr-row oidc-rolemap__row" },
        textField({
          label: i === 0 ? "Groupe annoncé par l'annuaire" : "", value: row.claim, placeholder: "scribae-administrateurs",
          onChange: (v) => { row.claim = v.trim(); commit(); },
        }),
        selectField({
          label: i === 0 ? "Rôle dans l'application" : "", value: row.role,
          options: ROLE_ORDER.map((r) => ({ value: r, label: ROLES[r].label })),
          onChange: (v) => { row.role = v; commit(); redraw(); },
        }),
        h("button", {
          class: "fr-btn fr-btn--tertiary fr-btn--icon", type: "button", title: "Supprimer cette correspondance",
          on: { click: () => { a.roleMap.splice(i, 1); commit(); redraw(); } },
        }, icon("trash", 15)),
      ));
    });
    box.appendChild(button("Ajouter une correspondance", {
      variant: "tertiary", size: "sm", icon: "plus",
      onClick: () => { a.roleMap.push({ claim: "", role: "redacteur" }); commit(); redraw(); },
    }));
  };
  paint();
  return box;
}
