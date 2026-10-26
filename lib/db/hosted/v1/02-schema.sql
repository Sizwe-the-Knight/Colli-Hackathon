-- Hosted guard replaces ONLY local 0003 orchestration guard; function bodies unchanged.
-- Public schema remains provider/database-owned; grant its USAGE as administrator.
GRANT USAGE ON SCHEMA public TO colli_auth_ops;
SET LOCAL ROLE colli_migrator;
SET LOCAL search_path=public,pg_catalog;
DO $guard$
BEGIN
  IF current_user <> 'colli_migrator' OR session_user <> current_setting('colli.expected_admin')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid='colli_auth_ops'::regrole
      AND member='colli_migrator'::regrole AND set_option AND NOT inherit_option AND NOT admin_option)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_default_acl WHERE defaclrole IN ('colli_migrator'::regrole,'colli_auth_ops'::regrole))
  THEN RAISE EXCEPTION 'Hosted schema authority rejected'; END IF;
END;
$guard$;
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"providers" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TABLE "auth"."revoked_sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"revoked_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"retain_until" timestamp (6) with time zone NOT NULL,
	CONSTRAINT "revoked_sessions_retention_bound" CHECK ("auth"."revoked_sessions"."retain_until" > "auth"."revoked_sessions"."revoked_at" and "auth"."revoked_sessions"."retain_until" <= "auth"."revoked_sessions"."revoked_at" + interval '168 hours')
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "revoked_sessions_retain_until_idx" ON "auth"."revoked_sessions" USING btree ("retain_until");--> statement-breakpoint
CREATE INDEX "sessions_expire_idx" ON "auth"."sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING btree (("sess" ->> 'userId'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_auth_version_positive" CHECK ("users"."auth_version" > 0);
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
REVOKE ALL ON public.users, auth.sessions, auth.revoked_sessions FROM PUBLIC, colli_app;
GRANT SELECT ON public.users TO colli_app;
GRANT UPDATE (providers,updated_at) ON public.users TO colli_app;
GRANT USAGE ON SEQUENCE public.users_id_seq TO colli_app;
REVOKE INSERT ON TABLE public.users FROM colli_app;
--> statement-breakpoint
REVOKE INSERT
  (id, email, name, password_hash, auth_version, providers, created_at, updated_at)
  ON TABLE public.users FROM colli_app;
--> statement-breakpoint
GRANT INSERT (email, name, password_hash)
  ON TABLE public.users TO colli_app;

GRANT USAGE ON SCHEMA auth TO colli_auth_ops;
--> statement-breakpoint
GRANT SELECT (id, auth_version), UPDATE (auth_version) ON public.users TO colli_auth_ops;
--> statement-breakpoint
-- UPDATE(expire) is needed for SELECT FOR UPDATE, not to extend sessions.
GRANT SELECT, DELETE, UPDATE (expire) ON auth.sessions TO colli_auth_ops;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE, UPDATE (revoked_at, retain_until)
  ON auth.revoked_sessions TO colli_auth_ops;
--> statement-breakpoint
-- Internal validator: epoch milliseconds, canonical integer JSON numbers.
-- Empty result means invalid, never an authenticated fallback.
CREATE FUNCTION auth._session_identity(p_sess json, p_expire timestamp, p_now timestamptz)
RETURNS TABLE (user_id integer, auth_version integer)
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
SET timezone = 'UTC'
AS $function$
DECLARE
  v_key text;
  v_user bigint;
  v_version bigint;
  v_issued bigint;
  v_activity bigint;
  v_absolute bigint;
  v_now numeric;
