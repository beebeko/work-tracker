---
description: Route test planning and implementation through the testing specialist
applyTo: "**/*.agent.md, **/*test*.md, **/*testing*.md, **/*qa*.md, **/*spec*.md"
---

# Compatibility Alias

This file is kept for compatibility with existing references.
The canonical file is `.github/instructions/testing.instructions.md`.

# Testing Workflow

For all testing work (unit, integration, end-to-end):

1. Use the agent defined in .github/agents/testing-agent.agent.md.
2. Run feature preflight via .github/agents/feature-tracker.agent.md before planning tests.
3. Proceed only when gatekeeping_result.allow_downstream=true.

# Required Test Layers

Every accepted feature-level testing request must include:

- unit tests (Vitest)
- integration tests (Vitest + React Testing Library)
- end-to-end tests for critical journeys (Playwright), including compatibility validation on Chromium, WebKit, and Firefox for relevant UI flows

If a layer is intentionally excluded, include a clear rationale and follow-up task.

Browser compatibility failures are blocking unless explicitly waived with a clear, documented rationale.

# Failure Mode Requirements

Test plans must cover:

- happy path
- validation failures
- async/network failures
- empty and loading states
- recovery or retry behavior where applicable

A plan missing failure-path coverage is incomplete.

# Mocking Guardrails

- Mock only external boundaries (network/services/timers/process APIs).
- Do not mock core domain logic or component behavior under test.
- Avoid tests that primarily assert mock call counts without observable behavior checks.
- Prefer realistic integrations over isolated mock-heavy setups when confidence is unclear.

# Coverage Tracking

Track and report:

- statements
- branches
- functions
- lines

Coverage percentages are required, but quality is mandatory.
High coverage without meaningful failure-mode or behavior assertions is not acceptable.

# Required Output Format

When delivering testing work, include:

1. Layered test plan (unit/integration/E2E)
2. Failure modes covered
3. Coverage impact summary
4. Remaining gaps and recommended follow-ups

# Recording

For accepted testing work, append a history entry in the mapped feature record with:

- date
- request summary
- test scope
- coverage impact
- acting agent
