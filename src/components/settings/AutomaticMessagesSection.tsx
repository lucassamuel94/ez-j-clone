import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MessageFormDialog, EMPTY_FORM, type FormData } from './automatic-messages/MessageFormDialog';
import { TestMessageDialog } from './automatic-messages/TestMessageDialog';

import { useTeams } from '@/hooks/useTeams';
import { useRoles } from '@/hooks/useRoles';
import { useSystemUsers } from '@/hooks/useSystemUsers';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Plus, Search, MessageSquare, Mail, Bell,
  Pencil, Copy, Trash2, Zap, Clock, Send, Sparkles, PlayCircle,
  LayoutGrid, List,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface AutomaticMessage {
  id: string;
  name: string;
  message_type: string;
  title: string;
  body: string;
  is_active: boolean;
  trigger_key: string | null;
  trigger_module: string | null;
  trigger_event: string | null;
  trigger_phase: string | null;
  trigger_stage: string | null;
  sender: string | null;
  schedule_type: string | null;
  schedule_time: string | null;
  schedule_day: number | null;
  channels: string[];
  target_type: string | null;
  target_departments: string[] | null;
  target_roles: string[] | null;
  target_user_ids: string[] | null;
  dynamic_recipients: string[] | null;
  ai_enabled: boolean;
  ai_prompt: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const CHANNEL_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  whatsapp: { icon: <MessageSquare className="h-3 w-3" />, label: 'WhatsApp', color: 'bg-success/10 text-success' },
  email: { icon: <Mail className="h-3 w-3" />, label: 'E-mail', color: 'bg-info/10 text-info' },
  push: { icon: <Bell className="h-3 w-3" />, label: 'Push', color: 'bg-primary/10 text-primary' },
};

const SCHEDULE_LABELS: Record<string, string> = {
  tempo_real: 'Tempo real',
  diario: 'Diário',
  dias_uteis: 'Dias úteis',
  semanal: 'Semanal',
  mensal: 'Mensal',
  manual: 'Manual',
};

const TARGET_LABELS: Record<string, string> = {
  all: 'Todos',
  department: 'Equipes',
  roles: 'Cargos',
  users: 'Usuários específicos',
  group: 'Grupo WhatsApp',
  dynamic: 'Dinâmico',
};