BEGIN
  IF p_sess IS NULL OR pg_catalog.json_typeof(p_sess) IS DISTINCT FROM 'object'
     OR p_expire IS NULL OR NOT pg_catalog.isfinite(p_expire)
     OR p_now IS NULL OR NOT pg_catalog.isfinite(p_now) THEN RETURN; END IF;
  -- json (unlike jsonb) preserves duplicate keys. Reject ambiguous identities.
  IF EXISTS (SELECT 1 FROM pg_catalog.json_each(p_sess) AS j GROUP BY j.key HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM pg_catalog.json_each(p_sess) AS j
       WHERE j.key NOT IN ('userId', 'authVersion', 'issuedAt', 'lastActivityAt',
                          'absoluteExpiresAt', 'reauthenticatedAt', 'cookie')) THEN RETURN; END IF;
  FOREACH v_key IN ARRAY ARRAY['userId', 'authVersion', 'issuedAt', 'lastActivityAt', 'absoluteExpiresAt'] LOOP
    IF pg_catalog.json_typeof(p_sess -> v_key) IS DISTINCT FROM 'number'
       OR (p_sess ->> v_key) !~ '^[1-9][0-9]{0,12}$' THEN RETURN; END IF;
  END LOOP;
  v_user := (p_sess ->> 'userId')::bigint;
  v_version := (p_sess ->> 'authVersion')::bigint;
  IF v_user > 2147483647 OR v_version > 2147483647 THEN RETURN; END IF;
  v_issued := (p_sess ->> 'issuedAt')::bigint;
  v_activity := (p_sess ->> 'lastActivityAt')::bigint;
  v_absolute := (p_sess ->> 'absoluteExpiresAt')::bigint;
  v_now := extract(epoch FROM p_now) * 1000;
  IF v_issued > v_now OR v_activity < v_issued OR v_activity > v_now
     OR v_absolute <> v_issued + 604800000
     OR v_now >= v_absolute OR v_now >= v_activity + 86400000
     OR (p_expire AT TIME ZONE 'UTC') <= p_now
     -- connect-pg-simple rounds expiry upward to seconds. Never authorize using
     -- that rounded value alone; the exact millisecond guards above dominate.
     OR (p_expire AT TIME ZONE 'UTC') > pg_catalog.to_timestamp(
          pg_catalog.ceil(least(v_absolute, v_activity + 86400000)::numeric / 1000)::double precision)
  THEN RETURN; END IF;
  IF p_sess -> 'cookie' IS NOT NULL AND
     pg_catalog.json_typeof(p_sess -> 'cookie') IS DISTINCT FROM 'object' THEN RETURN; END IF;
  IF p_sess -> 'reauthenticatedAt' IS NOT NULL THEN
    IF pg_catalog.json_typeof(p_sess -> 'reauthenticatedAt') IS DISTINCT FROM 'number'
       OR (p_sess ->> 'reauthenticatedAt') !~ '^[1-9][0-9]{0,12}$' THEN RETURN; END IF;
    IF (p_sess ->> 'reauthenticatedAt')::bigint < v_issued
       OR (p_sess ->> 'reauthenticatedAt')::bigint > v_now THEN RETURN; END IF;
  END IF;
  RETURN QUERY SELECT v_user::integer, v_version::integer;
END;
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth._session_identity(json, timestamp, timestamptz) FROM PUBLIC, colli_app;
--> statement-breakpoint
-- Internal operation, callable only through the fixed-purpose public wrappers.
CREATE FUNCTION auth._revoke_session(p_sid text, p_all boolean)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
SET timezone = 'UTC'
AS $function$
DECLARE
  v_sess json;
  v_expire timestamp;
  v_candidate integer;
  v_user integer;
  v_version integer;
  v_account_version integer;
  v_now timestamptz;
  v_valid boolean := false;
