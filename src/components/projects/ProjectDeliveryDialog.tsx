import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { PROJECT_TYPE_LABELS, ProjectType } from '@/types/project';
import { toast } from 'sonner';
import { Loader2, Building2, Link as LinkIcon, Plug, MessageSquare, User, Code, BarChart3, FileText, Plus, X } from 'lucide-react';
import { IntegrationNameInput } from './IntegrationNameInput';

interface ProjectDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Record<string, any>;
  onDelivered: () => void;
}

export function ProjectDeliveryDialog({ open, onOpenChange, project, onDelivered }: ProjectDeliveryDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [adminLink, setAdminLink] = useState('');
  const [hasIntegration, setHasIntegration] = useState(false);
  const [integrationsList, setIntegrationsList] = useState<{ name: string; description: string }[]>([]);
  const [observations, setObservations] = useState('');
  const [uxResponsible, setUxResponsible] = useState('');
  const [projectTypeLabel, setProjectTypeLabel] = useState('');
  const [usesGpt, setUsesGpt] = useState(false);
  const [version, setVersion] = useState('');
  const [complexityLevel, setComplexityLevel] = useState('');
  const [closerName, setCloserName] = useState('');

  // Pre-fill from project data
  useEffect(() => {
    if (!open || !project) return;

    setHasIntegration(project.has_integration ?? false);
    setUsesGpt(project.has_ai ?? false);
    setVersion(project.version || '');
    setComplexityLevel(project.complexity_level || '');
    setProjectTypeLabel(PROJECT_TYPE_LABELS[project.project_type as ProjectType] || project.project_type || '');
    setIntegrationsList(project.integrations_description ?
      project.integrations_description.split(/[,\n]+/).filter(Boolean).map((s: string) => ({ name: s.trim(), description: '' })) :
      []);
    // Fetch UX and Closer names from profiles
    const fetchNames = async () => {
      const ids = [project.ux_po_user_id, project.closer_user_id].filter(Boolean);
      if (ids.length === 0) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', ids);

      if (data) {
        const ux = data.find((u: any) => u.id === project.ux_po_user_id);
        const closer = data.find((u: any) => u.id === project.closer_user_id);
        if (ux) setUxResponsible(ux.name);
        if (closer) setCloserName(closer.name);
      }
    };

    fetchNames();
  }, [open, project]);

  const handleSubmit = async () => {
    if (!adminLink.trim()) {
      toast.error('O link do admin é obrigatório');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Insert delivery record
      const { data: delivery, error: deliveryError } = await supabase
        .from('project_deliveries')
        .insert({
          project_id: project.id,
          submitted_by: user.id,
          admin_link: adminLink.trim(),
          has_integration: hasIntegration,
          is_new_integration: integrationsList.some((i) => i.name.trim()),
          observations: observations.trim() || null,
          ux_responsible: uxResponsible || null,
          project_type_label: projectTypeLabel || null,
          uses_gpt: usesGpt,
          version: version || null,
          complexity_level: complexityLevel || null,
          closer_name: closerName || null,
          company_name: project.company_name || null,
          cnpj: project.cnpj || null,
        } as any)
        .select('id')
        .single();

      if (deliveryError) throw deliveryError;

      // Insert integrations individually
      if (hasIntegration && integrationsList.length > 0) {
        const validIntegrations = integrationsList.filter((i) => i.name.trim());
        if (validIntegrations.length > 0) {
          const rows = validIntegrations.map((item) => ({
            project_id: project.id,
            delivery_id: delivery.id,
            integration_name: item.name.trim(),
            notes: item.description.trim() || null,
            is_new: false,
          }));

          const { error: intError } = await supabase
            .from('project_integrations')
            .insert(rows as any);

          if (intError) throw intError;
        }
      }

      // Log activity
      await supabase.from('project_activity_logs').insert({
        project_id: project.id,
        user_id: user.id,
        action_type: 'delivery_submitted',
        description: `Formulário de entrega preenchido. Link: ${adminLink.trim()}`,
      } as any);

      toast.success('Entrega registrada com sucesso!');
      onDelivered();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao registrar entrega');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/30">
          <DialogTitle className="text-lg font-bold text-foreground">
            Formulário de Entrega do Projeto
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Preencha os dados da entrega antes de concluir o projeto.
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-5 space-y-5">
            {/* Read-only section */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados do Projeto</span>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Razão Social
                  </Label>
                  <Input value={project.company_name || ''} disabled className="h-9 bg-muted/30 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> CNPJ
                  </Label>
                  <Input value={project.cnpj || ''} disabled className="h-9 bg-muted/30 text-sm" />
                </div>
              </div>
            </div>

            <Separator className="bg-border/20" />

            {/* Admin Link */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5" /> Link do Admin <span className="text-destructive">*</span>
              </Label>
              <Input
                value={adminLink}
                onChange={(e) => setAdminLink(e.target.value)}
                placeholder="https://admin.exemplo.com"
                className="h-9 text-sm"
              />
            </div>

            <Separator className="bg-border/20" />

            {/* Integration section */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Integrações</span>

              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-1.5">
                  <Plug className="h-3.5 w-3.5" /> Possui integração?
                </Label>
                <Switch checked={hasIntegration} onCheckedChange={setHasIntegration} />
              </div>

              {hasIntegration && (
                <div className="space-y-2">
                  {integrationsList.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <IntegrationNameInput
                          value={item.name}
                          onChange={(val) => {
                            const updated = [...integrationsList];
                            updated[idx] = { ...updated[idx], name: val };
                            setIntegrationsList(updated);
                          }}
                        />
                        <Input
                          value={item.description}
                          onChange={(e) => {
                            const updated = [...integrationsList];
                            updated[idx] = { ...updated[idx], description: e.target.value };
                            setIntegrationsList(updated);
                          }}
                          placeholder="Função / descrição"
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setIntegrationsList(integrationsList.filter((_, i) => i !== idx))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setIntegrationsList([...integrationsList, { name: '', description: '' }])}
                  >
                    <Plus className="h-3 w-3" /> Adicionar integração
                  </Button>
                </div>
              )}
            </div>

            <Separator className="bg-border/20" />

            {/* Pre-filled fields */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informações Pré-preenchidas</span>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> UX Responsável
                  </Label>
                  <Input
                    value={uxResponsible}
                    onChange={(e) => setUxResponsible(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Tipo
                  </Label>
                  <Input
                    value={projectTypeLabel}
                    onChange={(e) => setProjectTypeLabel(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Code className="h-3.5 w-3.5" /> Versão
                  </Label>
                  <Input
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Closer
                  </Label>
                  <Input
                    value={closerName}
                    onChange={(e) => setCloserName(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Cliente usa GPT?
                  </Label>
                  <Switch checked={usesGpt} onCheckedChange={setUsesGpt} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" /> Nível (complexidade)
                  </Label>
                  <Select value={complexityLevel} onValueChange={setComplexityLevel}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baixo">Baixo</SelectItem>
                      <SelectItem value="Medio">Médio</SelectItem>
                      <SelectItem value="Alto">Alto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator className="bg-border/20" />

            {/* Observations */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Observações</Label>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Observações gerais sobre a entrega..."
                className="min-h-[80px] text-sm"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border/30">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Registrar Entrega e Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
