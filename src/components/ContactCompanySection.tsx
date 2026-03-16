import { Lead } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, PhoneCall, Mail, User, Plus, Pencil, Trash2, Users } from 'lucide-react';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { validateField } from '@/utils/fieldValidation';
import { useLeadContacts, LeadContact } from '@/hooks/useLeadContacts';
import { toast } from 'sonner';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

interface ContactCompanySectionProps {
  lead: Lead;
  onUpdateLead: (lead: Lead) => void;
}

// ── Contact Form Modal ──────────────────────────────────────────────
interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  phone_2: string;
  role: string;
}

const emptyForm: ContactFormData = { name: '', email: '', phone: '', phone_2: '', role: '' };

function ContactFormDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialData?: ContactFormData;
  onSave: (data: ContactFormData) => void;
  isLoading?: boolean;
}) {
  const [form, setForm] = useState<ContactFormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(initialData || emptyForm);
      setErrors({});
    }
  }, [open, initialData]);

  const handleBlur = (field: string, value: string, type: 'email' | 'phone') => {
    const trimmed = (value || '').trim();
    if (!trimmed) { setErrors(p => ({ ...p, [field]: '' })); return; }
    const error = validateField(type, trimmed);
    setErrors(p => ({ ...p, [field]: error }));
  };

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar contato' : 'Novo contato'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome <span className="text-destructive">*</span></Label>
            <Input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Nome do contato"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cargo / Função</Label>
            <Input
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              placeholder="Ex: Diretor, Gerente..."
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              onBlur={() => handleBlur('email', form.email, 'email')}
              placeholder="email@empresa.com"
              className={cn("h-9 text-sm", errors.email && "border-destructive")}
            />
            {errors.email && <p className="text-[10px] text-destructive">{errors.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone 1</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                onBlur={() => handleBlur('phone', form.phone, 'phone')}
                placeholder="(00) 00000-0000"
                className={cn("h-9 text-sm", errors.phone && "border-destructive")}
              />
              {errors.phone && <p className="text-[10px] text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone 2</Label>
              <Input
                value={form.phone_2}
                onChange={e => setForm(p => ({ ...p, phone_2: e.target.value }))}
                onBlur={() => handleBlur('phone_2', form.phone_2, 'phone')}
                placeholder="(00) 00000-0000"
                className={cn("h-9 text-sm", errors.phone_2 && "border-destructive")}
              />
              {errors.phone_2 && <p className="text-[10px] text-destructive">{errors.phone_2}</p>}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
          <Button
            onClick={() => onSave(form)}
            disabled={isLoading || !form.name.trim() || hasErrors}
          >
            {isLoading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Contact Card Row ────────────────────────────────────────────────
function ContactCardRow({
  contact,
  isPrimary,
  onEdit,
  onDelete,
}: {
  contact: { name: string; email?: string | null; phone?: string | null; phone_2?: string | null; role?: string | null };
  isPrimary?: boolean;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const cleanPhone = (p: string) => (p || '').replace(/\D/g, '');
  const waPhone = (p: string) => `55${cleanPhone(p)}`;
  const dialPhone = (p: string) => cleanPhone(p).replace(/^55/, '');

  return (
    <div className="group flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-muted/30 transition-colors">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <User className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium truncate">{contact.name || 'Sem nome'}</span>
          {contact.role && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{contact.role}</span>
          )}
          {isPrimary && (
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Principal</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors truncate">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{contact.email}</span>
            </a>
          )}
          {contact.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3 shrink-0" />
              <span>{contact.phone}</span>
              <a href={`tel:${dialPhone(contact.phone)}`} title="Ligar" className="hover:text-primary transition-colors">
                <PhoneCall className="h-3 w-3" />
              </a>
              <a href={`https://web.whatsapp.com/send?phone=${waPhone(contact.phone)}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="hover:text-green-600 transition-colors">
                <WhatsAppIcon className="h-3 w-3" />
              </a>
            </span>
          )}
          {contact.phone_2 && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3 shrink-0" />
              <span>{contact.phone_2}</span>
              <a href={`tel:${dialPhone(contact.phone_2)}`} title="Ligar" className="hover:text-primary transition-colors">
                <PhoneCall className="h-3 w-3" />
              </a>
              <a href={`https://web.whatsapp.com/send?phone=${waPhone(contact.phone_2)}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="hover:text-green-600 transition-colors">
                <WhatsAppIcon className="h-3 w-3" />
              </a>
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        {onDelete && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main Section ────────────────────────────────────────────────────
export const ContactCompanySection = ({ lead, onUpdateLead }: ContactCompanySectionProps) => {
  const { contacts, isLoading, createContact, updateContact, deleteContact } = useLeadContacts(lead.id);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<LeadContact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // For editing the primary lead contact inline
  const [editingPrimary, setEditingPrimary] = useState(false);

  const primaryContact = {
    name: lead.name || '',
    email: lead.email,
    phone: lead.phone,
    phone_2: lead.phone_2,
    role: null as string | null,
  };

  const handleOpenCreate = () => {
    setEditingContact(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (contact: LeadContact) => {
    setEditingContact(contact);
    setFormOpen(true);
  };

  const handleOpenEditPrimary = () => {
    setEditingContact(null);
    setEditingPrimary(true);
    setFormOpen(true);
  };

  const handleSave = async (data: { name: string; email: string; phone: string; phone_2: string; role: string }) => {
    try {
      if (editingPrimary) {
        // Update the lead's primary contact fields
        onUpdateLead({
          ...lead,
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          phone_2: data.phone_2 || null,
        } as Lead);
        toast.success('Contato principal atualizado');
        setFormOpen(false);
        setEditingPrimary(false);
        return;
      }

      if (editingContact) {
        await updateContact.mutateAsync({
          id: editingContact.id,
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          phone_2: data.phone_2 || null,
          role: data.role || null,
        });
        toast.success('Contato atualizado');
      } else {
        await createContact.mutateAsync({
          lead_id: lead.id,
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          phone_2: data.phone_2 || null,
          role: data.role || null,
          is_primary: false,
          sort_order: contacts.length,
        });
        toast.success('Contato adicionado');
      }
      setFormOpen(false);
      setEditingContact(null);
    } catch {
      toast.error('Erro ao salvar contato');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteContact.mutateAsync(deleteId);
      toast.success('Contato excluído');
    } catch {
      toast.error('Erro ao excluir contato');
    }
    setDeleteId(null);
  };

  const formInitialData = editingPrimary
    ? { name: lead.name || '', email: lead.email || '', phone: lead.phone || '', phone_2: lead.phone_2 || '', role: '' }
    : editingContact
      ? { name: editingContact.name, email: editingContact.email || '', phone: editingContact.phone || '', phone_2: editingContact.phone_2 || '', role: editingContact.role || '' }
      : undefined;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary">
            <Users className="h-3 w-3" />
          </span>
          <span className="text-xs font-medium">Contatos ({1 + contacts.length})</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleOpenCreate}>
          <Plus className="h-3 w-3" />
          Adicionar
        </Button>
      </div>

      <div className="p-3 space-y-2">
        {/* Primary contact from lead */}
        <ContactCardRow
          contact={primaryContact}
          isPrimary
          onEdit={handleOpenEditPrimary}
        />

        {/* Dynamic contacts */}
        {contacts.map(contact => (
          <ContactCardRow
            key={contact.id}
            contact={contact}
            onEdit={() => handleOpenEdit(contact)}
            onDelete={() => setDeleteId(contact.id)}
          />
        ))}

        {isLoading && contacts.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Carregando...</p>
        )}
      </div>

      <ContactFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) { setEditingContact(null); setEditingPrimary(false); }
        }}
        initialData={formInitialData}
        onSave={handleSave}
        isLoading={createContact.isPending || updateContact.isPending}
      />

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={handleDelete}
        description="Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita."
      />
    </div>
  );
};
