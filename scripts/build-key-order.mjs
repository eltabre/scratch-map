/**
 * Maintains src/data/keyOrder.json: every place you can mark, in a fixed order.
 *
 * A shared link stores one bit per place, so its meaning depends on this order.
 * The list is therefore append-only: new places are added at the end and existing
 * ones never move or disappear, which keeps every link ever made decoding to the
 * same places. Never reorder or delete entries by hand.
 *
 * The places are exactly the shapes and parks in src/data/map.json, the same list the
 * app draws, so run `npm run data:map` first.
 *
 * Run with: npm run data:order
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const OUT = 'src/data/keyOrder.json';
const map = JSON.parse(await readFile('src/data/map.json', 'utf8'));
const current = [...map.areas.map((a) => a.key), ...map.parks.map((p) => p.key)];

if (new Set(current).size !== current.length) throw new Error('duplicate keys in the current data');

const existing = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : [];
const known = new Set(existing);
const added = current.filter((key) => !known.has(key));
const gone = existing.filter((key) => !current.includes(key));

await writeFile(OUT, JSON.stringify([...existing, ...added]) + '\n');
console.log(`  ${existing.length + added.length} slots (${added.length} added)`);
if (gone.length) console.log(`  kept ${gone.length} slots whose place no longer exists: ${gone.join(', ')}`);
