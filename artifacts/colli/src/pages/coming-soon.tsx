import React from 'react';
import { PremiumCard } from '@/components/premium-ui';
import { Construction } from 'lucide-react';

export function ComingSoon({ title, description }: { title: string, description: string }) {
  return (
    <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
      <PremiumCard className="max-w-md w-full text-center">
        <div className="p-12 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-6 border border-border shadow-inner">
            <Construction className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">{title}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </PremiumCard>
    </div>
  );
}

export function Costs() {
  return <ComingSoon title="Cost Center" description="Comprehensive budget tracking and spend analysis across all connected AI models is currently in development." />;
}

export function Reports() {
  return <ComingSoon title="Executive Reports" description="Automated PDF and presentation generation for board meetings and stakeholder updates." />;
}

export function Settings() {
  return <ComingSoon title="Settings" description="Workspace configuration, API key management, and team access controls." />;
}
