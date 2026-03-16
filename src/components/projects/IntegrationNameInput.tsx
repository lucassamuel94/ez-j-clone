import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles } from 'lucide-react';

interface IntegrationNameInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function IntegrationNameInput({ value, onChange, placeholder, className }: IntegrationNameInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ name: string; isExisting: boolean } | null>(null);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [catalogNames, setCatalogNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch existing integration names once
  useEffect(() => {
    const fetchCatalog = async () => {
      const { data } = await supabase
        .from('project_integrations')
        .select('integration_name');
      if (data) {
        const unique = [...new Set(data.map((d) => d.integration_name.trim()))].sort();
        setCatalogNames(unique);
      }
    };
    fetchCatalog();
  }, []);

  // Filter suggestions based on input
  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([]);
      setAiSuggestion(null);
      return;
    }
    const filtered = catalogNames.filter((name) =>
      name.toLowerCase().includes(value.toLowerCase())
    );
    setSuggestions(filtered.slice(0, 5));
  }, [value, catalogNames]);

  // AI normalization with debounce
  const normalizeWithAI = useCallback(async (input: string) => {
    if (!input.trim() || input.length < 3) return;
    
    // Skip if input exactly matches a catalog name
    if (catalogNames.some((n) => n.toLowerCase() === input.toLowerCase())) {
      setAiSuggestion(null);
      return;
    }

    setIsNormalizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('normalize-integration', {
        body: { input, existing_names: catalogNames },
      });

      if (error) throw error;

      if (data && data.normalized_name && data.normalized_name.toLowerCase() !== input.toLowerCase()) {
        setAiSuggestion({ name: data.normalized_name, isExisting: data.is_existing });
      } else {
        setAiSuggestion(null);
      }
    } catch (err) {
      console.error('Normalization error:', err);
      setAiSuggestion(null);
    } finally {
      setIsNormalizing(false);
    }
  }, [catalogNames]);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    setShowSuggestions(true);
    
    // Debounce AI call
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => normalizeWithAI(newValue), 800);
  };

  const selectSuggestion = (name: string) => {
    onChange(name);
    setShowSuggestions(false);
    setAiSuggestion(null);
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasDropdown = showSuggestions && (suggestions.length > 0 || aiSuggestion || isNormalizing);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => value.trim() && setShowSuggestions(true)}
        placeholder={placeholder || 'Nome do sistema'}
        className={cn('h-8 text-sm', className)}
      />
      {isNormalizing && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}

      {hasDropdown && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden">
          {/* Catalog suggestions */}
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              onClick={() => selectSuggestion(name)}
            >
              {name}
            </button>
          ))}

          {/* AI suggestion */}
          {aiSuggestion && (
            <>
              {suggestions.length > 0 && <div className="border-t border-border" />}
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => selectSuggestion(aiSuggestion.name)}
              >
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>
                  Você quis dizer <strong>{aiSuggestion.name}</strong>?
                </span>
                {aiSuggestion.isExisting && (
                  <Badge variant="secondary" className="text-[9px] ml-auto">
                    no catálogo
                  </Badge>
                )}
              </button>
            </>
          )}

          {/* Loading */}
          {isNormalizing && suggestions.length === 0 && !aiSuggestion && (
            <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Verificando catálogo...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
