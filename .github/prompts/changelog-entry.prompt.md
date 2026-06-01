---
description: 'Generate a CHANGELOG entry from recently merged PRs or commit history. Invoke after a release or sprint to document what changed.'
agent: agent
tools: [execute, read]
argument-hint: "Version number or date range (e.g., 'v1.1.0' or 'last 2 weeks')"
---

Review the recent git log (`git log --oneline`) and generate a CHANGELOG entry in Keep a Changelog format:

```markdown
## [version] - YYYY-MM-DD

### Added

- [new features]

### Changed

- [changes to existing functionality]

### Fixed

- [bug fixes]

### Security

- [security fixes]
```

Rules:

- Group commits by type using their conventional commit prefix
- Write each entry as a user-facing description (what changed for the user), not a technical description of the code change
- Skip `chore`, `style`, `test`, and `docs` commits unless they have meaningful user impact
- If a version number was provided, use it; otherwise use `[Unreleased]`

Output the markdown block ready to prepend to `CHANGELOG.md`.
