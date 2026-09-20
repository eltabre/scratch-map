/**
 * Downloads a small PNG of every US state and Canadian province flag into
 * public/flags/regions/<ISO 3166-2 code>.png.
 *
 * Source: Wikimedia Commons, which renders the SVG flags to a thumbnail on
 * request. Thumbnails keep the files small; some state flags are hundreds of
 * KB as SVG because of their seals. Flags of governments are generally public
 * domain, but check Commons for each file's licence before reusing them
 * elsewhere.
 *
 * Reads src/data/regions.json, so run `npm run data:regions` first. Files that
 * already exist are skipped. Run with: npm run data:flags
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { feature } from 'topojson-client';

const OUT = 'public/flags/regions';
const WIDTH = 160;
const HEADERS = { 'User-Agent': 'scratch-map/0.1 (personal project; https://github.com/eltabre)' };

/** Commons file names that are not simply "Flag_of_<name>.svg". */
const FILE_OVERRIDES = {
	'US-GA': 'Flag_of_Georgia_(U.S._state).svg',
	'CA-NT': 'Flag_of_the_Northwest_Territories.svg',
	'CA-QC': 'Flag_of_Quebec.svg',
};

const exists = (file) => stat(file).then(() => true, () => false);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const topo = JSON.parse(await readFile('src/data/regions.json', 'utf8'));
const regions = feature(topo, topo.objects.regions).features.map((f) => f.properties);

await mkdir(OUT, { recursive: true });
let fetched = 0;
for (const { key, name } of regions) {
	const target = `${OUT}/${key}.png`;
	if (await exists(target)) continue;

	const file = FILE_OVERRIDES[key] ?? `Flag_of_${name.replaceAll(' ', '_')}.svg`;
	const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${WIDTH}`;
	const response = await fetch(url, { headers: HEADERS, redirect: 'follow' });
	if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
		console.error(`  ${key}: ${file} -> HTTP ${response.status}`);
		continue;
	}
	await writeFile(target, Buffer.from(await response.arrayBuffer()));
	fetched++;
	await sleep(250);
}
console.log(`  ${fetched} flags downloaded, ${regions.length} regions -> ${OUT}`);
