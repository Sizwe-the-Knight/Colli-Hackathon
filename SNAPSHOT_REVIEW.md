# Sanitized source release — verification record

Prepared 26 October 2026 from release candidate
`ab14977c39c7f51455b9f3b9d7835d2bfbc4c709`. The private repository, its history,
external acceptance evidence and deployed application were not modified. No GitHub
repository was created; no push, publication, deployment, database connection or
inference request occurred. This local repository has fresh history and no remote.

## Included source

- React/Vite frontend: real Brief UI, opt-in synthetic Health Score preview, original
  approved icon/favicon, legal pages and existing Dashboard/sidebar screens.
- Express backend, deterministic operational engine and existing secured Nemotron
  adapter, validation, account isolation and durable quota implementation.
- Workspace API contracts/generated clients, PostgreSQL schema, versioned migrations,
  reviewed hosted bootstrap/upgrade artifacts and operator documentation.
- Synthetic fixtures and applicable offline tests; no live account data or stored
  session, revocation, rate-limit or inference-ledger contents.
- MIT LICENSE for original Colli source/documentation, 2026 Sizwe-the-Knight,
  third-party notices, README, Devpost notes and complete placeholder setup guidance.

`SNAPSHOT_CONTENTS.json` lists every public file, byte length and SHA-256, including
this review. It excludes only itself to avoid a self-referential hash. It also lists
all exclusions and snapshot-only changes relative to the source commit. The archive
is generated from the fresh Git commit, never by zipping the working directory.
Ignored local dependency copies and build output are validation aids, not release
contents; they must not be uploaded separately.

## Exclusions and ownership

The release candidate already removed the five private design prompts, Replit
project metadata, obsolete post-merge hook and unused mockup-sandbox workspace.
No old Git objects, reflogs, remote configuration or contributor email history were
copied. The source export additionally excludes:

- `.replitignore` (obsolete platform configuration).
- `PUBLICATION_REVIEW.md` (private-history review, replaced by this snapshot review).
- `scripts/NEMOTRON_SECOND_ACCEPTANCE.md`.
- `scripts/nemotron-second-acceptance.mjs`.
- `tests/nemotron-second-acceptance.test.mjs`.

The last three concern a private historical one-use authorization and local evidence;
they are not necessary for the application or its mock narration tests. No allowance,
ledger or outbound marker was reset or copied.

Four Replit dependencies with unresolved license metadata are removed from this
snapshot's manifests/catalog/lock records: connectors-sdk, vite-plugin-cartographer,
vite-plugin-dev-banner and vite-plugin-runtime-error-modal. Their Vite imports are
removed; normal React/Tailwind/Vite tooling remains. No new dependency or replacement
service was added. Three generated TypeScript files had only redundant trailing
blank lines removed, and the edited workspace YAML uses consistent LF endings. All retained package resolutions are unchanged. Minimum release
age (1440 minutes), strict build enforcement and exact bcrypt/esbuild approvals remain.

The founder confirmed original project origin and approved the AI-assisted logo's
public use. The full shadcn MIT notice is preserved verbatim. Earlier uncertain
button/badge customizations and preview scaffold are absent, not relicensed.
The application still uses attributable shadcn-derived components. Third-party
packages retain their licenses; installed package code and compiled bundles are
not part of this source release. Logo use approval does not assert exclusive
copyright, trademark registration or unrestricted third-party artwork rights.

## Targeted publication checks

- File inventory excludes private prompts/platform metadata, acceptance tools,
  environment secrets, dependency/build directories, local database files and logs.
- Text checks cover private-key blocks, common provider/GitHub/cloud key patterns,
  credential URLs, personal home paths and private evidence locations. Credential
  examples are visibly bracketed placeholders; the database-client test uses a
  nonconnecting fixture. The intentional public support email is retained.
- Approved PNG bytes are unchanged. Source/app icons have IHDR/caBX/IDAT/IEND;
  favicon derivatives have ordinary image/color/size chunks. No PNG text/EXIF chunk
  exists. The caBX data contains OpenAI/AI-generation provenance and public certificate
  references, with no detected prompt, email or credential marker. Signatures were
  not independently authenticated and image steganography was not analyzed.
- At the initial export, database artifacts and backend executable source matched
  the release candidate byte-for-byte (80 checked files). The approved refinement
  subsequently changes only the narrator contract/cache compatibility among those
  runtime files. Database and hosted artifact hashes remain unchanged.
- No private Git history or remote is attached. A local non-contact commit email is
  used to avoid copying the private repository's author/contact configuration.

These focused checks are not a guarantee against arbitrary-format secrets or a
complete third-party binary-distribution audit. No known current-source publication
blocker was identified within the reviewed scope and founder confirmations.

Final pre-inventory scan: 279 files (275 text/four PNG), zero unclassified
credential-pattern matches, three known placeholder/fixture connection URLs and
zero broken relative Markdown links. The added content manifest contains paths,
lengths and hashes only, making the final public inventory 280 files.

## Initial verification — 26 October 2026

- **48 focused tests passed, zero failed:** scorer, reproducible preview, Brief
  presentation, reveal/favicon, hosted-artifact integrity and nine selected mocked
  operational-brief cases. No historical live database suite was repeated.
