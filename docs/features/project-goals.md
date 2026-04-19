version: "1.0"
last_updated: "2026-04-18"

project_intent:
  summary: "Track, organize, and execute project work through well-defined, non-overlapping features."

goals:

  - goal_id: "PG-004"
    name: "Canonical Feature Governance Integrity"
    priority: "must-have"
    description: "Maintain a canonical feature-metadata source with deterministic markdown projection and enforce parity checks locally and in CI."
    success_metrics:
      - "Feature governance metadata is authored in data/store/feature-metadata.json and projected into docs/features/registry.md."
      - "prepare-commit-msg and commit-msg hooks enforce/update governance artifacts before commit acceptance."
      - "CI digest parity check is configured as a hard merge blocker for governance drift."
    constraints:
      - "Owner rollout follows the approved sequence: data-management -> backend -> testing-agent."
      - "Governance automation must not bypass feature preflight gatekeeping requirements."
    anti_goals:
      - "Do not replace project feature decision logic with ad hoc manual registry edits."
      - "Do not weaken merge protections for metadata/markdown parity failures."

# Goal Template

# - goal_id: "PG-001"

# name: "Goal name"

# priority: "must-have" # must-have | important | nice-to-have

# description: "Outcome-focused description"

# success_metrics:

# - "Observable metric or acceptance statement"

# constraints:

# - "Hard constraint"

# anti_goals:

# - "What we explicitly avoid"

architectural_boundaries: []

# Boundary Template

# - boundary_id: "DB-001"

# name: "Domain boundary"

# description: "What belongs in this boundary"

# owned_feature_ids: []

# interface_contracts:

# - "Contract or API statement"

design_requirements:

  - "All planning and execution tasks must be mapped to an existing feature, a sensible new feature, or rejected as neither."
  - "Feature scope must include explicit includes/excludes to reduce overlap."
  - "Requests conflicting with project constraints should be rejected or redesigned before implementation."
