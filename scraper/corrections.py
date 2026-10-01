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


def apply_date_override(report: dict) -> dict:
    if report['source'] in DATE_OVERRIDES:
        report['date_corrected_from'] = report['report_date']
        report['report_date'] = DATE_OVERRIDES[report['source']]
    return report
