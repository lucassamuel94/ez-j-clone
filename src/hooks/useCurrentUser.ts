import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

const isLovablePreview = typeof window !== 'undefined' &&
  (window.location.hostname.includes('id-preview--') || window.location.hostname.endsWith('.lovableproject.com'));

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  if (isLovablePreview) {
    return { id: '00000000-0000-0000-0000-000000000000', name: 'Admin (Preview)', email: 'admin@preview.local', avatarUrl: null };
  }
  const { data: { session } } = await supabase.auth.getSession();
  const authUser = session?.user ?? null;
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar_url')
    .eq('id', authUser.id)
    .single();

  const name = profile?.name
    || authUser.user_metadata?.full_name
    || authUser.user_metadata?.name
    || authUser.email?.split('@')[0]
    || 'Usuário';

  const avatarUrl = (profile as any)?.avatar_url
    || authUser.user_metadata?.avatar_url
    || authUser.user_metadata?.picture
    || null;

  return {
    id: authUser.id,
    name,
    email: authUser.email || '',
    avatarUrl,
  };
}

export const useCurrentUser = () => {
  const queryClient = useQueryClient();

  const { data: user = null, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60_000, // 5 min – session rarely changes
    gcTime: 10 * 60_000,
  });

  // Invalidate on auth state change (login/logout) instead of setting state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return { user, isLoading };
};

export const getGreeting = (): string => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return '☀️ Bom dia';
  } else if (hour >= 12 && hour < 18) {
    return '🌤️ Boa tarde';
  } else {
    return '🌙 Boa noite';
  }
};
