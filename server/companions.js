import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { bucket, consume } from './protocol.js';
import { validCreation, validScopes } from '../shared/contributions.js';
import { stepPosition } from '../shared/world.js';

const digest = text => createHash('sha256').update(text).digest('hex');
const credential = () => randomBytes(32).toString('base64url');
const exact = (x, keys) => x !== null && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).every(k => keys.includes(k));
const reply = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const rejectBody = (req, res, status, error) => {
  if (res.destroyed || res.writableEnded) return;
  res.setHeader('Connection', 'close');
  // Let HTTP flush the error and close gracefully; destroying at 'finish' can
  // reset a still-writing client before it receives the 408/413 response.
  req.resume();
  reply(res, status, { error });
};
const readJson = req => new Promise((resolve, reject) => {
  const chunks = []; let size = 0, settled = false;
  const finish = (error, value) => {
    if (settled) return; settled = true; clearTimeout(timer);
    req.off('data', data); req.off('end', end); req.off('aborted', aborted); req.off('error', aborted);
    if (error) { req.once('error', () => {}); req.pause(); reject(error); } else resolve(value);
  };
  const data = chunk => { size += chunk.length; if (size > 4096) finish({ status: 413, message: 'Body too large' }); else chunks.push(chunk); };
  const end = () => { try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { finish({ status: 400, message: 'Invalid JSON' }); } };
  const aborted = () => finish({ status: 400, message: 'Request interrupted' });
  // Absolute deadline, independent of how frequently the sender drips bytes.
  const timer = setTimeout(() => finish({ status: 408, message: 'Request body timed out' }), 5000); timer.unref();
  req.on('data', data); req.once('end', end); req.once('aborted', aborted); req.once('error', aborted);
});

