import { pool } from '@workspace/db';

export interface Readiness {
  status: 'ready' | 'unavailable';
  process: 'available';
  database: 'available' | 'unavailable';
  sessions: 'ready' | 'unavailable' | 'unchecked';
}

// Catalog checks are read-only. They verify effective privileges (including
// inheritance/PUBLIC), not just explicit grants. No functions are invoked here.
export const sessionReadinessSql = `WITH required_columns(relation, col, privilege) AS (VALUES
  ('public.users','id','SELECT'), ('public.users','auth_version','SELECT'),
  ('public.users','email','INSERT'), ('public.users','name','INSERT'), ('public.users','password_hash','INSERT'),
  ('public.users','providers','UPDATE'), ('public.users','updated_at','UPDATE'),
  ('auth.sessions','sid','INSERT'), ('auth.sessions','sess','INSERT'), ('auth.sessions','expire','INSERT'),
  ('auth.sessions','sess','UPDATE'), ('auth.sessions','expire','UPDATE'),
  ('auth.revoked_sessions','sid','SELECT'), ('auth.revoked_sessions','retain_until','SELECT')
), forbidden_columns(relation, col, privilege) AS (VALUES
  ('public.users','id','INSERT'), ('public.users','auth_version','INSERT'),
  ('public.users','providers','INSERT'), ('public.users','created_at','INSERT'), ('public.users','updated_at','INSERT'),
  ('public.users','id','UPDATE'), ('public.users','email','UPDATE'), ('public.users','name','UPDATE'),
  ('public.users','password_hash','UPDATE'), ('public.users','auth_version','UPDATE'), ('public.users','created_at','UPDATE'),
  ('auth.sessions','sid','UPDATE'), ('auth.revoked_sessions','revoked_at','SELECT')
), expected_functions(signature, definer, runtime_allowed) AS (VALUES
  ('auth.revoke_current_session(text)',true,true), ('auth.revoke_all_sessions(text)',true,true),
  ('auth.cleanup_revoked_sessions()',true,true), ('auth._revoke_session(text,boolean)',false,false),
  ('auth._session_identity(json,timestamp,timestamptz)',false,false)
)
SELECT
  EXISTS (SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid=to_regprocedure('auth.consume_auth_attempt(text,text)')
      AND p.proowner='colli_auth_ops'::regrole AND p.prosecdef
      AND has_function_privilege(current_user,p.oid,'EXECUTE')
      AND NOT has_function_privilege(current_user,p.oid,'EXECUTE WITH GRANT OPTION')
      AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE lower(c)='timezone=utc')
      AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE replace(lower(c),' ','')='search_path=pg_catalog,pg_temp')
      AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0))
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid=to_regclass('auth.auth_attempts') AND relowner='colli_migrator'::regrole)
    AND has_table_privilege('colli_auth_ops','auth.auth_attempts','SELECT')
    AND has_table_privilege('colli_auth_ops','auth.auth_attempts','INSERT')
    AND has_table_privilege('colli_auth_ops','auth.auth_attempts','UPDATE')
    AND has_table_privilege('colli_auth_ops','auth.auth_attempts','DELETE')
    AND NOT has_schema_privilege('colli_auth_ops','auth','CREATE')
    AND NOT has_table_privilege(current_user,'auth.auth_attempts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AND NOT has_any_column_privilege(current_user,'auth.auth_attempts','SELECT,INSERT,UPDATE,REFERENCES') AS auth_limits_ok,
  current_user = 'colli_app' AND session_user = 'colli_app'
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = current_user
      AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls)
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member = current_user::regrole) AS identity_ok,
  current_setting('TimeZone') = 'UTC' AS utc_ok,
  has_schema_privilege(current_user,'auth','USAGE')
    AND has_table_privilege(current_user,'public.users','SELECT')
    AND has_table_privilege(current_user,'auth.sessions','SELECT')
    AND has_table_privilege(current_user,'auth.sessions','DELETE')
    AND has_sequence_privilege(current_user,pg_get_serial_sequence('public.users','id'),'USAGE')
    AND NOT EXISTS (SELECT 1 FROM required_columns WHERE NOT has_column_privilege(current_user,relation,col,privilege)) AS required_ok,
  NOT has_schema_privilege(current_user,'auth','CREATE') AND NOT has_schema_privilege(current_user,'public','CREATE')
    AND NOT EXISTS (SELECT 1 FROM forbidden_columns WHERE has_column_privilege(current_user,relation,col,privilege))
    AND NOT has_table_privilege(current_user,'public.users','DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AND NOT has_table_privilege(current_user,'auth.sessions','TRUNCATE,REFERENCES,TRIGGER')
    AND NOT has_table_privilege(current_user,'auth.revoked_sessions','DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AND NOT has_any_column_privilege(current_user,'auth.revoked_sessions','INSERT,UPDATE')
    AND NOT EXISTS (SELECT 1 FROM required_columns WHERE has_column_privilege(current_user,relation,col,privilege || ' WITH GRANT OPTION'))
    AND NOT has_table_privilege(current_user,'auth.sessions','SELECT WITH GRANT OPTION,DELETE WITH GRANT OPTION') AS restricted_ok,
  (SELECT count(*) = 5 AND bool_and(p.proowner = 'colli_auth_ops'::regrole AND p.prosecdef = f.definer
    AND has_function_privilege(current_user,p.oid,'EXECUTE') = f.runtime_allowed
    AND NOT has_function_privilege(current_user,p.oid,'EXECUTE WITH GRANT OPTION')
    AND EXISTS (SELECT 1 FROM unnest(p.proconfig) AS config WHERE lower(config) = 'timezone=utc')
    AND EXISTS (SELECT 1 FROM unnest(p.proconfig) AS config WHERE replace(lower(config),' ','') = 'search_path=pg_catalog,pg_temp')
    AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee = 0))
   FROM expected_functions f JOIN pg_catalog.pg_proc p ON p.oid = to_regprocedure(f.signature)) AS functions_ok,
  (SELECT count(*) = 3 AND bool_and(a.attnotnull AND
     ((a.attname = 'sid' AND a.atttypid = 'varchar'::regtype)
      OR (a.attname = 'sess' AND a.atttypid = 'json'::regtype)
      OR (a.attname = 'expire' AND a.atttypid = 'timestamp'::regtype AND a.atttypmod = 6)))
   FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'auth.sessions'::regclass
     AND a.attnum > 0 AND NOT a.attisdropped) AND EXISTS (
       SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_attribute a
       ON a.attrelid = c.conrelid AND a.attname = 'sid'
       WHERE c.conrelid = 'auth.sessions'::regclass AND c.contype = 'p' AND c.conkey = ARRAY[a.attnum]) AS schema_ok`;

