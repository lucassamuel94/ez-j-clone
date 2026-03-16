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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useProducts, type Product } from '@/hooks/useProducts';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';

const formatUsd = (v: number) => `US$ ${v.toFixed(4)}`;
const formatBrl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface MetaProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSave: (data: any) => void;
  isLoading?: boolean;
}

const MetaProductDialog = ({ open, onOpenChange, product, onSave, isLoading }: MetaProductDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceUsd, setPriceUsd] = useState('0');
  const [percentage, setPercentage] = useState('0');
  const [active, setActive] = useState(true);

  const isEdit = !!product;

  const handleOpenChange = (o: boolean) => {
    if (o && product) {
      setName(product.name); setDescription(product.description || '');
      setPriceUsd(product.price.toString()); setPercentage(((product.features as any)?.percentage ?? 0).toString());
      setActive(product.active);
    } else if (o) {
      setName(''); setDescription(''); setPriceUsd('0'); setPercentage('0'); setActive(true);
    }
    onOpenChange(o);
  };

  if (open && product && name !== product.name) {
    setName(product.name); setDescription(product.description || '');
    setPriceUsd(product.price.toString()); setPercentage(((product.features as any)?.percentage ?? 0).toString());
    setActive(product.active);
  }

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(), description, price: parseFloat(priceUsd) || 0, active,
      recommended: false, messages_included: 0, contacts_included: 0,
      excess_message_price: 0, excess_contact_price: 0, subcategory: 'Conversa',
      frequency: 'monthly', features: { percentage: parseFloat(percentage) || 0 },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar Tipo de Conversa' : 'Novo Tipo de Conversa'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Nome <span className="text-destructive">*</span></Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Marketing" /></div>
          <div><Label>Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição do tipo de conversa..." rows={2} /></div>
          <div><Label>Preço por conversa (USD)</Label><Input type="number" step="0.0001" value={priceUsd} onChange={e => setPriceUsd(e.target.value)} /></div>
          <div>
            <Label className="flex items-center gap-1">
              Distribuição (%)
              <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent><p className="max-w-xs text-xs">Percentual dos contatos que geram este tipo de conversa. A soma de todos os tipos deve ser 100%.</p></TooltipContent></Tooltip></TooltipProvider>
            </Label>
            <Input type="number" step="1" min="0" max="100" value={percentage} onChange={e => setPercentage(e.target.value)} />
          </div>
          <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><Label>Ativo</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || isLoading}>{isEdit ? 'Salvar' : 'Criar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const MetaCostsTable = () => {
  const { products, isLoading, createProduct, updateProduct, deleteProduct } = useProducts('meta_custos');
  const { data: exchangeRate, isLoading: loadingRate } = useExchangeRate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const rate = exchangeRate?.rate ?? 5.70;
  const configProduct = products.find(p => p.subcategory === 'config');
  const conversationProducts = products.filter(p => p.subcategory !== 'config');
  const conversationsPerContact = (configProduct?.features as any)?.conversations_per_contact ?? 1;

  const [editingMultiplier, setEditingMultiplier] = useState(false);
  const [multiplierValue, setMultiplierValue] = useState(conversationsPerContact.toString());

  if (!editingMultiplier && multiplierValue !== conversationsPerContact.toString()) {
    setMultiplierValue(conversationsPerContact.toString());
  }

  const handleCreate = () => { setEditingProduct(null); setDialogOpen(true); };
  const handleEdit = (p: Product) => { setEditingProduct(p); setDialogOpen(true); };

  const handleSave = (data: any) => {
    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, ...data }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createProduct.mutate({ ...data, category: 'meta_custos' }, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleDelete = () => {
    if (deletingProduct) {
      deleteProduct.mutate(deletingProduct.id, { onSuccess: () => setDeletingProduct(null) });
    }
  };

  const saveMultiplier = () => {
    const val = parseFloat(multiplierValue) || 1;
    const payload: any = {
      name: '_meta_config', description: 'Configuração interna do simulador Meta', price: 0, active: true,
      recommended: false, messages_included: 0, contacts_included: 0, excess_message_price: 0, excess_contact_price: 0,
      min_extensions: 0, max_extensions: 0, price_per_extension: 0, custom_pricing: false,
      subcategory: 'config', frequency: 'monthly', features: { conversations_per_contact: val } as any,
    };
    if (configProduct) {
      updateProduct.mutate({ id: configProduct.id, ...payload }, { onSuccess: () => setEditingMultiplier(false) });
    } else {
      createProduct.mutate({ ...payload, category: 'meta_custos' }, { onSuccess: () => setEditingMultiplier(false) });
    }
  };

  const columns = useMemo<ColumnDef<Product, unknown>[]>(() => [
    { accessorKey: 'name', header: ({ column }) => <TableColumnHeader column={column} title="NOME" />, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'description', header: 'DESCRIÇÃO', cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.description || '—'}</span>, enableSorting: false },
    { id: 'distribution', header: 'DISTRIBUIÇÃO', cell: ({ row }) => <div className="text-center"><Badge variant="secondary" className="font-mono">{(row.original.features as any)?.percentage ?? 0}%</Badge></div>, enableSorting: false },
    { accessorKey: 'price', header: ({ column }) => <TableColumnHeader column={column} title="VALOR (USD)" />, cell: ({ row }) => <span className="text-center block font-mono">{formatUsd(row.original.price)}</span> },
    { id: 'price_brl', header: 'VALOR (BRL)', cell: ({ row }) => <span className="text-center block font-mono">{formatBrl(row.original.price * rate)}</span>, enableSorting: false },
    {
      id: 'actions', header: () => <span className="text-right block">AÇÕES</span>, enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(row.original); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeletingProduct(row.original); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ], [rate]);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Custos por tipo de conversa Meta (WhatsApp Business API). Valores em USD convertidos automaticamente.</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{loadingRate ? 'Carregando câmbio...' : `Câmbio: 1 USD = ${rate.toFixed(2)} BRL`}</Badge>
            {exchangeRate?.source && exchangeRate.source !== 'fallback' && <Badge variant="secondary" className="text-xs">Fonte: {exchangeRate.source}</Badge>}
          </div>
        </div>
        <Button onClick={handleCreate} className="gap-2"><Plus className="h-4 w-4" />Novo Tipo</Button>
      </div>

      <div className="rounded-md border">
        <TableProvider columns={columns} data={conversationProducts}>
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

      {/* Editable premise */}
      <Alert variant="default" className="mt-2">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span><strong>Premissa:</strong> cada contato abre</span>
            {editingMultiplier ? (
              <span className="inline-flex items-center gap-1.5">
                <Input type="number" step="0.1" min="0.1" value={multiplierValue} onChange={e => setMultiplierValue(e.target.value)} className="w-20 h-7 text-sm text-center" />
                <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={saveMultiplier} disabled={updateProduct.isPending || createProduct.isPending}>Salvar</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditingMultiplier(false); setMultiplierValue(conversationsPerContact.toString()); }}>Cancelar</Button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Badge variant="outline" className="font-mono cursor-pointer hover:bg-accent" onClick={() => { setMultiplierValue(conversationsPerContact.toString()); setEditingMultiplier(true); }}>
                  {conversationsPerContact} {conversationsPerContact === 1 ? 'conversa' : 'conversas'}
                </Badge>
                <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => { setMultiplierValue(conversationsPerContact.toString()); setEditingMultiplier(true); }}><Pencil className="h-3 w-3" /></Button>
              </span>
            )}
            <span>por mês, distribuída(s) proporcionalmente entre os tipos.</span>
          </div>
          {(() => {
            const totalPerc = conversationProducts.reduce((sum, p) => sum + ((p.features as any)?.percentage ?? 0), 0);
            const isValid = Math.abs(totalPerc - 100) < 0.01;
            return <p className={`text-xs ${isValid ? 'text-muted-foreground' : 'text-destructive font-medium'}`}>Soma das distribuições: <strong>{totalPerc}%</strong>{!isValid && ' — deve totalizar 100%.'}</p>;
          })()}
        </AlertDescription>
      </Alert>

      <MetaProductDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editingProduct} onSave={handleSave} isLoading={createProduct.isPending || updateProduct.isPending} />
      <ConfirmDeleteDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)} title="Excluir tipo de conversa" description={`Tem certeza que deseja excluir "${deletingProduct?.name}"? Esta ação não pode ser desfeita.`} onConfirm={handleDelete} isDeleting={deleteProduct.isPending} />
    </div>
  );
};