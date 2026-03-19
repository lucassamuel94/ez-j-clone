import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Phone, Pencil, ChevronDown, Mail, Check, X, Plus, Trash2, Star } from 'lucide-react';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Lead } from '@/types/lead';
import { Input } from '@/components/ui/input';
import { validateField } from '@/utils/fieldValidation';

interface Contact {
  name: string;
  phone: string;
  phone2?: string;
  email?: string;
  role: string;
  isPrimary: boolean;
}

interface EditValues {
  name: string;
  phone: string;
  email: string;
}

interface ContactChipPanelProps {
  lead: Lead;
  onEditContact?: () => void;
  onSaveContact?: (index: number, values: EditValues) => Promise<void> | void;
  onAddContact?: (values: EditValues) => Promise<void> | void;
  onDeleteContact?: (index: number) => Promise<void> | void;
  onSetPrimary?: (index: number) => Promise<void> | void;
}

function buildContacts(lead: Lead): Contact[] {
  const contacts: Contact[] = [];

  if (lead.name || lead.phone || lead.whatsapp) {
    const altNumbers: string[] = [];
    if (lead.phone && lead.whatsapp && lead.phone !== lead.whatsapp) altNumbers.push(lead.whatsapp);
    if (lead.phone_2 && lead.phone_2 !== lead.phone && lead.phone_2 !== lead.whatsapp) altNumbers.push(lead.phone_2);

    contacts.push({
      name: lead.name || 'Contato 1',
      phone: lead.phone || lead.whatsapp || '',
      phone2: altNumbers[0] || undefined,
      email: lead.email || undefined,
      role: 'Contato principal',
      isPrimary: true,
    });
  }

  if (lead.contact_name_2 || lead.phone_3 || lead.phone_4) {
    contacts.push({
      name: lead.contact_name_2 || 'Contato 2',
      phone: lead.phone_3 || lead.phone_4 || '',
      phone2: lead.phone_3 && lead.phone_4 && lead.phone_3 !== lead.phone_4 ? lead.phone_4 : undefined,
      email: lead.email_2 || undefined,
      role: '',
      isPrimary: false,
    });
  }

  return contacts;
}

function getCleanPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  return clean.startsWith('55') && clean.length > 10 ? clean.slice(2) : clean;
}

function formatLocalPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  const local = clean.startsWith('55') && clean.length > 10 ? clean.slice(2) : clean;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

function applyPhoneMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function PhoneDisplay({ phone }: { phone: string }) {
  if (!phone) return null;
  return <span className="text-[11px] font-mono text-foreground">{formatLocalPhone(phone)}</span>;
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'whatsapp' | 'danger';
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'h-6 w-6 rounded-md flex items-center justify-center transition-colors',
        variant === 'whatsapp'
          ? 'text-[hsl(var(--chart-3))] hover:bg-[hsl(var(--chart-3))]/10'
          : variant === 'danger'
          ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {icon}
    </button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[9px] text-destructive mt-0.5 leading-tight">{message}</p>;
}

