// The six pages.
//
// Writing rule for everything below: state what the record says, cite it, date
// it, and stop. Where a record is ambiguous, say so on the page rather than
// resolving it in our favour. Nothing here describes what anyone intended.

import {
  esc, attr, num, longDate, shortDate, years, classBadge,
  stats, table, callout, sourceNote
} from './layout.mjs';
import { SOURCES } from '../scripts/sources.mjs';

const ds = (k) => SOURCES[k];
const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const dsLink = (k) => `<a href="${attr(ds(k).url)}" rel="noopener">${esc(ds(k).label)}</a>`;

// ===========================================================================
// 1. The problem
// ===========================================================================
export function indexPage(m) {
  const s = m.summary;
  const p = m.pests;
  const noAccess = m.statuses.find((x) => /FIRST NO ACCESS/i.test(x.status));
  const notComplied = m.statuses.find((x) => /NOT COMPLIED/i.test(x.status));

  const catRows = m.categories
    .map(
      (c) => `<tr>
        <td><strong>${esc(c.label)}</strong></td>
        <td class="num">${num(c.count)}</td>
        <td>${c.apartments.length ? c.apartments.map((a) => `<span class="badge plain">${esc(a)}</span>`).join(' ') : '<span class="srcnote">building-wide / public area</span>'}</td>
      </tr>`
    )
    .join('');

  const pestRows = p.history
    .map((v) => {
      const gone = !v.open;
      return `<tr>
        <td class="nowrap"><strong>${esc(v.apartment || 'Public area')}</strong></td>
        <td class="nowrap">${classBadge(v.class)}</td>
        <td>${esc(v.categoryLabel)}</td>
        <td class="nowrap">${shortDate(v.inspected)}</td>
        <td>${gone
            ? `<span class="srcnote">${esc(v.status)} · ${shortDate(v.statusDate)}</span>`
            : `<span class="overdue">Open</span> · ${v.overdueDays ? `${num(v.overdueDays)} days past deadline` : 'within deadline'}`}</td>
      </tr>`;
    })
    .join('');

  const aptRows = m.apartmentRollup
    .map(
      (a) => `<tr>
      <td class="nowrap"><strong>${esc(a.apartment)}</strong></td>
      <td class="num">${num(a.count)}</td>
      <td class="num">${a.classC ? `<span class="overdue">${num(a.classC)}</span>` : '0'}</td>
      <td class="nowrap">${shortDate(a.oldest)}</td>
      <td>${esc(a.categories.join(', '))}</td>
    </tr>`
    )
    .join('');

  return {
    description: `${num(s.openCount)} open housing violations at 530 Parkside Avenue, Brooklyn, ${s.pastDeadlinePct}% of them past the City's own repair deadline. Rebuilt daily from NYC Open Data.`,
    body: `
<div class="hero">
  <h1>${num(s.openCount)} open violations at 530 Parkside Avenue</h1>
  <p class="lede">Every one of them is past the repair deadline the City of New York set for
  the owner. This page is built automatically from the City’s own records and rebuilt every day.</p>
  <p class="asof">Data as published by the City on <strong>${esc(longDate(m.date))}</strong></p>
</div>

${stats([
  { n: num(s.openCount), label: 'Open violations right now', foot: `of ${num(s.totalOnRecord)} ever recorded` },
  { n: num(s.classCCount), label: 'Class C — immediately hazardous', tone: 'sev-c', foot: 'the City’s most serious class' },
  { n: `${s.pastDeadlinePct}%`, label: 'Past the City’s repair deadline', tone: 'alarm', foot: `${num(s.pastDeadlineCount)} of ${num(s.openCount)}` },
  { n: num(s.apartmentsAffected), label: 'Apartments with open violations', foot: `of ${num(m.config.units)} in the building` }
])}

<section>
  <h2>What is actually wrong</h2>
  <p class="sub">Open violations grouped by condition. Each is a separate finding by a City
  inspector who came to the building and wrote it up.</p>
  ${table({
    head: ['Condition', { label: 'Open', num: true }, 'Apartments'],
    rows: [catRows]
  })}
  ${sourceNote(ds('violations').label, ds('violations').url)}
</section>

<section>
  <h2>The pest problem is ${esc(years(p.oldestOpenDays))} old</h2>
  <p class="sub">Cockroaches, mice and rats have been under open, uncorrected City violation in
  this building continuously since ${esc(longDate(p.oldestOpen && p.oldestOpen.inspected))}.
  Right now ${num(p.open.length)} pest violations are open across
  ${num(p.openApartments.length)} apartments: ${esc(p.openApartments.join(', '))}.</p>

  ${callout(`<h3>Why this cannot be fixed one apartment at a time</h3>
    <p>Roaches and mice travel through the shared walls, pipe risers and voids that connect
    every apartment in a building. Treating one unit while the units around it stay infested
    does not end an infestation — it moves it. That is the reasoning behind the City’s own
    rule, <a href="https://www.nyc.gov/site/hpd/services-and-information/asthma-free-housing-act.page" rel="noopener">Local
    Law 55 of 2018</a>, which requires owners of buildings with three or more units to use
    integrated pest management and to seal the gaps pests travel through, rather than simply
    spraying on complaint.</p>`)}

  ${table({
    head: ['Apartment', 'Class', 'Pest', 'First inspected', 'Where it stands'],
    rows: [pestRows]
  })}
  ${sourceNote(ds('violations').label, ds('violations').url)}
</section>

<section>
  <h2>Where these violations stand with the City</h2>
  <p class="sub">HPD records a status for every open violation. This is what those statuses say
  today, in the City’s own words, with a plain-English note on what each one means.</p>
  ${m.statuses
    .map(
      (st) => `<div class="callout calm">
        <h3>${num(st.count)} · <span style="font-family:var(--mono);font-size:0.9rem">${esc(st.status)}</span></h3>
        ${st.meaning ? `<p>${esc(st.meaning)}</p>` : ''}
        ${st.apartments.length ? `<p class="srcnote">Apartments: ${esc(st.apartments.join(', '))}</p>` : ''}
      </div>`
    )
    .join('')}

  ${noAccess
      ? callout(`<h3>${num(noAccess.count)} violations are stalled because HPD could not get in</h3>
      <p>An inspector came back to re-inspect ${esc(noAccess.apartments.join(', '))} and could not
      gain access. After a second failed attempt a violation can be dismissed without the
      condition ever having been repaired — the record closes, the problem does not.</p>
      <p><strong>If you live in one of these apartments:</strong> watch your mail for an HPD
      inspection date and be home for it. If the date does not work, call and reschedule rather
      than miss it. Details on the <a href="/tenants">If you live here</a> page.</p>`, 'urgent')
      : ''}

  ${notComplied
      ? callout(`<h3>${num(notComplied.count)} have been re-inspected and found still broken</h3>
      <p><span style="font-family:var(--mono)">NOT COMPLIED WITH</span> is HPD’s finding after
      an inspector returned to the apartment and saw the condition still there. These are not
      unverified complaints. A City inspector looked, twice.</p>
      <p class="srcnote">Apartments: ${esc(notComplied.apartments.join(', '))}</p>`)
      : ''}
</section>

<section>
  <h2>Apartment by apartment</h2>
  <p class="sub">Only apartments with at least one open violation appear here. An apartment
  missing from this list has no open violation on the City’s record — which is not the same
  as having no problem, since a condition nobody reported to the City never becomes a
  violation.</p>
  ${table({
    head: ['Apt', { label: 'Open', num: true }, { label: 'Class C', num: true }, 'Oldest', 'Conditions'],
    rows: [aptRows]
  })}
  <p class="srcnote">If you live here and would rather your apartment number not appear on this
  page, say so and it will be removed. No reason needed.</p>
</section>

<section>
  <h2>HPD is not the only agency with open violations here</h2>
  <p class="sub">The Department of Buildings enforces a separate body of law covering elevators,
  boilers and structural safety. Its violations are counted separately everywhere on this site
  and never folded into the HPD figures above — they are a different regulator applying a
  different code.</p>

  ${m.otherAgencies.available
      ? stats([
          { n: num(m.otherAgencies.dob.activeCount), label: 'Active Department of Buildings violations', foot: m.otherAgencies.dob.oldestActive ? `oldest issued ${shortDate(m.otherAgencies.dob.oldestActive.issued)}` : '' },
          { n: num(m.otherAgencies.ecb.activeCount), label: 'Active violations carrying a City penalty' },
          { n: money(m.otherAgencies.ecb.balanceDue), label: 'In City penalties imposed and still unpaid', tone: 'alarm' }
        ])
      : '<p class="srcnote">The Department of Buildings datasets were unavailable when this page was last built.</p>'}

  ${m.otherAgencies.available && m.otherAgencies.dob.types.length
      ? `<div class="table-wrap"><table>
          <thead><tr><th>Active DOB violation</th><th class="num">Count</th></tr></thead>
          <tbody>${m.otherAgencies.dob.types
            .map((t) => `<tr><td><strong>${esc(t.label)}</strong></td><td class="num">${num(t.count)}</td></tr>`)
            .join('')}</tbody>
        </table></div>`
      : ''}

  ${m.otherAgencies.available && m.otherAgencies.ecb.activeCount
      ? callout(`<h3>Most of the penalties are elevator violations, and they are the most serious class</h3>
      <p>${num(m.otherAgencies.ecb.types.find((t) => /elevator/i.test(t.label))?.count || 0)} of the
      ${num(m.otherAgencies.ecb.activeCount)} active penalty violations at this address are elevator
      violations. The City records ${money(m.otherAgencies.ecb.penaltiesImposed)} in penalties imposed
      on these, of which <strong>${money(m.otherAgencies.ecb.balanceDue)} is recorded as still
      outstanding</strong>.</p>
      <p>This is a six-storey building with ${num(m.config.units)} apartments. Full detail, with dates
      and penalty amounts, is on the <a href="/building">Who owns it</a> page.</p>`)
      : ''}
  ${sourceNote(ds('dobViolations').label, ds('dobViolations').url)}
  ${sourceNote(ds('ecbViolations').label, ds('ecbViolations').url)}
</section>

<section>
  <h2>What this page is for</h2>
  <p>Everything here is public. It has always been public. But it is scattered across at least
  nine separate City databases, none of which talk to each other, and each of which needs a
  different identifier to query. Almost nobody has the time to assemble it.</p>
  <p>So this page assembles it, in one place, and rebuilds itself every day — for whoever needs
  it. A tenant deciding whether their problem is theirs alone. A property manager who wants the
  real list. The owner, who may genuinely not have seen it laid out like this. A City inspector,
  a reporter, a judge.</p>
  <p>It takes no position on anyone’s intentions. It reports what the City of New York has
  written down, with the date it was written and a link to the source. Where the record is
  ambiguous, this page says so rather than guessing.</p>
</section>
`
  };
}

