# Local frontend and API routing

Use existing installed dependencies. In PowerShell at the repository root:

```powershell
$env:PORT = '5173'
$env:BASE_PATH = '/'
$env:COLLI_LOCAL_API_PORT = '3001'
corepack.cmd pnpm --filter @workspace/colli run dev
```

For the compiled frontend, stop development and run `corepack.cmd pnpm --filter @workspace/colli run serve` with the same process-local variables. Preview requires an existing frontend build. Stop either process with Ctrl+C.

Local mode binds Vite to `127.0.0.1`. Both workflows forward `/api` and its descendants unchanged to `http://127.0.0.1:3001`; the Express backend must separately use that port. The port must differ from the frontend port. Hostnames and URLs are rejected. Do not override Vite's host/port CLI options in local mode.

Connection failures and proxy timeouts return HTTP 503 JSON with `Cache-Control: no-store`. Frontend page routes retain SPA fallback. The backend is not started by these commands, and no database configuration or credentials are needed to verify the unavailable state.

Without `COLLI_LOCAL_API_PORT`, existing hosting configuration is retained. This proxy belongs to Vite development/preview only: compiled production assets still use same-origin `/api` and require the deployment's API routing. Do not use Vite preview as a production server.

Offline checks: `node --test tests/api-integrity.test.mjs tests/local-api-proxy.test.mjs`. No real backend or external APIs are called by these tests.
