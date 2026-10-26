import { saveProviderSelection, providerSaveError, getGetMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { PremiumCard } from '@/components/premium-ui';
import { useGetMe } from '@workspace/api-client-react';
import { useAppContext, type CurrentUser } from '@/lib/context';
import { Check, Sun, Moon, Globe, Bell, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

const ALL_PROVIDERS = [
  { id: 'openai',     name: 'OpenAI',      description: 'GPT-4o, o1, DALL·E' },
  { id: 'anthropic',  name: 'Claude',       description: 'Claude 3.5 Sonnet, Opus' },
  { id: 'google',     name: 'Gemini',       description: 'Gemini 1.5 Pro, Flash' },
  { id: 'perplexity', name: 'Perplexity',   description: 'Sonar, online search' },
  { id: 'mistral',    name: 'Mistral',      description: 'Mistral Large, Codestral' },
  { id: 'grok',       name: 'Grok',         description: 'Grok 2, real-time data' },
  { id: 'deepseek',   name: 'DeepSeek',     description: 'DeepSeek V3, Coder' },
];

const FUTURE_INTEGRATIONS = [
  { name: 'Salesforce', desc: 'CRM data sync' },
  { name: 'Slack',      desc: 'Alert forwarding' },
  { name: 'Jira',       desc: 'Workflow tickets' },
  { name: 'Datadog',    desc: 'Observability' },
];

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
    </div>
  );
}

