-- Local-only 0004 administrator/transport guard replaced by connection-guard.psql.
-- Retain its role, ownership and excess-authority predicates; four GRANTs unchanged.
RESET ROLE;
DO $guard$
BEGIN
  IF current_user <> session_user OR current_user <> current_setting('colli.expected_admin')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'colli_app'
       AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
       AND NOT rolreplication AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'colli_auth_ops'
       AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
       AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit AND rolconnlimit = 0)
     OR pg_catalog.pg_has_role('colli_app', 'colli_auth_ops', 'MEMBER')
     OR pg_catalog.pg_has_role('colli_migrator', 'colli_auth_ops', 'MEMBER') THEN
    RAISE EXCEPTION 'Runtime-grant role state rejected';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class WHERE oid IN
      ('public.users'::regclass, 'auth.sessions'::regclass, 'auth.revoked_sessions'::regclass)
      AND relowner <> 'colli_migrator'::regrole
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc WHERE oid IN
      ('auth.revoke_current_session(text)'::regprocedure, 'auth.revoke_all_sessions(text)'::regprocedure,
       'auth.cleanup_revoked_sessions()'::regprocedure, 'auth._revoke_session(text,boolean)'::regprocedure,
       'auth._session_identity(json,timestamp,timestamptz)'::regprocedure)
      AND proowner <> 'colli_auth_ops'::regrole
  ) THEN RAISE EXCEPTION 'Runtime-grant ownership rejected'; END IF;
  -- Reject unexpected excess authority rather than silently repairing ACLs.
  IF pg_catalog.has_schema_privilege('colli_app', 'auth', 'CREATE')
     OR pg_catalog.has_schema_privilege('colli_app', 'public', 'CREATE')
     OR pg_catalog.has_column_privilege('colli_app', 'public.users', 'auth_version', 'UPDATE')
     OR pg_catalog.has_column_privilege('colli_app', 'public.users', 'auth_version', 'INSERT')
     OR pg_catalog.has_any_column_privilege('colli_app', 'auth.revoked_sessions', 'INSERT,UPDATE')
     OR pg_catalog.has_table_privilege('colli_app', 'auth.revoked_sessions', 'DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR pg_catalog.has_function_privilege('colli_app', 'auth._revoke_session(text,boolean)', 'EXECUTE')
     OR pg_catalog.has_function_privilege('colli_app', 'auth._session_identity(json,timestamp,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected runtime authority';
  END IF;
END;
$guard$;

SET LOCAL ROLE colli_migrator;
GRANT USAGE ON SCHEMA auth TO colli_app;
--> statement-breakpoint
GRANT SELECT, INSERT (sid, sess, expire), UPDATE (sess, expire), DELETE
  ON auth.sessions TO colli_app;
--> statement-breakpoint
GRANT SELECT (sid, retain_until) ON auth.revoked_sessions TO colli_app;
--> statement-breakpoint
SET LOCAL ROLE colli_auth_ops;
GRANT EXECUTE ON FUNCTION auth.revoke_current_session(text),
  auth.revoke_all_sessions(text), auth.cleanup_revoked_sessions() TO colli_app;

RESET ROLE;
