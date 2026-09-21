// The page shell and the small set of components every page is built from.

// `file` is what lands in dist/. `href` is what pages link to: Cloudflare Pages
// serves extensionless URLs and 308-redirects the .html form, so linking to the
// bare name saves every internal navigation a redirect hop.
export const PAGES = [
  { file: 'index.html',      href: '/',            nav: 'The problem',  title: 'The public record of 530 Parkside Avenue' },
  { file: 'violations.html', href: '/violations',  nav: 'Violations',   title: 'Every violation on record' },
  { file: 'changes.html',    href: '/changes',     nav: 'What changed', title: 'What changed, and when' },
  { file: 'building.html',   href: '/building',    nav: 'Who owns it',  title: 'Who is responsible for this building' },
  { file: 'tenants.html',    href: '/tenants',     nav: 'If you live here', title: 'If you live at 530 Parkside' },
  { file: 'data.html',       href: '/data',        nav: 'Sources',      title: 'Where every number here comes from' }
];

export const HREF = Object.fromEntries(PAGES.map((p) => [p.file, p.href]));

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const attr = (s) => esc(s);

export const num = (n) => Number(n ?? 0).toLocaleString('en-US');

export function longDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y) return esc(iso);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric'
  });
}

export function shortDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y) return esc(iso);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric'
  });
}

export function years(days) {
  if (days == null) return '';
  const y = days / 365.25;
  if (y < 1) return `${Math.round(days)} days`;
  if (y < 2) return `over a year`;
  return `over ${Math.floor(y)} years`;
}

export const classBadge = (c) =>
  `<span class="badge ${esc((c || 'i').toLowerCase())}">Class ${esc(c || '?')}</span>`;

export function stat({ n, label, foot, tone }) {
  return `<div class="stat${tone ? ` ${esc(tone)}` : ''}">
      <span class="n">${esc(n)}</span>
      <span class="l">${label}</span>
      ${foot ? `<span class="foot">${foot}</span>` : ''}
    </div>`;
}

export const stats = (items) => `<div class="stats">${items.map(stat).join('')}</div>`;

export function table({ head, rows, className = '', id = '', wide = false }) {
  if (!rows.length) return '<p class="srcnote">No records.</p>';
  return `<div class="table-wrap${wide ? ' wide' : ''}"><table${id ? ` id="${attr(id)}"` : ''}${className ? ` class="${attr(className)}"` : ''}>
      <thead><tr>${head.map((h) => `<th${h.num ? ' class="num"' : ''}${h.wide ? ' class="col-desc"' : ''}>${esc(h.label ?? h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
}

export function callout(body, tone = '') {
  return `<div class="callout${tone ? ` ${esc(tone)}` : ''}">${body}</div>`;
}

export function sourceNote(label, url) {
  return `<p class="srcnote">Source: <a href="${attr(url)}" rel="noopener">${esc(label)}</a></p>`;
}

function nav(current) {
  return PAGES.map(
    (p) =>
      `<a href="${attr(p.href)}"${p.file === current ? ' aria-current="page"' : ''}>${esc(p.nav)}</a>`
  ).join('');
}

export function layout({ page, model, body, description }) {
  const cfg = model.config;
  const site = cfg.site;
  const asOf = longDate(model.date);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)} — ${esc(site.name)}</title>
<meta name="description" content="${attr(description || site.description)}">
<meta name="robots" content="index, follow">
<meta property="og:title" content="${attr(page.title)}">
<meta property="og:description" content="${attr(description || site.description)}">
<meta property="og:type" content="website">
<meta name="color-scheme" content="light dark">
<link rel="stylesheet" href="/assets/styles.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F3E2}</text></svg>">
<script>
  // Set the theme before first paint so there is no flash.
  try {
    var t = localStorage.getItem('theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/">${esc(site.name)} <span>· public record</span></a>
    <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch between light and dark">Theme</button>
    <nav class="main" aria-label="Main">${nav(page.file)}</nav>
  </div>
</header>
<main id="main" class="wrap">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="disclaimer">
      <p><strong>Not affiliated with, endorsed by, or speaking for</strong> the owner of this building,
      any managing agent, or the City of New York. This is a tenant-run page that republishes public
      records.</p>
      <p><strong>Not legal advice.</strong> It is organized public information. If you need advice
      about your own apartment, the free sources on the
      <a href="/tenants">If you live here</a> page are the place to start.</p>
    </div>
    <p><strong>Corrections.</strong> ${esc(cfg.corrections.promise)}</p>
    <p><strong>If you live here and want your apartment number off this page,</strong>
    ${esc(cfg.corrections.removalPromise.replace(/^If you live here and would rather your apartment number not appear, /, ''))}</p>
    <p>Every figure on this site is generated from the City of New York’s own open-data records and
    rebuilt automatically every day. Data as published by the City on <strong>${esc(asOf)}</strong>.
    See <a href="/data">Sources</a> for every dataset used and how the numbers are counted.</p>
    <p class="srcnote">Built ${esc(model.generatedAt)}</p>
  </div>
</footer>
<script src="/assets/app.js" defer></script>
</body>
</html>`;
}
