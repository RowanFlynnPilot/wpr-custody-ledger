"""Read and write parsed reports (one JSON file per report date in data/reports/) and the built outputs."""
import csv
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / 'data'
REPORTS_DIR = DATA_DIR / 'reports'


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


def read_reports() -> list[dict]:
    return [json.loads(p.read_text(encoding='utf-8')) for p in sorted(REPORTS_DIR.glob('*.json'))]


def write_output(name: str, payload) -> None:
    # newline='\n' so a build on Windows writes the same bytes as the Linux runner
    (DATA_DIR / name).write_text(json.dumps(payload, indent=1), encoding='utf-8', newline='\n')


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
