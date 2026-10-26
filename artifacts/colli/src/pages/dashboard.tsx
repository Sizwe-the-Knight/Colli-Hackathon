import React from 'react';
import {
  useGetMe,
  useGetDashboardSummary,
  useGetRecommendations,
} from '@workspace/api-client-react';
import { PremiumCard, ValueDisplay, SkeletonCard } from '@/components/premium-ui';
import {
  ArrowRight,
  Zap,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Lightbulb,
  FileText,
  Target,
  DollarSign,
  Timer,
} from 'lucide-react';
import './dashboard.css';
import { Link } from 'wouter';
import { getTodaysFocus } from '@/lib/simulation';
import { useSearchQuery } from '@/lib/context';
import type { CurrentUser } from '@/lib/context';

const categoryMeta: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  savings:      { icon: TrendingDown, color: 'hsl(148 27% 42%)',  bg: 'hsl(148 27% 48% / 0.09)', label: 'Savings opportunity' },
  cost:         { icon: TrendingDown, color: 'hsl(148 27% 42%)',  bg: 'hsl(148 27% 48% / 0.09)', label: 'Savings opportunity' },
  performance:  { icon: Zap,          color: 'var(--colli-teal)',  bg: 'hsl(174 30% 33% / 0.08)', label: 'Optimization'        },
  optimization: { icon: Zap,          color: 'var(--colli-teal)',  bg: 'hsl(174 30% 33% / 0.08)', label: 'Optimization'        },
  risk:         { icon: ShieldCheck,  color: 'hsl(38 62% 44%)',   bg: 'hsl(38 62% 49% / 0.10)',  label: 'Risk'                },
  growth:       { icon: TrendingUp,   color: 'var(--colli-teal)',  bg: 'hsl(174 30% 33% / 0.08)', label: 'Growth'             },
  default:      { icon: Lightbulb,    color: 'hsl(33 40% 48%)',   bg: 'hsl(33 40% 52% / 0.10)',  label: 'Recommendation'      },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function getCategoryMeta(category?: string) {
  if (!category) return categoryMeta.default;
  return categoryMeta[category.toLowerCase()] ?? categoryMeta.default;
}

