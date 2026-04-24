# GrabExplore Prototype Update v3

## Purpose

This note is a handoff for Claude to review a new visual regression on the current `localhost:3000` build.

Important context:

- The latest code parses successfully.
- The browser behavior is now worse than before.
- Do not assume the most recent fixes are correct.
- Please review the current rendering path first before making more UI/map changes.

## Current Repo State

The working tree currently has local modifications in these files:

- `assets/css/grab-explore.css`
- `assets/js/01-config.js`
- `assets/js/02-poi-state.js`
- `assets/js/03-player-routing.js`
- `assets/js/04-map-modal.js`
- `server/index.js`

There are no other active app-layer edits outside those files in the current session.

## What Changed Right Before The Regression

There were two recent rounds of fixes.

### Round 1

This round addressed four review findings:

1. Re-enabled the Grab map bootstrap path.
2. Restored seeded/mock POI availability on startup.
3. Restored mock fallback from `/api/nearby`.
4. Made demo movement prefer the simulated player position over live GPS for spin checks.

### Round 2

After the user reported the map and marker behaving like two separate draggable layers, the latest patch tried to simplify the rendering model:

1. Switched the app back to a fixed HUD player sprite instead of a map-attached `maplibregl.Marker`.
2. Switched the default map path to raw `MapLibre` plus proxied Grab style, instead of the hosted `GrabMapsLib` widget path.
3. Removed the `playerMarker` code path.
4. Kept the custom POI markers as `maplibregl.Marker` DOM elements.

That second patch is the point after which the user said the app became worse.

## Current User-Reported Problem

The user now reports:

- "it's worse now"
- the map and marker behavior is broken
- they want a review document for Claude instead of more blind patching

## Current Observed Runtime Behavior

Based on the latest user screenshot of `http://localhost:3000`:

1. The base map is not visibly rendering.
   - The map area is a flat dark green field.
   - There are no visible roads, labels, tiles, or other Grab/OpenStreetMap visual details.

2. The stop markers appear visually split into two separate vertical stacks.
   - Left stack: filled emoji circles.
   - Right stack: ring/needle outlines.
   - Both stacks appear to represent the same set of POIs, but they are not rendered as one unified marker.

3. The app chrome is still alive.
   - Logo renders.
   - Tourist/Explore toggle renders.
   - HUD renders.
   - Recommendation tray renders in collapsed form and says `3 stops`.
   - Chat launcher renders.

4. This does not look like a total app boot failure.
   - The frontend state is alive.
   - The POI/recommendation state is alive.
   - The visual regression appears specific to map and marker rendering/alignment.

## What The Screenshot Strongly Suggests

These are informed hypotheses, not confirmed root causes:

1. The POI marker is likely being rendered in two different ways at once, or its child parts are being separated by layout/render logic.
2. The base map container exists, but the style/tiles/assets are not being applied correctly.
3. The system may now be in an unstable hybrid state:
   - old compatibility code is still present
   - new raw MapLibre bootstrap is active
   - POIs are still map markers
   - the player is now a fixed HUD element

This is the kind of regression that needs a controlled review, not another fast incremental tweak.

## Expected Behavior

The target behavior is still:

1. One visible base map.
2. One player model.
   - Usually centered in the viewport during normal play.
3. One POI layer.
   - Each stop should render as one unified marker, not split into multiple visual columns.
4. Panning the map should not make marker systems look detached from each other.
5. Tourist mode should still start with visible fallback/demo POIs if live data is weak.

## Relevant Current Code Paths

### `assets/js/01-config.js`

Current important behavior:

- `PREFER_GRABMAPS_LIBRARY = false`
- `buildGrabMapsLibraryMap()` still exists
- `getCurrentPlayerCoords()` now prefers `playerLat/playerLng`

Interpretation:

- The codebase still contains GrabMaps Library compatibility logic.
- The default runtime path is now raw MapLibre, not the hosted Grab widget path.

### `assets/js/03-player-routing.js`

Current important behavior:

- `getPlayerScreenPosition()` returns viewport center unless the user is browsing the map
- the old `playerMarker` map marker path was removed
- the app now paints the player through the fixed DOM node `#player`

Interpretation:

- There is now only one intended player rendering path in code.
- If the user still sees layer drift, it is probably not coming from the player marker code that existed earlier.

### `assets/js/04-map-modal.js`

Current important behavior:

