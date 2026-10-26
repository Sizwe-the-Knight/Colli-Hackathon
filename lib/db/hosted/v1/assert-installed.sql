-- Run as verified administrator after temporary membership removal.
-- Catalog/empty-state assertions only; no session or auth function invocation.
DO $verify$
BEGIN
  IF current_user <> session_user OR session_user <> current_setting('colli.expected_admin') THEN
    RAISE EXCEPTION 'Verification identity rejected'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('colli_app','colli_migrator')
      AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=-1) <> 2
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='colli_auth_ops'
      AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=0)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member IN
      ('colli_app'::regrole,'colli_migrator'::regrole,'colli_auth_ops'::regrole) OR (roleid IN
      ('colli_app'::regrole,'colli_migrator'::regrole,'colli_auth_ops'::regrole)
      AND NOT (member=session_user::regrole AND admin_option AND NOT inherit_option AND NOT set_option
        AND EXISTS (SELECT 1 FROM pg_roles g WHERE g.oid=grantor AND g.rolsuper))))
    OR (SELECT count(*) FROM pg_auth_members WHERE roleid IN
       ('colli_app'::regrole,'colli_migrator'::regrole,'colli_auth_ops'::regrole)) <> 3
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_default_acl WHERE defaclrole IN
      ('colli_app'::regrole,'colli_migrator'::regrole,'colli_auth_ops'::regrole))
  THEN RAISE EXCEPTION 'Role/default/membership contract mismatch'; END IF;
  IF NOT has_database_privilege('colli_app','neondb','CONNECT')
    OR has_database_privilege('colli_app','neondb','CREATE,TEMP')
    OR NOT has_database_privilege('colli_migrator','neondb','CREATE')
    OR EXISTS (SELECT 1 FROM pg_database d, LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a
      WHERE d.datname=current_database() AND a.grantee=0)
    OR EXISTS (SELECT 1 FROM pg_namespace n, LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
      WHERE n.nspname IN ('public','auth','colli_hosted_migrations') AND a.grantee=0)
    OR has_schema_privilege('colli_app','public','CREATE') OR has_schema_privilege('colli_app','auth','CREATE')
    OR has_schema_privilege('colli_auth_ops','auth','CREATE') OR has_schema_privilege('colli_auth_ops','public','CREATE')
    OR has_schema_privilege('colli_app','colli_hosted_migrations','USAGE,CREATE')
    OR NOT has_schema_privilege('colli_app','public','USAGE') OR NOT has_schema_privilege('colli_app','auth','USAGE')
    OR NOT has_schema_privilege('colli_auth_ops','public','USAGE') OR NOT has_schema_privilege('colli_auth_ops','auth','USAGE')
    OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='auth' AND nspowner='colli_migrator'::regrole)
    OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='colli_hosted_migrations' AND nspowner=session_user::regrole)
  THEN RAISE EXCEPTION 'Schema/database privilege mismatch'; END IF;
  IF (SELECT count(*) FROM pg_class WHERE oid IN ('public.users'::regclass,'public.users_id_seq'::regclass,
      'auth.sessions'::regclass,'auth.revoked_sessions'::regclass,'auth.auth_attempts'::regclass)
      AND relowner='colli_migrator'::regrole) <> 5
    OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='colli_hosted_migrations.journal'::regclass AND relowner=session_user::regrole)
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth' AND c.relkind IN ('r','p','v','m','S','f')) <> 3
  THEN RAISE EXCEPTION 'Table ownership/object mismatch'; END IF;
  IF EXISTS (WITH expected(rel,grantee,privilege_type,is_grantable) AS (VALUES ('public.users'::regclass,'colli_app'::regrole,'SELECT'::text,false),
('auth.sessions'::regclass,'colli_app'::regrole,'SELECT'::text,false),
('auth.sessions'::regclass,'colli_app'::regrole,'DELETE'::text,false),
('auth.sessions'::regclass,'colli_auth_ops'::regrole,'SELECT'::text,false),
('auth.sessions'::regclass,'colli_auth_ops'::regrole,'DELETE'::text,false),
('auth.revoked_sessions'::regclass,'colli_auth_ops'::regrole,'SELECT'::text,false),
('auth.revoked_sessions'::regclass,'colli_auth_ops'::regrole,'INSERT'::text,false),
('auth.revoked_sessions'::regclass,'colli_auth_ops'::regrole,'DELETE'::text,false),
('auth.auth_attempts'::regclass,'colli_auth_ops'::regrole,'SELECT'::text,false),
('auth.auth_attempts'::regclass,'colli_auth_ops'::regrole,'INSERT'::text,false),
('auth.auth_attempts'::regclass,'colli_auth_ops'::regrole,'UPDATE'::text,false),
('auth.auth_attempts'::regclass,'colli_auth_ops'::regrole,'DELETE'::text,false),
('public.users_id_seq'::regclass,'colli_app'::regrole,'USAGE'::text,false)), actual AS (
    SELECT c.oid,a.grantee,a.privilege_type,a.is_grantable FROM pg_class c,
      LATERAL aclexplode(c.relacl) a WHERE c.oid IN ('public.users'::regclass,'public.users_id_seq'::regclass,
        'auth.sessions'::regclass,'auth.revoked_sessions'::regclass,'auth.auth_attempts'::regclass,'colli_hosted_migrations.journal'::regclass)
      AND a.grantee <> c.relowner)
    SELECT * FROM ((SELECT * FROM actual EXCEPT SELECT * FROM expected) UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)) differences)
  THEN RAISE EXCEPTION 'Table/sequence ACL mismatch'; END IF;
  IF EXISTS (WITH expected(rel,col,grantee,privilege_type,is_grantable) AS (VALUES ('public.users'::regclass,'email'::name,'colli_app'::regrole,'INSERT'::text,false),
('public.users'::regclass,'name'::name,'colli_app'::regrole,'INSERT'::text,false),
('public.users'::regclass,'password_hash'::name,'colli_app'::regrole,'INSERT'::text,false),
('public.users'::regclass,'providers'::name,'colli_app'::regrole,'UPDATE'::text,false),
('public.users'::regclass,'updated_at'::name,'colli_app'::regrole,'UPDATE'::text,false),
('public.users'::regclass,'id'::name,'colli_auth_ops'::regrole,'SELECT'::text,false),
('public.users'::regclass,'auth_version'::name,'colli_auth_ops'::regrole,'SELECT'::text,false),
('public.users'::regclass,'auth_version'::name,'colli_auth_ops'::regrole,'UPDATE'::text,false),
('auth.sessions'::regclass,'sid'::name,'colli_app'::regrole,'INSERT'::text,false),
('auth.sessions'::regclass,'sess'::name,'colli_app'::regrole,'INSERT'::text,false),
('auth.sessions'::regclass,'expire'::name,'colli_app'::regrole,'INSERT'::text,false),
('auth.sessions'::regclass,'sess'::name,'colli_app'::regrole,'UPDATE'::text,false),
('auth.sessions'::regclass,'expire'::name,'colli_app'::regrole,'UPDATE'::text,false),
('auth.sessions'::regclass,'expire'::name,'colli_auth_ops'::regrole,'UPDATE'::text,false),
('auth.revoked_sessions'::regclass,'sid'::name,'colli_app'::regrole,'SELECT'::text,false),
('auth.revoked_sessions'::regclass,'retain_until'::name,'colli_app'::regrole,'SELECT'::text,false),
('auth.revoked_sessions'::regclass,'revoked_at'::name,'colli_auth_ops'::regrole,'UPDATE'::text,false),
('auth.revoked_sessions'::regclass,'retain_until'::name,'colli_auth_ops'::regrole,'UPDATE'::text,false)), actual AS (
    SELECT c.oid,at.attname,a.grantee,a.privilege_type,a.is_grantable FROM pg_class c
      JOIN pg_attribute at ON at.attrelid=c.oid, LATERAL aclexplode(at.attacl) a
      WHERE c.oid IN ('public.users'::regclass,'auth.sessions'::regclass,'auth.revoked_sessions'::regclass,'auth.auth_attempts'::regclass,'colli_hosted_migrations.journal'::regclass)
      AND a.grantee <> c.relowner)
    SELECT * FROM ((SELECT * FROM actual EXCEPT SELECT * FROM expected) UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)) differences)
  THEN RAISE EXCEPTION 'Column ACL mismatch'; END IF;
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace='auth'::regnamespace) <> 6
    OR EXISTS (WITH expected(signature,body_md5,definer,volatility,language,result_type) AS (VALUES ('auth._session_identity(json,timestamp,timestamptz)', '70cf6da620b27cf773a721f53140a29c', false, 'i', 'plpgsql', 'record'::regtype),
('auth._revoke_session(text,boolean)', 'a9b8bc2e8b1625032a1149ffd21cd6c2', false, 'v', 'plpgsql', 'text'::regtype),
('auth.revoke_current_session(text)', 'fe048f02b826a9b9985f46817a5ed97d', true, 'v', 'sql', 'text'::regtype),
('auth.revoke_all_sessions(text)', '63bf89ec1c7bdece6becb562ac7898b2', true, 'v', 'sql', 'text'::regtype),
('auth.cleanup_revoked_sessions()', '0929e1a0f6121d0c58085ab463b0a921', true, 'v', 'plpgsql', 'integer'::regtype),
('auth.consume_auth_attempt(text,text)', 'b4a3892846b0c6e81006c119d29d5d11', true, 'v', 'plpgsql', 'integer'::regtype))
      SELECT 1 FROM expected e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
      LEFT JOIN pg_language l ON l.oid=p.prolang WHERE p.oid IS NULL
      OR p.proowner <> 'colli_auth_ops'::regrole OR p.prosecdef <> e.definer
      OR p.provolatile::text <> e.volatility OR l.lanname <> e.language OR p.prorettype <> e.result_type
      OR p.proretset <> (e.result_type='record'::regtype) OR p.proisstrict OR p.proleakproof
      OR p.prokind<>'f' OR p.proparallel<>'u' OR p.pronargdefaults<>0
      OR md5(p.prosrc) <> e.body_md5
      OR p.proconfig IS NULL
      OR NOT ('search_path=pg_catalog, pg_temp'=ANY(p.proconfig))
      OR NOT ('TimeZone=UTC'=ANY(p.proconfig) OR 'timezone=UTC'=ANY(p.proconfig))
      OR cardinality(p.proconfig) <> 2
      OR has_function_privilege('colli_app',p.oid,'EXECUTE') <> e.definer
      OR EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        WHERE a.grantee <> p.proowner AND (a.grantee <> 'colli_app'::regrole OR NOT e.definer
          OR a.privilege_type <> 'EXECUTE' OR a.is_grantable)))
  THEN RAISE EXCEPTION 'Function definition/security/ACL mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM public.users) OR EXISTS (SELECT 1 FROM auth.sessions)
    OR EXISTS (SELECT 1 FROM auth.revoked_sessions) OR EXISTS (SELECT 1 FROM auth.auth_attempts)
  THEN RAISE EXCEPTION 'Expected empty hosted baseline'; END IF;
END;
$verify$;
SELECT (SELECT count(*) FROM public.users) AS users,
       (SELECT count(*) FROM auth.sessions) AS sessions,
       (SELECT count(*) FROM auth.revoked_sessions) AS markers,
       (SELECT count(*) FROM auth.auth_attempts) AS auth_attempts;
