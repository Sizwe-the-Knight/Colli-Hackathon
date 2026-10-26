# Snapshot setup — no credentials included

This source snapshot is derived from release candidate ab14977. It is not the
founder’s production deployment and does not contain private history or secrets.
The existing beta is https://colli-hackathon-demo.onrender.com. Signing up there
needs no provider key; operating your own installation requires your own database.

## Toolchain and installation

Use Node **24.21.0**, Corepack and pnpm **11.25.0**. Commands run at this checkout’s
root. On Windows use `corepack.cmd`; on POSIX use `corepack` and equivalent shell
environment assignment. Windows installation also needs a working sh command
(such as Git for Windows) for the existing root preinstall hook. No global pnpm
install or execution-policy change is needed.

```powershell
corepack.cmd pnpm install --frozen-lockfile --prod=false
corepack.cmd pnpm run typecheck
$env:PORT = '5173'
$env:BASE_PATH = '/'
corepack.cmd pnpm --filter @workspace/colli run build
corepack.cmd pnpm --filter @workspace/api-server run build
```

**Known verification limitation:** a fresh offline frozen-lockfile check cannot
finish without missing cached registry metadata. Keep the frozen lockfile,
minimum-release-age policy and exact bcrypt/esbuild build approvals. Do not bypass
these policies to get an install to pass. The snapshot’s four Replit-only dependency
removals change no retained package resolution. Tests/builds using existing local
dependencies are not proof of a new clean install; see SNAPSHOT_REVIEW.md for results.
A normal networked frozen install is a release reproducibility gate.

## Database prerequisites — operator action, never automatic

Use a separate PostgreSQL 17 database. Do not point development or installation
commands at the founder’s live database. A blank database, or users table alone,
is insufficient: startup checks users, persistent sessions, revocation functions
and durable authentication limits under restricted `colli_app` privileges.

For a new Neon project, read `lib/db/hosted/v1/RUNBOOK.md` and run its offline artifact
verifier first. Its recorded project/preflight context describes the original
installation, not verified permissions for your new project. Independently perform
its capability and rollback-only ownership probes, review results, then approve
initialization separately. Use a **direct/unpooled** endpoint, psql 17, verify-full
TLS and a trusted CA. The runbook requires fresh-connection verification and private
runtime-password provisioning. Preserve reviewed SQL and actual hash/provenance
records; do not fabricate Drizzle history or run drizzle-kit push. Do not repeat
installation against an already provisioned database.

Retain separate administrator, migrator, restricted function-owner and runtime
roles. Only `colli_app` belongs in the API environment. Never weaken certificate
validation or use administrator credentials as a startup workaround. Local-only
migrations include guarded procedures; read AUTH_SECURITY.md and the session review
files before provisioning a local disposable cluster.

## Run locally, narration disabled

The application does **not** load .env files automatically. Supply secrets privately
in the exact PowerShell process starting Node, using README’s Read-Host secure input
procedure. Do not enter literal placeholder strings as real secrets.

Backend configuration names (documentation only):

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3001
APP_ORIGIN=http://127.0.0.1:5173
DATABASE_URL=postgresql://colli_app:<URL-encoded-runtime-password>@<direct-neon-host>:5432/neondb?sslmode=verify-full
SESSION_SECRET=<private-stable-random-value-at-least-32-characters>
NEBIUS_NARRATION_ENABLED=false
NEBIUS_MAX_CALLS=0
NEBIUS_TOKEN_BUDGET=0
```

For an independently provisioned local disposable database, use its approved
loopback database URL instead. Passwords in URLs must be URL-encoded. Node uses its
trusted CA store; if necessary supply a separately verified public CA with
NODE_EXTRA_CA_CERTS before process startup. No real hostname or credential is
provided by this snapshot. Do not set NODE_TLS_REJECT_UNAUTHORIZED=0 or disable TLS
for a hosted connection. Never put DATABASE_URL, SESSION_SECRET or a Nebius key in
VITE_* variables.

After privately setting backend variables, start the already-built API:

```powershell
corepack.cmd pnpm --filter @workspace/api-server run start
```

In a separate PowerShell window, at this checkout’s root:

```powershell
$env:PORT = '5173'
$env:BASE_PATH = '/'
$env:COLLI_LOCAL_API_PORT = '3001'
corepack.cmd pnpm --filter @workspace/colli run dev
```

Open http://127.0.0.1:5173 through Vite, never a file URL. Its proxy forwards /api
to the backend. /api/healthz checks process availability; /api/readyz checks actual
security prerequisites. Ctrl+C stops each application process. Gracefully stop a
locally started PostgreSQL cluster with its own approved pg_ctl procedure. These
commands do not provision or start a database.

## Optional genuine Nebius narration

The default deterministic Brief works without Nebius. Enabling generation is a
separate operator decision that consumes your credits. First install and independently
verify the additive quota upgrade under `lib/db/hosted/narration-v1/README.md` on your
own provisioned database. No default demo account, judge identity or ledger is supplied.

Only after that prerequisite, configure the backend privately:

```dotenv
NEBIUS_NARRATION_ENABLED=true
NEBIUS_BUDGET_BACKEND=postgres
NEBIUS_MODEL=nvidia/Nemotron-3_5-Lightning
NEBIUS_MAX_CALLS=100
NEBIUS_TOKEN_BUDGET=870400
NEBIUS_API_KEY=<private-Token-Factory-key>
# NEBIUS_JUDGE_ACCOUNT_IDS: optional private list of verified numeric account IDs
```

Leave NEBIUS_BUDGET_FILE unset for PostgreSQL-backed hosted quotas. No endpoint
substitution is required: the adapter uses the public Token Factory chat-completions
endpoint documented in NARRATOR.md. Keep the existing 512-output-token cap,
8,704-token reservation, no-retry policy, three-lifetime-attempts/account limit,
and 80 public / 20 reserved-judge allocations. Do not reset accounting to recover
spent attempts. There is no October expiry; credits and service availability still
limit access. A cap in tokens/attempts is not a guaranteed currency charge.

An authenticated user deliberately selects **Explain with NVIDIA Nemotron**.
Only the fixed synthetic findings are sent, not account details/provider preferences.
Successful wording is attributed; rejected/unavailable/exhausted generation keeps
deterministic wording. Login, refresh, navigation and the Health Score preview
never initiate generation. Unchanged validated results are reused per account.

## Production reference

DEPLOYMENT.md gives same-origin React/Express Render settings with placeholder
runtime values and the fail-closed proxy contract. Use the assigned service URL
for APP_ORIGIN, host-assigned PORT and an absolute FRONTEND_DIST. Confirm your
service’s ingress and database readiness before enabling traffic. Never run Vite
preview as the production server. This snapshot performs no deployment, database
operation, account provisioning or inference request.
