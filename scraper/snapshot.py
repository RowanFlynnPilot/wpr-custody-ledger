"""Facility-level breakdown of one report, for every DOC-302 since 1999.

The adult section runs from the ADULT INSTITUTIONS headline to the 'Occupied Beds' line.
After three summary rows it lists men's facilities, then women's. A row there is one of:
- a section header carrying a subtotal (sex, security level, center system, contract beds)
- a split of the facility above it, in parentheses: "(Reception)", "(Female)"
- a facility: four numbers (capacity, population, DAI, DCC), or three with no capacity for
  contract beds and Dodge's infirmary

Only capacity and population are read from facility rows; the DAI and DCC cells carry
occasional typos. Everything published is checked against DOC's own totals, and breakdown()
throws unless, for the report in hand:
- facility populations add up to the headline population
- contract-bed rows add up to the 'Contract Facilities' summary row
- women (women's facilities plus the "(Female)" splits of shared ones) add up to the women's subtotal,
  and everyone else to the men's
- women's beds (those facilities and splits, plus the women's contract-bed subtotal) equal the capacity
  on the women's subtotal row, except in any stretch listed in corrections.WOMEN_CAPACITY_MISPRINTS
- facility capacities plus the contract-bed subtotals equal the headline capacity, except in
  the stretches listed in corrections.CAPACITY_MISPRINTS
- every row label is one registry.py knows

juvenile() does the same for the Division of Juvenile Corrections block further down the form:
facility rows there are (capacity, population) and must add up to 'Total On-Grounds Population'.
"""
from corrections import (CAPACITY_MISPRINTS, COUNTED_BELOW, JUVENILE_ROWS_DROPPED, NOT_ITEMIZED, ROW_FIXES,
                         WOMEN_CAPACITY_MISPRINTS)
from parse import HEADLINE_LABELS
from registry import JUVENILE_LABELS, facility, facility_id

END = 'Occupied Beds per s.301.055'
MEN = 'SUBTOTAL-MALES (ALL LOCATIONS)'
WOMEN = 'SUB-TOTAL FEMALES (ALL LOCATIONS)'
SECURITY = {'MAXIMUM SECURITY INST.': 'maximum', 'MEDIUM SECURITY INST.': 'medium',
            'MINIMUM SECURITY INST.': 'minimum'}
CONTRACT_BLOCKS = {'CONTRACT BEDS', 'CONTRACT BEDS*', 'CONTRACT BEDS (MALE)', 'CONTRACT BEDS (FEMALE)'}
OTHER_SUBTOTALS = {'Center System', 'Northern Sector', 'Southern Sector', 'Sector'}  # "Sector 1" reads as 'Sector' + 5 numbers
NOT_DATA = {'DOC-302-Page', 'Corrections Corp. of America'}  # page footer; a heading printed with a stray 0
NO_CAPACITY = {'DODGE INFIRMARY'}
ON_GROUNDS = 'Total On-Grounds Population'  # followed by a footnote mark that has changed over the years
JUVENILE_SEX = {'SUBTOTAL-MALES': 'male', 'SUBTOTAL-FEMALES': 'female'}
JUVENILE_END = ('Juvenile Field Population', 'Total Estimated Billable Days')


