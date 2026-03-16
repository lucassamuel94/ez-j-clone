import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  GripVertical, Trash2, Plus, X, Copy,
  Type, Hash, CheckSquare, ChevronDown, List, Calendar, Mail, Phone, AlignLeft,
  Globe, EyeOff, FileUp, Minus, Code2, CreditCard, GitBranch,
} from 'lucide-react';

export type FieldType =
  | 'text' | 'number' | 'checkbox' | 'combobox' | 'option_list'
  | 'date' | 'email' | 'phone' | 'textarea'
  | 'cpf' | 'cnpj' | 'url' | 'hidden' | 'html_info' | 'divider' | 'file_upload';

export interface ConditionalRule {
  field_id: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_empty';
  value?: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  regex?: string;
  regex_message?: string;
}

export type LeadFieldMapping =
  | '' | 'name' | 'email' | 'phone' | 'company' | 'cnpj'
  | 'razao_social' | 'nome_fantasia' | 'employee_count'
  | 'company_segment' | 'website' | 'whatsapp' | 'city' | 'state';

export const LEAD_FIELD_OPTIONS: { value: LeadFieldMapping; label: string }[] = [
  { value: '', label: 'Nenhum (campo extra)' },
  { value: 'name', label: 'Nome do contato' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'company', label: 'Empresa' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'razao_social', label: 'Razão Social' },
  { value: 'nome_fantasia', label: 'Nome Fantasia' },
  { value: 'employee_count', label: 'Nº Funcionários' },
  { value: 'company_segment', label: 'Segmento' },
  { value: 'website', label: 'Website' },
  { value: 'city', label: 'Cidade' },
  { value: 'state', label: 'Estado' },
];

export interface FieldConfig {
  id: string;
  type: FieldType;
  label: string;
  name?: string;
  placeholder: string;
  required: boolean;
  default_value: string;
  help_text?: string;
  options?: string[];
  validation?: FieldValidation;
  mask?: 'phone' | 'cpf' | 'cnpj' | 'none';
  width?: '100%' | '50%' | '33%';
  conditional?: ConditionalRule;
  html_content?: string;
  map_to?: LeadFieldMapping;
}

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ReactNode; group: string }[] = [
  { type: 'text', label: 'Texto', icon: <Type className="h-3.5 w-3.5" />, group: 'Básico' },
  { type: 'number', label: 'Número', icon: <Hash className="h-3.5 w-3.5" />, group: 'Básico' },
  { type: 'email', label: 'E-mail', icon: <Mail className="h-3.5 w-3.5" />, group: 'Básico' },
  { type: 'phone', label: 'Telefone', icon: <Phone className="h-3.5 w-3.5" />, group: 'Básico' },
  { type: 'textarea', label: 'Textarea', icon: <AlignLeft className="h-3.5 w-3.5" />, group: 'Básico' },
  { type: 'date', label: 'Data', icon: <Calendar className="h-3.5 w-3.5" />, group: 'Básico' },
  { type: 'url', label: 'URL', icon: <Globe className="h-3.5 w-3.5" />, group: 'Básico' },
  { type: 'checkbox', label: 'Caixas de Seleção', icon: <CheckSquare className="h-3.5 w-3.5" />, group: 'Seleção' },
  { type: 'combobox', label: 'Lista Suspensa', icon: <ChevronDown className="h-3.5 w-3.5" />, group: 'Seleção' },
  { type: 'option_list', label: 'Múltipla Escolha', icon: <List className="h-3.5 w-3.5" />, group: 'Seleção' },
  { type: 'cpf', label: 'CPF', icon: <CreditCard className="h-3.5 w-3.5" />, group: 'Documento' },
  { type: 'cnpj', label: 'CNPJ', icon: <CreditCard className="h-3.5 w-3.5" />, group: 'Documento' },
  { type: 'file_upload', label: 'Arquivo', icon: <FileUp className="h-3.5 w-3.5" />, group: 'Especial' },
  { type: 'hidden', label: 'Oculto', icon: <EyeOff className="h-3.5 w-3.5" />, group: 'Especial' },
  { type: 'html_info', label: 'HTML Info', icon: <Code2 className="h-3.5 w-3.5" />, group: 'Layout' },
  { type: 'divider', label: 'Divisor', icon: <Minus className="h-3.5 w-3.5" />, group: 'Layout' },
];

