import React from "react";
import TimeChart from "./TimeChart.jsx";
import { apMonthYear, monthYear, num, yearOf } from "./format.js";

// Where Wisconsin has sent the people its own prisons had no room for.
export default function ContractBeds({ statewide }) {
  const now = statewide[statewide.length - 1];
  const other = (w) => w.contract_population - w.contract_county_jails - w.contract_out_of_state - w.contract_federal;
  const peak = statewide.reduce((best, w, i) => (w.contract_population > statewide[best].contract_population ? i : best), 0);
  const lastAway = statewide.reduce((found, w, i) => (w.contract_out_of_state > 0 ? i : found), 0);
  const atPeak = statewide[peak];

  return (
    <section id="contract" tabIndex={-1}>
      <h2>In {yearOf(atPeak.date)}, the overflow went out of state</h2>
      <p className="section-dek">
        In {monthYear(atPeak.date)} the state held {num(atPeak.contract_population)} people in
        what the department calls contract beds, {num(atPeak.contract_out_of_state)} of them in
        other states&rsquo; prisons and jails. The last were back by {monthYear(statewide[lastAway + 1].date)}. Today the
        overflow goes to Wisconsin county jails: {num(now.contract_county_jails)} people.
      </p>
      <TimeChart
        stacked dates={statewide.map((w) => w.date)} height={300}
        series={[
          { key: "jails", label: "Wisconsin county jails", color: "var(--chart-1)", values: statewide.map((w) => w.contract_county_jails) },
          { key: "federal", label: "Federal prisons", color: "var(--chart-3)", values: statewide.map((w) => w.contract_federal) },
          { key: "away", label: "Other states", color: "var(--chart-2)", values: statewide.map((w) => w.contract_out_of_state) },
          { key: "other", label: "Other", color: "var(--chart-other)", values: statewide.map(other) },
        ]}
        marks={[{ index: peak, value: atPeak.contract_population, color: "var(--ink)",
                  text: `${apMonthYear(atPeak.date)}: ${num(atPeak.contract_population)}` }]}
        label="Stacked area chart: people held in contract beds by where they were held, weekly since 1999."
        tooltipNote={(i) => `${num(statewide[i].contract_population)} in contract beds`}
      />
      <p className="chart-note">
        &ldquo;Other&rdquo; is mostly Prairie du Chien, a state facility the department listed
        under contract beds until 2002, and since then a few dozen people held under compacts
        with other governments.
      </p>
    </section>
  );
}
