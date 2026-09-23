// ============================================================================
// Organisation : services, bureaux, et périmètre d'accès des comptes.
//
// L'organisation d'une collectivité se lit à deux niveaux :
//   service  (ex. « Direction des systèmes d'information »), rattaché à une entité
//     └── bureau (ex. « Applications métier »)
//
// Un compte est rattaché à un ou plusieurs **services** ; dans chaque service il
// a accès à **tous les bureaux** par défaut, et l'administrateur peut restreindre
// l'accès à certains bureaux.
//
//     user.memberships = [ { serviceId, bureaux: null | ["bur-…", …] } ]
//
// `bureaux: null` (ou absent) = tous les bureaux du service ; un tableau = les
// seuls bureaux listés. Un compte rattaché à **tous** les services est
// « transverse » : il voit tout (c'est ainsi qu'un administrateur donne accès à
// tout à un directeur, sans changer son rôle).
//
// LES SERVICES SE RATTACHENT ENTRE EUX (voir src/lib/organigramme.js) : un
// service peut dépendre d'un autre service, ou du bureau d'un autre service. Le
// périmètre suit la chaîne : un agent affecté à un service de tête couvre tout
// ce qui pend sous lui, jusqu'au bout. La restriction de bureaux, elle, ne
// descend pas par les services rattachés — elle borne ce que voit l'agent DANS
// son service, et couvre seulement ce qui pend sous les bureaux autorisés.
//
// Règle de visibilité d'une trame ou d'un acte :
//   - administrateur, ou compte couvrant tous les services            → tout ;
//   - cible sans service (donnée héritée ou trame générale)           → tout le monde ;
//   - sinon → le service doit être couvert par le périmètre (le sien, ou l'un
//     de ceux qui pendent sous le sien), et si le périmètre est restreint à
//     certains bureaux, la cible doit viser un bureau autorisé (une cible qui
//     vaut pour tout le service reste visible).
// ============================================================================
import { ROLES, hasRole, primaryRoleId } from "./users.js";
import { chaineDeService, servicesSous } from "./organigramme.js";

export const servicesOf = (config) => config?.services || [];
export const serviceById = (config, id) => servicesOf(config).find((s) => s.id === id) || null;
export const bureauxOf = (service) => service?.bureaux || [];
export const bureauById = (service, id) => bureauxOf(service).find((b) => b.id === id) || null;

export const serviceCode = (service) => service?.code || service?.name || "";
export const bureauName = (config, serviceId, bureauId) =>
  bureauById(serviceById(config, serviceId), bureauId)?.name || "";

// Libellé d'une cible (trame, acte) : « DSI · Applications métier ».
export function targetLabel(config, serviceId, bureauId) {
  const s = serviceById(config, serviceId);
  if (!s) return "— sans service —";
  const b = bureauName(config, serviceId, bureauId);
  return b ? `${serviceCode(s)} · ${b}` : `${serviceCode(s)} (tout le service)`;
}

// ------------------------------------------------------------- appartenances
export const membershipsOf = (user) => (Array.isArray(user?.memberships) ? user.memberships : []);
export const membershipFor = (user, serviceId) =>
  membershipsOf(user).find((m) => m && m.serviceId === serviceId) || null;
export const userServiceIds = (user) => membershipsOf(user).map((m) => m.serviceId);
export const isMemberOf = (user, serviceId) => !!membershipFor(user, serviceId);
export const restrictedBureaux = (user, serviceId) => {
  const m = membershipFor(user, serviceId);
  return m ? (Array.isArray(m.bureaux) ? m.bureaux : null) : null;
};

// Le périmètre couvre-t-il tous les services, sans restriction de bureau ?
// Un service rattaché à un autre compte : un compte qui tient tous les services
// DE TÊTE voit, par la chaîne, tout ce qui pend dessous.
export function coversAllServices(config, user) {
  if (!user || user.active === false) return false;
  if (hasRole(user, "administrateur")) return true;
  const all = servicesOf(config);
  if (!all.length) return false;
  const couverts = new Set();
  for (const m of membershipsOf(user)) {
    if (Array.isArray(m.bureaux)) continue;   // restriction : ne couvre pas la chaîne
    for (const id of servicesSous(config, m.serviceId)) couverts.add(id);
  }
  return all.every((s) => couverts.has(s.id));
}

// L'appartenance à *chaque* service, tous bureaux (utilisé par la case
// « Donner accès à tous les services » et par les comptes de démonstration).
export const allServicesMemberships = (config) =>
  servicesOf(config).map((s) => ({ serviceId: s.id, bureaux: null }));

