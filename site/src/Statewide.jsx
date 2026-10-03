import React from "react";
import TimeChart from "./TimeChart.jsx";
import { apDate, apMonthYear, num, pct, pct1, yearOf } from "./format.js";

// Rust is "beyond capacity" everywhere on the page: the top bar, every facility's bar, the shading on a chart.
export const COLOR = { population: "var(--chart-1)", capacity: "var(--chart-ref)", over: "var(--chart-2)" };

export default function Statewide({ statewide, changes }) {
  const dates = statewide.map((w) => w.date);
  const last = statewide.length - 1;
  const now = statewide[last];
  // One capacity line: the 2008 rename from operating to design capacity changed the label, not the measure.
  const series = [
    { key: "capacity", label: "Capacity", color: COLOR.capacity, width: 1.5,
      values: statewide.map((w) => w.capacity), endLabel: num(now.capacity) },
    { key: "population", label: "People held", color: COLOR.population,
      values: statewide.map((w) => w.population), endLabel: num(now.population) },
  ];

  // The three turns in the line, found in the data rather than typed in.
  const at = (i, text, place, wideOnly) => ({ index: i, value: statewide[i].population, text, place, wideOnly, color: COLOR.population });
  const contractPeak = statewide.reduce((best, w, i) => (w.contract_population > statewide[best].contract_population ? i : best), 0);
  const since2020 = statewide.findIndex((w) => w.date >= "2020-01-01");
  const low = statewide.reduce((best, w, i) => (i >= since2020 && w.population < statewide[best].population ? i : best), since2020);
  const oldPeak = statewide.findIndex((w) => w.date === changes.population.prior_peak.date);
  const marks = [
    at(contractPeak, `${apMonthYear(dates[contractPeak])}: ${num(statewide[contractPeak].contract_population)} of them in contract beds`, "below", true),
    at(low, `${apMonthYear(dates[low])}: ${num(statewide[low].population)}`, "below"),
    // In a record week this is the record it broke; in any other week, the record that still stands.
    ...(oldPeak >= 0 && oldPeak !== last ? [at(oldPeak, `${apMonthYear(dates[oldPeak])}: ${num(statewide[oldPeak].population)}`, "above", true)] : []),
  ];

  const allValues = statewide.flatMap((w) => [w.population, w.capacity]);
  const floor = Math.floor(Math.min(...allValues) / 2000) * 2000;
  const ceiling = Math.ceil(Math.max(...allValues) / 2000) * 2000;

  // The table twin of the chart: the last report of each year. The full weekly series is the CSV.
  const yearly = statewide.filter((w, i) => i === last || yearOf(statewide[i + 1].date) !== yearOf(w.date));

  return (
    <section id="statewide" tabIndex={-1}>
      {/* The bar above already says how far over capacity the system is; this heading says where the line has gone. */}
      <h2>{low !== last && now.population > statewide[low].population
        ? <>From {num(statewide[low].population)} in {yearOf(dates[low])} to {num(now.population)} this week</>
        : <>Every week since 1999</>}</h2>
      <p className="section-dek">
        Every weekly count since 1999. The gray line is capacity: what the prisons were built to
        hold, plus the contract beds the state rents in county jails and, in the early 2000s, in
        other states, each counted as full. The shaded gap is everyone beyond it.
      </p>
      <TimeChart
        dates={dates} series={series} marks={marks} yMin={floor} yMax={ceiling} height={380}
        wash={{ upper: "population", lower: ["capacity"], color: COLOR.over }}
        label="Line chart: people held in Wisconsin's adult prison system and its capacity, weekly since 1999."
        tooltipNote={(i) => {
          const w = statewide[i];
          return `${num(w.population - w.capacity)} over capacity (${pct1(pct(w.population, w.capacity))})`;
        }}
      >
        <details className="table-view">
          <summary>Show these figures as a table<span className="visually-hidden">: people held and capacity</span></summary>
          <table>
            <caption>People held and capacity, the last report of each year. The full weekly record is in the downloads below.</caption>
            <thead>
              <tr><th scope="col">Report</th><th scope="col" className="n">People held</th><th scope="col" className="n">Capacity</th><th scope="col" className="n">Percent</th><th scope="col" className="full">Capacity type</th></tr>
            </thead>
            <tbody>
              {yearly.slice().reverse().map((w) => (
                <tr key={w.date}>
                  <th scope="row">{apDate(w.date)}</th>
                  <td className="n">{num(w.population)}</td>
                  <td className="n">{num(w.capacity)}</td>
                  <td className="n">{pct1(pct(w.population, w.capacity))}</td>
                  <td className="full">{w.capacity_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </TimeChart>
      <p className="chart-note">
        The vertical scale starts at {num(floor)}, not zero. Before 2005 the capacity line rises
        and falls with the beds the state rented out of state, and it steps up where a new
        prison&rsquo;s beds were counted before the prison filled. In March 2008 the department
        renamed the figure from operating to design capacity without changing its definition.
        Move across the chart, or select it and use the arrow keys, to read any week.
      </p>
    </section>
  );
}
