# 🚕 Taxi Driver Game — Realism Feature Proposals

Pick the ones you like, comment on them, and I'll implement your selections.
Mark with ✅ to approve, ❌ to skip, or add notes.

---

## 🌦️ Weather & Environment

### 1. Dynamic Weather System
- Random **rain**, **fog**, and **clear** cycles throughout the game day
- Rain: darker visuals, rain particle effects, reduced tire grip (car slides more), wipers auto-activate
- Fog: reduced draw distance (dark overlay fades buildings further away), headlights glow
- Passengers are more likely to hail a cab during bad weather → more fares
- Wet roads = longer braking distance

### 2. Day/Night Cycle with Lighting
- Sky color gradually shifts from dawn (orange) → day (blue) → dusk (purple) → night (dark blue)
- At night: streetlights glow along roads, headlights on all cars, building windows light up
- Night fares pay **2x** (people need rides late)
- Reduced visibility at night (smaller visible area)
- Some passengers only appear at night (bar/club goers)

### 3. Seasonal City Events
- Occasional city-wide events: **parade** (roads blocked), **marathon** (detours), **festival** (more passengers in one area), **construction** (lane closures)
- Events shown with banner notification and minimap markers
- Some events are profitable (festival = surge pricing), others are obstacles

---

## 💰 Economy & Business

### 4. Fuel Price Variation Per Station
- Each gas station has a **different fuel price** (shown on a sign near the building)
- Prices fluctuate slightly over time (morning cheap, evening expensive)
- Cheapest station might be further away — player decides: save money or save time?
- HUD shows price when near a station

### 5. Mechanic Quality Tiers
- Each mechanic has a **quality rating** (⭐ to ⭐⭐⭐)
- Cheap mechanics: fast but might not fix everything (small chance repair partially fails)
- Expensive mechanics: reliable, full repair guaranteed
- Quality shown on building label

### 6. Rush Hour & Surge Pricing
- Morning (7–9 AM) and evening (5–7 PM) rush hours
- During rush: **1.5x fares**, but also **more traffic** and **longer red lights**
- Late night (11 PM–4 AM): **2x fares** but fewer passengers, more drunk/troublemaker types

### 7. Daily Expenses & Rent
- At end of each game day, auto-deduct: **car insurance** ($20), **parking fee** ($10), **phone plan** ($5)
- If you don't make enough to cover expenses, you go into debt
- Adds pressure to actually earn consistently, not just cruise around

---

## 🚗 Driving & Vehicle

### 8. Turn Signals & Indicators
- Pressing A/D while slow or braking shows orange **blinker** on the taxi
- NPC cars blink before turning at intersections
- Hazard lights flash when the taxi is stopped/parked for a while
- Purely cosmetic but adds immersion

### 9. Car Damage Model (Visual)
- Collision damage shows visually: **scratches** (minor), **dents** (medium), **cracked windshield** (heavy)
- Drawn as overlay effects on the taxi sprite
- More damage = passengers are less likely to get in (visual trust)
- Fully repaired at mechanic

### 10. Realistic Fuel Gauge & Dashboard
- Replace plain fuel bar with a **circular gauge** (like a real dashboard)
- Add a **speedometer needle** next to it
- RPM-style engine sound pitch changes with speed
- Oil temperature warning light if driving too hard for too long

### 11. Tire Wear & Blowouts
- Tires degrade over distance driven (shown as tire health %)
- Worn tires = worse grip, longer braking, sliding in rain
- At 0%: **blowout** — car pulls hard to one side, forced to slow down
- Replace tires at mechanic (separate cost from repair)

### 12. Manual Gear Shifting (Optional Mode)
- Toggle between auto and manual transmission in settings
- Manual: press **Shift+W** to upshift, **Shift+S** to downshift
- Wrong gear = poor acceleration or engine strain
- Bonus money for completing fares in manual mode

---

## 🧑 Passengers & Social

### 13. Passenger Star Rating System
- After each fare, passenger rates you **1–5 ⭐**
- Based on: drive speed, damage taken during ride, route efficiency, waiting time
- Average rating shown in HUD
- High rating (4.5+): more tips, better app orders, VIP passengers
- Low rating (below 3.0): fewer passengers want to ride, app orders dry up

