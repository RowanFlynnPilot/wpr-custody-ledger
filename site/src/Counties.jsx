import React, { useState } from "react";
import { Sparkline } from "./TimeChart.jsx";
import { apDate, apMonthYear, num, pct, pct1, signed } from "./format.js";


// People in state prison by the county that convicted them, from DOC's monthly file. The
// pipeline withholds any count under `min_cell` before it reaches this page; null means withheld.
export default function Counties({ counties, home }) {
  const [all, setAll] = useState(false);
  const last = counties.months.length - 1;
  const asOf = counties.months[last];
  // The same month a year earlier, found by date: a month DOC never posted leaves the series uneven.
  const yearAgo = counties.months.findIndex((m) => m.startsWith(`${Number(asOf.slice(0, 4)) - 1}${asOf.slice(4, 7)}`));
  const now = (c) => ({
    county: c.county,
    people: c.people[last],
    yearChange: c.people[last] == null || c.people[yearAgo] == null ? null : c.people[last] - c.people[yearAgo],
    noNew: c.no_new_sentence[last],
    series: c.people,
  });
  const share = (r) => (r.noNew == null ? null : pct(r.noNew, r.people));
  const state = now({ county: "Wisconsin", people: counties.people, no_new_sentence: counties.no_new_sentence });
  const first = now(counties.counties.find((c) => c.county === home[0]));
  const rows = counties.counties.map(now)
    .filter((r) => all || home.includes(r.county))
    .sort((a, b) => (b.people ?? -1) - (a.people ?? -1));
  // A withheld total is under the floor. A withheld split means one of its halves is, without saying which.
  const under = <span className="withheld">under {counties.min_cell}</span>;
  const withheld = <span className="withheld">withheld</span>;
  const change = (r) => (r.yearChange == null ? "" : r.yearChange === 0 ? "0" : signed(r.yearChange));

  const line = (r, footer) => (
    <tr key={r.county} className={!footer && all && home.includes(r.county) ? "home" : undefined}>
      <th scope="row">{r.county}</th>
      <td className="n">{r.people == null ? under : num(r.people)}</td>
      <td className="n">{change(r)}</td>
      <td className="n">{r.noNew == null ? withheld : num(r.noNew)}</td>
      <td className="n">{share(r) == null ? "" : pct1(share(r))}</td>
      <td className="wide"><Sparkline values={r.series} width={110} height={26} /></td>
    </tr>
  );

  return (
    <section>
      <h2>Who each county sends to prison</h2>
      <p className="section-dek">
        {first.people != null && <>Of the {num(state.people)} people in state prison
        on {apDate(asOf)}, {num(first.people)} were convicted in {first.county} County
        {first.yearChange != null && <>, {first.yearChange === 0 ? "the same as" : `${num(Math.abs(first.yearChange))} ${first.yearChange > 0 ? "more" : "fewer"} than`} a year earlier</>}.</>}
        {first.noNew != null && <> {num(first.noNew)} of them, {pct1(share(first))}, were there for
        violating probation, parole or extended supervision with no new sentence. Statewide the
        share is {pct1(share(state))}.</>}
      </p>
      <div className="table-wrap">
        <table className="county-table">
          <thead>
            <tr>
              <th scope="col">County of conviction</th>
              <th scope="col" className="n">In state prison</th>
              <th scope="col" className="n">In a year</th>
              <th scope="col" className="n">No new sentence</th>
              <th scope="col" className="n">Share</th>
              <th scope="col" className="wide">Since {apMonthYear(counties.months[0])}</th>
            </tr>
          </thead>
          <tbody>{rows.map((r) => line(r))}</tbody>
          <tfoot>{line(state, true)}</tfoot>
        </table>
      </div>
      <button type="button" className="more" aria-expanded={all} onClick={() => setAll(!all)}>
        {all ? "Show only Marathon County and its neighbors" : "Show all 72 counties"}
      </button>
      <p className="chart-note">
        These are counts, not rates: larger counties send more people. &ldquo;No new sentence&rdquo; follows
        the admission type the department records for each person; the department publishes no
        definitions for its file. Counts that would describe fewer than {counties.min_cell} people
        are withheld. Source: the department&rsquo;s monthly Persons in Our Care data files,
        {" "}{apMonthYear(counties.months[0])} through {apMonthYear(asOf)}.
      </p>
    </section>
  );
}
