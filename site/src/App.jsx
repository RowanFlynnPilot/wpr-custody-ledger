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
import SectionNav, { SkipLink } from "./SectionNav.jsx";
import { apDate, num, ordinal, pct1, signed } from "./format.js";
import badge from "./assets/wpr-typewriter-badge.png";
import wordmark from "./assets/wpr-wordmark.png";

const HOME = "https://wausaupilotandreview.com/";
const CONTACT = "editor@wausaupilotandreview.com";
const FILES = ["statewide", "facilities", "latest", "changes", "counties"];
const STALE_DAYS = 21; // the pipeline's own limit: DOC has never skipped more than one week

// The newsroom's flag: seal and wordmark, tagline, dateline. The tool's own name sits below it.
function Flag({ reportDate }) {
  return (
    <div className="flag">
      <a className="flag-lockup" href={HOME} target="_blank" rel="noreferrer">
        <img className="flag-seal" src={badge} alt="" width="68" height="68" />
        <img className="flag-wordmark" src={wordmark} alt="Wausau Pilot & Review" width="640" height="82" />
      </a>
      <p className="flag-tagline">Where Locals Look First For News</p>
      <p className="flag-dateline">
        <span>{reportDate ? <>Report of {apDate(reportDate)} · updated weekly</> : <>Updated weekly</>}</span>
        <span className="flag-place">Wausau, Wisconsin</span>
      </p>
    </div>
  );
}

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

  if (error || !data) {
    return (
      <>
        <Flag />
        {error
          ? <p className="load-error" role="alert">The Custody Ledger could not load its data. Refresh the page to try again.</p>
          : <p className="loading" role="status">Loading the ledger…</p>}
      </>
    );
  }

  const { statewide, facilities, latest, changes, counties } = data;
  const { population, crowding, women, county_jails: jails } = changes;
  const ageDays = Math.floor((Date.now() - new Date(`${latest.report_date}T12:00:00Z`)) / 864e5);
  const over = crowding.over_capacity;
  const crowded = changes.facilities.most_crowded[0];
  const homeCounty = changes.home_counties[0];
  const fromHome = counties.counties.find((c) => c.county === homeCounty).people.at(-1);

  return (
    <>
    <SkipLink />
    <Flag reportDate={latest.report_date} />
    <main className="page">
      <header className="masthead">
        <h1>The Custody Ledger</h1>
        <p className="dek">
          How many people Wisconsin holds in state prison, week by week since 1999, against what
          its prisons were built to hold. Every figure comes from the Department of
          Corrections&rsquo; own weekly reports.
        </p>
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
        {" "}Its prisons were designed to hold {num(crowding.capacity)}.
      </p>

      {/* The whole system as one bar: everyone the prisons were designed for, then everyone beyond. */}
      {over > 0 && (
        <div className="hero-meter">
          <div className="hero-bar" role="img"
            aria-label={`${num(crowding.capacity)} people within design capacity and ${num(over)} beyond it`}>
            <span className="hero-in" style={{ flexGrow: crowding.capacity }} />
            <span className="hero-over" style={{ flexGrow: over }} />
          </div>
          <p className="hero-key">
            <span><strong>{num(crowding.capacity)}</strong> the prisons were designed to hold</span>
            <span><strong>{num(over)}</strong> people beyond that</span>
          </p>
          <p className="chart-note">
            That is {pct1(crowding.percent)} of design capacity: what each prison was built to
            hold, plus later expansions, leaving out beds added to cope with crowding.
          </p>
        </div>
      )}

      <section className="stat-strip" aria-label="This week in numbers">
        <div className="stat">
          <span className="stat-num">{pct1(women.percent)}</span>
          <span className="stat-label">of design capacity in women&rsquo;s prisons</span>
          <span className="stat-sub">{num(women.value)} women{women.record && ", the most on record"}</span>
        </div>
        <div className="stat">
          <span className="stat-num">{changes.facilities.over_capacity} of {changes.facilities.with_capacity}</span>
          <span className="stat-label">prisons and centers hold more people than they were designed for</span>
          <span className="stat-sub">{crowded.name}: {pct1(crowded.percent)}</span>
        </div>
        <div className="stat">
          <span className="stat-num">{num(jails.value)}</span>
          <span className="stat-label">state prisoners held in county jails on contract</span>
          <span className="stat-sub">{signed(jails.year_change)} in a year</span>
        </div>
        <div className="stat">
          <span className="stat-num">{fromHome == null ? "—" : num(fromHome)}</span>
          <span className="stat-label">people in state prison who were convicted in {homeCounty} County</span>
          <span className="stat-sub">as of {apDate(counties.months.at(-1))}</span>
        </div>
      </section>

      <SectionNav />

      <Statewide statewide={statewide} changes={changes} />

      <hr className="rule-double" />
      <CloseToHome facilities={facilities} statewide={statewide} changes={changes} />
      <Counties counties={counties} home={changes.home_counties} />
      <Facilities facilities={facilities} latest={latest} />

      <hr className="rule-double" />
      <WomenMen statewide={statewide} />
      <ContractBeds statewide={statewide} />
      <Juvenile statewide={statewide} facilities={facilities} />
      <Supervision statewide={statewide} />

      <hr className="rule-double" />
      <Methodology latest={latest} />
    </main>

    <footer className="colophon">
      <div className="colophon-inner">
        <a href={HOME} target="_blank" rel="noreferrer">
          <img className="colophon-seal" src={badge} alt="Wausau Pilot & Review" width="56" height="56" />
        </a>
        <div>
          <p>
            Source: Wisconsin Department of Corrections weekly population reports (form DOC-302),
            1999 to the present, and its monthly Persons in Our Care data files. New reports are
            added within days of publication.
          </p>
          <p>Not affiliated with or endorsed by the Wisconsin Department of Corrections.</p>
          <p>
            Questions or corrections: <a href={`mailto:${CONTACT}`}>{CONTACT}</a> · Wausau Pilot &amp; Review · 715-301-5539
          </p>
        </div>
      </div>
    </footer>
    </>
  );
}
