import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryForm } from "../EntryForm";
import { testId } from "../../../test-utils/fixtures";

const createMatchMedia = (isSingleColumnLayout: boolean) =>
    vi.fn().mockImplementation((query: string) => ({
        media: query,
        matches: query === "(min-width: 480px)" ? !isSingleColumnLayout : false,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }));

const createEntry = vi.fn();
const updateEntry = vi.fn();
const createOrganization = vi.fn();
const loadSharedRulesets = vi.fn();
const organizationId = testId("org");
const sharedRulesetId = testId("shared-ruleset");

const store = {
    organizations: [
        {
            organizationId,
            name: "Org A",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: null,
            positions: [
                { name: "Audio Tech", defaultRate: 35 },
                { name: "Engineer", defaultRate: null },
            ],
            venues: [],
            createdAt: new Date().toISOString(),
        },
    ],
    loading: false,
    error: null,
    sharedRulesets: [],
    createEntry,
    createOrganization,
    updateEntry,
    loadHistories: vi.fn(),
    loadSharedRulesets,
    getSharedRulesetAssignmentSummary: () => [],
};

const entryFormHook = {
    editingEntry: null,
    initialValues: {
        organizationId: store.organizations[0].organizationId,
        dateWorked: "2026-04-14",
        startTime: "09:00",
        endTime: "11:00",
        position: "",
        rate: null,
        event: null,
        tags: [],
        notes: null,
    },
    validateForm: (data: any) => {
        if (!data.position) return "Position is required";
        if (data.rate && Number.isNaN(Number(data.rate)))
            return "Rate must be numeric";
        return null;
    },
    autocompleteVenues: (v: string) =>
        ["City Hall", "Civic Center", "Club Nova"].filter((x) =>
            x.toLowerCase().includes(v.toLowerCase()),
        ),
    autocompletePositions: (v: string) =>
        ["Audio Tech", "A2", "Stage Manager"].filter((x) =>
            x.toLowerCase().includes(v.toLowerCase()),
        ),
    getOrganizationPositionDefaultRate: () => null,
    autocompleteTags: (v: string) =>
        ["festival", "monitor", "setup"].filter((x) =>
            x.toLowerCase().includes(v.toLowerCase()),
        ),
};

vi.mock("../../hooks", () => ({
    useFreelanceTracker: () => store,
    useEntryForm: () => entryFormHook,
}));

