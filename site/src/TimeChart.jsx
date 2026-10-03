import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { apDate, num, time, yearOf } from "./format.js";

// One weekly time chart for the whole page: lines (optionally with a wash between two of them)
// or stacked areas, on a single y-axis. A crosshair snaps to the nearest report and one tooltip
// lists every series; the arrow keys do the same for keyboard readers.
//
// series: [{ key, label, color, values, width?, legend?, endLabel? }]  values[i] may be null
// wash:   { upper, lower, color }   fills where the upper series runs above the lower ones (people beyond capacity)
// marks:  [{ index, value, text, place?, wideOnly? }]  a dot on the data with a short label
// table:  a yearly table of the same figures under the chart; a caller with its own passes it as children
// name:   what the chart shows, in a few words: names its table and the button that opens it, so each can be told apart
// format: axis ticks; valueFormat: the readout and the table (defaults to format)

const MARGIN = { top: 26, right: 62, bottom: 26, left: 46 };

// A round step that gives about `target` gridlines between lo and hi.
function niceStep(lo, hi, target = 5) {
  const mag = 10 ** Math.floor(Math.log10((hi - lo) / target));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => (hi - lo) / s <= target + 1);
}

function path(points) {
  // points: [x, y] or null; a null starts a new stroke, so gaps in the record stay gaps
  let d = "", pen = false;
  for (const p of points) {
    if (!p) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    pen = true;
  }
  return d;
}

