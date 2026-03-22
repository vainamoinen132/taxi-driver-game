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

        // Pre-render tile colors
        this.tileColors = {
            [TILE.GRASS]: '#3a7d3a',
            [TILE.ROAD_H]: '#555555',
            [TILE.ROAD_V]: '#555555',
            [TILE.ROAD_CROSS]: '#666666',
            [TILE.SIDEWALK]: '#999988',
            [TILE.BUILDING]: '#8B7355',
            [TILE.WATER]: '#4488cc',
            [TILE.PARK]: '#2d8a2d',
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

    render(camera, city, taxi, aiTaxis, trafficMgr, passengerMgr, hazardMgr, eventMgr, appOrderMgr, gameTime, dt) {
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

        // Draw traffic lights at intersections
        this._drawTrafficLights(ctx, cam, city);

        // Draw speed cameras
        this._drawSpeedCameras(ctx, cam, hazardMgr);

        // Draw passengers
        this._drawPassengers(ctx, cam, passengerMgr);

        // Draw NPC traffic
        if (trafficMgr) {
            for (const car of trafficMgr.cars) {
                this._drawCar(ctx, cam, car.x, car.y, car.angle, car.width, car.height, car.color, false);
            }
        }

        // Draw AI taxis
        for (const ai of aiTaxis) {
            this._drawCar(ctx, cam, ai.x, ai.y, ai.angle, ai.width, ai.height, ai.color, false);
        }

        // Update and draw particles
        this._updateParticles(ctx, cam, taxi, dt);

        // Draw player taxi
        this._drawPlayerTaxi(ctx, cam, taxi);

        // Draw destination marker if has passenger
        if (taxi.hasPassenger && taxi.passenger) {
            this._drawDestinationMarker(ctx, cam, taxi.passenger);
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

        // Draw day/night overlay
        this._drawDayNightOverlay(ctx, gameTime);

        // Draw minimap
        this._drawMinimap(city, taxi, aiTaxis, passengerMgr, eventMgr, trafficMgr);
    }

    _drawTiles(ctx, cam, city, startCol, endCol, startRow, endRow) {
        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                const tile = city.tiles[r][c];
                const sx = c * TILE_SIZE - cam.x;
                const sy = r * TILE_SIZE - cam.y;

                ctx.fillStyle = this.tileColors[tile] || '#3a7d3a';
                ctx.fillRect(sx, sy, TILE_SIZE + 1, TILE_SIZE + 1);

                // Add grass texture variation
                if (tile === TILE.GRASS) {
                    const seed = (r * 137 + c * 251) % 100;
                    if (seed < 20) {
                        ctx.fillStyle = '#358035';
                        ctx.fillRect(sx + 10, sy + 10, 3, 3);
                    }
                    if (seed > 80) {
                        ctx.fillStyle = '#4a9d4a';
                        ctx.fillRect(sx + 30, sy + 25, 4, 4);
                    }
                }

                // Park decorations
                if (tile === TILE.PARK) {
                    const seed = (r * 73 + c * 197) % 100;
                    if (seed < 30) {
                        this._drawTree(ctx, sx + 32, sy + 32, 12);
                    }
                }
            }
        }
    }

    _drawRoadMarkings(ctx, cam, city, startCol, endCol, startRow, endRow) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 12]);

        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                const tile = city.tiles[r][c];
                const sx = c * TILE_SIZE - cam.x;
                const sy = r * TILE_SIZE - cam.y;

                if (tile === TILE.ROAD_H) {
                    // Center line
                    ctx.beginPath();
                    ctx.moveTo(sx, sy + TILE_SIZE / 2);
                    ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE / 2);
                    ctx.stroke();
                } else if (tile === TILE.ROAD_V) {
                    ctx.beginPath();
                    ctx.moveTo(sx + TILE_SIZE / 2, sy);
                    ctx.lineTo(sx + TILE_SIZE / 2, sy + TILE_SIZE);
                    ctx.stroke();
                }
            }
        }
        ctx.setLineDash([]);

        // Road edges
        ctx.strokeStyle = '#ffffff44';
        ctx.lineWidth = 1;
        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                const tile = city.tiles[r][c];
                if (!isRoadTile(tile)) continue;
                const sx = c * TILE_SIZE - cam.x;
                const sy = r * TILE_SIZE - cam.y;

                // Check adjacent tiles to draw curb
                if (r > 0 && !isRoadTile(city.tiles[r - 1][c])) {
                    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + TILE_SIZE, sy); ctx.stroke();
                }
                if (r < MAP_ROWS - 1 && !isRoadTile(city.tiles[r + 1][c])) {
                    ctx.beginPath(); ctx.moveTo(sx, sy + TILE_SIZE); ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE); ctx.stroke();
                }
                if (c > 0 && !isRoadTile(city.tiles[r][c - 1])) {
                    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + TILE_SIZE); ctx.stroke();
                }
                if (c < MAP_COLS - 1 && !isRoadTile(city.tiles[r][c + 1])) {
                    ctx.beginPath(); ctx.moveTo(sx + TILE_SIZE, sy); ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE); ctx.stroke();
                }
            }
        }
    }

    _drawBuildings(ctx, cam, city, startCol, endCol, startRow, endRow) {
        for (const b of city.buildings) {
            if (!cam.isVisible(b.x, b.y, b.width, b.height)) continue;

            const sx = b.x - cam.x;
            const sy = b.y - cam.y;

            // Building body
            const color = BUILDING_COLORS[b.type] || '#8B7355';
            ctx.fillStyle = color;
            ctx.fillRect(sx + 2, sy + 2, b.width - 4, b.height - 4);

            // Building border/shadow
            ctx.strokeStyle = '#00000044';
            ctx.lineWidth = 2;
            ctx.strokeRect(sx + 2, sy + 2, b.width - 4, b.height - 4);

            // Roof highlight
            ctx.fillStyle = '#ffffff15';
            ctx.fillRect(sx + 2, sy + 2, b.width - 4, 6);

            // Windows for larger buildings
            if (b.width >= TILE_SIZE * 2 && b.height >= TILE_SIZE * 2) {
                ctx.fillStyle = '#ffffff33';
                const winSize = 6;
                const winGap = 14;
                for (let wy = sy + 16; wy < sy + b.height - 12; wy += winGap) {
                    for (let wx = sx + 12; wx < sx + b.width - 12; wx += winGap) {
                        ctx.fillRect(wx, wy, winSize, winSize);
                    }
                }
            }

            // Building icon
            const icon = BUILDING_ICONS[b.type];
            if (icon) {
                ctx.font = `${Math.min(b.width, b.height) * 0.35}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(icon, sx + b.width / 2, sy + b.height / 2);
            }

            // Building label (only for special buildings)
            if (['gas_station', 'mechanic', 'stadium', 'concert_hall', 'hospital', 'school', 'mall', 'police', 'home_base'].includes(b.type)) {
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                const label = b.type.replace(/_/g, ' ').toUpperCase();
                ctx.strokeText(label, sx + b.width / 2, sy - 4);
                ctx.fillText(label, sx + b.width / 2, sy - 4);
            }
        }
    }

    _drawTree(ctx, x, y, size) {
        // Trunk
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(x - 2, y, 4, size * 0.5);
        // Canopy
        ctx.fillStyle = '#2E7D32';
        ctx.beginPath();
        ctx.arc(x, y - size * 0.1, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#388E3C';
        ctx.beginPath();
        ctx.arc(x - 3, y - size * 0.2, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawCar(ctx, cam, x, y, angle, w, h, color, isPlayer) {
        const sx = x - cam.x;
        const sy = y - cam.y;

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

        // Headlights
        ctx.fillStyle = '#FFFF88';
        ctx.fillRect(w / 2 - 3, -h / 2 + 2, 4, 4);
        ctx.fillRect(w / 2 - 3, h / 2 - 6, 4, 4);

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

    _drawPlayerTaxi(ctx, cam, taxi) {
        // Flash effect
        let color = '#f5c518';
        if (taxi.flashTimer > 0 && taxi.flashColor) {
            color = Math.sin(taxi.flashTimer * 20) > 0 ? taxi.flashColor : '#f5c518';
        }

        // Low fuel warning pulse
        if (taxi.fuel < 20 && Math.sin(Date.now() / 200) > 0) {
            // Draw fuel warning ring
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

        this._drawCar(ctx, cam, taxi.x, taxi.y, taxi.angle, taxi.width, taxi.height, color, true);
    }

    _drawPassengers(ctx, cam, passengerMgr) {
        for (const p of passengerMgr.passengers) {
            if (!p.active || p.pickedUp) continue;
            if (!cam.isVisible(p.x - 20, p.y - 30, 40, 40)) continue;

            const sx = p.x - cam.x;
            const sy = p.y - cam.y;
            const bob = Math.sin(p.bobTimer) * 3;

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(sx, sy + 8, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Body
            ctx.fillStyle = p.color;
            ctx.fillRect(sx - 5, sy - 10 + bob, 10, 14);

            // Head
            ctx.fillStyle = '#FFDEAD';
            ctx.beginPath();
            ctx.arc(sx, sy - 14 + bob, 6, 0, Math.PI * 2);
            ctx.fill();

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

    _drawDestinationMarker(ctx, cam, passenger) {
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

        // Distance indicator
        const distTiles = dist(passenger.x, passenger.y, passenger.destX, passenger.destY) / TILE_SIZE;
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
            if (!cam.isVisible(sc.x - 10, sc.y - 20, 20, 20)) continue;
            const sx = sc.x - cam.x;
            const sy = sc.y - cam.y;

            // Camera pole
            ctx.fillStyle = '#666';
            ctx.fillRect(sx - 2, sy - 15, 4, 15);

            // Camera box
            ctx.fillStyle = sc.cooldown > 0 ? '#ff4444' : '#333';
            ctx.fillRect(sx - 6, sy - 20, 12, 8);

            // Lens
            ctx.fillStyle = sc.cooldown > 0 ? '#ff0000' : '#888';
            ctx.beginPath();
            ctx.arc(sx, sy - 16, 3, 0, Math.PI * 2);
            ctx.fill();
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

    _drawTrafficLights(ctx, cam, city) {
        // Draw traffic lights at ~30% of intersections (deterministic based on position)
        const cycle = Date.now() / 1000;
        for (const rRow of city.horizontalRoads) {
            for (const cCol of city.verticalRoads) {
                // Only place traffic lights at some intersections
                if ((rRow * 7 + cCol * 13) % 10 > 2) continue;

                const x = cCol * TILE_SIZE - cam.x;
                const y = rRow * TILE_SIZE - cam.y;

                // Skip if off-screen
                if (x < -30 || x > this.canvas.width + 30 || y < -30 || y > this.canvas.height + 30) continue;

                // Traffic light cycles: 6s green, 2s yellow, 6s red for each direction
                // Each intersection has a unique phase offset
                const phase = ((rRow * 13 + cCol * 7) % 14);
                const t = ((cycle + phase) % 14);
                let hColor = '#e74c3c', vColor = '#e74c3c';
                if (t < 6) {
                    hColor = '#2ecc71'; vColor = '#e74c3c';
                } else if (t < 8) {
                    hColor = '#f1c40f'; vColor = '#e74c3c';
                } else if (t < 12) {
                    vColor = '#2ecc71'; hColor = '#e74c3c';
                } else {
                    vColor = '#f1c40f'; hColor = '#e74c3c';
                }

                // Draw 4 traffic lights at intersection corners
                const offsets = [
                    { dx: -8, dy: -8 },  // top-left
                    { dx: TILE_SIZE * 2 + 4, dy: -8 },  // top-right
                    { dx: -8, dy: TILE_SIZE * 2 + 4 },  // bottom-left
                    { dx: TILE_SIZE * 2 + 4, dy: TILE_SIZE * 2 + 4 },  // bottom-right
                ];

                for (let i = 0; i < offsets.length; i++) {
                    const lx = x + offsets[i].dx;
                    const ly = y + offsets[i].dy;
                    // Pole
                    ctx.fillStyle = '#444';
                    ctx.fillRect(lx, ly, 6, 14);
                    // Light housing
                    ctx.fillStyle = '#222';
                    ctx.fillRect(lx - 1, ly, 8, 14);
                    // Active light (top/bottom = horizontal road light, left/right = vertical)
                    const isHorizontalLight = (i === 0 || i === 3);
                    const color = isHorizontalLight ? hColor : vColor;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(lx + 3, ly + 7, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    _drawDayNightOverlay(ctx, gameTime) {
        if (gameTime === undefined) return;
        const hour = (gameTime / 60) % 24;
        let alpha = 0;

        // Night: 21:00 - 05:00 = dark overlay
        // Dusk: 18:00 - 21:00 = fade in
        // Dawn: 05:00 - 07:00 = fade out
        if (hour >= 21 || hour < 5) {
            alpha = 0.45;
        } else if (hour >= 18 && hour < 21) {
            alpha = ((hour - 18) / 3) * 0.45;
        } else if (hour >= 5 && hour < 7) {
            alpha = (1 - (hour - 5) / 2) * 0.45;
        }

        if (alpha > 0.01) {
            ctx.fillStyle = `rgba(10, 10, 40, ${alpha})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            // Street lights near intersections at night
            if (alpha > 0.2) {
                ctx.globalCompositeOperation = 'lighter';
                // We'll just add a subtle warm glow near the player
                const cx = this.canvas.width / 2;
                const cy = this.canvas.height / 2;
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 250);
                grad.addColorStop(0, `rgba(255, 230, 150, ${alpha * 0.3})`);
                grad.addColorStop(1, 'rgba(255, 230, 150, 0)');
                ctx.fillStyle = grad;
                ctx.fillRect(cx - 250, cy - 250, 500, 500);
                ctx.globalCompositeOperation = 'source-over';
            }
        }
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

        // Draw on-screen marker if visible
        const onScreen = sx > 0 && sx < this.canvas.width && sy > 0 && sy < this.canvas.height;
        if (onScreen) {
            const t = Date.now() / 1000;
            const pulse = Math.sin(t * 3) * 4;
            ctx.strokeStyle = '#00FF88';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(sx, sy, 18 + pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.font = 'bold 11px sans-serif';
            ctx.fillStyle = '#00FF88';
            ctx.textAlign = 'center';
            ctx.fillText(target.label, sx, sy - 26);
        }

        // Always draw direction arrow at screen edge
        const angle = Math.atan2(target.y - taxi.y, target.x - taxi.x);
        const hw = this.canvas.width / 2;
        const hh = this.canvas.height / 2;
        const edgeDist = Math.min(hw, hh) - 40;
        const ax = hw + Math.cos(angle) * edgeDist;
        const ay = hh + Math.sin(angle) * edgeDist;
        const blocksAway = Math.round(d / TILE_SIZE);

        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(angle);
        // Arrow
        ctx.fillStyle = '#00FF88';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-6, -8);
        ctx.lineTo(-6, 8);
        ctx.closePath();
        ctx.fill();
        // Distance label
        ctx.rotate(-angle);
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00FF88';
        ctx.fillText(`${blocksAway}`, 0, -14);
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

    _drawMinimap(city, taxi, aiTaxis, passengerMgr, eventMgr, trafficMgr) {
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
