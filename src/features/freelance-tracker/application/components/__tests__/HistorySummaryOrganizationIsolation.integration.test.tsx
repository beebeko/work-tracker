import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryHistory } from "../EntryHistory";
import { PaySummary } from "../PaySummary";
import { makeEntry, makeOrganization } from "../../../test-utils/fixtures";
import type { Id, Result } from "../../../contracts/types";
import type { GrossPayResult } from "../../../domain/services/GrossPayCalculator";

type CalculateGrossPay = (
    orgId: Id,
    period: { startDate: string; endDate: string },
) => Promise<Result<GrossPayResult>>;

type CalculateByEmployerForPeriod = (
    organizations: Array<{ organizationId: Id; name: string }>,
    period: { startDate: string; endDate: string },
) => Promise<
    Result<
        Array<{
            organizationId: Id;
            employerName: string;
            hours: number;
            earnings: number;
            entryCount: number;
        }>
    >
>;

const loadEntries = vi.fn();
const selectPeriod = vi.fn((startDate: string, endDate: string) => {
    store.selectedPeriod = { startDate, endDate };
});
const deleteEntry = vi.fn();
const calculateGrossPay = vi.fn<CalculateGrossPay>();
const calculateByEmployerForPeriod = vi.fn<CalculateByEmployerForPeriod>();

const organizations = [
    makeOrganization({ name: "Org A" }),
    makeOrganization({ name: "Org B" }),
];

const getExpectedThisMonth = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
        startDate: new Date(today.getFullYear(), today.getMonth(), 1)
            .toISOString()
            .split("T")[0],
        endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0)
            .toISOString()
            .split("T")[0],
    };
};

const store: any = {
    organizations,
    selectedPeriod: getExpectedThisMonth(),
    entries: [
        makeEntry({
            organizationId: organizations[0].organizationId,
            position: "Audio",
            dateWorked: "2026-04-14",
            tags: ["festival"],
            rate: 20,
        }),
    ],
    loadEntries,
    selectPeriod,
    deleteEntry,
};

vi.mock("../../hooks", () => ({
    useFreelanceTracker: () => store,
    useGrossPayCalculation: () => ({ calculateGrossPay }),
    useEmployerPeriodAggregation: () => ({ calculateByEmployerForPeriod }),
}));

describe("History/Summary organization filter isolation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-04-14T12:00:00.000Z"));
        store.organizations = organizations;
        store.selectedPeriod = getExpectedThisMonth();
        store.entries = [
            makeEntry({
                organizationId: organizations[0].organizationId,
                position: "Audio",
                dateWorked: "2026-04-14",
                tags: ["festival"],
                rate: 20,
            }),
        ];

        calculateGrossPay.mockResolvedValue({
            success: true,
            data: {
                totalPay: 180,
                totalHours: 6,
                entriesWithoutRate: 0,
                breakdown: [],
                cumulativePay: 220,
                ruleLines: [],
                rulePremiumAmount: 0,
                totalWithPremiums: 180,
                ruleWarnings: [],
            },
        });
        calculateByEmployerForPeriod.mockResolvedValue({
            success: true,
            data: [],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("keeps history and summary organization filters locally scoped", async () => {
        const user = userEvent.setup();
        const { container } = render(
            <>
                <EntryHistory />
                <PaySummary />
            </>,
        );

        await waitFor(() => {
            expect(calculateGrossPay).toHaveBeenCalledWith(
                organizations[0].organizationId,
                getExpectedThisMonth(),
            );
            expect(calculateGrossPay).toHaveBeenCalledWith(
                organizations[1].organizationId,
                getExpectedThisMonth(),
            );
        });

        const historySelect = container.querySelector(
            "#entry-history-organization-filter",
        ) as HTMLSelectElement;
        const summarySelect = container.querySelector(
            "#summary-organization-filter",
        ) as HTMLSelectElement;
        const historyToggle = container.querySelector(
            "#entry-history-filter-by-org",
        ) as HTMLInputElement;
        const summaryToggle = container.querySelector(
            "#pay-summary-filter-by-org",
        ) as HTMLInputElement;

        expect(historySelect.value).toBe("");
        expect(summarySelect.value).toBe("");
        expect(historySelect).toBeDisabled();
        expect(summarySelect).toBeDisabled();

        calculateGrossPay.mockClear();

        await user.click(historyToggle);

        await waitFor(() => {
            expect(historySelect).toHaveValue(organizations[0].organizationId);
            expect(historySelect).not.toBeDisabled();
            expect(loadEntries).toHaveBeenCalledWith(
                organizations[0].organizationId,
                getExpectedThisMonth(),
            );
        });

        expect(summarySelect.value).toBe("");
        expect(summarySelect).toBeDisabled();

        await user.selectOptions(
            historySelect,
            organizations[1].organizationId,
        );

        expect(historySelect.value).toBe(organizations[1].organizationId);
        expect(summarySelect.value).toBe("");
        expect(loadEntries).toHaveBeenCalledWith(
            organizations[1].organizationId,
            getExpectedThisMonth(),
        );
        expect(calculateGrossPay).not.toHaveBeenCalled();

        await user.click(summaryToggle);

        await waitFor(() => {
            expect(summarySelect).toHaveValue(organizations[0].organizationId);
            expect(summarySelect).not.toBeDisabled();
            expect(calculateGrossPay).toHaveBeenCalledWith(
                organizations[0].organizationId,
                getExpectedThisMonth(),
            );
        });

        calculateGrossPay.mockClear();

        await user.selectOptions(
            summarySelect,
            organizations[1].organizationId,
        );

        await waitFor(() => {
            expect(calculateGrossPay).toHaveBeenCalledWith(
                organizations[1].organizationId,
                getExpectedThisMonth(),
            );
        });

        calculateGrossPay.mockClear();

        await user.selectOptions(
            historySelect,
            organizations[0].organizationId,
        );

        expect(historySelect.value).toBe(organizations[0].organizationId);
        expect(summarySelect.value).toBe(organizations[1].organizationId);
        expect(calculateGrossPay).not.toHaveBeenCalled();
    });
});
