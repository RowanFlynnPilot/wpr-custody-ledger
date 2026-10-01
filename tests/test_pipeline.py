"""Regression tests on one real DOC-302 PDF per format era.

Expected headline values were checked against a second extractor (poppler's pdftotext),
and 2019-08-09 / 2026-08-28-era figures match Wisconsin Watch's published numbers.
"""
import copy
from datetime import date, timedelta
from pathlib import Path

import pytest

from brief import ap_date, brief, flags, moved, title
from build import HOME_COUNTIES, changes, check_series, year_before
from parse import parse_date, parse_report
from series import supervision_as_of, week
from snapshot import facilities, juvenile

FIXTURES = Path(__file__).parent / 'fixtures'

# file -> (capacity type, [capacity, population, DAI, DCC]); file name is the expected report date
EXPECTED = {
    '1999-01-08': ('operating', [14193, 17986, 17475, 511]),   # "January 8, 1999"; DIVISION OF ADULT INSTITUTIONS label
    '2001-03-23': ('operating', [16696, 20684, 20251, 433]),   # date wrapped to next line: "Friday March 23, 2001revised"
    '2009-04-17': ('design', [17731, 22562, 22221, 341]),      # "APRIL 17, 2009"; next line holds a decoy "as of 2/28/2009"
    '2019-08-09': ('design', [17830, 23826, 23528, 298]),      # 2019 peak, the record until Aug 2026
    '2026-01-02': ('design', [17743, 23282, 23229, 53]),       # Rev. 05_21_2025: single CONTRACT BEDS block
    '2026-09-25': ('design', [17860, 23905, 23828, 77]),       # Rev. 03_04_2026: current form
}


def load(name: str) -> dict:
    return parse_report((FIXTURES / f'{name}.pdf').read_bytes(), name)


@pytest.mark.parametrize('name', EXPECTED)
def test_headline(name):
    report = load(name)
    capacity_type, (capacity, population, dai, dcc) = EXPECTED[name]
    assert report['report_date'] == name
    assert report['capacity_type'] == capacity_type
    assert report['adult_institutions'] == {'capacity': capacity, 'population': population, 'dai': dai, 'dcc': dcc}


def row_index(report: dict, name: str) -> int:
    return next(i for i, r in enumerate(report['rows']) if r['name'] == name)


@pytest.mark.parametrize('name', EXPECTED)
def test_every_era_reconciles_at_facility_level(name):
    # breakdown() and juvenile() throw unless the rows add up to DOC's own totals.
    report = load(name)
    assert sum(f['population'] for f in facilities(report)) == EXPECTED[name][1][1]
    assert juvenile(report)


def test_current_form_facilities():
    by_id = {f['id']: f for f in facilities(load('2026-09-25'))}
    assert by_id['milwaukee-womens'] == {
        'id': 'milwaukee-womens', 'name': "Milwaukee Women's Correctional Center", 'type': 'center',
        'county': 'Milwaukee', 'security': 'minimum', 'sex': 'female', 'capacity': 42, 'population': 107}
    assert by_id['lincoln-county-jail'] == {
        'id': 'lincoln-county-jail', 'name': 'Lincoln County Jail', 'type': 'county_jail', 'county': 'Lincoln',
        'security': None, 'sex': 'both', 'capacity': None, 'population': 74}
    assert by_id['waushara-county-jail']['population'] == 24  # 17 men + 7 women, merged across blocks
    assert by_id['mcnaughton']['county'] == 'Oneida'


def test_rows_of_one_facility_are_merged_across_label_changes():
    # 1999: "John C. Burke", a men's center. 2009: "John Burke Center", listed with the women, and Fox Lake's
    # minimum unit on its own row. Both resolve to one facility each.
    assert {f['id']: f for f in facilities(load('1999-01-08'))}['john-burke']['sex'] == 'male'
    by_id = {f['id']: f for f in facilities(load('2009-04-17'))}
    assert by_id['john-burke']['sex'] == 'female'
    report = load('2009-04-17')
    fox_lake = [r['values'] for r in report['rows'] if r['name'] in ('Fox Lake', 'Fox Lake Min')]
    assert len(fox_lake) == 2
    assert by_id['fox-lake']['population'] == sum(v[1] for v in fox_lake)
    assert by_id['fox-lake']['capacity'] == sum(v[0] for v in fox_lake)


