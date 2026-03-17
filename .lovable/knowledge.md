# 🧠 EZ Journey — Knowledge File (T=0)

> **Last updated:** 2026-03-10
> **Status:** Production

---

## 1. Product Vision

**EZ Journey** is a corporate productivity system built for **EZSoft**, a B2B SaaS company. It combines CRM, Sales Pipeline Management, Project Management, and Communication tools into a single platform.

### Who it's for
- **Sales teams** (SDRs and Closers) managing leads, opportunities, proposals, and client evolution
- **Post-sales teams** (Head, UX/PO, Dev Chatbot, Treinamento, Suporte, Verificação BM) managing project delivery
- **Managers and Admins** overseeing operations, reports, and system configuration

### Core value proposition
End-to-end journey management: from lead acquisition → qualification → proposal → sale → project delivery → client evolution — all in one platform with role-based isolation, AI-powered insights, and real-time collaboration.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Build** | Vite + React 18 + TypeScript (strict, zero `any`) |
| **Styling** | Tailwind CSS v3, mobile-first, HSL CSS variables for theming |
| **UI Library (primary)** | Kibo UI (`kibo-ui.com`) — kanban, gantt, tables, calendar, list |
| **UI Library (secondary)** | shadcn/ui (Radix UI primitives) — dialogs, dropdowns, forms, etc. |
| **State** | Zustand (global stores) + `useState`/`useReducer` (local) |
| **Data Fetching** | TanStack React Query v5 (30s staleTime, 5min gcTime, no refetchOnWindowFocus) |
| **Routing** | React Router v6 (lazy-loaded pages with Suspense) |
| **Backend** | Lovable Cloud (Supabase under the hood) — Postgres, Auth, Edge Functions, Storage, Realtime |
| **Forms** | React Hook Form + Zod schema validation |
| **Charts** | Recharts |
| **Rich Text** | TipTap (mentions, links, color, alignment) |
| **Icons** | Lucide React |
| **Animations** | Framer Motion + tailwindcss-animate |
| **Theme** | next-themes (system/light/dark) |
| **DnD** | @dnd-kit/core + @dnd-kit/sortable |
| **Toasts** | Sonner + Radix Toast (dual system) |
| **XSS Protection** | DOMPurify (mandatory for user-generated HTML) |
| **Excel** | xlsx (SheetJS) for import/export |

---

## 3. Design System

### 3.1 Aesthetic
**Minimalism + Density** — inspired by Linear.app + ClickUp 4.0. Clean surfaces, subtle borders, deliberate whitespace, and information-dense views.

### 3.2 Color Tokens (HSL via CSS Variables)

All colors defined in `src/index.css` as HSL triplets consumed via `hsl(var(--token))`.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | `220 22% 97%` | `224 18% 8%` | Page background |
| `--foreground` | `222 25% 14%` | `220 14% 94%` | Primary text |
| `--card` | `0 0% 100%` | `224 16% 12%` | Card surface |
| `--primary` | `250 91% 64%` | `250 88% 68%` | Brand violet |
| `--secondary` | `220 18% 92%` | `224 14% 18%` | Secondary surfaces |
| `--muted` | `220 18% 92%` | `224 14% 18%` | Muted backgrounds |
| `--muted-foreground` | `220 12% 44%` | `220 10% 58%` | Secondary text |
| `--accent` | `250 100% 96%` | `250 35% 20%` | Hover/badge |
| `--destructive` | `0 78% 48%` | `0 68% 58%` | Error/delete |
| `--success` | `152 65% 38%` | `152 58% 48%` | Success states |
| `--warning` | `38 92% 48%` | `38 90% 55%` | Warning states |
| `--info` | `210 85% 52%` | `210 80% 60%` | Info states |
| `--border` | `220 16% 86%` | `224 12% 22%` | Borders |
| `--brand-accent` | `180 100% 54%` | `180 90% 58%` | Cyan accent |

**Status badge tokens:** `--status-new-*`, `--status-in-contact-*`, `--status-scheduled-*`, `--status-confirmed-*`, `--status-opportunity-*`, `--badge-outbound-*`

