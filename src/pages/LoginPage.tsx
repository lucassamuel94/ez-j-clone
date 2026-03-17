import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircle, Bot, Sparkles, Send, MessagesSquare, BrainCircuit, Zap, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuthSession } from '@/contexts/AuthSessionContext';

const getRedirectByRole = async (userId: string): Promise<string> => {
  try {
    const { data } = await Promise.race([
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8_000)),
    ]);
    if (data?.role === 'closer') return '/closer';
    if (['head_pos_venda', 'ux_po', 'dev_chatbot', 'treinamento', 'suporte', 'verificacao_bm'].includes(data?.role ?? '')) return '/projects';
  } catch {
    // fallback
  }
  return '/';
};

import ezsoftLogoWhite from '@/assets/ez-journey-logo-white.svg';

const previewHostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isLovablePreview =
  previewHostname.includes('id-preview--') ||
  previewHostname.endsWith('.lovableproject.com');

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { status, session } = useAuthSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get('invite');
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);

  // Bypass login in Lovable preview environment
  useEffect(() => {
    if (isLovablePreview) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // Check invite
  useEffect(() => {
    if (!inviteId) return;
    const checkInvite = async () => {
      try {
        const { data: invitation } = await supabase
          .from('user_invitations')
          .select('email, expires_at, accepted_at')
          .eq('id', inviteId)
          .single();
        
        if (invitation && !invitation.accepted_at) {
          const isExpired = new Date(invitation.expires_at) < new Date();
          if (!isExpired) {
            setInviteEmail(invitation.email);
          } else {
            toast.error('Este convite expirou');
          }
        }
      } catch {
        // non-critical
      }
    };
    checkInvite();
  }, [inviteId]);

  // Redirect when authenticated
  useEffect(() => {
    if (status !== 'authenticated' || !session) return;

    const processAndRedirect = async () => {
      const userEmail = session.user.email || '';
      
      // Process invitation
      try {
        if (inviteId) {
          const { data } = await supabase.rpc('accept_invitation', { _invitation_id: inviteId });
          if (data) toast.success('Convite aceito! Sua conta foi configurada.');
        } else {
          const { data: pending } = await supabase
            .from('user_invitations')
            .select('id')
            .eq('email', userEmail.toLowerCase())
            .is('accepted_at', null)
            .gt('expires_at', new Date().toISOString())
            .limit(1)
            .maybeSingle();

          if (pending) {
            const { data: accepted } = await supabase.rpc('accept_invitation', { _invitation_id: pending.id });
            if (accepted) toast.success('Convite aceito! Sua conta foi configurada.');
          }
        }
      } catch (e) {
        console.warn('Invitation processing failed:', e);
      }

      // Redirect by role
      const dest = await getRedirectByRole(session.user.id);
      navigate(dest);
    };

    processAndRedirect();
  }, [status, session, navigate, inviteId]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setAuthError(null);

    const redirectUrl = new URL(window.location.origin);
    if (inviteId) {
      redirectUrl.searchParams.set('invite', inviteId);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl.toString(),
      },
    });

    if (error) {
      console.error('[Login] OAuth error:', error);
      setAuthError('Erro ao conectar com Google. Tente novamente em alguns segundos.');
      setIsLoading(false);
    }
  };

  // Show loading only during initial bootstrap
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Branding */}
      <div className="relative flex-shrink-0 lg:flex-1 bg-primary p-6 lg:p-12 flex flex-col justify-between overflow-hidden min-h-[280px] lg:min-h-screen">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-bl-[100px] transform translate-x-12 -translate-y-12 bg-brand-accent/10" />
        <div className="absolute bottom-0 left-0 flex gap-2">
          <div className="w-12 h-16 lg:w-16 lg:h-24 rounded-tr-lg bg-brand-accent/[0.12]" />
          <div className="w-8 h-10 lg:w-12 lg:h-16 rounded-tr-lg self-end bg-brand-accent/20" />
        </div>
        <div className="absolute top-[60%] right-0 w-32 h-32 rounded-full transform translate-x-16 hidden lg:block border border-brand-accent/15" />
        <div className="absolute top-[10%] left-[55%] w-20 h-20 rounded-lg rotate-12 hidden lg:block border border-brand-accent/10" />

        {/* Floating icons */}
        <div className="absolute inset-0 pointer-events-none hidden lg:block">
          <div className="absolute top-[18%] right-[15%] border border-primary-foreground/20 rounded-xl p-3 animate-pulse" style={{ animationDuration: '4s' }}>
            <Phone className="h-5 w-5 text-primary-foreground/30" />
          </div>
          <div className="absolute top-[30%] left-[12%] border border-primary-foreground/15 rounded-xl p-2.5 animate-pulse" style={{ animationDuration: '5s' }}>
            <MessageCircle className="h-4 w-4 text-primary-foreground/25" />
          </div>
          <div className="absolute top-[22%] left-[40%] border border-primary-foreground/15 rounded-lg p-2 animate-pulse" style={{ animationDuration: '6s' }}>
            <Send className="h-3.5 w-3.5 text-primary-foreground/20" />
          </div>
          <div className="absolute top-[45%] right-[10%] border border-primary-foreground/20 rounded-xl p-3 animate-pulse" style={{ animationDuration: '3.5s' }}>
            <Bot className="h-5 w-5 text-primary-foreground/30" />
          </div>
          <div className="absolute top-[55%] left-[8%] border border-primary-foreground/15 rounded-xl p-2.5 animate-pulse" style={{ animationDuration: '4.5s' }}>
            <BrainCircuit className="h-4 w-4 text-primary-foreground/25" />
          </div>
          <div className="absolute top-[38%] right-[38%] border border-primary-foreground/10 rounded-lg p-2 animate-pulse" style={{ animationDuration: '7s' }}>
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground/20" />
          </div>
          <div className="absolute bottom-[25%] right-[22%] border border-primary-foreground/15 rounded-xl p-2.5 animate-pulse" style={{ animationDuration: '5.5s' }}>
            <MessagesSquare className="h-4 w-4 text-primary-foreground/25" />
          </div>
          <div className="absolute bottom-[18%] left-[30%] border border-primary-foreground/10 rounded-lg p-2 animate-pulse" style={{ animationDuration: '6.5s' }}>
            <Zap className="h-3.5 w-3.5 text-primary-foreground/20" />
          </div>
        </div>
        
        <div>
          <img src={ezsoftLogoWhite} alt="EZ Journey" className="h-7 lg:h-8 w-auto" />
        </div>
        
        <div className="relative z-10 my-4 lg:my-0">
          <h1 className="text-2xl lg:text-4xl font-bold text-primary-foreground mb-2 lg:mb-4">
            Bem-vindo!
            <br />
            Acesse o EZ Journey
          </h1>
          <p className="text-primary-foreground/80 text-sm lg:text-lg">
            Gestão completa da jornada do cliente.
          </p>
        </div>
        
        <div className="relative z-10 hidden lg:block text-right">
          <p className="text-primary-foreground/70 italic text-sm">
            "A persistência é o caminho do êxito."
          </p>
          <p className="text-primary-foreground font-medium text-sm mt-1">
            Charles Chaplin
          </p>
        </div>
      </div>
      
      {/* Right Side - Login Form */}
      <div className="flex-1 bg-background flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground font-display">
              Acesse sua conta
            </h2>
            <p className="text-muted-foreground mt-2">
              Acesso restrito para colaboradores EZ
            </p>
          </div>

          {authError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
              <p className="text-sm text-destructive">{authError}</p>
            </div>
          )}
          
          <Button
            variant="outline"
            className="w-full h-12 text-base gap-3"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {isLoading ? 'Entrando...' : 'Continuar com Google'}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Use seu email @ezsoft.com.br para acessar
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
