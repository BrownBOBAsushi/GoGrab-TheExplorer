# GoGrab — Discover Singapore

A city-discovery game built on GrabMaps data. Tell the AI what you love, find hidden local food stops, walk there, spin the stop, earn rewards. Or toggle fog-of-war and explore the city RPG-style — your call.

Built solo for the **GrabMaps API Hackathon** · April 24, 2026 · Singapore · Track: Discover the City

---

## What it does

GoGrab has two modes that share a single map and player sprite.

### Tourist Mode (default)
An AI trip-planning chatbot asks what kind of food or experience you're after. It queries GrabMaps live data through the MCP API, finds the three nearest matching stops, and highlights them on the map with pulsing markers. Tap a card to inspect the stop — see the name, category, distance, and curated comparison notes. When you're within range, the spin mechanic unlocks. Spin the disc, complete three auto-triggered missions, and earn a GrabFood voucher. At any point you can tap "How to get there" for a live walking route drawn on the map, or "Book a GrabCar" to deep-link into the Grab app.

### Explore Mode
Toggle the fog-of-war switch. The map goes dark. Move your player avatar with WASD or the on-screen joystick — the fog clears as you go, revealing hidden stops organically. No AI guidance, pure discovery driven by where you walk.

---

## Features

| Feature | Detail |
|---|---|
| **GrabMaps tiles** | Raster map proxied through local server (CartoDB Dark Matter fallback when GrabMaps tile key absent) |
| **Live nearby POIs** | GrabMaps MCP `search_nearby_pois` → keyword search fallback → curated mock POIs |
| **AI trip planner** | Groq `llama-3.3-70b-versatile` reads live GrabMaps search results and returns 3 matched recommendations |
| **Fuzzy POI matching** | Character-intersection scoring prevents silent match failures between AI names and POI array |
| **Walking directions** | GrabMaps MCP `navigation` → Partner API fallback → straight-line dotted fallback with Haversine ETA |
| **Proximity spin lock** | Spin only unlocks when player avatar is within 80 screen-pixels of the marker |
| **Demo Jump** | Teleports avatar to the open POI instantly — proximity lock unlocks, spin activates |
| **Mini-missions** | Three missions auto-complete sequentially (📸 +50 / ⭐ +30 / 🍽️ +20 pts) before the reward screen |
| **Reward voucher** | `GRABEXP-XXXXXX` GrabFood voucher card with randomised code and total points earned |
| **Fog of war** | HTML5 Canvas overlay; radial gradients reveal a 130px trail wherever the player has walked |
| **GPS integration** | `watchPosition` keeps avatar and POI distances live; `getFreshGeolocation` called before every API query |
| **Points HUD** | Running total of ⭐ pts and % of map explored, top-right |
| **GrabCar deep link** | `grab://open?destination=…` with `https://grab.com` fallback |

---

## Project structure

```
GoGrab-TheExplorer/
├── GrabExplore.html            # Single-page app shell (HTML + layout)
├── assets/
│   ├── css/
│   │   └── grab-explore.css    # All styles — map, HUD, modal, fog, particles
│   └── js/
│       ├── 01-config.js        # Constants, POI seed data, map helpers, GrabMapsLib loader
│       ├── 02-poi-state.js     # State store, POI normalisation, recommendation tray, reviews
│       ├── 03-player-routing.js # Player movement, GPS sync, directions, route drawing, Grab deep link
│       ├── 04-map-modal.js     # Map init, POI markers, modal views, spin disc, missions→reward flow
│       ├── 05-effects-input.js # Fog of war, keyboard, joystick, particles, toast, HUD update
│       └── 06-app-flow.js      # Game loop, mode toggle, chatbot, GPS watcher, bootstrap
└── server/
    ├── index.js                # Express proxy — all API keys hidden server-side
    ├── package.json
    ├── .env                    # API keys (gitignored)
    └── .gitignore
```

The scripts load in numbered order. Each file depends only on globals declared in earlier files — no bundler needed.

---

## Tech stack