// In-memory, session-scoped prototype. This is not an identity service or a model runner.
export class Companions {
  invites = new Map();
  grants = new Map();
  byOwner = new Map();
  proposals = new Map();
  creations = new Map();
  unauthenticatedTraffic = bucket(24, 4);
  activeBodyReaders = 0;
  constructor({ rooms, send, publicPlayer, origins, now = Date.now }) {
    Object.assign(this, { rooms, send, publicPlayer, origins, now });
  }
  revoke(owner, announce = true) {
    const key = this.byOwner.get(owner.id), grant = this.grants.get(key);
    if (grant) this.rooms.get(owner.room)?.delete(grant.agent.id);
    this.grants.delete(key); this.byOwner.delete(owner.id);
    for (const [code, invite] of this.invites) if (invite.owner.id === owner.id) this.invites.delete(code);
    this.proposals.delete(owner.id);
    if (announce) this.send(owner.ws, { type: 'agent-status', connected: false, message: 'Agent access revoked.', proposal: null });
  }
  leave(owner) { this.revoke(owner, false); this.creations.delete(owner.id); }
  expire() {
    const now = this.now();
    for (const [code, invite] of this.invites) if (invite.expiresAt <= now) this.invites.delete(code);
    for (const grant of this.grants.values()) if (grant.expiresAt <= now) this.revoke(grant.owner);
  }
  invite(owner, scopes, requestId) {
    this.expire();
    if (!validScopes(scopes)) return;
    this.revoke(owner, false);
    const code = credential(), expiresAt = this.now() + 60000;
    this.invites.set(digest(code), { owner, scopes: [...scopes], expiresAt });
    this.send(owner.ws, { type: 'agent-invite', code, expiresAt, scopes, requestId });
  }
  list(room) { return [...this.creations.values()].filter(c => c.room === room).map(({ room: _, ...c }) => c); }
  place(owner, creation) {
    if (!validCreation(creation)) return { ok: false, message: 'Choose one garden plot and an available creation.' };
    if (this.list(owner.room).some(c => c.plot === creation.plot && c.ownerId !== owner.id)) return { ok: false, message: 'That garden plot is occupied. Choose another.' };
    this.creations.set(owner.id, { ...creation, ownerId: owner.id, ownerName: owner.name, room: owner.room });
    return { ok: true, message: 'Your creation is in the shared garden for this visit.' };
  }
  decide(owner, id, accept) {
    const proposal = this.proposals.get(owner.id);
    if (!proposal || proposal.id !== id) return { ok: false, message: 'That proposal is no longer available.' };
    const result = accept ? this.place(owner, proposal.creation) : { ok: true, message: 'Proposal declined.' };
    if (result.ok) this.proposals.delete(owner.id);
    return result;
  }
  async handle(req, res) {
    const path = new URL(req.url, 'http://local').pathname;
    if (!path.startsWith('/api/agents')) return false;
    this.expire();
    const method = req.method;
    if (req.headers.origin && !this.origins.includes(req.headers.origin)) { reply(res, 403, { error: 'Origin not allowed' }); return true; }
    if (path === '/api/agents' && method === 'GET') {
      reply(res, 200, {
        version: 1, name: 'Beaververse companion API', pairing: 'POST /api/agents/pair with JSON {code: owner-issued code}',
        authentication: 'Use returned token in Authorization: Bearer TOKEN. Never put tokens in a URL.',
        state: 'GET /api/agents/state', action: 'POST /api/agents/action',
        actions: [{ type: 'wave' }, { type: 'move', dx: 0.5, dz: 0 }, { type: 'propose', creation: { kind: 'planter', plot: 0 } }],
        boundaries: 'One companion per present owner. Pairing expires after 60 seconds; access after 15 minutes or owner departure/revocation. Observe public same-room positions only. No voice, chat history, shell, files or publication. Proposals need owner acceptance.',
      }); return true;
    }
    const pairing = path === '/api/agents/pair' && method === 'POST';
    let grant;
    if (pairing && !consume(this.unauthenticatedTraffic, this.now())) { reply(res, 429, { error: 'Pairing is busy. Try again shortly.' }); return true; }
    if (!pairing) {
      const auth = req.headers.authorization;
      if (typeof auth !== 'string' || !/^Bearer [A-Za-z0-9_-]{43}$/.test(auth)) { reply(res, consume(this.unauthenticatedTraffic, this.now()) ? 401 : 429, { error: 'Valid bearer token required' }); return true; }
      grant = this.grants.get(digest(auth.slice(7)));
      if (!grant) { reply(res, consume(this.unauthenticatedTraffic, this.now()) ? 401 : 429, { error: 'Expired or revoked token' }); return true; }
      if (!consume(grant.traffic, this.now())) { reply(res, 429, { error: 'Slow down' }); return true; }
    }
    if (path === '/api/agents/state' && method === 'GET') {
      reply(res, 200, { agentId: grant.agent.id, scopes: grant.scopes, expiresAt: grant.expiresAt, room: grant.owner.room,
        players: [...(this.rooms.get(grant.owner.room)?.values() || [])].map(this.publicPlayer), creations: this.list(grant.owner.room) }); return true;
    }
    if (!pairing && !(path === '/api/agents/action' && method === 'POST')) { reply(res, 404, { error: 'Unsupported endpoint or method' }); return true; }
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) { reply(res, 415, { error: 'JSON required' }); return true; }
    if (Number(req.headers['content-length']) > 4096) { rejectBody(req, res, 413, 'Body too large'); return true; }
    if (this.activeBodyReaders >= 16) { rejectBody(req, res, 429, 'Too many pending requests. Try again shortly.'); return true; }
    let body;
    this.activeBodyReaders++;
    try {
      body = await readJson(req);
    } catch (error) { rejectBody(req, res, error.status || 400, error.message || 'Invalid JSON'); return true; }
    finally { this.activeBodyReaders--; }
    // Revalidate after asynchronous body read: an owner may leave/revoke while it arrives.
    this.expire();
    if (pairing) {
      if (!exact(body, ['code']) || typeof body.code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.code)) { reply(res, 400, { error: 'Invalid pairing code' }); return true; }
      const key = digest(body.code), invite = this.invites.get(key);
      if (!invite || !this.rooms.get(invite.owner.room)?.has(invite.owner.id)) { reply(res, 401, { error: 'Expired or used pairing code' }); return true; }
      const room = this.rooms.get(invite.owner.room);
      if (room.size >= 12 || this.grants.size >= 32) { reply(res, 409, { error: 'Companion capacity reached' }); return true; }
      this.invites.delete(key);
      const token = credential(), tokenKey = digest(token), expiresAt = this.now() + 15 * 60000;
      const agent = { id: randomUUID(), name: `${invite.owner.name.slice(0, 18)} · AI`, color: invite.owner.color, room: invite.owner.room,
        x: invite.owner.x, z: invite.owner.z, yaw: invite.owner.yaw, voice: false, wave: 0, agent: true, moved: this.now() };
      this.grants.set(tokenKey, { owner: invite.owner, agent, scopes: invite.scopes, expiresAt, traffic: bucket(8, 2), proposals: bucket(2, 1 / 15) });
      this.byOwner.set(invite.owner.id, tokenKey); room.set(agent.id, agent);
      this.send(invite.owner.ws, { type: 'agent-status', connected: true, expiresAt, scopes: invite.scopes, proposal: null, message: 'Your companion joined. You can revoke access at any time.' });
      reply(res, 201, { token, agentId: agent.id, scopes: invite.scopes, expiresAt }); return true;
    }
    if (!this.grants.has(this.byOwner.get(grant.owner.id)) || this.grants.get(this.byOwner.get(grant.owner.id)) !== grant) { reply(res, 401, { error: 'Expired or revoked token' }); return true; }
    const action = body?.type;
    if (!['wave', 'move', 'propose'].includes(action) || !grant.scopes.includes(action)) { reply(res, 403, { error: 'Action not granted' }); return true; }
    if (action === 'wave' && exact(body, ['type'])) grant.agent.wave = this.now();
    else if (action === 'move' && exact(body, ['type', 'dx', 'dz']) && [body.dx, body.dz].every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1)) {
      const now = this.now(), length = Math.hypot(body.dx, body.dz), limit = Math.min(.3, Math.max(0, (now - grant.agent.moved) / 1000)) * 4.3;
      const scale = length ? Math.min(1, limit / length) : 0;
      Object.assign(grant.agent, stepPosition(grant.agent, body.dx * scale, body.dz * scale));
      if (length) grant.agent.yaw = Math.atan2(body.dx, body.dz) * 180 / Math.PI;
      grant.agent.moved = now;
    } else if (action === 'propose' && exact(body, ['type', 'creation']) && validCreation(body.creation)) {
      if (!consume(grant.proposals, this.now())) { reply(res, 429, { error: 'Proposal limit reached' }); return true; }
      const proposal = { id: randomUUID(), creation: { ...body.creation } }; this.proposals.set(grant.owner.id, proposal);
      this.send(grant.owner.ws, { type: 'agent-proposal', proposal });
      reply(res, 202, { pending: true, proposalId: proposal.id, message: 'Owner review required; nothing placed yet.' }); return true;
    } else { reply(res, 400, { error: 'Invalid action schema' }); return true; }
    reply(res, 200, { ok: true }); return true;
  }
}
