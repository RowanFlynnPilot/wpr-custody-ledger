"""Hand-verified fixes for DOC source files, used by both backfill.py and update.py.

Keys are the exact `source` string stored with each report: an archive zip URL plus
'#<member>', or a weekly report URL. backfill.py throws if an archive key here no longer
matches a file, so this list can't silently go stale.

When DOC re-issues a week (a "Revised" or "Corrected" PDF), the weekly job fails with a
duplicate-date error. To resolve: add the superseded URL to SKIP, delete that date's file
in data/reports/, and rerun update.py.
"""
ARCHIVE = 'https://doc.wi.gov/DataResearch/ArchivedPopulationReports/'
WEEKLY = 'https://doc.wi.gov/DataResearch/WeeklyPopulationReports/'

# Files left out of the dataset, with the reason.
SKIP = {
    # DOC re-issued these weeks; the Revised/Corrected file in the same zip supersedes the original.
    f'{ARCHIVE}1999.zip#1999/1999.06.04.pdf': 'superseded by 1999.06.04 Revised.pdf',
    f'{ARCHIVE}1999.zip#1999/1999.09.10.pdf': 'superseded by 1999.09.10 Revised.pdf',
    f'{ARCHIVE}1999.zip#1999/1999.12.03.pdf': 'superseded by 1999.12.03 Revised.pdf',
    f'{ARCHIVE}2000.zip#2000/2000.01.07.pdf': 'superseded by 2000.01.07 Revised.pdf',
    f'{ARCHIVE}2000.zip#2000/2000.01.21.pdf': 'superseded by 2000.01.21 Revised.pdf',
    f'{ARCHIVE}2000.zip#2000/2000.03.31.pdf': 'superseded by 2000.03.31 Revised.pdf',
    f'{ARCHIVE}2001.zip#2001/2001.09.21.pdf': 'superseded by 2001.09.21 Corrected.pdf',
    f'{ARCHIVE}2019.zip#2019/07052019.pdf': 'superseded by 07052019Corrected.pdf',
    f'{ARCHIVE}2020.zip#2020/01242020.pdf': 'superseded by 01242020Corrected.pdf',
    f'{ARCHIVE}2020.zip#2020/03202020.pdf': 'superseded by 03202020Corrected.pdf',
    # Misnamed copy: header date and every count match 2015.04.24.pdf.
    f'{ARCHIVE}2015.zip#2015/2015.04.04.pdf': 'duplicate of the Apr 24, 2015 report',
    # Population columns are missing from the source PDF; only capacity is printed.
    f'{ARCHIVE}2013.zip#2013/2013.01.04.pdf': 'population columns missing from source',
}

# Header date is wrong in the source PDF; value is the correct report date.
DATE_OVERRIDES = {
    # Header reads "9/30/2011 10/7/2011" (prior week's date left in); file name and counts are Oct 7.
    f'{ARCHIVE}2011.zip#2011/2011.10.07.pdf': '2011-10-07',
}