def breakdown(report: dict) -> dict:
    """Every facility row of one report, reconciled to the headline.

    Returns {'capacity', 'women': {'capacity', 'population'}, 'contract_population', 'leaves'};
    each leaf is {'id', 'label', 'sex', 'security', 'contract', 'capacity', 'population'}; sex and
    security are the sections of the form the row sits in.
    """
    date, source = report['report_date'], report['source']
    rows = report['rows']
    names = [row['name'] for row in rows]
    start = next(i for i, name in enumerate(names) if name in HEADLINE_LABELS)
    if END not in names or names[start:].count(MEN) != 1 or names[start:].count(WOMEN) != 1:
        raise ValueError(f"{source}: expected one '{END}', one '{MEN}' and one '{WOMEN}' row "
                         f"(form revision {report['revision']})")
    end, men_at, women_at = names.index(END), names.index(MEN, start), names.index(WOMEN, start)
    summary = {row['name']: row['values'] for row in rows[start + 1:men_at]}
    counted_below = [row for row in rows[end:] if row['name'] == COUNTED_BELOW.get(date)]
    if date in COUNTED_BELOW and len(counted_below) != 1:
        raise ValueError(f"{source}: COUNTED_BELOW row {COUNTED_BELOW[date]!r} not found below the adult section")

    sex, security, contract = None, None, False
    contract_capacity = 0
    women = {'capacity': 0, 'population': 0}
    leaves, fixes_used = [], set()

    def fix(label: str, values: list[int]) -> tuple | None:
        printed, fixed = ROW_FIXES.get((date, label), (None, None))
        if printed != values:
            return None
        fixes_used.add(label)
        return fixed

    for row in rows[men_at:women_at] + counted_below + rows[women_at:end]:
        label, values = row['name'], row['values']
        if label in NOT_DATA or label in OTHER_SUBTOTALS:
            continue
        if label in (MEN, WOMEN):
            sex, security, contract = ('male' if label == MEN else 'female'), None, False
        elif label in SECURITY:
            security, contract = SECURITY[label], False
        elif label in CONTRACT_BLOCKS:
            security, contract = None, True
            contract_capacity += values[0]
            if sex == 'female':
                women['capacity'] += values[0]
        elif label.startswith('('):
            # Splits repeat the facility above them. Only women held in a facility listed with the men matter.
            if label == '(Female)' and sex == 'male':
                if len(values) == 4:
                    capacity, population = fix(label, values) or values[:2]
                    women['capacity'] += capacity
                    women['population'] += population
                elif any(values):
                    raise ValueError(f'{source}: "(Female)" split has a blank cell and is not empty: {values}')
        else:
            if fixed := fix(label, values):
                capacity, population = fixed
            elif len(values) == 4:
                capacity, population = values[0], values[1]
            elif len(values) == 3 and (contract or label in NO_CAPACITY):
                capacity, population = None, values[0]
            elif len(values) < 3 and not any(values) and (contract or label in NO_CAPACITY):
                capacity, population = None, 0
            else:
                raise ValueError(f'{source}: row {label!r} reads {values}, which fits no column layout. If a cell '
                                 'is blank in the PDF, add the row to ROW_FIXES in corrections.py')
            if capacity is not None:
                contract = False  # a row with a capacity ends the contract-beds block
            leaves.append({'id': facility_id(label, contract), 'label': label, 'sex': sex, 'security': security,
                           'contract': contract, 'capacity': capacity, 'population': population})

    stale = {label for fix_date, label in ROW_FIXES if fix_date == date} - fixes_used
    if stale:
        raise ValueError(f'{source}: ROW_FIXES rows not found as printed in the adult section: {sorted(stale)}')
    if date in NOT_ITEMIZED:
        leaves.append({'id': 'not-itemized', 'label': None, 'sex': 'male', 'security': None, 'contract': True,
                       'capacity': None, 'population': NOT_ITEMIZED[date]})

    headline = report['adult_institutions']
    population = sum(leaf['population'] for leaf in leaves)
    if population != headline['population']:
        raise ValueError(f"{source}: facility populations sum to {population:,}, headline says "
                         f"{headline['population']:,}")
    contract_population = sum(leaf['population'] for leaf in leaves if leaf['contract'])
    if contract_population != summary['Contract Facilities'][1]:
        raise ValueError(f"{source}: contract-bed rows sum to {contract_population:,}, 'Contract Facilities' says "
                         f"{summary['Contract Facilities'][1]:,}")
    women['population'] += sum(leaf['population'] for leaf in leaves if leaf['sex'] == 'female')
    women['capacity'] += sum(leaf['capacity'] or 0 for leaf in leaves if leaf['sex'] == 'female')
    if women['population'] != rows[women_at]['values'][1]:
        raise ValueError(f"{source}: women's rows sum to {women['population']:,}, the women's subtotal says "
                         f"{rows[women_at]['values'][1]:,}")
    if population - women['population'] != rows[men_at]['values'][1]:
        raise ValueError(f"{source}: men's rows sum to {population - women['population']:,}, the men's subtotal "
                         f"says {rows[men_at]['values'][1]:,}")
    # The site draws a women's crowding rate for every week, so its denominator is held to DOC's own figure.
    printed = rows[women_at]['values'][0]
    misprint = any(first <= date <= last for first, last, _ in WOMEN_CAPACITY_MISPRINTS)
    if (women['capacity'] != printed) != misprint:
        raise ValueError(f"{source}: women's beds sum to {women['capacity']:,} and the women's subtotal says "
                         f"{printed:,}; " + ('they should differ in this stretch of WOMEN_CAPACITY_MISPRINTS'
                                            if misprint else 'they should match'))

    capacity = contract_capacity + sum(leaf['capacity'] or 0 for leaf in leaves)
    misprint = any(first <= date <= last for first, last, _ in CAPACITY_MISPRINTS)
    if (capacity != headline['capacity']) != misprint:
        raise ValueError(f"{source}: facility capacities sum to {capacity:,} and the headline says "
                         f"{headline['capacity']:,}; " + ('they should differ in this stretch of CAPACITY_MISPRINTS'
                                                          if misprint else 'they should match'))

    return {'capacity': capacity, 'women': women, 'contract_population': contract_population, 'leaves': leaves}


