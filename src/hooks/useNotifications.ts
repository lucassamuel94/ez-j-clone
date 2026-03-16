import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Singleton AudioContext to avoid accumulating contexts
let audioCtx: AudioContext | null = null;

const playNotificationSound = async () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.setValueAtTime(1047, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
};

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

export const useNotifications = () => {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Track auth state to get userId reliably
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    // Also check current session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch notifications — queryKey includes userId
  const { data: notifications = [], isLoading, isError } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []).map((n) => ({
        ...n,
        read: n.read ?? false,
      })) as Notification[];
    },
    enabled: !!userId,
  });

  // Mark notification as read
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  // Mark all as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  // Subscribe to realtime — re-subscribe when userId changes
  useEffect(() => {
    if (!userId) return;

    // Cleanup previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`notifications-rt-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });

          const notification = payload.new as Notification;

          // Show toast for new notification
          toast(notification.title, {
            description: notification.message,
            duration: 8000,
            action: notification.link ? {
              label: 'Ver',
              onClick: () => { window.location.href = notification.link!; },
            } : undefined,
          });

          // Show browser notification if permission granted
          if (window.Notification && window.Notification.permission === 'granted') {
            try {
              const n = new window.Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico',
              });
              if (notification.link) {
                n.onclick = () => {
                  window.focus();
                  window.location.href = notification.link!;
                  n.close();
                };
              }
            } catch (e) {
              console.warn('Could not show browser notification:', e);
            }
          }

          // Play sound if user preference enabled
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('notify_overdue_sound')
              .eq('id', userId)
              .single();

            if ((profile as any)?.notify_overdue_sound !== false) {
              await playNotificationSound();
            }
          } catch {
            await playNotificationSound();
          }
        }
      )
      .subscribe((status) => {
        // On reconnect, refetch to catch any missed notifications
        if (status === 'SUBSCRIBED') {
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, queryClient]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isError,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
  };
};

