import React from 'react';

export function ApiUnavailable({ subject, onRetry }: { subject: string; onRetry: () => void }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <section role="alert" className="max-w-lg rounded-3xl border border-border bg-card p-8 space-y-4">
        <p className="font-semibold text-foreground">Colli</p>
        <h1 className="text-2xl font-semibold text-foreground">{subject} unavailable</h1>
        <p className="text-muted-foreground">We couldn’t retrieve valid information. Your current status is unknown. Please try again.</p>
        <button className="rounded-xl bg-primary text-primary-foreground px-5 py-3" onClick={onRetry}>Try again</button>
      </section>
    </main>
  );
}
