import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RulesetEditor } from "./RulesetEditor";
import type { Rule } from "@/features/freelance-tracker/contracts/types";

const mockUseFreelanceTracker = vi.hoisted(() => vi.fn());

const createStore = () => ({
    organizations: [
        {
            organizationId: "org-1",
            name: "Alpha Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: null,
            venues: [],
            positions: [],
            rulesetIds: ["ruleset-1"],
            createdAt: "2025-12-01T00:00:00.000Z",
        },
    ],
    rulesets: [
        {
            rulesetId: "ruleset-1",
            organizationId: "org-1",
            effectiveDate: "2026-01-01",
            rules: [
                {
                    ruleId: "daily-ot-rule",
                    type: "daily-overtime",
                    description: "Daily OT",
                    dailyThresholdHours: 8,
                    multiplier: 1.5,
                },
                {
                    ruleId: "meal-rule",
                    type: "meal-penalty",
                    description: "Meal premium",
                    penaltyAmount: 25,
                },
                {
                    ruleId: "holiday-rule",
                    type: "holiday-rate",
                    description: "Holidays",
                    holidayDates: ["2026-01-01", "2026-07-04"],
                    multiplier: 2,
                },
                {
                    ruleId: "window-rule",
                    type: "time-window-multiplier",
                    description: "Late night",
                    windowStart: "22:00",
                    windowEnd: "06:00",
                    multiplier: 1.25,
                },
                {
                    ruleId: "custom-rule",
                    type: "custom",
                    description: "Tag premium",
                    scope: "tag",
                    condition: { mode: "OR", matches: ["rush"] },
                    payout: { type: "multiplier", value: 1.1 },
                },
            ] satisfies Rule[],
            createdAt: "2025-12-01T00:00:00.000Z",
        },
    ],
    sharedRulesets: [
        {
            rulesetId: "ruleset-1",
            effectiveDate: "2026-01-01",
            rules: [
                {
                    ruleId: "daily-ot-rule",
                    type: "daily-overtime",
                    description: "Daily OT",
                    dailyThresholdHours: 8,
                    multiplier: 1.5,
                },
            ] satisfies Rule[],
            createdAt: "2025-12-01T00:00:00.000Z",
        },
        {
            rulesetId: "ruleset-2",
            effectiveDate: "2026-02-01",
            rules: [
                {
                    ruleId: "meal-rule-2",
                    type: "meal-penalty",
                    description: "Meal",
                    penaltyAmount: 20,
                },
            ] satisfies Rule[],
            createdAt: "2025-12-02T00:00:00.000Z",
        },
    ],
    loadRulesets: vi.fn().mockResolvedValue(undefined),
    loadSharedRulesets: vi.fn().mockResolvedValue(undefined),
    getSharedRulesetAssignmentSummary: vi.fn(() => [
        {
            ruleset: {
                rulesetId: "ruleset-1",
                effectiveDate: "2026-01-01",
                rules: [
                    {
                        ruleId: "daily-ot-rule",
                        type: "daily-overtime",
                        description: "Daily OT",
                        dailyThresholdHours: 8,
                        multiplier: 1.5,
                    },
                ] satisfies Rule[],
                createdAt: "2025-12-01T00:00:00.000Z",
            },
            assignedOrganizationIds: ["org-1"],
            assignedOrganizationCount: 1,
            isAssigned: true,
        },
        {
            ruleset: {
                rulesetId: "ruleset-2",
                effectiveDate: "2026-02-01",
                rules: [
                    {
                        ruleId: "meal-rule-2",
                        type: "meal-penalty",
                        description: "Meal",
                        penaltyAmount: 20,
                    },
                ] satisfies Rule[],
                createdAt: "2025-12-02T00:00:00.000Z",
            },
            assignedOrganizationIds: [],
            assignedOrganizationCount: 0,
            isAssigned: false,
        },
    ]),
    createRuleset: vi.fn().mockResolvedValue({
        success: true,
        data: {
            rulesetId: "ruleset-created",
            organizationId: "org-1",
            effectiveDate: "2026-01-15",
            rules: [],
            createdAt: "2026-01-15T00:00:00.000Z",
        },
    }),
    deleteRuleset: vi
        .fn()
        .mockResolvedValue({ success: true, data: undefined }),
});

