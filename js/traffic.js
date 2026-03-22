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
            if (snap) { row = snap.row; col = snap.col; }
        }

        // Walk along road tiles to build waypoint chain
        const visited = new Set();
        let cr = row, cc = col;
        // Pick a direction based on road type
        let dirs = this._getRoadDirs(cr, cc);
        if (dirs.length === 0) return;
        let dir = randChoice(dirs);

        for (let step = 0; step < 30; step++) {
            const key = `${cr},${cc}`;
            if (visited.has(key)) break;
            visited.add(key);

            const pos = tileToPixel(cc, cr);
            this.waypoints.push({ x: pos.x, y: pos.y });

            // Try to continue in current direction
            const nr = cr + dir.dr;
            const nc = cc + dir.dc;
            if (this._isRoad(nr, nc)) {
                cr = nr;
                cc = nc;
            } else {
                // At intersection or dead end, pick a new valid direction
                const newDirs = this._getRoadDirs(cr, cc).filter(d =>
                    !(d.dr === -dir.dr && d.dc === -dir.dc) // don't go backward
                );
                if (newDirs.length > 0) {
                    dir = randChoice(newDirs);
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

    update(dt, allCars, playerTaxi) {
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
        this.angle += clamp(diff, -3.0 * dt, 3.0 * dt);

        // Slow down for turns
        const turnFactor = Math.abs(diff) > 0.5 ? 0.4 : 1.0;

        // Brake for nearby cars ahead
        let brakeAmount = 0;
        const lookAhead = 60;
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

        // Only move if still on road or sidewalk (never cut through buildings)
        const tile = pixelToTile(newX, newY);
        if (tile.row >= 0 && tile.row < MAP_ROWS && tile.col >= 0 && tile.col < MAP_COLS) {
            const t = this.city.tiles[tile.row][tile.col];
            if (t === TILE.ROAD_H || t === TILE.ROAD_V || t === TILE.ROAD_CROSS || t === TILE.SIDEWALK) {
                this.x = newX;
                this.y = newY;
            } else {
                // Off-road — rebuild path
                this.speed = 0;
                this._buildPath();
            }
        }

        // Stuck detection — respawn far from player if stuck too long
        const moved = dist(this.x, this.y, this.lastX, this.lastY);
        if (moved < 0.5) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 5) {
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
            if (dist(pos.x, pos.y, playerTaxi.x, playerTaxi.y) > TILE_SIZE * 15) {
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

class TrafficManager {
    constructor(city) {
        this.city = city;
        this.cars = [];
    }

    update(dt, playerTaxi) {
        // Gradually spawn cars up to limit, always far from player
        while (this.cars.length < MAX_NPC_CARS) {
            let spawned = false;
            for (let attempt = 0; attempt < 20; attempt++) {
                const pos = this.city.getRandomRoadPosition();
                if (dist(pos.x, pos.y, playerTaxi.x, playerTaxi.y) > TILE_SIZE * 15) {
                    this.cars.push(new NpcCar(pos.x, pos.y, this.city));
                    spawned = true;
                    break;
                }
            }
            if (!spawned) break; // can't find valid spot, try next frame
        }

        for (const car of this.cars) {
            car.update(dt, this.cars, playerTaxi);
        }
    }
}
