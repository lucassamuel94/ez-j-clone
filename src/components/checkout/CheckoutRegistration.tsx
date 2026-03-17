import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, User, CreditCard, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCnpjaSearch } from '@/hooks/useCnpjaSearch';
import CheckoutStepper from './CheckoutStepper';

// ── masks ──────────────────────────────────────────────
const maskCnpj = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const maskCep = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.replace(/(\d{5})(\d)/, '$1-$2');
};

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
};

// ── validation ─────────────────────────────────────────
const schema = z.object({
  cnpj: z.string().min(18, 'CNPJ inválido'),
  razao_social: z.string().min(2, 'Razão social obrigatória'),
  nome_fantasia: z.string().optional(),
  cep: z.string().min(9, 'CEP inválido'),
  logradouro: z.string().min(2, 'Endereço obrigatório'),
  numero: z.string().min(1, 'Número obrigatório'),
  complemento: z.string().optional(),
  bairro: z.string().min(2, 'Bairro obrigatório'),
  city: z.string().min(2, 'Cidade obrigatória'),
  state: z.string().min(2, 'Estado obrigatório'),
  rep_name: z.string().min(2, 'Nome obrigatório'),
  rep_cpf: z.string().min(14, 'CPF inválido'),
  rep_phone: z.string().min(14, 'Telefone obrigatório'),
  rep_role: z.string().min(1, 'Cargo obrigatório'),
  rep_email: z.string().email('E-mail inválido'),
  fin_name: z.string().min(2, 'Nome obrigatório'),
  fin_email: z.string().email('E-mail inválido'),
  fin_phone: z.string().min(14, 'Telefone obrigatório'),
});

type FormData = z.infer<typeof schema>;

interface CheckoutRegistrationProps {
  proposalId: string;
  companyName: string;
  onComplete: () => void;
}

