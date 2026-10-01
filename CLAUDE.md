# wpr-custody-ledger

Working name: The Custody Ledger. A Wausau Pilot & Review tracker of Wisconsin's state prison population against capacity, built on the Department of Corrections' weekly DOC-302 population reports. Scaffolded Oct 1, 2026.

## Source

- Weekly reports: PDFs linked from https://doc.wi.gov/Pages/DataResearch/DataAndReports.aspx. 2026 file names are `fri_MM_DD_YYYY.pdf`; earlier years used other patterns, so links are always read from the page, never built.
- Archive: yearly zips 1999-2025 at `https://doc.wi.gov/DataResearch/ArchivedPopulationReports/{year}.zip`. Folder layout inside the zips varies by year.
- The PDFs are Excel exports with a real text layer. No OCR needed anywhere in the archive.

## Pipeline

| File | Job |
|---|---|
| `scraper/parse.py` | PDF bytes -> report dict (date, revision, PDF SHA-256, capacity type, headline, all rows) |
| `scraper/update.py` | Each run: read index page, store any report not yet stored, download the 8 newest again and compare |
| `scraper/backfill.py` | One-time: load the 1999-2025 archive zips (already run; data is committed) |
| `scraper/corrections.py` | Hand-verified skips and date fixes, each with a reason; used by backfill and update |
| `scraper/registry.py` | Every DOC row label -> facility id, name, type, county. Hand-built |
| `scraper/snapshot.py` | Facility breakdown of any report (adult and juvenile), reconciled to DOC's totals |
| `scraper/series.py` | One statewide row per report: headline, men/women, contract beds, juvenile, supervision |
| `scraper/build.py` | `data/reports/*.json` -> `statewide.json`, `facilities.json`, `latest.json`, `changes.json`, `brief.md`, `csv/` |
| `scraper/counties.py` | DOC's monthly person-level file -> one stored snapshot of county counts in `data/county_months/`. `--new` fetches months not yet stored (what `counties.yml` runs); `2026 9` or `--all` by hand. Holds the raw file in memory only. `build.py` turns the snapshots into `counties.json` + `csv/counties.csv` |
| `scraper/brief.py` | `changes.json` -> `data/brief.md`: flags, a four-paragraph draft, close to home, what moved. Fixed rules, no generation |
| `tests/` | Regression tests on one real PDF per format era, plus failure-mode tests |
| `site/` | React/Vite page. `cpdata.mjs` copies `data/*.json` and `data/csv/` into `site/public/data/` (ignored by git) before dev and build |
| `.github/workflows/counties.yml` | Tue, Fri: test, `counties.py --new`, build, commit, and deploy if a month was added. Shares `update.yml`'s concurrency group so the two never commit at once. Approved by the publisher Oct 1, 2026: it accepts DOC's disclaimer on each download |
| `.github/workflows/deploy.yml` | Builds `site/` from committed data and publishes to GitHub Pages: on a push that touches `site/` or `data/`, and when called by `update.yml` after a weekly commit |
| `.github/workflows/doc-attempt.yml` | One attempt at either DOC pipeline on a fresh runner: checks it can reach doc.wi.gov, then test, fetch, build, commit. The state network drops connections from some GitHub runner addresses, so `update.yml` and `counties.yml` chain up to five attempts; a blocked one ends green and hands off, and five blocked in a row fails the run. Same scheme as `wpr-cleanup-ledger` |
| `.github/workflows/update.yml` | Mon, Wed, Sat: test, update, build, commit. Saturday is the usual pickup; the others catch late postings and corrections. When a new report is stored it opens a GitHub issue holding `brief.md` (that is how the brief reaches the newsroom) and calls `deploy.yml` |

