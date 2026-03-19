import { useMemo, useState, memo, useCallback, useRef } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  TableProvider,
  TableHeader,
  TableHeaderGroup,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableColumnHeader,
} from '@/components/kibo-ui/table';
import { CloserOpportunity, CloserStage } from '@/services/closerService';
import { isDealStuck } from '@/utils/behavioralScore';
import { formatTimeAgo, formatNextAction } from '@/utils/priorityCalculator';
import { CloserSelector } from '@/components/CloserSelector';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  User,
  Calendar,
  Clock,
  Mail,
  Phone,
  MoreHorizontal,
  RotateCcw,
  Trophy,
  XCircle,
  StickyNote,
  Trash2,
  Monitor,
  FileText,
  FileSignature,
  Flame,
  Snowflake,
  CalendarClock,
  CalendarCheck,
  MessageSquare,
  BarChart3,
} from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { EmailComposeDialog } from '@/components/EmailComposeDialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LeadTemperature } from '@/types/lead';
import { buildLeadFromOpportunity } from '@/utils/leadEmailHelper';
import { toast } from 'sonner';

// ---------- Types ----------

interface CloserTableViewProps {
  opportunities: CloserOpportunity[];
  canBulkSelect: boolean;
  canManage: boolean;
  selectedOppIds: Set<string>;
  onOppCheckChange: (oppId: string, checked: boolean) => void;
  onCheckAllChange: (checked: boolean) => void;
  onCardClick: (opp: CloserOpportunity) => void;
  getOppHref?: (opp: CloserOpportunity) => string;
  onReturn: (opp: CloserOpportunity) => void;
  onLost: (opp: CloserOpportunity) => void;
  onNotes: (opp: CloserOpportunity) => void;
  onWon: (opp: CloserOpportunity) => void;
  onDelete?: (opp: CloserOpportunity) => void;
  onStageChange: (id: string, stage: CloserStage) => void;
  onLeadStatusChange?: (leadId: string, status: string) => void;
  tab: 'oportunidades' | 'reunioes' | 'vendas';
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
}

// ---------- Helpers ----------

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

const stageLabelsMap: Record<string, string> = {
  'Demonstração': 'Demonstração',
  'Proposta enviada': 'Enviada',
  'Oportunidade Quente': 'Op. Quente',
  'Oportunidade Futura': 'Op. Futura',
  'Oportunidade Fria': 'Op. Fria',
  'Contrato enviado': 'Contrato',
  'Aguardando pagamento': 'Pagamento',
  'Ganho': 'Ganho',
  'Perdido': 'Perdido',
};

// ---------- Temperature Display ----------

const TemperatureDisplay = ({ temperature }: { temperature: string | null }) => {
  if (!temperature) return <span className="text-sm text-muted-foreground">—</span>;
  const t = temperature.toLowerCase() as LeadTemperature;
  const bars = t === 'quente' ? 3 : t === 'morno' ? 2 : 1;
  const labels: Record<string, string> = { frio: 'Baixo', morno: 'Médio', quente: 'Alto' };
  const barColors: Record<string, string> = {
    frio: 'bg-destructive',
    morno: 'bg-[hsl(var(--chart-2))]',
    quente: 'bg-[hsl(var(--chart-3))]',
  };
  const textColors: Record<string, string> = {
    frio: 'text-destructive',
    morno: 'text-[hsl(var(--chart-2))]',
    quente: 'text-[hsl(var(--chart-3))]',
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("h-3 w-1.5 rounded-sm", i < bars ? barColors[t] : "bg-muted")} />
        ))}
      </div>
      <span className={cn("text-xs font-medium", textColors[t])}>
        {labels[t]}
      </span>
    </div>
  );
};

// ---------- Quick Actions ----------
// Handlers accept the opp object so the parent can pass stable memoized callbacks
// directly without wrapping in inline arrow functions, keeping React.memo effective.

