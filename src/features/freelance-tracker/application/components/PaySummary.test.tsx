/**
 * Tests for PaySummary component
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaySummary } from "./PaySummary";

const mockUseFreelanceTracker = vi.hoisted(() => vi.fn());
const mockUsePayPeriod = vi.hoisted(() => vi.fn());
const mockUseGrossPayCalculation = vi.hoisted(() => vi.fn());
const mockUseEmployerPeriodAggregation = vi.hoisted(() => vi.fn());
const mockCalculateGrossPay = vi.hoisted(() => vi.fn());
const mockCalculateByEmployerForPeriod = vi.hoisted(() => vi.fn());

// Mock the hooks
vi.mock("../hooks", () => {
    return {
        useFreelanceTracker: mockUseFreelanceTracker,
        usePayPeriod: mockUsePayPeriod,
        useGrossPayCalculation: mockUseGrossPayCalculation,
        useEmployerPeriodAggregation: mockUseEmployerPeriodAggregation,
    };
});

describe("PaySummary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCalculateGrossPay.mockResolvedValue({
            success: true,
            data: {
                totalPay: 1500.5,
                entriesWithoutRate: 2,
                totalHours: 40,
                breakdown: [
                    {
                        entryId: "entry-1",
                        hours: 8,
                        rate: 150,
                        pay: 1200,
                    },
                    {
                        entryId: "entry-2",
                        hours: 5,
                        rate: null,
                        pay: null,
                    },
                ],
                cumulativePay: 2000,
                ruleLines: [],
                rulePremiumAmount: 0,
                totalWithPremiums: 1500.5,
                ruleWarnings: [],
            },
        });
        mockCalculateByEmployerForPeriod.mockResolvedValue({
            success: true,
            data: [
                {
                    organizationId: "org-test-1",
                    employerName: "Test Org",
                    hours: 13,
                    earnings: 1200,
                    entryCount: 2,
                },
            ],
        });
        mockUseFreelanceTracker.mockReturnValue({
            organizations: [
                {
                    organizationId: "org-test-1",
                    name: "Test Org",
                    payPeriodStartDay: 1,
                    createdAt: new Date().toISOString(),
                },
            ],
            entries: [],
        });
        mockUsePayPeriod.mockReturnValue({
            selectedPeriod: {
                startDate: "2026-04-13",
                endDate: "2026-04-19",
            },
            calculatePayPeriodForToday: vi.fn(),
            setCustomPeriod: vi.fn(),
            getPeriodLabel: () => "Apr 13 – Apr 19, 2026",
        });
        mockUseGrossPayCalculation.mockReturnValue({
            calculateGrossPay: mockCalculateGrossPay,
        });
        mockUseEmployerPeriodAggregation.mockReturnValue({
            calculateByEmployerForPeriod: mockCalculateByEmployerForPeriod,
        });
    });

    it("renders local summary helper text", async () => {
        render(<PaySummary />);

        await screen.findByText(/gross pay/i);
        expect(
            screen.getByText(/totals across all organizations/i),
        ).toBeInTheDocument();
    });

    it("renders period preset buttons", async () => {
        render(<PaySummary />);

        await screen.findByText(/gross pay/i);
        expect(
            screen.getByRole("button", { name: /this week/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /this month/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /custom/i }),
        ).toBeInTheDocument();
    });

    it("displays KPI cards when data is loaded", async () => {
        render(<PaySummary />);

        await waitFor(() => {
            expect(
                screen.getAllByText(/\$\s*1500\.50/, {
                    selector: ".pay-summary__card-value",
                }).length,
            ).toBeGreaterThan(0);
            expect(screen.getByText("40.0")).toBeInTheDocument();
            const entriesLabel = screen.getByText("Entries");
            const entriesCard = entriesLabel.closest(".pay-summary__card");
            expect(entriesCard).not.toBeNull();
            expect(
                within(entriesCard as HTMLElement).getByText("2"),
            ).toBeInTheDocument();
        });
    });

    it("displays card labels correctly", async () => {
        render(<PaySummary />);

        await waitFor(() => {
            expect(
                screen.getByText(/gross pay/i, {
                    selector: ".pay-summary__card-label",
                }),
            ).toBeInTheDocument();
            expect(
                screen.getByText("Hours", {
                    selector: ".pay-summary__card-label",
                }),
            ).toBeInTheDocument();
            expect(
                screen.getByText("Entries", {
                    selector: ".pay-summary__card-label",
                }),
            ).toBeInTheDocument();
        });
    });

    it("shows unrated entries count when > 0", async () => {
        render(<PaySummary />);

        await waitFor(() => {
            expect(screen.getByText("Unrated Hourly")).toBeInTheDocument();
        });
    });

    it("shows cumulative pay when > 0 (filtered mode)", async () => {
        const user = userEvent.setup();
        render(<PaySummary />);

        // Enable single-org filtered mode to access cumulativePay
        const checkbox = screen.getByLabelText(/filter by organization/i);
        await user.click(checkbox);

        await waitFor(() => {
            expect(screen.getByText("Total (All Orgs)")).toBeInTheDocument();
            expect(screen.getByText("$2000.00")).toBeInTheDocument();
        });
    });

    it("allows selecting preset period", async () => {
        const user = userEvent.setup();
        render(<PaySummary />);

        const thisWeekBtn = screen.getByRole("button", { name: /this week/i });
        const thisMonthBtn = screen.getByRole("button", {
            name: /this month/i,
        });

        expect(thisWeekBtn).not.toHaveClass("period-selector__button--active");
        expect(thisMonthBtn).toHaveClass("period-selector__button--active");

        await user.click(thisMonthBtn);

        await waitFor(() => {
            expect(thisMonthBtn).toHaveClass("period-selector__button--active");
        });
    });

    it("shows custom date inputs when custom preset is selected", async () => {
        const user = userEvent.setup();
        render(<PaySummary />);

        const customBtn = screen.getByRole("button", { name: /custom/i });
        await user.click(customBtn);

        const dateInputs = screen.getAllByLabelText(/start|end/i);
        expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    });

    it("displays period label", async () => {
        render(<PaySummary />);

        await waitFor(() => {
            expect(screen.getByText(/apr/i)).toBeInTheDocument();
        });
    });

    it("shows placeholder when no organization selected", async () => {
        mockUseFreelanceTracker.mockReturnValue({
            organizations: [],
            entries: [],
        } as any);

        render(<PaySummary />);
        await waitFor(() => {
            expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
        });
        expect(
            screen.getByText(/select an organization and period/i),
        ).toBeInTheDocument();
    });

    it("defaults to all-organizations mode with checkbox unchecked", async () => {
        render(<PaySummary />);
        await screen.findByText(/gross pay/i);
        const checkbox = screen.getByLabelText(/filter by organization/i);
        expect(checkbox).not.toBeChecked();
        expect(screen.getByLabelText("Organization")).toBeDisabled();
    });

    it("enables org picker when filter checkbox is checked", async () => {
        const user = userEvent.setup();
        render(<PaySummary />);
        const checkbox = screen.getByLabelText(/filter by organization/i);
        await user.click(checkbox);
        expect(checkbox).toBeChecked();
        await waitFor(() => {
            expect(screen.getByLabelText("Organization")).not.toBeDisabled();
        });
    });

    it("returns to all-orgs mode when checkbox is unchecked", async () => {
        const user = userEvent.setup();
        render(<PaySummary />);
        const checkbox = screen.getByLabelText(/filter by organization/i);
        await user.click(checkbox);
        expect(checkbox).toBeChecked();
        await user.click(checkbox);
        expect(checkbox).not.toBeChecked();
        expect(screen.getByLabelText("Organization")).toBeDisabled();
    });

    it("shows 'All organizations' option and totals help text in default mode", async () => {
        render(<PaySummary />);
        expect(
            screen.getByRole("option", { name: "All organizations" }),
        ).toBeInTheDocument();
        await screen.findByText(/totals across all organizations/i);
    });

    it("uses a local organization filter to recalculate summary totals", async () => {
        const user = userEvent.setup();

        mockUseFreelanceTracker.mockReturnValue({
            organizations: [
                {
                    organizationId: "org-test-1",
                    name: "Test Org",
                    payPeriodStartDay: 1,
                    createdAt: new Date().toISOString(),
                },
                {
                    organizationId: "org-test-2",
                    name: "Second Org",
                    payPeriodStartDay: 1,
                    createdAt: new Date().toISOString(),
                },
            ],
            entries: [],
        });

        render(<PaySummary />);

        await waitFor(() => {
            expect(mockCalculateGrossPay).toHaveBeenCalledWith(
                "org-test-1",
                expect.any(Object),
            );
        });

        // Enable the org filter first
        const checkbox = screen.getByLabelText(/filter by organization/i);
        await user.click(checkbox);

        await waitFor(() => {
            expect(screen.getByLabelText("Organization")).not.toBeDisabled();
        });

        await user.selectOptions(
            screen.getByLabelText("Organization"),
            "org-test-2",
        );

        await waitFor(() => {
            expect(mockCalculateGrossPay).toHaveBeenCalledWith(
                "org-test-2",
                expect.any(Object),
            );
        });
    });

    it("supports toggling employer chart metric", async () => {
        const user = userEvent.setup();
        render(<PaySummary />);

        const hoursRadio = await screen.findByRole("radio", {
            name: /hours/i,
        });
        const earningsRadio = screen.getByRole("radio", {
            name: /earnings/i,
        });
        const legend = screen.getByRole("list", { name: /employer values/i });

        expect(hoursRadio).toBeChecked();
        expect(within(legend).getByText("13.0h")).toBeInTheDocument();

        await user.click(earningsRadio);

        expect(earningsRadio).toBeChecked();
        expect(within(legend).getByText("$1200.00")).toBeInTheDocument();
    });
});
