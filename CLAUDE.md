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
| `scraper/snapshot.py` | Facility breakdown of the latest report, reconciled to the headline |
| `scraper/build.py` | `data/reports/*.json` -> `data/statewide.json` + `data/latest.json` |
| `tests/` | Regression tests on one real PDF per format era, plus failure-mode tests |
| `.github/workflows/update.yml` | Mon, Wed, Sat: test, update, build, commit. Saturday is the usual pickup; the others catch late postings and corrections |

`data/reports/YYYY-MM-DD.json` is the stored truth (one per report, ~1,450 files). `statewide.json` and `latest.json` are derived and rebuilt every run.

## Checks (every one holds for all 1,446 reports, 1999-2026)

The pipeline throws rather than publish when any of these fail:

- **Per report** (`parse.py`): date readable and a Thursday or Friday; headline has 4 columns; population == DAI + DCC; the separately printed "TOTAL ... (DAI)" line equals the headline DAI.
- **Latest facilities** (`snapshot.py`): leaves sum to the headline in population, DAI, DCC and capacity. Contract-bed capacity comes from the CONTRACT BEDS subtotals; Dodge Infirmary holds patients but has no capacity.
- **Whole series** (`build.py`): week-to-week population change under 3% (largest real move: 1.15%); exactly one operating -> design capacity switch.
- **Freshness** (`update.py`): throws if the newest stored report is more than 21 days old, so a silent DOC page change can't freeze the tracker.
- **Storage** (`store.py`): compares by the PDF's SHA-256. Same address with different bytes throws (DOC changed a file in place). Two addresses with different bytes claiming one date throws, with a pointer to `corrections.py`. Same bytes at a new address is the same report, and the new address is kept.
- **Unchanged source** (`update.py`): the 8 newest listed reports are downloaded again every run and pass through the storage check.

A full rebuild from scratch (backfill + update + build) reproduces the committed data byte for byte.

## When the weekly job fails

GitHub emails on a failed scheduled run. Read the error first; each one names the file and the broken check.
- **Duplicate date** (DOC re-issued a week): add the superseded URL to `SKIP` in `corrections.py`, delete that date's file in `data/reports/`, rerun `update.py`.
- **Snapshot sums don't match** (DOC changed the form): rows in the latest PDF no longer match `SUBTOTALS` / `START` / `END` in `snapshot.py`. Update them, add the new PDF as a test fixture.
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
- **Never publish the DAI/DCC columns of DOC's subtotal rows.** Use the population column or sum the leaves (see Source errors).
- **Facility snapshot is current-form only** (Rev. 03_04_2026). Leaves must sum to the headline population, DAI and DCC, so a DOC form change fails the build loudly. Update `SUBTOTALS` / `START` / `END` in `snapshot.py` when that happens.

## Known gaps

DOC's archive has no report for 2003-08-22 or 2021-08-13. The 2013-01-04 PDF is skipped because its population columns are missing. The series has a 14-day step at each.

## Source errors and open questions

- **Female subtotal, DAI column.** On every report since the form split contract beds by sex (2026-01-30 on), "SUB-TOTAL FEMALES (ALL LOCATIONS)" prints a DAI figure short by exactly that week's "CONTRACT BEDS (FEMALE)" DAI. Sep 25, 2026: population 1,750, DAI 1,728, DCC 15. The population column and the headline are right. DOC has not been told.
- **2004-08-05.** The header reads "August 5, 2004" (a Thursday); the file is `2004.08.06.pdf`. Nothing in the PDF settles which is the typo, so it is stored as the header reads.
- **1999-11-25 and 1999-11-26** are separate files with different counts, one day apart (Thanksgiving week). Both are stored.

## Findings as of the Sep 25, 2026 report

- Five straight record weeks: 23,854 (Aug 28) -> 23,870 -> 23,890 -> 23,897 -> 23,905 (Sep 25), each the highest in the archive back to 1999.
- Most crowded vs design capacity: Milwaukee Women's Center 255% (107/42), Drug Abuse Center 236%, Robert E. Ellsworth Center 220%, McNaughton 215%, Oakhill 211%.
- Local: Lincoln County Jail (Merrill) holds 74 state prisoners on contract, up from 16 when it first appeared (May 23, 2025) and 54 in January 2026. Oneida County Jail holds 120, Vilas 27. Lincoln Hills School holds 63 youth; its listed capacity is 519.
- Crowding rate: 133.8% of design capacity (6,045 over); 34 of 37 facilities with a design capacity are over it. The design-era record rate is 138.0% (May 30, 2008), so the head count is a record but the rate is not.
- Women: 1,750 on a design capacity of 974 (180%), the highest women's count in the archive. Men: 131%.
- Out-of-state era: contract facilities peaked at 5,729 people on Aug 11, 2000 (Whiteville, Tenn.; Appleton, Minn.; Texas county jails; federal prisons).
- Since the pandemic low of 19,381 (May 14, 2021): +4,524. Probation and parole: 64,051, with 840 held in custody.

## Commands (Windows, PowerShell 5.1, Python 3.10+)

```
python -m pip install -r requirements.txt; python -m pytest -q; python scraper/update.py; python scraper/build.py
```

The workflow uses `actions/checkout@v6` and `actions/setup-python@v6` (Node 24). GitHub removed Node 20 from runners on Sep 16, 2026, so older majors fail.

## Next

Phase 0 (hash check, three runs a week, README, license) is done. Still open from it: tell DOC about the female subtotal error.

1. **Data model.** A hand-built facility registry (`data/facilities.json`: DOC label, display name, type, security level, sex, city, county, coordinates). Section-aware facility history across the archive: most institutions keep one label for all 1,446 reports, so the obstacle is labels that repeat within a report ("Racine", "St. Croix", "Milwaukee"), not naming. Gate it on leaves summing to the headline, as `snapshot.py` does now (it reconciles back to 2026-01-30 only). Series for women/men, contract beds, juvenile facilities, supervision. CSV exports. A weekly changes file: records, streaks, biggest movers.
2. **Front end** (React/Vite -> GitHub Pages -> WordPress iframe). Lead with what Wisconsin Watch's chart lacks: the 27-year line with the 2000 out-of-state peak and the 2008 capacity break, a close-to-home panel (Lincoln, Oneida, Vilas jails; Lincoln Hills; McNaughton), the women's system, jail contracts, facility pages. Ledger-family design tokens, as in `wpr-watch-ledger`: teal `#3A867C`, cream `#F6F2E9`, Fraunces display, Public Sans body, JetBrains Mono for data. Before building routes, settle where indexable text lives: an iframe from github.io earns the news site no search credit.
3. **Local layer.** Marathon County residents in prison and admissions by type, from DOC's monthly Persons in Our Care data files (April 2020 on; columns not yet inspected). Staffing vacancies by facility from DOC's staffing dashboard. A records request for the Lincoln County jail contract.
4. **Jail layer.** Office of Detention Facilities annual report (county jail admissions, ADP, suicides).
5. **Distribution.** Auto-drafted weekly brief for the newsletter, record and local-jail alerts, a county-localized embed other Wisconsin newsrooms can run with credit.

Grant leads checked Oct 1, 2026: Data-Driven Reporting Project (Medill; $25,000-$40,000 in the 2026 cohort; next cycle date unconfirmed), Lipman Center at Columbia ($30,000-$50,000; applications Feb 15 - Mar 29, 2027), Fund for Investigative Journalism (up to $10,000; next deadline Jan 29, 2027). An application needs at least one published story and ideally a partner newsroom.
