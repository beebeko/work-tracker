import { useId, useMemo } from "react";
import type { EmployerPeriodAggregate } from "../hooks";

export type EmployerPieMetric = "hours" | "earnings";

type EmployerPieChartProps = {
    data: EmployerPeriodAggregate[];
    metric: EmployerPieMetric;
    onMetricChange: (metric: EmployerPieMetric) => void;
};

type PieSegment = EmployerPeriodAggregate & {
    value: number;
    share: number;
};

const PIE_COLORS = [
    "#4e94ce",
    "#89d7a9",
    "#f0c86a",
    "#d98b7c",
    "#9ca3af",
    "#6fb3a2",
];

const formatMetricValue = (
    metric: EmployerPieMetric,
    value: number,
): string => {
    return metric === "hours" ? `${value.toFixed(1)}h` : `$${value.toFixed(2)}`;
};

export const EmployerPieChart: React.FC<EmployerPieChartProps> = ({
    data,
    metric,
    onMetricChange,
}) => {
    const chartTitleId = useId();
    const metricLegendId = useId();
    const metricInputName = useId();

    const segments = useMemo<PieSegment[]>(() => {
        const total = data.reduce(
            (sum, item) =>
                sum + (metric === "hours" ? item.hours : item.earnings),
            0,
        );

        if (total <= 0) {
            return [];
        }

        return data
            .map((item) => {
                const value = metric === "hours" ? item.hours : item.earnings;
                return {
                    ...item,
                    value,
                    share: value / total,
                };
            })
            .filter((item) => item.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [data, metric]);

    const totalValue = useMemo(
        () => segments.reduce((sum, segment) => sum + segment.value, 0),
        [segments],
    );

    const circumference = 2 * Math.PI * 42;
    let strokeOffset = 0;

    return (
        <section
            className="pay-summary__chart"
            aria-labelledby={chartTitleId}
            role="region"
        >
            <div className="pay-summary__chart-header">
                <h3 id={chartTitleId} className="pay-summary__chart-title">
                    Employer Breakdown
                </h3>
                <fieldset
                    className="pay-summary__chart-toggle"
                    aria-labelledby={metricLegendId}
                >
                    <legend id={metricLegendId}>Metric</legend>
                    <label>
                        <input
                            type="radio"
                            name={metricInputName}
                            value="hours"
                            checked={metric === "hours"}
                            onChange={() => onMetricChange("hours")}
                        />
                        Hours
                    </label>
                    <label>
                        <input
                            type="radio"
                            name={metricInputName}
                            value="earnings"
                            checked={metric === "earnings"}
                            onChange={() => onMetricChange("earnings")}
                        />
                        Earnings
                    </label>
                </fieldset>
            </div>

            {segments.length === 0 ? (
                <p className="pay-summary__chart-empty">
                    No period entries available for employer breakdown.
                </p>
            ) : (
                <div className="pay-summary__chart-content">
                    <div
                        className="pay-summary__chart-visual"
                        aria-hidden="true"
                    >
                        <svg
                            viewBox="0 0 120 120"
                            className="pay-summary__chart-svg"
                        >
                            <circle
                                cx="60"
                                cy="60"
                                r="42"
                                fill="none"
                                stroke="#2b2b2b"
                                strokeWidth="20"
                            />
                            {segments.map((segment, index) => {
                                const segmentLength =
                                    segment.share * circumference;
                                const currentOffset = strokeOffset;
                                strokeOffset += segmentLength;

                                return (
                                    <circle
                                        key={segment.organizationId}
                                        cx="60"
                                        cy="60"
                                        r="42"
                                        fill="none"
                                        stroke={
                                            PIE_COLORS[
                                                index % PIE_COLORS.length
                                            ]
                                        }
                                        strokeWidth="20"
                                        strokeLinecap="butt"
                                        transform="rotate(-90 60 60)"
                                        strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                                        strokeDashoffset={-currentOffset}
                                    />
                                );
                            })}
                            <text
                                x="60"
                                y="56"
                                textAnchor="middle"
                                className="pay-summary__chart-total-label"
                            >
                                Total
                            </text>
                            <text
                                x="60"
                                y="70"
                                textAnchor="middle"
                                className="pay-summary__chart-total-value"
                            >
                                {formatMetricValue(metric, totalValue)}
                            </text>
                        </svg>
                    </div>

                    <ul
                        className="pay-summary__chart-legend"
                        aria-label="Employer values"
                    >
                        {segments.map((segment, index) => (
                            <li key={segment.organizationId}>
                                <span
                                    className={`pay-summary__chart-swatch pay-summary__chart-swatch--${index % PIE_COLORS.length}`}
                                    aria-hidden="true"
                                />
                                <span className="pay-summary__chart-employer">
                                    {segment.employerName}
                                </span>
                                <span className="pay-summary__chart-metric">
                                    {formatMetricValue(metric, segment.value)}
                                </span>
                                <span className="pay-summary__chart-percent">
                                    {(segment.share * 100).toFixed(1)}%
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
};
