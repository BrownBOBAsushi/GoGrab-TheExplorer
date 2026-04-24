# GrabExplore Prototype Update v2

## Project Snapshot

`GrabExplore` is now a stronger hackathon prototype for the GrabMaps "Discover the City" track, with the product loop centered around:

- `Tourist mode` as the primary judged experience
- AI-guided nearby food discovery
- stop selection with clearer comparison support
- route + arrival + spin + reward in one continuous flow
- a lightweight `Explore mode` still available as a secondary concept

The app is still intentionally demo-first:

- one frontend file
- one local Node proxy
- no database
- no auth
- graceful fallbacks for map, nearby POIs, directions, and AI recommendations

## What Changed Since `UPDATE.md`

### 1. Tourist mode now feels useful before the user types

Problem:

- The previous flow depended too much on chat input before the map experience felt alive.
- Users could land on the map and not immediately understand what to do next.

What changed:

- Added a persistent `Nearby for you` recommendation tray in Tourist mode.
- The tray appears on load and shows the top nearby stops before any AI prompt.
- Each stop card now includes:
  - icon
  - name
  - category
  - distance
  - deterministic reason tags
- Clicking a tray card:
  - selects the stop
  - recenters the map
  - opens the stop modal

Why it matters:

- The app now has a clear first impression for judges.
- The user does not need to guess the next action.
- The map and recommendation flow feel intentional from the first second.

Relevant code:

- [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:101)
- [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:670)
- [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:1074)

### 2. Stop selection state is now consistent across the experience

Problem:

- The selected stop was not visually strong enough across tray, markers, and modal flow.
- After route or reward interactions, users could lose context.

What changed:

- Added explicit `selectedPoiId` state.
- Added `recommendedPois` state for the tray.
- Selected stops now remain visually active across:
  - the recommendation tray
  - the custom POI markers
  - modal interactions
- Reward continuation now points users back into the nearby-stop loop instead of dropping them into a dead end.
- Added a `Recenter` floating button to snap back to the player/current location.

Why it matters:

- This improves clarity during demo narration.
- Users can compare, choose, route, spin, and continue without losing their place.

Relevant code:

- [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:948)
- [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:1149)
- [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:1647)

### 3. Nearby POIs are now filtered to be more believable and locally relevant

Problem:

- Live nearby results were surfacing irrelevant places like utilities or employment agencies.
- Earlier fallback data also pointed to Tiong Bahru even when the user was clearly elsewhere.

What changed:

- Replaced misleading Tiong Bahru mock POIs with neutral One-North-area demo stops.
- Added backend filtering to keep only food-like nearby results within a realistic radius.
- Preserved mock fallback behavior if the live nearby data is weak.

Why it matters:

- This protects the hidden-gems story during demo.
- It reduces the chance of judges seeing obviously wrong or off-theme recommendations.

Relevant code:

- [server/index.js](/C:/GitHub/GoGrab-TheExplorer/server/index.js:22)
- [server/index.js](/C:/GitHub/GoGrab-TheExplorer/server/index.js:230)
- [server/index.js](/C:/GitHub/GoGrab-TheExplorer/server/index.js:636)

### 4. The app now targets the official Grab-authenticated map flow

Problem:

- Earlier versions were using raw MapLibre bootstrap only.
- The hackathon docs recommend the GrabMaps Library path, so the project needed to move closer to that requirement.

What changed:

- Added a backend proxy for:
  - `/api/style.json`
  - `/api/grabmaps/*`
- The frontend now attempts to initialize through the hosted GrabMaps Library bundle:
  - `https://maps.grab.com/developer/assets/js/grabmaps.es.js`
- The app resolves the underlying map instance so the existing custom gameplay layer can keep working.
- If the hosted library fails, the app still falls back to the previous raw MapLibre path instead of breaking completely.

Important implementation note:

- This is now a real GrabMaps Library-first bootstrap path.
- The gameplay layer still depends on raw map methods such as `project`, `addLayer`, `fitBounds`, and event listeners.
- Because of that, the app currently uses a compatibility approach:
  - initialize with `GrabMapsLib`
  - then work with the underlying map instance for the custom overlay/game logic

