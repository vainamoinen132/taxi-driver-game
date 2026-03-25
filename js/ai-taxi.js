// ============================================================
// AI COMPETING TAXIS — Road-following with rivalry tracking
// ============================================================

const AI_TAXI_COMPANIES = [
    { name: 'RapidCab', color: '#e74c3c' },
    { name: 'GreenLine', color: '#2ecc71' },
    { name: 'BlueStar', color: '#3498db' },
    { name: 'CityRide', color: '#9b59b6' },
];

class AiTaxi {
    constructor(x, y, city) {
        this.x = x;
        this.y = y;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 0;
        this.maxSpeed = rand(100, 160);
        this.width = 40;
        this.height = 22;
        this.city = city;

        // Company identity
        const company = randChoice(AI_TAXI_COMPANIES);
        this.companyName = company.name;
        this.companyColor = company.color;
        this.color = company.color;

        // Rivalry / earnings tracking
        this.totalEarnings = 0;
        this.totalFares = 0;

        // AI state machine: roaming → chasing_passenger → carrying → roaming
        this.state = 'roaming';
        this.targetPassenger = null;
        this.carryTimer = 0;
        this.stuckTimer = 0;
        this.lastX = x;
        this.lastY = y;

        // Road-following waypoints
        this.waypoints = [];
        this.waypointIdx = 0;
        this._buildPath();
    }

    // ---- Road pathfinding (mirrors NpcCar pattern) ----

