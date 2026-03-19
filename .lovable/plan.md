

## Fix: Collapsible sidebar sections not toggling

### Root cause
The `SectionLabel` component has a **double-toggle bug**. It uses `CollapsibleTrigger` (which triggers `Collapsible`'s `onOpenChange` → calls `toggleSection`) AND has its own `onClick` handler that also calls `toggleSection`. Both fire on the same click, so the section toggles open then immediately toggles closed again — appearing to do nothing.

### Fix (single file: `src/components/AppSidebar.tsx`)

1. **Remove the `onClick` handler from the button inside `SectionLabel`** — let `CollapsibleTrigger` + `Collapsible.onOpenChange` handle the toggle exclusively.
2. Clean up the unused `onToggle` prop from `SectionLabel` since the toggle is now fully managed by Radix's `Collapsible` component.

This is a ~5 line change in the `SectionLabel` component.

