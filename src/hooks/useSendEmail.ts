import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AttachmentInfo {
  path: string;
  name: string;
  type: string;
}

interface SendEmailParams {
  to_email: string;
  cc_email?: string;
  bcc_email?: string;
  subject: string;
  body: string;
  lead_id: string;
  template_id?: string;
  attachments?: AttachmentInfo[];
}

export const useSendEmail = () => {
  const [isSending, setIsSending] = useState(false);

  const sendEmail = async (params: SendEmailParams) => {
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-gmail', {
        body: params,
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error === 'not_connected') {
          toast.error('Google não conectado', {
            description: 'Conecte sua conta na página de Perfil para enviar e-mails.',
            duration: 8000,
          });
          return { success: false, error: 'not_connected' };
        }
        if (data.error === 'TOKEN_REVOKED') {
          toast.error('Sua conexão com o Google expirou', {
            description: 'Reconecte sua conta Google na página de Perfil.',
            action: {
              label: 'Ir para Perfil',
              onClick: () => { window.location.href = '/profile'; },
            },
            duration: Infinity,
          });
          return { success: false, error: 'TOKEN_REVOKED' };
        }
        if (data.error === 'gmail_scope_missing') {
          toast.error('Permissão de e-mail não concedida', {
            description: 'Reconecte o Google na página de Perfil para conceder a permissão.',
            duration: 8000,
          });
          return { success: false, error: 'gmail_scope_missing' };
        }
        throw new Error(data.error);
      }

      if (data?.failedAttachments?.length > 0) {
        toast.warning('E-mail enviado, mas alguns anexos falharam', {
          description: `Anexos não incluídos: ${data.failedAttachments.join(', ')}`,
          duration: 8000,
        });
      } else {
        toast.success('E-mail enviado com sucesso!');
      }
      return { success: true };
    } catch (err: unknown) {
      console.error('Send email error:', err);
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      if (msg === 'TOKEN_REVOKED') {
        toast.error('Sua conexão com o Google expirou', {
          description: 'Reconecte sua conta Google na página de Perfil.',
          action: {
            label: 'Ir para Perfil',
            onClick: () => { window.location.href = '/profile'; },
          },
          duration: Infinity,
        });
        return { success: false, error: 'TOKEN_REVOKED' };
      }
      toast.error('Erro ao enviar e-mail');
      return { success: false, error: msg };
    } finally {
      setIsSending(false);
    }
  };

  return { sendEmail, isSending };
};
