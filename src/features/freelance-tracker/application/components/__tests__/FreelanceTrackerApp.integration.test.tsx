import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FreelanceTrackerApp } from "../FreelanceTrackerApp";
import { testId } from "../../../test-utils/fixtures";

vi.mock("../EntryHistory", () => ({
    EntryHistory: ({
        onEditEntry,
    }: {
        onEditEntry?: (entryId: any) => void;
    }) => <button onClick={() => onEditEntry?.("entry-1")}>Edit</button>,
}));

vi.mock("../EntryForm", () => ({
    EntryForm: ({
        editingEntryId,
        onCancelEdit,
    }: {
        editingEntryId?: string | null;
        onCancelEdit?: () => void;
    }) => (
        <div>
            <h2>{editingEntryId ? "Edit Entry" : "New Entry"}</h2>
            {editingEntryId && (
                <button onClick={onCancelEdit}>Cancel Edit</button>
            )}
        </div>
    ),
}));

vi.mock("../PaySummary", () => ({
    PaySummary: () => <h2>Pay Summary</h2>,
}));

vi.mock("../OrganizationsPanel", () => ({
    OrganizationsPanel: () => (
        <div className="organizations-panel">
            <h2 className="organizations-panel__title">Organizations</h2>
            <ul className="organizations-panel__list">
                <li>
                    <button
                        className="organizations-panel__org-link"
                        type="button"
                    >
                        Org A
                    </button>
                </li>
                <li>
                    <button
                        className="organizations-panel__org-link"
                        type="button"
                    >
                        Org B
                    </button>
                </li>
            </ul>
        </div>
    ),
}));

const loadOrganizations = vi.fn();
const loadHistories = vi.fn();
const loadRulesets = vi.fn();
const setEditingEntry = vi.fn((entryId: string | null) => {
    store.editingEntryId = entryId;
});
const organizations = [
    {
        organizationId: testId("org"),
        name: "Org A",
        payPeriodStartDay: 1,
        createdAt: new Date().toISOString(),
    },
    {
        organizationId: testId("org"),
        name: "Org B",
        payPeriodStartDay: 3,
        createdAt: new Date().toISOString(),
    },
];

const store: any = {
    organizations,
    selectedPeriod: null,
    editingEntryId: null,
    loading: false,
    loadOrganizations,
    loadHistories,
    loadRulesets,
    setEditingEntry,
};

vi.mock("../../hooks", () => ({
    useFreelanceTracker: () => store,
}));

describe("FreelanceTrackerApp integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        store.loading = false;
        store.selectedPeriod = null;
        store.organizations = organizations;
        store.editingEntryId = null;
    });

    it("loads organizations on mount", () => {
        render(<FreelanceTrackerApp />);

        expect(loadOrganizations).toHaveBeenCalledTimes(1);
        expect(loadHistories).toHaveBeenCalledWith(
            organizations[0].organizationId,
        );
        expect(loadRulesets).toHaveBeenCalledWith(
            organizations[0].organizationId,
        );
    });

    it("renders tracker tabs and defaults to the New Entry panel", () => {
        const { container } = render(<FreelanceTrackerApp />);

        expect(
            screen.getByRole("heading", { name: /freelance hours tracker/i }),
        ).toBeInTheDocument();
        const topEntryTab = container.querySelector("#freelance-tab-entry");
        expect(topEntryTab).toHaveClass("freelance-tracker-app__tab--active");
        expect(
            screen.getByRole("button", { name: /entry history/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /pay summary/i }),
        ).toBeInTheDocument();
        expect(
            screen.getAllByRole("button", { name: "Organization" }),
        ).toHaveLength(2);
        expect(
            screen.getByRole("heading", { name: /new entry/i }),
        ).toBeInTheDocument();
        expect(
            container.querySelector("#freelance-panel-entry"),
        ).toHaveAttribute("data-desktop-active", "true");
        expect(
            container.querySelector("#freelance-panel-entry"),
        ).toHaveAttribute("data-mobile-active", "true");
        expect(
            container.querySelector("#freelance-panel-history"),
        ).not.toHaveClass("freelance-tracker-app__panel--active");
        expect(
            container.querySelector("#freelance-panel-summary"),
        ).not.toHaveClass("freelance-tracker-app__panel--active");
    });

    it("switches tabs and returns to New Entry when editing from history", async () => {
        const user = userEvent.setup();
        const { container } = render(<FreelanceTrackerApp />);

        await user.click(
            screen.getByRole("button", { name: /entry history/i }),
        );

        expect(
            screen.getByRole("button", { name: /entry history/i }),
        ).toHaveClass("freelance-tracker-app__tab--active");
        expect(container.querySelector("#freelance-panel-history")).toHaveClass(
            "freelance-tracker-app__panel--active",
        );

        await user.click(screen.getByRole("button", { name: /edit/i }));

        const topEntryTab = container.querySelector("#freelance-tab-entry");
        expect(topEntryTab).toHaveClass("freelance-tracker-app__tab--active");
        expect(setEditingEntry).toHaveBeenCalledWith("entry-1");
        expect(
            container.querySelector("#freelance-panel-entry"),
        ).toHaveAttribute("data-desktop-active", "true");
        expect(
            container.querySelector("#freelance-panel-entry"),
        ).toHaveAttribute("data-mobile-active", "true");
    });

    it("returns the entry pane to the default new-entry state when edit is cancelled", async () => {
        const user = userEvent.setup();
        const view = render(<FreelanceTrackerApp />);

        await user.click(
            screen.getByRole("button", { name: /entry history/i }),
        );
        await user.click(screen.getByRole("button", { name: /edit/i }));

        expect(
            screen.getByRole("heading", { name: /edit entry/i }),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /cancel edit/i }));
        view.rerender(<FreelanceTrackerApp />);

        expect(setEditingEntry).toHaveBeenLastCalledWith(null);
        expect(
            screen.getByRole("heading", { name: /new entry/i }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /cancel edit/i }),
        ).not.toBeInTheDocument();
    });

    it("shows loading indicator when store is loading", () => {
        store.loading = true;
        render(<FreelanceTrackerApp />);
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
});
