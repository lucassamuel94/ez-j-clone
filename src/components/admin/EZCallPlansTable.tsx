import { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
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
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, GripVertical, EyeOff } from 'lucide-react';
import { useProducts, type Product } from '@/hooks/useProducts';
import { EZCallPlanDialog } from './EZCallPlanDialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { Loader2 } from 'lucide-react';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const EZCallPlansTable = () => {
  const { products, isLoading, createProduct, updateProduct, deleteProduct } = useProducts('ez_call');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const handleCreate = () => { setEditingProduct(null); setDialogOpen(true); };
  const handleEdit = (product: Product) => { setEditingProduct(product); setDialogOpen(true); };

  const handleSave = (data: any) => {
    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, ...data }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createProduct.mutate({ ...data, category: 'ez_call' }, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleDelete = () => {
    if (deletingProduct) {
      deleteProduct.mutate(deletingProduct.id, { onSuccess: () => setDeletingProduct(null) });
    }
  };

  const getRamaisDisplay = (p: Product) => {
    if (p.custom_pricing) return 'Sob consulta';
    if (p.min_extensions && p.max_extensions) return `${p.min_extensions} a ${p.max_extensions}`;
    return '-';
  };

  const columns = useMemo<ColumnDef<Product, unknown>[]>(() => [
    {
      id: 'grip',
      header: () => null,
      cell: () => <GripVertical className="h-4 w-4 text-muted-foreground" />,
      enableSorting: false,
      size: 40,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <TableColumnHeader column={column} title="NOME" />,
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.name}</span>
          {row.original.description && <p className="text-xs text-muted-foreground">{row.original.description}</p>}
        </div>
      ),
    },
    {
      id: 'ramais',
      header: 'RAMAIS',
      cell: ({ row }) => <span className="text-center block">{getRamaisDisplay(row.original)}</span>,
      enableSorting: false,
    },
    {
      id: 'price_per_extension',
      header: 'PREÇO/RAMAL',
      cell: ({ row }) => (
        <span className="text-center block">
          {row.original.custom_pricing ? '-' : formatCurrency(row.original.price_per_extension || 0)}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: 'features',
      header: 'RECURSOS',
      cell: ({ row }) => (
        <span className="text-center block">
          {(row.original.features as string[] | null)?.length || 0}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: 'actions',
      header: () => <span className="text-right block">AÇÕES</span>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          {!row.original.active && <Button variant="ghost" size="icon" disabled><EyeOff className="h-4 w-4" /></Button>}
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(row.original); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeletingProduct(row.original); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
      enableSorting: false,
    },
  ], []);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gerencie os planos EZ Call exibidos nas propostas comerciais.</p>
        <Button onClick={handleCreate} className="gap-2"><Plus className="h-4 w-4" />Novo Plano</Button>
      </div>
      <div className="rounded-md border">
        <TableProvider columns={columns} data={products}>
          <TableHeader>
            {({ headerGroup }) => (
              <TableHeaderGroup headerGroup={headerGroup}>
                {({ header }) => <TableHead header={header} />}
              </TableHeaderGroup>
            )}
          </TableHeader>
          <TableBody>
            {({ row }) => {
              const product = row.original as Product;
              return (
                <TableRow key={row.id} row={row} className={!product.active ? 'opacity-50' : ''}>
                  {({ cell }) => <TableCell cell={cell} />}
                </TableRow>
              );
            }}
          </TableBody>
        </TableProvider>
      </div>
      <EZCallPlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editingProduct}
        onSave={handleSave}
        isLoading={createProduct.isPending || updateProduct.isPending}
      />
      <ConfirmDeleteDialog
        open={!!deletingProduct}
        onOpenChange={(open) => !open && setDeletingProduct(null)}
        title="Excluir plano"
        description={`Tem certeza que deseja excluir o plano "${deletingProduct?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        isDeleting={deleteProduct.isPending}
      />
    </div>
  );
};