const CheckoutRegistration = ({ proposalId, companyName, onComplete }: CheckoutRegistrationProps) => {
  const [cepLoading, setCepLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { searchByCnpj, isSearching: cnpjLoading } = useCnpjaSearch();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rep_role: '' },
  });

  const cnpjValue = watch('cnpj');
  const cepValue = watch('cep');

  // ── CNPJ lookup via centralized hook ──
  const handleCnpjLookup = async () => {
    const clean = (cnpjValue || '').replace(/\D/g, '');
    if (clean.length !== 14) { toast.error('CNPJ deve ter 14 dígitos'); return; }
    const items = await searchByCnpj(clean);
    if (items.length > 0) {
      const r = items[0];
      setValue('razao_social', r.razao_social || '');
      setValue('nome_fantasia', r.nome_fantasia || '');
      if (r.cep) {
        setValue('cep', maskCep(r.cep));
        setValue('logradouro', r.logradouro || '');
        setValue('numero', r.numero || '');
        setValue('complemento', r.complemento || '');
        setValue('bairro', r.bairro || '');
        setValue('city', r.city || '');
        setValue('state', r.state || '');
      }
      toast.success('Dados da empresa encontrados');
    }
  };

  // ── CEP lookup ──
  const handleCepLookup = async () => {
    const clean = (cepValue || '').replace(/\D/g, '');
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setValue('logradouro', data.logradouro || '');
        setValue('bairro', data.bairro || '');
        setValue('city', data.localidade || '');
        setValue('state', data.uf || '');
        setValue('complemento', data.complemento || '');
      }
    } catch {
      // ignore
    } finally {
      setCepLoading(false);
    }
  };

  const onSubmit = async (d: FormData) => {
    setSubmitting(true);
    try {
      const { error } = await (supabase.rpc as any)('save_checkout_registration', {
        p_proposal_id: proposalId,
        p_cnpj: d.cnpj.replace(/\D/g, ''),
        p_razao_social: d.razao_social,
        p_nome_fantasia: d.nome_fantasia || null,
        p_cep: d.cep.replace(/\D/g, ''),
        p_logradouro: d.logradouro,
        p_numero: d.numero,
        p_complemento: d.complemento || null,
        p_bairro: d.bairro,
        p_city: d.city,
        p_state: d.state,
        p_rep_name: d.rep_name,
        p_rep_cpf: d.rep_cpf.replace(/\D/g, ''),
        p_rep_phone: d.rep_phone.replace(/\D/g, ''),
        p_rep_role: d.rep_role,
        p_rep_email: d.rep_email,
        p_fin_name: d.fin_name,
        p_fin_email: d.fin_email,
        p_fin_phone: d.fin_phone.replace(/\D/g, ''),
      });
      if (error) throw error;
      toast.success('Cadastro realizado com sucesso!');
      onComplete();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar cadastro. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'h-10 bg-card border border-border rounded-lg px-3 text-sm text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors w-full';
  const labelClass = 'text-sm font-medium text-muted-foreground';
  const errorClass = 'text-xs text-destructive mt-1';

  return (
    <div>
      <CheckoutStepper currentStep={1} />

      <div className="bg-card rounded-xl p-6 md:p-8 border border-border mb-6">
        <p className="text-muted-foreground text-sm mb-6">
          Olá! Para dar continuidade à aceitação da proposta para <strong>{companyName}</strong>, 
          preencha os dados abaixo.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* ── Section 1: Company Data ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Dados da Empresa</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label className={labelClass}>CNPJ *</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    {...register('cnpj')}
                    className={inputClass}
                    placeholder="00.000.000/0000-00"
                    onChange={(e) => setValue('cnpj', maskCnpj(e.target.value))}
                  />
                  <button
                    type="button"
                    onClick={handleCnpjLookup}
                    disabled={cnpjLoading}
                    className="px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1 text-sm font-medium disabled:opacity-50 shrink-0"
                  >
                    {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Buscar
                  </button>
                </div>
                {errors.cnpj && <p className={errorClass}>{errors.cnpj.message}</p>}
              </div>

              <div>
                <Label className={labelClass}>Razão Social *</Label>
                <Input {...register('razao_social')} className={cn(inputClass, 'mt-1')} />
                {errors.razao_social && <p className={errorClass}>{errors.razao_social.message}</p>}
              </div>
              <div>
                <Label className={labelClass}>Nome Fantasia</Label>
                <Input {...register('nome_fantasia')} className={cn(inputClass, 'mt-1')} />
              </div>

              <div>
                <Label className={labelClass}>CEP *</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    {...register('cep')}
                    className={inputClass}
                    placeholder="00000-000"
                    onChange={(e) => setValue('cep', maskCep(e.target.value))}
                    onBlur={handleCepLookup}
                  />
                  {cepLoading && <Loader2 className="h-4 w-4 animate-spin text-primary self-center" />}
                </div>
                {errors.cep && <p className={errorClass}>{errors.cep.message}</p>}
              </div>
              <div>
                <Label className={labelClass}>Logradouro *</Label>
                <Input {...register('logradouro')} className={cn(inputClass, 'mt-1')} />
                {errors.logradouro && <p className={errorClass}>{errors.logradouro.message}</p>}
              </div>
              <div>
                <Label className={labelClass}>Número *</Label>
                <Input {...register('numero')} className={cn(inputClass, 'mt-1')} />
                {errors.numero && <p className={errorClass}>{errors.numero.message}</p>}
              </div>
              <div>
                <Label className={labelClass}>Complemento</Label>
                <Input {...register('complemento')} className={cn(inputClass, 'mt-1')} />
              </div>
              <div>
                <Label className={labelClass}>Bairro *</Label>
                <Input {...register('bairro')} className={cn(inputClass, 'mt-1')} />
                {errors.bairro && <p className={errorClass}>{errors.bairro.message}</p>}
              </div>
              <div>
                <Label className={labelClass}>Cidade *</Label>
                <Input {...register('city')} className={cn(inputClass, 'mt-1')} />
                {errors.city && <p className={errorClass}>{errors.city.message}</p>}
              </div>
              <div>
                <Label className={labelClass}>Estado *</Label>
                <select {...register('state')} className={cn(inputClass, 'mt-1')}>
                  <option value="">Selecione...</option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
                {errors.state && <p className={errorClass}>{errors.state.message}</p>}
              </div>
            </div>
          </div>

          {/* ── Section 2: Legal Representative ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Representante Legal</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className={labelClass}>Nome Completo *</Label>
                <Input {...register('rep_name')} className={cn(inputClass, 'mt-1')} />
                {errors.rep_name && <p className={errorClass}>{errors.rep_name.message}</p>}
              </div>
              <div>
                <Label className={labelClass}>CPF *</Label>
                <Input
                  {...register('rep_cpf')}
                  className={cn(inputClass, 'mt-1')}
                  placeholder="000.000.000-00"
                  onChange={(e) => setValue('rep_cpf', maskCpf(e.target.value))}
                />
                {errors.rep_cpf && <p className={errorClass}>{errors.rep_cpf.message}</p>}
              </div>
              <div>
                <Label className={labelClass}>Telefone *</Label>
                <Input
                  {...register('rep_phone')}
                  className={cn(inputClass, 'mt-1')}
                  placeholder="(00) 00000-0000"
                  onChange={(e) => setValue('rep_phone', maskPhone(e.target.value))}
                />
                {errors.rep_phone && <p className={errorClass}>{errors.rep_phone.message}</p>}
              </div>
              <div>
                <Label className={labelClass}>Cargo *</Label>
                <select
                  {...register('rep_role')}
                  className={cn(inputClass, 'mt-1')}
                >
                  <option value="">Selecione...</option>
                  <option value="socio">Sócio(a)</option>
                  <option value="diretor">Diretor(a)</option>
                  <option value="gerente">Gerente</option>
                  <option value="coordenador">Coordenador(a)</option>
                  <option value="procurador">Procurador(a)</option>
                  <option value="outro">Outro</option>
                </select>
                {errors.rep_role && <p className={errorClass}>{errors.rep_role.message}</p>}
              </div>
              <div className="md:col-span-2">
                <Label className={labelClass}>E-mail *</Label>
                <Input {...register('rep_email')} type="email" className={cn(inputClass, 'mt-1')} />
                {errors.rep_email && <p className={errorClass}>{errors.rep_email.message}</p>}
              </div>
            </div>
          </div>

          {/* ── Section 3: Financial Contact ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Responsável Financeiro</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className={labelClass}>Nome Completo *</Label>
                <Input {...register('fin_name')} className={cn(inputClass, 'mt-1')} />
                {errors.fin_name && <p className={errorClass}>{errors.fin_name.message}</p>}
              </div>
              <div>
                <Label className={labelClass}>E-mail *</Label>
                <Input {...register('fin_email')} type="email" className={cn(inputClass, 'mt-1')} />
                {errors.fin_email && <p className={errorClass}>{errors.fin_email.message}</p>}
              </div>
              <div>
                <Label className={labelClass}>Telefone *</Label>
                <Input
                  {...register('fin_phone')}
                  className={cn(inputClass, 'mt-1')}
                  placeholder="(00) 00000-0000"
                  onChange={(e) => setValue('fin_phone', maskPhone(e.target.value))}
                />
                {errors.fin_phone && <p className={errorClass}>{errors.fin_phone.message}</p>}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-4 border-t border-border">
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? 'Enviando...' : 'Confirmar e Aceitar Proposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CheckoutRegistration;
