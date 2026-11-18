// Original, bounded authoring vocabulary. No uploaded code, assets or arbitrary paths.
export const GARDEN_PLOTS = [
  { x: -8, z: 5 }, { x: -6, z: 5 }, { x: -8, z: 7 }, { x: -6, z: 7 },
  { x: -8, z: 9 }, { x: -6, z: 9 }, { x: -8, z: 11 }, { x: -6, z: 11 },
];
export const CREATION_KINDS = ['planter', 'lantern'];
export const AGENT_SCOPES = ['observe', 'wave', 'move', 'propose'];
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) => record(x) && Object.keys(x).every(k => keys.includes(k));
export const validCreation = m => exact(m, ['kind', 'plot']) && CREATION_KINDS.includes(m.kind) && Number.isInteger(m.plot) && m.plot >= 0 && m.plot < GARDEN_PLOTS.length;
export const validScopes = a => Array.isArray(a) && a.length >= 1 && a.length <= AGENT_SCOPES.length && new Set(a).size === a.length && a.includes('observe') && a.every(s => AGENT_SCOPES.includes(s));
export function validCommunityMessage(m) {
  switch (m?.type) {
    case 'agent-invite': return exact(m, ['type', 'scopes', 'requestId']) && validScopes(m.scopes) && (m.requestId === undefined || typeof m.requestId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.requestId));
    case 'agent-revoke': return exact(m, ['type']);
    case 'creation-set': return exact(m, ['type', 'creation']) && validCreation(m.creation);
    case 'creation-remove': return exact(m, ['type']);
    case 'proposal-decide': return exact(m, ['type', 'id', 'accept']) && typeof m.id === 'string' && m.id.length === 36 && typeof m.accept === 'boolean';
    default: return false;
  }
}
