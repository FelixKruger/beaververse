import { chromium } from '@playwright/test';
import { WebSocket } from 'ws';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:8798';
const output = process.env.TEST_ARTIFACT_DIR || 'artifacts/garden-verification';
const room = `garden-${Date.now()}`, peers = [], routes = new Map();
const result = { url: base, mode: 'isolated headless Chrome; actual room WebSockets; phone viewport emulation; controlled transport disconnect', checks: [], errors: [] };
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
async function join(name, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: mobile, isMobile: mobile });
  const p = await context.newPage(); p.on('pageerror', e => result.errors.push(e.message));
  await p.routeWebSocket('**/room', route => { routes.set(p, route); route.connectToServer(); });
  await p.goto(`${base}/?room=${room}`); await p.waitForFunction(() => window.__beaververse, { timeout: 30000 });
  await p.locator('#name').fill(name); await p.locator('#enter').click();
  await p.waitForFunction(() => document.querySelector('#garden-button').textContent.includes('free'));
  return p;
}
async function rawBuilder(plot, name) {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/room', { origin: base }); peers.push(ws);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Raw visitor join timeout')), 5000);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', name, room, color: 'moss' })));
    ws.on('error', reject);
    ws.on('message', raw => { if (JSON.parse(raw).type === 'welcome') { clearTimeout(timer); resolve(); } });
  });
  ws.send(JSON.stringify({ type: 'creation-set', creation: { kind: 'planter', plot } }));
  return ws;
}
const option = (p, n) => p.locator(`#creation-plot option[value="${n}"]`);
async function walkTo(p, x, z) {
  const angle = -.35, end = Date.now() + 12000;
  await p.locator('#world').focus();
  while (Date.now() < end) {
    const pos = await p.evaluate(() => window.__beaververse.snapshot().position);
    const dx = x - pos.x, dz = z - pos.z; if (Math.hypot(dx, dz) < .25) return;
    const ix = dx * Math.cos(angle) - dz * Math.sin(angle), iy = dx * Math.sin(angle) + dz * Math.cos(angle), keys = [];
    if (Math.abs(ix) > .16) keys.push(ix > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(iy) > .16) keys.push(iy > 0 ? 'KeyS' : 'KeyW');
    for (const key of keys) await p.keyboard.down(key); await wait(60);
    for (const key of keys) await p.keyboard.up(key);
  }
  throw new Error('Garden route did not reach its target');
}
try {
  const a = await join('Builder'), b = await join('Builder');
  await a.screenshot({ path: `${output}/arrival.png` });
  assert.equal(await a.locator('.garden-plot-label').count(), 8);
  await a.locator('#garden-button').focus(); await a.keyboard.press('Enter');
  assert.equal(await a.locator('[data-community-panel=garden]').isVisible(), true);
  assert.equal(await a.locator('#remove-creation').isDisabled(), true);
  await a.waitForFunction(() => [...document.querySelectorAll('.garden-plot-label')].every(label => label.hidden));
  assert.equal(await a.locator('.garden-plot-label:visible').count(), 0);
  await b.locator('#garden-button').focus(); await b.keyboard.press('Space');
  assert.equal(await b.locator('[data-community-panel=garden]').isVisible(), true);
  await a.locator('#place-creation').click();
  await a.waitForFunction(() => document.querySelector('#creation-plot option').textContent.includes('Yours'));
  await b.waitForFunction(() => document.querySelector('#creation-plot option').disabled);
  assert.equal(await option(b, 0).innerText(), 'Plot 1 · Taken by Builder');
  assert.equal(await b.locator('#creation-plot').inputValue(), '1');
  assert.equal(await b.locator('#remove-creation').isDisabled(), true);
  await b.locator('#creation-plot').selectOption('4'); await wait(700);
  assert.equal(await b.locator('#creation-plot').inputValue(), '4', 'unrelated snapshots preserve a chosen free plot');
  await b.locator('#place-creation').click();
  await a.waitForFunction(() => document.querySelector('#creation-plot option[value="4"]').disabled);
  await b.locator('#remove-creation').click();
  await a.waitForFunction(() => !document.querySelector('#creation-plot option[value="4"]').disabled);
  result.checks.push('direct Garden entry via Enter/Space; eight numbered markers; markers hide behind modal; two same-named visitors have distinct ownership; live occupancy, stable selection and own removal');
  await a.locator('#creation-kind').selectOption('lantern'); await a.locator('#place-creation').click();
  await a.waitForFunction(() => { const s = window.__beaververse.snapshot(); return s.creations.some(c => c.ownerId === s.id && c.key === 'lantern:0' && c.parts === 3); });
  result.renderedCreation = await a.evaluate(() => window.__beaververse.snapshot().creations);
  await a.locator('#close-community').click();
  await a.locator('#wave').click();
  const beforeWaveWalk = await a.evaluate(() => window.__beaververse.snapshot().position);
  await a.keyboard.down('KeyW'); await wait(400); await a.keyboard.up('KeyW');
  const afterWaveWalk = await a.evaluate(() => window.__beaververse.snapshot().position);
  assert.ok(Math.hypot(beforeWaveWalk.x - afterWaveWalk.x, beforeWaveWalk.z - afterWaveWalk.z) > .5, 'walking still works while the Wave button retains focus');
  await walkTo(a, -4, 10.5); await walkTo(a, -5, 8);
  await a.screenshot({ path: `${output}/garden-in-world.png` });
  assert.ok(await a.locator('.garden-plot-label:visible').count() > 0);
  result.checks.push('walking after clicking Wave; actual keyboard walk from arrival to numbered garden; rendered replacement of own planter with lantern');
  for (let plot = 1; plot < 8; plot++) await rawBuilder(plot, plot === 1 ? '<img src=x onerror=1>' : 'Garden neighbor');
  await b.waitForFunction(() => document.querySelector('#garden-button').textContent.includes('full'));
  assert.equal(await b.locator('#place-creation').isDisabled(), true);
  assert.equal(await b.locator('#creation-plot option:disabled').count(), 8);
  assert.equal(await b.locator('#community img').count(), 0, 'visitor names remain text');
  assert.match(await option(b, 1).innerText(), /Taken by <img src=x onerror=1>/);
  await b.screenshot({ path: `${output}/garden-full.png` });
  await a.locator('#garden-button').click();
  assert.equal(await a.locator('#place-creation').isEnabled(), true, 'owner can still update in a full garden');
  assert.equal(await option(a, 0).isEnabled(), true);
  // Phone enters an already-full garden: first state, not a false claim of empty plots.
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const phone = await phoneContext.newPage(); phone.on('pageerror', e => result.errors.push(e.message));
  await phone.goto(`${base}/?room=${room}`); await phone.waitForFunction(() => window.__beaververse, { timeout: 30000 });
  await phone.locator('#name').fill('Phone visitor'); await phone.locator('#enter').tap();
  await phone.waitForFunction(() => document.querySelector('#garden-button').textContent.includes('full'));
  await phone.locator('#garden-button').tap();
  assert.equal(await phone.locator('#place-creation').isDisabled(), true);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(await phone.evaluate(() => { const d = document.querySelector('#community'); return d.scrollWidth > d.clientWidth; }), false);
  await phone.screenshot({ path: `${output}/garden-phone-full.png` });
  peers.at(-1).close();
  await phone.waitForFunction(() => document.querySelector('#garden-button').textContent.includes('1 free'));
  assert.equal(await phone.locator('#creation-plot').inputValue(), '7');
  await phone.locator('#place-creation').tap();
  await phone.waitForFunction(() => document.querySelector('#creation-plot option[value="7"]').textContent.includes('Yours'));
  await phone.screenshot({ path: `${output}/garden-phone-yours.png` });
  assert.equal((await phone.locator('#place-creation').boundingBox()).height >= 44, true);
  await phone.locator('#close-community').tap();
  const before = await phone.evaluate(() => window.__beaververse.snapshot().position), joy = await phone.locator('#joystick').boundingBox();
  const cdp = await phone.context().newCDPSession(phone);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: joy.x + joy.width / 2 + 30, y: joy.y + joy.height / 2 }] });
  await phone.waitForFunction(pos => Math.hypot(window.__beaververse.snapshot().position.x - pos.x, window.__beaververse.snapshot().position.z - pos.z) > .1, before);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  result.checks.push('full garden disables new contribution but preserves owner replacement; visitor names are inert; peer departure frees a plot; phone finds it, places, closes and resumes touch movement without horizontal overflow');
  await a.context().close();
  await b.waitForFunction(() => !document.querySelector('#creation-plot option[value="0"]').disabled);
  await routes.get(b).close({ code: 1008, reason: 'Local offline fixture' });
  await b.waitForFunction(() => document.querySelector('#garden-state').textContent.startsWith('Connect to the room'));
  assert.equal(await b.locator('#place-creation').isDisabled(), true);
  assert.equal(await b.locator('#remove-creation').isDisabled(), true);
  assert.equal(await b.locator('#creation-plot').isDisabled(), true);
  await b.screenshot({ path: `${output}/garden-offline.png` });
  result.checks.push('owner departure frees their plot; transport disconnect removes live availability claims and disables contribution');
  assert.deepEqual(result.errors, []); result.result = 'PASS';
} catch (error) { result.result = 'FAIL'; result.failure = error.stack; throw error; }
finally { peers.forEach(p => p.close()); await browser.close(); await writeFile(`${output}/verification.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2)); }
