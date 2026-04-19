import { useEffect, useId, useRef, useState } from "react";
import "./PeriodSelector.css";

export type PeriodValue = {
    startDate: string;
    endDate: string;
};

type DatePreset = "this-week" | "this-month" | "custom";

type PeriodSelectorProps = {
    label: string;
    value: PeriodValue | null;
    onChange: (period: PeriodValue) => void;
    defaultPreset?: Exclude<DatePreset, "custom">;
};

const toIsoDate = (date: Date): string => date.toISOString().split("T")[0];

const getPresetPeriod = (
    preset: Exclude<DatePreset, "custom">,
): PeriodValue => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (preset === "this-week") {
        const dayOfWeek = today.getDay();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - dayOfWeek);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);

        return {
            startDate: toIsoDate(startDate),
            endDate: toIsoDate(endDate),
        };
    }

    return {
        startDate: toIsoDate(
            new Date(today.getFullYear(), today.getMonth(), 1),
        ),
        endDate: toIsoDate(
            new Date(today.getFullYear(), today.getMonth() + 1, 0),
        ),
    };
};

const formatPeriodLabel = (value: PeriodValue | null): string => {
    if (!value) {
        return "No period selected";
    }

    const start = new Date(value.startDate);
    const end = new Date(value.endDate);

    return `${start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    })} – ${end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    })}`;
};

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
    label,
    value,
    onChange,
    defaultPreset = "this-month",
}) => {
    // Shared selector keeps history and summary aligned instead of adding panel-specific variants.
    const inputId = useId();
    const hasAppliedDefault = useRef(false);
    const [preset, setPreset] = useState<DatePreset>(defaultPreset);
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");

    useEffect(() => {
        if (hasAppliedDefault.current) {
            return;
        }

        onChange(getPresetPeriod(defaultPreset));
        hasAppliedDefault.current = true;
    }, [defaultPreset, onChange]);

    const handlePresetChange = (nextPreset: DatePreset) => {
        if (nextPreset === "custom") {
            setPreset("custom");
            setCustomStart(value?.startDate || "");
            setCustomEnd(value?.endDate || "");
            return;
        }

        setPreset(nextPreset);
        onChange(getPresetPeriod(nextPreset));
    };

    const handleApplyCustom = () => {
        if (!customStart || !customEnd || customStart > customEnd) {
            return;
        }

        setPreset("custom");
        onChange({
            startDate: customStart,
            endDate: customEnd,
        });
    };

    return (
        <div className="period-selector">
            <div className="period-selector__header">
                <span className="period-selector__label">{label}</span>
                <span className="period-selector__value">
                    {formatPeriodLabel(value)}
                </span>
            </div>

            <div
                className="period-selector__buttons"
                role="group"
                aria-label={label}
            >
                <button
                    type="button"
                    className={`period-selector__button ${
                        preset === "this-month"
                            ? "period-selector__button--active"
                            : ""
                    }`}
                    onClick={() => handlePresetChange("this-month")}
                >
                    This Month
                </button>
                <button
                    type="button"
                    className={`period-selector__button ${
                        preset === "this-week"
                            ? "period-selector__button--active"
                            : ""
                    }`}
                    onClick={() => handlePresetChange("this-week")}
                >
                    This Week
                </button>
                <button
                    type="button"
                    className={`period-selector__button ${
                        preset === "custom"
                            ? "period-selector__button--active"
                            : ""
                    }`}
                    onClick={() => handlePresetChange("custom")}
                >
                    Custom
                </button>
            </div>

            {preset === "custom" && (
                <div className="period-selector__custom-range">
                    <label
                        className="period-selector__field"
                        htmlFor={`${inputId}-start`}
                    >
                        <span>Start</span>
                        <input
                            id={`${inputId}-start`}
                            type="date"
                            value={customStart}
                            onChange={(event) =>
                                setCustomStart(event.target.value)
                            }
                        />
                    </label>
                    <label
                        className="period-selector__field"
                        htmlFor={`${inputId}-end`}
                    >
                        <span>End</span>
                        <input
                            id={`${inputId}-end`}
                            type="date"
                            value={customEnd}
                            onChange={(event) =>
                                setCustomEnd(event.target.value)
                            }
                        />
                    </label>
                    <button
                        type="button"
                        className="period-selector__apply"
                        onClick={handleApplyCustom}
                        disabled={
                            !customStart ||
                            !customEnd ||
                            customStart > customEnd
                        }
                    >
                        Apply
                    </button>
                </div>
            )}
        </div>
    );
};
