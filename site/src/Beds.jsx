import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { apDate, num } from "./format.js";

// The whole system, bed by bed: one teal square for every 25 beds, and one rust square for every
// 25 people beyond them, set below a capacity line. A replay runs every weekly report since 1999.
const UNIT = 25;
const GAP = 2;
const STEP = 3; // weeks per frame in the replay: 1,451 weeks in about eight seconds
const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Beds({ statewide }) {
  const last = statewide.length - 1;
  const box = useRef(null);
  const canvas = useRef(null);
  const [width, setWidth] = useState(0);
  const [week, setWeek] = useState(last);
  const [playing, setPlaying] = useState(false);
  // The page's one authored moment: on load the people beyond capacity fill in below the line.
  const [spill, setSpill] = useState(() => (calm() ? 1 : 0));

  useLayoutEffect(() => {
    const measure = () => setWidth(Math.round(box.current.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (spill >= 1) return undefined;
    let frame, start;
    const run = (t) => {
      start ??= t + 300;
      const k = Math.min(1, Math.max(0, (t - start) / 900));
      setSpill(1 - (1 - k) ** 3);
      if (k < 1) frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The replay: smooth, a few weeks a frame; for a reader who asks for less motion, a year at a time.
  useEffect(() => {
    if (!playing) return undefined;
    const still = calm();
    let frame, at = week >= last ? 0 : week;
    const run = () => {
      at = Math.min(last, at + (still ? 52 : STEP));
      setWeek(at);
      if (at >= last) return setPlaying(false);
      frame = still ? setTimeout(run, 400) : requestAnimationFrame(run);
    };
    frame = still ? setTimeout(run, 400) : requestAnimationFrame(run);
    return () => (still ? clearTimeout(frame) : cancelAnimationFrame(frame));
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const w = statewide[week];
  const beds = Math.round(w.capacity / UNIT);
  const people = Math.round(w.population / UNIT);
  const full = Math.min(people, beds);
  const over = Math.max(0, people - beds);
  // Room for the most beds and the most people beyond them the system has had, so the drawing keeps
  // its height through a replay.
  const mostBeds = Math.max(...statewide.map((s) => Math.round(s.capacity / UNIT)));
  const mostOver = Math.max(...statewide.map((s) => Math.round(s.population / UNIT) - Math.round(s.capacity / UNIT)));
  const cell = width >= 700 ? 11 : 9;
  const cols = Math.max(10, Math.floor((width + GAP) / (cell + GAP)));
  const bedRows = Math.ceil(mostBeds / cols);
  const overRows = Math.ceil(mostOver / cols);
  const rule = 40; // the band between the beds and the people beyond them; its label sits above the line
  const drawnWidth = cols * (cell + GAP) - GAP;
  const height = (bedRows + overRows) * (cell + GAP) + rule;
  const ruleTop = bedRows * (cell + GAP) + 26;

  useLayoutEffect(() => {
    if (!width) return;
    const ratio = window.devicePixelRatio || 1;
    const c = canvas.current;
    c.width = drawnWidth * ratio;
    c.height = height * ratio;
    const g = c.getContext("2d");
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, drawnWidth, height);
    const style = getComputedStyle(c);
    const color = (name) => style.getPropertyValue(name).trim();
    const square = (k, top, color, outline) => {
      const x = (k % cols) * (cell + GAP), y = top + Math.floor(k / cols) * (cell + GAP);
      if (outline) { g.strokeStyle = color; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1); }
      else { g.fillStyle = color; g.fillRect(x, y, cell, cell); }
    };
    // A bed with no one in it would be an outline; there has been no such week since 1999.
    for (let k = 0; k < beds; k++) square(k, 0, k < full ? color("--chart-1") : color("--line-strong"), k >= full);
    const shown = week === last ? Math.round(over * spill) : over;
    for (let k = 0; k < shown; k++) square(k, bedRows * (cell + GAP) + rule, color("--chart-2"));
  }, [width, week, spill, cols, cell, beds, full, over, bedRows, drawnWidth, height, last]);

  const playLabel = playing ? "Pause" : week < last ? "Play from here" : "Replay since 1999";
  const current = week === last;
  return (
    <div className="beds">
      <div className="beds-controls">
        <button type="button" className={playing ? "replay playing" : "replay"} onClick={() => setPlaying(!playing)}>
          <span className={playing ? "replay-pause" : "replay-play"} aria-hidden="true" />{playLabel}
        </button>
        <input type="range" min="0" max={last} step="1" value={week} aria-label="Week shown"
          aria-valuetext={`${apDate(w.date)}: ${num(w.population)} people, ${num(w.capacity)} capacity`}
          onChange={(e) => { setPlaying(false); setWeek(Number(e.target.value)); }} />
        <span className="beds-date" aria-hidden="true">{apDate(w.date)}</span>
      </div>
      <div className="beds-frame" ref={box}>
        <canvas ref={canvas} style={{ width: drawnWidth, height }} role="img"
          aria-label={`${apDate(w.date)}: ${num(Math.min(w.population, w.capacity))} people within design capacity and ${num(Math.max(0, w.population - w.capacity))} beyond it. Each square is ${UNIT}.`} />
        {width > 0 && (
          <span className="beds-rule" style={{ top: ruleTop, width: drawnWidth }}>
            <span className="full">Every bed is full. Everyone below this line is beyond capacity.</span>
            <span className="narrow">Below this line: no bed</span>
          </span>
        )}
      </div>
      <p className="hero-key">
        <span><span className="key-box" style={{ background: "var(--chart-1)" }} /><strong>{num(Math.min(w.population, w.capacity))}</strong> within design capacity</span>
        <span><span className="key-box" style={{ background: "var(--chart-2)" }} /><strong>{num(Math.max(0, w.population - w.capacity))}</strong> people beyond that</span>
      </p>
      <p className="beds-unit">
        One square is {UNIT} beds, or {UNIT} people.
        {!current && !playing && <> <button type="button" className="more" onClick={() => setWeek(last)}>Back to this week</button></>}
      </p>
    </div>
  );
}
