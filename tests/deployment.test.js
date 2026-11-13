import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { serverConfig } from '../server/config.js';

test('production requires explicit exact HTTPS origins and a valid listener port', () => {
  assert.throws(() => serverConfig({ NODE_ENV: 'production' }), /explicit/);
  for (const origin of ['*', 'http://world.example', 'https://world.example/', 'https://world.example/path', 'https://user:pass@world.example', 'null']) {
    assert.throws(() => serverConfig({ NODE_ENV: 'production', ALLOWED_ORIGINS: origin }), /origin|HTTPS/);
  }
  const config = serverConfig({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://world.example, https://other.example', PORT: '10000' });
  assert.deepEqual(config.origins, ['https://world.example', 'https://other.example']);
  assert.equal(config.host, '0.0.0.0'); assert.equal(config.port, 10000);
  assert.throws(() => serverConfig({ PORT: '-1' }), /PORT/);
  assert.equal(serverConfig({}).host, '127.0.0.1');
});

test('HTTP method/security boundary and graceful restart close active sockets', { timeout: 10000 }, async t => {
  const child = spawn(process.execPath, ['--input-type=module', '-e', "import {shutdown} from './server/index.js'; process.on('message', () => { shutdown(); process.disconnect(); });"], {
    env: { ...process.env, NODE_ENV: 'test', HOST: '127.0.0.1', PORT: '0', ALLOWED_ORIGINS: 'http://beaververse.test' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  t.after(() => child.kill());
  const endpoint = await new Promise((resolve, reject) => {
    let log = ''; child.stdout.on('data', data => { log += data; const match = log.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) resolve(match[0]); });
    child.on('error', reject); child.on('exit', () => reject(new Error('Server exited before ready')));
  });
  const response = await fetch(endpoint + '/', { method: 'POST' });
  assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET, HEAD');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  const health = await fetch(endpoint + '/health');
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Object.keys(await health.json()).sort(), ['ok', 'service']);
  const ws = new WebSocket(endpoint.replace('http:', 'ws:') + '/room', { origin: 'http://beaververse.test' });
  t.after(() => ws.terminate()); await once(ws, 'open');
  const closed = once(ws, 'close'), exited = once(child, 'exit');
  child.send('shutdown');
  const [code] = await closed; assert.equal(code, 1012);
  const [exitCode] = await exited; assert.equal(exitCode, 0);
});
