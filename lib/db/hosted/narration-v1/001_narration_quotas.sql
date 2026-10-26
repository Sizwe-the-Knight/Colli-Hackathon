-- Prepared only. Administrator executes transactionally; never API startup.
-- Hosted-only additive upgrade; record its exact hash in a separate upgrade journal.
DO $guard$
BEGIN
  IF current_user <> session_user OR current_user IN ('colli_app','colli_migrator','colli_auth_ops')
    OR NOT pg_catalog.pg_has_role(current_user,'colli_migrator','SET')
    OR NOT pg_catalog.pg_has_role(current_user,'colli_auth_ops','SET')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='auth' AND nspowner='colli_migrator'::regrole)
    OR pg_catalog.has_schema_privilege('colli_auth_ops','auth','CREATE')
    OR pg_catalog.has_schema_privilege('colli_app','auth','CREATE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member='colli_app'::regrole)
    OR pg_catalog.pg_has_role('colli_migrator','colli_auth_ops','MEMBER')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='colli_auth_ops'
      AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=0)
  THEN RAISE EXCEPTION 'Narration deployment capability rejected'; END IF;
END;
$guard$;
--> statement-breakpoint
SET LOCAL ROLE colli_migrator;
--> statement-breakpoint
CREATE TABLE "auth"."narration_attempts" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"account" varchar(64) NOT NULL,
	"judge" boolean NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"narrative" jsonb,
	CONSTRAINT "narration_key_hash" CHECK ("auth"."narration_attempts"."key" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "narration_account_hash" CHECK ("auth"."narration_attempts"."account" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "narration_result_bound" CHECK ("auth"."narration_attempts"."narrative" is null or (jsonb_typeof("auth"."narration_attempts"."narrative") = 'object' and octet_length("auth"."narration_attempts"."narrative"::text) <= 4096))
);
--> statement-breakpoint
REVOKE ALL ON auth.narration_attempts FROM PUBLIC, colli_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON auth.narration_attempts TO colli_auth_ops;
--> statement-breakpoint
GRANT UPDATE(narrative) ON auth.narration_attempts TO colli_auth_ops;
--> statement-breakpoint
GRANT CREATE ON SCHEMA auth TO colli_auth_ops;
--> statement-breakpoint
SET LOCAL ROLE colli_auth_ops;
--> statement-breakpoint
CREATE FUNCTION auth.reserve_narration(p_key text, p_account text, p_judge boolean, p_calls integer, p_tokens integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp SET timezone = 'UTC'
AS $function$
DECLARE
  v_now timestamptz;
  v_cap integer;
BEGIN
  IF NOT pg_catalog.has_function_privilege(session_user,'auth.read_narration(text,text)','EXECUTE')
    OR NOT pg_catalog.has_function_privilege(session_user,'auth.save_narration(text,text,jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'Narration runtime permissions unavailable'; END IF;
  IF p_key IS NULL OR p_key !~ '^[a-f0-9]{64}$' OR p_account IS NULL OR p_account !~ '^[a-f0-9]{64}$'
    OR p_judge IS NULL OR p_calls IS NULL OR p_calls NOT BETWEEN 1 AND 100
    OR p_tokens IS NULL OR p_tokens NOT BETWEEN 8704 AND 870400
  THEN RAISE EXCEPTION 'Invalid narration reservation' USING ERRCODE='22023'; END IF;
  -- One lock for all accounts/replicas. No expiry, reset, refund or DELETE path.
  PERFORM pg_catalog.pg_advisory_xact_lock(1129270348, 6);
  v_now := pg_catalog.clock_timestamp();
  v_cap := least(p_calls, p_tokens / 8704);
  IF EXISTS (SELECT 1 FROM auth.narration_attempts WHERE reserved_at > v_now)
  THEN RAISE EXCEPTION 'Narration clock unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM auth.narration_attempts WHERE key=p_key)
  THEN RETURN 'already_attempted'; END IF;
  IF (SELECT count(*) FROM auth.narration_attempts) >= v_cap
    OR (SELECT count(*) FROM auth.narration_attempts WHERE account=p_account) >= 3
    OR (NOT p_judge AND (SELECT count(*) FROM auth.narration_attempts WHERE NOT judge) >= greatest(0,v_cap-20))
    OR (p_judge AND (SELECT count(*) FROM auth.narration_attempts WHERE judge) >= 20)
  THEN RETURN 'budget_exhausted'; END IF;
  IF (SELECT count(*) FROM auth.narration_attempts WHERE reserved_at > v_now-interval '1 minute') >= 3
    OR (SELECT count(*) FROM auth.narration_attempts WHERE account=p_account AND reserved_at > v_now-interval '1 hour') >= 2
  THEN RETURN 'rate_limited'; END IF;
  INSERT INTO auth.narration_attempts(key,account,judge,reserved_at) VALUES(p_key,p_account,p_judge,v_now);
  RETURN 'reserved';
END;
$function$;
--> statement-breakpoint
CREATE FUNCTION auth.read_narration(p_key text, p_account text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT jsonb_build_object('narrative',narrative) FROM auth.narration_attempts
    WHERE key=p_key AND account=p_account;
$function$;
--> statement-breakpoint
CREATE FUNCTION auth.save_narration(p_key text, p_account text, p_narrative jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF p_narrative IS NULL OR jsonb_typeof(p_narrative) <> 'object' OR octet_length(p_narrative::text) > 4096
  THEN RAISE EXCEPTION 'Invalid narration result' USING ERRCODE='22023'; END IF;
  UPDATE auth.narration_attempts SET narrative=p_narrative
    WHERE key=p_key AND account=p_account AND narrative IS NULL;
  RETURN FOUND;
END;
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth.reserve_narration(text,text,boolean,integer,integer), auth.read_narration(text,text), auth.save_narration(text,text,jsonb) FROM PUBLIC, colli_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth.reserve_narration(text,text,boolean,integer,integer), auth.read_narration(text,text), auth.save_narration(text,text,jsonb) TO colli_app;
--> statement-breakpoint
RESET ROLE;
--> statement-breakpoint
SET LOCAL ROLE colli_migrator;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA auth FROM colli_auth_ops;
--> statement-breakpoint
RESET ROLE;
