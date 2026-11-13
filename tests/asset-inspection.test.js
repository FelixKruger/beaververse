import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspectGltf } from '../scripts/inspect-gltf.mjs';

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'beaververse-gltf-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = Buffer.alloc(36); [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((v, i) => bytes.writeFloatLE(v, i * 4));
  const document = { asset: { version: '2.0' }, buffers: [{ byteLength: bytes.length, uri: 'triangle.bin' }], bufferViews: [{ buffer: 0, byteLength: bytes.length }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 };
  const file = path.join(directory, 'asset.gltf');
  await writeFile(path.join(directory, 'triangle.bin'), bytes);
  return { directory, file, bytes, document, save: async () => writeFile(file, JSON.stringify(document)) };
}

test('counts source geometry once and applies hierarchical TRS, matrix and mesh instances', async t => {
  const f = await fixture(t);
  f.document.accessors[0].min = [-999, -999, -999]; f.document.accessors[0].max = [999, 999, 999]; // Bounds must come from bytes.
  f.document.nodes = [{ translation: [10, 0, 0], children: [1, 2] }, { mesh: 0, translation: [0, 2, 0], scale: [2, 3, 1] }, { mesh: 0, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -2, -1, 0, 1] }];
  await f.save(); const report = await inspectGltf(f.file);
  assert.deepEqual(report.raw.bounds, { min: [0, 0, 0], max: [1, 1, 0], size: [1, 1, 0] });
  assert.deepEqual(report.scene.bounds, { min: [8, -1, 0], max: [12, 5, 0], size: [4, 6, 0] });
  assert.equal(report.raw.vertices, 3); assert.equal(report.raw.triangles, 1);
  assert.equal(report.scene.vertices, 6); assert.equal(report.scene.triangles, 2); assert.equal(report.scene.meshInstances, 2);
  assert.equal(report.scene.complete, true); assert.match(report.sha256, /^[a-f0-9]{64}$/);
});

test('primitive modes distinguish triangles, strips, fans and points/lines', async t => {
  const f = await fixture(t);
  const indices = Buffer.from([0, 1, 2, 1, 2, 0]); await writeFile(path.join(f.directory, 'indices.bin'), indices);
  f.document.buffers.push({ byteLength: indices.length, uri: 'indices.bin' }); f.document.bufferViews.push({ buffer: 1, byteLength: indices.length });
  f.document.accessors.push({ bufferView: 1, componentType: 5121, count: indices.length, type: 'SCALAR' });
  f.document.meshes[0].primitives = Array.from({ length: 7 }, (_, mode) => ({ attributes: { POSITION: 0 }, indices: 1, mode }));
  await f.save(); const report = await inspectGltf(f.file);
  assert.deepEqual(report.primitives.map(p => p.triangles), [0, 0, 0, 0, 2, 4, 4]);
  assert.equal(report.raw.triangles, 10); assert.equal(report.raw.vertices, 21);
});

async function indexedFixture(t, componentType = 5123) {
  const f = await fixture(t), size = { 5121: 1, 5123: 2, 5125: 4 }[componentType], indices = Buffer.alloc(3 * size);
  [0, 1, 2].forEach((value, i) => indices.writeUIntLE(value, i * size, size)); await writeFile(path.join(f.directory, 'indices.bin'), indices);
  f.document.buffers.push({ byteLength: indices.length, uri: 'indices.bin' }); f.document.bufferViews.push({ buffer: 1, byteLength: indices.length });
  f.document.accessors.push({ bufferView: 1, componentType, count: 3, type: 'SCALAR' }); f.document.meshes[0].primitives[0].indices = 1;
  return { ...f, indices };
}

