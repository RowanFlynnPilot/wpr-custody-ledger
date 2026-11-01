import React, { useLayoutEffect, useRef, useState } from "react";
import { apDate, pct, pct1, yearOf } from "./format.js";

// Crowding stripes, after Ed Hawkins' warming stripes: one stripe for every weekly report since 1999,
// darker the further past capacity. Every stripe is past capacity, which is the point.
const RAMP = ["--h0", "--h1", "--h2", "--h3", "--h4", "--h5"];

export default function Stripes({ statewide }) {
  const box = useRef(null);
  const canvas = useRef(null);
  const [width, setWidth] = useState(0);
  const [at, setAt] = useState(null);
  const rates = statewide.map((w) => pct(w.population, w.capacity));
  // The color runs across the range the record actually covers, in steps of five points.
  const lo = Math.floor(Math.min(...rates) / 5) * 5, hi = Math.ceil(Math.max(...rates) / 5) * 5;
  const low = rates.indexOf(Math.min(...rates)), high = rates.indexOf(Math.max(...rates));
  const height = width >= 700 ? 64 : 44;

  useLayoutEffect(() => {
    const measure = () => setWidth(Math.round(box.current.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!width) return;
    const ratio = window.devicePixelRatio || 1;
    const c = canvas.current;
    c.width = width * ratio;
    c.height = height * ratio;
    const g = c.getContext("2d");
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    const style = getComputedStyle(c);
    const stops = RAMP.map((name) => style.getPropertyValue(name).trim()).map((hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)));
    const shade = (rate) => {
      const t = Math.max(0, Math.min(1, (rate - lo) / (hi - lo))) * (stops.length - 1);
      const k = Math.min(stops.length - 2, Math.floor(t)), f = t - k;
      return `rgb(${stops[k].map((v, i) => Math.round(v + (stops[k + 1][i] - v) * f)).join(",")})`;
    };
    const step = width / rates.length;
    rates.forEach((rate, i) => {
      g.fillStyle = shade(rate);
      g.fillRect(i * step, 0, step + 0.6, height); // a hair of overlap, so no seam shows between stripes
    });
  }, [width, height, statewide]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (e) => {
    const b = canvas.current.getBoundingClientRect();
    setAt(Math.min(rates.length - 1, Math.max(0, Math.floor(((e.clientX - b.left) / b.width) * rates.length))));
  };
  const first = statewide[0].date, last = statewide[statewide.length - 1].date;
  return (
    <figure className="stripes">
      <div className="stripes-frame" ref={box} onPointerMove={pick} onPointerDown={pick}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setAt(null); }}>
        <canvas ref={canvas} style={{ width: width || "100%", height }} role="img"
          aria-label={`Crowding stripes: one stripe for each of ${rates.length.toLocaleString("en-US")} weekly reports since ${yearOf(first)}, darker the further past capacity. The lowest was ${pct1(rates[low])}, on ${apDate(statewide[low].date)}; the highest ${pct1(rates[high])}, on ${apDate(statewide[high].date)}.`} />
      </div>
      <figcaption>
        <span className="stripes-year">{yearOf(first)}</span>
        {at == null
          ? <span className="stripes-key">
              Every weekly report, one stripe each, by percent of capacity:
              <span className="stripes-ramp" aria-hidden="true" /> {lo}% to {hi}%
            </span>
          : <span className="stripes-key stripes-reading" aria-hidden="true">{apDate(statewide[at].date)}: {pct1(rates[at])} of capacity</span>}
        <span className="stripes-year">{yearOf(last)}</span>
      </figcaption>
    </figure>
  );
}
