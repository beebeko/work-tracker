/**
 * Tests for FreelanceTrackerApp container component
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FreelanceTrackerApp } from "./FreelanceTrackerApp";

const mockUseFreelanceTracker = vi.hoisted(() => vi.fn());

const createMockStore = () => ({
    organizations: [
        {
            organizationId: "org-test-1",
            name: "Test Org",
            payPeriodStartDay: 1,
            createdAt: new Date().toISOString(),
        },
    ],
    entries: [],
    selectedPeriod: null,
    loading: false,
    error: null,
    isFormOpen: true,
    editingEntryId: null,
    loadOrganizations: vi.fn(),
    loadHistories: vi.fn(),
    loadRulesets: vi.fn(),
    setEditingEntry: vi.fn(),
    selectedOrganizationId: "org-test-1",
    selectOrganization: vi.fn(),
    rulesets: [],
});

let mockStore = createMockStore();

function setOnlineState(value: boolean) {
    Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value,
    });
}

vi.mock("../hooks", () => ({
    useFreelanceTracker: mockUseFreelanceTracker.mockImplementation(
        () => mockStore,
    ),
}));

vi.mock("./EntryForm", () => ({
    EntryForm: ({ onClose }: any) => (
        <div data-testid="entry-form">
            EntryForm
            {onClose && <button onClick={onClose}>Close Form</button>}
        </div>
    ),
}));

vi.mock("./EntryHistory", () => ({
    EntryHistory: ({ onEditEntry }: any) => (
        <div data-testid="entry-history">
            EntryHistory
            {onEditEntry && (
                <button onClick={() => onEditEntry("entry-edit-1")}>
                    Edit Entry
                </button>
            )}
        </div>
    ),
}));

vi.mock("./PaySummary", () => ({
    PaySummary: () => <div data-testid="pay-summary">PaySummary</div>,
}));

vi.mock("./OrganizationsPanel", () => ({
    OrganizationsPanel: () => (
        <div data-testid="organizations-panel">OrganizationsPanel</div>
    ),
}));

describe("FreelanceTrackerApp", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStore = createMockStore();
        setOnlineState(true);
        mockUseFreelanceTracker.mockImplementation(() => mockStore);
    });

    it("renders header with title", () => {
        render(<FreelanceTrackerApp />);
        expect(
            screen.getByText(/freelance hours tracker/i),
        ).toBeInTheDocument();
    });

    it("loads organizations on mount", async () => {
        render(<FreelanceTrackerApp />);

        await waitFor(() => {
            expect(mockStore.loadOrganizations).toHaveBeenCalled();
        });
    });

    it("renders tab navigation controls", () => {
        const { container } = render(<FreelanceTrackerApp />);

        expect(
            container.querySelector("#freelance-tab-entry"),
        ).toBeInTheDocument();
        expect(
            container.querySelector("#freelance-tab-organization"),
        ).toBeInTheDocument();
    });

    it("clears entry editing state when switching to organizations", async () => {
        const user = userEvent.setup();
        const { container } = render(<FreelanceTrackerApp />);

        const organizationsTopTab = container.querySelector(
            "#freelance-tab-organization",
        );

        expect(organizationsTopTab).toBeInTheDocument();
        if (!organizationsTopTab) {
            throw new Error("Organizations top tab was not rendered");
        }

        await user.click(organizationsTopTab);

        expect(mockStore.setEditingEntry).toHaveBeenCalledWith(null);
    });

    it("activates organization pane deterministically from the top tab", async () => {
        const user = userEvent.setup();
        const { container } = render(<FreelanceTrackerApp />);

        const organizationsTopTab = container.querySelector(
            "#freelance-tab-organization",
        );

        if (!organizationsTopTab) {
            throw new Error("Organizations top tab was not rendered");
        }

        await user.click(organizationsTopTab);

        const leftSection = container.querySelector("#freelance-panel-left");
        const entryContent = container.querySelector("#freelance-panel-entry");
        const organizationsContent = container.querySelector(
            "#freelance-panel-organization",
        );

        expect(organizationsTopTab).toHaveClass(
            "freelance-tracker-app__tab--active",
        );
        expect(leftSection).toHaveClass("freelance-tracker-app__panel--active");
        expect(entryContent).toHaveAttribute("data-mobile-active", "false");
        expect(organizationsContent).toHaveAttribute(
            "data-mobile-active",
            "true",
        );
    });

    it("renders organization-management navigation controls", () => {
        render(<FreelanceTrackerApp />);

        expect(
            screen.getAllByRole("button", { name: /organization/i }).length,
        ).toBeGreaterThan(0);
    });

    it("calls setEditingEntry when edit is triggered", async () => {
        const user = userEvent.setup();

        render(<FreelanceTrackerApp />);

        const editButton = screen.getByRole("button", { name: /edit entry/i });
        await user.click(editButton);

        expect(mockStore.setEditingEntry).toHaveBeenCalled();
    });

    it("shows synced status when firebase mode is enabled", () => {
        render(<FreelanceTrackerApp firebaseMode />);

        expect(screen.getByText("Synced")).toBeInTheDocument();
    });

    it("switches status to offline on browser offline event", async () => {
        render(<FreelanceTrackerApp firebaseMode />);

        act(() => {
            setOnlineState(false);
            window.dispatchEvent(new Event("offline"));
        });

        await waitFor(() => {
            expect(screen.getByText("Offline")).toBeInTheDocument();
        });
    });

    it("hides sync status in json mode", () => {
        render(<FreelanceTrackerApp firebaseMode={false} />);

        expect(screen.queryByText("Synced")).not.toBeInTheDocument();
        expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });
});
