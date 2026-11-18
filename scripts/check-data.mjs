// Checks data.json before it is committed. Errors fail; warnings are printed.
// Usage: node scripts/check-data.mjs [path/to/data.json]
import { readFileSync } from 'node:fs';
import { compute, validate } from '../lib/compute.js';

const path = process.argv[2] || new URL('../data.json', import.meta.url);
let data;
try {
  data = JSON.parse(readFileSync(path, 'utf8'));
} catch (err) {
  console.error(`data.json could not be read: ${err.message}`);
  process.exit(1);
}

const { errors, warnings } = validate(data);
const v = compute(data);
const t = v.totals;

console.log(`Milestones: ${t.milestonesBuilt} of ${t.milestonesTotal} built`);
console.log(`Ours: ${t.ours} items, ${t.built} built (${t.sharePct}%), ${t.inProgress} in progress, ${t.stillOurs} still ours, ${t.overdue} overdue`);
console.log(`External: ${t.external} items, ${t.blockedOnOthers} waiting on others`);
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s). Fix data.json before pushing.`);
  process.exit(1);
}
console.log('\ndata.json is valid.');
