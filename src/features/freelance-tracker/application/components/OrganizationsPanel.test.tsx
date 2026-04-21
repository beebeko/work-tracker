import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrganizationsPanel } from "./OrganizationsPanel";

const mockUseFreelanceTracker = vi.hoisted(() => vi.fn());

const createStore = () => ({
    organizations: [
        {
            organizationId: "org-1",
            name: "Alpha Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: "# House Notes\n\nBring **gaff** tape.",
            venues: ["Main Stage"],
            positions: [{ name: "Sound Tech", defaultRate: 150 }],
            rulesetIds: ["ruleset-1"],
            createdAt: "2025-01-01T00:00:00.000Z",
        },
    ],
    positionHistories: [],
    venueHistories: [],
    rulesets: [
        {
            rulesetId: "ruleset-1",
            organizationId: "org-1",
            effectiveDate: "2025-01-01",
            rules: [
                {
                    ruleId: "rule-1",
                    type: "meal-penalty",
                    description: "Meal rule",
                    penaltyAmount: 25,
                },
            ],
            createdAt: "2025-01-01T00:00:00.000Z",
        },
    ],
    sharedRulesets: [
        {
            rulesetId: "ruleset-1",
            effectiveDate: "2025-01-01",
            rules: [
                {
                    ruleId: "rule-1",
                    type: "meal-penalty",
                    description: "Meal rule",
                    penaltyAmount: 25,
                },
            ],
            createdAt: "2025-01-01T00:00:00.000Z",
        },
        {
            rulesetId: "ruleset-2",
            effectiveDate: "2025-02-01",
            rules: [
                {
                    ruleId: "rule-2",
                    type: "daily-overtime",
                    description: "Daily OT",
                    dailyThresholdHours: 8,
                    multiplier: 1.5,
                },
            ],
            createdAt: "2025-02-01T00:00:00.000Z",
        },
    ],
    getSharedRulesetAssignmentSummary: vi.fn(() => [
        {
            ruleset: {
                rulesetId: "ruleset-1",
                effectiveDate: "2025-01-01",
                rules: [
                    {
                        ruleId: "rule-1",
                        type: "meal-penalty",
                        description: "Meal rule",
                        penaltyAmount: 25,
                    },
                ],
                createdAt: "2025-01-01T00:00:00.000Z",
            },
            assignedOrganizationIds: ["org-1"],
            assignedOrganizationNames: ["Alpha Org"],
        },
        {
            ruleset: {
                rulesetId: "ruleset-2",
                effectiveDate: "2025-02-01",
                rules: [
                    {
                        ruleId: "rule-2",
                        type: "daily-overtime",
                        description: "Daily OT",
                        dailyThresholdHours: 8,
                        multiplier: 1.5,
                    },
                ],
                createdAt: "2025-02-01T00:00:00.000Z",
            },
            assignedOrganizationIds: [],
            assignedOrganizationNames: [],
        },
    ]),
    loadHistories: vi.fn().mockResolvedValue(undefined),
    loadRulesets: vi.fn().mockResolvedValue(undefined),
    loadSharedRulesets: vi.fn().mockResolvedValue(undefined),
    createRuleset: vi.fn().mockResolvedValue({
        success: true,
        data: {
            rulesetId: "ruleset-new",
            organizationId: "org-1",
            effectiveDate: "2025-01-01",
            rules: [],
            createdAt: "2025-01-02T00:00:00.000Z",
        },
    }),
    deleteRuleset: vi
        .fn()
        .mockResolvedValue({ success: true, data: undefined }),
    updateOrganization: vi.fn().mockResolvedValue({
        success: true,
        data: {
            organizationId: "org-1",
            name: "Alpha Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: "# House Notes\n\nBring **gaff** tape.",
            venues: ["Main Stage"],
            positions: [{ name: "Sound Tech", defaultRate: 150 }],
            rulesetIds: ["ruleset-1"],
            createdAt: "2025-01-01T00:00:00.000Z",
        },
    }),
    deleteOrganization: vi
        .fn()
        .mockResolvedValue({ success: true, data: undefined }),
});

let mockStore = createStore();

vi.mock("../hooks", () => ({
    useFreelanceTracker: mockUseFreelanceTracker.mockImplementation(
        () => mockStore,
    ),
}));

