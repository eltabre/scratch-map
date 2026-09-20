# Scratch Map

A scratch-off world map. Every country starts covered in gold foil; click one
to scratch it away and reveal it in colour. Visited places are saved in your
browser.

- **Countries:** all 195 countries plus territories, about 240 shapes in total.
- **US states and Canadian provinces:** the US and Canada are drawn as their 50
  states and 13 provinces and territories. Scratching any one marks the country
  as visited.
- **National parks:** the 63 US national parks and 48 Canadian national parks
  and park reserves, as dots on the map. Marking a park also marks the state or
  province it is in (a park that spans several gets the one its coordinate is in).
- **Lists:** country flags, state and province flags, and parks as arched photo
  badges. They dim until visited, show the name on hover, and double as a
  keyboard-friendly way to mark places. Counters in the header track progress.
- **Size slider:** the Size slider above the lists scales the flags and park
  badges from about 0.6x to 2.2x, and is remembered between visits.
- **Full-screen map:** click the open tab again, or the arrow at the right of the
  tab row, to hide the lists and let the map fill the screen.

Click a place to scratch it off; click again to cover it back up. Scroll or pinch
to zoom, drag to pan.

## Data

The map is plain SVG, projected with `d3-geo`. Nothing is fetched at runtime.

| What | Source | How it gets here |
| --- | --- | --- |
| Country shapes | [world-atlas](https://github.com/topojson/world-atlas) 50m (Natural Earth) | npm dependency |
| US states, Canadian provinces | Natural Earth 50m admin-1, with the Great Lakes cut out using Natural Earth's lakes | `npm run data:regions` writes `src/data/regions.json` |
| National parks | Wikidata | `npm run data:parks` writes `src/data/parks.json` |
| State and province flags | Wikimedia Commons | `npm run data:flags` writes `public/flags/regions/*.png` |
| Park photos and credits | Wikimedia Commons | `npm run data:images` writes `public/parks/*` and `src/data/parkImages.json` |

The generated files are committed, so builds never touch the network. Rerun the
scripts only to refresh the data, and in this order: regions, then parks and
flags (both read the regions file). The parks script patches a few Wikidata gaps
and coastal parks by hand (see the comments in `scripts/build-parks.mjs`).

Park photos are only kept when their Commons licence allows reuse with credit
(public domain, CC0, CC BY, CC BY-SA) and there is an author to credit. Each one
is credited in the "Photo credits" list at the bottom of the parks tab. A few
parks have no photo for that reason and show a plain badge.

## Layout

```
src/
  App.tsx, App.css        page layout, header, tabs, collapse
  components/
    map/                  WorldMap and its styles
    lists/                Countries, States & provinces and Parks tabs
    Tooltip.tsx           shared hover tooltip
  hooks/                  useVisited (saved progress), useTileSize (list size)
  lib/                    geo.ts builds every shape, region and park from the data
  data/                   generated JSON (regions, parks, park photo credits)
scripts/                  the data:* generators above
```

`@/` is an alias for `src/`.

## Develop

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## Deploy

Pushes to `main` build and deploy to GitHub Pages via
[.github/workflows/deploy.yml](.github/workflows/deploy.yml). Enable Pages
for the repo (Settings → Pages → Source: GitHub Actions). `base` in
[vite.config.ts](vite.config.ts) is already set to `/scratch-map/`.
