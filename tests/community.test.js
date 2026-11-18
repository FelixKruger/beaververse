import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { validCommunityMessage, validCreation, validScopes } from '../shared/contributions.js';
import { visitNote, loadNotes, communityEvidence, NOTE_RETENTION_MS } from '../shared/visit-notes.js';
import { Companions } from '../server/companions.js';
import http from 'node:http';

const pause = ms => new Promise(r => setTimeout(r, ms));
async function until(fn) { for (let i = 0; i < 150; i++) { const x = fn(); if (x) return x; await pause(20); } throw new Error('Expected event missing'); }

test('contribution schemas reject extra authority and out-of-bounds placements', () => {
  assert.ok(validCreation({ kind: 'lantern', plot: 7 }));
  for (const c of [null, {}, { kind: 'script', plot: 0 }, { kind: 'planter', plot: -1 }, { kind: 'planter', plot: 8 }, { kind: 'planter', plot: 1.1 }, { kind: 'planter', plot: 0, ownerId: 'other' }]) assert.equal(validCreation(c), false);
  for (const s of [['observe', 'admin'], ['observe', 'observe'], [], ['move'], 'observe']) assert.equal(validScopes(s), false);
  assert.ok(validCommunityMessage({ type: 'agent-invite', scopes: ['observe', 'wave'] }));
  assert.ok(validCommunityMessage({ type: 'agent-invite', scopes: ['observe'], requestId: '00000000-0000-0000-0000-000000000001' }));
  assert.equal(validCommunityMessage({ type: 'agent-invite', scopes: ['observe'], requestId: 'unbounded request id' }), false);
  assert.equal(validCommunityMessage({ type: 'creation-remove', ownerId: 'other' }), false);
});

test('community export excludes private notes and unconsented feedback; expired notes are dropped', () => {
  const now = Date.now(), privateNote = visitNote({ takeaway: 'PRIVATE', suggestion: 'UNSHARED', valuable: 'yes' }, now);
  const donated = visitNote({ takeaway: 'ALSO PRIVATE', suggestion: 'A useful garden', valuable: 'no', allowWorldImprovement: true }, now);
  const exported = JSON.stringify(communityEvidence([privateNote, donated]));
  assert.equal(exported.includes('PRIVATE'), false); assert.equal(exported.includes('UNSHARED'), false); assert.match(exported, /A useful garden/);
  assert.deepEqual(loadNotes('{broken'), []);
  assert.equal(loadNotes(JSON.stringify([privateNote]), now + NOTE_RETENTION_MS + 1).length, 0);
  assert.equal(loadNotes(JSON.stringify([privateNote]), now - 1).length, 0);
  assert.equal(visitNote({ allowWorldImprovement: 'yes' }).allowWorldImprovement, false);
});

test('invitation expiry and grant expiry remove capabilities and companion presence', () => {
  let now = 1000; const owner = { id: 'owner', room: 'room', ws: {} }, room = new Map([['owner', owner]]), sent = [];
  const c = new Companions({ rooms: new Map([['room', room]]), send: (_, m) => sent.push(m), publicPlayer: p => p, origins: [], now: () => now });
  c.invite(owner, ['observe']); assert.equal(c.invites.size, 1); now += 60000; c.expire(); assert.equal(c.invites.size, 0);
  room.set('agent', { id: 'agent' }); c.grants.set('token', { owner, agent: { id: 'agent' }, expiresAt: now }); c.byOwner.set(owner.id, 'token'); c.expire();
  assert.equal(c.grants.size, 0); assert.equal(room.has('agent'), false); assert.equal(sent.at(-1).connected, false);
});

