// ============================================================
// POLICE PATROL SYSTEM - Roaming police cars with traffic enforcement
// ============================================================

class PolicePatrolSystem {
    constructor(city) {
        this.city = city;
        this.policeCars = [];
        this.maxPatrols = 3;
        this.pullOverActive = false;
        this.pullOverTimer = 0;
        this.fineAmount = 0;
        this.violationType = null;
    }

    update(dt, playerTaxi) {
        // Spawn police patrols if needed
        while (this.policeCars.length < this.maxPatrols) {
            this._spawnPatrolCar();
        }

        // Update all police cars
        for (let i = this.policeCars.length - 1; i >= 0; i--) {
            const police = this.policeCars[i];
            this._updatePatrolCar(police, dt, playerTaxi);
            
            // Remove if too far from player
            if (dist(police.x, police.y, playerTaxi.x, playerTaxi.y) > TILE_SIZE * 25) {
                this.policeCars.splice(i, 1);
            }
        }

        // Handle active pull-over
        if (this.pullOverActive) {
            this.pullOverTimer -= dt;
            if (this.pullOverTimer <= 0) {
                this._completePullOver(playerTaxi);
            }
        }
    }

    _spawnPatrolCar() {
        // Spawn at random road position away from player
        let pos;
        for (let attempt = 0; attempt < 10; attempt++) {
            pos = this.city.getRandomRoadPosition();
            // Make sure it's not too close to player
            if (dist(pos.x, pos.y, this._getPlayerPos().x, this._getPlayerPos().y) > TILE_SIZE * 10) {
                break;
            }
        }

        if (pos) {
            this.policeCars.push({
                x: pos.x,
                y: pos.y,
                angle: Math.random() * Math.PI * 2,
                speed: 80 + Math.random() * 40, // Police drive slightly faster than normal traffic
                maxSpeed: 140,
                width: 32,
                height: 20,
                color: '#1e3a8a', // Dark blue
                lightsActive: false,
                sirenTimer: 0,
                patrolMode: 'cruise', // 'cruise', 'pursuit', 'pulling_over'
                targetSpeed: 100,
                waypoints: [],
                waypointIdx: 0,
                pullOverTarget: null
            });
        }
    }

    _getPlayerPos() {
        // This would be passed in from the game, using a fallback for now
        return { x: MAP_COLS * TILE_SIZE / 2, y: MAP_ROWS * TILE_SIZE / 2 };
    }

    _updatePatrolCar(police, dt, playerTaxi) {
        // Check for traffic violations near player
        const distToPlayer = dist(police.x, police.y, playerTaxi.x, playerTaxi.y);
        
        if (distToPlayer < TILE_SIZE * 5 && !this.pullOverActive) {
            const violation = this._checkViolation(playerTaxi);
            if (violation) {
                this._initiatePullOver(police, playerTaxi, violation);
                return;
            }
        }

        // Update patrol behavior
        switch (police.patrolMode) {
            case 'cruise':
                this._cruiseBehavior(police, dt);
                break;
            case 'pursuit':
                this._pursuitBehavior(police, playerTaxi, dt);
                break;
            case 'pulling_over':
                this._pullOverBehavior(police, playerTaxi, dt);
                break;
        }

        // Movement
        police.x += Math.cos(police.angle) * police.speed * dt;
        police.y += Math.sin(police.angle) * police.speed * dt;

        // Keep on roads
        if (!this.city.isRoadAt(police.x, police.y)) {
            // Find nearest road and redirect
            const nearestRoad = this._findNearestRoadTile(police.x, police.y);
            if (nearestRoad) {
                const targetAngle = Math.atan2(nearestRoad.y - police.y, nearestRoad.x - police.x);
                police.angle = targetAngle;
            }
        }

        // Visual effects
        if (police.patrolMode === 'pursuit' || police.patrolMode === 'pulling_over') {
            police.sirenTimer += dt * 10;
            police.lightsActive = Math.sin(police.sirenTimer) > 0;
        } else {
            police.lightsActive = false;
        }
    }

    _checkViolation(playerTaxi) {
        // Speeding
        if (playerTaxi.currentDisplaySpeed > 140) {
            return { type: 'speeding', speed: playerTaxi.currentDisplaySpeed, limit: 120 };
        }

        // Wrong way driving (simplified check)
        // This would need more sophisticated road direction checking

        // Running red light (would need traffic light data)
        // For now, just check if player is going fast through intersections

        return null;
    }

    _initiatePullOver(police, playerTaxi, violation) {
        police.patrolMode = 'pursuit';
        police.pullOverTarget = playerTaxi;
        this.pullOverActive = true;
        this.violationType = violation.type;
        
        // Calculate fine
        if (violation.type === 'speeding') {
            const overSpeed = violation.speed - violation.limit;
            this.fineAmount = 50 + Math.floor(overSpeed * 2);
        }
    }

