import { useState, useEffect, useRef, useCallback } from 'react';
import { sanitizeHtml } from '@/utils/sanitize';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Send, Loader2, ChevronDown, ChevronUp, Paperclip, X, FileIcon } from 'lucide-react';
import { RichTextEditor } from '@/components/RichTextEditor';
import { EmailTagInput } from '@/components/EmailTagInput';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProposalEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
}

interface Attachment {
  file: File;
  path?: string;
  uploading: boolean;
  uploaded: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ProposalEmailDialog = ({
  open,
  onOpenChange,
  proposalId,
}: ProposalEmailDialogProps) => {
  const [toEmail, setToEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [bccEmail, setBccEmail] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [emailSignature, setEmailSignature] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    setAttachments([]);
    setCcEmail('');
    setBccEmail('');
    setShowCcBcc(false);

    const loadData = async () => {
      // Fetch proposal data
      const { data: proposal } = await supabase
        .from('proposals')
        .select('company_name, contact_name, contact_email')
        .eq('id', proposalId)
        .single();

      const proposalUrl = `${window.location.origin}/proposal-preview/${proposalId}`;
      const contactName = proposal?.contact_name || '';

      setToEmail(proposal?.contact_email || '');
      setSubject(`Proposta Comercial - ${proposal?.company_name || ''}`);
      setBody(
        `<p>Olá${contactName ? ` ${contactName}` : ''},</p>` +
        `<p>Segue o link da sua proposta comercial:</p>` +
        `<p><a href="${proposalUrl}">${proposalUrl}</a></p>` +
        `<p>Qualquer dúvida, estou à disposição.</p>` +
        `<p>Atenciosamente.</p>`
      );

      // Fetch email signature
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email_signature')
          .eq('id', user.id)
          .single();
        setEmailSignature((profile as any)?.email_signature || null);
      }
    };

    loadData();
  }, [open, proposalId]);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    const validFiles: File[] = [];
    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" excede o limite de 10MB (${formatFileSize(file.size)})`);
      } else {
        validFiles.push(file);
      }
    });

    if (validFiles.length === 0) return;

    const newAttachments: Attachment[] = validFiles.map((file) => ({
      file,
      uploading: true,
      uploaded: false,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);

    for (let i = 0; i < newAttachments.length; i++) {
      const file = newAttachments[i].file;
      const filePath = `${user.id}/${crypto.randomUUID()}_${file.name}`;

      const { error } = await supabase.storage
        .from('email-attachments')
        .upload(filePath, file);

      if (error) {
        toast.error(`Erro ao enviar ${file.name}`);
        setAttachments((prev) => prev.filter((a) => a.file !== file));
      } else {
        setAttachments((prev) =>
          prev.map((a) =>
            a.file === file
              ? { ...a, path: filePath, uploading: false, uploaded: true }
              : a
          )
        );
      }
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    await uploadFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = async (attachment: Attachment) => {
    if (attachment.path) {
      await supabase.storage.from('email-attachments').remove([attachment.path]);
    }
    setAttachments((prev) => prev.filter((a) => a !== attachment));
  };

  const handleSend = async () => {
    if (!toEmail || !subject || !body) return;
    if (attachments.some((a) => a.uploading)) {
      toast.error('Aguarde o upload dos anexos terminar');
      return;
    }

    setIsSending(true);
    try {
      const attachmentPaths = attachments
        .filter((a) => a.uploaded && a.path)
        .map((a) => ({ path: a.path!, name: a.file.name, type: a.file.type }));

      const { data, error } = await supabase.functions.invoke('send-gmail', {
        body: {
          to_email: toEmail,
          cc_email: ccEmail || undefined,
          bcc_email: bccEmail || undefined,
          subject,
          body,
          lead_id: null,
          attachments: attachmentPaths.length > 0 ? attachmentPaths : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error === 'not_connected') {
          toast.error('Google não conectado. Conecte na página de Perfil.');
          return;
        }
        if (data.error === 'gmail_scope_missing') {
          toast.error('Permissão de e-mail não concedida. Reconecte o Google na página de Perfil.');
          return;
        }
        throw new Error(data.error);
      }

      toast.success('E-mail enviado com sucesso!');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Send email error:', err);
      toast.error('Erro ao enviar e-mail');
    } finally {
      setIsSending(false);
    }
  };

  const isUploading = attachments.some((a) => a.uploading);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Enviar Proposta por E-mail
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between">
              <Label>Para</Label>
              {!showCcBcc && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2 text-muted-foreground"
                  onClick={() => setShowCcBcc(true)}
                >
                  CC / CCO
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
            <EmailTagInput
              value={toEmail}
              onChange={setToEmail}
              placeholder="Digite o e-mail e pressione Enter"
            />
          </div>

          {showCcBcc && (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <Label>CC</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 px-2 text-muted-foreground"
                    onClick={() => setShowCcBcc(false)}
                  >
                    Ocultar
                    <ChevronUp className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                <EmailTagInput
                  value={ccEmail}
                  onChange={setCcEmail}
                  placeholder="Digite o e-mail e pressione Enter"
                />
              </div>
              <div>
                <Label>CCO</Label>
                <EmailTagInput
                  value={bccEmail}
                  onChange={setBccEmail}
                  placeholder="Digite o e-mail e pressione Enter"
                />
              </div>
            </>
          )}

          <div>
            <Label>Assunto</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Assunto do e-mail"
            />
          </div>

          <div className="flex-1">
            <Label>Corpo</Label>
            <RichTextEditor
              content={body}
              onChange={setBody}
              placeholder="Escreva sua mensagem..."
            />
            {emailSignature && (
              <div className="mt-2 border-t border-border pt-2">
                <p className="text-xs text-muted-foreground mb-1">Assinatura</p>
                <div
                  className="text-sm opacity-70 pointer-events-none [&_img[style*='border-radius']]:!aspect-square [&_img[style*='border-radius']]:object-cover"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(emailSignature) }}
                />
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Paperclip className="h-4 w-4 mr-1" />
                Anexar arquivo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              {attachments.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {attachments.length} arquivo{attachments.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm"
                  >
                    <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{att.file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatFileSize(att.file.size)}
                    </span>
                    {att.uploading && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeAttachment(att)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || isUploading || !toEmail || !subject || !body}
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
