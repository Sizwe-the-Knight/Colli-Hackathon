import { sql } from "drizzle-orm";
import { check, index, integer, json, pgSchema, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";

export const authSchema = pgSchema("auth");

// Runtime has function EXECUTE only, never direct table access.
export const authAttemptsTable = authSchema.table('auth_attempts', {
  kind: varchar('kind', { length: 8 }).notNull(),
  network: varchar('network', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull(),
}, table => [
  primaryKey({ columns: [table.kind, table.network] }),
  check('auth_attempts_kind', sql`${table.kind} in ('login', 'register')`),
  check('auth_attempts_network', sql`${table.network} = '*' or ${table.network} ~ '^[a-f0-9]{64}$'`),
  check('auth_attempts_count', sql`${table.attempts} between 1 and 200`),
]);

// Matches connect-pg-simple 10.0.0. Its to_timestamp() queries require every
// session-store connection to use UTC with this timezone-less expiry column.
// Do not activate the store until the migration and runtime policy are approved.
export const sessionsTable = authSchema.table("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6, withTimezone: false }).notNull(),
}, (table) => [
  index("sessions_expire_idx").on(table.expire),
  // Text extraction avoids failing on malformed/legacy JSON during cleanup.
  index("sessions_user_id_idx").on(sql`(${table.sess} ->> 'userId')`),
]);

// Separate from sessions: deleting a session must not delete its revocation
// marker. Runtime DELETE/UPDATE on this table must not be granted for cleanup.
export const revokedSessionsTable = authSchema.table("revoked_sessions", {
  sid: varchar("sid").primaryKey(),
  revokedAt: timestamp("revoked_at", { precision: 6, withTimezone: true }).notNull().defaultNow(),
  retainUntil: timestamp("retain_until", { precision: 6, withTimezone: true }).notNull(),
}, (table) => [
  index("revoked_sessions_retain_until_idx").on(table.retainUntil),
  check("revoked_sessions_retention_bound", sql`${table.retainUntil} > ${table.revokedAt} and ${table.retainUntil} <= ${table.revokedAt} + interval '168 hours'`),
]);
