import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:8798';
const output = process.env.TEST_ARTIFACT_DIR || 'artifacts/workshop-verification';
const speed = Number(process.env.TEST_WALK_SPEED || 4.3);
const snap = p => p.evaluate(() => window.__beaververse.snapshot());
const delay = ms => new Promise(r => setTimeout(r, ms));
const report = { url: base, checks: [], errors: [], result: 'FAIL', evidence: 'Disposable Chrome profiles and real keyboard input; no human microphone or physical phone.' };
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function join(name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await context.newPage(); p.on('pageerror', e => report.errors.push(e.message));
  await p.goto(`${base}/?room=workshop-verification`);
  await p.waitForFunction(() => window.__beaververse, { timeout: 30000 });
  await p.locator('#name').fill(name); await p.locator('#enter').click();
  await p.waitForFunction(() => window.__beaververse.snapshot().connected); return p;
}
async function walk(p, x, z) {
  await p.locator('#world').focus(); const end = Date.now() + 52000 / Math.min(1, speed);
  while (Date.now() < end) {
    const pos = (await snap(p)).position, dx = x - pos.x, dz = z - pos.z;
    if (Math.hypot(dx, dz) < .24) return;
    const ix = dx * Math.cos(-.35) - dz * Math.sin(-.35), iy = dx * Math.sin(-.35) + dz * Math.cos(-.35);
    const keys = [];
    if (Math.abs(ix) > .15) keys.push(ix > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(iy) > .15) keys.push(iy > 0 ? 'KeyS' : 'KeyW');
    for (const k of keys) await p.keyboard.down(k);
    await delay(65);
    for (const k of keys) await p.keyboard.up(k);
  }
  throw new Error(`Route blocked at ${JSON.stringify((await snap(p)).position)}`);
}
try {
  const a = await join('Workshop visitor'), b = await join('Neighbor');
  await a.waitForFunction(() => window.__beaververse.snapshot().players.length === 2);
  assert.equal(await a.locator('#workshop-button').isVisible(), false, 'prompt belongs to the workshop, not spawn');
  for (const [x,z] of [[3,10.5],[6,10.5],[6,9.5],[6,8],[6,-1.5],[8,-2.7],[10.2,-3.2]]) await walk(a,x,z);
  await a.locator('#workshop-button').waitFor({ state: 'visible' });
  report.arrival = (await snap(a)).position;
  const peerMessages = await b.locator('#messages').textContent();
  await a.locator('#chat-toggle').click(); await a.locator('#chat-input').fill('Existing unsent thought'); await a.locator('#close-chat').click();
  await a.locator('#workshop-button').click();
  const before = (await snap(a)).position;
  await a.keyboard.down('KeyW'); await delay(350); await a.keyboard.up('KeyW');
  assert.deepEqual((await snap(a)).position, before, 'modal does not move the player');
  await a.locator('#workshop-chat').click();
  await a.locator('#chat-input').waitFor({ state: 'visible' });
  assert.equal(await a.locator('#chat-input').inputValue(), 'Existing unsent thought');
  await delay(200);
  assert.equal(await a.evaluate(() => document.activeElement.id), 'chat-input', 'focus reaches destination after native close');
  assert.equal(await b.locator('#messages').textContent(), peerMessages, 'draft action does not send');
  await a.locator('#chat-input').fill(''); await a.locator('#close-chat').click();
  await a.locator('#workshop-button').click(); await a.locator('[data-workshop-prompt="1"]').click(); await a.locator('#workshop-chat').click();
  await a.waitForFunction(() => document.querySelector('#chat-input').value.startsWith("I'm trying"));
  await a.locator('#chat-input').fill('I need a second pair of eyes on my project.');
  assert.equal(await b.locator('#messages').textContent(), peerMessages, 'new prompt is still a draft');
  await a.locator('#chat-form button').click();
  await b.waitForFunction(() => document.querySelector('#messages').textContent.includes('second pair of eyes'));
  report.checks.push('real arrival route and spatial trigger; modal movement guard; existing chat preserved; focus handoff; only explicit send reaches peer');
  await a.locator('#close-chat').click();
  await a.locator('#workshop-button').click(); await a.locator('#workshop-takeaway').click();
  await a.locator('#takeaway').waitFor({ state: 'visible' });
  assert.match(await a.locator('#takeaway').inputValue(), /Question I explored/);
  assert.equal(await a.evaluate(() => localStorage.getItem('beaververse.visit-notes.v1')), null, 'takeaway is not auto-saved');
  await a.locator('#takeaway').fill('My private unfinished takeaway'); await a.locator('#close-community').click();
  await a.locator('#workshop-button').click(); await a.locator('[data-workshop-prompt="2"]').click(); await a.locator('#workshop-takeaway').click();
  await a.locator('#takeaway').waitFor({ state: 'visible' });
  assert.equal(await a.locator('#takeaway').inputValue(), 'My private unfinished takeaway');
  await a.locator('#note-save').click();
  assert.equal(await a.evaluate(() => JSON.parse(localStorage.getItem('beaververse.visit-notes.v1'))[0].takeaway), 'My private unfinished takeaway');
  assert.equal(await b.evaluate(() => localStorage.getItem('beaververse.visit-notes.v1')), null);
  assert.equal((await b.locator('#messages').textContent()).includes('private unfinished'), false);
  report.checks.push('takeaway draft is editable and unsaved; prior draft survives; explicit local save only; peer cannot read private takeaway');
  await a.locator('#close-community').click();
  await a.setViewportSize({ width: 390, height: 844 }); await a.locator('#workshop-button').click();
  assert.equal(await a.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  for (const id of ['workshop-chat', 'workshop-takeaway', 'close-workshop']) {
    const r = await a.locator(`#${id}`).boundingBox(); assert.ok(r.x >= 0 && r.x+r.width <= 390 && r.y >= 0 && r.y+r.height <= 844, `${id} reachable at phone width`);
  }
  await a.screenshot({ path: `${output}/workshop-phone.png` });
  await a.locator('#close-workshop').click(); await a.locator('#leave').click(); await a.locator('#skip-visit').click();
  await a.locator('#entry').waitFor({ state: 'visible' });
  await b.waitForFunction(() => window.__beaververse.snapshot().players.length === 1);
  report.checks.push('phone-width dialog controls fit; leave requires no feedback and removes presence');
  assert.deepEqual(report.errors, []); report.result = 'PASS';
} catch (e) { report.failure = e.stack; throw e; }
finally { await writeFile(`${output}/workshop-verification.json`, JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report, null, 2)); }
