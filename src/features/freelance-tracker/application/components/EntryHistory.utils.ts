import type { Entry } from "@/features/freelance-tracker/contracts/types";

export const toMinutes = (value: string): number | null => {
    const [hours, minutes] = value.split(":").map(Number);
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

export const calculateHours = (startTime: string, endTime: string): number => {
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    if (startMinutes === null || endMinutes === null) return 0;
    if (startMinutes === endMinutes) return 0;
    const diffMinutes =
        endMinutes > startMinutes
            ? endMinutes - startMinutes
            : 24 * 60 - startMinutes + endMinutes;
    return diffMinutes / 60;
};

export const getEntryPay = (entry: Entry, hours: number): number | null => {
    if (entry.paymentMode === "flat-fee") {
        return typeof entry.flatFeeAmount === "number"
            ? entry.flatFeeAmount
            : 0;
    }
    return typeof entry.rate === "number" ? entry.rate * hours : null;
};

export const getEffectiveRate = (
    entry: Entry,
    hours: number,
): number | null => {
    if (entry.paymentMode === "flat-fee") {
        const flatFee =
            typeof entry.flatFeeAmount === "number" ? entry.flatFeeAmount : 0;
        return hours > 0 ? flatFee / hours : 0;
    }
    return entry.rate;
};
