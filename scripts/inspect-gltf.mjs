import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Mat4, Quat, Vec3 } from 'playcanvas';

const MAX_FILE = 64 * 1024 * 1024, MAX_TOTAL = 128 * 1024 * 1024, MAX_VERTICES = 5_000_000;
const check = (condition, message) => { if (!condition) throw new Error(message); };
const integer = value => Number.isSafeInteger(value) && value >= 0;
const localPath = value => typeof value === 'string' && !/^(?:[\\/]{2}|[a-z][a-z0-9+.-]*:\/\/)/i.test(value);
const emptyBounds = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
function extend(bounds, values) {
  check(values.every(Number.isFinite), 'Non-finite geometry or transform');
  values.forEach((value, axis) => { bounds.min[axis] = Math.min(bounds.min[axis], value); bounds.max[axis] = Math.max(bounds.max[axis], value); });
}
const finish = bounds => Number.isFinite(bounds.min[0]) ? { ...bounds, size: bounds.max.map((v, i) => v - bounds.min[i]) } : null;

function unpack(bytes, binary) {
  if (!binary) return { document: JSON.parse(bytes.toString('utf8')) };
  check(bytes.length >= 20 && bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, 'Invalid GLB 2 header/length');
  let document, bin;
  for (let offset = 12; offset < bytes.length;) {
    check(offset + 8 <= bytes.length, 'Truncated GLB chunk');
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4); offset += 8;
    check(length % 4 === 0 && offset + length <= bytes.length, 'Invalid GLB chunk length');
    check(document || type === 0x4e4f534a, 'GLB first chunk must be JSON');
    if (type === 0x4e4f534a) { check(!document, 'Duplicate GLB JSON'); document = JSON.parse(bytes.subarray(offset, offset + length).toString('utf8')); }
    if (type === 0x004e4942) { check(!bin, 'Duplicate GLB BIN'); bin = bytes.subarray(offset, offset + length); }
    offset += length;
  }
  check(document, 'Missing GLB JSON'); return { document, bin };
}

