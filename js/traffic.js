// ============================================================
// NPC TRAFFIC - Civilian cars driving on roads properly
// ============================================================

class NpcCar {
    constructor(x, y, city, angle) {
        this.x = x;
        this.y = y;
        this.city = city;
        this.angle = angle || 0;
        this.speed = 0;
        this.maxSpeed = rand(30, 60);
        this.width = 36;
        this.height = 20;

        // Random car color
        this.color = randChoice([
            '#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400',
            '#2c3e50', '#16a085', '#7f8c8d', '#e74c3c', '#3498db',
            '#1abc9c', '#9b59b6', '#34495e', '#e67e22', '#95a5a6',
        ]);

        // Road-following: build a path of road waypoints
        this.waypoints = [];
        this.waypointIdx = 0;
        this._buildPath();

        // State
        this.stuckTimer = 0;
        this.lastX = x;
        this.lastY = y;
        this.brakingFor = null;
    }

    _buildPath() {
        // Build a path along connected road tiles from current position
        this.waypoints = [];
        this.waypointIdx = 0;
        let { col, row } = pixelToTile(this.x, this.y);

        // Snap to nearest road tile if not on one
        if (!this._isRoad(row, col)) {
            const snap = this._findNearestRoadTile(row, col);
            if (snap) {
                row = snap.row; col = snap.col;
                // Teleport NPC to road center to prevent getting stuck off-road
                const ctr = tileToPixel(col, row);
                this.x = ctr.x;
                this.y = ctr.y;
            }
        }

        // Walk along road tiles to build waypoint chain
        const visited = new Set();
        let cr = row, cc = col;
        let dirs = this._getRoadDirs(cr, cc);
        if (dirs.length === 0) return;
        let dir = randChoice(dirs);

        for (let step = 0; step < 40; step++) {
            const key = `${cr},${cc}`;
            if (visited.has(key)) break;
            visited.add(key);

            const pos = tileToPixel(cc, cr);
            // Offset slightly to right side of road for lane discipline
            const laneOff = 6;
            this.waypoints.push({
                x: pos.x + dir.dc * 0 + dir.dr * laneOff,
                y: pos.y + dir.dr * 0 + dir.dc * laneOff
            });

            // Try to continue in current direction
            const nr = cr + dir.dr;
            const nc = cc + dir.dc;
            if (this._isRoad(nr, nc)) {
                cr = nr;
                cc = nc;
            } else {
                // At intersection or dead end, prefer forward-ish directions
                const newDirs = this._getRoadDirs(cr, cc).filter(d =>
                    !(d.dr === -dir.dr && d.dc === -dir.dc)
                );
                if (newDirs.length > 0) {
                    // Prefer continuing straight if possible
                    const straight = newDirs.find(d => d.dr === dir.dr && d.dc === dir.dc);
                    dir = straight || randChoice(newDirs);
                    const nr2 = cr + dir.dr;
                    const nc2 = cc + dir.dc;
                    if (this._isRoad(nr2, nc2)) {
                        cr = nr2;
                        cc = nc2;
                    } else break;
                } else break;
            }
        }
    }