const generateId = () => 'field_' + Math.random().toString(36).substr(2, 8);

const getTypeInfo = (type: FieldType) => FIELD_TYPES.find(t => t.type === type);

const getDefaultMask = (type: FieldType): FieldConfig['mask'] => {
  if (type === 'cpf') return 'cpf';
  if (type === 'cnpj') return 'cnpj';
  if (type === 'phone') return 'phone';
  return 'none';
};

interface FormFieldBuilderProps {
  fields: FieldConfig[];
  onChange: (fields: FieldConfig[]) => void;
}

const FormFieldBuilder = ({ fields, onChange }: FormFieldBuilderProps) => {
  const [editingField, setEditingField] = useState<FieldConfig | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const addField = (type: FieldType) => {
    const typeInfo = getTypeInfo(type);
    const newField: FieldConfig = {
      id: generateId(),
      type,
      label: typeInfo?.label || 'Campo',
      name: '',
      placeholder: '',
      required: false,
      default_value: '',
      help_text: '',
      width: '100%',
      mask: getDefaultMask(type),
      ...(type === 'combobox' || type === 'option_list' || type === 'checkbox' ? { options: ['Opção 1', 'Opção 2'] } : {}),
      ...(type === 'number' ? { validation: {} } : {}),
      ...(type === 'html_info' ? { html_content: '<p>Texto informativo</p>' } : {}),
    };
    const updated = [...fields, newField];
    onChange(updated);
    setEditingField(newField);
  };

  const updateField = (id: string, patch: Partial<FieldConfig>) => {
    const updated = fields.map(f => f.id === id ? { ...f, ...patch } : f);
    onChange(updated);
    if (editingField?.id === id) {
      setEditingField({ ...editingField, ...patch });
    }
  };

  const removeField = (id: string) => {
    onChange(fields.filter(f => f.id !== id));
    if (editingField?.id === id) setEditingField(null);
  };

  const duplicateField = (field: FieldConfig) => {
    const newField = { ...field, id: generateId(), label: `${field.label} (cópia)` };
    const idx = fields.findIndex(f => f.id === field.id);
    const updated = [...fields];
    updated.splice(idx + 1, 0, newField);
    onChange(updated);
  };

  // Drag & drop with visual indicator
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  };

  const handleDragLeave = () => {
    // Only clear if leaving the entire list area
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null) return;
    const copy = [...fields];
    const [dragged] = copy.splice(dragIndex, 1);
    copy.splice(index, 0, dragged);
    onChange(copy);
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  // Group field types
  const groups = ['Básico', 'Seleção', 'Documento', 'Especial', 'Layout'];

  const hasOptions = (type: FieldType) => type === 'combobox' || type === 'option_list' || type === 'checkbox';
  const isLayoutField = (type: FieldType) => type === 'divider' || type === 'html_info';

  return (
    <div className="space-y-3">
      <Label className="text-xs mb-1 block">Campos do Formulário</Label>

      {/* Add field buttons grouped */}
      <div className="space-y-2">
        {groups.map(group => {
          const groupTypes = FIELD_TYPES.filter(ft => ft.group === group);
          return (
            <div key={group} className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{group}</p>
              <div className="flex flex-wrap gap-1">
                {groupTypes.map(ft => (
                  <Button
                    key={ft.type}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => addField(ft.type)}
                  >
                    {ft.icon}
                    {ft.label}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Field list */}
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Adicione campos usando os botões acima.
        </p>
      )}

      <div className="space-y-1">
        {fields.map((field, index) => {
          const typeInfo = getTypeInfo(field.type);
          const showDropIndicator = dropIndex === index && dragIndex !== null && dragIndex !== index;

          return (
            <div key={field.id}>
              {/* Drop indicator line */}
              {showDropIndicator && dragIndex !== null && dragIndex > index && (
                <div className="h-0.5 bg-primary rounded-full mx-2 my-0.5 transition-all" />
              )}
              <Card
                className={`p-0 overflow-hidden transition-all ${
                  dragIndex === index ? 'opacity-40 scale-95' : ''
                } ${editingField?.id === field.id ? 'ring-2 ring-primary' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                <div
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setEditingField(editingField?.id === field.id ? null : field)}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                  <span className="text-muted-foreground">{typeInfo?.icon}</span>
                  <span className="text-sm font-medium flex-1 truncate">{field.label}</span>
                   {field.width && field.width !== '100%' && (
                    <Badge variant="outline" className="text-[10px] h-5">{field.width}</Badge>
                  )}
                  {field.conditional?.field_id && (
                    <Badge variant="outline" className="text-[10px] h-5 gap-0.5 text-primary border-primary/30">
                      <GitBranch className="h-2.5 w-2.5" />
                      Cond.
                    </Badge>
                  )}
                   <Badge variant="outline" className="text-[10px] h-5 bg-muted/50 text-muted-foreground border-border/50">{typeInfo?.label}</Badge>
                   {field.required && <Badge variant="outline" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">Obrig.</Badge>}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => { e.stopPropagation(); duplicateField(field); }}
                  >
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </Card>
              {/* Drop indicator line below */}
              {showDropIndicator && dragIndex !== null && dragIndex < index && (
                <div className="h-0.5 bg-primary rounded-full mx-2 my-0.5 transition-all" />
              )}
            </div>
          );
        })}
      </div>

      {/* Side panel for editing */}
      <Sheet open={!!editingField} onOpenChange={(open) => { if (!open) setEditingField(null); }}>
        <SheetContent className="w-[380px] sm:w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-base">
              {editingField && getTypeInfo(editingField.type)?.icon}
              Configurar Campo
            </SheetTitle>
          </SheetHeader>

          {editingField && (
            <div className="space-y-4 mt-4">
              {/* Label */}
              <div className="space-y-1.5">
                <Label className="text-xs">Rótulo</Label>
                <Input
                  value={editingField.label}
                  onChange={e => updateField(editingField.id, { label: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>

              {/* Technical name */}
              {!isLayoutField(editingField.type) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome interno (ID técnico)</Label>
                  <Input
                    value={editingField.name || ''}
                    onChange={e => updateField(editingField.id, { name: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() })}
                    placeholder={editingField.id}
                    className="h-9 text-sm font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">Usado como chave no JSON. Deixe vazio para usar o ID automático.</p>
                </div>
              )}

               {/* Map to CRM field */}
              {!isLayoutField(editingField.type) && editingField.type !== 'hidden' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Mapear para o CRM</Label>
                  <Select
                    value={editingField.map_to || '__none'}
                    onValueChange={(v) => updateField(editingField.id, { map_to: (v === '__none' ? '' : v) as LeadFieldMapping })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Nenhum (campo extra)" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_FIELD_OPTIONS.map(opt => (
                        <SelectItem key={opt.value || '__none'} value={opt.value || '__none'}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Preenche automaticamente o campo correspondente do lead no CRM.</p>
                </div>
              )}

              {/* Placeholder */}
              {!isLayoutField(editingField.type) && editingField.type !== 'checkbox' && editingField.type !== 'hidden' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Placeholder</Label>
                  <Input
                    value={editingField.placeholder}
                    onChange={e => updateField(editingField.id, { placeholder: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
              )}

              {/* Help text */}
              {!isLayoutField(editingField.type) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Texto de ajuda</Label>
                  <Input
                    value={editingField.help_text || ''}
                    onChange={e => updateField(editingField.id, { help_text: e.target.value })}
                    placeholder="Dica exibida abaixo do campo"
                    className="h-9 text-sm"
                  />
                </div>
              )}

              {/* Default value */}
              {!isLayoutField(editingField.type) && editingField.type !== 'file_upload' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor padrão</Label>
                  <Input
                    value={editingField.default_value}
                    onChange={e => updateField(editingField.id, { default_value: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
              )}

              {/* Required toggle */}
              {!isLayoutField(editingField.type) && (
                <div className="flex items-center justify-between py-1">
                  <Label className="text-xs">Obrigatório</Label>
                  <Switch
                    checked={editingField.required}
                    onCheckedChange={checked => updateField(editingField.id, { required: checked })}
                  />
                </div>
              )}

              {/* Width/layout */}
              {!isLayoutField(editingField.type) && editingField.type !== 'hidden' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Largura</Label>
                  <Select
                    value={editingField.width || '100%'}
                    onValueChange={(v) => updateField(editingField.id, { width: v as FieldConfig['width'] })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100%">100% (linha inteira)</SelectItem>
                      <SelectItem value="50%">50% (meia linha)</SelectItem>
                      <SelectItem value="33%">33% (um terço)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Mask */}
              {(['text', 'phone', 'cpf', 'cnpj'] as FieldType[]).includes(editingField.type) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Máscara</Label>
                  <Select
                    value={editingField.mask || 'none'}
                    onValueChange={(v) => updateField(editingField.id, { mask: v as FieldConfig['mask'] })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Validation for number */}
              {editingField.type === 'number' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Validação numérica</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Mín</Label>
                      <Input
                        type="number"
                        value={editingField.validation?.min ?? ''}
                        onChange={e => updateField(editingField.id, { validation: { ...editingField.validation, min: e.target.value ? Number(e.target.value) : undefined } })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Máx</Label>
                      <Input
                        type="number"
                        value={editingField.validation?.max ?? ''}
                        onChange={e => updateField(editingField.id, { validation: { ...editingField.validation, max: e.target.value ? Number(e.target.value) : undefined } })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Regex validation for text-like fields */}
              {(['text', 'email', 'url', 'cpf', 'cnpj'] as FieldType[]).includes(editingField.type) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Validação por regex (avançado)</Label>
                  <Input
                    value={editingField.validation?.regex || ''}
                    onChange={e => updateField(editingField.id, { validation: { ...editingField.validation, regex: e.target.value || undefined } })}
                    placeholder="Ex: ^[A-Z].*"
                    className="h-8 text-xs font-mono"
                  />
                  <Input
                    value={editingField.validation?.regex_message || ''}
                    onChange={e => updateField(editingField.id, { validation: { ...editingField.validation, regex_message: e.target.value || undefined } })}
                    placeholder="Mensagem de erro personalizada"
                    className="h-8 text-xs"
                  />
                </div>
              )}

              {/* Options for combobox/option_list */}
              {hasOptions(editingField.type) && (
                <div className="space-y-2">
                  <Label className="text-xs">Opções</Label>
                  {(editingField.options || []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-1">
                      <Input
                        value={opt}
                        onChange={e => {
                          const opts = [...(editingField.options || [])];
                          opts[oi] = e.target.value;
                          updateField(editingField.id, { options: opts });
                        }}
                        onPaste={e => {
                          const pasted = e.clipboardData.getData('text');
                          if (pasted.includes('\n')) {
                            e.preventDefault();
                            const lines = pasted.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                            const opts = [...(editingField.options || [])];
                            opts.splice(oi, 1, ...lines);
                            updateField(editingField.id, { options: opts });
                          }
                        }}
                        className="h-8 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => {
                          const opts = (editingField.options || []).filter((_, i) => i !== oi);
                          updateField(editingField.id, { options: opts });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const opts = [...(editingField.options || []), `Opção ${(editingField.options?.length || 0) + 1}`];
                      updateField(editingField.id, { options: opts });
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar opção
                  </Button>
                </div>
              )}

              {/* HTML content for html_info */}
              {editingField.type === 'html_info' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Conteúdo HTML</Label>
                  <Textarea
                    value={editingField.html_content || ''}
                    onChange={e => updateField(editingField.id, { html_content: e.target.value })}
                    rows={4}
                    className="text-xs font-mono"
                    placeholder="<p>Texto informativo</p>"
                  />
                </div>
              )}

               {/* Conditional rules - Typeform style */}
              {!isLayoutField(editingField.type) && fields.length > 1 && (
                <div className="space-y-3 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-primary" />
                      <Label className="text-xs font-medium">Lógica condicional</Label>
                    </div>
                    <Switch
                      checked={!!editingField.conditional?.field_id}
                      onCheckedChange={(checked) => {
                        if (!checked) {
                          updateField(editingField.id, { conditional: undefined });
                        } else {
                          const firstField = fields.find(f => f.id !== editingField.id && !isLayoutField(f.type));
                          if (firstField) {
                            updateField(editingField.id, {
                              conditional: { field_id: firstField.id, operator: 'not_empty' }
                            });
                          }
                        }
                      }}
                    />
                  </div>

                  {!!editingField.conditional?.field_id && (() => {
                    const sourceField = fields.find(f => f.id === editingField.conditional!.field_id);
                    const sourceHasOptions = sourceField && (sourceField.type === 'combobox' || sourceField.type === 'option_list');
                    const sourceIsCheckbox = sourceField?.type === 'checkbox';

                    return (
                      <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                        <p className="text-[10px] text-muted-foreground">
                          Exibir este campo somente quando:
                        </p>

                        {/* Source field selector */}
                        <Select
                          value={editingField.conditional!.field_id}
                          onValueChange={(v) => {
                            const target = fields.find(f => f.id === v);
                            const hasOpts = target && (target.type === 'combobox' || target.type === 'option_list');
                            updateField(editingField.id, {
                              conditional: {
                                field_id: v,
                                operator: hasOpts ? 'equals' : (target?.type === 'checkbox' ? 'equals' : 'not_empty'),
                                value: undefined,
                              }
                            });
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {fields.filter(f => f.id !== editingField.id && !isLayoutField(f.type)).map(f => (
                              <SelectItem key={f.id} value={f.id}>
                                <span className="flex items-center gap-1.5">
                                  {getTypeInfo(f.type)?.icon}
                                  {f.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Separator />

                        {/* Operator */}
                        {!sourceIsCheckbox && (
                          <Select
                            value={editingField.conditional!.operator}
                            onValueChange={(v) => updateField(editingField.id, {
                              conditional: { ...editingField.conditional!, operator: v as ConditionalRule['operator'], value: undefined }
                            })}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_empty">Está preenchido</SelectItem>
                              <SelectItem value="equals">É igual a</SelectItem>
                              <SelectItem value="not_equals">É diferente de</SelectItem>
                              <SelectItem value="contains">Contém</SelectItem>
                            </SelectContent>
                          </Select>
                        )}

                        {/* Checkbox source: simple equals true/false */}
                        {sourceIsCheckbox && (
                          <Select
                            value={editingField.conditional!.operator === 'equals' && editingField.conditional!.value === 'true' ? 'checked' : 'unchecked'}
                            onValueChange={(v) => updateField(editingField.id, {
                              conditional: {
                                ...editingField.conditional!,
                                operator: 'equals',
                                value: v === 'checked' ? 'true' : '',
                              }
                            })}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="checked">Está marcado</SelectItem>
                              <SelectItem value="unchecked">Não está marcado</SelectItem>
                            </SelectContent>
                          </Select>
                        )}

                        {/* Value: chips for option fields, free text otherwise */}
                        {!sourceIsCheckbox && (editingField.conditional!.operator === 'equals' || editingField.conditional!.operator === 'not_equals' || editingField.conditional!.operator === 'contains') && (
                          <>
                            {sourceHasOptions ? (
                              <div className="space-y-1.5">
                                <p className="text-[10px] text-muted-foreground font-medium">
                                  {editingField.conditional!.operator === 'equals' ? 'Quando a resposta for:' :
                                   editingField.conditional!.operator === 'not_equals' ? 'Quando a resposta NÃO for:' :
                                   'Quando a resposta contiver:'}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {(sourceField.options || []).map((opt) => {
                                    const isSelected = editingField.conditional!.value === opt;
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                          isSelected
                                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                            : 'bg-background text-foreground border-input hover:border-primary/50'
                                        }`}
                                        onClick={() => updateField(editingField.id, {
                                          conditional: { ...editingField.conditional!, value: isSelected ? undefined : opt }
                                        })}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <Input
                                value={editingField.conditional!.value || ''}
                                onChange={e => updateField(editingField.id, {
                                  conditional: { ...editingField.conditional!, value: e.target.value }
                                })}
                                placeholder="Digite o valor..."
                                className="h-9 text-xs"
                              />
                            )}
                          </>
                        )}

                        {/* Summary */}
                        {sourceField && (
                          <div className="rounded-md bg-primary/5 border border-primary/10 px-3 py-2">
                            <p className="text-[10px] text-primary font-medium">
                              ↳ &ldquo;{editingField.label}&rdquo; aparecerá quando &ldquo;{sourceField.label}&rdquo;{' '}
                              {editingField.conditional!.operator === 'not_empty' && 'estiver preenchido'}
                              {editingField.conditional!.operator === 'equals' && (
                                sourceIsCheckbox
                                  ? (editingField.conditional!.value === 'true' ? 'estiver marcado' : 'não estiver marcado')
                                  : `= "${editingField.conditional!.value || '...'}"`
                              )}
                              {editingField.conditional!.operator === 'not_equals' && `≠ "${editingField.conditional!.value || '...'}"`}
                              {editingField.conditional!.operator === 'contains' && `contiver "${editingField.conditional!.value || '...'}"`}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Delete from panel */}
              <div className="pt-3 border-t">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => removeField(editingField.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Remover campo
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default FormFieldBuilder;
