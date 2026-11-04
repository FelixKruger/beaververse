const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) => record(x) && Object.keys(x).every(k => keys.includes(k));
const short = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max && !/[\u0000-\u001f\u007f]/.test(s);

export function validMessage(m) {
  if (!record(m)) return false;
  switch (m.type) {
    case 'join': return exact(m, ['type', 'name', 'room', 'color']) && short(m.name, 24) && typeof m.room === 'string' && /^[a-z0-9-]{1,32}$/.test(m.room) && ['moss', 'amber', 'sky', 'berry'].includes(m.color);
    case 'move': return exact(m, ['type', 'x', 'z', 'yaw']) && [m.x, m.z, m.yaw].every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1000);
    case 'chat': return exact(m, ['type', 'text']) && short(m.text, 280) && m.text.trim().length > 0;
    case 'wave': return exact(m, ['type']);
    case 'voice': return exact(m, ['type', 'enabled']) && typeof m.enabled === 'boolean';
    case 'signal': {
      if (!exact(m, ['type', 'to', 'signal']) || !short(m.to, 36) || !record(m.signal)) return false;
      const s = m.signal;
      if (s.kind === 'description') return exact(s, ['kind', 'description']) && exact(s.description, ['type', 'sdp']) && ['offer', 'answer'].includes(s.description.type) && typeof s.description.sdp === 'string' && s.description.sdp.length <= 12000;
      if (s.kind === 'candidate') return exact(s, ['kind', 'candidate']) && exact(s.candidate, ['candidate', 'sdpMid', 'sdpMLineIndex', 'usernameFragment']) && typeof s.candidate.candidate === 'string' && s.candidate.candidate.length <= 1500 && (s.candidate.sdpMid == null || short(s.candidate.sdpMid, 32)) && (s.candidate.sdpMLineIndex == null || Number.isInteger(s.candidate.sdpMLineIndex) && s.candidate.sdpMLineIndex >= 0 && s.candidate.sdpMLineIndex <= 8) && (s.candidate.usernameFragment == null || short(s.candidate.usernameFragment, 256));
      return false;
    }
    default: return false;
  }
}

export function consume(bucket, now, cost = 1) {
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + (now - bucket.time) * bucket.rate / 1000);
  bucket.time = now;
  if (bucket.tokens < cost) return false;
  bucket.tokens -= cost;
  return true;
}

export const bucket = (capacity, rate) => ({ capacity, rate, tokens: capacity, time: Date.now() });