### 3.3 Typography
- **Body:** Inter (400/500/600/700)
- **Headings:** Inter with `tracking-[-0.02em]`
- **Monospace:** SF Mono / Roboto Mono (CNPJs, codes)
- **Scale:** Tailwind defaults (`text-xs` → `text-2xl`)

### 3.4 Spacing & Layout
- **Border radius:** `--radius: 0.5rem` (lg=0.5rem, md=calc-2px, sm=calc-4px)
- **Card pattern:** `bg-card border border-border rounded-lg shadow-sm`
- **Gaps:** 20-24px between cards/columns, 20-24px internal padding
- **Modals:** `max-w-2xl` default, `backdrop-blur-sm`, `shadow-xl`, `p-6`
- **Tables:** zebra (`even:bg-muted/30`) + hover (`hover:bg-accent/50`)

### 3.5 Dark Mode Rules
- 3-layer surface hierarchy: `background` → `card` → `popover`
- Never hardcode colors — always use semantic tokens
- Shadows are much subtler in dark mode
- All components must work in both modes

### 3.6 Component Naming
- **PascalCase** for components: `LeadModal.tsx`, `CloserKanbanView.tsx`
- **camelCase** for hooks: `useLeads.ts`, `useCloserPipeline.ts`
- **camelCase** for services: `closerService.ts`, `leadService.ts`
- **camelCase** for utils: `dateFormat.ts`, `phoneMask.ts`
- Always use `cn()` from `@/lib/utils` — never concatenate classNames

---

## 4. User Roles & Permissions

### 4.1 Role Hierarchy

| Role | Enum (`app_role`) | Access Scope |
|------|-------------------|-------------|
| **Admin** | `admin` | Full access to all modules, settings, reports, user management |
| **Manager** | `manager` | Same as Admin functionally, can access both sales + projects |
| **SDR** | `sdr` | Lead Inbox, cadences, SDR indicators, ICP analysis |
| **Closer** | `closer` | Closer pipeline (new business + evolution), proposals, simulator, accounts |
| **Head Pós-Venda** | `head_pos_venda` | Treated as Admin for access; default project owner; manages all project phases |
| **UX/PO** | `ux_po` | Project views (assigned projects only unless admin) |
| **Dev Chatbot** | `dev_chatbot` | Project views (assigned projects only), API analysis |
| **Treinamento** | `treinamento` | Project views (assigned projects only) |
| **Suporte** | `suporte` | Project views |
| **Verificação BM** | `verificacao_bm` | Project views |

### 4.2 Permission System
- **Dual system:** Legacy role-based (`allowedRoles` on routes) + granular permission-based (`requiredPermission` via `permissions` table)
- Permissions fetched via RPC `get_user_permissions()` (SECURITY DEFINER)
- Role simulation available for admins via `useRoleSimulation` Zustand store
- `ProtectedRoute` component guards all routes with role/permission checks

### 4.3 Route Access Matrix

| Route | Allowed Roles |
|-------|--------------|
| `/leads` | sdr, admin, manager |
| `/sdr/indicadores`, `/sdr/icp`, `/cadences` | sdr, admin, manager |
| `/closer`, `/closer/evolucao`, `/closer/indicadores` | closer, admin, manager |
| `/simulator`, `/simulator/evolucao` | sdr, closer, admin, manager |
| `/proposals`, `/proposal/:id` | closer, admin, manager |
| `/accounts` | closer, admin, manager |
| `/projects`, `/projects/phase/:phaseName` | admin, manager, closer, head_pos_venda, ux_po, dev_chatbot, treinamento |
| `/tasks` | all authenticated roles |
| `/settings/*` | requires `access_admin` permission |
| `/import-history` | admin, manager |
| `/profile`, `/calendar`, `/notifications` | all authenticated |

### 4.4 Default Redirects (unauthorized)
- Closer → `/closer`
- SDR → `/`
- Project roles → `/projects`
- Others → `/`

---

## 5. Core Features & User Journeys

### 5.1 Lead Management (SDR Module)

**Components:** `LeadInbox`, `LeadModal`, `LeadRow`, `LeadDrawer`, `NewLeadDialog`, `LeadAdvancedFilter`, `FilterTabs`, `BulkActionsBar`
**Hooks:** `useLeads`, `useLeadModal`, `useLeadModalActions`, `useLeadTimeline`, `useLeadContacts`
**Services:** `leadService.ts`

