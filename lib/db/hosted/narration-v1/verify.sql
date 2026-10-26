-- Read-only, suitable for a fresh administrator connection after installation.
DO $verify$
DECLARE v_signature text;
BEGIN
  IF pg_catalog.has_table_privilege('colli_app','auth.narration_attempts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR pg_catalog.has_any_column_privilege('colli_app','auth.narration_attempts','SELECT,INSERT,UPDATE,REFERENCES')
    OR pg_catalog.has_schema_privilege('colli_app','auth','CREATE')
    OR pg_catalog.has_schema_privilege('colli_auth_ops','auth','CREATE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member='colli_app'::regrole)
    OR pg_catalog.pg_has_role('colli_migrator','colli_auth_ops','MEMBER')
    OR (SELECT relowner FROM pg_catalog.pg_class WHERE oid='auth.narration_attempts'::regclass) <> 'colli_migrator'::regrole
  THEN RAISE EXCEPTION 'Narration table privilege mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members
    WHERE roleid IN ('colli_migrator'::regrole,'colli_auth_ops'::regrole)
      AND NOT (member=session_user::regrole AND admin_option AND NOT inherit_option AND NOT set_option
        AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles g WHERE g.oid=grantor AND g.rolsuper)))
  THEN RAISE EXCEPTION 'Narration temporary membership remains'; END IF;
  FOREACH v_signature IN ARRAY ARRAY['auth.reserve_narration(text,text,boolean,integer,integer)',
    'auth.read_narration(text,text)','auth.save_narration(text,text,jsonb)'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid=v_signature::regprocedure
      AND proowner='colli_auth_ops'::regrole AND prosecdef
      AND 'search_path=pg_catalog, pg_temp'=ANY(proconfig))
      OR NOT pg_catalog.has_function_privilege('colli_app',v_signature,'EXECUTE')
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p,
        LATERAL pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
        WHERE p.oid=v_signature::regprocedure AND a.grantee NOT IN ('colli_auth_ops'::regrole,'colli_app'::regrole))
    THEN RAISE EXCEPTION 'Narration function privilege mismatch'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM colli_hosted_migrations.narration_v1) <> 1
  THEN RAISE EXCEPTION 'Narration provenance mismatch'; END IF;
END;
$verify$;
SELECT version,artifact_sha256,applied_at FROM colli_hosted_migrations.narration_v1;
