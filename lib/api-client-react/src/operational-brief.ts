import { customFetch } from './custom-fetch';

// Deliberately outside generated code. Consumers validate the report contract.
export function getOperationalBrief(signal?: AbortSignal): Promise<unknown> {
  return customFetch('/api/operational/brief', { signal, credentials: 'include' });
}

export function getBriefNarration(signal?: AbortSignal): Promise<unknown> {
  return customFetch('/api/operational/brief/narration', { signal, credentials: 'include' });
}

export function generateBriefNarration(fingerprint: string, signal?: AbortSignal): Promise<unknown> {
  return customFetch('/api/operational/brief/narration', { method: 'POST', credentials: 'include', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fingerprint }) });
}
