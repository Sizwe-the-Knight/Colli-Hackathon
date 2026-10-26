import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import session, { type SessionOptions, type Store } from "express-session";
import { sessions } from './session-runtime';
import { ABSOLUTE_MS, Unauthenticated } from './session-policy';

export const cookieName = "connect.sid";
export function cookieOptions(production: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, secure: production, path: "/" };
}

export function securityConfig(env: NodeJS.ProcessEnv) {
  const production = env.NODE_ENV === "production";
  const origin = env.APP_ORIGIN ?? (production ? "" : "http://127.0.0.1:5173");
  const origins = [origin, ...(env.CORS_ORIGINS?.split(",") ?? [])].map(value => {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value.trim() ||
        (production && url.protocol !== "https:")) throw new Error("Invalid application origin configuration");
    return url.origin;
  });
  return { production, origins: new Set(origins), host: env.HOST || "127.0.0.1" };
}

export function sessionOptions(env: NodeJS.ProcessEnv, store?: Store): SessionOptions {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  if (!store || store instanceof session.MemoryStore) throw new Error("A persistent session store is required");
  return { store, name: cookieName, secret: env.SESSION_SECRET, resave: false, saveUninitialized: false, rolling: false,
    cookie: { ...cookieOptions(env.NODE_ENV === 'production'), maxAge: ABSOLUTE_MS } };
}

export function originProtection(origins: Set<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get("origin");
    const unsafe = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    let source = origin;
    if (!source && unsafe && req.get("referer")) {
      try { source = new URL(req.get("referer")!).origin; } catch { /* reject below */ }
    }
    if ((source && !origins.has(source)) || (unsafe && !source)) {
      res.status(403).json({ error: "Request origin not allowed" }); return;
    }
    next();
  };
}

export function corsOptions(origins: Set<string>) {
  return { credentials: true, origin: (origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) =>
    callback(null, !!origin && origins.has(origin)) };
}

function capCookie(req: Request) {
  if (!req.session) return;
  // express-session calls touch() at response end, even with rolling=false.
  // Keep its cookie at the immutable absolute deadline rather than sliding it.
  Object.defineProperty(req.session, 'touch', { configurable: true, value() {
    if (Number.isSafeInteger(req.session.absoluteExpiresAt)) {
      req.session.cookie.expires = new Date(req.session.absoluteExpiresAt!);
    }
    return req.session;
  } });
}

export function absoluteCookie(req: Request, _res: Response, next: NextFunction) {
  capCookie(req);
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!Number.isSafeInteger(req.session?.userId) || req.session.userId! <= 0) {
    res.status(401).json({ error: "Not authenticated" }); return;
  }
  try {
    const identity = await sessions.authenticate(req.sessionID);
    Object.assign(req.session, identity);
    res.setHeader('Cache-Control', 'no-store');
    next();
  } catch (error) { next(error); }
}

export async function establishSession(req: Request, res: Response, userId: number) {
  try {
    await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    capCookie(req);
    req.session.userId = userId;
    await sessions.issuing(userId, () => new Promise<void>((resolve, reject) =>
      req.session.save(error => error ? reject(error) : resolve())));
  } catch {
    delete req.session?.userId;
    if (req.session) await new Promise<void>(resolve => req.session.destroy(() => resolve()));
    res.clearCookie(cookieName, cookieOptions(process.env.NODE_ENV === "production"));
    throw new Error("Session establishment failed");
  }
}

async function endSession(req: Request, res: Response, all: boolean) {
  try {
    if (!Number.isSafeInteger(req.session?.userId) || req.session.userId! <= 0) throw new Unauthenticated();
    const result = await sessions.revoke(req.sessionID, all);
    await new Promise<void>((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie(cookieName, cookieOptions(process.env.NODE_ENV === 'production'));
    if (result === 'invalid_session') { res.status(401).json({ error: 'Not authenticated' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.clearCookie(cookieName, cookieOptions(process.env.NODE_ENV === "production"));
    res.status(error instanceof Unauthenticated ? 401 : 503).json({ error:
      error instanceof Unauthenticated ? 'Not authenticated' : 'Logout could not be completed' });
  }
}

export const logout = (req: Request, res: Response) => endSession(req, res, false);
export const logoutAll = (req: Request, res: Response) => endSession(req, res, true);

export const safeErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) { next(error); return; }
  if (error instanceof Unauthenticated) { res.status(401).json({ error: 'Not authenticated' }); return; }
  if (error?.type === "entity.parse.failed") { res.status(400).json({ error: "Invalid JSON request" }); return; }
  if (error?.type === "entity.too.large") { res.status(413).json({ error: "Request too large" }); return; }
  res.status(503).json({ error: "Service temporarily unavailable" });
};
