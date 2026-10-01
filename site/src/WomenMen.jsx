import React from "react";
import TimeChart from "./TimeChart.jsx";
import { apDate, num, pct, pct1 } from "./format.js";

// Percent of design capacity for women's and men's prisons. Design era only: operating
// capacity, reported before March 2008, is a different measure and would not share an axis.
export default function WomenMen({ statewide }) {
  const weeks = statewide.filter((w) => w.capacity_type === "design");
  const now = weeks[weeks.length - 1];
  const round = (x) => Math.round(x * 10) / 10;
  const women = weeks.map((w) => round(pct(w.women_population, w.women_capacity)));
  const men = weeks.map((w) => round(pct(w.men_population, w.men_capacity)));
  const peak = women.indexOf(Math.max(...women));

  return (
    <section>
      <h2>{women[women.length - 1] > men[men.length - 1] ? <>Women&rsquo;s prisons are the most crowded</> : <>Women&rsquo;s and men&rsquo;s prisons</>}</h2>
      <p className="section-dek">
        The {num(now.women_population)} women in state custody are held in space designed
        for {num(now.women_capacity)}. Each line shows people held as a share of design capacity.
      </p>
      <TimeChart
        dates={weeks.map((w) => w.date)} height={300} yMin={100} format={(v) => `${v}%`}
        series={[
          { key: "men", label: "Men", color: "var(--chart-1)", values: men, endLabel: pct1(men[men.length - 1]) },
          { key: "women", label: "Women", color: "var(--chart-2)", values: women, endLabel: pct1(women[women.length - 1]) },
        ]}
        label="Line chart: people held as a percent of design capacity, women's and men's prisons, weekly since March 2008."
        tooltipNote={(i) => `${num(weeks[i].women_population)} women, ${num(weeks[i].men_population)} men`}
      />
      <p className="chart-note">
        The vertical scale starts at 100%, the point where a prison holds exactly what it was
        designed for. The women&rsquo;s rate was highest on {apDate(weeks[peak].date)}, at {pct1(women[peak])}.
        Women held in facilities listed with the men&rsquo;s, such as the Wisconsin Resource
        Center, are counted with the women.
      </p>
    </section>
  );
}
