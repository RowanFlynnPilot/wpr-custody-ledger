"""Build the front-end JSON from data/reports/: statewide.json (every week) and latest.json.

Checks the whole series before writing anything:
- week-to-week population change stays under MAX_WEEKLY_CHANGE
- capacity switches from 'operating' to 'design' exactly once
"""
from snapshot import facilities
from store import read_reports, write_output

# Largest real weekly move, 1999-2026, was 1.15% (Mar 2002); COVID drops peaked near 1.05%.
# A bigger jump is far more likely a parse error than news. Verify against the PDF before raising this.
MAX_WEEKLY_CHANGE = 0.03


def check_series(statewide: list[dict]) -> None:
    for prev, week in zip(statewide, statewide[1:]):
        change = abs(week['population'] - prev['population']) / prev['population']
        if change > MAX_WEEKLY_CHANGE:
            raise ValueError(f"Population moved {change:.1%} from {prev['date']} ({prev['population']:,}) "
                             f"to {week['date']} ({week['population']:,}); check the source PDF")
    types = [w['capacity_type'] for w in statewide]
    switches = [w['date'] for prev, w in zip(statewide, statewide[1:]) if prev['capacity_type'] != w['capacity_type']]
    if types[0] != 'operating' or types[-1] != 'design' or len(switches) != 1:
        raise ValueError(f'Expected one operating -> design capacity switch; found switches at {switches}')


def main() -> None:
    reports = read_reports()
    if not reports:
        raise RuntimeError('No reports in data/reports; run backfill.py and update.py first')

    statewide = [{
        'date': r['report_date'],
        'capacity': r['adult_institutions']['capacity'],
        'capacity_type': r['capacity_type'],  # 'operating' before 2008-03-14, 'design' after; not comparable
        'population': r['adult_institutions']['population'],
    } for r in reports]
    check_series(statewide)

    latest = reports[-1]
    latest_facilities = facilities(latest)
    write_output('statewide.json', statewide)
    write_output('latest.json', {
        'report_date': latest['report_date'],
        'source': latest['source'],
        'capacity': latest['adult_institutions']['capacity'],
        'population': latest['adult_institutions']['population'],
        'facilities': latest_facilities,
    })

    peak = max(statewide, key=lambda w: w['population'])
    print(f"{len(statewide)} weeks; latest {latest['report_date']}: {statewide[-1]['population']:,}; "
          f"peak {peak['date']}: {peak['population']:,}")


if __name__ == '__main__':
    main()
