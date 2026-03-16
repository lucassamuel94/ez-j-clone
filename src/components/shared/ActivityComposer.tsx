import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { MentionPopover } from '@/components/MentionPopover';
import type { SystemUser } from '@/hooks/useSystemUsers';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import {
  Bold, Italic, Underline, AtSign, Paperclip, ImagePlus,
  Mail, SquareCheckBig, CalendarPlus, Send, Loader2, X,
  Mic, MicOff,
} from 'lucide-react';
import type { ActivityFeedConfig } from '@/types/activityFeed';

export interface MentionedUser {
  id: string;
  name: string;
}

interface ActivityComposerProps {
  config: ActivityFeedConfig;
  entityId: string;
  onSendComment: (text: string, pendingImages?: string[], mentionedUsers?: MentionedUser[]) => void;
  isSending: boolean;
  onOpenDialog: (type: 'task' | 'email' | 'calendar') => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
}

export function ActivityComposer({
  config, entityId, onSendComment, isSending, onOpenDialog, onFileUpload, uploading,
}: ActivityComposerProps) {
  const [inlineComment, setInlineComment] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState<MentionedUser[]>([]);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleSpeechResult = useCallback((text: string) => {
    setInlineComment(prev => prev ? `${prev} ${text}` : text);
  }, []);
  const { isRecording, isSupported: isSpeechSupported, toggle: toggleRecording } = useSpeechRecognition({ onResult: handleSpeechResult });

  const uploadImageInline = useCallback(async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = config.buildStoragePath(entityId, `${Date.now()}-${safeName}`, user.id);
      const { error: uploadError } = await supabase.storage.from(config.storageBucket).upload(path, file);
      if (uploadError) throw uploadError;
      const { data: signedData } = await supabase.storage.from(config.storageBucket).createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signedData?.signedUrl) {
        setPendingImages(prev => [...prev, signedData.signedUrl]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro ao enviar imagem: ${msg}`);
    }
  }, [entityId, config]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadImageInline(file);
        return;
      }
    }
  }, [uploadImageInline]);

  const handleImageInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) await uploadImageInline(file);
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
  }, [uploadImageInline]);

  const wrapSelection = useCallback((prefix: string, suffix: string) => {
    const el = commentRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = inlineComment.substring(0, start);
    const selected = inlineComment.substring(start, end);
    const after = inlineComment.substring(end);
    setInlineComment(`${before}${prefix}${selected}${suffix}${after}`);
    requestAnimationFrame(() => {
      el.focus();
      const newCursorPos = start + prefix.length + selected.length + suffix.length;
      el.setSelectionRange(
        selected.length ? newCursorPos : start + prefix.length,
        selected.length ? newCursorPos : start + prefix.length,
      );
    });
  }, [inlineComment]);

  const handleSend = () => {
    if (!inlineComment.trim() && pendingImages.length === 0) return;
    onSendComment(
      inlineComment.trim(),
      pendingImages.length > 0 ? pendingImages : undefined,
      mentionedUsers.length > 0 ? mentionedUsers : undefined,
    );
    setInlineComment('');
    setPendingImages([]);
    setMentionedUsers([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); wrapSelection('**', '**'); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); wrapSelection('_', '_'); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'u') { e.preventDefault(); wrapSelection('<u>', '</u>'); }
  };

  const handleCommentMention = useCallback((user: SystemUser, startPos: number, endPos: number) => {
    const before = inlineComment.substring(0, startPos);
    const after = inlineComment.substring(endPos);
    setInlineComment(`${before}@${user.name} ${after}`);
    setMentionedUsers(prev => {
      if (prev.some(m => m.id === user.id)) return prev;
      return [...prev, { id: user.id, name: user.name }];
    });
  }, [inlineComment]);

  const isDisabled = (!inlineComment.trim() && pendingImages.length === 0) || isSending;

  return (
    <div className="px-3 pb-3 pt-2 flex-shrink-0 border-t border-border/20 mt-auto">
      <input ref={fileInputRef} type="file" multiple onChange={onFileUpload} className="hidden" />
      <div
        className={cn(
          "relative rounded-lg border transition-colors flex flex-col-reverse",
          isDragging ? 'border-primary border-dashed bg-primary/5' : 'border-border/30 bg-[#f4f3f9] dark:bg-muted/50',
        )}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
        onDrop={(e) => {
          e.preventDefault(); e.stopPropagation(); setIsDragging(false);
          if (e.dataTransfer.files?.length) {
            const files = Array.from(e.dataTransfer.files);
            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            const otherFiles = files.filter(f => !f.type.startsWith('image/'));
            for (const imgFile of imageFiles) uploadImageInline(imgFile);
            if (otherFiles.length > 0 && fileInputRef.current) {
              const dt = new DataTransfer();
              for (const f of otherFiles) dt.items.add(f);
              fileInputRef.current.files = dt.files;
              fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/10 pointer-events-none">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <ImagePlus className="h-4 w-4" />
              <span>Solte para adicionar imagem</span>
            </div>
          </div>
        )}

        {/* Textarea */}
        <div>
          <Textarea
            ref={commentRef}
            placeholder="Escreva um comentário..."
            value={inlineComment}
            onChange={(e) => {
              setInlineComment(e.target.value);
              setCursorPos(e.target.selectionStart || 0);
              const el = e.target;
              el.style.height = 'auto';
              el.style.height = `${Math.max(pendingImages.length > 0 ? 60 : 120, Math.min(el.scrollHeight, 768))}px`;
            }}
            onClick={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart || 0)}
            onKeyUp={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart || 0)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={1}
            className="text-xs resize-none border-none shadow-none bg-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0 px-3 pt-2.5 pb-8"
            style={{ overflow: 'auto', minHeight: pendingImages.length > 0 ? '60px' : '120px', maxHeight: '768px' }}
          />
        </div>

        {/* Pending image previews */}
        {pendingImages.length > 0 && (
          <div className="px-3 py-2 flex flex-wrap gap-2 border-t border-border/20">
            {pendingImages.map((url, idx) => (
              <div key={idx} className="relative group/img">
                <img src={url} alt="Preview" className="max-w-[200px] max-h-[160px] object-cover rounded-md border border-border/30" />
                <button
                  type="button"
                  onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <MentionPopover inputRef={commentRef} value={inlineComment} cursorPosition={cursorPos} onMention={handleCommentMention} />

        {/* Toolbar */}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-muted-foreground rounded-md"
              onClick={() => wrapSelection('**', '**')} title="Negrito (Ctrl+B)">
              <Bold className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-muted-foreground rounded-md"
              onClick={() => wrapSelection('_', '_')} title="Itálico (Ctrl+I)">
              <Italic className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-muted-foreground rounded-md"
              onClick={() => wrapSelection('<u>', '</u>')} title="Sublinhado (Ctrl+U)">
              <Underline className="h-4 w-4" />
            </Button>
            <div className="mx-0.5 h-4 w-px bg-border/30" />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-muted-foreground rounded-md"
              onClick={() => {
                if (commentRef.current) {
                  const pos = commentRef.current.selectionStart || inlineComment.length;
                  const newValue = inlineComment.substring(0, pos) + '@' + inlineComment.substring(pos);
                  setInlineComment(newValue);
                  setCursorPos(pos + 1);
                  commentRef.current.focus();
                }
              }} title="Mencionar">
              <AtSign className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-muted-foreground rounded-md"
              onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Anexar arquivo">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-muted-foreground rounded-md"
              onClick={() => imageInputRef.current?.click()} title="Adicionar imagem">
              <ImagePlus className="h-4 w-4" />
            </Button>
            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageInput} className="hidden" />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-muted-foreground rounded-md"
              onClick={() => onOpenDialog('email')} title="Enviar e-mail">
              <Mail className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-muted-foreground rounded-md"
              onClick={() => onOpenDialog('task')} title="Criar tarefa">
              <SquareCheckBig className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-muted-foreground rounded-md"
              onClick={() => onOpenDialog('calendar')} title="Criar evento no Google Calendar">
              <CalendarPlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon"
              className={cn("h-7 w-7 rounded-md", isRecording ? "text-destructive animate-pulse" : "text-muted-foreground/50 hover:text-muted-foreground")}
              onClick={() => {
                if (!isSpeechSupported) {
                  toast.error('Seu navegador não suporta reconhecimento de voz. Use Google Chrome ou Microsoft Edge para utilizar esta funcionalidade.');
                  return;
                }
                toggleRecording();
              }}
              title={isRecording ? 'Parar gravação' : 'Ditar comentário'}>
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" className="h-8 w-8 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground" onClick={handleSend} disabled={isDisabled}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" align="end" className="text-xs w-max max-w-none">
              <p><kbd className="font-semibold">Enter</kbd> para enviar</p>
              <p><kbd className="font-semibold">Shift + Enter</kbd> para quebrar linha</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
