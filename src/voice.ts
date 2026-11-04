import { RoomConnection, type Player } from './network';

export class VoiceCircle {
  stream?: MediaStream;
  peers = new Map<string, RTCPeerConnection>();
  audio = new Map<string, HTMLAudioElement>();
  private candidates = new Map<string, RTCIceCandidateInit[]>();
  private generation = 0;
  constructor(private room: RoomConnection, private notify: (message: string) => void) {}
  async join() {
    if (!this.room.connected) throw new Error('Voice needs a connected room.');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Voice needs HTTPS or localhost and microphone support.');
    const generation = ++this.generation;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    if (generation !== this.generation || !this.room.connected) { stream.getTracks().forEach(t => t.stop()); throw new Error('Voice request cancelled because the room connection changed.'); }
    this.stream = stream;
    this.room.send({ type: 'voice', enabled: true });
  }
  leave() {
    this.generation++;
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = undefined;
    for (const id of this.peers.keys()) this.remove(id);
    this.room.send({ type: 'voice', enabled: false });
  }
  sync(players: Player[]) {
    const others = players.filter(p => p.id !== this.room.id && p.voice);
    for (const id of this.peers.keys()) if (!others.some(p => p.id === id)) this.remove(id);
    if (!this.stream) return;
    for (const p of others) if (!this.peers.has(p.id) && this.room.id < p.id) void this.offer(p.id);
  }
  private create(id: string) {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.peers.set(id, peer);
    for (const track of this.stream?.getTracks() || []) peer.addTrack(track, this.stream!);
    peer.onicecandidate = e => { if (e.candidate) this.room.send({ type: 'signal', to: id, signal: { kind: 'candidate', candidate: e.candidate.toJSON() } }); };
    peer.ontrack = e => {
      const el = document.createElement('audio'); el.autoplay = true; el.srcObject = e.streams[0];
      this.audio.get(id)?.remove(); this.audio.set(id, el); document.body.append(el);
      void el.play().catch(() => this.notify('Tap Join voice again if your browser blocks audio playback.'));
    };
    peer.onconnectionstatechange = () => { if (peer.connectionState === 'failed') this.notify('A voice connection failed. A relay may be needed for this network.'); };
    return peer;
  }
  private async offer(id: string) {
    const peer = this.create(id);
    try { await peer.setLocalDescription(await peer.createOffer()); this.room.send({ type: 'signal', to: id, signal: { kind: 'description', description: peer.localDescription?.toJSON() } }); }
    catch { this.remove(id); this.notify('Could not open a voice connection.'); }
  }
  async signal(from: string, signal: any) {
    if (!this.stream || from === this.room.id) return;
    try {
      if (signal.kind === 'description') {
        const peer = this.peers.get(from) || this.create(from);
        await peer.setRemoteDescription(signal.description);
        for (const candidate of this.candidates.get(from) || []) await peer.addIceCandidate(candidate);
        this.candidates.delete(from);
        if (signal.description.type === 'offer') { await peer.setLocalDescription(await peer.createAnswer()); this.room.send({ type: 'signal', to: from, signal: { kind: 'description', description: peer.localDescription?.toJSON() } }); }
      } else if (signal.kind === 'candidate') {
        const peer = this.peers.get(from);
        if (peer?.remoteDescription) await peer.addIceCandidate(signal.candidate);
        else { const list = this.candidates.get(from) || []; if (list.length < 32) list.push(signal.candidate); this.candidates.set(from, list); }
      }
    } catch { this.notify('A voice connection could not be negotiated.'); }
  }
  private remove(id: string) { this.peers.get(id)?.close(); this.peers.delete(id); this.audio.get(id)?.remove(); this.audio.delete(id); this.candidates.delete(id); }
  async stats() {
    const reports = [];
    for (const [id, peer] of this.peers) { const stats = await peer.getStats(); reports.push({ id, state: peer.connectionState, inboundAudio: [...stats.values()].filter(r => r.type === 'inbound-rtp' && r.kind === 'audio').map(r => ({ bytesReceived: r.bytesReceived, packetsReceived: r.packetsReceived, audioLevel: r.audioLevel })) }); }
    return { capturing: !!this.stream?.getAudioTracks().some(t => t.readyState === 'live'), peers: reports };
  }
}
