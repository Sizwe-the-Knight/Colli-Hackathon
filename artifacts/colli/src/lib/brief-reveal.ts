// Cosmetic only: this module never fetches data or generates narration.
// Memory is scoped to this page visit, surviving internal route changes.
let seen = false;
export const REVEAL_DURATION = 1800;
export function rememberBriefVisit() { seen = true; }
export function shouldRevealBrief() {
  return !seen && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function beginBriefReveal(update: (progress: number) => void, complete: () => void) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  rememberBriefVisit();
  let frame = 0;
  let stopped = false;
  const start = performance.now();
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    motion.removeEventListener('change', onMotion);
  };
  const finish = () => { stop(); complete(); };
  const onMotion = () => { if (motion.matches && !stopped) finish(); };
  const tick = (now: number) => {
    if (stopped) return;
    const elapsed = now - start;
    // Reach 100 just before completion so the final number is visible.
    update(Math.min(100, Math.floor(Math.max(0, elapsed) / 1700 * 100)));
    if (elapsed >= REVEAL_DURATION) finish();
    else frame = requestAnimationFrame(tick);
  };
  if (motion.matches) complete();
  else {
    motion.addEventListener('change', onMotion);
    frame = requestAnimationFrame(tick);
  }
  return stop;
}
