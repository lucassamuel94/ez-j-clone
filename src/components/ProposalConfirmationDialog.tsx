import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, Building2, X, Info } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface LeadResult {
  id: string;
  company: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface ProposalData {
  companyName: string;
  cnpj: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  sdrName: string;
  closerName: string;
  planName: string;
  planPrice: number;
  estimatedContacts: number;
  estimatedMessages: number;
  metaCost: number;
  aiCost?: number;
  excessMessages: number;
  excessContacts: number;
  excessMessageCost: number;
  excessContactCost: number;
  appliedExcessCost: number;
  totalMonthly: number;
  setupTotal: number;
  setupPaymentMethod: string;
  setupInstallments: number;
  integrations: { name: string; price: number; originalPrice?: number; discountLabel?: string; phase: number }[];
  contractMonths: number;
  cancellationFeePercent: number;
  validityDays: number;
  notes: string;
  opportunityId?: string;
}

interface ProposalConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ProposalData;
  onConfirm: (data: ProposalData) => void;
  isLoading?: boolean;
}

export const ProposalConfirmationDialog = ({
  open,
  onOpenChange,
  data,
  onConfirm,
  isLoading,
}: ProposalConfirmationDialogProps) => {
  const [editableData, setEditableData] = useState(data);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LeadResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadResult | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync when data changes
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setEditableData(data);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedLead(null);
    }
    onOpenChange(open);
  };

  const searchLeads = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    const cleanQuery = query.replace(/[.\-\/]/g, '');
    const { data: results } = await supabase
      .from('leads')
      .select('id, company, razao_social, nome_fantasia, cnpj, name, email, phone')
      .or(`razao_social.ilike.%${query}%,nome_fantasia.ilike.%${query}%,cnpj.ilike.%${cleanQuery}%,company.ilike.%${query}%`)
      .limit(8);
    setSearchResults(results || []);
    setShowResults(true);
    setSearching(false);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLeads(value), 300);
  };

  const selectLead = (lead: LeadResult) => {
    setSelectedLead(lead);
    setShowResults(false);
    const displayName = lead.razao_social || lead.nome_fantasia || lead.company;
    setSearchQuery(displayName);
    setEditableData(prev => ({
      ...prev,
      companyName: displayName,
      cnpj: lead.cnpj || '',
      contactName: lead.name || '',
      contactEmail: lead.email || '',
      contactPhone: lead.phone || '',
    }));
  };

  const clearSelection = () => {
    setSelectedLead(null);
    setSearchQuery('');
    setEditableData(prev => ({
      ...prev,
      companyName: data.companyName,
      cnpj: data.cnpj,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
    }));
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[1366px] w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar dados da proposta</DialogTitle>
          <DialogDescription>Revise os dados antes de gerar a proposta.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lead search - required */}
          <div ref={searchRef} className="relative">
            <Label className="text-xs font-medium mb-1.5 block">
              Buscar cliente <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Razão social, nome fantasia ou CNPJ..."
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                className="pl-9 pr-9"
              />
              {selectedLead && (
                <button onClick={clearSelection} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {showResults && (
              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {searching ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Buscando...</div>
                ) : searchResults.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado encontrado</div>
                ) : (
                  searchResults.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => selectLead(lead)}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-start gap-2"
                    >
                      <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {lead.razao_social || lead.nome_fantasia || lead.company}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {lead.cnpj && `CNPJ: ${lead.cnpj}`}
                          {lead.cnpj && lead.name && ' · '}
                          {lead.name}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
            {!selectedLead && !editableData.companyName.trim() && (
              <p className="text-xs text-destructive mt-1">Selecione um cliente para continuar.</p>
            )}
          </div>

          {/* Selected lead info */}
          {selectedLead && (
            <div className="rounded-md border bg-muted/50 p-3 space-y-1">
              <p className="text-sm font-medium">{editableData.companyName}</p>
              {editableData.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {editableData.cnpj}</p>}
              {editableData.contactName && <p className="text-xs text-muted-foreground">Contato: {editableData.contactName}</p>}
              {editableData.contactEmail && <p className="text-xs text-muted-foreground">Email: {editableData.contactEmail}</p>}
              {editableData.contactPhone && <p className="text-xs text-muted-foreground">Telefone: {editableData.contactPhone}</p>}
            </div>
          )}

          <Separator />

          {/* Simulation summary */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recorrente</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Plano</span>
              <span className="font-medium">{formatCurrency(data.planPrice)}</span>
            </div>
            {/* Excess breakdown — hidden when zero */}
            {editableData.appliedExcessCost > 0 && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  Excedente estimado
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        O sistema cobra apenas o <strong>menor</strong> excedente entre mensagens e contatos, nunca os dois ao mesmo tempo.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Mensagens ({editableData.excessMessages.toLocaleString('pt-BR')} excedidas)
                  </span>
                  <span className={`font-medium ${editableData.excessMessageCost <= editableData.excessContactCost ? 'text-primary' : 'line-through text-muted-foreground'}`}>
                    {formatCurrency(editableData.excessMessageCost)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Contatos ({editableData.excessContacts.toLocaleString('pt-BR')} excedidos)
                  </span>
                  <span className={`font-medium ${editableData.excessContactCost <= editableData.excessMessageCost ? 'text-primary' : 'line-through text-muted-foreground'}`}>
                    {formatCurrency(editableData.excessContactCost)}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-border/50">
                  <span className="text-muted-foreground font-medium">Valor cobrado (menor)</span>
                  <span className="font-bold text-primary">{formatCurrency(editableData.appliedExcessCost)}</span>
                </div>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                Custo Meta WhatsApp (estimado)
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Valor calculado com base no volume de contatos e nas categorias de conversa configuradas em <strong>Biblioteca de Produtos → Custos Meta</strong>.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
              <span className="font-medium">{formatCurrency(editableData.metaCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total mensal</span>
              <span className="font-medium">{formatCurrency(editableData.totalMonthly)}</span>
            </div>
            <Separator className="my-2" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pagamento Único</p>
            {data.integrations.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.name}
                  {item.discountLabel && <span className="text-green-600 ml-1 text-xs">(-{item.discountLabel})</span>}
                </span>
                <div className="flex items-center gap-2">
                  {item.originalPrice && (
                    <span className="text-xs text-muted-foreground line-through">{formatCurrency(item.originalPrice)}</span>
                  )}
                  <span className="font-medium">{formatCurrency(item.price)}</span>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Editable terms */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Termos contratuais</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Prazo (meses)</Label>
                <Input
                  type="number"
                  value={editableData.contractMonths}
                  onChange={e => setEditableData(prev => ({ ...prev, contractMonths: parseInt(e.target.value) || 12 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Multa rescisão (%)</Label>
                <Input
                  type="number"
                  value={editableData.cancellationFeePercent}
                  onChange={e => setEditableData(prev => ({ ...prev, cancellationFeePercent: parseFloat(e.target.value) || 20 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Validade (dias)</Label>
                <Input
                  type="number"
                  value={editableData.validityDays}
                  onChange={e => setEditableData(prev => ({ ...prev, validityDays: parseInt(e.target.value) || 30 }))}
                />
              </div>
            </div>
          </div>

          {/* Observations */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Observações</Label>
            <Textarea
              placeholder="Observações adicionais para a proposta..."
              value={editableData.notes || ''}
              onChange={e => setEditableData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(editableData)} disabled={isLoading || !editableData.companyName.trim()}>
            {isLoading ? 'Gerando...' : 'Confirmar e gerar proposta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
