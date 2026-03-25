// ============================================================
// CITY MAP GENERATOR
// ============================================================

class City {
    constructor(seed) {
        this.tiles = [];
        this.buildings = [];
        this.roadTiles = [];
        this.seed = seed || Math.floor(Math.random() * 999999);
        this.rng = new SeededRandom(this.seed);
        this.generate();
        this.blockedTiles = new Set();
        this.slowTiles = new Set();
    }

    generate() {
        // Initialize all grass
        this.tiles = Array.from({ length: MAP_ROWS }, () =>
            Array.from({ length: MAP_COLS }, () => TILE.GRASS)
        );

        // Define road grid - main roads every ~8 tiles, with some variety
        this.horizontalRoads = [];
        this.verticalRoads = [];

        // Major horizontal roads
        for (let r = 4; r < MAP_ROWS - 3; r += this.rng.randInt(5, 7)) {
            this.horizontalRoads.push(r);
        }
        // Major vertical roads
        for (let c = 4; c < MAP_COLS - 3; c += this.rng.randInt(5, 7)) {
            this.verticalRoads.push(c);
        }

        // Draw horizontal roads (2 lanes wide)
        for (const r of this.horizontalRoads) {
            for (let c = 0; c < MAP_COLS; c++) {
                this.tiles[r][c] = TILE.ROAD_H;
                if (r + 1 < MAP_ROWS) this.tiles[r + 1][c] = TILE.ROAD_H;
            }
        }

        // Draw vertical roads (2 lanes wide)
        for (const c of this.verticalRoads) {
            for (let r = 0; r < MAP_ROWS; r++) {
                this.tiles[r][c] = TILE.ROAD_V;
                if (c + 1 < MAP_COLS) this.tiles[r][c + 1] = TILE.ROAD_V;
            }
        }

        // Mark intersections
        for (const r of this.horizontalRoads) {
            for (const c of this.verticalRoads) {
                this.tiles[r][c] = TILE.ROAD_CROSS;
                if (c + 1 < MAP_COLS) this.tiles[r][c + 1] = TILE.ROAD_CROSS;
                if (r + 1 < MAP_ROWS) this.tiles[r + 1][c] = TILE.ROAD_CROSS;
                if (r + 1 < MAP_ROWS && c + 1 < MAP_COLS) this.tiles[r + 1][c + 1] = TILE.ROAD_CROSS;
            }
        }

        // Add sidewalks adjacent to roads
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                if (isRoadTile(this.tiles[r][c])) continue;
                let adj = this._hasAdjacentRoad(r, c);
                if (adj) {
                    this.tiles[r][c] = TILE.SIDEWALK;
                }
            }
        }

        // Collect road tiles
        this.roadTiles = [];
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                if (isRoadTile(this.tiles[r][c])) {
                    this.roadTiles.push({ col: c, row: r });
                }
            }
        }

        // Place buildings in city blocks
        this._placeBuildings();

        // Add a few park areas
        this._addParks();

        // Add a small pond/lake for visual interest
        this._addWaterFeature();

        // Add highway loop around outer edge of map
        this._addHighway();

        // Collect sidewalk tiles (after buildings/parking placed, so list is accurate)
        this.sidewalkTiles = [];
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                if (this.tiles[r][c] === TILE.SIDEWALK) {
                    this.sidewalkTiles.push({ col: c, row: r });
                }
            }
        }
    }

    _addWaterFeature() {
        // Place 1-2 small ponds in grass areas for visual variety
        const pondCount = this.rng.randInt(1, 2);
        for (let p = 0; p < pondCount; p++) {
            const pw = this.rng.randInt(2, 4);
            const ph = this.rng.randInt(2, 3);
            let placed = false;
            for (let attempt = 0; attempt < 80 && !placed; attempt++) {
                const sr = this.rng.randInt(5, MAP_ROWS - ph - 5);
                const sc = this.rng.randInt(5, MAP_COLS - pw - 5);
                // Check all tiles are grass
                let ok = true;
                for (let dr = 0; dr < ph && ok; dr++) {
                    for (let dc = 0; dc < pw && ok; dc++) {
                        if (this.tiles[sr + dr][sc + dc] !== TILE.GRASS) ok = false;
                    }
                }
                if (ok) {
                    for (let dr = 0; dr < ph; dr++) {
                        for (let dc = 0; dc < pw; dc++) {
                            this.tiles[sr + dr][sc + dc] = TILE.WATER;
                        }
                    }
                    placed = true;
                }
            }
        }
    }

    _addHighway() {
        // Build a 2-lane highway ring around the outer edge of the map
        const margin = 2;
        // Top edge
        for (let c = margin; c < MAP_COLS - margin; c++) {
            this.tiles[margin][c] = TILE.HIGHWAY;
            this.tiles[margin + 1][c] = TILE.HIGHWAY;
        }
        // Bottom edge
        for (let c = margin; c < MAP_COLS - margin; c++) {
            this.tiles[MAP_ROWS - margin - 1][c] = TILE.HIGHWAY;
            this.tiles[MAP_ROWS - margin - 2][c] = TILE.HIGHWAY;
        }
        // Left edge
        for (let r = margin; r < MAP_ROWS - margin; r++) {
            this.tiles[r][margin] = TILE.HIGHWAY;
            this.tiles[r][margin + 1] = TILE.HIGHWAY;
        }
        // Right edge
        for (let r = margin; r < MAP_ROWS - margin; r++) {
            this.tiles[r][MAP_COLS - margin - 1] = TILE.HIGHWAY;
            this.tiles[r][MAP_COLS - margin - 2] = TILE.HIGHWAY;
        }
    }

    _hasAdjacentRoad(r, c) {
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS) {
                if (isRoadTile(this.tiles[nr][nc])) return true;
            }
        }
        return false;
    }

    _placeBuildings() {
        this.buildings = [];

        // Define city districts/zones with building type weights
        const zones = this._defineZones();

        // Find city blocks (areas between roads)
        const blocks = this._findBlocks();

        // Place exactly one of each essential building first
        const essentialTypes = [
            BUILDING_TYPE.HOME,
            BUILDING_TYPE.STADIUM,
            BUILDING_TYPE.CONCERT_HALL,
            BUILDING_TYPE.HOSPITAL,
            BUILDING_TYPE.HOSPITAL,
            BUILDING_TYPE.GAS_STATION,
            BUILDING_TYPE.GAS_STATION,
            BUILDING_TYPE.GAS_STATION,
            BUILDING_TYPE.GAS_STATION,
            BUILDING_TYPE.GAS_STATION,
            BUILDING_TYPE.MECHANIC,
            BUILDING_TYPE.MECHANIC,
            BUILDING_TYPE.MECHANIC,
            BUILDING_TYPE.POLICE,
            BUILDING_TYPE.POLICE,
            BUILDING_TYPE.SCHOOL,
            BUILDING_TYPE.SCHOOL,
            BUILDING_TYPE.MALL,
            BUILDING_TYPE.MALL,
            BUILDING_TYPE.BANK,
            BUILDING_TYPE.BANK,
        ];

        const usedBlocks = new Set();

        // Place essential buildings in random blocks
        for (const type of essentialTypes) {
            let attempts = 0;
            while (attempts < 100) {
                const blockIdx = this.rng.randInt(0, blocks.length - 1);
                if (usedBlocks.has(blockIdx)) { attempts++; continue; }
                const block = blocks[blockIdx];
                // Large buildings for stadium/concert hall
                let size = (type === BUILDING_TYPE.STADIUM || type === BUILDING_TYPE.CONCERT_HALL)
                    ? { w: 4, h: 4 } : { w: this.rng.randInt(2, 3), h: this.rng.randInt(2, 3) };
                const pos = this._findBuildingSpot(block, size.w, size.h);
                if (pos) {
                    this._placeBuildingOnMap(pos.col, pos.row, size.w, size.h, type);
                    usedBlocks.add(blockIdx);
                    break;
                }
                attempts++;
            }
        }

        // Fill remaining blocks with mixed buildings
        for (let i = 0; i < blocks.length; i++) {
            if (usedBlocks.has(i)) continue;
            const block = blocks[i];
            const zone = this._getZoneForBlock(block, zones);
            this._fillBlockWithBuildings(block, zone);
        }
    }

    _defineZones() {
        // Divide map into zones
        return [
            { name: 'residential', minCol: 0, maxCol: MAP_COLS * 0.35, minRow: 0, maxRow: MAP_ROWS * 0.5,
              types: [BUILDING_TYPE.HOUSE, BUILDING_TYPE.HOUSE, BUILDING_TYPE.HOUSE, BUILDING_TYPE.APARTMENT, BUILDING_TYPE.CHURCH] },
            { name: 'downtown', minCol: MAP_COLS * 0.3, maxCol: MAP_COLS * 0.7, minRow: MAP_ROWS * 0.2, maxRow: MAP_ROWS * 0.7,
              types: [BUILDING_TYPE.OFFICE, BUILDING_TYPE.OFFICE, BUILDING_TYPE.RESTAURANT, BUILDING_TYPE.HOTEL, BUILDING_TYPE.BANK] },
            { name: 'entertainment', minCol: MAP_COLS * 0.5, maxCol: MAP_COLS, minRow: 0, maxRow: MAP_ROWS * 0.4,
              types: [BUILDING_TYPE.RESTAURANT, BUILDING_TYPE.HOTEL, BUILDING_TYPE.GYM, BUILDING_TYPE.RESTAURANT] },
            { name: 'industrial', minCol: 0, maxCol: MAP_COLS * 0.4, minRow: MAP_ROWS * 0.6, maxRow: MAP_ROWS,
              types: [BUILDING_TYPE.FACTORY, BUILDING_TYPE.FACTORY, BUILDING_TYPE.OFFICE] },
            { name: 'suburban', minCol: MAP_COLS * 0.6, maxCol: MAP_COLS, minRow: MAP_ROWS * 0.5, maxRow: MAP_ROWS,
              types: [BUILDING_TYPE.HOUSE, BUILDING_TYPE.HOUSE, BUILDING_TYPE.APARTMENT, BUILDING_TYPE.SCHOOL, BUILDING_TYPE.RESTAURANT] },
        ];
    }

    _getZoneForBlock(block, zones) {
        const cx = (block.minCol + block.maxCol) / 2;
        const cy = (block.minRow + block.maxRow) / 2;
        for (const z of zones) {
            if (cx >= z.minCol && cx <= z.maxCol && cy >= z.minRow && cy <= z.maxRow) {
                return z;
            }
        }
        // Default
        return { types: [BUILDING_TYPE.HOUSE, BUILDING_TYPE.APARTMENT, BUILDING_TYPE.RESTAURANT] };
    }

    _findBlocks() {
        // Find rectangular areas between roads
        const blocks = [];
        const visited = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(false));

        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                if (visited[r][c]) continue;
                if (this.tiles[r][c] !== TILE.GRASS && this.tiles[r][c] !== TILE.SIDEWALK) continue;

                // Flood fill to find block bounds
                let minR = r, maxR = r, minC = c, maxC = c;
                const stack = [[r, c]];
                visited[r][c] = true;
                const cells = [];
                while (stack.length > 0) {
                    const [cr, cc] = stack.pop();
                    cells.push([cr, cc]);
                    minR = Math.min(minR, cr);
                    maxR = Math.max(maxR, cr);
                    minC = Math.min(minC, cc);
                    maxC = Math.max(maxC, cc);
                    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                        const nr = cr + dr, nc = cc + dc;
                        if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS && !visited[nr][nc]) {
                            if (this.tiles[nr][nc] === TILE.GRASS || this.tiles[nr][nc] === TILE.SIDEWALK) {
                                visited[nr][nc] = true;
                                stack.push([nr, nc]);
                            }
                        }
                    }
                }

                if (cells.length >= 4) {
                    blocks.push({ minCol: minC, maxCol: maxC, minRow: minR, maxRow: maxR, cells });
                }
            }
        }
        return blocks;
    }

    _findBuildingSpot(block, w, h) {
        // Find a spot within the block interior — only on GRASS tiles, with 2-tile margin from block edges
        // to prevent buildings from touching sidewalks/roads
        const margin = 2;
        const minCol = block.minCol + margin;
        const maxCol = block.maxCol - w - margin + 1;
        const minRow = block.minRow + margin;
        const maxRow = block.maxRow - h - margin + 1;
        if (minCol > maxCol || minRow > maxRow) return null;

        for (let attempt = 0; attempt < 30; attempt++) {
            const col = this.rng.randInt(minCol, maxCol);
            const row = this.rng.randInt(minRow, maxRow);
            if (col + w > MAP_COLS || row + h > MAP_ROWS) continue;
            let valid = true;
            for (let r = row; r < row + h && valid; r++) {
                for (let c = col; c < col + w && valid; c++) {
                    if (this.tiles[r][c] !== TILE.GRASS) {
                        valid = false;
                    }
                }
            }
            if (valid) return { col, row };
        }
        return null;
    }

    _placeBuildingOnMap(col, row, w, h, type) {
        for (let r = row; r < row + h; r++) {
            for (let c = col; c < col + w; c++) {
                if (r < MAP_ROWS && c < MAP_COLS) {
                    this.tiles[r][c] = TILE.BUILDING;
                }
            }
        }

        // Assign district based on position (scalable for different city layouts)
        const district = this._getDistrictForPosition(col, row);
        
        // Generate proper name for this building
        const name = this._generateBuildingName(type, district);
        
        const building = {
            col, row, w, h, type,
            name,
            district,
            x: col * TILE_SIZE,
            y: row * TILE_SIZE,
            px: col * TILE_SIZE + (w * TILE_SIZE) / 2,
            py: row * TILE_SIZE + (h * TILE_SIZE) / 2,
            width: w * TILE_SIZE,
            height: h * TILE_SIZE,
            parkingTiles: [],
        };
        // Gas stations get unique fuel prices
        if (type === BUILDING_TYPE.GAS_STATION) {
            building.fuelPrice = this.rng.rand(FUEL_PRICE_MIN, FUEL_PRICE_MAX);
            building.fuelPrice = Math.round(building.fuelPrice * 100) / 100;
        }
        this.buildings.push(building);

        // Add parking lot next to service buildings
        const needsParking = [
            BUILDING_TYPE.GAS_STATION, BUILDING_TYPE.MECHANIC,
            BUILDING_TYPE.HOSPITAL, BUILDING_TYPE.HOME,
            BUILDING_TYPE.MALL, BUILDING_TYPE.STADIUM,
            BUILDING_TYPE.CONCERT_HALL, BUILDING_TYPE.HOTEL,
        ];
        if (needsParking.includes(type)) {
            this._addParkingLot(building);
        }
    }

    _addParkingLot(building) {
        // Try each side of the building for a strip of parking (prefer side nearest road)
        const sides = [
            { dr: -1, dc: 0, label: 'top' },
            { dr: 1, dc: 0, label: 'bottom' },
            { dc: -1, dr: 0, label: 'left' },
            { dc: 1, dr: 0, label: 'right' },
        ];
        // Shuffle so parking placement varies
        sides.sort(() => this.rng.next() - 0.5);

        for (const side of sides) {
            const tiles = [];
            let valid = true;

            if (side.label === 'top' || side.label === 'bottom') {
                // Horizontal strip above or below building
                const r = side.label === 'top' ? building.row - 1 : building.row + building.h;
                if (r < 0 || r >= MAP_ROWS) continue;
                for (let c = building.col; c < building.col + building.w; c++) {
                    if (c < 0 || c >= MAP_COLS) { valid = false; break; }
                    const t = this.tiles[r][c];
                    if (t !== TILE.GRASS && t !== TILE.SIDEWALK) { valid = false; break; }
                    tiles.push({ r, c });
                }
            } else {
                // Vertical strip left or right of building
                const c = side.label === 'left' ? building.col - 1 : building.col + building.w;
                if (c < 0 || c >= MAP_COLS) continue;
                for (let r = building.row; r < building.row + building.h; r++) {
                    if (r < 0 || r >= MAP_ROWS) { valid = false; break; }
                    const t = this.tiles[r][c];
                    if (t !== TILE.GRASS && t !== TILE.SIDEWALK) { valid = false; break; }
                    tiles.push({ r, c });
                }
            }

            if (valid && tiles.length > 0) {
                for (const { r, c } of tiles) {
                    this.tiles[r][c] = TILE.PARKING;
                    building.parkingTiles.push({ row: r, col: c });
                }
                return; // one side is enough
            }
        }
    }

    _fillBlockWithBuildings(block, zone) {
        const bw = block.maxCol - block.minCol;
        const bh = block.maxRow - block.minRow;
        if (bw < 3 || bh < 3) return;

        // Place 1-3 buildings per block
        const count = this.rng.randInt(1, Math.min(3, Math.floor(bw * bh / 8)));
        for (let i = 0; i < count; i++) {
            const w = this.rng.randInt(2, Math.min(4, bw - 2));
            const h = this.rng.randInt(2, Math.min(3, bh - 2));
            const type = this.rng.randChoice(zone.types);
            const pos = this._findBuildingSpot(block, w, h);
            if (pos) {
                this._placeBuildingOnMap(pos.col, pos.row, w, h, type);
            }
        }
    }

    _addParks() {
        // Convert a few grass areas to park
        let parkCount = 0;
        const maxParks = Math.max(2, Math.floor(MAP_COLS * MAP_ROWS / 400));
        for (let r = 0; r < MAP_ROWS && parkCount < maxParks; r++) {
            for (let c = 0; c < MAP_COLS && parkCount < maxParks; c++) {
                if (this.tiles[r][c] === TILE.GRASS && this.rng.next() < 0.005) {
                    // Make a small park
                    const pw = this.rng.randInt(2, 4);
                    const ph = this.rng.randInt(2, 3);
                    let valid = true;
                    for (let pr = r; pr < r + ph && pr < MAP_ROWS && valid; pr++) {
                        for (let pc = c; pc < c + pw && pc < MAP_COLS && valid; pc++) {
                            if (this.tiles[pr][pc] !== TILE.GRASS) valid = false;
                        }
                    }
                    if (valid) {
                        for (let pr = r; pr < r + ph && pr < MAP_ROWS; pr++) {
                            for (let pc = c; pc < c + pw && pc < MAP_COLS; pc++) {
                                this.tiles[pr][pc] = TILE.PARK;
                            }
                        }
                        this.buildings.push({
                            col: c, row: r, w: pw, h: ph, type: BUILDING_TYPE.PARK,
                            x: c * TILE_SIZE, y: r * TILE_SIZE,
                            px: c * TILE_SIZE + (pw * TILE_SIZE) / 2,
                            py: r * TILE_SIZE + (ph * TILE_SIZE) / 2,
                            width: pw * TILE_SIZE, height: ph * TILE_SIZE,
                        });
                        parkCount++;
                    }
                }
            }
        }
    }

    getRandomRoadPosition() {
        if (this.roadTiles && this.roadTiles.length > 0) {
            const tile = randChoice(this.roadTiles);
            return tileToPixel(tile.col, tile.row);
        }
        // Fallback
        return { x: rand(100, MAP_COLS * TILE_SIZE - 100), y: rand(100, MAP_ROWS * TILE_SIZE - 100) };
    }

    getBuildingsOfType(type) {
        return this.buildings.filter(b => b.type === type);
    }

    getNearestBuildingOfType(x, y, type) {
        let nearest = null;
        let minDist = Infinity;
        for (const b of this.buildings) {
            if (b.type !== type) continue;
            const d = dist(x, y, b.px, b.py);
            if (d < minDist) {
                minDist = d;
                nearest = b;
            }
        }
        return nearest;
    }

    // Get road position near a building
    getRoadNearBuilding(building) {
        // Search outward from building for a road tile
        for (let radius = 1; radius < 6; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    const r = building.row + dr;
                    const c = building.col + dc;
                    if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
                        if (isRoadTile(this.tiles[r][c])) {
                            return tileToPixel(c, r);
                        }
                    }
                }
            }
        }
        return this.getRandomRoadPosition();
    }

    getRandomSidewalkPosition() {
        // Collect sidewalk tiles and pick one at random; fall back to road if none found
        const sidewalks = [];
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                if (this.tiles[r][c] === TILE.SIDEWALK) {
                    sidewalks.push({ col: c, row: r });
                }
            }
        }
        if (sidewalks.length > 0) {
            const tile = randChoice(sidewalks);
            return tileToPixel(tile.col, tile.row);
        }
        return this.getRandomRoadPosition();
    }

    getSidewalkNearBuilding(building) {
        // Search outward from building for a sidewalk tile
        for (let radius = 1; radius < 6; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    const r = building.row + dr;
                    const c = building.col + dc;
                    if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
                        if (this.tiles[r][c] === TILE.SIDEWALK) {
                            return tileToPixel(c, r);
                        }
                    }
                }
            }
        }
        // Fall back to road near building
        return this.getRoadNearBuilding(building);
    }

    getRandomDestinationBuilding(excludeTypes) {
        let candidates = this.buildings;
        if (excludeTypes && excludeTypes.length > 0) {
            candidates = candidates.filter(b => !excludeTypes.includes(b.type));
        }
        if (candidates.length === 0) return null;
        return randChoice(candidates);
    }

    isRoadAt(x, y) {
        const { col, row } = pixelToTile(x, y);
        if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return false;
        return isRoadTile(this.tiles[row][col]);
    }

    isSolidAt(x, y) {
        const { col, row } = pixelToTile(x, y);
        if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return true;
        if (this.blockedTiles.has(`${row},${col}`)) return true;
        return this.tiles[row][col] === TILE.BUILDING || this.tiles[row][col] === TILE.WATER;
    }

    blockRoadTiles(tiles) { tiles.forEach(t => this.blockedTiles.add(`${t.row},${t.col}`)); }
    unblockRoadTiles(tiles) { tiles.forEach(t => this.blockedTiles.delete(`${t.row},${t.col}`)); }
    addSlowTiles(tiles) { tiles.forEach(t => this.slowTiles.add(`${t.row},${t.col}`)); }
    removeSlowTiles(tiles) { tiles.forEach(t => this.slowTiles.delete(`${t.row},${t.col}`)); }

    isBlockedAt(x, y) {
        const { col, row } = pixelToTile(x, y);
        return this.blockedTiles.has(`${row},${col}`);
    }

    isSlowAt(x, y) {
        const { col, row } = pixelToTile(x, y);
        return this.slowTiles.has(`${row},${col}`);
    }

    getBuildingAt(x, y) {
        for (const b of this.buildings) {
            if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
                return b;
            }
        }
        return null;
    }

    _getDistrictForPosition(col, row) {
        // Simple grid-based district assignment (easily customizable for different city layouts)
        const midCol = MAP_COLS / 2;
        const midRow = MAP_ROWS / 2;
        
        if (col < midCol * 0.3) {
            if (row < midRow * 0.3) return 'industrial';
            if (row < midRow * 0.7) return 'harbor';
            return 'industrial';
        } else if (col < midCol * 0.7) {
            if (row < midRow * 0.3) return 'university';
            if (row < midRow * 0.7) return 'downtown';
            return 'financial';
        } else {
            if (row < midRow * 0.3) return 'old_town';
            if (row < midRow * 0.7) return 'downtown';
            return 'old_town';
        }
    }

    _generateBuildingName(type, district) {
        const namePool = BUILDING_NAMES[type];
        if (!namePool) return 'Building';
        
        // For variety, sometimes add district prefix
        const districtNames = {
            'downtown': ['Central', 'Metro', 'City'],
            'old_town': ['Historic', 'Old', 'Heritage'],
            'harbor': ['Harbor', 'Port', 'Marina'],
            'industrial': ['Industrial', 'Factory', 'Plant'],
            'university': ['University', 'Campus', 'Academic'],
            'financial': ['Financial', 'Commerce', 'Business'],
        };
        
        const baseName = this.rng.randChoice(namePool);

        // 30% chance to add district prefix for more variety
        if (this.rng.next() < 0.3 && district) {
            const prefixes = districtNames[district] || [];
            if (prefixes.length > 0) {
                const prefix = this.rng.randChoice(prefixes);
                return `${prefix} ${baseName}`;
            }
        }
        
        return baseName;
    }
}
