# Sanitized source snapshot — approval pending

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
- Database artifacts and backend executable source match the release candidate
  byte-for-byte (80 checked files). Hosted artifact hashes validate offline.
- No private Git history or remote is attached. A local non-contact commit email is
  used to avoid copying the private repository's author/contact configuration.

These focused checks are not a guarantee against arbitrary-format secrets or a
complete third-party binary-distribution audit. No known current-source publication
blocker was identified within the reviewed scope and founder confirmations.

Final pre-inventory scan: 279 files (275 text/four PNG), zero unclassified
credential-pattern matches, three known placeholder/fixture connection URLs and
zero broken relative Markdown links. The added content manifest contains paths,
lengths and hashes only, making the final public inventory 280 files.

## Actual verification

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

## Approval and remaining gates

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
