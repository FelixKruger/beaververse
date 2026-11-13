const developmentOrigins = 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8788,http://localhost:8788';

export function serverConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  if (production && !env.ALLOWED_ORIGINS?.trim()) throw new Error('Production requires explicit ALLOWED_ORIGINS');
  const origins = (env.ALLOWED_ORIGINS || developmentOrigins).split(',').map(value => value.trim());
  for (const origin of origins) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error('ALLOWED_ORIGINS must contain exact URL origins'); }
    if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol) || (production && parsed.protocol !== 'https:')) {
      throw new Error('ALLOWED_ORIGINS requires exact origins without paths or wildcards; production requires HTTPS');
    }
  }
  const port = Number(env.PORT ?? 8788);
  if (!Number.isInteger(port) || port < 0 || port > 65535 || (production && port === 0)) throw new Error('Invalid PORT');
  return { production, origins, port, host: env.HOST || (production ? '0.0.0.0' : '127.0.0.1') };
}
