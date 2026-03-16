import { useState, useRef, useCallback } from 'react';
import { addWeeks, addMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useSystemUsers } from '@/hooks/useSystemUsers';
import { useCreateProjectActivity } from '@/hooks/useProjectActivities';
import { useCreateProjectTask } from '@/hooks/useProjectTasks';
import { MentionPopover } from '@/components/MentionPopover';
import type { SystemUser } from '@/hooks/useSystemUsers';
import { cn } from '@/lib/utils';
import {
  Mail, Loader2, Send, CalendarIcon, X,
} from 'lucide-react';

interface ProjectEmailComposerProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FOLLOWUP_OPTIONS = [
  { value: '1w', label: 'Em 1 semana', fn: () => addWeeks(new Date(), 1) },
  { value: '2w', label: 'Em 2 semanas', fn: () => addWeeks(new Date(), 2) },
  { value: '1m', label: 'Em 1 mês', fn: () => addMonths(new Date(), 1) },
  { value: '3m', label: 'Em 3 meses', fn: () => addMonths(new Date(), 3) },
  { value: '6m', label: 'Em 6 meses', fn: () => addMonths(new Date(), 6) },
  { value: 'custom', label: 'Data personalizada', fn: () => undefined },
];

export function ProjectEmailComposer({ projectId, open, onOpenChange }: ProjectEmailComposerProps) {
  const { data: users } = useSystemUsers();
  const createActivity = useCreateProjectActivity();
  const createTask = useCreateProjectTask();

  const [toRecipients, setToRecipients] = useState<string[]>([]);
  const [toInput, setToInput] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [followUpOption, setFollowUpOption] = useState('1w');
  const [customFollowUpDate, setCustomFollowUpDate] = useState<Date | undefined>();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [filteredUsers, setFilteredUsers] = useState<typeof users>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleBodyMention = useCallback((user: SystemUser, startPos: number, endPos: number) => {
    const before = body.substring(0, startPos);
    const after = body.substring(endPos);
    setBody(`${before}@${user.name} ${after}`);
  }, [body]);

  const handleToInputChange = (value: string) => {
    setToInput(value);
    if (value.length > 0 && users) {
      const filtered = users.filter(u =>
        u.name.toLowerCase().includes(value.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(value.toLowerCase()))
      );
      setFilteredUsers(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const addRecipient = (nameOrEmail: string) => {
    if (!toRecipients.includes(nameOrEmail)) {
      setToRecipients([...toRecipients, nameOrEmail]);
    }
    setToInput('');
    setShowSuggestions(false);
  };

  const removeRecipient = (r: string) => {
    setToRecipients(toRecipients.filter(x => x !== r));
  };

  const handleToKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && toInput.trim()) {
      e.preventDefault();
      addRecipient(toInput.trim());
    }
  };

  const resetForm = () => {
    setToRecipients([]);
    setToInput('');
    setCcInput('');
    setBccInput('');
    setSubject('');
    setBody('');
    setCreateFollowUp(false);
  };

  const handleSend = async () => {
    if (toRecipients.length === 0 || !subject.trim()) return;

    const allRecipients = toRecipients.join(', ');
    const fullBody = [
      `Para: ${allRecipients}`,
      ccInput ? `Cc: ${ccInput}` : '',
      bccInput ? `Bcc: ${bccInput}` : '',
      `Assunto: ${subject}`,
      body,
    ].filter(Boolean).join('\n');

    createActivity.mutate({
      project_id: projectId,
      action_type: 'email_sent',
      description: fullBody,
      new_value: allRecipients,
    }, {
      onSuccess: async () => {
        if (createFollowUp) {
          const opt = FOLLOWUP_OPTIONS.find(o => o.value === followUpOption);
          const followDate = followUpOption === 'custom' ? customFollowUpDate : opt?.fn();
          if (followDate) {
            createTask.mutate({
              project_id: projectId,
              title: `Follow-up: ${subject}`,
              due_date: followDate.toISOString(),
              task_type: 'email',
              priority: 'normal',
            } as any);
          }
        }
        resetForm();
        onOpenChange(false);
      },
    });
  };

  const isSending = createActivity.isPending || createTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" /> Enviar E-mail
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* To */}
          <div className="relative">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Para</Label>
            <div className="flex flex-wrap items-center gap-1 border border-border/50 rounded-xl px-2.5 py-1.5 min-h-[36px] bg-background">
              {toRecipients.map(r => (
                <Badge key={r} variant="secondary" className="text-[10px] h-5 px-1.5 gap-0.5 rounded-lg">
                  {r}
                  <button type="button" onClick={() => removeRecipient(r)} className="ml-0.5 hover:text-destructive">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              <input
                value={toInput}
                onChange={(e) => handleToInputChange(e.target.value)}
                onKeyDown={handleToKeyDown}
                placeholder={toRecipients.length === 0 ? 'Digite nome ou email...' : ''}
                className="flex-1 min-w-[100px] text-xs bg-transparent outline-none"
              />
              {!showCcBcc && (
                <button type="button" onClick={() => setShowCcBcc(true)}
                  className="text-[10px] text-primary hover:underline ml-auto flex-shrink-0">
                  Cc/Bcc
                </button>
              )}
            </div>
            {showSuggestions && filteredUsers && filteredUsers.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-xl shadow-lg max-h-32 overflow-auto">
                {filteredUsers.map(u => (
                  <button key={u.id} type="button"
                    className="w-full text-left px-3 py-2 text-xs hover:bg-accent/60 flex items-center gap-2 transition-colors"
                    onClick={() => addRecipient(u.email || u.name)}>
                    <span className="font-medium">{u.name}</span>
                    {u.email && <span className="text-muted-foreground">{u.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cc / Bcc */}
          {showCcBcc && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Cc</Label>
                <Input value={ccInput} onChange={(e) => setCcInput(e.target.value)}
                  placeholder="Cc..." className="h-8 text-xs rounded-xl border-border/50" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Bcc</Label>
                <Input value={bccInput} onChange={(e) => setBccInput(e.target.value)}
                  placeholder="Bcc..." className="h-8 text-xs rounded-xl border-border/50" />
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="Assunto do email..." className="h-9 text-xs rounded-xl border-border/50" />
          </div>

          {/* Body */}
          <div className="relative">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Mensagem</Label>
            <Textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escreva seu email... Use @ para mencionar alguém"
              rows={5}
              className="text-sm resize-none rounded-xl border-border/50"
            />
            <MentionPopover inputRef={bodyRef} value={body} onMention={handleBodyMention} />
          </div>

          {/* Follow-up task */}
          <div className="space-y-2 rounded-xl bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Checkbox id="followup" checked={createFollowUp}
                onCheckedChange={(v) => setCreateFollowUp(!!v)} className="h-3.5 w-3.5" />
              <label htmlFor="followup" className="text-xs text-muted-foreground cursor-pointer">
                Criar tarefa de follow-up
              </label>
            </div>
            {createFollowUp && (
              <div className="flex gap-2">
                <Select value={followUpOption} onValueChange={setFollowUpOption}>
                  <SelectTrigger className="h-8 text-xs rounded-xl border-border/50 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLLOWUP_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {followUpOption === 'custom' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {customFollowUpDate ? format(customFollowUpDate, 'dd/MM', { locale: ptBR }) : 'Data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customFollowUpDate}
                        onSelect={setCustomFollowUpDate}
                        className="p-3 pointer-events-auto" locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}
          </div>

          {/* Send */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="h-8 text-xs rounded-xl px-4" onClick={handleSend}
              disabled={toRecipients.length === 0 || !subject.trim() || isSending}>
              {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> :
                <><Send className="h-3 w-3 mr-1" /> Enviar</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
