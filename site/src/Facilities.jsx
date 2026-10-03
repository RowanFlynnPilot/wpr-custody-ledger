import React, { useEffect, useMemo, useRef, useState } from "react";
import TimeChart, { Sparkline, recent } from "./TimeChart.jsx";
import { COLOR } from "./Statewide.jsx";
import { jump, scrollToElement } from "./SectionNav.jsx";
import { TYPE_LABEL, apDate, monthYear, num, pct, pct1, signed } from "./format.js";

const GROUPS = [
  { key: "prisons", label: "Prisons and centers", short: "Prisons", types: ["institution", "center", "secure", "treatment"], sort: "percent" },
  { key: "jails", label: "County jails and contract beds", short: "Contract beds", types: ["county_jail", "out_of_state", "federal", "other"], sort: "population" },
  { key: "juvenile", label: "Juvenile facilities", short: "Juvenile", types: ["juvenile"], sort: "population" },
];
const YEAR = 52, TREND_WEEKS = 5 * 52;
const FIRST_ROWS = 10; // shown before "Show all"
// Each sort in its natural direction: names A to Z, numbers largest first. A second click reverses it.
const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  population: (a, b) => b.population - a.population,
  percent: (a, b) => (b.percent ?? -1) - (a.percent ?? -1),
  yearChange: (a, b) => (b.yearChange ?? -Infinity) - (a.yearChange ?? -Infinity),
};

