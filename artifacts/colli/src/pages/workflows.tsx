import React from 'react';
import { useGetWorkflows } from '@workspace/api-client-react';
import { PremiumCard, SkeletonCard } from '@/components/premium-ui';
import {
  Workflow, Play, AlertCircle, Clock, CheckCircle2,
  ChevronDown, Zap, Activity, BarChart2, BrainCircuit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useSearchQuery } from '@/lib/context';
import { Progress } from '@/components/ui/progress';

// Simulated execution history per workflow
const EXEC_HISTORY: Record<string, Array<{ at: string; status: 'ok' | 'fail'; durationMs: number }>> = {
  w1: [
    { at: new Date(Date.now() - 12 * 60 * 1000).toISOString(), status: 'ok', durationMs: 3200 },
    { at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), status: 'ok', durationMs: 3400 },
    { at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), status: 'ok', durationMs: 3600 },
  ],
  w2: [
    { at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), status: 'ok', durationMs: 8100 },
    { at: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(), status: 'fail', durationMs: 12400 },
    { at: new Date(Date.now() - 52 * 60 * 60 * 1000).toISOString(), status: 'ok', durationMs: 7900 },
  ],
  w3: [
    { at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), status: 'ok', durationMs: 1750 },
    { at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), status: 'ok', durationMs: 1820 },
    { at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), status: 'ok', durationMs: 1900 },
  ],
  w4: [
    { at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), status: 'ok', durationMs: 12400 },
  ],
  w5: [
    { at: new Date(Date.now() - 22 * 60 * 1000).toISOString(), status: 'ok', durationMs: 2850 },
    { at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), status: 'ok', durationMs: 2900 },
  ],
  w6: [
    { at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), status: 'ok', durationMs: 2100 },
    { at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), status: 'fail', durationMs: 5200 },
    { at: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(), status: 'ok', durationMs: 2050 },
  ],
  w7: [
    { at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), status: 'ok', durationMs: 5600 },
    { at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), status: 'ok', durationMs: 5400 },
  ],
};

interface WorkflowItem {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  executionCount: number;
  failedCount?: number | null;
  avgRuntimeMs: number;
  lastRunAt?: string | null;
  provider?: string | null;
}