// ===========================================================================
// 2. Violations
// ===========================================================================
export function violationsPage(m) {
  const list = [...m.violations.all].sort((a, b) => {
    if (a.open !== b.open) return a.open ? -1 : 1;
    return (b.inspected || '').localeCompare(a.inspected || '');
  });

  const cats = [...new Set(list.map((v) => v.categoryLabel))].sort();
  const apts = [...new Set(list.map((v) => v.apartment).filter(Boolean))].sort();

  const rows = list
    .map(
      (v) => `<tr data-open="${v.open ? 'open' : 'closed'}" data-cls="${attr(v.class)}" data-cat="${attr(v.categoryLabel)}" data-apt="${attr(v.apartment || '')}" data-search="${attr(`${v.apartment || ''} ${v.class} ${v.categoryLabel} ${v.description} ${v.status} ${v.id}`)}">
      <td class="nowrap"><strong>${esc(v.apartment || 'Public')}</strong></td>
      <td class="nowrap">${classBadge(v.class)}</td>
      <td class="nowrap">${esc(v.categoryLabel)}</td>
      <td>
        <span class="desc">${esc(v.description)}</span>
        <span class="vid">Violation ${esc(v.id)}</span>
      </td>
      <td class="nowrap">${shortDate(v.inspected)}</td>
      <td class="nowrap">${shortDate(v.correctBy)}</td>
      <td class="nowrap">
        ${v.open
          ? `<span class="overdue">OPEN</span>`
          : `<span class="srcnote">closed</span>`}<br>
        <span class="vid">${esc(v.status || '')}</span><br>
        <span class="vid">${shortDate(v.statusDate)}</span>
      </td>
      <td class="num">${v.overdueDays ? `<span class="overdue">${num(v.overdueDays)}</span>` : '—'}</td>
    </tr>`
    )
    .join('');

  return {
    description: `Every housing violation on record for 530 Parkside Avenue, Brooklyn — ${num(m.violations.total)} in total, ${num(m.summary.openCount)} of them still open. Searchable and filterable.`,
    body: `
<div class="hero">
  <h1>Every violation on record</h1>
  <p class="lede">All ${num(m.violations.total)} housing violations the City has ever issued for
  this building, open and closed. ${num(m.summary.openCount)} are open today.</p>
  <p class="asof">Data as published by the City on <strong>${esc(longDate(m.date))}</strong></p>
</div>

<section>
  <div class="filters" data-filter-for="viol-table">
    <input type="search" placeholder="Search conditions, apartments, violation IDs…" aria-label="Search violations">
    <label>Status
      <select data-facet="open" aria-label="Filter by status">
        <option value="">All</option>
        <option value="open" selected>Open only</option>
        <option value="closed">Closed only</option>
      </select>
    </label>
    <label>Class
      <select data-facet="cls" aria-label="Filter by class">
        <option value="">All</option>
        <option value="C">C — immediately hazardous</option>
        <option value="B">B — hazardous</option>
        <option value="A">A — non-hazardous</option>
      </select>
    </label>
    <label>Condition
      <select data-facet="cat" aria-label="Filter by condition">
        <option value="">All</option>
        ${cats.map((c) => `<option value="${attr(c)}">${esc(c)}</option>`).join('')}
      </select>
    </label>
    <label>Apartment
      <select data-facet="apt" aria-label="Filter by apartment">
        <option value="">All</option>
        ${apts.map((a) => `<option value="${attr(a)}">${esc(a)}</option>`).join('')}
      </select>
    </label>
  </div>
  <p class="result-count" data-count-for="viol-table"></p>

  ${table({
    id: 'viol-table',
    wide: true,
    head: [
      'Apt', 'Class', 'Condition', { label: 'What the inspector wrote', wide: true }, 'Inspected',
      'Repair due', 'Status', { label: 'Days late', num: true }
    ],
    rows: [rows]
  })}
  ${sourceNote(ds('violations').label, ds('violations').url)}
</section>

<section>
  <h2>How to read this</h2>
  <p><strong>Class</strong> is how serious the City considers the condition.
  <strong>Class C</strong> is immediately hazardous — the most serious class HPD issues, used
  for things like infestation, no heat, and lead paint. <strong>Class B</strong> is hazardous.
  <strong>Class A</strong> is non-hazardous.</p>
  <p><strong>Repair due</strong> is the date the City ordered the owner to have the condition
  fixed by. <strong>Days late</strong> counts from that date to today, for violations still open.</p>
  <p><strong>Status</strong> is HPD’s own wording, shown unaltered. One word of caution about
  it: <span style="font-family:var(--mono);font-size:0.9rem">VIOLATION CLOSED</span> does not
  distinguish between a condition that was repaired and one that was dismissed for other reasons,
  including an inspector being unable to get into the apartment. The City’s record does not say
  which, so neither does this page.</p>
  <p><strong>What the inspector wrote</strong> is HPD’s violation text, reproduced as issued,
  with one exception: where the text describes the household rather than the building — the
  lead-paint formula naming a child under six — that clause is removed and the removal is
  marked. The violation itself, its apartment, class, date and ID are all still shown. See
  <a href="/data">Sources</a>.</p>
</section>
`
  };
}

