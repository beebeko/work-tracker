# Feature Registry

Current state:

```yaml
version: "1.0"
last_updated: "2026-04-18"
next_feature_sequence: 5

features:
    - feature_id: "F-001"
      name: "Freelance Hours Tracker"
      status: "active"
      owner: "data-management"
      summary: "Mobile-responsive app for tracking freelance work hours, pay rates, and calculating gross pay by venue and pay period."
      classification: "new-sensible"
      confidence: 0.95
      scope:
          includes:
              - "Entry form: venue, date worked, start time, end time, position, rate (optional), event (optional), tags, notes"
              - "Organization create-on-miss flow from manual organization entry in entry form, with prefilled new-organization modal and auto-select after save"
              - "Organization modal management for positions/venues, timezone, pay period start, workweek start, and markdown notes"
              - "Pay period definitions per organization (fixed or custom override)"
              - "Gross pay calculation for organization and period"
              - "Mobile-responsive dual-mode UI (mobile-first responsive)"
              - "Local-only data persistence (localStorage/JSON)"
              - "Entry history and filtering by organization, date range, tags"
          excludes:
              - "Multi-device sync or backend server"
              - "Authentication or multi-user support"
              - "Export to accounting systems"
              - "Tax calculations or deductions"
      goal_alignments: []
      dependencies: []
      conflicts_with: []
      change_plan:
          - action: "create-feature"
            description: "Scaffold freelance hours tracker app with data layer, business logic, UI, and tests"
            steps:
                - "Data management: design schema for entries (with tag history), organizations (with configurable payPeriodStartDay), rate lookups; create JSON adapter and DAL"
                - "Backend: implement pay-period logic (configurable per org), gross-pay calculation (handles optional rates), tag-learning mechanism"
                - "React UI: build responsive entry form with autocomplete for venue/position/org, tag input that learns, history view, pay summary"
                - "Testing: unit tests for calculations, integration tests for entry flow with autocomplete, E2E for full workflow"
                - "Iterate on UX based on feedback"
            decision_log:
                - "Entry form uses autocomplete (venue, position, org) with free-text fallback"
                - "Tags are learned from user input (no pre-shipped defaults)"
                - "Rates are manual per entry (no venue defaults)"
                - "Pay period start day is configurable per organization"
                - "Autocomplete is case-insensitive (normalizes to stored case)"
                - "Tag/position/venue history kept forever (no pruning)"
                - "Gross pay includes zero-value entries without rates and flags them separately"
                - "Calculate cumulative gross pay across all organizations for a period"
                - "App launches with entry form auto-open"
                - "Tags displayed as removable pills in entry form"
                - "Tests mock localStorage for speed and isolation"
                - "E2E tests have no hard timeout (accuracy prioritized)"
            dependency_updates: []
            risks:
                - "Mobile UX complexity if entry form has too many fields"
                - "Pay period override logic may be fragile if not tested thoroughly"
                - "Tag learning mechanism could accumulate junk if not managed"
      validation_owner: "product"
      history:
          - date: "2026-04-14"
            request_summary: "Kickoff and core build-out of F-001 (tracker scaffold, DAL contracts/adapters, backend pay logic, React UI shell, and initial test harness wiring)."
            outcome_summary: "Delivered foundational feature implementation end-to-end, including local JSON persistence, organization/create-on-miss support baseline, gross-pay calculations, and first full testable app surface."
            classification: "new-sensible + existing"
            confidence: "0.95-0.99"
            acting_agents: "orchestrator, data-management, backend, react-ui, testing-agent, feature-tracker"

          - date: "2026-04-14 to 2026-04-16"
            request_summary: "Ruleset enhancement wave (policy/planning, deterministic evaluation behavior, data/domain implementation, and staged UI/E2E verification plus readiness triage)."
            outcome_summary: "Established effective-dated ruleset architecture, additive overlap/warning behavior, midnight split handling, ruleset-driven pay-summary behavior, and stabilized cross-browser ruleset journeys while separating Firebase scope to F-002."
            classification: "existing"
            confidence: "0.97-0.99"
            acting_agents: "data-management, backend, react-ui, testing-agent, feature-tracker, orchestrator"

          - date: "2026-04-15"
            request_summary: "Repository testing/tooling consolidation after drift (Jest-to-Vitest migration, warning cleanup, selector hardening, and rerun stabilization)."
            outcome_summary: "Converged on a single Vitest baseline, removed major warning noise, recovered failing suites, and improved deterministic Playwright execution reliability."
            classification: "existing"
            confidence: "0.97-0.99"
            acting_agents: "testing-agent"

          - date: "2026-04-17"
            request_summary: "Organization modal and entry-flow UX hardening (notes/edit UX, pay-mode layout corrections, cancel-edit behavior, createOrganization modal saving/error/timeouts)."
            outcome_summary: "Resolved user-visible edit/save friction, restored stable save lifecycle behavior, and confirmed recovery paths with focused Vitest/Playwright validation."
            classification: "existing"
            confidence: "0.97-0.99"
            acting_agents: "react-ui, testing-agent, data-management, feature-tracker, orchestrator"

          - date: "2026-04-17"
            request_summary: "Flat-fee compensation and employer analytics expansion (data/backend/UI + testing)."
            outcome_summary: "Added hourly/flat-fee mode support with validation and mixed-mode aggregation, plus pay-summary employer chart metric toggle and targeted regression coverage."
            classification: "existing"
            confidence: "0.96-0.99"
            acting_agents: "data-management, backend, react-ui, testing-agent"

          - date: "2026-04-18"
            request_summary: "Large refactor/polish and release-gate recovery sweep (EntryForm decomposition, organization/ruleset panel UX parity, responsive combobox behavior, stale rehydrate fixes, and Playwright contract updates)."
            outcome_summary: "Stabilized post-hydrate/org-filter behavior, restored failing ruleset/edit flows, fixed stale snapshot reads, aligned mobile/desktop interactions, and re-established green targeted and full regression signals."
            classification: "existing"
            confidence: "0.72-0.99"
            acting_agents: "react-ui, testing-agent, data-management, backend"

          - date: "2026-04-19"
            request_summary: "F-001 release/governance checkpoint plus recorded cross-feature governance automation work (F-004)."
            outcome_summary: "Completed v1.0.0 source-control cut governance for Work Tracker and recorded feature-governance automation implementation linkage in history."
            classification: "existing + new-sensible"
            confidence: "0.96-0.99"
            acting_agents: "backend"

          - date: "2026-04-20"
            request_summary: "Shared-rulesets completion phase across data/backend/UI/testing, including global catalog/list-all contracts, assignment-state surfaces, org add/edit integration, and broad regression coverage."
            outcome_summary: "Implemented global shared-rulesets management and assignment flows, preserved org-scoped compatibility, and validated with focused and full-matrix runs (including 355/355 Vitest and 116/116 Playwright baseline confirmation in merge-readiness sweep)."
            classification: "existing"
            confidence: "0.97-0.99"
            acting_agents: "data-management, backend, react-ui, testing-agent"

          - date: "2026-04-21"
            request_summary: "F-001 closeout audit and final verification for add-organization and shared-rulesets behavior prior to merge readiness."
            outcome_summary: "Applied minimal modal-scoped error presentation cleanup, revalidated request-scoped and cross-browser paths, and confirmed closeout status with no new blocking defects."
            classification: "existing"
            confidence: "0.97-0.99"
            acting_agents: "react-ui, testing-agent"

          - date: "2026-04-21"
            request_summary: "Accepted user approval to proceed with the F-001 closeout recommendation for local commit creation, and mapped governance linkage for downstream parity tracking."
            classification: "existing"
            confidence: 0.94
            acting_agents: "data-management"

    - feature_id: "F-002"
      name: "Firebase All-In v1"
      status: "planned"
      owner: "unassigned"
      summary: "Introduce Firebase-backed hosting, persistence, authentication, and sync foundations for the tracker while preserving a focused v1 scope."
      classification: "new-sensible"
      confidence: 0.91
      scope:
          includes:
              - "Firebase Hosting deployment for the app"
              - "Firestore as the primary persisted data store"
              - "Anonymous authentication for app access"
              - "Offline persistence for Firestore-backed usage"
              - "One-time local migration from existing local-only data"
              - "Basic sync status UX (e.g., pending/synced/offline indicators)"
          excludes:
              - "Named accounts"
              - "Multi-user collaboration"
              - "Cloud Functions"
              - "Analytics"
      goal_alignments: []
      dependencies:
          - feature_id: "F-001"
            relationship: "enhances"
      conflicts_with: []
      change_plan:
          - action: "create-feature"
            description: "Deliver Firebase all-in v1 baseline for hosting, auth, data sync, and migration"
            dependency_updates:
                - "Introduce Firebase project/environment configuration and deployment workflow"
                - "Add Firestore-backed data adapter and migration path from local-only records"
            risks:
                - "Data migration correctness and idempotency across diverse existing local datasets"
                - "Offline/online reconciliation edge cases may surface inconsistent sync indicators"
            validation_owner: "product"
      history:
          - date: "2026-04-18"
            request_summary: "Assess implementing a favicon from the provided bee PNG, with the bee rendered white, and identify any blocking ambiguity before UI execution."
            classification: "existing"
            confidence: 0.94
            acting_agent: "react-ui"
            notes: "Assessment concluded implementation is blocked pending access to the actual source PNG or attachment asset; recommended output is a simplified favicon set led by favicon.svg plus ICO/PNG fallbacks, likely with a dark circular background for contrast."
          - date: "2026-04-18"
            request_summary: "Controlled production write-path validation on https://work-tracker-98f72.web.app using a disposable TEST organization marker; verified minimal create/update/delete flow and confirmed cleanup absence after reload."
            classification: "existing"
            confidence: 0.97
            acting_agent: "testing-agent"
          - date: "2026-04-15"
            request_summary: "Track Firebase all-in v1 as a separate feature with explicit includes/excludes and migration/sync baseline"
            classification: "new-sensible"
            confidence: 0.91
            acting_agent: "feature-tracker"
          - date: "2026-04-15"
            request_summary: "Implement phase-1 backend plumbing for F-002: Firebase env config/bootstrap and anonymous-auth readiness primitives"
            classification: "existing"
            confidence: 0.98
            acting_agent: "backend"
          - date: "2026-04-15"
            request_summary: "Implement F-002 Firestore DAL adapter slice with env-based selection and JSON default fallback"
            classification: "existing"
            confidence: 0.98
            acting_agent: "data-management"
          - date: "2026-04-15"
            request_summary: "Implement F-002 react-ui slice: Firebase startup gate with anonymous-auth bootstrap/retry and compact sync status indicators"
            classification: "existing"
            confidence: 0.96
            acting_agent: "react-ui"
          - date: "2026-04-15"
            request_summary: "Focused F-002 testing pass after Firebase all-in backend/data-management/react-ui updates"
            classification: "existing"
            confidence: 0.99
            test_scope:
                - "Unit/integration execution for Firebase config/auth bootstrap, app startup gate + sync-status resolver, adapter selection, and Firebase/json transaction rollback behavior"
                - "Added adapter-selection failure-path assertion for actionable data-layer initialization bootstrap errors"
            coverage_impact: "Expanded F-002 failure-mode coverage in data/index adapter bootstrap path while keeping all targeted Firebase startup and data-layer tests green."
            acting_agent: "testing-agent"
          - date: "2026-04-16"
            request_summary: "Implement F-002 emulator/deploy configuration baseline: firebase.json, .firebaserc, env-file dev adapter default, scripts, and operator docs"
            classification: "existing"
            confidence: 0.98
            acting_agent: "backend"
            notes: "Added local emulator + hosting deploy CLI config only; no migration implementation or Cloud Functions scope added."
          - date: "2026-04-16"
            request_summary: "Implement F-002 migration phase: one-time local JSON/localStorage import into Firestore with uid-scoped sentinel and initialize-path trigger"
            classification: "existing"
            confidence: 0.98
            acting_agent: "data-management"
            notes: "Added FirebaseDataLayer initialize migration from localStorage keys used by JsonDataLayer, schema-validated payload handling, idempotent sentinel version marker, and focused unit coverage for success/no-op/malformed/write-failure paths."
          - date: "2026-04-16"
            request_summary: "Implement F-002 transaction hardening phase after migration with staged Firestore batch commits and explicit unsupported flow errors"
            classification: "existing"
            confidence: 0.98
            acting_agent: "data-management"
            notes: "Replaced best-effort Firebase transaction semantics with staged write buffering + single batch commit, made rollback non-advisory for covered operations, and added focused tests for atomic grouped writes, rollback non-persistence, commit-failure non-partial guarantees, and unsupported transactional query boundaries."
          - date: "2026-04-16"
            request_summary: "Implement F-002 E2E startup/reconnect coverage after migration and transaction hardening"
            classification: "existing"
            confidence: 0.98
            test_scope:
                - "Playwright startup success path in Firebase-mode UI with deterministic bootstrap override"
                - "Playwright startup failure path asserting visible bootstrap error plus retry recovery (no silent failure)"
                - "Playwright offline-to-online transition assertions for sync status readiness cues"
            coverage_impact: "Expanded F-002 E2E coverage to include startup gate success/failure and reconnect status behavior with low-flake deterministic overrides in the current harness."
            acting_agent: "testing-agent"
            notes: "Current harness runs with JSON data adapter by default for stability; deterministic startup overrides approximate Firebase bootstrap outcomes without requiring emulator availability in CI. Full emulator-backed validation remains available as an operator-run follow-up."
          - date: "2026-04-16"
            request_summary: "F-002 follow-up: lock Firestore location decision to NAM5 in operator guidance, add production bootstrap checklist, and add optional Node 20/Firebase emulator verification helper scripts"
            classification: "existing"
            confidence: 0.99
            acting_agent: "backend"
            notes: "Documentation now explicitly fixes production Firestore location to NAM5 and calls out immutability; added a concise production checklist and non-destructive npm scripts for Node/Firebase prereq checks and emulator smoke verification."
          - date: "2026-04-16"
            request_summary: "F-002 ops fix: move Hosting emulator default port from 5000 to 5002 to avoid local port collisions and align operator docs"
            classification: "existing"
            confidence: 0.99
            acting_agent: "backend"
            notes: "Updated firebase.json hosting emulator port and Firebase emulator workflow docs; no product runtime behavior changes."
          - date: "2026-04-16"
            request_summary: "Final verification orchestration after NAM5 lock; fixed hosting emulator port conflict and ran prereq+smoke+firebase-mode E2E checks"
            classification: "existing"
            confidence: 0.98
            acting_agent: "orchestrator"
            notes: "Key outcomes: Hosting emulator moved to 5002, prereqs pass on Node v24.15.0 and firebase-tools 15.15.0, emulator smoke passed with firestore rules warning, firebase-mode Playwright subset 6/6 passed."
          - date: "2026-04-16"
            request_summary: "F-002 ops fix: add explicit Firestore rules file wiring to remove missing-rules emulator warning"
            classification: "existing"
            confidence: 0.99
            acting_agent: "backend"
            notes: "Added firestore.rules with authenticated users/{uid} scoping and deny-by-default fallback; wired firebase.json firestore.rules; firebase:verify:emulator:smoke passed and startup no longer reported missing Firestore rules warning."
          - date: "2026-04-16"
            request_summary: "F-002 strict readiness pass: fix Firebase adapter compile-time typing faults in migrated StoredEntry mapping and Firestore transactional doc reference construction"
            classification: "existing"
            confidence: 0.98
            acting_agent: "data-management"
            notes: "No schema changes. No transaction boundary changes. Kept runtime behavior intact while making migration coercion explicit for required StoredEntry fields and using canonical Firestore doc(db, path) construction during staged batch commit."
          - date: "2026-04-16"
            request_summary: "Focused F-002 emulator rules guardrail testing for uid-scoped access and deny-by-default fallback"
            classification: "existing"
            confidence: 0.99
            test_scope:
                - "Firestore rules emulator test for authenticated same-uid access under users/{uid}/..."
                - "Firestore rules emulator test for denied cross-user and non-users path access"
            coverage_impact: "Added deterministic emulator-backed security-rule regression coverage for core F-002 Firestore guardrails with isolated execution command."
            acting_agent: "testing-agent"
          - date: "2026-04-16"
            request_summary: "Minimal F-002 rules-test enhancement adding unauthenticated denial assertion for users/{uid}/... path"
            classification: "existing"
            confidence: 0.99
            acting_agent: "testing-agent"
            coverage_impact: "Extended firestore.rules emulator guardrail coverage to explicitly assert unauthenticated reads are denied on protected users/{uid}/... paths."
          - date: "2026-04-17"
            request_summary: "Add baseline CI workflow and release checklist artifacts for PR readiness, including lint/type/test/e2e/firestore-rules execution and artifact capture guidance"
            classification: "existing"
            confidence: 0.98
            acting_agent: "backend"
          - date: "2026-04-17"
            request_summary: "Fix persistent Loading.../SYNCING indicators that never resolve on startup due to missing emulator connection code and unbounded async startup"
            classification: "existing"
            confidence: 0.97
            acting_agent: "orchestrator"
            notes: "Root causes: (1) Firebase SDK never connected to local emulators — app always hit production Firebase regardless of emulator state; no connectAuthEmulator/connectFirestoreEmulator calls existed. Fixed by adding VITE_USE_FIREBASE_EMULATOR env var and emulator hookup in client.ts, defaulting to true in .env.development. (2) No timeout guards on signInAnonymously or Firestore scope resolution — a hung promise kept store.loading=true indefinitely. Fixed by adding withTimeout helper (10s) wrapping signInAnonymously in authBootstrap.ts and ensureAnonymousUser in firebase.adapter.ts. (3) bootstrapError: null hardcoded in FreelanceTrackerApp — store errors never surfaced to sync badge. Fixed by passing store.error as bootstrapError, and added a Retry button when syncStatus is bootstrap-error."
          - date: "2026-04-18"
            request_summary: "Fix phone-view tab label overflow: 'Organization' overflows and 'Pay Summary > Summary' is near overflow on narrow viewports; adjust tab gap/padding so all labels are centered and contained without truncation."
            classification: "existing"
            confidence: 0.98
            acting_agent: "react-ui"
            notes: "Root cause: 4-column equal-width grid with gap:8px, container padding:8px, and tab horizontal padding:12px left only ~58px of text width on a 375px phone — too narrow for the 12-char 'Organization' word. Fix: added @media (max-width:1023px) block in FreelanceTrackerApp.css reducing container padding to 6px, gap to 4px, and tab horizontal padding to 4px (text area ~78px on 375px). Added overflow-wrap:break-word and word-break:break-word as last-resort guard on <=320px devices. text-align:center explicit on phone tabs. Desktop tab styles unaffected (tabs hidden at >=1024px). CSS-only change, no logic/state modifications."
          - date: "2026-04-18"
            request_summary: "Non-destructive post-deploy production smoke verification for https://work-tracker-98f72.web.app covering startup/shell render, bootstrap/auth readiness cues, core panel navigation, and read-only filter/selector interaction sanity."
            classification: "existing"
            confidence: 0.99
            acting_agent: "testing-agent"
            test_scope:
                - "Production smoke checks on Chromium, Firefox, and WebKit against deployed Hosting URL"
                - "Read-only interactions only: panel navigation and filter/selector open/toggle sanity with no create/update/delete writes"
            coverage_impact: "No product-code changes; added live post-deploy confidence evidence for F-002 startup/readiness/navigation surfaces across three browser engines."
          - date: "2026-04-19"
            request_summary: "Execute strict F-002 pre-release readiness gate command sequence (npm ci, lint, typecheck, vitest, firestore-rules, playwright) and classify deploy readiness."
            classification: "existing"
            confidence: 0.99
            acting_agent: "testing-agent"
            notes: "Gate result is No-Go for immediate deploy: npm ci/lint/tsc/vitest/playwright all passed, but firestore rules gate failed (exit 1) because Firestore emulator could not bind to port 8080 (port already in use)."
          - date: "2026-04-19"
            request_summary: "Approved follow-up: clear Firestore emulator port conflict and rerun the full F-002 six-step pre-release gate for final deployment readiness."
            classification: "existing"
            confidence: 0.99
            acting_agent: "feature-tracker"
            notes: "Port scan confirmed no active Firestore emulator bind conflict on 8080 (hosting remains on 5002; macOS Control Center on 5000 is non-impacting). Full six-step gate passed: npm ci, lint, tsc --noEmit, vitest, firestore rules emulator tests, and Playwright (48/48)."
          - date: "2026-04-19"
            request_summary: "Fresh F-002 release-readiness rerun executed in strict checklist order with explicit exit-code capture and safe emulator-port preflight (8080/9099/5002)."
            classification: "existing"
            confidence: 0.99
            acting_agent: "testing-agent"
            notes: "Safe port audit found no listeners on 8080/9099/5002 and required no termination actions. Gate commands all exited 0 (npm ci, npm run lint, npx tsc --noEmit, npm test, npm run test:firestore:rules, npx playwright test --reporter=line). Final F-002 release readiness verdict: Go."
          - date: "2026-04-19"
            request_summary: "Quick post-deploy production smoke check on https://work-tracker-98f72.web.app for startup/readiness/navigation/filter interactions using read-only E2E paths."
            classification: "existing"
            confidence: 0.98
            acting_agent: "testing-agent"
            notes: "Production host responded HTTP 200. Read-only smoke slice passed on desktop-chromium (15/15) for startup/sync/navigation/selector interactions. Firefox/WebKit cross-engine smoke not executed in this quick pass due local Playwright project config exposing desktop-chromium/mobile-chromium only."

    - feature_id: "F-003"
      name: "Invoice PDF Generation v2"
      status: "planned"
      owner: "unassigned"
      summary: "Planned v2 roadmap slice for selecting one or more tracked entries, previewing invoice line items, and generating a PDF invoice document."
      classification: "new-sensible"
      confidence: 0.89
      scope:
          includes:
              - "Invoice workflow to select a single tracked entry"
              - "Invoice workflow to select multiple tracked entries"
              - "Preview invoice line items before export"
              - "Generate PDF invoice output from selected entries"
          excludes:
              - "Accounting-system integrations"
              - "Payment collection"
              - "Tax filing automation"
      goal_alignments: []
      dependencies:
          - feature_id: "F-001"
            relationship: "requires"
      conflicts_with: []
      change_plan:
          - action: "create-feature"
            description: "Plan and deliver a v2 invoice-document workflow built on existing entry/history data"
            steps:
                - "Define invoice selection UX for single-entry and multi-entry flows using F-001 entry/history data"
                - "Define invoice preview structure and line-item mapping rules"
                - "Define PDF generation/export behavior and acceptance criteria for v2"
            dependency_updates:
                - "Consume F-001 entry/history records as the source data for invoice line items"
            risks:
                - "Invoice formatting expectations may require iteration across varied real-world billing styles"
                - "Large multi-entry selections may impact PDF rendering performance and readability"
            validation_owner: "product"
      history:
          - date: "2026-04-18"
            request_summary: "Track a v2-only feature for selecting single/multiple entries and generating a PDF invoice with a line-item preview workflow."
            classification: "new-sensible"
            confidence: 0.89
            acting_agent: "feature-tracker"

    - feature_id: "F-004"
      name: "Feature Governance Automation"
      status: "planned"
      owner: "data-management"
      summary: "Automate feature-registry governance with a canonical metadata source and enforced parity between generated markdown and tracked metadata."
      classification: "new-sensible"
      confidence: 0.96
      scope:
          includes:
              - "Canonical metadata source at data/store/feature-metadata.json"
              - "Deterministic markdown projection into docs/features/registry.md"
              - "Dual commit hooks: prepare-commit-msg and commit-msg"
              - "CI digest-parity validation as a hard merge blocker"
              - "Phased owner sequence: data-management -> backend -> testing-agent"
          excludes:
              - "Changing feature classification policy semantics"
              - "Bypassing preflight gatekeeping rules"
      goal_alignments:
          - goal_id: "PG-004"
            alignment: "direct"
            rationale: "Enforces governance integrity for feature tracking via canonical-source and parity checks."
      dependencies:
          - feature_id: "F-001"
            relationship: "enhances"
      conflicts_with: []
      change_plan:
          - action: "create-feature"
            description: "Implement governance automation pipeline for canonical metadata and projection parity enforcement"
            steps:
                - "Define and validate canonical feature metadata schema in data/store/feature-metadata.json"
                - "Implement deterministic markdown projection to docs/features/registry.md"
                - "Add prepare-commit-msg hook to stage/update governance metadata artifacts"
                - "Add commit-msg hook to verify metadata/markdown digest parity before accepting commit"
                - "Add CI parity check as hard merge blocker for pull requests"
                - "Execute phased ownership rollout: data-management then backend then testing-agent"
            dependency_updates:
                - "Introduce canonical metadata source ownership under data-management"
                - "Introduce hook/CI enforcement ownership under backend"
                - "Introduce parity validation coverage ownership under testing-agent"
            risks:
                - "Hook ergonomics could create local friction if failure messages are not actionable"
                - "Projection drift risk if schema and markdown template evolve without synchronized updates"
            validation_owner: "testing-agent"
      history:
          - date: "2026-04-21"
            request_summary: "Accepted secondary governance linkage for the approved F-001 local commit creation step, recording F-004 traceability for parity-enforced closeout handling."
            classification: "existing"
            confidence: 0.94
            acting_agent: "data-management"

          - date: "2026-04-19"
            request_summary: "Governance-enforced v1.0.0 source-control release cut with F-004 hook/governance workflow applied to commit and tag creation."
            classification: "existing"
            confidence: 0.99
            acting_agent: "backend"
            notes: "Recorded governance-backed v1 release execution (validation, curated commit, annotated tag)."
          - date: "2026-04-18"
            request_summary: "Accepted canonical history schema and approved implementation of governance automation with canonical metadata source, markdown projection, dual hooks, and CI digest-parity merge blocking."
            classification: "new-sensible"
            confidence: 0.96
            acting_agent: "feature-tracker"
            notes: "Owner sequence approved as data-management -> backend -> testing-agent."
          - date: "2026-04-19"
            request_summary: "hook syntax repair and local enforcement restoration"
            classification: "existing"
            confidence: 0.99
            acting_agent: "backend"
            notes: "Removed trailing broken fragments in prepare-commit-msg and commit-msg hooks so Node syntax checks and local F-004 hook verification run successfully while preserving governance-template injection and Source-Digest parity intent."
          - date: "2026-04-19"
            request_summary: "Operational validation of real F-004 commit-hook pass/fail paths in a freshly initialized local repository."
            classification: "existing"
            confidence: 0.99
            acting_agent: "backend"
            notes: "PASS: committed .hook-real-test.txt with a normal message and verified prepare-commit-msg injection plus digest in git log body. FAIL: attempted empty governance commit with intentionally wrong Source-Digest and confirmed commit-msg rejection (exit=1) with INVALID_COMMIT_MESSAGE diagnostic JSON."
          - date: "2026-04-18"
            request_summary: "Completed F-004 data-management phase by adding canonical feature metadata schema/store artifacts, src governance contracts and DAL read interface, and a dry-run migration scaffold with validation reporting."
            classification: "existing"
            confidence: 0.95
            acting_agent: "data-management"
            notes: "Markdown registry remains projection-only in this phase; backend hook/CI automation intentionally deferred."
          - date: "2026-04-19"
            request_summary: "Audit and harden repository gitignore coverage and capture a single-command git smoke snapshot for F-004 operational hygiene."
            classification: "existing"
            confidence: 0.98
            acting_agent: "backend"
            notes: "Expanded .gitignore with minimal Node/Vite/test/log/system/editor noise patterns while leaving tracked artifacts unaffected, then captured one-shot smoke output for hooks path, branch, and concise status."
```

