# CLAUDE.md — 530 Parkside public site

Working notes for any Claude session in this directory. `README.md` explains the
site to the public; this file is about *how to work on it*.

## The boundary — read this first

**This repository is public. Everything committed here is world-readable, and
git history is forever.**

This directory sits inside a **private parent folder that is a separate git
repository**. The parent's `.gitignore` excludes `site/`, so the private repo
cannot swallow this one and this one cannot reach back into it.

The rule is one sentence: **nothing enters this repository that did not come out
of a public government dataset.**

That means never committing here:

- Any file from the parent directory, or anything derived from one
- Anyone's plans, correspondence, or private notes
- Any resident's name, contact details, tenancy details, or photographs
- Anything a neighbour said that is not also in a City dataset
- Anything identifying which apartment the people maintaining this site live in

That last one is not squeamishness. New York presumes landlord retaliation
against a tenant who complains (Real Property Law § 223-b), and the presumption
is worth a great deal. Publishing who is behind this, and where they live, hands
that away for nothing. The site is stronger as a record of a building than as a
grievance by an identifiable person — legally, and with every audience it was
built for.

Every apartment on this site appears the same way: as a row in HPD's public
violation record. The site does not say who lives in any of them.

**Before any commit, run the leak check:** `npm run check`.

## What this is

A static site, rebuilt daily from NYC Open Data, showing every housing
violation, complaint and inspection the City has on record for 530 Parkside
Avenue, Brooklyn (BBL `3050560014`).

Audiences, in the order they were designed for: **tenants** deciding whether
their problem is theirs alone, the **property manager** who wants the real list,
the **owner**, and the **City** — plus reporters and judges who may arrive later.

## Writing discipline

Everything here names a real person and may be read by a judge.

- **Facts, sourced and dated. Never motive.** "47 open violations, 100% past
  deadline, per HPD as of 2026-09-21" is unassailable. "The landlord doesn't
  care" is a fight to lose, and loses the audiences this site was built for.
- **Where the record is ambiguous, say so on the page.** HPD's
  `VIOLATION CLOSED` does not distinguish "repaired" from "dismissed". The site
  says that, in those words, rather than resolving it favourably.
- **Never let an absent record prove absence.** No violation in an apartment may
  just mean nobody reported it. A missing registration renewal may be a data
  lag. Both caveats are on the page; keep them there until the data changes.
- **Cite every number.** Every section ends in a link to the dataset it came
  from. If you add a figure, add its source note.

## Architecture

```
config/building.json   BBL, identifiers, contacts config. The only building-specific file.
scripts/sources.mjs    Dataset registry — id, query, whether a failure is fatal.
scripts/fetch.mjs      Pulls every dataset → data/snapshots/<date>.json + data/latest.json
scripts/analyze.mjs    Raw City rows → the derived model the pages state. All the counting.
scripts/build.mjs      Renders the model into dist/
src/layout.mjs         Page shell, nav, footer, shared components
src/pages.mjs          The six pages
src/assets/            styles.css, app.js — no dependencies, no CDNs, no fonts, no analytics
data/snapshots/        One dated file per day. This is the archive. Never delete these.
```

`npm run update` = fetch + build. `npm run build` alone re-renders from the data
already on disk and is a pure function of it.

## Hard-won lessons — do not repeat these

**1. The HPD Online CSV export is lossy.** It collapses several distinct HPD
statuses into the single word `OPEN`. Always pull status from NYC Open Data
(`wvxf-dwi5`), never from the export.

**2. Field naming is inconsistent between datasets, and silently so.**
`ygpa-z7cr` returns **2 rows** for `buildingid=352258` and **1,155** for
`bbl=3050560014` — same building. `erm2-nwe9` needs `incident_address`, not
`bbl`. Before trusting a new query, check its row count against something known.
A query that returns 200 OK and the wrong rows looks exactly like success.

**3. Socrata rejects some query forms here.** Aggregates (`$select` with
`count()`, `$group`) and `like` clauses have failed. Bare `?field=value` works.
Filter and count in JS instead.

**4. Count complaints, not rows.** `ygpa-z7cr` stores one row per *problem* and a
single complaint carries several. Counting rows inflates the figure several-fold.

**5. Never merge agencies into one violation total.** HPD, DOB and ECB are
different regulators enforcing different codes. Other sites publish a single
merged number; ours cannot be checked against any official source if we do that.
Report each separately and label it. `data.html` explains this to readers.

**6. HPD's apartment labels have variants.** `6O`/`60`, `1-N`/`1N` — hand-typed.
`analyze.mjs` detects these and discloses them rather than merging them, and
warns at build time if one ever reaches the open set, where it would inflate the
"apartments affected" count. Do not "fix" this by merging.

## Privacy rules built into the pipeline

Two are structural — they live in code, not in an editing pass, because HPD's
text varies between inspectors and a future pull can reintroduce a phrasing we
haven't seen.

1. **Household detail is stripped from violation text.** `redact()` in
   `analyze.mjs` removes the lead-paint clause naming a child under six. The
   violation still publishes in full — apartment, class, date, ID, condition.
2. **Eviction apartment numbers are discarded at parse time**, not hidden at
   render time. `buildEvictions()` never carries the field through. Building-level
   counts only. A violation records an owner's failure; an eviction records a
   neighbour's worst day.

Apartment numbers on *violations* are published. That was a deliberate
decision, made with the trade-off understood: it is what makes a building-wide
pattern legible rather than a list of anonymous complaints.

Anyone who asks gets their apartment removed, no reason needed. Honour that
immediately — it is on the page as a promise, and a promise like that is worth
more than any single row of data.

## Deployment

GitHub Actions (`.github/workflows/daily.yml`) runs daily: fetch → build →
commit the snapshot → deploy to Cloudflare Pages. The deploy step self-skips
until `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set as repository
secrets, so the archive keeps accumulating regardless.

`fetch.mjs` refuses to write a snapshot if a **critical** dataset fails, or if
the violations query returns implausibly few rows. A stale site is recoverable;
a site showing wrong numbers is not.

## Making this work for another building

`config/building.json` is the only building-specific file. Swap the identifiers
and it runs for any NYC address. Some page prose is still specific to 530
Parkside and would need generalising — that is the known gap.