function WorkflowRow({ workflow }: { workflow: WorkflowItem }) {
  const [expanded, setExpanded] = React.useState(false);
  const history = EXEC_HISTORY[workflow.id] ?? [];
  const successRate = workflow.executionCount > 0
    ? Math.round(((workflow.executionCount - (workflow.failedCount ?? 0)) / workflow.executionCount) * 100)
    : 100;

  return (
    <PremiumCard>
      {/* Summary row */}
      <button
        className="w-full text-left"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="p-6 flex flex-col md:flex-row md:items-center gap-6">
          {/* Status icon + name */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center border shrink-0',
                workflow.status === 'healthy'
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                  : workflow.status === 'warning'
                  ? 'bg-amber-50 border-amber-100 text-amber-600'
                  : workflow.status === 'inactive'
                  ? 'bg-secondary border-border text-muted-foreground'
                  : 'bg-[#FDF2EE] border-[#EFD0C4] text-[#B84E38]'
              )}
            >
              <Workflow className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-semibold text-foreground truncate">{workflow.name}</h3>
                {workflow.status === 'healthy' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                {workflow.status === 'error'   && <AlertCircle  className="w-3.5 h-3.5 text-[#B84E38] shrink-0" />}
              </div>
              {workflow.description && (
                <p className="text-sm text-muted-foreground truncate">{workflow.description}</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 shrink-0">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">Executions</p>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Play className="w-3 h-3 text-primary" />
                {workflow.executionCount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">Failed</p>
              <p className={cn('text-sm font-semibold', workflow.failedCount && workflow.failedCount > 0 ? 'text-[#B84E38]' : 'text-muted-foreground/60')}>
                {workflow.failedCount?.toLocaleString() || 0}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">Avg runtime</p>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-muted-foreground/50" />
                {(workflow.avgRuntimeMs / 1000).toFixed(1)}s
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">Last run</p>
              <p className="text-sm font-medium text-foreground">
                {workflow.lastRunAt ? formatDistanceToNow(new Date(workflow.lastRunAt), { addSuffix: true }) : 'Never'}
              </p>
            </div>
          </div>

          {/* Expand chevron */}
          <ChevronDown
            className={cn(
              'w-4 h-4 shrink-0 transition-transform duration-200 text-muted-foreground/40',
              expanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-6 pb-6 space-y-6"
          style={{ borderTop: '1px solid hsl(33 28% 89%)' }}
        >
          <div className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Health indicator */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Health</p>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Success rate</span>
                  <span className="font-semibold text-foreground">{successRate}%</span>
                </div>
                <Progress value={successRate} className="h-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.70)', border: '1px solid hsl(33 28% 88%)' }}>
                  <p className="text-lg font-bold text-foreground">{workflow.executionCount}</p>
                  <p className="text-[10px] text-muted-foreground">Total runs</p>
                </div>
                <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.70)', border: '1px solid hsl(33 28% 88%)' }}>
                  <p className="text-lg font-bold" style={{ color: (workflow.failedCount ?? 0) > 0 ? 'hsl(13 37% 44%)' : 'hsl(148 27% 42%)' }}>
                    {workflow.failedCount ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Failures</p>
                </div>
              </div>
            </div>

            {/* Connected models */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Connected model</p>
              {workflow.provider ? (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.70)', border: '1px solid hsl(33 28% 88%)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'hsl(40 22% 91%)' }}>
                    <BrainCircuit className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">{workflow.provider}</p>
                    <p className="text-xs text-muted-foreground">Primary provider</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No provider assigned</p>
              )}
              <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.70)', border: '1px solid hsl(33 28% 88%)' }}>
                <Activity className="w-3.5 h-3.5" style={{ color: 'hsl(148 27% 42%)' }} />
                <span className="text-xs text-foreground/70">Avg runtime: {(workflow.avgRuntimeMs / 1000).toFixed(1)}s</span>
              </div>
            </div>

            {/* Recent executions */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Recent executions</p>
              <div className="space-y-2">
                {history.length > 0 ? history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-1.5 px-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.60)' }}>
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', h.status === 'ok' ? 'bg-emerald-500' : 'bg-[#B84E38]')} />
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(h.at), { addSuffix: true })}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-foreground/70">{(h.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                )) : (
                  <p className="text-xs text-muted-foreground">No history available</p>
                )}
              </div>
            </div>
          </div>

          {/* Purpose */}
          {workflow.description && (
            <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.60)', border: '1px solid hsl(33 28% 88%)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Purpose</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{workflow.description}</p>
            </div>
          )}
        </div>
      )}
    </PremiumCard>
  );
}

export function Workflows() {
  const { data: workflows, isLoading } = useGetWorkflows();
  const searchQuery = useSearchQuery();

  const filteredWorkflows = React.useMemo(() => {
    if (!workflows) return [];
    if (!searchQuery) return workflows;
    const q = searchQuery.toLowerCase();
    return workflows.filter(
      (w) => w.name.toLowerCase().includes(q) || (w.description ?? '').toLowerCase().includes(q)
    );
  }, [workflows, searchQuery]);

  return (
    <div className="page-enter space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Workflows</h1>
        <p className="text-muted-foreground mt-2">
          Executive overview of automated agents. Click any row to expand details.
        </p>
      </div>

      <div className="space-y-4 stagger">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} height="h-24" />)
          : filteredWorkflows.length === 0
          ? <p className="text-sm text-muted-foreground">No workflows match "{searchQuery}".</p>
          : filteredWorkflows.map((workflow) => (
              <WorkflowRow key={workflow.id} workflow={workflow} />
            ))
        }
      </div>
    </div>
  );
}
