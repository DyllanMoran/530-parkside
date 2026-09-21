// Pull every dataset fresh from NYC Open Data, write a dated snapshot.
//
// The snapshot archive is the point. Each day's file is a contemporaneous
// record of what the City's own database said on that date. Git history then
// shows exactly when a violation changed status, who closed it, and when.
// That is evidence, and nobody else keeps it.
//
// Fails loudly and writes nothing if a critical dataset can't be fetched.
// A stale site is recoverable; a site showing wrong numbers is not.

import { writeFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, SOCRATA_HOST } from './sources.mjs';
import { fetchPortfolio } from './portfolio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const SNAPSHOTS = path.join(DATA, 'snapshots');
const PAGE_SIZE = 5000;
const MAX_PAGES = 20;

const log = (...a) => console.log('[fetch]', ...a);

async function socrata(datasetId, params) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const qs = new URLSearchParams({
      ...params,
      $limit: String(PAGE_SIZE),
      $offset: String(page * PAGE_SIZE)
    });
    const url = `${SOCRATA_HOST}/resource/${datasetId}.json?${qs}`;
    const batch = await withRetry(() => getJson(url), `${datasetId} p${page}`);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': '530parkside-public-record/1.0 (NYC Open Data reuse)' },
    signal: AbortSignal.timeout(60_000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  const body = await res.json();
  if (!Array.isArray(body)) throw new Error(`Expected an array from ${url}`);
  return body;
}

async function withRetry(fn, label, attempts = 4) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts) break;
      const wait = 1000 * 2 ** (i - 1);
      log(`  ${label} failed (attempt ${i}/${attempts}): ${err.message}. retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastErr.message}`);
}

// ---------------------------------------------------------------------------
// Redaction at the source
// ---------------------------------------------------------------------------
// Some datasets carry fields that identify a household rather than a building,
// and the snapshot archive is PUBLIC and permanent -- committed to a public
// repository and published at /data/latest.json. Redacting at render time is
// not enough, and redacting in analyze.mjs is not enough either: the raw rows
// are what get archived.
//
// Evictions are the case in point. NYC publishes, for every eviction a Marshal
// carries out, the apartment number AND the court index number -- and a court
// index number leads directly to a named person in court records. A violation
// records an owner failing an obligation; an eviction records the worst thing
// that happened to a neighbour. Only the fields the site actually uses survive
// this function.
const REDACT = {
  evictions: (row) => ({
    executed_date: row.executed_date,
    residential_commercial_ind: row.residential_commercial_ind,
    borough: row.borough
    // DELIBERATELY DROPPED: eviction_apt_num, court_index_number, docket_number,
    // eviction_address, marshal_first_name, marshal_last_name, latitude,
    // longitude. Do not add them back.
  })
};

// ---------------------------------------------------------------------------
// Canonical ordering
// ---------------------------------------------------------------------------
// Socrata does not guarantee row order. The 311 dataset (erm2-nwe9) in
// particular returns the same 426 rows in a different order on every call, and
// rows are sparse, so two rows can carry different key sets.
//
// Without this, every run rewrites the snapshot and the git history fills with
// diffs that mean nothing. The archive's entire value is that a diff means the
// CITY's record changed -- so rows are sorted into a canonical order, and each
// row's keys are sorted too, before anything is written.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])])
    );
  }
  return value;
}

function stableRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows
    .map(canonical)
    .map((row) => [JSON.stringify(row), row])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, row]) => row);
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