describe("OrganizationsPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStore = createStore();
        mockUseFreelanceTracker.mockImplementation(() => mockStore);
    });

    it("renders organizations as links", () => {
        render(<OrganizationsPanel />);
        expect(screen.getByTestId("organizations-panel")).toBeInTheDocument();
        expect(screen.getByTestId("organizations-list")).toBeInTheDocument();
        expect(screen.getByTestId("organization-link")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Alpha Org" }),
        ).toBeInTheDocument();
    });

    it("opens organization details modal and loads rulesets", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));

        expect(mockStore.loadRulesets).toHaveBeenCalledWith("org-1");
        expect(mockStore.loadHistories).toHaveBeenCalledWith("org-1");
        expect(mockStore.loadSharedRulesets).toHaveBeenCalledTimes(1);
        expect(
            screen.getByTestId("organization-details-dialog"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: "Alpha Org" }),
        ).toBeInTheDocument();
    });

    it("shows editable organization settings, positions, venues, and notes preview in the details modal", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));

        expect(screen.getByLabelText(/timezone/i)).toHaveValue("UTC");
        expect(screen.getByLabelText(/pay period start day/i)).toHaveValue("1");
        expect(screen.getByLabelText(/workweek start day/i)).toHaveValue("1");
        expect(screen.getByText("Sound Tech")).toBeInTheDocument();
        expect(screen.getByText("$150.00/hr")).toBeInTheDocument();
        expect(screen.getByText("Main Stage")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "View" })).toHaveClass(
            "organizations-panel__toggle-button--active",
        );
        expect(screen.getByRole("button", { name: "Edit" })).not.toHaveClass(
            "organizations-panel__toggle-button--active",
        );
        expect(
            screen.queryByLabelText(/notes \(markdown\)/i),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: "House Notes" }),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("organization-notes-preview"),
        ).toHaveTextContent("Bring gaff tape.");
    });

    it("renders sections in the expected order with rulesets between venues and notes", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));

        const venuesHeading = screen.getByRole("heading", {
            name: "Venues",
            level: 4,
        });
        const rulesetsHeading = screen.getByRole("heading", {
            name: "Pay Rulesets",
        });
        const notesHeading = screen.getByRole("heading", {
            name: "Notes",
            level: 4,
        });

        const isBefore = (a: HTMLElement, b: HTMLElement) =>
            Boolean(
                a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
            );

        expect(isBefore(venuesHeading, rulesetsHeading)).toBe(true);
        expect(isBefore(rulesetsHeading, notesHeading)).toBe(true);
    });

    it("toggles notes between rendered markdown view and editor without showing both at once", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));

        const notesPanel = screen.getByTestId("organization-notes-panel");

        expect(notesPanel).toBeInTheDocument();
        expect(
            screen.getByTestId("organization-notes-preview"),
        ).toBeInTheDocument();
        expect(
            screen.queryByLabelText(/notes \(markdown\)/i),
        ).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Edit" }));

        expect(screen.getByRole("button", { name: "Edit" })).toHaveClass(
            "organizations-panel__toggle-button--active",
        );
        expect(screen.getByLabelText(/notes \(markdown\)/i)).toHaveValue(
            "# House Notes\n\nBring **gaff** tape.",
        );
        expect(
            screen.queryByTestId("organization-notes-preview"),
        ).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "View" }));

        expect(screen.getByRole("button", { name: "View" })).toHaveClass(
            "organizations-panel__toggle-button--active",
        );
        expect(
            screen.getByTestId("organization-notes-preview"),
        ).toBeInTheDocument();
        expect(
            screen.queryByLabelText(/notes \(markdown\)/i),
        ).not.toBeInTheDocument();
    });

    it("saves organization settings, scoped positions, scoped venues, and notes with canonical replacement arrays", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));

        await user.clear(screen.getByLabelText(/organization name/i));
        await user.type(
            screen.getByLabelText(/organization name/i),
            "Alpha Org Renamed",
        );
        await user.clear(screen.getByLabelText(/timezone/i));
        await user.type(screen.getByLabelText(/timezone/i), "America/New_York");
        await user.selectOptions(
            screen.getByLabelText(/pay period start day/i),
            "3",
        );
        await user.selectOptions(
            screen.getByLabelText(/workweek start day/i),
            "5",
        );

        await user.click(screen.getByRole("button", { name: "Edit" }));
        await user.clear(screen.getByLabelText(/notes \(markdown\)/i));
        await user.type(
            screen.getByLabelText(/notes \(markdown\)/i),
            "## Call Sheet\n\n- Arrive early",
        );

        await user.click(
            screen.getByRole("button", { name: /\+ new position/i }),
        );
        await user.clear(screen.getByLabelText(/position name/i));
        await user.type(
            screen.getByLabelText(/position name/i),
            "Lighting Director",
        );
        await user.type(screen.getByLabelText(/default hourly rate/i), "175");
        await user.click(screen.getByRole("button", { name: /add position/i }));
        await user.click(
            screen.getByRole("button", { name: /delete position sound tech/i }),
        );

        await user.click(screen.getByRole("button", { name: /\+ new venue/i }));
        await user.clear(screen.getByLabelText(/venue name/i));
        await user.type(screen.getByLabelText(/venue name/i), "Loading Dock");
        await user.click(screen.getByRole("button", { name: /add venue/i }));
        await user.click(
            screen.getByRole("button", { name: /delete venue main stage/i }),
        );

        await user.click(screen.getByRole("button", { name: "View" }));

        expect(
            screen.getByRole("heading", { name: "Call Sheet" }),
        ).toBeInTheDocument();
        expect(screen.getByText("Arrive early")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => {
            expect(mockStore.updateOrganization).toHaveBeenCalledWith("org-1", {
                name: "Alpha Org Renamed",
                timezone: "America/New_York",
                payPeriodStartDay: 3,
                workweekStartDay: 5,
                notes: "## Call Sheet\n\n- Arrive early",
                venues: ["Loading Dock"],
                positions: [
                    {
                        name: "Lighting Director",
                        defaultRate: 175,
                    },
                ],
                rulesetIds: ["ruleset-1"],
            });
        });

        await waitFor(() => {
            expect(
                screen.queryByTestId("organization-details-dialog"),
            ).not.toBeInTheDocument();
        });
    });

    it("blocks duplicate scoped positions and venues after normalization", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));

        await user.click(
            screen.getByRole("button", { name: /\+ new position/i }),
        );
        await user.clear(screen.getByLabelText(/position name/i));
        await user.type(
            screen.getByLabelText(/position name/i),
            "  Sound   Tech  ",
        );
        await user.click(screen.getByRole("button", { name: /add position/i }));

        expect(screen.getByRole("alert")).toHaveTextContent(
            "Position already exists for this organization.",
        );
        expect(
            screen.getAllByRole("button", {
                name: /delete position sound tech/i,
            }),
        ).toHaveLength(1);

        await user.click(screen.getByRole("button", { name: /\+ new venue/i }));
        await user.clear(screen.getByLabelText(/venue name/i));
        await user.type(
            screen.getByLabelText(/venue name/i),
            "  Main   Stage ",
        );
        await user.click(screen.getByRole("button", { name: /add venue/i }));

        expect(screen.getByRole("alert")).toHaveTextContent(
            "Venue already exists for this organization.",
        );
        expect(
            screen.getAllByRole("button", { name: /delete venue main stage/i }),
        ).toHaveLength(1);
    });

    it("validates position rate and saves trimmed timezone with blank notes as null", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));

        await user.click(
            screen.getByRole("button", { name: /\+ new position/i }),
        );
        await user.clear(screen.getByLabelText(/position name/i));
        await user.type(screen.getByLabelText(/position name/i), "Stagehand");
        await user.type(screen.getByLabelText(/default hourly rate/i), "-5");
        await user.click(screen.getByRole("button", { name: /add position/i }));

        expect(screen.getByRole("alert")).toHaveTextContent(
            "Default hourly rate must be 0 or greater.",
        );

        await user.clear(screen.getByLabelText(/timezone/i));
        await user.click(screen.getByRole("button", { name: /save changes/i }));

        expect(screen.getByRole("alert")).toHaveTextContent(
            "Timezone is required.",
        );
        expect(mockStore.updateOrganization).not.toHaveBeenCalled();

        await user.type(
            screen.getByLabelText(/timezone/i),
            "  America/Chicago  ",
        );
        await user.click(screen.getByRole("button", { name: "Edit" }));
        await user.clear(screen.getByLabelText(/notes \(markdown\)/i));
        await user.type(screen.getByLabelText(/notes \(markdown\)/i), "   ");

        await user.click(screen.getByRole("button", { name: "View" }));

        expect(
            screen.getByText("Markdown preview appears here."),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => {
            expect(mockStore.updateOrganization).toHaveBeenCalledWith("org-1", {
                name: "Alpha Org",
                timezone: "America/Chicago",
                payPeriodStartDay: 1,
                workweekStartDay: 1,
                notes: null,
                venues: ["Main Stage"],
                positions: [
                    {
                        name: "Sound Tech",
                        defaultRate: 150,
                    },
                ],
                rulesetIds: ["ruleset-1"],
            });
        });
    });

    it("attaches shared rulesets from the global catalog to an organization", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));

        await user.click(screen.getByLabelText(/effective 2025-02-01/i));
        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => {
            expect(mockStore.updateOrganization).toHaveBeenCalledWith("org-1", {
                name: "Alpha Org",
                timezone: "UTC",
                payPeriodStartDay: 1,
                workweekStartDay: 1,
                notes: "# House Notes\n\nBring **gaff** tape.",
                venues: ["Main Stage"],
                positions: [
                    {
                        name: "Sound Tech",
                        defaultRate: 150,
                    },
                ],
                rulesetIds: ["ruleset-1", "ruleset-2"],
            });
        });
    });

    it("surfaces save failures and clears the error after further edits", async () => {
        const user = userEvent.setup();
        mockStore.updateOrganization
            .mockResolvedValueOnce({
                success: false,
                error: {
                    type: "conflict",
                    message: "Organization update failed.",
                },
            })
            .mockResolvedValueOnce({
                success: true,
                data: {
                    organizationId: "org-1",
                    name: "Alpha Org",
                    payPeriodStartDay: 2,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    notes: "# House Notes\n\nBring **gaff** tape.",
                    venues: ["Main Stage"],
                    positions: [{ name: "Sound Tech", defaultRate: 150 }],
                    createdAt: "2025-01-01T00:00:00.000Z",
                },
            });
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));
        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "Organization update failed.",
            );
        });
        expect(
            screen.getByRole("button", { name: /save changes/i }),
        ).toBeEnabled();

        await user.selectOptions(
            screen.getByLabelText(/pay period start day/i),
            "2",
        );

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => {
            expect(mockStore.updateOrganization).toHaveBeenCalledTimes(2);
        });
    });

    it("falls back to a generic save message when the organization no longer exists", async () => {
        const user = userEvent.setup();
        mockStore.updateOrganization.mockResolvedValueOnce({
            success: false,
            error: {
                type: "notFound",
                entityType: "organization",
                id: "org-1" as any,
            },
        });
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));
        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "Failed to save organization changes.",
            );
        });
    });

    it("shows embedded ruleset authoring flow in the organization modal", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));

        expect(
            screen.getByRole("heading", { name: "Pay Rulesets" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "+ New Ruleset" }),
        ).toBeInTheDocument();
        expect(screen.getByTestId("ruleset-card")).toBeInTheDocument();

        // clicking the card opens the edit form
        await user.click(screen.getByTestId("ruleset-card"));
        expect(
            screen.getByRole("button", { name: /update ruleset/i }),
        ).toBeInTheDocument();
    });

    it("does not present raw JSON payload editing as the primary ruleset UX", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));

        expect(screen.queryByText(/raw json/i)).not.toBeInTheDocument();
        expect(
            screen.queryByLabelText(/ruleset payload/i),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("textbox", { name: /ruleset payload/i }),
        ).not.toBeInTheDocument();
    });

    it("edits an existing position in place including rename and rate change", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));

        // click the existing position to open edit form
        await user.click(
            screen.getByRole("button", { name: /edit position sound tech/i }),
        );

        expect(screen.getByLabelText(/position name/i)).toHaveValue(
            "Sound Tech",
        );
        expect(screen.getByLabelText(/default hourly rate/i)).toHaveValue(150);
        expect(
            screen.getByRole("button", { name: /update position/i }),
        ).toBeInTheDocument();

        await user.clear(screen.getByLabelText(/position name/i));
        await user.type(
            screen.getByLabelText(/position name/i),
            "Lighting Director",
        );
        await user.clear(screen.getByLabelText(/default hourly rate/i));
        await user.type(screen.getByLabelText(/default hourly rate/i), "200");
        await user.click(
            screen.getByRole("button", { name: /update position/i }),
        );

        // form closes, updated name appears in list
        expect(
            screen.queryByLabelText(/position name/i),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", {
                name: /edit position lighting director/i,
            }),
        ).toBeInTheDocument();
        expect(screen.getByText("$200.00/hr")).toBeInTheDocument();
    });

    it("edits an existing venue in place", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));

        // click the existing venue to open edit form
        await user.click(
            screen.getByRole("button", { name: /edit venue main stage/i }),
        );

        expect(screen.getByLabelText(/venue name/i)).toHaveValue("Main Stage");
        expect(
            screen.getByRole("button", { name: /update venue/i }),
        ).toBeInTheDocument();

        await user.clear(screen.getByLabelText(/venue name/i));
        await user.type(screen.getByLabelText(/venue name/i), "Loading Dock");
        await user.click(screen.getByRole("button", { name: /update venue/i }));

        // form closes, updated name appears in list
        expect(screen.queryByLabelText(/venue name/i)).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /edit venue loading dock/i }),
        ).toBeInTheDocument();
    });

    it("blocks renaming a position to an existing name", async () => {
        const user = userEvent.setup();
        // seed two positions
        mockStore.organizations[0].positions = [
            { name: "Sound Tech", defaultRate: 150 },
            { name: "Stagehand", defaultRate: null },
        ];
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));
        await user.click(
            screen.getByRole("button", { name: /edit position stagehand/i }),
        );

        await user.clear(screen.getByLabelText(/position name/i));
        await user.type(screen.getByLabelText(/position name/i), "Sound Tech");
        await user.click(
            screen.getByRole("button", { name: /update position/i }),
        );

        expect(screen.getByRole("alert")).toHaveTextContent(
            "Position already exists for this organization.",
        );
    });

    it("closes organization modal when Escape key is pressed", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));
        expect(
            screen.getByRole("heading", { name: "Alpha Org" }),
        ).toBeInTheDocument();

        await user.keyboard("{Escape}");

        await waitFor(() => {
            expect(
                screen.queryByRole("heading", { name: "Alpha Org" }),
            ).not.toBeInTheDocument();
        });
    });

    it("shows delete organization button in organization modal", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));

        expect(
            screen.getByRole("button", {
                name: "Delete Organization",
            }),
        ).toBeInTheDocument();
    });

    it("shows delete confirmation modal when delete button is clicked", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));
        await user.click(
            screen.getByRole("button", { name: "Delete Organization" }),
        );

        expect(
            screen.getByText(/This will delete "Alpha Org"/),
        ).toBeInTheDocument();
    });

    it("deletes organization and closes modal on confirmation", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));
        await user.click(
            screen.getByRole("button", { name: "Delete Organization" }),
        );

        await user.click(
            screen.getByRole("button", {
                name: "Delete",
            }),
        );

        await waitFor(() => {
            expect(mockStore.deleteOrganization).toHaveBeenCalledWith("org-1");
        });

        await waitFor(() => {
            expect(
                screen.queryByText(/This will delete "Alpha Org"/),
            ).not.toBeInTheDocument();
        });
    });

    it("closes delete confirmation modal when cancel is clicked", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));
        await user.click(
            screen.getByRole("button", { name: "Delete Organization" }),
        );

        expect(
            screen.getByText(/This will delete "Alpha Org"/),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(
            screen.queryByText(/This will delete "Alpha Org"/),
        ).not.toBeInTheDocument();

        expect(
            screen.getByRole("heading", { name: "Alpha Org" }),
        ).toBeInTheDocument();
    });

    it("closes delete confirmation modal when Escape key is pressed", async () => {
        const user = userEvent.setup();
        render(<OrganizationsPanel />);

        await user.click(screen.getByRole("button", { name: "Alpha Org" }));
        await user.click(
            screen.getByRole("button", { name: "Delete Organization" }),
        );

        expect(
            screen.getByText(/This will delete "Alpha Org"/),
        ).toBeInTheDocument();

        await user.keyboard("{Escape}");

        await waitFor(() => {
            expect(
                screen.queryByText(/This will delete "Alpha Org"/),
            ).not.toBeInTheDocument();
        });

        expect(
            screen.getByRole("heading", { name: "Alpha Org" }),
        ).toBeInTheDocument();
    });
});