export function Settings() {
  const { data: rawUser } = useGetMe();
  const user = rawUser as CurrentUser | undefined;
  const { theme, setTheme, setUser } = useAppContext();

  const [providers, setProviders] = useState<string[]>(user?.providers ?? ALL_PROVIDERS.map((p) => p.id));
  const [savingProviders, setSavingProviders] = useState(false);
  const [providersSaved, setProvidersSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const [notifications, setNotifications] = useState({
    weeklyBrief: true,
    costAlerts: true,
    workflowFailures: true,
    recommendations: true,
    apiChanges: false,
  });

  const [language, setLanguage] = useState('en');

  const toggleProvider = (id: string) => {
    setProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
    setProvidersSaved(false);
  };

  const saveProviders = async () => {
    if (savingProviders) return;
    setSavingProviders(true);
    setProvidersSaved(false);
    setSaveError(null);
    try {
      const updated = await saveProviderSelection(providers);
      await queryClient.cancelQueries({ queryKey: getGetMeQueryKey() });
      queryClient.setQueryData(getGetMeQueryKey(), updated);
      setUser(updated);
      setProvidersSaved(true);
    } catch (error) {
      setSaveError(providerSaveError(error));
    } finally {
      setSavingProviders(false);
    }
  };

  const Row = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-4" style={{ borderBottom: '1px solid hsl(33 28% 89%)' }}>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0 ml-6">{children}</div>
    </div>
  );

  return (
    <div className="page-enter space-y-10 max-w-2xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account, appearance, and preferences.</p>
      </div>

      {/* ── Account ──────────────────────────────────────────── */}
      <PremiumCard>
        <div className="p-7">
          <SectionHeader title="Account" description="Your profile information." />
          <Row label="Full name">
            <span className="text-sm text-muted-foreground">{user?.name ?? '—'}</span>
          </Row>
          <Row label="Email address">
            <span className="text-sm text-muted-foreground">{user?.email ?? '—'}</span>
          </Row>
          <Row label="Member since">
            <span className="text-sm text-muted-foreground">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : '—'}
            </span>
          </Row>
        </div>
      </PremiumCard>

      {/* ── Appearance ────────────────────────────────────────── */}
      <PremiumCard>
        <div className="p-7">
          <SectionHeader title="Appearance" description="Choose how Colli looks on your device." />
          <div className="flex gap-3">
            {([
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark',  label: 'Dark',  icon: Moon },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border transition-all duration-150 press-scale'
                )}
                style={
                  theme === value
                    ? {
                        background: 'rgba(255,255,255,0.95)',
                        border: '1.5px solid hsl(33 40% 52% / 0.5)',
                        boxShadow: '0 0 0 3px hsl(33 40% 52% / 0.08)',
                      }
                    : {
                        background: 'rgba(255,255,255,0.45)',
                        border: '1px solid hsl(33 28% 83%)',
                      }
                }
              >
                <Icon className="w-5 h-5" style={{ color: theme === value ? 'hsl(33 40% 48%)' : 'hsl(20 10% 55%)' }} />
                <span className="text-xs font-medium text-foreground/70">{label}</span>
                {theme === value && (
                  <div className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: 'hsl(33 40% 52%)' }}>
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </PremiumCard>

      {/* ── Notifications ──────────────────────────────────────── */}
      <PremiumCard>
        <div className="p-7">
          <SectionHeader title="Notifications" description="Control which alerts Colli sends you." />
          {(Object.entries(notifications) as [keyof typeof notifications, boolean][]).map(([key, val]) => {
            const labels: Record<keyof typeof notifications, { label: string; desc: string }> = {
              weeklyBrief:       { label: 'Weekly executive summary',   desc: 'Delivered every Monday morning' },
              costAlerts:        { label: 'Cost threshold alerts',      desc: 'When spend approaches budget limits' },
              workflowFailures:  { label: 'Workflow failure alerts',    desc: 'Immediate notification on errors' },
              recommendations:   { label: 'New recommendations',        desc: 'When savings or improvements are found' },
              apiChanges:        { label: 'Provider API changes',       desc: 'Pricing updates and rate limit changes' },
            };
            return (
              <Row key={key} label={labels[key].label} description={labels[key].desc}>
                <Switch
                  checked={val}
                  onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, [key]: checked }))}
                />
              </Row>
            );
          })}
        </div>
      </PremiumCard>

      {/* ── Language ──────────────────────────────────────────── */}
      <PremiumCard>
        <div className="p-7">
          <SectionHeader title="Language & Region" description="Interface language. Arabic support is RTL-ready." />
          <div className="flex gap-3">
            {([
              { value: 'en', label: 'English',       note: 'Default' },
              { value: 'ar', label: 'العربية',       note: 'RTL Ready — coming soon', disabled: true },
            ] as const).map(({ value, label, note, ...rest }) => {
              const disabled = 'disabled' in rest ? rest.disabled : false;
              return (
              <button
                key={value}
                onClick={() => !disabled && setLanguage(value)}
                disabled={disabled}
                className={cn(
                  'flex-1 flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
                style={
                  language === value
                    ? { border: '1.5px solid hsl(33 40% 52% / 0.5)', background: 'rgba(255,255,255,0.95)' }
                    : { border: '1px solid hsl(33 28% 83%)', background: 'transparent' }
                }
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-muted-foreground/60" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{note}</p>
                  </div>
                </div>
                {language === value && <Check className="w-4 h-4" style={{ color: 'hsl(33 40% 48%)' }} />}
              </button>
              );
            })}
          </div>
        </div>
      </PremiumCard>

      <section
        aria-labelledby="colli-village-heading"
        className="rounded-2xl border p-7"
        style={{ background: 'hsl(40 33% 96%)', borderColor: 'hsl(33 28% 83%)', color: 'hsl(18 26% 18%)' }}
      >
        <h2 id="colli-village-heading" className="text-lg font-semibold">Colli Village</h2>
        <p className="text-xs font-medium mt-2" style={{ color: 'hsl(25 35% 38%)' }}>Planned · Not available in beta</p>
        <p className="text-sm leading-relaxed mt-4">A future space for teams to understand their AI activity together.</p>
        <p className="text-sm leading-relaxed mt-2" style={{ color: 'hsl(20 15% 40%)' }}>Shared visibility. Clearer spending. Better-informed decisions.</p>
      </section>

      {/* ── Connected Providers ────────────────────────────────── */}
      <PremiumCard>
        <div className="p-7">
          <SectionHeader title="Connected Providers" description="Manage which AI providers appear in your workspace." />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            {ALL_PROVIDERS.map((p) => {
              const active = providers.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProvider(p.id)}
                  disabled={savingProviders}
                  aria-pressed={active}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 press-scale"
                  style={
                    active
                      ? { border: '1.5px solid hsl(33 40% 52% / 0.45)', background: 'rgba(255,255,255,0.95)' }
                      : { border: '1px solid hsl(33 28% 83%)', background: 'rgba(255,255,255,0.4)' }
                  }
                >
                  <div
                    className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                    style={
                      active
                        ? { background: 'hsl(33 40% 52%)', borderColor: 'hsl(33 40% 52%)' }
                        : { borderColor: 'hsl(33 28% 76%)', background: 'transparent' }
                    }
                  >
                    {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-xs font-medium text-foreground/80">{p.name}</span>
                </button>
              );
            })}
          </div>
          {saveError && <p role="alert" className="text-sm text-destructive mb-4">{saveError}</p>}
          <button
            onClick={saveProviders}
            disabled={savingProviders}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 press-scale disabled:opacity-60 flex items-center gap-2"
            style={{
              background: providersSaved ? 'hsl(148 27% 38%)' : 'hsl(18 26% 18%)',
              color: '#ffffff',
            }}
          >
            {providersSaved ? <><Check className="w-4 h-4" /> Saved</> : savingProviders ? 'Saving…' : 'Save providers'}
          </button>
        </div>
      </PremiumCard>

      {/* ── Future integrations ────────────────────────────────── */}
      <PremiumCard>
        <div className="p-7">
          <SectionHeader title="Future Integrations" description="Coming soon — connect additional data sources to Colli." />
          <div className="grid grid-cols-2 gap-3">
            {FUTURE_INTEGRATIONS.map((fi) => (
              <div
                key={fi.name}
                className="flex items-center gap-3 p-3.5 rounded-xl border"
                style={{ border: '1px dashed hsl(33 28% 82%)', background: 'rgba(255,255,255,0.35)' }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'hsl(40 22% 91%)' }}>
                  <BrainCircuit className="w-4 h-4 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground/70">{fi.name}</p>
                  <p className="text-xs text-muted-foreground/50">{fi.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PremiumCard>
    </div>
  );
}