const flags = ['identity_ok','utc_ok','required_ok','restricted_ok','functions_ok','schema_ok','auth_limits_ok'] as const;

export async function checkSessionReadiness(): Promise<Readiness> {
  const state: Readiness = { status: 'unavailable', process: 'available', database: 'unavailable', sessions: 'unchecked' };
  let client: Awaited<ReturnType<typeof acquire>>;
  try { client = await acquire(); } catch { return state; }
  let discard = false;
  try {
    await client.query('SELECT 1');
    state.database = 'available'; state.sessions = 'unavailable';
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '2s'");
    await client.query("SET LOCAL lock_timeout = '1s'");
    const { rows } = await client.query<Record<typeof flags[number], boolean>>(sessionReadinessSql);
    if (rows.length !== 1 || !flags.every(flag => rows[0][flag] === true)) throw new Error('Session prerequisites not met');
    await client.query('SELECT sid, sess, expire FROM auth.sessions LIMIT 0');
    await client.query('SELECT sid, retain_until FROM auth.revoked_sessions LIMIT 0');
    await client.query('SELECT id, auth_version FROM public.users LIMIT 0');
    await client.query('COMMIT');
    state.status = 'ready'; state.sessions = 'ready';
  } catch {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
  } finally { client.release(discard); }
  return state;
}

// Explicit zero-argument wrapper avoids pg's callback-overload ReturnType trap.
function acquire() { return pool.connect(); }
