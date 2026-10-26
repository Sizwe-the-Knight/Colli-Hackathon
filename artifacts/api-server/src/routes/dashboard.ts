import { Router, type IRouter } from "express";

const router: IRouter = Router();

function getHealthScore() {
  return {
    score: 92,
    previousScore: 88,
    status: "healthy" as const,
    label: "Healthy",
    change: 4,
  };
}

function getExecutiveBrief() {
  return {
    date: new Date().toISOString().split("T")[0],
    summary: "Your AI ecosystem is performing well. Three highlights require attention this morning.",
    items: [
      { id: "1", text: "AI Health Score increased 4 points from yesterday.", type: "positive" as const, detail: "Score moved from 88 to 92." },
      { id: "2", text: "Claude usage declined 18% over the past 7 days.", type: "warning" as const, detail: "Down from 42K tokens/day to 34K tokens/day." },
      { id: "3", text: "Gemini has been inactive for 9 days.", type: "warning" as const, detail: "Last active: July 8, 2026." },
      { id: "4", text: "Estimated monthly savings of $41 identified.", type: "positive" as const, detail: "Duplicate workflows consuming overlapping capacity." },
      { id: "5", text: "Duplicate workflow detected across two automation pipelines.", type: "negative" as const, detail: "Customer Support Agent and Support Triage Agent are running redundant executions." },
      { id: "6", text: "Three automations completed successfully overnight.", type: "positive" as const, detail: "Sales Report, Weekly Digest, and Lead Scoring completed with no errors." },
      { id: "7", text: "One provider approaching token limit threshold.", type: "warning" as const, detail: "OpenAI is at 84% of monthly token allocation." },
      { id: "8", text: "Overall ecosystem healthy and operating within budget.", type: "info" as const, detail: null },
    ],
  };
}

function getMetrics() {
  return {
    totalMonthlySpend: 1284.50,
    estimatedSavings: 41.00,
    activeModels: 4,
    activeWorkflows: 7,
    totalTokensToday: 187400,
    failedExecutions: 2,
  };
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  res.json({
    healthScore: getHealthScore(),
    brief: getExecutiveBrief(),
    metrics: getMetrics(),
  });
});

router.get("/dashboard/health-score", async (_req, res): Promise<void> => {
  res.json(getHealthScore());
});

router.get("/dashboard/brief", async (_req, res): Promise<void> => {
  res.json(getExecutiveBrief());
});

export default router;
