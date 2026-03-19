import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { PhoneInput } from '@/components/PhoneInput';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { ShieldCheck, Plus, Loader2, Building2, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { BrokerType } from '@/types/project';
import { useSystemUsers } from '@/hooks/useSystemUsers';
import { validateField } from '@/utils/fieldValidation';
import { useCnpjaSearch } from '@/hooks/useCnpjaSearch';
import { addBusinessDays } from '@/utils/businessDays';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FieldErrors = Record<string, string>;

/** Fetch user_ids grouped by display role name (roles table + user_roles.role_id) */
const useUsersByDisplayRole = () => {
  return useQuery({
    queryKey: ['users-by-display-role'],
    queryFn: async () => {
      // Fetch both tables in parallel since there's no FK relationship
      const [rolesRes, userRolesRes] = await Promise.all([
        supabase.from('roles').select('id, name'),
        supabase.from('user_roles').select('user_id, role_id'),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (userRolesRes.error) throw userRolesRes.error;

      const roleNameById = new Map<string, string>();
      for (const r of rolesRes.data || []) {
        roleNameById.set(r.id, r.name);
      }

      const map = new Map<string, Set<string>>();
      for (const row of (userRolesRes.data || []) as Array<{ user_id: string; role_id: string | null }>) {
        const roleName = row.role_id ? roleNameById.get(row.role_id) : null;
        if (!roleName) continue;
        if (!map.has(roleName)) map.set(roleName, new Set());
        map.get(roleName)!.add(row.user_id);
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export function NewBMVerificationDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { data: systemUsers = [] } = useSystemUsers();
  const { data: roleMap } = useUsersByDisplayRole();
  const { searchByCnpj, isSearching: isCnpjSearching } = useCnpjaSearch();
  const [saving, setSaving] = useState(false);

  // Filtered user lists
  const executivoUsers = useMemo(() => {
    if (!roleMap) return systemUsers;
    const closerIds = roleMap.get('Closer') || new Set();
    const adminIds = roleMap.get('Administrador') || new Set();
    const managerIds = roleMap.get('Gerente') || new Set();
    return systemUsers.filter(u => closerIds.has(u.id) || adminIds.has(u.id) || managerIds.has(u.id));
  }, [systemUsers, roleMap]);

  const verificacaoUsers = useMemo(() => {
    if (!roleMap) return [];
    const bmIds = roleMap.get('Verificação BM') || new Set();
    return systemUsers.filter(u => bmIds.has(u.id));
  }, [systemUsers, roleMap]);

  // Form fields
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [tipoCliente, setTipoCliente] = useState<'NOVO' | 'BASE' | ''>('');
  const [executivo, setExecutivo] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [site, setSite] = useState('');
  const [versaoPlataforma, setVersaoPlataforma] = useState<'VP' | 'V2' | ''>('');
  const [descricao, setDescricao] = useState('');
  const [broker, setBroker] = useState<BrokerType>('gupshup');
  const [teraCoexistencia, setTeraCoexistencia] = useState(false);
  const [numeroApiOficial, setNumeroApiOficial] = useState('');
  const [responsavelVerificacao, setResponsavelVerificacao] = useState('');

  // Validation state
  const [errors, setErrors] = useState<FieldErrors>({});
  const [cnpjFilled, setCnpjFilled] = useState(false);
  const cnpjTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const siteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (cnpjTimerRef.current) clearTimeout(cnpjTimerRef.current);
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
      if (siteTimerRef.current) clearTimeout(siteTimerRef.current);
    };
  }, []);

  const setError = useCallback((field: string, msg: string) => {
    setErrors(prev => ({ ...prev, [field]: msg }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // --- CNPJ handler with debounced API lookup ---
  const handleCnpjChange = useCallback((value: string) => {
    setCnpj(value);
    setCnpjFilled(false);

    const digits = value.replace(/\D/g, '');
    if (!digits) {
      clearError('cnpj');
      return;
    }

    const validationErr = validateField('cnpj', value);
    if (validationErr) {
      setError('cnpj', validationErr);
      return;
    }
    clearError('cnpj');

    // Debounce CNPJá API call (800ms after 14 digits)
    if (cnpjTimerRef.current) clearTimeout(cnpjTimerRef.current);
    if (digits.length === 14) {
      cnpjTimerRef.current = setTimeout(async () => {
        try {
          const results = await searchByCnpj(digits);
          if (results.length > 0) {
            const r = results[0];
            setRazaoSocial(prev => prev || r.razao_social || '');
            setTelefone(prev => prev || r.phone || '');
            setEmail(prev => prev || r.email || '');
            setSite(prev => prev || r.website || '');
            setCnpjFilled(true);
          }
        } catch {
          // silently fail – user can still fill manually
        }
      }, 800);
    }
  }, [searchByCnpj, setError, clearError]);

  // --- Phone validation (instant via PhoneInput) ---
  const handleTelefoneChange = useCallback((value: string) => {
    setTelefone(value);
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      clearError('telefone');
      return;
    }
    const err = validateField('phone', value);
    if (err) {
      setError('telefone', err);
    } else {
      clearError('telefone');
    }
  }, [setError, clearError]);

  // --- Email validation (debounced 500ms) ---
  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);
    if (!value.trim()) {
      clearError('email');
      return;
    }
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    emailTimerRef.current = setTimeout(() => {
      const err = validateField('email', value);
      if (err) {
        setError('email', err);
      } else {
        clearError('email');
      }
    }, 500);
  }, [setError, clearError]);

  // --- Site validation (debounced 500ms) ---
  const handleSiteChange = useCallback((value: string) => {
    setSite(value);
    if (!value.trim()) {
      clearError('site');
      return;
    }
    if (siteTimerRef.current) clearTimeout(siteTimerRef.current);
    siteTimerRef.current = setTimeout(() => {
      const err = validateField('url', value);
      if (err) {
        setError('site', err);
      } else {
        clearError('site');
      }
    }, 500);
  }, [setError, clearError]);

  const resetForm = () => {
    setCnpj('');
    setRazaoSocial('');
    setTipoCliente('');
    setExecutivo('');
    setResponsavel('');
    setTelefone('');
    setEmail('');
    setSite('');
    setVersaoPlataforma('');
    setDescricao('');
    setBroker('gupshup');
    setTeraCoexistencia(false);
    setNumeroApiOficial('');
    setResponsavelVerificacao('');
    setErrors({});
    setCnpjFilled(false);
  };

  const hasErrors = Object.values(errors).some(e => !!e);

  const isValid = () => {
    const phoneDigits = telefone.replace(/\D/g, '');
    return (
      !!cnpj.trim() &&
      !!razaoSocial.trim() &&
      !!responsavel.trim() &&
      phoneDigits.length >= 10 &&
      !!versaoPlataforma &&
      !!responsavelVerificacao &&
      !hasErrors
    );
  };

  const handleSubmit = async () => {
    if (!isValid()) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const now = new Date();
      const startDate = now.toISOString().split('T')[0];
      const dueDate = addBusinessDays(now, 10).toISOString().split('T')[0];

      const projectData = {
        project_type: 'api_oficial' as const,
        created_by_user_id: user.id,
        overall_status: 'ativo',
        priority: 'media',
        company_name: razaoSocial || cnpj,
        cnpj,
        contact_name: responsavel,
        contact_phone: telefone,
        contact_email: email,
        broker,
        has_coexistence: teraCoexistencia,
        activation_phone: numeroApiOficial,
        version: versaoPlataforma || null,
        head_user_id: user.id,
        start_date: startDate,
        due_date: dueDate,
        checklist_data: {
          type: 'api_oficial',
          cnpj,
          versao: versaoPlataforma,
          responsavel_nome: responsavel,
          responsavel_telefone: telefone,
          responsavel_email: email,
          broker,
          tera_coexistencia: teraCoexistencia,
          numero_api_oficial: numeroApiOficial,
        },
      };

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert(projectData as any)
        .select('id')
        .single();

      if (projectError) throw projectError;

      const projectId = project.id;

      const bmData = {
        cnpj,
        razao_social: razaoSocial,
        tipo_cliente: tipoCliente,
        executivo_user_id: executivo,
        executivo: executivoUsers.find(u => u.id === executivo)?.name ?? executivo,
        responsavel,
        telefone,
        email,
        site,
        versao_plataforma: versaoPlataforma,
        descricao,
        responsavel_verificacao: responsavelVerificacao,
      };

      await supabase.from('project_phases').insert({
        project_id: projectId,
        phase_name: 'verificacao_bm',
        status: 'BACKLOG',
        sort_order: 0,
        is_active: true,
        bm_data: bmData,
      } as any);

      await supabase.from('project_status_transitions').insert({
        project_id: projectId,
        phase_name: 'verificacao_bm',
        status: 'BACKLOG',
        entered_at: new Date().toISOString(),
        changed_by_user_id: user.id,
      } as any);

      await supabase
        .from('projects')
        .update({ current_phase: 'verificacao_bm' } as any)
        .eq('id', projectId);

      await supabase.from('project_activity_logs').insert({
        project_id: projectId,
        user_id: user.id,
        action_type: 'project_created',
        description: 'Verificação de BM criada (API Oficial)',
      } as any);

      // Trigger automatic messages for project creation
      supabase.functions.invoke('trigger-automatic-message', {
        body: { trigger_key: 'project_created', project_id: projectId },
      }).catch(console.error);

      toast.success('Verificação de BM criada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['phase-detail'] });
      queryClient.invalidateQueries({ queryKey: ['phase-project-counts'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      resetForm();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Erro ao criar verificação';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const fieldErrorClass = (field: string) =>
    errors[field] ? 'border-destructive focus-visible:ring-destructive' : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-primary/10">
               <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">Nova Verificação de BM</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Projeto tipo API Oficial</p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-6">
          <div className="space-y-5 pb-4">
            {/* Descrição */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Textarea
                placeholder="Descreva os detalhes desta verificação de BM..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="min-h-[80px] text-sm"
              />
            </div>

            <Separator />

            {/* Dados da Empresa */}
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" /> Dados da Empresa
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">CNPJ <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      placeholder="00.000.000/0000-00"
                      value={cnpj}
                      onChange={(e) => handleCnpjChange(e.target.value)}
                      className={`h-9 text-sm pr-8 ${fieldErrorClass('cnpj')}`}
                    />
                    {isCnpjSearching && (
                      <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {cnpjFilled && !isCnpjSearching && !errors.cnpj && (
                      <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-success" />
                    )}
                  </div>
                  {errors.cnpj && <p className="text-xs text-destructive">{errors.cnpj}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Razão Social <span className="text-destructive">*</span></Label>
                  <Input placeholder="Razão social da empresa" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tipo de Cliente</Label>
                  <Select value={tipoCliente} onValueChange={(v) => setTipoCliente(v as 'NOVO' | 'BASE')}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOVO">Novo</SelectItem>
                      <SelectItem value="BASE">Base</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Executivo</Label>
                  <Select value={executivo} onValueChange={setExecutivo}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione o executivo..." /></SelectTrigger>
                    <SelectContent>
                      {executivoUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium">Responsável pela verificação <span className="text-destructive">*</span></Label>
                  <Select value={responsavelVerificacao} onValueChange={setResponsavelVerificacao}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione o responsável..." /></SelectTrigger>
                    <SelectContent>
                      {verificacaoUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {verificacaoUsers.length === 0 && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      Nenhum usuário com role "Verificação BM" cadastrado.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Dados do Contato */}
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Dados do Contato
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Responsável <span className="text-destructive">*</span></Label>
                  <Input placeholder="Nome do responsável" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Telefone <span className="text-destructive">*</span></Label>
                  <PhoneInput
                    value={telefone}
                    onChange={handleTelefoneChange}
                    className={errors.telefone ? 'border border-destructive rounded-md' : ''}
                  />
                  {errors.telefone && <p className="text-xs text-destructive">{errors.telefone}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">E-mail</Label>
                  <Input
                    type="email"
                    placeholder="email@empresa.com"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className={`h-9 text-sm ${fieldErrorClass('email')}`}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Site</Label>
                  <Input
                    placeholder="www.empresa.com.br"
                    value={site}
                    onChange={(e) => handleSiteChange(e.target.value)}
                    className={`h-9 text-sm ${fieldErrorClass('site')}`}
                  />
                  {errors.site && <p className="text-xs text-destructive">{errors.site}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Versão da Plataforma <span className="text-destructive">*</span></Label>
                  <Select value={versaoPlataforma} onValueChange={(v) => setVersaoPlataforma(v as 'VP' | 'V2')}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VP">VP</SelectItem>
                      <SelectItem value="V2">V2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Dados API Oficial */}
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" /> API Oficial
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Broker</Label>
                  <Select value={broker} onValueChange={(v) => setBroker(v as BrokerType)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gupshup">Gupshup</SelectItem>
                      <SelectItem value="hyperflow">HyperFlow</SelectItem>
                      <SelectItem value="ez">EZ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Número para API Oficial</Label>
                  <PhoneInput value={numeroApiOficial} onChange={setNumeroApiOficial} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Terá Coexistência?</Label>
                <Switch checked={teraCoexistencia} onCheckedChange={setTeraCoexistencia} />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6 pt-2 border-t border-border/40">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!isValid() || saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Criar Verificação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
