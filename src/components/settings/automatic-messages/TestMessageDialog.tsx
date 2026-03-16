import { useState, useCallback, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AutomaticMessage {
  id: string;
  body: string;
  ai_enabled: boolean;
  ai_prompt: string | null;
  trigger_key?: string | null;
}

interface TestMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: AutomaticMessage | null;
}

export function TestMessageDialog({ open, onOpenChange, message }: TestMessageDialogProps) {
  const { user } = useCurrentUser();
  const [sending, setSending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [profile, setProfile] = useState<{ name?: string; whatsapp?: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('name, whatsapp').eq('id', user.id).single()
      .then(({ data }) => setProfile(data));
  }, [user?.id]);

  const userName = profile?.name || user?.email || 'você';
  const userWhatsapp = profile?.whatsapp;

  const handleSend = useCallback(async () => {
    if (!message || !userWhatsapp || !user?.id) return;

    const digits = userWhatsapp.replace(/[^\d]/g, '');
    if (digits.length < 10) {
      toast.error('Seu perfil não possui WhatsApp válido cadastrado');
      return;
    }

    setSending(true);
    try {
      // Call the real trigger function with test mode
      // This resolves variables exactly like production
      const { data, error } = await supabase.functions.invoke('trigger-automatic-message', {
        body: {
          trigger_key: message.trigger_key || 'manual_test',
          message_id: message.id,
          _trigger_source: 'manual_test',
          _test_user_id: user.id,
        },
      });

      if (error) throw error;

      if (data?.results?.[0]?.sent_to?.length > 0) {
        toast.success('Mensagem de teste enviada para você!');
        onOpenChange(false);
        setConfirmed(false);
      } else {
        const firstError = data?.results?.[0]?.errors?.[0];
        toast.error(firstError || 'Falha ao enviar mensagem de teste');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao testar mensagem';
      toast.error(errorMessage);
    } finally {
      setSending(false);
    }
  }, [message, userWhatsapp, user?.id, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setConfirmed(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Testar Mensagem</DialogTitle>
          <DialogDescription>
            A mensagem de teste será enviada exclusivamente para você, com as mesmas variáveis de produção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!userWhatsapp ? (
            <Alert className="border-destructive/30 bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-xs text-muted-foreground">
                Seu perfil não possui WhatsApp cadastrado. Cadastre seu número no perfil para testar mensagens.
              </AlertDescription>
            </Alert>
          ) : !confirmed ? (
            <div className="text-center space-y-3 py-4">
              <p className="text-sm text-foreground">
                A mensagem será enviada apenas para <strong>{userName}</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                WhatsApp: {userWhatsapp}
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                As variáveis serão resolvidas com dados reais, exatamente como em produção.
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">Enviando...</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setConfirmed(false); }} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!confirmed) {
                setConfirmed(true);
                handleSend();
              }
            }}
            disabled={!userWhatsapp || sending}
            className="gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar para mim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
