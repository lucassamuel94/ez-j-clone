import { useState, useMemo, useRef, useEffect } from "react";
import { Lead, LeadStatus } from "@/types/lead";
import { FunnelStepper, STATUS_TO_STEP } from "./FunnelStepper";

import { createLeadNote } from "@/services/leadService";
import { cn } from "@/lib/utils";
import {
  Building2,
  PhoneCall,
  Mail,
  ChevronDown,
  Clock,
  Pencil,
  Target,
  Paperclip,
  FileText,
  FileSpreadsheet,
  ImageIcon,
  Eye,
  Download,
  Trash2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WhatsAppIcon } from "./icons/WhatsAppIcon";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface LeadModalOperationColumnProps {
  lead: Lead;
  interactions: any[];
  notes: any[];
  onStepClick: (stepKey: string) => void;
  onSubstatusChange: (status: LeadStatus) => void;
  onRegisterOutcome: () => void;
  onUpdateLead: (lead: Lead) => void;
  onSendEmail?: () => void;
  onOpenScheduleReturn?: () => void;
}

const ActionIcon = ({
  href,
  target,
  title,
  className,
  children,
}: {
  href: string;
  target?: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <a
        href={href}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        className={cn(
          "flex items-center justify-center h-5 w-5 rounded hover:bg-muted text-muted-foreground transition-colors",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </a>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-[10px]">
      {title}
    </TooltipContent>
  </Tooltip>
);

const dialPhone = (phone: string) => {
  const clean = phone.replace(/\D/g, "");
  return clean.startsWith("55") ? clean.slice(2) : clean;
};

const waPhone = (phone: string) => {
  const clean = phone.replace(/\D/g, "");
  return clean.startsWith("55") ? clean : `55${clean}`;
};

const ContactRow = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex items-start gap-2 text-[10px] overflow-hidden">
    <span className="font-medium text-muted-foreground w-[70px] shrink-0">{label}</span>
    <span className="text-foreground truncate min-w-0">{value || "—"}</span>
  </div>
);

const EditableTextRow = ({
  label,
  value,
  onSave,
}: {
  label: string;
  value?: string | null;
  onSave?: (v: string) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocal(value || "");
  }, [value]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = local.trim();
    if (trimmed !== (value || "") && onSave) onSave(trimmed);
    else setLocal(value || "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 text-[10px] overflow-hidden">
        <span className="font-medium text-muted-foreground w-[70px] shrink-0">{label}</span>
        <input
          ref={inputRef}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setLocal(value || "");
              setEditing(false);
            }
          }}
          className="flex-1 bg-transparent border-b border-primary/50 outline-none text-foreground text-[10px] py-0.5 min-w-0"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[10px] overflow-hidden group/row">
      <span className="font-medium text-muted-foreground w-[70px] shrink-0">{label}</span>
      <span className="text-foreground truncate min-w-0 flex-1">
        {value || <span className="text-muted-foreground italic">(Nenhum valor)</span>}
      </span>
      {onSave && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover/row:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground shrink-0"
        >
          <Pencil className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
};

const EditablePhoneRow = ({ phone, onSave }: { phone?: string | null; onSave?: (v: string) => void }) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(phone || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocal(phone || "");
  }, [phone]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!phone && !editing) return null;

  const commit = () => {
    const trimmed = local.trim();
    if (trimmed !== (phone || "") && onSave) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 text-[10px] overflow-hidden">
        <span className="font-medium text-muted-foreground w-[70px] shrink-0">Telefone</span>
        <input
          ref={inputRef}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setLocal(phone || "");
              setEditing(false);
            }
          }}
          className="flex-1 bg-transparent border-b border-primary/50 outline-none text-foreground text-[10px] py-0.5 min-w-0"
          placeholder="(00) 00000-0000"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[10px] overflow-hidden group/row">
      <span className="font-medium text-muted-foreground w-[70px] shrink-0">Telefone</span>
      <span className="text-foreground truncate min-w-0 flex-1">{phone}</span>
      <div className="flex items-center gap-0.5 shrink-0">
        {onSave && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover/row:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
          >
            <Pencil className="h-2.5 w-2.5" />
          </button>
        )}
        <ActionIcon href={`tel:${dialPhone(phone)}`} title="Ligar">
          <PhoneCall className="h-3 w-3" />
        </ActionIcon>
        <ActionIcon
          href={`https://web.whatsapp.com/send?phone=${waPhone(phone)}`}
          target="_blank"
          title="WhatsApp"
           className="hover:text-success"
        >
          <WhatsAppIcon size={12} />
        </ActionIcon>
      </div>
    </div>
  );
};

