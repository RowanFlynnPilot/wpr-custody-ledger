"""County-level counts from DOC's monthly Persons in Our Care data file (PIOCDF).

The file has one row per person in an adult prison on the last day of a month, with names and
DOC numbers. Only counts leave this script: people by county of conviction, and how many of
them are in on a violation of supervision with no new sentence. A raw file is never written
into the repository, and any count under MIN_CELL is withheld, along with any split whose
other half would be under it.

DOC publishes no data dictionary. "No new sentence" here means the person's latest admission
type (UPDT_ADM_TYPE where DOC has filled it in, otherwise ORIG_ADM_TYPE) says so in words, as
in "Returned from Extended Supervision (ES) - No New Sentence / ES Violator".

Run by hand. Downloading means accepting DOC's disclaimer that it does not certify the file:
    python scraper/counties.py 2026 8                  the file DOC labels August 2026
    python scraper/counties.py 2026 8 --file PATH      a copy already downloaded
"""
import csv
import hashlib
import io
import sys
from collections import Counter
from datetime import date
from pathlib import Path

from http_client import get
from registry import WISCONSIN_COUNTIES
from store import read_reports, write_csv, write_output

URL = 'https://doc.wi.gov/DataResearch/PIOCDF/PIOCDF_{year}_{month:02d}.csv'
MIN_CELL = 10  # the newsroom's rule: no published count describes fewer than 10 people
COLUMNS = {'RPT_DT', 'DOC_NUM', 'CONVICTION_COUNTY', 'ORIG_ADM_TYPE', 'UPDT_ADM_TYPE'}
NO_NEW_SENTENCE = 'No New Sentence'
MAX_GAP = 0.01  # the file and the weekly report nearest its date must agree on the head count this closely


def aggregate(csv_bytes: bytes, source: str) -> dict:
    rows = list(csv.DictReader(io.StringIO(csv_bytes.decode('utf-8-sig')), delimiter=';'))
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


def main() -> None:
    year, month = int(sys.argv[1]), int(sys.argv[2])
    url = URL.format(year=year, month=month)
    csv_bytes = Path(sys.argv[4]).read_bytes() if sys.argv[3:4] == ['--file'] else get(url).content
    result = aggregate(csv_bytes, url)
    check_against_weekly_report(result, read_reports())
    write_output('counties.json', result)
    write_csv('counties.csv', ['as_of', 'county', 'people', 'no_new_sentence'],
              [[result['as_of'], c['county'], c['people'], c['no_new_sentence']] for c in result['counties']])
    withheld = sum(1 for c in result['counties'] if c['people'] is None)
    print(f"{result['as_of']}: {result['people']:,} people, {result['no_new_sentence']:,} with no new sentence; "
          f"{withheld} county total(s) withheld under {MIN_CELL}")


if __name__ == '__main__':
    main()