    _isRoad(r, c) {
        if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) return false;
        return isRoadTile(this.city.tiles[r][c]);
    }

    _getRoadDirs(r, c) {
        const dirs = [];
        if (this._isRoad(r - 1, c)) dirs.push({ dr: -1, dc: 0 });
        if (this._isRoad(r + 1, c)) dirs.push({ dr: 1, dc: 0 });
        if (this._isRoad(r, c - 1)) dirs.push({ dr: 0, dc: -1 });
        if (this._isRoad(r, c + 1)) dirs.push({ dr: 0, dc: 1 });
        return dirs;
    }

    _findNearestRoadTile(r, c) {
        for (let radius = 1; radius < 8; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    if (this._isRoad(r + dr, c + dc)) {
                        return { row: r + dr, col: c + dc };
                    }
                }
            }
        }
        return null;
    }

    update(dt, allCars, playerTaxi, hazardMgr) {
        if (this.waypoints.length < 2) {
            this._buildPath();
            if (this.waypoints.length < 2) {
                // Can't find a road, respawn
                this._respawnFarFromPlayer(playerTaxi);
                return;
            }
        }

        // Current waypoint target
        const wp = this.waypoints[this.waypointIdx];
        const dWp = dist(this.x, this.y, wp.x, wp.y);

        // Advance waypoint if close enough
        if (dWp < TILE_SIZE * 0.6) {
            this.waypointIdx++;
            if (this.waypointIdx >= this.waypoints.length) {
                this._buildPath();
                return;
            }
        }

        // Steer toward current waypoint
        const target = this.waypoints[Math.min(this.waypointIdx, this.waypoints.length - 1)];
        const desiredAngle = Math.atan2(target.y - this.y, target.x - this.x);
        let diff = desiredAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += clamp(diff, -2.5 * dt, 2.5 * dt);

        // Slow down for turns
        const turnFactor = Math.abs(diff) > 0.5 ? 0.4 : 1.0;

        // Brake for nearby cars ahead
        let brakeAmount = 0;
        const lookAhead = 90;
        const cosA = Math.cos(this.angle);
        const sinA = Math.sin(this.angle);

        // Check player
        const px = playerTaxi.x - this.x;
        const py = playerTaxi.y - this.y;
        const pDist = Math.sqrt(px * px + py * py);
        if (pDist < lookAhead + 30) {
            const dot = (px * cosA + py * sinA) / (pDist || 1);
            if (dot > 0.3) { // car is ahead of us
                brakeAmount = Math.max(brakeAmount, 1.0 - pDist / (lookAhead + 30));
            }
        }

        // Check other NPC cars
        for (const other of allCars) {
            if (other === this) continue;
            const ox = other.x - this.x;
            const oy = other.y - this.y;
            const oDist = Math.sqrt(ox * ox + oy * oy);
            if (oDist < lookAhead) {
                const dot = (ox * cosA + oy * sinA) / (oDist || 1);
                if (dot > 0.3) {
                    brakeAmount = Math.max(brakeAmount, 1.0 - oDist / lookAhead);
                }
            }
        }

        // Stop at red traffic lights
        if (hazardMgr && hazardMgr.trafficLights) {
            for (const light of hazardMgr.trafficLights) {
                const ld = dist(this.x, this.y, light.x, light.y);
                if (ld < TILE_SIZE * 2) {
                    const state = hazardMgr.getTrafficLightState(light);
                    if (state === 'red') {
                        brakeAmount = Math.max(brakeAmount, 0.95);
                    } else if (state === 'yellow') {
                        brakeAmount = Math.max(brakeAmount, 0.6);
                    }
                }
            }
        }

        // Speed control
        const wantedSpeed = this.maxSpeed * turnFactor * (1.0 - brakeAmount * 0.9);
        if (this.speed < wantedSpeed) {
            this.speed += 40 * dt; // gentle acceleration
        } else {
            this.speed -= 60 * dt; // firm braking
        }
        this.speed = clamp(this.speed, 0, this.maxSpeed);

        // Move
        const vx = Math.cos(this.angle) * this.speed * dt;
        const vy = Math.sin(this.angle) * this.speed * dt;
        const newX = this.x + vx;
        const newY = this.y + vy;

        // Only move on road tiles
        const tile = pixelToTile(newX, newY);
        if (tile.row >= 0 && tile.row < MAP_ROWS && tile.col >= 0 && tile.col < MAP_COLS) {
            const t = this.city.tiles[tile.row][tile.col];
            if (t === TILE.ROAD_H || t === TILE.ROAD_V || t === TILE.ROAD_CROSS || t === TILE.HIGHWAY) {
                this.x = newX;
                this.y = newY;
            } else {
                // Off-road — snap back to nearest road and rebuild
                this.speed = 0;
                const snap = this._findNearestRoadTile(tile.row, tile.col);
                if (snap) {
                    const ctr = tileToPixel(snap.col, snap.row);
                    this.x = ctr.x;
                    this.y = ctr.y;
                }
                this._buildPath();
            }
        }

        // Stuck detection — respawn quickly if stuck
        const moved = dist(this.x, this.y, this.lastX, this.lastY);
        if (moved < 0.3) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 2.5) {
                this._respawnFarFromPlayer(playerTaxi);
            }
        } else {
            this.stuckTimer = 0;
        }
        this.lastX = this.x;
        this.lastY = this.y;
    }

    _respawnFarFromPlayer(playerTaxi) {
        // Respawn on a road tile that is far from the player (no popping up in face)
        for (let attempt = 0; attempt < 50; attempt++) {
            const pos = this.city.getRandomRoadPosition();
            if (dist(pos.x, pos.y, playerTaxi.x, playerTaxi.y) > TILE_SIZE * 8) {
                this.x = pos.x;
                this.y = pos.y;
                this.speed = 0;
                this.stuckTimer = 0;
                this._buildPath();
                return;
            }
        }
        // Fallback: just pick any road far-ish away
        const pos = this.city.getRandomRoadPosition();
        this.x = pos.x;
        this.y = pos.y;
        this.speed = 0;
        this.stuckTimer = 0;
        this._buildPath();
    }

    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            w: this.width,
            h: this.height,
        };
    }
}

