import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSystemUsers, SystemUser } from '@/hooks/useSystemUsers';

interface MentionPopoverProps {
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
  value: string;
  cursorPosition?: number;
  onMention: (user: SystemUser, startPos: number, endPos: number) => void;
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export function MentionPopover({ inputRef, value, cursorPosition, onMention }: MentionPopoverProps) {
  const { data: users } = useSystemUsers();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  const filteredUsers = (users || []).filter(u =>
    u.name.toLowerCase().includes(query.toLowerCase())
  );

  // Detect @ mentions using explicit cursor position
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const cursor = cursorPosition ?? value.length;
    const textBefore = value.substring(0, cursor);
    const atIndex = textBefore.lastIndexOf('@');

    if (atIndex >= 0) {
      const textAfterAt = textBefore.substring(atIndex + 1);
      if (!textAfterAt.includes(' ') || textAfterAt.length <= 20) {
        setQuery(textAfterAt);
        setMentionStart(atIndex);
        setIsOpen(true);
        setSelectedIndex(0);

        const rect = el.getBoundingClientRect();
        setPosition({ top: rect.top - 4, left: rect.left });
        return;
      }
    }
    setIsOpen(false);
  }, [value, cursorPosition, inputRef]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isOpen, inputRef]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || filteredUsers.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredUsers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && isOpen) {
        e.preventDefault();
        const user = filteredUsers[selectedIndex];
        if (user) {
          const cursorPos = cursorPosition ?? el.selectionStart ?? 0;
          onMention(user, mentionStart, cursorPos);
          setIsOpen(false);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => {
      el.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputRef, isOpen, filteredUsers, selectedIndex, mentionStart, onMention, cursorPosition]);

  if (!isOpen || filteredUsers.length === 0) return null;

  const popoverContent = (
    <div
      ref={popoverRef}
      className="fixed z-[9999] bg-popover border border-border rounded-xl shadow-xl max-h-[280px] overflow-auto min-w-[260px]"
      style={{ top: position.top, left: position.left, transform: 'translateY(-100%)', pointerEvents: 'auto' }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-border">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mencionar usuário</span>
      </div>
      {filteredUsers.map((user, idx) => (
        <button
          key={user.id}
          type="button"
          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-accent/60 flex items-center gap-3 transition-colors ${idx === selectedIndex ? 'bg-accent/60' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            const cursorPos = cursorPosition ?? inputRef.current?.selectionStart ?? 0;
            onMention(user, mentionStart, cursorPos);
            setIsOpen(false);
          }}
        >
          <div className={`h-2 w-2 rounded-full border-2 flex-shrink-0 ${idx === selectedIndex ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`} />
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-xs text-foreground truncate">{user.name}</span>
            {user.email && <span className="text-[10px] text-muted-foreground truncate">{user.email}</span>}
          </div>
        </button>
      ))}
    </div>
  );

  return createPortal(popoverContent, document.body);
}
