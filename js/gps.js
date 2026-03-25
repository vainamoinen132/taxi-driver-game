// ============================================================
// GPS ROUTE SYSTEM - Road-based pathfinding for navigation
// ============================================================

class GPSRouteSystem {
    constructor(city) {
        this.city = city;
        this.currentPath = [];
        this.pathStartPos = null;
        this.pathEndPos = null;
        this.enabled = true;
    }

    // Calculate route from start to end following roads only
    calculateRoute(startX, startY, endX, endY) {
        const startTile = pixelToTile(startX, startY);
        const endTile = pixelToTile(endX, endY);
        
        // Find nearest road tiles to start and end positions
        const startRoad = this._findNearestRoadTile(startTile.row, startTile.col);
        const endRoad = this._findNearestRoadTile(endTile.row, endTile.col);
        
        if (!startRoad || !endRoad) {
            this.currentPath = [];
            return false;
        }

        // Use A* pathfinding on road tiles
        const path = this._aStarPath(startRoad, endRoad);
        
        if (path.length > 0) {
            // Convert tile path to pixel coordinates
            this.currentPath = path.map(tile => ({
                x: tile.col * TILE_SIZE + TILE_SIZE / 2,
                y: tile.row * TILE_SIZE + TILE_SIZE / 2
            }));
            this.pathStartPos = { x: startX, y: startY };
            this.pathEndPos = { x: endX, y: endY };
            return true;
        }
        
        this.currentPath = [];
        return false;
    }

    _findNearestRoadTile(row, col) {
        const maxRadius = 15;
        for (let radius = 0; radius < maxRadius; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    const r = row + dr;
                    const c = col + dc;
                    if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
                        const tile = this.city.tiles[r][c];
                        if (tile === TILE.ROAD_H || tile === TILE.ROAD_V || tile === TILE.ROAD_CROSS || tile === TILE.HIGHWAY) {
                            return { row: r, col: c };
                        }
                    }
                }
            }
        }
        return null;
    }

    _aStarPath(start, end) {
        const openSet = [start];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        
        const key = (tile) => `${tile.row},${tile.col}`;
        gScore.set(key(start), 0);
        fScore.set(key(start), this._heuristic(start, end));
        
        while (openSet.length > 0) {
            // Find node with lowest fScore
            let current = openSet[0];
            let currentIndex = 0;
            for (let i = 1; i < openSet.length; i++) {
                if (fScore.get(key(openSet[i])) < fScore.get(key(current))) {
                    current = openSet[i];
                    currentIndex = i;
                }
            }
            
            // Check if we reached the goal
            if (current.row === end.row && current.col === end.col) {
                return this._reconstructPath(cameFrom, current);
            }
            
            // Remove current from openSet and add to closedSet
            openSet.splice(currentIndex, 1);
            closedSet.add(key(current));
            
            // Check all neighbors
            const neighbors = this._getRoadNeighbors(current);
            for (const neighbor of neighbors) {
                const neighborKey = key(neighbor);
                
                if (closedSet.has(neighborKey)) continue;
                
                const tentativeGScore = gScore.get(key(current)) + 1;
                
                if (!openSet.some(tile => tile.row === neighbor.row && tile.col === neighbor.col)) {
                    openSet.push(neighbor);
                } else if (tentativeGScore >= gScore.get(neighborKey)) {
                    continue;
                }
                
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + this._heuristic(neighbor, end));
            }
        }
        
        return []; // No path found
    }

    _heuristic(a, b) {
        // Manhattan distance
        return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
    }

    _reconstructPath(cameFrom, current) {
        const path = [current];
        const key = (tile) => `${tile.row},${tile.col}`;
        
        while (cameFrom.has(key(current))) {
            current = cameFrom.get(key(current));
            path.unshift(current);
        }
        
        return path;
    }

    _getRoadNeighbors(tile) {
        const neighbors = [];
        const directions = [
            { dr: -1, dc: 0 },  // north
            { dr: 1, dc: 0 },   // south
            { dr: 0, dc: -1 },  // west
            { dr: 0, dc: 1 }    // east
        ];
        
        for (const dir of directions) {
            const newRow = tile.row + dir.dr;
            const newCol = tile.col + dir.dc;
            
            if (newRow >= 0 && newRow < MAP_ROWS && newCol >= 0 && newCol < MAP_COLS) {
                const tileType = this.city.tiles[newRow][newCol];
                if (tileType === TILE.ROAD_H || tileType === TILE.ROAD_V || 
                    tileType === TILE.ROAD_CROSS || tileType === TILE.HIGHWAY) {
                    neighbors.push({ row: newRow, col: newCol });
                }
            }
        }
        
        return neighbors;
    }

    clearRoute() {
        this.currentPath = [];
        this.pathStartPos = null;
        this.pathEndPos = null;
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.clearRoute();
        }
        return this.enabled;
    }

    drawRoute(ctx, camera) {
        if (!this.enabled || this.currentPath.length < 2) return;
        
        ctx.save();
        ctx.strokeStyle = '#00FF88';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Draw line from start position to first waypoint
        ctx.beginPath();
        ctx.moveTo(this.pathStartPos.x - camera.x, this.pathStartPos.y - camera.y);
        
        // Draw through all waypoints
        for (const point of this.currentPath) {
            ctx.lineTo(point.x - camera.x, point.y - camera.y);
        }
        
        // Draw to final destination
        ctx.lineTo(this.pathEndPos.x - camera.x, this.pathEndPos.y - camera.y);
        ctx.stroke();
        
        // Draw waypoint dots
        ctx.fillStyle = '#00FF88';
        ctx.setLineDash([]);
        for (let i = 0; i < this.currentPath.length; i += 3) { // Draw every 3rd waypoint to avoid clutter
            const point = this.currentPath[i];
            ctx.beginPath();
            ctx.arc(point.x - camera.x, point.y - camera.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}