test('validates all unsigned index widths and rejects signed, floating and normalized indices', async t => {
  for (const componentType of [5121, 5123, 5125]) {
    const f = await indexedFixture(t, componentType); await f.save(); const report = await inspectGltf(f.file);
    assert.equal(report.raw.complete, true); assert.equal(report.scene.complete, true); assert.equal(report.raw.triangles, 1);
  }
  const f = await indexedFixture(t);
  for (const componentType of [5120, 5122, 5126]) { f.document.accessors[1].componentType = componentType; await f.save(); await assert.rejects(inspectGltf(f.file), /Invalid unsigned SCALAR index accessor/); }
  f.document.accessors[1].componentType = 5123; f.document.accessors[1].normalized = true; await f.save(); await assert.rejects(inspectGltf(f.file), /Invalid unsigned SCALAR index accessor/);
});

test('missing, compressed and sparse index data cannot report complete geometry', async t => {
  const f = await indexedFixture(t); f.document.buffers[1].uri = 'missing-indices.bin'; await f.save();
  const missing = await inspectGltf(f.file); assert.deepEqual(missing.missingDependencies, ['missing-indices.bin']);
  assert.equal(missing.raw.complete, false); assert.equal(missing.scene.complete, false); assert.equal(missing.primitives[0].decoded, false);
  f.document.buffers[1].uri = 'indices.bin'; f.document.bufferViews[1].extensions = { EXT_meshopt_compression: {} }; await f.save();
  const compressed = await inspectGltf(f.file); assert.equal(compressed.raw.complete, false); assert.equal(compressed.scene.complete, false);
  delete f.document.bufferViews[1].extensions; f.document.accessors[1].sparse = { count: 1 }; await f.save();
  const sparse = await inspectGltf(f.file); assert.equal(sparse.raw.complete, false); assert.equal(sparse.scene.complete, false);
});

test('rejects truncated index buffers, accessors beyond views and excessive counts', async t => {
  const f = await indexedFixture(t); await f.save(); await writeFile(path.join(f.directory, 'indices.bin'), f.indices.subarray(0, -1));
  await assert.rejects(inspectGltf(f.file), /Invalid or truncated buffer/);
  await writeFile(path.join(f.directory, 'indices.bin'), f.indices); f.document.bufferViews[1].byteLength = 4; await f.save();
  await assert.rejects(inspectGltf(f.file), /Index accessor exceeds bufferView/);
  f.document.bufferViews[1].byteLength = 6; f.document.accessors[1].count = 5_000_001; await f.save();
  await assert.rejects(inspectGltf(f.file), /Invalid unsigned SCALAR index accessor/);
});

test('rejects indices outside the POSITION range for every unsigned width', async t => {
  for (const componentType of [5121, 5123, 5125]) {
    const f = await indexedFixture(t, componentType), size = f.indices.length / 3;
    f.indices.writeUIntLE(3, 2 * size, size); await writeFile(path.join(f.directory, 'indices.bin'), f.indices); await f.save();
    await assert.rejects(inspectGltf(f.file), /references vertex outside POSITION count/);
  }
});

test('rotated bounds use actual vertices instead of transformed bounding-box corners', async t => {
  const f = await fixture(t); f.document.nodes[0].rotation = [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)]; await f.save();
  const report = await inspectGltf(f.file), expected = Math.SQRT1_2;
  assert.ok(Math.abs(report.scene.bounds.min[0] + expected) < 1e-6);
  assert.ok(Math.abs(report.scene.bounds.max[1] - expected) < 1e-6);
});

test('GLB 2 reads padded JSON/BIN and embedded PNG metadata; rejects truncated container', async t => {
  const f = await fixture(t), png = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(png); png.writeUInt32BE(512, 16); png.writeUInt32BE(256, 20);
  delete f.document.buffers[0].uri; f.document.buffers[0].byteLength += png.length;
  f.document.bufferViews.push({ buffer: 0, byteOffset: f.bytes.length, byteLength: png.length });
  f.document.images = [{ bufferView: 1, mimeType: 'image/png' }]; f.document.textures = [{ source: 0 }];
  const json = Buffer.from(JSON.stringify(f.document)), padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]), bin = Buffer.concat([f.bytes, png]);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + padded.length + bin.length, 8); header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(bin.length); binHeader.writeUInt32LE(0x004e4942, 4);
  const glb = Buffer.concat([header, padded, binHeader, bin]), filename = path.join(f.directory, 'asset.glb'); await writeFile(filename, glb);
  const report = await inspectGltf(filename); assert.equal(report.raw.triangles, 1); assert.equal(report.counts.textures, 1);
  assert.deepEqual(report.images[0], { index: 0, name: null, mimeType: 'image/png', encodedBytes: 24, format: 'png', width: 512, height: 256 });
  await writeFile(filename, glb.subarray(0, -1)); await assert.rejects(inspectGltf(filename), /Invalid GLB/);
});

