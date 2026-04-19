import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaySummary } from "../PaySummary";
import { makeOrganization, testId } from "../../../test-utils/fixtures";
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

const selectPeriod = vi.fn();
const calculateGrossPay = vi.fn<CalculateGrossPay>();
const calculateByEmployerForPeriod = vi.fn<CalculateByEmployerForPeriod>();

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

const getExpectedThisWeek = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - dayOfWeek);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    return {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
    };
};

const store: any = {
    organizations: [
        makeOrganization({ name: "Org A" }),
        makeOrganization({ name: "Org B" }),
    ],
    selectedPeriod: null,
    selectPeriod,
    entries: [],
};

vi.mock("../../hooks", () => ({
    useFreelanceTracker: () => store,
    useGrossPayCalculation: () => ({
        calculateGrossPay,
    }),
    useEmployerPeriodAggregation: () => ({
        calculateByEmployerForPeriod,
    }),
}));

describe("PaySummary integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-04-14T12:00:00.000Z"));
        store.selectedPeriod = {
            startDate: "2026-04-13",
            endDate: "2026-04-19",
        };
        store.entries = [];
        calculateGrossPay.mockResolvedValue({
            success: true,
            data: {
                totalPay: 180,
                totalHours: 6,
                entriesWithoutRate: 1,
                breakdown: [
                    { entryId: testId("entry"), hours: 2, rate: 30, pay: 60 },
                ],
                cumulativePay: 220,
                ruleLines: [],
                rulePremiumAmount: 0,
                totalWithPremiums: 180,
                ruleWarnings: [],
            },
        });
        calculateByEmployerForPeriod.mockResolvedValue({
            success: true,
            data: [
                {
                    organizationId: store.organizations[0].organizationId,
                    employerName: store.organizations[0].name,
                    hours: 6,
                    earnings: 180,
                    entryCount: 1,
                },
                {
                    organizationId: store.organizations[1].organizationId,
                    employerName: store.organizations[1].name,
                    hours: 4,
                    earnings: 160,
                    entryCount: 1,
                },
            ],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("defaults the summary selector to This Month and calculates from local state", async () => {
        render(<PaySummary />);

        const periodGroup = screen.getByRole("group", {
            name: /summary period/i,
        });

        expect(
            within(periodGroup).getByRole("button", { name: /this month/i }),
        ).toHaveClass("period-selector__button--active");

        await waitFor(() => {
            expect(calculateGrossPay).toHaveBeenCalledTimes(
                store.organizations.length,
            );
            expect(calculateGrossPay).toHaveBeenCalledWith(
                store.organizations[0].organizationId,
                getExpectedThisMonth(),
            );
            expect(calculateGrossPay).toHaveBeenCalledWith(
                store.organizations[1].organizationId,
                getExpectedThisMonth(),
            );
        });

        expect(selectPeriod).not.toHaveBeenCalled();
    });

    it("renders KPI cards from gross pay calculation", async () => {
        render(<PaySummary />);

        await waitFor(() => {
            expect(
                screen.getAllByText("$360.00", {
                    selector: ".pay-summary__card-value",
                }).length,
            ).toBeGreaterThan(0);
        });

        expect(
            screen.getByText(/gross pay \(hourly \+ flat fee\)/i),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Hours", {
                selector: ".pay-summary__card-label",
            }),
        ).toBeInTheDocument();
        expect(screen.getByText(/entries/i)).toBeInTheDocument();
        expect(screen.getByText(/unrated hourly/i)).toBeInTheDocument();
        expect(screen.getByText(/total \(all orgs\)/i)).toBeInTheDocument();
        expect(screen.getByText(/employer breakdown/i)).toBeInTheDocument();
    });

    it("renders premium totals on top of flat-fee base pay with 2-decimal formatting", async () => {
        const user = userEvent.setup();
        calculateGrossPay.mockResolvedValue({
            success: true,
            data: {
                totalPay: 300,
                totalHours: 10,
                entriesWithoutRate: 0,
                breakdown: [
                    { entryId: testId("entry"), hours: 10, rate: 30, pay: 300 },
                ],
                cumulativePay: 300,
                ruleLines: [
                    {
                        ruleId: testId("rule"),
                        ruleType: "DailyOT",
                        ruleLabel: "Daily OT 1.5x",
                        role: "overtime",
                        totalPremiumHours: 2,
                        totalBasePay: 300,
                        totalPremiumAmount: 30.5,
                        unratedEntryCount: 0,
                        warnings: [],
                    },
                ],
                rulePremiumAmount: 30.5,
                totalWithPremiums: 330.5,
                ruleWarnings: [],
            },
        });

        render(<PaySummary />);

        await user.click(screen.getByLabelText(/filter by organization/i));

        await waitFor(() => {
            expect(screen.getByText("$330.50")).toBeInTheDocument();
        });

        expect(screen.getByText(/with premiums/i)).toBeInTheDocument();
        expect(screen.getByText("+$30.50")).toBeInTheDocument();
        expect(screen.getByText("2.00h")).toBeInTheDocument();
    });

    it("aggregates chart data for the selected period and supports metric toggle", async () => {
        const user = userEvent.setup();
        render(<PaySummary />);

        await waitFor(() => {
            expect(calculateByEmployerForPeriod).toHaveBeenCalledWith(
                store.organizations,
                getExpectedThisMonth(),
            );
        });

        const legend = screen.getByRole("list", { name: /employer values/i });
        expect(within(legend).getByText("Org A")).toBeInTheDocument();
        expect(within(legend).getByText("6.0h")).toBeInTheDocument();

        await user.click(screen.getByRole("radio", { name: /earnings/i }));

        expect(within(legend).getByText("$180.00")).toBeInTheDocument();
    });

    it("re-aggregates employer chart data when summary period changes", async () => {
        const user = userEvent.setup();
        const thisWeek = getExpectedThisWeek();
        calculateByEmployerForPeriod.mockImplementation(
            async (_orgs, period) => {
                if (
                    period.startDate === thisWeek.startDate &&
                    period.endDate === thisWeek.endDate
                ) {
                    return {
                        success: true,
                        data: [
                            {
                                organizationId:
                                    store.organizations[1].organizationId,
                                employerName: store.organizations[1].name,
                                hours: 2,
                                earnings: 80,
                                entryCount: 1,
                            },
                        ],
                    };
                }

                return {
                    success: true,
                    data: [
                        {
                            organizationId:
                                store.organizations[0].organizationId,
                            employerName: store.organizations[0].name,
                            hours: 6,
                            earnings: 180,
                            entryCount: 1,
                        },
                    ],
                };
            },
        );

        render(<PaySummary />);

        await waitFor(() => {
            expect(
                screen.getByRole("list", { name: /employer values/i }),
            ).toBeInTheDocument();
        });

        expect(
            within(
                screen.getByRole("list", { name: /employer values/i }),
            ).getByText("6.0h"),
        ).toBeInTheDocument();

        const periodGroup = screen.getByRole("group", {
            name: /summary period/i,
        });
        await user.click(
            within(periodGroup).getByRole("button", { name: /this week/i }),
        );

        await waitFor(() => {
            expect(calculateByEmployerForPeriod).toHaveBeenCalledWith(
                store.organizations,
                thisWeek,
            );
        });

        await waitFor(() => {
            expect(
                within(
                    screen.getByRole("list", { name: /employer values/i }),
                ).getByText("2.0h"),
            ).toBeInTheDocument();
        });
    });

    it("shows empty employer chart state when aggregation fails", async () => {
        calculateByEmployerForPeriod.mockResolvedValueOnce({
            success: false,
            error: {
                type: "unknown",
                message: "aggregation failed",
            },
        } as any);

        render(<PaySummary />);

        await waitFor(() => {
            expect(calculateByEmployerForPeriod).toHaveBeenCalled();
        });

        expect(
            screen.getByText(
                /no period entries available for employer breakdown/i,
            ),
        ).toBeInTheDocument();
    });

    it("changes the summary period without mutating the history period state", async () => {
        const user = userEvent.setup();
        render(<PaySummary />);

        await waitFor(() => {
            expect(calculateGrossPay).toHaveBeenCalledTimes(
                store.organizations.length,
            );
        });

        calculateGrossPay.mockClear();

        const periodGroup = screen.getByRole("group", {
            name: /summary period/i,
        });
        await user.click(
            within(periodGroup).getByRole("button", { name: /this week/i }),
        );

        await waitFor(() => {
            expect(calculateGrossPay).toHaveBeenCalledWith(
                store.organizations[0].organizationId,
                getExpectedThisWeek(),
            );
        });

        expect(selectPeriod).not.toHaveBeenCalled();
    });

    it("changes organization from selector", async () => {
        const user = userEvent.setup();
        render(<PaySummary />);

        await waitFor(() => {
            expect(calculateGrossPay).toHaveBeenCalledTimes(
                store.organizations.length,
            );
            expect(calculateGrossPay).toHaveBeenCalledWith(
                store.organizations[0].organizationId,
                getExpectedThisMonth(),
            );
        });

        calculateGrossPay.mockClear();

        await user.click(screen.getByLabelText(/filter by organization/i));

        await user.selectOptions(
            screen.getByRole("combobox", { name: /^organization$/i }),
            store.organizations[1].organizationId,
        );

        await waitFor(() => {
            expect(calculateGrossPay).toHaveBeenCalledWith(
                store.organizations[1].organizationId,
                getExpectedThisMonth(),
            );
        });
    });

    it("shows placeholder when no organization is available", () => {
        store.organizations = [];

        render(<PaySummary />);
        expect(
            screen.getByText(/select an organization and period/i),
        ).toBeInTheDocument();
    });
});