function todayISO() {
  // America/New_York -- this is a New York building and the dates on the page
  // are New York dates. Running the job at 11:00 UTC would otherwise label a
  // snapshot with tomorrow's date half the year.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

async function previousSnapshot(todayFile) {
  if (!existsSync(SNAPSHOTS)) return null;
  const files = (await readdir(SNAPSHOTS))
    .filter((f) => f.endsWith('.json') && f !== todayFile)
    .sort();
  if (!files.length) return null;
  const latest = files[files.length - 1];
  try {
    return {
      name: latest,
      date: latest.replace('.json', ''),
      data: JSON.parse(await readFile(path.join(SNAPSHOTS, latest), 'utf8'))
    };
  } catch {
    return null;
  }
}

async function main() {
  const config = JSON.parse(await readFile(path.join(ROOT, 'config', 'building.json'), 'utf8'));
  const b = config.identifiers;
  const fetchedAt = new Date().toISOString();
  const date = todayISO();

  const datasets = {};
  const errors = [];

  for (const [key, src] of Object.entries(SOURCES)) {
    try {
      let rows = await socrata(src.id, src.query(b));
      if (REDACT[key]) rows = rows.map(REDACT[key]);
      rows = stableRows(rows);
      datasets[key] = rows;
      log(`${key} (${src.id}): ${rows.length} rows`);
    } catch (err) {
      const msg = `${key} (${src.id}): ${err.message}`;
      errors.push({ key, datasetId: src.id, critical: !!src.critical, message: err.message });
      if (src.critical) {
        log(`CRITICAL FAILURE -- ${msg}`);
      } else {
        log(`non-critical failure -- ${msg}`);
        datasets[key] = null;
      }
    }
  }

  // The portfolio is expensive and strictly optional. If it fails we keep the
  // previous result rather than dropping the section, and the page shows the
  // date the figures were taken.
  let portfolio = null;
  try {
    portfolio = await fetchPortfolio(config, (m) => log(m));
  } catch (err) {
    log(`portfolio unavailable this run (${err.message}) — keeping the previous figures`);
    errors.push({ key: 'portfolio', datasetId: 'feu5-w2e2+wvxf-dwi5', critical: false, message: err.message });
    try {
      const prevSnap = JSON.parse(await readFile(path.join(DATA, 'latest.json'), 'utf8'));
      portfolio = prevSnap.portfolio || null;
    } catch { /* first run, nothing to keep */ }
  }

  const criticalFailures = errors.filter((e) => e.critical);
  if (criticalFailures.length) {
    console.error(
      '\n[fetch] Refusing to write a snapshot. These critical datasets could not be fetched:\n' +
        criticalFailures.map((e) => `  - ${e.key} (${e.datasetId}): ${e.message}`).join('\n') +
        '\nThe previously published data stays live and unchanged.\n'
    );
    process.exit(1);
  }

  // Sanity floor. A successful HTTP 200 returning an empty violations array is
  // far more likely to mean the query silently stopped matching than that a
  // building with a decade of open violations suddenly has no record at all.
  if (!datasets.violations || datasets.violations.length < 50) {
    console.error(
      `\n[fetch] Refusing to write a snapshot: the violations query returned ` +
        `${datasets.violations ? datasets.violations.length : 0} rows, which is implausibly low ` +
        `for this building. Check whether the dataset's field names changed.\n`
    );
    process.exit(1);
  }

  const snapshot = { date, fetchedAt, identifiers: b, datasets, portfolio, softErrors: errors };

  await mkdir(SNAPSHOTS, { recursive: true });
  const todayFile = `${date}.json`;
  const todayPath = path.join(SNAPSHOTS, todayFile);
  const latestPath = path.join(DATA, 'latest.json');

  // Re-running on the same day must not churn the archive. Every run carries a
  // fresh `fetchedAt`, so writing unconditionally would produce a commit on
  // every code push even when the City's data had not moved an inch. Compare
  // the datasets alone; the timestamp on a snapshot should be when that data
  // was FIRST seen that day, not when we last happened to look.
  const stripAsOf = (p) => (p ? { ...p, asOf: undefined } : null);
  const sameData = (a, c) =>
    a && c &&
    JSON.stringify(a.datasets) === JSON.stringify(c.datasets) &&
    JSON.stringify(stripAsOf(a.portfolio)) === JSON.stringify(stripAsOf(c.portfolio));
  const existingToday = await readJson(todayPath);

  if (sameData(existingToday, snapshot)) {
    log(`snapshots/${todayFile} already holds today's data unchanged — leaving it alone`);
  } else {
    await writeFile(todayPath, JSON.stringify(snapshot), 'utf8');
    log(existingToday ? `snapshots/${todayFile} updated — the City's data changed today` : `wrote snapshots/${todayFile}`);
  }

  const existingLatest = await readJson(latestPath);
  if (sameData(existingLatest, snapshot) && existingLatest.date === snapshot.date) {
    log('latest.json unchanged');
  } else {
    await writeFile(latestPath, JSON.stringify(snapshot), 'utf8');
    log('latest.json updated');
  }

  const prev = await previousSnapshot(todayFile);
  if (prev) log(`previous snapshot on record: ${prev.date}`);
  if (errors.length) log(`${errors.length} non-critical dataset(s) unavailable; the page will say so.`);
}

main().catch((err) => {
  console.error('[fetch] fatal:', err);
  process.exit(1);
});
