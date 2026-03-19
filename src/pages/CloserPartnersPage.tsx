import { useState, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { usePartners, usePartnerReferrals, useCreatePartner, useUpdatePartner, useDeletePartner, type Partner, type PartnerReferral } from '@/hooks/usePartners';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Loader2, Search, Handshake, Plus, Pencil, Trash2, Phone, Mail, Building2, Users, DollarSign, ArrowLeft } from 'lucide-react';

const PARTNER_TYPES = [
  { value: 'indicador', label: 'Indicador' },
  { value: 'revendedor', label: 'Revendedor' },
  { value: 'integrador', label: 'Integrador' },
  { value: 'contabil', label: 'Contábil' },
  { value: 'outro', label: 'Outro' },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(PARTNER_TYPES.map(t => [t.value, t.label]));

const STAGE_COLORS: Record<string, string> = {
  'Ganho': 'bg-success/10 text-success',
  'Perdido': 'bg-destructive/10 text-destructive',
  'Demonstração': 'bg-info/10 text-info',
  'Negociação': 'bg-primary/10 text-primary',
  'Sem oportunidade': 'bg-muted text-muted-foreground',
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const formatPhone = (p: string) => {
  const d = p.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return p;
};

// ── Partner Form Dialog ──
interface PartnerFormProps {
  open: boolean;
  onClose: () => void;
  partner?: Partner | null;
}

function PartnerFormDialog({ open, onClose, partner }: PartnerFormProps) {
  const createPartner = useCreatePartner();
  const updatePartner = useUpdatePartner();
  const isEdit = !!partner;

  const [form, setForm] = useState({
    name: partner?.name || '',
    email: partner?.email || '',
    phone: partner?.phone || '',
    company: partner?.company || '',
    partner_type: partner?.partner_type || 'indicador',
    commission_rate: partner?.commission_rate?.toString() || '0',
    status: partner?.status || 'active',
    notes: partner?.notes || '',
  });

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      company: form.company.trim() || undefined,
      partner_type: form.partner_type,
      commission_rate: parseFloat(form.commission_rate) || 0,
      status: form.status,
      notes: form.notes.trim() || undefined,
    };

    if (isEdit && partner) {
      await updatePartner.mutateAsync({ id: partner.id, updates: payload as any });
    } else {
      await createPartner.mutateAsync(payload);
    }
    onClose();
  };

  const isPending = createPartner.isPending || updatePartner.isPending;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Parceiro' : 'Novo Parceiro'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do parceiro" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Empresa</Label>
              <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Empresa do parceiro" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.partner_type} onValueChange={v => setForm(f => ({ ...f, partner_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARTNER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Comissão (%)</Label>
              <Input type="number" min="0" max="100" step="0.5" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas sobre o parceiro..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name.trim()}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? 'Salvar' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Partner Detail View ──
function PartnerDetail({ partner, onBack }: { partner: Partner; onBack: () => void }) {
  const { data: referrals = [], isLoading } = usePartnerReferrals(partner.id);
  const [editOpen, setEditOpen] = useState(false);
  const deletePartner = useDeletePartner();

  const wonReferrals = useMemo(() => referrals.filter(r => r.stage === 'Ganho'), [referrals]);
  const totalRevenue = useMemo(() => wonReferrals.reduce((s, r) => s + (r.deal_value || 0), 0), [wonReferrals]);
  const commission = totalRevenue * (partner.commission_rate / 100);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h2 className="text-base font-semibold">{partner.name}</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {partner.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{partner.company}</span>}
              <Badge variant="outline" className="text-[9px] h-4">{TYPE_LABELS[partner.partner_type] || partner.partner_type}</Badge>
              <Badge variant="outline" className={cn('text-[9px] h-4', partner.status === 'active' ? 'border-success/40 text-success' : 'text-muted-foreground')}>
                {partner.status === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3 w-3" />Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover parceiro?</AlertDialogTitle>
                <AlertDialogDescription>O vínculo com os leads indicados será mantido.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => { deletePartner.mutate(partner.id); onBack(); }}>Remover</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Contact info */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {partner.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{formatPhone(partner.phone)}</span>}
          {partner.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{partner.email}</span>}
          {partner.commission_rate > 0 && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />Comissão: {partner.commission_rate}%</span>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="py-3 px-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Indicações</p>
            <p className="text-xl font-bold">{referrals.length}</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 px-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fechados</p>
            <p className="text-xl font-bold text-success">{wonReferrals.length}</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 px-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita gerada</p>
            <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 px-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Comissão</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(commission)}</p>
          </CardContent></Card>
        </div>

        {/* Referrals table */}
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Empresa</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Closer</TableHead>
                <TableHead className="text-xs">Fechamento</TableHead>
                <TableHead className="text-xs text-right">Valor setup</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /><span className="text-sm text-muted-foreground">Carregando...</span>
                </TableCell></TableRow>
              ) : referrals.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">Nenhuma indicação registrada</TableCell></TableRow>
              ) : referrals.map((r: PartnerReferral) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm py-2.5 font-medium">{r.company}</TableCell>
                  <TableCell className="py-2.5">
                    <Badge variant="outline" className={cn('text-[10px] h-4', STAGE_COLORS[r.stage] || 'bg-muted text-muted-foreground')}>
                      {r.stage}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs py-2.5">{r.closer_name || '—'}</TableCell>
                  <TableCell className="text-xs py-2.5 text-muted-foreground">{r.won_at ? formatDate(r.won_at) : '—'}</TableCell>
                  <TableCell className="text-xs py-2.5 text-right font-medium">
                    {r.deal_value ? <span className="text-success">{formatCurrency(r.deal_value)}</span> : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {partner.notes && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            <p className="font-semibold mb-1">Observações</p>
            <p className="whitespace-pre-wrap">{partner.notes}</p>
          </div>
        )}
      </div>

      <PartnerFormDialog open={editOpen} onClose={() => setEditOpen(false)} partner={partner} />
    </>
  );
}

