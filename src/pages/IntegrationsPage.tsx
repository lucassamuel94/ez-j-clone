import { useState, Fragment } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useIntegrations } from '@/hooks/useIntegrations';
import { Plug, Search, ChevronRight, Building2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 20;
import { cn } from '@/lib/utils';

export default function IntegrationsPage() {
  const { data: integrations, isLoading } = useIntegrations();
  const [search, setSearch] = useState('');
  const [onlyNew, setOnlyNew] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const filtered = (integrations || []).filter((i) => {
    if (onlyNew && !i.is_new) return false;
    if (search && !i.integration_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const totalSystems = new Set((integrations || []).map((i) => i.integration_name.toLowerCase())).size;

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 flex-1 overflow-auto">
         <PageHeader
          title="Catálogo de Integrações"
          subtitle={`${totalSystems} sistemas integrados aos projetos da EZ Soft`}
        />

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar sistema..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="only-new" checked={onlyNew} onCheckedChange={(v) => { setOnlyNew(v); setPage(0); }} />
            <Label htmlFor="only-new" className="text-sm text-muted-foreground cursor-pointer">
              Apenas novas
            </Label>
          </div>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg bg-card">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Plug className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhuma integração encontrada</p>
              <p className="text-xs mt-1">Os dados aparecem quando projetos são entregues com integrações.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Sistema</TableHead>
                  <TableHead>Descrição / Função</TableHead>
                  <TableHead className="text-center w-24">Projetos</TableHead>
                  <TableHead className="text-center w-20">Nova?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((item) => {
                  const key = item.integration_name.toLowerCase();
                  const isExpanded = expandedRow === key;
                  return (
                    <Fragment key={key}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedRow(isExpanded ? null : key)}
                      >
                        <TableCell className="w-8 px-3">
                          <ChevronRight
                            className={cn(
                              'h-4 w-4 text-muted-foreground transition-transform',
                              isExpanded && 'rotate-90'
                            )}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{item.integration_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[300px]">
                          {item.notes || '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {item.project_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.is_new ? (
                            <Badge className="bg-success/15 text-success dark:bg-success/15 dark:text-success text-[11px] font-semibold border-0">
                              Nova
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="bg-muted/30 px-6 py-3 border-b">
                            <div className="space-y-1">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Empresas que utilizam
                              </span>
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                {item.companies.length > 0 ? (
                                  item.companies.map((c) => (
                                    <Badge key={c} variant="outline" className="text-xs gap-1 font-normal">
                                      <Building2 className="h-3 w-3" />
                                      {c}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">Sem dados de empresa</span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground tabular-nums">
              {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2 tabular-nums">{safePage + 1}/{totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
