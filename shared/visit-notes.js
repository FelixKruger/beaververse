export const VISIT_NOTES_KEY = 'beaververse.visit-notes.v1';
export const NOTE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const NOTE_LIMIT = 20;
const clean = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '';
export function visitNote(input, now = Date.now()) {
  return {
    version: 1, createdAt: now,
    valuable: ['yes', 'no', 'skip'].includes(input.valuable) ? input.valuable : 'skip',
    takeaway: clean(input.takeaway, 1500), suggestion: clean(input.suggestion, 1500),
    allowWorldImprovement: input.allowWorldImprovement === true,
  };
}
export function loadNotes(raw, now = Date.now()) {
  try {
    const list = JSON.parse(raw || '[]'); if (!Array.isArray(list)) return [];
    return list.filter(n => n && n.version === 1 && Number.isFinite(n.createdAt) && n.createdAt <= now && n.createdAt > now - NOTE_RETENTION_MS)
      .slice(-NOTE_LIMIT).map(n => visitNote(n, n.createdAt));
  } catch { return []; }
}
export function communityEvidence(notes) {
  return {
    version: 1, kind: 'beaververse-voluntary-feedback', executionAuthority: 'none',
    notes: notes.filter(n => n.allowWorldImprovement).map(n => ({ createdAt: n.createdAt, valuable: n.valuable, suggestion: n.suggestion, consent: 'world-improvement-export' })),
  };
}
