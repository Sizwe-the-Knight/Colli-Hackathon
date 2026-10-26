-- READ-ONLY preflight source; NOT executed in this session.
-- Use the approved direct TLS connection (not a transaction-pooler endpoint).
-- Operator separately matches current_user/database to the approved target.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '3s';
SELECT current_user, session_user, current_database(),
       current_setting('server_version_num')::integer BETWEEN 170000 AND 179999 AS postgres_17,
       (SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls_active,
       (SELECT rolcanlogin AND rolcreaterole FROM pg_catalog.pg_roles WHERE rolname=current_user) AS can_manage_roles,
       pg_catalog.has_database_privilege(current_user,current_database(),'CREATE') AS can_create_schema,
       EXISTS (SELECT 1 FROM pg_catalog.pg_language WHERE lanname='plpgsql') AS plpgsql_available,
       pg_catalog.to_regprocedure('pg_catalog.pg_advisory_xact_lock(integer,integer)') IS NOT NULL AS advisory_locks_available;
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolinherit,
       rolreplication, rolbypassrls, rolconnlimit
FROM pg_catalog.pg_roles WHERE rolname IN ('colli_migrator','colli_app','colli_auth_ops');
SELECT parent.rolname AS granted_role, member.rolname AS member_role,
       m.admin_option, m.inherit_option, m.set_option
FROM pg_catalog.pg_auth_members m
JOIN pg_catalog.pg_roles parent ON parent.oid=m.roleid
JOIN pg_catalog.pg_roles member ON member.oid=m.member
WHERE parent.rolname IN ('colli_migrator','colli_app','colli_auth_ops')
   OR member.rolname IN ('colli_migrator','colli_app','colli_auth_ops');
SELECT nspname FROM pg_catalog.pg_namespace
WHERE nspname IN ('auth','drizzle','colli_hosted_migrations');
ROLLBACK;
