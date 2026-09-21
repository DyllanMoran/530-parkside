// Turn raw City rows into the facts the page states.
//
// Discipline, because this page names a real person and may be read by a judge:
//   * Every number here must be derivable from a row in data/latest.json.
//   * Facts, sourced and dated. Never motive. "47 open violations, 39 past
//     their correction deadline, per HPD as of 2026-09-21" is unassailable.
//     "The landlord doesn't care" is a fight to lose.
//   * Where the record is ambiguous, say it is ambiguous. VIOLATION CLOSED
//     does not distinguish "fixed" from "dismissed", so we never claim either.

// ---------------------------------------------------------------------------
// Privacy redaction
// ---------------------------------------------------------------------------
// HPD violation text occasionally describes the household rather than the
// building -- most often the lead-paint formula naming a child under six. That
// identifies a specific family with a young child who has no part in this. The
// violation still appears in full: apartment, class, date, ID, condition. Only
// the household clause goes.
//
// This is a structural rule, not a one-off edit, because HPD's wording varies
// between inspectors and a future pull can reintroduce a phrasing we have not
// seen yet.
const REDACTIONS = [
  /\s*IN\s+AN?\s+APARTMENT\s+WHERE\s+A\s+CHILD\s+UNDER\s+(?:THE\s+AGE\s+OF\s+)?(?:SIX|6|SEVEN|7)\s+(?:YEARS\s+(?:OF\s+AGE\s+)?)?RESIDES\s*/gi,
  /\s*IN\s+AN?\s+APARTMENT\s+WITH\s+A\s+CHILD\s+UNDER\s+(?:THE\s+AGE\s+OF\s+)?(?:SIX|6|SEVEN|7)\s*/gi,
  /\s*WHERE\s+A\s+CHILD\s+UNDER\s+(?:THE\s+AGE\s+OF\s+)?(?:SIX|6|SEVEN|7)\s+(?:YEARS\s+(?:OF\s+AGE\s+)?)?RESIDES\s*/gi
];

export function redact(text) {
  if (!text) return '';
  let out = text;
  let redacted = false;
  for (const re of REDACTIONS) {
    if (re.test(out)) {
      redacted = true;
      out = out.replace(re, ' ');
    }
  }
  out = out.replace(/\s{2,}/g, ' ').trim();
  return redacted ? `${out} [household detail removed]` : out;
}

// ---------------------------------------------------------------------------
// Condition categories
// ---------------------------------------------------------------------------
// Ordered: first match wins, so put the specific before the general.
const CATEGORIES = [
  { key: 'roaches',   label: 'Cockroaches',        match: /ROACH/i,                                      pest: true },
  { key: 'mice',      label: 'Mice',               match: /\bMICE\b|\bMOUSE\b/i,                          pest: true },
  { key: 'rats',      label: 'Rats',               match: /\bRAT\b|\bRATS\b|RODENT/i,                     pest: true },
  { key: 'vermin',    label: 'Other vermin',       match: /VERMIN|BEDBUG|BED BUG|INFESTATION/i,           pest: true },
  { key: 'mold',      label: 'Mold',               match: /\bMOLD\b/i },
  { key: 'lead',      label: 'Lead paint',         match: /LEAD[- ]BASED PAINT|LEAD PAINT/i },
  { key: 'heat',      label: 'Heat & hot water',   match: /\bHEAT\b(?!\s*RISER)|HOT WATER/i },
  { key: 'water',     label: 'Leaks & water damage', match: /LEAK|WATER DAMAG|SEEPAGE/i },
  { key: 'fire',      label: 'Fire safety',        match: /SMOKE DETECT|CARBON MONOXIDE|FIRE ESCAPE|SELF-CLOSING|SPRINKLER/i },
  { key: 'plumbing',  label: 'Plumbing & fixtures', match: /WASHBASIN|BATHTUB|TOILET|WATER CLOSET|FAUCET|SINK|PLUMBING/i },
  { key: 'surfaces',  label: 'Walls, ceilings & paint', match: /PLASTER|PAINT|CEILING|WALL\b/i },
  { key: 'electrical', label: 'Electrical',        match: /ELECTRIC|WIRING|OUTLET|LIGHT FIXTURE/i },
  { key: 'doors',     label: 'Doors, windows & locks', match: /\bDOOR\b|WINDOW|\bLOCK\b/i },
  { key: 'structure', label: 'Floors, stairs & structure', match: /FLOOR|STAIR|STEP|BANISTER|HANDRAIL/i },
  { key: 'other',     label: 'Other',              match: /.*/ }
];

