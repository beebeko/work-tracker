---
description: "Generate a structured pull request description from staged or recently changed code. Includes summary, motivation, changes, test coverage, and any breaking changes."
agent: agent
tools: [read, search, execute]
argument-hint: "Feature or bug fix area (optional — will be inferred from changed files)"
---

Review the staged or recently changed files and generate a pull request description using this format:

## Summary
[1-2 sentence summary of what this PR does]

## Motivation
[Why was this change needed? Reference the feature or bug it addresses.]

## Changes
[Bullet list of what changed, grouped by area: data model, service layer, UI, tests, config]

## Test coverage
[What tests were added or updated? What scenarios do they cover?]

## Breaking changes
[Any breaking changes? If none, write "None."]

## Checklist
- [ ] Tests pass (`npm test`)
- [ ] Lint clean (`npm run lint`)
- [ ] Coverage thresholds met (`npm run test:coverage`)
- [ ] Firestore rules updated (if new collections added)
- [ ] No sensitive data committed

Keep the tone factual and concise. Do not include phrases like "I added" or "we changed" — use passive voice or direct description.
