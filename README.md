# 🚕 Taxi Driver: City Hustle

A 2D top-down taxi driving game built with vanilla HTML5 Canvas, CSS, and JavaScript — no frameworks or build tools required.

## How to Play

Open `index.html` in any modern browser, or serve with any static file server.

### Controls

| Key | Action |
|-----|--------|
| **W/S** | Accelerate / Brake |
| **A/D** | Steer Left / Right |
| **SPACE** | Pick up / Drop off passenger |
| **E** | Interact (refuel, repair, rest at home) |
| **F** | Open ride-hailing app (accept orders) |
| **1** | Navigate to Home |
| **2** | Navigate to nearest Gas Station |
| **3** | Navigate to nearest Mechanic |
| **0** | Clear navigation |
| **H** | Horn |
| **M** | Toggle minimap size |
| **N** | Toggle sound on/off |
| **T** | Emergency tow (when car is totaled) |
| **ESC** | Pause menu (upgrades, stats) |

### Gameplay

- **Pick up passengers** — drive near a waiting person and press SPACE
- **Deliver them** — follow the destination marker and press SPACE when you arrive
- **Accept app orders** — press F to open the ride-hailing phone, then 1/2/3 to accept
- **Earn fares** — longer trips pay more; app orders pay a premium
- **Refuel** — stop at ⛽ gas stations and press E
- **Repair** — stop at 🔧 mechanics and press E
- **Rest at home** — stop at 🏡 your home and press E to recover energy
- **Navigate** — press 1/2/3 to show direction arrows to key locations
- **Upgrade** — press ESC → Garage & Upgrades

### Features

- Procedurally generated city with districts (residential, downtown, industrial, etc.)
- 19 building types including your driver's home base
- **NPC traffic** — 20 civilian cars driving around the city
- **Ride-hailing app** — accept Uber/Bolt-style orders via phone for premium fares
- **Navigation system** — press 1/2/3 for on-screen arrows pointing to key locations
- **Fatigue system** — energy drains while driving; rest at home to recover
- **Special events** — football matches, concerts, rush hours spawn extra passengers
- **AI rival taxis** competing for the same passengers
- **25+ passengers** roaming the city at any time
- **Fuel system** — realistic consumption rate; 5 gas stations across the map
- **Car health & mileage** — higher km = more breakdowns; 3 mechanics available
- **6 upgrade paths** — engine, fuel tank, tires, brakes, body, comfort
- **Hazards** — speed cameras, fines, thief passengers, troubled customers, accidents
- **Traffic lights** — at select intersections with cycling signals
- **Day/night cycle** with visual overlay and headlight glow
- **Tire smoke & exhaust particles** for visual feedback
- **Synthesized audio** — engine sounds, horn, pickup/dropoff chimes
- **Minimap** with passengers, destinations, events, traffic, and nav markers
- **Emergency tow** when your car is totaled

## Tech Stack

- Pure HTML5 / CSS3 / JavaScript (ES6+)
- HTML5 Canvas for rendering
- Web Audio API for synthesized sounds
- Zero dependencies, zero build step
