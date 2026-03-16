import { LayoutGrid } from 'lucide-react';

export function CustomFieldsSection() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <LayoutGrid className="h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm font-medium text-muted-foreground">Campos Personalizados</p>
      <p className="text-xs text-muted-foreground/70">Em breve</p>
    </div>
  );
}
