import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = 'artifacts/2026-11-13-hosting';
await mkdir(output, { recursive: true });
let child, browser;
const result = { checks: [], errors: [] };
async function start(port = 0) {
  child = spawn(process.execPath, ['--input-type=module', '-e', "import {shutdown} from './server/index.js'; process.on('message', () => { shutdown(); process.disconnect(); });"], {
    env: { ...process.env, NODE_ENV: 'test', HOST: '127.0.0.1', PORT: String(port), ALLOWED_ORIGINS: port ? `http://127.0.0.1:${port}` : 'http://127.0.0.1:8791' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Local server startup timeout')), 10000);
    let log = ''; child.stdout.on('data', chunk => { log += chunk; const match = log.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('Server stopped before ready')); });
  });
}
try {
  const url = await start(8791);
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const pages = [];
  for (const name of ['Ash', 'Fern']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
    const page = await context.newPage(); page.on('pageerror', error => result.errors.push(error.message));
    await page.goto(url); await page.waitForFunction(() => window.__beaververse);
    await page.locator('#name').fill(name); await page.locator('#enter').click();
    await page.waitForFunction(() => window.__beaververse.snapshot().connected); pages.push(page);
  }
  const [a, b] = pages, oldId = await a.evaluate(() => window.__beaververse.snapshot().id);
  await a.locator('#voice').click();
  await a.waitForFunction(async () => (await window.__beaververse.voiceStats()).capturing);
  const exited = once(child, 'exit'); child.send('shutdown'); await exited;
  await a.waitForFunction(async () => !window.__beaververse.snapshot().connected && !(await window.__beaververse.voiceStats()).capturing);
  result.checks.push('actual server shutdown disconnects browser and stops synthetic microphone capture');
  await start(8791);
  for (const page of pages) await page.waitForFunction(() => window.__beaververse.snapshot().connected && window.__beaververse.snapshot().players.length === 2, undefined, { timeout: 20000 });
  const state = await a.evaluate(() => window.__beaververse.snapshot());
  assert.notEqual(state.id, oldId); assert.equal(state.players.length, 2);
  assert.equal((await a.evaluate(() => window.__beaververse.voiceStats())).capturing, false);
  await a.locator('#world').focus(); await a.keyboard.down('KeyD'); await a.waitForTimeout(500); await a.keyboard.up('KeyD');
  await b.waitForFunction(id => { const s = window.__beaververse.snapshot(), p = s.players.find(p => p.id === id); return p && Math.abs(p.x) > .8; }, state.id);
  await a.screenshot({ path: `${output}/reconnected-desktop.png` });
  result.checks.push('both browsers automatically rejoin with new identities; microphone stays off; movement synchronizes after restart');
  assert.deepEqual(result.errors, []); result.result = 'PASS';
} catch (error) { result.result = 'FAIL'; result.failure = error.stack; throw error; }
finally {
  await browser?.close();
  if (child?.connected) { const exited = once(child, 'exit'); child.send('shutdown'); await exited; }
  else child?.kill();
  await writeFile(`${output}/reconnect-verification.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
}
