"""Read and write parsed reports (one JSON file per report date in data/reports/) and the built outputs."""
import csv
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / 'data'
REPORTS_DIR = DATA_DIR / 'reports'
COUNTY_MONTHS_DIR = DATA_DIR / 'county_months'


def write_report(report: dict) -> None:
    path = REPORTS_DIR / f"{report['report_date']}.json"
    if path.exists():
        existing = json.loads(path.read_text(encoding='utf-8'))
        if existing['sha256'] != report['sha256']:
            if existing['source'] == report['source']:
                raise ValueError(f"{report['report_date']}: DOC changed {report['source']} after it was stored. "
                                 f"Compare the new PDF with data/reports/{path.name}; to accept it, delete that "
                                 "file and rerun.")
            raise ValueError(f"{report['report_date']} is already stored from {existing['source']}, and "
                             f"{report['source']} claims the same date. If DOC re-issued the week, see "
                             "corrections.py for the fix.")
        # Same bytes from a new address (DOC moves each year's weekly files into a zip): the newest address wins.
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, separators=(',', ':')), encoding='utf-8')


def write_county_month(snapshot: dict) -> None:
    """Store one month's county counts. Counts only: the person-level file they come from is never stored."""
    path = COUNTY_MONTHS_DIR / f"{snapshot['as_of']}.json"
    if path.exists():
        existing = json.loads(path.read_text(encoding='utf-8'))
        if existing['source'] != snapshot['source']:
            raise ValueError(f"{snapshot['as_of']} is already stored from {existing['source']}, and "
                             f"{snapshot['source']} carries the same date. If DOC posted one snapshot under two "
                             "months, add the repeat to MONTHLY_SKIP in corrections.py.")
        if existing['sha256'] != snapshot['sha256']:
            raise ValueError(f"{snapshot['as_of']}: DOC changed {snapshot['source']} after it was stored. To accept "
                             f"the new file, delete data/county_months/{path.name} and rerun.")
    COUNTY_MONTHS_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(snapshot, indent=1), encoding='utf-8', newline='\n')


def read_county_months() -> list[dict]:
    return [json.loads(p.read_text(encoding='utf-8')) for p in sorted(COUNTY_MONTHS_DIR.glob('*.json'))]


def read_reports() -> list[dict]:
    return [json.loads(p.read_text(encoding='utf-8')) for p in sorted(REPORTS_DIR.glob('*.json'))]


def write_output(name: str, payload) -> None:
    # newline='\n' so a build on Windows writes the same bytes as the Linux runner
    (DATA_DIR / name).write_text(json.dumps(payload, indent=1), encoding='utf-8', newline='\n')


def write_text(name: str, text: str) -> None:
    (DATA_DIR / name).write_text(text, encoding='utf-8', newline='\n')


def write_rows(name: str, rows: list, key: str | None = None, head: dict | None = None) -> None:
    """A JSON array with one element per line, so a weekly update shows up as a short diff.

    With `key`, the array is wrapped in an object under that key, after the items of `head`.
    """
    text = '[\n' + ',\n'.join(json.dumps(row, separators=(',', ':')) for row in rows) + '\n]'
    if key:
        fields = [f'{json.dumps(k)}:{json.dumps(v, separators=(",", ":"))}' for k, v in (head or {}).items()]
        text = '{\n' + ',\n'.join(fields + [f'{json.dumps(key)}:{text}']) + '\n}'
    (DATA_DIR / name).write_text(text + '\n', encoding='utf-8', newline='\n')


def write_csv(name: str, header: list[str], rows: list[list]) -> None:
    (DATA_DIR / 'csv').mkdir(exist_ok=True)
    with (DATA_DIR / 'csv' / name).open('w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, lineterminator='\n')
        writer.writerow(header)
        writer.writerows(rows)
