import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ActivityAvatarProps {
  name?: string;
  avatarUrl?: string;
  size?: 'sm' | 'md';
}

export function ActivityAvatar({ name, avatarUrl, size = 'md' }: ActivityAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const dim = size === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-7 w-7 text-[10px]';
  const initials = name
    ? name.trim().split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
    : 'U';

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Avatar'}
        onError={() => setImgError(true)}
        className={cn(dim, 'rounded-full object-cover flex-shrink-0 ring-1 ring-border/30')}
      />
    );
  }

  return (
    <div className={cn(dim, 'rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center flex-shrink-0')}>
      {initials}
    </div>
  );
}
