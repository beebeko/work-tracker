/**
 * PayPeriodService
 * Calculates pay period boundaries for any given date based on organization configuration
 */

import type {
    Id,
    Organization,
    Result,
} from "@/features/freelance-tracker/contracts/types";
import { err, ok } from "@/features/freelance-tracker/contracts/types";
import type { IDataLayer } from "@/features/freelance-tracker/data/dal";

/**
 * Helper to parse YYYY-MM-DD strings to Date (at midnight UTC)
 */
function parseDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Helper to format Date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 */
function getDayOfWeek(date: Date): number {
    return date.getUTCDay();
}

/**
 * Convert ISO day (1=Monday, 7=Sunday) to JS day (0=Sunday, 1=Monday, ..., 6=Saturday)
 */
function isoDayToJsDay(isoDay: number): number {
    return isoDay % 7; // 1->1, 2->2, ..., 6->6, 7->0
}

export interface PayPeriodServiceDeps {
    dal: IDataLayer;
}

export class PayPeriodService {
    constructor(private deps: PayPeriodServiceDeps) {}

    /**
     * Calculate the pay period for any given date
     * Returns the start and end date of the pay period containing that date
     */
    async calculatePayPeriodForDate(
        date: string,
        organizationId: Id,
    ): Promise<Result<{ startDate: string; endDate: string }>> {
        // Get organization to read payPeriodStartDay
        const orgResult = await this.deps.dal.organizations.get(organizationId);
        if (!orgResult.success) {
            return orgResult;
        }

        const org: Organization = orgResult.data;
        const payPeriodStartDay = org.payPeriodStartDay; // 1=Monday, 7=Sunday

        // Parse the input date
        const parsedDate = parseDate(date);
        const jsStartDay = isoDayToJsDay(payPeriodStartDay);

        // Find the most recent "start of period" on or before the given date
        const currentDay = getDayOfWeek(parsedDate);
        let daysAgo = currentDay - jsStartDay;

        // If current day is before the period start day, go back to last week's start
        if (daysAgo < 0) {
            daysAgo += 7;
        }

        // Calculate start date of the period
        const startDate = new Date(parsedDate);
        startDate.setUTCDate(startDate.getUTCDate() - daysAgo);

        // Calculate end date (last day before next period starts)
        const endDate = new Date(startDate);
        endDate.setUTCDate(endDate.getUTCDate() + 6); // 6 days after start = end of week

        return ok({
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
        });
    }
}
