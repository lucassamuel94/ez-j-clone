import { Moon, Sun, Monitor, Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';

interface ThemeToggleProps {
  /** When true, renders as a DropdownMenuSub item (for use inside a DropdownMenu) */
  asSubmenu?: boolean;
}

export function ThemeToggle({ asSubmenu = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  if (asSubmenu) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="cursor-pointer gap-2.5 rounded-lg text-[13px] font-medium h-8">
          <Sun className="h-4 w-4 text-muted-foreground rotate-0 scale-100 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 text-muted-foreground rotate-90 scale-0 dark:rotate-0 dark:scale-100" />
          <span>Tema</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="rounded-xl bg-card dark:bg-popover border border-border/30 shadow-xl shadow-black/10 p-1">
          <DropdownMenuItem className="cursor-pointer gap-2.5 rounded-lg text-[13px] font-medium h-8" onSelect={() => setTheme('light')}>
            <Sun className="h-4 w-4 text-muted-foreground" />
            Claro
            {theme === 'light' && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer gap-2.5 rounded-lg text-[13px] font-medium h-8" onSelect={() => setTheme('dark')}>
            <Moon className="h-4 w-4 text-muted-foreground" />
            Escuro
            {theme === 'dark' && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer gap-2.5 rounded-lg text-[13px] font-medium h-8" onSelect={() => setTheme('system')}>
            <Monitor className="h-4 w-4 text-muted-foreground" />
            Sistema
            {theme === 'system' && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Alternar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Claro</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Escuro</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          <span>Sistema</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
