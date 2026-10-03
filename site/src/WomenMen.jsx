import React from "react";
import TimeChart from "./TimeChart.jsx";
import { apDate, apMonthYear, num, pct, pct1 } from "./format.js";

// Percent of capacity for women's and men's prisons, the whole record. The form renamed the
// figure from operating to design capacity in March 2008 without redefining it (see CLAUDE.md),
// so both eras share the axis and nothing marks the rename.
// The women's capacity drawn here equals the women's subtotal the department printed in every report.
export default function WomenMen({ statewide }) {
  const weeks = statewide;
  const now = weeks[weeks.length - 1];
  const round = (x) => Math.round(x * 10) / 10;
  const women = weeks.map((w) => round(pct(w.women_population, w.women_capacity)));
  const men = weeks.map((w) => round(pct(w.men_population, w.men_capacity)));
  const peak = women.indexOf(Math.max(...women));
  const firstDesign = weeks.findIndex((w) => w.capacity_type === "design");
  // The earlier high: the most crowded week for women before the rename.
  const early = women.slice(0, firstDesign).reduce((best, v, i) => (v > women[best] ? i : best), 0);

  return (
    <section id="women" tabIndex={-1}>
      <h2>{women[women.length - 1] > men[men.length - 1] ? <>Women&rsquo;s prisons are the most crowded</> : <>Women&rsquo;s and men&rsquo;s prisons</>}</h2>
      <p className="section-dek">
        The {num(now.women_population)} women in state custody are held in space designed
        for {num(now.women_capacity)}. Each line shows people held as a share of capacity.
      </p>
      <TimeChart
        dates={weeks.map((w) => w.date)} height={300} yMin={100} format={(v) => `${v}%`} valueFormat={pct1}
        series={[
          { key: "men", label: "Men", color: "var(--chart-1)", values: men, endLabel: pct1(men[men.length - 1]) },
          { key: "women", label: "Women", color: "var(--chart-2)", values: women, endLabel: pct1(women[women.length - 1]) },
        ]}
        marks={early === peak ? [] : [{ index: early, value: women[early], color: "var(--chart-2)", wideOnly: true,
                                        text: `${apMonthYear(weeks[early].date)}: ${pct1(women[early])}` }]}
        label="Line chart: people held as a percent of capacity, women's and men's prisons, weekly since 1999."
        tooltipNote={(i) => `${num(weeks[i].women_population)} women, ${num(weeks[i].men_population)} men`}
      />
      <p className="chart-note">
        The vertical scale starts at 100%, the point where a prison holds exactly what it was
        designed for. The women&rsquo;s rate was highest on {apDate(weeks[peak].date)}, at {pct1(women[peak])}.
        A line steps down when beds are counted before they fill, as when the form first listed
        Stanley&rsquo;s 1,500 in September 2002 and 1,400 at New Lisbon and Chippewa Valley in April 2004.
        The women&rsquo;s rate jumps in November 2011, when a correctional center that had held women
        went back to holding men and its beds left the women&rsquo;s total.
        Women held in facilities listed with the men&rsquo;s, such as the Wisconsin Resource
        Center, are counted with the women.
      </p>
    </section>
  );
}
