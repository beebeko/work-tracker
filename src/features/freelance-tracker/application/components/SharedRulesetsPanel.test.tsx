import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SharedRulesetsPanel } from "./SharedRulesetsPanel";

const mockUseFreelanceTracker = vi.hoisted(() => vi.fn());

const createStore = () => ({
    getSharedRulesetAssignmentSummary: vi.fn(() => [
        {
            ruleset: {
                rulesetId: "ruleset-1",
                effectiveDate: "2026-01-01",
                rules: [],
                createdAt: "2026-01-01T00:00:00.000Z",
            },
            assignedOrganizationIds: ["org-1", "org-2"],
            assignedOrganizationCount: 2,
            isAssigned: true,
        },
        {
            ruleset: {
                rulesetId: "ruleset-2",
                effectiveDate: "2026-02-01",
                rules: [],
                createdAt: "2026-02-01T00:00:00.000Z",
            },
            assignedOrganizationIds: [],
            assignedOrganizationCount: 0,
            isAssigned: false,
        },
    ]),
});

let mockStore = createStore();

vi.mock("../hooks", () => ({
    useFreelanceTracker: mockUseFreelanceTracker.mockImplementation(
        () => mockStore,
    ),
}));

vi.mock("./RulesetEditor", () => ({
    RulesetEditor: ({ scope, showAssignmentSummary }: any) => (
        <div
            data-testid="ruleset-editor"
            data-scope={scope}
            data-show-assignment-summary={showAssignmentSummary}
        />
    ),
}));

describe("SharedRulesetsPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStore = createStore();
        mockUseFreelanceTracker.mockImplementation(() => mockStore);
    });

    it("renders shared ruleset totals and assignment breakdown", () => {
        render(<SharedRulesetsPanel />);

        expect(
            screen.getByRole("heading", { name: "Shared Rulesets" }),
        ).toBeInTheDocument();
        expect(screen.getByText("Total: 2")).toBeInTheDocument();
        expect(screen.getByText("Assigned: 1")).toBeInTheDocument();
        expect(screen.getByText("Unassigned: 1")).toBeInTheDocument();
    });

    it("renders the shared-scope ruleset editor with assignment summary enabled", () => {
        render(<SharedRulesetsPanel />);

        const editor = screen.getByTestId("ruleset-editor");
        expect(editor).toHaveAttribute("data-scope", "shared");
        expect(editor).toHaveAttribute("data-show-assignment-summary", "true");
    });
});