// ===========================================================================
// 3. What changed
// ===========================================================================
export function changesPage(m) {
  const days = m.recentActivity;

  const dayBlocks = days
    .map((d) => {
      const rows = d.events
        .map(
          (e) => `<tr>
          <td class="nowrap"><strong>${esc(e.apartment || 'Public')}</strong></td>
          <td class="nowrap">${classBadge(e.class)}</td>
          <td class="nowrap">${esc(e.category)}</td>
          <td><span class="vid">${esc(e.status)}</span></td>
          <td><span class="desc">${esc(e.description)}</span></td>
        </tr>`
        )
        .join('');
      return `<div class="day">
        <div class="d">${esc(longDate(d.date))}</div>
        <div class="headline">${num(d.total)} violation${d.total === 1 ? '' : 's'} changed status.
          ${esc(d.breakdown.map((b) => `${b.count} × ${b.status}`).join(' · '))}</div>
        ${d.breakdown
          .filter((b) => b.meaning)
          .map((b) => `<p class="srcnote">${esc(b.status)}: ${esc(b.meaning)}</p>`)
          .join('')}
        ${table({ head: ['Apt', 'Class', 'Condition', 'New status', 'Violation'], rows: [rows] })}
      </div>`;
    })
    .join('');

  return {
    description: 'A dated record of every change to 530 Parkside Avenue’s violation status, kept daily so the history cannot quietly change.',
    body: `
<div class="hero">
  <h1>What changed, and when</h1>
  <p class="lede">City records get rewritten. Violations close, statuses flip, and the database
  keeps only the current value. This page keeps the history.</p>
  <p class="asof">Data as published by the City on <strong>${esc(longDate(m.date))}</strong></p>
</div>

${callout(`<h3>Why this page exists</h3>
  <p>HPD’s database stores one status per violation — whatever it is today. When a violation
  closes, the record simply says closed. There is no public log of what it said last week.</p>
  <p>So this site saves a complete, dated copy of the City’s record every single day, and keeps
  every copy. Each day’s file is a snapshot of what the City itself published on that date,
  committed to a public archive that anyone can inspect and nobody here can silently revise.</p>`, 'calm')}

<section>
  <h2>Recent activity</h2>
  <p class="sub">Every violation whose status changed in the last 120 days, grouped by the day it
  changed. This comes from HPD’s own status-date field, so it covers the period before this site
  began keeping snapshots.</p>
  ${days.length ? dayBlocks : '<p class="srcnote">No status changes recorded in the last 120 days.</p>'}
  ${sourceNote(ds('violations').label, ds('violations').url)}
</section>

<section>
  <h2>The daily archive</h2>
  <p>Every snapshot this site has taken is committed to its public repository under
  <span style="font-family:var(--mono);font-size:0.9rem">data/snapshots/</span>, one file per
  day, named by date. Each file is the complete raw response from the City’s servers — not a
  summary, not this site’s interpretation of it.</p>
  <p>That means anyone can check this page’s arithmetic against the City’s own data as it stood
  on any given day, and anyone can see if a figure here ever changed without explanation.</p>
</section>
`
  };
}

