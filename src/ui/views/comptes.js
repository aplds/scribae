// ============================================================================
// Comptes et rôles (réservé au profil « Administrateur »).
//
// C'est ici que l'administrateur crée un compte, change un rôle, désactive ou
// supprime. Deux garde-fous : on ne supprime pas son propre compte, et il doit
// toujours rester un administrateur actif.
//
// La table des permissions n'est pas écrite ici : elle vient de src/lib/users.js
// (PERMS), donc ce qui est affiché est exactement ce qui est appliqué.
// ============================================================================
import { state, setUsers, resetDemoUsers, currentUser, login, navigate } from "../state.js";
import { h, button, toast, icon, modal, clear } from "../dom.js";
import { confirmDialog, textField, selectField, emptyState, sectionHeader } from "../components.js";
import { ROLES, ROLE_ORDER, PERMS, newUser, slugLogin, uniqueLogin, fullName, initialsOf, sortName, activeAdmins, roleOf, ACCOUNT_SOURCES, sourceOf, isDemoUser } from "../../lib/users.js";
import { scopeLabel, coversAllServices, primaryServiceName, membershipFor, bureauxOf, servicesOf, allServicesMemberships } from "../../lib/scope.js";
import { isOidc, demoAccountsDisabled, authConfig, issuerLabel, isTestProvider } from "../../lib/auth.js";