- TypeScript library declarations, frontend, backend and scripts: **PASS**.
- Frontend production build: **PASS**; existing sourcemap and large-bundle warnings.
- Backend production build: **PASS**. Neither build started a service.
- License-notice preservation and unchanged retained dependency resolutions: **PASS**.
- Fresh offline frozen install: **BLOCKED**, ERR_PNPM_NO_OFFLINE_META for cached
  @radix-ui/primitive registry metadata. No policy, lockfile or script-approval
  safeguard was disabled. An earlier snapshot-only YAML formatting error was
  corrected before these checks; workspace security settings were then asserted.

Builds/tests used separate copies of the already-installed dependencies, with links
remapped inside this snapshot. They prove source/build compatibility with that
installed set, **not** a successful fresh dependency installation. A networked
`corepack pnpm install --frozen-lockfile --prod=false` remains a reproducibility gate.
No new registry packages were downloaded for these checks.

## Initial approval gates — superseded by the verification below

1. Founder reviews this snapshot and its exact file inventory. Keep the original
   repository private; this fresh-history copy removes its historical disclosure
   blocker without rewriting that repository.
2. Complete a normal networked frozen install in a clean snapshot checkout before
   claiming clean-install reproducibility. Do not bypass missing registry metadata.
3. Only after explicit approval, create a separate public repository and publish
   this snapshot's fresh history/source archive. Do not add the private repository
   as a remote or merge its history. Nothing is published by this preparation.
4. Judge/browser visual acceptance and current provider/hosting availability are
   separate release checks. No live inference is required for snapshot approval.
   Finish the real video/public-source URLs and retain the prototype/synthetic-data
   disclosures in the submission.

## Approved release promotion — 27 October 2026

The founder approved the Daily Brief refinement from private source commit
`b079b559639c111a57b555b72555b104c1aff788`. Only its 14-file content diff was transferred:
six application files, four tests and four documentation edits. The documentation
hunks were merged into these sanitized versions; no private Git history, excluded
material, dependency integration or private evidence was copied. This release adds
one commit after the independent snapshot root `2a2d708`.

Both private and public workspaces passed **188 focused offline tests, zero failures
and zero skips**, full workspace TypeScript checks, frontend production build,
backend production build and diff checks. Frontend JavaScript/CSS output matches
between the workspaces. Existing sourcemap and large-bundle warnings remain.
No database, production service or live inference was used in these checks.

The public clean frozen-lockfile installation with registry access passed using
pnpm 11.25.0. Windows needed its documented Git-for-Windows sh prerequisite on
that verification process's PATH. The earlier offline registry-metadata blocker is
resolved; no dependency safeguards or lockfile resolutions changed.

A static render of the actual Brief was inspected at desktop and 390px mobile
widths, using system-font fallback and no API wiring. The mobile content had no
horizontal overflow; its native calculation disclosure opened by keyboard. This
is not deployed/browser inference acceptance. The temporary preview was stopped.

The main finding preserves counts and provider names. AI interpretation remains
separate; fresh/cached/fallback attribution is covered by tests. Historical cached
wording is preserved without a new reservation. The illustrative 86/100 is visible
only in the labelled demo; the real account remains Not assessed. The score,
fixtures, authentication, quotas, database schema, licenses and hosting settings
are unchanged.

All 280 tracked public paths remain inventoried. Source/test parity, publication
exclusions and credential-pattern checks passed. The four approved artwork assets
and MIT/third-party notices remain unchanged. Hosted artifact verification passed
(16 artifacts, 14 sources). No known publication blocker was found within this
focused scope. Fresh live revised narration remains separately unverified and
requires an eligible, previously unattempted account/report—not a cache reset.

No push, publication, deployment or inference was performed. Publish only this
independent history after approval, never merge the private repository's history.
Ignored node_modules, builds and local preview/test files are not release contents.
The older snapshot ZIP still represents the initial root; use this new commit for
the promoted release rather than uploading that older ZIP.

## Provider-matched experience correction — 27 October 2026

Source-only promotion of private commit bab5482d7aeb32ef88b0d528e99570f56abb2a6e
onto public parent da81b7702a17cf54f4c1290a2c41bd38547c7465. No private Git history
was imported. Sixteen approved source/test/documentation files changed.

Saved preferences now select stable versioned example records; facts and narration
share the engine output. Reordered selections reuse the same identity, and changed
scenarios remain subject to unchanged account/global quotas. Previous accepted
wording remains readable without a new attempt. Names in synthetic explanations
may reflect saved choices; the raw preference list and personal details are not
sent. The disclosure and documentation reflect this distinction.

Both repositories passed 199 focused offline tests (zero failures/skips), full
TypeScript checks and frontend/backend production builds. Frontend JS/CSS match.
Existing sourcemap/large-bundle warnings remain. Tests use mocks, not live inference
or database execution. New hosted behavior and model output remain unverified.
The separate illustrative 86/100 and real-account Not assessed state are preserved.

All transferred executable files match the private source. Every unrelated file
matched the preceding snapshot manifest before this evidence refresh. No detected
credential/personal-path patterns in the changed files. License notices, excluded
materials and independent public history are preserved. The refreshed inventory
contains 281 files including its self-excluded manifest. No push or deployment.
