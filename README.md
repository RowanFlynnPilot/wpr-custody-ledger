# The Custody Ledger

Wausau Pilot & Review's record of how many people Wisconsin holds in state prison, week by
week since January 1999, set against what the prisons were built to hold. It is compiled
from the Department of Corrections' weekly DOC-302 population reports: 1,446 of them so far.

DOC publishes each report as a PDF. This repository turns the whole run into data that
anyone can check, download and reuse: the statewide count, every prison, correctional
center, contract jail and juvenile facility, and the number of people on probation or parole.

## What is here

| File | Contents |
|---|---|
| `data/statewide.json` | One row per report: population, capacity, men and women, contract beds, juvenile facilities, community supervision |
| `data/facilities.json` | Every facility's weekly population and capacity, from its first report to its last |
| `data/latest.json` | The newest report: the statewide row plus every facility listed that week |
| `data/changes.json` | What moved in the newest report: records, streaks, year-over-year change, most crowded, biggest movers, close to home |
| `data/brief.md` | The same, drafted by rule as sentences for the newsroom |
| `data/counties.json` | People in state prison by county of conviction, and how many are in with no new sentence, from DOC's monthly data file. Counts under 10 are withheld |
| `data/csv/` | The same series as spreadsheets: `statewide.csv`, `facility_population.csv`, `facility_capacity.csv` (one column per facility), `facility_names.csv` |
| `data/reports/YYYY-MM-DD.json` | Every row of every report as DOC printed it, plus the source address and SHA-256 of the PDF it came from |

## How to read the numbers

- **Population** is the Total Population column of DOC's ADULT INSTITUTIONS row: people in
  Division of Adult Institutions custody plus Division of Community Corrections holds. It is
  the figure news reports cite for the size of the prison system.
- **Capacity changed meaning on March 14, 2008.** Before that date DOC reported operating
  capacity; since then it reports design capacity. The two are not comparable, so
  `capacity_type` travels with every row. Do not draw one capacity line across that date.
- **Capacity is the sum of DOC's facility rows.** In 136 of the 1,446 reports the total DOC
  printed does not equal the sum of its own rows: a subtotal formula left out a new prison,
  most of the correctional centers, or, for the first 12 weeks of design capacity, every
  women's bed. `capacity_printed` keeps DOC's figure; the stretches and their causes are
  listed in `scraper/corrections.py`.
- **A facility is one place, whatever DOC called it that week.** DOC has used 118 labels
  for 88 adult facilities and contract sites: renames, typos, and units of one prison on
  separate rows. `scraper/registry.py` maps each label to a facility.
- **Contract beds** are county jails, other states' prisons and federal prisons that held
  Wisconsin prisoners. They have no capacity of their own on the form.
- **`sex` and `security`** say where on the form a facility is listed, in its latest report.
- **Juvenile** figures are the on-grounds population of Division of Juvenile Corrections
  facilities, which the same form reports in a separate section.
- **Supervision** is the probation and parole count printed at the top of each form. It runs
  one to several months behind; `supervision_as_of` gives its date.
- **County counts** come from a different DOC source, the monthly Persons in Our Care data file, which
  lists every person in prison. Only counts are kept here: by county of conviction, and how many
  are in on a violation of supervision with no new sentence. Any count under 10 is withheld, and
  so is any split whose other half would be under 10. DOC publishes no definitions for that file;
  "no new sentence" follows the admission type recorded for each person.
- **Report dates** are read from each PDF's header, not its file name. Almost all are Fridays.
- **Three weeks are missing.** DOC's archive has no report for Aug. 22, 2003 or Aug. 13,
  2021, and the Jan. 4, 2013 PDF was published without its population columns.

## How it is checked

The pipeline stops, and publishes nothing, if any of these fail. All of them hold for every
report since 1999.

- The headline population equals DAI plus DCC, and matches the DAI total DOC prints
  separately at the top of the form.
- The facility rows add up to the headline population.
- Contract-bed rows add up to DOC's contract subtotal; women's and men's rows add up to
  DOC's subtotals for each; juvenile facilities add up to DOC's on-grounds total.
- Facility capacities add up to the headline capacity, except in the listed stretches where
  DOC's total is wrong.
- No week moves more than 3% from the one before. The largest real move in 27 years is 1.15%.
- A stored PDF has not changed. The eight newest reports are downloaded again on every run
  and compared by SHA-256, so a correction DOC makes in place is caught.
- The newest report is no more than 21 days old.

Where a source file needs correcting (a superseded report, a mistyped header date, a row
printed with a blank cell), the correction is listed with its reason in
`scraper/corrections.py`. Nothing is estimated.

A rebuild from nothing (`backfill.py`, `update.py`, `build.py`) reproduces the committed
data byte for byte.

## Run it

```
python -m pip install -r requirements.txt
python -m pytest -q
python scraper/update.py
python scraper/build.py
```

Needs Python 3.10 or newer. `update.py` reads DOC's Data and Reports page and stores any
report not yet in `data/reports/`. A GitHub Actions workflow does this three times a week.

## The site

`site/` is the reader-facing page (React and Vite), built from the committed data and
published to GitHub Pages; `site/public/embed.txt` has the code for embedding it in an article.

```
cd site
npm install
npm run dev
```

## Source

Wisconsin Department of Corrections, weekly population reports and archive:
<https://doc.wi.gov/Pages/DataResearch/DataAndReports.aspx>. Counties of state facilities
are from the Department of Health Services' list of state correctional institutions.

For a chart of each adult facility since 2006, see Wisconsin Watch's
[prison population tracker](https://wisconsin-watch.github.io/wisconsin_prison_population_tracker/).

## Reuse

Code and compiled data are released under the [MIT License](LICENSE). The underlying
reports are Wisconsin public records. If you use the data, please credit
"The Custody Ledger, Wausau Pilot & Review" and tell us: editor@wausaupilotandreview.com.
