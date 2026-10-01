"""Which facility each DOC-302 row label belongs to.

DOC has printed 118 different labels for adult facilities since 1999: renames ("SMCI" ->
"WSPF"), typos ("Felmers o. Chaney"), footnote digits ("Fox Lake6"), and units of one prison
listed on separate rows ("Fox Lake" and "Fox Lake Min"). LABELS maps every one of them to a
facility id, so a facility's history is one series. A label that is not here throws, with
one exception: a row in a contract-beds block named for a Wisconsin county is that county's
jail, so a newly contracted jail does not stop the weekly run.

`county` for state-run facilities is from the Department of Health Services' list of state
correctional institutions (BadgerCare Plus handbook, section 45.9); facilities closed before
that list, and Grow Academy, have none. A county jail's county is in its name.

`type` is what the place is, not where DOC lists it that week:
  institution   DOC adult correctional institution
  center        Wisconsin Correctional Center System (minimum security)
  secure        Milwaukee Secure Detention Facility
  treatment     Wisconsin Resource Center (run by the Department of Health Services)
  county_jail   Wisconsin county jail or house of correction holding state prisoners on contract
  out_of_state  prison or jail in another state under contract
  federal       federal prison
  other         contract beds DOC reports only as a category
  juvenile      Division of Juvenile Corrections facility (listed in its own section of the form)
"""
import re

