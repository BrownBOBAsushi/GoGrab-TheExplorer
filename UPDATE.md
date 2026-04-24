# GrabExplore Prototype Update

## Project Snapshot

`GrabExplore` is the current hackathon prototype for the GrabMaps "Discover the City" track.

The product direction is:

- Build a single-screen discovery experience that turns GrabMaps POI and routing data into a lightweight city exploration game.
- Support two user mindsets in one app:
  - `Tourist mode`: ask the AI what the user likes, highlight matching nearby food stops, route them there, then reward them after arrival.
  - `Explore mode`: optional fog-of-war / RPG-style discovery mode for later polish, not the main dependency for demo success.
- Keep the implementation demo-friendly and resilient: one frontend file, one local Node proxy, graceful fallbacks everywhere, no database, no auth, no deployment dependency.

The current prototype is optimized for a live demo first, not for production completeness.

## Decisions We Locked In

- Lead with Grab's strength, not a Google comparison.
  - The product story is built around GrabMaps' hyperlocal knowledge from rides and orders, especially food discovery in Singapore.
- Keep the experience to one coherent loop.
  - Ask preference -> show 3 POIs -> open modal -> get directions / book Grab -> arrive -> spin -> reward.
- Use a single-page frontend with a local proxy backend.
  - This keeps iteration fast and avoids exposing API keys in the browser.
- Build tourist mode first and treat fog-of-war as optional.
  - Explore mode is still part of the concept, but it should never block the core demo flow.
- Add explicit demo safeguards instead of pretending laptop behavior is real GPS behavior.
  - Demo Jump exists so the spin mechanic never stalls.
  - The judge framing is "GPS in the real app, joystick for the demo."
- Prefer believable local mock POIs over weak live results.
  - If live nearby data is chain-heavy or sparse, the prototype should still tell a strong hidden-gems story.
- Use fuzzy POI matching between AI text output and map POIs.
  - Exact string matching was too brittle and created silent failures.
- Keep "How to get there" inside the same modal flow.
  - Directions are part of the decision moment, not a separate screen.
- Add comparison help in the POI modal.
  - Users should be able to compare which stop feels more appealing before committing to one.

## Current Architecture

- Frontend: [`GrabExplore.html`](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html)
  - MapLibre map
  - custom POI layer
  - centered player marker
  - chatbot panel
  - modal flow for stop info, spin, missions, reward
  - optional fog-of-war canvas
- Backend: [`server/index.js`](/C:/GitHub/GoGrab-TheExplorer/server/index.js)
  - `/api/tiles`
  - `/api/nearby`
  - `/api/directions`
  - `/api/chat`
  - `/api/reviews`

Important current implementation note:

- The planning/chat route is currently wired to `GROQ_API_KEY` and `llama-3.3-70b-versatile`, not Anthropic Codex.
- The project brief and pitch notes still describe the AI as Codex/Anthropic.
- Before final submission or pitching, the code, slide copy, and spoken demo should be aligned to one provider/model story.

## What Changed In This Prototype Round

### 1. Route origin now prefers the real live location

Problem:

- "How to get there" was not reliably routing from the user's actual current location.
- Depending on app state, the route could start from the in-app player position or browsed map position instead of the freshest live GPS fix.

What we changed:

- Added live GPS state tracking separate from the player state.
- Added a fresh geolocation lookup when the user taps "How to get there".
- Route origin selection now prefers:
  - fresh browser GPS,
  - then last known live GPS,
  - then the in-app player position as fallback.
- Added route metadata pills in the modal so the user can see:
  - where the route started from,
  - distance and duration when available.
- Fit the map to the route after drawing it, instead of leaving the route potentially half off-screen.

Relevant code:

- [`GrabExplore.html`](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:581)
- [`GrabExplore.html`](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:882)
- [`GrabExplore.html`](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:1397)

### 2. First-launch GPS behavior was tightened

Problem:

- Even with location permission granted, the green player dot could appear offset from the user's actual location on first launch.
- Startup ordering between map load, initial player placement, and first GPS lock was not authoritative enough.

What we changed:

- Added a dedicated `syncPlayerToMap()` helper to make first GPS lock deterministic.
- On the first valid GPS fix, the app now:
  - exits browse mode,
  - snaps the map to the player,
  - redraws the player marker,
  - seeds reveal state from the live position.
