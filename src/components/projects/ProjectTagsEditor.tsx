import { useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Plus, X, Tag } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";


const fetchAllProjectTags = async (): Promise<string[]> => {
  const { data } = await supabase
    .from("projects")
    .select("tags")
    .not("tags", "is", null);
  if (!data) return [];
  const allTags = new Set<string>();
  for (const p of data) {
    if (Array.isArray(p.tags)) {
      for (const t of p.tags) allTags.add(t);
    }
  }
  return Array.from(allTags).sort();
};

interface ProjectTagsEditorProps {
  projectId: string;
  tags: string[];
  canEdit: boolean;
  onUpdate?: (tags: string[]) => void;
}

export function ProjectTagsEditor({ projectId, tags, canEdit, onUpdate }: ProjectTagsEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Cached query for tag autocomplete — avoids full table scan on every popover open
  const { data: allKnownTags = [] } = useQuery({
    queryKey: ["project-tags-autocomplete"],
    queryFn: fetchAllProjectTags,
    staleTime: 60_000,
    enabled: isAdding,
  });

  const suggestions = allKnownTags.filter((t) => !tags.includes(t));

  const saveTagsToDb = useCallback(
    async (newTags: string[]) => {
      const { error } = await supabase
        .from("projects")
        .update({ tags: newTags } as Record<string, unknown>)
        .eq("id", projectId);
      if (error) {
        toast.error("Erro ao salvar tags");
        return;
      }
      onUpdate?.(newTags);
    },
    [projectId, onUpdate],
  );

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (!trimmed || tags.includes(trimmed)) {
        setNewTag("");
        return;
      }
      const updated = [...tags, trimmed];
      saveTagsToDb(updated);
      setNewTag("");
    },
    [tags, saveTagsToDb],
  );

  const removeTag = useCallback(
    (tag: string) => {
      const updated = tags.filter((t) => t !== tag);
      saveTagsToDb(updated);
    },
    [tags, saveTagsToDb],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newTag.trim()) {
      e.preventDefault();
      addTag(newTag);
    }
    if (e.key === "Escape") {
      setIsAdding(false);
      setNewTag("");
    }
  };

  const filteredSuggestions = newTag.trim()
    ? suggestions.filter((s) => s.includes(newTag.trim().toLowerCase()))
    : suggestions.slice(0, 8);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className="text-[10px] px-2 py-0.5 h-6 rounded-md font-medium border cursor-default group/tag bg-primary/8 text-primary border-primary/20"
        >
          {tag}
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="ml-0.5 opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-destructive"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </Badge>
      ))}
      {canEdit && (
        <Popover open={isAdding} onOpenChange={(open) => { setIsAdding(open); if (!open) setNewTag(""); }}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/50 hover:text-primary transition-colors px-1 py-0.5 rounded",
                tags.length === 0 && "text-muted-foreground/30",
              )}
            >
              <Plus className="h-2.5 w-2.5" />
              <span className="hidden sm:inline">{tags.length === 0 ? "Adicionar tag" : ""}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="start" side="bottom">
            <div className="space-y-2">
              <Input
                ref={inputRef}
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nova tag..."
                className="h-7 text-xs"
                autoFocus
              />
              {filteredSuggestions.length > 0 && (
                <div className="space-y-0.5 max-h-[140px] overflow-y-auto">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 px-1">
                    Sugestões
                  </span>
                  {filteredSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => addTag(s)}
                      className="flex items-center gap-1.5 w-full text-left px-1.5 py-1 rounded text-xs text-foreground/70 hover:bg-muted/50 transition-colors"
                    >
                      <Tag className="h-2.5 w-2.5 text-muted-foreground/40" />
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
