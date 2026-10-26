// Runtime checks live outside generated code so client regeneration preserves them.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string;
  providers: string[] | null;
  createdAt: string;
}

export function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  return isRecord(value) && Number.isInteger(value.id) && number(value.id) && value.id > 0 &&
    text(value.email) && text(value.name) && text(value.createdAt) &&
    (value.providers === null || (Array.isArray(value.providers) && value.providers.every(text)));
}

export function isExecutiveBrief(value: unknown): boolean {
  return isRecord(value) && text(value.date) &&
    (value.summary === undefined || typeof value.summary === 'string') &&
    Array.isArray(value.items) && value.items.every(item =>
      isRecord(item) && text(item.id) && text(item.text) &&
      typeof item.type === 'string' && ['positive', 'negative', 'neutral', 'warning', 'info'].includes(item.type) &&
      (item.detail == null || typeof item.detail === 'string'));
}

export function isDashboardSummary(value: unknown): boolean {
  if (!isRecord(value) || !isExecutiveBrief(value.brief) || !isRecord(value.healthScore) || !isRecord(value.metrics)) return false;
  const health = value.healthScore;
  const metrics = value.metrics;
  return number(health.score) && health.score >= 0 && health.score <= 100 &&
    text(health.label) && typeof health.status === 'string' && ['healthy', 'warning', 'critical'].includes(health.status) && number(health.change) &&
    (health.previousScore === undefined || number(health.previousScore)) &&
    ['totalMonthlySpend', 'estimatedSavings', 'activeModels', 'activeWorkflows', 'totalTokensToday', 'failedExecutions']
      .every(key => number(metrics[key]) && metrics[key] >= 0);
}

export function validEndpointResponse(url: string, value: unknown): boolean {
  const path = new URL(url, 'http://local.invalid').pathname.replace(/\/$/, '');
  if (/\/auth\/(me|login|register|providers)$/.test(path)) return isAuthenticatedUser(value);
  if (path.endsWith('/dashboard/summary')) return isDashboardSummary(value);
  if (path.endsWith('/dashboard/brief')) return isExecutiveBrief(value);
  return true;
}
