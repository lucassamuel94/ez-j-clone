import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, X } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';

interface EZCallPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSave: (data: any) => void;
  isLoading?: boolean;
}

export const EZCallPlanDialog = ({ open, onOpenChange, product, onSave, isLoading }: EZCallPlanDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [customPricing, setCustomPricing] = useState(false);
  const [minExtensions, setMinExtensions] = useState('0');
  const [maxExtensions, setMaxExtensions] = useState('0');
  const [pricePerExtension, setPricePerExtension] = useState('0');
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState('');
  const [recommended, setRecommended] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description || '');
      setCustomPricing(product.custom_pricing || false);
      setMinExtensions((product.min_extensions || 0).toString());
      setMaxExtensions((product.max_extensions || 0).toString());
      setPricePerExtension((product.price_per_extension || 0).toString());
      setFeatures((product.features as string[]) || []);
      setRecommended(product.recommended);
      setActive(product.active);
    } else {
      setName(''); setDescription(''); setCustomPricing(false);
      setMinExtensions('0'); setMaxExtensions('0'); setPricePerExtension('0');
      setFeatures([]); setNewFeature(''); setRecommended(false); setActive(true);
    }
  }, [product, open]);

  const addFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description,
      custom_pricing: customPricing,
      min_extensions: parseInt(minExtensions) || 0,
      max_extensions: parseInt(maxExtensions) || 0,
      price_per_extension: parseFloat(pricePerExtension) || 0,
      features,
      recommended,
      active,
      price: 0,
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
          <DialogTitle>{isEdit ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome do Plano <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: EZ Call BASIC, BUSINESS..." />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Plano BASIC - 10 a 20 ramais (Link de voz não incluso)" rows={3} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={customPricing} onCheckedChange={setCustomPricing} />
            <Label>Preço sob consulta (personalizado)</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Mín. Ramais</Label>
              <Input type="number" value={minExtensions} onChange={e => setMinExtensions(e.target.value)} />
            </div>
            <div>
              <Label>Máx. Ramais</Label>
              <Input type="number" value={maxExtensions} onChange={e => setMaxExtensions(e.target.value)} />
            </div>
          </div>
          {!customPricing && (
            <div>
              <Label>Preço por Ramal (R$/mês)</Label>
              <Input type="number" step="0.01" value={pricePerExtension} onChange={e => setPricePerExtension(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Recursos Inclusos</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newFeature}
                onChange={e => setNewFeature(e.target.value)}
                placeholder="Ex: URA Inteligente"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())}
              />
              <Button type="button" variant="outline" size="icon" onClick={addFeature}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {features.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {features.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
                    {f}
                    <button onClick={() => removeFeature(i)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={recommended} onCheckedChange={setRecommended} />
              <Label>Destacar como recomendado</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>Ativo</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || isLoading}>
            {isEdit ? 'Salvar Alterações' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
