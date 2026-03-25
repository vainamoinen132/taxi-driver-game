// ============================================================
// HAZARDS SYSTEM - Speed fines, thieves, accidents
// ============================================================

class HazardManager {
    constructor(city) {
        this.city = city;
        this.speedCameras = [];
        this.trafficLights = [];
        this.notifications = [];
        this.accidentCooldown = 0;
        this.challengeMgr = null; // Will be set by game

        this._placeSpeedCameras();
        this._placeTrafficLights();
    }

    setChallengeManager(challengeMgr) {
        this.challengeMgr = challengeMgr;
    }

    _placeSpeedCameras() {
        for (const rRow of this.city.horizontalRoads) {
            for (const cCol of this.city.verticalRoads) {
                if (Math.random() < 0.1) {
                    this.speedCameras.push({
                        x: cCol * TILE_SIZE + TILE_SIZE,
                        y: rRow * TILE_SIZE + TILE_SIZE,
                        cooldown: 0,
                        radius: TILE_SIZE * 3,
                    });
                }
            }
        }
    }

    _placeTrafficLights() {
        // Place traffic lights at corners of intersections (on sidewalk),
        // just like real life — one light per intersection, positioned at
        // the top-right corner for visibility
        for (const rRow of this.city.horizontalRoads) {
            for (const cCol of this.city.verticalRoads) {
                if (Math.random() < TRAFFIC_LIGHT_PLACEMENT) {
                    // Intersection occupies 2x2 tiles: (rRow, cCol) to (rRow+1, cCol+1)
                    // Place lights at all 4 corners just outside the intersection
                    const corners = [
                        { x: cCol * TILE_SIZE - 4,              y: rRow * TILE_SIZE - 4 },              // top-left
                        { x: (cCol + 2) * TILE_SIZE + 4,       y: rRow * TILE_SIZE - 4 },              // top-right
                        { x: cCol * TILE_SIZE - 4,              y: (rRow + 2) * TILE_SIZE + 4 },       // bottom-left
                        { x: (cCol + 2) * TILE_SIZE + 4,       y: (rRow + 2) * TILE_SIZE + 4 },       // bottom-right
                    ];
                    // Use same timer so all 4 lights at this intersection are synced
                    const timer = Math.random() * TRAFFIC_LIGHT_CYCLE;
                    for (let ci = 0; ci < corners.length; ci++) {
                        this.trafficLights.push({
                            x: corners[ci].x,
                            y: corners[ci].y,
                            timer: timer,
                            cooldown: 0,
                            radius: TILE_SIZE * 1.8,
                            intersectionX: (cCol + 1) * TILE_SIZE,
                            intersectionY: (rRow + 1) * TILE_SIZE,
                            enforces: ci === 0, // only first corner handles fines
                        });
                    }
                }
            }
        }
    }

    getTrafficLightState(light) {
        const t = light.timer % TRAFFIC_LIGHT_CYCLE;
        const greenEnd = TRAFFIC_LIGHT_CYCLE * 0.45;
        const yellowEnd = TRAFFIC_LIGHT_CYCLE * 0.55;
        if (t < greenEnd) return 'green';
        if (t < yellowEnd) return 'yellow';
        return 'red';
    }

    _getLocalSpeedLimit(taxi) {
        // Check if near school or hospital — slow zone
        for (const b of this.city.buildings) {
            if (b.type === 'school' || b.type === 'hospital') {
                const d = dist(taxi.x, taxi.y, b.px, b.py);
                if (d < TILE_SIZE * 4) return SPEED_LIMIT_SLOW;
            }
        }
        return SPEED_LIMIT_CITY;
    }

    update(dt, taxi) {
        // Traffic light updates
        for (const light of this.trafficLights) {
            light.timer += dt;
            if (light.cooldown > 0) light.cooldown -= dt;

            // Check red light running (use intersection center for detection)
            if (light.cooldown <= 0 && light.enforces !== false) {
                const state = this.getTrafficLightState(light);
                if (state === 'red') {
                    const checkX = light.intersectionX || light.x;
                    const checkY = light.intersectionY || light.y;
                    const d = dist(taxi.x, taxi.y, checkX, checkY);
                    if (d < light.radius && Math.abs(taxi.speed) > 20) {
                        taxi.money -= RED_LIGHT_FINE;
                        taxi.totalFines++;
                        taxi.currentDayFines = (taxi.currentDayFines || 0) + 1;
                        light.cooldown = TRAFFIC_LIGHT_CYCLE;
                        this.addNotification(`🚦 Red light! Fine -${formatMoney(RED_LIGHT_FINE)}`, 'danger');
                        taxi.flashTimer = 0.5;
                        taxi.flashColor = '#ff4444';
                    }
                }
            }
        }

        // Speed camera checks — use local speed limit
        const localLimit = this._getLocalSpeedLimit(taxi);
        for (const cam of this.speedCameras) {
            if (cam.cooldown > 0) {
                cam.cooldown -= dt;
                continue;
            }
            const d = dist(taxi.x, taxi.y, cam.x, cam.y);
            if (d < cam.radius && taxi.currentDisplaySpeed > localLimit) {
                const fine = SPEED_FINE_AMOUNT + Math.floor((taxi.currentDisplaySpeed - localLimit) * 0.5);
                taxi.money -= fine;
                taxi.totalFines++;
                taxi.currentDayFines = (taxi.currentDayFines || 0) + 1;
                cam.cooldown = 30;
                this.addNotification(`📸 Speed fine! -${formatMoney(fine)} (${Math.floor(taxi.currentDisplaySpeed)}/${localLimit} km/h)`, 'danger');
                taxi.flashTimer = 0.5;
                taxi.flashColor = '#ff4444';
            }
        }

        // Random accident chance (very rare)
        this.accidentCooldown -= dt;
        if (this.accidentCooldown <= 0 && taxi.invulnTimer <= 0) {
            const accidentChance = (taxi.currentDisplaySpeed / 2000) * (taxi.totalKm / 200) * dt * 0.003;
            if (Math.random() < accidentChance && taxi.currentDisplaySpeed > 150) {
                const dmg = rand(ACCIDENT_DAMAGE_RANGE[0], ACCIDENT_DAMAGE_RANGE[1]);
                taxi.takeDamage(dmg);
                taxi.speed *= 0.1;
                taxi.invulnTimer = 3;
                this.accidentCooldown = 90;
                this.addNotification(`💥 Accident! Car damaged! (-${Math.floor(dmg)}% health)`, 'danger');
            }
        }

        // Mileage-based breakdowns
        if (taxi.checkMileageBreakdown()) {
            this.addNotification(`⚠️ Mechanical issue! Car health decreased. Visit a mechanic!`, 'warning');
        }

        // Update notification timers
        this.notifications = this.notifications.filter(n => {
            n.timer -= dt;
            return n.timer > 0;
        });
    }

    handleThiefPassenger(taxi, passenger) {
        // Thief steals money
        const stolen = rand(THIEF_STEAL_RANGE[0], THIEF_STEAL_RANGE[1]);
        const actualStolen = Math.min(stolen, taxi.money);
        taxi.money -= actualStolen;
        this.addNotification(
            `🔪 ${passenger.name} was a thief! Stole ${formatMoney(actualStolen)}!`,
            'danger'
        );
        taxi.flashTimer = 1;
        taxi.flashColor = '#ff0000';
    }

    addNotification(text, type = 'info') {
        this.notifications.push({
            text,
            type,
            timer: 4,
        });
    }

    getLatestNotification() {
        return this.notifications.length > 0
            ? this.notifications[this.notifications.length - 1]
            : null;
    }
}
