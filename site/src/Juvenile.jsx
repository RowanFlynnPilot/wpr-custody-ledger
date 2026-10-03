import React from "react";
import TimeChart from "./TimeChart.jsx";
import { apMonthYear, monthYear, num, yearOf } from "./format.js";

const LFB_PAPER = "https://docs.legis.wisconsin.gov/misc/lfb/informational_papers/january_2025/0060_adult_corrections_program_informational_paper_60.pdf";
const IRMA = ["lincoln-hills", "copper-lake"]; // the two schools share a campus in Lincoln County

// Youth in the Division of Juvenile Corrections' own facilities, from the same weekly form.
export default function Juvenile({ statewide, facilities }) {
  const dates = statewide.map((w) => w.date);
  const youth = statewide.map((w) => w.juvenile_population);
  const last = youth.length - 1;
  const peak = youth.indexOf(Math.max(...youth));
  const schools = IRMA.map((id) => facilities.facilities.find((f) => f.id === id)).filter(Boolean);
  const atSchools = (i) => schools.reduce((sum, f) => sum + (f.population[i - f.start] ?? 0), 0);

  return (
    <section id="juvenile" tabIndex={-1}>
      <h2>{youth[last] < youth[0] / 2
        ? <>From {num(youth[0])} youth in {yearOf(dates[0])} to {num(youth[last])} this week</>
        : "Youth in state juvenile facilities"}</h2>
      <p className="section-dek">
        Youth held in the state&rsquo;s own juvenile facilities, weekly since {monthYear(dates[0])}. Of
        the {num(youth[last])} held now, {num(atSchools(last))} are at Lincoln Hills and Copper Lake
        schools in Lincoln County.
      </p>
      <TimeChart
        dates={dates} height={250} yMin={0}
        series={[{ key: "youth", label: "Youth held", color: "var(--chart-1)", values: youth, endLabel: num(youth[last]) }]}
        marks={[{ index: peak, value: youth[peak], color: "var(--chart-1)", text: `${apMonthYear(dates[peak])}: ${num(youth[peak])}` }]}
        name="Youth in juvenile facilities"
        label="Line chart: youth held in state juvenile facilities, weekly since 1999."
        tooltipNote={(i) => `${num(atSchools(i))} at Lincoln Hills and Copper Lake`}
      />
      <p className="chart-note">
        State law required Lincoln Hills and Copper Lake to close by July 1, 2021. Both were still
        operating in January 2025, and the department plans to convert them into a prison for men,
        according to the <a href={LFB_PAPER} target="_blank" rel="noreferrer">Legislative Fiscal Bureau</a>.
        Youth held in county-run detention centers are not on the state&rsquo;s form and are not counted here.
      </p>
    </section>
  );
}
