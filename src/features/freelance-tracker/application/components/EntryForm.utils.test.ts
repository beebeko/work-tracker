import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Organization } from "@/features/freelance-tracker/contracts/types";
import {
    calculateDurationHours,
    createDefaultEntryValues,
    createValuesFromInitial,
    findOrganizationByName,
    getErrorMsg,
    getOrganizationNameById,
    normalizeCatalogKey,
    normalizeCatalogName,
} from "./EntryForm.utils";
import { makeEntry, makeOrganization, testId } from "../../test-utils/fixtures";

describe("EntryForm utils", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-04-18T10:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("calculates duration for same-day and overnight shifts", () => {
        expect(calculateDurationHours("09:00", "17:30")).toBe(8.5);
        expect(calculateDurationHours("22:00", "02:00")).toBe(4);
    });

    it("returns zero duration for invalid or zero-length times", () => {
        expect(calculateDurationHours("25:00", "02:00")).toBe(0);
        expect(calculateDurationHours("09:00", "09:00")).toBe(0);
        expect(calculateDurationHours("bad", "data")).toBe(0);
    });

    it("normalizes catalog names and keys for matching", () => {
        expect(normalizeCatalogName("  Front   Of   House ")).toBe(
            "Front Of House",
        );
        expect(normalizeCatalogKey("  Front   Of   House ")).toBe(
            "front of house",
        );
    });

    it("finds organizations by name with case and whitespace tolerance", () => {
        const orgA = makeOrganization({ name: "The Venue" });
        const orgB = makeOrganization({ name: "Acme Audio" });

        const match = findOrganizationByName([orgA, orgB], "  the   venue  ");
        const noMatch = findOrganizationByName([orgA, orgB], "Unknown");

        expect(match?.organizationId).toBe(orgA.organizationId);
        expect(noMatch).toBeNull();
    });

    it("returns organization name by id or an empty string when missing", () => {
        const orgs: Organization[] = [makeOrganization({ name: "Org A" })];

        expect(getOrganizationNameById(orgs, orgs[0].organizationId)).toBe(
            "Org A",
        );
        expect(getOrganizationNameById(orgs, testId("org"))).toBe("");
    });

    it("creates default entry values with deterministic date and defaults", () => {
        const organizationId = testId("org");
        const values = createDefaultEntryValues(organizationId, "Org A");

        expect(values.organizationId).toBe(organizationId);
        expect(values.organizationName).toBe("Org A");
        expect(values.dateWorked).toBe("2026-04-18");
        expect(values.paymentMode).toBe("hourly");
        expect(values.tags).toEqual([]);
        expect(values.mealPenaltyCount).toBe(0);
    });

    it("hydrates form values from initial entry including flat-fee mode", () => {
        const initialValues = makeEntry({
            paymentMode: "flat-fee",
            flatFeeAmount: 225,
            rate: null,
            tags: ["festival", "rush"],
            notes: "Bring patch cables",
            mealPenaltyCount: 2,
        });

        const values = createValuesFromInitial(initialValues, "Org A");

        expect(values.organizationId).toBe(initialValues.organizationId);
        expect(values.organizationName).toBe("Org A");
        expect(values.paymentMode).toBe("flat-fee");
        expect(values.flatFeeAmount).toBe("225");
        expect(values.rate).toBe("");
        expect(values.tags).toEqual(["festival", "rush"]);
        expect(values.notes).toBe("Bring patch cables");
        expect(values.mealPenaltyCount).toBe(2);
    });

    it("prefers fallback for notFound errors and preserves explicit messages for others", () => {
        expect(
            getErrorMsg(
                {
                    type: "notFound",
                    entityType: "Organization",
                    id: testId("org"),
                },
                "Organization no longer exists",
            ),
        ).toBe("Organization no longer exists");

        expect(
            getErrorMsg(
                {
                    type: "validation",
                    message: "Rate must be positive",
                    field: "rate",
                },
                "Fallback",
            ),
        ).toBe("Rate must be positive");
    });
});