# --- Facility rows (used by snapshot.py) ---------------------------------------------------
#
# Rows DOC printed with a blank cell, so the row has fewer numbers than columns and the ones
# left can't be placed by position. Key: (report date, row label). Value: the numbers as
# printed, then the row as (capacity, population); capacity is None for beds that have none.
# A fix applies to the row with that label and exactly those printed numbers.
# Each fix is the only reading that makes its report's rows add up to the headline.
# A short row of nothing but zeros needs no entry: snapshot.py reads it as empty.
ROW_FIXES = {
    # Oneida County Jail's first five weeks: population printed, DAI cell blank.
    ('1999-10-08', 'Oneida County Jail'): ([20, 0], (None, 20)),
    ('1999-10-15', 'Oneida County Jail'): ([20, 0], (None, 20)),
    ('1999-10-22', 'Oneida County Jail'): ([21, 0], (None, 21)),
    ('1999-10-29', 'Oneida County Jail'): ([21, 0], (None, 21)),
    ('1999-11-05', 'Oneida County Jail'): ([21, 0], (None, 21)),
    # Supermax's first week: no capacity printed yet.
    ('1999-11-12', 'SMCI'): ([12, 12, 0], (None, 12)),
    # DCC cell blank on a row that has a capacity.
    ('2000-10-20', 'John Burke Center'): ([186, 37, 37], (186, 37)),
    ('2001-11-09', 'WRC (DCTF FACILITY)'): ([315, 315, 315], (315, 315)),
    ('2008-10-03', 'WRC (DDES FACILITY)'): ([306, 306, 306], (306, 306)),
    ('2010-04-16', 'WRC (DDES FACILITY)'): ([345, 345, 345], (345, 345)),
    # DCC cell blank on contract-bed rows.
    ('2002-10-11', 'Columbia County Jail'): ([30, 30], (None, 30)),
    ('2002-10-11', 'Manitowoc County Jail'): ([28, 28], (None, 28)),
    ('2002-10-11', 'Oneida County Jail'): ([30, 30], (None, 30)),
    ('2002-10-11', 'Outagamie County Jail'): ([78, 78], (None, 78)),
    ('2002-10-11', 'Vilas County Jail'): ([30, 30], (None, 30)),
    ('2010-01-15', 'DODGE INFIRMARY'): ([1, 1], (None, 1)),
    # Not a blank cell but a slip of the same kind: for one week the facility's population (355) was
    # typed into its "(Female)" split as a capacity and carried into the row. 302 the week before and after.
    ('2008-03-21', 'Milwaukee Secure Detention Facility - Inmate Beds'): ([657, 355, 183, 172], (302, 355)),
    ('2008-03-21', '(Female)'): ([355, 0, 0, 0], (0, 0)),
}

# Rows printed below the adult section that the headline nonetheless counts. For three weeks
# after the Milwaukee Secure Detention Facility opened, its drug diversion program sat under
# community corrections on the form while its 70 beds and its population were in the adult total.
COUNTED_BELOW = {
    '2001-10-05': 'Milwaukee Secure Detention Facility Drug Diversion Program (FDOATP)',
    '2001-10-12': 'Milwaukee Secure Detention Facility Drug Diversion Program (FDOATP)',
    '2001-10-19': 'Milwaukee Secure Detention Facility Drug Diversion Program (FDOATP)',
}

# People the contract-beds subtotal counts but no row lists. On Mar 10, 2017 the subtotal says
# 226 and the rows add to 207; Vernon County Jail's row first appears a week later, holding 25.
NOT_ITEMIZED = {'2017-03-10': 19}

# A juvenile-facility row the parser drops. The PDF line reads "Lincoln Hills 298 321 ***error on Fri Rpt":
# the typed note leaves no trailing numbers, so the row is not stored. (label, sex, capacity, population)
JUVENILE_ROWS_DROPPED = {'2001-09-21': ('Lincoln Hills', 'male', 298, 321)}

# Stretches where DOC's printed total capacity is not the sum of its own facility rows.
# (first report, last report, what went wrong). In these weeks the Ledger's capacity is the
# sum of the rows and the printed figure is kept alongside it. snapshot.py throws if a week
# outside these ranges disagrees, or a week inside one agrees.
CAPACITY_MISPRINTS = [
    ('2001-01-19', '2001-04-20', "Redgranite's 750 beds are on its row but left out of the medium-security subtotal"),
    ('2003-12-12', '2004-06-18', 'the minimum-security subtotal stopped adding in most correctional centers '
                                 'when the sector subtotals were removed from the form'),
    ('2004-07-02', '2004-12-31', 'the same, after one week (June 25) in which the subtotal was right'),
    ('2007-02-23', '2008-03-07', "beds added on facility rows (the WSPF general-population unit's 30, then "
                                 "Black River's 40 and others) never reached the subtotals"),
    ('2008-03-14', '2008-05-30', "the total repeats the men's subtotal, leaving out all 1,123 women's beds; "
                                 'these are the first 12 weeks of design capacity'),
]


def apply_date_override(report: dict) -> dict:
    if report['source'] in DATE_OVERRIDES:
        report['date_corrected_from'] = report['report_date']
        report['report_date'] = DATE_OVERRIDES[report['source']]
    return report
