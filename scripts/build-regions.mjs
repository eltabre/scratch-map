/**
 * Builds src/data/regions.json: the US states and Canadian provinces.
 *
 * Source: Natural Earth 50m admin-1 boundaries. The scale matches the world-atlas
 * 50m country shapes the map is drawn with, so the borders line up. The full file
 * covers dozens of countries; this keeps only the US and Canada and writes them
 * as a small quantised TopoJSON.
 *
 * The shapes are kept exactly as Natural Earth draws them. Their borders run out
 * across the Great Lakes (Michigan swallows three of them), and that is handled when
 * the map is drawn (scripts/build-map.mjs paints the lakes over them), not here:
 * cutting the lakes out of the polygons with a clipping library quietly thinned the
 * points along other borders too, and neighbouring provinces then stopped meeting.
 *
 * Run with: npm run data:regions
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { topology } from 'topojson-server';

const URL =
	'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson';
const CACHE = 'node_modules/.cache/ne_50m_admin_1.geojson';
const OUT = 'src/data/regions.json';
const COUNTRIES = ['US', 'CA'];
/** Not a state. Left out so the US is the usual 50. */
const EXCLUDED = new Set(['US-DC']);

/** Download a file once, then read it from the cache on later runs. */
async function cached(url, file) {
	if (!existsSync(file)) {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
		await mkdir(path.dirname(file), { recursive: true });
		await writeFile(file, Buffer.from(await response.arrayBuffer()));
	}
	return JSON.parse(await readFile(file, 'utf8'));
}

const all = await cached(URL, CACHE);
const features = all.features
	.filter((f) => COUNTRIES.includes(f.properties.iso_a2) && !EXCLUDED.has(f.properties.iso_3166_2))
	.map((f) => ({
		type: 'Feature',
		// The ISO 3166-2 code ("US-CA") is the stable key the app saves.
		properties: { key: f.properties.iso_3166_2, name: f.properties.name, country: f.properties.iso_a2 },
		geometry: f.geometry,
	}));

// One topology for both countries, so a state and the province across the border
// share an arc and the app can colour them differently.
const topo = topology({ regions: { type: 'FeatureCollection', features } }, 1e5);
const json = JSON.stringify(topo);
await writeFile(OUT, json);

const count = (c) => features.filter((f) => f.properties.country === c).length;
console.log(`  ${features.length} regions (${count('US')} US, ${count('CA')} CA)  ${(json.length / 1024).toFixed(0)} KB -> ${OUT}`);
