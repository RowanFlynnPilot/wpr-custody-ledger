import React from "react";
import { Sparkline, recent } from "./TimeChart.jsx";
import { TYPE_LABEL, apMonthYear, num, pct, pct1, signed } from "./format.js";

// Which counties count as home is set once, in scraper/build.py, and arrives in changes.json.
const YEAR = 52;
const TREND_WEEKS = 5 * 52; // every card's trend line covers the same five years

const list = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

export default function CloseToHome({ facilities, statewide, changes }) {
  const home = changes.home_counties;
  const weeks = statewide.length;
  const local = facilities.facilities
    .filter((f) => home.includes(f.county) && f.start + f.population.length === weeks)
    .map((f) => {
      const population = f.population[f.population.length - 1];
      const yearAgo = f.population[f.population.length - 1 - YEAR];
      return { ...f, now: population, capacity: f.capacity ? f.capacity[f.capacity.length - 1] : null,
               yearChange: yearAgo == null ? null : population - yearAgo };
    })
    .sort((a, b) => b.now - a.now);
  const holding = local.filter((f) => f.now > 0);
  const empty = local.filter((f) => f.now === 0);
  const inMarathon = facilities.facilities.some((f) => f.county === "Marathon");

  return (
    <section id="home" tabIndex={-1}>
      <h2>Close to home</h2>
      <p className="section-dek">
        State custody in Marathon County and the counties around it, from the same weekly reports.
        {!inMarathon && <> The reports list no facility in Marathon County: it has no state prison, and its
        jail has not appeared on the department&rsquo;s contract list since 1999.</>}
      </p>
      <div className="cards">
        {holding.map((f) => (
          <article className="card" key={f.id}>
            <h3>{f.name}</h3>
            <p className="card-where">{f.county} County · {TYPE_LABEL[f.type].toLowerCase()}</p>
            <p className="card-figure">
              <span className="card-num">{num(f.now)}</span>
              {f.type === "county_jail" ? " state prisoners held on contract"
                : f.type === "juvenile" ? " youth"
                : " people"}
            </p>
            {f.capacity != null && (
              <p className="card-line">
                <strong>{pct1(pct(f.now, f.capacity))}</strong> of
                its {f.type === "juvenile" ? "listed" : "design"} capacity of {num(f.capacity)}
              </p>
            )}
            <p className="card-line">
              {f.yearChange == null ? `On the report since ${apMonthYear(f.first)}`
                : f.yearChange === 0 ? "Unchanged from a year ago"
                : `${signed(f.yearChange)} from a year ago`}
            </p>
            <Sparkline values={recent(f, TREND_WEEKS, weeks)} width={220} height={38} />
          </article>
        ))}
      </div>
      <p className="chart-note">
        Each trend line covers the past five years on its own scale; a line that starts partway
        across belongs to a place that joined the report during that time.
        {empty.length > 0 && <> Also on the department&rsquo;s contract list and holding no state
        prisoners this week: {list(empty.map((f) => f.name))}.</>}
      </p>
    </section>
  );
}
