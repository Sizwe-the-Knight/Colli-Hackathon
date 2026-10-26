import { saveProviderSelection, providerSaveError, getGetMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/lib/context';

const PROVIDERS = [
  { id: 'openai',     name: 'OpenAI',      description: 'GPT-4o, o1, DALL·E' },
  { id: 'anthropic',  name: 'Claude',       description: 'Claude 3.5 Sonnet, Opus' },
  { id: 'google',     name: 'Gemini',       description: 'Gemini 1.5 Pro, Flash' },
  { id: 'perplexity', name: 'Perplexity',   description: 'Sonar, online search' },
  { id: 'mistral',    name: 'Mistral',      description: 'Mistral Large, Codestral' },
  { id: 'grok',       name: 'Grok',         description: 'Grok 2, real-time data' },
  { id: 'deepseek',   name: 'DeepSeek',     description: 'DeepSeek V3, Coder' },
];

export function Onboarding() {
  const [selected, setSelected] = useState<Set<string>>(new Set(['openai', 'anthropic']));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { setUser } = useAppContext();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContinue = async () => {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const user = await saveProviderSelection(Array.from(selected));
      await queryClient.cancelQueries({ queryKey: getGetMeQueryKey() });
      queryClient.setQueryData(getGetMeQueryKey(), user);
      setUser(user);
      setLocation('/brief');
    } catch (error) {
      setSaveError(providerSaveError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{
        background: 'radial-gradient(ellipse 120% 80% at 50% 0%, hsl(38 35% 92%) 0%, hsl(40 35% 95%) 60%)',
      }}
    >
      <div className="w-full max-w-[560px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-12">
          <img
            src="/colli-icon.png"
            alt="Colli"
            className="w-14 h-14 object-contain rounded-[13px] mb-6"
            style={{ boxShadow: '0 4px 20px rgba(58,43,34,0.20)' }}
          />
          <h1
            className="text-2xl font-semibold tracking-tight text-center"
            style={{ color: 'hsl(18 26% 18%)' }}
          >
            Which AI providers does your
            <br />organization currently use?
          </h1>
          <p className="text-sm text-muted-foreground mt-3 text-center max-w-xs">
            Your selections personalize Colli. Selecting a provider does not connect its account. This demonstration uses sample activity data.
          </p>
        </div>

        {/* Provider grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {PROVIDERS.map((provider) => {
            const isSelected = selected.has(provider.id);
            return (
              <button
                key={provider.id}
                onClick={() => toggle(provider.id)}
                disabled={saving}
                aria-pressed={isSelected}
                className={cn(
                  'relative flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-150 press-scale',
                  'focus:outline-none'
                )}
                style={
                  isSelected
                    ? {
                        background: 'rgba(255,255,255,0.95)',
                        border: '1.5px solid hsl(33 40% 52% / 0.5)',
                        boxShadow: '0 0 0 3px hsl(33 40% 52% / 0.08), 0 2px 8px rgba(58,43,34,0.08)',
                      }
                    : {
                        background: 'rgba(255,255,255,0.65)',
                        border: '1px solid hsl(33 28% 83%)',
                        boxShadow: '0 1px 3px rgba(58,43,34,0.05)',
                      }
                }
                onMouseEnter={(e) => {
                  if (!isSelected)
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.85)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected)
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.65)';
                }}
              >
                {/* Check */}
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all duration-150'
                  )}
                  style={
                    isSelected
                      ? { background: 'hsl(33 40% 52%)', borderColor: 'hsl(33 40% 52%)' }
                      : { background: 'transparent', borderColor: 'hsl(33 28% 78%)' }
                  }
                >
                  {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: isSelected ? 'hsl(18 26% 18%)' : 'hsl(20 10% 40%)' }}
                  >
                    {provider.name}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{provider.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {saveError && <p role="alert" className="text-sm text-destructive mb-4">{saveError}</p>}

        {/* CTA */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleContinue}
            disabled={selected.size === 0 || saving}
            className="w-full h-12 rounded-2xl text-sm font-semibold transition-all duration-150 press-scale disabled:opacity-50"
            style={{
              background: selected.size > 0 ? 'hsl(18 26% 18%)' : 'hsl(20 10% 60%)',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(58,43,34,0.22)',
            }}
          >
            {saving ? 'Saving…' : `Continue with ${selected.size} provider${selected.size !== 1 ? 's' : ''}`}
          </button>
          <p className="text-xs text-muted-foreground/60">
            You can change this any time in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
