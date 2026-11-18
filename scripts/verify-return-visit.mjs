import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TEST_URL || 'http://127.0.0.1:8798';
const out = process.env.TEST_ARTIFACT_DIR || 'artifacts/return-visit';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { result: 'FAIL', checks: [], errors: [] };
const key = 'beaververse.visit-notes.v1';
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on('pageerror', e => result.errors.push(e.message));
  const join = async () => {
    await page.goto(base + '/?room=return-visit');
    await page.waitForFunction(() => window.__beaververse);
    await page.locator('#name').fill('Returning builder'); await page.locator('#enter').click();
    await page.waitForFunction(() => window.__beaververse.snapshot().connected);
    await page.locator('#community-button').click();
  };
  await join();
  assert.equal(await page.locator('#return-thread').isVisible(), false);
  const thought = 'Try a small AI tool with a neighbor. <img src=x onerror="window.leaked=true">';
  await page.locator('#takeaway').fill(thought); await page.locator('#note-save').click();
  await join(); // Actual new page in the same browser profile.
  assert.equal(await page.locator('#return-takeaway').textContent(), thought);
  assert.equal(await page.locator('#return-takeaway img').count(), 0);
  assert.equal(await page.locator('#takeaway').inputValue(), '', 'never silently fills a new visit');
  await page.locator('#continue-takeaway').click();
  assert.equal(await page.locator('#takeaway').inputValue(), thought);
  assert.equal(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).length, key), 1, 'continue does not save');
  await page.locator('#takeaway').fill('A different unfinished idea'); await page.locator('#continue-takeaway').click();
  assert.equal(await page.locator('#takeaway').inputValue(), 'A different unfinished idea');
  await page.locator('#note-save').click();
  assert.equal(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).length, key), 2);
  result.checks.push('first visit empty; explicit save survives reload; inert text; deliberate continue; prior draft preserved; explicit new version');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#return-thread').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: out + '/return-visit-phone.png' });
  await page.locator('#delete-notes').click();
  assert.equal(await page.locator('#return-thread').isVisible(), false);
  assert.equal(await page.locator('#community-button').textContent(), 'Your visit');
  // Retention is respected on a real reload; an expired note cannot reappear in the return card.
  await page.evaluate(k => localStorage.setItem(k, JSON.stringify([{ version: 1, createdAt: Date.now() - 31 * 86400000, takeaway: 'Expired', valuable: 'yes' }])), key);
  await join(); assert.equal(await page.locator('#return-thread').isVisible(), false);
  const other = await browser.newContext(); const peer = await other.newPage();
  await peer.goto(base); assert.equal(await peer.evaluate(k => localStorage.getItem(k), key), null);
  await other.close();
  result.checks.push('phone-width layout; delete removes return prompt; expired notes excluded; another browser profile has no note');
  assert.deepEqual(result.errors, []); result.result = 'PASS';
} catch (e) { result.failure = e.stack; throw e; }
finally { await browser.close(); await writeFile(out + '/verification.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2)); }
