"""Parse one DOC-302 weekly population PDF into a report dict.

Works across every form revision since 1999 by reading content, not positions:
lines are rebuilt from PyMuPDF word boxes, and a data row is a label followed by
trailing numbers. Throws unless every check below holds (all hold for every report
DOC has published since 1999):
- a report date can be read, and it falls on a Thursday or Friday
- the ADULT INSTITUTIONS headline row has 4 columns and population == DAI + DCC
- the separately printed "TOTAL ... (DAI)" line equals the headline's DAI column
"""
import re
from datetime import date

import pymupdf

LINE_TOLERANCE = 3.0  # points; words whose vertical midpoints are this close share a line
NUMBER = re.compile(r'^\d{1,3}(,\d{3})*$')
HEADLINE_LABELS = {'ADULT INSTITUTIONS', 'DIVISION OF ADULT INSTITUTIONS'}
DATE_LINE = re.compile(r'(?:Under Control|in Our Care) on\b(.*)', re.IGNORECASE)
# First date after "on". Month names are matched on their first three letters because
# older headers were hand-typed ("Sept 17", "Febrary 20", "August30").
NAMED_DATE = re.compile(r'([A-Za-z]{3})[A-Za-z]*\.?\s*(\d{1,2}),?\s*(\d{4})')
NUMERIC_DATE = re.compile(r'(\d{1,2})[/_](\d{1,2})[/_](\d{4})')
REPORT_WEEKDAYS = {3, 4}  # Thursday, Friday: 1,443 Fridays and 3 Thursdays, 1999-2026
MONTHS = {m: i for i, m in enumerate(
    ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], start=1)}


def extract_lines(pdf_bytes: bytes) -> list[str]:
    lines = []
    with pymupdf.open(stream=pdf_bytes, filetype='pdf') as doc:
        for page in doc:
            words = sorted(page.get_text('words'), key=lambda w: ((w[1] + w[3]) / 2, w[0]))
            current, current_mid = [], None
            for w in words:
                mid = (w[1] + w[3]) / 2
                if current and mid - current_mid > LINE_TOLERANCE:
                    lines.append(' '.join(x[4] for x in sorted(current, key=lambda x: x[0])))
                    current = []
                if not current:
                    current_mid = mid
                current.append(w)
            if current:
                lines.append(' '.join(x[4] for x in sorted(current, key=lambda x: x[0])))
    return lines


def split_row(line: str) -> tuple[str, list[int]] | None:
    """'Dodge 1,165 1,771 1,758 13' -> ('Dodge', [1165, 1771, 1758, 13])."""
    tokens = line.split()
    values = []
    while tokens and NUMBER.match(tokens[-1]):
        values.insert(0, int(tokens.pop().replace(',', '')))
    if not tokens or not values:
        return None
    return ' '.join(tokens), values


def parse_date(lines: list[str], source: str) -> str:
    """Report date = the first date after 'Under Control on' / 'in Our Care on'."""
    for i, line in enumerate(lines):
        m = DATE_LINE.search(line)
        if not m:
            continue
        # A few headers wrap the date onto the next line ("on" / "Friday March 23, 2001").
        text = m.group(1) if m.group(1).strip() else ' '.join(lines[i + 1:i + 2])
        candidates = []
        if (n := NAMED_DATE.search(text)) and n.group(1).lower() in MONTHS:
            candidates.append((n.start(), date(int(n[3]), MONTHS[n.group(1).lower()], int(n[2]))))
        if n := NUMERIC_DATE.search(text):
            candidates.append((n.start(), date(int(n[3]), int(n[1]), int(n[2]))))
        if not candidates:
            raise ValueError(f'{source}: unreadable report date: {text!r}')
        report_date = min(candidates)[1]
        if report_date.weekday() not in REPORT_WEEKDAYS:
            raise ValueError(f'{source}: report date {report_date} is a {report_date:%A}; '
                             'DOC reports are dated Thursday or Friday. Check the header for a typo.')
        return report_date.isoformat()
    raise ValueError(f'{source}: no "Under Control on" / "in Our Care on" line found')


def parse_report(pdf_bytes: bytes, source: str) -> dict:
    lines = extract_lines(pdf_bytes)
    revision = next((m.group(1) for l in lines if (m := re.search(r'\bRev\.?\s*\((.+?)\)', l))), None)

    rows, headline, capacity_type = [], None, None
    for line in lines:
        if capacity_type is None and re.match(r'^(Design|Operating)\b', line):
            capacity_type = line.split()[0].lower()
        row = split_row(line)
        if row is None:
            continue
        name, values = row
        rows.append({'name': name, 'values': values})
        if headline is None and name in HEADLINE_LABELS:
            headline = values

    if capacity_type is None:
        raise ValueError(f'{source}: no capacity column header (Design/Operating)')
    if headline is None or len(headline) != 4:
        raise ValueError(f'{source}: adult institutions row missing or not 4 columns: {headline}')
    capacity, population, dai, dcc = headline
    if population != dai + dcc:
        raise ValueError(f'{source}: headline population {population} != DAI {dai} + DCC {dcc}')
    dai_total = [r['values'][0] for r in rows
                 if r['name'].startswith('TOTAL') and r['name'].endswith('(DAI)') and len(r['values']) == 1]
    if dai_total != [dai]:
        raise ValueError(f'{source}: "TOTAL ... (DAI)" line {dai_total} does not match headline DAI {dai}')

    return {
        'report_date': parse_date(lines, source),
        'revision': revision,
        'source': source,
        'capacity_type': capacity_type,
        'adult_institutions': {'capacity': capacity, 'population': population, 'dai': dai, 'dcc': dcc},
        'rows': rows,
    }
