import type {
    Entry,
    EntryPaymentMode,
} from "@/features/freelance-tracker/contracts/types";

function timeToMinutes(timeStr: string): number | null {
    const [hours, minutes] = timeStr.split(":").map(Number);
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
}

export function resolveEntryPaymentMode(entry: Entry): EntryPaymentMode {
    return entry.paymentMode === "flat-fee" ? "flat-fee" : "hourly";
}

export function calculateEntryDurationHours(entry: Entry): number {
    const startMinutes = timeToMinutes(entry.startTime);
    const endMinutes = timeToMinutes(entry.endTime);
    if (startMinutes === null || endMinutes === null) {
        return 0;
    }

    if (endMinutes === startMinutes) {
        return 0;
    }

    const diffMinutes =
        endMinutes > startMinutes
            ? endMinutes - startMinutes
            : 24 * 60 - startMinutes + endMinutes;

    return diffMinutes / 60;
}

export function resolveEntryEffectiveRate(entry: Entry): number | null {
    if (resolveEntryPaymentMode(entry) === "hourly") {
        return entry.rate;
    }

    const flatFeeAmount =
        typeof entry.flatFeeAmount === "number" ? entry.flatFeeAmount : 0;
    const durationHours = calculateEntryDurationHours(entry);
    if (!Number.isFinite(durationHours) || durationHours <= 0) {
        return 0;
    }
    return flatFeeAmount / durationHours;
}

export function resolveEntryBasePay(
    entry: Entry,
    hours: number,
): number | null {
    if (resolveEntryPaymentMode(entry) === "flat-fee") {
        return typeof entry.flatFeeAmount === "number"
            ? entry.flatFeeAmount
            : 0;
    }
    return entry.rate !== null ? hours * entry.rate : null;
}

export function isHourlyEntryWithoutRate(entry: Entry): boolean {
    return resolveEntryPaymentMode(entry) === "hourly" && entry.rate === null;
}
