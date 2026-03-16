import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollIndicatorProps {
  scrollContainerRef: React.RefObject<HTMLElement>;
  className?: string;
}

export const ScrollIndicator = ({ scrollContainerRef, className }: ScrollIndicatorProps) => {
  const [showIndicator, setShowIndicator] = useState(false);

  const checkScrollable = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Find the actual scrollable viewport inside ScrollArea
    const viewport = container.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const { scrollTop, scrollHeight, clientHeight } = viewport;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50;
    const hasScrollContent = scrollHeight > clientHeight + 10;
    
    setShowIndicator(hasScrollContent && !isNearBottom);
  }, [scrollContainerRef]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const viewport = container.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    // Initial check
    checkScrollable();

    // Add scroll listener
    viewport.addEventListener('scroll', checkScrollable);
    
    // Check on resize
    const resizeObserver = new ResizeObserver(checkScrollable);
    resizeObserver.observe(viewport);

    return () => {
      viewport.removeEventListener('scroll', checkScrollable);
      resizeObserver.disconnect();
    };
  }, [checkScrollable, scrollContainerRef]);

  if (!showIndicator) return null;

  return (
    <div 
      className={cn(
        "absolute bottom-0 left-0 right-0 h-16 pointer-events-none",
        "bg-gradient-to-t from-card via-card/80 to-transparent",
        "flex items-end justify-center pb-2",
        className
      )}
    >
      <div className="flex flex-col items-center gap-0.5 text-muted-foreground animate-bounce">
        <ChevronDown className="h-4 w-4" />
        <span className="text-xs">Mais</span>
      </div>
    </div>
  );
};
