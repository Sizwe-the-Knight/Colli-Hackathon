import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  authVersion: integer("auth_version").notNull().default(1),
  // Stored as JSON string, e.g. '["openai","anthropic"]'. Null = not onboarded yet.
  providers: text("providers"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  check("users_auth_version_positive", sql`${table.authVersion} > 0`),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, authVersion: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
