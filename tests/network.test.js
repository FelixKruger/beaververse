import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/network.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replaceAll('import.meta.env', '({})');
const { RoomConnection } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('transient disconnect retries, stale sockets cannot rejoin, policy rejection and explicit leave stop retries', () => {
  const originals = new Map(['window', 'location', 'WebSocket'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let timerId = 0; const timers = new Map(), sockets = [], states = [], welcomes = [];
  class Socket {
    static OPEN = 1; readyState = 0; sent = [];
    constructor() { sockets.push(this); }
    send(data) { this.sent.push(JSON.parse(data)); }
    open() { this.readyState = 1; this.onopen?.(); }
    message(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
    close(code = 1000) { this.readyState = 3; this.onclose?.({ code }); }
  }
  const runRetry = () => { assert.equal(timers.size, 1); const [id, timer] = [...timers][0]; assert.ok(timer.delay <= 30500); timers.delete(id); timer.fn(); };
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id) } });
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { hostname: 'localhost', protocol: 'http:', host: 'localhost:8788' } });
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: Socket });
    const room = new RoomConnection({ status: state => states.push(state), welcome: id => welcomes.push(id), state: () => {}, message: () => {} });
    room.connect('Ash', 'woodland', 'moss'); const first = sockets[0]; first.open();
    first.message({ type: 'welcome', id: 'one', players: [] }); assert.ok(room.connected);
    first.close(1012); assert.equal(room.connected, false); assert.equal(states.at(-1), 'offline');
    runRetry(); const second = sockets[1]; assert.equal(states.at(-1), 'reconnecting'); second.open();
    assert.deepEqual(second.sent, [{ type: 'join', name: 'Ash', room: 'woodland', color: 'moss' }]);
    first.message({ type: 'welcome', id: 'stale', players: [] }); assert.deepEqual(welcomes, ['one']);
    second.message({ type: 'welcome', id: 'two', players: [] }); assert.equal(room.id, 'two');
    second.close(1008); assert.equal(timers.size, 0, 'policy rejection is not retried');
    room.connect('Ash', 'woodland', 'moss'); sockets.at(-1).close(1006); assert.equal(timers.size, 1);
    room.close(); assert.equal(timers.size, 0); assert.equal(room.connected, false);
    room.connect('Ash', 'woodland', 'moss');
    for (let i = 0; i < 9; i++) { sockets.at(-1).close(1006); runRetry(); }
    room.close(); assert.equal(timers.size, 0);
  } finally { for (const [key, original] of originals) { if (original) Object.defineProperty(globalThis, key, original); else delete globalThis[key]; } }
});
