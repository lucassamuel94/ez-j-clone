import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/PhoneInput';
import { Button } from '@/components/ui/button';
import { Check, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhoneWithFlag } from '@/utils/phoneMask';

interface EditableContactFieldProps {
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  onClick: () => void;
  placeholder?: string;
  className?: string;
  type?: 'text' | 'phone' | 'email';
}

export const EditableContactField = ({
  icon,
  value,
  onChange,
  onClick,
  placeholder = '',
  className,
  type = 'text',
}: EditableContactFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const handleSave = useCallback(() => {
    if (editValue !== value) {
      onChange(editValue);
    }
    setIsEditing(false);
  }, [editValue, value, onChange]);

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  // Auto-save on click outside
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, handleSave]);

  const handleClick = () => {
    if (!isEditing && value) {
      onClick();
    }
  };

  const renderPhoneDisplay = () => {
    if (!value) return <span className="text-muted-foreground">{placeholder}</span>;
    
    const { flagUrl, countryCode, localNumber } = formatPhoneWithFlag(value);
    
    return (
      <span className="flex items-center gap-2">
        <img 
          src={flagUrl} 
          alt="Country flag" 
          className="w-5 h-auto rounded-sm"
        />
        <span className="text-muted-foreground">{countryCode}</span>
        <span className="text-foreground">{localNumber}</span>
      </span>
    );
  };

  if (isEditing) {
    return (
      <div ref={containerRef} className={cn('flex items-center gap-2', className)}>
        <div className="flex-shrink-0">{icon}</div>
        {type === 'phone' ? (
          <PhoneInput
            value={editValue}
            onChange={setEditValue}
            placeholder={placeholder || '(00) 00000-0000'}
            className="flex-1"
            autoFocus
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            className="h-8 text-sm bg-background flex-1"
            autoFocus
            type={type === 'email' ? 'email' : 'text'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-chart-3"
          onClick={handleSave}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={handleCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 group', className)}>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 flex-1 text-left hover:text-primary transition-colors cursor-pointer"
        disabled={!value}
      >
        <div className="flex-shrink-0">{icon}</div>
        <span className="text-sm">
          {type === 'phone' ? renderPhoneDisplay() : (value || <span className="text-muted-foreground">{placeholder}</span>)}
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => {
          setEditValue(value);
          setIsEditing(true);
        }}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  );
};
