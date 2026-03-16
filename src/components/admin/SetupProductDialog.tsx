import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Product } from '@/hooks/useProducts';

interface SetupProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSave: (data: any) => void;
  isLoading?: boolean;
}

export const SetupProductDialog = ({ open, onOpenChange, product, onSave, isLoading }: SetupProductDialogProps) => {
  const [name, setName] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [price, setPrice] = useState('0');
  const [frequency, setFrequency] = useState('unique');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setSubcategory(product.subcategory || '');
      setPrice(product.price.toString());
      setFrequency(product.frequency || 'unique');
      setDescription(product.description || '');
      setActive(product.active);
    } else {
      setName(''); setSubcategory(''); setPrice('0');
      setFrequency('unique'); setDescription(''); setActive(true);
    }
  }, [product, open]);

  const handleSave = () => {
    if (!name.trim() || !subcategory.trim()) return;
    onSave({
      name: name.trim(),
      subcategory: subcategory.trim(),
      price: parseFloat(price) || 0,
      frequency,
      description,
      active,
      recommended: false,
      messages_included: 0,
      contacts_included: 0,
      excess_message_price: 0,
      excess_contact_price: 0,
    });
  };

  const isEdit = !!product;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome do Produto <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Integração OpenAI" />
          </div>
          <div>
            <Label>Categoria <span className="text-destructive">*</span></Label>
            <Input value={subcategory} onChange={e => setSubcategory(e.target.value)} placeholder="Ex: Integrações, Setup, Treinamento..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <div>
              <Label>Frequência</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unique">Pagamento Único</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição detalhada do produto..." rows={3} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Produto Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || !subcategory.trim() || isLoading}>
            {isEdit ? 'Salvar Alterações' : 'Criar Produto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
