import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const pause = ms => new Promise(r => setTimeout(r, ms));
async function until(fn) { for (let i = 0; i < 80; i++) { const value = fn(); if (value) return value; await pause(25); } throw new Error('Expected server event did not arrive'); }
test('real server isolates rooms, limits payloads and requires voice consent', async t => {
  const child = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, NODE_ENV: 'test', HOST: '127.0.0.1', PORT: '0', ALLOWED_ORIGINS: 'http://beaververse.test' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let endpoint, log = '';
  child.stdout.on('data', data => { log += data; const match = log.match(/http:\/\/127\.0\.0\.1:(\d+)/); if (match) endpoint = `ws://127.0.0.1:${match[1]}/room`; });
  const clients = [];
  t.after(() => { clients.forEach(c => c.ws.terminate()); child.kill(); });
  await until(() => endpoint);
  const connect = async (room = 'one') => {
    const ws = new WebSocket(endpoint, { origin: 'http://beaververse.test' }); const messages = []; const c = { ws, messages, closeCode: null };
    clients.push(c); ws.on('message', raw => messages.push(JSON.parse(raw))); ws.on('close', code => { c.closeCode = code; }); ws.on('error', () => {});
    await until(() => ws.readyState === WebSocket.OPEN);
    c.send = message => ws.send(JSON.stringify(message));
    c.send({ type: 'join', name: 'Probe', room, color: 'moss' });
    c.id = (await until(() => messages.find(m => m.type === 'welcome'))).id; return c;
  };
  const a = await connect(), b = await connect(), c = await connect('two');
  a.send({ type: 'chat', text: 'hello-room-one' });
  await until(() => b.messages.some(m => m.type === 'chat'));
  assert.equal(c.messages.some(m => m.type === 'chat'), false);
  a.send({ type: 'signal', to: b.id, signal: { kind: 'description', description: { type: 'offer', sdp: 'v=0' } } });
  await until(() => a.messages.some(m => m.message === 'Voice recipient unavailable'));
  for (const p of [a, b, c]) p.send({ type: 'voice', enabled: true });
  await until(() => c.messages.some(m => m.type === 'voice-state' && m.enabled));
  a.send({ type: 'signal', to: c.id, signal: { kind: 'description', description: { type: 'offer', sdp: 'v=0' } } });
  await pause(100); assert.equal(c.messages.some(m => m.type === 'signal'), false);
  a.send({ type: 'signal', to: b.id, signal: { kind: 'description', description: { type: 'offer', sdp: 'v=0' } } });
  await until(() => b.messages.some(m => m.type === 'signal' && m.from === a.id));
  for (let i = 0; i < 6; i++) a.send({ type: 'wave' });
  a.send({ type: 'voice', enabled: false }); await until(() => a.messages.some(m => m.type === 'voice-state' && !m.enabled));
  a.send({ type: 'join', name: 'Crash probe', room: { toString: null }, color: 'moss' });
  await until(() => a.messages.some(m => m.message === 'Invalid message'));
  const healthy = await connect('after-malformed'); assert.ok(healthy.id);
  healthy.ws.send('x'.repeat(20000)); await until(() => healthy.closeCode); assert.equal(healthy.closeCode, 1009);
  const flood = await connect('flood'); for (let i = 0; i < 80; i++) flood.send({ type: 'move', x: 0, z: 6, yaw: 0 });
  await until(() => flood.closeCode); assert.equal(flood.closeCode, 1008);
  const originResponse = await new Promise(resolve => { const ws = new WebSocket(endpoint, { origin: 'https://unrelated.example' }); ws.on('unexpected-response', (_, response) => { resolve(response.statusCode); response.resume(); ws.terminate(); }); ws.on('error', () => {}); });
  assert.equal(originResponse, 403);
});
