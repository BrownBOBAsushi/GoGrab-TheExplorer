# AGENTS.md — GrabExplore Hackathon Build Guide
> GrabMaps API Hackathon | April 24, 2026 | 9:00 AM – 8:00 PM SGT
> Venue: 3 Media Cir., Singapore 138498
> Solo build | Track: Discover the City

---

## WHAT CHANGED FROM LAST VERSION (read this first)

| # | Weakness Found | Fix Applied |
|---|---|---|
| 1 | Slide 3 said "Codex API" but backend used GPT-4o — contradiction | Standardised to Codex Codex-sonnet-4-20250514 throughout |
| 2 | Proximity spin mechanic felt gimmicky on laptop | Reframed as arrival confirmation; Demo Jump button added |
| 3 | "33M POIs Google doesn't have" claim unverifiable live | Hardcoded obscure SG mock POIs added; claim gated on API validation |
| 4 | Fog of war in Hour 3 — too risky solo | Moved to Hour 6, cut if behind |
| 5 | AI chatbot → POI matching used exact string — silent failure | Fuzzy matching logic added |
| 6 | Pitch opened with Google — wrong audience | Rewritten to lead with Grab's strength |

---

## 1. THE PITCH (memorise this)

> "GrabMaps knows where people in Singapore actually eat — built from millions of real rides and orders.
> GrabExplore turns that data into a city discovery game.
> First-time tourist? Our AI agent asks what you love, then highlights 3 hidden food spots only GrabMaps knows about.
> Walk there, spin the stop, earn rewards, book a GrabCar — all in one flow.
> For explorers? Toggle fog-of-war mode and discover the city yourself, RPG style."
>
> "Two users. One app. Powered by GrabMaps data no other map has.
> Discover in GrabExplore. Travel with GrabCar. Eat with GrabFood."

**Why this version is stronger:** Opens with Grab's asset, not Google's weakness.
Judges building GrabMaps don't want to hear Google in your first sentence.

---

## 2. WHAT YOU ARE BUILDING

A single-page web app (one HTML file + Node.js backend) with TWO modes:

### MODE 1 — Tourist Mode (default on load)
- **AI Trip Planning chatbot** — bottom left corner, appears on load, powered by Codex Codex-sonnet-4-20250514
- Tourist types their preference: "I love street food"
- Codex API returns 3 nearest food POI recommendations based on user location
- **3 POI markers highlight on map** — glowing, pulsing, numbered 1→2→3
- Tourist taps a stop → sees POI info (name, category, distance, description)
- **Spin is LOCKED** until player sprite moves within 80px of the marker on screen
- When player is close enough: lock icon disappears, "SPIN THIS STOP" button activates
- Tourist taps stop → sees info + directions + GrabCar → navigates there → spin unlocks → spins → missions → voucher

### MODE 2 — Explore Mode (fog of war toggle)
- **Fog of war toggle** — small switch in top left near logo
- Toggle ON: map goes dark, fog covers everything, pure RPG exploration
- Player uses joystick/WASD to move, fog clears as they go
- POIs reveal organically as fog clears — discovery driven, no AI guidance
- Toggle OFF: returns to normal map view with all revealed POIs visible

> ⚠️ **Fog of war is Hour 6 only. Build core loop first. Cut this entirely if behind schedule.**

### Shared across both modes:
- **GrabMaps tiles** via MapLibre GL JS
- **Player sprite** — always centered, world moves underneath
- **Joystick controller** — bottom center, WASD keyboard backup
- **POI tap = info first** — tapping any marker shows place info modal
- **Proximity spin mechanic** — spin only unlocks when player sprite is within 80px of marker
- **Points HUD** — top right, shows pts + % explored
- **Directions route** — "How to get there" draws real route on map
- **Grab deep link** — "Book a GrabCar here" pre-filled with POI destination

**You already have a working prototype from Codex design. Use it as your base. Do NOT start from zero.**

---

## 3. TECH STACK

