import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'beaververse-loop-test-'));
  t.after(() => {
    const target = resolve(root);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith('beaververse-loop-test-'));
    return rm(target, { recursive: true, force: true });
  });
  await Promise.all(['scripts', 'docs/evolution', '.local/evolution-loop'].map(p => mkdir(join(root, p), { recursive: true })));
  await copyFile(new URL('../scripts/evolution-preflight.mjs', import.meta.url), join(root, 'scripts/evolution-preflight.mjs'));
  const principles = 'Fixture charter. No permission to publish.';
  await writeFile(join(root, 'docs/evolution/VISION-AND-PRINCIPLES.md'), principles);
  await writeFile(join(root, '.local/evolution-loop/charter-pin.json'), JSON.stringify({ sha256: createHash('sha256').update(principles).digest('hex') }));
  await writeFile(join(root, 'docs/evolution/QUEUE.json'), JSON.stringify({ items: [{ id: 'fixture-only', status: 'ready' }] }));
  const run = (...args) => {
    const result = spawnSync(process.execPath, [join(root, 'scripts/evolution-preflight.mjs'), ...args], { encoding: 'utf8' });
    return { code: result.status, ...JSON.parse(result.stdout || result.stderr) };
  };
  return { root, run, lock: join(root, '.local/evolution-loop/cycle.lock') };
}

test('loop permits one worker and refuses an unrelated release', async t => {
  const f = await fixture(t), first = f.run('--claim');
  assert.equal(first.code, 0); assert.equal(first.next.id, 'fixture-only'); assert.ok(first.lease);
  const before = await readFile(f.lock, 'utf8');
  assert.equal(f.run('--claim').code, 1);
  assert.equal(f.run('--release', 'wrong-worker').code, 1);
  assert.equal(await readFile(f.lock, 'utf8'), before);
  assert.equal(f.run('--release', first.lease).released, true);
  await assert.rejects(access(f.lock));
});

test('changed principles or an empty queue cannot acquire a build lease', async t => {
  const f = await fixture(t);
  await writeFile(join(f.root, 'docs/evolution/QUEUE.json'), JSON.stringify({ items: [{ id: 'publish', status: 'approval-required' }] }));
  assert.equal(f.run('--claim').next, null); await assert.rejects(access(f.lock));
  await writeFile(join(f.root, 'docs/evolution/VISION-AND-PRINCIPLES.md'), 'Changed without owner review');
  const blocked = f.run('--claim'); assert.equal(blocked.code, 1); assert.match(blocked.reason, /Principles changed/);
  await assert.rejects(access(f.lock));
});