describe("EntryForm integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.matchMedia = createMatchMedia(false) as typeof window.matchMedia;
        store.error = null;
        store.loading = false;
        store.sharedRulesets = [
            {
                rulesetId: sharedRulesetId,
                effectiveDate: "2026-09-01",
                rules: [],
                createdAt: new Date().toISOString(),
            },
        ];
        createEntry.mockResolvedValue({
            success: true,
            data: { entryId: testId("entry") },
        });
        loadSharedRulesets.mockResolvedValue(undefined);
        createOrganization.mockResolvedValue({
            success: true,
            data: {
                organizationId: testId("org"),
                name: "Org A",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                notes: null,
                positions: [],
                venues: [],
                createdAt: new Date().toISOString(),
            },
        });
        updateEntry.mockResolvedValue({
            success: true,
            data: { entryId: testId("entry") },
        });
    });

    it("renders all expected form controls and submit action", () => {
        render(<EntryForm />);

        expect(screen.getByLabelText(/organization/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^date$/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/venue/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/position/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/rate/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/event/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /create entry/i }),
        ).toBeInTheDocument();
    });

    it("submits valid entry and clears editable fields", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        await user.type(screen.getByLabelText(/position/i), "Audio Tech");
        await user.type(screen.getByLabelText(/rate/i), "35");
        await user.type(screen.getByLabelText(/event/i), "Load-in");

        const tagsInput = screen.getByPlaceholderText(/add tags/i);
        await user.type(tagsInput, "festival");
        await user.keyboard("{Enter}");

        await user.click(screen.getByRole("button", { name: /create entry/i }));

        expect(createEntry).toHaveBeenCalledTimes(1);
        expect(screen.getByPlaceholderText(/e.g., sound tech/i)).toHaveValue(
            "",
        );
        expect(
            screen.queryByText(/position is required/i),
        ).not.toBeInTheDocument();
    });

    it("shows validation message and blocks submit when required field missing", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        await user.click(screen.getByRole("button", { name: /create entry/i }));

        expect(createEntry).not.toHaveBeenCalled();
        expect(screen.getByText(/position is required/i)).toBeInTheDocument();
    });

    it("supports autocomplete and tag pill add/remove", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        const position = screen.getByLabelText(/position/i);
        await user.type(position, "a");
        expect(
            screen.getByRole("option", { name: "Audio Tech" }),
        ).toBeInTheDocument();

        const tagsInput = screen.getByPlaceholderText(/add tags/i);
        await user.type(tagsInput, "setup");
        await user.keyboard("{Enter}");

        expect(screen.getByText("setup")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "✕" }));
        expect(screen.queryByText("setup")).not.toBeInTheDocument();
    });

    it("renders DAL error feedback from failed submit", async () => {
        const user = userEvent.setup();
        createEntry.mockResolvedValueOnce({
            success: false,
            error: { message: "Save failed" },
        });
        render(<EntryForm />);

        await user.type(screen.getByLabelText(/position/i), "Engineer");
        await user.click(screen.getByRole("button", { name: /create entry/i }));

        expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    });

    it("shows add prompt for unknown organization and saves from modal", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        const organization = screen.getByLabelText(/organization/i);
        fireEvent.change(organization, { target: { value: "Org B" } });

        await user.click(
            screen.getByRole("button", { name: /add organization/i }),
        );

        expect(
            screen.getByRole("heading", { name: /new organization/i }),
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/organization name/i)).toHaveValue(
            "Org B",
        );

        await user.click(
            screen.getByRole("button", { name: /save organization/i }),
        );

        await waitFor(() => {
            expect(createOrganization).toHaveBeenCalledWith({
                name: "Org B",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                notes: null,
                rulesetIds: [],
            });
        });
    });

    it("loads shared rulesets and submits selected shared ruleset ids when saving a new organization", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        const organization = screen.getByLabelText(/organization/i);
        fireEvent.change(organization, {
            target: { value: "Org With Ruleset" },
        });

        await user.click(
            screen.getByRole("button", { name: /add organization/i }),
        );

        expect(loadSharedRulesets).toHaveBeenCalledTimes(1);

        await user.click(
            screen.getByRole("checkbox", { name: /effective 2026-09-01/i }),
        );
        await user.click(
            screen.getByRole("button", { name: /save organization/i }),
        );

        await waitFor(() => {
            expect(createOrganization).toHaveBeenCalledWith({
                name: "Org With Ruleset",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                notes: null,
                rulesetIds: [sharedRulesetId],
            });
        });
    });

    it("keeps the add-organization modal open and surfaces async permission errors", async () => {
        const user = userEvent.setup();
        createOrganization.mockResolvedValueOnce({
            success: false,
            error: {
                type: "io",
                message:
                    "PERMISSION_DENIED: Missing or insufficient permissions.",
            },
        });

        render(<EntryForm />);

        const organization = screen.getByLabelText(/organization/i);
        fireEvent.change(organization, { target: { value: "Org Denied" } });

        await user.click(
            screen.getByRole("button", { name: /add organization/i }),
        );
        await user.click(
            screen.getByRole("button", { name: /save organization/i }),
        );

        expect(
            await screen.findByText(
                /permission_denied: missing or insufficient permissions\./i,
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /new organization/i }),
        ).toBeInTheDocument();
        expect(organization).toHaveValue("Org Denied");
    });

    it("does not show create prompt for duplicate organization names with different case/spacing", async () => {
        render(<EntryForm />);

        const organization = screen.getByLabelText(/organization/i);
        fireEvent.change(organization, {
            target: { value: "  org   a  " },
        });

        expect(
            screen.queryByRole("button", { name: /add organization/i }),
        ).not.toBeInTheDocument();
    });

    it("does not render manage prompt for whitespace-only organization input", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        const organization = screen.getByLabelText(/organization/i);
        await user.clear(organization);
        await user.type(organization, "   ");

        expect(
            screen.queryByRole("button", { name: /add organization/i }),
        ).not.toBeInTheDocument();
    });

    it("renders add prompt text with normalized typed organization name", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        const organization = screen.getByLabelText(/organization/i);
        await user.clear(organization);
        await user.type(organization, "  New   Org  ");

        expect(screen.getByText(/no organization named/i)).toHaveTextContent(
            'No organization named "New Org".',
        );
        expect(
            screen.getByRole("button", { name: /add organization/i }),
        ).toBeInTheDocument();
    });

    it("lets single-column layout users choose existing values from combo boxes without typing", async () => {
        const user = userEvent.setup();
        window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;

        store.organizations = [
            {
                organizationId,
                name: "Org A",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                notes: null,
                positions: [
                    { name: "Audio Tech", defaultRate: 35 },
                    { name: "Engineer", defaultRate: null },
                ],
                venues: ["City Hall", "Club Nova"],
                createdAt: new Date().toISOString(),
            },
            {
                organizationId: testId("org-b"),
                name: "Org B",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                notes: null,
                positions: [{ name: "Stage Manager", defaultRate: null }],
                venues: ["Civic Center"],
                createdAt: new Date().toISOString(),
            },
        ];

        render(<EntryForm />);

        await user.click(
            screen.getByRole("button", { name: /show organization options/i }),
        );
        await user.click(screen.getByRole("option", { name: "Org B" }));
        expect(
            screen.getByLabelText("Organization", { selector: "input" }),
        ).toHaveValue("Org B");

        await user.click(
            screen.getByRole("button", { name: /show venue options/i }),
        );
        await user.click(screen.getByRole("option", { name: "Civic Center" }));
        expect(
            screen.getByLabelText("Venue", { selector: "input" }),
        ).toHaveValue("Civic Center");

        await user.click(
            screen.getByRole("button", { name: /show position options/i }),
        );
        await user.click(screen.getByRole("option", { name: "Stage Manager" }));
        expect(
            screen.getByLabelText("Position", { selector: "input" }),
        ).toHaveValue("Stage Manager");
    });
});
