import { customFetch, InvalidResponseError, apiFailureKind } from './custom-fetch';
import type { AuthenticatedUser } from './response-validation';

// A timeout has an unknown outcome: retrying this replacement selection is safe.
export async function saveProviderSelection(providers: string[]): Promise<AuthenticatedUser> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const user = await customFetch<AuthenticatedUser>('/api/auth/providers', {
      method: 'PATCH', credentials: 'include', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers }),
    });
    if (user.providers === null || user.providers.length !== providers.length ||
        !providers.every(provider => user.providers?.includes(provider))) {
      throw new InvalidResponseError('Provider selection was not confirmed.');
    }
    return user;
  } finally {
    clearTimeout(timer);
  }
}

export function providerSaveError(error: unknown): string {
  if (apiFailureKind(error) === 'unauthorized') {
    return 'Your session has expired. Sign in again before retrying. Your selections are still shown here.';
  }
  return 'We couldn’t confirm your provider selections were saved. Your selections are still shown here. Please try saving again.';
}
