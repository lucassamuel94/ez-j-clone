import { Button } from '@/components/ui/button';
import { Phone, Mail, X, Calendar, MailCheck } from 'lucide-react';
import { WhatsAppIcon } from './icons/WhatsAppIcon';

interface LeadModalActionsProps {
  onCall?: () => void;
  onWhatsApp?: () => void;
  onEmail?: () => void;
  onSchedule?: () => void;
  onEnrollSequence?: () => void;
  onClose: () => void;
  hasPhone?: boolean;
  hasWhatsApp?: boolean;
  hasEmail?: boolean;
}

export const LeadModalActions = ({
  onCall,
  onWhatsApp,
  onEmail,
  onSchedule,
  onEnrollSequence,
  onClose,
  hasPhone,
  hasWhatsApp,
  hasEmail,
}: LeadModalActionsProps) => {
  return (
    <div className="flex items-center gap-2">
      {hasPhone && onCall && (
        <Button variant="outline" size="sm" onClick={onCall} className="gap-1.5">
          <Phone className="h-4 w-4" />
          Ligar
        </Button>
      )}
      {hasWhatsApp && onWhatsApp && (
        <Button variant="outline" size="sm" onClick={onWhatsApp} className="gap-1.5 text-chart-3 border-chart-3/30 hover:bg-chart-3/10 hover:text-chart-3">
          <WhatsAppIcon size={16} />
          WhatsApp
        </Button>
      )}
      {hasEmail && onEmail && (
        <Button variant="outline" size="sm" onClick={onEmail} className="gap-1.5">
          <Mail className="h-4 w-4" />
          E-mail
        </Button>
      )}
      {onSchedule && (
        <Button variant="outline" size="sm" onClick={onSchedule} className="gap-1.5 text-primary border-primary/30 hover:bg-primary/10 hover:text-primary">
          <Calendar className="h-4 w-4" />
          Agendar
        </Button>
      )}
      {onEnrollSequence && (
        <Button variant="outline" size="sm" onClick={onEnrollSequence} className="gap-1.5">
          <MailCheck className="h-4 w-4" />
          Sequência
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
