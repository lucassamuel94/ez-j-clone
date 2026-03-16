import { supabase } from '@/integrations/supabase/client';

const AUTH_TIMEOUT_MS = 5_000;

/**
 * Classifies whether an auth error is a transient/retryable failure
 * (504 timeout, network abort, AuthRetryableFetchError).
 */
export function isRetryableAuthFailure(error: unknown): boolean {
  if (!error) return false;

  // AuthRetryableFetchError from Supabase SDK
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'AuthRetryableFetchError'
  ) {
    return true;
  }

  // AbortError (signal aborted)
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'AbortError'
  ) {
    return true;
  }

  // Status-based (504, 500, 502, 503)
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error
  ) {
    const status = (error as { status: number }).status;
    if (status === 504 || status === 500 || status === 502 || status === 503) return true;
  }

  // "failed to sign in with vendor" — backend temporarily unable to process OAuth
  const msg = String(error);
  if (
    msg.includes('timeout') ||
    msg.includes('upstream') ||
    msg.includes('AbortError') ||
    msg.includes('context deadline') ||
    msg.includes('failed to sign in with vendor') ||
    msg.includes('Sign in was cancelled') ||
    msg.includes('i/o timeout')
  ) {
    return true;
  }

  return false;
}

/**
 * Gets the current session with an explicit timeout.
 * Returns { session, error } — error is set if timed out or retryable failure.
 */
export async function getSessionWithTimeout(
  timeoutMs: number = AUTH_TIMEOUT_MS,
): Promise<{ session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']; error: Error | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { data: { session }, error } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new DOMException('Auth session check timed out', 'AbortError'));
        });
      }),
    ]);

    clearTimeout(timer);

    if (error) {
      return { session: null, error: error as unknown as Error };
    }

    return { session, error: null };
  } catch (err) {
    clearTimeout(timer);
    return { session: null, error: err as Error };
  }
}