const RowQuickActions = memo(function RowQuickActions({ opp, onReturn, onLost, onNotes, onWon, onDelete, onEmail }: {
  opp: CloserOpportunity;
  onReturn: (opp: CloserOpportunity) => void;
  onLost: (opp: CloserOpportunity) => void;
  onNotes: (opp: CloserOpportunity) => void;
  onWon: (opp: CloserOpportunity) => void;
  onDelete?: (opp: CloserOpportunity) => void;
  onEmail: (opp: CloserOpportunity) => void;
}) {
  const [isPhonePopoverOpen, setIsPhonePopoverOpen] = useState(false);
  const [isWhatsAppPopoverOpen, setIsWhatsAppPopoverOpen] = useState(false);

  const phones = [opp.lead_phone, opp.lead_phone_2, opp.lead_phone_3, opp.lead_phone_4].filter(Boolean) as string[];
  const hasMultiplePhones = phones.length > 1;
  const isTerminal = opp.stage === 'Ganho' || opp.stage === 'Perdido';

  const dialNumber = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const phoneWithoutPrefix = cleanPhone.startsWith('55') ? cleanPhone.slice(2) : cleanPhone;
    window.open(`tel:${phoneWithoutPrefix}`, '_self');
    setIsPhonePopoverOpen(false);
  };

  const openWhatsApp = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    window.open(`https://web.whatsapp.com/send?phone=55${cleanPhone}`, '_blank');
    setIsWhatsAppPopoverOpen(false);
  };

  const handleCall = () => {
    if (!opp.lead_phone) { toast.error('Telefone não cadastrado'); return; }
    if (hasMultiplePhones) setIsPhonePopoverOpen(true);
    else dialNumber(opp.lead_phone);
  };

  const handleWhatsApp = () => {
    if (!opp.lead_phone) { toast.error('Telefone não cadastrado'); return; }
    if (hasMultiplePhones) setIsWhatsAppPopoverOpen(true);
    else openWhatsApp(opp.lead_phone);
  };

  const handleEmail = () => {
    if (!opp.lead_email) { toast.error('E-mail não cadastrado'); return; }
    onEmail(opp);
  };

  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); handleEmail(); }}>
            <Mail className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs">E-mail</TooltipContent>
      </Tooltip>

      <Popover open={isWhatsAppPopoverOpen} onOpenChange={setIsWhatsAppPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); handleWhatsApp(); }}>
            <WhatsAppIcon size={14} />
          </Button>
        </PopoverTrigger>
        {hasMultiplePhones && (
          <PopoverContent className="w-auto p-2" align="center" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-1">
              {phones.map((num, i) => (
                <Button key={i} variant="ghost" size="sm" className="justify-start text-sm gap-2 bg-muted text-foreground hover:bg-muted/80" onClick={() => openWhatsApp(num)}>
                  <WhatsAppIcon size={12} />
                  {num}
                </Button>
              ))}
            </div>
          </PopoverContent>
        )}
      </Popover>

      <Popover open={isPhonePopoverOpen} onOpenChange={setIsPhonePopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); handleCall(); }}>
            <Phone className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        {hasMultiplePhones && (
          <PopoverContent className="w-auto p-2" align="center" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-1">
              {phones.map((num, i) => (
                <Button key={i} variant="ghost" size="sm" className="justify-start text-sm gap-2 bg-muted text-foreground hover:bg-muted/80" onClick={() => dialNumber(num)}>
                  <Phone className="h-3 w-3" />
                  {num}
                </Button>
              ))}
            </div>
          </PopoverContent>
        )}
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => onNotes(opp)} className="gap-2">
            <StickyNote className="h-4 w-4" />
            Notas
          </DropdownMenuItem>
          {!isTerminal && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onReturn(opp)} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Devolver ao SDR
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onWon(opp)} className="gap-2">
                <Trophy className="h-4 w-4" />
                Marcar Ganho
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLost(opp)} className="gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                Marcar Perdido
              </DropdownMenuItem>
            </>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(opp)} className="gap-2 text-destructive">
                <Trash2 className="h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

// ---------- Main Component ----------

