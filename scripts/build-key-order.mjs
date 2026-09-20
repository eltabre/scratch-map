/**
 * Maintains src/data/keyOrder.json: every place you can mark, in a fixed order.
 *
 * A shared link stores one bit per place, so its meaning depends on this order.
 * The list is therefore append-only: new places are added at the end and existing
 * ones never move or disappear, which keeps every link ever made decoding to the
 * same places. Never reorder or delete entries by hand.
 *
 * Builds the keys the same way src/lib/geo.ts does: countries by ISO id (or name
 * when the id is missing or already used), except the US and Canada, which are
 * marked through their states and provinces; then regions; then parks.
 *
 * Reads src/data/regions.json and src/data/parks.json, so run those scripts first.
 * Run with: npm run data:order
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const OUT = 'src/data/keyOrder.json';
/** Countries drawn as their states / provinces, so never marked directly. */
const SPLIT = new Set(['840', '124']);

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

const world = await readJson('node_modules/world-atlas/countries-50m.json');
const regions = await readJson('src/data/regions.json');
const parks = await readJson('src/data/parks.json');

const current = [];
const usedIds = new Set();
for (const g of world.objects.countries.geometries) {
	const rawId = g.id === undefined ? null : String(g.id);
	const id = rawId && !usedIds.has(rawId) ? rawId : null;
	if (id) usedIds.add(id);
	if (id && SPLIT.has(id)) continue;
	current.push(id ?? g.properties.name);
}
current.push(...regions.objects.regions.geometries.map((g) => g.properties.key));
current.push(...parks.map((p) => p.key));

if (new Set(current).size !== current.length) throw new Error('duplicate keys in the current data');

const existing = existsSync(OUT) ? await readJson(OUT) : [];
const known = new Set(existing);
const added = current.filter((key) => !known.has(key));
const gone = existing.filter((key) => !current.includes(key));

await writeFile(OUT, JSON.stringify([...existing, ...added]) + '\n');
console.log(`  ${existing.length + added.length} slots (${added.length} added)`);
if (gone.length) console.log(`  kept ${gone.length} slots whose place no longer exists: ${gone.join(', ')}`);
