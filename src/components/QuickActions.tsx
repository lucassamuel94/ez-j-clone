import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Phone, Mail } from 'lucide-react';
import { Lead } from '@/types/lead';
import { toast } from 'sonner';
import { useState } from 'react';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { EmailComposeDialog } from './EmailComposeDialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface QuickActionsProps {
  lead: Lead;
  size?: 'sm' | 'default' | 'lg';
  onIncrementAttempt?: () => void;
}

export const QuickActions = ({ lead, size = 'sm', onIncrementAttempt }: QuickActionsProps) => {
  const [isPhonePopoverOpen, setIsPhonePopoverOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const { user: currentUser } = useCurrentUser();
  const iconSize = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const mailIconSize = size === 'lg' ? 'h-[22px] w-[22px]' : 'h-[18px] w-[18px]';
  const buttonSize = size === 'lg' ? 'h-10 w-10' : size === 'default' ? 'h-9 w-9' : 'h-8 w-8';

  const dialNumber = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const phoneWithoutPrefix = cleanPhone.startsWith('55') ? cleanPhone.slice(2) : cleanPhone;
    window.open(`tel:${phoneWithoutPrefix}`, '_self');
    onIncrementAttempt?.();
    setIsPhonePopoverOpen(false);
    toast.success('Chamada iniciada via softphone - Tentativa registrada');
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = lead.phone?.replace(/\D/g, '') || '';
    if (phone) {
      window.open(`https://web.whatsapp.com/send?phone=55${phone}`, '_blank');
      onIncrementAttempt?.();
      toast.success('WhatsApp aberto - Tentativa registrada');
    } else {
      toast.error('Telefone não cadastrado');
    }
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.phone) {
      toast.error('Telefone não cadastrado');
      return;
    }

    if (lead.phone_2 || lead.phone_3 || lead.phone_4) {
      setIsPhonePopoverOpen(true);
    } else {
      dialNumber(lead.phone);
    }
  };

  const handleEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.email) {
      toast.error('E-mail não cadastrado');
      return;
    }
    setEmailDialogOpen(true);
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`${buttonSize} text-muted-foreground hover:text-primary hover:bg-primary/10`}
              onClick={handleEmail}
            >
              <Mail className={mailIconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-popover text-popover-foreground border">
            <p>E-mail</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`${buttonSize} text-muted-foreground hover:text-primary hover:bg-primary/10`}
              onClick={handleWhatsApp}
            >
              <WhatsAppIcon className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-popover text-popover-foreground border">
            <p>WhatsApp</p>
          </TooltipContent>
        </Tooltip>

        <Popover open={isPhonePopoverOpen} onOpenChange={setIsPhonePopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`${buttonSize} text-muted-foreground hover:text-primary hover:bg-primary/10`}
                  onClick={handleCall}
                >
                  <Phone className={iconSize} />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="bg-popover text-popover-foreground border">
              <p>Ligar</p>
            </TooltipContent>
          </Tooltip>
          {(lead.phone_2 || lead.phone_3 || lead.phone_4) && (
            <PopoverContent className="w-auto p-2" align="center" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-1">
                {[lead.phone, lead.phone_2, lead.phone_3, lead.phone_4].filter(Boolean).map((num, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    size="sm"
                    className="justify-start text-sm gap-2 bg-muted text-foreground hover:bg-muted/80"
                    onClick={() => dialNumber(num!)}
                  >
                    <Phone className="h-3 w-3" />
                    {num}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          )}
        </Popover>
      </div>

      <EmailComposeDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        lead={lead}
        userName={currentUser?.name || ''}
        onSent={() => onIncrementAttempt?.()}
      />
    </>
  );
};
