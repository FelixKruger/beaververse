import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { SPAWN } from '../shared/world.js';

const url = process.env.TEST_URL || 'http://127.0.0.1:8788';
const cameraAngle = -.35;
const output = process.env.TEST_ARTIFACT_DIR || 'artifacts';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const errors = [], failedAssets = [], evidence = { browser: browser.version(), url, platform: 'Windows; isolated headless desktop Chrome; mobile viewport is emulation only' };
const delay = ms => new Promise(r => setTimeout(r, ms));
const snapshot = p => p.evaluate(() => window.__beaververse.snapshot());
async function waitFor(fn, label, seconds = 10) { const start = Date.now(); while (Date.now() - start < seconds * 1000) { if (await fn()) return; await delay(150); } throw new Error(`Timed out: ${label}`); }
async function page(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'], ...options });
  const p = await context.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('response', r => { if (r.status() >= 400 && /assets\//.test(r.url())) failedAssets.push(r.url()); });
  await p.goto(url); await p.waitForFunction(() => window.__beaververse, { timeout: 20000 }); return p;
}
async function enter(p, name) { await p.locator('#name').fill(name); await p.locator('#enter').click(); await waitFor(async () => (await snapshot(p)).connected, 'room join'); }
async function hold(p, key, ms) { await p.locator('#world').focus(); await p.keyboard.down(key); await delay(ms); await p.keyboard.up(key); await delay(200); }
async function walkTo(p, x, z) {
  await p.locator('#world').focus(); const end = Date.now() + 12000;
  while (Date.now() < end) {
    const pos = (await snapshot(p)).position, dx = x - pos.x, dz = z - pos.z;
    if (Math.hypot(dx, dz) < .25) return;
    const ix = dx * Math.cos(cameraAngle) - dz * Math.sin(cameraAngle), iy = dx * Math.sin(cameraAngle) + dz * Math.cos(cameraAngle);
    const keys = [];
    if (Math.abs(ix) > .16) keys.push(ix > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(iy) > .16) keys.push(iy > 0 ? 'KeyS' : 'KeyW');
    for (const key of keys) await p.keyboard.down(key);
    await delay(55);
    for (const key of keys) await p.keyboard.up(key);
  }
  throw new Error(`Could not walk to ${x},${z}: ${JSON.stringify((await snapshot(p)).position)}`);
}
async function touchTo(p, cdp, x, z) {
  const box = await p.locator('#joystick').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  try {
    const end = Date.now() + 12000;
    while (Date.now() < end) {
      const pos = (await snapshot(p)).position, dx = x - pos.x, dz = z - pos.z;
      if (Math.hypot(dx, dz) < .25) return;
      const ix = dx * Math.cos(cameraAngle) - dz * Math.sin(cameraAngle), iy = dx * Math.sin(cameraAngle) + dz * Math.cos(cameraAngle), magnitude = Math.max(1, Math.hypot(ix, iy));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + 38 * ix / magnitude, y: cy + 38 * iy / magnitude }] });
      await delay(80);
    }
    throw new Error(`Could not touch-walk to ${x},${z}: ${JSON.stringify((await snapshot(p)).position)}`);
  } finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
}
try {
  const a = await page(); await a.screenshot({ path: `${output}/entry-desktop.png` }); await enter(a, 'Ash');
  const b = await page(); await enter(b, 'Fern');
  await waitFor(async () => (await snapshot(a)).players.length === 2 && (await snapshot(b)).players.length === 2, 'independent context presence');
  for (const p of [a, b]) { const pos = (await snapshot(p)).position; assert.ok(Math.hypot(pos.x - SPAWN.x, pos.z - SPAWN.z) < .01, 'client/server agree on arrival'); }
  const initial = await snapshot(a); await hold(a, 'KeyD', 650); const moved = await snapshot(a);
  assert.ok(Math.hypot(moved.position.x - initial.position.x, moved.position.z - initial.position.z) > 1, 'keyboard moves player');
  await waitFor(async () => { const other = (await snapshot(b)).players.find(p => p.id === moved.id); return other && Math.abs(other.x - moved.position.x) < .25; }, 'other session sees movement');
  await a.locator('#chat-toggle').click(); await a.locator('#chat-input').fill('<img src=x onerror=alert(1)> hello lodge'); await a.locator('#chat-form button').click();
  await waitFor(async () => (await b.locator('#messages').textContent()).includes('<img src=x onerror=alert(1)> hello lodge'), 'cross-context chat');
  assert.equal(await b.locator('#messages img').count(), 0, 'chat remains inert text');
  const typingStart = (await snapshot(a)).position; await a.locator('#chat-input').focus(); await a.keyboard.type('wwwwaaaa'); await delay(300);
  assert.ok(Math.hypot((await snapshot(a)).position.x - typingStart.x, (await snapshot(a)).position.z - typingStart.z) < .1, 'typing does not move avatar');
  await a.locator('#close-chat').click(); await a.locator('#wave').click();
  await waitFor(async () => (await snapshot(b)).players.some(p => p.id === moved.id && p.wave > 0), 'wave sync');
  assert.equal((await a.evaluate(() => window.__beaververse.voiceStats())).capturing, false, 'mic off before opt-in');
  await a.locator('#voice').click(); await b.locator('#voice').click();
  await waitFor(async () => { const s = await b.evaluate(() => window.__beaververse.voiceStats()); return s.peers.some(p => p.state === 'connected' && p.inboundAudio.some(r => r.bytesReceived > 0)); }, 'real WebRTC synthetic audio received', 15);
  evidence.voiceSynthetic = await b.evaluate(() => window.__beaververse.voiceStats());
  await a.locator('#voice').click(); assert.equal((await a.evaluate(() => window.__beaververse.voiceStats())).capturing, false, 'leave stops capture');
  await b.locator('#voice').click();
  await a.screenshot({ path: `${output}/two-player-desktop.png` });
  evidence.desktop = await snapshot(a);
  for (const [x,z] of [[3,10.5],[6,10.5],[6,9.5]]) await walkTo(a,x,z);
  await a.screenshot({path:`${output}/ramp-toe-desktop.png`});
  for (const [x,z] of [[6,8],[6,-1.5]]) await walkTo(a,x,z);
  assert.ok((await snapshot(a)).position.y >= 3.19, 'canopy deck is reachable with actual keys');
  await a.screenshot({path:`${output}/canopy-deck.png`}); evidence.canopyDeck = (await snapshot(a)).position;
  for (const [x,z] of [[8,-2.7],[10.2,-3.2]]) await walkTo(a,x,z);
  await a.screenshot({path:`${output}/workshop-door-desktop.png`}); evidence.workshopDoor = (await snapshot(a)).position;
  await waitFor(async () => { const local = (await snapshot(a)).position, other = (await snapshot(b)).players.find(p => p.id === moved.id); return other && Math.hypot(other.x-local.x,other.z-local.z) < .25; }, 'second client sees workshop arrival');
  for (const [x,z] of [[8,-2.7],[6,-1.5],[6,1],[6,10.5],[0,10.5]]) await walkTo(a,x,z);
  assert.equal((await snapshot(a)).position.y, 0, 'descent returns to ground');
  await a.screenshot({path:`${output}/return-desktop.png`});
  await b.context().close(); await waitFor(async () => (await snapshot(a)).players.length === 1, 'disconnect clears presence');
  const mobile = await page({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await mobile.screenshot({ path: `${output}/entry-mobile.png` }); await enter(mobile, 'River');
  assert.ok(await mobile.locator('#joystick').isVisible(), 'touch control visible');
  const beforeTouch = (await snapshot(mobile)).position;
  const j = await mobile.locator('#joystick').boundingBox();
  const cdp = await mobile.context().newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: j.x + 56, y: j.y + 56 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: j.x + 87, y: j.y + 56 }] });
  await delay(600); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const afterTouch = (await snapshot(mobile)).position;
  assert.ok(Math.hypot(afterTouch.x - beforeTouch.x, afterTouch.z - beforeTouch.z) > .7, 'touch pointer moves player');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no mobile horizontal overflow');
  await mobile.screenshot({ path: `${output}/world-mobile.png` }); evidence.mobileEmulation = await snapshot(mobile);
  for (const [x,z] of [[3,10.5],[6,10.5],[6,9.5]]) await touchTo(mobile,cdp,x,z);
  await mobile.screenshot({path:`${output}/ramp-toe-mobile.png`});
  for (const [x,z] of [[6,8],[6,-1.5]]) await touchTo(mobile,cdp,x,z);
  assert.ok((await snapshot(mobile)).position.y >= 3.19, 'touch movement reaches raised landing');
  await mobile.screenshot({path:`${output}/canopy-mobile.png`});
  for (const [x,z] of [[8,-2.7],[10.2,-3.2]]) await touchTo(mobile,cdp,x,z);
  await mobile.screenshot({path:`${output}/workshop-door-mobile.png`}); evidence.touchWorkshopDoor = (await snapshot(mobile)).position;
  for (const [x,z] of [[8,-2.7],[6,-1.5],[6,1],[6,10.5],[0,10.5]]) await touchTo(mobile,cdp,x,z);
  assert.equal((await snapshot(mobile)).position.y, 0, 'touch descent returns to ground');
  await mobile.screenshot({path:`${output}/return-mobile.png`});
  evidence.errors = errors; evidence.failedAssets = failedAssets;
  assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
  evidence.result = 'PASS'; evidence.checks = ['entry/assets', 'two independent browser contexts', 'client/server spawn agreement', 'keyboard movement sync', 'chat inert text', 'typing guards', 'wave', 'mic default off', 'WebRTC synthetic audio bytes received', 'mic stopped on leave', 'keyboard arrival/ramp/landing/doorstep/return', 'second client sees workshop arrival', 'presence removal', '390x844 layout', 'touch arrival/ramp/landing/doorstep/return'];
} catch (error) { evidence.result = 'FAIL'; evidence.failure = error.stack; evidence.errors = errors; throw error; }
finally { await writeFile(`${output}/browser-verification.json`, JSON.stringify(evidence, null, 2)); await browser.close(); console.log(JSON.stringify(evidence, null, 2)); }