```
FRONTEND (single HTML file):
  Map rendering:    MapLibre GL JS (CDN)
  Fog of war:       HTML5 Canvas overlay — toggleable on/off
  Joystick:         Vanilla JS (mouse + touch events)
  Chatbot UI:       Simple chat panel, bottom left corner
  Animations:       CSS keyframes + requestAnimationFrame
  Fonts:            Google Fonts CDN — Syne, DM Sans, JetBrains Mono
  API calls:        fetch() to localhost:3000/api/... (never direct)

BACKEND (Node.js proxy — runs locally on your laptop):
  Runtime:          Node.js + Express
  Purpose:          Hide all API keys from browser
  Routes:
    GET  /api/tiles        → proxies GrabMaps Vector Map Tiles API
    GET  /api/nearby       → proxies GrabMaps Nearby API (food POIs)
    GET  /api/directions   → proxies GrabMaps Directions API (route)
    POST /api/chat         → proxies Anthropic Codex API (trip planning agent)
  API keys:         GRABMAPS_API_KEY + ANTHROPIC_API_KEY in .env
  No database. No auth. No deployment — runs on localhost:3000.
```

---

## 4. DAY-OF SETUP — DO THIS FIRST (Hour 1)

### Step 1: Get your GrabMaps API credentials
- Ask the Grab engineers for your API key immediately when you arrive
- Don't wait — others will be asking too

### Step 2: Set up the Node.js proxy server
```bash
mkdir server && cd server
npm init -y
npm install express node-fetch dotenv cors @anthropic-ai/sdk
```

Create `server/index.js`:
```javascript
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

const GRAB_KEY = process.env.GRABMAPS_API_KEY;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Proxy: Nearby API (food POIs)
app.get('/api/nearby', async (req, res) => {
  const { lat, lng, radius } = req.query;
  const url = `GRABMAPS_NEARBY_ENDPOINT?lat=${lat}&lng=${lng}&radius=${radius}&category=food&key=${GRAB_KEY}`;
  // Confirm exact URL with Grab engineers on arrival
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    console.error('Nearby API failed, returning mock POIs');
    res.json({ pois: MOCK_POIS }); // fallback — see Section 4A
  }
});

// Proxy: Directions API (route)
app.get('/api/directions', async (req, res) => {
  const { originLat, originLng, destLat, destLng } = req.query;
  const url = `GRABMAPS_DIRECTIONS_ENDPOINT?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${GRAB_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    // Fallback: straight line for frontend to draw
    res.json({
      fallback: true,
      route: [
        [parseFloat(originLat), parseFloat(originLng)],
        [parseFloat(destLat), parseFloat(destLng)]
      ]
    });
  }
});

