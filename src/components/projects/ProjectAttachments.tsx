import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { toast } from 'sonner';
import { Upload, FileText, Trash2, Loader2, Download, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectAttachmentsProps {
  projectId: string;
  canEdit: boolean;
}

const fetchAttachments = async (projectId: string) => {
  const { data, error } = await supabase
    .from('project_attachments')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function ProjectAttachments({ projectId, canEdit }: ProjectAttachmentsProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingAttachment, setDeletingAttachment] = useState<{ id: string; file_path: string; file_name: string } | null>(null);

  const { data: attachments, isLoading } = useQuery({
    queryKey: ['project-attachments', projectId],
    queryFn: () => fetchAttachments(projectId),
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachment: { id: string; file_path: string }) => {
      await supabase.storage.from('project-attachments').remove([attachment.file_path]);
      const { error } = await supabase.from('project_attachments').delete().eq('id', attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-attachments', projectId] });
      toast.success('Arquivo removido');
    },
    onError: () => toast.error('Erro ao remover arquivo'),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${projectId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('project-attachments').upload(path, file);
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from('project_attachments').insert({
          project_id: projectId, file_name: file.name, file_path: path,
          file_size: file.size, content_type: file.type, uploaded_by: user.id,
        } as any);
        if (insertError) throw insertError;
      }
      queryClient.invalidateQueries({ queryKey: ['project-attachments', projectId] });
      toast.success('Arquivo(s) enviado(s)');
    } catch {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from('project-attachments').createSignedUrl(filePath, 3600);
    if (error) {
      toast.error('Erro ao gerar link de download');
      return;
    }
    if (data?.signedUrl) {
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = fileName;
      a.target = '_blank';
      a.click();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip className="h-3 w-3 text-muted-foreground" /> Anexos
        </h3>
        {canEdit && (
          <>
            <input ref={fileInputRef} type="file" multiple onChange={handleUpload} className="hidden" />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Enviar
            </Button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : !attachments?.length ? (
        <div
          className={cn(
            'flex items-center gap-3 py-3 px-4 rounded-lg border border-dashed border-border/40 bg-card/50 dark:bg-muted/5',
            canEdit && 'cursor-pointer hover:border-primary/30 hover:bg-card dark:hover:bg-primary/[0.02] transition-colors',
          )}
          onClick={() => canEdit && fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground/40">Nenhum anexo</p>
          </div>
          {canEdit && (
            <span className="text-[10px] text-primary font-medium flex-shrink-0">Upload</span>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {attachments.map((att: any) => (
            <div key={att.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted/30 transition-colors group min-w-0 overflow-hidden">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{att.file_name}</p>
                <p className="text-[10px] text-muted-foreground">{formatFileSize(att.file_size)}</p>
              </div>
              <Button
                variant="ghost" size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDownload(att.file_path, att.file_name)}
              >
                <Download className="h-3 w-3" />
              </Button>
              {canEdit && (
                <Button
                  variant="ghost" size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                  onClick={() => setDeletingAttachment({ id: att.id, file_path: att.file_path, file_name: att.file_name })}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <ConfirmDeleteDialog
        open={!!deletingAttachment}
        onOpenChange={(open) => !open && setDeletingAttachment(null)}
        title="Excluir arquivo"
        description={`Tem certeza que deseja excluir "${deletingAttachment?.file_name}"? Esta ação não pode ser desfeita.`}
        onConfirm={() => {
          if (deletingAttachment) {
            deleteMutation.mutate({ id: deletingAttachment.id, file_path: deletingAttachment.file_path }, {
              onSuccess: () => setDeletingAttachment(null),
            });
          }
        }}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
