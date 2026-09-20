/**
 * Builds src/data/parks.json: the national parks of the US and Canada.
 *
 * Source: Wikidata. "National Park of the United States" is the 63 officially
 * designated parks. "National park of Canada" includes the national park
 * reserves. Each is a point (the park's coordinate), which is all the map needs.
 *
 * Each park also records the state or province its coordinate falls in, so that
 * marking a park can mark its region too. This reads src/data/regions.json, so
 * run `npm run data:regions` first if that file is missing.
 *
 * Run with: npm run data:parks
 */

import { readFile, writeFile } from 'node:fs/promises';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';

const OUT = 'src/data/parks.json';
const CLASSES = [
	{ country: 'US', wikidata: 'Q34918903' },
	{ country: 'CA', wikidata: 'Q1896949' },
];
/** Listed under the Canadian class but no longer a park (closed 1940). */
const EXCLUDED = new Set(['Buffalo National Park']);
/**
 * Wikidata is patchy for the US class: Denali and Great Sand Dunes each have a
 * second, duplicate item, and Lake Clark and New River Gorge are not typed as
 * national parks at all. Checked by hand against the official list of 63.
 */
const DUPLICATE_ITEMS = new Set(['Q49482738', 'Q49495619']);
const MISSING_US_ITEMS = ['Q712296', 'Q7011245'];
/**
 * Parks whose coordinate falls outside the region shapes (islands and the coast) or
 * on the wrong side of a border (Thousand Islands is in the St. Lawrence River, where
 * the Ontario–New York line runs). American Samoa and the Virgin Islands are
 * territories, not states, so they have no region at all.
 */
const REGION_OVERRIDES = {
	'Biscayne National Park': 'US-FL',
	'Channel Islands National Park': 'US-CA',
	'Dry Tortugas National Park': 'US-FL',
	'Fundy National Park': 'CA-NB',
	'Gulf Islands National Park Reserve': 'CA-BC',
	'Mingan Archipelago National Park Reserve': 'CA-QC',
	'Pacific Rim National Park Reserve': 'CA-BC',
	'Pituamkek National Park Reserve': 'CA-PE',
	'Thousand Islands National Park': 'CA-ON',
	'Torngat Mountains National Park': 'CA-NL',
};

async function query(cls, extra = []) {
	const members = `{ ?p wdt:P31 wd:${cls} }`;
	const added = extra.length ? ` UNION { VALUES ?p { ${extra.map((id) => `wd:${id}`).join(' ')} } }` : '';
	const sparql = `
		SELECT DISTINCT ?p ?pLabel ?c WHERE {
			${members}${added}
			?p wdt:P625 ?c .
			SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
		}`;
	const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql);
	const response = await fetch(url, { headers: { 'User-Agent': 'scratch-map/0.1 (personal project)' } });
	if (!response.ok) throw new Error(`wikidata ${cls}: HTTP ${response.status}`);
	return (await response.json()).results.bindings;
}

const topo = JSON.parse(await readFile('src/data/regions.json', 'utf8'));
const regions = feature(topo, topo.objects.regions).features;

/** The region containing the point. A park spanning several states gets the one its coordinate is in. */
function regionOf(name, lon, lat) {
	return REGION_OVERRIDES[name] ?? regions.find((f) => geoContains(f, [lon, lat]))?.properties.key ?? null;
}

const parks = [];
const seen = new Set();
for (const { country, wikidata } of CLASSES) {
	for (const row of await query(wikidata, country === 'US' ? MISSING_US_ITEMS : [])) {
		// An item with several coordinates comes back once per coordinate; keep the first.
		const id = row.p.value.split('/').pop();
		if (seen.has(id) || DUPLICATE_ITEMS.has(id)) continue;
		seen.add(id);
		const name = row.pLabel.value.replace(' and Haida Heritage Site', '');
		if (EXCLUDED.has(name)) continue;
		// WKT is "Point(lon lat)".
		const [lon, lat] = row.c.value.match(/-?[\d.]+/g).map(Number);
		parks.push({
			// The Wikidata id is stable across renames, so it is what the app saves.
			key: `park:${id}`,
			name,
			country,
			lat: +lat.toFixed(3),
			lon: +lon.toFixed(3),
			region: regionOf(name, lon, lat),
		});
	}
}

parks.sort((a, b) => a.name.localeCompare(b.name));
await writeFile(OUT, JSON.stringify(parks, null, '\t') + '\n');

const count = (c) => parks.filter((p) => p.country === c).length;
console.log(`  ${parks.length} parks (${count('US')} US, ${count('CA')} CA) -> ${OUT}`);
