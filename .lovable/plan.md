

## Corrigir layout das páginas e erro de build

### Problema 1 — Título deslocado para a direita
As páginas "Meus Clientes" e "Parceiros Comerciais" usam `container mx-auto` no wrapper do header, o que aplica um `max-width` e centraliza o conteúdo. Em telas largas com sidebar, isso desloca o título para a direita em vez de alinhá-lo à esquerda.

**Correção:** Remover `container mx-auto` do wrapper do header em ambas as páginas, mantendo apenas o padding direto. O mesmo ajuste no body content (`p-6`) já está correto.

### Problema 2 — Erro de build TS2769
`BusinessRulesChatSection.tsx` linha 226: `supabase.from('business_rules_logs')` não reconhece a tabela nos tipos gerados.

**Correção:** Adicionar cast `as any` na chamada.

### Alterações

| Arquivo | Mudança |
|---|---|
| `src/pages/SDRMyClientsPage.tsx` (L245) | `container mx-auto px-3 sm:px-4 py-3` → `px-3 sm:px-4 py-3` |
| `src/pages/CloserPartnersPage.tsx` (L316) | `container mx-auto px-3 sm:px-4 py-3` → `px-3 sm:px-4 py-3` |
| `src/components/settings/BusinessRulesChatSection.tsx` (L226) | `supabase.from('business_rules_logs')` → `(supabase as any).from('business_rules_logs')` |

