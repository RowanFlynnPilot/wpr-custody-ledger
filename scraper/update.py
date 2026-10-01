"""Weekly job: find report links on DOC's Data and Reports page and store any new ones."""
import re
from datetime import date

from corrections import SKIP, apply_date_override
from http_client import get
from parse import parse_report
from store import read_reports, write_report

INDEX_URL = 'https://doc.wi.gov/Pages/DataResearch/DataAndReports.aspx'
BASE_URL = 'https://doc.wi.gov'
REPORT_LINK = re.compile(r'href="(?:https://doc\.wi\.gov)?(/DataResearch/WeeklyPopulationReports/[^"]+\.pdf)"',
                         re.IGNORECASE)
MAX_REPORT_AGE_DAYS = 21  # DOC has skipped at most one week since 1999; three means something broke
RECHECK_NEWEST = 8  # stored reports downloaded again each run, so a PDF DOC corrects in place can't go unnoticed


def main() -> None:
    links = sorted({BASE_URL + path for path in REPORT_LINK.findall(get(INDEX_URL).text)})
    if not links:
        raise RuntimeError(f'No weekly report links found on {INDEX_URL}; the page layout may have changed')
    stored = {r['source']: r['report_date'] for r in read_reports()}
    new_urls = [url for url in links if url not in stored and url not in SKIP]
    recheck = sorted((url for url in links if url in stored), key=stored.get)[-RECHECK_NEWEST:]
    for url in recheck + new_urls:
        report = apply_date_override(parse_report(get(url).content, url))
        write_report(report)  # throws if a rechecked file no longer matches what is stored
        if url in new_urls:
            print(f"stored {report['report_date']}: {report['adult_institutions']['population']:,} "
                  'in adult institutions')
    print(f'{len(links)} links on index, {len(new_urls)} new, {len(recheck)} rechecked')

    newest = max(r['report_date'] for r in read_reports())
    age = (date.today() - date.fromisoformat(newest)).days
    if age > MAX_REPORT_AGE_DAYS:
        raise RuntimeError(f'Newest stored report is {newest} ({age} days old). Check whether DOC moved '
                           f'or stopped posting weekly reports on {INDEX_URL}')


if __name__ == '__main__':
    main()
