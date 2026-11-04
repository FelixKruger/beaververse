import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const url = process.argv[2] || 'https://felixkruger.github.io/beaververse/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const evidence = { url, browser: browser.version(), checkedAt: new Date().toISOString(), assets: [], errors: [] };
const pending = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', e => evidence.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') evidence.errors.push(m.text()); });
  page.on('response', response => {
    if (response.url().includes('/assets/')) pending.push((async () => { const body = await response.body(); evidence.assets.push({ path: new URL(response.url()).pathname, status: response.status(), mime: response.headers()['content-type'], bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') }); })());
  });
  const response = await page.goto(url + '?verify=' + Date.now()); assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.__beaververse, { timeout: 20000 });
  await page.screenshot({ path: 'artifacts/public-entry-desktop.png' });
  await page.locator('#name').fill('Trail visitor'); await page.locator('#enter').click();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('#connection').textContent(), 'Solo preview');
  const before = await page.evaluate(() => window.__beaververse.snapshot());
  await page.keyboard.down('KeyD'); await page.waitForTimeout(450); await page.keyboard.up('KeyD');
  const after = await page.evaluate(() => window.__beaververse.snapshot());
  assert.ok(Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z) > 1);
  assert.equal(after.connected, false); assert.equal(after.loadedAssets, 12);
  await page.screenshot({ path: 'artifacts/public-world-desktop.png' });
  await page.locator('#voice').click();
  assert.equal((await page.evaluate(() => window.__beaververse.voiceStats())).capturing, false);
  assert.match(await page.locator('#speech').textContent(), /connected room/);
  evidence.desktop = after;
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const mobile = await mobileContext.newPage(); await mobile.goto(url);
  await mobile.waitForFunction(() => window.__beaververse); await mobile.locator('#name').fill('River'); await mobile.locator('#enter').click(); await mobile.waitForTimeout(500);
  assert.ok(await mobile.locator('#joystick').isVisible());
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await mobile.screenshot({ path: 'artifacts/public-world-mobile.png' });
  evidence.mobileEmulation = await mobile.evaluate(() => window.__beaververse.snapshot());
  await Promise.all(pending);
  assert.ok(evidence.assets.length > 20); assert.ok(evidence.assets.every(a => a.status === 200 && a.bytes > 100));
  assert.ok(evidence.assets.filter(a => /\.(png)$/.test(a.path)).every(a => a.mime.startsWith('image/')));
  assert.deepEqual(evidence.errors, []); evidence.result = 'PASS';
} catch (error) { evidence.result = 'FAIL'; evidence.failure = error.stack; throw error; }
finally { await writeFile('artifacts/public-verification.json', JSON.stringify(evidence, null, 2)); await browser.close(); console.log(JSON.stringify({ ...evidence, assets: evidence.assets.length }, null, 2)); }
