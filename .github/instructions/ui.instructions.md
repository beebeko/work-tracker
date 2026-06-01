---
description: 'Use when creating or editing UI components, screens, or navigation. Covers the VSCode/QLab design language, icon and tooltip conventions, component structure, and design consistency rules.'
applyTo: 'src/components/**,src/screens/**,app/**'
---

# UI Guidelines

## Design language

Inspired by VSCode and QLab:

- **Minimal ornamentation**: No decorative borders, gradients, or shadows unless they carry functional meaning.
- **Dark-first**: Use the theme token system. Never hardcode colors.
- **Dense but breathable**: Compact layouts with deliberate whitespace. Prefer tables and lists over cards for data.
- **Iconography**: Use icons to reinforce meaning, never as the sole source of meaning. Every interactive icon must have a tooltip. When in doubt, show the label too.

## Tooltips

- Every icon-only button, status icon, and non-obvious control gets a `Tooltip` component.
- Tooltip text must be concise (≤10 words) and action-oriented: "Mark gig on hold" not "Hold".

## Component structure

- One component per file. File name matches component name.
- Props interface defined above the component: `interface Props { ... }`.
- No inline styles. Use `StyleSheet.create` or the theme system.
- Extract any logic that isn't rendering into a hook or utility function.

## Consistency rules

- **Same action, same control**: If deleting a client uses a confirm dialog, deleting a gig uses the same confirm dialog component.
- **Same data shape, same display**: Hours are always formatted `Xh Ym`. Money is always `$X,XXX.XX`. Dates are always `MMM D, YYYY`.
- Before creating a new component, check `src/components/` — reuse before reinventing.
- Extract any pattern used more than twice into a shared component.

## Navigation

- Use Expo Router file-based routing. Tabs in `app/(tabs)/`, modals in `app/(modals)/`.
- Tab bar: maximum 5 tabs. Use icons with labels.
- Stack navigators for drill-down flows (client → gigs → entries).
