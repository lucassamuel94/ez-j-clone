import { useState, useRef, KeyboardEvent, useMemo } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface EmailSuggestion {
  name: string;
  email: string;
}

interface EmailTagInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: EmailSuggestion[];
}

export const EmailTagInput = ({ value, onChange, placeholder, suggestions = [] }: EmailTagInputProps) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const emails = value ? value.split(',').map((e) => e.trim()).filter(Boolean) : [];

  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim() || suggestions.length === 0) return [];
    const q = inputValue.toLowerCase();
    return suggestions.filter(
      (s) =>
        !emails.includes(s.email) &&
        (s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [inputValue, suggestions, emails]);

  const addEmail = (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    if (emails.includes(trimmed)) return;
    const updated = [...emails, trimmed].join(', ');
    onChange(updated);
    setInputValue('');
    setShowSuggestions(false);
    setSelectedSuggestionIdx(0);
  };

  const removeEmail = (index: number) => {
    const updated = emails.filter((_, i) => i !== index).join(', ');
    onChange(updated);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => Math.min(prev + 1, filteredSuggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        addEmail(filteredSuggestions[selectedSuggestionIdx].email);
        return;
      }
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      addEmail(inputValue);
    }
    if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      removeEmail(emails.length - 1);
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      if (inputValue.trim()) {
        addEmail(inputValue);
      }
      setShowSuggestions(false);
    }, 150);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted.includes(',') || pasted.includes(';')) {
      e.preventDefault();
      const parts = pasted.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      const updated = [...emails, ...parts.filter((p) => !emails.includes(p))].join(', ');
      onChange(updated);
      setInputValue('');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={cn(
          'flex flex-wrap items-center gap-1 min-h-10 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background cursor-text',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email, idx) => (
          <Badge
            key={idx}
            variant="outline"
            className="gap-1 py-0.5 px-2 text-xs font-normal bg-primary/10 text-primary border-primary/20"
          >
            {email}
            <button
              type="button"
              className="ml-0.5 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                removeEmail(idx);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
            setSelectedSuggestionIdx(0);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => inputValue.trim() && setShowSuggestions(true)}
          onPaste={handlePaste}
          placeholder={emails.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md py-1 max-h-48 overflow-y-auto">
          {filteredSuggestions.map((s, idx) => (
            <button
              key={s.email}
              type="button"
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2',
                idx === selectedSuggestionIdx && 'bg-accent'
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                addEmail(s.email);
              }}
            >
              <span className="font-medium text-foreground truncate">{s.name}</span>
              <span className="text-muted-foreground text-xs truncate">{s.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