const PhoneRow = ({ phone }: { phone?: string | null }) => {
  if (!phone) return null;
  return (
    <div className="flex items-center gap-2 text-[10px] overflow-hidden">
      <span className="font-medium text-muted-foreground w-[70px] shrink-0">Telefone</span>
      <span className="text-foreground truncate min-w-0 flex-1">{phone}</span>
      <div className="flex items-center gap-0.5">
        <ActionIcon href={`tel:${dialPhone(phone)}`} title="Ligar">
          <PhoneCall className="h-3 w-3" />
        </ActionIcon>
        <ActionIcon
          href={`https://web.whatsapp.com/send?phone=${waPhone(phone)}`}
          target="_blank"
          title="WhatsApp"
          className="hover:text-success"
        >
          <WhatsAppIcon size={12} />
        </ActionIcon>
      </div>
    </div>
  );
};

const EditableEmailRow = ({
  email,
  onSave,
  onSendEmail,
}: {
  email?: string | null;
  onSave?: (v: string) => void;
  onSendEmail?: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(email || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocal(email || "");
  }, [email]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = local.trim();
    if (trimmed !== (email || "") && onSave) onSave(trimmed);
    else setLocal(email || "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 text-[10px] overflow-hidden">
        <span className="font-medium text-muted-foreground w-[70px] shrink-0">E-mail</span>
        <input
          ref={inputRef}
          type="email"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setLocal(email || "");
              setEditing(false);
            }
          }}
          className="flex-1 bg-transparent border-b border-primary/50 outline-none text-foreground text-[10px] py-0.5 min-w-0"
          placeholder="email@empresa.com"
        />
      </div>
    );
  }

  if (!email && !onSave) return null;

  return (
    <div className="flex items-center gap-2 text-[10px] overflow-hidden group/row">
      <span className="font-medium text-muted-foreground w-[70px] shrink-0">E-mail</span>
      <span className="text-foreground truncate min-w-0 flex-1">
        {email || <span className="text-muted-foreground italic">(Nenhum valor)</span>}
      </span>
      <div className="flex items-center gap-0.5 shrink-0">
        {onSave && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover/row:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
          >
            <Pencil className="h-2.5 w-2.5" />
          </button>
        )}
        {email &&
          (onSendEmail ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendEmail();
                  }}
                  className={cn(
                    "flex items-center justify-center h-5 w-5 rounded hover:bg-muted text-muted-foreground transition-colors",
                  )}
                >
                  <Mail className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">
                Enviar e-mail
              </TooltipContent>
            </Tooltip>
          ) : (
            <ActionIcon href={`mailto:${email}`} title="Enviar e-mail">
              <Mail className="h-3 w-3" />
            </ActionIcon>
          ))}
      </div>
    </div>
  );
};

