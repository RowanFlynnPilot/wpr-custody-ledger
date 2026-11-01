import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { apMonthYear, inWords, monthYear, num, shortName as short, typeset, yearOf } from "./format.js";

// Every state prison and center on this week's report, every month since 1999, colored by percent of
// capacity. A month's figure is its last weekly report. Rust means beyond capacity, as everywhere else.
const STATE = ["institution", "center", "secure", "treatment"];
const STEPS = [[100, "--h-under"], [125, "--h0"], [150, "--h1"], [175, "--h2"], [200, "--h3"], [250, "--h4"], [Infinity, "--h5"]];
const LEGEND = ["at or under capacity", "to 125%", "to 150%", "to 175%", "to 200%", "to 250%", "over 250%"];
const ROW = 16;

export default function History({ facilities, latest }) {
  const { dates } = facilities;
  const months = useMemo(() => dates.map((_, i) => i).filter((i) => i === dates.length - 1 || dates[i + 1].slice(0, 7) !== dates[i].slice(0, 7)), [dates]);
  const rows = useMemo(() => {
    const history = Object.fromEntries(facilities.facilities.map((f) => [f.id, f]));
    return latest.facilities
      .filter((f) => f.capacity && STATE.includes(f.type))
      .map((f) => {
        const h = history[f.id];
        const cells = months.map((i) => {
          const k = i - h.start;
          const p = h.population[k], c = h.capacity?.[k];
          return k >= 0 && k < h.population.length && p != null && c ? { p, c, pct: Math.round((100 * p) / c) } : null;
        });
        return { id: f.id, name: f.name, now: (100 * f.population) / f.capacity, cells };
      })
      .sort((a, b) => b.now - a.now);
  }, [facilities, latest, months]);
  const always = rows.filter((r) => r.cells.some(Boolean) && r.cells.every((c) => !c || c.pct > 100));

  const box = useRef(null);
  const canvas = useRef(null);
  const [width, setWidth] = useState(0);
  const [at, setAt] = useState(null);
  useLayoutEffect(() => {
    const measure = () => setWidth(Math.round(box.current.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  const height = rows.length * ROW;
  useLayoutEffect(() => {
    if (!width) return;
    const ratio = window.devicePixelRatio || 1;
    const c = canvas.current;
    c.width = width * ratio;
    c.height = height * ratio;
    const g = c.getContext("2d");
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, width, height);
    const style = getComputedStyle(c);
    const colors = STEPS.map(([, name]) => style.getPropertyValue(name).trim());
    const step = width / months.length;
    rows.forEach((r, k) => r.cells.forEach((cell, j) => {
      if (!cell) return;
      g.fillStyle = colors[STEPS.findIndex(([top]) => cell.pct <= top)];
      g.fillRect(j * step, k * ROW + 1, step + 0.6, ROW - 2);
    }));
  }, [width, height, rows, months]);

  const pick = (e) => {
    const b = canvas.current.getBoundingClientRect();
    const k = Math.floor((e.clientY - b.top) / ROW), j = Math.floor(((e.clientX - b.left) / b.width) * months.length);
    setAt(rows[k]?.cells[j] ? { k, j } : null);
  };
  const tip = at && rows[at.k].cells[at.j];
  const firstYear = yearOf(dates[months[0]]), lastYear = yearOf(dates[months[months.length - 1]]);
  const decades = [];
  const every = width && width < 420 ? 10 : 5; // a narrow strip labels decades only
  for (let y = Math.ceil(firstYear / every) * every; y <= lastYear; y += every) {
    const j = months.findIndex((i) => dates[i].startsWith(`${y}-01`));
    if (j >= 0) decades.push({ y, left: (100 * j) / months.length });
  }
  const yearEnds = months.filter((i, n) => n === months.length - 1 || dates[months[n + 1]].slice(0, 4) !== dates[i].slice(0, 4));

  return (
    <section id="history" tabIndex={-1}>
      <h2>Every prison and center, every month since {firstYear}</h2>
      <p className="section-dek">
        Each row is one of the {rows.length} state prisons and centers on this week&rsquo;s report, each
        column a month since {monthYear(dates[months[0]])}, darker the further past capacity, most crowded
        first. {always.length > 1 && <>Of these, {inWords(always.length)} have
        been past capacity in every month they have been on the report.</>}
      </p>
      <div className="history">
        <div className="history-axis" aria-hidden="true">
          {decades.map((d) => <span key={d.y} style={{ left: `${d.left}%` }}>{d.y}</span>)}
        </div>
        <ol className="history-names">
          {rows.map((r) => (
            <li key={r.id}><a href={`#facility=${r.id}`} aria-label={`${typeset(r.name)}: open its history`}>{short(r.name)}</a></li>
          ))}
        </ol>
        <div className="history-frame" ref={box} onPointerMove={pick} onPointerDown={pick}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setAt(null); }}>
          <canvas ref={canvas} style={{ width: width || "100%", height }} role="img"
            aria-label={`Heat strip: percent of capacity for each of ${rows.length} state facilities, monthly since ${firstYear}. The table below has the figures.`} />
        </div>
      </div>
      <p className="history-readout" aria-hidden="true">
        {tip
          ? <><b>{typeset(rows[at.k].name)}</b>, {apMonthYear(dates[months[at.j]])}: {tip.pct}% of capacity, {num(tip.p)} people for {num(tip.c)} beds</>
          : <>Move across the strip, or tap it, to read any month.</>}
      </p>
      <p className="history-key">
        {LEGEND.map((text, k) => (
          <span key={text}><span className="key-box" style={{ background: `var(${STEPS[k][1]})` }} />{text}</span>
        ))}
      </p>
      <details className="table-view">
        <summary>Show these figures as a table<span className="visually-hidden">: percent of capacity by facility and year</span></summary>
        <table>
          <caption>Percent of capacity at each facility, the last report of each year.</caption>
          <thead>
            <tr><th scope="col">Facility</th>{yearEnds.map((i) => <th scope="col" className="n" key={i}>{dates[i].slice(0, 4)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row">{short(r.name)}</th>
                {yearEnds.map((i) => { const cell = r.cells[months.indexOf(i)]; return <td className="n" key={i}>{cell ? `${cell.pct}%` : ""}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="chart-note">
        A month&rsquo;s figure is its last weekly report, with capacity as the department printed it. Blank
        where a facility was not on the report. Select a name to open its history in the facility list.
      </p>
    </section>
  );
}
