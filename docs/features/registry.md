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
                    - date: "2026-04-19"
                        request_summary: "Accepted source-control v1 release cut request (commit+tag) for Work Tracker with release validation, artifact curation, and v1.0.0 versioning."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "backend"
                        notes: "Completed release curation and governance recording for v1 source-control cut request."
                    - date: "2026-04-19"
                        request_summary: "F-004 backend phase 2: Implement feature governance automation with deterministic semver engine, commit template generator with source digest embedding, parity checker, CLI routing pipeline, and git hooks scaffolding. Add CI metadata-parity-gate as hard merge blocker."
                        classification: "new-sensible"
                        confidence: 0.96
                        acting_agent: "backend"
                        notes: "Implemented SemverEngine (deterministic version derivation), TemplateGenerator (source digest embedding), ParityChecker (consistency validation), RunRoutingPipeline (orchestration), CLI entry point, hook shims, package scripts (f004:generate, f004:parity, f004:verify, f004:hooks:install, f004:hooks:verify), and CI metadata-parity-gate job. Full hook and testing integration deferred to testing-agent phase 3."
                    - date: "2026-04-18"
                        request_summary: "Release-gate cleanup: reconcile remaining full-Vitest failures in EntryHistory and History/Summary isolation tests after all-org unchecked-default filter stabilization."
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "testing-agent"
                        test_scope:
                                - "Integration: updated EntryHistory integration interactions to explicitly enable organization filtering before row-level edit/delete/tag assertions"
                                - "Integration: updated History/Summary isolation integration contract to assert unchecked all-org defaults and panel-local filter toggles"
                        coverage_impact: "No net-new test files; repaired six failing integration assertions to match stabilized UI/data contracts and restored targeted pass signal (9/9)."
                        notes: "Classified both failures as test-contract drift rather than product regression."
                    - date: "2026-04-18"
                        request_summary: "Repair PaySummary regression after post-hydrate checkbox-default stabilization by realigning integration expectations with unchecked-by-default all-org behavior and revalidating cross-browser filter-isolation E2E coverage."
                        classification: "existing"
                        confidence: 0.96
                        acting_agent: "react-ui"
                        notes: "Updated PaySummary integration tests to assert all-org aggregation call patterns and require explicit filter toggle before org-specific selection; validated targeted Vitest (25/25) plus focused Playwright cross-browser slice (3/3) covering post-reload unchecked-default filter isolation."
                    - date: "2026-04-18"
                        request_summary: "React-UI deploy-gate pass for remaining F-001 blockers: stabilized post-hydrate history/summary organization filter default state and validated EntryForm position-save and RulesetEditor save/edit/delete flows across cross-browser Playwright targets."
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "react-ui"
                        notes: "Added mount-time controlled checkbox synchronization in EntryHistory and PaySummary to prevent unintended checked defaults after reload/hydrate; validated with focused Vitest component runs and cross-browser Playwright reruns using a fresh preview build."
                    - date: "2026-04-18"
                        request_summary: "Investigate and remediate the remaining seeded multi-organization reload inconsistency affecting F-001 summary rehydration before deploy."
                        classification: "existing"
                        confidence: 0.97
                        acting_agent: "data-management"
                        notes: "Confirmed the JSON adapter was persisting writes but entry/organization reads could still serve a stale in-memory snapshot after localStorage reseeding. Updated those reads to rehydrate from persisted storage before serving results and added a regression test for reseeded multi-organization reload behavior."
                    - date: "2026-04-18"
                        request_summary: "Release-gate recovery pass for F-001 before production deploy: reproduced the failing Playwright buckets, repaired StrictMode-sensitive startup E2E setup, hardened responsive tab/navigation selectors, and validated a store-level fix attempt for position catalog saves while targeted browser regressions remained."
                        classification: "existing"
                        confidence: 0.72
                        acting_agent: "testing-agent"
                        test_scope:
                                - "Unit: added store coverage for createOrganizationPosition updating the organization catalog directly"
                                - "Integration: relied on existing nearby FreelanceTrackerApp and EntryForm integration coverage while validating no new TS/diagnostic regressions from the store/test harness edits"
                                - "E2E: reran focused Playwright slices for entry/finance, startup/bootstrap, organization filter isolation, combo-box selection, and ruleset authoring flows"
                        coverage_impact: "Improved regression coverage around startup override handling and store-level position catalog updates, but browser-level confidence is still blocked by unresolved E2E failures in position save, ruleset save, and multi-organization seeded-data flows."
                        notes: "Targeted reruns proved the StrictMode bootstrap contract issue is fixed. Remaining failures point to deeper app/runtime issues rather than only stale Playwright selectors or timing assumptions."
                    - date: "2026-04-18"
                        request_summary: "Fix F-001 regression where organization/venue/position combo-box behavior could disappear after entry-layout changes in single-column mode."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                        notes: "Hardened EntryForm media-query listener compatibility by supporting both addEventListener and addListener paths, added a focused legacy-listener layout-change regression test, and revalidated targeted unit/integration and cross-browser Playwright coverage."
                    - date: "2026-04-18"
                        request_summary: "Generate PNG and ICO favicon fallbacks from the accepted bee.svg mark and wire the root HTML to prefer SVG with sensible legacy fallbacks."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                        notes: "Generated root-level favicon.png and favicon.ico fallbacks from bee.svg, kept the SVG as the primary modern favicon, updated index.html link ordering/types for modern and older browsers, and validated the generated assets plus app-shell HTML."
                    - date: "2026-04-18"
                        request_summary: "Align EntryForm organization, venue, and position combo-box activation with the existing single-column layout breakpoint instead of device-specific iPhone gating."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                        notes: "Switched combo-box mode from phone-specific naming to the same 480px breakpoint that flips EntryForm rows from stacked to side-by-side, updated focused Vitest coverage plus narrow cross-browser Playwright validation, and preserved all other combobox behavior."
                    - date: "2026-04-18"
                        request_summary: "Convert the root bee.png asset into a centered SVG bee mark with white artwork on a black circle and wire the app shell to use the SVG consistently."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                        notes: "Confirmed bee.png at repo root, replaced bee.svg with a centered white-on-black favicon composition, updated both root favicon links to the SVG so the old PNG is not used as a fallback, and performed local file validation."
                    - date: "2026-04-18"
                        request_summary: "Turn organization, venue, and position inputs into editable combo boxes in the iPhone layout so phone users can tap existing values or type new ones without changing desktop behavior."
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "react-ui"
                        notes: "Scoped the combo-box affordance to the phone-width EntryForm layout, preserved free-text create-on-miss semantics, added focused component/integration coverage, and added a narrow cross-browser Playwright check for the tapped-selection flow."
                    - date: "2026-04-18"
                        request_summary: "Decompose EntryHistory and RulesetEditor: extracted EntryHistoryRow subcomponent; extracted RulesetEditor.types, RulesetEditor.utils, OTRuleFields, NonOTRuleRow, RulesetCard. Eliminated React act() warnings in EntryHistory.test.tsx and PaySummary.test.tsx via findBy/waitFor patterns. Normalized docs/features/registry.md YAML field names."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui + testing-agent"
                        notes: "All 328 tests pass with zero stderr act warnings. TypeScript clean. 24/24 cross-browser E2E critical journeys green."
                    - date: "2026-04-18"
                        request_summary: "Final cleanup pass after recent refactor slices: removed TS compilerOptions.baseUrl deprecation source, confirmed no obvious dead source imports/code remained, and revalidated baseline typecheck plus test suite."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "backend"
                        notes: "Documentation and verification closeout for the decomposition wave; generated artifacts left untouched."
                    - date: "2026-04-18"
                        request_summary: "Testing-focused refactor slice after EntryForm decomposition and data-contract updates: repaired failing EntryHistory/PaySummary/DAL tests, added EntryForm utility unit coverage, and revalidated layered confidence."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "testing-agent"
                        test_scope:
                                - "Unit: added EntryForm.utils coverage for duration math, normalization/matching, initial/default value derivation, and error messaging fallback behavior"
                                - "Integration: aligned EntryHistory and PaySummary integration tests with current filter and selector contracts"
                                - "E2E: reran cross-browser targeted Playwright slice for critical entry flows on Chromium/Firefox/WebKit"
                        coverage_impact: "Restored failing baseline to green for targeted integration/data files and expanded unit confidence on extracted EntryForm helpers with behavior-first assertions."
                        notes: "This slice avoids mock-call-count-only proof by asserting rendered/contract-observable outcomes and transaction persistence semantics."
                    - date: "2026-04-18"
                        request_summary: "Substantial EntryForm UI refactor slice to reduce component complexity by extracting reusable pay-mode, autocomplete, modal UI blocks and pure form helpers while preserving behavior/contracts."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                        notes: "Decomposed EntryForm into smaller composable units, removed duplicated JSX branches and inline utility logic, preserved existing CSS selectors and accessibility semantics, and validated with TypeScript plus focused component tests."
                    - date: "2026-04-18"
                        request_summary: "First major refactor slice for data consistency: enforce canonical organization collections, remove legacy transaction-result compatibility path, and resolve shape-driven TypeScript errors in store/hooks/pay summary/fixtures."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "data-management"
                        notes: "Made organization venues/positions canonical arrays across contracts/schema and app flows, removed legacy tx ok-flag success fallback in JSON adapter, and fixed TS/runtime ambiguity from optional collection handling."
                    - date: "2026-04-18"
                        request_summary: "Remove visible white page-edge border around the app by eliminating default browser margins at the global app shell level."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                        notes: "Applied a minimal global reset for html/body/#root in AppStartupGate.css to remove default outer whitespace while preserving existing layout behavior on desktop and mobile."
                    - date: "2026-04-18"
                        request_summary: "Reorder Organizations modal sections to place Rulesets between Venues and Notes while preserving existing behavior and styling."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                        notes: "Updated OrganizationsPanel section render order to Organization Settings -> Positions -> Venues -> Rulesets -> Notes and added focused component order assertion coverage."
                    - date: "2026-04-18"
                        request_summary: "Style Rulesets section in the Organizations modal to match adjacent organization sections (padding, spacing, and typography) while preserving behavior and scoping overrides to the modal context."
                                                                - date: "2026-04-18"
                                                                    request_summary: "Remove all empty state placeholder messages from positions, venues, and rulesets sections for visual consistency."
                                                                    classification: "existing"
                                                                    confidence: 0.99
                                                                    acting_agent: "react-ui"
                                                                    changes:
                                                                        - "Removed 'No saved positions yet' message block from OrganizationsPanel.tsx positions section"
                                                                        - "Removed 'No saved venues yet' message block from OrganizationsPanel.tsx venues section"
                                                                        - "Converted RulesetEditor ternary (empty vs list) to always show list for transparent empty state"
                                                                    test_validation:
                                                                        - "OrganizationsPanel component tests: 20/20 passed"
                                                                        - "RulesetEditor component tests: 6/6 passed (fixed test selector for ruleset card clickability)"
                                                                        - "E2E organization/ruleset workflows: 24/24 passed across Chromium/Firefox/WebKit"
                                                                    notes: "All three sections now have transparent empty states with no placeholder text. Visual hierarchy maintained through clean layout and section headers with '+New' buttons."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                        notes: "Updated OrganizationsPanel markup to use the shared section wrapper and refined only organizations-panel-scoped RulesetEditor density/type overrides for section parity."
                    - date: "2026-04-18"
                        request_summary: "Focused validation pass for styling-only EntryForm CSS parity change to confirm behavior did not change and identify any residual visual-check risks."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "testing-agent"
                        test_scope:
                                - "Vitest targeted component run: EntryForm behavior surface"
                                - "Vitest targeted integration run: FreelanceTrackerApp navigation/editing state surface"
                        coverage_impact: "No new tests added; validation-only pass confirmed 29/29 nearby behavior tests green after styling tweak."
                        notes: "Functional parity holds on the exercised surfaces; remaining risk is visual-only (responsive spacing/contrast/dropdown layering) and should be spot-checked manually."
                    - date: "2026-04-18"
                        request_summary: "Reduce Rulesets section size inside the Organizations modal to better match the visual density of adjacent organization settings while preserving behavior."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                        notes: "Applied minimal scoped OrganizationsPanel CSS overrides to the embedded RulesetEditor (container/list/card/section spacing and title sizing) and retained interactive control touch targets via explicit minimum button height."
                    - date: "2026-04-17"
                        request_summary: "Reduce the visual weight of the Organizations modal Rulesets section to better match adjacent organization settings without changing RulesetEditor behavior."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                        notes: "Applied scoped OrganizationsPanel CSS density/typography overrides for the embedded RulesetEditor (padding, spacing, button sizing) while preserving all Ruleset functionality and interaction contracts."
                    - date: "2026-04-18"
                        request_summary: "Fix pre-existing Playwright ruleset edit-flow failure in organization modal/ruleset surface and validate targeted plus broader regressions."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "testing-agent"
                        test_scope:
                                - "Targeted Playwright rerun for ruleset create/edit/delete flow across desktop-chromium, desktop-firefox, and desktop-webkit"
                                - "Broader Playwright rerun of full tests/e2e/freelance-tracker.e2e.spec.ts on playwright.cross-browser.temp.config.ts"
                        coverage_impact: "No new test cases added; repaired stale E2E selector contract for ruleset editing and restored green regression signal (targeted 3/3 pass, full spec 69/69 pass)."
                        notes: "Root cause was contract drift: ruleset cards are now click-to-edit surfaces, so stale ruleset-edit-button selectors timed out."
                                        - date: "2026-04-17"
                                            request_summary: "Refine Organizations modal notes UI to use a single stable-height View/Edit toggle instead of rendering markdown preview and editor simultaneously."
                                            classification: "existing"
                                            confidence: 0.99
                                            acting_agent: "react-ui"
                                            notes: "Kept the existing markdown renderer and notes draft binding, introduced a single shared notes panel with stable height, and updated focused component coverage for toggle behavior."
                    - date: "2026-04-17"
                      request_summary: "Fix Entry Form pay mode fieldset radio alignment and restore visible labels; radios must not render centered and labels must remain visible within the fieldset."
                      classification: "existing"
                      confidence: 0.99
                      acting_agent: "feature-tracker"
                    - date: "2026-04-17"
                        request_summary: "Fix pay mode fieldset layout in Entry Form: left-align buttons and render labels horizontally as single-line text without overflowing fieldset."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "feature-tracker"
                    - date: "2026-04-17"
                        request_summary: "Pay mode radio button labels overflow panel; left-align radio controls within fieldset and keep labels contained in-box."
                        classification: "existing"
                        confidence: 0.97
                        acting_agent: "feature-tracker"
                    - date: "2026-04-17"
                        request_summary: "Align pay mode dialog radio buttons vertically, reduce vertical spacing, and keep Flat fee label on one line."
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "feature-tracker"
                    - date: "2026-04-17"
                      request_summary: "Slightly increase spacing between pay mode radio buttons without increasing fieldset height."
                      classification: "existing"
                      confidence: 0.99
                      acting_agent: "feature-tracker"
                    - date: "2026-04-17"
                        request_summary: "Implement organization modal editing for scoped positions/venues, timezone, pay period start, workweek start, and markdown notes preview/editing."
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "react-ui"
                        notes: "Added editable organization settings and canonical array-based position/venue management in the React modal, plus safe markdown preview for organization notes using react-markdown."
                    - date: "2026-04-17"
                        request_summary: "Add organization modal support for managing positions/venues, timezone, pay period start, workweek start, and markdown notes."
                        classification: "existing"
                        confidence: 0.96
                        acting_agent: "orchestrator"
                    - date: "2026-04-17"
                        request_summary: "Implement data-layer support for organization markdown notes and verify existing organization settings/catalog persistence remains backward compatible for organization modal editing."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "data-management"
                        notes: "Existing organization persistence already supported positions, venues, timezone, payPeriodStartDay, and workweekStartDay. Added canonical organization notes support plus compatibility normalization/tests for legacy saved organizations missing optional fields."
                    - date: "2026-04-17"
                        request_summary: "Run cross-engine sanity pass of full Playwright spec on desktop Firefox/WebKit plus narrow Firefox viewport to validate recently remediated scenarios."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "testing-agent"
                        test_scope:
                                - "Full Playwright spec across desktop-firefox and desktop-webkit projects"
                                - "Narrow Firefox viewport sanity validation for remediated responsive scenarios"
                        coverage_impact: "No new tests added; expands execution confidence across additional browser engines/viewports for existing F-001 scenarios. Cross-browser validation: desktop-firefox 23/23 ✓, desktop-webkit 23/23 ✓, narrow-firefox 5/23 (viewport-driven failures expected—responsive layout confirmed working)."
                        notes: "Chromium baseline remains 46/46 (100%) on desktop-chromium and mobile-chromium projects. Firefox and WebKit desktop engines both passed 100% (23/23 scenarios each). Narrow-firefox failures (18/18) are expected: 320px viewport triggers responsive mobile layout, but E2E tests currently use device-based isMobile checks rather than viewport-based branching. Failures confirm app responsive design works correctly; suggests future viewport-based test-branching refactor for comprehensive narrow-viewport coverage."
                    - date: 2026-04-17
                        request_summary: Stabilize Playwright server lifecycle, resolve Rulesets selector/contract mismatch failures, and rerun full Playwright spec for clean regression signal
                        classification: existing
                        confidence: 0.98
                        acting_agent: testing-agent
                    - date: "2026-04-17"
                        request_summary: "Add stable npm Playwright subset aliases for entry-finance and organizations/ruleset journeys to replace ad-hoc long grep commands"
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "testing-agent"
                        test_scope:
                                - "NPM alias wiring for two Playwright grep subsets: entry finance and organizations/ruleset journey"
                                - "Single execution validation for each new alias script with exit-code reporting"
                        coverage_impact: "No new tests added; improves repeatable execution coverage of high-value Playwright subsets via stable script aliases."
                        notes: "Kept existing scripts/config intact and added minimal aliases only."
                    - date: "2026-04-17"
                        request_summary: "Run full Playwright spec on current config to confirm no unrelated regressions beyond targeted scenario"
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "testing-agent"
                        test_scope:
                                - "Full Playwright execution of tests/e2e/freelance-tracker.e2e.spec.ts across all configured projects"
                                - "Regression confirmation beyond previously targeted grep scenarios"
                        coverage_impact: "No new tests added; broadened execution evidence from targeted scenarios to full-spec confidence validation on current config."
                        notes: "Use per-project pass/fail accounting and failure triage to distinguish unrelated regressions from harness/environment noise."
                    - date: "2026-04-18"
                        request_summary: "Consolidate Rulesets section heading and align styling with Positions/Venues"
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "react-ui"
                        changes:
                            - "Removed outer <h4>Rulesets</h4> heading from OrganizationsPanel.tsx (line 829)"
                            - "Updated .organizations-panel__rulesets-section CSS to remove padding, border, and background styling (now matches .organizations-panel__section)"
                        test_results:
                            - "OrganizationsPanel.test.tsx: 20/20 tests pass"
                            - "Playwright ruleset E2E scenarios: 12/12 tests pass (chromium, webkit, firefox)"
                        notes: "Visual styling now consistent across Positions, Venues, and Rulesets sections. RulesetEditor retains embedded 'Pay Rulesets' h3 heading per design."
                    - date: "2026-04-18"
                        request_summary: "Complete Playwright stabilization for remaining 15 failures by aligning stale Organizations-era selectors to current Rulesets/New Entry tab UX, then rerun targeted + full spec"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                                - "Playwright targeted rerun for prior red cluster: mobile tab behavior, ruleset authoring, invalid-ruleset correction, pay-summary premium, flat-fee totals, and unknown-organization manage flow"
                                - "Playwright full-spec rerun for tests/e2e/freelance-tracker.e2e.spec.ts across desktop-chromium and mobile-chromium"
                        coverage_impact: "Targeted regression slice reached green (16/16). Full freelance-tracker Playwright spec reached green (46/46)."
                        acting_agent: "testing-agent"
                        notes: "Minimal-change approach: updated E2E contract to current shell navigation (New Entry/Entry History/Pay Summary/Rulesets), replaced legacy Organizations-pane assumptions, and kept product code unchanged."
                    - date: "2026-04-18"
                        request_summary: "Clear final Playwright release-gate failures by hardening firebase bootstrap retry recovery timing and fixing mobile edit-entry Position locator ambiguity, then rerun targeted failures and full suite."
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                                - "Playwright targeted rerun on desktop-chromium and mobile-chromium for firebase bootstrap retry recovery and edit entry workflow scenarios"
                                - "Playwright full suite rerun across configured projects for release-gate confirmation"
                        coverage_impact: "No new test files; strengthened E2E scenario resilience to startup timing variance and strict-mode-sensitive bootstrap outcome consumption. Validation passed targeted 4/4 and full suite 48/48."
                        acting_agent: "testing-agent"
                        notes: "Product code unchanged; fixes were limited to E2E test contract hardening (retry loop + exact label selector)."
                    - date: "2026-04-17"
                        request_summary: "Implement recommended next steps by fixing the 4 remaining failing Playwright scenarios (firebase-mode bootstrap retry recovery, delete entry workflow, cross-org cumulative summary visibility, history vs summary organization-filter default/independence) and rerun the full freelance-tracker Playwright spec."
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "testing-agent"
                    - date: "2026-04-17"
                        request_summary: "Focused TS test-title and grep-pattern consistency audit"
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "feature-tracker"
                        notes: "No code edits applied due to matcher-stability risk."
                    - date: "2026-04-17"
                        request_summary: "Continue deterministic Playwright triage for three failing F-001 scenarios (edit entry workflow, pay period/gross pay, unrated entries) with focused reruns and a full-spec baseline rerun."
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                                - "Playwright focused run for three scenarios across desktop-chromium and mobile-chromium projects after minimal test-contract updates"
                                - "Playwright full-spec rerun for tests/e2e/freelance-tracker.e2e.spec.ts to establish post-fix baseline"
                        coverage_impact: "Targeted failure slice moved to green (6/6 focused tests). Full spec remained red (31/46 passed) due broader Organizations-surface contract drift outside the three requested scenarios."
                        acting_agent: "testing-agent"
                        notes: "Applied minimal E2E selector/flow hardening for modal-backed edit updates and summary metric labels; identified app-level regression caused by stale store API usage (selectOrganization/selectedOrganizationId) and fixed startup crash to unblock deterministic reruns."
                    - date: "2026-04-17"
                        request_summary: "Complete non-markdown browser-wording consistency audit"
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "feature-tracker"
                        notes: "No normalization edits were needed; remaining occurrences are Playwright project identifiers or official device preset keys (e.g., desktop-chromium, devices[\"Desktop Chrome\"])."
                    - date: "2026-04-17"
                        request_summary: "Adjust Playwright test mobile/desktop branching to be viewport-based instead of isMobile-based, then rerun narrow-viewport Firefox as a practical mobile proxy for Entry grouped-row responsive/no-overflow validation."
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "feature-tracker"
                    - date: "2026-04-17"
                        request: "Add cancel action for entry edit flow so cancelling returns the entry pane to the default add-entry state"
                        classification: "existing"
                        confidence: 0.97
                        agent: "react-ui"
                        notes: "Added an explicit Cancel Edit action in the entry form and cleared editing state so the pane returns to the default create-entry mode without submitting changes."
          - date: "2026-04-14"
            request: "Scaffold freelance hours tracker app"
            classification: "new-sensible"
            confidence: 0.95
            agent: "orchestrator"
                    - date: "2026-04-17"
                        request: "Fix New Organization modal submit lifecycle when createOrganization never resolves, preventing perpetual Saving state"
                        classification: "existing"
                        confidence: 0.99
                        agent: "react-ui"
                        notes: "Added a bounded timeout guard around modal createOrganization submit, preserved success/error/cancel behavior, and added regression coverage for unresolved-promise timeout plus result-error handling."
                    - date: "2026-04-17"
                        request: "Fix New Organization modal save flow hang where button remained in Saving state on error outcomes"
                        classification: "existing"
                        confidence: 0.98
                        agent: "react-ui"
                        notes: "Handled thrown createOrganization failures in EntryForm modal submit path and added a regression test to verify Saving state clears with visible error feedback."
                    - date: "2026-04-17"
                        request_summary: "F-001 confidence validation run after New Organization modal Saving-hang fix using broader adjacent Vitest coverage and minimal E2E flow check"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                                - "Vitest: EntryForm component integration tests for New Organization modal behavior, including error-path recovery from Saving state"
                                - "Vitest: adjacent store behavior tests in application/store.test.ts and application/__tests__/store.test.ts"
                                - "Playwright: desktop create-on-miss organization flow (create, refresh, auto-select)"
                        coverage_impact: "No new tests added; executed a broader targeted regression slice confirming 39/39 Vitest tests and 1/1 Playwright test passed for the defect-adjacent surface."
                        acting_agent: "testing-agent"
                        notes: "Validation-only run scoped to defect area; no product code changes made."
                    - date: "2026-04-17"
                        request_summary: "Focused Playwright validation for New Organization modal post-Save timeout/error recovery path after stuck-Saving fix"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                                - "Playwright focused run: create-on-miss organization flow (closest available case) covering modal open, Save, dialog dismissal, and organization auto-select"
                        coverage_impact: "No new tests added; executed 1 focused Playwright command and passed 2/2 project runs (desktop + mobile). Gap remains: no exact E2E case currently asserts post-Save timeout/error recovery in New Organization modal."
                        acting_agent: "testing-agent"
                        notes: "Validation-only run for F-001. No product code changes made."
                    - date: "2026-04-17"
                        request_summary: "Concise testing guidance for F-001 entry-edit cancel flow returning EntryForm to default add-entry state"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                                - "Component/integration guidance centered on EntryForm edit-mode cancel affordance and FreelanceTrackerApp edit-to-cancel state transition"
                                - "Unit/store guidance only if implementation introduces a dedicated clearEditingEntry action rather than reusing setEditingEntry(null)"
                                - "E2E explicitly deemed optional for this small local UI-state change because no cross-layer contract or async boundary changes are involved"
                        coverage_impact: "Planning-only pass; recommends minimum regression coverage at component and app-integration layers, with E2E deferred unless the implementation changes broader edit workflow behavior."
                        acting_agent: "testing-agent"
                        notes: "Guidance-only request. Recommended proof focuses on edit-mode visibility, cancel action, editingEntryId clearing, and restored New Entry/Create Entry state."
                    - date: "2026-04-17"
                        request_summary: "Implement dedicated Playwright scenario for New Organization modal post-Save timeout/error recovery"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                                - "Playwright E2E: manual organization input -> create-on-miss modal -> forced post-Save timeout path -> verify Saving state clears, timeout error feedback, and successful retry recovery"
                                - "Playwright regression: existing create-on-miss create/refresh/auto-select flow"
                        coverage_impact: "Added one new E2E failure-recovery scenario that directly covers the previously untested stuck-Saving timeout path in the New Organization modal; improved branch confidence for post-Save error handling and retry recovery without broad suite expansion."
                        acting_agent: "testing-agent"
                        notes: "Added a deterministic E2E override hook for create-organization outcomes/timeouts to keep the scenario stable and fast."
                    - date: "2026-04-14"
                        request: "Add create-on-miss organization flow from organization dropdown manual entry, with new-organization modal and list refresh/select"
                        classification: "existing"
                        confidence: 0.96
                        agent: "feature-tracker"
                    - date: "2026-04-14"
                        request: "Fix JsonDataLayer localStorage lifecycle test for initialize/dispose rehydration"
                        classification: "existing"
                        confidence: 0.98
                        agent: "data-management"
                        notes: "Kept DAL behavior unchanged. Jest lifecycle coverage now seeds and inspects jsdom's active localStorage handle so initialize/dispose validate the same persistence surface used by the JSON adapter."
          - date: "2026-04-14"
            milestone: "Data layer infrastructure complete"
            completed_by: "data-management"
            deliverables:
                - "contracts/types.ts: branded Id, domain types, DalError union, Result<T>"
                - "data/dal.ts: IDataLayer, IEntryRepository, IOrganizationRepository, ITagHistoryRepository, IPositionHistoryRepository, IVenueHistoryRepository, ITransactionManager"
                - "data/adapters/json.adapter.ts: JsonDataLayer with localStorage persistence, schema validation, transactions"
                - "data/schema/: JSON schemas for all entities (entry, organization, tag-history, position-history, venue-history)"
                - "data/index.ts: singleton factory getDataLayer()"
                - "index.ts (feature root): public API barrel export"
            notes: "All DAL contracts are datastore-agnostic; future adapters (PostgreSQL, MongoDB, etc.) can implement same interfaces. Backend and React-UI agents can now proceed in parallel."
          - date: "2026-04-14"
            milestone: "Backend services implementation complete (F-001 Backend)"
            completed_by: "backend"
            deliverables:
                - "domain/services/PayPeriodService.ts: calculatePayPeriodForDate(date, orgId) -> Result<{startDate, endDate}> with support for all 7 start days (1=Mon through 7=Sun)"
                - "domain/services/GrossPayCalculator.ts: calculateGrossPayForPeriod(orgId, period) -> Result<{totalPay, entriesWithoutRate, totalHours, breakdown, cumulativePay}> with cross-org cumulative calculation"
                - "domain/services/index.ts: barrel export for services"
                - "Comprehensive unit tests: PayPeriodService.test.ts (all 7 start days, edge cases, boundaries), GrossPayCalculator.test.ts (rate handling, null rates, cumulative calc, error handling)"
            notes: "All services use Result<T> pattern for error handling. Pay period calculation handles month/year boundaries with UTC date arithmetic. Gross pay correctly sums non-null rates and counts unrated entries separately. Cumulative calculation queries all organizations in the same period."
                    - date: "2026-04-14"
                        milestone: "React UI implementation complete (F-001 UI)"
                        completed_by: "react-ui"
                        deliverables:
                                - "application/store.ts: Zustand store with immer middleware managing entries, organizations, periods, histories, loading/error states"
                                - "application/hooks.ts: custom hooks (useFreelanceTracker, useEntryForm, usePayPeriod, useGrossPayCalculation)"
                                - "application/components/EntryForm.tsx: form with venue/position/org autocomplete, date/time pickers, tag pills, validation, error handling"
                                - "application/components/EntryForm.css: dark theme styling (QLab/VS Code aesthetic), 4px rhythm, responsive layout"
                                - "application/components/EntryHistory.tsx: sortable/filterable entry list, inline edit/delete, responsive table/card layout"
                                - "application/components/EntryHistory.css: dark theme table styles, delete confirmation modal, responsive design"
                                - "application/components/PaySummary.tsx: KPI-style cards, org/period selectors, gross pay display with cumulative"
                                - "application/components/PaySummary.css: dark theme card styling, responsive grid layout"
                                - "application/components/FreelanceTrackerApp.tsx: main container, orchestrates layout and state, responsive mobile-first design"
                                - "application/components/FreelanceTrackerApp.css: responsive layout (mobile-first, tablet, desktop), form sidebar, header"
                                - "application/components/index.ts: barrel export for all components"
                                - "application/index.ts: public API export of store, hooks, and components"
                                - "Comprehensive test suite: EntryForm.test.tsx, EntryHistory.test.tsx, PaySummary.test.tsx, FreelanceTrackerApp.test.tsx, hooks.test.ts, store.test.ts"
                                - "Updated index.ts (feature root): added application layer exports"
                                                notes: "All components follow React 19 patterns with hooks, Zustand for state management, and native HTML5 elements for pickers. Dark theme uses #1e1e1e background with semantic colors. Mobile-first responsive design with breakpoints at 480px and 768px. Form auto-opens on app launch. Autocomplete is case-insensitive with case-preserved display. All CRUD operations use DAL transactions. Tests use React Testing Library with vitest."
                                                status: "complete"
                    - date: "2026-04-14"
                        request: "F-001 comprehensive testing expansion (unit, integration, and e2e)"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                                - "Data layer repositories and DAL contract tests"
                                - "Domain service pay-period and gross-pay calculations"
                                - "Application store action and error-path behavior"
                                - "Component integration workflows for form/history/summary/app shell"
                                - "Playwright e2e critical journey scenarios (desktop + mobile)"
                        coverage_impact: "Expanded test coverage surfaces across DAL, services, store, UI integration, and end-to-end journeys."
                        agent: "testing-agent"
                            - date: "2026-04-14"
                            request: "F-001 package/runtime setup and test execution enablement"
                            classification: "existing"
                            confidence: 0.98
                            test_scope:
                                - "Runtime scaffolding for React app execution"
                                - "Jest unit/integration harness execution"
                                - "Playwright E2E harness execution with local web server"
                            coverage_impact: "No direct new test cases; enables execution of existing Jest and Playwright suites."
                            agent: "testing-agent"
                    - date: "2026-04-14"
                        request: "Fix F-001 feature-root/application barrel export mismatch blocking Vite startup"
                        classification: "existing"
                        confidence: 0.99
                        agent: "react-ui"
                    - date: "2026-04-14"
                        request: "Run final verification after recent fixes (Jest + Playwright)"
                        classification: "existing"
                        confidence: 0.98
                        test_scope:
                                - "Full Jest suite execution and pass/fail accounting"
                                - "Full Playwright project execution with per-project pass/fail accounting"
                                - "Failure triage as harness/config vs product behavior"
                        coverage_impact: "No new tests added; validates current test suite stability and release readiness signal."
                        agent: "testing-agent"
                    - date: "2026-04-14"
                        request: "Fix F-001 product-side UI regressions behind E2E breakage (create/filter/edit/delete/unrated/cumulative/mobile interception)"
                        classification: "existing"
                        confidence: 0.98
                        agent: "react-ui"
                    - date: "2026-04-14"
                        request: "Finalize F-001 E2E harness after product fixes (strict selector, mobile scrolling compatibility, brittle assertions) and verify Jest baseline"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                                - "Playwright full-suite execution and targeted harness/spec hardening"
                                - "Strict-mode locator disambiguation for pay-summary hours KPI"
                                - "Mobile-compatible scrolling behavior for mobile project"
                                - "Jest regression verification with assertion alignment to current UI copy"
                        coverage_impact: "No new product behavior added; improved E2E/Jest harness reliability and selector robustness."
                        agent: "testing-agent"
                            - date: "2026-04-14"
                            request: "Final handoff completion: fresh Playwright HTML+JSON run, per-project summary, and dev command usability diagnosis"
                            classification: "existing"
                            confidence: 0.99
                            test_scope:
                                - "Fresh Playwright HTML artifact generation"
                                - "Fresh JSON reporter output generation for machine-readable counts"
                                - "Per-project result extraction from JSON output"
                                - "NPM dev command invocation diagnosis"
                            coverage_impact: "No new test cases added; verified current E2E harness run output and command usability for release handoff."
                            agent: "testing-agent"
                    - date: "2026-04-14"
                        request: "Testing follow-up for F-001 create-on-miss organization flow (unit, integration, and e2e failure-mode coverage)"
                        classification: "existing"
                        confidence: 0.98
                        test_scope:
                                - "Store unit behavior for duplicate-name normalization and blank-name validation in createOrganization"
                                - "EntryForm integration coverage for duplicate handling, modal validation failure, DAL failure feedback, cancel/close, and loading submit state"
                                - "Playwright create-on-miss critical journey covering create/select, validation error, cancel path, and duplicate prompt suppression"
                        coverage_impact: "Raised branch and behavior-path coverage for organization create-on-miss flow across store, integration, and E2E layers."
                        agent: "testing-agent"
                    - date: "2026-04-14"
                        request: "F-001 desktop three-panel layout with full-height mobile tabs and independent history/summary period selectors defaulting to This Month"
                        classification: "existing"
                        confidence: 0.99
                        agent: "react-ui"
                    - date: "2026-04-14"
                        request: "Add organization-level pay rulesets with multi-rule overtime/penalty/multiplier logic and rule-line breakdown summaries"
                        classification: "existing"
                        confidence: 0.92
                        agent: "feature-tracker"
                        - date: "2026-04-14"
                            request: "F-001 ruleset policy confirmation and UI planning for authoring/editing, additive overlap warnings, and pay-summary earnings breakdown"
                            classification: "existing"
                            confidence: 0.98
                            agent: "react-ui"
                    - date: "2026-04-14"
                        request: "Define data-layer plan for F-001 ruleset enhancement: immutable effective-dated rulesets, rule overlap warnings, midnight split handling, configurable meal penalty multiplier, and localStorage migration strategy"
                        classification: "existing"
                        confidence: 0.97
                        agent: "data-management"
                        notes: "Planning-only pass. Policy confirmed: additive overlaps with warnings, no mixed daily+weekly overtime within one org ruleset, shifts split at midnight for day-boundary logic, ruleset history is effective-dated immutable, meal penalty payout uses configurable hourly-rate multiplier."
                    - date: "2026-04-14"
                        request: "Create concise testing plan for F-001 ruleset enhancement covering rule math, date boundaries, versioning, and warning UX"
                        classification: "existing"
                        confidence: 0.98
                        test_scope:
                                - "Domain rule-math coverage for additive overlaps, single-OT-rule enforcement, meal-penalty multiplier math, and midnight splitting"
                                - "Integration coverage for effective-dated ruleset selection, persistence/version history, and warning propagation to UI"
                                - "Playwright coverage for ruleset-driven pay summary behavior and overlap warning UX"
                        coverage_impact: "Planning-only pass; identifies required statement/branch/function/line coverage expansions across rules engine, data flow, and warning UX without editing tests yet."
                        agent: "testing-agent"
                    - date: "2026-04-14"
                        request: "Create backend/domain implementation plan for F-001 ruleset enhancement covering deterministic evaluation, additive overlaps, midnight splits, immutable effective-dated history, and normalized summary lines"
                        classification: "existing"
                        confidence: 0.98
                        agent: "backend"
                        notes: "Planning-only pass. Backend scope centers on deterministic rule evaluation, scope rollups without double-counting, normalized summary line items, and blocker identification before any implementation starts."
                    - date: "2026-04-15"
                        request: "Write F-001 ruleset enhancement tests — domain engine and data layer (no UI/E2E pending react-ui completion)"
                        classification: "existing"
                        confidence: 0.99
                        agent: "testing-agent"
                        test_scope:
                            - "RuleEvaluator: midnight split edge cases (23:59→00:01, starts-at-midnight, year boundary, entryId preservation)"
                            - "RuleEvaluator: description field → ruleLabel propagation for DailyOT and WeeklyOT"
                            - "RuleEvaluator: additive overlap — two custom rules on same entry, total = arithmetic sum, warning cites entryId"
                            - "RuleEvaluator: empty entries / empty rules — no crash, empty result"
                            - "RuleEvaluator: null-rate entry with mealPenaltyCount > 0 → non-null flat premiumAmount (not rate-dependent)"
                            - "RulesetSelector.validateSingleOTRule: multiple weekly-OT rules rejected; empty rules passes; only non-OT rules passes"
                            - "RulesetSelector.selectActiveFromList: exact effectiveDate match; date before all rulesets → null; empty list → null"
                            - "GrossPayCalculator: no active ruleset → base pay only, ruleLines empty, no crash"
                            - "GrossPayCalculator: multi-effective-date period — entries grouped by correct ruleset version per dateWorked"
                            - "GrossPayCalculator: description propagates into ruleLines.ruleLabel"
                            - "GrossPayCalculator: unrated entries surface in ruleLines.unratedEntryCount and ruleWarnings"
                        coverage_impact: "66 domain-service tests now pass (up from 53). RuleEvaluator.ts at 95.85% stmt, RulesetSelector.ts at 100%, GrossPayCalculator.ts at 87.95%. Pre-existing assertion bug in summary aggregation test corrected (totalPremiumHours: 3 not 2 for two-day variant)."
                        deferred_e2e: "All E2E coverage for F-001 ruleset feature deferred — react-ui agent has not yet built the RulesetEditor/PaySummaryRuleLines UI components. E2E can be unblocked once the ruleset authoring form and earnings-breakdown section render to the DOM."
                    - date: "2026-04-15"
                        request: "F-001 ruleset follow-up triage and Jest stabilization after post-feature drift (EntryForm org defaults, app rulesets tab contract, DAL error-shape assertions)"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                                - "Integration: EntryForm expectation updated for organization defaults (timezone/workweekStartDay)"
                                - "Integration: FreelanceTrackerApp harness aligned with new Rulesets tab surface by mocking RulesetEditor and asserting tab presence"
                                - "Data-layer: dal/json.adapter tests aligned to DalError.type discriminator and notFound payload shape"
                        coverage_impact: "No net new coverage surface; restored failing tests to match accepted F-001 behavior and current DAL contract, returning suite stability."
                        agent: "testing-agent"
                            - date: "2026-04-15"
                            request: "Focused tooling/type-declaration fix so TS editor diagnostics align with Jest runtime for CSS side-effect imports and jest-dom matcher typing"
                            classification: "existing"
                            confidence: 0.98
                            test_scope:
                                - "TypeScript ambient declaration coverage for side-effect style imports"
                                - "Jest + @jest/globals matcher augmentation visibility in integration tests"
                            coverage_impact: "No runtime or behavioral test changes; reduced false-positive editor diagnostics on component and integration test surfaces."
                            agent: "testing-agent"
                    - date: "2026-04-15"
                        request: "Implement Playwright follow-up for F-001 ruleset coverage across tab navigation, authoring, and pay-summary premium/warning rendering"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                                - "Playwright Rulesets tab visibility/navigation coverage on desktop and mobile"
                                - "Ruleset authoring critical path for daily OT + custom premium creation and active-ruleset display"
                                - "Ruleset authoring validation/correction flow for blocked save and malformed custom JSON"
                                - "Pay Summary premium breakdown and additive-warning rendering for ruleset-affected entries"
                        coverage_impact: "Expanded F-001 E2E coverage to the ruleset authoring surface and ruleset-driven pay summary outcomes on Chromium, WebKit, and Firefox (via Playwright)."
                        agent: "testing-agent"
                    - date: "2026-04-15"
                        request_summary: "Vitest migration surfaced hidden failures; stabilized failing unit/integration tests"
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "testing-agent"
                    - date: "2026-04-15"
                        request_summary: "Removed React act warnings from Vitest tests while preserving behavior"
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "testing-agent"
                    - date: "2026-04-15"
                        request_summary: "Removed Vite CJS deprecation warning and executed full regression checks"
                        classification: "existing"
                        confidence: 0.97
                        acting_agent: "testing-agent"
                    - date: "2026-04-15"
                        request_summary: "Fixed failing Playwright ruleset scenarios and restored E2E baseline"
                        classification: "existing"
                        confidence: 0.97
                        acting_agent: "testing-agent"
                    - date: "2026-04-15"
                        request_summary: "Triaged Playwright skipped tests and re-enabled viable scenarios"
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "testing-agent"
                    - date: "2026-04-15"
                        request_summary: "Hardened Playwright selectors/assertions to reduce flake risk while preserving behavior"
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "testing-agent"
                    - date: "2026-04-15"
                        request_summary: "Cleaned up component __tests__ imports after Vitest migration"
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "testing-agent"
                    - date: "2026-04-15"
                        request_summary: "Included component __tests__ in default Vitest execution"
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "testing-agent"
                    - date: "2026-04-15"
                        request_summary: "Completed repository-wide Jest-to-Vitest migration and converged on single Vitest baseline"
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "testing-agent"
                        notes: "Migrated 7 files from @jest/globals to vitest: PayPeriodService.test.ts, GrossPayCalculator.test.ts, RuleEvaluator.test.ts, RulesetSelector.test.ts, json.adapter.test.ts, dal.test.ts, store.test.ts. Replaced jest.fn() with vi.fn(), jest.mock() with vi.mock() using vi.hoisted() pattern. Updated vitest.config.mts to remove exclusions for __tests__ directories. All 218 tests pass (20 files, no excluded paths remaining). Single converged Vitest baseline achieved; no Jest-era code paths remain."
                    - date: "2026-04-15"
                        request_summary: "Clarified scope split: Firebase all-in implementation is tracked under F-002 while F-001 scope remains unchanged"
                        classification: "existing"
                        confidence: 0.97
                        acting_agent: "feature-tracker"
                    - date: "2026-04-16"
                        request_summary: "Playwright follow-up for F-001 ruleset coverage in current repo state after transient run failure"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                            - "Rulesets tab visibility/navigation on desktop and mobile"
                            - "Ruleset authoring critical path (effective date, Daily OT, custom tag multiplier, active ruleset assertions)"
                            - "Ruleset authoring validation/failure flow (save blocked with no rules, malformed custom JSON, successful correction)"
                            - "Pay Summary premium breakdown and additive overlap warning rendering"
                            - "Playwright harness hardening to avoid stale dev-server reuse by isolating E2E base URL/port"
                        coverage_impact: "No product behavior changes; reaffirmed and executed ruleset-focused E2E scenarios across both projects with green results, improving run reliability under mixed local dev states."
                        acting_agent: "testing-agent"
                        - date: "2026-04-16"
                        request_summary: "Execute full Playwright verification across all configured projects and provide release-readiness triage"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                            - "Full Playwright suite execution for all specs under tests/e2e across desktop-chromium and mobile-chromium"
                            - "Per-project outcome accounting for passed/failed/skipped/flaky/timedOut/interrupted statuses"
                            - "Failure triage classification across product regression, harness/selectors, and environment/setup buckets"
                        coverage_impact: "No new automated tests added; refreshed end-to-end execution evidence and confirmed current E2E behavior stability across configured projects."
                        acting_agent: "testing-agent"
                    - date: "2026-04-16"
                        request_summary: "Final combined readiness report (Vitest + Playwright + TypeScript + lint diagnostics)"
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "orchestrator/testing-agent"
                        outcome: "Vitest 253 passed, 1 failed (AppStartupGate syncing test); Playwright desktop 20/20 and mobile 20/20 passed; TypeScript --noEmit currently fails (jest-dom/@jest globals typings, WeakRef lib target gaps, and test/type drift after ruleset model updates); lint script absent and fallback eslint install/run failed due to Node/ESLint config mismatch."
                    - date: "2026-04-16"
                        request_summary: "Strict-readiness test-side stabilization: fix AppStartupGate Vitest failure and resolve TypeScript test drift after model updates"
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "testing-agent"
                    - date: "2026-04-16"
                        request_summary: "Backend/tooling strict-readiness pass: align domain IDataLayer source usage, clear backend-owned non-test noEmit issues, and add Node 18 compatible lint command/config"
                        classification: "existing"
                        confidence: 0.96
                        acting_agent: "backend"
                    - date: "2026-04-16"
                        request_summary: "F-001 E2E stabilization follow-up after UI/ruleset tab-panel behavior drift: update Playwright harness/spec selectors and rerun full multi-project suite"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                            - "Playwright helper hardening to ensure organization readiness before entry/ruleset flows"
                            - "Playwright harness hardening to prevent stale-server reuse and enforce deterministic E2E adapter/port startup"
                            - "Full Playwright suite execution across desktop-chromium and mobile-chromium"
                        coverage_impact: "No new product behavior added; restored end-to-end reliability against current tab/panel behavior and startup state, returning 40/40 passing outcomes across configured projects."
                        acting_agent: "testing-agent"
                    - date: "2026-04-17"
                        request_summary: "Implement data-layer support for hourly/flat-fee shift payment mode fields with backward-compatible persistence updates"
                        classification: "existing"
                        confidence: 0.96
                        acting_agent: "data-management"
                    - date: "2026-04-17"
                        request_summary: "Add period-scoped employer pie chart in Pay Summary with Hours/Earnings metric toggle"
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                    - date: "2026-04-17"
                        request_summary: "Implement backend/domain flat-fee shift logic (base pay, derived effective rate, mixed aggregation, zero-duration safety, and rule premiums)"
                        classification: "existing"
                        confidence: 0.97
                        acting_agent: "backend"
                    - date: "2026-04-17"
                        request_summary: "Implement F-001 React UI/application flat-fee shift flow: mode toggle, flat-fee validation UX, history badge/styling, mixed-mode summary clarity, and component integration tests"
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                    - date: "2026-04-17"
                        request: "Add/verify period-scoped employer pie chart in Pay Summary with switchable metric (hours by employer or money earned by employer) and responsive accessibility refinements"
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                    - date: "2026-04-17"
                        request_summary: "Testing pass for period-scoped employer pie chart metric toggle in Pay Summary"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                            - "PaySummary integration coverage for employer chart metric toggle, period-change reaggregation, and aggregation-failure empty state"
                            - "Targeted regression execution for PaySummary integration and component-level tests"
                        coverage_impact: "Added integration assertions for period-scoped employer aggregation refresh and failure fallback behavior with all targeted PaySummary tests passing."
                        acting_agent: "testing-agent"
                    - date: "2026-04-17"
                        request_summary: "Expand/validate flat-fee shift coverage across unit, integration, and E2E layers"
                        classification: "existing"
                        confidence: 0.99
                        test_scope:
                            - "Unit: useEntryForm validation failures for missing and negative flat-fee amount"
                            - "Integration: PaySummary premium totals on top of flat-fee base pay with 2-decimal rendering"
                            - "Integration: EntryHistory zero-duration flat-fee row styling/badge and $0.00/hr effective-rate display"
                            - "E2E: flat-fee critical journey for creation, row styling/badge, derived effective-rate formatting, and premium-on-top total"
                        coverage_impact: "Focused Vitest coverage run for changed scope reports 18.15% statements, 69.79% branches, 21.27% functions, and 18.15% lines overall; key changed surfaces include hooks.ts (47.67% lines), EntryHistory.tsx (82.33% lines), and PaySummary.tsx (94.95% lines)."
                        acting_agent: "testing-agent"
                    - date: "2026-04-17"
                        request_summary: "New Organization modal Save button stuck at Saving.../disabled on open"
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "react-ui"
                    - date: "2026-04-17"
                        request_summary: "Audit follow-up for F-001 submit/save/create button loading-state bindings across Freelance Tracker UI"
                        classification: "existing"
                        confidence: 0.99
                        acting_agent: "react-ui"
                        notes: "Validated current button/loading-state wiring only. No additional risky submit/save/create buttons were found bound to shared store.loading. EntryForm create-entry and organization-save actions use local pending flags (isSubmittingEntry, isSubmittingOrganization), and RulesetEditor save uses local saving state. EntryHistory delete confirmation could optionally show local isDeleting feedback, but current behavior closes the modal immediately and already prevents rapid re-click on the confirmation button surface. No product-code changes were required."
                    - date: "2026-04-17"
                        request_summary: "Org filter checkbox + consolidated all-orgs default view in EntryHistory and PaySummary; consistent org picker styling between panels"
                        classification: "existing"
                        confidence: 0.96
                        acting_agent: "react-ui"
                    - date: "2026-04-18"
                        request_summary: "Shorten the Organization tab label to Org only at ≤320px viewports where the word would otherwise break/wrap."
                        classification: "existing"
                        confidence: 0.98
                        acting_agent: "react-ui"
                        notes: "Used two-span approach inside the tab button: full-label span visible by default, short-label span (aria-hidden) hidden by default and shown via display:inline at max-width:320px. Breakpoint chosen because the existing CSS comment already identified 320px as the overflow-wrap guard threshold. No test changes required — tests locate the tab by ID (#freelance-tab-organization) and by role/name regex (/organization/i), both of which remain unaffected because the accessible name is still 'Organization'. 15/15 targeted Vitest tests pass."

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
