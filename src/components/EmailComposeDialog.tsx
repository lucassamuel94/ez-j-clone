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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mail, Send, Loader2, ChevronDown, ChevronUp, Paperclip, X, FileIcon } from 'lucide-react';
import { Lead } from '@/types/lead';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useSendEmail } from '@/hooks/useSendEmail';
import { RichTextEditor } from '@/components/RichTextEditor';
import { EmailTagInput } from '@/components/EmailTagInput';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSystemUsers } from '@/hooks/useSystemUsers';

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  userName?: string;
  sdrName?: string;
  closerName?: string;
  onSent?: (details?: { to: string; subject: string; body?: string }) => void;
}

interface Attachment {
  file: File;
  path?: string;
  uploading: boolean;
  uploaded: boolean;
}

function replaceVariables(text: string, lead: Lead, userName: string, sdrName: string, closerName: string): string {
  return text
    .replace(/\{\{nome_contato\}\}/g, lead.name || '')
    .replace(/\{\{contato\}\}/g, lead.name || '')
    .replace(/\{\{empresa\}\}/g, lead.razao_social || lead.nome_fantasia || lead.company || '')
    .replace(/\{\{nome_usuario\}\}/g, userName)
    .replace(/\{\{nome_sdr\}\}/g, sdrName)
    .replace(/\{\{nome_closer\}\}/g, closerName)
    .replace(/\{\{cargo\}\}/g, '')
    .replace(/\{\{telefone\}\}/g, lead.phone || '');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const EmailComposeDialog = ({
  open,
  onOpenChange,
  lead,
  userName = '',
  sdrName = '',
  closerName = '',
  onSent,
}: EmailComposeDialogProps) => {
  const [toEmail, setToEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [bccEmail, setBccEmail] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [emailSignature, setEmailSignature] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);
  const { templates } = useEmailTemplates();
  const { sendEmail, isSending } = useSendEmail();
  const { data: systemUsers } = useSystemUsers();

  // Resolve SDR & Closer names from lead data if not provided via props
  const resolvedSdrName = sdrName || (() => {
    if (!lead.owner_user_id || !systemUsers) return '';
    const user = systemUsers.find((u: any) => u.id === lead.owner_user_id);
    return user?.name || '';
  })();

  const resolvedCloserName = closerName || (() => {
    // Closer info not directly on lead; fallback to empty
    return '';
  })();

  useEffect(() => {
    if (open) {
      setToEmail(lead.email || '');
      setCcEmail('');
      setBccEmail('');
      setShowCcBcc(false);
      setSubject('');
      setBody('');
      setSelectedTemplateId('none');
      setAttachments([]);

      // Fetch email signature
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase
            .from('profiles')
            .select('email_signature')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
              setEmailSignature((data as any)?.email_signature || null);
            });
        }
      });
    }
  }, [open, lead.email]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === 'none') return;
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSubject(replaceVariables(template.subject, lead, userName, resolvedSdrName, resolvedCloserName));
      setBody(replaceVariables(template.body, lead, userName, resolvedSdrName, resolvedCloserName));
      // Load template attachments as pre-uploaded
      const templateAttachments = (template as any).attachments || [];
      if (templateAttachments.length > 0) {
        const loaded: Attachment[] = templateAttachments.map((a: any) => ({
          file: new File([], a.name, { type: a.type }),
          path: a.path,
          uploading: false,
          uploaded: true,
        }));
        setAttachments(loaded);
      }
    }
  };

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

    const attachmentPaths = attachments
      .filter((a) => a.uploaded && a.path)
      .map((a) => ({ path: a.path!, name: a.file.name, type: a.file.type }));

    const finalSubject = replaceVariables(subject, lead, userName, resolvedSdrName, resolvedCloserName);
    const finalBody = replaceVariables(body, lead, userName, resolvedSdrName, resolvedCloserName);

    const result = await sendEmail({
      to_email: toEmail,
      cc_email: ccEmail || undefined,
      bcc_email: bccEmail || undefined,
      subject: finalSubject,
      body: finalBody,
      lead_id: lead.id,
      template_id: selectedTemplateId !== 'none' ? selectedTemplateId : undefined,
      attachments: attachmentPaths.length > 0 ? attachmentPaths : undefined,
    });
    if (result.success) {
      onOpenChange(false);
      onSent?.({ to: toEmail, subject: replaceVariables(subject, lead, userName, resolvedSdrName, resolvedCloserName), body: replaceVariables(body, lead, userName, resolvedSdrName, resolvedCloserName) });
    }
  };

  const isUploading = attachments.some((a) => a.uploading);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Enviar E-mail
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {templates.length > 0 && (
            <div>
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem template</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
              suggestions={(systemUsers || []).filter(u => u.email).map(u => ({ name: u.name, email: u.email! }))}
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

          {/* Available placeholders */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium">Variáveis:</span>
            {[
              { key: '{{nome_contato}}', label: 'Contato' },
              { key: '{{empresa}}', label: 'Empresa' },
              { key: '{{nome_sdr}}', label: 'SDR' },
              { key: '{{nome_closer}}', label: 'Closer' },
              { key: '{{nome_usuario}}', label: 'Seu nome' },
              { key: '{{telefone}}', label: 'Telefone' },
            ].map((v) => (
              <button
                key={v.key}
                type="button"
                className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 text-primary px-1.5 py-0.5 font-mono text-[11px] hover:bg-primary/20 transition-colors cursor-pointer"
                title={`${v.label} — clique para inserir`}
                onClick={() => {
                  if (editorRef.current) {
                    editorRef.current.chain().focus().insertContent(v.key).run();
                  } else {
                    navigator.clipboard.writeText(v.key);
                    toast.success(`"${v.key}" copiado!`);
                  }
                }}
              >
                {v.key}
              </button>
            ))}
          </div>

          <div className="flex-1">
            <Label>Corpo</Label>
            <RichTextEditor
              content={body}
              onChange={setBody}
              placeholder="Escreva sua mensagem..."
              editorRef={editorRef}
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
