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
import SectionNav, { SkipLink, goTo, jump } from "./SectionNav.jsx";
import { apDate, num, ordinal, pct1, signed, typeset } from "./format.js";
import badge from "./assets/wpr-typewriter-badge.png";
import wordmark from "./assets/wpr-wordmark.png";

const HOME = "https://wausaupilotandreview.com/";
const CONTACT = "rowan.flynn@wausaupilotandreview.com";
const FILES = ["statewide", "facilities", "latest", "changes", "counties"]; // vite.config.js starts the same five early
const STALE_DAYS = 21; // the pipeline's own limit: DOC has never skipped more than one week

// The newsroom's flag: seal and wordmark, tagline, dateline. The tool's own name sits below it.
export function Flag({ reportDate }) {
  return (
    <header className="flag" id="top" tabIndex={-1}>
      <a className="flag-lockup" href={HOME} target="_blank" rel="noreferrer">
        <img className="flag-seal" src={badge} alt="" width="68" height="68" />
        <img className="flag-wordmark" src={wordmark} alt="Wausau Pilot & Review" width="640" height="82" />
      </a>
      <p className="flag-tagline">Where Locals Look First For News</p>
      <p className="flag-dateline">
        <span>{reportDate ? <>Report of {apDate(reportDate)} · updated weekly</> : <>Updated weekly</>}</span>
        <span className="flag-place">Wausau, Wisconsin</span>
      </p>
    </header>
  );
}