    _buildPath() {
        this.waypoints = [];
        this.waypointIdx = 0;
        let { col, row } = pixelToTile(this.x, this.y);

        // Snap to nearest road tile if not on one
        if (!this._isRoad(row, col)) {
            const snap = this._findNearestRoadTile(row, col);
            if (snap) {
                row = snap.row; col = snap.col;
                const ctr = tileToPixel(col, row);
                this.x = ctr.x;
                this.y = ctr.y;
            }
        }

        // Walk along connected road tiles
        const visited = new Set();
        let cr = row, cc = col;
        let dirs = this._getRoadDirs(cr, cc);
        if (dirs.length === 0) return;
        let dir = randChoice(dirs);

        for (let step = 0; step < 30; step++) {
            const key = `${cr},${cc}`;
            if (visited.has(key)) break;
            visited.add(key);

            const pos = tileToPixel(cc, cr);
            // Lane offset: stay on right side of road
            const laneOff = 6;
            this.waypoints.push({
                x: pos.x + dir.dr * laneOff,
                y: pos.y + dir.dc * laneOff,
            });

            // Try to continue in current direction
            const nr = cr + dir.dr;
            const nc = cc + dir.dc;
            if (this._isRoad(nr, nc)) {
                cr = nr;
                cc = nc;
            } else {
                // Turn at intersection / dead-end (avoid reversing)
                const newDirs = this._getRoadDirs(cr, cc).filter(d =>
                    !(d.dr === -dir.dr && d.dc === -dir.dc)
                );
                if (newDirs.length > 0) {
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

    _buildPathToward(tx, ty) {
        // Build a path that tries to head toward a target position
        this.waypoints = [];
        this.waypointIdx = 0;
        let { col, row } = pixelToTile(this.x, this.y);

        if (!this._isRoad(row, col)) {
            const snap = this._findNearestRoadTile(row, col);
            if (snap) {
                row = snap.row; col = snap.col;
                const ctr = tileToPixel(col, row);
                this.x = ctr.x;
                this.y = ctr.y;
            }
        }

        const targetTile = pixelToTile(tx, ty);
        const visited = new Set();
        let cr = row, cc = col;
        let dirs = this._getRoadDirs(cr, cc);
        if (dirs.length === 0) return;

        // Pick initial direction that gets closest to target
        let dir = this._bestDirToward(dirs, cr, cc, targetTile.row, targetTile.col);

        for (let step = 0; step < 30; step++) {
            const key = `${cr},${cc}`;
            if (visited.has(key)) break;
            visited.add(key);

            const pos = tileToPixel(cc, cr);
            const laneOff = 6;
            this.waypoints.push({
                x: pos.x + dir.dr * laneOff,
                y: pos.y + dir.dc * laneOff,
            });

            // Close enough to target tile?
            if (Math.abs(cr - targetTile.row) <= 1 && Math.abs(cc - targetTile.col) <= 1) break;

            const nr = cr + dir.dr;
            const nc = cc + dir.dc;
            if (this._isRoad(nr, nc)) {
                cr = nr;
                cc = nc;
            } else {
                const newDirs = this._getRoadDirs(cr, cc).filter(d =>
                    !(d.dr === -dir.dr && d.dc === -dir.dc)
                );
                if (newDirs.length > 0) {
                    dir = this._bestDirToward(newDirs, cr, cc, targetTile.row, targetTile.col);
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

    _bestDirToward(dirs, cr, cc, tr, tc) {
        let best = dirs[0];
        let bestDist = Infinity;
        for (const d of dirs) {
            const nr = cr + d.dr;
            const nc = cc + d.dc;
            const dd = Math.abs(nr - tr) + Math.abs(nc - tc);
            if (dd < bestDist) {
                bestDist = dd;
                best = d;
            }
        }
        return best;
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

    // ---- Main update ----

    update(dt, passengers) {
        // Stuck detection
        this.stuckTimer += dt;
        if (this.stuckTimer > 3) {
            const moved = dist(this.x, this.y, this.lastX, this.lastY);
            if (moved < 10) {
                // Unstick: rebuild path from current position
                this._buildPath();
            }
            this.lastX = this.x;
            this.lastY = this.y;
            this.stuckTimer = 0;
        }

        switch (this.state) {
            case 'roaming':
                this._roam(dt, passengers);
                break;
            case 'chasing_passenger':
                this._chasePassenger(dt);
                break;
            case 'carrying':
                this._carry(dt);
                break;
        }

        // Follow waypoint path
        this._followWaypoints(dt);
    }

    // ---- State handlers ----

    _roam(dt, passengers) {
        // Look for unclaimed passengers
        let nearestP = null;
        let nearestD = Infinity;
        for (const p of passengers) {
            if (p.pickedUp || p.claimed) continue;
            const d = dist(this.x, this.y, p.x, p.y);
            if (d < nearestD && d < TILE_SIZE * 20) {
                nearestD = d;
                nearestP = p;
            }
        }

        if (nearestP) {
            this.targetPassenger = nearestP;
            nearestP.claimed = true;
            this.state = 'chasing_passenger';
            this._buildPathToward(nearestP.x, nearestP.y);
            return;
        }

        // If we've exhausted waypoints, build a new roaming path
        if (this.waypointIdx >= this.waypoints.length || this.waypoints.length < 2) {
            this._buildPath();
        }
    }

    _chasePassenger(dt) {
        if (!this.targetPassenger || this.targetPassenger.pickedUp || !this.targetPassenger.active) {
            this.state = 'roaming';
            this.targetPassenger = null;
            this._buildPath();
            return;
        }

        // Rebuild path toward passenger periodically when waypoints run out
        if (this.waypointIdx >= this.waypoints.length || this.waypoints.length < 2) {
            this._buildPathToward(this.targetPassenger.x, this.targetPassenger.y);
        }

        const d = dist(this.x, this.y, this.targetPassenger.x, this.targetPassenger.y);
        if (d < TILE_SIZE) {
            // Pick up passenger (remove from world)
            this.targetPassenger.active = false;
            this.targetPassenger = null;
            this.state = 'carrying';
            this.carryTimer = rand(8, 20);
            this._buildPath();
        }
    }

    _carry(dt) {
        this.carryTimer -= dt;
        if (this.carryTimer <= 0) {
            // Fare completed — add simulated earnings
            const fareAmount = rand(15, 40);
            this.totalEarnings += fareAmount;
            this.totalFares++;
            this.state = 'roaming';
        }

        // Keep following road while carrying
        if (this.waypointIdx >= this.waypoints.length || this.waypoints.length < 2) {
            this._buildPath();
        }
    }

    // ---- Waypoint-following movement ----

    _followWaypoints(dt) {
        if (this.waypoints.length < 2) {
            this._buildPath();
            return;
        }

        // Current waypoint target
        const wp = this.waypoints[Math.min(this.waypointIdx, this.waypoints.length - 1)];
        const dWp = dist(this.x, this.y, wp.x, wp.y);

        // Advance waypoint if close enough
        if (dWp < TILE_SIZE * 0.6) {
            this.waypointIdx++;
            if (this.waypointIdx >= this.waypoints.length) {
                // Path exhausted — will rebuild on next state tick
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

        // Speed control
        const wantedSpeed = this.maxSpeed * turnFactor;
        if (this.speed < wantedSpeed) {
            this.speed += 50 * dt;
        } else {
            this.speed -= 60 * dt;
        }
        this.speed = clamp(this.speed, 0, this.maxSpeed);

        // Move
        const vx = Math.cos(this.angle) * this.speed * dt;
        const vy = Math.sin(this.angle) * this.speed * dt;
        const newX = this.x + vx;
        const newY = this.y + vy;

        // Only move if staying on road tiles
        const tile = pixelToTile(newX, newY);
        if (tile.row >= 0 && tile.row < MAP_ROWS && tile.col >= 0 && tile.col < MAP_COLS) {
            const t = this.city.tiles[tile.row][tile.col];
            if (t === TILE.ROAD_H || t === TILE.ROAD_V || t === TILE.ROAD_CROSS || t === TILE.HIGHWAY) {
                this.x = newX;
                this.y = newY;
            } else {
                // Off-road — snap back and rebuild
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
