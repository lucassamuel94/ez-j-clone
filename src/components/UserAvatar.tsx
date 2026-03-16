import * as React from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';

interface UserAvatarProps {
  avatarUrl: string | null;
  userName: string;
}

export const UserAvatar = React.forwardRef<HTMLAnchorElement, UserAvatarProps>(function UserAvatar({ avatarUrl, userName }, ref) {
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Link to="/profile" className="block relative" ref={ref}>
      <Avatar className="h-8 w-8 cursor-pointer ring-1 ring-border/50 shadow-sm hover:ring-2 hover:ring-primary/50 transition-all">
        <AvatarImage src={avatarUrl || undefined} alt={userName} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
          {initials || <User className="h-3.5 w-3.5" />}
        </AvatarFallback>
      </Avatar>
      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card" />
    </Link>
  );
});
