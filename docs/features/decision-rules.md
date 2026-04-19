version: "1.0"
last_updated: "2026-04-13"
mode: "gatekeeping"

thresholds:
auto_accept_confidence: 0.85
review_band_min: 0.70
review_band_max: 0.84
hard_block_below: 0.70
overlap_merge_candidate_jaccard: 0.65
overlap_investigate_jaccard: 0.40
semantic_candidate_min: 0.78

heuristics:
semantic_similarity:
description: "How similar the request is to existing feature summaries and scopes"
score_range: "0.00-1.00"
scope_overlap_jaccard:
description: "Jaccard overlap over includes/excludes"
score_range: "0.00-1.00"
dependency_consistency:
description: "Whether requested dependencies align with established feature dependencies"
values: ["aligned", "partial", "conflicting"]
goal_alignment:
description: "Whether request aligns with project goals and design requirements"
values: ["direct", "supporting", "none", "conflicting"]

decision_logic:

- rule: "Classify as existing"
  when:
    - "confidence >= auto_accept_confidence"
    - "at least one candidate feature present"
    - "goal_alignment is direct or supporting"
    - "dependency_consistency is not conflicting"
      output:
      classification: "existing"
      allow_downstream: true

- rule: "Classify as new-sensible"
  when:
    - "no candidate exceeds semantic_candidate_min OR overlap not substantial"
    - "goal_alignment is direct or supporting"
    - "request does not violate design requirements"
    - "confidence >= review_band_min"
      output:
      classification: "new-sensible"
      allow_downstream: true

- rule: "Classify as neither"
  when:
    - "goal_alignment is none or conflicting"
    - "dependency_consistency is conflicting and unresolved"
    - "confidence < hard_block_below"
    - "request contradicts explicit constraints or anti_goals"
      output:
      classification: "neither"
      allow_downstream: false

merge_split_guidance:
merge_candidate_if: - "scope_overlap_jaccard >= overlap_merge_candidate_jaccard" - "goals are shared or strongly related"
split_candidate_if: - "request spans multiple architectural boundaries" - "separable ownership or release cadence is detected"

required_escalation:

- "Any review-band case with unresolved conflicts"
- "Any neither classification"
- "Any request with missing project goal context"