test('real companion API pairs once, denies authority, isolates rooms, reviews proposals and revokes', async t => {
  const child = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, NODE_ENV: 'test', HOST: '127.0.0.1', PORT: '0', ALLOWED_ORIGINS: 'http://beaververse.test' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let base = '', out = ''; child.stdout.on('data', x => { out += x; const m = out.match(/http:\/\/127\.0\.0\.1:\d+/); if (m) base = m[0]; });
  const clients = []; t.after(() => { clients.forEach(c => c.ws.terminate()); child.kill(); }); await until(() => base);
  const join = async room => {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/room', { origin: 'http://beaververse.test' }), messages = [];
    const c = { ws, messages, send: m => ws.send(JSON.stringify(m)) }; clients.push(c); ws.on('message', raw => messages.push(JSON.parse(raw))); ws.on('error', () => {});
    await until(() => ws.readyState === WebSocket.OPEN); c.send({ type: 'join', room, name: room, color: 'moss' }); c.id = (await until(() => messages.find(m => m.type === 'welcome'))).id; return c;
  };
  const a = await join('one'), b = await join('one'), outsider = await join('two');
  const request = async (path, body, token, origin) => {
    const headers = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}) };
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
  };
  a.send({ type: 'agent-invite', scopes: ['observe', 'wave', 'propose'] });
  const invite = await until(() => a.messages.find(m => m.type === 'agent-invite'));
  assert.equal(b.messages.some(m => m.type === 'agent-invite'), false);
  assert.equal((await request('/api/agents/pair', { code: invite.code }, null, 'https://evil.invalid')).status, 403);
  const paired = await request('/api/agents/pair', { code: invite.code }); assert.equal(paired.status, 201);
  const token = paired.data.token;
  assert.equal((await request('/api/agents/pair', { code: invite.code })).status, 401);
  const state = await request('/api/agents/state', null, token); assert.equal(state.status, 200);
  assert.equal(state.data.players.some(p => p.id === outsider.id), false);
  assert.equal(state.data.players.find(p => p.id === paired.data.agentId).agent, true);
  assert.equal((await request('/api/agents/action', { type: 'move', dx: 1, dz: 0 }, token)).status, 403);
  assert.equal((await request('/api/agents/action', { type: 'chat', text: 'not permitted' }, token)).status, 403);
  assert.equal((await request('/api/agents/action', { type: 'wave', scope: 'admin' }, token)).status, 400);
  assert.equal((await request('/api/agents/action', { type: 'wave' }, token)).status, 200);
  const proposed = await request('/api/agents/action', { type: 'propose', creation: { kind: 'lantern', plot: 0 } }, token); assert.equal(proposed.status, 202);
  const proposal = await until(() => a.messages.find(m => m.type === 'agent-proposal')?.proposal);
  assert.equal(b.messages.some(m => m.type === 'agent-proposal'), false);
  assert.equal((await request('/api/agents/state', null, token)).data.creations.length, 0);
  b.send({ type: 'proposal-decide', id: proposal.id, accept: true }); await until(() => b.messages.some(m => m.type === 'creation-result' && !m.ok));
  a.send({ type: 'proposal-decide', id: proposal.id, accept: true }); await until(() => b.messages.some(m => m.type === 'state' && m.creations?.length === 1));
  b.send({ type: 'creation-set', creation: { kind: 'planter', plot: 0 } }); await until(() => b.messages.some(m => m.type === 'creation-result' && m.message.includes('occupied')));
  b.send({ type: 'creation-remove' }); await pause(150); assert.equal(b.messages.filter(m => m.type === 'state').at(-1).creations.length, 1);
  for (let i = 0; i < 6; i++) a.send({ type: 'wave' });
  a.send({ type: 'agent-revoke' }); await until(() => a.messages.some(m => m.type === 'agent-status' && !m.connected));
  assert.equal((await request('/api/agents/state', null, token)).status, 401);
  assert.equal((await request('/api/agents/state?token=' + token)).status, 401);
  a.ws.close(); await until(() => b.messages.filter(m => m.type === 'state').at(-1)?.creations.length === 0);
  const c = await join('one');
  c.send({ type: 'agent-invite', scopes: ['observe', 'wave'], requestId: '00000000-0000-0000-0000-000000000001' });
  const ci = await until(() => c.messages.find(m => m.type === 'agent-invite'));
  assert.equal(ci.requestId, '00000000-0000-0000-0000-000000000001');
  const cp = await request('/api/agents/pair', { code: ci.code }); assert.equal(cp.status, 201);
  await until(() => b.messages.filter(m => m.type === 'state').at(-1)?.players.some(p => p.id === cp.data.agentId));
  c.ws.close(); await until(() => b.messages.filter(m => m.type === 'state').at(-1)?.players.every(p => p.id !== cp.data.agentId));
  assert.equal((await request('/api/agents/state', null, cp.data.token)).status, 401);
  for (let i = 0; i < 4; i++) b.send({ type: 'wave' });
  b.send({ type: 'agent-invite', scopes: ['observe'], requestId: '00000000-0000-0000-0000-000000000002' });
  assert.equal((await until(() => b.messages.find(m => m.type === 'error' && m.requestId === '00000000-0000-0000-0000-000000000002'))).message, 'Please slow down');
});

