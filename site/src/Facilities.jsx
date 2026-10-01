import React, { useEffect, useMemo, useState } from "react";
import TimeChart, { Sparkline } from "./TimeChart.jsx";
import { COLOR } from "./Statewide.jsx";
import { TYPE_LABEL, apDate, apMonthYear, num, pct, pct1, signed } from "./format.js";

const GROUPS = [
  { key: "prisons", label: "Prisons and centers", types: ["institution", "center", "secure", "treatment"], sort: "percent" },
  { key: "jails", label: "County jails and contract beds", types: ["county_jail", "out_of_state", "federal", "other"], sort: "population" },
  { key: "juvenile", label: "Juvenile facilities", types: ["juvenile"], sort: "population" },
];
const YEAR = 52, SPARK_WEEKS = 5 * 52;
const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  population: (a, b) => b.population - a.population,
  percent: (a, b) => (b.percent ?? -1) - (a.percent ?? -1),
  yearChange: (a, b) => (b.yearChange ?? -Infinity) - (a.yearChange ?? -Infinity),
};

const readHash = () => (window.location.hash.match(/^#facility=([a-z0-9-]+)$/) || [])[1] || null;

export default function Facilities({ facilities, latest }) {
  const history = useMemo(() => Object.fromEntries(facilities.facilities.map((f) => [f.id, f])), [facilities]);
  const rows = useMemo(() => [...latest.facilities, ...latest.juvenile].map((f) => {
    const past = history[f.id].population;
    const yearAgo = past[past.length - 1 - YEAR];
    return { ...f, percent: f.capacity ? pct(f.population, f.capacity) : null,
             yearChange: yearAgo == null ? null : f.population - yearAgo };
  }), [latest, history]);

  const groupOf = (id) => {
    const row = rows.find((r) => r.id === id);
    return row ? GROUPS.find((g) => g.types.includes(row.type)).key : null;
  };
  const [open, setOpen] = useState(readHash);
  const [group, setGroup] = useState(() => groupOf(readHash()) || "prisons");
  const [sort, setSort] = useState(null);
  const active = GROUPS.find((g) => g.key === group);
  const shown = rows.filter((r) => active.types.includes(r.type)).sort(SORTS[sort || active.sort]);
  const widest = Math.max(100, ...shown.map((r) => r.percent || 0));
  const hasCapacity = shown.some((r) => r.capacity != null);

  // A shared link opens its facility; the WordPress embed forwards the article's #hash into the frame.
  useEffect(() => {
    const show = () => {
      const id = readHash();
      setOpen(id);
      if (groupOf(id)) setGroup(groupOf(id));
      if (id) setTimeout(() => document.getElementById(`facility-${id}`)?.scrollIntoView({ block: "start" }), 50);
    };
    if (readHash()) show();
    window.addEventListener("hashchange", show);
    return () => window.removeEventListener("hashchange", show);
  }, []);
  const toggle = (id) => {
    const next = open === id ? null : id;
    setOpen(next);
    window.history.replaceState(null, "", next ? `#facility=${next}` : window.location.pathname + window.location.search);
  };
  const heading = (key, text, numeric) => (
    <th scope="col" role="columnheader" className={numeric ? "n" : undefined} aria-sort={(sort || active.sort) === key ? (key === "name" ? "ascending" : "descending") : undefined}>
      <button type="button" className="sort" onClick={() => setSort(key)}>{text}</button>
    </th>
  );

  return (
    <section className="facilities">
      <h2>Every facility</h2>
      <p className="section-dek">
        The report of {apDate(latest.report_date)}, facility by facility. Select a name for its
        full history.
      </p>
      <div className="tabs" role="tablist" aria-label="Kind of facility">
        {GROUPS.map((g) => (
          <button key={g.key} type="button" role="tab" aria-selected={g.key === group}
            onClick={() => { setGroup(g.key); setSort(null); }}>
            {g.label} <span className="count">{rows.filter((r) => g.types.includes(r.type)).length}</span>
          </button>
        ))}
      </div>
      {hasCapacity && (
        <p className="bar-key">
          <span className="key-box" style={{ background: "var(--chart-1)" }} /> up to capacity
          <span className="key-box" style={{ background: "var(--chart-2)" }} /> beyond it
        </p>
      )}
      <div className="table-wrap">
      <table className="roster" role="table">
        <thead role="rowgroup">
          <tr role="row">
            {heading("name", "Facility")}
            {heading("population", active.key === "juvenile" ? "Youth" : "People", true)}
            {hasCapacity && <th scope="col" role="columnheader" className="n wide">Capacity</th>}
            {hasCapacity && heading("percent", "Percent of capacity")}
            {heading("yearChange", "In a year", true)}
            <th scope="col" role="columnheader" className="wide">Five years</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {shown.map((r) => {
            const h = history[r.id];
            return (
              <React.Fragment key={r.id}>
                <tr role="row" id={`facility-${r.id}`} className={open === r.id ? "open" : undefined}>
                  <th scope="row" role="rowheader">
                    <button type="button" className="name" aria-expanded={open === r.id} onClick={() => toggle(r.id)}>{r.name}</button>
                    <span className="where">
                      <span className="wide">
                        {[r.type === "county_jail" ? null : TYPE_LABEL[r.type], r.security && `${r.security} security`]
                          .filter(Boolean).map((part) => `${part} · `).join("")}
                      </span>
                      {r.type !== "county_jail" && r.county && `${r.county} County`}
                    </span>
                  </th>
                  <td role="cell" className="n" data-label={active.key === "juvenile" ? "youth" : "people"}>{num(r.population)}</td>
                  {hasCapacity && <td role="cell" className="n wide">{num(r.capacity)}</td>}
                  {hasCapacity && (
                    <td role="cell" className="meter-cell">
                      {r.percent != null && (
                        <>
                          <span className="meter" aria-hidden="true">
                            <span className="meter-in" style={{ width: `${(Math.min(r.percent, 100) / widest) * 100}%` }} />
                            {r.percent > 100 && <span className="meter-over" style={{ width: `${((r.percent - 100) / widest) * 100}%` }} />}
                          </span>
                          <span className="meter-num">{pct1(r.percent)}</span>
                        </>
                      )}
                    </td>
                  )}
                  <td role="cell" className="n change" data-label={r.yearChange == null ? "this year" : "in a year"}>
                    {r.yearChange == null ? "new" : r.yearChange === 0 ? "0" : signed(r.yearChange)}
                  </td>
                  <td role="cell" className="wide"><Sparkline values={h.population.slice(-SPARK_WEEKS)} width={110} height={26} /></td>
                </tr>
                {open === r.id && (
                  <tr role="row" className="detail">
                    <td role="cell" colSpan={hasCapacity ? 6 : 4}><Detail facility={h} dates={facilities.dates} /></td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </section>
  );
}

function Detail({ facility, dates }) {
  const span = dates.slice(facility.start, facility.start + facility.population.length);
  const last = facility.population.length - 1;
  const high = facility.population.reduce((best, v, i) => ((v ?? -1) > (facility.population[best] ?? -1) ? i : best), 0);
  const capacity = facility.capacity;
  const series = [
    ...(capacity ? [{ key: "capacity", label: "Capacity", color: COLOR.capacity, width: 1.5, values: capacity,
                      endLabel: capacity[last] != null ? num(capacity[last]) : undefined }] : []),
    { key: "population", label: facility.type === "juvenile" ? "Youth held" : "People held", color: COLOR.population,
      values: facility.population, endLabel: num(facility.population[last]) },
  ];
  return (
    <div className="detail-body">
      <p className="detail-facts">
        On the weekly report since {apMonthYear(facility.first)}. Highest count: {num(facility.population[high])},
        on {apDate(span[high])}{high === last ? ", this week" : ""}.
        {facility.sex === "both" && " Listed with both men and women."}
      </p>
      <TimeChart dates={span} series={series} height={260} yMin={0}
        wash={capacity ? { upper: "population", lower: ["capacity"], color: COLOR.population } : undefined}
        label={`Line chart: people held at ${facility.name}${capacity ? " and its capacity" : ""}, weekly.`} />
    </div>
  );
}
