import React from 'react';
import { useGetModels, type AIModel } from '@workspace/api-client-react';
import { PremiumCard, ValueDisplay, SkeletonCard } from '@/components/premium-ui';
import { LineChart, Line, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { SiAnthropic, SiGoogle, SiPerplexity, SiMistralai } from 'react-icons/si';
import { RiOpenaiFill } from 'react-icons/ri';
import { BrainCircuit, Plus, X, Zap, Clock, Activity, TrendingDown, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useActiveProviders, useSearchQuery } from '@/lib/context';
import { getSimulatedModelData } from '@/lib/simulation';
import { formatDistanceToNow } from 'date-fns';

const ProviderIcon = ({ provider, className }: { provider: string; className?: string }) => {
  switch (provider.toLowerCase()) {
    case 'openai':     return <RiOpenaiFill className={className} />;
    case 'anthropic':  return <SiAnthropic  className={className} />;
    case 'google':     return <SiGoogle     className={className} />;
    case 'perplexity': return <SiPerplexity className={className} />;
    case 'mistral':    return <SiMistralai  className={className} />;
    default:           return <BrainCircuit className={className} />;
  }
};

const AVAILABLE_INTEGRATIONS = [
  { name: 'Cohere',   provider: 'cohere',  desc: 'Enterprise language models' },
  { name: 'Together', provider: 'together', desc: 'Open-source model hosting' },
  { name: 'Groq',     provider: 'groq',    desc: 'Ultra-fast inference' },
];

// ── Detail Panel ──────────────────────────────────────────────────────────────
interface ModelDetailPanelProps {
  model: AIModel;
  simData: ReturnType<typeof getSimulatedModelData>;
  onClose: () => void;
}

function ModelDetailPanel({ model, simData, onClose }: ModelDetailPanelProps) {
  const StatusIcon = model.status === 'healthy' ? CheckCircle2 : model.status === 'warning' ? AlertCircle : Circle;
  const statusColor =
    model.status === 'healthy' ? 'hsl(148 27% 42%)' :
    model.status === 'warning' ? 'hsl(38 62% 44%)' : 'hsl(20 10% 55%)';

  // Simulated top workflows for this provider
  const topWorkflows = React.useMemo(() => {
    const wfByProvider: Record<string, string[]> = {
      openai:     ['Sales Report Agent', 'Lead Scoring Pipeline'],
      anthropic:  ['Customer Support Agent', 'Weekly Digest'],
      google:     ['Content Summarizer'],
      perplexity: ['Competitive Intel Monitor', 'Content Summarizer'],
      mistral:    ['Support Triage Agent'],
    };
    return (wfByProvider[model.id] ?? ['No workflows connected']).slice(0, 3);
  }, [model.id]);

  // Simulated recent activity
  const recentActivity = [
    { text: `Token usage at ${simData.tokenUsage.percentage}% of monthly limit`, time: '12 min ago' },
    { text: `Avg latency ${simData.avgLatencyMs ?? 'N/A'}${simData.avgLatencyMs ? 'ms' : ''}`, time: '1 hr ago' },
    { text: 'Connection health check passed', time: '3 hrs ago' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(58,43,34,0.35)', backdropFilter: 'blur(4px)' }} />

      {/* Panel */}
      <div
        className="relative w-full md:max-w-[560px] max-h-[90vh] overflow-y-auto rounded-t-[28px] md:rounded-[28px] page-enter"
        style={{
          background: 'hsl(40 35% 96%)',
          border: '1px solid hsl(33 28% 85%)',
          boxShadow: '0 24px 80px rgba(58,43,34,0.22)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-7 pb-5" style={{ borderBottom: '1px solid hsl(33 28% 89%)' }}>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'white', border: '1px solid hsl(33 28% 86%)' }}
            >
              <ProviderIcon provider={model.provider} className="w-7 h-7 text-foreground/60" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{model.name}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <StatusIcon className="w-3.5 h-3.5" style={{ color: statusColor }} />
                <span className="text-sm capitalize" style={{ color: statusColor }}>{model.status}</span>
                <span className="text-muted-foreground/40 text-xs mx-1">·</span>
                <span className="text-xs text-muted-foreground capitalize">{model.connectionStatus}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors duration-150 shrink-0"
            style={{ color: 'hsl(20 10% 55%)', background: 'hsl(36 22% 92%)' }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'hsl(36 22% 86%)'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'hsl(36 22% 92%)'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-7 space-y-8">
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Monthly spend',   value: `$${simData.monthlySpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: TrendingDown, color: 'hsl(148 27% 42%)' },
              { label: 'Today\'s usage',  value: simData.todayUsage > 0 ? `${(simData.todayUsage / 1000).toFixed(1)}k tokens` : 'Inactive', icon: Activity, color: 'hsl(213 58% 44%)' },
              { label: 'Avg latency',     value: simData.avgLatencyMs ? `${simData.avgLatencyMs}ms` : 'N/A', icon: Clock, color: 'hsl(38 62% 44%)' },
              { label: 'Current model',   value: model.id === 'openai' ? 'GPT-4o' : model.id === 'anthropic' ? 'claude-3-5-sonnet' : model.name.toLowerCase(), icon: Zap, color: 'hsl(33 40% 48%)' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="p-4 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.80)', border: '1px solid hsl(33 28% 88%)' }}
              >
                <div className="w-7 h-7 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: `${color}18` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                <p className="text-sm font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {/* Token usage */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-semibold text-foreground">Token usage</p>
              <span className="text-xs text-muted-foreground">
                {simData.tokenUsage.used.toLocaleString()} / {simData.tokenUsage.limit.toLocaleString()}
              </span>
            </div>
            <Progress
              value={simData.tokenUsage.percentage}
              className="h-2"
              style={{ background: 'hsl(33 28% 88%)' }}
            />
            <p className="text-xs text-muted-foreground mt-2">{simData.tokenUsage.percentage}% of monthly allocation used</p>
          </div>

          {/* 7-day trend */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-4">7-day usage trend</p>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={simData.trendData} barCategoryGap="30%">
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'hsl(20 10% 55%)' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { weekday: 'narrow' })}
                  />
                  <YAxis hide />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="bg-white border border-border px-2.5 py-1.5 rounded-xl shadow text-xs">
                          <p className="font-semibold text-foreground">{payload[0].value?.toLocaleString()} tokens</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="hsl(33 40% 52%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top workflows */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Top workflows</p>
            <div className="space-y-2">
              {topWorkflows.map((wf) => (
                <div key={wf} className="flex items-center gap-3 py-2 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.70)' }}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'hsl(33 40% 52% / 0.10)' }}>
                    <Zap className="w-3 h-3" style={{ color: 'hsl(33 40% 48%)' }} />
                  </div>
                  <span className="text-sm text-foreground/80">{wf}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Recent activity</p>
            <div className="space-y-3">
              {recentActivity.map((a) => (
                <div key={a.text} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'hsl(33 40% 52%)' }} />
                    <span className="text-xs text-muted-foreground">{a.text}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap">{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Models page ──────────────────────────────────────────────────────────
export function Models() {
  const { data: models, isLoading } = useGetModels();
  const activeProviders = useActiveProviders();
  const searchQuery = useSearchQuery();
  const [selectedModel, setSelectedModel] = React.useState<AIModel | null>(null);

  const filteredModels = React.useMemo(() => {
    if (!models) return [];
    let filtered = models.filter((m) => activeProviders.includes(m.provider));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((m) => m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q));
    }
    return filtered;
  }, [models, activeProviders, searchQuery]);

  return (
    <div className="page-enter space-y-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Models</h1>
        <p className="text-muted-foreground mt-2">
          Active connections, usage, and cost across providers. Click a card for full details.
        </p>
      </div>

      {/* Connected models */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 stagger">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} height="h-72" />)
          : filteredModels.map((model, idx) => {
              const simData = getSimulatedModelData(model.id, idx);
              return (
                <PremiumCard
                  key={model.id}
                  className="flex flex-col cursor-pointer group"
                  onClick={() => setSelectedModel(model)}
                >
                  <div className="p-6 flex-1 flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-150"
                          style={{ background: 'hsl(40 22% 91%)', border: '1px solid hsl(38 20% 84%)' }}
                        >
                          <ProviderIcon provider={model.provider} className="w-5 h-5 text-foreground/60" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground leading-none">{model.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1.5 capitalize">{model.provider}</p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold',
                          model.status === 'healthy'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : model.status === 'warning'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-[#FDF2EE] text-[#B84E38] border border-[#EFD0C4]'
                        )}
                      >
                        <div className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          model.status === 'healthy' ? 'bg-emerald-500' :
                          model.status === 'warning' ? 'bg-amber-500' : 'bg-[#B84E38]'
                        )} />
                        <span className="capitalize">{model.status}</span>
                      </div>
                    </div>

                    {/* Stats — from simulation */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {[
                        { label: "Today's usage", value: simData.todayUsage > 0 ? (simData.todayUsage / 1000).toFixed(1) + 'k' : '0' },
                        { label: 'Monthly spend',  value: '$' + simData.monthlySpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                        { label: 'Avg latency',    value: simData.avgLatencyMs ? simData.avgLatencyMs + ' ms' : 'N/A' },
                        { label: 'Connection',     value: model.connectionStatus, muted: true },
                      ].map(({ label, value, muted }) => (
                        <div key={label}>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                          <p className={cn('text-base font-semibold', muted ? 'text-muted-foreground capitalize text-sm' : 'text-foreground')}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Token bar */}
                    <div className="mb-6 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground/70">Token limit</span>
                        <span className="font-medium text-foreground">{simData.tokenUsage.percentage}%</span>
                      </div>
                      <Progress
                        value={simData.tokenUsage.percentage}
                        className="h-1"
                        style={simData.tokenUsage.percentage > 80 ? { '--tw-bg-opacity': '1' } as React.CSSProperties : {}}
                      />
                    </div>

                    {/* Sparkline */}
                    <div className="mt-auto pt-4" style={{ borderTop: '1px solid hsl(38 20% 88%)' }}>
                      <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-3">
                        7-day usage
                      </p>
                      <div className="h-10 w-full">
                        {simData.trendData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={simData.trendData}>
                              <Line type="monotone" dataKey="value" stroke="hsl(33 40% 52%)" strokeWidth={1.5} dot={false} isAnimationActive />
                              <Tooltip
                                content={({ active, payload }) =>
                                  active && payload?.length ? (
                                    <div className="bg-white border border-border px-2 py-1 rounded-lg shadow-md text-xs font-medium text-foreground">
                                      {payload[0].value?.toLocaleString()}
                                    </div>
                                  ) : null
                                }
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center text-xs text-muted-foreground/50">No trend data</div>
                        )}
                      </div>
                    </div>

                    {/* Hover hint */}
                    <p className="text-[10px] text-muted-foreground/40 text-center mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      Click for full details
                    </p>
                  </div>
                </PremiumCard>
              );
            })}
      </div>

      {/* Available Integrations */}
      {!isLoading && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground/70">Available integrations</h2>
            <p className="text-xs text-muted-foreground mt-1">Connect additional providers to expand your ecosystem visibility.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {AVAILABLE_INTEGRATIONS.map((integration) => (
              <div
                key={integration.provider}
                className="flex items-center gap-4 p-4 rounded-2xl border border-dashed transition-all duration-150 cursor-pointer group"
                style={{ borderColor: 'hsl(38 20% 82%)', background: 'rgba(255,255,255,0.45)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.75)'; (e.currentTarget as HTMLElement).style.borderColor = 'hsl(33 40% 52% / 0.3)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.45)'; (e.currentTarget as HTMLElement).style.borderColor = 'hsl(38 20% 82%)'; }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'hsl(40 22% 91%)' }}>
                  <BrainCircuit className="w-4 h-4 text-muted-foreground/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground/80">{integration.name}</p>
                  <p className="text-xs text-muted-foreground/60 truncate">{integration.desc}</p>
                </div>
                <Plus className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors duration-150 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedModel && (
        <ModelDetailPanel
          model={selectedModel}
          simData={getSimulatedModelData(selectedModel.id, 0)}
          onClose={() => setSelectedModel(null)}
        />
      )}
    </div>
  );
}