export function categorize(description) {
  const text = description || '';
  return CATEGORIES.find((c) => c.match.test(text)) || CATEGORIES[CATEGORIES.length - 1];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const d = (v) => (v ? String(v).slice(0, 10) : null);
const isOpen = (r) => (r.violationstatus || '').toUpperCase() === 'OPEN';

function daysBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return null;
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

const CLASS_LABEL = {
  A: 'Non-hazardous',
  B: 'Hazardous',
  C: 'Immediately hazardous',
  I: 'Information'
};

// A short, plain-English gloss on HPD's status vocabulary. The raw status is
// always shown too -- this only sits alongside it.
const STATUS_MEANING = {
  'NOT COMPLIED WITH': 'HPD inspected and found the condition still there.',
  'FIRST NO ACCESS TO RE- INSPECT VIOLATION': 'HPD came to re-inspect and could not get in. A second failed attempt can lead to the violation being dismissed without the condition ever being fixed.',
  'SECOND NO ACCESS TO RE- INSPECT VIOLATION': 'HPD’s second failed attempt to get in to re-inspect. The violation can now be dismissed without the condition being fixed.',
  'DEFECT LETTER ISSUED': 'HPD has written to the owner about the defect.',
  'VIOLATION WILL BE REINSPECTED': 'Flagged by HPD for re-inspection.',
  'VIOLATION CLOSED': 'Closed on HPD’s record. The record does not say whether it was closed because the condition was fixed or because it was dismissed.',
  'VIOLATION DISMISSED': 'Removed from HPD’s record without a finding that the condition was repaired. HPD dismisses violations for several reasons, including being unable to gain access to re-inspect. The record does not say which reason applied.',
  'CERTIFICATION POSTPONMENT GRANTED': 'HPD gave the owner more time to certify that the work was done.',
  'NOTICE OF ISSUANCE SENT TO TENANT': 'HPD notified the tenant that the violation was issued.',
  'INVALID CERTIFICATION': 'The owner certified that this was fixed and HPD found that it was not.',
  'FALSE CERTIFICATION': 'The owner certified that this was fixed and HPD found that it was not.'
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export function analyze(snapshot, config) {
  const today = snapshot.date;
  const ds = snapshot.datasets;
  const violations = ds.violations || [];

  const all = violations.map((r) => {
    const description = redact(r.novdescription);
    const cat = categorize(r.novdescription);
    const correctBy = d(r.originalcorrectbydate);
    const open = isOpen(r);
    const overdue = open && correctBy ? daysBetween(correctBy, today) : null;
    return {
      id: r.violationid,
      novId: r.novid,
      apartment: (r.apartment || '').trim() || null,
      story: r.story || null,
      class: (r.class || '').toUpperCase(),
      classLabel: CLASS_LABEL[(r.class || '').toUpperCase()] || null,
      description,
      category: cat.key,
      categoryLabel: cat.label,
      isPest: !!cat.pest,
      inspected: d(r.inspectiondate),
      novIssued: d(r.novissueddate),
      correctBy,
      certifyBy: d(r.originalcertifybydate),
      certified: d(r.certifieddate),
      status: r.currentstatus || null,
      statusDate: d(r.currentstatusdate),
      statusMeaning: STATUS_MEANING[r.currentstatus] || null,
      open,
      overdueDays: overdue !== null && overdue > 0 ? overdue : null,
      rentImpairing: r.rentimpairing === 'Y'
    };
  });

  const open = all.filter((v) => v.open);

  const byClass = {};
  for (const c of ['C', 'B', 'A', 'I']) {
    const n = open.filter((v) => v.class === c).length;
    if (n) byClass[c] = { count: n, label: CLASS_LABEL[c] };
  }

  const pastDeadline = open.filter((v) => v.overdueDays !== null);
  const apartments = [...new Set(open.map((v) => v.apartment).filter(Boolean))].sort(sortApt);

  // Categories, open only, biggest first.
  const catCounts = new Map();
  for (const v of open) {
    const e = catCounts.get(v.category) || { key: v.category, label: v.categoryLabel, count: 0, apartments: new Set() };
    e.count++;
    if (v.apartment) e.apartments.add(v.apartment);
    catCounts.set(v.category, e);
  }
  const categories = [...catCounts.values()]
    .map((e) => ({ ...e, apartments: [...e.apartments].sort(sortApt) }))
    .sort((a, b) => b.count - a.count);

  // Status breakdown of what is open right now.
  const statusCounts = new Map();
  for (const v of open) {
    const key = v.status || 'Unknown';
    const e = statusCounts.get(key) || { status: key, meaning: v.statusMeaning, count: 0, apartments: new Set() };
    e.count++;
    if (v.apartment) e.apartments.add(v.apartment);
    statusCounts.set(key, e);
  }
  const statuses = [...statusCounts.values()]
    .map((e) => ({ ...e, apartments: [...e.apartments].sort(sortApt) }))
    .sort((a, b) => b.count - a.count);

  // Per-apartment rollup.
  const aptMap = new Map();
  for (const v of open) {
    if (!v.apartment) continue;
    const e = aptMap.get(v.apartment) || { apartment: v.apartment, count: 0, classC: 0, oldest: null, categories: new Set(), maxOverdue: 0 };
    e.count++;
    if (v.class === 'C') e.classC++;
    if (!e.oldest || (v.inspected && v.inspected < e.oldest)) e.oldest = v.inspected;
    e.categories.add(v.categoryLabel);
    if (v.overdueDays && v.overdueDays > e.maxOverdue) e.maxOverdue = v.overdueDays;
    aptMap.set(v.apartment, e);
  }
  const apartmentRollup = [...aptMap.values()]
    .map((e) => ({ ...e, categories: [...e.categories].sort() }))
    .sort((a, b) => b.count - a.count || sortApt(a.apartment, b.apartment));

  // Pest history, open and closed, oldest first. This is the long story.
  const pestHistory = all
    .filter((v) => v.isPest)
    .sort((a, b) => (a.inspected || '').localeCompare(b.inspected || ''));

  const openPests = pestHistory.filter((v) => v.open);
  const oldestOpenPest = openPests[0] || null;

  // Recent status activity, straight from currentstatusdate. Works from day one,
  // unlike the snapshot diff, which needs history to accumulate.
  const recentActivity = buildRecentActivity(all, today);

  return {
    generatedAt: snapshot.fetchedAt,
    date: today,
    config,
    violations: { all, open, total: all.length },
    summary: {
      openCount: open.length,
      totalOnRecord: all.length,
      byClass,
      pastDeadlineCount: pastDeadline.length,
      pastDeadlinePct: open.length ? Math.round((pastDeadline.length / open.length) * 100) : 0,
      longestOverdueDays: pastDeadline.reduce((m, v) => Math.max(m, v.overdueDays || 0), 0),
      apartmentsAffected: apartments.length,
      apartments,
      classCCount: byClass.C ? byClass.C.count : 0
    },
    categories,
    statuses,
    apartmentRollup,
    pests: {
      history: pestHistory,
      open: openPests,
      oldestOpen: oldestOpenPest,
      oldestOpenDays: oldestOpenPest ? daysBetween(oldestOpenPest.inspected, today) : null,
      openApartments: [...new Set(openPests.map((v) => v.apartment).filter(Boolean))].sort(sortApt)
    },
    recentActivity,
    apartmentAmbiguity: apartmentAmbiguity(all),
    owner: buildOwner(ds.contacts || []),
    registration: buildRegistration(ds.registrations || [], today),
    litigation: buildLitigation(ds.litigation || []),
    rodent: buildRodent(ds.rodent || []),
    complaints: buildComplaints(ds.complaints || [], today),
    serviceRequests: buildServiceRequests(ds.serviceRequests || [], today),
    otherAgencies: buildOtherAgencies(ds.dobViolations, ds.ecbViolations),
    evictions: buildEvictions(ds.evictions),
    enforcement: {
      aep: { onList: (ds.aep || []).length > 0, rows: ds.aep || [], available: ds.aep !== null },
      underlyingConditions: {
        onList: (ds.underlyingConditions || []).length > 0,
        rows: ds.underlyingConditions || [],
        available: ds.underlyingConditions !== null
      }
    },
    unavailable: (snapshot.softErrors || []).filter((e) => !e.critical).map((e) => e.key)
  };
}

// HPD's apartment field is typed in by hand, and this building's records carry
// several spellings of what are almost certainly the same apartments: `6O` and
// `60` (letter O vs digit zero), `1-N` and `1N` (stray hyphen).
//
// We do NOT silently merge them. Deciding that two labels in the City's record
// are really one apartment is a claim about the building, and the data does not
// support it. Instead: detect every collision, disclose them on the sources
// page, and flag loudly if one ever reaches the OPEN set, where it would
// inflate the headline "apartments affected" count. Today none do.
function normalizeApt(label) {
  if (!label) return null;
  return String(label).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/0$/, 'O');
}

function apartmentAmbiguity(all) {
  const group = (rows) => {
    const g = new Map();
    for (const v of rows) {
      if (!v.apartment) continue;
      const key = normalizeApt(v.apartment);
      if (!g.has(key)) g.set(key, new Set());
      g.get(key).add(v.apartment);
    }
    return g;
  };

  const toPairs = (g) =>
    [...g.entries()]
      .filter(([, labels]) => labels.size > 1)
      .map(([key, labels]) => ({ key, labels: [...labels].sort() }))
      .sort((a, b) => a.key.localeCompare(b.key));

  const pairs = toPairs(group(all));
  const affectingOpenCounts = toPairs(group(all.filter((v) => v.open)));
  return { pairs, affectingOpenCounts, hasAny: pairs.length > 0 };
}

function sortApt(a, b) {
  const pa = /^(\d+)(.*)$/.exec(a || '');
  const pb = /^(\d+)(.*)$/.exec(b || '');
  if (pa && pb) {
    const n = Number(pa[1]) - Number(pb[1]);
    if (n) return n;
    return pa[2].localeCompare(pb[2]);
  }
  return String(a).localeCompare(String(b));
}

function buildRecentActivity(all, today, windowDays = 120) {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - windowDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const events = all
    .filter((v) => v.statusDate && v.statusDate >= cutoff)
    .map((v) => ({
      date: v.statusDate,
      violationId: v.id,
      apartment: v.apartment,
      class: v.class,
      status: v.status,
      meaning: v.statusMeaning,
      category: v.categoryLabel,
      description: v.description,
      open: v.open
    }));

  const byDate = new Map();
  for (const e of events) {
    const g = byDate.get(e.date) || { date: e.date, events: [], statusCounts: new Map() };
    g.events.push(e);
    g.statusCounts.set(e.status, (g.statusCounts.get(e.status) || 0) + 1);
    byDate.set(e.date, g);
  }
  return [...byDate.values()]
    .map((g) => ({
      date: g.date,
      total: g.events.length,
      events: g.events.sort((a, b) => sortApt(a.apartment, b.apartment)),
      breakdown: [...g.statusCounts.entries()]
        .map(([status, count]) => ({ status, count, meaning: STATUS_MEANING[status] || null }))
        .sort((a, b) => b.count - a.count)
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function buildOwner(contacts) {
  const fmtAddr = (c) =>
    [
      [c.businesshousenumber, c.businessstreetname].filter(Boolean).join(' '),
      c.businessapartment ? `Unit ${c.businessapartment}` : null,
      [c.businesscity, c.businessstate, c.businesszip].filter(Boolean).join(', ')
    ]
      .filter(Boolean)
      .join(', ');

  const people = contacts.map((c) => ({
    type: c.type,
    typeLabel: (c.type || '').replace(/([a-z])([A-Z])/g, '$1 $2'),
    corporationName: c.corporationname || null,
    name: [c.firstname, c.middleinitial, c.lastname].filter(Boolean).join(' ') || null,
    address: fmtAddr(c)
  }));

  const corp = people.find((p) => p.type === 'CorporateOwner');
  const head = people.find((p) => p.type === 'HeadOfficer');
  const agent = people.find((p) => p.type === 'Agent');

  // HPD's litigation records show this owner under a transposed name too. Both
  // appear in City records for this building; neither is "the wrong one".
  const names = [...new Set(people.map((p) => p.corporationName).filter(Boolean))];

  return { contacts: people, corporateOwner: corp, headOfficer: head, agent, corporateNames: names };
}

function buildRegistration(rows, today) {
  const r = rows[0];
  if (!r) return { onFile: false };
  const end = d(r.registrationenddate);
  const last = d(r.lastregistrationdate);
  const expired = end ? end < today : null;
  return {
    onFile: true,
    registrationId: r.registrationid,
    lastFiled: last,
    endDate: end,
    expired,
    daysSinceExpiry: expired ? daysBetween(end, today) : null
  };
}

function buildLitigation(rows) {
  const cases = rows
    .map((r) => ({
      caseType: r.casetype || null,
      openedDate: d(r.caseopendate),
      status: r.casestatus || null,
      respondent: r.respondent || null,
      findingOfHarassment: r.findingofharassment || null,
      penalty: r.penalty || null
    }))
    .sort((a, b) => (b.openedDate || '').localeCompare(a.openedDate || ''));

  const tenantActions = cases.filter((c) => /TENANT ACTION/i.test(c.caseType || ''));
  const accessWarrants = cases.filter((c) => /ACCESS WARRANT/i.test(c.caseType || ''));
  return { cases, total: cases.length, tenantActions, accessWarrants };
}

function buildRodent(rows) {
  const inspections = rows
    .map((r) => ({
      date: d(r.inspection_date),
      type: r.inspection_type || null,
      result: r.result || null,
      failed: /FAIL|RAT ACTIVITY/i.test(r.result || '')
    }))
    .filter((r) => r.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    inspections,
    total: inspections.length,
    failures: inspections.filter((i) => i.failed),
    mostRecent: inspections[0] || null
  };
}

function buildComplaints(rows, today) {
  // One row per PROBLEM, and a complaint can carry several problems. Count
  // distinct complaint IDs, not rows, or the number is inflated several-fold.
  const byComplaint = new Map();
  for (const r of rows) {
    const id = r.complaint_id;
    if (!id) continue;
    const e = byComplaint.get(id) || {
      id,
      received: d(r.received_date),
      apartment: (r.apartment || '').trim() || null,
      status: r.complaint_status || null,
      problems: []
    };
    e.problems.push({
      major: r.major_category || null,
      minor: r.minor_category || null,
      code: r.problem_code || null,
      status: r.problem_status || null
    });
    byComplaint.set(id, e);
  }
  const complaints = [...byComplaint.values()].sort((a, b) => (b.received || '').localeCompare(a.received || ''));
  const yearAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);
  const lastYear = complaints.filter((c) => c.received && c.received >= yearAgo);

  const pestCount = complaints.filter((c) =>
    c.problems.some((p) => /PEST|VERMIN|ROACH|RODENT|MICE/i.test(`${p.major} ${p.minor} ${p.code}`))
  ).length;

  return {
    total: complaints.length,
    lastYearCount: lastYear.length,
    pestRelated: pestCount,
    open: complaints.filter((c) => /OPEN/i.test(c.status || '')).length,
    recent: complaints.slice(0, 40),
    earliest: complaints.length ? complaints[complaints.length - 1].received : null
  };
}

function buildServiceRequests(rows, today) {
  const yearAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);
  const reqs = rows
    .map((r) => ({
      date: d(r.created_date),
      complaintType: r.complaint_type || null,
      descriptor: r.descriptor || null,
      agency: r.agency || null,
      status: r.status || null
    }))
    .filter((r) => r.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  const pest = reqs.filter((r) => /RODENT|PEST|VERMIN|UNSANITARY/i.test(`${r.complaintType} ${r.descriptor}`));
  return {
    total: reqs.length,
    lastYearCount: reqs.filter((r) => r.date >= yearAgo).length,
    pestTotal: pest.length,
    pestLastYear: pest.filter((r) => r.date >= yearAgo).length,
    recent: reqs.slice(0, 30)
  };
}

// ---------------------------------------------------------------------------
// Department of Buildings -- a different agency, a different code
// ---------------------------------------------------------------------------
// DOB and ECB violations are NOT merged into the HPD count anywhere on this
// site. They are a separate regulator enforcing a separate body of law, and
// adding them together would produce a headline number that matches no
// official source and cannot be checked against one.
function dobDate(yyyymmdd) {
  const t = String(yyyymmdd || '').trim();
  if (!/^\d{8}$/.test(t)) return null;
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
}

// DOB's violation_type strings are concatenated code fragments -- "E-ELEVATOR
// ELEVATORREQUIRED" -- so group on the type code and give each a readable name.
const DOB_TYPE_LABELS = {
  E: 'Elevator',
  LBLVIO: 'Boiler \u2014 low pressure',
  LL6291: 'Boiler \u2014 Local Law 62/91',
  EGRADE: 'Energy grade not posted',
  AEUHAZ1: 'Failure to certify a Class 1 hazard',
  AEUHAZ2: 'Failure to certify a Class 2 hazard',
  BENCH: 'Energy benchmarking not filed',
  BOILER: 'Boiler',
  ELEVATOR: 'Elevator',
  FISP: 'Facade inspection',
  CONSTRUCTION: 'Construction'
};

function dobTypeLabel(row) {
  const code = (row.typeCode || '').toUpperCase().trim();
  if (DOB_TYPE_LABELS[code]) return DOB_TYPE_LABELS[code];
  const fromText = (row.type || '').split('-')[1];
  if (fromText) {
    const cleaned = fromText.replace(/\b(NONE|REQUIRED)\b/gi, '').replace(/\s+/g, ' ').trim();
    if (cleaned) return cleaned.charAt(0) + cleaned.slice(1).toLowerCase();
  }
  return code || 'Other';
}

function buildOtherAgencies(dobRows, ecbRows) {
  const available = dobRows !== null && ecbRows !== null;

  const dob = (dobRows || [])
    .map((r) => ({
      id: r.number || r.isn_dob_bis_viol,
      issued: dobDate(r.issue_date),
      category: r.violation_category || null,
      type: (r.violation_type || '').replace(/\s+/g, ' ').trim(),
      typeCode: r.violation_type_code || null,
      active: /ACTIVE/i.test(r.violation_category || '')
    }))
    .sort((a, b) => (a.issued || '').localeCompare(b.issued || ''));

  const ecb = (ecbRows || [])
    .map((r) => ({
      id: r.ecb_violation_number,
      issued: dobDate(r.issue_date),
      status: r.ecb_violation_status || null,
      severity: r.severity || null,
      type: r.violation_type || null,
      description: (r.violation_description || '').replace(/\s+/g, ' ').trim(),
      respondent: r.respondent_name || null,
      penaltyImposed: Number(r.penality_imposed || 0),
      balanceDue: Number(r.balance_due || 0),
      active: /ACTIVE/i.test(r.ecb_violation_status || '')
    }))
    .sort((a, b) => (a.issued || '').localeCompare(b.issued || ''));

  const dobActive = dob.filter((v) => v.active);
  const ecbActive = ecb.filter((v) => v.active);

  const groupTypes = (rows, keyFn) => {
    const m = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  };

  return {
    available,
    dob: {
      all: dob,
      active: dobActive,
      activeCount: dobActive.length,
      oldestActive: dobActive.find((v) => v.issued) || null,
      types: groupTypes(dobActive, dobTypeLabel)
    },
    ecb: {
      all: ecb,
      active: ecbActive,
      activeCount: ecbActive.length,
      oldestActive: ecbActive.find((v) => v.issued) || null,
      types: groupTypes(ecbActive, (r) => r.type || 'Other'),
      penaltiesImposed: ecbActive.reduce((n, v) => n + v.penaltyImposed, 0),
      balanceDue: ecbActive.reduce((n, v) => n + v.balanceDue, 0)
    }
  };
}

// ---------------------------------------------------------------------------
// Evictions -- counts only, never apartment numbers
// ---------------------------------------------------------------------------
// A housing violation is a record of the OWNER failing an obligation. An
// eviction is a record of the worst thing that happened to a NEIGHBOUR. The
// City publishes the apartment number; this site does not republish it. The
// building-level total carries the context without naming a household.
function buildEvictions(rows) {
  if (rows === null) return { available: false };
  const evs = (rows || [])
    .map((r) => ({
      date: d(r.executed_date),
      residential: /RESIDENTIAL/i.test(r.residential_commercial_ind || ''),
      ejectment: r.ejectment || null
      // eviction_apt_num is deliberately NOT carried through. See above.
    }))
    .filter((e) => e.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  const byYear = new Map();
  for (const e of evs) {
    const y = e.date.slice(0, 4);
    byYear.set(y, (byYear.get(y) || 0) + 1);
  }

  return {
    available: true,
    total: evs.length,
    residential: evs.filter((e) => e.residential).length,
    mostRecent: evs[0] ? evs[0].date : null,
    earliest: evs.length ? evs[evs.length - 1].date : null,
    byYear: [...byYear.entries()].map(([year, count]) => ({ year, count })).sort((a, b) => b.year.localeCompare(a.year))
  };
}
