import { memo, useCallback, useMemo, useState } from 'react';
import { useMyQueue, QueueItem, QueueSituacao } from '@/hooks/useMyQueue';
import { Badge } from '@/components/ui/badge';
import { PHASE_LABELS, PROJECT_TYPE_LABELS, ProjectType } from '@/types/project';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  TableProvider,
  TableHeader,
  TableHeaderGroup,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableColumnHeader,
  type ColumnDef,
} from '@/components/kibo-ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

// ── Situação badge config ──
const SITUACAO_BADGE: Record<QueueSituacao, { label: string; variant: 'destructive' | 'secondary' | 'outline' | 'default'; className?: string }> = {
  atrasado: { label: 'Atrasado', variant: 'destructive' },
  vencendo: { label: 'Vencendo', variant: 'outline', className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30' },
  pausado:  { label: 'Pausado',  variant: 'secondary' },
  em_dia:   { label: 'Em dia',   variant: 'outline' },
  backlog:  { label: 'Backlog',  variant: 'outline', className: 'text-muted-foreground border-transparent' },
};

interface MyQueueTabProps {
  onSelectProject: (project: { id: string }) => void;
  globalSearch?: string;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return format(new Date(d), 'dd/MM/yy', { locale: ptBR });
}

// ── Alert Chips ──
type AlertType = 'atrasado' | 'vencendo' | 'pausado';

const CHIP_CONFIG: Record<AlertType, { emoji: string; label: (n: number) => string; className: string }> = {
  pausado:  { emoji: '⏸', label: (n) => `${n} pausada${n > 1 ? 's' : ''}`,  className: 'bg-secondary text-secondary-foreground border-border' },
  vencendo: { emoji: '⚠', label: (n) => `${n} vencendo`,                    className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30' },
  atrasado: { emoji: '🔴', label: (n) => `${n} atrasada${n > 1 ? 's' : ''}`, className: 'bg-destructive/10 text-destructive border border-destructive/30' },
};

const AlertChips = memo(({ items, onSelect }: { items: QueueItem[]; onSelect: (id: string) => void }) => {
  const [sheetType, setSheetType] = useState<AlertType | null>(null);

  const groups: Record<AlertType, QueueItem[]> = useMemo(() => ({
    atrasado: items.filter((i) => i.situacao === 'atrasado'),
    vencendo: items.filter((i) => i.situacao === 'vencendo'),
    pausado:  items.filter((i) => i.situacao === 'pausado'),
  }), [items]);

  const hasAny = groups.atrasado.length > 0 || groups.vencendo.length > 0 || groups.pausado.length > 0;
  if (!hasAny) return null;

  const sheetItems = sheetType ? groups[sheetType] : [];
  const sheetTitle = sheetType ? CHIP_CONFIG[sheetType].label(sheetItems.length) : '';

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {(['atrasado', 'vencendo', 'pausado'] as AlertType[]).map((type) => {
          const count = groups[type].length;
          if (count === 0) return null;
          const cfg = CHIP_CONFIG[type];
          return (
            <button
              key={type}
              onClick={() => setSheetType(type)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 cursor-pointer',
                cfg.className,
              )}
            >
              <span>{cfg.emoji}</span>
              <span>{cfg.label(count)}</span>
            </button>
          );
        })}
      </div>

      <Sheet open={!!sheetType} onOpenChange={(open) => { if (!open) setSheetType(null); }}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-sm">{sheetTitle}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {sheetItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { onSelect(item.project_id); setSheetType(null); }}
                className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <span className="text-muted-foreground mr-1.5">#{item.project.project_number}</span>
                <span className="font-medium">{item.project.company_name}</span>
                <span className="text-muted-foreground ml-1.5">— {PHASE_LABELS[item.phase_name] ?? item.phase_name}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
});
AlertChips.displayName = 'AlertChips';

// ── Pagination helpers ──
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

function getPageRange(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

// ── Table with kibo-ui + pagination ──
const QueueTable = memo(({ items, onSelect }: {
  items: QueueItem[];
  onSelect: (id: string) => void;
}) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const hasDueDate = useMemo(() => items.some((i) => i.due_date !== null), [items]);
  const totalPages = Math.ceil(items.length / pageSize);
  const safeCurrentPage = Math.min(page, totalPages || 1);
  const paginatedItems = useMemo(
    () => items.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize),
    [items, safeCurrentPage, pageSize],
  );

  const columns = useMemo<ColumnDef<QueueItem>[]>(() => {
    const cols: ColumnDef<QueueItem>[] = [
      {
        accessorKey: 'project.company_name',
        id: 'company',
        header: ({ column }) => <TableColumnHeader column={column} title="Empresa" />,
        cell: ({ row }) => (
          <div className="truncate max-w-[220px]">
            <span className="text-muted-foreground mr-1 text-[11px]">#{row.original.project.project_number}</span>
            <span className="font-medium text-sm">{row.original.project.company_name}</span>
          </div>
        ),
        sortingFn: (a, b) => a.original.project.company_name.localeCompare(b.original.project.company_name),
      },
      {
        accessorKey: 'project.project_type',
        id: 'type',
        header: ({ column }) => <TableColumnHeader column={column} title="Tipo" />,
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-[10px] font-medium">
            {PROJECT_TYPE_LABELS[row.original.project.project_type as ProjectType] ?? row.original.project.project_type}
          </Badge>
        ),
      },
      {
        accessorKey: 'phase_name',
        header: ({ column }) => <TableColumnHeader column={column} title="Fase" />,
        cell: ({ row }) => (
          <span className="text-xs">{PHASE_LABELS[row.original.phase_name] ?? row.original.phase_name}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <TableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.status}</span>,
      },
    ];

    if (hasDueDate) {
      cols.push(
        {
          id: 'complexity',
          accessorKey: 'project.complexity_level',
          header: ({ column }) => <TableColumnHeader column={column} title="Complexidade" />,
          cell: ({ row }) => (
            <span className="text-xs text-muted-foreground capitalize">{row.original.project.complexity_level ?? '—'}</span>
          ),
        },
        {
          accessorKey: 'due_date',
          header: ({ column }) => <TableColumnHeader column={column} title="Prazo" />,
          cell: ({ row }) => (
            <span className="text-xs text-muted-foreground">{formatDate(row.original.due_date)}</span>
          ),
        },
        {
          id: 'dias',
          accessorKey: 'dias_restantes',
          header: ({ column }) => <TableColumnHeader column={column} title="Dias" />,
          cell: ({ row }) => {
            const d = row.original.dias_restantes;
            if (d === null) return <span className="text-xs text-muted-foreground">—</span>;
            return (
              <span className={cn(
                'font-mono text-xs font-semibold',
                d < 0 && 'text-destructive',
                d >= 0 && d <= 3 && 'text-yellow-600 dark:text-yellow-400',
              )}>
                {d}
              </span>
            );
          },
        },
      );
    }

    cols.push({
      id: 'situacao',
      accessorKey: 'situacao',
      header: ({ column }) => <TableColumnHeader column={column} title="Situação" />,
      cell: ({ row }) => {
        const sit = SITUACAO_BADGE[row.original.situacao];
        return (
          <Badge variant={sit.variant} className={cn('text-[10px] px-1.5 py-0', sit.className)}>
            {sit.label}
          </Badge>
        );
      },
    });

    return cols;
  }, [hasDueDate]);

  const handlePageSizeChange = useCallback((val: string) => {
    setPageSize(Number(val));
    setPage(1);
  }, []);

  if (!items.length) {
    return <p className="text-xs text-muted-foreground py-4 text-center">Nenhum item nesta seção.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <TableProvider columns={columns} data={paginatedItems}>
          <TableHeader>
            {({ headerGroup }) => (
              <TableHeaderGroup headerGroup={headerGroup}>
                {({ header }) => <TableHead header={header} className="text-xs whitespace-nowrap" />}
              </TableHeaderGroup>
            )}
          </TableHeader>
          <TableBody>
            {({ row }) => (
              <TableRow
                key={row.id}
                row={row}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => onSelect((row.original as QueueItem).project_id)}
              >
                {({ cell }) => <TableCell cell={cell} />}
              </TableRow>
            )}
          </TableBody>
        </TableProvider>
      </div>

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Linhas</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-7 w-[60px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground/60">
              {(safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, items.length)} de {items.length}
            </span>
          </div>

          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={cn(safeCurrentPage <= 1 && 'pointer-events-none opacity-40')}
                />
              </PaginationItem>
              {getPageRange(safeCurrentPage, totalPages).map((p, i) =>
                p === 'ellipsis' ? (
                  <PaginationItem key={`e-${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={p === safeCurrentPage}
                      onClick={() => setPage(p as number)}
                      className="cursor-pointer"
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className={cn(safeCurrentPage >= totalPages && 'pointer-events-none opacity-40')}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
});
QueueTable.displayName = 'QueueTable';

// ── Main Component ──
export const MyQueueTab = memo(({ onSelectProject, globalSearch = '' }: MyQueueTabProps) => {
  const { alerts, emAndamento, backlog, isLoading } = useMyQueue();

  const filterItems = useCallback((items: QueueItem[]) => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const name = item.project.company_name.toLowerCase();
      const num = item.project.project_number.toString();
      const phase = (PHASE_LABELS[item.phase_name] ?? item.phase_name).toLowerCase();
      return name.includes(q) || num.includes(q) || phase.includes(q);
    });
  }, [globalSearch]);

  const filteredAlerts = useMemo(() => filterItems(alerts), [filterItems, alerts]);
  const filteredEmAndamento = useMemo(() => filterItems(emAndamento), [filterItems, emAndamento]);
  const filteredBacklog = useMemo(() => filterItems(backlog), [filterItems, backlog]);

  const handleSelect = useCallback((projectId: string) => {
    onSelectProject({ id: projectId });
  }, [onSelectProject]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AlertChips items={filteredAlerts} onSelect={handleSelect} />

      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Em andamento · {filteredEmAndamento.length}
        </span>
        <QueueTable items={filteredEmAndamento} onSelect={handleSelect} />
      </div>

      {filteredBacklog.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Backlog · {filteredBacklog.length}
          </span>
          <QueueTable items={filteredBacklog} onSelect={handleSelect} />
        </div>
      )}
    </div>
  );
});
MyQueueTab.displayName = 'MyQueueTab';
