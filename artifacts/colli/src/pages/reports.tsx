import React, { useState } from 'react';
import { PremiumCard } from '@/components/premium-ui';
import { FileText, Download, Calendar, TrendingDown, Activity, Workflow } from 'lucide-react';

interface ReportConfig {
  id: string;
  title: string;
  description: string;
  lastGenerated: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  pages: string[];
  highlights: string[];
}

const REPORTS: ReportConfig[] = [
  {
    id: 'weekly-brief',
    title: 'Weekly Executive Brief',
    description: 'A concise weekly summary of your AI ecosystem health, cost trends, and top recommendations.',
    lastGenerated: 'Monday, July 14, 2026',
    icon: FileText,
    iconColor: 'hsl(33 40% 48%)',
    iconBg: 'hsl(33 40% 52% / 0.10)',
    pages: ['Executive Summary', 'Health Score Trend', 'Spend Overview', 'Top Recommendations'],
    highlights: ['AI Health Score: 92/100', 'Weekly spend: $296.80', '3 recommendations actioned'],
  },
  {
    id: 'monthly-health',
    title: 'Monthly AI Health Report',
    description: 'Comprehensive model performance, latency trends, and ecosystem health analysis for the month.',
    lastGenerated: 'Tuesday, July 1, 2026',
    icon: Activity,
    iconColor: 'hsl(213 58% 44%)',
    iconBg: 'hsl(213 58% 44% / 0.08)',
    pages: ['Health Score History', 'Provider Performance', 'Latency Analysis', 'Token Usage', 'Incident Log'],
    highlights: ['Score improved +4 pts', 'Avg latency: 820ms', '2 incidents logged'],
  },
  {
    id: 'cost-optimization',
    title: 'Cost Optimization Report',
    description: 'Detailed financial analysis with savings opportunities ranked by estimated monthly impact.',
    lastGenerated: 'Sunday, July 13, 2026',
    icon: TrendingDown,
    iconColor: 'hsl(148 27% 42%)',
    iconBg: 'hsl(148 27% 48% / 0.10)',
    pages: ['Spend Summary', 'Provider Breakdown', 'Savings Opportunities', 'Budget Forecast', 'Recommendations'],
    highlights: ['$82/mo savings identified', 'Budget: 92% utilised', '4 opportunities prioritised'],
  },
  {
    id: 'workflow-performance',
    title: 'Workflow Performance Report',
    description: 'Execution stats, failure rates, runtime trends, and efficiency analysis across all automations.',
    lastGenerated: 'Monday, July 14, 2026',
    icon: Workflow,
    iconColor: 'hsl(270 40% 55%)',
    iconBg: 'hsl(270 40% 55% / 0.08)',
    pages: ['Execution Summary', 'Success Rate Analysis', 'Runtime Trends', 'Failure Log', 'Optimisation Notes'],
    highlights: ['846 total executions', '99.2% success rate', '2 duplicate workflows detected'],
  },
];

function generatePrintHTML(report: ReportConfig): string {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${report.title} — Colli</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px; color: #3a2b22; background: #f7f4ed; }
        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid #dcceb9; }
        .logo { width: 48px; height: 48px; }
        h1 { font-size: 28px; font-weight: 700; margin: 0; }
        .subtitle { font-size: 13px; color: #8a7b74; margin: 4px 0 0; }
        .generated { font-size: 12px; color: #b09a8e; margin: 2px 0 0; }
        .section { background: white; border-radius: 16px; padding: 28px; margin-bottom: 20px; border: 1px solid #dcceb9; }
        h2 { font-size: 18px; font-weight: 600; margin: 0 0 16px; }
        .highlight-row { display: flex; gap: 20px; margin-bottom: 20px; }
        .highlight { background: #faf7f2; border: 1px solid #e8ddd3; border-radius: 12px; padding: 16px 20px; flex: 1; }
        .hl-value { font-size: 20px; font-weight: 700; color: #3a2b22; }
        .hl-label { font-size: 11px; color: #8a7b74; margin-top: 4px; }
        .pages-list { list-style: none; padding: 0; margin: 0; }
        .pages-list li { padding: 8px 0; border-bottom: 1px solid #f0e8df; font-size: 13px; color: #5f5348; }
        .pages-list li:last-child { border-bottom: none; }
        .footer { text-align: center; font-size: 11px; color: #b09a8e; margin-top: 40px; }
        @media print { body { background: white; padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${report.title}</h1>
          <div class="subtitle">Colli Executive AI Operating System</div>
          <div class="generated">Generated: ${today}</div>
        </div>
      </div>
      <div class="section">
        <h2>Report Highlights</h2>
        <div class="highlight-row">
          ${report.highlights.map((h) => `
            <div class="highlight">
              <div class="hl-value">${h.split(': ')[1] ?? '—'}</div>
              <div class="hl-label">${h.split(': ')[0]}</div>
            </div>
          `).join('')}
        </div>
        <p style="font-size:13px;color:#5f5348;line-height:1.6;">${report.description}</p>
      </div>
      <div class="section">
        <h2>Contents</h2>
        <ul class="pages-list">
          ${report.pages.map((p, i) => `<li>${i + 1}. ${p}</li>`).join('')}
        </ul>
      </div>
      <div class="footer">
        Colli Executive AI Operating System · Confidential · ${today}
      </div>
    </body>
    </html>
  `;
}

export function Reports() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = (report: ReportConfig) => {
    setDownloading(report.id);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(generatePrintHTML(report));
      win.document.close();
      setTimeout(() => {
        win.print();
        setDownloading(null);
      }, 600);
    } else {
      setDownloading(null);
    }
  };

  return (
    <div className="page-enter space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="text-muted-foreground mt-2">
          Downloadable executive reports. Click Export to open a print-ready version.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 stagger">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <PremiumCard key={report.id} className="flex flex-col">
              <div className="p-7 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: report.iconBg }}
                    >
                      <Icon className="w-5 h-5" style={{ color: report.iconColor }} />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground leading-tight">{report.title}</h2>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3 h-3 text-muted-foreground/50" />
                        <span className="text-[11px] text-muted-foreground/60">{report.lastGenerated}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-5">{report.description}</p>

                {/* Highlights */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {report.highlights.map((h) => (
                    <span
                      key={h}
                      className="text-[11px] px-2.5 py-1 rounded-full"
                      style={{ background: 'hsl(36 22% 92%)', color: 'hsl(20 10% 46%)' }}
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {/* Pages list */}
                <div className="flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
                    Contents
                  </p>
                  <ol className="space-y-1">
                    {report.pages.map((page, i) => (
                      <li key={page} className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-muted-foreground/40 w-4">{i + 1}.</span>
                        <span className="text-xs text-muted-foreground/70">{page}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* CTA */}
                <div className="mt-6 pt-5" style={{ borderTop: '1px solid hsl(33 28% 88%)' }}>
                  <button
                    onClick={() => handleDownload(report)}
                    disabled={downloading === report.id}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 press-scale disabled:opacity-60"
                    style={{
                      background: 'hsl(18 26% 18%)',
                      color: '#ffffff',
                      boxShadow: '0 2px 6px rgba(58,43,34,0.18)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'hsl(18 26% 24%)'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'hsl(18 26% 18%)'}
                  >
                    <Download className="w-4 h-4" />
                    {downloading === report.id ? 'Opening…' : 'Export PDF'}
                  </button>
                </div>
              </div>
            </PremiumCard>
          );
        })}
      </div>
    </div>
  );
}
