import { calculateDurationHours } from "./EntryForm.utils";

type EntryFormPaySectionProps = {
    paymentMode: "hourly" | "flat-fee";
    rate: string;
    flatFeeAmount: string;
    startTime: string;
    endTime: string;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
};

const PayModeFieldset: React.FC<{
    paymentMode: "hourly" | "flat-fee";
    onChange: React.ChangeEventHandler<HTMLInputElement>;
}> = ({ paymentMode, onChange }) => (
    <fieldset className="entry-form__field entry-form__payment-mode">
        <legend>Pay Mode</legend>
        <label
            className="entry-form__payment-choice"
            htmlFor="paymentModeHourly"
        >
            <input
                id="paymentModeHourly"
                type="radio"
                name="paymentMode"
                value="hourly"
                checked={paymentMode === "hourly"}
                onChange={onChange}
            />
            <span className="entry-form__payment-choice-label">Hourly</span>
        </label>
        <label
            className="entry-form__payment-choice"
            htmlFor="paymentModeFlatFee"
        >
            <input
                id="paymentModeFlatFee"
                type="radio"
                name="paymentMode"
                value="flat-fee"
                checked={paymentMode === "flat-fee"}
                onChange={onChange}
            />
            <span className="entry-form__payment-choice-label">Flat Fee</span>
        </label>
    </fieldset>
);

export const EntryFormPaySection: React.FC<EntryFormPaySectionProps> = ({
    paymentMode,
    rate,
    flatFeeAmount,
    startTime,
    endTime,
    onChange,
}) => {
    if (paymentMode === "hourly") {
        return (
            <div className="entry-form__row">
                <div className="entry-form__field">
                    <label htmlFor="rate">Hourly Rate (optional)</label>
                    <input
                        id="rate"
                        type="number"
                        name="rate"
                        value={rate}
                        onChange={onChange}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                    />
                </div>
                <PayModeFieldset
                    paymentMode={paymentMode}
                    onChange={onChange}
                />
            </div>
        );
    }

    const durationHours = calculateDurationHours(startTime, endTime);
    const effectiveRate =
        durationHours > 0 ? Number(flatFeeAmount || 0) / durationHours : 0;

    return (
        <>
            <div className="entry-form__field">
                <label htmlFor="flatFeeAmount">Flat-Fee Amount</label>
                <input
                    id="flatFeeAmount"
                    type="number"
                    name="flatFeeAmount"
                    value={flatFeeAmount}
                    onChange={onChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                />
                <p className="entry-form__hint">
                    Enter total shift pay. Effective rate is calculated from
                    tracked time.
                </p>
                {flatFeeAmount && (
                    <p className="entry-form__hint entry-form__hint--derived">
                        Effective Rate: ${effectiveRate.toFixed(2)}/hr
                    </p>
                )}
            </div>
            <PayModeFieldset paymentMode={paymentMode} onChange={onChange} />
        </>
    );
};
