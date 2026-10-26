import { Router, type IRouter } from "express";
import { sessions } from '../lib/session-runtime';

const router: IRouter = Router();

const NOTIFICATIONS = [
  {
    id: "n1",
    title: "OpenAI token usage at 84%",
    body: "At the current pace, your monthly token limit will be reached in approximately 5 days.",
    kind: "warning" as const,
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: "n2",
    title: "Duplicate workflow detected",
    body: "Customer Support Agent and Support Triage Agent share a 34% execution overlap.",
    kind: "alert" as const,
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
  },
  {
    id: "n3",
    title: "Workflow completed overnight",
    body: "Weekly Digest, Sales Report, and Lead Scoring ran successfully with no errors.",
    kind: "success" as const,
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "n4",
    title: "New recommendation generated",
    body: "Enabling prompt caching on Claude could reduce token spend by an estimated 30–40%.",
    kind: "info" as const,
    read: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: "n5",
    title: "API pricing update — Anthropic",
    body: "Anthropic updated Claude 3.5 Sonnet pricing. Your estimated monthly spend may decrease by ~8%.",
    kind: "info" as const,
    read: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 11).toISOString(),
  },
  {
    id: "n6",
    title: "Weekly executive summary available",
    body: "Your week-of-July-14 summary is ready. AI ecosystem health: 92/100.",
    kind: "info" as const,
    read: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

router.get("/notifications", async (_req, res): Promise<void> => {
  res.json(NOTIFICATIONS);
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  // Still sample notifications; no durable notification data exists. Retain the
  // transactional authorization boundary before any future persistent mutation.
  const saved = await sessions.mutate(req.sessionID, async () => ({ success: true }));
  Object.assign(req.session, saved.identity);
  await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
  res.json(saved.result);
});

export default router;