Feature record template:

```yaml
- feature_id: "F-001"
  name: "Feature name"
  status: "planned" # planned | active | on-hold | deprecated
  owner: "unassigned"
  summary: "One-paragraph summary"
  classification: "new-sensible" # existing | new-sensible | neither
  confidence: 0.00
  scope:
      includes:
          - "specific capability included in this feature"
      excludes:
          - "explicitly out of scope"
  goal_alignments:
      - goal_id: "PG-001"
        alignment: "direct" # direct | supporting | tangential
        rationale: "How this feature supports the goal"
  dependencies:
      - feature_id: "F-000"
        relationship: "requires" # requires | enhances | conflicts
  conflicts_with:
      - feature_id: "F-000"
        conflict_type: "scope_overlap" # scope_overlap | technical_conflict
        severity: "medium" # low | medium | high
        resolution: "merge-candidate"
  change_plan:
      - action: "create-feature" # map-to-existing | create-feature | merge-candidate | split-candidate | defer
        description: "Concrete change"
        dependency_updates: []
        risks:
            - "Potential risk"
        validation_owner: "product"
  history:
      - date: "2026-04-13"
        request_summary: "Short request summary"
        classification: "new-sensible"
        confidence: 0.86
        acting_agent: "feature-tracker"
        notes: "Optional implementation notes"
```
