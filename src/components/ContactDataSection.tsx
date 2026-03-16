import { Lead } from '@/types/lead';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { User, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PhoneInput } from './PhoneInput';
import { validateField } from '@/utils/fieldValidation';
import { cn } from '@/lib/utils';

interface ContactDataSectionProps {
  lead: Lead;
  onUpdateLead: (lead: Lead) => void;
}

type PhoneField = 'phone' | 'whatsapp' | 'phone_3' | 'phone_4';

const ContactFieldWrapper = ({ children, error }: { children: React.ReactNode; error?: string }) => (
  <div>
    <div className={cn(
      "rounded-md border bg-card transition-all hover:border-primary/50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20",
      error && "border-destructive hover:border-destructive focus-within:border-destructive focus-within:ring-destructive/20"
    )}>
      {children}
    </div>
    {error && <p className="text-[9px] text-destructive mt-0.5 leading-tight">{error}</p>}
  </div>
);

export const ContactDataSection = ({ lead, onUpdateLead }: ContactDataSectionProps) => {
  const [phone1, setPhone1] = useState(lead.phone || '');
  const [whatsappNum, setWhatsappNum] = useState(lead.whatsapp || '');
  const [phone3, setPhone3] = useState(lead.phone_3 || '');
  const [phone4, setPhone4] = useState(lead.phone_4 || '');
  const [email, setEmail] = useState(lead.email || '');
  const [contactName2, setContactName2] = useState(lead.contact_name_2 || '');
  const [email2, setEmail2] = useState(lead.email_2 || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setPhone1(lead.phone || '');
    setWhatsappNum(lead.whatsapp || '');
    setPhone3(lead.phone_3 || '');
    setPhone4(lead.phone_4 || '');
    setEmail(lead.email || '');
    setContactName2(lead.contact_name_2 || '');
    setEmail2(lead.email_2 || '');
  }, [lead.id, lead.phone, lead.whatsapp, lead.phone_3, lead.phone_4, lead.email, lead.contact_name_2, lead.email_2]);

  const handlePhoneUpdate = (field: PhoneField, value: string) => {
    if (field === 'phone') setPhone1(value);
    else if (field === 'whatsapp') setWhatsappNum(value);
    else if (field === 'phone_3') setPhone3(value);
    else if (field === 'phone_4') setPhone4(value);
    onUpdateLead({ ...lead, [field]: value });
  };

  const handlePhoneBlur = (field: string, value: string) => {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      setErrors(prev => ({ ...prev, [field]: '' }));
      return;
    }
    const error = validateField('phone', trimmed);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleEmailChange = (value: string) => setEmail(value);
  const handleEmailBlur = () => {
    onUpdateLead({ ...lead, email });
    const trimmed = email.trim();
    if (!trimmed) {
      setErrors(prev => ({ ...prev, email: '' }));
      return;
    }
    const error = validateField('email', trimmed);
    setErrors(prev => ({ ...prev, email: error }));
  };

  const handleContactName2Change = (value: string) => setContactName2(value);
  const handleContactName2Blur = () => onUpdateLead({ ...lead, contact_name_2: contactName2 });

  const handleEmail2Change = (value: string) => setEmail2(value);
  const handleEmail2Blur = () => {
    onUpdateLead({ ...lead, email_2: email2 });
    const trimmed = email2.trim();
    if (!trimmed) {
      setErrors(prev => ({ ...prev, email_2: '' }));
      return;
    }
    const error = validateField('email', trimmed);
    setErrors(prev => ({ ...prev, email_2: error }));
  };

  return (
    <div className="mb-4">
      <h3 className="text-xs font-medium mb-3 flex items-center gap-1.5">
        <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
          <Users className="h-3 w-3 text-primary" />
        </div>
        DADOS DO CONTATO
      </h3>

      <div className="space-y-3">
        {/* Contato 1 */}
        <div className="rounded-lg border border-border/60 bg-accent/20 p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="h-4 w-4 rounded-full bg-primary/15 flex items-center justify-center">
              <User className="h-2.5 w-2.5 text-primary" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contato 1</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">Nome</Label>
              <ContactFieldWrapper>
                <Input
                  value={lead.name || ''}
                  readOnly
                  placeholder="Nome"
                  className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </ContactFieldWrapper>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">E-mail</Label>
              <ContactFieldWrapper error={errors.email}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={handleEmailBlur}
                  placeholder="email@empresa.com"
                  className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </ContactFieldWrapper>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">Telefone 1</Label>
              <ContactFieldWrapper error={errors.phone}>
                <div className="px-2 py-0.5">
                  <PhoneInput
                    value={phone1}
                    onChange={(v) => handlePhoneUpdate('phone', v)}
                    onBlur={() => handlePhoneBlur('phone', phone1)}
                    placeholder="(00) 0000-0000"
                    className="border-0 bg-transparent h-7 text-xs"
                  />
                </div>
              </ContactFieldWrapper>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">Telefone 2</Label>
              <ContactFieldWrapper error={errors.whatsapp}>
                <div className="px-2 py-0.5">
                  <PhoneInput
                    value={whatsappNum}
                    onChange={(v) => handlePhoneUpdate('whatsapp', v)}
                    onBlur={() => handlePhoneBlur('whatsapp', whatsappNum)}
                    placeholder="(00) 00000-0000"
                    className="border-0 bg-transparent h-7 text-xs"
                  />
                </div>
              </ContactFieldWrapper>
            </div>
          </div>
        </div>

        {/* Contato 2 */}
        <div className="rounded-lg border border-border/60 bg-accent/20 p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="h-4 w-4 rounded-full bg-muted-foreground/15 flex items-center justify-center">
              <User className="h-2.5 w-2.5 text-muted-foreground" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contato 2</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">Nome</Label>
              <ContactFieldWrapper>
                <Input
                  value={contactName2}
                  onChange={(e) => handleContactName2Change(e.target.value)}
                  onBlur={handleContactName2Blur}
                  placeholder="Nome"
                  className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </ContactFieldWrapper>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">E-mail</Label>
              <ContactFieldWrapper error={errors.email_2}>
                <Input
                  type="email"
                  value={email2}
                  onChange={(e) => handleEmail2Change(e.target.value)}
                  onBlur={handleEmail2Blur}
                  placeholder="email@empresa.com"
                  className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </ContactFieldWrapper>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">Telefone 1</Label>
              <ContactFieldWrapper error={errors.phone_3}>
                <div className="px-2 py-0.5">
                  <PhoneInput
                    value={phone3}
                    onChange={(v) => handlePhoneUpdate('phone_3', v)}
                    onBlur={() => handlePhoneBlur('phone_3', phone3)}
                    placeholder="(00) 0000-0000"
                    className="border-0 bg-transparent h-7 text-xs"
                  />
                </div>
              </ContactFieldWrapper>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">Telefone 2</Label>
              <ContactFieldWrapper error={errors.phone_4}>
                <div className="px-2 py-0.5">
                  <PhoneInput
                    value={phone4}
                    onChange={(v) => handlePhoneUpdate('phone_4', v)}
                    onBlur={() => handlePhoneBlur('phone_4', phone4)}
                    placeholder="(00) 0000-0000"
                    className="border-0 bg-transparent h-7 text-xs"
                  />
                </div>
              </ContactFieldWrapper>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
