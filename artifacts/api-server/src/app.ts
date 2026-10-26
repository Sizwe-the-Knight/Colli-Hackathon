import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import { PersistentSessionStore } from './lib/session-runtime';
import router from "./routes";
import healthRouter from "./routes/health";
import { logger } from "./lib/logger";
import { productionWeb } from './lib/production-web';
import { authProtection, proxyConfiguration, renderRequestProtection } from './lib/auth-limits';
import { PostgresAuthAttempts } from './lib/postgres-auth-attempts';
import { securityConfig, sessionOptions, originProtection, corsOptions, safeErrorHandler, absoluteCookie } from "./lib/security";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required.");
}

const app: Express = express();
const security = securityConfig(process.env);
app.disable("x-powered-by");
// Explicit peer trust only; Render mode uses its validated Cloudflare client header.
proxyConfiguration(app, process.env);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
      err() { return { type: "RequestError" }; },
    },
  }),
);

app.use(renderRequestProtection(process.env));
app.use(originProtection(security.origins));
app.use(cors(corsOptions(security.origins)));

productionWeb(app, process.env);
app.use('/api', authProtection(process.env, new PostgresAuthAttempts()));
app.use(express.json({ limit: "16kb" }));

// Probes must not load a browser session before reporting process/store health.
app.use("/api", healthRouter);
export const persistentSessionStore = new PersistentSessionStore();
app.use(
  '/api',
  session(sessionOptions(process.env, persistentSessionStore)),
);
app.use('/api', absoluteCookie);

app.use("/api", router);
app.use('/api', (_req, res) => { res.status(404).json({ error: 'API route not found' }); });
app.use(safeErrorHandler);

export default app;
