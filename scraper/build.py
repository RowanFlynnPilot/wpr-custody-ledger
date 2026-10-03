"""Build the published data from data/reports/.

  statewide.json    one row per report: headline, men/women, contract beds, juvenile, supervision
  facilities.json   every facility's weekly population and capacity since 1999
  latest.json       the newest report: statewide row plus every facility
  changes.json      what moved this week: records, streaks, year-over-year, biggest movers, close to home
  brief.md          the same, drafted as sentences for the newsroom (brief.py)
  counties.json     people in prison by county of conviction, monthly since April 2020
  csv/              the same series as spreadsheets

Every report is reconciled at facility level (snapshot.py) before anything is written, and
the whole series is checked:
- week-to-week population change stays under MAX_WEEKLY_CHANGE
- capacity switches from 'operating' to 'design' exactly once
- the monthly county snapshots are month-ends with no month missing
"""
from datetime import date, timedelta

from brief import brief
from corrections import MONTHLY_SKIP
from registry import facility
from series import week
from snapshot import merge
from store import read_county_months, read_reports, write_csv, write_output, write_rows, write_text

# Largest real weekly move, 1999-2026, was 1.15% (Mar 2002); COVID drops peaked near 1.05%.
# A bigger jump is far more likely a parse error than news. Verify against the PDF before raising this.
MAX_WEEKLY_CHANGE = 0.03
TOP = 5  # entries in each ranked list of changes.json
# Close to home: Marathon County, the counties that border it, and the Northwoods counties to its north.
# An editorial choice. The site's panel and the weekly brief both take it from changes.json.
HOME_COUNTIES = ['Marathon', 'Lincoln', 'Langlade', 'Shawano', 'Portage', 'Wood', 'Clark', 'Taylor',
                 'Oneida', 'Vilas', 'Forest', 'Price']


def check_series(statewide: list[dict]) -> None:
    for prev, week_ in zip(statewide, statewide[1:]):
        change = abs(week_['population'] - prev['population']) / prev['population']
        if change > MAX_WEEKLY_CHANGE:
            raise ValueError(f"Population moved {change:.1%} from {prev['date']} ({prev['population']:,}) "
                             f"to {week_['date']} ({week_['population']:,}); check the source PDF")
    types = [w['capacity_type'] for w in statewide]
    switches = [w['date'] for prev, w in zip(statewide, statewide[1:]) if prev['capacity_type'] != w['capacity_type']]
    if types[0] != 'operating' or types[-1] != 'design' or len(switches) != 1:
        raise ValueError(f'Expected one operating -> design capacity switch; found switches at {switches}')