export function renderComptes(root) {
  const me = currentUser();
  const oidc = isOidc(state.config);
  const users = state.users.slice().sort((a, b) => {
    const r = (ROLES[b.role]?.rank || 0) - (ROLES[a.role]?.rank || 0);
    return r !== 0 ? r : sortName(a).localeCompare(sortName(b));
  });

  const goAnnuaire = () => { state.ui = state.ui || {}; state.ui.refTab = "annuaire"; navigate("referentiel"); };

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Comptes et rôles" }),
      h("p", { class: "page-head__sub", text: "Les comptes de l'application, leur profil d'accès et leur périmètre : un compte ne voit que les trames et les actes des services et bureaux auxquels il est rattaché." }),
    ),
    h("div", { class: "page-head__actions" },
      oidc
        ? button("Réglage de l'annuaire", { variant: "secondary", size: "sm", icon: "lock", onClick: goAnnuaire })
        : button("Réinstaller les comptes de démonstration", { variant: "tertiary", size: "sm", icon: "refresh", onClick: reinstall }),
      button(oidc ? "Pré-enregistrer un agent" : "Nouveau compte", { variant: "primary", icon: "plus", onClick: () => editUser(null) }),
    ),
  ));

  if (oidc) {
    const auth = authConfig(state.config);
    const off = demoAccountsDisabled(state.config);
    const nb = state.users.filter((u) => isDemoUser(u) && u.active === false && u.deactivatedBy === "oidc").length;
    root.appendChild(h("div", { class: "fr-alert fr-alert--info" },
      h("p", { class: "fr-alert__title", text: "Connexion par l'annuaire" + (isTestProvider(auth) ? " d'essai" : " " + issuerLabel(auth)) }),
      h("p", { text: (isTestProvider(auth)
        ? "Aucun fournisseur n'est encore branché : l'annuaire d'essai intégré tient lieu de porte d'entrée. "
        : "Les sessions s'ouvrent chez le fournisseur d'identité, et le rôle de chaque agent vient de ses groupes. ") +
        (off ? nb + " compte(s) de démonstration ont été désactivés automatiquement : ils ne peuvent plus ouvrir de session." : "") }),
      h("div", { class: "fr-row" }, button("Annuaire (OIDC)", { variant: "secondary", size: "sm", icon: "gear", onClick: goAnnuaire })),
    ));
  }

  if (!users.length) {
    root.appendChild(emptyState("Aucun compte.", button("Recréer les comptes de démonstration", { variant: "primary", onClick: reinstall })));
    return;
  }

  const table = h("table", { class: "fr-table" },
    h("thead", {}, h("tr", {},
      h("th", { text: "Nom" }), h("th", { text: "Identifiant" }), h("th", { text: "Rôle" }),
      h("th", { text: "Périmètre (services et bureaux)" }),
      h("th", { text: "Structure" }), h("th", { text: "État" }), h("th", { text: "Dernier accès" }), h("th", {}),
    )),
  );
  const tb = h("tbody");
  for (const u of users) {
    const entity = (state.config.entities || []).find((e) => e.id === u.entityId);
    const role = roleOf(u);
    const svcName = primaryServiceName(state.config, u);
    const src = ACCOUNT_SOURCES[sourceOf(u)] || ACCOUNT_SOURCES.local;
    const demoOff = demoAccountsDisabled(state.config) && isDemoUser(u);
    tb.appendChild(h("tr", { class: u.id === me?.id ? "is-me" : "" },
      h("td", {},
        h("div", { class: "compte__who" },
          h("span", { class: "compte__initials", text: initialsOf(u) }),
          h("span", {},
            h("span", { class: "compte__name", text: fullName(u) }),
            svcName ? h("span", { class: "compte__service", text: svcName }) : null,
          ),
          u.id === me?.id ? h("span", { class: "fr-badge fr-badge--success", text: "vous" }) : null,
        )),
      h("td", { class: "fr-mono fr-small", text: u.login }),
      h("td", {}, h("span", { class: "fr-badge fr-badge--" + role.badge, text: role.label })),
      h("td", { class: "fr-small" },
        h("span", { text: scopeLabel(state.config, u) }),
        coversAllServices(state.config, u) && u.role !== "administrateur"
          ? h("span", { class: "fr-badge fr-badge--info", style: { marginLeft: "6px" }, text: "transverse" })
          : null),
      h("td", { class: "fr-small", text: entity ? entity.name : "—" }),
      h("td", {},
        h("span", { class: "fr-badge fr-badge--" + (u.active === false ? "warning" : "success"), text: u.active === false ? (u.deactivatedBy === "oidc" ? "Désactivé (annuaire)" : "Désactivé") : "Actif" }),
        h("span", { class: "fr-badge fr-badge--" + src.badge, style: { marginLeft: "6px" }, title: src.help, text: src.label })),
      h("td", { class: "fr-small fr-muted", text: lastSeen(u.lastLogin) }),
      h("td", {}, h("div", { class: "fr-row" },
        // En mode annuaire, la session ne s'ouvre que par le fournisseur
        // d'identité : on ne propose donc pas d'ouvrir une session en choisissant
        // un compte.
        !oidc && u.active !== false && !demoOff
          ? button("Ouvrir une session", { variant: "tertiary", size: "sm", icon: "lock", title: "Se connecter avec ce compte (démonstration)", onClick: () => switchTo(u) })
          : null,
        button("Modifier", { variant: "tertiary", size: "sm", icon: "gear", onClick: () => editUser(u) }),
        demoOff
          ? null
          : u.active === false
            ? button("Réactiver", { variant: "tertiary", size: "sm", icon: "check", onClick: () => setActive(u, true) })
            : button("Désactiver", { variant: "tertiary", size: "sm", icon: "x", onClick: () => setActive(u, false) }),
        button("", { variant: "tertiary", size: "sm", icon: "trash", title: "Supprimer", onClick: () => removeUser(u) }),
      )),
    ));
  }
  table.appendChild(tb);
  root.appendChild(h("div", { class: "fr-table-wrap" }, table));
  root.appendChild(h("p", { class: "fr-small fr-muted", text: `${users.length} compte(s) · ${state.users.filter((u) => u.active !== false).length} actif(s) · stockage local (IndexedDB). Les comptes de démonstration sont fictifs.` }));

  root.appendChild(h("div", { class: "fr-card", style: { marginTop: "16px" } },
    sectionHeader("Ce que permet chaque profil"),
    h("div", { class: "fr-table-wrap" }, matrix()),
    h("p", { class: "fr-small fr-muted", style: { marginTop: "10px" }, text: "Le rôle détermine ce qu'un compte a le droit de faire ; le périmètre détermine ce qu'il voit. Un éditeur ou un rédacteur n'accède qu'aux trames et aux actes de son service (ou de son bureau). En rattachant un compte à tous les services, l'administrateur en fait un compte « transverse » — c'est ainsi qu'un directeur des affaires juridiques voit l'ensemble des services sans changer de rôle." }),
    h("p", { class: "fr-small fr-muted", style: { marginTop: "10px" }, text: "Un rôle « à venir » (feuilles de style des actes) est annoncé dans la colonne Éditeur : la case est prête, la fonctionnalité viendra s'y brancher." }),
  ));
}

