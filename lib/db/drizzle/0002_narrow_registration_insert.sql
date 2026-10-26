REVOKE INSERT ON TABLE public.users FROM colli_app;
--> statement-breakpoint
REVOKE INSERT
  (id, email, name, password_hash, auth_version, providers, created_at, updated_at)
  ON TABLE public.users FROM colli_app;
--> statement-breakpoint
GRANT INSERT (email, name, password_hash)
  ON TABLE public.users TO colli_app;
