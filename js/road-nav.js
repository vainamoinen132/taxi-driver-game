// ============================================================
// ROAD NAVIGATION — Shared pathfinding utilities for NPC vehicles
// ============================================================

const RoadNav = {
    isRoad(city, r, c) {
        if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) return false;
        return isRoadTile(city.tiles[r][c]);
    },

    getRoadDirs(city, r, c) {
        const dirs = [];
        if (RoadNav.isRoad(city, r - 1, c)) dirs.push({ dr: -1, dc: 0 });
        if (RoadNav.isRoad(city, r + 1, c)) dirs.push({ dr: 1, dc: 0 });
        if (RoadNav.isRoad(city, r, c - 1)) dirs.push({ dr: 0, dc: -1 });
        if (RoadNav.isRoad(city, r, c + 1)) dirs.push({ dr: 0, dc: 1 });
        return dirs;
    },

    findNearestRoadTile(city, r, c) {
        for (let radius = 1; radius < 8; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    if (RoadNav.isRoad(city, r + dr, c + dc)) {
                        return { row: r + dr, col: c + dc };
                    }
                }
            }
        }
        return null;
    },

    // Snap a vehicle to the nearest road tile if off-road. Returns { row, col } or null.
    snapToRoad(vehicle) {
        let { col, row } = pixelToTile(vehicle.x, vehicle.y);
        if (!RoadNav.isRoad(vehicle.city, row, col)) {
            const snap = RoadNav.findNearestRoadTile(vehicle.city, row, col);
            if (snap) {
                row = snap.row; col = snap.col;
                const ctr = tileToPixel(col, row);
                vehicle.x = ctr.x;
                vehicle.y = ctr.y;
            }
            return snap ? { row, col } : null;
        }
        return { row, col };
    },

    // Build a random roaming path along connected road tiles with lane offset
    buildRoamPath(vehicle, steps, laneOffset) {
        const start = RoadNav.snapToRoad(vehicle);
        if (!start) return [];

        const waypoints = [];
        const visited = new Set();
        let cr = start.row, cc = start.col;
        let dirs = RoadNav.getRoadDirs(vehicle.city, cr, cc);
        if (dirs.length === 0) return [];
        let dir = randChoice(dirs);

        for (let step = 0; step < steps; step++) {
            const key = `${cr},${cc}`;
            if (visited.has(key)) break;
            visited.add(key);

            const pos = tileToPixel(cc, cr);
            waypoints.push({
                x: pos.x + (laneOffset ? dir.dr * laneOffset : 0),
                y: pos.y + (laneOffset ? dir.dc * laneOffset : 0),
            });

            const nr = cr + dir.dr;
            const nc = cc + dir.dc;
            if (RoadNav.isRoad(vehicle.city, nr, nc)) {
                cr = nr;
                cc = nc;
            } else {
                const newDirs = RoadNav.getRoadDirs(vehicle.city, cr, cc).filter(d =>
                    !(d.dr === -dir.dr && d.dc === -dir.dc)
                );
                if (newDirs.length > 0) {
                    const straight = newDirs.find(d => d.dr === dir.dr && d.dc === dir.dc);
                    dir = straight || randChoice(newDirs);
                    const nr2 = cr + dir.dr;
                    const nc2 = cc + dir.dc;
                    if (RoadNav.isRoad(vehicle.city, nr2, nc2)) {
                        cr = nr2;
                        cc = nc2;
                    } else break;
                } else break;
            }
        }
        return waypoints;
    },

    // Build a path toward a target position (used by AI taxis)
    buildPathToward(vehicle, tx, ty, steps, laneOffset) {
        const start = RoadNav.snapToRoad(vehicle);
        if (!start) return [];

        const targetTile = pixelToTile(tx, ty);
        const waypoints = [];
        const visited = new Set();
        let cr = start.row, cc = start.col;
        let dirs = RoadNav.getRoadDirs(vehicle.city, cr, cc);
        if (dirs.length === 0) return [];

        let dir = RoadNav.bestDirToward(dirs, cr, cc, targetTile.row, targetTile.col);

        for (let step = 0; step < steps; step++) {
            const key = `${cr},${cc}`;
            if (visited.has(key)) break;
            visited.add(key);

            const pos = tileToPixel(cc, cr);
            waypoints.push({
                x: pos.x + (laneOffset ? dir.dr * laneOffset : 0),
                y: pos.y + (laneOffset ? dir.dc * laneOffset : 0),
            });

            if (Math.abs(cr - targetTile.row) <= 1 && Math.abs(cc - targetTile.col) <= 1) break;

            const nr = cr + dir.dr;
            const nc = cc + dir.dc;
            if (RoadNav.isRoad(vehicle.city, nr, nc)) {
                cr = nr;
                cc = nc;
            } else {
                const newDirs = RoadNav.getRoadDirs(vehicle.city, cr, cc).filter(d =>
                    !(d.dr === -dir.dr && d.dc === -dir.dc)
                );
                if (newDirs.length > 0) {
                    dir = RoadNav.bestDirToward(newDirs, cr, cc, targetTile.row, targetTile.col);
                    const nr2 = cr + dir.dr;
                    const nc2 = cc + dir.dc;
                    if (RoadNav.isRoad(vehicle.city, nr2, nc2)) {
                        cr = nr2;
                        cc = nc2;
                    } else break;
                } else break;
            }
        }
        return waypoints;
    },

    bestDirToward(dirs, cr, cc, tr, tc) {
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
    },

    // Steer vehicle toward a waypoint, apply speed, and clamp to road
    followWaypoint(vehicle, dt, wantedSpeed) {
        const wp = vehicle.waypoints[Math.min(vehicle.waypointIdx, vehicle.waypoints.length - 1)];
        if (!wp) return;

        // Steer
        const desiredAngle = Math.atan2(wp.y - vehicle.y, wp.x - vehicle.x);
        let diff = desiredAngle - vehicle.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        vehicle.angle += clamp(diff, -2.5 * dt, 2.5 * dt);

        // Turn slowdown factor
        const turnFactor = Math.abs(diff) > 0.5 ? 0.4 : 1.0;
        const targetSpeed = wantedSpeed * turnFactor;

        return { diff, turnFactor, targetSpeed };
    },

    // Move vehicle forward and clamp to road; returns false if off-road snap occurred
    moveOnRoad(vehicle, dt) {
        const vx = Math.cos(vehicle.angle) * vehicle.speed * dt;
        const vy = Math.sin(vehicle.angle) * vehicle.speed * dt;
        const newX = vehicle.x + vx;
        const newY = vehicle.y + vy;

        const tile = pixelToTile(newX, newY);
        if (tile.row >= 0 && tile.row < MAP_ROWS && tile.col >= 0 && tile.col < MAP_COLS) {
            const t = vehicle.city.tiles[tile.row][tile.col];
            if (t === TILE.ROAD_H || t === TILE.ROAD_V || t === TILE.ROAD_CROSS || t === TILE.HIGHWAY) {
                vehicle.x = newX;
                vehicle.y = newY;
                return true;
            }
        }
        // Off-road — snap back
        vehicle.speed = 0;
        const snap = RoadNav.findNearestRoadTile(vehicle.city, tile.row, tile.col);
        if (snap) {
            const ctr = tileToPixel(snap.col, snap.row);
            vehicle.x = ctr.x;
            vehicle.y = ctr.y;
        }
        return false;
    },

    // Advance waypoint index if close enough; returns true if path exhausted
    advanceWaypoint(vehicle) {
        const wp = vehicle.waypoints[Math.min(vehicle.waypointIdx, vehicle.waypoints.length - 1)];
        if (!wp) return true;
        const d = dist(vehicle.x, vehicle.y, wp.x, wp.y);
        if (d < TILE_SIZE * 0.6) {
            vehicle.waypointIdx++;
            return vehicle.waypointIdx >= vehicle.waypoints.length;
        }
        return false;
    },

    getBounds(vehicle) {
        return {
            x: vehicle.x - vehicle.width / 2,
            y: vehicle.y - vehicle.height / 2,
            w: vehicle.width,
            h: vehicle.height,
        };
    }
};
