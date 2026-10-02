import React from "react";
import { Sparkline, recent } from "./TimeChart.jsx";
import { TYPE_LABEL, apMonthYear, num, pct, pct1, signed } from "./format.js";

// Which counties count as home is set once, in scraper/build.py, and arrives in changes.json.
const YEAR = 52;
const TREND_WEEKS = 5 * 52; // the same five years as the trend lines in the facility list

const list = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);
const UNIT = { county_jail: "state prisoners", juvenile: "youth" };

// The same ruled rows as the facility list further down, narrowed to the home counties. A name
// links to that facility's full history there.
export default function CloseToHome({ facilities, statewide, changes }) {
  const home = changes.home_counties;
  const weeks = statewide.length;
  const local = facilities.facilities
    .filter((f) => home.includes(f.county) && f.start + f.population.length === weeks)
    .map((f) => {
      const population = f.population[f.population.length - 1];
      const yearAgo = f.population[f.population.length - 1 - YEAR];
      const capacity = f.capacity ? f.capacity[f.capacity.length - 1] : null;
      return { ...f, now: population, capacity, percent: capacity ? pct(population, capacity) : null,
               yearChange: yearAgo == null ? null : population - yearAgo };
    })
    .sort((a, b) => b.now - a.now);
  const holding = local.filter((f) => f.now > 0);
  const empty = local.filter((f) => f.now === 0);
  const inMarathon = facilities.facilities.some((f) => f.county === "Marathon");
  const widest = Math.max(100, ...holding.map((f) => f.percent || 0));

  return (
    <section id="home" tabIndex={-1}>
      <h2>Close to home</h2>
      <p className="section-dek">
        State custody in Marathon County and the counties around it, from the same weekly reports.
        {!inMarathon && <> The reports list no facility in Marathon County: it has no state prison, and its
        jail has not appeared on the department&rsquo;s contract list since 1999.</>}
      </p>
      <div className="table-wrap">
        <table className="roster local" role="table">
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">Facility</th>
              <th scope="col" role="columnheader" className="n">Held</th>
              <th scope="col" role="columnheader" className="n wide">Capacity</th>
              <th scope="col" role="columnheader">Percent of capacity</th>
              <th scope="col" role="columnheader" className="n">In a year</th>
              <th scope="col" role="columnheader" className="wide">Five years</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {holding.map((f) => (
              <tr role="row" key={f.id}>
                <th scope="row" role="rowheader">
                  <a className="name" href={`#facility=${f.id}`}>{f.name}</a>
                  <span className="where">{f.county} County · {TYPE_LABEL[f.type].toLowerCase()}</span>
                </th>
                <td role="cell" className="n" data-label={UNIT[f.type] || "people"}>{num(f.now)}</td>
                <td role="cell" className="n wide">{f.capacity == null ? "" : num(f.capacity)}</td>
                <td role="cell" className="meter-cell">
                  {f.percent != null && (
                    <>
                      <span className="meter" aria-hidden="true">
                        <span className="meter-in" style={{ width: `${(Math.min(f.percent, 100) / widest) * 100}%` }} />
                        {f.percent > 100 && <span className="meter-over" style={{ width: `${((f.percent - 100) / widest) * 100}%` }} />}
                        <span className="meter-mark" style={{ left: `${(100 / widest) * 100}%` }} />
                      </span>
                      <span className="meter-num">{pct1(f.percent)}</span>
                    </>
                  )}
                </td>
                <td role="cell" className="n change" data-label={f.yearChange == null ? "" : "in a year"}>
                  {f.yearChange == null ? `since ${apMonthYear(f.first)}` : f.yearChange === 0 ? "0" : signed(f.yearChange)}
                </td>
                <td role="cell" className="wide"><Sparkline values={recent(f, TREND_WEEKS, weeks)} width={110} height={26} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="chart-note">
        County jails hold state prisoners on contract and have no capacity on the state&rsquo;s
        form. Select a name for its full history.
        {empty.length > 0 && <> Also on the department&rsquo;s contract list and holding no state
        prisoners this week: {list(empty.map((f) => f.name))}.</>}
      </p>
    </section>
  );
}
