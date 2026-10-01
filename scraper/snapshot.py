"""Facility-level breakdown of one report, for the current DOC-302 form (Rev. 03_04_2026).

Leaf rows are every institution and contract-bed row between the ADULT INSTITUTIONS
headline and the 'Occupied Beds' line, minus the subtotal rows below. The leaves must
add back up to the headline in all four columns; if DOC changes the form, that throws.
Rows without a capacity are contract beds (county jails, ICC), whose capacity DOC
reports only at the CONTRACT BEDS subtotal, and Dodge Infirmary, which has none.
"""
START = 'ADULT INSTITUTIONS'
END = 'Occupied Beds per s.301.055'
CONTRACT_SUBTOTALS = {'CONTRACT BEDS (MALE)', 'CONTRACT BEDS (FEMALE)'}
SUBTOTALS = CONTRACT_SUBTOTALS | {
    'Institutions, Centers, MSDF AODA, PIOCs & Trans. Units',
    'WRC',
    'Contract Facilities',
    'SUBTOTAL-MALES (ALL LOCATIONS)',
    'MAXIMUM SECURITY INST.',
    'MEDIUM SECURITY INST.',
    'MINIMUM SECURITY INST.',
    'Center System',
    'SUB-TOTAL FEMALES (ALL LOCATIONS)',
    '(Female)',  # sex splits under WRC (DDES FACILITY) and MSDF PIOC Beds
    '(Male)',
}


def facilities(report: dict) -> list[dict]:
    names = [row['name'] for row in report['rows']]
    if START not in names or END not in names:
        raise ValueError(f"{report['source']}: expected '{START}' and '{END}' rows (form revision {report['revision']})")
    region = report['rows'][names.index(START) + 1:names.index(END)]

    leaves: dict[str, dict] = {}
    for row in region:
        if row['name'] in SUBTOTALS:
            continue
        values = row['values']
        if len(values) == 4:
            capacity, population, dai, dcc = values
        elif len(values) == 3:
            capacity, (population, dai, dcc) = None, values
        else:
            raise ValueError(f"{report['source']}: unexpected row shape {row}")
        if row['name'] in leaves:
            # County jails appear once in the male and once in the female contract-bed block.
            leaf = leaves[row['name']]
            if capacity is not None or leaf['capacity'] is not None:
                raise ValueError(f"{report['source']}: facility with capacity listed twice: {row['name']}")
            leaf['population'] += population
            leaf['dai'] += dai
            leaf['dcc'] += dcc
        else:
            leaves[row['name']] = {'name': row['name'], 'capacity': capacity,
                                   'population': population, 'dai': dai, 'dcc': dcc}

    headline = report['adult_institutions']
    contract_capacity = sum(row['values'][0] for row in region if row['name'] in CONTRACT_SUBTOTALS)
    capacity_total = contract_capacity + sum(l['capacity'] for l in leaves.values() if l['capacity'] is not None)
    if capacity_total != headline['capacity']:
        raise ValueError(f"{report['source']}: facility capacity sums to {capacity_total}, "
                         f"headline says {headline['capacity']}")
    for field in ('population', 'dai', 'dcc'):
        total = sum(leaf[field] for leaf in leaves.values())
        if total != headline[field]:
            raise ValueError(f"{report['source']}: facility {field} sums to {total}, headline says {headline[field]}")

    return [{'name': l['name'], 'capacity': l['capacity'], 'population': l['population']} for l in leaves.values()]