export function CloserTableView({
  opportunities,
  canBulkSelect,
  canManage,
  selectedOppIds,
  onOppCheckChange,
  onCheckAllChange,
  onCardClick,
  getOppHref,
  onReturn,
  onLost,
  onNotes,
  onWon,
  onDelete,
  onStageChange,
  tab,
  sorting,
  onSortingChange,
}: CloserTableViewProps) {
  const { user: currentUser } = useCurrentUser();

  // Single EmailComposeDialog lifted to table level — replaces one-per-row instances.
  const [emailOpp, setEmailOpp] = useState<CloserOpportunity | null>(null);
  const onEmail = useCallback((opp: CloserOpportunity) => setEmailOpp(opp), []);

  // Stable ref so the checkbox cells can read the latest selectedOppIds without
  // being listed as a useMemo dependency (avoids rebuilding columns on every tick).
  const selectedOppIdsRef = useRef(selectedOppIds);
  selectedOppIdsRef.current = selectedOppIds;

  const columns = useMemo<ColumnDef<CloserOpportunity, any>[]>(() => {
    const cols: ColumnDef<CloserOpportunity, any>[] = [];

    // Checkbox column
    if (canBulkSelect) {
      cols.push({
        id: 'select',
        header: () => (
          <div className={cn(
            "transition-opacity",
            opportunities.every(o => selectedOppIdsRef.current.has(o.id)) ? "opacity-100" : "opacity-0 hover:opacity-100"
          )}>
            <Checkbox
              checked={opportunities.length > 0 && opportunities.every(o => selectedOppIdsRef.current.has(o.id))}
              onCheckedChange={onCheckAllChange}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div
            className={cn(
              "transition-opacity",
              selectedOppIdsRef.current.has(row.original.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selectedOppIdsRef.current.has(row.original.id)}
              onCheckedChange={(checked) => onOppCheckChange(row.original.id, !!checked)}
            />
          </div>
        ),
        enableSorting: false,
        size: 40,
      });
    }

    // Lead info
    cols.push({
      accessorKey: 'lead_company',
      header: ({ column }) => <TableColumnHeader column={column} title="Oportunidade" />,
      size: 320,
      minSize: 200,
      cell: ({ row }) => {
        const opp = row.original;
        return (
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-0.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-foreground truncate text-sm">{opp.lead_company || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{opp.lead_name || '—'}</span>
            </div>
          </div>
        );
      },
      sortingFn: (a, b) => {
        const aVal = a.original.lead_company || '';
        const bVal = b.original.lead_company || '';
        return aVal.localeCompare(bVal);
      },
    });


    // Stage (only for oportunidades tab)
    if (tab === 'oportunidades') {
      cols.push({
        accessorKey: 'stage',
        header: ({ column }) => <TableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const opp = row.original;
          return (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {stageLabelsMap[opp.stage] || opp.stage}
            </span>
          );
        },
      });
    }

    // Deal value (sortable)
    cols.push({
      accessorKey: 'deal_value',
      header: ({ column }) => <TableColumnHeader column={column} title="Valor" />,
      cell: ({ row }) => {
        const val = Number(row.original.deal_value);
        if (!val) return <span className="text-xs text-muted-foreground">—</span>;
        return <span className="text-xs font-medium tabular-nums">{formatCurrency(val)}</span>;
      },
      sortingFn: (a, b) => (Number(a.original.deal_value) || 0) - (Number(b.original.deal_value) || 0),
    });


    // Last contact
    cols.push({
      accessorKey: 'lead_last_contact_at',
      header: ({ column }) => <TableColumnHeader column={column} title="Último Contato" />,
      cell: ({ row }) => {
        const opp = row.original;
        if (!opp.lead_last_contact_at) return <span className="text-xs text-muted-foreground">—</span>;
        return <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTimeAgo(new Date(opp.lead_last_contact_at))}</span>;
      },
      sortingFn: (a, b) => {
        const aTime = a.original.lead_last_contact_at ? new Date(a.original.lead_last_contact_at).getTime() : 0;
        const bTime = b.original.lead_last_contact_at ? new Date(b.original.lead_last_contact_at).getTime() : 0;
        return aTime - bTime;
      },
    });

    // Next action
    cols.push({
      accessorKey: 'lead_next_action_at',
      header: ({ column }) => <TableColumnHeader column={column} title="Próxima Ação" />,
      cell: ({ row }) => {
        const opp = row.original;
        if (!opp.lead_next_action_at) return <span className="text-xs text-muted-foreground">—</span>;
        const isTerminal = opp.stage === 'Ganho' || opp.stage === 'Perdido';
        const isOverdue = !isTerminal && new Date(opp.lead_next_action_at) < new Date();
        return (
          <span className={cn('text-xs whitespace-nowrap', isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
            {formatNextAction(new Date(opp.lead_next_action_at), opp.lead_status || '')}
          </span>
        );
      },
      sortingFn: (a, b) => {
        const aTime = a.original.lead_next_action_at ? new Date(a.original.lead_next_action_at).getTime() : Infinity;
        const bTime = b.original.lead_next_action_at ? new Date(b.original.lead_next_action_at).getTime() : Infinity;
        return aTime - bTime;
      },
    });

    // SDR
    cols.push({
      accessorKey: 'sdr_name',
      header: ({ column }) => <TableColumnHeader column={column} title="SDR" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground truncate max-w-[120px] block">
          {row.original.sdr_name || '—'}
        </span>
      ),
      sortingFn: (a, b) => (a.original.sdr_name || '').localeCompare(b.original.sdr_name || ''),
    });

    // Closer
    cols.push({
      accessorKey: 'closer_name',
      header: ({ column }) => <TableColumnHeader column={column} title="Closer" />,
      cell: ({ row }) => {
        const opp = row.original;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <CloserSelector
              opportunityId={opp.id}
              currentCloserId={opp.assigned_to_user_id}
              currentCloserName={opp.closer_name || null}
              disabled={!(canManage || opp.assigned_to_user_id === currentUser?.id)}
              closerOnly={true}
            />
          </div>
        );
      },
      sortingFn: (a, b) => (a.original.closer_name || '').localeCompare(b.original.closer_name || ''),
    });

    // Actions — stable handlers passed directly; RowQuickActions is memo'd so it
    // won't re-render unless its opp or handler props actually change.
    cols.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <RowQuickActions
            opp={row.original}
            onReturn={onReturn}
            onLost={onLost}
            onNotes={onNotes}
            onWon={onWon}
            onDelete={onDelete}
            onEmail={onEmail}
          />
        </div>
      ),
      enableSorting: false,
    });

    return cols;
  // selectedOppIds intentionally omitted — read via selectedOppIdsRef to avoid
  // rebuilding column definitions on every checkbox tick.
  }, [canBulkSelect, opportunities, tab, canManage, currentUser?.id, onCheckAllChange, onOppCheckChange, onReturn, onLost, onNotes, onWon, onDelete, onEmail]);

  const emailLead = emailOpp ? buildLeadFromOpportunity(emailOpp) : null;

  if (opportunities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nenhuma oportunidade encontrada</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-lg border overflow-hidden [&_table]:w-full">
        <TableProvider columns={columns} data={opportunities} manualSorting={!!onSortingChange} sorting={sorting} onSortingChange={onSortingChange}>
          <TableHeader className="bg-muted/40">
            {({ headerGroup }) => (
              <TableHeaderGroup headerGroup={headerGroup}>
                {({ header }) => (
                  <TableHead header={header} className="text-sm font-medium" />
                )}
              </TableHeaderGroup>
            )}
          </TableHeader>
          <TableBody>
            {({ row }) => {
              const opp = row.original as CloserOpportunity;
              const isTerminal = opp.stage === 'Ganho' || opp.stage === 'Perdido';
              const isOverdue = !isTerminal && opp.lead_next_action_at && new Date(opp.lead_next_action_at) < new Date();
              const stuckInfo = isDealStuck(opp);

              return (
                <TableRow
                  row={row}
                  onClick={(e: React.MouseEvent) => {
                    const href = getOppHref?.(opp);
                    if ((e.ctrlKey || e.metaKey) && href) {
                      e.preventDefault();
                      window.open(href, '_blank');
                      return;
                    }
                    onCardClick(opp);
                  }}
                  onAuxClick={(e: React.MouseEvent) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      const href = getOppHref?.(opp);
                      if (href) window.open(href, '_blank');
                    }
                  }}
                  className={cn(
                    'group cursor-pointer hover:bg-accent/50 transition-colors',
                    isOverdue && 'bg-destructive/5',
                    !isTerminal && stuckInfo.stuck && 'border-l-2 border-l-[hsl(var(--chart-2))]',
                  )}
                >
                  {({ cell }) => (
                    <TableCell
                      cell={cell}
                      className="py-3 first:pl-4 last:pr-4"
                    />
                  )}
                </TableRow>
              );
            }}
          </TableBody>
        </TableProvider>
      </div>

      {/* Single shared EmailComposeDialog — replaces one instance per row */}
      {emailOpp && emailLead && (
        <EmailComposeDialog
          open={!!emailOpp}
          onOpenChange={(open) => { if (!open) setEmailOpp(null); }}
          lead={emailLead}
          userName={currentUser?.name || ''}
          sdrName={emailOpp.sdr_name || ''}
          closerName={emailOpp.closer_name || ''}
        />
      )}
    </>
  );
}
