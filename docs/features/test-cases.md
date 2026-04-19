version: "1.0"
last_updated: "2026-04-13"

# MVP Classification Test Catalog

# Notes

# - Fill in expected outcomes once real feature and goal records exist.

# - Use these to calibrate confidence thresholds and overlap handling.

test_cases:

- id: "TC-001"
  name: "Clear existing feature extension"
  request: "Add acceptance criteria updates to feature already in active scope."
  expected:
  classification: "existing"
  allow_downstream: true
  minimum_confidence: 0.85

- id: "TC-002"
  name: "Clear sensible new feature"
  request: "Introduce a distinct capability aligned to project goals with no strong overlap."
  expected:
  classification: "new-sensible"
  allow_downstream: true
  minimum_confidence: 0.70

- id: "TC-003"
  name: "Overlap-heavy request"
  request: "Propose functionality that appears to duplicate an active feature scope."
  expected:
  classification: "existing"
  allow_downstream: true
  requires_merge_or_split_recommendation: true

- id: "TC-004"
  name: "Out-of-scope request"
  request: "Request capability unrelated to project goals and constraints."
  expected:
  classification: "neither"
  allow_downstream: false

- id: "TC-005"
  name: "Ambiguous request"
  request: "Vague request with insufficient boundaries and unclear dependency impact."
  expected:
  classification: "neither"
  allow_downstream: false
  requires_escalation: true