def test_out_of_state_era_is_classified():
    row, _, _ = week(load('1999-01-08'))
    assert row['contract_population'] == 3720
    assert row['contract_out_of_state'] + row['contract_federal'] + row['contract_county_jails'] == 3720 - 297
    # the other 297 are at Prairie du Chien, a state facility DOC listed under contract beds until 2002
    assert row['contract_out_of_state'] == 699 + 692 + 4 + 1252  # Texas jails, North Fork, Hardeman, Whiteville


def test_statewide_row():
    row, _, _ = week(load('2026-09-25'))
    assert row == {
        'date': '2026-09-25', 'population': 23905, 'capacity': 17860, 'capacity_type': 'design',
        'capacity_printed': 17860, 'men_population': 22155, 'men_capacity': 16886, 'women_population': 1750,
        'women_capacity': 974, 'contract_population': 490, 'contract_county_jails': 461,
        'contract_out_of_state': 0, 'contract_federal': 0, 'juvenile_population': 122,
        'supervision_population': 64051, 'supervision_as_of': '2026-07-31', 'supervision_holds': 840}


def test_capacity_is_the_sum_of_the_rows_where_doc_misprinted_its_total():
    # Mar 23, 2001 falls in a CAPACITY_MISPRINTS stretch: Redgranite's 750 beds are missing from the printed total.
    row, _, _ = week(load('2001-03-23'))
    assert row['capacity_printed'] == 16696
    assert row['capacity'] == 16696 + 750


def test_capacity_mismatch_outside_a_known_stretch_throws():
    report = load('2026-09-25')
    report['rows'][row_index(report, 'Dodge')]['values'][0] += 100
    with pytest.raises(ValueError, match='they should match'):
        facilities(report)


def test_juvenile_facilities():
    by_id = {f['id']: f for f in juvenile(load('2026-09-25'))}
    assert (by_id['lincoln-hills']['capacity'], by_id['lincoln-hills']['population']) == (519, 63)
    assert by_id['lincoln-hills']['county'] == 'Lincoln'
    assert by_id['mendota-juvenile']['population'] == 39 + 11  # boys' and girls' rows merged
    assert by_id['mendota-juvenile']['sex'] == 'both'
    report = load('2026-09-25')
    del report['rows'][row_index(report, 'Lincoln Hills School')]
    with pytest.raises(ValueError, match='juvenile facilities sum to'):
        juvenile(report)


def test_snapshot_throws_when_a_facility_row_goes_missing():
    report = load('2026-09-25')
    report['rows'] = [r for r in report['rows'] if r['name'] != 'Oakhill']
    with pytest.raises(ValueError, match='sum to'):
        facilities(report)


def test_snapshot_throws_on_an_unknown_row():
    report = load('2026-09-25')
    report['rows'].insert(row_index(report, 'Dodge'), {'name': 'NEW SUBTOTAL', 'values': [1165, 1771, 1758, 13]})
    with pytest.raises(ValueError, match='registry.py'):
        facilities(report)


def test_a_newly_contracted_county_jail_needs_no_registry_entry():
    report = load('2026-09-25')
    report['rows'].insert(row_index(report, 'Lincoln County Jail'), {'name': 'Marathon County Jail', 'values': [0, 0, 0]})
    marathon = next(f for f in facilities(report) if f['id'] == 'marathon-county-jail')
    assert (marathon['type'], marathon['county']) == ('county_jail', 'Marathon')
    # ...but only a Wisconsin county, and only inside a contract-beds block
    report['rows'].insert(row_index(report, 'Lincoln County Jail'), {'name': 'Cook County Jail', 'values': [0, 0, 0]})
    with pytest.raises(ValueError, match='registry.py'):
        facilities(report)