BEGIN
  IF p_sid IS NULL OR p_sid !~ '^[A-Za-z0-9_-]{32,128}$' OR p_all IS NULL THEN
    RETURN 'invalid_session';
  END IF;
  v_now := pg_catalog.clock_timestamp();
  IF EXISTS (SELECT 1 FROM auth.revoked_sessions AS r WHERE r.sid = p_sid AND r.retain_until > v_now) THEN
    RETURN 'already_revoked';
  END IF;
  <<validate_session>>
  BEGIN
    SELECT s.sess, s.expire INTO v_sess, v_expire FROM auth.sessions AS s WHERE s.sid = p_sid;
    SELECT i.user_id INTO v_candidate FROM auth._session_identity(v_sess, v_expire, v_now) AS i;
    IF NOT FOUND THEN EXIT validate_session; END IF;
    -- Global lock order: account first, then SID row, then marker. Re-read after
    -- waiting. Future login and protected mutations must use this same order.
    SELECT u.auth_version INTO v_account_version FROM public.users AS u
      WHERE u.id = v_candidate FOR UPDATE;
    IF NOT FOUND THEN EXIT validate_session; END IF;
    SELECT s.sess, s.expire INTO v_sess, v_expire FROM auth.sessions AS s
      WHERE s.sid = p_sid FOR UPDATE;
    IF NOT FOUND THEN EXIT validate_session; END IF;
    v_now := pg_catalog.clock_timestamp();
    SELECT i.user_id, i.auth_version INTO v_user, v_version
      FROM auth._session_identity(v_sess, v_expire, v_now) AS i;
    IF NOT FOUND OR v_user <> v_candidate OR v_version <> v_account_version THEN
      EXIT validate_session;
    END IF;
    v_valid := true;
  END validate_session;
  v_now := pg_catalog.clock_timestamp();
  -- Repeat after account/session lock waits. An old SID can never bump the
  -- account version twice or invalidate a new login after the first revoke-all.
  IF EXISTS (SELECT 1 FROM auth.revoked_sessions AS r WHERE r.sid = p_sid AND r.retain_until > v_now) THEN
    RETURN 'already_revoked';
  END IF;
  IF v_valid AND p_all AND v_account_version = 2147483647 THEN
    RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'Authentication version exhausted';
  END IF;
  -- Conservative full seven days, including malformed/missing/expired sessions.
  -- Never refresh an active marker. Only an already expired marker can be replaced.
  INSERT INTO auth.revoked_sessions AS r (sid, revoked_at, retain_until)
    VALUES (p_sid, v_now, v_now + interval '168 hours')
    ON CONFLICT (sid) DO UPDATE SET revoked_at = EXCLUDED.revoked_at, retain_until = EXCLUDED.retain_until
    WHERE r.retain_until <= EXCLUDED.revoked_at;
  IF NOT v_valid THEN RETURN 'invalid_session'; END IF;
  IF p_all THEN
    UPDATE public.users AS u SET auth_version = u.auth_version + 1
      WHERE u.id = v_user AND u.auth_version = v_version;
    IF NOT FOUND THEN RAISE EXCEPTION 'Authentication state changed'; END IF;
  END IF;
  -- Other devices are invalidated by version comparison, not a broad DELETE
  -- that could race with a fresh login. Late writes of this SID hit its marker.
  DELETE FROM auth.sessions AS s WHERE s.sid = p_sid;
  RETURN 'revoked';
END;
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth._revoke_session(text, boolean) FROM PUBLIC, colli_app;
--> statement-breakpoint
CREATE FUNCTION auth.revoke_current_session(p_sid text)
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET timezone = 'UTC'
AS $function$ SELECT auth._revoke_session(p_sid, false); $function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth.revoke_current_session(text) FROM PUBLIC, colli_app;
--> statement-breakpoint
CREATE FUNCTION auth.revoke_all_sessions(p_sid text)
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET timezone = 'UTC'
AS $function$ SELECT auth._revoke_session(p_sid, true); $function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth.revoke_all_sessions(text) FROM PUBLIC, colli_app;
--> statement-breakpoint
CREATE FUNCTION auth.cleanup_revoked_sessions()
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET timezone = 'UTC'
AS $function$
DECLARE
  v_cutoff timestamptz := pg_catalog.statement_timestamp();
  v_count integer;
BEGIN
  WITH expired AS (
    SELECT r.sid FROM auth.revoked_sessions AS r WHERE r.retain_until <= v_cutoff
      ORDER BY r.retain_until, r.sid LIMIT 100 FOR UPDATE SKIP LOCKED
  ), removed AS (
    DELETE FROM auth.revoked_sessions AS r USING expired AS e
      WHERE r.sid = e.sid AND r.retain_until <= v_cutoff RETURNING r.sid
  ) SELECT count(*)::integer INTO v_count FROM removed;
  RETURN v_count;
END;
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth.cleanup_revoked_sessions() FROM PUBLIC, colli_app;
--> statement-breakpoint
-- Owner transfer needs SET ROLE membership and temporary CREATE. Both the CREATE
-- grant and its revocation are in this migration's transaction, never runtime.
GRANT CREATE ON SCHEMA auth TO colli_auth_ops;
--> statement-breakpoint
ALTER FUNCTION auth._session_identity(json, timestamp, timestamptz) OWNER TO colli_auth_ops;
--> statement-breakpoint
ALTER FUNCTION auth._revoke_session(text, boolean) OWNER TO colli_auth_ops;
--> statement-breakpoint
ALTER FUNCTION auth.revoke_current_session(text) OWNER TO colli_auth_ops;
--> statement-breakpoint
ALTER FUNCTION auth.revoke_all_sessions(text) OWNER TO colli_auth_ops;
--> statement-breakpoint
ALTER FUNCTION auth.cleanup_revoked_sessions() OWNER TO colli_auth_ops;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA auth FROM colli_auth_ops;

RESET ROLE;
-- Hand off only once; no migrator membership is needed for subsequent phases.
REVOKE colli_auth_ops FROM colli_migrator;