- **Lead Inbox** with paginated server-side search (RPC `search_leads_paginated`)
- Tab-based filtering: Today, Overdue, New, In Contact, Scheduled, etc.
- **Lead Modal** (full-width 2-column layout): operation column (notes, timeline) + context column (company data, contacts, qualification)
- AI Summary generation per lead
- CNPJ enrichment via CNPJA API
- Cadence management (multi-step sequences: call, email, WhatsApp)
- Bulk actions: reassign, delete, export
- SDR selector (filter by assigned SDR)
- **SQO Validation**: qualification score + behavioral score before meeting confirmation
- When meeting confirmed → auto-creates Opportunity in Closer pipeline

### 5.2 Closer Pipeline (Sales Module)

**Components:** `CloserPipelinePage`, `CloserKanbanView`, `CloserTableView`, `SendToCloserDialog`, `CloserLostReasonDialog`
**Hooks:** `useCloserPipeline`, `useCloserPipelineDialogs`, `useCloserReports`
**Services:** `closerService.ts`

- **Dual pipeline:** New Business (`/closer`) and Evolution (`/closer/evolucao`)
- Kanban and Table views with server-side pagination (RPC `search_opportunities_paginated`)
- Stages: Demonstração → Proposta Enviada → Negociação → Ganho / Perdido
- Opportunity detail via LeadModal (shared component)
- Closer selector (filter by assigned closer)
- Tab-based views: Opportunities, Meetings, Sales
- Meeting datetime management
- Lost reason tracking with categorized reasons
- Revenue dashboard with indicators

### 5.3 Evolution Pipeline

**Components:** `EvolutionPipelinePage`, `NewDealFromClientDialog`
**Business rule:** Opportunities from active clients are auto-classified as `opportunity_type = 'evolution'`

- **CNPJ duplicate rule:** A CNPJ can have MULTIPLE active evolutions simultaneously (unlike new business which blocks duplicates)
- Evolution simulator (`/simulator/evolucao`) omits monthly plans, focuses on one-time payments (Setup + Integrations)
- Source is always "Base de Clientes"

### 5.4 Proposals

**Components:** `ProposalReviewPage`, `ProposalPreviewPage`, `ProposalSuccessPage`, `ProposalsListPage`, `ProposalSimulatorDialog`
**Hooks:** `useSimulator`, `useExchangeRate`

- Simulator generates proposals with product plans, setup costs, integrations
- PDF-style preview with client branding
- Checkout flow for client acceptance (CNPJ, legal rep, financial contact)
- View tracking (`increment_proposal_views`)
- Status: draft → sent → viewed → accepted/rejected

### 5.5 Account Management (Gestão de Contas)

**Components:** `AccountsPage`, `ActiveClientsSection`, `ClientDetailModal`, `ClientImportDialog`, `ICPAnalysisSection`, `ICPChatSection`
**Hooks:** `useActiveClients`, `useClientDeals`

- **Hub-and-Spoke model:** Account (empresa) centralizes contacts, notes, timeline, and linked opportunities
- 360° view via `ClientDetailModal`: Dados Cadastrais, Contatos & Notas, Negociações, Enriquecimento AI
- Auto-linking via triggers: `auto_link_account_on_lead`, `auto_set_opportunity_account`
- Lifecycle progression: `lead` → `opportunity` → `client` (never regresses)
- Client import with duplicate detection (partial CNPJ index)
- ICP Analysis with AI chat

### 5.6 Project Management

**Components:** `ProjectsPage`, `ProjectKanbanView`, `ProjectListView`, `ProjectDetailModal`, `ProjectChecklist`, `ProjectTasksSection`, `ProjectPhaseTimeline`, `ProjectPhaseSidebar`, `PhaseDetailPage`, `ProjectsDashboard`
**Hooks:** `useProjects`, `useProjectModal`, `useProjectTasks`, `useProjectDashboard`, `usePhaseDetail`, `useMyProjects`
**Services:** `projectService.ts`, `projectAssignmentService.ts`, `projectTaskService.ts`

