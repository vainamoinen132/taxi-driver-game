// ============================================================
// CITY MAP GENERATOR
// ============================================================

class City {
    constructor() {
        this.tiles = [];
        this.buildings = [];
        this.roadTiles = [];
        this.generate();
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
        for (let r = 4; r < MAP_ROWS - 3; r += randInt(7, 10)) {
            this.horizontalRoads.push(r);
        }
        // Major vertical roads
        for (let c = 4; c < MAP_COLS - 3; c += randInt(7, 10)) {
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
            BUILDING_TYPE.SCHOOL,
            BUILDING_TYPE.SCHOOL,
            BUILDING_TYPE.MALL,
            BUILDING_TYPE.BANK,
        ];

        const usedBlocks = new Set();

        // Place essential buildings in random blocks
        for (const type of essentialTypes) {
            let attempts = 0;
            while (attempts < 100) {
                const blockIdx = randInt(0, blocks.length - 1);
                if (usedBlocks.has(blockIdx)) { attempts++; continue; }
                const block = blocks[blockIdx];
                // Large buildings for stadium/concert hall
                let size = (type === BUILDING_TYPE.STADIUM || type === BUILDING_TYPE.CONCERT_HALL)
                    ? { w: 4, h: 4 } : { w: randInt(2, 3), h: randInt(2, 3) };
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
        // Find a spot within the block interior (not on sidewalk edges)
        for (let attempt = 0; attempt < 30; attempt++) {
            const col = randInt(block.minCol + 1, block.maxCol - w);
            const row = randInt(block.minRow + 1, block.maxRow - h);
            if (col < 0 || row < 0) continue;
            if (col + w > MAP_COLS || row + h > MAP_ROWS) continue;
            let valid = true;
            for (let r = row; r < row + h && valid; r++) {
                for (let c = col; c < col + w && valid; c++) {
                    if (this.tiles[r][c] !== TILE.GRASS && this.tiles[r][c] !== TILE.SIDEWALK) {
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
        this.buildings.push({
            col, row, w, h, type,
            x: col * TILE_SIZE,
            y: row * TILE_SIZE,
            px: col * TILE_SIZE + (w * TILE_SIZE) / 2,
            py: row * TILE_SIZE + (h * TILE_SIZE) / 2,
            width: w * TILE_SIZE,
            height: h * TILE_SIZE,
        });
    }

    _fillBlockWithBuildings(block, zone) {
        const bw = block.maxCol - block.minCol;
        const bh = block.maxRow - block.minRow;
        if (bw < 3 || bh < 3) return;

        // Place 1-3 buildings per block
        const count = randInt(1, Math.min(3, Math.floor(bw * bh / 8)));
        for (let i = 0; i < count; i++) {
            const w = randInt(2, Math.min(4, bw - 2));
            const h = randInt(2, Math.min(3, bh - 2));
            const type = randChoice(zone.types);
            const pos = this._findBuildingSpot(block, w, h);
            if (pos) {
                this._placeBuildingOnMap(pos.col, pos.row, w, h, type);
            }
        }
    }

    _addParks() {
        // Convert a few grass areas to park
        let parkCount = 0;
        for (let r = 0; r < MAP_ROWS && parkCount < 5; r++) {
            for (let c = 0; c < MAP_COLS && parkCount < 5; c++) {
                if (this.tiles[r][c] === TILE.GRASS && Math.random() < 0.003) {
                    // Make a small park
                    const pw = randInt(3, 5);
                    const ph = randInt(3, 5);
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
        const tile = randChoice(this.roadTiles);
        return tileToPixel(tile.col, tile.row);
    }

    getRandomSidewalkPosition() {
        // Try to find a sidewalk tile (adjacent to road but not on it)
        for (let attempt = 0; attempt < 60; attempt++) {
            const roadTile = randChoice(this.roadTiles);
            const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
            const shuffled = dirs.sort(() => Math.random() - 0.5);
            for (const [dr, dc] of shuffled) {
                const r = roadTile.row + dr;
                const c = roadTile.col + dc;
                if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
                    if (this.tiles[r][c] === TILE.SIDEWALK) {
                        return tileToPixel(c, r);
                    }
                }
            }
        }
        // Fallback to road if no sidewalk found
        return this.getRandomRoadPosition();
    }

    getSidewalkNearBuilding(building) {
        // Find a sidewalk tile near a building
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
        return this.getRoadNearBuilding(building);
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

    // Get a random building as a destination (excluding gas station/mechanic)
    getRandomDestinationBuilding(excludeTypes = []) {
        const candidates = this.buildings.filter(b =>
            b.type !== BUILDING_TYPE.GAS_STATION &&
            b.type !== BUILDING_TYPE.MECHANIC &&
            b.type !== BUILDING_TYPE.HOME &&
            !excludeTypes.includes(b.type)
        );
        return candidates.length > 0 ? randChoice(candidates) : randChoice(this.buildings);
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

    isRoadAt(x, y) {
        const { col, row } = pixelToTile(x, y);
        if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return false;
        return isRoadTile(this.tiles[row][col]);
    }

    isSolidAt(x, y) {
        const { col, row } = pixelToTile(x, y);
        if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return true;
        return this.tiles[row][col] === TILE.BUILDING || this.tiles[row][col] === TILE.WATER;
    }

    getBuildingAt(x, y) {
        for (const b of this.buildings) {
            if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
                return b;
            }
        }
        return null;
    }
}
