/**
 * Builds src/data/map.json: every shape, region and park, ready to draw.
 *
 * Projecting a few hundred detailed shapes into SVG paths takes long enough that a
 * phone was visibly stuck on it at every page load, and the answer never changes.
 * So it is worked out here, once, and the app just loads the result. It also means
 * d3-geo, topojson-client and the country-code lookup stay out of the browser.
 *
 * Reads world-atlas (countries), src/data/regions.json and src/data/parks.json, so
 * run `npm run data:regions` and `npm run data:parks` first.
 *
 * Run with: npm run data:map
 */

import { readFile, writeFile } from 'node:fs/promises';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import isoCountries from 'i18n-iso-countries';
import { feature, neighbors } from 'topojson-client';

const OUT = 'src/data/map.json';
const WIDTH = 960;
const HEIGHT = 500;
/** Decimal places in the path data. 1 is 0.05 of a map unit, about half a pixel at the deepest zoom. */
const DIGITS = 1;

/** ISO numeric ids of the countries that are drawn as their states / provinces instead. */
const SPLIT = { 840: 'US', 124: 'CA' };
/** Shapes that world-atlas leaves without an ISO numeric id. */
const CODE_BY_NAME = { Kosovo: 'XK' };
const COUNTRY_LABEL = { US: 'USA', CA: 'Canada' };
// Deliberately no yellows or oranges: they read as the gold foil.
const PALETTE = ['#e4572e', '#d6336c', '#8a6fdf', '#4c6ef5', '#4aa3df', '#2fb5a6', '#7bc950', '#f78fb3'];

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const world = await readJson('node_modules/world-atlas/countries-50m.json');
const regionsTopology = await readJson('src/data/regions.json');
const parksData = await readJson('src/data/parks.json');

/**
 * Give every shape a colour that none of its land neighbours has, so two touching
 * shapes never blend together once both are scratched off. A shape with more
 * distinct neighbours than there are colours (China, Russia) reuses the colour its
 * neighbours use least.
 */
function assignColors(geometries) {
	const adjacent = neighbors(geometries);
	const colors = [];
	geometries.forEach((_, i) => {
		const used = new Array(PALETTE.length).fill(0);
		adjacent[i].forEach((n) => {
			if (colors[n] !== undefined) used[colors[n]]++;
		});
		// Start at a different colour per shape so the map is not all one hue, then take
		// the first colour with no neighbour on it (or the least used, if there is none).
		let best = i % PALETTE.length;
		for (let step = 0; step < PALETTE.length; step++) {
			const candidate = (i + step) % PALETTE.length;
			if (used[candidate] < used[best]) best = candidate;
			if (used[candidate] === 0) {
				best = candidate;
				break;
			}
		}
		colors[i] = best;
	});
	return colors.map((c) => PALETTE[c]);
}

const projection = geoNaturalEarth1().fitExtent(
	[
		[4, 4],
		[WIDTH - 4, HEIGHT - 4],
	],
	{ type: 'Sphere' },
);
const path = geoPath(projection).digits(DIGITS);

const worldFeatures = feature(world, world.objects.countries).features;
const worldColors = assignColors(world.objects.countries.geometries);
const regionFeatures = feature(regionsTopology, regionsTopology.objects.regions).features;
const regionColors = assignColors(regionsTopology.objects.regions.geometries);

const regions = regionFeatures.map((f) => f.properties);
const countries = [];
const areas = [];
const usedIds = new Set();
const round = (n) => Math.round(n * 100) / 100;
const shape = (key, label, f, color) => ({
	key,
	label,
	d: path(f) ?? '',
	bounds: path.bounds(f).map((point) => point.map(round)),
	color,
});

worldFeatures.forEach((f, i) => {
	const name = f.properties.name;
	// A few dependencies share their parent's id (Ashmore and Cartier Is. has
	// Australia's). Only the first keeps it; the rest are keyed and flagged by name.
	const rawId = f.id === undefined ? null : String(f.id);
	const id = rawId && !usedIds.has(rawId) ? rawId : null;
	if (id) usedIds.add(id);
	const split = id ? SPLIT[id] : undefined;
	countries.push({
		key: id ?? name,
		name,
		code: (id && isoCountries.numericToAlpha2(id)) || CODE_BY_NAME[name] || null,
		regionKeys: split ? regions.filter((r) => r.country === split).map((r) => r.key) : null,
	});
	if (!split) areas.push(shape(id ?? name, name, f, worldColors[i]));
});

regionFeatures.forEach((f, i) => {
	const { key, name, country } = f.properties;
	areas.push(shape(key, `${name}, ${COUNTRY_LABEL[country]}`, f, regionColors[i]));
});

const parks = parksData.flatMap((p) => {
	const point = projection([p.lon, p.lat]);
	if (!point) return [];
	return [
		{
			key: p.key,
			name: p.name,
			// The name without "National Park" and friends, for compact lists.
			short: p.name.replace(/ National Park( Reserve| and Reserve| and Preserve)?$/, ''),
			country: p.country,
			region: p.region,
			x: round(point[0]),
			y: round(point[1]),
		},
	];
});

const keys = [...areas.map((a) => a.key), ...parks.map((p) => p.key)];
if (new Set(keys).size !== keys.length) throw new Error('duplicate keys in the map data');

const json = JSON.stringify({ width: WIDTH, height: HEIGHT, areas, countries, regions, parks });
await writeFile(OUT, json);
console.log(`  ${areas.length} shapes, ${parks.length} parks, ${countries.length} countries  ${(json.length / 1024).toFixed(0)} KB -> ${OUT}`);
