import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectGltf } from '../scripts/inspect-gltf.mjs';

test('pinned runtime beaver includes its skin, playback clips, greeting joint and embedded atlas', async () => {
  const report = await inspectGltf('public/assets/beaver-gobkit.glb');
  assert.equal(report.sha256, '72fed180b8a909ee24bc17751ac427a7de76e232a997f1cc8bd5ba1870d9b986');
  assert.equal(report.skins[0].joints, 16);
  assert.ok(['idle', 'walk'].every(name => report.animations.some(a => a.name === name)));
  assert.deepEqual(report.missingDependencies, []);
  assert.deepEqual(report.unsupportedExtensions, []);
  assert.equal(report.images[0].width, 512);
  const bytes = await readFile('public/assets/beaver-gobkit.glb');
  const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  for (const name of ['Tail', 'RightLegF']) {
    const node = doc.nodes.findIndex(n => n.name === name);
    assert.ok(node >= 0 && doc.skins[0].joints.includes(node), `${name} belongs to the skin`);
  }
});
