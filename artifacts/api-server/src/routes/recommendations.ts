import { Router, type IRouter } from "express";

const router: IRouter = Router();

const RECOMMENDATIONS = [
  {
    id: "r1",
    title: "Merge duplicate automations",
    description: "Customer Support Agent and Support Triage Agent share a 34% execution overlap. Consolidating them would reduce token spend and simplify monitoring.",
    priority: "high" as const,
    estimatedSavings: 28.40,
    category: "optimization" as const,
    actionLabel: "Review workflows",
  },
  {
    id: "r2",
    title: "Disable inactive Gemini integration",
    description: "Gemini has been inactive for 9 days while incurring a base subscription cost. Pausing the integration would free budget without impacting active pipelines.",
    priority: "medium" as const,
    estimatedSavings: 12.60,
    category: "cost" as const,
    actionLabel: "Review integration",
  },
  {
    id: "r3",
    title: "Upgrade OpenAI API tier before month end",
    description: "Current token usage is at 84% of your monthly plan. At this pace you will hit the limit in approximately 5 days, which may interrupt live workflows.",
    priority: "high" as const,
    estimatedSavings: null,
    category: "performance" as const,
    actionLabel: "Review usage",
  },
  {
    id: "r4",
    title: "Enable prompt caching for Claude",
    description: "Enabling Anthropic's prompt caching on your Customer Support Agent could reduce token consumption by an estimated 30–40% on repeated system prompts.",
    priority: "medium" as const,
    estimatedSavings: 41.00,
    category: "cost" as const,
    actionLabel: "Learn more",
  },
  {
    id: "r5",
    title: "Consolidate Mistral and Perplexity subscriptions",
    description: "Both providers offer API-only tiers without base subscription fees. Reviewing your current tier structure could eliminate fixed monthly costs.",
    priority: "low" as const,
    estimatedSavings: 18.00,
    category: "cost" as const,
    actionLabel: null,
  },
];

router.get("/recommendations", async (_req, res): Promise<void> => {
  res.json(RECOMMENDATIONS);
});

export default router;
