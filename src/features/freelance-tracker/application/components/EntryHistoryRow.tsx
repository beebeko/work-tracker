import type { Entry, Id } from "@/features/freelance-tracker/contracts/types";
import {
    calculateHours,
    getEntryPay,
    getEffectiveRate,
} from "./EntryHistory.utils";

type EntryHistoryRowProps = {
    entry: Entry;
    /** Zero-based row index used for alternating stripe class. */
    index: number;
    onEdit?: (entryId: Id) => void;
    onDeleteRequest: (entryId: Id) => void;
};

export const EntryHistoryRow: React.FC<EntryHistoryRowProps> = ({
    entry,
    index,
    onEdit,
    onDeleteRequest,
}) => {
    const hours = calculateHours(entry.startTime, entry.endTime);
    const pay = getEntryPay(entry, hours);
    const effectiveRate = getEffectiveRate(entry, hours);
    const isFlatFee = entry.paymentMode === "flat-fee";

    return (
        <tr
            className={`entry-history__row ${index % 2 === 0 ? "entry-history__row--striped" : ""} ${isFlatFee ? "entry-history__row--flat-fee" : ""}`}
        >
            <td className="entry-history__cell">
                {new Date(entry.dateWorked).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "2-digit",
                })}
            </td>
            <td className="entry-history__cell">
                {entry.position}
                {isFlatFee && (
                    <span className="entry-history__badge">Flat Fee</span>
                )}
            </td>
            <td className="entry-history__cell">
                {entry.startTime} – {entry.endTime}
            </td>
            <td className="entry-history__cell">{hours.toFixed(1)}h</td>
            <td className="entry-history__cell">
                {effectiveRate !== null
                    ? `$${effectiveRate.toFixed(2)}/hr`
                    : "—"}
            </td>
            <td className="entry-history__cell">
                {pay !== null ? `$${pay.toFixed(2)}` : "—"}
            </td>
            <td className="entry-history__cell">
                <div className="entry-history__tags">
                    {entry.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="entry-history__tag">
                            {tag}
                        </span>
                    ))}
                    {entry.tags.length > 3 && (
                        <span className="entry-history__tag-more">
                            +{entry.tags.length - 3}
                        </span>
                    )}
                </div>
            </td>
            <td className="entry-history__cell entry-history__cell--actions">
                <button
                    className="entry-history__action-btn entry-history__action-btn--edit"
                    onClick={() => onEdit?.(entry.entryId)}
                    title="Edit entry"
                >
                    Edit
                </button>
                <button
                    className="entry-history__action-btn entry-history__action-btn--delete"
                    onClick={() => onDeleteRequest(entry.entryId)}
                    title="Delete entry"
                    aria-label="Delete entry"
                >
                    Remove
                </button>
            </td>
        </tr>
    );
};
