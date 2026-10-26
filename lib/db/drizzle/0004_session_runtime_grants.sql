-- PREPARED ONLY. Requires separate approval and the existing Drizzle migrate()
-- transaction on the disposable database as colli_bootstrap. Functions belong
-- to colli_auth_ops, tables to colli_migrator; neither membership nor ownership
-- is changed. Do not run this migration as the application or use push.
DO $guard$
BEGIN
  IF current_user <> 'colli_bootstrap' OR session_user <> 'colli_bootstrap'
     OR current_database() <> 'colli_dev_disposable'
     OR host(inet_server_addr()) IS DISTINCT FROM '127.0.0.1'
     OR inet_server_port() IS DISTINCT FROM 55432 THEN
    RAISE EXCEPTION 'Runtime-grant migration identity rejected';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = current_user AND rolsuper)
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
--> statement-breakpoint
GRANT USAGE ON SCHEMA auth TO colli_app;
--> statement-breakpoint
GRANT SELECT, INSERT (sid, sess, expire), UPDATE (sess, expire), DELETE
  ON auth.sessions TO colli_app;
--> statement-breakpoint
GRANT SELECT (sid, retain_until) ON auth.revoked_sessions TO colli_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth.revoke_current_session(text),
  auth.revoke_all_sessions(text), auth.cleanup_revoked_sessions() TO colli_app;