// ============================================================
// PEDESTRIANS - Walk on sidewalks, use crossings, jaywalkers
// ============================================================

class Pedestrian {
    constructor(x, y, city) {
        this.x = x;
        this.y = y;
        this.city = city;
        this.speed = PEDESTRIAN_SPEED + rand(-8, 8);
        this.angle = Math.random() * Math.PI * 2;
        this.width = 8;
        this.height = 8;
        this.color = randChoice(['#FFD700', '#FF6B6B', '#6BCB77', '#4ECDC4', '#A78BFA', '#F472B6', '#FF8C00']);
        this.waypoints = [];
        this.waypointIdx = 0;
        this.isJaywalker = Math.random() < 0.08;
        this.stuckTimer = 0;
        this._buildPath();
    }

    _buildPath() {
        this.waypoints = [];
        this.waypointIdx = 0;
        let { col, row } = pixelToTile(this.x, this.y);

        // Find nearest sidewalk
        if (!this._isSidewalk(row, col)) {
            const snap = this._findNearestSidewalk(row, col);
            if (snap) { row = snap.row; col = snap.col; }
            else return;
        }

        const visited = new Set();
        let cr = row, cc = col;
        const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
        let dir = randChoice(dirs);

        for (let step = 0; step < 20; step++) {
            const key = `${cr},${cc}`;
            if (visited.has(key)) break;
            visited.add(key);
            const pos = tileToPixel(cc, cr);
            this.waypoints.push({ x: pos.x + rand(-8, 8), y: pos.y + rand(-8, 8) });

            const nr = cr + dir.dr;
            const nc = cc + dir.dc;
            const canWalk = this.isJaywalker ? this._isWalkable(nr, nc) : this._isSidewalk(nr, nc);
            if (canWalk) {
                cr = nr; cc = nc;
            } else {
                const newDirs = dirs.filter(d => {
                    const walkable = this.isJaywalker ? this._isWalkable(cr + d.dr, cc + d.dc) : this._isSidewalk(cr + d.dr, cc + d.dc);
                    return walkable && !(d.dr === -dir.dr && d.dc === -dir.dc);
                });
                if (newDirs.length > 0) {
                    dir = randChoice(newDirs);
                    cr += dir.dr; cc += dir.dc;
                } else break;
            }
        }
    }

    _isSidewalk(r, c) {
        if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) return false;
        return this.city.tiles[r][c] === TILE.SIDEWALK || this.city.tiles[r][c] === TILE.PARKING;
    }

    _isWalkable(r, c) {
        if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) return false;
        const t = this.city.tiles[r][c];
        return t === TILE.SIDEWALK || t === TILE.PARKING || t === TILE.ROAD_H || t === TILE.ROAD_V || t === TILE.ROAD_CROSS;
    }

    _findNearestSidewalk(r, c) {
        for (let radius = 1; radius < 6; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    if (this._isSidewalk(r + dr, c + dc)) return { row: r + dr, col: c + dc };
                }
            }
        }
        return null;
    }

    update(dt) {
        if (this.waypoints.length < 2) {
            this._buildPath();
            return;
        }

        const wp = this.waypoints[this.waypointIdx];
        const d = dist(this.x, this.y, wp.x, wp.y);
        if (d < 6) {
            this.waypointIdx++;
            if (this.waypointIdx >= this.waypoints.length) {
                this._buildPath();
                return;
            }
        }

        const target = this.waypoints[Math.min(this.waypointIdx, this.waypoints.length - 1)];
        this.angle = Math.atan2(target.y - this.y, target.x - this.x);
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;

        // Stuck detection
        this.stuckTimer += dt;
        if (this.stuckTimer > 8) {
            this.stuckTimer = 0;
            this._buildPath();
        }
    }

    getBounds() {
        return { x: this.x - 4, y: this.y - 4, w: 8, h: 8 };
    }
}

// ============================================================
// BUS - Follows fixed route on roads, stops at bus stops
// ============================================================

class Bus {
    constructor(city) {
        this.city = city;
        this.width = 52;
        this.height = 18;
        this.color = '#1565C0';
        this.speed = 0;
        this.maxSpeed = BUS_SPEED;
        this.angle = 0;
        this.stopTimer = 0;
        this.isStopped = false;

        // Build route
        this.waypoints = [];
        this.waypointIdx = 0;
        this._buildRoute();

        const wp = this.waypoints[0];
        if (wp) { this.x = wp.x; this.y = wp.y; }
        else {
            const pos = city.getRandomRoadPosition();
            this.x = pos.x; this.y = pos.y;
        }
    }