- `initMap()` now creates a raw `new maplibregl.Map(...)`
- it fetches `/api/style.json?theme=basic`
- `buildPOILayer()` creates `maplibregl.Marker` DOM markers for each POI

Interpretation:

- POIs are still map-attached markers.
- The player is no longer a map-attached marker.
- This is now a mixed model by design:
  - map-attached POIs
  - fixed HUD player

That may be valid, but it needs to be visually correct.

### `assets/css/grab-explore.css`

Current important behavior:

- `#player` is now a visible fixed-position HUD element again
- `.poi` is still styled as a custom DOM marker
- `#poiLayer` still exists in CSS and HTML, but the current code path appears to rely on `maplibregl.Marker` for POIs instead

Interpretation:

- There may be leftover architecture from older overlay approaches.
- Claude should verify whether the current code is truly using only one POI rendering path.

### `server/index.js`

Recent changes here restored:

- `/api/nearby` mock fallback
- chat fallback to `MOCK_POIS`

Interpretation:

- The server fallback work is important for demo resilience, but it is probably not the direct cause of the current visual duplication.

## Likely Failure Zones Claude Should Review

### 1. Base map style loading

Please verify all of the following in the browser:

- `/api/style.json` actually returns a valid style payload
- the rewritten asset URLs under `/api/grabmaps/*` are reachable
- the style payload is compatible with raw `MapLibre`
- the map canvas is not silently failing while the app falls back to background color only

Why this matters:

- The screenshot shows no real map detail at all.
- That is now the most obvious user-facing failure.

### 2. POI marker duplication or split composition

Please verify whether the current screenshot is caused by:

- one marker being rendered twice
- marker children being laid out incorrectly inside one wrapper
- two separate render systems both still active
- browser cache mixing old JS/CSS with new JS/CSS

Why this matters:

- The screenshot does not show a normal marker offset.
- It shows what looks like two separate vertical columns for the same stops.

### 3. Hybrid rendering model

Please verify whether the current architecture should be one of these, and only one:

1. `GrabMapsLib` + compatibility access to raw map methods
2. raw `MapLibre` + proxied Grab style

Then verify whether the player and POI rendering model should be one of these, and only one:

1. fixed HUD player + map-attached POIs
2. fully map-attached player + fully map-attached POIs
3. custom overlay player + custom overlay POIs

Current code looks transitional rather than fully settled.

### 4. Last known good baseline

Please identify the last known visual state that was actually working in-browser.

That is important because the recent fixes were driven by reasoning and code review findings, but the user is now telling us the actual browser result regressed.

## Suggested Review Procedure

Please review in this order:

1. Identify the last commit or working-tree state where:
   - the map rendered correctly
   - there was only one visible POI layer
   - the player behavior was acceptable

2. Compare that state to the current rendering path in:
   - `assets/js/01-config.js`
   - `assets/js/03-player-routing.js`
   - `assets/js/04-map-modal.js`
   - `assets/css/grab-explore.css`

3. Check the browser network/devtools behavior for:
   - `/api/style.json`
   - `/api/grabmaps/*`
   - any failed style sprite/glyph/tile requests

4. Check the DOM at runtime for marker duplication.
   - How many `.poi` wrappers exist?
   - Are marker child elements split between multiple containers?
   - Is any old overlay path still attaching visual children?

5. Recommend the smallest reliable rollback or repair.

## Constraints

Please optimize for the hackathon demo, not for architecture purity.

Priority order:

1. One visible base map
2. One stable POI layer
3. One stable player model
4. Reliable tourist-mode demo flow

Less important right now:

- elegant abstraction boundaries
- future-proof architecture
- secondary polish
- Explore mode complexity

## Non-Goals For This Review

This review is not asking for:

- AI provider changes
- reward logic changes
- reviews/comparison redesign
- mobile responsiveness
- new features

This is strictly about fixing the current map/marker rendering regression.

## Explicit Ask For Claude

Please review the current visual regression and answer these questions:

1. What is the most likely root cause of the blank map?
2. What is the most likely root cause of the split or duplicated POI marker stacks?
3. What is the smallest reliable path to restore:
   - one map
   - one POI layer
   - one player model
4. Should the app revert to the previous `GrabMapsLib`-first path, or stay on raw `MapLibre` and fully commit to that path?

If you decide to patch the code, please prefer the smallest repair that restores the demo instead of another broad refactor.