const readHash = () => (window.location.hash.match(/^#facility=([a-z0-9-]+)$/) || [])[1] || null;
const list = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

// A facility the form gives no capacity for: a dash to the eye, words to a screen reader.
export const noCapacity = <><span aria-hidden="true">—</span><span className="visually-hidden">none listed</span></>;

export default function Facilities({ facilities, latest, counties }) {
  const weeks = facilities.dates.length;
  const history = useMemo(() => Object.fromEntries(facilities.facilities.map((f) => [f.id, f])), [facilities]);
  const rows = useMemo(() => {
    const yearAgoDate = facilities.dates[weeks - 1 - YEAR];
    return [...latest.facilities, ...latest.juvenile].map((f) => {
      const past = history[f.id].population;
      const yearAgo = past[past.length - 1 - YEAR];
      return { ...f, percent: f.capacity ? pct(f.population, f.capacity) : null,
               yearChange: yearAgo == null ? null : f.population - yearAgo,
               // Absent a year ago: either it joined the report since, or it had dropped off and come back.
               joined: history[f.id].first > yearAgoDate };
    });
  }, [latest, history, facilities, weeks]);

  const groupOf = (id) => {
    const row = rows.find((r) => r.id === id);
    return row ? GROUPS.find((g) => g.types.includes(row.type)).key : null;
  };
  const [open, setOpen] = useState(readHash);
  const [group, setGroup] = useState(() => groupOf(readHash()) || "prisons");
  const [sort, setSort] = useState(null); // { key, reversed }, or null for the group's own order
  const [query, setQuery] = useState("");
  const findInput = useRef(null);
  const [all, setAll] = useState(() => readHash() != null);

  const active = GROUPS.find((g) => g.key === group);
  const sortKey = sort?.key || active.sort;
  const needle = query.trim().toLowerCase();
  // A search looks across every group, by name or county; otherwise the chosen group.
  const matching = needle
    ? rows.filter((r) => `${r.name} ${r.county ? `${r.county} county` : ""}`.toLowerCase().includes(needle))
    : rows.filter((r) => active.types.includes(r.type));
  const ordered = [...matching].sort(SORTS[sortKey]);
  if (sort?.reversed) ordered.reverse();
  // Jails holding no one this week are named in a sentence instead of getting a row each.
  const idle = needle ? [] : ordered.filter((r) => r.type === "county_jail" && r.population === 0 && r.id !== open);
  const listed = ordered.filter((r) => !idle.includes(r));
  const visible = all || needle ? listed : listed.slice(0, FIRST_ROWS);
  const widest = Math.max(100, ...listed.map((r) => r.percent || 0));
  const hasCapacity = listed.some((r) => r.capacity != null);
  // A county typed into the search box: the county table's count for it, so a county with no facility still gets an answer.
  const asOf = counties.months.length - 1;
  const plain = needle.replace(/\s+county$/, "");
  const countyHits = plain.length >= 4 ? counties.counties.filter((c) => c.county.toLowerCase().startsWith(plain)) : [];
  const countyHit = countyHits.length === 1 ? countyHits[0] : null;
  // Under the default order (most crowded first) the big prisons sit far down the list: say where they stand.
  const big = !needle && group === "prisons" && sortKey === "percent" && !sort?.reversed
    ? listed.filter((r) => r.population >= 1000 && r.percent != null) : [];

  // A shared link opens its facility; the WordPress embed forwards the article's #hash into the frame.
  useEffect(() => {
    const show = () => {
      const id = readHash();
      setOpen(id);
      if (!groupOf(id)) return;
      setGroup(groupOf(id));
      setQuery("");
      setAll(true);
      setTimeout(() => scrollToElement(document.getElementById(`facility-${id}`)), 50);
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
  const heading = (key, text, numeric) => {
    const on = sortKey === key;
    const ascending = (key === "name") !== Boolean(sort?.reversed);
    return (
      <th scope="col" role="columnheader" className={numeric ? "n" : undefined}
        aria-sort={on ? (ascending ? "ascending" : "descending") : undefined}>
        <button type="button" className="sort" onClick={() => setSort({ key, reversed: on && !sort?.reversed })}>{text}</button>
      </th>
    );
  };

  return (
    <section className="facilities" id="facilities" tabIndex={-1}>
      <h2>Every facility</h2>
      <p className="section-dek">
        The report of {apDate(latest.report_date)}, facility by facility. Select a name for its
        full history, or a column heading to sort.
      </p>
      <div className="find">
        <label htmlFor="find-input">Find a prison, jail or county</label>
        <div className="find-box">
          <input id="find-input" ref={findInput} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Stanley, or Lincoln County"
            enterKeyHint="search" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
          {query && (
            <button type="button" className="find-clear" aria-label="Clear the search"
              onClick={() => { setQuery(""); findInput.current?.focus(); }} />
          )}
        </div>
      </div>
      <div className="tabs" role="group" aria-label="Kind of facility">
        {GROUPS.map((g) => (
          <button key={g.key} type="button" aria-pressed={!needle && g.key === group}
            onClick={() => { setGroup(g.key); setSort(null); setQuery(""); setAll(false); }}>
            <span className="full">{g.label}</span><span className="narrow">{g.short}</span> <span className="count">{rows.filter((r) => g.types.includes(r.type) && !(r.type === "county_jail" && r.population === 0)).length}</span>
          </button>
        ))}
      </div>
      {needle && (
        <p className="find-status" role="status">
          {listed.length
            ? `Showing ${listed.length} on this week’s report that ${listed.length === 1 ? "matches" : "match"} “${query.trim()}”.`
            : countyHit
              ? `No facility on this week’s report is in ${countyHit.county} County.`
              : `Nothing on this week’s report matches “${query.trim()}”. Try a facility’s name or a county.`}
          {countyHit && (
            <>
              {" "}{countyHit.people[asOf] == null
                ? `Fewer than ${counties.min_cell} people in state prison on ${apDate(counties.months[asOf])} were convicted in ${countyHit.county} County.`
                : `Of the people in state prison on ${apDate(counties.months[asOf])}, ${num(countyHit.people[asOf])} were convicted in ${countyHit.county} County.`}
              {" "}<a href="#counties" onClick={jump("counties")}>See every county</a>.
            </>
          )}
        </p>
      )}
      {hasCapacity && (
        <p className="bar-key">
          <span className="key-box" style={{ background: "var(--chart-1)" }} /> up to capacity
          <span className="key-box" style={{ background: "var(--chart-2)" }} /> beyond it
          <span className="key-mark" /> capacity
        </p>
      )}
      {listed.length > 0 && (
      <div className="table-wrap">
      <table className="roster" role="table" aria-label="Facilities on this week’s report">
        <thead role="rowgroup">
          <tr role="row">
            {heading("name", "Facility")}
            {heading("population", !needle && active.key === "juvenile" ? "Youth" : "People", true)}
            {hasCapacity && <th scope="col" role="columnheader" className="n wide">Capacity</th>}
            {hasCapacity && heading("percent", "Percent of capacity")}
            {heading("yearChange", "In a year", true)}
            <th scope="col" role="columnheader" className="wide">Five years</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {visible.map((r) => {
            const h = history[r.id];
            const kind = [r.type === "county_jail" ? null : TYPE_LABEL[r.type], r.security && `${r.security} security`].filter(Boolean).join(" · ");
            const county = r.type !== "county_jail" && r.county ? `${r.county} County` : "";
            return (
              <React.Fragment key={r.id}>
                <tr role="row" id={`facility-${r.id}`} className={[open === r.id && "open", !kind && !county && "bare"].filter(Boolean).join(" ") || undefined}>
                  <th scope="row" role="rowheader">
                    <button type="button" className="name" aria-expanded={open === r.id} onClick={() => toggle(r.id)}>{r.name}</button>
                    {(kind || county) && (
                      <span className="where">
                        {county ? <><span className="wide">{kind}{kind && " · "}</span>{county}</> : kind}
                      </span>
                    )}
                  </th>
                  <td role="cell" className="n" data-label={r.type === "juvenile" ? "youth" : "people"}>{num(r.population)}</td>
                  {hasCapacity && <td role="cell" className="n wide">{r.capacity == null ? noCapacity : num(r.capacity)}</td>}
                  {hasCapacity && (
                    <td role="cell" className="meter-cell">
                      {r.percent != null && (
                        <>
                          <span className="meter" aria-hidden="true">
                            <span className="meter-in" style={{ width: `${(Math.min(r.percent, 100) / widest) * 100}%` }} />
                            {r.percent > 100 && <span className="meter-over" style={{ width: `${((r.percent - 100) / widest) * 100}%` }} />}
                            <span className="meter-mark" style={{ left: `${(100 / widest) * 100}%` }} />
                          </span>
                          <span className="meter-num">{pct1(r.percent)}</span>
                        </>
                      )}
                    </td>
                  )}
                  <td role="cell" className="n change" data-label={r.yearChange == null ? "" : "in a year"}>
                    {r.yearChange != null ? (r.yearChange === 0 ? "0" : signed(r.yearChange)) : <span className="aside">{r.joined ? "new this year" : "back on the list"}</span>}
                  </td>
                  <td role="cell" className="wide"><Sparkline values={recent(h, TREND_WEEKS, weeks)} width={110} height={26} /></td>
                </tr>
                {open === r.id && (
                  <tr role="row" className="detail">
                    <td role="cell" colSpan={hasCapacity ? 6 : 4}>
                      <Detail facility={h} dates={facilities.dates} onClose={() => toggle(r.id)} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
      )}
      {!needle && listed.length > FIRST_ROWS && (
        <button type="button" className="more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? `Show the first ${FIRST_ROWS}` : `Show all ${listed.length}`}
        </button>
      )}
      {big.length > 1 && (
        <p className="chart-note">
          The {big.length} prisons holding 1,000 or more people run from{" "}
          {pct1(Math.min(...big.map((r) => r.percent)))} to {pct1(Math.max(...big.map((r) => r.percent)))} of
          capacity. Sort by People to see them first.
        </p>
      )}
      {idle.length > 0 && (
        <p className="chart-note">
          Also on the department&rsquo;s contract list and holding no state prisoners this
          week: {list(idle.map((r) => r.name))}.
        </p>
      )}
    </section>
  );
}

function Detail({ facility, dates, onClose }) {
  const [copied, setCopied] = useState(false);
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
  const copy = () => navigator.clipboard.writeText(window.location.href).then(() => setCopied(true));
  return (
    <div className="detail-body">
      <p className="detail-facts">
        On the weekly report since {monthYear(facility.first)}. Highest count: {num(facility.population[high])},
        on {apDate(span[high])}{high === last ? ", this week" : ""}.
        {facility.sex === "both" && " Listed with both men and women."}
        {capacity && " Capacity is as the department printed it each week."}
      </p>
      <TimeChart dates={span} series={series} height={260} yMin={0}
        wash={capacity ? { upper: "population", lower: ["capacity"], color: COLOR.population } : undefined}
        label={`Line chart: people held at ${facility.name}${capacity ? " and its capacity" : ""}, weekly.`} />
      <p className="detail-actions">
        {navigator.clipboard && (
          <button type="button" className="more" onClick={copy}>
            {copied ? "Link copied" : "Copy a link to this facility"}
          </button>
        )}
        <button type="button" className="more" onClick={onClose}>Close</button>
        <span className="visually-hidden" role="status">{copied ? "Link copied" : ""}</span>
      </p>
    </div>
  );
}
