"""County-level counts from DOC's monthly Persons in Our Care data file (PIOCDF).

Each file has one row per person in an adult prison on the last day of a month, with names
and DOC numbers. Only counts leave this script: people by county of conviction, and how many
of them are in on a violation of supervision with no new sentence. A raw file is never
written into the repository, and any count under MIN_CELL is withheld, along with any split
whose other half would be under it. One snapshot is stored per month in data/county_months/;
build.py turns those into data/counties.json.

DOC publishes no data dictionary. "No new sentence" here means the person's latest admission
type (UPDT_ADM_TYPE where DOC has filled it in, otherwise ORIG_ADM_TYPE) says so in words, as
in "Returned from Extended Supervision (ES) - No New Sentence / ES Violator".

Downloading means accepting DOC's disclaimer that it does not certify the file:
    python scraper/counties.py --new             months not yet stored (what counties.yml runs)
    python scraper/counties.py 2026 7            the file DOC labels July 2026
    python scraper/counties.py --all             every month from April 2020 on
Add  --dir FOLDER  to read PIOCDF_YYYY_MM.csv files already downloaded there instead.

--new also throws if DOC has replaced a file listed in corrections.MONTHLY_SKIP, or if no
month has been accounted for in MAX_SNAPSHOT_AGE_DAYS, so the series can't quietly stop.
"""
import csv
import hashlib
import io
import sys
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

import requests

from corrections import MONTHLY_SKIP
from http_client import get, head
from registry import WISCONSIN_COUNTIES
from store import read_county_months, read_reports, write_county_month

FILE = 'PIOCDF_{year}_{month:02d}.csv'
URL = 'https://doc.wi.gov/DataResearch/PIOCDF/'
FIRST = (2020, 4)
MIN_CELL = 10  # the newsroom's rule: no published count describes fewer than 10 people
COLUMNS = {'RPT_DT', 'DOC_NUM', 'CONVICTION_COUNTY', 'ORIG_ADM_TYPE', 'UPDT_ADM_TYPE'}
NO_NEW_SENTENCE = 'No New Sentence'
MAX_GAP = 0.01  # the file and the weekly report nearest its date must agree on the head count this closely
# DOC posts a month about 15 days after it ends, so the newest month on hand is normally 15 to 46 days old.
MAX_SNAPSHOT_AGE_DAYS = 80


def read_rows(csv_bytes: bytes) -> list[dict]:
    text = csv_bytes.decode('utf-8-sig')
    rows = list(csv.DictReader(io.StringIO(text), delimiter=';'))
    if rows and len(rows[0]) == 1:
        # December 2024 was exported with every line wrapped as one quoted field. Unwrap, then read as usual.
        text = '\n'.join(line[0] for line in csv.reader(io.StringIO(text)) if line)
        rows = list(csv.DictReader(io.StringIO(text), delimiter=';'))
    return rows


def aggregate(csv_bytes: bytes, source: str) -> dict:
    rows = read_rows(csv_bytes)
    if not rows or not COLUMNS <= set(rows[0]):
        raise ValueError(f'{source}: expected columns {sorted(COLUMNS)}; DOC may have changed the file layout')
    dates = {row['RPT_DT'] for row in rows}
    if len(dates) != 1:
        raise ValueError(f'{source}: expected one report date, found {sorted(dates)}')
    if len({row['DOC_NUM'] for row in rows}) != len(rows):
        raise ValueError(f'{source}: DOC numbers repeat, so rows are not one per person')
    unknown = {row['CONVICTION_COUNTY'] for row in rows} - WISCONSIN_COUNTIES - {''}
    if unknown:
        raise ValueError(f'{source}: conviction counties that are not Wisconsin counties: {sorted(unknown)}')

    people, no_new = Counter(), Counter()
    for row in rows:
        county = row['CONVICTION_COUNTY']
        people[county] += 1
        if NO_NEW_SENTENCE in (row['UPDT_ADM_TYPE'] or row['ORIG_ADM_TYPE']):
            no_new[county] += 1

    def published(county: str) -> dict:
        total, part = people[county], no_new[county]
        if total < MIN_CELL:
            return {'county': county, 'people': None, 'no_new_sentence': None}
        # Publishing one half of a split gives away the other, so both must clear the floor.
        split_ok = part >= MIN_CELL and total - part >= MIN_CELL
        return {'county': county, 'people': total, 'no_new_sentence': part if split_ok else None}

    counties = [published(county) for county in sorted(WISCONSIN_COUNTIES)]
    year, month, day = (int(part) for part in next(iter(dates))[:10].split('/'))
    return {
        'as_of': date(year, month, day).isoformat(),
        'source': source,
        'sha256': hashlib.sha256(csv_bytes).hexdigest(),
        'min_cell': MIN_CELL,
        'people': len(rows),
        'no_new_sentence': sum(no_new.values()),
        # No county recorded, or a county total withheld: one figure, so a withheld total can't be found by subtraction.
        'people_not_shown_by_county': len(rows) - sum(c['people'] or 0 for c in counties),
        'counties': counties,
    }


