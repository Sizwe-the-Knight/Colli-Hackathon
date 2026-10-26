import React, { useEffect, useState } from 'react';
import { PremiumCard, SkeletonCard } from '@/components/premium-ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingDown, DollarSign, AlertTriangle, ArrowRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CostSummary {
  totalMonthlySpend: number;
  budgetLimit: number;
  estimatedAnnualSpend: number;
  totalPotentialSavings: number;
  forecastNextMonth: number;
  byProvider: Array<{ id: string; name: string; spend: number; change: number }>;
  monthlyTrend: Array<{ month: string; spend: number; budget: number }>;
  savingsOpportunities: Array<{
    id: string;
    title: string;
    description: string;
    savings: number;
    effort: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

const PROVIDER_COLORS: Record<string, string> = {
  openai:     'hsl(213 68% 44%)',
  anthropic:  'hsl(33 40% 52%)',
  google:     'hsl(38 62% 44%)',
  perplexity: 'hsl(148 27% 42%)',
  mistral:    'hsl(270 40% 55%)',
  grok:       'hsl(13 37% 52%)',
  deepseek:   'hsl(196 50% 44%)',
};

const PRIORITY_COLORS = {
  high:   { bg: 'hsl(13 37% 52% / 0.10)',  text: 'hsl(13 37% 40%)',  border: 'hsl(13 37% 52% / 0.25)' },
  medium: { bg: 'hsl(38 62% 49% / 0.10)',  text: 'hsl(38 62% 36%)',  border: 'hsl(38 62% 49% / 0.25)' },
  low:    { bg: 'hsl(148 27% 48% / 0.10)', text: 'hsl(148 27% 36%)', border: 'hsl(148 27% 48% / 0.25)' },
};

export function Costs() {
  const [data, setData] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/costs/summary', { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="page-enter space-y-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Cost Center</h1>
          <p className="text-muted-foreground mt-2">Executive financial analytics across your AI providers.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 stagger">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} height="h-36" />)}
        </div>
        <SkeletonCard height="h-72" />
      </div>
    );
  }

  const budgetPct = Math.round((data.totalMonthlySpend / data.budgetLimit) * 100);

  return (
    <div className="page-enter space-y-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Cost Center</h1>
        <p className="text-muted-foreground mt-2">
          Executive financial analytics across your AI providers.
        </p>
      </div>

      {/* ── KPI row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 stagger">
        {/* Monthly spend */}
        <PremiumCard glow>
          <div className="p-7">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'hsl(33 40% 52% / 0.10)' }}>
              <DollarSign className="w-5 h-5" style={{ color: 'hsl(33 40% 48%)' }} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Monthly AI Spend
            </p>
            <p className="text-2xl font-bold text-foreground">
              ${data.totalMonthlySpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Budget</span><span>{budgetPct}% used</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(33 28% 88%)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${budgetPct}%`,
                    background: budgetPct > 85 ? 'hsl(13 37% 52%)' : budgetPct > 70 ? 'hsl(38 62% 49%)' : 'hsl(33 40% 52%)',
                  }}
                />
              </div>
            </div>
          </div>
        </PremiumCard>

        {/* Forecast */}
        <PremiumCard>
          <div className="p-7">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'hsl(213 58% 44% / 0.08)' }}>
              <TrendingUp className="w-5 h-5" style={{ color: 'hsl(213 58% 44%)' }} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Forecast — Next Month
            </p>
            <p className="text-2xl font-bold text-foreground">
              ${data.forecastNextMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Est. based on current trajectory
            </p>
          </div>
        </PremiumCard>

        {/* Annual */}
        <PremiumCard>
          <div className="p-7">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'hsl(148 27% 48% / 0.08)' }}>
              <DollarSign className="w-5 h-5" style={{ color: 'hsl(148 27% 42%)' }} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Est. Annual Spend
            </p>
            <p className="text-2xl font-bold text-foreground">
              ${(data.estimatedAnnualSpend / 1000).toFixed(1)}k
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Across {data.byProvider.length} providers
            </p>
          </div>
        </PremiumCard>

        {/* Savings opportunity */}
        <PremiumCard>
          <div className="p-7">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'hsl(148 27% 48% / 0.08)' }}>
              <TrendingDown className="w-5 h-5" style={{ color: 'hsl(148 27% 42%)' }} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Savings Identified
            </p>
            <p className="text-2xl font-bold" style={{ color: 'hsl(148 27% 36%)' }}>
              ${data.totalPotentialSavings.toFixed(0)}<span className="text-base font-medium text-muted-foreground">/mo</span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {data.savingsOpportunities.length} opportunities available
            </p>
          </div>
        </PremiumCard>
      </div>

      {/* ── Charts row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly trend bar chart */}
        <PremiumCard className="lg:col-span-2">
          <div className="p-7">
            <h2 className="text-base font-semibold text-foreground mb-1">Monthly Spend</h2>
            <p className="text-xs text-muted-foreground mb-6">6-month trend vs budget</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyTrend} barCategoryGap="28%">
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'hsl(20 10% 55%)' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(20 10% 55%)' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                    width={44}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(33 28% 92% / 0.6)', radius: 6 }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="bg-white border border-border px-3 py-2 rounded-xl shadow-lg text-xs">
                          <p className="font-semibold text-foreground mb-1">{label}</p>
                          <p style={{ color: 'hsl(33 40% 48%)' }}>Spend: ${payload[0].value?.toLocaleString()}</p>
                          <p className="text-muted-foreground">Budget: $1,400</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="spend" radius={[6, 6, 0, 0]} fill="hsl(33 40% 52%)" />
                  <Bar dataKey="budget" radius={[6, 6, 0, 0]} fill="hsl(33 28% 88%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-5 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(33 40% 52%)' }} />
                <span className="text-xs text-muted-foreground">Actual spend</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(33 28% 88%)' }} />
                <span className="text-xs text-muted-foreground">Budget</span>
              </div>
            </div>
          </div>
        </PremiumCard>

        {/* Spend by provider donut */}
        <PremiumCard>
          <div className="p-7">
            <h2 className="text-base font-semibold text-foreground mb-1">Spend by Provider</h2>
            <p className="text-xs text-muted-foreground mb-4">This month</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byProvider}
                    dataKey="spend"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                  >
                    {data.byProvider.map((entry) => (
                      <Cell key={entry.id} fill={PROVIDER_COLORS[entry.id] ?? 'hsl(33 40% 52%)'} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="bg-white border border-border px-3 py-2 rounded-xl shadow-lg text-xs">
                          <p className="font-semibold text-foreground">{payload[0].name}</p>
                          <p className="text-muted-foreground">${payload[0].value?.toLocaleString()}/mo</p>
                        </div>
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {data.byProvider.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: PROVIDER_COLORS[p.id] ?? 'hsl(33 40% 52%)' }} />
                    <span className="text-xs text-foreground/70">{p.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    ${p.spend.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </PremiumCard>
      </div>

      {/* ── Savings opportunities ──────────────────────────────── */}
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Cost Optimization Suggestions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ranked by potential monthly impact.
          </p>
        </div>
        <div className="space-y-4 stagger">
          {data.savingsOpportunities.map((opp) => {
            const pColor = PRIORITY_COLORS[opp.priority];
            return (
              <PremiumCard key={opp.id}>
                <div className="p-6 flex items-start gap-5">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'hsl(148 27% 48% / 0.08)' }}>
                    <TrendingDown className="w-5 h-5" style={{ color: 'hsl(148 27% 42%)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="text-sm font-semibold text-foreground">{opp.title}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: pColor.bg, color: pColor.text, border: `1px solid ${pColor.border}` }}
                        >
                          {opp.priority}
                        </span>
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: 'hsl(148 27% 48% / 0.10)', color: 'hsl(148 27% 36%)', border: '1px solid hsl(148 27% 48% / 0.20)' }}
                        >
                          ${opp.savings.toFixed(0)}/mo
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">{opp.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/60">
                        Est. effort: {opp.effort}
                      </span>
                      <button
                        className="inline-flex items-center gap-1 text-xs font-semibold press-scale transition-colors duration-150"
                        style={{ color: 'hsl(33 40% 48%)' }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = 'hsl(33 40% 34%)'}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = 'hsl(33 40% 48%)'}
                      >
                        Review <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </PremiumCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