// ── Main Page ──
export default function CloserPartnersPage() {
  const { data: partners = [], isLoading } = usePartners();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.company?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q),
    );
  }, [partners, search]);

  const totalRevenue = useMemo(() => partners.reduce((s, p) => s + p.total_revenue, 0), [partners]);
  const totalCommission = useMemo(() => partners.reduce((s, p) => s + p.total_commission, 0), [partners]);
  const totalReferrals = useMemo(() => partners.reduce((s, p) => s + p.referral_count, 0), [partners]);

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <PageHeader
          title="Parceiros Comerciais"
          subtitle="Gerencie seus parceiros e indicações"
          icon={<Handshake className="h-5 w-5" />}
          action={
            !selectedPartner ? (
              <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />Novo Parceiro
              </Button>
            ) : undefined
          }
        />

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {selectedPartner ? (
            <PartnerDetail partner={selectedPartner} onBack={() => setSelectedPartner(null)} />
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card><CardContent className="py-3 px-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Parceiros</p>
                  <p className="text-2xl font-bold">{isLoading ? '—' : partners.filter(p => p.status === 'active').length}</p>
                </CardContent></Card>
                <Card><CardContent className="py-3 px-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Indicações</p>
                  <p className="text-2xl font-bold">{isLoading ? '—' : totalReferrals}</p>
                </CardContent></Card>
                <Card><CardContent className="py-3 px-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita gerada</p>
                  <p className="text-2xl font-bold text-success">{isLoading ? '—' : formatCurrency(totalRevenue)}</p>
                </CardContent></Card>
                <Card><CardContent className="py-3 px-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Comissões</p>
                  <p className="text-2xl font-bold text-primary">{isLoading ? '—' : formatCurrency(totalCommission)}</p>
                </CardContent></Card>
              </div>

              {/* Search */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar parceiro, empresa, e-mail..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              {/* Table */}
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Parceiro</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Contato</TableHead>
                      <TableHead className="text-xs text-center">Indicações</TableHead>
                      <TableHead className="text-xs text-right">Receita</TableHead>
                      <TableHead className="text-xs text-right">Comissão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-10">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Carregando...</span>
                      </TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-14">
                        <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {search ? 'Nenhum resultado' : 'Nenhum parceiro cadastrado'}
                        </p>
                      </TableCell></TableRow>
                    ) : filtered.map(p => (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => setSelectedPartner(p)}>
                        <TableCell className="py-2.5">
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            {p.company && <p className="text-[10px] text-muted-foreground">{p.company}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant="outline" className="text-[10px] h-4">{TYPE_LABELS[p.partner_type] || p.partner_type}</Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground">
                          <div className="space-y-0.5">
                            {p.phone && <p className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{formatPhone(p.phone)}</p>}
                            {p.email && <p className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" />{p.email}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <Badge variant="outline" className={cn('text-[10px] h-5', p.referral_count > 0 ? 'border-info/30 text-info' : '')}>
                            {p.referral_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2.5 text-right font-medium">
                          {p.total_revenue > 0 ? <span className="text-success">{formatCurrency(p.total_revenue)}</span> : '—'}
                        </TableCell>
                        <TableCell className="text-xs py-2.5 text-right font-medium">
                          {p.total_commission > 0 ? <span className="text-primary">{formatCurrency(p.total_commission)}</span> : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>

      <PartnerFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
    </AppLayout>
  );
}
