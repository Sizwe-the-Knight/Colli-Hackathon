import { Router, type IRouter } from "express";

const router: IRouter = Router();

const RECENT_CHANGES = [
  {
    id: "c1",
    text: "Claude usage declined 18% over 7 days.",
    type: "decline" as const,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    provider: "anthropic",
    detail: "Average daily token consumption fell from 42K to 34K.",
  },
  {
    id: "c2",
    text: "OpenAI average latency improved by 140ms.",
    type: "improvement" as const,
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    provider: "openai",
    detail: "P95 latency down from 960ms to 820ms following API update.",
  },
  {
    id: "c3",
    text: "Duplicate workflow detected: Customer Support Agent and Support Triage Agent.",
    type: "alert" as const,
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    provider: null,
    detail: "Both workflows process the same ticket queue with a 34% overlap.",
  },
  {
    id: "c4",
    text: "Subscription consolidation opportunity identified — estimated $41 monthly savings.",
    type: "info" as const,
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    provider: null,
    detail: "Merging Mistral and Perplexity tiers could reduce base costs.",
  },
  {
    id: "c5",
    text: "Gemini integration inactive — last used 9 days ago.",
    type: "warning" as const,
    timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    provider: "google",
    detail: "Integration remains connected but has received no requests since July 8.",
  },
  {
    id: "c6",
    text: "OpenAI token usage reached 84% of monthly allocation.",
    type: "warning" as const,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    provider: "openai",
    detail: "At current pace, the monthly limit will be reached in approximately 5 days.",
  },
];

router.get("/activity/recent-changes", async (_req, res): Promise<void> => {
  res.json(RECENT_CHANGES);
});

export default router;
