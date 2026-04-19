/**
 * PaySummary - Display pay calculations and period selection
 * KPI-style cards with gross pay, hours, entry counts
 */

import { useCallback, useEffect, useState } from "react";
import {
    useEmployerPeriodAggregation,
    useFreelanceTracker,
    useGrossPayCalculation,
    type EmployerPeriodAggregate,
} from "../hooks";
import { isOk } from "@/features/freelance-tracker/contracts/types";
import type { Id } from "@/features/freelance-tracker/contracts/types";
import type { GrossPayResult } from "@/features/freelance-tracker/domain/services";
import { PeriodSelector, type PeriodValue } from "./PeriodSelector";
import { EmployerPieChart, type EmployerPieMetric } from "./EmployerPieChart";
import "./PaySummary.css";

export const PaySummary: React.FC = () => {
    const store = useFreelanceTracker();
    const [hasMounted, setHasMounted] = useState(false);
    const grossPay = useGrossPayCalculation();
    const employerAggregation = useEmployerPeriodAggregation();
    const [filterByOrg, setFilterByOrg] = useState(false);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState<
        Id | ""
    >("");
    const selectedOrganizationName =
        store.organizations.find(
            (org) => org.organizationId === selectedOrganizationId,
        )?.name ?? null;

    const [selectedPeriod, setSelectedPeriod] = useState<PeriodValue | null>(
        null,
    );
    const [payResult, setPayResult] = useState<GrossPayResult | null>(null);
    const [calculating, setCalculating] = useState(false);
    const [chartMetric, setChartMetric] = useState<EmployerPieMetric>("hours");
    const [chartData, setChartData] = useState<EmployerPeriodAggregate[]>([]);
    const [chartLoading, setChartLoading] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    useEffect(() => {
        if (!filterByOrg) return;
        if (store.organizations.length === 0) {
            setSelectedOrganizationId("");
            return;
        }
        if (
            selectedOrganizationId &&
            store.organizations.some(
                (organization) =>
                    organization.organizationId === selectedOrganizationId,
            )
        ) {
            return;
        }
        setSelectedOrganizationId(store.organizations[0].organizationId);
    }, [filterByOrg, store.organizations, selectedOrganizationId]);

    // Calculate gross pay when org or period changes
    useEffect(() => {
        const calculate = async () => {
            if (!selectedPeriod) {
                setPayResult(null);
                return;
            }

            if (filterByOrg) {
                // Single-org mode
                if (!selectedOrganizationId) {
                    setPayResult(null);
                    return;
                }
                setCalculating(true);
                try {
                    const result = await grossPay.calculateGrossPay(
                        selectedOrganizationId,
                        selectedPeriod,
                    );
                    if (isOk(result)) {
                        setPayResult(result.data);
                    } else {
                        setPayResult(null);
                    }
                } finally {
                    setCalculating(false);
                }
            } else {
                // All-orgs mode: sum results across all orgs
                if (store.organizations.length === 0) {
                    setPayResult(null);
                    return;
                }
                setCalculating(true);
                try {
                    const results = await Promise.all(
                        store.organizations.map((org) =>
                            grossPay.calculateGrossPay(
                                org.organizationId,
                                selectedPeriod,
                            ),
                        ),
                    );
                    const succeeded = results.filter(isOk).map((r) => r.data);
                    if (succeeded.length === 0) {
                        setPayResult(null);
                        return;
                    }
                    const totalPayAcrossOrgs = succeeded.reduce(
                        (s, r) => s + r.totalPay,
                        0,
                    );
                    setPayResult({
                        totalPay: totalPayAcrossOrgs,
                        totalHours: succeeded.reduce(
                            (s, r) => s + r.totalHours,
                            0,
                        ),
                        breakdown: succeeded.flatMap((r) => r.breakdown),
                        entriesWithoutRate: succeeded.reduce(
                            (s, r) => s + r.entriesWithoutRate,
                            0,
                        ),
                        ruleLines: [],
                        rulePremiumAmount: 0,
                        totalWithPremiums: succeeded.reduce(
                            (s, r) => s + r.totalPay,
                            0,
                        ),
                        ruleWarnings: [],
                        cumulativePay: totalPayAcrossOrgs,
                    });
                } finally {
                    setCalculating(false);
                }
            }
        };

        void calculate();
    }, [
        filterByOrg,
        selectedOrganizationId,
        selectedPeriod,
        store.organizations,
        store.entries,
        grossPay.calculateGrossPay,
    ]);

    const handlePeriodChange = useCallback((period: PeriodValue) => {
        setSelectedPeriod(period);
    }, []);

    useEffect(() => {
        const calculateByEmployer = async () => {
            if (!selectedPeriod || store.organizations.length === 0) {
                setChartData([]);
                return;
            }

            setChartLoading(true);
            try {
                const result =
                    await employerAggregation.calculateByEmployerForPeriod(
                        store.organizations,
                        selectedPeriod,
                    );

                if (isOk(result)) {
                    setChartData(result.data);
                } else {
                    setChartData([]);
                }
            } finally {
                setChartLoading(false);
            }
        };

        void calculateByEmployer();
    }, [
        selectedPeriod,
        store.organizations,
        store.entries,
        employerAggregation.calculateByEmployerForPeriod,
    ]);

    return (
        <div className="pay-summary">
            <div className="pay-summary__panel-header">
                <div>
                    <h2 className="pay-summary__title">Pay Summary</h2>
                </div>
            </div>

            <div className="pay-summary__controls">
                <div className="pay-summary__field">
                    <label htmlFor="summary-organization-filter">
                        Organization
                    </label>
                    <div className="pay-summary__filter-row">
                        <input
                            type="checkbox"
                            id="pay-summary-filter-by-org"
                            checked={hasMounted && filterByOrg}
                            onChange={(e) => {
                                setFilterByOrg(e.currentTarget.checked);
                                if (!e.currentTarget.checked) {
                                    setSelectedOrganizationId("");
                                }
                            }}
                        />
                        <label htmlFor="pay-summary-filter-by-org">
                            Filter by organization
                        </label>
                    </div>
                    <select
                        id="summary-organization-filter"
                        value={selectedOrganizationId}
                        onChange={(event) =>
                            setSelectedOrganizationId(
                                event.currentTarget.value as Id | "",
                            )
                        }
                        disabled={
                            !filterByOrg || store.organizations.length === 0
                        }
                    >
                        {!filterByOrg ? (
                            <option value="">All organizations</option>
                        ) : store.organizations.length === 0 ? (
                            <option value="">No organizations</option>
                        ) : (
                            store.organizations.map((organization) => (
                                <option
                                    key={organization.organizationId}
                                    value={organization.organizationId}
                                >
                                    {organization.name}
                                </option>
                            ))
                        )}
                    </select>
                </div>

                {/* Period Selector */}
                <PeriodSelector
                    label="Summary Period"
                    value={selectedPeriod}
                    onChange={handlePeriodChange}
                    defaultPreset="this-month"
                />

                <p className="pay-summary__help-text">
                    {filterByOrg
                        ? selectedOrganizationName
                            ? `Showing summary for ${selectedOrganizationName}. `
                            : "Select an organization to view summary totals. "
                        : "Totals across all organizations. "}
                    Flat-fee shifts contribute their full amount to gross pay.
                    Effective rates are derived from tracked shift duration.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="pay-summary__cards">
                {calculating ? (
                    <div className="pay-summary__loading">Loading...</div>
                ) : payResult ? (
                    <>
                        {/* ── Base Pay section ──────────────────────────── */}
                        <div className="pay-summary__section-label">
                            Base Pay
                        </div>
                        <div className="pay-summary__card pay-summary__card--primary">
                            <div className="pay-summary__card-value">
                                ${payResult.totalPay.toFixed(2)}
                            </div>
                            <div className="pay-summary__card-label">
                                Gross Pay (Hourly + Flat Fee)
                            </div>
                        </div>

                        <div className="pay-summary__card">
                            <div className="pay-summary__card-value">
                                {payResult.totalHours.toFixed(1)}
                            </div>
                            <div className="pay-summary__card-label">Hours</div>
                        </div>

                        <div className="pay-summary__card">
                            <div className="pay-summary__card-value">
                                {payResult.breakdown.length}
                            </div>
                            <div className="pay-summary__card-label">
                                Entries
                            </div>
                        </div>

                        {payResult.entriesWithoutRate > 0 && (
                            <div className="pay-summary__card pay-summary__card--warning">
                                <div className="pay-summary__card-value">
                                    {payResult.entriesWithoutRate}
                                </div>
                                <div className="pay-summary__card-label">
                                    Unrated Hourly
                                </div>
                            </div>
                        )}

                        <div className="pay-summary__section-label pay-summary__section-label--break">
                            Employer Distribution
                        </div>
                        <div className="pay-summary__chart-wrap">
                            {chartLoading ? (
                                <div className="pay-summary__loading">
                                    Loading employer chart...
                                </div>
                            ) : (
                                <EmployerPieChart
                                    data={chartData}
                                    metric={chartMetric}
                                    onMetricChange={setChartMetric}
                                />
                            )}
                        </div>

                        {/* ── Premiums section ──────────────────────────── */}
                        {payResult.ruleLines.length > 0 && (
                            <>
                                <div className="pay-summary__section-label pay-summary__section-label--break">
                                    Premiums
                                </div>

                                {payResult.ruleLines.map((line) => (
                                    <div
                                        key={line.ruleId}
                                        className="pay-summary__rule-line"
                                    >
                                        <div className="pay-summary__rule-line-label">
                                            {line.ruleLabel || line.ruleType}
                                        </div>
                                        <div className="pay-summary__rule-line-values">
                                            {line.totalPremiumHours > 0 && (
                                                <span className="pay-summary__rule-line-hours">
                                                    {line.totalPremiumHours.toFixed(
                                                        2,
                                                    )}
                                                    h
                                                </span>
                                            )}
                                            <span className="pay-summary__rule-line-amount">
                                                +$
                                                {line.totalPremiumAmount.toFixed(
                                                    2,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {payResult.ruleWarnings.map((w, i) => (
                                    <div
                                        key={i}
                                        className="pay-summary__rule-warning"
                                        role="alert"
                                    >
                                        ⚠ {w}
                                    </div>
                                ))}

                                {/* ── Total line ──────────────────────────── */}
                                <div className="pay-summary__section-label pay-summary__section-label--break">
                                    Total
                                </div>
                                <div className="pay-summary__card pay-summary__card--total">
                                    <div className="pay-summary__card-value">
                                        $
                                        {payResult.totalWithPremiums.toFixed(2)}
                                    </div>
                                    <div className="pay-summary__card-label">
                                        With Premiums
                                    </div>
                                </div>
                            </>
                        )}

                        {payResult.cumulativePay > 0 && (
                            <div className="pay-summary__card pay-summary__card--cumulative">
                                <div className="pay-summary__card-value">
                                    ${payResult.cumulativePay.toFixed(2)}
                                </div>
                                <div className="pay-summary__card-label">
                                    Total (All Orgs)
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="pay-summary__placeholder">
                        Select an organization and period to view pay summary
                    </div>
                )}
            </div>
        </div>
    );
};
