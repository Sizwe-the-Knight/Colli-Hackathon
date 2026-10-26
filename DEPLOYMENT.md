# Zero-dollar hosted demo — Render Free + Neon Free

Deployment reference for a separately approved installation. The founder reports
Colli’s existing hosted demo is working; this snapshot makes no deployment changes.
Do not rerun bootstrap against that existing database. Use placeholders below for
your own service and verified database; historical acceptance is not transferable.
Use one Render Free Linux x64/glibc Node web service serving React + Express,
connected to Neon Free PostgreSQL. No paid plans, disks, domains, subscriptions
or payment-card commitments are approved. Stop if either signup requires a card. Node 24.21.0 and pnpm 11.25.0 match the local toolchain. Corepack uses
the root packageManager pin; initial installation may need registry access.

## Build and start

Render form: your approved source repository and branch, Root Directory blank,
runtime Node, Frankfurt, Free instance, no disk, no pre-deploy command. Keep
manual deployment approval and Health Check Path `/api/readyz`. Obtain separate
approval before provisioning or deploying anything.

Build Command (one line; Linux shell, repository root):

```sh
corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm run typecheck && PORT=5173 BASE_PATH=/ corepack pnpm --filter @workspace/colli run build && corepack pnpm --filter @workspace/api-server run build
```

Start Command (repository root):

```text
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

Frontend build environment: `PORT=5173`, `BASE_PATH=/`, `NODE_ENV=production`.
Unset `COLLI_LOCAL_API_PORT`; production uses relative `/api` requests. Runtime
PORT is the host-assigned port, not the build-only value. Keep runtime dependencies
(including externalized bcrypt) and all backend build output available. The root
preinstall shell command is intended for the existing Windows tooling/Linux shell;
do not remove platform dependency overrides to work around a failed build.

Production runtime names/placeholders (not real credentials):

```dotenv
NODE_ENV=production
NODE_VERSION=24.21.0
SKIP_INSTALL_DEPS=true
HOST=0.0.0.0
FRONTEND_DIST=/opt/render/project/src/artifacts/colli/dist/public
APP_ORIGIN=https://<your-render-service>.onrender.com
PROXY_MODE=render
SESSION_SECRET=<private-stable-random-secret-at-least-32-characters>
DATABASE_URL=postgresql://colli_app:<URL-encoded-private-password>@<direct-neon-host>:5432/neondb?sslmode=verify-full
NEBIUS_NARRATION_ENABLED=false
NEBIUS_MODEL=nvidia/Nemotron-3_5-Lightning
NEBIUS_MAX_CALLS=0
NEBIUS_TOKEN_BUDGET=0
```

Do not set PORT in the form: use Render's assigned PORT (default 10000). The inline
5173 applies only to Vite's build command. SKIP_INSTALL_DEPS prevents Render's
automatic npm/yarn install; the explicit Corepack/pnpm install includes build tools.
The FRONTEND_DIST above is the native Node checkout path with Root Directory blank,
matching Vite's `artifacts/colli/dist/public` output; it is not a Docker `/app` path.
Set APP_ORIGIN to the literal assigned `https://<name>.onrender.com` origin without
a trailing slash, matching Render's RENDER_EXTERNAL_URL. Do not paste a literal
`$RENDER_EXTERNAL_URL` into the environment form and assume shell expansion.
Keep SESSION_SECRET stable, private and randomly generated (at least 32 characters).
Never use the Neon administrator URL at runtime. The default disabled setup has
no NEBIUS_API_KEY; optional controlled narration is documented in SNAPSHOT_SETUP.md.
Remove TRUSTED_PROXY_ADDRESSES, CORS_ORIGINS and COLLI_LOCAL_API_PORT. Render supplies
RENDER=true and RENDER_EXTERNAL_HOSTNAME=<your-render-service>.onrender.com; do not
override them. Render mode rejects a missing/mismatched platform identity or origin.

