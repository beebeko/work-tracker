---
description: 'Use when creating or editing pay calculation code, overtime rules, meal penalty logic, or work entry processing. Covers per-client OT rule structure, weekly hour accumulation across positions, meal penalty windows, and lump-sum handling.'
applyTo: 'src/pay/**'
---

# Pay Engine Guidelines

## Core rules

- **OT is calculated across all positions in a week**, not per-position. Hours are accumulated chronologically regardless of which position produced them.
- **Week boundary** defaults to Monday 00:00 local time. This is configurable per client (`overtimeRules.weekStartDay`).
- **OT rules are per-client** and can be overridden per position. Always resolve the effective rule set before calculating: position override → client default.
- **Lump-sum entries** are pass-through — they do not contribute to or consume the weekly hourly OT pool.

## OvertimeRules shape

```ts
interface OvertimeRules {
  weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun, 1=Mon
  weeklyThresholdHours: number; // default 40
  weeklyOvertimeMultiplier: number; // default 1.5
  dailyThresholdHours?: number; // optional, e.g. 8
  dailyOvertimeMultiplier?: number; // required if dailyThresholdHours set
  mealPenaltyEnabled: boolean;
  mealPenaltyWindowHours: number; // default 7 — penalty if no break in this window
  mealPenaltyRateHours: number; // default 1 — penalty added as N hours at base rate
}
```

## Calculation algorithm

1. **Group entries by week** (using effective `weekStartDay`).
2. **Within a week**, sort all shift entries chronologically.
3. **Accumulate hours** sequentially across the sorted entries, tracking running total.
4. **Classify each hour** as regular or overtime (weekly OT) based on the running total vs. `weeklyThresholdHours`. If daily OT rules exist, apply daily classification first, then weekly.
5. **Calculate meal penalties** per entry: if elapsed time between shift start and first break (or shift end if no break) exceeds `mealPenaltyWindowHours`, add `mealPenaltyRateHours * baseRate` to the entry total.
6. **Lump-sum entries** are added directly to the week total without classification.

## Pure functions only

- All pay calculation functions must be pure: same input → same output, no side effects.
- Accept `OvertimeRules` as an explicit parameter — never read from global state.
- Return a `PayBreakdown` object:
  ```ts
  interface PayBreakdown {
    regularHours: number;
    regularPay: number;
    overtimeHours: number;
    overtimePay: number;
    mealPenalties: number;
    lumpSum: number;
    totalPay: number;
  }
  ```

## Test coverage requirement: 95%

Test all OT boundary conditions, daily vs. weekly OT interaction, meal penalty trigger and non-trigger, lump-sum coexistence, multi-position weeks, and week-spanning entries.
