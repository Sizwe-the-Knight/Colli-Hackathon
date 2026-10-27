# Colli

**Your AI ecosystem. Summarized.**

> Colli doesn't tell you which AI is best. Colli tells you whether the AI ecosystem you've built is working for you.

Managing multiple AI tools shouldn't mean navigating multiple complicated dashboards.

Colli brings AI activity into one clear **Daily Executive Brief**, helping people understand what happened, why it matters, and what to do next.

In approximately 30 seconds, users can see their AI situation, understand important changes, and decide whether anything needs attention.

NVIDIA Nemotron 3.5 Lightning, accessed through Nebius Token Factory, helps interpret operational findings in everyday language.

**Nebius × NVIDIA Global AI Hackathon | Best Apps and Agents Track**

**[Open the live beta](https://colli-hackathon-demo.onrender.com)** · [Judge instructions](DEVPOST.md) · [Privacy](https://colli-hackathon-demo.onrender.com/privacy) · [Terms](https://colli-hackathon-demo.onrender.com/terms)

The founder has verified hosted registration, onboarding, Brief/Dashboard navigation and session persistence. Local source may be newer than the deployed service. Render Free can take about a minute to wake after inactivity; allow it to load before trying again. [Free-service limitations](https://render.com/docs/free).

## What works, and what is a demonstration

| Area | Current status |
| --- | --- |
| Account access | Registration/sign-in, PostgreSQL-backed sessions, provider preference saving and current-session logout. Server also implements all-device revocation. |
| Daily Executive Brief | Deterministic findings, plain-language explanation and next step; short reduced-motion-aware reveal; Continue to Dashboard. |
| Operational processing | Validates structured records, keeps currencies separate, checks coverage and ties findings to evidence. The live route calculates stable synthetic examples for saved provider selections; it imports no provider activity. |
| Dashboard/sidebar | Models, Activity, Workflows, Costs and Reports demonstrate the interface using sample metrics. They are not live provider analytics. |
| AI Health Score | The labelled demo immediately shows a separate **Illustrative 86/100**; **How this score is calculated** expands its four evidence ratios. The actual account remains **Not assessed**. It is not a score for the Brief’s requests. Dashboard sample scores are also illustrative. |
| Provider selections | Saved preferences only: no account connection, subscription verification or private activity import. |
| Colli Village | Non-interactive roadmap preview, not working teams or shared data. |
| Account deletion | Contact-based requests; no automated deletion feature. |

No provider API key, purchase or paid subscription is needed to test the hosted beta.

## NVIDIA Nemotron through Nebius Token Factory — honest status

The implemented server-side `BriefNarrator` uses `nvidia/Nemotron-3_5-Lightning` at Nebius Token Factory's chat-completions API. It receives bounded, structured findings and chooses wording from an evidence-approved JSON contract. Foundation 06 remains responsible for calculations; the model cannot supply new costs, savings, source records or health scores.

**A controlled genuine acceptance succeeded:** HTTP 200, 439 input / 139 output tokens, `finish_reason: stop`, with Colli validation passed and no fallback. An earlier truncated response was correctly rejected. The founder subsequently confirmed genuine narration working in the hosted beta. This release-package session made no inference request and does not deploy changes.

Authenticated users select **Explain with NVIDIA Nemotron** in the Daily Brief. Only bounded synthetic demonstration findings are sent to Nebius—not personal account details or private activity. Example provider names reflect saved selections. Successful output is attributed to NVIDIA Nemotron via Nebius; otherwise the deterministic explanation remains. There is no inference on login, page load, refresh or navigation, and no automatic retry.

Hosted generation uses PostgreSQL reservations and validated-result reuse across restarts: **100 total attempts, 3 per account**, 8,704 tokens reserved per attempt and 512 maximum output tokens. Public accounts can consume at most 80 attempts; 20 are reserved for server-designated judge accounts. There is no date-based reset or October expiry. An unchanged account/report reuses its result without spending again. Failed attempts count. New installations must complete the [hosted activation steps](lib/db/hosted/narration-v1/README.md) before enabling generation. Historical local acceptance reservations remain separate and unchanged; these are 100 additional hosted demo attempts, not unlimited credit usage.

## Illustrative Health Score demonstration

The **Demo workspace** shows the illustrative score immediately. Select
**How this score is calculated** for optional details. The account remains **Not assessed**
throughout; non-demo reports do not show this fixture. This separate, hypothetical 30-day fixture supplies 9/10 needs met,
$90/$120 spending supported by meaningful use, 96/100 successful requests and 4/5
critical workflows with usable fallbacks. The pure scorer calculates
**0.35 × 90 + 0.30 × 75 + 0.25 × 96 + 0.10 × 80 = 86/100**.

The frontend consumes a reproducible artifact from that scorer and fixture, not a
second scoring algorithm. Expanding it makes no API or inference call and sends
none of these hypothetical inputs to Nemotron. Missing required evidence still
means **Not assessed**, including zero paid spending; this is not a commercial
assessment model. See the [methodology](artifacts/api-server/src/operational/HEALTH_SCORE_POC.md).

## Architecture

```text
Browser: React + TypeScript + Vite
          | same-origin HTTPS /api
Render Free: Express 5 + session / origin / rate-limit checks
          | verified PostgreSQL TLS, restricted colli_app role
Neon Free: PostgreSQL 17 + Drizzle schema and versioned hosted provenance

Synthetic records -> deterministic usage engine -> Daily Brief
                                               -> optional, explicitly triggered Nebius narrator
```

Persistent sessions and authentication-attempt limits live in PostgreSQL. The API checks database/session prerequisites before listening and fails closed on unavailable security state. Runtime, migrator and function-owner privileges are separated. One Node service serves React and Express. See [DEPLOYMENT.md](DEPLOYMENT.md) for the exact Render configuration, proxy contract and Neon TLS requirements.

## Local setup

This is a sanitized source snapshot with fresh Git history. Start with
[SNAPSHOT_SETUP.md](SNAPSHOT_SETUP.md) for the prerequisites, placeholder-only Neon/
Nebius settings and the frozen-lockfile verification limitation. Do not reuse the
founder’s live database or assume its prior checks apply to a new installation.


Use **Node 24.21.0**, **pnpm 11.25.0 via Corepack**, and a separately provisioned PostgreSQL 17 development database. An empty database is not sufficient: startup requires the reviewed users, sessions, revocation and authentication-limit schema/privileges. Do not point local testing at the hosted beta.

Database initialization is an operator step, not part of installation or API startup. Local migrations are in `lib/db/drizzle`; role requirements are in [AUTH_SECURITY.md](AUTH_SECURITY.md) and [SESSION_REVOCATION_REVIEW.md](lib/db/SESSION_REVOCATION_REVIEW.md). For a **new hosted** database use the reviewed [versioned bootstrap runbook](lib/db/hosted/v1/RUNBOOK.md), not `drizzle-kit push`. The existing Neon installation has already been accepted: do not reapply it. Local migration 0004 has a deliberate local-only guard. Never work around missing permissions with an administrator runtime account.

From the repository root in Windows PowerShell:

```powershell
corepack.cmd pnpm install --frozen-lockfile --prod=false
corepack.cmd pnpm run typecheck
$env:PORT = '5173'
$env:BASE_PATH = '/'
corepack.cmd pnpm --filter @workspace/colli run build
corepack.cmd pnpm --filter @workspace/api-server run build
```

Corepack's first use needs registry access. On POSIX use `corepack` instead of `corepack.cmd` and equivalent shell environment syntax. Keep the lockfile, platform overrides and narrow dependency-build approvals unchanged.

After your development database is provisioned and running, configure the backend in its own PowerShell window. `.env.example` documents names; it is **not loaded automatically**. Non-secret configuration:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3001
APP_ORIGIN=http://127.0.0.1:5173
NEBIUS_NARRATION_ENABLED=false
NEBIUS_MAX_CALLS=0
NEBIUS_TOKEN_BUDGET=0
# DATABASE_URL and SESSION_SECRET must be supplied privately.
```

For the established local disposable setup, DATABASE_URL targets `127.0.0.1:55432`, database `colli_dev_disposable`, role `colli_app`. Password characters in a URL must be URL-encoded. SESSION_SECRET must be stable, random and at least 32 characters. Do not put real secrets in source, command history or chat. Set them interactively in the **same process** that starts Node:

```powershell
$privateUrl = Read-Host 'Development DATABASE_URL (colli_app only)' -AsSecureString
$env:DATABASE_URL = [System.Net.NetworkCredential]::new('', $privateUrl).Password
$privateSession = Read-Host 'Stable SESSION_SECRET (32+ random characters)' -AsSecureString
$env:SESSION_SECRET = [System.Net.NetworkCredential]::new('', $privateSession).Password
Remove-Variable privateUrl, privateSession
$env:NODE_ENV = 'development'
$env:HOST = '127.0.0.1'
$env:PORT = '3001'
$env:APP_ORIGIN = 'http://127.0.0.1:5173'
$env:NEBIUS_NARRATION_ENABLED = 'false'
$env:NEBIUS_MAX_CALLS = '0'
$env:NEBIUS_TOKEN_BUDGET = '0'
corepack.cmd pnpm --filter @workspace/api-server run start
```

Use a fresh local shell without production `PROXY_MODE`, `TRUSTED_PROXY_ADDRESSES`, `FRONTEND_DIST`, `CORS_ORIGINS` or inference credentials. Process environment secrets are not encrypted in memory: do not dump the environment. Close the shell after use.

In another PowerShell window at the repository root:

```powershell
$env:PORT = '5173'
$env:BASE_PATH = '/'
$env:COLLI_LOCAL_API_PORT = '3001'
corepack.cmd pnpm --filter @workspace/colli run dev
```

Visit **http://127.0.0.1:5173** through Vite, never `index.html` directly. The proxy forwards `/api` to port 3001. `/api/healthz` reports process availability; `/api/readyz` checks database/session/limiter readiness. Ctrl+C stops each application process; stop an operator-started database with its approved `pg_ctl` procedure. No database startup or provisioning is implied by these commands.

Focused offline checks (mocked providers; temporary loopback HTTP fixtures):

```powershell
node --test tests/operational-usage.test.mjs tests/operational-brief.test.mjs tests/brief-narrator.test.mjs tests/provider-save.test.mjs tests/legal-pages.test.mjs
```

## What changed during the hackathon

This was **not built entirely from scratch in October**. The private development history contains a July 2026 Replit-origin UI/API prototype, sample screens and scaffolded UI components. The October 15–26 implementation substantially added or replaced:

- Strict API contracts, local proxy/error handling and reliable provider saving.
- Restricted registration SQL, persistent sessions, revocation controls and PostgreSQL-backed authentication limits, with offline and controlled database tests.
- Deterministic usage processing (`fafbdfc`), the evidence-backed Brief (`a04d9ca`) and the bounded Nebius/Nemotron narrator (`72f77f1`).
- The synthetic Health Score scorer (`8e70fd3`), optional separate demonstration and durable hosted narration quotas (`19f5c0a`).
- Plain-language Brief presentation, accessibility, the short reveal, honest sample labels, notification read state and the Settings roadmap preview.
- Same-origin production serving, a versioned Neon bootstrap, Render-specific proxy protections and the first hosted beta; public Privacy/Terms source (`2bfc72a`).

Those hashes refer to the private development history, which is not included here.
These are source-history milestones, not claims that every change is deployed or every planned capability works. Intended submission track: **Best Apps and Agents**. The founder must confirm event eligibility for the disclosed pre-existing prototype and accurately describe the genuine, explicitly triggered synthetic-data AI feature.

## License, artwork and publication status

This snapshot is prepared locally for founder approval; it has not been published.
[LICENSE](LICENSE) applies MIT to original Colli source and documentation, attributed
to **2026 Sizwe-the-Knight**. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) preserves
shadcn’s MIT notice and the separate terms for upstream packages and artwork.

The Colli logo is founder-directed, AI-assisted artwork approved for Colli, its
repository and hackathon materials. No registered trademark, exclusive copyright
or independent artwork reuse license is claimed.

Private history, prompts, platform metadata, retired scaffold, private acceptance
tools and unresolved Replit dependency integrations are excluded. This snapshot
has no remote and no old Git objects. See [SNAPSHOT_REVIEW.md](SNAPSHOT_REVIEW.md)
for the exact review, limitations and approval gates, and `SNAPSHOT_CONTENTS.json`
for the complete file/hash inventory. Never upload node_modules, local builds,
credentials or external acceptance evidence as part of the source release.
