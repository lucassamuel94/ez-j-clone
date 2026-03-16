import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Mail, Loader2, Paperclip, X, FileIcon, Users } from 'lucide-react';
import { useEmailTemplates, EmailTemplate } from '@/hooks/useEmailTemplates';
import { RichTextEditor } from '@/components/RichTextEditor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTeams } from '@/hooks/useTeams';

interface TemplateAttachment {
  path: string;
  name: string;
  type: string;
  size: number;
}

interface PendingAttachment {
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

export const EmailTemplatesManager = () => {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useEmailTemplates();
  const { teams } = useTeams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [allTeamsSelected, setAllTeamsSelected] = useState(false);
  const [savedAttachments, setSavedAttachments] = useState<TemplateAttachment[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);

  const handleOpen = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setName(template.name);
      setSubject(template.subject);
      setBody(template.body);
      setSavedAttachments((template as any).attachments || []);
      const tids = template.team_ids || [];
      // If no teams assigned, means "all teams"
      if (tids.length === 0) {
        setAllTeamsSelected(true);
        setSelectedTeamIds([]);
      } else {
        setAllTeamsSelected(false);
        setSelectedTeamIds(tids);
      }
    } else {
      setEditingTemplate(null);
      setName('');
      setSubject('');
      setBody('');
      setSavedAttachments([]);
      setAllTeamsSelected(true);
      setSelectedTeamIds([]);
    }
    setPendingAttachments([]);
    setDialogOpen(true);
  };

  const handleToggleAllTeams = (checked: boolean) => {
    setAllTeamsSelected(checked);
    if (checked) {
      setSelectedTeamIds([]);
    }
  };

  const handleToggleTeam = (teamId: string, checked: boolean) => {
    if (checked) {
      setSelectedTeamIds(prev => [...prev, teamId]);
    } else {
      setSelectedTeamIds(prev => prev.filter(id => id !== teamId));
    }
    setAllTeamsSelected(false);
  };

  const handleSave = async () => {
    if (!name || !subject || !body) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (!allTeamsSelected && selectedTeamIds.length === 0) {
      toast.error('Selecione ao menos uma equipe');
      return;
    }
    if (pendingAttachments.some(a => a.uploading)) {
      toast.error('Aguarde o upload dos anexos terminar');
      return;
    }

    const allAttachments = [
      ...savedAttachments,
      ...pendingAttachments
        .filter(a => a.uploaded && a.path)
        .map(a => ({ path: a.path!, name: a.file.name, type: a.file.type, size: a.file.size })),
    ];

    // If all teams selected, we store empty array (means available to all)
    const teamIdsToSave = allTeamsSelected ? [] : selectedTeamIds;

    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          name,
          subject,
          body,
          attachments: allAttachments,
          team_ids: teamIdsToSave,
        } as any);
        toast.success('Template atualizado');
      } else {
        await createTemplate.mutateAsync({
          name,
          subject,
          body,
          attachments: allAttachments,
          team_ids: teamIdsToSave,
        } as any);
        toast.success('Template criado');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Erro ao salvar template');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success('Template removido');
    } catch {
      toast.error('Erro ao remover template');
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

    const newAttachments: PendingAttachment[] = validFiles.map((file) => ({
      file,
      uploading: true,
      uploaded: false,
    }));
    setPendingAttachments((prev) => [...prev, ...newAttachments]);

    for (const att of newAttachments) {
      const file = att.file;
      const filePath = `${user.id}/templates/${crypto.randomUUID()}_${file.name}`;

      const { error } = await supabase.storage
        .from('email-attachments')
        .upload(filePath, file);

      if (error) {
        toast.error(`Erro ao enviar ${file.name}`);
        setPendingAttachments((prev) => prev.filter((a) => a.file !== file));
      } else {
        setPendingAttachments((prev) =>
          prev.map((a) =>
            a.file === file ? { ...a, path: filePath, uploading: false, uploaded: true } : a
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

  const removeSavedAttachment = (idx: number) => {
    setSavedAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const removePendingAttachment = async (att: PendingAttachment) => {
    if (att.path) {
      await supabase.storage.from('email-attachments').remove([att.path]);
    }
    setPendingAttachments((prev) => prev.filter((a) => a !== att));
  };

  const variables = [
    { var: '{{nome_contato}}', desc: 'Nome do contato' },
    { var: '{{empresa}}', desc: 'Nome da empresa' },
    { var: '{{nome_sdr}}', desc: 'Nome do SDR' },
    { var: '{{nome_closer}}', desc: 'Nome do Closer' },
    { var: '{{nome_usuario}}', desc: 'Seu nome (autor do e-mail)' },
    { var: '{{telefone}}', desc: 'Telefone do lead' },
  ];

  const isUploading = pendingAttachments.some((a) => a.uploading);
  const totalAttachments = savedAttachments.length + pendingAttachments.length;

  // Build a map of team names for display
  const teamNameMap = (teams || []).reduce((acc: Record<string, string>, t: any) => {
    acc[t.id] = t.name;
    return acc;
  }, {});

  const getTeamLabel = (template: EmailTemplate) => {
    const tids = template.team_ids || [];
    if (tids.length === 0) return 'Todas';
    if (tids.length === 1) return teamNameMap[tids[0]] || '1 equipe';
    return `${tids.length} equipes`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Templates de E-mail
          </CardTitle>
          <CardDescription>
            Gerencie templates reutilizáveis para envio de e-mails.
          </CardDescription>
        </div>
        <Button onClick={() => handleOpen()} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Template
        </Button>
      </CardHeader>
      <CardContent>
        {/* Variables reference */}
        <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Variáveis disponíveis:</p>
          <div className="flex flex-wrap gap-2">
            {variables.map((v) => (
              <span key={v.var} className="inline-flex items-center gap-1 text-xs rounded-md border border-border bg-background px-2 py-1">
                <code className="font-mono text-primary font-medium">{v.var}</code>
                <span className="text-muted-foreground">= {v.desc}</span>
              </span>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum template cadastrado.
          </p>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <div key={t.id} className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{t.name}</p>
                    {((t as any).attachments?.length > 0) && (
                      <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">
                        <Paperclip className="h-3 w-3 mr-0.5" />
                        {(t as any).attachments.length}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] h-5">
                      <Users className="h-3 w-3 mr-0.5" />
                      {getTeamLabel(t)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Assunto: {t.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.body.replace(/<[^>]*>/g, '')}</p>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpen(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog — large */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-y-auto px-1">
            <div>
              <Label>Nome do template</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Primeiro contato" />
            </div>
            <div>
              <Label>Assunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: {{empresa}} - Apresentação EZSoft" />
            </div>

            {/* Team selector */}
            <div>
              <Label className="flex items-center gap-1.5 mb-2">
                <Users className="h-4 w-4" />
                Equipes com acesso
              </Label>
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="all-teams"
                    checked={allTeamsSelected}
                    onCheckedChange={(checked) => handleToggleAllTeams(!!checked)}
                  />
                  <label htmlFor="all-teams" className="text-sm font-medium cursor-pointer">
                    Todas as equipes
                  </label>
                </div>
                {(teams || []).length > 0 && (
                  <div className="ml-1 pl-4 border-l border-border space-y-1.5">
                    {(teams || []).map((team: any) => (
                      <div key={team.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`team-${team.id}`}
                          checked={allTeamsSelected || selectedTeamIds.includes(team.id)}
                          disabled={allTeamsSelected}
                          onCheckedChange={(checked) => handleToggleTeam(team.id, !!checked)}
                        />
                        <label
                          htmlFor={`team-${team.id}`}
                          className={`text-sm cursor-pointer ${allTeamsSelected ? 'text-muted-foreground' : ''}`}
                        >
                          {team.name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                {(teams || []).length === 0 && (
                  <p className="text-xs text-muted-foreground ml-6">Nenhuma equipe cadastrada.</p>
                )}
              </div>
            </div>

            {/* Clickable variables */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium">Variáveis:</span>
              {variables.map((v) => (
                <button
                  key={v.var}
                  type="button"
                  className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 text-primary px-1.5 py-0.5 font-mono text-[11px] hover:bg-primary/20 transition-colors cursor-pointer"
                  title={`${v.desc} — clique para inserir`}
                  onClick={() => {
                    if (editorRef.current) {
                      editorRef.current.chain().focus().insertContent(v.var).run();
                    } else {
                      navigator.clipboard.writeText(v.var);
                      toast.success(`"${v.var}" copiado!`);
                    }
                  }}
                >
                  {v.var}
                </button>
              ))}
            </div>

            <div className="flex-1">
              <Label>Corpo do e-mail</Label>
              <RichTextEditor
                content={body}
                onChange={setBody}
                placeholder="Olá {{nome_contato}}, ..."
                editorRef={editorRef}
              />
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
                {totalAttachments > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {totalAttachments} arquivo{totalAttachments > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {(savedAttachments.length > 0 || pendingAttachments.length > 0) && (
                <div className="mt-2 space-y-1">
                  {savedAttachments.map((att, idx) => (
                    <div
                      key={`saved-${idx}`}
                      className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm"
                    >
                      <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{att.name}</span>
                      {att.size && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatFileSize(att.size)}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeSavedAttachment(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {pendingAttachments.map((att, idx) => (
                    <div
                      key={`pending-${idx}`}
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
                        onClick={() => removePendingAttachment(att)}
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={createTemplate.isPending || updateTemplate.isPending || isUploading}
            >
              {(createTemplate.isPending || updateTemplate.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
