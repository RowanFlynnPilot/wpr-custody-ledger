"""Draft the weekly brief: what the newest report shows, in sentences a reporter can check and use.

Everything here is assembled from changes.json and latest.json by fixed rules; nothing is
generated or estimated. The first line is the title the weekly job gives the GitHub issue
that delivers the brief.
"""
from datetime import date

SITE = 'https://rowanflynnpilot.github.io/wpr-custody-ledger/'
AP_MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth']
LOCAL_MOVE = 5  # a close-to-home facility that moves this much in a week is flagged


def ap_date(iso: str, year: bool = True) -> str:
    d = date.fromisoformat(iso)
    return f'{AP_MONTHS[d.month - 1]} {d.day}' + (f', {d.year}' if year else '')


def ordinal(n: int) -> str:
    """First through ninth as words (AP); from 10th, the figure with its proper ending."""
    if n < len(ORDINALS):
        return ORDINALS[n]
    ending = 'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')
    return f'{n}{ending}'


def moved(n: int, since: str) -> str:
    """'up 8 from a week earlier' / 'down 4 ...' / 'unchanged from ...'."""
    if n == 0:
        return f'unchanged from {since}'
    return f"{'up' if n > 0 else 'down'} {abs(n):,} from {since}"


def held(row: dict) -> str:
    """'74 state prisoners' / '63 youth' / '118 people'."""
    noun = {'county_jail': 'state prisoners', 'juvenile': 'youth'}.get(row['type'], 'people')
    return f"{row['population']:,} {noun}"


def flags(changes: dict) -> list[str]:
    population, crowding, women = changes['population'], changes['crowding'], changes['women']
    out = []
    if population['record']:
        streak = population['record_streak']
        out.append(f"Record: {population['value']:,} people, " +
                   (f'the {ordinal(streak)} straight weekly record' if streak > 1 else
                    f"passing {population['prior_peak']['value']:,} set {ap_date(population['prior_peak']['date'])}"))
    if crowding['record_date'] == changes['report_date']:
        out.append(f"Crowding record: {crowding['percent']}% of {crowding['capacity_type']} capacity, the highest "
                   'in weekly records that begin in 1999')
    if women['record']:
        out.append(f"Most women on record: {women['value']:,}, at {women['percent']}% of capacity")
    if changes['county_jails']['record']:
        out.append(f"Most state prisoners in county jails on record: {changes['county_jails']['value']:,}")
    for row in changes['local']:
        if abs(row['week_change']) >= LOCAL_MOVE or row['record'] and row['week_change'] > 0:
            out.append(f"{row['name']}: {held(row)}, {moved(row['week_change'], 'a week earlier')}" +
                       (', its highest count on record' if row['record'] else ''))
    return out


def title(changes: dict) -> str:
    population = changes['population']
    lead = f"record {population['value']:,}" if population['record'] else \
        f"{population['value']:,}, {moved(population['week_change'], 'a week earlier')}"
    return f"Custody Ledger brief, {ap_date(changes['report_date'])}: {lead}"


def brief(changes: dict, latest: dict) -> str:
    report, short = ap_date(changes['report_date']), ap_date(changes['report_date'], year=False)
    population, crowding = changes['population'], changes['crowding']
    women, men, jails, facilities = changes['women'], changes['men'], changes['county_jails'], changes['facilities']

    lede = (f"Wisconsin's adult prison system held {population['value']:,} people on {short}, "
            f"{moved(population['week_change'], 'a week earlier')} and "
            f"{moved(population['year_change'], 'a year earlier')}, according to the Department of Corrections' "
            'weekly population report.')
    if population['record']:
        lede += (' It is the most in weekly records that begin in 1999' +
                 (f" and the {ordinal(population['record_streak'])} record in as many weeks."
                  if population['record_streak'] > 1 else '.'))
    else:
        lede += (f" The record is {population['prior_peak']['value']:,}, set "
                 f"{ap_date(population['prior_peak']['date'])}.")

    # Not "the prisons were designed to hold": the total includes the contract beds, each counted as full.
    rented = crowding['contract_beds']
    capacity = (f"The department puts its {crowding['capacity_type']} capacity at {crowding['capacity']:,}" +
                (f": {crowding['capacity'] - rented:,} beds in its own prisons and centers, plus the {rented:,} "
                 'contract beds it rents, which it counts as full' if rented else '') +
                f". That puts the system at {crowding['percent']}% of capacity, {crowding['over_capacity']:,} "
                'people beyond it.')
    if crowding['record_date'] == changes['report_date']:
        capacity += ' That is the highest rate in weekly records that begin in 1999.'
    else:
        capacity += (f" The highest rate in weekly records that begin in 1999 was "
                     f"{crowding['record_percent']}%, on {ap_date(crowding['record_date'])}.")

    sexes = (f"Women's prisons held {women['value']:,} people, {women['percent']}% of their capacity" +
             (', the most women on record' if women['record'] else '') +
             f". Men's prisons were at {men['percent']}%. Of {facilities['with_capacity']} facilities with a "
             f"capacity, {facilities['over_capacity']} held more people than they were designed for.")

    contract = (f"County jails held {jails['value']:,} state prisoners on contract, "
                f"{moved(jails['week_change'], 'a week earlier')} and {moved(jails['year_change'], 'a year earlier')}, "
                f"in {jails['jails_holding']} of the {jails['jails_listed']} jails on the department's list.")

    def movers(rows: list[dict]) -> str:
        return '; '.join(f"{r['name']} {r['week_change']:+,} to {r['population']:,}" for r in rows) or 'none'

    local = [f"- {row['name']} ({row['county']} County): {held(row)}, {moved(row['week_change'], 'a week earlier')}, "
             f"{moved(row['year_change'], 'a year earlier')}" +
             (f"; {round(100 * row['population'] / row['capacity'], 1)}% of capacity" if row['capacity'] else '') +
             ('; its highest count on record' if row['record'] else '')
             for row in changes['local'] if row['population']]
    found = flags(changes)

    return '\n'.join([
        f'# {title(changes)}',
        '',
        f"*Drafted by rule from the Department of Corrections' report of {report}. Check it against the report "
        'before publishing.*',
        '',
        '## Flags',
        '',
        *([f'- {flag}' for flag in found] or ['Nothing flagged this week.']),
        '',
        '## Draft',
        '',
        lede, '', capacity, '', sexes, '', contract,
        '',
        '## Close to home',
        '',
        *(local or ['No facility in the home counties held anyone this week.']),
        '',
        '## What moved',
        '',
        f"- Largest gains in a week: {movers(facilities['largest_gains'])}",
        f"- Largest drops in a week: {movers(facilities['largest_drops'])}",
        '- At their highest counts on record: ' +
        ('; '.join(f"{r['name']} ({r['population']:,})" for r in facilities['at_record']) or 'none'),
        '',
        f"Source: [DOC-302 report of {report}]({latest['source']}). Charts and data: {SITE}",
        '',
    ])