const SectionBlock = ({
  title,
  icon,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full min-w-0 overflow-hidden">
      <div className="rounded-lg border bg-card overflow-hidden w-full min-w-0">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-3 py-2.5 bg-muted/50 hover:bg-muted/70 transition-colors">
            <div className="flex items-center gap-2 flex-1 basis-0 min-w-0">
              <span className="flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary shrink-0">
                {icon}
              </span>
              <span className="text-xs font-medium truncate">{title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {badge !== undefined && (
                <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                  {badge}
                </span>
              )}
              <ChevronDown
                className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")}
              />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="w-full min-w-0 overflow-hidden">
          <div className="border-t px-3 py-3 overflow-hidden">
            <div className="w-full min-w-0 overflow-hidden">{children}</div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

const AUTO_SCHEDULE_HOURS: Record<string, number> = {
  Ocupado: 1,
  "Sem retorno": 4,
};

export const LeadModalOperationColumn = ({
  lead,
  interactions,
  notes,
  onStepClick,
  onSubstatusChange,
  onRegisterOutcome,
  onUpdateLead,
  onSendEmail,
  onOpenScheduleReturn,
}: LeadModalOperationColumnProps) => {
  const [confirmStep, setConfirmStep] = useState<string | null>(null);

  const STEP_LABELS: Record<string, string> = {
    novo: "Novo",
    em_contato: "Em contato",
    lead_quente: "Lead quente",
    oportunidade_futura: "Oportunidade futura",
    reuniao: "Reunião agendada",
    sqo: "Reunião Confirmada",
    perdido: "Perdido",
  };

  const handleStepClickWithConfirm = (stepKey: string) => {
    setConfirmStep(stepKey);
  };

  const handleConfirmStep = () => {
    if (confirmStep) {
      onStepClick(confirmStep);
      setConfirmStep(null);
    }
  };

  // Use the notes prop already passed from the parent instead of a separate query
  const notesData = useMemo(() => {
    if (!notes || notes.length === 0) return null;
    return { notes: notes.slice(0, 2), total: notes.length };
  }, [notes]);

  // Aggregate attachments from all notes
  const allAttachments = useMemo(() => {
    if (!notes || notes.length === 0) return [];
    const files: { name: string; path: string; size: number; type: string; date: Date }[] = [];
    for (const note of notes) {
      if (note.attachments && Array.isArray(note.attachments)) {
        for (const att of note.attachments) {
          const rawName = att?.name;
          const name = typeof rawName === "string" && rawName.trim() !== "" ? rawName.trim() : "Arquivo";
          files.push({
            name,
            path: att.path || "",
            size: att.size || 0,
            type: att.type || "",
            date: note.created_at instanceof Date ? note.created_at : new Date(note.created_at),
          });
        }
      }
    }
    return files;
  }, [notes]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDateTimeBR = (date: Date) => {
    return (
      date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
      " " +
      date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const MAX_FILE_NAME_DISPLAY = 45;
  const truncateFileName = (name: string): string => {
    const safe = typeof name === "string" ? name : "Arquivo";
    if (safe.length <= MAX_FILE_NAME_DISPLAY) return safe;
    return safe.slice(0, MAX_FILE_NAME_DISPLAY - 3).trim() + "...";
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-3.5 w-3.5" />;
    if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv"))
      return <FileSpreadsheet className="h-3.5 w-3.5" />;
    return <FileText className="h-3.5 w-3.5" />;
  };

  const handleViewAttachment = async (path: string) => {
    try {
      const { data } = await supabase.storage.from("lead-attachments").createSignedUrl(path, 60 * 60);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Erro ao abrir arquivo");
    }
  };

  const handleDownloadAttachment = async (path: string, name: string) => {
    try {
      const { data } = await supabase.storage
        .from("lead-attachments")
        .createSignedUrl(path, 60 * 60, { download: name });
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handleDeleteAttachment = async (path: string) => {
    try {
      const { error } = await supabase.storage.from("lead-attachments").remove([path]);
      if (error) throw error;
      toast.success("Arquivo removido");
    } catch {
      toast.error("Erro ao remover arquivo");
    }
  };

  const handleAutoScheduleStatus = async (status: string) => {
    const hours = AUTO_SCHEDULE_HOURS[status];
    const nextAction = new Date();
    nextAction.setHours(nextAction.getHours() + hours);

    const timeStr = nextAction.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const dateStr = nextAction.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

    onUpdateLead({
      ...lead,
      status: status as any,
      last_contact_at: new Date().toISOString(),
      next_action_at: nextAction.toISOString(),
    });

    toast.success(`Status atualizado para "${status}"`, {
      description: `Retorno agendado para ${dateStr} às ${timeStr}`,
    });

    await createLeadNote({
      lead_id: lead.id,
      note: `[${status}] Retorno automático agendado para ${dateStr} às ${timeStr}`,
    });
  };

  const handleStatusClick = (status: string) => {
    if (status === "Em contato" || status === "Agendar retorno") {
      onOpenScheduleReturn?.();
      return;
    }
    if (AUTO_SCHEDULE_HOURS[status]) {
      handleAutoScheduleStatus(status);
      return;
    }
    onSubstatusChange(status as LeadStatus);
  };

  return (
    <div className="space-y-3 p-4 overflow-hidden w-full min-w-0">
      {/* Funnel Stepper */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50">
          <span className="flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary">
            <Target className="h-3 w-3" />
          </span>
          <span className="text-xs font-medium">Estágio do Funil</span>
        </div>
        <div className="border-t p-3">
          <FunnelStepper currentStatus={lead.status} onStepClick={handleStepClickWithConfirm} />
        </div>
      </div>


      {/* Attachments Section */}
      {allAttachments.length > 0 && (
        <SectionBlock
          title="Anexos"
          icon={<Paperclip className="h-3 w-3" />}
          badge={allAttachments.length}
          defaultOpen={false}
        >
          <div className="flex flex-col gap-1.5 w-full min-w-0">
            {allAttachments.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 w-full min-w-0 overflow-hidden rounded-md px-2 py-1.5 bg-muted/30"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                  <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary shrink-0">
                    {getFileIcon(file.type)}
                  </span>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p
                      className="text-[10px] font-medium truncate block overflow-hidden text-ellipsis whitespace-nowrap"
                      title={typeof file.name === "string" ? file.name : "Arquivo"}
                    >
                      {truncateFileName(file.name)}
                    </p>
                    <p className="text-[9px] text-muted-foreground truncate">
                      {formatFileSize(file.size)} · {formatDateTimeBR(file.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleViewAttachment(file.path)}
                    className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-muted-foreground transition-colors"
                    title="Visualizar"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadAttachment(file.path, file.name)}
                    className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-muted-foreground transition-colors"
                    title="Baixar"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAttachment(file.path)}
                    className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-destructive transition-colors"
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionBlock>
      )}

      <AlertDialog open={!!confirmStep} onOpenChange={(open) => !open && setConfirmStep(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar mudança de estágio</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja alterar o estágio do funil para{" "}
              <span className="font-semibold text-foreground">{confirmStep ? STEP_LABELS[confirmStep] : ""}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStep}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