FACILITIES = {
    # Adult institutions
    'columbia': {'name': 'Columbia Correctional Institution', 'type': 'institution', 'county': 'Columbia'},
    'dodge': {'name': 'Dodge Correctional Institution', 'type': 'institution', 'county': 'Dodge'},
    'fox-lake': {'name': 'Fox Lake Correctional Institution', 'type': 'institution', 'county': 'Dodge'},
    'green-bay': {'name': 'Green Bay Correctional Institution', 'type': 'institution', 'county': 'Brown'},
    'jackson': {'name': 'Jackson Correctional Institution', 'type': 'institution', 'county': 'Jackson'},
    'kettle-moraine': {'name': 'Kettle Moraine Correctional Institution', 'type': 'institution', 'county': 'Sheboygan'},
    'new-lisbon': {'name': 'New Lisbon Correctional Institution', 'type': 'institution', 'county': 'Juneau'},
    'oakhill': {'name': 'Oakhill Correctional Institution', 'type': 'institution', 'county': 'Dane'},
    'oshkosh': {'name': 'Oshkosh Correctional Institution', 'type': 'institution', 'county': 'Winnebago'},
    'prairie-du-chien': {'name': 'Prairie du Chien Correctional Institution', 'type': 'institution', 'county': 'Crawford'},
    'racine': {'name': 'Racine Correctional Institution', 'type': 'institution', 'county': 'Racine'},
    'racine-youthful-offender': {'name': 'Racine Youthful Offender Correctional Facility', 'type': 'institution', 'county': 'Racine'},
    'redgranite': {'name': 'Redgranite Correctional Institution', 'type': 'institution', 'county': 'Waushara'},
    'stanley': {'name': 'Stanley Correctional Institution', 'type': 'institution', 'county': 'Chippewa'},
    'taycheedah': {'name': 'Taycheedah Correctional Institution', 'type': 'institution', 'county': 'Fond du Lac'},
    'waupun': {'name': 'Waupun Correctional Institution', 'type': 'institution', 'county': 'Dodge'},
    'wspf': {'name': 'Wisconsin Secure Program Facility', 'type': 'institution', 'county': 'Grant'},
    'chippewa-valley': {'name': 'Chippewa Valley Correctional Treatment Facility', 'type': 'institution', 'county': 'Chippewa'},
    'sturtevant': {'name': 'Sturtevant Transitional Facility', 'type': 'institution', 'county': 'Racine'},
    # Correctional centers
    'abode': {'name': 'Abode Correctional Center', 'type': 'center'},
    'black-river': {'name': 'Black River Correctional Center', 'type': 'center', 'county': 'Jackson'},
    'drug-abuse': {'name': 'Drug Abuse Correctional Center', 'type': 'center', 'county': 'Winnebago'},
    'ellsworth': {'name': 'Robert E. Ellsworth Correctional Center', 'type': 'center', 'county': 'Racine'},
    'felmers-chaney': {'name': 'Felmers O. Chaney Correctional Center', 'type': 'center', 'county': 'Milwaukee'},
    'flambeau': {'name': 'Flambeau Correctional Center', 'type': 'center', 'county': 'Sawyer'},
    'gordon': {'name': 'Gordon Correctional Center', 'type': 'center', 'county': 'Douglas'},
    'john-burke': {'name': 'John C. Burke Correctional Center', 'type': 'center', 'county': 'Dodge'},
    'kenosha': {'name': 'Kenosha Correctional Center', 'type': 'center', 'county': 'Kenosha'},
    'marshall-sherrer': {'name': 'Marshall E. Sherrer Correctional Center', 'type': 'center', 'county': 'Milwaukee'},
    'mcnaughton': {'name': 'McNaughton Correctional Center', 'type': 'center', 'county': 'Oneida'},
    'milwaukee-womens': {'name': "Milwaukee Women's Correctional Center", 'type': 'center', 'county': 'Milwaukee'},
    'oregon': {'name': 'Oregon Correctional Center', 'type': 'center', 'county': 'Dane'},
    'sanger-powers': {'name': 'Sanger B. Powers Correctional Center', 'type': 'center', 'county': 'Outagamie'},
    'st-croix': {'name': 'St. Croix Correctional Center', 'type': 'center', 'county': 'St. Croix'},
    'st-johns': {'name': "St. John's Correctional Center", 'type': 'center'},
    'thompson': {'name': 'Thompson Correctional Center', 'type': 'center', 'county': 'Dane'},
    'winnebago': {'name': 'Winnebago Correctional Center', 'type': 'center', 'county': 'Winnebago'},
    # Other state-run facilities
    'msdf': {'name': 'Milwaukee Secure Detention Facility', 'type': 'secure', 'county': 'Milwaukee'},
    'wrc': {'name': 'Wisconsin Resource Center', 'type': 'treatment', 'county': 'Winnebago'},
    # Contract beds outside Wisconsin's county jails. Names are DOC's labels.
    'milwaukee-house-of-correction': {'name': 'Milwaukee County House of Correction', 'type': 'county_jail',
                                      'county': 'Milwaukee'},
    'appleton-mn': {'name': 'Appleton, Minn.', 'type': 'out_of_state'},
    'hardeman-tn': {'name': 'Hardeman, Tenn.', 'type': 'out_of_state'},
    'mason-tn': {'name': 'Mason, Tenn.', 'type': 'out_of_state'},
    'mcloud-ok': {'name': 'McLoud, Okla.', 'type': 'out_of_state'},
    'north-fork-ok': {'name': 'North Fork, Okla.', 'type': 'out_of_state'},
    'tallahatchie-ms': {'name': 'Tallahatchie, Miss.', 'type': 'out_of_state'},
    'texas-county-jails': {'name': 'Texas county jails', 'type': 'out_of_state'},
    'watonga-ok': {'name': 'Watonga, Okla.', 'type': 'out_of_state'},
    'whiteville-tn': {'name': 'Whiteville, Tenn.', 'type': 'out_of_state'},
    'federal-alderson': {'name': 'Federal facility, Alderson', 'type': 'federal'},
    'federal-duluth': {'name': 'Federal facility, Duluth', 'type': 'federal'},
    'federal-oxford': {'name': 'Federal facility, Oxford', 'type': 'federal'},
    'federal-other': {'name': 'Federal facilities (up to 50 beds)', 'type': 'federal'},
    'intergovernmental-agreements': {'name': 'Intergovernmental agreements (up to 50 beds)', 'type': 'other'},
    'interstate-compact': {'name': 'Interstate Corrections Compact (up to 50 beds)', 'type': 'other'},
    'not-itemized': {'name': 'Contract beds DOC did not itemize', 'type': 'other'},
    # Juvenile facilities
    'copper-lake': {'name': 'Copper Lake School', 'type': 'juvenile', 'county': 'Lincoln'},
    'ethan-allen': {'name': 'Ethan Allen School', 'type': 'juvenile'},
    'grow-academy': {'name': 'Grow Academy', 'type': 'juvenile'},
    'lincoln-hills': {'name': 'Lincoln Hills School', 'type': 'juvenile', 'county': 'Lincoln'},
    'mendota-juvenile': {'name': 'Mendota Juvenile Treatment Center', 'type': 'juvenile', 'county': 'Dane'},
    'southern-oaks': {'name': 'Southern Oaks Girls School', 'type': 'juvenile'},
    'sprite': {'name': 'SPRITE', 'type': 'juvenile'},
    'youth-leadership': {'name': 'Youth Leadership Training Center', 'type': 'juvenile'},
}

