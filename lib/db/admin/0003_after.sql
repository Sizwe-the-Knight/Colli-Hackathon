-- PREPARED ONLY; NOT part of the Drizzle migration folder.
-- Bootstrap administrator on maintenance DB, after migration success OR failure.
-- Remove the temporary handoff capability; independently verify membership gone.
BEGIN;
REVOKE colli_auth_ops FROM colli_migrator;
COMMIT;
