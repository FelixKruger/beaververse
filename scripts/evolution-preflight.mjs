import { readFile, open, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = resolve(root, '.local/evolution-loop/cycle.lock');
try {
  if (process.argv[2] === '--release') {
    const lock = JSON.parse(await readFile(lockPath, 'utf8'));
    if (!process.argv[3] || lock.lease !== process.argv[3]) throw new Error('Lease does not match. Do not remove another worker lock.');
    await unlink(lockPath); console.log(JSON.stringify({ ok: true, released: true }));
  } else {
  if (![undefined, '--claim'].includes(process.argv[2])) throw new Error('Use no argument, --claim, or --release LEASE.');
  const pin = JSON.parse(await readFile(resolve(root, '.local/evolution-loop/charter-pin.json'), 'utf8'));
  const actual = createHash('sha256').update(await readFile(resolve(root, 'docs/evolution/VISION-AND-PRINCIPLES.md'))).digest('hex');
  if (pin.sha256 !== actual) throw new Error('Principles changed. Human review is required before another cycle.');
  const queue = JSON.parse(await readFile(resolve(root, 'docs/evolution/QUEUE.json'), 'utf8'));
  const next = queue.items.find(item => ['verification', 'ready', 'in-progress'].includes(item.status));
  let lease;
  if (next && process.argv[2] === '--claim') {
    const file = await open(lockPath, 'wx');
    try { lease = randomUUID(); await file.writeFile(JSON.stringify({ lease, startedAt: new Date().toISOString(), item: next.id })); }
    finally { await file.close(); }
  }
  console.log(JSON.stringify({ ok: true, charterStatus: 'pinned draft, not human-ratified', lease, next: next || null, action: next ? 'One bounded local cycle may proceed under BUILD-LOOP.md.' : 'No eligible work. Pause the follow-up and report the next human gate.' }, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, action: 'Stop without changing the pin or principles.', reason: error.message }));
  process.exitCode = 1;
}