def juvenile_leaves(report: dict) -> list[dict]:
    """Every juvenile-facility row of one report, reconciled to 'Total On-Grounds Population'."""
    date, source = report['report_date'], report['source']
    rows = report['rows']
    names = [row['name'] for row in rows]
    at = [i for i in range(names.index(END), len(rows)) if names[i].startswith(ON_GROUNDS)]
    if len(at) != 1:
        raise ValueError(f"{source}: expected one '{ON_GROUNDS}' row below the adult section, found {len(at)}")

    sex, leaves = None, []
    for row in rows[at[0] + 1:]:
        label, values = row['name'], row['values']
        if label.startswith(JUVENILE_END):
            break
        if label in NOT_DATA:
            continue
        if label in JUVENILE_SEX:
            sex = JUVENILE_SEX[label]
            continue
        if label not in JUVENILE_LABELS:
            raise ValueError(f'{source}: unknown juvenile facility row {label!r}; add it to JUVENILE_LABELS in '
                             'registry.py')
        if len(values) == 2:
            capacity, population = values
        elif not any(values):
            capacity, population = None, 0
        else:
            raise ValueError(f'{source}: juvenile row {label!r} reads {values}; expected capacity and population')
        leaves.append({'id': JUVENILE_LABELS[label], 'label': label, 'sex': sex, 'security': None,
                       'contract': False, 'capacity': capacity, 'population': population})
    if date in JUVENILE_ROWS_DROPPED:
        label, sex, capacity, population = JUVENILE_ROWS_DROPPED[date]
        if any(leaf['label'] == label for leaf in leaves):
            raise ValueError(f'{source}: JUVENILE_ROWS_DROPPED row {label!r} is in the report after all')
        leaves.append({'id': JUVENILE_LABELS[label], 'label': label, 'sex': sex, 'security': None,
                       'contract': False, 'capacity': capacity, 'population': population})

    population = sum(leaf['population'] for leaf in leaves)
    if population != rows[at[0]]['values'][-1]:
        raise ValueError(f"{source}: juvenile facilities sum to {population:,}, '{names[at[0]]}' says "
                         f"{rows[at[0]]['values'][-1]:,}")
    return leaves


def merge(leaves: list[dict]) -> list[dict]:
    """One entry per facility: rows that belong to the same place are added together."""
    merged: dict[str, dict] = {}
    for leaf in leaves:
        entry = merged.setdefault(leaf['id'], {'id': leaf['id'], **facility(leaf['id']), 'security': None,
                                               'sex': leaf['sex'], 'capacity': None, 'population': 0})
        entry['security'] = entry['security'] or leaf['security']
        if entry['sex'] != leaf['sex']:
            entry['sex'] = 'both'
        if leaf['capacity'] is not None:
            entry['capacity'] = (entry['capacity'] or 0) + leaf['capacity']
        entry['population'] += leaf['population']
    return list(merged.values())


def facilities(report: dict) -> list[dict]:
    """Adult facilities of one report, one entry each."""
    return merge(breakdown(report)['leaves'])


def juvenile(report: dict) -> list[dict]:
    """Juvenile facilities of one report, one entry each."""
    return merge(juvenile_leaves(report))
