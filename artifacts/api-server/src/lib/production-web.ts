import express, { type Express } from 'express';
import { isAbsolute, join } from 'node:path';
import { statSync } from 'node:fs';

// Mount before session middleware: static requests never load or create sessions.
export function productionWeb(app: Express, env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV !== 'production') return;
  const root = env.FRONTEND_DIST;
  if (!root || !isAbsolute(root) || !statSync(join(root, 'index.html')).isFile()) {
    throw new Error('A built FRONTEND_DIST directory is required');
  }
  const assets = express.static(root, { dotfiles: 'deny', index: false, redirect: false });
  app.use((req, res, next) => {
    if (/^\/api(?:\/|$)/i.test(req.path)) { next(); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.sendStatus(404); return; }
    assets(req, res, error => {
      if (error) { next(error); return; }
      // Missing assets must not receive HTML (including Vite's /assets paths).
      if (req.path.includes('.') || req.path.startsWith('/assets/') || !req.accepts('html')) {
        res.sendStatus(404); return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(root, 'index.html'));
    });
  });
}
