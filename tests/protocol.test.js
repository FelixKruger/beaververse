import test from 'node:test';
import assert from 'node:assert/strict';
import { validMessage, consume, bucket } from '../server/protocol.js';
import { walkable, stepPosition, heightAt } from '../shared/world.js';

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