function matrix() {
  const table = h("table", { class: "fr-table perm-matrix" },
    h("thead", {}, h("tr", {},
      h("th", { text: "Permission" }),
      ...ROLE_ORDER.map((r) => h("th", { class: "perm-matrix__role", text: ROLES[r].label })),
    )),
  );
  const tb = h("tbody");
  for (const p of PERMS) {
    tb.appendChild(h("tr", {},
      h("td", { text: p.label }),
      ...ROLE_ORDER.map((r) => h("td", { class: "perm-matrix__cell" + (p.roles.includes(r) ? " is-on" : "") },
        p.roles.includes(r) ? h("span", { class: "perm-yes", text: "oui" }) : h("span", { class: "perm-no", text: "—" }))),
    ));
  }
  table.appendChild(tb);
  return table;
}

function lastSeen(iso) {
  if (!iso) return "jamais connecté";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ------------------------------------------------------------------- actions
function guardDelete(u) {
  if (u.id === currentUser()?.id) return "Vous ne pouvez pas supprimer votre propre compte : demandez à un autre administrateur.";
  if (u.role === "administrateur" && activeAdmins(state.users).length <= 1) return "Il doit rester au moins un administrateur actif.";
  return "";
}

async function removeUser(u) {
  const blocked = guardDelete(u);
  if (blocked) { toast(blocked, "warning"); return; }
  const ok = await confirmDialog("Supprimer le compte", `Le compte de ${fullName(u)} (${u.login}) sera supprimé. Les actes qu'il a rédigés restent dans le registre.`, { confirmLabel: "Supprimer", danger: true });
  if (!ok) return;
  await setUsers(state.users.filter((x) => x.id !== u.id));
  toast("Compte supprimé");
}

async function setActive(u, active) {
  if (!active) {
    if (u.id === currentUser()?.id) { toast("Vous ne pouvez pas désactiver votre propre compte.", "warning"); return; }
    if (u.role === "administrateur" && activeAdmins(state.users).length <= 1) { toast("Il doit rester au moins un administrateur actif.", "warning"); return; }
  }
  u.active = active;
  await setUsers([...state.users]);
  toast(active ? "Compte réactivé" : "Compte désactivé");
}

async function switchTo(u) {
  await login(u.id);
}

async function reinstall() {
  const ok = await confirmDialog("Réinstaller les comptes de démonstration",
    "Tous les comptes actuels seront remplacés par les neuf comptes de démonstration. Les comptes créés à la main seront perdus.",
    { confirmLabel: "Réinstaller", danger: true });
  if (!ok) return;
  await resetDemoUsers();
  toast("Comptes de démonstration réinstallés", "success");
}

// --------------------------------------------------------------- périmètre
// Éditeur du périmètre d'un compte : une ligne par service, et sous chaque
// service les bureaux accessibles. Cocher un service sans toucher aux bureaux
// donne accès à tout le service (c'est le défaut) ; décocher un bureau restreint
// l'accès aux seuls bureaux cochés.
function scopeEditor(u) {
  const c = state.config;
  const services = servicesOf(c);
  if (!Array.isArray(u.memberships)) u.memberships = [];

  const wrap = h("div", { class: "fr-field compte-scope" },
    h("label", { class: "fr-label", text: "Périmètre d'accès (services et bureaux)" }),
    h("p", { class: "fr-hint", text: "Un compte ne voit que les trames et les actes de son périmètre. Cocher un service donne accès à tous ses bureaux ; décochez les bureaux à restreindre." }),
  );
  const summary = h("p", { class: "fr-small", style: { margin: "4px 0" } });
  const tools = h("div", { class: "fr-row", style: { gap: "6px", marginBottom: "6px" } });
  const list = h("div", { class: "compte-scope__list" });
  wrap.append(summary, tools, list);

  function setBureau(service, bureauId, on) {
    const bureaux = bureauxOf(service);
    const m = membershipFor(u, service.id);
    if (!m) return;
    let set = Array.isArray(m.bureaux) ? m.bureaux.slice() : bureaux.map((b) => b.id);
    if (on) { if (!set.includes(bureauId)) set.push(bureauId); }
    else set = set.filter((id) => id !== bureauId);
    m.bureaux = set.length === bureaux.length ? null : set;
    render();
  }

  function render() {
    clear(tools);
    clear(list);
    clear(summary);
    if (u.role === "administrateur") {
      summary.appendChild(h("span", { class: "fr-badge fr-badge--error", text: "Administrateur : voit tout, quel que soit le périmètre" }));
    }
    summary.appendChild(h("span", { text: "Périmètre actuel : " + scopeLabel(c, u) }));
    if (coversAllServices(c, u) && u.role !== "administrateur") {
      summary.appendChild(h("span", { class: "fr-badge fr-badge--info", style: { marginLeft: "6px" }, text: "tous les services" }));
    }

    tools.appendChild(button("Accès à tous les services", {
      variant: "tertiary", size: "sm", icon: "check",
      onClick: () => { u.memberships = allServicesMemberships(c); render(); },
    }));
    tools.appendChild(button("Retirer tous les accès", {
      variant: "tertiary", size: "sm", icon: "x",
      onClick: () => { u.memberships = []; render(); },
    }));

    if (!services.length) {
      list.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun service n'est défini. Ajoutez-en dans « Référentiel › Services » : sans service, tout le monde voit toutes les trames." }));
      return;
    }

    for (const s of services) {
      const member = !!membershipFor(u, s.id);
      const box = h("label", { class: "fr-check compte-scope__svc" });
      const cb = h("input", { type: "checkbox", checked: member });
      cb.addEventListener("change", () => {
        if (cb.checked) { u.memberships.push({ serviceId: s.id, bureaux: null }); }
        else { u.memberships = u.memberships.filter((m) => m && m.serviceId !== s.id); }
        render();
      });
      box.append(cb, h("span", { text: `${s.code || "?"} — ${s.name}` }));
      list.appendChild(box);

      if (!member) continue;
      const bureaux = bureauxOf(s);
      const m = membershipFor(u, s.id);
      const all = !Array.isArray(m.bureaux);
      if (!bureaux.length) {
        list.appendChild(h("p", { class: "fr-small fr-muted compte-scope__hint", text: "Ce service n'a pas de bureau : l'accès couvre tout le service." }));
        continue;
      }
      const sub = h("div", { class: "compte-scope__bureaux" });
      for (const b of bureaux) {
        const on = all || m.bureaux.includes(b.id);
        const lb = h("label", { class: "fr-check" });
        const cbb = h("input", { type: "checkbox", checked: on });
        cbb.addEventListener("change", () => setBureau(s, b.id, cbb.checked));
        lb.append(cbb, h("span", { text: b.name }));
        sub.appendChild(lb);
      }
      list.appendChild(sub);
      const n = Array.isArray(m.bureaux) ? m.bureaux.length : bureaux.length;
      list.appendChild(h("p", { class: "fr-small fr-muted compte-scope__hint", text: n === bureaux.length
        ? `Tous les bureaux de ${s.code || s.name}.`
        : n ? `Restreint à ${n} bureau(x) sur ${bureaux.length}.` : `Aucun bureau : ce compte ne verra que les actes valables pour tout le service.` }));
    }
  }
  render();
  return wrap;
}

function editUser(existing) {
  const oidc = isOidc(state.config);
  const u = existing ? { ...existing } : newUser({ entityId: state.config.entities?.[0]?.id || "" });
  let loginTouched = !!existing;

  const loginField = textField({
    label: "Identifiant de connexion", value: u.login, required: true,
    help: "Sert à identifier le compte (annuaire, SSO). Proposé à partir du nom.",
    onChange: (v) => { loginTouched = true; u.login = v; },
  });
  const loginInput = loginField.querySelector("input");

  const body = h("div", { class: "fr-stack" },
    oidc ? h("p", { class: "fr-small fr-muted", text: "Mode annuaire : ce compte ne peut pas ouvrir de session en étant choisi dans une liste. Il sera rattaché à l'agent dont l'adresse électronique (ou l'identifiant d'annuaire) correspond, lors de sa première connexion par l'annuaire — d'où l'intérêt d'une adresse exacte." }) : null,
    h("div", { class: "fr-row" },
      selectField({
        label: "Civilité", value: u.civility, options: [{ value: "Madame", label: "Madame" }, { value: "Monsieur", label: "Monsieur" }],
        placeholder: "—", onChange: (v) => (u.civility = v),
      }),
      textField({ label: "Prénom", value: u.firstName, required: true, onChange: (v) => { u.firstName = v; suggest(); } }),
      textField({ label: "Nom", value: u.lastName, required: true, onChange: (v) => { u.lastName = v; suggest(); } }),
    ),
    h("div", { class: "fr-row" },
      loginField,
      textField({ label: "Courriel", value: u.email, type: "email", onChange: (v) => (u.email = v) }),
    ),
    scopeEditor(u),
    h("div", { class: "fr-row" },
      selectField({
        label: "Rôle", value: u.role, required: true,
        options: ROLE_ORDER.map((r) => ({ value: r, label: ROLES[r].label })),
        onChange: (v) => { u.role = v; paintRole(); },
      }),
      selectField({
        label: "Structure de rattachement", value: u.entityId, placeholder: "— Aucune —",
        options: (state.config.entities || []).map((e) => ({ value: e.id, label: e.name })),
        onChange: (v) => (u.entityId = v),
      }),
    ),
    h("p", { class: "fr-small fr-muted", id: "compte-role-sum" }),
    h("label", { class: "fr-check" },
      h("input", { type: "checkbox", checked: u.active !== false, on: { change: (e) => (u.active = e.target.checked) } }),
      h("span", { text: "Compte actif (un compte désactivé ne peut plus se connecter)" })),
  );

  function suggest() {
    if (loginTouched) return;
    u.login = slugLogin(u.firstName, u.lastName);
    if (loginInput) loginInput.value = u.login;
  }
  function paintRole() {
    body.querySelector("#compte-role-sum").textContent = ROLES[u.role].summary;
  }
  paintRole();

  const m = modal({
    title: existing ? "Modifier le compte — " + fullName(existing) : (oidc ? "Pré-enregistrer un agent" : "Nouveau compte"),
    body,
    actions: (close) => [
      button("Annuler", { variant: "secondary", onClick: () => close() }),
      button(existing ? "Enregistrer" : "Créer le compte", {
        variant: "primary",
        onClick: async () => {
          if (!u.firstName.trim() || !u.lastName.trim()) { toast("Prénom et nom sont obligatoires", "error"); return; }
          if (existing && existing.role === "administrateur" && u.role !== "administrateur" && activeAdmins(state.users).length <= 1) {
            toast("Il doit rester au moins un administrateur actif.", "warning");
            return;
          }
          u.firstName = u.firstName.trim();
          u.lastName = u.lastName.trim();
          u.login = uniqueLogin(state.users, (u.login || slugLogin(u.firstName, u.lastName)).trim(), u.id);
          const next = existing ? state.users.map((x) => (x.id === u.id ? u : x)) : [...state.users, u];
          await setUsers(next);
          close();
          toast(existing ? "Compte enregistré" : "Compte créé", "success");
        },
      }),
    ],
  });
  return m;
}
