# work-tracker — Global AI Instructions

This is a freelance time-tracking app built with Expo Router (universal web + iOS), Firebase (Firestore, Auth, Cloud Functions), TypeScript, and React Query.

## Core principles

- **Clarify before assuming**: If a prompt is ambiguous or incomplete, ask before proceeding. Never guess at intent.
- **DRY and SOLID**: Every change should leave the code more maintainable than it found it. Extract shared logic into reusable modules. Single responsibility everywhere.
- **Self-describing code**: Names should explain purpose. Add comments only where reasoning is genuinely non-obvious. Refactor complex code immediately rather than explaining it.
- **Full test coverage at every step**: Every code change ships with unit, integration, and (where applicable) E2E tests. Coverage must not drop below 80%.

## Code style

- TypeScript strict mode. No `any` without explicit justification.
- Prefer named exports over default exports.
- Path alias `@/` maps to `src/`. Use it consistently.
- Import order (enforced by ESLint): builtin → external → internal → parent → sibling → index.
- All files formatted with Prettier before committing.

## Testing requirements

Every test file must cover:

1. **Happy path** — expected inputs, expected outputs
2. **Error cases** — what happens when upstream calls fail
3. **Bad input** — malformed, missing, or boundary-violating data
4. **Mid-process failure** — what happens when something fails partway through a multi-step operation
5. **Scenario-specific edge cases** — any additional cases unique to the code under test

Tests live at `src/**/__tests__/` or colocated as `*.test.ts(x)`.

## Firebase patterns

- All Firestore access goes through typed service functions in `src/services/`. Components never call Firestore directly.
- Use React Query (`@tanstack/react-query`) for all data fetching — no manual loading/error state.
- Security rules live in `firestore.rules`. Every new collection must have a corresponding rule.
- Single-user for now: all rules gate on `request.auth.uid === resource.data.ownerUid`.

## Security

- Never log sensitive user data (PII, financial figures) to the console.
- All environment variables via `.env.local`, never committed.
- Follow OWASP Top 10 principles. Treat all external inputs (emails, form fields) as untrusted.

## Expo / React Native

- Use Expo Router file-based routing. New screens go in `app/`.
- Shared UI components live in `src/components/`. Never duplicate a component.
- Platform-specific code uses `.ios.tsx` / `.web.tsx` suffixes only when unavoidable.
