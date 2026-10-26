-- PREPARED ONLY. Included inside bootstrap.psql's single transaction.
DO $guard$
BEGIN
  IF current_user <> current_setting('colli.expected_admin')
     OR current_setting('colli.hosted_bootstrap',true) IS DISTINCT FROM 'v1'
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('colli_app','colli_migrator','colli_auth_ops'))
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname IN ('auth','drizzle','colli_hosted_migrations'))
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
                WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d
                  WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'))
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_default_acl WHERE defaclrole=current_user::regrole)
  THEN RAISE EXCEPTION 'Fresh hosted target required; inspect without repair'; END IF;
END;
$guard$;
-- No password is embedded. LOGIN roles cannot authenticate until separately set privately.
CREATE ROLE colli_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD NULL;
CREATE ROLE colli_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD NULL;
CREATE ROLE colli_auth_ops NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 0;
-- PostgreSQL 17 gives the creator immutable ADMIN-only memberships from the bootstrap
-- superuser. Add DISTINCT self-granted SET access, removed before commit.
GRANT colli_migrator, colli_auth_ops TO CURRENT_USER WITH INHERIT FALSE GRANTED BY CURRENT_USER;
GRANT colli_migrator, colli_auth_ops TO CURRENT_USER WITH SET TRUE GRANTED BY CURRENT_USER;
GRANT colli_migrator, colli_auth_ops TO CURRENT_USER WITH ADMIN FALSE GRANTED BY CURRENT_USER;
GRANT colli_auth_ops TO colli_migrator WITH INHERIT FALSE;
GRANT colli_auth_ops TO colli_migrator WITH SET TRUE;
GRANT colli_auth_ops TO colli_migrator WITH ADMIN FALSE;
REVOKE ALL ON DATABASE neondb FROM PUBLIC;
GRANT CONNECT, CREATE ON DATABASE neondb TO colli_migrator;
GRANT CONNECT ON DATABASE neondb TO colli_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO colli_migrator;
GRANT USAGE ON SCHEMA public TO colli_app;
CREATE SCHEMA colli_hosted_migrations;
REVOKE ALL ON SCHEMA colli_hosted_migrations FROM PUBLIC, colli_app, colli_migrator, colli_auth_ops;
CREATE TABLE colli_hosted_migrations.journal (
  phase text PRIMARY KEY,
  lineage text NOT NULL CHECK (lineage='colli-hosted-v1'),
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  executed_by name NOT NULL DEFAULT session_user,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON colli_hosted_migrations.journal FROM PUBLIC, colli_app, colli_migrator, colli_auth_ops;
