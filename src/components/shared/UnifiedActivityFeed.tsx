import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ActivityAvatar } from '@/components/activity/ActivityAvatar';
import { cn } from '@/lib/utils';
import { formatDateTimeBR } from '@/utils/dateFormat';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { ActivityContentRenderer } from './ActivityItemRenderer';
import { ActivityComposer } from './ActivityComposer';
import type { ActivityItem, ActivityFeedConfig, ActivityFeedAdapter } from '@/types/activityFeed';
import {
  Clock, Search, X, Check, Loader2, Pencil, Trash2, Reply,
  CornerDownRight, Send, ListChecks, Mail, Calendar,
} from 'lucide-react';

// ---------- Helpers ----------

function getInitials(name: string): string {
  if (!name || name === 'Sistema') return 'S';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ---------- Timeline Entry ----------

interface TimelineEntryProps {
  item: ActivityItem;
  config: ActivityFeedConfig;
  currentUserId?: string;
  canEdit?: boolean;
  onEdit?: (id: string, description: string) => void;
  onDelete?: (id: string) => void;
  onReply?: (id: string, userName: string) => void;
  onEditTask?: (task: any) => void;
  onToggleTask?: (task: any) => void;
  taskData?: any;
  replies?: ActivityItem[];
  replyTarget?: { id: string; userName: string } | null;
  replyText?: string;
  onReplyTextChange?: (text: string) => void;
  onSendReply?: () => void;
  onCancelReply?: () => void;
  isReplyPending?: boolean;
  isReply?: boolean;
}

function TimelineEntry({
  item, config, currentUserId, canEdit, onEdit, onDelete,
  onReply, onEditTask, onToggleTask, taskData,
  replies, replyTarget, replyText, onReplyTextChange,
  onSendReply, onCancelReply, isReplyPending, isReply,
}: TimelineEntryProps) {
  const actionIcon = config.actionIcons[item.action_type] || <Clock className="h-3 w-3" strokeWidth={1.5} />;
  const actionColor = config.actionColors[item.action_type] || 'bg-muted/30 text-muted-foreground';
  const isOwner = currentUserId && item.user_id === currentUserId;
  const isComment = item.action_type === 'observation';
  const isSystem = config.systemActionTypes.has(item.action_type);
  const isTask = item.action_type === 'task' || item.action_type === 'task_created' || item.action_type === 'task_completed';
  const isReplyingHere = replyTarget?.id === item.id;

  // System events — compact discrete row
  if (isSystem && !isReply) {
    return (
      <div className="flex items-center gap-2 mb-2 last:mb-0 pl-1">
        <div className="h-5 w-5 rounded-full bg-muted border border-border/40 flex items-center justify-center flex-shrink-0">
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
        </div>
        <span className="text-[12px] text-muted-foreground flex-1 leading-relaxed">
          <span className="font-medium text-muted-foreground/70">{item.user_name || 'Sistema'}</span>{' '}
          {config.actionLabels[item.action_type] || item.action_type}
          {item.old_value && item.new_value && (item.old_value.length + item.new_value.length) < 120 && (
            <span className="text-muted-foreground/40"> {item.old_value} → {item.new_value}</span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground/40 flex-shrink-0 tabular-nums whitespace-nowrap">
          {formatDateTimeBR(item.created_at)}
        </span>
      </div>
    );
  }

  // Semantic avatar by type
  const isEmail = item.action_type === 'email' || item.action_type === 'email_sent';
  const isMeeting = item.action_type === 'calendar_event' || item.action_type === 'meeting_scheduled' || item.action_type === 'meeting';

  const semanticAvatar = isTask ? (
    <div className="h-[30px] w-[30px] rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
      <ListChecks className="h-3.5 w-3.5 text-amber-500" />
    </div>
  ) : isEmail ? (
    <div className="h-[30px] w-[30px] rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
      <Mail className="h-3.5 w-3.5 text-blue-500" />
    </div>
  ) : isMeeting ? (
    <div className="h-[30px] w-[30px] rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center flex-shrink-0">
      <Calendar className="h-3.5 w-3.5 text-green-500" />
    </div>
  ) : (
    <ActivityAvatar name={item.user_name} avatarUrl={item.user_avatar_url} size={isReply ? 'sm' : 'md'} />
  );

  // Chat bubble style for human entries (comments, emails, tasks, meetings, etc.)
  return (
    <div className={cn("group mb-4 last:mb-0", isReply && "ml-8 mt-1")}>
      {/* Header row: avatar + name + meta */}
      <div className={cn("flex items-center gap-2.5", isOwner && !isReply ? "flex-row-reverse" : "flex-row")}>
        {semanticAvatar}
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          <span className="text-[13px] font-semibold text-foreground">
            {item.user_name || 'Sistema'}
          </span>
          <span className={cn(
            "text-[10px]",
            isTask ? "text-chart-5/70" : "text-muted-foreground/60",
          )}>
            {isReply ? 'respondeu' : (config.actionLabels[item.action_type] || item.action_type)}
          </span>
          <span className="text-[10px] text-muted-foreground/40 tabular-nums">{formatDateTimeBR(item.created_at)}</span>
          {item.updated_at && (
            <span className="text-[9px] text-muted-foreground/40 italic">(editado)</span>
          )}
          <span className="ml-auto flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {isComment && canEdit && (config.supportsReplies || item.source === 'note') && (
              <>
                {config.supportsReplies && onReply && !isReply && (
                  <button
                    onClick={() => onReply(item.id, item.user_name || 'Sistema')}
                    className="p-1 rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/5 transition-colors"
                    title="Responder"
                  >
                    <Reply className="h-3.5 w-3.5" />
                  </button>
                )}
                {isOwner && onEdit && (
                  <button
                    onClick={() => onEdit(item.id, item.description)}
                    className="p-1 rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/5 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {isOwner && onDelete && (
                  <button
                    onClick={() => onDelete(item.id)}
                    className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
          </span>
        </div>
      </div>

      {/* Content below, aligned with user name (avatar 1.75rem/1.5rem + gap 0.625rem) */}
      {item.description && (
        <div className={cn(
          "mt-1",
          isReply ? "ml-[calc(1.5rem+0.625rem)]" : "ml-[calc(1.75rem+0.625rem)]",
          isComment && !isReply && "",
        )}>
          <ActivityContentRenderer
            activity={item}
            config={config}
            onEditTask={onEditTask}
            onToggleTask={onToggleTask}
            taskData={taskData}
          />
        </div>
      )}

      {/* Replies */}
      {replies && replies.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {replies.map(reply => (
            <TimelineEntry
              key={reply.id}
              item={reply}
              config={config}
              currentUserId={currentUserId}
              canEdit={canEdit}
              onEdit={onEdit}
              onDelete={onDelete}
              isReply
            />
          ))}
        </div>
      )}

      {/* Inline reply input */}
      {isReplyingHere && replyTarget && (
        <div className="ml-10 mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
              <Reply className="h-3 w-3 inline mr-1" />
              Respondendo a {replyTarget.userName}
            </span>
            <button onClick={onCancelReply} className="text-muted-foreground/50 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
          <Textarea
            value={replyText || ''}
            onChange={(e) => onReplyTextChange?.(e.target.value)}
            placeholder="Escreva sua resposta..."
            className="text-xs min-h-[60px] resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-1.5 mt-1.5">
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onCancelReply}>Cancelar</Button>
            <Button size="sm" className="h-6 text-xs" onClick={onSendReply} disabled={isReplyPending}>
              {isReplyPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
              Responder
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Main Component ----------

interface UnifiedActivityFeedProps {
  entityId: string;
  config: ActivityFeedConfig;
  adapter: ActivityFeedAdapter;
  canEdit: boolean;
  currentUserId?: string;
  onOpenDialog: (type: 'task' | 'email' | 'calendar') => void;
  onSendComment: (text: string, pendingImages?: string[], mentionedUsers?: Array<{id: string; name: string}>) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
}

export function UnifiedActivityFeed({
  entityId, config, adapter, canEdit, currentUserId,
  onOpenDialog, onSendComment, onFileUpload, uploading,
}: UnifiedActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filterMode, setFilterMode] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Reply (project only)
  const [replyTarget, setReplyTarget] = useState<{ id: string; userName: string } | null>(null);
  const [replyText, setReplyText] = useState('');

  // Auto-scroll refs
  const prevEntityRef = useRef(entityId);
  const prevLenRef = useRef(0);
  const hasScrolledInitially = useRef(false);

  // Filtered items
  const filteredItems = useMemo(() => {
    let items = adapter.items;

    // For projects with replies, separate root from replies
    if (config.supportsReplies) {
      const rootItems = items.filter(i => !i.parent_id);
      const replyMap = new Map<string, ActivityItem[]>();
      for (const a of items) {
        if (a.parent_id) {
          if (!replyMap.has(a.parent_id)) replyMap.set(a.parent_id, []);
          replyMap.get(a.parent_id)!.push(a);
        }
      }

      let filtered = rootItems;
      if (filterMode !== 'all') {
        const allowedTypes = config.filterActionMap[filterMode] || [];
        filtered = filtered.filter(i => allowedTypes.includes(i.action_type));
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(i =>
          i.description?.toLowerCase().includes(term) ||
          i.user_name?.toLowerCase().includes(term),
        );
      }
      return filtered.map(a => ({ ...a, _replies: replyMap.get(a.id) || [] }));
    }

    // Lead mode (no replies)
    if (filterMode !== 'all') {
      const allowedTypes = config.filterActionMap[filterMode] || [];
      items = items.filter(i => allowedTypes.includes(i.action_type));
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      items = items.filter(i =>
        i.description?.toLowerCase().includes(term) ||
        i.user_name?.toLowerCase().includes(term),
      );
    }
    return items;
  }, [adapter.items, filterMode, searchTerm, config]);

  // Reset initial scroll flag when entity changes
  useEffect(() => {
    if (prevEntityRef.current !== entityId) {
      hasScrolledInitially.current = false;
      prevEntityRef.current = entityId;
      prevLenRef.current = 0;
    }
  }, [entityId]);

  // Auto-scroll to bottom on initial load, entity change, or new items added
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || adapter.isLoading || filteredItems.length === 0) return;

    const isInitialLoad = !hasScrolledInitially.current;
    const itemsGrew = filteredItems.length > prevLenRef.current && prevLenRef.current > 0;

    prevLenRef.current = filteredItems.length;

    if (isInitialLoad || itemsGrew) {
      hasScrolledInitially.current = true;
      // Use double rAF to ensure DOM is fully painted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      });
    }
  }, [filteredItems.length, adapter.isLoading]);

  // Edit handlers
  const handleStartEdit = useCallback((id: string, description: string) => {
    const cleaned = description
      .replace(/^\[([^\]]+)\]\s*\(([^)]+)\)\s*/, '')
      .replace(/\s*\[task_id:[a-f0-9-]+\]/, '')
      .trim();
    setEditingId(id);
    setEditingText(cleaned);
  }, []);

  const handleSaveEdit = () => {
    if (!editingId || !editingText.trim()) return;
    adapter.updateComment(editingId, editingText.trim());
    setEditingId(null);
    setEditingText('');
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    adapter.deleteComment(deleteTarget);
    setDeleteTarget(null);
  };

  const handleReply = useCallback((activityId: string, userName: string) => {
    setReplyTarget({ id: activityId, userName });
    setReplyText('');
  }, []);

  const handleSendReply = () => {
    if (!replyTarget || !replyText.trim() || !adapter.replyToComment) return;
    adapter.replyToComment(replyTarget.id, replyText.trim());
    setReplyTarget(null);
    setReplyText('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Histórico</h3>
        <div className="flex items-center gap-1">
          {/* Search button */}
          <button
            onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchTerm(''); }}
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center transition-all border',
              searchOpen
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'bg-transparent text-muted-foreground/50 border-transparent hover:bg-muted/60 hover:text-foreground hover:border-border/60',
            )}
            title="Procurar"
          >
            <Search className="h-3.5 w-3.5" />
          </button>

          <div className="w-px h-[15px] bg-border/60 mx-0.5" />

          {/* "Tudo" pill */}
          {config.filterOptions.filter(o => o.value === 'all').map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterMode('all')}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
                filterMode === 'all'
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-muted/60 text-muted-foreground border-border/60 hover:text-foreground',
              )}
            >
              {opt.icon}
              Tudo
            </button>
          ))}

          <div className="w-px h-[15px] bg-border/60 mx-0.5" />

          {/* Individual filter icons */}
          {config.filterOptions.filter(o => o.value !== 'all').map(opt => {
            const isActive = filterMode === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setFilterMode(isActive ? 'all' : opt.value)}
                title={opt.label}
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center transition-all border',
                  isActive
                    ? (opt.activeClass || 'bg-primary/10 text-primary border-primary/25')
                    : 'bg-transparent text-muted-foreground/40 border-transparent hover:text-muted-foreground/70 hover:bg-muted/60 hover:border-border/60',
                )}
              >
                {opt.icon}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      {searchOpen && (
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40" />
            <Input
              placeholder="Procurar atividades..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-7 pl-7 pr-7 text-xs"
              autoFocus
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      <Separator className="bg-border/20" />

      {/* Edit overlay */}
      {editingId && (
        <div className="px-4 py-2 bg-primary/5 border-b border-primary/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Editando comentário</span>
            <button onClick={() => setEditingId(null)} className="text-muted-foreground/50 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
          <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="text-xs min-h-[60px] resize-none" autoFocus />
          <div className="flex justify-end gap-1.5 mt-1.5">
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditingId(null)}>Cancelar</Button>
            <Button size="sm" className="h-6 text-xs" onClick={handleSaveEdit} disabled={adapter.isUpdating}>
              {adapter.isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 min-h-0 px-4 py-3 overflow-y-auto" ref={scrollRef}>
        {adapter.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center py-10">
            {searchTerm ? (
              <>
                <Search className="h-5 w-5 text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground/40">Nenhum resultado para "{searchTerm}"</p>
              </>
            ) : (
              <>
                <Clock className="h-5 w-5 text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground/40">Nenhuma atividade</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map(item => {
              const taskId = (item.action_type === 'task_created' || item.action_type === 'task_completed')
                ? item.new_value
                : item.task_id;
              const task = taskId ? adapter.taskMap.get(taskId) : undefined;

              return (
                <TimelineEntry
                  key={`${item.source || 'a'}-${item.id}`}
                  item={item}
                  config={config}
                  currentUserId={currentUserId}
                  canEdit={canEdit}
                  onEdit={handleStartEdit}
                  onDelete={(id) => setDeleteTarget(id)}
                  onReply={config.supportsReplies ? handleReply : undefined}
                  onEditTask={canEdit ? adapter.onEditTask : undefined}
                  onToggleTask={canEdit ? adapter.onToggleTask : undefined}
                  taskData={task}
                  replies={item._replies}
                  replyTarget={replyTarget}
                  replyText={replyText}
                  onReplyTextChange={setReplyText}
                  onSendReply={handleSendReply}
                  onCancelReply={() => setReplyTarget(null)}
                  isReplyPending={adapter.isReplying}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      {canEdit && (
        <ActivityComposer
          config={config}
          entityId={entityId}
          onSendComment={onSendComment}
          isSending={adapter.isCreating}
          onOpenDialog={onOpenDialog}
          onFileUpload={onFileUpload}
          uploading={uploading}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        description="Tem certeza que deseja excluir este comentário? Esta ação não pode ser desfeita."
        isDeleting={adapter.isDeleting}
      />
    </div>
  );
}