test('rejects traversal, encoded traversal, network, absolute, drive and backslash dependency URIs', async t => {
  const f = await fixture(t);
  for (const uri of ['../outside.bin', '%2e%2e/outside.bin', 'https://example.com/a.bin', '//host/share.bin', '/outside.bin', 'C:/outside.bin', 'folder\\outside.bin', 'file:///outside.bin']) {
    f.document.buffers[0].uri = uri; await f.save(); await assert.rejects(inspectGltf(f.file), /Rejected non-local or traversing URI/, uri);
  }
});

test('rejects network input paths before filesystem access', async () => {
  for (const filename of ['https://example.com/model.glb', '//host/share/model.glb', '\\\\host\\share\\model.glb']) await assert.rejects(inspectGltf(filename), /Expected local input path/);
});

test('rejects dependency directory symlink escapes', async t => {
  const f = await fixture(t), inside = path.join(f.directory, 'inside'); await mkdir(inside);
  try { await symlink(f.directory, path.join(inside, 'escape'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error; t.skip(`Host cannot create symlink fixture: ${error.code}`); return; }
  f.document.buffers[0].uri = 'escape/triangle.bin'; const nested = path.join(inside, 'asset.gltf'); await writeFile(nested, JSON.stringify(f.document));
  await assert.rejects(inspectGltf(nested), /outside input directory/);
});

test('reports missing dependencies and refuses to claim bounds for sparse/extension geometry', async t => {
  const f = await fixture(t); f.document.buffers[0].uri = 'missing.bin'; await f.save();
  const missing = await inspectGltf(f.file); assert.deepEqual(missing.missingDependencies, ['missing.bin']); assert.equal(missing.raw.complete, false); assert.equal(missing.raw.bounds, null);
  f.document.buffers[0].uri = 'triangle.bin'; f.document.accessors[0].sparse = { count: 1 }; f.document.extensionsUsed = ['KHR_draco_mesh_compression']; await f.save();
  const sparse = await inspectGltf(f.file); assert.equal(sparse.scene.complete, false); assert.equal(sparse.raw.bounds, null); assert.deepEqual(sparse.unsupportedExtensions, ['KHR_draco_mesh_compression']);
  assert.ok(sparse.warnings.some(warning => warning.includes('Sparse POSITION')));
});

test('rejects out-of-range geometry and excessive vertex counts without allocation', async t => {
  const f = await fixture(t); f.document.accessors[0].byteOffset = 4; await f.save(); await assert.rejects(inspectGltf(f.file), /POSITION exceeds bufferView/);
  f.document.accessors[0].byteOffset = 0; f.document.accessors[0].count = 5_000_001; await f.save(); await assert.rejects(inspectGltf(f.file), /Invalid POSITION accessor/);
});

test('embedded data, skin and animation metadata remain inspection-only', async t => {
  const f = await fixture(t); f.document.buffers[0].uri = `data:application/octet-stream;base64,${f.bytes.toString('base64')}`;
  f.document.skins = [{ name: 'skeleton', joints: [0, 1] }]; f.document.animations = [{ name: 'wave', channels: [{ target: { node: 0, path: 'rotation' } }], samplers: [{}] }];
  await f.save(); const report = await inspectGltf(f.file);
  assert.equal(report.raw.vertices, 3); assert.equal(report.skins[0].joints, 2); assert.equal(report.animations[0].name, 'wave'); assert.deepEqual(report.animations[0].paths, ['rotation']);
  assert.deepEqual(await readFile(path.join(f.directory, 'triangle.bin')), f.bytes);
});
