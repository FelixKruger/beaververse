/// <reference types="vite/client" />
import './style.css';
import { Clearing } from './world';
import { RoomConnection, type Player } from './network';
import { VoiceCircle } from './voice';

const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const toast = (text: string) => { element('speech').textContent = text; element('speech').hidden = false; clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { element('speech').hidden = true; }, 4500); };
let toastTimer = 0, lastMove = 0, entered = false, count = 1;
let world: Clearing;
const params = new URLSearchParams(location.search);
const requestedRoom = params.get('room') || 'woodland';
const roomName = /^[a-z0-9-]{1,32}$/.test(requestedRoom) ? requestedRoom : 'woodland';
if (navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
const message = (name: string, text: string, notice = false) => {
  const p = document.createElement('p');
  if (notice) p.className = 'notice'; else { const b = document.createElement('b'); b.textContent = name + ': '; p.append(b); }
  p.append(document.createTextNode(text)); element('messages').append(p);
  while (element('messages').childElementCount > 80) element('messages').firstElementChild?.remove();
  element('messages').scrollTop = element('messages').scrollHeight;
};
const sync = (players: Player[]) => { count = players.length; world.sync(players); voice.sync(players); element('connection').textContent = `${count} ${count === 1 ? 'beaver' : 'beavers'} in the clearing`; };
const room = new RoomConnection({
  welcome: (id, players) => { world.identify(id); sync(players); }, state: sync,
  message: m => {
    if (m.type === 'chat') { message(m.name, m.text); if (element('chat-panel').hidden) toast(`${m.name}: ${m.text}`); }
    if (m.type === 'notice') message('', m.text, true);
    if (m.type === 'signal') void voice.signal(m.from, m.signal);
    if (m.type === 'voice-state') { if (!m.enabled && voice.stream) voice.leave(); setVoice(m.enabled); if (m.message) toast(m.message); }
    if (m.type === 'error') { toast(m.message); if (m.message.includes('Voice circle')) { voice.leave(); setVoice(false); } }
  },
  status: state => {
    element('connection').classList.toggle('live', state === 'online');
    element('connection').textContent = state === 'online' ? `${count} ${count === 1 ? 'beaver' : 'beavers'} in the clearing` : state === 'connecting' ? 'Joining the clearing…' : state === 'reconnecting' ? 'Reconnecting to the clearing…' : state === 'solo' ? 'Solo preview' : 'Room disconnected · solo';
    element('connection-guide').textContent = state === 'online' ? `You’re connected to room “${roomName}”. An invite link brings friends to this room. Names are temporary guest labels, not verified identities.` : 'You can explore this preview solo. Shared chat and voice need the room server. This public preview is not connected to an internet multiplayer service.';
    if (state === 'offline') { voice.leave(); setVoice(false); world.sync([]); if (entered) toast('Room connection lost. Voice is off; you can keep exploring solo.'); }
  }
});
const voice = new VoiceCircle(room, toast);
const setVoice = (on: boolean) => { element('voice').classList.toggle('active', on); element('voice-label').textContent = on ? 'Leave voice' : 'Join voice'; element('voice').setAttribute('aria-pressed', String(on)); element('voice').title = on ? 'Stop microphone capture and leave voice' : 'Join room voice using your microphone'; };
setVoice(false);
element('entry-form').addEventListener('submit', event => {
  event.preventDefault(); const name = element<HTMLInputElement>('name').value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 24); if (!name) return;
  const color = (document.querySelector('input[name="color"]:checked') as HTMLInputElement).value;
  entered = true; world.enter(name, color); element('entry').hidden = true; element('hud').hidden = false; element('room-label').textContent = `Room: ${roomName} · Gather around the fire.`;
  room.connect(name, roomName, color); message('', 'Welcome. Walk to the fire, wave, or say hello.', true);
});
const toggleChat = (open: boolean) => { element('chat-panel').hidden = !open; element('chat-toggle').setAttribute('aria-expanded', String(open)); if (open) element('chat-input').focus(); else element('world').focus(); };
element('chat-toggle').onclick = () => toggleChat(element('chat-panel').hidden);
element('close-chat').onclick = () => toggleChat(false);
element('chat-form').onsubmit = e => { e.preventDefault(); const input = element<HTMLInputElement>('chat-input'); if (!input.value.trim()) return; if (!room.connected) { toast('Chat needs a connected room server.'); return; } room.send({ type: 'chat', text: input.value.trim() }); input.value = ''; };
element('wave').onclick = () => { world.wave(); room.send({ type: 'wave' }); toast('You wave hello.'); };
element('voice').onclick = async () => {
  if (voice.stream) { voice.leave(); setVoice(false); toast('Microphone off. You left voice.'); return; }
  const button = element<HTMLButtonElement>('voice'); button.disabled = true;
  try { await voice.join(); setVoice(true); toast('Microphone on. You joined the voice circle.'); }
  catch (err) { toast(err instanceof Error ? err.message : 'Microphone access was not granted.'); }
  finally { button.disabled = false; }
};
element('invite').onclick = async () => { const url = new URL(location.href); url.searchParams.set('room', roomName); try { await navigator.clipboard.writeText(url.href); toast(room.connected ? 'Room link copied. Send it to a friend.' : 'Preview link copied. This is a solo preview.'); } catch { toast('Copy the address in your browser to invite someone.'); } };
const help = element<HTMLDialogElement>('help'); element('help-button').onclick = () => help.showModal(); element('close-help').onclick = () => help.close();
element('leave').onclick = () => { voice.leave(); room.close(); location.reload(); };
window.addEventListener('pagehide', () => { voice.leave(); room.close(); });
window.addEventListener('keydown', e => {
  if (!entered || help.open) return;
  if (e.code === 'Escape') { toggleChat(false); return; }
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
  if (e.code === 'Enter') { e.preventDefault(); toggleChat(true); }
  if (e.code === 'KeyE' && !e.repeat) element('wave').click();
});
try {
  world = new Clearing(element<HTMLCanvasElement>('world')); await world.load();
  element<HTMLButtonElement>('enter').disabled = false; element('enter').textContent = 'Enter the clearing  →'; element('connection').textContent = 'The clearing is ready';
  world.onMove = (x, z, yaw) => { const now = performance.now(); if (now - lastMove > 80 && room.connected) { room.send({ type: 'move', x, z, yaw }); lastMove = now; } };
  // Read-only diagnostics contain only this room's public runtime state, for reproducible verification.
  (window as any).__beaververse = { snapshot: () => ({ ...world.snapshot(), connected: room.connected, id: room.id, room: roomName }), voiceStats: () => voice.stats() };
} catch (err) { element('fatal').hidden = false; element('fatal-message').textContent = err instanceof Error ? err.message + '. Try a current browser with WebGL2 enabled.' : 'Try a current browser with WebGL2 enabled.'; console.error(err); }
