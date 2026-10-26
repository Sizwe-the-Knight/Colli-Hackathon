import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { beginBriefReveal, rememberBriefVisit, shouldRevealBrief } from '@/lib/brief-reveal';

// Mount only after the Brief's response has passed validation.
export function BriefReveal({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(shouldRevealBrief);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    rememberBriefVisit();
    if (!active) return;
    return beginBriefReveal(setProgress, () => setActive(false));
  }, [active]);
  if (!active) return <>{children}</>;
  return <section className="brief-reveal" aria-label="Opening your brief">
    <img src="/colli-icon.png" width="112" height="112" alt="Colli" />
    <p role="status">Opening your brief.</p>
    <span className="brief-reveal-number" aria-hidden="true">{progress}</span>
    <div className="brief-reveal-track" aria-hidden="true"><span style={{ transform: `scaleX(${progress / 100})` }} /></div>
    <span className="sr-only">Your brief is ready. A short visual introduction is playing.</span>
    <Link href="/dashboard" className="brief-reveal-exit">Continue to Dashboard</Link>
  </section>;
}
