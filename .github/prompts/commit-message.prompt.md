---
description: "Generate a conventional commit message for staged changes. Follows the Conventional Commits spec: type(scope): description."
agent: agent
tools: [read, execute]
argument-hint: "Optional: brief note about intent (will be inferred from diff if omitted)"
---

Review the staged changes and generate a commit message following Conventional Commits format:

```
<type>(<scope>): <short description>

[optional body — only if the short description is insufficient]

[optional footer — breaking changes or issue references]
```

**Types**: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`

**Scope**: the area of the codebase (e.g., `pay-engine`, `gig-form`, `invoice`, `auth`, `firestore-rules`, `ci`)

**Rules**:
- Short description: imperative mood, lowercase, no period, ≤72 characters
- Body: explain *why*, not *what* — the diff shows what
- Only include a body if the short description doesn't fully capture the change
- Breaking changes: `BREAKING CHANGE: <description>` in footer

Output just the commit message text, ready to copy-paste.