### 14. Passenger Conversations
- Random text bubbles appear during rides: "Nice weather!", "Can you go faster?", "I'm late!"
- Some passengers give **directions** ("Turn left here!") — following them gives a tip bonus
- Troublemakers say rude things before refusing to pay
- Adds personality and makes rides less repetitive

### 15. VIP Passengers
- Rare gold-highlighted passengers near hotels and office buildings
- They pay **3–5x** normal fare but are impatient (shorter wait timer, rate harshly)
- Require a car with health > 80% to accept the ride
- Failing a VIP ride tanks your rating

### 16. Passenger Luggage
- Some passengers have luggage (shown as 🧳 icon)
- Picking them up takes **2 seconds longer** (loading animation)
- But they tip **50% more**
- Airport/hotel passengers more likely to have luggage

---

## 🗺️ City & World

### 17. One-Way Streets
- Some roads are **one-way only** (arrows painted on road)
- Driving the wrong way: risk a **police fine** if caught
- NPC cars follow one-way rules too
- Adds strategic routing decisions

### 18. Pedestrian Crossings & Jaywalkers
- Zebra crossings near intersections — pedestrians walk across
- Must **stop** for pedestrians or risk a fine/hitting them
- Occasional jaywalkers cross randomly mid-block
- Hitting a pedestrian = huge fine + rating penalty + police chase

### 19. Police Patrols & Speed Traps
- Police cars roam the city (visible blue/red car)
- If you **speed** (>120) near a police car, you get pulled over → fine + time lost
- Running a red light near police = fine
- Wrong-way driving near police = fine
- Adds consequence to reckless driving

### 20. Public Transport (Buses)
- NPC buses on fixed routes (larger, slower vehicles on main roads)
- Buses stop at marked **bus stops** — you must wait behind them
- Passengers sometimes say "The bus was too slow, that's why I took a cab!" (flavor text)

### 21. Highway / Expressway
- One fast road loop around the city edge — **no traffic lights**, higher speed limit
- Good for long-distance fares
- But no passengers spawn on it (can't pick up on highway)
- Entry/exit ramps connect to city streets

### 22. Named Districts & Street Signs
- Different areas have names: "Downtown", "Old Town", "Harbor District", "Industrial Zone"
- Street signs at intersections show cross-street names
- Passenger destinations show district name: "🏢 Office in Downtown"
- Minimap shows district labels

---

## 🔧 Quality of Life

### 23. GPS Route Line
- When navigating (1/2/3/4), draw a **dotted green line** on the road showing the actual route
- Follows roads, not a straight arrow
- Helps new players navigate the city grid
- Optional: toggle with **G** key

### 24. Rear-View Mirror
- Small rectangle at top of screen showing what's behind the taxi
- Useful for seeing police, other cars approaching, or passengers you just dropped off
- Purely visual immersion

### 25. Radio Stations
- Press **R** to cycle through radio "stations": Jazz, Rock, Lo-fi, News
- News station announces upcoming city events and weather
- Different music per station (simple procedural tones or ambient loops)
- Passengers occasionally comment: "I love this song!"

### 26. Photo Mode / Dashcam
- Press **P** to take a "screenshot" that saves to an in-game photo gallery
- Shows stats overlay: time, location, money earned
- End-of-day summary screen with best moments

---

## ⚡ Challenge & Progression

### 27. Daily Challenges
- Each game day gives 3 random challenges:
  - "Complete 5 fares without damage"
  - "Earn $500 before noon"
  - "Drive 20 blocks without stopping"
- Completing challenges gives **bonus money** or **free repairs**

### 28. Taxi License Levels
- Start with a **Basic License** — limited to short fares, slow car
- Earn XP from fares to level up: **Standard → Professional → Elite**
- Each level unlocks: longer fares, VIP access, better car upgrades, new city areas
- Adds long-term progression

### 29. Rival Taxi Companies
- 2-3 AI taxi companies compete for passengers
- Their cars are colored differently (green, blue)
- If they reach a passenger first, you lose that fare
- Sometimes they cut you off on purpose
- Weekly "leaderboard" shows earnings vs. rivals

### 30. Breakdown Recovery Call
- When car health hits 0, instead of instant tow, you must **call for recovery**
- Wait 30 seconds for a tow truck to arrive (you watch it drive to you)
- Costs money but adds tension
- Can upgrade to "premium roadside assist" for faster response

---

> **How to use this list:** Mark items with ✅ / ❌ or add your own notes.
> I'll implement all approved features in priority order.
