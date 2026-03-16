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
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { useProducts, type Product } from '@/hooks/useProducts';
import { SetupProductDialog } from './SetupProductDialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { Loader2 } from 'lucide-react';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const SetupPlansTable = () => {
  const { products, isLoading, createProduct, updateProduct, deleteProduct } = useProducts('setup_integracoes');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const handleCreate = () => { setEditingProduct(null); setDialogOpen(true); };
  const handleEdit = (product: Product) => { setEditingProduct(product); setDialogOpen(true); };

  const handleSave = (data: any) => {
    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, ...data }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createProduct.mutate({ ...data, category: 'setup_integracoes' }, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleDelete = () => {
    if (deletingProduct) {
      deleteProduct.mutate(deletingProduct.id, { onSuccess: () => setDeletingProduct(null) });
    }
  };

  const columns = useMemo<ColumnDef<Product, unknown>[]>(() => [
    { id: 'grip', header: () => null, cell: () => <GripVertical className="h-4 w-4 text-muted-foreground" />, enableSorting: false, size: 40 },
    { accessorKey: 'name', header: ({ column }) => <TableColumnHeader column={column} title="NOME" />, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'subcategory', header: ({ column }) => <TableColumnHeader column={column} title="CATEGORIA" />, cell: ({ row }) => <div className="text-center"><Badge variant="outline">{row.original.subcategory || '-'}</Badge></div> },
    { accessorKey: 'price', header: ({ column }) => <TableColumnHeader column={column} title="PREÇO" />, cell: ({ row }) => <span className="text-center block">{formatCurrency(row.original.price)}</span> },
    { accessorKey: 'frequency', header: ({ column }) => <TableColumnHeader column={column} title="FREQUÊNCIA" />, cell: ({ row }) => <div className="text-center"><Badge variant={row.original.frequency === 'monthly' ? 'default' : 'secondary'}>{row.original.frequency === 'monthly' ? 'Mensal' : 'Único'}</Badge></div> },
    {
      id: 'actions', header: () => <span className="text-right block">AÇÕES</span>, enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(row.original); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeletingProduct(row.original); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ], []);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gerencie os produtos disponíveis na biblioteca de propostas comerciais.</p>
        <Button onClick={handleCreate} className="gap-2"><Plus className="h-4 w-4" />Novo Produto</Button>
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
      <SetupProductDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editingProduct} onSave={handleSave} isLoading={createProduct.isPending || updateProduct.isPending} />
      <ConfirmDeleteDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)} title="Excluir produto" description={`Tem certeza que deseja excluir "${deletingProduct?.name}"? Esta ação não pode ser desfeita.`} onConfirm={handleDelete} isDeleting={deleteProduct.isPending} />
    </div>
  );
};