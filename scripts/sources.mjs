// Every public dataset this site draws on.
//
// Rules learned the hard way, do not violate them:
//   * Field naming is inconsistent BETWEEN datasets. `buildingid` in one is
//     `building_id` in another and `bbl` in a third. ygpa-z7cr returns 2 rows
//     for buildingid=352258 and 1155 rows for bbl=3050560014 -- same building.
//     Always confirm a new query against a known row count before trusting it.
//   * Socrata aggregates ($select with count(), $group) and `like` clauses have
//     been rejected here. Filter and count in JS instead.
//   * Bare ?field=value params work. Use them.

export const SOURCES = {
  violations: {
    id: 'wvxf-dwi5',
    label: 'HPD Housing Maintenance Code Violations',
    agency: 'NYC Department of Housing Preservation and Development',
    url: 'https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5',
    query: (b) => ({ boroid: b.boroId, block: b.block, lot: b.lot }),
    critical: true,
    note: 'The authoritative status of every violation. The HPD Online CSV export collapses several distinct statuses into the single word OPEN; this dataset does not.'
  },
  registrations: {
    id: 'tesw-yqqr',
    label: 'HPD Multiple Dwelling Registrations',
    agency: 'NYC Department of Housing Preservation and Development',
    url: 'https://data.cityofnewyork.us/Housing-Development/Multiple-Dwelling-Registrations/tesw-yqqr',
    query: (b) => ({ boroid: b.boroId, block: b.block, lot: b.lot }),
    critical: true,
    note: 'Whether the owner has filed the annual registration the law requires.'
  },
  contacts: {
    id: 'feu5-w2e2',
    label: 'HPD Registration Contacts',
    agency: 'NYC Department of Housing Preservation and Development',
    url: 'https://data.cityofnewyork.us/Housing-Development/Registration-Contacts/feu5-w2e2',
    query: (b) => ({ registrationid: b.hpdRegistrationId }),
    critical: true,
    note: 'The names and business addresses the owner is required to file with the City under NYC Admin. Code s 27-2098.'
  },
  litigation: {
    id: '59kj-x8nc',
    label: 'HPD Litigation',
    agency: 'NYC Department of Housing Preservation and Development',
    url: 'https://data.cityofnewyork.us/Housing-Development/Housing-Litigations/59kj-x8nc',
    query: (b) => ({ boroid: b.boroId, block: b.block, lot: b.lot }),
    critical: false,
    note: 'Court cases involving this building, including tenant actions and HPD access warrants.'
  },
  complaints: {
    id: 'ygpa-z7cr',
    label: 'HPD Complaints and Problems',
    agency: 'NYC Department of Housing Preservation and Development',
    url: 'https://data.cityofnewyork.us/Housing-Development/Complaint-Problems/a2nx-4u46',
    query: (b) => ({ bbl: b.bbl }),
    critical: false,
    note: 'Complaints tenants made to HPD, and what HPD did about each one. Queried by BBL -- buildingid returns almost nothing for this dataset.'
  },
  rodent: {
    id: 'p937-wjvj',
    label: 'DOHMH Rodent Inspections',
    agency: 'NYC Department of Health and Mental Hygiene',
    url: 'https://data.cityofnewyork.us/Health/Rodent-Inspection/p937-wjvj',
    query: (b) => ({ bbl: b.bbl }),
    critical: false,
    note: 'A second agency, with no connection to HPD, inspecting this building for vermin.'
  },
  serviceRequests: {
    id: 'erm2-nwe9',
    label: '311 Service Requests',
    agency: 'NYC 311',
    url: 'https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9',
    query: () => ({ incident_address: '530 PARKSIDE AVENUE' }),
    critical: false,
    note: 'Calls to 311 about this address. Queried by street address -- the BBL field is sparsely populated in this dataset.'
  },
  dobViolations: {
    id: '3h2n-5cm9',
    label: 'DOB Violations',
    agency: 'NYC Department of Buildings',
    url: 'https://data.cityofnewyork.us/Housing-Development/DOB-Violations/3h2n-5cm9',
    query: (b) => ({ bin: b.bin }),
    critical: false,
    note: 'Building-code violations -- elevators, boilers, structural and safety. A different agency and a different code from HPD\u2019s housing-maintenance violations, so these are counted separately and never merged into the HPD total.'
  },
  ecbViolations: {
    id: '6bgk-3dad',
    label: 'DOB/ECB Violations',
    agency: 'NYC Department of Buildings / Environmental Control Board',
    url: 'https://data.cityofnewyork.us/Housing-Development/DOB-ECB-Violations/6bgk-3dad',
    query: (b) => ({ bin: b.bin }),
    critical: false,
    note: 'Violations carrying a monetary penalty, heard before the Office of Administrative Trials and Hearings. Records the penalty imposed and the balance still outstanding.'
  },
  evictions: {
    id: '6z8x-wfk4',
    label: 'Evictions',
    agency: 'NYC Department of Investigation \u2014 City Marshals',
    url: 'https://data.cityofnewyork.us/City-Government/Evictions/6z8x-wfk4',
    query: (b) => ({ bbl: b.bbl }),
    critical: false,
    note: 'Residential evictions carried out by a City Marshal at this address. Shown here only as a total. Apartment numbers are deliberately withheld -- see the privacy note on the sources page.'
  },
  aep: {
    id: 'hcir-3275',
    label: 'HPD Alternative Enforcement Program',
    agency: 'NYC Department of Housing Preservation and Development',
    url: 'https://data.cityofnewyork.us/Housing-Development/Buildings-Selected-for-the-Alternative-Enforcement/hcir-3275',
    query: (b) => ({ bbl: b.bbl }),
    critical: false,
    note: 'The City’s heightened-enforcement list for its most distressed buildings. An empty result means this building is not on it.'
  },
  underlyingConditions: {
    id: 'xpbf-ithr',
    label: 'HPD Underlying Conditions Program',
    agency: 'NYC Department of Housing Preservation and Development',
    url: 'https://data.cityofnewyork.us/Housing-Development/Underlying-Conditions-Program/xpbf-ithr',
    query: (b) => ({ bbl: b.bbl }),
    critical: false,
    note: 'A second City enforcement program for buildings with systemic problems. An empty result means this building is not on it.'
  }
};

export const SOCRATA_HOST = 'https://data.cityofnewyork.us';
