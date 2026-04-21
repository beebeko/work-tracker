import { describe, expect, it } from "vitest";
import { JsonDataLayer } from "../adapters/json.adapter";

function hasFunction(obj: unknown, key: string) {
    return typeof (obj as Record<string, unknown>)[key] === "function";
}

describe("IDataLayer contract compliance", () => {
    it("implements all IDataLayer repositories and lifecycle methods", () => {
        const dal = new JsonDataLayer() as any;

        expect(dal.entries).toBeDefined();
        expect(dal.organizations).toBeDefined();
        expect(dal.tags).toBeDefined();
        expect(dal.positions).toBeDefined();
        expect(dal.venues).toBeDefined();
        expect(dal.transaction).toBeDefined();
        expect(hasFunction(dal.rulesets, "listAll")).toBe(true);

        expect(hasFunction(dal, "initialize")).toBe(true);
        expect(hasFunction(dal, "dispose")).toBe(true);
        expect(hasFunction(dal.transaction, "transaction")).toBe(true);
    });

    it("repository methods return Promise<Result<T>> shape", async () => {
        const dal = new JsonDataLayer() as any;

        const orgCreate = await dal.organizations.create({
            name: "Contract Org",
            payPeriodStartDay: 2,
        });
        expect(typeof orgCreate.success).toBe("boolean");

        const orgId = orgCreate.success
            ? orgCreate.data.organizationId
            : "org-1";

        const entryCreate = await dal.entries.create({
            organizationId: orgId,
            date: "2026-04-14",
            startTime: "09:00",
            endTime: "10:00",
            position: "A1",
            rate: 20,
            event: "E",
            tags: [],
            notes: "",
        });

        expect(typeof entryCreate.success).toBe("boolean");

        const notFound = await dal.entries.getById("entry-does-not-exist");
        expect(notFound.success).toBe(false);
        if (!notFound.success) {
            expect(typeof notFound.error).toBe("object");
            expect(notFound.error.type).toBe("notFound");
            expect((notFound.error as any).entityType).toBe("Entry");
        }
    });

    it("surfaces explicit DAL errors without silent failures", async () => {
        const dal = new JsonDataLayer() as any;

        const invalidOrg = await dal.organizations.create({
            name: "Bad",
            payPeriodStartDay: -1,
        });

        expect(invalidOrg.success).toBe(false);
        if (!invalidOrg.success) {
            expect(invalidOrg.error.type).toBeDefined();
            expect(invalidOrg.error.message).toBeTruthy();
        }
    });
});
