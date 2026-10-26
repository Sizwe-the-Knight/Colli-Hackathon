import type { Express, Request, RequestHandler } from 'express';
import { isIP } from 'node:net';
export interface AttemptStore { take(kind: 'login' | 'register', network: string): Promise<number> }

const renderPeer = (ip: string | undefined) => ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
const renderMode = (env: NodeJS.ProcessEnv) => env.PROXY_MODE === 'render';

function singleHeader(req: Request, name: string): string | undefined {
  let count = 0;
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    if (req.rawHeaders[i]!.toLowerCase() === name) count++;
  }
  if (count !== 1) return undefined;
  return req.get(name);
}

function renderNetwork(req: Request): string {
  // Trust only the observed Render loopback path, never an X-Forwarded-For entry.
  const ip = singleHeader(req, 'cf-connecting-ip');
  if (!renderPeer(req.socket.remoteAddress) || singleHeader(req, 'x-forwarded-proto') !== 'https' ||
      !req.secure || !ip || !isIP(ip) || ip.includes('%')) throw new Error('Render ingress rejected');
  return clientNetwork(ip);
}

export function renderRequestProtection(env: NodeJS.ProcessEnv): RequestHandler {
  if (!renderMode(env)) return (_req, _res, next) => next();
  const host = new URL(env.APP_ORIGIN!).host;
  const matchesHost = (value: string | undefined) => value?.toLowerCase() === host || value?.toLowerCase() === `${host}:443`;
  return (req, res, next) => {
    // Render's internal health probes need no browser headers and never load sessions.
    if (['GET','HEAD'].includes(req.method) && ['/api/healthz','/api/readyz'].includes(req.path)) { next(); return; }
    try { renderNetwork(req); }
    catch { res.status(503).json({ error: 'Service temporarily unavailable' }); return; }
    if (!matchesHost(singleHeader(req, 'host')) ||
        (req.headers['x-forwarded-host'] !== undefined && !matchesHost(singleHeader(req, 'x-forwarded-host')))) {
      res.status(421).json({ error: 'Request host not allowed' }); return;
    }
    next();
  };
}

export function clientNetwork(ip: string | undefined): string {
  if (!ip) throw new Error('Client unavailable');
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) return ip.slice(7);
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6 || ip.includes('%')) throw new Error('Client unavailable');
  // Canonicalize compression/embedded IPv4, then group IPv6 privacy addresses /64.
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left, right = ''] = canonical.split('::');
  const a = left ? left.split(':') : [], b = right ? right.split(':') : [];
  const parts = canonical.includes('::') ? [...a, ...Array<string>(8-a.length-b.length).fill('0'), ...b] : a;
  return parts.slice(0, 4).map(part => parseInt(part, 16).toString(16)).join(':') + '::/64';
}

export function proxyConfiguration(app: Express, env: NodeJS.ProcessEnv) {
  if (env.PROXY_MODE && !renderMode(env)) throw new Error('Unknown proxy mode');
  if (renderMode(env)) {
    const origin = new URL(env.APP_ORIGIN ?? '');
    if (env.NODE_ENV !== 'production' || env.RENDER !== 'true' || env.TRUSTED_PROXY_ADDRESSES !== undefined ||
        !env.RENDER_EXTERNAL_HOSTNAME || !/^[a-z0-9-]+\.onrender\.com$/.test(env.RENDER_EXTERNAL_HOSTNAME) ||
        origin.origin !== env.APP_ORIGIN || origin.origin !== `https://${env.RENDER_EXTERNAL_HOSTNAME}` || env.CORS_ORIGINS) {
      throw new Error('Invalid Render proxy configuration');
    }
    app.set('trust proxy', renderPeer);
    return;
  }
  if (env.NODE_ENV === 'production' && env.RENDER === 'true') throw new Error('Explicit Render proxy mode required');
  const entries = env.TRUSTED_PROXY_ADDRESSES?.split(',').map(value => value.trim()) ?? [];
  for (const entry of entries) {
    const [ip, bits] = entry.split('/');
    const family = isIP(ip!);
    if (!family || entry.split('/').length > 2 || (bits !== undefined &&
      (!/^\d+$/.test(bits) || Number(bits) < (family === 4 ? 8 : 32) || Number(bits) > (family === 4 ? 32 : 128)))) {
      throw new Error('Explicit narrow proxy IPs/CIDRs required');
    }
  }
  if (env.NODE_ENV === 'production' && !entries.length) throw new Error('Verified HTTPS proxy configuration required');
  if (entries.length) app.set('trust proxy', entries);
}

export function authProtection(env: NodeJS.ProcessEnv, store: AttemptStore): RequestHandler {
  return async (req, res, next) => {
    const path = req.path.toLowerCase().replace(/\/$/, '');
    if (req.method !== 'POST' || !['/auth/register','/auth/login'].includes(path)) { next(); return; }
    try {
      if (env.NODE_ENV === 'production' && (!req.secure || !req.app.get('trust proxy fn')(req.socket.remoteAddress, 0))) {
        res.status(503).json({ error: 'Authentication temporarily unavailable' }); return;
      }
      const network = renderMode(env) ? renderNetwork(req) : clientNetwork(req.ip);
      const wait = await store.take(path === '/auth/login' ? 'login' : 'register', network);
      res.setHeader('Cache-Control', 'no-store');
      if (wait) { res.setHeader('Retry-After', String(wait)); res.status(429).json({ error: 'Too many attempts. Please try again later.' }); return; }
      next();
    } catch { res.status(503).json({ error: 'Authentication temporarily unavailable' }); }
  };
}