Why it matters:

- This closes the biggest requirement gap around the map layer.
- It keeps the prototype aligned with Grab’s docs while preserving the existing custom experience.

Relevant code:

- [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:806)
- [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:875)
- [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:1521)
- [server/index.js](/C:/GitHub/GoGrab-TheExplorer/server/index.js:549)

### 5. Overlay positioning was fixed after the GrabMaps Library migration

Problem:

- After the library migration, panning exposed a positioning bug:
  - the player dot no longer stayed tied to the real current location
  - pokestops looked like they were floating with the UI instead of remaining anchored to the map
- The root cause was that projected map coordinates were being treated as full-window coordinates instead of viewport-relative coordinates inside the actual map container.

What changed:

- Added shared projection helpers that convert map coordinates into correct viewport positions using the real map container bounds.
- Updated all custom overlay systems to use that shared coordinate model:
  - player marker
  - POI marker layer
  - fog-of-war reveal rendering
  - proximity spin detection

Why it matters:

- Panning now behaves correctly again.
- The custom game UI feels attached to the map, not detached from it.

Relevant code:

- [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:823)
- [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:1334)
- [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:1617)
- [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:2023)

## Current Architecture

- Frontend: [GrabExplore.html](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html)
  - GrabMaps Library-first map bootstrap
  - fallback raw MapLibre bootstrap
  - custom DOM-based POI layer
  - custom player marker
  - recommendation tray
  - chatbot panel
  - modal flow for info, spin, missions, reward
  - fog-of-war canvas for Explore mode

- Backend: [server/index.js](/C:/GitHub/GoGrab-TheExplorer/server/index.js)
  - `/api/style.json`
  - `/api/grabmaps/*`
  - `/api/tiles`
  - `/api/nearby`
  - `/api/directions`
  - `/api/chat`
  - `/api/reviews`

## Current Strongest Demo Flow

1. App loads in Tourist mode.
2. User immediately sees nearby stop recommendations in the tray.
3. User can either:
   - tap a recommendation card immediately, or
   - ask the AI for a preference-based recommendation set.
4. AI or nearby logic highlights the most relevant stops.
5. User opens a stop modal.
6. User sees:
   - stop details
   - comparison/review notes
   - directions button
   - Grab deep-link button
7. User taps `How to get there`.
8. The route is drawn from the freshest available live/current location.
9. User arrives or uses `Demo Jump`.
10. Spin unlocks.
11. Reward screen appears.
12. User continues to the next nearby stop.

## Deliberate Tradeoffs Still In Place

- The app is still optimized for laptop demo clarity over production architecture.
- The custom gameplay layer still sits above the map rather than being fully rebuilt as native map layers.
- Mock POIs still remain as a resilience fallback.
- Explore mode still exists, but Tourist mode remains the primary judged experience.
- Real voucher redemption is still not implemented.
- The app still prioritizes stability over ambitious secondary features.

## Known Gaps / Final Demo Checks

- Re-test the full GrabMaps Library path in the exact browser environment used for the live demo.
  - The app now tries the hosted library first, but this should still be verified live.
- Re-test panning, recentering, route drawing, and overlay alignment after each map-related tweak.
- Confirm whether the AI provider story is aligned across:
  - code
  - pitch
  - slides
- Validate live nearby POI quality with the real event credentials.
  - If results are noisy, stay on curated fallback POIs during the pitch.
- Do one final end-to-end run:
  - recommendation tray
  - AI prompt
  - route draw
  - Demo Jump
  - spin
  - reward continuation

## Bottom Line

`GrabExplore` is now materially stronger than the earlier snapshot:

- the first-load UX is clearer,
- nearby recommendations feel intentional,
- stop comparison is easier,
- the map stack is closer to the official GrabMaps path,
- and the overlay/gameplay systems have been repaired to stay visually attached to the map.

The product story is now cleaner for judges:

- open the app
- immediately see useful nearby discovery
- ask the AI for taste-based refinement
- route to a stop
- arrive
- spin
- earn a reward

That is the right level of ambition for a live hackathon demo: focused, coherent, and resilient.