// ===========================================================================
// 4. Who owns it
// ===========================================================================
export function buildingPage(m) {
  const o = m.owner;
  const reg = m.registration;
  const cfg = m.config;
  const posted = cfg.responsibleParties.providedToTenants;

  const card = (role, name, meta, src) => `<div class="contact-card">
    <div class="role">${esc(role)}</div>
    <div class="name">${esc(name)}</div>
    ${meta ? `<div class="meta">${meta}</div>` : ''}
    <div class="src">${src}</div>
  </div>`;

  const hpdSrc = `Filed by the owner with the City of New York as required by
    <a href="https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-61206" rel="noopener">NYC
    Admin. Code § 27-2098</a>, and published by HPD as ${dsLink('contacts')}.
    Registration ID ${esc(cfg.identifiers.hpdRegistrationId)}.`;

  const contactCards = o.contacts
    .map((c) =>
      card(
        c.typeLabel,
        c.corporationName || c.name || 'Not stated',
        [c.corporationName && c.name ? esc(c.name) : null, esc(c.address)].filter(Boolean).join('<br>'),
        hpdSrc
      )
    )
    .join('');

  const litRows = m.litigation.cases
    .map(
      (c) => `<tr>
      <td class="nowrap">${shortDate(c.openedDate)}</td>
      <td>${esc(c.caseType || '—')}</td>
      <td>${esc(c.respondent || '—')}</td>
      <td class="nowrap"><span class="vid">${esc(c.status || '—')}</span></td>
    </tr>`
    )
    .join('');

  const rodentRows = m.rodent.inspections
    .map(
      (r) => `<tr>
      <td class="nowrap">${shortDate(r.date)}</td>
      <td>${esc(r.type || '—')}</td>
      <td>${r.failed ? `<span class="overdue">${esc(r.result)}</span>` : esc(r.result || '—')}</td>
    </tr>`
    )
    .join('');

  return {
    description: 'Who owns 530 Parkside Avenue, Brooklyn, according to the City’s own registration record — plus the building’s court history and inspection record.',
    body: `
<div class="hero">
  <h1>Who is responsible for this building</h1>
  <p class="lede">New York City requires the owner of every apartment building to file who they
  are, and makes it public, so that tenants know who is accountable. This is that filing.</p>
  <p class="asof">Data as published by the City on <strong>${esc(longDate(m.date))}</strong></p>
</div>

<section>
  <h2>The registered owner</h2>
  <p class="sub">Reproduced exactly as the owner filed it with HPD. Addresses shown are business
  addresses, as filed — they are the addresses the law designates for receiving legal notice
  about this building.</p>
  ${contactCards}

  ${o.corporateNames.length > 1 || true
      ? callout(`<h3>One owner, two names on the City’s records</h3>
      <p>HPD’s registration record names <strong>${esc(o.corporateOwner?.corporationName || '—')}</strong>.
      HPD’s litigation records for this same building also use the transposed form
      <strong>530 Parkside LLC</strong>. Both appear in City records for this address. This is
      noted because anyone trying to look this building up, or serve papers on its owner, will
      run into both spellings.</p>`, 'calm')
      : ''}
</section>

<section>
  <h2>Who the building tells tenants to contact</h2>
  ${posted.enabled && posted.entries.some((e) => e.name || e.phone)
      ? `<p class="sub">These are the people the building itself directs tenants to. Where a name
        here differs from HPD's registration record above, that difference is noted — it is not an
        accusation, but it is the kind of thing a tenant trying to get a repair needs to know.</p>
        ${posted.entries
          .filter((e) => e.name || e.phone)
          .map((e) => `<div class="contact-card">
            <div class="role">${esc(e.role)}${e.company ? ` · ${esc(e.company)}` : ''}</div>
            <div class="name">${esc(e.name || 'Name not given')}</div>
            <div class="meta">
              ${e.phone ? `<a href="tel:${attr(e.phone.replace(/[^0-9+]/g, ''))}">${esc(e.phone)}</a>` : ''}
              ${e.email ? `${e.phone ? ' · ' : ''}<a href="mailto:${attr(e.email)}">${esc(e.email)}</a>` : ''}
              ${e.address ? `<br>${esc(e.address)}` : ''}
            </div>
            ${e.notes ? `<div class="meta" style="margin-top:6px;color:var(--ink-3);font-size:0.85rem">${esc(e.notes)}</div>` : ''}
            <div class="src">${esc(posted.sourceCitation)}${posted.transcribedOn ? ` Transcribed ${esc(longDate(posted.transcribedOn))}.` : ''}</div>
          </div>`)
          .join('')}
        ${callout(`<h3>Where this came from, and why that matters</h3>
        <p>Everything else on this site comes from a government dataset. This section does not. It
        is transcribed from a contact sheet the building gives to its own tenants, and it is
        published here because the City's registration record does not name the people who
        actually manage this building — it names one individual as owner, agent and site manager,
        and names no superintendent at all.</p>
        <p>New York requires an owner to post the superintendent's name, address and telephone
        number in the entrance hall, under
        <a href="https://www.nyc.gov/site/hpd/services-and-information/required-signage.page" rel="noopener">Admin.
        Code § 27-2104 and 28 RCNY § 25-81</a>. This information is meant to be available to
        every tenant.</p>
        <p>If you are named here and something is wrong — or you are no longer in this role —
        write to us and it will be corrected or removed, with the date of the change shown.</p>`, 'calm')}`
      : ''}
</section>

<section>
  <h2>Annual registration</h2>
  <p class="sub">Every owner of a multiple dwelling in New York City must file a registration
  statement with HPD each year by 1 September.</p>
  ${reg.onFile
      ? stats([
          { n: esc(shortDate(reg.lastFiled)), label: 'Last registration filed' },
          { n: esc(shortDate(reg.endDate)), label: 'Registration valid through', tone: reg.expired ? 'sev-c' : '' },
          {
            n: reg.expired ? `${num(reg.daysSinceExpiry)}` : 'Current',
            label: reg.expired ? 'Days past the registration end date with no renewal on record' : 'Registration status',
            tone: reg.expired ? 'alarm' : ''
          }
        ])
      : '<p class="srcnote">No registration record found.</p>'}

  ${reg.expired
      ? callout(`<h3>No renewal appears on the City’s record</h3>
      <p>The most recent registration on file ended
      <strong>${esc(longDate(reg.endDate))}</strong>, ${num(reg.daysSinceExpiry)} days ago, and
      HPD’s published dataset shows no renewal since.</p>
      <p><strong>This may be a lag in the data rather than a missed filing.</strong> HPD’s open
      dataset does not always reflect a registration the same day it is filed. That caveat stays
      on this page until a renewal appears in the data or the owner tells us one was filed —
      in which case we will correct this section and say so.</p>
      <p>If it is accurate, it matters: under
      <a href="https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-61206" rel="noopener">NYC
      Admin. Code § 27-2107</a>, an owner who has not filed a required registration statement is
      denied the right to recover possession of premises for nonpayment of rent during the period
      of non-compliance.</p>`)
      : ''}
  ${sourceNote(ds('registrations').label, ds('registrations').url)}
</section>

<section>
  <h2>Court history</h2>
  <p class="sub">${num(m.litigation.total)} cases involving this building appear in HPD’s
  litigation record, including ${num(m.litigation.tenantActions.length)} tenant actions and
  ${num(m.litigation.accessWarrants.length)} access warrants. An access warrant is a court order
  the City obtains when it cannot otherwise get into a building to inspect it.</p>
  ${table({ head: ['Opened', 'Case type', 'Respondent', 'Status'], rows: [litRows] })}
  ${sourceNote(ds('litigation').label, ds('litigation').url)}
</section>

<section>
  <h2>A second City agency has inspected this building for vermin</h2>
  <p class="sub">The Department of Health runs its own rodent inspection programme, entirely
  separate from HPD’s violations. It has inspected this building
  ${num(m.rodent.total)} times, and ${num(m.rodent.failures.length)} of those inspections were
  recorded as failures for rat activity.</p>
  ${table({ head: ['Date', 'Inspection type', 'Result'], rows: [rodentRows] })}
  ${sourceNote(ds('rodent').label, ds('rodent').url)}
</section>

<section>
  <h2>Complaints to the City about this address</h2>
  ${stats([
    { n: num(m.complaints.total), label: 'HPD complaints on record', foot: m.complaints.earliest ? `since ${shortDate(m.complaints.earliest)}` : '' },
    { n: num(m.complaints.pestRelated), label: 'HPD complaints about pests or vermin' },
    { n: num(m.serviceRequests.total), label: '311 service requests' },
    { n: num(m.serviceRequests.pestTotal), label: '311 requests about pests or unsanitary conditions' }
  ])}
  <p>A complaint is not a violation. It is a resident telling the City something is wrong.
  Some complaints lead to an inspection and a violation; many do not. The volume is shown here
  because it is the clearest available measure of how often people living at this address have
  asked the City for help.</p>
  ${sourceNote(ds('complaints').label, ds('complaints').url)}
  ${sourceNote(ds('serviceRequests').label, ds('serviceRequests').url)}
</section>

<section>
  <h2>Department of Buildings violations</h2>
  <p class="sub">A separate agency enforcing a separate code — elevators, boilers, structural
  safety. These are never added to the HPD totals elsewhere on this site.</p>

  ${m.otherAgencies.available
      ? `${stats([
          { n: num(m.otherAgencies.dob.activeCount), label: 'Active DOB violations' },
          { n: num(m.otherAgencies.ecb.activeCount), label: 'Active violations carrying a penalty' },
          { n: money(m.otherAgencies.ecb.penaltiesImposed), label: 'Penalties imposed' },
          { n: money(m.otherAgencies.ecb.balanceDue), label: 'Recorded as still unpaid', tone: 'alarm' }
        ])}

      <h3>Active DOB violations</h3>
      ${table({
        head: ['Issued', 'Type', 'What DOB recorded'],
        rows: [m.otherAgencies.dob.active
          .map((v) => `<tr>
            <td class="nowrap">${shortDate(v.issued)}</td>
            <td class="nowrap">${esc(v.typeCode || '\u2014')}</td>
            <td><span class="desc">${esc(v.type)}</span></td>
          </tr>`)
          .join('')]
      })}
      ${m.otherAgencies.dob.oldestActive
        ? callout(`<p>The oldest violation still recorded as active was issued
          <strong>${esc(longDate(m.otherAgencies.dob.oldestActive.issued))}</strong> —
          ${esc(years(Math.round((Date.parse(m.date) - Date.parse(m.otherAgencies.dob.oldestActive.issued)) / 86400000)))}
          ago — for: ${esc(m.otherAgencies.dob.oldestActive.type)}.</p>`, 'calm')
        : ''}
      ${sourceNote(ds('dobViolations').label, ds('dobViolations').url)}

      <h3>Violations carrying a City penalty</h3>
      <p>These are heard before the Office of Administrative Trials and Hearings, which can impose
      a fine. The balance column is the amount the City's record shows as still outstanding.</p>
      ${table({
        wide: true,
        head: ['Issued', 'Type', 'Severity', { label: 'What the inspector recorded', wide: true }, { label: 'Imposed', num: true }, { label: 'Still due', num: true }],
        rows: [m.otherAgencies.ecb.active
          .map((v) => `<tr>
            <td class="nowrap">${shortDate(v.issued)}</td>
            <td class="nowrap"><strong>${esc(v.type || '\u2014')}</strong></td>
            <td class="nowrap"><span class="vid">${esc(v.severity || '\u2014')}</span></td>
            <td><span class="desc">${esc(v.description || '\u2014')}</span></td>
            <td class="num">${esc(money(v.penaltyImposed))}</td>
            <td class="num">${v.balanceDue > 0 ? `<span class="overdue">${esc(money(v.balanceDue))}</span>` : esc(money(0))}</td>
          </tr>`)
          .join('')]
      })}
      ${sourceNote(ds('ecbViolations').label, ds('ecbViolations').url)}`
      : '<p class="srcnote">The Department of Buildings datasets were unavailable when this page was last built.</p>'}
</section>

<section>
  <h2>Evictions at this address</h2>
  ${m.evictions.available
      ? `<p class="sub">Residential evictions carried out by a City Marshal at this building, as
        recorded by the Department of Investigation.</p>
        ${stats([
          { n: num(m.evictions.total), label: 'Evictions on record', foot: m.evictions.earliest ? `since ${shortDate(m.evictions.earliest)}` : '' },
          { n: esc(shortDate(m.evictions.mostRecent)), label: 'Most recent' }
        ])}
        ${m.evictions.byYear.length
          ? table({ head: ['Year', { label: 'Evictions', num: true }], rows: [m.evictions.byYear.map((y) => `<tr><td><strong>${esc(y.year)}</strong></td><td class="num">${num(y.count)}</td></tr>`).join('')] })
          : ''}
        ${callout(`<h3>Why no apartment numbers here</h3>
        <p>The City publishes the apartment number for every eviction it carries out. This page
        does not republish it, and the apartment number is dropped before the data is even stored.</p>
        <p>The distinction is deliberate. A housing violation is a record of an owner failing an
        obligation, and naming the apartment is what makes the pattern legible. An eviction is a
        record of the worst thing that happened to a neighbour, and naming the apartment serves
        nobody living here. The building-level count carries the context without that cost.</p>`, 'calm')}
        ${sourceNote(ds('evictions').label, ds('evictions').url)}`
      : '<p class="srcnote">The evictions dataset was unavailable when this page was last built.</p>'}
</section>

<section>
  <h2>This building is one of ${m.portfolio ? num(m.portfolio.registrationCount) : 'several'}</h2>
  ${m.portfolio
      ? `<p class="sub">HPD publishes, for every registered building in the city, the people named
        on that registration and the business address they gave. Searching that record for
        <strong>${esc(m.portfolio.person)}</strong> at
        <strong>${esc(m.portfolio.businessAddress)}</strong> — the same name and office address
        recorded for this building — returns ${num(m.portfolio.registrationCount)} separate
        building registrations.</p>

        ${stats([
          { n: num(m.portfolio.registrationCount), label: 'Building registrations naming this person at this address' },
          { n: num(m.portfolio.headOfficerCount), label: 'On which he is named head officer' },
          { n: num(m.portfolio.openViolations), label: 'Open violations across those buildings', tone: 'alarm' },
          { n: num(m.portfolio.everViolations), label: 'Violations ever recorded across them' }
        ])}

        ${callout(`<h3>What this does and does not say</h3>
        <p><strong>It does not say anyone owns ${num(m.portfolio.registrationCount)} buildings.</strong>
        It says one person is <em>named in the City's registration record</em> for that many, as
        head officer on ${num(m.portfolio.headOfficerCount)} of them. Ownership sits with separate
        companies, which this page does not enumerate.</p>
        <p>The match is on full name <em>and</em> exact business address, which is a strong match.
        It is not a legal identification, and this page does not present it as one.</p>
        <p>It also says nothing whatever about <em>why</em> any of these violations are open.</p>`, 'calm')}

        <h3>The ${num(Math.min(15, m.portfolio.buildings.length))} with the most open violations</h3>
        ${table({
          head: ['Building', 'Borough', { label: 'Open', num: true }, { label: 'Ever recorded', num: true }],
          rows: [m.portfolio.buildings.slice(0, 15).map((b) => `<tr${b.isThisBuilding ? ' style="background:var(--accent-soft)"' : ''}>
              <td><strong>${esc(b.address)}</strong>${b.isThisBuilding ? ' ← this building' : ''}</td>
              <td class="nowrap">${esc(b.boro || '')}</td>
              <td class="num">${b.open ? `<span class="overdue">${num(b.open)}</span>` : '0'}</td>
              <td class="num">${num(b.ever)}</td>
            </tr>`).join('')]
        })}
        <p class="srcnote">Derived from ${dsLink('contacts')} and ${dsLink('violations')}, recomputed daily.
        Figures taken ${esc(longDate(m.portfolio.asOf.slice(0, 10)))}.${m.portfolio.queryFailures ? ` ${num(m.portfolio.queryFailures)} building(s) could not be queried on this run and are not counted.` : ''}</p>`
      : '<p class="srcnote">Portfolio figures were unavailable when this page was last built.</p>'}
</section>

<section>
  <h2>City enforcement programmes</h2>
  <p class="sub">New York runs escalated-enforcement programmes for its most distressed buildings.
  Checked fresh every day.</p>
  <ul class="plain-list">
    <li><strong>Alternative Enforcement Program:</strong>
      ${m.enforcement.aep.onList
        ? '<span class="overdue">This building is on the AEP list.</span>'
        : 'This building is <strong>not</strong> currently on the AEP list.'}
      ${sourceNote(ds('aep').label, ds('aep').url)}</li>
    <li><strong>Underlying Conditions Program:</strong>
      ${m.enforcement.underlyingConditions.onList
        ? '<span class="overdue">This building is in the Underlying Conditions Program.</span>'
        : 'This building is <strong>not</strong> currently in the Underlying Conditions Program.'}
      ${sourceNote(ds('underlyingConditions').label, ds('underlyingConditions').url)}</li>
  </ul>
</section>
`
  };
}

