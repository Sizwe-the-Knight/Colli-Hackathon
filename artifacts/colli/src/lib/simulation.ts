/**
 * Isolated simulation layer.
 * Generates believable, slowly-fluctuating enterprise data.
 * Designed so real API calls can replace any function here without changing the UI.
 *
 * Values are deterministic within a session (seeded by session start time floored
 * to the nearest 15 minutes) so they feel stable while alive, but vary on refresh.
 */

// Session seed: stable within 15-min window, changes on refresh after that
const SESSION_SEED = Math.floor(Date.now() / (15 * 60 * 1000));

function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed * 9301 + index * 49297 + 233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Add controlled variance to a base value.
 * variancePct: e.g. 0.08 = ±8% variation
 */
export function fluctuate(base: number, variancePct: number, index: number): number {
  const r = seededRandom(SESSION_SEED, index);
  const delta = base * variancePct * (r - 0.5);
  return Math.round((base + delta) * 100) / 100;
}

/**
 * Generate a 7-day usage trend for a given base daily value.
 * Adds realistic day-to-day variation with a gentle upward or downward drift.
 */
export function generateTrend(baseVal: number, days = 7, providerIndex = 0): Array<{ date: string; value: number }> {
  const today = new Date();
  const drift = seededRandom(SESSION_SEED, providerIndex + 200) > 0.5 ? 1.02 : 0.98;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    const dayBase = baseVal * Math.pow(drift, i - Math.floor(days / 2));
    const jitter = seededRandom(SESSION_SEED, providerIndex * 100 + i) - 0.5;
    return {
      date: d.toISOString().split("T")[0],
      value: Math.max(0, Math.round(dayBase + dayBase * 0.25 * jitter)),
    };
  });
}

/**
 * Health score that fluctuates believably around a base.
 */
export function getSimulatedHealthScore(): { score: number; previous: number; change: number } {
  const score = Math.round(fluctuate(92, 0.04, 1));
  const previous = Math.round(fluctuate(88, 0.04, 2));
  return { score, previous, change: score - previous };
}

/**
 * Simulated metric dashboard values.
 */
export function getSimulatedMetrics() {
  return {
    totalMonthlySpend: fluctuate(1284.50, 0.06, 10),
    estimatedSavings: fluctuate(82.00, 0.08, 11),
    activeModels: 4,
    activeWorkflows: 7,
    totalTokensToday: Math.round(fluctuate(187400, 0.12, 12)),
    failedExecutions: seededRandom(SESSION_SEED, 13) > 0.7 ? 3 : 2,
    spendTrend: fluctuate(-2.4, 0.5, 14),
  };
}

/**
 * Model-specific simulated values by provider ID.
 */
const MODEL_BASES: Record<string, { todayUsage: number; monthlySpend: number; avgLatencyMs: number; tokenUsed: number; tokenLimit: number; trendBase: number }> = {
  openai:     { todayUsage: 58400, monthlySpend: 612.80, avgLatencyMs: 820,  tokenUsed: 2_184_300, tokenLimit: 2_600_000, trendBase: 62000 },
  anthropic:  { todayUsage: 21200, monthlySpend: 342.60, avgLatencyMs: 1140, tokenUsed: 980_000,   tokenLimit: 2_000_000, trendBase: 38000 },
  google:     { todayUsage: 0,     monthlySpend: 87.10,  avgLatencyMs: 0,    tokenUsed: 310_000,   tokenLimit: 1_000_000, trendBase: 0     },
  perplexity: { todayUsage: 8700,  monthlySpend: 134.20, avgLatencyMs: 560,  tokenUsed: 450_000,   tokenLimit: 1_500_000, trendBase: 12000 },
  mistral:    { todayUsage: 5100,  monthlySpend: 107.80, avgLatencyMs: 490,  tokenUsed: 620_000,   tokenLimit: 2_000_000, trendBase: 9000  },
  grok:       { todayUsage: 3200,  monthlySpend: 89.40,  avgLatencyMs: 610,  tokenUsed: 280_000,   tokenLimit: 1_000_000, trendBase: 5000  },
  deepseek:   { todayUsage: 1800,  monthlySpend: 42.30,  avgLatencyMs: 720,  tokenUsed: 120_000,   tokenLimit: 500_000,   trendBase: 3000  },
};

export function getSimulatedModelData(providerId: string, index: number) {
  const base = MODEL_BASES[providerId] ?? MODEL_BASES.openai;
  const offset = index * 20;
  const todayUsage = base.todayUsage > 0 ? fluctuate(base.todayUsage, 0.15, offset + 1) : 0;
  const monthlySpend = fluctuate(base.monthlySpend, 0.08, offset + 2);
  const avgLatencyMs = base.avgLatencyMs > 0 ? Math.round(fluctuate(base.avgLatencyMs, 0.12, offset + 3)) : null;
  const tokenUsed = Math.round(fluctuate(base.tokenUsed, 0.05, offset + 4));
  const tokenPct = Math.round((tokenUsed / base.tokenLimit) * 100);

  return {
    todayUsage,
    monthlySpend,
    avgLatencyMs,
    tokenUsage: { used: tokenUsed, limit: base.tokenLimit, percentage: tokenPct },
    trendData: generateTrend(base.trendBase, 7, index),
  };
}

/**
 * Simulated workflow execution numbers.
 */
export function getSimulatedWorkflowData(workflowId: string, baseExecCount: number, index: number) {
  const recentRuns = Math.round(fluctuate(baseExecCount, 0.05, index + 100));
  return { executionCount: recentRuns };
}

/**
 * Today's "focus" recommendation — the single highest-priority action.
 */
export function getTodaysFocus() {
  const options = [
    {
      title: "Merge duplicate customer support workflows",
      subtitle: "Eliminate 34% execution overlap between two agents",
      savingsPerMonth: fluctuate(28.40, 0.05, 300),
      effort: "5 minutes",
      href: "/workflows",
    },
    {
      title: "Enable prompt caching on Claude",
      subtitle: "Reduce repeated system prompt token spend by 30–40%",
      savingsPerMonth: fluctuate(41.00, 0.05, 301),
      effort: "30 minutes",
      href: "/models",
    },
    {
      title: "Pause inactive Gemini integration",
      subtitle: "Gemini has been idle 9 days while incurring base subscription fees",
      savingsPerMonth: fluctuate(12.60, 0.05, 302),
      effort: "2 minutes",
      href: "/costs",
    },
  ];
  const pick = Math.floor(seededRandom(SESSION_SEED, 400) * options.length);
  return options[pick];
}
