import './community.css';
import type { RoomConnection, Creation } from './network';
import { VISIT_NOTES_KEY, NOTE_LIMIT, loadNotes, visitNote, communityEvidence } from '../shared/visit-notes.js';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const download = (name: string, data: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export function community(room: RoomConnection, notify: (text: string) => void, leave: () => void) {
  const dialog = el<HTMLDialogElement>('community');
  const toast = (text: string) => { el('community-status').textContent = text; notify(text); };
  let leaving = false, invitation = '', invitationTimer = 0, invitationExpiresAt = 0, proposalId = '';
  let pendingRequest = '', requestTimer = 0;
  let gardenState: Creation[] | undefined, gardenSignature = '';
  const plotSelect = el<HTMLSelectElement>('creation-plot');
  const refreshGarden = () => {
    const live = room.connected && gardenState !== undefined;
    const creations = live ? gardenState! : [];
    const mine = creations.find(c => c.ownerId === room.id);
    const free = plotSelect.options.length - creations.length;
    for (const option of plotSelect.options) {
      const creation = creations.find(c => c.plot === Number(option.value));
      option.textContent = `Plot ${Number(option.value) + 1} · ${!live ? 'unavailable' : !creation ? 'Free' : creation.ownerId === room.id ? 'Yours' : `Taken by ${creation.ownerName}`}`;
      option.disabled = !live || !!creation && creation.ownerId !== room.id;
    }
    if (!plotSelect.selectedOptions.length || plotSelect.selectedOptions[0].disabled) {
      const available = [...plotSelect.options].find(o => !o.disabled);
      plotSelect.value = mine ? String(mine.plot) : available?.value ?? '';
    }
    plotSelect.disabled = !live;
    el<HTMLButtonElement>('place-creation').disabled = !live || !plotSelect.selectedOptions.length;
    el<HTMLButtonElement>('remove-creation').disabled = !live || !mine;
    el('place-creation').textContent = mine ? 'Update my creation' : 'Place my creation';
    el('garden-button').textContent = live ? `Garden · ${free ? `${free} free` : 'full'}` : 'Garden · explore';
    el('garden-state').textContent = !live ? 'Connect to the room to see available plots and contribute.' : `${free} of 8 plots free. ${mine ? `Plot ${mine.plot + 1} is yours. You can replace it or move to a free plot.` : free ? 'Choose a free plot to add something.' : 'Every plot is taken. You can still enjoy the garden; a space opens when someone removes their creation or leaves.'}`;
  };
  const syncGarden = (creations?: Creation[]) => {
    const signature = JSON.stringify([room.connected, room.id, creations]);
    if (signature === gardenSignature) return;
    gardenSignature = signature; gardenState = creations; refreshGarden();
  };
  let notes: ReturnType<typeof loadNotes> = [];
  const readStored = () => { try { return loadNotes(localStorage.getItem(VISIT_NOTES_KEY)); } catch { return []; } };
  const count = () => {
    notes = readStored();
    try { const raw = localStorage.getItem(VISIT_NOTES_KEY); if (raw !== null && raw !== JSON.stringify(notes)) localStorage.setItem(VISIT_NOTES_KEY, JSON.stringify(notes)); } catch { /* Explicit save reports a failure. */ }
    el('note-count').textContent = `${notes.length} saved visit ${notes.length === 1 ? 'note' : 'notes'} on this device. Up to 20; notes older than 30 days are removed when you open this.`;
    const previous = [...notes].reverse().find(note => note.takeaway);
    el('return-thread').hidden = !previous;
    el('return-takeaway').textContent = previous?.takeaway ?? '';
    el('return-date').textContent = previous ? `Saved ${new Date(previous.createdAt).toLocaleDateString()}` : '';
    el('community-button').textContent = previous ? 'Your visit · pick up a thread' : 'Your visit';
  };
  count();
  el('continue-takeaway').onclick = () => {
    count();
    const previous = [...notes].reverse().find(note => note.takeaway);
    if (!previous) return;
    const draft = el<HTMLTextAreaElement>('takeaway');
    if (!draft.value.trim()) {
      draft.value = previous.takeaway;
      toast('Your previous thought is ready to continue. Save when you want to keep a new version.');
    } else toast('Kept your current draft. Your previous takeaway is still shown above.');
    draft.focus(); draft.setSelectionRange(draft.value.length, draft.value.length);
  };
  window.addEventListener('storage', event => { if (event.key === VISIT_NOTES_KEY || event.key === null) count(); });
  const clearInvite = () => {
    invitation = ''; invitationExpiresAt = 0;
    el<HTMLTextAreaElement>('agent-instruction').value = ''; el('agent-instruction').hidden = true;
    el<HTMLButtonElement>('copy-invite').disabled = true; window.clearTimeout(invitationTimer);
  };
  const finishRequest = () => { pendingRequest = ''; window.clearTimeout(requestTimer); el<HTMLButtonElement>('create-invite').disabled = false; };
  const expiredInvite = () => { clearInvite(); el('agent-state').textContent = 'Invitation expired. Create another when your agent is ready.'; };
  const tab = (name: string) => {
    for (const section of dialog.querySelectorAll<HTMLElement>('[data-community-panel]')) section.hidden = section.dataset.communityPanel !== name;
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-community-tab]')) button.setAttribute('aria-pressed', String(button.dataset.communityTab === name));
  };
  const open = (exit = false) => {
    leaving = exit; tab('notes'); count();
    el('note-save').textContent = exit ? 'Save on this device & leave' : 'Save on this device';
    el('skip-visit').hidden = !exit;
    if (!dialog.open) dialog.showModal();
  };
  el('community-button').onclick = () => open();
  el('garden-button').onclick = () => { open(); tab('garden'); };
  el('close-community').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { leaving = false; el('world').focus(); });
  for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-community-tab]')) button.onclick = () => { tab(button.dataset.communityTab!); };
  el('skip-visit').onclick = leave;
  el<HTMLFormElement>('note-form').onsubmit = event => {
    event.preventDefault();
    const valuable = (dialog.querySelector('input[name="valuable"]:checked') as HTMLInputElement)?.value || 'skip';
    const note = visitNote({ valuable, takeaway: el<HTMLTextAreaElement>('takeaway').value, suggestion: el<HTMLTextAreaElement>('world-suggestion').value, allowWorldImprovement: el<HTMLInputElement>('donate-feedback').checked });
    const updated = [...readStored(), note].slice(-NOTE_LIMIT);
    try { localStorage.setItem(VISIT_NOTES_KEY, JSON.stringify(updated)); notes = updated; }
    catch { toast('Could not save. Browser storage may be disabled or full. You can still leave without saving.'); return; }
    el<HTMLFormElement>('note-form').reset(); count(); toast('Saved on this device. Nothing was uploaded or sent to an AI.');
    if (leaving) leave();
  };
  el('export-personal').onclick = () => { count(); download('beaververse-my-takeaways.json', { version: 1, kind: 'personal-notes', executionAuthority: 'none', notes: notes.map(n => ({ createdAt: n.createdAt, takeaway: n.takeaway })) }); };
  el('export-feedback').onclick = () => { count(); const evidence = communityEvidence(notes); if (!evidence.notes.length) { toast('No notes marked for world-improvement export.'); return; } download('beaververse-feedback.json', evidence); };
  el('delete-notes').onclick = () => {
    try { localStorage.removeItem(VISIT_NOTES_KEY); notes = []; count(); toast('Visit notes removed from this browser. Previously exported files are unchanged.'); }
    catch { toast('Could not access browser storage.'); }
  };
  el('create-invite').onclick = () => {
    if (!room.connected) { toast('Connect to the room server to add a companion.'); return; }
    if (pendingRequest) return;
    clearInvite(); proposalId = ''; el('agent-proposal').hidden = true;
    const scopes = ['observe', 'wave'];
    if (el<HTMLInputElement>('agent-move').checked) scopes.push('move');
    if (el<HTMLInputElement>('agent-propose').checked) scopes.push('propose');
    pendingRequest = crypto.randomUUID(); el<HTMLButtonElement>('create-invite').disabled = true;
    room.send({ type: 'agent-invite', scopes, requestId: pendingRequest }); el('agent-state').textContent = 'Preparing a one-use invitation…';
    requestTimer = window.setTimeout(() => { finishRequest(); clearInvite(); el('agent-state').textContent = 'No invitation response yet. Try again, or revoke any previous access.'; }, 5000);
  };
  el('copy-invite').onclick = async () => {
    if (!invitation) return;
    if (Date.now() >= invitationExpiresAt) { expiredInvite(); return; }
    try { await navigator.clipboard.writeText(invitation); toast('Invitation copied. Give it only to your own trusted agent; it expires after one minute.'); }
    catch { toast('Clipboard unavailable. Use the selected invitation text.'); el<HTMLTextAreaElement>('agent-instruction').select(); }
  };
  el('revoke-agent').onclick = () => {
    finishRequest(); clearInvite(); proposalId = ''; el('agent-proposal').hidden = true;
    if (!room.connected) { el('agent-state').textContent = 'Cannot confirm revocation while offline. Access ends when the server detects your departure or the grant expires.'; return; }
    room.send({ type: 'agent-revoke' }); el('agent-state').textContent = 'Revoking access…';
  };
  const decide = (accept: boolean) => { if (proposalId) room.send({ type: 'proposal-decide', id: proposalId, accept }); };
  el('accept-proposal').onclick = () => decide(true); el('decline-proposal').onclick = () => decide(false);
  el<HTMLFormElement>('garden-form').onsubmit = event => {
    event.preventDefault(); if (!room.connected) { toast('Connect to the room server to build together.'); return; }
    if (!gardenState || !plotSelect.selectedOptions.length || plotSelect.selectedOptions[0].disabled) return;
    room.send({ type: 'creation-set', creation: { kind: el<HTMLSelectElement>('creation-kind').value, plot: Number(el<HTMLSelectElement>('creation-plot').value) } });
  };
  el('remove-creation').onclick = () => { if (room.connected) room.send({ type: 'creation-remove' }); };
  refreshGarden();
  return {
    open, syncGarden,
    disconnected() { syncGarden(); finishRequest(); clearInvite(); proposalId = ''; el('agent-proposal').hidden = true; el('agent-state').textContent = 'No companion connected. Reconnect to invite one.'; },
    message(m: any) {
      if (m.type === 'error' && dialog.open) el('community-status').textContent = m.message;
      if (m.type === 'error' && pendingRequest && m.requestId === pendingRequest) { finishRequest(); clearInvite(); el('agent-state').textContent = `Invitation not confirmed: ${m.message}. Try again when ready.`; }
      if (m.type === 'agent-invite') {
        if (!pendingRequest || m.requestId !== pendingRequest) return;
        finishRequest(); clearInvite();
        if (m.expiresAt <= Date.now()) { expiredInvite(); return; }
        const socket = new URL(room.socket!.url); socket.protocol = socket.protocol === 'wss:' ? 'https:' : 'http:'; socket.pathname = '/api/agents'; socket.search = ''; socket.hash = '';
        invitationExpiresAt = m.expiresAt;
        invitation = `Connect to my Beaververse companion API at ${socket.href}. Read its API description and pair with this one-use code: ${m.code}. Granted scopes: ${m.scopes.join(', ')}. The code expires in 60 seconds; access ends after 15 minutes or when I leave or revoke it.`;
        el<HTMLTextAreaElement>('agent-instruction').value = invitation; el('agent-instruction').hidden = false; el<HTMLButtonElement>('copy-invite').disabled = false;
        el('agent-state').textContent = 'Ready to pair. Give the invitation to your own agent within one minute.';
        invitationTimer = window.setTimeout(expiredInvite, Math.max(0, m.expiresAt - Date.now()));
      }
      if (m.type === 'agent-status') { if (!pendingRequest) { clearInvite(); el('agent-state').textContent = m.message; } if (!m.connected) { proposalId = ''; el('agent-proposal').hidden = true; } }
      if (m.type === 'agent-proposal') {
        proposalId = m.proposal?.id || ''; el('agent-proposal').hidden = !proposalId;
        if (proposalId) { el('proposal-text').textContent = `Your agent proposes a ${m.proposal.creation.kind} in garden plot ${m.proposal.creation.plot + 1}. This replaces your current contribution only.`; toast('Your agent has a garden proposal. Review it under Your visit → Companion.'); }
      }
      if (m.type === 'creation-result') toast(m.message);
    },
  };
}