- **Phases:** Validação → UX/PO → Verificação BM → Dev Chatbot → Treinamento → Ativação → Curadoria IA
- Auto-assignment via round-robin (least loaded user per role)
- Head is **always** Lucas Oliveira (`f9e18ed3-...`) for all projects
- Phase status management with custom statuses per phase
- Task management with due dates, priorities, checklists
- Project types: Standard, Evolution, Migration
- Evolution completion rule: Dev Chatbot → asks if AI → Curadoria IA or → Entregue
- ClickUp integration for project import
- Dashboard with KPIs, workload, aging board, SLA, funnel, risk list

### 5.7 Calendar

**Components:** `CalendarPage`, `CalendarWeekGrid`, `CalendarMonthGrid`, `CalendarEventDialog`, `CalendarUpcomingBar`
**Hooks:** `useGoogleCalendar`

- Google Calendar integration (OAuth2 with refresh tokens)
- Week and Month views
- Event creation, editing, deletion
- Upcoming events sidebar

### 5.8 Tasks

**Components:** `TasksPage`, `TaskListItem`, `TaskQueueBar`, `TaskQueueControls`
**Hooks:** `useMyTasks`, `useProjectTasks`

- Unified task view across projects and leads
- Priority, due date, status management
- Task queue with controls

### 5.9 Settings (Admin)

**Components:** `SettingsPage`, `SettingsLayout` with sections: General, People, Teams, Permissions, Templates, Custom Fields, Pipeline/Phase Status, Automatic Messages, Edge Functions, System Logs
**Hooks:** `useAdminUsers`, `useRoles`, `useTeams`, `usePermissions`, `useEmailTemplates`, `usePipelineStatuses`, `usePhaseStatuses`

- User invitation system with role + team assignment
- Role & permission editor (RBAC with `roles`, `permissions`, `role_permissions` tables)
- Email template manager
- Automatic message rules (scheduled + event-driven)
- Pipeline status customization
- Phase status customization
- WhatsApp group manager
- System logs viewer

### 5.10 Communication

- **Email:** Gmail integration (OAuth2), compose dialog, sequence automation
- **WhatsApp:** Direct link integration, group management
- **VoIP:** WebPhone widget (EZCall integration), call history
- **Notifications:** Push + in-app, notification center, permission prompt

### 5.11 Reports & Analytics

- SDR Performance Dashboard: calls, meetings, conversion rates, activity breakdown
- Closer Revenue Dashboard: deal values, win rates, pipeline velocity
- Admin Reports: SDR vs Closer breakdowns, meta costs, goal tracking
- Call Intelligence: audio upload → transcription → AI analysis → scoring

### 5.12 Forms

**Components:** `FormFieldBuilder`, `FormPreview`, `EmbedFormPage`
**Hooks:** `useForms`

- Visual form builder with customizable fields and styling
- Embeddable forms for lead capture
- Webhook support for integrations
- Auto-assignment to SDR/Closer

---

## 6. Architecture Rules

### 6.1 Folder Structure

```
src/
├── assets/              # Static images, logos
├── components/
│   ├── ui/              # shadcn/ui primitives (DO NOT EDIT)
│   ├── kibo-ui/         # Kibo UI components
│   ├── admin/           # Admin-specific components
│   ├── calendar/        # Calendar module
│   ├── checkout/        # Checkout flow
│   ├── clients/         # Account management
│   ├── closer/          # Closer pipeline
│   ├── icons/           # Custom icons
│   ├── projects/        # Project management
│   ├── sdr/             # SDR-specific views
│   ├── sequences/       # Email sequences
│   ├── settings/        # Settings sections
│   ├── shared/          # Cross-module shared components
│   ├── tasks/           # Task components
│   └── [root]           # Feature components (Lead*, Closer*, etc.)
├── contexts/            # React contexts (Sidebar, WebPhone)
├── data/                # Mock data
├── hooks/               # Custom hooks (data fetching, business logic)
├── integrations/
│   ├── supabase/        # Auto-generated client & types (DO NOT EDIT)
│   └── lovable/         # Lovable AI integration
├── lib/                 # Utilities (utils.ts, badgeColors.ts)
├── pages/               # Route-level page components
├── services/            # Business logic services (Supabase queries)
├── stores/              # Zustand stores
├── types/               # TypeScript type definitions
└── utils/               # Pure utility functions
```

### 6.2 Key Patterns

