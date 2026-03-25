// ============================================================
// HAZARDS SYSTEM - Speed fines, thieves, accidents
// ============================================================

class HazardManager {
    constructor(city) {
        this.city = city;
        this.speedCameras = [];
        this.trafficLights = [];
        this.notifications = [];
        this.accidentCooldown = 0;
        this.challengeMgr = null; // Will be set by game

        this._placeSpeedCameras();
        this._placeTrafficLights();
    }

    setChallengeManager(challengeMgr) {
        this.challengeMgr = challengeMgr;
    }

    _placeSpeedCameras() {
        // Place speed cameras on sidewalk tiles adjacent to roads (realistic placement)
        const candidates = this._findSpeedCamSidewalkSpots();
        // Pick ~8 spots spread across the map
        const numCams = Math.min(8, candidates.length);
        const shuffled = candidates.sort(() => Math.random() - 0.5);
        for (let i = 0; i < numCams; i++) {
            const spot = shuffled[i];
            this.speedCameras.push({
                x: spot.x,
                y: spot.y,
                col: spot.col,
                row: spot.row,
                cooldown: 0,
                radius: TILE_SIZE * 2.5, // detection range covers adjacent road
                relocateTimer: 120 + Math.random() * 180, // relocate every 2-5 minutes
            });
        }
    }

    _findSpeedCamSidewalkSpots() {
        // Find sidewalk tiles that are directly adjacent to a road tile
        const spots = [];
        for (let r = 1; r < MAP_ROWS - 1; r++) {
            for (let c = 1; c < MAP_COLS - 1; c++) {
                if (this.city.tiles[r][c] !== TILE.SIDEWALK) continue;
                // Must be next to a road
                const adjRoad =
                    isRoadTile(this.city.tiles[r - 1][c]) ||
                    isRoadTile(this.city.tiles[r + 1][c]) ||
                    isRoadTile(this.city.tiles[r][c - 1]) ||
                    isRoadTile(this.city.tiles[r][c + 1]);
                if (adjRoad) {
                    const pos = tileToPixel(c, r);
                    spots.push({ x: pos.x, y: pos.y, col: c, row: r });
                }
            }
        }
        return spots;
    }

    _relocateSpeedCamera(cam) {
        // Move a speed camera to a new sidewalk spot
        const candidates = this._findSpeedCamSidewalkSpots();
        if (candidates.length === 0) return;
        // Pick a spot far from current position
        const farSpots = candidates.filter(s =>
            dist(s.x, s.y, cam.x, cam.y) > TILE_SIZE * 10
        );
        const pool = farSpots.length > 0 ? farSpots : candidates;
        const spot = pool[Math.floor(Math.random() * pool.length)];
        cam.x = spot.x;
        cam.y = spot.y;
        cam.col = spot.col;
        cam.row = spot.row;
        cam.relocateTimer = 120 + Math.random() * 180; // next relocation in 2-5 min
    }

    _placeTrafficLights() {
        // Place traffic lights at corners of intersections (on sidewalk),
        // just like real life — one light per intersection, positioned at
        // the top-right corner for visibility
        for (const rRow of this.city.horizontalRoads) {
            for (const cCol of this.city.verticalRoads) {
                if (Math.random() < TRAFFIC_LIGHT_PLACEMENT) {
                    // Intersection occupies 2x2 tiles: (rRow, cCol) to (rRow+1, cCol+1)
                    // Place lights at all 4 corners just outside the intersection
                    const corners = [
                        { x: cCol * TILE_SIZE - 4,              y: rRow * TILE_SIZE - 4 },              // top-left
                        { x: (cCol + 2) * TILE_SIZE + 4,       y: rRow * TILE_SIZE - 4 },              // top-right
                        { x: cCol * TILE_SIZE - 4,              y: (rRow + 2) * TILE_SIZE + 4 },       // bottom-left
                        { x: (cCol + 2) * TILE_SIZE + 4,       y: (rRow + 2) * TILE_SIZE + 4 },       // bottom-right
                    ];
                    // Use same timer so all 4 lights at this intersection are synced
                    const timer = Math.random() * TRAFFIC_LIGHT_CYCLE;
                    for (let ci = 0; ci < corners.length; ci++) {
                        this.trafficLights.push({
                            x: corners[ci].x,
                            y: corners[ci].y,
                            timer: timer,
                            cooldown: 0,
                            radius: TILE_SIZE * 1.8,
                            intersectionX: (cCol + 1) * TILE_SIZE,
                            intersectionY: (rRow + 1) * TILE_SIZE,
                            enforces: ci === 0, // only first corner handles fines
                        });
                    }
                }
            }
        }
    }

    getTrafficLightState(light) {
        const t = light.timer % TRAFFIC_LIGHT_CYCLE;
        const greenEnd = TRAFFIC_LIGHT_CYCLE * 0.45;
        const yellowEnd = TRAFFIC_LIGHT_CYCLE * 0.55;
        if (t < greenEnd) return 'green';
        if (t < yellowEnd) return 'yellow';
        return 'red';
    }

