# work-tracker — AI Agent Guide

## Always read before writing code

- Read the exact versioned Expo docs at https://docs.expo.dev/versions/v56.0.0/ before writing any Expo or React Native code.
- Read `.github/instructions/global.instructions.md` for project-wide conventions.
- Read the relevant scoped instruction file before editing files in `src/services/`, `src/pay/`, `src/components/`, or `functions/`.

## Available agents

| Agent | Invoke when... |
|---|---|
| `feature-manager` | Implementing any new feature |
| `ai-manager` | AI tooling needs auditing or updating |
| `bug-resolver` | Investigating and fixing a bug |
| `code-reviewer` | Before opening any PR |
| `test-writer` | Auditing or writing missing tests |
| `data-modeler` | Designing or reviewing a Firestore schema |
| `refactor-guide` | Cleaning up complex or duplicated code |

## Available prompts (`/` in chat)

- `pr-description` — Generate PR description from diff
- `commit-message` — Generate conventional commit message
- `generate-seed-data` — Generate test fixtures for an entity
- `email-extract-prompt` — Generate/refine OpenAI email extraction prompt
- `changelog-entry` — Generate CHANGELOG entry from git log

## Project conventions summary

- **Framework**: Expo Router (universal web + iOS), TypeScript strict
- **Backend**: Firebase (Firestore, Auth, Cloud Functions)
- **Data fetching**: React Query — no direct Firestore calls from components
- **Testing**: Jest + React Testing Library, 80% global coverage, 95% for `src/pay/`
- **Style**: ESLint + Prettier (run `npm run lint` and `npm run format:check`)