export function AutomaticMessagesSection() {
  const queryClient = useQueryClient();
  const { teams } = useTeams();
  const { roles } = useRoles();
  const { data: systemUsers = [] } = useSystemUsers();
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testMessage, setTestMessage] = useState<AutomaticMessage | null>(null);
  const [forceSendId, setForceSendId] = useState<string | null>(null);
  const [forceSending, setForceSending] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['automatic-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automatic_messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AutomaticMessage[];
    },
  });


  const saveMutation = useMutation({
    mutationFn: async (data: FormData & { id?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Não autenticado');

      const payload = {
        name: data.name,
        message_type: data.message_type,
        title: data.title,
        body: data.body,
        is_active: data.is_active,
        trigger_key: data.trigger_key || null,
        trigger_module: data.trigger_module || null,
        trigger_event: data.trigger_event || null,
        trigger_phase: data.trigger_phase || null,
        trigger_stage: data.trigger_stage || null,
        sender: data.target_type === 'group' && data.target_group_id ? `group:${data.target_group_id}` : null,
        schedule_type: data.schedule_type,
        schedule_time: data.schedule_time || null,
        schedule_day: data.schedule_day,
        channels: data.channels,
        target_type: data.target_type,
        target_departments: data.target_departments.length > 0 ? data.target_departments : null,
        target_roles: data.target_roles.length > 0 ? data.target_roles : null,
        target_user_ids: data.target_user_ids.length > 0 ? data.target_user_ids : null,
        dynamic_recipients: data.dynamic_recipients.length > 0 ? data.dynamic_recipients : null,
        ai_enabled: data.ai_enabled,
        ai_prompt: data.ai_enabled ? (data.ai_prompt || null) : null,
        webhook_urls: data.webhook_urls.filter(u => u.trim()) || [],
        created_by: session.user.id,
      };

      if (data.id) {
        const { error } = await supabase.from('automatic_messages').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('automatic_messages').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automatic-messages'] });
      setDialogOpen(false);
      toast.success(editingId ? 'Mensagem atualizada!' : 'Mensagem criada!');
    },
    onError: () => toast.error('Erro ao salvar mensagem'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('automatic_messages').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automatic-messages'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('automatic_messages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automatic-messages'] });
      setDeleteId(null);
      toast.success('Mensagem excluída');
    },
  });

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (msg: AutomaticMessage) => {
    setEditingId(msg.id);

    setForm({
      name: msg.name,
      message_type: msg.message_type,
      title: msg.title,
      body: msg.body,
      is_active: msg.is_active,
      trigger_key: msg.trigger_key ?? '',
      trigger_module: msg.trigger_module ?? '',
      trigger_event: msg.trigger_event ?? '',
      trigger_phase: msg.trigger_phase ?? '',
      trigger_stage: msg.trigger_stage ?? '',
      
      schedule_type: msg.schedule_type ?? 'tempo_real',
      schedule_time: msg.schedule_time ?? '',
      schedule_day: msg.schedule_day,
      channels: msg.channels ?? ['whatsapp'],
      target_type: msg.target_type ?? 'all',
      target_departments: msg.target_departments ?? [],
      target_roles: msg.target_roles ?? [],
      target_user_ids: msg.target_user_ids ?? [],
      target_group_id: (msg.sender?.startsWith('group:') ? msg.sender.replace('group:', '') : ''),
      dynamic_recipients: msg.dynamic_recipients ?? [],
      ai_enabled: msg.ai_enabled ?? false,
      ai_prompt: msg.ai_prompt ?? '',
      webhook_urls: ((msg as unknown as Record<string, unknown>).webhook_urls as string[]) ?? [],
    });
    setDialogOpen(true);
  };

  const duplicate = async (msg: AutomaticMessage) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { error } = await supabase.from('automatic_messages').insert({
      name: `${msg.name} (cópia)`,
      message_type: msg.message_type,
      title: msg.title,
      body: msg.body,
      is_active: false,
      trigger_key: msg.trigger_key,
      sender: msg.sender,
      schedule_type: msg.schedule_type,
      schedule_time: msg.schedule_time,
      schedule_day: msg.schedule_day,
      channels: msg.channels,
      target_type: msg.target_type,
      target_departments: msg.target_departments,
      target_roles: msg.target_roles,
      target_user_ids: msg.target_user_ids,
      created_by: session.user.id,
    });
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['automatic-messages'] });
      toast.success('Mensagem duplicada!');
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    
    if (!form.ai_enabled && !form.body.trim()) { toast.error('Corpo da mensagem é obrigatório'); return; }
    if (form.target_type === 'dynamic' && form.dynamic_recipients.length === 0) { toast.error('Selecione pelo menos um destinatário dinâmico'); return; }
    if (form.target_type === 'group' && !form.target_group_id) { toast.error('Selecione um grupo'); return; }

    // Duplicate trigger_key check for real-time messages
    if (form.schedule_type === 'tempo_real' && form.trigger_key) {
      const duplicates = messages.filter(m =>
        m.id !== editingId &&
        m.is_active &&
        m.trigger_key === form.trigger_key &&
        m.schedule_type === 'tempo_real'
      );
      if (duplicates.length > 0) {
        toast.warning(
          `Atenção: já existe ${duplicates.length} mensagem(ns) ativa(s) com o mesmo gatilho "${form.trigger_key}": ${duplicates.map(d => d.name).join(', ')}. Isso pode causar envios duplicados.`,
          { duration: 8000 }
        );
      }
    }

    saveMutation.mutate({ ...form, id: editingId ?? undefined });
  };



  const handleForceSend = async (messageId: string) => {
    setForceSending(true);
    try {
      const msg = messages.find(m => m.id === messageId);
      const { data, error } = await supabase.functions.invoke('trigger-automatic-message', {
        body: {
          trigger_key: msg?.trigger_key || 'manual_force',
          message_id: messageId,
          _trigger_source: 'manual_force',
        },
      });
      if (error) throw error;
      const sent = data?.results?.[0]?.sent_to?.length || 0;
      if (sent > 0) {
        toast.success(`Mensagem enviada para ${sent} destinatário${sent !== 1 ? 's' : ''}!`);
      } else {
        const firstError = data?.results?.[0]?.errors?.[0];
        toast.error(firstError || 'Nenhum destinatário encontrado');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao forçar envio');
    } finally {
      setForceSending(false);
      setForceSendId(null);
    }
  };

  const openTestDialog = (msg: AutomaticMessage) => {
    setTestMessage(msg);
    setTestDialogOpen(true);
  };

  const filtered = messages.filter(m => {
    if (channelFilter !== 'all' && !m.channels?.includes(channelFilter)) return false;
    if (search) {
      const s = search.toLowerCase();
      return m.name.toLowerCase().includes(s) || m.body.toLowerCase().includes(s) || (m.trigger_key ?? '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight font-display">Mensagens Automáticas</h1>
         <p className="text-sm text-muted-foreground mt-1">Configure mensagens enviadas automaticamente por gatilhos e agendamentos.</p>
        </div>
        <Button onClick={openNew} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Nova Mensagem
        </Button>
      </div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, conteúdo ou trigger..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="email">E-mail</SelectItem>
            <SelectItem value="push">Push</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border border-border rounded-md">
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-9 px-2.5 rounded-r-none', viewMode === 'cards' && 'bg-muted')}
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-9 px-2.5 rounded-l-none', viewMode === 'list' && 'bg-muted')}
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>


      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Send className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma mensagem automática encontrada.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openNew}>
            Criar primeira mensagem
          </Button>
        </div>
      ) : viewMode === 'list' ? (
        /* ── List View ── */
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[28px]" />
                <TableHead className="text-xs font-semibold">Nome</TableHead>
                <TableHead className="text-xs font-semibold">Canais</TableHead>
                <TableHead className="text-xs font-semibold">Agendamento</TableHead>
                <TableHead className="text-xs font-semibold">Destinatários</TableHead>
                
                <TableHead className="text-xs font-semibold text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((msg) => {
                return (
                  <TableRow
                    key={msg.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/40 transition-colors',
                      !msg.is_active && 'opacity-50'
                    )}
                    onClick={() => openEdit(msg)}
                  >
                    <TableCell className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={msg.is_active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: msg.id, is_active: checked })}
                        className="scale-[0.65]"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground">{msg.name}</span>
                        {msg.trigger_key && (
                          <span className="ml-2 text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {msg.trigger_key}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        {(msg.channels ?? []).map((ch) => {
                          const cfg = CHANNEL_CONFIG[ch];
                          if (!cfg) return null;
                          return (
                            <Badge key={ch} variant="secondary" className={cn('text-[10px] gap-1 px-1.5 py-0', cfg.color)}>
                              {cfg.icon} {cfg.label}
                            </Badge>
                          );
                        })}
                        {msg.ai_enabled && (
                          <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0 bg-warning/10 text-warning">
                            <Sparkles className="h-3 w-3" /> IA
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{SCHEDULE_LABELS[msg.schedule_type ?? 'tempo_real'] ?? msg.schedule_type}</span>
                        {msg.schedule_time && (
                          <span className="font-mono text-foreground">{msg.schedule_time}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-xs text-muted-foreground">
                        {TARGET_LABELS[msg.target_type ?? 'all'] ?? msg.target_type}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openTestDialog(msg)}>
                              <PlayCircle className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Testar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-warning hover:text-warning" onClick={() => setForceSendId(msg.id)}>
                              <Zap className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Forçar envio</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicate(msg)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Duplicar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(msg.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Excluir</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* ── Cards View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((msg) => (
            <ContextMenu key={msg.id}>
              <ContextMenuTrigger asChild>
                <div
                  onClick={() => openEdit(msg)}
                  className={cn(
                    'bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer',
                    !msg.is_active && 'opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground truncate">{msg.name}</h3>
                      {msg.trigger_key && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1 inline-block">
                          {msg.trigger_key}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={msg.is_active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: msg.id, is_active: checked })}
                        className="scale-75"
                      />
                    </div>
                  </div>

                  {/* Channels */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(msg.channels ?? []).map((ch) => {
                      const cfg = CHANNEL_CONFIG[ch];
                      if (!cfg) return null;
                      return (
                        <Badge key={ch} variant="secondary" className={cn('text-[10px] gap-1 px-1.5 py-0', cfg.color)}>
                          {cfg.icon} {cfg.label}
                        </Badge>
                      );
                    })}
                    {msg.ai_enabled && (
                      <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0 bg-warning/10 text-warning">
                        <Sparkles className="h-3 w-3" /> IA
                      </Badge>
                    )}
                  </div>

                  {/* Preview */}
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {msg.ai_enabled ? (msg.ai_prompt || '(sem prompt)') : (msg.body || '(sem conteúdo)')}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {SCHEDULE_LABELS[msg.schedule_type ?? 'tempo_real'] ?? msg.schedule_type}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" /> {TARGET_LABELS[msg.target_type ?? 'all'] ?? msg.target_type}
                    </span>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={(e) => { e.stopPropagation(); openTestDialog(msg); }}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Testar
                </ContextMenuItem>
                <ContextMenuItem onClick={() => openEdit(msg)}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </ContextMenuItem>
                <ContextMenuItem onClick={() => duplicate(msg)}>
                  <Copy className="h-4 w-4 mr-2" /> Duplicar
                </ContextMenuItem>
                <ContextMenuItem className="text-destructive" onClick={() => setDeleteId(msg.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <MessageFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        setForm={setForm}
        editingId={editingId}
        onSave={handleSave}
        onTest={editingId ? () => {
          const msg = messages.find(m => m.id === editingId);
          if (msg) openTestDialog(msg);
        } : undefined}
        onForceSend={editingId ? () => setForceSendId(editingId) : undefined}
        isSaving={saveMutation.isPending}
        teams={teams}
        roles={roles}
        systemUsers={systemUsers}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TestMessageDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        message={testMessage}
      />

      <AlertDialog open={!!forceSendId} onOpenChange={(open) => !open && setForceSendId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forçar envio agora?</AlertDialogTitle>
            <AlertDialogDescription>
              A mensagem será enviada imediatamente para todos os destinatários configurados, como se fosse o disparo real de produção.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={forceSending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => forceSendId && handleForceSend(forceSendId)}
              disabled={forceSending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              {forceSending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Zap className="h-3.5 w-3.5" />}
              Enviar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
