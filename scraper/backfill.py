"""One-time load of DOC's yearly archive zips (1999-2025) into data/reports/."""
import io
import zipfile
from collections import defaultdict

from corrections import ARCHIVE, DATE_OVERRIDES, SKIP, apply_date_override
from http_client import get
from parse import parse_report
from store import write_report

YEARS = range(1999, 2026)  # 2026 reports are still listed individually; update.py covers them


def main() -> None:
    reports, seen = [], set()
    for year in YEARS:
        url = f'{ARCHIVE}{year}.zip'
        with zipfile.ZipFile(io.BytesIO(get(url).content)) as archive:
            for member in sorted(archive.namelist()):
                if not member.lower().endswith('.pdf'):
                    continue
                source = f'{url}#{member}'
                seen.add(source)
                if source in SKIP:
                    continue
                reports.append(apply_date_override(parse_report(archive.read(member), source)))
        print(f'{year}: done')

    stale = {key for key in SKIP.keys() | DATE_OVERRIDES.keys() if key.startswith(ARCHIVE)} - seen
    if stale:
        raise RuntimeError(f'corrections.py references files not in the archives: {sorted(stale)}')

    by_date = defaultdict(list)
    for report in reports:
        by_date[report['report_date']].append(report['source'])
    duplicates = {d: s for d, s in by_date.items() if len(s) > 1}
    if duplicates:
        raise RuntimeError(f'Multiple archive files share a report date; add them to corrections.py: {duplicates}')

    for report in reports:
        write_report(report)
    print(f'stored {len(reports)} reports')


if __name__ == '__main__':
    main()