// ----------------------------------------------------------------- périmètre
// Une appartenance couvre-t-elle ce service (et ce bureau, s'il est visé) ?
// C'est le cœur du périmètre, et le seul endroit où la chaîne des services est
// lue : le service visé, ou l'un de ceux qui pendent sous l'appartenance ; et
// pour une appartenance restreinte à des bureaux, ce qui pend sous ces bureaux.
function couvreCible(config, m, serviceId, bureauId) {
  const restreint = Array.isArray(m.bureaux) ? m.bureaux : null;
  if (!restreint) {
    return m.serviceId === serviceId || servicesSous(config, m.serviceId).has(serviceId);
  }
  if (m.serviceId === serviceId) {
    if (!bureauId) return true;             // cible valable pour tout le service
    return restreint.includes(bureauId);
  }
  // Un service en contrebas : il n'est couvert que s'il pend sous un bureau
  // autorisé de mon service.
  return chaineDeService(config, serviceId)
    .some((e) => e.type === "bureau" && e.service.id === m.serviceId && restreint.includes(e.bureau.id));
}

export function inScope(config, user, target) {
  if (!user || user.active === false) return false;
  if (coversAllServices(config, user)) return true;
  const serviceId = target?.serviceId;
  if (!serviceId) return true;            // cible transverse (donnée héritée)
  const bureauId = target?.bureauId || "";
  return membershipsOf(user).some((m) => couvreCible(config, m, serviceId, bureauId));
}

// Les services qu'un compte peut viser (pour peupler un sélecteur de service) :
// les siens, et ceux qui pendent sous les siens.
export function servicesInScope(config, user) {
  if (!user) return [];
  if (coversAllServices(config, user)) return servicesOf(config);
  return servicesOf(config).filter((s) => inScope(config, user, { serviceId: s.id }));
}

export function bureauxInScope(config, user, serviceId) {
  const s = serviceById(config, serviceId);
  if (!s) return [];
  const rest = coveredBureaux(config, user, serviceId);
  return rest ? bureauxOf(s).filter((b) => rest.includes(b.id)) : bureauxOf(s);
}

// Bureaux autorisés dans un service (null = tous). La restriction de bureaux ne
// joue que sur le service de l'appartenance : un service rattaché plus bas est
// couvert en entier (c'est la chaîne, non la restriction, qui l'ouvre).
export function coveredBureaux(config, user, serviceId) {
  if (!user) return [];
  if (coversAllServices(config, user) || hasRole(user, "administrateur")) return null;
  const m = membershipFor(user, serviceId);
  if (m) return Array.isArray(m.bureaux) ? m.bureaux : null;
  return inScope(config, user, { serviceId }) ? null : [];
}

// Les services rattachés SOUS un service, pour la fiche d'un service et le
// libellé du périmètre (« + 3 services rattachés »).
export const servicesRattachesA = (config, serviceId) => {
  const tous = servicesSous(config, serviceId);
  tous.delete(serviceId);
  return servicesOf(config).filter((s) => tous.has(s.id));
};

// ---------------------------------------------------------------- libellés
export function scopeLabel(config, user) {
  if (!user) return "—";
  if (hasRole(user, "administrateur")) return "Tous les services (administrateur)";
  const ms = membershipsOf(user);
  if (!ms.length) return "Aucun service";
  if (coversAllServices(config, user)) return "Tous les services";
  return ms.map((m) => {
    const s = serviceById(config, m.serviceId);
    if (!s) return "(service supprimé)";
    const total = bureauxOf(s).length;
    if (!Array.isArray(m.bureaux) || !total) {
      // Le périmètre descend : on le dit, parce que c'est ce qui explique que
      // l'agent voie des actes d'un autre service.
      const sous = servicesSous(config, m.serviceId).size - 1;
      return serviceCode(s) + (sous > 0 ? ` + ${sous} service(s) rattaché(s)` : "");
    }
    return `${serviceCode(s)} (${m.bureaux.length}/${total} bureaux)`;
  }).join(" · ");
}

// Nom du service tel qu'il s'affiche sous le nom du connecté.
export const primaryServiceName = (config, user) => {
  const s = serviceById(config, membershipsOf(user)[0]?.serviceId);
  return s ? s.name : (user?.service || "");
};

// Auteur d'une contribution (commentaire, règle, trame) : c'est le **service**
// du compte connecté, jamais la personne. Un service porte ses règles et ses
// commentaires au-delà des agents qui s'y succèdent, et le document se lit
// « qui a écrit quoi » sans nommer d'agent derrière chaque phrase.
export const authorLabel = (config, user) => {
  if (!user) return "";
  return primaryServiceName(config, user) || user.login || roleLabelOf(primaryRoleId(user)) || "";
};

export function newService(over = {}) {
  return { id: "svc-" + Math.random().toString(36).slice(2, 9), code: "SRV", name: "Nouveau service", entityId: "", parentId: "", bureaux: [], ...over };
}

export function newBureau(over = {}) {
  return { id: "bur-" + Math.random().toString(36).slice(2, 9), name: "Nouveau bureau", ...over };
}

export const roleLabelOf = (role) => ROLES[role]?.label || role;