export function Dashboard() {
  const { data: rawUser } = useGetMe();
  const user = rawUser as CurrentUser | undefined;
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: recommendations, isLoading: loadingRecommendations } = useGetRecommendations();
  const searchQuery = useSearchQuery();

  const focus = React.useMemo(() => getTodaysFocus(), []);

  const greeting = React.useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Sort and filter recommendations
  const sortedRecs = React.useMemo(() => {
    if (!recommendations) return [];
    const sorted = [...recommendations].sort((a, b) => {
      const ap = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 3;
      const bp = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 3;
      return ap - bp;
    });
    if (!searchQuery) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(
      (r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );
  }, [recommendations, searchQuery]);

  return (
    <div className="dashboard-polish page-enter space-y-8">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 justify-between items-end">
        <div>
          <h1 className="text-[2rem] font-semibold tracking-tight" style={{ color: 'hsl(18 26% 18%)' }}>
            {greeting}, {user?.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/brief"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-150"
          style={{ color: 'hsl(33 40% 48%)' }}
          onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'hsl(33 40% 36%)'}
          onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'hsl(33 40% 48%)'}
        >
          <FileText className="w-3.5 h-3.5" />
          Today's brief
        </Link>
      </div>

      <p className="dashboard-demo">Demonstration · sample metrics and recommendations. These are not measurements from your private provider accounts.</p>

      {/* ── Today's Focus ──────────────────────────────────── */}
      <div
        className="rounded-[22px] p-7 flex flex-col lg:flex-row items-start justify-between gap-6"
        style={{
          background: '#e3efea',
          borderTop: '2px solid var(--colli-brass)',
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4" style={{ color: '#796735' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#796735' }}>
              Sample focus
            </span>
          </div>
          <h2 className="text-xl font-semibold text-[#254c49] leading-snug mb-2">{focus.title}</h2>
          <p className="text-sm mb-6" style={{ color: '#47645e' }}>{focus.subtitle}</p>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <DollarSign className="w-3.5 h-3.5" style={{ color: '#47645e' }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#47645e' }}>
                  Est. monthly savings
                </span>
              </div>
              <span className="text-2xl font-bold" style={{ color: '#254c49' }}>
                ${focus.savingsPerMonth.toFixed(0)}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Timer className="w-3.5 h-3.5" style={{ color: '#47645e' }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#47645e' }}>
                  Est. effort
                </span>
              </div>
              <span className="text-base font-semibold text-[#254c49]">{focus.effort}</span>
            </div>
          </div>
        </div>
        <Link
          href={focus.href}
          className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 press-scale whitespace-normal max-w-full"
          style={{
            background: '#f7faf6',
            color: '#254c49',
            border: '1px solid #afc8bd',
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#d0e4dc'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = '#f7faf6'}
        >
          Review Recommendation
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ── Metrics row ────────────────────────────────────── */}
      {loadingSummary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 stagger">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} height="h-40" />)}
        </div>
      ) : summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 stagger">
          {/* Health Score */}
          <PremiumCard interactive={false}>
            <div className="p-8">
              <ValueDisplay
                label="Sample health score"
                value={summary.healthScore.score}
                subtitle="Illustrative only — not your assessed score"
              />
            </div>
          </PremiumCard>

          <PremiumCard>
            <div className="p-8">
              <ValueDisplay
                label="Active workflows"
                value={summary.metrics.activeWorkflows}
                subtitle={`${summary.metrics.activeModels} models in this example`}
              />
            </div>
          </PremiumCard>

          <PremiumCard>
            <div className="p-8">
              <ValueDisplay
                label="Failed executions (24h)"
                value={summary.metrics.failedExecutions}
                subtitle="Sample provider activity"
              />
            </div>
          </PremiumCard>

          <PremiumCard>
            <div className="p-8">
              <ValueDisplay
                label="Est. monthly spend"
                value={summary.metrics.totalMonthlySpend}
                isCurrency
                subtitle="Sample estimate, not your bill"
              />
            </div>
          </PremiumCard>
        </div>
      )}

      {/* ── Recommendations ────────────────────────────────── */}
      <div className="space-y-7">
        <div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'hsl(18 26% 18%)' }}>
            Recommendations
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Sample recommendations, shown highest priority first.
          </p>
        </div>

        {loadingRecommendations ? (
          <div className="space-y-4 stagger">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} height="h-32" />)}
          </div>
        ) : sortedRecs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recommendations match "{searchQuery}".</p>
        ) : (
          <div className="space-y-4 stagger">
            {sortedRecs.map((rec, idx) => {
              const meta = getCategoryMeta(rec.category);
              const Icon = meta.icon;
              const priorityColor =
                rec.priority === 'high'   ? { bg: 'hsl(13 37% 52% / 0.10)', text: 'hsl(13 37% 40%)', border: 'hsl(13 37% 52% / 0.25)' } :
                rec.priority === 'medium' ? { bg: 'hsl(38 62% 49% / 0.10)', text: 'hsl(38 62% 36%)', border: 'hsl(38 62% 49% / 0.25)' } :
                                            { bg: 'hsl(148 27% 48% / 0.10)', text: 'hsl(148 27% 36%)', border: 'hsl(148 27% 48% / 0.25)' };
              return (
                <PremiumCard key={rec.id}>
                  <div className="p-5 sm:p-7 flex gap-4">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: meta.bg }}>
                      <Icon className="w-5 h-5" style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          {idx === 0 && rec.priority === 'high' && (
                            <span
                              className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm"
                              style={{ background: priorityColor.bg, color: priorityColor.text, border: `1px solid ${priorityColor.border}` }}
                            >
                              High priority
                            </span>
                          )}
                          {rec.priority && rec.priority !== 'high' && (
                            <span
                              className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm"
                              style={{ background: priorityColor.bg, color: priorityColor.text, border: `1px solid ${priorityColor.border}` }}
                            >
                              {rec.priority}
                            </span>
                          )}
                        </div>
                        {rec.estimatedSavings && (
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-sm whitespace-nowrap shrink-0"
                            style={{ background: 'hsl(148 27% 48% / 0.10)', color: 'hsl(148 27% 36%)', border: '1px solid hsl(148 27% 48% / 0.20)' }}
                          >
                            ${rec.estimatedSavings.toLocaleString()}/mo
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold leading-snug mb-2" style={{ color: 'hsl(18 26% 18%)' }}>
                        {rec.title}
                      </h3>
                      <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">{rec.description}</p>
                      <button
                        className="inline-flex items-center gap-1 text-xs font-semibold transition-colors duration-150 press-scale"
                        style={{ color: 'hsl(33 40% 48%)' }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.color = 'hsl(33 40% 34%)'}
                        onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.color = 'hsl(33 40% 48%)'}
                      >
                        {rec.actionLabel || 'Take action'} <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </PremiumCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
