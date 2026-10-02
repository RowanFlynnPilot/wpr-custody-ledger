import React, { useState } from "react";
import { Sparkline } from "./TimeChart.jsx";
import { apDate, apMonthYear, num, pct, pct1, signed } from "./format.js";

const share = (r) => (r.noNew == null ? null : pct(r.noNew, r.people));
// What each column sorts on. Numbers run largest first, names A to Z; a second click reverses.
const COLUMNS = {
  county: { text: "County of conviction", short: "County", value: (r) => r.county },
  people: { text: "In state prison", short: "In prison", value: (r) => r.people },
  yearChange: { text: "In a year", value: (r) => r.yearChange },
  noNew: { text: "No new sentence", value: (r) => r.noNew },
  share: { text: "Share of total", short: "Share", value: share },
};

// People in state prison by the county that convicted them, from DOC's monthly file. The
// pipeline withholds any count under `min_cell` before it reaches this page; null means withheld.
export default function Counties({ counties, home }) {
  const [all, setAll] = useState(false);
  const [sort, setSort] = useState({ key: "people", reversed: false });
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
  const state = now({ county: "Wisconsin", people: counties.people, no_new_sentence: counties.no_new_sentence });
  const first = now(counties.counties.find((c) => c.county === home[0]));

  // Withheld figures sort to the bottom whichever way the column runs.
  const value = COLUMNS[sort.key].value;
  const natural = (x, y) => (typeof x === "string" ? x.localeCompare(y) : y - x);
  const rows = counties.counties.map(now)
    .filter((r) => all || home.includes(r.county))
    .sort((a, b) => {
      const x = value(a), y = value(b);
      if (x == null || y == null) return (x == null) - (y == null);
      return sort.reversed ? -natural(x, y) : natural(x, y);
    });

  // A withheld total is under the floor. A withheld split means one of its halves is, without saying which.
  const under = <span className="withheld">under {counties.min_cell}</span>;
  const withheld = <span className="withheld">withheld</span>;
  const change = (r) => (r.yearChange == null ? "" : r.yearChange === 0 ? "0" : signed(r.yearChange));
  const toggle = (
    <button type="button" className="more" aria-expanded={all} onClick={() => setAll(!all)}>
      {all ? "Show only Marathon County and its neighbors" : "Show all 72 counties"}
    </button>
  );
  const heading = (key) => {
    const on = sort.key === key;
    const ascending = (key === "county") !== sort.reversed;
    return (
      <th key={key} scope="col" className={key === "county" ? undefined : "n"}
        aria-sort={on ? (ascending ? "ascending" : "descending") : undefined}>
        <button type="button" className="sort" onClick={() => setSort({ key, reversed: on && !sort.reversed })}>
          {COLUMNS[key].short
            ? <><span className="wide">{COLUMNS[key].text}</span><span className="narrow">{COLUMNS[key].short}</span></>
            : COLUMNS[key].text}
        </button>
      </th>
    );
  };

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
    <section id="counties" tabIndex={-1}>
      <h2>Who each county sends to prison</h2>
      <p className="section-dek">
        {first.people != null && <>Of the {num(state.people)} people in state prison
        on {apDate(asOf)}, {num(first.people)} were convicted in {first.county} County
        {first.yearChange != null && <>, {first.yearChange === 0 ? "the same as" : `${num(Math.abs(first.yearChange))} ${first.yearChange > 0 ? "more" : "fewer"} than`} a year earlier</>}.</>}
        {first.noNew != null && <> {num(first.noNew)} of them, {pct1(share(first))}, were there for
        violating probation, parole or extended supervision with no new sentence. Statewide the
        share is {pct1(share(state))}.</>}
      </p>
      {toggle}
      <div className="table-wrap">
        <table className="county-table">
          <thead>
            <tr>
              {Object.keys(COLUMNS).map(heading)}
              <th scope="col" className="wide">Since {apMonthYear(counties.months[0])}</th>
            </tr>
          </thead>
          <tbody>{rows.map((r) => line(r))}</tbody>
          <tfoot>{line(state, true)}</tfoot>
        </table>
      </div>
      {all && toggle}
      <p className="chart-note">
        {all && <>Marathon County and its neighbors are in bold. </>}
        These are counts, not rates: larger counties send more people. The statewide total is
        lower than the weekly figure at the top of the page because it is older and leaves out
        people held temporarily. &ldquo;No new sentence&rdquo; follows
        the admission type the department records for each person; the department publishes no
        definitions for its file. Counts that would describe fewer than {counties.min_cell} people
        are withheld. Source: the department&rsquo;s monthly Persons in Our Care data files,
        {" "}{apMonthYear(counties.months[0])} through {apMonthYear(asOf)}.
      </p>
    </section>
  );
}