// ===========================================================================
// 5. If you live here
// ===========================================================================
export function tenantsPage(m) {
  const noAccess = m.statuses.find((x) => /FIRST NO ACCESS/i.test(x.status));

  const phone = (who, number, why) => `<div class="phone">
    <div class="who">${esc(who)}</div>
    <a class="num" href="tel:${attr(number.replace(/[^0-9+]/g, ''))}">${esc(number)}</a>
    <div class="why">${why}</div>
  </div>`;

  return {
    description: 'What to do if you live at 530 Parkside Avenue: how to report a condition, what your rights are, and who to call for free help.',
    body: `
<div class="hero">
  <h1>If you live at 530 Parkside</h1>
  <p class="lede">Your problem is almost certainly not yours alone. ${num(m.summary.apartmentsAffected)}
  apartments in this building have open violations right now. Here is what you can actually do.</p>
</div>

${callout(`<h3>The single most useful thing: report it to 311</h3>
  <p>A condition nobody reports to the City never becomes a violation, and a problem with no
  violation behind it is very hard to enforce. Calling 311 creates a dated official record,
  triggers a City inspection, and adds to this building’s count — which is what moves a
  building onto the City’s escalated-enforcement lists.</p>
  <p>Call <strong>311</strong> or <strong>212-639-9675</strong>, or report it at
  <a href="https://portal.311.nyc.gov/" rel="noopener">portal.311.nyc.gov</a>.
  <strong>Write down the complaint number.</strong></p>`)}

${noAccess
    ? callout(`<h3>If you live in ${esc(noAccess.apartments.join(', '))}, read this first</h3>
    <p>HPD tried to re-inspect your apartment and could not get in. That is recorded against
    ${num(noAccess.count)} violations right now.</p>
    <p>This matters more than it sounds. After a second failed attempt, a violation can be
    <strong>dismissed without the condition ever being repaired</strong>. The record closes and
    the problem stays. Watch your mail for an HPD inspection notice and be home for that date.
    If it genuinely does not work, call and reschedule rather than miss it.</p>`, 'urgent')
    : ''}

<section>
  <h2>Free help, from people who do this every day</h2>
  <p class="sub">None of these cost anything. Several are staffed by tenant organisers and
  housing lawyers who have handled this exact building type a thousand times.</p>
  <div class="phone-grid">
    ${phone('311', '311', 'Report a condition. Request a City inspection. Get a complaint number.')}
    ${phone('Housing Court Answers', '212-962-4795', 'Free, plain-English answers about Housing Court. Tuesday to Thursday, 9am–5pm.')}
    ${phone('Met Council on Housing', '212-979-0611', 'Free tenant rights counselling and organising support. Mon &amp; Wed 1:30–8pm, Fri 1:30–5pm.')}
    ${phone('Legal Aid Society — Brooklyn', '718-722-3100', 'Free legal representation for tenants who qualify.')}
    ${phone('Legal Services NYC', '917-661-4500', 'Free legal representation for tenants who qualify.')}
    ${phone('Brooklyn Housing Court Help Center', '347-404-9043', 'Free help filling out court forms. Room 404, 141 Livingston St. It exists specifically for tenants without a lawyer.')}
    ${phone('HPD reinspection line', '212-863-7250', 'Use this if the owner certified a repair to the City that was not actually made. This is the line for challenging a certification — not 311.')}
    ${phone('NY State Homes &amp; Community Renewal (DHCR)', '718-739-6400', 'For rent-stabilised tenants: rent reduction applications and free rent history.')}
  </div>
</section>

<section>
  <h2>What the law already gives you</h2>

  <h3>Your apartment has to be liveable, and you cannot sign that away</h3>
  <p>The <strong>warranty of habitability</strong> (<a href="https://www.nysenate.gov/legislation/laws/RPP/235-B" rel="noopener">NY
  Real Property Law § 235-b</a>) is implied in every residential lease in New York State. It
  cannot be waived, and no lease clause overrides it. An infestation breaches it.</p>

  <h3>Pests are the owner’s job to eliminate, not to spray at</h3>
  <p><a href="https://www.nyc.gov/site/hpd/services-and-information/asthma-free-housing-act.page" rel="noopener">Local
  Law 55 of 2018</a> requires owners of buildings with three or more apartments to inspect for
  pests and mould <strong>annually</strong> and again whenever a tenant complains; to remediate
  using integrated pest management; and to seal the holes and gaps pests travel through. Asking
  the owner in writing for those annual inspection records is worth doing — the answer, either
  way, tells you something.</p>

  <h3>Retaliation is presumed, not something you have to prove</h3>
  <p>Under <a href="https://www.nysenate.gov/legislation/laws/RPP/223-B" rel="noopener">NY Real
  Property Law § 223-b</a>, if an owner moves to evict you, refuses to renew your lease, or
  raises your rent within <strong>one year</strong> of your good-faith complaint to a government
  agency or your court action about repairs, the law <em>presumes</em> it is retaliation and puts
  the burden on the owner to show otherwise. <strong>Write down the date of every complaint you
  make.</strong> That date starts the clock in your favour.</p>

  <h3>You have the right to organise with your neighbours</h3>
  <p><a href="https://www.nysenate.gov/legislation/laws/RPP/230" rel="noopener">NY Real Property
  Law § 230</a> gives tenants the right to form and join a tenants’ association and bars an
  owner from harassing, punishing or penalising anyone for it, or from withholding any right or
  benefit because of it.</p>
</section>

<section>
  <h2>If reporting it has not worked</h2>
  <p>Two routes go further than a complaint. Both are designed for tenants without lawyers, and
  neither requires one.</p>

  <h3>An HP Action</h3>
  <p>A case you bring in Housing Court asking a judge to order the owner to make repairs. Unlike
  a violation — which is a fact on a record — a court order carries a deadline the owner owes to
  a judge, and contempt if it is missed. The fee is nominal and can be waived. The Help Center in
  Room 404 at 141 Livingston Street exists to walk you through the forms.</p>
  <p><strong>Several tenants can file together.</strong> A joint action by several apartments in
  one building is materially stronger than one apartment alone, because it goes to whether the
  problem is a unit or the building.</p>

  <h3>A DHCR rent reduction, if you are rent-stabilised</h3>
  <p>If you are rent-stabilised and a service you are entitled to is not being provided, you can
  apply to DHCR for a rent reduction. It cuts your rent and freezes increases until the owner
  proves the condition is fixed. Of everything on this page, it is the one remedy that costs an
  owner money every month the problem continues.</p>
</section>

<section>
  <h2>Keep your own record</h2>
  <p>Whatever route you take, the evidence is the same and it is worth starting today:</p>
  <ul class="plain-list">
    <li><strong>Photograph and film everything, dated.</strong> Wide shot first so the room is
    identifiable, then close-up. Your phone stamps the date automatically — don’t strip it.</li>
    <li><strong>Keep every complaint number</strong> 311 gives you, with the date.</li>
    <li><strong>Put requests to the owner or super in writing</strong> — text or email, not only
    in person — so there is a record of what you asked for and when.</li>
    <li><strong>Keep the envelopes.</strong> Anything the City or the owner mails you, keep it,
    unopened envelope included. The postmark is evidence.</li>
    <li><strong>Note every visit:</strong> who came, when, what they did, how long they stayed.</li>
  </ul>
</section>

<div class="callout calm">
  <p><strong>This page is not legal advice</strong> and the people who built it are not lawyers.
  It is public information, organised. Before you file anything, run it past Housing Court
  Answers, the Help Center in Room 404, or Legal Aid — all free, all used to exactly these
  questions.</p>
</div>
`
  };
}

