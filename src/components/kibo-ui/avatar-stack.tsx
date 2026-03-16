'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ---------- Types ----------

interface AvatarItem {
  name: string;
  image?: string;
}

interface AvatarStackProps {
  avatars: AvatarItem[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// ---------- Helpers ----------

const sizeClasses: Record<string, string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ---------- Component ----------

export function AvatarStack({ avatars, max = 3, size = 'sm', className }: AvatarStackProps) {
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;
  const sizeClass = sizeClasses[size];

  return (
    <div className={cn('flex -space-x-2', className)}>
      {visible.map((avatar, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <Avatar className={cn(sizeClass, 'ring-2 ring-background cursor-default')}>
              {avatar.image && <AvatarImage src={avatar.image} alt={avatar.name} />}
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(avatar.name)}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {avatar.name}
          </TooltipContent>
        </Tooltip>
      ))}
      {remaining > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className={cn(sizeClass, 'ring-2 ring-background cursor-default')}>
              <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                +{remaining}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {avatars.slice(max).map((a) => a.name).join(', ')}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
