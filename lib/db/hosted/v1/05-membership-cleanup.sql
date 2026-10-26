-- Still in the SAME transaction. Remove temporary SET grants, NOT provider-created ADMIN-only grants.
RESET ROLE;
-- Schema phase already removed the migrator grant; reject any reappearance below.
REVOKE colli_auth_ops, colli_migrator FROM CURRENT_USER GRANTED BY CURRENT_USER;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members
       WHERE member IN ('colli_app'::regrole,'colli_migrator'::regrole,'colli_auth_ops'::regrole)
          OR (roleid IN ('colli_app'::regrole,'colli_migrator'::regrole,'colli_auth_ops'::regrole)
              AND NOT (member=session_user::regrole AND admin_option AND NOT inherit_option AND NOT set_option
                AND EXISTS (SELECT 1 FROM pg_roles g WHERE g.oid=grantor AND g.rolsuper))))
  THEN RAISE EXCEPTION 'Temporary membership cleanup failed'; END IF;
END;
$guard$;
