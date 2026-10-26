import app, { persistentSessionStore } from "./app";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error("Invalid PORT configuration");
}

const host = process.env.HOST || "127.0.0.1";
// Never listen until the actual PostgreSQL session prerequisites pass.
export const startup = (async () => {
  try {
    await persistentSessionStore.initialize();
    const server = app.listen(port, host, (err) => {
      if (err) {
        logger.error("Error listening on configured address");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      server.close(() => {
        void pool.end().catch(() => { process.exitCode = 1; });
      });
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  } catch {
    logger.error("Persistent session initialization failed; API not started");
    process.exitCode = 1;
    await pool.end().catch(() => {});
  }
})();
