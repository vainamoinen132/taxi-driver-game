// ============================================================
// RENDERER - Draws everything on canvas
// ============================================================

class Renderer {
    constructor(canvas, minimapCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.minimap = minimapCanvas;
        this.mctx = minimapCanvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Pre-render tile colors (clean city style)
        this.tileColors = {
            [TILE.GRASS]: '#7bc558',
            [TILE.ROAD_H]: '#6a6a6a',
            [TILE.ROAD_V]: '#6a6a6a',
            [TILE.ROAD_CROSS]: '#6e6e6e',
            [TILE.SIDEWALK]: '#c8c0b0',
            [TILE.BUILDING]: '#c0b8a8',
            [TILE.WATER]: '#6bb8e8',
            [TILE.PARK]: '#6dce55',
            [TILE.PARKING]: '#8a8a8a',
            [TILE.HIGHWAY]: '#555555',
        };

        // Road markings pattern
        this.dashOffset = 0;

        // Tree positions for parks (cached)
        this.treePositions = [];
        this._treesGenerated = false;

        // Particle system
        this.particles = [];
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // Minimap stays fixed size via CSS
        const mm = this.minimap;
        mm.width = mm.clientWidth;
        mm.height = mm.clientHeight;
    }

    render(camera, city, taxi, aiTaxis, trafficMgr, passengerMgr, hazardMgr, eventMgr, appOrderMgr, gameTime, dt, weather, gps, police) {
        const ctx = this.ctx;
        const cam = camera;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Calculate visible tile range
        const startCol = Math.max(0, Math.floor(cam.x / TILE_SIZE) - 1);
        const endCol = Math.min(MAP_COLS, Math.ceil((cam.x + cam.width) / TILE_SIZE) + 1);
        const startRow = Math.max(0, Math.floor(cam.y / TILE_SIZE) - 1);
        const endRow = Math.min(MAP_ROWS, Math.ceil((cam.y + cam.height) / TILE_SIZE) + 1);

        // Draw tiles
        this._drawTiles(ctx, cam, city, startCol, endCol, startRow, endRow);

        // Draw road markings
        this._drawRoadMarkings(ctx, cam, city, startCol, endCol, startRow, endRow);

        // Draw buildings
        this._drawBuildings(ctx, cam, city, startCol, endCol, startRow, endRow);

        // Draw fuel price signs on gas stations
        this._drawFuelPriceSigns(ctx, cam, city);

        // Draw traffic lights at intersections
        this._drawTrafficLights(ctx, cam, hazardMgr);

        // Draw speed limit signs on roads
        this._drawSpeedLimitSigns(ctx, cam, city, hazardMgr, taxi);

        // Draw speed cameras
        this._drawSpeedCameras(ctx, cam, hazardMgr);

        // Draw passengers
        this._drawPassengers(ctx, cam, passengerMgr);

        // Draw pedestrians
        if (trafficMgr) {
            this._drawPedestrians(ctx, cam, trafficMgr.pedestrians);
        }

        // Draw NPC traffic
        if (trafficMgr) {
            for (const car of trafficMgr.cars) {
                this._drawCar(ctx, cam, car.x, car.y, car.angle, car.width, car.height, car.color, false, weather);
            }
            // Draw buses
            for (const bus of trafficMgr.buses) {
                this._drawBus(ctx, cam, bus, weather);
            }
        }

        // Draw police patrols
        if (police) {
            police.draw(ctx, cam);
        }

        // Draw AI taxis
        for (const ai of aiTaxis) {
            this._drawCar(ctx, cam, ai.x, ai.y, ai.angle, ai.width, ai.height, ai.companyColor || ai.color, false, weather);
            // Draw company label above AI taxi
            const sx = ai.x - cam.x;
            const sy = ai.y - cam.y;
            if (sx > -100 && sx < ctx.canvas.width + 100 && sy > -100 && sy < ctx.canvas.height + 100) {
                ctx.font = 'bold 9px sans-serif';
                ctx.fillStyle = ai.companyColor || '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(ai.companyName || 'Taxi', sx, sy - ai.height / 2 - 4);
            }
        }

        // Update and draw particles
        this._updateParticles(ctx, cam, taxi, dt);

        // Draw player taxi
        this._drawPlayerTaxi(ctx, cam, taxi, weather);

        // Draw GPS route if available
        if (gps && gps.enabled) {
            gps.drawRoute(ctx, cam);
        }

        // Draw destination marker if has passenger
        if (taxi.hasPassenger && taxi.passenger) {
            this._drawDestinationMarker(ctx, cam, taxi.passenger, taxi);
        }

        // Draw app order pickup marker
        if (appOrderMgr && appOrderMgr.acceptedOrder && !appOrderMgr.acceptedOrder.pickedUp) {
            const o = appOrderMgr.acceptedOrder;
            this._drawAppPickupMarker(ctx, cam, o.pickupX, o.pickupY);
        }

        // Draw navigation waypoint
        if (taxi.navTarget) {
            this._drawNavWaypoint(ctx, cam, taxi, taxi.navTarget);
        }

        // Draw event building highlight
        const eventBuilding = eventMgr.getActiveEventBuilding();
        if (eventBuilding) {
            this._drawEventHighlight(ctx, cam, eventBuilding);
        }

        // Resting overlay
        if (taxi.isResting) {
            this._drawRestingOverlay(ctx, taxi);
        }

        // Draw day/night + weather overlay
        this._drawDayNightOverlay(ctx, gameTime, weather);

        // Draw rain particles
        if (weather && weather.current === 'rain' && weather.intensity > 0.1) {
            this._drawRain(ctx, weather);
        }

        // Draw fog overlay
        if (weather && weather.current === 'fog' && weather.intensity > 0.1) {
            this._drawFog(ctx, weather);
        }

        // Draw dashboard (speedometer + fuel gauge)
        this._drawDashboard(ctx, taxi, weather, gameTime);

        // Draw minimap
        this._drawMinimap(city, taxi, aiTaxis, passengerMgr, eventMgr, trafficMgr, hazardMgr);
    }