function ContactEditForm({
  contact,
  onSave,
  onCancel,
}: {
  contact: Contact;
  onSave: (values: EditValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<EditValues>({
    name: contact.name === 'Contato 1' || contact.name === 'Contato 2' ? '' : contact.name,
    phone: contact.phone,
    email: contact.email || '',
  });
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  const validateAll = useCallback((vals: EditValues) => {
    const errs: { name?: string; phone?: string; email?: string } = {};
    if (!vals.name.trim()) errs.name = 'Nome obrigatório';
    const phoneErr = validateField('phone', vals.phone, true);
    if (phoneErr) errs.phone = phoneErr;
    if (vals.email.trim()) {
      const emailErr = validateField('email', vals.email);
      if (emailErr) errs.email = emailErr;
    }
    return errs;
  }, []);

  const canSave = useCallback((vals: EditValues) => {
    const errs = validateAll(vals);
    return Object.keys(errs).length === 0;
  }, [validateAll]);

  const handleSave = useCallback(() => {
    const errs = validateAll(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSave(values);
  }, [values, validateAll, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  }, [handleSave, onCancel]);

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div>
        <Input
          value={values.name}
          onChange={(e) => {
            setValues((v) => ({ ...v, name: e.target.value }));
            if (errors.name) setErrors((err) => ({ ...err, name: undefined }));
          }}
          onBlur={() => {
            if (!values.name.trim()) setErrors((err) => ({ ...err, name: 'Nome obrigatório' }));
          }}
          onKeyDown={handleKeyDown}
          placeholder="Nome *"
          className={cn('h-7 text-xs', errors.name && 'border-destructive focus-visible:ring-destructive/20')}
          autoFocus
        />
        <FieldError message={errors.name} />
      </div>

      <div>
        <Input
          value={values.phone}
          onChange={(e) => {
            const masked = applyPhoneMask(e.target.value);
            setValues((v) => ({ ...v, phone: masked }));
            if (errors.phone) setErrors((err) => ({ ...err, phone: undefined }));
          }}
          onBlur={() => {
            const err = validateField('phone', values.phone, true);
            setErrors((prev) => ({ ...prev, phone: err || undefined }));
          }}
          onKeyDown={handleKeyDown}
          placeholder="(00) 00000-0000 *"
          inputMode="numeric"
          className={cn('h-7 text-xs font-mono', errors.phone && 'border-destructive focus-visible:ring-destructive/20')}
        />
        <FieldError message={errors.phone} />
      </div>

      <div>
        <Input
          value={values.email}
          onChange={(e) => {
            setValues((v) => ({ ...v, email: e.target.value }));
            if (errors.email) setErrors((err) => ({ ...err, email: undefined }));
          }}
          onBlur={() => {
            if (values.email.trim()) {
              const err = validateField('email', values.email);
              setErrors((prev) => ({ ...prev, email: err || undefined }));
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="E-mail"
          type="email"
          className={cn('h-7 text-xs', errors.email && 'border-destructive focus-visible:ring-destructive/20')}
        />
        <FieldError message={errors.email} />
      </div>

      <div className="flex items-center gap-1 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Cancelar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave(values)}
          className={cn(
            'h-6 w-6 rounded-md flex items-center justify-center transition-colors',
            canSave(values)
              ? 'text-primary hover:bg-primary/10'
              : 'text-muted-foreground/40 cursor-not-allowed',
          )}
          title="Salvar"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export const ContactChipPanel = memo(function ContactChipPanel({
  lead,
  onEditContact,
  onSaveContact,
  onAddContact,
  onDeleteContact,
  onSetPrimary,
}: ContactChipPanelProps) {
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingContact, setAddingContact] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const contacts = buildContacts(lead);
  const primary = contacts[0];
  const rest = contacts.slice(1);
  const canAddMore = contacts.length < 2 && !!onAddContact;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Don't close while a form is open — prevent accidental data loss
        if (editingIndex !== null || addingContact) return;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, editingIndex, addingContact]);

  const handleCall = useCallback((phone: string) => {
    window.location.href = `tel:${getCleanPhone(phone)}`;
  }, []);

  const handleWhatsApp = useCallback((phone: string) => {
    const clean = getCleanPhone(phone);
    const number = clean.startsWith('55') ? clean : `55${clean}`;
    window.open(`https://wa.me/${number}`, '_blank');
  }, []);

  const handleSave = useCallback(async (index: number, values: EditValues) => {
    if (onSaveContact) {
      try {
        await onSaveContact(index, values);
        toast.success('Contato atualizado!');
      } catch {
        toast.error('Erro ao salvar contato');
      }
    }
    setEditingIndex(null);
  }, [onSaveContact]);

  const handleAddSave = useCallback(async (values: EditValues) => {
    if (onAddContact) {
      try {
        await onAddContact(values);
        toast.success('Contato adicionado!');
      } catch {
        toast.error('Erro ao adicionar contato');
      }
    }
    setAddingContact(false);
  }, [onAddContact]);

  const handleDelete = useCallback(async (index: number) => {
    if (onDeleteContact) {
      try {
        await onDeleteContact(index);
        toast.success('Contato removido!');
        setEditingIndex(null);
      } catch {
        toast.error('Erro ao remover contato');
      }
    }
  }, [onDeleteContact]);

  const handleSetPrimary = useCallback(async (index: number) => {
    if (onSetPrimary) {
      try {
        await onSetPrimary(index);
        toast.success('Contato principal atualizado!');
      } catch {
        toast.error('Erro ao definir contato principal');
      }
    }
  }, [onSetPrimary]);

  if (!primary) return null;

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      {/* Chip trigger */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setEditingIndex(null); setAddingContact(false); }}
        className={cn(
          'inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium transition-all cursor-pointer',
          open
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/30 hover:text-foreground',
        )}
      >
        <Phone className="h-3 w-3 shrink-0" />
        <span className="truncate max-w-[80px]">{primary.name}</span>
        {primary.phone && <PhoneDisplay phone={primary.phone} />}
        <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-72 rounded-xl border border-border bg-popover shadow-lg p-2 space-y-1 animate-in fade-in-0 zoom-in-95 duration-150">
          {contacts.map((contact, i) => (
            <div key={i} className="rounded-lg p-2.5 space-y-2 hover:bg-muted/50 transition-colors">
              {/* Contact header */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground truncate flex-1">{contact.name}</span>
                {contact.isPrimary && (
                  <span className="text-[9px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-medium shrink-0">
                    principal
                  </span>
                )}
              </div>

              {editingIndex === i ? (
                <ContactEditForm
                  contact={contact}
                  onSave={(values) => handleSave(i, values)}
                  onCancel={() => setEditingIndex(null)}
                />
              ) : (
                <>
                  {/* Phone rows */}
                  {[contact.phone, contact.phone2].filter(Boolean).map((phone, j) => (
                    <div key={j} className="flex items-center justify-between gap-2">
                      <PhoneDisplay phone={phone!} />
                      <div className="flex items-center gap-0.5">
                        <ActionButton
                          icon={<Phone className="h-3 w-3" />}
                          label="Ligar"
                          onClick={() => handleCall(phone!)}
                        />
                        <ActionButton
                          icon={<WhatsAppIcon size={12} />}
                          label="WhatsApp"
                          onClick={() => handleWhatsApp(phone!)}
                          variant="whatsapp"
                        />
                      </div>
                    </div>
                  ))}

                  {/* Email */}
                  {contact.email && (
                    <div>
                      <a
                        href={`mailto:${contact.email}`}
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors truncate"
                      >
                        <Mail className="h-3 w-3 shrink-0" />
                        {contact.email}
                      </a>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-0.5">
                    <div className="flex items-center gap-0.5">
                      {!contact.isPrimary && onSetPrimary && (
                        <button
                          type="button"
                          title="Definir como principal"
                          onClick={(e) => { e.stopPropagation(); handleSetPrimary(i); }}
                          className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium text-warning dark:text-warning hover:bg-warning/5 dark:hover:bg-warning/10 transition-colors"
                        >
                          <Star className="h-3 w-3" />
                          Definir como principal
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      {!contact.isPrimary && onDeleteContact && (
                        <ActionButton
                          icon={<Trash2 className="h-3 w-3" />}
                          label="Remover contato"
                          onClick={() => handleDelete(i)}
                          variant="danger"
                        />
                      )}
                      {onSaveContact && (
                        <ActionButton
                          icon={<Pencil className="h-3 w-3" />}
                          label="Editar"
                          onClick={() => setEditingIndex(i)}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Add new contact form */}
          {addingContact && (
            <div className="rounded-lg p-2.5 space-y-2 border border-dashed border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Novo contato</span>
                <button
                  type="button"
                  onClick={() => setAddingContact(false)}
                  className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Cancelar"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <ContactEditForm
                contact={{ name: '', phone: '', email: '', role: '', isPrimary: false }}
                onSave={handleAddSave}
                onCancel={() => setAddingContact(false)}
              />
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-1 border-t border-border/50 flex items-center gap-2">
            {canAddMore && !addingContact && (
              <button
                type="button"
                onClick={() => { setAddingContact(true); setEditingIndex(null); }}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium px-2 py-1"
              >
                <Plus className="h-3 w-3" />
                Adicionar contato
              </button>
            )}
            {onEditContact && (
              <button
                type="button"
                onClick={() => { onEditContact(); setOpen(false); }}
                className="text-[11px] text-primary hover:underline font-medium px-2 py-1 ml-auto"
              >
                Editar contatos →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
