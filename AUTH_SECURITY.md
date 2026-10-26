# Authentication security and local verification

The API binds to `HOST`, defaulting to `127.0.0.1`. `PORT` must be an integer
between 1 and 65535. Deployments can explicitly configure another bind address;
do not expose the development server publicly.

Use the frontend's existing local Vite proxy, with `COLLI_LOCAL_API_PORT=3001`.
The default `APP_ORIGIN` is `http://127.0.0.1:5173`. Use that exact browser URL,
or explicitly set the intended origin. Optional `CORS_ORIGINS` contains exact,
comma-separated trusted origins, without paths, credentials or wildcards.
Do not set an empty `CORS_ORIGINS`; omit it when unnecessary.

## Browser request protection

Origin checking runs before session handling and applies to login and registration
as well as authenticated mutations. A supplied untrusted Origin is rejected.
POST/PUT/PATCH/DELETE and other unsafe methods require a trusted Origin, or a
trusted Referer origin when Origin is absent. Missing or opaque origins fail
closed. CORS grants credentials only to explicitly configured trusted origins.
The policy does not derive trust from Host or forwarded headers. CLI clients must
provide the configured Origin for mutations; this is not a substitute for login.

This browser CSRF defense assumes allowed origins are controlled and free of XSS.
Origin headers are forgeable by non-browser clients; they are not authentication.
Cookies are HttpOnly, SameSite=Lax, host-only, with path `/`. Cross-site embedded
applications are not supported by this cookie policy. State-changing GET routes
must not be introduced. No blanket proxy trust is enabled.

## Sessions and production boundary

Successful login/registration regenerates the session ID and explicitly saves the
new identity before responding. Failure clears the cookie and attempts session
destruction, returning an unavailable response rather than authenticated success.
Logout clears the cookie and reports store destruction failure instead of success.
On a store failure, server-side revocation cannot be guaranteed until recovery.

`SESSION_SECRET` must be privately supplied and contain at least 32 characters;
length validation cannot establish entropy. Local HTTP uses Secure=false.
Production cookie policy is Secure=true and requires HTTPS origins, but production
startup is deliberately blocked while the only available store is MemoryStore.
Choosing a persistent session store, its dependency/table and trusted TLS proxy
configuration requires a separate approval. Local sessions are lost on restart;
database user/provider persistence is separate from session persistence.

Authenticated sessions protect all operational routers; health, readiness, login
and registration remain public. This is an authentication boundary, not tenant or
role-based authorization. Operational data is still simulated. Before commercial
release, add organization authorization and an approved abuse/rate-limit policy.

## Database access and health

Existing authentication queries require users SELECT/INSERT, UPDATE only on
providers/updated_at (including the Drizzle update hook), public schema USAGE and
users_id_seq USAGE. They fit the verified colli_app grants. No grants are expanded.
Registration handles a unique-email race with 409. A session failure after a
successful registration can leave the account created; retry login rather than
assuming the database insert was rolled back. Passwords exceeding bcrypt's
72-byte limit are rejected rather than silently truncated.

`/api/healthz` reports process liveness only. `/api/readyz` queries the users table
with the application pool and returns 503 on failure, without exposing error details.
Pool acquisition and readiness-query timeouts are 2 seconds. Readiness verifies
connectivity and the expected readable table, not every schema constraint or grant.

## Offline verification and next live test (requires approval)

Run `node --test tests/api-security.test.mjs tests/api-integrity.test.mjs tests/local-api-proxy.test.mjs`.
Fixtures exercise actual route handlers with mocked DB/password hashing and no
listening server. They do not prove live browser cookies, bcrypt loading or persistence.

After approval: start the isolated database, inject colli_app credentials and a
development session secret privately, start the built API on 127.0.0.1:3001 with
NODE_ENV=development, and start frontend preview on 127.0.0.1:5173 with its local
proxy enabled. Verify liveness/readiness, registration/duplicate rejection, wrong
and correct login, session-ID rotation, provider persistence, logout and reuse of
the old cookie, unauthorized operational access, foreign-origin rejection and
database-unavailable readiness. Restart the API: the development session should
expire while the synthetic user's provider settings persist after a fresh login.
Then stop both application servers and PostgreSQL. Do not use real accounts.
