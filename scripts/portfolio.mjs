// The owner's wider portfolio.
//
// HPD publishes, for every registered building, the people named on that
// registration and the business address they gave. Matching on full name AND
// exact business address finds every other building where the same person is
// named. Counting open violations across those buildings is then arithmetic.
//
// This is expensive -- one query per building -- so it is strictly
// non-critical. On failure the site keeps the last known figures and says when
// they were taken. A stale portfolio number with an honest date is fine; a
// missing page section on a bad network day is not.
//
// IMPORTANT, and rendered on the page: being NAMED on a registration is not
// the same as owning the building. Ownership sits with separate LLCs. The page
// must never say "owns 61 buildings".

const HOST = 'https://data.cityofnewyork.us/resource';

async function getJson(url, timeout = 45_000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': '530parkside-public-record/1.0 (NYC Open Data reuse)' },
    signal: AbortSignal.timeout(timeout)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchPortfolio(cfg, log = () => {}) {
  const m = cfg.portfolio;
  if (!m || !m.enabled) return null;

  // 1. every registration contact with this surname
  const contacts = await getJson(
    `${HOST}/feu5-w2e2.json?lastname=${encodeURIComponent(m.matchName.lastname)}&$limit=5000`
  );

  // 2. narrow to the exact person: first name AND exact business address
  const mine = contacts.filter(
    (c) =>
      (c.firstname || '').toUpperCase() === m.matchName.firstname &&
      (c.businesshousenumber || '').trim() === m.matchBusinessHouseNumber &&
      (c.businessstreetname || '').includes(m.matchBusinessStreetContains)
  );

  const roles = {};
  const regs = new Map();
  for (const c of mine) {
    roles[c.type] = (roles[c.type] || 0) + 1;
    if (!regs.has(c.registrationid)) regs.set(c.registrationid, new Set());
    regs.get(c.registrationid).add(c.type);
  }
  const registrationIds = [...regs.keys()].filter(Boolean);
  log(`portfolio: ${registrationIds.length} registrations naming this person at this address`);

  // 3. violations per registration, sequential and tolerant
  const buildings = [];
  let openTotal = 0;
  let everTotal = 0;
  let failed = 0;

  for (const rid of registrationIds) {
    try {
      const rows = await getJson(`${HOST}/wvxf-dwi5.json?registrationid=${rid}&$limit=5000`);
      if (!rows.length) continue;
      const open = rows.filter((r) => (r.violationstatus || '').toUpperCase() === 'OPEN').length;
      const r0 = rows[0];
      buildings.push({
        registrationId: rid,
        address: `${r0.housenumber || ''} ${r0.streetname || ''}`.trim(),
        boro: r0.boro || null,
        zip: r0.zip || null,
        open,
        ever: rows.length,
        isThisBuilding: rid === cfg.identifiers.hpdRegistrationId
      });
      openTotal += open;
      everTotal += rows.length;
    } catch {
      failed++;
    }
  }

  if (failed > registrationIds.length / 4) {
    throw new Error(`${failed} of ${registrationIds.length} portfolio queries failed; refusing to publish a partial count`);
  }

  buildings.sort((a, b) => b.open - a.open);
  log(`portfolio: ${openTotal} open violations across ${buildings.length} buildings (${failed} query failures)`);

  return {
    asOf: new Date().toISOString(),
    person: `${m.matchName.firstname} ${m.matchName.lastname}`,
    businessAddress: `${m.matchBusinessHouseNumber} ${m.matchBusinessStreetContains}th Avenue, Brooklyn`,
    registrationCount: registrationIds.length,
    buildingsWithViolations: buildings.length,
    rolesNamed: roles,
    headOfficerCount: [...regs.values()].filter((s) => s.has('HeadOfficer')).length,
    agentCount: [...regs.values()].filter((s) => s.has('Agent')).length,
    openViolations: openTotal,
    everViolations: everTotal,
    queryFailures: failed,
    buildings
  };
}