def test_a_blank_cell_throws_with_a_pointer_to_the_fix():
    report = load('2026-09-25')
    report['rows'][row_index(report, 'Oneida County Jail')]['values'] = [120, 120]  # DCC cell blank
    with pytest.raises(ValueError, match='ROW_FIXES'):
        facilities(report)


def test_supervision_as_of():
    label = 'TOTAL PROBATION/PAROLE POPULATION (as of {})'
    assert supervision_as_of(label.format('8/31/98'), '1999-01-08') == '1998-08-31'
    assert supervision_as_of(label.format('07/31/2026'), '2026-09-25') == '2026-07-31'
    assert supervision_as_of(label.format('04/303/31/04'), '2004-09-03') is None  # DOC's typo; never guessed
    assert supervision_as_of(label.format('10/312009'), '2010-01-08') is None


def synthetic_weeks(populations: list[int]) -> list[dict]:
    start = date(2025, 9, 26)
    return [{'date': (start + timedelta(weeks=i)).isoformat(), 'population': p, 'capacity': 100,
             'capacity_type': 'design', 'men_population': p - 10, 'men_capacity': 90, 'women_population': 10,
             'women_capacity': 10, 'contract_county_jails': 5, 'juvenile_population': 3,
             'supervision_population': 1, 'supervision_as_of': None, 'supervision_holds': None}
            for i, p in enumerate(populations)]


def test_changes_counts_the_record_streak_and_finds_the_prior_peak():
    weeks = synthetic_weeks([100, 110, 105, 111, 112])
    result = changes(weeks, [])
    assert result['population'] == {'value': 112, 'week_change': 1, 'year_change': 12, 'record': True,
                                    'record_streak': 2, 'prior_peak': {'date': weeks[1]['date'], 'value': 110}}
    assert result['crowding']['percent'] == 112.0 and result['crowding']['over_capacity'] == 12
    result = changes(synthetic_weeks([100, 110, 105]), [])
    assert (result['population']['record'], result['population']['record_streak']) == (False, 0)
    assert result['population']['prior_peak']['value'] == 110
    assert result['crowding']['record_percent'] == 110.0


def synthetic_facility(population: list[int], **extra) -> dict:
    return {'id': 'lincoln-county-jail', 'name': 'Lincoln County Jail', 'type': 'county_jail', 'county': 'Lincoln',
            'start': 0, 'population': population, **extra}


def test_changes_lists_home_county_facilities_and_only_those():
    weeks = synthetic_weeks([100, 110, 105, 111, 112])
    away = synthetic_facility([1, 1, 1, 1, 1], id='dane-county-jail', name='Dane County Jail', county='Dane')
    result = changes(weeks, [synthetic_facility([10, 12, 12, 13, 19]), away])
    assert result['home_counties'] == HOME_COUNTIES
    assert result['local'] == [{'id': 'lincoln-county-jail', 'name': 'Lincoln County Jail', 'type': 'county_jail',
                                'county': 'Lincoln', 'capacity': None, 'population': 19, 'week_change': 6,
                                'year_change': 9, 'record': True}]


def test_brief_wording():
    assert ap_date('2026-09-25') == 'Sept. 25, 2026' and ap_date('2026-05-01', year=False) == 'May 1'
    assert moved(8, 'a week earlier') == 'up 8 from a week earlier'
    assert moved(-1204, 'a year earlier') == 'down 1,204 from a year earlier'
    assert moved(0, 'a week earlier') == 'unchanged from a week earlier'


