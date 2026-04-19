# F-002 Release Checklist

## Scope

This checklist is for release readiness of Firebase all-in work tracked under F-002, with emphasis on CI parity, Firestore ruleset safety, and adapter/bootstrap stability.

## Pre-release checks

Run from repository root in the exact order below:

1. npm ci
2. npm run lint
3. npx tsc --noEmit
4. npm test
5. npm run test:firestore:rules
6. npx playwright test --reporter=line

## Expected pass criteria

- npm ci completes with no install failures and lockfile-compatible dependency graph.
- npm run lint exits 0 with no warnings promoted to errors.
- npx tsc --noEmit exits 0 with no TypeScript diagnostics.
- npm test exits 0 and reports no failed test files.
- npm run test:firestore:rules exits 0 and includes no permission-regression failures for users/{uid} paths.
- npx playwright test --reporter=line exits 0 across configured projects with no failed or flaky critical journey specs.

## Artifact capture list

Capture and attach these artifacts to PR/release evidence:

- CI run URL for the workflow execution.
- Playwright output artifacts:
  - playwright-report/
  - test-results/
  - test-output.txt (if produced in current run)
- Firestore rules test output log from npm run test:firestore:rules.
- Lint and typecheck command outputs.
- If rollback is triggered: before/after firebase.json and firestore.rules diffs.

## Rollback checklist

Use this if regressions are observed after merge or deploy.

### A) Ruleset regressions (security or access behavior)

- Freeze further production promotions.
- Re-run npm run test:firestore:rules locally (or in CI rerun) and confirm failing scenarios.
- Compare firestore.rules and firebase.json changes against last known-good commit.
- Revert only rules-related changes first, then rerun:
  1. npm run test:firestore:rules
  2. npm test
  3. npx playwright test --reporter=line
- If failure persists after rules rollback, treat as adapter/bootstrap path issue and proceed to section B.

### B) Firebase adapter/bootstrap regressions

- Verify environment assumptions (Firebase mode flags/env vars) match release expectation.
- Compare Firebase bootstrap and adapter-selection files to last known-good state.
- Revert adapter/bootstrap changes in smallest safe slice.
- Re-run minimum confidence gate:
  1. npx tsc --noEmit
  2. npm test
  3. npm run test:firestore:rules
  4. npx playwright test --reporter=line
- Promote only when all four commands return clean pass.

## Known limits and assumptions

- Timezone behavior: period/date behavior assumes repository-defined UTC/date normalization paths; local machine timezone differences can affect operator interpretation of date-only logs.
- Overlap policy: ruleset overlaps are additive with warning signaling rather than hard blocking; warning visibility is required but overlap is not automatically rejected.
- Missing-rate behavior: entries without explicit rates are preserved and surfaced as unrated in summaries; totals exclude missing-rate earnings rather than synthesizing fallback rates.
