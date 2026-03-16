import { useState } from 'react';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/utils/sanitize';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Pencil, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ActivityItem, ActivityFeedConfig } from '@/types/activityFeed';

// ---------- Helpers ----------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function AttachmentsList({ attachments, bucket }: { attachments?: any[]; bucket: string }) {
  if (!attachments?.length) return null;

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600);
    if (error || !data?.signedUrl) {
      toast.error('Erro ao gerar link de download');
      return;
    }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = fileName;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="flex flex-col gap-1">
      {attachments.map((file, idx) => (
        <button
          key={idx}
          onClick={() => handleDownload(file.path, file.name)}
          className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline font-medium max-w-full group/file"
        >
          <Paperclip className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{file.name}</span>
          {file.size > 0 && <span className="text-muted-foreground/50 flex-shrink-0">({formatFileSize(file.size)})</span>}
        </button>
      ))}
    </div>
  );
}

// ---------- Content Renderer ----------

interface ActivityContentProps {
  activity: ActivityItem;
  config: ActivityFeedConfig;
  onEditTask?: (task: any) => void;
  onToggleTask?: (task: any) => void;
  taskData?: any;
}

export function ActivityContentRenderer({ activity, config, onEditTask, onToggleTask, taskData }: ActivityContentProps) {
  const desc = activity.description;
  const [expanded, setExpanded] = useState(false);

  // Status changes
  if (activity.action_type === 'status_changed' || activity.action_type === 'phase_status_changed') {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-[11px]">
        {activity.old_value && (
          <span className="px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground font-medium">{activity.old_value}</span>
        )}
        {activity.old_value && activity.new_value && <span className="text-muted-foreground/30">→</span>}
        {activity.new_value && (
          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{activity.new_value}</span>
        )}
        {!activity.old_value && !activity.new_value && desc && (
          <span className="text-foreground/60">{desc}</span>
        )}
      </div>
    );
  }

  // Force phase move (project-specific)
  if (activity.action_type === 'force_phase_move') {
    return (
      <div className="mt-1.5 rounded-lg bg-chart-5/5 border border-chart-5/20 px-3 py-2">
        <p className="text-xs text-foreground/70 whitespace-pre-line leading-relaxed">⚠ {desc}</p>
      </div>
    );
  }

  // System action logs
  if (config.systemActionTypes.has(activity.action_type) && activity.source === 'log') {
    return (
      <div className="mt-1.5 rounded-lg bg-muted/15 border border-border/20 px-3 py-2">
        <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">{desc}</p>
      </div>
    );
  }

  // System action logs (project style — no source field)
  if (config.systemActionTypes.has(activity.action_type) && !activity.source) {
    return (
      <div className="mt-1.5 rounded-lg bg-muted/15 border border-border/20 px-3 py-2">
        <p className="text-xs text-foreground/60 whitespace-pre-line leading-relaxed">{desc}</p>
      </div>
    );
  }

  // Tasks
  if (activity.action_type === 'task' || activity.action_type === 'task_created' || activity.action_type === 'task_completed') {
    const displayText = desc.replace(/\s*\[task_id:[a-f0-9-]+\]/, '').replace(/\s*\[status:concluida\]/, '');
    const infoParts = displayText.replace(/📋\s*(Tarefa criada:\s*)?/, '').split(/\s*[|\n]\s*/).filter(Boolean);
    const title = infoParts[0] || '';
    const details = infoParts.slice(1);
    const isDone = taskData?.status === 'concluida';

    return (
      <div className="mt-1 rounded-lg border bg-amber-500/8 border-amber-500/20 px-3 py-2.5 transition-colors duration-200 shadow-sm">
        {isDone && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
              ✓ Concluída
            </span>
          </div>
        )}
        <p className={cn(
          "text-[11px] whitespace-pre-line leading-relaxed uppercase font-semibold",
          isDone ? "text-muted-foreground line-through" : "text-amber-700 dark:text-amber-400",
        )}>{title}</p>
        {details.length > 0 && (
          <p className="text-[10px] mt-0.5 text-amber-600/80 dark:text-amber-500/70">{details.join(' · ')}</p>
        )}
        {taskData && (
          <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-amber-500/15">
            <Checkbox
              checked={isDone}
              onCheckedChange={() => onToggleTask?.(taskData)}
              className={cn("h-3.5 w-3.5", isDone && "border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500")}
            />
            <span className={cn("text-[10px]", isDone ? "text-amber-600 font-medium" : "text-muted-foreground")}>
              {isDone ? 'Concluída' : 'Marcar concluída'}
            </span>
            <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onEditTask?.(taskData); }}>
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Email
  if ((activity.action_type === 'email' || activity.action_type === 'email_sent') && desc.includes('📧')) {
    const lines = desc.split('\n');
    const para = lines.find(l => l.startsWith('Para:'))?.replace('Para: ', '') || '';
    const assunto = lines.find(l => l.startsWith('Assunto:'))?.replace('Assunto: ', '') || '';
    const corpoIdx = lines.findIndex(l => l.startsWith('Corpo:'));
    const corpo = corpoIdx >= 0 ? lines.slice(corpoIdx + 1).join('\n').trim() : '';
    return (
      <div className="mt-1.5 rounded-lg border bg-blue-500/8 border-blue-500/20 overflow-hidden">
        <div className="px-3 py-2 space-y-1 border-b border-blue-500/15">
          {para && <p className="text-[11px] text-muted-foreground"><span className="font-semibold text-foreground/70">Para:</span> {para}</p>}
          {assunto && <p className="text-[11px] text-muted-foreground"><span className="font-semibold text-foreground/70">Assunto:</span> {assunto}</p>}
        </div>
        {corpo && (
          <div className="px-3 py-2">
            <div className={cn("text-[11px] text-foreground/60 leading-relaxed", !expanded && "line-clamp-4")}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(corpo) }} />
            {corpo.length > 200 && (
              <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-primary hover:underline mt-1 font-medium">
                {expanded ? 'Ver menos' : 'Ver mais'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Calendar event
  if ((activity.action_type === 'calendar_event' || activity.action_type === 'meeting_scheduled' || activity.action_type === 'meeting') && desc.includes('📅')) {
    return <CalendarEventCard desc={desc} />;
  }

  // Calendar event inside observation
  if (activity.action_type === 'observation' && desc.includes('📅') && desc.includes('Título:')) {
    return <CalendarEventCard desc={desc} />;
  }

  // Observations / comments
  if (activity.action_type === 'observation') {
    const imgRegex = /\[img:(.*?)\]/g;
    const images: string[] = [];
    let match;
    while ((match = imgRegex.exec(desc)) !== null) images.push(match[1]);
    const textOnly = desc
      .replace(/\[img:.*?\]\n?/g, '')
      .replace(/^\[([^\]]+)\]\s*\(([^)]+)\)\s*/, '')
      .replace(/\s*\[task_id:[a-f0-9-]+\]/, '')
      .replace(/\s*\[status:concluida\]/, '')
      .trim();

    let formattedDesc = textOnly
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>')
      .replace(/<u>(.+?)<\/u>/g, '<u>$1</u>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80 break-all">$1</a>');

    return (
      <div className="mt-1 rounded-[4px_12px_12px_12px] bg-[#f4f3f9] dark:bg-accent/20 border border-border/50 px-3 py-2.5 space-y-2 shadow-sm">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((imgUrl, idx) => (
              <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer">
                <img src={imgUrl} alt="Imagem" className="max-w-full max-h-48 rounded-md border border-border/20 cursor-pointer hover:opacity-90 transition-opacity" />
              </a>
            ))}
          </div>
        )}
        {formattedDesc && (
          <p className="text-xs text-foreground whitespace-pre-line leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(formattedDesc) }} />
        )}
        <AttachmentsList attachments={activity.attachments} bucket={config.storageBucket} />
      </div>
    );
  }

  // Default
  return (
    <div className="mt-1.5 rounded-lg bg-muted/10 border border-border/20 px-3 py-2 space-y-2">
      <p className="text-xs text-foreground whitespace-pre-line line-clamp-3 leading-relaxed">{desc}</p>
      <AttachmentsList attachments={activity.attachments} bucket={config.storageBucket} />
    </div>
  );
}

function CalendarEventCard({ desc }: { desc: string }) {
  const lines = desc.split('\n');
  const titulo = lines.find(l => l.startsWith('Título:'))?.replace('Título: ', '') || '';
  const data = lines.find(l => l.startsWith('Data:'))?.replace('Data: ', '') || '';
  const horario = lines.find(l => l.startsWith('Horário:'))?.replace('Horário: ', '') || '';
  const convidado = lines.find(l => l.startsWith('Convidado:'))?.replace('Convidado: ', '') || '';
  const meetLink = lines.find(l => l.startsWith('Meet:'))?.replace('Meet: ', '').trim() || '';
  return (
    <div className="mt-1.5 rounded-lg border bg-green-500/8 border-green-500/20 px-3 py-2 space-y-0.5">
      {titulo && <p className="text-[12px] font-semibold text-foreground">{titulo}</p>}
      {data && <p className="text-[11px] text-muted-foreground">📅 {data}{horario ? ` • ${horario}` : ''}</p>}
      {convidado && <p className="text-[11px] text-muted-foreground">👤 {convidado}</p>}
      {meetLink && (
        <a href={meetLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium">
          🔗 Entrar no Google Meet
        </a>
      )}
    </div>
  );
}