LABELS = {
    'Abode': 'abode',
    'Black River': 'black-river',
    'Chippewa Valley Corr. Treatment Facility': 'chippewa-valley',
    'Columbia': 'columbia',
    'Dodge': 'dodge',
    'DODGE RECEPTION CENTER': 'dodge',  # women's reception, 1999-2005
    'DODGE INFIRMARY': 'dodge',         # women held in Dodge's infirmary, 2004 on; no capacity of its own
    'Drug Abuse Center': 'drug-abuse',
    'Robert E. Ellsworth Center': 'ellsworth',
    "Milwaukee Men's CC": 'felmers-chaney',  # renamed between Oct 13 and Oct 20, 2000; same counts both weeks
    'Felmers O. Chaney': 'felmers-chaney',
    'Felmers o. Chaney': 'felmers-chaney',
    'Flambeau': 'flambeau',
    'Fox Lake': 'fox-lake',
    'Fox Lake6': 'fox-lake',
    'Fox Lake Min': 'fox-lake',  # minimum-security unit, on its own row 2000-2011
    'Gordon': 'gordon',
    'Green Bay': 'green-bay',
    'Jackson': 'jackson',
    'John C. Burke': 'john-burke',
    'John Burke Center': 'john-burke',  # held women, Oct 2000 - Nov 2011
    'John Burke Correctional Center5': 'john-burke',
    'John Burke Correctional Center': 'john-burke',
    'Kenosha': 'kenosha',
    'Kettle Moraine': 'kettle-moraine',
    'Marshall E. Sherrer': 'marshall-sherrer',
    'McNaughton': 'mcnaughton',
    "Milwaukee Women's Center": 'milwaukee-womens',
    'Milwaukee Secure Detention Facility - AODA Program': 'msdf',
    'Milwaukee Secure Detention Facility - Temp. Holds': 'msdf',
    'Milwaukee Secure Detention Facility - Transportation Unit': 'msdf',
    'Milwaukee Secure Detention Facility - Temp. Inmate Beds': 'msdf',
    'Milwaukee Secure Detention Facility - Inmate Beds': 'msdf',
    'Milwaukee Secure Detention - Inmate Beds': 'msdf',
    'Milwaukee Secure Detention Facility - PIOC Beds': 'msdf',
    'Milwaukee Secure Detention Facility Drug Diversion Program (FDOATP)': 'msdf',
    'New Lisbon': 'new-lisbon',
    'Oakhill': 'oakhill',
    'Oregon': 'oregon',
    'Oshkosh': 'oshkosh',
    'Prairie du Chien': 'prairie-du-chien',  # listed under contract beds until Aug 2002
    'Racine': 'racine',
    'Racine Youthful Offender Correctional Facility': 'racine-youthful-offender',
    'Red Granite': 'redgranite',
    'Redgranite': 'redgranite',
    'Sanger B. Powers': 'sanger-powers',
    'St. Croix': 'st-croix',
    "St. John's": 'st-johns',
    'Stanley': 'stanley',
    'Sturtevant Transitional Facility': 'sturtevant',
    'TAYCHEEDAH': 'taycheedah',
    'Thompson': 'thompson',
    'Waupun': 'waupun',
    'Winnebago': 'winnebago',
    'SMCI': 'wspf',  # Supermax Correctional Institution, renamed in 2002
    'WSPF': 'wspf',
    'WSGP': 'wspf',  # general-population unit, on its own row 2007-2015
    'WRC (DCTF FACILITY)': 'wrc',
    'WRC (DDES FACILITY)': 'wrc',
    'House of Corrections Jail': 'milwaukee-house-of-correction',
    'House of Correction': 'milwaukee-house-of-correction',
    'Appleton, MN': 'appleton-mn',
    'CSA-McLoud, OK': 'mcloud-ok',
    'Hardeman, TN': 'hardeman-tn',
    'Mason, TN': 'mason-tn',
    'North Fork, OK': 'north-fork-ok',
    'Tallahatchee, MS': 'tallahatchie-ms',
    'Texas County Jails Contract': 'texas-county-jails',
    'Watonga, OK': 'watonga-ok',
    'Whiteville, TN': 'whiteville-tn',
    'Federal Facility-Alderson': 'federal-alderson',
    'Federal Facility-Duluth': 'federal-duluth',
    'Federal Facility-Oxford': 'federal-oxford',
    'Federal Facilities (up to 50 beds)': 'federal-other',
    'Intergovernmental Agreements (IGA) (up to 50 beds)': 'intergovernmental-agreements',
    'Interstate Corrections Compact (ICC) (up to 50 beds)': 'interstate-compact',
}