    _pursuitBehavior(police, playerTaxi, dt) {
        // Chase player
        const targetAngle = Math.atan2(playerTaxi.y - police.y, playerTaxi.x - police.x);
        police.angle = targetAngle;
        
        // Speed up to catch up
        const dist = dist(police.x, police.y, playerTaxi.x, playerTaxi.y);
        if (dist > TILE_SIZE * 2) {
            police.speed = Math.min(police.speed + 100 * dt, police.maxSpeed);
        } else {
            police.speed = Math.max(playerTaxi.speed + 10, 60);
            // Close enough to pull over
            if (dist < TILE_SIZE * 1.5 && Math.abs(playerTaxi.speed) < 30) {
                police.patrolMode = 'pulling_over';
                this.pullOverTimer = 5; // 5 seconds to complete pull over
            }
        }
    }

    _pullOverBehavior(police, playerTaxi, dt) {
        // Position behind player
        const behindAngle = playerTaxi.angle + Math.PI;
        const targetX = playerTaxi.x - Math.cos(playerTaxi.angle) * TILE_SIZE * 1.5;
        const targetY = playerTaxi.y - Math.sin(playerTaxi.angle) * TILE_SIZE * 1.5;
        
        const targetAngle = Math.atan2(targetY - police.y, targetX - police.x);
        const angleDiff = targetAngle - police.angle;
        police.angle += clamp(angleDiff, -3 * dt, 3 * dt);
        
        // Slow down and stop
        police.speed = Math.max(police.speed - 80 * dt, 0);
    }

    _cruiseBehavior(police, dt) {
        // Random patrol route
        if (police.waypoints.length === 0 || police.waypointIdx >= police.waypoints.length) {
            this._generatePatrolRoute(police);
        }

        if (police.waypoints.length > 0) {
            const target = police.waypoints[police.waypointIdx];
            const dist = Math.hypot(target.x - police.x, target.y - police.y);
            
            if (dist < TILE_SIZE) {
                police.waypointIdx++;
            } else {
                const targetAngle = Math.atan2(target.y - police.y, target.x - police.x);
                let angleDiff = targetAngle - police.angle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                police.angle += clamp(angleDiff, -2 * dt, 2 * dt);
                
                // Speed control
                police.speed = police.targetSpeed;
            }
        }
    }

    _generatePatrolRoute(police) {
        police.waypoints = [];
        police.waypointIdx = 0;
        
        // Generate random patrol points on main roads
        const numPoints = 5 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numPoints; i++) {
            const road = this.city.getRandomRoadPosition();
            if (road) {
                police.waypoints.push(road);
            }
        }
    }

    _findNearestRoadTile(x, y) {
        const maxRadius = 10;
        for (let radius = 1; radius < maxRadius; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    const r = Math.floor(y / TILE_SIZE) + dr;
                    const c = Math.floor(x / TILE_SIZE) + dc;
                    if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
                        const tile = this.city.tiles[r][c];
                        if (tile === TILE.ROAD_H || tile === TILE.ROAD_V || tile === TILE.ROAD_CROSS) {
                            return {
                                x: c * TILE_SIZE + TILE_SIZE / 2,
                                y: r * TILE_SIZE + TILE_SIZE / 2
                            };
                        }
                    }
                }
            }
        }
        return null;
    }

    _completePullOver(playerTaxi) {
        // Issue fine
        playerTaxi.money -= this.fineAmount;
        playerTaxi.totalFines++;
        
        // Reset
        this.pullOverActive = false;
        this.pullOverTimer = 0;
        this.fineAmount = 0;
        this.violationType = null;
        
        // Reset police cars to cruise mode
        for (const police of this.policeCars) {
            if (police.patrolMode === 'pulling_over') {
                police.patrolMode = 'cruise';
                police.pullOverTarget = null;
                police.speed = 80;
            }
        }
    }

    draw(ctx, camera) {
        for (const police of this.policeCars) {
            const sx = police.x - camera.x;
            const sy = police.y - camera.y;
            
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(police.angle);
            
            // Police car body
            ctx.fillStyle = police.color;
            ctx.fillRect(-police.width/2, -police.height/2, police.width, police.height);
            
            // Police markings
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-police.width/2 + 4, -2, police.width - 8, 4);
            
            // Emergency lights
            if (police.lightsActive) {
                // Red light
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(-police.width/2 + 2, -police.height/2 - 4, 4, 3);
                // Blue light
                ctx.fillStyle = '#0000ff';
                ctx.fillRect(police.width/2 - 6, -police.height/2 - 4, 4, 3);
            }
            
            ctx.restore();
        }
    }

    isActive() {
        return this.pullOverActive;
    }

    getPullOverInfo() {
        if (!this.pullOverActive) return null;
        return {
            timer: this.pullOverTimer,
            fine: this.fineAmount,
            violation: this.violationType
        };
    }
}