def county_series(months: list[dict]) -> tuple[dict, list[dict]]:
    """Monthly county snapshots as one series per county; null where a count was withheld."""
    dates = [date.fromisoformat(m['as_of']) for m in months]
    for d in dates:
        if (d + timedelta(days=1)).day != 1:
            raise ValueError(f'County snapshot {d} is not the last day of a month')
    for a, b in zip(dates, dates[1:]):
        between = [(a.year + (a.month + k - 1) // 12, (a.month + k - 1) % 12 + 1)
                   for k in range(1, (b.year - a.year) * 12 + b.month - a.month)]
        unexplained = [ym for ym in between if f'PIOCDF_{ym[0]}_{ym[1]:02d}.csv' not in MONTHLY_SKIP]
        if b <= a or unexplained:
            raise ValueError(f'County snapshots skip or repeat a month between {a} and {b}. A missing month is '
                             'allowed only when its file is listed in MONTHLY_SKIP in corrections.py.')
    if len({m['min_cell'] for m in months}) != 1:
        raise ValueError('County snapshots were built with different withholding floors; rebuild them')
    head = {'min_cell': months[0]['min_cell'], 'months': [m['as_of'] for m in months],
            'people': [m['people'] for m in months], 'no_new_sentence': [m['no_new_sentence'] for m in months]}
    names = [c['county'] for c in months[0]['counties']]
    rows = [{'county': name, 'people': [m['counties'][i]['people'] for m in months],
             'no_new_sentence': [m['counties'][i]['no_new_sentence'] for m in months]}
            for i, name in enumerate(names)]
    if any([c['county'] for c in m['counties']] != names for m in months):
        raise ValueError('County snapshots do not list the same counties in the same order')
    return head, rows


def history(dates: list[str], weekly: list[list[dict]]) -> list[dict]:
    """Each facility's population and capacity for every week from its first report to its last.

    Arrays start at index `start` of `dates`; a week the facility is not on the form is null.
    """
    seen: dict[str, dict[int, dict]] = {}
    for i, entries in enumerate(weekly):
        for entry in entries:
            seen.setdefault(entry['id'], {})[i] = entry
    out = []
    for facility_id, weeks in seen.items():
        start, last = min(weeks), max(weeks)
        span = range(start, last + 1)
        item = {'id': facility_id, **facility(facility_id), 'security': weeks[last]['security'],
                'sex': weeks[last]['sex'], 'first': dates[start], 'last': dates[last], 'start': start,
                'population': [weeks[i]['population'] if i in weeks else None for i in span]}
        capacity = [weeks[i]['capacity'] if i in weeks else None for i in span]
        if any(c is not None for c in capacity):
            item['capacity'] = capacity
        out.append(item)
    return out


def percent(population: int, capacity: int) -> float:
    return round(100 * population / capacity, 1)


def year_before(statewide: list[dict]) -> int:
    """Index of the report closest to 52 weeks before the newest one."""
    target = date.fromisoformat(statewide[-1]['date']) - timedelta(weeks=52)
    return min(range(len(statewide)), key=lambda i: abs(date.fromisoformat(statewide[i]['date']) - target))


def moved(statewide: list[dict], key: str, year: int) -> dict:
    now = statewide[-1][key]
    return {'value': now, 'week_change': now - statewide[-2][key], 'year_change': now - statewide[year][key],
            'record': now == max(w[key] for w in statewide)}


def changes(statewide: list[dict], facilities: list[dict]) -> dict:
    now, year = statewide[-1], year_before(statewide)

    streak = 0
    while streak < len(statewide) - 1 and \
            statewide[-1 - streak]['population'] > max(w['population'] for w in statewide[:-1 - streak]):
        streak += 1
    before = statewide[:len(statewide) - streak] if streak else statewide[:-1]
    prior_peak = max(before, key=lambda w: w['population'])

    # Over the whole record: the 2008 rename from operating to design capacity changed the label, not the measure.
    most_crowded = max(statewide, key=lambda w: w['population'] / w['capacity'])

    current, on_report = len(statewide) - 1, []
    for f in facilities:
        if f['start'] + len(f['population']) - 1 != current:
            continue
        at = lambda i: f['population'][i - f['start']] if i >= f['start'] else None  # noqa: E731
        capacity = f['capacity'][-1] if 'capacity' in f else None
        on_report.append({'id': f['id'], 'name': f['name'], 'type': f['type'], 'county': f.get('county'),
                          'capacity': capacity, 'population': at(current),
                          'week_change': at(current) - (at(current - 1) or 0),
                          'year_change': at(current) - (at(year) or 0),
                          'record': at(current) > 0 and at(current) == max(p or 0 for p in f['population'])})
    rows = [r for r in on_report if r['type'] != 'juvenile']
    with_capacity = [r for r in rows if r['capacity']]
    short = lambda r, *keys: {k: r[k] for k in ('id', 'name', 'population', *keys)}  # noqa: E731
    jails = [r for r in rows if r['type'] == 'county_jail']

    return {
        'report_date': now['date'],
        'previous_date': statewide[-2]['date'],
        'year_ago_date': statewide[year]['date'],
        'population': {**moved(statewide, 'population', year), 'record_streak': streak,
                       'prior_peak': {'date': prior_peak['date'], 'value': prior_peak['population']}},
        'crowding': {'capacity': now['capacity'], 'capacity_type': now['capacity_type'],
                     'percent': percent(now['population'], now['capacity']),
                     'over_capacity': now['population'] - now['capacity'],
                     # the highest rate since this kind of capacity came into use
                     'record_percent': percent(most_crowded['population'], most_crowded['capacity']),
                     'record_date': most_crowded['date']},
        'men': {**moved(statewide, 'men_population', year),
                'percent': percent(now['men_population'], now['men_capacity'])},
        'women': {**moved(statewide, 'women_population', year),
                  'percent': percent(now['women_population'], now['women_capacity'])},
        'county_jails': {**moved(statewide, 'contract_county_jails', year),
                         'jails_holding': sum(1 for r in jails if r['population']), 'jails_listed': len(jails)},
        'juvenile': moved(statewide, 'juvenile_population', year),
        'supervision': {'population': now['supervision_population'], 'as_of': now['supervision_as_of'],
                        'holds': now['supervision_holds']},
        'facilities': {
            'over_capacity': sum(1 for r in with_capacity if r['population'] > r['capacity']),
            'with_capacity': len(with_capacity),
            'most_crowded': [{**short(r, 'capacity'), 'percent': percent(r['population'], r['capacity'])}
                             for r in sorted(with_capacity, key=lambda r: -r['population'] / r['capacity'])[:TOP]],
            'largest_gains': [short(r, 'week_change') for r in sorted(rows, key=lambda r: -r['week_change'])[:TOP]
                              if r['week_change'] > 0],
            'largest_drops': [short(r, 'week_change') for r in sorted(rows, key=lambda r: r['week_change'])[:TOP]
                              if r['week_change'] < 0],
            'largest_gains_year': [short(r, 'year_change')
                                   for r in sorted(rows, key=lambda r: -r['year_change'])[:TOP]
                                   if r['year_change'] > 0],
            'at_record': [short(r) for r in rows if r['record']],
        },
        'home_counties': HOME_COUNTIES,
        # every facility in those counties on this report, juvenile included, largest first
        'local': sorted((r for r in on_report if r['county'] in HOME_COUNTIES), key=lambda r: -r['population']),
    }


def main() -> None:
    reports = read_reports()
    if not reports:
        raise RuntimeError('No reports in data/reports; run backfill.py and update.py first')

    statewide, adult, youth = [], [], []
    for report in reports:
        row, adult_leaves, youth_leaves = week(report)
        statewide.append(row)
        adult.append(merge(adult_leaves))
        youth.append(merge(youth_leaves))
    check_series(statewide)

    dates = [w['date'] for w in statewide]
    facilities = history(dates, [a + y for a, y in zip(adult, youth)])
    latest = reports[-1]

    write_rows('statewide.json', statewide)
    write_rows('facilities.json', facilities, key='facilities', head={'dates': dates})
    write_output('latest.json', {**{'report_date' if k == 'date' else k: v for k, v in statewide[-1].items()},
                                 'source': latest['source'], 'facilities': adult[-1], 'juvenile': youth[-1]})
    moved_this_week = changes(statewide, facilities)
    write_output('changes.json', moved_this_week)
    write_text('brief.md', brief(moved_this_week, {'source': latest['source']}))

    write_csv('statewide.csv', list(statewide[0]), [list(w.values()) for w in statewide])
    write_csv('facility_names.csv', ['id', 'name', 'type', 'county', 'first', 'last'],
              [[f['id'], f['name'], f['type'], f.get('county'), f['first'], f['last']] for f in facilities])
    for measure in ('population', 'capacity'):
        columns = [f for f in facilities if measure in f]
        table = [[d] + [None] * len(columns) for d in dates]
        for c, f in enumerate(columns, start=1):
            for offset, value in enumerate(f[measure]):
                table[f['start'] + offset][c] = value
        write_csv(f'facility_{measure}.csv', ['date'] + [f['id'] for f in columns], table)

    months = read_county_months()
    if months:
        head, counties = county_series(months)
        write_rows('counties.json', counties, key='counties', head=head)
        write_csv('counties.csv', ['as_of', 'county', 'people', 'no_new_sentence'],
                  [[m['as_of'], c['county'], c['people'], c['no_new_sentence']] for m in months for c in m['counties']])

    peak = max(statewide, key=lambda w: w['population'])
    print(f"{len(statewide)} weeks, {len(facilities)} facilities; latest {dates[-1]}: "
          f"{statewide[-1]['population']:,}; peak {peak['date']}: {peak['population']:,}")


if __name__ == '__main__':
    main()
