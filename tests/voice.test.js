import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/voice.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { VoiceCircle } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
test('pending microphone permission cannot outlive a disconnect or explicit leave', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    for (const reason of ['disconnect', 'leave']) {
      let resolve, stopped = false;
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => new Promise(r => { resolve = r; }) } } });
      const messages = [], room = { connected: true, send: m => messages.push(m) }, voice = new VoiceCircle(room, () => {});
      const pending = voice.join();
      if (reason === 'disconnect') room.connected = false;
      voice.leave();
      resolve({ getTracks: () => [{ stop: () => { stopped = true; } }] });
      await assert.rejects(pending, /cancelled/);
      assert.equal(stopped, true); assert.equal(voice.stream, undefined);
      assert.equal(messages.some(m => m.enabled === true), false);
    }
  } finally { if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator; }
});
