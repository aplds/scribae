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
// Règle de visibilité d'une trame ou d'un acte :
//   - administrateur, ou compte rattaché à tous les services   → tout ;
//   - cible sans service (donnée héritée ou trame générale)     → tout le monde ;
//   - sinon → le service doit être dans le périmètre, et si le périmètre est
//     restreint à certains bureaux, la cible doit viser un bureau autorisé (une
//     cible qui vaut pour tout le service reste visible).
// ============================================================================
import { ROLES } from "./users.js";

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
export function coversAllServices(config, user) {
  if (!user || user.active === false) return false;
  if (user.role === "administrateur") return true;
  const all = servicesOf(config);
  if (!all.length) return false;
  return all.every((s) => {
    const m = membershipFor(user, s.id);
    return !!m && !Array.isArray(m.bureaux);
  });
}

// L'appartenance à *chaque* service, tous bureaux (utilisé par la case
// « Donner accès à tous les services » et par les comptes de démonstration).
export const allServicesMemberships = (config) =>
  servicesOf(config).map((s) => ({ serviceId: s.id, bureaux: null }));

// ----------------------------------------------------------------- périmètre
export function inScope(config, user, target) {
  if (!user || user.active === false) return false;
  if (coversAllServices(config, user)) return true;
  const serviceId = target?.serviceId;
  if (!serviceId) return true;            // cible transverse (donnée héritée)
  const m = membershipFor(user, serviceId);
  if (!m) return false;                   // hors périmètre
  if (!Array.isArray(m.bureaux)) return true;   // tout le service
  if (!target.bureauId) return true;      // cible valable pour tout le service
  return m.bureaux.includes(target.bureauId);
}

// Les services qu'un compte peut viser (pour peupler un sélecteur de service).
export function servicesInScope(config, user) {
  if (!user) return [];
  if (coversAllServices(config, user)) return servicesOf(config);
  return servicesOf(config).filter((s) => isMemberOf(user, s.id));
}

export function bureauxInScope(config, user, serviceId) {
  const s = serviceById(config, serviceId);
  if (!s) return [];
  const rest = coveredBureaux(config, user, serviceId);
  return rest ? bureauxOf(s).filter((b) => rest.includes(b.id)) : bureauxOf(s);
}

// Bureaux autorisés dans un service (null = tous).
export function coveredBureaux(config, user, serviceId) {
  if (!user) return [];
  if (coversAllServices(config, user) || user.role === "administrateur") return null;
  const m = membershipFor(user, serviceId);
  if (!m) return [];
  return Array.isArray(m.bureaux) ? m.bureaux : null;
}

// ---------------------------------------------------------------- libellés
export function scopeLabel(config, user) {
  if (!user) return "—";
  if (user.role === "administrateur") return "Tous les services (administrateur)";
  const ms = membershipsOf(user);
  if (!ms.length) return "Aucun service";
  if (coversAllServices(config, user)) return "Tous les services";
  return ms.map((m) => {
    const s = serviceById(config, m.serviceId);
    if (!s) return "(service supprimé)";
    const total = bureauxOf(s).length;
    if (!Array.isArray(m.bureaux) || !total) return serviceCode(s);
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
  return primaryServiceName(config, user) || user.login || roleLabelOf(user.role) || "";
};

export function newService(over = {}) {
  return { id: "svc-" + Math.random().toString(36).slice(2, 9), code: "SRV", name: "Nouveau service", entityId: "", bureaux: [], ...over };
}

export function newBureau(over = {}) {
  return { id: "bur-" + Math.random().toString(36).slice(2, 9), name: "Nouveau bureau", ...over };
}

export const roleLabelOf = (role) => ROLES[role]?.label || role;
