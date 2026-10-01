import React from "react";

const REPO = "https://github.com/RowanFlynnPilot/wpr-custody-ledger";
const csv = (name) => `${import.meta.env.BASE_URL}data/csv/${name}.csv`;

export default function Methodology({ latest }) {
  return (
    <section className="method">
      <h2>How this is compiled</h2>
      <div className="method-grid">
        <div>
          <h3>The source</h3>
          <p>
            Every Friday the Wisconsin Department of Corrections publishes a one-form count of
            everyone in its custody, the DOC-302. The Ledger reads each one, back to January
            1999, and stores every row with a fingerprint of the file it came from.{" "}
            <a href={latest.source} target="_blank" rel="noreferrer">This week&rsquo;s report</a> is
            the department&rsquo;s own PDF.
          </p>
          <h3>The checks</h3>
          <p>
            Nothing is published unless the facility rows of a report add up to the
            department&rsquo;s totals: for the whole system, for women and men, for contract
            beds and for juvenile facilities. That holds for every report since 1999.
          </p>
        </div>
        <div>
          <h3>Where the Ledger differs from the form</h3>
          <p>
            Capacity here is the sum of the department&rsquo;s facility rows. In 136 weekly
            reports between 2001 and 2008 the total printed on the form does not match its own
            rows; for 12 weeks in 2008 it left out every women&rsquo;s bed. Each case is listed
            with its cause in the project&rsquo;s <a href={`${REPO}/blob/main/scraper/corrections.py`} target="_blank" rel="noreferrer">corrections file</a>.
          </p>
          <h3>What it does not show</h3>
          <p>
            People in county jails who are not state prisoners, and people on probation or
            parole, are not in these counts. For another view of each adult prison since 2006,
            see Wisconsin Watch&rsquo;s <a href="https://wisconsin-watch.github.io/wisconsin_prison_population_tracker/" target="_blank" rel="noreferrer">prison population tracker</a>.
          </p>
        </div>
      </div>
      <h3>Take the data</h3>
      <ul className="downloads">
        <li><a href={csv("statewide")} download>Statewide, weekly</a> <span>population, capacity, women and men, contract beds, juvenile, supervision</span></li>
        <li><a href={csv("facility_population")} download>Population by facility, weekly</a> <span>one column per facility</span></li>
        <li><a href={csv("facility_capacity")} download>Capacity by facility, weekly</a></li>
        <li><a href={csv("facility_names")} download>Facility names, types and counties</a></li>
      </ul>
      <p className="chart-note">
        Free to reuse with credit to &ldquo;The Custody Ledger, Wausau Pilot &amp; Review.&rdquo; Code and
        methods: <a href={REPO} target="_blank" rel="noreferrer">github.com/RowanFlynnPilot/wpr-custody-ledger</a>.
      </p>
    </section>
  );
}
