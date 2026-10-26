-- Same 0005 table/function definition and final grants; hosted owner-role context.
SET LOCAL ROLE colli_migrator;
CREATE TABLE "auth"."auth_attempts" (
	"kind" varchar(8) NOT NULL,
	"network" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer NOT NULL,
	CONSTRAINT "auth_attempts_kind_network_pk" PRIMARY KEY("kind","network"),
	CONSTRAINT "auth_attempts_kind" CHECK ("auth"."auth_attempts"."kind" in ('login', 'register')),
	CONSTRAINT "auth_attempts_network" CHECK ("auth"."auth_attempts"."network" = '*' or "auth"."auth_attempts"."network" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "auth_attempts_count" CHECK ("auth"."auth_attempts"."attempts" between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE auth.auth_attempts OWNER TO colli_migrator;
--> statement-breakpoint
REVOKE ALL ON auth.auth_attempts FROM PUBLIC, colli_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.auth_attempts TO colli_auth_ops;
--> statement-breakpoint
GRANT CREATE ON SCHEMA auth TO colli_auth_ops;
SET LOCAL ROLE colli_auth_ops;
CREATE FUNCTION auth.consume_auth_attempt(p_kind text, p_network text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp SET timezone = 'UTC'
AS $function$
DECLARE
  v_now timestamptz;
  v_window interval;
  v_global_limit integer;
  v_client_limit integer;
  v_global integer;
  v_client integer;
  v_global_until timestamptz;
  v_client_until timestamptz;
  v_wait integer;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('login','register') OR p_network IS NULL
    OR length(p_network) <> 64 OR p_network !~ '^[a-f0-9]{64}$'
  THEN RAISE EXCEPTION 'Invalid authentication attempt' USING ERRCODE='22023'; END IF;
  -- One global serialization point per endpoint; shared by ALL API processes.
  -- No account/session locks are taken, so this cannot invert their lock ordering.
  PERFORM pg_catalog.pg_advisory_xact_lock(1129270348, CASE p_kind WHEN 'login' THEN 1 ELSE 2 END);
  v_now := pg_catalog.clock_timestamp(); -- re-read database time AFTER lock wait
  v_window := CASE p_kind WHEN 'login' THEN interval '15 minutes' ELSE interval '1 hour' END;
  v_global_limit := CASE p_kind WHEN 'login' THEN 200 ELSE 50 END;
  v_client_limit := CASE p_kind WHEN 'login' THEN 10 ELSE 3 END;
  IF EXISTS (SELECT 1 FROM auth.auth_attempts WHERE kind=p_kind AND expires_at > v_now + v_window)
  THEN RAISE EXCEPTION 'Authentication attempt clock unavailable'; END IF;
  DELETE FROM auth.auth_attempts WHERE kind=p_kind AND expires_at <= v_now;
  IF (SELECT count(*) FROM auth.auth_attempts WHERE kind=p_kind) > 1024
  THEN RAISE EXCEPTION 'Authentication attempt capacity unavailable'; END IF;
  SELECT coalesce(max(attempts) FILTER (WHERE network='*'),0),
         coalesce(max(attempts) FILTER (WHERE network=p_network),0),
         max(expires_at) FILTER (WHERE network='*'),
         max(expires_at) FILTER (WHERE network=p_network)
    INTO v_global,v_client,v_global_until,v_client_until
    FROM auth.auth_attempts WHERE kind=p_kind AND network IN ('*',p_network);
  v_wait := greatest(
    CASE WHEN v_global >= v_global_limit THEN ceil(extract(epoch FROM v_global_until-v_now))::integer ELSE 0 END,
    CASE WHEN v_client >= v_client_limit THEN ceil(extract(epoch FROM v_client_until-v_now))::integer ELSE 0 END);
  IF v_wait > 0 THEN RETURN v_wait; END IF;
  INSERT INTO auth.auth_attempts(kind,network,expires_at,attempts)
    VALUES (p_kind,'*',v_now+v_window,1),(p_kind,p_network,v_now+v_window,1)
    ON CONFLICT (kind,network) DO UPDATE SET attempts=auth.auth_attempts.attempts+1;
  RETURN 0;
END;
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth.consume_auth_attempt(text,text) FROM PUBLIC, colli_app;
--> statement-breakpoint
-- Already created as colli_auth_ops; no ownership transfer needed.
RESET ROLE;
SET LOCAL ROLE colli_migrator;
REVOKE CREATE ON SCHEMA auth FROM colli_auth_ops;
SET LOCAL ROLE colli_auth_ops;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth.consume_auth_attempt(text,text) TO colli_app;

RESET ROLE;
