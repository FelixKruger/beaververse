export type Player = { id: string; name: string; color: string; x: number; z: number; yaw: number; voice: boolean; wave: number };
type Handlers = { welcome: (id: string, players: Player[]) => void; state: (players: Player[]) => void; message: (data: any) => void; status: (state: string) => void };

export class RoomConnection {
  socket?: WebSocket;
  id = '';
  connected = false;
  constructor(private handlers: Handlers) {}
  connect(name: string, room: string, color: string) {
    const configured = (import.meta as any).env.VITE_ROOM_SERVER as string | undefined;
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    const sameOrigin = (import.meta as any).env.VITE_SAME_ORIGIN_SERVER === 'true';
    const endpoint = configured || ((local || sameOrigin) ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/room` : null);
    if (!endpoint) { this.handlers.status('solo'); return; }
    this.handlers.status('connecting');
    this.socket = new WebSocket(endpoint);
    const timer = window.setTimeout(() => { if (!this.connected) { this.socket?.close(); this.handlers.status('offline'); } }, 6000);
    this.socket.onopen = () => this.send({ type: 'join', name, room, color });
    this.socket.onmessage = event => {
      const m = JSON.parse(event.data);
      if (m.type === 'welcome') { clearTimeout(timer); this.connected = true; this.id = m.id; this.handlers.welcome(m.id, m.players); this.handlers.status('online'); }
      else if (m.type === 'state') this.handlers.state(m.players);
      else this.handlers.message(m);
    };
    this.socket.onclose = () => { clearTimeout(timer); this.connected = false; this.handlers.status('offline'); };
    this.socket.onerror = () => { this.handlers.status('offline'); };
  }
  send(data: object) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(data)); }
  close() { this.socket?.close(); this.connected = false; }
}