async function companionFixture(t) {
  let now = Date.now(); const owner = { id: 'owner', name: 'Owner', room: 'test', ws: {}, x: 0, z: 10.5, yaw: 0, color: 'moss' };
  const room = new Map([[owner.id, owner]]), messages = [];
  const c = new Companions({ rooms: new Map([['test', room]]), send: (_, m) => messages.push(m), publicPlayer: p => ({ id: p.id, agent: !!p.agent }), origins: [], now: () => now });
  const server = http.createServer((req, res) => c.handle(req, res).catch(() => { res.writeHead(500); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const invite = () => { c.invite(owner, ['observe', 'wave']); return messages.at(-1).code; };
  const pair = code => fetch(base + '/api/agents/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
  const pending = (path, token, length) => {
    let response;
    const done = new Promise((resolve, reject) => {
      response = http.request(base + path, { method: 'POST', agent: false, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(length ? { 'Content-Length': length } : {}) } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      response.on('error', reject); response.flushHeaders(); response.write('{');
    });
    return { req: response, done };
  };
  return { c, owner, room, base, invite, pair, pending, advance: ms => { now += ms; } };
}

test('real HTTP pairing races, expiry and revocation revalidate at request completion', async t => {
  const f = await companionFixture(t);
  let code = f.invite(); const raced = await Promise.all([f.pair(code), f.pair(code)]);
  assert.deepEqual(raced.map(r => r.status).sort(), [201, 401]);
  let token = (await raced.find(r => r.status === 201).json()).token;
  const revoked = f.pending('/api/agents/action', token); await until(() => f.c.activeBodyReaders === 1);
  f.c.revoke(f.owner); revoked.req.end('"type":"wave"}'); assert.equal(await revoked.done, 401);
  code = f.invite(); const oldInvite = f.pending('/api/agents/pair'); await until(() => f.c.activeBodyReaders === 1);
  f.invite(); oldInvite.req.end(`"code":"${code}"}`); assert.equal(await oldInvite.done, 401);
  code = f.invite(); f.advance(60000); assert.equal((await f.pair(code)).status, 401);
  code = f.invite(); token = (await (await f.pair(code)).json()).token;
  const expired = f.pending('/api/agents/action', token); await until(() => f.c.activeBodyReaders === 1);
  f.advance(15 * 60000); expired.req.end('"type":"wave"}'); assert.equal(await expired.done, 401); assert.equal(f.c.grants.size, 0);
  code = f.invite(); token = (await (await f.pair(code)).json()).token;
  const gone = f.pending('/api/agents/action', token); await until(() => f.c.activeBodyReaders === 1);
  f.c.leave(f.owner); f.room.delete(f.owner.id); gone.req.end('"type":"wave"}'); assert.equal(await gone.done, 401);
  assert.equal(f.c.activeBodyReaders, 0);
});

test('body readers enforce a deadline and concurrency bound and recover after abort/size/rate failures', async t => {
  const f = await companionFixture(t), held = [];
  for (let i = 0; i < 16; i++) { const request = f.pending('/api/agents/pair'); request.done.catch(() => {}); held.push(request); }
  await until(() => f.c.activeBodyReaders === 16);
  assert.equal((await f.pair('A'.repeat(43))).status, 429);
  held.forEach(r => r.req.destroy()); await until(() => f.c.activeBodyReaders === 0);
  const oversized = f.pending('/api/agents/pair', null, 4097); assert.equal(await oversized.done, 413);
  const chunked = f.pending('/api/agents/pair'); chunked.req.end('x'.repeat(4096)); assert.equal(await chunked.done, 413);
  const timed = f.pending('/api/agents/pair'); const start = Date.now();
  const drip = setInterval(() => timed.req.write(' '), 100); t.after(() => clearInterval(drip));
  assert.equal(await timed.done, 408); clearInterval(drip); assert.ok(Date.now() - start < 7500, 'absolute deadline beats drip traffic');
  assert.equal(f.c.activeBodyReaders, 0);
  f.advance(10000); const code = f.invite(); const paired = await f.pair(code); assert.equal(paired.status, 201); const token = (await paired.json()).token;
  const statuses = await Promise.all(Array.from({ length: 9 }, async () => (await fetch(f.base + '/api/agents/state', { headers: { Authorization: `Bearer ${token}` } })).status));
  assert.equal(statuses.filter(s => s === 429).length, 1);
  f.advance(1000); assert.equal((await fetch(f.base + '/api/agents/state', { headers: { Authorization: `Bearer ${token}` } })).status, 200);
  f.c.revoke(f.owner); assert.equal((await fetch(f.base + '/api/agents/state', { headers: { Authorization: `Bearer ${token}` } })).status, 401);
});