    _getLocalSpeedLimit(taxi) {
        // Check if near school or hospital — slow zone
        for (const b of this.city.buildings) {
            if (b.type === 'school' || b.type === 'hospital') {
                const d = dist(taxi.x, taxi.y, b.px, b.py);
                if (d < TILE_SIZE * 4) return SPEED_LIMIT_SLOW;
            }
        }
        return SPEED_LIMIT_CITY;
    }

    update(dt, taxi) {
        // Traffic light updates
        for (const light of this.trafficLights) {
            light.timer += dt;
            if (light.cooldown > 0) light.cooldown -= dt;

            // Check red light running — only fine when taxi actually enters the
            // intersection (the 2×2 ROAD_CROSS area), not when approaching
            if (light.cooldown <= 0 && light.enforces !== false) {
                const state = this.getTrafficLightState(light);
                if (state === 'red') {
                    // Check if taxi is actually inside the intersection tiles
                    const taxiTile = pixelToTile(taxi.x, taxi.y);
                    const intCenterX = light.intersectionX || light.x;
                    const intCenterY = light.intersectionY || light.y;
                    const intTile = pixelToTile(intCenterX, intCenterY);
                    // Intersection occupies 2×2 tiles — check if taxi is on any of them
                    const onIntersection = this.city.tiles[taxiTile.row] &&
                        this.city.tiles[taxiTile.row][taxiTile.col] === TILE.ROAD_CROSS;
                    const nearEnough = dist(taxi.x, taxi.y, intCenterX, intCenterY) < TILE_SIZE * 1.5;
                    if (onIntersection && nearEnough && Math.abs(taxi.speed) > 20) {
                        taxi.money -= RED_LIGHT_FINE;
                        taxi.totalFines++;
                        taxi.currentDayFines = (taxi.currentDayFines || 0) + 1;
                        light.cooldown = TRAFFIC_LIGHT_CYCLE;
                        this.addNotification(`🚦 Red light! Fine -${formatMoney(RED_LIGHT_FINE)}`, 'danger');
                        taxi.flashTimer = 0.5;
                        taxi.flashColor = '#ff4444';
                    }
                }
            }
        }

        // Speed camera checks — use local speed limit
        const localLimit = this._getLocalSpeedLimit(taxi);
        for (const cam of this.speedCameras) {
            if (cam.cooldown > 0) cam.cooldown -= dt;

            // Relocate timer — cameras move to new spots periodically
            if (cam.relocateTimer !== undefined) {
                cam.relocateTimer -= dt;
                if (cam.relocateTimer <= 0) {
                    this._relocateSpeedCamera(cam);
                }
            }

            if (cam.cooldown > 0) continue;
            const d = dist(taxi.x, taxi.y, cam.x, cam.y);
            if (d < cam.radius && taxi.currentDisplaySpeed > localLimit) {
                const fine = SPEED_FINE_AMOUNT + Math.floor((taxi.currentDisplaySpeed - localLimit) * 0.5);
                taxi.money -= fine;
                taxi.totalFines++;
                taxi.currentDayFines = (taxi.currentDayFines || 0) + 1;
                cam.cooldown = 30;
                this.addNotification(`📸 Speed fine! -${formatMoney(fine)} (${Math.floor(taxi.currentDisplaySpeed)}/${localLimit} km/h)`, 'danger');
                taxi.flashTimer = 0.5;
                taxi.flashColor = '#ff4444';
            }
        }

        // Random accident chance (very rare)
        this.accidentCooldown -= dt;
        if (this.accidentCooldown <= 0 && taxi.invulnTimer <= 0) {
            const accidentChance = (taxi.currentDisplaySpeed / 2000) * (taxi.totalKm / 200) * dt * 0.003;
            if (Math.random() < accidentChance && taxi.currentDisplaySpeed > 150) {
                const dmg = rand(ACCIDENT_DAMAGE_RANGE[0], ACCIDENT_DAMAGE_RANGE[1]);
                taxi.takeDamage(dmg);
                taxi.speed *= 0.1;
                taxi.invulnTimer = 3;
                this.accidentCooldown = 90;
                this.addNotification(`💥 Accident! Car damaged! (-${Math.floor(dmg)}% health)`, 'danger');
            }
        }

        // Mileage-based breakdowns
        if (taxi.checkMileageBreakdown()) {
            this.addNotification(`⚠️ Mechanical issue! Car health decreased. Visit a mechanic!`, 'warning');
        }

        // Update notification timers
        this.notifications = this.notifications.filter(n => {
            n.timer -= dt;
            return n.timer > 0;
        });
    }

    handleThiefPassenger(taxi, passenger) {
        // Thief steals money
        const stolen = rand(THIEF_STEAL_RANGE[0], THIEF_STEAL_RANGE[1]);
        const actualStolen = Math.min(stolen, taxi.money);
        taxi.money -= actualStolen;
        this.addNotification(
            `🔪 ${passenger.name} was a thief! Stole ${formatMoney(actualStolen)}!`,
            'danger'
        );
        taxi.flashTimer = 1;
        taxi.flashColor = '#ff0000';
    }

    addNotification(text, type = 'info') {
        this.notifications.push({
            text,
            type,
            timer: 4,
        });
    }

    getLatestNotification() {
        return this.notifications.length > 0
            ? this.notifications[this.notifications.length - 1]
            : null;
    }
}