The installed pg client enables TLS from `sslmode=verify-full`, retains Node's
certificate verification and sets the TLS servername to the database hostname.
Use the exact direct Neon DNS hostname, not an IP. Node's trusted public CA store
is used by default; if an additional verified CA is required, provide its public
PEM as a Render secret file and use `NODE_EXTRA_CA_CERTS=/etc/secrets/<filename>`.
Do not set NODE_TLS_REJECT_UNAUTHORIZED=0, sslmode=no-verify/disable, or replace
hostname verification. Windows PGSSLROOTCERT configuration is not inherited by
Render's Node process. Hosted Node TLS still needs live acceptance; no connection
was made in this review.

Omit CORS_ORIGINS for this
same-origin layout. Do not use Vite dev/preview as the production server. Express
serves static files/SPA before sessions; `/api` remains API-only. SPA HTML uses
revalidation; missing assets return 404. Public frontend code is not authorization:
all operational API routes remain protected. Health is `/api/healthz`; readiness
is `/api/readyz`. Startup still refuses to listen unless session prerequisites pass.

## Required hosting gates

- Use PROXY_MODE=render only on this tested public Render service. It trusts only
  the observed 127.0.0.1 socket peer (including its IPv4-mapped representation),
  requires exactly one valid CF-Connecting-IP and exactly one HTTPS protocol header,
  and ignores X-Forwarded-For for authentication limits. Changed ingress fails closed.
- Keep SESSION_SECRET stable and private across redeployments. Secure, HttpOnly,
  SameSite=Lax cookies and origin protection remain required; never use MemoryStore.
- Use colli_app only at runtime, no role memberships/admin credential. Use the
  provider's verified TLS configuration/certificate chain; do not disable certificate
  verification. The founder reports hosted initialization and colli_app readiness
  accepted; do not reapply initialization or local migrations during deployment.
- Back up PostgreSQL; do not copy local users/sessions into the hosted database.
- The accepted hosted bootstrap includes the reviewed equivalent of migration 0005.
  Login/registration counters persist in PostgreSQL; the runtime
  gets EXECUTE only, never table access. Startup/readiness require its function and
  privilege contract. Startup must fail closed against a database missing that contract.

### Render policy and observed boundary

On October 25 the founder's credential-free diagnostic observed socket peer
127.0.0.1, genuine CF-Connecting-IP and X-Forwarded-Proto=https. Forged XFF remained
in the chain, forged protocol was normalized to https, and a separate forged
CF-Connecting-IP attempt was rejected at Cloudflare. These are owner-supplied live
observations; the tests in this repository simulate the accepted ingress contract.

