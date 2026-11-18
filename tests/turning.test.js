import test from 'node:test';
import assert from 'node:assert/strict';
import { Entity, Vec3 } from 'playcanvas';
import { turnAvatar } from '../src/turning.ts';

const facing = entity => {
  const v = entity.getRotation().transformVector(new Vec3(0, 0, 1));
  return Math.atan2(v.x, v.z) * 180 / Math.PI;
};
const distance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test('rendered facing reaches all quadrants without Euler folding or roll', () => {
  const entity = new Entity();
  for (const target of [0, 45, 90, 120, 180, 240, 270, 300, 359, -179, -90, 0]) {
    for (let frame = 0; frame < 90; frame++) turnAvatar(entity, target, 1 / 60);
    assert.ok(distance(facing(entity), target) < .01, `actual facing reaches ${target} degrees`);
    const up = entity.getRotation().transformVector(new Vec3(0, 1, 0));
    assert.ok(up.distance(Vec3.UP) < .00001, 'no roll or pitch while turning');
  }
});

test('wraparound takes the short turn and separate visitors retain their orientations', () => {
  const a = new Entity(), b = new Entity();
  a.setEulerAngles(0, 179, 0); b.setEulerAngles(0, 35, 0);
  turnAvatar(a, -179, 1 / 60);
  assert.ok(distance(facing(a), 180) < 1, 'crosses the nearby seam instead of turning through zero');
  for (let frame = 0; frame < 90; frame++) { turnAvatar(a, -179, 1 / 60); turnAvatar(b, 120, 1 / 60); }
  assert.ok(distance(facing(a), -179) < .01);
  assert.ok(distance(facing(b), 120) < .01);
});