// The tool's name and what it is. Neither waits for the data, so they are on the page at once.
export function Masthead({ children }) {
  return (
    <header className="masthead">
      <h1>The Custody Ledger</h1>
      <p className="dek">
        How many people Wisconsin holds in state prison, week by week since 1999, against what
        its prisons were built to hold. Every figure comes from the Department of
        Corrections&rsquo; own reports.
      </p>
      {children}
    </header>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // The page head has usually asked for these already (vite.config.js); each answer can be read once.
    const early = window.__ledgerData || {};
    Promise.all(FILES.map((name) => {
      const asked = early[name] || fetch(`${import.meta.env.BASE_URL}data/${name}.json?v=${__BUILD_ID__}`);
      delete early[name];
      return asked.then((r) => {
        if (r instanceof Error) throw r;
        if (!r.ok) throw new Error(`${name}.json: ${r.status}`);
        return r.json();
      });
    }
    )).then(([statewide, facilities, latest, changes, counties]) => setData({ statewide, facilities, latest, changes, counties }))
      .catch(setError);
  }, []);

  // A link to a section (…#counties) lands on it once the page has drawn; the browser cannot do it
  // alone because the section does not exist until the data arrives. Inside an article, the embed
  // script passes the article's own #hash into the frame. Facility links are handled in Facilities.
  useEffect(() => {
    if (!data) return undefined;
    const land = () => {
      const id = window.location.hash.slice(1);
      const target = id && document.getElementById(id);
      if (target?.tagName === "SECTION") setTimeout(() => goTo(target.id), 300);
    };
    land();
    window.addEventListener("hashchange", land);
    return () => window.removeEventListener("hashchange", land);
  }, [data]);

  if (error || !data) {
    return (
      <>
        <Flag />
        <main className="page">
          <Masthead />
          {error
            ? (
              <p className="load-error" role="alert">
                This week&rsquo;s figures could not be loaded.
                <button type="button" className="more" onClick={() => window.location.reload()}>Try again</button>
              </p>
            )
            : <p className="loading" role="status">Loading this week&rsquo;s figures…</p>}
        </main>
      </>
    );
  }

  const { statewide, facilities, latest, changes, counties } = data;
  const { population, crowding, women, county_jails: jails } = changes;
  const ageDays = Math.floor((Date.now() - new Date(`${latest.report_date}T12:00:00Z`)) / 864e5);
  const over = crowding.over_capacity;
  const crowded = changes.facilities.most_crowded[0];
  const homeCounty = changes.home_counties[0];
  const countyAsOf = counties.months[counties.months.length - 1];
  const fromHome = counties.counties.find((c) => c.county === homeCounty).people[counties.months.length - 1];
  // How the count moved: against the report before (a week back unless the department skipped one) and a year back.
  const { week_change: week, year_change: year } = population;
  const aWeek = (new Date(latest.report_date) - new Date(changes.previous_date)) / 864e5 === 7;
  // "up 22 from a week earlier": a word between the date and the figure, as in the weekly brief.
  const moved = (n, from) => (n === 0 ? `unchanged from ${from}` : `${n > 0 ? "up" : "down"} ${num(Math.abs(n))} from ${from}`);
  const weekly = moved(week, aWeek ? "a week earlier" : apDate(changes.previous_date));
  const yearly = moved(year, "a year earlier");
  // The capacity total is the prisons' own beds plus the contract beds the department rents, which its
  // form counts at exactly the number of people in them (true of every report since 1999).
  const own = latest.facilities.reduce((sum, f) => sum + (f.capacity || 0), 0);
  const rented = crowding.capacity - own;
  const rateRecord = crowding.record_date === latest.report_date;
  const rates = statewide.map((w) => w.population / w.capacity);
  const lowest = rates.indexOf(Math.min(...rates));
  const rateLow = lowest === statewide.length - 1;
  const alwaysOver = rates[lowest] > 1;
  // A week at either end of the record says so; otherwise the record rate is given as the lede gives the record count.
  const rateNote = rateRecord ? ", the highest rate in weekly records that begin in 1999"
    : rateLow ? ", the lowest rate in weekly records that begin in 1999" : "";

  return (
    <>
    <SkipLink />
    <Flag reportDate={latest.report_date} />
    <main className="page">
      <Masthead>
        {ageDays > STALE_DAYS && (
          <p className="updated-late" role="status">
            No new report has been added for {ageDays} days, so these figures are older than usual.
          </p>
        )}
      </Masthead>

      <p className="lede">
        Wisconsin&rsquo;s adult prison system held <strong>{num(population.value)}</strong> people on{" "}
        {apDate(latest.report_date)}, {weekly}
        {population.record
          ? <>{aWeek ? "" : ","} and the most in weekly records that begin in 1999.{population.record_streak > 1 &&
              <> It is the {ordinal(population.record_streak)} record in as many weeks.</>}</>
          : <>. The record, {num(population.prior_peak.value)}, was set {apDate(population.prior_peak.date)}.</>}
        {over <= 0 && <> The department puts its capacity at {num(crowding.capacity)}.</>}
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
            <span><span className="key-box" style={{ background: "var(--chart-1)" }} /><strong>{num(crowding.capacity)}</strong> within design capacity</span>
            <span><span className="key-box" style={{ background: "var(--chart-2)" }} /><strong>{num(over)}</strong> people beyond that</span>
          </p>
          <p className="chart-note">
            That is {pct1(crowding.percent)} of design capacity{rateNote}, and the count
            is {yearly}.{" "}
            {!rateRecord && <>The highest rate, {pct1(crowding.record_percent)}, was set {apDate(crowding.record_date)}
              {alwaysOver ? ", and every" : "."}</>}
            {alwaysOver && <>{rateRecord ? "Every" : ""} weekly report since 1999 has been over capacity.</>}
          </p>
          <p className="chart-note">
            Design capacity is what each prison was built to hold, plus later expansions,
            leaving out beds added to cope with crowding: {num(own)} this week.
            {rented > 0 && <> The department adds the {num(rented)} beds it rents in county jails and elsewhere, and counts every one as full.</>}
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
          <span className="stat-num">{changes.facilities.over_capacity}<span className="stat-of"> of {changes.facilities.with_capacity}</span></span>
          <span className="stat-label">prisons and centers hold more people than they were designed for</span>
          <span className="stat-sub">{typeset(crowded.name)}:{"\u00a0"}{pct1(crowded.percent)}</span>
        </div>
        <div className="stat">
          <span className="stat-num">{num(jails.value)}</span>
          <span className="stat-label">state prisoners held in county jails on contract</span>
          <span className="stat-sub">{signed(jails.year_change)} in a year</span>
        </div>
        <div className="stat">
          <span className="stat-num">{fromHome == null ? "—" : num(fromHome)}</span>
          <span className="stat-label">people in state prison who were convicted in {homeCounty} County</span>
          <span className="stat-sub">as of {apDate(countyAsOf)}</span>
        </div>
      </section>

      <SectionNav />

      <Statewide statewide={statewide} changes={changes} />

      <hr className="rule-double" />
      <CloseToHome facilities={facilities} statewide={statewide} changes={changes} />
      <Counties counties={counties} home={changes.home_counties} />
      <Facilities facilities={facilities} latest={latest} counties={counties} />

      <hr className="rule-double" />
      <WomenMen statewide={statewide} />
      <ContractBeds statewide={statewide} />
      {/* Two shorter stories side by side where there is room; one under the other on a phone. */}
      <div className="pair">
        <Juvenile statewide={statewide} facilities={facilities} />
        <Supervision statewide={statewide} />
      </div>

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
        <a className="to-top" href="#top" onClick={jump("top")}>Back to top</a>
      </div>
    </footer>
    </>
  );
}
