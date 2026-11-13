export type Player = { id: string; name: string; color: string; x: number; z: number; yaw: number; voice: boolean; wave: number };
type Handlers = { welcome: (id: string, players: Player[]) => void; state: (players: Player[]) => void; message: (data: any) => void; status: (state: string) => void };

export class RoomConnection {
  socket?: WebSocket;
  id = '';
  connected = false;
  private generation = 0;
  private retryTimer = 0;
  private connectTimer = 0;
  constructor(private handlers: Handlers) {}
  connect(name: string, room: string, color: string) {
    this.close();
    const generation = this.generation;
    const configured = (import.meta as any).env.VITE_ROOM_SERVER as string | undefined;
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    const sameOrigin = (import.meta as any).env.VITE_SAME_ORIGIN_SERVER === 'true';
    const endpoint = configured || ((local || sameOrigin) ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/room` : null);
    if (!endpoint) { this.handlers.status('solo'); return; }
    let attempt = 0;
    const open = () => {
      if (generation !== this.generation) return;
      this.handlers.status(attempt ? 'reconnecting' : 'connecting');
      const socket = new WebSocket(endpoint);
      this.socket = socket;
      const current = () => generation === this.generation && this.socket === socket;
      this.connectTimer = window.setTimeout(() => { if (current() && !this.connected) socket.close(); }, 10000);
      socket.onopen = () => { if (current()) this.send({ type: 'join', name, room, color }); };
      socket.onmessage = event => {
        if (!current()) return;
        const m = JSON.parse(event.data);
        if (m.type === 'welcome') { window.clearTimeout(this.connectTimer); attempt = 0; this.connected = true; this.id = m.id; this.handlers.welcome(m.id, m.players); this.handlers.status('online'); }
        else if (m.type === 'state') this.handlers.state(m.players);
        else this.handlers.message(m);
      };
      socket.onclose = event => {
        if (!current()) return;
        window.clearTimeout(this.connectTimer); this.connected = false; this.handlers.status('offline');
        // Policy/size rejection needs an explicit new join, not a reconnect loop.
        if ([1008, 1009].includes(event.code)) return;
        const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)) + Math.random() * 500;
        this.retryTimer = window.setTimeout(open, delay);
      };
      socket.onerror = () => {}; // onclose owns cleanup/retry, including failed handshakes.
    };
    open();
  }
  send(data: object) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(data)); }
  close() {
    this.generation++;
    window.clearTimeout(this.retryTimer); window.clearTimeout(this.connectTimer);
    this.socket?.close(); this.socket = undefined; this.connected = false;
  }
}
