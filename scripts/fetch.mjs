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
      const rows = await socrata(src.id, src.query(b));
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

  const snapshot = { date, fetchedAt, identifiers: b, datasets, softErrors: errors };

  await mkdir(SNAPSHOTS, { recursive: true });
  const todayFile = `${date}.json`;
  const todayPath = path.join(SNAPSHOTS, todayFile);
  const latestPath = path.join(DATA, 'latest.json');

  // Re-running on the same day must not churn the archive. Every run carries a
  // fresh `fetchedAt`, so writing unconditionally would produce a commit on
  // every code push even when the City's data had not moved an inch. Compare
  // the datasets alone; the timestamp on a snapshot should be when that data
  // was FIRST seen that day, not when we last happened to look.
  const sameData = (a, c) => a && c && JSON.stringify(a.datasets) === JSON.stringify(c.datasets);
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