- Added a `watchPosition` path so the app can maintain live GPS state after startup.

Relevant code:

- [`GrabExplore.html`](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:882)
- [`GrabExplore.html`](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:1095)
- [`GrabExplore.html`](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:1821)

### 3. Reviews / comparison notes were added to the POI modal

Problem:

- Once users saw multiple recommendations, there was not enough help for deciding which stop they actually preferred.
- The user requested online reviews if possible.

What we changed:

- Added a `Reviews & vibe` section directly in the POI info modal.
- Added a backend `/api/reviews` route to supply review data to the frontend.
- Added curated review bundles to the mock POIs so the demo remains strong even without a live public review provider.
- Added fallback generated comparison notes for live POIs that do not yet have curated review data.

Why this decision was made:

- We wanted to improve stop comparison immediately without introducing another brittle external dependency during the prototype stage.
- A curated fallback is better than an empty review section during a live demo.

Relevant code:

- [`GrabExplore.html`](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:585)
- [`GrabExplore.html`](/C:/GitHub/GoGrab-TheExplorer/GrabExplore.html:963)
- [`server/index.js`](/C:/GitHub/GoGrab-TheExplorer/server/index.js:21)
- [`server/index.js`](/C:/GitHub/GoGrab-TheExplorer/server/index.js:550)

### 4. Demo reliability stayed a priority over "full realism"

This round reinforced earlier project decisions rather than replacing them:

- `Demo Jump` stays in the flow because it guarantees the arrival/spin moment.
- The reward loop remains intact after a successful stop spin.
- Fallback directions still exist if the live directions API fails.
- Mock POIs still backstop weak nearby results.
- The prototype still avoids auth, persistent storage, and unnecessary backend complexity.

## Current Product Flow

The strongest current demo path is:

1. App loads and requests location.
2. Player centers on live location.
3. Tourist asks for a preference in the AI panel.
4. AI returns matching food stops.
5. Highlighted POIs appear on the map.
6. User taps a stop.
7. Modal shows:
   - stop details,
   - route controls,
   - Grab deep-link CTA,
   - comparison notes / reviews.
8. User taps `How to get there`.
9. Route is drawn from the current live location where possible.
10. User arrives or uses `Demo Jump`.
11. Spin unlocks.
12. Reward and missions appear.

## Deliberate Tradeoffs

- We did not integrate a true live public reviews provider yet.
  - The app uses curated and fallback comparison notes instead.
  - This was a deliberate stability tradeoff.
- We did not prioritize mobile responsiveness.
  - The project brief explicitly treats this as a demo prototype, and the main presentation environment is a laptop.
- We did not build accounts, redemption infrastructure, or real reward redemption logic.
  - Those would add complexity without helping the core pitch.
- We did not force the app to always follow live GPS after startup.
  - The current behavior is to center correctly on first launch and preserve live GPS for routing, while still allowing in-app exploration and demo movement.

## Known Gaps / Cleanup Before Final Demo

- Align the AI provider story.
  - Code currently uses Groq.
  - Project notes and pitch materials still reference Codex/Anthropic.
- Decide whether the `Reviews & vibe` section should remain labeled as comparison notes if no real public review provider is added.
- Test nearby quality with the actual GrabMaps credentials at the venue.
  - If results are weak, continue using mock POIs for the live demo.
- Re-test first-launch GPS behavior in the actual browser and laptop environment that will be used on stage.
- Rehearse the route + Demo Jump + spin flow end-to-end multiple times to make sure the route draw and arrival step feel smooth.

## Recommended Commit Message Direction

If helpful, this prototype snapshot would fit a commit message like:

- `prototype: improve live GPS routing and add POI comparison notes`
- `prototype: stabilize first-load GPS and add reviews section`
- `prototype: tighten routing flow and demo decision support`

## Bottom Line

This prototype is now stronger in three important ways:

- it routes more credibly from the user's current location,
- it explains stops better so users can compare them,
- and it behaves more reliably on first launch.

The project still follows the same core strategy: keep the demo loop simple, believable, and resilient, and only add features that make the live story clearer rather than riskier.