function imageDimensions(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return { format: 'png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const kind = bytes.toString('ascii', 12, 16);
    if (kind === 'VP8X' && bytes.length >= 30) return { format: 'webp', width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
    if (kind === 'VP8 ' && bytes.length >= 30) return { format: 'webp', width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L' && bytes.length >= 25) { const bits = bytes.readUInt32LE(21); return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }; }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++]; if (marker === 0xda || marker === 0xd9 || offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset); if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) return { format: 'jpeg', width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
      offset += length;
    }
  }
  return { format: 'unknown', width: null, height: null };
}

export async function inspectGltf(input) {
  check(localPath(input), 'Expected local input path, not a network path or URL');
  const file = await realpath(input), directory = path.dirname(file), missingDependencies = [], warnings = new Set(), cache = new Map();
  let totalBytes = 0, visitedVertices = 0, visitedIndices = 0;
  function charge(length) { totalBytes += length; check(length <= MAX_FILE && totalBytes <= MAX_TOTAL, 'Asset byte budget exceeded (64 MiB/file, 128 MiB total)'); }
  async function boundedRead(filename) {
    const info = await stat(filename); check(info.isFile() && info.size <= MAX_FILE, 'Expected regular file no larger than 64 MiB');
    charge(info.size); const bytes = await readFile(filename); check(bytes.length === info.size, 'File changed during inspection'); return bytes;
  }
  async function resource(uri) {
    check(typeof uri === 'string', 'Asset URI must be a string');
    if (cache.has(uri)) return cache.get(uri);
    let bytes;
    if (uri.startsWith('data:')) {
      const comma = uri.indexOf(','); check(comma >= 5 && uri.length <= MAX_FILE * 1.4, 'Invalid or oversized data URI');
      const header = uri.slice(5, comma), body = uri.slice(comma + 1);
      if (header.endsWith(';base64')) { check(body.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(body), 'Invalid base64 data URI'); bytes = Buffer.from(body, 'base64'); }
      else { check(!/%(?![0-9a-f]{2})|[^\x20-\x7e]/i.test(body), 'Invalid percent-encoded data URI'); bytes = Buffer.from(body.replace(/%([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))), 'latin1'); }
      charge(bytes.length);
    } else {
      const name = decodeURIComponent(uri);
      check(name && !/[\\:\x00?#]/.test(name) && !path.posix.isAbsolute(name) && !path.win32.isAbsolute(name) && !name.split('/').includes('..'), `Rejected non-local or traversing URI: ${uri}`);
      try {
        const target = await realpath(path.resolve(directory, name)), relative = path.relative(directory, target);
        check(!path.isAbsolute(relative) && !relative.split(path.sep).includes('..'), `Rejected dependency outside input directory: ${uri}`);
        bytes = await boundedRead(target);
      } catch (error) { if (error.code !== 'ENOENT') throw error; missingDependencies.push(uri); bytes = null; }
    }
    cache.set(uri, bytes); return bytes;
  }
  const bytes = await boundedRead(file), extension = path.extname(file).toLowerCase();
  check(['.gltf', '.glb'].includes(extension), 'Input must be .gltf or .glb');
  const { document: doc, bin } = unpack(bytes, extension === '.glb');
  check(doc.asset?.version === '2.0', 'Only glTF 2.0 is supported');
  const buffers = [];
  for (const [index, buffer] of (doc.buffers || []).entries()) {
    const data = buffer.uri !== undefined ? await resource(buffer.uri) : index === 0 ? bin : null;
    check(integer(buffer.byteLength) && (!data || data.length >= buffer.byteLength), 'Invalid or truncated buffer');
    if (!data) warnings.add(`Buffer ${index} unavailable`); buffers.push(data?.subarray(0, buffer.byteLength) ?? null);
  }
  function view(index) {
    const v = doc.bufferViews?.[index]; check(v && integer(v.byteOffset ?? 0) && integer(v.byteLength), 'Invalid bufferView');
    if (v.extensions?.EXT_meshopt_compression) { warnings.add('Meshopt bufferView not decoded'); return null; }
    const data = buffers[v.buffer]; if (!data) return null;
    const start = v.byteOffset ?? 0; check(start + v.byteLength <= data.length, 'bufferView exceeds buffer'); return data.subarray(start, start + v.byteLength);
  }
  function positions(index, consume) {
    const a = doc.accessors?.[index]; check(a && a.type === 'VEC3' && integer(a.count) && a.count <= MAX_VERTICES, 'Invalid POSITION accessor');
    if (a.sparse) { warnings.add(`Sparse POSITION accessor ${index} not decoded`); return false; }
    const component = { 5120: [1, 'readInt8', 127], 5121: [1, 'readUInt8', 255], 5122: [2, 'readInt16LE', 32767], 5123: [2, 'readUInt16LE', 65535], 5125: [4, 'readUInt32LE', 4294967295], 5126: [4, 'readFloatLE', 1] }[a.componentType];
    check(component, 'Unsupported POSITION component type');
    const [size, read, divisor] = component, stride = doc.bufferViews?.[a.bufferView]?.byteStride ?? size * 3, start = a.byteOffset ?? 0;
    const data = a.bufferView === undefined ? undefined : view(a.bufferView); if (data === null) return false;
    check(integer(start) && integer(stride) && stride >= size * 3 && (!data || start + Math.max(0, a.count - 1) * stride + (a.count ? size * 3 : 0) <= data.length), 'POSITION exceeds bufferView');
    visitedVertices += a.count; check(visitedVertices <= MAX_VERTICES, 'Inspection vertex budget exceeded (5 million visits)');
    for (let i = 0; i < a.count; i++) consume([0, 1, 2].map(axis => { const v = data ? data[read](start + i * stride + axis * size) : 0; return a.normalized ? Math.max(-1, v / divisor) : v; }));
    return true;
  }
  function validIndices(index, vertexCount) {
    if (index === undefined) return true;
    const a = doc.accessors?.[index], component = { 5121: [1, 'readUInt8'], 5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'] }[a?.componentType];
    check(a?.type === 'SCALAR' && component && !a.normalized && integer(a.count) && a.count <= MAX_VERTICES, 'Invalid unsigned SCALAR index accessor');
    if (a.sparse) { warnings.add(`Sparse index accessor ${index} not decoded`); return false; }
    const [size, read] = component, start = a.byteOffset ?? 0, v = doc.bufferViews?.[a.bufferView];
    const data = a.bufferView === undefined ? undefined : view(a.bufferView);
    if (data === null) { warnings.add(`Index accessor ${index} unavailable or compressed`); return false; }
    check(v?.byteStride === undefined && integer(start) && start % size === 0 && (v?.byteOffset ?? 0) % size === 0 && (!data || start + a.count * size <= data.length), 'Index accessor exceeds bufferView or has invalid layout');
    visitedIndices += a.count; check(visitedIndices <= MAX_VERTICES, 'Inspection index budget exceeded (5 million reads)');
    for (let i = 0; i < a.count; i++) check((data ? data[read](start + i * size) : 0) < vertexCount, `Index accessor ${index} references vertex outside POSITION count`);
    return true;
  }
  const raw = { vertices: 0, triangles: 0, bounds: emptyBounds(), complete: true }, primitives = [], meshPrimitives = [];
  for (const [mesh, m] of (doc.meshes || []).entries()) {
    meshPrimitives[mesh] = [];
    for (const [primitive, p] of (m.primitives || []).entries()) {
      const accessor = p.attributes?.POSITION, a = doc.accessors?.[accessor], indices = p.indices === undefined ? null : doc.accessors?.[p.indices], mode = p.mode ?? 4;
      check(a && integer(a.count) && integer(mode) && mode <= 6 && (p.indices === undefined || (indices?.type === 'SCALAR' && integer(indices.count))), 'Invalid primitive/accessor');
      const count = indices?.count ?? a.count, triangles = mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
      if (mode === 4 && count % 3) warnings.add(`Mesh ${mesh} primitive ${primitive}: incomplete triangle`);
      const decoded = !p.extensions?.KHR_draco_mesh_compression && validIndices(p.indices, a.count) && positions(accessor, values => extend(raw.bounds, values));
      if (!decoded) raw.complete = false;
      raw.vertices += a.count; raw.triangles += triangles;
      const entry = { mesh, primitive, mode, vertices: a.count, indices: indices?.count ?? null, triangles, accessor, decoded }; primitives.push(entry); meshPrimitives[mesh].push(entry);
    }
  }
  const unsupportedExtensions = [...new Set([...(doc.extensionsUsed || []), ...(doc.extensionsRequired || [])])];
  const scene = { index: doc.scenes?.length ? (doc.scene ?? 0) : null, meshInstances: 0, vertices: 0, triangles: 0, bounds: emptyBounds(), complete: true };
  const selected = scene.index === null ? null : doc.scenes[scene.index]; check(scene.index === null || selected, 'Invalid default scene');
  const seen = new Set(), stack = (selected?.nodes || []).map(index => ({ index, parent: new Mat4() }));
  while (stack.length) {
    const { index, parent } = stack.pop(), node = doc.nodes?.[index]; check(node && !seen.has(index) && seen.size < 100_000, 'Invalid, cyclic, or multiply-parented scene node'); seen.add(index);
    const values = (value, fallback) => { const v = value ?? fallback; check(Array.isArray(v) && v.length === fallback.length && v.every(Number.isFinite), 'Invalid node transform'); return v; };
    const local = node.matrix ? new Mat4().set(values(node.matrix, new Array(16).fill(0))) : new Mat4().setTRS(new Vec3(...values(node.translation, [0, 0, 0])), new Quat(...values(node.rotation, [0, 0, 0, 1])), new Vec3(...values(node.scale, [1, 1, 1])));
    const world = new Mat4().mul2(parent, local);
    if (node.mesh !== undefined) {
      check(doc.meshes?.[node.mesh], 'Invalid node mesh'); scene.meshInstances++;
      for (const p of meshPrimitives[node.mesh]) {
        scene.vertices += p.vertices; scene.triangles += p.triangles;
        if (!p.decoded) scene.complete = false;
        else positions(p.accessor, values => { const point = world.transformPoint(new Vec3(...values)); extend(scene.bounds, [point.x, point.y, point.z]); });
      }
    }
    for (const child of node.children || []) stack.push({ index: child, parent: world });
  }
  if (unsupportedExtensions.length) { raw.complete = false; scene.complete = false; }
  if (!selected) { scene.complete = false; warnings.add('No scene: only source geometry inspected'); }
  const images = [];
  for (const [index, image] of (doc.images || []).entries()) {
    const data = image.uri !== undefined ? await resource(image.uri) : view(image.bufferView);
    images.push({ index, name: image.name ?? null, mimeType: image.mimeType ?? null, encodedBytes: data?.length ?? null, ...(data ? imageDimensions(data) : { format: 'unavailable', width: null, height: null }) });
  }
  return {
    file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), inspectedBytes: totalBytes,
    counts: { meshes: doc.meshes?.length ?? 0, materials: doc.materials?.length ?? 0, textures: doc.textures?.length ?? 0, images: images.length, skins: doc.skins?.length ?? 0, animations: doc.animations?.length ?? 0 },
    raw: { ...raw, bounds: finish(raw.bounds) }, scene: { ...scene, bounds: finish(scene.bounds) }, primitives, images,
    skins: (doc.skins || []).map((skin, index) => ({ index, name: skin.name ?? null, joints: skin.joints?.length ?? 0 })),
    animations: (doc.animations || []).map((animation, index) => ({ index, name: animation.name ?? null, channels: animation.channels?.length ?? 0, samplers: animation.samplers?.length ?? 0, paths: [...new Set((animation.channels || []).map(c => c.target?.path))] })),
    unsupportedExtensions, missingDependencies, warnings: [...warnings],
    limitations: ['Static base POSITION bounds only; no skin, morph, animation, or extension evaluation.', 'Vertices sum POSITION counts per primitive; triangles are mode-aware submitted counts, including degenerates. Scene counts include instances.', 'Image dimensions come from headers; no image decode, topology/rig quality, license, visual, or runtime validation.'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [input, flag, output, ...extra] = process.argv.slice(2);
    check(input && (flag === undefined || (flag === '--out' && output?.endsWith('.json'))) && !extra.length, 'Usage: node scripts/inspect-gltf.mjs input.glb|input.gltf [--out report.json]');
    check(output === undefined || localPath(output), 'Expected local output path, not a network path or URL');
    const json = JSON.stringify(await inspectGltf(input), null, 2) + '\n';
    if (output) await writeFile(output, json); else process.stdout.write(json);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