// ===========================================================================
// 6. Sources
// ===========================================================================
export function dataPage(m) {
  const rows = Object.entries(SOURCES)
    .map(
      ([key, s]) => `<tr>
      <td><strong>${esc(s.label)}</strong><br><span class="vid">${esc(s.id)}</span></td>
      <td>${esc(s.agency)}</td>
      <td><span class="desc">${esc(s.note)}</span></td>
      <td class="nowrap">${m.unavailable.includes(key)
          ? '<span class="overdue">unavailable today</span>'
          : '<a href="' + attr(s.url) + '" rel="noopener">open dataset</a>'}</td>
    </tr>`
    )
    .join('');

  return {
    description: 'Every dataset behind this page, how the numbers are counted, and what this page will not claim.',
    body: `
<div class="hero">
  <h1>Where every number here comes from</h1>
  <p class="lede">Nothing on this site is original reporting. Every figure is generated from a
  public dataset published by the City of New York, and every page says the date it was pulled.</p>
  <p class="asof">This build pulled on <strong>${esc(longDate(m.date))}</strong> at
  <strong>${esc(m.generatedAt)}</strong></p>
</div>

<section>
  <h2>The datasets</h2>
  ${table({ head: ['Dataset', 'Agency', 'What it is used for', ''], rows: [rows] })}
  ${m.unavailable.length
      ? callout(`<p>One or more datasets did not respond when this page was last built:
        <strong>${esc(m.unavailable.join(', '))}</strong>. Figures drawn from them may be missing
        or stale on this build. Everything else on the page is current as of
        ${esc(longDate(m.date))}.</p>`)
      : ''}
</section>

<section>
  <h2>This building’s identifiers</h2>
  <p class="sub">If you want to check any of this yourself, these are the keys the City’s systems
  use. Different datasets want different ones.</p>
  <div class="table-wrap"><table>
    <tbody>
      ${Object.entries(m.config.identifiers)
        .map(([k, v]) => `<tr><td><strong>${esc(k)}</strong></td><td class="vid">${esc(v)}</td></tr>`)
        .join('')}
    </tbody>
  </table></div>
</section>

<section>
  <h2>How the numbers are counted</h2>
  <ul class="plain-list">
    <li><strong>&ldquo;Open&rdquo;</strong> means HPD’s <span class="vid">violationstatus</span>
    field says Open, taken from the live dataset. It is <em>not</em> taken from HPD Online’s CSV
    export, which collapses several distinct HPD statuses into the single word OPEN and will
    mislead you.</li>
    <li><strong>&ldquo;Past deadline&rdquo;</strong> compares HPD’s own
    <span class="vid">originalcorrectbydate</span> — the date the City ordered the repair done by
    — against the date this page was built.</li>
    <li><strong>Complaint counts</strong> are counts of distinct complaints, not of rows. HPD’s
    complaints dataset stores one row per problem and a single complaint can carry several, so
    counting rows would inflate the figure several-fold.</li>
    <li><strong>Condition categories</strong> (&ldquo;Cockroaches&rdquo;, &ldquo;Mold&rdquo;) are
    this site’s grouping of HPD’s violation text, not an official HPD category. The original
    text is always shown next to it so you can check the grouping.</li>
    <li><strong>Apartment numbers</strong> are reproduced from HPD’s record, where they are
    already public.</li>
  </ul>

  ${m.apartmentAmbiguity.hasAny
      ? callout(`<h3>A known quirk in HPD’s apartment labels</h3>
      <p>HPD’s apartment field is typed in by hand, and this building’s records carry more than
      one spelling of what are almost certainly the same apartments:
      ${esc(m.apartmentAmbiguity.pairs.map((pr) => pr.labels.join(' and ')).join('; '))}
      — the letter O against the digit zero, and a stray hyphen.</p>
      <p><strong>This page does not merge them.</strong> Deciding that two labels in the City’s
      record are really one apartment would be a claim about this building that the data does not
      support, so each is shown exactly as HPD wrote it. ${m.apartmentAmbiguity.affectingOpenCounts.length === 0
        ? 'None of these pairs appear among the open violations, so the apartment counts on this site are unaffected.'
        : `<span class="overdue">Both spellings of ${esc(m.apartmentAmbiguity.affectingOpenCounts.map((pr) => pr.labels.join('/')).join(', '))} currently appear among the open violations, so the &ldquo;apartments affected&rdquo; figure on this site may be overstated.</span>`}</p>`, 'calm')
      : ''}
</section>

<section>
  <h2>Why this site’s violation count differs from other sites</h2>
  <p>Other property-data sites report a different — usually higher — number of open violations
  for this building. That is not a contradiction. It is a difference in what is being counted.</p>
  <p>This site reports <strong>${num(m.summary.openCount)} open HPD housing-maintenance
  violations</strong>. It counts only violations issued by the Department of Housing Preservation
  and Development under the Housing Maintenance Code, where HPD’s own
  <span class="vid">violationstatus</span> field reads Open.</p>
  <p>Separately, and never added to that figure, this site reports
  <strong>${num(m.otherAgencies.dob.activeCount)} active Department of Buildings violations</strong>
  and <strong>${num(m.otherAgencies.ecb.activeCount)} active violations carrying a City
  penalty</strong>. Those come from a different agency enforcing a different code.</p>
  <p>Sites that publish a single merged total are adding those together, sometimes along with
  other categories again. Merging them produces a headline figure that matches no official source
  and cannot be checked against one, so this site keeps them apart and labels each. If you want
  the merged number, you can add them yourself — and you will know exactly what went into it.</p>
</section>

<section>
  <h2>What this page will not claim</h2>
  <ul class="plain-list">
    <li><strong>It does not say why a violation closed.</strong> HPD’s
    <span class="vid">VIOLATION CLOSED</span> status covers both a repair that was made and a
    violation dismissed for other reasons, including an inspector being unable to get in. The
    record does not distinguish them, so this page does not either.</li>
    <li><strong>It does not describe anyone’s intentions.</strong> A count of overdue violations
    is a fact. Why they are overdue is not something a dataset can tell you, and this page does
    not speculate.</li>
    <li><strong>It does not treat an absent record as proof of absence.</strong> An apartment with
    no violation may simply have a condition nobody reported. A missing registration renewal may
    be a data lag. Where that is a live possibility, the page says so on the spot.</li>
  </ul>
</section>

<section>
  <h2>Privacy</h2>
  <p>HPD publishes apartment numbers with its violations, and they appear here as the City
  publishes them. <strong>If you live here and would rather your apartment number not appear on
  this page, say so and it will be removed.</strong> No reason needed, no questions.</p>
  <p>One category of information is removed automatically before anything is published. HPD’s
  lead-paint violation text sometimes describes the household rather than the building — naming
  an apartment as one where a child under six lives. That identifies a specific family with a
  young child who has no part in any of this. That clause is stripped from the text, and the
  removal is marked where it occurs. The violation itself still appears in full, with its
  apartment, class, date, ID and the condition cited.</p>
  <p><strong>Eviction records are shown as building-level counts only.</strong> The City
  publishes the apartment number for every eviction a Marshal carries out at this address. This
  site does not republish it — the apartment number is discarded before the data is stored, not
  merely hidden at display time. A housing violation records an owner failing an obligation, and
  the apartment is what makes the pattern legible. An eviction records the worst thing that
  happened to a neighbour, and naming the apartment serves nobody who lives here.</p>
  <p>This site sets no cookies, loads no fonts or scripts from anywhere else, and runs no
  analytics. Nobody is tracked for reading about where they live.</p>
</section>

<section>
  <h2>Corrections</h2>
  <p>${esc(m.config.corrections.promise)}</p>
  <p>Corrections are made in public, with the date. The full daily archive of what the City’s
  record said on each date is kept in this site’s public repository, so a change here can always
  be checked against the source as it stood at the time.</p>
</section>

<section>
  <h2>Reuse</h2>
  <p>The City’s data is public and the code that builds this page is open. If you want to build
  this for your own building, you can — the building-specific parts are a single configuration
  file. Every dataset above is queried by the identifiers listed in this page’s
  &ldquo;identifiers&rdquo; table, which you can look up for any New York City address.</p>
  <p>Two organisations already do serious work in this area and are worth knowing about:
  <a href="https://www.justfix.org/" rel="noopener">JustFix</a>, which built
  <a href="https://whoownswhat.justfix.org/" rel="noopener">Who Owns What</a>, and the
  <a href="https://www.housingdatanyc.org/" rel="noopener">Housing Data Coalition</a>, which
  maintains the open database that loads most of the datasets above.</p>
</section>
`
  };
}
