import React from "react";
import TimeChart from "./TimeChart.jsx";
import { apDate, apMonthYear, num, pct, pct1, yearOf } from "./format.js";

export const COLOR = { population: "var(--chart-1)", capacity: "var(--chart-ref)" };

export default function Statewide({ statewide, changes }) {
  const dates = statewide.map((w) => w.date);
  const last = statewide.length - 1;
  const now = statewide[last];
  const firstDesign = statewide.findIndex((w) => w.capacity_type === "design");

  const series = [
    { key: "operating", label: "Operating capacity", legendLabel: "Capacity", color: COLOR.capacity, width: 1.5,
      values: statewide.map((w) => (w.capacity_type === "operating" ? w.capacity : null)) },
    { key: "design", label: "Design capacity", legend: false, color: COLOR.capacity, width: 1.5,
      values: statewide.map((w) => (w.capacity_type === "design" ? w.capacity : null)), endLabel: num(now.capacity) },
    { key: "population", label: "People held", color: COLOR.population,
      values: statewide.map((w) => w.population), endLabel: num(now.population) },
  ];

  // The three turns in the line, found in the data rather than typed in.
  const at = (i, text, place) => ({ index: i, value: statewide[i].population, text, place, color: COLOR.population });
  const contractPeak = statewide.reduce((best, w, i) => (w.contract_population > statewide[best].contract_population ? i : best), 0);
  const since2020 = statewide.findIndex((w) => w.date >= "2020-01-01");
  const low = statewide.reduce((best, w, i) => (i >= since2020 && w.population < statewide[best].population ? i : best), since2020);
  const oldPeak = statewide.findIndex((w) => w.date === changes.population.prior_peak.date);
  const marks = [
    at(contractPeak, `${apMonthYear(dates[contractPeak])}: ${num(statewide[contractPeak].contract_population)} of them in contract beds`, "below"),
    at(low, `${apMonthYear(dates[low])}: ${num(statewide[low].population)}`, "below"),
    ...(changes.population.record ? [at(oldPeak, `${apMonthYear(dates[oldPeak])}: ${num(statewide[oldPeak].population)}`)] : []),
  ];

  const allValues = statewide.flatMap((w) => [w.population, w.capacity]);
  const floor = Math.floor(Math.min(...allValues) / 2000) * 2000;
  const ceiling = Math.ceil(Math.max(...allValues) / 2000) * 2000;

  // The table twin of the chart: the last report of each year. The full weekly series is the CSV.
  const yearly = statewide.filter((w, i) => i === last || yearOf(statewide[i + 1].date) !== yearOf(w.date));

  return (
    <section>
      <h2>Every week since 1999</h2>
      <p className="section-dek">
        The line marked capacity is what the prisons and contract beds were meant to hold. The
        shaded gap is everyone beyond it.
      </p>
      <TimeChart
        dates={dates} series={series} marks={marks} yMin={floor} yMax={ceiling} height={380}
        wash={{ upper: "population", lower: ["operating", "design"], color: COLOR.population }}
        vrules={[{ index: firstDesign, text: "Design capacity from March 2008" }]}
        label="Line chart: people held in Wisconsin's adult prison system and its capacity, weekly since 1999."
        tooltipNote={(i) => {
          const w = statewide[i];
          return `${num(w.population - w.capacity)} over ${w.capacity_type} capacity (${pct1(pct(w.population, w.capacity))})`;
        }}
      />
      <p className="chart-note">
        The vertical scale starts at {num(floor)}, not zero. Until March 2008 the department
        reported operating capacity, which counted beds added to cope with crowding; since then
        it has reported design capacity, which does not. The two are not comparable.
      </p>
      <details className="table-view">
        <summary>Show these figures as a table</summary>
        <table>
          <caption>Last report of each year. The full weekly record is in the downloads below.</caption>
          <thead>
            <tr><th scope="col">Report</th><th scope="col" className="n">People held</th><th scope="col" className="n">Capacity</th><th scope="col" className="n">Percent</th><th scope="col">Capacity type</th></tr>
          </thead>
          <tbody>
            {yearly.slice().reverse().map((w) => (
              <tr key={w.date}>
                <th scope="row">{apDate(w.date)}</th>
                <td className="n">{num(w.population)}</td>
                <td className="n">{num(w.capacity)}</td>
                <td className="n">{pct1(pct(w.population, w.capacity))}</td>
                <td>{w.capacity_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