def test_brief_on_a_record_week_and_an_ordinary_one():
    weeks = synthetic_weeks([100, 110, 105, 111, 112])
    record = changes(weeks, [synthetic_facility([10, 12, 12, 13, 19])])
    assert title(record) == f"Custody Ledger brief, {ap_date(weeks[-1]['date'])}: record 112"
    assert flags(record)[0] == 'Record: 112 people, the second straight weekly record'
    assert 'Lincoln County Jail: 19 state prisoners, up 6 from a week earlier, its highest count on record' in flags(record)
    text = brief(record, {'source': 'https://example.test/report.pdf'})
    assert text.startswith('# Custody Ledger brief')
    assert 'It is the most in weekly records that begin in 1999 and the second record in as many weeks.' in text
    assert '- Lincoln County Jail (Lincoln County): 19 state prisoners, up 6 from a week earlier' in text

    ordinary = changes(synthetic_weeks([100, 110, 105]), [synthetic_facility([10, 12, 12])])
    assert title(ordinary).endswith(': 105, down 5 from a week earlier')
    assert not any(flag.startswith('Record') for flag in flags(ordinary))
    assert 'The record is 110, set' in brief(ordinary, {'source': 'x'})
    assert 'Lincoln County Jail' not in ' '.join(flags(ordinary))  # unchanged in a week: nothing to flag


def test_year_before_picks_the_report_closest_to_52_weeks_back():
    weeks = synthetic_weeks(list(range(100, 160)))  # 60 consecutive weeks
    assert year_before(weeks) == 59 - 52
    del weeks[59 - 52]  # a missing week, as in DOC's archive
    assert weeks[year_before(weeks)]['date'] in (weeks[5]['date'], weeks[6]['date'], weeks[7]['date'])


def test_parse_date_rejects_non_report_weekday():
    with pytest.raises(ValueError, match='Saturday'):
        parse_date(['Persons in Our Care on 09_26_2026'], 'test')


def test_check_series_rejects_implausible_jump():
    week = {'date': '2026-09-18', 'capacity': 17860, 'capacity_type': 'design', 'population': 23897}
    series = [{**week, 'date': '2008-03-07', 'capacity_type': 'operating'}, week, copy.deepcopy(week)]
    series[-1].update(date='2026-09-25', population=25000)
    with pytest.raises(ValueError, match='moved'):
        check_series(series)


def test_parse_date_never_borrows_a_date_from_the_next_line():
    # The probation line below a header carries an "as of" date (a Friday here). An unreadable
    # header date must throw, not silently pick that one up.
    lines = ['Persons in Our Care on 9-25-2026', 'TOTAL PROBATION/PAROLE POPULATION (as of 07/31/2026) 64,051']
    with pytest.raises(ValueError, match='unreadable report date'):
        parse_date(lines, 'test')


def test_reissued_week_fails_with_pointer_to_the_fix(tmp_path, monkeypatch):
    import store
    monkeypatch.setattr(store, 'REPORTS_DIR', tmp_path)
    report = load('2026-09-25')
    store.write_report(report)
    store.write_report(report)  # same source again is fine (rerun)
    with pytest.raises(ValueError, match='corrections.py'):
        store.write_report({**report, 'source': 'fri_09_25_2026_Corrected.pdf', 'sha256': 'f' * 64})


def test_file_changed_in_place_fails(tmp_path, monkeypatch):
    import store
    monkeypatch.setattr(store, 'REPORTS_DIR', tmp_path)
    report = load('2026-09-25')
    store.write_report(report)
    with pytest.raises(ValueError, match='DOC changed'):
        store.write_report({**report, 'sha256': 'f' * 64})


def test_same_file_at_a_new_address_takes_the_new_address(tmp_path, monkeypatch):
    # Each January DOC moves the finished year's weekly PDFs into a zip.
    import store
    monkeypatch.setattr(store, 'REPORTS_DIR', tmp_path)
    report = load('2026-09-25')
    store.write_report(report)
    store.write_report({**report, 'source': '2026.zip#2026/fri_09_25_2026.pdf'})
    assert [r['source'] for r in store.read_reports()] == ['2026.zip#2026/fri_09_25_2026.pdf']