- **Data fetching:** Always via TanStack React Query hooks in `src/hooks/`
- **Business logic:** Centralized in `src/services/` (never in components)
- **Server-side pagination:** Via Postgres RPCs for large datasets (leads, opportunities)
- **Memoization:** `useCallback`, `useMemo`, `React.memo` required for lists, rows, cards
- **Lazy loading:** All pages use `React.lazy()` + `Suspense`
- **Error boundaries:** `RouteErrorBoundary` wraps all routes
- **Heartbeat:** `useHeartbeat` keeps user presence updated

### 6.3 Database Patterns

- **Triggers for automation:** Lead → Account linking, Opportunity → Account linking, Lifecycle progression, Active client insertion on won
- **RPC functions** for complex queries: `search_leads_paginated`, `search_opportunities_paginated`, `get_lead_tab_counts`, `get_opportunity_tab_counts`, `check_cnpj_duplicate_v2`
- **SECURITY DEFINER** functions for privilege escalation: `transfer_lead_owner`, `has_role`, `is_admin`, `is_manager`, `has_permission`
- **RLS policies** on all tables with role-based access
- **Canonical status string:** `'CONCLUÍDO'` (with accent) for completed states

---

## 7. Do Not Touch List

### Files that must NEVER be manually edited:
| File | Reason |
|------|--------|
| `src/integrations/supabase/client.ts` | Auto-generated by Lovable Cloud |
| `src/integrations/supabase/types.ts` | Auto-generated from database schema |
| `supabase/config.toml` | Auto-configured by Lovable Cloud |
| `.env` | Auto-configured by Lovable Cloud |
| `supabase/migrations/*` | Managed by migration tool |

### Files that require extreme caution:
| File | Reason |
|------|--------|
| `src/components/ProtectedRoute.tsx` | Auth gate for entire app |
| `src/hooks/useUserRole.ts` | Role resolution logic |
| `src/hooks/usePermissions.ts` | Permission resolution logic |
| `src/services/projectAssignmentService.ts` | Head assignment logic (FIXED_HEAD_USER_ID) |
| `src/services/closerService.ts` | Opportunity creation + CNPJ duplicate rules |
| `src/components/ui/*` | shadcn primitives — extend via feature components |

---

## 8. Prompting Rules for This Project

1. **Always specify scope:** Which page, which role, which module a change applies to
2. **Feature breakdown order:** UI → data connection → logic → edge cases → role test
3. **One feature per prompt** — never bundle unrelated changes
4. **After every working feature:** Ask to pin the version before continuing
5. **Check Kibo UI first** before creating custom components (`kibo-ui.com/components`)
6. **Fallback to shadcn/ui** only if Kibo UI doesn't have the component
7. **Never use raw colors** — always semantic tokens via `hsl(var(--token))`
8. **Never use `any`** — always explicit TypeScript interfaces
9. **Always use `cn()`** for className composition
10. **Dark mode:** Every new component must work in both light and dark
11. **Performance:** Memoize lists, virtualize large datasets, lazy-load pages
12. **Security:** RLS on all new tables, SECURITY DEFINER for cross-role operations, DOMPurify for user HTML
13. **Business rules live in services** (`src/services/`), not in components
14. **Language:** UI is in Brazilian Portuguese (pt-BR), code is in English

---

## 9. Critical Business Rules Summary

| Rule | Description |
|------|------------|
| **CNPJ Uniqueness (New Business)** | Block duplicate CNPJ when active opportunity exists |
| **CNPJ Uniqueness (Evolution)** | Allow multiple active evolutions for same CNPJ |
| **Account Auto-Link** | Trigger creates/links Account on Lead insert via CNPJ |
| **Lifecycle Progression** | Account lifecycle only upgrades: lead → opportunity → client |
| **Head Assignment** | Lucas Oliveira is always Head for all projects (manual + import) |
| **Role Round-Robin** | UX/PO, Dev, Treinamento assigned by least-loaded algorithm |
| **SQO Validation** | Qualification + behavioral score required before meeting confirmation |
| **Won → Active Client** | Trigger inserts lead into `active_clients` on stage "Ganho" |
| **Evolution Completion** | Dev Chatbot done → ask if AI → Curadoria IA or Entregue |
| **Status Canonical** | Use `'CONCLUÍDO'` (accented) for completed states |
