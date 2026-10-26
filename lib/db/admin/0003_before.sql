-- PREPARED ONLY; NOT part of the Drizzle migration folder.
-- Bootstrap administrator on the maintenance database, after identity/ACL review.
-- A pre-existing role is an error requiring inspection; never silently reuse it.
BEGIN;
CREATE ROLE colli_auth_ops NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 0;
GRANT colli_auth_ops TO colli_migrator WITH INHERIT FALSE;
GRANT colli_auth_ops TO colli_migrator WITH SET TRUE;
GRANT colli_auth_ops TO colli_migrator WITH ADMIN FALSE;
COMMIT;
