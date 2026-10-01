import React, { useEffect, useState } from "react";
import Statewide from "./Statewide.jsx";
import CloseToHome from "./CloseToHome.jsx";
import Counties from "./Counties.jsx";
import WomenMen from "./WomenMen.jsx";
import ContractBeds from "./ContractBeds.jsx";
import Juvenile from "./Juvenile.jsx";
import Supervision from "./Supervision.jsx";
import Facilities from "./Facilities.jsx";
import Methodology from "./Methodology.jsx";
import { apDate, apMonthYear, num, ordinal, pct1, signed } from "./format.js";

const FILES = ["statewide", "facilities", "latest", "changes", "counties"];
const STALE_DAYS = 21; // the pipeline's own limit: DOC has never skipped more than one week

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all(FILES.map((name) =>
      fetch(`${import.meta.env.BASE_URL}data/${name}.json?v=${__BUILD_ID__}`).then((r) => {
        if (!r.ok) throw new Error(`${name}.json: ${r.status}`);
        return r.json();
      })
    )).then(([statewide, facilities, latest, changes, counties]) => setData({ statewide, facilities, latest, changes, counties }))
      .catch(setError);
  }, []);

  if (error) return <div className="load-error">The Custody Ledger could not load its data. Refresh the page to try again.</div>;
  if (!data) return <div className="loading">Loading the ledger…</div>;

  const { statewide, facilities, latest, changes, counties } = data;
  const { population, crowding, women, county_jails: jails } = changes;
  const ageDays = Math.floor((Date.now() - new Date(`${latest.report_date}T12:00:00Z`)) / 864e5);
  const design = crowding.capacity_type === "design";

  return (
    <main className="page">
      <header className="masthead">
        <a className="brand" href="https://wausaupilotandreview.com" target="_blank" rel="noreferrer">
          <span className="brand-badge" aria-hidden="true"
            style={{ backgroundImage: `url(${import.meta.env.BASE_URL}wpr-badge.jpg)` }} />
          <span className="brand-wordmark">Wausau Pilot <span className="amp">&amp;</span> Review</span>
        </a>
        <div className="rule-double" aria-hidden="true" />
        <p className="eyebrow">A newsroom data project</p>
        <h1>The Custody Ledger</h1>
        <p className="dek">
          How many people Wisconsin holds in state prison, week by week since 1999, against what
          its prisons were built to hold. Every figure comes from the Department of
          Corrections&rsquo; own weekly reports.
        </p>
        <p className="updated">Report of {apDate(latest.report_date)} · updated weekly</p>
        {ageDays > STALE_DAYS && (
          <p className="updated-late" role="status">
            No new report has been added for {ageDays} days, so these figures are older than usual.
          </p>
        )}
      </header>

      <p className="lede">
        Wisconsin&rsquo;s adult prison system held <strong>{num(population.value)}</strong> people on{" "}
        {apDate(latest.report_date)}
        {population.record
          ? <>, the most in weekly records that begin in 1999{population.record_streak > 1 &&
              <> and the {ordinal(population.record_streak)} record in as many weeks</>}.</>
          : <>, {num(population.prior_peak.value - population.value)} fewer than the record
              of {num(population.prior_peak.value)} set {apDate(population.prior_peak.date)}.</>}
        {" "}Its prisons were {design ? "designed" : "set up"} to hold {num(crowding.capacity)}.
      </p>

      <section className="stat-strip" aria-label="This week in numbers">
        <div className="stat">
          <span className="stat-num">{num(population.value)}</span>
          <span className="stat-label">people in the adult prison system</span>
          <span className="stat-sub">{signed(population.week_change)} in a week · {signed(population.year_change)} in a year</span>
        </div>
        <div className="stat">
          <span className="stat-num">{pct1(crowding.percent)}</span>
          <span className="stat-label">of {crowding.capacity_type} capacity: {num(crowding.over_capacity)} more people than beds</span>
          <span className="stat-sub">highest was {pct1(crowding.record_percent)}, {apMonthYear(crowding.record_date)}</span>
        </div>
        <div className="stat">
          <span className="stat-num">{pct1(women.percent)}</span>
          <span className="stat-label">of capacity in women&rsquo;s prisons, holding {num(women.value)}</span>
          <span className="stat-sub">{women.record ? "most women on record" : `${signed(women.year_change)} in a year`} · men&rsquo;s at {pct1(changes.men.percent)}</span>
        </div>
        <div className="stat">
          <span className="stat-num">{num(jails.value)}</span>
          <span className="stat-label">state prisoners held in county jails on contract</span>
          <span className="stat-sub">{jails.jails_holding} jails · {signed(jails.year_change)} in a year</span>
        </div>
      </section>

      <Statewide statewide={statewide} changes={changes} />
      <CloseToHome facilities={facilities} statewide={statewide} changes={changes} />
      <Counties counties={counties} home={changes.home_counties} />
      <WomenMen statewide={statewide} />
      <ContractBeds statewide={statewide} />
      <Juvenile statewide={statewide} facilities={facilities} />
      <Supervision statewide={statewide} />
      <Facilities facilities={facilities} latest={latest} changes={changes} />
      <Methodology latest={latest} />

      <footer className="colophon">
        <span className="brand-badge small" aria-hidden="true"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}wpr-badge.jpg)` }} />
        <div>
          <p>
            Source: Wisconsin Department of Corrections weekly population reports (form DOC-302),
            1999 to the present. New reports are added within days of publication.
          </p>
          <p>Not affiliated with or endorsed by the Wisconsin Department of Corrections.</p>
          <p>Wausau Pilot &amp; Review · 715-301-5539</p>
        </div>
      </footer>
    </main>
  );
}
