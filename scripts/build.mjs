// Render data/latest.json into dist/. Pure function of the data on disk --
// running this twice on the same snapshot produces byte-identical output.

import { readFile, writeFile, mkdir, cp, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from './analyze.mjs';
import { layout, PAGES } from '../src/layout.mjs';
import { indexPage, violationsPage, changesPage, buildingPage, tenantsPage, dataPage } from '../src/pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const RENDERERS = {
  'index.html': indexPage,
  'violations.html': violationsPage,
  'changes.html': changesPage,
  'building.html': buildingPage,
  'tenants.html': tenantsPage,
  'data.html': dataPage
};

async function main() {
  const snapshot = JSON.parse(await readFile(path.join(ROOT, 'data', 'latest.json'), 'utf8'));
  const config = JSON.parse(await readFile(path.join(ROOT, 'config', 'building.json'), 'utf8'));
  const model = analyze(snapshot, config);

  // A label collision that reaches the open set would silently inflate the
  // headline apartment count. Say so in the build log rather than shipping it quietly.
  const inflating = model.apartmentAmbiguity.affectingOpenCounts;
  if (inflating.length) {
    console.warn(
      `[build] WARNING: HPD apartment-label collision now affects OPEN violations ` +
        `(${inflating.map((p) => p.labels.join('/')).join(', ')}). ` +
        `The "apartments affected" figure may be overstated. The sources page discloses this.`
    );
  }

  await rm(DIST, { recursive: true, force: true });
  await mkdir(path.join(DIST, 'assets'), { recursive: true });

  for (const page of PAGES) {
    const render = RENDERERS[page.file];
    if (!render) throw new Error(`No renderer for ${page.file}`);
    const { body, description } = render(model);
    const html = layout({ page, model, body, description });
    await writeFile(path.join(DIST, page.file), html, 'utf8');
    console.log(`[build] ${page.file.padEnd(18)} ${(html.length / 1024).toFixed(1)} KB`);
  }

  await cp(path.join(ROOT, 'src', 'assets'), path.join(DIST, 'assets'), { recursive: true });

  // Machine-readable summary, so the data is reusable without scraping the HTML.
  await writeFile(
    path.join(DIST, 'summary.json'),
    JSON.stringify(
      {
        building: { address: config.address, ...config.identifiers },
        asOf: model.date,
        generatedAt: model.generatedAt,
        summary: model.summary,
        categories: model.categories.map(({ key, label, count, apartments }) => ({ key, label, count, apartments })),
        statuses: model.statuses.map(({ status, count, apartments }) => ({ status, count, apartments })),
        registration: model.registration,
        openViolations: model.violations.open
      },
      null,
      2
    ),
    'utf8'
  );

  const snapshotCount = (await readdir(path.join(ROOT, 'data', 'snapshots')).catch(() => [])).filter((f) =>
    f.endsWith('.json')
  ).length;

  await writeFile(
    path.join(DIST, 'robots.txt'),
    'User-agent: *\nAllow: /\n\nSitemap: /sitemap.xml\n',
    'utf8'
  );
  await writeFile(
    path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      PAGES.map((p) => `  <url><loc>/${p.file}</loc><lastmod>${model.date}</lastmod></url>`).join('\n') +
      `\n</urlset>\n`,
    'utf8'
  );

  console.log(`[build] summary.json, robots.txt, sitemap.xml`);
  console.log(`[build] done — ${model.summary.openCount} open violations, data as of ${model.date}, ${snapshotCount} snapshot(s) archived`);
}

main().catch((err) => {
  console.error('[build] fatal:', err);
  process.exit(1);
});