[Render's official guidance](https://render.com/articles/host-pocketbase-on-render)
states Cloudflare rewrites CF-Connecting-IP and warns that the leftmost XFF value
can be client-controlled. The explicit Render mode therefore uses only the single
validated CF address for PostgreSQL network budgets, never req.ip/XFF. IPv4-mapped
aliases and IPv6 /64 grouping retain the existing behavior. No hop-count or broad
CIDR trust is introduced. RENDER=true is a configuration check, not peer authentication.
The platform must continue routing public traffic through its sanitizing proxy;
local processes in the same service are part of the trusted computing boundary.
Do not add other proxies or enable private ingress without revalidating this mode.

All non-probe requests require the observed peer, valid CF address and exactly
https forwarding. Missing/malformed/duplicate values return 503 before sessions.
Raw Host must match APP_ORIGIN's host (optional :443); if X-Forwarded-Host is present
it must match too, otherwise 421. Neither header can change APP_ORIGIN. Existing
Origin/Referer CSRF checks remain, including rejection of missing source on unsafe
requests. Secure/HttpOnly/SameSite=Lax cookies remain unchanged. Only GET/HEAD on
/api/healthz and /api/readyz bypass browser ingress headers for internal Render
health probes; these routes precede sessions and confer no account access.

Non-Render deployments retain explicit IP/CIDR configuration. Local development
leaves PROXY_MODE unset and keeps the original loopback HTTP and Vite proxy behavior.
No PostgreSQL rate-limit tables/functions, grants or authentication logic changed.
If Render changes the immediate peer, do not broaden trust automatically: verify
the new path. A malformed identity cannot fall back to XFF or a shared proxy bucket.

After pushing this reviewed commit, replace the diagnostic Build/Start settings,
enter only restricted runtime secrets privately, and manually deploy the existing
Free service. No additional service, paid disk, migration command or Nebius key.
Check successful startup/readiness, same-origin pages, HTTPS cookies, login and
registration, and forged-header behavior before sharing the demonstration URL.
Hosted Node-to-Neon TLS and real browser acceptance remain live deployment checks;
offline tests do not claim those connections were made.

Render settings references: [web services](https://render.com/docs/web-services),
[environment variables](https://render.com/docs/environment-variables),
[native checkout paths](https://render.com/docs/disks),
[Node version](https://render.com/docs/node-version).

## Authentication limits

Every POST attempt (successful, failed or malformed) consumes its endpoint budget
before JSON parsing, database lookup or bcrypt. Login: 10 attempts/client network
per 15 minutes, 200 globally/15 minutes. Registration: 3/network/hour, 50 globally/hour.
IPv4-mapped aliases are normalized; IPv6 addresses share a /64 bucket. Changing
email/cookie does not reset a network budget. Global limits bound distributed abuse.
429 includes Retry-After. Shared networks can hit limits; this is an availability
tradeoff, not an identity guarantee. Only new registrations require 15 Unicode
code points, retaining bcrypt's existing 72-byte ceiling. Existing logins unchanged.

State stores SHA-256 network keys, counts and expiry only, not account IDs, emails
or session data. Hashing is minimization, not irreversible anonymization of IPs.
The SECURITY DEFINER function serializes each endpoint's global and per-network
counters with a transaction advisory lock, then reads database time and counters.
The API commits before hashing a password or creating a session. No retries.
Database failures/timeouts/invalid results return sanitized 503. Expired limiter
rows are removed under the same lock; session/revocation records are never touched.
Counter state survives service sleep/redeploy and is shared across connections.
No runtime table DML, filesystem state, in-memory allowance or new environment
variable is used. Live SQL/concurrency and Neon capability acceptance are pending.

## Free-tier limits (official documentation checked 2026-10-24)

- Render Free sleeps after 15 idle minutes; wake-up can take about a minute.
  Its 750 monthly instance-hours are shared across the workspace; bandwidth/build
  limits and unusual outbound traffic can suspend service. Local files disappear
  on sleep/redeploy. Use the free onrender.com HTTPS hostname; no purchased domain.
  No card or paid upgrade is authorized; if signup insists on one, stop.
- Neon Free has no subscription time limit or card requirement; its pricing page
  currently lists 100 CU-hours/month/project and 1 GB storage/project. Confirm the
  actual dashboard allowance at signup; do not upgrade if a limit is reached.
  Database scale-to-zero/cold-start can exceed our short connection timeout: keep
  failures controlled, verify hosted startup/recovery, never bypass readiness.
- No availability guarantee is claimed. Check judge access through December 15.
  Free-tier suspension is a release risk, not permission to incur charges.
- Official sources: https://render.com/docs/free and https://neon.com/pricing .

## Narration and release acceptance

No Nebius key is needed while disabled. Keep narration OFF until the additive
[hosted quota upgrade](lib/db/hosted/narration-v1/README.md) is installed and its
permissions are independently verified. The successful direct acceptance does not
prove hosted browser behavior. Enable only the PostgreSQL budget backend on Render;
production rejects file-backed generation. Historical local ledgers stay unchanged.
The upgrade guide contains the exact optional environment settings: 100 total
attempts, 870,400 reserved tokens, three per account, with 20 judge-reserved attempts.
Do not configure a Render disk or reset reservations. No deployment settings are
changed by preparing this source. Deterministic findings remain available when off.

After approval/provisioning, verify HTTPS cookies, proxy/header spoof rejection,
SPA refresh/assets, API 404 isolation, readiness, individual registration/onboarding,
login, provider saving, restart persistence, logout, 429 behavior and durable limiter
failure. No inference is part of that test. Keep public access through judging.
This preparation does not authorize purchasing hosting or publishing the repository.