// Proxy: Codex API (trip planning agent)
app.post('/api/chat', async (req, res) => {
  const { userMessage, userLat, userLng, availablePOIs } = req.body;

  try {
    const message = await anthropic.messages.create({
      model: 'Codex-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are GrabExplore's trip planning assistant for tourists in Singapore.
The user is at coordinates: ${userLat}, ${userLng}.
Available nearby food spots: ${JSON.stringify(availablePOIs)}.
Reply warmly in 2 sentences max. Then return EXACTLY 3 POI names from the list above
that best match what the user wants, as a JSON object.
ALWAYS respond with valid JSON only, no markdown, no extra text.
Format: {"reply": "...", "recommendations": ["POI Name 1", "POI Name 2", "POI Name 3"]}

User said: ${userMessage}`
      }]
    });

    const raw = message.content[0].text;
    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch (e) {
    console.error('Codex API error:', e.message);
    res.json({
      reply: "Here are some great hidden spots near you!",
      recommendations: MOCK_POIS.slice(0, 3).map(p => p.name)
    });
  }
});

app.listen(3000, () => console.log('Proxy running on http://localhost:3000'));
```

Create `server/.env`:
```
GRABMAPS_API_KEY=paste_your_grabmaps_key_here
ANTHROPIC_API_KEY=paste_your_anthropic_key_here
```

Create `server/.gitignore`:
```
.env
node_modules
```

Start the server:
```bash
node index.js
```

---

## 4A. MOCK POI DATA — LOAD THIS IF NEARBY API FAILS OR RETURNS CHAINS

> ⚠️ If GrabMaps Nearby API returns Starbucks, McDonald's, or any chain —
> your pitch claim of "spots Google doesn't have" collapses in front of judges.
> Validate what the API actually returns in Hour 1 before committing to that line.
> If it's chains → switch to mock data silently and remove the claim from your pitch.

```javascript
const MOCK_POIS = [
  {
    id: 'poi_1',
    name: 'Tiong Bahru Galicier Pastry',
    category: 'Traditional Bakery',
    lat: 1.2847,
    lng: 103.8278,
    distance: '420m',
    description: 'Old-school Singaporean bakery known for wife cakes and local pastries. Open since 1958. No Google reviews worth trusting.'
  },
  {
    id: 'poi_2',
    name: 'Lim Chee Guan Tiong Bahru',
    category: 'Bak Kwa',
    lat: 1.2856,
    lng: 103.8271,
    distance: '510m',
    description: 'Legendary bak kwa (BBQ pork jerky) shop. Queue forms before CNY but locals know to come off-peak.'
  },
  {
    id: 'poi_3',
    name: 'Ah Chiang Porridge',
    category: 'Local Porridge',
    lat: 1.2832,
    lng: 103.8263,
    distance: '680m',
    description: 'No-frills congee stall that opens at 6am. Regulars order without a menu. Cash only.'
  },
  {
    id: 'poi_4',
    name: 'Tiong Bahru Market Chwee Kueh',
    category: 'Hawker',
    lat: 1.2862,
    lng: 103.8269,
    distance: '390m',
    description: 'Chwee kueh that Tiong Bahru residents have eaten for 40 years. Closes by 11am.'
  },
  {
    id: 'poi_5',
    name: 'Qi Ji Tiong Bahru Plaza',
    category: 'Local Snacks',
    lat: 1.2874,
    lng: 103.8265,
    distance: '820m',
    description: 'Muah chee and local snacks. Often overlooked next to larger food court chains.'
  }
];
```

---

## 4B. FUZZY POI MATCHING — PREVENTS SILENT FAILURES

> ⚠️ Codex returns POI names as strings. If the name doesn't exactly match your POI array,
> nothing highlights and you have no idea why. Add this to your frontend JS.

```javascript
function fuzzyMatchPOI(recommendedName, poiArray) {
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = normalize(recommendedName);

  let bestMatch = null;
  let bestScore = 0;

  poiArray.forEach(poi => {
    const candidate = normalize(poi.name);
    const shared = [...target].filter(c => candidate.includes(c)).length;
    const score = shared / Math.max(target.length, candidate.length);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = poi;
    }
  });

  return bestScore > 0.6 ? bestMatch : null;
}

function highlightRecommendedPOIs(recommendations, poiArray) {
  const matched = recommendations
    .map(name => fuzzyMatchPOI(name, poiArray))
    .filter(Boolean);

  if (matched.length === 0) {
    console.warn('Fuzzy match found nothing — using first 3 POIs as fallback');
    return poiArray.slice(0, 3);
  }

  return matched;
}
```

---

## 4C. PROXIMITY MECHANIC — HOW TO FRAME IT FOR JUDGES

> ⚠️ On a laptop, "move your player 80px" looks fake to judges who know what GPS is.
> Don't pretend it's real movement. Preempt the question with one sentence:
> "In the real app, GPS confirms arrival. For the demo, the joystick simulates walking."
> That's it. One sentence. Never apologise, never over-explain.

Add a Demo Jump button so the mechanic never blocks your flow:
```javascript
// Button near joystick — only visible during demo
document.getElementById('demo-jump-btn').addEventListener('click', () => {
  if (highlightedPOIs.length > 0) {
    const target = highlightedPOIs[0];
    map.setCenter([target.lng, target.lat]);
    updatePlayerPosition(target.lat, target.lng);
    // Triggers proximity check → spin unlocks
  }
});
```

---

## 5. BUILD PRIORITY ORDER

### MUST HAVE (non-negotiable for demo)
1. GrabMaps tiles rendering
2. Player centered, map follows movement
3. AI chatbot appears on load, bottom left — powered by Codex
4. Chatbot highlights 3 nearest POIs on map after user input (fuzzy matched)
5. Spin mechanic working end to end
6. Reward screen with voucher card
7. "How to get there" — Directions API route drawn on map (fallback: straight line)
8. "Book a GrabCar here" deep link button
9. Demo Jump button near joystick

### HOUR 6 ONLY — cut if core loop not perfect
10. Fog of war toggle

### NICE TO HAVE (only if somehow done by Hour 6)
- Second POI type (landmark)
- Smoother fog edge gradient
- Sound effect on spin/reward

### DO NOT BUILD
- ❌ User login or accounts
- ❌ Real voucher redemption backend
- ❌ Multi-day itinerary planner
- ❌ Leaderboard with real data
- ❌ Mobile responsive layout

---

## 6. DESIGN REFERENCE

### Color Palette
```
--grab-green:       #00B14F
--grab-green-dark:  #008C3E
--grab-green-glow:  rgba(0, 177, 79, 0.3)
--fog-base:         rgba(15, 25, 20, 0.88)
--fog-wisps:        rgba(40, 65, 45, 0.45)
--bg-dark:          #0D1A12
--points-gold:      #F59E0B
--surface:          #FFFFFF
--text-primary:     #1A1A1A
--text-light:       #FFFFFF
--text-muted:       #6B7280
```

### Fonts
- **Syne Bold** — logo, headings, HUD labels
- **DM Sans** — body text, POI names, descriptions
- **JetBrains Mono** — point values, coordinates

### Key Dimensions
- Joystick outer ring: 120px diameter, bottom center, 24px from bottom
- Joystick knob: 52px diameter, Grab green
- Player sprite: 32px diameter, green with white border, pulsing glow
- Fog reveal radius: 110–160px around player
- POI marker: ~56px tall, spinning when unspun, grey + checkmark when spun

---

## 7. COMPONENT SPECS

### AI Trip Planning Chatbot (bottom left)
- Frosted glass panel: `rgba(0,0,0,0.75)`, `backdrop-filter: blur(12px)`
- Width: 280px, `bottom: 24px`, `left: 16px`
- On load greeting: "Hey! First time in Singapore? Tell me what you love — street food, hidden gems, local culture?"
- Powered by Codex Codex-sonnet-4-20250514 via `/api/chat`
- POI highlights use fuzzy matching — never silent failure
- Minimise button (—) collapses to header bar

### Fog of War Toggle ⚠️ HOUR 6 ONLY
- Pill toggle in top left: "🌫️ Explore Mode"
- OFF (default): normal map, all POIs visible, chatbot active
- ON: fog canvas activates, joystick drives reveal
- **Build last. Skip entirely if behind at Hour 6.**

### POI Markers
- Unspun: Grab green, spinning rotation, bob animation, green glow
- Spun: grey, white checkmark, no rotation

### POI Info Modal
- Slides up from bottom (350ms)
- Shows: name, category, distance, description
- Two action buttons: "🗺️ How to get there" / "🚗 Book a GrabCar here"
- Spin button: locked (grey) if far, green if within 80px
- **Demo Jump button** visible in demo mode — teleports player to POI instantly

### Proximity Detection
```javascript
function checkProximity() {
  POIS.forEach(poi => {
    const screenPos = map.project([poi.lng, poi.lat]);
    const playerScreenX = window.innerWidth / 2;
    const playerScreenY = window.innerHeight / 2;

    const dist = Math.hypot(
      screenPos.x - playerScreenX,
      screenPos.y - playerScreenY
    );

    poi.isNearby = dist <= 80;

    if (currentOpenPOI === poi.id) {
      updateSpinButton(poi.isNearby);
    }
  });
}
```

### Reward Screen
- "🎉 STOP UNLOCKED!" confetti burst, "+100 pts", GrabFood voucher card
- "EXPLORE MORE STOPS" CTA

### Directions Route
- Grab-green polyline on map, distance + time pill
- **Fallback always implemented:** straight dotted line if API fails

### Grab Deep Link
```javascript
const grabDeepLink = `grab://open?destination=${poi.lat},${poi.lng}&destinationName=${encodeURIComponent(poi.name)}`;
window.location.href = grabDeepLink;
// Fallback: window.open('https://grab.com', '_blank');
```

### HUD (Top Right)
```
⭐ 300 pts  |  🗺️ 24% explored
```

---

## 8. DEMO SCRIPT (practice this tonight)

```
[App loads — map visible, chatbot bottom left]
"GrabMaps is built from real rides and food orders across SEA.
GrabExplore turns that hyperlocal data into a city discovery game."

[Type: "I love local street food"]
"Tourist tells our AI agent what they love."

[3 markers pulse gold]
"Codex finds the 3 best matching spots — hyperlocal places built from real GrabMaps data."

[Tap marker — info modal slides up]
"They see the details. Before they even move — get directions or book a Grab."

[Tap "How to get there" — route appears]
"GrabMaps Directions API draws the route."

[Tap Demo Jump — spin button turns green]
"They arrive. In the real app, GPS confirms it."

[Tap SPIN THIS STOP → reward screen]
"Earn points. Unlock a GrabFood voucher."

[Toggle fog mode — if built]
"For the explorer: same mechanic, no AI, pure discovery."

[Back to audience]
"Discover in GrabExplore. Travel with GrabCar. Eat with GrabFood."
```

---

## 9. HOUR-BY-HOUR PLAN

```
Hour 1  (9–10am)   → Get API keys. Swap tile URL. Wire Nearby API.
                      VALIDATE: what POIs does the API actually return?
                      Chains → switch to mock immediately, cut "Google doesn't have" from pitch.

Hour 2  (10–11am)  → Build chatbot panel + wire /api/chat (Codex).
                      Test: type preference → fuzzy match → 3 POIs highlight.

Hour 3  (11am–12)  → Wire Directions API + straight-line fallback.
                      Reward screen. Demo Jump button. Full tourist flow end to end.

Hour 4  (12–1pm)   → LUNCH. Step away. Rest your eyes.

Hour 5  (1–2pm)    → Full demo run × 3. Timed. Fix only what broke. Nothing new.

Hour 6  (2–3pm)    → Fog of war IF core loop is perfect. Otherwise: polish + pitch practice.

Hour 7  (3–4pm)    → 3 pitch slides. Verbal pitch × 3. Submit before deadline.
```

---

## 10. PITCH SLIDES (3 SLIDES ONLY)

**Slide 1 — The Asset**
> GrabMaps is built from millions of real rides and food orders across Southeast Asia.
> That's hyperlocal POI data no other map has.
> GrabExplore puts it to work.

**Slide 2 — Two users, one app**
> 🧳 Tourist mode: Codex AI asks what you love → 3 hidden spots → spin → voucher → GrabCar
> 🗺️ Explorer mode: Fog of war → discover like an RPG
> [Live demo here]

**Slide 3 — Stack + Roadmap**
> GrabMaps APIs: Nearby · Directions · Vector Map Tiles
> Anthropic: Codex Codex-sonnet-4-20250514 — trip planning agent
> Ecosystem: GrabExplore → GrabCar → GrabFood
> Roadmap: pre-loaded missions before tourists land; proximity push notifications

---

## 11. IF THINGS GO WRONG

| Problem | Fix |
|---|---|
| GrabMaps tiles not loading | Check API key in .env, confirm endpoint with Grab engineers |
| Node.js server won't start | Check node_modules installed, check .env exists |
| Chatbot not responding | Check ANTHROPIC_API_KEY in .env, check /api/chat route |
| POIs not highlighting | Check fuzzy match in console. Fall back to first 3 mock POIs |
| Spin button stays locked | Reduce 80px → 150px OR use Demo Jump button |
| Nearby API returns chains | Switch to mock POI array, remove "Google doesn't have" from pitch |
| Directions API down | Straight dotted line fallback — already coded |
| Fog toggle broken | Skip, demo tourist mode only |
| Everything broken | Open Codex design prototype as fallback, demo visually |

**Golden rule: demo what works, skip what doesn't. Never apologise. One preemptive sentence beats any apology.**

---

## 12. YOUR EDGE OVER OTHER TEAMS

- Two user personas — tourist AND explorer — in one coherent app
- Codex (Anthropic) + GrabMaps — consistent across code, slides, and pitch
- Pitch leads with Grab's asset — not a competitor's weakness
- Real obscure Singapore POIs hardcoded — "hidden gems" claim survives live scrutiny
- Fuzzy matching — chatbot → map highlight never silently fails
- Demo Jump button — proximity mechanic never blocks demo flow
- You know exactly what to build before 9am

**Show up early. Get API keys first. Validate Nearby API POI quality in Hour 1 before anything else.**
