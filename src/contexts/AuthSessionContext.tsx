import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';
import {
  getSessionWithTimeout,
  isRetryableAuthFailure,
} from '@/lib/auth/resilience';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'degraded';

interface AuthSessionState {
  status: AuthStatus;
  session: Session | null;
  retry: () => void;
}

const AuthSessionContext = createContext<AuthSessionState>({
  status: 'loading',
  session: null,
  retry: () => {},
});

export const useAuthSession = () => useContext(AuthSessionContext);

export const AuthSessionProvider = ({ children }: { children: ReactNode }) => {
  return <AuthSessionProviderReal>{children}</AuthSessionProviderReal>;
};

const AuthSessionProviderReal = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  // Stable ref to the last known valid session — survives closures
  const lastKnownSessionRef = useRef<Session | null>(null);

  const bootstrap = useCallback(async () => {
    setStatus('loading');
    try {
      const { session: s, error } = await getSessionWithTimeout(8_000);

      if (error) {
        if (isRetryableAuthFailure(error)) {
          // Transient failure — NEVER clear tokens, keep last known session
          const existing = lastKnownSessionRef.current;
          if (existing) {
            setSession(existing);
            setStatus('degraded');
          } else {
            // No previous session known, but don't clear storage either
            setStatus('unauthenticated');
          }
          return;
        }
        // Non-retryable (real auth error) — mark unauthenticated but don't aggressively clear
        setSession(null);
        lastKnownSessionRef.current = null;
        setStatus('unauthenticated');
        return;
      }

      if (s) {
        lastKnownSessionRef.current = s;
        setSession(s);
        setStatus('authenticated');
      } else {
        lastKnownSessionRef.current = null;
        setSession(null);
        setStatus('unauthenticated');
      }
    } catch (err) {
      console.error('Auth bootstrap error:', err);
      if (isRetryableAuthFailure(err)) {
        const existing = lastKnownSessionRef.current;
        if (existing) {
          setSession(existing);
          setStatus('degraded');
        } else {
          setStatus('unauthenticated');
        }
      } else {
        lastKnownSessionRef.current = null;
        setSession(null);
        setStatus('unauthenticated');
      }
    }
  }, []);

  useEffect(() => {
    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) {
        lastKnownSessionRef.current = s;
        setSession(s);
        setStatus('authenticated');
      } else {
        lastKnownSessionRef.current = null;
        setSession(null);
        setStatus('unauthenticated');
      }
    });

    return () => subscription.unsubscribe();
  }, [bootstrap]);

  const retry = useCallback(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <AuthSessionContext.Provider value={{ status, session, retry }}>
      {children}
    </AuthSessionContext.Provider>
  );
};
