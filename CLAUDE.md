# Taxi Driver: City Hustle

2D top-down taxi simulation game. Vanilla JavaScript + HTML5 Canvas. Zero dependencies, zero build system.

## Technology Stack

- **Engine**: None — vanilla HTML5 Canvas 2D
- **Language**: JavaScript ES6+ (no TypeScript, no transpilation)
- **Rendering**: Canvas 2D API with tile-based culling
- **Audio**: Web Audio API with synthesized sounds (no audio files)
- **Storage**: LocalStorage for save/load (3 slots)
- **Build System**: None — open `index.html` in a browser
- **Version Control**: Git, main branch

## Project Structure

```
index.html              — Single entry point, all screens and HUD markup
css/style.css           — All styling (dark theme, HUD, menus, overlays)
js/
  main.js               — Menu navigation, character select, save/load UI
  game.js               — Core game loop, state management, input, UI panels
  constants.js          — All tunable game parameters in one file
  utils.js              — Shared helpers (math, formatting, tile conversion)
  taxi.js               — Player vehicle: physics, upgrades, fuel, tires, fatigue
  city.js               — Procedural city generation (55x40 tilemap, buildings, districts)
  camera.js             — Viewport following, culling, screen shake
  renderer.js           — Canvas rendering (tiles, buildings, vehicles, weather, HUD, minimap)
  home-screen.js        — Home screen UI (summary, skills, shop, garage, upgrades)
  save-manager.js       — Save/load system (localStorage persistence, state restore)
  passenger.js          — Passenger spawning, types, fare calculation, rating
  traffic.js            — NPC cars, buses, pedestrians with road-following AI
  road-nav.js           — Shared road pathfinding utilities (used by NpcCar + AiTaxi)
  ai-taxi.js            — Rival AI taxi competitors
  events.js             — City events (concerts, sports, rush hour)
  hazards.js            — Speed cameras, traffic lights, fines, notifications
  weather.js            — Rain/fog/clear cycle, day/night, fare multipliers
  challenges.js         — Daily challenge system
  characters.js         — 5 playable drivers with skills/bonuses/weaknesses, portrait drawing
  app-orders.js         — Ride-hailing phone orders
  gps.js                — Navigation arrows and route drawing
  police.js             — Police patrol (currently disabled)
  radio.js              — In-game radio stations
  hud.js                — HUD bar updates and interaction prompts
  audio.js              — Web Audio synthesized engine/horn/pickup sounds
```

## Architecture Notes

- All JS files load via `<script>` tags in index.html (no modules, order matters)
- All classes are in global scope
- Game class in game.js is the central orchestrator (known god-class, decomposition planned)
- Constants.js centralizes all balance parameters with explanatory comments
- City is a 55x40 tile grid (TILE_SIZE=64px) with seeded procedural generation

## Key Design Decisions

- No external dependencies — the game must run by opening index.html in any browser
- Procedural everything — city layout, building names, passenger types, weather
- Economy-driven progression — earn fares, buy upgrades, unlock cars
- 5 characters with distinct stat profiles affecting gameplay

## Known Issues

- Police system disabled (was blocking gameplay) — police.js exists but is not used
- Some shop items defined but not yet implemented in game logic
- game.js still handles fare logic and some UI (home screen and save/load extracted)
- NPC and AI taxi pathfinding shared via road-nav.js (NpcCar keeps unique lane rules)

## Coding Conventions

- Class-per-system pattern (Taxi, City, Renderer, PassengerManager, etc.)
- Constants in SCREAMING_SNAKE_CASE
- Private methods prefixed with underscore
- Game balance changes go in constants.js, not scattered in logic files
- Prefer editing existing files over creating new ones unless extracting a clear module

## Coordination Rules

@.claude/docs/coordination-rules.md

## Context Management

@.claude/docs/context-management.md
