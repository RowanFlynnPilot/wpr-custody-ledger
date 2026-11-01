import React from "react";
import { num, signed, typeset } from "./format.js";

// What moved this week, from changes.json: the records, the year's biggest gains and the week's biggest
// moves the weekly brief already computes. A name opens that facility in the list below.
const AT_LEAST = 20; // a jail at its highest with a handful of people is not news

const Name = ({ f }) => <a href={`#facility=${f.id}`}>{typeset(f.name)}</a>;

export default function Moved({ changes }) {
  const { at_record: records, largest_gains_year: year, largest_gains: gains, largest_drops: drops } = changes.facilities;
  const highs = records.filter((f) => f.population >= AT_LEAST).sort((a, b) => b.population - a.population).slice(0, 5);
  const moves = [...gains.slice(0, 3), ...drops.slice(0, 2)].filter((f) => f.week_change !== 0);
  return (
    <section className="moved" aria-labelledby="moved-h">
      <h2 id="moved-h">What moved this week</h2>
      <div className="moved-grid">
        <div>
          <h3>At their highest ever</h3>
          {highs.length
            ? <ul>{highs.map((f) => <li key={f.id}><Name f={f} /><b>{num(f.population)}</b></li>)}</ul>
            : <p className="moved-none">Nothing on the report is at its highest this week.</p>}
        </div>
        <div>
          <h3>Most added in a year</h3>
          <ul>{year.slice(0, 5).map((f) => <li key={f.id}><Name f={f} /><b>{signed(f.year_change)}</b></li>)}</ul>
        </div>
        <div>
          <h3>Biggest moves since last week</h3>
          <ul>{moves.map((f) => <li key={f.id}><Name f={f} /><b>{signed(f.week_change)}</b></li>)}</ul>
        </div>
      </div>
    </section>
  );
}
