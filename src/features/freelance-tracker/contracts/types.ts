/**
 * Domain types for Freelance Hours Tracker
 * All external (DAL-facing) contracts defined here
 */

/** Unique identifier */
export type Id = string & { readonly __brand: "Id" };

export const createId = (): Id => {
    return crypto.randomUUID() as Id;
};

export type EntryPaymentMode = "hourly" | "flat-fee";

export type OrganizationPosition = {
    name: string;
    defaultRate?: number | null;
};

/** Entry represents a single work session */
export type Entry = {
    entryId: Id;
    organizationId: Id;
    dateWorked: string; // YYYY-MM-DD
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    venue: string | null;
    position: string;
    rate: number | null; // nullable if TBD
    paymentMode?: EntryPaymentMode; // defaults to hourly when omitted
    flatFeeAmount?: number | null; // only used when paymentMode is flat-fee
    event: string | null;
    tags: string[];
    notes: string | null;
    mealPenaltyCount: number; // 0 or positive integer; manually triggered to apply MealPenaltyRule
    createdAt: string; // ISO 8601
    updatedAt: string; // ISO 8601
};

/** Organization represents a venue/client */
export type Organization = {
    organizationId: Id;
    name: string;
    payPeriodStartDay: number; // 1=Monday, 7=Sunday
    timezone: string; // IANA timezone (e.g., "America/New_York"); defaults to "UTC"
    workweekStartDay: number; // 1=Monday, 7=Sunday; separate from payPeriodStartDay for weekly OT
    notes?: string | null; // markdown-supported organization notes
    venues: string[];
    positions: OrganizationPosition[];
    createdAt: string; // ISO 8601
};

/** TagHistory tracks all unique tags ever used */
export type TagHistory = {
    tag: string;
    count: number; // tracks usage frequency
    lastUsedAt: string; // ISO 8601 timestamp
};

/** PositionHistory tracks positions per organization */
export type PositionHistory = {
    position: string;
    organizationId: Id;
    count: number; // tracks usage frequency
    lastUsedAt: string; // ISO 8601 timestamp
};

/** VenueHistory tracks venue names per organization */
export type VenueHistory = {
    venueName: string;
    organizationId: Id;
    count: number; // tracks usage frequency
    lastUsedAt: string; // ISO 8601 timestamp
};

/**
 * Pay Rule types: polymorphic rule definition for overtime, penalties, and multipliers
 * Policy: Only one OT rule type (daily XOR weekly) allowed per active ruleset
 */

/** Daily Overtime Rule: hours over daily threshold apply multiplier */
export type DailyOvertimeRule = {
    ruleId: Id;
    type: "daily-overtime";
    description?: string; // user-authored label for UI and summary lines
    dailyThresholdHours: number; // e.g., 8
    multiplier: number; // e.g., 1.5 for time-and-a-half
};

/** Weekly Overtime Rule: hours over weekly threshold apply multiplier */
export type WeeklyOvertimeRule = {
    ruleId: Id;
    type: "weekly-overtime";
    description?: string; // user-authored label for UI and summary lines
    weeklyThresholdHours: number; // e.g., 40
    multiplier: number; // e.g., 1.5 for time-and-a-half
};

/** Meal Penalty Rule: flat fee applied per mealPenaltyCount on an entry when manually triggered */
export type MealPenaltyRule = {
    ruleId: Id;
    type: "meal-penalty";
    description?: string; // user-authored label for UI and summary lines
    penaltyAmount: number; // flat fee per triggered penalty (× entry.mealPenaltyCount)
};

/** Holiday Rate Rule: multiplier applied to all hours worked on specified holiday dates */
export type HolidayRateRule = {
    ruleId: Id;
    type: "holiday-rate";
    description?: string; // user-authored label for UI and summary lines
    holidayDates: string[]; // YYYY-MM-DD dates that are recognized as holidays
    multiplier: number; // e.g., 2.0 for double time on holidays
};

/** Time Window Multiplier Rule: multiplier applied to hours within a specified time window */
export type TimeWindowMultiplierRule = {
    ruleId: Id;
    type: "time-window-multiplier";
    description?: string; // user-authored label for UI and summary lines
    windowStart: string; // HH:mm; start of the premium window
    windowEnd: string; // HH:mm; end of the window; if windowEnd <= windowStart, wraps overnight
    multiplier: number; // e.g., 1.25 for hours within the window
};

/** Custom Rule: structured DSL for scoped conditions and payouts */
export type CustomRule = {
    ruleId: Id;
    type: "custom";
    description?: string; // user-authored label for UI and summary lines
    scope: "position" | "tag" | "date-range" | "event"; // dimension the rule applies to
    condition: Record<string, unknown>; // Predefined DSL blocks: e.g., { mode: "OR", matches: ["meal", "catering"] }
    payout: Record<string, unknown>; // Predefined DSL blocks: e.g., { type: "multiplier", value: 1.25 } or { type: "flat-fee", value: 50 }
};

/** Union of all rule types */
export type Rule =
    | DailyOvertimeRule
    | WeeklyOvertimeRule
    | MealPenaltyRule
    | HolidayRateRule
    | TimeWindowMultiplierRule
    | CustomRule;

/** Ruleset: effective-dated, immutable collection of rules for an organization */
export type Ruleset = {
    rulesetId: Id;
    organizationId: Id;
    effectiveDate: string; // YYYY-MM-DD; first date this ruleset applies
    rules: Rule[]; // Policy: at most one daily-overtime OR one weekly-overtime rule per ruleset
    createdAt: string; // ISO 8601; immutable
};

/**
 * Error categories for DAL operations
 */
export type DalError =
    | {
          type: "validation";
          message: string;
          field?: string;
      }
    | {
          type: "notFound";
          entityType: string;
          id: Id;
      }
    | {
          type: "conflict";
          message: string;
      }
    | {
          type: "io";
          message: string;
          cause?: Error;
      }
    | {
          type: "transaction";
          message: string;
          attempted: string;
      };

/**
 * Result type for DAL operations
 */
export type Result<T> =
    | { success: true; data: T }
    | { success: false; error: DalError };

// Helpers
export const ok = <T>(data: T): Result<T> => ({ success: true, data });
export const err = (error: DalError): Result<never> => ({
    success: false,
    error,
});
export const isOk = <T>(
    result: Result<T>,
): result is { success: true; data: T } => result.success;