    _buildRoute() {
        this.waypoints = [];
        this.waypointIdx = 0;

        // Pick a random horizontal road and follow it
        if (this.city.horizontalRoads.length === 0) return;
        const roadRow = randChoice(this.city.horizontalRoads);
        for (let c = 2; c < MAP_COLS - 2; c += 3) {
            if (isRoadTile(this.city.tiles[roadRow][c])) {
                const pos = tileToPixel(c, roadRow);
                const isStop = c % 12 === 0; // bus stop every ~12 tiles
                this.waypoints.push({ x: pos.x, y: pos.y, isStop });
            }
        }
        // Return trip
        for (let c = MAP_COLS - 3; c >= 2; c -= 3) {
            if (isRoadTile(this.city.tiles[roadRow][c])) {
                const pos = tileToPixel(c, roadRow);
                this.waypoints.push({ x: pos.x, y: pos.y, isStop: false });
            }
        }
    }

    update(dt) {
        if (this.waypoints.length < 2) { this._buildRoute(); return; }

        if (this.isStopped) {
            this.stopTimer -= dt;
            this.speed = 0;
            if (this.stopTimer <= 0) { this.isStopped = false; }
            return;
        }

        const wp = this.waypoints[this.waypointIdx];
        const d = dist(this.x, this.y, wp.x, wp.y);

        if (d < TILE_SIZE * 0.8) {
            if (wp.isStop) {
                this.isStopped = true;
                this.stopTimer = BUS_STOP_TIME;
                this.speed = 0;
            }
            this.waypointIdx++;
            if (this.waypointIdx >= this.waypoints.length) {
                this.waypointIdx = 0;
            }
        }

        const target = this.waypoints[this.waypointIdx];
        const desiredAngle = Math.atan2(target.y - this.y, target.x - this.x);
        let diff = desiredAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += clamp(diff, -2.0 * dt, 2.0 * dt);

        const wantedSpeed = this.maxSpeed * (Math.abs(diff) > 0.5 ? 0.4 : 1.0);
        if (this.speed < wantedSpeed) this.speed += 25 * dt;
        else this.speed -= 40 * dt;
        this.speed = clamp(this.speed, 0, this.maxSpeed);

        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;
    }

    getBounds() {
        return { x: this.x - this.width / 2, y: this.y - this.height / 2, w: this.width, h: this.height };
    }
}

// ============================================================
// TRAFFIC MANAGER
// ============================================================

class TrafficManager {
    constructor(city) {
        this.city = city;
        this.cars = [];
        this.pedestrians = [];
        this.buses = [];
    }

    update(dt, playerTaxi, hazardMgr) {
        // Spawn NPC cars
        while (this.cars.length < MAX_NPC_CARS) {
            let spawned = false;
            for (let attempt = 0; attempt < 20; attempt++) {
                const pos = this.city.getRandomRoadPosition();
                if (dist(pos.x, pos.y, playerTaxi.x, playerTaxi.y) > TILE_SIZE * 8) {
                    this.cars.push(new NpcCar(pos.x, pos.y, this.city));
                    spawned = true;
                    break;
                }
            }
            if (!spawned) break;
        }

        // Spawn pedestrians
        while (this.pedestrians.length < MAX_PEDESTRIANS) {
            if (this.city.sidewalkTiles && this.city.sidewalkTiles.length > 0) {
                const tile = randChoice(this.city.sidewalkTiles);
                const pos = tileToPixel(tile.col, tile.row);
                if (dist(pos.x, pos.y, playerTaxi.x, playerTaxi.y) > TILE_SIZE * 6) {
                    this.pedestrians.push(new Pedestrian(pos.x, pos.y, this.city));
                }
            }
            break; // spawn 1 per frame max
        }

        // Spawn buses
        while (this.buses.length < MAX_BUSES) {
            this.buses.push(new Bus(this.city));
        }

        for (const car of this.cars) {
            car.update(dt, this.cars, playerTaxi, hazardMgr);
        }

        for (const ped of this.pedestrians) {
            ped.update(dt);
        }

        for (const bus of this.buses) {
            bus.update(dt);
        }

        // Remove distant pedestrians and respawn
        for (let i = this.pedestrians.length - 1; i >= 0; i--) {
            const ped = this.pedestrians[i];
            if (dist(ped.x, ped.y, playerTaxi.x, playerTaxi.y) > TILE_SIZE * 20) {
                this.pedestrians.splice(i, 1);
            }
        }
    }
}
