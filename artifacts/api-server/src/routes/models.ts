import { Router, type IRouter } from "express";

const router: IRouter = Router();

function generateTrend(baseVal: number, days = 7) {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    const jitter = (Math.random() - 0.5) * baseVal * 0.3;
    return {
      date: d.toISOString().split("T")[0],
      value: Math.max(0, Math.round(baseVal + jitter)),
    };
  });
}

const MODELS = [
  {
    id: "openai",
    name: "OpenAI",
    provider: "openai" as const,
    status: "healthy" as const,
    connectionStatus: "connected" as const,
    todayUsage: 58.40,
    monthlySpend: 612.80,
    avgLatencyMs: 820,
    tokenUsage: { used: 2_184_300, limit: 2_600_000, percentage: 84 },
    trendData: generateTrend(62000),
    lastActiveAt: new Date().toISOString(),
    inactiveDays: null,
  },
  {
    id: "anthropic",
    name: "Claude",
    provider: "anthropic" as const,
    status: "warning" as const,
    connectionStatus: "connected" as const,
    todayUsage: 21.20,
    monthlySpend: 342.60,
    avgLatencyMs: 1140,
    tokenUsage: { used: 980_000, limit: 2_000_000, percentage: 49 },
    trendData: generateTrend(38000),
    lastActiveAt: new Date().toISOString(),
    inactiveDays: null,
  },
  {
    id: "google",
    name: "Gemini",
    provider: "google" as const,
    status: "inactive" as const,
    connectionStatus: "connected" as const,
    todayUsage: 0,
    monthlySpend: 87.10,
    avgLatencyMs: null,
    tokenUsage: { used: 310_000, limit: 1_000_000, percentage: 31 },
    trendData: generateTrend(0),
    lastActiveAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    inactiveDays: 9,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    provider: "perplexity" as const,
    status: "healthy" as const,
    connectionStatus: "connected" as const,
    todayUsage: 8.70,
    monthlySpend: 134.20,
    avgLatencyMs: 560,
    tokenUsage: { used: 450_000, limit: 1_500_000, percentage: 30 },
    trendData: generateTrend(12000),
    lastActiveAt: new Date().toISOString(),
    inactiveDays: null,
  },
  {
    id: "mistral",
    name: "Mistral",
    provider: "mistral" as const,
    status: "healthy" as const,
    connectionStatus: "connected" as const,
    todayUsage: 5.10,
    monthlySpend: 107.80,
    avgLatencyMs: 490,
    tokenUsage: { used: 620_000, limit: 2_000_000, percentage: 31 },
    trendData: generateTrend(9000),
    lastActiveAt: new Date().toISOString(),
    inactiveDays: null,
  },
];

router.get("/models", async (_req, res): Promise<void> => {
  res.json(MODELS);
});

router.get("/models/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const model = MODELS.find((m) => m.id === raw);
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  res.json(model);
});

export default router;
