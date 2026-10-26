import { Router, type IRouter } from "express";

const router: IRouter = Router();

const WORKFLOWS = [
  {
    id: "w1",
    name: "Customer Support Agent",
    description: "Handles tier-1 support tickets via Claude and routes escalations",
    status: "healthy" as const,
    executionCount: 112,
    failedCount: 0,
    avgRuntimeMs: 3400,
    lastRunAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    provider: "anthropic",
  },
  {
    id: "w2",
    name: "Sales Report Agent",
    description: "Generates weekly sales performance summaries from CRM data",
    status: "warning" as const,
    executionCount: 48,
    failedCount: 2,
    avgRuntimeMs: 8200,
    lastRunAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    provider: "openai",
  },
  {
    id: "w3",
    name: "Lead Scoring Pipeline",
    description: "Scores inbound leads from web forms using intent signals",
    status: "healthy" as const,
    executionCount: 334,
    failedCount: 1,
    avgRuntimeMs: 1800,
    lastRunAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    provider: "openai",
  },
  {
    id: "w4",
    name: "Weekly Digest",
    description: "Compiles executive digest from multiple data sources",
    status: "healthy" as const,
    executionCount: 28,
    failedCount: 0,
    avgRuntimeMs: 12400,
    lastRunAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    provider: "anthropic",
  },
  {
    id: "w5",
    name: "Support Triage Agent",
    description: "Secondary triage layer — partially overlapping with Customer Support Agent",
    status: "warning" as const,
    executionCount: 67,
    failedCount: 0,
    avgRuntimeMs: 2900,
    lastRunAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    provider: "mistral",
  },
  {
    id: "w6",
    name: "Content Summarizer",
    description: "Summarizes incoming research and news articles",
    status: "healthy" as const,
    executionCount: 201,
    failedCount: 3,
    avgRuntimeMs: 2100,
    lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    provider: "perplexity",
  },
  {
    id: "w7",
    name: "Competitive Intel Monitor",
    description: "Monitors competitor announcements and pricing changes",
    status: "healthy" as const,
    executionCount: 56,
    failedCount: 0,
    avgRuntimeMs: 5600,
    lastRunAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    provider: "perplexity",
  },
];

router.get("/workflows", async (_req, res): Promise<void> => {
  res.json(WORKFLOWS);
});

export default router;
