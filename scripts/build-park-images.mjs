/**
 * Downloads a photo for each national park into public/parks/ and writes
 * src/data/parkImages.json, which records who took each one and under what licence.
 *
 * Source: the park's main image on Wikidata, hosted by Wikimedia Commons, which
 * also serves a resized thumbnail. Only images under a licence that allows reuse
 * with credit are kept (public domain, CC0, CC BY, CC BY-SA); anything else is
 * skipped, and that park simply has no photo. The photographer's name and licence
 * are shown in the app's photo credits, which is what the CC licences require.
 *
 * Reads src/data/parks.json. Files that already exist are not downloaded again.
 * Run with: npm run data:images
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = 'public/parks';
const OUT_JSON = 'src/data/parkImages.json';
const THUMB_WIDTH = 300;
const HEADERS = { 'User-Agent': 'scratch-map/0.1 (personal project; https://github.com/eltabre)' };

/** Licences that allow reuse with credit. "Attribution" alone is too vague to trust. */
const ALLOWED = /^(public domain|cc0|cc by(-sa)? \d)/i;

const exists = (file) => stat(file).then(() => true, () => false);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Commons descriptions carry HTML; the credit only needs the text. */
function plainText(html = '') {
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, "'")
		.replace(/\s+/g, ' ')
		// Commons fills in this boilerplate when the author is only inferred.
		.replace(/^No machine-readable author provided\.\s*/i, '')
		.replace(/\s*assumed \(based on copyright claims\)\.?$/i, '')
		.trim();
}

async function json(url) {
	const response = await fetch(url, { headers: HEADERS });
	if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
	return response.json();
}

const parks = JSON.parse(await readFile('src/data/parks.json', 'utf8'));
const ids = parks.map((p) => p.key.replace('park:', ''));

// Every image Wikidata lists for each park.
const sparql = `SELECT ?p ?img WHERE { VALUES ?p { ${ids.map((i) => `wd:${i}`).join(' ')} } ?p wdt:P18 ?img }`;
const rows = (await json('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql))).results.bindings;
const candidates = {};
for (const row of rows) {
	const id = row.p.value.split('/').pop();
	const file = decodeURIComponent(row.img.value.split('/Special:FilePath/').pop());
	(candidates[id] ??= []).push(file);
}

// Licence, credit and thumbnail for every candidate file, 40 per request.
const info = {};
const files = [...new Set(Object.values(candidates).flat())];
for (let i = 0; i < files.length; i += 40) {
	const titles = files.slice(i, i + 40).map((f) => `File:${f}`).join('|');
	const url =
		'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=' +
		THUMB_WIDTH +
		'&titles=' +
		encodeURIComponent(titles);
	for (const page of Object.values((await json(url)).query.pages)) {
		const image = page.imageinfo?.[0];
		if (!image) continue;
		const meta = image.extmetadata ?? {};
		info[page.title.replace(/^File:/, '').replaceAll(' ', '_')] = {
			thumb: image.thumburl,
			page: image.descriptionurl,
			license: meta.LicenseShortName?.value ?? '',
			licenseUrl: meta.LicenseUrl?.value ?? '',
			artist: plainText(meta.Artist?.value) || plainText(meta.Credit?.value) || 'Unknown',
		};
	}
	await sleep(300);
}

await mkdir(OUT_DIR, { recursive: true });
const result = {};
for (const park of parks) {
	const id = park.key.replace('park:', '');
	// Prefer public domain, then whichever allowed image Wikidata lists first.
	const usable = (candidates[id] ?? [])
		.map((f) => info[f.replaceAll(' ', '_')])
		// A credit-required licence with no author to credit can't be honoured, so skip those.
		.filter((i) => i?.thumb && ALLOWED.test(i.license) && (i.artist !== 'Unknown' || /public domain|cc0/i.test(i.license)));
	const pick = usable.find((i) => /public domain|cc0/i.test(i.license)) ?? usable[0];
	if (!pick) {
		console.error(`  no usable photo: ${park.name}`);
		continue;
	}

	const ext = path.extname(new URL(pick.thumb).pathname).toLowerCase() || '.jpg';
	const file = `${id}${ext}`;
	if (!(await exists(path.join(OUT_DIR, file)))) {
		const response = await fetch(pick.thumb, { headers: HEADERS });
		if (!response.ok) {
			console.error(`  ${park.name}: thumbnail HTTP ${response.status}`);
			continue;
		}
		await writeFile(path.join(OUT_DIR, file), Buffer.from(await response.arrayBuffer()));
		await sleep(250);
	}
	result[park.key] = { file, artist: pick.artist, license: pick.license, licenseUrl: pick.licenseUrl, page: pick.page };
}

await writeFile(OUT_JSON, JSON.stringify(result, null, '\t') + '\n');
console.log(`  ${Object.keys(result).length} of ${parks.length} parks have a photo -> ${OUT_DIR}, ${OUT_JSON}`);
