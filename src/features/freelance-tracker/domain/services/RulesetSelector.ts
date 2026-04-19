/**
 * RulesetSelector
 * Handles effective-dated ruleset selection and single-OT-rule validation
 */

import type {
    Id,
    Ruleset,
    Result,
} from "@/features/freelance-tracker/contracts/types";
import { err, ok } from "@/features/freelance-tracker/contracts/types";
import type { IDataLayer } from "@/features/freelance-tracker/data/dal";

export interface RulesetSelectorDeps {
    dal: IDataLayer;
}

export class RulesetSelector {
    constructor(private deps: RulesetSelectorDeps) {}

    /**
     * Get the active ruleset for an organization on a given date
     * Delegates to DAL which returns ruleset with latest effectiveDate <= the given date
     * Returns null if no ruleset is effective on that date
     */
    async getActiveRulesetForDate(
        organizationId: Id,
        date: string, // YYYY-MM-DD
    ): Promise<Result<Ruleset | null>> {
        return this.deps.dal.rulesets.getActive({
            organizationId,
            onDate: date,
        });
    }

    /**
     * Validate that a ruleset respects the single-OT-rule constraint
     * Policy: at most one daily-overtime OR one weekly-overtime rule per ruleset (not both)
     * Called by DAL IRulesetRepository.create() but exposed here for clarity
     */
    validateSingleOTRule(ruleset: Ruleset): Result<void> {
        let dailyOTCount = 0;
        let weeklyOTCount = 0;

        for (const rule of ruleset.rules) {
            if (rule.type === "daily-overtime") {
                dailyOTCount++;
            } else if (rule.type === "weekly-overtime") {
                weeklyOTCount++;
            }
        }

        if (dailyOTCount > 1) {
            return err({
                type: "validation",
                message: "Ruleset cannot have multiple daily-overtime rules",
                field: "rules",
            });
        }

        if (weeklyOTCount > 1) {
            return err({
                type: "validation",
                message: "Ruleset cannot have multiple weekly-overtime rules",
                field: "rules",
            });
        }

        if (dailyOTCount > 0 && weeklyOTCount > 0) {
            return err({
                type: "validation",
                message:
                    "Ruleset cannot mix daily-overtime and weekly-overtime rules",
                field: "rules",
            });
        }

        return ok(undefined);
    }

    /**
     * List all rulesets for an organization in effective date order
     */
    async listRulesetsForOrg(organizationId: Id): Promise<Result<Ruleset[]>> {
        return this.deps.dal.rulesets.listByOrg(organizationId);
    }

    /**
     * Select the active ruleset for a date from a pre-fetched list (no DAL call).
     * rulesets must be sorted newest-first (effectiveDate DESC) as returned by listByOrg.
     * Returns the first ruleset whose effectiveDate <= date, or null if none applies.
     */
    static selectActiveFromList(
        rulesets: Ruleset[],
        date: string, // YYYY-MM-DD
    ): Ruleset | null {
        for (const ruleset of rulesets) {
            if (ruleset.effectiveDate <= date) {
                return ruleset;
            }
        }
        return null;
    }
}
