import { useState, useMemo, useEffect } from 'react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Code2, ArrowLeft, Plus, Pencil, Trash2, FileSpreadsheet, Loader2, ToggleLeft, ToggleRight, Inbox, CopyPlus, Webhook, X, Settings, LayoutList, FileText, ExternalLink, Users, Bell, MessageCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForms, useFormSubmissions, Form } from '@/hooks/useForms';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import FormFieldBuilder, { type FieldConfig } from '@/components/admin/FormFieldBuilder';
import FormPreview from '@/components/admin/FormPreview';
import { PageHeader } from '@/components/PageHeader';

// Post Action Section Component
const PostActionSection = ({ editingForm, setEditingForm }: { editingForm: Partial<Form>; setEditingForm: (f: Partial<Form>) => void }) => {
  const { data: closers = [] } = useQuery({
    queryKey: ['closers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'closer');
      if (error || !data?.length) return [];
      const userIds = data.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds)
        .eq('active', true)
        .order('name');
      return profiles || [];
    },
  });

  const { data: sdrs = [] } = useQuery({
    queryKey: ['sdrs-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'sdr');
      if (error || !data?.length) return [];
      const userIds = data.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds)
        .eq('active', true)
        .order('name');
      return profiles || [];
    },
  });

  const postAction = (editingForm as any).post_action || 'sdr';
  const assignedSdrIds: string[] = (editingForm as any).assigned_sdr_ids || [];

  const toggleSdr = (sdrId: string) => {
    const newIds = assignedSdrIds.includes(sdrId)
      ? assignedSdrIds.filter(id => id !== sdrId)
      : [...assignedSdrIds, sdrId];
    setEditingForm({ ...editingForm, assigned_sdr_ids: newIds } as any);
  };

  return (
    <div className="space-y-3 pt-2">
      <div>
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Users className="h-4 w-4 text-primary" />
          Ação pós-envio
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Defina o destino do lead quando o formulário for preenchido.
        </p>
      </div>
      <Select
        value={postAction}
        onValueChange={(v) => setEditingForm({ ...editingForm, post_action: v, ...(v === 'sdr' ? { assigned_closer_id: null } : { assigned_sdr_ids: [] }) } as any)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sdr">Enviar para Pipeline SDR (padrão)</SelectItem>
          <SelectItem value="closer">Enviar para Pipeline Closer</SelectItem>
        </SelectContent>
      </Select>
      {postAction === 'sdr' && (
        <div className="space-y-2 pl-2 border-l-2 border-primary/30">
          <Label className="text-xs font-medium">SDRs responsáveis (rodízio)</Label>
          <p className="text-xs text-muted-foreground">
            Selecione os SDRs que receberão leads por rodízio. Se nenhum for selecionado, o lead ficará sem dono.
          </p>
          {sdrs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum SDR ativo encontrado.</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {sdrs.map((sdr: any) => (
                <label key={sdr.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                  <Checkbox
                    checked={assignedSdrIds.includes(sdr.id)}
                    onCheckedChange={() => toggleSdr(sdr.id)}
                  />
                  <span className="text-sm">{sdr.name}</span>
                </label>
              ))}
            </div>
          )}
          {assignedSdrIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {assignedSdrIds.length} SDR{assignedSdrIds.length > 1 ? 's' : ''} selecionado{assignedSdrIds.length > 1 ? 's' : ''} — distribuição por rodízio.
            </p>
          )}
        </div>
      )}
      {postAction === 'closer' && (
        <div className="space-y-1.5 pl-2 border-l-2 border-primary/30">
          <Label className="text-xs">Closer responsável</Label>
          <Select
            value={(editingForm as any).assigned_closer_id || ''}
            onValueChange={(v) => setEditingForm({ ...editingForm, assigned_closer_id: v } as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um closer" />
            </SelectTrigger>
            <SelectContent>
              {closers.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            O lead será criado como oportunidade no pipeline do closer selecionado.
          </p>
        </div>
      )}
    </div>
  );
};

// Notification Section Component
const NotificationSection = ({ editingForm, setEditingForm }: { editingForm: Partial<Form>; setEditingForm: (f: Partial<Form>) => void }) => {
  const notifyPush = (editingForm as any).notify_push ?? false;
  const notifyEmail = (editingForm as any).notify_email ?? false;
  const notifyUserIds: string[] = (editingForm as any).notify_user_ids || [];

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-active-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: notifyPush || notifyEmail,
  });

  const toggleUser = (userId: string) => {
    const newIds = notifyUserIds.includes(userId)
      ? notifyUserIds.filter(id => id !== userId)
      : [...notifyUserIds, userId];
    setEditingForm({ ...editingForm, notify_user_ids: newIds } as any);
  };

  const isEnabled = notifyPush || notifyEmail;

  return (
    <div className="space-y-3 pt-2">
      <div>
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Bell className="h-4 w-4 text-primary" />
          Notificações por resposta
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Notifique usuários selecionados sempre que um lead preencher este formulário.
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={notifyPush}
            onCheckedChange={(checked) => setEditingForm({ ...editingForm, notify_push: !!checked } as any)}
          />
          <span className="text-sm">Notificação push (no sistema)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={notifyEmail}
            onCheckedChange={(checked) => setEditingForm({ ...editingForm, notify_email: !!checked } as any)}
          />
          <span className="text-sm">Notificação por e-mail</span>
        </label>
      </div>

      {isEnabled && (
        <div className="space-y-2 pl-2 border-l-2 border-primary/30">
          <Label className="text-xs font-medium">Usuários a notificar</Label>
          <p className="text-xs text-muted-foreground">
            Selecione quem deve receber as notificações. Se nenhum for selecionado, todos os admins/managers serão notificados.
          </p>
          {allUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Carregando usuários...</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {allUsers.map((user: any) => (
                <label key={user.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                  <Checkbox
                    checked={notifyUserIds.includes(user.id)}
                    onCheckedChange={() => toggleUser(user.id)}
                  />
                  <span className="text-sm">{user.name}</span>
                  {user.email && <span className="text-xs text-muted-foreground">({user.email})</span>}
                </label>
              ))}
            </div>
          )}
          {notifyUserIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {notifyUserIds.length} usuário{notifyUserIds.length > 1 ? 's' : ''} selecionado{notifyUserIds.length > 1 ? 's' : ''}.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const EmbedFormPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isWhatsAppMode = searchParams.get('type') === 'whatsapp';
  const { forms, isLoading, createForm, updateForm, deleteForm } = useForms();
  const filteredForms = isWhatsAppMode
    ? forms.filter(f => (f as any).widget_type === 'whatsapp_widget')
    : forms;
  const [editingForm, setEditingForm] = useState<Partial<Form> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingSubmissionsFormId, setViewingSubmissionsFormId] = useState<string | null>(null);
  const [embedCodeFormId, setEmbedCodeFormId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null);
  const [deletingFormName, setDeletingFormName] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const openNewForm = () => {
    setEditingForm({
      name: '',
      description: '',
      fields: [],
      fields_schema: [],
      title: isWhatsAppMode ? 'Fale conosco pelo WhatsApp' : 'Entre em contato',
      subtitle: isWhatsAppMode ? 'Preencha o formulário e inicie uma conversa no WhatsApp.' : 'Preencha o formulário e entraremos em contato em breve.',
      button_text: isWhatsAppMode ? 'Iniciar conversa' : 'Enviar',
      success_message: 'Obrigado! Entraremos em contato em breve.',
      source: isWhatsAppMode ? 'Widget WhatsApp' : 'Formulário Web',
      primary_color: isWhatsAppMode ? '#25D366' : '#5739F8',
      redirect_url: '',
      show_recaptcha: false,
      widget_type: isWhatsAppMode ? 'whatsapp_widget' : 'form',
      whatsapp_number: null,
      whatsapp_message_template: null,
    });
    setIsDialogOpen(true);
  };

  const openEditForm = (form: Form) => {
    setEditingForm({ ...form });
    setIsDialogOpen(true);
  };

  const duplicateForm = async (form: Form) => {
    const payload: any = {
      name: `${form.name} (cópia)`,
      description: form.description,
      fields: form.fields,
      fields_schema: form.fields_schema,
      title: form.title,
      subtitle: form.subtitle,
      button_text: form.button_text,
      success_message: form.success_message,
      source: form.source,
      primary_color: form.primary_color,
      redirect_url: form.redirect_url,
      show_recaptcha: form.show_recaptcha,
      webhook_urls: form.webhook_urls || [],
    };
    await createForm.mutateAsync(payload as Form);
  };

  const saveForm = async () => {
    if (!editingForm?.name?.trim()) {
      toast.error('Nome do formulário é obrigatório');
      return;
    }
    const payload: any = {
      name: editingForm.name,
      description: editingForm.description,
      fields: editingForm.fields,
      fields_schema: editingForm.fields_schema,
      title: editingForm.title,
      subtitle: editingForm.subtitle,
      button_text: editingForm.button_text,
      success_message: editingForm.success_message,
      source: editingForm.source,
      primary_color: editingForm.primary_color,
      redirect_url: editingForm.redirect_url || null,
      show_recaptcha: editingForm.show_recaptcha ?? false,
      show_consent: (editingForm as any).show_consent ?? false,
      consent_url: (editingForm as any).consent_url || null,
      webhook_urls: ((editingForm as any).webhook_urls || []).filter((u: string) => u.trim()),
      post_action: (editingForm as any).post_action || 'sdr',
      assigned_closer_id: (editingForm as any).assigned_closer_id || null,
      assigned_sdr_ids: ((editingForm as any).assigned_sdr_ids || []).length > 0 ? (editingForm as any).assigned_sdr_ids : null,
      notify_push: (editingForm as any).notify_push ?? false,
      notify_email: (editingForm as any).notify_email ?? false,
      notify_user_ids: ((editingForm as any).notify_user_ids || []).length > 0 ? (editingForm as any).notify_user_ids : null,
      card_border_enabled: (editingForm as any).card_border_enabled ?? true,
      card_border_color: (editingForm as any).card_border_color || '#e5e7eb',
      card_border_width: (editingForm as any).card_border_width ?? 1,
      card_border_radius: (editingForm as any).card_border_radius ?? 12,
      card_bg_enabled: (editingForm as any).card_bg_enabled ?? true,
      card_bg_color: (editingForm as any).card_bg_color || '#ffffff',
      field_border_color: (editingForm as any).field_border_color || '#d1d5db',
      field_border_width: (editingForm as any).field_border_width ?? 1,
      field_bg_color: (editingForm as any).field_bg_color || '#ffffff',
      button_hover_bg_color: (editingForm as any).button_hover_bg_color || null,
      button_hover_text_color: (editingForm as any).button_hover_text_color || null,
      widget_type: (editingForm as any).widget_type || 'form',
      whatsapp_number: (editingForm as any).whatsapp_number || null,
      whatsapp_message_template: (editingForm as any).whatsapp_message_template || null,
    };
    if (editingForm.id) {
      await updateForm.mutateAsync({ id: editingForm.id, ...payload } as Form);
    } else {
      await createForm.mutateAsync(payload as Form);
    }
    // Modal permanece aberto após salvar
  };

  const handleFieldsSchemaChange = (schema: FieldConfig[]) => {
    if (!editingForm) return;
    setEditingForm({ ...editingForm, fields_schema: schema });
  };

  return (
    <>
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PageHeader
            icon={isWhatsAppMode ? <MessageCircle className="h-5 w-5" strokeWidth={1.5} /> : <Code2 className="h-5 w-5" strokeWidth={1.5} />}
            title={isWhatsAppMode ? 'Widget WhatsApp' : 'Formulários Embeddáveis'}
            subtitle={isWhatsAppMode ? 'Botões flutuantes de WhatsApp com captura de UTM e geração de leads' : 'Crie e gerencie formulários para captação de leads'}
            actions={
              <Button onClick={openNewForm}>
                <Plus className="h-4 w-4 mr-2" />
                {isWhatsAppMode ? 'Novo Widget' : 'Novo Formulário'}
              </Button>
            }
            className="pb-0 flex-1"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredForms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">{isWhatsAppMode ? 'Nenhum widget criado' : 'Nenhum formulário criado'}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isWhatsAppMode ? 'Crie seu primeiro widget de WhatsApp para captar leads.' : 'Crie seu primeiro formulário para começar a captar leads.'}
              </p>
              <Button onClick={openNewForm}>
                <Plus className="h-4 w-4 mr-2" />
                {isWhatsAppMode ? 'Criar Widget' : 'Criar Formulário'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredForms.map(form => (
              <Card key={form.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate">{form.name}</h3>
                      {(form as any).widget_type === 'whatsapp_widget' && (
                        <Badge variant="outline" className="text-xs gap-1 border-green-500/30 text-green-600">
                          <MessageCircle className="h-3 w-3" />
                          WhatsApp
                        </Badge>
                      )}
                      <Badge variant={form.active ? 'default' : 'secondary'}>
                        {form.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    {form.description && (
                      <p className="text-sm text-muted-foreground truncate">{form.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Fonte: {form.source} · {form.fields_schema?.length || form.fields?.length || 0} campos · Criado em {format(new Date(form.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="outline" size="sm" onClick={() => setViewingSubmissionsFormId(form.id)}>
                      <FileSpreadsheet className="h-4 w-4 mr-1" />
                      Respostas
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEmbedCodeFormId(form.id)}>
                      <Copy className="h-4 w-4 mr-1" />
                      Embed
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(`/form-preview?id=${form.id}`, '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Visualizar
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => updateForm.mutate({ id: form.id, active: !form.active } as Form)}>
                      {form.active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => duplicateForm(form)} title="Duplicar formulário">
                      <CopyPlus className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditForm(form)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeletingFormId(form.id);
                        setDeletingFormName(form.name);
                        setDeleteConfirmText('');
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Form Editor Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-[80vw] max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>{editingForm?.id ? 'Editar Formulário' : 'Novo Formulário'}</DialogTitle>
            </DialogHeader>
            {editingForm && (
              <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 max-h-[calc(90vh-120px)] overflow-hidden">
                {/* Builder side */}
                <div className="overflow-y-auto pr-2">
                  <Tabs defaultValue="dados" className="w-full">
                    <TabsList className="w-full mb-4">
                      <TabsTrigger value="dados" className="flex-1 gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Dados
                      </TabsTrigger>
                      <TabsTrigger value="itens" className="flex-1 gap-1.5">
                        <LayoutList className="h-3.5 w-3.5" />
                        Itens / Input
                      </TabsTrigger>
                      <TabsTrigger value="config" className="flex-1 gap-1.5">
                        <Settings className="h-3.5 w-3.5" />
                        Config
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab: Dados do Formulário */}
                    <TabsContent value="dados" className="space-y-5 mt-0">
                      {/* Bloco: Identificação */}
                      <div className="rounded-lg border border-border p-4 space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificação</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Nome do formulário *</Label>
                            <Input
                              value={editingForm.name || ''}
                              onChange={e => {
                                const newName = e.target.value;
                                const patch: any = { ...editingForm, name: newName };
                                if (!editingForm.description || editingForm.description === editingForm.name) {
                                  patch.description = newName;
                                }
                                setEditingForm(patch);
                              }}
                              placeholder="Ex: Formulário de Indicações"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Fonte (source)</Label>
                            <Input
                              value={editingForm.source || ''}
                              onChange={e => setEditingForm({ ...editingForm, source: e.target.value })}
                              placeholder="Ex: Landing Page"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Descrição interna</Label>
                          <Input
                            value={editingForm.description || ''}
                            disabled
                            className="bg-muted text-muted-foreground cursor-not-allowed"
                          />
                        </div>
                      </div>

                      {/* Bloco: Conteúdo */}
                      <div className="rounded-lg border border-border p-4 space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conteúdo</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Título</Label>
                            <Input
                              value={editingForm.title || ''}
                              onChange={e => setEditingForm({ ...editingForm, title: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Subtítulo</Label>
                            <Input
                              value={editingForm.subtitle || ''}
                              onChange={e => setEditingForm({ ...editingForm, subtitle: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Posição do subtítulo</Label>
                          <select
                            value={(editingForm as any).subtitle_align || 'center'}
                            onChange={e => setEditingForm({ ...editingForm, subtitle_align: e.target.value } as any)}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="left">Esquerda</option>
                            <option value="center">Centralizado</option>
                            <option value="right">Direita</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Mensagem de sucesso</Label>
                          <Input
                            value={editingForm.success_message || ''}
                            onChange={e => setEditingForm({ ...editingForm, success_message: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">URL de redirecionamento (após envio)</Label>
                          <Input
                            value={editingForm.redirect_url || ''}
                            onChange={e => setEditingForm({ ...editingForm, redirect_url: e.target.value })}
                            placeholder="https://www.exemplo.com.br/obrigado"
                            type="url"
                          />
                          <p className="text-xs text-muted-foreground">
                            Deixe em branco para mostrar a mensagem de sucesso padrão.
                          </p>
                        </div>
                        </div>

                        {/* Bloco: Estilo do Card */}
                        <div className="rounded-lg border border-border p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estilo do Card</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={(editingForm as any).card_border_enabled !== false}
                                  onCheckedChange={v => setEditingForm({ ...editingForm, card_border_enabled: !!v } as any)}
                                />
                                <Label className="text-xs">Exibir borda</Label>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={(editingForm as any).card_bg_enabled !== false}
                                  onCheckedChange={v => setEditingForm({ ...editingForm, card_bg_enabled: !!v } as any)}
                                />
                                <Label className="text-xs">Background</Label>
                              </div>
                            </div>
                          </div>
                          {(editingForm as any).card_border_enabled !== false && (
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Cor da borda</Label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={(editingForm as any).card_border_color || '#e5e7eb'}
                                    onChange={e => setEditingForm({ ...editingForm, card_border_color: e.target.value } as any)}
                                    className="h-9 w-10 rounded border border-input cursor-pointer"
                                  />
                                  <Input
                                    value={(editingForm as any).card_border_color || '#e5e7eb'}
                                    onChange={e => setEditingForm({ ...editingForm, card_border_color: e.target.value } as any)}
                                    className="flex-1 text-xs"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Espessura (px)</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={(editingForm as any).card_border_width || 1}
                                  onChange={e => setEditingForm({ ...editingForm, card_border_width: parseInt(e.target.value) || 1 } as any)}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Border Radius (px)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={50}
                                  value={(editingForm as any).card_border_radius ?? 12}
                                  onChange={e => setEditingForm({ ...editingForm, card_border_radius: parseInt(e.target.value) || 0 } as any)}
                                />
                              </div>
                            </div>
                          )}
                          {(editingForm as any).card_bg_enabled !== false && (
                            <div className="space-y-1.5">
                              <Label className="text-xs">Cor do background</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={(editingForm as any).card_bg_color || '#ffffff'}
                                  onChange={e => setEditingForm({ ...editingForm, card_bg_color: e.target.value } as any)}
                                  className="h-9 w-10 rounded border border-input cursor-pointer"
                                />
                                <Input
                                  value={(editingForm as any).card_bg_color || '#ffffff'}
                                  onChange={e => setEditingForm({ ...editingForm, card_bg_color: e.target.value } as any)}
                                  className="flex-1"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bloco: Estilo dos Campos */}
                        <div className="rounded-lg border border-border p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estilo dos Campos</h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Cor da borda</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={(editingForm as any).field_border_color || '#d1d5db'}
                                  onChange={e => setEditingForm({ ...editingForm, field_border_color: e.target.value } as any)}
                                  className="h-9 w-10 rounded border border-input cursor-pointer"
                                />
                                <Input
                                  value={(editingForm as any).field_border_color || '#d1d5db'}
                                  onChange={e => setEditingForm({ ...editingForm, field_border_color: e.target.value } as any)}
                                  className="flex-1 text-xs"
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Espessura (px)</Label>
                              <Input
                                type="number"
                                min={1}
                                max={5}
                                value={(editingForm as any).field_border_width || 1}
                                onChange={e => setEditingForm({ ...editingForm, field_border_width: parseInt(e.target.value) || 1 } as any)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Cor do fundo</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={(editingForm as any).field_bg_color || '#ffffff'}
                                  onChange={e => setEditingForm({ ...editingForm, field_bg_color: e.target.value } as any)}
                                  className="h-9 w-10 rounded border border-input cursor-pointer"
                                />
                                <Input
                                  value={(editingForm as any).field_bg_color || '#ffffff'}
                                  onChange={e => setEditingForm({ ...editingForm, field_bg_color: e.target.value } as any)}
                                  className="flex-1 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                      {/* Bloco: Botão */}
                      <div className="rounded-lg border border-border p-4 space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Botão</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Texto do botão</Label>
                            <Input
                              value={editingForm.button_text || ''}
                              onChange={e => setEditingForm({ ...editingForm, button_text: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Tamanho</Label>
                            <select
                              value={(editingForm as any).button_width || 'full'}
                              onChange={e => setEditingForm({ ...editingForm, button_width: e.target.value } as any)}
                              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="full">Largura total</option>
                              <option value="auto">Ajustar ao conteúdo</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Posição</Label>
                            <select
                              value={(editingForm as any).button_align || 'center'}
                              onChange={e => setEditingForm({ ...editingForm, button_align: e.target.value } as any)}
                              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="left">Esquerda</option>
                              <option value="center">Centralizado</option>
                              <option value="right">Direita</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Cor principal</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editingForm.primary_color || '#5739F8'}
                              onChange={e => setEditingForm({ ...editingForm, primary_color: e.target.value })}
                              className="h-9 w-12 rounded border border-input cursor-pointer"
                            />
                            <Input
                              value={editingForm.primary_color || ''}
                              onChange={e => setEditingForm({ ...editingForm, primary_color: e.target.value })}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Hover: cor de fundo</Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={(editingForm as any).button_hover_bg_color || editingForm.primary_color || '#5739F8'}
                                onChange={e => setEditingForm({ ...editingForm, button_hover_bg_color: e.target.value } as any)}
                                className="h-9 w-10 rounded border border-input cursor-pointer"
                              />
                              <Input
                                value={(editingForm as any).button_hover_bg_color || ''}
                                onChange={e => setEditingForm({ ...editingForm, button_hover_bg_color: e.target.value } as any)}
                                placeholder="Padrão: cor principal"
                                className="flex-1 text-xs"
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Hover: cor do texto</Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={(editingForm as any).button_hover_text_color || '#ffffff'}
                                onChange={e => setEditingForm({ ...editingForm, button_hover_text_color: e.target.value } as any)}
                                className="h-9 w-10 rounded border border-input cursor-pointer"
                              />
                              <Input
                                value={(editingForm as any).button_hover_text_color || ''}
                                onChange={e => setEditingForm({ ...editingForm, button_hover_text_color: e.target.value } as any)}
                                placeholder="Padrão: #ffffff"
                                className="flex-1 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Tab: Itens / Input */}
                    <TabsContent value="itens" className="mt-0">
                      <FormFieldBuilder
                        fields={editingForm.fields_schema || []}
                        onChange={handleFieldsSchemaChange}
                      />
                    </TabsContent>

                    {/* Tab: Config */}
                    <TabsContent value="config" className="space-y-4 mt-0">

                      {/* Tipo de Widget */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-1.5">
                          <MessageCircle className="h-4 w-4 text-primary" />
                          Tipo de formulário
                        </Label>
                        <Select
                          value={(editingForm as any).widget_type || 'form'}
                          onValueChange={(v) => setEditingForm({ ...editingForm, widget_type: v, ...(v === 'whatsapp_widget' ? { primary_color: '#25D366', button_text: 'Iniciar conversa', source: 'Widget WhatsApp' } : {}) } as any)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="form">Formulário padrão (embed)</SelectItem>
                            <SelectItem value="whatsapp_widget">Widget WhatsApp (botão flutuante)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(editingForm as any).widget_type === 'whatsapp_widget' && (
                        <div className="rounded-lg border border-green-500/20 bg-green-50/50 dark:bg-green-950/20 p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider">Configuração WhatsApp</h4>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Número do WhatsApp (com DDI)</Label>
                            <Input
                              value={(editingForm as any).whatsapp_number || ''}
                              onChange={e => setEditingForm({ ...editingForm, whatsapp_number: e.target.value } as any)}
                              placeholder="5511999999999"
                            />
                            <p className="text-[10px] text-muted-foreground">Formato: DDI + DDD + número (sem espaços ou traços)</p>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Mensagem pré-preenchida (opcional)</Label>
                            <Textarea
                              value={(editingForm as any).whatsapp_message_template || ''}
                              onChange={e => setEditingForm({ ...editingForm, whatsapp_message_template: e.target.value } as any)}
                              placeholder="Olá, sou {name}! Vim pelo site e gostaria de saber mais."
                              rows={3}
                            />
                            <p className="text-[10px] text-muted-foreground">Use {'{name}'}, {'{phone}'}, {'{email}'} etc. para substituir pelos dados do formulário.</p>
                          </div>
                        </div>
                      )}

                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={editingForm.show_recaptcha || false}
                          onCheckedChange={(checked) => setEditingForm({ ...editingForm, show_recaptcha: !!checked })}
                        />
                        <span className="text-sm">Mostrar reCAPTCHA no formulário</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={(editingForm as any).show_powered_by !== false}
                          onCheckedChange={(checked) => setEditingForm({ ...editingForm, show_powered_by: !!checked } as any)}
                        />
                        <span className="text-sm">Mostrar "Powered by EZ Soft"</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={(editingForm as any).show_consent || false}
                          onCheckedChange={(checked) => setEditingForm({ ...editingForm, show_consent: !!checked } as any)}
                        />
                        <span className="text-sm">Mostrar consentimento de uso de dados</span>
                      </label>

                      {(editingForm as any).show_consent && (
                        <div className="pl-6">
                          <Label className="text-xs text-muted-foreground">Link da política de privacidade (opcional)</Label>
                          <Input
                            placeholder="https://exemplo.com/politica-de-privacidade"
                            value={(editingForm as any).consent_url || ''}
                            onChange={(e) => setEditingForm({ ...editingForm, consent_url: e.target.value } as any)}
                            className="mt-1"
                          />
                        </div>
                      )}

                      {/* Ação pós-envio */}
                      <PostActionSection editingForm={editingForm} setEditingForm={setEditingForm} />

                      {/* Notificações por resposta */}
                      <NotificationSection editingForm={editingForm} setEditingForm={setEditingForm} />

                      {/* Webhooks */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                              <Webhook className="h-4 w-4 text-primary" />
                              Webhooks
                            </Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Envie os dados do formulário para URLs externas ao receber uma submissão.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              const current = (editingForm as any).webhook_urls || [];
                              setEditingForm({ ...editingForm, webhook_urls: [...current, ''] } as any);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Adicionar
                          </Button>
                        </div>

                        {((editingForm as any).webhook_urls || []).length === 0 && (
                          <p className="text-xs text-muted-foreground italic py-2">
                            Nenhum webhook configurado. Clique em "Adicionar" para enviar dados para uma URL externa.
                          </p>
                        )}

                        {((editingForm as any).webhook_urls || []).map((url: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Input
                              value={url}
                              onChange={e => {
                                const urls = [...((editingForm as any).webhook_urls || [])];
                                urls[idx] = e.target.value;
                                setEditingForm({ ...editingForm, webhook_urls: urls } as any);
                              }}
                              placeholder="https://hooks.example.com/webhook"
                              className="flex-1 text-sm font-mono"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0"
                              onClick={() => {
                                const urls = [...((editingForm as any).webhook_urls || [])];
                                urls.splice(idx, 1);
                                setEditingForm({ ...editingForm, webhook_urls: urls } as any);
                              }}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Embed & Preview link - only for saved forms */}
                      {editingForm.id && (
                        <div className="space-y-3 pt-2 border-t border-border">
                          <div>
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                              <Code2 className="h-4 w-4 text-primary" />
                              Código de incorporação
                            </Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Cole este código HTML no seu site para exibir o formulário.
                            </p>
                          </div>
                          <div className="relative">
                            <pre className="bg-background rounded-md p-3 pr-10 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all border border-border">
                              {`<script data-ez-form src="${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-form-embed?id=${editingForm.id}"></script>`}
                            </pre>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 h-7 w-7"
                              onClick={() => {
                                navigator.clipboard.writeText(`<script data-ez-form src="${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-form-embed?id=${editingForm.id}"></script>`);
                                toast.success('Código copiado!');
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => {
                              window.open(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-form-embed?id=${editingForm.id}&preview=1`, '_blank');
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Visualizar formulário como página
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Preview side */}
                <div className="hidden lg:block overflow-y-auto">
                  <FormPreview
                    title={editingForm.title || ''}
                    subtitle={editingForm.subtitle || ''}
                    buttonText={editingForm.button_text || 'Enviar'}
                    primaryColor={editingForm.primary_color || '#5739F8'}
                    fields={editingForm.fields_schema || []}
                    showRecaptcha={editingForm.show_recaptcha || false}
                    buttonWidth={(editingForm as any).button_width || 'full'}
                    buttonAlign={(editingForm as any).button_align || 'center'}
                    subtitleAlign={(editingForm as any).subtitle_align || 'center'}
                    showPoweredBy={(editingForm as any).show_powered_by !== false}
                    showConsent={(editingForm as any).show_consent || false}
                    consentUrl={(editingForm as any).consent_url || ''}
                    successMessage={editingForm.success_message || ''}
                    cardBorderEnabled={(editingForm as any).card_border_enabled !== false}
                    cardBorderColor={(editingForm as any).card_border_color || '#e5e7eb'}
                    cardBorderWidth={(editingForm as any).card_border_width || 1}
                    cardBorderRadius={(editingForm as any).card_border_radius ?? 12}
                    cardBgEnabled={(editingForm as any).card_bg_enabled !== false}
                    cardBgColor={(editingForm as any).card_bg_color || '#ffffff'}
                    fieldBorderColor={(editingForm as any).field_border_color || '#d1d5db'}
                    fieldBorderWidth={(editingForm as any).field_border_width || 1}
                    fieldBgColor={(editingForm as any).field_bg_color || '#ffffff'}
                    buttonHoverBgColor={(editingForm as any).button_hover_bg_color || undefined}
                    buttonHoverTextColor={(editingForm as any).button_hover_text_color || undefined}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveForm} disabled={createForm.isPending || updateForm.isPending}>
                {(createForm.isPending || updateForm.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Embed Code Dialog */}
        <EmbedCodeDialog formId={embedCodeFormId} onClose={() => setEmbedCodeFormId(null)} />

        {/* Submissions Dialog */}
        <SubmissionsDialog formId={viewingSubmissionsFormId} forms={forms} onClose={() => setViewingSubmissionsFormId(null)} />
      </div>
    </div>

    {/* Delete Confirmation Dialog */}
    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Excluir formulário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o formulário <strong>"{deletingFormName}"</strong> e todas as suas respostas? Esta ação não pode ser desfeita.
          </p>
          <div className="space-y-2">
            <Label className="text-sm">
              Digite <strong>DELETAR</strong> para confirmar:
            </Label>
            <Input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="DELETAR"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={deleteConfirmText !== 'DELETAR'}
            onClick={() => {
              if (deletingFormId) {
                deleteForm.mutate(deletingFormId);
                setIsDeleteDialogOpen(false);
              }
            }}
          >
            Excluir permanentemente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

const EmbedCodeDialog = ({ formId, onClose }: { formId: string | null; onClose: () => void }) => {
  const embedUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-form-embed`;
  const embedCode = formId ? `<script data-ez-form src="${embedUrl}?id=${formId}"></script>` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    toast.success('Código copiado!');
  };

  return (
    <Dialog open={!!formId} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Código de Embed</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Cole este código no HTML do seu site onde deseja exibir o formulário.
        </p>
        <Textarea value={embedCode} readOnly className="font-mono text-xs min-h-[80px] bg-muted/50" />
        <DialogFooter>
          <Button onClick={copyToClipboard}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar Código
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SubmissionsDialog = ({
  formId,
  forms,
  onClose,
}: {
  formId: string | null;
  forms: Form[];
  onClose: () => void;
}) => {
  const { submissions, isLoading, deleteSubmissions } = useFormSubmissions(formId);
  const form = forms.find(f => f.id === formId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Reset selection when dialog opens/closes
  useEffect(() => {
    setSelected(new Set());
  }, [formId]);

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === submissions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(submissions.map(s => s.id)));
    }
  };

  const handleDeleteSelected = () => {
    deleteSubmissions.mutate(Array.from(selected), {
      onSuccess: () => {
        setSelected(new Set());
        setIsDeleteOpen(false);
      },
    });
  };

  const allFieldKeys = useMemo(() => {
    const orderedKeys: string[] = [];
    if (form?.fields_schema) {
      form.fields_schema.forEach(f => {
        if (!orderedKeys.includes(f.id)) orderedKeys.push(f.id);
      });
    }
    submissions.forEach(s => {
      Object.keys(s.data || {}).forEach(k => {
        if (!orderedKeys.includes(k)) orderedKeys.push(k);
      });
    });
    return orderedKeys;
  }, [submissions, form]);

  const fieldLabels: Record<string, string> = useMemo(() => {
    const base: Record<string, string> = {
      name: 'Nome', email: 'E-mail', phone: 'Telefone', company: 'Empresa',
      cnpj: 'CNPJ', razao_social: 'Razão Social', nome_fantasia: 'Nome Fantasia',
      employee_count: 'Qtd. Funcionários', company_segment: 'Segmento da Empresa',
      website: 'Site', message: 'Mensagem', cargo: 'Cargo', segmento: 'Segmento',
      utm_source: 'UTM Source', utm_medium: 'UTM Medium', utm_campaign: 'UTM Campaign',
      utm_term: 'UTM Term', utm_content: 'UTM Content',
    };
    if (form?.fields_schema) {
      form.fields_schema.forEach(f => {
        base[f.id] = f.label;
      });
    }
    return base;
  }, [form]);

  const exportToExcel = () => {
    if (!submissions.length) return;
    const rows = submissions.map(s => {
      const row: Record<string, string> = {};
      row['Data'] = format(new Date(s.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR });
      allFieldKeys.forEach(k => {
        row[fieldLabels[k] || k] = s.data[k] || '';
      });
      row['Fonte'] = s.source || '';
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Respostas');
    XLSX.writeFile(wb, `respostas-${form?.name || 'formulario'}.xlsx`);
    toast.success('Excel exportado!');
  };

  return (
    <>
      <Dialog open={!!formId} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Respostas — {form?.name}</span>
              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <Button size="sm" variant="destructive" onClick={() => setIsDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Excluir ({selected.size})
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={exportToExcel} disabled={!submissions.length}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  Exportar Excel
                </Button>
              </div>
            </DialogTitle>
            <CardDescription>{submissions.length} resposta(s)</CardDescription>
          </DialogHeader>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-3" />
              <p>Nenhuma resposta ainda</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === submissions.length && submissions.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Data</TableHead>
                    {allFieldKeys.map(k => (
                      <TableHead key={k}>{fieldLabels[k] || k}</TableHead>
                    ))}
                    <TableHead>Fonte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map(sub => (
                    <TableRow key={sub.id} className={selected.has(sub.id) ? 'bg-muted/40' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(sub.id)}
                          onCheckedChange={() => toggleOne(sub.id)}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(sub.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </TableCell>
                      {allFieldKeys.map(k => (
                        <TableCell key={k} className="max-w-[200px] truncate">
                          {sub.data[k] || '-'}
                        </TableCell>
                      ))}
                      <TableCell>{sub.source || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Excluir respostas"
        description={`Tem certeza que deseja excluir ${selected.size} resposta(s)? Esta ação não pode ser desfeita.`}
        onConfirm={handleDeleteSelected}
        isDeleting={deleteSubmissions.isPending}
      />
    </>
  );
};

export default EmbedFormPage;
