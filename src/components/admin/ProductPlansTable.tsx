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
import { ProductPlanDialog } from './ProductPlanDialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { Loader2 } from 'lucide-react';

interface ProductPlansTableProps {
  category: string;
  description: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR').format(value);

export const ProductPlansTable = ({ category, description }: ProductPlansTableProps) => {
  const { products, isLoading, createProduct, updateProduct, deleteProduct } = useProducts(category);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const handleCreate = () => { setEditingProduct(null); setDialogOpen(true); };
  const handleEdit = (product: Product) => { setEditingProduct(product); setDialogOpen(true); };

  const handleSave = (data: any) => {
    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, ...data }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createProduct.mutate({ ...data, category }, { onSuccess: () => setDialogOpen(false) });
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
    { accessorKey: 'price', header: ({ column }) => <TableColumnHeader column={column} title="PREÇO" />, cell: ({ row }) => <span className="text-center block">{formatCurrency(row.original.price)}</span> },
    { accessorKey: 'messages_included', header: ({ column }) => <TableColumnHeader column={column} title="MENSAGENS" />, cell: ({ row }) => <span className="text-center block">{formatNumber(row.original.messages_included)}</span> },
    { accessorKey: 'contacts_included', header: ({ column }) => <TableColumnHeader column={column} title="CONTATOS" />, cell: ({ row }) => <span className="text-center block">{formatNumber(row.original.contacts_included)}</span> },
    { accessorKey: 'excess_message_price', header: 'EXC. MSG', cell: ({ row }) => <span className="text-center block">{formatCurrency(row.original.excess_message_price)}</span>, enableSorting: false },
    { accessorKey: 'excess_contact_price', header: 'EXC. CONTATO', cell: ({ row }) => <span className="text-center block">{formatCurrency(row.original.excess_contact_price)}</span>, enableSorting: false },
    {
      id: 'actions', header: () => <span className="text-right block">AÇÕES</span>, enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          {!row.original.active && <Button variant="ghost" size="icon" title="Plano inativo" disabled><EyeOff className="h-4 w-4" /></Button>}
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(row.original); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeletingProduct(row.original); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ], [category]);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{description}</p>
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
      <ProductPlanDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editingProduct} onSave={handleSave} isLoading={createProduct.isPending || updateProduct.isPending} />
      <ConfirmDeleteDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)} title="Excluir plano" description={`Tem certeza que deseja excluir o plano "${deletingProduct?.name}"? Esta ação não pode ser desfeita.`} onConfirm={handleDelete} isDeleting={deleteProduct.isPending} />
    </div>
  );
};