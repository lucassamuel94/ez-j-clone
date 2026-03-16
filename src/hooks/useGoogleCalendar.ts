import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: { email: string }[];
  location?: string;
}

export type OAuthConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'loading';

export const useGoogleCalendar = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const connectionStatus: OAuthConnectionStatus = useMemo(() => {
    if (isLoading) return 'loading';
    if (isReconnecting) return 'reconnecting';
    if (isConnected) return 'connected';
    return 'disconnected';
  }, [isLoading, isReconnecting, isConnected]);

  const checkStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsConnected(false);
        setIsLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'status' },
      });
      if (!error && data) {
        setIsConnected(data.connected);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const showReconnectToast = useCallback(() => {
    toast.error('Sua conexão com o Google expirou', {
      description: 'Clique para reconectar sua conta Google',
      action: {
        label: 'Reconectar',
        onClick: () => {
          // trigger connect flow
          connect();
        },
      },
      duration: Infinity,
    });
  }, []);

  // Listen for OAuth callback
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'google-calendar-oauth-callback' && event.data?.code) {
        setIsConnecting(true);
        setIsReconnecting(true);
        try {
          const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
            body: {
              action: 'exchange_code',
              code: event.data.code,
              redirect_uri: `${window.location.origin}/google-calendar-callback`,
            },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          setIsConnected(true);
          toast.success('Google Calendar conectado com sucesso!');
        } catch (err: unknown) {
          console.error('OAuth exchange error:', err);
          toast.error('Erro ao conectar Google Calendar');
        } finally {
          setIsConnecting(false);
          setIsReconnecting(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'get_auth_url',
          redirect_uri: `${window.location.origin}/google-calendar-callback`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        const popup = window.open(data.url, 'google-calendar-auth', 'width=500,height=700');
        if (!popup) {
          toast.error('Popup bloqueado! Permita popups para conectar.');
          setIsConnecting(false);
        }
      }
    } catch (err: unknown) {
      console.error('Error getting auth URL:', err);
      toast.error('Erro ao iniciar conexão');
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'disconnect' },
      });
      if (error) throw error;
      setIsConnected(false);
      toast.success('Google Calendar desconectado');
    } catch (err: unknown) {
      console.error('Disconnect error:', err);
      toast.error('Erro ao desconectar');
    }
  }, []);

  const callAPI = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('google-calendar-api', {
      body: { action, ...params },
    });
    if (error) throw error;
    if (data?.error) {
      if (data.error === 'not_connected' || data.error === 'TOKEN_REVOKED') {
        setIsConnected(false);
        showReconnectToast();
        throw new Error(data.error);
      }
      throw new Error(data.error);
    }
    return data;
  }, [showReconnectToast]);

  const listEvents = useCallback((timeMin?: string, timeMax?: string, maxResults?: number) =>
    callAPI('listEvents', { timeMin, timeMax, maxResults }), [callAPI]);

  const createEvent = useCallback((event: CalendarEvent) =>
    callAPI('createEvent', { event }), [callAPI]);

  const updateEvent = useCallback((eventId: string, event: Partial<CalendarEvent>) =>
    callAPI('updateEvent', { eventId, event }), [callAPI]);

  const deleteEvent = useCallback((eventId: string) =>
    callAPI('deleteEvent', { eventId }), [callAPI]);

  return useMemo(() => ({
    isConnected,
    isLoading,
    isConnecting,
    connectionStatus,
    connect,
    disconnect,
    listEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    refreshStatus: checkStatus,
  }), [isConnected, isLoading, isConnecting, connectionStatus, connect, disconnect, listEvents, createEvent, updateEvent, deleteEvent, checkStatus]);
};