`data/reports/YYYY-MM-DD.json` is the stored truth (one per report, ~1,450 files). Everything else in `data/` is derived and rebuilt every run: `statewide.json` (one row per report, one per line), `facilities.json` (each facility's weekly population and capacity; arrays start at index `start` of `dates`), `latest.json`, `changes.json` (records, streaks, movers: the input for briefs and alerts) and `csv/`.

## Checks (every one holds for all 1,446 reports, 1999-2026)

The pipeline throws rather than publish when any of these fail:

- **Per report** (`parse.py`): date readable and a Thursday or Friday; headline has 4 columns; population == DAI + DCC; the separately printed "TOTAL ... (DAI)" line equals the headline DAI.
- **Facilities, every report** (`snapshot.py`): facility rows sum to the headline population; contract-bed rows sum to the 'Contract Facilities' row; women's and men's rows sum to DOC's subtotals; juvenile rows sum to 'Total On-Grounds Population'; capacities sum to the headline capacity except in `CAPACITY_MISPRINTS`; every label is in `registry.py`. Contract-bed capacity comes from the CONTRACT BEDS subtotals; Dodge Infirmary holds patients but has no capacity. DAI and DCC are not read from facility rows: those cells have typos in about 25 reports.
- **Whole series** (`build.py`): week-to-week population change under 3% (largest real move: 1.15%); exactly one operating -> design capacity switch.
- **Freshness** (`update.py`): throws if the newest stored report is more than 21 days old, so a silent DOC page change can't freeze the tracker.
- **Storage** (`store.py`): compares by the PDF's SHA-256. Same address with different bytes throws (DOC changed a file in place). Two addresses with different bytes claiming one date throws, with a pointer to `corrections.py`. Same bytes at a new address is the same report, and the new address is kept.
- **Unchanged source** (`update.py`): the 8 newest listed reports are downloaded again every run and pass through the storage check.

A full rebuild from scratch (backfill + update + build) reproduces the committed data byte for byte.

## When the weekly job fails

GitHub emails on a failed scheduled run. Read the error first; each one names the file and the broken check. A yellow "Runner blocked by the state network" warning on a green run is normal: that attempt handed off to another runner.
- **"No runner could reach doc.wi.gov"**: five runners in a row were blocked. Rerun the workflow; if it persists, DOC's site is down or the block has widened.
- **County month "is already stored from ..."** (`counties.yml`): DOC posted one snapshot under two months. Add the repeat to `MONTHLY_SKIP` in `corrections.py`, with the file's `Last-Modified` header.
- **"DOC replaced PIOCDF_..."** (`counties.yml`): a file in `MONTHLY_SKIP` has changed on DOC's server, probably corrected. Remove it from `MONTHLY_SKIP` and run `python scraper/counties.py YEAR MONTH`.
- **"The newest month accounted for is ..."** (`counties.yml`): nothing new in 80 days. Check DOC's monthly data page.
- **"conviction counties that are not Wisconsin counties" / "expected columns" / "but the weekly report ... counts"** (`counties.yml`): DOC changed the monthly file. Open it and adjust `counties.py`; add a test with made-up rows, never real ones.
- **Duplicate date** (DOC re-issued a week): add the superseded URL to `SKIP` in `corrections.py`, delete that date's file in `data/reports/`, rerun `update.py`.
- **"Unknown facility row"**: DOC added or renamed a row. Add the label to `LABELS` in `registry.py` (a new Wisconsin county jail in a contract block needs nothing). If it is a new subtotal, add it to the header sets in `snapshot.py`. Add the PDF as a test fixture if the form changed.
- **"fits no column layout"**: a row was printed with a blank cell. Open the PDF, add the row to `ROW_FIXES` in `corrections.py`.
- **Sums don't match** (population, contract, women, men, juvenile): open the PDF. Either the form changed or DOC's rows don't add up that week; fix in `snapshot.py` or record it in `corrections.py`, never by loosening a check.
- **"facility capacities sum to ... they should match"**: DOC's printed total capacity disagrees with its rows. If the PDF confirms it, add the stretch to `CAPACITY_MISPRINTS` with the cause.
- **"DOC changed ... after it was stored"**: DOC replaced a PDF at the same address. Compare the new PDF with the stored JSON; to accept it, delete that date's file in `data/reports/` and rerun `update.py`.
- **Weekly change over 3%**: open the source PDF and verify before touching `MAX_WEEKLY_CHANGE`.

## Each January

DOC moves the finished year's weekly PDFs into `{year}.zip`. Add that year to `YEARS` in `backfill.py` and rerun it. Reports whose bytes match take the zip address, which keeps source links live and the from-scratch rebuild identical to the committed data. A report that throws here means the zip copy differs from the weekly copy DOC first posted: look at both before choosing.

## Decisions

- **Headline metric** is the Total Population column of the ADULT INSTITUTIONS row (DAI + DCC holds). This is the figure press uses: it reproduces the Aug 9, 2019 peak of 23,826 and the Aug 28, 2026 record of 23,854 exactly. Not the "TOTAL PIOC (DAI)" line at the top.
- **Parse by content, not by form revision.** The archive has 150+ form revisions, so revision is stored as metadata only. A data row is a label followed by trailing numbers.
- **Report date comes from the PDF header** (first date after "Under Control on" / "in Our Care on"). Older headers were hand-typed with typos, so month names match on their first three letters. File names are not used; they have their own typos.
- **Archive errors are fixed explicitly** in `corrections.py`, never guessed. Backfill throws if a correction no longer matches a file or if two files share a date.
- **Capacity changed meaning on 2008-03-14:** "operating capacity" before, "design capacity" after. `statewide.json` carries `capacity_type`; never draw one continuous capacity line across that date.
- **Complement Wisconsin Watch, don't duplicate it.** Its tracker (wisconsin-watch.github.io/wisconsin_prison_population_tracker, since May 2026) charts the statewide total and 35 adult facilities from about 2006. The Ledger leads with what that lacks: 1999-2005, county-jail contract beds, juvenile facilities, the women's system, supervision, the north-central lens, and open data. Link to it.
- **Spell out Wausau Pilot & Review** on anything a reader sees. Statewide, "WPR" reads as Wisconsin Public Radio. The repo name stays.
- **MIT license** for code and compiled data.
- **Funded by grants, not sponsor slots.** No sponsor inventory on this tool.
- **Nothing published describes fewer than 10 people** (`MIN_CELL` in `counties.py`). A county total under 10 is withheld; a split is withheld if either half is under 10; withheld totals are folded into `people_not_shown_by_county` with the no-county rows so they can't be found by subtraction.
- **Person-level data stays out of the repo.** DOC's monthly file carries names and DOC numbers. Only county counts are stored.
- **"No new sentence"** = the latest admission type (`UPDT_ADM_TYPE` if filled in, else `ORIG_ADM_TYPE`) contains those words. About 1,000 people are admitted on a hold and reclassified after revocation, so the original type alone undercounts (29.1% vs 33.3% statewide on July 31, 2026). DOC publishes no data dictionary; confirm this reading with DOC before a story rests on it.
- **Never publish the DAI/DCC columns of DOC's subtotal rows.** Use the population column or sum the leaves (see Source errors).
- **Capacity is the sum of DOC's facility rows**, not the printed total. They are equal in 1,310 reports; in the other 136 the printed total is an arithmetic error inside DOC's form (`CAPACITY_MISPRINTS`). `capacity_printed` keeps DOC's figure. A mismatch outside the listed stretches throws.
- **A facility is one place.** Rows are merged by facility id across renames (SMCI -> WSPF), units on separate rows (Fox Lake Min, WSGP, the MSDF programs) and sex (St. Croix, county jails). `sex` and `security` are the form sections the facility sits in, latest report; `type` and `county` come from `registry.py`.
- **Facility parsing is by structure, with explicit header sets**: rows between the headline and the men's subtotal are summaries; parenthesized rows are splits of the row above; a row with a capacity ends a contract-beds block. An unknown label throws.
- **County of state facilities** is from DHS's BadgerCare Plus handbook, section 45.9 (release 22-02), not from memory. City and coordinates are not in the registry yet.

## Known gaps

DOC's archive has no report for 2003-08-22 or 2021-08-13. The 2013-01-04 PDF is skipped because its population columns are missing. The series has a 14-day step at each.

## Source errors and open questions

- **Printed total capacity is wrong in 136 reports** (five stretches, 2001-2008; see `CAPACITY_MISPRINTS`). The one that matters: for the first 12 weeks of design capacity (2008-03-14 to 05-30) the total repeats the men's subtotal and leaves out 1,123 women's beds. Read from the printed total, May 30, 2008 looks like 138.0% of capacity; it was 129.2%.
- **18 rows with a blank or mistyped cell** are in `ROW_FIXES`; one week's contract subtotal counts 19 people no row lists (`NOT_ITEMIZED`); one juvenile row is dropped by the parser because of a typed note (`JUVENILE_ROWS_DROPPED`).
- **Female subtotal, DAI column.** On every report since the form split contract beds by sex (2026-01-30 on), "SUB-TOTAL FEMALES (ALL LOCATIONS)" prints a DAI figure short by exactly that week's "CONTRACT BEDS (FEMALE)" DAI. Sep 25, 2026: population 1,750, DAI 1,728, DCC 15. The population column and the headline are right. DOC has not been told.
- **2004-08-05.** The header reads "August 5, 2004" (a Thursday); the file is `2004.08.06.pdf`. Nothing in the PDF settles which is the typo, so it is stored as the header reads.
- **1999-11-25 and 1999-11-26** are separate files with different counts, one day apart (Thanksgiving week). Both are stored.

## Findings as of the Sep 25, 2026 report

- Five straight record weeks: 23,854 (Aug 28) -> 23,870 -> 23,890 -> 23,897 -> 23,905 (Sep 25), each the highest in the archive back to 1999.
- Most crowded vs design capacity: Milwaukee Women's Center 255% (107/42), Drug Abuse Center 236%, Robert E. Ellsworth Center 220%, McNaughton 215%, Oakhill 211%.
- Local: Lincoln County Jail (Merrill) holds 74 state prisoners on contract, up from 16 when it first appeared (May 23, 2025) and 54 in January 2026. Oneida County Jail holds 120, Vilas 27. Lincoln Hills School holds 63 youth; its listed capacity is 519.
- Crowding rate: 133.8% of design capacity (6,045 over); 34 of 37 facilities with a design capacity are over it. The design-era record rate is 134.1% (23,782 on 17,739, Aug 10, 2018), so the head count is a record and the rate is 40 people short of one at today's capacity.
- Women: 1,750 on a design capacity of 974 (179.7%), the highest women's count and the highest women's rate in the archive. Men: 131.2%.
- At their own all-time highs on Sep 25: Oshkosh (2,133), Taycheedah (1,088), Racine Youthful Offender (474), Lincoln County Jail (74), Vernon County Jail (56).
- Out-of-state era: contract facilities peaked at 5,729 people on Aug 11, 2000 (Whiteville, Tenn.; Appleton, Minn.; Texas county jails; federal prisons).
- Since the pandemic low of 19,381 (May 14, 2021): +4,524. Probation and parole: 64,051, with 840 held in custody.

## Commands (Windows, PowerShell 5.1, Python 3.10+)

```
python -m pip install -r requirements.txt; python -m pytest -q; python scraper/update.py; python scraper/build.py
```

The workflow uses `actions/checkout@v6` and `actions/setup-python@v6` (Node 24). GitHub removed Node 20 from runners on Sep 16, 2026, so older majors fail.

## Site

- **One page, nine sections**: the weekly line since 1999, close to home, who each county sends to prison, women and men, contract beds, juvenile facilities, probation and parole, every facility (with each one's history), how it is compiled. Sections live in `site/src/*.jsx`; `TimeChart.jsx` draws every chart.
- **Design is the ledger family's** (`wpr-watch-ledger` is the model): cream `#f6f2e9`, teal `#3a867c`, Fraunces, Public Sans, JetBrains Mono for figures, fonts self-hosted through `@fontsource`. Light only, like its siblings.
- **Chart marks use their own three colors** (`--chart-1` teal `#12917d`, `--chart-2` rust `#c2573a`, `--chart-3` violet `#6a63b3`): the brand teal is too gray to work as a data color. The three pass the dataviz skill's palette validator on `#fffdf8`. Capacity is always the neutral gray line.
- **Copy is computed from the data** (lede, stat strip, headings with years, annotations), so nothing on the page goes stale when the record does. Dates are AP style, from `format.js`.
- **Close to home** is Marathon County, the counties bordering it, and Oneida, Vilas, Forest and Price: `HOME_COUNTIES` in `scraper/build.py`, carried to the site and the brief in `changes.json`. That list is an editorial choice.
- **Smoke test**: `site/smoke.mjs` (playwright-core driving the machine's own Chrome) loads the built site at desktop and phone widths and fails on a console error, a missing section, horizontal overflow or a facility link that does not open. `deploy.yml` runs it before publishing. It counts sections (`SECTIONS`), so update it when one is added.
- **Facility group buttons are toggle buttons** (`aria-pressed`), not ARIA tabs: they have no tab keyboard behavior.
- **Every workflow is pinned to `ubuntu-24.04`**; move them deliberately.
- **The juvenile section's note on Lincoln Hills** (closure deadline of July 1, 2021; still operating January 2025; planned conversion to a men's prison) is from the Legislative Fiscal Bureau's Informational Paper 60, January 2025. Recheck it when that paper is reissued.
- **Share card**: `site/og-card.py` (Pillow, fonts from `@fontsource`) draws `og-image.png` in the Watch Ledger's layout. Its row of marks is one per 500 people, rust for those beyond capacity, read from `data/latest.json`; so `deploy.yml` draws it on every deploy and the PNG is not committed.
- **Facility table on phones** (560px and under): CSS turns each row into a block, name on top, figures beneath, with a fixed first column so every bar is on one scale. The table carries explicit ARIA roles because that CSS strips table semantics in some browsers.
- **Deep links**: `#facility=<id>` opens that facility's history. The embed script forwards the article's hash into the frame.
- **The page reports its height** to the embedding page (`source: "wpr-custody-ledger"`), same scheme as the Watch Ledger.
- Local preview: `.claude/launch.json` starts the dev server on port 5173. After scripted multi-step edits to one file, touch it: Vite once served a stale transform.
- **Live** at https://rowanflynnpilot.github.io/wpr-custody-ledger/ since Oct 1, 2026 (GitHub Pages, source: GitHub Actions). Not yet embedded on the news site.

## Next

Phase 0, the data model, the site and the weekly brief are done. Still open: embed it on the news site, tell DOC about the female subtotal error, the capacity misprints and the repeated August 2026 monthly file.

0. **Site leftovers.** Where indexable text lives (an iframe from github.io earns the news site no search credit); a county picker so other newsrooms can localize the close-to-home panel.

1. **Registry leftovers.** City and coordinates for state facilities (needed for the map; take addresses from DOC's facility pages and geocode, don't type them from memory). Security-level statewide series if the front end wants one.
3. **Local layer.** Done through July 2026: 76 monthly snapshots (April 30, 2020 to July 31, 2026) in `data/county_months/`, a county table on the site. File facts: `https://doc.wi.gov/DataResearch/PIOCDF/PIOCDF_YYYY_MM.csv`, behind a click-through disclaimer (DOC does not certify accuracy; no redistribution terms), semicolon-delimited UTF-8 with BOM, 6-8 MB, one row per person with names and DOC numbers. The file named for a month is the snapshot of that month's last day. Three layouts so far (24 columns through November 2024, 26 after); December 2024 has every line wrapped as one quoted field, which `read_rows` unwraps. The file posted as August 2026 repeats July 31 row for row (`MONTHLY_SKIP`); DOC has not been told. Every month's head count is within 0.5% of the nearest DOC-302's DAI figure. July 31, 2026: 446 convicted in Marathon County (484 in April 2020; low 398, high 517), 181 of them (40.6%) with no new sentence, against 33.3% statewide. New months arrive on their own through `counties.yml`. Still to do: rates per 100,000 residents (needs Census county populations), where each county's people are held, a county line in the weekly brief.
4. **Jail layer.** Office of Detention Facilities annual report (county jail admissions, ADP, suicides).
5. **Distribution.** Reader analytics (the Packers tracker uses Plausible; this site has none), single-chart embeds for stories, a county-localized embed other Wisconsin newsrooms can run with credit.

Grant leads checked Oct 1, 2026: Data-Driven Reporting Project (Medill; $25,000-$40,000 in the 2026 cohort; next cycle date unconfirmed), Lipman Center at Columbia ($30,000-$50,000; applications Feb 15 - Mar 29, 2027), Fund for Investigative Journalism (up to $10,000; next deadline Jan 29, 2027). An application needs at least one published story and ideally a partner newsroom.
