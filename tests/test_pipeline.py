"""Regression tests on one real DOC-302 PDF per format era.

Expected headline values were checked against a second extractor (poppler's pdftotext),
and 2019-08-09 / 2026-08-28-era figures match Wisconsin Watch's published numbers.
"""
import copy
from pathlib import Path

import pytest

from build import check_series
from parse import parse_date, parse_report
from snapshot import facilities

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


def test_current_form_facilities():
    by_name = {f['name']: f for f in facilities(load('2026-09-25'))}
    assert by_name["Milwaukee Women's Center"] == {'name': "Milwaukee Women's Center", 'capacity': 42, 'population': 107}
    assert by_name['Lincoln County Jail'] == {'name': 'Lincoln County Jail', 'capacity': None, 'population': 74}
    assert by_name['Waushara County Jail']['population'] == 24  # 17 men + 7 women, merged across blocks


def test_snapshot_throws_when_a_facility_row_goes_missing():
    report = load('2026-09-25')
    report['rows'] = [r for r in report['rows'] if r['name'] != 'Oakhill']
    with pytest.raises(ValueError, match='sums to'):
        facilities(report)


def test_snapshot_throws_on_an_unknown_subtotal_row():
    report = load('2026-09-25')
    i = next(i for i, r in enumerate(report['rows']) if r['name'] == 'Dodge')
    report['rows'].insert(i, {'name': 'NEW SUBTOTAL', 'values': [1165, 1771, 1758, 13]})  # double counts Dodge
    with pytest.raises(ValueError, match='sums to'):
        facilities(report)


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
