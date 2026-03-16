import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useDeliveries, useDeleteDelivery, useUpdateDelivery, DeliveryRecord } from '@/hooks/useDeliveries';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useSystemUsers } from '@/hooks/useSystemUsers';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { Search, ChevronDown, Sparkles, X, PackageCheck, Pencil, Trash2, Check, ChevronsUpDown, MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COMPLEXITY_COLORS: Record<string, string> = {
  'Baixo': 'bg-success/10 text-success',
  'Médio': 'bg-warning/10 text-warning',
  'Alto': 'bg-destructive/10 text-destructive',
};

export default function DeliveriesPage() {
  const { data: deliveries, isLoading } = useDeliveries();
  const { isAdmin } = useAdminUsers();
  const deleteDelivery = useDeleteDelivery();
  const updateDelivery = useUpdateDelivery();
  const { data: systemUsers = [] } = useSystemUsers();

  const [search, setSearch] = useState('');
  const [integrationFilter, setIntegrationFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [versionFilter, setVersionFilter] = useState('all');
  const [complexityFilter, setComplexityFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Admin dialogs
  const [deleteTarget, setDeleteTarget] = useState<DeliveryRecord | null>(null);
  const [editTarget, setEditTarget] = useState<DeliveryRecord | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const filterOptions = useMemo(() => {
    if (!deliveries) return { integrations: [], types: [], versions: [], complexities: [] };
    const intSet = new Set<string>();
    const typeSet = new Set<string>();
    const versionSet = new Set<string>();
    const complexitySet = new Set<string>();

    for (const d of deliveries) {
      if (d.project_type_label) typeSet.add(d.project_type_label);
      if (d.version) versionSet.add(d.version);
      if (d.complexity_level) complexitySet.add(d.complexity_level);
      for (const i of d.integrations) intSet.add(i.integration_name);
    }

    return {
      integrations: Array.from(intSet).sort(),
      types: Array.from(typeSet).sort(),
      versions: Array.from(versionSet).sort(),
      complexities: Array.from(complexitySet).sort(),
    };
  }, [deliveries]);

  const filtered = useMemo(() => {
    if (!deliveries) return [];
    let result = deliveries;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) =>
        d.company_name?.toLowerCase().includes(q) ||
        d.observations?.toLowerCase().includes(q) ||
        d.cnpj?.includes(q) ||
        d.integrations.some((i) => i.integration_name.toLowerCase().includes(q))
      );
    }

    if (integrationFilter !== 'all') result = result.filter((d) => d.integrations.some((i) => i.integration_name === integrationFilter));
    if (typeFilter !== 'all') result = result.filter((d) => d.project_type_label === typeFilter);
    if (versionFilter !== 'all') result = result.filter((d) => d.version === versionFilter);
    if (complexityFilter !== 'all') result = result.filter((d) => d.complexity_level === complexityFilter);

    return result;
  }, [deliveries, search, integrationFilter, typeFilter, versionFilter, complexityFilter]);

  const activeFilterCount = [integrationFilter, typeFilter, versionFilter, complexityFilter].filter((f) => f !== 'all').length;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setIntegrationFilter('all');
    setTypeFilter('all');
    setVersionFilter('all');
    setComplexityFilter('all');
  };

  const handleIntegrationClick = (name: string) => setIntegrationFilter(name);

  const openEdit = (d: DeliveryRecord) => {
    setEditTarget(d);
    setEditForm({
      company_name: d.company_name || '',
      cnpj: d.cnpj || '',
      project_type_label: d.project_type_label || '',
      version: d.version || '',
      complexity_level: d.complexity_level || '',
      ux_responsible: d.ux_responsible || '',
      dev_responsible: d.dev_responsible || '',
      closer_name: d.closer_name || '',
      observations: d.observations || '',
      uses_gpt: d.uses_gpt,
      admin_link: d.admin_link || '',
    });
  };

  const handleSaveEdit = () => {
    if (!editTarget) return;
    updateDelivery.mutate({ id: editTarget.id, data: editForm }, {
      onSuccess: () => setEditTarget(null),
    });
  };

  // Filter selects shared between desktop and mobile
  const filterSelects = (
    <>
      <Select value={integrationFilter} onValueChange={setIntegrationFilter}>
        <SelectTrigger className="w-full md:w-[180px] h-9"><SelectValue placeholder="Integração" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas integrações</SelectItem>
          {filterOptions.integrations.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="w-full md:w-[150px] h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos tipos</SelectItem>
          {filterOptions.types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={versionFilter} onValueChange={setVersionFilter}>
        <SelectTrigger className="w-full md:w-[120px] h-9"><SelectValue placeholder="Versão" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas versões</SelectItem>
          {filterOptions.versions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={complexityFilter} onValueChange={setComplexityFilter}>
        <SelectTrigger className="w-full md:w-[150px] h-9"><SelectValue placeholder="Complexidade" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas complexidades</SelectItem>
          {filterOptions.complexities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
    </>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[220px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa, integração, observações..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Desktop: inline filters */}
      <div className="hidden md:flex items-center gap-3">
        {filterSelects}
      </div>

      {/* Mobile: filters in popover */}
      <div className="md:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[11px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-3" align="end">
            {filterSelects}
          </PopoverContent>
        </Popover>
      </div>

      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-muted-foreground hover:text-foreground gap-1">
          <X className="h-3.5 w-3.5" /> Limpar
        </Button>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="px-4 sm:px-6 py-6 space-y-5">
          <PageHeader
            icon={<PackageCheck className="h-5 w-5" />}
            title="Projetos Entregues"
            subtitle="Base de conhecimento"
            count={deliveries?.length}
            toolbar={toolbar}
          />

          {/* Active filter tags */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {integrationFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setIntegrationFilter('all')}>
                  Integração: {integrationFilter} <X className="h-3 w-3" />
                </Badge>
              )}
              {typeFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setTypeFilter('all')}>
                  Tipo: {typeFilter} <X className="h-3 w-3" />
                </Badge>
              )}
              {versionFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setVersionFilter('all')}>
                  Versão: {versionFilter} <X className="h-3 w-3" />
                </Badge>
              )}
              {complexityFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setComplexityFilter('all')}>
                  Complexidade: {complexityFilter} <X className="h-3 w-3" />
                </Badge>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {isLoading ? 'Carregando...' : `${filtered.length} de ${deliveries?.length || 0} entregas`}
          </p>

          {/* Table */}
          <div className="border border-border rounded-lg bg-card">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Empresa</TableHead>
                    <TableHead>Tipo / Versão</TableHead>
                    <TableHead>Complexidade</TableHead>
                    <TableHead>IA</TableHead>
                    <TableHead>Integrações</TableHead>
                    <TableHead>UX/PO</TableHead>
                    <TableHead>Dev</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead>Entrega</TableHead>
                    {isAdmin && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: isAdmin ? 11 : 10 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))}

                  {!isLoading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 11 : 10} className="text-center py-12">
                        <PackageCheck className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">Nenhuma entrega encontrada</p>
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading && filtered.map((d) => (
                    <DeliveryRow
                      key={d.id}
                      delivery={d}
                      expanded={expandedIds.has(d.id)}
                      onToggle={() => toggleExpand(d.id)}
                      onIntegrationClick={handleIntegrationClick}
                      isAdmin={!!isAdmin}
                      onEdit={openEdit}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteDelivery.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
          }
        }}
        description={`Tem certeza que deseja excluir a entrega "${deleteTarget?.company_name || ''}"? Esta ação não pode ser desfeita.`}
        isDeleting={deleteDelivery.isPending}
      />

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Entrega</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label className="text-xs">Empresa</Label>
              <Input value={editForm.company_name || ''} onChange={(e) => setEditForm(p => ({ ...p, company_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">CNPJ</Label>
              <Input value={editForm.cnpj || ''} onChange={(e) => setEditForm(p => ({ ...p, cnpj: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Link Admin</Label>
              <Input value={editForm.admin_link || ''} onChange={(e) => setEditForm(p => ({ ...p, admin_link: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Tipo de Projeto</Label>
              <Input value={editForm.project_type_label || ''} onChange={(e) => setEditForm(p => ({ ...p, project_type_label: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Versão</Label>
              <Input value={editForm.version || ''} onChange={(e) => setEditForm(p => ({ ...p, version: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Complexidade</Label>
              <Select value={editForm.complexity_level || ''} onValueChange={(v) => setEditForm(p => ({ ...p, complexity_level: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baixo">Baixo</SelectItem>
                  <SelectItem value="Médio">Médio</SelectItem>
                  <SelectItem value="Alto">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editForm.uses_gpt || false} onCheckedChange={(v) => setEditForm(p => ({ ...p, uses_gpt: v }))} />
              <Label className="text-xs">Usa IA</Label>
            </div>
            <UserCombobox label="UX/PO" value={editForm.ux_responsible || ''} users={systemUsers} onChange={(v) => setEditForm(p => ({ ...p, ux_responsible: v }))} />
            <UserCombobox label="Dev Chatbot" value={editForm.dev_responsible || ''} users={systemUsers} onChange={(v) => setEditForm(p => ({ ...p, dev_responsible: v }))} />
            <UserCombobox label="Closer" value={editForm.closer_name || ''} users={systemUsers} onChange={(v) => setEditForm(p => ({ ...p, closer_name: v }))} />
            <div className="col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea value={editForm.observations || ''} onChange={(e) => setEditForm(p => ({ ...p, observations: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={updateDelivery.isPending}>
              {updateDelivery.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function DeliveryRow({
  delivery: d,
  expanded,
  onToggle,
  onIntegrationClick,
  isAdmin,
  onEdit,
  onDelete,
}: {
  delivery: DeliveryRecord;
  expanded: boolean;
  onToggle: () => void;
  onIntegrationClick: (name: string) => void;
  isAdmin: boolean;
  onEdit: (d: DeliveryRecord) => void;
  onDelete: (d: DeliveryRecord) => void;
}) {
  const mainRow = (
    <TableRow className="cursor-pointer group" onClick={onToggle}>
      <TableCell className="px-2">
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </TableCell>
      <TableCell>
        <div>
          <p className="text-sm font-medium text-foreground">{d.company_name || '—'}</p>
          {d.cnpj && <p className="text-xs text-muted-foreground">{d.cnpj}</p>}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {d.project_type_label && <Badge variant="outline" className="text-[11px]">{d.project_type_label}</Badge>}
          {d.version && <Badge variant="secondary" className="text-[11px]">{d.version}</Badge>}
        </div>
      </TableCell>
      <TableCell>
        {d.complexity_level ? (
          <Badge className={`text-[11px] border-0 ${COMPLEXITY_COLORS[d.complexity_level] || ''}`}>{d.complexity_level}</Badge>
        ) : '—'}
      </TableCell>
      <TableCell>
        {d.uses_gpt ? (
          <Sparkles className="h-4 w-4 text-warning" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {d.integrations.slice(0, 3).map((i) => (
            <Badge
              key={i.id}
              variant="secondary"
              className="text-[11px] cursor-pointer hover:bg-primary/10"
              onClick={(e) => { e.stopPropagation(); onIntegrationClick(i.integration_name); }}
            >
              {i.integration_name}
            </Badge>
          ))}
          {d.integrations.length > 3 && (
            <Badge variant="outline" className="text-[11px]">+{d.integrations.length - 3}</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{d.ux_responsible || '—'}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{d.dev_responsible || '—'}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{d.closer_name || '—'}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {format(new Date(d.delivered_at), "dd MMM yyyy", { locale: ptBR })}
      </TableCell>
      {isAdmin && (
        <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(d)} className="gap-2">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(d)} className="gap-2 text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}
    </TableRow>
  );

  const expandedRow = expanded ? (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell colSpan={isAdmin ? 11 : 10} className="py-4 px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {d.observations && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Observações</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{d.observations}</p>
            </div>
          )}
          {d.integrations.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Integrações ({d.integrations.length})</p>
              <div className="space-y-1.5">
                {d.integrations.map((i) => (
                  <div key={i.id} className="flex items-start gap-2">
                    <Badge
                      variant="secondary"
                      className="text-[11px] shrink-0 cursor-pointer hover:bg-primary/10"
                      onClick={() => onIntegrationClick(i.integration_name)}
                    >
                      {i.integration_name}
                      {i.is_new && <span className="ml-1 text-success">★</span>}
                    </Badge>
                    {i.notes && <span className="text-xs text-muted-foreground">{i.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  ) : null;

  // Fix 2: ContextMenu wraps only mainRow; expandedRow is a sibling
  if (!isAdmin) return <>{mainRow}{expandedRow}</>;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {mainRow}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onEdit(d)} className="gap-2">
            <Pencil className="h-3.5 w-3.5" /> Editar entrega
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDelete(d)} className="gap-2 text-destructive focus:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Excluir entrega
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {expandedRow}
    </>
  );
}

function UserCombobox({ label, value, users, onChange }: { label: string; value: string; users: { id: string; name: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-9 font-normal">
            {value || 'Selecione...'}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar usuário..." />
            <CommandList>
              <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
              <CommandGroup>
                <CommandItem value="__none__" onSelect={() => { onChange(''); setOpen(false); }}>
                  <Check className={cn('mr-2 h-3.5 w-3.5', !value ? 'opacity-100' : 'opacity-0')} />
                  Nenhum
                </CommandItem>
                {users.map((u) => (
                  <CommandItem key={u.id} value={u.name} onSelect={() => { onChange(u.name); setOpen(false); }}>
                    <Check className={cn('mr-2 h-3.5 w-3.5', value === u.name ? 'opacity-100' : 'opacity-0')} />
                    {u.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
