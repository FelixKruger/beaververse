import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { bucket, consume, validMessage } from './protocol.js';
import { SPAWN, stepPosition } from '../shared/world.js';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.png': 'image/png', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 8788);
const origins = (process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8788,http://localhost:8788').split(',');
export const server = http.createServer(async (req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, service: 'beaververse', rooms: rooms.size })); return; }
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    const filename = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!filename.startsWith(root + sep) || !(await stat(filename)).isFile()) throw new Error('missing');
    res.writeHead(200, { 'Content-Type': types[extname(filename)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(), microphone=(self)', 'Referrer-Policy': 'no-referrer' });
    createReadStream(filename).pipe(res);
  } catch { res.writeHead(404); res.end('Not found. Run npm run build first.'); }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 16384 });
const rooms = new Map();
server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/room' || !origins.includes(req.headers.origin) || wss.clients.size >= 96) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
});
const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 65536) ws.send(JSON.stringify(data)); };
const broadcast = (room, data) => { for (const p of rooms.get(room)?.values() || []) send(p.ws, data); };
const publicPlayer = p => ({ id: p.id, name: p.name, color: p.color, x: p.x, z: p.z, yaw: p.yaw, voice: p.voice, wave: p.wave });
wss.on('connection', ws => {
  let player;
  let alive = true;
  const traffic = bucket(60, 35), social = bucket(4, 1), media = bucket(40, 20);
  const joinTimer = setTimeout(() => { if (!player) ws.close(1008, 'Join required'); }, 5000);
  ws.on('pong', () => { alive = true; });
  const heartbeat = setInterval(() => { if (!alive) return ws.terminate(); alive = false; ws.ping(); }, 30000);
  ws.on('message', (bytes, binary) => {
    const now = Date.now();
    if (binary || !consume(traffic, now)) { ws.close(1008, 'Message limit'); return; }
    let m;
    try { m = JSON.parse(bytes.toString()); } catch { send(ws, { type: 'error', message: 'Invalid JSON' }); return; }
    if (!validMessage(m)) { send(ws, { type: 'error', message: 'Invalid message' }); return; }
    if (m.type === 'join') {
      if (player) { send(ws, { type: 'error', message: 'Already joined' }); return; }
      const room = rooms.get(m.room) || new Map();
      if (room.size >= 12) { ws.close(1008, 'Room full'); return; }
      player = { id: randomUUID(), name: m.name.trim() || 'Beaver', color: m.color, room: m.room, ws, ...SPAWN, yaw: 0, voice: false, wave: 0, moved: now };
      room.set(player.id, player); rooms.set(m.room, room); clearTimeout(joinTimer);
      send(ws, { type: 'welcome', id: player.id, room: player.room, players: [...room.values()].map(publicPlayer) });
      broadcast(player.room, { type: 'notice', text: `${player.name} joined the clearing.` });
      return;
    }
    if (!player) { send(ws, { type: 'error', message: 'Join first' }); return; }
    if (m.type === 'move') {
      const limit = Math.min(0.3, (now - player.moved) / 1000) * 5.5;
      const dx = m.x - player.x, dz = m.z - player.z, length = Math.hypot(dx, dz);
      const ratio = length > limit ? limit / length : 1;
      Object.assign(player, stepPosition(player, dx * ratio, dz * ratio));
      player.yaw = m.yaw % 360; player.moved = now;
    } else if (m.type === 'signal') {
      const target = rooms.get(player.room)?.get(m.to);
      if (!player.voice || !target?.voice || target.id === player.id || !consume(media, now)) { send(ws, { type: 'error', message: 'Voice recipient unavailable' }); return; }
      send(target.ws, { type: 'signal', from: player.id, signal: m.signal });
    } else if (m.type === 'voice') {
      if (m.enabled && !player.voice && [...rooms.get(player.room).values()].filter(p => p.voice).length >= 6) { send(ws, { type: 'voice-state', enabled: false, message: 'Voice circle is full (6)' }); return; }
      player.voice = m.enabled;
      send(ws, { type: 'voice-state', enabled: player.voice });
    } else {
      if (!consume(social, now)) { send(ws, { type: 'error', message: 'Please slow down' }); return; }
      if (m.type === 'chat') broadcast(player.room, { type: 'chat', id: player.id, name: player.name, text: m.text.trim() });
      if (m.type === 'wave') player.wave = now;
    }
  });
  ws.on('error', () => {});
  ws.on('close', () => {
    clearInterval(heartbeat); clearTimeout(joinTimer);
    if (!player) return;
    const room = rooms.get(player.room); room?.delete(player.id);
    broadcast(player.room, { type: 'notice', text: `${player.name} left the clearing.` });
    if (room?.size === 0) rooms.delete(player.room);
  });
});
const snapshots = setInterval(() => { for (const [name, room] of rooms) broadcast(name, { type: 'state', players: [...room.values()].map(publicPlayer) }); }, 100);
server.on('close', () => clearInterval(snapshots));
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Beaververse server http://${process.env.HOST || '127.0.0.1'}:${server.address().port} · static build ${existsSync(root) ? 'present' : 'not yet built'}`));
