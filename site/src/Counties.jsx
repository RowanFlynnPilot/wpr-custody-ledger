import React, { useState } from "react";
import { apDate, num, pct, pct1 } from "./format.js";

// People in state prison by the county that convicted them, from DOC's monthly file. The
// pipeline withholds any count under `min_cell` before it reaches this page; null means withheld.
export default function Counties({ counties, home }) {
  const [all, setAll] = useState(false);
  const share = (c) => (c.no_new_sentence == null ? null : pct(c.no_new_sentence, c.people));
  const first = counties.counties.find((c) => c.county === home[0]);
  const rows = counties.counties
    .filter((c) => all || home.includes(c.county))
    .sort((a, b) => (b.people ?? -1) - (a.people ?? -1));
  // A withheld total is under the floor. A withheld split means one of its halves is, without saying which.
  const under = <span className="withheld">under {counties.min_cell}</span>;
  const withheld = <span className="withheld">withheld</span>;

  return (
    <section>
      <h2>Who each county sends to prison</h2>
      <p className="section-dek">
        {first.people != null && <>Of the {num(counties.people)} people in state prison
        on {apDate(counties.as_of)}, {num(first.people)} were convicted in {first.county} County.</>}
        {first.no_new_sentence != null && <> {num(first.no_new_sentence)} of them, {pct1(share(first))}, were
        there for violating probation, parole or extended supervision with no new sentence.
        Statewide the share is {pct1(pct(counties.no_new_sentence, counties.people))}.</>}
      </p>
      <div className="table-wrap">
        <table className="county-table">
          <thead>
            <tr>
              <th scope="col">County of conviction</th>
              <th scope="col" className="n">In state prison</th>
              <th scope="col" className="n">No new sentence</th>
              <th scope="col" className="n">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.county} className={all && home.includes(c.county) ? "home" : undefined}>
                <th scope="row">{c.county}</th>
                <td className="n">{c.people == null ? under : num(c.people)}</td>
                <td className="n">{c.no_new_sentence == null ? withheld : num(c.no_new_sentence)}</td>
                <td className="n">{share(c) == null ? "" : pct1(share(c))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Wisconsin</th>
              <td className="n">{num(counties.people)}</td>
              <td className="n">{num(counties.no_new_sentence)}</td>
              <td className="n">{pct1(pct(counties.no_new_sentence, counties.people))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button type="button" className="more" aria-expanded={all} onClick={() => setAll(!all)}>
        {all ? "Show only Marathon County and its neighbors" : "Show all 72 counties"}
      </button>
      <p className="chart-note">
        These are counts, not rates: larger counties send more people. &ldquo;No new sentence&rdquo; follows
        the admission type the department records for each person; the department publishes no
        definitions for its file. Counts that would describe fewer than {counties.min_cell} people
        are withheld. Source: the department&rsquo;s monthly Persons in Our Care data file,
        as of {apDate(counties.as_of)}.
      </p>
    </section>
  );
}