    _drawTiles(ctx, cam, city, startCol, endCol, startRow, endRow) {
        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                const tile = city.tiles[r][c];
                const sx = c * TILE_SIZE - cam.x;
                const sy = r * TILE_SIZE - cam.y;
                const seed = (r * 137 + c * 251) % 100;

                ctx.fillStyle = this.tileColors[tile] || '#4a9e4a';
                ctx.fillRect(sx, sy, TILE_SIZE + 1, TILE_SIZE + 1);

                // Grass — varied greens, flowers, occasional trees
                if (tile === TILE.GRASS) {
                    // Subtle shade variation
                    if (seed < 30) {
                        ctx.fillStyle = seed < 12 ? '#6aad48' : '#88d468';
                        ctx.fillRect(sx + (seed % 40) + 5, sy + ((seed * 3) % 40) + 5, 6, 4);
                    }
                    // Small flowers
                    if (seed > 88) {
                        const flowerColors = ['#FF69B4', '#FFD700', '#FF6347', '#DDA0DD'];
                        ctx.fillStyle = flowerColors[seed % flowerColors.length];
                        ctx.beginPath();
                        ctx.arc(sx + 20 + (seed % 25), sy + 15 + ((seed * 7) % 30), 2.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    // Occasional tree on grass (lush city look)
                    if (seed > 70 && seed < 82) {
                        this._drawTree(ctx, sx + 32, sy + 40, 16);
                    }
                }

                // Water — subtle shimmer
                if (tile === TILE.WATER) {
                    const waveOffset = (seed * 13 + c * 7) % 40;
                    ctx.fillStyle = 'rgba(255,255,255,0.08)';
                    ctx.fillRect(sx + waveOffset, sy + 15, 18, 2);
                    ctx.fillRect(sx + ((waveOffset + 20) % 50), sy + 40, 14, 2);
                }

                // Sidewalk — subtle brick pattern + occasional tree
                if (tile === TILE.SIDEWALK) {
                    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
                    ctx.lineWidth = 1;
                    for (let lx = 0; lx < TILE_SIZE; lx += 16) {
                        ctx.beginPath();
                        ctx.moveTo(sx + lx, sy);
                        ctx.lineTo(sx + lx, sy + TILE_SIZE);
                        ctx.stroke();
                    }
                    for (let ly = 0; ly < TILE_SIZE; ly += 16) {
                        ctx.beginPath();
                        ctx.moveTo(sx, sy + ly);
                        ctx.lineTo(sx + TILE_SIZE, sy + ly);
                        ctx.stroke();
                    }
                    // Street tree on some sidewalks
                    if (seed > 82 && seed < 90) {
                        this._drawTree(ctx, sx + 32, sy + 38, 12);
                    }
                }

                // Road — subtle asphalt texture
                if (tile === TILE.ROAD_H || tile === TILE.ROAD_V) {
                    if (seed < 25) {
                        ctx.fillStyle = 'rgba(0,0,0,0.05)';
                        ctx.fillRect(sx + (seed % 50), sy + ((seed * 3) % 50), 6, 3);
                    }
                }

                // Intersection — clean asphalt, no markings

                // Parking lot markings
                if (tile === TILE.PARKING) {
                    ctx.strokeStyle = '#ffffff44';
                    ctx.lineWidth = 1;
                    const pseed = (r * 73 + c * 197) % 2;
                    if (pseed === 0) {
                        for (let lx = 8; lx < TILE_SIZE; lx += 20) {
                            ctx.beginPath();
                            ctx.moveTo(sx + lx, sy + 4);
                            ctx.lineTo(sx + lx, sy + TILE_SIZE - 4);
                            ctx.stroke();
                        }
                    } else {
                        for (let ly = 8; ly < TILE_SIZE; ly += 20) {
                            ctx.beginPath();
                            ctx.moveTo(sx + 4, sy + ly);
                            ctx.lineTo(sx + TILE_SIZE - 4, sy + ly);
                            ctx.stroke();
                        }
                    }
                    ctx.font = 'bold 13px sans-serif';
                    ctx.fillStyle = '#ffffff33';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('P', sx + TILE_SIZE / 2, sy + TILE_SIZE / 2);
                }

                // Highway markings — clean dark asphalt with white lane dashes
                if (tile === TILE.HIGHWAY) {
                    const aboveHwy = r > 0 && city.tiles[r - 1][c] === TILE.HIGHWAY;
                    const belowHwy = r < MAP_ROWS - 1 && city.tiles[r + 1][c] === TILE.HIGHWAY;
                    const leftHwy = c > 0 && city.tiles[r][c - 1] === TILE.HIGHWAY;
                    const rightHwy = c < MAP_COLS - 1 && city.tiles[r][c + 1] === TILE.HIGHWAY;

                    // White dashed lane line through center
                    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([10, 16]);
                    if (leftHwy || rightHwy) {
                        ctx.beginPath();
                        ctx.moveTo(sx, sy + TILE_SIZE / 2);
                        ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE / 2);
                        ctx.stroke();
                    }
                    if (aboveHwy || belowHwy) {
                        ctx.beginPath();
                        ctx.moveTo(sx + TILE_SIZE / 2, sy);
                        ctx.lineTo(sx + TILE_SIZE / 2, sy + TILE_SIZE);
                        ctx.stroke();
                    }
                    ctx.setLineDash([]);

                    // Solid white edge lines where highway meets non-highway
                    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                    ctx.lineWidth = 2;
                    if (!aboveHwy) {
                        ctx.beginPath(); ctx.moveTo(sx, sy + 1); ctx.lineTo(sx + TILE_SIZE, sy + 1); ctx.stroke();
                    }
                    if (!belowHwy) {
                        ctx.beginPath(); ctx.moveTo(sx, sy + TILE_SIZE - 1); ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE - 1); ctx.stroke();
                    }
                    if (!leftHwy) {
                        ctx.beginPath(); ctx.moveTo(sx + 1, sy); ctx.lineTo(sx + 1, sy + TILE_SIZE); ctx.stroke();
                    }
                    if (!rightHwy) {
                        ctx.beginPath(); ctx.moveTo(sx + TILE_SIZE - 1, sy); ctx.lineTo(sx + TILE_SIZE - 1, sy + TILE_SIZE); ctx.stroke();
                    }
                }

                // Park — more trees, benches, flower patches
                if (tile === TILE.PARK) {
                    if (seed < 40) {
                        this._drawTree(ctx, sx + 32, sy + 32, 14);
                    }
                    if (seed > 50 && seed < 65) {
                        // Flower patch
                        const fc = ['#FF69B4', '#FFD700', '#FF4500', '#DA70D6'];
                        for (let fi = 0; fi < 4; fi++) {
                            ctx.fillStyle = fc[fi];
                            ctx.beginPath();
                            ctx.arc(sx + 10 + fi * 12, sy + 50, 3, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                    if (seed > 70 && seed < 80) {
                        // Park bench
                        ctx.fillStyle = '#8B6914';
                        ctx.fillRect(sx + 12, sy + 26, 20, 4);
                        ctx.fillRect(sx + 12, sy + 24, 2, 8);
                        ctx.fillRect(sx + 30, sy + 24, 2, 8);
                    }
                }

                // Draw blocked tile overlay (parade, marathon — red/white barriers)
                if (city.blockedTiles && city.blockedTiles.has(`${r},${c}`)) {
                    ctx.fillStyle = 'rgba(200, 30, 30, 0.45)';
                    ctx.fillRect(sx, sy, TILE_SIZE + 1, TILE_SIZE + 1);
                    // Striped barrier lines
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([6, 6]);
                    ctx.beginPath();
                    ctx.moveTo(sx + 4, sy + TILE_SIZE / 2 - 4);
                    ctx.lineTo(sx + TILE_SIZE - 4, sy + TILE_SIZE / 2 - 4);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(sx + 4, sy + TILE_SIZE / 2 + 4);
                    ctx.lineTo(sx + TILE_SIZE - 4, sy + TILE_SIZE / 2 + 4);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    // Barrier icon
                    ctx.font = 'bold 16px sans-serif';
                    ctx.fillStyle = '#fff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('🚧', sx + TILE_SIZE / 2, sy + TILE_SIZE / 2);
                }

                // Draw slow tile overlay (construction, festival — orange cones)
                if (city.slowTiles && city.slowTiles.has(`${r},${c}`)) {
                    ctx.fillStyle = 'rgba(243, 156, 18, 0.35)';
                    ctx.fillRect(sx, sy, TILE_SIZE + 1, TILE_SIZE + 1);
                    // Orange diagonal stripes
                    ctx.strokeStyle = 'rgba(230, 126, 34, 0.6)';
                    ctx.lineWidth = 2;
                    for (let d = -TILE_SIZE; d < TILE_SIZE * 2; d += 12) {
                        ctx.beginPath();
                        ctx.moveTo(sx + d, sy);
                        ctx.lineTo(sx + d + TILE_SIZE, sy + TILE_SIZE);
                        ctx.stroke();
                    }
                    // Cone icon
                    ctx.font = '14px sans-serif';
                    ctx.fillStyle = '#fff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('⚠️', sx + TILE_SIZE / 2, sy + TILE_SIZE / 2);
                }
            }
        }
    }

    _drawRoadMarkings(ctx, cam, city, startCol, endCol, startRow, endRow) {
        const T = TILE_SIZE;
        const hT = T / 2;

        // --- Pass 1: Solid yellow center divider lines (separating opposing lanes) ---
        ctx.strokeStyle = '#d4a017';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);

        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                const tile = city.tiles[r][c];
                if (tile !== TILE.ROAD_H && tile !== TILE.ROAD_V) continue;
                const sx = c * T - cam.x;
                const sy = r * T - cam.y;

                if (tile === TILE.ROAD_H) {
                    // Yellow center line between this row and the paired row
                    // Top lane of a pair: check if row below is also ROAD_H
                    const belowIsH = (r + 1 < MAP_ROWS) && city.tiles[r + 1][c] === TILE.ROAD_H;
                    // Bottom lane of a pair: check if row above is also ROAD_H
                    const aboveIsH = (r - 1 >= 0) && city.tiles[r - 1][c] === TILE.ROAD_H;

                    if (belowIsH && !aboveIsH) {
                        // This is the top lane — draw double yellow at bottom edge
                        ctx.beginPath();
                        ctx.moveTo(sx, sy + T - 1);
                        ctx.lineTo(sx + T, sy + T - 1);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(sx, sy + T + 1);
                        ctx.lineTo(sx + T, sy + T + 1);
                        ctx.stroke();
                    }
                } else if (tile === TILE.ROAD_V) {
                    // Left lane of a pair: check if col to right is also ROAD_V
                    const rightIsV = (c + 1 < MAP_COLS) && city.tiles[r][c + 1] === TILE.ROAD_V;
                    // Right lane of a pair: check if col to left is also ROAD_V
                    const leftIsV = (c - 1 >= 0) && city.tiles[r][c - 1] === TILE.ROAD_V;

                    if (rightIsV && !leftIsV) {
                        // This is the left lane — draw double yellow at right edge
                        ctx.beginPath();
                        ctx.moveTo(sx + T - 1, sy);
                        ctx.lineTo(sx + T - 1, sy + T);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(sx + T + 1, sy);
                        ctx.lineTo(sx + T + 1, sy + T);
                        ctx.stroke();
                    }
                }
            }
        }

        // --- Pass 2: White dashed lane lines (within each lane for guidance) ---
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([12, 18]);

        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                const tile = city.tiles[r][c];
                if (tile !== TILE.ROAD_H && tile !== TILE.ROAD_V) continue;
                const sx = c * T - cam.x;
                const sy = r * T - cam.y;

                if (tile === TILE.ROAD_H) {
                    // Dashed line through center of each lane tile
                    ctx.beginPath();
                    ctx.moveTo(sx, sy + hT);
                    ctx.lineTo(sx + T, sy + hT);
                    ctx.stroke();
                } else if (tile === TILE.ROAD_V) {
                    ctx.beginPath();
                    ctx.moveTo(sx + hT, sy);
                    ctx.lineTo(sx + hT, sy + T);
                    ctx.stroke();
                }
            }
        }
        ctx.setLineDash([]);

        // --- Pass 3: White solid curb/edge lines where road meets non-road ---
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 2;
        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                const tile = city.tiles[r][c];
                if (!isRoadTile(tile) || tile === TILE.ROAD_CROSS) continue;
                const sx = c * T - cam.x;
                const sy = r * T - cam.y;

                if (r > 0 && !isRoadTile(city.tiles[r - 1][c])) {
                    ctx.beginPath(); ctx.moveTo(sx, sy + 1); ctx.lineTo(sx + T, sy + 1); ctx.stroke();
                }
                if (r < MAP_ROWS - 1 && !isRoadTile(city.tiles[r + 1][c])) {
                    ctx.beginPath(); ctx.moveTo(sx, sy + T - 1); ctx.lineTo(sx + T, sy + T - 1); ctx.stroke();
                }
                if (c > 0 && !isRoadTile(city.tiles[r][c - 1])) {
                    ctx.beginPath(); ctx.moveTo(sx + 1, sy); ctx.lineTo(sx + 1, sy + T); ctx.stroke();
                }
                if (c < MAP_COLS - 1 && !isRoadTile(city.tiles[r][c + 1])) {
                    ctx.beginPath(); ctx.moveTo(sx + T - 1, sy); ctx.lineTo(sx + T - 1, sy + T); ctx.stroke();
                }
            }
        }

        // --- Pass 4: Large painted road arrows (like real road markings) ---
        // Convention: Horizontal roads = top row goes RIGHT, bottom row goes LEFT
        //             Vertical roads = left col goes DOWN, right col goes UP
        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                const tile = city.tiles[r][c];
                if (tile !== TILE.ROAD_H && tile !== TILE.ROAD_V) continue;
                // Draw arrow every 4 tiles so they're not too dense
                if ((r * 7 + c * 13) % 4 !== 0) continue;
                // Skip tiles adjacent to intersections
                const hasAdjacentCross = (
                    (r > 0 && city.tiles[r-1][c] === TILE.ROAD_CROSS) ||
                    (r < MAP_ROWS-1 && city.tiles[r+1][c] === TILE.ROAD_CROSS) ||
                    (c > 0 && city.tiles[r][c-1] === TILE.ROAD_CROSS) ||
                    (c < MAP_COLS-1 && city.tiles[r][c+1] === TILE.ROAD_CROSS)
                );
                if (hasAdjacentCross) continue;

                const sx = c * T - cam.x;
                const sy = r * T - cam.y;

                ctx.save();
                ctx.translate(sx + hT, sy + hT);

                // Determine direction (German/right-hand traffic):
                // Horizontal: top row = LEFT, bottom row = RIGHT
                // Vertical: left col = DOWN, right col = UP
                if (tile === TILE.ROAD_H) {
                    const aboveIsH = (r - 1 >= 0) && city.tiles[r - 1][c] === TILE.ROAD_H;
                    if (!aboveIsH) {
                        ctx.rotate(Math.PI); // top lane → LEFT
                    }
                    // else bottom lane → RIGHT (no rotation)
                } else {
                    const leftIsV = (c - 1 >= 0) && city.tiles[r][c - 1] === TILE.ROAD_V;
                    if (!leftIsV) {
                        ctx.rotate(Math.PI / 2); // left col → DOWN
                    } else {
                        ctx.rotate(-Math.PI / 2); // right col → UP
                    }
                }

                // Draw large chevron arrow pointing RIGHT (rotated by ctx)
                // Styled like real white road paint — bold, clear, large
                ctx.fillStyle = 'rgba(255,255,255,0.55)';

                // Arrow shaft (tall narrow rectangle)
                const shaftW = 18;
                const shaftH = 5;
                ctx.fillRect(-shaftW / 2, -shaftH / 2, shaftW * 0.6, shaftH);

                // Arrow head (triangle chevron)
                ctx.beginPath();
                ctx.moveTo(shaftW / 2, 0);             // tip
                ctx.lineTo(shaftW / 2 - 12, -12);      // top-left of head
                ctx.lineTo(shaftW / 2 - 6, 0);         // inner notch
                ctx.lineTo(shaftW / 2 - 12, 12);       // bottom-left of head
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            }
        }

        // Intersections are left clean — no crosswalk markings
    }

    _drawBuildings(ctx, cam, city, startCol, endCol, startRow, endRow) {
        for (const b of city.buildings) {
            if (!cam.isVisible(b.x, b.y, b.width + 8, b.height + 8)) continue;

            const sx = b.x - cam.x;
            const sy = b.y - cam.y;
            const bw = b.width - 4;
            const bh = b.height - 4;

            // Dispatch to type-specific drawing
            switch (b.type) {
                case 'gas_station':   this._drawGasStation(ctx, sx, sy, bw, bh); break;
                case 'home_base':     this._drawHomeBase(ctx, sx, sy, bw, bh); break;
                case 'police':        this._drawPoliceStation(ctx, sx, sy, bw, bh); break;
                case 'mall':          this._drawMall(ctx, sx, sy, bw, bh); break;
                case 'hospital':      this._drawHospital(ctx, sx, sy, bw, bh); break;
                case 'school':        this._drawSchool(ctx, sx, sy, bw, bh); break;
                case 'mechanic':      this._drawMechanic(ctx, sx, sy, bw, bh); break;
                case 'stadium':       this._drawStadium(ctx, sx, sy, bw, bh); break;
                case 'concert_hall':  this._drawConcertHall(ctx, sx, sy, bw, bh); break;
                case 'hotel':         this._drawHotel(ctx, sx, sy, bw, bh); break;
                case 'church':        this._drawChurch(ctx, sx, sy, bw, bh); break;
                case 'bank':          this._drawBank(ctx, sx, sy, bw, bh); break;
                case 'factory':       this._drawFactory(ctx, sx, sy, bw, bh); break;
                case 'restaurant':    this._drawRestaurant(ctx, sx, sy, bw, bh); break;
                case 'gym':           this._drawGym(ctx, sx, sy, bw, bh); break;
                case 'house':         this._drawHouse(ctx, sx, sy, bw, bh); break;
                case 'apartment':     this._drawApartment(ctx, sx, sy, bw, bh); break;
                case 'office':        this._drawOffice(ctx, sx, sy, bw, bh); break;
                case 'park':          this._drawPark(ctx, sx, sy, bw, bh); break;
                default:              this._drawGenericBuilding(ctx, sx, sy, bw, bh, b.type); break;
            }

            // Building label
            if (['gas_station', 'mechanic', 'stadium', 'concert_hall', 'hospital', 'school', 'mall', 'police', 'home_base'].includes(b.type)) {
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                ctx.lineWidth = 2.5;
                const label = b.type.replace(/_/g, ' ').toUpperCase();
                ctx.strokeText(label, sx + bw / 2, sy - 3);
                ctx.fillText(label, sx + bw / 2, sy - 3);
            }
        }
    }

    // ── Shared building base: shadow, walls, gradient shading ──
    _drawBuildingBase(ctx, sx, sy, bw, bh, wallColor) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(sx + 6, sy + 6, bw, bh);
        ctx.fillStyle = wallColor;
        ctx.fillRect(sx + 2, sy + 2, bw, bh);
        const grad = ctx.createLinearGradient(sx + 2, sy, sx + 2 + bw, sy);
        grad.addColorStop(0, 'rgba(255,255,255,0.08)');
        grad.addColorStop(0.5, 'rgba(0,0,0,0.0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx + 2, sy + 2, bw, bh);
        ctx.strokeStyle = this._darkenColor(wallColor, 30);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(sx + 2, sy + 2, bw, bh);
    }

    _drawRoofBlock(ctx, sx, sy, bw, roofH, roofColor) {
        ctx.fillStyle = roofColor;
        ctx.fillRect(sx, sy, bw + 4, roofH);
        const rg = ctx.createLinearGradient(sx, sy, sx, sy + roofH);
        rg.addColorStop(0, 'rgba(255,255,255,0.3)');
        rg.addColorStop(0.5, 'rgba(255,255,255,0.0)');
        rg.addColorStop(1, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = rg;
        ctx.fillRect(sx, sy, bw + 4, roofH);
        ctx.fillStyle = this._darkenColor(roofColor, 30);
        ctx.fillRect(sx, sy + roofH - 2, bw + 4, 2);
    }

    _drawWindowGrid(ctx, sx, sy, bw, bh, startY, winW, winH, gapX, gapY, frameColor) {
        for (let wy = startY; wy + winH < sy + bh - 4; wy += gapY) {
            for (let wx = sx + 8; wx + winW < sx + bw - 4; wx += gapX) {
                ctx.fillStyle = frameColor || '#3a3a3a';
                ctx.fillRect(wx - 1, wy - 1, winW + 2, winH + 2);
                const wg = ctx.createLinearGradient(wx, wy, wx + winW, wy + winH);
                wg.addColorStop(0, 'rgba(140,195,235,0.85)');
                wg.addColorStop(0.6, 'rgba(100,160,210,0.7)');
                wg.addColorStop(1, 'rgba(80,130,180,0.8)');
                ctx.fillStyle = wg;
                ctx.fillRect(wx, wy, winW, winH);
                ctx.strokeStyle = frameColor || '#3a3a3a';
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(wx + winW / 2, wy); ctx.lineTo(wx + winW / 2, wy + winH);
                ctx.moveTo(wx, wy + winH / 2); ctx.lineTo(wx + winW, wy + winH / 2);
                ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.fillRect(wx + 1, wy + 1, winW * 0.3, winH * 0.3);
            }
        }
    }

    _drawDoorDetail(ctx, cx, bottomY, doorW, doorH, color) {
        const dx = cx - doorW / 2;
        const dy = bottomY - doorH;
        ctx.fillStyle = this._darkenColor(color, 40);
        ctx.fillRect(dx - 1, dy - 1, doorW + 2, doorH + 2);
        ctx.fillStyle = color;
        ctx.fillRect(dx, dy, doorW, doorH);
        ctx.strokeStyle = this._darkenColor(color, 20);
        ctx.lineWidth = 0.5;
        ctx.strokeRect(dx + 2, dy + 2, doorW - 4, doorH * 0.45);
        ctx.strokeRect(dx + 2, dy + doorH * 0.52, doorW - 4, doorH * 0.42);
        ctx.fillStyle = '#c8b040';
        ctx.beginPath();
        ctx.arc(dx + doorW * 0.75, dy + doorH * 0.55, 1.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // ═══════════════════════════════════════════════════
    //  GAS STATION — canopy, fuel pumps, shop
    // ═══════════════════════════════════════════════════
    _drawGasStation(ctx, sx, sy, bw, bh) {
        // Concrete pad
        ctx.fillStyle = '#c8c4bc';
        ctx.fillRect(sx, sy + bh * 0.55, bw + 4, bh * 0.5);
        ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.5;
        ctx.strokeRect(sx, sy + bh * 0.55, bw + 4, bh * 0.5);
        // Shop building at back
        const shopW = bw * 0.45, shopH = bh * 0.5;
        const shopX = sx + bw * 0.5, shopY = sy + 2;
        this._drawBuildingBase(ctx, shopX, shopY, shopW, shopH, '#e8e0d0');
        this._drawRoofBlock(ctx, shopX, shopY, shopW, Math.max(6, shopH * 0.25), '#d05040');
        this._drawWindowGrid(ctx, shopX, shopY, shopW, shopH, shopY + shopH * 0.3, 6, 5, 10, 10, '#444');
        this._drawDoorDetail(ctx, shopX + shopW / 2, shopY + shopH + 2, 7, 10, '#6a4a2a');
        // Canopy over pumps
        const canopyX = sx + 4, canopyW = bw * 0.42, canopyY = sy + bh * 0.18;
        ctx.fillStyle = '#888';
        ctx.fillRect(canopyX + 4, canopyY + 6, 3, bh * 0.42);
        ctx.fillRect(canopyX + canopyW - 6, canopyY + 6, 3, bh * 0.42);
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(canopyX, canopyY, canopyW, 8);
        ctx.fillStyle = '#d04030';
        ctx.fillRect(canopyX, canopyY, canopyW, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(canopyX, canopyY + 5, canopyW, 3);
        // Fuel pumps
        const pumpY = sy + bh * 0.5;
        for (let i = 0; i < 2; i++) {
            const px = canopyX + 8 + i * (canopyW * 0.45);
            ctx.fillStyle = '#ddd'; ctx.fillRect(px, pumpY, 8, 14);
            ctx.strokeStyle = '#999'; ctx.lineWidth = 0.8; ctx.strokeRect(px, pumpY, 8, 14);
            ctx.fillStyle = '#1a1a1a'; ctx.fillRect(px + 1.5, pumpY + 2, 5, 4);
            ctx.fillStyle = '#0f0'; ctx.fillRect(px + 2, pumpY + 3, 4, 2);
            ctx.fillStyle = '#333'; ctx.fillRect(px + 6, pumpY + 8, 4, 2);
            ctx.fillRect(px + 9, pumpY + 6, 2, 6);
        }
    }

    // ═══════════════════════════════════════════════════
    //  HOME BASE — taxi HQ with garage door
    // ═══════════════════════════════════════════════════
    _drawHomeBase(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#f5edd5');
        const roofH = Math.max(10, bh * 0.28);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, '#c8a830');
        this._drawWindowGrid(ctx, sx, sy, bw, bh, sy + roofH + 6, 7, 6, 12, 12, '#5a4a30');
        this._drawDoorDetail(ctx, sx + bw / 2 + 1, sy + bh + 2, 9, 13, '#7a5a30');
        // Welcome mat
        ctx.fillStyle = '#8a6a40';
        ctx.fillRect(sx + bw / 2 - 6, sy + bh, 13, 3);
        // Taxi sign
        ctx.fillStyle = '#f5c518';
        ctx.fillRect(sx + bw / 2 - 12, sy + roofH + 2, 25, 8);
        ctx.strokeStyle = '#222'; ctx.lineWidth = 0.6;
        ctx.strokeRect(sx + bw / 2 - 12, sy + roofH + 2, 25, 8);
        ctx.fillStyle = '#222'; ctx.font = 'bold 6px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('TAXI HQ', sx + bw / 2 + 1, sy + roofH + 6);
        // Garage door
        ctx.fillStyle = '#b0a890';
        ctx.fillRect(sx + 6, sy + bh * 0.55, bw * 0.25, bh * 0.4);
        ctx.strokeStyle = '#8a7a60'; ctx.lineWidth = 0.6;
        for (let ly = sy + bh * 0.55; ly < sy + bh * 0.92; ly += 4) {
            ctx.beginPath(); ctx.moveTo(sx + 6, ly); ctx.lineTo(sx + 6 + bw * 0.25, ly); ctx.stroke();
        }
    }

    // ═══════════════════════════════════════════════════
    //  POLICE STATION — badge, lights, barred windows
    // ═══════════════════════════════════════════════════
    _drawPoliceStation(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#d5dde8');
        const roofH = Math.max(10, bh * 0.22);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, '#3858a0');
        this._drawWindowGrid(ctx, sx, sy, bw, bh, sy + roofH + 8, 6, 7, 11, 12, '#2a2a4a');
        // Double doors
        const doorCx = sx + bw / 2 + 1;
        ctx.fillStyle = '#2a2a4a'; ctx.fillRect(doorCx - 7, sy + bh - 12, 14, 14);
        ctx.fillStyle = '#4a5a7a'; ctx.fillRect(doorCx - 6, sy + bh - 11, 5.5, 13);
        ctx.fillRect(doorCx + 0.5, sy + bh - 11, 5.5, 13);
        // Badge emblem
        ctx.fillStyle = '#c8b030';
        ctx.beginPath();
        ctx.moveTo(sx + bw / 2 + 1, sy + roofH + 2);
        ctx.lineTo(sx + bw / 2 + 7, sy + roofH + 5);
        ctx.lineTo(sx + bw / 2 + 5, sy + roofH + 12);
        ctx.lineTo(sx + bw / 2 + 1, sy + roofH + 14);
        ctx.lineTo(sx + bw / 2 - 3, sy + roofH + 12);
        ctx.lineTo(sx + bw / 2 - 5, sy + roofH + 5);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#a89020'; ctx.lineWidth = 0.8; ctx.stroke();
        // Roof lights
        ctx.fillStyle = '#4488ff';
        ctx.beginPath(); ctx.arc(sx + bw * 0.3, sy + 2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff4444';
        ctx.beginPath(); ctx.arc(sx + bw * 0.7, sy + 2, 3, 0, Math.PI * 2); ctx.fill();
    }

    // ═══════════════════════════════════════════════════
    //  MALL — glass storefront, wide entrance
    // ═══════════════════════════════════════════════════
    _drawMall(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#e8dce0');
        const roofH = Math.max(10, bh * 0.18);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, '#c06080');
        // Large storefront windows
        const winStartY = sy + roofH + 6;
        for (let wx = sx + 6; wx + 12 < sx + bw - 2; wx += 15) {
            ctx.fillStyle = '#444'; ctx.fillRect(wx - 1, winStartY - 1, 13, bh * 0.35 + 2);
            const wg = ctx.createLinearGradient(wx, winStartY, wx + 12, winStartY + bh * 0.35);
            wg.addColorStop(0, 'rgba(160,210,240,0.85)');
            wg.addColorStop(1, 'rgba(120,170,210,0.75)');
            ctx.fillStyle = wg; ctx.fillRect(wx, winStartY, 12, bh * 0.35);
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(wx + 1, winStartY + 1, 4, bh * 0.12);
        }
        // Wide glass entrance
        const ey = sy + bh - 14;
        ctx.fillStyle = '#555'; ctx.fillRect(sx + bw / 2 - 10, ey - 1, 22, 16);
        ctx.fillStyle = 'rgba(160,210,240,0.7)';
        ctx.fillRect(sx + bw / 2 - 9, ey, 9, 15);
        ctx.fillRect(sx + bw / 2 + 1, ey, 9, 15);
        // Sign
        ctx.fillStyle = '#ff6090'; ctx.fillRect(sx + bw / 2 - 16, sy + roofH + 1, 34, 8);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 6px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('SHOPPING MALL', sx + bw / 2 + 1, sy + roofH + 5);
    }

    // ═══════════════════════════════════════════════════
    //  HOSPITAL — red cross, ER entrance
    // ═══════════════════════════════════════════════════
    _drawHospital(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#f0e4e4');
        const roofH = Math.max(10, bh * 0.2);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, '#d05050');
        this._drawWindowGrid(ctx, sx, sy, bw, bh, sy + roofH + 10, 6, 6, 11, 11, '#5a3a3a');
        this._drawDoorDetail(ctx, sx + bw / 2 + 1, sy + bh + 2, 10, 13, '#804040');
        // Red cross
        const cx = sx + bw / 2 + 1, cy = sy + roofH + 4;
        ctx.fillStyle = '#fff'; ctx.fillRect(cx - 7, cy - 1, 14, 10);
        ctx.fillStyle = '#e03030';
        ctx.fillRect(cx - 2, cy, 4, 8); ctx.fillRect(cx - 5, cy + 2, 10, 4);
        // ER sign
        ctx.fillStyle = '#e03030'; ctx.fillRect(sx + 4, sy + bh - 6, bw * 0.3, 6);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 4px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('ER', sx + 4 + bw * 0.15, sy + bh - 3);
    }

    // ═══════════════════════════════════════════════════
    //  SCHOOL — flag pole, name plate
    // ═══════════════════════════════════════════════════
    _drawSchool(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#dae2ee');
        const roofH = Math.max(10, bh * 0.22);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, '#4a70a8');
        this._drawWindowGrid(ctx, sx, sy, bw, bh, sy + roofH + 8, 6, 5, 10, 10, '#3a4a6a');
        this._drawDoorDetail(ctx, sx + bw / 2 + 1, sy + bh + 2, 9, 12, '#5a4030');
        // Flag pole
        ctx.fillStyle = '#888'; ctx.fillRect(sx + bw * 0.8, sy - 12, 2, 14);
        ctx.fillStyle = '#e04040'; ctx.fillRect(sx + bw * 0.8 + 2, sy - 12, 8, 5);
        // Name plate
        ctx.fillStyle = '#4a70a8'; ctx.fillRect(sx + bw / 2 - 14, sy + roofH + 1, 30, 7);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 5px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('SCHOOL', sx + bw / 2 + 1, sy + roofH + 5);
    }

    // ═══════════════════════════════════════════════════
    //  MECHANIC — garage bays, toolbox, lift
    // ═══════════════════════════════════════════════════
    _drawMechanic(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#e0d8c8');
        const roofH = Math.max(8, bh * 0.18);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, '#d89040');
        // Garage bays
        const bays = Math.max(1, Math.floor(bw / 30));
        const bayW = (bw - 10) / bays;
        for (let i = 0; i < bays; i++) {
            const bx = sx + 6 + i * bayW;
            const by = sy + roofH + 6;
            const bayH = bh * 0.6;
            ctx.fillStyle = '#555'; ctx.fillRect(bx, by, bayW - 4, bayH);
            // Horizontal slats
            ctx.strokeStyle = '#777'; ctx.lineWidth = 0.5;
            for (let ly = by + 3; ly < by + bayH; ly += 3) {
                ctx.beginPath(); ctx.moveTo(bx, ly); ctx.lineTo(bx + bayW - 4, ly); ctx.stroke();
            }
            // Opening highlight
            ctx.fillStyle = 'rgba(255,180,60,0.15)'; ctx.fillRect(bx + 2, by + 2, bayW - 8, bayH - 4);
        }
        // Sign
        ctx.fillStyle = '#d89040'; ctx.fillRect(sx + bw / 2 - 16, sy + roofH + 1, 34, 7);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 5px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('AUTO REPAIR', sx + bw / 2 + 1, sy + roofH + 5);
        // Wrench icon drawn
        ctx.strokeStyle = '#666'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx + bw - 14, sy + bh - 12);
        ctx.lineTo(sx + bw - 8, sy + bh - 6);
        ctx.stroke();
    }

    // ═══════════════════════════════════════════════════
    //  STADIUM — tiered seating, arch roof, field
    // ═══════════════════════════════════════════════════
    _drawStadium(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#c8d8c8');
        // Tiered wall effect
        const tiers = 3;
        for (let t = 0; t < tiers; t++) {
            const inset = t * 3;
            const tierH = bh / tiers;
            ctx.fillStyle = `rgba(0,0,0,${0.03 + t * 0.03})`;
            ctx.fillRect(sx + 2 + inset, sy + 2 + t * tierH, bw - inset * 2, tierH);
        }
        // Arched roof
        ctx.fillStyle = '#508850';
        ctx.beginPath();
        ctx.ellipse(sx + bw / 2 + 1, sy + 4, bw / 2 + 2, bh * 0.15, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.ellipse(sx + bw / 2 + 1, sy + 4, bw / 2 + 2, bh * 0.1, 0, Math.PI, 0);
        ctx.fill();
        // Green field in center
        ctx.fillStyle = '#4a9a40';
        ctx.fillRect(sx + bw * 0.2, sy + bh * 0.35, bw * 0.6, bh * 0.35);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5;
        ctx.strokeRect(sx + bw * 0.22, sy + bh * 0.37, bw * 0.56, bh * 0.31);
        // Center line
        ctx.beginPath();
        ctx.moveTo(sx + bw / 2 + 1, sy + bh * 0.37);
        ctx.lineTo(sx + bw / 2 + 1, sy + bh * 0.68);
        ctx.stroke();
        // Seating dots
        ctx.fillStyle = 'rgba(80,80,80,0.3)';
        for (let r = 0; r < 2; r++) {
            for (let c = sx + 8; c < sx + bw - 6; c += 5) {
                ctx.fillRect(c, sy + bh * 0.75 + r * 6, 3, 3);
            }
        }
        // Floodlights
        ctx.fillStyle = '#aaa';
        ctx.fillRect(sx + 4, sy - 6, 2, 10);
        ctx.fillRect(sx + bw - 4, sy - 6, 2, 10);
        ctx.fillStyle = '#ffe860';
        ctx.beginPath(); ctx.arc(sx + 5, sy - 7, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + bw - 3, sy - 7, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // ═══════════════════════════════════════════════════
    //  CONCERT HALL — marquee, arched entrance
    // ═══════════════════════════════════════════════════
    _drawConcertHall(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#e0d0e8');
        const roofH = Math.max(10, bh * 0.25);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, '#9068a8');
        this._drawWindowGrid(ctx, sx, sy, bw, bh, sy + roofH + 10, 5, 8, 10, 14, '#4a3060');
        // Arched entrance
        const archCx = sx + bw / 2 + 1;
        ctx.fillStyle = '#4a3060';
        ctx.beginPath();
        ctx.arc(archCx, sy + bh - 6, 8, Math.PI, 0);
        ctx.lineTo(archCx + 8, sy + bh + 2);
        ctx.lineTo(archCx - 8, sy + bh + 2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a1a40';
        ctx.fillRect(archCx - 6, sy + bh - 4, 12, 6);
        // Marquee sign with lights
        ctx.fillStyle = '#1a0a30';
        ctx.fillRect(sx + bw / 2 - 18, sy + roofH + 1, 38, 9);
        ctx.strokeStyle = '#c8a0e0'; ctx.lineWidth = 0.8;
        ctx.strokeRect(sx + bw / 2 - 18, sy + roofH + 1, 38, 9);
        // Marquee bulbs
        for (let lx = sx + bw / 2 - 16; lx < sx + bw / 2 + 18; lx += 4) {
            ctx.fillStyle = lx % 8 < 4 ? '#ffe040' : '#ff6060';
            ctx.beginPath(); ctx.arc(lx, sy + roofH + 2, 1.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(lx, sy + roofH + 9, 1.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#fff'; ctx.font = 'bold 5px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CONCERT HALL', sx + bw / 2 + 1, sy + roofH + 6);
    }

    // ═══════════════════════════════════════════════════
    //  HOTEL — multi-story, awning, lit windows
    // ═══════════════════════════════════════════════════
    _drawHotel(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#d8e8e8');
        const roofH = Math.max(8, bh * 0.15);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, '#40a0b0');
        // Multi-story windows
        this._drawWindowGrid(ctx, sx, sy, bw, bh, sy + roofH + 6, 5, 5, 9, 9, '#2a5a6a');
        // Entrance awning
        const awnX = sx + bw / 2 - 12, awnY = sy + bh - 18;
        ctx.fillStyle = '#40a0b0';
        ctx.beginPath();
        ctx.moveTo(awnX, awnY); ctx.lineTo(awnX + 24, awnY);
        ctx.lineTo(awnX + 26, awnY + 4); ctx.lineTo(awnX - 2, awnY + 4);
        ctx.closePath(); ctx.fill();
        // Glass door
        ctx.fillStyle = '#2a4a5a'; ctx.fillRect(sx + bw / 2 - 6, sy + bh - 14, 14, 16);
        ctx.fillStyle = 'rgba(140,200,230,0.6)'; ctx.fillRect(sx + bw / 2 - 5, sy + bh - 13, 5.5, 15);
        ctx.fillRect(sx + bw / 2 + 1.5, sy + bh - 13, 5.5, 15);
        // Hotel sign
        ctx.fillStyle = '#2a6a7a'; ctx.fillRect(sx + bw / 2 - 12, sy + roofH + 1, 26, 7);
        ctx.fillStyle = '#ffe860'; ctx.font = 'bold 5px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('HOTEL', sx + bw / 2 + 1, sy + roofH + 5);
        // Star rating
        ctx.fillStyle = '#ffe040'; ctx.font = '4px sans-serif';
        ctx.fillText('★★★', sx + bw / 2 + 1, sy + roofH + 11);
    }

    // ═══════════════════════════════════════════════════
    //  CHURCH — steeple, cross, stained glass
    // ═══════════════════════════════════════════════════
    _drawChurch(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#e8e4de');
        const roofH = Math.max(10, bh * 0.25);
        // Peaked roof
        ctx.fillStyle = '#8a8078';
        ctx.beginPath();
        ctx.moveTo(sx, sy + roofH + 2);
        ctx.lineTo(sx + bw / 2 + 2, sy - 2);
        ctx.lineTo(sx + bw + 4, sy + roofH + 2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.moveTo(sx, sy + roofH + 2);
        ctx.lineTo(sx + bw / 2 + 2, sy - 2);
        ctx.lineTo(sx + bw / 2 + 2, sy + roofH + 2);
        ctx.closePath(); ctx.fill();
        // Steeple
        ctx.fillStyle = '#a09890';
        ctx.fillRect(sx + bw / 2 - 3, sy - 14, 8, 16);
        ctx.fillStyle = '#8a8078';
        ctx.beginPath();
        ctx.moveTo(sx + bw / 2 - 4, sy - 14);
        ctx.lineTo(sx + bw / 2 + 1, sy - 22);
        ctx.lineTo(sx + bw / 2 + 6, sy - 14);
        ctx.closePath(); ctx.fill();
        // Cross on top
        ctx.fillStyle = '#c8b840';
        ctx.fillRect(sx + bw / 2, sy - 28, 2, 8);
        ctx.fillRect(sx + bw / 2 - 2, sy - 26, 6, 2);
        // Arched door
        const archCx = sx + bw / 2 + 1;
        ctx.fillStyle = '#5a4a38';
        ctx.beginPath();
        ctx.arc(archCx, sy + bh - 8, 6, Math.PI, 0);
        ctx.lineTo(archCx + 6, sy + bh + 2);
        ctx.lineTo(archCx - 6, sy + bh + 2);
        ctx.closePath(); ctx.fill();
        // Stained glass window (round)
        ctx.fillStyle = '#6050a0';
        ctx.beginPath(); ctx.arc(archCx, sy + roofH + 10, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e0a040';
        ctx.beginPath(); ctx.arc(archCx, sy + roofH + 10, 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#4a3a70'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(archCx - 5, sy + roofH + 10); ctx.lineTo(archCx + 5, sy + roofH + 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(archCx, sy + roofH + 5); ctx.lineTo(archCx, sy + roofH + 15); ctx.stroke();
    }

    // ═══════════════════════════════════════════════════
    //  BANK — columns, vault door, gold trim
    // ═══════════════════════════════════════════════════
    _drawBank(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#e8e2cc');
        const roofH = Math.max(10, bh * 0.22);
        // Classical pediment roof
        ctx.fillStyle = '#c8a830';
        ctx.fillRect(sx, sy, bw + 4, roofH * 0.6);
        ctx.beginPath();
        ctx.moveTo(sx - 2, sy + roofH * 0.6);
        ctx.lineTo(sx + bw / 2 + 2, sy - 4);
        ctx.lineTo(sx + bw + 6, sy + roofH * 0.6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(sx - 2, sy + roofH * 0.6);
        ctx.lineTo(sx + bw / 2 + 2, sy - 4);
        ctx.lineTo(sx + bw / 2 + 2, sy + roofH * 0.6);
        ctx.closePath(); ctx.fill();
        // Columns
        const cols = Math.max(2, Math.floor(bw / 18));
        const colGap = bw / (cols + 1);
        for (let i = 1; i <= cols; i++) {
            const cx = sx + i * colGap;
            ctx.fillStyle = '#e8e0d0';
            ctx.fillRect(cx - 2, sy + roofH * 0.6, 5, bh - roofH * 0.6);
            // Column highlight
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(cx - 1, sy + roofH * 0.6, 2, bh - roofH * 0.6);
            // Capital
            ctx.fillStyle = '#c8a830';
            ctx.fillRect(cx - 3, sy + roofH * 0.6, 7, 3);
            // Base
            ctx.fillRect(cx - 3, sy + bh - 2, 7, 3);
        }
        // Vault door
        ctx.fillStyle = '#666'; ctx.fillRect(sx + bw / 2 - 5, sy + bh - 14, 12, 16);
        ctx.fillStyle = '#888'; ctx.fillRect(sx + bw / 2 - 4, sy + bh - 13, 10, 15);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sx + bw / 2 + 1, sy + bh - 6, 3, 0, Math.PI * 2); ctx.stroke();
        // BANK sign
        ctx.fillStyle = '#2a2a1a'; ctx.fillRect(sx + bw / 2 - 10, sy + roofH, 22, 7);
        ctx.fillStyle = '#d0a830'; ctx.font = 'bold 5px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('BANK', sx + bw / 2 + 1, sy + roofH + 4);
    }

    // ═══════════════════════════════════════════════════
    //  FACTORY — smokestacks, corrugated walls
    // ═══════════════════════════════════════════════════
    _drawFactory(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#c8c0b8');
        const roofH = Math.max(8, bh * 0.15);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, '#908078');
        // Corrugated wall texture
        ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 0.5;
        for (let lx = sx + 6; lx < sx + bw; lx += 4) {
            ctx.beginPath(); ctx.moveTo(lx, sy + roofH); ctx.lineTo(lx, sy + bh); ctx.stroke();
        }
        // Loading dock door
        ctx.fillStyle = '#7a7060';
        ctx.fillRect(sx + 6, sy + bh * 0.5, bw * 0.35, bh * 0.48);
        ctx.strokeStyle = '#5a5040'; ctx.lineWidth = 0.5;
        for (let ly = sy + bh * 0.5; ly < sy + bh * 0.96; ly += 4) {
            ctx.beginPath(); ctx.moveTo(sx + 6, ly); ctx.lineTo(sx + 6 + bw * 0.35, ly); ctx.stroke();
        }
        // Small windows high up
        this._drawWindowGrid(ctx, sx + bw * 0.4, sy, bw * 0.6, bh * 0.5, sy + roofH + 4, 8, 5, 14, 10, '#5a5048');
        // Smokestacks
        const stacks = Math.min(2, Math.max(1, Math.floor(bw / 40)));
        for (let i = 0; i < stacks; i++) {
            const scx = sx + bw * 0.7 + i * 14;
            ctx.fillStyle = '#888'; ctx.fillRect(scx, sy - 16, 6, 18);
            ctx.fillStyle = '#777'; ctx.fillRect(scx - 1, sy - 16, 8, 3);
            // Smoke puffs
            ctx.fillStyle = 'rgba(180,180,180,0.3)';
            ctx.beginPath(); ctx.arc(scx + 3, sy - 20, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(scx + 6, sy - 24, 3, 0, Math.PI * 2); ctx.fill();
        }
    }

    // ═══════════════════════════════════════════════════
    //  RESTAURANT — awning, table, menu board
    // ═══════════════════════════════════════════════════
    _drawRestaurant(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#f0e0c8');
        const roofH = Math.max(8, bh * 0.2);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, '#d88040');
        this._drawWindowGrid(ctx, sx, sy, bw, bh, sy + roofH + 8, 7, 6, 12, 12, '#6a4a2a');
        this._drawDoorDetail(ctx, sx + bw / 2 + 1, sy + bh + 2, 8, 12, '#6a4020');
        // Striped awning over door
        const awnY = sy + bh - 16;
        for (let stripe = 0; stripe < 6; stripe++) {
            ctx.fillStyle = stripe % 2 === 0 ? '#d04030' : '#fff';
            ctx.fillRect(sx + bw / 2 - 14 + stripe * 5, awnY, 5, 5);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(sx + bw / 2 - 14, awnY + 3, 30, 2);
        // Restaurant sign
        ctx.fillStyle = '#6a2010'; ctx.fillRect(sx + bw / 2 - 14, sy + roofH + 1, 30, 8);
        ctx.fillStyle = '#ffe860'; ctx.font = 'bold 5px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('RESTAURANT', sx + bw / 2 + 1, sy + roofH + 5);
    }

    // ═══════════════════════════════════════════════════
    //  GYM — bold sign, muscle motif
    // ═══════════════════════════════════════════════════
    _drawGym(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#e8d8d8');
        const roofH = Math.max(8, bh * 0.2);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, '#c06080');
        // Big front window
        ctx.fillStyle = '#333'; ctx.fillRect(sx + 6, sy + roofH + 8, bw - 12, bh * 0.35);
        const wg = ctx.createLinearGradient(sx + 7, sy + roofH + 9, sx + bw - 7, sy + roofH + 9 + bh * 0.33);
        wg.addColorStop(0, 'rgba(140,200,240,0.7)');
        wg.addColorStop(1, 'rgba(100,160,200,0.6)');
        ctx.fillStyle = wg; ctx.fillRect(sx + 7, sy + roofH + 9, bw - 14, bh * 0.33);
        this._drawDoorDetail(ctx, sx + bw / 2 + 1, sy + bh + 2, 9, 12, '#6a3050');
        // GYM sign
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(sx + bw / 2 - 12, sy + roofH + 1, 26, 8);
        ctx.fillStyle = '#ff4060'; ctx.font = 'bold 6px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('GYM', sx + bw / 2 + 1, sy + roofH + 5);
        // Dumbbell icon
        ctx.fillStyle = '#888';
        const dbY = sy + bh - 10;
        ctx.fillRect(sx + bw - 18, dbY, 3, 6); ctx.fillRect(sx + bw - 10, dbY, 3, 6);
        ctx.fillRect(sx + bw - 15, dbY + 2, 8, 2);
    }

    // ═══════════════════════════════════════════════════
    //  HOUSE — residential, chimney, garden feel
    // ═══════════════════════════════════════════════════
    _drawHouse(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#e8d8c0');
        const roofH = Math.max(10, bh * 0.3);
        // Peaked roof
        ctx.fillStyle = '#c0594a';
        ctx.beginPath();
        ctx.moveTo(sx, sy + roofH);
        ctx.lineTo(sx + bw / 2 + 2, sy - 2);
        ctx.lineTo(sx + bw + 4, sy + roofH);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.moveTo(sx, sy + roofH);
        ctx.lineTo(sx + bw / 2 + 2, sy - 2);
        ctx.lineTo(sx + bw / 2 + 2, sy + roofH);
        ctx.closePath(); ctx.fill();
        // Chimney
        ctx.fillStyle = '#9a5a4a';
        ctx.fillRect(sx + bw * 0.7, sy - 6, 6, 10);
        ctx.fillStyle = '#8a4a3a'; ctx.fillRect(sx + bw * 0.7 - 1, sy - 6, 8, 2);
        // Windows
        this._drawWindowGrid(ctx, sx, sy, bw, bh, sy + roofH + 4, 7, 6, 13, 12, '#5a4a30');
        // Front door
        this._drawDoorDetail(ctx, sx + bw / 2 + 1, sy + bh + 2, 8, 12, '#7a5530');
        // Door step
        ctx.fillStyle = '#aaa'; ctx.fillRect(sx + bw / 2 - 5, sy + bh + 1, 12, 2);
    }

    // ═══════════════════════════════════════════════════
    //  APARTMENT — tall, many windows, balconies
    // ═══════════════════════════════════════════════════
    _drawApartment(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#d0c8c0');
        const roofH = Math.max(8, bh * 0.12);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, '#7090b8');
        // Dense window grid
        this._drawWindowGrid(ctx, sx, sy, bw, bh, sy + roofH + 5, 5, 5, 9, 9, '#3a4a5a');
        // Balcony lines every other row
        ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 0.7;
        for (let by = sy + roofH + 14; by < sy + bh - 8; by += 18) {
            ctx.beginPath(); ctx.moveTo(sx + 4, by); ctx.lineTo(sx + bw - 2, by); ctx.stroke();
            ctx.fillStyle = 'rgba(0,0,0,0.04)'; ctx.fillRect(sx + 4, by, bw - 6, 3);
        }
        // Entrance
        ctx.fillStyle = '#4a5a6a'; ctx.fillRect(sx + bw / 2 - 5, sy + bh - 12, 12, 14);
        ctx.fillStyle = 'rgba(140,190,230,0.5)'; ctx.fillRect(sx + bw / 2 - 4, sy + bh - 11, 10, 13);
        // Building number
        ctx.fillStyle = '#fff'; ctx.font = 'bold 6px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(Math.floor(sx * 0.1) % 200 + '', sx + bw / 2 + 1, sy + roofH + 2);
    }

    // ═══════════════════════════════════════════════════
    //  OFFICE — glass curtain wall, modern
    // ═══════════════════════════════════════════════════
    _drawOffice(ctx, sx, sy, bw, bh) {
        this._drawBuildingBase(ctx, sx, sy, bw, bh, '#d8dce0');
        const roofH = Math.max(6, bh * 0.1);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, '#8898a8');
        // Glass curtain wall
        const glassY = sy + roofH + 2;
        const glassH = bh - roofH - 16;
        ctx.fillStyle = '#3a4a5a'; ctx.fillRect(sx + 4, glassY, bw - 6, glassH);
        // Window panes in grid
        const paneW = 6, paneH = 6, paneGapX = 8, paneGapY = 8;
        for (let py = glassY + 2; py + paneH < glassY + glassH - 2; py += paneGapY) {
            for (let px = sx + 6; px + paneW < sx + bw - 4; px += paneGapX) {
                const pg = ctx.createLinearGradient(px, py, px + paneW, py + paneH);
                pg.addColorStop(0, 'rgba(160,210,240,0.8)');
                pg.addColorStop(1, 'rgba(120,170,210,0.6)');
                ctx.fillStyle = pg; ctx.fillRect(px, py, paneW, paneH);
                ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(px, py, paneW * 0.3, paneH * 0.3);
            }
        }
        // Revolving door
        ctx.fillStyle = '#555'; ctx.fillRect(sx + bw / 2 - 6, sy + bh - 12, 14, 14);
        ctx.fillStyle = 'rgba(140,200,240,0.5)';
        ctx.beginPath(); ctx.arc(sx + bw / 2 + 1, sy + bh - 5, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#444'; ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(sx + bw / 2 + 1, sy + bh - 10);
        ctx.lineTo(sx + bw / 2 + 1, sy + bh);
        ctx.moveTo(sx + bw / 2 - 4, sy + bh - 5);
        ctx.lineTo(sx + bw / 2 + 6, sy + bh - 5);
        ctx.stroke();
    }

    // ═══════════════════════════════════════════════════
    //  PARK — green area, bench, path
    // ═══════════════════════════════════════════════════
    _drawPark(ctx, sx, sy, bw, bh) {
        // Green base instead of building
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(sx + 5, sy + 5, bw, bh);
        ctx.fillStyle = '#6ab050'; ctx.fillRect(sx + 2, sy + 2, bw, bh);
        const grad = ctx.createLinearGradient(sx, sy, sx + bw, sy + bh);
        grad.addColorStop(0, 'rgba(255,255,255,0.1)');
        grad.addColorStop(1, 'rgba(0,0,0,0.1)');
        ctx.fillStyle = grad; ctx.fillRect(sx + 2, sy + 2, bw, bh);
        ctx.strokeStyle = '#4a8a30'; ctx.lineWidth = 1; ctx.strokeRect(sx + 2, sy + 2, bw, bh);
        // Winding path
        ctx.strokeStyle = '#c8b898'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx + bw / 2, sy + bh + 2);
        ctx.quadraticCurveTo(sx + bw * 0.3, sy + bh * 0.5, sx + bw * 0.6, sy + bh * 0.2);
        ctx.stroke();
        // Mini trees
        const treePositions = [[0.2, 0.3], [0.7, 0.25], [0.5, 0.65], [0.15, 0.7], [0.8, 0.6]];
        for (const [tx, ty] of treePositions) {
            const ttx = sx + bw * tx, tty = sy + bh * ty;
            ctx.fillStyle = '#4a7a2a'; ctx.beginPath(); ctx.arc(ttx, tty, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#5a9a3a'; ctx.beginPath(); ctx.arc(ttx - 1, tty - 1, 3, 0, Math.PI * 2); ctx.fill();
        }
        // Bench
        ctx.fillStyle = '#8a6a40'; ctx.fillRect(sx + bw * 0.4, sy + bh * 0.8, 12, 3);
        ctx.fillRect(sx + bw * 0.4, sy + bh * 0.8 + 3, 2, 3);
        ctx.fillRect(sx + bw * 0.4 + 10, sy + bh * 0.8 + 3, 2, 3);
        // Fence
        ctx.strokeStyle = '#8a8a6a'; ctx.lineWidth = 0.5;
        ctx.strokeRect(sx + 2, sy + 2, bw, bh);
    }

    // ═══════════════════════════════════════════════════
    //  GENERIC fallback
    // ═══════════════════════════════════════════════════
    _drawGenericBuilding(ctx, sx, sy, bw, bh, type) {
        const wallColor = BUILDING_COLORS[type] || '#d0c8c0';
        const roofColor = BUILDING_ROOF_COLORS[type] || '#8a7a6a';
        this._drawBuildingBase(ctx, sx, sy, bw, bh, wallColor);
        const roofH = Math.max(8, bh * 0.22);
        this._drawRoofBlock(ctx, sx, sy, bw, roofH, roofColor);
        this._drawWindowGrid(ctx, sx, sy, bw, bh, sy + roofH + 8, 6, 5, 11, 11, '#3a3a3a');
        this._drawDoorDetail(ctx, sx + bw / 2 + 1, sy + bh + 2, 8, 11, '#6a5a40');
        const icon = BUILDING_ICONS[type];
        if (icon) {
            const iconSize = Math.min(bw, bh) * 0.25;
            ctx.font = `${iconSize}px serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(icon, sx + bw / 2 + 2, sy + roofH + 6);
        }
    }

    _drawTree(ctx, x, y, size) {
        // Shadow on ground
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.ellipse(x, y + size * 0.35, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Trunk
        ctx.fillStyle = '#6D5037';
        ctx.fillRect(x - 2, y - 2, 4, size * 0.45);
        // Main canopy (large lush circle)
        ctx.fillStyle = '#3a9e3a';
        ctx.beginPath();
        ctx.arc(x, y - size * 0.25, size * 0.55, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = '#5cb85c';
        ctx.beginPath();
        ctx.arc(x - 2, y - size * 0.35, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
        // Top bright spot
        ctx.fillStyle = '#72d572';
        ctx.beginPath();
        ctx.arc(x - 1, y - size * 0.42, size * 0.18, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawCar(ctx, cam, x, y, angle, w, h, color, isPlayer, weather) {
        const sx = x - cam.x;
        const sy = y - cam.y;
        const isNight = weather && weather.isNight();

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w, h);

        // Car body
        ctx.fillStyle = color;
        ctx.fillRect(-w / 2, -h / 2, w, h);

        // Car roof (lighter center)
        ctx.fillStyle = '#ffffff22';
        ctx.fillRect(-w / 4, -h / 3, w / 2, h * 0.66);

        // Windshield
        ctx.fillStyle = '#87CEEB88';
        ctx.fillRect(w / 4, -h / 3, w / 6, h * 0.66);

        // Rear window
        ctx.fillStyle = '#87CEEB55';
        ctx.fillRect(-w / 2 + 2, -h / 4, w / 8, h / 2);

        // Headlights (brighter at night)
        ctx.fillStyle = isNight ? '#FFFFCC' : '#FFFF88';
        ctx.fillRect(w / 2 - 3, -h / 2 + 2, 4, 4);
        ctx.fillRect(w / 2 - 3, h / 2 - 6, 4, 4);

        // Headlight beam at night
        if (isNight) {
            ctx.fillStyle = 'rgba(255,255,200,0.08)';
            ctx.beginPath();
            ctx.moveTo(w / 2, -h / 2);
            ctx.lineTo(w / 2 + 60, -h - 20);
            ctx.lineTo(w / 2 + 60, h + 20);
            ctx.lineTo(w / 2, h / 2);
            ctx.closePath();
            ctx.fill();
        }

        // Taillights
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(-w / 2 - 1, -h / 2 + 2, 3, 3);
        ctx.fillRect(-w / 2 - 1, h / 2 - 5, 3, 3);

        if (isPlayer) {
            // Taxi sign on top
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(-6, -4, 12, 8);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 6px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('TAXI', 0, 0);
        }

        // Outline
        ctx.strokeStyle = '#00000066';
        ctx.lineWidth = 1;
        ctx.strokeRect(-w / 2, -h / 2, w, h);

        ctx.restore();
    }

    _drawPlayerTaxi(ctx, cam, taxi, weather) {
        // Flash effect — use car's own color
        const baseColor = taxi.carColor || '#f5c518';
        let color = baseColor;
        if (taxi.flashTimer > 0 && taxi.flashColor) {
            color = Math.sin(taxi.flashTimer * 20) > 0 ? taxi.flashColor : baseColor;
        }

        // Low fuel warning pulse
        if (taxi.fuel < 20 && Math.sin(Date.now() / 200) > 0) {
            const sp = cam.worldToScreen(taxi.x, taxi.y);
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 30, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Low health warning
        if (taxi.health < 25 && Math.sin(Date.now() / 300) > 0) {
            const sp = cam.worldToScreen(taxi.x, taxi.y);
            ctx.strokeStyle = '#ff9800';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 35, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Tire blowout indicator
        if (taxi.tireBlown && Math.sin(Date.now() / 150) > 0) {
            const sp = cam.worldToScreen(taxi.x, taxi.y);
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 25, 0, Math.PI * 2);
            ctx.stroke();
        }

        this._drawCar(ctx, cam, taxi.x, taxi.y, taxi.angle, taxi.width, taxi.height, color, true, weather);

        // Draw damage overlay on player taxi
        if (taxi.damageVisual > 0) {
            this._drawDamageOverlay(ctx, cam, taxi);
        }
    }

    _drawPassengers(ctx, cam, passengerMgr) {
        for (const p of passengerMgr.passengers) {
            if (!p.active || p.pickedUp) continue;
            if (!cam.isVisible(p.x - 20, p.y - 30, 40, 40)) continue;

            const sx = p.x - cam.x;
            const sy = p.y - cam.y;
            const bob = Math.sin(p.bobTimer) * 3;

            // VIP glow
            if (p.isVIP) {
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.arc(sx, sy - 4 + bob, 16, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                // VIP label
                ctx.font = 'bold 8px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#FFD700';
                ctx.fillText('VIP', sx, sy - 26 + bob);
            }

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(sx, sy + 8, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Body
            ctx.fillStyle = p.isVIP ? '#FFD700' : p.color;
            ctx.fillRect(sx - 5, sy - 10 + bob, 10, 14);

            // Head
            ctx.fillStyle = '#FFDEAD';
            ctx.beginPath();
            ctx.arc(sx, sy - 14 + bob, 6, 0, Math.PI * 2);
            ctx.fill();

            // Luggage icon
            if (p.hasLuggage) {
                ctx.font = '10px serif';
                ctx.textAlign = 'center';
                ctx.fillText('🧳', sx + 10, sy + 2 + bob);
            }

            // Wave animation
            if (p.waitTimer > 10) {
                const wave = Math.sin(p.bobTimer * 2) * 5;
                ctx.strokeStyle = '#FFDEAD';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(sx + 5, sy - 6 + bob);
                ctx.lineTo(sx + 10 + wave, sy - 16 + bob);
                ctx.stroke();
            }

            // Wait indicator (pie chart showing remaining time)
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const pct = p.waitTimer / 45;
            ctx.arc(sx, sy - 24 + bob, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
            ctx.stroke();
        }
    }

    _drawDestinationMarker(ctx, cam, passenger, taxi) {
        const sx = passenger.destX - cam.x;
        const sy = passenger.destY - cam.y;

        // Pulsing marker
        const pulse = Math.sin(Date.now() / 300) * 5 + 20;

        // Outer ring
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, pulse, 0, Math.PI * 2);
        ctx.stroke();

        // Inner ring
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, pulse * 0.5, 0, Math.PI * 2);
        ctx.stroke();

        // Flag icon
        ctx.font = '20px serif';
        ctx.textAlign = 'center';
        ctx.fillText('📍', sx, sy - pulse - 5);

        // Destination label
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        const label = passenger.getDestinationName();
        ctx.strokeText(label, sx, sy - pulse - 22);
        ctx.fillText(label, sx, sy - pulse - 22);

        // Distance indicator (use taxi position, not passenger spawn point)
        const distTiles = taxi ? dist(taxi.x, taxi.y, passenger.destX, passenger.destY) / TILE_SIZE : 0;
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.strokeText(`${distTiles.toFixed(0)} blocks`, sx, sy + pulse + 14);
        ctx.fillText(`${distTiles.toFixed(0)} blocks`, sx, sy + pulse + 14);

        // Direction arrow from player (off-screen indicator)
        if (!cam.isVisible(passenger.destX - 20, passenger.destY - 20, 40, 40)) {
            // Draw arrow at screen edge pointing to destination
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            const angle = Math.atan2(sy - cy, sx - cx);
            const edgeX = cx + Math.cos(angle) * Math.min(cx - 40, cy - 40);
            const edgeY = cy + Math.sin(angle) * Math.min(cx - 40, cy - 40);

            ctx.save();
            ctx.translate(edgeX, edgeY);
            ctx.rotate(angle);
            ctx.fillStyle = '#FF4444';
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(-8, -8);
            ctx.lineTo(-8, 8);
            ctx.closePath();
            ctx.fill();
            ctx.font = 'bold 11px sans-serif';
            ctx.rotate(-angle);
            ctx.fillStyle = '#FFD700';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeText('📍', -8, -12);
            ctx.fillText('📍', -8, -12);
            ctx.restore();
        }
    }

    _drawSpeedCameras(ctx, cam, hazardMgr) {
        for (const sc of hazardMgr.speedCameras) {
            if (!cam.isVisible(sc.x - 16, sc.y - 28, 32, 32)) continue;
            const sx = sc.x - cam.x;
            const sy = sc.y - cam.y;
            const justFlashed = sc.cooldown > 28; // flash effect for ~2s after catching

            // Base plate (on sidewalk)
            ctx.fillStyle = '#555';
            ctx.fillRect(sx - 5, sy + 2, 10, 4);

            // Pole
            ctx.fillStyle = '#777';
            ctx.fillRect(sx - 2, sy - 22, 4, 24);

            // Camera housing
            ctx.fillStyle = justFlashed ? '#ff3333' : '#2c2c2c';
            ctx.fillRect(sx - 8, sy - 28, 16, 10);
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx - 8, sy - 28, 16, 10);

            // Lens
            ctx.fillStyle = justFlashed ? '#ff0000' : '#4488ff';
            ctx.beginPath();
            ctx.arc(sx, sy - 23, 3, 0, Math.PI * 2);
            ctx.fill();

            // Flash effect when triggered
            if (justFlashed) {
                ctx.fillStyle = 'rgba(255,255,100,0.3)';
                ctx.beginPath();
                ctx.arc(sx, sy - 23, 20, 0, Math.PI * 2);
                ctx.fill();
            }

            // Small "SPEED CAM" label
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = '7px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('📸', sx, sy - 30);
        }
    }

    _drawEventHighlight(ctx, cam, building) {
        if (!cam.isVisible(building.x - 20, building.y - 20, building.width + 40, building.height + 40)) return;

        const sx = building.x - cam.x;
        const sy = building.y - cam.y;
        const pulse = Math.sin(Date.now() / 400) * 0.3 + 0.7;

        ctx.strokeStyle = `rgba(245, 197, 24, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(sx - 5, sy - 5, building.width + 10, building.height + 10);
        ctx.setLineDash([]);

        // Star particles
        const t = Date.now() / 1000;
        for (let i = 0; i < 4; i++) {
            const px = sx + building.width / 2 + Math.cos(t * 2 + i * 1.5) * (building.width * 0.6);
            const py = sy + building.height / 2 + Math.sin(t * 2 + i * 1.5) * (building.height * 0.6);
            ctx.font = '14px serif';
            ctx.fillText('⭐', px, py);
        }
    }

    _updateParticles(ctx, cam, taxi, dt) {
        dt = dt || 0.016;

        // Spawn tire smoke when turning at speed
        const absSpeed = Math.abs(taxi.speed);
        const isTurning = taxi.keys && (taxi.keys.a || taxi.keys.d);
        const isBraking = taxi.keys && taxi.keys.s && absSpeed > 40;

        if ((isTurning && absSpeed > 60) || isBraking) {
            const rear1X = taxi.x - Math.cos(taxi.angle) * taxi.width * 0.45 + Math.sin(taxi.angle) * taxi.height * 0.4;
            const rear1Y = taxi.y - Math.sin(taxi.angle) * taxi.width * 0.45 - Math.cos(taxi.angle) * taxi.height * 0.4;
            const rear2X = taxi.x - Math.cos(taxi.angle) * taxi.width * 0.45 - Math.sin(taxi.angle) * taxi.height * 0.4;
            const rear2Y = taxi.y - Math.sin(taxi.angle) * taxi.width * 0.45 + Math.cos(taxi.angle) * taxi.height * 0.4;

            for (let i = 0; i < 2; i++) {
                const rx = i === 0 ? rear1X : rear2X;
                const ry = i === 0 ? rear1Y : rear2Y;
                this.particles.push({
                    x: rx + rand(-2, 2),
                    y: ry + rand(-2, 2),
                    vx: rand(-15, 15),
                    vy: rand(-15, 15),
                    life: rand(0.3, 0.6),
                    maxLife: 0.6,
                    size: rand(3, 7),
                    color: isBraking ? 'rgba(60,60,60,' : 'rgba(180,180,180,',
                });
            }
        }

        // Spawn exhaust puffs when accelerating
        if (taxi.keys && taxi.keys.w && absSpeed > 20) {
            if (Math.random() < 0.3) {
                const exX = taxi.x - Math.cos(taxi.angle) * taxi.width * 0.5;
                const exY = taxi.y - Math.sin(taxi.angle) * taxi.width * 0.5;
                this.particles.push({
                    x: exX, y: exY,
                    vx: -Math.cos(taxi.angle) * 20 + rand(-5, 5),
                    vy: -Math.sin(taxi.angle) * 20 + rand(-5, 5),
                    life: rand(0.2, 0.5),
                    maxLife: 0.5,
                    size: rand(2, 4),
                    color: 'rgba(100,100,100,',
                });
            }
        }

        // Update and draw
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.size += dt * 4;

            const alpha = (p.life / p.maxLife) * 0.5;
            const sx = p.x - cam.x;
            const sy = p.y - cam.y;
            ctx.fillStyle = p.color + alpha.toFixed(2) + ')';
            ctx.beginPath();
            ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Cap particles
        if (this.particles.length > 200) {
            this.particles.splice(0, this.particles.length - 200);
        }
    }

    _drawTrafficLights(ctx, cam, hazardMgr) {
        if (!hazardMgr || !hazardMgr.trafficLights) return;
        for (const light of hazardMgr.trafficLights) {
            const sx = light.x - cam.x;
            const sy = light.y - cam.y;
            if (sx < -40 || sx > this.canvas.width + 40 || sy < -40 || sy > this.canvas.height + 40) continue;

            const state = hazardMgr.getTrafficLightState(light);
            const color = state === 'green' ? '#2ecc71' : state === 'yellow' ? '#f1c40f' : '#e74c3c';

            // Light pole
            ctx.fillStyle = '#555';
            ctx.fillRect(sx - 3, sy - 16, 6, 20);
            // Housing
            ctx.fillStyle = '#222';
            ctx.fillRect(sx - 5, sy - 16, 10, 16);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx - 5, sy - 16, 10, 16);

            // Three light circles (red/yellow/green positions)
            const lightY = [sy - 14, sy - 9, sy - 4];
            const lightC = ['#e74c3c', '#f1c40f', '#2ecc71'];
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = (state === 'red' && i === 0) || (state === 'yellow' && i === 1) || (state === 'green' && i === 2)
                    ? lightC[i] : 'rgba(40,40,40,0.8)';
                ctx.beginPath();
                ctx.arc(sx, lightY[i], 2.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Glow effect for active light
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(sx, sy, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    _drawSpeedLimitSigns(ctx, cam, city, hazardMgr, taxi) {
        if (!hazardMgr) return;
        // Draw speed limit signs near schools and hospitals
        for (const b of city.buildings) {
            if (b.type !== 'school' && b.type !== 'hospital') continue;
            if (!cam.isVisible(b.x - 20, b.y - 20, b.width + 40, b.height + 40)) continue;

            const sx = b.px - cam.x;
            const sy = b.py - cam.y - b.height / 2 - 10;

            // Speed sign
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(sx, sy, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(sx, sy, 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#222';
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(SPEED_LIMIT_SLOW, sx, sy);
        }

        // Also paint speed limit on some road segments
        const playerTile = pixelToTile(taxi.x, taxi.y);
        for (let r = Math.max(0, playerTile.row - 6); r < Math.min(MAP_ROWS, playerTile.row + 6); r++) {
            for (let c = Math.max(0, playerTile.col - 6); c < Math.min(MAP_COLS, playerTile.col + 6); c++) {
                const tile = city.tiles[r][c];
                if (tile !== TILE.ROAD_H && tile !== TILE.ROAD_V) continue;
                // Only paint on some road tiles (deterministic)
                const seed = (r * 137 + c * 251) % 100;
                if (seed !== 5 && seed !== 42) continue;

                const sx = c * TILE_SIZE - cam.x;
                const sy = r * TILE_SIZE - cam.y;

                // Determine speed limit for this area
                let limit = SPEED_LIMIT_CITY;
                for (const b of city.buildings) {
                    if (b.type === 'school' || b.type === 'hospital') {
                        const d = dist(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, b.px, b.py);
                        if (d < TILE_SIZE * 4) { limit = SPEED_LIMIT_SLOW; break; }
                    }
                }

                // Paint speed limit on road
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(limit, sx + TILE_SIZE / 2, sy + TILE_SIZE / 2);
            }
        }
    }

    _drawDayNightOverlay(ctx, gameTime, weather) {
        if (gameTime === undefined) return;
        const hour = (gameTime / 60) % 24;
        let alpha = 0;

        if (hour >= 21 || hour < 5) {
            alpha = 0.5;
        } else if (hour >= 18 && hour < 21) {
            alpha = ((hour - 18) / 3) * 0.5;
        } else if (hour >= 5 && hour < 7) {
            alpha = (1 - (hour - 5) / 2) * 0.5;
        }

        // Weather darkening
        if (weather && weather.current === 'rain') {
            alpha = Math.min(0.6, alpha + weather.intensity * 0.15);
        }

        if (alpha > 0.01) {
            ctx.fillStyle = `rgba(10, 10, 40, ${alpha})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            // Street lights at night — headlight glow around player
            if (alpha > 0.2) {
                ctx.globalCompositeOperation = 'lighter';
                const cx = this.canvas.width / 2;
                const cy = this.canvas.height / 2;
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 280);
                grad.addColorStop(0, `rgba(255, 230, 150, ${alpha * 0.35})`);
                grad.addColorStop(1, 'rgba(255, 230, 150, 0)');
                ctx.fillStyle = grad;
                ctx.fillRect(cx - 280, cy - 280, 560, 560);
                ctx.globalCompositeOperation = 'source-over';
            }
        }

        // Dusk/dawn sky tint
        if (weather) {
            if (hour >= 17 && hour < 19) {
                const t = (hour - 17) / 2;
                ctx.fillStyle = `rgba(255, 100, 50, ${t * 0.08})`;
                ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            } else if (hour >= 5 && hour < 7) {
                const t = 1 - (hour - 5) / 2;
                ctx.fillStyle = `rgba(255, 180, 80, ${t * 0.06})`;
                ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }
        }
    }

    _drawRain(ctx, weather) {
        ctx.strokeStyle = `rgba(180, 200, 255, ${weather.intensity * 0.5})`;
        ctx.lineWidth = 1;
        for (const drop of weather.rainDrops) {
            const sx = drop.x % this.canvas.width;
            const sy = drop.y % this.canvas.height;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - 2, sy + drop.length);
            ctx.stroke();
        }
    }

    _drawFog(ctx, weather) {
        const alpha = weather.intensity * 0.35;
        ctx.fillStyle = `rgba(200, 200, 210, ${alpha})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Fog gradient — thicker at edges
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const grad = ctx.createRadialGradient(cx, cy, 100, cx, cy, Math.max(cx, cy));
        grad.addColorStop(0, 'rgba(200,200,210,0)');
        grad.addColorStop(1, `rgba(200,200,210,${alpha * 0.8})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    _drawDamageOverlay(ctx, cam, taxi) {
        const sx = taxi.x - cam.x;
        const sy = taxi.y - cam.y;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(taxi.angle);
        const hw = taxi.width / 2;
        const hh = taxi.height / 2;

        if (taxi.damageVisual >= 1) {
            // Scratches
            ctx.strokeStyle = 'rgba(80,80,80,0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-hw + 4, -hh + 3); ctx.lineTo(-hw + 12, -hh + 8);
            ctx.moveTo(hw - 8, hh - 3); ctx.lineTo(hw - 3, hh - 7);
            ctx.stroke();
        }
        if (taxi.damageVisual >= 2) {
            // Dents
            ctx.fillStyle = 'rgba(60,40,20,0.4)';
            ctx.beginPath();
            ctx.arc(-hw + 6, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(hw - 5, -hh + 5, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        if (taxi.damageVisual >= 3) {
            // Cracked windshield
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hw * 0.3, -hh * 0.3);
            ctx.lineTo(hw * 0.5, -hh * 0.1);
            ctx.lineTo(hw * 0.35, hh * 0.2);
            ctx.moveTo(hw * 0.5, -hh * 0.1);
            ctx.lineTo(hw * 0.6, hh * 0.15);
            ctx.stroke();
            // Smoke from hood
            if (Math.random() < 0.3) {
                ctx.fillStyle = 'rgba(100,100,100,0.3)';
                ctx.beginPath();
                ctx.arc(hw - 2, rand(-5, 5), rand(2, 5), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    _drawFuelPriceSigns(ctx, cam, city) {
        for (const b of city.buildings) {
            if (b.type !== 'gas_station' || !b.fuelPrice) continue;
            if (!cam.isVisible(b.x - 10, b.y - 30, b.width + 20, b.height + 40)) continue;
            const sx = b.x - cam.x + b.width / 2;
            const sy = b.y - cam.y + b.height + 14;

            // Price sign background
            ctx.fillStyle = '#222';
            ctx.fillRect(sx - 24, sy - 8, 48, 16);
            ctx.strokeStyle = '#F44336';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx - 24, sy - 8, 48, 16);

            // Price text
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#0f0';
            ctx.fillText(`$${b.fuelPrice.toFixed(2)}/L`, sx, sy);
        }
    }

    _drawDashboard(ctx, taxi, weather, gameTime) {
        const cx = this.canvas.width - 100;
        const cy = this.canvas.height - 90;
        const r = 40;

        // Background panel
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        this._roundedRect(ctx, cx - 90, cy - 55, 180, 110, 10);
        ctx.fill();

        // Speedometer arc
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx - 30, cy, r, Math.PI * 0.75, Math.PI * 2.25);
        ctx.stroke();

        // Speed arc colored
        const speedPct = Math.min(taxi.currentDisplaySpeed / 300, 1);
        const speedAngle = Math.PI * 0.75 + speedPct * Math.PI * 1.5;
        const speedColor = speedPct > 0.8 ? '#e74c3c' : speedPct > 0.5 ? '#f1c40f' : '#2ecc71';
        ctx.strokeStyle = speedColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx - 30, cy, r, Math.PI * 0.75, speedAngle);
        ctx.stroke();

        // Needle
        const needleAngle = Math.PI * 0.75 + speedPct * Math.PI * 1.5;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 30, cy);
        ctx.lineTo(cx - 30 + Math.cos(needleAngle) * (r - 6), cy + Math.sin(needleAngle) * (r - 6));
        ctx.stroke();

        // Speed text
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${Math.round(taxi.currentDisplaySpeed)}`, cx - 30, cy + 12);
        ctx.font = '8px monospace';
        ctx.fillStyle = '#888';
        ctx.fillText('km/h', cx - 30, cy + 22);

        // Fuel gauge (right side, smaller)
        const fx = cx + 40;
        const fy = cy - 10;
        const fuelPct = taxi.fuel / taxi.fuelCapacity;
        const fuelColor = fuelPct > 0.3 ? '#2ecc71' : fuelPct > 0.15 ? '#f1c40f' : '#e74c3c';

        ctx.fillStyle = '#222';
        ctx.fillRect(fx - 8, fy - 25, 16, 50);
        ctx.fillStyle = fuelColor;
        ctx.fillRect(fx - 6, fy - 23 + (48 * (1 - fuelPct)), 12, 48 * fuelPct);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(fx - 8, fy - 25, 16, 50);
        ctx.font = '9px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('⛽', fx, fy + 33);

        // Tire health indicator
        const tireX = cx + 40;
        const tireY = cy - 38;
        const tirePct = taxi.tireHealth / TIRE_MAX_HEALTH;
        const tireColor = taxi.tireBlown ? '#ff0000' : tirePct > 0.3 ? '#2ecc71' : '#f1c40f';
        ctx.font = '10px sans-serif';
        ctx.fillStyle = tireColor;
        ctx.fillText('🛞', tireX, tireY);
        ctx.font = '7px monospace';
        ctx.fillText(`${Math.round(tirePct * 100)}%`, tireX, tireY + 9);

        // Rating stars (top right corner of dashboard)
        if (taxi.rating !== undefined) {
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FFD700';
            const starText = taxi.rating.toFixed(1) + '⭐';
            ctx.fillText(starText, cx - 30, cy - 42);
        }

        // Weather + surge indicator
        if (weather) {
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#aaa';
            const wIcon = weather.getWeatherIcon();
            const mult = weather.getFareMultiplier(gameTime);
            let wText = wIcon;
            if (mult > 1) {
                ctx.fillStyle = '#FFD700';
                wText += ` ${mult}x`;
            }
            ctx.fillText(wText, cx - 85, cy - 42);
        }
    }

    _drawPedestrians(ctx, cam, pedestrians) {
        if (!pedestrians) return;
        for (const ped of pedestrians) {
            if (!cam.isVisible(ped.x - 10, ped.y - 20, 20, 20)) continue;
            const sx = ped.x - cam.x;
            const sy = ped.y - cam.y;

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(sx, sy + 4, 4, 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Body
            ctx.fillStyle = ped.color;
            ctx.fillRect(sx - 3, sy - 6, 6, 10);

            // Head
            ctx.fillStyle = '#FFDEAD';
            ctx.beginPath();
            ctx.arc(sx, sy - 9, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Jaywalker warning
            if (ped.isJaywalker) {
                ctx.fillStyle = '#ff4444';
                ctx.font = '7px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('!', sx, sy - 15);
            }
        }
    }

    _drawBus(ctx, cam, bus, weather) {
        const sx = bus.x - cam.x;
        const sy = bus.y - cam.y;
        if (!cam.isVisible(bus.x - 30, bus.y - 15, 60, 30)) return;
        const isNight = weather && weather.isNight();

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(bus.angle);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-bus.width / 2 + 3, -bus.height / 2 + 3, bus.width, bus.height);

        // Bus body
        ctx.fillStyle = bus.color;
        ctx.fillRect(-bus.width / 2, -bus.height / 2, bus.width, bus.height);

        // Windows
        ctx.fillStyle = isNight ? '#FFFFCC88' : '#87CEEB88';
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(-bus.width / 2 + 6 + i * 9, -bus.height / 2 + 2, 6, bus.height - 4);
        }

        // Front windshield
        ctx.fillStyle = '#87CEEBAA';
        ctx.fillRect(bus.width / 2 - 6, -bus.height / 2 + 2, 5, bus.height - 4);

        // Headlights
        if (isNight) {
            ctx.fillStyle = 'rgba(255,255,200,0.08)';
            ctx.beginPath();
            ctx.moveTo(bus.width / 2, -bus.height / 2);
            ctx.lineTo(bus.width / 2 + 50, -bus.height - 15);
            ctx.lineTo(bus.width / 2 + 50, bus.height + 15);
            ctx.lineTo(bus.width / 2, bus.height / 2);
            ctx.closePath();
            ctx.fill();
        }

        // BUS label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BUS', 0, 0);

        // Outline
        ctx.strokeStyle = '#00000066';
        ctx.lineWidth = 1;
        ctx.strokeRect(-bus.width / 2, -bus.height / 2, bus.width, bus.height);

        // Bus stop indicator when stopped
        if (bus.isStopped) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '10px serif';
            ctx.fillText('🚏', 0, -bus.height / 2 - 8);
        }

        ctx.restore();
    }

    _drawNavWaypoint(ctx, cam, taxi, target) {
        const sx = target.x - cam.x;
        const sy = target.y - cam.y;
        const d = dist(taxi.x, taxi.y, target.x, target.y);

        // If close enough, auto-clear nav
        if (d < TILE_SIZE * 3) {
            taxi.navTarget = null;
            return;
        }

        const t = Date.now() / 1000;

        // Draw on-screen marker if visible
        const onScreen = sx > 0 && sx < this.canvas.width && sy > 0 && sy < this.canvas.height;
        if (onScreen) {
            const pulse = Math.sin(t * 3) * 5;
            // Glow ring
            ctx.shadowColor = '#00FF88';
            ctx.shadowBlur = 12;
            ctx.strokeStyle = '#00FF88';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(sx, sy, 22 + pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            // Pulsing inner dot
            ctx.fillStyle = 'rgba(0,255,136,0.3)';
            ctx.beginPath();
            ctx.arc(sx, sy, 12 + pulse * 0.5, 0, Math.PI * 2);
            ctx.fill();
            // Label with background
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            const lbl = target.label;
            const tw = ctx.measureText(lbl).width;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(sx - tw / 2 - 4, sy - 40, tw + 8, 18);
            ctx.fillStyle = '#00FF88';
            ctx.fillText(lbl, sx, sy - 26);
        }

        // Always draw direction arrow at screen edge (large, glowing)
        const angle = Math.atan2(target.y - taxi.y, target.x - taxi.x);
        const hw = this.canvas.width / 2;
        const hh = this.canvas.height / 2;
        const edgeDist = Math.min(hw, hh) - 50;
        const ax = hw + Math.cos(angle) * edgeDist;
        const ay = hh + Math.sin(angle) * edgeDist;
        const blocksAway = Math.round(d / TILE_SIZE);
        const arrowPulse = 1 + Math.sin(t * 4) * 0.15;

        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(angle);
        ctx.scale(arrowPulse, arrowPulse);
        // Arrow glow
        ctx.shadowColor = '#00FF88';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#00FF88';
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-10, -12);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // Distance label (always readable)
        ctx.scale(1 / arrowPulse, 1 / arrowPulse);
        ctx.rotate(-angle);
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        // Background pill
        const distText = `${blocksAway} blocks`;
        const dtw = ctx.measureText(distText).width;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(-dtw / 2 - 5, -30, dtw + 10, 18);
        ctx.fillStyle = '#00FF88';
        ctx.fillText(distText, 0, -16);
        // Target label
        if (target.label) {
            ctx.font = 'bold 11px sans-serif';
            ctx.fillStyle = '#88FFBB';
            ctx.fillText(target.label, 0, 22);
        }
        ctx.restore();
    }

    _drawAppPickupMarker(ctx, cam, px, py) {
        const sx = px - cam.x;
        const sy = py - cam.y;
        if (sx < -50 || sx > this.canvas.width + 50 || sy < -50 || sy > this.canvas.height + 50) return;

        const t = Date.now() / 1000;
        const pulse = Math.sin(t * 4) * 5;

        // Pulsing phone marker
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, 20 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = '18px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📱', sx, sy);

        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#3498db';
        ctx.fillText('PICKUP', sx, sy - 28);
    }

    _drawRestingOverlay(ctx, taxi) {
        ctx.fillStyle = 'rgba(0, 0, 30, 0.6)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏡 Resting at Home...', this.canvas.width / 2, this.canvas.height / 2 - 30);

        // Fatigue bar
        const barW = 300, barH = 20;
        const bx = (this.canvas.width - barW) / 2;
        const by = this.canvas.height / 2 + 10;
        ctx.fillStyle = '#333';
        ctx.fillRect(bx, by, barW, barH);
        const pct = 1 - (taxi.fatigue / MAX_FATIGUE);
        ctx.fillStyle = pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f1c40f' : '#e74c3c';
        ctx.fillRect(bx, by, barW * pct, barH);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(bx, by, barW, barH);

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText(`Energy: ${Math.round((1 - taxi.fatigue / MAX_FATIGUE) * 100)}%`, this.canvas.width / 2, by + 40);
    }

    _lightenColor(hex, amount) {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.min(255, (num >> 16) + amount);
        const g = Math.min(255, ((num >> 8) & 0xFF) + amount);
        const b = Math.min(255, (num & 0xFF) + amount);
        return `rgb(${r},${g},${b})`;
    }

    _darkenColor(hex, amount) {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.max(0, (num >> 16) - amount);
        const g = Math.max(0, ((num >> 8) & 0xFF) - amount);
        const b = Math.max(0, (num & 0xFF) - amount);
        return `rgb(${r},${g},${b})`;
    }

    _roundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    _drawMinimap(city, taxi, aiTaxis, passengerMgr, eventMgr, trafficMgr, hazardMgr) {
        const mctx = this.mctx;
        const mw = this.minimap.width;
        const mh = this.minimap.height;
        const scaleX = mw / MAP_WIDTH;
        const scaleY = mh / MAP_HEIGHT;

        mctx.fillStyle = 'rgba(0,0,0,0.8)';
        mctx.fillRect(0, 0, mw, mh);

        // Draw roads on minimap
        for (let r = 0; r < MAP_ROWS; r += 2) {
            for (let c = 0; c < MAP_COLS; c += 2) {
                const tile = city.tiles[r][c];
                if (isRoadTile(tile)) {
                    mctx.fillStyle = '#666';
                } else if (tile === TILE.BUILDING) {
                    mctx.fillStyle = '#554';
                } else if (tile === TILE.PARK) {
                    mctx.fillStyle = '#2a5a2a';
                } else {
                    continue;
                }
                mctx.fillRect(
                    c * TILE_SIZE * scaleX,
                    r * TILE_SIZE * scaleY,
                    TILE_SIZE * 2 * scaleX + 1,
                    TILE_SIZE * 2 * scaleY + 1
                );
            }
        }

        // Draw special buildings
        for (const b of city.buildings) {
            if (['gas_station', 'mechanic', 'stadium', 'concert_hall', 'hospital', 'home_base'].includes(b.type)) {
                const color = b.type === 'gas_station' ? '#F44336' :
                              b.type === 'mechanic' ? '#FF9800' :
                              b.type === 'stadium' ? '#4CAF50' :
                              b.type === 'concert_hall' ? '#9C27B0' :
                              b.type === 'home_base' ? '#FFEB3B' : '#E91E63';
                mctx.fillStyle = color;
                mctx.fillRect(b.x * scaleX - 1, b.y * scaleY - 1, b.type === 'home_base' ? 6 : 4, b.type === 'home_base' ? 6 : 4);
            }
        }

        // Draw passengers
        for (const p of passengerMgr.passengers) {
            if (!p.active || p.pickedUp) continue;
            mctx.fillStyle = '#00FF00';
            mctx.fillRect(p.x * scaleX - 1, p.y * scaleY - 1, 3, 3);
        }

        // Draw NPC traffic
        if (trafficMgr) {
            mctx.fillStyle = 'rgba(150,150,150,0.5)';
            for (const car of trafficMgr.cars) {
                mctx.fillRect(car.x * scaleX - 1, car.y * scaleY - 1, 2, 2);
            }
        }

        // Draw speed cameras on minimap
        if (hazardMgr && hazardMgr.speedCameras) {
            for (const sc of hazardMgr.speedCameras) {
                mctx.fillStyle = '#4488ff';
                mctx.fillRect(sc.x * scaleX - 2, sc.y * scaleY - 2, 4, 4);
            }
        }

        // Draw AI taxis
        for (const ai of aiTaxis) {
            mctx.fillStyle = ai.color;
            mctx.fillRect(ai.x * scaleX - 2, ai.y * scaleY - 2, 4, 4);
        }

        // Draw nav waypoint
        if (taxi.navTarget) {
            mctx.strokeStyle = '#00FF88';
            mctx.lineWidth = 2;
            const nx = taxi.navTarget.x * scaleX;
            const ny = taxi.navTarget.y * scaleY;
            mctx.beginPath();
            mctx.arc(nx, ny, 5, 0, Math.PI * 2);
            mctx.stroke();
        }

        // Draw destination if carrying passenger
        if (taxi.hasPassenger && taxi.passenger) {
            mctx.fillStyle = '#FF4444';
            const dx = taxi.passenger.destX * scaleX;
            const dy = taxi.passenger.destY * scaleY;
            mctx.beginPath();
            mctx.arc(dx, dy, 4, 0, Math.PI * 2);
            mctx.fill();
        }

        // Draw event building
        const eb = eventMgr.getActiveEventBuilding();
        if (eb) {
            mctx.strokeStyle = '#FFD700';
            mctx.lineWidth = 1;
            mctx.strokeRect(eb.x * scaleX - 3, eb.y * scaleY - 3, 8, 8);
        }

        // Draw player taxi (on top)
        mctx.fillStyle = '#FFD700';
        mctx.beginPath();
        mctx.arc(taxi.x * scaleX, taxi.y * scaleY, 3, 0, Math.PI * 2);
        mctx.fill();
        mctx.strokeStyle = '#000';
        mctx.lineWidth = 1;
        mctx.stroke();

        // Camera viewport indicator
        mctx.strokeStyle = 'rgba(255,255,255,0.4)';
        mctx.lineWidth = 1;
        mctx.strokeRect(
            taxi.x * scaleX - (window.innerWidth / 2 * scaleX),
            taxi.y * scaleY - (window.innerHeight / 2 * scaleY),
            window.innerWidth * scaleX,
            window.innerHeight * scaleY
        );
    }
}
