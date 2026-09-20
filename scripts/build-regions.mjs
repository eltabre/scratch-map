/**
 * Builds src/data/regions.json: the US states and Canadian provinces.
 *
 * Source: Natural Earth 50m admin-1 boundaries. The scale matches the world-atlas
 * 50m country shapes the map is drawn with, so the borders line up. The full file
 * covers dozens of countries; this keeps only the US and Canada and writes them
 * as a small quantised TopoJSON.
 *
 * Natural Earth draws state and province borders as legal jurisdictions, so they
 * run out across the Great Lakes (Michigan swallows three of them, and Ontario
 * reaches down into all four it touches). The Great Lakes are therefore cut out of
 * every region using Natural Earth's 50m lakes layer, leaving only land. Other
 * lakes are left alone, matching how the world map treats lakes elsewhere.
 *
 * Run with: npm run data:regions
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import polygonClipping from 'polygon-clipping';
import { topology } from 'topojson-server';

const URL =
	'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson';
const CACHE = 'node_modules/.cache/ne_50m_admin_1.geojson';
const OUT = 'src/data/regions.json';
const COUNTRIES = ['US', 'CA'];
const LAKES_URL =
	'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson';
const LAKES_CACHE = 'node_modules/.cache/ne_50m_lakes.geojson';
const GREAT_LAKES = ['Lake Superior', 'Lake Michigan', 'Lake Huron', 'Lake Erie', 'Lake Ontario', 'Lake Saint Clair'];
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

/**
 * polygon-clipping returns rings wound the GeoJSON way (exteriors counter-clockwise).
 * d3 and TopoJSON want the opposite, and read a wrongly wound ring as "everything
 * except this shape", which fills the whole globe. Reverse every ring.
 */
const rewind = (polygons) => polygons.map((polygon) => polygon.map((ring) => [...ring].reverse()));

/** GeoJSON Polygon or MultiPolygon -> MultiPolygon coordinates, which polygon-clipping takes. */
const multi = (geometry) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates);

const lakes = (await cached(LAKES_URL, LAKES_CACHE)).features
	.filter((f) => GREAT_LAKES.includes(f.properties.name))
	.map((f) => multi(f.geometry));
if (lakes.length !== GREAT_LAKES.length) throw new Error(`expected ${GREAT_LAKES.length} Great Lakes, found ${lakes.length}`);

const all = await cached(URL, CACHE);
const features = all.features
	.filter((f) => COUNTRIES.includes(f.properties.iso_a2) && !EXCLUDED.has(f.properties.iso_3166_2))
	.map((f) => {
		const dry = polygonClipping.difference(multi(f.geometry), ...lakes);
		if (!dry.length) throw new Error(`${f.properties.iso_3166_2} has no land after removing the lakes`);
		return {
			type: 'Feature',
			// The ISO 3166-2 code ("US-CA") is the stable key the app saves.
			properties: { key: f.properties.iso_3166_2, name: f.properties.name, country: f.properties.iso_a2 },
			geometry: { type: 'MultiPolygon', coordinates: rewind(dry) },
		};
	});

// One topology for both countries, so a state and the province across the border
// share an arc and the app can colour them differently.
const topo = topology({ regions: { type: 'FeatureCollection', features } }, 1e5);
const json = JSON.stringify(topo);
await writeFile(OUT, json);

const count = (c) => features.filter((f) => f.properties.country === c).length;
console.log(`  ${features.length} regions (${count('US')} US, ${count('CA')} CA)  ${(json.length / 1024).toFixed(0)} KB -> ${OUT}`);
