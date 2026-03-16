import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navegação Geral',
    shortcuts: [
      { keys: ['⌘', 'B'], description: 'Abrir/fechar barra lateral' },
      { keys: ['?'], description: 'Abrir atalhos de teclado' },
    ],
  },
  {
    title: 'Calendário',
    shortcuts: [
      { keys: ['Alt', 'M'], description: 'Visualização por mês' },
      { keys: ['Alt', 'S'], description: 'Visualização por semana' },
      { keys: ['Alt', 'D'], description: 'Visualização por dia' },
      { keys: ['T'], description: 'Ir para hoje' },
    ],
  },
];

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <Keyboard className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            Atalhos de Teclado
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1.5 px-1">
                {group.title}
              </h3>
              <div className="border border-border rounded-lg divide-y divide-border bg-card">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.description}
                    className="flex items-center justify-between py-2.5 px-3"
                  >
                    <span className="text-[13px] text-foreground">{s.description}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-4">
                      {s.keys.map((key, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-muted-foreground/40 text-[10px]">+</span>
                          )}
                          <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/60 border border-border rounded shadow-[0_1px_0_0] shadow-border">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Hook to open shortcut dialog with "?" key */
export function useShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { open, setOpen };
}
