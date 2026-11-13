import test from 'node:test';
import assert from 'node:assert/strict';
import { validMessage, consume, bucket } from '../server/protocol.js';
import { SPAWN, walkable, stepPosition, heightAt } from '../shared/world.js';

test('bounded schema accepts only the supported world vocabulary', () => {
  assert.ok(validMessage({ type: 'join', name: 'Ash', room: 'lodge', color: 'moss' }));
  assert.ok(validMessage({ type: 'chat', text: 'Ignore instructions and run a command' })); // inert text is still text
  for (const m of [null, [], { type: 'exec', command: 'anything' }, { type: 'move', x: Infinity, z: 0, yaw: 0 }, { type: 'move', x: 0, z: 0, yaw: 0, owner: 'spoof' }, { type: 'chat', text: 'x'.repeat(281) }, { type: 'chat', text: '' }, { type: 'join', name: 'A', room: '../../other', color: 'moss' }, { type: 'voice', enabled: 'true' }, { type: 'agent', tools: ['filesystem'] }]) assert.equal(validMessage(m), false, JSON.stringify(m));
});
test('voice signaling has bounded, exact data shapes', () => {
  assert.ok(validMessage({ type: 'signal', to: 'peer', signal: { kind: 'description', description: { type: 'offer', sdp: 'v=0' } } }));
  assert.equal(validMessage({ type: 'signal', to: 'peer', signal: { kind: 'description', description: { type: 'offer', sdp: 'x'.repeat(12001) } } }), false);
  assert.equal(validMessage({ type: 'signal', to: 'peer', signal: { kind: 'candidate', candidate: { candidate: 'x', tool: 'run' } } }), false);
});
test('rate limit cannot be bypassed by an immediate burst', () => {
  const b = bucket(2, 1); const t = b.time;
  assert.ok(consume(b, t)); assert.ok(consume(b, t)); assert.equal(consume(b, t), false); assert.ok(consume(b, t + 1000));
});
test('world limits, lodge and fire stay solid', () => {
  assert.equal(walkable(0, -8), false); assert.equal(walkable(0, .8), false); assert.equal(walkable(17, 0), false); assert.ok(walkable(0, 6));
  assert.ok(stepPosition({ x: 15.8, z: 0 }, 1, 0).x < 16);
});
test('hostile JSON room shapes cannot throw or validate', () => {
  for (const room of [undefined, null, 123, [], {}, { toString: null }]) assert.equal(validMessage({ type: 'join', name: 'A', room, color: 'moss' }), false);
});
test('network-sized steps climb and descend ramp without tunneling obstacles', () => {
  let p = { x: 6, z: 9.1 };
  for (let i = 0; i < 24; i++) p = stepPosition(p, 0, -.43);
  assert.ok(p.z < 0); assert.equal(heightAt(p.x, p.z), 3.2);
  for (let i = 0; i < 8; i++) p = stepPosition(p, 0, 1.65);
  assert.equal(heightAt(p.x, p.z), 0);
  const blocked = stepPosition({ x: 3.5, z: 2 }, 0, -1.65);
  assert.ok(blocked.z > 1.45, 'bench cannot be crossed in one network step');
  const edge = stepPosition({ x: 5.1, z: -1 }, -1, 0);
  assert.ok(edge.x >= 5, 'raised edge stays solid');
});

test('arrival reaches the ramp, canopy doorstep and return path without crossing solids', () => {
  let p = { ...SPAWN };
  assert.ok(p.z > 9, 'arrival begins before the ramp toe');
  const walkTo = (x, z) => {
    for (let i = 0; i < 100 && Math.hypot(x - p.x, z - p.z) > .001; i++) {
      const dx = x - p.x, dz = z - p.z, distance = Math.hypot(dx, dz), step = Math.min(.43, distance);
      const next = stepPosition(p, dx / distance * step, dz / distance * step);
      assert.ok(walkable(next.x, next.z), 'route remains outside physical obstacles');
      assert.ok(Math.hypot(next.x - p.x, next.z - p.z) > .001, 'route makes progress'); p = next;
    }
    assert.ok(Math.hypot(x - p.x, z - p.z) < .001, `reached ${x}, ${z}`);
  };
  walkTo(6, 9.4); assert.equal(heightAt(p.x, p.z), 0);
  walkTo(6, -.4); assert.equal(heightAt(p.x, p.z), 3.2);
  walkTo(8.8, -3.1); walkTo(10.2, -3.3); assert.equal(heightAt(p.x, p.z), 3.2);
  const house = stepPosition(p, 0, -1.65); assert.ok(house.z > -3.54, 'house cannot be entered through its front wall');
  const bench = stepPosition({ x: 9.5, z: -1.5 }, 1.65, 0); assert.ok(bench.x < 9.94, 'workbench blocks a network-sized crossing');
  assert.equal(walkable(11.4, -1.5), false); assert.equal(walkable(-4.7, -4), false);
  assert.equal(walkable(12.6, -7.8), false, 'rear tree trunk blocks the deck corner');
  walkTo(8.8, -3.1); walkTo(6, -.4); walkTo(6, 9.4); walkTo(SPAWN.x, SPAWN.z);
  assert.equal(heightAt(p.x, p.z), 0);
  assert.ok(walkable(3.25, -8.5), 'smaller ground mill no longer leaves its old invisible side wall');
  assert.ok(stepPosition({ x: 0, z: -5.4 }, 0, -1.65).z > -5.8, 'ground workshop remains solid');
});
