# wpr-custody-ledger

Working name: The Custody Ledger. A WPR tracker of Wisconsin's state prison population against capacity, built on the Department of Corrections' weekly DOC-302 population reports. Scaffolded Oct 1, 2026.

## Source

- Weekly reports: PDFs linked from https://doc.wi.gov/Pages/DataResearch/DataAndReports.aspx. 2026 file names are `fri_MM_DD_YYYY.pdf`; earlier years used other patterns, so links are always read from the page, never built.
- Archive: yearly zips 1999-2025 at `https://doc.wi.gov/DataResearch/ArchivedPopulationReports/{year}.zip`. Folder layout inside the zips varies by year.
- The PDFs are Excel exports with a real text layer. No OCR needed anywhere in the archive.

## Pipeline

| File | Job |
|---|---|
| `scraper/parse.py` | PDF bytes -> report dict (date, revision, capacity type, headline, all rows) |
| `scraper/update.py` | Weekly: read index page, parse and store any report not yet stored |
| `scraper/backfill.py` | One-time: load the 1999-2025 archive zips (already run; data is committed) |
| `scraper/corrections.py` | Hand-verified skips and date fixes, each with a reason; used by backfill and update |
| `scraper/snapshot.py` | Facility breakdown of the latest report, reconciled to the headline |
| `scraper/build.py` | `data/reports/*.json` -> `data/statewide.json` + `data/latest.json` |
| `tests/` | Regression tests on one real PDF per format era, plus failure-mode tests |
| `.github/workflows/update.yml` | Saturdays: test, update, build, commit |

`data/reports/YYYY-MM-DD.json` is the stored truth (one per report, ~1,450 files). `statewide.json` and `latest.json` are derived and rebuilt every run.

## Checks (every one holds for all 1,446 reports, 1999-2026)

The pipeline throws rather than publish when any of these fail:

- **Per report** (`parse.py`): date readable and a Thursday or Friday; headline has 4 columns; population == DAI + DCC; the separately printed "TOTAL ... (DAI)" line equals the headline DAI.
- **Latest facilities** (`snapshot.py`): leaves sum to the headline in population, DAI, DCC and capacity. Contract-bed capacity comes from the CONTRACT BEDS subtotals; Dodge Infirmary holds patients but has no capacity.
- **Whole series** (`build.py`): week-to-week population change under 3% (largest real move: 1.15%); exactly one operating -> design capacity switch.
- **Freshness** (`update.py`): throws if the newest stored report is more than 21 days old, so a silent DOC page change can't freeze the tracker.
- **Storage** (`store.py`): two sources claiming the same date throws, with a pointer to the fix in `corrections.py`.

A full rebuild from scratch (backfill + update + build) reproduces the committed data byte for byte.

## When the weekly job fails

GitHub emails on a failed scheduled run. Read the error first; each one names the file and the broken check.
- **Duplicate date** (DOC re-issued a week): add the superseded URL to `SKIP` in `corrections.py`, delete that date's file in `data/reports/`, rerun `update.py`.
- **Snapshot sums don't match** (DOC changed the form): rows in the latest PDF no longer match `SUBTOTALS` / `START` / `END` in `snapshot.py`. Update them, add the new PDF as a test fixture.
- **Weekly change over 3%**: open the source PDF and verify before touching `MAX_WEEKLY_CHANGE`.

## Decisions

- **Headline metric** is the Total Population column of the ADULT INSTITUTIONS row (DAI + DCC holds). This is the figure press uses: it reproduces the Aug 9, 2019 peak of 23,826 and the Aug 28, 2026 record of 23,854 exactly. Not the "TOTAL PIOC (DAI)" line at the top.
- **Parse by content, not by form revision.** The archive has 150+ form revisions, so revision is stored as metadata only. A data row is a label followed by trailing numbers.
- **Report date comes from the PDF header** (first date after "Under Control on" / "in Our Care on"). Older headers were hand-typed with typos, so month names match on their first three letters. File names are not used; they have their own typos.
- **Archive errors are fixed explicitly** in `corrections.py`, never guessed. Backfill throws if a correction no longer matches a file or if two files share a date.
- **Capacity changed meaning on 2008-03-14:** "operating capacity" before, "design capacity" after. `statewide.json` carries `capacity_type`; never draw one continuous capacity line across that date.
- **Facility snapshot is current-form only** (Rev. 03_04_2026). Leaves must sum to the headline population, DAI and DCC, so a DOC form change fails the build loudly. Update `SUBTOTALS` / `START` / `END` in `snapshot.py` when that happens.

## Known gaps

DOC's archive has no report for 2003-08-22 or 2021-08-13. The 2013-01-04 PDF is skipped because its population columns are missing. The series has a 14-day step at each.

## Findings as of the Sep 25, 2026 report

- Five straight record weeks: 23,854 (Aug 28) -> 23,870 -> 23,890 -> 23,897 -> 23,905 (Sep 25), each the highest in the archive back to 1999.
- Most crowded vs design capacity: Milwaukee Women's Center 255% (107/42), Drug Abuse Center 236%, Robert E. Ellsworth Center 220%, McNaughton 215%, Oakhill 211%.
- Local: Lincoln County Jail (Merrill) holds 74 state prisoners on contract, up from 54 in January 2026.

## Commands (Windows, PowerShell 5.1, Python 3.10+)

```
python -m pip install -r requirements.txt; python -m pytest -q; python scraper/update.py; python scraper/build.py
```

The workflow uses `actions/checkout@v6` and `actions/setup-python@v6` (Node 24). GitHub removed Node 20 from runners on Sep 16, 2026, so older majors fail.

## Next

1. Front end (React/Vite -> GitHub Pages -> WordPress iframe): statewide population vs capacity line since 1999, facility crowding bars, county-jail contract holds. WPR design system: teal `#3A867C`, cream `#F6F2E9`, Fraunces display, Public Sans body, JetBrains Mono for data.
2. Per-facility history: needs facility-name normalization across form revisions.
3. Marathon County layer: DOC monthly Persons in Our Care data files (admissions by conviction county, admission type incl. revocations).
4. Jail layer: Office of Detention Facilities annual report (county jail admissions, ADP, suicides).
