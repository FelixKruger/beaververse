import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:8798';
const output = process.env.TEST_ARTIFACT_DIR || 'artifacts/2026-11-17-evolution';
await mkdir(output, { recursive: true });
// Disposable profiles, synthetic local interactions only. No operator tabs or microphone.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { url: base, route: 'isolated headless Chrome; fixture data only; mobile emulation, not a physical phone', checks: [], errors: [] };
const contexts = [];
async function join(name, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile }); contexts.push(context);
  const page = await context.newPage(); page.on('pageerror', e => result.errors.push(e.message));
  await page.goto(base + '/?room=evolution-test');
  await page.waitForFunction(() => window.__beaververse, { timeout: 30000 });
  await page.locator('#name').fill(name); await page.locator('#enter').click();
  await page.waitForFunction(() => window.__beaververse.snapshot().connected);
  return page;
}
const snap = page => page.evaluate(() => window.__beaververse.snapshot());
try {
  const a = await join('Builder'), b = await join('Neighbor');
  await a.locator('#community-button').click();
  await a.locator('#takeaway').fill('PRIVATE TAKEAWAY: fixture only');
  await a.locator('#world-suggestion').fill('Make a shared lantern garden');
  await a.locator('[name=valuable][value=yes]').check(); await a.locator('#donate-feedback').check();
  await a.locator('#note-save').click();
  assert.match(await a.locator('#note-count').innerText(), /^1 saved/);
  const downloadEvent = a.waitForEvent('download'); await a.locator('#export-feedback').click(); const file = await downloadEvent;
  const exported = JSON.parse(await readFile(await file.path(), 'utf8'));
  assert.equal(JSON.stringify(exported).includes('PRIVATE'), false); assert.equal(exported.notes[0].suggestion, 'Make a shared lantern garden');
  const position = (await snap(a)).position; await a.locator('#takeaway').focus(); await a.keyboard.type('wasd');
  assert.deepEqual((await snap(a)).position, position);
  assert.equal(await b.evaluate(() => localStorage.getItem('beaververse.visit-notes.v1')), null);
  result.checks.push('voluntary save/export with private takeaway excluded; separate browser storage; dialog typing does not move player');
  await a.locator('[data-community-tab=garden]').click(); await a.locator('#garden-form button[type=submit]').click();
  await a.waitForFunction(() => document.querySelector('#community-status').textContent.includes('shared garden'));
  // Server-backed creation is confirmed from the agent API below and visually in this screenshot.
  await a.locator('#close-community').click(); await a.screenshot({ path: `${output}/world-garden.png` });
  await a.locator('#community-button').click(); await a.locator('[data-community-tab=agent]').click(); await a.locator('#agent-propose').check(); await a.locator('#create-invite').click();
  await a.waitForFunction(() => !document.querySelector('#agent-instruction').hidden);
  const instruction = await a.locator('#agent-instruction').inputValue();
  const code = instruction.match(/code: ([A-Za-z0-9_-]{43})/)[1];
  const pairedResponse = await fetch(base + '/api/agents/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
  assert.equal(pairedResponse.status, 201); const paired = await pairedResponse.json();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${paired.token}` };
  await b.waitForFunction(() => window.__beaververse.snapshot().players.some(p => p.agent));
  const state = await (await fetch(base + '/api/agents/state', { headers })).json(); assert.equal(state.creations.length, 1);
  const denied = await fetch(base + '/api/agents/action', { method: 'POST', headers, body: JSON.stringify({ type: 'move', dx: 1, dz: 0 }) }); assert.equal(denied.status, 403);
  const proposed = await fetch(base + '/api/agents/action', { method: 'POST', headers, body: JSON.stringify({ type: 'propose', creation: { kind: 'lantern', plot: 1 } }) }); assert.equal(proposed.status, 202);
  await a.locator('#accept-proposal').click();
  await a.waitForFunction(() => document.querySelector('#agent-proposal').hidden);
  const after = await (await fetch(base + '/api/agents/state', { headers })).json(); assert.equal(after.creations[0].kind, 'lantern'); assert.equal(after.creations[0].plot, 1);
  await a.screenshot({ path: `${output}/companion-controls.png` }); // Invitation already cleared; no credential pixels.
  await a.locator('#revoke-agent').click(); await b.waitForFunction(() => !window.__beaververse.snapshot().players.some(p => p.agent));
  assert.equal((await fetch(base + '/api/agents/state', { headers })).status, 401);
  result.checks.push('human garden placement; agent pairing via real HTTP; labeled peer avatar; denied movement; proposal requires owner click; revoke removes access and avatar');
  await a.locator('[data-community-tab=notes]').click(); await a.locator('#delete-notes').click();
  assert.equal(await a.evaluate(() => JSON.parse(localStorage.getItem('beaververse.visit-notes.v1') || '[]').length), 0);
  await a.locator('#close-community').click(); await a.locator('#leave').click(); await a.locator('#skip-visit').click();
  await a.locator('#entry').waitFor({ state: 'visible' });
  result.checks.push('delete notes; direct leave without feedback');
  // A stale second tab must not resurrect a deleted note or export it.
  await a.locator('#name').fill('Builder'); await a.locator('#enter').click(); await a.locator('#community-button').click();
  await a.locator('#takeaway').fill('DELETE ACROSS TABS'); await a.locator('#note-save').click();
  const sibling = await a.context().newPage(); await sibling.goto(base); await sibling.waitForFunction(() => window.__beaververse, { timeout: 30000 });
  await sibling.locator('#name').fill('Second tab'); await sibling.locator('#enter').click(); await sibling.locator('#community-button').click();
  assert.match(await sibling.locator('#note-count').innerText(), /^1 saved/);
  await a.locator('#delete-notes').click(); await sibling.waitForFunction(() => document.querySelector('#note-count').textContent.startsWith('0 saved'));
  await sibling.locator('#close-community').click(); await sibling.locator('#community-button').click();
  assert.equal(await sibling.evaluate(() => localStorage.getItem('beaververse.visit-notes.v1')), null);
  const deletedExportEvent = sibling.waitForEvent('download'); await sibling.locator('#export-personal').click();
  assert.deepEqual(JSON.parse(await readFile(await (await deletedExportEvent).path(), 'utf8')).notes, []);
  await sibling.close(); result.checks.push('deletion synchronizes across tabs and cannot resurrect or export deleted notes');
  const phone = await join('Phone visitor', true); await phone.locator('#community-button').tap();
  assert.equal(await phone.evaluate(() => document.querySelector('#community').getBoundingClientRect().right <= innerWidth), true);
  await phone.screenshot({ path: `${output}/phone-visit.png` });
  await phone.locator('#close-community').tap();
  const before = (await snap(phone)).position; const joy = await phone.locator('#joystick').boundingBox();
  const cdp = await phone.context().newCDPSession(phone);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: joy.x + joy.width / 2 + 30, y: joy.y + joy.height / 2 }] });
  await phone.waitForFunction(pos => Math.hypot(window.__beaververse.snapshot().position.x - pos.x, window.__beaververse.snapshot().position.z - pos.z) > .1, before);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  result.checks.push('390x844 layout; touch movement after closing dialog');
  assert.deepEqual(result.errors, []); result.result = 'PASS';
} catch (error) { result.result = 'FAIL'; result.failure = error.stack; throw error; }
finally { await writeFile(`${output}/community-browser-verification.json`, JSON.stringify(result, null, 2)); await browser.close(); console.log(JSON.stringify(result, null, 2)); }