**Frontend**
- [MapLibre GL JS](https://maplibre.org/) v3.6.2 (CDN) — map rendering
- HTML5 Canvas — fog of war overlay
- Vanilla JS — joystick, game loop, all UI interactions
- CSS keyframes + `requestAnimationFrame` — animations
- Google Fonts CDN — Syne, DM Sans, JetBrains Mono

**Backend (Node.js proxy — runs locally)**
- [Express](https://expressjs.com/) — HTTP server
- [node-fetch](https://github.com/node-fetch/node-fetch) — upstream API calls
- [dotenv](https://github.com/motdotla/dotenv) — environment variable loading
- [cors](https://github.com/expressjs/cors) — allow browser fetch from `localhost:3000`

**External APIs** (all keys server-side, never in browser)
- **GrabMaps MCP** — `search_nearby_pois`, `search`, `navigation` tools via JSON-RPC over SSE
- **GrabMaps Partner API** — `/maps/place/v2/nearby` and `/maps/eta/v1/direction` (fallback if no MCP token)
- **Groq** — `llama-3.3-70b-versatile` for trip planning chat
- **CartoDB Dark Matter** — raster tile fallback when GrabMaps tile URL is absent

---

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/BrownBOBAsushi/GoGrab-TheExplorer.git
cd GoGrab-TheExplorer/server
npm install
```

### 2. Create `server/.env`

```env
# GrabMaps — at least one of these is required for live POI data
GRABMAPS_MCP_TOKEN=your_mcp_token_here
GRABMAPS_API_KEY=your_partner_api_key_here

# Optional: override the MCP endpoint (defaults to https://maps.grab.com/api/v1/mcp)
GRABMAPS_MCP_URL=https://maps.grab.com/api/v1/mcp

# Optional: GrabMaps raster tile URL (omit to use CartoDB fallback)
GRABMAPS_TILE_URL=https://maps.grab.com/api/maps/tiles/v2/...

# Groq — required for the AI trip planner
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

Key priority for live data:

| Credential | Effect if absent |
|---|---|
| `GRABMAPS_MCP_TOKEN` | Falls back to Partner API, then mock POIs |
| `GRABMAPS_API_KEY` | Falls back to mock POIs |
| `GRABMAPS_TILE_URL` | Uses CartoDB Dark Matter raster tiles |
| `GROQ_API_KEY` | Returns hardcoded fallback recommendations |

The app is fully functional with no keys — it uses curated mock Singapore POIs and CartoDB tiles.

### 3. Start the server

```bash
node index.js
# → GoGrab proxy running on http://localhost:3000
```

### 4. Open in browser

```
http://localhost:3000
```

The server also serves the static frontend, so no separate dev server is needed.

---

## API routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/tiles/:z/:x/:y` | Map tile proxy (GrabMaps or CartoDB) |
| `GET` | `/api/nearby?lat=&lng=&radius=` | Nearby food POIs — MCP → Partner API → mock |
| `GET` | `/api/directions?originLat=&originLng=&destLat=&destLng=` | Walking route — MCP → Partner API → straight-line |
| `GET` | `/api/reviews?id=&name=&lat=&lng=&category=` | POI comparison notes — mock bundle or fallback |
| `POST` | `/api/chat` | Trip planner — Groq + live MCP search |
| `GET` | `/api/style.json?theme=` | GrabMaps vector style proxy (available, unused by default) |
| `GET` | `/api/grabmaps/*` | Generic GrabMaps asset proxy with auth header injection |
| `GET` | `/api/health` | Key configuration status check |

---

## How the game loop works

```
DOMContentLoaded
  └─ initFog()               — size fog canvas, attach resize listener
  └─ initMap()               — MapLibre with CartoDB/Grab tiles
  └─ buildPOILayer()         — create maplibregl.Marker per POI
  └─ refreshTouristPOIs()    — reveal all markers, set nearest 3 as recommended
  └─ initKeyboard()          — WASD + backtick debug panel
  └─ updateHUD()
  └─ tryGPS()                — getCurrentPosition + watchPosition

dismiss() (onboard screen)
  └─ requestAnimationFrame(gameLoop)
  └─ fetchNearbyPOIs()       — fresh GPS → /api/nearby → replacePOIs()

gameLoop (every frame)
  └─ updatePOIPositions()    — show/hide markers per mode
  └─ updatePlayerVisualPosition()
  └─ updateSpinState()       — if modal open: check 80px proximity
  └─ renderFog()             — if explore mode: redraw canvas
```

Player movement is joystick-driven (drag events) or WASD keyboard. The map follows the player — the player sprite stays centred (fixed HUD element), the world moves underneath via `map.jumpTo()`.

---

## Gameplay flow

```
Onboard screen
  └─ "START EXPLORING" → dismiss()

Tourist mode (default)
  ├─ Chatbot: type food preference
  │     └─ /api/chat (Groq + GrabMaps MCP search)
  │           └─ 3 POI markers highlight + pulse gold
  │                 └─ Map pans to first recommendation
  │
  ├─ Tap POI marker / recommendation card
  │     └─ Info modal: name, category, distance, reviews
  │           ├─ "How to get there" → /api/directions → green polyline on map
  │           ├─ "Book a GrabCar" → grab:// deep link
  │           └─ "SPIN THIS STOP" (locked until within 80px)
  │
  ├─ Get close (or tap Demo Jump)
  │     └─ Spin button unlocks
  │           └─ Drag disc 400° to trigger spin
  │
  └─ Reward flow
        ├─ Missions view: 3 missions auto-complete at 1.5s / 2.2s / 2.9s
        │     └─ Each: ✅ icon, +pts, particles, running total label
        └─ Reward screen at 3.8s: total pts + GrabFood voucher code + confetti

Explore mode (fog toggle)
  └─ Map goes dark → walk to reveal → POIs appear organically when entered
```

---

## Key design decisions

**Why CartoDB tiles instead of GrabMaps vector style?**
MapLibre requires absolute URLs for sprites and glyphs. The GrabMaps style JSON uses relative paths that resolve only inside Grab's own hosting environment. Rather than fight that in a hackathon, the app uses CartoDB Dark Matter raster tiles (proxied through the local server to avoid CORS) which are visually appropriate for the dark theme. GrabMaps data still powers everything that matters: nearby POIs, directions, and search.

**Why Groq instead of Anthropic for the chatbot?**
The MCP-based GrabMaps integration was prototyped and tested against Groq's `llama-3.3-70b-versatile`. It's faster for short JSON-structured outputs, and the live POI search layer on top of it means the model rarely needs to hallucinate place names — it's choosing from live GrabMaps results.

**Why fuzzy matching?**
Groq returns POI names as free text. Exact string comparison silently fails when the model slightly rephrases a name. The character-intersection scorer (`shared chars / max length > 0.6`) catches near-misses without needing an embedding model.

**Why separate `liveUserLat/liveUserLng` and `playerLat/playerLng`?**
`playerLat/playerLng` tracks the simulated avatar position (starts at One-North, moves with joystick/WASD). `liveUserLat/liveUserLng` is the device's real GPS. API queries (nearby POIs, directions, chat) use the live GPS when available so results reflect the user's actual location, not where the avatar happens to be in the demo simulation.

---

## POI data fallback chain

```
1. GrabMaps MCP search_nearby_pois      → food-filtered, deduplicated live results
2. GrabMaps MCP keyword search fallback → searches "food", "restaurant", "hawker", "bakery", "cafe"
3. GrabMaps Partner API /nearby         → requires GRABMAPS_API_KEY
4. Curated mock POIs                    → 5 Singapore hawker/food stops near One-North
```

Any step that returns usable results stops the chain. All results are filtered through `looksFoodRelated()` and deduplicated before being returned to the client.

---

## Development notes

**Health check:**
```bash
curl http://localhost:3000/api/health
# {"ok":true,"hasGrabKey":true,"hasGrabMcpToken":true,"hasGroqKey":true,"groqModel":"llama-3.3-70b-versatile"}
```

**Debug panel:** Press backtick (`` ` ``) in the browser to toggle the debug overlay. WASD keys are automatically disabled when focus is inside the chat input.

**No persistence** — no user accounts, no database, no leaderboard. Everything resets on page refresh by design.

**Voucher codes** are client-side random (`Math.random().toString(36).substr(2,6).toUpperCase()`) — demo only, not redeemable.

---

## License

Built for hackathon demonstration purposes. Not for production use.
