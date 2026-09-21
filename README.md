# 530 Parkside

The public record of **530 Parkside Avenue, Brooklyn, NY 11226** — every housing
violation, complaint and inspection the City of New York has on file, pulled
fresh from NYC Open Data every day.

Everything on this site is already public. It is just scattered across a dozen
City databases that don't talk to each other and each want a different
identifier. This assembles it in one place and keeps it current.

## What it's for

Helping tenants, the property manager, the owner and the City see the whole
picture at once — and helping anyone living here find out whether their problem
is theirs alone.

It takes no position on anyone's intentions. It reports what the City has
written down, with the date it was written and a link to the source. Where the
record is ambiguous, the page says so rather than guessing.

## Data sources

Every figure comes from a public dataset published by the City of New York:

| Dataset | Agency | Used for |
|---|---|---|
| [`wvxf-dwi5`](https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5) | HPD | Housing maintenance violations and their true status |
| [`tesw-yqqr`](https://data.cityofnewyork.us/Housing-Development/Multiple-Dwelling-Registrations/tesw-yqqr) | HPD | Annual owner registration |
| [`feu5-w2e2`](https://data.cityofnewyork.us/Housing-Development/Registration-Contacts/feu5-w2e2) | HPD | Registered owner, officer and agent |
| [`59kj-x8nc`](https://data.cityofnewyork.us/Housing-Development/Housing-Litigations/59kj-x8nc) | HPD | Court cases, tenant actions, access warrants |
| [`ygpa-z7cr`](https://data.cityofnewyork.us/Housing-Development/Complaint-Problems/a2nx-4u46) | HPD | Tenant complaints and what came of them |
| [`p937-wjvj`](https://data.cityofnewyork.us/Health/Rodent-Inspection/p937-wjvj) | DOHMH | Rodent inspections |
| [`erm2-nwe9`](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9) | 311 | Service requests at this address |
| [`3h2n-5cm9`](https://data.cityofnewyork.us/Housing-Development/DOB-Violations/3h2n-5cm9) | DOB | Building-code violations — elevators, boilers |
| [`6bgk-3dad`](https://data.cityofnewyork.us/Housing-Development/DOB-ECB-Violations/6bgk-3dad) | DOB/ECB | Violations carrying a monetary penalty |
| [`6z8x-wfk4`](https://data.cityofnewyork.us/City-Government/Evictions/6z8x-wfk4) | DOI | Evictions (building-level counts only) |
| [`hcir-3275`](https://data.cityofnewyork.us/Housing-Development/Buildings-Selected-for-the-Alternative-Enforcement/hcir-3275) | HPD | Alternative Enforcement Program |
| [`xpbf-ithr`](https://data.cityofnewyork.us/Housing-Development/Underlying-Conditions-Program/xpbf-ithr) | HPD | Underlying Conditions Program |

**Violation counts from different agencies are never merged.** HPD, DOB and ECB
enforce different codes; a single combined total would match no official source.

## The daily archive

`data/snapshots/` holds one dated file per day: the complete raw response from
the City's servers on that date, not a summary. HPD's database only ever stores
a violation's *current* status — when one closes, there is no public record of
what it said last week. This archive is that record, and anyone can check the
site's arithmetic against it.

## Running it

```bash
npm run update   # fetch fresh data, then build
npm run build    # rebuild from data already on disk
```

Output lands in `dist/`. No dependencies, no build toolchain, no CDNs, no
analytics, no cookies.

## Another building

`config/building.json` holds every building-specific identifier. Swap them and
this runs for any New York City address. Some page prose is still specific to
this building.

If you're building something in this space, two organisations already do serious
work here and are worth talking to first:
[JustFix](https://www.justfix.org/) (who built
[Who Owns What](https://whoownswhat.justfix.org/)) and the
[Housing Data Coalition](https://www.housingdatanyc.org/).

## Corrections

If you are named on this site and believe something is wrong, open an issue or
write to us. Every claim gets checked against the City's record, and anything
actually wrong is corrected in public with the date shown.

If you live at 530 Parkside and would rather your apartment number not appear,
say so and it comes off. No reason needed.

## Licence

Code: MIT. The underlying data is the City of New York's and is public.

**Not legal advice.** Not affiliated with or endorsed by the owner of this
building, any managing agent, or the City of New York.
