import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, pool, usersTable } from "@workspace/db";
import { establishSession, logout, logoutAll, requireAuth } from "../lib/security";
import { sessions } from '../lib/session-runtime';
import { Unauthenticated } from '../lib/session-policy';
import {
  RegisterBody,
  LoginBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const SALT_ROUNDS = 12;
const validPassword = (value: string) => value.length > 0 && Buffer.byteLength(value, "utf8") <= 72;
const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function parseProviders(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    providers: parseProviders(user.providers),
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid registration input" });
    return;
  }

  const { email, password, name } = parsed.data;
  if (!validPassword(password) || Array.from(password).length < 15 || !name.trim() || name.length > 200 || !validEmail(email)) {
    res.status(400).json({ error: "Invalid registration input" }); return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  let user: typeof usersTable.$inferSelect | undefined;
  try {
    // Drizzle's insert builder lists defaulted columns too. Keep registration
    // compatible with INSERT privileges limited to these three columns.
    const result = await pool.query<typeof usersTable.$inferSelect>(
      `INSERT INTO public.users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, password_hash AS "passwordHash",
                 auth_version AS "authVersion", providers,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [email, name, passwordHash],
    );
    [user] = result.rows;
  } catch (error) {
    const failure = error as { code?: string; cause?: { code?: string } };
    if (failure.code === "23505" || failure.cause?.code === "23505") {
      res.status(409).json({ error: "Email already in use" }); return;
    }
    throw error;
  }
  if (!user) throw new Error("Registration unavailable");

  await establishSession(req, res, user.id);

  res.status(201).json(serializeUser(user));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid login input" });
    return;
  }

  const { email, password } = parsed.data;
  if (!validPassword(password) || !validEmail(email)) {
    res.status(400).json({ error: "Invalid login input" }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await establishSession(req, res, user.id);

  res.json(serializeUser(user));
});

router.post("/auth/logout", logout);
router.post('/auth/logout-all', logoutAll);

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json(serializeUser(user));
});

// Save provider selections from onboarding
router.patch("/auth/providers", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const providers: unknown = req.body?.providers;
  if (!Array.isArray(providers) || providers.length > 50 || providers.some((p: unknown) => typeof p !== "string" || p.length === 0 || p.length > 100)) {
    res.status(400).json({ error: "providers must be an array of strings" });
    return;
  }

  const saved = await sessions.mutate(req.sessionID, async (client, identity) => {
    const result = await client.query<typeof usersTable.$inferSelect>(
      `UPDATE public.users SET providers = $1, updated_at = clock_timestamp() WHERE id = $2
       RETURNING id, email, name, providers, created_at AS "createdAt"`,
      [JSON.stringify(providers), identity.userId]);
    if (!result.rows[0]) throw new Unauthenticated();
    return result.rows[0];
  });
  Object.assign(req.session, saved.identity);
  await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
  res.json(serializeUser(saved.result));
});

export default router;
