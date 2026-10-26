import React from 'react';
import { useGetRecentChanges } from '@workspace/api-client-react';
import {
  Activity as ActivityIcon,
  TrendingDown,
  AlertTriangle,
  Zap,
  BrainCircuit,
  Workflow,
  Info,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useSearchQuery } from '@/lib/context';

type EventKind = 'model' | 'workflow' | 'warning' | 'savings' | 'api' | 'system' | 'info';
type FilterKind = 'all' | EventKind;

interface EventMeta {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
}

const kindMeta: Record<EventKind, EventMeta> = {
  model:    { icon: BrainCircuit, iconColor: 'hsl(213 58% 44%)',  iconBg: 'hsl(213 58% 44% / 0.08)', label: 'Model event'    },
  workflow: { icon: Workflow,     iconColor: 'hsl(213 58% 44%)',  iconBg: 'hsl(213 58% 44% / 0.08)', label: 'Workflow event' },
  warning:  { icon: AlertTriangle,iconColor: 'hsl(38 62% 44%)',   iconBg: 'hsl(38 62% 49% / 0.10)',  label: 'Warning'        },
  savings:  { icon: TrendingDown, iconColor: 'hsl(148 27% 42%)',  iconBg: 'hsl(148 27% 48% / 0.10)', label: 'Savings'        },
  api:      { icon: Zap,          iconColor: 'hsl(213 58% 44%)',  iconBg: 'hsl(213 58% 44% / 0.08)', label: 'API change'     },
  system:   { icon: Bell,         iconColor: 'hsl(33 40% 48%)',   iconBg: 'hsl(33 40% 52% / 0.10)',  label: 'System'         },
  info:     { icon: Info,         iconColor: 'hsl(20 10% 48%)',   iconBg: 'hsl(36 22% 93%)',          label: 'Note'           },
};

const FILTERS: { label: string; value: FilterKind }[] = [
  { label: 'All',       value: 'all'      },
  { label: 'Models',    value: 'model'    },
  { label: 'Workflows', value: 'workflow' },
  { label: 'Warnings',  value: 'warning'  },
  { label: 'Savings',   value: 'savings'  },
  { label: 'API',       value: 'api'      },
  { label: 'System',    value: 'system'   },
];

function detectKind(provider?: string, text?: string): EventKind {
  const t = (text ?? '').toLowerCase();
  if (t.includes('workflow'))      return 'workflow';
  if (t.includes('saving') || t.includes('cost') || t.includes('cheaper') || t.includes('subscription')) return 'savings';
  if (t.includes('warning') || t.includes('latency') || t.includes('slow') || t.includes('inactive')) return 'warning';
  if (t.includes('api') || t.includes('rate limit') || t.includes('update') || t.includes('pricing')) return 'api';
  if (t.includes('system') || t.includes('maintenance')) return 'system';
  if (provider) return 'model';
  return 'info';
}

interface ActivityEvent {
  id: string;
  kind: EventKind;
  text: string;
  detail?: string;
  provider?: string;
  timestamp: string;
}

