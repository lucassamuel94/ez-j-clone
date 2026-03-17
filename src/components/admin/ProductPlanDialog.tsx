import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { Product } from '@/hooks/useProducts';

interface ProductPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSave: (data: {
    name: string;
    price: number;
    messages_included: number;
    contacts_included: number;
    excess_message_price: number;
    excess_contact_price: number;
    description: string;
    active: boolean;
    recommended: boolean;
  }) => void;
  isLoading?: boolean;
}

export const ProductPlanDialog = ({ open, onOpenChange, product, onSave, isLoading }: ProductPlanDialogProps) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [messagesIncluded, setMessagesIncluded] = useState('0');
  const [contactsIncluded, setContactsIncluded] = useState('0');
  const [excessMessagePrice, setExcessMessagePrice] = useState('0');
  const [excessContactPrice, setExcessContactPrice] = useState('0');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [recommended, setRecommended] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setPrice(product.price.toString());
      setMessagesIncluded(product.messages_included.toString());
      setContactsIncluded(product.contacts_included.toString());
      setExcessMessagePrice(product.excess_message_price.toString());
      setExcessContactPrice(product.excess_contact_price.toString());
      setDescription(product.description || '');
      setActive(product.active);
      setRecommended(product.recommended);
    } else {
      setName(''); setPrice('0'); setMessagesIncluded('0'); setContactsIncluded('0');
      setExcessMessagePrice('0'); setExcessContactPrice('0'); setDescription('');
      setActive(true); setRecommended(false);
    }
  }, [product, open]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      price: parseFloat(price) || 0,
      messages_included: parseInt(messagesIncluded) || 0,
      contacts_included: parseInt(contactsIncluded) || 0,
      excess_message_price: parseFloat(excessMessagePrice) || 0,
      excess_contact_price: parseFloat(excessContactPrice) || 0,
      description,
      active,
      recommended,
    });
  };

  const isEdit = !!product;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="plan-name">Nome do Plano <span className="text-destructive">*</span></Label>
            <Input id="plan-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Starter, Basic, Plus..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Preço (R$)</Label>
              <Input type="number" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <div>
              <Label>Mensagens Incluídas</Label>
              <Input type="number" value={messagesIncluded} onChange={e => setMessagesIncluded(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Contatos Incluídos</Label>
              <Input type="number" value={contactsIncluded} onChange={e => setContactsIncluded(e.target.value)} />
            </div>
            <div>
              <Label>Excedente Mensagem (R$)</Label>
              <Input type="number" step="0.0001" value={excessMessagePrice} onChange={e => setExcessMessagePrice(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <Label>Excedente Contato (R$)</Label>
              <Input type="number" step="0.0001" value={excessContactPrice} onChange={e => setExcessContactPrice(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>Plano Ativo</Label>
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve descrição do plano..." rows={3} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={recommended} onCheckedChange={setRecommended} />
            <Label>Destacar como Recomendado</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || isLoading}>
            {isEdit ? 'Salvar Alterações' : 'Criar Plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