export default function TimeChart({
  dates, series, wash, marks = [], stacked = false,
  height = 340, yMin, yMax, format = num, valueFormat = format, label, name, tooltipNote, children, table = !children,
}) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(null);
  const tip = useRef(null);
  const [tipWidth, setTipWidth] = useState(0);
  useLayoutEffect(() => { if (active != null && tip.current) setTipWidth(tip.current.offsetWidth); }, [active]);
  // The frame takes its width from the page and the drawing is laid over it, so the drawing can
  // never push its container wider (inside a table cell it otherwise would, and never shrink back).
  useLayoutEffect(() => {
    const measure = () => setWidth(Math.max(280, Math.round(wrap.current.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap.current);
    return () => observer.disconnect();
  }, []);

  const times = useMemo(() => dates.map(time), [dates]);
  // Stacked: each series sits on the ones before it.
  const drawn = useMemo(() => {
    if (!stacked) return series.map((s) => ({ ...s, top: s.values, base: null }));
    let running = dates.map(() => 0);
    return series.map((s) => {
      const base = running;
      running = base.map((b, i) => b + (s.values[i] || 0));
      return { ...s, top: running, base };
    });
  }, [series, stacked, dates]);

  const all = drawn.flatMap((s) => s.top).filter((v) => v != null);
  const lo = yMin ?? (stacked ? 0 : Math.min(...all));
  const hi = yMax ?? Math.max(...all);
  // The axis runs from gridline to gridline, so the highest and lowest values sit inside labeled lines.
  const step = niceStep(lo, hi);
  const y0 = Math.floor(lo / step + 1e-9) * step, y1 = Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let v = y0; v <= y1 + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);

  const narrow = width < 560;
  // Margins are measured from what has to fit in them: the longest tick label on the left and the
  // longest end label on the right. Both are 12px mono, about 7.3px a character.
  const longest = (texts) => Math.max(0, ...texts.map((t) => String(t).length));
  const margin = {
    ...MARGIN,
    left: Math.max(30, longest(ticks.map(format)) * 7.3 + 14),
    right: Math.max(14, longest(drawn.map((s) => s.endLabel || "")) * 7.3 + 22),
  };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const x = (i) => margin.left + ((times[i] - times[0]) / (times[times.length - 1] - times[0] || 1)) * plotW;
  const y = (v) => margin.top + plotH - ((v - y0) / (y1 - y0)) * plotH;

  const firstYear = yearOf(dates[0]), lastYear = yearOf(dates[dates.length - 1]);
  const span = lastYear - firstYear;
  const every = span > 16 ? (narrow ? 10 : 5) : span > 6 ? (narrow ? 4 : 2) : 1;
  const yearTicks = [];
  for (let yr = Math.ceil(firstYear / every) * every; yr <= lastYear; yr += every) {
    const t = Date.UTC(yr, 0, 1);
    if (t >= times[0]) yearTicks.push({ yr, px: margin.left + ((t - times[0]) / (times[times.length - 1] - times[0])) * plotW });
  }

  const nearest = (clientX) => {
    const box = wrap.current.getBoundingClientRect();
    const t = times[0] + ((clientX - box.left - margin.left) / plotW) * (times[times.length - 1] - times[0]);
    let a = 0, b = times.length - 1;
    while (b - a > 1) { const mid = (a + b) >> 1; if (times[mid] < t) a = mid; else b = mid; }
    return Math.abs(times[a] - t) <= Math.abs(times[b] - t) ? a : b;
  };
  const onKey = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, PageUp: -52, PageDown: 52 }[e.key];
    const last = dates.length - 1;
    if (step) setActive((i) => Math.min(last, Math.max(0, (i ?? last) + step)));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  // End labels: the last value of each series that asks for one, nudged apart if they touch.
  const ends = drawn.filter((s) => s.endLabel).map((s) => {
    let i = s.values.length - 1;
    while (i >= 0 && s.values[i] == null) i--;
    return { key: s.key, text: s.endLabel, color: s.color, px: x(i), py: y(s.top[i]), ly: y(s.top[i]) };
  }).sort((a, b) => a.py - b.py);
  for (let i = 1; i < ends.length; i++) if (ends[i].ly - ends[i - 1].ly < 15) ends[i].ly = ends[i - 1].ly + 15;

  const legend = drawn.filter((s) => s.legend !== false);
  // The readout sits beside the crosshair, on the side with more room, and is measured so it always fits inside
  // the frame: on a narrow phone chart where neither side has room it slides along instead of running off the page.
  const tipX = (() => {
    if (active == null) return 0;
    const px = x(active), w = tipWidth || 168, gap = 12;
    const sides = px > margin.left + plotW * 0.58 ? [px - gap - w, px + gap] : [px + gap, px - gap - w];
    const fits = sides.find((left) => left >= 0 && left + w <= width);
    return fits ?? Math.max(0, Math.min(width - w, px - w / 2));
  })();
  const yearEnds = dates.map((_, i) => i).filter((i) => i === dates.length - 1 || yearOf(dates[i + 1]) !== yearOf(dates[i]));
  // The readout as one line of text: what a screen reader hears for the week the arrow keys are on.
  const reading = active ?? dates.length - 1;
  const spoken = [apDate(dates[reading]), ...[...drawn].reverse().filter((s) => s.values[reading] != null)
    .map((s) => `${s.label}: ${valueFormat(s.values[reading])}`), tooltipNote && tooltipNote(reading)].filter(Boolean).join(". ");

  return (
    <figure className="chart">
      {legend.length > 1 && (
        <ul className="chart-legend">
          {legend.map((s) => (
            <li key={s.key}>
              <span className={stacked ? "key-box" : "key-line"} style={{ background: s.color }} />
              {s.legendLabel || s.label}
            </li>
          ))}
        </ul>
      )}
      <div
        className="chart-frame" ref={wrap} style={{ height }} tabIndex={0}
        // A slider over the weeks, so screen readers hand it the arrow keys and read out each week it lands on.
        role="slider" aria-valuemin={0} aria-valuemax={dates.length - 1} aria-valuenow={reading} aria-valuetext={spoken}
        aria-label={`${label} Use the arrow keys to read each week.`}
        onKeyDown={onKey} onBlur={() => setActive(null)}
        onPointerMove={(e) => setActive(nearest(e.clientX))} onPointerDown={(e) => setActive(nearest(e.clientX))}
        // A mouse leaving clears the readout; a finger lifting leaves it up until the reader taps elsewhere.
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null); }}
      >
        {width > 0 && <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={margin.left} x2={margin.left + plotW} y1={y(t)} y2={y(t)} />
              <text className="tick" x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{format(t)}</text>
            </g>
          ))}
          {yearTicks.map(({ yr, px }) => (
            <g key={yr}>
              <line className="grid" x1={px} x2={px} y1={margin.top + plotH} y2={margin.top + plotH + 5} />
              <text className="tick" x={px} y={margin.top + plotH + 18} textAnchor="middle">{yr}</text>
            </g>
          ))}

          {wash && (() => {
            const up = drawn.find((s) => s.key === wash.upper).top;
            const down = wash.lower.map((k) => drawn.find((s) => s.key === k).top);
            const below = (i) => down.map((d) => d[i]).find((v) => v != null);
            const idx = dates.map((_, i) => i).filter((i) => up[i] != null && below(i) != null);
            const d = `M${idx.map((i) => `${x(i).toFixed(1)},${y(Math.max(up[i], below(i))).toFixed(1)}`).join("L")}` +
              `L${idx.reverse().map((i) => `${x(i).toFixed(1)},${y(below(i)).toFixed(1)}`).join("L")}Z`;
            return <path d={d} fill={wash.color} opacity="0.12" />;
          })()}

          {stacked
            ? drawn.map((s) => {
                const upper = dates.map((_, i) => `${x(i).toFixed(1)},${y(s.top[i]).toFixed(1)}`);
                const lower = dates.map((_, i) => `${x(i).toFixed(1)},${y(s.base[i]).toFixed(1)}`).reverse();
                return <path key={s.key} d={`M${upper.join("L")}L${lower.join("L")}Z`} fill={s.color} className="area" />;
              })
            : drawn.map((s) => (
                <path key={s.key} className="line" stroke={s.color} strokeWidth={s.width || 2}
                  d={path(s.top.map((v, i) => (v == null ? null : [x(i), y(v)])))} />
              ))}

          {marks.filter((m) => !(narrow && m.wideOnly)).map((m) => {
            const px = x(m.index), py = y(m.value);
            const above = m.place !== "below";
            const anchor = px > margin.left + plotW * 0.72 ? "end" : px < margin.left + plotW * 0.2 ? "start" : "middle";
            // No room above a point at the top of the plot: set the label beside it instead.
            if (above && py - 21 < 12) {
              const left = px > margin.left + plotW * 0.72;
              return (
                <g key={m.text}>
                  <circle className="dot" cx={px} cy={py} r="4" fill={m.color} />
                  <text className="mark-text" x={px + (left ? -10 : 10)} y={py} dy="0.32em" textAnchor={left ? "end" : "start"}>{m.text}</text>
                </g>
              );
            }
            return (
              <g key={m.text}>
                <line className="leader" x1={px} x2={px} y1={py + (above ? -6 : 6)} y2={py + (above ? -16 : 16)} />
                <circle className="dot" cx={px} cy={py} r="4" fill={m.color} />
                <text className="mark-text" x={px} y={py + (above ? -21 : 28)} textAnchor={anchor}>{m.text}</text>
              </g>
            );
          })}
          {ends.map((e) => (
            <g key={e.key}>
              {!stacked && <circle className="dot" cx={e.px} cy={e.py} r="4" fill={e.color} />}
              <text className="end-text" x={e.px + 9} y={e.ly} dy="0.32em">{e.text}</text>
            </g>
          ))}

          {active != null && (
            <g>
              <line className="crosshair" x1={x(active)} x2={x(active)} y1={margin.top - 6} y2={margin.top + plotH} />
              {!stacked && drawn.map((s) => s.top[active] != null && (
                <circle key={s.key} className="dot" cx={x(active)} cy={y(s.top[active])} r="4" fill={s.color} />
              ))}
            </g>
          )}
        </svg>}
        {active != null && (
          <div className="tooltip" aria-hidden="true" ref={tip} style={{ left: tipX, top: margin.top }}>
            <div className="tooltip-date">{apDate(dates[active])}</div>
            {[...drawn].reverse().map((s) => s.values[active] != null && (
              <div className="tooltip-row" key={s.key}>
                <span className={stacked ? "key-box" : "key-line"} style={{ background: s.color }} />
                <strong>{valueFormat(s.values[active])}</strong>
                <span>{s.label}</span>
              </div>
            ))}
            {tooltipNote && tooltipNote(active) && <div className="tooltip-note">{tooltipNote(active)}</div>}
          </div>
        )}
      </div>
      {table && (
        <details className="table-view">
          <summary>Show these figures as a table{name && <span className="visually-hidden">: {name}</span>}</summary>
          <table>
            <caption>{name ? `${name}: the last report of each year.` : "The last report of each year."}</caption>
            <thead>
              <tr>
                <th scope="col">Report</th>
                {series.map((s) => <th scope="col" className="n" key={s.key}>{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {yearEnds.slice().reverse().map((i) => (
                <tr key={dates[i]}>
                  <th scope="row">{apDate(dates[i])}</th>
                  {series.map((s) => <td className="n" key={s.key}>{s.values[i] == null ? "" : valueFormat(s.values[i])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      {children}
    </figure>
  );
}

// The newest `count` weeks of a facility's history, blank where it was not on the report, so
// every small trend line on the page covers the same stretch of time.
export function recent(facility, count, weeks) {
  return Array.from({ length: count }, (_, k) => {
    const i = weeks - count + k - facility.start;
    return i >= 0 && i < facility.population.length ? facility.population[i] : null;
  });
}

// A small trend line for a table row or card. No axes: the number beside it carries the value.
export function Sparkline({ values, width = 120, height = 30, color = "var(--chart-1)" }) {
  const present = values.filter((v) => v != null);
  if (present.length < 2) return null;
  const lo = Math.min(...present), hi = Math.max(...present);
  const px = (i) => 3 + (i / (values.length - 1)) * (width - 6);
  const py = (v) => height - 4 - ((v - lo) / (hi - lo || 1)) * (height - 8);
  const last = values.length - 1;
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path className="line" stroke={color} strokeWidth="1.5" d={path(values.map((v, i) => (v == null ? null : [px(i), py(v)])))} />
      {values[last] != null && <circle className="dot" cx={px(last)} cy={py(values[last])} r="3" fill={color} />}
    </svg>
  );
}
