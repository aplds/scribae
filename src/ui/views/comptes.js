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
import { state, setUsers, resetDemoUsers, currentUser, login, navigate, touch } from "../state.js";
import { h, button, toast, icon, modal, clear } from "../dom.js";
import { confirmDialog, textField, selectField, choiceField, emptyState, sectionHeader } from "../components.js";
import { ROLES, ROLE_ORDER, ROLES_CUMULABLES, PERMS, newUser, slugLogin, uniqueLogin, fullName, initialsOf, sortName, activeAdmins, primaryRoleId, rolesOf, setRoles, toggleRole, estCumulable, hasRole, badgesOf, ACCOUNT_SOURCES, sourceOf, isDemoUser } from "../../lib/users.js";
import {
  ROLE_SIGNATAIRE, situationDeSignature, etatRapprochement, rapprocher, deRapprocher,
} from "../../lib/signataires.js";
import { scopeLabel, coversAllServices, primaryServiceName, membershipFor, bureauxOf, servicesOf, allServicesMemberships } from "../../lib/scope.js";
import { newCompetence, competenceLabel, estReviseur, competencesDe } from "../../lib/revision.js";
import { isOidc, demoAccountsDisabled, authConfig, issuerLabel, isTestProvider } from "../../lib/auth.js";

export function renderComptes(root) {
  const me = currentUser();
  const oidc = isOidc(state.config);
  const users = state.users.slice().sort((a, b) => {
    const r = ROLE_ORDER.indexOf(primaryRoleId(b)) - ROLE_ORDER.indexOf(primaryRoleId(a));
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
      h("th", { text: "Nom" }), h("th", { text: "Identifiant" }), h("th", { text: "Rôles et qualités" }),
      h("th", { text: "Périmètre (services et bureaux)" }),
      h("th", { text: "Structure" }), h("th", { text: "État" }), h("th", { text: "Dernier accès" }), h("th", {}),
    )),
  );
  const tb = h("tbody");
  for (const u of users) {
    const entity = (state.config.entities || []).find((e) => e.id === u.entityId);
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
      h("td", {},
        h("div", { class: "compte__roles" },
          ...badgesOf(u).map((r) => h("span", { class: "fr-badge fr-badge--" + r.badge, title: r.summary, text: r.label })),
        ),
        estReviseur(state.config, u)
          ? h("span", { class: "compte-revision__label", title: "Compétence du réviseur : ce sur quoi il est compétent", text: revisionSummary(u) })
          : null),
      h("td", { class: "fr-small" },
        h("span", { text: scopeLabel(state.config, u) }),
        coversAllServices(state.config, u) && !hasRole(u, "administrateur")
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
    h("p", { class: "fr-small fr-muted", style: { marginTop: "10px" }, text: "Le rôle « Réviseur » se cumule avec les autres : un éditeur peut être chargé de contrôler les actes avant leur signature. Sa compétence — les services, familles, types d'actes et entités qu'il révise — se règle sur son compte ; quand la qualité appartient à un service entier (ou à certains de ses bureaux), elle se règle sur le service, dans « Administration › Services »." }),
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
  if (hasRole(u, "administrateur") && activeAdmins(state.users).length <= 1) return "Il doit rester au moins un administrateur actif.";
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
    if (hasRole(u, "administrateur") && activeAdmins(state.users).length <= 1) { toast("Il doit rester au moins un administrateur actif.", "warning"); return; }
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
    "Tous les comptes actuels seront remplacés par les onze comptes de démonstration. Les comptes créés à la main seront perdus.",
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
    if (hasRole(u, "administrateur")) {
      summary.appendChild(h("span", { class: "fr-badge fr-badge--error", text: "Administrateur : voit tout, quel que soit le périmètre" }));
    }
    summary.appendChild(h("span", { text: "Périmètre actuel : " + scopeLabel(c, u) }));
    if (coversAllServices(c, u) && !hasRole(u, "administrateur")) {
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
      list.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun service n'est défini. Ajoutez-en dans « Administration › Services » : sans service, tout le monde voit toutes les trames." }));
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

// Éditeur des rôles : le PROFIL PRINCIPAL — un seul, choisi parmi ceux qui ne
// se cumulent pas — puis les QUALITÉS qui s'y ajoutent. Le rôle « Réviseur » se
// cumule : il ne dit pas ce qu'un agent rédige, mais ce qu'il contrôle avant la
// signature. On écrit toujours la liste complète (`user.roles`) par `setRoles`,
// qui remet le principal en tête ; `user.role` n'en est que le reflet.
function roleEditor(u, onChange) {
  if (!Array.isArray(u.roles)) u.roles = rolesOf(u);
  const wrap = h("div", { class: "fr-field compte-roles" },
    h("label", { class: "fr-label", text: "Profil d'accès" }),
    h("p", { class: "fr-hint", text: "Le profil principal dit ce que le compte fait ; les qualités qui se cumulent s'y ajoutent. Le profil « Visiteur » n'ouvre aucun écran : le compte peut s'authentifier, mais n'accède qu'à l'espace public." }),
  );
  const principals = h("div", { class: "fr-choices" });
  const cumuls = h("div", { class: "compte-roles__cumuls" });
  wrap.append(principals, cumuls);

  function paint() {
    clear(principals);
    clear(cumuls);
    const principal = primaryRoleId(u);
    for (const r of ROLE_ORDER.filter((x) => !estCumulable(x))) {
      principals.appendChild(h("button", {
        type: "button", class: "fr-choice" + (principal === r ? " is-on" : ""), title: ROLES[r].summary,
        on: { click: () => { setRoles(u, [...rolesOf(u).filter(estCumulable), r]); paint(); onChange?.(); } },
      }, ROLES[r].label));
    }
    for (const r of ROLES_CUMULABLES) {
      cumuls.appendChild(h("label", { class: "fr-check", title: ROLES[r].summary },
        h("input", { type: "checkbox", checked: hasRole(u, r), on: { change: () => { toggleRole(u, r); paint(); onChange?.(); } } }),
        h("span", { text: ROLES[r].label + " (se cumule avec le profil principal)" })));
    }
  }
  paint();
  return wrap;
}

// Compétence d'un réviseur : ce qu'il contrôle. On ne demande rien tant qu'elle
// n'est pas restreinte — une liste vide vaut « tout », et c'est le cas courant.
// Pour donner la qualité à un service entier (un service des affaires
// juridiques qui contrôle les actes de tous), c'est sur le SERVICE que cela se
// règle : « Administration › Services ».
function revisionEditor(u) {
  if (!u.revision) u.revision = newCompetence();
  const c = state.config;
  const box = h("div", { class: "fr-field compte-revision" },
    h("label", { class: "fr-label", text: "Compétence du réviseur" }),
    h("p", { class: "fr-hint", text: "Ce que ce compte contrôle avant signature. Ne rien cocher vaut « tout » : tous les services et tous les actes. Pour que la qualité soit portée par un service entier (ou par certains de ses bureaux), réglez-la sur le service, dans « Administration › Services »." }),
    h("p", { class: "fr-small" }, h("span", { text: "Compétence actuelle : " }), h("strong", { text: competenceLabel(c, u.revision) })),
  );
  const champ = (label, value, options, help, apply) => options.length
    ? choiceField({ label, value, multi: true, help, options, onChange: apply })
    : null;
  box.appendChild(champ("Services", u.revision.services,
    servicesOf(c).map((s) => ({ value: s.id, label: (s.code ? s.code + " — " : "") + s.name })),
    "Les services dont les actes relèvent de ce réviseur. Vide : tous.", (v) => (u.revision.services = v)));
  box.appendChild(champ("Familles de trames", u.revision.familyIds,
    (c.families || []).map((f) => ({ value: f.id, label: f.label })),
    "Vide : toutes.", (v) => (u.revision.familyIds = v)));
  box.appendChild(champ("Types d'actes", u.revision.actTypes,
    (c.actTypes || []).map((t) => ({ value: t.id, label: t.label })),
    "Vide : tous.", (v) => (u.revision.actTypes = v)));
  box.appendChild(champ("Entités signataires", u.revision.entityIds,
    (c.entities || []).map((e) => ({ value: e.id, label: (e.code ? e.code + " — " : "") + e.name })),
    "Vide : toutes.", (v) => (u.revision.entityIds = v)));
  box.appendChild(champ("Trames précises", u.revision.trameIds,
    (state.trames || []).map((t) => ({ value: t.id, label: t.name || t.id })),
    "Vide : toutes. À réserver aux cas particuliers.", (v) => (u.revision.trameIds = v)));
  return box;
}

// Ce que la table des comptes dit d'un réviseur : sa compétence, qu'elle vienne
// de son compte ou d'un service dont il relève.
function revisionSummary(u) {
  const labels = [...new Set(competencesDe(state.config, u).map((c) => competenceLabel(state.config, c)))];
  return labels.length ? labels.join(" · ") : "";
}

// La qualité de signataire et le rapprochement. Un signataire signe avec son
// compte : la PERSONNE du référentiel qu'il tient (`personId`) et le compte que
// l'outil de signature lui connaît. Ce bloc dit l'un et l'autre, et rapproche
// les deux — voir src/lib/signataires.js.
function signatureEditor(u) {
  const c = state.config;
  const corps = h("div", {});
  const box = h("div", { class: "fr-field compte-signature" },
    h("label", { class: "fr-label", text: "Signature électronique" }),
    h("p", { class: "fr-hint", text: "Un signataire signe avec son compte. Rattaché à une personne du référentiel, il tient d'elle sa qualité ; l'annuaire de la collectivité (OIDC) provisionne le même agent sur l'outil de signature, et le rapprochement relie les deux comptes." }),
    corps);
  const peindre = () => {
    clear(corps);
    if (!u.personId) {
      corps.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucune personne du référentiel n'est rattachée à ce compte : il ne peut pas porter la qualité de signataire." }));
      return;
    }
    const sit = situationDeSignature(c, u.personId);
    const etat = etatRapprochement(c, state.users, u.personId);
    corps.appendChild(h("p", { class: "fr-small" }, h("span", { text: "Signature : " }), h("strong", { text: sit.texte })));
    corps.appendChild(h("p", { class: "fr-small" }, h("span", { text: "Compte de l'outil de signature : " }), h("strong", { text: etat.compteOutil || "—" })));
    corps.appendChild(h("p", { class: "fr-small" },
      h("span", { text: etat.ok ? "Rapproché. " : "Non rapproché. " }),
      h("span", { class: "fr-muted", text: etat.ok ? "" : etat.motif })));
    corps.appendChild(h("div", { class: "fr-row" },
      etat.ok
        ? button("Retirer le rapprochement", { variant: "tertiary", size: "sm", icon: "x", onClick: () => { deRapprocher(c, u.personId); touch("config"); peindre(); } })
        : button("Rapprocher avec l'outil de signature", { variant: "secondary", size: "sm", icon: "check", onClick: () => {
          const r = rapprocher(c, state.users, u.personId, { par: fullName(state.user) || "" });
          if (!r.ok) { toast(r.motif, "warning"); return; }
          touch("config"); peindre();
          toast("Compte rapproché de l'outil de signature.", "success");
        } })));
  };
  peindre();
  return box;
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
  const revisionCtn = h("div", { class: "compte-revision-ctn" });
  const signatureCtn = h("div", { class: "compte-signature-ctn" });

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
      roleEditor(u, paintRole),
      selectField({
        label: "Structure de rattachement", value: u.entityId, placeholder: "— Aucune —",
        options: (state.config.entities || []).map((e) => ({ value: e.id, label: e.name })),
        onChange: (v) => (u.entityId = v),
      }),
    ),
    h("p", { class: "fr-small fr-muted", id: "compte-role-sum" }),
    h("div", { class: "fr-row" },
      selectField({
        label: "Personne du référentiel — qui signe", value: u.personId, placeholder: "— Aucune —",
        help: "Le lien avec la personne qui porte la qualité. C'est lui qui permet à ce compte de signer au nom de cette personne, et de ne voir que les actes de son champ de compétence.",
        options: (state.config.people || []).map((p) => ({ value: p.id, label: [p.civility, p.firstName, p.lastName].filter(Boolean).join(" ") })),
        onChange: (v) => { u.personId = v; paintRole(); },
      }),
    ),
    signatureCtn,
    revisionCtn,
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
    body.querySelector("#compte-role-sum").textContent = badgesOf(u).map((r) => r.summary).join(" ");
    clear(revisionCtn);
    if (hasRole(u, "reviseur")) revisionCtn.appendChild(revisionEditor(u));
    clear(signatureCtn);
    if (hasRole(u, ROLE_SIGNATAIRE) || u.personId) signatureCtn.appendChild(signatureEditor(u));
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
          if (existing && hasRole(existing, "administrateur") && !hasRole(u, "administrateur") && activeAdmins(state.users).length <= 1) {
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
