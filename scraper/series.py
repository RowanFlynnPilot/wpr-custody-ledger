"""One statewide row per report: the headline plus the breakdowns the form supports every week since 1999.

Adult figures come from snapshot.breakdown(), so each is already reconciled to DOC's totals.
Supervision figures are single lines DOC prints with nothing to check them against; they are
carried as printed.
"""
import re
from datetime import date

from registry import facility
from snapshot import breakdown, juvenile_leaves

SUPERVISION = 'TOTAL PROBATION/PAROLE POPULATION'
HOLDS = 'PROBATION AND PAROLE IN CUSTODY'  # printed Oct 2001 - Mar 2002 and from Mar 2015 on
AS_OF = re.compile(r'\(as of (\d{1,2})/(\d{1,2})/(\d{2}|\d{4})\)$')


def supervision_as_of(label: str, report_date: str) -> str | None:
    """The 'as of' date in the probation/parole label; None where DOC mistyped it ("04/303/31/04")."""
    m = AS_OF.search(label)
    if not m:
        return None
    month, day, year = (int(g) for g in m.groups())
    if year < 100:
        year += 1900 if year >= 90 else 2000
    try:
        as_of = date(year, month, day)
    except ValueError:
        return None
    # The count runs one to several months behind the report; anything else is a typo.
    return as_of.isoformat() if 0 <= (date.fromisoformat(report_date) - as_of).days <= 366 else None


def week(report: dict) -> tuple[dict, list[dict], list[dict]]:
    """(statewide row, adult facility leaves, juvenile facility leaves) for one report."""
    adult = breakdown(report)
    youth = juvenile_leaves(report)
    headline = report['adult_institutions']
    women = adult['women']
    contract = {kind: sum(leaf['population'] for leaf in adult['leaves']
                          if leaf['contract'] and facility(leaf['id'])['type'] == kind)
                for kind in ('county_jail', 'out_of_state', 'federal')}

    supervision = [row for row in report['rows'] if row['name'].startswith(SUPERVISION)]
    if len(supervision) != 1 or len(supervision[0]['values']) != 1:
        raise ValueError(f"{report['source']}: expected one '{SUPERVISION}' line with one number")
    holds = [row['values'] for row in report['rows'] if row['name'] == HOLDS]
    if len(holds) > 1 or holds and len(holds[0]) not in (3, 4):
        raise ValueError(f"{report['source']}: unexpected '{HOLDS}' row(s): {holds}")

    row = {
        'date': report['report_date'],
        'population': headline['population'],
        'capacity': adult['capacity'],
        'capacity_type': report['capacity_type'],  # DOC's label: 'operating' before 2008-03-14, 'design' after
        'capacity_printed': headline['capacity'],  # differs from capacity only in corrections.CAPACITY_MISPRINTS
        'men_population': headline['population'] - women['population'],
        'men_capacity': adult['capacity'] - women['capacity'],
        'women_population': women['population'],
        'women_capacity': women['capacity'],
        'contract_population': adult['contract_population'],
        'contract_county_jails': contract['county_jail'],
        'contract_out_of_state': contract['out_of_state'],
        'contract_federal': contract['federal'],
        'juvenile_population': sum(leaf['population'] for leaf in youth),
        'supervision_population': supervision[0]['values'][0],
        'supervision_as_of': supervision_as_of(supervision[0]['name'], report['report_date']),
        # The row is (population, DAI, DCC), or with a capacity in front in 2001-02.
        'supervision_holds': holds[0][-3] if holds else None,
    }
    return row, adult['leaves'], youth
