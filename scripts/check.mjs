// Leak check. Run before every commit: `npm run check`.
//
// This repository is public and sits inside a private one. The failure mode this
// guards against is not malice, it is a hurried copy-paste from the parent
// folder at 1am. Cheap to run, and the thing it prevents cannot be undone --
// git history is forever and this repo has the owner's name on it.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Patterns that must never appear in tracked files. Each carries the reason,
// because a failure at 1am should not need a second person to interpret it.
const FORBIDDEN = [
  { re: /\bDyllan\b/i,                    why: 'maintainer name' },
  { re: /\bmoran\.dyllan\b/i,             why: 'maintainer email' },
  { re: /moran@/i,                        why: 'maintainer email' },
  { re: /@gmail\.com/i,                   why: 'personal email address', allowFromConfig: true },
  { re: /00-CASE-SUMMARY|02-hp-action|04-evidence|01-demand-letter|05-records|03-dhcr/i,
                                          why: 'path into the private case folder' },
  { re: /certified demand letter/i,       why: 'private legal strategy' },
  { re: /\bevidence-log\b/i,              why: 'private evidence file' },
  { re: /WATCH-THE-CERTIFICATION|HPD-REINSPECTION-SWEEP|GETTING-ANSWERS-FROM-HPD/i,
                                          why: 'private case file name' }
];

// Files that may legitimately discuss what must NOT be committed.
const EXEMPT = new Set(['scripts/check.mjs']);

// Some patterns are broad safety nets rather than absolute bans. A bare
// @gmail.com is almost always someone's personal address leaking in -- but the
// building's own contact sheet lists one as the landlord's business contact,
// and that is published deliberately. Anything explicitly configured for
// publication is exempt; anything else still trips the net.
const configText = (() => {
  try {
    return readFileSync('config/building.json', 'utf8');
  } catch {
    return '';
  }
})();

const allowedByConfig = new Set(
  [...configText.matchAll(/[\w.+-]+@[\w.-]+\.\w+/g)].map((m) => m[0].toLowerCase())
);

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !EXEMPT.has(f));

const findings = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // binary or unreadable; nothing to match
  }
  const lines = text.split('\n');
  for (const { re, why, allowFromConfig } of FORBIDDEN) {
    lines.forEach((line, i) => {
      if (!re.test(line)) return;
      if (allowFromConfig) {
        const emails = [...line.matchAll(/[\w.+-]+@[\w.-]+\.\w+/g)].map((m) => m[0].toLowerCase());
        if (emails.length && emails.every((e) => allowedByConfig.has(e))) return;
      }
      findings.push({ file, line: i + 1, why, text: line.trim().slice(0, 110) });
    });
  }
}

if (findings.length) {
  console.error('\nLEAK CHECK FAILED — private material in a public repository:\n');
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  (${f.why})`);
    console.error(`    ${f.text}\n`);
  }
  console.error(`${findings.length} finding(s). Nothing was committed. Remove these before pushing.\n`);
  process.exit(1);
}

console.log(`[check] ${files.length} tracked files, no private material found.`);
