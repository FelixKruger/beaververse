// Collision truth is shared by server and client. World coordinates are metres.
export const WORLD_RADIUS = 16;
export const SPAWN = { x: 0, z: 10.5 };
export const SOLIDS = [
  { x: -0.01, z: -8.56, w: 5.5, d: 4.8 },
  { x: -3.5, z: 0.8, w: 2.1, d: 0.65 },
  { x: 3.5, z: 0.8, w: 2.1, d: 0.65 },
  { x: 10.2, z: -5.8, w: 4.0, d: 3.8 },
  { x: -4.7, z: -4, w: 2.2, d: 0.9 },
  { x: 11.4, z: -1.5, w: 2.2, d: 0.9 },
  { x: 13.5, z: -8.8, w: 1.8, d: 1.8 },
];
export function heightAt(x, z) {
  if (x >= 5 && x <= 13 && z >= -8 && z <= 0) return 3.2;
  if (x >= 5 && x <= 7 && z > 0 && z <= 9) return 3.2 * (9 - z) / 9;
  return 0;
}
export function walkable(x, z) {
  return Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x, z) < WORLD_RADIUS &&
    Math.hypot(x, z - 0.8) > 1.1 &&
    SOLIDS.every(b => Math.abs(x - b.x) > b.w / 2 + 0.36 || Math.abs(z - b.z) > b.d / 2 + 0.36);
}
export function stepPosition(from, dx, dz) {
  const result = { x: from.x, z: from.z };
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .08));
  const sx = dx / steps, sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    if (walkable(result.x + sx, result.z) && Math.abs(heightAt(result.x + sx, result.z) - heightAt(result.x, result.z)) < .15) result.x += sx;
    if (walkable(result.x, result.z + sz) && Math.abs(heightAt(result.x, result.z + sz) - heightAt(result.x, result.z)) < .15) result.z += sz;
  }
  return result;
}
