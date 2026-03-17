import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, ChevronDown } from 'lucide-react';
import { CoachingAnnotation, CATEGORY_COLORS, IMPACT_COLORS } from './types';

interface Props {
  annotation: CoachingAnnotation;
}

export function CoachingAnnotationCard({ annotation }: Props) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_COLORS[annotation.category] || CATEGORY_COLORS.rapport;
  const imp = IMPACT_COLORS[annotation.impact] || IMPACT_COLORS.medium;

  return (
    <div
      className={`ml-10 mr-2 my-1 border-l-[3px] ${cat.border} rounded-r-lg ${cat.bg} transition-all cursor-pointer`}
      onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
    >
      <div className="px-3 py-2">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className={`h-3.5 w-3.5 shrink-0 ${cat.text}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${cat.text}`}>
            Coach sugere
          </span>
          <Badge variant="outline" className={`text-[9px] h-4 px-1.5 border-0 ${cat.bg} ${cat.text}`}>
            {cat.label}
          </Badge>
          <Badge variant="outline" className={`text-[9px] h-4 px-1.5 border-0 ${imp.bg} ${imp.text}`}>
            {imp.label}
          </Badge>
          <ChevronDown className={`h-3 w-3 ml-auto text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>

        {/* Collapsed: show suggestion preview */}
        <p className={`text-xs ${cat.text} font-medium leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
          &ldquo;{annotation.suggestion}&rdquo;
        </p>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-2 space-y-2 border-t border-current/10 pt-2">
            {/* Original quote */}
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                O que foi dito:
              </span>
              <p className="text-xs text-muted-foreground line-through decoration-1 leading-relaxed mt-0.5">
                &ldquo;{annotation.quote}&rdquo;
              </p>
            </div>

            {/* Rationale */}
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Por que importa:
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                {annotation.rationale}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