JUVENILE_LABELS = {
    'Copper Lake School': 'copper-lake',
    'Ethan Allen': 'ethan-allen',
    'Grow Academy': 'grow-academy',
    'Lincoln Hills': 'lincoln-hills',
    'Lincoln Hills School': 'lincoln-hills',
    'Mendota Juvenile Treatment Center': 'mendota-juvenile',
    'Southern Oaks Girls School': 'southern-oaks',
    'SPRITE': 'sprite',
    'Youth Leadership Training Center': 'youth-leadership',
}

WISCONSIN_COUNTIES = {
    'Adams', 'Ashland', 'Barron', 'Bayfield', 'Brown', 'Buffalo', 'Burnett', 'Calumet', 'Chippewa', 'Clark',
    'Columbia', 'Crawford', 'Dane', 'Dodge', 'Door', 'Douglas', 'Dunn', 'Eau Claire', 'Florence', 'Fond du Lac',
    'Forest', 'Grant', 'Green', 'Green Lake', 'Iowa', 'Iron', 'Jackson', 'Jefferson', 'Juneau', 'Kenosha',
    'Kewaunee', 'La Crosse', 'Lafayette', 'Langlade', 'Lincoln', 'Manitowoc', 'Marathon', 'Marinette',
    'Marquette', 'Menominee', 'Milwaukee', 'Monroe', 'Oconto', 'Oneida', 'Outagamie', 'Ozaukee', 'Pepin',
    'Pierce', 'Polk', 'Portage', 'Price', 'Racine', 'Richland', 'Rock', 'Rusk', 'St. Croix', 'Sauk', 'Sawyer',
    'Shawano', 'Sheboygan', 'Taylor', 'Trempealeau', 'Vernon', 'Vilas', 'Walworth', 'Washburn', 'Washington',
    'Waukesha', 'Waupaca', 'Waushara', 'Winnebago', 'Wood',
}
# "Oneida County Jail", "Jefferson County", "Outagamie County Jail (up to 150 beds)"
COUNTY_JAIL = re.compile(r'^(.+?) County(?: Jail)?(?: \(up to \d+ beds\))?$')


def facility_id(label: str, contract: bool) -> str:
    """Facility id for a row label; `contract` says whether the row sits in a contract-beds block."""
    if label in LABELS:
        return LABELS[label]
    if contract and (m := COUNTY_JAIL.match(label)) and m.group(1) in WISCONSIN_COUNTIES:
        return m.group(1).lower().replace('.', '').replace(' ', '-') + '-county-jail'
    raise ValueError(f'Unknown facility row {label!r}; add it to LABELS in registry.py')


def facility(facility_id_: str) -> dict:
    """Name, type and (for jails) county of a facility id."""
    if facility_id_ in FACILITIES:
        return FACILITIES[facility_id_]
    county = next(c for c in WISCONSIN_COUNTIES
                  if c.lower().replace('.', '').replace(' ', '-') + '-county-jail' == facility_id_)
    return {'name': f'{county} County Jail', 'type': 'county_jail', 'county': county}