def check_against_weekly_report(result: dict, reports: list[dict]) -> None:
    """The file should count about as many people as the DOC-302 nearest its date says DAI holds."""
    as_of = date.fromisoformat(result['as_of'])
    nearest = min(reports, key=lambda r: abs(date.fromisoformat(r['report_date']) - as_of))
    gap = abs(date.fromisoformat(nearest['report_date']) - as_of).days
    dai = nearest['adult_institutions']['dai']
    if gap > 7 or abs(result['people'] - dai) / dai > MAX_GAP:
        raise ValueError(f"{result['source']}: {result['people']:,} people as of {result['as_of']}, but the weekly "
                         f"report of {nearest['report_date']} counts {dai:,} in DAI custody")


def month_end(year: int, month: int) -> date:
    return date(year + month // 12, month % 12 + 1, 1) - timedelta(days=1)


def months(first: tuple[int, int], today: date) -> list[tuple[int, int]]:
    """Every (year, month) from `first` through the month `today` falls in."""
    return [(y, m) for y in range(first[0], today.year + 1) for m in range(1, 13)
            if first <= (y, m) <= (today.year, today.month)]


def pending(newest_stored: date, today: date) -> list[tuple[int, int]]:
    """Months after the newest stored snapshot, through the current one."""
    return [ym for ym in months(FIRST, today) if month_end(*ym) > newest_stored]


def skipped_month_ends() -> list[date]:
    return [month_end(int(name[7:11]), int(name[12:14])) for name in MONTHLY_SKIP]


def check_skipped_files_unchanged() -> None:
    for name, skip in MONTHLY_SKIP.items():
        modified = head(URL + name).headers.get('Last-Modified')
        if modified != skip['last_modified']:
            raise RuntimeError(f"DOC replaced {name} (Last-Modified is now {modified}). It was skipped because it "
                               f"{skip['reason']}. Remove it from MONTHLY_SKIP in corrections.py and run "
                               f"`python scraper/counties.py {int(name[7:11])} {int(name[12:14])}`.")


def check_fresh(stored: list[date], today: date) -> None:
    newest = max(stored + skipped_month_ends())
    if (today - newest).days > MAX_SNAPSHOT_AGE_DAYS:
        raise RuntimeError(f'The newest month accounted for is {newest}, {(today - newest).days} days ago. Check '
                           f'whether DOC moved or stopped posting its monthly data file at {URL}')


def main() -> None:
    args = sys.argv[1:]
    folder = Path(args[args.index('--dir') + 1]) if '--dir' in args else None
    today = date.today()
    stored = [date.fromisoformat(m['as_of']) for m in read_county_months()]
    if args[0] == '--new':
        check_skipped_files_unchanged()
        wanted = pending(max(stored), today)
    else:
        wanted = months(FIRST, today) if args[0] == '--all' else [(int(args[0]), int(args[1]))]
    reports = read_reports()
    for year, month in wanted:
        name = FILE.format(year=year, month=month)
        if name in MONTHLY_SKIP:
            print(f"{name}: skipped ({MONTHLY_SKIP[name]['reason']})")
            continue
        if folder:
            if not (folder / name).exists():
                print(f'{name}: not in {folder}')
                continue
            csv_bytes = (folder / name).read_bytes()
        else:
            try:
                csv_bytes = get(URL + name).content
            except requests.HTTPError as error:
                # The newest month or two may not be posted yet; a missing month anywhere else is an error.
                recent = (today.year - year) * 12 + today.month - month <= 2
                if error.response.status_code == 404 and recent:
                    print(f'{name}: not posted yet')
                    continue
                raise
        result = aggregate(csv_bytes, URL + name)
        check_against_weekly_report(result, reports)
        write_county_month(result)
        withheld = sum(1 for c in result['counties'] if c['people'] is None)
        print(f"{name}: as of {result['as_of']}, {result['people']:,} people, {result['no_new_sentence']:,} with no "
              f"new sentence; {withheld} county total(s) withheld")
    if args[0] == '--new':
        check_fresh([date.fromisoformat(m['as_of']) for m in read_county_months()], today)
    print('Now run build.py to rebuild data/counties.json')


if __name__ == '__main__':
    main()