const STATIC_EVENTS: ActivityEvent[] = [
  {
    id: 'static-1',
    kind: 'savings',
    text: 'Estimated $340/mo savings identified across 3 models',
    detail: 'Switching Claude 3 Opus → Claude 3.5 Sonnet for summarisation tasks could reduce cost by 72%.',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'static-2',
    kind: 'api',
    text: 'OpenAI API rate limit updated — Tier 2 now active',
    detail: 'RPM limits increased to 5,000. Context window extended to 128k tokens.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'static-3',
    kind: 'warning',
    text: 'Elevated latency detected on Anthropic Claude 3 Opus',
    detail: 'P99 latency rose to 4,200ms, up from 1,800ms baseline. Monitoring continues.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3.5).toISOString(),
  },
  {
    id: 'static-4',
    kind: 'system',
    text: 'Scheduled maintenance window completed',
    detail: 'All provider connections verified healthy after maintenance window.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
];

export function ActivityPage() {
  const { data: changes, isLoading } = useGetRecentChanges();
  const [activeFilter, setActiveFilter] = React.useState<FilterKind>('all');
  const searchQuery = useSearchQuery();

  const allEvents = React.useMemo(() => {
    const apiEvents = (changes ?? []).map((c) => ({
      id: c.id,
      kind: detectKind(c.provider ?? undefined, c.text) as EventKind,
      text: c.text,
      detail: c.detail ?? undefined,
      provider: c.provider ?? undefined,
      timestamp: c.timestamp,
    }));
    return [...apiEvents, ...STATIC_EVENTS].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [changes]);

  const filteredEvents = React.useMemo(() => {
    let events = allEvents;
    // Kind filter
    if (activeFilter !== 'all') {
      events = events.filter((e) => e.kind === activeFilter);
    }
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      events = events.filter(
        (e) =>
          e.text.toLowerCase().includes(q) ||
          (e.detail ?? '').toLowerCase().includes(q) ||
          (e.provider ?? '').toLowerCase().includes(q)
      );
    }
    return events;
  }, [allEvents, activeFilter, searchQuery]);

  return (
    <div className="page-enter space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'hsl(18 26% 18%)' }}>
          Activity
        </h1>
        <p className="text-muted-foreground mt-2">
          Chronological history of model events, workflow changes, warnings, and system notifications.
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(({ label, value }) => {
          const isActive = activeFilter === value;
          return (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 press-scale"
              style={
                isActive
                  ? { background: 'hsl(18 26% 18%)', color: '#ffffff' }
                  : {
                      background: 'rgba(255,255,255,0.80)',
                      border: '1px solid hsl(33 28% 82%)',
                      color: 'hsl(20 10% 46%)',
                    }
              }
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.96)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.80)';
              }}
            >
              {label}
              {value !== 'all' && (
                <span className={cn('ml-1.5 text-[10px]', isActive ? 'opacity-70' : 'text-muted-foreground/50')}>
                  {allEvents.filter((e) => e.kind === value).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-6 stagger">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-5">
              <div className="w-10 h-10 rounded-2xl shrink-0 skeleton-shimmer" style={{ background: 'hsl(36 22% 90%)' }} />
              <div className="flex-1 pt-1 space-y-2">
                <div className="h-4 w-1/2 rounded-lg skeleton-shimmer" style={{ background: 'hsl(36 22% 90%)' }} />
                <div className="h-3 w-3/4 rounded-lg skeleton-shimmer" style={{ background: 'hsl(36 22% 93%)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground/50">
          <ActivityIcon className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No events match this filter.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute top-4 bottom-0 left-[19px] w-px" style={{ background: 'hsl(33 28% 86%)' }} />
          <div className="space-y-1 stagger">
            {filteredEvents.map((event) => {
              const meta = kindMeta[event.kind] ?? kindMeta.info;
              const Icon = meta.icon;
              return (
                <div key={event.id} className="relative flex gap-5 group">
                  <div
                    className="relative z-10 w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:-translate-y-0.5"
                    style={{ background: meta.iconBg, border: '1.5px solid rgba(0,0,0,0.07)' }}
                  >
                    <Icon className="w-4 h-4" style={{ color: meta.iconColor }} />
                  </div>
                  <div
                    className="flex-1 rounded-2xl p-5 mb-4 transition-all duration-150"
                    style={{
                      background: 'rgba(255,255,255,0.78)',
                      border: '1px solid hsl(33 28% 86%)',
                      boxShadow: '0 1px 3px rgba(58,43,34,0.04)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.96)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(58,43,34,0.07)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.78)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(58,43,34,0.04)';
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: meta.iconColor }}>
                            {meta.label}
                          </span>
                          {event.provider && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ background: 'hsl(36 22% 92%)', color: 'hsl(20 10% 50%)' }}
                            >
                              {event.provider}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium leading-snug" style={{ color: 'hsl(18 26% 18%)' }}>
                          {event.text}
                        </p>
                        {event.detail && (
                          <p className="text-xs mt-2 leading-relaxed" style={{ color: 'hsl(20 10% 50%)' }}>
                            {event.detail}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] whitespace-nowrap shrink-0 mt-0.5" style={{ color: 'hsl(20 10% 60%)' }}>
                        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