let mockStore = createStore();

vi.mock("../hooks", () => ({
    useFreelanceTracker: mockUseFreelanceTracker.mockImplementation(
        () => mockStore,
    ),
}));

describe("RulesetEditor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStore = createStore();
        mockUseFreelanceTracker.mockImplementation(() => mockStore);
    });

    it("prefills edit form from an existing ruleset across supported rule types", async () => {
        const user = userEvent.setup();
        render(<RulesetEditor organizationId={"org-1" as any} />);

        expect(mockStore.loadRulesets).toHaveBeenCalledWith("org-1");

        await user.click(screen.getByTestId("ruleset-card"));

        expect(
            screen.getByRole("heading", { name: "Edit Ruleset" }),
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Ruleset effective date")).toHaveValue(
            "2026-01-01",
        );
        expect(screen.getByLabelText("Daily threshold hours")).toHaveValue(8);
        expect(screen.getByLabelText("Overtime multiplier")).toHaveValue(1.5);
        expect(screen.getByLabelText("Meal penalty amount")).toHaveValue(25);
        expect(screen.getByLabelText("Holiday rate multiplier")).toHaveValue(2);
        expect(screen.getByLabelText("Time window start")).toHaveValue("22:00");
        expect(screen.getByLabelText("Time window end")).toHaveValue("06:00");
        expect(screen.getByLabelText("Time window multiplier")).toHaveValue(
            1.25,
        );
        expect(screen.getByLabelText("Custom rule scope")).toHaveValue("tag");
        expect(screen.getByLabelText("Custom rule matches value")).toHaveValue(
            "rush",
        );
        expect(screen.getByLabelText("Custom rule payout type")).toHaveValue(
            "multiplier",
        );
        expect(
            screen.getByLabelText("Custom rule multiplier value"),
        ).toHaveValue(1.1);
        expect(screen.getByText("2026-01-01")).toBeInTheDocument();
        expect(screen.getByText("2026-07-04")).toBeInTheDocument();
        expect(screen.getByDisplayValue(/"matches": \[/)).toBeInTheDocument();
        expect(
            screen.getByDisplayValue(/"type": "multiplier"/),
        ).toBeInTheDocument();
    });

    it("enforces single overtime mode by replacing daily with weekly on mode switch", async () => {
        const user = userEvent.setup();
        mockStore.rulesets = [];

        render(<RulesetEditor organizationId={"org-1" as any} />);

        await user.click(screen.getByRole("button", { name: "+ New Ruleset" }));
        await user.click(screen.getByRole("button", { name: "Daily OT" }));
        await user.clear(screen.getByLabelText("Overtime multiplier"));
        await user.type(screen.getByLabelText("Overtime multiplier"), "1.75");

        expect(
            screen.getByLabelText("Daily threshold hours"),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Weekly OT" }));

        expect(
            screen.queryByLabelText("Daily threshold hours"),
        ).not.toBeInTheDocument();
        expect(
            screen.getByLabelText("Weekly threshold hours"),
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Overtime multiplier")).toHaveValue(1.75);

        await user.click(screen.getByRole("button", { name: "Save Ruleset" }));

        await waitFor(() => {
            expect(mockStore.createRuleset).toHaveBeenCalledTimes(1);
        });

        const payload = mockStore.createRuleset.mock.calls[0][0];
        const overtimeRules = payload.rules.filter(
            (rule: Rule) =>
                rule.type === "daily-overtime" ||
                rule.type === "weekly-overtime",
        );

        expect(overtimeRules).toHaveLength(1);
        expect(overtimeRules[0].type).toBe("weekly-overtime");
    });

    it("adds and removes holiday date chips", async () => {
        const user = userEvent.setup();
        mockStore.rulesets = [];
        render(<RulesetEditor organizationId={"org-1" as any} />);

        await user.click(screen.getByRole("button", { name: "+ New Ruleset" }));
        await user.click(
            screen.getByRole("button", { name: "+ Holiday Rate" }),
        );

        const holidayDateInput = screen.getByLabelText("Holiday date");
        await user.type(holidayDateInput, "2026-12-25");
        await user.click(screen.getByRole("button", { name: "Add date" }));

        expect(screen.getByText("2026-12-25")).toBeInTheDocument();

        await user.type(screen.getByLabelText("Holiday date"), "2026-12-25");
        await user.click(screen.getByRole("button", { name: "Add date" }));
        expect(screen.getAllByText("2026-12-25")).toHaveLength(1);

        await user.type(screen.getByLabelText("Holiday date"), "2026-12-31");
        await user.click(screen.getByRole("button", { name: "Add date" }));
        expect(screen.getByText("2026-12-31")).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", {
                name: "Remove holiday date 2026-12-25",
            }),
        );

        expect(screen.queryByText("2026-12-25")).not.toBeInTheDocument();
        expect(screen.getByText("2026-12-31")).toBeInTheDocument();
    });

    it("serializes guided custom scope and multiplier controls to evaluator-compatible payload", async () => {
        const user = userEvent.setup();
        mockStore.rulesets = [];

        render(<RulesetEditor organizationId={"org-1" as any} />);

        await user.click(screen.getByRole("button", { name: "+ New Ruleset" }));
        await user.click(screen.getByRole("button", { name: "+ Custom" }));

        await user.selectOptions(
            screen.getByLabelText("Custom rule scope"),
            "event",
        );
        await user.type(
            screen.getByLabelText("Custom rule matches value"),
            "Wedding",
        );
        await user.clear(screen.getByLabelText("Custom rule multiplier value"));
        await user.type(
            screen.getByLabelText("Custom rule multiplier value"),
            "1.75",
        );

        await user.click(screen.getByRole("button", { name: "Save Ruleset" }));

        await waitFor(() => {
            expect(mockStore.createRuleset).toHaveBeenCalledTimes(1);
        });

        const payload = mockStore.createRuleset.mock.calls[0][0];
        const customRule = payload.rules.find(
            (rule: Rule) => rule.type === "custom",
        );

        expect(customRule).toMatchObject({
            type: "custom",
            scope: "event",
            condition: { matches: ["Wedding"] },
            payout: { type: "multiplier", value: 1.75 },
        });
    });

    it("shows validation error for incomplete date-range custom scope", async () => {
        const user = userEvent.setup();
        mockStore.rulesets = [];

        render(<RulesetEditor organizationId={"org-1" as any} />);

        await user.click(screen.getByRole("button", { name: "+ New Ruleset" }));
        await user.click(screen.getByRole("button", { name: "+ Custom" }));

        await user.selectOptions(
            screen.getByLabelText("Custom rule scope"),
            "date-range",
        );
        await user.type(
            screen.getByLabelText("Custom rule start date"),
            "2026-01-01",
        );

        await user.click(screen.getByRole("button", { name: "Save Ruleset" }));

        expect(
            screen.getByText(
                "Custom date-range rules require start and end dates.",
            ),
        ).toBeInTheDocument();
        expect(mockStore.createRuleset).not.toHaveBeenCalled();
    });

    it("shows validation error when custom advanced JSON is invalid", async () => {
        const user = userEvent.setup();
        mockStore.rulesets = [];

        render(<RulesetEditor organizationId={"org-1" as any} />);

        await user.click(screen.getByRole("button", { name: "+ New Ruleset" }));
        await user.click(screen.getByRole("button", { name: "+ Custom" }));

        const conditionTextarea = screen.getByLabelText(
            "Custom rule condition JSON",
        );
        const payoutTextarea = screen.getByLabelText("Custom rule payout JSON");

        fireEvent.change(conditionTextarea, {
            target: { value: "{not-valid}" },
        });
        fireEvent.change(payoutTextarea, {
            target: { value: '{"type":"flat-fee","value":50}' },
        });

        await user.click(screen.getByRole("button", { name: "Save Ruleset" }));

        expect(
            screen.getByText("Custom rule condition JSON is invalid."),
        ).toBeInTheDocument();
        expect(mockStore.createRuleset).not.toHaveBeenCalled();
    });

    it("shows assigned and unassigned states in shared ruleset list when enabled", () => {
        render(<RulesetEditor scope="shared" showAssignmentSummary />);

        expect(mockStore.loadSharedRulesets).toHaveBeenCalledTimes(1);
        expect(
            screen.getByText("Used by 1 organization: Alpha Org"),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Not assigned to any organization."),
        ).toBeInTheDocument();
    });
});
