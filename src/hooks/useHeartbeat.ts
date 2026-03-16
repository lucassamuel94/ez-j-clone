import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthSession } from '@/contexts/AuthSessionContext';

const HEARTBEAT_INTERVAL_MS = 60_000;

export const useHeartbeat = () => {
  const { status, session } = useAuthSession();
  const userId = session?.user?.id;

  const updateLastSeen = useCallback(async () => {
    if (!userId) return;
    try {
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() } as Record<string, string>)
        .eq('id', userId);
    } catch {
      // Silently ignore — heartbeat is non-critical
    }
  }, [userId]);

  useEffect(() => {
    if (status !== 'authenticated' || !userId) return;

    updateLastSeen();
    const interval = setInterval(updateLastSeen, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [updateLastSeen, status, userId]);
};
