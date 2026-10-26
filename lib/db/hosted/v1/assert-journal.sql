DO $journal$
BEGIN
  IF EXISTS (WITH expected(phase,artifact_sha256) AS (VALUES
    ('hosted-v1-roles','a2ed14b3f266bdfef4addf8c9317191f075d073b6d63e573ba029d019b9f1613'),
    ('hosted-v1-schema','d72837aef9d86b9dd3245b6161d20173ea3cbfb8080f8c5d7a547e4c801b0946'),
    ('hosted-v1-runtime-grants','f0f94771746918007e5d211d1e8890ee575f47a781691bf1247732d5854fad05'),
    ('hosted-v1-auth-limits','c3f9ad3956b2b78a7c9337c4b4f980132193acd9746e9576c00a699d9f92593a'),
    ('hosted-v1-membership-cleanup','611abd0808c029d8a8fbdb1edee46d3a1ec4fa69b8742062002cbf722b0e9588')), actual AS (
      SELECT phase,artifact_sha256 FROM colli_hosted_migrations.journal)
    SELECT * FROM ((SELECT * FROM actual EXCEPT SELECT * FROM expected) UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)) differences)
    OR EXISTS (SELECT 1 FROM colli_hosted_migrations.journal WHERE lineage<>'colli-hosted-v1'
      OR manifest_sha256<>current_setting('colli.manifest_sha256') OR executed_by<>session_user)
  THEN RAISE EXCEPTION 'Hosted journal provenance mismatch'; END IF;
END;
$journal$;
