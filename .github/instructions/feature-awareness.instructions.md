---
description: Mandatory feature preflight for all planning and execution work
applyTo: "**/*.agent.md, **/*plan*.md, **/*roadmap*.md, **/*spec*.md"
---

# Feature Awareness Preflight

Before proposing plans, implementation tasks, or architecture changes:

1. Run the feature tracker agent defined in .github/agents/feature-tracker.agent.md.
2. Provide the full user request and any relevant technical context.
3. Wait for tracker output and honor gatekeeping_result.

# Enforcement

- If gatekeeping_result.allow_downstream=false, stop and escalate for clarification.
- If classification=existing, map work into the matched existing feature change plan.
- If classification=new-sensible, add a new feature entry in docs/features/registry.md before downstream planning.
- If classification=neither, do not produce implementation or execution plans.

# Required Recording

For every accepted request (allow_downstream=true), append a history entry to the relevant feature record with:

- date
- request summary
- classification
- confidence
- acting agent

# Quality Guardrails

- Avoid duplicate or near-duplicate feature definitions.
- Keep feature scope explicit with includes and excludes.
- Prefer merge recommendations when overlap is substantial and goals are shared.
- Prefer split recommendations when one request spans multiple domain boundaries.
