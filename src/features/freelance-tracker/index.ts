/**
 * Freelance Tracker Feature Public API
 *
 * This feature provides:
 * - Entry management (create, list, update, delete work entries)
 * - Organization management (venues/clients with configurable pay periods)
 * - History tracking (auto-learned tags, positions, venues for autocomplete)
 * - Transactional consistency (all-or-nothing multi-entity operations)
 * - Pay period calculations (configurable per organization)
 * - Gross pay calculations (with rate handling and cross-org aggregation)
 */

// Data layer
export { getDataLayer } from "./data";
export type { IDataLayer, ITransactionContext } from "./data";

// Domain types and utilities
export type {
    Entry,
    Organization,
    TagHistory,
    PositionHistory,
    VenueHistory,
    Id,
    Result,
    DalError,
} from "./contracts/types";
export { ok, err, isOk } from "./contracts/types";

// Domain services
export { PayPeriodService, GrossPayCalculator } from "./domain/services";
export type {
    PayPeriodServiceDeps,
    GrossPayCalculatorDeps,
    GrossPayResult,
    BreakdownItem,
} from "./domain/services";

// Re-export adapters for testing/mocking
export { JsonDataLayer } from "./data/adapters/json.adapter";

// Firebase integration primitives
export {
    loadFirebaseConfig,
    getFirebaseApp,
    getFirebaseAuth,
    getAuthStartupState,
    subscribeToAuthStartupState,
    ensureAnonymousUser,
    bootstrapAnonymousAuth,
} from "./integration/firebase";
export type { AuthStartupState } from "./integration/firebase";

// Application layer - React UI components, hooks, and store
export {
    FreelanceTrackerApp,
    AppStartupGate,
    EntryForm,
    EntryHistory,
    PaySummary,
} from "./application";
export {
    useFreelanceTracker,
    useEntryForm,
    usePayPeriod,
    useGrossPayCalculation,
} from "./application";
export { useFreelanceTrackerStore } from "./application";
export type { FreelanceTrackerStore } from "./application";
