import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Simulated cost data — deterministic per day
function getDailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededRandom(seed: number, index: number) {
  const x = Math.sin(seed * 9301 + index * 49297 + 233) * 43758.5453;
  return x - Math.floor(x);
}

function fluctuate(base: number, variancePct: number, seed: number, index: number) {
  const r = seededRandom(seed, index);
  const delta = base * variancePct * (r - 0.5);
  return Math.round((base + delta) * 100) / 100;
}

router.get("/costs/summary", async (_req, res): Promise<void> => {
  const seed = getDailySeed();

  const providers = [
    { id: "openai",      name: "OpenAI",      base: 612.80 },
    { id: "anthropic",   name: "Claude",       base: 342.60 },
    { id: "google",      name: "Gemini",       base: 87.10  },
    { id: "perplexity",  name: "Perplexity",   base: 134.20 },
    { id: "mistral",     name: "Mistral",       base: 107.80 },
  ];

  const byProvider = providers.map((p, i) => ({
    id: p.id,
    name: p.name,
    spend: fluctuate(p.base, 0.08, seed, i),
    change: fluctuate(0, 1, seed, i + 10) > 0.5
      ? fluctuate(4.2, 0.5, seed, i + 20)
      : -fluctuate(3.1, 0.5, seed, i + 30),
  }));

  const totalSpend = byProvider.reduce((s, p) => s + p.spend, 0);

  // 6-month trend
  const today = new Date();
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - (5 - i));
    const label = d.toLocaleDateString("en-US", { month: "short" });
    const base = 900 + i * 62;
    return {
      month: label,
      spend: fluctuate(base, 0.10, seed, i + 50),
      budget: 1400,
    };
  });

  const savingsOpportunities = [
    {
      id: "s1",
      title: "Merge duplicate automations",
      description: "Consolidating Customer Support and Support Triage agents eliminates 34% execution overlap.",
      savings: fluctuate(28.40, 0.05, seed, 60),
      effort: "5 minutes",
      priority: "high" as const,
    },
    {
      id: "s2",
      title: "Pause inactive Gemini integration",
      description: "Gemini has been inactive for 9 days but continues to incur a base subscription fee.",
      savings: fluctuate(12.60, 0.05, seed, 61),
      effort: "2 minutes",
      priority: "medium" as const,
    },
    {
      id: "s3",
      title: "Enable prompt caching on Claude",
      description: "Anthropic prompt caching on repeated system prompts could cut token spend by 30–40%.",
      savings: fluctuate(41.00, 0.05, seed, 62),
      effort: "30 minutes",
      priority: "medium" as const,
    },
    {
      id: "s4",
      title: "Consolidate Mistral and Perplexity tiers",
      description: "Both providers offer API-only tiers that eliminate fixed monthly base costs.",
      savings: fluctuate(18.00, 0.05, seed, 63),
      effort: "15 minutes",
      priority: "low" as const,
    },
  ];

  const totalPotentialSavings = savingsOpportunities.reduce((s, o) => s + o.savings, 0);

  res.json({
    totalMonthlySpend: Math.round(totalSpend * 100) / 100,
    budgetLimit: 1400,
    estimatedAnnualSpend: Math.round(totalSpend * 12 * 100) / 100,
    totalPotentialSavings: Math.round(totalPotentialSavings * 100) / 100,
    forecastNextMonth: Math.round(fluctuate(totalSpend, 0.06, seed, 70) * 100) / 100,
    byProvider,
    monthlyTrend,
    savingsOpportunities,
  });
});

export default router;
