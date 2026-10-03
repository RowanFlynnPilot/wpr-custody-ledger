import React from "react";
import TimeChart from "./TimeChart.jsx";
import { COLOR } from "./Statewide.jsx";
import { apDate, num } from "./format.js";

// People on probation or parole beside people in prison: both are counts of people, so one axis.
export default function Supervision({ statewide }) {
  const now = statewide[statewide.length - 1];
  const perPrisoner = (now.supervision_population / now.population).toFixed(1);

  return (
    <section id="supervision" tabIndex={-1}>
      <h2>{now.supervision_population > now.population ? "More people are on probation or parole than in prison" : "Probation and parole"}</h2>
      <p className="section-dek">
        The department supervised {num(now.supervision_population)} people on probation or parole
        {now.supervision_as_of && <> as of {apDate(now.supervision_as_of)}</>}: about {perPrisoner} for every
        person in prison.
        {now.supervision_holds != null && <> The same report counts {num(now.supervision_holds)} people
        on supervision held in custody, at the Milwaukee Secure Detention Facility and in county jails.</>}
      </p>
      <TimeChart
        dates={statewide.map((w) => w.date)} height={250} yMin={0}
        series={[
          { key: "prison", label: "In prison", color: COLOR.population, values: statewide.map((w) => w.population), endLabel: num(now.population) },
          { key: "supervision", label: "On probation or parole", color: "var(--chart-3)",
            values: statewide.map((w) => w.supervision_population), endLabel: num(now.supervision_population) },
        ]}
        name="Probation and parole, and prison"
        label="Line chart: people on probation or parole and people in prison in Wisconsin, since 1999."
        tooltipNote={(i) => statewide[i].supervision_as_of && `Supervision count as of ${apDate(statewide[i].supervision_as_of)}`}
      />
      <p className="chart-note">
        The department updates the supervision count about once a month, and it runs one to
        several months behind the report it is printed on. Each point sits at its report&rsquo;s date.
      </p>
    </section>
  );
}
