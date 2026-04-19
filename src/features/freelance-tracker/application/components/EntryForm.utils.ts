import type {
    DalError,
    Entry,
    Id,
    Organization,
} from "@/features/freelance-tracker/contracts/types";

export type EntryFormValues = {
    organizationId: Id;
    organizationName: string;
    dateWorked: string;
    startTime: string;
    endTime: string;
    venue: string;
    position: string;
    paymentMode: "hourly" | "flat-fee";
    rate: string;
    flatFeeAmount: string;
    event: string;
    tagInput: string;
    tags: string[];
    notes: string;
    mealPenaltyCount: number;
};

export type EntryFormInitialValues = Omit<
    Entry,
    "entryId" | "createdAt" | "updatedAt"
>;

export type AutocompleteState = {
    field: "organization" | "venue" | "position" | "tags" | null;
    suggestions: string[];
    selectedIndex: number;
};

export const EMPTY_AUTOCOMPLETE_STATE: AutocompleteState = {
    field: null,
    suggestions: [],
    selectedIndex: -1,
};

export const getErrorMsg = (error: DalError, fallback: string): string => {
    if (error.type === "notFound") return fallback;
    return error.message;
};

const toMinutes = (timeValue: string): number | null => {
    const [hours, minutes] = timeValue.split(":").map(Number);
    if (
        !Number.isFinite(hours) ||
        !Number.isFinite(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return null;
    }
    return hours * 60 + minutes;
};

export const calculateDurationHours = (
    startTime: string,
    endTime: string,
): number => {
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);

    if (startMinutes === null || endMinutes === null) {
        return 0;
    }

    if (startMinutes === endMinutes) {
        return 0;
    }

    const diffMinutes =
        endMinutes > startMinutes
            ? endMinutes - startMinutes
            : 24 * 60 - startMinutes + endMinutes;

    return diffMinutes / 60;
};

const normalizeOrganizationName = (value: string): string =>
    value.trim().replace(/\s+/g, " ").toLowerCase();

export const normalizeCatalogName = (value: string): string =>
    value.trim().replace(/\s+/g, " ");

export const normalizeCatalogKey = (value: string): string =>
    normalizeCatalogName(value).toLowerCase();

export const findOrganizationByName = (
    organizations: Array<Pick<Organization, "organizationId" | "name">>,
    name: string,
) => {
    const normalizedName = normalizeOrganizationName(name);
    if (!normalizedName) {
        return null;
    }

    return (
        organizations.find(
            (organization) =>
                normalizeOrganizationName(organization.name) === normalizedName,
        ) || null
    );
};

export const getOrganizationNameById = (
    organizations: Organization[],
    organizationId: Id,
): string => {
    return (
        organizations.find((org) => org.organizationId === organizationId)
            ?.name || ""
    );
};

export const createValuesFromInitial = (
    initialValues: EntryFormInitialValues,
    organizationName: string,
): EntryFormValues => ({
    organizationId: initialValues.organizationId,
    organizationName,
    dateWorked: initialValues.dateWorked,
    startTime: initialValues.startTime,
    endTime: initialValues.endTime,
    venue: initialValues.venue || "",
    position: initialValues.position,
    paymentMode: initialValues.paymentMode ?? "hourly",
    rate: initialValues.rate?.toString() || "",
    flatFeeAmount: initialValues.flatFeeAmount?.toString() || "",
    event: initialValues.event || "",
    tagInput: "",
    tags: initialValues.tags,
    notes: initialValues.notes || "",
    mealPenaltyCount: initialValues.mealPenaltyCount ?? 0,
});

export const createDefaultEntryValues = (
    organizationId: Id,
    organizationName: string,
): EntryFormValues => ({
    organizationId,
    organizationName,
    dateWorked: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "17:00",
    venue: "",
    position: "",
    paymentMode: "hourly",
    rate: "",
    flatFeeAmount: "",
    event: "",
    tagInput: "",
    tags: [],
    notes: "",
    mealPenaltyCount: 0,
});
