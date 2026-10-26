CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TABLE "auth"."revoked_sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"revoked_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"retain_until" timestamp (6) with time zone NOT NULL,
	CONSTRAINT "revoked_sessions_retention_bound" CHECK ("auth"."revoked_sessions"."retain_until" > "auth"."revoked_sessions"."revoked_at" and "auth"."revoked_sessions"."retain_until" <= "auth"."revoked_sessions"."revoked_at" + interval '168 hours')
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "revoked_sessions_retain_until_idx" ON "auth"."revoked_sessions" USING btree ("retain_until");--> statement-breakpoint
CREATE INDEX "sessions_expire_idx" ON "auth"."sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING btree (("sess" ->> 'userId'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_auth_version_positive" CHECK ("users"."auth_version" > 0);